'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { PrefKeys } = Me.imports.preferences.prefKeys;

var schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

var SettingsKeys = new PrefKeys();
SettingsKeys.setKeys({
  debug: {
    default_value: false,
    widget_type: 'switch',
  },
  'debug-log': {
    default_value: false,
    widget_type: 'switch',
  },
  'debug-visual': {
    default_value: false,
    widget_type: 'switch',
  },
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
  'mounted-icon': {
    default_value: false,
    widget_type: 'switch',
  },
  'clock-icon': {
    default_value: false,
    widget_type: 'switch',
  },
  'calendar-icon': {
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
  'animation-rise': {
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
  'running-indicator-style': {
    default_value: 0,
    widget_type: 'dropdown',
  },
  'running-indicator-color': {
    default_value: [1, 1, 1, 1],
    widget_type: 'color',
  },
  'preferred-monitor': {
    default_value: 0,
    widget_type: 'dropdown',
  },
  'dock-location': {
    default_value: 0,
    widget_type: 'dropdown',
  },
});
