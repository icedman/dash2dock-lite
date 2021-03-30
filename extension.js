/*
  No overview at start-up
  (c) fthx 2021
  License: GPL v3
*/


const Main = imports.ui.main;
const Overview = Main.overview;


class Extension {
	constructor() {
	}
	
	hide() {
		Overview.hide();
		Overview.disconnect(this.signal);
	}

	enable() {
		this.signal = Overview.connect('shown', this.hide.bind(this));
	}

	disable() {
		if (Overview.signalHandlerIsConnected(this.signal)) {
			Overview.disconnect(this.signal);
		}			
	}
}

function init() {
	return new Extension();
}



