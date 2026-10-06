#!/usr/bin/env -S gjs -m

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Cairo from 'gi://cairo';

// Initialize GTK
Gtk.init();

// --- Core Math Formulas for Deterministic Warping ---

/**
 * Analytical antiderivative G(u) using a generalized shape exponent p.
 *
 * @param {number} u - original coordinate
 * @param {number} xm - mouse position
 * @param {number} R - radius of influence
 * @param {number} M - max scale factor
 * @param {number} p - shape exponent (p >= 1.0)
 * @returns {number} integrated value
 */
function G(u, xm, R, M, p) {
    if (u < xm - R) {
        return u;
    }
    if (u > xm + R) {
        return u + 2 * (M - 1) * R * (p / (p + 1));
    }
    const z = (u - xm) / R;
    const sign = Math.sign(z);
    // Integral I(z) of (1 - |z|^p) is (z - sign * |z|^(p+1) / (p+1))
    const I = z - sign * Math.pow(Math.abs(z), p + 1) / (p + 1);
    // Continuous offset adjustment
    return u + (M - 1) * R * (I + p / (p + 1));
}

/**
 * Get scale factor at original coordinate u using a generalized shape exponent p.
 *
 * @param {number} u - original coordinate
 * @param {number} xm - mouse position
 * @param {number} R - radius of influence
 * @param {number} M - max scale factor
 * @param {number} p - shape exponent
 * @returns {number} scale factor >= 1.0
 */
function getScale(u, xm, R, M, p) {
    const dist = Math.abs(u - xm);
    if (dist >= R) {
        return 1.0;
    }
    const y = dist / R;
    // Generalized shape: h(y) = 1 - y^p
    const h = 1.0 - Math.pow(y, p);
    return 1.0 + (M - 1) * h;
}

// --- App State ---
let maxScale = 1.5;      // Max scale M, adjustable via Up/Down arrow keys
let radius = 100.0;      // Radius R, adjustable via Left/Right arrow keys
let staticPadding = 12.0;// Padding (the spread between icons), adjustable via W/S keys
let riseInfluence = 1.0; // Rise influence (amplitude and pointiness), adjustable via A/D keys
let mouseX = 300.0;      // Mouse position X relative to dock start
let mouseY = 0.0;        // Mouse position Y
let mouseOver = false;   // Is mouse over the dock drawing area?
let hoverProgress = 0.0; // Dynamic transition factor between 0.0 and 1.0
let lastGlobalX = 300.0; // Track last global pointer X

const NUM_ICONS = 10;
const ICON_SIZE = 48;
const UNANIMATED_PADDING = 2.0; // Closely-packed resting padding when unanimated / not hovering

// --- Application Setup ---

