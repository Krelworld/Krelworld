# Chef Marina — audit brief, round 2 (read this first)

## What this is
"Chef Marina" is a pixel-art sandbox game made by a dad for his daughter **Marina, aged 5½, the only player**.
She **cannot read**: everything must work through pictures, symbols and voice. She plays on an **iPhone**, in portrait
and in landscape, both in Safari and as a home-screen app.

She has told her dad: **"it's a little confusing."** The owner's instruction, verbatim:
> "Do not fuck with any of the functionality, but do a full audit to make it more intuitive, less cluttered."

Since she said that, the game has roughly tripled in size (a basement, an upstairs, a pool, a big backyard, two
grandparents, a second cat, wildlife and about ten new full-screen activities). She has played the main floor for a few
days; she has NOT yet seen most of the new areas. So habit cost is real on the main floor and low in the new areas —
but the new areas multiply whatever was already confusing, and add new ways to get lost.

## The one hard rule
**Nothing she can do today may be removed or behave differently.** Every activity, choice, outcome, voice line, saved
thing and shortcut must still exist and do the same thing afterwards.
Allowed: how things LOOK and where they SIT — sizes, positions, spacing, icons/pictures on buttons, the ORDER of choices,
which things are shown at the same time, when prompts appear, visual affordances/hints/animations, consistency of
close/back/confirm buttons, hiding things that are irrelevant in the current moment (as long as they come back when
relevant and are still reachable in the same number of taps or fewer), grouping, and wayfinding aids.
Not allowed: removing a feature or a choice, adding extra taps to reach something she already uses, changing what a
button does, changing game rules/timers/outcomes, changing saved-data formats, re-recording or removing voice lines,
new art generation, new features beyond pure wayfinding/hint visuals made from existing pictures and emoji.
Weigh **habit cost** on the main floor: moving a well-used control needs a real payoff.

Things the dad has already complained about (do not regress them; prefer plans that further them):
interruptions during activities (crying baby / cat poop / wishes / chatter popping up while she cooks, draws, reads,
swims…); buttons too small or too close to the screen edge; interactive things hidden under side buttons; the ✖ on some
screens unreachable in portrait or landscape; the "dress up" button not always needed on screen; landscape browser bars;
giving pictures/dishes to people not obvious enough; buttons covering the TV in landscape.

## Where things are
- Game (static HTML/JS/canvas, no build step): `/home/user/Krelworld/public/chef-marina/`
- Scripts load in this order; **later files override earlier ones by wrapping/reassigning global functions**
  (pattern: `const _old = fn; fn = function (...) { ...; return _old(...); }`):
  `audio.js engine.js world.js ui.js game.js features.js fort.js art.js scenes.js pics.js play.js calm.js react.js more.js nav.js story.js fun.js floors.js basement.js upstairs.js outdoor.js bricks.js spa.js stuffies.js family2.js minka.js legoshelf.js builder.js pool.js movies.js wildlife.js treeclimb.js trees.js`
  plus `style.css`, `index.html` (and `artifact.html`, a body-only copy of index.html used for publishing).
  Many files inject extra CSS at the bottom via `document.createElement('style')`. Code is dense: long one-line functions.
- The scene is a `<canvas id="cv">` inside `#stage`; furniture, people, animals are DRAWN on the canvas.
  Buttons/overlays are DOM elements. Logical scene is 180 units tall; the floor is y≈164; rooms are side-on, 250–1040 wide.
- Audit workspace: `/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/`
  — write scripts/screenshots/notes ONLY under your own sub-folder there.
  - Test harness: `/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js` (read its header comment).
  - Every choice the game offers today in ~210 situations, with what pressing it does: `.../scratchpad/audit/after3.json`
    (made by `.../scratchpad/audit/regress.js`; if after3.json is not there yet, use before1.json for the main floor).

## The world
- **Main floor** (room strip at the top): yard, dining, kitchen, playroom, foyer (front hall), living, bathroom.
- **Basement** (door in the foyer, prop `basedoor`; also the ⬇️ button under the map button): nunuroom ↔ den ↔ storage ↔ laundry.
  Nunu (grandma) lives here; Minka the shy tuxedo cat; Lego/tiles table, Lego display shelf, TV with films, fireplace, laundry…
- **Upstairs** (foyer stairs: 🪜 climb or 💺 Mommy's stairlift; also ⬆️): parents ↔ uphall ↔ mroom (Marina's room, bunk bed) ↔ milesroom; spa bathroom through a door in uphall.
- **Outside** (strip shows pool · yard · backyard): pool ↔ yard ↔ backyard. Backyard: Grandpa Jeff and his workbench, build plots, the big oak and pine (climb), small trees with toys, deer / turkeys / small animals now and then, back door to the basement den.
- `Floors` (floors.js) handles the floor pill (⬆️/⬇️ under the map), the room strip per floor, and the map rows.

## People and animals (globals)
`marina, daddy, mommy, rory` (Uncle Rory), `miles` (baby), `niko` (big grey cat), `nunu` (grandma, basement), `jeff` (Grandpa Jeff, backyard), `minka` (small shy cat, basement); deer/turkeys/birds via `Wildlife`.

