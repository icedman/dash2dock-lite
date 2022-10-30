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

const dummy_pointer = {
  get_position: () => {
    return [{}, 0, 0];
  },
  warp: (screen, x, y) => {},
};

var getPointer = () => {
  let display = Gdk.Display.get_default();

  // wayland?
  if (!display) {
    return dummy_pointer;
  }

  let deviceManager = display.get_device_manager();
  if (!deviceManager) {
    return dummy_pointer;
  }
  let pointer = deviceManager.get_client_pointer() || dummy_pointer;
  return pointer;
};

var warpPointer = (pointer, x, y) => {
  let [screen, pointerX, pointerY] = pointer.get_position();
  pointer.warp(screen, x, y);
};

var runSequence = (seq) => {
  if (seq.length == 0) return;
  let t = seq[0];
  let d = Math.floor(t.delay * 1000);
  t._id = setTimeout(() => {
    t.func(t);
  }, 10);
  seq.splice(0, 1);

  setTimeout(() => {
    runSequence(seq);
  }, d);
};
