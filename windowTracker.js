'use strict';

// Window connections for autohide dodge, owned by the extension and shared by
// all docks: one connection set per Meta.Window, no expandos on the window.
// A window is released on 'unmanaged', on untrack() and on clear()/destroy().
export class WindowTracker {
  constructor(onChange) {
    this._onChange = onChange;
    this._windows = new Set();
  }

  get size() {
    return this._windows.size;
  }

  track(window) {
    if (!window || !this._onChange || this._windows.has(window)) return;
    const changed = () => this._onChange?.();
    window.connectObject(
      'position-changed',
      changed,
      'size-changed',
      changed,
      'unmanaged',
      () => this.untrack(window),
      this
    );
    this._windows.add(window);
  }

  untrack(window) {
    if (!this._windows.delete(window)) return;
    try {
      window.disconnectObject(this);
    } catch (e) {
      console.error('d2da: window tracker untrack', e);
    }
  }

  clear() {
    for (const window of [...this._windows]) {
      this.untrack(window);
    }
  }

  destroy() {
    this.clear();
    this._onChange = null;
  }
}
