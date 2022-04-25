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
    this.hide();
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
  }

  _beginAnimation(t) {
    this.target = t;
    if (this._intervalId == null) {
      this._intervalId = setInterval(this._animate.bind(this), 25);
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    // this.dashContainer.remove_style_class_name('hi');
  }

  _debounce(func, delay) {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(func.bind(this), delay);
  }

  onMotionEvent() {}

  onEnterEvent() {
    this._inDash = true;
    this.show();
  }

  onLeaveEvent() {
    this._inDash = false;
    this.hide();
  }

  show() {
    this.frameDelay = 0;
    this._beginAnimation(this.screenHeight - this.dashContainer.height);
  }

  hide() {
    this.frameDelay = 10;
    this._beginAnimation(this.screenHeight - this.dashContainer.height / 8);
  }

  _animate() {
    // temporarilty disable autohide
    if (this.animator && this.animator.isDragging()) {
      this.target = this.screenHeight - this.dashContainer.height;
    }

    if (this.frameDelay && this.frameDelay-- > 0) {
      return;
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
  }
};
