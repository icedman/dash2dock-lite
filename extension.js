/* 
	BaBar
	(c) Francois Thirioux 2021
	Contributors: @fthx, @wooque, @frandieguez, @kenoh, @justperfection
	License GPL v3
*/


const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;

const Main = imports.ui.main;
const DND = imports.ui.dnd;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Dash = imports.ui.dash;
const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const AppMenu = Main.panel.statusArea.appMenu;
const WM = global.workspace_manager;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// get Shell version
var is_shell_version_40 = imports.misc.config.PACKAGE_VERSION.split('.')[0] >= 40;

// translation needed to restore Places label, if any
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = x => x;

// workspaces names from native schema
var WORKSPACES_SCHEMA = "org.gnome.desktop.wm.preferences";
var WORKSPACES_KEY = "workspace-names";

// initial fallback settings
var RIGHT_CLICK = true;
var MIDDLE_CLICK = true;
var REDUCE_PADDING = true;
var APP_GRID_ICON_NAME = 'view-app-grid-symbolic';
var PLACES_ICON_NAME = 'folder-symbolic';
var FAVORITES_ICON_NAME = 'starred-symbolic';
var FALLBACK_ICON_NAME = 'applications-system-symbolic';
var ICON_SIZE = 18;
var ROUNDED_WORKSPACES_BUTTONS = false;
var TOOLTIP_VERTICAL_PADDING = 10;
var THUMBNAIL_MAX_SIZE = 25;
var HIDDEN_OPACITY = 127;
var UNFOCUSED_OPACITY = 255;
var FOCUSED_OPACITY = 255;
var DESATURATE_ICONS = false;
var FAVORITES_FIRST = false;
var DISPLAY_ACTIVITIES = false;
var DISPLAY_APP_GRID = true;
var DISPLAY_PLACES_ICON = true;
var DISPLAY_FAVORITES = true;
var DISPLAY_WORKSPACES = true;
var DISPLAY_TASKS = true;
var DISPLAY_APP_MENU = false;
var DISPLAY_DASH = true;
var DISPLAY_WORKSPACES_THUMBNAILS = true;


var AppGridButton = GObject.registerClass(
class AppGridButton extends PanelMenu.Button {
	_init() {
		super._init(0.0, 'Babar-AppGrid');
		
		this.app_grid_button = new St.BoxLayout({visible: true, reactive: true, can_focus: true, track_hover: true});
		this.app_grid_button.icon = new St.Icon({icon_name: APP_GRID_ICON_NAME, style_class: 'system-status-icon'});
        this.app_grid_button.add_child(this.app_grid_button.icon);
		this.app_grid_button.connect('button-release-event', this._show_apps_page.bind(this));
        this.add_child(this.app_grid_button);
	}

	_show_apps_page() {
		if (Main.overview.visible) {
			Main.overview.hide();
		} else {
			if (is_shell_version_40) {
				Main.overview.showApps();
			} else {
				Main.overview.viewSelector._toggleAppsPage();
			}
		}
	}
	
	_destroy() {
		super.destroy();
	}
});

var FavoritesMenu = GObject.registerClass(
class FavoritesMenu extends PanelMenu.Button {
	_init() {
		super._init(0.0, 'Babar-Favorites');
		
		this.fav_changed = AppFavorites.getAppFavorites().connect('changed', this._display_favorites.bind(this));
		
    	this.fav_menu_button = new St.BoxLayout({});
		this.fav_menu_icon = new St.Icon({icon_name: FAVORITES_ICON_NAME, style_class: 'system-status-icon'});
        this.fav_menu_button.add_child(this.fav_menu_icon);
		if (!is_shell_version_40) {
			this.fav_menu_button.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
		}
        this.add_child(this.fav_menu_button);

		this._display_favorites();
	}
	
	// display favorites menu
	_display_favorites() {
		// destroy old menu items
		if (this.menu) {
			this.menu.removeAll();
		}
		
		// get favorites list
    	this.list_fav = AppFavorites.getAppFavorites().getFavorites();
        
        // create favorites items
		for (let fav_index = 0; fav_index < this.list_fav.length; ++fav_index) {
    		this.fav = this.list_fav[fav_index];
    		this.fav_icon = this.fav.create_icon_texture(64);

			this.item = new PopupMenu.PopupImageMenuItem(this.fav.get_name(), this.fav_icon.get_gicon());
    		this.item.connect('activate', () => this._activate_fav(fav_index));
    		this.menu.addMenuItem(this.item);
			
			// drag and drop
			this.item.fav_index = fav_index;
			this.item.is_babar_favorite = true;

			this.item._delegate = this.item;
			this.item._draggable = DND.makeDraggable(this.item, {dragActorOpacity: HIDDEN_OPACITY});
			
			this.item._draggable.connect('drag-end', this._on_drag_end.bind(this));
			this.item._draggable.connect('drag-cancelled', this._on_drag_end.bind(this));
    	}
	}

	// on drag cancelled or ended
	_on_drag_end() {
		this.menu.close();
		this._display_favorites();
	}
	
	// activate favorite
	_activate_fav(fav_index) {
    	AppFavorites.getAppFavorites().getFavorites()[fav_index].open_new_window(-1);
    }
    
    // remove signals, destroy workspaces bar
	_destroy() {
		if (this.fav_changed) {
			AppFavorites.getAppFavorites().disconnect(this.fav_changed);
		}
		super.destroy();
	}
});

