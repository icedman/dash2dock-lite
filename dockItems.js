'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import { trySpawnCommandLine } from './utils.js';

// import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
  DashIcon,
  DashItemContainer,
} from 'resource:///org/gnome/shell/ui/dash.js';

import { DockPosition } from './dock.js';
import * as Compat from './compat.js';

class DockItemMenu extends PopupMenu.PopupMenu {
  constructor(sourceActor, side = St.Side.TOP, params = {}) {
    if (Clutter.get_default_text_direction() === Clutter.TextDirection.RTL) {
      if (side === St.Side.LEFT) side = St.Side.RIGHT;
      else if (side === St.Side.RIGHT) side = St.Side.LEFT;
    }

    super(sourceActor, 0.5, side);

    let { desktopApp } = params;
    this.item = params.item || sourceActor;
    this._confirmDialog = null;
    if (!desktopApp) return;

    this.desktopApp = desktopApp;

    this._newWindowItem = this.addAction('Open Window', () => {
      let workspaceManager = global.workspace_manager;
      let workspace = workspaceManager.get_active_workspace();
      let ctx = global.create_app_launch_context(0, workspace);
      desktopApp.launch([], ctx);
      this._onActivate();
    });

    if (desktopApp.list_actions) {
      desktopApp.list_actions().forEach((action) => {
        let name = desktopApp.get_action_name(action);
        this.addAction(name, () => {
          if (action === 'trash' || name === 'Empty Trash') {
            this._confirmEmptyTrash(desktopApp, action);
            return;
          }
          let workspaceManager = global.workspace_manager;
          let workspace = workspaceManager.get_active_workspace();
          let ctx = global.create_app_launch_context(0, workspace);
          desktopApp.launch_action(action, ctx);
          this.item?.dock?.extension?.animate?.({ refresh: true });
        });
      });
    }
  }

  _confirmEmptyTrash(desktopApp, action) {
    if (this._confirmDialog) {
      this._confirmDialog.open();
      return;
    }

    const dialog = new ModalDialog.ModalDialog();
    this._confirmDialog = dialog;

    const content = new Dialog.MessageDialogContent({
      title: 'Empty Trash?',
      description: 'All items in the Trash will be permanently deleted.',
    });
    dialog.contentLayout.add_child(content);

    dialog.addButton({
      label: 'Cancel',
      action: () => {
        dialog.close();
      },
      key: Clutter.KEY_Escape,
    });

    const emptyButton = dialog.addButton({
      label: 'Empty Trash',
      action: () => {
        dialog.close();
        const services = this.item?.dock?.extension?.services;
        if (services?.emptyTrash) {
          services.emptyTrash();
        } else {
          let workspaceManager = global.workspace_manager;
          let workspace = workspaceManager.get_active_workspace();
          let ctx = global.create_app_launch_context(0, workspace);
          desktopApp.launch_action(action, ctx);
          this.item?.dock?.extension?.animate?.({ refresh: true });
        }
      },
      default: true,
    });
    emptyButton?.add_style_class_name('destructive-action');

    const cleanUp = () => {
      if (this._confirmDialog === dialog) {
        this._confirmDialog = null;
      }
    };
    dialog.connect('closed', cleanUp);
    dialog.connect('destroy', cleanUp);

    dialog.open();
  }

  _onActivate() {}

  popup() {
    Compat.openPopupMenu(this, BoxPointer.PopupAnimation.FULL);
    this._menuManager.ignoreRelease();
  }

  destroy() {
    if (this._confirmDialog) {
      const dialog = this._confirmDialog;
      this._confirmDialog = null;
      dialog.close();
      dialog.destroy();
    }
    super.destroy();
  }
}

