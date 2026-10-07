#!/usr/bin/env -S gjs -m

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Cairo from 'gi://cairo';

// Initialize GTK
Gtk.init();

// --- Core Math Formulas ---

/**
 * Parabolic scale function peaking at pointer coordinate xm.
 * f(u) = 1 + (M - 1) * (1 - (dist / R)^2) for dist < R, else 1.0
 *
 * @param {number} u - coordinate of icon center
 * @param {number} xm - pointer position
 * @param {number} R - radius of influence
 * @param {number} M - max scale factor
 * @returns {number} scale factor >= 1.0
 */
function getParabolicScale(u, xm, R, M) {
    const dist = Math.abs(u - xm);
    if (dist >= R) {
        return 1.0;
    }
    const y = dist / R;
    // Standard parabola: 1 - y^2 (smooth peak with 0 derivative at y=0)
    const h = 1.0 - (y * y);
    return 1.0 + (M - 1.0) * h;
}

// --- App State ---
const Positions = { BOTTOM: 0, LEFT: 1, TOP: 2, RIGHT: 3 };
let currentPosition = Positions.BOTTOM;

let maxScale = 2.0;       // Max scale M, adjustable via Up/Down arrow keys
let radius = 160.0;       // Radius R, adjustable via Left/Right arrow keys
let staticPadding = 12.0; // Base spacing padding between icons, adjustable via A/D keys
let mouseX = 300.0;       // Mouse position relative to dock start
let mouseY = 0.0;
let mouseOver = false;    // Mouse over dock area flag
let hoverProgress = 0.0;  // Smooth transition factor [0.0, 1.0]
let lastGlobalX = 300.0;  // Global pointer X
let lastGlobalY = 0.0;    // Global pointer Y

const NUM_ICONS = 10;
const ICON_SIZE = 48;
const UNANIMATED_PADDING = 4.0; // Resting padding when unanimated / not hovering
const SEPARATOR_INDEX = 5;
const SEPARATOR_WIDTH = 10;

// --- Application Setup ---

