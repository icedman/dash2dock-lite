# Ultimate Shell Prototype: DockModel, Extensible Widgets & Autonomous Sub-Docks

This prototype demonstrates **The Ultimate Shell** architecture outlined in [`docs/DESIGN.md`](../docs/DESIGN.md), eliminating upstream GNOME Shell `ui/dash.js` dependencies in favor of a clean, observable `DockModel` with pluggable `ItemSources` and a deterministic physical canvas.

---

## 1. Directory Structure

- [`prototype/dockItem.js`](dockItem.js): Unified `DockItem` base class, event protocol (`onClick`, `onHover`, `onScroll`), status indicators, notification badges, and custom Cairo draw hooks.
- [`prototype/dockWidgets.js`](dockWidgets.js): Sample widgets:
  - **`ClockWidget`**: Live analog clock rendered via custom Cairo vector primitives.
  - **`TrashWidget`**: Dynamic file counter, empty/full state switching, and simulation actions.
  - **`SeparatorItem`**: Visual partition between favorites, running apps, and widgets.
  - **`DrawerItem`**: Collapsible folder container that unfolds into a perpendicular sub-dock.
- [`prototype/dockSources.js`](dockSources.js): Pluggable data sources:
  - `MockFavoritesSource`: Pinned applications.
  - `MockRunningAppsSource`: Dynamically discovered running apps.
  - `MockDrawerSource`: Categorized app groupings (e.g. Media Tools drawer).
  - `MockWidgetsSource`: Micro-widgets and status meters.
- [`prototype/dockModel.js`](dockModel.js): Reactive collection maintaining canonical dock items (`DockModel`) and interactive view state (`DockViewState`) with frozen snapshotting, localized coordinates, and hit-testing.
- [`prototype/dock_prototype.js`](dock_prototype.js): Standalone GTK4 + Cairo + Rsvg interactive runner with localized mouse space-warping, magnification, real SVG icon loading, wallpaper backdrop, and autonomous popup sub-docks with frozen parent anchoring.

---

## 2. Running the Prototype

```bash
gjs -m prototype/dock_prototype.js
```

### Interactive Controls
- **Mouse Hover**: Triggers smooth, localized bell-curve magnification; lerps gracefully to resting slots on departure.
- **Left Click on Apps**: Triggers launch / activation simulation with tactile bounce.
- **Left Click on Trash**: Toggles between full and empty states, updating the notification badge and icon.
- **Left Click on Drawer**: Spawns an interactive **Child Sub-Dock** popup. Automatically freezes the calling parent dock at its current layout and locks the callout arrow alignment.
- **Sub-Dock Interaction**: Sub-dock features fully localized mouse tracking and independent magnification. Clicking outside dismisses the sub-dock and smoothly unfreezes the parent dock.
- **Up / Down Arrow Keys**: Increase / decrease maximum magnification scale ($M$).
- **Left / Right Arrow Keys**: Adjust radius of influence ($R$).
- **C Key**: Cycle bell curve formula (Linear Proximity, Cosine Bell, Smoothstep).
- **R Key**: Cycle dock screen edge (**BOTTOM, LEFT, TOP, RIGHT**).

---

## 3. Granular Steps to Port into `dash2dock-lite`

### Step 1: Core Model Extraction (Non-Destructive)
1. Copy [`dockItem.js`](dockItem.js) and [`dockModel.js`](dockModel.js) to the extension root.
2. Implement real GNOME Shell `ItemSources` in `dockSources.js`:
   - `FavoritesSource` connects to `AppFavorites.getAppFavorites()`.
   - `RunningAppsSource` connects to `Shell.AppSystem.get_default()` and `Shell.WindowTracker.get_default()`.
   - `WidgetSource` integrates existing `Clock`, `Calendar`, and `Trash` services.

### Step 2: Dual-Backend Feature Toggle
1. Add an experimental toggle in [`preferences/keys.js`](../preferences/keys.js) (`use-native-dockmodel`).
2. In [`dock.js`](../dock.js), conditionally branch between `createDash()` (legacy proxy) and `DockModel` + `DockGrid` (`St.BoxLayout`).
3. Verify that all standard unit tests and headless smoke tests continue to pass with 0 errors.

### Step 3: Hit-Testing & Animator Binding
1. Bind invisible `DockItemContainer` actors (`opacity: 0`) in the layout to handle pointer and click events.
2. Feed real-time layout bounds directly into [`animator.js`](../animator.js) without passing through `Dash.js`.

### Step 4: Icon Drawers & Popup Sub-Docks
1. Wire `DrawerItem` click events to instantiate a child `Dock` popup anchored perpendicularly to the parent dock.
2. Connect drag-and-drop to reorder items inside drawers or along the main dock.

### Step 5: Full Decoupling & Deprecation
1. Remove `import { Dash } from 'resource:///org/gnome/shell/ui/dash.js'` from `dock.js`.
2. Delete monkeypatches (`setupDashProxy`, `_adjustIconSize`, `_createAppItem`).
3. Clean up obsolete private accessors in `compat.js`.
