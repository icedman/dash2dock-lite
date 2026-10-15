import Gtk from 'gi://Gtk?version=4.0';
import { ItemType } from './dockItem.js';
import { DockModel, DockViewState, stem_flags } from './dockModel.js';
import {
  MockFavoritesSource,
  MockRunningAppsSource,
  MockDrawerSource,
  MockWidgetsSource,
} from './dockSources.js';

Gtk.init();

const model = new DockModel();
model.addSource(new MockFavoritesSource());
model.addSource(new MockRunningAppsSource());
model.addSource(new MockDrawerSource());
model.addSource(new MockWidgetsSource());

const items = model.getItems();
const staticSlots = [];
let curOffset = 0;
const iconSize = 48;
const padding = 8;
const SEPARATOR_WIDTH = 10;

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const isSep = item.type === ItemType.SEPARATOR;
  const w = isSep ? SEPARATOR_WIDTH : iconSize;
  staticSlots.push({ item, start: curOffset, center: curOffset + w / 2, width: w, isSep });
  curOffset += w + padding;
}

console.log("Resting static slots:");
staticSlots.forEach((s, i) => {
  console.log(`Slot ${i}: isSep=${s.isSep}, start=${s.start}, center=${s.center}, width=${s.width}`);
});