var WorkspacesBar = GObject.registerClass(
class WorkspacesBar extends PanelMenu.Button {
	_init() {
		super._init(0.0, 'Babar-Tasks');
		
		// tracker for windows
		this.window_tracker = Shell.WindowTracker.get_default();
		
		// define gsettings schema for workspaces names, get workspaces names, signal for settings key changed
		this.ws_settings = new Gio.Settings({schema: WORKSPACES_SCHEMA});
		this.ws_names_changed = this.ws_settings.connect(`changed::${WORKSPACES_KEY}`, this._update_ws_names.bind(this));
		
		// define windows that need an icon (see https://www.roojs.org/seed/gir-1.2-gtk-3.0/seed/Meta.WindowType.html)
		this.window_type_whitelist = [Meta.WindowType.NORMAL, Meta.WindowType.DIALOG];
		
		// bar creation
		this.ws_bar = new St.BoxLayout({});
        this._update_ws_names();
        this.add_child(this.ws_bar);
        
		// window thumbnail
		if (RIGHT_CLICK) {
			this.window_thumbnail = new WindowThumbnail();
			this.window_thumbnail.overview = Main.overview.connect('showing', () => this.window_thumbnail._remove());
		}
		
		// window button tooltip
		this.window_tooltip = new WindowTooltip();
        
        // signals
		this._ws_number_changed = WM.connect('notify::n-workspaces', this._update_ws.bind(this));
		this._active_ws_changed = WM.connect('active-workspace-changed', this._update_ws.bind(this));
		this._restacked = global.display.connect('restacked', this._update_ws.bind(this));
		this._window_left_monitor = global.display.connect('window-left-monitor', this._update_ws.bind(this));
	}

	// remove signals, restore Activities button, destroy workspaces bar
	_destroy() {
		if (this.ws_names_changed) {
			this.ws_settings.disconnect(this.ws_names_changed);
		}

		if (this._ws_number_changed) {
			WM.disconnect(this._ws_number_changed);
		}

		if (this._active_ws_changed) {
			WM.disconnect(this._active_ws_changed);
		}

		if (this._restacked) {
			global.display.disconnect(this._restacked);
		}

		if (this._window_left_monitor) {
			global.display.disconnect(this._window_left_monitor);
		}

		if (this.hide_tooltip_timeout) {
			GLib.source_remove(this.hide_tooltip_timeout);
		}

		if (this.window_tooltip) {
			this.window_tooltip.destroy();
		}

		if (this.window_thumbnail) {
			Main.overview.disconnect(this.window_thumbnail.overview);
			if (this.window_thumbnail.timeout) {
				GLib.source_remove(this.window_thumbnail.timeout);
			}
			this.window_thumbnail.destroy();
		}

		this.ws_bar.destroy();
		super.destroy();
	}
	
	// update workspaces names
	_update_ws_names() {
		this.ws_names = this.ws_settings.get_strv(WORKSPACES_KEY);
		this._update_ws();
	}

	// update the workspaces bar
    _update_ws() {
    	// destroy old workspaces bar buttons and signals
    	this.ws_bar.destroy_all_children();
    	
    	// get number of workspaces
        this.ws_count = WM.get_n_workspaces();
        this.active_ws_index = WM.get_active_workspace_index();
        		
		// display all current workspaces and tasks buttons
        for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {
        	// workspace
			let ws_box = new WorkspaceButton();
			ws_box.number = ws_index;
			let ws_box_label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
			
			// rounded buttons option
			if (!ROUNDED_WORKSPACES_BUTTONS) {
				if (ws_index == this.active_ws_index) {
					ws_box_label.style_class = 'workspace-active-squared';
				} else {
					ws_box_label.style_class = 'workspace-inactive-squared';
				}
			} else {
				if (ws_index == this.active_ws_index) {
					ws_box_label.style_class = 'workspace-active-rounded';
				} else {
					ws_box_label.style_class = 'workspace-inactive-rounded';
				}
			}
			
			// workspace numbered label
			if (this.ws_names[ws_index]) {
				ws_box_label.set_text("  " + this.ws_names[ws_index] + "  ");
			} else {
				ws_box_label.set_text("  " + (ws_index + 1) + "  ");
			}
			ws_box.set_child(ws_box_label);

			// signal
			ws_box.connect('button-release-event', () => this._toggle_ws(ws_index));

			// add in task bar
			if (DISPLAY_WORKSPACES) {
	        	this.ws_bar.add_child(ws_box);
	        }
	        
	        // tasks
	        this.ws_current = WM.get_workspace_by_index(ws_index);
			if (FAVORITES_FIRST) {
				this.favorites_list = AppFavorites.getAppFavorites().getFavorites();
				this.ws_current.windows = this.ws_current.list_windows().sort(this._sort_windows_favorites_first.bind(this));
			} else {
	        	this.ws_current.windows = this.ws_current.list_windows().sort(this._sort_windows);
			}
	        for (let window_index = 0; window_index < this.ws_current.windows.length; ++window_index) {
	        	this.window = this.ws_current.windows[window_index];
	        	if (this.window && this.window_type_whitelist.includes(this.window.get_window_type())) {
	        		this._create_window_button(ws_index, this.window);
	        	}
	        }
		}
    }
    
    // create window button ; ws = workspace, w = window
    _create_window_button(ws_index, w) {    	
        // windows on all workspaces have to be displayed only once
    	if (!w.is_on_all_workspaces() || ws_index == 0) {
		    // create button
			let w_box = new WindowButton();
			w_box.window = w;
			w_box.workspace_number = ws_index;
		    let w_box_app = this.window_tracker.get_window_app(w);

		    // create w button and its icon
		    let w_box_icon;
		    if (w_box_app) {
		    	w_box_icon = w_box_app.create_icon_texture(ICON_SIZE);
		    }
		    // sometimes no icon is defined or icon is void, at least for a short time
		    if (!w_box_icon || w_box_icon.get_style_class_name() == 'fallback-app-icon') {
		    	w_box_icon = new St.Icon({icon_name: FALLBACK_ICON_NAME, icon_size: ICON_SIZE});
			}
			w_box.set_child(w_box_icon);

			// signals
			w_box.connect('button-release-event', (widget, event) => this._on_button_press(widget, event, w_box, ws_index, w));
			w_box.connect('notify::hover', () => this._on_button_hover(w_box, w.title));
			
			// desaturate option
			if (DESATURATE_ICONS) {
				this.desaturate = new Clutter.DesaturateEffect();
				w_box_icon.add_effect(this.desaturate);
			}
		    
			// set icon style and opacity following window state
		    if (w.is_hidden()) {
				w_box.style_class = 'window-hidden';
				w_box_icon.set_opacity(HIDDEN_OPACITY);
		    } else {
				if (w.has_focus()) {
					w_box.style_class = 'window-focused';
					w_box_icon.set_opacity(FOCUSED_OPACITY);
				} else {
					w_box.style_class = 'window-unfocused';
					w_box_icon.set_opacity(UNFOCUSED_OPACITY);
				}
		    }
			
		    // add in task bar
		   	if (w.is_on_all_workspaces()) {
		   		this.ws_bar.insert_child_at_index(w_box, 0);	
		   	} else {
		    	this.ws_bar.add_child(w_box);
		    }
		}
	}

	// on window w button press
    _on_button_press(widget, event, w_box, ws_index, w) {
    	// left-click: toggle window
    	if (event.get_button() == 1) {
			this.window_tooltip.hide();
			if (w.has_focus() && !Main.overview.visible) {
				if (w.can_minimize()) {
		   			w.minimize();
		   		}
		   	} else {	
				w.activate(global.get_current_time());
			}
			if (Main.overview.visible) {
				Main.overview.hide();
			}
			if (!w.is_on_all_workspaces()) {
				WM.get_workspace_by_index(ws_index).activate(global.get_current_time());
			}
		}
		
		// right-click: display window thumbnail
		if (RIGHT_CLICK && event.get_button() == 3) {
			if (!this.window_thumbnail.visible || this.window_thumbnail.window_id !== w.get_id()) {
				this.window_tooltip.hide();
				this.window_thumbnail.window = w.get_compositor_private();

				if (this.window_thumbnail.window && this.window_thumbnail.window.get_size()[0] && this.window_thumbnail.window.get_texture()) {
					[this.window_thumbnail.width, this.window_thumbnail.height] = this.window_thumbnail.window.get_size();
					this.window_thumbnail.max_width = THUMBNAIL_MAX_SIZE / 100 * global.display.get_size()[0];
					this.window_thumbnail.max_height = THUMBNAIL_MAX_SIZE / 100 * global.display.get_size()[1];
					this.window_thumbnail.scale = Math.min(1.0, this.window_thumbnail.max_width / this.window_thumbnail.width, this.window_thumbnail.max_height / this.window_thumbnail.height);
					
					this.window_thumbnail.clone.set_source(this.window_thumbnail.window);
					this.window_thumbnail.clone.set_size(this.window_thumbnail.scale * this.window_thumbnail.width, this.window_thumbnail.scale * this.window_thumbnail.height);
					this.window_thumbnail.set_size(this.window_thumbnail.scale * this.window_thumbnail.width, this.window_thumbnail.scale * this.window_thumbnail.height);

					this.window_thumbnail.set_position(w_box.get_transformed_position()[0], Main.layoutManager.primaryMonitor.y + Main.panel.height + TOOLTIP_VERTICAL_PADDING);
					this.window_thumbnail.show();
					this.window_thumbnail.window_id = w.get_id();

					// remove thumbnail content and hide thumbnail if its window is destroyed
					this.window_thumbnail.destroy_signal = this.window_thumbnail.window.connect('destroy', () => {
						if (this.window_thumbnail) {
							this.window_thumbnail._remove();
						}
					});
				}
			} else {
				this.window_thumbnail._remove();
			}
		}
		
		// middle-click: close window
		if (MIDDLE_CLICK && event.get_button() == 2 && w.can_close()) {
			w.delete(global.get_current_time());
			this.window_tooltip.hide();
		}
    }
    
    // sort windows by creation date
    _sort_windows(w1, w2) {
    	return w1.get_id() - w2.get_id();
    }
    
    // sort windows by favorite order first then by creation date
    _sort_windows_favorites_first(w1, w2) {
		this.w1_app = this.window_tracker.get_window_app(w1);
		this.w2_app = this.window_tracker.get_window_app(w2);
		if (!this.w1_app || !this.w2_app) {
			return 0;
		}
		this.w1_is_favorite = AppFavorites.getAppFavorites().isFavorite(this.w1_app.get_id());
		this.w2_is_favorite = AppFavorites.getAppFavorites().isFavorite(this.w2_app.get_id());

		if (!this.w1_is_favorite && !this.w2_is_favorite) {
			return this._sort_windows(w1, w2);
		}
		if (this.w1_is_favorite && this.w2_is_favorite) {
			if (this.w1_app == this.w2_app) {
				return this._sort_windows(w1, w2);
			} else {
				return this.favorites_list.indexOf(this.w1_app) - this.favorites_list.indexOf(this.w2_app);
			}
		}
		if (this.w1_is_favorite && !this.w2_is_favorite) {
			return -1;
		}
		if (!this.w1_is_favorite && this.w2_is_favorite) {
			return 1;
		}
	}

    // toggle or show overview
    _toggle_ws(ws_index) {
		if (ws_index == WM.get_active_workspace_index()) {
			Main.overview.toggle();
		} else {
			WM.get_workspace_by_index(ws_index).activate(global.get_current_time());
			Main.overview.show();
		}
    }
    
    // on w button hover: toggle tooltip
    _on_button_hover(w_box, window_title) {
		if (window_title && w_box && w_box.get_hover()) {
			this.window_tooltip.set_position(w_box.get_transformed_position()[0], Main.layoutManager.primaryMonitor.y + Main.panel.height + TOOLTIP_VERTICAL_PADDING);
			this.window_tooltip.label.set_text(window_title);
			this.window_tooltip.show();
			this.hide_tooltip_timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
				if (!Main.panel.statusArea['babar-workspaces-bar'].get_hover()) {
					this.window_tooltip.hide()
				}
			});
		} else {
			this.window_tooltip.hide();
		}
    }
});

