// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

// loosely based on https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/blob/master/extensions/auto-move-windows/prefs.js

const { Gio, GLib, GObject, Gtk, Pango } = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain('dash2dock-lite');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;

const schema_id = 'org.gnome.shell.extensions.dash2dock-lite';

const SettingsKey = {
    REUSE_DASH: 'reuse-dash',
    SHRINK_ICONS: 'shrink-icons',
    BG_OPACITY: 'background-opacity'
};

const Dash2DockLiteSettingListBoxRow = GObject.registerClass({
    Properties: {
        'label': GObject.ParamSpec.string(
            'label', 'Settings Label', 'label',
            GObject.ParamFlags.READWRITE,
            ''),
        'description': GObject.ParamSpec.string(
            'description', 'Settings Description', 'description',
            GObject.ParamFlags.READWRITE,
            ''),
        'settingsKey': GObject.ParamSpec.string(
            'settingsKey', 'Settings Key', 'settingsKey',
            GObject.ParamFlags.READWRITE,
            ''),
        'type': GObject.ParamSpec.string(
            'type', 'Control Type', 'type',
            GObject.ParamFlags.READWRITE,
            'switch'),
        'options': GObject.param_spec_variant(
            'options', 'Options for Control', 'options',
            new GLib.VariantType('a{sv}'),
            null,
            GObject.ParamFlags.READWRITE),
    },
},
class Dash2DockLiteSettingListBoxRow extends Gtk.ListBoxRow {
    _init(label, description, settingsKey, type, options) {
        this.rowType = type;
        this._settings = ExtensionUtils.getSettings(schema_id);

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
            for (let item of options.values)
                this.control.append_text(item);
            this._settings.connect(`changed::${settingsKey}`, () => {
                this.control.set_active(this._settings.get_enum(settingsKey));
            });
            this.control.connect('changed', combobox => {
                this._settings.set_enum(settingsKey, combobox.get_active());
            });
            this.control.set_active(this._settings.get_enum(settingsKey) || 0);
            break;
        case 'scale':
            this.control = new Gtk.Scale({digits:2, hexpand:1, adjustment: new Gtk.Adjustment({upper:1, step_increment:0.01, page_increment:0.1000000001})});
            _vbox.append(this.control);
            this.control.set_value(this._settings.get_double(settingsKey) || 0);
            this.control.connect('value-changed', scale => {
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
            this._settings.bind(settingsKey, this.control, 'active', Gio.SettingsBindFlags.DEFAULT);
        }
        _hbox.append(this.control);
    }
}
);

const Dash2DockLiteSettingsPane = GObject.registerClass(
    class Dash2DockLiteSettingsPane extends Gtk.Frame {
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

            const reuseDash = new Dash2DockLiteSettingListBoxRow(_('Reuse existing Dash'), _('Reuse existing Dash instead of creating another instance'), SettingsKey.REUSE_DASH);
            _listBox.append(reuseDash);

            const shrinkIcons = new Dash2DockLiteSettingListBoxRow(_('Shrink icons'), _('Shrink dash icons'), SettingsKey.SHRINK_ICONS);
            _listBox.append(shrinkIcons);

            const backgroundOpacity = new Dash2DockLiteSettingListBoxRow(_('Background opacity'), _('Set dash background opacity'), SettingsKey.BG_OPACITY, 'scale');
            _listBox.append(backgroundOpacity);
        }

        _rowActivated(widget, row) {
            if (row.rowType === 'switch' || row.rowType === undefined)
                row.control.set_active(!row.control.get_active());
            else if (row.rowType === 'combobox')
                row.control.popup();
        }
    }
);

const Dash2DockLiteSettingsWidget = GObject.registerClass(
    class Dash2DockLiteSettingsWidget extends Gtk.Notebook {
        _init() {
            super._init();

            const _settingsPane = new Dash2DockLiteSettingsPane();
            this.append_page(_settingsPane, new Gtk.Label({ label: _('General') }));
        }
    }
);

function init() {
    ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    return new Dash2DockLiteSettingsWidget();
}
