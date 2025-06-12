/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 */

'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

import St from 'gi://St';
import Shell from 'gi://Shell';
import Graphene from 'gi://Graphene';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { tempPath, trySpawnCommandLine } from './utils.js';

import { Timer } from './timer.js';
import { Style } from './style.js';
import { Dock } from './dock.js';
import { Services } from './services.js';
import { runTests } from './diagnostics.js';

import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';

import { schemaId, SettingsKeys } from './preferences/keys.js';

const SERVICES_UPDATE_INTERVAL = 2500;

const ANIM_ICON_QUALITY = 2.0;
const ANIM_INTERVAL = 15;
const ANIM_INTERVAL_PAD = 15;

export default class Dash2DockLiteExt extends Extension {
  createDock() {
    let d = new Dock({ extension: this });
    d.extension = this;
    d.opacity = 0; // animate
    d.dock();
    this.dock = d;
    this.docks.push(this.dock);
    this.listeners = [this.services, ...this.docks];
    this._monitorIndex = 0;
    return d;
  }

  createTheDocks() {
    this.docks = this.docks ?? [];

    // only one dock
    if (
      Main.layoutManager.monitors.length == 1 ||
      this.multi_monitor_preference == 0
    ) {
      if (this.docks.length > 1) {
        this.destroyDocks();
      }
      if (this.docks.length == 0) {
        this.createDock();
      }
      return;
    }

    if (
      Main.layoutManager.monitors.length > 0 &&
      this.multi_monitor_preference == 1
    ) {
      let count = Main.layoutManager.monitors.length;
      if (count != this.docks.length) {
        this.destroyDocks();
      }

      for (let i = 0; i < count; i++) {
        let d = this.createDock();
        d._monitorIndex = i;
      }
    }
  }

  destroyDocks() {
    (this.docks || []).forEach((dock) => {
      dock.undock();
      dock.cancelAnimations();
      dock.destroyDash();
      this.dock = null;
    });
    this.docks = [];
  }

  recreateAllDocks(delay = 750) {
    console.log('recreate all docks');

    // recreate only the dash
    this.docks.forEach((d) => {
      d.recreateDash();
      d._beginAnimation();
      d._debounceEndAnimation();
    });
  }

  _showMainOverviewDash(show) {
    Main.overview.dash.opacity = show ? 255 : 0;
    // Main.overview.dash._background.opacity = show ? 255 : 0;
    Main.overview.dash._background.style = show
      ? ''
      : 'background: transparent !important;';

    let box = Main.overview.dash.__box || Main.overview.dash._box;
    box.get_children().forEach((c) => {
      c.opacity = show ? 255 : 0;
      c.visible = show;
      if (c.child) {
        c.child.reactive = show;
        c.child.track_hover = show;
      }
    });

    Main.overview.dash._showAppsIcon.opacity = show ? 255 : 0;
    Main.overview.dash._showAppsIcon.child.reactive = show;
    Main.overview.dash._showAppsIcon.child.track_hover = show;
  }

  enable() {
    Main.overview.d2dl = this;

    // Use UUID to avoid conflicting with other instances of this extensions (multi user setup)
    if (!this.uuid) {
      this.uuid = GLib.get_user_name(); // GLib.uuid_string_random();
    }

    // for debugging - set to 255
    this._dash_opacity = 0;

    // three available timers
    // for persistent runs
    this._timer = new Timer('loop timer');
    this._timer.initialize(3500);

    // for animation runs
    // resolution (15) will be modified by animation-fps
    this._hiTimer = new Timer('hi-res timer');
    this._hiTimer.initialize(15);

    // for deferred or debounced runs
    this._loTimer = new Timer('lo-res timer');
    this._loTimer.initialize(750);

    this.listeners = [];
    this.scale = 1.0;
    this.icon_size = 0;
    this.icon_quality = ANIM_ICON_QUALITY;

    this._style = new Style();

    this._enableSettings();
    this._loadIconMap();

    // no longer needed
    // this._disable_borders = this.border_radius > 0;

    // animations are always on - but may be muted
    if (!this._settingsKeys.getValue('animate-icons')) {
      this._settingsKeys.setValue('animate-icons', true);
    }

    Main.overview.dash.__box = Main.overview.dash._box;
    this._showMainOverviewDash(false);
    this.docks = [];

    // service
    this.services = new Services();
    this.services.extension = this;
    this.services.setupFolderIcons();

    // todo follow animator and autohider protocol
    this.services.enable();
    this._onCheckServices();

    this._updateAnimationFPS();
    this._updateShrink();
    this._updateIconResolution();
    this._updateStyle();
    this._updateBlurredBackground();

    this._addEvents();
    this._queryDisplay();
    this.startUp();

    console.log('dash2dock-lite enabled');
  }

