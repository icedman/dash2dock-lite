// gjs -m tests/compat_baseline_check.js — Task 4.1 baseline functional check
// Tests app & icon discovery contracts, favorites querying, window maximize arity,
// and overview interactions against simulated GNOME 45–50 data structures.

let failures = 0;
function check(cond, msg) {
  print(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) {
    failures++;
  }
}

// ---------------------------------------------------------------------
// 1. App ID Resolution Baseline
// ---------------------------------------------------------------------
function resolveAppId(appwell) {
  if (!appwell) return '';
  if (typeof appwell.getId === 'function') {
    try {
      const id = appwell.getId();
      if (id) return id;
    } catch (_) {}
  }
  if (appwell.app && typeof appwell.app.get_id === 'function') {
    try {
      const id = appwell.app.get_id();
      if (id) return id;
    } catch (_) {}
  }
  if (appwell.id) return appwell.id;
  if (appwell._id) return appwell._id;
  return '';
}

// Case 1a: GNOME Shell 50 AppIcon (has getId() and app.get_id() and _id)
const appwell50 = {
  _id: 'org.gnome.Nautilus.desktop',
  app: { get_id: () => 'org.gnome.Nautilus.desktop' },
  getId() { return this.app.get_id(); },
};
check(
  resolveAppId(appwell50) === 'org.gnome.Nautilus.desktop',
  'App ID: resolves via getId() on modern AppIcon'
);

// Case 1b: Legacy AppIcon without getId() but with app.get_id()
const appwellLegacy = {
  _id: 'org.gnome.Terminal.desktop',
  app: { get_id: () => 'org.gnome.Terminal.desktop' },
};
check(
  resolveAppId(appwellLegacy) === 'org.gnome.Terminal.desktop',
  'App ID: resolves via app.get_id() when getId() missing'
);

// Case 1c: Appwell with only private _id (e.g. bounce target)
const appwellPrivate = {
  _id: 'org.gnome.Calculator.desktop',
};
check(
  resolveAppId(appwellPrivate) === 'org.gnome.Calculator.desktop',
  'App ID: falls back to _id when public getters missing'
);

// Case 1d: Null/empty appwell
check(resolveAppId(null) === '', 'App ID: handles null appwell gracefully');


// ---------------------------------------------------------------------
// 2. Favorites Query Baseline
// ---------------------------------------------------------------------
function getFavoriteAppIds(favManager) {
  if (!favManager) return [];
  // Public GNOME Shell API: getFavorites() returns Array<Shell.App>
  if (typeof favManager.getFavorites === 'function') {
    try {
      const apps = favManager.getFavorites();
      if (Array.isArray(apps)) {
        return apps.map((a) => (typeof a?.get_id === 'function' ? a.get_id() : a?.id ?? ''));
      }
    } catch (_) {}
  }
  // Public GNOME Shell API: getFavoriteMap() returns { [appId]: Shell.App }
  if (typeof favManager.getFavoriteMap === 'function') {
    try {
      const map = favManager.getFavoriteMap();
      if (map && typeof map === 'object') {
        return Object.keys(map);
      }
    } catch (_) {}
  }
  // Legacy / private fallback: _getIds()
  if (typeof favManager._getIds === 'function') {
    try {
      return favManager._getIds();
    } catch (_) {}
  }
  return [];
}

const mockFavApps = [
  { get_id: () => 'org.gnome.Nautilus.desktop' },
  { get_id: () => 'org.gnome.Software.desktop' },
  { get_id: () => 'org.gnome.Settings.desktop' },
];

const mockFavManagerPublic = {
  getFavorites() { return mockFavApps; },
  getFavoriteMap() {
    return {
      'org.gnome.Nautilus.desktop': mockFavApps[0],
      'org.gnome.Software.desktop': mockFavApps[1],
      'org.gnome.Settings.desktop': mockFavApps[2],
    };
  },
  isFavorite(id) {
    return mockFavApps.some((a) => a.get_id() === id);
  },
  _getIds() {
    return mockFavApps.map((a) => a.get_id());
  },
};

