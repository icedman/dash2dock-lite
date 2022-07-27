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

const HIDE_ANIMATION_INTERVAL = 25;

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
    this._enabled = false;
    this._tracked = [];
  }

  update(params) {
    this.shrink = params.shrink;
    this.dash = params.dash;
    this.dashContainer = params.container;
    this.screenHeight = params.screenHeight;
    this._enabled = params.enable;

    if (params.enable) {
      this.enable();
    } else {
      this.disable();
    }
  }

  enable() {
    this._checkHide();

    // log('enable autohide');
    this._enabled = true;
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

    this.show();

    this._enabled = false;

    let actors = global.get_window_actors();
    actors.forEach((a) => {
      let window = a.get_meta_window();
      if (window._tracked) {
        this._untrack(window);
      }
    })

    this._tracked = [];
    // log('disable autohide');
  }

  isAnimating() {
    return this._intervalId != null;
  }

  _beginAnimation(t) {
    this.target = t;
    if (this._intervalId == null) {
      this._intervalId = setInterval(
        this._animate.bind(this),
        HIDE_ANIMATION_INTERVAL
      );
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _onMotionEvent() {}

  _onEnterEvent() {
    this._inDash = true;
    this.show();
  }

  _onLeaveEvent() {
    this._inDash = false;
    this._checkHide();
  }

  _onFocusWindow() {
    this._checkHide();
  }

  show() {
    this.frameDelay = 0;
    this._beginAnimation(this.screenHeight - this.dashContainer.height);
    if (this.animator && this.animator._enabled) {
      this.animator._beginAnimation();
    }
  }

  hide() {
    this.frameDelay = 10;
    this._beginAnimation(this.screenHeight - this.dashContainer.height / 8);
    if (this.animator && this.animator._enabled) {
      this.animator._beginAnimation();
    }
  }

  _animate() {
    if (!this.dashContainer) return false;

    // temporarily disable autohide
    if (this.animator && this.animator.isDragging()) {
      this.target = this.screenHeight - this.dashContainer.height;
    }

    if (this.frameDelay && this.frameDelay-- > 0) {
      return true;
    }
    // this.dashContainer.add_style_class_name('hi');
    let y = this.dashContainer.position.y;
    let x = this.dashContainer.position.x;
    let dy = this.target - y;
    if (dy * dy < 16) {
      y = this.target;
      this._endAnimation();
    } else {
      dy = dy / 4;
      y += dy;
    }
    this.dashContainer.set_position(x, y);
    return true;
  }

  _track(window) {
      if (!window._tracked) {
        window._onPositionChanged = window.connect('position-changed', this._debounceCheckHide.bind(this));
        // window._onSizeChanged = window.connect('size-changed', this._checkHide.bind(this));
        window._tracked = true;
      }
  }

  _untrack(window) {
     if (window._tracked) {
        window.disconnect(window._onPositionChanged);
        window.disconnect(window._onSizeChanged);
        window._tracked = false;
      }
  }

  _checkOverlap() {
    let monitor = Main.layoutManager.primaryMonitor;
    let actors = global.get_window_actors();
    let windows = actors.map((a) => a.get_meta_window());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    windows = windows.filter((w) => w.can_close());

    let workspace = global.workspace_manager.get_active_workspace_index();
    windows = windows.filter((w) => workspace == w.get_workspace().index() && w.showing_on_its_workspace());
    windows = windows.filter((w) => w.get_window_type() in handledWindowTypes);

    windows.forEach((w) => this._track(w));

    let isOverlapped = false;
    windows.forEach((w) => {
      let frame = w.get_frame_rect();
      let dash_position = this.animator._get_position(this.dashContainer);
      if (frame.y + frame.height >= dash_position[1]) {
        isOverlapped = true;
      }
    });

    this.windows = windows;

    return isOverlapped;
  }

  _debounceCheckHide() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(this._checkHide.bind(this), 500);
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