  disable() {
    this._timer?.shutdown();
    this._hiTimer?.shutdown();
    this._loTimer?.shutdown();
    this._diagnosticTimer?.shutdown();
    // null later

    this._removeEvents();
    this._disableSettings();

    this._updateShrink(true);
    this._updateLayout(true);
    this._updateAutohide(true);
    this._unloadIconMap();

    this._showMainOverviewDash(true);

    if (Main.overview.dash.__box) {
      Main.overview.dash._box = Main.overview.dash.__box;
    }

    this.destroyDocks();
    this.docks = [];

    if (this._topbar_background) {
      if (this._topbar_background.get_parent()) {
        this._topbar_background
          .get_parent()
          .remove_child(this._topbar_background);
      }
      this._topbar_background = null;
    }

    this.services.disable();
    this.services = null;

    this._timer = null;
    this._hiTimer = null;
    this._loTimer = null;
    this._diagnosticTimer = null;

    this._style.unloadAll();
    this._style = null;

    this._hookCompiz(false);

    Main.overview.d2dl = null;
    console.log('dash2dock-lite disabled');
  }

  animate(settings = {}) {
    this.docks.forEach((dock) => {
      if (settings && settings.preview) {
        dock.preview();
      }
      if (settings.refresh) {
        dock._icons = null;
        dock.layout();
      }
      dock._beginAnimation();
    });
  }

  // unused?
  checkHide() {
    this.docks.forEach((dock) => {
      if (dock.autohider) {
        dock.autohider._debounceCheckHide();
      }
    });
  }

  _hookCompiz(hook = true) {
    let compiz = Main.extensionManager.lookup(
      'compiz-alike-magic-lamp-effect@hermes83.github.com',
    );
    if (compiz && compiz.stateObj) {
      let stateObj = compiz.stateObj;
      this._compiz = stateObj;
      if (stateObj._getIcon && !hook) {
        stateObj.getIcon = stateObj._getIcon;
        stateObj._getIcon = null;
      }
      if (!stateObj._getIcon && hook) {
        stateObj._getIcon = stateObj.getIcon;
        stateObj.getIcon = this._getIcon.bind(this);
      }
    }
  }

  // override compiz getIcon
  _getIcon(actor) {
    let [success, icon] = actor.meta_window.get_icon_geometry();
    if (success) {
      // console.log('compiz-alike-magic-lamp-effect: icon');
      // console.log(icon);
      return icon;
    }
    let monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
    let dock = this.docks.find((d) => d._monitorIndex == monitor.index);

    if (!dock) {
      return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
    }
    if (!Main.overview.dash.__box) {
      Main.overview.dash.__box = Main.overview.dash._box;
    }
    Main.overview.dash._box = dock.dash._box;

    // add alignment fix here?
    let res = this._compiz._getIcon(actor);
    // console.log('compiz-alike-magic-lamp-effect: getIcon');
    // console.log(`x:${res.x} y:${res.y} w:${res.width} h:${res.height}`);
    let x = res.x;
    let y = res.y;
    let w = res.width;
    let h = res.height;

    if (w == 0 && this.docks && this.docks.length > 0) {
      let sz = this.docks[0]._preferredIconSize();
      if (sz) {
        x += (sz / 2) * (this.docks[0].getMonitor().geometry_scale || 1);
        // y += sz/2;
      }
    }

    return {
      x: x,
      y: y,
      width: w,
      height: h,
    };
  }

