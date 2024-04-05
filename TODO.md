# ./autohide.js

54:  use dock scale factor
154:  window tracking should be made global
201:  change to struts rect

# ./services.js

129:  these are blocking calls. async these.

# ./dock.js

112:  avoid creating app-info & /tmp/-.desktop files
339:  why the need for upscaling
484:  pinpoint the cause of the errors
593:  optimize this. there has to be a better way to get the separators -prev and -next
616:  avoid creating app-info & /tmp/-.desktop files
643:  add explanations
648:  find a way to avoid this
663:  find a way to avoid this
675:  cleanup this mess
743:  avoid creating app-info & /tmp/-.desktop files
787:  add explanation
816:  use dock size limit - add preferences
834:  why not use icon-spacing? animation spread should only be when animated
870:  make dock area equal the monitor area - speed consideration?
871:  check with multi-monitor and scaled displays
909:  add layout here instead of at the
914:  move these generic functions outside of this class
1185:  add explanations

# ./animator.js

31:  replace dashContainer with dock
131:  justify these, and determine effects on jitterness
139:  why is padding hard coded?
170:  -p replace with a more descriptive variable name
193:  what is the difference between set-size and set-icon-size? and effects
212:  use better collision test here?
298:  make more readable
313:  make computation accurate rather than guesswork
326:  make computation accurate rather than guesswork
335:  make these computation more readable even if more verbose
344:  make more readable -- use ifs..
365:  find a more efficient way
485:  use ifs for more readability
500:  use a more description variable name
535:  use ifs for more readability
591:  add scaleFactor?
617:  use easing functions here
649:  frame count is not accurate ... check if the animatton has ended
684:  why not scaleFactor?

