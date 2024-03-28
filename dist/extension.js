
const Main = imports.ui.main;
const BoxPointer = imports.ui.boxpointer;
const PopupMenu = imports.ui.popupMenu;
const Fav = imports.ui.appFavorites;
const IconGrid = imports.ui.iconGrid;
const Layout = imports.ui.layout;
const BaseIcon = IconGrid.BaseIcon;

const ExtensionUtils = imports.misc.extensionUtils;
// const Utils = imports.shell.util;
// const trySpawnCommandLine = Utils.trySpawnCommandLine;

const Dash = imports.ui.dash.Dash;
const ShowAppsIcon = imports.ui.dash.ShowAppsIcon;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Graphene = imports.gi.Graphene;
const St = imports.gi.St;
const PangoCairo = imports.gi.PangoCairo;
const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Cairo = imports.cairo;

const Point = Graphene.Point;

class Extension {}

function init() {
  return new Dash2DockLiteExt();
}


//-----------------------------
// ./dockItems.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
//import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
//import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';
//import { BaseIcon } from 'resource:///org/gnome/shell/ui/iconGrid.js';

//import Gio from 'gi://Gio';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Graphene from 'gi://Graphene';
//import St from 'gi://St';

//import { ShowAppsIcon } from 'resource:///org/gnome/shell/ui/dash.js';

//import { Dot } from './apps/dot.js';
//import { DockPosition } from './dock.js';

//const Point = Graphene.Point;

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

const DockItemDotsOverlay = GObject.registerClass(
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

const DockItemBadgeOverlay = GObject.registerClass(
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

const DockItemList = GObject.registerClass(
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
        // this.visible = false;
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

      this._target = target;
      let tp = dock._get_position(target);

      this._box = new St.Widget({ style_class: '-hi' });
      list.forEach((l) => {
        let w = new St.Widget({});
        let icon = new St.Icon({
          icon_name: l.icon,
          reactive: true,
          track_hover: true,
        });
        icon.set_icon_size(
          this.dock._iconSizeScaledDown * this.dock._scaleFactor
        );
        this._box.add_child(w);
        let label = new St.Label({ style_class: 'dash-label' });
        let short = (l.name ?? '').replace(/(.{32})..+/, '$1...');
        label.text = short;
        w.add_child(icon);
        w.add_child(label);
        w._icon = icon;
        w._label = label;

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
      });

      let ox = 0;
      let oy = 0;
      let angleInc = 2;
      let startAngle = 268;
      let angle = startAngle;
      let rad = dock._iconSize * 1.1 * dock._scaleFactor;

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

        ox += hX * 0.85;
        oy += hY;
        angle += angleInc;

        l.rotation_angle_z = angle - startAngle;
      });

      this.add_child(this._box);

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

      this._hidden = false;
      this._hiddenFrames = 0;
    }

    slideOut() {
      this._hidden = true;
      this._hiddenFrames = 80;
    }
  }
);

const DockItemContainer = GObject.registerClass(
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

      this._label = this.label;

      try {
        this._labelText = desktopApp.get_name();
        this._default_icon_name = desktopApp.get_icon().get_names()[0];
      } catch (err) {
        console.log(err);
        console.log(params);
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
    }

    activateNewWindow() {
      if (this._menu && this._menu._newWindowItem) {
        this._menu._newWindowItem.emit('activate', null);
      }
    }

    _onClick() {
      this.activateNewWindow();
    }

    _createIcon(size) {
      this._iconActor = new St.Icon({
        icon_name: this._default_icon_name,
        icon_size: size,
        style_class: 'show-apps-icon',
        track_hover: true,
      });

      // attach event
      let button = this.first_child;
      button.reactive = false;
      let icon = this._iconActor;

      icon.reactive = true;
      icon.track_hover = true;
      [icon].forEach((btn) => {
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

const DockBackground = GObject.registerClass(
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

      let padding =
        4 +
        iconSize *
          scaleFactor *
          0.15 *
          (dashContainer.extension.dock_padding || 0);

      if (!isNaN(p1[0]) && !isNaN(p1[1])) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = p1[0] + tx;
        this.y = first._fixedPosition[1];
        let width = dashContainer.dash.width + Math.abs(tx) + tx2 - padding;
        let height = dashContainer.dash.height;

        if (dashContainer.isVertical()) {
          this.x = first._fixedPosition[0];
          this.y = first._fixedPosition[1] + ty;
          width = dashContainer.dash.width;
          height = dashContainer.dash.height + Math.abs(ty) + ty2 - padding;
        }

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
      }
    }
  }
);

const DockPanelOverlay = GObject.registerClass(
  {},
  class DockPanelOverlay extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockOverlay',
        ...(params || {}),
      });
    }

    update(params) {
      let {
        background,
        left,
        right,
        center,
        panel_mode,
        vertical,
        dashContainer,
        combine_top_bar,
      } = params;

      if (!combine_top_bar || !panel_mode || vertical) {
        if (this.visible) {
          dashContainer.restorePanel();
        }
        this.visible = false;
        return;
      }

      this.visible = true;
      dashContainer.panel.visible = false;

      // this.style = 'border: 2px solid red;';
      this.x = background.x;
      this.y = background.y;
      this.width = background.width;
      this.height = background.height;

      let margin = 20;

      // left
      if (left.get_parent() != this) {
        left.get_parent().remove_child(left);
        this.add_child(left);
      }
      left.x = margin;
      left.y = this.height / 2 - left.height / 2;

      // center
      if (center.get_parent() != this) {
        center.get_parent().remove_child(center);
        this.add_child(center);
      }
      center.x = this.width - margin / 2 - center.width;
      center.y = this.height / 2 - center.height / 2;

      // right
      if (right.get_parent() != this) {
        right.get_parent().remove_child(right);
        this.add_child(right);
      }
      right.height = center.height;
      right.x = this.width - margin - right.width;
      right.y = this.height / 2 - right.height / 2;

      // align
      if (center.height * 3 < this.height) {
        right.y -= right.height / 1.5;
        center.y += center.height / 1.5;
      } else {
        right.x -= center.width;
      }
    }
  }
);


//-----------------------------
// ./autohide.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import Meta from 'gi://Meta';
//import Shell from 'gi://Shell';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Graphene from 'gi://Graphene';
//import St from 'gi://St';

//import { DockPosition } from './dock.js';

//const Point = Graphene.Point;

const HIDE_ANIMATION_INTERVAL = 15;
const HIDE_ANIMATION_INTERVAL_PAD = 15;
const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 40;

// some codes lifted from dash-to-dock intellihide
const handledWindowTypes = [
  Meta.WindowType.NORMAL,
  // Meta.WindowType.DOCK,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  // Meta.WindowType.TOOLBAR,
  // Meta.WindowType.MENU,
  Meta.WindowType.UTILITY,
  // Meta.WindowType.SPLASHSCREEN
];