  startUp() {
    this.createTheDocks();
    this._loTimer.runOnce(() => {
      this._updateWidgetStyle();
      this.animate({ refresh: true });
      this.docks.forEach((dock) => {
        dock._beginAnimation();
        dock._debounceEndAnimation();
      });

      this._hookCompiz();
    }, 10);
    this._loTimer.runUntil(() => {
      return this._createTopbarBackground();
    }, 150);
  }

  _autohiders() {
    return this.docks.map((d) => {
      return d.autohider;
    });
  }

  // to be called by docks
  _queryDisplay(currentMonitorIndex) {
    if (
      Main.layoutManager.monitors.length > 0 &&
      this.multi_monitor_preference > 0
    ) {
      // if multi-monitor ... let _updateLayout take care of updating the docks
      return currentMonitorIndex;
    }

    let idx = this.preferred_monitor || 0;
    if (idx == 0) {
      idx = Main.layoutManager.primaryIndex;
    } else if (idx == Main.layoutManager.primaryIndex) {
      idx = 0;
    }

    if (!Main.layoutManager.monitors[idx]) {
      idx = Main.layoutManager.primaryIndex;
    }

    return idx;
  }

  _loadIconMap() {
    let fn = Gio.File.new_for_path('.config/d2da/icons.json');
    if (fn.query_exists(null)) {
      const [success, contents] = fn.load_contents(null);
      const decoder = new TextDecoder();
      let contentsString = decoder.decode(contents);
      try {
        let json = JSON.parse(contentsString);
        if (json['icons']) {
          this.icon_map = json['icons'];
          this.icon_map_cache = {};
          Object.keys(this.icon_map).forEach((k) => {
            let path = this.icon_map[k];
            if (path.toLowerCase().endsWith('.svg')) {
              let file = Gio.File.new_for_path(`.config/d2da/${path}`);
              if (file.query_exists(null)) {
                console.log(`loading icon ${file.get_path()}`);
                this.icon_map_cache[k] = new Gio.FileIcon({ file: file });
              }
            }
          });
        }
        if (json['apps']) {
          this.app_map = json['apps'];
          this.app_map_cache = {};
          Object.keys(this.app_map).forEach((k) => {
            let path = this.app_map[k];
            if (path.toLowerCase().endsWith('.svg')) {
              let file = Gio.File.new_for_path(`.config/d2da/${path}`);
              if (file.query_exists(null)) {
                console.log(`loading icon ${file.get_path()}`);
                this.app_map_cache[k] = new Gio.FileIcon({ file: file });
              }
            }
          });
        }
      } catch (err) {
        console.log(err);
      }
    }
  }

  _unloadIconMap() {
    this.icon_map = {};
    this.icon_map_cache = {};
    this.app_map_cache = {};
  }

