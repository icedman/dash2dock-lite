const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

function test() {
  let r = Gtk.RecentManager.get_default();
  let items = r.get_items();

  items.forEach((item) => {
    if (item.exists()) {
      const uri = item.get_uri();
      const file = Gio.File.new_for_uri(uri);
      const fileInfo = file.query_info(
        'standard::*,unix::uid',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        null,
      );
      const icon = fileInfo.get_icon().get_names()[0] ?? 'folder';
      console.log(`|${file.get_path()}|${icon}`);
    }
  });
}

test();