let AutoHide = class {
  enable() {
    if (this._enabled) return;
    // console.log('enable autohide');
    this._enabled = true;
    this._shown = true;
    this._dwell = 0;
    console.log('autohide enabled');
  }

  disable() {
    if (!this._enabled) return;
    if (this.extension._hiTimer) {
      this.extension._hiTimer.cancel(this._animationSeq);
    }

    this.show();

    this._enabled = false;

    let actors = global.get_window_actors();
    let windows = actors.map((a) => a.get_meta_window());
    windows.forEach((w) => {
      if (w._tracked) {
        this._untrack(w);
      }
    });

    console.log('autohide disabled');
  }

  _getScaleFactor() {
    let scaleFactor = this.dashContainer._monitor.geometry_scale;
    return scaleFactor;
  }

  _onMotionEvent() {
    if (this.extension.pressure_sense && !this._shown) {
      let monitor = this.dashContainer._monitor;
      let pointer = global.get_pointer();
      if (this.extension.simulated_pointer) {
        pointer = [...this.extension.simulated_pointer];
      }

      let sw = monitor.width;
      let sh = monitor.height;
      let scale = this._getScaleFactor();
      let area = scale * (PRESSURE_SENSE_DISTANCE * PRESSURE_SENSE_DISTANCE);
      let dx = 0;
      let dy = 0;

      if (this.last_pointer) {
        dx = pointer[0] - this.last_pointer[0];
        dx = dx * dx;
        dy = pointer[1] - this.last_pointer[1];
        dy = dy * dy;
      }

      let dwell_count =
        80 - 60 * (this.extension.pressure_sense_sensitivity || 0);

      if (this.dashContainer.isVertical()) {
        if (
          // right
          (this.dashContainer._position == DockPosition.RIGHT &&
            dy < area &&
            pointer[0] > monitor.x + sw - 4) ||
          // left
          (this.dashContainer._position == DockPosition.LEFT &&
            dy < area &&
            pointer[0] < monitor.x + 4)
        ) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      } else {
        // bottom
        if (dx < area && pointer[1] + 4 > monitor.y + sh) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      }

      // console.log(`${this._dwell} ${dwell_count} ${this.extension.pressure_sense_sensitivity}`);

      if (this._dwell > dwell_count) {
        this.show();
      }
    }
  }

  _onEnterEvent() {
    if (!this.extension.pressure_sense) {
      this.show();
    }
  }

  _onLeaveEvent() {
    if (this._shown) {
      this._dwell = 0;
      this._debounceCheckHide();
    }
  }

  _onFocusWindow() {
    this._debounceCheckHide();
  }

  _onFullScreen() {
    this._debounceCheckHide();
  }

  show() {
    this._dwell = 0;
    this.frameDelay = 0;
    this._shown = true;
    this.dashContainer.slideIn();
  }

  hide() {
    this._dwell = 0;
    this.frameDelay = 10;
    this._shown = false;
    this.dashContainer.slideOut();
  }

  _track(window) {
    if (!window._tracked) {
      // log('tracking...');
      window.connectObject(
        'position-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dashContainer.extension.checkHide();
        },
        'size-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dashContainer.extension.checkHide();
        },
        this
      );
      window._tracked = true;
    }
  }

  _untrack(window) {
    try {
      if (window && window._tracked) {
        window.disconnectObject(this);
        window._tracked = false;
      }
    } catch (err) {
      // may have been destroyed already
    }
  }

  _checkOverlap() {
    if (this.extension._inOverview) {
      return false;
    }
    let pointer = global.get_pointer();
    if (this.extension.simulated_pointer) {
      pointer = [...this.extension.simulated_pointer];
    }

    // inaccurate
    let pos = this.dashContainer._get_position(this.dashContainer.struts);
    let rect = {
      x: pos[0],
      y: pos[1],
      w: this.dashContainer.struts.width,
      h: this.dashContainer.struts.height,
    };
    let arect = [rect.x, rect.y, rect.w, rect.h];
    let dash_position = [this.dashContainer.x, this.dashContainer.y];

    if (!this.extension.autohide_dash) {
      return false;
    }

    // within the dash
    if (
      this.dashContainer._isWithinDash(pointer) ||
      this.dashContainer._isInRect(arect, pointer)
    ) {
      return false;
    }

    if (!this.extension.autohide_dodge) {
      return true;
    }

    let monitor = this.dashContainer._monitor;
    let actors = global.get_window_actors();
    let windows = actors.map((a) => {
      let w = a.get_meta_window();
      w._parent = a;
      return w;
    });
    windows = windows.filter((w) => w.can_close());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    let workspace = global.workspace_manager.get_active_workspace_index();
    windows = windows.filter(
      (w) =>
        workspace == w.get_workspace().index() && w.showing_on_its_workspace()
    );
    windows = windows.filter((w) => w.get_window_type() in handledWindowTypes);

    let isOverlapped = false;
    let dock = this.dashContainer._get_position(this.dashContainer.struts);
    dock.push(this.dashContainer.struts.width);
    dock.push(this.dashContainer.struts.height);

    windows.forEach((w) => {
      this._track(w);
      if (isOverlapped) return;

      let frame = w.get_frame_rect();
      let win = [frame.x, frame.y, frame.width, frame.height];

      if (this.dashContainer._isOverlapRect(dock, win)) {
        isOverlapped = true;
      }
    });

    this.windows = windows;
    return isOverlapped;
  }

  _debounceCheckHide() {
    if (this.extension._loTimer) {
      if (!this._debounceCheckSeq) {
        this._debounceCheckSeq = this.extension._loTimer.runDebounced(
          () => {
            this._checkHide();
          },
          DEBOUNCE_HIDE_TIMEOUT,
          'debounceCheckHide'
        );
      } else {
        this.extension._loTimer.runDebounced(this._debounceCheckSeq);
      }
    }
  }

  _checkHide() {
    if (this._enabled) {
      if (this._checkOverlap()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }
};


//-----------------------------
// ./animator.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import Graphene from 'gi://Graphene';
//const Point = Graphene.Point;

//import { Dot } from './apps/dot.js';
//import { DockPosition } from './dock.js';

//import {
//  DockItemDotsOverlay,
//  DockItemBadgeOverlay,
//  DockItemContainer,
//  DockBackground,
//} from './dockItems.js';

//import { Bounce, Linear } from './effects/easing.js';

const ANIM_POS_COEF = 0.5;
const ANIM_SCALE_COEF = 1.5 * 2;
const ANIM_SPREAD_COEF = 1.25 * 1;
const ANIM_ON_LEAVE_COEF = 2.0;
const ANIM_ICON_RAISE = 0.6;
const ANIM_ICON_SCALE = 1.5;
const ANIM_ICON_HIT_AREA = 2.5;

const DOT_CANVAS_SIZE = 96;

let Animator = class {
  enable() {}

  disable() {}

  animate() {
    let dock = this.dashContainer;

    let simulation = false;
    // this._hidden = true;

    dock.layout();

    let m = dock.getMonitor();
    let pointer = global.get_pointer();
    if (dock.extension.simulated_pointer) {
      pointer = [...dock.extension.simulated_pointer];
      simulation = true;
    }
    if (dock.simulated_pointer) {
      pointer = [...dock.simulated_pointer];
      simulation = true;
    }

    let vertical = dock.isVertical();

    let [px, py] = pointer;

    let p = new Point();
    p.x = 0.5;
    p.y = 0.5;

    let isWithin = dock._isWithinDash([px, py]);
    let animated = isWithin;
    dock.animated = animated;

    let animateIcons = dock._icons;
    let iconSize = dock._iconSizeScaledDown;
    let scaleFactor = dock._scaleFactor;

    let nearestIdx = -1;
    let nearestIcon = null;
    let nearestDistance = -1;

    let idx = 0;
    animateIcons.forEach((icon) => {
      let pos = dock._get_position(icon);
      icon._pos = [...pos];
      icon._fixedPosition = [...pos];

      // moved to findIcons
      // icon._icon.set_icon_size(iconSize * dock.extension.icon_quality);

      // get nearest
      let bposcenter = [...pos];
      bposcenter[0] += (iconSize * scaleFactor) / 2;
      bposcenter[1] += (iconSize * scaleFactor) / 2;
      let dst = dock._get_distance(pointer, bposcenter);

      if (
        isWithin &&
        (nearestDistance == -1 || nearestDistance > dst) &&
        dst < iconSize * ANIM_ICON_HIT_AREA * scaleFactor
      ) {
        nearestDistance = dst;
        nearestIcon = icon;
        nearestIdx = idx;
        icon._distance = dst;
      }

      icon._target = pos;
      icon._targetScale = 1;

      idx++;
    });

    let noAnimation = !dock.extension.animate_icons_unmute;
    if ((!simulation && !isWithin) || noAnimation) {
      nearestIcon = null;
    }

    dock._nearestIcon = nearestIcon;

    let didScale = false;

    //------------------------
    // animation behavior
    //------------------------
    let edge_distance = dock._edge_distance;
    let rise = dock.extension.animation_rise * ANIM_ICON_RAISE;
    let magnify = dock.extension.animation_magnify * ANIM_ICON_SCALE;
    let spread = dock.extension.animation_spread;
    if (spread < 0.2) {
      magnify *= 0.8;
    }
    if (magnify > 0.5 && spread < 0.55) {
      spread = 0.55 + spread * 0.2;
    }

    let padding = 10;
    let threshold = (iconSize + padding) * 2.5 * scaleFactor;

    if (animated && edge_distance < 0) {
      edge_distance = 0;
    }

    // animate
    let iconTable = [];
    animateIcons.forEach((icon) => {
      let original_pos = dock._get_position(icon);

      // used by background resizing and repositioning
      icon._fixedPosition = [...original_pos];

      original_pos[0] += icon.width / 2;
      original_pos[1] += icon.height / 2;

      icon._pos = [...original_pos];
      icon._translate = 0;
      icon._translateRise = 0;

      iconTable.push(icon);

      let scale = 1;
      let dx = original_pos[0] - px;
      if (vertical) {
        dx = original_pos[1] - py;
      }
      if (dx * dx < threshold * threshold && nearestIcon) {
        let adx = Math.abs(dx);
        let p = 1.0 - adx / threshold;
        let fp = p * 0.6 * (1 + magnify);
        icon._p = p;

        // affect scale;
        if (magnify != 0) {
          scale += fp;
        }

        // affect rise
        let sz = iconSize * fp * scaleFactor;
        icon._translateRise = sz * 0.1 * rise;

        didScale = true;
      }

      icon._scale = scale;
      icon._targetScale = scale * scaleFactor;
      icon._icon.set_size(iconSize, iconSize);
      // icon._icon.set_icon_size(iconSize * dock.extension.icon_quality);

      if (!icon._pos) {
        return;
      }

      icon.opacity = icon == dock._dragged && dock._dragging ? 50 : 255;
      icon._prevTranslate = icon._translate;
    });

    // spread
    let hoveredIcon = null;
    for (let i = 0; i < iconTable.length; i++) {
      if (iconTable.length < 2) break;
      let icon = iconTable[i];
      if (icon._icon && icon._icon.hover) {
        hoveredIcon = icon;
      }
      if (icon._scale > 1.1) {
        // affect spread
        let offset =
          1.25 * (icon._scale - 1) * iconSize * scaleFactor * spread * 0.8;
        let o = offset;
        // left
        for (let j = i - 1; j >= 0; j--) {
          let left = iconTable[j];
          left._translate -= offset;
          o *= 0.98;
        }
        // right
        o = offset;
        for (let j = i + 1; j < iconTable.length; j++) {
          let right = iconTable[j];
          right._translate += offset;
          o *= 0.98;
        }
      }
    }

    dock._hoveredIcon = hoveredIcon;

    // re-center to hovered icon
    let TRANSLATE_COEF = 24;
    if (hoveredIcon) {
      hoveredIcon._targetScale += 0.1;
      let adjust = hoveredIcon._translate / 2;
      animateIcons.forEach((icon) => {
        if (icon._scale > 1) {
          let o = -adjust * (2 - icon._scale);
          let nt = icon._translate - o;
          icon._translate =
            (icon._translate * TRANSLATE_COEF + nt) / (TRANSLATE_COEF + 1);
        }
      });
    }

    //-------------------
    // interpolation / animation
    //-------------------
    let _scale_coef = ANIM_SCALE_COEF;
    // let _spread_coef = ANIM_SPREAD_COEF;
    let _pos_coef = ANIM_POS_COEF;
    if (dock.extension.animation_fps > 0) {
      _pos_coef /= 1 + dock.extension.animation_fps / 2;
      _scale_coef /= 1 + dock.extension.animation_fps / 2;
      // _spread_coef /= 1 + dock.extension.animation_fps / 2;
    }
    if (!nearestIcon) {
      _scale_coef *= ANIM_ON_LEAVE_COEF;
      _pos_coef *= ANIM_ON_LEAVE_COEF;
      // _spread_coef *= ANIM_ON_LEAVE_COEF;
    }

    // low frame rate
    if (dock.extension.animation_fps == 2) {
      _pos_coef *= 4;
      _scale_coef *= 4;
    }

    let first = animateIcons[0];
    let last = animateIcons[animateIcons.length - 1];

    animateIcons.forEach((icon) => {
      let scale = icon._icon.get_scale();

      let newScale =
        (icon._targetScale + scale[0] * _scale_coef) / (_scale_coef + 1);
      icon._scale = newScale;

      let flags = {
        bottom: { x: 0.5, y: 1, lx: 0, ly: 0.5 * newScale },
        top: { x: 0.5, y: 0, lx: 0, ly: -1.75 * newScale },
        left: { x: 0, y: 0.5, lx: -1.25 * newScale, ly: -1.25 },
        right: { x: 1, y: 0.5, lx: 1.5 * newScale, ly: -1.25 },
      };
      let pvd = flags[dock._position];

      let pv = new Point();
      pv.x = pvd.x;
      pv.y = pvd.y;
      icon._icon.pivot_point = pv;
      icon._icon.set_scale(newScale, newScale);

      let rdir =
        dock._position == DockPosition.TOP ||
        dock._position == DockPosition.LEFT
          ? 1
          : -1;

      let oldX = icon._icon.translationX;
      let oldY = icon._icon.translationY;
      let translationX =
        vertical * icon._translateRise * rdir +
        (oldX + icon._translate * !vertical * _pos_coef) / (_pos_coef + 1);
      let translationY =
        !vertical * icon._translateRise * rdir +
        (oldY + icon._translate * vertical * _pos_coef) / (_pos_coef + 1);

      icon._icon.translationX = Math.floor(translationX);
      icon._icon.translationY = Math.floor(translationY);

      // jitter reduction hack
      if (dock.extension._enableJitterHack && icon._scale < 1.05 && isWithin) {
        let size = 32;
        icon._translation = icon._translation || [];
        let currentTranslation = icon._icon.translationX;
        if (!vertical) {
          icon._translation.push(icon._icon.translationX);
        } else {
          currentTranslation = icon._icon.translationY;
          icon._translation.push(icon._icon.translationY);
        }
        if (icon._translation.length > size / 2) {
          icon._translation.shift();
          // todo ... what the cpu usage :)
          let sum = icon._translation.reduce((accumulator, currentValue) => {
            return accumulator + currentValue;
          }, 0);
          let avg = Math.floor(sum / icon._translation.length);
          let diff = Math.abs(currentTranslation - avg);
          if (diff <= 2) {
            if (!vertical) {
              icon._icon.translationX = avg;
            } else {
              icon._icon.translationY = avg;
            }
          }
        }
      }

      // todo center the appwell (scaling correction)
      let child = icon._appwell || icon.first_child;
      if (child && scaleFactor > 1) {
        let correction = icon._icon.height * scaleFactor - icon._icon.height;
        if (!icon._appwell) {
          child.x = correction;
        }
        child.y = correction;
      }

      // labels
      if (icon._label) {
        icon._label.translationX = translationX - iconSize * pvd.lx;
        icon._label.translationY = translationY - iconSize * pvd.ly;
      }

      // badges
      {
        let appNotices = icon._appwell
          ? dock.extension.services._appNotices[icon._appwell.app.get_id()]
          : null;
        let noticesCount = 0;
        if (appNotices) {
          noticesCount = appNotices.count;
        }
        // noticesCount = 1;
        let target = icon._dot?.get_parent();
        let badge = target?._badge;

        if (!badge && icon._appwell && target) {
          badge = new DockItemBadgeOverlay(new Dot(DOT_CANVAS_SIZE));
          target._badge = badge;
          target.add_child(badge);
        }
        if (badge && noticesCount > 0) {
          badge.update(icon, {
            noticesCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
          });
          badge.show();
        } else {
          badge?.hide();
        }
      }

      // dots
      {
        let appCount = icon._appwell ? icon._appwell.app.get_n_windows() : 0;
        // appCount = 1;
        let target = icon._dot?.get_parent();
        let dots = target?._dots;
        if (!dots && icon._appwell && target) {
          dots = new DockItemDotsOverlay(new Dot(DOT_CANVAS_SIZE));
          target._dots = dots;
          target.add_child(dots);
        }
        if (dots && appCount > 0) {
          dots.update(icon, {
            appCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
          });
          dots.show();
        } else {
          dots?.hide();
        }
      }

      // custom icons
      if (dock.extension.services) {
        dock.extension.services.updateIcon(icon, {
          scaleFactor,
          iconSize,
          dock,
        });
      }
    });

    // separators
    dock._separators.forEach((actor) => {
      let prev = actor.get_previous_sibling() || actor._prev;
      let next = actor.get_next_sibling();
      if (prev && next && prev._icon && next._icon) {
        actor.translationX =
          (prev._icon.translationX + next._icon.translationX) / 2;
        actor.translationY =
          (prev._icon.translationY + next._icon.translationY) / 2;
        let thickness = dock.extension.separator_thickness || 0;
        actor.width = !vertical ? thickness : iconSize * 0.5 * scaleFactor;
        actor.height = vertical ? thickness : iconSize * 0.75 * scaleFactor;
        actor.visible = thickness > 0;
      }
    });

    let targetX = 0;
    let targetY = 0;
    if (dock._hidden && dock.extension.autohide_dash) {
      if (isWithin) {
        dock.slideIn();
      }
    }

    let ed =
      dock._position == DockPosition.BOTTOM ||
      dock._position == DockPosition.RIGHT
        ? 1
        : -1;

    // if (!animated && !dock._hidden && dock.extension.peek_hidden_icons) {
    //   edge_distance = -dock._iconSizeScaledDown * scaleFactor / 1.5;
    // }

    // dash hide/show
    if (dock._hidden) {
      if (vertical) {
        if (dock._position == DockPosition.LEFT) {
          targetX =
            -(dock._background.width + edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetX =
            (dock._background.width - edge_distance * -ed * 2) * scaleFactor;
        }
      } else {
        if (dock._position == DockPosition.BOTTOM) {
          targetY =
            (dock._background.height - edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetY =
            -(dock._background.height + edge_distance * -ed * 2) * scaleFactor;
        }
      }
    }

    // edge
    targetX += vertical ? edge_distance * -ed : 0;
    targetY += !vertical ? edge_distance * -ed : 0;

    _pos_coef += 5 - 5 * dock.extension.autohide_speed;
    dock.dash.translationY =
      (dock.dash.translationY * _pos_coef + targetY) / (_pos_coef + 1);
    dock.dash.translationX =
      (dock.dash.translationX * _pos_coef + targetX) / (_pos_coef + 1);

    // background
    {
      dock._background.style = dock.extension._backgroundStyle;
      dock._background.update({
        first,
        last,
        iconSize,
        scaleFactor,
        position: dock._position,
        vertical: vertical,
        panel_mode: dock.extension.panel_mode,
        dashContainer: dock,
      });

      // allied areas
      if (vertical) {
        dock.struts.width =
          dock._background.width +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;
        dock.struts.height = dock.height;
        dock.struts.y = dock.y;
        if (dock._position == DockPosition.RIGHT) {
          dock.struts.x = dock.x + dock.width - dock.struts.width;
        } else {
          dock.struts.x = dock.x;
        }
      } else {
        dock.struts.width = dock.width;
        dock.struts.height =
          dock._background.height +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;
        dock.struts.x = dock.x;
        if (dock._position == DockPosition.BOTTOM) {
          dock.struts.y = dock.y + dock.height - dock.struts.height;
        } else {
          dock.struts.y = dock.y;
        }
      }

      let dwellHeight = 4;
      if (vertical) {
        dock.dwell.width = dwellHeight;
        dock.dwell.height = dock.height;
        dock.dwell.x = m.x;
        dock.dwell.y = dock.y;
        if (dock._position == DockPosition.RIGHT) {
          dock.dwell.x = m.x + m.width - dwellHeight;
        }
      } else {
        dock.dwell.width = dock.width;
        dock.dwell.height = dwellHeight;
        dock.dwell.x = dock.x;
        dock.dwell.y = dock.y + dock.height - dock.dwell.height;
        if (dock._position == DockPosition.TOP) {
          dock.dwell.y = dock.y;
        }
      }
    }

    dock.dash.opacity = 255;

    //---------------------
    // animate the list
    //---------------------
    if (dock._list && dock._list.visible && dock._list._target) {
      let list = dock._list;
      list.opacity = 255;

      let target = list._target;
      let list_coef = 2;

      let tw = target.width * target._icon.scaleX;
      let th = target.height * target._icon.scaleY;

      list._box?.get_children().forEach((c) => {
        c.translationX = target._icon.translationX + tw / 8;
        c.translationY =
          -target._icon.scaleX * target._icon.height + target._icon.height;
        c._label.translationX = -c._label.width;

        let tx = c._x;
        let ty = c._y;
        let tz = c._rotation_angle_z;
        let to = 255;
        if (list._hidden) {
          tx = c._ox;
          ty = c._oy;
          tz = c._oz;
          to = 0;
          if (list._hiddenFrames-- == 0) {
            list.visible = false;
            list._hidden = false;
          }
        }

        let list_coef_x = list_coef + 4;
        let list_coef_z = list_coef + 6;
        c._label.opacity =
          (c._label.opacity * list_coef + to) / (list_coef + 1);
        c.x = (c.x * list_coef_x + tx) / (list_coef_x + 1);
        c.y = (c.y * list_coef + ty) / (list_coef + 1);
        c.rotation_angle_z =
          (c.rotation_angle_z * list_coef_z + tz) / (list_coef_z + 1);
      });

      target._label.hide();
      didScale = true;
    }

    if (didScale) {
      dock.autohider._debounceCheckHide();
      dock._debounceEndAnimation();
    }
  }

  bounceIcon(appwell) {
    let dock = this.dashContainer;

    let scaleFactor = dock.getMonitor().geometry_scale;
    let travel =
      (dock._iconSize / 3) * ((0.25 + dock.extension.animation_bounce) * 1.5);
    // * scaleFactor;
    appwell.translation_y = 0;

    let icon = appwell.get_parent()._icon;

    let t = 250;
    let _frames = [
      {
        _duration: t,
        _func: (f, s) => {
          let res = Linear.easeNone(f._time, 0, travel, f._duration);
          if (dock.isVertical()) {
            appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
            if (icon._badge) {
              icon._badge.translation_x = appwell.translation_x;
            }
          } else {
            // appwell.translation_y = -res;
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
          }
        },
      },
      {
        _duration: t * 3,
        _func: (f, s) => {
          let res = Bounce.easeOut(f._time, travel, -travel, f._duration);
          if (dock.isVertical()) {
            appwell.translation_x = appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
          } else {
            // appwell.translation_y = -res;
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
          }
        },
      },
    ];

    let frames = [];
    for (let i = 0; i < 3; i++) {
      _frames.forEach((b) => {
        frames.push({
          ...b,
        });
      });
    }

    dock.extension._hiTimer.runAnimation([
      ...frames,
      {
        _duration: 10,
        _func: (f, s) => {
          appwell.translation_y = 0;
        },
      },
    ]);
  }
};


//-----------------------------
// ./timer.js
//-----------------------------

//'use strict';

//import GLib from 'gi://GLib';

const Timer = class {
  constructor(name) {
    this._name = name;
    this._subscribers = [];
    this._subscriberId = 0xff;
  }

  initialize(resolution) {
    this._resolution = resolution || 1000;
    this._autoStart = true;
    this._autoHibernate = true;

    this._hibernating = false;
    this._hibernatCounter = 0;
    this._hibernateWait = 250 + this._resolution * 2;
  }

  shutdown() {
    this._autoStart = false;
    this._hibernating = false;
    this.stop();
  }

  start(resolution) {
    if (this.is_running()) {
      // print('already running');
      return;
    }
    this._resolution = resolution || 1000;
    this._time = 0;
    this._timeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this._resolution,
      this.onUpdate.bind(this)
    );
    this._hibernating = false;
    this.onStart();
  }

  stop() {
    if (!this.is_running()) {
      // print('already stopped');
      return;
    }
    GLib.source_remove(this._timeoutId);
    this._timeoutId = null;
    this.onStop();
  }

  restart(resolution) {
    this.stop();
    this.start(resolution || this._resolution || 1000);
  }

  pause() {
    if (!this.is_running()) {
      return;
    }
    this._paused = true;
    this.onPause();
  }

  resume() {
    if (!this.is_running()) {
      return;
    }
    this._paused = false;
    this.onResume();
  }

  hibernate() {
    if (!this.is_running()) {
      return;
    }

    this.stop();
    this._hibernating = true;
    this._hibernatCounter = 0;
  }

  is_running() {
    return this._timeoutId != null;
  }

  toggle_pause() {
    if (!this.is_running()) {
      return;
    }
    if (!this._paused) {
      this.pause();
    } else {
      this.resume();
    }
  }

  onStart() {
    // print(`started ${this._name} [${this.subscriberNames().join(',')}]`);
    this._subscribers.forEach((s) => {
      if (s.onStart) {
        s.onStart(s);
      }
    });
  }

  onStop() {
    this._subscribers.forEach((s) => {
      if (s.onStop) {
        s.onStop(s);
      }
    });
    // print(`stopped ${this._name}`);
  }

  onPause() {
    this._subscribers.forEach((s) => {
      if (s.onPause) {
        s.onPause(s);
      }
    });
  }

  onResume() {
    this._subscribers.forEach((s) => {
      if (s.onResume) {
        s.onResume(s);
      }
    });
  }

  onUpdate() {
    if (!this._timeoutId || this._paused) {
      return true;
    }

    this._subscribers.forEach((s) => {
      if (s.onUpdate) {
        s.onUpdate(s, this._resolution);
      }
    });

    this._time += this._resolution;

    if (this._autoHibernate) {
      if (!this._subscribers.length) {
        this._hibernatCounter += this._resolution;
        if (this._hibernatCounter >= this._hibernateWait) {
          this.hibernate();
        }
      } else {
        this._hibernatCounter = 0;
      }
    }

    // print(`${this._time/1000} subs:${this._subscribers.length}`);
    return true;
  }

  runningTime() {
    return this._time;
  }

  subscribe(obj) {
    if (!obj._id) {
      obj._id = this._subscriberId++;
    }
    let idx = this._subscribers.findIndex((s) => s._id == obj._id);
    if (idx == -1) {
      this._subscribers.push(obj);
    } else {
      this._subscribers[idx] = {
        ...this._subscribers[idx],
        ...obj,
      };
      obj = this._subscribers[idx];
    }

    if (
      (this._hibernating || this._autoStart) &&
      this._subscribers.length == 1
    ) {
      this.start(this._resolution);
    }

    // log(`subscribers: ${this.subscriberNames().join(',')}`);
    return obj;
  }

  unsubscribe(obj) {
    let idx = this._subscribers.findIndex((s) => s._id == obj._id);
    if (idx != -1) {
      if (this._subscribers.length == 1) {
        this._subscribers = [];
      } else {
        this._subscribers = [
          ...this._subscribers.slice(0, idx),
          ...this._subscribers.slice(idx + 1),
        ];
      }
    }
  }

  subscriberNames() {
    return this._subscribers.map((s) => {
      if (s._name) {
        return s._name;
      }
      return `${s._id}`;
    });
  }

  dumpSubscribers() {
    if (this._name) {
      print('--------');
      print(this._name);
    }
    this._subscribers.forEach((s) => {
      print('--------');
      Object.keys(s).forEach((k) => {
        print(`${k}: ${s[k]}`);
      });
    });
  }

  runLoop(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'loop',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          s._time -= s._delay;
        }
      },
    };
    return this.subscribe(obj);
  }

  runOnce(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'once',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          this.unsubscribe(s);
        }
      },
    };
    return this.subscribe(obj);
  }

  runDebounced(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'debounced',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          this.unsubscribe(s);
        }
      },
    };
    return this.subscribe(obj);
  }

  runSequence(array, settings) {
    if (typeof array === 'object' && !array.length) {
      array._time = 0;
      array._currentIdx = 0;
      return this.subscribe(array);
    }
    let obj = {
      _time: 0,
      _currentIdx: 0,
      _sequences: [...array],
      ...settings,
      onUpdate: (s, dt) => {
        let current = s._sequences[s._currentIdx];
        if (!current) {
          this.unsubscribe(s);
          return;
        }
        s._time += dt;
        if (s._time >= current.delay) {
          current.func(current);
          s._time = -current.delay;
          s._currentIdx++;
          if (s._currentIdx >= s._sequences.length && s._loop) {
            s._currentIdx = 0;
          }
        }
      },
    };
    return this.subscribe(obj);
  }

  runAnimation(array, settings) {
    if (typeof func === 'object' && !array.length) {
      func._time = 0;
      return this.subscribe(func);
    }

    let duration = 0;
    array.forEach((f) => {
      if (!f._start) {
        f._start = duration;
      }
      duration += f._duration;
    });

    let obj = {
      _time: 0,
      _duration: duration,
      _loop: false,
      _frames: [...array],
      ...(settings || {}),
      onUpdate: (s, dt) => {
        s._time += dt;

        let frames = [];
        if (s._frames) {
          frames = s._frames.filter((f) => {
            return f._start <= s._time && s._time < f._start + f._duration;
          });
        }
        s._currentFrames = frames;

        if (!s._func) {
          s._func = (s) => {
            s._currentFrames.forEach((f) => {
              f._time = s._time - f._start;
              f._func(f, s);
            });
          };
        }

        if (s._time > s._duration) {
          this.unsubscribe(s);
          s._time = s._duration;
          s._func(s);
          return;
        }
        s._func(s);
      },
    };
    return this.subscribe(obj);
  }

  cancel(obj) {
    if (obj) {
      this.unsubscribe(obj);
    }
  }
};


//-----------------------------
// ./diagnostics.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import Graphene from 'gi://Graphene';

//const Point = Graphene.Point;

//import { getPointer, warpPointer } from './utils.js';

var print = (msg) => {
  log(msg);
  if (Main.lookingGlass && Main.lookingGlass.isOpen) {
    Main.lookingGlass.close();
    // Main.lookingGlass._pushResult('d2dl', msg);
  }
};

function add_message(seqs, msg, delay) {
  seqs.push({
    func: () => print(msg),
    delay,
  });
}