const resolvedFavs = getFavoriteAppIds(mockFavManagerPublic);
check(
  resolvedFavs.length === 3 &&
    resolvedFavs[0] === 'org.gnome.Nautilus.desktop' &&
    resolvedFavs[1] === 'org.gnome.Software.desktop' &&
    resolvedFavs[2] === 'org.gnome.Settings.desktop',
  'Favorites: getFavoriteAppIds resolves using public getFavorites()'
);

check(
  mockFavManagerPublic.isFavorite('org.gnome.Nautilus.desktop') === true &&
    mockFavManagerPublic.isFavorite('org.gnome.Gedit.desktop') === false,
  'Favorites: isFavorite correctly identifies member and non-member'
);

// Fallback test: when getFavorites throws or missing, falls back to _getIds
const mockFavManagerPrivateOnly = {
  _getIds() { return ['app1.desktop', 'app2.desktop']; },
};
const fallbackFavs = getFavoriteAppIds(mockFavManagerPrivateOnly);
check(
  fallbackFavs.length === 2 && fallbackFavs[0] === 'app1.desktop',
  'Favorites: fallback to _getIds() works when public API absent'
);


// ---------------------------------------------------------------------
// 3. St.Icon Extraction from AppWell Baseline (_getStIconFromAppwell)
// ---------------------------------------------------------------------
function getStIconFromAppwell(appwell) {
  if (!appwell || !appwell.icon) return null;
  let baseIcon = appwell.icon;

  // Direct St.Icon
  if (baseIcon.isStIcon) return baseIcon;

  // Direct .icon property (works after setIconSize is called)
  if (baseIcon.icon) return baseIcon.icon;

  // GNOME 50: _iconBin.child
  if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;

  // Force icon creation if not yet initialized
  try {
    if (typeof baseIcon.setIconSize === 'function') {
      let size = (typeof baseIcon.iconSize === 'number' && baseIcon.iconSize > 0) ? baseIcon.iconSize : 48;
      baseIcon._createIconTexture(size);
      if (baseIcon.icon) return baseIcon.icon;
      if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;
    }
  } catch (_) {}

  return null;
}

// Case 3a: GNOME 50 BaseIcon with _iconBin.child
const mockStIcon50 = { isStIcon: true, name: 'st-icon-50', opacity: 255 };
const appwellGnome50 = {
  icon: {
    _iconBin: { child: mockStIcon50 },
    icon: null,
  },
};
check(
  getStIconFromAppwell(appwellGnome50) === mockStIcon50,
  'Icon extraction: GNOME 50 BaseIcon extracts from _iconBin.child'
);

// Case 3b: GNOME 46 BaseIcon / IconGrid with .icon property
const mockStIcon46 = { isStIcon: true, name: 'st-icon-46', opacity: 255 };
const appwellGnome46 = {
  icon: {
    icon: mockStIcon46,
    _iconBin: null,
  },
};
check(
  getStIconFromAppwell(appwellGnome46) === mockStIcon46,
  'Icon extraction: GNOME 46 BaseIcon extracts from icon.icon'
);

// Case 3c: Lazy initialization via _createIconTexture
let textureCreated = false;
const mockStIconLazy = { isStIcon: true, name: 'st-icon-lazy', opacity: 255 };
const appwellLazy = {
  icon: {
    icon: null,
    _iconBin: { child: null },
    iconSize: 48,
    setIconSize(size) { this._createIconTexture(size); },
    _createIconTexture(size) {
      textureCreated = true;
      this._iconBin.child = mockStIconLazy;
    },
  },
};
check(
  getStIconFromAppwell(appwellLazy) === mockStIconLazy && textureCreated === true,
  'Icon extraction: lazy BaseIcon initializes via _createIconTexture'
);

// Case 3d: Direct St.Icon
const directStIcon = { isStIcon: true, name: 'direct-st-icon' };
check(
  getStIconFromAppwell({ icon: directStIcon }) === directStIcon,
  'Icon extraction: direct St.Icon recognized immediately'
);

// Case 3e: Corrupted / null BaseIcon
check(getStIconFromAppwell(null) === null, 'Icon extraction: handles null appwell');
check(getStIconFromAppwell({}) === null, 'Icon extraction: handles empty appwell');


