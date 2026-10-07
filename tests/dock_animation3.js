#!/usr/bin/env -S gjs -m

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Cairo from 'gi://cairo';

// Initialize GTK
Gtk.init();

// --- Configuration & Constants ---
const NUM_ICONS = 10;
const BASE_ICON_SIZE = 48;
const BASE_PADDING = 8;          // Natural spacing separation between icons
const SEPARATOR_INDEX = 5;
const SEPARATOR_WIDTH = 12;

const Positions = { BOTTOM: 0, LEFT: 1, TOP: 2, RIGHT: 3 };
let currentPosition = Positions.BOTTOM;

// Magnification Tuning Parameters
let maxScale = 2.0;               // Maximum Scale Multiplier (M)
let radius = 160.0;               // Radius of Influence (R) in pixels
let curveType = 1;                // 0: Linear/Proximity, 1: Cosine Bell (macOS standard), 2: Smoothstep

// Pointer & Animation State
let mouseX = 0.0;
let mouseY = 0.0;
let mouseOver = false;
let hoverProgress = 0.0;          // Smooth easing factor [0.0 -> 1.0]
let lastGlobalX = 400.0;
let lastGlobalY = 0.0;

/**
 * Calculates the individual item scaling factor according to proximity to cursor.
 * Uses a smooth bell curve (Cosine / Smoothstep / Linear) peaking at d = 0.
 *
 * @param {number} dist - Distance from mouse cursor to icon resting/current center
 * @param {number} R - Radius of Influence
 * @param {number} M - Maximum Scale Factor
 * @param {number} type - 0: Linear, 1: Cosine Bell, 2: Smoothstep
 * @returns {number} Scale factor >= 1.0
 */
function calculateScale(dist, R, M, type) {
    if (dist >= R) {
        return 1.0;
    }
    const t = 1.0 - (dist / R); // Normalized proximity in [0, 1]
    let factor = t;

    if (type === 1) {
        // Cosine bell curve: standard macOS bell curve
        // 0.5 * (1 - cos(pi * t)) or cos((dist/R) * (pi/2))
        factor = Math.cos((dist / R) * (Math.PI / 2));
    } else if (type === 2) {
        // Smoothstep: 3*t^2 - 2*t^3
        factor = t * t * (3 - 2 * t);
    }

    return 1.0 + (M - 1.0) * factor;
}

// --- Application Setup ---

