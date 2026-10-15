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

---

# Layout Crash Investigation: "Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation"

## 1. Overview & Issue Description

During first login or cold shell startup, Dash2Dock-Lite intermittently triggered repeated Mutter warnings in `journalctl`:

```text
Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation.
Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation.
Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation.
Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation.
```

In extreme conditions or under heavy I/O during session startup, this layout desynchronization can cascade into unhandled exceptions or shell stuttering/crashes.

This section documents:
1. The exact mechanism inside Mutter/Clutter triggering this warning.
2. Why the actor was reported as `unnamed [ClutterActor]`.
3. Why this specifically manifests on first login.
4. An analysis of changes made since base commit `f8766841c15017bff2705d0be75cf161da505e0a`.
5. The naming of Clutter/St actors across the codebase to ensure pinpoint identification if layout issues occur.
6. Defensive safeguards (`has_allocation()`, NaN guards, `try/catch`) added to prevent the condition entirely.

## 2. Root Cause in Mutter / Clutter Architecture

### 2.1 The Warning Site in Mutter Source

In Mutter's Clutter implementation (`mutter/clutter/clutter/clutter-actor.c:14959`), the function `update_stage_views()` executes during the stage layout cycle (`clutter_actor_finish_layout`):

```c
static void
update_stage_views (ClutterActor *self)
{
  ClutterActorPrivate *priv = self->priv;
  ...
  if (priv->needs_allocation)
    {
      g_warning ("Can't update stage views actor %s is on because it needs an "
                 "allocation.", _clutter_actor_get_debug_name (self));
      priv->stage_views = g_list_copy (clutter_stage_peek_stage_views (stage));
      goto out;
    }

  clutter_actor_get_transformed_extents (self, &bounding_rect);
  ...
}
```

### 2.2 Why `unnamed [ClutterActor]`?

In `mutter/clutter/clutter/clutter-actor.c:1028`, `_clutter_actor_get_debug_name()` formats the actor identifier:

```c
_clutter_actor_get_debug_name (ClutterActor *actor)
{
  ...
  if (G_UNLIKELY (priv->debug_name == NULL))
    {
      priv->debug_name = g_strdup_printf ("%s [%s]",
                                          priv->name != NULL ? priv->name
                                                             : "unnamed",
                                          G_OBJECT_TYPE_NAME (actor));
    }
  return priv->debug_name;
}
```

When an actor has no `name` property assigned (`priv->name == NULL`), Clutter defaults the prefix to `"unnamed"`.
Crucially, `G_OBJECT_TYPE_NAME (actor)` reports `[ClutterActor]` **only** when the instance is directly of type `ClutterActor` (such as `new Clutter.Actor()`), whereas subclasses report their specific type (e.g. `[StWidget]`, `[StIcon]`, `[StDrawingArea]`, `[StBoxLayout]`).

Two primary sources in the GNOME Shell / Mutter pipeline instantiate raw `Clutter.Actor` objects without names:

1. **GNOME Shell's `Dash` sizerBox (`gnome-shell/js/ui/dash.js:364`)**:
   ```javascript
   const sizerBox = new Clutter.Actor();
   this._background.add_child(sizerBox);
   ```
   In Dash2Dock-Lite (`dock.js`), the upstream Dash background is hidden:
   ```javascript
   this.dash = dash;
   this.dash._background.visible = false;
   ```
   Because `_background.visible = false`, Clutter does not allocate `_background` or its children. However, `sizerBox` has `Clutter.BindConstraint`s bound to `_dashContainer` and `_showAppsIcon.icon`. When the dock or dash container moves, the constraints dirty the actor geometry and flag `needs_update_stage_views = TRUE`. When `clutter_actor_finish_layout()` runs, `sizerBox` still has `priv->needs_allocation == TRUE` because its parent is hidden.

2. **`StTextureCache` Async Placeholder Actor (`gnome-shell/src/st/st-texture-cache.c:124`)**:
   ```c
   static ClutterActor *
   create_invisible_actor (void)
   {
     return g_object_new (CLUTTER_TYPE_ACTOR,
                          "opacity", 0,
                          "request-mode", CLUTTER_REQUEST_CONTENT_SIZE,
                          NULL);
   }
   ```
   When `St.Icon` requests an icon texture that is not yet in the memory cache (common on first login), `StTextureCache` creates an unallocated `CLUTTER_TYPE_ACTOR` with opacity 0 as a placeholder child inside the `St.Icon`. Until the asynchronous file read finishes and the texture is realized, this placeholder actor sits inside the stage hierarchy with `needs_allocation = TRUE`.

