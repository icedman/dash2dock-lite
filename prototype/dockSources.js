// prototype/dockSources.js - Pluggable ItemSources: Favorites, Running Apps, Widgets

import GObject from 'gi://GObject';
import { DockItem, ItemType, IndicatorState } from './dockItem.js';
import { ClockWidget, TrashWidget, DrawerItem, SeparatorItem } from './dockWidgets.js';

export const ItemSource = GObject.registerClass(
  {
    GTypeName: 'ProtoItemSource',
    Signals: {
      'items-updated': {},
    },
  },
  class ItemSource extends GObject.Object {
    _init() {
      super._init();
    }

    getItems() {
      return [];
    }

    destroy() {
      // Disconnect signal listeners
    }
  }
);

/**
 * Mockup Favorites Source (in real extension, connects to AppFavorites)
 */
export const MockFavoritesSource = GObject.registerClass(
  {
    GTypeName: 'ProtoMockFavoritesSource',
  },
  class MockFavoritesSource extends ItemSource {
    _init() {
      super._init();
      this.items = [
        new DockItem({
          id: 'org.gnome.Nautilus',
          type: ItemType.APP,
          label: 'Files',
          iconName: 'org.gnome.Nautilus',
          indicator: IndicatorState.RUNNING,
        }),
        new DockItem({
          id: 'org.gnome.Terminal',
          type: ItemType.APP,
          label: 'Terminal',
          iconName: 'org.gnome.Terminal',
          indicator: IndicatorState.FOCUSED,
        }),
        new DockItem({
          id: 'firefox',
          type: ItemType.APP,
          label: 'Firefox Web Browser',
          iconName: 'firefox',
          indicator: IndicatorState.RUNNING,
          badge: 2,
        }),
        new DockItem({
          id: 'org.gnome.Settings',
          type: ItemType.APP,
          label: 'Settings',
          iconName: 'org.gnome.Settings',
          indicator: IndicatorState.NONE,
        }),
        new DockItem({
          id: 'org.gnome.TextEditor',
          type: ItemType.APP,
          label: 'Text Editor',
          iconName: 'org.gnome.TextEditor',
          indicator: IndicatorState.NONE,
        }),
      ];
    }

    getItems() {
      return this.items;
    }
  }
);

/**
 * Mockup Running Apps Source (in real extension, connects to Shell.AppSystem)
 */
export const MockRunningAppsSource = GObject.registerClass(
  {
    GTypeName: 'ProtoMockRunningAppsSource',
  },
  class MockRunningAppsSource extends ItemSource {
    _init() {
      super._init();
      this.items = [
        new DockItem({
          id: 'org.gnome.Calculator',
          type: ItemType.APP,
          label: 'Calculator',
          iconName: 'org.gnome.Calculator',
          indicator: IndicatorState.RUNNING,
        }),
        new DockItem({
          id: 'com.mattjakeman.ExtensionManager',
          type: ItemType.APP,
          label: 'Extension Manager',
          iconName: 'com.mattjakeman.ExtensionManager',
          indicator: IndicatorState.RUNNING,
        }),
      ];
    }

    getItems() {
      return this.items;
    }
  }
);

/**
 * Mockup Drawer Source containing categorized apps
 */
export const MockDrawerSource = GObject.registerClass(
  {
    GTypeName: 'ProtoMockDrawerSource',
  },
  class MockDrawerSource extends ItemSource {
    _init() {
      super._init();
      const mediaDrawer = new DrawerItem({
        id: 'drawer_media',
        label: 'Media Tools',
        iconName: 'folder-videos',
        children: [
          new DockItem({
            id: 'org.gnome.Music',
            type: ItemType.APP,
            label: 'Music',
            iconName: 'org.gnome.Music',
            indicator: IndicatorState.NONE,
          }),
          new DockItem({
            id: 'org.videolan.VLC',
            type: ItemType.APP,
            label: 'VLC Media Player',
            iconName: 'vlc',
            indicator: IndicatorState.RUNNING,
          }),
          new DockItem({
            id: 'org.gnome.Loupe',
            type: ItemType.APP,
            label: 'Image Viewer',
            iconName: 'org.gnome.Loupe',
            indicator: IndicatorState.NONE,
          }),
        ],
      });

      this.items = [mediaDrawer];
    }

    getItems() {
      return this.items;
    }
  }
);

/**
 * Mockup Widgets Source providing Clock, Trash, and Separator
 */
export const MockWidgetsSource = GObject.registerClass(
  {
    GTypeName: 'ProtoMockWidgetsSource',
  },
  class MockWidgetsSource extends ItemSource {
    _init() {
      super._init();
      this.clock = new ClockWidget();
      this.trash = new TrashWidget(4);
      this.items = [this.clock, this.trash];
    }

    getItems() {
      return this.items;
    }
  }
);
