'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const pointer_wrapper = {
  get_position: () => {
    let [px, py] = global.get_pointer();
    return [{}, px, py];
  },
  warp: (screen, x, y) => {
    screen.simulated_pointer = [x, y];
  },
};

export const getPointer = () => {
  return pointer_wrapper;
};

export const warpPointer = (pointer, x, y, extension) => {
  pointer.warp(extension, x, y);
};

export const setTimeout = (func, delay, ...args) => {
  const wrappedFunc = () => {
    func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

export const setInterval = (func, delay, ...args) => {
  const wrappedFunc = () => {
    return func.apply(this, args) || true;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

export const clearTimeout = (id) => {
  GLib.source_remove(id);
};

export const clearInterval = (id) => {
  GLib.source_remove(id);
};

export const trySpawnCommandLine = function (cmd) {
  if (typeof cmd == 'string') {
    cmd = cmd.split(' ');
  }
  let [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(
    null,
    cmd,
    null,
    0,
    null
  );

  // let out_reader = new Gio.DataInputStream({
  //   base_stream: new Gio.UnixInputStream({ fd: out_fd }),
  // });

  // for (let i = 0; i < 100; i++) {
  //   let [line, size] = out_reader.read_line_utf8(null);
  //   if (line == null) break;
  //   console.log(line);
  // }
};
