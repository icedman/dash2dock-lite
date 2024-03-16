'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
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

      let options = extension.notification_badge_style_options;
      let notification_badge_style =
        options[extension.notification_badge_style];
      let notification_badge_color = extension.notification_badge_color;

      renderer.set_state({
        count: noticesCount,
        color: notification_badge_color || [1, 1, 1, 1],
        style: notification_badge_style || 'default',
        rotate: position == 'bottom' ? 180 : 0,
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
    this._newWindowItem = this.addAction('New Window', () => {
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
      });
    });
  }

  _onActivate() {}

  popup() {
    this.open(BoxPointer.PopupAnimation.FULL);
    this._menuManager.ignoreRelease();
  }
}

export const DockItemContainer = GObject.registerClass(
  {},
  class DockItemContainer extends ShowAppsIcon {
    _init(params) {
      super._init({
        name: 'DockItemContainer',
        style_class: 'dash-item-container',
        ...(params || {}),
      });

      this.name = params.appinfo_filename;
      this.show(false);

      let desktopApp = Gio.DesktopAppInfo.new_from_filename(
        params.appinfo_filename
      );

      try {
        this._default_icon_name = desktopApp.get_icon().get_names()[0];
      } catch (err) {
        //
      }

      // button
      let button = this.first_child;
      button.button_mask = St.ButtonMask.ONE | St.ButtonMask.TWO;
      button.connect('button-press-event', (actor, evt) => {
        if (evt.get_button() != 1) {
          if (this._menu) {
            this._menu.popup();
          }
        } else {
          if (this._menu && this._menu._newWindowItem) {
            this._menu._newWindowItem.emit('activate', null);
          }
        }
      });

      // menu
      this._menu = new DockItemMenu(this, St.Side.TOP, {
        desktopApp,
      });
      this._menuManager = new PopupMenu.PopupMenuManager(this);
      this._menu._menuManager = this._menuManager;
      Main.uiGroup.add_actor(this._menu.actor);
      this._menuManager.addMenu(this._menu);
      this._menu.close();
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        icon_name: this._default_icon_name,
        icon_size: size,
        style_class: 'show-apps-icon',
        track_hover: true,
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
