# Final build plan
Critic verdict: fixed
Core fixes by critic: Two edits in /home/user/Krelworld/public/chef-marina/clarity-core.js; nothing else in the game folder was changed, and nothing was committed.

(1) Hook lists are now copy-on-write. In C.hook, add() builds a new array and assigns it to p.before / p.after.
- Defect found by critic/core_attack.js: a hook registered while the same point is running made an already-run hook run twice. The log read 'aab'. This can happen from inside a hook, or from a listener that fires synchronously inside quietFor().
- After the fix: first call 'a,b', second call 'late,a,b'.

(2) Clarity.nudgeX accepts opt.dir (+1 or -1). With it, only shifts in that direction, or no shift, are allowed. G17 and G26 need 'shift toward the room's centre'; before this, the helper always returned the smallest shift in either direction. It is backward compatible; checked as {any:24, left:-54, right:24, right with max 10: null}.

Verification of the patched core, all in /tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/critic/:

Boot (boot.js):
- port, land, portSmall and landSmall: zero page errors.
- 39 switches, 18 points, all 17 bare-name bindings resolve to the core.
- Events fire in the expected order.

core_attack.js / core_attack.json:
- Wrapper identity:
  - Every binding is still the same core wrapper after opening all 16 screens and about 25 s of play.
  - drawExitSigns is stable after builder's single re-wrap.
  - drawExitSigns and featTick hooks run 60.5 times per second, i.e. once per frame.
- Pass-through:
  - hitTest gives the same answer through the wrapper as Clarity.inner, at 7 rooms × 675 points, with no hooks and with live no-op hooks: 0 differences.
  - currentActivity is equal in 4 holding states.
  - The exception from a throwing game function is identical.
  - this === UI.
- screenOpen() matches inActivity()'s screen part on every screen: cook, dress, crafts, studio, story, stickers, map, Lego, tiles, shelf, spa, stuffies, builder, pool, tree and movies.

Full regress sweep with all plumbing live (regress-plumb.js, plumb_live.json, plumb_vs_head.txt):
- Active during the sweep: a no-op before and after hook on every point, a listener on every event, a 50 ms tick calling quietFor and hudRects, pointer down and up, appear on every div and button, and a stylesheet.
- Results: 379 choices, 0 problems, HARD 0. All 21 flows as expected (the 4 that differ also differ between the two HEAD runs).
- The 9 review rows were re-pressed A/B, 4 times each, under identical unloaded conditions with HEAD on 8847 (ab_rows.js): wicker, stool and shades are identical in both builds, and the Miles 🤗/✋ rows vary randomly in both.
- So the core with every feature live is inert. The switch-off path (hooks registered but off) is a strict subset of this and was not separately swept.

Also done outside the core: I stopped 15 http.server processes in the workers' port ranges (8850–8929). All served the main tree, with no clients attached:
- 10 stale ones from earlier phases: 8851–8853, 8861, 8871–8873, 8912, 8921 and 8922;
- my own 8890–8894.
harness.serve() reuses any server already on a port, so workers would otherwise have tested the main tree instead of their worktree.

## Core API
Two new files, both in /home/user/Krelworld/public/chef-marina/. Global: window.Clarity (C below).

A. clarity-flags.js (loaded FIRST, before audio.js)
- Clarity.ids = ['G1'..'G39']; Clarity.on = {G1:true ... G39:true} (the switches, decided at page load).
- Test overrides, never stored: URL ?clarity=off | ?clarity=-G3,-G19 | ?clarity=only:G3,G9 ; or window.CLARITY_OFF = 'all' | 'G3,G19' | ['G3'] set before load. Playwright: await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, 'G3,G9') then goto or reload.
- Clarity.ready: false until DOMContentLoaded, i.e. until every clarity file has loaded. Clarity.is(id) === (Clarity.ready && Clarity.on[id] === true).
- LOCAL EDITS in game files test `window.Clarity && Clarity.is('G6')`. This works at any time and is false while the page is still loading.
- Overlay code that runs at load reads Clarity.on.Gn directly.

B. clarity-core.js (loaded after trees.js). Clarity.core === 1 once it has loaded.

SWITCHES AT RUN TIME
- Clarity.set(id, bool): flips a switch. Hooks, listeners, ticks, pointer and appear callbacks stop or resume at once. CSS follows at once.
- Clarity.onToggle(id, fn(on)): callbacks so an item can undo or redo inline state when its switch flips.
- Setting Clarity.on.Gn = false by hand also works, except for onToggle; CSS then follows within 250 ms.
- Clarity.item(id, setupFn): runs setupFn once at load, only if the switch is on, inside try/catch.

HOOKS (use these instead of wrapping a game function): Clarity.hook(point, id, { before(call), after(call), order })
- Points, each wrapped ONCE by the core and outermost over every game wrapper: 'UI.actions', 'UI.closeActions', 'UI.bigIcon', 'UI.pulseMoods', 'UI.bubble', 'UI.update', 'Audio2.blip', 'onTap', 'hitTest', 'interact', 'currentActivity', 'onEnterRoomBy', 'checkMess', 'showWish', 'openIsoMap', 'drawProp', 'drawExitSigns', 'featTick'. Clarity.points() lists them.
- call = { name, self, args, result, skip }.
- before(call) may set call.skip = true, and call.result if needed, so the game's own function is not called. The first skip stops the remaining before-hooks.
- after(call) runs after the game's function. It also runs after a skip, so check call.skip. It may replace call.result.
- In both, this === call.self. Never mutate call.args.
- order: lower runs first (default 0); equal orders run in registration order.
- Hooks run only while Clarity.on[id] is true.
- A hook that throws is reported once (console.warn 'clarity: Gn before X') and its changes to skip/result are undone.
- With nothing registered, or every hook switched off, the wrapper is exactly the game's call: same this, arguments and return value.
- Clarity.inner(point): the game's own function under the hooks. Call it to bypass every clarity hook, e.g. to replay a deferred icon: Clarity.inner('UI.bigIcon')(ch, ms).
- drawExitSigns: builder.js:234 re-wraps it once on the next frame. The core's wrapper sits inside builder's and still runs exactly once per frame (measured 60/s). Never re-wrap anything yourself.
- Not hook points:
  - ui.js internals: actions() and openPanel() call the private closeActions; placeActs is private. Use local edits (G6, G7).
  - askReq is private to fun.js. Use a local edit (G31) or Clarity.appear('#reqBtn').
  - changeRoom: use the 'room' event.
  - say: G22 is a static table.
  - resize and the camera: only the layout worker changes framing, through engine.js:169, game.js:286 and calls to resize() and render() by name.