  _enableSettings() {
    this._desktopSettings = new Gio.Settings({
      schema_id: 'org.gnome.desktop.background',
    });
    this._desktopSettings.connectObject(
      'changed::picture-uri',
      () => {
        this._updateBlurredBackground();
      },
      this,
    );

    this._settings = this.getSettings(schemaId);
    this._settingsKeys = SettingsKeys();

    this._settingsKeys.connectSettings(this._settings, (name, value) => {
      let n = name.replace(/-/g, '_');
      this[n] = value;

      // console.log(`${n} ${value}`);

      switch (name) {
        case 'msg-to-ext': {
          if (value.length) {
            try {
              eval(value);
            } catch (err) {
              console.log(err);
            }
            this._settings.set_string('msg-to-ext', '');
          }
          break;
        }
        case 'animation-fps': {
          this._updateAnimationFPS();
          break;
        }
        case 'debug-visual':
          this.animate();
          break;
        case 'mounted-icon': {
          this.services.checkMounts();
          this.services._commitMounts();
          this.animate({ refresh: true });
          break;
        }
        case 'peek-hidden-icons': {
          this.animate();
          break;
        }
        case 'animation-magnify':
        case 'animation-spread':
        case 'animation-rise':
        case 'animation-bounce': {
          if (this.animate_icons) {
            this.animate({ preview: true });
          }
          break;
        }
        case 'notification-badge-size':
        case 'notification-badge-color':
        case 'notification-badge-style':
        case 'running-indicator-size':
        case 'running-indicator-color':
        case 'running-indicator-style': {
          this.animate();
          break;
        }
        case 'clock-style':
        case 'calendar-style':
          this._updateWidgetStyle();
          break;
        case 'max-recent-items':
          this.services._debounceCheckDownloads();
          break;
        case 'apps-icon':
        case 'apps-icon-front':
        case 'calendar-icon':
        case 'clock-icon':
        case 'favorites-only': {
          this.animate({ refresh: true });
          break;
        }
        case 'downloads-path':
          this.services.setupDownloads();
          break;
        // problematic settings needing animator restart
        case 'dock-location':
          this.recreateAllDocks();
          this.animate({ preview: true });
          break;
        case 'icon-resolution': {
          this._updateIconResolution();
          this._updateStyle();
          this._updateLayout();
          this._updateIconSpacing();
          this.animate();
          break;
        }
        case 'icon-effect': {
          this.docks.forEach((dock) => {
            dock._updateIconEffect();
          });
          break;
        }
        case 'icon-effect-color': {
          this.docks.forEach((dock) => {
            dock._updateIconEffectColor(this.icon_effect_color);
          });
          this.animate();
          break;
        }
        case 'icon-spacing': {
          this._updateIconSpacing();
          break;
        }
        case 'multi-monitor-preference':
          this._updateMultiMonitorPreference();
          break;
        case 'icon-size':
        case 'preferred-monitor': {
          this._updateLayout();
          this.animate({ refresh: true });
          break;
        }
        case 'autohide-dodge':
        case 'autohide-dash': {
          this._updateAutohide();
          break;
        }
        case 'dock-padding':
        case 'edge-distance': {
          this.animate();
          break;
        }
        case 'shrink-icons':
        case 'icon-size': {
          this._updateShrink();
          this.animate();
          break;
        }
        case 'border-radius':
          this._debouncedUpdateStyle();
          break;
        case 'separator-thickness':
          this._updateStyle();
          this.recreateAllDocks();
          this.animate({ preview: true });
          break;
        case 'separator-color':
        case 'border-color':
        case 'border-thickness':
        case 'customize-topbar':
        case 'icon-shadow':
        case 'topbar-border-color':
        case 'topbar-border-thickness':
        case 'topbar-foreground-color':
        case 'customize-label':
        case 'label-border-radius':
        case 'label-border-color':
        case 'label-border-thickness':
        case 'label-background-color':
        case 'label-foreground-color':
        case 'panel-mode': {
          this._updateStyle();
          this._updateLayout();
          this.animate();
          break;
        }
        case 'topbar-background-color':
        case 'topbar-blur-background':
        case 'background-color':
        case 'blur-resolution':
        case 'blur-background':
          this._updateBlurredBackground();
          this._updateStyle();
          this._updateLayout();
          this.animate();
          break;
        case 'pressure-sense': {
          break;
        }
        case 'downloads-icon':
        case 'documents-icon':
        case 'trash-icon': {
          this._updateLayout();
          this.animate({ refresh: true });
          break;
        }
      }
    });

    Object.keys(this._settingsKeys._keys).forEach((k) => {
      let key = this._settingsKeys.getKey(k);
      let name = k.replace(/-/g, '_');
      this[name] = key.value;
      // console.log(`${name} = ${key.value}`);
      if (key.options) {
        this[`${name}_options`] = key.options;
      }
    });
  }

  _disableSettings() {
    this._settingsKeys.disconnectSettings();
    this._settingsKeys = null;

    this._desktopSettings.disconnectObject(this);
    this._desktopSettings = null;
  }