var WindowTooltip = GObject.registerClass(
class WindowTooltip extends St.BoxLayout {
	_init() {
		super._init({style_class: 'window-tooltip'});

		this.label = new St.Label({y_align: Clutter.ActorAlign.CENTER, text: ""});
		this.add_child(this.label);
		this.hide();
		Main.layoutManager.addChrome(this);
	}
});        

var WindowThumbnail = GObject.registerClass(
class WindowThumbnail extends St.Bin {
	_init() {
		super._init({visible: true, reactive: true, can_focus: true, track_hover: true, style_class: 'window-thumbnail'});

		this.connect('button-release-event', this._remove.bind(this));

		this._delegate = this;
		this._draggable = DND.makeDraggable(this, {dragActorOpacity: HIDDEN_OPACITY});

		this.saved_snap_back_animation_time = DND.SNAP_BACK_ANIMATION_TIME;

		this._draggable.connect('drag-end', this._end_drag.bind(this));
		this._draggable.connect('drag-cancelled', this._end_drag.bind(this));

		this.clone = new Clutter.Clone({reactive: true});
		this.set_child(this.clone);
		this._remove();
		Main.layoutManager.addChrome(this);
	}

	_remove() {
		if (this.clone) {
			this.clone.set_source(null);
		}
		this.hide();
	}

	_end_drag() {
		this.set_position(this._draggable._dragOffsetX + this._draggable._dragX, this._draggable._dragOffsetY + this._draggable._dragY);
		DND.SNAP_BACK_ANIMATION_TIME = 0;
		this.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 0, () => {
			DND.SNAP_BACK_ANIMATION_TIME = this.saved_snap_back_animation_time;
		});
	}
});

