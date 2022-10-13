// loosely based on JustPerfection & Blur-My-Shell

const { Adw, Gdk, GLib, Gtk, GObject, Gio, Pango } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { SettingsKeys } = Me.imports.preferences.keys;
const UIFolderPath = Me.dir.get_child('ui').get_path();

const Gettext = imports.gettext.domain('dash2dock-lite');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;

const { schemaId, settingsKeys } = Me.imports.preferences.keys;

function init() {
  ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
  var notebook = new Gtk.Notebook();

  let builder = new Gtk.Builder();
  builder.add_from_file(`${UIFolderPath}/legacy/general.ui`);
  builder.add_from_file(`${UIFolderPath}/legacy/appearance.ui`);
  notebook.append_page(
    builder.get_object('general'),
    new Gtk.Label({ label: _('General') })
  );
  notebook.append_page(
    builder.get_object('appearance'),
    new Gtk.Label({ label: _('Appearance') })
  );

  SettingsKeys.connectSignals(builder);
  SettingsKeys.connectSettings(ExtensionUtils.getSettings(schemaId));
  return notebook;
}

function fillPreferencesWindow(window) {
  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(`${UIFolderPath}/icons`);

  let builder = new Gtk.Builder();
  builder.add_from_file(`${UIFolderPath}/general.ui`);
  builder.add_from_file(`${UIFolderPath}/appearance.ui`);
  window.add(builder.get_object('general'));
  window.add(builder.get_object('appearance'));

  SettingsKeys.connectSignals(builder);
  SettingsKeys.connectSettings(ExtensionUtils.getSettings(schemaId));
}
