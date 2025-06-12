'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { trySpawnCommandLine } from './utils.js';
// import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Graphene from 'gi://Graphene';
const Point = Graphene.Point;

import { DockPosition } from './dock.js';
import { Vector } from './vector.js';

const ANIM_POSITION_PER_SEC = 750 / 1000;

export const DockItemList = GObject.registerClass(
  {},
  class DockItemList extends St.Widget {
    _init(renderer, params) {
      super._init({
        name: 'DockItemList',
        reactive: true,
        // style_class: 'hi',
        ...params,
      });

      this.connect('button-press-event', (obj, evt) => {
        if (!this._box || !this._box.get_children().length) {
          return Clutter.EVENT_PROPAGATE;
        }
        this.slideOut();
        return Clutter.EVENT_PROPAGATE;
      });
    }

    static createItem(dock, f) {
      let target = dock.createItem(f.path);
      target._onClick = () => {
        if (dock._position != DockPosition.BOTTOM) {
          target.activateNewWindow();
          return;
        }
        if (!dock.extension.services[f.items]) {
          f.prepare();
        }
        let files = [...(dock.extension.services[f.items] || [])];
        if (!files.length) return;
        if (files.length < dock.extension.services[f.itemsLength]) {
          files = [
            {
              index: -1,
              name: 'More...',
              exec: `nautilus ${f.folder}`,
              icon: target._icon.icon_name,
              type: 'exec',
            },
            ...files,
          ];
        }
        files = files.sort(function (a, b) {
          return a.index > b.index ? 1 : -1;
        });

        if (!dock._list) {
          dock._list = new DockItemList();
          dock._list.dock = dock;
          Main.uiGroup.add_child(dock._list);
        } else if (dock._list.visible) {
          dock._list.slideOut();
        } else {
          // remove and re-add so that it is repositioned to topmost
          Main.uiGroup.remove_child(dock._list);
          Main.uiGroup.add_child(dock._list);
          dock._list.visible = true;
        }

        if (dock._list.visible && !dock._list._hidden) {
          dock._list.slideIn(target, files);
          let pv = new Point();
          pv.x = 0.5;
          pv.y = 1;
        }
      };

      return target;
    }

    slideIn(target, list) {
      if (this._box) {
        this.remove_child(this._box);
        this._box = null;
      }

      if (!list.length) return;

      this.opacity = 0;

      let dock = this.dock;
      this.x = dock._monitor.x;
      this.y = dock._monitor.y;
      this.width = dock._monitor.width;
      this.height = dock._monitor.height;

      this._hidden = false;
      this._hiddenFrames = 0;

      this._target = target;

      this._box = new St.Widget({ style_class: '-hi' });
      let iconSize = dock.dash._box.first_child._icon.width;

      // scaling hack - temporary
      let iconAdjust = 1;
      // if (dock._scaleFactor != 1 && dock._scaleFactor != 2) {
      //   iconAdjust += 0.5;
      // }

      list.forEach((l) => {
        let w = new St.Widget({});
        let icon = new St.Icon({
          icon_name: l.icon,
          reactive: true,
          track_hover: true,
        });
        icon.set_icon_size(iconSize * iconAdjust);
        this._box.add_child(w);
        let label = new St.Label({ style_class: 'dash-label' });
        let short = (l.name ?? '').replace(/(.{32})..+/, '$1...');
        label.text = short;
        w.add_child(icon);
        w.add_child(label);
        w._icon = icon;
        w._label = label;
        label.opacity = 0;

        icon.connect('button-press-event', () => {
          // let path = Gio.File.new_for_path(`Downloads/${l.name}`).get_path();
          let path = l.path;
          let cmd = `xdg-open "${path}"`;

          if (l.type.includes('directory')) {
            cmd = `nautilus --select "${path}"`;
          }
          if (l.type.includes('exec')) {
            cmd = l.exec;
          }

          this.visible = false;
          this.dock._maybeBounce(this._target);

          trySpawnCommandLine(cmd);
        });
      });

      this.add_child(this._box);

      let tp = this._target.get_transformed_position();
      let angleInc = 0 + 2.5 * dock.extension.items_pullout_angle;
      let startAngle = 270 + 1 * angleInc;
      let angle = startAngle;
      let rad = iconSize; //  * dock._scaleFactor;

      let ox = 0;
      let oy = -rad / 4;

      let children = this._box.get_children();
      children.reverse();
      children.forEach((l) => {
        let hX = Math.cos(angle * 0.0174533);
        let hY = Math.sin(angle * 0.0174533);
        let hl = Math.sqrt(hX * hX + hY * hY);
        hX /= hl;
        hY /= hl;
        hX *= rad;
        hY *= rad;

        l.x = tp[0] - this.x + ox;
        l.y = tp[1] - this.y + oy;

        ox += hX; // * 0.85;
        oy += hY;
        angle += angleInc;

        l.rotation_angle_z = angle - startAngle;
      });

      let first = children[0];
      let fx = first.x;
      let fy = first.y;
      children.forEach((l) => {
        l._ox = first.x;
        l._oy = first.y;
        l._oz = 0;
        l._label.opacity = 0;
        l._x = l.x;
        l._y = l.y - rad * 0.9;
        l._rotation_angle_z = l.rotation_angle_z;
        l.x = first.x;
        l.y = first.y;
        l.rotation_angle_z = 0;
      });

      for (let i = 0; i < children.length; i++) {
        let target = children[i];
        let wp = new Vector([first._x, first._y, 0]);
        wp.rotation_angle_z = target._rotation_angle_z;
        target._waypointsIn = [wp];
        target._waypointsOut = [wp];
        for (let j = 0; j <= i; j++) {
          let wp = new Vector([children[j]._x, children[j]._y, 0]);
          wp.rotation_angle_z = children[j]._rotation_angle_z;
          target._waypointsIn.push(wp);
          target._waypointsOut.unshift(wp);
        }

        let start = new Vector([tp[0] - this.x, tp[1] - this.y, 0]);
        target._waypointsIn.unshift(start);
        target._waypointsOut.push(start);
      }
    }

    slideOut() {
      if (!this._hidden) {
        this._hidden = true;
        this._hiddenFrames = 80;
      }
    }

    animate(dt) {
      // let faster
      for (let i = 0; i < 3; i++) {
        // more precise animation
        this._animate(dt / 2);
        this._animate(dt / 2);
      }
    }

    _animate(dt) {
      // dt /= 8;
      let dock = this.dock;
      let list = dock._list;
      if (!list) return;

      // list.opacity = 255;

      let target = list._target;
      let list_coef = 2;

      let speed = ANIM_POSITION_PER_SEC;
      let didAnimate = false;

      list.translationX = target._icon.translationX;
      list.translationY =
        -((dock._iconSizeScaledDown / 4) * target._scale) +
        target._icon.translationY;

      let tw = target.width * target._icon.scaleX;
      let th = target.height * target._icon.scaleY;
      let prev = null;
      list._box?.get_children().forEach((c) => {
        let waypoints = list._hidden ? c._waypointsOut : c._waypointsIn;
        if (!waypoints || !waypoints.length) {
          return;
        }

        if (list._hidden) {
          c._icon.reactive = false;
        }

        let posVector = new Vector([c.x, c.y]);
        let wp = waypoints[0];

        didAnimate = true;

        let dir = wp.subtract(posVector);
        let mag = dir.magnitude();
        if (mag > 0) {
          dir = dir.normalize();
        }
        let delta = dir.multiplyScalar(speed * dt);
        posVector = posVector.add(delta);
        if (delta.magnitude() > mag || mag == 0) {
          waypoints.shift();
          posVector = wp;
        }
        c.x = posVector.x;
        c.y = posVector.y;

        c._label.translationX = -c._label.width;
        if (list._hidden) {
          let opacity = c._label.opacity - 15;
          if (opacity < 0) opacity = 0;
          c._label.opacity = opacity;
        } else {
          c._label.opacity = 255;
        }
        c.rotation_angle_z =
          (c.rotation_angle_z + (wp.rotation_angle_z || 0)) / 2;
      });

      if (list._hidden) {
        let opacity = list.opacity - 2;
        if (opacity < 0) opacity = 0;
        list.opacity = opacity;
      } else {
        list.opacity = 255;
      }

      if (!didAnimate && list._hidden) {
        // console.log('destroy');
        dock._destroyList();
      }

      target._label.hide();
    }
  },
);
