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

/**
 * Safely retrieve the inner icons box of a Shell Dash actor.
 *
 * @param {object} dash Shell Dash instance
 * @returns {object|null}
 */
export function getDashBox(dash) {
  if (!dash) return null;
  return dash._box ?? dash._dashContainer?._box ?? null;
}

/**
 * Safely retrieve the container holding the icons box and showApps button.
 *
 * @param {object} dash Shell Dash instance
 * @returns {object|null}
 */
export function getDashContainer(dash) {
  if (!dash) return null;
  return dash._dashContainer ?? dash.last_child ?? null;
}

/**
 * Safely retrieve the showAppsIcon of a Shell Dash actor.
 *
 * @param {object} dash Shell Dash instance
 * @returns {object|null}
 */
export function getDashShowAppsIcon(dash) {
  if (!dash) return null;
  return dash._showAppsIcon ?? null;
}

/**
 * Safely retrieve the background actor of a Shell Dash actor.
 *
 * @param {object} dash Shell Dash instance
 * @returns {object|null}
 */
export function getDashBackground(dash) {
  if (!dash) return null;
  return dash._background ?? null;
}

/**
 * Configure a Shell Dash instance for proxy rendering by d2da.
 * Neutralizes internal icon resizing and makes real app items invisible.
 *
 * @param {object} dash Shell Dash instance
 */
export function setupDashProxy(dash) {
  if (!dash) return;
  try {
    dash._adjustIconSize = () => {};
    const origCreateAppItem = dash._createAppItem;
    if (typeof origCreateAppItem === 'function') {
      dash._createAppItem = function (app) {
        const item = origCreateAppItem.call(this, app);
        this.opacity = 0;
        this.reactive = false;
        if (item?.child) {
          item.child.visible = false;
        }
        return item;
      };
    }
  } catch (e) {
    console.error('d2da: compat setupDashProxy', e);
  }
}

/**
 * Safely update orientation on a Shell Dash's container and box.
 *
 * @param {object} dash Shell Dash instance
 * @param {number} orientation Clutter.Orientation or boolean
 */
export function setDashOrientation(dash, orientation) {
  if (!dash) return;
  try {
    let orient = orientation;
    if (typeof orientation === 'boolean') {
      orient = orientation ? 1 : 0;
    }
    const container = getDashContainer(dash);
    if (container?.layout_manager) {
      container.layout_manager.orientation = orient;
    }
    const box = getDashBox(dash);
    if (box?.layout_manager) {
      box.layout_manager.orientation = orient;
    }
  } catch (e) {
    console.error('d2da: compat setDashOrientation', e);
  }
}

/**
 * Safely set orientation on an St.BoxLayout, supporting GNOME 51+ where
 * the legacy .vertical property and methods were removed.
 *
 * @param {object} box St.BoxLayout instance
 * @param {boolean|number} vertical whether orientation is vertical
 */
export function setBoxLayoutOrientation(box, vertical) {
  if (!box) return;
  try {
    const isVertical = Boolean(vertical);
    const orientation = isVertical ? 1 : 0; // Clutter.Orientation.VERTICAL : HORIZONTAL
    if ('orientation' in box) {
      box.orientation = orientation;
    } else if (box.layout_manager && 'orientation' in box.layout_manager) {
      box.layout_manager.orientation = orientation;
    } else if ('vertical' in box) {
      box.vertical = isVertical;
    }
  } catch (e) {
    console.error('d2da: compat setBoxLayoutOrientation', e);
  }
}

/**
 * Safely update text direction on a Shell Dash's container and box.
 *
 * @param {object} dash Shell Dash instance
 * @param {boolean} isRtl
 */
export function setDashLayoutDirection(dash, isRtl) {
  if (!dash) return;
  try {
    const container = getDashContainer(dash);
    if (container) {
      container.text_direction = isRtl ? 2 : 1;
    }
    const box = getDashBox(dash);
    if (box) {
      box.text_direction = 1; // icons layout stays LTR
    }
  } catch (e) {
    console.error('d2da: compat setDashLayoutDirection', e);
  }
}

/**
 * Controls visibility and opacity of the stock overview dash.
 * Eliminates the legacy __box expando and handles GNOME 51 dash reactivity.
 *
 * @param {object} overviewDash Main.overview.dash instance
 * @param {boolean} show whether to show or hide the overview dash
 * @param {object|null} state reference to persistent state tracker { hiddenChild: null }
 */
export function setOverviewDashVisibility(overviewDash, show, state = null) {
  if (!overviewDash) return;
  try {
    if (!show && state && state.origReactive === undefined) {
      state.origReactive = overviewDash.reactive ?? true;
    }
    overviewDash.opacity = show ? 255 : 0;
    overviewDash.reactive = show ? (state?.origReactive ?? true) : false;
    const bg = getDashBackground(overviewDash);
    if (bg) {
      bg.style = show ? '' : 'background: transparent !important;';
    }

    const box = getDashBox(overviewDash);
    if (box && typeof box.get_children === 'function') {
      box.get_children().forEach((c) => {
        c.opacity = show ? 255 : 0;
        c.visible = show;
        if (c.child) {
          c.child.reactive = show;
          c.child.track_hover = show;
        }
      });
    }

    const showApps = getDashShowAppsIcon(overviewDash);
    if (showApps) {
      showApps.opacity = show ? 255 : 0;
      if (showApps.child) {
        showApps.child.reactive = show;
        showApps.child.track_hover = show;
      }
    }

    if (show && state && state.hiddenChild) {
      state.hiddenChild.visible = true;
      state.hiddenChild = null;
    }
  } catch (e) {
    console.error('d2da: compat setOverviewDashVisibility', e);
  }
}

/**
 * Safely open a PopupMenu across GNOME Shell versions.
 * In GNOME 51+, open() accepts a parameters object ({ animate, fadeOnly }).
 * In GNOME 45–50, open() accepts BoxPointer.PopupAnimation flags or boolean.
 *
 * @param {object} menu PopupMenu instance
 * @param {object|number|boolean} [options=true] Animation flags or params object
 */
export function openPopupMenu(menu, options = true) {
  if (!menu || typeof menu.open !== 'function') return;
  try {
    const isModern = typeof menu._getPopupAnimationFromParams === 'function';
    if (isModern) {
      const params =
        typeof options === 'object' && options !== null
          ? options
          : { animate: Boolean(options) };
      menu.open(params);
    } else {
      const arg =
        typeof options === 'object' && options !== null
          ? (options.animate !== false ? 1 : 0)
          : options;
      menu.open(arg);
    }
  } catch (e) {
    console.error('d2da: compat openPopupMenu', e);
  }
}

/**
 * Safely close a PopupMenu across GNOME Shell versions.
 * In GNOME 51+, close() accepts a parameters object ({ animate, fadeOnly }).
 * In GNOME 45–50, close() accepts BoxPointer.PopupAnimation flags or boolean.
 *
 * @param {object} menu PopupMenu instance
 * @param {object|number|boolean} [options=true] Animation flags or params object
 */
export function closePopupMenu(menu, options = true) {
  if (!menu || typeof menu.close !== 'function') return;
  try {
    const isModern = typeof menu._getPopupAnimationFromParams === 'function';
    if (isModern) {
      const params =
        typeof options === 'object' && options !== null
          ? options
          : { animate: Boolean(options) };
      menu.close(params);
    } else {
      const arg =
        typeof options === 'object' && options !== null
          ? (options.animate !== false ? 1 : 0)
          : options;
      menu.close(arg);
    }
  } catch (e) {
    console.error('d2da: compat closePopupMenu', e);
  }
}

