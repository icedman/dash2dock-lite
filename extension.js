'use strict';

const { St, Shell, Gio, Gtk, Meta, Clutter } = imports.gi;

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Fav = imports.ui.appFavorites;
const Layout = imports.ui.layout;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { schemaId, settingsKeys, SettingsKeys } = Me.imports.preferences.keys;

const Animator = Me.imports.animator.Animator;
const AutoHide = Me.imports.autohide.AutoHide;
const Services = Me.imports.services.Services;

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

const SERVICES_UPDATE_INTERVAL = 4500;

class Extension {
  enable() {
    this.listeners = [];
    this.scale = 1.0;
    this.scale_icons = 0.5;

    this._enableSettings();
    this._queryDisplay();

    this.dashContainer = new St.BoxLayout({
      name: 'dashContainer',
      vertical: true,
    });
    this.dashContainer.delegate = this;

    Main.layoutManager.addChrome(this.dashContainer, {
      affectsStruts: this.affectsStruts,
      trackFullscreen: true,
    });

    // todo
    this.reuseExistingDash = true;
    if (this.reuseExistingDash) {
      this.dash = Main.overview.dash;
    } else {
      // this.dash = new Dash();
      // this.dash.set_name('dash');
      // this.dash.add_style_class_name('overview');
    }

    this.dashContainer.dash = this.dash;
    if (this.dash.get_parent()) {
      this.dash.get_parent().remove_child(this.dash);
    }
    this.dashContainer.add_child(this.dash);

    this.animator = new Animator();
    this.animator.dashContainer = this.dashContainer;

    this.autohider = new AutoHide();
    this.autohider.animator = this.animator;
    this.autohider.dashContainer = this.dashContainer;

    this.listeners = [this.animator, this.autohider];

    this._onCheckServices();

    this._updateShrink();
    this._updateBgDark();
    this._updateBgOpacity();
    this._updateLayout();
    this._updateAnimation();
    this._updateAutohide();
    this._updateTopBar();
    this._updateCss();

    this.services = new Services();
    this.services.enable();
    this.animator.services = this.services;
    this._updateTrashIcon();

    this._addEvents();
  }

  disable() {
    this._removeEvents();
    this._disableSettings();

    this._updateShrink(true);
    this._updateBgDark(true);
    this._updateBgOpacity(true);
    this._updateLayout(true);
    this._updateAnimation(true);
    this._updateAutohide(true);
    this._updateTopBar(true);
    this._updateCss(true);

    this.dashContainer.remove_child(this.dash);
    if (this.reuseExistingDash) {
      Main.uiGroup
        .find_child_by_name('overview')
        .first_child.add_child(this.dash);
    }

    Main.layoutManager.removeChrome(this.dashContainer);
    delete this.dashContainer;
    this.dashContainer = null;

    delete this.animator;
    this.animator = null;

    if (this.dash.showAppsButton && this.dash.showAppsButton._checkEventId) {
      this.dash.showAppsButton.disconnect(
        this.dash.showAppsButton._checkEventId
      );
      this.dash.showAppsButton._checkEventId = null;
    }

    this.services.disable();
    delete this.services;
    this.services = null;
  }

  _queryDisplay() {
    this.monitor = Main.layoutManager.primaryMonitor;
    this.sw = this.monitor.width;
    this.sh = this.monitor.height;
  }

