// prototype/dockModel.js - Unified Observable Dock Collection

import GObject from 'gi://GObject';
import { SeparatorItem } from './dockWidgets.js';

export const stem_flags = Object.freeze({
  CENTER_BASIS: 0, // Option A: Symmetrical center-basis expansion (allows overflow before resting boundary)
  FIXED_STEM: 1,   // Option B: Pinned stem root at resting boundary (no overflow)
});

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

/**
 * Observable / interactive view state for an individual dock instance
 * (e.g. main dock, sub-dock popup, drawer).
 * Encapsulates hover progress, localized pointer coordinates, frozen snapshots,
 * and layout bounds for hit-testing and physical animations.
 */
export class DockViewState {
  constructor(options = {}) {
    this.id = options.id || 'dock';
    this.hoverProgress = 0.0;
    this.mouseOver = false;
    this.pointerX = 0.0;
    this.pointerY = 0.0;
    this.pointerPrimary = 0.0;
    this.pointerSecondary = 0.0;
    this.localPointer = 0.0;
    this.primaryRestingStart = 0.0;
    this.isFrozen = false;
    this.frozenState = null;
    this.pillBounds = null;
    this.computedLayout = [];
  }

  freeze(snapshot = {}) {
    this.isFrozen = true;
    this.frozenState = {
      pointerPrimary: snapshot.pointerPrimary ?? this.pointerPrimary,
      pointerSecondary: snapshot.pointerSecondary ?? this.pointerSecondary,
      localPointer: snapshot.localPointer ?? this.localPointer,
      hoverProgress: snapshot.hoverProgress ?? this.hoverProgress,
      pillBounds: snapshot.pillBounds ?? (this.pillBounds ? { ...this.pillBounds } : null),
      computedLayout: snapshot.computedLayout ?? (this.computedLayout ? [...this.computedLayout] : []),
    };
  }

  unfreeze() {
    this.isFrozen = false;
    this.frozenState = null;
  }

  updatePointer(x, y, isVertical = false) {
    if (this.isFrozen) return;
    this.pointerX = x;
    this.pointerY = y;
    this.pointerPrimary = isVertical ? y : x;
    this.pointerSecondary = isVertical ? x : y;
  }

  setHover(isOver) {
    if (this.isFrozen) return;
    this.mouseOver = isOver;
  }

  tick(lerpEnter = 0.16, lerpLeave = 0.10) {
    if (this.isFrozen) return false;
    const targetHover = this.mouseOver ? 1.0 : 0.0;
    const delta = targetHover - this.hoverProgress;
    const lerpSpeed = this.mouseOver ? lerpEnter : lerpLeave;

    if (Math.abs(delta) > 0.0005) {
      this.hoverProgress += delta * lerpSpeed;
      return true;
    } else if (this.hoverProgress !== targetHover) {
      this.hoverProgress = targetHover;
      return true;
    }
    return false;
  }

  isPointerOver(x, y) {
    if (this.pillBounds) {
      const b = this.pillBounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return true;
      }
    }
    for (const l of this.computedLayout) {
      if (
        x >= l.rect.x &&
        x <= l.rect.x + l.rect.w &&
        y >= l.rect.y &&
        y <= l.rect.y + l.rect.h
      ) {
        return true;
      }
    }
    return false;
  }

  getItemAt(x, y) {
    for (const l of this.computedLayout) {
      if (
        x >= l.rect.x &&
        x <= l.rect.x + l.rect.w &&
        y >= l.rect.y &&
        y <= l.rect.y + l.rect.h
      ) {
        return l;
      }
    }
    return null;
  }
}

