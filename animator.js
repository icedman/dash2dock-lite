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
const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

class _Animator
{
	update(params) {
		this._params = params;
		this.dash = this._params.dash;
		this.dashContainer = this._params.container;

		if (this._params.enable) {
			this.enable();
		} else {
			this.disable();
		}
	}

	enable() {
        this.dashContainer.set_reactive(true);
        this.dashContainer.set_track_hover(true);

        this.animationContainer = new St.Widget({ name: 'animationContainer' });
        Main.uiGroup.add_child(this.animationContainer);

        this._motionEventId = this.dashContainer.connect('motion-event', this._onMotionEvent.bind(this));
        this._enterEventId = this.dashContainer.connect('enter-event', this._onEnterEvent.bind(this));
        this._leaveEventId = this.dashContainer.connect('leave-event', this._onLeaveEvent.bind(this));
        this._focusWindowId = global.display.connect('notify::focus-window', this._runForAwhile.bind(this));
	}

	disable() {
        this.dashContainer.set_reactive(false);
        this.dashContainer.set_track_hover(false);

        if (this.animationContainer) {
			this.animationContainer.get_children().forEach(c => {
	            this.animationContainer.remove_child(c);
	        });
	        this.dash.last_child.first_child.get_children().forEach(c => {

	            if (!c.first_child || !c.first_child.first_child || !c.first_child.first_child.first_child) return;
            	let szTarget = c.first_child.first_child;
	            let szTargetIcon = szTarget._icon;

	        	if (szTargetIcon) {
	        		szTargetIcon.set_fixed_position_set(false);	        		
	        		szTarget._icon = null;
	        		szTarget.width = -1;
	        		szTarget.height = -1;
	        		szTarget.add_child(szTargetIcon);	        		
	        		szTarget.queue_relayout();
	        		szTarget.queue_redraw();
	        	}
	        });

	        Main.uiGroup.remove_child(this.animationContainer);
	        delete this.animationContainer;
		}

		if (this._motionEventId) {
	        this.dashContainer.disconnect(this._motionEventId);
	        delete this._motionEventId;
	        this.dashContainer.disconnect(this._enterEventId);
	        delete this._enterEventId;
	        this.dashContainer.disconnect(this._leaveEventId);
	        delete this._leaveEventId;
            global.display.disconnect(this._focusWindowId);
            delete this._focusWindowId;
    	}
	}

	_onMotionEvent() {
		this._animate();
	}

	_onEnterEvent() {
		this._inDash = true;
		// this.animationContainer.add_style_class_name('hi');
	}	

	_onLeaveEvent() {
		this._inDash = false;
		this._runForAwhile();
        // this.animationContainer.remove_style_class_name('hi');
	}

    _runForAwhile() {
        // if (!this._params.enabled) return;

        for(let i=15; i<200; i+=15) {
            setTimeout(() => {
                this._animate();
            }, i);
        }
    }

	_animate() {
        let pointer = global.get_pointer();
        pointer[0] -= this.dash.last_child.x;
        pointer[1] -= this.dash.y;

        let iconWidth = this._params.shrink ? 58 : 64;

        this.animationContainer.position = this.dashContainer.position;
        this.animationContainer.size = this.dashContainer.size;

        let X = this.dash.last_child.x;
        let Y = 0;

        if (X == 0) return;

        let pivot = new Point();
        pivot.x = 0.5;
        pivot.y = 1.0;

        this.animationContainer.get_children().forEach(c => {
            c._orphan = true;
        })

        this.dash.last_child.first_child.get_children().forEach(c => {

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

            if (d < dst && dd > 0 && this._inDash) {
                sz = -20 * (dd / dst);
                sc = (0.5 * dd / dst);
            }

            let szTarget = c.first_child.first_child;
            let szTargetIcon = szTarget._icon;
            if (!szTargetIcon) {
                szTargetIcon = szTarget.first_child;
                if (!szTargetIcon.icon) {
                	szTargetIcon = szTarget.last_child;
                }
	            if (!szTargetIcon.icon) return;

                szTarget._icon = szTargetIcon;
                szTargetIcon.set_fixed_position_set(true);
                let iconWidth = szTargetIcon.width;
                szTarget.remove_child(szTargetIcon);
                newIcon = true;
            }

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
}

var Animator = _Animator;
