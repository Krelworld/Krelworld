# s2-01 · Phone fights, part 1: the top-down rooms, the bosses and the phone HUD

Branch `mobile` (worktree `scratchpad/mobile-wt`), on top of `e8cf3f4f`. Commits (nothing pushed, no PR):

| Commit | What changed for the player |
|---|---|
| `a8f15076` | Top-down rooms and bosses get thumb controls: FIRE with auto-fire and slide-to-aim, DODGE, SWAP, SPECIAL, READY, HEAL, ACTION, the weapon chip, the drink chips, the WONK mash overlay, the phone HUD, phone assist, captions for the first fights; the game's "Touch aim assist" row hidden on phones; Auto-fire / Aim assist / Phone assist work live |
| `a1d6f030` | READY never sits on pause or the drink chips with big buttons; gun names fit the chip; two smoke-test fixes |
| `d0e089d8` | The finale's "walk up, press E" toast says "tap ACTION"; the fight wording rows in a pure module with unit tests |
| `c65091f4` | No buttons during long freezes (the golden cut-in, a boss's phase break) instead of queued presses; Mikey's SANMIK chip only when the game would let him swap; smoke covers GOLD, CUME, bongo and SanMik |

Laptops, touchscreen laptops, iPads, Android tablets and the Fire 7 are unchanged: every hook outside
`src/game/mobile/` is behind `isMobile()`, and the phone chunk lends its hooks through `boot.ts`'s `phoneHooks()`,
which is null on anything that is not a phone. The fingerprint runs prove it (see "Checks").

---

## 1. Ground truth: everything a laptop player can do in a fight, and where it is on a phone

Read from `Controls.ts`, `keybinds.ts`, `Player.ts`, `Super.ts`, `Farts.ts`, `Wonk.ts`, `GroupWonk.ts`, `Guns.ts`,
`data/guns.ts`, `WeaponPickScene.ts`, `DungeonScene.ts`, `Spice.ts`, `UIScene.ts` and `TouchControls.ts`.

| Action (laptop key) | What it does in the game | Phone |
|---|---|---|
| Move (W A S D / arrows; pad left stick) | walk; the dodge goes where you move | the floating stick, left 45% of the screen, black gutter included (P9) |
| Aim (mouse; pad right stick) | aim angle; lobbed attacks and Mikey's NUKE land on the aim point | auto-aim (target ring) or FIRE's slide; `Controls.aim/aimPoint` hooks |
| Attack (hold left mouse / J) | fires the gun in hand, or the Fart Blaster; golden: the 3-hit lunging melee combo; when a gun runs dry the game moves to the next gun with ammo | **FIRE** (hold), plus **auto-fire** |
| Dodge (Space / Shift) | dash with i-frames; a hit in the i-frames is a PERFECT DODGE | **DODGE** |
| Special (right mouse / F / K) | the lad's signature move, costs Krezz (troll fight: a free HEADBUTT) | **SPECIAL**, named for each lad |
| Interact (E) | hostages ("Untie"), machines, vending, talkers, the loaner rack, TV, reading | **ACTION** (pops in with the verb), or tap the prompt over your head |
| Pussy juice (Q) | +45 HP, gets you wonky | **HEAL** (pops in under 40%) and the **🍼 chip** |
| Fizzy bongo (B) | a 30 s buff (+15% damage), intoxication | the **🍺 chip** (only when you have one) |
| Wonk Your Thang (R / L; full WONK meter) | the WONK gauge mash minigame, then the krezz beam | **READY → WONK!**, then the **mash overlay** |
| Fart (G; meter levels 1 to 4) | a fart of the current level; level 4 is the IBS ATTACK | **READY → IBS!** at level 4; the **💨 chip** at any level |
| Swap gun (X: tap = next loaded gun, hold 260 ms = the slow-motion picker) | the weapon card; the picker grid of every weapon | **SWAP** and the **weapon chip** (tap = next, hold 300 ms = picker; slide onto a gun) |
| Weapon picker (click / tap a card, arrows + Space, 1 to 9, let go of X, Esc) | picks, or cancels | tap a card, or slide the SWAP/chip thumb onto one and let go; **CLOSE** where FIRE was |
| Golden transformation (T; golden juice drunk; once per dungeon) | 13 s golden form (melee combo, half damage) | **READY → GOLD** |
| Cumehameha (C; while golden, 5 s cooldown) | the beam | **READY → CUME** |
| Mikey ⇄ SanMik (V; as Mikey, not in the SanMikverse) | swap forms | the **SANMIK chip** |
| Pause (Esc / pad Start) | the pause menu | the layer's **II** (top right) |
| WONK gauge / roof group wonk (R / Space / E / click / pad) | flap the gauge / pump | any finger anywhere (the mash overlay) |
| Grappled (mash Dodge or Attack, 7 presses) | escape | DODGE or FIRE (auto-fire counts too) |
| Passive: fairy revive, companions, Krezz-Assist perk (lock-on) | automatic | unchanged; on a phone the perk's lock-on is subsumed by phone aiming |
| Kreltality prompt (K / Esc, after a boss) | a finisher | stage 2 part 2 (the scene is "busy": no fight buttons over it, taps reach its buttons) |

Every weapon: the Fart Blaster (infinite, range 400) and 20 guns (`GUN_ORDER`): crate guns pistol, smg, shotgun, rail,
rocket; shop guns gatling, sniper, flamer, bfk; Kreddle guns chem_flamer, chainsaw, kreddler, disco, flush, slots,
roulette, chips, loan, dice; Boggor's boggor_lens. Ranges 70 (chainsaw) to 1000 (sniper). Auto-fire reads each gun's
own modded range (`moddedGun`, `moddedFart`), so every gun auto-fires at its own reach; empty guns go through the
game's own auto-switch. The "specials-ready glowing key prompts" (`showPop` over the player's head, the keycap tray)
are covered in the HUD section.

