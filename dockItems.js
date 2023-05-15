'use strict';

const { St, Shell, GObject, Gio, GLib, Gtk, Meta, Clutter } = imports.gi;
const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Dot = Me.imports.apps.dot.Dot;

const DOT_CANVAS_SIZE = 96;

var DockIcon = GObject.registerClass(
  {},
  class DockIcon extends St.Widget {
    _init() {
      super._init({ name: 'DockIcon', reactive: false });

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

        if (_icon._img) {
          _icon._img.set_size(iconSize * quality, iconSize * quality);
          _icon._img.set_scale(1 / quality, 1 / quality);
        }

        _icon.set_size(iconSize, iconSize);
        _icon.pivot_point = pivot;
      });
    }

    // move animation here!
    animate() {}
  }
);

var DotsContainer = GObject.registerClass(
  {},
  class DotsContainer extends St.Widget {
    _init(params) {
      super._init({
        name: 'IconsContainer',
        ...(params || {}),
      });
      this._dots = [];
    }

    _precreate_dots(params) {
      const { count, show } = params;
      if (show) {
        for (let i = 0; i < count - this._dots.length; i++) {
          let dot = new Dot(DOT_CANVAS_SIZE);
          let pdot = new St.Widget();
          pdot.add_child(dot);
          this._dots.push(dot);
          this.add_child(pdot);
          dot.set_position(0, 0);
        }
      }
      this._dots.forEach((d) => {
        d.get_parent().width = 1;
        d.get_parent().height = 1;
        d.set_scale(1, 1);
        d.visible = false;
      });
      return this._dots;
    }

    update(params) {
      let {
        icons,
        iconSize,
        vertical,
        position,
        scaleFactor,
        pivot,
        dotsCount,
        running_indicator_color,
        running_indicator_style_options,
        running_indicator_style,
        appNotices,
        notification_badge_color,
        notification_badge_style_options,
        notification_badge_style,
      } = params;

      this._precreate_dots({
        count: dotsCount + icons.length,
        show: true, // showDots || showBadges,
      });

      let dotIndex = 0;
      icons.forEach((icon) => {
        let pos = [...icon._pos];
        let scale = icon._scale;

        if (isNaN(pos[0]) || isNaN(pos[1])) {
          return;
        }

        // update the notification badge
        // todo ... move dots and badges to service?

        let has_badge = false;
        if (
          icon._appwell &&
          icon._appwell.app &&
          appNotices &&
          appNotices[icon._appwell.app.get_id()] &&
          appNotices[icon._appwell.app.get_id()].count > 0
        ) {
          // log(icon._appwell?.app.get_id());

          icon._badge = this._dots[dotIndex++];
          let count = appNotices[icon._appwell.app.get_id()].count;

          let badgeParent = icon._badge.get_parent();
          badgeParent.set_position(
            pos[0] + 4 * scaleFactor,
            pos[1] - 4 * scaleFactor
          );
          badgeParent.width = iconSize;
          badgeParent.height = iconSize;
          badgeParent.pivot_point = pivot;
          badgeParent.set_scale(scale, scale);

          let style =
            notification_badge_style_options[notification_badge_style];

          icon._badge.visible = true;
          icon._badge.set_state({
            count: count,
            color: notification_badge_color || [1, 1, 1, 1],
            rotate: 180,
            translate: [0.4, 0],
            style: style || 'default',
          });

          icon._badge.set_scale(
            (iconSize * scaleFactor) / DOT_CANVAS_SIZE,
            (iconSize * scaleFactor) / DOT_CANVAS_SIZE
          );
          has_badge = true;
        }

        if (icon._badge && !has_badge) {
          icon._badge.visible = false;
        }

        // update the dot
        if (icon._appwell && icon._appwell.app.get_n_windows() > 0) {
          let dot = this._dots[dotIndex++];
          icon._dot = dot;
          if (dot) {
            let dotParent = icon._dot.get_parent();
            dot.visible = true;
            dotParent.width = iconSize;
            dotParent.height = iconSize;
            dotParent.set_scale(1, 1);

            if (vertical) {
              if (position == 'right') {
                dotParent.set_position(pos[0] + 8 * scaleFactor, pos[1]);
              } else {
                dotParent.set_position(pos[0] - 8 * scaleFactor, pos[1]);
              }
            } else {
              dotParent.set_position(pos[0], pos[1] + 8 * scaleFactor);
            }
            dot.set_scale(
              (iconSize * scaleFactor) / DOT_CANVAS_SIZE,
              (iconSize * scaleFactor) / DOT_CANVAS_SIZE
            );

            let style =
              running_indicator_style_options[running_indicator_style];

            dot.set_state({
              count: icon._appwell.app.get_n_windows(),
              color: running_indicator_color || [1, 1, 1, 1],
              style: style || 'default',
              rotate: vertical ? (position == 'right' ? -90 : 90) : 0,
            });
          }
        }
      });
    }
  }
);

