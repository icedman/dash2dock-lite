'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { Type } = Me.imports.preferences.settings;

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

// This lists the preferences keys
var Keys = [
    {
        component: "general", schemas: [
            { type: Type.B, name: "reuse-dash" },
            { type: Type.B, name: "shrink-icons" },
            { type: Type.D, name: "scale-icons" },
            { type: Type.B, name: "animate-icons" },
            { type: Type.B, name: "autohide-dash" },
            { type: Type.B, name: "pressure-sense" },
            { type: Type.D, name: "background-opacity" },
            { type: Type.B, name: "background-dark" },
            { type: Type.B, name: "translucent-topbar" },
            { type: Type.B, name: "trash-icon" },
        ]
    },
];