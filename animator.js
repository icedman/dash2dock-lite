'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Compat from './compat.js';
import St from 'gi://St';
import Graphene from 'gi://Graphene';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
const Point = Graphene.Point;

import { Dot } from './apps/dot.js';
import { DockPosition } from './dock.js';
import { Vector } from './vector.js';

import { DockItemDotsOverlay, DockItemBadgeOverlay } from './dockItems.js';
import { live } from './probe.js';
import {
  Bounce,
  Linear,
} from './effects/easing.js';
import {
  isInRect,
  isOverlapRect,
} from './utils.js';

const ANIM_POSITION_PER_SEC = 550 / 1000;
const ANIM_SIZE_PER_SEC = 250 / 1000;
const ANIM_ICON_RAISE = 0.5;
const ANIM_ICON_SCALE = 1.5;
const ANIMATE_CACHE_LOOKUP = 4;

const DOT_CANVAS_SIZE = 96;

function getScale(u, xm, R, M, type = 0) {
    const dist = Math.abs(u - xm);
    if (dist >= R) {
        return 1.0;
    }
    const t = 1.0 - (dist / R);
    let factor = t;

    if (type === 1) {
        // Linear Proximity
        factor = t;
    } else if (type === 2) {
        // Smoothstep Polynomial
        factor = t * t * (3 - 2 * t);
    } else {
        // 0: Cosine Bell (standard macOS bell curve)
        factor = Math.cos((dist / R) * (Math.PI / 2));
    }

    return 1.0 + (M - 1.0) * factor;
}

