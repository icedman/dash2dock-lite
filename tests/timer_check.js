// gjs -m tests/timer_check.js — R-1 Timer hardening checks. Exits 1 on failure.
import GLib from 'gi://GLib';
import System from 'system';

import { Timer } from '../timer.js';

let failures = 0;
function check(cond, msg) {
  print(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) {
    failures++;
  }
}

const loop = new GLib.MainLoop(null, false);

// swallow the expected subscriber errors, but count and check them
let loggedErrors = 0;
let loggedPrefixOk = true;
// console.error is read-only in gjs; intercept at the GLib log writer
GLib.log_set_writer_func((level, fields) => {
  const msg = new TextDecoder().decode(fields.MESSAGE ?? new Uint8Array());
  loggedErrors++;
  if (!msg.startsWith('d2da: timer check subscriber thrower')) {
    loggedPrefixOk = false;
    print(`unexpected log: ${msg}`);
  }
  return GLib.LogWriterOutput.HANDLED;
});

// 1. a throwing subscriber must not kill the GLib source
const timer = new Timer('check');
timer.initialize(10);
let count = 0;
let throws = 0;
timer.runLoop(
  () => {
    throws++;
    throw new Error('expected test error');
  },
  10,
  'thrower'
);
timer.runLoop(() => count++, 10, 'counter');

// 2. unsubscribing during the loop
let selfRemoved = 0;
timer.runOnce(() => selfRemoved++, 10, 'once');

// 3. stale handle from an old Timer
const oldTimer = new Timer('old');
oldTimer.initialize(10);
let staleRuns = 0;
let stale = oldTimer.runDebounced(() => staleRuns++, 10, 'stale');
oldTimer.shutdown();
const oldId = stale._id;
const other = timer.runLoop(() => {}, 1000, 'other');
stale = timer.runDebounced(stale);
check(stale._timer === timer, 'stale handle re-owned by new timer');
check(stale._id !== oldId, 'stale handle got a fresh id');
check(stale._id !== other._id, 'ids unique across timers');

// 4. runAnimation accepts an existing handle (B-24 typo)
let animFrames = 0;
const anim = timer.runAnimation([
  { _duration: 30, _func: () => animFrames++ },
]);
const nSubs = timer._subscribers.length;
const reAnim = timer.runAnimation(anim);
check(
  reAnim._id === anim._id && timer._subscribers.length === nSubs,
  'runAnimation(handle) re-subscribes the same handle'
);

// 5. restart after shutdown()+initialize() with live subscribers (B-23)
const t2 = new Timer('restart');
t2.initialize(10);
let t2count = 0;
t2.runLoop(() => t2count++, 10, 'a');
t2.shutdown();
t2.initialize(10);
t2.runLoop(() => {}, 10, 'b');
check(t2.is_running(), 'restarts when subscribers.length > 1');

let countAt150 = 0;
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
  countAt150 = count;
  return GLib.SOURCE_REMOVE;
});

GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
  check(throws > 1, `thrower kept being called (${throws})`);
  check(
    loggedErrors === throws && loggedPrefixOk,
    `each throw logged with d2da prefix (${loggedErrors})`
  );
  check(
    count > countAt150 && countAt150 > 0,
    `counter kept incrementing (${countAt150} -> ${count})`
  );
  check(timer.is_running(), 'timer is_running()');
  check(selfRemoved === 1, 'runOnce fired exactly once');
  check(staleRuns === 1, 'stale debounce fired once on new timer');
  check(
    !timer._subscribers.some((s) => s._id === stale._id),
    'stale debounce unsubscribed itself from new timer'
  );
  check(animFrames > 0, 'animation ran');
  check(t2count > 0, 'restarted timer ticks');

  // 6. is_running() truthful when the source dies by returning REMOVE
  timer.onUpdate = () => false;
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
    check(!timer.is_running(), 'is_running() false after source died');
    timer.shutdown();
    t2.shutdown();
    loop.quit();
    return GLib.SOURCE_REMOVE;
  });
  return GLib.SOURCE_REMOVE;
});

GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => {
  print('FAIL timeout');
  failures++;
  loop.quit();
  return GLib.SOURCE_REMOVE;
});

loop.run();
print(failures ? `${failures} failure(s)` : 'all passed');
System.exit(failures ? 1 : 0);
