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
const clearTimeout = Me.imports.utils.clearTimeout;

const ANIM_INTERVAL = 15;
const ANIM_INTERVAL_PAD = 15;
const ANIM_POS_COEF = 2;
const ANIM_PULL_COEF = 1.8;
const ANIM_SCALE_COEF = 2.5;
const ANIM_ON_LEAVE_COEF = 1.4;
const ANIM_ICON_RAISE = 0.25;
const ANIM_ICON_SCALE = 1.8;
const ANIM_ICON_SCALE_REDUCE = 0.5;
const ANIM_ICON_HIT_AREA = 1.25;
const ANIM_ICON_QUALITY = 2.0;
const ANIM_REENABLE_DELAY = 750;
const ANIM_DEBOUNCE_END_DELAY = 1000;
const ANIM_PREVIEW_DURATION = 1500;

const DOT_CANVAS_SIZE = 96;

var Animator = class {
  constructor() {
    this._enabled = false;
    this.animationInterval = ANIM_INTERVAL;
  }

  enable() {
    if (this._enabled) return;
    this._iconsContainer = new St.Widget({ name: 'iconsContainer' });
    Main.uiGroup.add_child(this._iconsContainer);
    this._dotsContainer = new St.Widget({ name: 'dotsContainer' });
    Main.uiGroup.add_child(this._dotsContainer);
    // log('enable animator');
    this._enabled = true;
    this._dragging = false;
    this._oneShotId = null;
    this._relayout = 8;

    this.show_dots = true;
  }

  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    this._endAnimation();

    if (this._oneShotId) {
      clearInterval(this._oneShotId);
      this._oneShotId = null;
    }

    if (this._iconsContainer) {
      Main.uiGroup.remove_child(this._iconsContainer);
      delete this._iconsContainer;
      this._iconsContainer = null;
      Main.uiGroup.remove_child(this._dotsContainer);
      delete this._dotsContainer;
      this._dotsContainer = null;
    }

    this._dots = [];

    if (this.dashContainer) {
      this._restoreIcons();
    }

    // log('disable animator');
  }

  preview() {
    this._preview = ANIM_PREVIEW_DURATION;
  }

  _precreate_dots(count) {
    if (!this._dots) {
      this._dots = [];
    }
    if (this.show_dots && this.extension.xDot) {
      for (let i = 0; i < count - this._dots.length; i++) {
        let dot = new this.extension.xDot(DOT_CANVAS_SIZE);
        this._dots.push(dot);
        this._dotsContainer.add_child(dot);
        dot.set_position(0, 0);
      }
    }
    this._dots.forEach((d) => {
      d.visible = false;
    });
  }

  _animate() {
    if (!this._iconsContainer || !this.dashContainer) return;
    this.dash = this.dashContainer.dash;

    if (this._relayout > 0 && this.extension && this._updateLayout) {
      this.extension._updateLayout();
      this._relayout--;
    }

    this._iconsContainer.width = 1;
    this._iconsContainer.height = 1;
    this._dotsContainer.width = 1;
    this._dotsContainer.height = 1;

    let magnification =
      (this.extension.animation_magnify * 0.9 || 0) - ANIM_ICON_SCALE_REDUCE;
    let spread = 1 - (this.extension.animation_spread * 1 || 0);

    let existingIcons = this._iconsContainer.get_children();
    if (this._iconsCount != existingIcons.length) {
      this._relayout = 8;
      this._iconsCount = existingIcons.length;
    }

    let validPosition = true;
    let dock_position = 'bottom';
    let ix = 0;
    let iy = 1;

    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

    let pivot = new Point();
    pivot.x = 0.5;
    pivot.y = 1.0;

    let iconSize = this.dash.iconSize * this.extension.scale;

    switch (this.dashContainer._position) {
      case 0:
        dock_position = 'top';
        ix = 0;
        iy = -1.0;
        pivot.x = 0.0;
        pivot.y = 0.0;
        break;
      case 1:
        dock_position = 'right';
        ix = 1;
        iy = 0;
        pivot.x = 1.0;
        pivot.y = 0.5;
        break;
      case 2:
        dock_position = 'bottom';
        break;
      case 3:
        dock_position = 'left';
        ix = 1;
        iy = 0;
        pivot.x = 0.0;
        pivot.y = 0.5;
        break;
      default:
        // center
        break;
    }

    pivot.x *= scaleFactor;
    pivot.y *= scaleFactor;

    let visible_dots = 0;

    let icons = this._findIcons();
    icons.forEach((c) => {
      let bin = c._bin;
      if (!bin) return;

      if (c._appwell && c._appwell.app.get_n_windows() > 0) {
        visible_dots++;
      }

      for (let i = 0; i < existingIcons.length; i++) {
        if (existingIcons[i]._bin == bin) {
          return;
        }
      }

      let icon = c._icon;

      let uiIcon = new St.Widget({
        name: 'icon',
        width: iconSize,
        height: iconSize,
      });

      uiIcon.pivot_point = pivot;
      uiIcon._bin = bin;
      uiIcon._appwell = c._appwell;
      uiIcon._label = c._label;

      this._iconsContainer.add_child(uiIcon);

      // spy dragging events
      let draggable = c._draggable;
      if (draggable && !draggable._dragBeginId) {
        draggable._dragBeginId = draggable.connect('drag-begin', () => {
          this._dragging = true;
          this.disable();
        });
        draggable._dragEndId = draggable.connect('drag-end', () => {
          this._dragging = false;
          this._oneShotId = setTimeout(
            this.enable.bind(this),
            ANIM_REENABLE_DELAY
          );
        });
      }
    });

    this._precreate_dots(visible_dots);

    let pointer = global.get_pointer();

    let nearestIdx = -1;
    let nearestIcon = null;
    let nearestDistance = -1;

    let animateIcons = this._iconsContainer.get_children();
    animateIcons.forEach((c) => {
      if (this.extension.services) {
        this.extension.services.updateIcon(c.first_child);
      }

      let orphan = true;
      for (let i = 0; i < icons.length; i++) {
        if (icons[i]._bin == c._bin) {
          orphan = false;
          break;
        }
      }

      if (orphan) {
        this._iconsContainer.remove_child(c);
        return;
      }
    });

    animateIcons = this._iconsContainer.get_children();

    // sort
    let cornerPos = this._get_position(this.dashContainer);
    animateIcons.sort((a, b) => {
      let dstA = this._get_distance(cornerPos, this._get_position(a._bin));
      let dstB = this._get_distance(cornerPos, this._get_position(b._bin));
      return dstA > dstB ? 1 : -1;
    });

    let idx = 0;
    animateIcons.forEach((icon) => {
      let bin = icon._bin;
      let pos = this._get_position(bin);

      bin.first_child.opacity = 0;
      // bin.set_size(iconSize, iconSize);
      icon.set_size(iconSize, iconSize);

      if (!icon.first_child && bin.first_child) {
        let img = new St.Icon({
          name: 'icon',
          icon_name: bin.first_child.icon_name
            ? bin.first_child.icon_name
            : null,
          gicon: bin.first_child.gicon ? bin.first_child.gicon : null,
        });
        img.set_icon_size(iconSize * ANIM_ICON_QUALITY);
        img.set_scale(1 / ANIM_ICON_QUALITY, 1 / ANIM_ICON_QUALITY);
        icon.add_child(img);

        let btn = new St.Button({
          width: iconSize,
          height: iconSize / 2,
        });
        icon.add_child(btn);
        btn.connect('clicked', (arg) => {
          if (icon._appwell) {
            icon._appwell.emit('clicked', arg);
          }
        });
        icon._btn = btn;
      }

      if (
        this.extension.autohider &&
        this.extension.autohider._enabled &&
        !this.extension.autohider._shown
      ) {
        icon._btn.hide();
      } else {
        icon._btn.show();
      }

      // get nearest
      let bposcenter = [...pos];
      bposcenter[0] += (iconSize * scaleFactor) / 2;
      bposcenter[1] += (iconSize * scaleFactor) / 2;
      let dst = this._get_distance(pointer, bposcenter);

      if (
        (nearestDistance == -1 || nearestDistance > dst) &&
        dst < iconSize * ANIM_ICON_HIT_AREA * scaleFactor
      ) {
        nearestDistance = dst;
        nearestIcon = icon;
        nearestIdx = idx;
        icon._distance = dst;
        icon._dx = bposcenter[0] - pointer[0];
        icon._dy = bposcenter[1] - pointer[1];
      }

      icon._target = pos;
      icon._targetScale = 1;

      if (pos[1] < this.extension.sh / 2) {
        validPosition = false;
      }

      idx++;
    });

    if (this._preview && this._preview > 0) {
      nearestIdx = Math.floor(animateIcons.length / 2);
      nearestIcon = animateIcons[nearestIdx];
      nearestDistance = 0;
      this._preview -= this.animationInterval;
    } else {
      this._preview = null;
    }

    //
    if (!this.extension.peek_hidden_icons) {
      if (
        this.extension.autohider &&
        this.extension.autohider._enabled &&
        !this.extension.autohider._shown
      ) {
        nearestIcon = null;
      }
    }

    // set animation behavior here
    if (nearestIcon && nearestDistance < iconSize * 2) {
      let raise = ANIM_ICON_RAISE;
      raise -=
        ANIM_ICON_RAISE * (1.0 - (this.extension.animation_rise || 0)) - 0.1;
      nearestIcon._target[iy] -= iconSize * raise * scaleFactor;
      nearestIcon._targetScale = ANIM_ICON_SCALE + magnification;

      let offset = nearestIcon._dx / 4;
      let offsetY = (offset < 0 ? -offset : offset) / 2;
      nearestIcon._target[ix] += offset;
      nearestIcon._target[iy] += offsetY;

      let prevLeft = nearestIcon;
      let prevRight = nearestIcon;
      let sz = nearestIcon._targetScale;
      let pull_coef = ANIM_PULL_COEF;

      for (let i = 1; i < 80; i++) {
        sz *= 0.8 - 0.2 * spread;

        let left = null;
        let right = null;
        if (nearestIdx - i >= 0) {
          left = animateIcons[nearestIdx - i];
          left._target[ix] =
            (left._target[ix] + prevLeft._target[ix] * pull_coef) /
            (pull_coef + 1);
          left._target[ix] -= iconSize * (sz + 0.2) * scaleFactor;
          if (sz > 1) {
            left._targetScale = sz;
          }
          prevLeft = left;
        }
        if (nearestIdx + i < animateIcons.length) {
          right = animateIcons[nearestIdx + i];
          right._target[ix] =
            (right._target[ix] + prevRight._target[ix] * pull_coef) /
            (pull_coef + 1);
          right._target[ix] += iconSize * (sz + 0.2) * scaleFactor;
          if (sz > 1) {
            right._targetScale = sz;
          }
          prevRight = right;
        }

        if (!left && !right) break;

        pull_coef *= 0.9;
      }
    }

    let didAnimate = false;

    let dotIndex = 0;

    // animate to target scale and position
    // todo .. make this velocity based
    animateIcons.forEach((icon) => {
      let pos = icon._target;
      let scale = icon._targetScale;
      let fromScale = icon.get_scale()[0];

      // could happen at login
      icon.visible = !isNaN(pos[0]);
      if (!icon.visible) return;

      icon.set_scale(1, 1);
      let from = this._get_position(icon);
      let dst = this._get_distance(from, icon._target);

      let _scale_coef = ANIM_SCALE_COEF;
      let _pos_coef = ANIM_POS_COEF;
      if (!nearestIcon) {
        _scale_coef *= ANIM_ON_LEAVE_COEF;
        _pos_coef *= ANIM_ON_LEAVE_COEF;
      }

      scale = (fromScale * _scale_coef + scale) / (_scale_coef + 1);

      if (dst > iconSize * 0.01 && dst < iconSize * 3) {
        pos[0] = (from[0] * _pos_coef + pos[0]) / (_pos_coef + 1);
        pos[1] = (from[1] * _pos_coef + pos[1]) / (_pos_coef + 1);
        didAnimate = true;
      }

      if (!isNaN(scale)) {
        icon.set_scale(scale, scale);
      }

      if (!isNaN(pos[0]) && !isNaN(pos[1])) {
        // why does NaN happen?
        icon.set_position(pos[0], pos[1]);

        // todo find appsButton._label
        if (icon._label) {
          // icon._label.y = pos[1] - iconSize * scale * 0.95 * scaleFactor;

          switch (dock_position) {
            case 'left':
              icon._label.x = pos[0] + iconSize * scale * 1.1 * scaleFactor;
              break;
            case 'right':
              icon._label.x = pos[0] - iconSize * scale * 1.1 * scaleFactor;
              icon._label.x -= icon._label.width / 1.8;
              break;
            case 'bottom':
              icon._label.y = pos[1] - iconSize * scale * 0.9 * scaleFactor;
              break;
            case 'top':
              icon._label.y = pos[1] + iconSize * scale * 0.9 * scaleFactor;
              break;
          }
        }

        // update the dot
        if (
          this.show_dots &&
          icon._appwell &&
          icon._appwell.app.get_n_windows() > 0
        ) {
          let dot = this._dots[dotIndex++];
          if (dot) {
            dot.visible = true;
            dot.set_position(pos[0], pos[1] + 8 * scaleFactor);
            dot.set_scale(
              iconSize / DOT_CANVAS_SIZE,
              iconSize / DOT_CANVAS_SIZE
            );
            dot.set_state({
              count: icon._appwell.app.get_n_windows(),
              color: this.extension.running_indicator_color || 'white',
              style: this.extension.running_indicator_style,
            });
          }
        }
      }
    });

    // todo... remove?
    if (validPosition && !this._isInFullscreen()) {
      this._iconsContainer.show();
      this._dotsContainer.show();
    }

    if (didAnimate) {
      this._debounceEndAnimation();
    }
  }

  _findIcons() {
    return this.extension._findIcons();
  }

  _get_x(obj) {
    if (obj == null) return 0;
    return obj.get_transformed_position()[0];
  }

  _get_y(obj) {
    if (obj == null) return 0;
    return obj.get_transformed_position()[1];
  }

  _get_position(obj) {
    return [this._get_x(obj), this._get_y(obj)];
  }

  _get_distance_sqr(pos1, pos2) {
    let a = pos1[0] - pos2[0];
    let b = pos1[1] - pos2[1];
    return a * a + b * b;
  }

  _get_distance(pos1, pos2) {
    return Math.sqrt(this._get_distance_sqr(pos1, pos2));
  }

  _beginAnimation() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
      this._timeoutId = null;
    }
    if (this._intervalId == null) {
      if (this.dashContainer && this.extension) {
        this.animationInterval =
          ANIM_INTERVAL +
          (this.extension.animation_fps || 0) * ANIM_INTERVAL_PAD;
      }

      this._intervalId = setInterval(
        this._animate.bind(this),
        this.animationInterval
      );
    }

    if (this.dash && this.extension && this.extension.debug_visual) {
      this.dash.first_child.add_style_class_name('hi');
    }
  }

  _endAnimation() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = null;
    if (this.dash) {
      this.dash.first_child.remove_style_class_name('hi');
    }
    this._relayout = 0;
  }

  _debounceEndAnimation() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(
      this._endAnimation.bind(this),
      ANIM_DEBOUNCE_END_DELAY + this.animationInterval
    );
  }

  _onMotionEvent() {
    this._onEnterEvent();
  }

  _onEnterEvent() {
    this._inDash = true;
    this._startAnimation();
  }

  _onLeaveEvent() {
    this._inDash = false;
    this._debounceEndAnimation();
  }

  _onFocusWindow() {
    this._endAnimation();
    this._startAnimation();
    this._relayout = 8;
  }

  _onFullScreen() {
    if (!this._iconsContainer) return;
    if (!this._isInFullscreen()) {
      this._iconsContainer.show();
      this._dotsContainer.show();
    } else {
      this._iconsContainer.hide();
      this._dotsContainer.hide();
    }
  }

  _isInFullscreen() {
    let monitor = this.dashContainer.monitor || this.dashContainer._monitor;
    return monitor.inFullscreen;
  }

  _startAnimation() {
    this._beginAnimation();
    this._debounceEndAnimation();
  }

  _restoreIcons() {
    let icons = this._findIcons();
    icons.forEach((c) => {
      let bin = c._bin;
      c._icon.opacity = 255;
      // c._icon.get_parent().remove_child(c._icon);
      // c._bin.add_child(c._icon);
    });
  }
};