export let Animator = class {
  constructor() {
    live('animator', 1);
  }

  enable() {
    if (!this._renderers) {
      this._renderers = [];
      this._dots = [];
      this._badges = [];
    }
    this._computed = null;
  }

  disable() {
    this._destroyPool();
    // only non-pool children are left (services' clock/calendar); they are
    // just unparented until R-7b destroys them with their item
    this._target?.remove_all_children();
    this._target = null;
    this._computed = null;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    live('animator', -1);
    this.disable();
    this.dock = null;
    this.extension = null;
  }

  _destroyPool() {
    [this._renderers, this._dots, this._badges].forEach((pool) => {
      (pool || []).forEach((actor) => actor?.destroy());
    });
    this._renderers = [];
    this._dots = [];
    this._badges = [];
  }

  _precreateResources(dock) {
    if (!dock._icons) {
      return false;
    }

    let count = dock._icons.length;
    if (dock.renderArea.get_children().length == 0) {
      this._destroyPool();
    }
    this._target = dock.renderArea;

    while (this._renderers.length < count) {
      // renderer
      let target = dock.renderArea;
      let renderer = new St.Icon({
        icon_name: 'file',
        name: 'd2daIcon',
        reactive: true,
        icon_size: 24,
      });
      renderer.visible = false;
      target.add_child(renderer);
      this._renderers.push(renderer);

      // dot
      let dots = new DockItemDotsOverlay(new Dot(DOT_CANVAS_SIZE), {
        name: 'd2daDotsOverlay',
      });
      dots.visible = false;
      target.add_child(dots);
      this._dots.push(dots);

      // badges
      let badge = new DockItemBadgeOverlay(new Dot(DOT_CANVAS_SIZE), {
        name: 'd2daBadgeOverlay',
      });
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
    try {
      this._animate(dt);
    } catch (err) {
      console.error('d2da: animator animate', err);
    }
  }

  _animate(dt) {
    let dock = this.dock;
    if (!dock) return;

    if (dock._hoveredIcon) {
      dock._lastHoveredIcon = dock._hoveredIcon;
    }

    let simulation = false;

    if (dock._needsLayout) {
      if (!dock.relayout()) {
        return;
      }
    }

    dock._snapToContainerEdge(dock, dock.dash, true);

    if (!dock._icons || !dock._icons.length) {
      return;
    }

    if (!dock.renderArea?.has_allocation()) {
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

    let nearestIcon = null;

    let idx = 0;
    let prevIcon = null;
    // icons without a texture or a valid position (being created or torn down
    // by the Shell Dash) are skipped here, so they must not reach the layout
    // math below, which reads _fixedPosition of every icon
    let positionedIcons = [];
    animateIcons.forEach((icon) => {
      if (!icon._icon) return;
      let pos = icon.get_transformed_position();
      if (!pos || isNaN(pos[0]) || isNaN(pos[1])) return;
      positionedIcons.push(icon);

      if (icon._found && !icon._handled) {
        icon._handled = true;
        dock._maybeBounce(icon, true);
      }

      icon._pos = [...pos];
      icon._fixedPosition = [...pos];

      icon._target = pos;
      icon._targetScale = 1;

      icon._idx = idx++;

      icon._prev = prevIcon;
      icon._next = null;
      if (prevIcon) {
        prevIcon._next = icon;
      }
      prevIcon = icon;
    });

    animateIcons = positionedIcons;
    if (!animateIcons.length) {
      return;
    }

    let noAnimation = !dock.extension.animate_icons_unmute;
    if (dock._dragging) {
      noAnimation = true;
      isWithin = true;
    }

    let didBounce = false;

    //------------------------
    // animation behavior
    //------------------------
    let edge_distance = dock._edge_distance;
    let rise = dock.extension.animation_rise * ANIM_ICON_RAISE;
    let magnify = dock.extension.animation_magnify * ANIM_ICON_SCALE;
    let spread = dock.extension.animation_spread;

    // Keep magnification independent from spread
    let threshold = (iconSize + 10) * 2.5 * scaleFactor;
    if (animated && edge_distance < 0) {
      edge_distance = 0;
    }

    const scaleAtMax = 1.0 + magnify;

    // --- Step 1: Ghost Nodes / Imaginary Icons Setup ---
    const NUM_ICONS = animateIcons.length;
    const NUM_IMAGINARY = 4;
    const TOTAL_CALC_ICONS = NUM_IMAGINARY + NUM_ICONS + NUM_IMAGINARY;

    // --- Step 2: Static Centers & Coordinate Decoupling (Measured directly from Clutter!) ---
    const firstIconObj = animateIcons[0];
    const lastIconObj = animateIcons[NUM_ICONS - 1];

    const firstIconPos = vertical ? firstIconObj._fixedPosition[1] : firstIconObj._fixedPosition[0];
    const firstIconSize = vertical ? firstIconObj.height : firstIconObj.width;

    const staticDockStart = firstIconPos;

    const restingCenters = [];
    for (let i = 0; i < NUM_ICONS; i++) {
        const icon = animateIcons[i];
        const pos_i = vertical ? icon._fixedPosition[1] : icon._fixedPosition[0];
        const size_i = vertical ? icon.height : icon.width;
        const center_i = pos_i + size_i / 2;
        restingCenters.push(center_i - staticDockStart);
    }

    const lastIconPos = vertical ? lastIconObj._fixedPosition[1] : lastIconObj._fixedPosition[0];
    const lastIconSize = vertical ? lastIconObj.height : lastIconObj.width;
    const restingL = (lastIconPos + lastIconSize) - firstIconPos;

    const ICON_SIZE = iconSize * scaleFactor;
    const spacingMargin = 8.0 * (dock.extension.icon_spacing || 0.0);
    // Base resting padding between items
    const basePadding = 2.0 * spacingMargin + 2.0;

    // Zero mouse-entry spread inflation: inter-icon padding stays constant,
    // exactly as in dock_animation3.js (macOS style). Outward layout shift
    // comes exclusively from the magnified icon widths themselves.
    const activePadding = basePadding;
    const activeContainerWidth = ICON_SIZE + activePadding;

    // Hit-test strictly within the visual bounds of the dock
    const primaryMouseVal = vertical ? py : px;
    const secondaryMouseVal = vertical ? px : py;
    const firstIconSecondary = vertical ? firstIconObj._fixedPosition[0] : firstIconObj._fixedPosition[1];

    const dockPad = iconSize * 0.1 * (dock.extension.dock_padding || 0) * scaleFactor;
    const tx1 = firstIconObj._icon ? (vertical ? firstIconObj._icon.translationY : firstIconObj._icon.translationX) : 0;
    const tx2 = lastIconObj._icon ? (vertical ? lastIconObj._icon.translationY : lastIconObj._icon.translationX) : 0;

    const dockVisualStart = staticDockStart + (animated ? Math.min(0, tx1) : 0) - dockPad;
    const dockVisualEnd = staticDockStart + restingL + (animated ? Math.max(0, tx2) : 0) + dockPad;
    const isWithinPrimary = (primaryMouseVal >= dockVisualStart && primaryMouseVal <= dockVisualEnd);

    const iconCenterSec = firstIconSecondary + ICON_SIZE / 2;
    const secondaryDist = Math.abs(secondaryMouseVal - iconCenterSec);
    const maxSecReach = animated
      ? (scaleAtMax * ICON_SIZE) / 2 + rise * scaleFactor + dockPad + 4
      : ICON_SIZE / 2 + dockPad + 4;
    const isWithinSecondary = (secondaryDist <= maxSecReach);

    isWithin = isWithinPrimary && isWithinSecondary;
    if (m.inFullscreen) {
        isWithin = false;
    }
    animated = isWithin;
    dock.animated = animated;

    // Compute unwarped static centers for all 18 calculated icons
    const staticCenters = [];
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        staticCenters.push(i * activeContainerWidth + activeContainerWidth / 2);
    }

    // Compute decoupled mouse coordinates in the 18-icon coordinate system
    const primaryMouse = vertical ? py : px;

    // Calibrate pointer tracking by measuring relative to the unwarped active dock start
    const activeUnpackedL = NUM_ICONS * activeContainerWidth;
    const unwarpedActiveStartX = staticDockStart - (activeUnpackedL - restingL) / 2;
    const xmLocalActive = primaryMouse - unwarpedActiveStartX;

    const firstRealStaticLeft = staticCenters[NUM_IMAGINARY] - ICON_SIZE / 2;
    const xmLocalCalculated = xmLocalActive + firstRealStaticLeft;
    const totalCalcStaticL = TOTAL_CALC_ICONS * activeContainerWidth;
    const xmClamped = Math.max(0, Math.min(totalCalcStaticL, xmLocalCalculated));

    // --- Step 3: Scaling & Perfectly Packed Centers ---
    const curveType = dock.extension.animation_rise_curve ?? 0;
    const iconScales = [];
    const iconWidths = [];
    const hoverActive = isWithin;

    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        if (!hoverActive) {
            iconScales.push(1.0);
            iconWidths.push(ICON_SIZE);
        } else {
            const xi = staticCenters[i];
            const scale = getScale(xi, xmClamped, threshold, scaleAtMax, curveType);
            iconScales.push(scale);
            iconWidths.push(ICON_SIZE * scale);
        }
    }



    const packedCenters = [];
    let currentPos = 0;
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        const halfW = iconWidths[i] / 2;
        if (i === 0) {
            currentPos = halfW;
        } else {
            currentPos += iconWidths[i - 1] / 2 + halfW + activePadding;
        }
        packedCenters.push(currentPos);
    }
    const activeL = packedCenters[TOTAL_CALC_ICONS - 1] + iconWidths[TOTAL_CALC_ICONS - 1] / 2;

    // --- Step 4: Invariance-Targeted Variance Distribution ---
    // Pre-calculate target packed dock length at dead center
    const centerMouse = totalCalcStaticL / 2;
    const centerScales = [];
    const centerWidths = [];
    const activeHoverFactor = (hoverActive && !noAnimation) ? 1.0 : 0.0;
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        const xi = staticCenters[i];
        const targetScale = getScale(xi, centerMouse, threshold, scaleAtMax, curveType);
        const scale = 1.0 + (targetScale - 1.0) * activeHoverFactor;
        centerScales.push(scale);
        centerWidths.push(ICON_SIZE * scale);
    }

    let currentCenterPos = 0;
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        const halfW = centerWidths[i] / 2;
        if (i === 0) {
            currentCenterPos = halfW;
        } else {
            currentCenterPos += centerWidths[i - 1] / 2 + halfW + activePadding;
        }
    }
    const centerPackedL = currentCenterPos + centerWidths[TOTAL_CALC_ICONS - 1] / 2;

    // Distribute length variance evenly across all calculation nodes
    const variance = centerPackedL - activeL;
    const adjustedIconWidths = [];
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        adjustedIconWidths.push(iconWidths[i] + variance / TOTAL_CALC_ICONS);
    }

    // Save the unshifted realLeftEdge before applying the mouse-proximity shift to imaginary icons
    let realLeftEdgeUnshifted = 0;
    for (let i = 0; i < NUM_IMAGINARY; i++) {
        realLeftEdgeUnshifted += adjustedIconWidths[i];
    }
    realLeftEdgeUnshifted += NUM_IMAGINARY * activePadding;

    /*
    // --- Proportional Widening/Narrowing of Boundary Imaginary Icons ---
    // Calculate normalized mouse position t on the unexpanded dock
    const t = xmClamped / totalCalcStaticL;
    // Calculate the unshifted real active length of the real icons
    let realActiveLUnshifted = 0;
    for (let i = NUM_IMAGINARY; i < NUM_IMAGINARY + NUM_ICONS; i++) {
        realActiveLUnshifted += adjustedIconWidths[i];
    }
    realActiveLUnshifted += (NUM_ICONS - 1) * activePadding;

    // Proportional shift based on mouse proximity to edge (pushes icons towards the mouse/center)
    const shift = 1.0 * (0.5 - t) * (realActiveLUnshifted - restingL) * (hoverActive ? 1.0 : 0.0);

    // Apply shift: widen the first imaginary icons and narrow the last imaginary icons (or vice versa)
    for (let i = 0; i < NUM_IMAGINARY; i++) {
        adjustedIconWidths[i] += shift / NUM_IMAGINARY;
    }
    for (let i = TOTAL_CALC_ICONS - NUM_IMAGINARY; i < TOTAL_CALC_ICONS; i++) {
        adjustedIconWidths[i] -= shift / NUM_IMAGINARY;
    }
     */

    const adjustedPackedCenters = [];
    let adjCurrentPos = 0;
    for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
        const halfW = adjustedIconWidths[i] / 2;
        if (i === 0) {
            adjCurrentPos = halfW;
        } else {
            adjCurrentPos += adjustedIconWidths[i - 1] / 2 + halfW + activePadding;
        }
        adjustedPackedCenters.push(adjCurrentPos);
    }

    // Extract the bounds of the 10 real icons from the 18 calculated nodes
    const realLeftEdge = adjustedPackedCenters[NUM_IMAGINARY] - adjustedIconWidths[NUM_IMAGINARY] / 2;
    const realRightEdge = adjustedPackedCenters[NUM_IMAGINARY + NUM_ICONS - 1] + adjustedIconWidths[NUM_IMAGINARY + NUM_ICONS - 1] / 2;
    const realActiveL = realRightEdge - realLeftEdge;

    // --- Step 5: Decoupled Clutter Translation & Icon Texture Scaling ---
    let firstIcon = null;
    let lastIcon = null;
    let iconTable = [];

    // Centering shift to align the dynamic packed dock center with the resting dock center
    const centeringShift = (restingL - realActiveL) / 2;

    // Nearest icon computed directly from rendered visual centers on screen
    nearestIcon = null;
    let minDistance = Infinity;

    if (hoverActive && !noAnimation) {
      animateIcons.forEach((icon, idx) => {
        if (!icon._icon) return;
        const calcIndex = idx + NUM_IMAGINARY;
        const pc = adjustedPackedCenters[calcIndex];
        const activeCenter = pc - realLeftEdgeUnshifted;
        const visualCenter = staticDockStart + activeCenter + centeringShift;
        const dist = Math.abs(visualCenter - primaryMouse);

        if (dist < minDistance) {
          minDistance = dist;
          nearestIcon = icon;
        }
      });

      if (nearestIcon) {
        const nearestIndex = animateIcons.indexOf(nearestIcon) + NUM_IMAGINARY;
        const nearestScale = iconScales[nearestIndex] ?? 1.0;
        const halfWidth = (ICON_SIZE * nearestScale) / 2 + activePadding;
        if (minDistance > halfWidth) {
          nearestIcon = null;
        }
      }
    }

    let didScale = (nearestIcon !== null);
    let hoveredIcon = nearestIcon;
    dock._nearestIcon = nearestIcon;
    dock._hoveredIcon = nearestIcon;

    animateIcons.forEach((icon, idx) => {
        if (!icon._icon) return;

        const calcIndex = idx + NUM_IMAGINARY;
        const pc = adjustedPackedCenters[calcIndex];
        const activeCenter = pc - realLeftEdgeUnshifted;
        const visualCenter = staticDockStart + activeCenter + centeringShift;
        icon._visualCenter = visualCenter;

        // Position the Clutter actor perfectly using 1D packing relative to its resting center
        icon._translate = activeCenter + centeringShift - restingCenters[idx];

        // Assign unadjusted original scale to the actor properties
        const originalScale = iconScales[calcIndex];
        icon._scale = originalScale;
        icon._targetScale = originalScale;

        // Compute secondary axis rise offset (elevation)
        const sz = iconSize * (originalScale - 1) * scaleFactor;
        icon._translateRise = sz * rise;

        // Apply scale directly to the icon image texture
        if (
            icon._icon.gicon &&
            icon._icon.gicon.file != null &&
            !icon._icon.gicon.file?.get_path()?.toLowerCase().endsWith('svg')
        ) {
            // skip scaling non-SVG image files for performance
        } else {
            icon._icon.set_scale(originalScale, originalScale);
        }

        iconTable.push(icon);
        if (firstIcon == null) {
            firstIcon = icon;
        }
        lastIcon = icon;
    });

    //-------------------
    // interpolation / animation
    //-------------------
    let renderOffset = dock.renderArea.get_transformed_position();
    if (!renderOffset || isNaN(renderOffset[0]) || isNaN(renderOffset[1])) {
      return;
    }

    let first = animateIcons[0];
    let last = animateIcons[animateIcons.length - 1];

    let slowDown = dock.extension._config.speed_up || 1;
    if (!didScale) {
      slowDown = 0.5;
    }

    animateIcons.forEach((icon) => {
      if (!icon._icon) return;

      icon._scale = icon._targetScale;

      const isTopOrLeft =
        dock._position === DockPosition.TOP ||
        dock._position === DockPosition.LEFT;
      const riseDirection = isTopOrLeft ? 1 : -1;

      let translationX;
      let translationY;
      if (vertical) {
        translationX = icon._translateRise * riseDirection;
        translationY = icon._translate;
      } else {
        translationX = icon._translate;
        translationY = icon._translateRise * riseDirection;
      }

      //-------------------
      // animate position
      //-------------------
      // High-performance Exponential Easing (LERP) for buttery-smooth and snappy transitions
      {
        let baseLerpFactor = 0.42 * slowDown; // 42% distance closed per 16.6ms frame (blazing fast!)
        let factor = 1.0 - Math.pow(1.0 - baseLerpFactor, dt / 16.6);

        // Handle edge boundary cases where dt is massive or invalid
        if (isNaN(factor) || factor > 1.0) factor = 1.0;
        if (factor < 0.0) factor = 0.0;

        translationX = icon._icon.translationX + (translationX - icon._icon.translationX) * factor;
        translationY = icon._icon.translationY + (translationY - icon._icon.translationY) * factor;
      }

      if (dock.extension.animation_fps > 0) {
        icon._icon.translationX = translationX;
        icon._icon.translationY = translationY;
      } else {
        //! retain this for smoothness at high fps
        icon._icon.translationX =
          (icon._icon.translationX + translationX * 3) / 4;
        icon._icon.translationY =
          (icon._icon.translationY + translationY * 3) / 4;
      }

      // clear bounce animation
      if (icon._appwell) {
        icon._appwell.translationX = 0;
        icon._appwell.translationY = 0;
        didBounce = icon._appwell._bounce;
        // clear bounce
        icon._appwell._bounce = false;
      }
    });


    //--------------
    // renderer
    //--------------
    animateIcons.forEach((icon) => {
      if (!icon._icon) return;
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

        icon._renderer = this._renderers[icon._idx];
        icon._renderer._icon = icon._icon;
        icon._renderer.set_style_class_name('');

        if (!icon._appwell?._bounce) {
          icon._renderer.translationX = 0;
          icon._renderer.translationY = 0;
        }

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
            if (icon._icon.gicon) {
              // Directly assign the icon's gicon to the renderer (fixed in #issue 188)
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

            let ry = p[1] + adjustY + icon._icon.translationY - renderOffset[1];
            renderer.set_position(
              p[0] + adjustX + icon._icon.translationX - renderOffset[0],
              ry
            );

            // renderer.ease({
            //   x: p[0] + adjustX + icon._icon.translationX - renderOffset[0],
            //   y: ry,
            //   duration: 100,
            //   mode: Clutter.AnimationMode.LINEAR,
            // });

            // renderer.ease({
            //   width: baseSize,
            //   height: baseSize,
            //   icon_size: baseSize,
            //   duration: 200,
            //   mode: Clutter.AnimationMode.LINEAR,
            // });

            renderer.visible = true;
          }
          icon._px = p[0] - renderOffset[0];
          icon._py = p[1] - renderOffset[1];
        }

        let hideLabel = true;

        // label
        if (
          !dock.extension.hide_labels &&
          icon === hoveredIcon &&
          icon._label &&
          icon._label.text &&
          icon._label.text.length
        ) {
          if (this._dwellIcon === icon) {
            this._dwellTick += dt;
            if (
              this._dwellTick > 450 &&
              (icon._targetScale > 1 || magnify == 0)
            ) {
              try {
                hideLabel = false;
                if (icon._label.opacity < 255 - 25) {
                  icon._label.opacity += 25;
                } else {
                  icon._label.opacity = 255;
                }
              } catch (err) {
                // label not ready?
              }
            }
          } else {
            this._dwellTick = 0;
          }
          this._dwellIcon = icon;

          this.alignLabel(icon);
        }

        if (hideLabel && icon._label) {
          icon._label.opacity = 0;
        }

        //! todo... add placeholder opacity when dragging
        renderer.opacity =
          icon._icon == dock._dragged && dock._dragging ? 75 : 255;
      }



      // badges
      //! ***badge location at scaling is messed up***
      let badge = this._badges[icon._idx];
      icon._badge = badge;
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
            dock,
          });

          badge.width = icon._renderer.width * icon._renderer.scaleX;
          badge.height = badge.width;
          badge.x = icon._renderer.x;
          badge.y = icon._renderer.y;
          badge.translationX = icon._renderer.translationX;
          badge.translationY = icon._renderer.translationY;

          badge.set_scale(icon._scale, icon._scale);
          badge.show();
        } else if (badge) {
          badge.translationX = 0;
          badge.translationY = 0;
        }
      } else if (badge) {
        badge.translationX = 0;
        badge.translationY = 0;
      }

      // dots
      //! ***dot requires a little more aligning at dock position other than bottom***
      let dots = this._dots[icon._idx];
      icon._dots = dots;
      dots.hide();
      if (
        icon != dock._dragged &&
        icon._appwell &&
        icon._appwell.app &&
        icon._appwell.app.get_n_windows
      ) {
        let appCount = dock.getAppWindowsFiltered(icon._appwell.app).length;
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
          dots.x = icon._renderer.x;
          dots.y = icon._renderer.y;
          dots.set_scale(icon._scale, icon._scale);
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
        if (vertical) {
          actor.width = iconSize * 0.5 * scaleFactor;
          actor.height = thickness + 0.5;
        } else {
          actor.width = thickness + 0.5;
          actor.height = iconSize * 0.75 * scaleFactor;
        }
        actor.visible = thickness > 0;
      }

      let any = next ?? prev;
      if (!vertical && any) {
        actor.translationY = any.height / 2 - actor.height / 2;
      } else if (vertical && any) {
        // actor.translationX = any.width / 2 - actor.width / 2;
      }
    });

    let targetX = 0;
    let targetY = 0;
    if (dock._hidden && dock.extension.autohide_dash) {
      if (isWithin) {
        dock.slideIn();
      }
    }

    const edgeDirectionMultiplier =
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
            -(dock._background.width + edge_distance * -edgeDirectionMultiplier * 2) * scaleFactor;
        } else {
          targetX =
            (dock._background.width - edge_distance * -edgeDirectionMultiplier * 2) * scaleFactor;
        }
      } else {
        if (dock._position == DockPosition.BOTTOM) {
          targetY =
            (dock._background.height - edge_distance * -edgeDirectionMultiplier * 2) * scaleFactor;
        } else {
          targetY =
            -(dock._background.height + edge_distance * -edgeDirectionMultiplier * 2) * scaleFactor;
        }
      }
    }

    // edge
    if (vertical) {
      targetX += edge_distance * -edgeDirectionMultiplier;
    } else {
      targetY += edge_distance * -edgeDirectionMultiplier;
    }

    // dock translation
    {
      let autohide_slowDown = 1;
      let translationX = targetX;
      let translationY = targetY;
      let speed =
        ((150 + 300 * dock.extension.autohide_speed * scaleFactor) / 1000) *
        autohide_slowDown;

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

      dock._updateTransparenies();
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

    dock.extension.integrations.bms_update_size(this);
  }

  alignLabel(icon) {
    if (!icon || !icon._label) return;
    let renderer =
      icon._renderer ||
      (icon._idx !== undefined ? this._renderers?.[icon._idx] : null);

    let dock = this.dock;
    if (!dock) return;

    let tPos, tSize;
    if (renderer) {
      tSize = renderer.get_transformed_size();
      tPos = renderer.get_transformed_position();
    } else {
      let iconActor = icon._icon || icon;
      tSize = iconActor.get_transformed_size();
      tPos = iconActor.get_transformed_position();
    }

    if (isNaN(tPos[0]) || isNaN(tPos[1])) {
      tPos[0] = 0;
      tPos[1] = 0;
    }
    let sw = !isNaN(tSize[0]) ? tSize[0] : 0;
    let sh = !isNaN(tSize[1]) ? tSize[1] : 0;

    let lsz = icon._label.get_transformed_size();
    let lw = !isNaN(lsz[0]) && lsz[0] > 0 ? lsz[0] : 0;
    let lh = !isNaN(lsz[1]) && lsz[1] > 0 ? lsz[1] : 0;
    if (!lw || !lh) {
      try {
        let [, natW] = icon._label.get_preferred_width(-1);
        let [, natH] = icon._label.get_preferred_height(natW);
        lw = lw || natW || icon._label.width || 0;
        lh = lh || natH || icon._label.height || 0;
      } catch {
        lw = lw || icon._label.width || 0;
        lh = lh || icon._label.height || 0;
      }
    }

    let lx = tPos[0] + sw / 2 - lw / 2;
    let ly = tPos[1] + sh / 2 - lh / 2;

    let vertical = dock.isVertical();
    let m = dock._monitor;
    let scale = m?.geometry_scale || 1;

    if (vertical) {
      if (dock._position == DockPosition.LEFT) {
        lx += sh / 1.5 + lw / 2;
      } else {
        lx -= sh / 1.5 + lw / 2;
      }
      ly += 2 * scale;
    } else {
      let magnify = dock.extension.animation_magnify;
      if (magnify == 0 || dock._iconSize <= 4) {
        sh *= 1.5;
      }
      if (dock._position == DockPosition.BOTTOM) {
        ly -= sh / 1.25;
      } else {
        ly += sh / 1.25;
      }
      lx += 2 * scale;
    }

    icon._label.x = Math.round(lx);
    icon._label.y = Math.round(ly);
  }

  bounceIcon(appwell) {
    let dock = this.dock;
    let app_id = Compat.getAppId(appwell);

    // let scaleFactor = dock.getMonitor().geometry_scale;
    let iconSize = dock._iconSizeScaledDown || dock._iconSize;
    let travel =
      (iconSize / 3) *
      ((0.25 + (dock.extension.animation_bounce_height ?? 0.75)) * 1.5);
    appwell.translation_x = 0;
    appwell.translation_y = 0;

    const getTarget = (app_id) => {
      // disabled: the pool is destroyed and container._renderer is stale
      if (!this._target) return [null, null];
      if (dock._dragging) return [null, null];
      let icons = dock._findIcons();
      let icon = icons.find((icon) => {
        return icon._appwell && Compat.getAppId(icon._appwell) === app_id;
      });
      if (!icon || !icon._appwell) {
        return [null, null];
      }
      return [icon, icon._appwell];
    };

    const translateDecor = (container, appwell) => {
      try {
        if (!container._icon) return;
        let badge =
          container._badge ||
          (container._idx !== undefined
            ? this._badges?.[container._idx]
            : null);
        if (dock.isVertical()) {
          if (container._renderer) {
            container._renderer.translationX = appwell.translationX;
            container._renderer.translationY = 0;
          }
          if (container._image) {
            container._image.translationX = appwell.translationX;
            container._image.translationY = 0;
          }
          if (badge) {
            badge.translationX = appwell.translationX;
            badge.translationY = 0;
          }
        } else {
          if (container._renderer) {
            container._renderer.translationX = 0;
            container._renderer.translationY = appwell.translationY;
          }
          if (container._image) {
            container._image.translationX = 0;
            container._image.translationY = appwell.translationY;
          }
          if (badge) {
            badge.translationX = 0;
            badge.translationY = appwell.translationY;
          }
        }
        if (container._label) {
          container._label.opacity = 0;
        }
      } catch (err) {
        console.error('d2da: bounceIcon translateDecor', err);
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
          try {
            appwell._bounce = true;
            if (dock.isVertical()) {
              appwell.translation_x =
                dock._position == DockPosition.LEFT ? res : -res;
            } else {
              appwell.translation_y =
                dock._position == DockPosition.BOTTOM ? -res : res;
            }
          } catch (err) {
            console.error('d2da: bounceIcon frame', err);
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
          try {
            appwell._bounce = true;
            if (dock.isVertical()) {
              appwell.translation_x =
                dock._position == DockPosition.LEFT ? res : -res;
            } else {
              appwell.translation_y =
                dock._position == DockPosition.BOTTOM ? -res : res;
            }
          } catch (err) {
            console.error('d2da: bounceIcon frame', err);
          }
          translateDecor(container, appwell);
        },
      },
    ];

    let frames = [];
    for (
      let i = 0;
      i < [3, 1, 2, 3][dock.extension.animation_bounce_frequency || 0];
      i++
    ) {
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
          try {
            appwell._bounce = true;
            appwell.translation_x = 0;
            appwell.translation_y = 0;
            if (container._renderer) {
              container._renderer.translationX = 0;
              container._renderer.translationY = 0;
            }
            let badge =
              container._badge ||
              (container._idx !== undefined
                ? this._badges?.[container._idx]
                : null);
            if (badge) {
              badge.translationX = 0;
              badge.translationY = 0;
            }
          } catch (err) {
            console.error('d2da: bounceIcon reset frame', err);
          }
          translateDecor(container, appwell);
        },
      },
      {
        _duration: 10,
        _func: (f, s) => {
          let [container, appwell] = getTarget(app_id);
          if (!appwell) return;
          try {
            appwell._bounce = false;
          } catch (err) {
            console.error('d2da: bounceIcon end frame', err);
          }
        },
      },
    ]);
  }
};
