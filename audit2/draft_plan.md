# Draft plan
FINAL PLAN: 39 items. It starts from the 'safe' plan, which all three judges scored highest (safe 22.5, calm 19, obvious 16). The strongest 'calm' and 'obvious' items are grafted in, each changed as the judges' amendments say. Every must-drop from the functionality guardian has been removed, and most of the other judges' must-drops too. The plan holds four rules.

WHERE THINGS LIVE (one home per kind of control):
- Travel corner: the map, room strip and ⬆️/⬇️ pill stay top-left, and the side arrows stay at the edges. These are her most-used main-floor controls, so only their look changes: floor colour (G38), bigger badges (G36), and the 'asleep' look while a scene plays (G15).
- Problem alerts: they keep their row under the strip. Nothing else may land on that row (rings G6, wrapped lists G7, give bubbles G17).
- Marina's own things ('the dock'):
  - On every tall portrait screen (the home-screen app and Safari) there is one centred row under the picture, between the two face cards. It holds ✋ while she is doing something, 📒 👗 while she is free, and the wish or request at its right end (G16, G25). Nothing in it ever overlaps anything else.
  - In landscape and short portrait, ✋ stays bottom-left with the prompt right beside it. 📒/👗 stay bottom-right there, on purpose: that is habit, and they would collide with the request.
- Face cards keep both corners, so the face of whoever is talking or asking is never covered. A request also carries the asker's face.
- Feelings: the bottom row in portrait. In landscape they become a real column beside the picture, so nothing in the room sits under a face (G19).
- Exits: a ❌ at the top-left of every screen. In landscape a twin sits bottom-left, in a lane of its own that holds nothing else (G3, G32).
- Choices: next to the thing she tapped, never on another button and never off-screen (G6, G7, G9, G10, G12).
- Wayfinding lives in the house itself: signs on the doors and stairs, edge tabs, the map, floor colours and an up/down slide when the floor changes (G35–G39).

ONE MEANING PER COLOUR AND SHAPE:
- Colours:
  - A red disc means someone needs you (🧻🚽 joins the red ones, G23).
  - Green means 'do something with what you are holding'.
  - The yellow [thing]✋ chip means stop or let go (🖼️✋, G17).
  - Dimmed grey plus a little shake means 'wait, not now' (G15).
  - A warm glow means 'this is what you picked' (G18) or 'you can answer with a feeling' (G24).
  - Motion means something is new (G23).
- Shapes:
  - ❌ only ever means 'leave this screen', ◀️ means one step back, and 🗑️ means throw away (G33). One exception is kept on purpose: the fort's piece-delete ❌, because a 🗑️ there would sit beside clear-all.
  - ⬆️/⬇️ always means 'change floor', with the same badge wherever the same trip is offered: on the pill, the door and stair signs, the stairs choices and the arrival picture (G30, G35, G39).
  - 🛏️ means only 'upstairs'. Nunu's room becomes 👵 (G36).
  - A wish or request shows the same picture as the choice it points to (G31).

ONE WAY TO CLOSE AND CONFIRM: a red ❌ on a white 60x60 tile at the top-left, doing exactly what it does today. The landscape twin copies the glyph of the button it presses. A ✅ 'done' button is never off-screen. Confirm steps are unchanged.

ONE INTERRUPTION POLICY:
- Nothing the game starts by itself plays into a full screen. Nothing new starts while she swings, hangs on the bars or rides.
- When an activity ends, her idle clock starts again, so a wish waits at least 30 s, a request at least 6 s, and the tidy order at least 10 s (G1, G2, G21).
- Each grown-up says hello once per real visit (G20). Rory chats at most once per 90 s (G21). Minka's mews from other rooms come at most once per 30 s (G29).
- Prompts never cover a face card or ✋ (G25). Alerts pulse when new, then rest (G23). Stickers wait until she is back in the room (G27). The start of a game brings one thing at a time (G28).
- There is no global gate (calm-1 was dropped), so the timing of crying, poop and nappies is untouched.

BUILD:
- One overlay file, public/chef-marina/clarity.js, loaded after trees.js in both index.html and artifact.html.
- Its core holds:
  - Clarity.on: one flag per item.
  - Shared helpers: screenOpen(), bodyBusy(), the activity-end tick (Clarity.endedAt), hudRects() and floorDir().
  - Exactly one wrapper per global, each calling the item hooks in a fixed order. The globals are UI.actions, UI.closeActions, UI.pulseMoods, UI.bigIcon, onTap, interact, hitTest, onEnterRoomBy, checkMess, currentActivity, drawExitSigns, openIsoMap and Audio2.blip.
- Local edits are one-liners marked /* Gn */. They read Clarity.on.Gn at call time, so turning a flag off restores today's code.
- Nothing new is stored on G or in saved data.
- Dock and HUD buttons are positioned with left/top/translate, never transform.

TEST:
- Run regress.js on the merged build against after3.json. These renames are expected:
  - G33: story and sticker ✖️→❌, Lego shelf ❌→◀️, Movies ⏹️→◀️, built-thing 🧹/🎨→🗑️/🖌️.
  - G30: the stairs choices gain a badge.
  - G36: room icons.
- Check elementFromPoint at the centre of every HUD control, and at the first item of about 18 screens. Views: port, portSmall, land, landSmall, 844x340 and 390x664, with 0/47/59 px insets.
- Confirm the studio paper size S.W×S.H is unchanged.
- Re-run the 15-minute prompt simulations and first-minutes moods.js.
- Test :has() on her own iPhone.

STAGING:
- Wave 1: fixes she will not have to relearn (G1–G14, G17, G20–G22, G26, G28, G29, G32).
- Wave 2: all visible main-floor moves together, with the glide bridges, so she relearns once (G15, G16, G18, G19, G23–G25, G27).
- Wave 3: new-area wayfinding and glyphs, before she explores (G30, G31, G33–G39).
- Before and after, watch her do five tasks: go to a room, close this, give this to someone, where are we, what does this do.


# Group: bugs

### G1 Every touch counts, and finishing an activity restarts the idle clock
- problem: lastInput is set only by pointerdowns on #stage (features.js:507) and in onTap (features.js:555). #panel, #studio, #storyBox, #stkBox and #title are outside #stage, so five minutes of building Lego or cooking count as five minutes idle. When she closes a screen, the wish gate (react.js:134, 30 s idle), the request gate (fun.js:92, 6 s) and the idle wiggle (features.js:598, 10 s) all pass at once. In 10 of 10 activities a wish appeared 0–2.4 s after closing, together with a bubble, a face card, 📒 and 👗. After she stopped the swing, the 💩 alert came at +0.3 s and a wish at +2 s.
- change: Any touch anywhere counts as a touch. The moment an activity ends also counts as a touch: a screen closing, a scene ending, or getting off a swing, the bars, a ride, the wheelchair or a looping bounce. The rules themselves stay the same: a wish after 30 s untouched and 130 s apart, a request after 6 s, the wiggle after 10 s. They are just measured from her real last touch.
- implementation: clarity.js core plus block G1.
- Add a passive capture listener: document.addEventListener('pointerdown', () => { if (typeof E !== 'undefined') lastInput = E.t; }, { capture: true, passive: true }). lastInput is the top-level let at features.js:502, so a later classic script can write to it.
- Core 250 ms tick, shared with G2 and G27:
  - act = inActivity() || Clarity.bodyBusy().
  - bodyBusy() = ['swing','bars','ride','wheel'].includes(marina.state) || (marina.state === 'anim' && marina.anim && marina.anim.loop). This mirrors currentActivity, features.js:54-62.
  - When act goes from true to false: set Clarity.endedAt = E.t, and, when the G1 flag is on, lastInput = E.t.
- features.js:507 and :555 stay as they are. calm.js is not touched.
- must still work: Every wish, request and idle wiggle still happens, with the same lines and rules (130 s between wishes, 30 s idle, 6 s for requests, 10 s for the wiggle); Taps in panels, the studio, the story and the sticker book work exactly as before (passive listener, no preventDefault); Swipes, dragging Marina and dragging toys are unchanged; The game-start wish (react.js:121-126) is unchanged; Crying, poop and nappy timing (calm.js:17, nav.js:230) is unchanged
- benefit: Finishing something becomes her own quiet moment to look at what she made. This answers the dad's first complaint in all ten activities.
- risk: Very low: one passive listener and one edge detector. Wishes after activities simply come later.

### G2 Nothing waits under a screen or reaches through it: the tidy order, its ring, stray rings, Minka's cues and upstairs visits
- problem: Several things leak into or under full screens.
- checkMess (game.js:793-800, every 4 s) checks only tidy, chase, busy and the fort. While she cooks or draws, Daddy orders 'tidy up' about every 44 s, and a 🧹🏃 ring opens behind the screen. It also opens from say().then at game.js:799 when the line started just before the screen opened. reactMess's second step (react.js:58) has the same gap.
- openPanel (ui.js:117) calls UI's internal closeActions, which leaves features.js's .actback backdrop behind. After she closes the screen, the leftover ring and backdrop eat her first tap (14 of 240 taps in first-minutes).
- Minka's hide cues check only panelUp() (minka.js:611), so Minka mews behind the drawing studio (heard at 73 s and 82 s).
- Upstairs visits check only #panel (upstairs.js:301), so a parent walks in behind the studio or a story.
- change: - The tidy order and its 🧹/🏃 choice happen only in free play. They wait while a screen or activity is open, while she swings, hangs or rides, and for 10 s afterwards.
- No ring can wait under a screen. Any ring still open when a full screen opens is closed together with its backdrop, and the 🧹🏃 ring never opens while a screen is up.
- Minka's hide cues and the upstairs visits pause during any activity.
- The lines, the choice, the chase, the 40 s spacing, the mess thresholds, hide-and-seek and the visits are all unchanged.
- implementation: Block G2.
- Wrap the global checkMess. AI.update calls it by name (game.js:999). New version: if (inActivity() || Clarity.bodyBusy() || E.t - (Clarity.endedAt || -99) < 10) return; otherwise call the original.
- In the overlay's single outermost UI.actions wrapper: if anchor === marina && list && list.length === 2 && list[0].ico === '🧹' && list[1].ico === '🏃' && Clarity.screenOpen(), do not open the ring.
  - screenOpen() = #panel not hidden || Studio.active || #storyBox || #stkBox || #title not hidden.
  - The fort interior and the TV are deliberately excluded, because they use rings of their own.
- Core tick: when screenOpen() goes from false to true, call UI.closeActions(). This is the features.js:443 version, which also removes .actback.
- Local edits, each marked /* G2 */:
  - react.js:58: add && !inActivity() to the ring step.
  - minka.js:611: add || inActivity() to the early return.
  - upstairs.js:301: add || inActivity() to the early return.