const app = new Gtk.Application({
    application_id: 'org.gnome.test.DockAnimation2',
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

app.connect('activate', (app) => {
    const win = new Gtk.ApplicationWindow({
        application: app,
        title: 'Dock Animation Experiment 2 - Wireframe Parabolic Width Scaling',
        default_width: 880,
        default_height: 520,
    });

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
    });
    win.set_child(box);

    // Header info label
    const infoLabel = new Gtk.Label({
        label: '<b>Dock Animation Experiment 2 - Wireframe Container Scaling</b>\n' +
               '• <i>Step 1:</i> On mouse enter, scale up <b>width only</b> of wireframe containers via parabolic function peaking at pointer.\n' +
               '• <b>Up / Down Arrow</b>: Max Scale (M) | <b>Left / Right Arrow</b>: Radius (R)\n' +
               '• <b>A / D</b>: Base Spacing Padding | <b>R</b>: Cycle Position (Bottom / Left / Top / Right)\n' +
               '• <i>Two layers planned:</i> Wireframe containers &amp; Gradient facade (gradient facade disabled for now).',
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

    // Tick Callback for smooth hover transition and continuous redraw
    drawingArea.add_tick_callback((widget, frameClock) => {
        if (mouseOver || hoverProgress > 0.0) {
            const target = mouseOver ? 1.0 : 0.0;
            const diff = target - hoverProgress;

            if (Math.abs(diff) < 0.005) {
                hoverProgress = target;
            } else {
                hoverProgress += diff * 0.12; // Smooth easing
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
            radius = Math.max(40.0, radius - 10.0);
            changed = true;
        } else if (keyName === 'd' || keyName === 'D') {
            staticPadding = Math.min(40.0, staticPadding + 1.0);
            changed = true;
        } else if (keyName === 'a' || keyName === 'A') {
            staticPadding = Math.max(0.0, staticPadding - 1.0);
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

    // Draw Function
    drawingArea.set_draw_func((widget, cr, width, height) => {
        const isVertical = (currentPosition === Positions.LEFT || currentPosition === Positions.RIGHT);

        // 1. Compute resting layout (unanimated dock)
        // --- Ghost / Imaginary Icons Setup (4 on left, 4 on right) ---
        const NUM_IMAGINARY = 4;
        const TOTAL_CALC_ICONS = NUM_IMAGINARY + NUM_ICONS + NUM_IMAGINARY; // 18 total calculated icons

        // 1. Compute resting layout for all 14 calculated icons
        const restingCenters = [];
        let curRestPos = 0;
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const realIdx = i - NUM_IMAGINARY;
            const isSep = (realIdx === SEPARATOR_INDEX);
            const w = isSep ? SEPARATOR_WIDTH : ICON_SIZE;
            const halfW = w / 2;
            if (i === 0) {
                curRestPos = halfW;
            } else {
                const prevRealIdx = (i - 1) - NUM_IMAGINARY;
                const prevIsSep = (prevRealIdx === SEPARATOR_INDEX);
                const prevW = prevIsSep ? SEPARATOR_WIDTH : ICON_SIZE;
                curRestPos += prevW / 2 + halfW + UNANIMATED_PADDING;
            }
            restingCenters.push(curRestPos);
        }

        // Resting length of the REAL icons only
        const realRestingStart = restingCenters[NUM_IMAGINARY] - ICON_SIZE / 2;
        const realRestingEnd = restingCenters[NUM_IMAGINARY + NUM_ICONS - 1] +
            ((NUM_ICONS - 1 === SEPARATOR_INDEX) ? SEPARATOR_WIDTH : ICON_SIZE) / 2;
        const restingL = realRestingEnd - realRestingStart;

        // Dynamic spacing / padding on hover
        const targetPadding = staticPadding * (1.0 + 0.1 * (maxScale - 1.0));
        const activePadding = UNANIMATED_PADDING + (targetPadding - UNANIMATED_PADDING) * hoverProgress;

        // 2. Pointer calculation aligned to the calculated 14-icon coordinate system
        const pointerGlobalPrimary = isVertical ? lastGlobalY : lastGlobalX;
        const screenCenterPrimary = isVertical ? (height / 2) : (width / 2);
        // Map pointer to coordinates where real icons are centered at screenCenterPrimary
        const dockStartPrimary = screenCenterPrimary - (restingL / 2) - realRestingStart;
        const mouseLocalResting = pointerGlobalPrimary - dockStartPrimary;

        // 3. Compute Parabolic Scales and Scaled Widths for all 14 calculated icons
        const iconScales = [];
        const iconWidths = [];

        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const realIdx = i - NUM_IMAGINARY;
            const isSep = (realIdx === SEPARATOR_INDEX);
            if (isSep) {
                iconScales.push(1.0);
                iconWidths.push(SEPARATOR_WIDTH);
            } else {
                const xi = restingCenters[i];
                // Parabolic function peaking at mouseLocalResting
                const targetScale = getParabolicScale(xi, mouseLocalResting, radius, maxScale);
                // Smooth transition using hoverProgress
                const scale = 1.0 + (targetScale - 1.0) * hoverProgress;
                iconScales.push(scale);
                // Width only scaling
                iconWidths.push(ICON_SIZE * scale);
            }
        }

        // 4. Bidirectional Outward Collision Resolution from the Parabola Peak (across all 14 icons):
        // Starts from resting centers. Finds the two icons straddling the peak.
        // Resolves their overlap proportional to their respective scales.
        // Then cascades outward: loops left to 0, and right to TOTAL_CALC_ICONS - 1.
        const activeCenters = [...restingCenters];

        if (hoverProgress > 0) {
            let leftIdx = 0;
            for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
                if (restingCenters[i] <= mouseLocalResting) {
                    leftIdx = i;
                } else {
                    break;
                }
            }
            // Clamp leftIdx to ensure a valid pair [leftIdx, rightIdx]
            leftIdx = Math.max(0, Math.min(TOTAL_CALC_ICONS - 2, leftIdx));
            const rightIdx = leftIdx + 1;

            const minPadding = UNANIMATED_PADDING;

            // Step 4a: Resolve overlap of the first two icons (left and right of peak)
            const wL = iconWidths[leftIdx];
            const wR = iconWidths[rightIdx];
            const reqDistancePeak = (wL / 2) + (wR / 2) + minPadding;
            const curDistancePeak = activeCenters[rightIdx] - activeCenters[leftIdx];
            const overlapPeak = reqDistancePeak - curDistancePeak;

            if (overlapPeak > 0) {
                const scaleL = iconScales[leftIdx];
                const scaleR = iconScales[rightIdx];
                const invMassL = 1.0 / Math.max(0.1, scaleL);
                const invMassR = 1.0 / Math.max(0.1, scaleR);
                const sumInv = invMassL + invMassR;

                const moveL = overlapPeak * (invMassL / sumInv) * hoverProgress;
                const moveR = overlapPeak * (invMassR / sumInv) * hoverProgress;

                activeCenters[leftIdx] -= moveL;
                activeCenters[rightIdx] += moveR;
            }

            // Step 4b: Loop left from leftIdx - 1 down to 0, displacing each succeeding icon leftward
            for (let i = leftIdx - 1; i >= 0; i--) {
                const wCurr = iconWidths[i];
                const wNext = iconWidths[i + 1];
                const reqDist = (wCurr / 2) + (wNext / 2) + minPadding;
                const curDist = activeCenters[i + 1] - activeCenters[i];
                const overlap = reqDist - curDist;
                if (overlap > 0) {
                    activeCenters[i] -= overlap * hoverProgress;
                }
            }

            // Step 4c: Loop right from rightIdx + 1 up to TOTAL_CALC_ICONS - 1, displacing succeeding icons rightward
            for (let i = rightIdx + 1; i < TOTAL_CALC_ICONS; i++) {
                const wPrev = iconWidths[i - 1];
                const wCurr = iconWidths[i];
                const reqDist = (wPrev / 2) + (wCurr / 2) + minPadding;
                const curDist = activeCenters[i] - activeCenters[i - 1];
                const overlap = reqDist - curDist;
                if (overlap > 0) {
                    activeCenters[i] += overlap * hoverProgress;
                }
            }
        }

        // Extract real icon boundaries after resolution
        const realActiveStart = activeCenters[NUM_IMAGINARY] - iconWidths[NUM_IMAGINARY] / 2;
        const realActiveEnd = activeCenters[NUM_IMAGINARY + NUM_ICONS - 1] + iconWidths[NUM_IMAGINARY + NUM_ICONS - 1] / 2;
        const realActiveL = realActiveEnd - realActiveStart;

        let staticDockStartX, staticDockStartY;
        let activeDockStartX, activeDockStartY;
        let baseline;

        if (!isVertical) {
            staticDockStartX = (width - restingL) / 2;
            // Real icons stay centered on screen
            activeDockStartX = (width - realActiveL) / 2 - realActiveStart;
            baseline = (currentPosition === Positions.BOTTOM) ? (height - 120) : 120;
        } else {
            staticDockStartY = (height - restingL) / 2;
            activeDockStartY = (height - realActiveL) / 2 - realActiveStart;
            baseline = (currentPosition === Positions.LEFT) ? 120 : (width - 120);
        }

        // --- Render Background ---
        cr.setSourceRGBA(0.12, 0.12, 0.15, 1.0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        // --- Render Original Wireframe Positions Offset Along Y for Comparison ---
        // Offset perpendicular to dock: for BOTTOM dock, shift Y upwards (or downwards for TOP)
        const compareOffsetY = 85;

        // Container boundary of original resting dock (Offset Y)
        let compBgX, compBgY, compBgW, compBgH;
        if (!isVertical) {
            compBgX = staticDockStartX - 10;
            compBgY = (currentPosition === Positions.BOTTOM)
                ? (baseline - ICON_SIZE - 10 - compareOffsetY)
                : (baseline - 10 + compareOffsetY);
            compBgW = restingL + 20;
            compBgH = ICON_SIZE + 20;
        } else {
            compBgX = (currentPosition === Positions.LEFT)
                ? (baseline - 10 + compareOffsetY)
                : (baseline - ICON_SIZE - 10 - compareOffsetY);
            compBgY = staticDockStartY - 10;
            compBgW = ICON_SIZE + 20;
            compBgH = restingL + 20;
        }

        // Draw Comparison Dock Background Outline
        cr.setLineWidth(1.2);
        cr.setDash([5, 4], 0);
        cr.setSourceRGBA(0.45, 0.45, 0.55, 0.5);
        cr.rectangle(compBgX, compBgY, compBgW, compBgH);
        cr.stroke();
        cr.setDash([], 0); // reset dash

        // Draw Comparison Label
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.65, 0.7, 0.8, 0.75);
        if (!isVertical) {
            const labelY = (currentPosition === Positions.BOTTOM)
                ? (compBgY - 6)
                : (compBgY + compBgH + 14);
            cr.moveTo(compBgX, labelY);
            cr.showText("Original Resting Wireframes (Offset-Y for comparison):");
        } else {
            const labelX = (currentPosition === Positions.LEFT)
                ? (compBgX + compBgW + 8)
                : (compBgX - 180);
            cr.moveTo(labelX, compBgY + 14);
            cr.showText("Original Resting Wireframes:");
        }

        // Draw each original wireframe box and inner icon at restingCenters (offset along Y)
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const isImaginary = (i < NUM_IMAGINARY || i >= NUM_IMAGINARY + NUM_ICONS);
            const realIdx = i - NUM_IMAGINARY;
            const isSep = (!isImaginary && realIdx === SEPARATOR_INDEX);
            const w = isSep ? SEPARATOR_WIDTH : ICON_SIZE;
            const xi = restingCenters[i];

            let origBoxX, origBoxY, origBoxW, origBoxH;
            if (!isVertical) {
                origBoxW = w;
                origBoxH = ICON_SIZE;
                origBoxX = staticDockStartX + (xi - realRestingStart) - origBoxW / 2;
                origBoxY = (currentPosition === Positions.BOTTOM)
                    ? (baseline - origBoxH - compareOffsetY)
                    : (baseline + compareOffsetY);
            } else {
                origBoxW = ICON_SIZE;
                origBoxH = w;
                origBoxX = (currentPosition === Positions.LEFT)
                    ? (baseline + compareOffsetY)
                    : (baseline - origBoxW - compareOffsetY);
                origBoxY = staticDockStartY + (xi - realRestingStart) - origBoxH / 2;
            }

            if (isSep) {
                cr.setLineWidth(2.0);
                cr.setSourceRGBA(0.5, 0.5, 0.6, 0.5);
                if (!isVertical) {
                    cr.moveTo(origBoxX + origBoxW / 2, origBoxY + 6);
                    cr.lineTo(origBoxX + origBoxW / 2, origBoxY + origBoxH - 6);
                } else {
                    cr.moveTo(origBoxX + 6, origBoxY + origBoxH / 2);
                    cr.lineTo(origBoxX + origBoxW - 6, origBoxY + origBoxH / 2);
                }
                cr.stroke();
            } else {
                // Original wireframe container (dashed / tinted amber for real, faint for imaginary)
                cr.setLineWidth(1.5);
                if (isImaginary) {
                    cr.setDash([3, 3], 0);
                    cr.setSourceRGBA(0.6, 0.5, 0.4, 0.35); // Faint dashed ghost node
                } else {
                    cr.setDash([], 0);
                    cr.setSourceRGBA(0.85, 0.65, 0.25, 0.85); // Amber wireframe for real
                }
                const cornerR = 8;
                cr.newSubPath();
                cr.arc(origBoxX + cornerR, origBoxY + cornerR, cornerR, Math.PI, 1.5 * Math.PI);
                cr.arc(origBoxX + origBoxW - cornerR, origBoxY + cornerR, cornerR, 1.5 * Math.PI, 2.0 * Math.PI);
                cr.arc(origBoxX + origBoxW - cornerR, origBoxY + origBoxH - cornerR, cornerR, 0, 0.5 * Math.PI);
                cr.arc(origBoxX + cornerR, origBoxY + origBoxH - cornerR, cornerR, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.stroke();
                cr.setDash([], 0);

                // Original inner placeholder icon (only for real icons)
                if (!isImaginary) {
                    const origInnerSize = 28;
                    const origInnerX = origBoxX + (origBoxW - origInnerSize) / 2;
                    const origInnerY = origBoxY + (origBoxH - origInnerSize) / 2;
                    cr.setLineWidth(1.2);
                    cr.setSourceRGBA(0.85, 0.65, 0.25, 0.45);
                    const innerR = 5;
                    cr.newSubPath();
                    cr.arc(origInnerX + innerR, origInnerY + innerR, innerR, Math.PI, 1.5 * Math.PI);
                    cr.arc(origInnerX + origInnerSize - innerR, origInnerY + innerR, innerR, 1.5 * Math.PI, 2.0 * Math.PI);
                    cr.arc(origInnerX + origInnerSize - innerR, origInnerY + origInnerSize - innerR, innerR, 0, 0.5 * Math.PI);
                    cr.arc(origInnerX + innerR, origInnerY + origInnerSize - innerR, innerR, 0.5 * Math.PI, Math.PI);
                    cr.closePath();
                    cr.stroke();
                }

                // Faint connector line between original frame center and active frame center when hovering
                if (hoverProgress > 0.05) {
                    const activePc = activeCenters[i];
                    const activeCenterX = (!isVertical ? activeDockStartX : activeDockStartY) + activePc;
                    cr.setLineWidth(1.0);
                    cr.setDash([2, 3], 0);
                    cr.setSourceRGBA(0.5, 0.5, 0.6, (isImaginary ? 0.12 : 0.25) * hoverProgress);

                    if (!isVertical) {
                        const origCenterX = origBoxX + origBoxW / 2;
                        const origYConn = (currentPosition === Positions.BOTTOM) ? (origBoxY + origBoxH) : origBoxY;
                        const activeYConn = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE) : baseline;
                        cr.moveTo(origCenterX, origYConn);
                        cr.lineTo(activeCenterX, activeYConn);
                    } else {
                        const origCenterY = origBoxY + origBoxH / 2;
                        const origXConn = (currentPosition === Positions.LEFT) ? origBoxX : (origBoxX + origBoxW);
                        const activeXConn = (currentPosition === Positions.LEFT) ? baseline : (baseline - ICON_SIZE);
                        cr.moveTo(origXConn, origCenterY);
                        cr.lineTo(activeXConn, activeCenterX);
                    }
                    cr.stroke();
                    cr.setDash([], 0);
                }
            }
        }

        // --- Render Active Dock Container Background (Enclosing Real Icons) ---
        const bgFirstEdge = (!isVertical ? activeDockStartX : activeDockStartY) + activeCenters[NUM_IMAGINARY] - iconWidths[NUM_IMAGINARY] / 2;
        const bgLastEdge = (!isVertical ? activeDockStartX : activeDockStartY) + activeCenters[NUM_IMAGINARY + NUM_ICONS - 1] + iconWidths[NUM_IMAGINARY + NUM_ICONS - 1] / 2;
        const totalSpan = bgLastEdge - bgFirstEdge;

        let bgActiveX, bgActiveY, bgActiveW, bgActiveH;
        if (!isVertical) {
            bgActiveX = bgFirstEdge - 12;
            bgActiveW = totalSpan + 24;
            bgActiveY = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE - 10) : (baseline - 10);
            bgActiveH = ICON_SIZE + 20;
        } else {
            bgActiveX = (currentPosition === Positions.LEFT) ? (baseline - 10) : (baseline - ICON_SIZE - 10);
            bgActiveW = ICON_SIZE + 20;
            bgActiveY = bgFirstEdge - 12;
            bgActiveH = totalSpan + 24;
        }

        const bgRadius = 14;
        cr.setSourceRGBA(0.2, 0.2, 0.24, 0.85);
        cr.newSubPath();
        cr.arc(bgActiveX + bgRadius, bgActiveY + bgRadius, bgRadius, Math.PI, 1.5 * Math.PI);
        cr.arc(bgActiveX + bgActiveW - bgRadius, bgActiveY + bgRadius, bgRadius, 1.5 * Math.PI, 2.0 * Math.PI);
        cr.arc(bgActiveX + bgActiveW - bgRadius, bgActiveY + bgActiveH - bgRadius, bgRadius, 0, 0.5 * Math.PI);
        cr.arc(bgActiveX + bgRadius, bgActiveY + bgActiveH - bgRadius, bgRadius, 0.5 * Math.PI, Math.PI);
        cr.closePath();
        cr.fill();

        // --- Render Wireframe Icon Containers (All 14, with imaginary nodes rendered subtly) ---
        for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
            const isImaginary = (i < NUM_IMAGINARY || i >= NUM_IMAGINARY + NUM_ICONS);
            const realIdx = i - NUM_IMAGINARY;
            const isSep = (!isImaginary && realIdx === SEPARATOR_INDEX);
            const pc = activeCenters[i];
            const primaryCenter = (!isVertical ? activeDockStartX : activeDockStartY) + pc;
            const curW = iconWidths[i];
            const curH = ICON_SIZE; // Fixed height (width-only scaling)

            let boxX, boxY, boxW, boxH;
            if (!isVertical) {
                boxW = curW;
                boxH = curH;
                boxX = primaryCenter - boxW / 2;
                boxY = (currentPosition === Positions.BOTTOM) ? (baseline - boxH) : baseline;
            } else {
                boxW = ICON_SIZE;
                boxH = curW;
                boxX = (currentPosition === Positions.LEFT) ? baseline : (baseline - boxW);
                boxY = primaryCenter - boxH / 2;
            }

            if (isSep) {
                // Separator bar
                cr.setLineWidth(2.5);
                cr.setSourceRGBA(0.5, 0.5, 0.55, 0.7);
                if (!isVertical) {
                    cr.moveTo(primaryCenter, boxY + 6);
                    cr.lineTo(primaryCenter, boxY + boxH - 6);
                } else {
                    cr.moveTo(boxX + 6, primaryCenter);
                    cr.lineTo(boxX + boxW - 6, primaryCenter);
                }
                cr.stroke();
            } else {
                // 1. Draw Wireframe Icon Container
                cr.setLineWidth(isImaginary ? 1.2 : 2.0);
                const scaleNorm = (iconScales[i] - 1.0) / Math.max(0.01, maxScale - 1.0);

                if (isImaginary) {
                    cr.setDash([3, 3], 0);
                    cr.setSourceRGBA(0.5, 0.5, 0.55, 0.35); // Subdued ghost frame
                } else {
                    cr.setDash([], 0);
                    cr.setSourceRGBA(0.4 + 0.5 * scaleNorm, 0.6 + 0.3 * scaleNorm, 0.8, 0.9);
                }

                const cornerR = 8;
                cr.newSubPath();
                cr.arc(boxX + cornerR, boxY + cornerR, cornerR, Math.PI, 1.5 * Math.PI);
                cr.arc(boxX + boxW - cornerR, boxY + cornerR, cornerR, 1.5 * Math.PI, 2.0 * Math.PI);
                cr.arc(boxX + boxW - cornerR, boxY + boxH - cornerR, cornerR, 0, 0.5 * Math.PI);
                cr.arc(boxX + cornerR, boxY + boxH - cornerR, cornerR, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.stroke();
                cr.setDash([], 0);

                if (!isImaginary) {
                    // Faint fill inside real wireframe container
                    cr.setSourceRGBA(0.3, 0.5, 0.7, 0.08 + 0.12 * scaleNorm);
                    cr.fill();

                    // 2. Inner Icon placeholder (fixed size icon inside the wireframe container)
                    const innerSize = 28;
                    const innerX = boxX + (boxW - innerSize) / 2;
                    const innerY = boxY + (boxH - innerSize) / 2;

                    cr.setLineWidth(1.5);
                    cr.setSourceRGBA(0.7, 0.75, 0.85, 0.7);
                    const innerR = 5;
                    cr.newSubPath();
                    cr.arc(innerX + innerR, innerY + innerR, innerR, Math.PI, 1.5 * Math.PI);
                    cr.arc(innerX + innerSize - innerR, innerY + innerR, innerR, 1.5 * Math.PI, 2.0 * Math.PI);
                    cr.arc(innerX + innerSize - innerR, innerY + innerSize - innerR, innerR, 0, 0.5 * Math.PI);
                    cr.arc(innerX + innerR, innerY + innerSize - innerR, innerR, 0.5 * Math.PI, Math.PI);
                    cr.closePath();
                    cr.stroke();

                    // Running app indicator dot
                    if (realIdx === 1 || realIdx === 4 || realIdx === 8) {
                        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.85);
                        let dotX, dotY;
                        if (currentPosition === Positions.BOTTOM) {
                            dotX = primaryCenter;
                            dotY = baseline + 8;
                        } else if (currentPosition === Positions.TOP) {
                            dotX = primaryCenter;
                            dotY = baseline - 8;
                        } else if (currentPosition === Positions.LEFT) {
                            dotX = baseline - 8;
                            dotY = primaryCenter;
                        } else if (currentPosition === Positions.RIGHT) {
                            dotX = baseline + 8;
                            dotY = primaryCenter;
                        }
                        cr.arc(dotX, dotY, 3, 0, 2 * Math.PI);
                        cr.fill();
                    }
                }
            }
        }

        // --- Overlay: Mouse / Indicator Guideline and Parabolic Curve Visualization ---
        if (mouseOver) {
            // Draw pointer indicator guideline
            cr.setSourceRGBA(1.0, 0.35, 0.35, 0.6);
            cr.setLineWidth(1.0);
            if (!isVertical) {
                cr.moveTo(lastGlobalX, 0);
                cr.lineTo(lastGlobalX, height);
                cr.stroke();
                // Pointer dot
                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.95);
                cr.arc(lastGlobalX, lastGlobalY, 5, 0, 2 * Math.PI);
                cr.fill();
            } else {
                cr.moveTo(0, lastGlobalY);
                cr.lineTo(width, lastGlobalY);
                cr.stroke();
                // Pointer dot
                cr.setSourceRGBA(1.0, 0.3, 0.3, 0.95);
                cr.arc(lastGlobalX, lastGlobalY, 5, 0, 2 * Math.PI);
                cr.fill();
            }

            // Draw visual parabolic curve preview above/next to the dock
            cr.setLineWidth(2.0);
            cr.setSourceRGBA(0.3, 0.9, 0.6, 0.8);
            const steps = 60;
            const curveSpan = radius * 2;
            const curveCenter = pointerGlobalPrimary;
            const curveBaselineY = (currentPosition === Positions.BOTTOM) ? (baseline - ICON_SIZE - 25) : 70;

            if (!isVertical) {
                cr.newSubPath();
                for (let s = 0; s <= steps; s++) {
                    const gx = (curveCenter - radius) + (s / steps) * curveSpan;
                    const dist = Math.abs(gx - curveCenter);
                    let scaleVal = 1.0;
                    if (dist < radius) {
                        const y = dist / radius;
                        scaleVal = 1.0 + (maxScale - 1.0) * (1.0 - y * y);
                    }
                    const py = curveBaselineY - (scaleVal - 1.0) * 35;
                    if (s === 0) cr.moveTo(gx, py);
                    else cr.lineTo(gx, py);
                }
                cr.stroke();
            }
        }

        // --- HUD / Parameters Info ---
        const hudX = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (width - 380) : 25;
        const hudY = (currentPosition === Positions.TOP || currentPosition === Positions.LEFT) ? (height - 240) : 130;

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(14);
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);
        cr.moveTo(hudX, hudY);
        cr.showText(`Max Scale (M): ${maxScale.toFixed(2)}x`);
        cr.moveTo(hudX, hudY + 24);
        cr.showText(`Radius (R): ${radius.toFixed(0)}px`);
        cr.moveTo(hudX, hudY + 48);
        cr.showText(`Base Spacing (A/D): ${staticPadding.toFixed(0)}px (Active: ${activePadding.toFixed(1)}px)`);
        cr.moveTo(hudX, hudY + 72);
        cr.showText(`Hover Transition: ${(hoverProgress * 100).toFixed(0)}%`);

        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(11);
        cr.setSourceRGBA(0.7, 0.8, 0.85, 0.95);
        cr.moveTo(hudX, hudY + 100);
        cr.showText(`Parabolic function: f(u) = 1 + (M - 1) * (1 - (dist / R)²)`);
        cr.moveTo(hudX, hudY + 120);
        cr.showText(`Step 1: Wireframe scaling (WIDTH ONLY) via parabolic function`);
        cr.moveTo(hudX, hudY + 140);
        cr.showText(`Peak pair overlap resolved by relative scale (larger moves less)`);
        cr.moveTo(hudX, hudY + 160);
        cr.showText(`Outward loops: left-to-start & right-to-end eliminate succeeding overlaps`);
        cr.moveTo(hudX, hudY + 180);
        cr.showText(`Gradient facade icons: DISABLED (Planned for next step)`);
        cr.moveTo(hudX, hudY + 200);
        const posNames = ["BOTTOM", "LEFT", "TOP", "RIGHT"];
        cr.showText(`Dock Position (Cycle via R): ${posNames[currentPosition]}`);
    });

    win.present();
});

app.run([]);
