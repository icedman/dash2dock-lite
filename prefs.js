// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

// loosely based on https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/tree/main/extensions/auto-move-windows

const { Adw, Gdk, GLib, Gtk, GObject, Gio, Pango } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const UIFolderPath = Me.dir.get_child('ui').get_path();

const Gettext = imports.gettext.domain('dash2dock-lite');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;

const { schemaId, settingsKeys } = Me.imports.preferences.keys;

const Dash2DockLiteSettingListBoxRow = GObject.registerClass(
  {
    Properties: {
      label: GObject.ParamSpec.string(
        'label',
        'Settings Label',
        'label',
        GObject.ParamFlags.READWRITE,
        ''
      ),
      description: GObject.ParamSpec.string(
        'description',
        'Settings Description',
        'description',
        GObject.ParamFlags.READWRITE,
        ''
      ),
      settingsKey: GObject.ParamSpec.string(
        'settingsKey',
        'Settings Key',
        'settingsKey',
        GObject.ParamFlags.READWRITE,
        ''
      ),
      type: GObject.ParamSpec.string(
        'type',
        'Control Type',
        'type',
        GObject.ParamFlags.READWRITE,
        'switch'
      ),
      options: GObject.param_spec_variant(
        'options',
        'Options for Control',
        'options',
        new GLib.VariantType('a{sv}'),
        null,
        GObject.ParamFlags.READWRITE
      ),
    },
  },
  class Dash2DockLiteSettingListBoxRow extends Gtk.ListBoxRow {
    _init(label, description, settingsKey, type, options) {
      this.rowType = type;
      this._settings = ExtensionUtils.getSettings(schemaId);

      const _hbox = new Gtk.Box({
        spacing: 12,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
      });
      super._init({
        child: _hbox,
      });

      let _vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });
      _hbox.append(_vbox);

      let _label = new Gtk.Label({
        label,
        halign: Gtk.Align.START,
        hexpand: true,
      });
      _vbox.append(_label);

      const _descriptionAttributes = new Pango.AttrList();
      _descriptionAttributes.insert(Pango.attr_scale_new(0.83));
      let _description = new Gtk.Label({
        label: description,
        halign: Gtk.Align.START,
        attributes: _descriptionAttributes,
      });
      _description.get_style_context().add_class('dim-label');
      _vbox.append(_description);

      switch (type) {
        case 'combobox':
          this.control = new Gtk.ComboBoxText();
          for (let item of options.values) this.control.append_text(item);
          this._settings.connect(`changed::${settingsKey}`, () => {
            this.control.set_active(this._settings.get_enum(settingsKey));
          });
          this.control.connect('changed', (combobox) => {
            this._settings.set_enum(settingsKey, combobox.get_active());
          });
          this.control.set_active(this._settings.get_enum(settingsKey) || 0);
          break;
        case 'scale':
          this.control = new Gtk.Scale({
            digits: 2,
            hexpand: 1,
            adjustment: new Gtk.Adjustment({
              upper: 1,
              step_increment: 0.01,
              page_increment: 0.1000000001,
            }),
          });
          _vbox.append(this.control);
          this.control.set_value(this._settings.get_double(settingsKey) || 0);
          this.control.connect('value-changed', (scale) => {
            this._settings.set_double(settingsKey, scale.get_value());
          });
          return;
          break;
        default:
          this.rowType = 'switch';
          this.control = new Gtk.Switch({
            active: this._settings.get_boolean(settingsKey),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
          });
          this._settings.bind(
            settingsKey,
            this.control,
            'active',
            Gio.SettingsBindFlags.DEFAULT
          );
      }
      _hbox.append(this.control);
    }
  }
);

const Dash2DockLiteGeneralPane = GObject.registerClass(
  class Dash2DockLiteGeneralPane extends Gtk.Frame {
    _init() {
      super._init({
        margin_top: 36,
        margin_bottom: 36,
        margin_start: 36,
        margin_end: 36,
      });

      const _listBox = new Gtk.ListBox({
        selection_mode: Gtk.SelectionMode.NONE,
        valign: Gtk.Align.START,
        show_separators: true,
      });
      this.set_child(_listBox);

      _listBox.connect('row-activated', (widget, row) => {
        this._rowActivated(widget, row);
      });

      const shrinkIcons = new Dash2DockLiteSettingListBoxRow(
        _('Shrink icons'),
        _('Shrink dash icons'),
        settingsKeys.SHRINK_ICONS
      );
      _listBox.append(shrinkIcons);

      const animateIcons = new Dash2DockLiteSettingListBoxRow(
        _('Animate icons'),
        _('Animate dash icons on hover'),
        settingsKeys.ANIMATE_ICONS
      );
      _listBox.append(animateIcons);

      const autohideDash = new Dash2DockLiteSettingListBoxRow(
        _('Autohide'),
        _('Autohide the dash panel'),
        settingsKeys.AUTOHIDE_DASH
      );
      _listBox.append(autohideDash);

      const pressureSense = new Dash2DockLiteSettingListBoxRow(
        _('Pressure sense'),
        _('Move pointer down to force dash visibility'),
        settingsKeys.PRESSURE_SENSE
      );
      _listBox.append(pressureSense);
    }

    _rowActivated(widget, row) {
      if (row.rowType === 'switch' || row.rowType === undefined)
        row.control.set_active(!row.control.get_active());
      else if (row.rowType === 'combobox') row.control.popup();
    }
  }
);

