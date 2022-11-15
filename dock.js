'use strict';

const { St, Shell, GObject, Gio, GLib, Gtk, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Animation = Me.imports.effects.maclike_animation.Animation;
const xOverlay = Me.imports.apps.overlay.xOverlay;

var DockIcon = GObject.registerClass(
  {},
  class DockIcon extends St.Widget {
    _init() {
      super._init({ name: 'DockIcon' });
      // this._dot
      // this._badge
    }
  }
);

var RenderArea = GObject.registerClass(
  {},
  class RenderArea extends St.Widget {
    _init() {
      super._init({
        name: 'RenderArea',
      });

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

    draw(params) {}
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
  class Dock extends St.BoxLayout {
    _init(params) {
      super._init({
        name: 'Dock',
        vertical: true,
        ...(params || {}),
      });

      this._preferred_size = [32, 32];
      this._affect_struts = true;

      this._edge_distance = 10;
      this._render_padding = 10;

      this._background = new Background();
      this._render_area = new RenderArea();

      this._position = -1;
      Main.layoutManager.addChrome(this, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: false,
      });

      this._render_area.connectObject(
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

      // UP is troublesome... because of panel?
      if (position == St.DirectionType.UP) {
        position = St.DirectionType.DOWN;
      }

      this._monitor = monitor;
      this._position = position;

      this.onDock(monitor, position);

      Main.layoutManager.addChrome(this, {
        affectsStruts: this._affect_struts,
        affectsInputRegion: false,
        trackFullscreen: false,
      });
      Main.uiGroup.insert_child_below(this._background, this);
      Main.uiGroup.insert_child_above(this._render_area, this._background);

      this._layout(monitor, position);
    }

    undock() {
      if (this._position) {
        Main.layoutManager.removeChrome(this);
        this._position = null;

        if (this._background.get_parent()) {
          this._background.get_parent().remove_child(this._background);
        }
        if (this._render_area.get_parent()) {
          this._render_area.get_parent().remove_child(this._render_area);
        }

        this.onUndock();
      }
    }

    _layout(monitor, position) {
      monitor = monitor || this._monitor || Main.layoutManager.primaryMonitor;
      position = position || this._position;

      let x = monitor.x;
      let y = monitor.y;
      let w = this._preferred_size[0];
      let h = this._preferred_size[1];

      // monitor scale
      let scaleFactor = St.ThemeContext.get_for_stage(
        global.stage
      ).scale_factor;

      this.set_size(w, h);

      let panelHeight =
        monitor == Main.layoutManager.primaryMonitor ? Main.panel.height : 0;

      switch (position) {
        case St.DirectionType.UP: {
          w = monitor.width;
          this.vertical = true;
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
          this.vertical = true;
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
          this.vertical = false;
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
          this.vertical = false;
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

      this.style = '';

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
          this.style = `margin-top: ${this._edge_distance}px;`;
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
          this.style = `margin-left: ${this._edge_distance}px;`;
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
      this._render_area.set_position(rx, ry);
      if (!position_only) {
        this._background.set_size(bw, bh);
        this._render_area.set_size(rw, rh);
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
        this.add_child(this._dash);
      }
    }

    _explodeDashIcon(c) {
      let appwell = c.first_child;
      let label = c.label;
      let draggable = appwell._draggable;

      // the icon widget
      let widget = appwell.first_child;
      let icongrid = widget.first_child;
      let boxlayout = icongrid.first_child;
      let bin = boxlayout.first_child;
      let icon = bin.first_child;

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

    _findIcons() {
      let icons = this._dash._box.get_children();
      if (this._dash.showAppsButton) {
        icons.push(this._dash.showAppsButton.get_parent());
      }

      // resize all icons
      icons = icons.filter((c) => {
        if (!c.first_child) {
          c.visible = false;
          return false;
        }
        let { icon } = this._explodeDashIcon(c);
        if (!icon) {
          return false;
        }
        return true;
      });

      return icons;
    }

    _resizeIcons(size) {
      let sz = size || this._iconSize || 48;
      let pad = 9;

      this._iconSize = sz;

      this._findIcons().forEach((c) => {
        let { widget, icon } = this._explodeDashIcon(c);
        c.width = sz + pad * 2;
        c.height = sz + pad * 2;
        widget.width = sz;
        widget.height = sz;
        icon.width = sz;
        icon.height = sz;
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
    }

    updateIconSize(sz) {
      // monitor scale
      let scaleFactor = St.ThemeContext.get_for_stage(
        global.stage
      ).scale_factor;

      let hpad = 10 * scaleFactor;
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

      let withinBounds = true;
      let bounds = [
        ...this._render_area.get_transformed_position(),
        this._render_area.width,
        this._render_area.height,
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

      let icons = this._findIcons();
      if (icons.length < 2) return;

      // monitor scale
      let scaleFactor = St.ThemeContext.get_for_stage(
        global.stage
      ).scale_factor;

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
        let { bin } = this._explodeDashIcon(i);
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
          i.height =
            (i.height * 4 + i._targetScale * iconSpacing * scaleFactor) / 5;
        } else {
          i.width =
            (i.width * 4 + i._targetScale * iconSpacing * scaleFactor) / 5;
        }
      });

      this._render_area.draw({
        icons,
        vertical,
        position: this._position,
      });

      if (this._target_position) {
        let x = (this._target_position[0] + this.x * 4) / 5;
        let y = (this._target_position[1] + this.y * 4) / 5;
        this.set_position(x, y);
        this._layout_attached(true);
      }
    }

    onUndock() {
      if (this._t) {
        this.extension._hiTimer.cancel(this._t);
        this._t = null;
      }
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