const DockItemOverlay = GObject.registerClass(
  {},
  class DockItemOverlay extends St.Widget {
    _init(renderer, params) {
      super._init({
        name: params?.name || 'd2daItemOverlay',
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
    _init(renderer, params = {}) {
      super._init(renderer, {
        name: 'd2daDotsOverlay',
        ...params,
      });
    }

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

      let offsetX = 0;
      let offsetY = renderer.height * 0.125 * scale;
      if (vertical) {
        offsetX = -offsetY;
        if (position == DockPosition.RIGHT) {
          offsetX = offsetY;
        }
        offsetY = 0;
      } else {
        if (position == DockPosition.TOP) {
          offsetY = -offsetY;
        }
      }

      // renderer.translationX = icon._icon.translationX + offsetX;
      // renderer.translationY = icon._icon.translationY + offsetY;

      renderer.translationX = offsetX;
      renderer.translationY = offsetY;

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
  }
);

export const DockItemBadgeOverlay = GObject.registerClass(
  {},
  class DockItemBadgeOverlay extends DockItemOverlay {
    _init(renderer, params = {}) {
      super._init(renderer, {
        name: 'd2daBadgeOverlay',
        ...params,
      });
    }

    update(icon, data) {
      let renderer = this.renderer;
      let { noticesCount, position, vertical, extension, dock } = data;

      let baseIconSize = dock._iconSizeScaledDown || icon._icon.width;
      renderer.width = baseIconSize;
      renderer.height = baseIconSize;
      renderer.pivot_point = icon._icon.pivot_point;

      let canvasScale = renderer.width / renderer._canvas.width;
      let scale = dock._monitor.geometry_scale || 1;
      canvasScale *= scale;
      renderer._canvas.set_scale(canvasScale, canvasScale);

      let options = extension.notification_badge_style_options;
      let notification_badge_style =
        options[extension.notification_badge_style];
      let notification_badge_color = extension.notification_badge_color;

      // Dot canvas draws dots near the bottom (y = size - height, or +0.42*height from center).
      // translate: [0.35, -0.85] shifts it from bottom to top-right corner in canvas coordinates.
      renderer.translationX = 0;
      renderer.translationY = 0;

      renderer.set_state({
        count: noticesCount,
        color: notification_badge_color || [1, 1, 1, 1],
        style: notification_badge_style || 'default',
        size: extension.notification_badge_size || 0,
        translate: [0.35, -0.85],
      });
    }
  }
);

export const DockIcon = GObject.registerClass(
  {},
  class DockIcon extends DashIcon {
    _init(app) {
      super._init(app);
      this._dot.visible = false;

      if (this._draggable) {
        this._draggable.inhibit = true;
        this._draggable._onButtonPress = () => {
          return Clutter.EVENT_STOP;
        };
        this._draggable._onTouchEvent = () => {
          return Clutter.EVENT_STOP;
        };
        this._draggable._grabActor = () => {};
      }
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        name: 'd2daDockIconActor',
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
            let now = Date.now();
            if (!container._lastClickTime || now - container._lastClickTime > 1000) {
              container._lastClickTime = now;
              if (container._onClick) {
                container._onClick();
              }
            }
          }
          return Clutter.EVENT_STOP;
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
      super._init({
        name: 'd2daItemContainer',
        style_class: 'dash-item-container',
        ...params,
        scale_x: 1,
        scale_y: 1,
      });

      this.custom_icon = true;

      const DesktopAppInfo = GioUnix?.DesktopAppInfo ?? Gio.DesktopAppInfo;

      let desktopApp = params.app;
      if (desktopApp) {
        // monkey patch dummy app
        if (!desktopApp.get_id) {
          desktopApp.get_id = () => null;
        }
        if (!desktopApp.get_name) {
          desktopApp.get_name = () => '';
        }
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
      } else if (params.appinfo_filename) {
        desktopApp = DesktopAppInfo.new_from_filename(params.appinfo_filename);
      }

      // for custom buttons 
      if (!desktopApp.can_open_new_window) {
        desktopApp.can_open_new_window = () => false;
        desktopApp.activate = (me) => {
          if (this._onClick) {
            // this._onClick();
          }
        };
      }

      let dashIcon = new DockIcon(desktopApp, {
        name: 'd2daDockIcon',
        style_class: 'dash-item-container',
        ...(params || {}),
      });
      if (params.id) {
        dashIcon._id = params.id;
      }
      this.set_scale(1, 1);
      this.setChild(dashIcon);

      try {
        this.setLabelText(desktopApp.get_name());
        let iconNames =
          desktopApp.get_icon()?.get_names?.() ||
          desktopApp.get_icon()?.names ||
          [];
        dashIcon._default_icon_name = iconNames[0] || 'file';
      } catch (err) {
        console.log(err);
        console.log(params);
      }

      // menu
      if (params.appinfo_filename || params.app) {
        this._menu = new DockItemMenu(this, St.Side.TOP, {
          desktopApp,
          item: this,
        });
        this._menu.item = this;
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu._menuManager = this._menuManager;
        Main.uiGroup.add_child(this._menu.actor);
        this._menuManager.addMenu(this._menu);
        Compat.closePopupMenu(this._menu, false);
        dashIcon._menu = this._menu;
        this.connect('destroy', () => this._destroyMenu());
      }
    }

    _destroyMenu() {
      let menu = this._menu;
      if (!menu) return;
      this._menu = null;
      // removeMenu pops the modal grab if this menu is the open one
      this._menuManager?.removeMenu(menu);
      this._menuManager = null;
      if (this.child?._menu === menu) this.child._menu = null;
      menu.destroy();
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
            this.y = 0;
            this.height = dock.height;
          } else {
            this.x = 0;
            this.width = dock.width;
          }
        }

        this.opacity = 255;
        dock.dash.opacity = this.opacity;
      }
    }
  }
);
