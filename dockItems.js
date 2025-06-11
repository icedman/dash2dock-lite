'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { trySpawnCommandLine } from './utils.js';
// import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
  DashIcon,
  DashItemContainer,
} from 'resource:///org/gnome/shell/ui/dash.js';

import { DockPosition } from './dock.js';

//! move to dockitemMenu
class DockItemMenu extends PopupMenu.PopupMenu {
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
  },
);

export const DockItemDotsOverlay = GObject.registerClass(
  {},
  class DockItemDotsOverlay extends DockItemOverlay {
    update(icon, data) {
      let renderer = this.renderer;
      let { appCount, position, vertical, extension, dock } = data;

      renderer.width = dock._iconSizeScaledDown || icon._icon.width;
      renderer.height = dock._iconSizeScaledDown || icon._icon.height;
      renderer.pivot_point = icon._icon.pivot_point;

      let canvasScale = renderer.width / renderer._canvas.width;

      // scaling fix
      let scale = dock._monitor.geometry_scale || 1;
      canvasScale *= scale;
      renderer._canvas.set_scale(canvasScale, canvasScale);

      let offsetX = (renderer.width * 0.1) * scale;
      let offsetY = (renderer.height * 0.25) * scale;
      if (vertical) {
        offsetX = 0;
        if (position == DockPosition.RIGHT) {
          offsetX = (renderer.width * 0.2) * (scale * scale);
        }
      } else {
        if (position == DockPosition.TOP) {
          offsetY = (renderer.height * 1) * scale;
        }
      }

      renderer.translationX = icon._icon.translationX + offsetX;
      renderer.translationY = icon._icon.translationY + offsetY;

      let options = extension.running_indicator_style_options;
      let running_indicator_style = options[extension.running_indicator_style];
      let running_indicator_color = extension.running_indicator_color;

      renderer.set_state({
        count: appCount,
        color: running_indicator_color || [1, 1, 1, 1],
        style: running_indicator_style || 'default',
        size: extension.running_indicator_size || 0,
        rotate: vertical
          ? position == DockPosition.RIGHT
            ? -90
            : 90
          : position == DockPosition.TOP
            ? 180
            : 0,
      });
    }
  },
);

export const DockItemBadgeOverlay = GObject.registerClass(
  {},
  class DockItemBadgeOverlay extends DockItemOverlay {
    update(icon, data) {
      let renderer = this.renderer;
      let { noticesCount, position, vertical, extension, scale } = data;

      renderer.width = icon._icon.width;
      renderer.height = icon._icon.height;
      let canvasScale = renderer.width / renderer._canvas.width;
      renderer._canvas.set_scale(canvasScale, canvasScale);

      let options = extension.notification_badge_style_options;
      let notification_badge_style =
        options[extension.notification_badge_style];
      let notification_badge_color = extension.notification_badge_color;

      // renderer.translationX = icon._icon.translationX;
      // renderer.translationY = icon._icon.translationY;

      renderer.set_state({
        count: noticesCount,
        color: notification_badge_color || [1, 1, 1, 1],
        style: notification_badge_style || 'default',
        size: extension.notification_badge_size || 0,
        translate: [0.4, -0.8],
      });
    }
  },
);

export const DockIcon = GObject.registerClass(
  {},
  class DockIcon extends DashIcon {
    _init(app) {
      super._init(app);
      this._dot.visible = false;

      this._draggable._onButtonPress = () => {
        return Clutter.EVENT_PROPAGATE;
      };
      this._draggable._onTouchEvent = () => {
        return Clutter.EVENT_PROPAGATE;
      };
      this._draggable._grabActor = () => {};
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        icon_name: this._default_icon_name || 'file',
        icon_size: size,
        style_class: this._default_icon_style_class || '',
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
          try {
            container.showLabel();
          } catch (err) {
            console.log(err);
          }
        },
        'leave-event',
        () => {
          try {
            container.hideLabel();
          } catch (err) {
            console.log(err);
          }
        },
        'button-press-event',
        (actor, evt) => {
          if (evt.get_button() != 1) {
            if (container._menu) {
              container._menu.popup();
            }
          } else {
            if (container._onClick) {
              container._onClick();
            }
          }
        },
        this,
      );

      return this._iconActor;
    }
  },
);

