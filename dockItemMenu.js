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

import { DockPosition } from './dock.js';

export class DockItemMenu extends PopupMenu.PopupMenu {
  constructor(sourceActor, side = St.Side.TOP, params = {}) {
    if (Clutter.get_default_text_direction() === Clutter.TextDirection.RTL) {
      if (side === St.Side.LEFT) side = St.Side.RIGHT;
      else if (side === St.Side.RIGHT) side = St.Side.LEFT;
    }

    super(sourceActor, 0.5, side);

    let { desktopApp } = params;
    if (!desktopApp) return;

    this.desktopApp = desktopApp;

    this._newWindowItem = this.addAction('Open Window', () => {
      let workspaceManager = global.workspace_manager;
      let workspace = workspaceManager.get_active_workspace();
      let ctx = global.create_app_launch_context(0, workspace);
      desktopApp.launch([], ctx);
      this._onActivate();
    });

    desktopApp.list_actions().forEach((action) => {
      let name = desktopApp.get_action_name(action);
      this.addAction(name, () => {
        let workspaceManager = global.workspace_manager;
        let workspace = workspaceManager.get_active_workspace();
        let ctx = global.create_app_launch_context(0, workspace);
        desktopApp.launch_action(action, ctx);
        this.item.dock.extension.animate({ refresh: true });
      });
    });
  }

  _onActivate() {}

  popup() {
    this.open(BoxPointer.PopupAnimation.FULL);
    this._menuManager.ignoreRelease();
  }
}

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
      console.log('----------------');
      console.log(f.icon);
      console.log('----------------');

      let target = dock.createItem(f.path);
      target._onClick = async () => {
        if (dock._position != DockPosition.BOTTOM) {
          target.activateNewWindow();
          return;
        }
        if (!dock.extension.services[f.items]) {
          await f.prepare();
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
      if (dock._scaleFactor != 1 && dock._scaleFactor != 2) {
        iconAdjust += 0.5;
      }

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
          this.dock._maybeBounce(this._target.child);

          try {
            console.log(cmd);
            trySpawnCommandLine(cmd);
          } catch (err) {
            console.log(err);
          }
        });
      });

      this.add_child(this._box);

      let tp = this._target.get_transformed_position();
      let angleInc = 0 + 2.5 * dock.extension.items_pullout_angle;
      let startAngle = 270 + 1 * angleInc;
      let angle = startAngle;
      let rad = iconSize * dock._scaleFactor;

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
      children.forEach((l) => {
        l._ox = first.x;
        l._oy = first.y;
        l._oz = 0;
        l._label.opacity = 0;
        l._x = l.x;
        l._y = l.y - rad * 0.8;
        l._rotation_angle_z = l.rotation_angle_z;
        l.x = first.x;
        l.y = first.y;
        l.rotation_angle_z = 0;
      });
    }

    slideOut() {
      if (!this._hidden) {
        this._hidden = true;
        this._hiddenFrames = 80;
      }
    }

    animate(dt) {
      let dock = this.dock;
      let list = dock._list;
      list.opacity = 255;

      let target = list._target;
      let list_coef = 2;

      let tw = target.width * target._icon.scaleX;
      let th = target.height * target._icon.scaleY;
      let prev = null;
      list._box?.get_children().forEach((c) => {
        if (!dock._list) return;

        c.translationX = target._icon.translationX + tw / 8;
        c.translationY =
          -target._icon.scaleX * target._icon.height + target._icon.height;
        c._label.translationX = -c._label.width;

        let tx = c._x;
        let ty = c._y;
        let tz = c._rotation_angle_z;
        let to = 255;
        if (list._hidden) {
          tx = c._ox;
          ty = c._oy;
          tz = c._oz;
          to = 0;
          if (prev) {
            tx = (tx * 5 + prev.x) / 6;
          }

          //! frame count is not accurate ... check if the animatton has ended
          if (list._hiddenFrames-- <= 0) {
            dock._destroyList();
          }
        }

        let list_coef_x = list_coef + 4;
        let list_coef_z = list_coef + 6;
        c._label.opacity =
          (c._label.opacity * list_coef + to) / (list_coef + 1);
        c.x = (c.x * list_coef_x + tx) / (list_coef_x + 1);
        c.y = (c.y * list_coef + ty) / (list_coef + 1);
        // if (list._hidden) {
        c.opacity = c._label.opacity;
        // }
        c.rotation_angle_z =
          (c.rotation_angle_z * list_coef_z + tz) / (list_coef_z + 1);

        prev = c;
      });

      target._label.hide();
    }
  }
);
