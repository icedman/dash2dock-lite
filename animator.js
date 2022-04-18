const Clutter = imports.gi.Clutter;
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

const iconScaleUp = 1.2;
const iconPadCoef = 0;
const xAnimFactor = 0.1;
const yAnimFactor = 0.2;
const scaleAnimFactor = 0.1;
const padReduceFactor = 0.94;

var Animator = class {
  update(params) {
    this.shrink = params.shrink;
    this.dash = params.dash;
    this.dashContainer = params.container;
    this._enabled = params.enable;

    if (params.enable) {
      this.enable();
      this.frameDelay = 100;
    } else {
      this.disable();
    }
  }

  isDragging() {
    return this._dragging === true;
  }

  hasWindowOverlap() {
    return this._overlapped === true;
  }

  enable() {
    this.animationContainer = new St.Widget({ name: 'animationContainer' });
    // this.animationContainer.add_style_class_name('hi');

    Main.uiGroup.add_child(this.animationContainer);

    this._beginAnimation();
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

    if (this.animationContainer) {
      this.animationContainer.get_children().forEach((c) => {
        this.animationContainer.remove_child(c);
      });

      this.dash.last_child.first_child.get_children().forEach((c) => {
        if (
          !c.first_child ||
          !c.first_child.first_child ||
          !c.first_child.first_child.first_child
        ) {
          return;
        }

        let szTarget = c.first_child.first_child;
        let szTargetIcon = szTarget._icon;

        if (szTargetIcon) {
          szTargetIcon.set_fixed_position_set(false);
          szTarget._icon = null;
          szTarget.width = -1;
          szTarget.height = -1;
          szTargetIcon.scale_x = 1;
          szTargetIcon.scale_y = 1;
          szTarget.add_child(szTargetIcon);
          szTarget.queue_relayout();
          szTarget.queue_redraw();
          // szTarget.remove_style_class_name('hi');
        }

        if (!this._dragging) {
          let draggable = c.first_child._draggable;
          if (draggable) {
            if (draggable._dragBeginId) {
              draggable.disconnect(draggable._dragBeginId);
              delete draggable._dragBeginId;
              draggable._dragBeginId = null;
            }
            if (draggable._dragEndId) {
              draggable.disconnect(draggable._dragEndId);
              delete draggable._dragEndId;
              draggable._dragEndId = null;
            }
          }
        }
      });

      Main.uiGroup.remove_child(this.animationContainer);
      delete this.animationContainer;
      this.animationContainer = null;
    }
  }

  _beginAnimation() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
      this._timeoutId = null;
    }
    if (this._intervalId == null) {
      this._intervalId = setInterval(this._animate.bind(this), 25);
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._timeoutId = null;
    // this.dashContainer.remove_style_class_name('hi');
  }

  _debounceEndAnimation() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(this._endAnimation.bind(this), 1500);
  }

  onMotionEvent() {
    this._animate();
  }

  onEnterEvent() {
    this._inDash = true;
    this._beginAnimation();
  }

  onLeaveEvent() {
    this._inDash = false;
    this._debounceEndAnimation();
  }

  onFocusWindow() {
    this._beginAnimation();
    this._debounceEndAnimation();
  }

  onFullScreenEvent() {
    let primary = Main.layoutManager.primaryMonitor;
    if (!primary.inFullscreen) {
      this.show();
    } else {
      this.hide();
    }
  }

  _get_x(obj) {
    if (obj == null) return 0;
    if (obj.name != 'dash') return obj.x + this._get_x(obj.get_parent());
    return obj.x;
  }

  _animate() {
    let pointer = global.get_pointer();
    let iconWidth = this.shrink ? 58 : 64;

    this.animationContainer.position = this.dashContainer.position;
    this.animationContainer.size = this.dashContainer.size;
    this._overlapped = false;

    let X = this.dash.last_child.x;
    let Y = -iconWidth * 0.08;
    if (X == 0) return;
    pointer[0] -= X;

    let pivot = new Point();
    pivot.x = 0.5;
    pivot.y = 1.0;

    this.animationContainer.get_children().forEach((c) => {
      c._orphan = true;
    });

    let idx = 0;
    let topIdx = -1;
    let topY = 0;

    this.appButton = this.dash.last_child.last_child;
    // let items = [...this.dash.last_child.first_child.get_children(), this.appButton];
    let items = this.dash.last_child.first_child.get_children();
    items.forEach((c) => {
      if (
        !c.first_child ||
        !c.first_child.first_child ||
        !c.first_child.first_child.first_child
      ) {
        return;
      }

      let szTarget = c.first_child.first_child;
      if (c === this.appButton) {
        szTarget = this.appButton.first_child;
      }

      if (!szTarget) return;
      // szTarget.add_style_class_name('hi');

      let newIcon = false;
      let pos = c.position;
      let dx = pos.x + c.width / 2 - pointer[0];
      let dy = pos.y + c.height / 2 - pointer[1];
      let d = Math.sqrt(dx * dx);
      let dst = 150;
      let dstx = 500;
      let dd = dst - d;
      let sz = 0;
      let sc = 0;
      
      if (d < dst && dd > 0 && this._inDash) {
        let df = dd / dst;
        sz = -10 * df;
        sc = iconScaleUp * df;
      }

      let szDot = szTarget.first_child;
      if (szDot.icon) {
        szDot = szTarget.last_child;
      }
      if (szDot) {
        szDot.translation_y = this.shrink ? -8 : 0;
      }

      let szTargetIcon = szTarget._icon;
      if (!szTargetIcon) {
        szTargetIcon = szTarget.first_child;
        if (!szTargetIcon.icon) {
          szTargetIcon = szTarget.last_child;
        }
        if (!szTargetIcon.icon) return;

        szTarget._icon = szTargetIcon;
        szTargetIcon._container = szTarget;
        szTargetIcon.set_fixed_position_set(true);
        let iconWidth = szTargetIcon.width;
        if (c === this.appButton) {
          // handle differently?
        } else {
          szTarget.remove_child(szTargetIcon);
        }

        newIcon = true;
      }

      let draggable = c.first_child._draggable;
      if (newIcon && draggable && !draggable._dragBeginId) {
        draggable._dragBeginId = draggable.connect('drag-begin', () => {
          this._dragging = true;
          if (this._enabled) {
            this.disable();
          }
        });
        draggable._dragEndId = draggable.connect('drag-end', () => {
          this._dragging = false;
          if (this._enabled) {
            this.enable();
          }
        });
      }

      szTarget.width = iconWidth;
      szTargetIcon.icon.width = iconWidth * 0.8;
      szTargetIcon.icon.height = iconWidth * 0.8;
      szTargetIcon._orphan = false;

      let scc = 1 + sc - szTargetIcon.scale_x;
      szTargetIcon.scale_x = szTargetIcon.scale_x + scc * scaleAnimFactor;
      szTargetIcon.scale_y = szTargetIcon.scale_y + scc * scaleAnimFactor;
      // szTargetIcon.scale_z = szTargetIcon.scale_y;

      szTargetIcon.pivot_point = pivot;

      if (newIcon) {
        szTargetIcon.x = pos.x + X + (iconWidth * 0.2) / 2;
        szTargetIcon.y = pos.y + Y + iconWidth * 0.4 + sz;
        if (c === this.appButton) {
          // handle differently?
        } else {
          this.animationContainer.add_child(szTargetIcon);
        }
      } else {
        let tz = pos.y + Y + iconWidth * 0.4 + sz - szTargetIcon.y;
        szTargetIcon.y = szTargetIcon.y + tz * yAnimFactor;
        c.label.y =
          szTargetIcon.y + this.animationContainer.y - iconWidth * 1.4;

        if (sz != 0 && (szTargetIcon.y < topY || topY == 0)) {
          topY = szTargetIcon.y;
          topIdx = idx;
        }
      }

      szTargetIcon._x = pos.x + X + (iconWidth * 0.2) / 2;
      szTargetIcon.x = (szTargetIcon.x * 9 + szTargetIcon._x) / 10;
      idx++;
    });

    if (topIdx != -1 && c !== this.appButton) {
      let tl = topIdx - 1;
      let tr = topIdx + 1;
      let pz = 0;

      let cc = items[topIdx];
      let pos = cc.position;
      let szTargetIcon = null;
      if (cc && cc.first_child && cc.first_child.first_child) {
        let szTarget = cc.first_child.first_child;
        szTargetIcon = szTarget._icon;
        pz = ((pos.x + iconWidth / 2 - pointer[0]) / iconWidth) * 40;
        if (pz < iconWidth / 2 && pz > -iconWidth / 2) {
          let tx = szTargetIcon._x + pz;
          szTargetIcon.x += (tx - szTargetIcon.x) * xAnimFactor;
        }
      }

      let pr = szTargetIcon;
      let pl = szTargetIcon;

      if (szTargetIcon)
        for (let i = 0; i < 20; i++) {
          let cl = items[tl--];
          let cr = items[tr++];

          // handle differently?
          if (cl === this.appButton || cr === this.appButton) continue;
          
          if (cl && cl.first_child && cl.first_child.first_child) {
            let szTarget = cl.first_child.first_child;
            let szTargetIcon = szTarget._icon;
            let tz = pl.x - iconWidth * szTargetIcon.scale_x * 1.1;
            szTargetIcon.x += (tz - szTargetIcon.x) * xAnimFactor;
            pl = szTargetIcon;
          }

          if (cr && cr.first_child && cr.first_child.first_child) {
            let szTarget = cr.first_child.first_child;
            let szTargetIcon = szTarget._icon;
            let tz = pr.x + iconWidth * szTargetIcon.scale_x * 1.1;
            szTargetIcon.x += (tz - szTargetIcon.x) * xAnimFactor;
            pr = szTargetIcon;
          }

          if (!cl && !cr) break;
        }
    }

    this.animationContainer.get_children().forEach((c) => {
      if (c._orphan) {
        this.animationContainer.remove_child(c);
      }
    });
  }

  show() {
    if (this.animationContainer) {
      this.animationContainer.show();
    }
  }

  hide() {
    if (this.animationContainer) {
      this.animationContainer.hide();
    }
  }
};
