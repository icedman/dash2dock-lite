# Dock layout sizing

How `Dock.relayout()` (`dock.js`) sizes the dock, and what keeps the size
deterministic.

## Rule

Icon size, icon slot size, and the dash's **cross-axis size** (height for a
horizontal dock, width for a vertical one) come only from:

- settings (`icon_size`, `scale`/shrink, `icon_spacing`, `animation_spread`,
  custom config `icon-size`)
- the monitor (size, `geometry_scale`)
- the item count from `_layoutIconCount()`

They must **not** depend on which actors the Shell `Dash` has created so far,
or on the natural size of those actors.

## Pipeline

1. `_preferredIconSize()` is a pure function of settings and monitor scale. If
   `relayout()` hasn't set `_scaleFactor` yet, it reads the scale from the
   monitor. It has no side effects; `relayout()` sets `_iconSize`.
2. `_layoutIconCount()` counts app items from the app model, using the same
   rule as Shell `Dash._redisplay()`: favorites, plus running apps that aren't
   favorites (skipped when `favorites_only` is on). Non-app items, meaning extra
   icons and showApps, are counted from `_icons`; d2da creates those
   synchronously in `_updateExtraIcons()`.
3. `relayout()` applies shrink-to-fit (`scaleDown`) based on that count, then
   computes `iconSize` (stored in `_iconSizeScaledDown`) and the slot size
   `itemSize = floor(iconSizeSpaced * scaleFactor)`.
4. Every icon is set to `itemSize` × `itemSize`. In a horizontal dock,
   separators are capped at `itemSize`.
5. The dash's cross-axis size is pinned to `itemSize`; the main axis is left
   natural (`-1`).
6. `_snapToContainerEdge(this, this.dash)` uses that pinned size, so the snap
   gives the same result in every frame.

## Why (the "dock too high when an app opens" bug)

Before this, `dash.height` was its natural size: the tallest child at that
moment. These could be taller than `itemSize`:

- The Shell separator is created at `Dash.iconSize`, which stays 64px because
  `setupDashProxy` stubs out `_adjustIconSize`. It appears when the first
  running app that isn't a favorite opens.
- The d2da separator (`_separator`) is a fixed 48px.
- A newly created Shell item requests 64px until `relayout()` sizes it.
  `_beginAnimation()` snaps before the animator's `relayout()` runs.

A taller dash with its bottom edge pinned centers the icons higher up. Other
sources of size changes:

- `_preferredIconSize()` computed `1 + (2 - undefined) || 1`, which is 1, before
  the first `relayout()`, and 2 after it (at scale 1). So it gave two different
  values.
- `icon_size == 1.0` read past the end of the size table and fell back to 64.
- The count was `_icons.length`, which changed depending on when the Dash filled
  in (0 icons at first meant no shrink, so large icons that shrank later). It
  also included items still animating out (`animatingOut`, about 200ms before
  `destroy`), and hidden non-favorites when `_favorite_ids` wasn't loaded yet.

## Items animating out

`_inspectIcon()` collapses an item with `animatingOut` set to 0×0 and skips it.
`_findIcons()` clears its cache as soon as one appears, because `child-removed`
only fires when the item is destroyed. The item is collapsed, not hidden, so
the Shell's ease keeps running and its `onComplete` still destroys it.
