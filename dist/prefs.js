const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Adw = imports.gi.Adw;


//-----------------------------
// ./prefs.js
//-----------------------------

// loosely based on JustPerfection & Blur-My-Shell
//'use strict';

//import Gdk from 'gi://Gdk';
//import Gtk from 'gi://Gtk';
//import Gio from 'gi://Gio';
//import GLib from 'gi://GLib';
//import Adw from 'gi://Adw';
//import GObject from 'gi://GObject';

const GETTEXT_DOMAIN = 'dash2dock-light';

//import { schemaId, SettingsKeys } from './preferences/keys.js';

//import {
//  ExtensionPreferences,
//  gettext as _,
//} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// from Dock-to-Dock
const MonitorsConfig = GObject.registerClass(
  {
    Signals: {
      updated: {},
    },
  },
  class MonitorsConfig extends GObject.Object {
    static get XML_INTERFACE() {
      return '<node>\
            <interface name="org.gnome.Mutter.DisplayConfig">\
                <method name="GetCurrentState">\
                <arg name="serial" direction="out" type="u" />\
                <arg name="monitors" direction="out" type="a((ssss)a(siiddada{sv})a{sv})" />\
                <arg name="logical_monitors" direction="out" type="a(iiduba(ssss)a{sv})" />\
                <arg name="properties" direction="out" type="a{sv}" />\
                </method>\
                <signal name="MonitorsChanged" />\
            </interface>\
        </node>';
    }

    static get ProxyWrapper() {
      return Gio.DBusProxy.makeProxyWrapper(MonitorsConfig.XML_INTERFACE);
    }

    constructor() {
      super();

      this._monitorsConfigProxy = new MonitorsConfig.ProxyWrapper(
        Gio.DBus.session,
        'org.gnome.Mutter.DisplayConfig',
        '/org/gnome/Mutter/DisplayConfig'
      );

      // Connecting to a D-Bus signal
      this._monitorsConfigProxy.connectSignal('MonitorsChanged', () =>
        this._updateResources()
      );

      this._primaryMonitor = null;
      this._monitors = [];
      this._logicalMonitors = [];

      this._updateResources();
    }

    _updateResources() {
      this._monitorsConfigProxy.GetCurrentStateRemote((resources, err) => {
        if (err) {
          logError(err);
          return;
        }

        const [serial_, monitors, logicalMonitors] = resources;
        let index = 0;
        for (const monitor of monitors) {
          const [monitorSpecs, modes_, props] = monitor;
          const [connector, vendor, product, serial] = monitorSpecs;
          this._monitors.push({
            index: index++,
            active: false,
            connector,
            vendor,
            product,
            serial,
            displayName: props['display-name'].unpack(),
          });
        }

        for (const logicalMonitor of logicalMonitors) {
          const [x_, y_, scale_, transform_, isPrimary, monitorsSpecs] =
            logicalMonitor;

          // We only care about the first one really
          for (const monitorSpecs of monitorsSpecs) {
            const [connector, vendor, product, serial] = monitorSpecs;
            const monitor = this._monitors.find(
              (m) =>
                m.connector === connector &&
                m.vendor === vendor &&
                m.product === product &&
                m.serial === serial
            );

            if (monitor) {
              monitor.active = true;
              monitor.isPrimary = isPrimary;
              if (monitor.isPrimary) this._primaryMonitor = monitor;
              break;
            }
          }
        }

        const activeMonitors = this._monitors.filter((m) => m.active);
        if (activeMonitors.length > 1 && logicalMonitors.length === 1) {
          // We're in cloning mode, so let's just activate the primary monitor
          this._monitors.forEach((m) => (m.active = false));
          this._primaryMonitor.active = true;
        }

        this.emit('updated');
      });
    }

    get primaryMonitor() {
      return this._primaryMonitor;
    }

    get monitors() {
      return this._monitors;
    }
  }
);

 class Preferences extends ExtensionPreferences {
  constructor(metadata) {
    super(metadata);

    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    let UIFolderPath = `${this.path}/ui`;
    iconTheme.add_search_path(`${UIFolderPath}/icons`);
    // ExtensionUtils.initTranslations();
  }

  find(n, name) {
    if (n.get_name() == name) {
      return n;
    }
    let c = n.get_first_child();
    while (c) {
      let cn = this.find(c, name);
      if (cn) {
        return cn;
      }
      c = c.get_next_sibling();
    }
    return null;
  }

  dump(n, l) {
    let s = '';
    for (let i = 0; i < l; i++) {
      s += ' ';
    }
    print(`${s}${n.get_name()}`);
    let c = n.get_first_child();
    while (c) {
      this.dump(c, l + 1);
      c = c.get_next_sibling();
    }
  }

  addMenu(window, builder) {
    // let menu_util = builder.get_object('menu_util');
    // window.add(menu_util);

    let headerbar = this.find(window, 'AdwHeaderBar');
    if (!headerbar) {
      return;
    }
    headerbar.pack_start(builder.get_object('info_menu'));

    // setup menu actions
    const actionGroup = new Gio.SimpleActionGroup();
    window.insert_action_group('prefs', actionGroup);

    // a list of actions with their associated link
    const actions = [
      {
        name: 'open-bug-report',
        link: 'https://github.com/icedman/dash2dock-lite/issues',
      },
      {
        name: 'open-readme',
        link: 'https://github.com/icedman/dash2dock-lite',
      },
      {
        name: 'open-buy-coffee',
        link: 'https://www.buymeacoffee.com/icedman',
      },
      {
        name: 'open-license',
        link: 'https://github.com/icedman/dash2dock-lite/blob/master/LICENSE',
      },
    ];

    actions.forEach((action) => {
      let act = new Gio.SimpleAction({ name: action.name });
      act.connect('activate', (_) =>
        Gtk.show_uri(window, action.link, Gdk.CURRENT_TIME)
      );
      actionGroup.add_action(act);
    });

    // window.remove(menu_util);
  }

  addButtonEvents(window, builder, settings) {
    // builder.get_object('static-animation').connect('clicked', () => {
    //   builder.get_object('animation-spread').set_value(0);
    //   builder.get_object('animation-rise').set_value(0);
    //   builder.get_object('animation-magnify').set_value(0);
    // });

    if (builder.get_object('self-test')) {
      builder.get_object('self-test').connect('clicked', () => {
        settings.set_string('msg-to-ext', 'this.runDiagnostics()');
      });
    }
  }

  fillPreferencesWindow(window) {
    // console.log(`>>${window.get_content()}`);
    let builder = new Gtk.Builder();
    this._builder = builder;

    let UIFolderPath = `${this.path}/ui`;

    builder.add_from_file(`${UIFolderPath}/general.ui`);
    builder.add_from_file(`${UIFolderPath}/appearance.ui`);
    builder.add_from_file(`${UIFolderPath}/tweaks.ui`);
    builder.add_from_file(`${UIFolderPath}/others.ui`);
    builder.add_from_file(`${UIFolderPath}/menu.ui`);
    window.add(builder.get_object('general'));
    window.add(builder.get_object('appearance'));
    window.add(builder.get_object('tweaks'));
    window.add(builder.get_object('others'));
    window.set_search_enabled(true);

    // this.dump(window, 0);

this._settings = ExtensionUtils.getSettings(schemaId);
    settings.set_string('msg-to-ext', '');

    let settingsKeys = SettingsKeys();
    settingsKeys.connectBuilder(builder);
    settingsKeys.connectSettings(settings);

    this._settings = settings;

    this.addButtonEvents(window, builder, settings);
    this.addMenu(window, builder);

    builder.get_object('peek-hidden-icons-row').visible = false;

    let toggle_experimental = () => {
      let exp = false; // settingsKeys.getValue('experimental-features');
      // builder.get_object('dock-location-row').visible = exp;
      builder.get_object('lamp-app-animation-row').visible = exp;
      builder.get_object('self-test-row').visible = exp;
    };

    settings.connect('changed::experimental-features', () => {
      toggle_experimental();
    });

    toggle_experimental();

    this._monitorsConfig = new MonitorsConfig();
    this._monitorsConfig.connect('updated', () => this.updateMonitors());
    // settings.connect('changed::preferred-monitor', () => this.updateMonitors());

    this._themed_presets = [];
    this.preloadPresets(`${this.path}/themes`);
    this.preloadPresets(
      Gio.File.new_for_path('.config/d2da/themes').get_path()
    );
    this._buildThemesMenu(window);
    this.updateMonitors();

    this.window = window;
  }

  preloadPresets(themes_path) {
    let dir = Gio.File.new_for_path(themes_path);
    if (!dir.query_exists(null)) {
      return;
    }
    let iter = dir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    let themed_presets = [];
    let f = iter.next_file(null);
    while (f) {
      let fn = Gio.File.new_for_path(`${themes_path}/${f.get_name()}`);
      if (fn.query_exists(null)) {
        const [success, contents] = fn.load_contents(null);
        const decoder = new TextDecoder();
        let contentsString = decoder.decode(contents);
        let json = JSON.parse(contentsString);
        if (json && json['meta'] && json['meta']['title']) {
          themed_presets.push(json);
        }
      }
      f = iter.next_file(null);
    }
    this._themed_presets = [...this._themed_presets, ...themed_presets];
  }

  _buildThemesMenu(window) {
    this._themed_presets.push({ meta: { title: 'Export...' } });

    const actionGroup = new Gio.SimpleActionGroup();
    window.insert_action_group('themes', actionGroup);

    let theme = this._builder.get_object('theme');
    let model = new Gio.Menu();
    let idx = 0;
    this._themed_presets.forEach((m) => {
      let action_name = `set_theme-${idx}`;
      let act = new Gio.SimpleAction({ name: action_name });
      act.connect('activate', (_) => {
        let index = action_name.split('-')[1];
        this.loadPreset(parseInt(index));
      });
      actionGroup.add_action(act);
      model.append(m['meta']['title'], `themes.${action_name}`);
      idx++;
    });
    theme.set_menu_model(model);
  }

  loadPreset(i) {
    let settingsKeys = SettingsKeys();
    settingsKeys.connectSettings(this._settings);
    if (i == this._themed_presets.length - 1) {
      // export
      let keys = settingsKeys.keys();
      let json = {};
      Object.keys(keys).forEach((n) => {
        let k = keys[n];
        if (k.themed) {
          json[n] = settingsKeys.getValue(n);
        }
      });

      json['meta'] = {
        title: 'My Theme',
      };

      let fn = Gio.File.new_for_path(`/tmp/theme.json`);
      let content = JSON.stringify(json, null, 4);
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );

      this.window.add_toast(
        new Adw.Toast({ title: 'Saved to /tmp/theme.json' })
      );
      return;
    }

    let p = this._themed_presets[i];
    if (!p['meta'] || !p['meta']['title']) {
      return;
    }

    Object.keys(p).forEach((k) => {
      let v = p[k];
      let def = settingsKeys.getKey(k);
      if (!def) return;
      switch (def.widget_type) {
        case 'color':
          this._settings.set_value(k, new GLib.Variant('(dddd)', v));
          break;
        case 'switch':
          this._settings.set_boolean(k, v);
          break;
        case 'dropdown':
          this._settings.set_int(k, v);
          break;
      }
    });

    // settingsKeys.connectBuilder(this._builder);
    settingsKeys._builder = this._builder;
    settingsKeys.connectSettings(this._settings);

    this.window.add_toast(new Adw.Toast({ title: `${p['meta']['title']}` }));
  }

  updateMonitors() {
    let monitors = this._monitorsConfig.monitors;
    let count = monitors.length;
    let list = new Gtk.StringList();
    list.append('Primary Monitor');
    for (let i = 0; i < count; i++) {
      let m = monitors[i];
      list.append(m.displayName);
    }
    this._builder.get_object('preferred-monitor').set_model(list);
  }
}