- must still work: The tidy nag still plays in free play, with the same lines (d_tidy, mo_tidy, r_tidy), the same 🧹/🏃 choice, startTidy and the chase; The 40 s spacing (G.lastTidyAsk) still applies, and checks that are held back do not reset it; Daddy's 🧹 request (d_req_tidy) and the 'tidy' wish are unchanged; reactMess's first scold in free play is unchanged; Dragging toys into boxes and the tidy confetti are unchanged; Rings inside the fort interior and on the TV are unaffected; Minka's 100 s hide, the 🔍 markers and the found scene work as before in free play; Upstairs visits still happen while she plays in upstairs rooms
- benefit: Cooking and drawing are no longer interrupted by an order she cannot see. Closing a screen never leaves her first tap eaten by a ring she did not ask for. Drawing in the basement is quiet.
- risk: Low. The tidy nag can now come 10–14 s after she leaves a screen, and it also waits while the TV is on, because inActivity() counts the TV. A ring opened while a screen is already up (for example the studio's give) is not touched: only the screen-open edge closes rings.

### G3 Landscape: the extra ❌ gets an empty lane of its own and copies the picture of the button it presses
- problem: #xFloat (calm.js:47-63) is a 64x64 button fixed at the bottom-left, z60. It sits on top of whatever the screen draws there: the first ingredient (89% covered) and the 🥪 method, the first outfit (75%), the first fort piece and fort toy, the builder's castle and picnic cards, and map tiles. Tapping 'the milk' closes cooking and throws away her picks. Tapping the first fort toy takes her out of the fort: there the button shows ❌ but acts as 🚪. ALREADY_FIXED lists this as the open design question.
- change: Both ways out stay exactly as they are: each screen's own top-left ❌ and the floating one at the bottom-left. In landscape, while the floating ❌ shows on a classic screen, the screen's content starts one button-width further right. The bottom-left corner then holds nothing else, and the whole left edge reads as 'the way out'. The floating button shows the picture of the button it presses: 🚪 in the fort interior, the screen's own ❌ (or ◀️, see G33) elsewhere.
- implementation: clarity.js block G3, run from a 250 ms tick.
- on = #xFloat has class 'on' && innerWidth > innerHeight. Then document.body.classList.toggle('cm-xon', on).
- For a visible #panel:
  - top = panel.querySelector(':scope>.ptop').
  - lane = on && top && getComputedStyle(top).flexDirection === 'row' && position === 'static' && none of the canvas screens is open. The canvas screens are Bricks, LegoShelf, Pool, Movies, Stuffies, Spa and TreeClimb; their own left rail already keeps the corner empty.
  - panel.classList.toggle('cm-lane', lane).
- CSS inside @media (orientation:landscape):
  - #panel.cm-lane{padding-left:calc(80px + env(safe-area-inset-left))} and #panel.cm-lane>.ptop{margin-left:-72px}. Padding is used rather than margins on the children, so .fortcv and .fortin (width:100%, style.css:130) do not overflow.
  - body.cm-xon #stkBox{padding-left:calc(env(safe-area-inset-left) + 84px)}.
  - Do the same for the #storyBox content only if the harness shows content under the button.
- Glyph: the same tick finds the target in calm.js's order: '#stkBox .st-x', the studio close, '#storyBox .st-x', then '#panel:not(.hidden) .ptop button'.
  - If there is no target, do nothing.
  - Otherwise copy only that button's first text node, trimmed, when it is a single emoji; else use '❌'.
- calm.js is not edited: fire() and target() still press the same button.
- must still work: Each screen's own top-left close and the floating close close or leave exactly as today on every screen (cooking's ❌ discards as today; the fort interior runs closeFortInside); The first ingredient, first outfit, first fort piece and toy, the builder cards and the map tiles are tappable and do their own thing; The Lego/tiles, Lego shelf, Pool, Movies, Stuffies, Spa and Tree climb layouts are unchanged; Portrait is unchanged (the floating ❌ appears only in landscape); The scroll guard (calm.js:27-39) still works on panels; The studio is covered by G32
- benefit: Removes the only common tap that destroys her work by accident: aiming at the first food, outfit or toy no longer throws her out and loses her picks. The bottom-left button also says honestly what it does.
- risk: Low to medium. Classic landscape screens lose 72 px of width: the cooking grid loses about one column (G9 re-lays cooking), and the map and builder grid shift right. Verify with document.elementsFromPoint at #xFloat's centre on about 18 screens, at land, landSmall and 844x340 with 47 px insets: nothing interactive other than #xFloat may be under it.

### G4 Landscape living room: the TV always hangs below the room strip
- problem: In landscape the scene is zoomed 1.16 (engine.js:169) except while a show plays. With the TV off, 62–66% of the TV is under the centred room strip, and the TV's centre is the 'dining' strip button. Tapping the TV takes her to the dining room instead of offering the shows. This is the dad's 'buttons covering the TV in landscape' complaint, still there whenever the TV is off.
- change: In landscape the living room always uses the framing the game already uses while a show plays (zoom 1). The TV hangs below the strip, so a tap on it reaches the TV. No button moves.
- implementation: - Local edit engine.js:169, marked /* G4 */: the zoom test G.tv && G.room === 'living' becomes G.room === 'living' && (G.tv || (window.Clarity && Clarity.on.G4)). With the flag off, the code is today's.
- Block G4: a 200 ms watcher calls resize() whenever (G.room === 'living') changes while in landscape. This covers changeRoom, travelTo and startScenario. startScenario sets G.room directly (features.js:284), after startGame has already called resize() (features.js:310).
- nav.js:89 (the stage.tvon class and the resize when the TV turns on or off) is untouched.
- must still work: Tapping the TV opens the same shows; the fireplace still opens its list; TV-on framing is identical to today; The strip and pill still hide while the TV is on in landscape (stage.tvon); Portrait is unaffected; Every other room keeps the 1.16 zoom; A landscape game started in the kitchen runs at 1.16; one started in the living room runs at 1
- benefit: Her favourite main-floor object works from its middle in landscape. A TV tap no longer whisks her to another room.
- risk: Low. People in that one room are drawn about 14% smaller in landscape, as they already are whenever a show is on. The size jump now happens when she walks in rather than when the TV switches on. Re-check that no living-room prop newly lands under the pill or the arrows.

### G5 Pictures and bubbles land where they belong: the room picture, speech bubbles, give buttons, the map's 'here', and ✋ under her finger
- problem: Animation keyframes overwrite the transforms that centre things.
- UI.bigIcon (ui.js:101): the inline translate(-50%,-50%) is replaced by 'pop .3s both' (style.css:35). The 90 px room picture on every room change (and 🧹, 💎, 📞👨) lands 56 px right and 54 px down, on top of Marina.
- .say (style.css:36): translate(-50%,-100%) is replaced by 'pop .2s both'. Every speech bubble's top-left corner sits on the speaker's head (measured at 187,172), so bubbles cover faces instead of sitting above them.
- .pichint (nav.js:138): the 'pulse' keyframe makes the give buttons swing about 25 px diagonally twice a second, onto the arrows and the pill.
- .isoroom.here (style.css:147) scales around the picture's top-left corner, so the map's 'here' outline drifts off its room.
- #stopBtn: in tall portrait it is centred with transform:translateX(-50%) (style.css:213, 230). .hud:active{transform:translateY(2px)} (style.css:10) replaces that, so the chip jumps half its width to the right under her finger.
- change: Same animations, same moments, same buttons. Each one simply stays where it belongs.
- implementation: - Local edit ui.js:101, marked /* G5 */: transform:'translate(-50%,-50%)' becomes translate:'-50% -50%'. The separate translate property combines with pop's scale. Every caller goes through UI.bigIcon.
- CSS block G5:
  - .say{transform:none;translate:-50% -100%}
  - .pichint{transform:none;translate:-50% -50%}
  - .isoroom.here{transform-box:fill-box;transform-origin:center}
  - Inside both portrait media rules that centre #stopBtn: #stopBtn:active{transform:translateX(-50%) translateY(2px)}
- A rule for every later item: dock and HUD buttons are positioned with left/top/translate, never with transform.
- must still work: Every bigIcon (room change, treasure, 🧹, 🧻, 📞👨, 🌙/☀️, rocket) still appears for the same time with the same glyph; Speech bubbles show the same icons for the same time, cannot be tapped, and their tail still points at the speaker; Give hints still pulse and still do the same thing when tapped; The map's current room still pulses; ✋ still works and still dips when pressed
- benefit: The main 'you are now in the kitchen' cue stops covering Marina. Speech bubbles stop hiding the speaker's face. The give buttons the dad wants more obvious stop jittering onto the arrows. ✋ stops sliding away from her finger.
- risk: Very low. Bubbles now sit about one bubble-height higher: check in port and land that a grown-up's bubble does not slip under the strip or the alert row, and does not land on a face card. The translate property needs iOS 14.1 or later.

