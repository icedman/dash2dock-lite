# Extension JavaScript Additions Summary (2026-10-04 to 2026-10-15)

> **Baseline commit**: `861b7c1598` (2026-10-04)
> **Head commit**: `HEAD` (HEAD)
> **Scope**: Newly added code strictly across the extension's runtime JavaScript files (`.js`), excluding markdown documentation, tests, tools, and build configurations. Removed/deleted lines are omitted.

## Overview of Added JavaScript Code by File

| File | Added Lines | Hunks | Description / Area |
|---|---|---|---|
| [`animator.js`](#animatorjs) | 500 | 70 | Dock animations, physics transitions, badge sync, render pooling |
| [`apps/calendar.js`](#appscalendarjs) | 6 | 2 | Calendar applet integration & scaling |
| [`apps/clock.js`](#appsclockjs) | 6 | 2 | Clock applet integration & rendering fixes |
| [`apps/dot.js`](#appsdotjs) | 6 | 2 | Running app indicator dot sizing & positioning |
| [`apps/overlay.js`](#appsoverlayjs) | 3 | 1 | App overlay rendering helpers |
| [`autohide.js`](#autohidejs) | 31 | 9 | Intellihide & edge barrier logic, overlap bounds safety |
| [`compat.js`](#compatjs) | 363 | 1 | GNOME Shell version compatibility abstraction layer (Shell 42–50) |
| [`dock.js`](#dockjs) | 511 | 116 | Core dock layout, actor hierarchies, strut allocation, label positioning |
| [`dockItemMenu.js`](#dockItemMenujs) | 11 | 6 | App icon popup menu positioning & actions |
| [`dockItems.js`](#dockItemsjs) | 187 | 32 | Dock icon item lifecycle, pinned apps, notification badges |
| [`effects/color_shader_effect.js`](#effectscolor_shader_effectjs) | 33 | 9 | Custom Clutter shader effect for dock coloring/tints |
| [`effects/monochrome_effect.js`](#effectsmonochrome_effectjs) | 5 | 3 | Icon monochrome desaturation shader |
| [`effects/tint_effect.js`](#effectstint_effectjs) | 5 | 3 | Icon tint and colorization shaders |
| [`extension.js`](#extensionjs) | 327 | 47 | Extension lifecycle entrypoint, monitor change listeners, IPC commands |
| [`integrations.js`](#integrationsjs) | 1 | 1 | Shell overview & dash integration hooks, scaled down icon sizing |
| [`preferences/keys.js`](#preferenceskeysjs) | 1 | 1 | DConf schema settings keys definitions |
| [`preferences/prefKeys.js`](#preferencesprefKeysjs) | 59 | 10 | Preferences window settings binding helpers |
| [`prefs.js`](#prefsjs) | 73 | 15 | AdwPreferencesWindow configuration UI initialization |
| [`probe.js`](#probejs) | 109 | 1 | Extension health check probes & runtime smoke diagnostics |
| [`services.js`](#servicesjs) | 289 | 49 | System services (trash, mounts, battery, system indicators) |
| [`style.js`](#stylejs) | 74 | 11 | Dynamic CSS and stylesheet property injection |
| [`timer.js`](#timerjs) | 57 | 17 | Animation frame ticker and timer scheduling |
| [`utils.js`](#utilsjs) | 29 | 5 | Path resolution and shell utility routines |
| [`windowTracker.js`](#windowTrackerjs) | 50 | 1 | Window tracking & active app focus state monitor |
| **Total (24 JS files)** | **2736** | **414** | **All Extension JavaScript Additions** |

---

## Detailed Blame-style Code Additions

<a id="animatorjs"></a>
### `animator.js` (+500 lines across 70 hunks)

```javascript
// --- Lines 4–4 ---
d94c310    4 | import * as Compat from './compat.js';

// --- Lines 16–16 ---
523cec2   16 | import { live } from './probe.js';

// --- Lines 34–55 ---
ecf4f95   34 | function getScale(u, xm, R, M, type = 0) {
8034ccf   35 |     const dist = Math.abs(u - xm);
8034ccf   36 |     if (dist >= R) {
8034ccf   37 |         return 1.0;
8034ccf   38 |     }
ecf4f95   39 |     const t = 1.0 - (dist / R);
ecf4f95   40 |     let factor = t;
ecf4f95   41 | 
ecf4f95   42 |     if (type === 1) {
ecf4f95   43 |         // Linear Proximity
ecf4f95   44 |         factor = t;
ecf4f95   45 |     } else if (type === 2) {
ecf4f95   46 |         // Smoothstep Polynomial
ecf4f95   47 |         factor = t * t * (3 - 2 * t);
ecf4f95   48 |     } else {
ecf4f95   49 |         // 0: Cosine Bell (standard macOS bell curve)
ecf4f95   50 |         factor = Math.cos((dist / R) * (Math.PI / 2));
ecf4f95   51 |     }
ecf4f95   52 | 
ecf4f95   53 |     return 1.0 + (M - 1.0) * factor;
8034ccf   54 | }
8034ccf   55 | 

// --- Lines 57–60 ---
523cec2   57 |   constructor() {
523cec2   58 |     live('animator', 1);
523cec2   59 |   }
523cec2   60 | 

// --- Lines 71–94 ---
30ae2d5   71 |     this._destroyPool();
30ae2d5   72 |     // only non-pool children are left (services' clock/calendar); they are
30ae2d5   73 |     // just unparented until R-7b destroys them with their item
30ae2d5   74 |     this._target?.remove_all_children();
30ae2d5   75 |     this._target = null;
30ae2d5   76 |     this._computed = null;
30ae2d5   77 |   }
30ae2d5   78 | 
30ae2d5   79 |   destroy() {
d95bb11   80 |     if (this._destroyed) return;
d95bb11   81 |     this._destroyed = true;
523cec2   82 |     live('animator', -1);
30ae2d5   83 |     this.disable();
30ae2d5   84 |     this.dock = null;
30ae2d5   85 |     this.extension = null;
30ae2d5   86 |   }
30ae2d5   87 | 
30ae2d5   88 |   _destroyPool() {
30ae2d5   89 |     [this._renderers, this._dots, this._badges].forEach((pool) => {
30ae2d5   90 |       (pool || []).forEach((actor) => actor?.destroy());
30ae2d5   91 |     });
30ae2d5   92 |     this._renderers = [];
30ae2d5   93 |     this._dots = [];
30ae2d5   94 |     this._badges = [];

// --- Lines 104–104 ---
30ae2d5  104 |       this._destroyPool();

// --- Lines 122–124 ---
76846c1  122 |       let dots = new DockItemDotsOverlay(new Dot(DOT_CANVAS_SIZE), {
76846c1  123 |         name: 'd2daDotsOverlay',
76846c1  124 |       });

// --- Lines 130–132 ---
76846c1  130 |       let badge = new DockItemBadgeOverlay(new Dot(DOT_CANVAS_SIZE), {
76846c1  131 |         name: 'd2daBadgeOverlay',
76846c1  132 |       });

// --- Lines 149–156 ---
76846c1  149 |     try {
76846c1  150 |       this._animate(dt);
76846c1  151 |     } catch (err) {
76846c1  152 |       console.error('d2da: animator animate', err);
76846c1  153 |     }
76846c1  154 |   }
76846c1  155 | 
76846c1  156 |   _animate(dt) {

// --- Lines 158–159 ---
76846c1  158 |     if (!dock) return;
76846c1  159 | 

// --- Lines 166–178 ---
37f059d  166 |     if (dock._needsLayout) {
37f059d  167 |       if (!dock.relayout()) {
37f059d  168 |         return;
37f059d  169 |       }
37f059d  170 |     }
37f059d  171 | 
c91723f  172 |     dock._snapToContainerEdge(dock, dock.dash, true);
c91723f  173 | 
37f059d  174 |     if (!dock._icons || !dock._icons.length) {
4b76f8d  175 |       return;
4b76f8d  176 |     }
b17b6c9  177 | 
76846c1  178 |     if (!dock.renderArea?.has_allocation()) {

// --- Lines 248–248 ---
76846c1  248 |       if (!pos || isNaN(pos[0]) || isNaN(pos[1])) return;

// --- Lines 266–266 ---
8f44419  266 |         prevIcon._next = icon;

// --- Lines 287–287 ---
a3ee53a  287 |     // Keep magnification independent from spread

// --- Lines 293–293 ---
8034ccf  293 |     const scaleAtMax = 1.0 + magnify;

// --- Lines 295–298 ---
8034ccf  295 |     // --- Step 1: Ghost Nodes / Imaginary Icons Setup ---
8034ccf  296 |     const NUM_ICONS = animateIcons.length;
8034ccf  297 |     const NUM_IMAGINARY = 4;
8034ccf  298 |     const TOTAL_CALC_ICONS = NUM_IMAGINARY + NUM_ICONS + NUM_IMAGINARY;

// --- Lines 300–305 ---
0a0e607  300 |     // --- Step 2: Static Centers & Coordinate Decoupling (Measured directly from Clutter!) ---
0a0e607  301 |     const firstIconObj = animateIcons[0];
0a0e607  302 |     const lastIconObj = animateIcons[NUM_ICONS - 1];
e5695b0  303 | 
0a0e607  304 |     const firstIconPos = vertical ? firstIconObj._fixedPosition[1] : firstIconObj._fixedPosition[0];
0a0e607  305 |     const firstIconSize = vertical ? firstIconObj.height : firstIconObj.width;

// --- Lines 307–315 ---
0a0e607  307 |     const staticDockStart = firstIconPos;
0a0e607  308 | 
0a0e607  309 |     const restingCenters = [];
0a0e607  310 |     for (let i = 0; i < NUM_ICONS; i++) {
0a0e607  311 |         const icon = animateIcons[i];
0a0e607  312 |         const pos_i = vertical ? icon._fixedPosition[1] : icon._fixedPosition[0];
0a0e607  313 |         const size_i = vertical ? icon.height : icon.width;
0a0e607  314 |         const center_i = pos_i + size_i / 2;
0a0e607  315 |         restingCenters.push(center_i - staticDockStart);

// --- Lines 318–358 ---
0a0e607  318 |     const lastIconPos = vertical ? lastIconObj._fixedPosition[1] : lastIconObj._fixedPosition[0];
0a0e607  319 |     const lastIconSize = vertical ? lastIconObj.height : lastIconObj.width;
0a0e607  320 |     const restingL = (lastIconPos + lastIconSize) - firstIconPos;
0a0e607  321 | 
8034ccf  322 |     const ICON_SIZE = iconSize * scaleFactor;
e5695b0  323 |     const spacingMargin = 8.0 * (dock.extension.icon_spacing || 0.0);
a3ee53a  324 |     // Base resting padding between items
e5695b0  325 |     const basePadding = 2.0 * spacingMargin + 2.0;
fad5c6f  326 | 
a3ee53a  327 |     // Zero mouse-entry spread inflation: inter-icon padding stays constant,
a3ee53a  328 |     // exactly as in dock_animation3.js (macOS style). Outward layout shift
a3ee53a  329 |     // comes exclusively from the magnified icon widths themselves.
a3ee53a  330 |     const activePadding = basePadding;
8034ccf  331 |     const activeContainerWidth = ICON_SIZE + activePadding;
fad5c6f  332 | 
cf2a5dd  333 |     // Hit-test strictly within the visual bounds of the dock
0e3a2f1  334 |     const primaryMouseVal = vertical ? py : px;
0e3a2f1  335 |     const secondaryMouseVal = vertical ? px : py;
0e3a2f1  336 |     const firstIconSecondary = vertical ? firstIconObj._fixedPosition[0] : firstIconObj._fixedPosition[1];
d9bc04e  337 | 
cf2a5dd  338 |     const dockPad = iconSize * 0.1 * (dock.extension.dock_padding || 0) * scaleFactor;
cf2a5dd  339 |     const tx1 = firstIconObj._icon ? (vertical ? firstIconObj._icon.translationY : firstIconObj._icon.translationX) : 0;
cf2a5dd  340 |     const tx2 = lastIconObj._icon ? (vertical ? lastIconObj._icon.translationY : lastIconObj._icon.translationX) : 0;
0e3a2f1  341 | 
cf2a5dd  342 |     const dockVisualStart = staticDockStart + (animated ? Math.min(0, tx1) : 0) - dockPad;
cf2a5dd  343 |     const dockVisualEnd = staticDockStart + restingL + (animated ? Math.max(0, tx2) : 0) + dockPad;
cf2a5dd  344 |     const isWithinPrimary = (primaryMouseVal >= dockVisualStart && primaryMouseVal <= dockVisualEnd);
cf2a5dd  345 | 
cf2a5dd  346 |     const iconCenterSec = firstIconSecondary + ICON_SIZE / 2;
cf2a5dd  347 |     const secondaryDist = Math.abs(secondaryMouseVal - iconCenterSec);
cf2a5dd  348 |     const maxSecReach = animated
cf2a5dd  349 |       ? (scaleAtMax * ICON_SIZE) / 2 + rise * scaleFactor + dockPad + 4
cf2a5dd  350 |       : ICON_SIZE / 2 + dockPad + 4;
cf2a5dd  351 |     const isWithinSecondary = (secondaryDist <= maxSecReach);
0e3a2f1  352 | 
0e3a2f1  353 |     isWithin = isWithinPrimary && isWithinSecondary;
0e3a2f1  354 |     if (m.inFullscreen) {
0e3a2f1  355 |         isWithin = false;
0e3a2f1  356 |     }
0e3a2f1  357 |     animated = isWithin;
0e3a2f1  358 |     dock.animated = animated;

// --- Lines 360–364 ---
8034ccf  360 |     // Compute unwarped static centers for all 18 calculated icons
8034ccf  361 |     const staticCenters = [];
8034ccf  362 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  363 |         staticCenters.push(i * activeContainerWidth + activeContainerWidth / 2);
8034ccf  364 |     }

// --- Lines 366–395 ---
8034ccf  366 |     // Compute decoupled mouse coordinates in the 18-icon coordinate system
8034ccf  367 |     const primaryMouse = vertical ? py : px;
70a760e  368 | 
70a760e  369 |     // Calibrate pointer tracking by measuring relative to the unwarped active dock start
70a760e  370 |     const activeUnpackedL = NUM_ICONS * activeContainerWidth;
70a760e  371 |     const unwarpedActiveStartX = staticDockStart - (activeUnpackedL - restingL) / 2;
70a760e  372 |     const xmLocalActive = primaryMouse - unwarpedActiveStartX;
70a760e  373 | 
8034ccf  374 |     const firstRealStaticLeft = staticCenters[NUM_IMAGINARY] - ICON_SIZE / 2;
70a760e  375 |     const xmLocalCalculated = xmLocalActive + firstRealStaticLeft;
8034ccf  376 |     const totalCalcStaticL = TOTAL_CALC_ICONS * activeContainerWidth;
8034ccf  377 |     const xmClamped = Math.max(0, Math.min(totalCalcStaticL, xmLocalCalculated));
8034ccf  378 | 
ecf4f95  379 |     // --- Step 3: Scaling & Perfectly Packed Centers ---
ecf4f95  380 |     const curveType = dock.extension.animation_rise_curve ?? 0;
8034ccf  381 |     const iconScales = [];
8034ccf  382 |     const iconWidths = [];
0e3a2f1  383 |     const hoverActive = isWithin;
0201cf4  384 | 
8034ccf  385 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
0201cf4  386 |         if (!hoverActive) {
0201cf4  387 |             iconScales.push(1.0);
0201cf4  388 |             iconWidths.push(ICON_SIZE);
0201cf4  389 |         } else {
0201cf4  390 |             const xi = staticCenters[i];
ecf4f95  391 |             const scale = getScale(xi, xmClamped, threshold, scaleAtMax, curveType);
0201cf4  392 |             iconScales.push(scale);
0201cf4  393 |             iconWidths.push(ICON_SIZE * scale);
0201cf4  394 |         }
8034ccf  395 |     }

// --- Lines 399–424 ---
8034ccf  399 |     const packedCenters = [];
8034ccf  400 |     let currentPos = 0;
8034ccf  401 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  402 |         const halfW = iconWidths[i] / 2;
8034ccf  403 |         if (i === 0) {
8034ccf  404 |             currentPos = halfW;
8034ccf  405 |         } else {
8034ccf  406 |             currentPos += iconWidths[i - 1] / 2 + halfW + activePadding;
8034ccf  407 |         }
8034ccf  408 |         packedCenters.push(currentPos);
8034ccf  409 |     }
8034ccf  410 |     const activeL = packedCenters[TOTAL_CALC_ICONS - 1] + iconWidths[TOTAL_CALC_ICONS - 1] / 2;
8034ccf  411 | 
8034ccf  412 |     // --- Step 4: Invariance-Targeted Variance Distribution ---
8034ccf  413 |     // Pre-calculate target packed dock length at dead center
8034ccf  414 |     const centerMouse = totalCalcStaticL / 2;
8034ccf  415 |     const centerScales = [];
8034ccf  416 |     const centerWidths = [];
cf2a5dd  417 |     const activeHoverFactor = (hoverActive && !noAnimation) ? 1.0 : 0.0;
8034ccf  418 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  419 |         const xi = staticCenters[i];
ecf4f95  420 |         const targetScale = getScale(xi, centerMouse, threshold, scaleAtMax, curveType);
8034ccf  421 |         const scale = 1.0 + (targetScale - 1.0) * activeHoverFactor;
8034ccf  422 |         centerScales.push(scale);
8034ccf  423 |         centerWidths.push(ICON_SIZE * scale);
8034ccf  424 |     }

// --- Lines 426–432 ---
8034ccf  426 |     let currentCenterPos = 0;
8034ccf  427 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  428 |         const halfW = centerWidths[i] / 2;
8034ccf  429 |         if (i === 0) {
8034ccf  430 |             currentCenterPos = halfW;
8034ccf  431 |         } else {
8034ccf  432 |             currentCenterPos += centerWidths[i - 1] / 2 + halfW + activePadding;

// --- Lines 434–435 ---
8034ccf  434 |     }
8034ccf  435 |     const centerPackedL = currentCenterPos + centerWidths[TOTAL_CALC_ICONS - 1] / 2;

// --- Lines 437–442 ---
8034ccf  437 |     // Distribute length variance evenly across all calculation nodes
8034ccf  438 |     const variance = centerPackedL - activeL;
8034ccf  439 |     const adjustedIconWidths = [];
8034ccf  440 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  441 |         adjustedIconWidths.push(iconWidths[i] + variance / TOTAL_CALC_ICONS);
8034ccf  442 |     }

// --- Lines 444–460 ---
8334f1d  444 |     // Save the unshifted realLeftEdge before applying the mouse-proximity shift to imaginary icons
8334f1d  445 |     let realLeftEdgeUnshifted = 0;
8334f1d  446 |     for (let i = 0; i < NUM_IMAGINARY; i++) {
8334f1d  447 |         realLeftEdgeUnshifted += adjustedIconWidths[i];
8334f1d  448 |     }
8334f1d  449 |     realLeftEdgeUnshifted += NUM_IMAGINARY * activePadding;
8334f1d  450 | 
0340ec5  451 |     /*
8334f1d  452 |     // --- Proportional Widening/Narrowing of Boundary Imaginary Icons ---
8334f1d  453 |     // Calculate normalized mouse position t on the unexpanded dock
8334f1d  454 |     const t = xmClamped / totalCalcStaticL;
8334f1d  455 |     // Calculate the unshifted real active length of the real icons
8334f1d  456 |     let realActiveLUnshifted = 0;
8334f1d  457 |     for (let i = NUM_IMAGINARY; i < NUM_IMAGINARY + NUM_ICONS; i++) {
8334f1d  458 |         realActiveLUnshifted += adjustedIconWidths[i];
8334f1d  459 |     }
8334f1d  460 |     realActiveLUnshifted += (NUM_ICONS - 1) * activePadding;

// --- Lines 462–463 ---
8334f1d  462 |     // Proportional shift based on mouse proximity to edge (pushes icons towards the mouse/center)
0340ec5  463 |     const shift = 1.0 * (0.5 - t) * (realActiveLUnshifted - restingL) * (hoverActive ? 1.0 : 0.0);

// --- Lines 465–484 ---
8334f1d  465 |     // Apply shift: widen the first imaginary icons and narrow the last imaginary icons (or vice versa)
8334f1d  466 |     for (let i = 0; i < NUM_IMAGINARY; i++) {
8334f1d  467 |         adjustedIconWidths[i] += shift / NUM_IMAGINARY;
8334f1d  468 |     }
8334f1d  469 |     for (let i = TOTAL_CALC_ICONS - NUM_IMAGINARY; i < TOTAL_CALC_ICONS; i++) {
8334f1d  470 |         adjustedIconWidths[i] -= shift / NUM_IMAGINARY;
8334f1d  471 |     }
0340ec5  472 |      */
8334f1d  473 | 
8034ccf  474 |     const adjustedPackedCenters = [];
8034ccf  475 |     let adjCurrentPos = 0;
8034ccf  476 |     for (let i = 0; i < TOTAL_CALC_ICONS; i++) {
8034ccf  477 |         const halfW = adjustedIconWidths[i] / 2;
8034ccf  478 |         if (i === 0) {
8034ccf  479 |             adjCurrentPos = halfW;
8034ccf  480 |         } else {
8034ccf  481 |             adjCurrentPos += adjustedIconWidths[i - 1] / 2 + halfW + activePadding;
8034ccf  482 |         }
8034ccf  483 |         adjustedPackedCenters.push(adjCurrentPos);
8034ccf  484 |     }

// --- Lines 486–489 ---
8034ccf  486 |     // Extract the bounds of the 10 real icons from the 18 calculated nodes
8034ccf  487 |     const realLeftEdge = adjustedPackedCenters[NUM_IMAGINARY] - adjustedIconWidths[NUM_IMAGINARY] / 2;
1322514  488 |     const realRightEdge = adjustedPackedCenters[NUM_IMAGINARY + NUM_ICONS - 1] + adjustedIconWidths[NUM_IMAGINARY + NUM_ICONS - 1] / 2;
1322514  489 |     const realActiveL = realRightEdge - realLeftEdge;

// --- Lines 491–494 ---
8034ccf  491 |     // --- Step 5: Decoupled Clutter Translation & Icon Texture Scaling ---
8034ccf  492 |     let firstIcon = null;
8034ccf  493 |     let lastIcon = null;
8034ccf  494 |     let iconTable = [];

// --- Lines 496–497 ---
1322514  496 |     // Centering shift to align the dynamic packed dock center with the resting dock center
1322514  497 |     const centeringShift = (restingL - realActiveL) / 2;

// --- Lines 499–501 ---
cf2a5dd  499 |     // Nearest icon computed directly from rendered visual centers on screen
cf2a5dd  500 |     nearestIcon = null;
cf2a5dd  501 |     let minDistance = Infinity;

// --- Lines 503–514 ---
cf2a5dd  503 |     if (hoverActive && !noAnimation) {
cf2a5dd  504 |       animateIcons.forEach((icon, idx) => {
cf2a5dd  505 |         if (!icon._icon) return;
cf2a5dd  506 |         const calcIndex = idx + NUM_IMAGINARY;
cf2a5dd  507 |         const pc = adjustedPackedCenters[calcIndex];
cf2a5dd  508 |         const activeCenter = pc - realLeftEdgeUnshifted;
cf2a5dd  509 |         const visualCenter = staticDockStart + activeCenter + centeringShift;
cf2a5dd  510 |         const dist = Math.abs(visualCenter - primaryMouse);
cf2a5dd  511 | 
cf2a5dd  512 |         if (dist < minDistance) {
cf2a5dd  513 |           minDistance = dist;
cf2a5dd  514 |           nearestIcon = icon;

// --- Lines 516–523 ---
cf2a5dd  516 |       });
cf2a5dd  517 | 
cf2a5dd  518 |       if (nearestIcon) {
cf2a5dd  519 |         const nearestIndex = animateIcons.indexOf(nearestIcon) + NUM_IMAGINARY;
cf2a5dd  520 |         const nearestScale = iconScales[nearestIndex] ?? 1.0;
cf2a5dd  521 |         const halfWidth = (ICON_SIZE * nearestScale) / 2 + activePadding;
cf2a5dd  522 |         if (minDistance > halfWidth) {
cf2a5dd  523 |           nearestIcon = null;

// --- Lines 528–533 ---
cf2a5dd  528 |     let didScale = (nearestIcon !== null);
cf2a5dd  529 |     let hoveredIcon = nearestIcon;
cf2a5dd  530 |     dock._nearestIcon = nearestIcon;
cf2a5dd  531 |     dock._hoveredIcon = nearestIcon;
cf2a5dd  532 | 
8034ccf  533 |     animateIcons.forEach((icon, idx) => {

// --- Lines 535–562 ---
a8a1118  535 | 
8034ccf  536 |         const calcIndex = idx + NUM_IMAGINARY;
8034ccf  537 |         const pc = adjustedPackedCenters[calcIndex];
8334f1d  538 |         const activeCenter = pc - realLeftEdgeUnshifted;
cf2a5dd  539 |         const visualCenter = staticDockStart + activeCenter + centeringShift;
cf2a5dd  540 |         icon._visualCenter = visualCenter;
b17b6c9  541 | 
8034ccf  542 |         // Position the Clutter actor perfectly using 1D packing relative to its resting center
1322514  543 |         icon._translate = activeCenter + centeringShift - restingCenters[idx];
6cdd118  544 | 
8034ccf  545 |         // Assign unadjusted original scale to the actor properties
8034ccf  546 |         const originalScale = iconScales[calcIndex];
8034ccf  547 |         icon._scale = originalScale;
8034ccf  548 |         icon._targetScale = originalScale;
6cdd118  549 | 
8034ccf  550 |         // Compute secondary axis rise offset (elevation)
8034ccf  551 |         const sz = iconSize * (originalScale - 1) * scaleFactor;
8034ccf  552 |         icon._translateRise = sz * rise;
52c813a  553 | 
8034ccf  554 |         // Apply scale directly to the icon image texture
8034ccf  555 |         if (
8034ccf  556 |             icon._icon.gicon &&
8034ccf  557 |             icon._icon.gicon.file != null &&
8034ccf  558 |             !icon._icon.gicon.file?.get_path()?.toLowerCase().endsWith('svg')
8034ccf  559 |         ) {
8034ccf  560 |             // skip scaling non-SVG image files for performance
8034ccf  561 |         } else {
8034ccf  562 |             icon._icon.set_scale(originalScale, originalScale);

// --- Lines 564–570 ---
b17b6c9  564 | 
8034ccf  565 |         iconTable.push(icon);
8034ccf  566 |         if (firstIcon == null) {
8034ccf  567 |             firstIcon = icon;
b17b6c9  568 |         }
8034ccf  569 |         lastIcon = icon;
8034ccf  570 |     });

// --- Lines 576–578 ---
76846c1  576 |     if (!renderOffset || isNaN(renderOffset[0]) || isNaN(renderOffset[1])) {
76846c1  577 |       return;
76846c1  578 |     }

// --- Lines 611–611 ---
d1af52b  611 |       // High-performance Exponential Easing (LERP) for buttery-smooth and snappy transitions

// --- Lines 613–614 ---
e2c6a8e  613 |         let baseLerpFactor = 0.42 * slowDown; // 42% distance closed per 16.6ms frame (blazing fast!)
d1af52b  614 |         let factor = 1.0 - Math.pow(1.0 - baseLerpFactor, dt / 16.6);

// --- Lines 616–621 ---
d1af52b  616 |         // Handle edge boundary cases where dt is massive or invalid
d1af52b  617 |         if (isNaN(factor) || factor > 1.0) factor = 1.0;
d1af52b  618 |         if (factor < 0.0) factor = 0.0;
d1af52b  619 | 
d1af52b  620 |         translationX = icon._icon.translationX + (translationX - icon._icon.translationX) * factor;
d1af52b  621 |         translationY = icon._icon.translationY + (translationY - icon._icon.translationY) * factor;

// --- Lines 624–624 ---
8f44419  624 |       if (dock.extension.animation_fps > 0) {

// --- Lines 637–637 ---
8bc06d9  637 |         icon._appwell.translationX = 0;

// --- Lines 645–645 ---
8b687da  645 | 

// --- Lines 699–699 ---
8bc06d9  699 |           icon._renderer.translationX = 0;

// --- Lines 813–813 ---
dd98d4a  813 |           !dock.extension.hide_labels &&

// --- Lines 821–824 ---
dd98d4a  821 |             if (
dd98d4a  822 |               this._dwellTick > 450 &&
dd98d4a  823 |               (icon._targetScale > 1 || magnify == 0)
dd98d4a  824 |             ) {

// --- Lines 841–841 ---
dd98d4a  841 |           this.alignLabel(icon);

// --- Lines 858–858 ---
85c5b72  858 |       icon._badge = badge;

// --- Lines 876–876 ---
d7edd62  876 |             dock,

// --- Lines 883–884 ---
85c5b72  883 |           badge.translationX = icon._renderer.translationX;
85c5b72  884 |           badge.translationY = icon._renderer.translationY;

// --- Lines 888–890 ---
85c5b72  888 |         } else if (badge) {
85c5b72  889 |           badge.translationX = 0;
85c5b72  890 |           badge.translationY = 0;

// --- Lines 892–894 ---
85c5b72  892 |       } else if (badge) {
85c5b72  893 |         badge.translationX = 0;
85c5b72  894 |         badge.translationY = 0;

// --- Lines 900–900 ---
85c5b72  900 |       icon._dots = dots;

// --- Lines 1121–1192 ---
dd98d4a 1121 |   alignLabel(icon) {
dd98d4a 1122 |     if (!icon || !icon._label) return;
dd98d4a 1123 |     let renderer =
dd98d4a 1124 |       icon._renderer ||
dd98d4a 1125 |       (icon._idx !== undefined ? this._renderers?.[icon._idx] : null);
dd98d4a 1126 | 
dd98d4a 1127 |     let dock = this.dock;
dd98d4a 1128 |     if (!dock) return;
dd98d4a 1129 | 
dd98d4a 1130 |     let tPos, tSize;
dd98d4a 1131 |     if (renderer) {
dd98d4a 1132 |       tSize = renderer.get_transformed_size();
dd98d4a 1133 |       tPos = renderer.get_transformed_position();
dd98d4a 1134 |     } else {
dd98d4a 1135 |       let iconActor = icon._icon || icon;
dd98d4a 1136 |       tSize = iconActor.get_transformed_size();
dd98d4a 1137 |       tPos = iconActor.get_transformed_position();
dd98d4a 1138 |     }
dd98d4a 1139 | 
dd98d4a 1140 |     if (isNaN(tPos[0]) || isNaN(tPos[1])) {
dd98d4a 1141 |       tPos[0] = 0;
dd98d4a 1142 |       tPos[1] = 0;
dd98d4a 1143 |     }
dd98d4a 1144 |     let sw = !isNaN(tSize[0]) ? tSize[0] : 0;
dd98d4a 1145 |     let sh = !isNaN(tSize[1]) ? tSize[1] : 0;
dd98d4a 1146 | 
dd98d4a 1147 |     let lsz = icon._label.get_transformed_size();
dd98d4a 1148 |     let lw = !isNaN(lsz[0]) && lsz[0] > 0 ? lsz[0] : 0;
dd98d4a 1149 |     let lh = !isNaN(lsz[1]) && lsz[1] > 0 ? lsz[1] : 0;
dd98d4a 1150 |     if (!lw || !lh) {
dd98d4a 1151 |       try {
dd98d4a 1152 |         let [, natW] = icon._label.get_preferred_width(-1);
dd98d4a 1153 |         let [, natH] = icon._label.get_preferred_height(natW);
dd98d4a 1154 |         lw = lw || natW || icon._label.width || 0;
dd98d4a 1155 |         lh = lh || natH || icon._label.height || 0;
dd98d4a 1156 |       } catch {
dd98d4a 1157 |         lw = lw || icon._label.width || 0;
dd98d4a 1158 |         lh = lh || icon._label.height || 0;
dd98d4a 1159 |       }
dd98d4a 1160 |     }
dd98d4a 1161 | 
dd98d4a 1162 |     let lx = tPos[0] + sw / 2 - lw / 2;
dd98d4a 1163 |     let ly = tPos[1] + sh / 2 - lh / 2;
dd98d4a 1164 | 
dd98d4a 1165 |     let vertical = dock.isVertical();
dd98d4a 1166 |     let m = dock._monitor;
dd98d4a 1167 |     let scale = m?.geometry_scale || 1;
dd98d4a 1168 | 
dd98d4a 1169 |     if (vertical) {
dd98d4a 1170 |       if (dock._position == DockPosition.LEFT) {
dd98d4a 1171 |         lx += sh / 1.5 + lw / 2;
dd98d4a 1172 |       } else {
dd98d4a 1173 |         lx -= sh / 1.5 + lw / 2;
dd98d4a 1174 |       }
dd98d4a 1175 |       ly += 2 * scale;
dd98d4a 1176 |     } else {
dd98d4a 1177 |       let magnify = dock.extension.animation_magnify;
dd98d4a 1178 |       if (magnify == 0 || dock._iconSize <= 4) {
dd98d4a 1179 |         sh *= 1.5;
dd98d4a 1180 |       }
dd98d4a 1181 |       if (dock._position == DockPosition.BOTTOM) {
dd98d4a 1182 |         ly -= sh / 1.25;
dd98d4a 1183 |       } else {
dd98d4a 1184 |         ly += sh / 1.25;
dd98d4a 1185 |       }
dd98d4a 1186 |       lx += 2 * scale;
dd98d4a 1187 |     }
dd98d4a 1188 | 
dd98d4a 1189 |     icon._label.x = Math.round(lx);
dd98d4a 1190 |     icon._label.y = Math.round(ly);
dd98d4a 1191 |   }
dd98d4a 1192 | 

// --- Lines 1195–1195 ---
d94c310 1195 |     let app_id = Compat.getAppId(appwell);

// --- Lines 1198–1198 ---
8bc06d9 1198 |     let iconSize = dock._iconSizeScaledDown || dock._iconSize;

// --- Lines 1200–1202 ---
8bc06d9 1200 |       (iconSize / 3) *
8bc06d9 1201 |       ((0.25 + (dock.extension.animation_bounce_height ?? 0.75)) * 1.5);
8bc06d9 1202 |     appwell.translation_x = 0;

// --- Lines 1206–1207 ---
30ae2d5 1206 |       // disabled: the pool is destroyed and container._renderer is stale
30ae2d5 1207 |       if (!this._target) return [null, null];

// --- Lines 1211–1211 ---
d94c310 1211 |         return icon._appwell && Compat.getAppId(icon._appwell) === app_id;

// --- Lines 1216–1216 ---
85c5b72 1216 |       return [icon, icon._appwell];

// --- Lines 1222–1252 ---
85c5b72 1222 |         let badge =
85c5b72 1223 |           container._badge ||
85c5b72 1224 |           (container._idx !== undefined
85c5b72 1225 |             ? this._badges?.[container._idx]
85c5b72 1226 |             : null);
8bc06d9 1227 |         if (dock.isVertical()) {
8bc06d9 1228 |           if (container._renderer) {
8bc06d9 1229 |             container._renderer.translationX = appwell.translationX;
85c5b72 1230 |             container._renderer.translationY = 0;
8bc06d9 1231 |           }
8bc06d9 1232 |           if (container._image) {
8bc06d9 1233 |             container._image.translationX = appwell.translationX;
85c5b72 1234 |             container._image.translationY = 0;
8bc06d9 1235 |           }
85c5b72 1236 |           if (badge) {
85c5b72 1237 |             badge.translationX = appwell.translationX;
85c5b72 1238 |             badge.translationY = 0;
8bc06d9 1239 |           }
8bc06d9 1240 |         } else {
8bc06d9 1241 |           if (container._renderer) {
85c5b72 1242 |             container._renderer.translationX = 0;
8bc06d9 1243 |             container._renderer.translationY = appwell.translationY;
8bc06d9 1244 |           }
8bc06d9 1245 |           if (container._image) {
85c5b72 1246 |             container._image.translationX = 0;
8bc06d9 1247 |             container._image.translationY = appwell.translationY;
8bc06d9 1248 |           }
85c5b72 1249 |           if (badge) {
85c5b72 1250 |             badge.translationX = 0;
85c5b72 1251 |             badge.translationY = appwell.translationY;
8bc06d9 1252 |           }

// --- Lines 1258–1258 ---
85c5b72 1258 |         console.error('d2da: bounceIcon translateDecor', err);

// --- Lines 1280–1280 ---
85c5b72 1280 |             console.error('d2da: bounceIcon frame', err);

// --- Lines 1294–1294 ---
85c5b72 1294 |               appwell.translation_x =

// --- Lines 1301–1301 ---
85c5b72 1301 |             console.error('d2da: bounceIcon frame', err);

// --- Lines 1330–1330 ---
8f44419 1330 |             appwell.translation_x = 0;

// --- Lines 1332–1344 ---
8f44419 1332 |             if (container._renderer) {
8f44419 1333 |               container._renderer.translationX = 0;
8bc06d9 1334 |               container._renderer.translationY = 0;
8f44419 1335 |             }
85c5b72 1336 |             let badge =
85c5b72 1337 |               container._badge ||
85c5b72 1338 |               (container._idx !== undefined
85c5b72 1339 |                 ? this._badges?.[container._idx]
85c5b72 1340 |                 : null);
85c5b72 1341 |             if (badge) {
85c5b72 1342 |               badge.translationX = 0;
85c5b72 1343 |               badge.translationY = 0;
85c5b72 1344 |             }

// --- Lines 1346–1346 ---
85c5b72 1346 |             console.error('d2da: bounceIcon reset frame', err);

// --- Lines 1359–1359 ---
85c5b72 1359 |             console.error('d2da: bounceIcon end frame', err);

```

<a id="appscalendarjs"></a>
### `apps/calendar.js` (+6 lines across 2 hunks)

```javascript
// --- Lines 12–14 ---
76846c1   12 |       super._init({
76846c1   13 |         name: 'd2daCalendar',
76846c1   14 |       });

// --- Lines 41–43 ---
76846c1   41 |       super._init({
76846c1   42 |         name: 'd2daCalendarCanvas',
76846c1   43 |       });

```

<a id="appsclockjs"></a>
### `apps/clock.js` (+6 lines across 2 hunks)

```javascript
// --- Lines 129–131 ---
76846c1  129 |       super._init({
76846c1  130 |         name: 'd2daClock',
76846c1  131 |       });

// --- Lines 157–159 ---
76846c1  157 |       super._init({
76846c1  158 |         name: 'd2daClockCanvas',
76846c1  159 |       });

```

<a id="appsdotjs"></a>
### `apps/dot.js` (+6 lines across 2 hunks)

```javascript
// --- Lines 15–17 ---
76846c1   15 |       super._init({
76846c1   16 |         name: 'd2daDot',
76846c1   17 |       });

// --- Lines 40–42 ---
76846c1   40 |       super._init({
76846c1   41 |         name: 'd2daDotCanvas',
76846c1   42 |       });

```

<a id="appsoverlayjs"></a>
### `apps/overlay.js` (+3 lines across 1 hunks)

```javascript
// --- Lines 14–16 ---
76846c1   14 |       super._init({
76846c1   15 |         name: 'd2daDebugOverlay',
76846c1   16 |       });

```

<a id="autohidejs"></a>
### `autohide.js` (+31 lines across 9 hunks)

```javascript
// --- Lines 16–18 ---
dda62a5   16 | // Dodge regular windows and their dialogs/tool palettes. DOCK, TOOLBAR, MENU
dda62a5   17 | // and SPLASHSCREEN stay excluded: they are panels, transient popups or
dda62a5   18 | // short-lived, and must not make the dock hide.

// --- Lines 41–44 ---
c84f252   41 |     // _debounceCheckHide() also runs while autohide is off, so always drop it
c84f252   42 |     this.extension._loTimer?.cancel(this._debounceCheckSeq);
c84f252   43 |     this._debounceCheckSeq = null;
c84f252   44 | 

// --- Lines 49–49 ---
c84f252   49 |     this._animationSeq = null;

// --- Lines 106–115 ---
dda62a5  106 |         if (
dda62a5  107 |           // bottom
dda62a5  108 |           (this.dock._position == DockPosition.BOTTOM &&
dda62a5  109 |             dx < area &&
dda62a5  110 |             pointer[1] + 4 > monitor.y + sh) ||
dda62a5  111 |           // top
dda62a5  112 |           (this.dock._position == DockPosition.TOP &&
dda62a5  113 |             dx < area &&
dda62a5  114 |             pointer[1] - 4 < monitor.y)
dda62a5  115 |         ) {

// --- Lines 189–191 ---
dda62a5  189 |     // Only a shown dock is kept up by the pointer (_isWithinDash is false while
dda62a5  190 |     // hidden); a hidden dock is revealed solely through the dwell edge strip.
dda62a5  191 |     if (this.dock._isWithinDash(pointer)) {

// --- Lines 209–209 ---
deb31fb  209 |     let windows = actors.map((a) => a.get_meta_window());

// --- Lines 214–215 ---
dda62a5  214 |     // get_workspace() returns the active workspace for sticky windows, but may be
dda62a5  215 |     // null for a window that is still being managed or is being unmanaged

// --- Lines 218–223 ---
dda62a5  218 |         (w.is_on_all_workspaces() ||
dda62a5  219 |           w.get_workspace()?.index() === workspace) &&
dda62a5  220 |         w.showing_on_its_workspace()
dda62a5  221 |     );
dda62a5  222 |     windows = windows.filter((w) =>
dda62a5  223 |       handledWindowTypes.includes(w.get_window_type())

// --- Lines 232–232 ---
deb31fb  232 |       this.extension.windowTracker?.track(w);

```

<a id="compatjs"></a>
### `compat.js` (+363 lines across 1 hunks)

```javascript
// --- Lines 1–363 ---
d94c310    1 | 'use strict';
d94c310    2 | 
d94c310    3 | let St = null;
d94c310    4 | try {
d94c310    5 |   St = (await import('gi://St')).default;
d94c310    6 | } catch {
d94c310    7 |   // St not available in standalone mock environments
d94c310    8 | }
d94c310    9 | 
d94c310   10 | /**
d94c310   11 |  * Robustly resolve application IDs from the Shell's AppFavorites manager.
d94c310   12 |  * Prefers the public getFavorites() API (returning Shell.App instances) and
d94c310   13 |  * getFavoriteMap() before falling back to private _getIds().
d94c310   14 |  *
d94c310   15 |  * @param {object} favManager Shell AppFavorites instance
d94c310   16 |  * @returns {string[]} Array of app ID strings (e.g. ['org.gnome.Nautilus.desktop'])
d94c310   17 |  */
d94c310   18 | export function getFavoriteAppIds(favManager) {
d94c310   19 |   if (!favManager) return [];
d94c310   20 |   if (typeof favManager.getFavorites === 'function') {
d94c310   21 |     try {
d94c310   22 |       const apps = favManager.getFavorites();
d94c310   23 |       if (Array.isArray(apps)) {
d94c310   24 |         return apps
d94c310   25 |           .map((a) => (typeof a?.get_id === 'function' ? a.get_id() : a?.id ?? ''))
d94c310   26 |           .filter(Boolean);
d94c310   27 |       }
d94c310   28 |     } catch (e) {
d94c310   29 |       console.error('d2da: compat getFavorites', e);
d94c310   30 |     }
d94c310   31 |   }
d94c310   32 |   if (typeof favManager.getFavoriteMap === 'function') {
d94c310   33 |     try {
d94c310   34 |       const map = favManager.getFavoriteMap();
d94c310   35 |       if (map && typeof map === 'object') {
d94c310   36 |         return Object.keys(map);
d94c310   37 |       }
d94c310   38 |     } catch (e) {
d94c310   39 |       console.error('d2da: compat getFavoriteMap', e);
d94c310   40 |     }
d94c310   41 |   }
d94c310   42 |   if (typeof favManager._getIds === 'function') {
d94c310   43 |     try {
d94c310   44 |       return favManager._getIds();
d94c310   45 |     } catch (e) {
d94c310   46 |       console.error('d2da: compat _getIds fallback', e);
d94c310   47 |     }
d94c310   48 |   }
d94c310   49 |   return [];
d94c310   50 | }
d94c310   51 | 
d94c310   52 | /**
d94c310   53 |  * Check whether an application ID is in favorites.
d94c310   54 |  *
d94c310   55 |  * @param {object} favManager Shell AppFavorites instance
d94c310   56 |  * @param {string} appId Desktop ID string
d94c310   57 |  * @returns {boolean}
d94c310   58 |  */
d94c310   59 | export function isFavoriteApp(favManager, appId) {
d94c310   60 |   if (!favManager || !appId) return false;
d94c310   61 |   if (typeof favManager.isFavorite === 'function') {
d94c310   62 |     try {
d94c310   63 |       return favManager.isFavorite(appId);
d94c310   64 |     } catch {
d94c310   65 |       // fallback to list check
d94c310   66 |     }
d94c310   67 |   }
d94c310   68 |   return getFavoriteAppIds(favManager).includes(appId);
d94c310   69 | }
d94c310   70 | 
d94c310   71 | /**
d94c310   72 |  * Safely resolve an application ID from an appwell (DashIcon / AppIcon).
d94c310   73 |  * Prefers public getId() and app.get_id() over private _id.
d94c310   74 |  *
d94c310   75 |  * @param {object} appwell DashIcon or AppIcon actor/instance
d94c310   76 |  * @returns {string} Application ID string or empty string
d94c310   77 |  */
d94c310   78 | export function getAppId(appwell) {
d94c310   79 |   if (!appwell) return '';
d94c310   80 |   if (typeof appwell.getId === 'function') {
d94c310   81 |     try {
d94c310   82 |       const id = appwell.getId();
d94c310   83 |       if (id) return id;
d94c310   84 |     } catch {
d94c310   85 |       // ignore
d94c310   86 |     }
d94c310   87 |   }
d94c310   88 |   if (appwell.app && typeof appwell.app.get_id === 'function') {
d94c310   89 |     try {
d94c310   90 |       const id = appwell.app.get_id();
d94c310   91 |       if (id) return id;
d94c310   92 |     } catch {
d94c310   93 |       // ignore
d94c310   94 |     }
d94c310   95 |   }
d94c310   96 |   if (appwell.id) return appwell.id;
d94c310   97 |   if (appwell._id) return appwell._id;
d94c310   98 |   return '';
d94c310   99 | }
d94c310  100 | 
d94c310  101 | /**
d94c310  102 |  * Robustly extract the St.Icon from a DashIcon/AppIcon or ShowAppsIcon instance.
d94c310  103 |  * Supports GNOME 50 (_iconBin.child), GNOME 46 (icon.icon), direct St.Icon, and
d94c310  104 |  * lazy texture creation (_createIconTexture).
d94c310  105 |  *
d94c310  106 |  * @param {object} appwell DashIcon/AppIcon or ShowAppsIcon
d94c310  107 |  * @returns {object|null} St.Icon instance or null
d94c310  108 |  */
d94c310  109 | export function getStIcon(appwell) {
d94c310  110 |   if (!appwell || !appwell.icon) return null;
d94c310  111 |   const baseIcon = appwell.icon;
d94c310  112 | 
d94c310  113 |   if (St?.Icon && baseIcon instanceof St.Icon) return baseIcon;
d94c310  114 |   if (baseIcon.isStIcon) return baseIcon;
d94c310  115 | 
d94c310  116 |   // GNOME 46 / setIconSize initialized: direct .icon property
d94c310  117 |   if (baseIcon.icon) return baseIcon.icon;
d94c310  118 | 
d94c310  119 |   // GNOME 50: _iconBin.child
d94c310  120 |   if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;
d94c310  121 | 
d94c310  122 |   // Force icon creation if not yet initialized
d94c310  123 |   try {
d94c310  124 |     if (typeof baseIcon.setIconSize === 'function') {
d94c310  125 |       const size =
d94c310  126 |         typeof baseIcon.iconSize === 'number' && baseIcon.iconSize > 0
d94c310  127 |           ? baseIcon.iconSize
d94c310  128 |           : 48;
d94c310  129 |       baseIcon._createIconTexture(size);
d94c310  130 |       if (baseIcon.icon) return baseIcon.icon;
d94c310  131 |       if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;
d94c310  132 |     }
d94c310  133 |   } catch {
d94c310  134 |     // ignore initialization errors
d94c310  135 |   }
d94c310  136 | 
d94c310  137 |   return null;
d94c310  138 | }
d94c310  139 | 
d94c310  140 | /**
d94c310  141 |  * Safely toggle or open the overview applications page.
d94c310  142 |  * Uses public Main.overview methods instead of walking Main.uiGroup.
d94c310  143 |  *
d94c310  144 |  * @param {object} overview Main.overview instance
d94c310  145 |  */
d94c310  146 | export function showOverviewApps(overview) {
d94c310  147 |   if (!overview) return;
d94c310  148 |   try {
d94c310  149 |     if (overview.visible) {
d94c310  150 |       overview.toggle();
d94c310  151 |     } else if (typeof overview.showApps === 'function') {
d94c310  152 |       overview.showApps();
d94c310  153 |     } else if (typeof overview.toggle === 'function') {
d94c310  154 |       overview.toggle();
d94c310  155 |     }
d94c310  156 |   } catch (e) {
d94c310  157 |     console.error('d2da: compat showOverviewApps', e);
d94c310  158 |   }
d94c310  159 | }
d94c310  160 | 
d94c310  161 | /**
d94c310  162 |  * Feature-detect and trigger window maximize across Mutter versions.
d94c310  163 |  * In modern Mutter (GNOME 49+), flags were dropped and maximize takes 0 args.
d94c310  164 |  * In older Mutter, maximize expects Meta.MaximizeFlags.BOTH (3).
d94c310  165 |  *
d94c310  166 |  * @param {object} win Meta.Window instance
d94c310  167 |  */
d94c310  168 | export function maximizeWindow(win) {
d94c310  169 |   if (!win || typeof win.maximize !== 'function') return;
d94c310  170 |   try {
d94c310  171 |     if (win.maximize.length === 0) {
d94c310  172 |       win.maximize();
d94c310  173 |     } else {
d94c310  174 |       win.maximize(3);
d94c310  175 |     }
d94c310  176 |   } catch (e) {
d94c310  177 |     console.error('d2da: compat maximizeWindow', e);
d94c310  178 |   }
d94c310  179 | }
d94c310  180 | 
d94c310  181 | /**
d94c310  182 |  * Feature-detect and trigger window unmaximize across Mutter versions.
d94c310  183 |  *
d94c310  184 |  * @param {object} win Meta.Window instance
d94c310  185 |  */
d94c310  186 | export function unmaximizeWindow(win) {
d94c310  187 |   if (!win || typeof win.unmaximize !== 'function') return;
d94c310  188 |   try {
d94c310  189 |     if (win.unmaximize.length === 0) {
d94c310  190 |       win.unmaximize();
d94c310  191 |     } else {
d94c310  192 |       win.unmaximize(3);
d94c310  193 |     }
d94c310  194 |   } catch (e) {
d94c310  195 |     console.error('d2da: compat unmaximizeWindow', e);
d94c310  196 |   }
d94c310  197 | }
f56a070  198 | 
f56a070  199 | /**
f56a070  200 |  * Safely retrieve the inner icons box of a Shell Dash actor.
f56a070  201 |  *
f56a070  202 |  * @param {object} dash Shell Dash instance
f56a070  203 |  * @returns {object|null}
f56a070  204 |  */
f56a070  205 | export function getDashBox(dash) {
f56a070  206 |   if (!dash) return null;
f56a070  207 |   return dash._box ?? dash._dashContainer?._box ?? null;
f56a070  208 | }
f56a070  209 | 
f56a070  210 | /**
f56a070  211 |  * Safely retrieve the container holding the icons box and showApps button.
f56a070  212 |  *
f56a070  213 |  * @param {object} dash Shell Dash instance
f56a070  214 |  * @returns {object|null}
f56a070  215 |  */
f56a070  216 | export function getDashContainer(dash) {
f56a070  217 |   if (!dash) return null;
f56a070  218 |   return dash._dashContainer ?? dash.last_child ?? null;
f56a070  219 | }
f56a070  220 | 
f56a070  221 | /**
f56a070  222 |  * Safely retrieve the showAppsIcon of a Shell Dash actor.
f56a070  223 |  *
f56a070  224 |  * @param {object} dash Shell Dash instance
f56a070  225 |  * @returns {object|null}
f56a070  226 |  */
f56a070  227 | export function getDashShowAppsIcon(dash) {
f56a070  228 |   if (!dash) return null;
f56a070  229 |   return dash._showAppsIcon ?? null;
f56a070  230 | }
f56a070  231 | 
f56a070  232 | /**
f56a070  233 |  * Safely retrieve the background actor of a Shell Dash actor.
f56a070  234 |  *
f56a070  235 |  * @param {object} dash Shell Dash instance
f56a070  236 |  * @returns {object|null}
f56a070  237 |  */
f56a070  238 | export function getDashBackground(dash) {
f56a070  239 |   if (!dash) return null;
f56a070  240 |   return dash._background ?? null;
f56a070  241 | }
f56a070  242 | 
f56a070  243 | /**
f56a070  244 |  * Configure a Shell Dash instance for proxy rendering by d2da.
f56a070  245 |  * Neutralizes internal icon resizing and makes real app items invisible.
f56a070  246 |  *
f56a070  247 |  * @param {object} dash Shell Dash instance
f56a070  248 |  */
f56a070  249 | export function setupDashProxy(dash) {
f56a070  250 |   if (!dash) return;
f56a070  251 |   try {
f56a070  252 |     dash._adjustIconSize = () => {};
f56a070  253 |     const origCreateAppItem = dash._createAppItem;
f56a070  254 |     if (typeof origCreateAppItem === 'function') {
f56a070  255 |       dash._createAppItem = function (app) {
f56a070  256 |         const item = origCreateAppItem.call(this, app);
f56a070  257 |         this.opacity = 0;
f56a070  258 |         if (item?.child) {
f56a070  259 |           item.child.visible = false;
f56a070  260 |         }
f56a070  261 |         return item;
f56a070  262 |       };
f56a070  263 |     }
f56a070  264 |   } catch (e) {
f56a070  265 |     console.error('d2da: compat setupDashProxy', e);
f56a070  266 |   }
f56a070  267 | }
f56a070  268 | 
f56a070  269 | /**
f56a070  270 |  * Safely update orientation on a Shell Dash's container and box.
f56a070  271 |  *
f56a070  272 |  * @param {object} dash Shell Dash instance
f56a070  273 |  * @param {number} orientation Clutter.Orientation or boolean
f56a070  274 |  */
f56a070  275 | export function setDashOrientation(dash, orientation) {
f56a070  276 |   if (!dash) return;
f56a070  277 |   try {
d9bc04e  278 |     let orient = orientation;
d9bc04e  279 |     if (typeof orientation === 'boolean') {
d9bc04e  280 |       orient = orientation ? 1 : 0;
d9bc04e  281 |     }
f56a070  282 |     const container = getDashContainer(dash);
f56a070  283 |     if (container?.layout_manager) {
d9bc04e  284 |       container.layout_manager.orientation = orient;
f56a070  285 |     }
f56a070  286 |     const box = getDashBox(dash);
f56a070  287 |     if (box?.layout_manager) {
d9bc04e  288 |       box.layout_manager.orientation = orient;
f56a070  289 |     }
f56a070  290 |   } catch (e) {
f56a070  291 |     console.error('d2da: compat setDashOrientation', e);
f56a070  292 |   }
f56a070  293 | }
f56a070  294 | 
f56a070  295 | /**
f56a070  296 |  * Safely update text direction on a Shell Dash's container and box.
f56a070  297 |  *
f56a070  298 |  * @param {object} dash Shell Dash instance
f56a070  299 |  * @param {boolean} isRtl
f56a070  300 |  */
f56a070  301 | export function setDashLayoutDirection(dash, isRtl) {
f56a070  302 |   if (!dash) return;
f56a070  303 |   try {
f56a070  304 |     const container = getDashContainer(dash);
f56a070  305 |     if (container) {
f56a070  306 |       container.text_direction = isRtl ? 2 : 1;
f56a070  307 |     }
f56a070  308 |     const box = getDashBox(dash);
f56a070  309 |     if (box) {
f56a070  310 |       box.text_direction = 1; // icons layout stays LTR
f56a070  311 |     }
f56a070  312 |   } catch (e) {
f56a070  313 |     console.error('d2da: compat setDashLayoutDirection', e);
f56a070  314 |   }
f56a070  315 | }
f56a070  316 | 
f56a070  317 | /**
f56a070  318 |  * Controls visibility and opacity of the stock overview dash.
f56a070  319 |  * Eliminates the legacy __box expando.
f56a070  320 |  *
f56a070  321 |  * @param {object} overviewDash Main.overview.dash instance
f56a070  322 |  * @param {boolean} show whether to show or hide the overview dash
f56a070  323 |  * @param {object|null} state reference to persistent state tracker { hiddenChild: null }
f56a070  324 |  */
f56a070  325 | export function setOverviewDashVisibility(overviewDash, show, state = null) {
f56a070  326 |   if (!overviewDash) return;
f56a070  327 |   try {
f56a070  328 |     overviewDash.opacity = show ? 255 : 0;
f56a070  329 |     const bg = getDashBackground(overviewDash);
f56a070  330 |     if (bg) {
f56a070  331 |       bg.style = show ? '' : 'background: transparent !important;';
f56a070  332 |     }
f56a070  333 | 
f56a070  334 |     const box = getDashBox(overviewDash);
f56a070  335 |     if (box && typeof box.get_children === 'function') {
f56a070  336 |       box.get_children().forEach((c) => {
f56a070  337 |         c.opacity = show ? 255 : 0;
f56a070  338 |         c.visible = show;
f56a070  339 |         if (c.child) {
f56a070  340 |           c.child.reactive = show;
f56a070  341 |           c.child.track_hover = show;
f56a070  342 |         }
f56a070  343 |       });
f56a070  344 |     }
f56a070  345 | 
f56a070  346 |     const showApps = getDashShowAppsIcon(overviewDash);
f56a070  347 |     if (showApps) {
f56a070  348 |       showApps.opacity = show ? 255 : 0;
f56a070  349 |       if (showApps.child) {
f56a070  350 |         showApps.child.reactive = show;
f56a070  351 |         showApps.child.track_hover = show;
f56a070  352 |       }
f56a070  353 |     }
f56a070  354 | 
f56a070  355 |     if (show && state && state.hiddenChild) {
f56a070  356 |       state.hiddenChild.visible = true;
f56a070  357 |       state.hiddenChild = null;
f56a070  358 |     }
f56a070  359 |   } catch (e) {
f56a070  360 |     console.error('d2da: compat setOverviewDashVisibility', e);
f56a070  361 |   }
f56a070  362 | }
f56a070  363 | 

```

<a id="dockjs"></a>
### `dock.js` (+511 lines across 116 hunks)

```javascript
// --- Lines 5–5 ---
d94c310    5 | import * as Compat from './compat.js';

// --- Lines 22–22 ---
523cec2   22 | import { live } from './probe.js';

// --- Lines 28–28 ---
4b343d1   28 |   getDownloadsDir,

// --- Lines 71–72 ---
523cec2   71 |       live('dock', 1);
523cec2   72 |       this.connect('destroy', () => live('dock', -1));

// --- Lines 76–76 ---
37f059d   76 |       this._needsLayout = true;

// --- Lines 83–83 ---
c91723f   83 |         // connect: () => false,

// --- Lines 95–95 ---
d1b58fb   95 |       this.fake_dash.has_allocation = () => { return true; };

// --- Lines 98–98 ---
76846c1   98 |         name: 'd2daFakeDashBackground',

// --- Lines 101–102 ---
c91723f  101 |       this.fake_dash.connect = () => false;
c91723f  102 |       this.fake_dash_background.connect = () => false;

// --- Lines 112–113 ---
8bc06d9  112 |         x_expand: true,
8bc06d9  113 |         y_expand: true,

// --- Lines 116–116 ---
8341bf0  116 | 

// --- Lines 152–180 ---
ff484c9  152 | 
ff484c9  153 |       this.add_child(this.createDash());
c334333  154 |     }
c334333  155 | 
d95bb11  156 |     destroy() {
d95bb11  157 |       if (!this._destroyed) {
d95bb11  158 |         this._destroyed = true;
d95bb11  159 |         this.undock();
d95bb11  160 |         this.cancelAnimations();
d95bb11  161 |         this.destroyDash();
d95bb11  162 | 
d95bb11  163 |         // before super.destroy() takes renderArea with it
d95bb11  164 |         this.animator.destroy();
d95bb11  165 |         this.animator = null;
d95bb11  166 | 
d95bb11  167 |         this.autohider.disable();
d95bb11  168 |         this.autohider.dock = null;
d95bb11  169 |         this.autohider.extension = null;
d95bb11  170 |         this.autohider = null;
d95bb11  171 | 
d95bb11  172 |         // struts and dwell are chrome actors, not children
d95bb11  173 |         this.dwell.disconnectObject(this);
d95bb11  174 |         this.struts.destroy();
d95bb11  175 |         this.dwell.destroy();
d95bb11  176 |         this.struts = null;
d95bb11  177 |         this.dwell = null;
d95bb11  178 |         this._slider = null;
d95bb11  179 |       }
d95bb11  180 |       super.destroy();

// --- Lines 185–196 ---
d95bb11  185 |         // the list may point at a downloads item that goes with the dash
d95bb11  186 |         this._destroyList();
d95bb11  187 | 
d95bb11  188 |         // every item, also those _findIcons() skips (hidden non-favorites)
f56a070  189 |         let box = Compat.getDashBox(this.dash);
d95bb11  190 |         [
f56a070  191 |           ...(box?.get_children() ?? []),
d95bb11  192 |           ...(this._extraIcons?.get_children() ?? []),
f56a070  193 |           Compat.getDashShowAppsIcon(this.dash),
d95bb11  194 |         ].forEach((c) => {
d95bb11  195 |           if (c) this._cleanupIcon(c);
d95bb11  196 |         });

// --- Lines 198–200 ---
d95bb11  198 |         // Shell's Dash disconnects its AppSystem/AppFavorites/overview
d95bb11  199 |         // handlers (connectObject) and its ctrl-alt-tab group on destroy
d95bb11  200 |         this.dash.destroy();

// --- Lines 202–211 ---
d95bb11  202 |         this._extraIcons = null;
d95bb11  203 |         this._separator = null;
d95bb11  204 |         this._icons = null;
d95bb11  205 |         this._dashItems = [];
d95bb11  206 |         this._separators = [];
d95bb11  207 |         this._hoveredIcon = null;
d95bb11  208 |         this._lastHoveredIcon = null;
d95bb11  209 |         this._nearestIcon = null;
d95bb11  210 |         this._dragged = null;
d95bb11  211 |         this._dragging = false;

// --- Lines 227–228 ---
37f059d  227 |       this._needsLayout = true;
37f059d  228 |       this.relayout(true);

// --- Lines 232–242 ---
ab2d9b2  232 |     createItem(appOrPath, id) {
1553b9d  233 |       let params = {};
1553b9d  234 |       if (typeof appOrPath === 'string') {
1553b9d  235 |         params.appinfo_filename = appOrPath;
1553b9d  236 |       } else if (appOrPath) {
1553b9d  237 |         params.app = appOrPath;
1553b9d  238 |       }
ab2d9b2  239 |       if (id) {
ab2d9b2  240 |         params.id = id;
ab2d9b2  241 |       }
1553b9d  242 |       let item = new DockItemContainer(params);

// --- Lines 244–248 ---
1553b9d  244 |       if (item._menu) {
1553b9d  245 |         item._menu._onActivate = () => {
1553b9d  246 |           this._maybeBounce(item);
1553b9d  247 |         };
1553b9d  248 |       }

// --- Lines 259–259 ---
37f059d  259 |       this.relayout(true);

// --- Lines 266–266 ---
1b03ca7  266 |       this._removeIconEffect();

// --- Lines 270–312 ---
c84f252  270 | 
c84f252  271 |       // autohider.disable() -> show() -> slideIn() may re-arm these
c84f252  272 |       this.extension._hiTimer?.cancel(this._animationSeq);
c84f252  273 |       this.extension._loTimer?.cancel(this.debounceEndSeq);
c84f252  274 |       this.extension._loTimer?.cancel(this._debounceBeginAnimateSeq);
c84f252  275 |       this._animationSeq = null;
c84f252  276 |       this.debounceEndSeq = null;
c84f252  277 |       this._debounceBeginAnimateSeq = null;
c91eb2e  278 |     }
c91eb2e  279 | 
cf2a5dd  280 |     activateTargetIcon(target, button = 1) {
cf2a5dd  281 |       if (!target) return false;
cf2a5dd  282 |       let showAppsIcon = Compat.getDashShowAppsIcon(this.dash);
cf2a5dd  283 |       if (showAppsIcon && target === showAppsIcon) {
cf2a5dd  284 |         Compat.showOverviewApps(Main.overview);
cf2a5dd  285 |         return true;
cf2a5dd  286 |       }
cf2a5dd  287 |       if (target._onClick) {
cf2a5dd  288 |         let now = Date.now();
cf2a5dd  289 |         if (!target._lastClickTime || now - target._lastClickTime > 1000) {
cf2a5dd  290 |           target._lastClickTime = now;
cf2a5dd  291 |           target._onClick();
cf2a5dd  292 |         }
cf2a5dd  293 |         return true;
cf2a5dd  294 |       }
cf2a5dd  295 |       if (target._appwell) {
cf2a5dd  296 |         let now = Date.now();
cf2a5dd  297 |         if (target._lastAppwellClickTime && now - target._lastAppwellClickTime < 500) {
cf2a5dd  298 |           return true;
cf2a5dd  299 |         }
cf2a5dd  300 |         target._lastAppwellClickTime = now;
cf2a5dd  301 |         if (!target._menu) {
cf2a5dd  302 |           this._maybeBounce(target);
cf2a5dd  303 |         }
cf2a5dd  304 |         this._maybeMinimizeOrMaximize(target._appwell.app, button);
cf2a5dd  305 |         if (target._appwell._activate) {
cf2a5dd  306 |           target._appwell._activate(button);
cf2a5dd  307 |         } else if (target._appwell.activate) {
cf2a5dd  308 |           target._appwell.activate(button);
cf2a5dd  309 |         }
cf2a5dd  310 |         return true;
cf2a5dd  311 |       }
cf2a5dd  312 |       return false;

// --- Lines 339–339 ---
c91723f  339 |       this.dash.opacity = 255;

// --- Lines 375–375 ---
d94c310  375 |       this._favorite_ids = Compat.getFavoriteAppIds(Fav.getAppFavorites());

// --- Lines 377–377 ---
37f059d  377 |       this._needsLayout = true;

// --- Lines 384–387 ---
37f059d  384 |     _onMonitorsChanged() {
37f059d  385 |       this._needsLayout = true;
37f059d  386 |       this.relayout();
37f059d  387 |     }

// --- Lines 436–443 ---
1b03ca7  436 |     _removeIconEffect() {
1b03ca7  437 |       this._effectTargets().forEach((target) => {
1b03ca7  438 |         if (!target) return;
1b03ca7  439 |         target.remove_effect_by_name('icon-effect');
1b03ca7  440 |         target.iconEffect = null;
1b03ca7  441 |       });
1b03ca7  442 |     }
1b03ca7  443 | 

// --- Lines 491–492 ---
523cec2  491 |       live('dash', 1);
523cec2  492 |       dash.connect('destroy', () => live('dash', -1));

// --- Lines 494–494 ---
f56a070  494 |       Compat.setupDashProxy(dash);

// --- Lines 497–520 ---
f56a070  497 |       let dashBg = Compat.getDashBackground(this.dash);
f56a070  498 |       if (dashBg) {
f56a070  499 |         dashBg.visible = false;
f56a070  500 |         if (dashBg.first_child && !dashBg.first_child.name) {
f56a070  501 |           dashBg.first_child.name = 'd2daDashSizerBox';
f56a070  502 |         }
f56a070  503 |       }
f56a070  504 |       let dashBox = Compat.getDashBox(this.dash);
f56a070  505 |       if (dashBox) {
f56a070  506 |         dashBox.clip_to_allocation = false;
ab2d9b2  507 |         dashBox.connectObject(
ab2d9b2  508 |           'child-added', () => {
ab2d9b2  509 |             this._icons = null;
ab2d9b2  510 |             this._needsLayout = true;
ab2d9b2  511 |             this._beginAnimation();
ab2d9b2  512 |           },
ab2d9b2  513 |           'child-removed', () => {
ab2d9b2  514 |             this._icons = null;
ab2d9b2  515 |             this._needsLayout = true;
ab2d9b2  516 |             this._beginAnimation();
ab2d9b2  517 |           },
ab2d9b2  518 |           this
ab2d9b2  519 |         );
76846c1  520 |       }

// --- Lines 522–540 ---
76846c1  522 |       this._extraIcons = new St.BoxLayout({
76846c1  523 |         name: 'd2daExtraIcons',
76846c1  524 |       });
ab2d9b2  525 |       this._extraIcons.connectObject(
ab2d9b2  526 |         'child-added', () => {
ab2d9b2  527 |           this._icons = null;
ab2d9b2  528 |           this._needsLayout = true;
ab2d9b2  529 |           this._beginAnimation();
ab2d9b2  530 |         },
ab2d9b2  531 |         'child-removed', () => {
ab2d9b2  532 |           this._icons = null;
ab2d9b2  533 |           this._needsLayout = true;
ab2d9b2  534 |           this._beginAnimation();
ab2d9b2  535 |         },
ab2d9b2  536 |         this
ab2d9b2  537 |       );
f56a070  538 |       if (dashBox) {
f56a070  539 |         dashBox.add_child(this._extraIcons);
f56a070  540 |       }

// --- Lines 546–546 ---
76846c1  546 |         name: 'd2daSeparator',

// --- Lines 610–610 ---
1b03ca7  610 |       this._removeIconEffect();

// --- Lines 620–623 ---
f1b1f94  620 |     // Pure function of settings + monitor scale: same inputs, same output,
f1b1f94  621 |     // no matter whether relayout() already ran or the dash is populated.
f1b1f94  622 |     // (Before, an unset _scaleFactor made upscale NaN -> 1, so callers
f1b1f94  623 |     // running ahead of relayout() got half the size of later calls.)

// --- Lines 634–639 ---
f1b1f94  634 |       let scaleFactor =
f1b1f94  635 |         this._scaleFactor ||
f1b1f94  636 |         this._monitor?.geometry_scale ||
f1b1f94  637 |         this.getMonitor()?.geometry_scale ||
f1b1f94  638 |         1;
f1b1f94  639 | 

// --- Lines 641–651 ---
f1b1f94  641 |       // does scaleFactor go beyond 2x? never below 1
f1b1f94  642 |       let upscale = Math.max(1, 1 + (2 - scaleFactor));
f1b1f94  643 | 
f1b1f94  644 |       // icon_size == 1.0 used to index past the end and fall back to 64
f1b1f94  645 |       let idx = Math.floor((this.extension.icon_size || 0) * preferredIconSizes.length);
f1b1f94  646 |       idx = Math.min(preferredIconSizes.length - 1, Math.max(0, idx));
f1b1f94  647 | 
f1b1f94  648 |       let iconSize = upscale * (preferredIconSizes[idx] || 64);
f1b1f94  649 |       iconSize *= this.extension.scale || 1;
f1b1f94  650 | 
f1b1f94  651 |       if (this.extension._config?.icon_size) {

// --- Lines 658–685 ---
f1b1f94  658 |     // Number of items the dock is sized for. App items come from the app
f1b1f94  659 |     // model (what the Shell Dash _redisplay() will show), not from the actors
f1b1f94  660 |     // present right now - so the size does not depend on when the Dash
f1b1f94  661 |     // populates, or on items still animating out. Non-app items (extra
f1b1f94  662 |     // icons, showApps) are ours and created synchronously.
f1b1f94  663 |     _layoutIconCount() {
f1b1f94  664 |       let icons = this._icons ?? [];
f1b1f94  665 |       let dashBox = Compat.getDashBox(this.dash);
f1b1f94  666 |       let others = icons.filter(
f1b1f94  667 |         (c) => !(c._appwell && c.get_parent?.() === dashBox)
f1b1f94  668 |       ).length;
f1b1f94  669 | 
f1b1f94  670 |       let apps = 0;
f1b1f94  671 |       try {
f1b1f94  672 |         let favorites = Fav.getAppFavorites().getFavoriteMap();
f1b1f94  673 |         apps = Object.keys(favorites).length;
f1b1f94  674 |         if (!this.extension.favorites_only) {
f1b1f94  675 |           apps += Shell.AppSystem.get_default()
f1b1f94  676 |             .get_running()
f1b1f94  677 |             .filter((app) => !(app.get_id() in favorites)).length;
f1b1f94  678 |         }
f1b1f94  679 |       } catch {
f1b1f94  680 |         // fall back to the actors found
f1b1f94  681 |         return icons.length;
f1b1f94  682 |       }
f1b1f94  683 |       return apps + others;
f1b1f94  684 |     }
f1b1f94  685 | 

// --- Lines 704–704 ---
d94c310  704 |       return Compat.getStIcon(appwell);

// --- Lines 706–706 ---
e5695b0  706 | 

// --- Lines 710–718 ---
f1b1f94  710 |       // being removed by the Shell Dash (eases scale to 0, then destroys);
f1b1f94  711 |       // collapse it now so layout already matches the final state
f1b1f94  712 |       if (c.animatingOut) {
f1b1f94  713 |         c.width = 0;
f1b1f94  714 |         c.height = 0;
f1b1f94  715 |         c.style = '';
f1b1f94  716 |         return false;
f1b1f94  717 |       }
f1b1f94  718 | 

// --- Lines 723–723 ---
37f059d  723 |           this._needsLayout = true;

// --- Lines 727–730 ---
85c5b72  727 |           c._renderer = null;
85c5b72  728 |           c._badge = null;
85c5b72  729 |           c._dots = null;
dd98d4a  730 |           c._showLabel = null;

// --- Lines 744–744 ---
d94c310  744 |       /* ShowAppsIcon */

// --- Lines 746–746 ---
d94c310  746 |         let stIcon = Compat.getStIcon(c) ?? c.icon.icon;

// --- Lines 759–759 ---
d94c310  759 |       /* DashItemContainer */

// --- Lines 764–764 ---
d94c310  764 |           stIcon = Compat.getStIcon(appwell) ?? appwell.icon.icon;

// --- Lines 774–774 ---
d94c310  774 |             let appId = Compat.getAppId(c._appwell);

// --- Lines 797–797 ---
e5695b0  797 | 

// --- Lines 811–811 ---
f56a070  811 |           c == Compat.getDashShowAppsIcon(this.dash) &&

// --- Lines 828–841 ---
0a01a50  828 |       // clock/calendar from services.updateIcon; animator.disable() may
0a01a50  829 |       // already have unparented it, so destroy regardless of parent
0a01a50  830 |       let image = c._image;
0a01a50  831 |       if (image) {
0a01a50  832 |         c._image = null;
0a01a50  833 |         c._clock = null;
0a01a50  834 |         c._calendar = null;
0a01a50  835 |         if (this._clock === image) this._clock = null;
0a01a50  836 |         if (this._calendar === image) this._calendar = null;
0a01a50  837 |         image.destroy();
0764ce5  838 |       }
0a01a50  839 |       // DockItemContainer menu; idempotent, also run on the item's own destroy
0a01a50  840 |       c._destroyMenu?.();
0a01a50  841 |       // c._label is owned by the Shell DashItemContainer (destroyed with it)

// --- Lines 848–852 ---
85c5b72  848 |       c._renderer = null;
85c5b72  849 |       c._badge = null;
85c5b72  850 |       c._dots = null;
dd98d4a  851 |       c._showLabel = null;
37f059d  852 |       this._needsLayout = true;

// --- Lines 856–862 ---
d95bb11  856 |       if (!this.dash) {
d95bb11  857 |         this._icons = null;
d95bb11  858 |         return [];
d95bb11  859 |       }
d95bb11  860 | 
f56a070  861 |       let dashBox = Compat.getDashBox(this.dash);
f56a070  862 | 

// --- Lines 864–864 ---
f56a070  864 |         let _boxIconsLength = dashBox?.get_children().length ?? 0;

// --- Lines 867–867 ---
ab2d9b2  867 |           this._needsLayout = true;

// --- Lines 874–874 ---
ab2d9b2  874 |             this._needsLayout = true;

// --- Lines 878–883 ---
f1b1f94  878 |         // removal starts with animateOutAndDestroy(); child-removed only
f1b1f94  879 |         // fires ~200ms later on destroy
f1b1f94  880 |         if (this._icons?.some((c) => c.animatingOut)) {
f1b1f94  881 |           this._icons = null;
f1b1f94  882 |           this._needsLayout = true;
f1b1f94  883 |         }

// --- Lines 891–895 ---
f1b1f94  891 |       // favorites_only filtering in _inspectIcon needs these
f1b1f94  892 |       if (!this._favorite_ids) {
f1b1f94  893 |         this._favorite_ids = Compat.getFavoriteAppIds(Fav.getAppFavorites());
f1b1f94  894 |       }
f1b1f94  895 | 

// --- Lines 903–903 ---
f56a070  903 |       dashBox?.get_children().forEach((icon) => {

// --- Lines 912–912 ---
f56a070  912 |           dashBox?.remove_child(this._separators[0]);

// --- Lines 942–946 ---
f56a070  942 |       let showAppsIcon = Compat.getDashShowAppsIcon(this.dash);
f56a070  943 |       if (showAppsIcon) {
f56a070  944 |         showAppsIcon.visible = this.extension.apps_icon;
f56a070  945 |         if (this._inspectIcon(showAppsIcon)) {
f56a070  946 |           let icon = showAppsIcon._icon;

// --- Lines 952–958 ---
cf2a5dd  952 |                 let target =
cf2a5dd  953 |                   this.animated && (this._nearestIcon || this._hoveredIcon)
cf2a5dd  954 |                     ? this._nearestIcon || this._hoveredIcon
cf2a5dd  955 |                     : null;
cf2a5dd  956 |                 if (target && target !== showAppsIcon) {
cf2a5dd  957 |                   this.activateTargetIcon(target, 1);
a4a32b4  958 |                   return Clutter.EVENT_STOP;

// --- Lines 960–961 ---
d94c310  960 |                 Compat.showOverviewApps(Main.overview);
cf2a5dd  961 |                 return Clutter.EVENT_STOP;

// --- Lines 965–965 ---
f56a070  965 |                 showAppsIcon.showLabel();

// --- Lines 969–969 ---
f56a070  969 |                 showAppsIcon.hideLabel();

// --- Lines 991–995 ---
dd98d4a  991 |               try {
dd98d4a  992 |                 this.animator?.alignLabel(c);
dd98d4a  993 |               } catch (err) {
dd98d4a  994 |                 console.error('d2da: alignLabel on showLabel', err);
dd98d4a  995 |               }

// --- Lines 1013–1013 ---
1b03ca7 1013 |           c._appwell.activate = (button) => {

// --- Lines 1015–1021 ---
cf2a5dd 1015 |               let target =
cf2a5dd 1016 |                 this.animated && (this._nearestIcon || this._hoveredIcon)
cf2a5dd 1017 |                   ? this._nearestIcon || this._hoveredIcon
cf2a5dd 1018 |                   : c;
cf2a5dd 1019 |               this.activateTargetIcon(target, button);
1b03ca7 1020 |             } catch (e) {
1b03ca7 1021 |               console.error('d2da: appwell activate', e);

// --- Lines 1040–1040 ---
37f059d 1040 |             this._needsLayout = true;

// --- Lines 1070–1072 ---
1553b9d 1070 |         let extraMountIds = extras.map((e) => e._mountId || e._mountPath);
1553b9d 1071 |         let mountApps = this.extension.services?.mountApps || {};
1553b9d 1072 |         let mountedIds = Object.keys(mountApps);

// --- Lines 1078–1080 ---
1553b9d 1078 |           let id = extra._mountId || extra._mountPath;
1553b9d 1079 |           if (!mountedIds.includes(id)) {
d95bb11 1080 |             extra.destroy();

// --- Lines 1082–1082 ---
37f059d 1082 |             this._needsLayout = true;

// --- Lines 1086–1089 ---
1553b9d 1086 |         mountedIds.forEach((mountId) => {
1553b9d 1087 |           if (!extraMountIds.includes(mountId)) {
1553b9d 1088 |             let app = mountApps[mountId];
ab2d9b2 1089 |             let mountedIcon = this.createItem(app, mountId);

// --- Lines 1091–1092 ---
1553b9d 1091 |             mountedIcon._mountId = mountId;
1553b9d 1092 |             mountedIcon._mountPath = mountId;

// --- Lines 1094–1094 ---
37f059d 1094 |             this._needsLayout = true;

// --- Lines 1103–1106 ---
4b343d1 1103 |       const downloadsPath =
4b343d1 1104 |         this.extension.services?._downloadsDir?.get_path() ||
4b343d1 1105 |         getDownloadsDir();
4b343d1 1106 | 

// --- Lines 1127–1135 ---
4b343d1 1127 |           folder: downloadsPath,
1553b9d 1128 |           path:
1553b9d 1129 |             this.extension.services?.folderApps?.downloads ||
1553b9d 1130 |             this.extension.services?.setupFolderIcon?.(
1553b9d 1131 |               'downloads',
1553b9d 1132 |               'Downloads',
1553b9d 1133 |               'folder-downloads',
4b343d1 1134 |               downloadsPath
1553b9d 1135 |             ),

// --- Lines 1150–1150 ---
37f059d 1150 |           this._needsLayout = true;

// --- Lines 1152–1154 ---
d95bb11 1152 |           // unpin downloads icon; the list may be showing its files
d95bb11 1153 |           this._destroyList();
d95bb11 1154 |           this[f.icon].destroy();

// --- Lines 1157–1157 ---
37f059d 1157 |           this._needsLayout = true;

// --- Lines 1167–1170 ---
1553b9d 1167 |         let trashApp =
1553b9d 1168 |           this.extension.services?.trashApp ||
1553b9d 1169 |           this.extension.services?.setupTrashIcon?.();
ab2d9b2 1170 |         this._trashIcon = this.createItem(trashApp, '_trashIcon');

// --- Lines 1172–1172 ---
37f059d 1172 |         this._needsLayout = true;

// --- Lines 1175–1175 ---
d95bb11 1175 |         this._trashIcon.destroy();

// --- Lines 1178–1178 ---
37f059d 1178 |         this._needsLayout = true;

// --- Lines 1184–1184 ---
37f059d 1184 |           this._needsLayout = true;

// --- Lines 1209–1220 ---
37f059d 1209 |     relayout(force = false) {
ab2d9b2 1210 |       if (!force && !this._needsLayout && this._icons) {
37f059d 1211 |         return true;
37f059d 1212 |       }
37f059d 1213 | 
c91723f 1214 |       if (force) {
c91723f 1215 |         this._preferred = null;
c91723f 1216 |       }
c91723f 1217 | 
f56a070 1218 |       if (!this.dash || !Compat.getDashContainer(this.dash)) {
37f059d 1219 |         this._needsLayout = true;
37f059d 1220 |         return false;

// --- Lines 1222–1222 ---
f56a070 1222 |       Compat.setDashLayoutDirection(this.dash, this.extension.apps_icon_front);

// --- Lines 1243–1243 ---
37f059d 1243 |         this._needsLayout = true;

// --- Lines 1289–1291 ---
f1b1f94 1289 |       // deterministic: from the app model, not from Dash population timing
f1b1f94 1290 |       let iconCount = this._layoutIconCount();
f1b1f94 1291 | 

// --- Lines 1301–1301 ---
f1b1f94 1301 |         iconMargins = margin * 2 * iconCount;

// --- Lines 1305–1305 ---
f1b1f94 1305 |       this._iconSize = iconSize;

// --- Lines 1312–1312 ---
f1b1f94 1312 |         iconSizeSpaced * (iconCount > 3 ? iconCount : 3);

// --- Lines 1341–1341 ---
f1b1f94 1341 |       let itemSize = Math.floor(iconSizeSpaced * scaleFactor);

// --- Lines 1343–1344 ---
f1b1f94 1343 |         icon.width = itemSize;
f1b1f94 1344 |         icon.height = itemSize;

// --- Lines 1350–1373 ---
f1b1f94 1350 |       // separators must not out-grow the items: Shell's is created at its
f1b1f94 1351 |       // own iconSize (64px, never adjusted - see setupDashProxy), ours at 48px
f1b1f94 1352 |       if (!vertical) {
f1b1f94 1353 |         [...(this._separators ?? []), this._separator].forEach((sep) => {
f1b1f94 1354 |           if (!sep) return;
f1b1f94 1355 |           sep._d2daHeight ??= sep.height;
f1b1f94 1356 |           let sepHeight = Math.min(itemSize, sep._d2daHeight);
f1b1f94 1357 |           if (sep.height != sepHeight) {
f1b1f94 1358 |             sep.height = sepHeight;
f1b1f94 1359 |           }
f1b1f94 1360 |         });
f1b1f94 1361 |       }
f1b1f94 1362 | 
f1b1f94 1363 |       // The dash cross-axis size is ours, not the natural size of whatever
f1b1f94 1364 |       // the Shell Dash holds at this moment (new items request 64px until
f1b1f94 1365 |       // sized above). Keeps _snapToContainerEdge() stable.
f1b1f94 1366 |       if (vertical) {
f1b1f94 1367 |         this.dash.height = -1;
f1b1f94 1368 |         this.dash.width = itemSize;
f1b1f94 1369 |       } else {
f1b1f94 1370 |         this.dash.width = -1;
f1b1f94 1371 |         this.dash.height = itemSize;
f1b1f94 1372 |       }
f1b1f94 1373 | 

// --- Lines 1381–1381 ---
f56a070 1381 |       Compat.setDashOrientation(this.dash, vertical);

// --- Lines 1383–1393 ---
7fe412b 1383 |         if ('orientation' in this._extraIcons) {
7fe412b 1384 |           this._extraIcons.orientation = vertical
7fe412b 1385 |             ? Clutter.Orientation.VERTICAL
7fe412b 1386 |             : Clutter.Orientation.HORIZONTAL;
7fe412b 1387 |         } else if ('vertical' in this._extraIcons) {
7fe412b 1388 |           this._extraIcons.vertical = Boolean(vertical);
7fe412b 1389 |         } else if (this._extraIcons.layout_manager) {
7fe412b 1390 |           this._extraIcons.layout_manager.orientation = vertical
7fe412b 1391 |             ? Clutter.Orientation.VERTICAL
7fe412b 1392 |             : Clutter.Orientation.HORIZONTAL;
7fe412b 1393 |         }

// --- Lines 1405–1405 ---
8bc06d9 1405 |       // computation derived from animation scale, bounce travel, and edge distance

// --- Lines 1407–1420 ---
8bc06d9 1407 |       let bounceHeight = this.extension.animation_bounce_height ?? 0.75;
8bc06d9 1408 |       let bounceTravel = (iconSize / 3) * ((0.25 + bounceHeight) * 1.5);
8bc06d9 1409 |       let edgeDistance = (this.extension.edge_distance || 0) * 20;
8bc06d9 1410 |       if (this.extension.panel_mode) {
8bc06d9 1411 |         edgeDistance = 0;
8bc06d9 1412 |       }
8bc06d9 1413 | 
8bc06d9 1414 |       // Footprint must provide enough cross-axis clearance for:
8bc06d9 1415 |       // itemSize + magnification/rise expansion + bounce travel + edge distance + margin buffer
8bc06d9 1416 |       let maxMagnifyRise = iconSize * (1.2 * (1 + magnify));
8bc06d9 1417 |       let fp = iconSize + maxMagnifyRise + bounceTravel + edgeDistance + 16;
8bc06d9 1418 |       let maxFp = (vertical ? m.width : m.height) * 0.9;
8bc06d9 1419 |       fp = Math.min(fp, maxFp / scaleFactor);
8bc06d9 1420 | 

// --- Lines 1422–1422 ---
8bc06d9 1422 |         this.width = Math.round(fp * scaleFactor);

// --- Lines 1424–1424 ---
8bc06d9 1424 |         this.height = Math.round(fp * scaleFactor);

// --- Lines 1426–1426 ---
c91723f 1426 | 

// --- Lines 1430–1430 ---
c91723f 1430 | 

// --- Lines 1433–1437 ---
8bc06d9 1433 |       this.renderArea.x = 0;
8bc06d9 1434 |       this.renderArea.y = 0;
8bc06d9 1435 |       this.renderArea.width = this.width;
8bc06d9 1436 |       this.renderArea.height = this.height;
8bc06d9 1437 | 

// --- Lines 1462–1465 ---
37f059d 1462 |       this._needsLayout = false;
ab2d9b2 1463 |       if (!this._fast_forward || this._fast_forward <= 0) {
ab2d9b2 1464 |         this._fast_forward = 20;
ab2d9b2 1465 |       }

// --- Lines 1469–1476 ---
37f059d 1469 |     layout() {
37f059d 1470 |       return this.relayout(true);
37f059d 1471 |     }
37f059d 1472 | 
37f059d 1473 |     queueRelayout() {
37f059d 1474 |       this._needsLayout = true;
37f059d 1475 |     }
37f059d 1476 | 

// --- Lines 1551–1551 ---
ff484c9 1551 |       if (this._hidden || !this.struts) {

// --- Lines 1565–1566 ---
ff484c9 1565 |         this.struts?.add_style_class_name('hi');
ff484c9 1566 |         this.dwell?.add_style_class_name('hi');

// --- Lines 1569–1575 ---
d94c310 1569 |       this._favorite_ids = Compat.getFavoriteAppIds(Fav.getAppFavorites());
7fe412b 1570 |       if (!this._icons) {
7fe412b 1571 |         this._icons = this._findIcons();
ab2d9b2 1572 |         this._needsLayout = true;
7fe412b 1573 |       }
5aa405c 1574 | 
c91723f 1575 |       this._snapToContainerEdge(this, this.dash, true);

// --- Lines 1604–1605 ---
ff484c9 1604 |         this.struts?.remove_style_class_name('hi');
ff484c9 1605 |         this.dwell?.remove_style_class_name('hi');

// --- Lines 1615–1615 ---
c91723f 1615 |       // this._icons = null;

// --- Lines 1621–1625 ---
0a01a50 1621 |       // null first: DockItemList._animate calls this mid-frame and its
0a01a50 1622 |       // remaining passes bail out on a null dock._list
0a01a50 1623 |       let list = this._list;
0a01a50 1624 |       this._list = null;
0a01a50 1625 |       list?.destroy();

// --- Lines 1669–1670 ---
1b03ca7 1669 |     _maybeMinimizeOrMaximize(app, button) {
1b03ca7 1670 |       if (!app?.get_windows) {

// --- Lines 1682–1693 ---
1b03ca7 1682 |       // St.Button activates on release, whose state still holds the pressed
1b03ca7 1683 |       // button mask; prefer the button Shell passes to activate()
1b03ca7 1684 |       let eventButton = null;
1b03ca7 1685 |       if (event) {
1b03ca7 1686 |         let type = event.type();
1b03ca7 1687 |         if (
1b03ca7 1688 |           type == Clutter.EventType.BUTTON_PRESS ||
1b03ca7 1689 |           type == Clutter.EventType.BUTTON_RELEASE
1b03ca7 1690 |         ) {
1b03ca7 1691 |           eventButton = event.get_button();
1b03ca7 1692 |         }
1b03ca7 1693 |       }

// --- Lines 1695–1697 ---
1b03ca7 1695 |       let isMiddleButton =
1b03ca7 1696 |         (button ?? eventButton) == Clutter.BUTTON_MIDDLE ||
1b03ca7 1697 |         (modifiers & Clutter.ModifierType.BUTTON2_MASK) != 0;

// --- Lines 1724–1724 ---
d94c310 1724 |               Compat.unmaximizeWindow(focusedWindow);

// --- Lines 1726–1726 ---
d94c310 1726 |               Compat.maximizeWindow(focusedWindow);

// --- Lines 1910–1910 ---
1b03ca7 1910 |       if (evt.get_state() & Clutter.ModifierType.CONTROL_MASK) {

```

<a id="dockItemMenujs"></a>
### `dockItemMenu.js` (+11 lines across 6 hunks)

```javascript
// --- Lines 46–46 ---
ab2d9b2   46 |       let target = dock.createItem(f.path, f.icon);

// --- Lines 48–52 ---
8919c7a   48 |         let now = Date.now();
8919c7a   49 |         if (target._lastExecTime && now - target._lastExecTime < 1000) {
8919c7a   50 |           return;
8919c7a   51 |         }
8919c7a   52 |         target._lastExecTime = now;

// --- Lines 125–125 ---
76846c1  125 |       this._box = new St.Widget({ name: 'd2daListBox' });

// --- Lines 127–127 ---
76846c1  127 |       this._labels = new St.Widget({ name: 'd2daListLabels' });

// --- Lines 145–146 ---
76846c1  145 |         let w = new St.Widget({ name: 'd2daListItem' });
76846c1  146 |         let wl = new St.Widget({ name: 'd2daListLabelContainer' });

// --- Lines 158–158 ---
76846c1  158 |         let label = new St.Label({ name: 'd2daListLabel', style_class: 'dash-label', text: short });

```

<a id="dockItemsjs"></a>
### `dockItems.js` (+187 lines across 32 hunks)

```javascript
// --- Lines 6–7 ---
8fab2a5    6 | import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
8fab2a5    7 | import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';

// --- Lines 15–15 ---
1553b9d   15 | import GioUnix from 'gi://GioUnix';

// --- Lines 37–38 ---
8fab2a5   37 |     this.item = params.item || sourceActor;
8fab2a5   38 |     this._confirmDialog = null;

// --- Lines 51–64 ---
1553b9d   51 |     if (desktopApp.list_actions) {
1553b9d   52 |       desktopApp.list_actions().forEach((action) => {
1553b9d   53 |         let name = desktopApp.get_action_name(action);
1553b9d   54 |         this.addAction(name, () => {
1553b9d   55 |           if (action === 'trash' || name === 'Empty Trash') {
1553b9d   56 |             this._confirmEmptyTrash(desktopApp, action);
1553b9d   57 |             return;
1553b9d   58 |           }
1553b9d   59 |           let workspaceManager = global.workspace_manager;
1553b9d   60 |           let workspace = workspaceManager.get_active_workspace();
1553b9d   61 |           let ctx = global.create_app_launch_context(0, workspace);
1553b9d   62 |           desktopApp.launch_action(action, ctx);
1553b9d   63 |           this.item?.dock?.extension?.animate?.({ refresh: true });
1553b9d   64 |         });

// --- Lines 66–107 ---
1553b9d   66 |     }
e2608d1   67 |   }
e2608d1   68 | 
8fab2a5   69 |   _confirmEmptyTrash(desktopApp, action) {
8fab2a5   70 |     if (this._confirmDialog) {
8fab2a5   71 |       this._confirmDialog.open();
8fab2a5   72 |       return;
8fab2a5   73 |     }
8fab2a5   74 | 
8fab2a5   75 |     const dialog = new ModalDialog.ModalDialog();
8fab2a5   76 |     this._confirmDialog = dialog;
8fab2a5   77 | 
8fab2a5   78 |     const content = new Dialog.MessageDialogContent({
8fab2a5   79 |       title: 'Empty Trash?',
8fab2a5   80 |       description: 'All items in the Trash will be permanently deleted.',
8fab2a5   81 |     });
8fab2a5   82 |     dialog.contentLayout.add_child(content);
8fab2a5   83 | 
8fab2a5   84 |     dialog.addButton({
8fab2a5   85 |       label: 'Cancel',
8fab2a5   86 |       action: () => {
8fab2a5   87 |         dialog.close();
8fab2a5   88 |       },
8fab2a5   89 |       key: Clutter.KEY_Escape,
8fab2a5   90 |     });
8fab2a5   91 | 
8fab2a5   92 |     const emptyButton = dialog.addButton({
8fab2a5   93 |       label: 'Empty Trash',
8fab2a5   94 |       action: () => {
8fab2a5   95 |         dialog.close();
8fab2a5   96 |         const services = this.item?.dock?.extension?.services;
8fab2a5   97 |         if (services?.emptyTrash) {
8fab2a5   98 |           services.emptyTrash();
8fab2a5   99 |         } else {
8fab2a5  100 |           let workspaceManager = global.workspace_manager;
8fab2a5  101 |           let workspace = workspaceManager.get_active_workspace();
8fab2a5  102 |           let ctx = global.create_app_launch_context(0, workspace);
8fab2a5  103 |           desktopApp.launch_action(action, ctx);
8fab2a5  104 |           this.item?.dock?.extension?.animate?.({ refresh: true });
8fab2a5  105 |         }
8fab2a5  106 |       },
8fab2a5  107 |       default: true,

// --- Lines 109–119 ---
8fab2a5  109 |     emptyButton?.add_style_class_name('destructive-action');
8fab2a5  110 | 
8fab2a5  111 |     const cleanUp = () => {
8fab2a5  112 |       if (this._confirmDialog === dialog) {
8fab2a5  113 |         this._confirmDialog = null;
8fab2a5  114 |       }
8fab2a5  115 |     };
8fab2a5  116 |     dialog.connect('closed', cleanUp);
8fab2a5  117 |     dialog.connect('destroy', cleanUp);
8fab2a5  118 | 
8fab2a5  119 |     dialog.open();

// --- Lines 128–137 ---
8fab2a5  128 | 
8fab2a5  129 |   destroy() {
8fab2a5  130 |     if (this._confirmDialog) {
8fab2a5  131 |       const dialog = this._confirmDialog;
8fab2a5  132 |       this._confirmDialog = null;
8fab2a5  133 |       dialog.close();
8fab2a5  134 |       dialog.destroy();
8fab2a5  135 |     }
8fab2a5  136 |     super.destroy();
8fab2a5  137 |   }

// --- Lines 145–145 ---
76846c1  145 |         name: params?.name || 'd2daItemOverlay',

// --- Lines 160–166 ---
76846c1  160 |     _init(renderer, params = {}) {
76846c1  161 |       super._init(renderer, {
76846c1  162 |         name: 'd2daDotsOverlay',
76846c1  163 |         ...params,
76846c1  164 |       });
76846c1  165 |     }
76846c1  166 | 

// --- Lines 226–232 ---
76846c1  226 |     _init(renderer, params = {}) {
76846c1  227 |       super._init(renderer, {
76846c1  228 |         name: 'd2daBadgeOverlay',
76846c1  229 |         ...params,
76846c1  230 |       });
76846c1  231 |     }
76846c1  232 | 

// --- Lines 235–240 ---
d7edd62  235 |       let { noticesCount, position, vertical, extension, dock } = data;
d7edd62  236 | 
d7edd62  237 |       let baseIconSize = dock._iconSizeScaledDown || icon._icon.width;
d7edd62  238 |       renderer.width = baseIconSize;
d7edd62  239 |       renderer.height = baseIconSize;
d7edd62  240 |       renderer.pivot_point = icon._icon.pivot_point;

// --- Lines 243–244 ---
d7edd62  243 |       let scale = dock._monitor.geometry_scale || 1;
d7edd62  244 |       canvasScale *= scale;

// --- Lines 252–255 ---
d7edd62  252 |       // Dot canvas draws dots near the bottom (y = size - height, or +0.42*height from center).
d7edd62  253 |       // translate: [0.35, -0.85] shifts it from bottom to top-right corner in canvas coordinates.
d7edd62  254 |       renderer.translationX = 0;
d7edd62  255 |       renderer.translationY = 0;

// --- Lines 262–262 ---
d7edd62  262 |         translate: [0.35, -0.85],

// --- Lines 275–284 ---
8919c7a  275 |       if (this._draggable) {
8919c7a  276 |         this._draggable.inhibit = true;
8919c7a  277 |         this._draggable._onButtonPress = () => {
8919c7a  278 |           return Clutter.EVENT_STOP;
8919c7a  279 |         };
8919c7a  280 |         this._draggable._onTouchEvent = () => {
8919c7a  281 |           return Clutter.EVENT_STOP;
8919c7a  282 |         };
8919c7a  283 |         this._draggable._grabActor = () => {};
8919c7a  284 |       }

// --- Lines 289–289 ---
76846c1  289 |         name: 'd2daDockIconActor',

// --- Lines 327–347 ---
cf2a5dd  327 |             let dock = container.dock;
cf2a5dd  328 |             let target =
cf2a5dd  329 |               dock?.animated && (dock._nearestIcon || dock._hoveredIcon)
cf2a5dd  330 |                 ? dock._nearestIcon || dock._hoveredIcon
cf2a5dd  331 |                 : container;
cf2a5dd  332 |             if (target && target !== container) {
cf2a5dd  333 |               if (dock?.activateTargetIcon) {
cf2a5dd  334 |                 dock.activateTargetIcon(target, 1);
cf2a5dd  335 |               } else if (target._onClick) {
cf2a5dd  336 |                 target._onClick();
cf2a5dd  337 |               } else if (target._appwell) {
cf2a5dd  338 |                 target._appwell.activate(1);
cf2a5dd  339 |               }
cf2a5dd  340 |               return Clutter.EVENT_STOP;
cf2a5dd  341 |             }
8919c7a  342 |             let now = Date.now();
8919c7a  343 |             if (!container._lastClickTime || now - container._lastClickTime > 1000) {
8919c7a  344 |               container._lastClickTime = now;
8919c7a  345 |               if (container._onClick) {
8919c7a  346 |                 container._onClick();
8919c7a  347 |               }

// --- Lines 350–350 ---
8919c7a  350 |           return Clutter.EVENT_STOP;

// --- Lines 365–365 ---
76846c1  365 |         name: 'd2daItemContainer',

// --- Lines 374–374 ---
1553b9d  374 |       const DesktopAppInfo = GioUnix?.DesktopAppInfo ?? Gio.DesktopAppInfo;

// --- Lines 379–384 ---
1553b9d  379 |         if (!desktopApp.get_id) {
1553b9d  380 |           desktopApp.get_id = () => null;
1553b9d  381 |         }
1553b9d  382 |         if (!desktopApp.get_name) {
1553b9d  383 |           desktopApp.get_name = () => '';
1553b9d  384 |         }

// --- Lines 395–395 ---
1553b9d  395 |       } else if (params.appinfo_filename) {

// --- Lines 399–408 ---
e2c6a8e  399 |       // for custom buttons 
e2c6a8e  400 |       if (!desktopApp.can_open_new_window) {
e2c6a8e  401 |         desktopApp.can_open_new_window = () => false;
e2c6a8e  402 |         desktopApp.activate = (me) => {
e2c6a8e  403 |           if (this._onClick) {
e2c6a8e  404 |             // this._onClick();
e2c6a8e  405 |           }
e2c6a8e  406 |         };
e2c6a8e  407 |       }
e2c6a8e  408 | 

// --- Lines 410–410 ---
76846c1  410 |         name: 'd2daDockIcon',

// --- Lines 414–416 ---
ab2d9b2  414 |       if (params.id) {
ab2d9b2  415 |         dashIcon._id = params.id;
ab2d9b2  416 |       }

// --- Lines 422–426 ---
1553b9d  422 |         let iconNames =
1553b9d  423 |           desktopApp.get_icon()?.get_names?.() ||
1553b9d  424 |           desktopApp.get_icon()?.names ||
1553b9d  425 |           [];
1553b9d  426 |         dashIcon._default_icon_name = iconNames[0] || 'file';

// --- Lines 433–433 ---
1553b9d  433 |       if (params.appinfo_filename || params.app) {

// --- Lines 436–436 ---
8fab2a5  436 |           item: this,

// --- Lines 445–445 ---
0a01a50  445 |         this.connect('destroy', () => this._destroyMenu());

// --- Lines 449–459 ---
0a01a50  449 |     _destroyMenu() {
0a01a50  450 |       let menu = this._menu;
0a01a50  451 |       if (!menu) return;
0a01a50  452 |       this._menu = null;
0a01a50  453 |       // removeMenu pops the modal grab if this menu is the open one
0a01a50  454 |       this._menuManager?.removeMenu(menu);
0a01a50  455 |       this._menuManager = null;
0a01a50  456 |       if (this.child?._menu === menu) this.child._menu = null;
0a01a50  457 |       menu.destroy();
0a01a50  458 |     }
0a01a50  459 | 

// --- Lines 553–553 ---
413a7d0  553 |             this.y = 0;

// --- Lines 556–556 ---
413a7d0  556 |             this.x = 0;

```

<a id="effectscolor_shader_effectjs"></a>
### `effects/color_shader_effect.js` (+33 lines across 9 hunks)

```javascript
// --- Lines 8–14 ---
16ee749    8 | const shaderSourceCache = new Map();
16ee749    9 | 
16ee749   10 | export const getShaderSource = (extensionDir, filename) => {
16ee749   11 |   if (shaderSourceCache.has(filename)) {
16ee749   12 |     return shaderSourceCache.get(filename);
16ee749   13 |   }
16ee749   14 |   const shaderPath = GLib.build_filenamev([

// --- Lines 17–17 ---
16ee749   17 |     filename,

// --- Lines 20–22 ---
16ee749   20 |     const src = Shell.get_file_contents_utf8_sync(shaderPath);
16ee749   21 |     shaderSourceCache.set(filename, src);
16ee749   22 |     return src;

// --- Lines 24–24 ---
16ee749   24 |     console.error(`d2da: error loading shader from ${shaderPath}: ${e}`);

// --- Lines 29–29 ---
16ee749   29 | export const ColorShaderEffect = GObject.registerClass(

// --- Lines 31–32 ---
16ee749   31 |   class ColorShaderEffect extends Clutter.ShaderEffect {
16ee749   32 |     _init(params = {}, shaderFilename = '') {

// --- Lines 38–39 ---
16ee749   38 |       this._shaderFilename = shaderFilename;
16ee749   39 |       this._source = null;

// --- Lines 49–54 ---
16ee749   49 |     preload(extensionDir) {
16ee749   50 |       if (!this._shaderFilename) return;
16ee749   51 |       this._source = getShaderSource(extensionDir, this._shaderFilename);
16ee749   52 |       if (this._source) {
16ee749   53 |         this.set_shader_source(this._source);
16ee749   54 |       }

// --- Lines 113–122 ---
16ee749  113 |     set color(rgba) {
16ee749  114 |       if (rgba && rgba.length === 4) {
16ee749  115 |         let [r, g, b, a] = rgba;
16ee749  116 |         this.red = r;
16ee749  117 |         this.green = g;
16ee749  118 |         this.blue = b;
16ee749  119 |         this.blend = a;
16ee749  120 |       }
16ee749  121 |     }
16ee749  122 | 

```

<a id="effectsmonochrome_effectjs"></a>
### `effects/monochrome_effect.js` (+5 lines across 3 hunks)

```javascript
// --- Lines 1–1 ---
16ee749    1 | // Adapted from Blur-My-Shell

// --- Lines 7–7 ---
16ee749    7 | import { ColorShaderEffect } from './color_shader_effect.js';

// --- Lines 11–13 ---
16ee749   11 |   class D2DAMonochromeEffect extends ColorShaderEffect {
16ee749   12 |     _init(params = {}) {
16ee749   13 |       super._init(params, 'monochrome_effect.glsl');

```

<a id="effectstint_effectjs"></a>
### `effects/tint_effect.js` (+5 lines across 3 hunks)

```javascript
// --- Lines 1–1 ---
16ee749    1 | // Adapted from Blur-My-Shell

// --- Lines 6–6 ---
16ee749    6 | import { ColorShaderEffect } from './color_shader_effect.js';

// --- Lines 10–12 ---
16ee749   10 |   class D2DATintEffect extends ColorShaderEffect {
16ee749   11 |     _init(params = {}) {
16ee749   12 |       super._init(params, 'tint_effect.glsl');

```

<a id="extensionjs"></a>
### `extension.js` (+327 lines across 47 hunks)

```javascript
// --- Lines 37–37 ---
deb31fb   37 | import { WindowTracker } from './windowTracker.js';

// --- Lines 39–40 ---
523cec2   39 | import { probe, applySmokeSettings } from './probe.js';
f56a070   40 | import * as Compat from './compat.js';

// --- Lines 55–155 ---
db807f4   55 | const ACTION_ORDER = [
db807f4   56 |   'compiz',
db807f4   57 |   'bms',
db807f4   58 |   'blurred_bg',
db807f4   59 |   'downloads_setup',
db807f4   60 |   'mounts',
db807f4   61 |   'recents_debounce',
db807f4   62 |   'animation_fps',
db807f4   63 |   'autohide',
db807f4   64 |   'multi_monitor',
db807f4   65 |   'recreate_docks',
db807f4   66 |   'shrink',
db807f4   67 |   'icon_resolution',
db807f4   68 |   'icon_spacing',
db807f4   69 |   'widget_style',
db807f4   70 |   'debounced_style',
db807f4   71 |   'style',
db807f4   72 |   'icon_effect',
db807f4   73 |   'icon_effect_color',
db807f4   74 |   'layout',
db807f4   75 |   'animate_refresh',
db807f4   76 |   'animate_preview',
db807f4   77 |   'animate',
db807f4   78 | ];
db807f4   79 | 
db807f4   80 | const REACTIONS = Object.freeze({
db807f4   81 |   'lamp-app-animation': ['compiz'],
db807f4   82 |   'animation-fps': ['animation_fps'],
db807f4   83 |   'debug-visual': ['animate'],
db807f4   84 |   'mounted-icon': ['mounts', 'animate_refresh'],
db807f4   85 |   'peek-hidden-icons': ['animate'],
db807f4   86 |   'animation-magnify': ['layout', 'animate_preview'],
db807f4   87 |   'animation-spread': ['layout', 'animate_preview'],
db807f4   88 |   'animation-rise': ['animate_preview'],
db807f4   89 |   'animation-rise-curve': ['animate_preview'],
db807f4   90 |   'animation-bounce-height': ['animate_preview'],
db807f4   91 |   'notification-badge-size': ['animate'],
db807f4   92 |   'notification-badge-color': ['animate'],
db807f4   93 |   'notification-badge-style': ['animate'],
db807f4   94 |   'running-indicator-size': ['animate'],
db807f4   95 |   'running-indicator-color': ['animate'],
db807f4   96 |   'running-indicator-style': ['animate'],
db807f4   97 |   'clock-style': ['widget_style'],
db807f4   98 |   'calendar-style': ['widget_style'],
db807f4   99 |   'max-recent-items': ['recents_debounce'],
db807f4  100 |   'apps-icon': ['layout', 'animate_refresh'],
db807f4  101 |   'apps-icon-front': ['layout', 'animate_refresh'],
db807f4  102 |   'calendar-icon': ['layout', 'animate_refresh'],
db807f4  103 |   'clock-icon': ['layout', 'animate_refresh'],
db807f4  104 |   'favorites-only': ['layout', 'animate_refresh'],
db807f4  105 |   'downloads-path': ['downloads_setup'],
db807f4  106 |   'dock-location': ['layout', 'recreate_docks', 'animate_preview'],
db807f4  107 |   'icon-resolution': [
db807f4  108 |     'icon_resolution',
db807f4  109 |     'style',
db807f4  110 |     'layout',
db807f4  111 |     'icon_spacing',
db807f4  112 |     'animate',
db807f4  113 |   ],
db807f4  114 |   'icon-effect': ['icon_effect'],
db807f4  115 |   'icon-effect-color': ['icon_effect_color', 'animate'],
db807f4  116 |   'icon-spacing': ['icon_spacing', 'layout'],
db807f4  117 |   'multi-monitor-preference': ['multi_monitor'],
db807f4  118 |   'icon-size': ['shrink', 'layout', 'animate_refresh'],
db807f4  119 |   'preferred-monitor': ['layout', 'animate_refresh'],
db807f4  120 |   'autohide-dodge': ['autohide'],
db807f4  121 |   'autohide-dash': ['autohide'],
db807f4  122 |   'dock-padding': ['layout', 'animate'],
db807f4  123 |   'edge-distance': ['layout', 'animate'],
db807f4  124 |   'shrink-icons': ['shrink', 'layout', 'animate'],
db807f4  125 |   'border-radius': ['debounced_style', 'animate'],
db807f4  126 |   'separator-thickness': ['style', 'recreate_docks', 'animate_preview'],
db807f4  127 |   'icon-border-color': ['style', 'layout', 'animate'],
db807f4  128 |   'icon-border-thickness': ['style', 'layout', 'animate'],
db807f4  129 |   'icon-border-radius': ['style', 'layout', 'animate'],
db807f4  130 |   'icon-background-color': ['style', 'layout', 'animate'],
db807f4  131 |   'separator-color': ['style', 'layout', 'animate'],
db807f4  132 |   'border-color': ['style', 'layout', 'animate'],
db807f4  133 |   'border-thickness': ['style', 'layout', 'animate'],
db807f4  134 |   'customize-topbar': ['style', 'layout', 'animate'],
db807f4  135 |   'icon-shadow': ['style', 'layout', 'animate'],
db807f4  136 |   'topbar-border-color': ['style', 'layout', 'animate'],
db807f4  137 |   'topbar-border-thickness': ['style', 'layout', 'animate'],
db807f4  138 |   'topbar-background-color': ['style', 'layout', 'animate'],
db807f4  139 |   'topbar-foreground-color': ['style', 'layout', 'animate'],
db807f4  140 |   'customize-label': ['style', 'layout', 'animate'],
db807f4  141 |   'label-border-radius': ['style', 'layout', 'animate'],
db807f4  142 |   'label-border-color': ['style', 'layout', 'animate'],
db807f4  143 |   'label-border-thickness': ['style', 'layout', 'animate'],
db807f4  144 |   'label-background-color': ['style', 'layout', 'animate'],
db807f4  145 |   'label-foreground-color': ['style', 'layout', 'animate'],
db807f4  146 |   'panel-mode': ['style', 'layout', 'animate'],
db807f4  147 |   'background-color': ['bms', 'blurred_bg', 'style', 'layout', 'animate'],
db807f4  148 |   'blur-resolution': ['bms', 'blurred_bg', 'style', 'layout', 'animate'],
db807f4  149 |   'blur-background': ['bms', 'blurred_bg', 'style', 'layout', 'animate'],
db807f4  150 |   'pressure-sense': [],
db807f4  151 |   'downloads-icon': ['layout', 'animate_refresh'],
db807f4  152 |   'documents-icon': ['layout', 'animate_refresh'],
db807f4  153 |   'trash-icon': ['layout', 'animate_refresh'],
db807f4  154 | });
db807f4  155 | 

// --- Lines 179–179 ---
c9ca876  179 |         let dc_monitor = dc['monitor'] ?? {};

// --- Lines 215–216 ---
e5ba736  215 |       if (this.docks.length == count) {
e5ba736  216 |         return;

// --- Lines 218–218 ---
e5ba736  218 |       this.destroyDocks();

// --- Lines 228–228 ---
d95bb11  228 |     // Dock.destroy() undocks, cancels its animations and destroys the dash

// --- Lines 230–230 ---
d95bb11  230 |       dock.destroy();

// --- Lines 232–232 ---
c84f252  232 |     this.dock = null;

// --- Lines 234–235 ---
c84f252  234 |     // services has no listener hooks; createDock() rebuilds the list
c84f252  235 |     this.listeners = [];

// --- Lines 250–257 ---
f56a070  250 |     if (!this._overviewDashState) {
f56a070  251 |       this._overviewDashState = { hiddenChild: null };
c9ca876  252 |     }
f56a070  253 |     Compat.setOverviewDashVisibility(
f56a070  254 |       Main.overview.dash,
f56a070  255 |       show,
f56a070  256 |       this._overviewDashState
f56a070  257 |     );

// --- Lines 281–281 ---
deb31fb  281 |     this.windowTracker = new WindowTracker(() => this.checkHide());

// --- Lines 289–291 ---
4b343d1  289 |     this._loadConfig().catch((err) => {
4b343d1  290 |       console.error('d2da: loadConfig', err);
4b343d1  291 |     });

// --- Lines 318–318 ---
c0391da  318 |     this._lastServicesUpdate = 0;

// --- Lines 321–323 ---
523cec2  321 |     // after integrations/services exist: the settings switch uses them
523cec2  322 |     applySmokeSettings(this._settings);
523cec2  323 | 

// --- Lines 343–348 ---
888baf5  343 |     const probeTimers = {
888baf5  344 |       loop: this._timer,
888baf5  345 |       hi: this._hiTimer,
888baf5  346 |       lo: this._loTimer,
888baf5  347 |     };
888baf5  348 | 

// --- Lines 368–370 ---
deb31fb  368 |     this.windowTracker?.destroy();
deb31fb  369 |     this.windowTracker = null;
deb31fb  370 | 

// --- Lines 376–381 ---
c0391da  376 |     this._lastServicesUpdate = 0;
ab8bbdf  377 | 
c84f252  378 |     this._hiTimer?.cancel(this._debounceStyleSeq);
c84f252  379 |     this._loTimer?.cancel(this._iconSpacingDebounceSeq);
c84f252  380 |     this._debounceStyleSeq = null;
c84f252  381 |     this._iconSpacingDebounceSeq = null;

// --- Lines 395–396 ---
888baf5  395 | 
888baf5  396 |     probe(this, 'after-disable', probeTimers);

// --- Lines 406–407 ---
37f059d  406 |         dock._needsLayout = true;
37f059d  407 |         dock.relayout(true);

// --- Lines 434–435 ---
888baf5  434 | 
888baf5  435 |     probe(this, 'after-enable');

// --- Lines 470–476 ---
4b343d1  470 |     const configDir = GLib.build_filenamev([
4b343d1  471 |       GLib.get_user_config_dir(),
4b343d1  472 |       'd2da',
4b343d1  473 |     ]);
4b343d1  474 |     let fn_config = Gio.File.new_for_path(
4b343d1  475 |       GLib.build_filenamev([configDir, 'config.json'])
4b343d1  476 |     );

// --- Lines 482–482 ---
4b343d1  482 |         console.error('d2da: loadConfig', err);

// --- Lines 509–511 ---
4b343d1  509 |     let fn_icons = Gio.File.new_for_path(
4b343d1  510 |       GLib.build_filenamev([configDir, 'icons.json'])
4b343d1  511 |     );

// --- Lines 522–524 ---
4b343d1  522 |               let file = Gio.File.new_for_path(
4b343d1  523 |                 GLib.build_filenamev([configDir, path])
4b343d1  524 |               );

// --- Lines 538–540 ---
4b343d1  538 |               let file = Gio.File.new_for_path(
4b343d1  539 |                 GLib.build_filenamev([configDir, path])
4b343d1  540 |               );

// --- Lines 549–549 ---
4b343d1  549 |         console.error('d2da: loadConfig', err);

// --- Lines 553–555 ---
4b343d1  553 |     let fn_style = Gio.File.new_for_path(
4b343d1  554 |       GLib.build_filenamev([configDir, 'style.css'])
4b343d1  555 |     );

// --- Lines 568–574 ---
4b343d1  568 |     const configDir = GLib.build_filenamev([
4b343d1  569 |       GLib.get_user_config_dir(),
4b343d1  570 |       'd2da',
4b343d1  571 |     ]);
4b343d1  572 |     let fn_style = Gio.File.new_for_path(
4b343d1  573 |       GLib.build_filenamev([configDir, 'style.css'])
4b343d1  574 |     );

// --- Lines 583–585 ---
db807f4  583 |     this._reactionIdleId = 0;
db807f4  584 |     this._pendingReactions = new Set();
db807f4  585 | 

// --- Lines 609–616 ---
db807f4  609 |       if (name === 'msg-to-ext') {
db807f4  610 |         if (value.length) {
db807f4  611 |           const commands = {
db807f4  612 |             'run-diagnostics': () => this.runDiagnostics(),
db807f4  613 |             'dump-timers': () => this.dumpTimers(),
db807f4  614 |           };
db807f4  615 |           const command = commands[value];
db807f4  616 |           if (command) {

// --- Lines 618–618 ---
db807f4  618 |               command();

// --- Lines 620–620 ---
db807f4  620 |               console.error(`d2da: msg-to-ext ${value}`, err);

// --- Lines 622–623 ---
db807f4  622 |           } else {
db807f4  623 |             console.warn('d2da: unknown command', value);

// --- Lines 625–625 ---
db807f4  625 |           this._settings.set_string('msg-to-ext', '');

// --- Lines 627–632 ---
db807f4  627 |         return;
db807f4  628 |       }
db807f4  629 | 
db807f4  630 |       const actions = REACTIONS[name];
db807f4  631 |       if (actions && actions.length > 0) {
db807f4  632 |         this._queueReactions(actions);

// --- Lines 647–730 ---
db807f4  647 |   _queueReactions(actions) {
db807f4  648 |     if (!actions || actions.length === 0) return;
db807f4  649 |     if (!this._pendingReactions) {
db807f4  650 |       this._pendingReactions = new Set();
db807f4  651 |     }
db807f4  652 |     for (const action of actions) {
db807f4  653 |       this._pendingReactions.add(action);
db807f4  654 |     }
db807f4  655 |     if (!this._reactionIdleId) {
db807f4  656 |       this._reactionIdleId = GLib.idle_add(
db807f4  657 |         GLib.PRIORITY_DEFAULT_IDLE,
db807f4  658 |         () => {
db807f4  659 |           this._flushReactions();
db807f4  660 |           return GLib.SOURCE_REMOVE;
db807f4  661 |         }
db807f4  662 |       );
db807f4  663 |     }
db807f4  664 |   }
db807f4  665 | 
db807f4  666 |   _flushReactions() {
db807f4  667 |     this._reactionIdleId = 0;
db807f4  668 |     if (
db807f4  669 |       !this._pendingReactions ||
db807f4  670 |       this._pendingReactions.size === 0 ||
db807f4  671 |       !this._settings
db807f4  672 |     ) {
db807f4  673 |       return;
db807f4  674 |     }
db807f4  675 | 
db807f4  676 |     const pending = this._pendingReactions;
db807f4  677 |     this._pendingReactions = new Set();
db807f4  678 | 
db807f4  679 |     const handlers = {
db807f4  680 |       compiz: () => this.integrations?.hookCompiz(),
db807f4  681 |       bms: () => this.integrations?.hookBms(),
db807f4  682 |       blurred_bg: () => this._updateBlurredBackground(),
db807f4  683 |       downloads_setup: () => this.services?.setupDownloads(),
db807f4  684 |       mounts: () => {
db807f4  685 |         this.services?.checkMounts();
db807f4  686 |         this.services?._commitMounts();
db807f4  687 |       },
db807f4  688 |       recents_debounce: () => {
db807f4  689 |         this.services?._debounceCheckDownloads();
db807f4  690 |         this.services?._debounceCheckRecents();
db807f4  691 |       },
db807f4  692 |       animation_fps: () => this._updateAnimationFPS(),
db807f4  693 |       autohide: () => this._updateAutohide(),
db807f4  694 |       multi_monitor: () => this._updateMultiMonitorPreference(),
db807f4  695 |       recreate_docks: () => this.recreateAllDocks(),
db807f4  696 |       shrink: () => this._updateShrink(),
db807f4  697 |       icon_resolution: () => this._updateIconResolution(),
db807f4  698 |       icon_spacing: () => this._updateIconSpacing(),
db807f4  699 |       widget_style: () => this._updateWidgetStyle(),
db807f4  700 |       debounced_style: () => this._debouncedUpdateStyle(),
db807f4  701 |       style: () => this._updateStyle(),
db807f4  702 |       icon_effect: () => {
db807f4  703 |         this.docks?.forEach((dock) => {
db807f4  704 |           dock._updateIconEffect();
db807f4  705 |         });
db807f4  706 |       },
db807f4  707 |       icon_effect_color: () => {
db807f4  708 |         this.docks?.forEach((dock) => {
db807f4  709 |           dock._updateIconEffectColor(this.icon_effect_color);
db807f4  710 |         });
db807f4  711 |       },
db807f4  712 |       layout: () => this._updateLayout(),
db807f4  713 |       animate_refresh: () => this.animate({ refresh: true }),
db807f4  714 |       animate_preview: () => {
db807f4  715 |         if (this.animate_icons) this.animate({ preview: true });
db807f4  716 |       },
db807f4  717 |       animate: () => this.animate(),
db807f4  718 |     };
db807f4  719 | 
db807f4  720 |     for (const action of ACTION_ORDER) {
db807f4  721 |       if (pending.has(action)) {
db807f4  722 |         try {
db807f4  723 |           handlers[action]?.();
db807f4  724 |         } catch (err) {
db807f4  725 |           console.error(`d2da: reaction ${action}`, err);
db807f4  726 |         }
db807f4  727 |       }
db807f4  728 |     }
db807f4  729 |   }
db807f4  730 | 

// --- Lines 732–738 ---
db807f4  732 |     if (this._reactionIdleId) {
db807f4  733 |       GLib.source_remove(this._reactionIdleId);
db807f4  734 |       this._reactionIdleId = 0;
db807f4  735 |     }
db807f4  736 |     this._pendingReactions?.clear();
db807f4  737 |     this._pendingReactions = null;
db807f4  738 | 

// --- Lines 805–816 ---
c9ca876  805 |         // remember exactly what was hidden so disable() can restore it
f56a070  806 |         let child = Compat.getDashContainer(Main.overview.dash);
c9ca876  807 |         if (child?.visible) {
c9ca876  808 |           child.visible = false;
f56a070  809 |           if (!this._overviewDashState) {
f56a070  810 |             this._overviewDashState = { hiddenChild: null };
f56a070  811 |           }
f56a070  812 |           this._overviewDashState.hiddenChild = child;
f56a070  813 |         }
f56a070  814 |         if (Main.overview.dash) {
f56a070  815 |           Main.overview.dash.opacity = 0;
c9ca876  816 |         }

// --- Lines 823–823 ---
37f059d  823 |         this._onMonitorsChanged();

// --- Lines 913–913 ---
c0391da  913 |       this._lastServicesUpdate = 0;

// --- Lines 915–915 ---
c9ca876  915 |     this.icon_theme = St.IconTheme.new();

// --- Lines 949–955 ---
37f059d  949 |   _onMonitorsChanged() {
37f059d  950 |     let listeners = [...this.listeners];
37f059d  951 |     listeners.forEach((l) => {
37f059d  952 |       if (l._onMonitorsChanged) l._onMonitorsChanged();
37f059d  953 |     });
37f059d  954 |   }
37f059d  955 | 

// --- Lines 986–995 ---
c0391da  986 |     let now = GLib.get_monotonic_time();
c0391da  987 |     let elapsed = SERVICES_UPDATE_INTERVAL;
c0391da  988 |     if (this._lastServicesUpdate) {
c0391da  989 |       elapsed = Math.max(
c0391da  990 |         0,
c0391da  991 |         Math.round((now - this._lastServicesUpdate) / 1000)
c0391da  992 |       );
c0391da  993 |     }
c0391da  994 |     this._lastServicesUpdate = now;
c0391da  995 |     this.services.update(elapsed);

// --- Lines 1254–1254 ---
37f059d 1254 |     if (disable) return;

// --- Lines 1256–1257 ---
37f059d 1256 |       dock._needsLayout = true;
37f059d 1257 |       dock.relayout(true);

// --- Lines 1280–1280 ---
deb31fb 1280 |       this.windowTracker?.clear();

```

<a id="integrationsjs"></a>
### `integrations.js` (+1 lines across 1 hunks)

```javascript
// --- Lines 59–59 ---
f1b1f94   59 |     let sz = dock._iconSizeScaledDown || dock._preferredIconSize();

```

<a id="preferenceskeysjs"></a>
### `preferences/keys.js` (+1 lines across 1 hunks)

```javascript
// --- Lines 262–262 ---
ecf4f95  262 |       test: { values: [0, 1, 2] },

```

<a id="preferencesprefKeysjs"></a>
### `preferences/prefKeys.js` (+59 lines across 10 hunks)

```javascript
// --- Lines 6–7 ---
5840f29    6 |     // >0 while widgets are updated from settings; widget handlers must not write back
5840f29    7 |     this._syncing = 0;

// --- Lines 116–158 ---
5840f29  116 |   // run fn without widget handlers writing back to settings
5840f29  117 |   withoutWriteback(fn) {
5840f29  118 |     this._syncing++;
5840f29  119 |     try {
5840f29  120 |       fn();
5840f29  121 |     } finally {
5840f29  122 |       this._syncing--;
5840f29  123 |     }
5840f29  124 |   }
5840f29  125 | 
5840f29  126 |   updateWidget(name) {
5840f29  127 |     let key = this._keys[name];
5840f29  128 |     if (!key || !key.object) return;
5840f29  129 |     this.withoutWriteback(() => {
5840f29  130 |       try {
5840f29  131 |         switch (key.widget_type) {
5840f29  132 |           case 'switch':
5840f29  133 |             key.object.set_active(key.value);
5840f29  134 |             break;
5840f29  135 |           case 'dropdown':
5840f29  136 |             key.object.set_selected(key.value);
5840f29  137 |             break;
5840f29  138 |           case 'scale':
5840f29  139 |           case 'string':
5840f29  140 |             key.object.set_value(key.value);
5840f29  141 |             break;
5840f29  142 |           case 'color':
5840f29  143 |             key.object.set_rgba(
5840f29  144 |               this._toRGBA({
5840f29  145 |                 red: key.value[0],
5840f29  146 |                 green: key.value[1],
5840f29  147 |                 blue: key.value[2],
5840f29  148 |                 alpha: key.value[3],
5840f29  149 |               })
5840f29  150 |             );
5840f29  151 |             break;
5840f29  152 |         }
5840f29  153 |       } catch (err) {
5840f29  154 |         console.error(`d2da: prefs update widget ${name}`, err);
5840f29  155 |       }
5840f29  156 |     });
5840f29  157 |   }
5840f29  158 | 

// --- Lines 201–201 ---
5840f29  201 |       this.updateWidget(name);

// --- Lines 240–240 ---
5840f29  240 |           self.updateWidget(name);

// --- Lines 248–248 ---
5840f29  248 |     (this._settingsListeners || []).forEach((id) => {

// --- Lines 254–260 ---
5840f29  254 |   disconnectBuilder() {
5840f29  255 |     (this._builderListeners || []).forEach((l) => {
5840f29  256 |       if (l.signal_id) l.source.disconnect(l.signal_id);
5840f29  257 |     });
5840f29  258 |     this._builderListeners = [];
5840f29  259 |   }
5840f29  260 | 

// --- Lines 283–283 ---
5840f29  283 |             if (self._syncing) return;

// --- Lines 294–294 ---
5840f29  294 |             if (self._syncing) return;

// --- Lines 303–303 ---
5840f29  303 |             if (self._syncing) return;

// --- Lines 311–311 ---
5840f29  311 |             if (self._syncing) return;

```

<a id="prefsjs"></a>
### `prefs.js` (+73 lines across 15 hunks)

```javascript
// --- Lines 113–119 ---
5840f29  113 |       let folder = null;
5840f29  114 |       try {
5840f29  115 |         folder = dialog.select_folder_finish(task);
5840f29  116 |       } catch (err) {
5840f29  117 |         // dismissed or failed; keep the current path
5840f29  118 |         console.log(`d2da: select folder: ${err.message}`);
5840f29  119 |       }

// --- Lines 162–162 ---
3311461  162 |         settings.set_string('msg-to-ext', 'run-diagnostics');

// --- Lines 201–201 ---
5840f29  201 |     this._settingsKeys = settingsKeys;

// --- Lines 203–210 ---
5840f29  203 | 
5840f29  204 |     // the monitor model must exist before preferred-monitor is selected (B-32)
5840f29  205 |     this._monitorsConfig = new MonitorsConfig();
5840f29  206 |     let monitorsId = this._monitorsConfig.connect('updated', () =>
5840f29  207 |       this.updateMonitors()
5840f29  208 |     );
5840f29  209 |     this.updateMonitors();
5840f29  210 | 

// --- Lines 223–223 ---
03940ad  223 |       let exp = settings.get_boolean('experimental-features');

// --- Lines 233–238 ---
5840f29  233 |     let experimentalId = settings.connect(
5840f29  234 |       'changed::experimental-features',
5840f29  235 |       () => {
5840f29  236 |         toggle_experimental();
5840f29  237 |       }
5840f29  238 |     );

// --- Lines 242–248 ---
5840f29  242 |     window.connect('close-request', () => {
5840f29  243 |       settings.disconnect(experimentalId);
5840f29  244 |       this._monitorsConfig.disconnect(monitorsId);
5840f29  245 |       settingsKeys.disconnectSettings();
5840f29  246 |       settingsKeys.disconnectBuilder();
5840f29  247 |       return false;
5840f29  248 |     });

// --- Lines 253–253 ---
4b343d1  253 |       GLib.build_filenamev([GLib.get_user_config_dir(), 'd2da', 'themes'])

// --- Lines 279–285 ---
5840f29  279 |         try {
5840f29  280 |           let json = JSON.parse(contentsString);
5840f29  281 |           if (json && json['meta'] && json['meta']['title']) {
5840f29  282 |             themed_presets.push(json);
5840f29  283 |           }
5840f29  284 |         } catch (err) {
5840f29  285 |           console.error(`d2da: invalid preset ${fn.get_path()}`, err);

// --- Lines 318–318 ---
5840f29  318 |     let settingsKeys = this._settingsKeys;

// --- Lines 334–341 ---
d96998c  334 |       const exportDir = GLib.build_filenamev([
d96998c  335 |         GLib.get_user_config_dir(),
d96998c  336 |         'd2da',
d96998c  337 |       ]);
d96998c  338 |       GLib.mkdir_with_parents(exportDir, 0o700);
d96998c  339 |       const exportPath = GLib.build_filenamev([exportDir, 'theme.json']);
d96998c  340 | 
d96998c  341 |       let fn = Gio.File.new_for_path(exportPath);

// --- Lines 343–343 ---
d96998c  343 |       fn.replace_contents(

// --- Lines 352–352 ---
d96998c  352 |         new Adw.Toast({ title: `Saved to ${exportPath}` })

// --- Lines 368–385 ---
5840f29  368 |       // widgets follow via changed:: in settingsKeys
5840f29  369 |       try {
5840f29  370 |         switch (def.widget_type) {
5840f29  371 |           case 'color':
5840f29  372 |             this._settings.set_value(k, new GLib.Variant('(dddd)', v));
5840f29  373 |             break;
5840f29  374 |           case 'switch':
5840f29  375 |             this._settings.set_boolean(k, v);
5840f29  376 |             break;
5840f29  377 |           case 'dropdown':
5840f29  378 |             this._settings.set_int(k, v);
5840f29  379 |             break;
5840f29  380 |           case 'scale':
5840f29  381 |             this._settings.set_double(k, v);
5840f29  382 |             break;
5840f29  383 |         }
5840f29  384 |       } catch (err) {
5840f29  385 |         console.error(`d2da: preset ${p['meta']['title']} key ${k}`, err);

// --- Lines 402–406 ---
5840f29  402 |     let dropdown = this._builder.get_object('preferred-monitor');
5840f29  403 |     let keys = this._settingsKeys;
5840f29  404 |     // replacing the model resets the selection; don't let that reach settings (B-32)
5840f29  405 |     keys.withoutWriteback(() => dropdown.set_model(list));
5840f29  406 |     keys.updateWidget('preferred-monitor');

```

<a id="probejs"></a>
### `probe.js` (+109 lines across 1 hunks)

```javascript
// --- Lines 1–109 ---
2bbf52d    1 | 'use strict';
2bbf52d    2 | 
2bbf52d    3 | import GLib from 'gi://GLib';
2bbf52d    4 | import * as Main from 'resource:///org/gnome/shell/ui/main.js';
2bbf52d    5 | 
523cec2    6 | // Live instance counts (T-6): stage walks can't see actors that were
523cec2    7 | // unparented but never destroyed. Always counted; it's just an integer map.
523cec2    8 | const liveCounts = {};
523cec2    9 | 
523cec2   10 | export function live(kind, delta) {
523cec2   11 |   liveCounts[kind] = (liveCounts[kind] ?? 0) + delta;
523cec2   12 | }
523cec2   13 | 
523cec2   14 | // Smoke-only settings hook: D2DA_SMOKE_SETTINGS='key=value key=value', values
523cec2   15 | // in GVariant text format (strings quoted). Only with D2DA_PROBE=1 *and* the
523cec2   16 | // in-memory GSettings backend, so it can never write the user's dconf.
523cec2   17 | export function applySmokeSettings(settings) {
523cec2   18 |   if (
523cec2   19 |     GLib.getenv('D2DA_PROBE') !== '1' ||
523cec2   20 |     GLib.getenv('GSETTINGS_BACKEND') !== 'memory'
523cec2   21 |   ) {
523cec2   22 |     return;
523cec2   23 |   }
523cec2   24 | 
523cec2   25 |   const spec = (GLib.getenv('D2DA_SMOKE_SETTINGS') ?? '').trim();
523cec2   26 |   if (!spec) {
523cec2   27 |     return;
523cec2   28 |   }
523cec2   29 | 
523cec2   30 |   const applied = [];
523cec2   31 |   for (const pair of spec.split(/\s+/)) {
523cec2   32 |     try {
523cec2   33 |       const eq = pair.indexOf('=');
523cec2   34 |       if (eq < 1) {
523cec2   35 |         throw new Error(`malformed '${pair}' (want key=value)`);
523cec2   36 |       }
523cec2   37 |       const key = pair.slice(0, eq);
523cec2   38 |       if (!settings.settings_schema.has_key(key)) {
523cec2   39 |         throw new Error(`unknown key '${key}'`);
523cec2   40 |       }
523cec2   41 |       const type = settings.settings_schema.get_key(key).get_value_type();
523cec2   42 |       const value = GLib.Variant.parse(type, pair.slice(eq + 1), null, null);
523cec2   43 |       // the memory backend keeps values across re-enables; skip no-op writes
523cec2   44 |       if (!settings.get_value(key).equal(value)) {
523cec2   45 |         settings.set_value(key, value);
523cec2   46 |       }
523cec2   47 |       applied.push(`${key}=${value.print(false)}`);
523cec2   48 |     } catch (e) {
523cec2   49 |       console.error('d2da: probe settings', e);
523cec2   50 |     }
523cec2   51 |   }
523cec2   52 |   console.log('d2da-probe settings applied: ' + applied.join(' '));
523cec2   53 | }
523cec2   54 | 
2bbf52d   55 | // Dev-only leak/regression probe (G1). No-op unless the shell runs with
2bbf52d   56 | // D2DA_PROBE=1 (tools/smoke-shell.sh sets it).
2bbf52d   57 | // `timers` lets disable() pass its timers in before it nulls them.
2bbf52d   58 | export function probe(ext, phase, timers) {
2bbf52d   59 |   if (GLib.getenv('D2DA_PROBE') !== '1') {
2bbf52d   60 |     return;
2bbf52d   61 |   }
2bbf52d   62 | 
2bbf52d   63 |   try {
2bbf52d   64 |     timers = timers ?? {
2bbf52d   65 |       loop: ext._timer,
2bbf52d   66 |       hi: ext._hiTimer,
2bbf52d   67 |       lo: ext._loTimer,
2bbf52d   68 |     };
2bbf52d   69 | 
2bbf52d   70 |     let stage = 0;
2bbf52d   71 |     let dashes = 0;
2bbf52d   72 |     const stack = [global.stage];
2bbf52d   73 |     while (stack.length) {
2bbf52d   74 |       const actor = stack.pop();
2bbf52d   75 |       for (
2bbf52d   76 |         let child = actor.get_first_child();
2bbf52d   77 |         child;
2bbf52d   78 |         child = child.get_next_sibling()
2bbf52d   79 |       ) {
2bbf52d   80 |         stage++;
2bbf52d   81 |         if (child.constructor.name === 'Dash') {
2bbf52d   82 |           dashes++;
2bbf52d   83 |         }
2bbf52d   84 |         stack.push(child);
2bbf52d   85 |       }
2bbf52d   86 |     }
2bbf52d   87 | 
2bbf52d   88 |     const subscribers = (timer) => timer?._subscribers?.length ?? 0;
2bbf52d   89 | 
2bbf52d   90 |     console.log(
2bbf52d   91 |       'd2da-probe ' +
2bbf52d   92 |         JSON.stringify({
2bbf52d   93 |           phase,
2bbf52d   94 |           uiGroup: Main.uiGroup.get_n_children(),
2bbf52d   95 |           stage,
2bbf52d   96 |           dashes,
2bbf52d   97 |           docks: ext.docks?.length ?? 0,
2bbf52d   98 |           hi: subscribers(timers.hi),
2bbf52d   99 |           lo: subscribers(timers.lo),
2bbf52d  100 |           loop: subscribers(timers.loop),
523cec2  101 |           liveDock: liveCounts.dock ?? 0,
523cec2  102 |           liveDash: liveCounts.dash ?? 0,
523cec2  103 |           liveAnimator: liveCounts.animator ?? 0,
2bbf52d  104 |         })
2bbf52d  105 |     );
2bbf52d  106 |   } catch (e) {
2bbf52d  107 |     console.error('d2da: probe', e);
2bbf52d  108 |   }
2bbf52d  109 | }

```

<a id="servicesjs"></a>
### `services.js` (+289 lines across 49 hunks)

```javascript
// --- Lines 4–8 ---
4b343d1    4 | import {
4b343d1    5 |   trySpawnCommandLine,
4b343d1    6 |   getDownloadsDir,
4b343d1    7 |   getDocumentsDir,
4b343d1    8 | } from './utils.js';

// --- Lines 12–12 ---
1553b9d   12 | import GioUnix from 'gi://GioUnix';

// --- Lines 37–41 ---
c0391da   37 |         try {
c0391da   38 |           this._callback();
c0391da   39 |         } catch (e) {
c0391da   40 |           console.error(`d2da: service ${this.name} update`, e);
c0391da   41 |         }

// --- Lines 51–51 ---
c0391da   51 |     this._cancellable = new Gio.Cancellable();

// --- Lines 53–55 ---
1553b9d   53 |     this.trashApp = null;
1553b9d   54 |     this.folderApps = {};
1553b9d   55 |     this.mountApps = {};

// --- Lines 139–142 ---
c0391da  139 |     this._cancellable?.cancel();
c0391da  140 |     this._cancellable = null;
c0391da  141 |     this._downloadsMonitor?.cancel();
c0391da  142 |     this._downloadsMonitor?.disconnectObject(this);

// --- Lines 145–145 ---
c0391da  145 |     this._volumeMonitor?.disconnectObject(this);

// --- Lines 147–148 ---
c0391da  147 |     this._trashMonitor?.cancel();
c0391da  148 |     this._trashMonitor?.disconnectObject(this);

// --- Lines 151–158 ---
c0391da  151 |     this.extension._loTimer?.cancel(this._debounceRecentsSeq);
c0391da  152 |     this.extension._loTimer?.cancel(this._debounceDownloadsSeq);
c0391da  153 |     this._debounceRecentsSeq = null;
c0391da  154 |     this._debounceDownloadsSeq = null;
1553b9d  155 |     this._mounts = {};
1553b9d  156 |     this.trashApp = null;
1553b9d  157 |     this.folderApps = {};
1553b9d  158 |     this.mountApps = {};

// --- Lines 163–163 ---
c0391da  163 |       this._downloadsMonitor.cancel();

// --- Lines 168–171 ---
4b343d1  168 |     let fn = this._downloadsUserDir
4b343d1  169 |       ? Gio.File.new_for_path(this._downloadsUserDir)
4b343d1  170 |       : null;
4b343d1  171 |     if (!fn || !fn.query_exists(null)) {

// --- Lines 178–178 ---
4b343d1  178 |       this._downloadsDir = Gio.File.new_for_path(getDownloadsDir());

// --- Lines 219–219 ---
ab2d9b2  219 |     this.extension.animate({ refresh: true });

// --- Lines 224–229 ---
1553b9d  224 |     let appname = this._getMountAppName(mount);
1553b9d  225 |     delete this._mounts[appname];
1553b9d  226 |     if (this.mountApps) {
1553b9d  227 |       delete this.mountApps[appname];
1553b9d  228 |     }
ab2d9b2  229 |     this.extension.animate({ refresh: true });

// --- Lines 234–238 ---
c0391da  234 |       try {
c0391da  235 |         s.update(elapsed);
c0391da  236 |       } catch (e) {
c0391da  237 |         console.error(`d2da: service ${s.name} update`, e);
c0391da  238 |       }

// --- Lines 242–248 ---
1553b9d  242 |   _createAppInfoFromData(desktopContent) {
1553b9d  243 |     const kf = new GLib.KeyFile();
1553b9d  244 |     const length = new TextEncoder().encode(desktopContent).length;
1553b9d  245 |     kf.load_from_data(desktopContent, length, GLib.KeyFileFlags.NONE);
1553b9d  246 |     return (GioUnix?.DesktopAppInfo ?? Gio.DesktopAppInfo).new_from_keyfile(kf);
1553b9d  247 |   }
1553b9d  248 | 

// --- Lines 251–253 ---
1553b9d  251 |     let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=${open_app} trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash;\n\n[Desktop Action trash]\nName=Empty Trash\nExec=gio trash --empty\nTerminal=false\n`;
1553b9d  252 |     this.trashApp = this._createAppInfoFromData(content);
1553b9d  253 |     return this.trashApp;

// --- Lines 257–258 ---
1553b9d  257 |     let full_path = Gio.File.new_for_path(path).get_path();
1553b9d  258 |     let quoted_path = GLib.shell_quote(full_path);

// --- Lines 261–267 ---
1553b9d  261 |     let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${title}\nExec=${open_app} ${quoted_path}\nIcon=${icon}\nStartupWMClass=${name}-dash2dock-lite\n`;
1553b9d  262 |     let appInfo = this._createAppInfoFromData(content);
1553b9d  263 |     if (!this.folderApps) {
1553b9d  264 |       this.folderApps = {};
1553b9d  265 |     }
1553b9d  266 |     this.folderApps[name] = appInfo;
1553b9d  267 |     return appInfo;

// --- Lines 276–276 ---
4b343d1  276 |       getDownloadsDir()

// --- Lines 282–282 ---
4b343d1  282 |       getDocumentsDir()

// --- Lines 296–300 ---
0821a56  296 |     let label = this._escapeDesktopValue(this._getMountName(mount));
0821a56  297 |     let appname = this._getMountAppName(mount);
1553b9d  298 |     let location = mount.get_default_location();
1553b9d  299 |     let fullpath = location?.get_path() || location?.get_uri() || '';
1553b9d  300 |     let quoted_path = GLib.shell_quote(fullpath);

// --- Lines 307–307 ---
1553b9d  307 |     let unmount_exec = `umount ${quoted_path}`;

// --- Lines 309–321 ---
0821a56  309 |     // always rewrite: same root URI may come back with a new label/path
1553b9d  310 |     let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${label}\nExec=xdg-open ${quoted_path}\nIcon=${icon}\nStartupWMClass=${appname.replace(
0821a56  311 |       /\.desktop$/,
0821a56  312 |       ''
0821a56  313 |     )}\nActions=unmount;\n\n[Desktop Action mount]\nName=Mount\nExec=${mount_exec}\n\n[Desktop Action unmount]\nName=Unmount\nExec=${unmount_exec}\n`;
0e0270a  314 | 
1553b9d  315 |     let appInfo = this._createAppInfoFromData(content);
1553b9d  316 |     if (!this.mountApps) {
1553b9d  317 |       this.mountApps = {};
1553b9d  318 |     }
1553b9d  319 |     this.mountApps[appname] = appInfo;
1553b9d  320 |     this._mounts[appname] = mount;
1553b9d  321 |     return appInfo;

// --- Lines 388–388 ---
ab2d9b2  388 |       this.extension.animate({ refresh: true });

// --- Lines 392–435 ---
8fab2a5  392 |   emptyTrash() {
8fab2a5  393 |     if (!this._trashDir) return;
8fab2a5  394 | 
8fab2a5  395 |     let iter = null;
8fab2a5  396 |     try {
8fab2a5  397 |       iter = this._trashDir.enumerate_children(
8fab2a5  398 |         'standard::*',
8fab2a5  399 |         Gio.FileQueryInfoFlags.NONE,
8fab2a5  400 |         this._cancellable ?? null
8fab2a5  401 |       );
8fab2a5  402 |       let info;
8fab2a5  403 |       while ((info = iter.next_file(this._cancellable ?? null)) !== null) {
8fab2a5  404 |         let child = iter.get_child(info);
8fab2a5  405 |         try {
8fab2a5  406 |           child.delete(this._cancellable ?? null);
8fab2a5  407 |         } catch (e) {
8fab2a5  408 |           if (
8fab2a5  409 |             this._cancellable?.is_cancelled() ||
8fab2a5  410 |             (e?.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
8fab2a5  411 |           ) {
8fab2a5  412 |             break;
8fab2a5  413 |           }
8fab2a5  414 |           console.error('d2da: services emptyTrash child delete', e);
8fab2a5  415 |         }
8fab2a5  416 |       }
8fab2a5  417 |     } catch (e) {
8fab2a5  418 |       if (
8fab2a5  419 |         !this._cancellable?.is_cancelled() &&
8fab2a5  420 |         !(e?.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
8fab2a5  421 |       ) {
8fab2a5  422 |         console.error('d2da: services emptyTrash', e);
8fab2a5  423 |       }
8fab2a5  424 |     } finally {
8fab2a5  425 |       try {
8fab2a5  426 |         iter?.close(null);
8fab2a5  427 |       } catch {
8fab2a5  428 |         // ignore close error
8fab2a5  429 |       }
8fab2a5  430 |     }
8fab2a5  431 | 
8fab2a5  432 |     this.checkTrash();
8fab2a5  433 |     this.extension?.animate?.({ refresh: true });
8fab2a5  434 |   }
8fab2a5  435 | 

// --- Lines 437–437 ---
c0391da  437 |     if (!this.extension.trash_icon || !this._trashDir) return;

// --- Lines 439–466 ---
c0391da  439 |     let iter = null;
c0391da  440 |     try {
c0391da  441 |       iter = this._trashDir.enumerate_children(
c0391da  442 |         'standard::*',
c0391da  443 |         Gio.FileQueryInfoFlags.NONE,
c0391da  444 |         this._cancellable ?? null
c0391da  445 |       );
c0391da  446 |       let prev = this.trashFull;
c0391da  447 |       this.trashFull = iter.next_file(this._cancellable ?? null) != null;
c0391da  448 |       if (prev != this.trashFull) {
c0391da  449 |         this.extension.animate({ refresh: true });
c0391da  450 |       }
c0391da  451 |       return this.trashFull;
c0391da  452 |     } catch (e) {
c0391da  453 |       if (
c0391da  454 |         this._cancellable?.is_cancelled() ||
c0391da  455 |         (e?.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
c0391da  456 |       ) {
c0391da  457 |         return this.trashFull;
c0391da  458 |       }
c0391da  459 |       console.error('d2da: services checkTrash', e);
c0391da  460 |       return this.trashFull;
c0391da  461 |     } finally {
c0391da  462 |       try {
c0391da  463 |         iter?.close(null);
c0391da  464 |       } catch {
c0391da  465 |         // ignore close error
c0391da  466 |       }

// --- Lines 478–489 ---
c0391da  478 |     let enumerator = null;
c0391da  479 |     try {
c0391da  480 |       enumerator = directory.enumerate_children(
c0391da  481 |         [
c0391da  482 |           Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
c0391da  483 |           Gio.FILE_ATTRIBUTE_STANDARD_NAME,
c0391da  484 |           Gio.FILE_ATTRIBUTE_STANDARD_ICON,
c0391da  485 |           Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
c0391da  486 |         ].join(','),
c0391da  487 |         Gio.FileQueryInfoFlags.NONE,
c0391da  488 |         this._cancellable ?? null
c0391da  489 |       );

// --- Lines 491–503 ---
c0391da  491 |       let fileInfo;
c0391da  492 |       while (
c0391da  493 |         (fileInfo = enumerator.next_file(this._cancellable ?? null)) !== null
c0391da  494 |       ) {
c0391da  495 |         let fileName = fileInfo.get_name();
c0391da  496 |         let fileModified = fileInfo.get_modification_time();
c0391da  497 | 
c0391da  498 |         let icon = 'file';
c0391da  499 |         if (fileInfo.get_icon() && fileInfo.get_icon().names) {
c0391da  500 |           icon =
c0391da  501 |             this.extension.lookup_icon_from_names(fileInfo.get_icon().names) ??
c0391da  502 |             icon;
c0391da  503 |         }

// --- Lines 505–514 ---
c0391da  505 |         downloadFiles.push({
c0391da  506 |           index: 0,
c0391da  507 |           name: fileName,
c0391da  508 |           display: fileName,
c0391da  509 |           icon: icon,
c0391da  510 |           type: fileInfo.get_content_type(),
4b343d1  511 |           path: GLib.build_filenamev([path, fileName]),
c0391da  512 |           date: fileModified ?? { tv_sec: 0 },
c0391da  513 |           fileInfo: fileInfo,
c0391da  514 |         });

// --- Lines 517–519 ---
c0391da  517 |       downloadFilesLength = downloadFiles.length;
c0391da  518 |       downloadFiles.sort((a, b) => {
c0391da  519 |         return a.date.tv_sec > b.date.tv_sec ? -1 : 1;

// --- Lines 522–525 ---
c0391da  522 |       let index = 0;
c0391da  523 |       downloadFiles.forEach((f) => {
c0391da  524 |         f.index = index++;
c0391da  525 |       });

// --- Lines 527–544 ---
c0391da  527 |       downloadFiles.splice(max_recent_items);
c0391da  528 |       return [downloadFiles, downloadFilesLength];
c0391da  529 |     } catch (e) {
c0391da  530 |       if (
c0391da  531 |         this._cancellable?.is_cancelled() ||
c0391da  532 |         (e?.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
c0391da  533 |       ) {
c0391da  534 |         return [[], 0];
c0391da  535 |       }
c0391da  536 |       console.error('d2da: services checkRecentFilesInFolder', e);
c0391da  537 |       return [[], 0];
c0391da  538 |     } finally {
c0391da  539 |       try {
c0391da  540 |         enumerator?.close(null);
c0391da  541 |       } catch {
c0391da  542 |         // ignore close error
c0391da  543 |       }
c0391da  544 |     }

// --- Lines 585–587 ---
4b343d1  585 |         const file = Gio.File.new_for_path(
4b343d1  586 |           GLib.build_filenamev([path, fileName])
4b343d1  587 |         );

// --- Lines 638–640 ---
c0391da  638 |         const [success, contents] = await fn.load_contents_async(
c0391da  639 |           this._cancellable ?? null
c0391da  640 |         );

// --- Lines 667–674 ---
c0391da  667 |         if (
c0391da  668 |           this._cancellable?.is_cancelled() ||
c0391da  669 |           (err?.matches &&
c0391da  670 |             err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
c0391da  671 |         ) {
c0391da  672 |           return [[], 0];
c0391da  673 |         }
c0391da  674 |         console.error('d2da: services load recents', err);

// --- Lines 693–694 ---
c0391da  693 |       if (!this._debounceRecentsSeq) {
c0391da  694 |         this._debounceRecentsSeq = this.extension._loTimer.runDebounced(

// --- Lines 702–702 ---
c0391da  702 |         this.extension._loTimer.runDebounced(this._debounceRecentsSeq);

// --- Lines 709–710 ---
c0391da  709 |       let path = this._downloadsDir?.get_path();
c0391da  710 |       if (!path) return;

// --- Lines 714–721 ---
c0391da  714 |       if (
c0391da  715 |         this._cancellable?.is_cancelled() ||
c0391da  716 |         (err?.matches &&
c0391da  717 |           err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
c0391da  718 |       ) {
c0391da  719 |         return;
c0391da  720 |       }
c0391da  721 |       console.error('d2da: services checkDownloads', err);

// --- Lines 727–728 ---
c0391da  727 |       if (!this._debounceDownloadsSeq) {
c0391da  728 |         this._debounceDownloadsSeq = this.extension._loTimer.runDebounced(

// --- Lines 736–736 ---
c0391da  736 |         this.extension._loTimer.runDebounced(this._debounceDownloadsSeq);

// --- Lines 741–760 ---
0821a56  741 |   // keyed by root URI so two volumes with the same name get separate items;
0821a56  742 |   // checksum keeps the file name / desktop id stable and filesystem-safe
0821a56  743 |   _getMountAppName(mount) {
0821a56  744 |     let uri = mount.get_root()?.get_uri() ?? this._getMountName(mount);
0821a56  745 |     let key = GLib.compute_checksum_for_string(
0821a56  746 |       GLib.ChecksumType.SHA1,
0821a56  747 |       uri,
0821a56  748 |       -1
0821a56  749 |     );
0821a56  750 |     return `mount-${key}-dash2dock-lite.desktop`;
0821a56  751 |   }
0821a56  752 | 
0821a56  753 |   _escapeDesktopValue(value) {
0821a56  754 |     return value
0821a56  755 |       .replace(/\\/g, '\\\\')
0821a56  756 |       .replace(/\n/g, '\\n')
0821a56  757 |       .replace(/\r/g, '\\r')
0821a56  758 |       .replace(/\t/g, '\\t');
0821a56  759 |   }
0821a56  760 | 

// --- Lines 762–763 ---
0821a56  762 |     let name = mount.get_name();
0821a56  763 |     if (!name && mount.get_drive()) {

// --- Lines 779–779 ---
0821a56  779 |     return name || 'Volume';

// --- Lines 784–785 ---
1553b9d  784 |       this._mounts = {};
1553b9d  785 |       this.mountApps = {};

// --- Lines 829–835 ---
0a01a50  829 |           // renderArea may be destroyed first (shell shutdown); drop the refs
0a01a50  830 |           // so dock._cleanupIcon never touches a disposed clock
0a01a50  831 |           clock.connect('destroy', () => {
0a01a50  832 |             if (item._image === clock) item._image = null;
0a01a50  833 |             if (item._clock === clock) item._clock = null;
0a01a50  834 |             if (dock._clock === clock) dock._clock = null;
0a01a50  835 |           });

// --- Lines 869–873 ---
0a01a50  869 |           calendar.connect('destroy', () => {
0a01a50  870 |             if (item._image === calendar) item._image = null;
0a01a50  871 |             if (item._calendar === calendar) item._calendar = null;
0a01a50  872 |             if (dock._calendar === calendar) dock._calendar = null;
0a01a50  873 |           });

```

<a id="stylejs"></a>
### `style.js` (+74 lines across 11 hunks)

```javascript
// --- Lines 6–13 ---
d96998c    6 | 
d96998c    7 | const INSTANCE_ID = (() => {
d96998c    8 |   try {
d96998c    9 |     return new Gio.Credentials().get_unix_pid();
d96998c   10 |   } catch {
d96998c   11 |     return GLib.uuid_string_random();
d96998c   12 |   }
d96998c   13 | })();

// --- Lines 23–23 ---
d96998c   23 |     let theme = ctx ? ctx.get_theme() : null;

// --- Lines 26–32 ---
d96998c   26 |       if (theme && fn) {
d96998c   27 |         try {
d96998c   28 |           theme.unload_stylesheet(fn);
d96998c   29 |         } catch (err) {
d96998c   30 |           console.error('d2da: style unloadAll unload_stylesheet', err);
d96998c   31 |         }
d96998c   32 |       }

// --- Lines 34–46 ---
d96998c   34 |       if (fn) {
d96998c   35 |         try {
d96998c   36 |           fn.delete(null);
d96998c   37 |         } catch (err) {
d96998c   38 |           if (
d96998c   39 |             !(
d96998c   40 |               err?.matches &&
d96998c   41 |               err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
d96998c   42 |             )
d96998c   43 |           ) {
d96998c   44 |             console.error('d2da: style unloadAll', err);
d96998c   45 |           }
d96998c   46 |         }

// --- Lines 49–50 ---
d96998c   49 |     this.styles = {};
d96998c   50 |     this.style_contents = {};

// --- Lines 55–55 ---
d96998c   55 |     let theme = ctx ? ctx.get_theme() : null;

// --- Lines 67–74 ---
d96998c   67 |     const runtimeDir = GLib.get_user_runtime_dir() || GLib.get_tmp_dir();
d96998c   68 |     GLib.mkdir_with_parents(runtimeDir, 0o700);
d96998c   69 |     const targetPath = GLib.build_filenamev([
d96998c   70 |       runtimeDir,
d96998c   71 |       `d2da-${name}-${INSTANCE_ID}.css`,
d96998c   72 |     ]);
d96998c   73 | 
d96998c   74 |     let fn = this.styles[name];

// --- Lines 76–104 ---
d96998c   76 |       if (fn.get_path() !== targetPath) {
d96998c   77 |         if (theme) {
d96998c   78 |           try {
d96998c   79 |             theme.unload_stylesheet(fn);
d96998c   80 |           } catch (err) {
d96998c   81 |             console.error('d2da: style build unload_stylesheet', err);
d96998c   82 |           }
d96998c   83 |         }
d96998c   84 |         try {
d96998c   85 |           fn.delete(null);
d96998c   86 |         } catch (err) {
d96998c   87 |           if (
d96998c   88 |             !(
d96998c   89 |               err?.matches &&
d96998c   90 |               err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)
d96998c   91 |             )
d96998c   92 |           ) {
d96998c   93 |             console.error('d2da: style build cleanup', err);
d96998c   94 |           }
d96998c   95 |         }
d96998c   96 |         fn = Gio.File.new_for_path(targetPath);
d96998c   97 |         this.styles[name] = fn;
d96998c   98 |       } else if (theme) {
d96998c   99 |         try {
d96998c  100 |           theme.unload_stylesheet(fn);
d96998c  101 |         } catch (err) {
d96998c  102 |           console.error('d2da: style build unload_stylesheet', err);
d96998c  103 |         }
d96998c  104 |       }

// --- Lines 106–106 ---
d96998c  106 |       fn = Gio.File.new_for_path(targetPath);

// --- Lines 111–111 ---
d96998c  111 |     fn.replace_contents(

// --- Lines 119–121 ---
d96998c  119 |     if (theme) {
d96998c  120 |       theme.load_stylesheet(fn);
d96998c  121 |     }

```

<a id="timerjs"></a>
### `timer.js` (+57 lines across 17 hunks)

```javascript
// --- Lines 5–8 ---
ef879f9    5 | // Module-wide so handles from a previous Timer (e.g. before disable/enable)
ef879f9    6 | // can never share an id with a subscription of the current one.
ef879f9    7 | let nextSubscriberId = 0xff;
ef879f9    8 | 

// --- Lines 38–38 ---
ef879f9   38 |     let sourceId = GLib.timeout_add(

// --- Lines 41–56 ---
ef879f9   41 |       () => {
ef879f9   42 |         let keep = false;
ef879f9   43 |         try {
ef879f9   44 |           keep = this.onUpdate();
ef879f9   45 |         } catch (e) {
ef879f9   46 |           console.error(`d2da: timer ${this._name} update`, e);
ef879f9   47 |         }
ef879f9   48 |         if (keep && this._timeoutId === sourceId) {
ef879f9   49 |           return GLib.SOURCE_CONTINUE;
ef879f9   50 |         }
ef879f9   51 |         // the source dies here; keep is_running() truthful
ef879f9   52 |         if (this._timeoutId === sourceId) {
ef879f9   53 |           this._timeoutId = null;
ef879f9   54 |         }
ef879f9   55 |         return GLib.SOURCE_REMOVE;
ef879f9   56 |       }

// --- Lines 58–58 ---
ef879f9   58 |     this._timeoutId = sourceId;

// --- Lines 158–169 ---
ef879f9  158 |     // Iterate a snapshot: unsubscribe() never mutates the array in place
ef879f9  159 |     // (it replaces it), so subscribers may unsubscribe during the loop.
ef879f9  160 |     // Not slice()d: a re-armed handle replaced in place by subscribe() must be
ef879f9  161 |     // seen in its reset state, and this runs every tick of the animation timer.
ef879f9  162 |     const subscribers = this._subscribers;
ef879f9  163 |     const count = subscribers.length;
ef879f9  164 |     for (let i = 0; i < count; i++) {
ef879f9  165 |       const s = subscribers[i];
ef879f9  166 |       if (!s.onUpdate) {
ef879f9  167 |         continue;
ef879f9  168 |       }
ef879f9  169 |       try {

// --- Lines 171–175 ---
ef879f9  171 |       } catch (e) {
ef879f9  172 |         console.error(
ef879f9  173 |           `d2da: timer ${this._name} subscriber ${s._name ?? s._id}`,
ef879f9  174 |           e
ef879f9  175 |         );

// --- Lines 177–177 ---
ef879f9  177 |     }

// --- Lines 201–205 ---
ef879f9  201 |     // stale handle from another (e.g. pre-disable) Timer: treat as new
ef879f9  202 |     if (obj._timer && obj._timer !== this) {
ef879f9  203 |       delete obj._id;
ef879f9  204 |       delete obj._timer;
ef879f9  205 |     }

// --- Lines 207–207 ---
ef879f9  207 |       obj._id = nextSubscriberId++;

// --- Lines 209–209 ---
ef879f9  209 |     obj._timer = this;

// --- Lines 223–224 ---
ef879f9  223 |       this._subscribers.length > 0 &&
ef879f9  224 |       !this.is_running()

// --- Lines 306–306 ---
ef879f9  306 |             s._timer.unsubscribe(s);

// --- Lines 330–330 ---
ef879f9  330 |           s._timer.unsubscribe(s);

// --- Lines 352–352 ---
ef879f9  352 |           s._timer.unsubscribe(s);

// --- Lines 373–373 ---
ef879f9  373 |           s._timer.unsubscribe(s);

// --- Lines 391–393 ---
ef879f9  391 |     if (typeof array === 'object' && !array.length) {
ef879f9  392 |       array._time = 0;
ef879f9  393 |       return this.subscribe(array);

// --- Lines 431–431 ---
ef879f9  431 |           s._timer.unsubscribe(s);

```

<a id="utilsjs"></a>
### `utils.js` (+29 lines across 5 hunks)

```javascript
// --- Lines 17–17 ---
d96998c   17 |  * Return a path in user runtime directory with a unique name

// --- Lines 22–23 ---
d96998c   22 |   const runtimeDir = GLib.get_user_runtime_dir() || GLib.get_tmp_dir();
d96998c   23 |   return GLib.build_filenamev([runtimeDir, `d2da-${path}`]);

// --- Lines 101–114 ---
4b343d1  101 | export const getDownloadsDir = () => {
4b343d1  102 |   return (
4b343d1  103 |     GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) ||
4b343d1  104 |     GLib.build_filenamev([GLib.get_home_dir(), 'Downloads'])
4b343d1  105 |   );
4b343d1  106 | };
4b343d1  107 | 
4b343d1  108 | export const getDocumentsDir = () => {
4b343d1  109 |   return (
4b343d1  110 |     GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS) ||
4b343d1  111 |     GLib.build_filenamev([GLib.get_home_dir(), 'Documents'])
4b343d1  112 |   );
4b343d1  113 | };
4b343d1  114 | 

// --- Lines 122–132 ---
4b343d1  122 |         try {
4b343d1  123 |           let [ok, contents] = f.load_contents_finish(res);
4b343d1  124 |           if (!ok) {
4b343d1  125 |             reject(new Error('unable to load file'));
4b343d1  126 |             return;
4b343d1  127 |           }
4b343d1  128 |           const decoder = new TextDecoder();
4b343d1  129 |           let contentsString = decoder.decode(contents);
4b343d1  130 |           resolve(contentsString);
4b343d1  131 |         } catch (err) {
4b343d1  132 |           reject(err);

// --- Lines 136–136 ---
4b343d1  136 |       reject(new Error('file not found'));

```

<a id="windowTrackerjs"></a>
### `windowTracker.js` (+50 lines across 1 hunks)

```javascript
// --- Lines 1–50 ---
deb31fb    1 | 'use strict';
deb31fb    2 | 
deb31fb    3 | // Window connections for autohide dodge, owned by the extension and shared by
deb31fb    4 | // all docks: one connection set per Meta.Window, no expandos on the window.
deb31fb    5 | // A window is released on 'unmanaged', on untrack() and on clear()/destroy().
deb31fb    6 | export class WindowTracker {
deb31fb    7 |   constructor(onChange) {
deb31fb    8 |     this._onChange = onChange;
deb31fb    9 |     this._windows = new Set();
deb31fb   10 |   }
deb31fb   11 | 
deb31fb   12 |   get size() {
deb31fb   13 |     return this._windows.size;
deb31fb   14 |   }
deb31fb   15 | 
deb31fb   16 |   track(window) {
deb31fb   17 |     if (!window || !this._onChange || this._windows.has(window)) return;
deb31fb   18 |     const changed = () => this._onChange?.();
deb31fb   19 |     window.connectObject(
deb31fb   20 |       'position-changed',
deb31fb   21 |       changed,
deb31fb   22 |       'size-changed',
deb31fb   23 |       changed,
deb31fb   24 |       'unmanaged',
deb31fb   25 |       () => this.untrack(window),
deb31fb   26 |       this
deb31fb   27 |     );
deb31fb   28 |     this._windows.add(window);
deb31fb   29 |   }
deb31fb   30 | 
deb31fb   31 |   untrack(window) {
deb31fb   32 |     if (!this._windows.delete(window)) return;
deb31fb   33 |     try {
deb31fb   34 |       window.disconnectObject(this);
deb31fb   35 |     } catch (e) {
deb31fb   36 |       console.error('d2da: window tracker untrack', e);
deb31fb   37 |     }
deb31fb   38 |   }
deb31fb   39 | 
deb31fb   40 |   clear() {
deb31fb   41 |     for (const window of [...this._windows]) {
deb31fb   42 |       this.untrack(window);
deb31fb   43 |     }
deb31fb   44 |   }
deb31fb   45 | 
deb31fb   46 |   destroy() {
deb31fb   47 |     this.clear();
deb31fb   48 |     this._onChange = null;
deb31fb   49 |   }
deb31fb   50 | }

```
