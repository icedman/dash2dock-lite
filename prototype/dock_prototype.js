#!/usr/bin/env -S gjs -m

/**
 * prototype/dock_prototype.js
 *
 * Standalone interactive prototype for the ultimate modular shell.
 * - Decoupled DockModel + ItemSources + DockItems.
 * - Mockup sources: Favorites, Running Apps, Drawers, Widgets (Clock, Trash, Separators).
 * - SVG icon loading via Gtk.IconTheme + Cairo rendering with fallback wireframes.
 * - Sub-Dock Drawer popup demonstration.
 * - Deterministic macOS-style magnification and space-warping physical canvas.
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Cairo from 'gi://cairo';
import GLib from 'gi://GLib';
import Rsvg from 'gi://Rsvg';
import GdkPixbuf from 'gi://GdkPixbuf';
import { ItemType, IndicatorState } from './dockItem.js';
import { DockModel, DockViewState, stem_flags } from './dockModel.js';
import {
  MockFavoritesSource,
  MockRunningAppsSource,
  MockDrawerSource,
  MockWidgetsSource,
} from './dockSources.js';

// Initialize GTK
Gtk.init();

// --- Configuration & Constants ---
const BASE_ICON_SIZE = 48;
const BASE_PADDING = 8;
const BASE_BG_PADDING = 10;
const SUBDOCK_ICON_SIZE = 44;
const SUBDOCK_PADDING = 4;
const SUBDOCK_BG_PADDING = 10;
const SEPARATOR_WIDTH = 10;
const LERP_ENTER_SPEED = 0.30;    // Snappier icon magnification on hover enter
const LERP_LEAVE_SPEED = 0.20;    // Smooth, responsive return on hover leave
const DRAW_WALLPAPER = false;
const Positions = { BOTTOM: 0, LEFT: 1, TOP: 2, RIGHT: 3 };
const SubDockStyle = { DOCK: 0, FAN: 1 };

let currentPosition = Positions.BOTTOM;
let subDockMode = SubDockStyle.FAN; // Default to perpendicular fan-out without background
let currentStemMode = stem_flags.CENTER_BASIS; // stem_flags.CENTER_BASIS (Option A) or stem_flags.FIXED_STEM (Option B)
let maxScale = 2.0;               // Maximum Scale Multiplier (M)
let radius = 160.0;               // Radius of Influence (R)
let curveType = 1;                // 0: Linear, 1: Cosine Bell, 2: Smoothstep

// Main Dock View State
const mainDockState = new DockViewState({ id: 'main' });

// Pointer State for GTK Window
let mouseX = 0.0;
let mouseY = 0.0;
let activePointerX = -1;
let activePointerY = -1;
let isPointerInside = false;

// Active Sub-Dock Popup (for Drawers)
let activeSubDock = null;

/**
 * Bell Curve Proximity Scaling
 */
function calculateScale(dist, R, M, type) {
  if (dist >= R) return 1.0;
  const t = 1.0 - (dist / R);
  let factor = t;
  if (type === 1) {
    factor = Math.cos((dist / R) * (Math.PI / 2));
  } else if (type === 2) {
    factor = t * t * (3 - 2 * t);
  }
  return 1.0 + (M - 1.0) * factor;
}

// SVG Handle Cache
const rsvgCache = new Map();

function getRsvgHandle(theme, iconName) {
  if (rsvgCache.has(iconName)) return rsvgCache.get(iconName);

  try {
    const paintable = theme.lookup_icon(iconName, null, 64, 1, Gtk.TextDirection.NONE, 0);
    if (paintable && paintable.get_file) {
      const file = paintable.get_file();
      const path = file.get_path();
      if (path && path.endsWith('.svg')) {
        const handle = Rsvg.Handle.new_from_file(path);
        rsvgCache.set(iconName, handle);
        return handle;
      }
    }
  } catch (e) {
    // fallback
  }

  rsvgCache.set(iconName, null);
  return null;
}

// --- Application Setup ---

const app = new Gtk.Application({
  application_id: 'org.gnome.test.UltimateDockPrototype',
  flags: Gio.ApplicationFlags.FLAGS_NONE,
});

