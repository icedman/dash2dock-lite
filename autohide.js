'use strict';

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Layout = imports.ui.layout;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const HIDE_ANIMATION_INTERVAL = 15;
const HIDE_ANIMATION_INTERVAL_PAD = 15;
const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 20;
const HIDE_PREVIEW_DURATION = 750;

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

var AutoHide = class {
  enable() {
    // log('enable autohide');
    this._enabled = true;
    this._shown = true;
    this._dwell = 0;

    this._debounceCheckHide();

    this.extension._loTimer.runSequence([
      {
        func: () => {
          if (isNaN(this.dashContainer._fixedPosition)) {
            this._checkHide();
            this.extension._updateLayout();
          }
        },
        delay: 500,
      },
      {
        func: () => {
          this._checkHide();
        },
        delay: 500,
      },
    ]);

    log('autohide enabled');
  }

  disable() {
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
      if (w._parent && w._parent._close_btn) {
        w._parent.remove_child(w._parent._close_btn);
        delete w._parent._close_btn;
        w._parent._close_btn = null;
      }
    });

    log('autohide disabled');
  }

  _beginAnimation(t) {
    // let monitor = this.dashContainer._monitor;
    // let y = monitor.y;
    // let height = monitor.height;
    // this.target = y + height - t;

    if (this.extension.animator._dragging) {
      return;
    }

    if (t) {
      this.target = this.dashContainer._fixedPosition;
    } else {
      this.target = this.dashContainer._hidePosition;
    }

    this.animationInterval = this.extension.animationInterval;
    if (this.extension._hiTimer && this._animate()) {
      if (!this._animationSeq) {
        this._animationSeq = this.extension._hiTimer.runLoop(
          () => {
            this._animate();
          },
          this.animationInterval,
          'autohideTimer'
        );
      } else {
        this.extension._hiTimer.runLoop(this._animationSeq);
      }
    }
  }

  _endAnimation() {
    if (this.extension._hiTimer) {
      this.extension._hiTimer.cancel(this._animationSeq);
    }

    if (this.dashContainer) {
      this.dashContainer.remove_style_class_name('hi');
    }
  }

  _onMotionEvent() {
    if (this.extension.pressure_sense && !this._shown) {
      let monitor = this.dashContainer._monitor;

      let sw = this.extension.sw;
      let sh = this.extension.sh;
      let scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
      let area = scale * (PRESSURE_SENSE_DISTANCE * PRESSURE_SENSE_DISTANCE);
      let dx = 0;

      let pointer = global.get_pointer();

      if (this.last_pointer) {
        dx = pointer[0] - this.last_pointer[0];
        dx = dx * dx;
      }
      if (dx < area && pointer[1] + 4 > monitor.y + sh) {
        this._dwell++;
      } else {
        this._dwell = 0;
      }

      // log(`${dx} ${area}`);

      if (this._dwell > 12) {
        this.show();
      }

      this.last_pointer = pointer;
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
    this.frameDelay = 0;
    this._shown = true;
    this._beginAnimation(true);
  }

  hide() {
    this.frameDelay = 10;
    this._shown = false;
    this._beginAnimation(false);
  }

  _animate() {
    if (!this.dashContainer) return false;

    if (this.extension.animator && this.extension.animator._dragging) {
      return false;
    }

    if (this._preview && this._preview > 0) {
      this._preview -= this.animationInterval;
    }

    let x = this.dashContainer.position.x;
    let y = this.dashContainer.position.y;

    // temporarily disable autohide
    if (this.animator && this.animator._enabled && this.animator._dragging) {
      x = this.dashContainer._fixedPosition.x;
      y = this.dashContainer._fixedPosition.y;

      this.dashContainer.set_position(x, y);
      this._endAnimation();
      this.animator._endAnimation();
      return true;
    }

    if (this.frameDelay && this.frameDelay-- > 0) {
      return true;
    }

    if (this.extension.debug_visual) {
      this.dashContainer.add_style_class_name('hi');
    }

    this._animating = false;
    let travel = this.dashContainer._dockHeight;
    let speed = travel / 150;
    let dx = this.target[0] - x;
    let dy = this.target[1] - y;
    if (
      (Math.sqrt(dx * dx) <= speed * this.animationInterval &&
        Math.sqrt(dy * dy) <= speed * this.animationInterval) ||
      this.animator._dragging
    ) {
      x = this.target[0];
      y = this.target[1];
      this._endAnimation();
    } else {
      x += speed * (dx < 0 ? -1 : 1) * this.animationInterval;
      y += speed * (dy < 0 ? -1 : 1) * this.animationInterval;
      this._animating = true;

      // animate the icons if needed
      if (this.animator && this.animator._enabled) {
        this.animator._beginAnimation('autohider');
      }
    }

    this.dashContainer.set_position(this.target[0], y);
    return this._animating;
  }

  _track(window) {
    if (window == this._currentTracked) return;

    this._untrack(this._currentTracked);
    if (!window._tracked) {
      window._onPositionChanged = window.connect(
        'position-changed',
        this._debounceCheckHide.bind(this)
      );
      window._onSizeChanged = window.connect(
        'size-changed',
        this._debounceCheckHide.bind(this)
      );
      window._tracked = true;
      this._currentTracked = window;
    }
  }

  _untrack(window) {
    try {
      if (window && window._tracked) {
        window.disconnect(window._onPositionChanged);
        window.disconnect(window._onSizeChanged);
        window._tracked = false;
      }
    } catch (err) {
      // may have been destroyed already
    }
  }

  preview(do_preview) {
    if (do_preview === false) {
      this._preview = null;
    } else {
      this._preview = HIDE_PREVIEW_DURATION;
    }
    this._checkHide();
  }

  _checkOverlap() {
    let pointer = global.get_pointer();
    let dash_position = this.dashContainer._fixedPosition;
    // this.animator._get_position(this.dashContainer);

    // log('---');
    // log(pointer[1]);
    // log(dash_position[1]);

    // if (this.extension._vertical) {
    //   if (pointer[0] < dash_position[1] + this.dashContainer.width)
    //     return false;
    // } else {
    if (pointer[1] > dash_position[1]) return false;
    // }

    let monitor = this.dashContainer._monitor;
    let actors = global.get_window_actors();
    let windows = actors.map((a) => {
      let w = a.get_meta_window();
      w._parent = a;
      return w;
    });
    windows = windows.filter((w) => w.can_close());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    windows = windows.filter((w) => w.get_wm_class() != 'com.desktop.ding');

    let workspace = global.workspace_manager.get_active_workspace_index();
    windows = windows.filter(
      (w) =>
        workspace == w.get_workspace().index() && w.showing_on_its_workspace()
    );
    windows = windows.filter((w) => w.get_window_type() in handledWindowTypes);

    windows.forEach((w) => this._track(w));

    let isOverlapped = false;
    windows.forEach((w) => {
      let frame = w.get_frame_rect();
      // log (`${frame.y} + ${frame.height}`);
      // if (this.extension._vertical) {
      //   if (frame.x <= dash_position[0] + this.dashContainer.width) {
      //     isOverlapped = true;
      //   }
      // } else {
      if (frame.y + frame.height >= dash_position[1]) {
        isOverlapped = true;
      }
      // }
    });

    this.windows = windows;

    // log(dash_position[1]);
    // log(isOverlapped);
    // log(windows);

    if (this._preview && this._preview > 0) {
      return true;
    }
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
