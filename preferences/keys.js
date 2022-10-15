'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { PrefKeys } = Me.imports.preferences.prefKeys;

var schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

var settingsKeys = {
  BORDER_RADIUS: 'border-radius',
};

var SettingsKeys = new PrefKeys();
SettingsKeys.setKeys({
  'shrink-icons': {
    default_value: false,
    widget_type: 'switch',
  },
  'scale-icons': {
    default_value: 0,
    widget_type: 'scale',
  },
  'animate-icons': {
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'autohide-dash': {
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'pressure-sense': {
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'background-dark': {
    default_value: true,
    widget_type: 'switch',
    key_maps: {},
  },
  'background-opacity': {
    default_value: 0,
    widget_type: 'scale',
  },
  'translucent-topbar': {
    default_value: false,
    widget_type: 'switch',
  },
  'trash-icon': {
    default_value: false,
    widget_type: 'switch',
  },
  'peek-hidden-icons': {
    default_value: false,
    widget_type: 'switch',
  },
  'animation-fps': {
    default_value: 0,
    widget_type: 'dropdown',
  },
  'animation-magnify': {
    default_value: 0,
    widget_type: 'scale',
  },
  'animation-spread': {
    default_value: 0,
    widget_type: 'scale',
  },
  'border-radius': {
    default_value: 0,
    widget_type: 'scale',
  },
  'panel-mode': {
    default_value: false,
    widget_type: 'switch',
  },
  'apps-icon': {
    default_value: true,
    widget_type: 'switch',
  },
});
