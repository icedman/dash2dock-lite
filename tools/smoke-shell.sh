#!/bin/sh
# Headless smoke test for dash2dock-lite (used by the AUDITOR agent).
#
# Boots a nested, headless gnome-shell on a private D-Bus session with a
# virtual monitor, checks that the extension reaches ACTIVE, toggles it
# TOGGLES times (lifecycle stress), stops the shell (SIGTERM, SIGKILL after
# 10 s), then compares error signatures in the shell log against a baseline
# of known, pre-existing errors.
#
# Usage: tools/smoke-shell.sh [TOGGLES]
#   TOGGLES  disable/enable cycles (default 5)
# Env:
#   D2DA_SMOKE_LOG       shell log path        (default /tmp/d2da-smoke.log)
#   D2DA_SMOKE_BASELINE  known-error signatures (default agents/smoke-baseline.txt)
#   D2DA_SMOKE_UPDATE=1  overwrite the baseline with this run's signatures
#   D2DA_SMOKE_REAL_DCONF=1  use the user's real dconf (their settings and
#                        *all* their enabled extensions) instead of isolation
#   D2DA_PROBE           passed to the shell (default 1): probe.js logs
#                        `d2da-probe {json}` after each enable/disable; the
#                        table and first->last deltas are printed. 0 = off.
#                        live* fields count Dock/Dash/Animator instances
#                        created minus destroyed (off-stage leaks).
#   D2DA_SMOKE_SETTLE    seconds to wait after every enable before the next
#                        disable / the final checks (default 2)
#   D2DA_SMOKE_SETTINGS  'key=value key=value' (GVariant text, strings quoted)
#                        applied by probe.js on every enable. Isolated mode
#                        with D2DA_PROBE=1 only; ignored with real dconf.
#   D2DA_SMOKE_STRICT_LEAKS=1  also fail if any after-disable probe delta != 0
#                        (stage delta excluded due to run-to-run noise outside the extension),
#                        if probe line counts != TOGGLES+1/TOGGLES, or if
#                        shutdown criticals > 0
#
# Shutdown criticals: CRITICAL lines the shell logs after the stop marker
# (e.g. Gjs "sweeping phase of GC" from leaked actors). Their count is
# printed as `shutdown criticals: N`. They are kept out of the signature
# comparison (only JS errors from the shutdown part are compared), so today's
# known shutdown criticals don't fail the NEW-signature gate; strict mode
# fails on N > 0.
#
# Default is isolated: the nested shell uses an in-memory GSettings backend,
# so only this extension is loaded, with schema-default settings, and the
# user's dconf is never written. (~/.config/d2da overrides still apply.)
#
# Exit codes: 0 pass, 1 not ACTIVE / shell died / NEW error signatures,
#             (strict) probe leak deltas / line counts / shutdown criticals,
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
PROBE=${D2DA_PROBE:-1}
SETTLE=${D2DA_SMOKE_SETTLE:-2}
SETTINGS=
if [ -n "$D2DA_SMOKE_SETTINGS" ]; then
	if [ "$BACKEND" != "memory" ]; then
		echo "note: D2DA_SMOKE_SETTINGS ignored with real dconf"
	elif [ "$PROBE" != "1" ]; then
		echo "note: D2DA_SMOKE_SETTINGS ignored without D2DA_PROBE=1"
	else
		SETTINGS=$D2DA_SMOKE_SETTINGS
		echo "smoke settings: $SETTINGS"
	fi
fi
D2DA_PROBE=$PROBE D2DA_SMOKE_SETTINGS=$SETTINGS GSETTINGS_BACKEND=$BACKEND \
	MUTTER_DEBUG_DUMMY_MODE_SPECS=1200x800 \
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

