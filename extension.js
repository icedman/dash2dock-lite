/*
  License: GPL v3
*/

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Layout = imports.ui.layout;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const schema_id = Me.imports.prefs.schema_id;
const SettingsKey = Me.imports.prefs.SettingsKey;
const Animator = Me.imports.animator.Animator;
const AutoHide = Me.imports.autohide.AutoHide;

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

class Extension {
  enable() {
    this._enableSettings();
    this._queryDisplay();

    this.animator = new Animator();
    this.autohider = new AutoHide();

    this._onOverviewShowingId = Main.overview.connect(
      'showing',
      this._onOverviewShowing.bind(this)
    );
    this._onOverviewHiddenId = Main.overview.connect(
      'hidden',
      this._onOverviewHidden.bind(this)
    );

    if (this.recycleOldDash) {
      this.originalDash = Main.uiGroup.find_child_by_name('dash');
      this.dash = this.originalDash;
    } else {
      this.dash = new Dash();
      this.dash.set_name('dash');
      this.dash.add_style_class_name('overview');
    }

    this.dashContainer = new St.BoxLayout({
      name: 'dashContainer',
      vertical: true,
    });

    Main.layoutManager.addChrome(this.dashContainer, {
      affectsStruts: this.affectsStruts,
      trackFullscreen: true,
    });

    if (this.recycleOldDash) {
      Main.uiGroup
        .find_child_by_name('overview')
        .first_child.remove_child(this.dash);
      Main.overview.dash.height = -1;
      Main.overview.dash.show();
    } else {
      Main.overview.dash.height = 0;
      Main.overview.dash.hide();
    }
    this.dashContainer.add_child(this.dash);

    this._updateAppsButton();
    this._updateShrink();
    this._updateBgDark();
    this._updateBgOpacity();
    this._updateLayout();
    this._updateAnimation();
    this._updateAutohide();

    this._addEvents();
  }

  disable() {
    this._removeEvents();
    this._disableSettings();

    this._updateAppsButton(true);
    this._updateShrink(true);
    this._updateBgDark(true);
    this._updateBgOpacity(true);
    this._updateLayout(true);
    this._updateAnimation(true);
    this._updateAutohide(true);

    if (this.recycleOldDash) {
      this.dashContainer.remove_child(this.dash);
      Main.uiGroup
        .find_child_by_name('overview')
        .first_child.add_child(this.dash);
    } else {
      Main.overview.dash.height = -1;
      Main.overview.dash.show();
    }

    Main.layoutManager.removeChrome(this.dashContainer);
    this.dashContainer.destroy();
    this.dashContainer = null;

    Main.overview.disconnect(this._onOverviewShowingId);
    Main.overview.disconnect(this._onOverviewHiddenId);

    this.animator = null;
    this.autohider = null;
  }

  _queryDisplay() {
    // zero always primary display?
    // todo listen to changes?
    let box = global.display.get_monitor_geometry(0);
    this.sw = box.width;
    this.sh = box.height;
  }

  _forceRelayout() {
    this._updateLayout();
    this._updateAnimation(true);
    this._updateAnimation();
  }