const Dash2DockLiteAppearancePane = GObject.registerClass(
  class Dash2DockLiteAppearancePane extends Gtk.Frame {
    _init() {
      super._init({
        margin_top: 36,
        margin_bottom: 36,
        margin_start: 36,
        margin_end: 36,
      });

      const _listBox = new Gtk.ListBox({
        selection_mode: Gtk.SelectionMode.NONE,
        valign: Gtk.Align.START,
        show_separators: true,
      });
      this.set_child(_listBox);

      _listBox.connect('row-activated', (widget, row) => {
        this._rowActivated(widget, row);
      });

      const scaleIcons = new Dash2DockLiteSettingListBoxRow(
        _('Scale icons'),
        _('Rescale dash icons'),
        settingsKeys.SCALE_ICONS,
        'scale'
      );
      _listBox.append(scaleIcons);

      const backgroundDark = new Dash2DockLiteSettingListBoxRow(
        _('Dark background'),
        _('Use dark color for dash background'),
        settingsKeys.BG_DARK
      );
      _listBox.append(backgroundDark);

      const backgroundOpacity = new Dash2DockLiteSettingListBoxRow(
        _('Background opacity'),
        _('Set dash background opacity'),
        settingsKeys.BG_OPACITY,
        'scale'
      );
      _listBox.append(backgroundOpacity);

      const translucentTopBar = new Dash2DockLiteSettingListBoxRow(
        _('Translucent topbar'),
        _('Make top bar translucent'),
        settingsKeys.TRANSLUCENT_TOPBAR
      );
      _listBox.append(translucentTopBar);
    }

    _rowActivated(widget, row) {
      if (row.rowType === 'switch' || row.rowType === undefined)
        row.control.set_active(!row.control.get_active());
      else if (row.rowType === 'combobox') row.control.popup();
    }
  }
);

const Dash2DockLiteExtraPane = GObject.registerClass(
  class Dash2DockLiteExtraPane extends Gtk.Frame {
    _init() {
      super._init({
        margin_top: 36,
        margin_bottom: 36,
        margin_start: 36,
        margin_end: 36,
      });

      const _listBox = new Gtk.ListBox({
        selection_mode: Gtk.SelectionMode.NONE,
        valign: Gtk.Align.START,
        show_separators: true,
      });
      this.set_child(_listBox);

      _listBox.connect('row-activated', (widget, row) => {
        this._rowActivated(widget, row);
      });

      const trashIcon = new Dash2DockLiteSettingListBoxRow(
        _('Dynamic trash icon [beta]'),
        _(
          'Show a dynamic trash icon. This requires animation enabled.\nMake sure the script /usr/local/bin/empty-trash.sh exists.\nRead http://github.com/icedman/dash2dock-lite'
        ),
        settingsKeys.SHOW_TRASH_ICON
      );
      _listBox.append(trashIcon);
    }

    _rowActivated(widget, row) {
      if (row.rowType === 'switch' || row.rowType === undefined)
        row.control.set_active(!row.control.get_active());
      else if (row.rowType === 'combobox') row.control.popup();
    }
  }
);

const Dash2DockLiteSettingsWidget = GObject.registerClass(
  class Dash2DockLiteSettingsWidget extends Gtk.Notebook {
    _init() {
      super._init();
      this.append_page(
        new Dash2DockLiteGeneralPane(),
        new Gtk.Label({ label: _('General') })
      );
      this.append_page(
        new Dash2DockLiteAppearancePane(),
        new Gtk.Label({ label: _('Appearance') })
      );
      this.append_page(
        new Dash2DockLiteExtraPane(),
        new Gtk.Label({ label: _('Services') })
      );
    }
  }
);

function init() {
  ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
  return new Dash2DockLiteSettingsWidget();
}

// function fillPreferencesWindow(window) {
//   let builder = new Gtk.Builder();
//   builder.add_from_file(`${UIFolderPath}/general.ui`);
//   window.add(builder.get_object('main'));
// }