function add_move_pointer(seqs, x, y, delay, ext) {
  seqs.push({
    x: x,
    y: y,
    func: (t) => {
      let p = getPointer();
      // print(`move ${t.x} ${t.y}`);
      warpPointer(p, t.x, t.y, ext);
    },
    delay,
  });

  seqs.push({
    x: x,
    y: y,
    func: (t) => {
      ext.simulated_pointer = null;
    },
    delay: 5,
  });
}

function add_slide_pointer(seqs, x, y, x2, y2, intervals, delay, ext) {
  let dd = delay / intervals;
  let dx = (x2 - x) / intervals;
  let dy = (y2 - y) / intervals;

  for (let i = 0; i < intervals; i++) {
    // print(`${x} ${dx} ${dy} ${dd}`);
    seqs.push({
      x: x,
      y: y,
      func: (t) => {
        let p = getPointer();
        // print(`warp ${t.x} ${t.y}`);
        warpPointer(p, t.x, t.y, ext);
      },
      delay: dd,
    });
    x += dx;
    y += dy;
  }

  seqs.push({
    x: x,
    y: y,
    func: (t) => {
      ext.simulated_pointer = null;
    },
    delay: 5,
  });
}

function add_test_values(seqs, extension, settings, name, value, values) {
  let k = settings.getKey(name);
  if (k.test && k.test.values) {
    values = k.test.values;
  }
  values.forEach((c) => {
    seqs.push({
      func: () => {
        settings.setValue(name, c);
      },
      delay: 1000,
    });

    if (k.test) {
      let x = extension.dock.position.x;
      let y = extension.dock.position.y;
      let w = extension.dock.width;
      let h = extension.dock.height;
      switch (k.test.pointer) {
        case 'slide-through':
          add_slide_pointer(
            seqs,
            x,
            y + h / 2,
            x + w,
            y + h / 2,
            20,
            1.0,
            extension
          );
          add_move_pointer(seqs, 0, 0, 0.5, extension);
          break;
      }
    }
  });

  seqs.push({
    func: () => {
      settings.setValue(name, value);
    },
    delay: 500,
  });
}

function add_boolean_test(seqs, extension, settings, name, value) {
  add_test_values(seqs, extension, settings, name, value, [true, false, true]);
}

function add_scale_test(seqs, extension, settings, name, value) {
  add_test_values(
    seqs,
    extension,
    settings,
    name,
    value,
    [0, 0.125, 0.25, 0.5, 0.75, 1]
  );
}

function add_color_test(seqs, extension, settings, name, value) {
  let colors = [
    [0, 0, 0, 0],
    [0, 0, 0, 0.5],
    [0, 0, 0, 1],
    [1, 1, 1, 0.5],
    [1, 1, 1, 1],
    [1, 0, 1, 0.5],
    [1, 0, 1, 1],
  ];
  add_test_values(seqs, extension, settings, name, value, colors);
}

function add_dropdown_test(seqs, extension, settings, name, value) {
  let values = [0, 1, 2, 3];
  add_test_values(seqs, extension, settings, name, value, values);
}

function addMotionTests(_seqs, extension, settings) {
  // let _seqs = [];

  let anim = settings.getValue('animate-icons');
  let hide = settings.getValue('autohide-dash');

  add_message(_seqs, 'begin motion tests', 0);
  _seqs.push({
    func: () => {
      settings.setValue('animate-icons', true);
      settings.setValue('autohide-dash', false);
    },
    delay: 500,
  });

  add_move_pointer(_seqs, 0, 0, 0.5, extension);

  // animation
  let x = extension.dock.position.x;
  let y = extension.dock.position.y;
  let w = extension.dock.width;
  let h = extension.dock.height;
  add_slide_pointer(_seqs, x, y + h / 2, x + w, y + h / 2, 40, 1.8, extension);
  add_slide_pointer(_seqs, x + w, y + h / 2, x, y + h / 2, 40, 1.8, extension);
  add_move_pointer(_seqs, 0, 0, 0.5, extension);

  // autohide

  _seqs.push({
    func: () => {
      settings.setValue('animate-icons', true);
      settings.setValue('autohide-dash', true);
    },
    delay: 1000,
  });

  // _seqs.push({
  //   func: () => {
  //     extension._autohiders().forEach((autohider) => {
  //       autohider.preview();
  //     });
  //   },
  //   delay: 500,
  // });
  add_move_pointer(_seqs, 0, 0, 1, extension);

  add_slide_pointer(_seqs, x, y + h / 2, x + w, y + h / 2, 40, 1.8, extension);
  add_slide_pointer(_seqs, x + w, y + h, x, y + h, 40, 1.8, extension);
  add_move_pointer(_seqs, 0, 0, 0.5, extension);

  // reset

  _seqs.push({
    func: () => {
      // extension._autohiders().forEach((autohider) => {
      //   autohider.preview(false);
      // });
      settings.setValue('animate-icons', anim);
      settings.setValue('autohide-dash', hide);
    },
    delay: 500,
  });

  // cleanup
  _seqs.push({
    func: () => {
      extension.simulated_pointer = null;
    },
    delay: 500,
  });

  add_message(_seqs, 'done', 0);

  // runSequence(_seqs);
}

function addPreferenceTests(_seqs, extension, settings) {
  add_message(_seqs, 'begin tests', 0);

  let keys = settings.keys();
  Object.keys(keys).forEach((name) => {
    let k = keys[name];
    k._value = k.value;

    add_message(_seqs, `${k.name} ${k.value}`, 0);
    switch (k.widget_type) {
      case 'switch':
        add_boolean_test(_seqs, extension, settings, k.name, k.value);
        break;
      case 'scale':
        add_scale_test(_seqs, extension, settings, k.name, k.value);
        break;
      case 'color':
        add_color_test(_seqs, extension, settings, k.name, k.value);
        break;
      case 'dropdown':
        add_dropdown_test(_seqs, extension, settings, k.name, k.value);
        break;
    }
  });

  add_message(_seqs, 'done', 0);
}

const runTests = (extension, settings) => {
  let _seqs = [];
  addMotionTests(_seqs, extension, settings);
  addPreferenceTests(_seqs, extension, settings);
  extension._diagnosticTimer.runSequence(_seqs);
};


//-----------------------------
// ./services.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

//import Gio from 'gi://Gio';
//import St from 'gi://St';
//import Graphene from 'gi://Graphene';

//const Point = Graphene.Point;

//import { Clock } from './apps/clock.js';
//import { Calendar } from './apps/calendar.js';

// sync with animator
const CANVAS_SIZE = 120;

class ServiceCounter {
  constructor(name, interval, callback, advance) {
    advance = advance || 0;
    this.name = name;
    this._interval = interval;
    this._ticks = advance == -1 ? interval : advance;
    this._callback = callback;
  }

  update(elapsed) {
    this._ticks += elapsed;
    if (this._ticks >= this._interval) {
      this._ticks -= this._interval;
      if (this._callback) {
        this._callback();
      }
      return true;
    }
    return false;
  }
}

const Services = class {
  enable() {
    this._mounts = {};
    this._services = [
      new ServiceCounter('trash', 1000 * 15, this.checkTrash.bind(this)),
      new ServiceCounter(
        'clock',
        1000 * 60, // every minute
        // 1000 * 1, // every second
        () => {
          this.extension.docks.forEach((d) => {
            d._onClock();
          });
        },
        -1
      ),
      new ServiceCounter(
        'calendar',
        1000 * 60 * 15,
        () => {
          this.extension.docks.forEach((d) => {
            d._onCalendar();
          });
        },
        -1
      ),
      new ServiceCounter(
        'ping',
        1000 * 5,
        () => {
          // deferred stuff is required when .desktop entry if first created
          // check for deferred mounts
          this._commitMounts();

          // notifications
          this.checkNotifications();
        },
        0
      ),
    ];

    this._disableNotifications = 0;

    this._deferredMounts = [];
    this._volumeMonitor = Gio.VolumeMonitor.get();
    this._volumeMonitor.connectObject(
      'mount-added',
      this._onMountAdded.bind(this),
      'mount-removed',
      this._onMountRemoved.bind(this),
      this
    );

    this._trashDir = Gio.File.new_for_uri('trash:///');
    this._trashMonitor = this._trashDir.monitor(
      Gio.FileMonitorFlags.WATCH_MOVES,
      null
    );
    this._trashMonitor.connectObject(
      'changed',
      (fileMonitor, file, otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.MOVED_IN:
            return;
        }
        this.checkTrash();
      },
      this
    );

    this._downloadsDir = Gio.File.new_for_path('Downloads');
    this._downloadsMonitor = this._downloadsDir.monitor(
      Gio.FileMonitorFlags.WATCH_MOVES,
      null
    );
    this._downloadsMonitor.connectObject(
      'changed',
      (fileMonitor, file, otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.MOVED_IN:
            return;
        }
        this.checkDownloads();
      },
      this
    );

    this.checkTrash();
    this.checkDownloads();
    this.checkNotifications();

    this.checkMounts();
    this._commitMounts();
  }

  disable() {
    this._services = [];
    this._volumeMonitor.disconnectObject(this);
    this._volumeMonitor = null;
    this._trashMonitor.disconnectObject(this);
    this._trashMonitor = null;
    this._trashDir = null;
  }

  _commitMounts() {
    if (this._deferredMounts && this._deferredMounts.length) {
      let mounts = [...this._deferredMounts];
      this._deferredMounts = [];
      mounts.forEach((m) => {
        this._onMountAdded(null, m);
      });
    }
  }

  _onMountAdded(monitor, mount) {
    if (!this.extension.mounted_icon) {
      return false;
    }

    this.last_mounted = mount;
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this.setupMountIcon(mount);
    this.extension.animate();
    return true;
  }

  _onMountRemoved(monitor, mount) {
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let mount_id = `/tmp/${appname}`;
    delete this._mounts[mount_id];
    this.extension.animate();
  }

  update(elapsed) {
    this._services.forEach((s) => {
      s.update(elapsed);
    });
  }

  setupTrashIcon() {
    let extension_path = this.extension.path;
    let appname = `trash-dash2dock-lite.desktop`;
    let app_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(app_id);
    let open_app = 'nautilus --select';

    let trash_action = `${extension_path}/apps/empty-trash.sh`;
    {
      let fn = Gio.File.new_for_path('.local/share/Trash');
      trash_action = `rm -rf "${fn.get_path()}"`;
    }

    let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=${open_app} trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash\n\n[Desktop Action trash]\nName=Empty Trash\nExec=${trash_action}\nTerminal=true\n`;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  setupFolderIcon(name, title, icon, path) {
    // expand
    let full_path = Gio.file_new_for_path(path).get_path();
    let extension_path = this.extension.path;
    let appname = `${name}-dash2dock-lite.desktop`;
    let app_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(app_id);
    // let open_app = 'xdg-open';
    let open_app = 'nautilus --select';

    let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${title}\nExec=${open_app} ${full_path}\nIcon=${icon}\nStartupWMClass=${name}-dash2dock-lite\n`;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  setupFolderIcons() {
    this.setupTrashIcon();
    this.setupFolderIcon(
      'downloads',
      'Downloads',
      'folder-downloads',
      'Downloads'
    );
    this.setupFolderIcon(
      'documents',
      'Documents',
      'folder-documents',
      'Documents'
    );
  }

  setupMountIcon(mount) {
    let basename = mount.get_default_location().get_basename();
    let label = mount.get_name();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let fullpath = mount.get_default_location().get_path();
    let icon = mount.get_icon().names[0] || 'drive-harddisk-solidstate';
    let mount_exec = 'echo "not implemented"';
    let unmount_exec = `umount ${fullpath}`;
    let mount_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(mount_id);

    if (!fn.query_exists(null)) {
      let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${label}\nExec=xdg-open ${fullpath}\nIcon=${icon}\nStartupWMClass=mount-${basename}-dash2dock-lite\nActions=unmount;\n\n[Desktop Action mount]\nName=Mount\nExec=${mount_exec}\n\n[Desktop Action unmount]\nName=Unmount\nExec=${unmount_exec}\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
    }

    this._mounts[mount_id] = mount;
  }

  checkNotifications() {
    if (this._disableNotifications > 4) return;

    let media;
    let messages;

    try {
      let tryBox = [
        Main.panel._centerBox,
        Main.panel._leftBox,
        Main.panel._rightBox,
      ];
      for (let i = 0; i < 3; i++) {
        let cc = tryBox[i].get_children();
        cc.forEach((c) => {
          if (media && messages) {
            return;
          }
          media =
            c.child._delegate._messageList._scrollView.last_child.get_children()[0];
          messages =
            c.child._delegate._messageList._scrollView.last_child.get_children()[1];
        });
        if (media && messages) {
          break;
        }
      }
    } catch (err) {
      // fail silently - don't crash
      console.log(err);
      this._disableNotifications++;
    }

    if (!media || !messages) {
      return;
    }

    this._notifications = messages._messages || [];
    if (!this._notifications.length) {
      this._notifications = [];
    }

    this._appNotices = this._appNotices || {};

    Object.keys(this._appNotices).forEach((k) => {
      this._appNotices[k].previous = this._appNotices[k].count;
      this._appNotices[k].count = 0;
    });

    let app_map = {
      'org.gnome.Evolution-alarm-notify.desktop': 'org.gnome.Calendar.desktop',
    };

    this._notifications.forEach((n) => {
      let appId = null;
      if (!n.notification) return;
      if (n.notification.source.app) {
        appId = n.notification.source.app.get_id();
      }
      if (!appId && n.notification.source._app) {
        appId = n.notification.source._app.get_id();
      }
      if (!appId) {
        appId = n.notification.source._appId;
      }
      if (!appId) {
        appId = '?';
      }

      // remap
      appId = app_map[appId] || appId;

      if (!this._appNotices[appId]) {
        this._appNotices[appId] = {
          count: 0,
          previous: 0,
          urgency: 0,
          source: n.notification.source,
        };
      }
      this._appNotices[appId].count++;
      if (this._appNotices[appId].urgency < n.notification.urgency) {
        this._appNotices[appId].urgency = n.notification.urgency;
      }
      this._appNotices[`${appId}`] = this._appNotices[appId];
      if (!appId.endsWith('desktop')) {
        this._appNotices[`${appId}.desktop`] = this._appNotices[appId];
      }
    });

    let hasUpdates = false;
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].previous != this._appNotices[k].count) {
        hasUpdates = true;
      }
    });

    let update = {};
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].count > 0) {
        update[k] = this._appNotices[k];
      }
    });
    this._appNotices = update;

    if (hasUpdates) {
      this.extension.animate();
    }
  }

  checkTrash() {
    if (!this.extension.trash_icon) return;

    let iter = this._trashDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    let prev = this.trashFull;
    this.trashFull = iter.next_file(null) != null;
    if (prev != this.trashFull) {
      this.extension.animate({ refresh: true });
    }
    return this.trashFull;
  }

  async checkDownloads() {
    this._trySpawnCommandLine = trySpawnCommandLine;
    if (!this.extension.downloads_icon) return;
    try {
      let path = this._downloadsDir.get_path();
      let cmd = `${this.extension.path}/apps/list-downloads.sh`;
      await trySpawnCommandLine(cmd);
    } catch (err) {
      console.log(err);
    }

    let fileStat = {};
    let fn = Gio.File.new_for_path('/tmp/downloads.txt');
    if (fn.query_exists(null)) {
      try {
        const [success, contents] = fn.load_contents(null);
        const decoder = new TextDecoder();
        let contentsString = decoder.decode(contents);
        let idx = 0;
        let lines = contentsString.split('\n');
        lines.forEach((l) => {
          let res =
            /\s([a-zA-Z]{3})\s{1,3}([0-9]{1,3})\s{1,3}([0-9:]{4,8})\s{1,3}(.*)/.exec(
              l
            );
          if (res) {
            fileStat[res[4]] = {
              index: idx,
              name: res[4],
              date: `${res[1]}. ${res[2]}, ${res[3]}`,
            };
            idx++;
          }
        });
      } catch (err) {
        console.log(err);
      }
    }

    let iter = this._downloadsDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    // console.log(fileStat);

    this._downloadFilesLength = Object.keys(fileStat).length;
    let maxs = [5, 10, 15, 20, 25];
    let max_recent_items = maxs[this.extension.max_recent_items];

    this._downloadFiles = [];
    let f = iter.next_file(null);
    while (f) {
      if (!f.get_is_hidden()) {
        let name = f.get_name();
        if (fileStat[name]?.index <= max_recent_items + 1) {
          this._downloadFiles.push({
            index: fileStat[name]?.index,
            name,
            display: f.get_display_name(),
            icon: f.get_icon().get_names()[0] ?? 'folder',
            type: f.get_content_type(),
            date: fileStat[name]?.date ?? '',
          });
        }
      }
      f = iter.next_file(null);
    }
  }

  checkMounts() {
    if (!this.extension.mounted_icon) {
      this._mounts = {};
      return;
    }

    let mounts = [];
    let mount_ids = [];
    if (this.extension.mounted_icon) {
      mounts = this._volumeMonitor.get_mounts();
      mount_ids = mounts.map((mount) => {
        let basename = mount.get_default_location().get_basename();
        let appname = `mount-${basename}-dash2dock-lite.desktop`;
        return appname;
      });
    }

    this.mounts = mounts;
    mounts.forEach((mount) => {
      let basename = mount.get_default_location().get_basename();
      let appname = `mount-${basename}-dash2dock-lite.desktop`;
      this._deferredMounts.push(mount);
    });

    // added devices will subsequently be on mounted events
  }

  updateIcon(item, settings) {
    if (!item) {
      return;
    }
    let icon = item._icon;
    if (!icon || !icon.icon_name) {
      return;
    }

    let { scaleFactor, iconSize, dock } = settings;

    // todo move dots and badges here?

    // the trash
    if (this.extension.trash_icon && icon.icon_name.startsWith('user-trash')) {
      let new_icon = this.trashFull ? 'user-trash-full' : 'user-trash';
      if (new_icon != icon.icon_name) {
        icon.icon_name = new_icon;
      }
    }

    // clock
    if (icon.icon_name == 'org.gnome.clocks') {
      if (this.extension.clock_icon) {
        let clock = item._clock;
        if (!clock) {
          clock = new Clock(CANVAS_SIZE, dock.extension._widgetStyle);
          dock._clock = clock;
          item._clock = clock;
          item._appwell.first_child.add_child(clock);
        }
        if (clock) {
          clock._icon = icon;
          clock.width = item._icon.width;
          clock.height = item._icon.height;
          clock.set_scale(item._icon.scaleX, item._icon.scaleY);
          let canvasScale = clock.width / (clock._canvas.width + 2);
          clock._canvas.set_scale(canvasScale, canvasScale);
          clock.pivot_point = item._icon.pivot_point;
          clock.translationX = item._icon.translationX;
          clock.translationY = item._icon.translationY;
          clock.show();
          item._icon.visible = !clock._hideIcon;
        }
      } else {
        let clock = item._clock;
        item._icon.visible = true;
        clock?.hide();
      }
    }

    // calender
    if (icon.icon_name == 'org.gnome.Calendar') {
      if (this.extension.calendar_icon) {
        let calender = item._calender;
        if (!calender) {
          calender = new Calendar(CANVAS_SIZE, dock.extension._widgetStyle);
          dock._calender = calender;
          item._calender = calender;
          item._appwell.first_child.add_child(calender);
        }
        if (calender) {
          calender.width = item._icon.width;
          calender.height = item._icon.height;
          calender.set_scale(item._icon.scaleX, item._icon.scaleY);
          let canvasScale = calender.width / (calender._canvas.width + 2);
          calender._canvas.set_scale(canvasScale, canvasScale);
          calender.pivot_point = item._icon.pivot_point;
          calender.translationX = item._icon.translationX;
          calender.translationY = item._icon.translationY;
          calender.show();
          item._icon.visible = !calender._hideIcon;
        }
      } else {
        let calender = item._calender;
        item._icon.visible = true;
        calender?.hide();
      }
    }
  }
};


