'use strict';

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

// from Dash-to-Dock
export const MonitorsConfig = GObject.registerClass(
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
        '/org/gnome/Mutter/DisplayConfig',
      );

      // Connecting to a D-Bus signal
      this._monitorsConfigProxy.connectSignal('MonitorsChanged', () =>
        this._updateResources(),
      );

      this._updateResources();
    }

    _updateResources() {
      this._primaryMonitor = null;
      this._monitors = [];
      this._logicalMonitors = [];
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
                m.serial === serial,
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

        // console.log(this._monitors);
        // console.log(this._logicalMonitors);
        this.emit('updated');
      });
    }

    get primaryMonitor() {
      return this._primaryMonitor;
    }

    get monitors() {
      return this._monitors;
    }
  },
);
