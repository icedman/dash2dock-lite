var ValueType = {
  B: 'Boolean',
  I: 'Integer',
  D: 'Double',
  S: 'String',
  C: 'Color',
  AS: 'StringArray',
};

class PrefKeys {
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
    if (this.onSetValue) {
      this.onSetValue(name, this._keys[name].value);
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

  // onSetValue(name, value) {
  // }

  // onGetValue(name, value) {
  //   return value;
  // }

  connectSignals(builder) {
    let self = this;
    let keys = this._keys;
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      let signal_id = null;
      key.object = builder.get_object(key.name);
      print(key.object);
      switch (key.widget_type) {
        case 'switch': {
          signal_id = key.object.connect('state-set', (w) => {
            let value = w.get_active();
            self.setValue(name, value);
            // print(value);
          });
          break;
        }
        case 'dropdown': {
          signal_id = key.object.connect('notify::selected-item', (w) => {
            let index = w.get_selected();
            let value = index in key.maps ? key.maps[index] : index;
            self.setValue(name, value);
            // print(value);
          });
          break;
        }
        case 'scale': {
          signal_id = key.object.connect('value-changed', (w) => {
            let value = w.get_value();
            self.setValue(name, value);
            // print(value);
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

      this._signals.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
}