## 2. The slot map (layout v2), iPhone 14 landscape with its safe areas (47 / 47 / 21)

Offsets from the bottom-right safe corner at scale 1, `clamp(h / 390, 0.85, 1.15)` x S/M/L; mirrored for left-handed.
Drawn sizes; touch areas are the drawing + 20 px (the cluster's shared surface, below).

| Slot | Centre (844x390) | Size | Control | Shows |
|---|---|---|---|---|
| prime | (745, 317) | 84 | **FIRE** (crosshair; red glow while auto-firing, a flash per shot). Touch area runs to the screen's corner (844, 369) | always |
| left | (649, 325) | 60 | **SWAP** (⇄) | more than one weapon with ammo |
| upLeft | (675, 243) | 60 | **DODGE** (») | always |
| up | (754, 219) | 60 | **SPECIAL** (the lad's word; Krezz fill; dim when it can't go) | always |
| ready | (754, 143) | 60 | **READY** (gold: WONK! / GOLD / CUME / IBS!) | a meter ability is ready (pops in, pulses) |
| heal | (679, 165) | 56 | **HEAL** (bottle + count) | health under 40% and juice to drink (pops in) |
| combatAction | (585, 265) | 56 | **ACTION** (the verb) | a prompt is up (pops in) |
| pause | (771, 32) | 52 | **II** | always |
| top, 24 px left of pause | (651, 28) | 140 x 44 | **weapon chip** (gun icon, name, ammo; red when empty). Touch area up to the top edge | always |
| under the health bars | from (123, 44) | 64 / 56 / 98 / 76 x 32 | **🍼 2/3**, **🍺 1**, **💨 BEANS**, **SANMIK** | juice always (dim at full health or none), the rest when they can do something |
| prime (picker only) | (745, 317) | 84 | **CLOSE** ✕ | while the weapon picker is up |
| whole screen | | | the **mash overlay** | the WONK gauge or the roof's group wonk |

UP and READY sit 9 px further in than layout v2's (763, ...) because stage 1's Dynamic Island rule keeps every drawing
60 px from a short edge between 30% and 70% of the height. Permanent controls over the picture: FIRE, DODGE, SPECIAL
(+ SWAP once you have a gun), down from the old pad's twelve.

**The cluster's shared surface (research M3, DEFERRED R8 remainder).** FIRE, DODGE, SWAP, SPECIAL, READY, HEAL and
ACTION are one group (`ControlSpec.group`). Each element reaches 20 px past its drawing; a touch that lands on one goes
to the control whose centre is nearest when it is inside several drawings + 10 px, else to the control whose drawing
is nearest within 20 px (`routeTouch`, layout.ts). So there is no dead space between buttons, and overlaps go to the
nearest centre. FIRE, DODGE, SPECIAL, READY, HEAL act on touch-down. A control under a thumb stays, and stays live,
until the thumb lifts, even if the mode moves on. Pop-ins ignore presses for 160 ms (S11); READY ignores presses for
300 ms after its word changes and never changes its word under a thumb (S1). During a long freeze (more than 400 ms of
hit-stop left: the golden transformation's cut-in, a boss's phase break) the fight buttons hide instead of queueing
presses for afterwards; SANMIK only shows when the game would let Mikey swap (not while golden).

**Holds (S11):** SWAP and the chip recognise a hold at 300 ms; a thumb that moves 12 px before that cancels (neither a
tap nor the picker). The game's own slow motion starts the moment the thumb lands (as the laptop's X does).