var WorkspaceButton = GObject.registerClass(
class WorkspaceButton extends St.Bin {
	_init() {
		super._init({visible: true, reactive: true, can_focus: true, track_hover: true});

		this._delegate = this;
	}

	acceptDrop(source) {
		// favorite menu item
		if (source.is_babar_favorite) {
			WM.get_workspace_by_index(this.number).activate(global.get_current_time());
			AppFavorites.getAppFavorites().getFavorites()[source.fav_index].open_new_window(-1);
		}

		// window button
		if (source.is_babar_task && source.workspace_number !== this.number) {
			source.window.change_workspace_by_index(this.number, false);
			if (source.window.has_focus()) {
				source.window.activate(global.get_current_time());
			}
			return true;
		}

		// dash button
		if (source instanceof Dash.DashIcon) {
			Main.overview.hide();
			WM.get_workspace_by_index(this.number).activate(global.get_current_time());
			source.app.open_new_window(-1);
			return true;
		}

		// app grid button
		if (source instanceof AppDisplay.AppIcon) {
			Main.overview.hide();
			WM.get_workspace_by_index(this.number).activate(global.get_current_time());
			source.app.open_new_window(-1);
			return true;
		}

		return false;
	}	
});

var WindowButton = GObject.registerClass(
class WindowButton extends St.Bin {
	_init() {
		super._init({visible: true, reactive: true, can_focus: true, track_hover: true});

		this.is_babar_task = true;

		this._delegate = this;
		this._draggable = DND.makeDraggable(this, {dragActorOpacity: HIDDEN_OPACITY});

		this._draggable.connect('drag-end', this._cancel_drag.bind(this));
		this._draggable.connect('drag-cancelled', this._cancel_drag.bind(this));
	}

	_cancel_drag() {
		global.display.emit('restacked');
	}

	acceptDrop(source) {
		// favorite menu item
		if (source.is_babar_favorite) {
			WM.get_workspace_by_index(this.workspace_number).activate(global.get_current_time());
			AppFavorites.getAppFavorites().getFavorites()[source.fav_index].open_new_window(-1);
		}
		
		// window button
		if (source.is_babar_task && source.workspace_number !== this.workspace_number) {
			source.window.change_workspace_by_index(this.workspace_number, false);
			if (source.window.has_focus()) {
				source.window.activate(global.get_current_time());
			}
			return true;
		}
		
		// dash button
		if (source instanceof Dash.DashIcon) {
			Main.overview.hide();
			WM.get_workspace_by_index(this.workspace_number).activate(global.get_current_time());
			source.app.open_new_window(-1);
			return true;
		}
		
		// app grid button
		if (source instanceof AppDisplay.AppIcon) {
			Main.overview.hide();
			WM.get_workspace_by_index(this.workspace_number).activate(global.get_current_time());
			source.app.open_new_window(-1);
			return true;
		}
		
		return false;
	}
});

