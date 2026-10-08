// prototype/dockModel.js - Unified Observable Dock Collection

import GObject from 'gi://GObject';
import { SeparatorItem } from './dockWidgets.js';

export const DockModel = GObject.registerClass(
  {
    GTypeName: 'ProtoDockModel',
    Signals: {
      'items-changed': {},
      'item-activated': { param_types: [GObject.TYPE_OBJECT] },
    },
  },
  class DockModel extends GObject.Object {
    _init(props = {}) {
      super._init();
      this.sources = [];
      this.items = props.items ? [...props.items] : [];
      this.separator = new SeparatorItem();
    }

    setItems(items) {
      this.items = [...items];
      this.emit('items-changed');
    }

    addSource(source) {
      this.sources.push(source);
      source.connect('items-updated', () => this.rebuild());
      this.rebuild();
    }

    getItems() {
      return this.items;
    }

    getItemCount() {
      return this.items.length;
    }

    rebuild() {
      const newItems = [];

      for (let s of this.sources) {
        const sourceItems = s.getItems() || [];
        if (sourceItems.length > 0) {
          // Insert a distinct separator between major categories if not empty
          if (newItems.length > 0) {
            newItems.push(new SeparatorItem());
          }
          newItems.push(...sourceItems);
        }
      }

      this.items = newItems;
      this.emit('items-changed');
    }

    activateItem(item, button = 1, modifiers = 0) {
      if (item && item.onClick) {
        item.onClick(button, modifiers);
        this.emit('item-activated', item);
      }
    }
  }
);
