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
  PEEK_HIDDEN_ICONS: 'peek-hidden-icons',
  ANIMATION_FPS: 'animation-fps',
  ANIMATION_MAGNIFY: 'animation-magnify',
  ANIMATION_SPREAD: 'animation-spread',
  BORDER_RADIUS: 'border-radius',
  PANEL_MODE: 'panel-mode',
  SHOW_APPS_ICON: 'apps-icon',
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
  'peek-hidden-icons': {
    value_type: ValueType.B,
    default_value: false,
    widget_type: 'switch',
  },
  'animation-fps': {
    value_type: ValueType.I,
    default_value: 0,
    widget_type: 'dropdown',
  },
  'animation-magnify': {
    value_type: ValueType.D,
    default_value: 0,
    widget_type: 'scale',
  },
  'animation-spread': {
    value_type: ValueType.D,
    default_value: 0,
    widget_type: 'scale',
  },
  'border-radius': {
    value_type: ValueType.I,
    default_value: 0,
    widget_type: 'scale',
  },
  'panel-mode': {
    value_type: ValueType.B,
    default_value: false,
    widget_type: 'switch',
  },
  'apps-icon': {
    value_type: ValueType.B,
    default_value: true,
    widget_type: 'switch',
  },
});
