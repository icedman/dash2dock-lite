'use strict';

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { DockPosition } from './dock.js';
import {
  get_distance_sqr,
  get_distance,
  isOverlapRect,
} from './utils.js';

const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 40;

// some codes lifted from dash-to-dock intellihide
// Dodge regular windows and their dialogs/tool palettes. DOCK, TOOLBAR, MENU
// and SPLASHSCREEN stay excluded: they are panels, transient popups or
// short-lived, and must not make the dock hide.
const handledWindowTypes = [
  Meta.WindowType.NORMAL,
  // Meta.WindowType.DOCK,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  // Meta.WindowType.TOOLBAR,
  // Meta.WindowType.MENU,
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
    // _debounceCheckHide() also runs while autohide is off, so always drop it
    this.extension._loTimer?.cancel(this._debounceCheckSeq);
    this._debounceCheckSeq = null;

    if (this._showTimeoutId) {
      GLib.Source.remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }

    if (!this._enabled) return;
    if (this.extension._hiTimer) {
      this.extension._hiTimer.cancel(this._animationSeq);
    }
    this._animationSeq = null;

    this.show();

    this._enabled = false;

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
        this.extension.pressure_threshold !== undefined
          ? Math.round(this.extension.pressure_threshold)
          : 80 - 60 * (this.extension.pressure_sense_sensitivity || 0);

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
        if (
          // bottom
          (this.dock._position == DockPosition.BOTTOM &&
            dx < area &&
            pointer[1] + 4 > monitor.y + sh) ||
          // top
          (this.dock._position == DockPosition.TOP &&
            dx < area &&
            pointer[1] - 4 < monitor.y)
        ) {
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
      let showDelay = (this.extension.autohide_show_timeout ?? 0.0) * 1000;
      if (showDelay <= 50) {
        if (this._showTimeoutId) {
          GLib.Source.remove(this._showTimeoutId);
          this._showTimeoutId = null;
        }
        this.show();
      } else if (!this._showTimeoutId) {
        this._showTimeoutId = GLib.timeout_add(
          GLib.PRIORITY_DEFAULT,
          Math.round(showDelay),
          () => {
            this._showTimeoutId = null;
            this.show();
            return GLib.SOURCE_REMOVE;
          }
        );
      }
    }
  }

  _onLeaveEvent() {
    if (this._showTimeoutId) {
      GLib.Source.remove(this._showTimeoutId);
      this._showTimeoutId = null;
    }
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

  show() {
    if (
      !this.dock._monitor ||
      (this.dock._monitor.inFullscreen &&
        !this.extension.autohide_in_fullscreen)
    ) {
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

  _checkOverlap() {
    // console.log("checking overlap...");
    if (this.extension._inOverview) {
      return false;
    }
    let pointer = global.get_pointer();
    if (this.extension.simulated_pointer) {
      pointer = [...this.extension.simulated_pointer];
    }

    // console.log(pointer);

    if (!this.extension.autohide_dash) {
      return false;
    }

    // console.log("checking pointer location...");

    // Only a shown dock is kept up by the pointer (_isWithinDash is false while
    // hidden); a hidden dock is revealed solely through the dwell edge strip.
    if (this.dock._isWithinDash(pointer)) {
      return false;
    }

    if (!this.extension.autohide_dodge) {
      return true;
    }

    // console.log("checking fullscreen...");

    if (this.dock._monitor && this.dock._monitor.inFullscreen) {
      if (!this.extension.autohide_in_fullscreen) {
        return true;
      }
    }

    // console.log("checking windows...");

    let monitor = this.dock._monitor;
    let actors = global.get_window_actors();
    let windows = actors
      .map((a) => a.get_meta_window())
      .filter((w) => Boolean(w));
    windows = windows.filter((w) => w.can_close());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    // windows = windows.filter((w) => !w.is_override_redirect());
    let workspace = global.workspace_manager.get_active_workspace_index();
    // get_workspace() returns the active workspace for sticky windows, but may be
    // null for a window that is still being managed or is being unmanaged
    windows = windows.filter(
      (w) =>
        (w.is_on_all_workspaces() ||
          w.get_workspace()?.index() === workspace) &&
        w.showing_on_its_workspace()
    );
    windows = windows.filter((w) =>
      handledWindowTypes.includes(w.get_window_type())
    );

    if (this.extension.show_dock_urgent) {
      let hasUrgent = windows.some(
        (w) =>
          w.demands_attention ||
          (typeof w.is_demands_attention === 'function' &&
            w.is_demands_attention()) ||
          (typeof w.is_urgent === 'function' && w.is_urgent())
      );
      if (hasUrgent) {
        return false;
      }
    }

    let intellihideMode = this.extension.intellihide_mode ?? 1;
    if (intellihideMode === 3) {
      // Always on top - dock does not dodge windows
      return false;
    }

    if (intellihideMode === 1) {
      // Only focused application's windows
      let focusWindow = global.display?.focus_window;
      if (!focusWindow) {
        return false;
      }
      let tracker = Shell.WindowTracker.get_default();
      let focusApp = tracker ? tracker.get_window_app(focusWindow) : null;
      windows = windows.filter((w) => {
        if (w === focusWindow) return true;
        if (focusApp && tracker?.get_window_app(w) === focusApp) {
          return true;
        }
        return false;
      });
    } else if (intellihideMode === 2) {
      // Only maximized windows
      windows = windows.filter((w) => {
        let isMax = false;
        if (typeof w.is_maximized === 'function') {
          isMax = w.is_maximized();
        } else if (typeof w.get_maximized === 'function') {
          isMax = w.get_maximized() !== 0;
        } else if (w.maximized_horizontally || w.maximized_vertically) {
          isMax = true;
        }
        return isMax;
      });
    }

    let isOverlapped = false;
    let dockRect = this.dock.struts.get_transformed_position();
    dockRect.push(this.dock.struts.width);
    dockRect.push(this.dock.struts.height);

    windows.forEach((w) => {
      this.extension.windowTracker?.track(w);
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

  _debounceCheckHide() {
    if (this.extension._loTimer) {
      let timeout = Math.max(
        50,
        Math.round((this.extension.autohide_hide_timeout ?? 0.2) * 1000)
      );
      if (!this._debounceCheckSeq) {
        this._debounceCheckSeq = this.extension._loTimer.runDebounced(
          () => {
            this._checkHide();
          },
          timeout,
          'debounceCheckHide'
        );
      } else {
        this._debounceCheckSeq._delay = timeout;
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
