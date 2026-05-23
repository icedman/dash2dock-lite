'use strict';

import Meta from 'gi://Meta';

import { DockPosition } from './dock.js';
import {
  get_distance_sqr,
  get_distance,
  isInRect,
  isOverlapRect,
} from './utils.js';

const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 40;

// some codes lifted from dash-to-dock intellihide
const handledWindowTypes = [
  Meta.WindowType.NORMAL,
  // Meta.WindowType.DOCK,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  // Meta.WindowType.TOOLBAR,
  Meta.WindowType.MENU, 
  Meta.WindowType.DROPDOWN_MENU, // to hide the dock in case the right mouse menu and Dropdown menu overlap the dock. 
  Meta.WindowType.UTILITY,
  // Meta.WindowType.SPLASHSCREEN
];

export let AutoHide = class {
  enable() {
    if (this._enabled) return;
    // console.log('enable autohide');
    this._enabled = true;
    this._shown = true;
    this._dwell = 0;
    console.log('autohide enabled');
  }

  disable() {
    if (!this._enabled) return;
    if (this.extension._hiTimer) {
      this.extension._hiTimer.cancel(this._animationSeq);
    }

    this.show();

    this._enabled = false;

    let actors = global.get_window_actors();
    let windows = actors.map((a) => a.get_meta_window());
    windows.forEach((w) => {
      if (w._tracked) {
        this._untrack(w);
      }
    });

    console.log('autohide disabled');
  }

  _getScaleFactor() {
    //! use dock scale factor
    let scaleFactor = this.dock._monitor.geometry_scale;
    return scaleFactor;
  }

  _onMotionEvent() {
    if (this.extension.pressure_sense && !this._shown) {
      let monitor = this.dock._monitor;
      let pointer = global.get_pointer();
      if (this.extension.simulated_pointer) {
        pointer = [...this.extension.simulated_pointer];
      }

      let sw = monitor.width;
      let sh = monitor.height;
      let scale = this._getScaleFactor();
      let area = scale * (PRESSURE_SENSE_DISTANCE * PRESSURE_SENSE_DISTANCE);
      let dx = 0;
      let dy = 0;

      if (this.last_pointer) {
        dx = pointer[0] - this.last_pointer[0];
        dx = dx * dx;
        dy = pointer[1] - this.last_pointer[1];
        dy = dy * dy;
      }

      let dwell_count =
        80 - 60 * (this.extension.pressure_sense_sensitivity || 0);

      if (this.dock.isVertical()) {
        if (
          // right
          (this.dock._position == DockPosition.RIGHT &&
            dy < area &&
            pointer[0] > monitor.x + sw - 4) ||
          // left
          (this.dock._position == DockPosition.LEFT &&
            dy < area &&
            pointer[0] < monitor.x + 4)
        ) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      } else {
        // bottom
        if (dx < area && pointer[1] + 4 > monitor.y + sh) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      }

      // console.log(`${this._dwell} ${dwell_count} ${this.extension.pressure_sense_sensitivity}`);

      if (this._dwell > dwell_count) {
        this.show();
      }
    }
  }

  _onEnterEvent() {
    if (!this.extension.pressure_sense) {
      this.show();
    }
  }

  _onLeaveEvent() {
    if (this._shown) {
      this._dwell = 0;
      this._debounceCheckHide();
    }
  }

  _onFocusWindow() {
    this._debounceCheckHide();
  }

  _onFullScreen() {
    this._debounceCheckHide();
  }

  // The dock will show back in Overview (if open Overview from a state of an opened app with fullcreen status
  show() {
    if (!this.dock._monitor || (this.dock._monitor.inFullscreen && !this.extension._inOverview)) {
      return;
    }
    this._dwell = 0;
    this.frameDelay = 0;
    this._shown = true;
    this.dock.slideIn();
  }

  hide() {
    this._dwell = 0;
    this.frameDelay = 10;
    this._shown = false;
    this.dock.slideOut();
  }

  _track(window) {
    //! window tracking should be made global
    if (!window._tracked) {
      window.connectObject(
        'position-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dock.extension.checkHide();
        },
        'size-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dock.extension.checkHide();
        },
        this
      );
      window._tracked = true;
    }
  }

  _untrack(window) {
    try {
      if (window && window._tracked) {
        window.disconnectObject(this);
        window._tracked = false;
      }
    } catch (err) {
      // may have been destroyed already
    }
  }

  _checkOverlap() {
    // Declare mode of autohide
    let mode1_allWindows = 1;
    let mode2_onlyActiveWindows = 2;
    let mode_selected = mode2_onlyActiveWindows;
    
    // console.log("checking overlap...");
    if (this.extension._inOverview) {
      return false;
    }
    let pointer = global.get_pointer();
    if (this.extension.simulated_pointer) {
      pointer = [...this.extension.simulated_pointer];
    }

    // console.log(pointer);

    let pos = this.dock.struts.get_transformed_position();
    let rect = {
      x: pos[0],
      y: pos[1],
      w: this.dock.struts.width,
      h: this.dock.struts.height,
    };
    //! change to struts rect
    let arect = [rect.x, rect.y, rect.w, rect.h];

    // console.log(arect);

    if (!this.extension.autohide_dash) {
      return false;
    }

    // console.log("checking pointer location...");

    if (this.dock._isWithinDash(pointer) || isInRect(arect, pointer)) {
      return false;
    }

    if (!this.extension.autohide_dodge) {
      return true;
    }

    // console.log("checking fullscreen...");

    if (this.dock._monitor && this.dock._monitor.inFullscreen) {
      return true;
    }

    // console.log("checking windows...");

    let monitor = this.dock._monitor;
    let actors = global.get_window_actors();

    // Add popumMenu to hide the dock if the right mouse menu overlap the doc (becasuse this dock is design to be always over everything)
    let popupMenus = actors
      .map(a => a.get_meta_window())
      .filter(w =>
          w &&
          (w.get_window_type() === Meta.WindowType.DROPDOWN_MENU ||
            w.get_window_type() === Meta.WindowType.POPUP_MENU ||
            w.get_window_type() === Meta.WindowType.MENU)
      );

    // Hide the dock if any windows overlaps the dock.
    const _checkOverlap1 = () => {
      let windows = actors.map((a) => {
      let w = a.get_meta_window();
      w._parent = a;
      return w;
      });
      
      windows = windows.filter((w) => w.can_close());
      windows = windows.filter((w) => w.get_monitor() == monitor.index);
      // windows = windows.filter((w) => !w.is_override_redirect());
      let workspace = global.workspace_manager.get_active_workspace_index();
      windows = windows.filter(
        (w) =>
          workspace == w.get_workspace().index() && w.showing_on_its_workspace()
      );
      windows = windows.filter((w) => w.get_window_type() in handledWindowTypes);


      // Add popup and right mouse menu to check
      popupMenus.forEach(m => {
          if (m && m.get_monitor() === monitor.index) {
              windows.push(m);
          }
      });
      

      let isOverlapped = false;
      let dockRect = this.dock.struts.get_transformed_position();
      dockRect.push(this.dock.struts.width);
      dockRect.push(this.dock.struts.height);

      windows.forEach((w) => {
        this._track(w);
        if (isOverlapped) return;
  
        let frame = w.get_frame_rect();
        let win = [frame.x, frame.y, frame.width, frame.height];
  
        if (isOverlapRect(dockRect, win)) {
          isOverlapped = true;
        }
      });

      this.windows = windows;

      // console.log(isOverlapped);
      return isOverlapped;
    }

    // Hide the dock if only there is an overlap of active windows on the dock,
    let focused = global.display.get_focus_window();
    let checkWindows = [];
    
    const _checkOverlap2 = () => {
      if (focused && focused.get_monitor() === monitor.index) {
        let winType = focused.get_window_type();
        let isValidAppWindows = false;
        for (let i = 0; i < actors.length; i++) {
            let win = actors[i].get_meta_window();
  
            // So sánh đối tượng cửa sổ
            if (win === focused) {
                isValidAppWindows = true;
                break; 
            }
        }
        if (isValidAppWindows && winType !== Meta.WindowType.DESKTOP && focused.can_close()) {
            checkWindows.push(focused);
        }
      }  
  
      popupMenus.forEach(w => {
          if (w.get_monitor() === monitor.index) {
              checkWindows.push(w);
          }
      });
  
      this.windows = checkWindows;
      if (checkWindows.length === 0) {
          return false;
      }
  
      let dockRect = this.dock.struts.get_transformed_position();
      dockRect.push(this.dock.struts.width);
      dockRect.push(this.dock.struts.height);
  
      let isOverlapped = false;
  
      checkWindows.forEach(w => {
          this._track(w);
          if (isOverlapped) return;
  
          let frame = w.get_frame_rect();
          let win = [frame.x, frame.y, frame.width, frame.height];
  
          if (isOverlapRect(dockRect, win)) {
              isOverlapped = true;
          }
      });
  
      return isOverlapped;
    }
    
    let overlap = false;
  
    if(mode_selected === mode1_allWindows) {
      overlap = _checkOverlap1();
      return overlap;
    }
  
    if(mode_selected === mode2_onlyActiveWindows) {
      overlap = _checkOverlap2();
      return overlap;
    }
  
    return overlap;   
  }
    
    
  _debounceCheckHide() {
    if (this.extension._loTimer) {
      if (!this._debounceCheckSeq) {
        this._debounceCheckSeq = this.extension._loTimer.runDebounced(
          () => {
            this._checkHide();
          },
          DEBOUNCE_HIDE_TIMEOUT,
          'debounceCheckHide'
        );
      } else {
        this.extension._loTimer.runDebounced(this._debounceCheckSeq);
      }
    }
  }

  _checkHide() {
    if (this._enabled) {
      if (this._checkOverlap()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }
};
