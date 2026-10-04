'use strict';

import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Dev-only leak/regression probe (G1). No-op unless the shell runs with
// D2DA_PROBE=1 (tools/smoke-shell.sh sets it).
// `timers` lets disable() pass its timers in before it nulls them.
export function probe(ext, phase, timers) {
  if (GLib.getenv('D2DA_PROBE') !== '1') {
    return;
  }

  try {
    timers = timers ?? {
      loop: ext._timer,
      hi: ext._hiTimer,
      lo: ext._loTimer,
    };

    let stage = 0;
    let dashes = 0;
    const stack = [global.stage];
    while (stack.length) {
      const actor = stack.pop();
      for (
        let child = actor.get_first_child();
        child;
        child = child.get_next_sibling()
      ) {
        stage++;
        if (child.constructor.name === 'Dash') {
          dashes++;
        }
        stack.push(child);
      }
    }

    const subscribers = (timer) => timer?._subscribers?.length ?? 0;

    console.log(
      'd2da-probe ' +
        JSON.stringify({
          phase,
          uiGroup: Main.uiGroup.get_n_children(),
          stage,
          dashes,
          docks: ext.docks?.length ?? 0,
          hi: subscribers(timers.hi),
          lo: subscribers(timers.lo),
          loop: subscribers(timers.loop),
        })
    );
  } catch (e) {
    console.error('d2da: probe', e);
  }
}
