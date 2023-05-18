'use strict';

const { St, Shell, GObject, Gio, GLib, Gtk, Meta, Clutter } = imports.gi;

const Main = imports.ui.main;
const Dash = imports.ui.dash.Dash;
const Fav = imports.ui.appFavorites;
const Layout = imports.ui.layout;
const Point = imports.gi.Graphene.Point;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { schemaId, settingsKeys, SettingsKeys } = Me.imports.preferences.keys;

const LampAnimation = Me.imports.effects.lamp_animation.LampAnimation;
const Animator = Me.imports.animator.Animator;
const AutoHide = Me.imports.autohide.AutoHide;
const Services = Me.imports.services.Services;
const Style = Me.imports.style.Style;
const Timer = Me.imports.timer.Timer;
const Dock = Me.imports.dock.Dock;

const runTests = Me.imports.diagnostics.runTests;

const SERVICES_UPDATE_INTERVAL = 2500;

const ANIM_ICON_QUALITY = 2.0;
const ANIM_INTERVAL = 15;
const ANIM_INTERVAL_PAD = 15;

class Extension {
  enable() {
    // for debugging - set to 255
    this._dash_opacity = 0;

    this._imports = Me.imports;

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

    Main._d2dl = this;

    this._style = new Style();

    this._enableSettings();

    this._disable_borders = this.border_radius > 0;
    // animations are always on - but may be muted
    if (!SettingsKeys.getValue('animate-icons')) {
      SettingsKeys.setValue('animate-icons', true);
    }

    this.dashContainer = new Dock();
    this.dashContainer.extension = this;

    Main.overview.dash.visible = false;

    // service
    this.services = new Services();
    this.services.extension = this;

    // animator
    this.animator = this.dashContainer.animator;
    this.animator.extension = this;

    // autohider
    this.autohider = this.dashContainer.autohider;
    this.autohider.extension = this;
    this.autohider.animator = this.animator;

    this._queryDisplay();
    this.dashContainer.dock();

    // todo follow animator and autohider protocol
    this.services.enable();

    this.listeners = [this.services, this.autohider, this.animator];

    this._onCheckServices();

    this._updateLampAnimation();
    this._updateAnimationFPS();
    this._updateShrink();
    this._updateIconResolution();
    this._updateLayout();
    this._updateAutohide();
    this._updateTrashIcon();
    this._updateStyle();

    this._addEvents();

    this.startUp();

    log('dash2dock-lite enabled');
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

    Main.overview.dash.visible = true;
    this.dashContainer.undock();

    Main.layoutManager.removeChrome(this.dashContainer);
    delete this.dashContainer;
    this.dashContainer = null;

    this.services.disable();
    delete this.services;
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
    this.dashContainer._onEnterEvent();
  }

