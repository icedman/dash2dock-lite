// loosely based on JustPerfection & Blur-My-Shell
'use strict';

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';

const GETTEXT_DOMAIN = 'dash2dock-light';

import { schemaId, SettingsKeys } from './preferences/keys.js';
import { MonitorsConfig } from './monitors.js';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { tempPath } from './utils.js';

export default class Preferences extends ExtensionPreferences {
  constructor(metadata) {
    super(metadata);

    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    let UIFolderPath = `${this.path}/ui`;
    iconTheme.add_search_path(`${UIFolderPath}/icons`);
    // ExtensionUtils.initTranslations();
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
    // let menu_util = builder.get_object('menu_util');
    // window.add(menu_util);

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
        name: 'open-buy-coffee',
        link: 'https://www.buymeacoffee.com/icedman',
      },
      {
        name: 'open-license',
        link: 'https://github.com/icedman/dash2dock-lite/blob/master/LICENSE',
      },
    ];

    actions.forEach((action) => {
      let act = new Gio.SimpleAction({ name: action.name });
      act.connect('activate', (_) =>
        Gtk.show_uri(window, action.link, Gdk.CURRENT_TIME),
      );
      actionGroup.add_action(act);
    });

    // window.remove(menu_util);
  }

  updateFolders(window, builder, settings) {
    let row = builder.get_object('downloads-folder-row');
    let val = settings.get_string('downloads-path') || '';
    console.log(`=======${val}`);
    row.title = `${val}`;
  }

  async selectFolder(window, builder, settings, target) {
    const dialog = new Gtk.FileDialog();
    dialog.select_folder(window, null, (dialog, task) => {
      let folder = dialog.select_folder_finish(task);
      if (folder instanceof Gio.File) {
        let path = folder.get_path();
        console.log(`${target} = ${path}`);
        settings.set_string(target, path);
        this.updateFolders(window, builder, settings);
      } else {
        console.log('No valid folder selected.');
      }
    });
    return null;
  }

  addButtonEvents(window, builder, settings) {
    // builder.get_object('static-animation').connect('clicked', () => {
    //   builder.get_object('animation-spread').set_value(0);
    //   builder.get_object('animation-rise').set_value(0);
    //   builder.get_object('animation-magnify').set_value(0);
    // });

    if (builder.get_object('downloads-folder')) {
      builder.get_object('downloads-folder').connect('clicked', () => {
        settings.set_string('downloads-path', '');
        this.selectFolder(window, builder, settings, 'downloads-path')
          .then((path) => {
            console.log(path);
          })
          .catch((err) => {
            console.log(err);
          });
      });
      this.updateFolders(window, builder, settings);
    }

    if (builder.get_object('reset')) {
      builder.get_object('reset').connect('clicked', () => {
        settings.list_keys().forEach((k) => {
          settings.reset(k);
        });
      });
    }

    if (builder.get_object('self-test')) {
      builder.get_object('self-test').connect('clicked', () => {
        settings.set_string('msg-to-ext', 'this.runDiagnostics()');
      });
    }
  }

  fillPreferencesWindow(window) {
    // console.log(`>>${window.get_content()}`);
    let builder = new Gtk.Builder();
    this._builder = builder;

    let UIFolderPath = `${this.path}/ui`;
    builder.add_from_file(`${UIFolderPath}/general.ui`);
    builder.add_from_file(`${UIFolderPath}/appearance.ui`);
    builder.add_from_file(`${UIFolderPath}/tweaks.ui`);
    builder.add_from_file(`${UIFolderPath}/others.ui`);
    builder.add_from_file(`${UIFolderPath}/menu.ui`);
    window.add(builder.get_object('general'));
    window.add(builder.get_object('appearance'));
    window.add(builder.get_object('others'));
    window.add(builder.get_object('tweaks'));
    window.set_search_enabled(true);

    // this.dump(window, 0);
    // add buymeacoffee QR
    if (builder.get_object('qr')) {
      builder
        .get_object('qr')
        .set_from_file(`${UIFolderPath}/images/qr_icedman.png`);
    }

    let settings = this.getSettings(schemaId);
    settings.set_string('msg-to-ext', '');

    let settingsKeys = SettingsKeys();
    settingsKeys.connectBuilder(builder);
    settingsKeys.connectSettings(settings);

    this._settings = settings;

    this.addButtonEvents(window, builder, settings);
    this.addMenu(window, builder);

    if (builder.get_object('peek-hidden-icons-row')) {
      builder.get_object('peek-hidden-icons-row').visible = false;
    }

    let toggle_experimental = () => {
      let exp = false; // settingsKeys.getValue('experimental-features');
      // builder.get_object('dock-location-row').visible = exp;
      if (builder.get_object('lamp-app-animation-row')) {
        builder.get_object('lamp-app-animation-row').visible = exp;
      }
      if (builder.get_object('self-test-row')) {
        builder.get_object('self-test-row').visible = exp;
      }
    };

    settings.connect('changed::experimental-features', () => {
      toggle_experimental();
    });

    toggle_experimental();

    this._monitorsConfig = new MonitorsConfig();
    this._monitorsConfig.connect('updated', () => this.updateMonitors());
    // settings.connect('changed::preferred-monitor', () => this.updateMonitors());

    this._themed_presets = [];
    this.preloadPresets(`${this.path}/themes`);
    this.preloadPresets(
      Gio.File.new_for_path('.config/d2da/themes').get_path(),
    );
    this._buildThemesMenu(window);
    this.updateMonitors();

    this.window = window;
  }

  preloadPresets(themes_path) {
    let dir = Gio.File.new_for_path(themes_path);
    if (!dir.query_exists(null)) {
      return;
    }
    let iter = dir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null,
    );

    let themed_presets = [];
    let f = iter.next_file(null);
    while (f) {
      let fn = Gio.File.new_for_path(`${themes_path}/${f.get_name()}`);
      if (fn.query_exists(null)) {
        const [success, contents] = fn.load_contents(null);
        const decoder = new TextDecoder();
        let contentsString = decoder.decode(contents);
        let json = JSON.parse(contentsString);
        if (json && json['meta'] && json['meta']['title']) {
          themed_presets.push(json);
        }
      }
      f = iter.next_file(null);
    }
    this._themed_presets = [...this._themed_presets, ...themed_presets];
  }

  _buildThemesMenu(window) {
    this._themed_presets.push({ meta: { title: 'Export...' } });

    const actionGroup = new Gio.SimpleActionGroup();
    window.insert_action_group('themes', actionGroup);

    let theme = this._builder.get_object('theme');
    if (!theme) return;
    let model = new Gio.Menu();
    let idx = 0;
    this._themed_presets.forEach((m) => {
      let action_name = `set_theme-${idx}`;
      let act = new Gio.SimpleAction({ name: action_name });
      act.connect('activate', (_) => {
        let index = action_name.split('-')[1];
        this.loadPreset(parseInt(index));
      });
      actionGroup.add_action(act);
      model.append(m['meta']['title'], `themes.${action_name}`);
      idx++;
    });
    theme.set_menu_model(model);
  }

  loadPreset(i) {
    let settingsKeys = SettingsKeys();
    settingsKeys.connectSettings(this._settings);
    if (i == this._themed_presets.length - 1) {
      // export
      let keys = settingsKeys.keys();
      let json = {};
      Object.keys(keys).forEach((n) => {
        let k = keys[n];
        if (k.themed) {
          json[n] = settingsKeys.getValue(n);
        }
      });

      json['meta'] = {
        title: 'My Theme',
      };

      let fn = Gio.File.new_for_path(tempPath('theme.json'));
      let content = JSON.stringify(json, null, 4);
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );

      this.window.add_toast(
        new Adw.Toast({ title: `Saved to ${tempPath('theme.json')}` }),
      );

      this._builder.get_object('theme-export-notice').visible = true;
      return;
    }

    let p = this._themed_presets[i];
    if (!p['meta'] || !p['meta']['title']) {
      return;
    }

    Object.keys(p).forEach((k) => {
      let v = p[k];
      let def = settingsKeys.getKey(k);
      if (!def) return;
      switch (def.widget_type) {
        case 'color':
          this._settings.set_value(k, new GLib.Variant('(dddd)', v));
          break;
        case 'switch':
          this._settings.set_boolean(k, v);
          break;
        case 'dropdown':
          this._settings.set_int(k, v);
          break;
      }
    });

    // settingsKeys.connectBuilder(this._builder);
    settingsKeys._builder = this._builder;
    settingsKeys.connectSettings(this._settings);

    this.window.add_toast(new Adw.Toast({ title: `${p['meta']['title']}` }));
  }

  updateMonitors() {
    let monitors = this._monitorsConfig.monitors;
    let count = monitors.length;
    let list = new Gtk.StringList();
    list.append('Primary Monitor');
    for (let i = 0; i < count; i++) {
      let m = monitors[i];
      if (!m.active) continue;
      list.append(m.displayName);
    }
    this._builder.get_object('preferred-monitor').set_model(list);
  }
}
