'use strict';

const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Fav = imports.ui.appFavorites;
const Weather = imports.misc.weather;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const AppsFolderPath = Me.dir.get_child('apps').get_path();

const Clock = Me.imports.apps.clock.Clock;
const Calendar = Me.imports.apps.calendar.Calendar;

// sync with animator
const CANVAS_SIZE = 120;

class ServiceCounter {
  constructor(name, interval, callback, advance) {
    advance = advance || 0;
    this.name = name;
    this._interval = interval;
    this._ticks = advance == -1 ? interval : advance;
    this._callback = callback;
  }

  update(elapsed) {
    this._ticks += elapsed;
    if (this._ticks >= this._interval) {
      this._ticks -= this._interval;
      if (this._callback) {
        this._callback();
      }
      return true;
    }
    return false;
  }
}

var Services = class {
  enable() {
    this._services = [
      new ServiceCounter('trash', 1000 * 15, this.checkTrash.bind(this)),
      new ServiceCounter(
        'clock',
        1000 * 60,
        () => {
          if (this.clock) {
            this.clock.redraw();
          }
        },
        -1
      ),
      new ServiceCounter(
        'calendar',
        1000 * 60 * 15,
        () => {
          if (this.calendar) {
            this.calendar.redraw();
          }
        },
        -1
      ),
      new ServiceCounter(
        'ping',
        1000 * 5,
        () => {
          // deferred stuff is required when .desktop entry if first created
          // check for deferred mounts
          if (this._deferredMounts && this._deferredMounts.length) {
            let mounts = [...this._deferredMounts];
            this._deferredMounts = [];
            mounts.forEach((m) => {
              this._onMountAdded(null, m);
            });
          }

          // check for deferred trash
          if (!this._trashIconSetup) {
            this.setupTrashIcon();
          }
          if (this._deferredTrash) {
            this.updateTrashIcon(true);
            this._deferredTrash = false;
          }

          // notifications
          this.checkNotifications();
        },
        0
      ),
    ];

    this._disableNotifications = 0;

    this._deferredMounts = [];
    this._deferredTrash = false;
    this._volumeMonitor = Gio.VolumeMonitor.get();
    this._volumeMonitor.connectObject(
      'mount-added',
      this._onMountAdded.bind(this),
      'mount-removed',
      this._onMountRemoved.bind(this),
      this
    );

    this._trashDir = Gio.File.new_for_uri('trash:///');
    this._trashMonitor = this._trashDir.monitor(
      Gio.FileMonitorFlags.WATCH_MOVES,
      null
    );
    this._trashMonitor.connectObject(
      'changed',
      (fileMonitor, file, otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.MOVED_IN:
            return;
        }
        this.checkTrash();
      },
      this
    );

    this.checkMounts();
    this.checkTrash();
    this.checkNotifications();
  }

  disable() {
    this._services = [];

    this._volumeMonitor.disconnectObject(this);
    this._volumeMonitor = null;
    this._trashMonitor.disconnectObject(this);
    this._trashMonitor = null;
    this._trashDir = null;
  }

  temporarilyMuteOverview() {
    if (!Main.overview._setMessage) {
      Main.overview._setMessage = Main.overview.setMessage;
    }
    Main.overview.setMessage = (msg, obj) => {};

    this.extension._loTimer.runOnce(() => {
      Main.overview.setMessage = Main.overview._setMessage;
    }, 750);
  }

  _onMountAdded(monitor, mount) {
    if (!this.extension.mounted_icon) {
      return false;
    }

    this.last_mounted = mount;
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this.setupMountIcon(mount);
    let favorites = Fav.getAppFavorites();
    let favorite_ids = favorites._getIds();

    this.temporarilyMuteOverview();
    favorites.addFavoriteAtPos(
      appname,
      this.extension.trash_icon ? favorite_ids.length - 1 : -1
    );
    this.extension.animate();

    // re-try later
    if (!favorite_ids.includes(appname)) {
      this._deferredMounts.push(mount);
    }
    return true;
  }

  _onMountRemoved(monitor, mount) {
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this._unpin(appname);
  }

  update(elapsed) {
    this._services.forEach((s) => {
      s.update(elapsed);
    });
  }

  setupMountIcon(mount) {
    let basename = mount.get_default_location().get_basename();
    let label = mount.get_name();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let fullpath = mount.get_default_location().get_path();
    let icon = mount.get_icon().names[0] || 'drive-harddisk-solidstate';
    let mount_exec = 'echo "not implemented"';
    let unmount_exec = `umount ${fullpath}`;
    let fn = Gio.File.new_for_path(`.local/share/applications/${appname}`);

    if (!fn.query_exists(null)) {
      let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${label}\nExec=xdg-open ${fullpath}\nIcon=${icon}\nStartupWMClass=mount-${basename}-dash2dock-lite\nActions=unmount;\n\n[Desktop Action mount]\nName=Mount\nExec=${mount_exec}\n\n[Desktop Action unmount]\nName=Unmount\nExec=${unmount_exec}\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
      Main.notify('Preparing the mounted device icon...');
      this._deferredMounts.push(mount);
    }
  }

  checkNotifications() {
    if (this._disableNotifications > 4) return;

    let media;
    let messages;

    try {
      let tryBox = [
        Main.panel._centerBox,
        Main.panel._leftBox,
        Main.panel._rightBox,
      ];
      for (let i = 0; i < 3; i++) {
        let cc = tryBox[i].get_children();
        cc.forEach((c) => {
          if (media && messages) {
            return;
          }
          media =
            c.child._delegate._messageList._scrollView.last_child.get_children()[0];
          messages =
            c.child._delegate._messageList._scrollView.last_child.get_children()[1];
        });
        if (media && messages) {
          break;
        }
      }
    } catch (err) {
      // fail silently - don't crash
      log(err);
      this._disableNotifications++;
    }

    if (!media || !messages) {
      return;
    }

    this._notifications = messages._messages || [];
    if (!this._notifications.length) {
      this._notifications = [];
    }

    this._appNotices = this._appNotices || {};

    Object.keys(this._appNotices).forEach((k) => {
      this._appNotices[k].previous = this._appNotices[k].count;
      this._appNotices[k].count = 0;
    });

    let app_map = {
      'org.gnome.Evolution-alarm-notify.desktop': 'org.gnome.Calendar.desktop',
    };

    this._notifications.forEach((n) => {
      let appId = null;
      if (!n.notification) return;
      if (n.notification.source.app) {
        appId = n.notification.source.app.get_id();
      }
      if (!appId && n.notification.source._app) {
        appId = n.notification.source._app.get_id();
      }
      if (!appId) {
        appId = n.notification.source._appId;
      }
      if (!appId) {
        appId = '?';
      }

      // remap
      appId = app_map[appId] || appId;

      if (!this._appNotices[appId]) {
        this._appNotices[appId] = {
          count: 0,
          previous: 0,
          urgency: 0,
          source: n.notification.source,
        };
      }
      this._appNotices[appId].count++;
      if (this._appNotices[appId].urgency < n.notification.urgency) {
        this._appNotices[appId].urgency = n.notification.urgency;
      }
      this._appNotices[`${appId}`] = this._appNotices[appId];
      if (!appId.endsWith('desktop')) {
        this._appNotices[`${appId}.desktop`] = this._appNotices[appId];
      }
    });

    let hasUpdates = false;
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].previous != this._appNotices[k].count) {
        hasUpdates = true;
      }
    });

    let update = {};
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].count > 0) {
        update[k] = this._appNotices[k];
      }
    });
    this._appNotices = update;

    if (hasUpdates) {
      this.extension.animate();
    }
  }

  checkTrash() {
    if (!this.extension.trash_icon) return;

    let iter = this._trashDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    this.trashFull = iter.next_file(null) != null;
    iter = null;
    return this.trashFull;
  }

  checkMounts() {
    if (!this.extension.mounted_icon) {
      return;
    }

    let mounts = [];
    let mount_ids = [];
    if (this.extension.mounted_icon) {
      mounts = this._volumeMonitor.get_mounts();
      mount_ids = mounts.map((mount) => {
        let basename = mount.get_default_location().get_basename();
        let appname = `mount-${basename}-dash2dock-lite.desktop`;
        return appname;
      });
    }

    this.mounts = mounts;
    let favs = Fav.getAppFavorites()._getIds();
    favs.forEach((fav) => {
      if (fav.startsWith('mount-') && fav.endsWith('dash2dock-lite.desktop')) {
        if (!mount_ids.includes(fav)) {
          this._unpin(fav);
        }
      }
    });

    mounts.forEach((mount) => {
      let basename = mount.get_default_location().get_basename();
      let appname = `mount-${basename}-dash2dock-lite.desktop`;
      if (!favs.includes(appname)) {
        this._deferredMounts.push(mount);
      }
    });

    // added devices will subsequently be on mounted events
  }

  setupTrashIcon() {
    if (!this.extension.trash_icon) {
      return;
    }
    let fn = Gio.File.new_for_path(
      '.local/share/applications/trash-dash2dock-lite.desktop'
    );

    if (!fn.query_exists(null)) {
      let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=xdg-open trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash\n\n[Desktop Action trash]\nName=Empty Trash\nExec=${AppsFolderPath}/empty-trash.sh\nTerminal=true\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
      Main.notify('Preparing the trash icon...');
      this._deferredTrash = true;
      this._trashIconSetup = true;
    }
    fn = null;
  }

  _pin(app) {
    let favorites = Fav.getAppFavorites();
    if (!favorites._getIds().includes(app)) {
      this.temporarilyMuteOverview();
      favorites.addFavorite(app);
      this.extension.animate();
    }
  }

  _unpin(app) {
    let favorites = Fav.getAppFavorites();
    if (favorites._getIds().includes(app)) {
      // thread safety hack
      this.extension.animator._endAnimation();
      this.extension.animator._previousFind = null;
      this.extension.animator._throttleDown = 19;

      this.temporarilyMuteOverview();
      favorites.removeFavorite(app);

      this.extension.animate();
    }
  }

  updateTrashIcon(show) {
    if (show) {
      this._pin('trash-dash2dock-lite.desktop');
    } else {
      this._unpin('trash-dash2dock-lite.desktop');
    }
  }

  redraw() {
    let widgets = [this.clock, this.calendar];
    widgets.forEach((w) => {
      if (w) {
        w.settings = {
          dark_color: this.extension.drawing_dark_color,
          light_color: this.extension.drawing_light_color,
          accent_color: this.extension.drawing_accent_color,
          dark_foreground: this.extension.drawing_dark_foreground,
          light_foreground: this.extension.drawing_light_foreground,
          secondary_color: this.extension.drawing_secondary_color,
          clock_style: this.extension.clock_style,
        };
        w.redraw();
      }
    });
  }

  updateIcon(icon, settings) {
    if (!icon || !icon.icon_name) {
      return;
    }

    let { scaleFactor } = settings;
    // monitor scale
    // this.scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

    // the trash
    if (this.extension.trash_icon && icon.icon_name.startsWith('user-trash')) {
      let new_icon = this.trashFull ? 'user-trash-full' : 'user-trash';
      if (new_icon != icon.icon_name) {
        icon.icon_name = new_icon;
      }
    }

    let didCreate = false;

    // clock
    if (icon.icon_name == 'org.gnome.clocks') {
      let p = icon.get_parent();
      if (this.extension.clock_icon) {
        if (!p.clock) {
          let clock = new Clock(CANVAS_SIZE);
          clock.visible = false;
          clock.reactive = false;
          this.clock = clock;
          p.clock = this.clock;
          didCreate = true;
        }
        if (p.clock) {
          p.clock._icon = icon;
          let scale =
            icon.icon_size / this.extension.icon_quality / CANVAS_SIZE;
          scale *= scaleFactor;
          p.clock.set_scale(scale, scale);
          p.clock.show();
          p.clock.reactive = false;

          let pp = this.clock.get_parent();
          if (pp != p) {
            pp?.remove_child(p);
            p.add_child(this.clock);
          }
        }
      } else {
        if (p.clock) {
          p.clock.hide();
        }
      }
    }

    // calendar
    if (icon.icon_name == 'org.gnome.Calendar') {
      let p = icon.get_parent();
      if (this.extension.calendar_icon) {
        if (!p.calendar) {
          let calendar = new Calendar(CANVAS_SIZE);
          calendar.visible = false;
          calendar.reactive = false;
          this.calendar = calendar;
          p.calendar = this.calendar;
          didCreate = true;
        }
        if (p.calendar) {
          let scale =
            icon.icon_size / this.extension.icon_quality / CANVAS_SIZE;
          scale *= scaleFactor;
          p.calendar.set_scale(scale, scale);
          p.calendar.show();
          p.calendar.reactive = false;
          let pp = this.calendar.get_parent();
          if (pp != p) {
            pp?.remove_child(p);
            p.add_child(this.calendar);
          }
        }
      } else {
        if (p.calendar) {
          p.calendar.hide();
        }
      }
    }

    if (didCreate) {
      this.redraw();
    }
  }
};