class Extension {
	constructor() {
	}
	
	// get settings
    _get_settings() {
        this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.babar');
        
        this.settings_already_changed = false;
		this.settings_changed = this.settings.connect('changed', this._settings_changed.bind(this));
		
		RIGHT_CLICK = this.settings.get_boolean('right-click');
		MIDDLE_CLICK = this.settings.get_boolean('middle-click');
		REDUCE_PADDING = this.settings.get_boolean('reduce-padding');
		APP_GRID_ICON_NAME = this.settings.get_string('app-grid-icon-name');
		PLACES_ICON_NAME = this.settings.get_string('places-icon-name');
		FAVORITES_ICON_NAME = this.settings.get_string('favorites-icon-name');
		FALLBACK_ICON_NAME = this.settings.get_string('fallback-icon-name');
		ICON_SIZE = this.settings.get_int('icon-size');
		THUMBNAIL_MAX_SIZE = this.settings.get_int('thumbnail-max-size');
		ROUNDED_WORKSPACES_BUTTONS = this.settings.get_boolean('rounded-workspaces-buttons');
		TOOLTIP_VERTICAL_PADDING = this.settings.get_int('tooltip-vertical-padding');
		HIDDEN_OPACITY = this.settings.get_int('hidden-opacity');
		UNFOCUSED_OPACITY = this.settings.get_int('unfocused-opacity');
		FOCUSED_OPACITY = this.settings.get_int('focused-opacity');
		DESATURATE_ICONS = this.settings.get_boolean('desaturate-icons');
		FAVORITES_FIRST = this.settings.get_boolean('favorites-first');
		DISPLAY_ACTIVITIES = this.settings.get_boolean('display-activities');
		DISPLAY_APP_GRID = this.settings.get_boolean('display-app-grid');
		DISPLAY_PLACES_ICON = this.settings.get_boolean('display-places-icon');
		DISPLAY_FAVORITES = this.settings.get_boolean('display-favorites');
		DISPLAY_WORKSPACES = this.settings.get_boolean('display-workspaces');
		DISPLAY_TASKS = this.settings.get_boolean('display-tasks');
		DISPLAY_APP_MENU = this.settings.get_boolean('display-app-menu');
		DISPLAY_DASH = this.settings.get_boolean('display-dash');
		DISPLAY_WORKSPACES_THUMBNAILS = this.settings.get_boolean('display-workspaces-thumbnails');
    }
    
