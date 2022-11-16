'use strict';

const { St, Shell, GObject, Gio, GLib, Gtk, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Animation = Me.imports.effects.maclike_animation.Animation;
const xOverlay = Me.imports.apps.overlay.xOverlay;

const ICON_QUALITY = 3;

function _tween(from, to, weight) {
  return (from * weight + to * (1-weight));
}

function _explodeDashIcon(c) {
  let appwell = c.first_child;
  let label = c.label;
  let draggable = appwell?._draggable;

  // the icon widget
  let widget = appwell?.first_child;
  let icongrid = widget?.first_child;
  let boxlayout = icongrid?.first_child;
  let bin = boxlayout?.first_child;
  let icon = bin?.first_child;

  return {
    appwell,
    draggable,
    label,
    widget,
    icongrid,
    boxlayout,
    bin,
    icon,
  };
}

var DockIcon = GObject.registerClass(
  {},
  class DockIcon extends St.Widget {
    _init() {
      super._init({ name: 'DockIcon' });
      // this.style = 'border: 1px solid red';
    }

    draw(params) {
      if (this._icon && this._icon.icon_name != params.icon?.icon_name) {
        this._icon.icon_name = this._icon.icon_name;
        this.remove_child(this._icon);
        this._icon = null;
      }
      if (!this._icon) {
        this._icon = new St.Icon({
          icon_name: params.icon?.icon_name || null,
          gicon: params.icon?.gicon || null,
        });
        this.add_child(this._icon);
      }
      
      this._icon.set_icon_size(params.iconSize * ICON_QUALITY);
    }
  }
);

var IconsContainer = GObject.registerClass(
  {},
  class IconsContainer extends St.Widget {
    _init() {
      super._init({
        name: 'IconsContainer',
      });

      this._icons = [];
      this.reactive = true;
      this.track_hover = true;
      this.style = 'border: 2px solid yellow';
    }

    vfunc_scroll_event(scrollEvent) {
      if (this.delegate && this.delegate.onScrollEvent) {
        this.delegate.onScrollEvent(this, scrollEvent);
      }
      return Clutter.EVENT_PROPAGATE;
    }

    _precreate_icons(length) {
      while (this._icons.length < length) {
        let icon = new DockIcon();
        this._icons.push(icon);
        this.add_child(icon);
      }
      this._icons.forEach((icon) => {
        icon.visible = false;
      });
    }

    clear() {
      this._icons.forEach((i) => {
        this.remove_child(i);
      });
      this._icons = [];
    }

    draw(params) {
      this._precreate_icons(params.icons.length);
      let iconSize = params.iconSize;
      let offset = this.get_transformed_position();
      let idx = 0;
      for (let i = 0; i < params.icons.length; i++) {
        let source = params.icons[i];
        let target = this._icons[i];
        let tw = iconSize * source._targetScale;
        let th = iconSize * source._targetScale;
        let pos = source._pos;
        let x = pos[0] - offset[0];
        let y = pos[1] - offset[1];

        let [bx, by] = params.background.get_transformed_position();
        let bw = params.background.width;
        let bh = params.background.height;

        switch (params.position) {
          case St.DirectionType.LEFT:
            target.set_position(bx - offset[0] + bw / 2 - iconSize / 2, y);
            break;
          case St.DirectionType.RIGHT:
            target.set_position(
              bx - offset[0] + bw / 2 - iconSize / 2 - tw + iconSize,
              y
            );
            break;
          case St.DirectionType.UP:
            target.set_position(x, by - offset[1] + bh / 2 - iconSize / 2);
            break;
          case St.DirectionType.DOWN:
            target.set_position(
              x,
              by - offset[1] + bh / 2 - iconSize / 2 - th + iconSize
            );
            break;
        }

        target.set_size(tw, th);

        let { icon } = _explodeDashIcon(source);
        if (icon) {
          target.draw({
            ...params,
            icon: icon,
            targetScale: source._targetScale,
          });
          target.visible = true;
          let new_scale = _tween(target._icon.scale_x, source._targetScale/ICON_QUALITY, 0.9);
          if (target._icon) {
            target._icon.set_scale(new_scale, new_scale);
          }
        }
      }
    }
  }
);

var Background = GObject.registerClass(
  {},
  class Background extends St.Widget {
    _init() {
      super._init({
        name: 'Background',
      });

      this.reactive = false;
      this.style = 'border: 2px solid red';
    }
  }
);

var Dock = GObject.registerClass(
  {},
  class Dock extends St.Widget {
    _init(params) {
      super._init({
        name: 'Dock',
        ...(params || {}),
      });

      this._preferred_size = [32, 32];
      this._affect_struts = true;

      this._edge_distance = 10;
      this._render_padding = 20;

      this._background = new Background();
      this._iconsContainer = new IconsContainer();
      this._iconsContainer.opacity = 255;

      this._position = -1;
      Main.layoutManager.addChrome(this, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: false,
      });

      this._iconsContainer.connectObject(
        'button-press-event',
        this.onButtonEvent.bind(this),
        'motion-event',
        this.onMotionEvent.bind(this),
        'enter-event',
        this.onEnterEvent.bind(this),
        'leave-event',
        this.onLeaveEvent.bind(this),
        this
      );
    }

    dock(monitor, position) {
      if (this._position) {
        this.undock();
      }

      this._monitor = monitor;
      this._position = position;

      this.onDock(monitor, position);

      [this._background, this._iconsContainer, this].forEach((c) => {
        Main.layoutManager.addChrome(c, {
          affectsStruts: c == this ? this._affect_struts : false,
          affectsInputRegion: false,
          trackFullscreen: false,
        });
      });

      this._layout(monitor, position);
    }

    undock() {
      if (this._position) {
        [this._background, this, this._iconsContainer].forEach((c) => {
          Main.layoutManager.removeChrome(c);
        });
        this._position = null;
        this.onUndock();
      }
    }

    _layout(monitor, position) {
      monitor = monitor || this._monitor || Main.layoutManager.primaryMonitor;
      position = position || this._position;

      // this._scaleFactor = St.ThemeContext.get_for_stage(
      //   global.stage
      // ).scale_factor;

      this._scaleFactor = monitor.geometry_scale;

      let x = monitor.x;
      let y = monitor.y;
      let w = this._preferred_size[0];
      let h = this._preferred_size[1];

      let scaleFactor = this._scaleFactor;

      this.set_size(w, h);

      let panelHeight =
        monitor == Main.layoutManager.primaryMonitor ? Main.panel.height : 0;

      switch (position) {
        case St.DirectionType.UP: {
          w = monitor.width;
          h += this._edge_distance;
          y += panelHeight;
          this._fixed_position = [x, y, w, h];
          this._hidden_position = [...this._fixed_position];
          this._hidden_position[1] -= h;
          this._hidden_position[1] -= this._edge_distance;
          this._hidden_position[1] -= panelHeight;
          break;
        }
        case St.DirectionType.DOWN: {
          y += monitor.height;
          w = monitor.width;
          h += this._edge_distance;
          y -= h;

          this._fixed_position = [x, y, w, h];
          this._hidden_position = [...this._fixed_position];
          this._hidden_position[1] += h;
          this._hidden_position[1] += this._edge_distance;
          break;
        }
        case St.DirectionType.LEFT: {
          h = monitor.height;
          h -= panelHeight;
          y += panelHeight;
          w += this._edge_distance;

          this._fixed_position = [x, y, w, h];
          this._hidden_position = [...this._fixed_position];
          this._hidden_position[0] -= w;
          this._hidden_position[0] -= this._edge_distance;
          break;
        }
        case St.DirectionType.RIGHT: {
          x += monitor.width;
          h = monitor.height;
          h -= panelHeight;
          y += panelHeight;
          w += this._edge_distance;
          x -= w;

          this._fixed_position = [x, y, w, h];
          this._hidden_position = [...this._fixed_position];
          this._hidden_position[0] += w;
          this._hidden_position[0] += this._edge_distance;
          break;
        }
      }

      this.set_position(x, y);
      this.set_size(w, h);

      this._layout_attached();
    }

    _layout_attached(position_only) {
      let pos = [this.x, this.y];
      let x = pos[0];
      let y = pos[1];
      let w = this.width;
      let h = this.height;
      let position = this._position;

      let rx = x;
      let ry = y;
      let rw = w;
      let rh = h;
      let rpad = this._render_padding + this._edge_distance;

      let bx = x;
      let by = y;
      let bw = w;
      let bh = h;
      switch (position) {
        case St.DirectionType.UP: {
          bh -= this._edge_distance;
          by += this._edge_distance;
          rh += rpad;
          break;
        }
        case St.DirectionType.DOWN: {
          bh -= this._edge_distance;
          ry -= rpad;
          rh += rpad;
          break;
        }
        case St.DirectionType.LEFT: {
          bw -= this._edge_distance;
          bx += this._edge_distance;
          rw += rpad;
          break;
        }
        case St.DirectionType.RIGHT: {
          bw -= this._edge_distance;
          rx -= rpad;
          rw += rpad;
          break;
        }
      }
      this._background.set_position(bx, by);
      this._iconsContainer.set_position(rx, ry);
      if (!position_only) {
        this._background.set_size(bw, bh);
        this._iconsContainer.set_size(rw, rh);
      }
    }

    onDock() {}
    onUndock() {}
    onButtonEvent() {}
    onMotionEvent() {}
    onEnterEvent() {}
    onLeaveEvent() {}

    _show() {
      this._target_position = this._fixed_position;
    }

    _hide() {
      this._target_position = this._hidden_position;
    }
  }
);

