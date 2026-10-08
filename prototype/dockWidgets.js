import GObject from 'gi://GObject';
import { DockItem, ItemType, IndicatorState } from './dockItem.js';
import GLib from 'gi://GLib';
import Cairo from 'gi://cairo';

/**
 * Clock Widget with real-time analog face rendering in Cairo
 */
export const ClockWidget = GObject.registerClass(
  {
    GTypeName: 'ProtoClockWidget',
  },
  class ClockWidget extends DockItem {
    _init() {
      super._init({
        id: 'widget_clock',
        type: ItemType.WIDGET,
        label: 'Clock',
        iconName: 'preferences-system-time',
      });
    }

    hasCustomDraw() {
      return true;
    }

    onCustomDraw(cr, width, height, scale) {
      const now = GLib.DateTime.new_now_local();
      const hours = now.get_hour() % 12;
      const minutes = now.get_minute();
      const seconds = now.get_second();

      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.44;

      cr.save();

      // Clock Face Background
      cr.newPath();
      cr.arc(cx, cy, r, 0, 2 * Math.PI);
      cr.setSourceRGBA(0.96, 0.96, 0.98, 0.95);
      cr.fillPreserve();
      cr.setSourceRGBA(0.2, 0.2, 0.25, 0.8);
      cr.setLineWidth(2 * scale);
      cr.stroke();
      cr.newPath();

      // Hour hand
      const hourAngle = (hours + minutes / 60) * (Math.PI / 6) - Math.PI / 2;
      cr.setLineWidth(3 * scale);
      cr.setSourceRGBA(0.1, 0.1, 0.15, 0.95);
      cr.newPath();
      cr.moveTo(cx, cy);
      cr.lineTo(cx + Math.cos(hourAngle) * (r * 0.5), cy + Math.sin(hourAngle) * (r * 0.5));
      cr.stroke();
      cr.newPath();

      // Minute hand
      const minAngle = (minutes + seconds / 60) * (Math.PI / 30) - Math.PI / 2;
      cr.setLineWidth(2 * scale);
      cr.setSourceRGBA(0.2, 0.2, 0.25, 0.95);
      cr.newPath();
      cr.moveTo(cx, cy);
      cr.lineTo(cx + Math.cos(minAngle) * (r * 0.72), cy + Math.sin(minAngle) * (r * 0.72));
      cr.stroke();
      cr.newPath();

      // Second hand (orange/red accent)
      const secAngle = seconds * (Math.PI / 30) - Math.PI / 2;
      cr.setLineWidth(1 * scale);
      cr.setSourceRGBA(0.92, 0.35, 0.15, 0.95);
      cr.newPath();
      cr.moveTo(cx, cy);
      cr.lineTo(cx + Math.cos(secAngle) * (r * 0.8), cy + Math.sin(secAngle) * (r * 0.8));
      cr.stroke();
      cr.newPath();

      // Center pin
      cr.arc(cx, cy, 2.5 * scale, 0, 2 * Math.PI);
      cr.setSourceRGBA(0.92, 0.35, 0.15, 1.0);
      cr.fill();
      cr.newPath();

      cr.restore();
    }

    onClick(button, modifiers) {
      const now = GLib.DateTime.new_now_local();
      console.log(`[ClockWidget] Current Time: ${now.format('%H:%M:%S')}`);
      super.onClick(button, modifiers);
    }
  }
);

/**
 * Calendar Widget with dynamic date/day rendering in Cairo
 * Styled after dash2dock-lite's apps/calendar.js
 */
