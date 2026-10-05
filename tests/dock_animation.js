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
 * Analytical antiderivative G(u) using the smooth step cubic shape.
 * 
 * @param {number} u - original coordinate
 * @param {number} xm - mouse position
 * @param {number} R - radius of influence
 * @param {number} M - max scale factor
 * @returns {number} integrated value
 */
function G(u, xm, R, M) {
    if (u < xm - R) {
        return u;
    }
    if (u > xm + R) {
        return u + (M - 1) * R;
    }
    const z = (u - xm) / R;
    const sign = Math.sign(z);
    // Integral of (1 - 3z^2 + 2|z|^3) is (z - z^3 + sign * 0.5 * z^4)
    const I = z - z * z * z + sign * 0.5 * z * z * z * z;
    return u + (M - 1) * R * (I + 0.5);
}

/**
 * Get scale factor at original coordinate u.
 * 
 * @param {number} u - original coordinate
 * @param {number} xm - mouse position
 * @param {number} R - radius of influence
 * @param {number} M - max scale factor
 * @returns {number} scale factor >= 1.0
 */
function getScale(u, xm, R, M) {
    const dist = Math.abs(u - xm);
    if (dist >= R) {
        return 1.0;
    }
    const y = dist / R;
    // Smoothstep cubic curve: h(y) = 1 - 3y^2 + 2y^3
    const h = 1.0 - 3.0 * y * y + 2.0 * y * y * y;
    return 1.0 + (M - 1) * h;
}

// --- App State ---
let maxScale = 2.0;    // Max scale M, adjustable via Up/Down arrow keys
let radius = 150.0;    // Radius R, adjustable via Left/Right arrow keys
let baseSpread = 1.0;  // Base spread influence, adjustable via W/S keys
let mouseX = 300.0;    // Mouse position X relative to dock start
let mouseY = 0.0;      // Mouse position Y
let mouseOver = false; // Is mouse over the dock drawing area?

const NUM_ICONS = 10;
const ICON_SIZE = 48;
const STATIC_PADDING = 12;
const CONTAINER_WIDTH = ICON_SIZE + STATIC_PADDING; // 60
const L = NUM_ICONS * CONTAINER_WIDTH;             // 600 total width

// Static center positions of icons in dock-local space (0 to L)
const staticPositions = [];
for (let i = 0; i < NUM_ICONS; i++) {
    staticPositions.push(i * CONTAINER_WIDTH + CONTAINER_WIDTH / 2);
}

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
               '• Use <b>W / S Keys</b> to change Base Spread Influence (S)',
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
        const width = drawingArea.get_width();
        const dockStartX = (width - L) / 2;
        
        mouseX = x - dockStartX; // Local coordinate
        mouseY = y;
        mouseOver = true;
        
        drawingArea.queue_draw();
    });
    motionCtrl.connect('leave', () => {
        mouseOver = false;
        drawingArea.queue_draw();
    });
    drawingArea.add_controller(motionCtrl);

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
        } else if (keyName === 'w' || keyName === 'W') {
            baseSpread = Math.min(2.5, baseSpread + 0.05);
            changed = true;
        } else if (keyName === 's' || keyName === 'S') {
            baseSpread = Math.max(0.0, baseSpread - 0.05);
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
        const dockStartX = (width - L) / 2;
        const baselineY = height - 120; // baseline of icon bottom

        // --- 1. Background Fill ---
        cr.setSourceRGBA(0.12, 0.12, 0.14, 1.0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // --- 2. Render Static / Unanimated Reference Dock (Faint Outline) ---
        cr.setLineWidth(1.5);
        cr.setSourceRGBA(0.4, 0.4, 0.4, 0.3);
        // Static Dock Background
        cr.rectangle(dockStartX - 10, baselineY - ICON_SIZE - 10, L + 20, ICON_SIZE + 20);
        cr.stroke();

        // Static Icons
        staticPositions.forEach(xi => {
            const gx = dockStartX + xi;
            cr.rectangle(gx - ICON_SIZE/2, baselineY - ICON_SIZE, ICON_SIZE, ICON_SIZE);
            cr.stroke();
        });

        // --- 3. Compute and Render Active Magnified Dock ---
        // Clamp mouseX to range [0, L] for perfect edge anchoring
        const xmClamped = Math.max(0, Math.min(L, mouseX));

        // Compute the dynamic spread influence based on base spread, radius of influence, and scale
        // Scaling with (maxScale - 1) * (radius / 150) gives a minor progressive boost to spreading
        // when magnification and radius of influence grow larger.
        const dynamicSpread = baseSpread * (1.0 + 0.12 * (maxScale - 1.0) * (radius / 150.0));

        // Calculate positions and scales for all icons
        const activeIcons = staticPositions.map(xi => {
            if (!mouseOver) {
                return { warpedX: dockStartX + xi, scale: 1.0 };
            }

            const scale = getScale(xi, xmClamped, radius, maxScale);

            // 1. Raw expansion displacement: how much the coordinate wants to expand away from the mouse
            const rawExpansion = G(xi, xmClamped, radius, maxScale) - G(xmClamped, xmClamped, radius, maxScale) - (xi - xmClamped);

            // 2. Compute anchoring factor to keep the outer edges (0 and L) perfectly stationary
            let anchoringFactor = 1.0;
            if (xi > xmClamped) {
                // To the right of mouse: dampens to 0 at the right edge L
                anchoringFactor = (L - xi) / (L - xmClamped);
            } else if (xi < xmClamped) {
                // To the left of mouse: dampens to 0 at the left edge 0
                anchoringFactor = xi / xmClamped;
            } else {
                anchoringFactor = 1.0;
            }

            // 3. Apply anchored displacement to resting center, scaled by our dynamic spread factor
            const warpedLocalX = xi + anchoringFactor * rawExpansion * dynamicSpread;

            return {
                warpedX: dockStartX + warpedLocalX,
                scale: scale
            };
        });

        // Compute dynamically stretched background bounds
        let activeLeftX, activeRightX;
        if (mouseOver) {
            const firstIcon = activeIcons[0];
            const lastIcon = activeIcons[activeIcons.length - 1];
            activeLeftX = firstIcon.warpedX - (firstIcon.scale * ICON_SIZE) / 2 - 12;
            activeRightX = lastIcon.warpedX + (lastIcon.scale * ICON_SIZE) / 2 + 12;
        } else {
            activeLeftX = dockStartX - 10;
            activeRightX = dockStartX + L + 10;
        }

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
            const riseHeight = 30; // Max rise offset
            const dy = (icon.scale - 1.0) * riseHeight;
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

        // --- 4. Render Hud Overlay (Mouse Vertex Indicator & Parameters) ---
        if (mouseOver) {
            const globalMouseX = dockStartX + mouseX;
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
        cr.showText(`Base Spread Factor (S): ${baseSpread.toFixed(2)}x`);
        cr.moveTo(25, 215);
        cr.showText(`Dynamic Spread Factor: ${dynamicSpread.toFixed(2)}x`);
        
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.7, 0.7, 0.7, 0.95);
        cr.moveTo(25, 245);
        cr.showText(`Active Dock Width: ${(activeRightX - activeLeftX).toFixed(1)}px (Original: ${L + 20}px)`);
    });

    win.present();
});

app.run([]);
