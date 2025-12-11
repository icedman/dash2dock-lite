import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// these are hacks to make Dash2Dock Animated compatible with other Extensions
//
export const Integrations = class {
  enable() {
    this.hookCompiz();
    this.hookBms();
  }

  disable() {
    this.releaseCompiz();
    this.releaseBms();
  }

  hookCompiz(hook = true) {
    let compiz = Main.extensionManager.lookup(
      'compiz-alike-magic-lamp-effect@hermes83.github.com'
    );
    if (compiz && compiz.stateObj) {
      let stateObj = compiz.stateObj;
      this._compiz = stateObj;
      if (stateObj._getIcon && !hook) {
        stateObj.getIcon = stateObj._getIcon;
        stateObj._getIcon = null;
      }
      if (!stateObj._getIcon && hook) {
        stateObj._getIcon = stateObj.getIcon;
        if (this.extension.lamp_app_animation) {
          stateObj.getIcon = this.compiz_getIcon.bind(this);
        }
      }
    }
  }

  releaseCompiz() {
    this.hookCompiz(false);
    this._compiz = null;
  }

  // override compiz getIcon
  compiz_getIcon(actor) {
    let [success, icon] = actor.meta_window.get_icon_geometry();
    if (success) {
      return icon;
    }

    let docks = this.extension.docks;

    let monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
    let dock = docks.find((d) => d._monitorIndex == monitor.index);

    if (!dock) {
      return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
    }

    let dashIcon = null;

    let pids = null;
    let pid = actor.get_meta_window()
      ? actor.get_meta_window().get_pid()
      : null;
    if (pid) {
      dock.dash._box
        .get_children()
        .filter(
          (dashElement) =>
            dashElement.child &&
            dashElement.child._delegate &&
            dashElement.child._delegate.app
        )
        .forEach((dashElement) => {
          pids = dashElement.child._delegate.app.get_pids();
          if (pids && pids.indexOf(pid) >= 0) {
            let transformed_position = dashElement.get_transformed_position();
            if (
              transformed_position &&
              transformed_position[0] &&
              transformed_position[1]
            ) {
              dashIcon = {
                x: transformed_position[0],
                y: transformed_position[1],
                width: 0,
                height: 0,
              };
              return;
            }
          }
        });
    }

    if (!dashIcon) {
      return { x: monitor.x, y: monitor.y, width: 0, height: 0 };
    }

    // console.log('compiz-alike-magic-lamp-effect: getIcon');
    // console.log(`x:${dashIcon.x} y:${dashIcon.y} w:${dashIcon.width} h:${dashIcon.height}`);
    let x = dashIcon.x;
    let y = dashIcon.y;
    let w = dashIcon.width;
    let h = dashIcon.height;

    switch (dock._position) {
      case 'left':
        x = dock._monitor.x;
        break;
      case 'right':
        x = dock._monitor.x + dock._monitor.width;
        break;
      case 'top':
        y = dock._monitor.y;
        break;
      case 'bottom':
        y = dock._monitor.y + dock._monitor.height;
        break;
    }

    dashIcon = {
      x: x,
      y: y,
      width: w,
      height: h,
    };

    return dashIcon;
  }

  hookBms(hook = true) {
    if (!hook) {
      this.extension.docks.forEach((dock) => {
        dock.animator._bms = null;
      });
    }

    let bms = Main.extensionManager.lookup('blur-my-shell@aunetx');
    this._bms = bms;
    if (bms && bms.stateObj && bms.metadata.version >= 70) {
      let obj = bms.stateObj;
      if (obj._dash_to_dock_blur) {
        if (!obj._dash_to_dock_blur.update_size_orig) {
          obj._dash_to_dock_blur.update_size_orig =
            obj._dash_to_dock_blur.update_size;
        }
        if (hook && this.extension.blur_background) {
          obj._dash_to_dock_blur.update_size = () => {};
        } else if (obj._dash_to_dock_blur.update_size_orig) {
          obj._dash_to_dock_blur.update_size =
            obj._dash_to_dock_blur.update_size_orig;
        }
      }
    }
  }

  releaseBms() {
    this.hookBms(false);
    this._bms = null;
  }

  bms_update_size(animator) {
    let dock = animator.dock;

    // blur my shell
    let bms = dock.get_children().find((child) => {
      let name = child.get_name();
      return name === 'bms-dash-backgroundgroup';
    });

    animator._bms = bms;

    if (!bms) {
      return;
    }

    bms.visible = dock.extension.blur_background;
    if (!bms.visible) {
      return;
    }

    // compatible blur-my-shell version 70
    // bms version 70 supports 46,47..up
    if (
      dock.extension.integrations._bms &&
      dock.extension.integrations._bms.metadata.version >= 70
    ) {
      let bg_offset_x = dock._background.x;
      let bg_offset_y = dock._background.y;
      let rw = dock.renderArea.width;
      let rh = dock.renderArea.height;

      let meta_background = bms.first_child.first_child;
      if (!meta_background) {
        // this should exists
        return;
      }

      // bottom layout
      switch (dock._position) {
        case 'left':
        case 'top':
          bms.x = 0;
          bms.y = 0;
          bms.first_child.x = 0;
          bms.first_child.y = 0;
          bms.first_child.set_clip(
            bg_offset_x,
            bg_offset_y,
            dock._background.width - (dock.extension.border_thickness && 0),
            dock._background.height - (dock.extension.border_thickness && 0)
          );
          break;
        case 'right':
          bms.x = 0;
          bms.y = 0;
          bms.first_child.x = -meta_background.width + rw;
          bms.first_child.y = 0;
          bms.first_child.set_clip(
            -bms.first_child.x + bg_offset_x,
            0 + bg_offset_y,
            dock._background.width - (dock.extension.border_thickness && 0),
            dock._background.height - (dock.extension.border_thickness && 0)
          );
          break;
        case 'bottom':
        default:
          bms.x = 0;
          bms.y = 0;
          bms.first_child.x = 0;
          bms.first_child.y = -meta_background.height + rh;
          bms.first_child.set_clip(
            0 + bg_offset_x,
            -bms.first_child.y + bg_offset_y,
            dock._background.width - (dock.extension.border_thickness && 0),
            dock._background.height - (dock.extension.border_thickness && 0)
          );
          break;
      }

      let opacity = (dock.extension.background_color[3] ?? 0.5) * 54 + 200;
      meta_background.opacity = opacity;

      animator._blur_effects = bms.first_child.get_effects();
      if (animator._blur_effects) {
        animator._blur_effects.forEach((e) => {
          if (e.constructor.name == 'CornerEffect') {
            e.radius = dock.extension.computed_border_radius;
          }
        });
      }

      return;
    }

    // bms version incompatible
    bms.visible = false;
  }
};