3. **Extension custom widgets lacking explicit names**:
   Several custom actors in Dash2Dock-Lite (`Dot`, `DotCanvas`, `Clock`, `Calendar`, `DockIcon`, `DockItemContainer`, `_extraIcons`, etc.) did not define a `name` property on initialization.

## 3. First-Login Race Condition & Lifecycle Mechanism

On first login, the following sequence occurs:

1. **Extension Initialization**:
   In `extension.js`, `enable()` initializes the timers and schedules `startUp()` with a 250ms debounce:
   ```javascript
   this._loTimer.runOnce(() => {
     this.startUp();
   }, 250);
   ```
2. **Asynchronous App Discovery**:
   As GNOME Shell's `AppSystem` discovers installed applications, it emits `installed-changed` or changes favorites. This triggers `_onAppsChanged()` in `dock.js`:
   ```javascript
   _onAppsChanged(evt) {
     this._favorite_ids = Fav.getAppFavorites()._getIds();
     this._icons = null;
     this._fast_forward = 20;
     this._beginAnimation();
     this.autohider._debounceCheckHide();
     return Clutter.EVENT_PROPAGATE;
   }
   ```
3. **The Synchronous Fast-Forward Loop**:
   In `dock.js`, `this.animate(dt)` was implemented as:
   ```javascript
   this.animator.animate(dt);

   if (!this._pauseBounce || this._pauseBounce <= 0) {
     while (this._fast_forward && this._fast_forward-- > 0) {
       this.animate(dt);
       this.dash.opacity = 0;
     }
   }
   ```
   `this.animate(dt)` was called **20 times synchronously within a single frame tick**.
4. **Layout Desynchronization in `animator.js`**:
   In `animator.js`, `animate()` immediately queried:
   ```javascript
   let pos = icon.get_transformed_position();
   let renderOffset = dock.renderArea.get_transformed_position();
   ```
   And repositioned overlays:
   ```javascript
   dots.set_position(x, y);
   dots.visible = true;
   badge.set_position(x, y);
   badge.visible = true;
   ```
   Because Mutter had not yet completed the initial allocation cycle for newly created dock items and cold-loading `St.Icon` textures:
   - `dock.has_allocation()` was `false`.
   - `dock.renderArea.has_allocation()` was `false`.
   - `get_transformed_position()` returned unallocated/NaN coordinates.
   - Setting positions and visibility on unallocated overlay actors queued layout passes and marked `needs_update_stage_views = TRUE` before an allocation could be calculated.
   - Mutter subsequently logged `Can't update stage views actor unnamed [ClutterActor] is on because it needs an allocation.` for each unallocated actor touched.

## 4. Git Diff Analysis: Commits from `f8766841c15017bff2705d0be75cf161da505e0a` to `HEAD`

A diff inspection from commit `f8766841c15017bff2705d0be75cf161da505e0a` (the baseline prior to modern phase rework) reveals several key commits influencing actor lifecycle and layout:

| Commit | Message | Impact on Actor Lifecycle & Layout |
| :--- | :--- | :--- |
| `d3ba248` | `fix(animator): defer frame when precreating pool resources` | **Critical finding:** Added `let did_create = false;` to `_precreateResources()` which returned `false` on pool actor creation. This acknowledged the issue of newly added pool actors needing a frame to settle, but only deferred by 15ms and did not check `has_allocation()`. |
| `1553b9d` | `fix(services): launchers in memory from GLib.KeyFile without /tmp` | Migrated launcher creation to in-memory `DesktopAppInfo` and added dynamic menu generation on item creation. |
| `d95bb11` | `fix(dock): destroy docks, Shell Dash and chrome actors on teardown` | Introduced explicit destruction of docks and shell chrome actors. Ensured destroyed actors are not left lingering in layout managers. |
| `c0391da` | `fix(services): cancellables, debounces, enumerators and measured dt` | Added cancellable Gio operations and measured monotonic dt. Prevented services from firing uncoordinated layout updates during startup. |
| `1b03ca7` | `fix(dock): input fixes for scroll, activate patch and icon effect removal` | Refined appwell activate and icon effect application. |
| `c9ca876` | `fix(extension): dc_monitor, icon-size case, icon_theme, restore overview dash` | Ensured overview dash state restoration on disable and monitor index reconciliation. |
| `d96998c` | `fix(style): CSS in runtime dir without /tmp per shell instance` | Clean stylesheet loading with per-instance runtime scoping. |