const app = new Gtk.Application({
    application_id: 'org.gnome.test.DockAnimation3',
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', (app) => {
    const win = new Gtk.ApplicationWindow({
        application: app,
        title: 'macOS Dock Magnification Architecture (Patent US7434177B1 Reference)',
        default_width: 900,
        default_height: 540,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
    });
    win.set_child(box);

    // Header info label
    const infoLabel = new Gtk.Label({
        label: '<b>macOS Dock Magnification Architecture (Patent US7434177B1 Method)</b>\n' +
               '• <i>Step 1:</i> Distance Calculation \\(d = |X_{mouse} - X_{icon}|\\)\n' +
               '• <i>Step 2:</i> Smooth Bell Curve Scaling \\(S(d) = 1 + (M-1) \\times f(d/R)\\)\n' +
               '• <i>Step 3:</i> Cumulative Layout Offset &amp; Auto-Centering (pushes neighbors outward)\n' +
               '• <b>Up/Down:</b> Max Scale | <b>Left/Right:</b> Radius | <b>C:</b> Cycle Curve (Cosine/Linear/Smooth) | <b>R:</b> Position',
        use_markup: true,
        margin_top: 12,
        margin_bottom: 4,
    });
    box.append(infoLabel);

    // Drawing Canvas
    const drawingArea = new Gtk.DrawingArea({
        hexpand: true,
        vexpand: true,
    });
    box.append(drawingArea);

    // Event Controllers for Mouse Motion
    const motionCtrl = new Gtk.EventControllerMotion();
    motionCtrl.connect('motion', (controller, x, y) => {
        lastGlobalX = x;
        lastGlobalY = y;
        mouseOver = true;
    });
    motionCtrl.connect('leave', () => {
        mouseOver = false;
    });
    drawingArea.add_controller(motionCtrl);

    // High performance frame tick callback
    drawingArea.add_tick_callback((widget, frameClock) => {
        if (mouseOver || hoverProgress > 0.0) {
            const target = mouseOver ? 1.0 : 0.0;
            const diff = target - hoverProgress;

            if (Math.abs(diff) < 0.005) {
                hoverProgress = target;
            } else {
                hoverProgress += diff * 0.15; // Smooth 60fps ease
            }

            drawingArea.queue_draw();
        }
        return true;
    });

    // Event Controller for Keypresses
    const keyCtrl = new Gtk.EventControllerKey();
    keyCtrl.connect('key-pressed', (controller, keyval, keycode, state) => {
        const keyName = Gdk.keyval_name(keyval);
        let changed = false;

        if (keyName === 'Up') {
            maxScale = Math.min(3.0, maxScale + 0.1);
            changed = true;
        } else if (keyName === 'Down') {
            maxScale = Math.max(1.0, maxScale - 0.1);
            changed = true;
        } else if (keyName === 'Right') {
            radius = Math.min(350.0, radius + 10.0);
            changed = true;
        } else if (keyName === 'Left') {
            radius = Math.max(50.0, radius - 10.0);
            changed = true;
        } else if (keyName === 'c' || keyName === 'C') {
            curveType = (curveType + 1) % 3;
            changed = true;
        } else if (keyName === 'r' || keyName === 'R') {
            currentPosition = (currentPosition + 1) % 4;
            changed = true;
        }

        if (changed) {
            drawingArea.queue_draw();
            return true;
        }
        return false;
    });
    win.add_controller(keyCtrl);

    // Draw Function implementing the 3-step Patent Algorithm
    drawingArea.set_draw_func((widget, cr, width, height) => {
        const isVertical = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT);

        // --- STEP 0: Resting Baseline Geometry ---
        const restingWidths = [];
        const restingCenters = [];
        let curRestPos = 0;

        for (let i = 0; i < NUM_ICONS; i++) {
            const isSep = (i === SEPARATOR_INDEX);
            const w = isSep ? SEPARATOR_WIDTH : BASE_ICON_SIZE;
            restingWidths.push(w);

            const halfW = w / 2;
            if (i === 0) {
                curRestPos = halfW;
            } else {
                const prevW = restingWidths[i - 1];
                curRestPos += prevW / 2 + halfW + BASE_PADDING;
            }
            restingCenters.push(curRestPos);
        }
        const restingTotalL = restingCenters[NUM_ICONS - 1] + restingWidths[NUM_ICONS - 1] / 2;

        // Pointer coordinate along the primary dock axis
        const pointerPrimary = isVertical ? lastGlobalY : lastGlobalX;
        const screenCenterPrimary = isVertical ? (height / 2) : (width / 2);

        // Coordinates of resting dock on screen
        const restingDockStart = screenCenterPrimary - (restingTotalL / 2);
        const mouseLocal = pointerPrimary - restingDockStart;

        // --- STEP 1 & 2: Distance & Scale Factor Calculation ---
        // For each icon: Calculate distance to mouse cursor and determine scale factor
        const iconScales = [];
        const scaledWidths = [];

        for (let i = 0; i < NUM_ICONS; i++) {
            const isSep = (i === SEPARATOR_INDEX);
            if (isSep) {
                iconScales.push(1.0);
                scaledWidths.push(SEPARATOR_WIDTH);
            } else {
                const dist = Math.abs(mouseLocal - restingCenters[i]);
                const targetScale = calculateScale(dist, radius, maxScale, curveType);
                const scale = 1.0 + (targetScale - 1.0) * hoverProgress;

                iconScales.push(scale);
                scaledWidths.push(BASE_ICON_SIZE * scale);
            }
        }

        // --- STEP 3: Recalculate Positions (Cumulative Offset Algorithm) ---
        // As each icon expands, all succeeding icons are shifted outward by the cumulative width expansion.
        const scaledCenters = [];
        let cumulativePos = 0;

        for (let i = 0; i < NUM_ICONS; i++) {
            const halfW = scaledWidths[i] / 2;
            if (i === 0) {
                cumulativePos = halfW;
            } else {
                const prevHalfW = scaledWidths[i - 1] / 2;
                cumulativePos += prevHalfW + halfW + BASE_PADDING;
            }
            scaledCenters.push(cumulativePos);
        }
        const activeTotalL = scaledCenters[NUM_ICONS - 1] + scaledWidths[NUM_ICONS - 1] / 2;

        // Alignment coordinates for the active dock:
        // Automatically centered on the screen along the primary axis
        const activeDockStart = screenCenterPrimary - (activeTotalL / 2);

        let baseline;
        if (currentPosition === Positions.BOTTOM) {
            baseline = height - 100;
        } else if (currentPosition === Positions.TOP) {
            baseline = 100;
        } else if (currentPosition === Positions.LEFT) {
            baseline = 100;
        } else {
            baseline = width - 100;
        }

        // --- Background Clear ---
        cr.setSourceRGBA(0.1, 0.12, 0.16, 1.0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // --- Render Y-Offset Resting Comparison Dock (Amber Reference) ---
        const compareOffsetY = 95;
        let refDockStartX, refDockStartY;
        if (!isVertical) {
            refDockStartX = restingDockStart;
            refDockStartY = (currentPosition === Positions.BOTTOM)
                ? (baseline - BASE_ICON_SIZE - compareOffsetY)
                : (baseline + compareOffsetY);
        } else {
            refDockStartX = (currentPosition === Positions.LEFT)
                ? (baseline + compareOffsetY)
                : (baseline - BASE_ICON_SIZE - compareOffsetY);
            refDockStartY = restingDockStart;
        }

        // Comparison Dock Outline
        cr.setLineWidth(1.2);
        cr.setDash([4, 4], 0);
        cr.setSourceRGBA(0.8, 0.6, 0.25, 0.4);
        if (!isVertical) {
            cr.rectangle(refDockStartX - 10, refDockStartY - 8, restingTotalL + 20, BASE_ICON_SIZE + 16);
        } else {
            cr.rectangle(refDockStartX - 8, refDockStartY - 10, BASE_ICON_SIZE + 16, restingTotalL + 20);
        }
        cr.stroke();
        cr.setDash([], 0);

        // Comparison Dock Title
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.85, 0.65, 0.3, 0.85);
        if (!isVertical) {
            cr.moveTo(refDockStartX, (currentPosition === Positions.BOTTOM) ? (refDockStartY - 14) : (refDockStartY + BASE_ICON_SIZE + 28));
            cr.showText("Original Resting Positions (Reference):");
        } else {
            cr.moveTo((currentPosition === Positions.LEFT) ? (refDockStartX + BASE_ICON_SIZE + 16) : (refDockStartX - 170), refDockStartY - 14);
            cr.showText("Resting Reference:");
        }

        // Draw Resting Icons in Comparison Dock
        for (let i = 0; i < NUM_ICONS; i++) {
            const isSep = (i === SEPARATOR_INDEX);
            const w = restingWidths[i];
            const xi = restingCenters[i];

            let rx, ry;
            if (!isVertical) {
                rx = refDockStartX + xi - w / 2;
                ry = refDockStartY;
            } else {
                rx = refDockStartX;
                ry = refDockStartY + xi - w / 2;
            }

            if (isSep) {
                cr.setLineWidth(2.0);
                cr.setSourceRGBA(0.5, 0.5, 0.6, 0.5);
                if (!isVertical) {
                    cr.moveTo(rx + w / 2, ry + 6);
                    cr.lineTo(rx + w / 2, ry + BASE_ICON_SIZE - 6);
                } else {
                    cr.moveTo(rx + 6, ry + w / 2);
                    cr.lineTo(rx + BASE_ICON_SIZE - 6, ry + w / 2);
                }
                cr.stroke();
            } else {
                cr.setLineWidth(1.5);
                cr.setSourceRGBA(0.85, 0.65, 0.3, 0.85);
                cr.rectangle(rx, ry, w, BASE_ICON_SIZE);
                cr.stroke();

                // Faint center connector lines pointing to active magnified positions
                if (hoverProgress > 0.05) {
                    const activeCenterCoord = activeDockStart + scaledCenters[i];
                    cr.setLineWidth(1.0);
                    cr.setDash([2, 3], 0);
                    cr.setSourceRGBA(0.5, 0.6, 0.8, 0.3 * hoverProgress);

                    if (!isVertical) {
                        const origCenterCoord = refDockStartX + xi;
                        const startY = (currentPosition === Positions.BOTTOM) ? (ry + BASE_ICON_SIZE + 8) : ry - 8;
                        const endY = (currentPosition === Positions.BOTTOM) ? (baseline - BASE_ICON_SIZE - 15) : baseline + 15;
                        cr.moveTo(origCenterCoord, startY);
                        cr.lineTo(activeCenterCoord, endY);
                    } else {
                        const origCenterCoord = refDockStartY + xi;
                        const startX = (currentPosition === Positions.LEFT) ? (rx - 8) : (rx + BASE_ICON_SIZE + 8);
                        const endX = (currentPosition === Positions.LEFT) ? baseline + 15 : baseline - BASE_ICON_SIZE - 15;
                        cr.moveTo(startX, origCenterCoord);
                        cr.lineTo(endX, activeCenterCoord);
                    }
                    cr.stroke();
                    cr.setDash([], 0);
                }
            }
        }

        // --- Render macOS-style Glass Dock Container Background ---
        const bgPadding = 12;
        let bgX, bgY, bgW, bgH;

        // Container bounds automatically wrap the expanded layout
        if (!isVertical) {
            bgX = activeDockStart - bgPadding;
            bgW = activeTotalL + (bgPadding * 2);
            bgY = (currentPosition === Positions.BOTTOM) ? (baseline - BASE_ICON_SIZE - bgPadding) : (baseline - bgPadding);
            bgH = BASE_ICON_SIZE + (bgPadding * 2);
        } else {
            bgX = (currentPosition === Positions.LEFT) ? (baseline - bgPadding) : (baseline - BASE_ICON_SIZE - bgPadding);
            bgW = BASE_ICON_SIZE + (bgPadding * 2);
            bgY = activeDockStart - bgPadding;
            bgH = activeTotalL + (bgPadding * 2);
        }

        const bgRadius = 18;
        cr.setSourceRGBA(0.18, 0.22, 0.28, 0.75);
        cr.newSubPath();
        cr.arc(bgX + bgRadius, bgY + bgRadius, bgRadius, Math.PI, 1.5 * Math.PI);
        cr.arc(bgX + bgW - bgRadius, bgY + bgRadius, bgRadius, 1.5 * Math.PI, 2.0 * Math.PI);
        cr.arc(bgX + bgW - bgRadius, bgY + bgH - bgRadius, bgRadius, 0, 0.5 * Math.PI);
        cr.arc(bgX + bgRadius, bgY + bgH - bgRadius, bgRadius, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.fill();

        // Subtle container highlight border
        cr.setLineWidth(1.0);
        cr.setSourceRGBA(0.5, 0.6, 0.75, 0.35);
        cr.stroke();

        // --- Render Magnified Icons along Baseline ---
        for (let i = 0; i < NUM_ICONS; i++) {
            const isSep = (i === SEPARATOR_INDEX);
            const scale = iconScales[i];
            const size = scaledWidths[i];
            const primaryCenter = activeDockStart + scaledCenters[i];

            let iconX, iconY, iconW, iconH;
            if (!isVertical) {
                // Horizontal Dock (swells upward along baseline when on bottom)
                iconW = isSep ? SEPARATOR_WIDTH : size;
                iconH = isSep ? BASE_ICON_SIZE : size;
                iconX = primaryCenter - iconW / 2;
                iconY = (currentPosition === Positions.BOTTOM) ? (baseline - iconH) : baseline;
            } else {
                // Vertical Dock (swells outward along baseline)
                iconW = isSep ? BASE_ICON_SIZE : size;
                iconH = isSep ? SEPARATOR_WIDTH : size;
                iconX = (currentPosition === Positions.LEFT) ? baseline : (baseline - iconW);
                iconY = primaryCenter - iconH / 2;
            }

            if (isSep) {
                // Separator bar
                cr.setLineWidth(2.5);
                cr.setSourceRGBA(0.55, 0.6, 0.7, 0.65);
                if (!isVertical) {
                    cr.moveTo(primaryCenter, iconY + 8);
                    cr.lineTo(primaryCenter, iconY + iconH - 8);
                } else {
                    cr.moveTo(iconX + 8, primaryCenter);
                    cr.lineTo(iconX + iconW - 8, primaryCenter);
                }
                cr.stroke();
            } else {
                // Icon tile rendering (Apple macOS style app icon placeholder)
                const cornerRadius = 10 * scale;

                // Wireframe container
                cr.setLineWidth(1.8);
                const scaleNorm = (scale - 1.0) / Math.max(0.01, maxScale - 1.0);
                cr.setSourceRGBA(0.35 + 0.45 * scaleNorm, 0.65 + 0.25 * scaleNorm, 0.95, 0.95);

                cr.newSubPath();
                cr.arc(iconX + cornerRadius, iconY + cornerRadius, cornerRadius, Math.PI, 1.5 * Math.PI);
                cr.arc(iconX + iconW - cornerRadius, iconY + cornerRadius, cornerRadius, 1.5 * Math.PI, 2.0 * Math.PI);
                cr.arc(iconX + iconW - cornerRadius, iconY + iconH - cornerRadius, cornerRadius, 0, 0.5 * Math.PI);
                cr.arc(iconX + cornerRadius, iconY + iconH - cornerRadius, cornerRadius, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.stroke();

                // Faint inner fill
                cr.setSourceRGBA(0.2, 0.5, 0.8, 0.12 + 0.18 * scaleNorm);
                cr.fill();

                // Inner glyph placeholder
                const glyphSize = 24 * scale;
                const gx = iconX + (iconW - glyphSize) / 2;
                const gy = iconY + (iconH - glyphSize) / 2;
                const glyphR = 6 * scale;

                cr.setLineWidth(1.4);
                cr.setSourceRGBA(0.75, 0.85, 0.95, 0.85);
                cr.newSubPath();
                cr.arc(gx + glyphR, gy + glyphR, glyphR, Math.PI, 1.5 * Math.PI);
                cr.arc(gx + glyphSize - glyphR, gy + glyphR, glyphR, 1.5 * Math.PI, 2.0 * Math.PI);
                cr.arc(gx + glyphSize - glyphR, gy + glyphSize - glyphR, glyphR, 0, 0.5 * Math.PI);
                cr.arc(gx + glyphR, gy + glyphSize - glyphR, glyphR, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.stroke();

                // Running indicator dot
                if (i === 1 || i === 4 || i === 8) {
                    cr.setSourceRGBA(1.0, 1.0, 1.0, 0.85);
                    let dotX, dotY;
                    if (currentPosition === Positions.BOTTOM) {
                        dotX = primaryCenter;
                        dotY = baseline + 6;
                    } else if (currentPosition === Positions.TOP) {
                        dotX = primaryCenter;
                        dotY = baseline - 6;
                    } else if (currentPosition === Positions.LEFT) {
                        dotX = baseline - 6;
                        dotY = primaryCenter;
                    } else {
                        dotX = baseline + 6;
                        dotY = primaryCenter;
                    }
                    cr.arc(dotX, dotY, 3, 0, 2 * Math.PI);
                    cr.fill();
                }
            }
        }

        // --- Overlay: Mouse Guideline and Bell Curve Visualization ---
        if (mouseOver) {
            cr.setLineWidth(1.0);
            cr.setSourceRGBA(1.0, 0.35, 0.35, 0.5);

            if (!isVertical) {
                cr.moveTo(lastGlobalX, 0);
                cr.lineTo(lastGlobalX, height);
                cr.stroke();

                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.95);
                cr.arc(lastGlobalX, lastGlobalY, 5, 0, 2 * Math.PI);
                cr.fill();
            } else {
                cr.moveTo(0, lastGlobalY);
                cr.lineTo(width, lastGlobalY);
                cr.stroke();

                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.95);
                cr.arc(lastGlobalX, lastGlobalY, 5, 0, 2 * Math.PI);
                cr.fill();
            }

            // Draw visual curve graph above dock
            cr.setLineWidth(2.0);
            cr.setSourceRGBA(0.3, 0.9, 0.65, 0.85);
            const steps = 60;
            const curveSpan = radius * 2;
            const curveCenter = pointerPrimary;
            const curveBaseY = (currentPosition === Positions.BOTTOM) ? (baseline - BASE_ICON_SIZE * maxScale - 20) : 60;

            if (!isVertical) {
                cr.newSubPath();
                for (let s = 0; s <= steps; s++) {
                    const gx = (curveCenter - radius) + (s / steps) * curveSpan;
                    const d = Math.abs(gx - curveCenter);
                    const sFactor = calculateScale(d, radius, maxScale, curveType);
                    const py = curveBaseY - (sFactor - 1.0) * 35;
                    if (s === 0) cr.moveTo(gx, py);
                    else cr.lineTo(gx, py);
                }
                cr.stroke();
            }
        }

        // --- HUD / Algorithm Stats ---
        const hudX = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (width - 380) : 25;
        const hudY = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (height - 240) : 130;

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(13);
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);
        cr.moveTo(hudX, hudY);
        cr.showText(`Max Scale (M): ${maxScale.toFixed(2)}x`);
        cr.moveTo(hudX, hudY + 22);
        cr.showText(`Radius of Influence (R): ${radius.toFixed(0)}px`);
        cr.moveTo(hudX, hudY + 44);
        const curveNames = ["Linear Proximity", "Cosine Bell (Apple Standard)", "Smoothstep Polynomial"];
        cr.showText(`Curve Function (C): ${curveNames[curveType]}`);
        cr.moveTo(hudX, hudY + 66);
        cr.showText(`Hover Animation Progress: ${(hoverProgress * 100).toFixed(0)}%`);

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.7, 0.8, 0.9, 0.95);
        cr.moveTo(hudX, hudY + 92);
        cr.showText(`Step 1: Distance d = |X_mouse - X_icon|`);
        cr.moveTo(hudX, hudY + 112);
        cr.showText(`Step 2: Proximity Scale S = 1 + (M - 1) * f(d / R)`);
        cr.moveTo(hudX, hudY + 132);
        cr.showText(`Step 3: Cumulative Offset Loop (shifts neighbors outward)`);
        cr.moveTo(hudX, hudY + 152);
        cr.showText(`Total Dock Span: ${activeTotalL.toFixed(1)}px (Resting: ${restingTotalL.toFixed(1)}px)`);
        cr.moveTo(hudX, hudY + 172);
        const posNames = ["BOTTOM", "LEFT", "TOP", "RIGHT"];
        cr.showText(`Dock Position (Cycle via R): ${posNames[currentPosition]}`);
    });

    win.present();
});

app.run([]);
