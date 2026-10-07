// gjs -m tests/window_tracker_check.js — R-7c WindowTracker checks. Exits 1 on failure.
import GLib from 'gi://GLib';
import System from 'system';

import { WindowTracker } from '../windowTracker.js';

let failures = 0;
function check(cond, msg) {
  print(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) {
    failures++;
  }
}

let loggedErrors = 0;
let loggedPrefixOk = true;
// console.error is read-only in gjs; intercept at the GLib log writer
GLib.log_set_writer_func((level, fields) => {
  const msg = new TextDecoder().decode(fields.MESSAGE ?? new Uint8Array());
  loggedErrors++;
  if (!msg.startsWith('d2da: window tracker untrack')) {
    loggedPrefixOk = false;
    print(`unexpected log: ${msg}`);
  }
  return GLib.LogWriterOutput.HANDLED;
});

// Minimal stand-in for Meta.Window's connectObject/disconnectObject.
class FakeWindow {
  constructor(name) {
    this.name = name;
    this.handlers = new Map(); // owner -> [[signal, cb], ...]
    this.connectCalls = 0;
    this.throwOnDisconnect = false;
  }

  connectObject(...args) {
    const owner = args.pop();
    const list = this.handlers.get(owner) ?? [];
    for (let i = 0; i < args.length; i += 2) {
      list.push([args[i], args[i + 1]]);
    }
    this.handlers.set(owner, list);
    this.connectCalls++;
  }

  disconnectObject(owner) {
    if (this.throwOnDisconnect) {
      throw new Error('expected test error');
    }
    this.handlers.delete(owner);
  }

  emit(signal) {
    for (const list of [...this.handlers.values()]) {
      for (const [s, cb] of list) {
        if (s === signal) {
          cb();
        }
      }
    }
  }

  get connectionCount() {
    let n = 0;
    for (const list of this.handlers.values()) {
      n += list.length;
    }
    return n;
  }
}

let changes = 0;
const tracker = new WindowTracker(() => changes++);
const a = new FakeWindow('a');
const b = new FakeWindow('b');

// 1. track connects exactly once, and only the expected signals
tracker.track(a);
tracker.track(a);
tracker.track(a);
check(a.connectCalls === 1, 'track(a) x3 connects once');
check(a.connectionCount === 3, 'three handlers on a');
check(
  JSON.stringify([...a.handlers.get(tracker)].map(([s]) => s).sort()) ===
    JSON.stringify(['position-changed', 'size-changed', 'unmanaged']),
  'signals: position-changed, size-changed, unmanaged'
);
check(Object.keys(a).every((k) =>
  ['name', 'handlers', 'connectCalls', 'throwOnDisconnect'].includes(k)
), 'no expandos written on the window');
tracker.track(null);
check(tracker.size === 1, 'track(null) ignored');

// 2. position/size changes call the callback
a.emit('position-changed');
a.emit('size-changed');
check(changes === 2, 'position/size-changed -> onChange');

// 3. two "docks" tracking the same window share one connection
tracker.track(b);
tracker.track(b);
check(b.connectCalls === 1, 'second dock tracking b does not reconnect');
check(tracker.size === 2, 'two windows tracked');

// 4. unmanaged releases the window
b.emit('unmanaged');
check(b.connectionCount === 0, 'unmanaged disconnects b');
check(tracker.size === 1, 'unmanaged drops b from the set');
b.emit('position-changed');
check(changes === 2, 'no callback after unmanaged');
// an untracked window can be tracked again
tracker.track(b);
check(b.connectCalls === 2 && tracker.size === 2, 're-track after unmanaged');

// 5. untrack is idempotent
tracker.untrack(b);
tracker.untrack(b);
check(b.connectionCount === 0 && tracker.size === 1, 'untrack x2 idempotent');

// 6. clear() releases everything, tracker stays usable
tracker.track(b);
tracker.clear();
check(
  a.connectionCount === 0 && b.connectionCount === 0 && tracker.size === 0,
  'clear() disconnects all'
);
tracker.track(a);
check(a.connectionCount === 3 && tracker.size === 1, 'track after clear()');

// 7. disconnect errors are logged with the d2da: prefix, window still dropped
const c = new FakeWindow('c');
tracker.track(c);
c.throwOnDisconnect = true;
tracker.untrack(c);
check(loggedErrors === 1 && loggedPrefixOk, 'disconnect error logged (d2da:)');
check(tracker.size === 1, 'failing window still dropped from the set');

// 8. destroy() releases everything and turns track() into a no-op
tracker.destroy();
check(a.connectionCount === 0 && tracker.size === 0, 'destroy() disconnects all');
tracker.track(a);
check(a.connectionCount === 0 && tracker.size === 0, 'track() after destroy() is a no-op');
a.emit('position-changed');
check(changes === 2, 'no callback after destroy()');

print(failures ? `${failures} FAILED` : 'all passed');
System.exit(failures ? 1 : 0);
