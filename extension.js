/*
  No overview at start-up
  (c) fthx 2021
  License: GPL v3
  Legacy code is commented out for future possible flashback
*/


const GLib = imports.gi.GLib;
const Main = imports.ui.main;
//const Overview = Main.overview;


class Extension {
	constructor() {
		Main.sessionMode.hasOverview = false;
		this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
			Main.sessionMode.hasOverview = true;
		});
	}

	enable() {		
	}

	disable() {
		if (this._timeout) {
			GLib.source_remove(this._timeout);
		}
	}
}

/*class Extension {
	constructor() {
		this.signal = Overview.connect('shown', this._hide.bind(this));
	}
	
	_hide() {
		Overview.hide();
		if (this.signal) {
				Overview.disconnect(this.signal);
		}
	}

	enable() {
	}

	disable() {
		if (this.signal && Overview.signalHandlerIsConnected(this.signal)) {
			Overview.disconnect(this.signal);
		}
	}
}*/

function init() {
	return new Extension();
}

