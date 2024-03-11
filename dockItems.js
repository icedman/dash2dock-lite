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
        padding,
        iconSize,
        scaleFactor,
        vertical,
        position,
        panel_mode,
        dashContainer,
      } = params;

      padding *= 0.5;

      let p1 = first.get_transformed_position();
      let p2 = last.get_transformed_position();

      if (!isNaN(p1[0]) && !isNaN(p1[1])) {
        let tx = first._icon.translationX;
        let ty = first._icon.translationY;
        let tx2 = last._icon.translationX;
        let ty2 = last._icon.translationY;

        // bottom
        this.x = p1[0] - padding + tx;
        this.y = first._fixedPosition[1];
        let width = dashContainer.dash.width + Math.abs(tx) + tx2 + padding;
        let height = dashContainer.dash.height;

        if (!isNaN(width)) {
          this.width = width;
        }
        if (!isNaN(height)) {
          this.height = height;
        }

        this.x -= dashContainer.x;
        this.y -= dashContainer.y;

        // adjust
        let ah = (this.height - iconSize * scaleFactor) * 0.1;
        this.y += ah / 2;
        this.height -= ah;

        // console.log(`${this.height} ${iconSize * scaleFactor} ${first.first_child.height} ${ah}`);

        // vertical
        // if (vertical) {
        //   this.x = p1[0] - padding;
        //   this.y = first._fixedPosition[1] - padding; // p1[1] - padding

        //   if (position == 'right' && p2[0] > p1[0]) {
        //     this.x = p2[0] - padding;
        //   }
        //   if (position == 'left' && p2[0] < p1[0]) {
        //     this.x = p2[0] - padding;
        //   }

        //   this.width = iconSize * scaleFactor + padding * 2;
        //   this.height =
        //     p2[1] -
        //     p1[1] +
        //     iconSize * scaleFactor * last._targetScale +
        //     padding * 2;
        // }

        // if (panel_mode) {
        //   if (vertical) {
        //     this.y = dashContainer.y;
        //     this.height = dashContainer.height;
        //   } else {
        //     let pad = 0; //dashContainer.cornerPad || 0;
        //     this.x = dashContainer.x - pad;
        //     this.width = dashContainer.width + pad * 2;
        //     this.height++;
        //   }
        // }
      }
    }
  }
);