//-----------------------------
// ./utils.js
//-----------------------------

//'use strict';

//import GLib from 'gi://GLib';

// todo.. recompute ... seems to length the debounce hold out period
const DEBOUNCE_PRECISION = 1;

const pointer_wrapper = {
  get_position: () => {
    let [px, py] = global.get_pointer();
    return [{}, px, py];
  },
  warp: (screen, x, y) => {
    screen.simulated_pointer = [x, y];
  },
};

const getPointer = () => {
  return pointer_wrapper;
};

const warpPointer = (pointer, x, y, extension) => {
  pointer.warp(extension, x, y);
};

const setTimeout = (func, delay, ...args) => {
  const wrappedFunc = () => {
    func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

const setInterval = (func, delay, ...args) => {
  const wrappedFunc = () => {
    return func.apply(this, args) || true;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

const clearTimeout = (id) => {
  GLib.source_remove(id);
};

const clearInterval = (id) => {
  GLib.source_remove(id);
};


//-----------------------------
// ./extension.js
//-----------------------------

/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 */

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

//import St from 'gi://St';
//import Shell from 'gi://Shell';

//import { Timer } from './timer.js';
//import { Style } from './style.js';
//import { Dock } from './dock.js';
//import { Services } from './services.js';
//import { runTests } from './diagnostics.js';

//import {
//  Extension,
//  gettext as _,
//} from 'resource:///org/gnome/shell/extensions/extension.js';

//import { schemaId, SettingsKeys } from './preferences/keys.js';

const SERVICES_UPDATE_INTERVAL = 2500;

const ANIM_ICON_QUALITY = 2.0;
const ANIM_INTERVAL = 15;
const ANIM_INTERVAL_PAD = 15;

 class Dash2DockLiteExt extends Extension {
  createDock() {
    let d = new Dock({ extension: this });
    d.extension = this;
    d.dock();
    this.dock = d;
    this.docks.push(this.dock);
    this.listeners = [this.services, ...this.docks];
    this._monitorIndex = 0;
    return d;
  }

  createTheDocks() {
    this.docks = this.docks ?? [];

    // only one dock
    if (
      Main.layoutManager.monitors.length == 1 ||
      this.multi_monitor_preference == 0
    ) {
      if (this.docks.length > 1) {
        this.destroyDocks();
      }
      if (this.docks.length == 0) {
        this.createDock();
      }
      return;
    }

    if (
      Main.layoutManager.monitors.length > 0 &&
      this.multi_monitor_preference == 1
    ) {
      let count = Main.layoutManager.monitors.length;
      if (count != this.docks.length) {
        this.destroyDocks();
      }

      for (let i = 0; i < count; i++) {
        let d = this.createDock();
        d._monitorIndex = i;
      }
    }
  }

  destroyDocks() {
    (this.docks || []).forEach((dock) => {
      dock.undock();
      dock.cancelAnimations();
      this.dock = null;
    });
    this.docks = [];
  }

  recreateAllDocks(delay = 750) {
    // some settings change cause glitches ... recreate all docks (workaround)
    if (!this._recreateSeq) {
      this._recreateSeq = this._loTimer.runDebounced(() => {
        this.destroyDocks();
        this.createTheDocks();
      }, delay);
    } else {
      this._loTimer.runDebounced(this._recreateSeq);
    }
  }

  enable() {
    this._enableJitterHack = true;

    // for debugging - set to 255
    this._dash_opacity = 0;

    // three available timers
    // for persistent runs
    this._timer = new Timer('loop timer');
    this._timer.initialize(3500);

    // for animation runs
    // resolution (15) will be modified by animation-fps
    this._hiTimer = new Timer('hi-res timer');
    this._hiTimer.initialize(15);

    // for deferred or debounced runs
    this._loTimer = new Timer('lo-res timer');
    this._loTimer.initialize(750);

    this.listeners = [];
    this.scale = 1.0;
    this.icon_size = 0;
    this.icon_quality = ANIM_ICON_QUALITY;

    this._style = new Style();

    this._enableSettings();

    // no longer needed
    // this._disable_borders = this.border_radius > 0;

    // animations are always on - but may be muted
    if (!this._settingsKeys.getValue('animate-icons')) {
      this._settingsKeys.setValue('animate-icons', true);
    }

    Main.overview.dash.last_child.reactive = false;
    Main.overview.dash.opacity = 0;

    this.docks = [];

    // service
    this.services = new Services();
    this.services.extension = this;
    this.services.setupFolderIcons();

    // todo follow animator and autohider protocol
    this.services.enable();
    this._onCheckServices();

    // this._updateAnimationFPS();
    // this._updateShrink();
    // this._updateIconResolution();
    // this._updateLayout();
    // this._updateAutohide();
    // this._updateWidgetStyle();
    // this._updateStyle();

    this._addEvents();

    this._queryDisplay();

    // this._updateStyle();

    this.startUp();

    log('dash2dock-lite enabled');

    Main.overview.d2dl = this;
  }

  disable() {
    this._timer?.shutdown();
    this._hiTimer?.shutdown();
    this._loTimer?.shutdown();
    this._diagnosticTimer?.shutdown();
    // null later

    this._removeEvents();
    this._disableSettings();

    this._updateShrink(true);
    this._updateLayout(true);
    this._updateAutohide(true);

    Main.overview.dash.last_child.visible = true;
    Main.overview.dash.opacity = 255;

    this.docks.forEach((container) => {
      container.undock();
    });
    this.docks = [];

    this.destroyDocks();

    this.services.disable();
    this.services = null;

    this._timer = null;
    this._hiTimer = null;
    this._loTimer = null;
    this._diagnosticTimer = null;

    this._style.unloadAll();
    this._style = null;

    log('dash2dock-lite disabled');
  }

  animate(settings = {}) {
    this.docks.forEach((dock) => {
      if (settings && settings.preview) {
        dock.preview();
      }
      if (settings.refresh) {
        dock._icons = null;
        dock.layout();
      }
      dock._beginAnimation();
    });
  }

  checkHide() {
    this.docks.forEach((dock) => {
      if (dock.autohider) {
        dock.autohider._debounceCheckHide();
      }
    });
  }

  startUp() {
    this.createTheDocks();
    this._loTimer.runOnce(() => {
      this._updateAnimationFPS();
      this._updateShrink();
      this._updateIconResolution();
      // this._updateLayout();
      // this._updateAutohide();
      this._updateWidgetStyle();
      this._updateStyle();

      this.animate({ refresh: true });
      this.docks.forEach((dock) => {
        dock._debounceEndAnimation();
      });
    }, 10);
  }

  _autohiders() {
    return this.docks.map((d) => {
      return d.autohider;
    });
  }

  // to be called by docks
  _queryDisplay(currentMonitorIndex) {
    if (
      Main.layoutManager.monitors.length > 0 &&
      this.multi_monitor_preference > 0
    ) {
      // if multi-monitor ... left _updateLayout take care of updating the docks
      return currentMonitorIndex;
    }

    let idx = this.preferred_monitor || 0;
    if (idx == 0) {
      idx = Main.layoutManager.primaryIndex;
    } else if (idx == Main.layoutManager.primaryIndex) {
      idx = 0;
    }

    if (!Main.layoutManager.monitors[idx]) {
      idx = Main.layoutManager.primaryIndex;
    }

    return idx;
  }

  _enableSettings() {
this._settings = ExtensionUtils.getSettings(schemaId);
    this._settingsKeys = SettingsKeys();

    this._settingsKeys.connectSettings(this._settings, (name, value) => {
      let n = name.replace(/-/g, '_');
      this[n] = value;

      // log(`${n} ${value}`);

      switch (name) {
        case 'msg-to-ext': {
          if (value.length) {
            try {
              eval(value);
            } catch (err) {
              log(err);
            }
            this._settings.set_string('msg-to-ext', '');
          }
          break;
        }
        case 'animation-fps': {
          this._updateAnimationFPS();
          break;
        }
        case 'debug-visual':
          this.animate();
          break;
        case 'mounted-icon': {
          this.services.checkMounts();
          this.services._commitMounts();
          this.animate({ refresh: true });
          break;
        }
        case 'peek-hidden-icons': {
          this.animate();
          break;
        }
        case 'animation-magnify':
        case 'animation-spread':
        case 'animation-rise':
        case 'animation-bounce': {
          if (this.animate_icons) {
            this.animate({ preview: true });
          }
          break;
        }
        case 'notification-badge-color':
        case 'notification-badge-style':
        case 'running-indicator-color':
        case 'running-indicator-style': {
          this.animate();
          break;
        }
        case 'clock-style':
        case 'calendar-style':
          this._updateWidgetStyle();
          break;
        case 'max-recent-items':
          this.services.checkDownloads();
          break;
        case 'apps-icon':
        case 'apps-icon-front':
        case 'calendar-icon':
        case 'clock-icon':
        case 'favorites-only': {
          this.animate({ refresh: true });
          break;
        }
        // problematic settings needing animator restart
        case 'dock-location':
        case 'icon-resolution': {
          this._updateIconResolution();
          this._updateStyle();
          this._updateLayout();
          this._updateIconSpacing();
          this.animate();
          break;
        }
        case 'icon-effect': {
          this.docks.forEach((dock) => {
            dock._updateIconEffect();
          });
          break;
        }
        case 'icon-effect-color': {
          this.docks.forEach((dock) => {
            if (dock.iconEffect) {
              dock.iconEffect.color = this.icon_effect_color;
            }
          });
          this.animate();
          break;
        }
        case 'icon-spacing': {
          this._updateIconSpacing();
          break;
        }
        case 'multi-monitor-preference':
          this._updateMultiMonitorPreference();
          break;
        case 'icon-size':
        case 'preferred-monitor': {
          this._updateLayout();
          this.animate();
          break;
        }
        case 'autohide-dodge':
        case 'autohide-dash': {
          this._updateAutohide();
          break;
        }
        case 'dock-padding':
        case 'edge-distance': {
          this.animate();
          break;
        }
        case 'shrink-icons':
        case 'icon-size': {
          this._updateShrink();
          this.animate();
          break;
        }
        case 'border-radius':
          this._debouncedUpdateStyle();
          break;
        case 'separator-color':
        case 'separator-thickness':
        case 'border-color':
        case 'border-thickness':
        case 'customize-topbar':
        case 'icon-shadow':
        case 'topbar-border-color':
        case 'topbar-border-thickness':
        case 'topbar-background-color':
        case 'topbar-foreground-color':
        case 'customize-label':
        case 'label-border-radius':
        case 'label-border-color':
        case 'label-border-thickness':
        case 'label-background-color':
        case 'label-foreground-color':
        case 'background-color':
        case 'panel-mode': {
          this._updateStyle();
          this._updateLayout();
          this.animate();
          break;
        }
        case 'pressure-sense': {
          break;
        }
        case 'downloads-icon':
        case 'documents-icon':
        case 'trash-icon': {
          this._updateLayout();
          this.animate();
          break;
        }
      }
    });

    Object.keys(this._settingsKeys._keys).forEach((k) => {
      let key = this._settingsKeys.getKey(k);
      let name = k.replace(/-/g, '_');
      this[name] = key.value;
      if (key.options) {
        this[`${name}_options`] = key.options;
      }
    });
  }

  _disableSettings() {
    this._settingsKeys.disconnectSettings();
    this._settingsKeys = null;
  }

  _addEvents() {
    this._appSystem = Shell.AppSystem.get_default();

    this._appSystem.connectObject(
      'installed-changed',
      () => {
        this._onAppsChanged();
      },
      'app-state-changed',
      () => {
        this._onAppsChanged();
      },
      this
    );

    this._appFavorites = Fav.getAppFavorites();
    this._appFavorites.connectObject(
      'changed',
      () => {
        this._onAppsChanged();
      },
      this
    );

    Main.sessionMode.connectObject(
      'updated',
      this._onSessionUpdated.bind(this),
      this
    );

    Main.layoutManager.connectObject(
      // 'startup-complete',
      // this.startUp.bind(this),
      'monitors-changed',
      () => {
        this._updateMultiMonitorPreference();
      },
      this
    );

    Main.messageTray.connectObject(
      'queue-changed',
      (count) => {
        this.services.checkNotifications();
        this.animate();
      },
      this
    );

    global.display.connectObject(
      'notify::focus-window',
      this._onFocusWindow.bind(this),
      'in-fullscreen-changed',
      this._onFullScreen.bind(this),
      this
    );

    Main.overview.connectObject(
      'showing',
      this._onOverviewShowing.bind(this),
      'hidden',
      this._onOverviewHidden.bind(this),
      this
    );

    St.TextureCache.get_default().connectObject(
      'icon-theme-changed',
      this._onIconThemeChanged.bind(this),
      this
    );

    // move to services.js
    this._timer.runLoop(
      () => {
        this._onCheckServices();
      },
      SERVICES_UPDATE_INTERVAL,
      'services'
    );
  }

  _removeEvents() {
    this._appSystem.disconnectObject(this);
    this._appFavorites.disconnectObject(this);
    Main.messageTray.disconnectObject(this);
    Main.overview.disconnectObject(this);
    Main.layoutManager.disconnectObject(this);
    global.display.disconnectObject(this);
    global.stage.disconnectObject(this);
    St.TextureCache.get_default().disconnectObject(this);
  }

  _onIconThemeChanged() {
    if (this.animate_icons) {
      this.services.disable();
      this.services.enable();
    }
    this._updateStyle();
    this.animate();
  }

  _onFocusWindow() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFocusWindow) l._onFocusWindow();
    });
  }

  _onAppsChanged() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onAppsChanged) l._onAppsChanged();
    });
  }

  _onFullScreen() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFullScreen) l._onFullScreen();
    });
  }

  _onOverviewShowing() {
    this._inOverview = true;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
  }

  _onOverviewHidden() {
    this._inOverview = false;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
  }

  _onSessionUpdated() {
    this.animate();
  }

  _onCheckServices() {
    if (!this.services) return; // todo why does this happen?
    // todo convert services time in seconds
    this.services.update(SERVICES_UPDATE_INTERVAL);
  }

  _updateWidgetStyle() {
    this._widgetStyle = {
      dark_color: this.drawing_dark_color,
      light_color: this.drawing_light_color,
      accent_color: this.drawing_accent_color,
      dark_foreground: this.drawing_dark_foreground,
      light_foreground: this.drawing_light_foreground,
      secondary_color: this.drawing_secondary_color,
      clock_style: this.clock_style,
    };
    this.docks.forEach((dock) => {
      let widgets = [dock._clock, dock._calendar];
      widgets.forEach((w) => {
        if (w) {
          w.settings = this._widgetStyle;
          w.redraw();
        }
      });
    });
    this.animate();
  }

  _updateAnimationFPS() {
    this.docks.forEach((dock) => {
      dock.cancelAnimations();
    });
    this.animationInterval =
      ANIM_INTERVAL + (this.animation_fps || 0) * ANIM_INTERVAL_PAD;
    this._hiTimer.shutdown();
    this._hiTimer.initialize(this.animationInterval);
  }

  _updateShrink(disable) {
    if (this.shrink_icons && !disable) {
      this.scale = 0.8; // * rescale_modifier;
    } else {
      this.scale = 1.0; // * rescale_modifier;
    }

    if (this.animate_icons) {
      // this._animators().forEach((animator) => {
      //   animator.relayout();
      // });
    }
  }

  _updateMultiMonitorPreference() {
    this.createTheDocks();
    this._updateLayout();
    this.animate();
  }

  _updateIconResolution(disable) {
    this.icon_quality = 1 + [2, 0, 1, 2, 3][this.icon_resolution || 0];
  }

  _debouncedUpdateStyle(disable) {
    if (disable) return;
    if (!this._debounceStyleSeq) {
      this._debounceStyleSeq = this._hiTimer.runDebounced(
        () => {
          this._updateStyle();
        },
        500,
        'debounceStyle'
      );
    } else {
      this._hiTimer.runDebounced(this._debounceStyleSeq);
    }
  }

  _updateStyle(disable) {
    let styles = [];

    let rads = [0, 8, 16, 20, 24, 28, 32];

    // icons-shadow
    if (this.icon_shadow) {
      styles.push(
        '#dash StIcon, #DockItemList StIcon {icon-shadow: rgba(0, 0, 0, 0.24) 0 2px 6px;}'
      );
      styles.push(
        '#dash StIcon:hover, #DockItemList StIcon:hover {icon-shadow: rgba(0, 0, 0, 0.24) 0 2px 8px;}'
      );
    }

    // dash
    {
      let r = rads[Math.floor(this.border_radius)];
      let ss = [];
      if (this.panel_mode) {
        r = 0;
      }
      ss.push(`border-radius: ${r}px;`);

      {
        let rgba = this._style.rgba(this.background_color);
        ss.push(`background: rgba(${rgba});`);
      }

      styles.push(`#d2dlBackground { ${ss.join(' ')}}`);
    }

    // dash label
    if (this.customize_label) {
      let rads = [0, 2, 6, 10, 12, 16, 20];
      let r = rads[Math.floor(this.label_border_radius)];
      let ss = [];
      ss.push(`border-radius: ${r}px;`);

      {
        let rgba = this._style.rgba(this.label_background_color);
        ss.push(`background: rgba(${rgba});`);
      }

      {
        let rgba = this._style.rgba(this.label_border_color);
        let t = this.label_border_thickness;
        ss.push(`border: ${t}px rgba(${rgba});`);
      }

      {
        let rgba = this._style.rgba(this.label_foreground_color);
        ss.push(`color: rgba(${rgba});`);
      }

      styles.push(`.dash-label { ${ss.join(' ')}}`);
    }

    // topbar
    if (this.customize_topbar) {
      let ss = [];
      // border
      if (this.topbar_border_thickness) {
        let rgba = this._style.rgba(this.topbar_border_color);
        ss.push(
          `border: ${this.topbar_border_thickness}px solid rgba(${rgba}); border-top: 0px; border-left: 0px; border-right: 0px;`
        );
      }

      // background
      {
        let rgba = this._style.rgba(this.topbar_background_color);
        ss.push(`background: rgba(${rgba});`);
      }

      styles.push(`#panelBox #panel {${ss.join(' ')}}`);

      // foreground
      if (this.topbar_foreground_color && this.topbar_foreground_color[3] > 0) {
        let rgba = this._style.rgba(this.topbar_foreground_color);
        styles.push(`#panelBox #panel * { color: rgba(${rgba}) }`);
      } else {
        let rgba = this._style.rgba([0, 0, 0, 1]);
        let bg = this.topbar_background_color;
        if (0.3 * bg[0] + 0.59 * bg[1] + 0.11 * bg[2] < 0.5) {
          rgba = this._style.rgba([1, 1, 1, 1]);
        }
        styles.push(`#panelBox #panel * { color: rgba(${rgba}) }`);
      }
    }

    if (this.separator_thickness) {
      let rgba = this._style.rgba(this.separator_color);
      styles.push(`.dash-separator { background-color: rgba(${rgba}); }`);
    }

    this._style.build('custom-d2dl', styles);

    this._updateBorderStyle();
  }

  _updateBorderStyle() {
    this._backgroundStyle = '';

    // apply border as inline style... otherwise buggy and won't show at startup
    // also add deferred bordering... otherwise rounder borders show with artifacts
    // no longer necessary<<<?

    let border_style = '';
    if (this.border_thickness /* && !this._disable_borders */) {
      let rgba = this._style.rgba(this.border_color);
      border_style = `border: ${this.border_thickness}px solid rgba(${rgba}) !important;`;
    }

    let panel_borders = '';
    if (this.panel_mode) {
      panel_borders =
        'border-left: 0px; border-right: 0px; border-bottom: 0px;';
      // vertical border-left/right doesn;t seem to work
      if (this._position == 'left') {
        panel_borders =
          'border-left: 0px; border-top: 0px; border-bottom: 0px;';
      }
      if (this._position == 'right') {
        panel_borders =
          'border-top: 0px; border-right: 0px; border-bottom: 0px;';
      }
    }

    this._backgroundStyle = `${border_style} ${panel_borders}`;
  }

  _updateLayout(disable) {
    // console.log(this.multi_monitor_preference);
    this.docks.forEach((dock) => {
      dock.layout();
    });
  }

  _updateIconSpacing(disable) {
    if (!this._iconSpacingDebounceSeq) {
      this._iconSpacingDebounceSeq = this._loTimer.runDebounced(() => {
        this.animate({ refresh: true });
      }, 750);
    } else {
      this._loTimer.runDebounced(this._iconSpacingDebounceSeq);
    }
  }

  _updateAutohide(disable) {
    if (this.autohide_dash && !disable) {
      this._autohiders().forEach((autohider) => {
        autohider.enable();
      });
    } else {
      this._autohiders().forEach((autohider) => {
        autohider.disable();
      });
    }

    if (!disable) {
      this.docks.forEach((dock) => {
        dock.removeFromChrome();
        dock.addToChrome();
      });
    }

    if (this.animate_icons && !disable) {
      this.animate();
    }
  }

  runDiagnostics() {
    if (!this._diagnosticTimer) {
      this._diagnosticTimer = new Timer('diagnostics');
      this._diagnosticTimer.initialize(50);
    }
    runTests(this, this._settingsKeys);
  }

  dumpTimers() {
    this._timer.dumpSubscribers();
    this._hiTimer.dumpSubscribers();
    this._loTimer.dumpSubscribers();
    if (this._diagnosticTimer) {
      this._diagnosticTimer.dumpSubscribers();
    }
  }
}