// ---------------------------------------------------------------------
// 4. Dash Icon Inspection & Proxy Structure Baseline (_inspectIcon)
// ---------------------------------------------------------------------
function inspectIconItem(c, options = {}) {
  if (!c || !c.visible) return false;

  const styleClass = c.get_style_class_name?.() ?? c._cls ?? '';
  if (styleClass === 'dash-separator') {
    c.style = 'margin-left: 8px; margin-right: 8px;';
    return false; // Separators are tracked separately, not returned as icons
  }

  // ShowAppsIcon inspection
  if (c.isShowApps) {
    const stIcon = getStIconFromAppwell(c);
    if (stIcon) {
      c._icon = stIcon;
      c._icon.opacity = 0;
      c._button = c.child;
      return true;
    }
  }

  // App well inspection
  if (c.child) {
    const appwell = c.child;
    const stIcon = getStIconFromAppwell(appwell);
    if (stIcon) {
      c._icon = stIcon;
      c._appwell = appwell;
      c._dot = appwell._dot;

      const appId = resolveAppId(appwell);
      if (options.favorites_only && options.favorite_ids && !options.favorite_ids.includes(appId)) {
        c._appwell.visible = false;
        c.width = -1;
        c.height = -1;
        return false;
      }

      if (c._dot) {
        c._dot.opacity = 0;
      }
      c._icon.opacity = 0;
      c._label = c.label;
      return true;
    }
  }

  return false;
}

// Test inspecting a standard app item container
const appContainer = {
  visible: true,
  get_style_class_name: () => 'dash-item-container',
  label: { text: 'Nautilus' },
  child: {
    _id: 'org.gnome.Nautilus.desktop',
    app: { get_id: () => 'org.gnome.Nautilus.desktop' },
    _dot: { opacity: 255 },
    icon: {
      _iconBin: { child: { isStIcon: true, opacity: 255 } },
    },
  },
};

const inspected = inspectIconItem(appContainer, { favorites_only: false });
check(inspected === true, 'Inspection: standard app item is accepted');
check(appContainer._icon && appContainer._icon.opacity === 0, 'Inspection: real icon opacity set to 0 for proxy rendering');
check(appContainer._dot && appContainer._dot.opacity === 0, 'Inspection: real dot opacity set to 0');
check(appContainer._label && appContainer._label.text === 'Nautilus', 'Inspection: label attached');

// Test favorites_only filtering
const nonFavContainer = {
  visible: true,
  get_style_class_name: () => 'dash-item-container',
  label: { text: 'Random App' },
  child: {
    _id: 'com.example.Random.desktop',
    app: { get_id: () => 'com.example.Random.desktop' },
    _dot: { opacity: 255 },
    icon: {
      _iconBin: { child: { isStIcon: true, opacity: 255 } },
    },
  },
};
const filtered = inspectIconItem(nonFavContainer, {
  favorites_only: true,
  favorite_ids: ['org.gnome.Nautilus.desktop'],
});
check(filtered === false, 'Inspection: non-favorite is filtered when favorites_only is true');
check(nonFavContainer.child.visible === false, 'Inspection: non-favorite appwell visibility hidden');

// Test separator
const separatorItem = {
  visible: true,
  get_style_class_name: () => 'dash-separator',
};
const sepResult = inspectIconItem(separatorItem);
check(sepResult === false && separatorItem.style.includes('margin-left'), 'Inspection: separator detected and styled');


// ---------------------------------------------------------------------
// 5. Overview Public API Baseline
// ---------------------------------------------------------------------
function triggerOverviewShowApps(overview) {
  if (!overview) return false;
  if (overview.visible) {
    if (typeof overview.toggle === 'function') {
      overview.toggle();
      return true;
    }
  } else {
    if (typeof overview.showApps === 'function') {
      overview.showApps();
      return true;
    }
    if (typeof overview.toggle === 'function') {
      overview.toggle();
      return true;
    }
  }
  return false;
}

let overviewToggled = false;
let overviewShownApps = false;
const mockOverview = {
  visible: false,
  toggle() { overviewToggled = true; },
  showApps() { overviewShownApps = true; },
};

triggerOverviewShowApps(mockOverview);
check(overviewShownApps === true && overviewToggled === false, 'Overview: showApps() called when overview is hidden');

mockOverview.visible = true;
triggerOverviewShowApps(mockOverview);
check(overviewToggled === true, 'Overview: toggle() called when overview is already visible');


