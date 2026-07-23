#!/usr/bin/sh
# gio emits proper trash:// change events (raw rm can miss the monitor);
# fall back to rm where gio is unavailable
if command -v gio >/dev/null 2>&1; then
    # gvfs discovers mounted-volume .Trash-$UID dirs lazily; enumerate first
    # so --empty reaches volume trash too, not just the home trash
    gio list trash:// >/dev/null 2>&1
    gio trash --empty
else
    rm -rf ~/.local/share/Trash/*
fi