  _addEvents() {
    this._appSystem = Shell.AppSystem.get_default();

    this._appSystem.connectObject(
      'installed-changed',
      () => {
        this._onAppsChanged();
      },
      'app-state-changed',
      () => {
        this._onAppsChanged();
      },
      this,
    );

    this._appFavorites = Fav.getAppFavorites();
    this._appFavorites.connectObject(
      'changed',
      () => {
        this._onAppsChanged();
      },
      this,
    );

    Main.sessionMode.connectObject(
      'updated',
      this._onSessionUpdated.bind(this),
      this,
    );

    Main.layoutManager.connectObject(
      'startup-complete',
      () => {
        Main.overview.dash.last_child.visible = false;
        Main.overview.dash.opacity = 0;
        // fix for topbar not blurring
        this._updateBlurredBackground();
      },
      // this.startUp.bind(this),
      'monitors-changed',
      () => {
        this._updateMultiMonitorPreference();
      },
      this,
    );

    Main.messageTray.connectObject(
      'queue-changed',
      (count) => {
        this.services.checkNotifications();
        this.animate();
      },
      this,
    );

    global.display.connectObject(
      'notify::focus-window',
      this._onFocusWindow.bind(this),
      'in-fullscreen-changed',
      this._onFullScreen.bind(this),
      'restacked',
      this._onRestacked.bind(this),
      this,
    );

    // global.stage.connectObject(
    //   'key-press-event',
    //   this._onKeyPressed.bind(this),
    //   this
    // );

    Main.overview.connectObject(
      'showing',
      this._onOverviewShowing.bind(this),
      'hidden',
      this._onOverviewHidden.bind(this),
      this,
    );

    St.TextureCache.get_default().connectObject(
      'icon-theme-changed',
      this._onIconThemeChanged.bind(this),
      this,
    );

    St.ThemeContext.get_for_stage(global.stage).connectObject(
      'notify::scale-factor',
      this.recreateAllDocks.bind(this),
      this,
    );

    // move to services.js
    this._timer.runLoop(
      () => {
        this._onCheckServices();
      },
      SERVICES_UPDATE_INTERVAL,
      'services',
    );
  }

  _removeEvents() {
    this._appSystem.disconnectObject(this);
    this._appFavorites.disconnectObject(this);
    Main.messageTray.disconnectObject(this);
    Main.overview.disconnectObject(this);
    Main.layoutManager.disconnectObject(this);
    Main.sessionMode.disconnectObject(this);
    global.display.disconnectObject(this);
    global.stage.disconnectObject(this);
    St.TextureCache.get_default().disconnectObject(this);
    St.ThemeContext.get_for_stage(global.stage).disconnectObject(this);
  }

  _onKeyPressed(evt) {
    this.docks.forEach((d) => {
      if (d._list && d._list.visible) {
        d._list.slideOut();
      }
    });
    return Clutter.EVENT_PROPAGATE;
  }

  _onIconThemeChanged() {
    if (this.animate_icons) {
      this.services.disable();
      this.services.enable();
    }
    this._updateStyle();
    this.recreateAllDocks();
  }