// ---------------------------------------------------------------------
// 6. Window Maximize Arity Probe Baseline
// ---------------------------------------------------------------------
function maximizeWindow(win) {
  if (!win || typeof win.maximize !== 'function') return;
  // Mutter arity detection: GNOME 49+ takes 0 arguments; older Mutter takes Meta.MaximizeFlags (3)
  if (win.maximize.length === 0) {
    win.maximize();
  } else {
    win.maximize(3);
  }
}

let legacyMaximizedWith = null;
const legacyWin = {
  maximize(flags) { legacyMaximizedWith = flags; },
};
maximizeWindow(legacyWin);
check(legacyMaximizedWith === 3, 'Window maximize: legacy window called with flag 3');

let modernMaximizedCalled = false;
let modernMaximizedWith = undefined;
const modernWin = {
  maximize() {
    modernMaximizedCalled = true;
    modernMaximizedWith = arguments.length;
  },
};
maximizeWindow(modernWin);
check(
  modernMaximizedCalled === true && modernMaximizedWith === 0,
  'Window maximize: modern window called with 0 arguments'
);


// ---------------------------------------------------------------------
// 7. Verify compat.js Exported Helper Methods Directly
// ---------------------------------------------------------------------
import * as Compat from '../compat.js';

check(Compat.getAppId(appwell50) === 'org.gnome.Nautilus.desktop', 'compat.js: getAppId matches modern AppIcon');
check(Compat.getAppId(appwellLegacy) === 'org.gnome.Terminal.desktop', 'compat.js: getAppId matches legacy AppIcon');
check(Compat.getAppId(appwellPrivate) === 'org.gnome.Calculator.desktop', 'compat.js: getAppId matches private _id');

const compatFavs = Compat.getFavoriteAppIds(mockFavManagerPublic);
check(
  compatFavs.length === 3 && compatFavs[0] === 'org.gnome.Nautilus.desktop',
  'compat.js: getFavoriteAppIds returns public favorites'
);
check(
  Compat.isFavoriteApp(mockFavManagerPublic, 'org.gnome.Nautilus.desktop') === true &&
    Compat.isFavoriteApp(mockFavManagerPublic, 'missing.desktop') === false,
  'compat.js: isFavoriteApp checks membership'
);

check(Compat.getStIcon(appwellGnome50) === mockStIcon50, 'compat.js: getStIcon extracts GNOME 50 _iconBin.child');
check(Compat.getStIcon(appwellGnome46) === mockStIcon46, 'compat.js: getStIcon extracts GNOME 46 icon.icon');

let compatOverviewToggle = false;
let compatOverviewShowApps = false;
const compatMockOverview = {
  visible: false,
  toggle() { compatOverviewToggle = true; },
  showApps() { compatOverviewShowApps = true; },
};
Compat.showOverviewApps(compatMockOverview);
check(compatOverviewShowApps === true, 'compat.js: showOverviewApps calls showApps when hidden');
compatMockOverview.visible = true;
Compat.showOverviewApps(compatMockOverview);
check(compatOverviewToggle === true, 'compat.js: showOverviewApps calls toggle when visible');

let compatLegacyMax = null;
Compat.maximizeWindow({ maximize(f) { compatLegacyMax = f; } });
check(compatLegacyMax === 3, 'compat.js: maximizeWindow passes 3 for legacy');
let compatModernMax = null;
Compat.maximizeWindow({ maximize() { compatModernMax = arguments.length; } });
check(compatModernMax === 0, 'compat.js: maximizeWindow passes 0 for modern');

let compatLegacyUnmax = null;
Compat.unmaximizeWindow({ unmaximize(f) { compatLegacyUnmax = f; } });
check(compatLegacyUnmax === 3, 'compat.js: unmaximizeWindow passes 3 for legacy');
let compatModernUnmax = null;
Compat.unmaximizeWindow({ unmaximize() { compatModernUnmax = arguments.length; } });
check(compatModernUnmax === 0, 'compat.js: unmaximizeWindow passes 0 for modern');


// ---------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------
if (failures === 0) {
  print('all baseline checks passed');
} else {
  print(`${failures} check(s) FAILED`);
}