  startUp() {
    this.dashContainer.animator._invisible(true, true);

    // todo... refactor this
    if (!this._startupSeq) {
      let func = () => {
        this._updateLayout();
        this.animate();
        if (!this._vertical) {
          this.dashContainer.animator._invisible(false, false);
        }
      };
      this._startupSeq = this._hiTimer.runSequence([
        { func, delay: 50 },
        { func, delay: 500 },
        {
          func: () => {
            this.dashContainer.animator._invisible(false, false);
          },
          delay: 50,
        },
        {
          func: () => {
            this.dashContainer.animator._invisible(false, false);
          },
          delay: 250,
        },
      ]);
    } else {
      this._hiTimer.runSequence(this._startupSeq);
    }
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
    this._settings = ExtensionUtils.getSettings(schemaId);
    this._settingsKeys = SettingsKeys;

    SettingsKeys.connectSettings(this._settings, (name, value) => {
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
        case 'animation-rise': {
          if (this.animate_icons) {
            this.animator.preview();
            this.animate();
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
        case 'clock-icon': {
          this.animate();
          break;
        }
        case 'favorites-only': {
          this.animator.relayout();
          this._updateLayout();
          this.animate();
          break;
        }
        // problematic settings needing animator restart
        case 'dock-location':
        case 'icon-resolution': {
          this._disable_borders = this.border_radius > 0;
          this._updateIconResolution();
          this.animator._previousFind = null;
          this.animator._iconsContainer.clear();
          if (this.autohide_dash) {
            this.autohider.disable();
            this.autohider.enable();
          }
          this.animator._background.visible = false;
          this._updateStyle();
          this._updateLayout();
          this.animate();
          break;
        }
        case 'icon-effect': {
          if (this.animate_icons) {
            this.animator._updateIconEffect();
            this._updateLayout();
            this.animate();
          }
          break;
        }
        case 'icon-effect-color': {
          if (this.animate_icons && this.animator.iconEffect) {
            this.animator.iconEffect.color = this.icon_effect_color;
            this.animate();
          }
          break;
        }
        case 'icon-size':
        case 'preferred-monitor': {
          this._updateLayout();
          this.animate();
          break;
        }
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

    Object.keys(SettingsKeys._keys).forEach((k) => {
      let key = SettingsKeys.getKey(k);
      let name = k.replace(/-/g, '_');
      this[name] = key.value;
      if (key.options) {
        this[`${name}_options`] = key.options;
      }
    });
  }

  _disableSettings() {
    SettingsKeys.disconnectSettings();
  }

  _addEvents() {
    // Main.sessionMode.connectObject(
    //   'updated',
    //   () => this._onSessionUpdated(),
    //   this
    // );

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
      // 'window-demands-attention',
      // () => { log('window-demands-attention') },
      // 'window-marked-urgent',
      // () => { log('window-marked-urgent') },
      'notify::focus-window',
      this._onFocusWindow.bind(this),
      'in-fullscreen-changed',
      this._onFullScreen.bind(this),
      this
    );

    Main.overview.connectObject(
      'showing',
      this._onOverviewShowing.bind(this),
      this
    );
    Main.overview.connectObject(
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
    // Main.sessionMode.disconnectObject(this);
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
    this.animator._previousFind = null;
    this.animator._iconsContainer.clear();
    this._updateStyle();
    this.animate();
  }

  _onFocusWindow() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onFocusWindow) l._onFocusWindow();
      });
  }

  _onFullScreen() {
    this.listeners
      .filter((l) => {
        return l._enabled;
      })
      .forEach((l) => {
        if (l._onFullScreen) l._onFullScreen();
      });
  }

  _updateAnimationFPS() {
    this.dashContainer.cancelAnimations();
    this.animationInterval =
      ANIM_INTERVAL + (this.animation_fps || 0) * ANIM_INTERVAL_PAD;
    this._hiTimer.shutdown();
    this._hiTimer.initialize(this.animationInterval);
  }

  _updateLampAnimation(disable) {
    if (this.lamp_app_animation && !disable) {
      LampAnimation.enable();
    } else {
      LampAnimation.disable();
    }
  }

  _updateShrink(disable) {
    if (!this.dashContainer) return;

    if (this.shrink_icons && !disable) {
      this.scale = 0.8; // * rescale_modifier;
    } else {
      this.scale = 1.0; // * rescale_modifier;
    }

    if (this.animate_icons) {
      this.animator.relayout();
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
      this.animator._background.style = `border: ${this.border_thickness}px solid rgba(${rgba}) !important; ${disable_borders}`;
    } else {
      this.animator._background.style = '';
    }
  }

  _updateLayout(disable) {
    this.dashContainer.layout(disable);
  }

  _updateAutohide(disable) {
    if (this.autohide_dash && !disable) {
      this.autohider.enable();
    } else {
      this.autohider.disable();
    }

    if (!disable) {
      this.dashContainer.removeFromChrome();
      this.dashContainer.addToChrome();
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
    if (this.autohider._enabled) {
      this.autohider._debounceCheckHide();
    }
    // log('_onOverviewShowing');
  }

  _onOverviewHidden() {
    this._inOverview = false;
    if (this.autohider._enabled) {
      this.autohider._debounceCheckHide();
    }
    // log('_onOverviewHidden');
  }

  _onSessionUpdated() {
    if (this.animator) {
      this.animator.relayout();
    }
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
    runTests(this, SettingsKeys);
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

function init() {
  return new Extension();
}
