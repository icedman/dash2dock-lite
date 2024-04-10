Now that Dash2Dock Animated is beyond proof-of-concept... Make it a proper extension, not just a kludget.

# Structure

DockContainer
+--RenderForeground
+--Dock
   +--DockWidget
   +--DockWidget
      ---> RenderForeground
      ---> RenderBackground
+--RenderBackground

DockServices (subscription model)
+--Trash
+--MountedDevices
+--Notifications
+--AppCount
+--Preview
+--IconsCache
+--Monitors
+--MPRIS

# DockContainer

Contains the Dock and other renderer. This will clip the widgets to the assigned monitor.

# Dock

Dock allows any widget to be docked at any edge of the screen.

* may be assigned a child or multiple children
* may be assigned to a monitor
* has vertical and horizontal layout
* handles animation loop (not the rendering)
* handles autohide

```js
class Dock {
    
    add_child();

    slide_in();

    slide_out();

    set_dock_position();

    set_orientation();

    set_autohide(settings);

    dock();

    undock();

    _layout();

    _animate(delta);

    start_animation();

    end_animation();

    _debounced_end_animation();
}
```

# DockWidget

* widget that may be added to a dock

```js
class DockWidget {

    on_animate(delta);

    preferred_size(constraints);
}
```

# Animator