export const DockItemContainer = GObject.registerClass(
  {},
  class DockItemContainer extends DashItemContainer {
    _init(params) {
      super._init({
        name: 'DockItemContainer',
        style_class: 'dash-item-container',
        ...params,
        scale_x: 1,
        scale_y: 1,
      });

      this.custom_icon = true;

      let desktopApp = params.app;
      if (desktopApp) {
        // monkey patch dummy app
        if (!desktopApp.get_icon) {
          desktopApp.can_open_new_window = () => false;
          desktopApp.create_icon_texture = () => null;
          desktopApp.get_windows = () => null;
          desktopApp.get_icon = () => {
            return {
              get_names: () => [],
            };
          };
        }
      } else {
        desktopApp = Gio.DesktopAppInfo.new_from_filename(
          params.appinfo_filename,
        );
      }

      let dashIcon = new DockIcon(desktopApp, {
        name: 'DockItemContainer',
        style_class: 'dash-item-container',
        ...(params || {}),
      });
      this.set_scale(1, 1);
      this.setChild(dashIcon);

      try {
        this.setLabelText(desktopApp.get_name());
        dashIcon._default_icon_name = desktopApp.get_icon().get_names()[0];
      } catch (err) {
        console.log(err);
        console.log(params);
      }

      // menu
      if (params.appinfo_filename) {
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
    }

    activateNewWindow() {
      if (this._menu && this._menu._newWindowItem) {
        this._menu._newWindowItem.emit('activate', null);
      }
    }

    _onClick() {
      this.activateNewWindow();
    }
  },
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
        dock,
      } = params;

      this._padding = 0;

      if (!first || !last || first == last) {
        this.opacity = 0;
        return;
      }

      let dp = dock.dash.get_transformed_position();
      if (isNaN(dp[0]) || isNaN(dp[1])) return;

      let padding =
        iconSize * 0.1 * (dock.extension.dock_padding || 0) * scaleFactor;

      if (first && last) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = dp[0];
        this.y = dp[1];
        let width = dock.dash.width;
        let height = dock.dash.height;

        if (dock.isVertical()) {
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

        this.x -= dock.x;
        this.y -= dock.y;
        this._padding = padding;

        // adjust padding
        let az = -padding;
        this.x += az / 2;
        this.width -= az * (1 + !vertical);
        this.y += az / 2;
        this.height -= az * (1 + vertical);

        if (panel_mode) {
          if (vertical) {
            this.y = dock.y;
            this.height = dock.height;
          } else {
            this.x = dock.x;
            this.width = dock.width;
          }
        }

        this.opacity = 255;
        dock.dash.opacity = this.opacity;

        let style = [dock.extension._backgroundStyle];
        let blur = !(
          (Main.overview.visible || dock.extension._inOverview) &&
          dock.extension.disable_blur_at_overview
        );
        if (dock.extension.blur_background && blur) {
          style.push(
            // `background-image: url("${dock.extension.desktop_background}");`
            `background-image: url("${dock.extension.desktop_background_blurred}");`,
          );
          style.push(
            `background-size: ${dock._monitor.width}px ${dock._monitor.height}px;`,
          );
          switch (dock._position) {
            case DockPosition.LEFT: {
              style.push(`background-position: -${this.x}px -${this.y}px;`);
              break;
            }
            case DockPosition.RIGHT: {
              style.push(
                `background-position: -${dock._monitor.width - this.width}px -${
                  this.y
                }px;`,
              );
              break;
            }
            case DockPosition.TOP: {
              style.push(`background-position: -${this.x}px -${this.y}px;`);
              break;
            }
            default: {
              // bottom
              style.push(
                `background-position: -${this.x}px -${
                  dock._monitor.height - this.height
                }px;`,
              );
              break;
            }
          }
        } else {
          let rgba = dock.extension._style.rgba(
            dock.extension.background_color,
          );
          style.push(`background: rgba(${rgba});`);
        }

        this.style = style.join(' ');
      }
    }
  },
);