## How to drive the game in a test
```js
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const g = await H.boot({ port: <YOUR PORT>, view: 'port', room: 'kitchen' });   // 'port' 390x844, 'land' 844x390, 'portSmall' 375x667, 'landSmall' 667x375
await g.calm();
await g.page.evaluate(() => { /* game globals are available here */ });
await g.shot('/abs/path/file.png'); console.log(await g.controls()); console.log(g.errors); await g.close();
```
Run with `NODE_PATH=$(npm root -g) node script.js`. Chromium is preinstalled (do NOT run `playwright install`). Use **your own port**.
Look at your screenshots with the Read tool. Ignore a console warning about chip_love.mp3 (pre-existing).

Useful globals inside `page.evaluate`:
- State `G` (`G.room`, `G.busy`, `G.holding`, `G.tv`, `G.poop`, `G.needTP`, `G.mess`, `G.fort` …), `E` (engine: `E.t`, `E.camX`, `E.viewW`).
- `ROOMS`, `PROPS[room]` (`id, a` = kind, `x, y`), `propActions(prop)`, `entActions(person)`, `selfActions()` → `[{ico, fn}]`, shown by `UI.actions(anchor, list)` as `.act` buttons. `g.tapWorld(x, y)` taps the canvas at world coords.
- Go places: `travelTo(room)`; `Floors.go(+1|-1)`.
- Screens: `UI.openCook('fridge'|'freezer'|'cabinet'|'bowl')`, `UI.openDress()`, `UI.openCrafts('math'|'spell'|'cut'|'dio'|'gal')`, `Studio.open()`, `startFort()`, `openStory()`, `openStickers()`, `openIsoMap()`, `gymMenu()`, `tvOn(showList()[0])`;
  new: `Bricks.open({kind:'lego'|'tiles'})`, `LegoShelf.open()`, `Spa.open({})`, `Stuffies.open({})`, `Builder.open({})`, `Pool.open({})`, `TreeClimb.open({tree:'oak'})` / `TreeClimb.view({})`, `Movies.open({})`. Each has `.close()`.
- Prompts: `showWish('cook')`, `askRequest('cook')`, `miles.crying = true`, `G.poop = true`, `Minka.hideNow()`, `Minka.fightNow()`, `Wildlife.visit()`, `Wildlife.turkeys()`, `GRAND.smell()` (Nunu's "smell" moment), Daddy on his phone: `daddy.state='phone'`.
- Title screen: boot with `start:false`.

## Feature list that must survive (main floor, from round 1)
Title (play → room picker + 🎲, dress-up, sticker book) · walking by tapping the floor, side arrows, room strip, map → picture map (with floors), swiping, doors, dragging Marina · five mood buttons (scenes with whoever is around) · tapping any object/person/Marina for choices · cooking (shelves, up to 5 ingredients, methods with a timing mini-game, spoken dish name, give/carry/change/again, family reactions incl. gross-food comedy, toilet + toilet-paper rescue) · dress-up · drawing studio (+ give / hang / carry / bin) · pictures on walls · crafts · blanket fort · gymnastics · climbing/sitting/bouncing · toy boxes + tidy + chase · TV + Mommy's phone reels · baby Miles (bottle, cuddle, nappy) · Niko · family (cuddle, rides, jokes, wake up, horseplay, requests) · bathroom · yard (leaves, snow, swings, monkey bars) · keyboard songs · story time (4 books, now 4 readers incl. Nunu) · tea party · family dinner · sticker book · hidden treasures · wish button · request button · alert buttons · face cards and speech bubbles.

## New features that must also survive
Basement (Lego & magnetic tiles builder with Nunu's turn button, Lego display shelf + gallery, films on Nunu's TV (5), fireplace, laundry, peekaboo, box rocket, basketball, Nunu's chores and helping her, Nunu's smell → tell Daddy 📞, Minka: trust/pet/treat/feather, hide-and-seek 🔍, Niko–Minka run-ins and 🙅) ·
upstairs (stairs and stairlift, spa bath game, stuffies on the bunk, bunk sleep, airbed trampoline, mirror, costumes, bassinet, books, ramp, arch…) ·
pool (swimsuits, extras, flippers, 8 jumps, toys, games with Daddy/Rory) · backyard (Grandpa Jeff: builder with 19 things, lumber limit, take-down, tree houses as rooms, hugs/high five/juggle/jokes/food; tree climbing + the treetop view; small trees' toys; deer, turkeys, birds; furniture toys: feeder, leaf pile, toolbox) ·
Daddy on his phone 📱 · Grandpa Jeff and Nunu reactions · new stickers.

## Rules for you
- **Audit phase is read-only for the game folder.** Do not edit, add or delete anything under `/home/user/Krelworld/`. No git commands that change anything.
- Write only inside your own sub-folder of the audit workspace.
- Be concrete: name the screen/state, the element (selector / function / file:line), and attach a screenshot path when a claim is visual.
- Do not invent: if you did not observe it or read it in code, say so.
- Never put real place names, the family's surname or any address in anything you write.
