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

var AutoHide = class {
  constructor() {
    this._enabled = false;
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
    this.checkHide();

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
    // log('disable autohide');
  }

  isAnimating() {
    return this._intervalId != null;
  }

  _beginAnimation(t) {
    this.target = t;
    if (this._intervalId == null) {
      this._intervalId = setInterval(this._animate.bind(this), HIDE_ANIMATION_INTERVAL);
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
    this.checkHide();
  }

  show() {
    this.frameDelay = 0;
    this._beginAnimation(this.screenHeight - this.dashContainer.height);
  }

  checkHide() {
    this.hide();
  }

  hide() {
    this.frameDelay = 10;
    this._beginAnimation(this.screenHeight - this.dashContainer.height / 8);
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
};
