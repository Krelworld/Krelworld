# RESEARCH: how games like KRELWORLD work on phones, and what we change because of it

Date: 2026-11-23. Synthesis of six research angles (top-down shooters, side-scrollers, PC-to-phone ports, browser games, touch UX guidelines, dialogue and minigames). Every angle was checked by a second pass that opened the cited pages.

**How to read the evidence tags**

| Tag | Meaning |
|---|---|
| **[C]** | Confirmed: a checker opened the source and it says this |
| **[P]** | Partly confirmed: true with the caveat written next to it |
| **[U]** | Unverified: nobody in the chain opened a source (usually because TouchArcade returned 403, or it is from memory). Do not build on it alone |
| *mine* | A number or layout I derived. Not from a source. Starting value for device testing |

Claims a checker found wrong are dropped; section 1.8 lists them so they are not reused. Source keys in brackets, for example [DC], are listed in section 6.

**If you have ten minutes:** read section 0, the MUST list in section 3, the Jumping table and the layout table. Section 1 is the evidence behind them; section 4 is the numbers on one page.

**Access limits.** No browser automation and no repository changes. TouchArcade, Fandom (partly), Medium, ACM and several review sites refused automated reads. Reddit and YouTube were not consulted, so "what players complain about" comes from professional reviews, store reviews and developer write-ups. The checkers had no web search left, so they verified by opening pages, not by finding new ones.

**State of the phone build today (read locally, nothing edited).** Phaser **3.90.0** is installed. `src/game/mobile/` does not exist yet and there is no phone-build README or stage report; only the laptop safety net exists (`tests/fingerprints/`, `tests/desktopInvariants.test.ts`, `scripts/desktop-fingerprint.cjs`) plus `reports/00-USER-PRIORITIES.md`. Code facts the recommendations below rely on:

| Fact | Where |
|---|---|
| Side rooms use Arcade physics: gravity 1500, first jump -660 px/s (apex about 145 px, 0.44 s up), air jump -580 | `DungeonScene.ts:411`, `Player.ts:237` |
| Coyote time already exists: **110 ms**, in scene milliseconds. There is **no jump buffer** and **no variable height** (a jump is one edge, full height every time) | `Player.ts:232-239` |
| Air control: velocity eases with a 140 ms constant in the air, 70 ms on the ground | `Player.ts:234` |
| Any stick-down past 0.6 opens a 220 ms drop-through window; one-way platforms accept a landing up to 14 px low | `Player.ts:245`, `DungeonScene.ts:453` |
| Touch jump is "stick up past 0.6" | `Controls.ts:194` |
| Pits already cost 15 HP and put you back at the last safe X | `SideLevel.ts:317-323` |
| Side camera: `startFollow(…, 0.12, 0.12)` with an 80x60 dead zone | `DungeonScene.ts:461` |
| Game config has no `input.activePointers` (Phaser default is 1); the old pad calls `addPointer(3)` | `main.ts:69`, `TouchControls.ts:29` |
| Phaser's touch manager forwards touches on non-canvas elements into the game from a window listener unless the event was default-prevented | `phaser/src/input/touch/TouchManager.js:276-300` |
| Sound effects run on the game's own `AudioContext`, not Phaser's sound manager, so Phaser 3.88's built-in iOS audio fix does not cover them | `audio/Synth.ts:291` |
| Music and non-1.0x voices create a new `Audio()` per track or line | `Synth.ts:1296`, `Voice.ts:352` |
| A lost WebGL context reloads the page after 1.2 s | `crashGuard.ts:83-93` |

---

## 0. The short version

1. **The plan's core is what the genre does.** Floating stick, one right-thumb fire control with auto-aim and slide-to-aim, a contextual action button, HUD at the top, HTML controls sized in real pixels and sitting in the black bars. Apple's own guidance and Brawl Stars, Soul Knight, Diablo Immortal, Dead Cells, Roblox and two shipped browser games all do this.
2. **The plan's weak point is the right thumb.** Our guns fire while held, so a thumb on FIRE cannot press DODGE, JUMP, the special or weapon swap. The reference games either fire on release or fire automatically. We must ship auto-fire as a first-class default and say what firing does while the thumb is elsewhere.
3. **Jumping needs more than a button.** Biggest button in the corner, pressed on touch-down, a 150 ms buffer, slightly longer coyote time, tap-for-hop, sideways-only stick, a deliberate drop-through and a steady frame rate in the side rooms.
4. **The SMART button as specified has no precedent** (a self-reordering queue of seven abilities, with a seven-way hold-radial). Give abilities fixed slots, let the big meter-gated one pop in when ready, cap any slide-radial at four.
5. **Text for reading should be about 16 CSS px, not 11.** Three independent standards and the phone preset of the main visual-novel engine agree. 11 is a floor for labels.
6. **Text-heavy phone games ship Auto, Skip and Log.** Long lists should be native HTML scrollers.
7. **Rhythm needs an offset, not wider windows.** Crocodile's window is already wider than every rhythm game checked.
8. **Phone browsers have hard rules we must design to:** audio unlocks only on touch-end or click, iPhone has no fullscreen and no vibration, edge swipes belong to the system, cancelled touches must release everything, a tab dies without warning at roughly 1.5 to 2 GB, and a home-screen app on iPhone does not share saves with Safari.

---

## 1. What comparable games do

### 1.1 Movement and aiming

**The stick floats by default; fixed is an option.**
- Apple: "opt to show a virtual thumbstick wherever the player lands their thumb instead of a static thumbstick position"; make the touch area the whole left half and hide the stick when untouched [A-GC][A-W26] **[C]**.
- Dead Cells ships floating by default with a fixed option. The producer says about 80% prefer floating and 20% fixed; that is her round figure from playtests, not a measurement [DC] **[P]**.
- Soul Knight has three modes: Dynamic (appears within about the left 25% of the screen), Fixed, Following (base drags with the thumb), plus an 8-direction option [SK] **[C]**. Brawl Stars has a "Locked Movement Control" toggle [BS-G8] **[C]**. Minecraft has Lock Joystick [MC-CTL] **[C]**.
- Roblox's default for every Roblox game: floating stick inside the left 40% of the width and lower two thirds of the height; dead zone 2 px, full speed at 50 px of travel [RB-DYN] **[C]**. Luanti and Microsoft's Xbox touch kit also default to "relative to where the touch began" [LU-SET][TAK-JOY] **[C]**. Suroi (browser shooter): floating by default, 150 px sticks, a "lock" option [SU][SU-VAR] **[C]**.
- Stick numbers cluster: base 100 to 120 px, knob half the base, dead zone 5 to 16% of the radius (Microsoft sample 0.05 radial, PPSSPP 0.15, Phaser rex plugin 16 px on 100), output re-mapped after the dead zone, optional "follow" mode [NJ][GD][TAK-DZ][PS][REX][RB-THUMB] **[C]**. Dead zones should be radial, not per axis [RH] **[C]** (article is about physical pads).

**How floating sticks fail.**
- Hades: "Far too often when I slapped my thumb down ... nothing happened" [HD-PG] **[C]**.
- Diablo Immortal: the quest log grows down into the stick area, "find myself not moving because the quest log had blocked the screen area" [DI-TR] **[C]**.
- Minecraft had to fix "joystick gestures were stopped if your finger overlapped with the hotbar" [MC-50] **[C]**.
- Thumbs drift with no physical edge. One lab study found both a D-pad and a floating joystick "encourage drifting and unintended operations"; note it tested phones used as controllers for a distant screen [BALD] **[P]**.

**Aim and fire live on one right-thumb control.**
- Brawl Stars: tap = quick-fire at the nearest target (or nearest breakable object if no enemy is in range), drag = aim, release = fire, drag back to the centre = cancel. The Super button works the same way [BS-WIKI] **[C]**.
- Diablo Immortal: one large attack button (hold to keep attacking), tap a skill = cast at the auto-target, hold = an arrow or cone projects, drag, release [DI-TR][DI-FX] **[C]**.
- Apple: "combine the aim and release into a single action button ... hold button B and drag to aim, while still moving with the left thumbstick" [A-W26] **[C]**. Microsoft's kit has the same idea as a "pull action" when the finger slides past the button's edge [TAK-BTN] **[C]**.
- Terraria's "Aim & Use" stick is the closest to our FIRE: "hold on to the stick, aim and fire at the same time", with an "Aim Only" alternative and an aim-sensitivity slider [TR-INTRO][TR-CUST] **[C]**.
- Suroi's aim stick only fires once the thumb is 50 px from the centre of a 150 px stick, which is two thirds of its travel [SU][SU-VAR] **[C]**.
- **Caveat that matters for us [C]:** in Brawl Stars and Diablo Immortal the drag fires *on release*. Our guns fire continuously while held, so our FIRE is in effect a held right stick with an auto-aim rest position, and the thumb is pinned. A rule from a twin-stick post-mortem applies: no more than three or four commands, ideally two, that must be used while aiming [RH].

