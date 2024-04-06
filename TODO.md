# ./autohide.js

54:  use dock scale factor
154:  window tracking should be made global
201:  change to struts rect

# ./services.js

129:  these are blocking calls. async these.

# ./dock.js

342:  why the need for upscaling
486:  pinpoint the cause of the errors
607:  optimize this. there has to be a better way to get the separators -prev and -next
630:  avoid creating app-info & /tmp/-.desktop files
657:  add explanations
662:  find a way to avoid this
677:  find a way to avoid this
689:  cleanup this mess
759:  avoid creating app-info & /tmp/-.desktop files
805:  add explanation
844:  use dock size limit - add preferences
862:  why not use icon-spacing? animation spread should only be when animated
898:  check with multi-monitor and scaled displays
904:  for removal
909:  make dock area equal the monitor area - speed consideration?
915:  avoid !vertical ? use ifs for readability
937:  for removal
977:  add layout here instead of at the
982:  move these generic functions outside of this class
1257:  add explanations

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
348:  make these computation more readable even if more verbose
357:  make more readable -- use ifs..
378:  find a more efficient way
502:  use ifs for more readability
517:  use a more description variable name
552:  use ifs for more readability
608:  add scaleFactor?
634:  use easing functions here
666:  frame count is not accurate ... check if the animatton has ended
701:  why not scaleFactor?

