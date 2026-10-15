// Adapted from Blur-My-Shell
// Adapted from https://gist.github.com/yiwenl/1c2ce935e66b82c7df5f

'use strict';

import GObject from 'gi://GObject';
import { ColorShaderEffect } from './color_shader_effect.js';

export const MonochromeEffect = GObject.registerClass(
  {},
  class D2DAMonochromeEffect extends ColorShaderEffect {
    _init(params = {}) {
      super._init(params, 'monochrome_effect.glsl');
    }
  }
);