app.connect('activate', (app) => {
  const win = new Gtk.ApplicationWindow({
    application: app,
    title: 'The Ultimate Shell — DockModel & Modular Widgets Prototype',
    default_width: 960,
    default_height: 580,
  });

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  });
  win.set_child(box);

  // Header info label
  const infoLabel = new Gtk.Label({
    label:
      '<b>The Ultimate Shell: Autonomous DockModel &amp; Modular Widgets Prototype</b>\n' +
      '• <b>Unified Items:</b> Apps | Collapsible Drawer Sub-Dock | Cairo Analog Clock | Dynamic Trash | Separator\n' +
      '• <b>Controls:</b> Click item: actions/drawers | <b>F:</b> Fan vs Dock popup | <b>S:</b> Stem mode (Center vs Fixed) | <b>Up/Down:</b> Scale | <b>Left/Right:</b> Radius | <b>C:</b> Curve | <b>R:</b> Edge',
    use_markup: true,
    margin_top: 10,
    margin_bottom: 4,
  });
  box.append(infoLabel);

  // Status text
  const statusLabel = new Gtk.Label({
    label: 'Status: Ready',
    margin_bottom: 4,
  });
  box.append(statusLabel);

  // Initialize Observable DockModel & Sources
  const model = new DockModel();
  model.addSource(new MockFavoritesSource());
  model.addSource(new MockRunningAppsSource());
  model.addSource(new MockDrawerSource());
  model.addSource(new MockWidgetsSource());

  // Drawing Canvas
  const drawingArea = new Gtk.DrawingArea({
    hexpand: true,
    vexpand: true,
  });
  box.append(drawingArea);

  let iconTheme = null;

  // Track Layout bounds for hit-testing
  let currentComputedLayout = [];
  let currentDockPillBounds = null;

  // Helper to trace a clean rounded rectangle with exact corner radiuses
  function drawRoundedRect(cr, x, y, w, h, r) {
    const radius = Math.min(r, Math.min(w, h) / 2);
    cr.newSubPath();
    cr.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    cr.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    cr.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    cr.arc(x + radius, y + radius, radius, Math.PI, (3 * Math.PI) / 2);
    cr.closePath();
  }

  /**
   * Functional item renderer: draws widgets, SVG icons, badges, indicators, or separators.
   *
   * @param {Cairo.Context} cr
   * @param {DockItem} item
   * @param {Object} layout - { rect, scale, size }
   * @param {Object} options - { position, isVertical, iconTheme, pillBounds, itemContainerBg }
   */
  function drawItem(cr, item, layout, options = {}) {
    const { rect, scale = 1.0 } = layout;
    const {
      position = currentPosition,
      isVertical = false,
      theme = iconTheme,
      pillBounds = null,
      itemContainerBg = false,
    } = options;

    if (item.type === ItemType.SEPARATOR) {
      cr.save();
      cr.setSourceRGBA(0.65, 0.7, 0.8, 0.45);
      if (pillBounds) {
        if (isVertical) {
          const sepWidth = pillBounds.w * 0.55;
          const sepX = pillBounds.x + (pillBounds.w - sepWidth) / 2;
          const sepY = rect.y + rect.h / 2 - 1;
          cr.rectangle(sepX, sepY, sepWidth, 1.5);
        } else {
          const sepHeight = pillBounds.h * 0.55;
          const sepX = rect.x + rect.w / 2 - 1;
          const sepY = pillBounds.y + (pillBounds.h - sepHeight) / 2;
          cr.rectangle(sepX, sepY, 1.5, sepHeight);
        }
      } else {
        if (isVertical) {
          cr.rectangle(rect.x + 4, rect.y + rect.h / 2 - 1, rect.w - 8, 1.5);
        } else {
          cr.rectangle(rect.x + rect.w / 2 - 1, rect.y + 4, 1.5, rect.h - 8);
        }
      }
      cr.fill();
      cr.restore();
      return;
    }

    cr.save();

    // Optional container background box (used by sub-docks/drawers)
    if (itemContainerBg) {
      cr.save();
      drawRoundedRect(cr, rect.x, rect.y, rect.w, rect.h, 10);
      cr.setSourceRGBA(0.22, 0.26, 0.35, 0.7);
      cr.fillPreserve();
      cr.setSourceRGBA(0.38, 0.48, 0.65, 0.4);
      cr.setLineWidth(1.0);
      cr.stroke();
      cr.restore();
    }

    // Custom Draw (e.g. Clock Widget)
    if (item.hasCustomDraw && item.hasCustomDraw()) {
      cr.save();
      cr.translate(rect.x, rect.y);
      item.onCustomDraw(cr, rect.w, rect.h, scale);
      cr.restore();
    } else {
      const iconName = item.getIconName ? item.getIconName() : item.iconName;
      const handle = getRsvgHandle(theme, iconName);
      let drewSvg = false;

      const innerPad = itemContainerBg ? 4 : 0;
      const drawW = rect.w - innerPad * 2;
      const drawH = rect.h - innerPad * 2;
      const drawX = rect.x + innerPad;
      const drawY = rect.y + innerPad;

      if (handle) {
        try {
          const dims = handle.get_intrinsic_size_in_pixels();
          let natW = 64;
          let natH = 64;
          if (Array.isArray(dims) && dims.length >= 3) {
            natW = typeof dims[1] === 'number' && dims[1] > 0 ? dims[1] : 64;
            natH = typeof dims[2] === 'number' && dims[2] > 0 ? dims[2] : 64;
          }

          cr.save();
          if (!itemContainerBg) {
            cr.setSourceRGBA(0, 0, 0, 0.28);
            cr.arc(drawX + drawW / 2, drawY + drawH / 2 + 2 * scale, drawW * 0.44, 0, 2 * Math.PI);
            cr.fill();
          }

          cr.translate(drawX, drawY);
          cr.scale(drawW / natW, drawH / natH);
          handle.render_document(
            cr,
            new Rsvg.Rectangle({ x: 0, y: 0, width: natW, height: natH })
          );
          cr.restore();
          drewSvg = true;
        } catch (e) {
          drewSvg = false;
        }
      }

      if (!drewSvg) {
        cr.save();
        if (!itemContainerBg) {
          cr.setSourceRGBA(0.24, 0.28, 0.36, 0.9);
          cr.arc(drawX + drawW / 2, drawY + drawH / 2, drawW / 2 - 2, 0, 2 * Math.PI);
          cr.fillPreserve();
          cr.setSourceRGBA(0.55, 0.65, 0.8, 0.6);
          cr.setLineWidth(1.5);
          cr.stroke();
        }

        cr.setSourceRGBA(0.92, 0.94, 0.98, 0.95);
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(Math.max(10, 14 * scale));
        const glyph = item.label ? item.label.charAt(0) : '?';
        const ext = cr.textExtents(glyph);
        const gXBearing = ext.xBearing ?? ext.x_bearing ?? 0;
        const gYBearing = ext.yBearing ?? ext.y_bearing ?? (-ext.height);
        cr.moveTo(
          drawX + drawW / 2 - ext.width / 2 - gXBearing,
          drawY + drawH / 2 - ext.height / 2 - gYBearing
        );
        cr.showText(glyph);
        cr.restore();
      }
    }

    // Running Indicator Dot
    const indicator = item.getIndicator ? item.getIndicator() : item.indicator;
    if (indicator === IndicatorState.RUNNING || indicator === IndicatorState.FOCUSED) {
      const dotR = 2.5 * scale;
      let dotX = rect.x + rect.w / 2;
      let dotY = position === Positions.BOTTOM ? rect.y + rect.h + 4 : rect.y - 4;
      if (isVertical) {
        dotX = position === Positions.LEFT ? rect.x - 4 : rect.x + rect.w + 4;
        dotY = rect.y + rect.h / 2;
      }

      cr.arc(dotX, dotY, dotR, 0, 2 * Math.PI);
      if (indicator === IndicatorState.FOCUSED) {
        cr.setSourceRGBA(0.3, 0.7, 1.0, 0.95);
      } else {
        cr.setSourceRGBA(0.9, 0.92, 0.95, 0.85);
      }
      cr.fill();
    }

    // Notification Badge Pill
    const badge = item.getBadge ? item.getBadge() : item.badge;
    if (badge !== null && badge !== undefined) {
      const badgeText = String(badge);
      cr.setFontSize(9 * scale);
      const bExt = cr.textExtents(badgeText);
      const bXBearing = bExt.xBearing ?? bExt.x_bearing ?? 0;
      const bYBearing = bExt.yBearing ?? bExt.y_bearing ?? (-bExt.height);
      const bW = Math.max(14 * scale, bExt.width + 6 * scale);
      const bH = 12 * scale;
      const bX = rect.x + rect.w - bW + 2;
      const bY = rect.y - 2;

      cr.setSourceRGBA(0.92, 0.25, 0.25, 0.95);
      cr.arc(bX + bW - bH / 2, bY + bH / 2, bH / 2, -Math.PI / 2, Math.PI / 2);
      cr.arc(bX + bH / 2, bY + bH / 2, bH / 2, Math.PI / 2, (3 * Math.PI) / 2);
      cr.closePath();
      cr.fill();

      cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0);
      cr.moveTo(
        bX + bW / 2 - bExt.width / 2 - bXBearing,
        bY + bH / 2 - bExt.height / 2 - bYBearing
      );
      cr.showText(badgeText);
    }

    cr.restore();
  }

  /**
   * Universal Dock Renderer: computes layout, background pill, optional callout arrow,
   * and renders each item using drawItem.
   *
   * @param {Cairo.Context} cr
   * @param {DockModel} dockModel - Observable DockModel containing items
   * @param {Object} winBounds - { width, height }
   * @param {Object} settings - Configurable options:
   *        state {DockViewState} - State instance for localized tracking & freezing
   *        animate {boolean} - Enable magnification scaling
   *        iconSize {number} - Base icon dimension
   *        padding {number} - Item padding
   *        bgPadding {number} - Padding around items in dock pill
   *        position {number} - Positions enum
   *        pointerPos {number} - Coordinate along primary axis (overrides state if provided)
   *        hoverAmount {number} - 0.0 to 1.0 transition factor (overrides state if provided)
   *        isFrozen {boolean} - Whether scaling is locked
   *        fan {boolean} - Perpendicular fan-out mode (no background, perpendicular to main dock)
   *        anchorRect {Object} - Target rectangle anchor for fan or callout arrow
   *        arrow {Object} - Optional { targetRect, size } callout arrow anchor
   *        itemContainerBg {boolean} - Draw subtle containers around items
   *        theme {Gtk.IconTheme}
   * @returns {Object} { layout: Array, pillBounds: Object, primaryRestingStart: number, localPointer: number }
   */
  function drawDock(cr, dockModel, winBounds, settings = {}) {
    const items = dockModel.getItems();
    const count = items.length;
    if (count === 0) return { layout: [], pillBounds: null, primaryRestingStart: 0, localPointer: 0 };

    const {
      state = null,
      animate = true,
      iconSize = settings.iconSize || BASE_ICON_SIZE,
      padding = settings.padding || BASE_PADDING,
      bgPadding = settings.bgPadding || 10,
      position = currentPosition,
      fan = false,
      stemMode = settings.stemMode ?? settings.stem_flags ?? currentStemMode,
      anchorRect = null,
      arrow = null,
      itemContainerBg = false,
      theme = iconTheme,
    } = settings;

    // Perpendicular fan axis:
    // When fan is true:
    // If main dock is BOTTOM or TOP (horizontal), the fan shoots VERTICALLY.
    // If main dock is LEFT or RIGHT (vertical), the fan shoots HORIZONTALLY.
    const isMainVertical = position === Positions.LEFT || position === Positions.RIGHT;
    const isVertical = fan ? !isMainVertical : isMainVertical;

    const primarySpan = isVertical ? winBounds.height : winBounds.width;
    const secondarySpan = isVertical ? winBounds.width : winBounds.height;

    // Determine frozen status and effective values
    const isFrozen = settings.isFrozen ?? (state ? state.isFrozen : false);
    const frozen = isFrozen && state && state.frozenState ? state.frozenState : null;

    const effectivePointer = frozen && frozen.pointerPrimary !== undefined
      ? frozen.pointerPrimary
      : (settings.pointerPos ?? (state ? state.pointerPrimary : (isVertical ? mouseY : mouseX)));

    const effectiveHoverAmount = frozen && frozen.hoverProgress !== undefined
      ? frozen.hoverProgress
      : (settings.hoverAmount ?? (state ? state.hoverProgress : 0.0));

    // 1. Static resting bounds
    const staticSlots = [];
    let curOffset = 0;
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const isSep = item.type === ItemType.SEPARATOR;
      const w = isSep ? SEPARATOR_WIDTH : iconSize;
      staticSlots.push({
        item,
        start: curOffset,
        center: curOffset + w / 2,
        width: w,
        isSep,
      });
      curOffset += w + padding;
    }
    const restingTotalLength = curOffset - padding;
    const restingPillSpan = restingTotalLength + bgPadding * 2;

    // Compute dock's localized resting start along primary axis
    let primaryRestingStart = 0;
    const target = anchorRect || (arrow ? arrow.targetRect : null);
    const fanGap = 12;

    if (fan && target) {
      // Perpendicular Fan resting origin: anchored to target and shoots away from main dock
      if (position === Positions.BOTTOM) {
        primaryRestingStart = target.y - fanGap - restingTotalLength;
      } else if (position === Positions.TOP) {
        primaryRestingStart = target.y + target.h + fanGap;
      } else if (position === Positions.LEFT) {
        primaryRestingStart = target.x + target.w + fanGap;
      } else {
        primaryRestingStart = target.x - fanGap - restingTotalLength;
      }
    } else if (arrow && arrow.targetRect) {
      if (isVertical) {
        const restingBgY = Math.max(16, Math.min(primarySpan - restingPillSpan - 16, arrow.targetRect.y + arrow.targetRect.h / 2 - restingPillSpan / 2));
        primaryRestingStart = restingBgY + bgPadding;
      } else {
        const restingBgX = Math.max(16, Math.min(primarySpan - restingPillSpan - 16, arrow.targetRect.x + arrow.targetRect.w / 2 - restingPillSpan / 2));
        primaryRestingStart = restingBgX + bgPadding;
      }
    } else {
      primaryRestingStart = (primarySpan - restingTotalLength) / 2;
    }

    // Localized pointer coordinate relative to dock's resting origin
    let localPointer = 0;
    if (frozen && frozen.localPointer !== undefined) {
      localPointer = frozen.localPointer;
    } else {
      localPointer = effectivePointer - primaryRestingStart;
    }

    // 2. Scales computation
    const targetScales = new Array(count);
    const activeScales = new Array(count);
    const activeSizes = new Array(count);

    if (animate) {
      for (let i = 0; i < count; i++) {
        if (staticSlots[i].isSep) {
          targetScales[i] = 1.0;
        } else {
          const dist = Math.abs(localPointer - staticSlots[i].center);
          targetScales[i] = calculateScale(dist, radius, maxScale, curveType);
        }
        activeScales[i] = 1.0 + (targetScales[i] - 1.0) * effectiveHoverAmount;
        activeSizes[i] = staticSlots[i].isSep ? SEPARATOR_WIDTH : iconSize * activeScales[i];
      }
    } else {
      for (let i = 0; i < count; i++) {
        targetScales[i] = 1.0;
        activeScales[i] = 1.0;
        activeSizes[i] = staticSlots[i].isSep ? SEPARATOR_WIDTH : iconSize;
      }
    }

    // 3. Dynamic cumulative continuous offset
    let dynamicTotalLength = 0;
    for (let i = 0; i < count; i++) {
      dynamicTotalLength += activeSizes[i] + padding;
    }
    dynamicTotalLength -= padding;

    const dynamicStart = (primarySpan - dynamicTotalLength) / 2;
    const computedLayout = [];
    let accum = dynamicStart;

    // Determine baseline position
    const maxActiveSize = Math.max(...activeSizes);
    const bgCrossSize = Math.max(iconSize + 20, maxActiveSize + bgPadding * 2);
    let bgX = 0, bgY = 0, bgW = 0, bgH = 0;

    if (fan && target) {
      if (stemMode === stem_flags.FIXED_STEM) {
        // Option B: Fixed stem root pinned at resting boundary (no overflow before resting position)
        if (position === Positions.BOTTOM) {
          accum = target.y - fanGap - dynamicTotalLength;
        } else if (position === Positions.TOP) {
          accum = target.y + target.h + fanGap;
        } else if (position === Positions.LEFT) {
          accum = target.x + target.w + fanGap;
        } else {
          accum = target.x - fanGap - dynamicTotalLength;
        }
      } else {
        // Option A: Symmetrical center-basis expansion (allows fan dock to overflow before its resting boundary)
        accum = primaryRestingStart - (dynamicTotalLength - restingTotalLength) / 2;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < count; i++) {
        const item = items[i];
        const size = activeSizes[i];
        const scale = activeScales[i];

        let ix = 0;
        let iy = 0;

        if (isVertical) {
          // Perpendicular vertical column aligned with target's X center
          ix = target.x + target.w / 2 - size / 2;
          iy = accum;
        } else {
          // Perpendicular horizontal row aligned with target's Y center
          ix = accum;
          iy = target.y + target.h / 2 - size / 2;
        }

        minX = Math.min(minX, ix);
        minY = Math.min(minY, iy);
        maxX = Math.max(maxX, ix + size);
        maxY = Math.max(maxY, iy + size);

        computedLayout.push({ item, rect: { x: ix, y: iy, w: size, h: size }, scale, size });
        accum += size + padding;
      }

      bgX = minX - 8;
      bgY = minY - 8;
      bgW = (maxX - minX) + 16;
      bgH = (maxY - minY) + 16;
    } else if (arrow && arrow.targetRect) {
      // Anchored Sub-Dock Popup mode: position perpendicular to arrow.targetRect
      const popContentW = dynamicTotalLength + bgPadding * 2;
      const popContentH = bgCrossSize;
      const aTarget = arrow.targetRect;

      if (position === Positions.BOTTOM) {
        bgW = popContentW;
        bgH = popContentH;
        bgX = Math.max(16, Math.min(winBounds.width - bgW - 16, aTarget.x + aTarget.w / 2 - bgW / 2));
        bgY = aTarget.y - bgH - 12;
      } else if (position === Positions.TOP) {
        bgW = popContentW;
        bgH = popContentH;
        bgX = Math.max(16, Math.min(winBounds.width - bgW - 16, aTarget.x + aTarget.w / 2 - bgW / 2));
        bgY = aTarget.y + aTarget.h + 12;
      } else if (position === Positions.LEFT) {
        bgW = popContentH;
        bgH = popContentW;
        bgX = aTarget.x + aTarget.w + 12;
        bgY = Math.max(16, Math.min(winBounds.height - bgH - 16, aTarget.y + aTarget.h / 2 - bgH / 2));
      } else {
        // RIGHT
        bgW = popContentH;
        bgH = popContentW;
        bgX = aTarget.x - bgW - 12;
        bgY = Math.max(16, Math.min(winBounds.height - bgH - 16, aTarget.y + aTarget.h / 2 - bgH / 2));
      }

      // Compute item positions inside anchored popup
      accum = (isVertical ? bgY : bgX) + bgPadding;
      for (let i = 0; i < count; i++) {
        const item = items[i];
        const size = activeSizes[i];
        const scale = activeScales[i];
        let ix = bgX + bgPadding;
        let iy = bgY + bgPadding;

        if (isVertical) {
          iy = accum;
          ix = bgX + (bgW - size) / 2;
        } else {
          ix = accum;
          iy = bgY + (bgH - size) / 2;
        }

        computedLayout.push({ item, rect: { x: ix, y: iy, w: size, h: size }, scale, size });
        accum += size + padding;
      }
    } else {
      // Main dock positioning
      const mainPillCross = iconSize + 20;
      if (isVertical) {
        bgW = mainPillCross;
        bgH = dynamicTotalLength + bgPadding * 2;
        bgY = dynamicStart - bgPadding;
        bgX = position === Positions.LEFT ? 8 : secondarySpan - mainPillCross - 8;
      } else {
        bgW = dynamicTotalLength + bgPadding * 2;
        bgH = mainPillCross;
        bgX = dynamicStart - bgPadding;
        bgY = position === Positions.BOTTOM ? secondarySpan - mainPillCross - 8 : 8;
      }

      for (let i = 0; i < count; i++) {
        const item = items[i];
        const size = activeSizes[i];
        const scale = activeScales[i];

        let secPos = 0;
        if (position === Positions.BOTTOM) {
          secPos = secondarySpan - 18 - size;
        } else if (position === Positions.TOP) {
          secPos = 18;
        } else if (position === Positions.LEFT) {
          secPos = 18;
        } else {
          secPos = secondarySpan - 18 - size;
        }

        const rect = isVertical
          ? { x: secPos, y: accum, w: size, h: size }
          : { x: accum, y: secPos, w: size, h: size };

        computedLayout.push({ item, rect, scale, size });
        accum += size + padding;
      }
    }

    const pillBounds = { x: bgX, y: bgY, w: bgW, h: bgH };

    if (state) {
      state.pillBounds = pillBounds;
      state.computedLayout = computedLayout;
      state.primaryRestingStart = primaryRestingStart;
      state.localPointer = localPointer;
    }

    cr.save();

    // 4. Background Shadows & Glassmorphic Body (Skipped in fan mode - no background)
    if (!fan) {
      if (arrow) {
        cr.setSourceRGBA(0, 0, 0, 0.4);
        drawRoundedRect(cr, bgX + 2, bgY + 4, bgW, bgH, 16);
        cr.fill();

        drawRoundedRect(cr, bgX, bgY, bgW, bgH, 16);
        cr.setSourceRGBA(0.13, 0.15, 0.2, 0.94);
        cr.fillPreserve();
        cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
        cr.setLineWidth(1.5);
        cr.stroke();

        // Callout Arrow Anchor
        if (arrow.targetRect) {
          const arrowSize = arrow.size || 7;
          const arrowTarget = arrow.targetRect;
          cr.save();
          cr.setSourceRGBA(0.13, 0.15, 0.2, 0.94);

          if (position === Positions.BOTTOM) {
            const arrowX = arrowTarget.x + arrowTarget.w / 2;
            cr.moveTo(arrowX - arrowSize, bgY + bgH);
            cr.lineTo(arrowX + arrowSize, bgY + bgH);
            cr.lineTo(arrowX, bgY + bgH + arrowSize);
            cr.closePath();
            cr.fillPreserve();
            cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
            cr.setLineWidth(1.5);
            cr.stroke();
          } else if (position === Positions.TOP) {
            const arrowX = arrowTarget.x + arrowTarget.w / 2;
            cr.moveTo(arrowX - arrowSize, bgY);
            cr.lineTo(arrowX + arrowSize, bgY);
            cr.lineTo(arrowX, bgY - arrowSize);
            cr.closePath();
            cr.fillPreserve();
            cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
            cr.setLineWidth(1.5);
            cr.stroke();
          } else if (position === Positions.LEFT) {
            const arrowY = arrowTarget.y + arrowTarget.h / 2;
            cr.moveTo(bgX, arrowY - arrowSize);
            cr.lineTo(bgX, arrowY + arrowSize);
            cr.lineTo(bgX - arrowSize, arrowY);
            cr.closePath();
            cr.fillPreserve();
            cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
            cr.setLineWidth(1.5);
            cr.stroke();
          } else {
            const arrowY = arrowTarget.y + arrowTarget.h / 2;
            cr.moveTo(bgX + bgW, arrowY - arrowSize);
            cr.lineTo(bgX + bgW, arrowY + arrowSize);
            cr.lineTo(bgX + bgW + arrowSize, arrowY);
            cr.closePath();
            cr.fillPreserve();
            cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
            cr.setLineWidth(1.5);
            cr.stroke();
          }
          cr.restore();
        }
      } else {
        // Main dock pill
        drawRoundedRect(cr, bgX, bgY, bgW, bgH, 18);
        cr.setSourceRGBA(0.18, 0.2, 0.24, 0.72);
        cr.fillPreserve();
        cr.setSourceRGBA(0.4, 0.45, 0.55, 0.35);
        cr.setLineWidth(1.5);
        cr.stroke();
      }
    }
    cr.restore();

    // 5. Draw items
    for (let i = 0; i < count; i++) {
      drawItem(cr, computedLayout[i].item, computedLayout[i], {
        position,
        isVertical,
        theme,
        pillBounds: fan ? null : pillBounds,
        itemContainerBg,
      });
    }

    return { layout: computedLayout, pillBounds, primaryRestingStart, localPointer };
  }

  // Wallpaper Pixbuf Cache
  let wallpaperPixbuf = null;
  if (DRAW_WALLPAPER) {
    const wallpaperPath = GLib.build_filenamev([GLib.get_current_dir(), 'prototype', 'wallpaper.jpg']);
    if (GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS)) {
      try {
        wallpaperPixbuf = GdkPixbuf.Pixbuf.new_from_file(wallpaperPath);
      } catch (e) {
        console.warn(`[Prototype] Could not load wallpaper: ${e.message}`);
      }
    }
  }

  // --- Render Draw Function ---
  drawingArea.set_draw_func((area, cr, width, height) => {
    if (!iconTheme) {
      iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    }

    // 0. Render Desktop Wallpaper (or Fallback Dark Fill)
    if (wallpaperPixbuf) {
      const imgW = wallpaperPixbuf.get_width();
      const imgH = wallpaperPixbuf.get_height();

      // Cover / Aspect-fill scaling
      const scaleFactor = Math.max(width / imgW, height / imgH);
      const drawW = imgW * scaleFactor;
      const drawH = imgH * scaleFactor;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      cr.save();
      cr.translate(drawX, drawY);
      cr.scale(scaleFactor, scaleFactor);
      Gdk.cairo_set_source_pixbuf(cr, wallpaperPixbuf, 0, 0);
      cr.paint();
      cr.restore();

      // Subtle darkening overlay (30% tint) for contrast and ease on eyes
      // cr.save();
      // cr.setSourceRGBA(0.12, 0.13, 0.16, 1.0);
      // cr.paint();
      // cr.restore();
    } else {
      cr.setSourceRGB(0.12, 0.13, 0.16);
      cr.paint();
    }

    // 1. Draw Main Dock via reusable drawDock
    const mainDockRes = drawDock(cr, model, { width, height }, {
      state: mainDockState,
      animate: true,
      iconSize: BASE_ICON_SIZE,
      padding: BASE_PADDING,
      bgPadding: BASE_BG_PADDING,
      position: currentPosition,
      theme: iconTheme,
    });

    currentComputedLayout = mainDockRes.layout;
    currentDockPillBounds = mainDockRes.pillBounds;

    // 2. Draw Sub-Dock Popup (if Drawer is open) via shared drawDock with fan or dock settings
    if (activeSubDock) {
      const callingLayout = currentComputedLayout.find(l => l.item.id === activeSubDock.callingItemId);
      const parentRect = callingLayout ? callingLayout.rect : activeSubDock.parentRect;

      if (parentRect && activeSubDock.model) {
        const isFan = subDockMode === SubDockStyle.FAN;
        const subRes = drawDock(cr, activeSubDock.model, { width, height }, {
          state: activeSubDock.state,
          animate: true,
          iconSize: SUBDOCK_ICON_SIZE,
          padding: SUBDOCK_PADDING,
          bgPadding: SUBDOCK_BG_PADDING,
          position: currentPosition,
          fan: isFan,
          stemMode: currentStemMode,
          anchorRect: parentRect,
          arrow: isFan ? null : { targetRect: parentRect, size: 7 },
          itemContainerBg: !isFan,
          theme: iconTheme,
        });
        activeSubDock.computedChildLayout = subRes.layout;
      }
    }

    // 3. Hover Label Tooltip: White text over rounded rectangle background
    // Display only when mouse is over a dock item.
    // When a sub-dock is present, disable labels for the main dock.
    if (isPointerInside && activePointerX >= 0 && activePointerY >= 0) {
      let hoveredLayout = null;
      let isSubDockItem = false;

      // Check sub-dock hit first
      if (activeSubDock && activeSubDock.state) {
        const subHit = activeSubDock.state.getItemAt(activePointerX, activePointerY);
        if (subHit && subHit.item && subHit.item.type !== ItemType.SEPARATOR) {
          hoveredLayout = subHit;
          isSubDockItem = true;
        }
      }

      // Check main dock hit ONLY if no sub-dock is present
      if (!activeSubDock && !hoveredLayout && mainDockState) {
        const mainHit = mainDockState.getItemAt(activePointerX, activePointerY);
        if (mainHit && mainHit.item && mainHit.item.type !== ItemType.SEPARATOR) {
          hoveredLayout = mainHit;
          isSubDockItem = false;
        }
      }

      if (hoveredLayout && hoveredLayout.item) {
        const labelText = hoveredLayout.item.getLabel ? hoveredLayout.item.getLabel() : (hoveredLayout.item.label || '');
        if (labelText && labelText.trim().length > 0) {
          cr.save();
          cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
          const fontSize = 12;
          cr.setFontSize(fontSize);
          const ext = cr.textExtents(labelText);
          const tipXBearing = ext.xBearing ?? ext.x_bearing ?? 0;
          const tipYBearing = ext.yBearing ?? ext.y_bearing ?? (-ext.height);

          const padH = 10;
          const padV = 6;
          const tipW = ext.width + padH * 2;
          const tipH = ext.height + padV * 2;
          const itemRect = hoveredLayout.rect;
          const tipRadius = 7;
          const margin = 12;

          let tipX = 0;
          let tipY = 0;

          if (isSubDockItem && subDockMode === SubDockStyle.FAN) {
            // Perpendicular fan orientation
            if (currentPosition === Positions.BOTTOM || currentPosition === Positions.TOP) {
              tipX = itemRect.x + itemRect.w + margin;
              tipY = itemRect.y + (itemRect.h - tipH) / 2;
              if (tipX + tipW > width - 12) {
                tipX = itemRect.x - tipW - margin;
              }
            } else {
              tipX = itemRect.x + (itemRect.w - tipW) / 2;
              tipY = itemRect.y - tipH - margin;
              if (tipY < 12) {
                tipY = itemRect.y + itemRect.h + margin;
              }
            }
          } else {
            // Main dock or enclosed popup orientation
            if (currentPosition === Positions.BOTTOM) {
              tipX = itemRect.x + (itemRect.w - tipW) / 2;
              tipY = itemRect.y - tipH - margin;
            } else if (currentPosition === Positions.TOP) {
              tipX = itemRect.x + (itemRect.w - tipW) / 2;
              tipY = itemRect.y + itemRect.h + margin;
            } else if (currentPosition === Positions.LEFT) {
              tipX = itemRect.x + itemRect.w + margin;
              tipY = itemRect.y + (itemRect.h - tipH) / 2;
            } else {
              // RIGHT
              tipX = itemRect.x - tipW - margin;
              tipY = itemRect.y + (itemRect.h - tipH) / 2;
            }
          }

          // Clamp within window viewport
          tipX = Math.max(8, Math.min(width - tipW - 8, tipX));
          tipY = Math.max(8, Math.min(height - tipH - 8, tipY));

          // Draw tooltip shadow
          cr.newPath();
          drawRoundedRect(cr, tipX + 1.5, tipY + 2.5, tipW, tipH, tipRadius);
          cr.setSourceRGBA(0.0, 0.0, 0.0, 0.35);
          cr.fill();
          cr.newPath();

          // Draw dark rounded rect background
          drawRoundedRect(cr, tipX, tipY, tipW, tipH, tipRadius);
          cr.setSourceRGBA(0.12, 0.14, 0.18, 0.94);
          cr.fillPreserve();
          cr.setSourceRGBA(0.40, 0.46, 0.58, 0.65);
          cr.setLineWidth(1.0);
          cr.stroke();
          cr.newPath();

          // Draw clean white text
          cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0);
          const textX = tipX + (tipW - ext.width) / 2 - tipXBearing;
          const textY = tipY + (tipH - ext.height) / 2 - tipYBearing;
          cr.moveTo(textX, textY);
          cr.showText(labelText);
          cr.newPath();

          cr.restore();
        }
      }
    }
  });

  // --- Animation Tick Loop ---
  drawingArea.add_tick_callback(() => {
    let needsRedraw = false;

    if (mainDockState.tick(LERP_ENTER_SPEED, LERP_LEAVE_SPEED)) {
      needsRedraw = true;
    }

    if (activeSubDock && activeSubDock.state && activeSubDock.state.tick(LERP_ENTER_SPEED, LERP_LEAVE_SPEED)) {
      needsRedraw = true;
    }

    // Always tick Clock widget
    needsRedraw = true;

    if (needsRedraw) {
      drawingArea.queue_draw();
    }
    return GLib.SOURCE_CONTINUE;
  });

  // --- Pointer & Input Handling ---
  const motion = new Gtk.EventControllerMotion();
  drawingArea.add_controller(motion);

  function updatePointerState(x, y) {
    activePointerX = x;
    activePointerY = y;
    isPointerInside = true;

    const isVertical = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT);
    mouseX = isVertical ? y : x;
    mouseY = isVertical ? x : y;

    // 1. Check active Sub-Dock first
    if (activeSubDock && activeSubDock.state) {
      const isOverSub = activeSubDock.state.isPointerOver(x, y);
      activeSubDock.state.setHover(isOverSub);
      if (isOverSub) {
        // If sub-dock is in fan mode, its axis is perpendicular to the main dock
        const isFan = subDockMode === SubDockStyle.FAN;
        const subDockVertical = isFan ? !isVertical : isVertical;
        activeSubDock.state.updatePointer(x, y, subDockVertical);
        const subItem = activeSubDock.state.getItemAt(x, y);
        if (subItem) {
          statusLabel.set_label(`Sub-Dock Hovered: <b>${subItem.item.label || subItem.item.id}</b> [Scale: ${subItem.scale.toFixed(2)}]`);
        } else {
          statusLabel.set_label('Sub-Dock: Hovered');
        }
        return;
      }
    }

    // 2. Check Main Dock
    const isOverMain = mainDockState.isPointerOver(x, y);
    if (!mainDockState.isFrozen) {
      mainDockState.setHover(isOverMain);
      if (isOverMain) {
        mainDockState.updatePointer(x, y, isVertical);
        const hoveredItem = mainDockState.getItemAt(x, y);
        if (hoveredItem) {
          statusLabel.set_label(`Hovered: <b>${hoveredItem.item.label || hoveredItem.item.id}</b> [Scale: ${hoveredItem.scale.toFixed(2)}]`);
        } else {
          statusLabel.set_label('Dock: Hovered');
        }
      } else {
        statusLabel.set_label('Status: Ready');
      }
    } else {
      // Main dock is frozen while sub-dock is open
      if (isOverMain) {
        const hoveredItem = mainDockState.getItemAt(x, y);
        if (hoveredItem) {
          statusLabel.set_label(`Dock (Frozen): <b>${hoveredItem.item.label || hoveredItem.item.id}</b>`);
        } else {
          statusLabel.set_label('Dock: Frozen (Sub-Dock Active)');
        }
      } else if (!activeSubDock || !activeSubDock.state || !activeSubDock.state.mouseOver) {
        statusLabel.set_label('Status: Ready');
      }
    }
  }

  motion.connect('enter', (controller, x, y) => {
    updatePointerState(x, y);
    drawingArea.queue_draw();
  });

  motion.connect('motion', (controller, x, y) => {
    updatePointerState(x, y);
  });

  motion.connect('leave', () => {
    isPointerInside = false;
    activePointerX = -1;
    activePointerY = -1;
    if (activeSubDock && activeSubDock.state) {
      activeSubDock.state.setHover(false);
    }
    if (!mainDockState.isFrozen) {
      mainDockState.setHover(false);
    }
    statusLabel.set_label('Status: Ready');
    drawingArea.queue_draw();
  });

  // Click Gesture
  const click = new Gtk.GestureClick();
  drawingArea.add_controller(click);

  click.connect('pressed', (gesture, n_press, x, y) => {
    // 1. Hit-test on active Sub-Dock items FIRST if open (prevents clicking through popup)
    if (activeSubDock && activeSubDock.state) {
      const childHit = activeSubDock.state.getItemAt(x, y);
      if (childHit) {
        const item = childHit.item;
        console.log(`[SubDock Click] Activated sub-item: ${item.label} (${item.id})`);
        statusLabel.set_label(`Sub-Item Activated: <b>${item.label}</b>`);
        if (item.onClick) {
          item.onClick(1, 0);
        }
        drawingArea.queue_draw();
        return;
      }

      // If clicked inside the sub-dock pill bounds (background margin)
      if (activeSubDock.state.isPointerOver(x, y)) {
        return;
      }
    }

    // 2. Hit-test on main dock items
    const mainHit = mainDockState.getItemAt(x, y);
    if (mainHit) {
      const item = mainHit.item;
      console.log(`[Prototype Click] Activated item: ${item.label} (${item.id})`);
      statusLabel.set_label(`Activated: <b>${item.label}</b>`);

      // Check if item is a Drawer -> spawn sub-dock and FREEZE parent dock
      if (item.type === ItemType.DRAWER) {
        if (activeSubDock && activeSubDock.callingItemId === item.id) {
          // Toggle closed
          activeSubDock = null;
          mainDockState.unfreeze();
        } else {
          // Freeze main dock and open drawer sub-dock
          mainDockState.freeze();
          const subItems = item.getChildren();
          const subModel = new DockModel({ items: subItems });
          const subState = new DockViewState({ id: `subdock-${item.id}` });
          activeSubDock = {
            drawer: item,
            callingItemId: item.id,
            items: subItems,
            model: subModel,
            state: subState,
            parentRect: mainHit.rect,
          };
        }
      } else {
        // Regular item: dismiss sub-dock and unfreeze
        activeSubDock = null;
        mainDockState.unfreeze();
      }

      model.activateItem(item, 1, 0);
      drawingArea.queue_draw();
      return;
    }

    // 3. Clicked empty space: dismiss active sub-dock and unfreeze
    if (activeSubDock) {
      activeSubDock = null;
      mainDockState.unfreeze();
      drawingArea.queue_draw();
    }
  });

  // Keyboard Shortcuts for Parameter Tuning
  const keyController = new Gtk.EventControllerKey();
  win.add_controller(keyController);

  keyController.connect('key-pressed', (controller, keyval, keycode, state) => {
    if (keyval === Gdk.KEY_Up) {
      maxScale = Math.min(3.0, maxScale + 0.1);
      statusLabel.set_label(`Max Scale: ${maxScale.toFixed(2)}`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_Down) {
      maxScale = Math.max(1.0, maxScale - 0.1);
      statusLabel.set_label(`Max Scale: ${maxScale.toFixed(2)}`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_Right) {
      radius = Math.min(300.0, radius + 10.0);
      statusLabel.set_label(`Radius: ${radius.toFixed(0)}px`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_Left) {
      radius = Math.max(50.0, radius - 10.0);
      statusLabel.set_label(`Radius: ${radius.toFixed(0)}px`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_c || keyval === Gdk.KEY_C) {
      curveType = (curveType + 1) % 3;
      const names = ['Linear Proximity', 'Cosine Bell (macOS)', 'Smoothstep'];
      statusLabel.set_label(`Curve: ${names[curveType]}`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_f || keyval === Gdk.KEY_F) {
      subDockMode = subDockMode === SubDockStyle.FAN ? SubDockStyle.DOCK : SubDockStyle.FAN;
      statusLabel.set_label(`Sub-Dock Style: <b>${subDockMode === SubDockStyle.FAN ? 'Perpendicular Fan-Out (No Background)' : 'Enclosed Dock Popup'}</b>`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_s || keyval === Gdk.KEY_S) {
      currentStemMode = currentStemMode === stem_flags.CENTER_BASIS
        ? stem_flags.FIXED_STEM
        : stem_flags.CENTER_BASIS;
      const stemName = currentStemMode === stem_flags.FIXED_STEM
        ? 'Option B: Fixed Stem (Pinned Root)'
        : 'Option A: Center Basis (Overflow Allowed)';
      statusLabel.set_label(`Fan Stem Mode: <b>${stemName}</b>`);
      drawingArea.queue_draw();
      return true;
    }
    if (keyval === Gdk.KEY_r || keyval === Gdk.KEY_R) {
      currentPosition = (currentPosition + 1) % 4;
      if (activeSubDock) {
        activeSubDock = null;
        mainDockState.unfreeze();
      }
      const posNames = ['BOTTOM', 'LEFT', 'TOP', 'RIGHT'];
      statusLabel.set_label(`Position: ${posNames[currentPosition]}`);
      drawingArea.queue_draw();
      return true;
    }
    return false;
  });

  win.present();
});

app.run([]);
