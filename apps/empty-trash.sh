#!/usr/bin/sh
# gio emits proper trash:// change events (raw rm can miss the monitor);
# fall back to rm where gio is unavailable
if command -v gio >/dev/null 2>&1; then
    gio trash --empty
else
    rm -rf ~/.local/share/Trash/*
fi