export const CalendarWidget = GObject.registerClass(
  {
    GTypeName: 'ProtoCalendarWidget',
  },
  class CalendarWidget extends DockItem {
    _init() {
      const now = GLib.DateTime.new_now_local();
      super._init({
        id: 'widget_calendar',
        type: ItemType.WIDGET,
        label: `Calendar (${now.format('%b %d')})`,
        iconName: 'x-office-calendar',
      });
    }

    hasCustomDraw() {
      return true;
    }

    onCustomDraw(cr, width, height, scale) {
      const now = GLib.DateTime.new_now_local();
      const dayName = now.format('%a'); // e.g. "Thu"
      const dateNum = now.format('%d').replace(/^0/, ''); // e.g. "8"

      const cx = width / 2;
      const cy = height / 2;
      const cardSize = Math.min(width, height) * 0.84;
      const x = cx - cardSize / 2;
      const y = cy - cardSize / 2;
      const radius = cardSize * 0.22;

      cr.save();

      // Rounded rectangle path helper
      const makeRoundedRect = (rx, ry, rw, rh, r) => {
        cr.newPath();
        cr.arc(rx + rw - r, ry + r, r, -Math.PI / 2, 0);
        cr.arc(rx + rw - r, ry + rh - r, r, 0, Math.PI / 2);
        cr.arc(rx + r, ry + rh - r, r, Math.PI / 2, Math.PI);
        cr.arc(rx + r, ry + r, r, Math.PI, (3 * Math.PI) / 2);
        cr.closePath();
      };

      // 1. Soft Card Shadow
      makeRoundedRect(x, y + 2 * scale, cardSize, cardSize, radius);
      cr.setSourceRGBA(0.0, 0.0, 0.0, 0.2);
      cr.fill();
      cr.newPath();

      // 2. Base Card Body (#dddddd light background matching dash2dock)
      makeRoundedRect(x, y, cardSize, cardSize, radius);
      cr.setSourceRGBA(0.88, 0.88, 0.90, 0.98);
      cr.fillPreserve();
      cr.setSourceRGBA(0.70, 0.70, 0.74, 0.8);
      cr.setLineWidth(1 * scale);
      cr.stroke();
      cr.newPath();

      // 3. Day of Week text (e.g. "Thu") at top
      cr.save();
      cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
      const dayFontSize = cardSize * 0.22;
      cr.setFontSize(dayFontSize);
      const dayExtents = cr.textExtents(dayName);
      const dayXBearing = dayExtents.xBearing ?? dayExtents.x_bearing ?? 0;
      const dayYBearing = dayExtents.yBearing ?? dayExtents.y_bearing ?? (-dayExtents.height);
      const dayX = cx - (dayExtents.width / 2 + dayXBearing);
      const dayY = y + cardSize * 0.36 - (dayExtents.height / 2 + dayYBearing);
      cr.setSourceRGBA(0.12, 0.12, 0.14, 0.95);
      cr.newPath();
      cr.moveTo(dayX, dayY);
      cr.showText(dayName);
      cr.newPath();
      cr.restore();

      // 4. Day of Month text (e.g. "8") in bold red/accent color (#ff2b2b) centered below
      cr.save();
      cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
      const dateFontSize = cardSize * 0.44;
      cr.setFontSize(dateFontSize);
      const dateExtents = cr.textExtents(dateNum);
      const dateXBearing = dateExtents.xBearing ?? dateExtents.x_bearing ?? 0;
      const dateYBearing = dateExtents.yBearing ?? dateExtents.y_bearing ?? (-dateExtents.height);
      const dateX = cx - (dateExtents.width / 2 + dateXBearing);
      const dateY = y + cardSize * 0.72 - (dateExtents.height / 2 + dateYBearing);
      cr.setSourceRGBA(0.95, 0.18, 0.18, 1.0);
      cr.newPath();
      cr.moveTo(dateX, dateY);
      cr.showText(dateNum);
      cr.newPath();
      cr.restore();

      cr.restore();
    }

    onClick(button, modifiers) {
      const now = GLib.DateTime.new_now_local();
      console.log(`[CalendarWidget] Clicked: ${now.format('%A, %B %d, %Y')}`);
      super.onClick(button, modifiers);
    }
  }
);

/**
 * Trash Widget with dynamic file counts and full/empty icon switching
 */
export const TrashWidget = GObject.registerClass(
  {
    GTypeName: 'ProtoTrashWidget',
  },
  class TrashWidget extends DockItem {
    _init(initialCount = 3) {
      super._init({
        id: 'widget_trash',
        type: ItemType.WIDGET,
        label: 'Trash',
        iconName: initialCount > 0 ? 'user-trash-full' : 'user-trash',
        badge: initialCount > 0 ? initialCount : null,
      });
      this.itemCount = initialCount;
    }

    setItemCount(count) {
      this.itemCount = count;
      this.iconName = count > 0 ? 'user-trash-full' : 'user-trash';
      this.setBadge(count > 0 ? count : null);
      this.emit('changed');
    }

    onClick(button, modifiers) {
      if (this.itemCount > 0) {
        console.log(`[TrashWidget] Emptying Trash (${this.itemCount} items deleted)`);
        this.setItemCount(0);
      } else {
        console.log('[TrashWidget] Trash is already empty. Adding simulated test items.');
        this.setItemCount(5);
      }
      super.onClick(button, modifiers);
    }
  }
);

/**
 * Separator Item for separating favorites and running apps
 */
export const SeparatorItem = GObject.registerClass(
  {
    GTypeName: 'ProtoSeparatorItem',
  },
  class SeparatorItem extends DockItem {
    _init() {
      super._init({
        id: 'dock_separator',
        type: ItemType.SEPARATOR,
        label: '',
        iconName: '',
        isDraggable: false,
      });
    }
  }
);

/**
 * Icons Drawer Item: Collapsible group of child DockItems that unfolds
 * or pops up as a sub-dock.
 */
export const DrawerItem = GObject.registerClass(
  {
    GTypeName: 'ProtoDrawerItem',
  },
  class DrawerItem extends DockItem {
    _init(props = {}) {
      super._init({
        id: props.id || 'drawer_folder',
        type: ItemType.DRAWER,
        label: props.label || 'Apps Drawer',
        iconName: props.iconName || 'folder',
        badge: props.children ? props.children.length : null,
      });
      this.children = props.children || [];
      this.isOpen = false;
    }

    addChild(item) {
      this.children.push(item);
      this.setBadge(this.children.length);
      this.emit('changed');
    }

    getChildren() {
      return this.children;
    }

    toggleOpen() {
      this.isOpen = !this.isOpen;
      console.log(`[DrawerItem] ${this.label} isOpen=${this.isOpen} (items: ${this.children.length})`);
      this.emit('changed');
      return this.isOpen;
    }

    onClick(button, modifiers) {
      this.toggleOpen();
      super.onClick(button, modifiers);
    }
  }
);
