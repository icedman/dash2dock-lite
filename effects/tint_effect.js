// Adapted from Blur-My-Shell

'use strict';

import GObject from 'gi://GObject';
import { ColorShaderEffect } from './color_shader_effect.js';

export const TintEffect = GObject.registerClass(
  {},
  class D2DATintEffect extends ColorShaderEffect {
    _init(params = {}) {
      super._init(params, 'tint_effect.glsl');
    }
  }
);
