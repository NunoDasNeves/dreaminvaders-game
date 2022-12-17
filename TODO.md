## TODO
- split stuff into modules; render, update, data/gamestate
- table boids stuff for now, basic collision is ok!
- show little stabby/triangle weapon on attack aim/swing/recover
- health bars
    - appear when hit, fade after a second or so
- dying by falling off bridge (?)
- display unit types on bottom of screen
- select unit type with numbers (don't hardcode)
- click on lane to place unit (don't hardcode)
    - place on closest lane
    - don't randomize placement; place at a specific distance, on spot closest to mouse
- for debugging, cycle team with some button (TAB or something)
- add additional lanes! curves! bezier! probably!
    - units need to follow the lane properly without falling off
- Make the layout look more like the concept art
- unit acceleration instead of instant velocity change
- deal with avoidance conflict (they avoid the same way)
- better collision? pushing...impulse?
- better steering/avoidance?

## Done
- unit ID (or something) to check against when referencing other units (e.g. target), so we don't have problems reusing entity slots
- basic avoidance
- SIMPLE collision
- fail to spawn if not enough room
