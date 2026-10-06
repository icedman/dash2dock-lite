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
const Positions = { BOTTOM: 0, LEFT: 1, TOP: 2, RIGHT: 3 };
let currentPosition = Positions.BOTTOM;
let currentStage = 1;    // Rendering Stage (1: Static Padded/Scaled, 2: Full Space-Warp Facade)

let maxScale = 2.0;      // Max scale M, adjustable via Up/Down arrow keys
let radius = 150.0;      // Radius R, adjustable via Left/Right arrow keys
let staticPadding = 12.0;// Padding (the spread between icons), adjustable via A/D keys
let riseInfluence = 1.0; // Rise influence (amplitude and pointiness), adjustable via W/S keys
let mouseX = 300.0;      // Mouse position X relative to dock start
let mouseY = 0.0;        // Mouse position Y
let mouseOver = false;   // Is mouse over the dock drawing area?
let hoverProgress = 0.0; // Dynamic transition factor between 0.0 and 1.0
let lastGlobalX = 300.0; // Track last global pointer X
let lastGlobalY = 0.0;   // Track last global pointer Y

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
        label: '<b>Deterministic Dock Magnification Demo - Stage 1 (Static Width-Scaled)</b>\n' +
               '• Move your mouse horizontally or vertically over the canvas to see the animation.\n' +
               '• Use <b>Up/Down Arrow Keys</b> to change Max Scale (M)\n' +
               '• Use <b>Left/Right Arrow Keys</b> to change Radius of Influence (R)\n' +
               '• Use <b>A / D Keys</b> to change Static Spacing Padding (Spread)\n' +
               '• Use <b>W / S Keys</b> to change Rise Influence &amp; Peak Pointiness\n' +
               '• Use <b>R Key</b> to cycle Dock Position (Bottom / Left / Top / Right)',
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
        lastGlobalY = y;
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

            // Recalculate local mouseX/mouseY coordinates on the currently active, animated dock width/height
            const targetPadding = staticPadding * (1.0 + 0.12 * (maxScale - 1.0) * (radius / 150.0));
            const activePadding = UNANIMATED_PADDING + (targetPadding - UNANIMATED_PADDING) * hoverProgress;
            const activeL = NUM_ICONS * (ICON_SIZE + activePadding);
            const width = drawingArea.get_width();
            const height = drawingArea.get_height();

            if (currentPosition === Positions.BOTTOM || currentPosition === Positions.TOP) {
                const dockStartX = (width - activeL) / 2;
                mouseX = lastGlobalX - dockStartX;
                mouseY = lastGlobalY;
            } else {
                const dockStartY = (height - activeL) / 2;
                mouseX = lastGlobalX;
                mouseY = lastGlobalY - dockStartY;
            }

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
            maxScale = Math.min(1.5, maxScale + 0.1);
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
        } else if (keyName === 'r' || keyName === 'R') {
            currentPosition = (currentPosition + 1) % 4;
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
        // --- 1. Compute Orientation, Spacing & Dynamic Dimensions ---
        const isVertical = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT);
        
        const SEPARATOR_INDEX = 5;
        const SEPARATOR_WIDTH = 12;

        // Spacing/padding is closely-packed (UNANIMATED_PADDING) when not animating.
        // Upon mouse entering, the padding smoothly expands ("fires up") from UNANIMATED_PADDING to staticPadding + dynamic boost.
        const targetPadding = staticPadding * (1.0 + 0.12 * (maxScale - 1.0) * (radius / 150.0));
        const activePadding = UNANIMATED_PADDING + (targetPadding - UNANIMATED_PADDING) * hoverProgress;
        const containerWidth = ICON_SIZE + UNANIMATED_PADDING;
        const activeContainerWidth = ICON_SIZE + activePadding;

        // --- Ghost Nodes/Imaginary Icons for Edge Transition Stabilization ---
        const NUM_IMAGINARY = 4;
        const TOTAL_CALC_ICONS = NUM_IMAGINARY + NUM_ICONS + NUM_IMAGINARY; // 18 calculated icons

        // Compute active static centers (unwarped resting centers x_i) using the influenced active padding for all 18 icons
        const staticCenters = [];
        let curStaticPos = 0;
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const realIndex = i - NUM_IMAGINARY;
            const isSep = (realIndex === SEPARATOR_INDEX);
            const w = isSep ? SEPARATOR_WIDTH : ICON_SIZE;
            const halfW = w / 2;
            if (i === 0) {
                curStaticPos = halfW;
            } else {
                const prevIsSep = (realIndex - 1 === SEPARATOR_INDEX);
                const prevW = prevIsSep ? SEPARATOR_WIDTH : ICON_SIZE;
                curStaticPos += prevW / 2 + halfW + activePadding;
            }
            staticCenters.push(curStaticPos);
        }

        // Compute unwarped, compact resting centers for drawing the reference dock (perfectly aligned with restingL)
        const restingCenters = [];
        let curRestPos = 0;
        for (let i = 0; i < NUM_ICONS; i++) {
            const isSep = (i === SEPARATOR_INDEX);
            const w = isSep ? SEPARATOR_WIDTH : ICON_SIZE;
            const halfW = w / 2;
            if (i === 0) {
                curRestPos = halfW;
            } else {
                const prevIsSep = (i - 1 === SEPARATOR_INDEX);
                const prevW = prevIsSep ? SEPARATOR_WIDTH : ICON_SIZE;
                curRestPos += prevW / 2 + halfW + UNANIMATED_PADDING;
            }
            restingCenters.push(curRestPos);
        }

        // Total resting length
        const restingL = restingCenters[NUM_ICONS - 1] + ((NUM_ICONS - 1 === SEPARATOR_INDEX) ? SEPARATOR_WIDTH : ICON_SIZE) / 2;

        // --- 2. Compute Scales & Dynamic Widths for All 18 Icons ---
        const primaryMouse = isVertical ? mouseY : mouseX;
        
        // Offset the mouse coordinate to align with the 18-icon coordinate system
        const firstRealStaticLeft = staticCenters[NUM_IMAGINARY] - ICON_SIZE / 2;
        const xmLocalCalculated = primaryMouse + firstRealStaticLeft;
        const totalCalcStaticL = staticCenters[TOTAL_CALC_ICONS - 1] + ICON_SIZE / 2;
        const xmClamped = Math.max(0, Math.min(totalCalcStaticL, xmLocalCalculated));
        const p = Math.max(1.0, Math.min(3.0, 2.7 - 1.5 * (riseInfluence - 0.3)));

        const iconScales = [];
        const iconWidths = [];
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const realIndex = i - NUM_IMAGINARY;
            const isSep = (realIndex === SEPARATOR_INDEX);
            if (isSep) {
                // Separator has fixed scale 1.0 and fixed width SEPARATOR_WIDTH
                iconScales.push(1.0);
                iconWidths.push(SEPARATOR_WIDTH);
            } else {
                const xi = staticCenters[i];
                const targetScale = getScale(xi, xmClamped, radius, maxScale, p);
                const scale = 1.0 + (targetScale - 1.0) * hoverProgress;
                iconScales.push(scale);
                iconWidths.push(ICON_SIZE * scale);
            }
        }

        // --- 3. Compute Perfectly Packed (Non-Overlapping) Centers for All 18 Icons ---
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

        // Total packed length of the active calculated dock
        const activeL = packedCenters[TOTAL_CALC_ICONS - 1] + iconWidths[TOTAL_CALC_ICONS - 1] / 2;

        // --- 3b. Pre-calculate the total dock width if the mouse was at dead center ---
        const centerMouse = totalCalcStaticL / 2;
        const centerScales = [];
        const centerWidths = [];
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const realIndex = i - NUM_IMAGINARY;
            const isSep = (realIndex === SEPARATOR_INDEX);
            if (isSep) {
                centerScales.push(1.0);
                centerWidths.push(SEPARATOR_WIDTH);
            } else {
                const xi = staticCenters[i];
                const targetScale = getScale(xi, centerMouse, radius, maxScale, p);
                const scale = 1.0 + (targetScale - 1.0) * hoverProgress;
                centerScales.push(scale);
                centerWidths.push(ICON_SIZE * scale);
            }
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

        // --- 3c. Distribute the variance to those within the radius of influence (including imaginary icons) ---
        const variance = centerPackedL - activeL;
        const influences = [];
        let totalInfluence = 0;
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const influence = iconScales[i] - 1.0;
            influences.push(influence);
            totalInfluence += influence;
        }

        const adjustedIconWidths = [];
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            let adjWidth = iconWidths[i];
            if (totalInfluence > 0) {
                adjWidth += variance * (influences[i] / totalInfluence);
            } else {
                adjWidth += variance / TOTAL_CALC_ICONS;
            }
            adjustedIconWidths.push(adjWidth);
        }

        // --- 3d. Re-calculate Packed Centers using Adjusted Widths for All 18 Icons ---
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

        // Compute dock start coordinates on the screen based on position and orientation
        let staticDockStartX, staticDockStartY;
        let activeDockStartX, activeDockStartY;
        let baseline;

        if (!isVertical) {
            staticDockStartX = (width - restingL) / 2;
            activeDockStartX = (width - realActiveL) / 2;
            baseline = (currentPosition === Positions.BOTTOM) ? (height - 120) : 120;
        } else {
            staticDockStartY = (height - restingL) / 2;
            activeDockStartY = (height - realActiveL) / 2;
            baseline = (currentPosition === Positions.LEFT) ? 120 : (width - 120);
        }

        // --- 4. Background Fill ---
        cr.setSourceRGBA(0.12, 0.12, 0.14, 1.0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // --- 3. Render Static / Unanimated Reference Dock (Faint Outline) ---
        let bgRefX, bgRefY, bgRefW, bgRefH;
        if (!isVertical) {
            bgRefX = staticDockStartX - 10;
            bgRefY = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE - 10) : (baseline - 10);
            bgRefW = restingL + 20;
            bgRefH = ICON_SIZE + 20;
        } else {
            bgRefX = (currentPosition === Positions.LEFT) ? (baseline - 10) : (baseline - ICON_SIZE - 10);
            bgRefY = staticDockStartY - 10;
            bgRefW = ICON_SIZE + 20;
            bgRefH = restingL + 20;
        }

        cr.setLineWidth(1.5);
        cr.setSourceRGBA(0.4, 0.4, 0.4, 0.3);
        cr.rectangle(bgRefX, bgRefY, bgRefW, bgRefH);
        cr.stroke();

        // Draw Reference Icons at restingCenters
        restingCenters.forEach(xi => {
            let iconX, iconY;
            if (!isVertical) {
                iconX = staticDockStartX + xi - ICON_SIZE / 2;
                iconY = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE) : baseline;
            } else {
                iconX = (currentPosition === Positions.LEFT) ? baseline : (baseline - ICON_SIZE);
                iconY = staticDockStartY + xi - ICON_SIZE / 2;
            }
            cr.rectangle(iconX, iconY, ICON_SIZE, ICON_SIZE);
            cr.stroke();
        });

        // --- 5. Compute and Render Active Magnified Dock ---
        // Map the riseInfluence parameter smoothly to a shape exponent p.
        // As riseInfluence increases, the exponent p decreases towards 1.0 (pointed cusp) more aggressively.

        // Calculate positions and scales for all 18 active icons, marking imaginary ghost nodes
        const activeIcons = [];
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const pc = adjustedPackedCenters[i];
            const scale = adjustedIconWidths[i] / ICON_SIZE;
            const globalPrimary = (!isVertical ? activeDockStartX : activeDockStartY) + (pc - realLeftEdge);

            const dy = 0;

            let warpedX, warpedY;
            if (currentPosition === Positions.BOTTOM) {
                warpedX = globalPrimary;
                warpedY = baseline - dy; // rises upwards
            } else if (currentPosition === Positions.TOP) {
                warpedX = globalPrimary;
                warpedY = baseline + dy; // rises downwards
            } else if (currentPosition === Positions.LEFT) {
                warpedX = baseline + dy; // rises rightwards
                warpedY = globalPrimary;
            } else if (currentPosition === Positions.RIGHT) {
                warpedX = baseline - dy; // rises leftwards
                warpedY = globalPrimary;
            }

            const isImaginary = (i < NUM_IMAGINARY || i >= NUM_IMAGINARY + NUM_ICONS);
            const isSep = (i - NUM_IMAGINARY === SEPARATOR_INDEX);

            activeIcons.push({
                warpedX: warpedX,
                warpedY: warpedY,
                adjustedScale: scale,
                originalScale: iconScales[i],
                isImaginary: isImaginary,
                isSep: isSep,
                calcIndex: i
            });
        }

        // Compute dynamically stretched background bounds
        let bgActiveX, bgActiveY, bgActiveW, bgActiveH;
        let activeLeftX, activeRightX;
        let activeTopY, activeBottomY;

        const firstIcon = activeIcons[NUM_IMAGINARY];
        const lastIcon = activeIcons[NUM_IMAGINARY + NUM_ICONS - 1];

        if (!isVertical) {
            activeLeftX = firstIcon.warpedX - (firstIcon.adjustedScale * ICON_SIZE) / 2 - 12;
            activeRightX = lastIcon.warpedX + (lastIcon.adjustedScale * ICON_SIZE) / 2 + 12;
            bgActiveX = activeLeftX;
            bgActiveW = activeRightX - activeLeftX;
            bgActiveY = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE - 10) : (baseline - 10);
            bgActiveH = ICON_SIZE + 20;
        } else {
            // Since the heights of icons are scaled vertically along the dock, the vertical bounds match the adjusted scales
            activeTopY = firstIcon.warpedY - (firstIcon.adjustedScale * ICON_SIZE) / 2 - 12;
            activeBottomY = lastIcon.warpedY + (lastIcon.adjustedScale * ICON_SIZE) / 2 + 12;
            bgActiveY = activeTopY;
            bgActiveH = activeBottomY - activeTopY;

            // Since width is NOT scaled on a vertical dock, background width is constant
            const maxIconW = ICON_SIZE;

            if (currentPosition === Positions.LEFT) {
                bgActiveX = baseline - 10;
                bgActiveW = maxIconW + 20;
            } else {
                bgActiveX = baseline - maxIconW - 10;
                bgActiveW = maxIconW + 20;
            }
        }

        // Draw Active Dock Background (Slightly rounded rectangle)
        cr.setSourceRGBA(0.22, 0.22, 0.26, 0.85);
        const radiusBg = 16;

        cr.newSubPath();
        cr.arc(bgActiveX + radiusBg, bgActiveY + radiusBg, radiusBg, Math.PI, 1.5 * Math.PI);
        cr.arc(bgActiveX + bgActiveW - radiusBg, bgActiveY + radiusBg, radiusBg, 1.5 * Math.PI, 2.0 * Math.PI);
        cr.arc(bgActiveX + bgActiveW - radiusBg, bgActiveY + bgActiveH - radiusBg, radiusBg, 0, 0.5 * Math.PI);
        cr.arc(bgActiveX + radiusBg, bgActiveY + bgActiveH - radiusBg, radiusBg, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.fill();

        // Draw Active Icons (Solid colored rectangles with rise offset)
        activeIcons.forEach((icon, idx) => {
            let iconW, iconH;
            if (!isVertical) {
                // Horizontal dock: scale width, height is fixed
                iconW = icon.isSep ? SEPARATOR_WIDTH : (ICON_SIZE * icon.adjustedScale);
                iconH = ICON_SIZE;
            } else {
                // Vertical dock: scale height, width is fixed
                iconW = icon.isSep ? SEPARATOR_WIDTH : ICON_SIZE;
                iconH = ICON_SIZE * icon.adjustedScale;
            }

            let iconX, iconY;
            if (currentPosition === Positions.BOTTOM) {
                iconX = icon.warpedX - iconW / 2;
                iconY = icon.warpedY - iconH;
            } else if (currentPosition === Positions.TOP) {
                iconX = icon.warpedX - iconW / 2;
                iconY = icon.warpedY;
            } else if (currentPosition === Positions.LEFT) {
                iconX = icon.warpedX;
                iconY = icon.warpedY - iconH / 2;
            } else if (currentPosition === Positions.RIGHT) {
                iconX = icon.warpedX - iconW;
                iconY = icon.warpedY - iconH / 2;
            }

            if (icon.isSep) {
                // Draw a sleek, unscaled, unraised vertical/horizontal separator bar
                cr.setSourceRGBA(0.4, 0.4, 0.4, 0.65);
                cr.setLineWidth(3.0);

                if (!isVertical) {
                    // Vertical separator bar for horizontal dock
                    const barTopY = iconY + 6;
                    const barBottomY = iconY + iconH - 6;
                    cr.moveTo(icon.warpedX, barTopY);
                    cr.lineTo(icon.warpedX, barBottomY);
                } else {
                    // Horizontal separator bar for vertical dock
                    const barLeftX = iconX + 6;
                    const barRightX = iconX + iconW - 6;
                    cr.moveTo(barLeftX, icon.warpedY);
                    cr.lineTo(barRightX, icon.warpedY);
                }
                cr.stroke();
            } else {
                // Render wireframe box (dark gray for imaginary, normal gray for real)
                if (icon.isImaginary) {
                    cr.setSourceRGBA(0.35, 0.35, 0.35, 0.35);
                    cr.setLineWidth(1.5);
                } else {
                    cr.setSourceRGBA(0.7, 0.7, 0.7, 1.0);
                    cr.setLineWidth(2.0);
                }

                // Draw rounded-corner icon rectangles (using iconW for width and iconH for height)
                const iconRadius = 8;

                cr.newSubPath();
                cr.arc(iconX + iconRadius, iconY + iconRadius, iconRadius, Math.PI, 1.5 * Math.PI);
                cr.arc(iconX + iconW - iconRadius, iconY + iconRadius, iconRadius, 1.5 * Math.PI, 2.0 * Math.PI);
                cr.arc(iconX + iconW - iconRadius, iconY + iconH - iconRadius, iconRadius, 0, 0.5 * Math.PI);
                cr.arc(iconX + iconRadius, iconY + iconH - iconRadius, iconRadius, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.stroke();

                // Render inner icons only for the real active icons
                if (!icon.isImaginary) {
                    const realIndex = icon.calcIndex - NUM_IMAGINARY;
                    const r = 0.3 + 0.5 * (realIndex / NUM_ICONS);
                    const g = 0.5 - 0.2 * (realIndex / NUM_ICONS);
                    const b = 0.8 - 0.4 * (realIndex / NUM_ICONS);

                    const innerSize = 32 * icon.originalScale;
                    const dy = (icon.originalScale - 1.0) * 55 * riseInfluence;

                    let innerX, innerY;
                    if (currentPosition === Positions.BOTTOM) {
                        innerX = icon.warpedX - innerSize / 2;
                        innerY = (baseline - ICON_SIZE / 2 - dy) - innerSize / 2;
                    } else if (currentPosition === Positions.TOP) {
                        innerX = icon.warpedX - innerSize / 2;
                        innerY = (baseline + ICON_SIZE / 2 + dy) - innerSize / 2;
                    } else if (currentPosition === Positions.LEFT) {
                        innerX = (baseline + ICON_SIZE / 2 + dy) - innerSize / 2;
                        innerY = icon.warpedY - innerSize / 2;
                    } else if (currentPosition === Positions.RIGHT) {
                        innerX = (baseline - ICON_SIZE / 2 - dy) - innerSize / 2;
                        innerY = icon.warpedY - innerSize / 2;
                    }

                    cr.setSourceRGBA(r, g, b, 1.0);

                    // Draw rounded-corner inner rect icons
                    const innerRadius = 6 * icon.originalScale;

                    cr.newSubPath();
                    cr.arc(innerX + innerRadius, innerY + innerRadius, innerRadius, Math.PI, 1.5 * Math.PI);
                    cr.arc(innerX + innerSize - innerRadius, innerY + innerRadius, innerRadius, 1.5 * Math.PI, 2.0 * Math.PI);
                    cr.arc(innerX + innerSize - innerRadius, innerY + innerSize - innerRadius, innerRadius, 0, 0.5 * Math.PI);
                    cr.arc(innerX + innerRadius, innerY + innerSize - innerRadius, innerRadius, 0.5 * Math.PI, Math.PI);
                    cr.closePath();
                    cr.fill();
                }

                // Render a small white dot underneath open/running apps (e.g., indices 1, 4, 8) only for real icons
                if (!icon.isImaginary) {
                    const realIndex = icon.calcIndex - NUM_IMAGINARY;
                    if (realIndex === 1 || realIndex === 4 || realIndex === 8) {
                        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.8);
                        let dotX, dotY;
                        if (currentPosition === Positions.BOTTOM) {
                            dotX = icon.warpedX;
                            dotY = baseline + 8;
                        } else if (currentPosition === Positions.TOP) {
                            dotX = icon.warpedX;
                            dotY = baseline - 8;
                        } else if (currentPosition === Positions.LEFT) {
                            dotX = baseline - 8;
                            dotY = icon.warpedY;
                        } else if (currentPosition === Positions.RIGHT) {
                            dotX = baseline + 8;
                            dotY = icon.warpedY;
                        }
                        cr.arc(dotX, dotY, 3, 0, 2 * Math.PI);
                        cr.fill();
                    }
                }
            }
        });

        // --- 5. Render Hud Overlay (Mouse Vertex Indicator & Parameters) ---
        if (mouseOver) {
            cr.setSourceRGBA(1.0, 0.3, 0.3, 0.4);
            cr.setLineWidth(1.0);

            if (!isVertical) {
                const globalMouseX = lastGlobalX;
                // Draw a vertical guideline indicating mouse pointer horizontal position
                cr.moveTo(globalMouseX, 0);
                cr.lineTo(globalMouseX, height);
                cr.stroke();

                // Draw mouse vertex point
                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.9);
                cr.arc(globalMouseX, lastGlobalY, 5, 0, 2 * Math.PI);
                cr.fill();
            } else {
                const globalMouseY = lastGlobalY;
                // Draw a horizontal guideline indicating mouse pointer vertical position
                cr.moveTo(0, globalMouseY);
                cr.lineTo(width, globalMouseY);
                cr.stroke();

                // Draw mouse vertex point
                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.9);
                cr.arc(lastGlobalX, globalMouseY, 5, 0, 2 * Math.PI);
                cr.fill();
            }
        }

        // Display current parameters - position dynamically to prevent overlap
        const hudX = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (width - 380) : 25;
        const hudY = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (height - 290) : 140;

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(14);
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);
        cr.moveTo(hudX, hudY);
        cr.showText(`Max Scale Factor (M): ${maxScale.toFixed(2)}x`);
        cr.moveTo(hudX, hudY + 25);
        cr.showText(`Radius of Influence (R): ${radius.toFixed(0)}px`);
        cr.moveTo(hudX, hudY + 50);
        cr.showText(`Base Padding (Spread via A/D): ${staticPadding.toFixed(0)}px`);
        cr.moveTo(hudX, hudY + 75);
        cr.showText(`Active Frame Padding (Boosted): ${activePadding.toFixed(1)}px`);
        cr.moveTo(hudX, hudY + 100);
        cr.showText(`Transition Progress: ${(hoverProgress * 100).toFixed(0)}%`);
        cr.moveTo(hudX, hudY + 125);
        cr.showText(`Rise Influence (W/S): ${riseInfluence.toFixed(2)}x`);
        cr.moveTo(hudX, hudY + 150);

        let shapeLabel = "Rounded Parabola";
        if (p <= 1.05) shapeLabel = "Sharp Cusp / Triangle";
        else if (p < 1.7) shapeLabel = "Pointed Peak";
        cr.showText(`Peak Shape Exponent (p): ${p.toFixed(2)} (${shapeLabel})`);

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.7, 0.7, 0.7, 0.95);
        cr.moveTo(hudX, hudY + 180);

        const activeSpan = !isVertical ? (activeRightX - activeLeftX) : (activeBottomY - activeTopY);
        cr.showText(`Active Dock Span: ${activeSpan.toFixed(1)}px (Original Resting: ${restingL + 20}px)`);

        cr.moveTo(hudX, hudY + 205);
        const posNames = ["BOTTOM", "LEFT", "TOP", "RIGHT"];
        cr.showText(`Dock Position (Cycle via R): ${posNames[currentPosition]}`);

        cr.moveTo(hudX, hudY + 230);
        cr.showText(`Render Stage: Stage 1 (Static Width-Scaled Only)`);
    });

    win.present();
});

app.run([]);