  _enableSettings() {
    this._settings = ExtensionUtils.getSettings(schemaId);

    SettingsKeys.connectSettings(this._settings, (name, value) => {
      let n = name.replace(/-/g, '_');
      this[n] = value;
      log(`${name} ${value}`);
      switch (name) {
        case 'apps-icon': // hide this from justperfection (for now)
        case 'animation-fps':
        case 'animation-magnify':
        case 'animation-spread':
        case 'peek-hidden-icons': {
          break;
        }
        case 'animate-icons': {
          this._updateAnimation();
          break;
        }
        case 'autohide-dash': {
          this.disable();
          this.enable();
          break;
        }
        case 'shrink-icons': {
          this.disable();
          this.enable();
          this._onEnterEvent();
          break;
        }
        case 'scale-icons': {
          this._debounceUpdateScale();
          break;
        }
        case 'panel-mode': {
          this._updateCss();
          this._updateLayout();
          this._onEnterEvent();
          break;
        }
        case 'translucent-topbar': {
          this._updateTopBar();
          break;
        }
        case 'background-dark': {
          this._updateBgDark();
          break;
        }
        case 'background-opacity': {
          this._updateBgOpacity();
          break;
        }
        case 'pressure-sense': {
          this.disable();
          this.enable();
          break;
        }
        case 'border-radius': {
          this._updateCss();
          break;
        }
        case 'trash-icon': {
          this._updateTrashIcon();
          this._updateLayout();
          this._onEnterEvent();
          this._timeoutId = setTimeout(() => {
            this._updateLayout();
            this._onEnterEvent();
            this._timeoutId = null;
          }, 250);
          break;
        }
      }
    });

    Object.keys(SettingsKeys._keys).forEach((k) => {
      let key = SettingsKeys.getKey(k);
      let name = k.replace(/-/g, '_');
      this[name] = key.value;
      log(`${name} ${key.value}`);
    });

    this.hideAppsButton = true;
    this.vertical = false;
    this.affectsStruts = !this.autohide_dash;
  }

  _disableSettings() {
    SettingsKeys.disconnectSettings();
  }

