# KRELWORLD economy

Combat difficulty is unchanged: no enemy stats, drop rates or coin values per enemy were touched. Only prices, the
Kreddle Kards stake and a few rewards moved. Re-run the numbers with `npx vite-node scripts/economy-audit.ts`.

## Where the money comes from (Krezzcoin)

| Source | Amount |
|---|---|
| Enemy drops (every enemy killed, base) | ch1 268 · ch2 258 · ch3 315 · ch4 1,015 · ch5 115 · ch6 147 · ch7 1,119 · arenas ~700 (KREZMAR ×1.35, LUCKY HORSESHOE +25%/lvl) |
| Room clears / weapon crates | 18 a room, 16 a crate (included above for rooms) |
| Chapter clears | 200 × (1 + 0.25 × (ch−1)): 200, 250, 300, ch4/ch5 400 + 150, Krozno 300 |
| Side quests (arcs.ts) | 1,710 for the ALL quests, ~470 for your own side story, a few `pay` steps (±200) |
| Personal quest / ministry quests | ~330 / 1,320 |
| Exploring Krelford | 30 a new place, 60 a stash (8), 500 for the lot: ~1,300, nearly all in ch1–2 |
| Small stuff | KrelTV gifts (25–75 or 4–10 🎟 per new show), wonk-offs (5–60), Beatup (10+), gigs, Drongus's song (100) |
| Kreddle | coins only come back as consolation (slots 50, wheel money-back, Kards cash-out, 150 for a maxed prize) |

**Rough cumulative income for a player who does the side content as it opens (no gambling):**
ch1 ~1,050 · ch2 ~2,850 · ch3 ~4,450 · ch4 ~6,850 · ch5 ~8,550 · ch6 ~9,500 · ch7 ~10,600.
Less ~10–15% on ammo, lads, deaths (−10%), bottles, bribes and appeals.

