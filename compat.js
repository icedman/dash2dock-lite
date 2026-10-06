'use strict';

let St = null;
try {
  St = (await import('gi://St')).default;
} catch {
  // St not available in standalone mock environments
}

/**
 * Robustly resolve application IDs from the Shell's AppFavorites manager.
 * Prefers the public getFavorites() API (returning Shell.App instances) and
 * getFavoriteMap() before falling back to private _getIds().
 *
 * @param {object} favManager Shell AppFavorites instance
 * @returns {string[]} Array of app ID strings (e.g. ['org.gnome.Nautilus.desktop'])
 */
export function getFavoriteAppIds(favManager) {
  if (!favManager) return [];
  if (typeof favManager.getFavorites === 'function') {
    try {
      const apps = favManager.getFavorites();
      if (Array.isArray(apps)) {
        return apps
          .map((a) => (typeof a?.get_id === 'function' ? a.get_id() : a?.id ?? ''))
          .filter(Boolean);
      }
    } catch (e) {
      console.error('d2da: compat getFavorites', e);
    }
  }
  if (typeof favManager.getFavoriteMap === 'function') {
    try {
      const map = favManager.getFavoriteMap();
      if (map && typeof map === 'object') {
        return Object.keys(map);
      }
    } catch (e) {
      console.error('d2da: compat getFavoriteMap', e);
    }
  }
  if (typeof favManager._getIds === 'function') {
    try {
      return favManager._getIds();
    } catch (e) {
      console.error('d2da: compat _getIds fallback', e);
    }
  }
  return [];
}

/**
 * Check whether an application ID is in favorites.
 *
 * @param {object} favManager Shell AppFavorites instance
 * @param {string} appId Desktop ID string
 * @returns {boolean}
 */
export function isFavoriteApp(favManager, appId) {
  if (!favManager || !appId) return false;
  if (typeof favManager.isFavorite === 'function') {
    try {
      return favManager.isFavorite(appId);
    } catch {
      // fallback to list check
    }
  }
  return getFavoriteAppIds(favManager).includes(appId);
}

/**
 * Safely resolve an application ID from an appwell (DashIcon / AppIcon).
 * Prefers public getId() and app.get_id() over private _id.
 *
 * @param {object} appwell DashIcon or AppIcon actor/instance
 * @returns {string} Application ID string or empty string
 */
export function getAppId(appwell) {
  if (!appwell) return '';
  if (typeof appwell.getId === 'function') {
    try {
      const id = appwell.getId();
      if (id) return id;
    } catch {
      // ignore
    }
  }
  if (appwell.app && typeof appwell.app.get_id === 'function') {
    try {
      const id = appwell.app.get_id();
      if (id) return id;
    } catch {
      // ignore
    }
  }
  if (appwell.id) return appwell.id;
  if (appwell._id) return appwell._id;
  return '';
}

/**
 * Robustly extract the St.Icon from a DashIcon/AppIcon or ShowAppsIcon instance.
 * Supports GNOME 50 (_iconBin.child), GNOME 46 (icon.icon), direct St.Icon, and
 * lazy texture creation (_createIconTexture).
 *
 * @param {object} appwell DashIcon/AppIcon or ShowAppsIcon
 * @returns {object|null} St.Icon instance or null
 */
export function getStIcon(appwell) {
  if (!appwell || !appwell.icon) return null;
  const baseIcon = appwell.icon;

  if (St?.Icon && baseIcon instanceof St.Icon) return baseIcon;
  if (baseIcon.isStIcon) return baseIcon;

  // GNOME 46 / setIconSize initialized: direct .icon property
  if (baseIcon.icon) return baseIcon.icon;

  // GNOME 50: _iconBin.child
  if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;

  // Force icon creation if not yet initialized
  try {
    if (typeof baseIcon.setIconSize === 'function') {
      const size =
        typeof baseIcon.iconSize === 'number' && baseIcon.iconSize > 0
          ? baseIcon.iconSize
          : 48;
      baseIcon._createIconTexture(size);
      if (baseIcon.icon) return baseIcon.icon;
      if (baseIcon._iconBin && baseIcon._iconBin.child) return baseIcon._iconBin.child;
    }
  } catch {
    // ignore initialization errors
  }

  return null;
}

/**
 * Safely toggle or open the overview applications page.
 * Uses public Main.overview methods instead of walking Main.uiGroup.
 *
 * @param {object} overview Main.overview instance
 */
export function showOverviewApps(overview) {
  if (!overview) return;
  try {
    if (overview.visible) {
      overview.toggle();
    } else if (typeof overview.showApps === 'function') {
      overview.showApps();
    } else if (typeof overview.toggle === 'function') {
      overview.toggle();
    }
  } catch (e) {
    console.error('d2da: compat showOverviewApps', e);
  }
}

/**
 * Feature-detect and trigger window maximize across Mutter versions.
 * In modern Mutter (GNOME 49+), flags were dropped and maximize takes 0 args.
 * In older Mutter, maximize expects Meta.MaximizeFlags.BOTH (3).
 *
 * @param {object} win Meta.Window instance
 */
export function maximizeWindow(win) {
  if (!win || typeof win.maximize !== 'function') return;
  try {
    if (win.maximize.length === 0) {
      win.maximize();
    } else {
      win.maximize(3);
    }
  } catch (e) {
    console.error('d2da: compat maximizeWindow', e);
  }
}

/**
 * Feature-detect and trigger window unmaximize across Mutter versions.
 *
 * @param {object} win Meta.Window instance
 */
export function unmaximizeWindow(win) {
  if (!win || typeof win.unmaximize !== 'function') return;
  try {
    if (win.unmaximize.length === 0) {
      win.unmaximize();
    } else {
      win.unmaximize(3);
    }
  } catch (e) {
    console.error('d2da: compat unmaximizeWindow', e);
  }
}
