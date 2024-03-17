// loosely based on JustPerfection & Blur-My-Shell
'use strict';

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

const GETTEXT_DOMAIN = 'dash2dock-light';

import { schemaId, SettingsKeys } from './preferences/keys.js';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// from Dock-to-Dock
const MonitorsConfig = GObject.registerClass(
  {
    Signals: {
      updated: {},
    },
  },
  class MonitorsConfig extends GObject.Object {
    static get XML_INTERFACE() {
      return '<node>\
            <interface name="org.gnome.Mutter.DisplayConfig">\
                <method name="GetCurrentState">\
                <arg name="serial" direction="out" type="u" />\
                <arg name="monitors" direction="out" type="a((ssss)a(siiddada{sv})a{sv})" />\
                <arg name="logical_monitors" direction="out" type="a(iiduba(ssss)a{sv})" />\
                <arg name="properties" direction="out" type="a{sv}" />\
                </method>\
                <signal name="MonitorsChanged" />\
            </interface>\
        </node>';
    }

    static get ProxyWrapper() {
      return Gio.DBusProxy.makeProxyWrapper(MonitorsConfig.XML_INTERFACE);
    }

    constructor() {
      super();

      this._monitorsConfigProxy = new MonitorsConfig.ProxyWrapper(
        Gio.DBus.session,
        'org.gnome.Mutter.DisplayConfig',
        '/org/gnome/Mutter/DisplayConfig'
      );

      // Connecting to a D-Bus signal
      this._monitorsConfigProxy.connectSignal('MonitorsChanged', () =>
        this._updateResources()
      );

      this._primaryMonitor = null;
      this._monitors = [];
      this._logicalMonitors = [];

      this._updateResources();
    }

    _updateResources() {
      this._monitorsConfigProxy.GetCurrentStateRemote((resources, err) => {
        if (err) {
          logError(err);
          return;
        }

        const [serial_, monitors, logicalMonitors] = resources;
        let index = 0;
        for (const monitor of monitors) {
          const [monitorSpecs, modes_, props] = monitor;
          const [connector, vendor, product, serial] = monitorSpecs;
          this._monitors.push({
            index: index++,
            active: false,
            connector,
            vendor,
            product,
            serial,
            displayName: props['display-name'].unpack(),
          });
        }

        for (const logicalMonitor of logicalMonitors) {
          const [x_, y_, scale_, transform_, isPrimary, monitorsSpecs] =
            logicalMonitor;

          // We only care about the first one really
          for (const monitorSpecs of monitorsSpecs) {
            const [connector, vendor, product, serial] = monitorSpecs;
            const monitor = this._monitors.find(
              (m) =>
                m.connector === connector &&
                m.vendor === vendor &&
                m.product === product &&
                m.serial === serial
            );

            if (monitor) {
              monitor.active = true;
              monitor.isPrimary = isPrimary;
              if (monitor.isPrimary) this._primaryMonitor = monitor;
              break;
            }
          }
        }

        const activeMonitors = this._monitors.filter((m) => m.active);
        if (activeMonitors.length > 1 && logicalMonitors.length === 1) {
          // We're in cloning mode, so let's just activate the primary monitor
          this._monitors.forEach((m) => (m.active = false));
          this._primaryMonitor.active = true;
        }

        this.emit('updated');
      });
    }

    get primaryMonitor() {
      return this._primaryMonitor;
    }

    get monitors() {
      return this._monitors;
    }
  }
);

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
        Gtk.show_uri(window, action.link, Gdk.CURRENT_TIME)
      );
      actionGroup.add_action(act);
    });

    // window.remove(menu_util);
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
    this._builder = builder;

    let UIFolderPath = `${this.path}/ui`;

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

    // this.dump(window, 0);

    let settings = this.getSettings(schemaId);
    settings.set_string('msg-to-ext', '');

    let settingsKeys = SettingsKeys();
    settingsKeys.connectBuilder(builder);
    settingsKeys.connectSettings(settings);

    this._settings = settings;

    this.addButtonEvents(window, builder, settings);
    this.addMenu(window, builder);

    builder.get_object('peek-hidden-icons-row').visible = false;

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

    this._monitorsConfig = new MonitorsConfig();
    this._monitorsConfig.connect('updated', () => this.updateMonitors());
    // settings.connect('changed::preferred-monitor', () => this.updateMonitors());

    this.updateMonitors();
  }

  // updateMonitors() {
  //   let monitors = this._monitorsConfig.monitors;
  //   let count = monitors.length;
  //   // let count = this._settings.get_int('monitor-count') || 1;
  //   const monitors_model = this._builder.get_object('preferred-monitor-model');
  //   monitors_model.splice(count, 6 - count, []);
  // }

  updateMonitors() {
    let model = this._builder.get_object('preferred-monitor-model');
    let model_count = model.get_n_items();
    model.splice(0, model_count, []);
    let monitors = this._monitorsConfig.monitors;
    let count = monitors.length;
    model.append(`Primary Display`);
    for (let i = 0; i < count; i++) {
      if (model.get_n_items() >= count) break;
      let name = monitors[i];
      model.append(name.displayName);
    }
  }
}
