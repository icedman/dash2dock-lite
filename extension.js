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

const setTimeout = (func, delay, ...args) => {
    const wrappedFunc = () => {
        func.apply(this, args);
    };
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

const setInterval = (func, delay, ...args) => {
    const wrappedFunc = () => {
        return func.apply(this, args) || true;
    };
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

class Extension {
    constructor() {
        this._settings = ExtensionUtils.getSettings(schema_id);
        this.vertical = false;
        
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);

        Main.overview.connect('showing', this._onOverviewShowing.bind(this));
        Main.overview.connect('hidden', this._onOverviewHidden.bind(this));

        this._settings.connect(`changed::${SettingsKey.BG_OPACITY}`, () => {
            this.dash.first_child.opacity = 255 * this._settings.get_double(SettingsKey.BG_OPACITY);
        });
        this._settings.connect(`changed::${SettingsKey.BG_DARK}`, () => {
            if (this._settings.get_boolean(SettingsKey.BG_DARK)) {
                this.dashContainer.add_style_class_name('dark');
            } else {
                this.dashContainer.remove_style_class_name('dark');
            }
        });
        this._settings.connect(`changed::${SettingsKey.ANIMATE_ICONS}`, () => {
            if (this._settings.get_boolean(SettingsKey.ANIMATE_ICONS)) {
                this._enable_animation();
            } else {
                this._disable_animation();
            }
        });
    }

    enable() {

        if (this.recycleOldDash) {
        	this.originalDash = Main.uiGroup.find_child_by_name('dash');
            this.dash = this.originalDash;
        } else {
            this.dash = new Dash();
            this.dash.set_name('dash');
            this.dash.add_style_class_name('overview');
            // this.dash.showAppsButton.connect('notify::checked',
            //     Main.overview._overview.controls._onShowAppsButtonToggled.bind(Main.overview._overview.controls));
        }

        this.dash.showAppsButton.hide();
        this.dashContainer = new St.BoxLayout({ name: 'dashContainer',
                                           vertical: true });

        Main.layoutManager.addChrome(
            this.dashContainer,
            {   affectsStruts: true,
                trackFullscreen: true
            });

        let [sw, sh] = global.display.get_size();

        // this.dockWidth = 80;
        this.dockHeight = this.shrink ? 80 : 110;

        this.animationContainer = new St.Widget();

        // layout
        if (this.vertical) {
            this.dashContainer.set_position(0, 0);
            this.dash.last_child.vertical = true;
            this.dash.last_child.first_child.layout_manager.orientation = 1;
            this.dashContainer.set_height(sh);
        } else {
            this.dashContainer.set_position(0, sh - this.dockHeight);
            this.dashContainer.set_width(sw);
            this.dashContainer.set_height(this.dockHeight);
        }

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

        if (this.shrink) {
            this.dashContainer.add_style_class_name('shrink');
        } else {
            this.dashContainer.remove_style_class_name('shrink');
        }
        if (this._settings.get_boolean(SettingsKey.BG_DARK)) {
            this.dashContainer.add_style_class_name('dark');
        } else {
            this.dashContainer.remove_style_class_name('dark');
        }        

        // theme        
        this.dash.first_child.opacity = 255 * this._settings.get_double(SettingsKey.BG_OPACITY);

        this.dashContainer.add_child(this.dash);
        Main.uiGroup.add_child(this.animationContainer);

        this.animationContainer.hide();
        this._enable_animation();
    }

    disable() {
        this.dash.showAppsButton.hide();
        if (this.recycleOldDash) {
            this.dashContainer.remove_child(this.dash);
            Main.uiGroup.find_child_by_name('overview').first_child.add_child(this.dash);
        } else {
            Main.overview.dash.height = -1;
            Main.overview.dash.show();
        }

        Main.layoutManager.removeChrome(this.dashContainer);
        delete this.dashContainer;
    }

    _onOverviewShowing() {
        this._inOverview = true;
        this.dashContainer.height = 0;
        this.animationContainer.hide();
        this.dash.hide();
    }

    _onOverviewHidden() {
        this._inOverview = false;
        this.dashContainer.height = this.dockHeight;
        this.animationContainer.show();
        this.dash.show();
    }

    _enable_animation() {
        this._animationOn = true;
        if (!this._settings.get_boolean(SettingsKey.ANIMATE_ICONS) || this._animationControllerSet) {
            return;
        }

        this.dashContainer.set_reactive(true);
        this.dashContainer.set_track_hover(true);        
        this._animateOut = 0;
        this._inDash = false;

        setInterval(() => {
            this._animate();
        }, 15);

        this.dashContainer.connect('motion-event', (actor, event, motion) => {
            this._animateOut = 0;
        });

        this.dashContainer.connect('enter-event', () => {
            this._animateOut = 0;
            this._inDash = true;
        });

        this.dashContainer.connect('leave-event', () => {
            this._animateOut = 8;
            this._inDash = false;
        });

        this._animate(true);

        this._animationControllerSet = true;
    }

    _disable_animation() {
        this._animationOn = false;
    }

    _animate(animateOut) {
        let Dash = this.dash;
        let pointer = global.get_pointer();
        pointer[0] -= Dash.last_child.x;
        pointer[1] -= Dash.y;

        let iconWidth = this.shrink ? 58 : 68;

        this.animationContainer.position = this.dashContainer.position;
        this.animationContainer.size = this.dashContainer.size;

        let X = Dash.last_child.x;
        this.Y = this.Y || Dash.last_child.y;
        let Y = this.Y;

        if (X == 0) return;

        let pivot = new Point();
        pivot.x = 0.5;
        pivot.y = 1.0;

        this.animationContainer.get_children().forEach(c => {
            c._orphan = true;
        })

        Dash.last_child.first_child.get_children().forEach(c => { 

            let newIcon = false;
            let pos = c.position;
            let dx = (pos.x + c.width/2 - pointer[0]);
            let dy = (pos.y + c.height/2 - pointer[1]);
            let d = Math.sqrt(dx * dx);
            let dst = 100;
            let dd = dst-d;
            let sz = 0;
            let sc = 0;
            if (!c.first_child || !c.first_child.first_child || !c.first_child.first_child.first_child) return;
            let szTarget = c.first_child.first_child;
            let szTargetIcon = szTarget._icon;;
            if (!szTargetIcon) {
                szTargetIcon = szTarget.first_child;
                szTarget._icon = szTargetIcon;
                szTargetIcon.set_fixed_position_set(true);
                let iconWidth = szTargetIcon.width;
                szTarget.remove_child(szTargetIcon);
                newIcon = true;
            }
            if (!animateOut && d < dst && dd > 0 && this._inDash) {
                sz = -20 * (dd / dst);
                sc = (0.5 * dd / dst);
            }

            if (!this._animationOn) {
                sz = 0;
                sc = 0;
            }

            if (!szTargetIcon.icon) return;

            szTarget.width = iconWidth;

            szTargetIcon.x = pos.x + X + (iconWidth * 0.2)/2;
            szTargetIcon.icon.width = iconWidth * 0.8;
            szTargetIcon.icon.height= iconWidth * 0.8;
            szTargetIcon._orphan = false;
            szTargetIcon.scale_x = 1 + sc;
            szTargetIcon.scale_y = 1 + sc;
            szTargetIcon.pivot_point = pivot;

            if (newIcon) {
                szTargetIcon.y = pos.y + Y + (iconWidth * 0.4) + sz;
                this.animationContainer.add_child(szTargetIcon);
            } else {
                let tz = (pos.y + Y + (iconWidth * 0.4) + sz) - szTargetIcon.y;
                szTargetIcon.y = szTargetIcon.y + tz * 0.4;
                c.label.y = szTargetIcon.y + this.animationContainer.y - iconWidth;
            }

        });

        if (!this._inOverview) {
            this.animationContainer.show();
        } else {
            this.animationContainer.hide();
        }

        this.animationContainer.get_children().forEach(c => {
            if (c._orphan) {
                this.animationContainer.remove_child(c);
            }
        })
    }
}

function init() {
	return new Extension();
}


