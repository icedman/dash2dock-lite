/*
  License: GPL v3
*/

/*

Main.setTimeout = (func, delay, ...args) => {
    const wrappedFunc = () => {
        func.apply(this, args);
    };
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

Main.setInterval = (func, delay, ...args) => {
    const wrappedFunc = () => {
        return func.apply(this, args) || true;
    };
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

*/

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Layout = imports.ui.layout;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;

class Extension {
    constructor() {
    }

    enable() {
    	this.dash = new Dash();
    	this.dash.set_name('MyDash');
        this.dash.add_style_class_name('overview');

        let sw = 1920; // Main.uiGroup.get_width();
        let sh = 1080; // Main.uiGroup.get_height();

        // let dockWidth = 116;
        let dockHeight = 90;

        let vertical = false;

        if (vertical) {
            this.dash.set_position(0, 0);
            this.dash.last_child.vertical = true;
            this.dash.last_child.first_child.layout_manager.orientation = 1;
            // this.dash.set_height(sh);
        } else {
        	this.dash.set_position(0, sh-dockHeight);
            this.dash.set_width(sw);
        }

        Main.layoutManager.addTopChrome(this.dash);

        Main.overview.dash.set_width(1);
        Main.overview.dash.hide();

        /*
        this.dash.set_track_hover(true);
        this.dash.set_reactive(true);
        let MyDash = this.dash;

        let defaultSz = 1;
        this.dash.connect('motion-event', (actor, event, motion) => {
            let pointer = global.get_pointer();
            pointer[0] -= MyDash.last_child.x;
            pointer[1] -= MyDash.y;

            MyDash.last_child.first_child.get_children().forEach(c => { 
                let pos = c.position;
                let dx = (pos.x + c.width/2 - pointer[0]);
                let dy = (pos.y + c.height/2 - pointer[1]);
                let d = Math.sqrt(dx * dx); //  + dy * dy;

                let szTarget = c.first_child.first_child;
                if (d < 200) {
                    let sz = defaultSz + (1 - (d / 200));
                    // c.add_style_class_name('hi');
                    // szTarget.scale_x = sz;
                    // szTarget.scale_y = sz;
                    // szTarget.margin_bottom = sz * 40;
                    szTarget.margin_left = sz * 20;
                } else {
                    // szTarget.scale_x = defaultSz;
                    // szTarget.scale_y = defaultSz;
                }
            });

        });

        this.dash.connect('leave-event', () => {
            MyDash.last_child.first_child.get_children().forEach(c => { 
                // c.remove_style_class_name('hi');
                let szTarget = c.first_child.first_child;
                szTarget.margin_left = 0;
                // szTarget.scale_x = defaultSz;
                // szTarget.scale_y = defaultSz;
                // szTarget.margin_bottom = 0;
            })
        });
        */
        
        this.dash.connect('notify::allocation', () => {
            let primary = Main.layoutManager.primaryMonitor;
            if (primary.inFullscreen()) {
                c.add_style_class_name('hi');
                MyDash.hide();
            } else {
                MyDash.show();
            }
        });

    }

    disable() {
    	Main.uiGroup.remove_child(this.dash);
    	delete this.dash;

        Main.overview.dash.set_width(-1);
        Main.overview.dash.show();
    }
}

function init() {
	return new Extension();
}