**The weapon picker** is the game's own slow-motion picker (big cards, a short list of what you own). Slide the thumb
that opened it onto a card and let go to pick it; let go anywhere else and it stays up for a tap, with CLOSE where FIRE
was (the game's ✕ is 19 x 16 CSS px). The how-to line reads "Tap one, or slide onto one and let go · ✕ to close".

## 3. Aiming and auto-fire

`aim.ts` (pure, unit-tested), run inside the Dungeon's frame just before the player moves (`combatStep` hook), so FIRE
and auto-fire act that same frame:

- **Target**: the nearest enemy within 520 world px and on screen (alive, active, visible, alpha > 0.3), scored
  `distance x (1 - bias x cos(angle between it and the stick))`; sticky (another must score under `keep` x the
  current one). With no enemy, holding FIRE aims at the nearest barrel or crate (never a hostage: shots don't free them).
  A red ring at the target's feet (orange for an object), brighter while firing.
- **Slide**: 24 px from where the thumb landed on FIRE = aim along the slide, with an aim line; within 15° (normal) /
  25° (strong) of an enemy it snaps onto it and the line turns gold; back inside 24 px = auto-aim again.
- **Auto-fire** (`autoFire`, on by default in top-down rooms for the first device test, M1): only at an enemy in the
  weapon's own range and on screen, and never if a live barrel within 115 px of you lies in the line (a barrel hurts
  you within 80 px when it blows). Never at barrels or crates, never a special, never in the mash overlay, the
  picker, the pause menu, a conversation or a scripted moment (`busy`), and never while golden (the golden attack is a
  lunging melee: auto-fire never moves you). Shots in this game fly through pillars and furniture, so "clear line"
  means on screen and no barrel by your feet. In a room whose decree bans holding the trigger (NO_ATTACK_SPAM, 2.5 s),
  auto-fire lets go for 160 ms every 2 s, the way a laptop player taps.
- **FIRE by hand**: hold fires regardless of target (straight ahead with nothing to aim at); with auto-fire off the
  stream carries on 200 ms after the thumb lifts (measured in the page: last firing frame 171 to 236 ms after the lift).

| `aimAssist` | bias | keep | snap | lead | FIRE held, nothing slid |
|---|---|---|---|---|---|
| off | 0 | 1 (none) | 0° | no | straight ahead (the last stick direction); auto-fire still aims at what it shoots |
| normal (default) | 0.35 | 0.6 | 15° | no | the target |
| strong | 0.5 | 0.45 | 25° | yes (shot speed, capped 0.6 s) | the target |

**The two switches (DEFERRED R8 item 7): decided as recommended.** On phones aiming reads only
`phoneSettings().aimAssist`; MenuScene hides its "Touch aim assist" row (and the Krezz-Assist auto-aim row, whose switch
would also do nothing on a phone) behind `isMobile()`. Tablets keep both. The Krezz-Assist perk's lock-on is bypassed on
phones (`combatStep` nulls `controls.autoAim`), because phone aiming already locks on and the slide must win.

## 4. Settings wired (live flags flipped in `PHONE_SETTINGS`)

| Setting | Default | What it does now |
|---|---|---|
| `autoFire` | on | as above (read every frame: flipping it mid-fight takes effect at once) |
| `aimAssist` | normal | as above |
| `phoneAssist` | on | the list below (help line: "Picks things up for you; kinder dodges and jumps.") |

## 5. Phone assist: exactly what it changes (`ASSIST` in combat.ts; top-down fights; never slows the game)

1. Pick-ups (coins, Krezz, health, ammo, bottles, bongos, crobleys; never quest items) start coming to you from 140
   world px instead of the game's 90, at 0.5 px/ms (the game's own pull, 0.4, still runs inside 90), and inside 60 px
   at 2 px/ms, so they are collected at once (S9 "auto-collect inside an enlarged pickup radius"; the audit said x1.5).
