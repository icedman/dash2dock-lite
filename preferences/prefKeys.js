import GLib from 'gi://GLib';

export let PrefKeys = class {
  constructor(patch) {
    this._keys = {};
    // >0 while widgets are updated from settings; widget handlers must not write back
    this._syncing = 0;
    if (patch) {
      Object.keys(patch).forEach((k) => {
        this[k] = patch[k];
      });
    }
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

  _toRGBA() {
    console.log('implement me!');
    // implement @ patch
    return null;
  }

  // run fn without widget handlers writing back to settings
  withoutWriteback(fn) {
    this._syncing++;
    try {
      fn();
    } finally {
      this._syncing--;
    }
  }

  updateWidget(name) {
    let key = this._keys[name];
    if (!key || !key.object) return;
    this.withoutWriteback(() => {
      try {
        switch (key.widget_type) {
          case 'switch':
            key.object.set_active(key.value);
            break;
          case 'dropdown':
            key.object.set_selected(key.value);
            break;
          case 'scale':
          case 'string':
            key.object.set_value(key.value);
            break;
          case 'color':
            key.object.set_rgba(
              this._toRGBA({
                red: key.value[0],
                green: key.value[1],
                blue: key.value[2],
                alpha: key.value[3],
              })
            );
            break;
        }
      } catch (err) {
        console.error(`d2da: prefs update widget ${name}`, err);
      }
    });
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
        case 'string': {
          key.value = settings.get_string(name);
          break;
        }
        case 'color': {
          key.value = settings.get_value(name).deepUnpack();
          break;
        }
      }
      this.updateWidget(name);

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
          self.updateWidget(name);
          if (callback) callback(name, key.value);
        })
      );
    });
  }

  disconnectSettings() {
    (this._settingsListeners || []).forEach((id) => {
      this._settings.disconnect(id);
    });
    this._settingsListeners = [];
  }

  disconnectBuilder() {
    (this._builderListeners || []).forEach((l) => {
      if (l.signal_id) l.source.disconnect(l.signal_id);
    });
    this._builderListeners = [];
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
            if (self._syncing) return;
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
            if (self._syncing) return;
            let index = w.get_selected();
            let value = key.maps && index in key.maps ? key.maps[index] : index;
            self.setValue(name, value);
          });
          break;
        }
        case 'scale': {
          signal_id = key.object.connect('value-changed', (w) => {
            if (self._syncing) return;
            let value = w.get_value();
            self.setValue(name, value);
          });
          break;
        }
        case 'color': {
          signal_id = key.object.connect('color-set', (w) => {
            if (self._syncing) return;
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

      this._builderListeners.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
};
