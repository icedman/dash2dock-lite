#!/usr/bin/gjs

const { Adw, Gio, GLib, GObject, Gtk, Pango } = imports.gi;

let app = new Adw.Application({
  application_id: 'com.dash2dock-lite.GtkApplication',
});
app.connect('activate', () => {
  m = new Gtk.ApplicationWindow({ application: app });
  m.set_default_size(600, 250);
  m.set_title('Prefs Test');

  w = new Adw.PreferencesWindow();
  // w.add(new Adw.PreferencesPage());

  let builder = new Gtk.Builder();
  builder.add_from_file(`ui/general.ui`);
  builder.add_from_file(`ui/main.ui`);
  w.add(builder.get_object('general'));
  w.add(builder.get_object('main'));

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
