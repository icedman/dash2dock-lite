const Main = imports.ui.main;
const Gio = imports.gi.Gio;
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

var Services = class {
  enable() {
    let clock = new xClock(CANVAS_SIZE);
    clock.visible = false;
    clock.reactive = true;
    this.clock = clock;

    let calendar = new xCalendar(CANVAS_SIZE);
    calendar.visible = false;
    calendar.reactive = true;
    this.calendar = calendar;
  }

  disable() {
    this.fnTrashDir = null;
    if (this.clock) {
      if (this.clock.get_parent()) {
        this.clock.get_parent().remove_child(this.clock);
        this.clock.get_parent().clock = null;
      }
      delete this.clock;
      this.clock = null;
    }
    if (this.calendar) {
      if (this.calendar.get_parent()) {
        this.calendar.get_parent().remove_child(this.calendar);
        this.calendar.get_parent().calendar = null;
      }
      delete this.calendar;
      this.calendar = null;
    }
  }

  checkTrash() {
    if (!this.fnTrashDir) {
      this.fnTrashDir = Gio.File.new_for_uri('trash:///');
    }
    var prevTrash = this.trashFull;
    var iter = this.fnTrashDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    this.trashFull = iter.next_file(null) != null;
    iter = null;
    return this.trashFull;
  }

  setupTrashIcon() {
    var fn = Gio.File.new_for_path(
      '.local/share/applications/trash-dash2dock-lite.desktop'
    );

    if (!fn.query_exists(null)) {
      var content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=xdg-open trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash\n\n[Desktop Action trash]\nName=Empty Trash\nExec=${AppsFolderPath}/empty-trash.sh\nTerminal=true\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
      Main.notify('Preparing the trash icon...');
    }
    fn = null;
  }

  updateIcon(icon) {
    if (!icon || !icon.icon_name) {
      return;
    }

    // the trash
    if (icon.icon_name.startsWith('user-trash')) {
      let new_icon = this.trashFull ? 'user-trash-full' : 'user-trash';
      if (new_icon != icon.icon_name) {
        icon.icon_name = new_icon;
      }
    }

    // clock
    if (icon.icon_name == 'org.gnome.clocks') {
      let p = icon.get_parent();
      if (!p.clock) {
        p.clock = this.clock;
        p.add_child(this.clock);
        p.clock.show();
      }
      if (p.clock) {
        let scale = (icon.icon_size / ANIM_ICON_QUALITY) / CANVAS_SIZE;
        p.clock.set_scale(scale, scale);
      }
    }

    // calendar
    if (icon.icon_name == 'org.gnome.Calendar') {
      let p = icon.get_parent();
      if (!p.calendar) {
        p.calendar = this.calendar;
        p.add_child(this.calendar);
        p.calendar.show();
      }
      if (p.calendar) {
        let scale = (icon.icon_size / ANIM_ICON_QUALITY) / CANVAS_SIZE;
        p.calendar.set_scale(scale, scale);
      }
    }
  }
};