  _onFocusWindow() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFocusWindow) l._onFocusWindow();
    });
  }

  _onFullScreen(display) {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFullScreen) l._onFullScreen();
    });

    if (this._topbar_background) {
      this._topbar_background.visible = !display.get_monitor_in_fullscreen(0);
    }
    // console.log(`_onFullScreen ${f}`);
  }

  _onRestacked() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onRestacked) l._onRestacked();
    });
  }

  _onAppsChanged() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onAppsChanged) l._onAppsChanged();
    });
  }

  _onOverviewShowing() {
    this._showMainOverviewDash(false);
    //this._loTimer.runOnce(() => { Main.overview.dash.set_height(1); }, 50);
    this._inOverview = true;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
    this.animate();
  }

  _onOverviewHidden() {
    //Main.overview.dash.set_height(1);
    this._inOverview = false;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
  }

  _onSessionUpdated() {
    this.animate();
  }

  _onCheckServices() {
    if (!this.services) return; // todo why does this happen?
    // todo convert services time in seconds
    this.services.update(SERVICES_UPDATE_INTERVAL);
  }

  _updateWidgetStyle() {
    this._widgetStyle = {
      dark_color: this.drawing_dark_color,
      light_color: this.drawing_light_color,
      accent_color: this.drawing_accent_color,
      dark_foreground: this.drawing_dark_foreground,
      light_foreground: this.drawing_light_foreground,
      secondary_color: this.drawing_secondary_color,
      clock_style: this.clock_style,
    };
    this.docks.forEach((dock) => {
      let widgets = [dock._clock, dock._calendar];
      widgets.forEach((w) => {
        if (w) {
          w.settings = this._widgetStyle;
          w.redraw();
        }
      });
    });
    this.animate();
  }

  async _updateBlurredBackground() {
    this.desktop_background = this._desktopSettings.get_string('picture-uri');
    this.desktop_background_blurred = this.desktop_background;
    this.docks.forEach((dock) => {
      dock._updateBackgroundEffect();
    });

    const BLURRED_BG_PATH = tempPath('d2da-bg-blurred.jpg');
    this.desktop_background_blurred = BLURRED_BG_PATH;
    if (this.blur_background || this.topbar_blur_background) {
      let file = Gio.File.new_for_uri(this.desktop_background);
      let quality = [250, 250, 500, 1000][this.blur_resolution || 0];
      let cmd = `convert -scale 10% -blur 0x2.5 -resize ${quality}% "${file.get_path()}" ${BLURRED_BG_PATH}`;
      console.log(cmd);
      try {
        await trySpawnCommandLine(cmd);
      } catch (err) {
        console.log(err);
      }
    }

    this.animate();
  }

  _createTopbarBackground() {
    if (
      !this._topbar_background &&
      Main.panel &&
      Main.panel.get_parent() &&
      Main.panel.get_parent().get_parent()
    ) {
      this._topbar_background = new St.Widget({
        name: 'd2daTopbarBackground',
        clip_to_allocation: true,
      });
      Main.uiGroup.insert_child_below(
        this._topbar_background,
        Main.panel.get_parent(),
      );
    }
    return this._topbar_background;
  }

  _updateAnimationFPS() {
    this.docks.forEach((dock) => {
      dock.cancelAnimations();
    });
    this.animationInterval =
      ANIM_INTERVAL + (this.animation_fps || 0) * ANIM_INTERVAL_PAD;
    this._hiTimer.shutdown();
    this._hiTimer.initialize(this.animationInterval);
  }

  _updateShrink(disable) {
    if (this.shrink_icons && !disable) {
      this.scale = 0.8; // * rescale_modifier;
    } else {
      this.scale = 1.0; // * rescale_modifier;
    }
    if (this.animate_icons) {
      // this._animators().forEach((animator) => {
      //   animator.relayout();
      // });
    }
  }

  _updateMultiMonitorPreference() {
    console.log('update monitors');
    this.destroyDocks();
    this._loTimer.runOnce(() => {
      this.startUp();
    }, 500);
  }

  _updateIconResolution(disable) {
    this.icon_quality = 1 + [2, 0, 1, 2, 3][this.icon_resolution || 0];
  }

  _debouncedUpdateStyle(disable) {
    if (disable) return;
    if (!this._debounceStyleSeq) {
      this._debounceStyleSeq = this._hiTimer.runDebounced(
        () => {
          this._updateStyle();
        },
        500,
        'debounceStyle',
      );
    } else {
      this._hiTimer.runDebounced(this._debounceStyleSeq);
    }
  }

  _updateStyle(disable) {
    let styles = [];

    let rads = [0, 8, 16, 20, 24, 28, 32, 36, 40, 42];

    // icons-shadow
    if (this.icon_shadow) {
      styles.push(
        '.renderer_icon, #DockItemList StIcon {icon-shadow: rgba(0, 0, 0, 0.32) 0 2px 6px;}',
      );
      // styles.push(
      //   '#dash StIcon:hover, #DockItemList StIcon:hover {icon-shadow: rgba(0, 0, 0, 0.24) 0 2px 8px;}'
      // );
    }

    // dash
    {
      let r = rads[Math.floor(this.border_radius)];
      let ss = [];
      if (this.panel_mode) {
        r = 0;
      }
      ss.push(`border-radius: ${r}px;`);
      /*
      if (!this.blur_background) {
        let rgba = this._style.rgba(this.background_color);
        ss.push(`background: rgba(${rgba});`);
      }
      */
      styles.push(`#d2daBackground { ${ss.join(' ')}}`);
    }

    // dash label
    if (this.customize_label) {
      let rads = [0, 2, 6, 10, 12, 16, 20];
      let r = rads[Math.floor(this.label_border_radius)];
      let ss = [];
      ss.push(`border-radius: ${r}px;`);

      {
        let rgba = this._style.rgba(this.label_background_color);
        ss.push(`background: rgba(${rgba});`);
      }

      {
        let rgba = this._style.rgba(this.label_border_color);
        let t = this.label_border_thickness;
        ss.push(`border: ${t}px rgba(${rgba});`);
      }

      {
        let rgba = this._style.rgba(this.label_foreground_color);
        ss.push(`color: rgba(${rgba});`);
      }

      styles.push(`.dash-label { ${ss.join(' ')}}`);
    }

    // topbar
    if (this.customize_topbar) {
      let ss = [];
      // border
      if (this.topbar_border_thickness) {
        let rgba = this._style.rgba(this.topbar_border_color);
        ss.push(
          `border: ${this.topbar_border_thickness}px solid rgba(${rgba}); border-top: 0px; border-left: 0px; border-right: 0px;`,
        );
      }

      // background
      ss.push('background: transparent;');
      styles.push(`#panelBox #panel {${ss.join(' ')}}`);

      // foreground
      if (this.topbar_foreground_color && this.topbar_foreground_color[3] > 0) {
        let rgba = this._style.rgba(this.topbar_foreground_color);
        styles.push(`#panelBox #panel * { color: rgba(${rgba}) }`);
      } else {
        let rgba = this._style.rgba([0, 0, 0, 1]);
        let bg = this.topbar_background_color;
        if (0.3 * bg[0] + 0.59 * bg[1] + 0.11 * bg[2] < 0.5) {
          rgba = this._style.rgba([1, 1, 1, 1]);
        }
        styles.push(`#panelBox #panel * { color: rgba(${rgba}) }`);
      }
    }

    if (this.separator_thickness) {
      let rgba = this._style.rgba(this.separator_color);
      styles.push(`.dash-separator { background-color: rgba(${rgba}); }`);
    }

    this._style.build('custom-d2dl', styles);

    this._updateBorderStyle();
  }

  _updateBorderStyle() {
    this._backgroundStyle = '';

    // apply border as inline style... otherwise buggy and won't show at startup
    // also add deferred bordering... otherwise rounder borders show with artifacts
    // no longer necessary<<<?

    let border_style = '';
    if (this.border_thickness /* && !this._disable_borders */) {
      let rgba = this._style.rgba(this.border_color);
      border_style = `border: ${this.border_thickness}px solid rgba(${rgba}) !important;`;
    }

    let panel_borders = '';
    if (this.panel_mode) {
      panel_borders =
        'border-left: 0px; border-right: 0px; border-bottom: 0px;';
      // vertical border-left/right doesn;t seem to work
      if (this._position == 'left') {
        panel_borders =
          'border-left: 0px; border-top: 0px; border-bottom: 0px;';
      }
      if (this._position == 'right') {
        panel_borders =
          'border-top: 0px; border-right: 0px; border-bottom: 0px;';
      }
    }

    this._backgroundStyle = `${border_style} ${panel_borders}`;
  }

  _updateLayout(disable) {
    // console.log(this.multi_monitor_preference);
    this.docks.forEach((dock) => {
      dock.layout();
    });
  }

  _updateIconSpacing(disable) {
    if (!this._iconSpacingDebounceSeq) {
      this._iconSpacingDebounceSeq = this._loTimer.runDebounced(() => {
        this.animate({ refresh: true });
      }, 750);
    } else {
      this._loTimer.runDebounced(this._iconSpacingDebounceSeq);
    }
  }

  _updateAutohide(disable) {
    if (this.autohide_dash && !disable) {
      this._autohiders().forEach((autohider) => {
        autohider.enable();
      });
    } else {
      this._autohiders().forEach((autohider) => {
        autohider.disable();
      });
    }

    if (!disable) {
      this.docks.forEach((dock) => {
        dock.removeFromChrome();
        dock.addToChrome();
      });
    }

    if (this.animate_icons && !disable) {
      this.animate();
    }
  }

  runDiagnostics() {
    if (!this._diagnosticTimer) {
      this._diagnosticTimer = new Timer('diagnostics');
      this._diagnosticTimer.initialize(50);
    }
    runTests(this, this._settingsKeys);
  }

  dumpTimers() {
    this._timer.dumpSubscribers();
    this._hiTimer.dumpSubscribers();
    this._loTimer.dumpSubscribers();
    if (this._diagnosticTimer) {
      this._diagnosticTimer.dumpSubscribers();
    }
  }
}