var DockedDash = GObject.registerClass(
  {},
  class DockedDash extends Dock {
    _init() {
      super._init();
      this._createDash();
      this._preferred_size = [120, 120];
    }

    _createDash() {
      if (!this._dash) {
        this._dash = new Dash();
        this._dash._adjustIconSize = () => {};
        this._dash._background.visible = false;
        this._dash.opacity = 0;
        this.add_child(this._dash);
      }
    }

    _findIcons() {
      let icons = this._dash._box.get_children();
      if (this._dash.showAppsButton) {
        icons.push(this._dash.showAppsButton.get_parent());
      }

      // icons = icons.filter((c) => {
      //   if (!c.first_child) {
      //     c.visible = false;
      //     return false;
      //   }
      //   let { icon } = _explodeDashIcon(c);
      //   if (!icon) {
      //     return false;
      //   }
      //   return true;
      // });

      return icons;
    }

    _resizeIcons(size) {
      let sz = size || this._iconSize || 48;
      let pad = 8;

      this._iconSize = sz;

      this._findIcons().forEach((c) => {
        let { widget, icon } = _explodeDashIcon(c);
        c.width = sz + pad * 2;
        c.height = sz + pad * 2;
        if (widget) {
          widget.width = sz;
          widget.height = sz;
        }
        if (icon) {
          icon.width = sz;
          icon.height = sz;
        }
      });
    }

    onDock(monitor, position) {
      monitor = monitor || this._monitor || Main.layoutManager.primaryMonitor;
      position = position || this._position;

      this._resizeIcons();

      switch (position) {
        case St.DirectionType.UP:
        case St.DirectionType.DOWN:
          {
            this._dash._box.get_parent().vertical = false;
            this._dash._box.layoutManager.orientation = 0;
          }
          break;
        case St.DirectionType.LEFT:
        case St.DirectionType.RIGHT:
          {
            this._dash._box.get_parent().vertical = true;
            this._dash._box.layoutManager.orientation = 1;
          }
          break;
      }

      this._startAnimation();
    }

    updateIconSize(sz) {
      let scaleFactor = this._scaleFactor;

      let hpad = 15 * scaleFactor;
      let vpad = 15 * scaleFactor;
      this._preferred_size = [sz + hpad * 2, sz + vpad * 2];

      this._resizeIcons(sz);
      this._layout();
    }

    _startAnimation() {
      if (!this._t) {
        this._t = this.extension._hiTimer.runLoop(this.animate.bind(this), 15);
      }
      this._debounceEndAnimation();
    }

    _endAnimation() {
      if (this._t) {
        this.extension._hiTimer.cancel(this._t);
        this._t = null;
      }
      if (this._dt) {
        this.extension._loTimer.runDebounced(this._dt);
      }
    }

    _debounceEndAnimation() {
      if (this._t) {
        if (!this._dt) {
          this._dt = this.extension._loTimer.runDebounced(() => {
            this._endAnimation();
          }, 2500);
        } else {
          this.extension._loTimer.runDebounced(this._dt);
        }
      }
    }

    animate() {
      let pointer = global.get_pointer();
      let icons = this._findIcons();
      if (icons.length < 2) return;

      if (this._dash) {
        this._dash.x = this.width / 2;
        this._dash.x -= this._dash.width / 2;
        this._dash.y = this.height / 2;
        this._dash.y -= this._dash.height / 2;
        this._dash.y += this._edge_distance;
      }

      let withinBounds = true;
      let bounds = [
        ...this._background.get_transformed_position(),
        this._background.width,
        this._background.height,
      ];
      if (
        pointer[0] < bounds[0] ||
        pointer[0] > bounds[0] + bounds[2] ||
        pointer[1] < bounds[1] ||
        pointer[1] > bounds[1] + bounds[3]
      ) {
        withinBounds = false;
      } else {
        this._debounceEndAnimation();
      }

      let scaleFactor = this._scaleFactor;

      let iconSize = this._iconSize;
      let iconSpacing = iconSize * (1.2 + 0.8 / 4);
      let vertical =
        this._position == St.DirectionType.LEFT ||
        this._position == St.DirectionType.RIGHT;

      if (vertical) {
        iconSpacing = iconSize * (1.2 + 0.8 / 6);
      }
      // gather fixed positions
      icons.forEach((i) => {
        let { bin } = _explodeDashIcon(i);
        if (!bin) {
          bin = i.first_child || i;
        }
        i._pos = [...bin.get_transformed_position()];
        i._targetScale = 1.0;
      });

      if (withinBounds) {
        let anim = Animation(icons, pointer, {
          iconSize,
          scaleFactor,
          animation_rise: 0.3,
          animation_magnify: 1.2,
          animation_spread: 0.8,
          vertical,
          position: this._position,
        });
      }

      // animate containers
      icons.forEach((i) => {
        if (vertical) {
          i.height = _tween(i.height, i._targetScale * iconSpacing * scaleFactor, 0.9);
        } else {
          i.width = _tween(i.width, i._targetScale * iconSpacing * scaleFactor, 0.9);
        }
      });

      // animate show/hide
      if (this._target_position) {
        let x = _tween(this.x, this._target_position[0], .8);
        let y = _tween(this.y, this._target_position[1], .8);
        this.set_position(x, y);
        this._layout_attached(true);
      }

      this._iconsContainer.draw({
        icons,
        iconSize,
        scaleFactor,
        vertical,
        position: this._position,
        background: this._background,
      });
    }

    onUndock() {
      this._endAnimation();
    }

    onButtonEvent() {}
    onMotionEvent() {
      this._startAnimation();
    }
    onEnterEvent() {}

    _show() {
      super._show();
      this._startAnimation();
    }

    _hide() {
      super._hide();
      this._startAnimation();
    }
  }
);

var DockTest = () => {
  let dock = new Dock({ name: 'Dock' });
  dock.dock(Main.layoutManager.primaryMonitor, St.DirectionType.LEFT);
  return dock;
};

var DockedDashTest = () => {
  let dock = new DockedDash({ name: 'Dock' });
  dock.dock(Main.layoutManager.primaryMonitor, St.DirectionType.LEFT);
  return dock;
};
