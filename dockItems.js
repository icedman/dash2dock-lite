'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
  DashIcon,
  DashItemContainer,
} from 'resource:///org/gnome/shell/ui/dash.js';

import { DockPosition } from './dock.js';

const DockItemOverlay = GObject.registerClass(
  {},
  class DockItemOverlay extends St.Widget {
    _init(renderer, params) {
      super._init({
        name: 'DockItemContainer',
        ...params,
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

      let canvasScale = renderer.width / renderer._canvas.width;
      renderer._canvas.set_scale(canvasScale, canvasScale);

      if (vertical) {
        renderer.translationX =
          icon._icon.translationX + (position == DockPosition.LEFT ? -6 : 6);
        renderer.translationY = icon._icon.translationY;
      } else {
        renderer.translationX = icon._icon.translationX;
        renderer.translationY =
          icon._icon.translationY + (position == DockPosition.BOTTOM ? 8 : -8);
      }

      let options = extension.running_indicator_style_options;
      let running_indicator_style = options[extension.running_indicator_style];
      let running_indicator_color = extension.running_indicator_color;

      renderer.set_state({
        count: appCount,
        color: running_indicator_color || [1, 1, 1, 1],
        style: running_indicator_style || 'default',
        rotate: vertical
          ? position == DockPosition.RIGHT
            ? -90
            : 90
          : position == DockPosition.TOP
          ? 180
          : 0,
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

      let canvasScale = renderer.width / renderer._canvas.width;
      renderer._canvas.set_scale(canvasScale, canvasScale);

      let options = extension.notification_badge_style_options;
      let notification_badge_style =
        options[extension.notification_badge_style];
      let notification_badge_color = extension.notification_badge_color;

      renderer.set_state({
        count: noticesCount,
        color: notification_badge_color || [1, 1, 1, 1],
        style: notification_badge_style || 'default',
        rotate: position == DockPosition.BOTTOM ? 180 : 0,
        translate: [0.4, 0],
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
    if (!desktopApp) return;

    this.desktopApp = desktopApp;

    this._newWindowItem = this.addAction('Open Window', () => {
      let workspaceManager = global.workspace_manager;
      let workspace = workspaceManager.get_active_workspace();
      let ctx = global.create_app_launch_context(0, workspace);
      desktopApp.launch([], ctx);
      this._onActivate();
    });

    desktopApp.list_actions().forEach((action) => {
      let name = desktopApp.get_action_name(action);
      this.addAction(name, () => {
        let workspaceManager = global.workspace_manager;
        let workspace = workspaceManager.get_active_workspace();
        let ctx = global.create_app_launch_context(0, workspace);
        desktopApp.launch_action(action, ctx);
        this.item.dock.extension.animate({ refresh: true });
      });
    });
  }

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
        // style_class: 'hi',
        ...params,
      });

      this.connect('button-press-event', (obj, evt) => {
        if (!this._box || !this._box.get_children().length) {
          return Clutter.EVENT_PROPAGATE;
        }
        this.slideOut();
        return Clutter.EVENT_PROPAGATE;
      });
    }

    slideIn(target, list) {
      if (this._box) {
        this.remove_child(this._box);
        this._box = null;
      }

      if (!list.length) return;

      this.opacity = 0;

      let dock = this.dock;
      this.x = dock._monitor.x;
      this.y = dock._monitor.y;
      this.width = dock._monitor.width;
      this.height = dock._monitor.height;

      this._hidden = false;
      this._hiddenFrames = 0;

      this._target = target;

      this._box = new St.Widget({ style_class: '-hi' });
      let iconSize = dock.dash._box.first_child._icon.width;
      // scaling hack - temporary
      let iconAdjust = 1;
      if (dock._scaleFactor != 1 && dock._scaleFactor != 2) {
        iconAdjust += 0.5;
      }

      list.forEach((l) => {
        let w = new St.Widget({});
        let icon = new St.Icon({
          icon_name: l.icon,
          reactive: true,
          track_hover: true,
        });
        icon.set_icon_size(iconSize * iconAdjust);
        this._box.add_child(w);
        let label = new St.Label({ style_class: 'dash-label' });
        let short = (l.name ?? '').replace(/(.{32})..+/, '$1...');
        label.text = short;
        w.add_child(icon);
        w.add_child(label);
        w._icon = icon;
        w._label = label;
        label.opacity = 0;

        icon.connect('button-press-event', () => {
          // let path = Gio.File.new_for_path(`Downloads/${l.name}`).get_path();
          let path = l.path;
          let cmd = `xdg-open "${path}"`;

          if (l.type.includes('directory')) {
            cmd = `nautilus --select "${path}"`;
          }
          if (l.type.includes('exec')) {
            cmd = l.exec;
          }

          this.visible = false;
          this.dock._maybeBounce(this._target.child);

          try {
            console.log(cmd);
            trySpawnCommandLine(cmd);
          } catch (err) {
            console.log(err);
          }
        });
      });

      this.add_child(this._box);

      let tp = this._target.get_transformed_position();
      let angleInc = 0 + 2.5 * dock.extension.items_pullout_angle;
      let startAngle = 270 + 1 * angleInc;
      let angle = startAngle;
      let rad = iconSize * dock._scaleFactor;

      let ox = 0;
      let oy = -rad / 4;

      let children = this._box.get_children();
      children.reverse();
      children.forEach((l) => {
        let hX = Math.cos(angle * 0.0174533);
        let hY = Math.sin(angle * 0.0174533);
        let hl = Math.sqrt(hX * hX + hY * hY);
        hX /= hl;
        hY /= hl;
        hX *= rad;
        hY *= rad;

        l.x = tp[0] - this.x + ox;
        l.y = tp[1] - this.y + oy;

        ox += hX; // * 0.85;
        oy += hY;
        angle += angleInc;

        l.rotation_angle_z = angle - startAngle;
      });

      let first = children[0];
      children.forEach((l) => {
        l._ox = first.x;
        l._oy = first.y;
        l._oz = 0;
        l._label.opacity = 0;
        l._x = l.x;
        l._y = l.y - rad * 0.8;
        l._rotation_angle_z = l.rotation_angle_z;
        l.x = first.x;
        l.y = first.y;
        l.rotation_angle_z = 0;
      });
    }

    slideOut() {
      if (!this._hidden) {
        this._hidden = true;
        this._hiddenFrames = 80;
      }
    }
  }
);

export const DockIcon = GObject.registerClass(
  {},
  class DockIcon extends DashIcon {
    _init(params) {
      super._init(params);
      this._dot.visible = false;
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        icon_name: this._default_icon_name || 'file',
        icon_size: size,
        // style_class: 'show-apps-icon',
        track_hover: true,
      });

      let container = this.get_parent();

      // attach event
      let icon = this._iconActor;
      icon.reactive = true;
      icon.track_hover = true;

      icon.connectObject(
        'enter-event',
        () => {
          container.showLabel();
        },
        'leave-event',
        () => {
          container.hideLabel();
        },
        'button-press-event',
        (actor, evt) => {
          if (evt.get_button() != 1) {
            if (container._menu) {
              container._menu.popup();
            }
          } else {
            container._onClick();
          }
        },
        this
      );

      return this._iconActor;
    }
  }
);

export const DockItemContainer = GObject.registerClass(
  {},
  class DockItemContainer extends DashItemContainer {
    _init(params) {
      super._init({ ...params, scale_x: 1, scale_y: 1 });

      let desktopApp = Gio.DesktopAppInfo.new_from_filename(
        params.appinfo_filename
      );

      let dashIcon = new DockIcon(desktopApp, {
        name: 'DockItemContainer',
        style_class: 'dash-item-container',
        ...(params || {}),
      });
      this.set_scale(1, 1);
      this.setChild(dashIcon);

      // this.name = params.appinfo_filename;

      try {
        //   // this._labelText = desktopApp.get_name();
        this.setLabelText(desktopApp.get_name());
        dashIcon._default_icon_name = desktopApp.get_icon().get_names()[0];
      } catch (err) {
        console.log(err);
        //   console.log(params);
      }

      // menu
      this._menu = new DockItemMenu(this, St.Side.TOP, {
        desktopApp,
      });
      this._menu.item = this;
      this._menuManager = new PopupMenu.PopupMenuManager(this);
      this._menu._menuManager = this._menuManager;
      Main.uiGroup.add_child(this._menu.actor);
      this._menuManager.addMenu(this._menu);
      this._menu.close();

      dashIcon._menu = this._menu;
    }

    activateNewWindow() {
      if (this._menu && this._menu._newWindowItem) {
        this._menu._newWindowItem.emit('activate', null);
      }
    }

    _onClick() {
      this.activateNewWindow();
    }
  }
);

export const DockBackground = GObject.registerClass(
  {},
  class DockBackground extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockBackground',
        ...(params || {}),
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
        dashContainer,
      } = params;

      this._padding = 0;

      if (!first || !last || first == last) {
        this.opacity = 0;
        return;
      }

      let dp = dashContainer.dash.get_transformed_position();
      if (isNaN(dp[0]) || isNaN(dp[1])) return;

      let padding =
        iconSize *
        0.1 *
        (dashContainer.extension.dock_padding || 0) *
        scaleFactor;

      if (first && last) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = dp[0];
        this.y = dp[1];
        let width = dashContainer.dash.width;
        let height = dashContainer.dash.height;

        if (dashContainer.isVertical()) {
          this.y += ty;
          height += ty2 - ty;
        } else {
          this.x += tx;
          width += tx2 - tx;
        }

        // padding
        this.x -= padding;
        width += padding * 2;
        this.y -= padding;
        height += padding * 2;

        if (!isNaN(width)) {
          this.width = width;
        }
        if (!isNaN(height)) {
          this.height = height;
        }

        this.x -= dashContainer.x;
        this.y -= dashContainer.y;
        this._padding = padding;

        // adjust padding
        let az = -padding;
        this.x += az / 2;
        this.width -= az * (1 + !vertical);
        this.y += az / 2;
        this.height -= az * (1 + vertical);

        if (panel_mode) {
          if (vertical) {
            this.y = dashContainer.y;
            this.height = dashContainer.height;
          } else {
            this.x = dashContainer.x;
            this.width = dashContainer.width;
          }
        }

        this.opacity = 255;
        dashContainer.dash.opacity = this.opacity;
      }
    }
  }
);
