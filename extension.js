/*
  License: GPL v3
*/

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Fav = imports.ui.appFavorites;
const Layout = imports.ui.layout;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const schema_id = Me.imports.prefs.schema_id;
const SettingsKey = Me.imports.prefs.SettingsKey;
const Animator = Me.imports.animator.Animator;
const AutoHide = Me.imports.autohide.AutoHide;

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

const SERVICE_CHECK_INTERVAL = 4500;

class Extension {
  enable() {
    this.listeners = [];
    this.scale = 1.0;
    this.rescale = 0.5;

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
      this.dash = new Dash();
      this.dash.set_name('dash');
      this.dash.add_style_class_name('overview');
    }

    this.dash = Main.overview.dash;
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

    this._updateTrashIcon();

    this._updateShrink();
    this._updateBgDark();
    this._updateBgOpacity();
    this._updateLayout();
    this._updateAnimation();
    this._updateAutohide();
    this._updateTopBar();

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
  }

  _queryDisplay() {
    this.monitor = Main.layoutManager.primaryMonitor;
    this.sw = this.monitor.width;
    this.sh = this.monitor.height;
  }

  _enableSettings() {
    this._settings = ExtensionUtils.getSettings(schema_id);
    this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
    this.rescale = this._settings.get_double(SettingsKey.SCALE_ICONS);
    this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
    this.pressureSense = this._settings.get_boolean(SettingsKey.PRESSURE_SENSE);
    this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
    this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
    this.translucentTopBar = this._settings.get_boolean(
      SettingsKey.TRANSLUCENT_TOPBAR
    );
    this.showTrashIcon = this._settings.get_boolean(
      SettingsKey.SHOW_TRASH_ICON
    );
    this.reuseExistingDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
    this.hideAppsButton = true;
    this.vertical = false;
    this.autohide = this._settings.get_boolean(SettingsKey.AUTOHIDE_DASH);
    this.affectsStruts = !this.autohide;

    this._settingsListeners = [];

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.REUSE_DASH}`, () => {
        this.reuseExistingDash = this._settings.get_boolean(
          SettingsKey.REUSE_DASH
        );
        this.disable();
        this.enable();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.BG_DARK}`, () => {
        this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
        this._updateBgDark();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.BG_OPACITY}`, () => {
        this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
        this._updateBgOpacity();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.SCALE_ICONS}`, () => {
        this.rescale = this._settings.get_double(SettingsKey.SCALE_ICONS);
        this._debounceUpdateScale();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.SHRINK_ICONS}`, () => {
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this._updateShrink();
        this.disable();
        this.enable();
        this._onEnterEvent();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.ANIMATE_ICONS}`, () => {
        this.animateIcons = this._settings.get_boolean(
          SettingsKey.ANIMATE_ICONS
        );
        this._updateAnimation();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.AUTOHIDE_DASH}`, () => {
        this.autohide = this._settings.get_boolean(SettingsKey.AUTOHIDE_DASH);
        this.disable();
        this.enable();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.PRESSURE_SENSE}`, () => {
        this.pressureSense = this._settings.get_boolean(
          SettingsKey.PRESSURE_SENSE
        );
        this.disable();
        this.enable();
      })
    );

    this._settingsListeners.push(
      this._settings.connect(
        `changed::${SettingsKey.TRANSLUCENT_TOPBAR}`,
        () => {
          this.translucentTopBar = this._settings.get_boolean(
            SettingsKey.TRANSLUCENT_TOPBAR
          );
          this._updateTopBar();
        }
      )
    );

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.SHOW_TRASH_ICON}`, () => {
        this.showTrashIcon = this._settings.get_boolean(
          SettingsKey.SHOW_TRASH_ICON
        );
        this._updateTrashIcon();
        this._updateLayout();
        this._onEnterEvent();
      })
    );
  }

  _disableSettings() {
    this._settingsListeners.forEach((id) => {
      this._settings.disconnect(id);
    });
    this._settingsListeners = [];
    this._settings = null;
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
    this._layoutManagerEvents.push(
      Main.layoutManager.connect('startup-complete', () => {
        this._updateLayout();
        this.oneShotStartupCompleteId = setTimeout(() => {
          this._updateLayout();
          this.oneShotStartupCompleteId = setTimeout(() => {
            this._updateLayout();
            this.oneShotStartupCompleteId = null;
          }, 500);
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
      setInterval(this._onCheckServices.bind(this), SERVICE_CHECK_INTERVAL)
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
  }

  _debounceUpdateScale() {
    if (this._timeoutId) {
      clearInterval(this._timeoutId);
    }
    this._timeoutId = setTimeout(this._updateScale.bind(this), 250);
  }

  _updateShrink(disable) {
    if (!this.dashContainer) return;

    let rescale_modifier = 0.8 + 1.4 * this.rescale;
    if (this.rescale == 0) {
      rescale_modifier = 1;
    }
    if (this.shrink && !disable) {
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

    if (this.bgDark && !disable) {
      this.dash.add_style_class_name('dark');
    } else {
      this.dash.remove_style_class_name('dark');
    }
  }

  _updateTopBar(disable) {
    if (!this.dashContainer) return;

    let panelBox = Main.uiGroup.find_child_by_name('panelBox');
    if (panelBox && this.translucentTopBar && !disable) {
      panelBox.add_style_class_name('translucent');
    } else {
      panelBox.remove_style_class_name('translucent');
    }
  }

  _updateBgOpacity(disable) {
    if (!this.dash) return;

    if (disable) {
      this.dash.first_child.opacity = 255;
    } else {
      this.dash.first_child.opacity = 255 * this.bgOpacity;
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
      this.dash._box.first_child.first_child._delegate.icon.height;
    } catch (err) {
      // dash might not yet be ready
    }

    let scale = this.scale;
    let dockHeight = iconSize * (this.shrink ? 1.8 : 1.6) * scale;

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

    let iconHook = [...iconChildren, this.dash._showAppsIcon];
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
    if (this.animateIcons && !disable) {
      this.animator.enable();
    } else {
      this.animator.disable();
    }
  }

  _updateAutohide(disable) {
    this.autohider.animator = this.animator;
    this.dashContainer.autohider = this.autohider;

    if (this.autohide && !disable) {
      this.autohider.enable();
    } else {
      this.autohider.disable();
    }
  }

  _updateTrashIcon() {
    var fn = Gio.File.new_for_path(
      '.local/share/applications/trash-dash2dock-lite.desktop'
    );
    if (this.showTrashIcon) {
      if (!fn.query_exists(null)) {
        var content =
          '[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=xdg-open trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash\n\n[Desktop Action trash]\nName=Empty Trash\nExec=/usr/local/bin/empty-trash.sh\n';
        const [, etag] = fn.replace_contents(
          content,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null
        );
        Main.notify('Preparing the trash icon...');
      }
      Fav.getAppFavorites().addFavorite('trash-dash2dock-lite.desktop');
    } else {
      Fav.getAppFavorites().removeFavorite('trash-dash2dock-lite.desktop');
    }
    fn = null;
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
    if (this.showTrashIcon) {
      Fav.getAppFavorites().addFavorite('trash-dash2dock-lite.desktop');
      if (!this.fnTrashDir) {
        this.fnTrashDir = Gio.File.new_for_uri('trash:///');
      }
      var prevTrash = this.trashFull;
      var iter = this.fnTrashDir.enumerate_children(
        'standard::*',
        Gio.FileQueryInfoFlags.NONE,
        null
      );
      this.trashFull = iter.next_file(null) != null;
      iter = null;
      // if (prevTrash != this.trashFull) {
      //   log(`trash ${this.trashFull}`);
      // }
    }
  }
}

function init() {
  return new Extension();
}
