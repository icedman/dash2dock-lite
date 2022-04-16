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

var AutoHide = class {
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
    this.frameCounter = 0;
    this.dashContainer.set_reactive(true);
    this.dashContainer.set_track_hover(true);

    this._motionEventId = this.dashContainer.connect(
      'motion-event',
      this._onMotionEvent.bind(this)
    );
    this._enterEventId = this.dashContainer.connect(
      'enter-event',
      this._onEnterEvent.bind(this)
    );
    this._leaveEventId = this.dashContainer.connect(
      'leave-event',
      this._onLeaveEvent.bind(this)
    );
    this._focusWindowId = global.display.connect(
      'notify::focus-window',
      this._beginAnimation.bind(this)
    );
  }

  disable() {
    this.dashContainer.set_reactive(false);
    this.dashContainer.set_track_hover(false);

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    if (this._motionEventId) {
      this.dashContainer.disconnect(this._motionEventId);
      delete this._motionEventId;
      this._motionEventId = null;
    }

    if (this._enterEventId) {
      this.dashContainer.disconnect(this._enterEventId);
      delete this._enterEventId;
      this._enterEventId = null;
    }

    if (this._leaveEventId) {
      this.dashContainer.disconnect(this._leaveEventId);
      delete this._leaveEventId;
      this._leaveEventId = null;
    }

    if (this._focusWindowId) {
      global.display.disconnect(this._focusWindowId);
      delete this._focusWindowId;
      this._focusWindowId = null;
    }

    if (this.fullScreenId) {
      global.display.disconnect(this.fullScreenId);
      delete this.fullScreenId;
      this.fullScreenId = null;
    }
  }

  _beginAnimation() {}

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._timeoutId = null;
  }

  _debounceEndAnimation() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(this._endAnimation.bind(this), 1500);
  }

  _animationTick() {}

  _onMotionEvent() {}

  _onEnterEvent() {
    this._inDash = true;
    this._beginAnimation();

    this.dashContainer.add_style_class_name('hi');
    this.dashContainer.set_position(
      0,
      this.screenHeight - this.dashContainer.height
    );
  }

  _onLeaveEvent() {
    this._inDash = false;
    this._debounceEndAnimation();

    this.dashContainer.remove_style_class_name('hi');
    this.dashContainer.set_position(
      0,
      this.screenHeight - this.dashContainer.height / 8
    );
  }

  _animate() {}
};
