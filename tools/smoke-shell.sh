#!/bin/sh
# Headless smoke test for dash2dock-lite (used by the AUDITOR agent).
#
# Boots a nested, headless gnome-shell on a private D-Bus session with a
# virtual monitor, checks that the extension reaches ACTIVE, toggles it
# TOGGLES times (lifecycle stress), then compares error signatures in the
# shell log against a baseline of known, pre-existing errors.
#
# Usage: tools/smoke-shell.sh [TOGGLES]
#   TOGGLES  disable/enable cycles (default 5)
# Env:
#   D2DA_SMOKE_LOG       shell log path        (default /tmp/d2da-smoke.log)
#   D2DA_SMOKE_BASELINE  known-error signatures (default agents/smoke-baseline.txt)
#   D2DA_SMOKE_UPDATE=1  overwrite the baseline with this run's signatures
#   D2DA_SMOKE_REAL_DCONF=1  use the user's real dconf (their settings and
#                        *all* their enabled extensions) instead of isolation
#
# Default is isolated: the nested shell uses an in-memory GSettings backend,
# so only this extension is loaded, with schema-default settings, and the
# user's dconf is never written. (~/.config/d2da overrides still apply.)
#
# Exit codes: 0 pass, 1 not ACTIVE / shell died / NEW error signatures,
#             2 shell failed to start.
# Run `make install` first - this tests the *installed* copy.

UUID=dash2dock-lite@icedman.github.com
TOGGLES=${1:-5}
LOG=${D2DA_SMOKE_LOG:-/tmp/d2da-smoke.log}
REPO=$(cd "$(dirname "$0")/.." && pwd)
BASELINE=${D2DA_SMOKE_BASELINE:-$REPO/agents/smoke-baseline.txt}
FLAG="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/gnome-shell-disable-extensions"

if [ -z "$D2DA_SMOKE_INNER" ]; then
	rm -f "$FLAG"
	# dbus-daemon chatter goes to a side log, not the terminal.
	D2DA_SMOKE_INNER=1 exec dbus-run-session -- "$0" "$TOGGLES" 2>"$LOG.bus"
fi

: >"$LOG"
if [ "$D2DA_SMOKE_REAL_DCONF" = "1" ]; then
	echo "mode: real dconf"
	BACKEND=dconf
else
	echo "mode: isolated (memory GSettings, only $UUID)"
	BACKEND=memory
fi
GSETTINGS_BACKEND=$BACKEND MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
	gnome-shell --headless --no-x11 --virtual-monitor 1200x800 >>"$LOG" 2>&1 &
SHELL_PID=$!

cleanup() {
	[ "$BACKEND" = "dconf" ] && gnome-extensions enable "$UUID" >/dev/null 2>&1
	kill "$SHELL_PID" 2>/dev/null
	wait "$SHELL_PID" 2>/dev/null
	rm -f "$FLAG"
}
trap cleanup EXIT INT TERM

state() {
	gnome-extensions info "$UUID" 2>/dev/null | sed -n 's/^ *State: *//p'
}

# Wait for the shell's extension D-Bus API (up to 30 s).
i=0
until gnome-extensions list >/dev/null 2>&1; do
	i=$((i + 1))
	if [ $i -gt 60 ] || ! kill -0 "$SHELL_PID" 2>/dev/null; then
		echo "FAIL: gnome-shell did not start (see $LOG)"
		exit 2
	fi
	sleep 0.5
done

RESULT=0
# In isolated mode nothing is enabled yet; enable via the shell's D-Bus API
# (writes only to the shell's in-memory settings).
[ "$BACKEND" = "memory" ] && gnome-extensions enable "$UUID"
# Extension enables ~250 ms after startup; give the docks time to build.
sleep 4
S=$(state)
echo "initial state: $S"
[ "$S" = "ACTIVE" ] || { echo "FAIL: extension not ACTIVE after startup"; RESULT=1; }

n=0
while [ $n -lt "$TOGGLES" ]; do
	gnome-extensions disable "$UUID"
	sleep 0.5
	gnome-extensions enable "$UUID"
	sleep 1
	n=$((n + 1))
done
sleep 2
S=$(state)
echo "state after $TOGGLES toggles: $S"
[ "$S" = "ACTIVE" ] || { echo "FAIL: extension not ACTIVE after toggling"; RESULT=1; }
kill -0 "$SHELL_PID" 2>/dev/null || { echo "FAIL: gnome-shell died"; RESULT=1; }

ENABLED=$(grep -c 'dash2dock-lite enabled' "$LOG")
DISABLED=$(grep -c 'dash2dock-lite disabled' "$LOG")
echo "enable/disable messages: $ENABLED/$DISABLED (expect $((TOGGLES + 1))/$TOGGLES)"

# Error signatures: only classes an extension can cause (JS + GObject/Clutter/
# St/Gjs criticals). Headless/session noise (cogl viewport, systemd scopes,
# portals) is ignored. Pids, timestamps and numbers are stripped.
SIG="$LOG.sig"
grep -E 'JS ERROR|JS WARNING|had error|unable to layout|(GLib-GObject|Gjs|Clutter|St|GLib)-(CRITICAL|WARNING)|TypeError|ReferenceError|extensions/' "$LOG" |
	grep -v -E 'cogl_|GnomeDesktop|portal|transient scope' |
	sed -E 's/\((gnome-shell|process):[0-9]+\)//; s/[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+//; s/[0-9]+/N/g; s/^[: ]+//' |
	sort -u >"$SIG"

if [ "$D2DA_SMOKE_UPDATE" = "1" ]; then
	cp "$SIG" "$BASELINE"
	echo "baseline updated: $BASELINE ($(wc -l <"$SIG") signatures)"
elif [ -f "$BASELINE" ]; then
	NEW=$(comm -23 "$SIG" "$BASELINE")
	GONE=$(comm -13 "$SIG" "$BASELINE")
	if [ -n "$NEW" ]; then
		echo "NEW error signatures (regression):"
		echo "$NEW" | sed 's/^/  + /'
		RESULT=1
	fi
	[ -n "$GONE" ] && { echo "baseline signatures no longer seen (fixed? update baseline):"; echo "$GONE" | sed 's/^/  - /'; }
	[ -z "$NEW" ] && echo "no new error signatures ($(wc -l <"$SIG") known)"
else
	echo "no baseline at $BASELINE; signatures this run:"
	sed 's/^/  ? /' "$SIG"
fi

[ $RESULT -eq 0 ] && echo "SMOKE: PASS" || echo "SMOKE: FAIL (log: $LOG)"
exit $RESULT
