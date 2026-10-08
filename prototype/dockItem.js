// prototype/dockItem.js - Base class and interfaces for all dock entities

import GObject from 'gi://GObject';

export const ItemType = {
  APP: 'app',
  WIDGET: 'widget',
  DRAWER: 'drawer',
  SEPARATOR: 'separator',
};

export const IndicatorState = {
  NONE: 'none',
  RUNNING: 'running',
  FOCUSED: 'focused',
};

/**
 * Base class for all items displayed in the DockModel.
 */
export const DockItem = GObject.registerClass(
  {
    GTypeName: 'ProtoDockItem',
    Signals: {
      'changed': {},
      'request-bounce': {},
    },
  },
  class DockItem extends GObject.Object {
    /**
     * @param {Object} props
     * @param {string} props.id - Unique item identifier
     * @param {string} [props.type=ItemType.APP] - Item category
     * @param {string} [props.label=''] - Display tooltip / title
     * @param {string} [props.iconName=''] - Icon name for theme lookup
     * @param {string} [props.badge=null] - Notification badge text/number
     * @param {string} [props.indicator=IndicatorState.NONE] - Running status
     */
    _init(props = {}) {
      super._init();
      this.id = props.id || `item_${Math.random().toString(36).substring(2, 9)}`;
      this.type = props.type || ItemType.APP;
      this.label = props.label || '';
      this.iconName = props.iconName || 'application-x-executable';
      this.badge = props.badge || null;
      this.indicator = props.indicator || IndicatorState.NONE;
      this.isDraggable = props.isDraggable ?? (this.type === ItemType.APP);
    }

    getLabel() {
      return this.label;
    }

    getIconName() {
      return this.iconName;
    }

    getBadge() {
      return this.badge;
    }

    setBadge(badge) {
      if (this.badge !== badge) {
        this.badge = badge;
        this.emit('changed');
      }
    }

    getIndicator() {
      return this.indicator;
    }

    setIndicator(indicator) {
      if (this.indicator !== indicator) {
        this.indicator = indicator;
        this.emit('changed');
      }
    }

    /**
     * Hook for widgets that draw their own custom Cairo graphics (e.g. analog Clock).
     * @returns {boolean}
     */
    hasCustomDraw() {
      return false;
    }

    /**
     * @param {Cairo.Context} cr
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     */
    onCustomDraw(cr, width, height, scale) {
      // Default: no-op
    }

    // --- Interactive Input Handlers ---

    onClick(button, modifiers) {
      console.log(`[DockItem] Click on ${this.label} (${this.id}) button=${button}`);
      this.emit('request-bounce');
    }

    onHover(entering) {
      // Hook for hover state changes
    }

    onScroll(direction) {
      console.log(`[DockItem] Scroll on ${this.label} dir=${direction}`);
    }

    destroy() {
      // Clean up resources
    }
  }
);
