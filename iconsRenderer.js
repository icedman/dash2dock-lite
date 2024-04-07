'use strict';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

const Point = Graphene.Point;

export const DockRendererIcon = GObject.registerClass(
  {},
  class DockRendererIcon extends St.Widget {
    _init() {
      super._init({ name: 'DockRendererIcon', reactive: false });

      let pivot = new Point();
      pivot.x = 0.5;
      pivot.y = 0.5;
      this.pivot_point = pivot;
    }

    update(params) {
      let gicon = null;
      let icon_gfx = params.icon?.icon_name;
      if (params.icon?.gicon) {
        let name = params.icon.gicon.name;
        if (!name && params.icon.gicon.names) {
          name = params.icon.gicon.names[0];
        }
        if (!name) {
          // hijack
          gicon = params.icon.gicon;
          icon_gfx = params.app;
        }
        if (name) {
          icon_gfx = name;
        }
      }

      // log(`--${icon_gfx}`);

      if (this._icon && this._gfx != icon_gfx) {
        this._gfx = icon_gfx;
        this.remove_child(this._icon);
        this._icon = null;
      }
      if (!this._icon && icon_gfx) {
        if (!gicon) {
          gicon = new Gio.ThemedIcon({ name: icon_gfx });
        }
        this._icon = new St.Icon({
          gicon,
        });

        // remove overlay added by services
        if (this.first_child) {
          this.remove_child(this.first_child);
        }

        this.add_child(this._icon);
      }
      this.visible = true;
    }
  }
);

export const DockIconsRenderer = GObject.registerClass(
  {},
  class DockIconsRenderer extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockIconsRenderer',
        ...(params || {}),
      });
      this._icons = [];
      this.reactive = true;
    }

    _precreate_icons(length) {
      while (this._icons.length < length) {
        let icon = new DockRendererIcon();
        this._icons.push(icon);
        this.add_child(icon);
      }
      this._icons.forEach((icon) => {
        icon.visible = false;
      });

      return this._icons;
    }

    clear() {
      this._icons.forEach((i) => {
        this.remove_child(i);
      });
      this._icons = [];
    }

    update(params) {
      let { icons, pivot, iconSize, quality, scaleFactor } = params;
      if (!icons) {
        icons = [];
      }
      this._precreate_icons(icons.length);
      let idx = 0;

      icons.forEach((container) => {
        const { _appwell, _bin, _label, _showApps } = container;

        let _icon = this._icons[idx++];
        _icon.update({
          icon: container._icon,
          app: _appwell?.app?.get_id(),
        });

        container._renderedIcon = _icon;

        _icon._appwell = _appwell;
        _icon._showApps = _showApps;
        _icon._bin = _bin;
        _icon._label = _label;
        _icon._img = _icon._icon;
        _icon._container = container;

        let cp = container.get_transformed_position();
        _icon.x = cp[0];
        _icon.y = cp[1];
        let p = new Graphene.Point();
        let sz = container._icon.width * quality * scaleFactor;
        _icon.set_size(sz, sz);
        _icon.set_scale(
          container._icon.scaleX / scaleFactor,
          container._icon.scaleY / scaleFactor
        );

        // if (_icon._img) {
        //   _icon._img.set_size(iconSize * quality, iconSize * quality);
        //   _icon._img.set_scale(1 / quality, 1 / quality);
        // }

        _icon.set_size(iconSize, iconSize);
        _icon.pivot_point = pivot;
      });
    }

    // move animation here!
    animate() {}
  }
);
