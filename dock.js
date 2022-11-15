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
      super._init({name: 'DockIcon'});
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

    draw(params) {

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

      this._monitor = monitor;
      this._position = position;

      this.onDock(monitor, position);

      Main.layoutManager.addChrome(this, {
        affectsStruts: this._affect_struts,
        affectsInputRegion: true,
        trackFullscreen: true,
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

      this.set_size(w, h);

      let panelHeight = monitor == Main.layoutManager.primaryMonitor ? Main.panel.height : 0;

      switch (position) {
        case St.DirectionType.UP: {
          w = monitor.width;
          this.vertical = true;
          if (this.first_child) {
            h = this.first_child.height;
          }
          h += this._edge_distance;
          break;
        }
        case St.DirectionType.DOWN: {
          y += monitor.height;
          w = monitor.width;
          this.vertical = true;
          if (this.first_child) {
            h = this.first_child.height;
          }
          h += this._edge_distance;
          y -= h;
          break;
        }
        case St.DirectionType.LEFT: {
          h = monitor.height;
          h -= panelHeight;
          y += panelHeight;
          this.vertical = false;
          if (this.first_child) {
            w = this.first_child.width;
          }
          w += this._edge_distance;
          break;
        }
        case St.DirectionType.RIGHT: {
          x += monitor.width;
          h = monitor.height;
          h -= panelHeight;
          y += panelHeight;
          this.vertical = false;
          if (this.first_child) {
            w = this.first_child.width;
          }
          w += this._edge_distance;
          x -= w;
          break;
        }
      }

      this._fixedPosition = [x, y, w, h];

      this.set_position(x, y);
      this.set_size(w, h);

      this.style = '';

      // reposition attached areas
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
      this._background.set_size(bw, bh);
      this._render_area.set_position(rx, ry);
      this._render_area.set_size(rw, rh);
    }

    onDock() {}
    onUndock() {}
    onButtonEvent() {}
    onMotionEvent() {}
    onEnterEvent() {}
    onLeaveEvent() {}
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
        appwell, draggable, label, widget, icongrid, boxlayout, bin, icon
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
      this._resizeIcons(sz);
      this._layout();
    }

    onMotionEvent() {
      let icons = this._findIcons();

      let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
      let iconSize = this._iconSize;
      let iconSpacing = iconSize * (1.2 + 0.8 / 4);

      // gather fixed positions
      icons.forEach((i) => {
        let { bin } = this._explodeDashIcon(i);
        i._pos =[...bin.get_transformed_position()]
        i._targetScale = 1.0;
      });

      let pointer = global.get_pointer();
      let anim = Animation(icons, pointer, {
        iconSize,
        scaleFactor,
        animation_rise: 0.3,
        animation_magnify: 1.2,
        animation_spread: 0.8,
      });

      icons.forEach((i) => {
        i.height = i._targetScale * iconSpacing * scaleFactor;
      });
    }
  }
);

var DockTest = () => {
  let dock = new Dock({name:'Dock'});
  dock.dock(Main.layoutManager.primaryMonitor, St.DirectionType.LEFT);
  return dock;
}

var DockedDashTest = () => {
  let dock = new DockedDash({name:'Dock'});
  dock.dock(Main.layoutManager.primaryMonitor, St.DirectionType.LEFT);
  return dock;
}