const app = new Gtk.Application({
    application_id: 'org.gnome.test.DockAnimation',
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', (app) => {
    const win = new Gtk.ApplicationWindow({
        application: app,
        title: 'Deterministic Dock Animation - Interactive Demo',
        default_width: 850,
        default_height: 500,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
    });
    win.set_child(box);

    // Header info label
    const infoLabel = new Gtk.Label({
        label: '<b>Deterministic Dock Magnification Demo</b>\n' +
               '• Move your mouse horizontally over the bottom canvas to see the animation.\n' +
               '• Use <b>Up/Down Arrow Keys</b> to change Max Scale (M)\n' +
               '• Use <b>Left/Right Arrow Keys</b> to change Radius of Influence (R)\n' +
               '• Use <b>A / D Keys</b> to change Static Spacing Padding (Spread)\n' +
               '• Use <b>W / S Keys</b> to change Rise Influence &amp; Peak Pointiness',
        use_markup: true,
        margin_top: 15,
        margin_bottom: 5,
    });
    box.append(infoLabel);

    // Drawing Canvas
    const drawingArea = new Gtk.DrawingArea({
        hexpand: true,
        vexpand: true,
    });
    box.append(drawingArea);

    // Event Controllers for Mouse Movement
    const motionCtrl = new Gtk.EventControllerMotion();
    motionCtrl.connect('motion', (controller, x, y) => {
        lastGlobalX = x;
        mouseY = y;
        mouseOver = true;
    });
    motionCtrl.connect('leave', () => {
        mouseOver = false;
    });
    drawingArea.add_controller(motionCtrl);

    // High-performance GTK Tick Callback for smooth entry/exit animations
    drawingArea.add_tick_callback((widget, frameClock) => {
        if (mouseOver || hoverProgress > 0.0) {
            const target = mouseOver ? 1.0 : 0.0;
            const diff = target - hoverProgress;

            if (Math.abs(diff) < 0.005) {
                hoverProgress = target;
            } else {
                hoverProgress += diff * 0.12; // Easing speed
            }

            // Recalculate local mouseX coordinates on the currently active, animated dock width
            const targetPadding = staticPadding * (1.0 + 0.12 * (maxScale - 1.0) * (radius / 150.0));
            const activePadding = UNANIMATED_PADDING + (targetPadding - UNANIMATED_PADDING) * hoverProgress;
            const activeL = NUM_ICONS * (ICON_SIZE + activePadding);
            const width = drawingArea.get_width();
            const dockStartX = (width - activeL) / 2;
            mouseX = lastGlobalX - dockStartX;

            drawingArea.queue_draw();
        }
        return true; // Keep running
    });

    // Event Controller for Keypresses
    const keyCtrl = new Gtk.EventControllerKey();
    keyCtrl.connect('key-pressed', (controller, keyval, keycode, state) => {
        const keyName = Gdk.keyval_name(keyval);
        let changed = false;

        if (keyName === 'Up') {
            maxScale = Math.min(3.5, maxScale + 0.1);
            changed = true;
        } else if (keyName === 'Down') {
            maxScale = Math.max(1.0, maxScale - 0.1);
            changed = true;
        } else if (keyName === 'Right') {
            radius = Math.min(300.0, radius + 10.0);
            changed = true;
        } else if (keyName === 'Left') {
            radius = Math.max(50.0, radius - 10.0);
            changed = true;
        } else if (keyName === 'd' || keyName === 'D') {
            staticPadding = Math.min(45.0, staticPadding + 1.0);
            changed = true;
        } else if (keyName === 'a' || keyName === 'A') {
            staticPadding = Math.max(0.0, staticPadding - 1.0);
            changed = true;
        } else if (keyName === 'w' || keyName === 'W') {
            riseInfluence = Math.min(2.0, riseInfluence + 0.05);
            changed = true;
        } else if (keyName === 's' || keyName === 'S') {
            riseInfluence = Math.max(0.3, riseInfluence - 0.05);
            changed = true;
        }

        if (changed) {
            drawingArea.queue_draw();
            return true; // Event handled
        }
        return false;
    });
    win.add_controller(keyCtrl);

    // Draw Function
    drawingArea.set_draw_func((widget, cr, width, height) => {
        // --- 1. Compute Spacing & Dynamic Dimensions ---
        const restingL = NUM_ICONS * (ICON_SIZE + UNANIMATED_PADDING); // Closely-packed resting width
        
        // Spacing/padding is closely-packed (UNANIMATED_PADDING) when not animating.
        // Upon mouse entering, the padding smoothly expands ("fires up") from UNANIMATED_PADDING to staticPadding + dynamic boost.
        const targetPadding = staticPadding * (1.0 + 0.12 * (maxScale - 1.0) * (radius / 150.0));
        const activePadding = UNANIMATED_PADDING + (targetPadding - UNANIMATED_PADDING) * hoverProgress;
        const activeContainerWidth = ICON_SIZE + activePadding;
        
        const activeL = NUM_ICONS * activeContainerWidth;
        const activeDockStartX = (width - activeL) / 2;
        const baselineY = height - 120; // baseline of icon bottom

        // Compute active static centers (unwarped resting centers x_i) using the influenced active padding
        const staticCenters = [];
        for (let i = 0; i < NUM_ICONS; i++) {
            staticCenters.push(i * activeContainerWidth + activeContainerWidth / 2);
        }

        // --- 2. Background Fill ---
        cr.setSourceRGBA(0.12, 0.12, 0.14, 1.0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // --- 3. Render Static / Unanimated Reference Dock (Faint Outline) ---
        cr.setLineWidth(1.5);
        cr.setSourceRGBA(0.4, 0.4, 0.4, 0.3);
        // Draw Reference Dock Background (matches the active unwarped width activeL)
        cr.rectangle(activeDockStartX - 10, baselineY - ICON_SIZE - 10, activeL + 20, ICON_SIZE + 20);
        cr.stroke();

        // Draw Reference Icons at staticCenters
        staticCenters.forEach(xi => {
            const gx = activeDockStartX + xi;
            cr.rectangle(gx - ICON_SIZE/2, baselineY - ICON_SIZE, ICON_SIZE, ICON_SIZE);
            cr.stroke();
        });

        // --- 4. Compute and Render Active Magnified Dock ---
        // Clamp mouseX to range [0, activeL] for perfect edge anchoring
        const xmClamped = Math.max(0, Math.min(activeL, mouseX));

        // Map the riseInfluence parameter smoothly to a shape exponent p.
        // As riseInfluence increases, the exponent p decreases towards 1.0 (pointed cusp) more aggressively.
        const p = Math.max(1.0, Math.min(3.0, 2.7 - 1.5 * (riseInfluence - 0.3)));

        // Calculate positions and scales for all active icons
        const activeIcons = staticCenters.map(xi => {
            const targetScale = getScale(xi, xmClamped, radius, maxScale, p);
            const scale = 1.0 + (targetScale - 1.0) * hoverProgress;

            // 1. Raw expansion displacement: how much the coordinate wants to expand away from the mouse
            const rawExpansion = G(xi, xmClamped, radius, maxScale, p) - G(xmClamped, xmClamped, radius, maxScale, p) - (xi - xmClamped);

            // 2. Compute anchoring factor to keep the outer edges (0 and activeL) perfectly stationary
            let anchoringFactor = 1.0;
            if (xi > xmClamped) {
                // To the right of mouse: dampens to 0 at the right edge activeL
                anchoringFactor = (activeL - xi) / (activeL - xmClamped);
            } else if (xi < xmClamped) {
                // To the left of mouse: dampens to 0 at the left edge 0
                anchoringFactor = xi / xmClamped;
            } else {
                anchoringFactor = 1.0;
            }

            // 3. Apply anchored displacement to resting center, scaled by our hover progress transition
            const warpedLocalX = xi + anchoringFactor * rawExpansion * hoverProgress;

            return {
                warpedX: activeDockStartX + warpedLocalX,
                scale: scale
            };
        });

        // Compute dynamically stretched background bounds
        let activeLeftX, activeRightX;
        const firstIcon = activeIcons[0];
        const lastIcon = activeIcons[activeIcons.length - 1];
        activeLeftX = firstIcon.warpedX - (firstIcon.scale * ICON_SIZE) / 2 - 12;
        activeRightX = lastIcon.warpedX + (lastIcon.scale * ICON_SIZE) / 2 + 12;

        // Draw Active Dock Background (Slightly rounded rectangle)
        cr.setSourceRGBA(0.22, 0.22, 0.26, 0.85);
        const bgHeight = ICON_SIZE + 20;
        const bgY = baselineY - ICON_SIZE - 10;
        const radiusBg = 16;

        cr.newSubPath();
        cr.arc(activeLeftX + radiusBg, bgY + radiusBg, radiusBg, Math.PI, 1.5 * Math.PI);
        cr.arc(activeRightX - radiusBg, bgY + radiusBg, radiusBg, 1.5 * Math.PI, 2.0 * Math.PI);
        cr.arc(activeRightX - radiusBg, bgY + bgHeight - radiusBg, radiusBg, 0, 0.5 * Math.PI);
        cr.arc(activeLeftX + radiusBg, bgY + bgHeight - radiusBg, radiusBg, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.fill();

        // Draw Active Icons (Solid colored rectangles with rise offset)
        activeIcons.forEach((icon, idx) => {
            const size = ICON_SIZE * icon.scale;
            const baseRiseHeight = 55; // Base max rise offset (increased from 30 for high influence)
            const dy = (icon.scale - 1.0) * baseRiseHeight * riseInfluence;
            const iconY = baselineY - size - dy;

            // Generate an elegant color gradient based on index
            const r = 0.3 + 0.5 * (idx / NUM_ICONS);
            const g = 0.5 - 0.2 * (idx / NUM_ICONS);
            const b = 0.8 - 0.4 * (idx / NUM_ICONS);

            cr.setSourceRGBA(r, g, b, 1.0);

            // Draw rounded-corner icon rectangles
            const iconX = icon.warpedX - size / 2;
            const iconRadius = 8 * icon.scale;

            cr.newSubPath();
            cr.arc(iconX + iconRadius, iconY + iconRadius, iconRadius, Math.PI, 1.5 * Math.PI);
            cr.arc(iconX + size - iconRadius, iconY + iconRadius, iconRadius, 1.5 * Math.PI, 2.0 * Math.PI);
            cr.arc(iconX + size - iconRadius, iconY + size - iconRadius, iconRadius, 0, 0.5 * Math.PI);
            cr.arc(iconX + iconRadius, iconY + size - iconRadius, iconRadius, 0.5 * Math.PI, Math.PI);
            cr.closePath();
            cr.fill();

            // Draw a subtle highlight border on each active icon
            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.15);
            cr.setLineWidth(1.5 * icon.scale);
            cr.stroke();

            // Render a small white dot underneath open/running apps (e.g., indices 1, 4, 7)
            if (idx === 1 || idx === 4 || idx === 7) {
                cr.setSourceRGBA(1.0, 1.0, 1.0, 0.8);
                cr.arc(icon.warpedX, baselineY + 8, 3, 0, 2 * Math.PI);
                cr.fill();
            }
        });

        // --- 5. Render Hud Overlay (Mouse Vertex Indicator & Parameters) ---
        if (mouseOver) {
            const globalMouseX = activeDockStartX + mouseX;
            // Draw a vertical guideline indicating mouse pointer horizontal position
            cr.setSourceRGBA(1.0, 0.3, 0.3, 0.4);
            cr.setLineWidth(1.0);
            cr.moveTo(globalMouseX, 0);
            cr.lineTo(globalMouseX, height);
            cr.stroke();

            // Draw mouse vertex point
            cr.setSourceRGBA(1.0, 0.3, 0.3, 0.9);
            cr.arc(globalMouseX, mouseY, 5, 0, 2 * Math.PI);
            cr.fill();
        }

        // Display current parameters in top-left
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(14);
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);
        cr.moveTo(25, 140);
        cr.showText(`Max Scale Factor (M): ${maxScale.toFixed(2)}x`);
        cr.moveTo(25, 165);
        cr.showText(`Radius of Influence (R): ${radius.toFixed(0)}px`);
        cr.moveTo(25, 190);
        cr.showText(`Base Padding (Spread via A/D): ${staticPadding.toFixed(0)}px`);
        cr.moveTo(25, 215);
        cr.showText(`Active Frame Padding (Boosted): ${activePadding.toFixed(1)}px`);
        cr.moveTo(25, 240);
        cr.showText(`Transition Progress: ${(hoverProgress * 100).toFixed(0)}%`);
        cr.moveTo(25, 265);
        cr.showText(`Rise Influence (W/S): ${riseInfluence.toFixed(2)}x`);
        cr.moveTo(25, 290);

        let shapeLabel = "Rounded Parabola";
        if (p <= 1.05) shapeLabel = "Sharp Cusp / Triangle";
        else if (p < 1.7) shapeLabel = "Pointed Peak";
        cr.showText(`Peak Shape Exponent (p): ${p.toFixed(2)} (${shapeLabel})`);

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.7, 0.7, 0.7, 0.95);
        cr.moveTo(25, 320);
        cr.showText(`Active Dock Width: ${(activeRightX - activeLeftX).toFixed(1)}px (Original Resting: ${restingL + 20}px)`);
    });

    win.present();
});

app.run([]);