  _enableSettings() {
    this._settings = ExtensionUtils.getSettings(schema_id);
    this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
    this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
    this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
    this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
    this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
    this.hideAppsButton = true;
    this.vertical = false;
    this.autohide = true;
    this.autohide = this._settings.get_boolean(SettingsKey.AUTOHIDE_DASH);
    this.affectsStruts = !this.autohide;

    this._settingsListeners = [];

    this._settingsListeners.push(
      this._settings.connect(`changed::${SettingsKey.REUSE_DASH}`, () => {
        this.recycleOldDash = this._settings.get_boolean(
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
      this._settings.connect(`changed::${SettingsKey.SHRINK_ICONS}`, () => {
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this._updateShrink();
        this._forceRelayout();
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

    this._motionEventId = this.dashContainer.connect(
      'motion-event',
      this._onMotionEvent.bind(this)
    );
    this._enterEventId = this.dashContainer.connect(
      'enter-event',
      this._onEnterEvent.bind(this)
    );
    this._leaveEventId = this.dashContainer.connect(
      'leave-event',
      this._onLeaveEvent.bind(this)
    );
    this._focusWindowId = global.display.connect(
      'notify::focus-window',
      this._onFocusWindow.bind(this)
    );
    this.fullScreenId = global.display.connect(
      'in-fullscreen-changed',
      this._onFullScreen.bind(this)
    );
  }

  _removeEvents() {
    this.dashContainer.set_reactive(false);
    this.dashContainer.set_track_hover(false);

    if (this._motionEventId) {
      this.dashContainer.disconnect(this._motionEventId);
      delete this._motionEventId;
      this._motionEventId = null;
    }

    if (this._enterEventId) {
      this.dashContainer.disconnect(this._enterEventId);
      delete this._enterEventId;
      this._enterEventId = null;
    }

    if (this._leaveEventId) {
      this.dashContainer.disconnect(this._leaveEventId);
      delete this._leaveEventId;
      this._leaveEventId = null;
    }

    if (this._focusWindowId) {
      global.display.disconnect(this._focusWindowId);
      delete this._focusWindowId;
      this._focusWindowId = null;
    }

    if (this.fullScreenId) {
      global.display.disconnect(this.fullScreenId);
      delete this.fullScreenId;
      this.fullScreenId = null;
    }
  }

  _onMotionEvent() {
    if (this.animateIcons) this.animator.onMotionEvent();
    if (this.autohide) this.autohider.onMotionEvent();
  }

  _onEnterEvent() {
    this._queryDisplay();
    if (this.animateIcons) this.animator.onEnterEvent();
    if (this.autohide) this.autohider.onEnterEvent();
  }

  _onLeaveEvent() {
    if (this.animateIcons) this.animator.onLeaveEvent();
    if (this.autohide) this.autohider.onLeaveEvent();
  }

  _onFocusWindow() {
    if (this.animateIcons) this.animator.onFocusWindow();
  }

  _onFullScreen() {
    if (this.animateIcons) this.animator.onFullScreenEvent();
  }

  _updateAppsButton(disable) {
    if (!this.dash) return;

    if (this.appButtonId && disable) {
      this.dash.showAppsButton.disconnect(this.appButtonId);
      delete this.appButtonId;
      this.appButtonId = null;
    }

    if (this.hideAppsButton && !disable) {
      this.dash.showAppsButton.hide();
    } else {
      this.dash.showAppsButton.show();
      this.appButtonId = this.dash.showAppsButton.connect(
        'notify::checked',
        () => {
          // Main.overview.show();
          // Main.overview._overview.controls._onShowAppsButtonToggled();
          // Main.overview._overview.controls._toggleAppsPage();
        }
      );
    }
  }

  _updateShrink(disable) {
    if (!this.dashContainer) return;

    if (this.shrink && !disable) {
      this.dashContainer.add_style_class_name('shrink');
    } else {
      this.dashContainer.remove_style_class_name('shrink');
    }
  }

  _updateBgDark(disable) {
    if (!this.dashContainer) return;

    if (this.bgDark && !disable) {
      this.dashContainer.add_style_class_name('dark');
    } else {
      this.dashContainer.remove_style_class_name('dark');
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

  _updateLayout(disable) {
    if (!this.dashContainer) return;

    this.dockWidth = this.shrink && !disable ? 80 : 110;
    this.dockHeight = this.shrink && !disable ? 80 : 110;

    if (this.vertical) {
      this.dashContainer.vertical = false;
      this.dashContainer.set_position(0, 0);
      this.dash.last_child.vertical = true;
      this.dash.last_child.first_child.layout_manager.orientation = 1;
      this.dashContainer.set_width(this.dockWidth);
      this.dashContainer.set_height(this.sh);
    } else {
      this.dashContainer.vertical = true;
      this.dashContainer.set_position(0, this.sh - this.dockHeight);
      this.dashContainer.set_width(this.sw);
      this.dashContainer.set_height(this.dockHeight);
    }

    if (this.vertical && !disable) {
      this.dashContainer.add_style_class_name('vertical');
    } else {
      this.dashContainer.remove_style_class_name('vertical');
    }
  }

  _updateAnimation(disable) {
    let container = this.dashContainer;
    let dash = this.dash;

    this.animator.update({
      shrink: this.shrink,
      enable: this.animateIcons && !disable,
      dash: dash,
      container: container,
    });
  }

  _updateAutohide(disable) {
    let container = this.dashContainer;
    let dash = this.dash;

    this.autohider.update({
      shrink: this.shrink,
      enable: this.autohide && !disable,
      dash: dash,
      container: container,
      screenHeight: this.sh,
    });

    this.autohider.animator = this.animator;
  }

  _onOverviewShowing() {
    this._inOverview = true;
    this.dashContainer.height = 0;
    this.animator.hide();
    this.dash.hide();
  }

  _onOverviewHidden() {
    this._inOverview = false;
    this.animator.show();
    this.dash.show();
    this.dashContainer.height = this.sh;
    this._forceRelayout();
    if (this.autohide) this.autohider.hide();
  }
}

function init() {
  return new Extension();
}