2. A dodge's i-frames last 60 ms longer (dodge length + 90 ms becomes + 150 ms; about the audit's x1.25 timing lever,
   for touch and frame delay). PERFECT DODGE still needs a hit inside the window, so this also makes it a little kinder.
3. Enemy bullets are drawn 1.25x bigger (visibility at the phone's 0.63 to 0.72 scale; their hit size is unchanged).

Not changed: damage, enemy numbers, speeds, telegraph lengths, game speed, the WONK gauge's timing (a tap anywhere is
already easy), any rhythm or QTE window. Part 2 adds the jump help under the same toggle.

## 6. The phone HUD (UIScene, behind `isMobile()`; DEFERRED P10)

- **No key hints** in phone fights (the tray, "[Q] heal", "[X] swap" were drawn because the old pad was the touch
  test); the gun readout at the bottom right (under FIRE) is hidden: the weapon chip shows it.
- **Top-left block at phone size**: HP numbers 15 game px (10.8 CSS); "KREZZ 32 / WONK 66%" beside the bars; a slim
  gold WONK bar under KREZZ (the keycap tray that shows WONK on a laptop isn't drawn on touch); money beside the name;
  the drink chips under the bars; fairy / intoxication / tap-rush status under the chips.
- **Specials-ready prompts** over the player's head say the touch button: "TAP WONK!" / "TAP IBS!" (was "TAP WONK" /
  "TAP 💨" on touch, the key on a laptop), while READY pops in pulsing.
- **Boss bar up top** between the HUD block and the weapon chip (it was at the bottom, under the thumbs and in the
  home-indicator strip); the room name gives way to the boss name.