//-----------------------------
// ./dock.js
//-----------------------------

//'use strict';

//import * as Main from 'resource:///org/gnome/shell/ui/main.js';
//import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

//import Meta from 'gi://Meta';
//import Shell from 'gi://Shell';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Graphene from 'gi://Graphene';
//import St from 'gi://St';
//import Gio from 'gi://Gio';

//import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';

//import { TintEffect } from './effects/tint_effect.js';
//import { MonochromeEffect } from './effects/monochrome_effect.js';

//import {
//  DockItemList,
//  DockItemContainer,
//  DockBackground,
//} from './dockItems.js';
//import { AutoHide } from './autohide.js';
//import { Animator } from './animator.js';

//const Point = Graphene.Point;

const DockPosition = {
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
};

const DockAlignment = {
  CENTER: 'center',
  START: 'start',
  END: 'end',
};

const PREVIEW_FRAMES = 64;
const ANIM_DEBOUNCE_END_DELAY = 750;

const MIN_SCROLL_RESOLUTION = 4;
const MAX_SCROLL_RESOLUTION = 10;

let Dock = GObject.registerClass(
  {},
  class Dock extends St.Widget {
    _init(params) {
      super._init({
        name: 'd2daDock',
        reactive: false,
        track_hover: false,
        width: 0,
        height: 0,
        clip_to_allocation: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.extension = params.extension;

      this._alignment = DockAlignment.CENTER;
      this._monitorIndex = Main.layoutManager.primaryIndex;

      this._background = new DockBackground({ name: 'd2dlBackground' });
      this.add_child(this._background);

      this.addDash();

      this.dash.reactive = true;
      this.dash.track_hover = true;
      this.dash.connectObject(
        'scroll-event',
        this._onScrollEvent.bind(this),
        'button-press-event',
        this._onButtonPressEvent.bind(this),
        'motion-event',
        this._onMotionEvent.bind(this),
        'enter-event',
        this._onEnterEvent.bind(this),
        'leave-event',
        this._onLeaveEvent.bind(this),
        'destroy',
        () => {},
        this
      );

      this.dash.opacity = 0;
      this._scrollCounter = 0;

      this.animator = new Animator();
      this.animator.dashContainer = this;
      this.animator.extension = this.extension;
      this.animator.enable();

      this.autohider = new AutoHide();
      this.autohider.dashContainer = this;
      this.autohider.extension = this.extension;
      if (this.extension.autohide_dash) {
        this.autohider.enable();
      }

      this.struts = new St.Widget({
        name: 'DockStruts',
      });
      this.dwell = new St.Widget({
        name: 'DockDwell',
        reactive: true,
        track_hover: true,
      });
      this.dwell.connectObject(
        'motion-event',
        this.autohider._onMotionEvent.bind(this.autohider),
        'enter-event',
        this.autohider._onEnterEvent.bind(this.autohider),
        'leave-event',
        this.autohider._onLeaveEvent.bind(this.autohider),
        this
      );
    }

    createItem(appinfo_filename) {
      let item = new DockItemContainer({
        appinfo_filename,
      });
      item.dock = this;
      item._menu._onActivate = () => {
        this._maybeBounce(item);
      };
      this._extraIcons.add_child(item);
      return item;
    }

    dock() {
      this.addToChrome();
      this.layout();
      this._beginAnimation();
    }

    undock() {
      if (this._list) {
        // todo Main.uiGroup no longer available in gnome 46
        Main.uiGroup.remove_child(this._list);
        this._list = null;
      }
      this._endAnimation();
      this.dash._box.remove_effect_by_name('icon-effect');
      this.autohider.disable();
      this.removeFromChrome();

      this.restorePanel();
    }

    _onButtonPressEvent(evt) {
      return Clutter.EVENT_PROPAGATE;
    }
    _onMotionEvent(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onEnterEvent(evt) {
      this._beginAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onLeaveEvent(evt) {
      this.autohider._debounceCheckHide();
      this._debounceEndAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onFocusWindow(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onFullScreen() {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onAppsChanged(evt) {
      this._icons = null;
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onClock() {
      this._clock?.redraw();
    }
    _onCalendar() {
      this._calendar?.redraw();
    }

    _createEffect(idx) {
      let effect = null;
      switch (idx) {
        case 1: {
          effect = new TintEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
        case 2: {
          effect = new MonochromeEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
      }
      return effect;
    }

    _updateIconEffect() {
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
      let effect = this._createEffect(this.extension.icon_effect);
      if (effect) {
        this.dash._box.get_parent().add_effect_with_name('icon-effect', effect);
      }
      this.iconEffect = effect;
    }

    slideIn() {
      if (this._hidden) {
        this._hidden = false;
        this._beginAnimation();
      }
    }

    slideOut() {
      if (this._list && this._list.visible) {
        return;
      }
      if (!this._hidden) {
        this._hidden = true;
        this._beginAnimation();
      }
    }

    getMonitor() {
      this._monitorIndex = this.extension._queryDisplay(this._monitorIndex);
      let m =
        Main.layoutManager.monitors[this._monitorIndex] ||
        Main.layoutManager.primaryMonitor;
      this._monitor = m;
      return m;
    }

    addDash() {
      let dash = new Dash();
      dash._adjustIconSize = () => {};
      this.dash = dash;
      this.dash._background.visible = false;
      this.dash._box.clip_to_allocation = false;

      this._extraIcons = new St.BoxLayout();
      this.dash._box.add_child(this._extraIcons);

      this._separator = new St.Widget({
        style_class: 'dash-separator',
        y_align: Clutter.ActorAlign.CENTER,
        height: 48,
      });
      this._separator.name = 'separator';
      this._extraIcons.add_child(this._separator);

      this.add_child(dash);
      return dash;
    }

    addToChrome() {
      if (this._onChrome) {
        return;
      }

      this._updateIconEffect();

      Main.layoutManager.addChrome(this.struts, {
        affectsStruts: !this.extension.autohide_dash,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      Main.layoutManager.addChrome(this, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      Main.layoutManager.addChrome(this.dwell, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      this._onChrome = true;
    }

    removeFromChrome() {
      if (!this._onChrome) {
        return;
      }
      Main.layoutManager.removeChrome(this.struts);
      Main.layoutManager.removeChrome(this);
      Main.layoutManager.removeChrome(this.dwell);
      this._onChrome = false;
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
    }

    isVertical() {
      return (
        this._position == DockPosition.LEFT ||
        this._position == DockPosition.RIGHT
      );
    }

    _preferredIconSize() {
      let preferredIconSizes = this._preferredIconSizes;
      let iconSize = 64;
      if (!preferredIconSizes) {
        preferredIconSizes = [32];
        for (let i = 16; i < 128; i += 4) {
          preferredIconSizes.push(i);
        }
        this._preferredIconSizes = preferredIconSizes;
      }

      iconSize =
        2 *
        (preferredIconSizes[
          Math.floor(this.extension.icon_size * preferredIconSizes.length)
        ] || 64);
      iconSize *= this.extension.scale;

      this._iconSize = iconSize;
      return iconSize;
    }

    /**
     *  DashItemContainer
     *    > child (DashIcon[appwell])
     *      > .icon (IconGrid)
     *        > .icon (StIcon)
     *      > ._dot
     *    > .label
     *
     *  ShowAppsIcon extends DashItemContainer
     *    > .icon (IconGrid)
     *      > .icon
     *    > ._iconActor
     */

    _inspectIcon(c) {
      if (!c.visible) return false;

      /* separator */
      c._cls = c._cls || c.get_style_class_name();
      if (c._cls === 'dash-separator') {
        this._separators.push(c);
        this._lastSeparator = c;
        c.visible = true;
        c.style = 'margin-left: 8px; margin-right: 8px;';
        return false;
      }

      /* ShowAppsIcon */
      if (c.icon /* IconGrid */ && c.icon.icon /* StIcon */) {
        c._icon = c.icon.icon;
        c._button = c.child;
        c.icon.style = 'background-color: transparent !important;';
      }

      /* DashItemContainer */
      if (
        c.child /* DashIcon */ &&
        c.child.icon /* IconGrid */ &&
        c.child.icon.icon /* StIcon */
      ) {
        c._grid = c.child.icon;
        c._icon = c.child.icon.icon;
        c._appwell = c.child;
        if (c._appwell) {
          c._appwell.visible = true;
          c._dot = c._appwell._dot;
          // hide icons if favorites only
          if (this.extension.favorites_only) {
            let app = c._appwell.app;
            let appId = app ? app.get_id() : '';
            if (!this._favorite_ids.includes(appId)) {
              c._appwell.visible = false;
              c.width = -1;
              c.height = -1;
              return false;
            }
          }
        }
        if (c._dot) {
          c._dot.opacity = 0;
        }
      }

      if (c._icon) {
        c._label = c.label;
        if (
          c == this.dash._showAppsIcon &&
          this.extension.apps_icon_front &&
          !this.isVertical()
        ) {
          this._icons.unshift(c);
        } else {
          this._icons.push(c);
        }
        return true;
      }

      return false;
    }

    _findIcons() {
      if (this._icons) {
        let iconsLength = this.dash._box.get_children().length;
        if (this._extraIcons) {
          iconsLength += this._extraIcons.get_children().length;
        }
        if (this._icons.length + 2 >= iconsLength) {
          // use icons cache
          return this._icons;
        }
      }

      this._separators = [];
      this._icons = [];

      if (!this.dash) return [];

      if (this.extension.favorites_only) {
        this._favorite_ids = Fav.getAppFavorites()._getIds();
      }

      this.dash._box.get_children().forEach((icon) => {
        this._inspectIcon(icon);
      });

      if (this.extension.favorites_only) {
        if (this._separators.length) {
          this._separators[0].visible = false;
          this._separators = [];
        }
      }

      let lastFavIcon = this._icons[this._icons.length - 1] ?? null;

      if (this._extraIcons) {
        this._lastSeparator = null;
        this._extraIcons.get_children().forEach((icon) => {
          this._inspectIcon(icon);
        });
        if (this._lastSeparator && lastFavIcon) {
          this._lastSeparator._prev = lastFavIcon;
        }
        this._extraIcons.visible = this._extraIcons.get_children().length > 1;
      }
      if (this.dash._showAppsIcon) {
        this.dash._showAppsIcon.visible = this.extension.apps_icon;
        if (this._inspectIcon(this.dash._showAppsIcon)) {
          let icon = this.dash._showAppsIcon._icon;
          if (!icon._connected) {
            icon._connected = true;
            icon.connectObject(
              'button-press-event',
              () => {
                let overview = Main.uiGroup
                  .get_children()
                  .find((c) => c.name == 'overviewGroup')
                  .get_children()
                  .find((c) => c.name == 'overview');
                if (overview._delegate.visible) {
                  overview._delegate.toggle();
                } else {
                  overview._delegate.showApps();
                }
                return Clutter.EVENT_PROPAGATE;
              },
              'enter-event',
              () => {
                this.dash._showAppsIcon.showLabel();
              },
              'leave-event',
              () => {
                this.dash._showAppsIcon.hideLabel();
              },
              this
            );
          }
        }
      }

      let noAnimation = !this.extension.animate_icons_unmute;

      let pv = new Point();
      pv.x = 0.5;
      pv.y = 0.5;
      this._icons.forEach((c) => {
        c._icon.track_hover = true;
        c._icon.reactive = true;
        c._icon.pivot_point = pv;
        if (c._button) {
          c._button.reactive = noAnimation;
          c._button.track_hover = noAnimation;
          c.toggle_mode = false;
        }
        if (c._grid) {
          c._grid.style = noAnimation ? '' : 'background: none !important;';
        }
        if (c._appwell && !c._appwell._activate) {
          c._appwell._activate = c._appwell.activate;
          c._appwell.activate = () => {
            this._maybeBounce(c);
            this._maybeMinimizeOrMaximize(c._appwell.app);
            c._appwell._activate();
          };
        }
        let icon = c._icon;
        if (!icon._destroyConnectId) {
          icon._destroyConnectId = icon.connect('destroy', () => {
            this._icons = null;
          });
        }
        let { _draggable } = icon;
        if (_draggable && !_draggable._dragBeginId) {
          _draggable._dragBeginId = _draggable.connect('drag-begin', () => {
            this._dragging = true;
            this._dragged = icon;
          });
          _draggable._dragEndId = _draggable.connect('drag-end', () => {
            this._dragging = false;
            this._icons = null;
          });
        }

        // icon image quality
        if (this._iconSizeScaledDown) {
          icon.set_icon_size(
            this._iconSizeScaledDown * this.extension.icon_quality
          );
        }
      });

      return this._icons;
    }

    _updateExtraIcons() {
      if (!this._extraIcons) {
        return;
      }

      // check these intermittently!
      //---------------
      // the mount icons
      //---------------
      {
        let extras = [...this._extraIcons.get_children()];
        let extraNames = extras.map((e) => e.name);
        let mounted = Object.keys(this.extension.services._mounts);

        extras.forEach((extra) => {
          if (!extra._mountType) {
            return;
          }
          if (!mounted.includes(extra.name)) {
            this._extraIcons.remove_child(extra);
            this._icons = null;
          }
        });

        mounted.forEach((mount) => {
          if (!extraNames.includes(mount)) {
            let mountedIcon = this.createItem(mount);
            mountedIcon._mountType = true;
            this._icons = null;
          }
        });
      }

      //---------------
      // the folder icons
      //---------------
      let folders = [
        {
          icon: '_downloadsIcon',
          path: '/tmp/downloads-dash2dock-lite.desktop',
          show: this.extension.downloads_icon, // && this._position == DockPosition.BOTTOM
        },
        // {
        //   icon: '_documentsIcon',
        //   path: '/tmp/documents-dash2dock-lite.desktop',
        //   show: this.extension.documents_icon // && this._position == DockPosition.BOTTOM
        // }
      ];
      folders.forEach((f) => {
        if (!this[f.icon] && f.show) {
          // pin downloads icon
          this[f.icon] = this.createItem(f.path);

          let target = this[f.icon];

          target._onClick = () => {
            if (this._position != DockPosition.BOTTOM) {
              target.activateNewWindow();
              return;
            }
            if (!this.extension.services._downloadFiles) {
              this.extension.services.checkDownloads();
            }
            let files = [...this.extension.services._downloadFiles];
            if (files.length < this.extension.services._downloadFilesLength) {
              files = [
                {
                  index: -1,
                  name: 'More...',
                  path: 'Downloads',
                  icon: target._icon.icon_name,
                  type: 'directory',
                },
                ...files,
              ];
            }
            files = files.sort(function (a, b) {
              return a.index > b.index ? 1 : -1;
            });

            if (!this._list) {
              this._list = new DockItemList();
              this._list.dock = this;
              Main.uiGroup.add_child(this._list);
            } else if (this._list.visible) {
              this._list.slideOut();
            } else {
              // remove and re-add so that it is repositioned to topmost
              Main.uiGroup.remove_child(this._list);
              Main.uiGroup.add_child(this._list);
              this._list.visible = true;
            }

            if (this._list.visible && !this._list._hidden) {
              this._list.slideIn(target, files);
              let pv = new Point();
              pv.x = 0.5;
              pv.y = 1;
            }
          };

          this._icons = null;
        } else if (this[f.icon] && !f.show) {
          // unpin downloads icon
          this._extraIcons.remove_child(this[f.icon]);
          this._downloadsIcon = null;
          this._icons = null;
        }
      });

      //---------------
      // the trash icon
      //---------------
      if (!this._trashIcon && this.extension.trash_icon) {
        // pin trash icon
        this._trashIcon = this.createItem(`/tmp/trash-dash2dock-lite.desktop`);
        this._icons = null;
      } else if (this._trashIcon && !this.extension.trash_icon) {
        // unpin trash icon
        this._extraIcons.remove_child(this._trashIcon);
        this._trashIcon = null;
        this._icons = null;
      } else if (this._trashIcon && this.extension.trash_icon) {
        // move trash icon to the end
        if (this._extraIcons.last_child != this._trashIcon) {
          this._extraIcons.remove_child(this._trashIcon);
          this._extraIcons.add_child(this._trashIcon);
        }
      }
    }

    layout() {
      if (this.extension.apps_icon_front) {
        this.dash.last_child.text_direction = 2; // RTL
        this.dash._box.text_direction = 1; // LTR
      } else {
        this.dash.last_child.text_direction = 1; // LTR
        this.dash._box.text_direction = 1; // LTR
      }

      const locations = [
        DockPosition.BOTTOM,
        DockPosition.LEFT,
        DockPosition.RIGHT,
        DockPosition.TOP,
      ];
      this._position =
        locations[this.extension.dock_location] || DockPosition.BOTTOM;

      this._updateExtraIcons();

      this._icons = this._findIcons();

      let m = this.getMonitor();
      let scaleFactor = m.geometry_scale;
      let vertical = this.isVertical();

      this._scaleFactor = scaleFactor;

      let flags = {
        top: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 1,
          centerY: 0,
        },
        bottom: {
          edgeX: 0,
          edgeY: 1,
          offsetX: 0,
          offsetY: -1,
          centerX: 1,
          centerY: 0,
        },
        left: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
        right: {
          edgeX: 1,
          edgeY: 0,
          offsetX: -1,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
      };
      let f = flags[this._position];

      let width = 1200;
      let height = 140;
      let dock_size_limit = 1;
      let animation_spread = this.extension.animation_spread;
      let animation_magnify = this.extension.animation_magnify;

      let iconMargins = 0;
      let iconStyle = '';
      if (this.extension.icon_spacing > 0) {
        let margin = 8 * this.extension.icon_spacing;
        if (vertical) {
          iconStyle = `margin-top: ${margin}px; margin-bottom: ${margin}px;`;
        } else {
          iconStyle = `margin-left: ${margin}px; margin-right: ${margin}px;`;
        }
        iconMargins = margin * 2 * this._icons.length;
      }

      let iconSize = this._preferredIconSize();
      let iconSizeSpaced = iconSize + 2 + 8 * animation_spread;

      let projectedWidth =
        iconSize +
        iconSizeSpaced * (this._icons.length > 3 ? this._icons.length : 3);
      projectedWidth += iconMargins;

      let scaleDown = 1.0;
      let limit = vertical ? 0.96 : 0.98;

      let maxWidth = (vertical ? m.height : m.width) * limit;

      if (projectedWidth * scaleFactor > maxWidth * 0.98) {
        scaleDown = (maxWidth - iconSize / 2) / (projectedWidth * scaleFactor);
      }

      iconSize *= scaleDown;
      iconSizeSpaced *= scaleDown;
      projectedWidth *= scaleDown;
      this._projectedWidth = projectedWidth;

      this._edge_distance =
        (this.extension.edge_distance || 0) * 20 * scaleFactor;

      if (this.extension.panel_mode) {
        this._edge_distance = 0;
      }

      this._icons.forEach((icon) => {
        icon.width = Math.floor(iconSizeSpaced * scaleFactor);
        icon.height = Math.floor(iconSizeSpaced * scaleFactor);
        if (icon.style != iconStyle) {
          icon.style = iconStyle;
        }
      });

      width = this._projectedWidth * scaleFactor;
      height = iconSizeSpaced * 1.5 * scaleFactor;

      this.width = vertical ? height : width;
      this.height = vertical ? width : height;

      if (this.animated) {
        let adjust = 3.0;
        this.width *= vertical ? adjust : 1;
        this.height *= !vertical ? adjust : 1;
        this.width += !vertical * iconSizeSpaced * adjust * scaleFactor;
        this.height += vertical * iconSizeSpaced * adjust * scaleFactor;

        if (this.width > m.width) {
          this.width = m.width;
        }
        if (this.height > m.height) {
          this.height = m.height;
        }
      }

      // console.log(`${width} ${height}`);

      // reposition the dash
      this.dash.last_child.layout_manager.orientation = vertical;
      this.dash._box.layout_manager.orientation = vertical;
      if (this._extraIcons) {
        this._extraIcons.layout_manager.orientation = vertical;
      }

      this.x =
        m.x +
        m.width * f.edgeX +
        this.width * f.offsetX +
        (m.width / 2 - this.width / 2) * f.centerX;

      this.y =
        m.y +
        m.height * f.edgeY +
        this.height * f.offsetY +
        (m.height / 2 - this.height / 2) * f.centerY;

      // todo vertical
      if (this.extension.panel_mode) {
        if (vertical) {
          this.y = m.y;
          this.height = m.height;
        } else {
          this.x = m.x;
          this.width = m.width;
        }
      }

      // center the dash
      this.dash.x = this.width / 2 - this.dash.width / 2;
      this.dash.y = this.height / 2 - this.dash.height / 2;

      // hug the edge
      if (vertical) {
        this.dash.x = this.width * f.edgeX + this.dash.width * f.offsetX;
      } else {
        this.dash.y = this.height * f.edgeY + this.dash.height * f.offsetY;
      }

      this._iconSizeScaledDown = iconSize;
      this._scaledDown = scaleDown;

      // resize dash icons
      // console.log(this.dash.height);
      // console.log('---------------');

      // this.acquirePanel();
    }

    acquirePanel() {
      // panel
      if (!this.panel && Main.panel) {
        this.panel = Main.panel;
        this.panelLeft = this.panel._leftBox;
        this.panelRight = this.panel._rightBox;
        this.panelCenter = this.panel._centerBox;
      }

      if (!this.panel) return;

      // W: breakable
      let reparent = [this.panelLeft, this.panelRight, this.panelCenter];
      reparent.forEach((c) => {
        if (c.get_parent()) {
          c._parent = c.get_parent();
          c.get_parent().remove_child(c);
        }
        this._background.add_child(c);
      });
      this.panel.visible = false;

      this.panelLeft.height = this.panel.height - 8;
      this.panelLeft.x = 20;
      this.panelLeft.y =
        this.height - this.struts.height + this.panelLeft.height / 2;
      this.panelRight.track_hover = false;

      this.panelRight.height = this.panel.height - 8;
      this.panelRight.x = this.struts.width - this.panelRight.width - 20;
      this.panelRight.y = this.panelRight.height / 2;

      this.panelCenter.height = this.panel.height - 8;
      this.panelCenter.x = this.struts.width - this.panelCenter.width - 20;
      this.panelCenter.y = this.panelRight.y + this.panelRight.height;
    }

    restorePanel() {
      if (!this.panel) return;

      // W: breakable
      let reparent = [this.panelLeft, this.panelRight, this.panelCenter];
      reparent.forEach((c) => {
        if (c.get_parent()) {
          c.get_parent().remove_child(c);
        }
        c._parent.add_child(c);
      });
      this.panel.visible = true;
    }

    preview() {
      this._preview = PREVIEW_FRAMES;
    }

    animate() {
      if (this._preview) {
        let p = this._get_position(this.dash);
        p[0] += this.dash.width / 2;
        p[1] += this.dash.height / 2;
        this.simulated_pointer = p;
        this._preview--;
      }
      this.animator.animate();
      this.simulated_pointer = null;
    }

    _get_position(obj) {
      return [...obj.get_transformed_position()];
    }

    _get_distance_sqr(pos1, pos2) {
      let a = pos1[0] - pos2[0];
      let b = pos1[1] - pos2[1];
      return a * a + b * b;
    }

    _get_distance(pos1, pos2) {
      return Math.sqrt(this._get_distance_sqr(pos1, pos2));
    }

    _isOverlapRect(r1, r2) {
      let [r1x, r1y, r1w, r1h] = r1;
      let [r2x, r2y, r2w, r2h] = r2;
      // are the sides of one rectangle touching the other?
      if (
        r1x + r1w >= r2x && // r1 right edge past r2 left
        r1x <= r2x + r2w && // r1 left edge past r2 right
        r1y + r1h >= r2y && // r1 top edge past r2 bottom
        r1y <= r2y + r2h
      ) {
        // r1 bottom edge past r2 top
        return true;
      }
      return false;
    }

    _isInRect(r, p, pad) {
      let [x1, y1, w, h] = r;
      let x2 = x1 + w;
      let y2 = y1 + h;
      let [px, py] = p;
      return px + pad >= x1 && px - pad < x2 && py + pad >= y1 && py - pad < y2;
    }

    _isWithinDash(p) {
      if (this._hidden) {
        return false;
      }
      if (this._hoveredIcon) return true;
      let xy = this._get_position(this.struts);
      let wh = [this.struts.width, this.struts.height];
      if (this._isInRect([xy[0], xy[1], wh[0], wh[1]], p, 20)) {
        return true;
      }
      return false;
    }

    _beginAnimation(caller) {
      if (this.extension.debug_visual) {
        this.add_style_class_name('hi');
        this.struts.add_style_class_name('hi');
        this.dwell.add_style_class_name('hi');
      }
      // if (caller) {
      //   console.log(`animation triggered by ${caller}`);
      // }
      if (this.extension._hiTimer && this.debounceEndSeq) {
        this.extension._loTimer.runDebounced(this.debounceEndSeq);
        // this.extension._loTimer.cancel(this.debounceEndSeq);
      }

      this.animationInterval = this.extension.animationInterval;
      if (this.extension._hiTimer) {
        if (!this._animationSeq) {
          this._animationSeq = this.extension._hiTimer.runLoop(
            () => {
              this.animate();
            },
            this.animationInterval,
            'animationTimer'
          );
        } else {
          this.extension._hiTimer.runLoop(this._animationSeq);
        }
      }
    }

    _endAnimation() {
      if (this.extension.debug_visual) {
        this.remove_style_class_name('hi');
        this.struts.remove_style_class_name('hi');
        this.dwell.remove_style_class_name('hi');
      }
      if (this.extension._hiTimer) {
        this.extension._hiTimer.cancel(this._animationSeq);
        this.extension._loTimer.cancel(this.debounceEndSeq);
      }
      this.autohider._debounceCheckHide();
      this._icons = null;
    }

    _debounceEndAnimation() {
      if (this.extension._loTimer) {
        if (!this.debounceEndSeq) {
          this.debounceEndSeq = this.extension._loTimer.runDebounced(
            () => {
              this._endAnimation();
            },
            ANIM_DEBOUNCE_END_DELAY + this.animationInterval,
            'debounceEndAnimation'
          );
        } else {
          this.extension._loTimer.runDebounced(this.debounceEndSeq);
        }
      }
    }

    cancelAnimations() {
      this.extension._hiTimer.cancel(this._animationSeq);
      this._animationSeq = null;
      this.extension._hiTimer.cancel(this.autohider._animationSeq);
      this.autohider._animationSeq = null;
    }

    _maybeMinimizeOrMaximize(app) {
      let windows = app.get_windows();
      if (!windows.length) return;

      let event = Clutter.get_current_event();
      let modifiers = event ? event.get_state() : 0;
      let pressed = event.type() == Clutter.EventType.BUTTON_PRESS;
      let button1 = (modifiers & Clutter.ModifierType.BUTTON1_MASK) != 0;
      let button2 = (modifiers & Clutter.ModifierType.BUTTON2_MASK) != 0;
      let button3 = (modifiers & Clutter.ModifierType.BUTTON3_MASK) != 0;
      let shift = (modifiers & Clutter.ModifierType.SHIFT_MASK) != 0;
      let isMiddleButton = button3; // middle?
      let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
      let openNewWindow =
        app.can_open_new_window() &&
        app.state == Shell.AppState.RUNNING &&
        (isCtrlPressed || isMiddleButton);
      if (openNewWindow) return;

      let workspaceManager = global.workspace_manager;
      let activeWs = workspaceManager.get_active_workspace();
      let focusedWindow = null;

      windows.forEach((w) => {
        if (w.has_focus()) {
          focusedWindow = w;
        }
      });

      // delay - allow dash to actually call 'activate' first
      if (focusedWindow) {
        this.extension._hiTimer.runOnce(() => {
          if (shift) {
            if (focusedWindow.get_maximized() == 3) {
              focusedWindow.unmaximize(3);
            } else {
              focusedWindow.maximize(3);
            }
          } else {
            windows.forEach((w) => {
              w.minimize();
            });
          }
        }, 50);
      } else {
        this.extension._hiTimer.runOnce(() => {
          windows.forEach((w) => {
            if (w.is_hidden()) {
              w.unminimize();
              if (w.has_focus()) {
                w.raise();
              }
            }
          });
        }, 50);
      }
    }

    _maybeBounce(container) {
      if (!this.extension.open_app_animation) {
        return;
      }
      if (
        !container.child.app ||
        (container.child.app && !container.child.app.get_n_windows())
      ) {
        if (container.child) {
          this.animator.bounceIcon(container.child);
        }
      }
    }

    _onScrollEvent(obj, evt) {
      this._lastScrollEvent = evt;
      let pointer = global.get_pointer();
      if (this._nearestIcon) {
        if (this._scrollCounter < -2 || this._scrollCounter > 2)
          this._scrollCounter = 0;

        let icon = this._nearestIcon;

        // add scrollwheel vs touchpad differentiation
        let multiplier = 1;
        if (
          evt.get_source_device().get_device_type() == 5 ||
          evt.get_source_device().get_device_name().includes('Touch')
        ) {
          multiplier = 1;
        } else {
          multiplier = 5;
        }

        // console.log(this._scrollCounter);

        let SCROLL_RESOLUTION =
          MIN_SCROLL_RESOLUTION +
          MAX_SCROLL_RESOLUTION -
          (MAX_SCROLL_RESOLUTION * this.extension.scroll_sensitivity || 0);
        if (icon._appwell && icon._appwell.app) {
          this._lastScrollObject = icon;
          let direction = evt.get_scroll_direction();
          switch (direction) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
              this._scrollCounter += (1 / SCROLL_RESOLUTION) * multiplier;
              break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
              this._scrollCounter -= (1 / SCROLL_RESOLUTION) * multiplier;
              break;
          }
          this._cycleWindows(icon._appwell.app, evt);
        }
      }
    }

    _lockCycle() {
      if (this._lockedCycle) return;
      this._lockedCycle = true;
      this.extension._hiTimer.runOnce(() => {
        this._lockedCycle = false;
      }, 500);
    }

    _cycleWindows(app, evt) {
      if (this._lockedCycle) {
        this._scrollCounter = 0;
        return false;
      }

      let focusId = 0;
      let workspaceManager = global.workspace_manager;
      let activeWs = workspaceManager.get_active_workspace();

      let windows = app.get_windows();

      if (evt.modifier_state & Clutter.ModifierType.CONTROL_MASK) {
        windows = windows.filter((w) => {
          return activeWs == w.get_workspace();
        });
      }

      let nw = windows.length;
      windows.sort((w1, w2) => {
        return w1.get_id() > w2.get_id() ? -1 : 1;
      });

      if (nw > 1) {
        for (let i = 0; i < nw; i++) {
          if (windows[i].has_focus()) {
            focusId = i;
          }
          if (windows[i].is_hidden()) {
            windows[i].unminimize();
            windows[i].raise();
          }
        }

        let current_focus = focusId;

        if (this._scrollCounter < -1 || this._scrollCounter > 1) {
          focusId += Math.round(this._scrollCounter);
          if (focusId < 0) {
            focusId = nw - 1;
          }
          if (focusId >= nw) {
            focusId = 0;
          }
          this._scrollCounter = 0;
        }

        if (current_focus == focusId) return;
      } else if (nw == 1) {
        if (windows[0].is_hidden()) {
          windows[0].unminimize();
          windows[0].raise();
        }
      }

      let window = windows[focusId];
      if (window) {
        this._lockCycle();
        if (activeWs == window.get_workspace()) {
          window.raise();
          window.focus(0);
        } else {
          activeWs.activate_with_focus(window, global.get_current_time());
        }
      }
    }
  }
);


//-----------------------------
// ./drawing.js
//-----------------------------

//'use strict';

//import PangoCairo from 'gi://PangoCairo';
//import Pango from 'gi://Pango';
//import Clutter from 'gi://Clutter';

function draw_rotated_line(ctx, color, width, angle, len, offset) {
  offset = offset || 0;
  ctx.save();
  ctx.rotate(angle);
  set_color(ctx, color, 1);
  ctx.setLineWidth(width);
  ctx.moveTo(0, offset);
  ctx.lineTo(0, len);
  ctx.stroke();
  ctx.restore();
}

function draw_line(ctx, color, width, x, y, x2, y2) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.setLineWidth(width);
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function draw_circle(ctx, color, x, y, diameter, line_width) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.arc(x, y, diameter / 2 - diameter / 20, 0, 2 * Math.PI);
  ctx.setLineWidth(line_width || 0);
  if (line_width > 0) {
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.restore();
}

function draw_rounded_rect(
  ctx,
  color,
  x,
  y,
  h_size,
  v_size,
  line_width,
  border_radius
) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.translate(x, y);
  ctx.setLineWidth(line_width || 0);
  ctx.moveTo(border_radius, 0);
  ctx.lineTo(h_size - border_radius, 0);
  // ctx.lineTo(h_size, border_radius);
  ctx.curveTo(h_size - border_radius, 0, h_size, 0, h_size, border_radius);
  ctx.lineTo(h_size, v_size - border_radius);
  // ctx.lineTo(h_size - border_radius, h_size);
  ctx.curveTo(
    h_size,
    v_size - border_radius,
    h_size,
    v_size,
    h_size - border_radius,
    v_size
  );
  ctx.lineTo(border_radius, v_size);
  // ctx.lineTo(0, h_size - border_radius);
  ctx.curveTo(border_radius, v_size, 0, v_size, 0, v_size - border_radius);
  ctx.lineTo(0, border_radius);
  ctx.curveTo(0, border_radius, 0, 0, border_radius, 0);
  if (line_width == 0) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function draw_rect(ctx, color, x, y, h_size, v_size, line_width) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.translate(x, y);
  ctx.setLineWidth(line_width || 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(h_size, 0);
  ctx.lineTo(h_size, v_size);
  ctx.lineTo(0, v_size);
  ctx.lineTo(0, 0);
  if (line_width == 0) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function draw_text(ctx, showtext, font = 'DejaVuSans 42') {
  ctx.save();
  let pl = PangoCairo.create_layout(ctx);
  pl.set_text(showtext, -1);
  pl.set_font_description(Pango.FontDescription.from_string(font));
  PangoCairo.update_layout(ctx, pl);
  let [w, h] = pl.get_pixel_size();
  ctx.relMoveTo(-w / 2, -h / 2);
  PangoCairo.show_layout(ctx, pl);
  ctx.relMoveTo(w / 2, 0);
  ctx.restore();
  return [w, h];
}

function set_color(ctx, clr, alpha) {
  if (typeof clr === 'string') {
    const [, cc] = Clutter.Color.from_string(clr);
    ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
  } else {
    if (clr.red) {
      ctx.setSourceRGBA(clr.red, clr.green, clr.blue, alpha);
    } else {
      ctx.setSourceRGBA(clr[0], clr[1], clr[2], alpha);
    }
  }
}

function set_color_rgba(ctx, red, green, blue, alpha) {
  ctx.setSourceRGBA(red, green, blue, alpha);
}

const Drawing = {
  set_color,
  set_color_rgba,
  draw_rotated_line,
  draw_line,
  draw_circle,
  draw_rect,
  draw_rounded_rect,
  draw_text,
};


//-----------------------------
// ./style.js
//-----------------------------

//'use strict';

//import Gio from 'gi://Gio';
//import St from 'gi://St';

const CustomStylesPath = '/tmp';

const Style = class {
  constructor() {
    this.styles = {};
    this.style_contents = {};
  }

  unloadAll() {
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx.get_theme();
    Object.keys(this.styles).forEach((k) => {
      let fn = this.styles[k];
      theme.unload_stylesheet(fn);
    });
  }

  build(name, style_array) {
    let fn = this.styles[name];
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx.get_theme();

    let content = '';
    style_array.forEach((k) => {
      content = `${content}\n${k}`;
    });

    if (this.style_contents[name] === content) {
      // log('skip regeneration');
      return;
    }

    if (fn) {
      theme.unload_stylesheet(fn);
    } else {
      fn = Gio.File.new_for_path(`${CustomStylesPath}/${name}.css`);
      this.styles[name] = fn;
    }

    this.style_contents[name] = content;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );

    theme.load_stylesheet(fn);

    // log(content);
  }

  rgba(color) {
    let clr = color || [1, 1, 1, 1];
    let res = clr.map((r) => Math.floor(255 * r));
    res[3] = clr[3].toFixed(1);
    return res.join(',');
  }
};


//-----------------------------
// ./preferences/keys.js
//-----------------------------

//'use strict';

// const ExtensionUtils = imports.misc.extensionUtils;
// const Me = ExtensionUtils.getCurrentExtension();
// const { PrefKeys } = Me.imports.preferences.prefKeys;

//import { PrefKeys } from './prefKeys.js';

let schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

const SettingsKeys = () => {
  let settingsKeys = new PrefKeys();
  settingsKeys.setKeys({
    // debug: {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    // 'debug-log': {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    'experimental-features': {
      default_value: false,
      widget_type: 'switch',
    },
    'debug-visual': {
      default_value: false,
      widget_type: 'switch',
    },
    'shrink-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'icon-size': {
      default_value: 0,
      widget_type: 'scale',
    },
    'animate-icons-unmute': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'animate-icons': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'open-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'lamp-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'autohide-dash': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'autohide-dodge': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'pressure-sense': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-down' },
    },
    'autohide-speed': {
      default_value: 0.5,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'customize-topbar': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'topbar-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'topbar-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'topbar-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'topbar-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'customize-label': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'label-border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'label-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'label-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'label-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'label-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'favorites-only': {
      default_value: false,
      widget_type: 'switch',
    },
    'apps-icon': {
      default_value: true,
      widget_type: 'switch',
    },
    'apps-icon-front': {
      default_value: false,
      widget_type: 'switch',
    },
    'trash-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'downloads-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'documents-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'max-recent-items': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [5, 10, 15, 20, 25] },
    },
    'mounted-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'calendar-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'calendar-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'peek-hidden-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'animation-fps': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { pointer: 'slide-through', values: [0, 1, 2] },
    },
    'animation-bounce': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-magnify': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-spread': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-rise': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'icon-shadow': {
      default_value: true,
      widget_type: 'switch',
    },
    'edge-distance': {
      default_value: 0,
      widget_type: 'scale',
      test: { values: [-1, 0, 1] },
    },
    'border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'separator-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'separator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'dock-padding': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'icon-spacing': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'panel-mode': {
      default_value: false,
      widget_type: 'switch',
    },
    'running-indicator-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: [
        'default',
        'dots',
        'dot',
        'dashes',
        'dash',
        'squares',
        'square',
        'segmented',
        'solid',
        'triangles',
        'triangle',
        'diamonds',
        'diamond',
        'binary',
      ],
      test: { values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    },
    'running-indicator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'notification-badge-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3, 4, 5] },
    },
    'notification-badge-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'preferred-monitor': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'multi-monitor-preference': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'dock-location': {
      default_value: 0,
      widget_type: 'dropdown',
      // options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3] },
    },
    'icon-resolution': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
    },
    'icon-effect': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
      themed: true,
    },
    'icon-effect-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'msg-to-ext': {
      default_value: '',
      widget_type: 'string',
    },
    'animation-type': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'pressure-sense-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
    },
    'scroll-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
    },
    'drawing-accent-color': {
      default_value: [1.0, 0, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-secondary-color': {
      default_value: [1.0, 0.6, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-color': {
      default_value: [0.2, 0.2, 0.2, 1.0],
      widget_type: 'color',
    },
    'drawing-light-color': {
      default_value: [1.0, 1.0, 1.0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-foreground': {
      default_value: [0.8, 0.8, 0.8, 1.0],
      widget_type: 'color',
    },
    'drawing-light-foreground': {
      default_value: [0.3, 0.3, 0.3, 1.0],
      widget_type: 'color',
    },
  });

  return settingsKeys;
};


