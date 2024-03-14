'use strict';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import { Dot } from './apps/dot.js';

const Point = Graphene.Point;

const DOT_CANVAS_SIZE = 96;

export const DockBackground = GObject.registerClass(
  {},
  class DockBackground extends St.Widget {
    _init(params) {
      super._init({
        name: 'DockBackground',
        ...(params || {}),
      });
    }

    update(params) {
      let {
        first,
        last,
        iconSize,
        scaleFactor,
        vertical,
        position,
        panel_mode,
        dashContainer,
      } = params;

      if (!first || !last) return;

      let p1 = first.get_transformed_position();
      let p2 = last.get_transformed_position();

      if (!isNaN(p1[0]) && !isNaN(p1[1])) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = p1[0] + tx;
        this.y = first._fixedPosition[1];
        let width = dashContainer.dash.width + Math.abs(tx) + tx2;
        let height = dashContainer.dash.height;

        if (dashContainer.isVertical()) {
          this.x = first._fixedPosition[0];
          this.y = first._fixedPosition[1] + ty;
          width = dashContainer.dash.width;
          height = dashContainer.dash.height + Math.abs(ty) + ty2;
        }

        if (!isNaN(width)) {
          this.width = width;
        }
        if (!isNaN(height)) {
          this.height = height;
        }

        this.x -= dashContainer.x;
        this.y -= dashContainer.y;

        // adjust padding
        let az =
          ((dashContainer.isVertical() ? this.width : this.height) -
            iconSize * scaleFactor) *
          (0.6 - 0.8 * dashContainer.extension.dock_padding);
        this.x += az / 2;
        this.width -= az;
        this.y += az / 2;
        this.height -= az;

        if (panel_mode) {
          if (vertical) {
            this.y = dashContainer.y;
            this.height = dashContainer.height;
          } else {
            this.x = dashContainer.x;
            this.width = dashContainer.width;
          }
        }
      }
    }
  }
);
