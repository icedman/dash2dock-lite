'use strict';

import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Live instance counts (T-6): stage walks can't see actors that were
// unparented but never destroyed. Always counted; it's just an integer map.
const liveCounts = {};

export function live(kind, delta) {
  liveCounts[kind] = (liveCounts[kind] ?? 0) + delta;
}

// Smoke-only settings hook: D2DA_SMOKE_SETTINGS='key=value key=value', values
// in GVariant text format (strings quoted). Only with D2DA_PROBE=1 *and* the
// in-memory GSettings backend, so it can never write the user's dconf.
export function applySmokeSettings(settings) {
  if (
    GLib.getenv('D2DA_PROBE') !== '1' ||
    GLib.getenv('GSETTINGS_BACKEND') !== 'memory'
  ) {
    return;
  }

  const spec = (GLib.getenv('D2DA_SMOKE_SETTINGS') ?? '').trim();
  if (!spec) {
    return;
  }

  const applied = [];
  for (const pair of spec.split(/\s+/)) {
    try {
      const eq = pair.indexOf('=');
      if (eq < 1) {
        throw new Error(`malformed '${pair}' (want key=value)`);
      }
      const key = pair.slice(0, eq);
      if (!settings.settings_schema.has_key(key)) {
        throw new Error(`unknown key '${key}'`);
      }
      const type = settings.settings_schema.get_key(key).get_value_type();
      const value = GLib.Variant.parse(type, pair.slice(eq + 1), null, null);
      // the memory backend keeps values across re-enables; skip no-op writes
      if (!settings.get_value(key).equal(value)) {
        settings.set_value(key, value);
      }
      applied.push(`${key}=${value.print(false)}`);
    } catch (e) {
      console.error('d2da: probe settings', e);
    }
  }
  console.log('d2da-probe settings applied: ' + applied.join(' '));
}

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
          liveDock: liveCounts.dock ?? 0,
          liveDash: liveCounts.dash ?? 0,
          liveAnimator: liveCounts.animator ?? 0,
        })
    );
  } catch (e) {
    console.error('d2da: probe', e);
  }
}