//-----------------------------
// ./preferences/prefKeys.js
//-----------------------------

// const Gdk = imports.gi.Gdk;
// const GLib = imports.gi.GLib;

//import Gdk from 'gi://Gdk';
//import GLib from 'gi://GLib';

let PrefKeys = class {
  constructor() {
    this._keys = {};
  }

  setKeys(keys) {
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      this.setKey(
        name,
        key.default_value,
        key.widget_type,
        key.key_maps,
        key.test,
        key.callback,
        key.options,
        key.themed
      );
    });
  }

  setKey(
    name,
    default_value,
    widget_type,
    maps,
    test,
    callback,
    options,
    themed
  ) {
    this._keys[name] = {
      name,
      default_value,
      widget_type,
      value: default_value,
      maps: maps,
      test: test,
      callback,
      options,
      object: null,
      themed: themed || false,
    };
  }

  setValue(name, value) {
    this._keys[name].value = value;

    let settings = this._settings;
    let keys = this._keys;
    if (settings) {
      let key = keys[name];
      switch (key.widget_type) {
        case 'switch': {
          settings.set_boolean(name, value);
          break;
        }
        case 'dropdown': {
          settings.set_int(name, value);
          break;
        }
        case 'scale': {
          settings.set_double(name, value);
          break;
        }
        case 'color': {
          settings.set_value(name, new GLib.Variant('(dddd)', value));
          break;
        }
      }
    }

    if (this._keys[name].callback) {
      this._keys[name].callback(this._keys[name].value);
    }
  }

  getKey(name) {
    return this._keys[name];
  }

  getValue(name) {
    let value = this._keys[name].value;
    return value;
  }

  reset(name) {
    this.setValue(name, this._keys[name].default_value);
  }

  resetAll() {
    Object.keys(this._keys).forEach((k) => {
      this.reset(k);
    });
  }

  keys() {
    return this._keys;
  }

  connectSettings(settings, callback) {
    this._settingsListeners = [];

    this._settings = settings;
    let builder = this._builder;
    let self = this;
    let keys = this._keys;

    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      key.object = builder ? builder.get_object(key.name) : null;
      switch (key.widget_type) {
        case 'json_array': {
          key.value = [];
          try {
            key.value = JSON.parse(settings.get_string(name));
          } catch (err) {
            // fail silently
          }
          break;
        }
        case 'switch': {
          key.value = settings.get_boolean(name);
          if (key.object) key.object.set_active(key.value);
          break;
        }
        case 'dropdown': {
          key.value = settings.get_int(name);
          try {
            if (key.object) key.object.set_selected(key.value);
          } catch (err) {
            //
          }
          break;
        }
        case 'scale': {
          key.value = settings.get_double(name);
          if (key.object) key.object.set_value(key.value);
          break;
        }
        case 'color': {
          key.value = settings.get_value(name).deepUnpack();
          try {
            if (key.object) {
              key.object.set_rgba(
                new Gdk.RGBA({
                  red: key.value[0],
                  green: key.value[1],
                  blue: key.value[2],
                  alpha: key.value[3],
                })
              );
            }
          } catch (err) {
            //
          }
          break;
        }
      }

      this._settingsListeners.push(
        settings.connect(`changed::${name}`, () => {
          let key = keys[name];
          switch (key.widget_type) {
            case 'json_array': {
              key.value = [];
              try {
                key.value = JSON.parse(settings.get_string(name));
              } catch (err) {
                // fail silently
              }
              break;
            }
            case 'switch': {
              key.value = settings.get_boolean(name);
              break;
            }
            case 'dropdown': {
              key.value = settings.get_int(name);
              break;
            }
            case 'scale': {
              key.value = settings.get_double(name);
              break;
            }
            case 'color': {
              key.value = settings.get_value(name).deepUnpack();
              if (key.value.length != 4) {
                key.value = [1, 1, 1, 0];
              }
              break;
            }
            case 'string': {
              key.value = settings.get_string(name);
              break;
            }
          }
          if (callback) callback(name, key.value);
        })
      );
    });
  }

  disconnectSettings() {
    this._settingsListeners.forEach((id) => {
      this._settings.disconnect(id);
    });
    this._settingsListeners = [];
  }

  connectBuilder(builder) {
    this._builderListeners = [];

    this._builder = builder;
    let self = this;
    let keys = this._keys;
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      let signal_id = null;
      key.object = builder.get_object(key.name);
      if (!key.object) {
        return;
      }

      switch (key.widget_type) {
        case 'json_array': {
          // unimplemented
          break;
        }
        case 'switch': {
          key.object.set_active(key.default_value);
          signal_id = key.object.connect('state-set', (w) => {
            let value = w.get_active();
            self.setValue(name, value);
            if (key.callback) {
              key.callback(value);
            }
          });
          break;
        }
        case 'dropdown': {
          signal_id = key.object.connect('notify::selected-item', (w) => {
            let index = w.get_selected();
            let value = key.maps && index in key.maps ? key.maps[index] : index;
            self.setValue(name, value);
          });
          break;
        }
        case 'scale': {
          signal_id = key.object.connect('value-changed', (w) => {
            let value = w.get_value();
            self.setValue(name, value);
          });
          break;
        }
        case 'color': {
          signal_id = key.object.connect('color-set', (w) => {
            let rgba = w.get_rgba();
            let value = [rgba.red, rgba.green, rgba.blue, rgba.alpha];
            self.setValue(name, value);
          });
          break;
        }
        case 'button': {
          signal_id = key.object.connect('clicked', (w) => {
            if (key.callback) {
              key.callback();
            }
          });
          break;
        }
      }

      // when do we clean this up?
      this._builderListeners.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
};


