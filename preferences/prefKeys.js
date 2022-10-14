var ValueType = {
  B: 'Boolean',
  I: 'Integer',
  D: 'Double',
  S: 'String',
  C: 'Color',
  AS: 'StringArray',
};

var PrefKeys = class {
  constructor() {
    this._keys = {};
    this._signals = [];
  }

  setKeys(keys) {
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      this.setKey(
        name,
        key.value_type,
        key.default_value,
        key.widget_type,
        key.key_maps
      );
    });
  }

  setKey(name, value_type, default_value, widget_type, key_maps) {
    this._keys[name] = {
      name,
      value_type,
      default_value,
      widget_type,
      value: default_value,
      maps: key_maps,
      object: null,
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
      }
    }
  }

  getKey(name) {
    return this._keys[name];
  }

  getValue(name) {
    let value = this._keys[name].value;
    if (this.onGetValue) {
      value = this.onGetValue(name, value);
    }
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

  connectSettings(settings) {
    this._settings = settings;
    let builder = this._builder;
    let self = this;
    let keys = this._keys;
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      key.object = builder.get_object(key.name);
      if (!key.object) return;
      switch (key.widget_type) {
        case 'switch': {
          key.value = settings.get_boolean(name);
          key.object.set_active(key.value);
          break;
        }
        case 'dropdown': {
          key.value = settings.get_int(name);
          key.object.set_selected(key.value);
          break;
        }
        case 'scale': {
          key.value = settings.get_double(name);
          key.object.set_value(key.value);
          break;
        }
      }
    });

    // todo connect signals here instead of at the extension.js
  }

  connectSignals(builder) {
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
        case 'switch': {
          signal_id = key.object.connect('state-set', (w) => {
            let value = w.get_active();
            self.setValue(name, value);
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
      this._signals.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
};
