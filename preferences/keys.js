'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { ValueType, PrefKeys } = Me.imports.preferences.prefKeys;

var schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

var settingsKeys = {
  REUSE_DASH: 'reuse-dash',
  SHRINK_ICONS: 'shrink-icons',
  SCALE_ICONS: 'scale-icons',
  ANIMATE_ICONS: 'animate-icons',
  AUTOHIDE_DASH: 'autohide-dash',
  PRESSURE_SENSE: 'pressure-sense',
  BG_OPACITY: 'background-opacity',
  BG_DARK: 'background-dark',
  TRANSLUCENT_TOPBAR: 'translucent-topbar',
  SHOW_TRASH_ICON: 'trash-icon',
};

var SettingsKeys = new PrefKeys();
SettingsKeys.setKeys({
  'shrink-icons': {
    value_type: ValueType.B,
    default_value: false,
    widget_type: 'switch',
  },
  'scale-icons': {
    value_type: ValueType.D,
    default_value: 0,
    widget_type: 'scale',
  },
  'animate-icons': {
    value_type: ValueType.B,
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'autohide-dash': {
    value_type: ValueType.B,
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'pressure-sense': {
    value_type: ValueType.B,
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'background-dark': {
    value_type: ValueType.B,
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'background-opacity': {
    value_type: ValueType.D,
    default_value: 0,
    widget_type: 'scale',
  },
  'translucent-topbar': {
    value_type: ValueType.B,
    default_value: false,
    widget_type: 'switch',
  },
  'trash-icon': {
    value_type: ValueType.B,
    default_value: false,
    widget_type: 'switch',
  },
});
