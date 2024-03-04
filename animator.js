'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';

const Point = Graphene.Point;

import { TintEffect } from './effects/tint_effect.js';
import { MonochromeEffect } from './effects/monochrome_effect.js';
import { DebugOverlay } from './apps/overlay.js';

import {
  IconsContainer,
  DotsContainer,
  DockExtension,
  DockBackground,
  // explodeDashIcon,
} from './dockItems.js';

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

const FIND_ICONS_SKIP_FRAMES = 16;
const THROTTLE_DOWN_FRAMES = 30;
const THROTTLE_DOWN_DELAY_FRAMES = 20;

const MIN_SCROLL_RESOLUTION = 4;
const MAX_SCROLL_RESOLUTION = 10;

export let Animator = class {
  constructor() {
    this._enabled = false;
  }

  enable() {
    if (this._enabled) return;

    this._scrollCounter = 0;

    this._iconsContainer = new IconsContainer({
      name: 'd2dlIconsContainer',
      offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
      reactive: false,
    });

    this._dotsContainer = new DotsContainer({
      name: 'd2dlDotsContainer',
      reactive: false,
    });
    this._dotsContainer._get_distance = this._get_distance.bind(this);

    this._background = new DockBackground({ name: 'd2dlBackground' });
    this._dockExtension = new DockExtension({ name: 'd2dlReactExtension' });
    this._dockExtension.listeners = this.dashContainer.listeners;
    this._dockExtension.visible = false;

    this._overlay = new DebugOverlay(
      this.dashContainer._monitor.width,
      this.dashContainer._monitor.height
    );
    this._overlay.name = 'debugOverlay';

    this._enabled = true;
    this._dragging = false;
    this._relayout = 20;
    this._showDots = true;
    this._showBadges = true;
    this._throttleDown = 0;
    this._previousFindIndex = 0;

    this._updateIconEffect();

    log('animator enabled');
  }

  disable() {
    if (!this._enabled) return;
    this._endAnimation();

    this.iconEffect = null;

    if (this._iconsContainer) {
      Main.uiGroup.remove_child(this._iconsContainer);
      delete this._iconsContainer;
      this._iconsContainer = null;
      Main.uiGroup.remove_child(this._dotsContainer);
      delete this._dotsContainer;
      Main.uiGroup.remove_child(this._background);
      delete this._background;
      this._dotsContainer = null;
      Main.uiGroup.remove_child(this._dockExtension);
      delete this._dockExtension;
      this._dockExtension = null;
      Main.uiGroup.remove_child(this._overlay);
      delete this._overlay;
      this._overlay = null;
    }

    this._dots = [];

    this._enabled = false;
    log('animator disabled');
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
    this._iconsContainer.remove_effect_by_name('icon-effect');
    let effect = this._createEffect(this.extension.icon_effect);
    if (effect) {
      this._iconsContainer.add_effect_with_name('icon-effect', effect);
    }
    this.iconEffect = effect;
  }

  preview(do_preview) {
    if (do_preview === false) {
      this._preview = null;
    } else {
      this._preview = ANIM_PREVIEW_DURATION;
    }
  }

  relayout() {
    this._previousFind = null;
    this._throttleDown = 0;
    this._relayout = 20;
    this._onEnterEvent();
  }

  _getScaleFactor() {
    // let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let scaleFactor = this.dashContainer._monitor.geometry_scale;
    return scaleFactor;
  }

  _animate() {
    if (!this._iconsContainer || !this.dashContainer) return;
    this.dash = this.dashContainer.dash;

    let icons = this._previousFind;

    // satisfy other extensions
    // compiz effects
    if (!Main.overview.dash.__box) {
      Main.overview.dash.__box = Main.overview.dash._box;
    }
    Main.overview.dash._box = this.dashContainer.dash._box;

    // minimize findIcons call
    this._previousFindIndex++;
    if (!icons || this._dragging || this._previousFindIndex < 0) {
      icons = this._findIcons();
      this._previousFind = icons;
    } else {
      if (this._previousFindIndex > FIND_ICONS_SKIP_FRAMES) {
        this._previousFind = null;
        this._previousFindIndex = 0;
      }
    }

    // get monitor scaleFactor
    let scaleFactor = this._getScaleFactor();
    let iconSize = Math.floor(this.dashContainer.iconSize);
    let iconSpacing = iconSize * (1.2 + this.extension.animation_spread / 4);
    let effective_edge_distance = this.extension._effective_edge_distance;

    if (this._relayout > 0) {
      this.dashContainer.layout();
      this._relayout--;
    }

    if (this._throttleDown) {
      this._throttleDown--;
      if (this._throttleDown > 0 && this._throttleDown < THROTTLE_DOWN_FRAMES) {
        return;
      }
    }

    this._iconsContainer.width = 0;
    this._iconsContainer.height = 0;
    this._dotsContainer.width = 0;
    this._dotsContainer.height = 0;

    let pointer = global.get_pointer();
    let monitor = this.dashContainer._monitor;

    let padEnd = 0;
    let padEndPos = '';
    this.dashContainer.dash.style = '';

    let isWithin = this._isWithinDash(pointer);

    // center the dash
    {
      let width = this.extension._vertical
        ? this.dashContainer.height
        : this.dashContainer.width;

      let dashWidth = this.extension._vertical
        ? this.dashContainer.dash.height
        : this.dashContainer.dash.width;

      if (this.extension._vertical) {
        this.dashContainer.dash.y = width / 2 - dashWidth / 2;
      } else {
        this.dashContainer.dash.x = width / 2 - dashWidth / 2;
      }
    }

    if (this.dashContainer._scaleDownExcess) {
      padEnd =
        this.dashContainer._scaleDownExcess /
        (this.extension._vertical ? 2 : 8);
      let pos = this.extension._vertical ? 'bottom' : 'right';
      this.dashContainer.dash.style += `padding-${pos}: ${padEnd}px;`;
    }

    let pivot = new Point();
    pivot.x = 0.5;
    pivot.y = 1.0;

    let validPosition = this._iconsCount > 1;
    let dock_position = this.dashContainer._position;
    let ix = 0;
    let iy = 1;

    this.dashContainer.dash.opacity = this.extension._dash_opacity;
    this.dashContainer.dash._background.visible = false;

    switch (this.dashContainer._position) {
      case 'top':
        ix = 0;
        iy = -1.0;
        pivot.x = 0.0;
        pivot.y = 0.0;
        break;
      case 'right':
        ix = 1;
        iy = 0;
        pivot.x = 1.0;
        pivot.y = 0.5;
        break;
      case 'bottom':
        break;
      case 'left':
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

    this._iconsContainer.update({
      icons,
      iconSize: iconSize * scaleFactor,
      pivot,
      quality: this.extension.icon_quality,
    });

    icons.forEach((icon) => {
      let { _draggable } = icon;
      if (_draggable && !_draggable._dragBeginId) {
        _draggable._dragBeginId = _draggable.connect('drag-begin', () => {
          this._dragging = true;
          this._dragged = icon;
        });
        _draggable._dragEndId = _draggable.connect('drag-end', () => {
          this._dragging = false;
          this._previousFindIndex = -FIND_ICONS_SKIP_FRAMES;
        });
      }
    });

    let nearestIdx = -1;
    let nearestIcon = null;
    let nearestDistance = -1;

    let animateIcons = this._iconsContainer.get_children();
    animateIcons = this._iconsContainer.get_children().filter((c) => {
      return c._bin && c._icon && c.visible;
    });

    let firstIcon = animateIcons[0];

    animateIcons.forEach((c) => {
      if (this.extension.services) {
        this.extension.services.updateIcon(c._icon, { scaleFactor });
      }
      c._pos = this._get_position(c._bin);
    });

    // sort
    let cornerPos = this._get_position(this.dashContainer);
    animateIcons.sort((a, b) => {
      let dstA = this._get_distance(cornerPos, a._pos);
      let dstB = this._get_distance(cornerPos, b._pos);
      return dstA > dstB ? 1 : -1;
    });

    let idx = 0;
    animateIcons.forEach((icon) => {
      // if (this.extension._vertical) {
      //   icon._pos[0] = this.dashContainer.x;
      //   if (this.dashContainer._position == 'right') {
      //     icon._pos[0] += this.dashContainer._dashHeight / 2;
      //     icon._pos[0] += this.dashContainer._dockPadding;
      //     icon._pos[0] -= (iconSize / 2) * scaleFactor;
      //   } else {
      //     icon._pos[0] += effective_edge_distance;
      //     icon._pos[0] += this.dashContainer._dashHeight / 2;
      //     icon._pos[0] -= (iconSize / 2) * scaleFactor;
      //   }
      // } else {
      //   icon._pos[1] = this.dashContainer.y;
      //   icon._pos[1] += this.dashContainer._dashHeight / 2;
      //   icon._pos[1] += this.dashContainer._dockPadding;
      //   icon._pos[1] -= (iconSize / 2) * scaleFactor;
      // }

      let bin = icon._bin;
      let pos = [...icon._pos];

      icon._fixedPosition = [...pos];
      if (!this._dragging && bin.first_child) {
        bin.first_child.opacity = this.extension._dash_opacity;
        // todo make this small - so as not to mess up the layout
        // however, the icons appear when released from drag
        bin.first_child.width = iconSize * 0.8 * scaleFactor;
        bin.first_child.height = iconSize * 0.8 * scaleFactor;
      }

      icon.set_size(iconSize, iconSize);
      if (icon._img) {
        icon._img.set_icon_size(iconSize * this.extension.icon_quality);
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
      icon._targetSpread = iconSpacing * scaleFactor;

      if (icon === firstIcon) {
        if (this.extension._vertical) {
          if (pos[1] > this.dashContainer.dash.y + iconSize * 2) {
            validPosition = false;
          }
        } else {
          if (pos[0] > this.dashContainer.dash.x + iconSize * 2) {
            validPosition = false;
          }
        }
      }

      idx++;
    });

    if (this._dragging) {
      nearestIdx = -1;
      nearestIcon = null;
    }

    // preview mode
    // simulate animation at hovering middle icon
    if (this._preview && this._preview > 0) {
      nearestIdx = Math.floor(animateIcons.length / 2);
      nearestIcon = animateIcons[nearestIdx];
      nearestDistance = 0;
      this._preview -= this.animationInterval;
    } else {
      this._preview = null;
    }

    if (isWithin) {
      this._isWithinCount = (this._isWithinCount || 0) + 1;
    } else {
      this._isWithinCount = 0;
    }

    if (!this._preview && !isWithin) {
      nearestIcon = null;
    }

    this._nearestIcon = nearestIcon;

    //---------------------
    // disable animation when:
    //---------------------
    // dragging
    if (
      this._dragging ||
      !this.extension.animate_icons_unmute ||
      this.extension.animation_rise +
        this.extension.animation_magnify +
        this.extension.animation_spread ==
        0
    ) {
      nearestIcon = null;
    }

    // when hidden and not peeking
    if (!this.extension.peek_hidden_icons) {
      if (
        this.extension.autohider &&
        this.extension.autohider._enabled &&
        !this.extension.autohider._shown
      ) {
        nearestIcon = null;
      }
    }

    let didAnimate = false;
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

    if (!nearestIcon) {
      this._overlay.visible = false;
    }

    let px = pointer[0];
    let py = pointer[1];
    if (this._preview > 0 && nearestIcon) {
      px = nearestIcon._pos[0];
      py = nearestIcon._pos[1];
    }

    // icons will spreadout when pointer hovers over the dash
    let icon_spacing =
      iconSize * (1.2 + this.extension.animation_spread / 4) * scaleFactor;

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

    if (nearestIdx != -1) {
      // if (!this.dash.has_style_class_name('dash-spread')) {
      // }
      this.dash.add_style_class_name('dash-spread');
    } else {
      this.dash.remove_style_class_name('dash-spread');
    }

    let padding = 10;
    let threshold = (iconSize + padding) * 2.5;

    let iconTable = [];

    // animate
    animateIcons.forEach((icon) => {
      let original_pos = this._get_position(icon._bin);
      icon._pos = [...original_pos];

      iconTable.push(icon);

      // hide dash icons
      icon._container.opacity = 0;

      let scale = 1;
      let dx = original_pos[0] - px;
      if (this.extension._vertical) {
        dx = original_pos[1] - py;
      }
      if (dx * dx < threshold * threshold && nearestIdx != -1) {
        let adx = Math.abs(dx);
        let p = 1.0 - adx / threshold;
        let fp = p * 0.6 * (1 + magnify);

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
      // icon.set_scale(scale, scale);
      icon._scale = scale;
      icon._targetScale = scale;

      icon.set_size(iconSize, iconSize);
      if (icon._img) {
        icon._img.set_icon_size(iconSize * this.extension.icon_quality);
      }

      if (!icon._pos) {
        return;
      }

      // icon.set_position(icon._pos[0], icon._pos[1]);
    });

    // spread
    for (let i = 0; i < iconTable.length; i++) {
      let icon = iconTable[i];
      if (icon._scale != 1) {
        // affect spread
        let offset = (icon._scale - 1) * iconSize * spread * 0.8;

        // left
        for (let j = i - 1; j >= 0; j--) {
          let left = iconTable[j];
          let pos = left._pos;
          if (this.extension._vertical) {
            if (dock_position == 'right') {
              pos[1] = pos[1] - offset;
            } else {
              pos[1] = pos[1] + offset;
            }
          } else {
            pos[0] = pos[0] - offset;
          }
          left._pos = pos;
        }
        // right
        for (let j = i + 1; j < iconTable.length; j++) {
          let right = iconTable[j];
          let pos = right._pos;
          if (this.extension._vertical) {
            if (dock_position == 'right') {
              pos[1] = pos[1] - offset;
            } else {
              pos[1] = pos[1] + offset;
            }
          } else {
            pos[0] = pos[0] + offset;
          }
          right._pos = pos;
        }
      }
    }

    let _scale_coef = ANIM_SCALE_COEF;
    let _spread_coef = ANIM_SPREAD_COEF;
    let _pos_coef = ANIM_POS_COEF;
    if (this.extension.animation_fps > 0) {
      _pos_coef /= 1 + this.extension.animation_fps / 2;
      _scale_coef /= 1 + this.extension.animation_fps / 2;
      _spread_coef /= 1 + this.extension.animation_fps / 2;
    }
    if (!nearestIcon) {
      _scale_coef *= ANIM_ON_LEAVE_COEF;
      _pos_coef *= ANIM_ON_LEAVE_COEF;
      _spread_coef *= ANIM_ON_LEAVE_COEF;
    }

    // check if initial animation
    let tooFar = false;
    animateIcons.forEach((icon) => {
      let pos = icon.get_position();
      // too far
      let dst = Math.abs(pos[0] - icon._pos[0]);
      if (dst > iconSize * 2 * scaleFactor) {
        tooFar = true;
      }
    });

    let bgOpacity = 255;

    // interpolate
    // animate
    animateIcons.forEach((icon) => {
      let pos = icon.get_position();
      let newX = (icon._pos[0] + pos[0] * _pos_coef) / (_pos_coef + 1);
      let newY = icon._pos[1]; // (icon._pos[1] + pos[1] * 2)/ 3;

      // fade in
      if (icon.opacity < 255) {
        let opacity = icon.opacity;
        if (opacity < 10) {
          opacity = 10;
        }
        opacity++;
        opacity *= 1.15;
        if (opacity >= 255) {
          opacity = 255;
        }
        icon.opacity = opacity;
        bgOpacity = opacity;
      } else {
        icon.opacity =
          this._dragging && this._dragged == icon._container ? 50 : 255;
      }

      if (tooFar) {
        icon.opacity = 0;
        [newX, newY] = icon._pos;
      }

      icon.set_position(newX, newY);
      icon._pos = [newX, newY];

      let scale = icon.get_scale();
      let newScale =
        (icon._targetScale + scale[0] * _scale_coef) / (_scale_coef + 1);
      icon.set_scale(newScale, newScale);

      // reposition labels
      if (!isNaN(newX) && !isNaN(newY)) {
        // todo find appsButton._label
        if (icon._label && !this._dragging) {
          if (icon == nearestIcon) {
            let lw = icon._label.width;
            if (isNaN(lw)) {
              lw = 200;
            }
            switch (dock_position) {
              case 'left':
                icon._label.x = newX + iconSize * scale[0] * 1.1 * scaleFactor;
                break;
              case 'right':
                icon._label.x = newX - iconSize * scale[0] * 1.1 * scaleFactor;
                icon._label.x -= lw / 1.2;
                break;
              case 'bottom':
                icon._label.x = (-lw / 2 + icon.width / 2) * scaleFactor + newX;
                icon._label.y = newY - iconSize * scale[0] * 0.9 * scaleFactor;
                break;
            }
            if (this.extension._vertical) {
              icon._label.y = newY;
            }
          }
        }
      }
    });

    this._dotsContainer.update({
      icons: animateIcons,
      iconSize,
      scaleFactor,
      vertical: this.extension._vertical,
      position: this.dashContainer._position,
      // dots
      dotsCount: this._dotsCount,
      running_indicator_style_options:
        this.extension.running_indicator_style_options,
      running_indicator_style: this.extension.running_indicator_style,
      running_indicator_color: this.extension.running_indicator_color,
      // badges
      pivot: pivot,
      appNotices: this.extension.services._appNotices,
      notification_badge_style_options:
        this.extension.notification_badge_style_options,
      notification_badge_style: this.extension.notification_badge_style,
      notification_badge_color: this.extension.notification_badge_color,
    });

    if (validPosition && animateIcons.length > 1) {
      let padding = iconSize * 0.4;
      this._background.update({
        first: animateIcons[0],
        last: animateIcons[animateIcons.length - 1],
        padding,
        iconSize,
        scaleFactor,
        position: this.dashContainer._position,
        vertical: this.extension._vertical,
        panel_mode: this.extension.panel_mode,
        dashContainer: this.dashContainer,
      });
      this._background.opacity = bgOpacity;

      if (this.extension._disable_borders && this._background.width > 0) {
        this.extension._disable_borders = false;
        this.extension._updateStyle();
      }

      // shadows the background
      this._dockExtension.width = this._background.width;
      this._dockExtension.height = this._background.height;
      this._dockExtension.x = this._background.x;
      this._dockExtension.y = this._background.y;
      switch (dock_position) {
        case 'left':
          this._dockExtension.x += this._dockExtension.width;
          this._dockExtension.width /= 2;
          break;
        case 'right':
          this._dockExtension.width /= 2;
          this._dockExtension.x -= this._dockExtension.width;
          break;
        case 'bottom':
          this._dockExtension.height /= 2;
          this._dockExtension.y -= this._dockExtension.height;
          break;
        case 'top':
          break;
      }
    }

    // show when ready
    if (validPosition && !this._isInFullscreen()) {
      this._iconsContainer.show();
      this._dotsContainer.show();
      this._background.show();
    }

    this._invisible(!validPosition);

    if (this.extension.debug_visual) {
      Main.panel.first_child.style = didAnimate
        ? 'border:1px solid magenta'
        : '';
      this._dockExtension.style = Main.panel.first_child.style;
    }

    if (didScale || this._dragging) {
      this._debounceEndAnimation();
    }
    if (!didAnimate && !this._dragging && this._throttleDown <= 0) {
      this._throttleDown = THROTTLE_DOWN_FRAMES + THROTTLE_DOWN_DELAY_FRAMES;
    }

    this._didAnimate = didAnimate;
  }

  _findIcons() {
    let icons = this.dashContainer._findIcons();

    this._dotsCount = 0;
    this._iconsCount = icons.length;

    icons.forEach((c) => {
      if (c._label) {
        // c._label.opacity = 0;
      }
      if (c._appwell) {
        let wc = c._appwell.app.get_n_windows();
        if (wc > 0) {
          this._dotsCount++;
        }
      }
    });

    // todo: fix: too elaborate a hack to suppress initial dock display- when icons are not yet ready
    if (icons.length <= 1) {
      // only the ShowAppsButton is visible?... dash not yet ready
      this._invisible(true);
      if (!this.debounceReadySeq) {
        this.debounceReadySeq = this.extension._loTimer.runDebounced(() => {
          this._invisible(false);
          this._startAnimation();
        }, 100);
      } else {
        this.extension._loTimer.runDebounced(this.debounceReadySeq);
      }

      return [];
    }
    return icons;
  }

  _invisible(hide, lock) {
    if (lock !== undefined) {
      this._lock = lock;
    }
    if (this._lock === true && this._isHidden) return;
    this._isHidden = hide;
    this._iconsContainer.opacity = hide ? 0 : 255;
    this._dotsContainer.opacity = hide ? 0 : 255;
    this._background._opacity = hide ? 0 : 255;

    if (this._background._opacity != 0) {
      this._background.opacity =
        (this._background._opacity + this._background.opacity * 10) / 11;
    } else {
      this._background.opacity = 0;
    }
  }

  // todo move to util
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

  _beginAnimation(caller) {
    // if (caller) {
    //   log(`animation triggered by ${caller}`);
    // }

    if (this.extension._hiTimer && this.debounceEndSeq) {
      this.extension._loTimer.runDebounced(this.debounceEndSeq);
      // this.extension._loTimer.cancel(this.debounceEndSeq);
    }

    this._throttleDown = 0;

    if (this._dockExtension && this.extension.animate_icons_unmute) {
      this._dockExtension.visible = true;
    }

    this.animationInterval = this.extension.animationInterval;
    if (this.extension._hiTimer) {
      if (!this._animationSeq) {
        this._animationSeq = this.extension._hiTimer.runLoop(
          () => {
            this._animate();
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
    }
    this._relayout = 0;
    if (this._dockExtension) {
      this._dockExtension.visible = false;
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

  _onButtonEvent(obj, evt) {
    let pressed = evt.type() == Clutter.EventType.BUTTON_PRESS;
    let button1 = (evt.get_state() & Clutter.ModifierType.BUTTON1_MASK) != 0;
    let shift = (evt.get_state() & Clutter.ModifierType.SHIFT_MASK) != 0;
    let button = button1 ? 'left' : 'right';
    let pointer = global.get_pointer();

    if (this._nearestIcon) {
      let icon = this._nearestIcon;
      // log(`${button} ${pressed} - (${icon._pos}) (${pointer})`);
      if (icon._appwell) {
        if (button == 'left') {
          icon._appwell.emit('clicked', {});
        } else {
          icon._appwell.popupMenu();
        }
      } else if (icon._showApps) {
        if (Main.overview.visible) {
          Main.overview.hide();
        } else {
          icon._showApps.checked = !icon._showApps.checked;
        }
      }
    }
  }

  _onScrollEvent(obj, evt) {
    this._lastScrollEvent = evt;
    let pointer = global.get_pointer();
    if (this._nearestIcon) {
      if (this._scrollCounter < -2 || this._scrollCounter > 2)
        this._scrollCounter = 0;

      let icon = this._nearestIcon;
      // log(`scroll - (${icon._pos}) (${pointer})`);
      let SCROLL_RESOLUTION =
        MIN_SCROLL_RESOLUTION +
        MAX_SCROLL_RESOLUTION -
        (MAX_SCROLL_RESOLUTION * this.extension.scroll_sensitivity || 0);
      if (icon._appwell && icon._appwell.app) {
        this._lastScrollObject = icon;
        let direction = evt.get_scroll_direction();
        switch (direction) {
          case Clutter.ScrollDirection.UP:
          case Clutter.ScrollDirection.LEFT:
            this._scrollCounter += 1 / SCROLL_RESOLUTION;
            break;
          case Clutter.ScrollDirection.DOWN:
          case Clutter.ScrollDirection.RIGHT:
            this._scrollCounter -= 1 / SCROLL_RESOLUTION;
            break;
        }
        this._cycleWindows(icon._appwell.app, evt);
      }
    }
  }

  _isWithinDash(p) {
    let pad = 0;
    let x1 = this._dockExtension.x;
    let y1 = this._dockExtension.y;
    let x2 = this.dashContainer.x + this.dashContainer.width;
    let y2 = this.dashContainer.y + this.dashContainer.height;
    if (this.extension._vertical) {
      x1 = this.dashContainer.x;
      x2 += this.dashContainer.width + this._dockExtension.width;
      y1 = this.dashContainer.y;
    }
    let [px, py] = p;
    return px + pad >= x1 && px - pad < x2 && py + pad >= y1 && py - pad < y2;
  }

  _onMotionEvent() {
    this._preview = null;
    this._onEnterEvent();
  }

  _onEnterEvent() {
    this._startAnimation();
  }

  _onLeaveEvent() {
    this._debounceEndAnimation();
  }

  _onFocusWindow() {
    this.extension._loTimer.runOnce(() => {
      let prevDots = this._dotsCount;
      let prevIconsCount = this._iconsCount;

      this._findIcons();

      if (this._iconsCount != prevIconsCount || prevDots != this._dotsCount) {
        // log(`${prevDots} ${prevIconsCount}`);
        // log(`>>${this._dotsCount} ${this._iconsCount}`);

        this._endAnimation();
        this._startAnimation();
        this.relayout();
        // animate the added icon
      }
      prevDots = this._dotsCount;
      prevIconsCount = this._iconsCount;
    }, 150);
  }

  _onFullScreen() {
    if (!this._iconsContainer) return;
    if (!this._isInFullscreen()) {
      this.dashContainer.reactiveChild.show();
      this._iconsContainer.show();
      this._dotsContainer.show();
      this._background.show();
    } else {
      this.dashContainer.reactiveChild.hide();
      this._iconsContainer.hide();
      this._dotsContainer.hide();
      this._background.hide();
    }
  }

  _isInFullscreen() {
    let monitor = this.dashContainer._monitor;
    return monitor.inFullscreen;
  }

  // todo: drop and just use beginAnimation which debouncesEndAnimation?
  _startAnimation() {
    this._beginAnimation();
    // this._debounceEndAnimation();
  }

  _lockCycle() {
    if (this._lockedCycle) return;
    this._lockedCycle = true;
    this.extension._hiTimer.runOnce(() => {
      this._lockedCycle = false;
    }, 500);
  }

  _cycleWindows(app, evt) {
    if (this._lockedCycle) {
      this._scrollCounter = 0;
      return false;
    }

    let focusId = 0;
    let workspaceManager = global.workspace_manager;
    let activeWs = workspaceManager.get_active_workspace();

    let windows = app.get_windows();

    if (evt.modifier_state & Clutter.ModifierType.CONTROL_MASK) {
      windows = windows.filter((w) => {
        return activeWs == w.get_workspace();
      });
    }

    let nw = windows.length;
    windows.sort((w1, w2) => {
      return w1.get_id() > w2.get_id() ? -1 : 1;
    });

    if (nw > 1) {
      for (let i = 0; i < nw; i++) {
        if (windows[i].has_focus()) {
          focusId = i;
        }
        if (windows[i].is_hidden()) {
          windows[i].unminimize();
          windows[i].raise();
        }
      }

      let current_focus = focusId;

      if (this._scrollCounter < -1 || this._scrollCounter > 1) {
        focusId += Math.round(this._scrollCounter);
        if (focusId < 0) {
          focusId = nw - 1;
        }
        if (focusId >= nw) {
          focusId = 0;
        }
        this._scrollCounter = 0;
      }

      if (current_focus == focusId) return;
    } else if (nw == 1) {
      if (windows[0].is_hidden()) {
        windows[0].unminimize();
        windows[0].raise();
      }
    }

    let window = windows[focusId];
    if (window) {
      this._lockCycle();
      if (activeWs == window.get_workspace()) {
        window.raise();
        window.focus(0);
      } else {
        activeWs.activate_with_focus(window, global.get_current_time());
      }
    }
  }
};
