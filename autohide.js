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
    this._hide();
  }

  disable() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._show();
  }

  _beginAnimation(t) {
    this.target = t;
    if (this._intervalId == null) {
      this._intervalId = setInterval(this._animate.bind(this), 40);
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    // this.dashContainer.remove_style_class_name('hi');
  }

  onMotionEvent() {}

  onEnterEvent() {
    this._inDash = true;
    this._show();
  }

  onLeaveEvent() {
    this._inDash = false;
    this._hide();
  }

  _show() {
    this._beginAnimation(this.screenHeight - this.dashContainer.height);
  }

  _hide() {
    this._beginAnimation(this.screenHeight - this.dashContainer.height / 8);
  }

  _animate() {
    // this.dashContainer.add_style_class_name('hi');
    let y = this.dashContainer.position.y;
    let dy = this.target - y;
    if (dy * dy < 16) {
      y = this.target;
      this._endAnimation();
    } else {
      dy = dy / 2;
      y += dy;
    }
    this.dashContainer.set_position(0, y);
  }
};
