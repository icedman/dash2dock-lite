
this is "visual" idea on how icons are animated -- not necessarily what is happening -- but the goal -- intuition on how macos does it



# static / unanimated dock
{{ [Icon] [Icon] [Icon] | [Icon] [Icon] }}


# when mouse pointer enters
1. each icon/icon container will have increased padding -- icon sizes not changd
{{ [   Icon   ] [   Icon   ] [   Icon   ] | [   Icon   ] [   Icon   ] }}

2. a facade -- rendering will be show overn the dock with rendered icons. the "real" icons will be hidden. right now - this facade is renderArea
      [Icon]       [Icon]       [Icon]         [Icon]       [Icon]
{{ [          ] [          ] [          ] | [          ] [          ] }}
these icon positions will be the position of each icon when the mouse is directly centered over them

3. the facad will be then layouted according to mouse pointer position
            [Icon] [Icon] [Icon] [Icon] [Icon]
{{ [          ] [          ] [          ] | [          ] [          ] }}
                      ^-- mouse here
positions of icons will be recalculated relative to their position to the mouse pointer