var DockExtension = GObject.registerClass(
  {},
  class DockExtension extends St.Widget {
    _init(params) {
      super._init({
        reactive: true,
        ...params,
      });

      this.listeners = [];
      this.connectObject(
        'button-press-event',
        this._onButtonEvent.bind(this),
        'motion-event',
        this._onMotionEvent.bind(this),
        'leave-event',
        this._onLeaveEvent.bind(this),
        this
      );
    }

    vfunc_scroll_event(scrollEvent) {
      this._onScrollEvent({}, scrollEvent);
      return Clutter.EVENT_PROPAGATE;
    }

    _onScrollEvent(obj, evt) {
      this.listeners
        .filter((l) => {
          return l._enabled;
        })
        .forEach((l) => {
          if (l._onScrollEvent) l._onScrollEvent(obj, evt);
        });
    }

    _onButtonEvent(obj, evt) {
      this.listeners
        .filter((l) => {
          return l._enabled;
        })
        .forEach((l) => {
          if (l._onButtonEvent) l._onButtonEvent(obj, evt);
        });
    }

    _onMotionEvent() {
      this.listeners
        .filter((l) => {
          return l._enabled;
        })
        .forEach((l) => {
          if (l._onMotionEvent) l._onMotionEvent();
        });
    }

    _onLeaveEvent() {
      this.listeners
        .filter((l) => {
          return l._enabled;
        })
        .forEach((l) => {
          if (l._onLeaveEvent) l._onLeaveEvent();
        });
    }
  }
);

var DockBackground = GObject.registerClass(
  {},
  class DockBackground extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockBackground',
        ...(params || {}),
      });
    }

    update(params) {
      let {
        first,
        last,
        padding,
        iconSize,
        scaleFactor,
        vertical,
        position,
        panel_mode,
        dashContainer,
      } = params;

      padding *= 0.5;

      let p1 = first.get_transformed_position();
      let p2 = last.get_transformed_position();
      if (!isNaN(p1[0]) && !isNaN(p1[1])) {
        // bottom
        this.x = p1[0] - padding;
        this.y = first._fixedPosition[1] - padding; // p1[1] - padding

        if (p2[1] > p1[1]) {
          this.y = p2[1] - padding;
        }
        let width =
          p2[0] -
          p1[0] +
          iconSize * scaleFactor * last._targetScale +
          padding * 2;
        let height = iconSize * scaleFactor + padding * 2;

        if (!isNaN(width)) {
          this.width = width;
        }
        if (!isNaN(width)) {
          this.height = height;
        }

        // vertical
        if (vertical) {
          this.x = p1[0] - padding;
          this.y = first._fixedPosition[1] - padding; // p1[1] - padding

          if (position == 'right' && p2[0] > p1[0]) {
            this.x = p2[0] - padding;
          }
          if (position == 'left' && p2[0] < p1[0]) {
            this.x = p2[0] - padding;
          }

          this.width = iconSize * scaleFactor + padding * 2;
          this.height =
            p2[1] -
            p1[1] +
            iconSize * scaleFactor * last._targetScale +
            padding * 2;

          // log(`${width} ${height}`);
        }

        if (panel_mode) {
          if (vertical) {
            this.y = dashContainer.y;
            this.height = dashContainer.height;
          } else {
            let pad = 0; //dashContainer.cornerPad || 0;
            this.x = dashContainer.x - pad;
            this.width = dashContainer.width + pad * 2;
            this.height++;
          }
        }
      }
    }
  }
);
