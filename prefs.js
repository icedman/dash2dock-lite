// loosely based on JustPerfection & Blur-My-Shell

const { Adw, Gdk, GLib, Gtk, GObject, Gio, Pango } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const UIFolderPath = Me.dir.get_child('ui').get_path();

const Gettext = imports.gettext.domain('dash2dock-lite');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;

const { schemaId, SettingsKeys } = Me.imports.preferences.keys;

function init() {
  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(`${UIFolderPath}/icons`);
  ExtensionUtils.initTranslations();
}

function updateMonitors(window, builder, settings) {
  // monitors (use dbus?)
  let count = settings.get_int('monitor-count') || 1;
  const monitors_model = builder.get_object('preferred-monitor-model');
  monitors_model.splice(count, 6 - count, []);
}

function find(n, name) {
  if (n.get_name() == name) {
    return n;
  }
  let c = n.get_first_child();
  while (c) {
    let cn = find(c, name);
    if (cn) {
      return cn;
    }
    c = c.get_next_sibling();
  }
  return null;
}

function dump(n, l) {
  let s = '';
  for (let i = 0; i < l; i++) {
    s += ' ';
  }
  print(`${s}${n.get_name()}`);
  let c = n.get_first_child();
  while (c) {
    dump(c, l + 1);
    c = c.get_next_sibling();
  }
}

function addMenu(window, builder) {
  // let menu_util = builder.get_object('menu_util');
  // window.add(menu_util);

  // const page = builder.get_object('menu_util');
  // const pages_stack = page.get_parent(); // AdwViewStack
  // const content_stack = pages_stack.get_parent().get_parent(); // GtkStack
  // const preferences = content_stack.get_parent(); // GtkBox
  // const headerbar = preferences.get_first_child(); // AdwHeaderBar
  // headerbar.pack_start(builder.get_object('info_menu'));

  let headerbar = this.find(window, 'AdwHeaderBar');
  if (!headerbar) {
    return;
  }
  headerbar.pack_start(builder.get_object('info_menu'));

  // setup menu actions
  const actionGroup = new Gio.SimpleActionGroup();
  window.insert_action_group('prefs', actionGroup);

  // a list of actions with their associated link
  const actions = [
    {
      name: 'open-bug-report',
      link: 'https://github.com/icedman/dash2dock-lite/issues',
    },
    {
      name: 'open-readme',
      link: 'https://github.com/icedman/dash2dock-lite',
    },
    {
      name: 'open-license',
      link: 'https://github.com/icedman/dash2dock-lite/blob/master/LICENSE',
    },
  ];

  actions.forEach((action) => {
    let act = new Gio.SimpleAction({ name: action.name });
    act.connect('activate', (_) =>
      Gtk.show_uri(window, action.link, Gdk.CURRENT_TIME)
    );
    actionGroup.add_action(act);
  });

  // window.remove(menu_util);
}

function addButtonEvents(window, builder, settings) {
  // builder.get_object('static-animation').connect('clicked', () => {
  //   builder.get_object('animation-spread').set_value(0);
  //   builder.get_object('animation-rise').set_value(0);
  //   builder.get_object('animation-magnify').set_value(0);
  // });

  if (builder.get_object('self-test')) {
    builder.get_object('self-test').connect('clicked', () => {
      settings.set_string('msg-to-ext', 'this.runDiagnostics()');
    });
  }
}

function buildPrefsWidget() {
  let notebook = new Gtk.Notebook();

  let builder = new Gtk.Builder();
  builder.add_from_file(`${UIFolderPath}/legacy/general.ui`);
  builder.add_from_file(`${UIFolderPath}/legacy/appearance.ui`);
  builder.add_from_file(`${UIFolderPath}/legacy/tweaks.ui`);
  builder.add_from_file(`${UIFolderPath}/legacy/others.ui`);
  builder.add_from_file(`${UIFolderPath}/menu.ui`);
  notebook.append_page(
    builder.get_object('general'),
    new Gtk.Label({ label: _('General') })
  );
  notebook.append_page(
    builder.get_object('appearance'),
    new Gtk.Label({ label: _('Appearance') })
  );
  notebook.append_page(
    builder.get_object('tweaks'),
    new Gtk.Label({ label: _('Tweaks') })
  );
  notebook.append_page(
    builder.get_object('others'),
    new Gtk.Label({ label: _('Others') })
  );

  let settings = ExtensionUtils.getSettings(schemaId);
  SettingsKeys.connectBuilder(builder);
  SettingsKeys.connectSettings(settings);

  notebook.connect('realize', () => {
    let gtkVersion = Gtk.get_major_version();
    let w = gtkVersion === 3 ? notebook.get_toplevel() : notebook.get_root();
    addButtonEvents(w, builder, settings);
    addMenu(w, builder);
    updateMonitors(w, builder, settings);
  });
  return notebook;
}

function fillPreferencesWindow(window) {
  let builder = new Gtk.Builder();

  builder.add_from_file(`${UIFolderPath}/general.ui`);
  builder.add_from_file(`${UIFolderPath}/appearance.ui`);
  builder.add_from_file(`${UIFolderPath}/tweaks.ui`);
  builder.add_from_file(`${UIFolderPath}/others.ui`);
  builder.add_from_file(`${UIFolderPath}/menu.ui`);
  window.add(builder.get_object('general'));
  window.add(builder.get_object('appearance'));
  window.add(builder.get_object('tweaks'));
  window.add(builder.get_object('others'));
  window.set_search_enabled(true);

  let settings = ExtensionUtils.getSettings(schemaId);
  settings.set_string('msg-to-ext', '');

  SettingsKeys.connectBuilder(builder);
  SettingsKeys.connectSettings(settings);

  addButtonEvents(window, builder, settings);
  updateMonitors(window, builder, settings);
  addMenu(window, builder);

  function toggle_experimental() {
    let exp = false; // SettingsKeys.getValue('experimental-features');
    builder.get_object('dock-location-row').visible = exp;
    builder.get_object('self-test-row').visible = exp;
  }

  settings.connect('changed::experimental-features', () => {
    toggle_experimental();
  });

  toggle_experimental();
}
