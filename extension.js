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

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

import St from 'gi://St';
import Shell from 'gi://Shell';

import { Timer } from './timer.js';
import { Style } from './style.js';
import { Dock } from './dock.js';
import { Services } from './services.js';
import { runTests } from './diagnostics.js';
import { D2DaDock } from './dock.js';

import * as LampAnimation from './effects/lamp_animation.js';

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
    let d = new D2DaDock({ extension: this });
    d.extension = this;
    d.addToChrome();
    d.layout();
    this.dock = d;
    return d;
  }

  destroyDocks() {
    (this.docks || []).forEach((dock) => {
      dock.removeFromChrome();
      this.dock = null;
    });
  }

  enable() {
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

    this._disable_borders = this.border_radius > 0;
    // animations are always on - but may be muted
    if (!this._settingsKeys.getValue('animate-icons')) {
      this._settingsKeys.setValue('animate-icons', true);
    }

    Main.overview.dash.last_child.reactive = false;
    Main.overview.dash.opacity = 0;

    this.docks = [];

    // service
    this.services = new Services();
    this.services.extension = this;

    this.dashContainer = new Dock(this);
    this._queryDisplay();

    // todo follow animator and autohider protocol
    this.services.enable();

    this._onCheckServices();

    this._updateLampAnimation();
    this._updateAnimationFPS();
    this._updateShrink();
    this._updateIconResolution();
    this._updateLayout();
    this._updateAutohide();
    this._updateTrashIcon();

    this._addEvents();

    this.createDock();
    this.docks.push(this.dock);
    this.listeners = [...this.listeners, ...this.docks];

    this._updateStyle();

    this.startUp();

    log('dash2dock-lite enabled');

    Main.overview.d2dl = this;
  }

  disable() {
    this._timer?.shutdown();
    this._hiTimer?.shutdown();
    this._loTimer?.shutdown();
    this._diagnosticTimer?.shutdown();
    // null later

    this._removeEvents();
    this._disableSettings();

    this._updateLampAnimation(true);
    this._updateShrink(true);
    this._updateLayout(true);
    this._updateAutohide(true);

    Main.overview.dash.last_child.visible = true;
    Main.overview.dash.opacity = 255;

    this.docks.forEach((container) => {
      container.undock();
    });
    this.docks = [];
    this.dashContainer = null;

    this.destroyDocks();

    this.services.disable();
    this.services = null;

    this._timer = null;
    this._hiTimer = null;
    this._loTimer = null;
    this._diagnosticTimer = null;

    this._style.unloadAll();
    this._style = null;

    log('dash2dock-lite disabled');
  }

  animate() {
    this.docks.forEach((dock) => {
      dock._beginAnimation();
    });
  }

  startUp() {
    // todo... refactor this
    if (!this._startupSeq) {
      let func = () => {
        this._updateLayout();
        if (this.dock) {
          this.dock.layout();
        }
      };
      this._startupSeq = this._hiTimer.runSequence([
        { func, delay: 50 },
        { func, delay: 500 },
        {
          func: () => {
            this.dock._beginAnimation();
          },
          delay: 50,
        },
        {
          func: () => {
            this._disable_borders = false;
            this._updateBorderStyle();
            this.dock._debounceEndAnimation();
          },
          delay: 250,
        },
      ]);
    } else {
      this._hiTimer.runSequence(this._startupSeq);
    }
  }

  _autohiders() {
    return this.docks.map((d) => {
      return d.autohider;
    });
  }

  _queryDisplay() {
    let idx = this.preferred_monitor || 0;
    if (idx == 0) {
      idx = Main.layoutManager.primaryIndex;
    } else if (idx == Main.layoutManager.primaryIndex) {
      idx = 0;
    }
    this.monitor = Main.layoutManager.monitors[idx];

    if (!this.monitor) {
      this.monitor = Main.layoutManager.primaryMonitor;
      idx = Main.layoutManager.primaryIndex;
    }

    // todo ... single container
    if (this.dashContainer) {
      this.dashContainer._monitorIndex = idx;
      this.dashContainer._monitor = this.monitor;
      this.dashContainer._monitorIsPrimary =
        this.monitor == Main.layoutManager.primaryMonitor;
    }

    if (this._last_monitor_count != Main.layoutManager.monitors.length) {
      this._settings.set_int(
        'monitor-count',
        Main.layoutManager.monitors.length
      );
      this._last_monitor_count = Main.layoutManager.monitors.length;
    }
  }

  _enableSettings() {
    this._settings = this.getSettings(schemaId);
    this._settingsKeys = SettingsKeys();

    this._settingsKeys.connectSettings(this._settings, (name, value) => {
      let n = name.replace(/-/g, '_');
      this[n] = value;

      // log(`${n} ${value}`);

      switch (name) {
        case 'msg-to-ext': {
          if (value.length) {
            try {
              eval(value);
            } catch (err) {
              log(err);
            }
            this._settings.set_string('msg-to-ext', '');
          }
          break;
        }
        case 'animation-fps': {
          this._updateAnimationFPS();
          break;
        }
        case 'mounted-icon':
        case 'peek-hidden-icons': {
          break;
        }
        case 'animation-magnify':
        case 'animation-spread':
        case 'animation-rise':
        case 'animation-bounce': {
          if (this.animate_icons) {
          }
          break;
        }
        case 'notification-badge-color':
        case 'notification-badge-style':
        case 'running-indicator-color':
        case 'running-indicator-style': {
          this.animate();
          break;
        }
        case 'apps-icon':
        case 'calendar-icon':
        case 'clock-icon':
        case 'favorites-only': {
          this._updateLayout();
          this.animate();
          break;
        }
        // problematic settings needing animator restart
        case 'dock-location':
        case 'icon-resolution': {
          this._updateIconResolution();
          this._updateStyle();
          this._updateLayout();
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
            if (dock.iconEffect) {
              dock.iconEffect.color = this.icon_effect_color;
            }
          });
          this.animate();
          break;
        }
        case 'icon-size':
        case 'preferred-monitor': {
          this._updateLayout();
          this.animate();
          break;
        }
        case 'autohide-dodge':
        case 'autohide-dash': {
          this._updateAutohide();
          break;
        }
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
        case 'lamp-app-animation': {
          this._updateLampAnimation();
          break;
        }
        case 'border-radius':
          this._debouncedUpdateStyle();
          break;
        case 'border-color':
        case 'border-thickness':
        case 'customize-topbar':
        case 'topbar-border-color':
        case 'topbar-border-thickness':
        case 'topbar-background-color':
        case 'topbar-foreground-color':
        case 'background-color':
        case 'panel-mode': {
          this._updateStyle();
          this._updateLayout();
          this.animate();
          break;
        }
        case 'pressure-sense': {
          break;
        }
        case 'trash-icon': {
          this._updateTrashIcon();
          this._updateLayout();
          this.animate();

          this._loTimer.runOnce(() => {
            this._updateLayout();
            this.animate();
          }, 250);

          break;
        }
      }
    });

    Object.keys(this._settingsKeys._keys).forEach((k) => {
      let key = this._settingsKeys.getKey(k);
      let name = k.replace(/-/g, '_');
      this[name] = key.value;
      if (key.options) {
        this[`${name}_options`] = key.options;
      }
    });
  }

  _disableSettings() {
    this._settingsKeys.disconnectSettings();
    this._settingsKeys = null;
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
      this
    );

    this._appFavorites = Fav.getAppFavorites();
    this._appFavorites.connectObject(
      'changed',
      () => {
        this._onAppsChanged();
      },
      this
    );

    Main.layoutManager.connectObject(
      // 'startup-complete',
      // this.startUp.bind(this),
      'monitors-changed',
      () => {
        this._updateLayout();
        this.animate();
      },
      this
    );

    Main.messageTray.connectObject(
      'queue-changed',
      (count) => {
        this.services.checkNotifications();
        this.animate();
      },
      this
    );

    global.display.connectObject(
      'notify::focus-window',
      this._onFocusWindow.bind(this),
      'in-fullscreen-changed',
      this._onFullScreen.bind(this),
      this
    );

    Main.overview.connectObject(
      'showing',
      this._onOverviewShowing.bind(this),
      'hidden',
      this._onOverviewHidden.bind(this),
      this
    );

    St.TextureCache.get_default().connectObject(
      'icon-theme-changed',
      this._onIconThemeChanged.bind(this),
      this
    );

    // move to services.js
    this._timer.runLoop(
      () => {
        this._onCheckServices();
      },
      SERVICES_UPDATE_INTERVAL,
      'services'
    );
  }

  _removeEvents() {
    this._appSystem.disconnectObject(this);
    this._appFavorites.disconnectObject(this);
    Main.messageTray.disconnectObject(this);
    Main.overview.disconnectObject(this);
    Main.layoutManager.disconnectObject(this);
    global.display.disconnectObject(this);
    global.stage.disconnectObject(this);
    St.TextureCache.get_default().disconnectObject(this);
  }

  _onIconThemeChanged() {
    if (this.animate_icons) {
      this.services.disable();
      this.services.enable();
    }
    this._updateStyle();
    this.animate();
  }

  _onFocusWindow() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFocusWindow) l._onFocusWindow();
    });
  }

  _onAppsChanged() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onAppsChanged) l._onAppsChanged();
    });
  }

  _onFullScreen() {
    let listeners = [...this.listeners];
    listeners.forEach((l) => {
      if (l._onFullScreen) l._onFullScreen();
    });
  }

  _updateAnimationFPS() {
    this.docks.forEach((container) => {
      container.cancelAnimations();
    });
    this.animationInterval =
      ANIM_INTERVAL + (this.animation_fps || 0) * ANIM_INTERVAL_PAD;
    this._hiTimer.shutdown();
    this._hiTimer.initialize(this.animationInterval);
  }

  _updateLampAnimation(disable) {
    this.lamp_app_animation = false; // disable
    if (this.lamp_app_animation && !disable) {
      LampAnimation.enable();
    } else {
      LampAnimation.disable();
    }
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
        'debounceStyle'
      );
    } else {
      this._hiTimer.runDebounced(this._debounceStyleSeq);
    }
  }

  _updateStyle(disable) {
    let styles = [];

    let rads = [0, 8, 16, 20, 24, 28, 32];

    // dash
    {
      let r = rads[Math.floor(this.border_radius)];
      let ss = [];
      if (this.panel_mode) {
        r = 0;
      }
      ss.push(`border-radius: ${r}px;`);

      {
        let rgba = this._style.rgba(this.background_color);
        ss.push(`background: rgba(${rgba});`);
      }

      styles.push(`#d2dlBackground { ${ss.join(' ')}}`);
    }

    // topbar
    if (this.customize_topbar) {
      let ss = [];
      // border
      if (this.topbar_border_thickness) {
        let rgba = this._style.rgba(this.topbar_border_color);
        ss.push(
          `border: ${this.topbar_border_thickness}px solid rgba(${rgba}); border-top: 0px; border-left: 0px; border-right: 0px;`
        );
      }

      // background
      {
        let rgba = this._style.rgba(this.topbar_background_color);
        ss.push(`background: rgba(${rgba});`);
      }

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

    this._style.build('custom', styles);
    this._updateBorderStyle();
  }

  _updateBorderStyle() {
    // apply border as inline style... otherwise buggy and won't show at startup
    // also add deferred bordering... otherwise rounder borders show with artifacts
    if (this.border_thickness && !this._disable_borders) {
      let rgba = this._style.rgba(this.border_color);
      let disable_borders = '';
      if (this.panel_mode) {
        disable_borders =
          'border-left: 0px; border-right: 0px; border-bottom: 0px;';
        // vertical border-left/right doesn;t seem to work
        if (this._position == 'left') {
          disable_borders =
            'border-left: 0px; border-top: 0px; border-bottom: 0px;';
        }
        if (this._position == 'right') {
          disable_borders =
            'border-top: 0px; border-right: 0px; border-bottom: 0px;';
        }
      }
      this.docks.forEach((dock) => {
        dock._background.style = `border: ${this.border_thickness}px solid rgba(${rgba}) !important; ${disable_borders}`;
      });
    } else {
      this.docks.forEach((dock) => {
        dock._background.style = '';
      });
    }
  }

  _updateLayout(disable) {
    this.docks.forEach((dock) => {
      dock._icons = null;
      dock.layout();
    });
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
      this.docks.forEach((container) => {
        container.removeFromChrome();
        container.addToChrome();
      });
    }

    if (this.animate_icons && !disable) {
      this.animate();
    }
  }

  _updateTrashIcon() {
    this.services.updateTrashIcon(this.trash_icon);
  }

  _onOverviewShowing() {
    this._inOverview = true;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
    // log('_onOverviewShowing');
  }

  _onOverviewHidden() {
    this._inOverview = false;
    this._autohiders().forEach((autohider) => {
      autohider._debounceCheckHide();
    });
    // log('_onOverviewHidden');
  }

  _onSessionUpdated() {
    this._animators().forEach((animator) => {
      if (animator) {
        animator.relayout();
      }
    });
  }

  _onCheckServices() {
    if (!this.services) return; // todo why does this happen?
    // todo convert services time in seconds
    this.services.update(SERVICES_UPDATE_INTERVAL);
    this._updateTrashIcon();
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