wait_toggle() {
	cmd="$1"
	target="$2"
	tnum="$3"

	gnome-extensions "$cmd" "$UUID"
	attempt=0
	while [ $attempt -lt 2 ]; do
		step=0
		while [ $step -lt 20 ]; do
			s=$(state)
			if [ "$target" = "ACTIVE" ]; then
				[ "$s" = "ACTIVE" ] && return 0
			else
				[ -n "$s" ] && [ "$s" != "ACTIVE" ] && return 0
			fi
			sleep 0.25
			step=$((step + 1))
		done
		attempt=$((attempt + 1))
		if [ $attempt -lt 2 ]; then
			gnome-extensions "$cmd" "$UUID"
		fi
	done

	echo "FAIL: $cmd not applied (toggle $tnum)"
	RESULT=1
	return 1
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
# Docks are built ~250 ms after enable and startUp() queues one more lo-timer
# run; the same settle wait follows every enable so probe counts compare.
sleep "$SETTLE"
S=$(state)
echo "initial state: $S"
[ "$S" = "ACTIVE" ] || { echo "FAIL: extension not ACTIVE after startup"; RESULT=1; }

n=1
while [ $n -le "$TOGGLES" ]; do
	wait_toggle disable NOT_ACTIVE "$n"
	wait_toggle enable ACTIVE "$n"
	sleep "$SETTLE"
	n=$((n + 1))
done
# Let the dock's animation loop go idle before the stop below: a frame still
# running at shell shutdown hits the already-disposed Dash (logged as a
# finding; the stop is meant to measure leaks, not that race).
sleep 2
S=$(state)
echo "state after $TOGGLES toggles: $S"
[ "$S" = "ACTIVE" ] || { echo "FAIL: extension not ACTIVE after toggling"; RESULT=1; }
# /proc state, not kill -0: an exited, unreaped child still answers kill -0.
alive() {
	[ -r "/proc/$1/status" ] && ! grep -q '^State:[[:space:]]*Z' "/proc/$1/status"
}
alive "$SHELL_PID" || { echo "FAIL: gnome-shell died"; RESULT=1; }

# Stop the shell before reading the log so shutdown output is included.
# (cleanup's real-dconf re-enable needs the shell alive: do it now)
[ "$BACKEND" = "dconf" ] && gnome-extensions enable "$UUID" >/dev/null 2>&1
MARK='d2da-smoke: stopping shell'
echo "$MARK" >>"$LOG"
kill -TERM "$SHELL_PID" 2>/dev/null
i=0
while alive "$SHELL_PID" && [ $i -lt 20 ]; do
	sleep 0.5
	i=$((i + 1))
done
if alive "$SHELL_PID"; then
	echo "note: gnome-shell ignored SIGTERM for 10 s; killing"
	kill -KILL "$SHELL_PID" 2>/dev/null
fi
wait "$SHELL_PID" 2>/dev/null
runlog() { sed "/^$MARK\$/,\$d" "$LOG"; }
downlog() { sed -n "/^$MARK\$/,\$p" "$LOG"; }
SHUTDOWN_CRIT=$(downlog | grep -c -E 'CRITICAL|sweeping phase of GC')
SWEEP=$(downlog | grep -c 'sweeping phase of GC')
echo "shutdown criticals: $SHUTDOWN_CRIT (sweeping phase of GC: $SWEEP)"
if [ "$D2DA_SMOKE_STRICT_LEAKS" = "1" ] && [ "$SHUTDOWN_CRIT" -gt 0 ]; then
	echo "FAIL: shutdown criticals > 0 (D2DA_SMOKE_STRICT_LEAKS=1)"
	RESULT=1
fi

ENABLED=$(grep -c 'dash2dock-lite enabled' "$LOG")
DISABLED=$(grep -c 'dash2dock-lite disabled' "$LOG")
echo "enable/disable messages: $ENABLED/$DISABLED (expect $((TOGGLES + 1))/$TOGGLES)"

# Prints the probe lines of phase $1 as a table plus the first->last delta of
# every numeric field. Returns 1 if any delta != 0.
probe_table() {
	sed -n 's/.*d2da-probe //p' "$LOG" | grep -F "\"phase\":\"$1\"" | awk '
	{
		line = $0
		gsub(/[{}"]/, "", line)
		n = split(line, kv, ",")
		row = ""
		c = 0
		for (i = 1; i <= n; i++) {
			split(kv[i], p, ":")
			if (p[1] == "phase") continue
			c++
			if (NR == 1) {
				keys[++nk] = p[1]; first[p[1]] = p[2]
				fmt[nk] = "%" (length(p[1]) < 9 ? 9 : length(p[1]) + 1) "s"
			}
			last[p[1]] = p[2]
			row = row sprintf(fmt[c], p[2])
		}
		if (NR == 1) {
			hdr = ""
			for (k = 1; k <= nk; k++) hdr = hdr sprintf(fmt[k], keys[k])
			print "    #  " hdr
		}
		printf "    %-3d%s\n", NR, row
	}
	END {
		if (NR == 0) { print "    (no probe lines)"; exit 0 }
		row = ""
		bad = 0
		for (k = 1; k <= nk; k++) {
			d = last[keys[k]] - first[keys[k]]
			# stage is excluded from strict delta failure due to run-to-run noise outside the extension
			if (keys[k] != "stage" && d != 0) bad = 1
			row = row sprintf(fmt[k], (d > 0 ? "+" : "") d)
		}
		print "  delta" row
		exit bad
	}'
}

if [ "$PROBE" = "1" ]; then
	PE=$(grep -c 'd2da-probe .*"phase":"after-enable"' "$LOG")
	PD=$(grep -c 'd2da-probe .*"phase":"after-disable"' "$LOG")
	echo "probe lines after-enable/after-disable: $PE/$PD (expect $((TOGGLES + 1))/$TOGGLES)"
	if [ "$D2DA_SMOKE_STRICT_LEAKS" = "1" ] && { [ "$PE" -ne $((TOGGLES + 1)) ] || [ "$PD" -ne "$TOGGLES" ]; }; then
		echo "FAIL: probe line counts != expected (D2DA_SMOKE_STRICT_LEAKS=1)"
		RESULT=1
	fi
	echo "probe after-enable:"
	probe_table after-enable
	echo "probe after-disable (leak deltas first->last):"
	if ! probe_table after-disable; then
		if [ "$D2DA_SMOKE_STRICT_LEAKS" = "1" ]; then
			echo "FAIL: probe after-disable deltas != 0 (D2DA_SMOKE_STRICT_LEAKS=1)"
			RESULT=1
		else
			echo "note: probe deltas != 0 (leaks expected until Phase 2; not failing)"
		fi
	fi
fi

# Error signatures: only classes an extension can cause (JS + GObject/Clutter/
# St/Gjs criticals). Headless/session noise (cogl viewport, systemd scopes,
# portals) is ignored. Pids, timestamps and numbers are stripped.
# Shutdown part: JS errors only (criticals and their stack traces are counted
# above instead).
SIG="$LOG.sig"
{
	runlog | grep -E 'JS ERROR|JS WARNING|had error|unable to layout|(GLib-GObject|Gjs|Clutter|St|GLib)-(CRITICAL|WARNING)|TypeError|ReferenceError|extensions/'
	downlog | grep -E 'JS ERROR|JS WARNING|TypeError|ReferenceError' | grep -v 'CRITICAL'
} |
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
