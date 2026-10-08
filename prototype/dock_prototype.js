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
import { DockModel } from './dockModel.js';
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
const SEPARATOR_WIDTH = 10;
const Positions = { BOTTOM: 0, LEFT: 1, TOP: 2, RIGHT: 3 };

let currentPosition = Positions.BOTTOM;
let maxScale = 2.0;               // Maximum Scale Multiplier (M)
let radius = 160.0;               // Radius of Influence (R)
let curveType = 1;                // 0: Linear, 1: Cosine Bell, 2: Smoothstep

// Pointer & Animation State
let mouseX = 0.0;
let mouseY = 0.0;
let mouseOver = false;
let hoverProgress = 0.0;
let lerpPointer = 0.0;

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
      '• <b>Controls:</b> Click item to trigger actions / drawers | <b>Up/Down:</b> Scale | <b>Left/Right:</b> Radius | <b>C:</b> Curve | <b>R:</b> Edge',
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
        cr.moveTo(
          drawX + drawW / 2 - ext.width / 2 - ext.x_bearing,
          drawY + drawH / 2 - ext.height / 2 - ext.y_bearing
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
        bX + bW / 2 - bExt.width / 2 - bExt.x_bearing,
        bY + bH / 2 - bExt.height / 2 - bExt.y_bearing
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
   *        animate {boolean} - Enable magnification scaling
   *        iconSize {number} - Base icon dimension
   *        padding {number} - Item padding
   *        bgPadding {number} - Padding around items in dock pill
   *        position {number} - Positions enum
   *        pointerPos {number} - Coordinate along primary axis
   *        hoverAmount {number} - 0.0 to 1.0 transition factor
   *        isFrozen {boolean} - Whether scaling is locked
   *        arrow {Object} - Optional { targetRect, size } callout arrow anchor
   *        itemContainerBg {boolean} - Draw subtle containers around items
   *        theme {Gtk.IconTheme}
   * @returns {Object} { layout: Array, pillBounds: Object }
   */
  function drawDock(cr, dockModel, winBounds, settings = {}) {
    const items = dockModel.getItems();
    const count = items.length;
    if (count === 0) return { layout: [], pillBounds: null };

    const {
      animate = true,
      iconSize = BASE_ICON_SIZE,
      padding = BASE_PADDING,
      bgPadding = 10,
      position = currentPosition,
      pointerPos = mouseX,
      hoverAmount = hoverProgress,
      isFrozen = false,
      arrow = null,
      itemContainerBg = false,
      theme = iconTheme,
    } = settings;

    const isVertical = position === Positions.LEFT || position === Positions.RIGHT;
    const primarySpan = isVertical ? winBounds.height : winBounds.width;
    const secondarySpan = isVertical ? winBounds.width : winBounds.height;

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
    const restingStart = (primarySpan - restingTotalLength) / 2;

    // 2. Scales computation
    const targetScales = new Array(count);
    const activeScales = new Array(count);
    const activeSizes = new Array(count);

    if (animate) {
      for (let i = 0; i < count; i++) {
        if (staticSlots[i].isSep) {
          targetScales[i] = 1.0;
        } else {
          const staticCenter = restingStart + staticSlots[i].center;
          const dist = Math.abs(pointerPos - staticCenter);
          targetScales[i] = calculateScale(dist, radius, maxScale, curveType);
        }
        activeScales[i] = 1.0 + (targetScales[i] - 1.0) * hoverAmount;
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
    const bgCrossSize = iconSize + 20;
    let bgX = 0, bgY = 0, bgW = 0, bgH = 0;

    if (arrow && arrow.targetRect) {
      // Anchored Sub-Dock Popup mode: position perpendicular to arrow.targetRect
      const popContentW = dynamicTotalLength + bgPadding * 2;
      const popContentH = bgCrossSize;
      const target = arrow.targetRect;

      if (position === Positions.BOTTOM) {
        bgW = popContentW;
        bgH = popContentH;
        bgX = Math.max(16, Math.min(winBounds.width - bgW - 16, target.x + target.w / 2 - bgW / 2));
        bgY = target.y - bgH - 12;
      } else if (position === Positions.TOP) {
        bgW = popContentW;
        bgH = popContentH;
        bgX = Math.max(16, Math.min(winBounds.width - bgW - 16, target.x + target.w / 2 - bgW / 2));
        bgY = target.y + target.h + 12;
      } else if (position === Positions.LEFT) {
        bgW = popContentH;
        bgH = popContentW;
        bgX = target.x + target.w + 12;
        bgY = Math.max(16, Math.min(winBounds.height - bgH - 16, target.y + target.h / 2 - bgH / 2));
      } else {
        // RIGHT
        bgW = popContentH;
        bgH = popContentW;
        bgX = target.x - bgW - 12;
        bgY = Math.max(16, Math.min(winBounds.height - bgH - 16, target.y + target.h / 2 - bgH / 2));
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
      if (isVertical) {
        bgW = bgCrossSize;
        bgH = dynamicTotalLength + bgPadding * 2;
        bgY = dynamicStart - bgPadding;
        bgX = position === Positions.LEFT ? 8 : secondarySpan - bgCrossSize - 8;
      } else {
        bgW = dynamicTotalLength + bgPadding * 2;
        bgH = bgCrossSize;
        bgX = dynamicStart - bgPadding;
        bgY = position === Positions.BOTTOM ? secondarySpan - bgCrossSize - 8 : 8;
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

    cr.save();

    // 4. Background Shadows & Glassmorphic Body
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
        const target = arrow.targetRect;
        cr.save();
        cr.setSourceRGBA(0.13, 0.15, 0.2, 0.94);

        if (position === Positions.BOTTOM) {
          const arrowX = target.x + target.w / 2;
          cr.moveTo(arrowX - arrowSize, bgY + bgH);
          cr.lineTo(arrowX + arrowSize, bgY + bgH);
          cr.lineTo(arrowX, bgY + bgH + arrowSize);
          cr.closePath();
          cr.fillPreserve();
          cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
          cr.setLineWidth(1.5);
          cr.stroke();
        } else if (position === Positions.TOP) {
          const arrowX = target.x + target.w / 2;
          cr.moveTo(arrowX - arrowSize, bgY);
          cr.lineTo(arrowX + arrowSize, bgY);
          cr.lineTo(arrowX, bgY - arrowSize);
          cr.closePath();
          cr.fillPreserve();
          cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
          cr.setLineWidth(1.5);
          cr.stroke();
        } else if (position === Positions.LEFT) {
          const arrowY = target.y + target.h / 2;
          cr.moveTo(bgX, arrowY - arrowSize);
          cr.lineTo(bgX, arrowY + arrowSize);
          cr.lineTo(bgX - arrowSize, arrowY);
          cr.closePath();
          cr.fillPreserve();
          cr.setSourceRGBA(0.42, 0.58, 0.85, 0.6);
          cr.setLineWidth(1.5);
          cr.stroke();
        } else {
          const arrowY = target.y + target.h / 2;
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
    cr.restore();

    // 5. Draw items
    for (let i = 0; i < count; i++) {
      drawItem(cr, computedLayout[i].item, computedLayout[i], {
        position,
        isVertical,
        theme,
        pillBounds,
        itemContainerBg,
      });
    }

    return { layout: computedLayout, pillBounds };
  }

  // Wallpaper Pixbuf Cache
  let wallpaperPixbuf = null;
  const wallpaperPath = GLib.build_filenamev([GLib.get_current_dir(), 'prototype', 'wallpaper.jpg']);
  if (GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS)) {
    try {
      wallpaperPixbuf = GdkPixbuf.Pixbuf.new_from_file(wallpaperPath);
    } catch (e) {
      console.warn(`[Prototype] Could not load wallpaper: ${e.message}`);
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

    const isFrozen = !!activeSubDock;
    const effectivePointer = isFrozen && activeSubDock.frozenPointerPos !== undefined
      ? activeSubDock.frozenPointerPos
      : mouseX;
    const effectiveHoverProgress = isFrozen
      ? (activeSubDock.frozenHoverProgress ?? 1.0)
      : hoverProgress;

    // 1. Draw Main Dock via reusable drawDock
    const mainDockRes = drawDock(cr, model, { width, height }, {
      animate: true,
      iconSize: BASE_ICON_SIZE,
      padding: BASE_PADDING,
      bgPadding: 10,
      position: currentPosition,
      pointerPos: effectivePointer,
      hoverAmount: effectiveHoverProgress,
      isFrozen,
      theme: iconTheme,
    });

    currentComputedLayout = mainDockRes.layout;
    currentDockPillBounds = mainDockRes.pillBounds;

    // 2. Draw Sub-Dock Popup (if Drawer is open) via shared drawDock with sub-dock settings
    if (activeSubDock) {
      const callingLayout = currentComputedLayout.find(l => l.item.id === activeSubDock.callingItemId);
      const parentRect = callingLayout ? callingLayout.rect : activeSubDock.parentRect;

      if (parentRect && activeSubDock.model) {
        const subRes = drawDock(cr, activeSubDock.model, { width, height }, {
          animate: true,               // Sub-dock has static, crisp icon sizes
          iconSize: 44,                 // Sub-dock icon size
          padding: 10,
          bgPadding: 10,
          position: currentPosition,
          arrow: { targetRect: parentRect, size: 7 }, // Connected callout arrow
          itemContainerBg: true,        // Clean container boxes around sub-dock items
          theme: iconTheme,
        });
        activeSubDock.computedChildLayout = subRes.layout;
      }
    }
  });

  // --- Animation Tick Loop ---
  drawingArea.add_tick_callback(() => {
    let needsRedraw = false;
    const targetHover = mouseOver ? 1.0 : 0.0;
    const delta = targetHover - hoverProgress;

    // Smooth cubic/exponential lerp toward target
    // Use 0.14 for entering (snappy responsive feel) and 0.10 for leaving (graceful spring-back glide)
    const lerpSpeed = mouseOver ? 0.16 : 0.10;

    if (Math.abs(delta) > 0.0005) {
      hoverProgress += delta * lerpSpeed;
      needsRedraw = true;
    } else if (hoverProgress !== targetHover) {
      hoverProgress = targetHover;
      needsRedraw = true;
    }

    // Always tick Clock widget
    needsRedraw = true;

    if (needsRedraw) {
      drawingArea.queue_draw();
    }
    return GLib.SOURCE_CONTINUE;
  });

  // Helper to test if pointer (x, y) is inside the physical dock pill or any icon bounds
  function isPointerOverDock(x, y) {
    if (currentDockPillBounds) {
      const b = currentDockPillBounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return true;
      }
    }
    // Check if within any expanded icon rectangle
    for (let l of currentComputedLayout) {
      if (
        x >= l.rect.x &&
        x <= l.rect.x + l.rect.w &&
        y >= l.rect.y &&
        y <= l.rect.y + l.rect.h
      ) {
        return true;
      }
    }
    return false;
  }

  // --- Pointer & Input Handling ---
  const motion = new Gtk.EventControllerMotion();
  drawingArea.add_controller(motion);

  function updatePointerState(x, y) {
    const isInside = isPointerOverDock(x, y);
    mouseOver = isInside;

    if (isInside) {
      mouseX = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT) ? y : x;
      mouseY = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT) ? x : y;

      // Check hover item for status
      let hoveredItem = null;
      for (let l of currentComputedLayout) {
        if (
          x >= l.rect.x &&
          x <= l.rect.x + l.rect.w &&
          y >= l.rect.y &&
          y <= l.rect.y + l.rect.h
        ) {
          hoveredItem = l;
          break;
        }
      }

      if (hoveredItem) {
        statusLabel.set_label(`Hovered: <b>${hoveredItem.item.label || hoveredItem.item.id}</b> [Scale: ${hoveredItem.scale.toFixed(2)}]`);
      } else {
        statusLabel.set_label('Dock: Hovered');
      }
    } else {
      statusLabel.set_label('Status: Ready');
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
    mouseOver = false;
    statusLabel.set_label('Status: Ready');
    drawingArea.queue_draw();
  });

  // Click Gesture
  const click = new Gtk.GestureClick();
  drawingArea.add_controller(click);

  click.connect('pressed', (gesture, n_press, x, y) => {
    // 1. Hit-test on active Sub-Dock items FIRST if open (prevents clicking through popup)
    if (activeSubDock && activeSubDock.computedChildLayout) {
      for (let childLayout of activeSubDock.computedChildLayout) {
        const { item, rect } = childLayout;
        if (
          x >= rect.x &&
          x <= rect.x + rect.w &&
          y >= rect.y &&
          y <= rect.y + rect.h
        ) {
          console.log(`[SubDock Click] Activated sub-item: ${item.label} (${item.id})`);
          statusLabel.set_label(`Sub-Item Activated: <b>${item.label}</b>`);
          item.onClick(1, 0);
          drawingArea.queue_draw();
          return;
        }
      }
    }

    // 2. Hit-test on main dock items
    for (let l of currentComputedLayout) {
      if (
        x >= l.rect.x &&
        x <= l.rect.x + l.rect.w &&
        y >= l.rect.y &&
        y <= l.rect.y + l.rect.h
      ) {
        const item = l.item;
        console.log(`[Prototype Click] Activated item: ${item.label} (${item.id})`);
        statusLabel.set_label(`Activated: <b>${item.label}</b>`);

        // Check if item is a Drawer -> spawn sub-dock and FREEZE magnification
        if (item.type === ItemType.DRAWER) {
          if (activeSubDock && activeSubDock.callingItemId === item.id) {
            // Toggle closed
            activeSubDock = null;
          } else {
            const subItems = item.getChildren();
            const subModel = new DockModel({ items: subItems });
            activeSubDock = {
              drawer: item,
              callingItemId: item.id,
              frozenPointerPos: mouseX,
              frozenHoverProgress: hoverProgress,
              items: subItems,
              model: subModel,
            };
          }
        } else {
          activeSubDock = null;
        }

        model.activateItem(item, 1, 0);
        drawingArea.queue_draw();
        return;
      }
    }

    // 3. Clicked empty space: dismiss active sub-dock
    activeSubDock = null;
    drawingArea.queue_draw();
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
    if (keyval === Gdk.KEY_r || keyval === Gdk.KEY_R) {
      currentPosition = (currentPosition + 1) % 4;
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
