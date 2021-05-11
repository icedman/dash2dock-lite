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
        this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
        this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
        this.bgDark = this._settings.get_boolean(SettingsKey.BG_DARK);
        this.bgOpacity = this._settings.get_boolean(SettingsKey.BG_OPACITY);
        this.recycleOldDash = this._settings.get_boolean(SettingsKey.REUSE_DASH);
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
            this.bgOpacity = this._settings.get_boolean(SettingsKey.BG_OPACITY);
            this._updateBgOpacity();
        });
        this._settings.connect(`changed::${SettingsKey.ANIMATE_ICONS}`, () => {
            this.animateIcons = this._settings.get_boolean(SettingsKey.ANIMATE_ICONS);
        });
        this._settings.connect(`changed::${SettingsKey.SHRINK_ICONS}`, () => {
            this.shrink = this._settings.get_boolean(SettingsKey.SHRINK_ICONS);
            this._updateShrink();
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
        this.dashContainer = new St.BoxLayout({ name: 'dashContainer', vertical: true });

        Main.layoutManager.addChrome(
            this.dashContainer,
            {   affectsStruts: true,
                trackFullscreen: true
            });

        this.animationContainer = new St.Widget({ name: 'animationContainer' });
        Main.uiGroup.add_child(this.animationContainer);

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

        this._updateShrink();
        this._updateBgDark();
        this._updateBgOpacity();
        this._updateLayout();
        this._updateAnimation();
    }

    disable() {
        this._updateShrink(true);
        this._updateBgDark(true);
        this._updateBgOpacity(true);
        this._updateLayout(true);
        this._updateAnimation(true);

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

    _updateShrink(disable) {
        if (this.shrink && !disable) {
            this.dashContainer.add_style_class_name('shrink');
        } else {
            this.dashContainer.remove_style_class_name('shrink');
        }
        this._updateLayout(disable);
    }

    _updateBgDark(disable) {
        if (this.bgDark && !disable) {
            this.dashContainer.add_style_class_name('dark');
        } else {
            this.dashContainer.remove_style_class_name('dark');
        }        
    }

    _updateBgOpacity(disable) {
        if (disable) {
            this.dash.first_child.opacity = 255 * this._bgOpacity;
        } else {
            this.dash.first_child.opacity = 255;
        }
    }

    _updateLayout(disable) {
        let [sw, sh] = global.display.get_size();
        this.dockHeight = (this.shrink && !disable) ? 80 : 110;
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
    }

    _updateAnimation() {

    }

    _enable_animation() {
        this._animationOn = true;

        if (!this._settings.get_boolean(SettingsKey.ANIMATE_ICONS)) {
            return;
        }

        this.dashContainer.set_reactive(true);
        this.dashContainer.set_track_hover(true);        
        this._animateOut = 0;
        this._inDash = false;

        // setInterval(() => {
        //     if (!this._inOverview) {
        //         this.animationContainer.show();
        //     } else {
        //         this.animationContainer.hide();
        //     }           
        // }, 15);

        this.dashContainer.connect('motion-event', (actor, event, motion) => {
            this._animateOut = 0;
            this._animate();
        });

        this.dashContainer.connect('enter-event', () => {
            this._animateOut = 0;
            this._inDash = true;
            // this.dashContainer.add_style_class_name('hi');
        });

        this.dashContainer.connect('leave-event', () => {
            this._animateOut = 8;
            this._inDash = false;
            for(let i=15; i<200; i+=15) {
                setTimeout(() => {
                    this._animate()
                }, i);
            }
            // this.dashContainer.remove_style_class_name('hi');
        });

        this._animate(true);
    }

    _disable_animation() {
        this._animationOn = false;
        this.animationContainer.hide();
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
        let Y = 0;

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

        this.animationContainer.get_children().forEach(c => {
            if (c._orphan) {
                this.animationContainer.remove_child(c);
            }
        })
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
}

function init() {
	return new Extension();
}