//-----------------------------
// ./preferences/prefKeys.js
//-----------------------------

// const Gdk = imports.gi.Gdk;
// const GLib = imports.gi.GLib;

//import Gdk from 'gi://Gdk';
//import GLib from 'gi://GLib';

let PrefKeys = class {
  constructor() {
    this._keys = {};
  }

  setKeys(keys) {
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      this.setKey(
        name,
        key.default_value,
        key.widget_type,
        key.key_maps,
        key.test,
        key.callback,
        key.options,
        key.themed
      );
    });
  }

  setKey(
    name,
    default_value,
    widget_type,
    maps,
    test,
    callback,
    options,
    themed
  ) {
    this._keys[name] = {
      name,
      default_value,
      widget_type,
      value: default_value,
      maps: maps,
      test: test,
      callback,
      options,
      object: null,
      themed: themed || false,
    };
  }

  setValue(name, value) {
    this._keys[name].value = value;

    let settings = this._settings;
    let keys = this._keys;
    if (settings) {
      let key = keys[name];
      switch (key.widget_type) {
        case 'switch': {
          settings.set_boolean(name, value);
          break;
        }
        case 'dropdown': {
          settings.set_int(name, value);
          break;
        }
        case 'scale': {
          settings.set_double(name, value);
          break;
        }
        case 'color': {
          settings.set_value(name, new GLib.Variant('(dddd)', value));
          break;
        }
      }
    }

    if (this._keys[name].callback) {
      this._keys[name].callback(this._keys[name].value);
    }
  }

  getKey(name) {
    return this._keys[name];
  }

  getValue(name) {
    let value = this._keys[name].value;
    return value;
  }

  reset(name) {
    this.setValue(name, this._keys[name].default_value);
  }

  resetAll() {
    Object.keys(this._keys).forEach((k) => {
      this.reset(k);
    });
  }

  keys() {
    return this._keys;
  }

  connectSettings(settings, callback) {
    this._settingsListeners = [];

    this._settings = settings;
    let builder = this._builder;
    let self = this;
    let keys = this._keys;

    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      key.object = builder ? builder.get_object(key.name) : null;
      switch (key.widget_type) {
        case 'json_array': {
          key.value = [];
          try {
            key.value = JSON.parse(settings.get_string(name));
          } catch (err) {
            // fail silently
          }
          break;
        }
        case 'switch': {
          key.value = settings.get_boolean(name);
          if (key.object) key.object.set_active(key.value);
          break;
        }
        case 'dropdown': {
          key.value = settings.get_int(name);
          try {
            if (key.object) key.object.set_selected(key.value);
          } catch (err) {
            //
          }
          break;
        }
        case 'scale': {
          key.value = settings.get_double(name);
          if (key.object) key.object.set_value(key.value);
          break;
        }
        case 'color': {
          key.value = settings.get_value(name).deepUnpack();
          try {
            if (key.object) {
              key.object.set_rgba(
                new Gdk.RGBA({
                  red: key.value[0],
                  green: key.value[1],
                  blue: key.value[2],
                  alpha: key.value[3],
                })
              );
            }
          } catch (err) {
            //
          }
          break;
        }
      }

      this._settingsListeners.push(
        settings.connect(`changed::${name}`, () => {
          let key = keys[name];
          switch (key.widget_type) {
            case 'json_array': {
              key.value = [];
              try {
                key.value = JSON.parse(settings.get_string(name));
              } catch (err) {
                // fail silently
              }
              break;
            }
            case 'switch': {
              key.value = settings.get_boolean(name);
              break;
            }
            case 'dropdown': {
              key.value = settings.get_int(name);
              break;
            }
            case 'scale': {
              key.value = settings.get_double(name);
              break;
            }
            case 'color': {
              key.value = settings.get_value(name).deepUnpack();
              if (key.value.length != 4) {
                key.value = [1, 1, 1, 0];
              }
              break;
            }
            case 'string': {
              key.value = settings.get_string(name);
              break;
            }
          }
          if (callback) callback(name, key.value);
        })
      );
    });
  }

  disconnectSettings() {
    this._settingsListeners.forEach((id) => {
      this._settings.disconnect(id);
    });
    this._settingsListeners = [];
  }

  connectBuilder(builder) {
    this._builderListeners = [];

    this._builder = builder;
    let self = this;
    let keys = this._keys;
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      let signal_id = null;
      key.object = builder.get_object(key.name);
      if (!key.object) {
        return;
      }

      switch (key.widget_type) {
        case 'json_array': {
          // unimplemented
          break;
        }
        case 'switch': {
          key.object.set_active(key.default_value);
          signal_id = key.object.connect('state-set', (w) => {
            let value = w.get_active();
            self.setValue(name, value);
            if (key.callback) {
              key.callback(value);
            }
          });
          break;
        }
        case 'dropdown': {
          signal_id = key.object.connect('notify::selected-item', (w) => {
            let index = w.get_selected();
            let value = key.maps && index in key.maps ? key.maps[index] : index;
            self.setValue(name, value);
          });
          break;
        }
        case 'scale': {
          signal_id = key.object.connect('value-changed', (w) => {
            let value = w.get_value();
            self.setValue(name, value);
          });
          break;
        }
        case 'color': {
          signal_id = key.object.connect('color-set', (w) => {
            let rgba = w.get_rgba();
            let value = [rgba.red, rgba.green, rgba.blue, rgba.alpha];
            self.setValue(name, value);
          });
          break;
        }
        case 'button': {
          signal_id = key.object.connect('clicked', (w) => {
            if (key.callback) {
              key.callback();
            }
          });
          break;
        }
      }

      // when do we clean this up?
      this._builderListeners.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
};


