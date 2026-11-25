# Stage 2 polish: a calm fight screen (N1, the clutter point, N2, N4, N5)

Branch `mobile`, worktree `/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt`, started
from 5bb649ec. Every change is phone-only (the phone chunk, plus one guarded line in `PubScene.ts`). N3, N6 and N7 are
left as they were (deferred).

## The decision: one rule for the fight screen

The user's words: "in dungeons on right hand side of the screen you can see a bunch of bubbles for every potential
special even when they're not active ... making sure a good option is settled on for UI in the phone version".

**The rule (settled): a fight shows what a thumb needs all the time, and everything else only while it can be used
right now. Nothing is drawn dim "for later".**

- Always: the stick (it appears where the thumb lands; its idle drawing fades once you've walked), FIRE (or JUMP and
  FIRE in a side room), DODGE, the weapon chip (gun and ammo, tap = next gun), pause.
- Only while usable, popping in (and pulsing the first times where it matters):
  - **SPECIAL**: only once there is enough Krezz for it and no room decree bans it. Before: always on screen, dim with a
    fill while charging. That dim bubble is exactly the "bubble for a special that isn't active". The KREZZ bar up top
    still shows the charge; the button pops in (pulsing the first 2 times) the moment the special can go. The cost uses
    the game's own discounts (Mikey's and Kreblis's quest perks), so the button never appears for a press that fails.
  - **Juice chip**: only when a drink would heal and HEAL is not already on screen (one ability, one button, as P11 did
    for IBS). Before: always on screen, dim at full health.
  - Unchanged, already "only when usable": SWAP (a second weapon with ammo), READY (a meter ability is ready), HEAL
    (under 40% with juice), ACTION (a prompt), the bongo chip (a bongo to drink), the 💨 chip (level 1 to 3; at IBS
    READY has it), SANMIK (as Mikey, when the game allows the change).
- **Words inside the buttons, never captions under them** (N1, below).

Why this and not the other options: hiding by state is the only option that makes the screen calm *and* keeps every
ability one tap away the moment it matters, the way READY already works (the user pointed at READY as the model).
A dim "dormant" style still takes the space and still reads as a bubble at a glance; a smaller dormant style moves
targets about under the thumb. Hidden-until-usable keeps every button in its fixed slot (muscle memory) and just
leaves the slot empty. SWAP stays when there is a second gun, as the brief asked.

### Counts, measured (controls on screen, the stick included), before (5bb649ec) and after

Measured by the smoke's new `polish` section on the base source and on this branch, iPhone 14 844x390 with insets
47/47/21 and Android 740x360 (identical counts on both):

| Situation | Before | After | What went |
|---|---|---|---|
| Fresh top-down room, a new game's kit (40 Krezz, 2 juice, 1 bongo, Fart Blaster), full health | 8: pause, FIRE, DODGE, SPECIAL, gun chip, juice (dim), bongo, stick | 7: pause, FIRE, DODGE, SPECIAL (DASH can go at 40 Krezz), gun chip, bongo, stick | the dim juice chip |
| Same room, nothing left to use (Krezz spent, no bongo) | 7: pause, FIRE, DODGE, SPECIAL (dim), gun chip, juice (dim), stick | **5: pause, FIRE, DODGE, gun chip, stick** | the dim SPECIAL and the dim juice chip |
| Mid-game, everything charged (second gun, full Krezz, WONK full, beans, bongos, 30% health) | 12: + SWAP, SPECIAL, READY, HEAL, juice, bongo, 💨 | 11: the same without the juice chip (HEAL is up) | the duplicate juice chip |
| Boss (Krandall, chapter 2 kit) | 9: pause, FIRE, DODGE, SWAP, SPECIAL, gun chip, juice (dim), bongo, stick | 8: the same without the dim juice chip | the dim juice chip |
| Side room start (Catford High Street) | 9: pause, FIRE, JUMP, DODGE, SPECIAL, gun chip, juice (dim), bongo, stick | 8: the same without the dim juice chip | the dim juice chip |
| Finale brawl | 7 (5 buttons, II, stick), each with a caption that collided | 7, no captions | 6 colliding captions |

