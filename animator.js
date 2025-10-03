'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Graphene from 'gi://Graphene';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
const Point = Graphene.Point;

import { Dot } from './apps/dot.js';
import { DockPosition } from './dock.js';
import { Vector } from './vector.js';

import { DockItemDotsOverlay, DockItemBadgeOverlay } from './dockItems.js';
import { Bounce, Linear } from './effects/easing.js';
import {
  get_distance_sqr,
  get_distance,
  isInRect,
  isOverlapRect,
} from './utils.js';

const ANIM_POSITION_PER_SEC = 450 / 1000;
const ANIM_SIZE_PER_SEC = 250 / 1000;
const ANIM_ICON_RAISE = 0.6;
const ANIM_ICON_SCALE = 1.5;
const ANIM_ICON_HIT_AREA = 2.5;

const DOT_CANVAS_SIZE = 96;

export let Animator = class {
  enable() {
    if (!this._renderers) {
      this._renderers = [];
      this._dots = [];
      this._badges = [];
    }
  }

  disable() {
    if (this._target) {
      this._target.remove_all_children();
    }
    if (!this._renderers) {
      this._renderers = [];
      this._dots = [];
      this._badges = [];
    }
  }

  _precreateResources(dock) {
    if (!dock._icons) {
      return false;
    }

    let count = dock._icons.length;
    if (dock.renderArea.get_children().length == 0) {
      this._renderers = [];
      this._dots = [];
      this._badges = [];
    }
    this._target = dock.renderArea;

    while (this._renderers.length < count) {
      // renderer
      let target = dock.renderArea;
      let renderer = new St.Icon({
        icon_name: 'file',
        style_class: 'renderer_icon',
        reactive: true,
      });
      renderer.visible = false;
      target.add_child(renderer);
      this._renderers.push(renderer);

      // dot
      let dots = new DockItemDotsOverlay(new Dot(DOT_CANVAS_SIZE));
      dots.visible = false;
      target.add_child(dots);
      this._dots.push(dots);

      // badges
      let badge = new DockItemBadgeOverlay(new Dot(DOT_CANVAS_SIZE));
      badge.visible = false;
      target.add_child(badge);
      this._badges.push(badge);
    }

    for (let i = dock._icons.length; i < this._renderers.length; i++) {
      this._renderers[i].visible = false;
      this._dots[i].visible = false;
      this._badges[i].visible = false;
    }

    return true;
  }

  //! begin optimization
  animate(dt) {
    let dock = this.dock;
    if (dock._hoveredIcon) {
      dock._lastHoveredIcon = dock._hoveredIcon;
    }

    let simulation = false;

    if (!dock.layout()) {
      console.log('unable to layout()');
      return;
    }

    if (!this._precreateResources(dock)) {
      return;
    }

    // opacity
    let didFadeIn = false;
    if (dock.opacity < 255) {
      let opacityPerSecond = 255 / 500;
      didFadeIn = true;
      let dst = 255 - dock.opacity;
      let mag = Math.abs(dst);
      let dir = Math.sign(dst);
      if (opacityPerSecond > mag / dt) {
        opacityPerSecond = mag / dt;
      }
      dock.opacity += Math.floor(opacityPerSecond * dt * dir);
      if (dock.renderArea.opacity < 255 && dock.opacity > 50) {
        dock.renderArea.opacity = dock.opacity;
      }
    }

    let m = dock.getMonitor();
    let pointer = global.get_pointer();

    // simulated or transformed pointers
    if (dock.extension.simulated_pointer) {
      pointer = [...dock.extension.simulated_pointer];
      simulation = true;
    }
    if (dock.simulated_pointer) {
      pointer = [...dock.simulated_pointer];
      simulation = true;
    }
    // disable icon scale animation upon hovering an item
    if (
      dock._list &&
      dock._list.visible &&
      dock._list._box &&
      dock._lastHoveredIcon == dock._list._target
    ) {
      pointer[1] -= dock._iconSize * dock._scaleFactor;
    }

    let [px, py] = pointer;

    let vertical = dock.isVertical();
    let isWithin = dock._isWithinDash([px, py]);

    if (m.inFullscreen) {
      isWithin = false;
    }

    let animated = isWithin;
    dock.animated = animated;

    let animateIcons = dock._icons;
    let iconSize = dock._iconSizeScaledDown;
    let scaleFactor = dock._scaleFactor;

    let nearestIdx = -1;
    let nearestIcon = null;
    let nearestDistance = -1;

    let iconCenterOffset = (iconSize * scaleFactor) / 2;
    let hitArea = iconSize * ANIM_ICON_HIT_AREA * scaleFactor;
    hitArea *= hitArea;

    let idx = 0;
    animateIcons.forEach((icon) => {
      let pos = icon.get_transformed_position();
      icon._pos = [...pos];
      icon._fixedPosition = [...pos];

      // get nearest
      let bposcenter = [...pos];
      bposcenter[0] += iconCenterOffset;
      bposcenter[1] += iconCenterOffset;
      let dst = get_distance_sqr(pointer, bposcenter);

      if (
        isWithin &&
        (nearestDistance == -1 || nearestDistance > dst) &&
        dst < hitArea
      ) {
        nearestDistance = dst;
        nearestIcon = icon;
        nearestIdx = idx;
        icon._distance = dst;
      }

      icon._target = pos;
      icon._targetScale = 1;

      icon._idx = idx++;
    });

    let noAnimation = !dock.extension.animate_icons_unmute;
    if (dock._dragging) {
      noAnimation = true;
      isWithin = true;
    }
    if ((!simulation && !isWithin) || noAnimation) {
      nearestIcon = null;
    }
    dock._nearestIcon = nearestIcon;

    let didScale = false;
    let didBounce = false;

    //------------------------
    // animation behavior
    //------------------------
    let edge_distance = dock._edge_distance;
    let rise = dock.extension.animation_rise * ANIM_ICON_RAISE;
    let magnify = dock.extension.animation_magnify * ANIM_ICON_SCALE;
    let spread = dock.extension.animation_spread;

    // when not much spreading, minimize magnification
    if (spread < 0.2) {
      magnify *= 0.8;
    }
    // when too much magnification, increase spreading
    if (magnify > 0.5 && spread < 0.55) {
      spread = 0.55 + spread * 0.2;
    }

    let threshold = (iconSize + 10) * 2.5 * scaleFactor;
    if (animated && edge_distance < 0) {
      edge_distance = 0;
    }

    // animate
    let iconTable = [];
    animateIcons.forEach((icon) => {
      let original_pos = [...icon._pos];

      // used by background resizing and repositioning
      icon._fixedPosition = [...original_pos];

      original_pos[0] += icon.width / 2;
      original_pos[1] += icon.height / 2;

      icon._pos = [...original_pos];
      icon._translate = 0;
      icon._translateRise = 0;

      iconTable.push(icon);

      let scale = 1;
      let dx = original_pos[0] - px;
      if (vertical) {
        dx = original_pos[1] - py;
      }

      //! _p replace with a more descriptive variable name
      icon._p = 0;
      if (dx * dx < threshold * threshold && nearestIcon) {
        let adx = Math.abs(dx);
        let p = 1.0 - adx / threshold;
        let fp = p * 0.6 * (1 + magnify);
        icon._p = p;

        // affect scale;
        if (magnify != 0) {
          scale += fp;
        }

        // affect rise
        let sz = iconSize * fp * scaleFactor;
        icon._translateRise = sz * 0.1 * rise;

        didScale = true;
      }

      icon._scale = scale;
      icon._targetScale = scale;

      //! what is the difference between set_size and set_icon_size? and effects
      // set_icon_size resizes the image... avoid changing per frame
      // set_size resizes the widget
      // icon._icon.set_size(iconSize * scale, iconSize * scale);

      //! png image makes this extremely slow -- this may be the cause of "lag" experienced by some users
      //! some themes or apps use PNG instead of SVG... set_scale is apparently resource hog
      if (
        icon._icon.gicon &&
        icon._icon.gicon.file != null &&
        !icon._icon.gicon.file.get_path()?.toLowerCase().endsWith('svg')
      ) {
        // skip scaling image files!... too costly
      } else {
        icon._icon.set_scale(scale, scale);
      }

      if (!icon._pos) {
        return;
      }
    });

    // spread
    //! use better collision test here?
    let hoveredIcon = null;
    for (let i = 0; i < iconTable.length; i++) {
      if (iconTable.length < 2) break;
      let icon = iconTable[i];
      if (icon._icon && icon._icon.hover) {
        hoveredIcon = icon;
      }
      if (icon._scale > 1.1) {
        // affect spread
        let offset =
          1.25 * (icon._scale - 1) * iconSize * scaleFactor * spread * 0.8;
        let o = offset;
        // left
        for (let j = i - 1; j >= 0; j--) {
          let left = iconTable[j];
          left._translate -= offset;
          o *= 0.98;
        }
        // right
        o = offset;
        for (let j = i + 1; j < iconTable.length; j++) {
          let right = iconTable[j];
          right._translate += offset;
          o *= 0.98;
        }
      }
    }

    // re-center to hovered icon
    dock._hoveredIcon = hoveredIcon;
    let TRANSLATE_COEF = 24;
    if (nearestIcon) {
      nearestIcon._targetScale += 0.1;
      let adjust = nearestIcon._translate / 2;
      animateIcons.forEach((icon) => {
        if (icon._scale > 1) {
          let o = -adjust * (2 - icon._scale);
          let nt = icon._translate - o;
          icon._translate =
            (icon._translate * TRANSLATE_COEF + nt) / (TRANSLATE_COEF + 1);
        }
      });
    }

    //-------------------
    // interpolation / animation
    //-------------------
    let renderOffset = dock.renderArea.get_transformed_position();

    let first = animateIcons[0];
    let last = animateIcons[animateIcons.length - 1];

    let slowDown = 1; // !nearestIcon || !animated ? 0.75 : 1;
    let lockPosition =
      didScale && first && last && first._p == 0 && last._p == 0;

    animateIcons.forEach((icon) => {
      // this fixes jittery hovered icon
      if (icon._targetScale > 1.9) icon._targetScale = 2;

      icon._scale = icon._targetScale;

      //! make these computation more readable even if more verbose
      let rdir =
        dock._position == DockPosition.TOP ||
        dock._position == DockPosition.LEFT
          ? 1
          : -1;

      let translationX = icon._translate;
      let translationY = icon._translateRise * rdir;
      if (vertical) {
        translationX = icon._translateRise * rdir;
        translationY = icon._translate;
      }

      //-------------------
      // animate position
      //-------------------
      {
        let speed = ANIM_POSITION_PER_SEC * slowDown;
        let targetPosition = new Vector([translationX, translationY, 0]);
        let currentPosition = new Vector([
          icon._icon.translationX,
          icon._icon.translationY,
          0,
        ]);
        let dst = targetPosition.subtract(currentPosition);
        let mag = dst.magnitude();
        if (mag > 0) {
          dst = dst.normalize();
        }
        let accelVector = new Vector([0, 0, 0]);
        let deltaVector = dst.multiplyScalar(speed * dt);
        let deltaMag = deltaVector.magnitude();
        let appliedVector = new Vector([targetPosition.x, targetPosition.y, 0]);
        appliedVector = appliedVector.add(accelVector);
        if (deltaMag < mag && deltaMag > 10) {
          appliedVector = currentPosition.add(deltaVector);
        }
        translationX = appliedVector.x;
        translationY = appliedVector.y;
        icon._deltaVector = appliedVector;
      }

      // fix jitterness
      if (lockPosition && icon._p == 0) {
        icon._positionCache = icon._positionCache || [];
        if (icon._positionCache.length > 16) {
          [translationX, translationY] =
            icon._positionCache[icon._positionCache.length - 1];
        } else {
          icon._positionCache.push([translationX, translationY]);
        }
      } else {
        icon._positionCache = null;
      }

      icon._icon.translationX = (icon._icon.translationX + translationX) / 2;
      icon._icon.translationY = (icon._icon.translationY + translationY) / 2;

      // clear bounce animation
      if (icon._appwell) {
        icon._appwell.translationY = 0;
        if (icon._appwell._bounce) {
          didBounce = true;
        }
      }

      //--------------
      // renderer
      //--------------
      // dock.renderArea.opacity = 100;
      {
        let icon_name = icon._icon.icon_name;
        let app_name =
          icon._appwell?.app?.app_info?.get_id()?.replace('.desktop', '') ??
          null;
        let gicon = null;

        // override icons here
        if (dock.extension.icon_map || dock.extension.app_map) {
          // override via icon name
          if (
            dock.extension.icon_map_cache &&
            dock.extension.icon_map_cache[icon_name]
          ) {
            gicon = dock.extension.icon_map_cache[icon_name];
          }
          if (
            !gicon &&
            dock.extension.icon_map &&
            dock.extension.icon_map[icon_name]
          ) {
            icon_name = dock.extension.icon_map[icon_name];
          }

          // override via app name
          if (
            app_name &&
            dock.extension.app_map_cache &&
            dock.extension.app_map_cache[app_name]
          ) {
            gicon = dock.extension.app_map_cache[app_name];
          }
          if (
            !gicon &&
            dock.extension.app_map &&
            app_name &&
            dock.extension.app_map[app_name]
          ) {
            icon_name = dock.extension.app_map[app_name];
          }
        }

        let didCreate = false;
        icon._renderer = this._renderers[icon._idx];
        icon._renderer._icon = icon._icon;

        let renderer = icon._renderer;
        if (gicon) {
          // apply override
          renderer.gicon = gicon;

          // replace PNG with override SVG
          if (icon._icon.gicon && icon._icon.gicon.file && gicon) {
            icon._icon.gicon = gicon;
          }
        } else {
          if (icon_name) {
            renderer.icon_name = icon_name;
          } else {
            //! clone
            if (icon._icon.gicon) {
              let clone = icon._icon.gicon.file;
              if (
                renderer.gicon &&
                renderer.gicon.file &&
                renderer.gicon.file.get_path() ==
                  icon._icon.gicon.file.get_path()
              ) {
                clone = false;
              }
              if (clone) {
                renderer.gicon = new Gio.FileIcon({
                  file: icon._icon.gicon.file,
                });
              }
              // #issue 188
              renderer.gicon = icon._icon.gicon;
            }
          }
        }

        //-------------------
        // animate scaling at renderer
        //-------------------
        let unscaledIconSize = dock._iconSizeScaledDown * scaleFactor;
        let targetSize = unscaledIconSize * icon._targetScale;
        let currentSize = renderer.icon_size * renderer.scaleX;
        {
          let dst = targetSize - currentSize;
          let mag = Math.abs(dst);
          let dir = Math.sign(dst);
          let accel = 0;
          let pixelOverTime = ANIM_SIZE_PER_SEC * slowDown;
          let deltaSize = pixelOverTime * dir * dt;
          let appliedSize = deltaSize;
          appliedSize += accel;
          if (Math.abs(appliedSize) > mag) {
            appliedSize = dst * 0.5;
          }
          if (didCreate) {
            appliedSize = 0;
            currentSize = targetSize;
          }
          targetSize = currentSize + appliedSize;
          icon._deltaSize = appliedSize;
          icon._targetSize = targetSize;
        }
        // compute icon scale based on size
        icon._scale = targetSize / unscaledIconSize;

        let baseSize = 32 * (dock.extension.icon_quality || 1);
        if (renderer.icon_size != baseSize) {
          renderer.set_size(baseSize, baseSize);
          renderer.set_icon_size(baseSize);
        }
        let scaleToTarget = targetSize / baseSize;
        renderer.set_scale(scaleToTarget, scaleToTarget);

        let p = icon.get_transformed_position();
        let adjustX = icon.width / 2 - targetSize / 2;
        let adjustY = icon.height / 2 - targetSize / 2;

        if (targetSize > icon.height) {
          let rise = (targetSize - icon.height) * 0.5;
          if (vertical) {
            adjustX += rise * (dock._position == 'left' ? 1 : -1);
          } else {
            adjustY += rise * (dock._position == 'bottom' ? -1 : 1);
          }
        }

        //-------------------
        // commit position
        //-------------------
        if (!isNaN(p[0]) && !isNaN(p[1])) {
          let iconContainer = icon._icon.get_parent();
          // iconContainer can be null when dragging icons
          if (iconContainer) {
            if (vertical) {
              iconContainer.translationX = adjustX / 2;
            } else {
              iconContainer.translationY = adjustY / 2;
            }
            renderer.set_position(
              p[0] + adjustX + icon._icon.translationX - renderOffset[0],
              p[1] + adjustY + icon._icon.translationY - renderOffset[1],
            );
            renderer.visible = true;
          }
          icon._px = p[0] - renderOffset[0];
          icon._py = p[1] - renderOffset[1];
        }

        // labels
        if (icon === hoveredIcon && icon._label) {
          let tSize = renderer.get_transformed_size();
          let tPos = icon._icon.get_transformed_position();
          if (isNaN(tPos[0]) || isNaN(tPos[1])) {
            tPos[0] = 0;
            tPos[1] = 0;
          }
          let sw = !isNaN(tSize[0]) ? tSize[0] : 0;
          let sh = !isNaN(tSize[1]) ? tSize[1] : 0;
          icon._label.x = tPos[0] + sw / 2 - icon._label.width / 2;
          icon._label.y = tPos[1] + sh / 2 - icon._label.height / 2;
          if (vertical) {
            if (dock._position == DockPosition.LEFT) {
              icon._label.x += sh / 1.5 + icon._label.width / 2;
            } else {
              icon._label.x -= sh / 1.5 + icon._label.width / 2;
            }
            icon._label.y += 2 * (m.geometry_scale || 1);
          } else {
            if (dock._position == DockPosition.BOTTOM) {
              icon._label.y -= sh / 1.5;
            } else {
              icon._label.y += sh / 1.5;
            }
            icon._label.x += 2 * (m.geometry_scale || 1);
          }
        }

        //! todo... add placeholder opacity when dragging
        renderer.opacity =
          icon._icon == dock._dragged && dock._dragging ? 75 : 255;
      }

      //! make more readable
      let flags = {
        bottom: {
          x: 0.5,
          y: 1,
          lx: 0,
          ly: 0.5 * icon._targetScale * scaleFactor,
        },
        top: {
          x: 0.5,
          y: 0,
          lx: 0,
          ly: -1.5 * icon._targetScale * scaleFactor,
        },
        left: {
          x: 0,
          y: 0.5,
          lx: -1.25 * icon._targetScale * scaleFactor,
          ly: -1.25,
        },
        right: {
          x: 1,
          y: 0.5,
          lx: 1.5 * icon._targetScale * scaleFactor,
          ly: -1.25,
        },
      };

      let posFlags = flags[dock._position];

      // badges
      //! ***badge location at scaling is messed up***
      let badge = this._badges[icon._idx];
      badge.hide();
      if (icon != dock._dragged) {
        let appNotices = icon._appwell
          ? dock.extension.services._appNotices[icon._appwell.app.get_id()]
          : null;
        let noticesCount = 0;
        if (appNotices) {
          noticesCount = appNotices.count;
        }
        // noticesCount = 1;
        let target = dock.renderArea;
        if (badge && noticesCount > 0) {
          badge.update(icon, {
            noticesCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
          });
          badge.x = icon._renderer.x - 4;
          badge.y = icon._renderer.y - 4;
          badge.set_scale(icon._scale, icon._scale);
          badge.show();
        }
      }

      // dots
      //! ***dot requires a little more aligning at dock position other than bottom***
      let dots = this._dots[icon._idx];
      dots.hide();
      if (
        icon != dock._dragged &&
        icon._appwell &&
        icon._appwell.app &&
        icon._appwell.app.get_n_windows
      ) {
        // let appCount = icon._appwell.app.get_n_windows();
        let appCount = dock.getAppWindowsFiltered(icon._appwell.app).length; // .get_n_windows();
        // appCount = 1;
        if (dots && appCount > 0) {
          dots.update(icon, {
            appCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
            dock,
          });

          dots.width = icon._renderer.width * icon._renderer.scaleX;
          dots.height = dots.width;
          dots.x = icon._px ?? 0;
          dots.y = icon._py ?? 0;
          dots.show();
        }
      }

      // custom icons
      if (dock.extension.services) {
        dock.extension.services.updateIcon(icon, {
          scaleFactor,
          iconSize,
          dock,
        });
      }
    });

    // separators
    dock._separators.forEach((actor) => {
      let prev = actor._prev; // get_previous_sibling() || actor._prev;
      let next = actor._next; // get_next_sibling();
      if (prev && next && prev._icon && next._icon) {
        actor.translationX =
          (prev._icon.translationX + next._icon.translationX) / 2;
        actor.translationY =
          (prev._icon.translationY + next._icon.translationY) / 2;
        let thickness = dock.extension.separator_thickness || 0;
        //! use ifs for more readability
        actor.width = !vertical
          ? thickness + 0.5
          : iconSize * 0.5 * scaleFactor;
        actor.height = vertical
          ? thickness + 0.5
          : iconSize * 0.75 * scaleFactor;
        actor.visible = thickness > 0;
      }
    });

    let targetX = 0;
    let targetY = 0;
    if (dock._hidden && dock.extension.autohide_dash) {
      if (isWithin) {
        dock.slideIn();
      }
    }

    //! use a more descriptive variable name
    let ed =
      dock._position == DockPosition.BOTTOM ||
      dock._position == DockPosition.RIGHT
        ? 1
        : -1;

    // if (!animated && !dock._hidden && dock.extension.peek_hidden_icons) {
    //   edge_distance = -dock._iconSizeScaledDown * scaleFactor / 1.5;
    // }

    //-------------------
    // animate slide in slide out
    //-------------------
    if (dock._hidden) {
      if (vertical) {
        if (dock._position == DockPosition.LEFT) {
          targetX =
            -(dock._background.width + edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetX =
            (dock._background.width - edge_distance * -ed * 2) * scaleFactor;
        }
      } else {
        if (dock._position == DockPosition.BOTTOM) {
          targetY =
            (dock._background.height - edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetY =
            -(dock._background.height + edge_distance * -ed * 2) * scaleFactor;
        }
      }
    }

    // edge
    //! use ifs for more readability
    targetX += vertical ? edge_distance * -ed : 0;
    targetY += !vertical ? edge_distance * -ed : 0;

    // dock translation
    {
      let translationX = targetX;
      let translationY = targetY;
      let speed =
        ((150 + 300 * dock.extension.autohide_speed * scaleFactor) / 500) *
        slowDown;
      let v1 = new Vector([targetX, targetY, 0]);
      let v2 = new Vector([dock.dash.translationX, dock.dash.translationY, 0]);
      let dst = v1.subtract(v2);
      let mag = dst.magnitude();
      if (mag > 0) {
        // let ndst = dst.normalize();
        let v3 = v2.add(dst.multiplyScalar(speed));
        translationX = v3.x;
        translationY = v3.y;
      }

      dock.dash.translationX = translationX;
      dock.dash.translationY = translationY;
    }

    // background
    {
      dock._background.style = dock.extension._backgroundStyle;
      dock._background.update({
        first,
        last,
        iconSize: dock._iconSizeScaledDown,
        scaleFactor,
        position: dock._position,
        vertical: vertical,
        panel_mode: dock.extension.panel_mode,
        dock,
      });

      // allied areas
      //! this should be at the layout -- make independent of background
      // struts
      if (vertical) {
        dock.struts.width =
          dock._background.width +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;
        dock.struts.height = dock.height;

        if (dock.extension.autohide_dash) {
          dock.struts.y = dock._background.y + dock._monitor.y;
          dock.struts.height = dock._background.height;
          // X11 .. click through fix ..
          // dock.struts.width *= 1.25;
        }

        // dock.struts.y = dock.y;
        if (dock._position == DockPosition.RIGHT) {
          dock.struts.x = dock.x + dock.width - dock.struts.width;
        } else {
          dock.struts.x = dock.x;
        }
      } else {
        dock.struts.width = dock.width;
        dock.struts.height =
          dock._background.height +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;

        if (dock.extension.autohide_dash) {
          dock.struts.x = dock._background.x + dock._monitor.x;
          dock.struts.width = dock._background.width;
          // X11 .. click through fix ..
          // dock.struts.height *= 1.25;
        }

        // dock.struts.x = dock.x;
        if (dock._position == DockPosition.BOTTOM) {
          dock.struts.y = dock.y + dock.height - dock.struts.height;
        } else {
          dock.struts.y = dock.y;
        }
      }
    }
    dock.struts.visible = !dock._hidden;
    dock.dash.opacity = 255;

    //---------------------
    // animate the list
    //---------------------
    if (dock._list && dock._list.visible && dock._list._target) {
      dock._list.animate(dt);
      didScale = true;
    }

    if (didFadeIn || didScale || dock._dragging || didBounce) {
      dock.autohider._debounceCheckHide();
      dock._debounceEndAnimation();
    }
  }

  bounceIcon(appwell) {
    let dock = this.dock;
    let app_id = appwell._id;

    // let scaleFactor = dock.getMonitor().geometry_scale;
    //! why not scaleFactor?
    let travel =
      (dock._iconSize / 3) * ((0.25 + dock.extension.animation_bounce) * 1.5);
    // * scaleFactor;
    appwell.translation_y = 0;

    const getTarget = (app_id) => {
      if (dock._dragging) return [null, null];
      let icons = dock._findIcons();
      let icon = icons.find((icon) => {
        return icon._appwell && icon._appwell._id == app_id;
      });
      if (!icon) {
        return [null, null];
      }
      return [icon._appwell.get_parent(), icon._appwell];
    };

    const translateDecor = (container, appwell) => {
      if (container._renderer) {
        container._renderer.translationY = appwell.translationY;
      }
      if (container._image) {
        container._image.translationY = appwell.translationY;
      }
      if (container._badge) {
        container._badge.translationY = appwell.translationY;
      }
    };

    let t = 250;
    let _frames = [
      {
        _duration: t,
        _func: (f, s) => {
          let res = Linear.easeNone(f._time, 0, travel, f._duration);
          let [container, appwell] = getTarget(app_id);
          if (!appwell) return;
          appwell._bounce = true;
          if (dock.isVertical()) {
            appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
            if (container._renderer) {
              container._renderer.translationX = appwell.translationX;
            }
          } else {
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
            if (container._renderer) {
              container._renderer.translationY = appwell.translationY;
            }
          }
          translateDecor(container, appwell);
        },
      },
      {
        _duration: t * 3,
        _func: (f, s) => {
          let res = Bounce.easeOut(f._time, travel, -travel, f._duration);
          let [container, appwell] = getTarget(app_id);
          if (!appwell) return;
          if (dock.isVertical()) {
            appwell.translation_x = appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
            if (container._renderer) {
              container._renderer.translationX = appwell.translationX;
            }
          } else {
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
            if (container._renderer) {
              container._renderer.translationY = appwell.translationY;
            }
          }
          translateDecor(container, appwell);
        },
      },
    ];

    let frames = [];
    for (let i = 0; i < 3; i++) {
      _frames.forEach((b) => {
        frames.push({
          ...b,
        });
      });
    }

    dock.extension._hiTimer.runAnimation([
      ...frames,
      {
        _duration: 10,
        _func: (f, s) => {
          let [container, appwell] = getTarget(app_id);
          if (!appwell) return;
          appwell.translation_y = 0;
          translateDecor(container, appwell);
        },
      },
      {
        _duration: 10,
        _func: (f, s) => {
          let [container, appwell] = getTarget(app_id);
          if (appwell) {
            appwell._bounce = false;
          }
        },
      },
    ]);
  }
};
