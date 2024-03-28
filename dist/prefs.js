const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Adw = imports.gi.Adw;


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
    'pressure-sense-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
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