//-----------------------------
// ./effects/tint_effect.js
//-----------------------------

// Adapted from from Blur-My-Shell

//'use strict';

//import Shell from 'gi://Shell';
//import GLib from 'gi://GLib';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';

const getTintShaderSource = (extensionDir) => {
  const SHADER_PATH = GLib.build_filenamev([
    extensionDir,
    'effects',
    'tint_effect.glsl',
  ]);

  try {
    return Shell.get_file_contents_utf8_sync(SHADER_PATH);
  } catch (e) {
    log(`[d2dl] error loading shader from ${SHADER_PATH}: ${e}`);
    return null;
  }
};

/// New Clutter Shader Effect that simply mixes a color in, the class applies
/// the GLSL shader programmed into vfunc_get_static_shader_source and applies
/// it to an Actor.
///
/// Clutter Shader Source Code:
/// https://github.com/GNOME/clutter/blob/master/clutter/clutter-shader-effect.c
///
/// GJS Doc:
/// https://gjs-docs.gnome.org/clutter10~10_api/clutter.shadereffect
const TintEffect = GObject.registerClass(
  {},
  class TintEffect extends Clutter.ShaderEffect {
    _init(params) {
      this._red = null;
      this._green = null;
      this._blue = null;
      this._blend = null;

      this._static = true;

      // initialize without color as a parameter

      let _color = params.color;
      delete params.color;

      super._init(params);

      // set shader color

      if (_color) this.color = _color;
    }

    preload(path) {
      // set shader source
      this._source = getTintShaderSource(path);
      if (this._source) this.set_shader_source(this._source);

      this.update_enabled();
    }

    get red() {
      return this._red;
    }

    set red(value) {
      if (this._red !== value) {
        this._red = value;

        this.set_uniform_value('red', parseFloat(this._red - 1e-6));
      }
    }

    get green() {
      return this._green;
    }

    set green(value) {
      if (this._green !== value) {
        this._green = value;

        this.set_uniform_value('green', parseFloat(this._green - 1e-6));
      }
    }

    get blue() {
      return this._blue;
    }

    set blue(value) {
      if (this._blue !== value) {
        this._blue = value;

        this.set_uniform_value('blue', parseFloat(this._blue - 1e-6));
      }
    }

    get blend() {
      return this._blend;
    }

    set blend(value) {
      if (value > 0.5) {
        value *= 0.75;
        if (value < 0.5) {
          value = 0.5;
        }
      }
      if (this._blend !== value) {
        this._blend = value;

        this.set_uniform_value('blend', parseFloat(this._blend - 1e-6));
      }
      this.update_enabled();
    }

    set color(rgba) {
      let [r, g, b, a] = rgba;
      this.red = r;
      this.green = g;
      this.blue = b;
      this.blend = a;
    }

    get color() {
      return [this.red, this.green, this.blue, this.blend];
    }

    /// False set function, only cares about the color. Too hard to change.
    set(params) {
      this.color = params.color;
    }

    update_enabled() {
      this.set_enabled(this.blend > 0 && this._static);
    }

    vfunc_paint_target(paint_node = null, paint_context = null) {
      this.set_uniform_value('tex', 0);

      if (paint_node && paint_context)
        super.vfunc_paint_target(paint_node, paint_context);
      else if (paint_node) super.vfunc_paint_target(paint_node);
      else super.vfunc_paint_target();
    }
  }
);


//-----------------------------
// ./effects/color_effect.js
//-----------------------------

// Adapted from from Blur-My-Shell

//'use strict';

//import Shell from 'gi://Shell';
//import GLib from 'gi://GLib';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';

const getColorEffectShaderSource = (extensionDir) => {
  const SHADER_PATH = GLib.build_filenamev([
    extensionDir,
    'effects',
    'color_effect.glsl',
  ]);

  try {
    return Shell.get_file_contents_utf8_sync(SHADER_PATH);
  } catch (e) {
    log(`[d2dl] error loading shader from ${SHADER_PATH}: ${e}`);
    return null;
  }
};

/// New Clutter Shader Effect that simply mixes a color in, the class applies
/// the GLSL shader programmed into vfunc_get_static_shader_source and applies
/// it to an Actor.
///
/// Clutter Shader Source Code:
/// https://github.com/GNOME/clutter/blob/master/clutter/clutter-shader-effect.c
///
/// GJS Doc:
/// https://gjs-docs.gnome.org/clutter10~10_api/clutter.shadereffect
const ColorEffect = GObject.registerClass(
  {},
  class ColorShader extends Clutter.ShaderEffect {
    _init(params) {
      this._red = null;
      this._green = null;
      this._blue = null;
      this._blend = null;

      this._static = true;

      // initialize without color as a parameter

      let _color = params.color;
      delete params.color;

      super._init(params);

      // set shader color
      if (_color) this.color = _color;
    }

    preload(path) {
      // set shader source
      this._source = getColorEffectShaderSource(path);
      if (this._source) this.set_shader_source(this._source);

      this.update_enabled();
    }

    get red() {
      return this._red;
    }

    set red(value) {
      if (this._red !== value) {
        this._red = value;

        this.set_uniform_value('red', parseFloat(this._red - 1e-6));
      }
    }

    get green() {
      return this._green;
    }

    set green(value) {
      if (this._green !== value) {
        this._green = value;

        this.set_uniform_value('green', parseFloat(this._green - 1e-6));
      }
    }

    get blue() {
      return this._blue;
    }

    set blue(value) {
      if (this._blue !== value) {
        this._blue = value;

        this.set_uniform_value('blue', parseFloat(this._blue - 1e-6));
      }
    }

    get blend() {
      return this._blend;
    }

    set blend(value) {
      if (this._blend !== value) {
        this._blend = value;

        this.set_uniform_value('blend', parseFloat(this._blend - 1e-6));
      }
      this.update_enabled();
    }

    set color(rgba) {
      let [r, g, b, a] = rgba;
      this.red = r;
      this.green = g;
      this.blue = b;
      this.blend = a;
    }

    get color() {
      return [this.red, this.green, this.blue, this.blend];
    }

    /// False set function, only cares about the color. Too hard to change.
    set(params) {
      this.color = params.color;
    }

    update_enabled() {
      this.set_enabled(this.blend > 0 && this._static);
    }

    vfunc_paint_target(paint_node = null, paint_context = null) {
      this.set_uniform_value('tex', 0);

      if (paint_node && paint_context)
        super.vfunc_paint_target(paint_node, paint_context);
      else if (paint_node) super.vfunc_paint_target(paint_node);
      else super.vfunc_paint_target();
    }
  }
);


//-----------------------------
// ./effects/easing.js
//-----------------------------

//'use strict';

/* PennerEasing */
const Linear = {
  easeNone: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeIn: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeInOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
};

