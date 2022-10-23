#!/usr/bin/gjs

const { Adw, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;

Gtk.init();

let count = 1;

try {
  let tmp = Gio.File.new_for_path(
    `${GLib.get_tmp_dir()}/monitors.dash2dock-lite`
  );
  const [, contents, etag] = tmp.load_contents(null);
  count = Number(countents);
} catch (err) {
  // fail silently
}
print(count);

// gdk.get_default_root_window().get_screen().get_n_monitors()

// let n = Object.keys(Gdk.Display);
// n.forEach((k)=> {
//   if (!k.startsWith('KEY')) {
//     print(k);
//   }
// });

// let d = Gdk.Display.get_default();
// Object.keys(d).forEach((k)=> {
//   if (!k.startsWith('KEY')) {
//     print(k);
//   }
// });
