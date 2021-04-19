/*
  No overview at start-up
  (c) fthx 2021
  License: GPL v3
*/


const Main = imports.ui.main;
const Overview = Main.overview;


class Extension {
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
}

function init() {
	return new Extension();
}

