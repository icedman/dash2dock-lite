const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Fav = imports.ui.appFavorites;
const Weather = imports.misc.weather;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const AppsFolderPath = Me.dir.get_child('apps').get_path();

const setTimeout = Me.imports.utils.setTimeout;
const setInterval = Me.imports.utils.setInterval;

const xClock = Me.imports.apps.clock.xClock;
const xCalendar = Me.imports.apps.calendar.xCalendar;

// sync with animator
const ANIM_ICON_QUALITY = 2.0;
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
      new ServiceCounter('mounts', 1000 * 10, this.checkMounts.bind(this)),
      new ServiceCounter(
        'mounts_recheck',
        1000 * 60 * 2,
        () => {
          this._mounts_checked = false;
        },
        Math.floor(1000 * 60 * 1.8)
      ),
    ];

    this._deferred_mounts = [];
    this._deferred_trash_icon_show = false;
    this._volumeMonitor = Gio.VolumeMonitor.get();
    this._volumeMonitor.connectObject(
      'mount-added',
      this._onMountAdded.bind(this),
      'mount-removed',
      this._onMountRemoved.bind(this),
      this
    );

    this.checkMounts();
    this.checkTrash();
    this._checkTrashEmpty(); // << this actually reads the directory for files
  }

  disable() {
    this._volumeMonitor.disconnectObject(this);
    this._services = [];

    this.fnTrashDir = null;
    this.fnTrashMonitor = null;

    if (this._oneShotId) {
      clearInterval(this._oneShotId);
      this._oneShotId = null;
    }
  }

  temporarilyMuteOverview() {
    if (!Main.overview._setMessage) {
      Main.overview._setMessage = Main.overview.setMessage;
    }
    Main.overview.setMessage = (msg, obj) => {};

    this._oneShotId = setTimeout(() => {
      Main.overview.setMessage = Main.overview._setMessage;
      this._oneShotId = null;
    }, 1000);
  }

  _onMountAdded(monitor, mount) {
    if (!this.extension.mounted_icon) {
      return;
    }
    this.last_mounted = mount;
    this._mountTickCounter = 0;
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this.setupMountIcon(mount);
    let favorites = Fav.getAppFavorites();
    this.temporarilyMuteOverview();
    favorites.addFavoriteAtPos(
      appname,
      this.extension.trash_icon ? favorites._getIds().length - 1 : -1
    );
    this.extension._onEnterEvent();
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
      this._mountTickCounter = 1000 * 5;
      this._mounts_checked = false;
      this._deferred_mounts.push(mount);
    }
  }

  _checkTrashEmpty() {
    if (!this.extension.trash_icon) return;
    let iter = this.fnTrashDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    this.trashFull = iter.next_file(null) != null;
    iter = null;
    return this.trashFull;
  }

  checkTrash() {
    if (!this.fnTrashDir) {
      this.fnTrashDir = Gio.File.new_for_uri('trash:///');
      this.fnTrashMonitor = this.fnTrashDir.monitor(
        Gio.FileMonitorFlags.WATCH_MOVES,
        null
      );
      this.fnTrashMonitor.connect(
        'changed',
        (fileMonitor, file, otherFile, eventType) => {
          switch (eventType) {
            case Gio.FileMonitorEvent.CHANGED:
            case Gio.FileMonitorEvent.CREATED:
            case Gio.FileMonitorEvent.MOVED_IN:
              return;
          }
          this._checkTrashEmpty();
        }
      );
    }

    if (this._deferred_trash_icon_show) {
      this.updateTrashIcon(true);
      this._deferred_trash_icon_show = false;
    }

    return this.trashFull;
  }

  checkMounts() {
    if (!this.extension.mounted_icon) {
      return;
    }
    if (this._mounts_checked) return;

    if (this._deferred_mounts && this._deferred_mounts.length) {
      this._deferred_mounts.forEach((m) => {
        this._onMountAdded(null, m);
      });
      this._deferred_mounts = [];
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

    this._mounts_checked = true;

    mounts.forEach((mount) => {
      let basename = mount.get_default_location().get_basename();
      let appname = `mount-${basename}-dash2dock-lite.desktop`;
      if (!favs.includes(appname)) {
        this._deferred_mounts.push(mount);
        this._mounts_checked = false;
      }
    });

    // added devices will subsequently be on mounted events
  }

  setupTrashIcon() {
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
      this._deferred_trash_icon_show = true;
    }
    fn = null;
  }

  _pin(app) {
    this.temporarilyMuteOverview();
    let favorites = Fav.getAppFavorites();
    if (!favorites._getIds().includes(app)) {
      favorites.addFavorite(app);
      this.extension._onEnterEvent();
    }
  }

  _unpin(app) {
    this.temporarilyMuteOverview();
    let favorites = Fav.getAppFavorites();
    if (favorites._getIds().includes(app)) {
      favorites.removeFavorite(app);
      this.extension._onEnterEvent();
    }
  }

  updateTrashIcon(show) {
    if (show) {
      this.setupTrashIcon();
      this._pin('trash-dash2dock-lite.desktop');
    } else {
      this._unpin('trash-dash2dock-lite.desktop');
    }
  }

  updateIcon(icon) {
    if (!icon || !icon.icon_name) {
      return;
    }

    this.scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

    // the trash
    if (this.extension.trash_icon && icon.icon_name.startsWith('user-trash')) {
      let new_icon = this.trashFull ? 'user-trash-full' : 'user-trash';
      if (new_icon != icon.icon_name) {
        icon.icon_name = new_icon;
      }
    }

    // clock
    if (icon.icon_name == 'org.gnome.clocks') {
      let p = icon.get_parent();
      if (this.extension.clock_icon) {
        if (!p.clock) {
          let clock = new xClock(CANVAS_SIZE);
          clock.visible = false;
          clock.reactive = true;
          this.clock = clock;

          p.clock = this.clock;
          p.add_child(this.clock);
        }
        if (p.clock) {
          let scale = icon.icon_size / ANIM_ICON_QUALITY / CANVAS_SIZE;
          scale *= this.scaleFactor;
          p.clock.set_scale(scale, scale);
          p.clock.show();
          p.clock.reactive = false;
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
          let calendar = new xCalendar(CANVAS_SIZE);
          calendar.visible = false;
          calendar.reactive = true;
          this.calendar = calendar;

          p.calendar = this.calendar;
          p.add_child(this.calendar);
        }
        if (p.calendar) {
          let scale = icon.icon_size / ANIM_ICON_QUALITY / CANVAS_SIZE;
          scale *= this.scaleFactor;
          p.calendar.set_scale(scale, scale);
          p.calendar.show();
          p.calendar.reactive = false;
        }
      } else {
        if (p.calendar) {
          p.calendar.hide();
        }
      }
    }
  }
};
