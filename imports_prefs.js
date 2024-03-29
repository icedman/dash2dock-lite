function init() {
  ExtensionUtils.initTranslations();
  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(`${Me.dir.get_path()}/ui/icons`);
}

function fillPreferencesWindow(window) {
  let p = new Preferences();
  p.path = Me.dir.get_path();
  p.fillPreferencesWindow(window);
}