**Krokens** come from the console at home (5 per game won, once per game per chapter: the big tap, roughly 20–60 a
chapter once you've unlocked a few games), the Kreddle machines (~1.5 per play plus prizes), KrelTV gifts and the
home slot machine (1 a day). An engaged player sees roughly 150–250 by ch5 and 300–450 by the end.

## What was wrong

* **Total shelf ~18,000 vs ~10,600 income looked fine, but the power was in the cheap stuff.** Auto-aim was 300,
  the BFK 900, Krunch Gym (+8% damage) 160. With ~2,800 in hand by the end of ch2 (mostly exploring money) a player
  could own auto-aim, the BFK and a damage stack before ch3. Meanwhile meter/IBS perks cost about the same as damage.
* **Ammo prices were arbitrary.** Priced off box size, so the Disco launcher, Railgun and Rocket were 10 a box and the
  Kreddler 176 a box (880 to fill). Box price had nothing to do with what a box does.
* **Prize Counter:** everything 15–40 Krokens. Kreddle Armour (−30% damage), High Roller (+60 HP), two revive fairies
  and the Disco/Kreddler guns cost the same as neon tracers. Kreddle Kards paid a random prize every ~280 coins.
* Upgrades rose linearly (+70 a level), so the 8th max-HP level was barely pricier than the 3rd.

## What changed (before → after)

**Kreddle Exchange (Krezzcoin)**

| Item | Before | After |
|---|---|---|
| Auto-Aim | 300 | **1,500** |
| Krunch Gym (+8% dmg, ×3) | 160/320/480 | **300/600/900** |
| Krez-Proof Vest (−10% dmg taken, ×3) | 170/340/510 | **260/520/780** |
| Itchy Trigger Finger (×3) | 150/300/450 | 220/440/660 |
| Krezz Serum / Beans / STD Krezz | 190 / 210 / 210 per lvl | 160 / 180 / 180 |
| Pre-Workout, Pockets, Backflips, Trainers | 160, 180, 170, 140 | 150, 150, 160, 120 |
| Generic upgrades | 80 + 70×lvl | base + 0.9·base·lvl + 10·lvl² |
| Max HP ×8 | 80 … 570 (2,600) | 70 … 1,001 (3,324) |
| Resting Wonk Hand ×5 | 80 … 360 (1,100) | 120 … 712 (1,980) |
| Krezz Tank ×3 / Bottle Belt ×3 | 450 / 450 | 506 / 734 |
| Personal branch I/II/III | 120/260/480 | 150/350/650 |
| Moves (Shove/Fart/Last Orders) | 320/280/360 | 450/400/550 |
| Hire a lad | 150 | 200 |
| Gatling / Long Lens / Flamethrower | 420 / 480 / 560 | 700 / 650 / 800 |
| **The BFK** | 900 | **2,000** |

Shelf total: ~18,000 → ~25,000. A player can buy roughly a third to 40% of it in one run, so it's a choice.

**Ammo** is now a per-gun `ammoPrice` (guns.ts) set by what a box does (damage × pellets, pierce, blast):

| | pistol | uzi | boomstick | railgun | rocket | gatling | lens | flamer | **BFK** | chainsaw | kreddler | disco | flush |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| box before | 24 | 48 | 10 | 10 | 10 | 34 | 38 | 45 | 72 | 96 | 176 | 10 | 20 |
| box after | 12 | 15 | 15 | 20 | 25 | 30 | 30 | 35 | 60 | 30 | 60 | 45 | 35 |
| full gun after | 48 | 75 | 60 | 80 | 100 | 120 | 120 | 140 | 180 | 150 | 300 | 180 | 140 |

Ammo still drops from enemies and room clears, so shop ammo is a top-up: a chapter's dungeon pays for a couple of
full refills, but keeping the BFK and the disco launcher fed all the time costs real money.

**Prize Counter (Krokens)**: [first level, +per level owned] in `KROKEN_PRICES` (systems/kreddle.ts).

| | Before | After |
|---|---|---|
| Blood Bath, Neon Tracers (looks) | 30, 15 | 10, 10 |
| Casino Gas, Extended/Neon Krezz, Overtime Super, Slot Farts | 20–30 +5 | 25–35 +10 |
| Jackpot Rounds, Loaded Dice, Rainbow Super, Gold Guns | 25–35 | 40, 40, 45, 50 |
| Lucky Horseshoe (+25% coins) | 20/25 | 35/50 |
| High Roller (+20 HP ×3) | 25/30/35 | **40/55/70** |
| Kreddle Armour (−10% ×3) | 30/35/40 | **50/70/90** |
| Aggressive Sperms | 40 | 60 |
| Bottled Fairy (revive, carry 2) | 30/35 | **60/80** |
| Chainsaw / Royal Flush / Kreddler / Disco (new) | 40 each | 60 / 80 / **100 / 120** |
| Refill a prize gun you own | 10 | 15 |
| Furnishings | unchanged (10–40) | |

Total: 965 → 1,625 Krokens. Looks and fun stuff are a ch3–4 treat. Armour, HP and a fairy want saving. The top
Kreddle guns land around ch5–6, sooner if you're lucky at the machines.

**Kreddle Kards** 100 → 150 a deal, cash-out at two right 150 → 200. Kards were the cheapest route to random prizes
(~280 coins each). Now it's ~420, about the same as the Klaw. The slots' rules text now says "50 back" to match what
they pay.

## Spending curve this aims for

* **ch1–2 (~1–3k):** first levels of HP/Krezz/bottles/damage (70–120), Fresh Trainers, a branch tier, a lad, ammo.
  Exploring money buys a first Exchange gun (650–800) by late ch2 if you save for it.
* **ch3–5 (~4–8k):** mid levels (200–500), vest and gym stacks, branch II/III, moves, a second gun. Prize Counter
  looks plus a first armour/HP level.
* **ch5–6:** the game-changers. Auto-Aim (1,500), the BFK (2,000), the top of the damage/armour stacks (600–900 a
  level), fairies, Kreddler/Disco. You get these by saving, or with a good run at the machines.

## Kreddle rework

**Krokens, ~25% cheaper across the board** (they were a lot of machine time for what they bought). Prize Counter
total 1,625 → 1,239; furnishings 225 → 167.

| Prize | Before | After |
|---|---|---|
| Blood Bath, Neon Tracers | 10, 10 | 8, 8 |
| Casino Gas | 25 +10 | 20 +8 |
| Extended Krezz, Neon Krezz | 30 +10 | 24 +8 |
| Overtime Super | 35 +10 | 26 +8 |
| Slot Machine Farts | 35 | 26 |
| Lucky Horseshoe | 35 +15 | 26 +12 |
| Jackpot Rounds, Loaded Dice | 40, 40 | 30, 30 |
| High Roller (+20 HP) | 40 +15 | 30 +12 |
| Rainbow Super | 45 | 34 |
| Gold-Plated Guns | 50 | 38 |
| Kreddle Armour | 50 +20 | 38 +15 |
| Aggressive Sperms | 60 | 45 |
| Bottled Fairy | 60 +20 | 45 +15 |
| Chainsaw / Royal Flush / Kreddler / Disco | 60 / 80 / 100 / 120 | 45 / 60 / 75 / 90 |
| Refill a prize gun you own | 15 | 11 |
| Furnishings | 10–40 | 8–30 |

Krezzcoin prices are unchanged.

**New guns at the Exchange (GUNS tab, Krezzcoin).** Five Exchange exclusives (`shop` + `kreddle`, never in crates):
One-Armed Bandit 900, Kroulette Shotgun 1,100, High Roller Chip Launcher 850, The Loan Shark 1,000, Snake Eyes 1,300
(between the old bank guns at 650–800 and the BFK at 2,000). The crate guns can now also be bought outright once
their chapter is reached (`price`): pistol 150, Uzi 300, Boomstick 400, Railgun 600, Rocket 750.

**Gun mods (GUN MODS tab).** Every gun, and the Fart Blaster, has its own mods (`GUN_MODS` in systems/armoury.ts,
saved as `s.upgrades["gm_<gun>_<stat>"]`, so old saves start at 0). Each gun offers 2–5 of: damage (+12%/lvl, ×5),
fire rate (−8% cooldown/lvl, ×3), ammo (+25% max/lvl), accuracy (−20% spread/lvl), range (+15%/lvl), pierce (+1),
pellets (+1), blast (+15% radius), homing, and "luck" on the gambling guns. A level costs
`base × weight × (1 + 0.6·lvl + 0.15·lvl²)` rounded to 5, where `base` is what the gun's worth (pistol/Fart 40 …
BFK 110) and `weight` is the stat (fire rate 1.1, pellets 1.2, damage 1, ammo 0.6, accuracy/range 0.5…). First
levels are 20–120; the last damage level runs 230 (pistol) to 640 (BFK). Maxing one gun is ~1,000 (pistol) to
~3,700 (BFK); the whole shelf is ~44,000, so you mod the two or three guns you actually use.