- Example: Clarity.hook('checkMess', 'G2', { order: 10, before(c) { if (Clarity.busyNow() || Clarity.quietFor() < 10) c.skip = true; } });
- Example: Clarity.hook('hitTest', 'G8', { order: 10, after(c) { const h = c.result; if (h && h.kind === 'prop') c.result = see(h, c.args[0], c.args[1]); } });

EVENTS: Clarity.listen(evt, id, fn)
- 'room' (was, room): after every real room change. Dispatched from a Floors.hooks entry, i.e. from floors.js's changeRoom, which is the outermost one.
- 'screenOpen' / 'screenClose': Clarity.screenOpen() turned true / false.
- 'activityStart' / 'activityEnd': Clarity.busyNow() turned true / false. On activityEnd, Clarity.endedAt = E.t (game seconds).
- The start of a game (the title closing) is a screenClose and an activityEnd.
- Edges are sampled every 100 ms, and also synchronously whenever Clarity.quietFor() or Clarity.sample() is called, so an edge fires once, never late for a reader.
- Example: Clarity.listen('activityEnd', 'G1', () => { lastInput = E.t; });

TIMER: Clarity.every(ms, id, fn(nowMs))
- One shared 50 ms setInterval. fn runs at most every ms (minimum 50) while the switch is on.
- Example: Clarity.every(100, 'G15', tick);

TOUCHES: Clarity.pointer('down' | 'up', id, fn(event))
- One window capture listener per type (passive), installed on first use. It runs before any game handler sees the event.
- Look only: never preventDefault or stopPropagation.
- Example: Clarity.pointer('down', 'G1', () => { lastInput = E.t; });

NEW NODES: Clarity.appear(selector, id, fn(node))
- One MutationObserver on body (childList, subtree), installed on first use.
- fn runs as a microtask, before paint, for every added element matching selector, whether it is the added node itself or inside an added subtree.
- The node may already be gone again, so check isConnected.
- Example: Clarity.appear('.stk-toast', 'G27', t => { if (Clarity.screenOpen()) { t.style.display = 'none'; queue.push(t.textContent); } });

CSS: Clarity.css(id, cssText) returns a <style data-clarity='Gn'> appended to <head>.
- Clarity styles are kept after every game stylesheet: Bricks, LegoShelf, Pool, Movies, Stuffies and Spa append theirs the first time they open, and the core moves ours back to the end.
- media='not all' while the switch is off.
- Call it as often as you like per item.
- Example: Clarity.css('G14', '@media (orientation:portrait){#roombar{max-width:calc(100% - 84px)}.rb{flex:0 1 40px;min-width:34px}}');

STATE HELPERS
- Clarity.bodyBusy(): marina.state is swing, bars, ride or wheel, or a looping anim. False before the game exists.
- Clarity.screenOpen(): any of the following is up:
  - the title;
  - any #panel screen, including the map, the fort builder and interior, Lego/tiles, the shelf, pool, films, stuffies, spa, tree climb and the builder;
  - Studio.active, #storyBox or #stkBox.
  The TV and the fort tray are not screens.
- Clarity.busyNow(): inActivity() || bodyBusy().
- Clarity.quietFor(): game seconds since the last activity ended. 0 while one is going on; Infinity before any ended.
- Clarity.endedAt: E.t of the last activity end (null before). Clarity.sample(): re-evaluate the edges now.
- Clarity.playing(): marina exists and the title is hidden.
- Clarity.landscape(): innerWidth > innerHeight.

