// loosely based on JustPerfection & Blur-My-Shell

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

const GETTEXT_DOMAIN = 'dash2dock-light';

import { schemaId, SettingsKeys } from './preferences/keys.js';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class Preferences extends ExtensionPreferences {
  constructor(metadata) {
    super(metadata);

    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    let UIFolderPath = `${this.dir.get_path()}/ui`;
    iconTheme.add_search_path(`${UIFolderPath}/icons`);
    // ExtensionUtils.initTranslations();
  }

  updateMonitors(window, builder, settings) {
    // monitors (use dbus?)
    let count = settings.get_int('monitor-count') || 1;
    const monitors_model = builder.get_object('preferred-monitor-model');
    monitors_model.splice(count, 6 - count, []);
  }

  find(n, name) {
    if (n.get_name() == name) {
      return n;
    }
    let c = n.get_first_child();
    while (c) {
      let cn = this.find(c, name);
      if (cn) {
        return cn;
      }
      c = c.get_next_sibling();
    }
    return null;
  }

  dump(n, l) {
    let s = '';
    for (let i = 0; i < l; i++) {
      s += ' ';
    }
    print(`${s}${n.get_name()}`);
    let c = n.get_first_child();
    while (c) {
      this.dump(c, l + 1);
      c = c.get_next_sibling();
    }
  }

  addMenu(window, builder) {
    let menu_util = builder.get_object('menu_util');
    window.add(menu_util);

    let headerbar = this.find(window, 'AdwHeaderBar');
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

    window.remove(menu_util);
  }

  addButtonEvents(window, builder, settings) {
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

  fillPreferencesWindow(window) {
    let builder = new Gtk.Builder();

    let UIFolderPath = `${this.dir.get_path()}/ui`;

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

    let settings = this.getSettings(schemaId);
    settings.set_string('msg-to-ext', '');

    let settingsKeys = SettingsKeys();
    settingsKeys.connectBuilder(builder);
    settingsKeys.connectSettings(settings);

    this.addButtonEvents(window, builder, settings);
    this.updateMonitors(window, builder, settings);
    this.addMenu(window, builder);

    let toggle_experimental = () => {
      let exp = false; // settingsKeys.getValue('experimental-features');
      // builder.get_object('dock-location-row').visible = exp;
      builder.get_object('lamp-app-animation-row').visible = exp;
      builder.get_object('self-test-row').visible = exp;
    };

    settings.connect('changed::experimental-features', () => {
      toggle_experimental();
    });

    toggle_experimental();
  }
}
