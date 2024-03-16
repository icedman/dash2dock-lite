'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Gio from 'gi://Gio';
import St from 'gi://St';
import Graphene from 'gi://Graphene';

const Point = Graphene.Point;

import { Clock } from './apps/clock.js';
import { Calendar } from './apps/calendar.js';

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

export const Services = class {
  enable() {
    this._mounts = {};
    this._services = [
      new ServiceCounter('trash', 1000 * 15, this.checkTrash.bind(this)),
      new ServiceCounter(
        'clock',
        1000 * 60, // every minute
        // 1000 * 1, // every second
        () => {
          if (this.clock && this.clock.visible) {
            this.clock.redraw();
          }
        },
        -1
      ),
      new ServiceCounter(
        'calendar',
        1000 * 60 * 15,
        () => {
          if (this.calendar && this.calendar.visible) {
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
          this._commitMounts();

          // notifications
          this.checkNotifications();
        },
        0
      ),
    ];

    this._disableNotifications = 0;

    this._deferredMounts = [];
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

    this._commitMounts();
  }

  disable() {
    this._services = [];
    this._volumeMonitor.disconnectObject(this);
    this._volumeMonitor = null;
    this._trashMonitor.disconnectObject(this);
    this._trashMonitor = null;
    this._trashDir = null;
  }

  _commitMounts() {
    if (this._deferredMounts && this._deferredMounts.length) {
      let mounts = [...this._deferredMounts];
      this._deferredMounts = [];
      mounts.forEach((m) => {
        this._onMountAdded(null, m);
      });
    }
  }

  _onMountAdded(monitor, mount) {
    if (!this.extension.mounted_icon) {
      return false;
    }

    this.last_mounted = mount;
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this.setupMountIcon(mount);
    this.extension.animate();
    return true;
  }

  _onMountRemoved(monitor, mount) {
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let mount_id = `/tmp/${appname}`;
    delete this._mounts[mount_id];
    this.extension.animate();
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
    let mount_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(mount_id);

    if (!fn.query_exists(null)) {
      let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${label}\nExec=xdg-open ${fullpath}\nIcon=${icon}\nStartupWMClass=mount-${basename}-dash2dock-lite\nActions=unmount;\n\n[Desktop Action mount]\nName=Mount\nExec=${mount_exec}\n\n[Desktop Action unmount]\nName=Unmount\nExec=${unmount_exec}\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
    }

    this._mounts[mount_id] = mount;
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
      this._mounts = {};
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
    mounts.forEach((mount) => {
      let basename = mount.get_default_location().get_basename();
      let appname = `mount-${basename}-dash2dock-lite.desktop`;
      this._deferredMounts.push(mount);
    });

    // added devices will subsequently be on mounted events
  }

  redraw() {
    let widgets = [this.clockCanvas, this.calendar];
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

  updateIcon(item, settings) {
    if (!item) {
      return;
    }
    let icon = item._icon;
    if (!icon || !icon.icon_name) {
      return;
    }

    let { scaleFactor, iconSize, dock } = settings;

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
      if (this.extension.clock_icon) {
        let clock = item._clock;
        if (!clock) {
          clock = new Clock(CANVAS_SIZE);
          this.clock = clock;
          item._clock = clock;
          item._appwell.first_child.add_child(clock);
        }
        if (clock) {
          clock.width = item._icon.width;
          clock.height = item._icon.height;
          clock.set_scale(item._icon.scaleX, item._icon.scaleY);
          clock.pivot_point = item._icon.pivot_point;
          clock.translationX = item._icon.translationX;
          clock.translationY = item._icon.translationY;
          clock.show();
        }
      } else {
        this.clock?.hide();
      }
    }

    // calender
    if (icon.icon_name == 'org.gnome.Calendar') {
      if (this.extension.calendar_icon) {
        let calender = item._calender;
        if (!calender) {
          calender = new Calendar(CANVAS_SIZE);
          this.calender = calender;
          item._calender = calender;
          item._appwell.first_child.add_child(calender);
        }
        if (calender) {
          calender.width = item._icon.width;
          calender.height = item._icon.height;
          calender.set_scale(item._icon.scaleX, item._icon.scaleY);
          calender.pivot_point = item._icon.pivot_point;
          calender.translationX = item._icon.translationX;
          calender.translationY = item._icon.translationY;
          calender.show();
        }
      } else {
        this.calender?.hide();
      }
    }

    if (didCreate) {
      this.redraw();
    }
  }
};