## 5. Defensive Measures Implemented

### 5.1 Comprehensive Actor Naming (No More "unnamed")

All Clutter and St actors created or managed across the extension now have distinct, descriptive names prefixed with `d2da`. Existing names (such as `d2daIcon`, `DockRenderArea`, `DockStruts`, `DockDwell`, `DockItemList`, `DockBackground`, and `dashtodockContainer`) have been preserved.

| File | Component / Actor | Assigned Name |
| :--- | :--- | :--- |
| `dock.js` | `this.fake_dash_background` | `'d2daFakeDashBackground'` |
| `dock.js` | `this.dash._background.first_child` (Shell sizerBox) | `'d2daDashSizerBox'` |
| `dock.js` | `this._extraIcons` (`St.BoxLayout`) | `'d2daExtraIcons'` |
| `dock.js` | `this._separator` (`St.Widget`) | `'d2daSeparator'` |
| `dockItems.js` | `DockItemOverlay` | `params?.name \|\| 'd2daItemOverlay'` |
| `dockItems.js` | `DockItemDotsOverlay` | `'d2daDotsOverlay'` |
| `dockItems.js` | `DockItemBadgeOverlay` | `'d2daBadgeOverlay'` |
| `dockItems.js` | `DockIcon` (`DashIcon`) | `params?.name \|\| 'd2daDockIcon'` |
| `dockItems.js` | `DockIcon._iconActor` (`St.Icon`) | `'d2daDockIconActor'` |
| `dockItems.js` | `DockItemContainer` (`DashItemContainer`) | `'d2daItemContainer'` |
| `dockItems.js` | `DockItemContainer.label` (`St.Label`) | `'d2daItemLabel'` |
| `dockItemMenu.js` | `this._box` (`St.Widget`) | `'d2daListBox'` |
| `dockItemMenu.js` | `this._labels` (`St.Widget`) | `'d2daListLabels'` |
| `dockItemMenu.js` | `w` (Menu item row `St.Widget`) | `'d2daListItem'` |
| `dockItemMenu.js` | `wl` (Menu label container `St.Widget`) | `'d2daListLabelContainer'` |
| `dockItemMenu.js` | `label` (Menu item `St.Label`) | `'d2daListLabel'` |
| `apps/dot.js` | `Dot` (`St.Widget`) | `'d2daDot'` |
| `apps/dot.js` | `DotCanvas` (`St.DrawingArea`) | `'d2daDotCanvas'` |
| `apps/clock.js` | `Clock` (`St.Widget`) | `'d2daClock'` |
| `apps/clock.js` | `ClockCanvas` (`St.DrawingArea`) | `'d2daClockCanvas'` |
| `apps/calendar.js` | `Calendar` (`St.Widget`) | `'d2daCalendar'` |
| `apps/calendar.js` | `CalendarCanvas` (`St.DrawingArea`) | `'d2daCalendarCanvas'` |
| `apps/overlay.js` | `DebugOverlay` (`Clutter.Actor`) | `'d2daDebugOverlay'` |

### 5.2 Allocation Guards & Defensive Safeguards in `animator.js`

In `animator.js`:

1. **`try/catch` Error Boundary**:
   The public entry point `animate(dt)` wraps `_animate(dt)` in a `try/catch` block, preventing unhandled layout errors from propagating to the main GLib event loop or crashing GNOME Shell:
   ```javascript
   animate(dt) {
     try {
       this._animate(dt);
     } catch (err) {
       console.error('d2da: animator animate', err);
     }
   }
   ```

2. **Allocation Presence Check**:
   Before reading actor dimensions, querying transformed coordinates, or setting overlay actor coordinates, `_animate()` verifies that both the dock and its `renderArea` have completed an allocation pass:
   ```javascript
   if (!dock.has_allocation() || !dock.renderArea?.has_allocation()) {
     return;
   }
   ```
   If an allocation pass has not finished (e.g. during initial startup or monitor reconfiguration), `animate()` immediately exits cleanly and waits for Mutter's layout cycle to finish.

3. **Coordinate Sanity (NaN / Null) Checks**:
   Protected against unallocated or intermediate transformed coordinates:
   ```javascript
   let pos = icon.get_transformed_position();
   if (!pos || isNaN(pos[0]) || isNaN(pos[1])) return;
   ```
   and for `renderArea`:
   ```javascript
   let renderOffset = dock.renderArea.get_transformed_position();
   if (!renderOffset || isNaN(renderOffset[0]) || isNaN(renderOffset[1])) {
     return;
   }
   ```
