## media playing

```js
media = Main.panel._centerBox.first_child.child._delegate._messageList._scrollView.last_child.get_children()[0]

v = media._players.entries(0)
v.next().value
```

## gsettings

S = imports.gi.Gio.Settings
s = new S({schema_id: 'org.gnome.desktop.wm.preferences'})
s.get_string('button-layout')

## coolest animation

https://github.com/PuruVJ/macos-web-svelte-dock

## Preferences improvement

AdwExpanderRow

## Recent files

~/.local/share/recently-used.xbel