  _addEvents() {
    this.dashContainer.set_reactive(true);
    this.dashContainer.set_track_hover(true);

    this._dashContainerEvents = [];
    this._dashContainerEvents.push(
      this.dashContainer.connect('motion-event', this._onMotionEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('enter-event', this._onEnterEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('leave-event', this._onLeaveEvent.bind(this))
    );
    this._dashContainerEvents.push(
      this.dashContainer.connect('destroy', () => {})
    );

    this._sessionModeEvents = [];
    this._sessionModeEvents.push(
      Main.sessionMode.connect('updated', () => this._onSessionUpdated())
    );

    this._layoutManagerEvents = [];

    // todo ... jerky on overview
    this._layoutManagerEvents.push(
      Main.layoutManager.connect('startup-complete', () => {
        this._updateLayout();
        this.oneShotStartupCompleteId = setTimeout(() => {
          this._updateLayout();
        }, 500);
      })
    );

    this._displayEvents = [];
    this._displayEvents.push(
      global.display.connect(
        'notify::focus-window',
        this._onFocusWindow.bind(this)
      )
    );
    this._displayEvents.push(
      global.display.connect(
        'in-fullscreen-changed',
        this._onFullScreen.bind(this)
      )
    );

    this._overViewEvents = [];
    this._overViewEvents.push(
      Main.overview.connect('showing', this._onOverviewShowing.bind(this))
    );
    this._overViewEvents.push(
      Main.overview.connect('hidden', this._onOverviewHidden.bind(this))
    );

    this._appFavoriteEvents = [];
    // this._appFavoriteEvents.push(
    //   Fav.getAppFavorites().connect('changed', this._onEnterEvent.bind(this))
    // );

    this._intervals = [];
    this._intervals.push(
      setInterval(this._onCheckServices.bind(this), SERVICES_UPDATE_INTERVAL)
    );
  }

  _removeEvents() {
    this.dashContainer.set_reactive(false);
    this.dashContainer.set_track_hover(false);

    if (this._timeoutId) {
      clearInterval(this._timeoutId);
      this._timeoutId = null;
    }
    if (this.oneShotStartupCompleteId) {
      clearInterval(this.oneShotStartupCompleteId);
      this.oneShotStartupCompleteId = null;
    }
    if (this._intervals) {
      this._intervals.forEach((id) => {
        clearInterval(id);
      });
      this._intervals = [];
    }

    this._dashContainerEvents.forEach((id) => {
      if (this.dashContainer) {
        this.dashContainer.disconnect(id);
      }
    });
    this._dashContainerEvents = [];

    this._sessionModeEvents.forEach((id) => {
      Main.sessionMode.disconnect(id);
    });
    this._sessionModeEvents = [];

    if (this._overViewEvents) {
      this._overViewEvents.forEach((id) => {
        Main.overview.disconnect(id);
      });
    }
    this._overViewEvents = [];

    if (this._appFavoriteEvents) {
      this._appFavoriteEvents.forEach((id) => {
        Fav.getAppFavorites().disconnect(id);
      });
    }
    this._appFavoriteEvents = [];

    if (this._layoutManagerEvents) {
      this._layoutManagerEvents.forEach((id) => {
        Main.layoutManager.disconnect(id);
      });
    }
    this._layoutManagerEvents = [];

    if (this._displayEvents) {
      this._displayEvents.forEach((id) => {
        global.display.disconnect(id);
      });
    }
    this._displayEvents = [];
  }

  _onMotionEvent() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onMotionEvent) l._onMotionEvent();
      });
  }

  _onEnterEvent() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onEnterEvent) l._onEnterEvent();
      });

    this._updateLayout();
  }

  _onLeaveEvent() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onLeaveEvent) l._onLeaveEvent();
      });
  }

  _onFocusWindow() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onFocusWindow) l._onFocusWindow();
      });

    this._onCheckServices();
  }

  _onFullScreen() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onFullScreen) l._onFullScreen();
      });
  }

  _updateScale() {
    this._updateShrink();
    this.disable();
    this.enable();
    this._onEnterEvent();
    this._timeoutId = null;
  }

  _debounceUpdateScale() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(this._updateScale.bind(this), 250);
  }

  _updateShrink(disable) {
    if (!this.dashContainer) return;

    let rescale_modifier = 0.8 + 1.4 * this.scale_icons;
    if (this.scale_icons == 0) {
      rescale_modifier = 1;
    }
    if (this.shrink_icons && !disable) {
      this.scale = 0.8 * rescale_modifier;
      this.dashContainer.add_style_class_name('shrink');
    } else {
      this.scale = 1.0 * rescale_modifier;
      this.dashContainer.remove_style_class_name('shrink');
    }

    this._updateLayout();
  }

  _updateBgDark(disable) {
    if (!this.dashContainer) return;
    if (this.background_dark && !disable) {
      this.dash.add_style_class_name('dark');
    } else {
      this.dash.remove_style_class_name('dark');
    }
  }

  _updateTopBar(disable) {
    if (!this.dashContainer) return;

    let panelBox = Main.uiGroup.find_child_by_name('panelBox');
    if (panelBox && this.translucent_topbar && !disable) {
      panelBox.add_style_class_name('translucent');
    } else {
      panelBox.remove_style_class_name('translucent');
    }
  }

  _updateCss(disable) {
    if (!this.dashContainer) return;

    let background = this.dash ? this.dash.first_child : null;
    if (background && this.border_radius !== null) {
      for (let i = 0; i < 7; i++) {
        background.remove_style_class_name(`border-radius-${i}`);
      }
      if (!disable && !this.panel_mode) {
        background.add_style_class_name(
          `border-radius-${Math.floor(this.border_radius)}`
        );
      }
    }
    if (background) {
      if (this.panel_mode) {
        this.dash.set_background_color(Clutter.Color.from_pixel(0x00000050));
        background.visible = false;
      } else {
        this.dash.set_background_color(Clutter.Color.from_pixel(0x00000000));
        background.visible = true;
      }
    }
  }

  _updateBgOpacity(disable) {
    if (!this.dash) return;
    if (disable) {
      this.dash.first_child.opacity = 255;
    } else {
      this.dash.first_child.opacity = 255 * this.background_opacity;
    }
  }

  _findIcons() {
    if (!this.dash) return [];

    // hook on showApps
    if (this.dash.showAppsButton && !this.dash.showAppsButton._checkEventId) {
      this.dash.showAppsButton._checkEventId = this.dash.showAppsButton.connect(
        'notify::checked',
        () => {
          if (!Main.overview.visible) {
            Main.uiGroup
              .find_child_by_name('overview')
              ._controls._toggleAppsPage();
          }
        }
      );
    }

    let icons = this.dash._box.get_children().filter((actor) => {
      if (actor.child && actor.child._delegate && actor.child._delegate.icon) {
        return true;
      }
      return false;
    });

    icons.forEach((c) => {
      let label = c.label;
      let appwell = c.first_child;
      let draggable = appwell._draggable;
      let widget = appwell.first_child;
      let icongrid = widget.first_child;
      let boxlayout = icongrid.first_child;
      let bin = boxlayout.first_child;
      let icon = bin.first_child;

      c._bin = bin;
      c._label = label;
      c._draggable = draggable;
      c._appwell = appwell;
      if (icon) {
        c._icon = icon;
      }
    });

    try {
      // this.dash._showAppsIcon;
      let apps = Main.overview.dash.last_child.last_child;
      if (apps) {
        let widget = apps.child;
        if (widget && widget.width > 0 && widget.get_parent().visible) {
          let icongrid = widget.first_child;
          let boxlayout = icongrid.first_child;
          let bin = boxlayout.first_child;
          let icon = bin.first_child;
          let c = {};
          c.child = widget;
          c._bin = bin;
          c._icon = icon;
          c._label = widget._delegate.label;
          icons.push(c);
        }
      }
    } catch (err) {
      // could happen if ShowApps is hidden
    }

    this.dashContainer._icons = icons;
    return icons;
  }

  _updateLayout(disable) {
    if (disable || !this.dashContainer) return;

    this._queryDisplay();

    this.scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let iconSize = 64;

    try {
      let background = this.dash.first_child;
      this.dash._box.first_child.first_child._delegate.icon.height;
    } catch (err) {
      // dash might not yet be ready
    }

    let scale = this.scale;
    let dockHeight = iconSize * (this.shrink_icons ? 1.8 : 1.6) * scale;
    if (this.panel_mode) {
      dockHeight -= 12 * this.scaleFactor;
    } else {
    }

    this.dashContainer.set_size(this.sw, dockHeight * this.scaleFactor);
    if (this.autohider._enabled && !this.autohider._shown) {
      // remain hidden
    } else {
      this.dashContainer.set_position(
        this.monitor.x,
        this.monitor.y + this.sh - dockHeight * this.scaleFactor
      );
      this.dashContainer._fixedPosition = this.animator._get_position(
        this.dashContainer
      );
      this.dashContainer._dockHeight = dockHeight * this.scaleFactor;
    }

    let iconChildren = this._findIcons();

    let iconHook = [...iconChildren];
    for (let i = 0; i < iconHook.length; i++) {
      if (!iconHook[i].child) continue;
      let icon = iconHook[i].child._delegate.icon;
      if (!icon._setIconSize) {
        icon._setIconSize = icon.setIconSize;
      }

      icon._scale = scale;
      icon.setIconSize = ((sz) => {
        sz *= icon._scale;
        icon._setIconSize(sz);
      }).bind(icon);
    }

    this.dash._maxWidth = this.sw;
    this.dash._maxHeight = this.sh;
    this.dash.iconSize--;
    this.dash._adjustIconSize();
  }

  _updateAnimation(disable) {
    if (this.animate_icons && !disable) {
      this.animator.enable();
    } else {
      this.animator.disable();
    }
  }

  _updateAutohide(disable) {
    this.autohider.animator = this.animator;
    this.dashContainer.autohider = this.autohider;

    if (this.autohide_dash && !disable) {
      this.autohider.enable();
    } else {
      this.autohider.disable();
    }
  }

  _updateTrashIcon() {
    if (this.trash_icon) {
      this.services.setupTrashIcon();
      Fav.getAppFavorites().addFavorite('trash-dash2dock-lite.desktop');
    } else {
      Fav.getAppFavorites().removeFavorite('trash-dash2dock-lite.desktop');
    }
  }

  _onOverviewShowing() {
    this._inOverview = true;

    if (this.reuseExistingDash) {
      this.dashContainer.remove_child(this.dash);
      Main.uiGroup
        .find_child_by_name('overview')
        .first_child.add_child(this.dash);
    }

    this.dashContainer.hide();
    if (this.animator && this.animator._enabled) {
      this.animator._beginAnimation();
      if (this.animator._iconsContainer) {
        this.animator._iconsContainer.hide();
      }
    }
    // this._onEnterEvent();
    // log('_onOverviewShowing');
  }

  _onOverviewHidden() {
    this._inOverview = false;

    if (this.reuseExistingDash) {
      Main.uiGroup
        .find_child_by_name('overview')
        .first_child.remove_child(this.dash);
      this.dashContainer.add_child(this.dash);
    }

    this.dashContainer.show();
    this._onEnterEvent();

    // log('_onOverviewHidden');
  }

  _onSessionUpdated() {
    this._updateLayout();
    this.autohider._debounceCheckHide();
  }

  _onCheckServices() {
    if (!this.services) return; // todo why does this happen?
    if (this.trash_icon) {
      Fav.getAppFavorites().addFavorite('trash-dash2dock-lite.desktop');
      this.services.checkTrash();
    }
  }
}

function init() {
  return new Extension();
}