    // restart extension after settings changed
    _settings_changed() {
    	if (!this.settings_already_changed) {
    		Main.notify("Please restart BaBar extension to apply changes.");
    		this.settings_already_changed = true;
    	}
    }    
    
    // toggle Activities button
	_show_activities(show) {
		this.activities_button = Main.panel.statusArea['activities'];
		if (this.activities_button) {
			if (show && !Main.sessionMode.isLocked) {
				this.activities_button.container.show();
			} else {
				this.activities_button.container.hide();
			}
		}
	}
	
	// toggle Places Status Indicator extension label to folder	
	_show_places_icon(show_icon) {
		this.places_indicator = Main.panel.statusArea['places-menu'];
		if (this.places_indicator && is_shell_version_40) {
			this.places_indicator.remove_child(this.places_indicator.get_first_child());
			if (show_icon) {
				this.places_icon = new St.Icon({icon_name: PLACES_ICON_NAME, style_class: 'system-status-icon'});
				this.places_indicator.add_child(this.places_icon);
			} else {
				this.places_label = new St.Label({text: _('Places'), y_expand: true, y_align: Clutter.ActorAlign.CENTER});
				this.places_indicator.add_child(this.places_label);
			}
		}
		if (this.places_indicator && !is_shell_version_40) {
			this.places_box = this.places_indicator.get_first_child();
			this.places_box.remove_child(this.places_box.get_first_child());
			if (show_icon) {
				this.places_icon = new St.Icon({icon_name: PLACES_ICON_NAME, style_class: 'system-status-icon'});
				this.places_box.insert_child_at_index(this.places_icon, 0);
			} else {
				this.places_label = new St.Label({text: _('Places'), y_expand: true, y_align: Clutter.ActorAlign.CENTER});
				this.places_box.insert_child_at_index(this.places_label, 0);
			}
		}
	}
	
