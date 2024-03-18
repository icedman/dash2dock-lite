'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';
import { BaseIcon } from 'resource:///org/gnome/shell/ui/iconGrid.js';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import { ShowAppsIcon } from 'resource:///org/gnome/shell/ui/dash.js';

import { Dot } from './apps/dot.js';

const Point = Graphene.Point;

const DOT_CANVAS_SIZE = 96;

const DockItemOverlay = GObject.registerClass(
  {},
  class DockItemOverlay extends St.Widget {
    _init(renderer, params) {
      super._init({
        name: 'DockItemContainer',
        ...params
      });

      this.renderer = renderer;
      if (renderer) {
        this.add_child(renderer);
      }
    }
  }
);

export const DockItemDotsOverlay = GObject.registerClass(
  {},
  class DockItemDotsOverlay extends DockItemOverlay {
    update(icon, data) {
      let renderer = this.renderer;
      let { appCount, position, vertical, extension } = data;

      renderer.width = icon._icon.width;
      renderer.height = icon._icon.height;
      renderer.pivot_point = icon._icon.pivot_point;

      if (vertical) {
        renderer.translationX =
          icon._icon.translationX + (position == 'left' ? -6 : 6);
        renderer.translationY = icon._icon.translationY;
      } else {
        renderer.translationX = icon._icon.translationX;
        renderer.translationY =
          icon._icon.translationY + (position == 'bottom' ? 8 : -8);
      }

      let options = extension.running_indicator_style_options;
      let running_indicator_style = options[extension.running_indicator_style];
      let running_indicator_color = extension.running_indicator_color;

      renderer.set_state({
        count: appCount,
        color: running_indicator_color || [1, 1, 1, 1],
        style: running_indicator_style || 'default',
        rotate: vertical
          ? position == 'right'
            ? -90
            : 90
          : position == 'top'
          ? 180
          : 0
      });
    }
  }
);

export const DockItemBadgeOverlay = GObject.registerClass(
  {},
  class DockItemBadgeOverlay extends DockItemOverlay {
    update(icon, data) {
      let renderer = this.renderer;
      let { noticesCount, position, vertical, extension } = data;

      renderer.width = icon._icon.width;
      renderer.height = icon._icon.height;
      renderer.set_scale(icon._icon.scaleX, icon._icon.scaleY);
      renderer.pivot_point = icon._icon.pivot_point;
      renderer.translationX = icon._icon.translationX + 4;
      renderer.translationY = icon._icon.translationY - 4;

      let options = extension.notification_badge_style_options;
      let notification_badge_style =
        options[extension.notification_badge_style];
      let notification_badge_color = extension.notification_badge_color;

      renderer.set_state({
        count: noticesCount,
        color: notification_badge_color || [1, 1, 1, 1],
        style: notification_badge_style || 'default',
        rotate: position == 'bottom' ? 180 : 0,
        translate: [0.4, 0]
      });
    }
  }
);

export class DockItemMenu extends PopupMenu.PopupMenu {
  constructor(sourceActor, side = St.Side.TOP, params = {}) {
    if (Clutter.get_default_text_direction() === Clutter.TextDirection.RTL) {
      if (side === St.Side.LEFT) side = St.Side.RIGHT;
      else if (side === St.Side.RIGHT) side = St.Side.LEFT;
    }

    super(sourceActor, 0.5, side);

    let { desktopApp } = params;
    this.desktopApp = desktopApp;
    this._newWindowItem = this.addAction('Open Window', () => {
      let workspaceManager = global.workspace_manager;
      let workspace = workspaceManager.get_active_workspace();
      let ctx = global.create_app_launch_context(0, workspace);
      desktopApp.launch([], ctx);
      this._onActivate();
    });

    desktopApp.list_actions().forEach(action => {
      let name = desktopApp.get_action_name(action);
      this.addAction(name, () => {
        let workspaceManager = global.workspace_manager;
        let workspace = workspaceManager.get_active_workspace();
        let ctx = global.create_app_launch_context(0, workspace);
        desktopApp.launch_action(action, ctx);
      });
    });
  }

  _buildFolder() {}

  _onActivate() {}

  popup() {
    this.open(BoxPointer.PopupAnimation.FULL);
    this._menuManager.ignoreRelease();
  }
}

