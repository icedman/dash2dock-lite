#!/usr/bin/gjs

const { Adw, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;
const Cairo = imports.cairo;

Gtk.init();

let app = new Gtk.Application({
  application_id: 'com.dash2dock-lite.GtkApplication',
});

app.connect('activate', (me) => {
  m = new Gtk.ApplicationWindow({ application: me });
  m.set_default_size(600, 250);
  m.set_title('Prefs Test');

  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path('ui/icons');

  w = new Gtk.Window();
  notebook = new Gtk.Notebook();
  w.set_child(notebook);
  w.set_size_request(600, 600);

  w.title = 'main';
  w.connect('close_request', () => {
    m.close();
    app.quit();
  });
  w.show();

  // m.present();
});

app.connect('startup', () => {});

app.run(['xx']);