In every situation the "after" screen holds only things that do something if tapped now. The calm room (5) is what a
player sees most of the time between charges. The gate's `iphone-20-room.png` showed, all at once: a SPECIAL/NUKE stack
(button plus caption over FIRE's caption), the top-left chips with a dim juice chip, and the canvas weapon card. The
stack and the dim chip are gone; the weapon card (UIScene's `showWeaponCard`) is the game's own 1.7 s confirmation after a
swap (what you swapped to), it appears only after a swap and fades by itself, so it stays.

## N1: the captions (settled: the name inside the button)

Before: one-word captions under the buttons for the first 3 rooms. In the cluster's tight layout they printed on each
other in every fight type (measured before: FIRE's on SPECIAL's, DODGE's on FIRE, SWAP's on DODGE's, WONK's on SPECIAL;
in side rooms JUMP's on SPECIAL's and DODGE's on JUMP; in the brawl PUNCH's on KICK's, BLOCK's on VANISH's, VANISH's on
PUNCH, KI's on KICK; at 740x360 SPECIAL's even ran off the screen).

After: **no fight control has a caption outside its button.** For the first 3 rooms the icon buttons (FIRE, DODGE,
SWAP, JUMP, HEAL) show their name inside, under a slightly smaller icon (10.5 px bold with a shadow); after that the
icon alone. The worded buttons (SPECIAL's DASH / NUKE ..., READY's WONK! / GOLD / CUME / IBS!, ACTION's verb, the brawl's
PUNCH / BLOCK / VANISH / KICK / KI) already carry their word, so their duplicate captions are gone. The picker's ✕ reads
CLOSE inside it. A word inside its own button cannot land on a neighbour, the HUD or the home-indicator strip at any
screen size, button size (S/M/L) or with left-handed play, so this is the one approach that is clean by construction
rather than by a collision pass that would drop captions unpredictably.

Measured (smoke `polish`): at 844x390 (iPhone insets), 740x360, 750x340 and 932x430 (insets 59/59/21), for the fresh,
calm and mid-game rooms, the boss, the side room's start and the brawl: zero captions, every in-button word inside its
own face, no word over another control, no control face over another.

## The other findings

- **N2 (room name over the player's name and coins)**: `roomName.ts` fits the HUD's room line every frame (after the
  scenes update): if it doesn't fit where the game put it (centred at x 455) without touching the name, coins, health
  numbers or KREZZ / WONK lines on its height, or the gun chip, it is centred in the gap between them and shows the
  room's own name (the part after the last " · "), ellipsised if still too long, or nothing below 70 game px of room.
  No word is changed; out of a fight it is put back exactly as the game made it. Measured: "THE SANMIKVERSE (CATFORD,
  ALLEGEDLY) · Job Centre Plus (Catford Branch)" shows as "Job Centre Plus (Catford Branch)" between KREZZ and the gun
  chip at 844x390 and 740x360, touching nothing (before: over the name, coins, HP, KREZZ and the gun chip).
- **N4 (Krezz Arms Leave card)**: on phones the card is drawn 30 game px higher (one guarded line in PubScene).
  Measured: its drawing and touch area end at y 362.6 at 844x390 (strip from 369; before 384.2) and 334.7 at 740x360
  (strip from 339; before 354.7). At 750x340 (Safari with bars) it works out at y 316 (502 game px x 0.63; strip from 319), not measured.
- **N5 (JUMP at the side room's start)**: JUMP still goes see-through over a pit (the gap shows: background
  transparent), but now keeps full opacity, a 3 px green outline at 0.9 alpha with a thin dark edge, and its icon with a
  stronger shadow; for the first rooms its name JUMP is inside it. Measured at the start of Catford High Street: see-through
  yes, opacity 1 (before 0.7), border alpha 0.9 (before 0.28), 3 px (before 2), background alpha 0.
- **Controls picture**: SPECIAL's line now says it pops up once you've enough Krezz; SWAP's says it shows up with a
  second gun (UI help text, not dialogue).

## Dialogue and wording

No dialogue or story text was changed, added or removed. No narrator or system line was swapped in this round (so the
list of swapped lines is unchanged from stage 2; no new character line mentioning a key was touched). The room-name
fit only shortens or hides a HUD label (the room's name), never rewords it.

## Files

- `src/game/mobile/combatLogic.ts`: the calm-screen rules (`specialCost`, `specialWanted`, `juiceChipWanted`), READY
  without captions.
- `src/game/mobile/combat.ts`: SPECIAL and the juice chip by the rule, names inside the icon buttons (`taught`), the
  SPECIAL pulse, `snapshot().specialReady`, the room-name hook.
- `src/game/mobile/combatCss.ts`: the in-button names, JUMP's see-through outline, SPECIAL solid.
- `src/game/mobile/brawl.ts`: no captions.
- `src/game/mobile/roomName.ts` (new): the room line's fit.
- `src/game/mobile/controlsPicture.ts`: two help lines.
- `src/game/scenes/PubScene.ts`: `isMobile() ? LEAVE.y - 30 : LEAVE.y`.
- `scripts/mobile-smoke.cjs`: the `polish` section; the combat and side checks follow the new rule.
- `tests/mobileCombat.test.ts`: unit tests for the rule and the room-name shortening.
- `src/game/mobile/README.md`: "Stage 2 polish" section and the fights tables.

## Checks

CHECKS_PLACEHOLDER

## Screenshots (1x)

`/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile/shots/s2-polish/before/` (base
5bb649ec) and `.../s2-polish/after/` (this branch), each with `iphone-*` (844x390, insets 47/47/21) and `android-*`
(740x360): `room-fresh`, `room-calm`, `room-mid`, `boss`, `side-start`, `side-roomname`, `brawl`, `pub`.

## Still not great (for stage 4 on a real phone)

- The fresh room shows SPECIAL from the start because a new game begins with 40 Krezz and Flenky's DASH costs no more.
  That is correct by the rule (it can go), and it pulses the first two times it appears.
- The canvas weapon card after a swap still appears for about 1.7 s up top. It is the game's own confirmation and
  fades by itself; worth a look on a real phone.
- Nothing here was tried on a real phone; all of it is Playwright emulation.