export const DockItemList = GObject.registerClass(
  {},
  class DockItemList extends St.Widget {
    _init(renderer, params) {
      super._init({
        name: 'DockItemList',
        reactive: true,
        style_class: '-hi',
        ...params
      });

      this.connect('button-press-event', (obj, evt) => {
        this.visible = false;
        return Clutter.EVENT_PROPAGATE;
      });
    }

    build(list) {
      if (this._box) {
        this.remove_child(this._box);
        this._box = null;
      }

      if (!list.length) return;

      this._box = new St.Widget({ style_class: '-hi' });
      list.forEach(l => {
        let iconWithLabel = new St.BoxLayout({ style_class: '-hi' });
        iconWithLabel.text_direction = 2;

        let label = new St.Label({
          style_class: 'dash-label',
          x_expand: false,
          y_expand: false,
          x_align: Clutter.ActorAlign.CENTER,
          y_align: Clutter.ActorAlign.CENTER
        });
        let short = (l.name ?? '').replace(/(.{20})..+/, '$1...');
        label.text = short;
        label.style = `padding: 2px; padding-left: 6px; padding-right: 6px;`;
        label.opacity = 0;
        iconWithLabel._label = label;

        // iconWithLabel.reactive = true;
        // iconWithLabel.track_hover = true;

        let icon = new St.Icon({ icon_name: l.icon, reactive: true });
        iconWithLabel._icon = icon;
        let iconSize = this.dock._iconSizeScaledDown * this.dock._scaleFactor;
        icon.set_icon_size(iconSize);
        // icon.set_scale(0.8, 0.8);
        icon.connect('button-press-event', () => {
          let path = Gio.File.new_for_path(`Downloads/${l.name}`).get_path();
          let cmd = `xdg-open "${path}"`;
          if (l.type.includes('directory')) {
            cmd = `nautilus --select "${path}"`;
          }
          this.visible = false;
          this.dock._maybeBounce(this._target);

          try {
            console.log(cmd);
            trySpawnCommandLine(cmd);
          } catch (err) {
            console.log(err);
          }
        });
        iconWithLabel.add_child(icon);
        iconWithLabel.add_child(label);
        this._box.add_child(iconWithLabel);
      });

      let rad = 500;
      let rot = 0;
      let children = this._box.get_children();
      children.reverse();
      children.forEach(l => {
        let rrX = (rot * 3.14) / 180;
        let rrY = (rot * 3.14) / 180;
        let tx = Math.cos(rrX) * -rad;
        let ty = Math.sin(rrY) * rad;
        l.x = tx * 2 + rad * 2;
        l.y = ty * 3;
        l.rotation_angle_z = -rot;
        rot -= 2 * this.dock._scaleFactor;
      });

      let first = children[0];
      children.forEach(l => {
        l._x = l.x;
        l._y = l.y;
        l._rotation_angle_z = l.rotation_angle_z;
        l.x = first.x;
        l.y = first.y;
        l.rotation_angle_z = first.rotation_angle_z;
      });

      this.add_child(this._box);
    }
  }
);

export const DockItemContainer = GObject.registerClass(
  {},
  class DockItemContainer extends ShowAppsIcon {
    _init(params) {
      super._init({
        name: 'DockItemContainer',
        style_class: 'dash-item-container',
        ...(params || {})
      });

      this.name = params.appinfo_filename;
      this.show(false);

      let desktopApp = Gio.DesktopAppInfo.new_from_filename(
        params.appinfo_filename
      );

      this._label = this.label;
      this._labelText = desktopApp.get_name();

      try {
        this._default_icon_name = desktopApp.get_icon().get_names()[0];
      } catch (err) {
        //
      }

      // menu
      this._menu = new DockItemMenu(this, St.Side.TOP, {
        desktopApp
      });
      this._menuManager = new PopupMenu.PopupMenuManager(this);
      this._menu._menuManager = this._menuManager;
      Main.uiGroup.add_actor(this._menu.actor);
      this._menuManager.addMenu(this._menu);
      this._menu.close();
    }

    _onClick() {
      if (this._menu && this._menu._newWindowItem) {
        this._menu._newWindowItem.emit('activate', null);
      }
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        icon_name: this._default_icon_name,
        icon_size: size,
        style_class: 'show-apps-icon',
        track_hover: true
      });

      // attach event
      let button = this.first_child;
      button.reactive = false;
      let icon = this._iconActor;

      icon.reactive = true;
      icon.track_hover = true;
      [icon].forEach(btn => {
        if (btn._connected) return;
        btn._connected = true;
        btn.button_mask = St.ButtonMask.ONE | St.ButtonMask.TWO;
        btn.connectObject(
          'enter-event',
          () => {
            this.showLabel();
          },
          'leave-event',
          () => {
            this.hideLabel();
          },
          'button-press-event',
          (actor, evt) => {
            if (evt.get_button() != 1) {
              if (this._menu) {
                this._menu.popup();
              }
            } else {
              this._onClick();
            }
          },
          this
        );
      });

      return this._iconActor;
    }
  }
);

export const DockBackground = GObject.registerClass(
  {},
  class DockBackground extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockBackground',
        ...(params || {})
      });
    }

    update(params) {
      let {
        first,
        last,
        iconSize,
        scaleFactor,
        vertical,
        position,
        panel_mode,
        dashContainer
      } = params;

      if (!first || !last) return;

      let p1 = first.get_transformed_position();
      let p2 = last.get_transformed_position();

      if (!isNaN(p1[0]) && !isNaN(p1[1])) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = p1[0] + tx;
        this.y = first._fixedPosition[1];
        let width = dashContainer.dash.width + Math.abs(tx) + tx2;
        let height = dashContainer.dash.height;

        if (dashContainer.isVertical()) {
          this.x = first._fixedPosition[0];
          this.y = first._fixedPosition[1] + ty;
          width = dashContainer.dash.width;
          height = dashContainer.dash.height + Math.abs(ty) + ty2;
        }

        if (!isNaN(width)) {
          this.width = width;
        }
        if (!isNaN(height)) {
          this.height = height;
        }

        this.x -= dashContainer.x;
        this.y -= dashContainer.y;

        // adjust padding
        let az =
          ((dashContainer.isVertical() ? this.width : this.height) -
            iconSize * scaleFactor) *
          (0.6 - 0.8 * dashContainer.extension.dock_padding);
        this.x += az / 2;
        this.width -= az;
        this.y += az / 2;
        this.height -= az;

        if (panel_mode) {
          if (vertical) {
            this.y = dashContainer.y;
            this.height = dashContainer.height;
          } else {
            this.x = dashContainer.x;
            this.width = dashContainer.width;
          }
        }
      }
    }
  }
);
