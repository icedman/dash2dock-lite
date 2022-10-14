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
const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;
const clearInterval = Me.imports.utils.clearInterval;

const HIDE_ANIMATION_INTERVAL = 15;
const HIDE_ANIMATION_INTERVAL_PAD = 15;
const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 20;

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
  constructor() {
    this.animationInterval = HIDE_ANIMATION_INTERVAL;
  }

  enable() {
    // log('enable autohide');
    this._enabled = true;
    this._shown = true;
    this._dwell = 0;

    this._debounceCheckHide();
    this.oneShotStartupCompleteId = setTimeout(() => {
      if (isNaN(this.dashContainer._fixedPosition)) {
        this._checkHide();
        this.dashContainer.delegate._updateLayout();
      }
      this.oneShotStartupCompleteId = setTimeout(() => {
        this._checkHide();
        this.oneShotStartupCompleteId = null;
      }, 500);
    }, 500);
  }

  disable() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    if (this.oneShotStartupCompleteId) {
      clearInterval(this.oneShotStartupCompleteId);
      this.oneShotStartupCompleteId = null;
    }

    this.show();

    this._enabled = false;

    this._untrack(this._currentTracked);

    // log('disable autohide');
  }

  isAnimating() {
    return this._intervalId != null;
  }

  _beginAnimation(t) {
    this.target = t;
    if (this._intervalId == null) {
      if (this.dashContainer && this.dashContainer.delegate) {
        this.animationInterval =
          HIDE_ANIMATION_INTERVAL +
          (this.dashContainer.delegate.animationFps || 0) *
            HIDE_ANIMATION_INTERVAL_PAD;
      }

      this._intervalId = setInterval(
        this._animate.bind(this),
        this.animationInterval
      );
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _onMotionEvent() {
    if (this.dashContainer.delegate.pressureSense && !this._shown) {
      let monitor = this.dashContainer.delegate.monitor;
      let sw = this.dashContainer.delegate.sw;
      let sh = this.dashContainer.delegate.sh;
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
    if (!this.dashContainer.delegate.pressureSense) {
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
    this._beginAnimation(
      this.dashContainer.delegate.sh - this.dashContainer.height
    );
  }

  hide() {
    this.frameDelay = 10;
    this._shown = false;
    this._beginAnimation(
      this.dashContainer.delegate.sh - this.dashContainer.height / 8
    );
  }

  _animate() {
    if (!this.dashContainer) return false;

    let y = this.dashContainer.position.y;
    let x = this.dashContainer.position.x;

    // temporarily disable autohide
    if (this.animator && this.animator._enabled && this.animator._dragging) {
      y = this.screenHeight - this.dashContainer.height;
      this.dashContainer.set_position(x, y);
      this._endAnimation();
      this.animator._endAnimation();
      return true;
    }

    if (this.frameDelay && this.frameDelay-- > 0) {
      return true;
    }

    // this.dashContainer.add_style_class_name('hi');
    this._animating = false;
    let travel = this.dashContainer._dockHeight;
    let speed = travel / 150;
    let dy = this.target - y;
    if (
      Math.sqrt(dy * dy) <= speed * this.animationInterval ||
      this.animator._dragging
    ) {
      y = this.target;
      this._endAnimation();
    } else {
      y += speed * (dy < 0 ? -1 : 1) * this.animationInterval;
      this._animating = true;

      // animate the icons if needed
      if (this.animator && this.animator._enabled) {
        this.animator._beginAnimation();
      }
    }

    this.dashContainer.set_position(x, y);
    return true;
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

  _checkOverlap() {
    let pointer = global.get_pointer();
    let dash_position = this.dashContainer._fixedPosition;
    // this.animator._get_position(this.dashContainer);

    // log('---');
    // log(pointer[1]);
    // log(dash_position[1]);

    if (pointer[1] > dash_position[1]) return false;

    let monitor = Main.layoutManager.primaryMonitor;
    let actors = global.get_window_actors();
    let windows = actors.map((a) => a.get_meta_window());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    windows = windows.filter((w) => w.can_close());

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
      if (frame.y + frame.height >= dash_position[1]) {
        isOverlapped = true;
      }
    });

    this.windows = windows;

    // log(dash_position[1]);
    // log(isOverlapped);
    // log(windows);
    return isOverlapped;
  }

  _debounceCheckHide() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(() => {
      this._timeoutId = null;
      this._checkHide();
    }, DEBOUNCE_HIDE_TIMEOUT);
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
