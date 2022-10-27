const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;

var setTimeout = (func, delay, ...args) => {
  const wrappedFunc = () => {
    func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

var setInterval = (func, delay, ...args) => {
  const wrappedFunc = () => {
    return func.apply(this, args) || true;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

var clearTimeout = (id) => {
  GLib.source_remove(id);
};

var clearInterval = (id) => {
  GLib.source_remove(id);
};

var getPointer = () => {
  let display = Gdk.Display.get_default();

  // wayland?
  if (!display) {
    return {
      get_position: () => {},
      warp: () => {},
    };
  }

  let deviceManager = display.get_device_manager();
  let pointer = deviceManager.get_client_pointer();
  return pointer;
};

var warpPointer = (pointer, x, y) => {
  let [screen, pointerX, pointerY] = pointer.get_position();
  pointer.warp(screen, x, y);
};

let _tests = [];
var runSequence = (tests) => {
  if (tests) {
    _tests = tests;
  }
  if (_tests.length == 0) return;
  let t = _tests[0];
  let d = Math.floor(t.delay * 1000);
  setTimeout(() => {
    t.func(t);
  }, 10);
  _tests.splice(0, 1);

  setTimeout(runSequence, d);
};
