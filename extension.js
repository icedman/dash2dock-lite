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

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

class Extension {
    constructor() {
        this._settings = ExtensionUtils.getSettings(schema_id);
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
        this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
        this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
        this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
        this.hideAppsButton = false;
        this.vertical = false;

        Main.overview.connect('showing', this._onOverviewShowing.bind(this));
        Main.overview.connect('hidden', this._onOverviewHidden.bind(this));

        this._settings.connect(`changed::${SettingsKey.REUSE_DASH}`, () => {
            this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
            this.disable();
            this.enable();
        });
        this._settings.connect(`changed::${SettingsKey.BG_DARK}`, () => {
            this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
            this._updateBgDark();
        });
        this._settings.connect(`changed::${SettingsKey.BG_OPACITY}`, () => {
            this.bgOpacity = this._settings.get_double(SettingsKey.BG_OPACITY);
            this._updateBgOpacity();
        });
        this._settings.connect(`changed::${SettingsKey.SHRINK_ICONS}`, () => {
            this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
            this._updateShrink();

            // these will be messed up.. force update
            this._updateLayout();
            this._updateAnimation(true);
            this._updateAnimation();
        });        
        this._settings.connect(`changed::${SettingsKey.ANIMATE_ICONS}`, () => {
            this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
            this._updateAnimation();
        });

        this.fullScreenId = global.display.connect('in-fullscreen-changed', (() => {
            let primary = Main.layoutManager.primaryMonitor;
            if (!primary.inFullscreen) {
                this.animator.show();
            } else {
                this.animator.hide();
            }
        }).bind(this));

        this.animator = new Animator();
    }

    enable() {

        if (this.recycleOldDash) {
        	this.originalDash = Main.uiGroup.find_child_by_name('dash');
            this.dash = this.originalDash;
        } else {
            this.dash = new Dash();
            this.dash.set_name('dash');
            this.dash.add_style_class_name('overview');
        }

        this.dashContainer = new St.BoxLayout({ name: 'dashContainer', vertical: true });

        Main.layoutManager.addChrome(
            this.dashContainer,
            {   affectsStruts: true,
                trackFullscreen: true
            });

        if (this.recycleOldDash) {         
            Main.uiGroup.find_child_by_name('overview').first_child.remove_child(this.dash);
            setTimeout(() => {
                Main.overview.dash.height = -1;
                Main.overview.dash.show();
            }, 500);
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
    }

    disable() {
        this._updateAppsButton(true);
        this._updateShrink(true);
        this._updateBgDark(true);
        this._updateBgOpacity(true);
        this._updateLayout(true);
        this._updateAnimation(true);

        if (this.recycleOldDash) {
            this.dashContainer.remove_child(this.dash);
            Main.uiGroup.find_child_by_name('overview').first_child.add_child(this.dash);
        } else {
            Main.overview.dash.height = -1;
            Main.overview.dash.show();
        }

        Main.layoutManager.removeChrome(this.dashContainer);
        delete this.dashContainer;
        this.dashContainer = null;

        global.display.disconnect(this.fullScreenId);
        delete this.fullScreenId;
        this.fullScreenId = null;
    }

    _updateAppsButton(disable) {
        if (!this.dash) return;

        if (this.hideAppsButton && !disable) {
            this.dash.showAppsButton.hide();
            if (this.appButtonId) {
                this.dash.showAppsButton.disconnect(this.appButtonId);
                delete this.appButtonId;
                this.appButtonId = null;
            }
        } else {
            this.dash.showAppsButton.show();
            this.appButtonId = this.dash.showAppsButton.connect('notify::checked', () => {
                // Main.overview.show();
                // Main.overview._overview.controls._onShowAppsButtonToggled();
                // Main.overview._overview.controls._toggleAppsPage();
            });
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

        let [sw, sh] = global.display.get_size();
        this.dockWidth = (this.shrink && !disable) ? 80 : 110;
        this.dockHeight = (this.shrink && !disable) ? 80 : 110;

        if (this.vertical) {
            this.dashContainer.vertical = false;
            this.dashContainer.set_position(0, 0);
            this.dash.last_child.vertical = true;
            this.dash.last_child.first_child.layout_manager.orientation = 1;
            this.dashContainer.set_width(this.dockWidth);            
            this.dashContainer.set_height(sh);
        } else {
            this.dashContainer.vertical = true;
            this.dashContainer.set_position(0, sh - this.dockHeight);
            this.dashContainer.set_width(sw);
            this.dashContainer.set_height(this.dockHeight);
        }

        if (this.vertical && !disable) {
            this.dashContainer.add_style_class_name('vertical');
        } else {
            this.dashContainer.remove_style_class_name('vertical');
        }
    }

    _updateAnimation(disable) {
        this.animator.update({
            shrink: this.shrink,
            enable: this.animateIcons && !disable,
            dash: this.dash,
            container: this.dashContainer
        })
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
        this._updateLayout();
    }    
}

function init() {
	return new Extension();
}