	// toggle dash in overview
	_show_dash(show) {
		if (show) {
			Main.overview.dash.show();
		} else {
			Main.overview.dash.hide();
		}
	}
	
	// toggle workspaces thumbnails in overview
	_hide_ws_thumbnails() {
		Main.overview._overview._controls._thumbnailsBox.hide();
	}

    enable() {    
		// get settings
    	this._get_settings();

		// top panel left box padding
    	if (REDUCE_PADDING) {
    		Main.panel._leftBox.add_style_class_name('leftbox-reduced-padding');
    	}
    
    	// Activities button
    	if (!DISPLAY_ACTIVITIES) {
    		this._show_activities(false);
    	}
    	
    	// app grid
		if (DISPLAY_APP_GRID) {
			this.app_grid = new AppGridButton();
			Main.panel.addToStatusArea('babar-app-grid-button', this.app_grid, 0, 'left');
		}
		
		// Places label to icon
		if (DISPLAY_PLACES_ICON) {
			this._show_places_icon(true);
			this.extensions_changed = Main.extensionManager.connect('extension-state-changed', () => this._show_places_icon(true));
		}
		
		// favorites
		if (DISPLAY_FAVORITES) {
			this.favorites_menu = new FavoritesMenu();
			Main.panel.addToStatusArea('babar-favorites-menu', this.favorites_menu, 3, 'left');
		}
		
		// tasks
		if (DISPLAY_TASKS) {
			this.workspaces_bar = new WorkspacesBar();
			Main.panel.addToStatusArea('babar-workspaces-bar', this.workspaces_bar, 5, 'left');
		}
		
		// AppMenu
    	if (!DISPLAY_APP_MENU) {
			AppMenu.container.hide();
		}
		
		// dash
		if (!DISPLAY_DASH) {
			this._show_dash(false);
		}
		
		// workspaces thumbnails
		if (!DISPLAY_WORKSPACES_THUMBNAILS) {
			this.showing_overview = Main.overview.connect('showing', this._hide_ws_thumbnails.bind(this));
		}
    }

    disable() {
		// app grid
    	if (DISPLAY_APP_GRID && this.app_grid) {
    		this.app_grid._destroy();
    	}
    	
    	// favorites
    	if (DISPLAY_FAVORITES && this.favorites_menu) {
    		this.favorites_menu._destroy();
    	}
    	
    	// workspaces bar
    	if (DISPLAY_TASKS && this.workspaces_bar) {
    		this.workspaces_bar._destroy();
    	}
    	
    	// top panel left box padding
    	if (REDUCE_PADDING) {
    		Main.panel._leftBox.remove_style_class_name('leftbox-reduced-padding');
    	}
    	
    	// Places label and unwatch extensions changes
    	if (DISPLAY_PLACES_ICON && this.places_indicator) {
    		this._show_places_icon(false);
    		Main.extensionManager.disconnect(this.extensions_changed);
    	}
    	
    	// Activities button
    	this._show_activities(true);
    	
    	// AppMenu icon
    	if (!Main.overview.visible && !Main.sessionMode.isLocked) {
			AppMenu.container.show();
		}
		
		// dash
		this._show_dash(true);
		
		// workspaces thumbnails
		if (!DISPLAY_WORKSPACES_THUMBNAILS && this.showing_overview) {
			Main.overview.disconnect(this.showing_overview);
		}
		
		// unwatch settings
		this.settings.disconnect(this.settings_changed);
    }
}

function init() {
	return new Extension();
}
