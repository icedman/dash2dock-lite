-----------------------------------------
This happens when a window is closed - maybe fatal to some users.
Reproduce
1. open a window
2. close a window via menu (where the d2da is still animating)
-----------------------------------------

clutter_text_get_text: assertion 'CLUTTER_IS_TEXT (self)' failed
st_widget_get_theme_node called on the widget [0x5e4720e00f90 StLabel.dash-label:insensitive ("(null)")] which is not in the stage.
clutter_actor_get_preferred_width: assertion 'CLUTTER_IS_ACTOR (self)' failed
clutter_text_get_text: assertion 'CLUTTER_IS_TEXT (self)' failed
st_widget_get_theme_node called on the widget [0x5e4720e00f90 StLabel.dash-label:insensitive ("(null)")] which is not in the stage.
clutter_actor_get_preferred_height: assertion 'CLUTTER_IS_ACTOR (self)' failed
Spurious clutter_actor_allocate called for actor 0x5e4720e00f90/unnamed [StLabel] which isn't a descendent of the stage!

Spurious clutter_actor_allocate called for actor 0x5e4720e00f90/unnamed [StLabel] which isn't a descendent of the stage!



-----------------------------------------
This happens when an icon is unpinned while still bouncing
-----------------------------------------
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a4b50 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:872 (33e4ef018560 @ 119)
#1   7ffe9e6a4c20 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:915 (33e4ef018600 @ 378)
#2   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#3   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#4   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#5   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#6   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#7   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#8   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#9   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to set any property on it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a4c20 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:910 (33e4ef018600 @ 290)
#1   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#2   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#3   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#4   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#5   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#6   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#7   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#8   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a4c20 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:912 (33e4ef018600 @ 336)
#1   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#2   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#3   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#4   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#5   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#6   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#7   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#8   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a4b50 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:866 (33e4ef018560 @ 29)
#1   7ffe9e6a4c20 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:915 (33e4ef018600 @ 378)
#2   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#3   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#4   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#5   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#6   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#7   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#8   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#9   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a4b50 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:872 (33e4ef018560 @ 119)
#1   7ffe9e6a4c20 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:915 (33e4ef018600 @ 378)
#2   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#3   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#4   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#5   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#6   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#7   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#8   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#9   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to set any property on it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   607754a73d08 i   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:934 (33e4ef0186a0 @ 6)
#1   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#2   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#3   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#4   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#5   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#6   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#7   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#8   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a41f0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:866 (33e4ef018560 @ 29)
#1   607754a73d08 i   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:935 (33e4ef0186a0 @ 38)
#2   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#3   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#4   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#5   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#6   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#7   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#8   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#9   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)
Object .Gjs_ui_dash_DashIcon (0x60775902d970), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6077549a99d0 ==
#0   7ffe9e6a41f0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:872 (33e4ef018560 @ 119)
#1   607754a73d08 i   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:935 (33e4ef0186a0 @ 38)
#2   7ffe9e6a4ce0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:384 (33e4ef009240 @ 46)
#3   7ffe9e6a4d50 I   self-hosted:203 (715aa197ab0 @ 245)
#4   7ffe9e6a4e00 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:382 (33e4ef0091f0 @ 31)
#5   7ffe9e6a4ec0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:395 (33e4ef009150 @ 277)
#6   7ffe9e6a4f80 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (33e4ef0059c0 @ 41)
#7   7ffe9e6a5080 b   self-hosted:203 (715aa197ab0 @ 245)
#8   7ffe9e6a5130 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (33e4ef005970 @ 83)
#9   607754a73c78 i   resource:///org/gnome/shell/ui/init.js:21 (715aa170bf0 @ 48)

-----------------------------------------
This happens when an icon is being dragged and re-arranged
-----------------------------------------
(gnome-shell:32804): Gjs-CRITICAL **: 19:36:08.153: Object St.Icon (0x6099e462bb40), has been already disposed — impossible to get any property from it. This might be caused by the object having been destroyed from C code using something such as destroy(), dispose(), or remove() vfuncs.
== Stack trace for context 0x6099e0f55db0 ==
#0   7ffd5f054480 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/services.js:677 (11421c6f35b0 @ 79)
#1   7ffd5f054610 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:679 (11421c6ea6a0 @ 6092)
#2   7ffd5f054740 I   self-hosted:203 (236cc8a97ab0 @ 245)
#3   7ffd5f054740 I   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/animator.js:315 (11421c6ea560 @ 2813)
#4   7ffd5f054810 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/dock.js:1132 (11421c6dec40 @ 204)
#5   7ffd5f0548c0 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/dock.js:1169 (11421c6ded30 @ 20)
#6   7ffd5f054970 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:242 (11421c6d6ec0 @ 59)
#7   7ffd5f054a30 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:141 (11421c6d6b00 @ 41)
#8   7ffd5f054aa0 I   self-hosted:203 (236cc8a97ab0 @ 245)
#9   7ffd5f054b50 b   file:///home/iceman/.local/share/gnome-shell/extensions/dash2dock-lite@icedman.github.com/timer.js:139 (11421c6d6ab0 @ 83)
#10   6099e1021a38 i   resource:///org/gnome/shell/ui/init.js:21 (236cc8a70bf0 @ 48)
GNOME Shell-Message: 19:36:08.178: Icon created: org.gnome.Terminal [org.gnome.Terminal]
^Cmake: *** [Makefile:49: test-shell] Interrupt
