'use strict';

const { St, Shell, GObject, Gio, GLib, Gtk, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const DOT_CANVAS_SIZE = 96;

var explodeDashIcon = function (c) {
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
};

var DockIcon = GObject.registerClass(
  {},
  class DockIcon extends St.Widget {
    _init() {
      super._init({ name: 'DockIcon', reactive: false });
    }

    draw(params) {
      let icon_gfx = params.icon?.icon_name;
      if (params.icon?.gicon) {
        let name = params.icon?.gicon.name;
        if (!name) {
          name = params.icon?.gicon.names[0];
        }
        if (name) {
          icon_gfx = name;
        }
      }
      // temporary!?
      if (!icon_gfx) {
        icon_gfx = 'org.gnome.Terminal';
      }
      if (this._icon && this._gfx != icon_gfx) {
        this._gfx = icon_gfx;
        this.remove_child(this._icon);
        this._icon = null;
      }
      if (!this._icon && icon_gfx) {
        let gicon = new Gio.ThemedIcon({ name: icon_gfx });
        this._icon = new St.Icon({
          gicon
        });
        this.add_child(this._icon);
      }
      this.visible = true;
    }
  }
);

var IconsContainer = GObject.registerClass(
  {},
  class IconsContainer extends St.Widget {
    _init(params) {
      super._init({
        name: 'IconsContainer',
        ...(params || {}),
      });
      this._icons = [];
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

    update(params) {
      let { icons, pivot, iconSize, quality } = params;
      if (!icons) {
        icons = [];
      }
      this._precreate_icons(icons.length);
      let idx = 0;

      icons.forEach((container) => {
        const { icon, appwell, bin, label, draggable } =
          explodeDashIcon(container);

        let _icon = this._icons[idx++];
        _icon.draw({
          icon,
        });

        _icon._appwell = appwell;
        _icon._bin = bin;
        _icon._label = label;
        _icon._img = _icon._icon;
        _icon._container = container;

        _icon._img.set_size(iconSize * quality, iconSize * quality);
        _icon._img.set_scale(1 / quality, 1 / quality);

        _icon.set_size(iconSize, iconSize);
        _icon.pivot_point = pivot;
      });
    }
  }
);

var DotsContainer = GObject.registerClass(
  {},
  class DotsContainer extends St.Widget {
    _init(params) {
      super._init({
        name: 'DotsContainer',
        ...(params || {}),
      });
      this._dots = [];
    }

    _precreate_dots(params) {
      const { length, xDoth } = params;
      if (this._showDots && xDot) {
        for (let i = 0; i < count - this._dots.length; i++) {
          let dot = new xDot(DOT_CANVAS_SIZE);
          let pdot = new St.Widget();
          pdot.add_child(dot);
          this._dots.push(dot);
          this._dotsContainer.add_child(pdot);
          dot.set_position(0, 0);
        }
      }
      this._dots.forEach((d) => {
        d.get_parent().width = 1;
        d.get_parent().height = 1;
        d.visible = false;
        // this sometimes get messed up
        d.scale_x = 1;
        d.scale_y = 1;
      });
    }
  }
);