const Bounce = {
  easeIn: (t, b, c, d) => {
    return c - Bounce.easeOut(d - t, 0, c, d) + b;
  },

  easeOut: (t, b, c, d) => {
    if ((t /= d) < 1 / 2.75) {
      return c * (7.5625 * t * t) + b;
    } else if (t < 2 / 2.75) {
      let postFix = (t -= 1.5 / 2.75);
      return c * (7.5625 * postFix * t + 0.75) + b;
    } else if (t < 2.5 / 2.75) {
      let postFix = (t -= 2.25 / 2.75);
      return c * (7.5625 * postFix * t + 0.9375) + b;
    } else {
      let postFix = (t -= 2.625 / 2.75);
      return c * (7.5625 * postFix * t + 0.984375) + b;
    }
  },

  easeInOut: (t, b, c, d) => {
    if (t < d / 2) return Bounce.easeIn(t * 2, 0, c, d) * 0.5 + b;
    else return Bounce.easeOut(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
  },
};

var Back = {
  easeIn: (t, b, c, d) => {
    let s = 1.70158;
    let postFix = (t /= d);
    return c * postFix * t * ((s + 1) * t - s) + b;
  },

  easeOut: (t, b, c, d) => {
    let s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },

  easeInOut: (t, b, c, d) => {
    let s = 1.70158;
    if ((t /= d / 2) < 1)
      return (c / 2) * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
    let postFix = (t -= 2);
    return (c / 2) * (postFix * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
  },
};


//-----------------------------
// ./effects/monochrome_effect.js
//-----------------------------

// Adapted from from Blur-My-Shell
// Adapted from https://gist.github.com/yiwenl/1c2ce935e66b82c7df5f

//'use strict';

//import Shell from 'gi://Shell';
//import GLib from 'gi://GLib';
//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';

const getMonochromeShaderSource = (extensionDir) => {
  const SHADER_PATH = GLib.build_filenamev([
    extensionDir,
    'effects',
    'monochrome_effect.glsl',
  ]);

  try {
    return Shell.get_file_contents_utf8_sync(SHADER_PATH);
  } catch (e) {
    log(`[d2dl] error loading shader from ${SHADER_PATH}: ${e}`);
    return null;
  }
};

/// New Clutter Shader Effect that simply mixes a color in, the class applies
/// the GLSL shader programmed into vfunc_get_static_shader_source and applies
/// it to an Actor.
///
/// Clutter Shader Source Code:
/// https://github.com/GNOME/clutter/blob/master/clutter/clutter-shader-effect.c
///
/// GJS Doc:
/// https://gjs-docs.gnome.org/clutter10~10_api/clutter.shadereffect
const MonochromeEffect = GObject.registerClass(
  {},
  class MonochromeEffect extends Clutter.ShaderEffect {
    _init(params) {
      this._red = null;
      this._green = null;
      this._blue = null;
      this._blend = null;

      this._static = true;

      // initialize without color as a parameter

      let _color = params.color;
      delete params.color;

      super._init(params);

      // set shader color
      if (_color) this.color = _color;
    }

    preload(path) {
      // set shader source
      this._source = getMonochromeShaderSource(path);
      if (this._source) this.set_shader_source(this._source);

      this.update_enabled();
    }

    get red() {
      return this._red;
    }

    set red(value) {
      if (this._red !== value) {
        this._red = value;

        this.set_uniform_value('red', parseFloat(this._red - 1e-6));
      }
    }

    get green() {
      return this._green;
    }

    set green(value) {
      if (this._green !== value) {
        this._green = value;

        this.set_uniform_value('green', parseFloat(this._green - 1e-6));
      }
    }

    get blue() {
      return this._blue;
    }

    set blue(value) {
      if (this._blue !== value) {
        this._blue = value;

        this.set_uniform_value('blue', parseFloat(this._blue - 1e-6));
      }
    }

    get blend() {
      return this._blend;
    }

    set blend(value) {
      if (value > 0.5) {
        value *= 0.75;
        if (value < 0.5) {
          value = 0.5;
        }
      }
      if (this._blend !== value) {
        this._blend = value;

        this.set_uniform_value('blend', parseFloat(this._blend - 1e-6));
      }
      this.update_enabled();
    }

    set color(rgba) {
      let [r, g, b, a] = rgba;
      this.red = r;
      this.green = g;
      this.blue = b;
      this.blend = a;
    }

    get color() {
      return [this.red, this.green, this.blue, this.blend];
    }

    /// False set function, only cares about the color. Too hard to change.
    set(params) {
      this.color = params.color;
    }

    update_enabled() {
      this.set_enabled(this.blend > 0 && this._static);
    }

    vfunc_paint_target(paint_node = null, paint_context = null) {
      this.set_uniform_value('tex', 0);

      if (paint_node && paint_context)
        super.vfunc_paint_target(paint_node, paint_context);
      else if (paint_node) super.vfunc_paint_target(paint_node);
      else super.vfunc_paint_target();
    }
  }
);


//-----------------------------
// ./apps/dot.js
//-----------------------------

// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Cairo from 'gi://cairo';
//import St from 'gi://St';

//import { Drawing } from '../drawing.js';

const Dot = GObject.registerClass(
  {},
  class Dot extends St.Widget {
    _init(x, settings = {}) {
      super._init();

      let size = x || 400;

      this._canvas = new DotCanvas(settings);
      this._canvas.width = size;
      this._canvas.height = size;
      this.add_child(this._canvas);

      this.set_state = this._canvas.set_state.bind(this._canvas);
    }

    redraw() {
      this.visible = true;
      this._canvas.redraw();
    }
  }
);

const DotCanvas = GObject.registerClass(
  {},
  class DotCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init();

      this.state = {};

      this._padding = 8;
      this._barHeight = 6;
    }

    redraw() {
      this.queue_repaint();
    }

    set_state(s) {
      if (
        !this.state ||
        this.state.count != s.count ||
        this.state.color != s.color ||
        this.state.style != s.style ||
        this.state.rotate != s.rotate ||
        this.state.translate != s.translate
      ) {
        this.state = s;
        this.redraw();
      }
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();

      let size = width;

      if (!this.state || !this.state.color || !this.state.count) return;

      const dot_color = this.state.color;

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      ctx.translate(width / 2, height / 2);
      if (this.state.translate) {
        ctx.translate(
          this.state.translate[0] * width,
          this.state.translate[1]
        ) * height;
      }
      if (this.state.rotate) {
        ctx.rotate((this.state.rotate * 3.14) / 180);
      }
      ctx.translate(-width / 2, -height / 2);

      // _draw_dot...
      let func = this[`_draw_${this.state.style}`];
      if (typeof func === 'function') {
        func.bind(this)(ctx, this.state);
      }

      ctx.restore();

      ctx.$dispose();
    }

    _draw_segmented(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight;
      let width = size - this._padding * 2;
      ctx.translate(this._padding, size - height);

      let sz = width / 20;
      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = Math.ceil((width - (count - 1) * spacing) / count);
      let lineLength = width - sz * (count - 1) - spacing * (count - 1);

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_solid(ctx, state) {
      this._draw_segmented(ctx, { ...state, count: 1 });
    }

    _draw_dashes(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 2;
      let width = size - this._padding * 2;

      let sz = width / 14;
      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = Math.floor(width / 4) - spacing;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, sz);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_dash(ctx, state) {
      this._draw_dashes(ctx, { ...state, count: 1 });
    }

    _draw_squares(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 5;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = height;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_square(ctx, state) {
      this._draw_squares(ctx, { ...state, count: 1 });
    }

    _draw_triangles(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 6;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = height + 8;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.moveTo(i * dashLength + i * spacing + dashLength / 2, 0);
        ctx.lineTo(i * dashLength + i * spacing, height);
        ctx.lineTo(i * dashLength + i * spacing + dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_triangle(ctx, state) {
      this._draw_triangles(ctx, { ...state, count: 1 });
    }

    _draw_diamonds(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 10;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = height;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.moveTo(i * dashLength + i * spacing + dashLength / 2, 0);
        ctx.lineTo(i * dashLength + i * spacing, height / 2);
        ctx.lineTo(i * dashLength + i * spacing + dashLength / 2, height);
        ctx.lineTo(i * dashLength + i * spacing + dashLength, height / 2);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_diamond(ctx, state) {
      this._draw_diamonds(ctx, { ...state, count: 1 });
    }

    _draw_dots(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let radius = height;

      ctx.translate(
        Math.floor(
          (size - count * radius - (count - 1) * spacing) / 2 - radius / 2
        ),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.arc(
          (2 * i + 1) * radius + i * radius,
          -radius,
          radius,
          0,
          2 * Math.PI
        );
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_binary(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = 4;
      let n = Math.min(15, state.count);
      let binaryValue = String('0000' + (n >>> 0).toString(2)).slice(-4);

      let height = this._barHeight + 2;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 14); // separation between the dots
      let dashLength = height * 1.4;
      let radius = height * 0.9;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height - radius / 2
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        if (binaryValue[i] == '1') {
          ctx.arc(
            i * dashLength + i * spacing + dashLength / 2,
            radius / 2,
            radius,
            0,
            2 * Math.PI
          );
        } else {
          ctx.rectangle(
            i * dashLength + i * spacing,
            0,
            dashLength,
            height - 2
          );
        }
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_dot(ctx, state) {
      this._draw_dots(ctx, { ...state, count: 1 });
    }
  }
);


//-----------------------------
// ./apps/calendar.js
//-----------------------------

//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Cairo from 'gi://cairo';
//import St from 'gi://St';

//import { Drawing } from '../drawing.js';

const Calendar = GObject.registerClass(
  {},
  class Calendar extends St.Widget {
    _init(x, settings = {}) {
      super._init();

      let size = x || 400;

      this._canvas = new CalendarCanvas(settings);
      this._canvas.width = size;
      this._canvas.height = size;
      this.add_child(this._canvas);
    }

    redraw() {
      this.visible = true;
      this._canvas.redraw();
    }
  }
);

const CalendarCanvas = GObject.registerClass(
  {},
  class CalendarCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init();

      this.settings = {
        dark_color: [0.2, 0.2, 0.2, 1.0],
        light_color: [1.0, 1.0, 1.0, 1.0],
        accent_color: [1.0, 0.0, 0.0, 1.0],
        ...settings,
      };
    }

    redraw() {
      this.queue_repaint();
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();

      let size = width;

      const hd_color = 'red';
      const bg_color = 'white';
      const day_color = 'black';
      const date_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let bgSize = size * 0.7;
      let offset = size - bgSize;

      const d0 = new Date();

      Drawing.draw_rounded_rect(
        ctx,
        bg_color,
        -size / 2 + offset / 2,
        -size / 2 + offset / 2,
        bgSize,
        bgSize,
        0,
        8
      );
      Drawing.set_color(ctx, date_color, 1.0);
      ctx.moveTo(0, 12);
      Drawing.draw_text(ctx, `${d0.getDate()}`, 'DejaVuSans 36');

      let dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      Drawing.set_color(ctx, day_color, 1.0);
      ctx.moveTo(0, -22);
      Drawing.draw_text(ctx, `${dayNames[d0.getDay()]}`, 'DejaVuSans 16');

      ctx.$dispose();
    }
  }
);


//-----------------------------
// ./apps/overlay.js
//-----------------------------

// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Cairo from 'gi://cairo';

//import { Drawing } from '../drawing.js';

const DebugOverlay = GObject.registerClass(
  {},
  class D2DLDebugOverlay extends Clutter.Actor {
    _init(x, y) {
      super._init();

      this._width = x ? x : 400;
      this._height = y ? y : 400;

      this.state = {
        color: [0.8, 0.25, 0.15, 1],
        monitor: { x: 0, y: 0, width: 0, height: 0 },
      };
      this.objects = [];

      this._canvas = new Clutter.Canvas();
      this._canvas.connect('draw', this.on_draw.bind(this));
      this._canvas.invalidate();
      this._canvas.set_size(this._width, this._height);
      this.set_size(this._width, this._height);
      this.set_content(this._canvas);
      this.reactive = false;
    }

    resize(width, height) {
      if (this._width != width || this._height != height) {
        this._width = width;
        this._height = height;
        this.set_size(this._width, this._height);
        this._canvas.set_size(this._width, this._height);
        this._canvas.invalidate();
      }
    }

    redraw() {
      this._canvas.invalidate();
    }

    set_state(s) {
      this.state = s;
      this.redraw();
    }

    on_draw(canvas, ctx, width, height) {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      this.onDraw(ctx);

      ctx.restore();
      ctx.$dispose();
    }

    onDraw(ctx) {
      let monitor = this.state.monitor;
      this.objects.forEach((d) => {
        // log(`${d.t} ${d.x} ${d.y}`);
        switch (d.t) {
          case 'line':
            Drawing.draw_line(
              ctx,
              d.c,
              d.w || 1,
              d.x - monitor.x,
              d.y - monitor.y,
              d.x2,
              d.y2,
              true
            );
            break;
          case 'circle':
            Drawing.draw_circle(
              ctx,
              d.c,
              d.x - monitor.x,
              d.y - monitor.y,
              d.d,
              true
            );
            break;
        }
      });
    }

    destroy() {}
  }
);


//-----------------------------
// ./apps/clock.js
//-----------------------------

// adapted from gnome-shell-cairo clock extension

//import GObject from 'gi://GObject';
//import Clutter from 'gi://Clutter';
//import Cairo from 'gi://cairo';
//import St from 'gi://St';

//import { Drawing } from '../drawing.js';

function _drawFrame(ctx, size, settings) {
  if (!settings.frame) {
    return;
  }
  let { background, border, borderWidth } = settings.frame;
  let radius = 18;

  ctx.save();
  let bgSize = size * settings.frame.size;
  // frame background
  Drawing.draw_rounded_rect(
    ctx,
    background,
    -bgSize / 2,
    -bgSize / 2,
    bgSize,
    bgSize,
    0,
    radius
  );
  // frame border
  if (borderWidth) {
    Drawing.draw_rounded_rect(
      ctx,
      border,
      -bgSize / 2,
      -bgSize / 2,
      bgSize,
      bgSize,
      borderWidth,
      radius
    );
  }
  ctx.restore();
}

function _drawDial(ctx, size, settings) {
  if (!settings.dial) {
    return;
  }
  let { background, border, borderWidth } = settings.dial;

  ctx.save();
  let bgSize = size * settings.dial.size;
  // dial background
  Drawing.draw_circle(ctx, background, 0, 0, bgSize);
  // dial border
  if (borderWidth) {
    Drawing.draw_circle(ctx, border, 0, 0, bgSize, borderWidth);
  }
  ctx.restore();
}

function _drawMarks(ctx, size, settings) {
  if (!settings.marks) {
    return;
  }
  let { color, width } = settings.marks;

  ctx.save();

  for (let i = 0; i < 12; i++) {
    let a = (360 / 12) * i;
    let mark = size * 0.75;
    Drawing.draw_rotated_line(
      ctx,
      color,
      width,
      // size / 33,
      a * (Math.PI / 180),
      -Math.floor((size * 0.9) / 2.7),
      -Math.floor(mark / 2.7)
    );
  }

  ctx.restore();
}

function _drawHands(ctx, size, date, settings) {
  const { hour, minute, second } = settings.hands;
  const d0 = date;
  let h0 = d0.getHours();
  const m0 = d0.getMinutes();

  // hands
  Drawing.draw_rotated_line(
    ctx,
    minute,
    size / 20,
    (h0 * 30 + (m0 * 30) / 60) * (Math.PI / 180),
    -Math.floor(size / 3.7)
  );
  Drawing.draw_circle(ctx, minute, 0, 0, size / 12);
  Drawing.draw_rotated_line(
    ctx,
    hour,
    size / 33,
    m0 * 6 * (Math.PI / 180),
    -Math.floor(size / 2.7)
  );
}

function _drawClock(ctx, date, x, y, size, settings) {
  ctx.save();
  ctx.translate(x, y);
  ctx.moveTo(0, 0);

  _drawFrame(ctx, size, settings);
  _drawDial(ctx, size, settings);
  _drawMarks(ctx, size, settings);
  _drawHands(ctx, size, date, settings);

  ctx.restore();
}

const Clock = GObject.registerClass(
  {},
  class Clock extends St.Widget {
    _init(x, settings = {}) {
      super._init();

      let size = x || 400;

      this._canvas = new ClockCanvas(settings);
      this._canvas.width = size;
      this._canvas.height = size;
      this.add_child(this._canvas);
    }

    redraw() {
      this._canvas.redraw();
    }
  }
);

const ClockCanvas = GObject.registerClass(
  {},
  class ClockCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init();

      this.settings = {
        dark_color: [0.2, 0.2, 0.2, 1.0],
        light_color: [1.0, 1.0, 1.0, 1.0],
        accent_color: [1.0, 0.0, 0.0, 1.0],
        ...settings,
      };
    }

    redraw() {
      this.queue_repaint();
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      let size = width;

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let {
        dark_color,
        light_color,
        accent_color,
        dark_foreground,
        light_foreground,
        secondary_color,
        clock_style,
      } = this.settings;

      let hideIcon = false;

      // do not change ... affects styles 0, 1
      let style = {
        hands: {
          hour: accent_color,
          minute: light_color,
        },
        marks: {
          color: [0.5, 0.5, 0.5, 1],
          width: 0,
        },
        dial: {
          size: 0.84,
          background: dark_color,
          border: [0.85, 0.85, 0.85, 1],
          borderWidth: 0,
        },
        frame: {
          size: 0.9,
          background: [0.5, 0.5, 0.5, 1],
          border: [0.25, 0.25, 0.25, 1],
          borderWidth: 0,
        },
      };

      // clock_style = 4;
      // console.log(this.settings);

      switch (clock_style) {
        // framed clocks
        case 9: {
          style.dial.size = 0.92;
          style.dial.background = light_color;
          style.hands.minute = dark_color;
          style.frame.background = light_foreground;
          style.marks.color = light_foreground;
          style.marks.width = 2;
          break;
        }
        case 8: {
          style.dial.size = 0.92;
          style.frame.background = dark_foreground;
          style.marks.color = dark_foreground;
          style.marks.width = 2;
          break;
        }
        case 7: {
          style.dial.size = 0.92;
          style.dial.background = light_color;
          style.hands.minute = dark_color;
          style.frame.background = light_foreground;
          style = {
            ...style,
            marks: null,
          };
          break;
        }
        case 6: {
          style.dial.size = 0.92;
          style.frame.background = dark_foreground;
          style.marks.color = dark_foreground;
          style.marks.width = 2;
          style = {
            ...style,
            marks: null,
          };
          break;
        }

        // round clocks
        case 5: {
          style.dial.size = 0.95;
          style.dial.border = dark_color;
          style.dial.borderWidth = 3;
          style.dial.background = light_color;
          style.hands.minute = dark_color;
          style.marks.color = light_foreground;
          style.marks.width = 2;
          style = {
            ...style,
            frame: null,
          };
          hideIcon = true;
          break;
        }
        case 4: {
          style.dial.size = 0.95;
          style.dial.border = light_color;
          style.dial.borderWidth = 3;
          style.dial.background = dark_color;
          style.marks.color = dark_foreground;
          style.marks.width = 2;
          style = {
            ...style,
            frame: null,
          };
          hideIcon = true;
          break;
        }

        case 3: {
          style.dial.size = 0.95;
          style.dial.border = dark_color;
          style.dial.borderWidth = 3;
          style.dial.background = light_color;
          style.hands.minute = dark_color;
          style = {
            ...style,
            marks: null,
            frame: null,
          };
          hideIcon = true;
          break;
        }
        case 2: {
          style.dial.size = 0.95;
          style.dial.border = light_color;
          style.dial.borderWidth = 3;
          style.dial.background = dark_color;
          style = {
            ...style,
            marks: null,
            frame: null,
          };
          hideIcon = true;
          break;
        }

        // basic clocks
        case 1: {
          style.dial.background = light_color;
          style.hands.minute = dark_color;
          style = {
            ...style,
            marks: null,
            frame: null,
          };
          break;
        }
        default:
        case 0:
          style = {
            ...style,
            marks: null,
            frame: null,
          };
          break;
      }

      _drawClock(ctx, new Date(), 0, 0, size, style);

      this._hideIcon = hideIcon;
      ctx.$dispose();
    }
  }
);


