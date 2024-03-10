import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';
import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';

import { TintEffect } from './effects/tint_effect.js';
import { MonochromeEffect } from './effects/monochrome_effect.js';

import { DockBackground } from './dockItems.js';
import { Bounce, Linear } from './effects/easing.js';
import { AutoHide } from './autohide.js';
import { Dot } from './apps/dot.js';

const DOT_CANVAS_SIZE = 96;

const Point = Graphene.Point;

export const DockPosition = {
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
};

export const DockAlignment = {
  CENTER: 'center',
  START: 'start',
  END: 'end',
};

const ANIM_POS_COEF = 1.5;
const ANIM_SCALE_COEF = 1.5 * 2;
const ANIM_SPREAD_COEF = 1.25 * 1;
const ANIM_ON_LEAVE_COEF = 2.0;
const ANIM_ICON_RAISE = 0.6;
const ANIM_ICON_SCALE = 1.5;
const ANIM_ICON_HIT_AREA = 2.5;
const ANIM_REENABLE_DELAY = 250;
const ANIM_DEBOUNCE_END_DELAY = 750;
const ANIM_PREVIEW_DURATION = 1200;

export let D2DaDock = GObject.registerClass(
  {},
  class D2DaDock extends St.Widget {
    _init(params) {
      super._init({
        name: 'd2daDock',
        reactive: false,
        track_hover: false,
        width: 0,
        height: 0,
        clip_to_allocation: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.extension = params.extension;
      this.autohide_dash = this.extension.a_dash;
      this.apps_icon = this.extension.apps_icon;
      this.favorites_only = this.extension.favorites_only;

      this._position = DockPosition.BOTTOM;
      // this._position = DockPosition.LEFT;
      this._alignment = DockAlignment.CENTER;
      this._monitorIndex = Main.layoutManager.primaryIndex;

      this._background = new DockBackground({ name: 'd2dlBackground' });
      this.add_child(this._background);

      this.addDash();

      this.dash.reactive = true;
      this.dash.track_hover = true;
      this.dash.connectObject(
        'button-press-event',
        this._onButtonPressEvent.bind(this),
        'motion-event',
        this._onMotionEvent.bind(this),
        'enter-event',
        this._onEnterEvent.bind(this),
        'leave-event',
        this._onLeaveEvent.bind(this),
        'destroy',
        () => {},
        this
      );

      this.dash.opacity = 0;

      this.autohider = new AutoHide();
      this.autohider.dashContainer = this;
      this.autohider.extension = this.extension;
      this.autohider.enable();
    }

    undock() {
      this._endAnimation();
      this.dash._box.remove_effect_by_name('icon-effect');
      this.autohider.disable();
      this.removeFromChrome();
    }

    _onButtonPressEvent(evt) {
      return Clutter.EVENT_PROPAGATE;
    }
    _onMotionEvent(evt) {
      this._beginAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onEnterEvent(evt) {
      this._beginAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onLeaveEvent(evt) {
      this._debounceEndAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onFocusWindow(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onAppsChanged(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }

    _createEffect(idx) {
      let effect = null;
      switch (idx) {
        case 1: {
          effect = new TintEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
        case 2: {
          effect = new MonochromeEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
      }
      return effect;
    }

    _updateIconEffect() {
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
      let effect = this._createEffect(this.extension.icon_effect);
      if (effect) {
        this.dash._box.get_parent().add_effect_with_name('icon-effect', effect);
      }
      this.iconEffect = effect;
    }

    slideIn() {
      this._hidden = false;
      this._beginAnimation();
    }

    slideOut() {
      this._hidden = true;
      this._beginAnimation();
    }

    getMonitor() {
      let m =
        Main.layoutManager.monitors[this._monitorIndex] ||
        Main.layoutManager.primaryMonitor;
      this._monitor = m;
      return m;
    }

    addDash() {
      let dash = new Dash();
      dash._adjustIconSize = () => {};
      this.add_child(dash);
      this.dash = dash;
      this.dash._background.visible = false;
      this.dash._box.clip_to_allocation = false;
      return dash;
    }

    addToChrome() {
      if (this._onChrome) {
        return;
      }

      this._updateIconEffect();

      Main.layoutManager.addChrome(this, {
        affectsStruts: !this.autohide_dash,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      this._onChrome = true;
    }

    removeFromChrome() {
      if (!this._onChrome) {
        return;
      }

      Main.layoutManager.removeChrome(this);
      this._onChrome = false;
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
    }

    isVertical() {
      return (
        this._position == DockPosition.LEFT ||
        this._position == DockPosition.RIGHT
      );
    }

    _preferredIconSize() {
      let preferredIconSizes = this._preferredIconSizes;
      let iconSize = 64;
      if (!preferredIconSizes) {
        preferredIconSizes = [32];
        for (let i = 16; i < 128; i += 4) {
          preferredIconSizes.push(i);
        }
        this._preferredIconSizes = preferredIconSizes;
      }

      iconSize =
        2 *
        (preferredIconSizes[
          Math.floor(this.extension.icon_size * preferredIconSizes.length)
        ] || 64);
      iconSize *= this.extension.scale;

      this._iconSize = iconSize;
      return iconSize;
    }

    _findIcons() {
      if (!this.dash) return [];

      if (this.dash._showAppsIcon) {
        this.dash._showAppsIcon.visible = this.apps_icon;
      }

      if (
        this._icons &&
        this._icons.length >= this.dash._box.get_children().length
      ) {
        return this._icons;
      }

      this._separators = [];

      // hook on showApps
      if (this.dash.showAppsButton && !this.dash.showAppsButton._checkEventId) {
        this.dash.showAppsButton._checkEventId =
          this.dash.showAppsButton.connect('notify::checked', () => {
            if (!Main.overview.visible) {
              Main.uiGroup
                .find_child_by_name('overview')
                ._controls._toggleAppsPage();
            }
          });
      }

      // W: breakable
      let icons = this.dash._box.get_children().filter((actor) => {
        if (!actor.child) {
          let cls = actor.get_style_class_name();
          if (cls === 'dash-separator') {
            // actor.visible = false;
            // actor.width = (this.iconSize / 8) * (this.scaleFactor || 1);
            // actor.height = (this.iconSize / 8) * (this.scaleFactor || 1);
            this._separators.push(actor);
          }
          return false;
        }

        actor._cls = actor.get_style_class_name();

        if (actor.child._delegate && actor.child._delegate.icon) {
          // hook activate function
          if (actor.child.activate && !actor.child._activate) {
            actor.child._activate = actor.child.activate;
            actor.child.activate = () => {
              // this._maybeBounce(actor);
              // this._maybeMinimizeOrMaximize(actor.child.app);
              actor.child._activate();
            };
          }

          return true;
        }
        return false;
      });

      // hide running apps
      if (this.favorites_only) {
        let favorites = Fav.getAppFavorites();
        let favorite_ids = favorites._getIds();
        icons = icons.filter((i) => {
          let app = i.child.app;
          let appId = app ? app.get_id() : '';
          let shouldInclude = favorite_ids.includes(appId);
          i.child.visible = shouldInclude;
          if (!shouldInclude) {
            i.width = -1;
            i.height = -1;
          }
          return shouldInclude;
        });
      }

      icons.forEach((c) => {
        // W: breakable
        let label = c.label;
        let appwell = c.first_child;
        let draggable = appwell._draggable;
        let widget = appwell.first_child;
        let icongrid = widget.first_child;
        let boxlayout = icongrid.first_child;
        let bin = boxlayout.first_child;
        let icon = bin.first_child;

        icongrid.style = 'background: none !important;';

        c._bin = bin;
        c._label = label;
        c._draggable = draggable;
        c._appwell = appwell;
        c._dot = appwell._dot;
        c._dot.opacity = 0;
        if (icon) {
          c._icon = icon;
          c._icon.reactive = true;
          let pv = new Point();
          pv.x = 0.5;
          pv.y = 0.5;
          icon.pivot_point = pv;
        }

        if (!c._dotCanvas) {
          let dot = new Dot(DOT_CANVAS_SIZE);
          let pdot = new St.Widget();
          pdot.add_child(dot);
          dot.set_position(0, 0);
          c.add_child(pdot);
          c._dotCanvas = dot;
        }

        if (!c._badgeCanvas) {
          let dot = new Dot(DOT_CANVAS_SIZE);
          let pdot = new St.Widget();
          pdot.add_child(dot);
          dot.set_position(0, 0);
          c.add_child(pdot);
          c._badgeCanvas = dot;
        }
      });

      try {
        // W: breakable
        let appsButton = this.dash.showAppsButton;
        let appsIcon = this.dash._showAppsIcon;
        if (appsButton && appsIcon) {
          let apps = appsButton.get_parent();
          let widget = appsIcon.child;
          if (widget && widget.width > 0 && widget.get_parent().visible) {
            let icongrid = widget.first_child;
            let boxlayout = icongrid.first_child;
            let bin = boxlayout.first_child;
            let icon = bin.first_child;
            let c = apps;
            c._bin = bin;
            c._icon = icon;
            c._label = widget._delegate.label;
            c._showApps = appsButton;
            // make virtually unclickable
            appsButton.reactive = false;
            // appsButton.width = 1;
            // appsButton.height = 1;
            icons.push(c);
          }
        }
      } catch (err) {
        // could happen if ShowApps is hidden or not yet created?
      }

      this._icons = icons;
      icons.forEach((icon) => {
        if (!icon._destroyConnectId) {
          icon._destroyConnectId = icon.connect('destroy', () => {
            this._icons = null;
          });
        }
      });

      return icons;
    }

    layout() {
      this._icons = this._findIcons();

      let m = this.getMonitor();
      let scaleFactor = m.geometry_scale;
      let vertical = this.isVertical();

      this._scaleFactor = scaleFactor;

      let flags = {
        top: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 1,
          centerY: 0,
        },
        bottom: {
          edgeX: 0,
          edgeY: 1,
          offsetX: 0,
          offsetY: -1,
          centerX: 1,
          centerY: 0,
        },
        left: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
        right: {
          edgeX: 1,
          edgeY: 0,
          offsetX: -1,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
      };
      let f = flags[this._position];

      let width = 1200;
      let height = 140;
      let dock_size_limit = 1;
      let animation_spread = 0.75;
      let animation_magnify = 0.75;

      let iconSize = this._preferredIconSize();
      let iconSizeSpaced =
        iconSize * scaleFactor * (1.2 + animation_spread / 2);

      let projectedWidth =
        iconSize +
        iconSizeSpaced * (this._icons.length > 3 ? this._icons.length : 3);

      let scaleDown = 1.0;
      let limit = vertical ? 0.96 : 0.98;

      let maxWidth = (vertical ? m.height : m.width) * limit;

      if (projectedWidth * scaleFactor > maxWidth * 0.98) {
        scaleDown = (maxWidth - iconSize / 2) / (projectedWidth * scaleFactor);
      }

      iconSize *= scaleDown;
      iconSizeSpaced *= scaleDown;
      projectedWidth *= scaleDown;
      this._projectedWidth = projectedWidth;

      this._edge_distance =
        (this.extension.edge_distance || 0) * 20 * scaleFactor;

      this._icons.forEach((icon) => {
        icon.width = iconSizeSpaced * scaleFactor;
        icon.height = iconSizeSpaced * scaleFactor;
      });

      width = this._projectedWidth * scaleFactor;
      height = iconSizeSpaced * 1.5 * scaleFactor;

      this.width = vertical ? height : width;
      this.height = vertical ? width : height;

      if (this.animated) {
        this.width *= vertical ? 1.5 : 1;
        this.height *= !vertical ? 1.5 : 1;
        this.width += !vertical * iconSizeSpaced * 2.5 * scaleFactor;
        this.height += vertical * iconSizeSpaced * 2.5 * scaleFactor;

        if (this.width > m.width) {
          this.width = m.width;
        }
        if (this.height > m.height) {
          this.height = m.height;
        }
      }

      // console.log(`${width} ${height}`);

      // reposition the dash
      this.dash.last_child.layout_manager.orientation = vertical;
      this.dash._box.layout_manager.orientation = vertical;

      this.x =
        m.x +
        m.width * f.edgeX +
        this.width * f.offsetX +
        (m.width / 2 - this.width / 2) * f.centerX;

      this.y =
        m.y +
        m.height * f.edgeY +
        this.height * f.offsetY +
        (m.height / 2 - this.height / 2) * f.centerY;

      // center the dash
      this.dash.x = this.width / 2 - this.dash.width / 2;
      this.dash.y = this.height / 2 - this.dash.height / 2;

      // hug the edge
      if (vertical) {
        this.dash.x = this.width * f.edgeX + this.dash.width * f.offsetX;
      } else {
        this.dash.y = this.height * f.edgeY + this.dash.height * f.offsetY;
      }

      // resize dash icons
      // console.log(this.dash.height);
      // console.log('---------------');
    }

    animate() {
      this.layout();

      let m = this.getMonitor();
      let pointer = global.get_pointer();
      let vertical = this.isVertical();

      // pointer[0] = m.width / 2;
      // pointer[1] = m.height - 30;

      let [px, py] = pointer;

      let p = new Point();
      p.x = 0.5;
      p.y = 0.5;

      let isWithin = this._isWithinDash([px, py]);
      let animated = isWithin;
      this.animated = animated;

      let animateIcons = this._icons;
      let iconSize = this._iconSize;
      let scaleFactor = this._scaleFactor;

      let nearestIdx = -1;
      let nearestIcon = null;
      let nearestDistance = -1;

      animateIcons.forEach((c) => {
        c._container = c;
        c._pos = this._get_position(c);
      });

      // sort
      let cornerPos = this._get_position(this);
      animateIcons.sort((a, b) => {
        let dstA = this._get_distance(cornerPos, a._pos);
        let dstB = this._get_distance(cornerPos, b._pos);
        return dstA > dstB ? 1 : -1;
      });

      let idx = 0;
      animateIcons.forEach((icon) => {
        let bin = icon._bin;
        let pos = [...icon._pos];

        icon._fixedPosition = [...pos];
        if (!this._dragging && bin.first_child) {
          // bin.first_child.opacity = this.extension._dash_opacity;
          // todo make this small - so as not to mess up the layout
          // however, the icons appear when released from drag
          bin.first_child.width = iconSize * 0.8 * scaleFactor;
          bin.first_child.height = iconSize * 0.8 * scaleFactor;
        }

        icon._icon.set_icon_size(iconSize * this.extension.icon_quality);

        // get nearest
        let bposcenter = [...pos];
        bposcenter[0] += (iconSize * scaleFactor) / 2;
        bposcenter[1] += (iconSize * scaleFactor) / 2;
        let dst = this._get_distance(pointer, bposcenter);

        if (
          isWithin &&
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

        idx++;
      });

      if (!this._preview && !isWithin) {
        nearestIcon = null;
      }

      this._nearestIcon = nearestIcon;

      let didScale = false;

      let off = (iconSize * scaleFactor) / 2;
      animateIcons.forEach((i) => {
        if (!i._pos) return;
        let p = [...i._pos];
        if (!p) return;
        p[0] += off;
        p[1] += off;
        i._pos = p;
      });

      let dockPos = this._get_position(this);

      //------------------------
      // animation behavior
      //------------------------
      let rise = this.extension.animation_rise * ANIM_ICON_RAISE;
      let magnify = this.extension.animation_magnify * ANIM_ICON_SCALE;
      let spread = this.extension.animation_spread;
      if (spread < 0.2) {
        magnify *= 0.8;
      }
      if (magnify > 0.5 && spread < 0.55) {
        spread = 0.55 + spread * 0.2;
      }

      let padding = 10;
      let threshold = (iconSize + padding) * 2.5;

      let iconTable = [];

      // animate
      animateIcons.forEach((icon) => {
        let original_pos = this._get_position(icon._bin);
        icon._pos = [...original_pos];
        icon._translate = 0;

        iconTable.push(icon);

        let scale = 1;
        let dx = original_pos[0] - px;
        if (this.extension._vertical) {
          dx = original_pos[1] - py;
        }
        if (dx * dx < threshold * threshold && nearestIdx != -1) {
          let adx = Math.abs(dx);
          let p = 1.0 - adx / threshold;
          let fp = p * 0.6 * (1 + magnify);
          icon._p = p;

          // affect scale;
          if (magnify != 0) {
            scale += fp;
          }

          // affect rise
          let sz = iconSize * fp;
          if (this.extension._vertical) {
            if (dock_position == 'right') {
              icon._pos[0] -= sz * 0.8 * rise;
            } else {
              icon._pos[0] += sz * 0.8 * rise;
            }
          } else {
            icon._pos[1] -= sz * 0.8 * rise;
          }

          didScale = true;
        }

        icon._scale = scale;
        icon._targetScale = scale;

        // icon.set_size(iconSize, iconSize);
        // if (icon._img) {
        //   icon._img.set_icon_size(iconSize * this.extension.icon_quality);
        // }

        icon._icon.set_size(iconSize, iconSize);
        if (icon._icon._img) {
          icon._icon._img.set_icon_size(iconSize * this.extension.icon_quality);
        }

        if (!icon._pos) {
          return;
        }
      });

      // spread
      for (let i = 0; i < iconTable.length; i++) {
        if (iconTable.length < 2) break;
        let icon = iconTable[i];
        if (icon._scale != 1) {
          // affect spread
          let offset = (icon._scale - 1) * iconSize * spread * 0.8;

          // left
          for (let j = i - 1; j >= 0; j--) {
            let left = iconTable[j];
            left._translate -= offset;
          }
          // right
          for (let j = i + 1; j < iconTable.length; j++) {
            let right = iconTable[j];
            right._translate += offset;
          }
        }
      }

      //-------------------
      // interpolation / animation
      //-------------------
      let _scale_coef = ANIM_SCALE_COEF;
      // let _spread_coef = ANIM_SPREAD_COEF;
      let _pos_coef = ANIM_POS_COEF;
      if (this.extension.animation_fps > 0) {
        _pos_coef /= 1 + this.extension.animation_fps / 2;
        _scale_coef /= 1 + this.extension.animation_fps / 2;
        // _spread_coef /= 1 + this.extension.animation_fps / 2;
      }
      if (!nearestIcon) {
        _scale_coef *= ANIM_ON_LEAVE_COEF;
        _pos_coef *= ANIM_ON_LEAVE_COEF;
        // _spread_coef *= ANIM_ON_LEAVE_COEF;
      }

      animateIcons.forEach((icon) => {
        let scale = icon._icon.get_scale();

        let newScale =
          (icon._targetScale + scale[0] * _scale_coef) / (_scale_coef + 1);
        icon._scale = newScale;

        let pv = new Point();
        pv.x = 0.5;
        pv.y = 1;
        icon._icon.pivot_point = pv;
        icon._icon.set_scale(newScale, newScale);

        let oldX = icon._icon.translationX;
        let oldY = icon._icon.translationY;
        let translationX =
          (oldX + icon._translate * !vertical * _pos_coef) / (_pos_coef + 1);
        let translationY =
          (oldY + icon._translate * vertical * _pos_coef) / (_pos_coef + 1);

        icon._icon.translationX = translationX;
        icon._icon.translationY = translationY;

        // labels
        if (icon._label) {
          icon._label.translationX = translationX;
          icon._label.translationY = translationY - (iconSize / 2) * newScale;
        }

        // badges
        {
          let appNotices = icon._appwell
            ? this.extension.services._appNotices[icon._appwell.app.get_id()]
            : null;
          let noticesCount = 0;
          if (appNotices) {
            noticesCount = appNotices.count;
          }
          // noticesCount = 1;
          let badge = icon._badgeCanvas;
          if (badge) {
            let style = null;
            badge.visible = noticesCount > 0;
            if (badge.visible) {
              badge.set_scale(
                (iconSize * scaleFactor) / DOT_CANVAS_SIZE,
                (iconSize * scaleFactor) / DOT_CANVAS_SIZE
              );

              badge.get_parent().width = iconSize * scaleFactor;
              badge.get_parent().height = iconSize * scaleFactor;
              badge
                .get_parent()
                .set_position(
                  icon._icon.width * 0.65 * icon._icon.scaleX,
                  -icon._icon.height * 0.72 * icon._icon.scaleY
                );

              badge.translationX = icon._icon.translationX;
              badge.translationY = icon._icon.translationY;

              let options = this.extension.notification_badge_style_options;
              let notification_badge_style =
                options[this.extension.notification_badge_style];
              let notification_badge_color =
                this.extension.notification_badge_color;

              badge.set_state({
                count: noticesCount,
                color: notification_badge_color || [1, 1, 1, 1],
                style: notification_badge_style || 'default',
                // rotate: 180,
                // translate: [0, 0],
              });
            }
          }
        }

        // dots
        {
          let appCount = icon._appwell ? icon._appwell.app.get_n_windows() : 0;
          let dot = icon._dotCanvas;
          // appCount = 1;
          if (dot) {
            let style = null;
            dot.visible = appCount > 0;
            if (dot.visible) {
              dot.set_scale(
                (iconSize * scaleFactor) / DOT_CANVAS_SIZE,
                (iconSize * scaleFactor) / DOT_CANVAS_SIZE
              );

              dot.get_parent().width = iconSize * scaleFactor;
              dot.get_parent().height = iconSize * scaleFactor;

              dot.translationX = icon._icon.translationX;
              dot.translationY = icon._icon.translationY;

              let options = this.extension.running_indicator_style_options;
              let running_indicator_style =
                options[this.extension.running_indicator_style];
              let running_indicator_color =
                this.extension.running_indicator_color;

              dot.set_state({
                count: appCount,
                color: running_indicator_color || [1, 1, 1, 1],
                style: running_indicator_style || 'default',
                rotate: vertical ? (this._position == 'right' ? -90 : 90) : 0,
              });
            }
          }
        }
      });

      let targetY = 0;

      if (this._hidden && this.autohide_dash) {
        if (isWithin) {
          this.slideIn();
        }
      }

      // dash hide/show
      if (this._hidden) {
        targetY = this.dash.height + 1 * scaleFactor;
      }

      // dash edge
      targetY -= this._edge_distance;
      this.dash.translationY =
        (this.dash.translationY * _pos_coef + targetY) / (_pos_coef + 1);

      // background
      {
        let padding = iconSize * 0.4;
        this._background.update({
          first: animateIcons[0],
          last: animateIcons[animateIcons.length - 1],
          padding,
          iconSize,
          scaleFactor,
          position: this._position,
          vertical: this.isVertical(),
          // panel_mode: this.extension.panel_mode,
          dashContainer: this,
        });
        this._background.x -= this.x;
        this._background.y -= this.y;
        this._background.translationX =
          this.dash.translationX + this._edge_distance * this.isVertical();
        this._background.translationY =
          this.dash.translationY + this._edge_distance * !this.isVertical();
      }

      Main.panel.first_child.style = 'border:1px solid magenta';
      this.dash.opacity = 255;

      if (didScale) {
        this._debounceEndAnimation();
      }
    }

    _get_position(obj) {
      return [...obj.get_transformed_position()];
    }

    _get_distance_sqr(pos1, pos2) {
      let a = pos1[0] - pos2[0];
      let b = pos1[1] - pos2[1];
      return a * a + b * b;
    }

    _get_distance(pos1, pos2) {
      return Math.sqrt(this._get_distance_sqr(pos1, pos2));
    }

    _isInRect(r, p, pad) {
      let [x1, y1, w, h] = r;
      let x2 = x1 + w;
      let y2 = y1 + h;
      let [px, py] = p;
      return px + pad >= x1 && px - pad < x2 && py + pad >= y1 && py - pad < y2;
    }

    _isWithinDash(p) {
      return this._isInRect([this.x, this.y, this.width, this.height], p, 0);
    }

    _beginAnimation(caller) {
      // if (caller) {
      //   log(`animation triggered by ${caller}`);
      // }

      if (this.extension._hiTimer && this.debounceEndSeq) {
        this.extension._loTimer.runDebounced(this.debounceEndSeq);
        // this.extension._loTimer.cancel(this.debounceEndSeq);
      }

      this.animationInterval = this.extension.animationInterval;
      if (this.extension._hiTimer) {
        if (!this._animationSeq) {
          this._animationSeq = this.extension._hiTimer.runLoop(
            () => {
              this.animate();
            },
            this.animationInterval,
            'animationTimer'
          );
        } else {
          this.extension._hiTimer.runLoop(this._animationSeq);
        }
      }
    }

    _endAnimation() {
      if (this.extension._hiTimer) {
        this.extension._hiTimer.cancel(this._animationSeq);
        this.extension._loTimer.cancel(this.debounceEndSeq);
        Main.panel.first_child.style = '';
      }
    }

    _debounceEndAnimation() {
      if (this.extension._loTimer) {
        if (!this.debounceEndSeq) {
          this.debounceEndSeq = this.extension._loTimer.runDebounced(
            () => {
              this._endAnimation();
            },
            ANIM_DEBOUNCE_END_DELAY + this.animationInterval,
            'debounceEndAnimation'
          );
        } else {
          this.extension._loTimer.runDebounced(this.debounceEndSeq);
        }
      }
    }
  }
);