//-----------------------------
// ./preferences/keys.js
//-----------------------------

//'use strict';

// const ExtensionUtils = imports.misc.extensionUtils;
// const Me = ExtensionUtils.getCurrentExtension();
// const { PrefKeys } = Me.imports.preferences.prefKeys;

//import { PrefKeys } from './prefKeys.js';

let schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

const SettingsKeys = () => {
  let settingsKeys = new PrefKeys();
  settingsKeys.setKeys({
    // debug: {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    // 'debug-log': {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    'experimental-features': {
      default_value: false,
      widget_type: 'switch',
    },
    'debug-visual': {
      default_value: false,
      widget_type: 'switch',
    },
    'shrink-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'icon-size': {
      default_value: 0,
      widget_type: 'scale',
    },
    'animate-icons-unmute': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'animate-icons': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'open-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'lamp-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'autohide-dash': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'autohide-dodge': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'pressure-sense': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-down' },
    },
    'autohide-speed': {
      default_value: 0.5,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'customize-topbar': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'topbar-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'topbar-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'topbar-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'topbar-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'customize-label': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'label-border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'label-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'label-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'label-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'label-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'favorites-only': {
      default_value: false,
      widget_type: 'switch',
    },
    'apps-icon': {
      default_value: true,
      widget_type: 'switch',
    },
    'apps-icon-front': {
      default_value: false,
      widget_type: 'switch',
    },
    'trash-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'downloads-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'documents-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'max-recent-items': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [5, 10, 15, 20, 25] },
    },
    'mounted-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'calendar-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'calendar-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'peek-hidden-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'animation-fps': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { pointer: 'slide-through', values: [0, 1, 2] },
    },
    'animation-bounce': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-magnify': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-spread': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-rise': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'icon-shadow': {
      default_value: true,
      widget_type: 'switch',
    },
    'edge-distance': {
      default_value: 0,
      widget_type: 'scale',
      test: { values: [-1, 0, 1] },
    },
    'border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'separator-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'separator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'dock-padding': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'icon-spacing': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'panel-mode': {
      default_value: false,
      widget_type: 'switch',
    },
    'running-indicator-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: [
        'default',
        'dots',
        'dot',
        'dashes',
        'dash',
        'squares',
        'square',
        'segmented',
        'solid',
        'triangles',
        'triangle',
        'diamonds',
        'diamond',
        'binary',
      ],
      test: { values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    },
    'running-indicator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'notification-badge-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3, 4, 5] },
    },
    'notification-badge-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'preferred-monitor': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'multi-monitor-preference': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'dock-location': {
      default_value: 0,
      widget_type: 'dropdown',
      // options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3] },
    },
    'icon-resolution': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
    },
    'icon-effect': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
      themed: true,
    },
    'icon-effect-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'msg-to-ext': {
      default_value: '',
      widget_type: 'string',
    },
    'animation-type': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'scroll-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
    },
    'drawing-accent-color': {
      default_value: [1.0, 0, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-secondary-color': {
      default_value: [1.0, 0.6, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-color': {
      default_value: [0.2, 0.2, 0.2, 1.0],
      widget_type: 'color',
    },
    'drawing-light-color': {
      default_value: [1.0, 1.0, 1.0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-foreground': {
      default_value: [0.8, 0.8, 0.8, 1.0],
      widget_type: 'color',
    },
    'drawing-light-foreground': {
      default_value: [0.3, 0.3, 0.3, 1.0],
      widget_type: 'color',
    },
  });

  return settingsKeys;
};


