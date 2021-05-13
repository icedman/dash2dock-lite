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
const clearInterval = Me.imports.utils.clearInterval;

const iconScaleUp = 1.2;
const iconPadCoef = 0.8;
const xAnimFactor = 0.2;
const yAnimFactor = 0.2;
const scaleAnimFactor = 0.1;
const padReduceFactor = 0.94;

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

        this._runForAwhile();
        this._intervalId = setInterval(this._animate.bind(this), 200);
	}

	disable() {
        this.dashContainer.set_reactive(false);
        this.dashContainer.set_track_hover(false);

        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }

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
            this.animationContainer = null;
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

        let idx = 0;
        let topIdx = -1;
        let topY = 0;
        this.dash.last_child.first_child.get_children().forEach(c => {

            let newIcon = false;
            let pos = c.position;
            let dx = (pos.x + c.width/2 - pointer[0]);
            let dy = (pos.y + c.height/2 - pointer[1]);
            let d = Math.sqrt(dx * dx);
            let dst = 150;
            let dstx = 500;
            let dd = dst-d;
            let sz = 0;
            let sc = 0;
            let sx = 0;

            if (!c.first_child || !c.first_child.first_child || !c.first_child.first_child.first_child) return;
            if (d < dst && dd > 0 && this._inDash) {
                let df = (dd / dst);
                sz = -10 * df;
                sc = iconScaleUp * df;
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
            szTargetIcon.icon.width = iconWidth * 0.8;
            szTargetIcon.icon.height= iconWidth * 0.8;
            szTargetIcon._orphan = false;

            let scc = (1 + sc) - szTargetIcon.scale_x;
            szTargetIcon.scale_x = szTargetIcon.scale_x + scc * scaleAnimFactor;
            szTargetIcon.scale_y = szTargetIcon.scale_y + scc * scaleAnimFactor;

            szTargetIcon.pivot_point = pivot;

            if (newIcon) {
                szTargetIcon.x = pos.x + X + (iconWidth * 0.2)/2 - sx;                
                szTargetIcon.y = pos.y + Y + (iconWidth * 0.4) + sz;
                this.animationContainer.add_child(szTargetIcon);
            } else {
                let tz = (pos.y + Y + (iconWidth * 0.4) + sz) - szTargetIcon.y;
                szTargetIcon.y = szTargetIcon.y + tz * yAnimFactor;
                c.label.y = szTargetIcon.y + this.animationContainer.y - (iconWidth * 1.4);

                if (sz != 0 && (szTargetIcon.y < topY || topY == 0)) {
                    topY = szTargetIcon.y;
                    topIdx = idx;
                }
            }

            szTargetIcon._x = pos.x + X + (iconWidth * 0.2)/2 - sx;
            szTargetIcon.x = (szTargetIcon.x * 3 + szTargetIcon._x)/4;
            idx++;

        });

        if (topIdx != -1) {
            let tl = topIdx - 1;
            let tr = topIdx + 1;
            let pad = iconWidth * iconPadCoef;
            for(let i=0; i<20; i++) {
                let cl = this.dash.last_child.first_child.get_children()[tl--];
                let cr = this.dash.last_child.first_child.get_children()[tr++];
                
                if (cl && cl.first_child && cl.first_child.first_child) {
                    let szTarget = cl.first_child.first_child;
                    let szTargetIcon = szTarget._icon;
                    let tx = szTargetIcon._x - pad;
                    szTargetIcon.x += (tx - szTargetIcon.x) * xAnimFactor;
                }

                if (cr && cr.first_child && cr.first_child.first_child) {
                    let szTarget = cr.first_child.first_child;
                    let szTargetIcon = szTarget._icon;
                    let tx = szTargetIcon._x + pad;
                    szTargetIcon.x += (tx - szTargetIcon.x) * xAnimFactor;
                }

                if (!cl && !cr) break;

                pad *= padReduceFactor;
            }
        }

        this.animationContainer.get_children().forEach(c => {
            if (c._orphan) {
                this.animationContainer.remove_child(c);
            }
        })
	}

    show() {
        if (this.animationContainer) {
            this.animationContainer.show();
        }
    }

    hide() {
        if (this.animationContainer) {
            this.animationContainer.hide();
        }
    }
}

var Animator = _Animator;