**Auto-aim is close to universal; good versions show the target and can be tuned.**
- Soul Knight always aims at the closest enemy and draws a red circle at its feet [SK-GM] **[C]**.
- Diablo Immortal targets "the nearest enemy or whichever foe you're moving toward" (a journalist's description of the 2021 alpha) [DI-TR] **[C]**.
- Relic Hunters post-mortem: hidden aim nudging made players say the aim "moved by itself". What worked was a narrow snap (about 30 degrees), instant, with a visible colour change, corrected for distance. It ships three settings: off, assist, full [RH] **[C]**.
- Enter the Gungeon (phones, 2025) has an auto-aim toggle; a user wants a slider because it "won't always target what we need" [GG-ED][GG-US] **[C]**.

**Automatic firing: common, usually a mode or a default with a manual alternative.**
- Mindustry: auto-target is created only on mobile and defaults to on; a long press switches to manual shooting [MD-SET][MD-IN] **[C]**.
- Bastion (iOS): the default "will attack automatically when foes or obstacles get in range"; stick-and-buttons "Classic Controls" is the opt-in [BA] **[C]**. Stardew Valley's default scheme is "Tap-to-move & Auto-Attack" [SV] **[C]**.
- Dead Cells: "Auto-Hit" is a separate optional mode for the primary melee weapon only. It "became by far the team's favorite control option", though one reviewer says it is not the mode he uses most [DC][DC-MS] **[C]**.
- Isaac (iOS): right stick fires in the four cardinal directions; continuous fire is the default; a reviewer "found auto-fire as the best way to play, since it allowed me to focus more on movement" [IS-PG] **[P]** (the quote is confirmed; the rest of the scheme description was not re-checked).
- Hades, Hyper Light Drifter, Huntdown ship manual attack buttons [HD-SN][HLD][HU] **[C]**.
- Net: "auto-aim is standard" is well supported. "Auto-fire on by default" has verified precedents (Mindustry, Bastion, Stardew) but is a design decision, and no source covers a shooter with an ammo economy. The often-quoted 10tons line that auto-fire suits unlimited ammo is **[U]**.

**Tap-to-move works for walking and talking, not for fighting.** Stardew added joysticks three weeks after launch [SV-MR] **[C]**; reviewers preferred the stick modes of Bastion and Transistor for action [BA-PG][TRN] **[C]**. Supercell's Brawl Stars beta shipped two schemes with no metric winner and the stick became the default [BS-DTF] **[P]**.

**Thumbs cover the action, so controls go beside the picture.** Vampire Survivors: "you'll frequently find yourself unintentionally covering part of the action" [VS-CSM] **[C]**. Metal Slug's ports added a "Window mode" to put buttons outside the game screen area [MS2] **[C]**. Dead Cells moved its HUD from the bottom to the top corners because "players have their hands and fingers there" [DC] **[C]**. The much-quoted Hades complaint that buttons cannot leave the 16:9 picture is **[U]**.

**A controller is still better, and ports hand over cleanly.** Hades: connecting a pad is "revolutionary ... ridding the screen of the UI" [HD-PG] **[C]**. Streets of Rage 4 shows buttons on touch and hides them on pad input [SOR-PG] **[C]**. Enter the Gungeon shipped a bug where touch buttons broke after customising pad bindings [GG-US] **[C]**. The Gamepad API works in iPhone Safari and Chrome for Android; a pad connected before page load only reports after its first button press [MDN-GP] **[C]**.

### 1.2 Abilities and buttons

**One big button plus a few small ones; charge-gated abilities appear or light up when ready.**
- Diablo Immortal: big primary with four skills fanned round it; "Your Ultimate Skill appears to the left when it is fully charged"; potion separate [DI-TR][DI-FX] **[C]**.
- Brawl Stars: Attack, Super (lights up when charged), Gadget (only exists if owned), Hypercharge: four at most [BS-G8] **[C]**.
- Soul Knight: three permanent (Attack, Weapon, Skill). Contextual buttons take over a slot: Attack becomes Action near an object, Dismount replaces Skill, Special overwrites Extra [SK] **[C]**.
- Microsoft's kit: a "wheel" under each thumb with at most four inner controls; outer slots "that require the player to move their hand to reach should be used for infrequently accessed commands"; "Minimize total controls" [TAK-WHEEL][TAK-RULES] **[C]**.
- DevilutionX (Diablo 1 on phones): a diamond of four 0.3 inch buttons with 0.1 inch gaps, sized in physical inches; the primary icon switches between attack and talk; potions sit directly above the left pad [DX] **[C]**.
- **What nobody does [C]:** an automatic priority queue over five or more abilities on one button (our SMART). Slots that change with context are fine when the icon changes and the trigger is obvious (Apple: "when a control's behavior changes based on context, you should update its icon to match") [A-W26]. Terraria's developers warn that their own context button gets overridden by the held item and does the wrong thing [TR-INTRO] **[C]** (the link to SMART is our inference).

**Too many permanent buttons is the documented failure.** Hades packs six or more in one corner: "my thumb sliding off the attack button to something like the dash", "noticeable dead space between the buttons ... can leave you standing there doing nothing", "constantly using the cast action when I was trying to dash" [HD-SN][HD-PG] **[C]**. Apple describes the same starting point as "a direct one-to-one mapping from a physical controller" that clutters the screen [A-W26] **[C]**. Huntdown: "the dash and throw buttons are quite small compared to the other commands, which led to a couple of incorrect inputs" [HU] **[C]**.

**Interaction is one contextual button.** Apple: the pick-up button "only appears when there's an item nearby", is placed next to the item, and you can also let players tap the object itself [A-W26][A-GC] **[C]**. Diablo Immortal's hand icon: "you never have to go out of your way to hit context-specific prompts" [DI-DOG] **[C]**. Dead Cells: one Interact button; getting the icon and feedback right "was not an easy task" [DC] **[C]**. Hyper Light Drifter's reviewer asked for exactly this [HLD] **[C]**.

**Dodge and jump are plain buttons.** Dead Cells tried one button you slide across for jump or dodge: "a nightmare to play ... players would mis-click every time". Swipe-to-dodge split the team and ships only as an option [DC] **[C]**. Double-tap-the-stick teleport misfiring in Tesla vs Lovecraft is **[U]**.

**Weapon switching is one tap inside the thumb cluster, usually between two weapons.** Soul Knight (Weapon button in the cluster, shows energy cost), Bastion ("freely switch between the two at the touch of a button"), Death Road to Canada (a cycle button bottom-right) [SK][BA][DRC] **[C]**. None of these has eight hot-swappable guns, and how Enter the Gungeon handles its arsenal on touch is undocumented, so our quick-swap is an inference from a small sample **[P]**.

**Radials are small and close themselves.** Apple shows a power wheel as touch buttons that "auto-dismiss ... after three seconds if no selection is made" [A-W26] **[C]**. Microsoft's slide-off-the-button picker allows "up to 4 segments" [TAK-BTN] **[C]**. Slowing time while the player chooses (Neon Chrome, Exit the Gungeon) is **[U]**, though our weapon picker already does it.

**Healing.** Dead Cells keeps the potion on the health bar at the top left; a menu hidden on that bar was not found by playtesters and needed its own icon [DC] **[C]**. Hyper Light Drifter's top-left heal is "a slightly uncomfortable stretch", mostly on iPad [HLD] **[P]**. DevilutionX puts potions above the left pad [DX] **[C]**. Terraria's Quick Heal shows which potion it will use and greys out when it cannot be used [TR-INTRO] **[C]**.

**Sizes, spacing and press feedback: see the table in section 4.** Headlines: Apple 44 pt for frequent controls and 28 pt for menus [A-GC]; Google 48 dp with 8 dp gaps [G-TT]; Xbox accessibility guidance suggests 15 mm default targets on phones (about 90 CSS px on an iPhone 14) [X-107]; shipped corner buttons are 60 to 78 px with hit areas much larger than the art (SuperTux: the hit square is four times the icon's side) [RB-JUMP][PR-CSS][ST] **[C]**. Apple: the press state must be visible "even when their finger is covering the control", with sound [A-GC] **[C]**.

### 1.3 Jumping and platforming

**Jump is its own button in the bottom-right corner.**
- Dead Cells: "One button to jump and one button to dodge" after the combined control failed [DC] **[C]**.
- Roblox default: one 70 px Jump button with its centre about 60 px from the right edge and 55 px from the bottom; custom buttons are placed relative to it [RB-JUMP][RB-POS] **[C]**.
- SuperTux (open-source platformer with run/fire): jump in the bottom-right corner, the action button directly to its left, the two hit squares touching with no gap, each 0.4 x screen height on Android, pressed by where each finger currently is, so one thumb rolls between them [ST] **[C]**.
- Terraria on phones has both a Jump button and stick-jump [TR-INTRO] **[P]**. The detail that "any upward stick movement jumps" was demoted to a legacy option is **[U]**.

**One thumb, one job.** Apple: "Consider redesigning game mechanics that require players to press multiple buttons at the same time" [A-GC] **[C]**. Dead Cells added Auto-Hit [DC-STEAM] **[C]**. Metal Slug's "Autofire" still needs the thumb held on fire [MS2] **[C]**. One developer measured same-frame two-button chords at only 50 to 75% reliable at 30 fps on one phone and added a 50 ms buffer; that is about chords, not hold-one-tap-another [MCAT] **[P]**.

**Timing forgiveness.**
- Celeste source: coyote time 0.1 s; full-height window (`VarJumpTime`) 0.2 s, where releasing early just lets gravity take over; gravity halved near the apex while jump is held; fall speed capped at 160 against a run speed of 90; air acceleration 0.65 of ground; corner correction 4 px on an 8 px wide body; a platform's speed carried into the jump; a push up through one-way platforms [CE] **[C]**. Its jump-buffer length is **[U]** (commonly quoted as 4 to 5 frames).
- Typical ranges: coyote "around 0.1 to 0.2 seconds" [GDQ]; GDevelop's default is 0.25 s [GDV] **[C]**.
- Dead Cells: "just in time" jumps and "about 30-40 such small techniques" that adjust where you arrive, because platforming is not the challenge of an action game [DC-80LV] **[C]**.

**Variable height survives as tap versus hold.** Super Mario Run: "tap the screen quickly for a short jump, hold it longer for a mighty leap" [SMR] **[C]**. Dead Cells added "Hold to second jump" and "Hold to roll" [DC-STEAM] **[C]**.

**Sideways movement only.** Mega Man Mobile: "the virtual d-pad removes your ability to correct yourself on tricky jumps" [MM-AC] **[C]**. A Dead Cells player: "wanting to slam downwards ... only to slide slightly left or right instead" [DC-STORE] **[C]**. Discrete direction buttons "work precisely for direction-restricted navigational tasks" [BALD] **[P]**. Two-way pads in Mikey Shorts, Downwell and Grimvalor are **[U]**.

**Frame rate comes before feel.** Mega Man Mobile's first complaint was "inconsistent frame rates and stuttering, which isn't great for a game that's all about precision and timing" [MM-KO] **[C]**; Capcom's fix was a speed option, and the slowest setting is "essentially unplayable" [MM-AC] **[C]**. Vampire Survivors (built in Phaser, rebuilt for phones): "the more enemy sprites appear on the screen, the more lag occurs" and "the touch controls are not the most responsive" [VS-PG] **[C]**. Our plane and colon rooms measured 30 and 23 to 24 fps in the audit.

**Where touch platforming hurts most.** Death's Door: "all too easy to ... dash right off a bridge when dodging" [DD-PG]; Katana Zero: controls "simply not set up to support" precise movement [KZ-PG]; Enter the Gungeon: "Dodge rolling to platforms can be extremely difficult ... the joystick is very sensitive" [GG-US] **[C]**.

**Gestures lose to buttons in action games.** Dead Cells prototyped gestures and kept buttons [DC] **[C]**. Swipe-jump misfires in Oddmar, Leo's Fortune and Limbo are **[U]**.

**Camera.** The standard survey names "dual-forward-focus" (the view leads in the facing direction and flips when the player turns) and "platform-snapping" (the camera only re-centres vertically on landing) [KER] **[C]**. No phone-specific lead distances were found.

### 1.4 Menus, text and dialogue

**Reading text on a phone is about 4.2% of screen height: 16 to 17 CSS px on a 390 px tall screen.** [C]
- Ren'Py's phone preset (the engine behind most visual novels on phones): dialogue 22 to 30 on a 720-high base, name 30 to 36, text box 185 to 240 (a third of the screen), choices 790 to 1240 wide of 1280, and the side portrait is removed because "there's no room" [RP-GUI][RP-SCR].
- Game Accessibility Guidelines: subtitles "no smaller than 46px@1080p" (16.6 px at 390) [GAG-SUB]. BBC: a subtitle line is 7 to 8% of picture height, scaled for phone size; an iPhone 14 falls at an 18 to 31 px line, so 16 to 17 px text is the low end [BBC]. Apple: 17 pt default, 11 pt minimum, and "use scroll views" instead of shrinking text [A-DFG][A-HH]. Valve's handheld floor: 9 px glyph height at 1280x800, 12 recommended [VALVE]. Xbox's 18 px at 100 DPI works out to about 27 CSS px here and is best treated as the "Large" setting [X-101].
- Scaling a desktop interface down draws complaints that a late "bigger text" switch does not fix: Slay the Spire ("While there is a bigger text option, it's not big enough") [STS-R], Baldur's Gate II ("not recommended for phones with screen sizes under 7 inches") [BG2], Disco Elysium on Switch ("even at the maximum setting, this may still be a tad small") [DE-NL] **[C]**. Papers, Please rebuilt its screen for "no squinting, zooming, or precision" and took eight months [PP] **[C]**.

**Dialogue controls on touch: tap anywhere, plus about four big buttons.** Ren'Py replaces its eight-button quick menu with "fewer and bigger buttons": Back, Skip, Auto, Menu [RP-SCR] **[C]**. Its defaults are worth copying [RP-PREF][RP-CFG] **[C]**:
- Skip stops at the next choice; a full skip asks for confirmation; a "Skipping" indicator shows.
- Auto waits for the voice file and then 0.5 s; unvoiced lines get 60 ms per character plus 1.5 s; a tap ends auto mode.
- Text appears instantly by default.
- Long-press is 0.5 s within 15 px.
- State is saved when the app goes to the background.

**A missing log gets named in reviews.** Ace Attorney Trilogy: "Several critics called for the addition of a text log, which was absent" [AA][AA-NWR] **[C]**. Its later "Story Mode" that plays itself is documented for console and PC only [AA-PS] **[P]**.

**Voiced text-heavy games lean on the voice.** Disco Elysium's Android release (August 2025) was rebuilt as a visual novel "optimized for short play sessions" with full voice-over [DE-IGN] **[P]** (one release; no reception data).

**Reading speed.** BBC: 160 to 180 words a minute, about 0.3 s per word [BBC]. Netflix: up to 20 characters a second, 42 characters a line, two lines [NFX] **[C]**. Speech at our default 1.5x is about 225 to 255 words a minute: above the BBC figure, at or just over Netflix's.

**Subtitles.** Two lines of 37 to 42 characters, mixed case, on a solid or half-opaque box, bottom centre with a gap, speaker named when it changes; leave about a quarter of a second between subtitles [GAG-SUB][X-104][BBC][HAM] **[C]**.

**Choices and rows.** Ren'Py makes phone choices nearly full width at reading size [RP-GUI]; Android asks for 48 dp with 8 dp gaps [G-TT]; game accessibility guidance gives 9.6 mm for phones and "if they are [close], they need to be larger again" [GAG-SIZE] **[C]**.

**Menus are operated by direct touch with the game controls hidden.** Apple: "when I show my menu, I hide all my controller UI completely" [A-W24] **[C]**. Minecraft raised the delay before an inventory drag starts from 120 to 180 ms so scrolling stops grabbing items, removed the delay on attack and interact, and uses 800 ms only where an accident is costly [MC-40P][MC-50] **[C]**. Stardew's hold-to-count stack splitter "can make it difficult to move a specific number of items" [SV] **[C]**. Balatro's reviewer "accidentally fat-fingered" a badly placed Skip button [BAL] **[C]**.

**Long lists scroll the way the phone does.** Apple: "Support default scrolling gestures"; a part-visible row signals more [A-SCR] **[C]**. In a browser a native scroller inside a `touch-action:none` page still works, and the browser separates scroll from tap by itself [MDN-TA][MDN-PC] **[C]**. A drag-only action needs a tap alternative [WCAG-DRAG] **[C]**.

**Prompts never name keys.** Apple: "Avoid using abstract shapes or controller-based naming like A, X, or R1" [A-GC] **[C]**. Minecraft had to patch tips that still described the old controls [MC-60]; Terraria has a lightbulb that explains any control you tap [TR-INTRO] **[C]**.

**Per-activity layouts are normal, and they get stuck.** GTA's phone ports have separate on-foot, driving, swimming and shop layouts and "contextual options to display buttons only when you need them" [GTA-SA][GTA-3] **[C]**; a player was left with "only ... the left and right arrows and the purchase button" until reinstalling [GTA-VC] **[C]**. Microsoft's kit is built round switching layouts with game state and hiding them in cutscenes [TAK-STATE] **[C]**.

**Timers should stop in menus.** 80 Days: "The interface can get in the way when needing to act quickly" because the clock runs while you are in the map [80D] **[C]**.

### 1.5 Minigames, rhythm and timing

**Teach with one verb and an icon, on a playable screen.** WarioWare: "a quick one or two word instruction (such as 'Eat!' or 'Rub!')", about 4 s a game, and in mixed stages the control type is announced by symbol and voice [WW] **[C]**. Mario Party: practice happens on the rules screen and every player confirms ready [MP] **[C]**. Rhythm Heaven offers a skip after three failed attempts in a row [RHV] **[C]**. Apple: "Teach through play" [A-ONB] **[C]**.

**Rhythm games fix latency with a stored offset.** [C]
- Friday Night Funkin' (official phone version, July 2025): one offset value, a calibration screen, a test pattern, and the offset adjustable from the pause menu mid-song (the browser build has only the pause-menu control) [FNF-CL].
- StepMania: collect 24 hits and apply their mean error only if the spread is under 30 ms [SM-AS]. osu!: platform, global and per-song offsets, with a suggested value from recent hit error [OSU-OFF]. Phira: one offset setting [PHI-CFG].
- A rhythm developer's practical notes: a tap test measures audio and input delay together; about ten taps with the fastest and slowest dropped; the calibration tap must not make a sound; Bluetooth adds more [RQ].

**Timing windows (ms either side of the beat).** Funkin' 45 / 90 / 135 / 160; Phigros-style 80 / 160 / 220; Project Sekai-style 42 / 83 / 125; StepMania 22.5 / 45 / 90 / 135 / 180 [FNF-SC][PHI][SEK][SM-P] **[C]**. Our Crocodile window is -150 / +210 ms times difficulty, **already wider than all of them**, so width is not the phone problem; the constant delay is.

**Four-lane layout.** Funkin's phone version: each touch zone is 1.35x the arrow's width and 8x its height, or four full-height columns, or "double thumb" layouts with two lanes per thumb; notes scroll down toward the thumbs by default on phones [FNF-HB][FNF-PREF] **[C]**. The official default also has a shared zone between neighbouring arrows for two-note chords, and its developer says players need "a very good obvious indicator" for it [FNF-BLOG] **[P]**.

**Latency sizes.** Touch panels add "around 15-30 msec"; Android itself adds 30 to 100 ms over Bluetooth before headset buffering [OBOE-U][OBOE-BT] **[C]**. iPhone audio output is "a few milliseconds"; Android ranged from 12.5 to 150 ms, on phones from about 2011 [MOZ] **[P]**. A page can read `AudioContext.outputLatency` in Chrome for Android and in Safari from 18.4 only [MDN-AC] **[C]**, and it describes Web Audio output, not an `<audio>` element.

**Quick-time prompts become one button.** Apple collapses a two-button event into "a single quick time event button" and hides it when the event is not running [A-W26] **[C]**. Guidance: offer a hold alternative and a skip for mashing [GAG-MASH][GAG-SKIP] **[C]**. Sea of Stars: timed taps lose precision without tactile feedback [SOS] **[C]**. No source gives a numeric touch QTE window.

**Driving on phones auto-accelerates.** Real Racing 3's default is tilt with auto-accelerate and manual brake, and its "Buttons" scheme steers by touching the left or right side; Asphalt 8 and 9 and Mario Kart Tour do the same [RR3][A8][A9][MKT] **[C]**. That is what Beep Beep already does.

**Timing constants worth copying.** Android: a touch that moves under 8 dp is a tap, long-press 400 ms, double-tap window 300 ms [AND-VC]. iOS: long-press 0.5 s, 10 pt allowance [A-LP]. Stardew splits tap from hold at 0.25 s [SV]. Minecraft fixed a double-tap bug specific to high-refresh screens [MC-50] **[C]**.

### 1.6 Technical limits of phone browsers

**Shipped browser precedents.** PokeRogue (Phaser 3.90, played mostly on phones): fixed-position HTML controls outside the canvas, main buttons 20% of viewport height in landscape (68 to 78 px), opacity 0.8 idle and 0.6 pressed, `touch-action:none` on html, body and controls, a capture-phase non-passive listener that cancels a second tap within 500 ms, shown per screen. Its bug to avoid: a cancelled touch never releases the held key [PR-CSS][PR-TC] **[C]**. Suroi: two HTML stick containers; canvas pointer events ignored on mobile; high-resolution textures and antialiasing **off by default on mobile** [SU][SU-VAR] **[C]**.

**Memory.** [C unless marked]
- An iPhone tab is killed at a per-process limit: "for most devices, the limit is 1.5GB" (WebKit engineer); recent kill logs sit near 2.0 GB [WK-268816][WK-291677][LLB][EJS]. There is no warning event and no API to read free memory [WK-227636].
- After a kill Safari reloads the tab; a load-everything game dies again and Safari ends on "A problem repeatedly occurred". No context-lost event is seen before the kill [WK-300782][WK-241478]. A resize storm can cause the same error page [PH-FORUM].
- Published working budget: YouTube Playables caps peak JS heap at 512 MB because more "causes crashes on iPhones" [YT]. That is heap, not textures. One developer runs 500 to 800 MB of page memory fine on an iPhone 13 mini [WK-290623].
- Texture memory is width x height x 4 whatever the file size (standard). Ours: 917 MB of textures plus about 120 MB of decoded sound at boot, roughly 55 to 70% of the kill line **[P]**: a risk to measure, not a proven crash.
- Decoded sound is 21.2 MB per stereo minute. Decoding many files in parallel reproduced an iPhone kill; a 100 ms gap between decodes worked; the memory is released about a minute late [WK-227636][WK-189337]. A real project died on about 1 GB of decoded audio [PC-FORUM].
- Phaser: load per area outside `preload`, remove with `textures.remove` after destroying users, never reuse keys [PH-FAQ]. 3.80 and later restore a lost WebGL context without a reload; only render and dynamic textures come back blank [PH-380]. Context loss on phones is occasional, not "every lock" [APF-737042] **[P]**.

**Audio on iPhone.** [C]
- An audio element or context only unlocks inside a **touch-end, click or key-down**. Touch-start and (for touch) pointer-down do not count [WK-UA][WK-VID]. Phaser's `pointerdown` on a phone is raised from touch-start.
- Every audio element must be unlocked once; the proven pattern is a small pool unlocked on the first tap and reused by changing `src` (howler.js keeps 10) [HOWL].
- An element's `volume` cannot be set on iOS ("the value is always 1") [MDN-ME]. Routing it through Web Audio for gain is the textbook fix but broke on iOS 13 and 17.0 [WK-203435][WK-260412].
- The silent switch mutes Web Audio but not audio elements; `navigator.audioSession.type = "playback"` fixes it where present (Safari only) and then stops the player's own music [PH-5696][WK-237322][MDN-AS].
- After a lock or app switch the Web Audio context can read "running" and stay silent; fix by suspend then resume 100 to 250 ms after becoming visible, check that `currentTime` advances, and retry on the next tap [PH-6829][WK-263627][WK-276016][CG].
- Two audio elements are not guaranteed to stay in sync: "If you want sample accurate playback, you really need a BufferSource" (Apple media engineer) [WK-301824].
- iOS 26.0 and 26.1: an audio element could fail to play when a home-screen app was re-opened (fixed in 26.2) [S262].

**Fullscreen, orientation, home screen.** [C]
- No element fullscreen on iPhone, still true in the Safari 27 notes; on iPad it exists but "swiping down exits fullscreen mode, making it unsuitable for ... games" [WK-206854][MDN-EL].
- Orientation lock only works in fullscreen, so Android only; the manifest's `orientation` is not honoured by Safari, so the rotate screen must also run inside the home-screen app [WK-257695][MDN-MAN].
- An Android review of Enter the Gungeon: the screen is locked to one landscape direction and a clip-on controller needs the other [GG-PLAY].
- iPhone home-screen apps keep their data "isolated from Safari"; Safari-tab storage is deleted after 7 days of browser use without a visit; home-screen apps are exempt [WK-ITP][WK-181849]. From iOS 26 every site added to the Home Screen opens as an app by default [WK-S26].
- Wake lock: Chrome for Android; Safari 16.4 and later; inside an iPhone home-screen app only from 18.4 [MDN-WL][S184].
- Vibration: Chrome for Android only (needs a user gesture). No iPhone browser has it [MDN-NAV]. The one iPhone trick is Safari 17.4's native switch control, which ticks on a completed tap [S174][IOSH].

**Touch plumbing.** [C]
- iOS ignores `user-scalable=no`; zoom is stopped by `touch-action:none` plus a non-passive touch-start that calls `preventDefault`; the long-press magnifier needs the same [WK-IOS10][WK-231161].
- The browser cancels touches on app switch, rotation, palm rejection and "too many simultaneous pointers ... even if the user is still touching the screen" [MDN-PC].
- A touch is captured by the element it landed on, so a thumb can never "arrive" on a neighbouring HTML button; sliding between controls needs coordinate tests in the move handler [PE].
- Edge swipes: on iPhone Safari a swipe from a side edge is back or forward; a page can block it by `preventDefault` on touches starting within about 20 px of the edge (iOS 13.4+) [PQ-NAV]. On Android gesture navigation the back swipe starts at either edge and a web page cannot exclude regions; fullscreen (immersive) is what protects it [AND-GN][AND-IM].
- Before Safari 27, `preventDefault` on pointer-down did not suppress the follow-up mouse events on iOS [S27].
- Phaser forwards touches on non-canvas elements into the game unless the event was default-prevented (verified in the installed 3.90) and tracks one touch pointer unless more are added [PH-CFG].
- iOS three-finger gestures (undo, copy) and shake-to-undo are system gestures [A-GES].

**Frame rate.** [C] iPhone Low Power Mode halves the frame callback to 30; ProMotion iPhones give 60 by default and 120 with a setting off [WK-215745][WK-294338]. Arcade physics runs a fixed 60 Hz step by default, so bodies are frame-rate independent, but anything counted in frames is not [PH-WORLD]. `fps: { limit: 30 }` gives a deliberate cap [PH-360T]. On phones Phaser binds one texture at a time, but binds are cheap (an iPhone SE holds 15,104 at 60 fps), so texture switching is unlikely to explain our 20 to 31 fps scenes **[P]** [PH-360M].

**Download.** Portal budgets: playable after 15 to 30 MB, about 250 MB in total, each file under 30 MB; time to first interaction under 5 s (YouTube) or 20 s (CrazyGames) [YT][CG] **[C]**. We download 106 MB in 2,408 files before the first scene. A service worker must answer Range requests for audio elements and cache media explicitly [WB] **[C]**.

**Sharpness.** Our 960x540 buffer is shown at 693x390 CSS px on a 3x screen; keeping the buffer at game resolution is right for speed, and Phaser's `Text.setResolution` gives "much clearer text on High DPI devices, at the cost of memory" [PH-TEXT] **[C]**.

### 1.7 Options and accessibility

- **Move-and-resize editing** is confirmed in Dead Cells (position and size only, decided "very early" because nobody in the office agreed on a layout), Terraria (added seven months after a 256-signature petition), Stardew, Brawl Stars (size, position, swap sides, with a test step), Enter the Gungeon (placement), Diablo Immortal (skill-button position), the GTA ports and both browser games [DC][TR-CUST][TR-PET][SV-MR][BS-G8][GG-ED][DI-BLZ][GTA-VC][PR-TC][SU] **[C]**. Minecraft's version shipped a year after its redesign as an experimental option that is off by default [MC-2040] **[C]**. Hades is contradictory: pre-release press says resize and reposition, a review eight days after launch says "three layouts ... which annoyingly can't be customised" [HD-ENG][HD-PG]. Lesson: an editor nobody can find does not count **[P]**.
- **Left-handed play:** Brawl Stars and Suroi swap sides [BS-G8][SU] **[C]**.
- **Assists as a named mode, not a silent nerf.** Dead Cells "Original & Auto-Hit" [DC-STORE]; Bastion "some weapons have been retuned" and an "Infinite Lives toggle ... for less experienced players who might be enjoying the story" [BA]; Mega Man Mobile's slowed game speed was its most-cited failure [MM-AC] **[C]**.
- **Keep the old scheme.** Removing Brawl Stars' tap-to-shoot angered players [BS-DOF]; Minecraft introduced its new scheme as an opt-in first and kept Classic [MC-31] **[C]**.
- **Detect and let the player override.** Papers, Please guesses the device on Android and adds "a setting to explicitly choose which mode you want" [PP] **[C]**. Do not use touch detection alone, "because many laptops have touchscreens" [CG] **[C]**.
- **Saving survives interruptions.** Stardew auto-saves "even if you kill the app or the device unloads it" [SV-MR]. An Enter the Gungeon player opened the camera for a few seconds and came back to the boot sequence with the run's items gone [GG-STORE] **[C]**.
- **Haptics are optional.** Funkin': None / Notes only / All [FNF-PREF]; Apple: "Make haptics optional" [A-HAP] **[C]**.
- **Holds.** A hold under 3 s is an accepted simple input [X-107][WCAG-PTR]; swipes and drags need a tap alternative [WCAG-DRAG] **[C]**.

### 1.8 Dropped or corrected (do not reuse)

| Claim in the raw research | Status |
|---|---|
| "PlayCanvas users crash from 300-350 MB of textures" | **Wrong.** That thread was fixed by unloading about 1 GB of decoded audio. It gives no texture budget |
| A Phaser forum user found "loading everything before the game starts was the main issue" | **Wrong.** The quote is not there; splitting the load did not fix their crash |
| Suroi fires past "one third of travel", so our 18 px aim threshold is validated | **Wrong reading.** It is 50 px, two thirds of travel |
| Terraria added a "Simplified" touch preset | **Wrong.** It is a gamepad preset |
| Balatro drew a complaint for having no portrait mode | Not in the source |
| Moonlighter uses automatic attacks and later added a joystick | Not in the cited source |
| Phones drop the WebGL context "on every backgrounding or lock" | Unsupported; one 2023-24 regression |
| `100dvh` is broken on "current iOS" | iOS 26.0 only, largely fixed in 26.1 |
| Regroup atlases to fix frame rate | Unsupported; binds are cheap since Phaser 3.60 |
| Make ACTION 60 px because Hades' interact button was too small | Evidence unverified; 52 px already passes every guideline |
| Mega Cat's "50-75%" shows FIRE-held plus JUMP-tap is unreliable | It measured same-frame chords only |
| Ace Attorney got Story Mode on phones | Documented for console and PC only |
| Stardew UI scale 75-150% as phone evidence | Desktop options page |
| Everything resting only on TouchArcade: Hades buttons locked inside 16:9, Neon Chrome, Time Recoil and the 10tons ammo quote, Tesla vs Lovecraft, Exit the Gungeon's touch scheme, Space Marshals | **[U]** throughout |
| Brawl Stars / CoD Mobile / Soul Knight details given "from memory" in the UX angle | Use the verified wiki versions above; CoD Mobile dropped |

---

## 2. What this confirms in our plan

| Plan item (audit section) | Verdict | Strongest evidence |
|---|---|---|
| Floating stick under the left thumb, zone = left 45% including the gutter (3) | Confirmed | Apple HIG and WWDC26; Dead Cells; Roblox; Soul Knight; Suroi |
| 8 px dead zone on a 56 px radius (14%), full speed at 60% travel (3) | Confirmed, inside the 5-16% range | Microsoft 0.05; PPSSPP 0.15; rex 16/100; Roblox full speed at 50 px |
| One FIRE control: hold = auto-aim fire, slide = manual aim; not twin-stick; not tap-to-move in combat (3) | Confirmed in model, with the pinned-thumb caveat (section 3, M1) | Brawl Stars; Diablo Immortal; Terraria Aim & Use; Apple; Stardew and Bastion on tap-to-move |
| Sticky auto-aim (3) | Confirmed | Soul Knight; Relic Hunters |
| Contextual ACTION button with a verb, separate from FIRE; tap the bubble or object also works (3) | Confirmed | Apple; Diablo Immortal; Dead Cells; Microsoft |
| DODGE as a plain button that goes where the stick points (3) | Confirmed | Dead Cells |
| At most four controls over the play area; everything else contextual (rule 1) | Confirmed | Brawl Stars 4; Soul Knight 3; Microsoft inner wheel max 4; Hades as the counter-example |
| HTML controls in real CSS px, in the gutters, anchored to the corners (3) | Confirmed | PokeRogue; Suroi; Metal Slug Window mode; Apple anchors |
| 52 px minimum for combat buttons (rule 2) | Confirmed (above 44 pt and 48 dp) | Apple; Google |
| Press owned by touch id (rule 4) | Confirmed and essential | Hades complaints; the audit's own slide-off bug; Pointer Events spec |
| HUD, boss bar and weapon card at the top; explicit pause button in every scene (3) | Confirmed | Dead Cells; Apple; Minecraft |
| Hide combat controls and make the whole screen the tap area in overlays, QTEs and menus (rule 6) | Confirmed | Apple WWDC24 and WWDC26; Microsoft |
| Per-mode layouts `none / walk / combat / side / brawl / tap` (3) | Confirmed, with a stuck-mode risk (M11) | GTA ports; Microsoft; Soul Knight |
| "Phone assist" as one toggle that leaves laptop numbers alone; do not cut enemy count or speed up front (3) | Confirmed | Dead Cells Auto-Hit mode; Bastion; Mega Man Mobile as the warning |
| One build, runtime flag, `?mobile=0` escape hatch, old tablet pad kept (4) | Confirmed | Papers, Please; Minecraft; Brawl Stars backlash |
| Detection by coarse pointer + no hover + small screen (4) | Confirmed | CrazyGames warning about touchscreen laptops |
| Rotate overlay everywhere; fullscreen and landscape lock on Android only; no fullscreen on iPhone; Add to Home Screen as the iPhone route (5) | Confirmed | WebKit bug 206854; MDN data |
| "Saves made in the browser stay in the browser" on iPhone (user priorities) | **Confirmed by WebKit's own pages** | WK-ITP; WK-181849 |
| `touch-action:none; user-select:none; overscroll-behavior:none` (5) | Confirmed, plus additions in M2 and M3 | WebKit; PokeRogue |
| Pause, mute and save when hidden (5) | Confirmed | Ren'Py; Stardew; Gungeon run-loss review |
| 960x540 buffer, no device-pixel-ratio multiply; skip glow effects; flat fallbacks for 3D shots (6) | Confirmed | Suroi and CrazyGames defaults |
| Decode effects on first use, keep about 30 warm, mono (6) | Confirmed, with a queue (M12) | WebKit bugs 227636 and 189337 |
| Music through a gain node, one reused element, `audioSession = "playback"` (6) | Confirmed in aim, needs fallbacks (M9) | MDN; WebKit bugs |
| Measure on real phones before the big memory job (6, 10) | Confirmed as defensible | The 917 MB figure is 55-70% of observed kill lines |
| Phaser version | **Already satisfied:** 3.90.0 has context restore (3.80), no 3.85 memory bug, and is the last 3.x | PH-380; PH-386 |
| Beep Beep: auto-cruise, steer by holding a side, BOOST and HORN in the corners (2) | Confirmed | Real Racing 3; Asphalt 8 and 9 |
| Crocodile latency calibration (2) | Confirmed; widening the window is unnecessary (M13) | Funkin'; StepMania; osu! |
| Tap-then-confirm on character select; 44 px rows; touch wording through one `hint()` helper (7) | Confirmed | Apple; Minecraft patched tips |
| Stick-up no longer jumps on phones; JUMP button in side rooms (2) | Confirmed | Dead Cells; Roblox; SuperTux |
| Pits cost a little health and put you back (already in code) | Confirmed as the right rule | Dead Cells "platforming is not the challenge" |

---

## 3. What we should change or add

Each item: **Build** (what, with numbers) and **Why** (evidence). Numbers marked *mine* are starting values.

### MUST

**M1. Auto-fire as a first-class default, and a rule for firing when the thumb leaves FIRE.** *(combat)*
- **Build:** setting `Auto-fire: On / Off`. **On by default in side rooms. On by default in top-down rooms too for the first device test** (the user's brief: "the game aims, you choose when to dodge and when to unleash the special"); final top-down default decided after that test.
  - Auto-fire shoots only when auto-aim has an enemy in range with a clear line. Never at barrels or crates, never a special, never while a prompt, picker or overlay is open. When the gun is empty the existing auto-switch runs.
  - With Auto-fire on, FIRE stays: hold = fire regardless of target (barrels, crates, straight ahead), slide = manual aim.
  - With Auto-fire off: firing continues for **200 ms** (*mine*) after the thumb lifts, so hopping to DODGE and back does not break the stream.
  - Must behave with all eight guns and must never delay a jump or dodge.
- **Why:** hold-to-fire pins the thumb; the reference drag-aim controls fire on release, ours does not (checker finding). Mindustry, Bastion and Stardew default to automatic attacking on phones; Dead Cells' Auto-Hit became the porting team's favourite; Apple says to redesign anything needing two presses at once. No source proves the default for an ammo-limited shooter, hence the test.

**M2. Auto-aim: visible, steerable, able to hit objects.** *(combat)*
- **Build:** target = nearest enemy with a bias toward the stick direction, sticky until it dies or leaves range (planned); when no enemy is in range, fall back to the nearest barrel, crate or tied hostage. Draw a ring at the current target's feet. Setting `Aim assist: Off / Normal / Strong`.
  - Slide-aim starts when the thumb is **24 px** from where it landed (tunable; test 18 to 30) and tracks the finger's displacement directly. Back inside the threshold = auto-aim again. Draw an aim line while sliding; snap to an enemy within 15 degrees either side and tint the line when snapped.
  - "Clear line of fire" is our addition; no source shows it.
- **Why:** Soul Knight's red circle; Diablo Immortal's movement bias; Brawl Stars' fallback to objects; Relic Hunters' visible narrow snap and three settings; Gungeon players asking for a slider. Suroi's threshold is 50 px, so 18 px is close to thumb wobble.

**M3. Touch layer that cannot stick, drop or leak.** *(controls)*
- **Build:**
  - One touch surface per side that hit-tests by coordinates on every move. Do not rely on per-button enter/leave events (touches are captured by the element they land on).
  - A press belongs to its touch id until release. Inside the right cluster a touch in a gap goes to the nearest control within 20 px (*mine*): no dead space. Overlapping hit areas resolve to the nearest centre.
  - Hit slop = 10 px on every side of the drawing (define it this way; the audit's "8 px larger" is ambiguous).
  - Release every control and zero the stick on `pointercancel`/`touchcancel`, `visibilitychange`, `pagehide`, `blur` and orientation change.
  - Controls use a **non-passive `touchstart` that calls `preventDefault`** (stops zoom, the magnifier, ghost mouse events on iOS before 27, and Phaser's window forwarding). Scrolling overlays cannot do that, so they call `stopPropagation` on touch-start and touch-end instead.
  - A control that is being pressed stays in place until its touch ends, even if its mode has just been switched off.
  - FIRE, DODGE and JUMP act on touch-down with zero delay.
  - Handle at least three touches at once; test what happens with a fourth and fifth (the browser may cancel all of them).
  - `touch-action:none` on `html`, `body` and the full-window layer including the gutters, so a two-finger touch on empty gutter cannot pinch-zoom the page.
- **Why:** Hades' slide-off and dead-space complaints; PokeRogue's stuck-key bug; MDN's cancel list; the Pointer Events implicit-capture rule; Phaser 3.90's `TouchManager`.

**M4. The stick always appears, and screen edges are safe.** *(controls, shell)*
- **Build:**
  - Nothing inside the stick zone takes pointer events: toasts, quest text, HUD decoration, the old canvas pad. A touch that starts in the left 45 to 50% below the HUD strip always becomes the stick.
  - Settings: `Stick: Floating / Fixed`. Re-map output after the dead zone so speed ramps from zero. Add follow: when the thumb goes past the base radius, drag the base along.
  - iPhone: for touches starting within 20 px of the left or right edge, call `preventDefault` in the non-passive `touchstart` (blocks Safari's back swipe). Keep the page history empty.
  - Android: fullscreen on the Enter tap as planned; also push one history entry and turn Back into Pause.
  - Lock with `screen.orientation.lock("landscape")`, never `landscape-primary`; both rotations must work.
- **Why:** Hades and Diablo Immortal are the two documented ways floating sticks fail; fixed-stick options ship in Dead Cells, Soul Knight, Brawl Stars, Minecraft; edge-gesture sources [PQ-NAV][AND-GN]; the Gungeon locked-rotation review.

**M5. Safe areas, spacing and a height clamp.** *(controls)*
- **Build:**
  - Draw every control inside the safe insets, using `max(inset-left, inset-right)` on both sides so the layout does not shift when the phone is flipped. Draw nothing within 60 px of a short edge between 30% and 70% of the height (the Dynamic Island band, either side). Hit areas may extend to the physical edge outside that band.
  - This moves SMART off (790,170) and pulls FIRE's right edge (806) inside 797. See the layout table below.
  - At least 12 px between drawn edges. Today's plan has JUMP and DODGE 12 px apart in side rooms, which leaves no room for hit slop.
  - Scale every control by `clamp(innerHeight / 390, 0.85, 1.15)` and re-check at 340 and 320 px tall.
  - Keep `env(safe-area-inset-bottom)` on Android too (Chrome 135+ draws under the gesture bar).
- **Why:** Apple: controls must not overlap the Home indicator or Dynamic Island, and each keeps "a consistent size and distance from its anchor point"; Apple 12 to 24 pt and Google 8 dp spacing; Luanti and SuperTux size from screen height because of 20:9 phones.

**M6. Side rooms: JUMP is the biggest button, and jumping is forgiving.** *(jumping)* Full spec in the Jumping subsection below. In one line: JUMP 84 px in the prime corner, fires on touch-down, 150 ms buffer, 140 ms coyote, tap = hop, stick is left/right only, drop-through needs a deliberate input, auto-fire on, and the plane and colon rooms get their frame-rate work in the same phase.

**M7. Reading text at 16 CSS px, labels never under 11.** *(menus-dialogue)*
- **Build:**
  - Compute from the live scale: `gamePx = ceil(cssPx / k)`. Dialogue body, choices and TV subtitles **16 CSS px** (23 game px at k=0.72, 26 at k=0.63); speaker name 19; any label or hint at least 11 (16 and 18 game px).
  - Dialogue box about 120 to 130 CSS px tall, clear of the bottom 21 px, three lines at 1.3 line height; shrink or drop the portrait if the text needs the width.
  - Auto-page lines that no longer fit: split at a sentence end, the voice keeps playing, the next tap shows the rest. Run the existing overflow scan over every line.
  - Call `setResolution(2)` or `(3)` on dialogue, choice and subtitle text in phone mode so it is sharp.
  - TV subtitles: at most two lines of about 40 characters on a 50% black box, 0.25 s gap between subtitles.
  - Setting `Text size: Normal / Large (+25%)` with a live preview line.
- **Why:** Ren'Py's phone preset, the 46px@1080p guideline and the BBC all land on 16 to 17 px at 390 high; Apple's 11 pt is a minimum; the ports that only scaled (Slay the Spire, Baldur's Gate, Disco on Switch) are the cautionary tales. Today: dialogue 11.6, subtitles 9.4, labels 7.2.

**M8. Dialogue: Skip, Log, safe choices, no slog.** *(menus-dialogue)*
- **Build:**
  - Keep tap-anywhere-to-advance. On the box: `SKIP` and `LOG` pills (44 px hit, 8 px apart, excluded from the advance tap) plus the global pause. `AUTO` joins them in S4. Replace the "E / Space · Tab skip" footer with a small tap marker.
  - `SKIP` opens a two-button confirm (48 px tall, 12 px apart), then runs only to the next choice or interactive beat, with a "Skipping" marker. One shared control for meetings, cutscenes, vignettes, the Lair, flyovers, the Kreltality and the finale's "skip fight".
  - Text appears instantly (or very fast) in phone mode, so a line never costs two taps.
  - Choices: rows at least 48 px tall, 8 to 12 px apart, nearly full width, 16 px text, no key numbers. A choice is accepted only from a touch that **began and ended on that row after the rows finished appearing**. When the viewport is under about 370 px tall, choices replace the dialogue box (four rows need 216 px and do not fit above a 130 px box at 340).
  - `LOG` opens the shared list (M10) at the newest line; tapping a line replays its voice.
  - All gameplay timers stop while a confirm, list, shop or choice is open.
- **Why:** Ren'Py's touch menu and skip defaults; Ace Attorney's missing log; the audit's 50 / 29 / 48 taps for the first three scenes; 80 Days' running clock.

**M9. iPhone audio that actually plays.** *(audio)*
- **Build:**
  - Do all unlocking in a **`touchend`, `click` or `pointerup`** handler on the Enter gate, not in Phaser's `pointerdown`: resume the Synth context, call `play()` on a fixed pool (one music element, two or three voice elements), request fullscreen on Android, request the wake lock.
  - After that only change `src`; never `new Audio()` again. Voices at 1.5x go through the pool.
  - `navigator.audioSession.type = "playback"` when the property exists. Because that stops the player's own music, expose it as `Play over my music: On / Off`.
  - On becoming visible: wait 100 to 250 ms, `suspend()` then `resume()` the Synth context, check that `currentTime` advances, and retry on the next tap. (Phaser 3.88's fix does not apply; Synth owns its context.)
  - Music volume: route the one music element through a gain node behind a start-up self-test; if it is silent or throws, play the element directly and turn the Music slider into on/off using `muted`.
  - Pause every audio element when hidden.
- **Why:** WebKit's user-activation list; howler's pool; MDN on volume; the silent-switch and focus-loss bugs; the createMediaElementSource regression history.

**M10. One native-scroll list for every long list.** *(menus-dialogue)*
- **Build:** an HTML list over the canvas with `overflow-y:auto; touch-action:pan-y; overscroll-behavior:contain`, used by the TV guide (58 shows), loaner rack (19), dialogue log, archive, jukebox, chapter select and quests.
  - Rows 52 px (so a part-row is always visible), 16 px text, tap selects on release.
  - 44 px page-up and page-down buttons; the list remembers its position; watched shows are marked.
  - `stopPropagation` on its touch-start and touch-end so the canvas underneath is not clicked too.
  - Channel tabs at least 44 px tall, about five visible.
- **Why:** 51 of 58 shows and 13 of 19 loaner items are unreachable by touch today. The browser gives momentum, tap-versus-drag and containment for free [MDN-TA]; Apple asks for system scrolling behaviour; WCAG asks for a non-drag alternative.

**M11. Layer-mode safety.** *(controls)*
- **Build:** derive the layer's mode from the current scene and overlay stack every time something opens, closes, resumes or the page becomes visible; do not trust each scene to switch it back. A test walks every scene transition and asserts the mode. The pause button exists and works in every mode.
- **Why:** GTA's ports shipped layouts stuck in shop mode and buttons that vanished. We will have six modes and many overlays.

**M12. Memory steps that do not wait for the device reading.** *(memory-performance)*
- **Build:**
  - Decode effects through a queue, one at a time with about 100 ms between, on first use; keep about 30 warm; mono. Target at most about 30 MB decoded.
  - Load the TV faces and anchors (256 MB, used only by the TV) when the TV opens and remove them on exit.
  - Reload-loop guard: write "boot started" and "boot finished" markers; after two unfinished boots in a row, start in a low-memory mode (half-resolution pack for backdrops and boss sheets, no 3D shots). It cannot rely on a context-lost event.
  - On a lost WebGL context: pause, wait up to 5 s for Phaser's restore, redraw render textures on `RESTORE_WEBGL`; reload only if nothing comes back.
  - `?mobilediag` computes its own numbers (sum of width x height x 4 over the texture manager; seconds of decoded sound x rate x channels x 4), because an iPhone exposes no memory reading.
  - Debounce the `visualViewport` resize handler.
  - The rest of the grouped loading stays sized by the device reading, as the audit says.
- **Why:** parallel decoding has killed iPhone tabs and the memory frees late; Safari's reload loop; Phaser 3.80's restore; the resize-storm report.

**M13. Rhythm: an offset, big lanes, the audio clock.** *(minigames)*
- **Build:**
  - Stored `Sync offset` in ms per device, with a plus/minus 5 ms nudge in the pause menu during a song. Leave Crocodile's window alone.
  - For the two rhythm games, decode the song into a buffer, start it on the audio context clock and judge hits against that clock, not frame time (about 21 MB per stereo minute, freed on exit).
  - Four-lane game: each lane a full-height column, or at least 1.35x the receptor's width and several times its height; notes scroll toward the thumbs; two lanes per thumb. If any chart has two-note chords, check they are reachable with two thumbs.
  - Lift pads out of the bottom 21 px (planned).
- **Why:** every rhythm game checked ships an offset; our window is already wider than theirs; Apple's engineer on element sync; Funkin's phone layout.

**M14. Quick-time finishers and mashers.** *(minigames)*
- **Build:** one prompt = one large fixed target (at least 76 px, at the prime-slot position) or a tap anywhere. The Kreltality buttons are 32 px tall today: raise to 48. All windows in milliseconds. Mash games count touch-downs from any finger anywhere on the screen. Never two buttons at once or a sequence of different buttons.
- **Why:** Apple's single QTE button; the audit's deadlift at 272 of 300 kg at 4.5 taps a second; Minecraft's high-refresh double-tap bug.

**M15. Feedback that does not need vibration.** *(controls)*
- **Build:** on press, the outline goes to 70% as planned **and** a ring or glow appears 8 to 12 px outside the button, with a soft click. Give outlines a dark outer stroke so 30% survives bright backgrounds. Android only: `navigator.vibrate(15 to 25 ms)` on DODGE, JUMP and the special, behind `Haptics: Off / On`. iPhone gets none.
- **Why:** Apple's press-state rule; MDN's data: no vibration in any iPhone browser.

**M16. HUD chips that are pressed in combat.** *(controls)*
- **Build:** heal and weapon chips at least 44 px tall with the hit area extended up to the top edge; they must look like buttons (outline, count, pressed state) and ignore taps when they can do nothing (heal at full health). At least 24 px between the weapon chip and pause, or move pause to the top-left.
- **Why:** Apple's 44 pt for frequent controls; Dead Cells' undiscovered tappable health bar; Terraria's greyed-out Quick Heal. The plan's chips are 40 px (6.6 mm on an iPhone 14).

### SHOULD

**S1. Replace the single SMART button with two predictable slots.** *(controls)*
- **Build:**
  - `SPECIAL` (60 px, fixed place): always the character special, with its krezz cost shown as a fill on the button. It never changes by itself.
  - `READY` (60 px): hidden until a meter-gated ability is available, then it pops in above SPECIAL and pulses: WONK when the gauge is full, then the transformation, then the beam while transformed. One icon and one word each.
  - The rest (fart, bongo, SanMik): hold SPECIAL for 300 ms or slide off it to open a ring of **at most four** segments, with the picker's slow motion; release on a segment to use it, release in the middle to cancel, auto-close after 3 s.
  - Never change what a button does while a finger is on it; ignore taps for 300 ms after an icon change (*mine*). When a held or mashed special starts, switch the layer to `tap` at once.
- **Why:** no game examined rotates five or more abilities through one button; Diablo Immortal's Ultimate and Brawl Stars' Super are the "appears when ready" pattern; Microsoft caps a slide picker at four; a nine-target ring at 52 px would be about 200 px wide and cannot be centred on a button at the screen edge (checker's arithmetic). It also meets the user's "one obvious way" rule.

**S2. Weapon quick-swap in thumb reach.** *(controls)*
- **Build:** a 56 px `SWAP` button in the left slot of the right cluster (top-down rooms): tap = switch to the previously used gun; hold 300 ms or slide off = the existing slow-motion picker of all eight, which must close on release. The top-right chip stays as a readout and second tap target. Keep auto-switch on empty.
- **Why:** Soul Knight, Bastion and Death Road to Canada put weapon switching one tap from the fire thumb; Apple and Microsoft reserve the top edge for infrequent controls. The chip in the plan is about 270 px from FIRE and "tap = next" can take seven taps. Inference from a small sample, so confirm by play.

**S3. A heal button near the thumb when it matters.** *(controls)*
- **Build:** when HP is under 40% and a bottle is available, a 56 px `HEAL` button with the count appears in the right cluster (layout table), with the 150 to 200 ms arm delay used for every pop-in control. The HP-bar chip remains.
- **Why:** Hyper Light Drifter's top-corner heal was the one control its reviewer faulted (mostly on iPad); DevilutionX keeps potions by the pad; Dead Cells keeps its potion on the bar, so this is a judgement to verify on a device.

**S4. AUTO mode for voiced scenes.** *(menus-dialogue)*
- **Build:** `AUTO` pill. A voiced line advances 0.5 s after its audio ends; an unvoiced line after (characters + 25) x 60 ms; never sooner than characters / 20 seconds whatever the voice speed; if the voice has not started within 1.5 s, use the text timing. A tap advances and cancels AUTO. Offer "Watch" at the start of a meeting. Hold a screen wake lock while it runs and re-request it when the page becomes visible. Depends on M9 (no tap per line means voices must come from an unlocked element).
- **Why:** Ren'Py's defaults; Netflix's reading cap; Disco Elysium's phone release. On iPhone home-screen apps before 18.4 the wake lock fails, so say so or fall back.

**S5. One instruction card for every minigame.** *(minigames)*
- **Build:** a single verb in large text (TAP, HOLD, DRAG, MASH, STEER), a gesture icon drawn over the real touch zone, at most eight more words, no key names. The card is playable: the timer starts on the first correct input or on READY. Reachable from pause as "How to play". After three failures of a non-core minigame offer `Skip`. Option `Hold instead of mash`.
- **Why:** WarioWare, Mario Party, Rhythm Heaven; the audit found instruction lines at 7 to 9 px that list keys first.

**S6. Hand over to a controller.** *(controls)*
- **Build:** poll `navigator.getGamepads()`; on the first pad input hide the touch layer and show pad prompts; on the next touch bring it back. Test both directions and after rebinding. Mention "a Bluetooth controller works" on the phone settings page.
- **Why:** every port review recommends a pad; Hades and Streets of Rage 4 hide the touch UI; Gungeon's hand-over bug. The game already has pad bindings.

**S7. Saves that survive.** *(shell)*
- **Build:** save export and import as a copyable code or file (moves a save between Safari, the home-screen app and the laptop); call `navigator.storage.persist()` on every launch; the room-change autosave stores the full run (guns, ammo, meters, health) and returning lands on a paused screen; detect in-app browsers on the title screen and say "Open in Safari / Chrome" before a save is started.
- **Why:** WebKit's 7-day deletion in Safari tabs and the isolated home-screen container; the Gungeon run-loss review; missing save transfer is a named complaint for Slay the Spire and Hades.

**S8. Sync calibration screen.** *(minigames)*
- **Build:** before the first rhythm section on a phone: tap along for 10 to 16 beats with no sound on the tap; drop the fastest and slowest; use the mean only if the spread is under 30 ms, otherwise ask once more. Seed from `outputLatency` where it exists. Hint: "Bluetooth headphones? Run sync again".
- **Why:** StepMania's rule; Funkin's calibration, test and pause trio; RhythmQuest's notes. Becomes MUST if the device test shows LATE on a phone speaker.

**S9. Phone assist additions.** *(combat)* Auto-collect coins, ammo and health inside the enlarged pickup radius; the jump forgiveness of M6 lives under this toggle; never slow the game. **Why:** Diablo Immortal's auto pick-up; Mega Man Mobile.

**S10. Teach in the moment.** *(controls)* For the first minutes on a phone show a one-word caption under each icon and pulse a control the first time it matters; add a labelled "Controls" picture to the pause menu. **Why:** Apple "Teach through play"; Microsoft pairs each icon with a label; Papers, Please and Transistor were faulted for explaining nothing.

**S11. One standard for holds and pop-in controls.** *(controls)* Holds are recognised at 300 ms for radial and picker (400 to 500 ms for anything that spends a resource), cancel if the finger moves more than 12 px, and show a filling ring. Any control that appears mid-play animates in and ignores presses for 150 to 200 ms. Swipes and drags (weapon chip swipe, gun-rack reorder) keep a tap or arrow alternative. **Why:** Android 400 ms and 8 dp, iOS 0.5 s and 10 pt; WCAG on drags.

**S12. Settings.** *(shell)* A "Phone" page: `Auto-fire`, `Aim assist`, `Phone assist`, `Stick`, `Button size S / M / L` (0.85 / 1 / 1.2, never under 48 px), `Opacity` (20 to 80%), `Left-handed`, `Haptics`, `Text size`, `Sync offset`, `Play over my music`, `Phone layout: Auto / On / Off`. Two columns, 48 px rows. Never change a default in an update without a notice. **Why:** the common set across PPSSPP, Luanti, Funkin', Brawl Stars; Papers, Please's override; GTA Vice City's forced default.

**S13. Shops and inventory.** *(menus-dialogue)* Tap selects and shows detail with a separate BUY button; quantities use plus and minus; SAVE and QUIT are at least 12 px apart or QUIT confirms; activate on release. **Why:** Stardew's hold-to-count and edge mis-taps; Balatro's Skip; the audit's 25 px pause rows.

**S14. First download and caching.** *(memory-performance)* Aim for a usable title screen after 20 to 30 MB, fetch the rest per chapter with progress in MB. Service worker: cache on demand, answer Range requests for audio, keep files small, version the cache. **Why:** portal budgets of 15 to 30 MB; Workbox guidance.

**S15. Phone QA additions.** *(other)* The planned suite should fail on reading text under 15 CSS px, any text under 11 and play targets under 44 px at 844x390, 740x360 and 750x340, in both rotations; run the jump tests at 30, 60 and 120 Hz; test context loss with `WEBGL_lose_context`. **Why:** Stardew's 1.5 update regressed to an "overly small UI"; Papers, Please relied on an automatic player.

### COULD

| # | Build | Why |
|---|---|---|
| C1 | Drag-to-reposition editor for the right cluster (move, per-button scale, reset), on the pause menu | Standard in commercial ports; for a private game S/M/L plus mirror covers most of it, and the user wants defaults nobody has to open |
| C2 | Roll pair behind a flag: a touch within 8 px either side of the FIRE/JUMP seam counts as both | SuperTux does it; Dead Cells' slide button failed, so treat as an experiment |
| C3 | Tap-to-walk in the hub and interiors only (tap an NPC or door) | Stardew; Apple "consider letting players tap objects" |
| C4 | Options: swipe-to-dodge on the right half, 8-direction movement, left/right buttons in place of the stick in side rooms, `Stick up jumps` | Dead Cells; Soul Knight; the discrete-buttons finding |
| C5 | Dialogue box as HTML, using the full 750 px safe width | Same reason the controls are HTML; cost is a second renderer |
| C6 | A safe "try the controls" room from settings | Brawl Stars' test step; idle is lethal in room 1 |
| C7 | iPhone tap haptic for menu buttons via the Safari 17.4 switch trick | Undocumented behaviour; taps only |
| C8 | Auto-hop one-tile steps; auto-run in forced-right rooms; an invisible "tap the right half to jump" zone | Super Mario Run's vault; changes how rooms play, so opt-in |
| C9 | Fade a control when the player or target is under it (16:9 phones with no gutters) | Inference from occlusion complaints; no precedent found |
| C10 | "Watch" a whole meeting hands-free; one-line summary after a skip; mark visited NPCs; tap the left edge to go back one line | Ren'Py rollback side; accessibility guidance on summaries |
| C11 | A no-fail "story" toggle | Bastion's Infinite Lives |
| C12 | Aim the beam like FIRE: tap = auto, hold and drag = aim | Brawl Stars' Super; Diablo Immortal skills |
| C13 | Half-resolution backdrops and boss sheets as the phone default | Suroi ships low-res textures by default on mobile; decide after the device reading |
| C14 | Apex hang: half gravity while JUMP is held and vertical speed is under 90 px/s | Celeste; adds about 3 px and 120 ms of air time |

### Do not build

Twin-stick as the default. Tap-to-move in combat. Swipe-up to jump. Double-tap-the-stick to dodge. One sliding button for two verbs. Tilt steering. A slower game speed or softer gravity on phones. Timers counted in frames. An instant reload on context loss. Feedback that only exists as vibration. A seven-way hold radial.

### Jumping (detailed)

Everything here is behind `isMobile()`; laptop numbers do not change. "Today" is what the code does now.

| Aspect | Today | Build on phones | Evidence |
|---|---|---|---|
| **Button placement** | Stick up past 0.6 | `JUMP` takes the **prime corner slot** in side rooms: centre 52 px in from the right safe edge and 52 px up from the bottom safe edge, (745, 317) on 844x390 (*mine*). DODGE and SPECIAL stay exactly where they are in top-down rooms | Roblox: jump in the corner, 60 from the right, 55 from the bottom. SuperTux: jump in the corner. User brief: "a big jump button under the right thumb" |
| **Size** | n/a | Drawn **84 px** (13.9 mm on an iPhone 14). Hit area: +12 px toward the screen centre and all the way to the right edge and down to the home-indicator strip | Xbox guidance 15 mm; Roblox 70; PokeRogue 68-78; SuperTux hit square 4x the icon. The plan's 64 px is 10.6 mm, the smallest of the main buttons |
| **Trigger** | Edge of stick-up | On **touch-down**, never on release. Record `event.timeStamp` so a press between two slow frames is not lost | Minecraft removed its action delay; accessibility guidance allows down-events for real-time controls |
| **Jump buffer** | None | **150 ms** (tunable 120-180): a press with no jump available is remembered and fires on landing. A press in the air with the air jump available uses it at once, as now | Celeste and tutorials use about 70-120 ms on pads; phones add touch and frame delay. Cap near 200 ms or stale inputs fire |
| **Coyote time** | 110 ms | **140 ms** (tunable; cap 200) | Celeste 100 ms; typical 100-200; GDevelop default 250 |
| **Variable height** | None: always the full 145 px | Track JUMP held by touch id. When it is released (or at 80 ms after take-off if it was released sooner), if the player is still rising faster than 300 px/s, cut the upward speed to 300 (260 for the air jump). Result: a tap is about a **78 px hop**, a hold is the same 145 px as today, so nothing goes out of reach (*mine*, arithmetic from gravity 1500 and take-off 660) | Super Mario Run tap vs hold; Celeste's 0.2 s hold window with no hard cut |
| **Double jump** | Release the stick and push up again | A second press of JUMP. Buffered like the first | Dead Cells "Hold to second jump" shows ports ease repeat jumps |
| **Air control** | 140 ms ease in the air (half of ground) | **100 ms** in the air (*mine*) so a thumb can correct a landing | Celeste air acceleration is 0.65 of ground; Mega Man Mobile's failed mid-air corrections |
| **Stick in side rooms** | Full 2D stick; up jumps; down past 0.6 drops | **X axis only.** Dead zone 8 px; full run speed at 35% travel (about 20 px). Follow mode on, so reversing in mid-air is a small move | Mega Man Mobile; the Dead Cells "slide sideways" review; discrete-direction finding |
| **Drop through a platform** | Any down past 0.6 opens a 220 ms window | Deliberate only: stick down past 0.7 with sideways under 0.35 held 150 ms, **or** stick down + JUMP (*mine*) | With stick-up gone, an accidental drop is the next unforced error |
| **Ledge forgiveness** | One-way platforms accept a landing 14 px low | Raise to 20 px. Add a ledge pop: feet within 8 px below a solid top while moving toward it = placed on top. Corner correction: head clips a corner = nudge sideways up to 40% of the body width. Platform tops count 4 px wider each side than drawn (*mine*) | Celeste corrects by half its body width; Dead Cells' 30-40 arrival helpers |
| **Moving platforms** | Carried while standing | Keep the platform's velocity for 100 ms after stepping or jumping off | Celeste lift boost |
| **Crushers and steam** | Art-sized hit boxes | 10-15% smaller under phone assist | Celeste: "fudged a tiny bit in the player's favor" [U quote]; Dead Cells |
| **Pits** | -15 HP, back to the last safe X | Keep. Check there are about 800 ms of invulnerability after the respawn | Already the right rule |
| **Gravity, jump height, game speed** | 1500 / 145 px | **Unchanged** | Mega Man Mobile's speed change; "floaty" touch platformers [U] |
| **Camera** | Lerp 0.12, 80x60 dead zone; the audit saw the player drift to 55-97% of the width | No horizontal dead zone. Hold the player at 35% of the width when facing right and 65% when facing left (`followOffset.x` about -144 / +144 game px; check the sign), switching only after 0.4 s of moving the new way, eased over 0.4 s. Vertically, re-centre when grounded or when the player leaves a +/-100 px band; shift the view 60 px down after 150 ms of falling. Time-based lerp (*mine* for all timings) | Keren's dual-forward-focus and platform-snapping; thumbs sit on the lower corners, so what is coming must be in the clear middle |
| **Firing while jumping** | Hold ATTACK | **Auto-fire on by default in side rooms**, aimed by facing plus auto-aim; no slide-aim in side rooms. `FIRE` (60 px) sits directly left of JUMP as the manual override, with the 200 ms fire grace of M1. Experiment C2 lets one thumb straddle both | Apple; Dead Cells Auto-Hit; Mindustry; SuperTux's layout |
| **Frame rate** | Plane about 30 fps, colon 23-24 (software rendering) | Do the culling and pooling for the side rooms in the same phase as JUMP. Target a steady 60, or a locked 30 through the Battery saver cap. All jump timers stay in scene milliseconds (they already are). Physics is already fixed-step | Mega Man Mobile; Vampire Survivors on phones; Phaser Arcade `fixedStep` |
| **Feedback** | Jump sound, "YEE" | Same frame as touch-down: button ring, sound, dust puff. Android: 15-20 ms vibration | "No tactile feedback when you go to jump or shoot" (Mega Man Mobile) |
| **Options** | n/a | `Auto-fire`, `Stick up jumps` (off). No auto-jump by default (C8) | One obvious way |
| **Tests** | n/a | Automated: tap gives about 78 px and hold 145 px; a press 120 ms before landing jumps on landing; a press 130 ms after walking off a ledge jumps; the same gap is cleared at 30, 60 and 120 Hz. Device: play each side room by thumb and tally deaths by cause (missed button, late jump, drop-through, hidden by thumb) | Sets the numbers from play, not from guesses |

### Right-hand cluster, layout v2 (*mine*: derived from the sourced constraints; starting values for the thumb-reach test)

Offsets are from the bottom-right **safe** corner to the control's centre, at scale 1 (844x390); multiply sizes and offsets by the height clamp. Absolute positions are for an iPhone 14 (safe edge x=797, y=369). Smallest gap between any two drawn edges below is 16 px.

| Slot | Offset (in, up) | Centre | Size | Top-down rooms | Side rooms | Walk mode |
|---|---|---|---|---|---|---|
| PRIME | 52, 52 | (745, 317) | 84 | FIRE | **JUMP** | ACTION (only with a prompt) |
| LEFT | 148, 44 | (649, 325) | 60 | SWAP (S2) | FIRE | - |
| UP-LEFT | 122, 126 | (675, 243) | 60 | DODGE | DODGE | - |
| UP | 34, 150 | (763, 219) | 60 | SPECIAL | SPECIAL | - |
| READY | 34, 226 | (763, 143) | 60 | pops in when a meter ability is ready | same | - |
| HEAL | 118, 204 | (679, 165) | 56 | pops in under 40% HP | same | - |
| ACTION | 212, 104 | (585, 265) | 56 | only with a prompt | only with a prompt | (uses PRIME) |
| Pause | top-right, 6 from the top | (775, 28) | 44 | always | always | always |
| Weapon chip | top, 6 from the top | (650, 28) | 140 x 44 | readout, tap = next, hold = picker | same | - |

DODGE and SPECIAL never move between room types; only the prime slot's verb changes, with a clear icon. Permanent controls over the play area: four. Pause moves in from the plan's (790, 26), where it crossed the safe edge at 797, and the weapon chip moves 30 px left so the two are 33 px apart. Mirror everything for left-handed play.

---

## 4. Numbers worth keeping

| Topic | Number | Source | Tag |
|---|---|---|---|
| **Touch targets** | | | |
| Apple: frequent game controls / menus | 44x44 pt / 28x28 pt minimum, "aim for the defaults" | [A-GC][A-W24] | C |
| Google | 48x48 dp, 8 dp apart, about 9 mm (7-10 mm range) | [G-TT] | C |
| Xbox accessibility: default touch target on phones | 15 x 15 mm (about 90 CSS px on an iPhone 14) | [X-107] | C |
| Game Accessibility Guidelines | 9.6 mm on phones, 24 mm ideal | [GAG-SIZE] | C |
| One-thumb research | 9.2 mm single presses, 9.6 mm serial | [PARHI] | C |
| WCAG 2.2 | 24 px minimum, 44 px enhanced | [WCAG-TS] | C |
| iPhone 14 conversion (153 CSS px per inch) | 40 px = 6.6 mm, 44 = 7.3, 52 = 8.6, 60 = 9.9, 76 = 12.6, 84 = 13.9, 90 = 14.9 | arithmetic | - |
| Roblox jump button | 70 px; centre 60 from the right, 55 from the bottom (archived scripts; today's client may differ) | [RB-JUMP] | C |
| PokeRogue main buttons | 20% of viewport height (68-78 px); small ones a third of that | [PR-CSS] | C |
| Microsoft Xbox touch kit | button art 60x60, stick base 120x120 at 1x; player scale 0.5-2x | [TAK-BTN][TAK-SCHEMA] | C |
| DevilutionX | buttons 0.3 in, pad 1.0 in, margin 0.25 in, gaps 0.1 in | [DX] | C |
| Luanti | 65 dp, capped at screen height / 4.5 | [LU-LAY] | C |
| SuperTux | hit square 0.4 x screen height (Android); icon a quarter of that side | [ST] | C |
| Spacing | Apple 12 pt (bezelled) to 24 pt; Google 8 dp | [A-ACC][G-TT] | C |
| Idle / pressed opacity | Funkin' 0.2 to 0.4 in 0.08 s; PokeRogue 0.8 / 0.6; PPSSPP 65% with 8 s auto-hide | [FNF-HB][PR-CSS][PS] | C |
| **Stick** | | | |
| Size | nipplejs 100 px base, knob 50%; Godot 100 / 50; Suroi 150 | [NJ][GD][SU-VAR] | C |
| Dead zone | Microsoft sample 0.05 radial; PPSSPP 0.15; rex 16 px on 100; Roblox 2 px (floating) or 5% re-mapped (fixed) | [TAK-DZ][PS][REX][RB-DYN][RB-THUMB] | C |
| Full speed | Roblox at 50 px of travel; Apple sprint above 0.8 magnitude | [RB-DYN][A-W26] | C |
| Stick zone | Apple: whole left half; Roblox: left 40% x lower two thirds; Soul Knight: about the left 25% | [A-W26][RB-DYN][SK] | C |
| Aim stick fires past | 50 px on a 150 px stick (Suroi) | [SU] | C |
| Auto-aim snap | about 30 degrees total, with a colour change | [RH] | C |
| Floating vs fixed preference | "80% / 20%" (producer's round figure) | [DC] | P |
| **Gesture timing** | | | |
| Android | tap slop 8 dp; long-press 400 ms; double-tap 300 ms | [AND-VC] | C |
| iOS | long-press 0.5 s, 10 pt allowance | [A-LP] | C |
| Ren'Py | long-press 0.5 s within 15 px | [RP-CFG] | C |
| Stardew | tap vs hold split at 0.25 s | [SV] | C |
| Luanti | long tap 400 ms (100-1000); drag after 20 px | [LU-SET] | C |
| Roblox | tap = under 0.5 s and under 25 px | [RB-DYN] | C |
| Minecraft | inventory drag after 180 ms (was 120); destructive first action 800 ms | [MC-40P][MC-50] | C |
| Radial auto-dismiss | 3 s (Apple); slide picker max 4 segments (Microsoft) | [A-W26][TAK-BTN] | C |
| Edge-swipe block zone on iPhone | 20 px from each side | [PQ-NAV] | C |
| PokeRogue | key repeat 250 ms; second tap within 500 ms cancelled | [PR-TC] | C |
| **Jump** | | | |
| Celeste | coyote 0.1 s; full-height hold 0.2 s; corner correction 4 px on an 8 px body; half gravity under 40 (jump speed 105); max fall 160 vs run 90; air accel 0.65 | [CE] | C |
| Coyote, typical | 0.1-0.2 s; GDevelop default 0.25 s | [GDQ][GDV] | C |
| Two-button chord buffer | 50 ms | [MCAT] | P |
| Dead Cells jump helpers | about 30-40 | [DC-80LV] | C |
| KRELWORLD today | coyote 110 ms; buffer 0; jump 660 / 580 px/s; gravity 1500; apex about 145 px | code | - |
| **Rhythm and latency** | | | |
| Windows, ms each side | Funkin' 45/90/135/160; Phigros-style 80/160/220; Sekai-style 42/83/125; StepMania 22.5/45/90/135/180 | [FNF-SC][PHI][SEK][SM-P] | C |
| KRELWORLD Crocodile | -150 / +210 ms x difficulty | audit | - |
| Calibration | 24 samples, apply mean if spread under 30 ms; or about 10 taps minus fastest and slowest | [SM-AS][RQ] | C |
| Touch panel latency | 15-30 ms | [OBOE-U] | C |
| Bluetooth | 30-100 ms in Android plus headset buffering | [OBOE-BT] | C |
| Audio output | iPhone a few ms; Android 12.5-150 ms (2011-era phones) | [MOZ] | P |
| Touch-to-display, 2013 phones | iPhone 5 55 ms; Android 110-120 ms | [AGAWI] | P (dated) |
| One frame | 16.7 ms at 60; 33 ms at 30; 43 ms at 23 | arithmetic | - |
| **Text and dialogue** | | | |
| Apple | 17 pt default, 11 pt minimum | [A-DFG] | C |
| Ren'Py phone preset (720 base) | dialogue 30, name 36, box 240, choices 1240 of 1280 | [RP-GUI] | C |
| Subtitles | at least 46 px at 1080p; 2 lines; 37-42 characters; 0.25 s gap | [GAG-SUB][BBC][NFX][HAM] | C |
| Reading speed | 160-180 wpm; 20 characters a second | [BBC][NFX] | C |
| Auto-advance | voice end + 0.5 s; 60 ms per character + 1.5 s | [RP-CFG] | C |
| Valve handheld floor | 9 px glyph at 1280x800, 12 recommended | [VALVE] | C |
| KRELWORLD today | dialogue 11.6, TV subtitles 9.4, labels 7.2 CSS px | audit | - |
| Minigame length and instruction | about 4 s; one or two words | [WW] | C |
| **Memory, load, frame rate** | | | |
| iPhone tab kill | 1.5 GB "for most devices"; logs near 2.0 GB | [WK-268816][WK-291677][LLB] | C |
| Peak JS heap budget | 512 MB | [YT] | C |
| Decoded audio | 21.2 MB per stereo minute | arithmetic | - |
| Decode queue gap that worked | 100 ms | [WK-227636] | C |
| Canvas memory cap, iOS 15 | 384 MB total | [PQ-CAN] | C |
| KRELWORLD at boot | 917 MB textures + 120 MB sound; 106 MB download in 2,408 files | audit | - |
| Portal budgets | initial 15-30 MB; total 250; file under 30; interactive in 5 s (YouTube) or 20 s (CrazyGames) | [YT][CG] | C |
| Safari storage | script storage wiped after 7 days without a visit (tabs); quota up to 60% of disk | [WK-ITP][WK-STO] | C |
| Frame callback | 30 in Low Power Mode; 60 or 120 on ProMotion | [WK-215745][WK-294338] | C |
| Phaser on phones | 15,104 texture binds at 60 fps on an iPhone SE | [PH-360M] | C |
| Audio resume after focus | suspend then resume after 100-250 ms | [PH-6829][WK-276016] | C |
| **What a phone browser can do** | | | |
| Vibration | Chrome Android yes (user gesture); iPhone no | [MDN-NAV] | C |
| Fullscreen | Android yes; iPad yes (swipe-down exits); iPhone no | [MDN-EL][WK-206854] | C |
| Orientation lock | Android in fullscreen only; Safari no | [MDN-SO][WK-257695] | C |
| Wake lock | Chrome Android; Safari 16.4+; iPhone home-screen app 18.4+ | [MDN-WL] | C |
| `outputLatency` | Chrome Android; Safari 18.4+ | [MDN-AC] | C |
| `audioSession` | Safari only (16.4+; type "playback" from iOS 17) | [MDN-AS][WK-237322] | C |
| Gamepad API | iPhone Safari and Chrome Android | [MDN-GP] | C |

---

## 5. Open questions only a real device can answer

1. **Auto-fire default in top-down rooms.** On or off feels better with the ammo economy? Does auto-fire waste scarce ammo?
2. **Thumb reach of layout v2** on the smallest phone the lads use, in both rotations: is DODGE reachable from the prime slot, is JUMP at 84 px right, is HEAL better on the right or as the top chip only?
3. **Jump numbers.** Do 150 ms buffer and 140 ms coyote feel right at the frame rate the side rooms really get? Use a 240 fps slow-motion video of thumb and screen for the true end-to-end delay.
4. **Slide-aim threshold.** 18, 24 or 30 px before a held thumb starts aiming by accident?
5. **Does a 4 GB Android and a three-year-old iPhone survive boot plus ten minutes** once the TV art and sound decoding are deferred? This sizes the rest of the memory work.
6. **iPhone audio:** does the routed music volume work and stay audible; silent switch on and off, with and without music playing; sound after a two-minute lock; voices at 1.5x from the pool; AUTO with no taps.
7. **Edge gestures:** left-edge stick starts in Safari and in the home-screen app; top-edge taps in a Safari tab (does the toolbar appear instead?); Android gesture navigation from both edges when the player declined fullscreen.
8. **How much of the notch-side inset band is really usable** for hit areas, and does iOS report the side inset on both sides in landscape?
9. **Three or more fingers:** does iOS cancel all touches, and does a hard mash or a third finger bring up the system undo prompt?
10. **Rhythm:** are hits judged LATE on the phone speaker, and by how much with Bluetooth earbuds? Is the offset stable between sessions?
11. **Is 16 CSS px dialogue readable at arm's length in a Safari tab (340 px tall)**, and how many lines overflow the taller box?
12. **Frame rate and heat** in the Hub, plane, colon and Concept finale on real GPUs (the audit's numbers are software rendering), at 60 and 120 Hz and in Low Power Mode.
13. **Bottom 21 px:** do taps there register reliably in the home-screen app?
14. **Home-screen app on iOS 26.0 and 26.1:** does music restart after re-opening? Record the iOS version of every test phone.
15. **Wake lock** in the home-screen app on the test iPhone's iOS version.
16. **Android storage:** does an installed app share saves with Chrome (expected, not verified by this research)?
17. **In-app browsers** (WhatsApp, Messenger, Instagram): viewport, audio and storage behaviour when the link is opened from the group chat.
18. **Android vibration length:** is 15 to 25 ms actually felt on the lads' phones?
19. **Chapter Select password box** under the landscape keyboard (from the audit).
20. **SMART split:** do first-time players find SPECIAL and READY without being told, and is a four-way ring enough?

---

## 6. Sources

Keys marked (U) were cited by a researcher but not opened by a checker.

**Platform guidance and research**
- A-GC https://developer.apple.com/design/human-interface-guidelines/game-controls
- A-DFG https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- A-ACC https://developer.apple.com/design/human-interface-guidelines/accessibility
- A-GES https://developer.apple.com/design/human-interface-guidelines/gestures
- A-HAP https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- A-ONB https://developer.apple.com/design/human-interface-guidelines/onboarding
- A-SCR https://developer.apple.com/design/human-interface-guidelines/scroll-views
- A-W26 https://developer.apple.com/videos/play/wwdc2026/358/
- A-W24 https://developer.apple.com/videos/play/wwdc2024/10085/
- A-HH https://developer.apple.com/videos/play/meet-with-apple/243
- A-LP https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/minimumpressduration
- G-TT https://support.google.com/accessibility/android/answer/7101858
- AND-VC https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/view/ViewConfiguration.java
- AND-GN https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav
- AND-IM https://developer.android.com/develop/ui/views/layout/immersive
- X-107 https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107
- X-101 https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101
- X-104 https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/104
- TAK-WHEEL https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/system/touchadaptationkit/layout/game-streaming-touch-wheel?view=gdk-2610
- TAK-BTN https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/system/touchadaptationkit/controls/game-streaming-touch-button?view=gdk-2610
- TAK-JOY https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/system/touchadaptationkit/controls/game-streaming-touch-joystick?view=gdk-2610
- TAK-DZ https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/system/touchadaptationkit/types/game-streaming-touch-deadzone?view=gdk-2610
- TAK-STATE https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-touch-changing-layouts-game-state?view=gdk-2610
- TAK-SCHEMA https://github.com/microsoft/xbox-game-streaming-tools/blob/main/touch-adaptation-kit/schemas/layout/v4.2/layout.json
- TAK-RULES https://github.com/microsoft/xbox-game-streaming-tools/blob/main/touch-adaptation-kit/copilot-instructions/copilot-instructions.md
- GAG-SIZE https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/
- GAG-SUB https://gameaccessibilityguidelines.com/if-any-subtitles-captions-are-used-present-them-in-a-clear-easy-to-read-way/
- GAG-MASH https://gameaccessibilityguidelines.com/avoid-repeated-inputs-button-mashing-quick-time-events/
- GAG-SKIP https://gameaccessibilityguidelines.com/offer-a-means-to-bypass-gameplay-elements-that-arent-part-of-the-core-mechanic-via-settings-or-in-game-skip-option/
- WCAG-TS https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG-DRAG https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- WCAG-PTR https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html
- VALVE https://partner.steamgames.com/doc/steamdeck/compat
- BBC https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/
- NFX https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide
- HAM https://www.gamedeveloper.com/audio/how-to-do-subtitles-well-basics-and-good-practices
- PARHI https://www.cs.umd.edu/hcil/trs/2006-11/2006-11.htm
- BALD https://publications.ait.ac.at/en/publications/investigating-on-screen-gamepad-designs-for-smartphone-controlled/
- RH https://www.gamedeveloper.com/design/everything-i-learned-about-dual-stick-shooter-controls
- KER https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers
- AGAWI https://www.imore.com/iphone-5-touchscreen-latency-measured-found-be-25-times-faster-closest-android-device

**Action games and ports**
- DC https://www.gamedeveloper.com/design/porting-i-dead-cells-i-to-mobile-an-in-depth-breakdown (same text in translation: https://habr.com/en/articles/451120)
- DC-STORE https://apps.apple.com/gb/app/dead-cells/id1389752090
- DC-STEAM https://steamcommunity.com/games/588650/announcements/detail/3346752589077077088
- DC-MS https://www.macstories.net/reviews/game-day-dead-cells/
- DC-80LV https://80.lv/articles/dead-cells-hidden-tricks-that-make-the-game-feel-fair
- BS-WIKI https://brawlstars.fandom.com/wiki/Beginner%27s_Guide
- BS-G8 https://game8.co/games/Brawl-Stars/archives/316910
- BS-DOF https://deconstructoroffun.com/blog/2018/5/11/bs
- BS-DTF https://dtf.ru/gamedev/57819-razrabotka-sistemy-upravleniya-i-progressa-opyt-sozdatelei-brawl-stars
- SK https://soul-knight.fandom.com/wiki/Controls
- SK-GM https://soul-knight.fandom.com/wiki/Game_Mechanics
- DI-TR https://www.techradar.com/news/ive-played-diablo-immortal-how-blizzards-dark-action-rpg-plays-on-smartphones
- DI-FX https://diabloimmortal.wiki.fextralife.com/Controls
- DI-DOG https://www.denofgeek.com/games/diablo-immortal-control-options-supported-controllers-mouse-keyboard
- DI-BLZ https://news.blizzard.com/en-us/article/23805083
- HD-SN https://www.shacknews.com/article/139166/hades-ios-netflix-games-impressions
- HD-PG https://www.pocketgamer.com/hades/review/
- HD-ENG https://www.engadget.com/hades-hits-ios-as-a-netflix-mobile-exclusive-on-march-19-170014127.html
- HD-SG https://www.supergiantgames.com/blog/hades-netflix-games-ios-now-available/
- IS-PG https://www.pocketgamer.com/articles/072698/the-binding-of-isaac-rebirth-review-a-solid-port-of-the-addictive-roguelike-shooter/
- IS-MW https://www.macworld.com/article/3159116/the-binding-of-isaac-rebirth-is-a-provocative-and-heart-pumping-dungeon-shooter.html
- GG-ED https://apps.apple.com/am/iphone/story/id1826888519
- GG-US https://game-solver.com/enter-the-gungeon/
- GG-STORE https://apps.apple.com/us/app/enter-the-gungeon/id1100429641
- GG-PLAY https://play.google.com/store/apps/details?id=com.devolverdigital.enterthegungeon&hl=en_US
- VS-CSM https://www.commonsensemedia.org/app-reviews/vampire-survivors
- VS-PG https://www.pocketgamer.com/vampire-survivors/review/
- BA https://www.supergiantgames.com/blog/out-now-bastion-for-ipad/
- BA-PG https://www.pocketgamer.com/bastion/review/
- TRN https://mobilesyrup.com/2015/06/28/transistor-review-some-pc-to-mobile-ports-shouldnt-happen/
- MD-SET https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/ui/dialogs/SettingsMenuDialog.java
- MD-IN https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/input/MobileInput.java
- DX https://github.com/diasurgical/devilutionX/blob/master/Source/controls/touch/gamepad.cpp
- SU https://github.com/HasangerGames/suroi/blob/master/client/src/scripts/managers/inputManager.ts
- SU-VAR https://github.com/HasangerGames/suroi/blob/master/client/src/scripts/console/variables.ts
- PR-CSS https://github.com/pagefaultgames/pokerogue/blob/main/index.css
- PR-TC https://github.com/pagefaultgames/pokerogue/blob/main/src/touch-controls.ts
- TR-INTRO https://forums.terraria.org/index.php?threads/terraria-mobile-1-3-controls-an-introduction.82198/
- TR-CUST https://forums.terraria.org/index.php?threads/youve-got-the-touch-youve-got-the-power-controller-customization-update-hits-mobile-terraria-today.87000/
- TR-PET https://www.change.org/p/terraria-developers-make-an-option-in-terraria-to-revert-to-normal-controls
- SV https://stardewvalleywiki.com/Mobile_Controls
- SV-MR https://www.macrumors.com/2018/11/13/stardew-valley-update-new-control-options
- MC-CTL https://minecraft.wiki/w/Controls
- MC-31 https://minecraft.wiki/w/Bedrock_Edition_1.19.31
- MC-40P https://minecraft.wiki/w/Bedrock_Edition_Preview_1.19.40.20
- MC-50 https://minecraft.wiki/w/Bedrock_Edition_1.19.50
- MC-60 https://minecraft.wiki/w/Bedrock_Edition_1.19.60
- MC-2040 https://minecraft.wiki/w/Bedrock_Edition_1.20.40
- PP https://dukope.com/devlogs/papers-please/mobile/
- HLD https://www.gamezebo.com/reviews/hyper-light-drifter-mobile-review-how-does-it-play-on-iphone-and-ipad/
- HU https://www.pocketgamer.com/huntdown/review/
- SOR-PG https://www.pocketgamer.com/streets-of-rage-4/review/
- DD-PG https://www.pocketgamer.com/deaths-door/review/
- KZ-PG https://www.pocketgamer.com/katana-zero/review/
- SOS https://www.cubed3.com/games/reviews/mobile/sea-of-stars-1
- DRC https://www.pocketgamer.com/death-road-to-canada/death-road-to-canada-review-a-brilliant-mobile-port-of-a-must-play-game/
- BAL https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html
- STS-R https://jlericson.netlify.app/2021/03/04/slay_the_spire_ios and https://apps.apple.com/us/app/slay-the-spire/id1491530147
- BG2 https://apps.apple.com/us/app/baldurs-gate-ii-ee/id633625517
- GTA-SA https://apps.apple.com/us/app/grand-theft-auto-san-andreas/id763692274
- GTA-VC https://apps.apple.com/us/app/grand-theft-auto-vice-city/id578448682
- GTA-3 https://apps.apple.com/us/app/grand-theft-auto-iii/id479662730
- 80D https://www.gamezebo.com/reviews/80-days-review-were-going-on-an-adventure/
- (U) TouchArcade pages not opened by any checker: Hades review https://toucharcade.com/2024/03/20/hades-ios-review-2024-controller-support-cloud-saves-vs-switch-steam-deck-netflix-games/ ; Neon Chrome https://web.archive.org/web/2019/https://toucharcade.com/?p=205997 ; Time Recoil thread https://web.archive.org/web/2019/https://toucharcade.com/community/threads/312864 ; Tesla vs Lovecraft https://web.archive.org/web/2020/https://toucharcade.com/2018/10/25/tesla-vs-lovecraft-review/ ; Exit the Gungeon thread https://web.archive.org/web/2023/https://toucharcade.com/community/threads/400756 ; Space Marshals https://web.archive.org/web/2019/https://toucharcade.com/?p=163640

**Platformers and jump feel**
- ST https://github.com/SuperTux/supertux/blob/master/src/control/mobile_controller.cpp
- RB-JUMP https://github.com/Roblox/Core-Scripts/blob/master/PlayerScripts/StarterPlayerScripts/ControlScript/MasterControl/TouchJump.lua
- RB-DYN https://github.com/Roblox/Core-Scripts/blob/master/PlayerScripts/StarterPlayerScripts/ControlScript/MasterControl/DynamicThumbstick.lua
- RB-THUMB https://github.com/Roblox/Core-Scripts/blob/master/PlayerScripts/StarterPlayerScripts/ControlScript/MasterControl/Thumbstick.lua
- RB-POS https://github.com/Roblox/creator-docs/blob/main/content/en-us/ui/position-and-size.md
- CE https://raw.githubusercontent.com/NoelFB/Celeste/master/Source/Player/Player.cs
- GDQ https://www.gdquest.com/library/glossary/coyote_time
- GDV https://wiki.gdevelop.io/gdevelop5/extensions/advanced-jump/
- MCAT https://megacatstudios.com/blogs/game-development/simultaneous-inputs-button-timing-buffering-for-mobile
- SMR https://www.vice.com/en/article/shigeru-miyamoto-on-designing-mario-for-mobile-in-super-mario-run/
- MS2 https://apps.apple.com/app/id589779009
- MM-AC https://www.androidcentral.com/mega-man-mobile-series-android-review
- MM-KO https://kotaku.com/mega-mans-new-mobile-ports-are-garbage-1790808848
- LU-SET https://github.com/luanti-org/luanti/blob/master/builtin/settingtypes.txt
- LU-LAY https://github.com/luanti-org/luanti/blob/master/src/gui/touchscreenlayout.cpp
- PS https://github.com/hrydgard/ppsspp/blob/master/Core/Config.cpp
- NJ https://github.com/yoannmoinet/nipplejs
- REX https://github.com/rexrainbow/phaser3-rex-notes/blob/master/docs/docs/virtualjoystick.md
- GD https://github.com/godotengine/godot-docs/blob/master/classes/class_virtualjoystick.rst

**Dialogue, minigames, rhythm, driving**
- RP-GUI https://raw.githubusercontent.com/renpy/renpy/master/gui/game/gui.rpy
- RP-SCR https://raw.githubusercontent.com/renpy/renpy/master/gui/game/screens.rpy
- RP-PREF https://www.renpy.org/doc/html/preferences.html
- RP-CFG https://www.renpy.org/doc/html/config.html
- AA https://en.wikipedia.org/wiki/Phoenix_Wright:_Ace_Attorney_Trilogy
- AA-NWR https://www.nintendoworldreport.com/review/49872/phoenix-wright-ace-attorney-trilogy-switch-review
- AA-PS https://www.pushsquare.com/news/2025/09/phoenix-wright-trilogy-ps4-update-brings-it-up-to-speed-with-the-other-ace-attorney-games
- DE-NL https://www.nintendolife.com/reviews/switch-eshop/disco-elysium-the-final-cut
- DE-IGN https://www.ign.com/articles/official-disco-elysium-mobile-version-announced-zaum-calls-it-a-fun-on-the-go-alternative-aimed-at-tiktok-users
- WW https://www.mariowiki.com/Microgame and https://www.mariowiki.com/WarioWare:_Touched!
- MP https://www.mariowiki.com/Super_Mario_Party
- RHV https://en.wikipedia.org/wiki/Rhythm_Heaven
- RR3 https://en.wikipedia.org/wiki/Real_Racing_3
- A8 https://en.wikipedia.org/wiki/Asphalt_8:_Airborne
- A9 https://en.wikipedia.org/wiki/Asphalt_9:_Legends
- MKT https://www.mariowiki.com/Mario_Kart_Tour
- FNF-SC https://github.com/FunkinCrew/Funkin/blob/main/source/funkin/play/scoring/Scoring.hx
- FNF-CL https://github.com/FunkinCrew/Funkin/blob/main/CHANGELOG.md
- FNF-HB https://github.com/FunkinCrew/Funkin/blob/main/source/funkin/mobile/ui/FunkinHitbox.hx
- FNF-PREF https://github.com/FunkinCrew/Funkin/blob/main/source/funkin/Preferences.hx
- FNF-BLOG https://funkin.me/blog/2025-07-21/
- OSU-OFF https://github.com/ppy/osu/blob/master/osu.Game/Overlays/Settings/Sections/Audio/AudioOffsetAdjustControl.cs
- SM-P https://github.com/stepmania/stepmania/blob/5_1-new/src/Player.cpp
- SM-AS https://github.com/stepmania/stepmania/blob/5_1-new/src/AdjustSync.cpp
- PHI https://github.com/TeamFlos/phira/blob/main/prpr/src/judge.rs
- PHI-CFG https://github.com/TeamFlos/phira/blob/main/prpr/src/config.rs
- SEK https://github.com/NonSpicyBurrito/sonolus-pjsekai-engine/blob/main/shared/src/engine/data/windows.ts
- MOZ https://padenot.github.io/web-audio-perf/
- OBOE-U https://github.com/google/oboe/blob/main/apps/OboeTester/docs/Usage.md
- OBOE-BT https://github.com/google/oboe/wiki/TechNote_BluetoothAudio
- RQ https://rhythmquestgame.com/devlog/10.html

**Phone browsers**
- WK-268816 https://bugs.webkit.org/show_bug.cgi?id=268816
- WK-227636 https://bugs.webkit.org/show_bug.cgi?id=227636
- WK-291677 https://bugs.webkit.org/show_bug.cgi?id=291677
- WK-290623 https://bugs.webkit.org/show_bug.cgi?id=290623
- WK-300782 https://bugs.webkit.org/show_bug.cgi?id=300782
- WK-241478 https://bugs.webkit.org/show_bug.cgi?id=241478
- WK-189337 https://bugs.webkit.org/show_bug.cgi?id=189337
- WK-206854 https://bugs.webkit.org/show_bug.cgi?id=206854
- WK-257695 https://bugs.webkit.org/show_bug.cgi?id=257695
- WK-181849 https://bugs.webkit.org/show_bug.cgi?id=181849
- WK-215745 https://bugs.webkit.org/show_bug.cgi?id=215745
- WK-294338 https://bugs.webkit.org/show_bug.cgi?id=294338
- WK-231161 https://bugs.webkit.org/show_bug.cgi?id=231161
- WK-237322 https://bugs.webkit.org/show_bug.cgi?id=237322
- WK-203435 https://bugs.webkit.org/show_bug.cgi?id=203435
- WK-260412 https://bugs.webkit.org/show_bug.cgi?id=260412
- WK-263627 https://bugs.webkit.org/show_bug.cgi?id=263627
- WK-276016 https://bugs.webkit.org/show_bug.cgi?id=276016
- WK-301824 https://bugs.webkit.org/show_bug.cgi?id=301824
- WK-ITP https://webkit.org/tracking-prevention/ and https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- WK-STO https://webkit.org/?p=14403
- WK-S26 https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- WK-UA https://webkit.org/blog/13862/the-user-activation-api/
- WK-VID https://webkit.org/blog/6784/new-video-policies-for-ios/
- WK-IOS10 https://webkit.org/?p=7367
- S174 https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes
- S184 https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes
- S262 https://developer.apple.com/documentation/safari-release-notes/safari-26_2-release-notes
- S27 https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes
- APF-737042 https://developer.apple.com/forums/thread/737042
- PH-CFG https://github.com/phaserjs/phaser/blob/v3.90.0/src/core/Config.js (and the installed `node_modules/phaser/src/input/touch/TouchManager.js`)
- PH-WORLD https://raw.githubusercontent.com/phaserjs/phaser/v3.90.0/src/physics/arcade/World.js
- PH-TEXT https://raw.githubusercontent.com/phaserjs/phaser/v3.80.1/src/gameobjects/text/Text.js
- PH-360M https://github.com/phaserjs/phaser/blob/v3.80.1/changelog/3.60/MobilePerformance.md
- PH-360T https://github.com/phaserjs/phaser/blob/v3.80.1/changelog/3.60/Timestep.md
- PH-380 https://github.com/phaserjs/phaser/blob/v3.80.1/changelog/3.80/WebGLContextRestore.md
- PH-386 https://phaser.io/news/2024/10/phaser-v3860-released
- PH-5696 https://github.com/phaserjs/phaser/issues/5696
- PH-6829 https://github.com/phaserjs/phaser/issues/6829
- PH-FAQ https://github.com/samme/phaser3-faq/wiki/Loading-assets
- PH-FORUM https://phaser.discourse.group/t/a-problem-repeatedly-occurred-on-a-safari-phaser-3-iphone/13983
- PC-FORUM https://forum.playcanvas.com/t/running-out-of-vram-on-ios/30225?page=2
- MDN-NAV, MDN-GP, MDN-WL (vibrate, getGamepads, wakeLock) https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json ; gamepad behaviour: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
- MDN-EL https://github.com/mdn/browser-compat-data/blob/main/api/Element.json
- MDN-SO https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json
- MDN-MAN https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/orientation.json
- MDN-AC https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json
- MDN-ME https://github.com/mdn/browser-compat-data/blob/main/api/HTMLMediaElement.json
- MDN-AS https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API
- MDN-PC https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
- MDN-TA https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- PE https://w3c.github.io/pointerevents/
- PQ-NAV https://pqina.nl/blog/blocking-navigation-gestures-on-ios-13-4/
- PQ-CAN https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/
- HOWL https://github.com/goldfire/howler.js/blob/master/README.md
- IOSH https://github.com/tijnjh/ios-haptics
- YT https://developers.google.com/youtube/gaming/playables/certification/requirements_stability
- CG https://docs.crazygames.com/requirements/technical/
- WB https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video
- LLB https://github.com/leehack/llama-web-bridge/issues/257
- EJS https://github.com/EmulatorJS/EmulatorJS/issues/1220

**Local context read**
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile_audit/MOBILE_AUDIT.md (sections 1 to 10)
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/reports/00-USER-PRIORITIES.md
- /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt/src/game/combat/Player.ts, Controls.ts; scenes/DungeonScene.ts; scenes/side/SideLevel.ts; audio/Synth.ts, Voice.ts; crashGuard.ts; src/main.ts (read only)