### G6 Choice rings never land on another button
- problem: placeActs' avoid list (ui.js:72) holds only the tapped thing, Marina, the top 62 px and a bottom-left box, so rings land on other buttons.
- Daddy's 🤗 and 🧍 hide under the 💩 and 🧻 alerts, and Nunu's 🧱 under 👶😭.
- In landscape, 13 of 44 rings cover a mood face (🧗 on 🥰, Miles' ✋ on 😢), and the keyboard's songs land on ⬆️/⬇️.
- In portrait, rings sit on the floor pill (10 times) and on the map (8 times).
Two buttons then share one spot, and she presses the wrong one or cannot see one.
- change: Rings treat every visible button as 'do not cover'. Each ring keeps its size and order and is still placed by the same rules, just clear of other buttons.
- implementation: - Local edit in ui.js placeActs after line 72, marked /* G6 */. st (the stage rect) is already computed there. The code: if (window.Clarity && Clarity.on.G6) { acts.hud = acts.hud || Clarity.hudRects(st); for (const x of acts.hud) avoid.push(x); }
- hudRects(st), in clarity.js, is read once per ring. It returns rects relative to #stage, with weight 4, for: '#alerts .alertb, #floorpill .fl:not(.off), #mapBtn, .navarrow:not(.off), #weatherBtn:not(.hidden), #bookBtn:not(.off), #dressBtn:not(.off), #stopBtn:not(.hidden), #wishBtn, #reqBtn, .facecard.show, .pichint, .cm-call'.
- In landscape, while the mood column is drawn over the picture (G19 off), it also adds #moodbar .mood and #moodToggle, widened 8 px to the left, with weight 6.
- Rects of zero size are skipped.
- The candidates, the clamps and the 40 px anti-jitter rule are unchanged. The trees.js nudge stays.
- must still work: Every ring shows the same choices in the same order and size; Rings still avoid the tapped thing and Marina; Alerts, arrows, the pill, the map and the moods stay tappable while a ring is open; Ring positions stay stable while people move (anti-jitter)
- benefit: What she opened is fully visible, and the buttons around it stay pressable. In landscape this stops the accidental mood scenes started by tapping a choice drawn over a face.
- risk: Low. Some rings sit a little further from their thing. Re-run the menus-main placement scripts (place_land.json, place_port_merged.json): overlaps with the HUD should drop to near 0, and the average distance to the thing should not grow by more than about 40 px. A button that appears after the ring opened is not avoided, on purpose, so an open ring never jumps under her finger.

### G7 Long choice lists show every choice: the strip wraps into rows below the alerts, and in landscape a two-row ring is used when it fits
- problem: When count×80 is more than the stage width − 8, UI.actions (ui.js:49) builds a one-row .acttray with a hidden scrollbar (style.css:216-218). That means 5 or more choices in portrait, 9 or more in landSmall and 11 or more in land. Only 5 choices show (4 on a 375 px phone), and these stay hidden:
- the TV's 🚽📢🫧👸;
- the keyboard's 🌙🚀🌸;
- the gym's 🧘🌀⭐⚪;
- the table's ⬇️ 'put the dish here';
- Nunu's and Jeff's 😜 while she holds a dish;
- 4 of the 9 tree-house toys.
The alert circles (top:64, z7) are drawn over tray choices. On landSmall the TV and gym lists become a strip that hides the whole TV, although a two-row ring would fit.
- change: Same choices, same order, same buttons.
- The strip wraps onto a second row (rarely a third), so all 5–10 choices are on screen. When alerts are showing, it starts just below them.
- In landscape, a list that fits as the two-row ring placeActs already draws (ui.js:70) is shown as that ring instead of a strip.
- In portrait, the strip-or-ring decision is unchanged.
- implementation: - CSS block G7:
  - .acttray{flex-wrap:wrap;justify-content:center;overflow:visible;row-gap:8px}
  - @media (max-width:380px){.acttray .act{flex-basis:60px;width:60px;height:60px;line-height:60px;font-size:30px}}, so 5 fit per row.
- JS, in the overlay's UI.actions wrapper and the 250 ms tick: if a .acttray exists and #alerts has children, set tray.style.top = alerts.offsetTop + alerts.offsetHeight + 8 px; otherwise clear it.
- Local edit ui.js:49, marked /* G7 */: when window.Clarity && Clarity.on.G7 && innerWidth > innerHeight, tray = Math.ceil(list.length/2)*80 > stW - 8. Otherwise the test is today's.
- must still work: Every choice in every list, in the same order and doing the same thing (diff against after3.json); The dim backdrop still closes the list; Alerts stay tappable while a list is open; Rings of 4 or fewer are unchanged; calm.js's scroll guard is harmless (nothing scrolls sideways any more); Each item of a landscape 7–10 item ring is one tap
- benefit: Hidden choices become real for a non-reader: every cartoon including 👸, all the gym moves and songs, 'put the dish here', and the grandparents' joke.
- risk: Low. In portrait, two rows cover about 150 px at the top of the picture while the list is open (the TV is under it while she picks a show, as today). Check that 375 px gives 5 per row, and that no third row reaches the bottom of the stage.

### G8 The kitchen island and the playroom rocker can be tapped again
- problem: Hit-testing picks front props first. The three bar stools (z:1, world.js:56-58) cover every point of the kitchen island (world.js:55). A tap on the island always gives a stool's 🧗🪑, so the island's own 🧺 🗄️ 🧗 and the ⬇️ 'put the dish here' can never be reached. The playroom rocker's box lies inside the toy shelf's (world.js:66-67), so a tap on the rocker always gives the shelf's 🧸.
- change: - A tap on the island's counter, above the stools' seats, picks the island.
- A tap inside the rocker's own picture picks the rocker.
- Taps on the stools' seats and legs, and on the rest of the shelf, behave as now.
- implementation: Block G8 wraps the global hitTest as the outermost wrapper (it is also reassigned at minka.js:376, trees.js:319 and wildlife.js:992). Let h = _ht(wx, wy); return h unless it is a prop.
- Kitchen: if G.room === 'kitchen' && h.p.a === 'stool':
  - isl = PROPS.kitchen.find(p => p.id === 'island');
  - seat = h.p.y + visBox(h.p.k)[1] * (h.p.scale || 1) + 4;
  - if (isl && wy < seat && Math.abs(wx - isl.x) < isl.w / 2), return the island. The island is painted ('p:island'), so its own w is used, not visBox, which returns [0,0,0,0] for it.
- Playroom: if h.p.id === 'toyshelf' and the point lies inside the rocker's visBox × scale, return the rocker.
- Everything else is returned unchanged.
- must still work: Stools still give their choices on their seats and legs; The toy shelf still gives 🧸 outside the rocker; People and Marina standing in front still win the tap; Tidy-mode mess still hits first; The island's choices are exactly propActions(island): 🧺 🗄️ 🧗, plus ⬇️ while holding a dish; Dragging toys and tidying are unchanged
- benefit: Two main-floor things that 'don't work' start working: she can climb the island or put her dish on it, and sit in the rocker.
- risk: Low. Verify with menus-main's dbg_island grid that the island's coverage is above 0, that each stool keeps most of its own area, and that both the rocker's 🪑 and the shelf's 🧸 can be reached.

### G9 Landscape cooking shows the food, all six ways to cook, and a timing bar she can see
- problem: - Ingredients: the empty slots, the ↩️🗑️✅ row and the shelf tabs use up the height before any food. Only 11 of 36 tiles are visible on 844x390, and none on 667x375 or in Safari at 844x340.
- Methods: they become 268 px squares (style.css:117-121, aspect-ratio:1), so bake, freeze, blend and ⬅️ are below the edge.
- Timing bar: the fry/bake .meter (style.css:60) is squeezed to 5 px (land) or 0 px (landSmall). Its zones vanish, and the dish 'burns' for no visible reason.
- change: Landscape only. Same buttons, same order, same rules.
- Ingredient step: two columns. The slots and ↩️🗑️✅ are on the left; the shelf tabs sit over a food grid that fills the height on the right.
- Methods: all 6 in one row (🥪🥄🍳🔥❄️🌀), with ⬅️ under them.
- The timing bar keeps a 40 px height. When it appears, the panel scrolls once so that the bar and 🛑 are both in view.
- implementation: CSS block G9 inside @media (orientation:landscape).
- Every ingredient-step rule is scoped under #panel .pbody:has(>.grid.ing), so dress-up's .row.tabs is not touched:
  - display:grid; grid-template-columns:minmax(200px,36%) 1fr; grid-auto-rows:min-content; column-gap:10px;
  - .tray and the non-shelf .row go in column 1;
  - .row.shelves goes in column 2, row 1;
  - .grid.ing goes in column 2, rows 2–4, with overflow:auto.
- #panel .methods{grid-template-columns:repeat(6,1fr);align-content:center}
- #panel .method{aspect-ratio:auto;height:min(120px,26vh);font-size:min(60px,14vh)}
- #panel .meter{flex:0 0 40px;min-height:36px}
- JS: a MutationObserver on #panel. When a .meter is added in landscape, set pbody.scrollTop = stop.offsetTop + stop.offsetHeight - pbody.clientHeight once, where stop is the 🛑 added after the meter (ui.js:193-194). Never use scrollIntoView.
- Confirm the class names against ui.js:126-201 before use.
- Without :has() support, the ingredient step keeps today's layout.
- must still work: Up to 5 ingredients; ↩️, 🗑️ and ✅ behave as today, and ✅ still leads to the methods; The same 6 methods in the same order with the same results; ⬅️ still goes back to the ingredients; The timing game keeps the same speed, the same good/ok/burnt thresholds and the same 🛑; The result screen's give, carry, change and again are unchanged; Portrait cooking is unchanged except for the meter's minimum height
- benefit: Cooking, the heart of the game, works sideways: she can see food to pick, every way to cook, and the green zone she has to stop in.
- risk: Medium-low: CSS on her favourite screen, but the landscape layout is broken there today. With G3's lane on, verify at 844x390, 667x375 and 844x340 with 47 px insets: at least 3 rows of food, all 6 methods and ⬅️, the bar at least 36 px tall, and 🛑 visible. Test :has() on her iPhone.

### G10 Dress-up: the tab row is never squashed, all 8 tabs show in portrait, and outfits are visible sideways
- problem: The tab row (.tabs: nowrap plus overflow-x, style.css:202-203) shrinks in landscape to 26 px (land) or 15 px (landSmall), with the outfit grid drawn over it. A tap on the 💇 tab changed nothing (land) or put Marina in the astronaut outfit (landSmall). In portrait the row is 484 px wide on a 374 px screen, so 🪄 is half off-screen and 💾 (saved looks) is fully off-screen. In landscape, 0 of 19 outfits are fully visible on 667x375.
- change: Same tabs, same order, same buttons.
- The tab row always keeps its full height.
- In portrait it wraps onto two rows, so all 8 tabs, including 🪄 and 💾, are visible.
- In landscape, the small buttons beside the preview (🎲🌈🚶 and 📸✅) sit in short rows instead of tall columns, and the preview is a little smaller, so at least one full row of outfits shows.
- implementation: CSS block G10:
- #panel .tabs{flex:0 0 auto}
- @media (orientation:portrait){#panel .tabs{flex-wrap:wrap;justify-content:center;overflow-x:visible}}
- @media (orientation:landscape){#panel .dtop .dcol{flex-direction:row}#panel .dprev{height:min(30vh,140px)}}
.dcol and .dprev are used only by UI.openDress (ui.js:283, 320).
- must still work: Every tab, outfit, colour, hair, accessory and saved look; 🎲 🌈 🚶 📸 ✅ do the same thing, and the ✅ fashion show still plays; Tapping a tab switches tabs and never changes the outfit; Dress-up from the closet and dresser props
- benefit: Tab taps do what she aims at. Saved looks (💾) and the wand tab (🪄) can be found in portrait, and outfits are visible sideways.
- risk: Low. In landscape, 🎲🌈🚶 and 📸✅ move from columns to rows beside the preview (position only). Verify with G3's lane on at land and landSmall: at least one full outfit row, and tabs 54 px tall everywhere.

### G11 The deer's 'they went this way' tab is placed like the turkey tab, clear of the arrows and faces
- problem: The deer edge tab (wildlife.js:974-977) uses a fixed y of 86, and x = camX+14 or camX+viewW−14. In portrait it is drawn exactly under the left ◀ arrow, so a tap there takes her out of the backyard to the yard. In landscape the right-hand tab is under the mood column, so a tap starts a mood scene. The turkey tab, built the same way, already finds a free height with clearZone()/tabY() (wildlife.js:652-666).
- change: The deer tab uses the turkey tab's placement, so it is visible and tappable, and a tap walks her toward the deer as intended.
- implementation: Local edit in wildlife.js tab(), marked /* G11 */:
- const x = side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(clearZone()[1] - 6, ROOMS[ROOM].w - 14);
- return { side, hx, x, y: tabY(side, x) }.
This mirrors ttab() at wildlife.js:652-655. Drawing (line 966) and the tap test (line 1006) already read t.x and t.y.
- must still work: Deer visits, the 🍎 wish over a deer and tapping a deer are unchanged; The tab still appears only when the herd is off-screen, and still walks her toward them; The turkey tab is unchanged
- benefit: The backyard's best moment, the deer, can be found when they wander off, and the tab stops being a trap door back to the yard.
- risk: Very low. Confirm that clearZone and tabY are in scope in tab() (same file and closure as ttab).

### G12 The 'done' ✅ is never off-screen: Lego on small phones, and the sticker book
- problem: On 667x375 the Lego side column (.bk-side.bk-narrow, bricks.js:320-321, 395-396) has 596 px of content scrolling in 359 px. ✅ (in .bk-tools, added last) sits at y 540, off-screen, with no sign that the column scrolls, and a touch where it should be did nothing. The sticker book's ✅ (.stk-ok, fun.js:38, 201) comes after the whole grid, below the fold in every view.
- change: Lego: on narrow landscape screens, the group holding ✅ sticks to the bottom of its column, and the colours and pieces scroll above it. Sticker book: ✅ is pinned at the top-right, mirroring the close button at the top-left. Same buttons, same actions.
- implementation: CSS block G12:
- .bk-side.bk-narrow>.bk-tools{position:sticky;bottom:0;z-index:2;background:inherit;padding-top:4px}. Use the column's own colour if inherit is transparent. If sticky misbehaves, fall back to order:-1.
- #stkBox .stk-ok{position:fixed;top:calc(env(safe-area-inset-top) + 12px);right:calc(env(safe-area-inset-right) + 12px);margin:0;z-index:3}
- must still work: The Lego ✅ still runs finish(true), ❌ still just leaves, and the build is kept either way; Every colour and piece can be reached by scrolling; wide landscape and portrait Lego layouts are unchanged; the keep-on-shelf button's placement is unchanged; The sticker book's ✅ and its close button both close it, in the game and on the title; Stickers still wiggle when tapped
- benefit: She can finish a Lego build on a small phone held sideways, and close the sticker book with the ✅ she is looking for, without discovering a hidden scroll.
- risk: Very low. Check that the sticker ✅ does not cover the 📒 n/N header or the first row of stickers on a 375 px phone.

### G13 Landscape title room picker: no card under 👗 and 📒, and nothing in the notch
- problem: In the landscape picker (4-column grid, more.js:179-186), the big 👗 (nav.js:148) and 📒 sit on the foyer card (5,848 + 3,640 px² of overlap; the card's centre is under 👗), so tapping the hall starts dress-up. #title has no safe-area padding, so the cards at x 25 sit in the notch zone.
- change: In landscape, 👗 and 📒 stay at the bottom-left, as she knows them. The picker's second row moves one column to the right into the empty fourth cell, so it reads [empty][foyer][yard][🎲], and the empty cell sits under 👗/📒. The title layer is inset by the safe areas. Portrait is unchanged.
- implementation: CSS block G13:
- #title{padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
- @media (orientation:landscape){.tpick .tcardr[aria-label=foyer]{grid-column:2}}
The card order is living, kitchen, dining, playroom, foyer, yard, 🎲 (more.js:132-136), so yard and 🎲 follow the foyer automatically.
- must still work: ▶, the six room cards and 🎲 start the game where they do today; The title 👗 still opens dress-up after starting, and 📒 still opens the sticker book; The portrait title layout is unchanged
- benefit: The first choice of every landscape session (where to start) goes where she taps.
- risk: Low. Foyer, yard and 🎲 shift one column. Verify with elementFromPoint at every card centre and at 🎲, at 844x390, 667x375 and with a 47 px inset, and that the title art is not covered.

### G14 The portrait room strip fits on small phones
- problem: #roombar (left:76) holds 7 buttons of 40 px with 3 px gaps. On a 375 px phone the 🚽 button runs to x 378, past the edge of the screen (hud-portrait room_portSmall_living_idle.png).
- change: The strip never runs off the edge: on narrow screens its buttons shrink by a few pixels to fit. Same buttons, same order.
- implementation: CSS block G14: @media (orientation:portrait){#roombar{max-width:calc(100% - 84px)}.rb{flex:0 1 40px;min-width:34px}}
- must still work: Strip buttons, their order, the current-room highlight and the family dots; Other floors' strips; The strip's position next to the map
- benefit: The bathroom button is fully on screen on a small iPhone.
- risk: Very low.


# Group: hud

### G15 While a scene plays, the controls that can't work look asleep, and every ignored tap gets a 'not now'
- problem: During a mood scene, hug, joke, ride, nap or story (G.busy, 7 s at the median, up to 17 s), the side arrows hide (nav.js:90), but other controls look fully live and ignore her.
- The room strip and the ⬆️/⬇️ pill return before their blip (features.js:493, floors.js:19 and :49).
- The mood faces return in setMood (game.js:577, and scenes.js:83 during sceneOn, which includes the mood-bar tantrum), although ui.js:19 has already played its cheerful blip.
- Face cards return when busy (nav.js:101).
- Scene taps are dropped in silence.
- Her own face card never does anything.
In random poking, 28% of touches landed in this window, and 28 of 82 room-button touches were dead; in one run she never left the yard. She cannot tell 'wait' from 'broken'.
- change: One 'asleep' look, used exactly when a control's own handler would ignore a tap:
- the control fades to about 45% with a little grey;
- a tap on it gives a tiny side-shake and the game's existing low dead-end blip;
- it brightens the moment it works again.
During a scene, a tap on the room gets a small grey ring at her finger. The face whose scene is playing stays bright. During a tantrum outside a scene, the faces stay bright, because they work then. Her own face card answers with a little wiggle. Nothing new acts: scenes, timers and outcomes are untouched.
- implementation: Block G15. A 100 ms tick sets four flags on #app, each held for 400 ms before anything dims, so drags and very short busy moments never flash; brightening is immediate:
- cm-strip when G.busy (copying features.js:493 and floors.js:19/49);
- cm-mood when G.sceneOn || (G.busy && marina.state !== 'tantrum');
- cm-face when nav.js:101's own test fails (G.busy or not quiet);
- cm-alert when G.busy && G.sceneOn (nav.js:96).
CSS dims only the child buttons, so the container rules (#stage.tvon #roombar, #floorpill.off) keep winning: #app.cm-strip #roombar .rb, #app.cm-strip #floorpill .fl, #app.cm-mood #moodbar .mood:not(.cur), #app.cm-face .facecard, #app.cm-alert #alerts .alertb {opacity:.45;filter:grayscale(.7);transition:opacity .2s}.
Taps on asleep controls (a capture-phase pointerup on document):
- add .cm-nope (±4 px, 150 ms, twice) and play Audio2.blip(-12,'triangle',0.08,0.1), the dead-end blip at features.js:543;
- on a .mood, check the mood rule live at tap time; if dead, set a 60 ms one-shot flag that the overlay's thin Audio2.blip wrapper reads to skip the mood's own blip(12,'square',…) from ui.js:19, so she hears only 'not now';
- never call stopPropagation or preventDefault: setMood and every wrapper still run and return as today.
Scene taps: in the overlay's outermost onTap wrapper, if G.sceneOn, add a 36 px grey ring at the finger in #fx (pointer-events:none, 400 ms) and the low blip, then call the original. This is not done in other G.busy states, because bathTime (fun.js:166-175) turns stage taps into bubbles.
Her own face card: .facecard[data-who=marina] gets .cm-nope and a soft blip.
- must still work: Every scene, hug, joke, ride, nap and story keeps the same length, lines and outcome; Moods still switch during a tantrum outside scenes, and look bright then; Alerts still work during busy moments that are not scenes (nav.js:96); The map still opens during a scene, as today (it is not dimmed); The strip, pill, moods and face cards work the instant busy clears; The .cur outline is still visible; Landscape TV-on hiding of the strip and pill is unchanged; bathTime's tap-for-bubbles still works; Dragging Marina and swipes are unchanged, and no tap is eaten or delayed
- benefit: The most common confusing moment becomes readable: 'wait a moment' instead of 'that button is broken'. She stops hammering the faces, which used to restart the wait.
- risk: Low. If a dead rule drifts from its handler, a working control would look asleep. Re-run the first-minutes moods.js trials: time to the first working tap must be unchanged, and every dead tap must now be answered. Long busy moments (family dinner, gift scenes) show dimmed controls throughout, which is accurate.

### G16 Portrait: 📒 and 👗 move off the picture into Marina's row under it
- problem: After 1.5 s standing still, the 64 px 📒 and 👗 fade in at about x 316, y 299 and 371 (fun.js:193, nav.js:132), over the right-hand floor of the picture.
- Taps meant for Daddy, Niko, the fridge (3 of 3 taps), the monkey bars, the front door, the den sofa or the toy keyboard open the sticker book or dress-up instead.
- They blink on and off 29–72 times per 15 min of walking.
- Meanwhile 135–315 px of the purple band under the picture is empty.
- change: On portrait screens tall enough to already put the face cards and ✋ under the picture (the existing min-height:150vw rule), 📒 and 👗 sit side by side in ✋'s slot, centred between the face-card corners. Same pictures, colours and 64 px size, same 1.5 s idle rule, same single tap. ✋ and 📒/👗 can never show at the same time: one needs her idle, the other needs an activity. To help her find the new spot, the first 3 times per session they glide in from their old place on the right.
- implementation: CSS block G16:
@media (orientation:portrait) and (min-height:150vw){#bookBtn,#dressBtn{position:fixed;top:calc(env(safe-area-inset-top) + var(--stageH) + 16px);bottom:auto;right:auto;width:64px;height:64px}#bookBtn{left:calc(50% - 70px)}#dressBtn{left:calc(50% + 6px)}}
This overrides nav.js:132 and fun.js:193 by load order. The visibility rules (nav.js:92-93, fun.js:41-42) are untouched.
Glide bridge:
- a MutationObserver on #dressBtn's class;
- when .off is removed and an in-memory count is under 3 for this session, run a 500 ms animation on the individual translate property, from (today's spot minus the new spot) to 0, on both buttons;
- no transform is used (see G5), and nothing is saved.
- must still work: 📒 opens the sticker book and 👗 opens dress-up with one tap, under the same idle conditions as today; ✋ still appears in its slot whenever an activity runs; Face cards at both corners and the mood faces are not covered (check 390x844, 390x664, 375x667); They still hide while a wish shows; Landscape and title positions are unchanged
- benefit: The most common wrong outcome on the main floor goes away: tapping a person or thing no longer opens the sticker book or dress-up. Her own buttons now live in one predictable place.
- risk: Medium habit cost on the main floor: the buttons sit about 150 px lower and nearer the middle, and the glide shows where they went. Check the band on the smallest tall portrait (buttons end at stageH+80; the faces start at about stageH+136).

### G17 Carrying something: the ✋ chip shows it, and everyone who takes it gets a give bubble clear of the buttons
- problem: - While she holds a picture, the yellow stop chip reads ✋✋, because currentActivity() has no 'pic' entry (features.js:59).
- The glowing give bubbles appear over Daddy, Mommy and Rory only (nav.js:61). Grandpa Jeff accepts dishes (his ring's 🍽️, family2.js:271), and Nunu and Jeff accept pictures (the 🎁🖼️ gift ring offers 👵/👴, pics.js:26), yet nothing over them says so.
- The bubbles use fixed heights (e.y−104 or −86) with no clamping, so they land on the side arrows (up to 1,710 px² of overlap) and on the ⬇️ pill.
- In landscape the dashed 'hang it here' bubble sits under the 🎁🖼️ and 📁 alerts.
This is the dad's 'giving isn't obvious' complaint.
- change: - With a picture, the stop chip reads 🖼️✋, like 🍽️✋ for a dish.
- With a dish, give bubbles appear over Daddy, Mommy, Rory and Jeff. Nunu gets none, because she refuses food.
- With a picture, they appear over all of those plus Nunu.
- Each bubble does exactly what that person's own give choice does today.
- Bubbles sit over the head but are nudged clear of the side arrows, the pill and the alert row, and 'hang it here' drops below the alerts.
- No new ring choices.
- implementation: - currentActivity wrapper (the overlay's only one; G31 adds its Niko picture to the same map): if the result is '✋' && G.holding && G.holding.type === 'pic', return '🖼️'. The stop button interval (features.js:79) calls it by name.
- Local edit nav.js:61-62, marked /* G17 */:
  - the person list becomes [daddy, mommy, rory], plus jeff, plus nunu when the held thing is a picture, while Clarity.on.G17 (with typeof guards);
  - Jeff's dish bubble: approach(jeff.x, () => { const a = entActions(jeff).find(x => x.ico === '🍽️'); a && a.fn(); }, 26). His first 🍽️ is serve; the second is pressureEat;
  - pictures keep Pics.gift(h.url, e);
  - Nunu's and Jeff's heights come from their sprite tops (as UI's entTop does), while Daddy, Mommy and Rory keep today's heights.
- In the positioning loop (nav.js:67): clamp x to [arrowW+35, stageW−arrowW−35]; if a bubble's box overlaps #floorpill or #alerts, push it below them. The wall bubble too.
- must still work: ✋ still drops the picture (same stopActivity); The 📁 and 🎁🖼️ alerts are unchanged and still shown; Daddy's, Mommy's and Rory's bubbles and their serve and gift scenes are unchanged; Nunu still refuses food through her own ring, and Jeff's ring is unchanged; Pics.giftMenu, the studio's give and the cook give row are unchanged; Bubbles still hide while a ring is open or while busy; Picture gifts to Nunu and Jeff are voiced by them (family2.js:9-19 maps r_amazing and r_love to nu_* and j_*)
- benefit: The new grandparents look like people who take her gifts, the bubbles stay over the right person, and the carry chip finally shows what she is carrying.
- risk: Low. These are one-tap shortcuts to outcomes that already exist. Like today's bubbles, an open bubble also hides 📒/👗 and holds back requests (nav.js:92, fun.js:92), now for Nunu and Jeff too. Check that Jeff's bubble at the edge of the backyard is not on an arrow.

### G18 The thing she tapped lights up at once and stays lit until its choices close
- problem: 16 of 30 taps on things make Marina walk first. The choices appear after a median of 0.95 s (up to 3 s), and nothing marks the target meanwhile. She taps again, and the backdrop eats that tap just as the ring appears. A third tap hits Marina, now standing in front of the stove, and offers 🤸💃.
- change: Keep the walk and its timing. From the tap until the choices close, the tapped thing glows at full strength, with the same warm glow she sees when she stands next to things. One sparkle appears as she sets off. Nothing is lit during scenes.
- implementation: Block G18.
- Wrap the global interact(hit, wx, wy) as the outermost wrapper. For a prop, person or fort hit other than Marina, while !G.busy: set Clarity.target = the hit's object and Clarity.targetT = E.t, and emit('sparkle', x, y−24, 3) once.
- Clear the target on UI.closeActions (wrapper), on her next tap elsewhere, on a room change, after 5 s without a ring, and as soon as G.busy || G.sceneOn becomes true (nav.js's near() is false then).
- Local edit in the nav.js glow code (nav.js:152-176), marked /* G18 */: treat Clarity.target like a nearby thing at full strength.
- The target is stored on Clarity, never on G, which is saved state.
- No touch-down ring, no trail of dots.
- must still work: Walking, approach distances and arrival timing; Doors are still used on arrival; The choices and their order; The proximity glow when she stands next to things; Nothing glows during scenes
- benefit: She sees that the game understood her tap, so she waits instead of tapping again, and the link between 'I tapped the oven' and the oven's choices stays visible.
- risk: Low. A little light, only after her own taps.

### G19 Landscape: the mood faces get their own column, and the picture stops where the faces start
- problem: In landscape #moodbar floats over the right ~70 px of every room (style.css:26, 233-241; z6).
- 33 of the 50 covered props sit under faces: the keyboard 96% under 😭, the den ottoman 100%, the backyard toolbox 100%.
- A tap on Daddy at the right edge started a 😢 scene, then about 10 s of dead taps.
- Rings land on faces in 13 of 44 menus, and the deer's right tab sits under the column.
- The right arrow floats 74 px in from the edge (nav.js:145).
- The 😊 toggle above the column looks like a sixth feeling.
- change: Landscape only. The faces become a real column beside the picture: the same five faces, in the same order and the same place on screen. The picture ends where the faces begin, so nothing in the room is ever under a face, and the right arrow sits at the edge of the picture, as in portrait. The 😊 toggle becomes the column's header handle: purple like the column, still showing the current mood, with a small ▸/◂. One tap still folds or unfolds it, folding widens the picture, and a hello still unfolds a folded column.
- implementation: - CSS block G19 inside @media (orientation:landscape). #app is already a flex row (style.css:24).
  - #moodbar{position:relative;top:auto;right:auto;bottom:auto;flex:0 0 auto;align-self:stretch;margin:74px 8px 6px 6px}
  - #moodToggle{position:fixed;top:calc(env(safe-area-inset-top) + 8px);right:calc(env(safe-area-inset-right) + 8px);background:#3a2f57;border-radius:16px 16px 8px 8px}, with an ::after chevron (◂ while the column is folded)
  - .navarrow.r{right:0}
  - .facecard.right and #weatherBtn: right offsets reduced by the old overlay width
- Local edit game.js:286, marked /* G19 */: the +76 in the landscape padR becomes (window.Clarity && Clarity.on.G19 ? 0 : 76).
- JS: a MutationObserver on #moodbar's class calls resize() on the next frame. That covers both the 😊 tap and pulseMoods' unfold (ui.js:97). Also call resize() once after boot.
- must still work: All five moods, their scenes and the tantrum; 😊 folds and unfolds with one tap and shows the current mood; A hello still unfolds a folded column, so answering stays one tap; The right arrow travels as before; Face cards, the weather button and the deer and turkey tabs are visible; Full-screen activities and xFloat are unaffected; Portrait is unchanged; G4's living-room framing still puts the TV below the strip
- benefit: Ends the accidental mood scenes, and the dead seconds after them, when she aims at things on the right. Everything on the right side of every room becomes tappable.
- risk: Medium. The landscape picture shows about 9% less of each room (viewW 336 → about 309 units), and the canvas resizes when she folds the column. Check: the trees.js:303-318 nudge (now does nothing), wildlife's clearZone() and tabs, the TV framing, and 667x375 with insets.


# Group: menus-icons

### G30 The stairs choices say up or down
- problem: The foyer stairs and the landing's stair top offer the same two pictures, 🪜 (climb) and 💺 (Mommy's stairlift) (upstairs.js:275-276), whether they go up or down. 💺 is also the landing's room icon on the strip and on the arrows.
- change: On the stairs rings, both choices carry a small ⬆️ (foyer) or ⬇️ (landing) corner badge, the same arrow as the pill and the stair signs (G35). Glyphs, order and actions are unchanged.
- implementation: In the overlay's UI.actions wrapper, after the original runs: if anchor.prop && ['stairs','ustairs'].includes(anchor.prop.a), append <i class=cm-badge>⬆️</i> or ⬇️ to the .act nodes whose text is 🪜 or 💺. CSS: .act .cm-badge{position:absolute;right:-6px;bottom:-6px;font-size:20px;font-style:normal;pointer-events:none}. No sprite images are used (ui.js:52's a.img path renders '' for a missing sprite).
- must still work: Stairs and stairlift trips and their landing spots; The ring order; Choices are still identified by their handler in regress.js (the badge is a child element)
- benefit: Before she taps, she can see whether the stairs and the chair go up or down.
- risk: Very low. These are new-area choices.

### G31 A wish, a request and the ✋ chip show the same picture as the choice they point to
- problem: Wishes, requests and the stop chip use a second picture for the same activity.
- Drawing is 🎨 on the tables and as the dining room's icon (game.js:472, world.js:10), but 🖍️ on the wish and on Mommy's request (react.js:87, fun.js:69).
- The fort is 🏰 on the sofa (game.js:474), but ⛺ on the wish (react.js:88).
- Feeding Niko is 🐟 on the bowls (game.js:469), but 🥫 on Niko's request and its bubble (fun.js:76, 82).
- Niko is 🐈 everywhere except 🐱 on the ✋ chip while she carries him (features.js:59).
- change: Each prompt shows the picture of the choice it points to:
- 🖍️ → 🎨, ⛺ → 🏰 and 🥫 → 🐟 on wishes, requests and their speech bubbles;
- 🐱 → 🐈 on the ✋ chip.
Not changed: stickers (her earned collection), the swing's 🛝, the fort-invite buttons, and every choice glyph.
- implementation: - Block G31, at load: WISHES.draw.ico = '🎨' and WISHES.fort.ico = '🏰' (WISHES is a top-level const in react.js); Object.assign(SAY_ICON, { m_want_draw: '🎨', m_want_fort: '🏰', mo_req_draw: '🎨' }).
- Local edits, marked /* G31 */, inside fun.js's closure (REQS is private there): fun.js:69 ico '🎨'; fun.js:76 ico '🐟'; fun.js:82 UI.bubble(niko, '🐟', 2400).
- currentActivity wrapper (shared with G17): niko → '🐈'.
- WISHES and REQS keys and sticker ids are unchanged.
- must still work: Every wish, request and stop chip works as before; Stickers already earned still show as earned (fun.js:18-21 untouched); The swing choices and the fort invite; Speech bubbles for other lines
- benefit: One picture leads to one thing: when Marina says 'I want to draw' and shows 🎨, the 🎨 on the table is the same idea.
- risk: Low. A small habit cost on the wish pictures she has seen (🖍️, ⛺); the choices she taps are unchanged.


# Group: prompts

### G20 Grown-ups say hello once per real visit, and Marina's reply isn't said twice
- problem: onEnterRoomBy (game.js:1046) greets her with only a 30 s per-person cooldown. Grown-ups change room every 8–18 s with a 45% chance, so while she stands in the kitchen she hears 'Hi sweetie!' from Mommy, then Daddy, then Mommy again: 13–19 hellos per 15 idle minutes on the main floor, 22–24 upstairs. Each brings a face card and makes the mood faces invite her for 7 s. 'Hi Nunu' was heard twice 0.4 s apart.
- change: - A grown-up who walks back into her room greets her at most once every 3 minutes, which means once per real visit.
- When she walks into a room herself, the greeting rule is unchanged.
- Marina's reply to Nunu or Jeff plays at most once per 10 s.
- Every hello line stays.
- implementation: - Block G20, the outermost wrapper: const GAP = 180; const _oeb = onEnterRoomBy; onEnterRoomBy = function (e) { const t = G.lastGreet && G.lastGreet[e.id]; if (Clarity.on.G20 && t && E.t - t < GAP) return; return _oeb.apply(this, arguments); }.
  - It sits over family2.js's full-screen guard.
  - It covers the wanderers (game.js:1022-1023, more.js:119-120) and the upstairs visits (upstairs.js:304), which all call onEnterRoomBy by name.
  - It only reads G.lastGreet.
  - onEnterRoom (her own room entries, game.js:339-349) keeps its 30 s rule, because family2.js:171-179 relies on it.
- Local edit family2.js:179, marked /* G20 */: skip m_hi_nunu or m_hi_jeff if Marina's reply played less than 10 s ago (a module-level time). The nu_septic_thanks branch is untouched.
- must still work: Every hello line is still used; The first hello of each real visit still plays, with its face card and the mood invitation; Grown-ups still wander and still walk in to see her upstairs (silently when held back); Greetings when she enters a room herself are unchanged; Marina's reply to Nunu and Jeff still plays on each arrival, and Nunu's nu_septic_thanks too; G.moodCtx 'greet' is set after every hello that plays
- benefit: The main nagging voice of free play drops from about 13–19 hellos to about 5–6 per 15 min, and with it the matching face invitations that tempt her into 7-second dead scenes.
- risk: Low. The house is a little quieter: a parent popping back after 2 min doesn't greet. To revert, set GAP to 30.

### G21 Uncle Rory doesn't walk up to chat while she swings, hangs on the bars or rides, and giggles at most once per 90 s
- problem: Rory's walk-up (more.js:114: every 9–18 s, 40% chance) checks only !G.busy and !marina.mount. While she was swinging (the game itself shows ✋ then), he walked up and giggled 12–13 times in 5 minutes, and he said three lines in 28 s while she stood idle.
- change: - Rory does not walk up while she is on a swing, on the monkey bars, in the wheelchair or in a looping bounce. Riding is already excluded.
- When he does walk up, his line and stars come at most once every 90 s. Otherwise he simply arrives and turns to her.
- He still wanders, greets her, asks his requests, does horseplay and plays chase.
- implementation: Local edits in more.js:114, marked /* G21 */:
- add && !(window.Clarity && Clarity.on.G21 && Clarity.bodyBusy()) to the walk-up condition;
- inside the walkTo callback, run say(pick([...]), e) and emit('star', ...) only if E.t − roryLineAt > 90 (a module-level let, set when the line plays) or the flag is off. Otherwise only set e.dir toward Marina, as today.
- must still work: All four lines (r_giggle, r_hi_niece, r_hi_niece3, r_chase) and the stars still play; His wandering, hellos, requests, horseplay and chase are unchanged; Walk-ups still happen whenever she is not swinging, on the bars, in the wheelchair or bouncing; The swing, the bars, rides and ✋ are unchanged
- benefit: Swinging, the dad's kind of activity, is no longer peppered with Rory's giggles, and his giggle becomes a treat again.
- risk: Very low: two added conditions.

### G22 Every speech bubble shows a picture of what it is about, not an empty 💬
- problem: say() falls back to a blank 💬 when a line has no SAY_ICON (game.js:54). About 50 new lines have none: Nunu's sweeping, laundry, dusting, clutter and film talk; her smell and septic lines; Daddy's phone lines; Jeff's work and helper lines; the deer, turkey and squirrel lines; the hello replies to Nunu and Jeff; 'where's Minka'. To a non-reader, a voice with 💬 is just noise, and in the basement and backyard that is most of the bubbles.
- change: Each of those lines shows an existing emoji for its topic:
- chores 🧹 or 🧺, dusting 🪶, clutter 🧸;
- films 🎬, m_precious 💍;
- smell 👃, septic and 'tell Daddy' 📞;
- Daddy's phone 📱, Jeff's work 🔨;
- deer 🦌, turkeys 🦃, squirrel 🐿️;
- hello replies 👋, 'where's Minka' 🐈‍⬛.
The voices and face cards are unchanged.
- implementation: Block G22: Object.assign(SAY_ICON, {...}), adding only keys that have no entry yet (check !(k in SAY_ICON)). The keys are enumerated from the say('…') and sayG('…') calls in family2.js, wildlife.js, minka.js, basement.js, upstairs.js and outdoor.js that lack an entry; the prompts report §1 lists them. This is a static table: say() is not wrapped. SAY_ICON is the global object at world.js:308.
- must still work: Every voice line and face card; Existing bubble icons are untouched (only missing keys are filled)
- benefit: Every time someone speaks she gets a picture of what they mean, which turns the grandparents' chatter from mumbling into 'Nunu is doing the laundry'.
- risk: Very low.

### G23 Motion means 'new': alerts pulse when they arrive and then rest, arrows bob on arrival, the idle wiggle backs off, and 🧻🚽 turns red
- problem: - .alertb pulses forever (nav.js:134). Nappy, poop and toilet-paper alerts stay until solved, so they pulse 598–785 s of every 900, often two or three at once.
- The side arrows wiggle endlessly and move the whole button 4 px into the scene (nav.js:127-130).
- The idle wiggle bounces a random prop with sparkles every 4 s after 10 s untouched: 222 times per idle 15 min, sometimes a prop under a button (features.js:592-602).
- So nothing stands out, and a crying baby or a fresh wish gets lost.
- 🧻🚽 ('someone is stuck') is green, like the 'with what you hold' shortcuts.
- change: - An alert pulses for its first 15 s, and for 4 s whenever she changes room. In between it rests: the same red disc, same size, same picture, same single tap, just still.
- The side arrows bob for about 2 s when she arrives in a room, and only the ◀/▶ glyph moves, so the button no longer creeps into the scene.
- The idle 'try me' wiggle still first appears after 10 s without a touch. Then it backs off to every 8 s, 16 s, then 20 s, and starts over on any touch. It never picks a prop whose middle is under a button, and it waits while a fresh alert, wish or request is pulsing.
- 🧻🚽 turns red. Red means someone needs you; green means do something with what you hold.
- The rule that alerts hold back requests (fun.js:92) is unchanged, and no alert changes size.
- implementation: - Block G23 tick: stamp data-born on each new .alertb, and add .settled after 15 s. A Floors.hooks entry removes .settled for 4 s on every room change.
- CSS:
  - .alertb.settled{animation:none}
  - .alertb[aria-label=tp]{background:#ff6b6b;box-shadow:0 4px 0 rgba(0,0,0,.3),0 0 0 6px rgba(255,107,107,.35)}
  - .navarrow{animation:none!important}
  - .navarrow.cm-arrive i{display:inline-block;animation:navl .6s ease-in-out 4 alternate}, with navr for .r. The class is added for 2.4 s on each room change.
- Local edit features.js:598, marked /* G23 */:
  - hintT > 4 becomes hintT > (window.Clarity && Clarity.on.G23 ? Clarity.hintGap() : 4);
  - the props list skips any prop whose screen centre does not hit #cv with elementFromPoint.
- Clarity.hintGap() returns 4, 8, 16 or 20 by how many wiggles have happened since lastInput, and Infinity while '.alertb:not(.settled),#wishBtn,#reqBtn' exists.
- must still work: Every alert still appears, zips her there and runs the same choices; Nappy, poop and toilet paper still stay until solved; The 'with what you hold' shortcuts keep their function and their green; Alerts are still hidden during screens and the TV; The arrows still travel, show where they go and hide while busy; The idle wiggle still fires after 10 s untouched; The request gate (fun.js:92) is unchanged
- benefit: When something moves, it is new or it matters. A crying baby or a fresh wish stands out instead of drowning in constant motion.
- risk: Low. A settled alert is less insistent, by design; it is still visible and one tap away. Small habit cost: 🧻🚽 changes from green to red.

### G24 The mood faces glow in place, and only when a feeling-answer fits
- problem: UI.pulseMoods (ui.js:97) adds .pulse to #moodbar. The generic .pulse rule (style.css:107-108) then animates the whole bar on top of each face's own tilt. In portrait the faces spill to x −22..412 and down to y 864 on an 844 screen; in landscape they overlap and 😭 is cut off. This happens after every hello, 14–23 times per 15 min, so her five biggest buttons wobble with nothing to answer, and pressing one locks taps for about 7 s.
- change: - The bar never moves. Each face gets a soft yellow glow ring and a swell of at most 4%, in place.
- They glow after a scold, a refused dish, the TV being switched off, the fort falling, and after the first hello from a person in 5 minutes.
- A repeat hello within 5 minutes still sets up the greeting, so a mood tap still answers it, and still unfolds a folded landscape column. It just doesn't glow.
- implementation: - CSS block G24:
  - #moodbar.pulse{animation:none!important}
  - #moodbar.pulse .mood{animation:cmMoodGlow .6s ease-in-out infinite alternate}
  - @keyframes cmMoodGlow{to{box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 6px #ffcf4a;scale:1.04}}. The separate scale property is used, so each face keeps its own tilt.
- Wrap UI.pulseMoods:
  - if G.moodCtx && G.moodCtx.type === 'greet' and that person's last glow was less than 300 s ago, only remove .collapsed from #moodbar (today's unfold) and return;
  - otherwise record the time and call the original.
- G.moodCtx, the 7 s timer and unpulseMoods are untouched.
- must still work: Every mood scene; setMood's greeting, scold and refusal contexts (game.js:580); The 😊 toggle; A hello still unfolds a folded landscape column, so answering stays one tap; The glow stops when she picks a mood
- benefit: The biggest buttons stop wobbling off the screen and inviting her for no reason, which means fewer accidental mood scenes and fewer dead seconds.
- risk: Low; there are fewer glows, by design. Check that G.moodCtx records who greeted; if it does not, key the 5-minute rule by the face card shown with the hello.

### G25 Wishes and requests join Marina's row under the picture, never on a face card or on ✋, and a request shows who is asking
- problem: - In tall portrait, #wishBtn and #reqBtn sit at right:16, top stageH+10 (react.js:143, fun.js:210), on the right face card. When Daddy asks for something, his face card, the only picture that says WHO is asking, is under the blue button (80x82 px overlap). Their scale pulse grows to 99 px.
- The request's badge is a generic emoji (👨‍🦲 for Daddy, fun.js:83).
- In landscape and in short portrait both sit at left:104, overlapping ✋ by 11–15 px, and a request can sit completely under a wish.
- change: - Tall portrait: one centred row between the face cards holds Marina's things, left to right: [✋] [📒][👗] [wish or request]. Nothing in it ever overlaps anything else, and both face-card corners stay free. Wish and request are 72 px there, and they pulse with a glow ring instead of growing.
- Elsewhere: when ✋ shows, the wish or request sits 8 px to its right; otherwise it stays where it is today.
- A request's badge becomes the asker's face portrait, the same picture as their face card. The wish keeps its activity picture.
- The first 3 times per session that a prompt appears in the portrait row, it glides in from its old right-hand spot.
- Same colours, same ➡️, same tap, same 14 s and 25 s lifetimes.
- implementation: Block G25.
- CSS @media (orientation:portrait) and (min-height:150vw): #wishBtn,#reqBtn{position:fixed;top:calc(env(safe-area-inset-top) + var(--stageH) + 12px);right:auto;bottom:auto;width:72px;height:72px;animation:cmGlow .7s ease-in-out infinite alternate}. cmGlow animates box-shadow only.
- Row layout, run from a MutationObserver on #stage (childList) and from the 250 ms tick, while a prompt exists:
  - take the visible members in order: #stopBtn, then #bookBtn and #dressBtn (only when Clarity.on.G16), then #wishBtn, then #reqBtn;
  - measure them and set each one's left (and #stopBtn's translate) so the row is centred with 6 px gaps;
  - if the row is wider than the space between the face cards (100vw − 2×(21vw+10px)), scale all members down evenly, never below 56 px;
  - when no prompt shows, clear these inline styles, so ✋ and 📒/👗 return to their CSS spots.
- Other layouts: if #stopBtn is visible, set prompt.style.left = (stopBtn's right edge − stage left + 8) px; otherwise clear it.
- Badge: on a new #reqBtn, read who from its aria-label 'help <who>'. Replace its <b> emoji with a 40 px canvas drawn from FACES face_<who>_happy_rest, as pool.js:879 faceIcon does. Keep the emoji if FACES is not loaded.
- Glide: an in-memory count, and a 500 ms translate keyframe.
- Everything is positioned with left/translate, never transform (G5).
- must still work: Every wish and request, its voice line, its button, its go() and its lifetime (react.js:117, fun.js:85), and the 150 s completion window; ✋ still works when shown in the pair, and keeps its press feedback; Face cards keep both corners and still zip her to that person; 📒/👗 still hide while a wish shows (nav.js:92), and stay visible and tappable while a request shows; Requests are still removed during screens and busy moments, as today; Niko's request
- benefit: She can see who is asking, which makes a request feel like pleasing Daddy rather than a random blue button. Nothing she might want to press is ever hidden under another button, and her own things live in one row.
- risk: Low-medium habit cost: in portrait, prompts move about 110 px from the right to the centre (they pulse when new, so they are easy to spot). Check on 375 px that the [📒][👗][request] row keeps every member at least 56 px and clear of the 79 px face cards, and check 390x664 and notch insets.

### G26 Nunu's 'go tell Daddy' job: no repeat while it's untold, and a still 📞 bubble over Daddy
- problem: smell() (family2.js:154-162) sets G.septic and shows an off-centre 📞👨 for 1.3 s, then nothing more. The job then lives only as 📞, the first choice in Daddy's ring (family2.js:277), and Daddy is usually a floor away. The smell repeats while the first one is still untold: family2.js:145 has no !G.septic check, and 2 smells per 15 min were measured.
- change: - No new smell starts while the first is still untold.
- Until she tells Daddy, a still green 📞 bubble floats over his head whenever he is in her room. It looks like the give bubbles but does not pulse, and tapping it walks her to Daddy and does exactly what his 📞 choice does.
- tellDaddy, its lines, the 📞 sticker and Nunu's thanks are unchanged.
- implementation: - Local edit family2.js:145, marked /* G26 */: add && !G.septic.
- Block G26, in the overlay's outermost featTick wrapper:
  - keep one button with its own class .cm-call (styled like .pichint.gift, no animation) over Daddy while G.septic && daddy.here && !daddy.hidden && daddy.state !== 'toilet' && !G.busy && no .act is open;
  - clamp it as in G17;
  - tap: approach(daddy.x, () => { const a = entActions(daddy).find(x => x.ico === '📞'); a && a.fn(); }, 26).
- It is not a .pichint, because nav.js:92 hides 📒/👗 and fun.js:92 holds back requests whenever a .pichint exists.
- must still work: The smell scene, its stink clouds and G.septic; tellDaddy, its lines, the 📞 sticker and nu_septic_thanks at her next hello; 📞 is still first in Daddy's ring; 📒/👗 and requests are not affected by the bubble
- benefit: The basement's little story becomes a goal a non-reader can see and follow up the stairs.
- risk: Low. The smell happens at most once until it is told.

### G27 A new sticker's picture waits for the room and flies into the 📒; a treasure's 💎 waits for the choices to close
- problem: award() (fun.js:23-31) pops a 120 px gold disc at z40 over whatever screen is open: the Lego model, 'The End', the dress-up show. It then flies to a fixed corner (fun.js:197: translate(42vw,34vh)), where 📒 usually is not, because 📒 shows only when she is idle. So she never sees stickers go into the book. A found treasure's 💎 (fun.js:107-112) pops over the ring that is opening at that moment.
- change: - Same sticker, same moment of earning, same jingle and voice line, same save.
- If a full screen is open, the picture waits and pops over the room when she closes it. It then flies to where 📒 lives.
- If nothing else is in Marina's row at that moment, 📒 peeks for 2.5 s with a small wiggle. This is look only: it never makes 📒 tappable when it otherwise wouldn't be.
- A treasure's 💎 pops after the choices close, or 1.5 s after they open.
- implementation: Block G27.
- A MutationObserver on #stage and #title watches for .stk-toast. If Clarity.screenOpen(), set it to display:none and queue its glyph. On the core tick's screenOpen() true→false edge, create the toast again.
- When it plays, set --tx/--ty from the toast centre to #bookBtn's computed home rect, and use @keyframes cmStkFly whose 100% step is translate(var(--tx),var(--ty)) scale(.15).
- If #stopBtn, #wishBtn and #reqBtn are all absent, add the class cm-peek for 2.5 s with the CSS #bookBtn.off.cm-peek{opacity:1}. It applies only while .off is on, which already blocks taps, and it is a class because fun.js:42 re-toggles 'off' every 250 ms.
- UI.bigIcon wrapper (the overlay's only one): a glyph ending in '✨' (fun.js:112) that arrives while an .act exists is deferred until UI.closeActions or 1.5 s.
- The m_sticker and m_found voices are not moved.
- must still work: Every sticker is awarded and saved at the same moment (store 'stickers'), with the jingle, m_sticker, and confetti for the full set; Treasures are found and saved, with m_found and secretall; The sticker book's contents; 📒's tap rules are unchanged
- benefit: Nothing pops over what she is building, and she learns that stickers go into the 📒 book and where that book lives.
- risk: Low. Check that each queued sticker replays exactly once, and never over a screen that has just opened.

### G28 The start of a game brings one thing at a time
- problem: startScenario picks one of 8 start events (features.js:294-304), and react.js:121-126 adds an independent 30% wish at 4.2 s without checking anything. Seen: a crying alert with 'uh-oh', then a ⛺ wish within 4.5 s; and a 🐈 wish replaced by 🤸 2.5 s later, with a second voice line.
- change: Keep the lively start event. The extra start wish waits while something else is already asking (a wish, a request, an alert, or Miles crying), checking every second for up to 20 s, and then comes as today. If something is still asking after 20 s, the normal idle-wish rule takes over.
- implementation: Local edit react.js:125, marked /* G28 */: replace the 4.2 s callback with a retry.
const tryWish = n => { if (G.busy || G.sceneOn) return; if (window.Clarity && Clarity.on.G28 && (wishEl || document.querySelector('#reqBtn,.alertb') || miles.crying)) { if (n < 20) setTimeout(() => tryWish(n + 1), 1000); return; } makeWish(); }; setTimeout(() => tryWish(0), 4200);
- must still work: All 8 start events; The start wish in calm starts; The room picker, 🎲 and the outfit reset (calm.js:43-45); Wishes later in the game
- benefit: The first seconds of every session bring one clear thing instead of a pile-up.
- risk: Low. The optional start wish sometimes comes a little later, or is left to the idle rule.

### G29 Minka's mews from other rooms come at most once per 30 s; her silent hints keep their pace
- problem: hideTick (minka.js:603-623) gives a cue every 2.6–4.8 s. In other basement rooms that cue is, 35% of the time, a faint mew plus (60%) a 🐾 hint (minka.js:622). Together with the same-room cues, that is about 55 mews and 48 paw hints per 15 min of walking in the basement: roughly 100 sounds.
- change: - The faint far-room mew plays at most once every 30 s. When it is skipped, the silent 🐾 hint shows instead.
- Same-room cues (peek, tail, ear, eyes, wobble, mew) are unchanged, so she is exactly as findable.
- implementation: Local edit minka.js:622, marked /* G29 */. In the far-room branch, play Audio2.sfx('minka_mew', { vol: 0.2 }) only if E.t − farMewAt ≥ 30 (a module-level let, set when it plays). When it is skipped, call pawHint(s.room) unconditionally. Otherwise keep the existing 60% pawHint chance.
- must still work: Hide-and-seek, the 100 s timeout and the end 40 s after she leaves the basement; The 🔍 markers, the 🔍 choice and the found scene; The silent cues and the same-room mews; Nunu's and Marina's 'where is Minka' lines
- benefit: The basement stops meowing every few seconds, so a mew means something again.
- risk: Low. Measure basement-walking sounds per 15 min, and how often she finds Minka within the 100 s hide, before and after; the find rate should not change, because the paw hints and same-room cues are kept.


# Group: screens

### G32 Studio sideways: the floating ❌ comes back in its own slot under the tools, never on the paper
- problem: Fix 9 hid the floating ❌ in the studio because it sat on the paper. The studio is now the only landscape screen whose only way out is a 60x40 ❌ 6 px from the top edge (style.css:188, art.js:56), under Safari's bar and the notch. This is the dad's '✖ unreachable in landscape' complaint.
- change: Landscape only. The tool column ends one button-height above the bottom (it already scrolls), and the same floating ❌ every other screen has sits in that empty slot, under the tools and never on the paper. The sticker drawer moves right by the notch inset, so the ❌ never covers its first tile. The top ❌ stays.
- implementation: CSS block G32 inside @media (orientation:landscape):
- #studio .s-tools{align-self:start;max-height:calc(100% - 80px)}
- #xFloat.art{display:block;left:calc(env(safe-area-inset-left) + 8px);width:64px;height:64px;font-size:30px;opacity:1}
- #studio .s-drawer{left:calc(env(safe-area-inset-left) + 80px)}
calm.js already sets .art while the studio is active (calm.js:59), and its target() already returns the studio's close button, so a tap closes and saves exactly like the top ❌.
- must still work: The studio's top ❌ is unchanged; Drawing anywhere on the paper, including its bottom-left corner, never closes the studio; Every tool can be reached (the column scrolls); The sticker drawer is fully clear and usable; The portrait studio is unchanged; The paper bitmap S.W×S.H set when the studio opens (art.js:28-31) is identical to today in land, landSmall and 844x340, so studioDraft and loaded pictures are not stretched
- benefit: Every landscape screen has the same easy bottom-left way out, and the studio no longer depends on a thin button at the top edge.
- risk: Low. It undoes fix 9's blanket hide, in landscape only. Verify with elementsFromPoint at the button's centre that no paper, tool or drawer tile is under it, with 0 and 47 px insets.

### G33 One way-out look, and ❌ only ever closes
- problem: - The story and the sticker book close with a black ✖️ on a 52 px tile (story.js:26/80, fun.js:38), while every other screen uses a red ❌ on a 60x60 white tile. In landscape they show ✖️ at the top and a red ❌ at the bottom for the same action.
- In the new screens the same glyphs mean other things:
  - the Lego shelf's top-left ❌ only goes back one step in the hero and move views (legoshelf.js:197);
  - Movies uses ⏹️ to mean 'back to the posters' (movies.js:893);
  - on Grandpa Jeff's built things, 🧹 means 'take it down' and 🎨 means 'recolour' (builder.js:398).
- change: One way out on every screen: a red ❌ on a white 60x60 tile at the top-left, doing exactly what it does today. ◀️ means one step back, and 🗑️ means throw away. Only glyphs change:
- story and sticker book ✖️ → ❌, on the same tile;
- Lego shelf hero and move views ❌ → ◀️ (❌ stays only on the shelf view);
- Movies ⏹️ → ◀️;
- built things: 🧹 → 🗑️ and 🎨 → 🖌️.
Deliberately unchanged:
- the fort builder's piece-delete ❌, because a 🗑️ there would sit next to the clear-all 🗑️, which has no undo (fort.js:18);
- the wall picture's 'tap the bin again' confirm;
- the fort interior's 🚪.
- implementation: - Local glyph edits, marked /* G33 */:
  - story.js:26 and fun.js:38: '✖️' → '❌';
  - legoshelf.js:197, and every place Gy.mode changes (hero, move, shelf): set the button text for the mode;
  - movies.js:893;
  - builder.js:398, plus its glyph list at builder.js:402 (['🎨','🧹','❓'] → ['🖌️','🗑️','❓']), so the secondary .bd-sec styling stays. Grep builder.js for other ico lookups of 🧹/🎨 on built things and update them together.
- CSS block G33: .st-x{width:60px;height:60px;border-radius:18px;background:#fff;font-size:30px;box-shadow:0 4px 0 rgba(0,0,0,.3)}.
- calm.js target() finds buttons by class and aria-label, so the floating ❌ keeps working and copies the new glyph (G3).
- must still work: Every close button closes the same screen the same way (the story, and the sticker book in the game and on the title); The story's back button (.st-back) is unchanged; Lego shelf putBack, endMove and close; Movies goes back to the posters; Take-down (with its ❓ confirm) and recolour of built things; The fort piece delete, wall-picture delete and studio bin, with their confirms, are unchanged
- benefit: She can trust ❌ completely ('this gets me out'), and the way out looks the same on every screen.
- risk: Low. A small habit cost on the story and sticker book ✖️ (same place, same X shape, now red). Add these to regress.js's list of expected renames.

### G34 Hidden hot spots in the new screens look tappable, and there is one pointing hand everywhere
- problem: Several new screens rely on guessing:
- the popcorn in Movies is an invisible 94x83 button (movies.js:895);
- shelf models give no cue that they open (legoshelf.js:176-197);
- Nunu's face on the Lego plate looks like a portrait, but tapping it picks an idea (bricks.js:278, 506-513);
- treetop landmarks hint only after she has dragged (treeclimb.js:803-804).
The 'tap here' idle hint has three looks: a yellow ⬇ arrow in the spa (spa.js:777-790; yet another ⬇ meaning, and it resembles the spa's green ⬆ go button), a 👆 ghost in Stuffies, and a pixel hand in the tree.
- change: Reuse patterns the game already has, with no change to what any tap does:
- on opening, the shelf models do their existing hop-wave once;
- during a film, after 8 s with no tap, the existing pointing hand shows once over the popcorn;
- Nunu's face on the plate gets a small 🧱 badge with the keep button's soft pulse;
- treetop landmarks twinkle faintly from the start;
- the spa's idle ⬇ arrow becomes the same pointing hand as the tree and Stuffies, with the same targets and timing.
- implementation: - Local edits, marked /* G34 */:
  - legoshelf.js open(): call the existing full-shelf wave once;
  - movies.js near :895: an idle timer that draws the stuffies.js:766-774 ghost hand once;
  - spa.js:777-790: draw treeclimb's HAND pattern instead of the ⬇;
  - treeclimb.js:803: twinkle from t=0.
- CSS block G34: an ::after '🧱' badge on Bricks' partner-face element, with the keep button's pulse and pointer-events:none.
- must still work: Every hot spot does exactly what it does today (popcorn, models, Nunu's turn, landmarks, spa steps); The spa's idle-hint timing; No new tappable areas
- benefit: In the screens she has not met yet, the things she can touch announce themselves, and 'tap here' always looks the same.
- risk: Low. These areas are new, so there is no habit cost.


# Group: wayfinding

### G35 Every door and staircase to another floor or outside shows where it leads, and rooms with no arrows point to their way out
- problem: Only the foyer's basement doorway (basement.js:139) and the tree-house hatch show where they lead. The foyer stairs, the landing's stair top (it reads as a balcony rail), the den stairs, the den's Dutch door and the backyard back door show nothing, and several are surprising: the back door goes DOWN, and the den stairs take her upstairs in 1.1 s. In the bathroom, the spa and the tree houses there are no side arrows, and the only way out starts off-screen. The pool and the backyard were reached in only 1–2 of 9 random runs.
- change: (1) Each door or staircase that changes floor, or goes between inside and outside, gets the sign the basement doorway already has. It is drawn on the picture (not a button), stays still, and shows only while the doorway is on screen. It uses the same badge as the ⬆️/⬇️ button that makes the same trip:
- foyer stairs ⬆️🛏️;
- landing stair top ⬇️🏠;
- den stairs ⬆️🏠;
- backyard back door ⬇️🛋️;
- den Dutch door 🦌;
- the foyer basement doorway's ⬇️ gains 🛋️.
A sign is drawn over a part of its doorway that is not under a side arrow, the pill, the strip or the faces. In portrait the foyer stairs sit under ▶📺, and a sign there must not lure taps onto the arrow. If no clear spot exists, it is not drawn that frame.
(2) In rooms with no side arrows (bathroom, spa, tree houses), when the way out is off-screen, a small edge tab like the turkey tab shows the destination's icon with ◀ or ▶. Tapping it walks her toward that exit, just like tapping the floor on that side.
- implementation: Block G35 wraps the global drawExitSigns (features.js:370, also wrapped by wildlife.js) as the outermost wrapper, and draws after the original.
- Signs:
  - which props: PROPS[G.room] doors whose destination is in a different Floors.of() group, plus the foyer and landing stair props;
  - how: emoji(arrow + badge, x, p.y − (p.h || 60) − 6, 8, .9), exactly as basement.js:139 does;
  - badge: the floors.js:58 pill rule for that level change (🛏️ up from the main floor, 🛋️ down from it, 🏠 back to it), or ROOMS[dest].ico for the Dutch door;
  - x is chosen within the prop's width to avoid Clarity.hudRects(), converted with toWorld.
- Edge tab:
  - port wildlife's tab drawing and its tabY() free-height search (wildlife.js:652-666), and store the tab's rect;
  - the overlay's onTap wrapper checks that rect first and calls marina.walkTo(exit.x ± 20, null, null, FLOOR).
- must still work: Every door, stair and hatch still works by tapping it, with the same landing spots; The stairs' 🪜/💺 choices, the Dutch door, the back door and the hatch; Signs cannot be tapped: taps reach the door; The basement doorway's existing sign; The deer and turkey tabs; The idle wiggle
- benefit: The new floors and the outside become discoverable from the rooms themselves, and every way out says where it goes before she uses it. That is how a non-reader builds a picture of the house.
- risk: Low. Check at the 1.16 landscape zoom that no sign lands under the strip. In portrait foyer runs (first-minutes P_living), check that 'tapped the stairs, went to the living room' does not increase.

### G36 One picture per place: Nunu's room is 👵, the pine tree house is 🌲, and the ⬆️/⬇️ badges are bigger
- problem: - The ⬆️ badge on the main floor is 🛏️ (upstairs.js:15, 'up to the bedrooms'). But in the basement strip, on the den's ◀ arrow and on the map, 🛏️ is Nunu's room DOWNSTAIRS (basement.js:7).
- Both tree houses are 🏡 (builder.js:928).
- The tree-house map row is labelled 🌳, like the yard and the outside row (floors.js:66).
- The pill badges are 17 px.
- change: - Nunu's room's icon becomes 👵, like 👧 (Marina's room) and 👶 (Miles' room), so 🛏️ means only 'upstairs'. The ⬆️🛏️ and ⬇️🏠 pill badges she used to find the new floors stay as they are.
- The pine tree house becomes 🌲; the oak keeps 🏡.
- The tree-house map row is labelled 🏡.
- The pill badges grow to 22 px.
- implementation: - Local edits, marked /* G36 */:
  - basement.js:7: the nunuroom ico '🛏️' → '👵';
  - builder.js:928: ico becomes t.id === 'pine' ? '🌲' : '🏡';
  - floors.js:66: the label becomes f.id === 'tree' ? '🏡' : today's rule.
- CSS block G36: #floorpill .fl i{font-size:22px}.
- must still work: Every strip button, arrow, map tile and pill route travels the same; Room ids, ROOMS keys and saved builds are unchanged (only display icons change); no code compares ROOMS[].ico against 🛏️; Tree houses are still entered by the ladder and left by the hatch
- benefit: The button she uses to find the new floors stops pointing two ways, and the two tree houses look different.
- risk: Very low; new areas only. Check that the 22 px badge fits the 58x46 pill buttons.

### G37 The map reads like the house: upstairs above, her own face as 'you are here', and every room's icon and people
- problem: - The map's floor rows are added after the house picture (floors.js:64-70), so in portrait upstairs is drawn BELOW the main floor.
- Off the main floor, her place is only a static yellow border on a 62x39 tile. On the main floor her room pulses with 👧, which is also the icon of her room upstairs.
- Room labels show only who is there (features.js:417-418), not the room itself.
- Nunu, Jeff and Minka never appear.
- Room shapes are invisible (fill .01, no stroke).
- The strip's green 'someone is here' dot skips Nunu and Jeff (features.js:497-498).
- change: Same tiles and the same one-tap jumps.
- In portrait the ⬆️ row sits above the house picture; the ⬇️ and 🌳 rows stay below.
- 'You are here' is the same everywhere: Marina's own face-card portrait in a small circle with a pulsing ring, on her room in the house picture or on her tile.
- Each room shows its strip icon beside today's people emoji (15 px, with the 💩 and 🏰 markers kept), now including 👵 Nunu, 👴 Jeff and 🐈‍⬛ Minka. Other floors' tiles get the same small people row.
- Every room shape gets a faint dashed outline, so all rooms look tappable.
- On the strip, the green dot also lights up for Nunu and Jeff.
- implementation: - Local edit features.js:413, marked /* G37 */: poly.dataset.r = r (and the same on its <text>), so rooms are matched by key rather than by index (features.js:411 skips some rooms).
- Block G37 wraps openIsoMap as the outermost wrapper, after floors.js:
  - in portrait, move the .fmaprow labelled ⬆️ before .isowrap;
  - add the room icon as a separate text beside the existing label;
  - add a 34 px <image> drawn from FACES face_marina_happy_rest at her room's label point, or an <img class=cm-you> inside .fmaproom.here;
  - give .fmaproom.here the .isoroom.here pulse keyframe;
  - set data-floor on each .fmaprow, for G38.
- CSS: .isoroom{stroke:rgba(255,255,255,.55);stroke-width:1.5;stroke-dasharray:4 3}.
- Strip dots: a 300 ms tick toggles .cm-gp on .rb[data-r] wherever Nunu or Jeff is present and not hidden. CSS: .rb.cm-gp:after uses the same dot as .rb.busy:after.
- must still work: Every room shape and tile still travels with one tap; The map's ❌ and the floating ❌ still close it; The 💩 and 🏰 map markers; The rows still wrap in landscape (fix 7); The existing dots for Daddy, Mommy and Rory; 👧 still names her room on the strip; The map button is unchanged
- benefit: Wherever she is, opening the map shows her own face on her own place, with upstairs drawn up, and 'go to Nunu' can be answered from the map.
- risk: Low. Check that room hit areas are unchanged (the playroom is 45x27), that labels are legible at 375 px, and that the face image falls back to today's 👧 if FACES isn't ready.

### G38 Each floor has one colour on its strip, on the ⬆️/⬇️ button that goes there, and on its map row
- problem: The basement, upstairs, outside and the tree houses share one brown strip (floors.js:80), so the strip cannot say which floor she is on, and nothing ties the ⬆️/⬇️ buttons or the map rows to a floor.
- change: One colour per floor wherever it appears:
- main floor: today's purple;
- upstairs: sky blue;
- basement: warm brown;
- outside and tree houses: grass green.
It is used on that floor's strip background, on the ⬆️/⬇️ button that goes there, and on its map row. Positions, sizes and glyphs are unchanged, and the strip's yellow 'here' highlight is unchanged.
- implementation: - CSS block G38, using the floor ids floors.js writes (main, up, down, out, tree):
  - #roombar[data-floor][data-floor=up]{background:rgba(70,130,190,.8)}
  - [data-floor=down]{background:rgba(110,78,50,.82)}
  - [data-floor=out],[data-floor=tree]{background:rgba(60,130,70,.8)}
  - The doubled attribute selector beats floors.js:80's #roombar[data-floor]:not([data-floor=main]).
  - #floorpill .fl[data-dest=...] gets the same colours. A 200 ms tick sets data-dest from Floors.of(G.room).level ± 1.
  - .fmaprow[data-floor=...] uses the same colours (the attribute is set in G37's wrapper).
- No yard chip, no change to the strip's position.
- must still work: Every strip button travels; The 'here' highlight and the green dots; The pill and the map work the same; The strip still hides while the TV is on in landscape (nav.js:217); The main floor's strip colour is unchanged
- benefit: Colour alone tells her which floor she is on, and which floor a button leads to.
- risk: Low. The pill buttons she uses on the main floor change colour (their glyphs don't). Check that the emoji stay legible on each colour.

### G39 Changing floor slides up or down, and the arrival picture shows the arrow
- problem: Every room change slides the picture sideways or fades it in (features.js:395-396), and the 650 ms arrival picture shows only the room. Changing floor shows no up or down: a 👶😭 tap moves her from the den to the living room in 0.35 s, with no hint that she went upstairs.
- change: When a trip changes floor, the new floor drops in from above when she goes up, and rises from below when she goes down. The arrival picture shows the arrow with the room (for example ⬆️🛋️). This works whether the trip came from the pill, the map, stairs, doors, alerts, wishes or face cards, because all of them go through changeRoom. Trips on the same floor are unchanged, and so are landing spots, timing and outcomes.
- implementation: Local edit features.js:395-397, marked /* G39 */:
- const fd = window.Clarity && Clarity.on.G39 ? Clarity.floorDir(prev, G.room) : 0;
- when fd is not 0, the existing cv.animate uses translateY(fd > 0 ? '-30%' : '30%') instead of translateX, with the same 320 ms on the same element, so there is still only one animation;
- UI.bigIcon((fd > 0 ? '⬆️' : fd < 0 ? '⬇️' : '') + ROOMS[room].ico, 650).
Clarity.floorDir compares Floors.of(room).level, treating outside (null) as 0 and tree houses as 0.5.
- must still work: Every route lands in the same room and spot; The swipe slide; The floor jingles; Arrows still hide while busy; The arrival picture still shows for 650 ms
- benefit: Her sense of 'I went up' finally matches what the screen does, which is how a pre-reader learns the shape of the house.
- risk: Very low.


# Rejected in synthesis
- calm-1, one interruption gate on the global pingOk: rejected. calm.js:17 also uses pingOk to push back Miles' cry timer and G.poopOkAt, so baby and poop timing would shift whenever a ring is open, a prompt shows, or a hug or scene has just ended. Its voice-in-flight counter can stick, and 8 other items depended on it. The engineer said must-drop; the guardian said 'not this round'. Its goals are met by targeted guards instead: G1, G2, G20, G21, G25 and G29.
- calm-21, a chatter scheduler: 8 edits in dense family2.js lines plus wildlife's 'look!' line, all depending on calm-1's Calm.chat/voiceBusy. Revisit after measuring G20, G21 and G29.
- calm-9, settled alerts no longer holding back requests (fun.js:92), and shrinking settled alerts to .88: more requests and a smaller button. The guardian's must-drop is binding. G23 keeps only the visual settling, at full size.
- calm-24, hiding 📁 while ✋ shows: it hides a shortcut she may use. The guardian's must-drop is binding. Only the 🖼️✋ chip fix is kept (G17).
- obvious-17, the ⬆️/⬇️ pill outside and in the tree houses: a new travel route and a second copy of the hatch's 🪜 that changes what the pill does. The guardian's must-drop is binding. G35's signs and edge tabs show the existing ways out instead.
- obvious-12, putting 🎁 first in the grown-ups' rings while she holds a picture, and face portraits in the cook give row: a new choice that shifts every learned ring slot, and a rewrite of her favourite screen. The guardian's must-drop is binding. G17's give bubbles offer the same one-tap route.
- obvious-29, the studio part (a 60x60 studio ❌ and taller landscape studio buttons): it shrinks .s-area, so new drawings change shape and the saved draft stretches (art.js:28-36). The guardian's must-drop is binding. obvious-29's ❌🚪 badge in the fort interior is also dropped: the 🚪 she knows stays, and the floating twin copies it.
- obvious-30 / calm-33, the fort's piece-delete ❌ becoming 🗑️ (and the judge's [piece]🗑️ chip variant): either way a second 🗑️ would sit beside clear-all, which has no undo (fort.js:18). The guardian's must-drop is binding. The ❌ there stays and is the one known exception to 'only closes'.
- obvious-30, the wall-picture confirm as a yellow ❓ and the studio's yellow ❓: ❓ means nothing to a non-reader, and 'tap the bin again' is the confirm she already knows.
- obvious-20 / calm-15, keeping a folded landscape mood column folded on a hello: answering a greeting would take an extra tap. The guardian's must-drop is binding. G24 keeps today's unfold.
- obvious-21, restyling the riding ⬇️🧍 alert, 📁 and the TV's ⏻ as yellow chips: the dad added ⬇️🧍 on purpose as the obvious way down, and ⏻ is a power symbol she knows. The guardian's must-drop is binding. Only 🖼️✋ (G17) and the red 🧻🚽 (G23) are kept.
- obvious-22, sprite pictures for TV shows, gym moves, Daddy's ride, the nappy and the stairs: these are main-floor choices she picks by emoji, a missing sprite renders as a broken image (ui.js:52), and the gym rule would also catch Marina's own 🤸 (doFlip). The guardian's must-drop is binding. The stairs get only a ⬆️/⬇️ badge (G30).
- obvious-16, pill badges showing the arrival room (⬆️💺, ⬇️🛋️, 🚪 instead of 🛏️/🏠): it replaces the pictures she found the new floors with. The 🛏️ clash is fixed on the new-area side instead (👵, G36).
- obvious-28, portrait #roombar right:8px, the landscape strip pinned left, and the green yard chip: the strip's dark backing would stretch over the picture, a main-floor control would move 158 px, and .rb[data-r=yard] overrides the 'here' highlight. Guardian and engineer both dropped it. Only the floor colours (G38) and the 375 px fit (G14) are kept.
- obvious-18, rebuilding the map (landscape grid, room crops, join markers) and a new face for the 🗺️ button: a large rewrite, smaller house polygons, and a habit cost on the main floor. The guardian's must-drop is binding. Its safe parts are in G37.
- obvious-31, changing the sticker glyphs, the swing's 🛝 → 🟦 and the fort-invite 🐱 → 🐈: it would change the look of her earned collection, 🟦 is an abstract square outside the swing ring, and the fort invites are choices she taps. Only the transient prompt and chip pictures change (G31).
- obvious-4 (a ring for every list in portrait) and calm-8 (the long-list tray in the band under the picture): a 9–10 item portrait ring covers half the picture and moves the TV and gym lists she knows; the band tray would give one list two homes, in Safari versus the home-screen app. G7 wraps the strip in place, and landscape uses the existing two-row ring.
- obvious-10, a touch-down ring on every press plus a sparkle trail, and obvious-9's dotted tail from ring to thing: extra motion on every tap in a house she already finds busy. G15's 'not now' puff and G18's target glow cover 'did it hear me', and G6 keeps rings beside their thing.
- obvious-3 / calm-4, moving 📒/👗 to the bottom-left in landscape: there they would collide with the wish/request beside ✋, and avoiding that would mean hiding 📒 during requests (owner sign-off needed), on a favourite button. Rings avoid them instead (G6). Also rejected: obvious-3's portrait padR change at game.js:286, because a constant cannot follow R.right, and short portrait still keeps 📒/👗 on the right.
- safe-15's portrait part: in Safari portrait the request would still cover the asker's face card, and in tall portrait the wish would sit 41 px above the mood faces. It is replaced by the dock row (G25). Its landscape 'clear of ✋' part is kept, measured from ✋'s real edge.
- safe-16, moving the title's 👗/📒 to the bottom-right: measured on top of the title art (#titleCv). calm-31's card shift is used instead (G13).
- calm-7's polling hello wrapper, changing game.js:344/345 from 30 to 180 s, and obvious-25's 'hello only when on screen': her own room entries keep the 30 s rule because family2.js:171-179 relies on them. G20 throttles only the walk-ins.
- calm-19's same-room mew limits: tuning dense code before measuring. Only the far-room mews are limited, with a silent paw hint in their place (G29).
- calm-20, moving the m_sticker and m_found voices to later: the voice stays at the moment of earning; only the picture waits (G27).
- calm-5's stopImmediatePropagation on dead mood taps, and dimming alerts during busy moments that are not scenes: the first could swallow a tap that would work, and alerts do work then (nav.js:96). G15 never stops propagation and dims alerts only during scenes.
- obvious-27's sideways slide for ◀/▶: a second cv.animate would compete with the animation features.js:396 already starts. Only the floor-change direction is added, inside that same animation (G39).
- Portrait ⬆️/⬇️ pill over the living-room TV and the bathroom mirror, and side arrows over the fridge, stove, foyer stairs and pool umbrella: no contained fix keeps the pill and arrows where they are. The camera follows Marina, so these props must pass under the corner on their way off-screen, and no camera clamp can skip that band. Moving the pill is a high-habit main-floor change. Rings now avoid the pill (G6). Left for the owner to decide.
- Moving the alert row into the band, a camera that nudges itself, side arrows in the band, and bigger map, weather and arrow buttons: high habit cost, or more of the picture covered.
- A two-row studio toolbar in portrait and a full-screen story book in portrait: the first would change the shape of new drawings (art.js:28-31), and the second changes a layout she knows. G15 dims the dead faces during the story.
- New title start cards for the new areas, reordering the title cards, and one global rule for ordering choices: new start outcomes, and habit cost on the first screen of every session and on main-floor menus.
- Pre-existing defect noted, not fixed this round: opening the studio in the other orientation stretches studioDraft, because the drawing's width and height follow the first layout. Any future studio layout work must keep its aspect ratio.
- Left for the owner to decide, not in this plan: hiding 📒/👗 while a request shows, hiding 📁 while ✋ shows, and hiding the top ⬇️🧍 or the top ❌ in landscape. Each one hides a shortcut she may use.