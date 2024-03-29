## TODO
- start game timer/anim/delay
- end game - lighthouse death anim + VFX
    - base dreamers (on losing team) need to fade away when game ends?
- dreamer animations (all the dreamers)
    - switching team/active/inactive needs to happen with a timer
        - can put a state timer on aiState
    - idle
    - move - non looping whooshy
        - maybe accel vs decel
    - active vs inactive?
- tower defense new anim - lightning
    - need animations - idle (crackle), attack (charge, fire, dormant)
- Spawn animation - beam of light
- crystals need a bit of update
    - they need to fade out, pop nicely
- Bit of UI rearrange? where to put souls + screams
- sort units for drawing back to front
- death anim - pair with soul entity spawning
- unit hit lighthouse anim -'explode' - pair with soul entity spawning
- finish island art
- falling off bridge animation - need to draw behind bridge too...
- increase island radius a bit so units can't fall off while near the pixel art part
- Tutorial menu + screens
- change victory & defeat sounds to music, so we can stop them when going back to main menu
    - no loop tho

## Stretch
- (lane) dreamers bob up and down?
- Menu use new assets
- tank sprites are not really done (need to be shiny & slimy)
- unit specials - slime, nightling boosts

## Done
- make bridges purple
- pixel art spawn platforms + bridge start
- AI is too dumb again - should choose from cheapest upgrades
- dreamer color shoud be a glow or something, around the head
- fix up economy tracking
- dreamer gold should arrive when crystal pops
- dreamers
    - separate update goes through and gives gold, spawns crystals
    - sprite head offset for crystal spawning
- draw base dreamers and get em into the game when you buy the eco upgrades
- AI update - AI can do all actions, and actually does them (randomly tho)
- make dreamers move around a bit - toward lane controller unit, float back to center otherwise
- unit shadows
- soul sprite thingy - crystal ball
- Placeholder icons to be replaced - souls, screams, upgrades
- lighthouse art
- lighthouse healthbar - remove from UI, make its normal healthbar thicker, more visible
- use another color color (yellow) instead of player color for $creams
- ditch lane select; mouse click to spawn unit (or keyboard tap?)
- keep all relevant unit properties relevant in unit.csv
    - attack timings
- make unit + weapon parameters tuneable from CSV
- make souls fly around
- click to create units, or mouse + press hotkey (make it an option)
- 2 resources - gold (screams) + souls
- make tower a unit with weapon instead of special case
- make tower an upgrade
- refactor animation system/status - dont do special stuff for atk except hold some data for when swing is, hit, etc..
- basic/rough slime tank anims
- mannon tank anims (draft)
- chogoringu attack anim
- background gradient
- auto static D firing - for bot and 2 player local
- dummy sounds
- sfx volume param
- basic icons or text or something for upgrades
- static defense; mouse click laser with cooldown, does some damage, limited range. auto for bot and shared keyboard
- units damage lighthouse damage gold too
- display debug info about income
- update art and music
- fix: lighthouse HP bar not appearing
- add some basic sfx - victory, defeat, spawn unit
- add eco upgrades
- add attack upgrade/add armor upgrades
- lock units behind upgrades
- fix units being able to attack each other from different lanes
- fix issues with units being able to attack stuff when it's past the lane (should just be tweaking and stuff)
- round spawning areas at end of each lane (on the island)
- dirt paths join up into single path to lighthouse, which is set further back on island
- make UI stuff into buttons (for 1 player)
- make lanes clickable in 1 player mode
- update unit stats
- armor
- VFX entity type - now can spawn, update and render VFX independently of units
- fix regression: UI not displaying units
- weapons: compute hit at start of swing state and store it - so renderer can use it during swing
- make music loop cleanly
- get music playing
- units, weapons, sprites all use a similar data format
- AOE weapon with basic visual effect
- add a 3rd unit type - AOE ranged attacker
- animation - fix flicker on change to animation with different number of frames
- Keep lighthouse healthbars in UI on bottom of screen
- In debug mode draw AI player UI
- basic menu titles (Title, Paused, Game over etc...)
- simple AI player (every couple seconds, pick a lane and spawn a random unit, or idle)\
- draw lane select hotkeys
- dont draw debug stuff on non-debug game
- draw 2nd player hotkeys
- support multiple player types - keeping in mind scenarios EvE, PvE, PvP (local)... (any maybe PvP remote)
- per-unit cooldown
- dreamer: most units past center of lane = lane control = increased gold rate
- basic menu for initting game etc
- reset game if a lighthouse is destroyed - i.e. complete the full game 'loop'
- reset game function + debug hotkey
- unit colors based on team - probably easiest to extend spritesheet
    - program to do spritesheet extensions we need
        - flip
        - recolor
- fix units staying in chase and not attacking - allow them to attack when only MOSTLY stopped, not fully
- display unit types, cost, hotkey, on bottom of screen
- display player/s resource count/s
- resources go up over time
- making a unit uses resources
    - debug option to increase resources
- separate concept of 'team' for identifying friend/foe, and 'color' for rendering - they could diverge!
- improve collision...remove velocity normal to collision
- dont fall off edge when chasing or proceeding (as much)
- unit come to a stop in attack range, instead of trying to get really close (try just increasing the range a tad first)
- make units push each other less; especially friendlies - maybe separation force?
- unit acceleration instead of instant velocity change
- for debugging, cycle team with some button (TAB or something)
- select unit type with keys - just press the button to send the unit on the current lane
- export sprites faster - created flipped version with exporter script
- add another unit type for testing, actual placeholder graphics for it
- basic perf counters - fps and updates per frame
- basic animation - unit walk cycle
- load placeholder graphics for testing
- Make the layout look more like the concept art
- 'lighthouse' (unit?) with hp. Units are 'spent' when they go inside, and reduces the hp
- units ignore others when on the last leg to the lighthouse
- stop attacking or chasing enemies that are on the last leg to go into the lighthouse
- click on lane to place unit (don't hardcode)
    - place on closest lane
- add additional lanes! curves! bezier! probably!
    - units need to follow the lane properly without falling off
- dying by falling off bridge
- death animation, unit can hang around after death and not be targetted
- 'hit' effect - flash red or something
- health bars
    - appear when hit, fade after a second or so
- show little stabby/triangle weapon on attack aim/swing/recover
- table boids stuff for now, basic collision is ok!
- split stuff into modules; render, update, (static) data, (game) state
- unit ID (or something) to check against when referencing other units (e.g. target), so we don't have problems reusing entity slots
- basic avoidance
- SIMPLE collision
- fail to spawn if not enough room

## Cut
- audio system upgrade? - use audio.js for music and sfx, since they'll share most stuff
    - play music by name from game/app code, don't read App state
        - maintain state of playing, not playing, which song etc...
    - use audio api and audio nodes for sfx - gain, fadeout etc... reuse from music
    - use sound pool for sfx - max of same sfx playing at once; 3-5, so we aren't cloneNode()ing constantly
- make units slow down/stop when path is blocked, before colliding and sliding off the bridge (while proceeding)
    - this is also mitigated by just increasing sight radius, because they start chasing and slowing down a bit earlier
- debug key or button to reload data
- debug UI - options to enable debug draw stuff at runtime
    - store the settings in local storage and restore them
- perf: debug display: how long an update() takes
- better collision or AI for collision
    - less jittering/bouncing
    - support pushing (when we want it) - use unit mass or something
- better steering/avoidance?
    - deal with avoidance conflict (they avoid the same way)?
    - use velocity to determine how far ahead to look
        - use other units velocity to determine where they'll be
    - capsule doesn't work well, use a half circle (circle and then only consider stuff in front)
