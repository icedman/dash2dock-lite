# ./autohide.js

54:  use dock scale factor
154:  window tracking should be made global
201:  change to struts rect

# ./services.js

129:  these are blocking calls. async these.

# ./dock.js

112:  avoid creating app-info & /tmp/-.desktop files
342:  why the need for upscaling
487:  pinpoint the cause of the errors
596:  optimize this. there has to be a better way to get the separators -prev and -next
619:  avoid creating app-info & /tmp/-.desktop files
646:  add explanations
651:  find a way to avoid this
664:  find a way to avoid this
678:  cleanup this mess
746:  avoid creating app-info & /tmp/-.desktop files
790:  add explanation
819:  use dock size limit - add preferences
837:  why not use icon-spacing? animation spread should only be when animated
873:  make dock area equal the monitor area - speed consideration?
874:  check with multi-monitor and scaled displays
912:  add layout here instead of at the
917:  move these generic functions outside of this class
1181:  add explanations

# ./animator.js

31:  replace dashContainer with dock
126:  justify these, and determine effects on jitterness
134:  why is padding hard coded?
165:  -p replace with a more descriptive variable name
188:  what is the difference between set-size and set-icon-size? and effects
207:  use better collision test here?
293:  make more readable
308:  make computation accurate rather than guesswork
321:  make computation accurate rather than guesswork
330:  make these computation more readable even if more verbose
339:  make more readable -- use ifs..
360:  find a more efficient way
480:  use ifs for more readability
495:  use a more description variable name
530:  use ifs for more readability
586:  add scaleFactor?
612:  use easing functions here
668:  why not scaleFactor?

