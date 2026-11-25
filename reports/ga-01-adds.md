# ga-01: game additions (all versions)

Branch game-adds (worktree scratchpad/game-adds-wt), from 496f1066.

## 1. Mikey's collect quest: DONE (411037a7)
- Removed step `lost_property` from arc_mikey in src/content/arcs.ts. Story now: pizza_trial -> russian_hackers -> ...
- The step's own pickup line (MIKEY: "YEEEE. Wot majik. Am a wizard.") went with it, as part of the quest the user asked to remove. No other line changed; the laptop-scene lines about losing everything stay.
- Grep: no other code refers to the step id (map markers / collect pickups in HubScene are generic over open collect steps).
- Old saves: arc progress is by step flag; leftover arcspot_arc_mikey_lost_property_* flags are ignored. Unit tests in tests/arcs.test.ts.

## 2. Bike: IN PROGRESS