GEOMETRY HELPERS
- Clarity.hudRects(st?, opt?) returns [[x0,y0,x1,y1], weight, kind, element] for every visible HUD control.
  - Kinds: strip (#roombar .rb), pill (#floorpill .fl:not(.off)), map, arrow (.navarrow:not(.off)), weather (#weatherBtn:not(.hidden)), alert (#alerts .alertb), face (.facecard.show), stop (#stopBtn:not(.hidden)), book and dress (not .off), wish, req, give (#fx .pichint), call (.cm-call), mood (#moodbar .mood), moodToggle.
  - Skipped: zero-size controls, visibility:hidden, and opacity < 0.05 on the control or an ancestor.
  - Weight 4. In landscape, mood and moodToggle get weight 6 and are widened 8 px to the left.
  - Coordinates are relative to st (a DOMRect, e.g. placeActs' stage rect) or to #stage. opt.client gives viewport coordinates.
  - opt.kinds and opt.except filter by kind.
  - Cached 250 ms (dropped on resize and orientationchange). opt.fresh measures now.
  - Controls outside the picture (the tall-portrait dock, the portrait mood row) are included; they overlap nothing in it.
  - Example (G6): if (window.Clarity && Clarity.is('G6')) { acts.hud = acts.hud || Clarity.hudRects(st, { fresh: true }); for (const x of acts.hud) avoid.push(x); }
- Clarity.stageRect(): #stage's DOMRect, cached 250 ms.
- Clarity.toClient(wx, wy) gives viewport px. Clarity.fromClient(cx, cy) gives world coordinates.
- Clarity.onCanvas(cx, cy): elementFromPoint there is #cv, i.e. nothing covers the picture at that point.
- Clarity.overlap(a, b): overlap area of two [x0,y0,x1,y1] rects.
- Clarity.nudgeX(box, rects, { gap = 4, max, bounds: [minX, maxX] }) returns the smallest sideways shift in px that clears every rect at the box's height (hudRects entries or plain rects), or null if none within max.
  - Example: const dx = Clarity.nudgeX(b, Clarity.hudRects(null, { except: ['give', 'call'] }), { max: 62, bounds: [0, st.width] });
- Clarity.floorLevel(room): main 0, up +1, basement -1, outside 0, tree houses 0.5, unknown rooms 0.
- Clarity.floorDir(from, to): +1 up, -1 down, 0 same level.
  - Example (G39): const fd = window.Clarity && Clarity.is('G39') ? Clarity.floorDir(prev, G.room) : 0;

MOTION HELPER
- Clarity.shake(el, { px = 4, ms = 150, times = 2 }) returns an Animation or null.
- It is a side-shake on the individual translate property only, with composite 'add'. Without composite support it starts from the element's computed translate.
- So transforms, CSS animations, :active scales and centring translates keep working, and a CSS animation:none cannot cancel it.
- Example: Clarity.shake(btn); Audio2.blip(-12, 'triangle', 0.08, 0.1);

MISC
- Clarity.warnOnce(key, err).
- Item state and item helpers live on Clarity.Gn, e.g. Clarity.G18 = { target: null } and Clarity.G23 = { hintGap() {...} }. Never on G, never in localStorage.

Tools in /tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/:
- regress-flags.js: run regress.js with switches off. CLARITY_OFF=all|G3,G9 NODE_PATH=$(npm root -g) node regress-flags.js <port> <out.json> [gameDir] [only=flows].
- core_boot.js, core_hooks.js and core_flags.js: the core proofs, reusable as templates.

## Load order
Script order in index.html and in artifact.html. The two lists are identical, checked with diff.

clarity-flags.js (NEW, first)
audio.js engine.js world.js ui.js game.js features.js fort.js art.js scenes.js pics.js play.js calm.js react.js more.js nav.js story.js fun.js floors.js basement.js upstairs.js outdoor.js bricks.js spa.js stuffies.js family2.js minka.js legoshelf.js builder.js pool.js movies.js wildlife.js treeclimb.js trees.js (unchanged)
clarity-core.js (NEW)
clarity-prompts.js, clarity-status.js, clarity-rings.js, clarity-bubbles.js, clarity-dock.js, clarity-layout.js, clarity-screens.js, clarity-wayfinding.js (8 NEW empty stubs, one per worker, in workers-list order)

Files created in /home/user/Krelworld/public/chef-marina/: clarity-flags.js, clarity-core.js, and the 8 stubs. Each stub holds only a header comment, a load guard (`const C = window.Clarity; if (!C || !C.core) return;`) and an empty IIFE. index.html and artifact.html are edited. Nothing is committed.

Why this order:
- Flags first, so any game file, including load-time code and the earliest timers, can call Clarity.is or read Clarity.on.
- The core after trees.js, so each of its 18 wrappers is outermost over every game wrapper. The one exception is by design: builder.js re-wraps drawExitSigns once to keep its late drawing last, and the core's wrapper runs inside it.
- Worker files after the core, so they can register hooks at load.
- The order among worker files does not matter:
  - hooks carry explicit order numbers (see conventions);
  - CSS is split by property ownership, so no two workers set the same property on the same element;
  - the only shared load-time writes (G22 fills missing SAY_ICON keys; G31 sets the existing m_want_fort) commute.
- Load-time literals and loops in early files are never edited: REQS in fun.js, ROOMS.nunuroom in basement.js:7, the tree-house loop at builder.js:928. Those changes are applied from the overlay at load (G31 WISHES/SAY_ICON, G36 ROOMS icons, G22 SAY_ICON) or at call time (G31 askReq).

Merge order of the worker branches: prompts, status, rings, bubbles, dock, layout, screens, wayfinding.
- rings must come before layout, because G19 narrows the landscape picture and relies on G7's wrapping tray.
- Local edits are line-disjoint across workers, so any order merges cleanly.

## Conventions
1. YOUR FILES
- Each worker owns one overlay file: its stub clarity-<name>.js, already loaded by index.html and artifact.html.
- It also owns the local edits listed for it under workers, and nothing else.
- Never edit: clarity-flags.js, clarity-core.js, index.html, artifact.html, style.css, or lines owned by another worker.
- If you need a core change, report it. Do not patch the core.

2. SWITCHES. Every item's code checks its own switch.
- Hooks, listeners, ticks, pointer and appear callbacks, and Clarity.css registered with the item id are gated by the core.
- Load-time overlay code: if (Clarity.on.Gn) {...}. Add Clarity.onToggle(id, fn) to undo it when the switch flips.
- Local edits in game files: window.Clarity && Clarity.is('Gn').
- A switch that is off must give byte-for-byte today's code path and look.
- Test with ?clarity=-Gn, ?clarity=off, or CLARITY_OFF via an init script.

3. LOCAL EDITS
- Mark the changed line /* Gn */. Keep edits as small as possible, ideally one line.
- The switch-off branch is today's exact expression.
- Never add a top-level let, const or function to a game file. Classic scripts share one global scope, and a duplicate name is a SyntaxError that kills that whole file. Put state inside the file's existing IIFE or closure next to the edit, or on Clarity.Gn. more.js is top-level code, so G21 keeps its state on Clarity.G21.
- Never edit object literals or loops that run at load: REQS in fun.js, ROOMS in basement.js:7, builder.js:928. Apply those changes from the overlay at load or at call time.
- Find code by its text. Line numbers are as of this core and shift.

4. HOOKS, NEVER WRAPPERS
- Never reassign a game global or a UI or Audio2 method. Use Clarity.hook.
- Assigned orders (lower runs first):
  - UI.actions: before G2:10 | after G7:10, G30:20, G2:40 (only records whether a tidy ring opened), G18:30.
  - UI.closeActions: after G18:10, G27:20.
  - onTap: before G18:5 (never skips), G15:10 (never skips), G35:20 (may skip).
  - interact: before G18:10.
  - hitTest: after G8:10.
  - currentActivity: after G17:10.
  - onEnterRoomBy: before G20:10.
  - checkMess: before G2:10.
  - UI.bigIcon: before G27:10.
  - UI.pulseMoods: before G24:10.
  - UI.bubble: after G26:10.
  - UI.update: after G5:10.
  - Audio2.blip: before G15:10.
  - openIsoMap: after G36:10, G37:20, G38:30.
  - drawProp: after G35:10.
  - drawExitSigns: after G35:10.
  - featTick: after G26:10.
  - showWish: free; use 10.
- After-hooks must check call.skip.
- To call a hooked function without re-entering its hooks, use Clarity.inner(name).
- Events: room (G4, G18, G23, G35); activityEnd (G1); screenOpen (G2, G27); screenClose (G27).
- Pointer: G1 down; G15 up.
- Appear: G23 '#alerts .alertb' (or a tick), G25 '#reqBtn' and '#wishBtn', G27 '.stk-toast'.
- Ticks: G4 200 ms, G15 100 ms, G23 250 ms, G35 250 ms, G37 300 ms, G38 200 ms.
- G3, G9 and G16 use MutationObservers of their own, on elements they own.

5. CSS
- Only through Clarity.css(id, text), one or more per item. Never edit style.css or inject <style> yourself.
- Prefix every new class or keyframe with cm-.
- Property ownership on shared elements. Two workers never set the same property on the same element:
  - #xFloat: screens.
  - #panel and its screens (cooking, dress-up, crafts, Bricks, the canvas screens), #studio, #storyBox and #stkBox: screens. Two exceptions: the map's content (.fmap, .fmaprow, .fmaproom and the .isosvg additions) belongs to wayfinding, and .isoroom.here's transform-box/transform-origin belongs to bubbles (G5).
  - #title padding and .tpick: layout (G13).
  - #moodbar and #moodToggle: layout owns position, size, display, the folded slot, background, handle and chevron in landscape. status owns .mood opacity, filter and shake, and the animation of #moodbar.pulse and .mood.
  - .navarrow: layout owns the right offset. status owns the animation and the inner <i> bob.
  - #roombar / .rb: layout owns position, landscape centring, max-width and .rb size/flex. wayfinding owns the #roombar background and the .rb.cm-gp dot. status owns .rb opacity, filter and shake.
  - #floorpill / .fl: wayfinding owns the colour ring (box-shadow), data-dest and .fl i font-size. status owns .fl opacity, filter and shake.
  - #alerts / .alertb: layout owns #alerts' landscape centring. status owns .alertb animation, .settled, data-born, the tp colour, opacity, filter and shake.
  - .facecard: layout owns .facecard.right's landscape offset. status may only shake a face card; nobody dims them.
  - #weatherBtn: layout.
  - #dressBtn / #bookBtn: dock owns tall-portrait position, size, visibility guard, glide and wiggle. layout owns the landscape right offsets.
  - #stopBtn: nobody moves, translates or rescales it. Its glyph comes from the currentActivity hook (bubbles, G17).
  - #wishBtn / #reqBtn: dock owns position, size, glow animation, badge, span glyph and the ghost. status owns #reqBtn opacity, filter and shake.
  - .say, .pichint, .cm-call and the bigIcon look: bubbles. The timing of ✨ big icons: dock (G27).
  - .act, .acttray, .actback, .cm-badge and ring placement: rings.
  - .stk-toast and the fly layer: dock.
  - Canvas drawing: rings (the glow in nav.js, the deer tab); wayfinding (signs, edge tabs, the floor slide); status (the idle wiggle); layout (zoom and camera).
  - #app classes: status adds cm-strip, cm-mood and cm-alert; layout may add its own cm-* classes.

6. POSITION AND MOTION
- HUD and dock buttons are positioned with left/top/right/bottom and the individual translate property, never transform. Game rules such as :active, pulse and .facecard scale use transform.
- Transient motion: Clarity.shake, el.animate on translate, or a pointer-events:none ghost element.
- Clarity code never calls preventDefault or stopPropagation. A tap is never swallowed or retargeted, with one documented exception: G35's tab tap.

7. DATA
- Nothing new on G, in localStorage or sessionStorage, or in saved data. Item state lives on Clarity.Gn.
- Never call propActions or entActions just to look: fun.js's wrapper marks treasures found. G18 also never calls hitTest.

8. TESTING SETUP
- Serve your worktree: H.boot({ port, view, room, dir: '<worktree>/public/chef-marina' }).
- Ports: worker k (0-based position in the workers list) uses 8850+10k to 8859+10k:
  - prompts 8850-8859, status 8860-8869, rings 8870-8879, bubbles 8880-8889
  - dock 8890-8899, layout 8900-8909, screens 8910-8919, wayfinding 8920-8929
- harness.serve() reuses any server already listening on a port, whatever directory it serves. Never point one port at a second directory.
- Views: port, land, portSmall, landSmall, plus the sizes a check names (pass {width,height} as view): 844x340, 390x664, 390x585, 375x553 and others.
- Desktop env() is 0, so simulate safe-area insets with padding, as the verdicts did. Checks that name her iPhone stay owner checks.
- Scratch files only under /tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-<name>/.

9. REGRESSION SWEEP
- Run: cd .../scratchpad/audit && NODE_PATH=$(npm root -g) node regress.js <port> <out.json> <worktree>/public/chef-marina
- Then: node regress-diff.js .../audit2/arch/head1.json <out.json> .../audit2/arch/head2.json
  head1/head2 are today's committed game, without clarity, run twice: the clean baseline and the noise reference.
- The core build is .../audit2/core_regress.json.
- Diffing against after3.json also works, but expect the rows already explained in core_tests: the fixes committed after after3.json was recorded.
- Switch-off sweep: CLARITY_OFF=<your ids or all> NODE_PATH=$(npm root -g) node .../audit2/arch/regress-flags.js <port> <out.json> <dir>
- Run sweeps one at a time on an idle machine. Under load the game's dt cap slows game time, and the 1.6 s samples catch earlier states.

10. DONE MEANS, PER WORKER
a. Every item is built exactly as its reconcile entry says.
b. Each item's must-still-work list from the draft and every EXTRA CHECK of BOTH lenses has been run in the harness and passes. Results are saved in your scratch folder. A check that needs another worker's item is written down as an integration check with its expected result, never silently skipped.
c. Zero page errors in port, land, portSmall and landSmall, with all switches on and with your switches off. The pre-existing chip_love.mp3 warning is the only allowed message.
d. The regress sweep has no LOST SITUATION, LOST CHOICE, BROKEN or failed flow. Every remaining difference is noise or one of the expected renames listed in your items.
e. The switch-off sweep for your ids shows no difference beyond noise.
f. The worktree diff touches only your overlay file and your listed /* Gn */ lines.
g. Commit only on your worktree branch, never on main, never push, unless the orchestrator says otherwise.

11. AFTER MERGING (integration phase)
Integration checks:
- G19 × G7: keyboard (8) and TV (9) lists at 667x375 and 844x390 show every choice without scrolling.
- G19 × G11 / G35 / G17 / G26 / G6: tabs, signs, bubbles and rings clear of ▶ at right:0 and of the column.
- G19 × G16 / G27: 📒 and 👗 stay at today's landscape spots, and the sticker flight lands there.
- G4 × G39: a cross-floor arrival in the living room in landscape runs one animation with no stretched frame.
- G3 × G37 / G38: the landscape map with the lane still wraps its rows, no tile sits under #xFloat, and the house picture keeps its size.
- G15 × G25: #reqBtn dims during scenes.
- G30 × G35 / G36 / G39: the up/down badges match.
- G22 × G31: m_want_fort shows 🏰 with G31 on and ⛺ with it off.
Then a full sweep vs head1/head2 with all expected renames, and a CLARITY_OFF=all sweep equal to today.

## Core tests
Every proof script and log is in /tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/.

1. BOOT (core_boot.js, ports 8840-8843; port/living, land/kitchen, portSmall/living, landSmall/kitchen)
- Zero page errors in all four views.
- Clarity.ready is true, 39 switches are on, and there are 18 hook points.
- All 17 bare-name bindings resolve to the core's wrapper: onTap, hitTest, interact, currentActivity, onEnterRoomBy, checkMess, showWish, openIsoMap, drawProp, featTick, UI.actions, UI.closeActions, UI.bigIcon, UI.pulseMoods, UI.bubble, UI.update, Audio2.blip.
- drawExitSigns is builder.js's late wrapper with the core's inside it, as designed.
- Opening and closing cooking, then travelling, logged screenOpen, activityStart, screenClose, activityEnd, room:living>dining. Nothing was logged once the test switch was off.
- floorDir: foyer→uphall +1, foyer→den -1, den→backyard +1, backyard→treehouse_oak +1, yard→pool 0, kitchen→living 0.
- hudRects kinds as expected: in portrait strip, pill, map, arrow, book, dress, mood; landscape adds face and moodToggle.
- Screenshots: core_<view>.png.

2. HOOK SEMANTICS (core_hooks.js, port 8844)
- Hooks ran in order (order 1 before order 5), and an after-hook replaced the result.
- A before-hook that set skip and then threw was undone: the game's function still ran, and the error was reported once.
- A switched-off hook never ran.
- skip returned the hook's result without calling the game function, and this and the arguments passed through.
- A drawExitSigns after-hook ran 60 times per second: exactly once per frame, inside builder's re-wrap.
- Ticks, pointer, appear and css all follow their switch. Clarity.set toggled the CSS live (outline 3 → 7 → 3 px).
- A game <style> appended later was followed again by the clarity styles.
- hudRects in stage and client coordinates are correct, and so is nudgeX.

3. SWITCHES (core_flags.js, port 8845; check_flags_patch.js)
- CLARITY_OFF='all' through an init script: 0 switches on, and the game still starts.
- ?clarity=-G3,-G19, ?clarity=only:G7,G9 and ?clarity=off all parse correctly. 0 errors.
- regress-flags.js's patch reaches pages created the way regress.js creates them (G3 and G9 off).

4. REGRESSION SWEEP AS SPECIFIED (port 8846)
- .../audit2/core_regress.json: 379 choices pressed, 0 problems.
- regress-diff after3.json core_regress.json before2.json: 209 situations, 379 choices. 364 identical, 10 noisy, HARD problems 0, 5 to review. All 5 are explained:
  - 3 × 🎨 (den ltable, dining table, playroom kidtable) now record studio:false→true. This is ALREADY_FIXED fix 4 (window.Studio), committed at 06:40, after after3.json was recorded at 05:56.
  - storage/hoop 🏀 and Miles 🤗 differ only in the state sampled 1.6 s after the press.
- Flow differences: dress-up tiles 38→19 (fix 3), wish tour draw→studio (fix 4), and the crafts spell count and mood 'during' (both random).

5. CLEAN CONTROL
- Today's committed game was extracted with git archive HEAD (no clarity files) and swept twice (ports 8847 and 8848).
- Two runs of the unchanged game differ from each other in 23 rows. One of those counts as 'hard' by the tool's rule: the chip_love warning inside a random mood flow.
- regress-diff head1.json core_regress.json head2.json: 360 identical, 13 noisy, HARD 0, 6 to review. All 6 are state-at-sample-time rows (perch, cheer, anim) or Mommy's random phone refusal.
- six_rows.js re-pressed those 6 choices 4 times each in both builds, under the same unloaded conditions: identical states in both. Mommy's 📱 outcome is random in both.

6. ALL SWITCHES OFF (CLARITY_OFF=all, flows only, unloaded, through regress-flags.js)
- 19 of 21 flows are identical to a HEAD run.
- The other 2 (mood love 'during', the wish-button tour) also differ between the two HEAD runs.
- An earlier niced run that overlapped two sweeps showed 'tap floor walks' with walked:false. It passed when re-run unloaded: a load artifact (the game's dt cap).

7. BEHAVIOUR FOUND WHILE RECONCILING (map_ring.js, run on HEAD)
- Today a ring she opened survives opening and closing the map: 2 choices before, under and after.
- This is why G2's screen-open step was narrowed.

8. GIT STATE
- index.html and artifact.html are modified, with identical script lists.
- 10 new files: clarity-flags.js, clarity-core.js and the 8 stubs.
- Nothing is committed.

- **prompts** (clarity-prompts.js): G1, G2, G20, G21, G28, G29 [78 KB brief]
- **status** (clarity-status.js): G15, G23, G24 [63 KB brief]
- **rings** (clarity-rings.js): G6, G7, G8, G11, G18, G30 [79 KB brief]
- **bubbles** (clarity-bubbles.js): G5, G17, G22, G26 [67 KB brief]
- **dock** (clarity-dock.js): G16, G25, G27, G31 [77 KB brief]
- **layout** (clarity-layout.js): G4, G13, G14, G19 [59 KB brief]
- **screens** (clarity-screens.js): G3, G9, G10, G12, G32, G33, G34 [99 KB brief]
- **wayfinding** (clarity-wayfinding.js): G35, G36, G37, G38, G39 [87 KB brief]

## Conflicts
- G19: Folding the mood column. The child lens says folding never resizes the picture: the folded column keeps its slot. The functionality lens keeps the draft's 'folding widens the picture', guarded by width-change checks. With widening, every hello re-unfolds a folded column and the picture jumps 77 px under her finger. → Use the child's rule: the slot stays, shown as a purple lane under the 😊 handle, with the faces hidden. Every functionality constraint (a)-(e) and every functionality EXTRA CHECK still holds. Controls keep today's screen spots in both states, resize() runs only on real width changes, and the right face card can never cover 😊. Nothing she can do today is lost, because nothing in the room is under a face any more. The functionality version would not be pointless, but it would add an untested jump.
- G25/G16: Prompt placement in tall portrait. The child lens wants one re-centred row [✋][📒][👗][prompt] that shrinks members and shifts ✋. The functionality lens measured that this moves buttons under her finger: a wish tap became ✋ and dropped her dish. → The functionality lens wins: each item gets one fixed slot, chosen per screen size, and nothing moves because another button came or went. The child's parts that fit inside that slot are kept: the asker's face badge for all four askers in every layout, the prompt as big as fits (84, then 72, then 64 px, then today's corner), the box-shadow glow, and the glide as a pointer-events:none ghost.
- G27: The child lens says do not defer stickers: some are deliberately timed to pop inside their screen (Lego shelf, story end, film end), and it wants 📒 shown and tappable for 2.5 s when the toast lands. The functionality lens says hide the toast during screens and replay it after, with no look-only peek. It showed the peek would put a visible but dead 📒 over the picture, recreating G16's mis-tap. → The functionality lens wins on both points. Its version is safe and still teaches her where stickers go. The jingle, the stars and m_sticker still play at the moment of earning; only the picture waits. The child's rule that a deferred treasure icon is never dropped is added. Owner note: the in-screen sticker moments the dad built now show their picture after the screen closes.
- G17: Give-bubble placement. The child lens nudges a bubble sideways, then downward until it is clear. The functionality lens says moving a bubble down onto a head turns a tap on that person into serve or give. It also found that a fixed x-clamp makes neighbouring bubbles overlap. → The functionality lens wins. Bubbles move sideways only, by the smallest shift that clears the live HUD rects (Clarity.nudgeX). Overlapping bubbles are spread apart around their midpoint. If nothing within one bubble width works, the bubble keeps today's spot. This works both before and after G19 ships, which removes the draft's assumption that G19 is not yet in.
- G26: The child lens wants to drop the !G.septic gate at family2.js:145, because the repeated smell is the only reminder in the basement and a comedy scene. The functionality lens keeps the gate as a safe spacing of an event the game starts by itself. → The functionality lens wins: the gate stays. It is safe, and the still 📞 bubble over Daddy now carries the job. The child's extra rule is added: no .cm-call while Daddy's own speech bubble shows. The functionality conditions (inActivity, bodyBusy, no .act or .pichint) already cover the TV, give bubbles, rides and tidy.
- G29: The child lens wants no limit on far-room mews: the mew is the cue that she is in another room. It wants paws shown with every mew instead. The functionality lens keeps the draft's limit of one far mew per 30 s, with paws when a mew is skipped. → The functionality lens's limit stays. The child's 'every far mew comes with its direction' is added, so pawHint now shows on every far-room cue, with the mew or instead of it. Both hold. The find-rate check guards the child's concern.
- G31: Draw wish and request 🖍️→🎨. The functionality lens keeps it; the child lens drops it, because 🎨 is the dining room's strip icon and the dress-up colour tab, and 🖍️ is the studio's first tool and the draw sticker. → The child lens wins. The functionality version would make this part worse for her: a 🎨➡️ wish reads as 'go to the dining room'. Dropping it is a safe subset of the functionality version. The chip 🐱→🐈 is dropped by both lenses. The fort 🏰 and Niko 🐟 swaps stay, applied at call time or at load behind the switch, never in a load-time literal.
- G33: Built-thing recolour 🎨→🖌️. The functionality lens keeps it; the child lens calls it churn: 🎨 already means 'change its colour', and 🖌️ is a studio drawing tool. Also: should the movie ⏹️ become ◀️? → The child lens wins on 🖌️: it is pointless for her, so 🎨 stays. Both lenses keep Movies ⏹️, because ◀️ next to the paused ▶️ reads as rewind. Take-down 🧹→🗑️ is applied at all five builder places (398, 402, 503, 595, 596). The story's ✖️→❌ comes with .st-back moved to left:80px.
- G34: Popcorn hand and Nunu's 🧱 badge. The functionality lens keeps both, with fixes. The child lens drops them: the popcorn hand invites a mid-film tap that triggers Nunu's voice and face card; the badge is clipped or covers her face and adds a second pulsing thing. → The child lens wins: both are pointless or harmful for her, and dropping a hint is always functionally safe. Both lenses drop the treetop change, because the landmarks already twinkle. What is built: the shelf's one-time hop wave (Gy.pending is never touched) and the spa hand.
- G35: What the edge tab does. The child lens wants it to approach the exit and then use the door, keeping the side arrows' promise to travel. The functionality lens wants it to walk only, exactly like the existing exit-sign tap, and never change room by itself. The two lenses also differ on where signs are drawn: in the prop pass behind people, or in drawExitSigns. → The functionality lens wins on the action: a tab that travels would be a new travel route, which the brief forbids. It has the canvas turkey-tab look, not the DOM side-arrow look, so it does not borrow the arrows' promise. Drawing: both hold. Signs are drawn in a drawProp after-hook, behind people; the edge tab in a drawExitSigns after-hook. The core wraps drawExitSigns once, and builder.js re-wraps it once by design. New signs are still; the existing basement sign keeps its bob.
- G37: Room icon beside people on the main map painting. The draft and functionality lens keep it; the child lens calls it clutter on a main-floor screen she knows. Also: the child wants the 'here' room's outline solid, while the functionality lens forbids restyling .isoroom. → The child lens wins on the icon: a look-only change with less clutter, and the functionality lens has no safety stake. The outlines are separate cm-outline polygons with pointer-events:none, so the 'here' outline can be solid without restyling .isoroom. Both hold.
- G38: Pill colour. The child lens wants today's light fill, with the floor colour replacing the white border. The functionality lens wants the white border kept, with a tint or a thick border on the light fill. → Both hold. Today's fill, white 3 px border and glyphs stay. The destination floor's colour is a 4 px outer ring via box-shadow, keeping the existing drop shadow, so no box size changes. Map-row colour uses background, shadow or outline only, never padding.
- G24/G18: The draft swaps the mood faces' wobble for a yellow glow ring. The child lens keeps the existing per-face wobble and only stops the whole bar from moving. The glow is also G18's 'this is what you picked' cue. → The child lens wins: a look-only change, which avoids giving the warm glow two meanings. The functionality lens has no safety stake. The CSS is only #moodbar.pulse{animation:none!important}, plus the greeting-throttle hook.
- G15: The draft dims face cards; both lenses say never, because they are the talking portraits in every scene and the story. Which mood stays bright: the functionality lens keeps .mood:not(.cur), but the child lens showed .cur is a dead 😢 during ring-started hugs and jokes. → Face cards are never dimmed; they only shake on a dead tap. All five moods dim, except the face whose scene was started by a live tap within 500 ms. Purely visual, so both hold. #reqBtn joins the dim set (child). Dead taps are decided from the live rules at tap time (both lenses). The shake is translate-only through the core's Clarity.shake. That also fixes the specificity clashes the lenses flagged with .alertb.settled (G23) and #moodbar.pulse .mood (G24): a WAAPI animation cannot be cancelled by animation:none.
- G8: Which of the rocker and the toy shelf is painted on top. The child lens says the rocker is in front; the functionality lens says the shelf is (both are wall props, drawn in PROPS order, rocker first). → Both lenses state one principle: the prop she can see at that point answers. The worker checks the real paint order in the code and applies the matching rule. Never hand a visibly-on-top shelf pixel (a toy bin she may have learned) to the rocker. No bounding boxes anywhere.
- G12/G3/G33: Sticker-book ✅. The draft pins it top-right; both lenses measured that it covers the 💎 header and first-row stickers. The functionality lens's alternative and the child lens's choice are both a sticky ✅ at the bottom. #stkBox is also padded by G3 and restyled by G33. → ✅ is sticky at the bottom (both accept it). All three items are in the screens worker, so #stkBox has one owner.
- G20: Marina's duplicate 'hi Nunu' reply. The child lens's fix: reply only if this call changed the stamp. The functionality lens's fix: a per-person replyAt with a 10 s window. The draft's single global timer would block the other grandparent's reply. → Both together in the same /* G20 */ edit. The stamp check stops duplicate calls; the per-person replyAt also covers the septic-thanks branch. The draft's global timer is dropped.
- G21: The child lens keeps the draft's extra walk-up condition. The functionality lens showed it makes Rory leave the yard about 1.7 times as often while she swings. → The functionality lens wins: the condition is unchanged. Inside the branch, while bodyBusy, Rory stays put and turns to her.
- G28: Start wish. The child lens retries only for alerts, requests and crying. The functionality lens also waits for .act, inActivity and bodyBusy. Both skip when the start event already brought a wish. → The functionality lens's wider wait set, plus the shared skip-when-a-wish-shows rule. With nothing asking at 4.2 s, the behaviour is identical to today.
- G32: Numbers for the studio's floating ❌: the functionality lens uses a column cut of 64 px and 6 px from the bottom, the child lens 72 px and 10 px. Only the functionality lens adds the body:has(>#studio) guard. → The child's 72 px and 10 px (a gap of at least 10 px below the last tool), plus the functionality guard. A 52 px button inside the 60 px column; the paper bitmap unchanged.
- G9: Pass bar for landscape cooking. The child lens says 3 rows of food are unreachable and accepts 2 full rows plus a partial one. The functionality lens says constrain the grid rows so only the food scrolls, then require 3. → Constrain the rows (functionality). Aim for 3 rows; never fewer than 2 full rows plus a partial one. The meter scroll is computed from getBoundingClientRect, not offsetTop.
- G5: The draft's ✋ :active fix. The functionality lens measured no bug: #stopBtn's id rule beats .hud:active. Separately, the child lens showed bubbles moved up by translate would land on the alert row or under the strip. → The #stopBtn part is dropped; no new press dip. The child's per-frame clamp is added: computed analytically, with cached HUD rects, never measuring the moved node. Both hold.
- G3: The draft computes the lane in a 250 ms tick. The functionality lens measured that a late lane skews the crafts canvas (kx 1.095) and moves tiles between pointerdown and pointerup. → The functionality lens wins: a synchronous MutationObserver recompute; cm-lane is removed before canvas screens lay out; #xFloat.on is never read.
- G7/G19: G7's tray top moved by a 250 ms tick would slide choices under her finger when an alert arrives. G19 narrows the landscape picture, which turns the keyboard's 8 choices into a tray at 667x375. → The tray top is set once, when the list opens (functionality). rings merges before layout, and G19's 'keyboard 8 and TV 9 show every choice' check runs after both are merged.
- G2/G37: The draft's G2 closes 'any ring still open when a full screen opens'. A harness check on today's game showed a ring she opened survives opening and closing the map, because openIsoMap never closes rings. Closing it would change something she can do today. → Narrowed. On the screen-open edge, UI.closeActions() runs only to clear a leftover backdrop with no ring (the openPanel case that ate her first tap) or an open 🧹🏃 tidy ring. Any ring she opened herself stays exactly as today. Both lenses' G2 EXTRA CHECKS still pass.
- G30/G6: The draft's badge has pointer-events:none. Both lenses measured that a tap on the arrow then falls through to the backdrop (the ring closes and no trip starts), or onto a mood face in landscape. In the draft, a badge can also sit over the mood column until G6 ships. → No pointer-events:none, and line-height:1, so the badge is part of its own button. G30 and G6 are in the same worker and ship together. No regress rename is expected; the badge is checked in the DOM.
- G22/G31: Both write SAY_ICON at load. The verdicts ask whether the order matters, since G22 must not overwrite m_want_fort. → G22 fills only keys that do not exist, and m_want_fort already exists. The two writes commute, so the worker files can load in any order.
- G15/G23/G24/G25: Shared elements with competing animations and transforms: .alertb (G15's shake vs G23's settle), .mood (G15's shake vs G24's pulse), and #reqBtn (G15's dim and shake vs G25's position and glow). → G15, G23 and G24 share one worker (status). Clarity.shake animates only the translate property with composite 'add', so no CSS animation or transform wins over it. #reqBtn is split by property: dock owns position, size, box-shadow glow and badge; status owns opacity, filter and the translate shake.
- G36/G31/G22/G1: Changes evaluated at load in early files (REQS in fun.js, ROOMS in basement.js:7, the builder.js:928 loop) run before any late overlay exists. A guarded local edit there would never take effect, and an unguarded one could not be switched off. → clarity-flags.js loads first, so Clarity.on and Clarity.is exist from the first script. Load-time data is still never edited in place. G36 sets ROOMS icons from the overlay at load (every reader is lazy). G31 sets WISHES and SAY_ICON at overlay load, and maps the request icon at call time in askReq. G22 fills SAY_ICON at load. Local edits use Clarity.is(), which is false until every clarity file has loaded.
- G35: builder.js:234 re-wraps drawExitSigns on every featTick until its own wrapper is outermost again. If clarity also insisted on being outermost, the two would add a wrapper every frame. → The core wraps drawExitSigns once at load. builder re-wraps once and then stays on top. The core's hook runs inside it, exactly once per frame (measured 60/s). No worker ever re-wraps anything.
- G5/G6/G7/G17/G18/G23/G26/G31/G33/G37/G39/G20: Five game files are edited by two workers: ui.js (G5 vs G6/G7), nav.js (G17 vs G18), features.js (G23 vs G37/G39), fun.js (G33 vs G31) and family2.js (G26 vs G20). → Every edit is on different, non-adjacent lines. ui.js: G7 at :49, G6 at :72-73, G5 at :101. nav.js: G17 at :61-67, G18 at the glow IIFE :153-174. features.js: G39 at :395-397, G37 at :413, G23 at :598-599. fun.js: G33 at :38, G31 at :82-83. family2.js: G26 at :145, G20 at :171-179. Each worker locates its code by text, and merges are line-disjoint.
- G4/G39: Arriving in the living room from another floor in landscape changes the zoom (a resize) while G39's vertical slide runs on the same canvas. → Integration check after merging layout and wayfinding: exactly one #cv animation, no stretched frame, same landing spot. G4 calls render() right after resize(), so no blank frame shows.
- G11/G19/G35/G17/G26/G6: G19 narrows the landscape picture and moves ▶ to right:0. Deer and turkey tabs (clearZone/tabY), G35's signs and tabs, G17's and G26's bubbles, and G6's mood avoidance were all measured with today's overlay column. → Every placement reads live geometry: wildlife's clearZone, Clarity.hudRects and Clarity.nudgeX, with no fixed offsets. After merging: check at the backyard's right end, at land and landSmall, with the column open and folded.

## Critic issues
- [blocker] process: worker worktrees: The core and the 8 stubs are untracked files, and the index.html and artifact.html edits are unstaged ('Nothing is committed'). Worktrees created from the branch will contain none of it, so no worker can load the core or its own stub. → The orchestrator commits clarity-flags.js, clarity-core.js (including the critic's two fixes), the 8 stubs, index.html and artifact.html on the session branch before creating any worker worktree. The critic was told not to commit.
- [blocker FIXED] test environment: ports 8850-8929: Stale python http.server processes were listening on 8851, 8852, 8853 (prompts range), 8861 (status), 8871–8873 (rings), 8912 (screens), 8921 and 8922 (wayfinding), plus the critic's own 8890–8894 (dock). All served /home/user/Krelworld/public/chef-marina. harness.serve() reuses any server that answers /index.html, so H.boot({port, dir: worktree}) would have silently tested the main tree, giving false passes and failures. → Stopped all 15; no client processes were running, and 8850–8929 is now empty. Added an addendum making every worker check its servers' working directory before testing.
- [major] process: regress sweeps (conventions 9): 'Run sweeps one at a time on an idle machine' cannot hold with 8 parallel workers on 4 cores. Under load the dt cap slows game time: flows fail (the architect saw 'tap floor walks' walked:false) and the 1.6 s samples shift (🧗 perch on stools and the wicker chair, Miles 🤗 anim). Workers would misread noise as regressions, or the reverse. → Every regress.js / regress-flags.js run takes a shared lock: flock -x .../audit2/sweep.lock <cmd>. Rows that differ are re-pressed A/B under identical conditions before being judged (critic/ab_rows.js is a template).
- [major] G6 (rings): ui.js placeActs local edit; architecture integration note 'rings avoid the kinds dress, book, give, call, wish, req': The edit measures hudRects(st, {fresh:true}) at ring-open time. At that moment it includes buttons that the opening ring itself hides: the .pichint give bubbles (nav.js picHints requires no .act), 📒/👗 (nav.js calm requires no .act, and 📒 follows 👗) and G26's .cm-call (hidden while an .act exists). Measured in critic/g6_vanish.json, in port, land, portSmall and landSmall: 1–3 'give' rects (e.g. over Daddy's head while she holds a dish) and 'book'/'dress' are present at open, and gone right after (hintsAfter 0, dress and book off). Rings would be pushed off their usual spot, e.g. Daddy's ring while she carries a dish, for no benefit: a main-floor habit change. → Use Clarity.hudRects(st, {fresh:true, except:['give','call','book','dress']}). Correct the integration note to 'wish, req'.
- [major] G27 (dock): UI.closeActions after-hook replay of deferred ✨: ui.js:52's choice handler runs UI.closeActions() before a.fn(). A choice that opens a screen therefore opens it immediately after the hook returns. Measured with the dining table's 🎨 (critic/g27_closeorder.js): screenOpen() is false inside the hook and true when the same tap handler returns. A replay inside the hook plays 💎✨ under the screen, where it expires unseen. That breaks 'never dropped' and the check 'treasure then a choice that opens the studio: the icon appears once, after the studio closes'. → Never replay synchronously in the hook. Schedule it with setTimeout 0 or the next tick, re-check screenOpen(), and otherwise wait for screenClose. The same applies when G2's screenOpen listener calls UI.closeActions().
- [major] G29 reconcile entry (prompts): Only the child lens amended G29; the functionality lens kept the draft without amending it. By the stated rule the child's amendment supersedes the draft. Yet the entry keeps the draft's once-per-30 s far-mew limit and only grafts on the child's always-paws rule. That is inconsistent with how G18, G22, G23 and G24 were reconciled (single-lens amendments applied in full). The child's version is functionally safe: mews as today, plus more silent canvas paw hints. → Addendum for prompts: keep the far mew exactly as today and call pawHint(s.room) on every far cue while G29 is on; no farMewAt limit. Keeping the 30 s mute would need an explicit owner decision, because it weakens a hide-and-seek cue.
- [minor FIXED] clarity-core.js C.hook: A hook registered while its point was running made an earlier hook of that call run twice (for...of over an array spliced in place). Possible from inside a hook, or from a listener that fires synchronously inside quietFor(). → Copy-on-write lists. Verified: 'a,b', then 'late,a,b'.
- [minor FIXED] clarity-core.js C.nudgeX: It always returned the smallest shift in either direction. G17 and G26 require 'sideways only, toward the room's centre'. → Added opt.dir (+1/-1). Backward compatible.
- [minor] G18 (rings): ring-open state: ui.js also closes rings privately: a new ring replacing an old one (actions()), openPanel(), and update() when the anchor leaves the room. None of these fire the UI.closeActions hook. G18 would then keep 'ring open' and hold every other prop's glow at 0 until her next tap or a room change. → Derive 'ring open' live from '#fx .act' (addendum).
- [minor] G19 (layout) × G15/G24 (status): folded column: The ownership table does not say how folded faces are hidden. If layout uses opacity or filter on .mood, status's dim rule (#app.cm-mood #moodbar .mood:not(.cm-awake){opacity:.45}) outranks it and shows folded faces at 45%. → Layout hides folded faces with visibility:hidden, or display:none on .mood. Status may additionally scope its dim to #moodbar:not(.collapsed).
- [minor] G25 (dock): landscape and short-portrait slot left:calc(env(safe-area-inset-left) + 122px): #wishBtn and #reqBtn are absolute inside #stage, which already starts at env(safe-area-inset-left) (#app padding). The rule double-counts 47–59 px on her iPhone. Tests that simulate insets with padding leave env() at 0, so the harness cannot catch it. #stopBtn is width:auto, so 122 px needs checking against the widest ✋ chip. → Use stage-relative left:122px and measure #stopBtn with every currentActivity glyph (addendum).
- [minor] G25 (dock): glide ghost: A cloneNode ghost would carry id wishBtn or reqBtn. Duplicate ids would feed hudRects, G23's hintGap selector and getElementById, and would re-trigger appear('#wishBtn'). → The ghost has no id and only cm-g25 classes (addendum).
- [minor] G4 (layout): resize on arrival: changeRoom snaps E.camX using the old viewW before G4's 'room' listener resizes. Every landscape arrival in or departure from the living room would show an extra camera glide of about half the viewW change, on top of the slide. → After resize() in the room listener, re-snap E.camX as changeRoom does, then render() (addendum).
- [minor] G15 (status): dim CSS: 'transition:opacity .2s' replaces the existing .mood{transition:transform .1s}, so the press scale snaps while the faces are dimmed. → List both transitions (addendum).
- [minor] conventions: events and DOM: Not documented:
- listeners can run synchronously inside quietFor() or sample(), e.g. inside G2's checkMess hook inside AI.update;
- hooks and CSS registered inside Clarity.item never come into existence when a switch is turned on at run time;
- extra DOM nodes, or reused game ids and classes, change what game code and regress.js query;
- cm- class and keyframe names are global and can collide between workers. → All-worker addenda.
- [minor] G36 (wayfinding): run-time toggles: The nav.js arrows cache their icon per destination (dataset.to), and floors.js caches the strip per floor. Flipping G36 at run time therefore leaves old icons on screen. A reload is correct. → onToggle rewrites the arrow text and the .rb[data-r=nunuroom|treehouse_pine] text directly (addendum).
- [minor] G37 (wayfinding) × screens: #panel: Centring the portrait map stack could tempt wayfinding to style #panel, which the screens worker owns (G3's lane padding lives there). → Use .fmap, .isowrap, .fmaprow or a wrapper of its own (addendum).