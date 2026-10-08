'use strict';

import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

const shaderSourceCache = new Map();

export const getShaderSource = (extensionDir, filename) => {
  if (shaderSourceCache.has(filename)) {
    return shaderSourceCache.get(filename);
  }
  const shaderPath = GLib.build_filenamev([
    extensionDir,
    'effects',
    filename,
  ]);
  try {
    const src = Shell.get_file_contents_utf8_sync(shaderPath);
    shaderSourceCache.set(filename, src);
    return src;
  } catch (e) {
    console.error(`d2da: error loading shader from ${shaderPath}: ${e}`);
    return null;
  }
};

export const ColorShaderEffect = GObject.registerClass(
  {},
  class ColorShaderEffect extends Clutter.ShaderEffect {
    _init(params = {}, shaderFilename = '') {
      this._red = null;
      this._green = null;
      this._blue = null;
      this._blend = null;
      this._static = true;
      this._shaderFilename = shaderFilename;
      this._source = null;

      let _color = params.color;
      delete params.color;

      super._init(params);

      if (_color) this.color = _color;
    }

    preload(extensionDir) {
      if (!this._shaderFilename) return;
      this._source = getShaderSource(extensionDir, this._shaderFilename);
      if (this._source) {
        this.set_shader_source(this._source);
      }
      this.update_enabled();
    }

    get red() {
      return this._red;
    }

    set red(value) {
      if (this._red !== value) {
        this._red = value;
        this.set_uniform_value('red', parseFloat(this._red - 1e-6));
      }
    }

    get green() {
      return this._green;
    }

    set green(value) {
      if (this._green !== value) {
        this._green = value;
        this.set_uniform_value('green', parseFloat(this._green - 1e-6));
      }
    }

    get blue() {
      return this._blue;
    }

    set blue(value) {
      if (this._blue !== value) {
        this._blue = value;
        this.set_uniform_value('blue', parseFloat(this._blue - 1e-6));
      }
    }

    get blend() {
      return this._blend;
    }

    set blend(value) {
      if (value > 0.5) {
        value *= 0.75;
        if (value < 0.5) {
          value = 0.5;
        }
      }
      if (this._blend !== value) {
        this._blend = value;
        this.set_uniform_value('blend', parseFloat(this._blend - 1e-6));
      }
      this.update_enabled();
    }

    get color() {
      return [this.red, this.green, this.blue, this.blend];
    }

    set color(rgba) {
      if (rgba && rgba.length === 4) {
        let [r, g, b, a] = rgba;
        this.red = r;
        this.green = g;
        this.blue = b;
        this.blend = a;
      }
    }

    set(params) {
      this.color = params.color;
    }

    update_enabled() {
      this.set_enabled(this.blend > 0 && this._static);
    }

    vfunc_paint_target(paint_node = null, paint_context = null) {
      this.set_uniform_value('tex', 0);

      if (paint_node && paint_context)
        super.vfunc_paint_target(paint_node, paint_context);
      else if (paint_node) super.vfunc_paint_target(paint_node);
      else super.vfunc_paint_target();
    }
  }
);