- **Toasts** end left of pause, the fullscreen offer and the weapon chip, in town and in fights (in a top-down fight
  the chip's place is kept even before it shows); they start under the boss bar when there is one. Kreddle's money
  counter moves left of pause. (Town before: pause covered the toasts' right ends.)
- **The weapon card** after a swap shows up top (`cy` 132) instead of over the player.
- **See-through**: a control goes see-through in place while the player or the target is under it (the layer's
  `occluders`, set each frame).
- **Nothing in the stick zone takes a touch**: the drink chips' touch areas end at the zone's top (20% of the height);
  the prompt-bubble tap areas are clipped out of the zone (stage 1).

## 7. Feedback and first-time cues (M15, S10)

- Pressed state (stage 1's ring) on every control; a short flash on the button whose action just happened (each shot,
  including auto-fire's, a dodge, the special); the Android buzz (`haptic`: FIRE tap, DODGE / SPECIAL / HEAL press,
  READY big, mash taps).
- One-word captions under FIRE, DODGE, SWAP, SPECIAL, HEAL and READY for the first 3 rooms fought on this phone;
  READY pulses the first 3 times it pops in, HEAL the first 2, SWAP the first 2 times a gun runs dry
  (`storageKey("krelworld.phone.combatTaught")`).
- The first dungeon's how-to-play pages now name the phone's buttons (they described the old pad: "ATTACK button",
  "GUN button", "E button", "PJ button", "WONK button", "💨 button", "🍺 button", "⚡T, then CUME", "Esc pauses...").

## 8. Measured numbers (smoke test, `combat` section; CSS px)

| Screen | FIRE | DODGE / SWAP / SPECIAL / READY | HEAL / ACTION | weapon chip | drink chips | smallest gap between round controls | picture covered |
|---|---|---|---|---|---|---|---|
| 844x390 (iPhone 14, insets 47/47/21) | 84 | 60 | 56 | 140 x 44 | 64 / 56 / 98 / 76 x 32 | 16 (READY-SPECIAL, all shown); 23 in the measured state | 10.7% (FIRE, DODGE, SWAP, SPECIAL, pause, chip, 4 drink chips) |
| 750x340 (Safari with bars) | 73 | 52 | 52 | 122 x 44 | 56 / 49 / 85 / 66 x 30 | 14 | 8.6% (with READY) |
| 740x360 (small Android) | 78 | 55 | 52 | 129 x 44 | 59 / 52 / 90 / 70 x 30 | 15 | 9.2% (with READY) |

Worst case at 844x390 with every pop-in and chip up at once (FIRE, DODGE, SWAP, SPECIAL, READY, HEAL, ACTION, chip, all
four drink chips): about 14.6% of the picture, worked out from the drawn shapes. The old pad covered the lower-right
40% (audit). The unit tests check all seven cluster slots at the three sizes: every one at least 52 px, inside the safe
area, at least 12 px apart (16 at 844x390, as layout v2 says). Big buttons (L) on a 390 px screen: READY keeps 10 px
clear of pause (or, left-handed, of the drink chips) and of SPECIAL, shrinking to 62 px (52 left-handed).

## 9. Played by real touch (iPhone 14 profile, `work/s2-combat1/play.cjs`)

A scripted thumb: the stick steers (toward the nearest enemy, keeping 200 to 330 px, circle-strafing), auto-fire does
the shooting, DODGE when an enemy bullet is within 90 px, READY and HEAL pressed when they pop in, the WONK gauge
mashed by tapping anywhere. (CDP can only lift every finger at once, so a button press lifts the stick for ~0.1 s; the
"three thumbs" check in the smoke test covers true multi-touch. Walking to an exit door through furniture is the
harness's job: after 6 s of a clear room it puts the player at the door.)

| Run | Result |
|---|---|
| Wildern, new chapter 1 run (Fart Blaster only, through the tutorial pages) | room 1 cleared in 22 s (incl. the tutorial), room 2 in 30 s, room 3 in 58 s (two HEALs at 32 and 21 HP, WONK and IBS from READY, 32 dodges); the boss (Krandall) killed the scripted thumb twice in 5 minutes |
| Krandall again with the chapter 2 kit (DebugSkip's boss jump: guns) | the boss went down in under a minute; no deaths |

What I looked for in the screenshots (`shots/s2-combat1/play-*`, `boss-*`, `smoke/combat-*`) and changed:
- **Fixed**: CUME offered (and SANMIK, which the game refuses while golden) during the golden transformation's 4.4 s
  cut-in, when nothing can be pressed; toasts appearing behind the weapon chip at a room's start (they were placed
  before the chip showed);
  READY overlapping pause / the drink chips at size L; "Fart Bla..." / "CABBAG" cut off; a stray "WONK 0%" after the
  gauge (a late tap); SWAP's slow motion easing back twice after the picker; the HUD texts re-rendering twice a frame.
- **Not covering the action**: the cluster stays in the lower-right sixth; the player passing under DODGE / SWAP turns
  them see-through; the boss bar and weapon card moved off the player.
- **Still worth a device check**: the right thumb's reach from FIRE to READY (150 px up) on a small phone; whether
  auto-fire wastes scarce ammo (the BFK has 6 shots: research open question 1); KREZZ / WONK labels are 8 CSS px until
  the readability floor is on; a long boss name with its shield tag overlaps the left HUD's labels by a few pixels.

**Judged against "mega intuitive and fun"**: a first-time player moves with the left thumb (where the town taught it)
and the game shoots for them at once; the right thumb has three big obvious buttons with words under them, and the rare
things pop in, gold and pulsing, exactly when they can be used, with "TAP WONK!" over your head. Nothing needs a hold
or a gesture to be found except the picker (and SWAP's tap does the job without it). It feels like a phone shooter
rather than a keyboard with buttons glued on. Not yet there: the boss is harder for a naive thumb than rooms are
(phone assist doesn't change damage), the HUD's small labels, and everything a real thumb on real glass can tell us.

## 10. Every hook outside `src/game/mobile/` (all behind `isMobile()`)

| File | Hook | Why |
|---|---|---|
| `src/game/combat/Controls.ts` | imports `isMobile` (flag.ts) and `phoneHooks` (boot.ts); `aim()`: `if (isMobile()) { a = phoneHooks()?.aim?.(scene, px, py); if (a != null) return a; }`; `aimPoint()`: the same with `aimPoint` | the audit's one-line hooks: a DOM control never sets `activePointer.wasTouch`. Null (side rooms, no hook) leaves the game's own code |
| `src/game/scenes/DungeonScene.ts` | imports; `if (isMobile()) phoneHooks()?.combatStep?.(this, this.controls, dt);` before `player.update` | target, aim, auto-fire and phone assist inside the frame (no lag). Everything else is read and driven from outside |
| `src/game/scenes/UIScene.ts` | `setupTouch()`: the old pad isn't created on phones except in side rooms (`Dungeon.side`); `phoneFight()` and its helpers; `touch` includes `phone`; HP / KREZZ text and the stat line / money in an `if (phone) ... else` (one write each per frame); `TAP WONK!` / `TAP IBS!`; `gunT` hidden; the boss bar's coordinates through `bb` (laptop: 180 / 506 / 600 / 494); the room name under the boss bar; the toast column's x and top; the weapon card's `cy` | the phone HUD (P10, M16, S1) |
| `src/game/scenes/MenuScene.ts` | `if (isMobile()) { /* no row */ } else if (pk_autoaim) ... else if (TOUCH.enabled) ...` | R8 item 7 |

Inside the phone folder, stage 1 files changed: `touchLayer.ts` (group routing, `toCorner`, `place()`, captions,
`setHtml`, `armed` / `disarmFor`, `occluders`, the prompt bubble tappable in fights too, `state()` reports faces and
touch areas), `layout.ts` (`Placed.w/h`, `GAP_REACH`, `groupHit`, `routeTouch`, `edgeDistance`), `modes.ts` (`sub:
"mash"`), `observe.ts` (the Dungeon adapter reads `busy` / dying / changing rooms, and the mash overlay), `settings.ts`
(live flags), `boot.ts` (the `PhoneHooks` bridge), `index.ts` (installs the fights, `__krelMobile.combat`). New:
`combat.ts`, `aim.ts`, `combatLogic.ts`, `combatWording.ts`, `combatCss.ts`. `index.html`, `main.ts`'s scene list
and config, `tests/desktopInvariants.test.ts` and `tests/fingerprints/` are untouched.

## 11. Dialogue and touch wording

No dialogue or story text was changed, added or removed, and none of this code routes a dialogue line anywhere.

Touch wording added (phones only, UI hints, through `wordText` / `hint()`): the weapon picker's how-to line; the first
dungeon's how-to-play rows and its footer (`TutorialScene`, a UI screen); the Dungeon's interact prompt ("E: Untie
Mollor" → "Tap: Untie Mollor"; tapping it works in fights now, like walking); the finale's "INJECT THE LADS" toast
("(walk up, press E)" → "(walk up, tap ACTION)"; stage 1 already reworded it to "(walk up, Tap)").

Narrated control lines (the game's own voice, research rule 3's exception) that go through the dialogue box: I swapped
**none**. Rows are in the table for two of them, effective only where the dialogue code passes narrator control lines
through `hint()` (the menus / dialogue builder's narrator-tip mechanism; coordinator's call):
- `src/data/dungeons.ts:530` NARRATOR: "CONTROLS: WASD move · Mouse aim · Left click attack · Right click / F special ·
  Space dodge · Q pussy juice · B fizzy bongo · R Krezz Burst (full Wonk) · E interact · Esc pause" (Wildern's arrival)
  → "CONTROLS: drag on the left to move · FIRE shoots by itself (hold it to fire, slide it to aim) · DODGE, SPECIAL and
  SWAP on the right · WONK!, HEAL and the rest pop up when they're ready · II pause"
- `src/content/bosses.ts:531` (narration, `dir`): "TIP: Free the hostages (walk up, press E) before he gets to them.
  ... Mash ATTACK / DODGE if he gets you." → "(walk up, tap ACTION)" and "Mash FIRE / DODGE"

Other key-naming narration in fights, left for part 2 (side rooms): `dungeons.ts:512` "SIDE-ON CONTROLS: A / D to
run...", `content/citadel.ts:33` "RUN AND GUN: A / D move...", `content/citadel.ts:63` "CLIMB: W / SPACE jump...".
Not combat but noted: `content/raid.ts:20` (Kreddle raid), `content/arcs.ts:889-890` (playground), `arcs.ts:1244`.

**Character lines that mention a key**: none found in the fight content (`data/dungeons.ts`, `content/bosses.ts`,
`content/citadel.ts`, `content/finaleKrelford.ts`). The stage 1 list stands (Mikey's "Press V (or the SANMIK button)"
in town, unchanged).

## 12. Where I deviated from the research, and why

1. **SWAP's tap is the next gun, not the previously used one (S2).** It is what the laptop's X does, what the weapon
   card's ◀ ▶ shows, and the same rule as the chip's tap (the brief): one rule for both. Hold for the rest.
2. **Fart, bongo and SanMik are chips under the health bars, not a hold-ring on SPECIAL (S1).** They are the items the
   HUD already shows there, visible with counts, so nothing hides behind a gesture; and SPECIAL can act on touch-down
   instead of waiting to tell a tap from a hold. IBS (fart level 4) also pops in on READY.
3. **The picker is the game's own big-card picker** (the brief allows "a short list"), not a four-segment radial: it
   already lists exactly what you carry, slows the world and has 84 px cards. Slide-to-pick and CLOSE were added.
4. **The heal chip is under the bars, 32 px drawn / 44 touch**, not in the top row with a hit area to the top edge
   (M16): the top row holds the HUD block, toasts, the weapon chip and pause; HEAL popping in under the thumb is the
   main heal path (S3).
5. **Auto-fire is off while golden**, and "clear line" means on screen and no barrel by your feet (shots go through
   obstacles in this game).
6. **READY's order** adds IBS after WONK and GOLD; while golden only CUME.
7. **The cluster's surface** is per-control elements that reach 20 px and route by coordinates at touch-down, rather
   than one big element per side: the behaviour is M3's (nearest within 20 px, nearest centre on overlap, ownership
   by touch id), and touches that land nowhere near a control still reach the game.
8. **Pick-up radius 140** (the audit's x1.5 is 135); **dodge +60 ms** (no direct source; the audit's x1.25 timing).

## 13. Checks

All run on the final code by me, dev servers from this worktree (5202 normal, 5212 ALT).

| # | Check | Result |
|---|---|---|
| a1 | `desktop-fingerprint --check --only shell,front,newgame,hub,meeting,dungeon` (normal + ALT) | **40 of 40 identical, DESKTOP FINGERPRINT: OK** (after the last change to a game file) |
| a2 | `desktop-fingerprint --check --only boss,side,places,minigames,finale,alt` | **25 of 25 identical, DESKTOP FINGERPRINT: OK** |
| b | `--profile` touchlaptop / ipad / fire7 (front, newgame); androidtab (front, newgame, hub: the old pad pinned) | 16/16, 16/16, 16/16, 29/29: all **OK** |
| c | `npx vitest run tests/desktopInvariants.test.ts`; that file, `tests/fingerprints/` and `index.html` unedited (`git diff e8cf3f4f` empty) | **19 of 19**, unedited |
| d | `npx tsc --noEmit`; `npx vitest run` | clean; **427 tests, 40 files**, all pass (32 new in `mobileCombat.test.ts`) |
| e1 | `mobile-smoke.cjs --url http://localhost:5202/` (all sections, incl. the new `combat`) | **221 of 221, MOBILE SMOKE: OK** (499 s) |
| e2 | `mobile-smoke.cjs --url http://localhost:5212/` (ALT) | **221 of 221, MOBILE SMOKE: OK** (464 s) |
| f | Played by touch: Wildern rooms 1 to 3 and the boss (section 9) | rooms cleared; the boss beaten with the chapter 2 kit |

The fingerprint and profile runs were made after the last change to `UIScene`, `DungeonScene`, `Controls` and
`MenuScene`; the later commits only touch phone-chunk files (`combat.ts`), the smoke test and the README, which a laptop
never loads. Dev servers hit the session's two-hour limit late on; the final smoke runs start and stop their own server.

The `combat` smoke section (46 checks) on its own, final code: **46 of 46, MOBILE SMOKE: OK**. Its measured sizes are in
section 8. One stage 1 check (the fixed stick in Home) failed once because the earlier drags had left the player
against Home's right wall (frame timing); it now moves the player back first (no game change).

## 14. What part 2 (side rooms, jumping, brawls, finishers, controllers) should know

- **Side rooms**: `DUNGEON_RULE` (combatLogic.ts) returns `{ mode: "side", legacyPad: true }`; make it `legacyPad:
  false, stick: "x"` and register a `side` controller. Drop the `Dungeon.side` condition in `UIScene.setupTouch`.
  `UIScene.phoneFight()` then becomes true in side rooms too (no key hints, chips, boss bar up top): check the side
  rooms' own HUD placements (the run'n'gun tray at the top right is hidden on touch; the weapon card's `rng` branch).
- **Aim and fire**: `CombatControls.ours()` excludes side rooms, so `Controls.aim()` falls back to the game's touch path
  there; extend `aim` / `combatStep` (or chain `setPhoneHooks`) for facing + auto-aim. `combatStep` owns `TOUCH.attack`
  in top-down rooms only.
- **Controls**: mine are created once (`kt-c`, group `"rc"`), slots fixed (FIRE `prime`, SWAP `left`). Layout v2 puts
  JUMP in `prime` and FIRE in `left` in side rooms: `setSlot()` on the side mode's enter, or make side controls of
  your own in the same group. `toCorner` gives the prime corner its edge-to-edge touch area. The picker row
  (`PICKER_RULE`) returns null over side rooms.
- **The mash overlay** is detected in side rooms too (`sub: "mash"`), but the side branch ignores it today.
- **Kreltality / finishers** run while the Dungeon is `busy` → `mode: "none"` (fight buttons hidden, taps reach the
  canvas); their buttons are 32 px tall (M14 wants 48).
- **Phone assist** lives in `ASSIST`; the jump help goes under the same `phoneAssist`.
- **Gamepads (R11)** are untouched: a pad still drives the game, the touch controls stay drawn.
- The Kreddle raid and rout (fights inside a walking scene, with their own canvas FIRE button) were not touched.

## 15. Files

- Code: `src/game/mobile/{combat,aim,combatLogic,combatWording,combatCss}.ts` (new); `touchLayer.ts`, `layout.ts`,
  `modes.ts`, `observe.ts`, `settings.ts`, `boot.ts`, `index.ts`, `README.md` (the "Fights" section, the hook and mode
  tables); outside the folder `Controls.ts`, `DungeonScene.ts`, `UIScene.ts`, `MenuScene.ts`.
- Tests: `tests/mobileCombat.test.ts` (32 tests: aim, auto-fire, READY / HEAL / SPECIAL, tap / hold, the cluster at
  three sizes, gap routing, the Dungeon's mode rows, the fight wording); `scripts/mobile-smoke.cjs` `combat` section
  (and the `dungeon` section now expects the new controls).
- Scratch: `scratchpad/mobile/work/s2-combat1/` (`play.cjs`, logs). Screenshots: `scratchpad/mobile/shots/s2-combat1/`
  (`smoke/combat-*`, `play-*`, `boss-*`, `look5-*`).
