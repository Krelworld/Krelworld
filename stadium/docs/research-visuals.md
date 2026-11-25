# Knockout Day: visual direction research

Research for the camera and projection, scale, ambient life, combat feel, and gritty pixel-art art direction of *Knockout Day* (Phaser 4, WebGL, PixelLab pixel art, phone and laptop).

**Where the game stands now** (from `docs/DECISIONS.md` and `src/view/stadium.ts`):
- Projection: 32 art px per metre, 1:1, three-quarter oblique (square floor, upright faces), low cutaway walls (1.1-1.6 m), and roofs that lift off when you walk in.
- Characters: about 60 px tall.
- Zoom: phones about 22 pt/m, larger screens 32 pt/m, whole-step zoom only.
- Juice already in place: hit-stop of `70 ms x k` that freezes the whole simulation, trauma-squared shake using white noise, a white flash, an attacker lunge, a blood spray that lands as permanent decals, and growing pools.

**Honesty note.** Developer sources rarely publish exact sprite heights, tile sizes or hit-stop values. Every number below carries its source. Anything marked *(observation)* comes from widely known play experience of the game and has no citation behind it. Anything marked *(suggestion)* is my own design starting value, meant for tuning. I left a cell blank (n/v = "not verified") rather than guess.

---

## 1. Camera and projection

### 1.1 The options, and who uses them

**True top-down (vertical).** Used by GTA 1/2, Hotline Miami 1/2, Prison Architect, Door Kickers 1/2, Monaco and RimWorld.
- Sprites are cheapest here (1x): "Games with a perfectly vertical perspective are the cheapest to create sprites for", and the engine can rotate them ([CXong](https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need)).
- The cost is character identity: "it's not a very flattering perspective" and you only see "the tops of their heads".
- Line of sight and occlusion are trivial: walls are lines and nothing hides anything. That is why tactics and stealth games use it. KillHouse sells Door Kickers 2 as a "Top Down view, optimized for tactical analysis" ([KillHouse](https://inthekillhouse.com/doorkickers2)). Monaco greyed out everything outside line of sight ([Wikipedia](https://en.wikipedia.org/wiki/Monaco:_What%27s_Yours_Is_Mine)).
- **Key counter-evidence.** For Monaco 2, Andy Schatz switched to an isometric 3D view because "Some people's brains literally cannot parse" the first game's top-down look ([Aftermath](https://aftermath.site/monaco-2-demo-interview/)).
- Prison Architect's legless counters were criticised as looking "more like board game counters" (review summary via search; [PC Gamer](https://www.pcgamer.com/uk/prison-architect-review/)).
- Hotline Miami's top-down view distances the player from the gore. In an interview: "The top down view is one thing, helping remove you somewhat from the bloodshed" ([IBTimes](https://www.ibtimes.co.uk/hotline-miami-dennis-wedin-jonatan-soderstrom-interview-447406)).

**Three-quarter oblique ("top-down oblique", a square floor with upright fronts).** Used by The Escapists 1/2, Stardew Valley, Eastward, Enter the Gungeon, Moonlighter, Children of Morta, CrossCode, Party Hard and Streets of Rogue.
- Escapists 2 describes it as "fake sense of perspective where the front profiles of objects and buildings are leant over, rather than strictly top down", which gives "more variety and detail" but is harder to draw ([80.lv, Team17](https://80.lv/articles/the-escapists-2-how-pixel-art-works-with-gameplay)).
- CXong calls oblique "a highly versatile perspective" that shows characters and scenery well, at 3-3.5x the sprite cost of top-down ([CXong](https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need)). PixelLab generates the 8 directions for you, so that cost mostly disappears for this project.
- Weakness: height and depth share the screen's y axis.
  - Radical Fish say pseudo-3D "without perspective distortion" makes entity positions hard to read, which is one reason CrossCode uses auto-jump ([Radical Fish](https://www.radicalfishgames.com/?p=1168)).
  - Their next game moved to a WebGL renderer with "just enough perspective transformation to make terrain easier to read" ([The Avocado interview](https://the-avocado.org/2021/05/07/indie-developer-interview-radical-fish); [RPG Site](https://www.rpgsite.net/news/16135-radical-fish-games-announces-25d-pixel-art-action-rpg-alabaster-dawn-set-to-release-for-steam-early-access-in-2025)).
- Eastward (oblique) is "a 3D game with a 2D perspective". Its assets are rebuilt in 3D and split by "natural structure", for example a rooftop separate from its wall. The level design uses elevation and stairs so that "the player [can] move behind buildings without being totally obscured" ([Game Developer, Pixpil](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)).
- Enter the Gungeon is also 2D sprites wrapped onto primitives in 3D under a perspective camera, at a native 480x270 ([Dodge Roll on Steam](https://steamcommunity.com/app/311690/discussions/1/371919771751798558); [itch.io dev comment](https://itch.io/post/4162405); [Game Developer](https://www.gamedeveloper.com/design/building-i-enter-the-gungeon-i-s-dungeon-climbing-spin-off-i-exit-the-gungeon-i-)).

**Isometric / dimetric (2:1).** Used by Project Zomboid, Theme Hospital and Monaco 2 (3D).
- Pixel isometric is in practice 2:1 dimetric ([Significant Bits](https://www.significant-bits.com/a-laymans-guide-to-projection-in-videogames/); [Pixel Parmesan](https://pixelparmesan.com/fundamentals-of-isometric-pixel-art/)).
- CXong: 4-direction isometric "feels unnatural for action games" ([CXong](https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need)).
- The systemic-sandbox precedent is Project Zomboid. Its cutaway costs are visible in its own blog: buildings get "sliced and diced 99% of the time because the cutaway segments are wholesale across the entire screen". The team also fought "performance issues … due to the isometric draw order" for years ([PZ blog](https://projectzomboid.com/blog/?p=11777); [NME on Build 42](https://www.nme.com/news/project-zomboids-very-big-build-42-update-will-introduce-basements-3320807)).

**Angled 3D with a rotatable camera.** Used by GTA Chinatown Wars, Untitled Goose Game and Door Kickers 2's 3D maps.
- Chinatown Wars chose a "pseudo top-down camera angle in order to make the most use of the DS' limited screen real estate". The camera rotates 360 degrees ([TechCrunch](https://techcrunch.com/?p=353232); [Nintendo World Report](https://nintendoworldreport.com/preview/17744)).
- This is the closest precedent for "a dense city on a small screen".

**HD-2D (pixel sprites in a 3D world).** Used by Octopath Traveler and Triangle Strategy.
- "2D pixels in a lush 3D environment". The team had to limit "how far we could rotate the camera", and the flat, paper-like sprites were a recurring problem ([Unreal Engine, Octopath II](https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)).
- Early versions "didn't add enough depth"; another went "too far on the resolution and saturation" ([Siliconera](https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/)).
- *(Observation)* HD-2D's strong tilt-shift depth of field makes scenes read as miniatures, which is cosy and toy-like. That is the opposite of the grim tone wanted here. I could not find a developer source that uses the term "tilt-shift".
- Signalis is a useful middle case. It mixes low-poly 3D and pixel art, but "everything is rendered at [640x360] before it's upscaled", so 3D and sprites share one pixel density ([IndieGraze](https://indiegraze.com/?p=989)).

**Side view.** Kingdom Two Crowns and others: not applicable to this game.

### 1.2 Walls, interiors, crowds, readability and phones

| Problem | What the reference games do | Evidence |
|---|---|---|
| **Walls hiding characters** | Top-down: no problem. Oblique: keep walls low or cut down; split roof from wall (Eastward); route paths so characters pass behind buildings only briefly (Eastward). Isometric: cutaways for whole buildings or the whole screen (Zomboid), or a hold-to-peek control (Zomboid B42). | Pixpil; PZ blog; [Steam thread](https://steamcommunity.com/app/108600/discussions/0/596287304339830089/) |
| **Interiors** | Escapists: roofless prisons, with ground, vent and roof layers *(observation; layer names in the [fan wiki](https://theescapists.fandom.com/wiki/Prison_editor))*. Stardew and Eastward: separate interior maps behind doors *(observation)*. Zomboid: roof and upper-floor removal around the player. Prison Architect and Door Kickers: no roofs, ever. | |
| **Crowd density** | Top-down and tiny sprites carry the most bodies per screen: Sensible Soccer's "exaggeratedly small sprites" ([Wikipedia](https://en.wikipedia.org/wiki/Sensible_Software)), with Jon Hare crediting "the perspective and the size" ([Set Pieces](https://thesetpieces.com/?p=2212)). Oblique gives fewer bodies, each more legible. | |
| **Who is who** | Silhouette first, then value and hue. Valve's TF2: the silhouette is the "first step and building block" of a character, and the rendering exists so players can "identify other players under varied lighting" ([GDC 2008 slides](https://cdn.steamstatic.com/apps/valve/2008/GDC2008_StylizationWithAPurpose_TF2.pdf); [NPAR 2007 paper](https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf)). Streets of Rogue 2: readability comes from "how interactive items reflect light and the thickness of sprite outlines" ([report](https://gatetonnu.pages.dev/posts/streets-of-rogue-2-developer-talks-pixel-art-readability-and-the-procedural-appeal-of-roguelikes)). Escapists 2 stripped decoration because overdressed rooms made it hard to tell decorative items from interactive ones ([80.lv](https://80.lv/articles/the-escapists-2-how-pixel-art-works-with-gameplay)). | |
| **Phones** | Chinatown Wars picked its angle for a small screen (above). Gungeon locks a 480x270 "big pixel" canvas and offers pixel-perfect scaling. Apple's guidance is 44x44 pt minimum touch targets ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility)). | |

### 1.3 Verdict on projection

**Keep the three-quarter oblique. Do not switch to isometric. Do not go full 3D with sprites now.** Refine the oblique in four ways, listed after the reasons below.

**Why oblique is right for this game:**
1. **Reading crowds and uniforms needs fronts, not tops of heads.** The game's information is in clothing: hi-vis bibs, police livery, kit colours, disguises, faces you can steal. Top-down throws away exactly that. Monaco's own developer abandoned top-down for readability (Aftermath).
2. **Rectilinear world.** Stadiums, pitches, terraces and high streets are rectangles. Oblique keeps the pitch lines, stands and shopfronts axis-aligned. A football pitch in 2:1 isometric becomes a diamond: you lose the "TV broadcast" look and waste screen area on a landscape phone.
3. **Touch and 8-direction input map naturally onto an oblique grid.** Isometric makes "up" diagonal.
4. **Isometric's occlusion problem is worse, not better.** Walls in front cover two sides of every room, and Zomboid's long struggle with cutaways and draw order is the warning.
5. **The asset pipeline (PixelLab "low top-down" sprites, 8 directions) is built for this view.**
6. **The tone argument against HD-2D**: tilt-shift and bloom read as miniature and cute.

**The four refinements:**
- **a) A "camera side" convention for the stadium.**
  - In oblique, the far (north) stand's fans face the camera. That stand is perfect: you read faces and kits.
  - The near (south) stand rises toward the camera and hides the pitch. Treat it like a TV gantry side: draw it as a low, cut-down rake that fades or cuts away when anything important is behind it, or draw only its roof edge.
  - Classic football games put the camera on the main-stand side for this reason *(observation)*.
- **b) Occlusion silhouettes.** When the player, or any NPC the player has targeted, is behind a wall face or a roof, draw them as a flat-colour silhouette or outline through it. This is the standard fix in oblique and isometric games *(observation; widely used)*. In Phaser, render the character a second time above the occluders with a tint and low alpha, and only when overlapped.
- **c) Roof and upper-floor logic.** Keep Escapists-style roof lifting. Also lift the roof of any building the camera centre is over while you aim or hover there, a peek like Zomboid B42's.
- **d) Line of sight.** For stealth, use a Monaco-style treatment: desaturate and darken what the player cannot see, rather than hiding it. Schatz moved toward "a more subtle shadowing" in Monaco 2.

**When 3D-with-sprites would be worth it.** Only if multi-tier stands with people at many heights, and vehicles driving under and over things, become core and the 2D sorting breaks. The game already has a 3D cab view (`drive3d.ts`). If that happens, follow Signalis: render the 3D at the same art-pixel density as the sprites (32 px/m), never higher.

---

## 2. Scale and density

### 2.1 Comparison table

| Game | Projection | Character height (art px) | Tile (art px) | Interiors | Notes |
|---|---|---|---|---|---|
| The Escapists | Oblique, fronts "leant over" | n/v | 16 ([80.lv](https://80.lv/articles/the-escapists-2-how-pixel-art-works-with-gameplay)) | Roofless; ground/vent/roof layers | Colour-coded uniforms (guards and inmates) *(observation)* |
| The Escapists 2 | Oblique | n/v (about one tile wide *(observation)*) | 32, "the perfect resolution for a game like this" | Cutaway rooms, extra floors | Soft per-room lights, dynamic shadows, cracks, litter, puddles; decoration removed for readability |
| Streets of Rogue 1/2 | Steep oblique | n/v | n/v | Roofless buildings | Outline thickness and light on interactive items carry readability |
| Party Hard 1/2 | Oblique | n/v | n/v | Roofless | Pixel art "made the game feel less dark"; blood removed for a 16+ rating at gamescom ([80.lv](https://80.lv/articles/the-making-of-partd183-hard)) |
| Hotline Miami 1/2 | Top-down; camera leads the aim | n/v | n/v | Roofless | Permanent bodies and blood; violence distanced by the view |
| GTA 1/2 | Top-down (vertical) ([CXong](https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need)) | n/v | n/v | Roofs (you see rooftops) | Camera pulls up with speed *(observation)* |
| GTA Chinatown Wars | Angled 3D, 360° rotation | 3D (cel-shaded) | n/a | Few interiors | Angle chosen for small-screen real estate |
| Prison Architect | Top-down | Tiny, legless | n/v | No roofs | Minimal, "board game counters" |
| Door Kickers 2 | Top-down over 3D maps | n/v | n/v | No roofs | "Optimized for tactical analysis"; limited field of view |
| Monaco → Monaco 2 | Top-down → isometric 3D | n/v | n/v | No roofs | Switched because players couldn't parse it |
| Project Zomboid | Isometric (true iso since "Iso Revolution") | n/v | n/v | Cutaways and roof hiding | Draw-order and cutaway pain |
| Stardew Valley | Oblique | 32 (NPC sprite 16x32) ([forum](https://forums.stardewvalley.net/threads/sprite-size-first-time-modding-sv.7128/latest)) | 16; shown at about 4x ([blog, unverified](https://freegamesprites.com/news/tile-size-2d-game-pixel-art-guide)) | Separate maps | Two tiles tall = about 2 m at 1 tile per 1 m |
| Eastward | Oblique, 3D engine | n/v | n/v | Mostly separate scenes *(observation)* | Hand-painted bump maps, LUT grading, SSAO-like effects, fog, sunbeams |
| Enter the Gungeon | Oblique over 3D primitives, perspective camera | n/v | n/v | Rooms | 480x270 native canvas, pixel-perfect |
| Moonlighter | Oblique | n/v | n/v | Rooms | — |
| Children of Morta | Oblique | n/v | n/v | Rooms | Pixel sprites with *high-res* dynamic lights and post-processing ([TechRaptor summary](https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta); [postmortem](https://gamedeveloper.com/design/postmortem-children-of-morta)) |
| CrossCode | Oblique, no perspective | n/v | n/v | Rooms | Height ambiguity; the successor adds subtle perspective |
| Octopath / Triangle Strategy | HD-2D | n/v | n/a | 3D | Camera rotation limits; sprites look paper-flat |
| Untitled Goose Game | 3D, high fixed angle | 3D | n/a | Outdoors | English village; comedic systemic sandbox *(observation)* |
| Sensible Soccer | Steep near-top-down pitch view | Very small (house style) | n/v | — | "The perspective and the size" helped |
| Retro City Rampage | Top-down / oblique hybrid, GTA 1/2 homage | n/v | n/v | — | — |
| Signalis | Pixel + low-poly 3D | n/v | n/v | Rooms | Everything rendered at 640x360, then upscaled |
| **Knockout Day (now)** | Oblique | **about 60** | **32 (= 1 m)** | Roofs lift off; low walls | 22 pt/m on phones, 32 pt/m on larger screens |

I could not verify sprite heights for most titles. Developers rarely publish them, and fan sprite rips are not reliable sources. Where numbers exist, they cluster around **characters about 2 tiles tall with tiles of about 1 m** (Stardew: 16 px tiles, 32 px people). Knockout Day's 60 px on a 32 px/m grid is the same ratio at twice the resolution, so the scale itself is sound.

### 2.2 Screen points per metre on a phone (my calculations)

Reference phone in landscape: 852x393 pt at 3x (iPhone 15 class), about 153 pt per inch. A 60 px figure is about 1.9 m tall.

| Zoom (whole steps on a 3x screen) | pt per metre | Figure height | Visible world (before HUD) | Notes |
|---|---|---|---|---|
| 1 | 10.7 | 20 pt, about 3.3 mm | 80 x 37 m | Strategic view; kits are blobs |
| **2 (current phone default, about 22 pt/m)** | 21.3 | 40 pt, about 6.6 mm | 40 x 18 m | Kits and hi-vis readable; faces no |
| 3 | 32 | 60 pt, about 10 mm | 27 x 12 m | Laptop-like; good for fights |
| 4 | 42.7 | 80 pt, about 13 mm | 20 x 9 m | Close-up |

**Implications:**
- **21-22 pt/m is the right phone default.** At that size a figure is about 40 pt tall, and torso colour and silhouette read. But 40 pt tall by about 11 pt wide is far below Apple's 44 pt touch target. **Tap selection must snap** to the nearest valid NPC within a 44 pt radius, weighted toward people in front of the player; do not require tapping the sprite itself.
- **Vertical space is the scarce dimension on a landscape phone** (about 18 m visible). Bias the camera lead in the direction of movement (the code already leads by velocity x 0.4 s). Keep the HUD on the left and right edges, not top and bottom.
- **Use camera control as a feedback tool.** When a fight starts near the player on a phone, step in from 2 to 3 (32 pt/m) and step back out afterwards. The impact-feel study found dedicated "camera control" to be one of three features separating well-liked from poorly liked action games (§4). Whole-step changes keep pixels crisp; ease the scroll, not the zoom factor.
- **Laptop:** 32 pt/m at 1440x900 shows about 45 x 28 m, so laptop players see roughly twice the street area of phone players. That is fine for a sandbox. If it matters for fairness, cap the laptop view by height (for example, 24-28 m visible) rather than matching pt/m *(suggestion)*.

---

## 3. Making the world feel real and alive

The evidence ranked by return for effort in a 2D WebGL game:

1. **Background "breathing" and idle life.**
   - The impact-feel framework lists "Ambient Feedback … making the world appear natural and interactive", for example swaying grass and flowing water ([Lin et al. 2022](https://arxiv.org/abs/2208.06155)).
   - Graveyard Keeper does wind and sway with a **vertex shader** (x offset grows with height, phase varies with position), not hand-drawn frames. The same shader makes grass swing as you walk through ([Game Developer, Lazy Bear](https://www.gamedeveloper.com/programming/graveyard-keeper-how-the-graphics-effects-are-made)).
   - For Knockout Day, apply this to: flags, bunting and banners; scarves held aloft; hanging baskets; the plastic sheeting on the roadworks; trees; hair and coats in wind.
   - For people, PixelLab template animations will not cover every idle. Add cheap procedural micro-motion: a 1 px breathing bob, random facing changes, a lean, and the phase offsets every crowd needs *(suggestion)*.
2. **Lighting and colour grading.**
   - Graveyard Keeper uses **10 artist-made LUTs** for times of day, an ambient colour gradient, sprite shadows (up to 4 per object: the sun plus the 3 nearest lights) and normal maps from four hand-brushed light directions.
   - Eastward uses LUT grading that "makes the colors so much softer", "complex lighting", SSAO-like effects, fog layers and sunbeams ([80.lv](https://80.lv/articles/eastward-charming-chinese-pixel-art-adventure); Pixpil).
   - Children of Morta lights pixel sprites with **high-resolution** dynamic lights rather than pixelated ones.
   - Phaser 4: `setLighting(true)` per object (sprites, tilemaps, particles, text); `light.z` for height; optional self-shadows; normal maps; the `NormalTools` filter. Caveat: **lighting changes the shader and breaks sprite batching, so "enable lighting only on the objects that actually need it"** ([Phaser](https://phaser.io/news/2026/05/phaser-4-dynamic-lighting); [Phaser 4.2](https://phaser.io/news/2026/06/phaser-v4-2-0-released)).
   - **Cheapest high-value route:** a full-screen camera filter or LUT for the time of day and weather, plus a "light layer" render texture (darkness multiplied, additive light sprites for floodlights, pub windows, streetlamps, blue police lights and flares). Real normal-mapped lighting is worth it only on the hero, key props and the stadium bowl at night.
3. **Permanence: decals that stay.**
   - Nijman's Art of Screenshake includes "permanence" as a step (bodies and shells stay) ([talk](https://www.youtube.com/watch?v=AJdEqssNZ-U); [recreation devlog](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog)).
   - Hotline Miami's bodies and blood stay "when you walk back to your car", which makes fights feel hard won (GMTK, *Secrets of Game Feel and Juice*).
   - The game already keeps blood. Extend permanence to the rest of the day: litter that builds up over match day (cans, chip papers, programmes, flattened plastic pint pots), spilled pints, broken glass, scuffs, tyre marks from the coach, scorch marks, and unconscious bodies that stay until stewards or medics drag them off. That last one is also a systemic hook.
4. **Weather and atmosphere particles.** Graveyard Keeper does fog by placing cloud sprites over the upper parts of objects ("really easy to make"). For a British November match day: drizzle streaks; wet-ground sheen through a cheap reflective tint on pavement tiles; puddle ripples; breath vapour; smoke from the burger van; flare smoke in the away end; pigeons; a crisp packet blowing.
5. **Crowd animation in the stands.**
   - Use palette and colour cycling, Mark Ferrari's technique for "complex and realistic background animation" with no new frames ([GDC 2016, "8 Bit & '8 Bitish' Graphics"](https://gdcvault.com/play/1023586/8-Bit-8-Bitish-Graphics)). A row of seated fans can bob, wave scarves or flash phone lights by cycling a few palette slots in a shader.
   - Build stands from **crowd tiles**: 3-4 animation frames, random kit and skin palette swaps per seat, random phase.
   - Drive the whole stand from match state (a near miss is a ripple, a goal is everyone up, a foul is arms out), with individual sprites only for fans the player can interact with *(suggestion)*.
6. **NPC micro-behaviours with an audience.** People forming a ring around a fight, phones held up to film, stewards talking into radios, queues at the bar and the turnstiles, a crowd bunching at the pub TV for a replay. The Party Hard team found streamers and players loved surprises ([80.lv](https://80.lv/articles/the-making-of-partd183-hard)); a systemic world feels alive when NPCs *visibly react to each other*, not only to the player *(suggestion)*.
7. **Sound.** Crowd-roar beds that swell with the match, chants, the tannoy, a police helicopter, sirens, traffic, the pub telly. The impact-feel study puts "sound coherence" in its top three (§4). For ambience, the main rule is to tie the sound to what is on screen (louder near the stand, muffled inside the pub).
8. **Contact shadows.** A dark ellipse under every character, prop and vehicle, offset bottom-right to match the light, grounds everything. The cheapest "realness" fix there is *(observation)*. Graveyard Keeper goes further with projected sprite shadows.

**Most return for least effort:** contact shadows; a LUT or colour filter for overcast and floodlight; a light layer of additive glows; a sway shader for cloth and foliage; persistent litter and blood decals; colour-cycled crowd tiles; and a few NPC reactions to violence (ring, film, flee, call the police).

---

## 4. Combat feel ("juice") for punches and violent attacks

### 4.1 What the sources actually say

**Overall juice level (empirical).** Kao (2020), with N = 3,018 players on an action RPG: **medium and high juice beat both none and extreme** on enjoyment, immersion, motivation and play time ([Entertainment Computing 34, 100359](https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html); summary in [Pichlmair & Johansen](https://arxiv.org/abs/2011.09201)). A 2024 follow-up warns that amplified feedback can hurt when it "occludes causal action-feedback links" ([Imperial](https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d)). For a crowded sandbox, **juice the player's own hits hard and scale everyone else's down by distance.**

**What separates well-liked from poorly liked combat.** Lin et al. (2022) ranked 44 action games by the "impact feel" in their Steam reviews and compared the top 8 with the bottom 8 ([arXiv 2208.06155](https://arxiv.org/abs/2208.06155)). Three features mattered most:
1. **Hit stop.** "Without hit stop … players describe [attacks] as soft and powerless." Examples: Guilty Gear Xrd "light attacks freeze … 7 frames while … heavy attacks freeze for about 10 frames".
2. **Sound coherence.** Any delay between the visual hit and the sound "ruins the immersive experience".
3. **Camera control.** Dedicated framing for heavy and finishing blows. The low-ranked games' cameras "simply [move] following the character".

The same paper also notes:
- **One Finger Death Punch** (the most-liked of the 44) *snaps* between poses with no interpolation and lets the hit effect carry the direction.
- After-hit effects (blood, bones) linger "for several seconds".
- Hit sounds should vary by weapon and material and be randomised to avoid fatigue.
- Hit effects differ by weapon type: a *spot* burst for fists and blunt objects, a *directional* streak for blades.

**Hit stop numbers:**

| Source | Value |
|---|---|
| Guilty Gear Xrd (Lin et al.) | 7 frames light (about 117 ms), about 10 frames heavy (about 167 ms) |
| Capcom SFV seminar (illustrative, via SRK search summary) | 8F / 12F / 16F for light / medium / heavy |
| Smash (SSB Wiki) | 15% damage gives 8-15 frames depending on the game; capped at 20-30 frames ([Hitlag](https://www.ssbwiki.com/Hitlag)) |
| Celeste (GMTK, secondary) | About 4-frame pause plus tiny shake on dash |
| Indie practice (Godot tutorials and checklists) | 60-120 ms, often 60 ms with time scale 0.05 rather than a full stop ([forum checklist](https://forum.godotengine.org/t/game-feel-checklist-for-godot-4-hit-stop-trauma-shake-coyote-time-and-more/145340); [uhiyama-lab](https://uhiyama-lab.com/en/notes/godot/hit-feedback-hitstop/)) |

Fighting games use longer hit stop because they have two characters and frame-precise reads. A sandbox brawl with 200 NPCs should sit lower.

**Sakurai's hit-stop craft** (eight points, from his 2022 video as summarised by [Nintendo Wire](https://nintendowire.com/news/2022/12/12/this-week-in-sakurai-12-5-12-11-fine-tuning-hit-stop-and-cheating-the-system/) and his Famitsu column via [Source Gaming](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/)):
- Shake the *victim*, not only the screen: horizontally when grounded, vertically in the air, tapering off.
- Let the attacker keep moving slightly during the freeze.
- Ease into the hurt pose (Smash takes 4 frames to blend flinch into hurt).
- Scale shake with camera distance.
- Cap the duration.

**Screen shake.**
- **Eiserloh's trauma model** ([GDC 2016, "Juicing Your Cameras With Math"](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing)):
  - Trauma is a value from 0 to 1; events add to it and it decays linearly.
  - Shake = trauma² (or ³).
  - Offset and rotation are driven by **smooth noise (Perlin), not random values per frame**, with separate noise seeds for x, y and angle.
  - Implementations that follow the talk use these defaults: Bevy max angle 10°, max translation 20 px, noise speed 20, exponent 2, decay 0.5/s, +0.4 per event ([Bevy example](https://docs.rs/bevy/0.17.3/src/2d_screen_shake/2d_screen_shake.rs.html)); KidsCanCode decay 0.8/s, max offset (100, 75) px, max roll 0.1 rad, power 2 ([recipe](https://kidscancode.org/godot_recipes/3.x/2d/screen_shake/)).
  - A conference recap warns that translation jitter can put a 3D camera inside a wall. That does not apply to 2D.
- **Direction matters.** "Instead of randomly moving the camera, a carefully selected easing function in a semantically significant direction" communicates more (Pichlmair & Johansen, citing Nijman). Nijman's own example: shake the screen *opposite* to the shot and push the shooter back a few pixels ([Game Developer](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)). Guilty Gear Xrd shakes vertically for a knockdown and horizontally for a horizontal slash (Lin et al.).

**The Art of Screenshake sequence** (Nijman, 2013, [video](https://www.youtube.com/watch?v=AJdEqssNZ-U)). The recreation devlog lists the layers including permanence, camera lerp, screenshake, player knockback, hit pause and weapon recoil ([DK Liao](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog)); Game Developer adds the "33% chance of enemies exploding harmlessly on death" tweak. I could not get a primary transcript with numbers, so the often-quoted per-shot numbers are omitted.

**Juice It or Lose It** (Jonasson & Purho, GDC Europe 2012, [GDC Vault](https://gdcvault.com/play/1016487/Juice-It-or-Lose)): tweening, squash and stretch, and "maximum output for minimum input" ([Game Developer coverage](https://gamedeveloper.com/design/video-is-your-game-juicy-enough-)).

**Slow motion** is usually reserved for finishing blows, making "climactic finishing attacks clearer" (Lin et al., citing One Finger Death Punch).

**Gore and tone.** Devolver's Nigel Lowrie on Hotline Miami: in a realistic game, gore "feels like gore for gore's sake"; in HM's stylised pixels it is "disgusting to think about … but not to look at" ([Sound & Vision](https://www.soundandvision.com/node/111390)). Party Hard found pixel art made violence feel less dark. Pixel art gives you room for dark comedy; keep blood dark, chunky and brief rather than anatomical.

**Not found:** Streets of Rage 4, Sifu, Hyper Light Drifter and Nuclear Throne developers have not published hit-stop or shake numbers that I could locate. Sifu's stated goal is "credibility … and esthetics, with crisp action and immersive camera framings", modelled on *The Raid* ([PlayStation Blog](https://blog.playstation.com/2021/11/18/how-sifus-kung-fu-combat-works/)).

### 4.2 A punch recipe for Knockout Day *(suggestion: starting values, tune by feel)*

All times assume 60 fps. Distances are at 32 px/m. Event names refer to the existing `impact()` path.

| Stage | Player jab | Player haymaker / headbutt / bottle | Knockout blow | NPC-on-NPC (scale by `closeness`) |
|---|---|---|---|---|
| Anticipation (attacker) | 2-3 frames (33-50 ms) | 5-8 frames (80-130 ms) with a 1-2 px wind-back | Same as hit type | Same |
| Smear / impact frame | 1 frame of stretched arm or smear | 1-2 frames | 2 frames | — |
| Hit stop (attacker + victim only) | 50 ms | 90 ms | 140 ms, then slow-mo | 0-40 ms, victim only |
| Global freeze (whole sim) | none | none | 60 ms | none |
| Victim shake during freeze | ±1 px horizontal, tapering | ±2 px | ±2-3 px | ±1 px |
| White flash | 1 frame | 2 frames | 2 frames + 1 red frame | 1 frame |
| Camera kick (along punch direction, ease-out 120-180 ms) | 2 px | 4 px | 6 px | 0 |
| Trauma added | 0.15 | 0.3 | 0.55 | 0.05-0.15 x closeness |
| Knockback (ease-out over about 200 ms) | 0.2-0.3 m (6-10 px) | 0.6-1.0 m stagger | 1.5-2.5 m fall, 2-3 bounces, a skid decal | Same physics |
| Squash and stretch (victim) | 10% squash for 2 frames | 15-20% | Body flattens on landing | — |
| Particles | Small spot burst (spit, sweat) | Spot burst + 6-12 blood drops | Directional spray + pool | Fewer |
| Sound | Whoosh + slap/thud + grunt (pitch ±8%) | + low "body" layer + crowd "ooh" | + crunch + crowd roar or gasp, and music ducks 200 ms | Lower volume, panned |
| Slow-mo | — | — | 0.3x for 350 ms, then ease to 1x over 200 ms | — |
| Camera control | — | — | On phones, step in one zoom level for about 1.5 s | — |

**Implementation notes against the current code:**
- **Freeze locally, not globally.** `hitStopUntil` currently halts `stepper.advance` for everyone. Freeze only the attacker and victim (skip their animation and movement updates) and keep the world running, so a punch in a 200-person crowd does not stutter the whole match. Reserve a short global freeze for the player's knockouts (Sakurai; Godot checklist).
- **Shake with smooth noise and a direction.** The shake currently adds `Math.random()` offsets every frame. That is white-noise jitter, which reads as cheap and can blur pixel art. Switch to 1D Perlin or value noise (Eiserloh), add the directional kick, and **round the final camera scroll to whole art pixels** to keep the pixel grid stable. Skip camera *rotation*: rotating a pixel-art camera breaks the pixel grid.
- **Max offset.** The current peak is about 9 x (S/16) px, roughly 18 px at S = 32. For pixel art on a phone that is fine as a ceiling, but most hits should land at 3-6 px. With trauma² and 0.15-0.3 per punch you get about 0.4-1.6 px; the directional kick does the real work.
- **Sound must land on the hit-stop frame**, not when the input resolves (the sound coherence finding).
- **Persistence.** Already present for blood. Add knocked-out bodies, dropped pints and teeth, and a scuff decal where someone skidded.
- **Readability guard (Kao).** Cap the number of simultaneous juiced events and drop shake for off-screen or distant fights, so the player can still tell what they caused.

---

## 5. Realistic, gritty (not cute) pixel art

**What the reference games do:**
- **One pixel density, everything at it.** Signalis renders everything, 3D included, at 640x360 ([IndieGraze](https://indiegraze.com/?p=989)). Blasphemous is "purist": "nothing in the game is outside pixel art" ([Hollywood Reporter](https://www.hollywoodreporter.com/heat-vision/blasphemous-designer-purist-approach-games-pixel-art-style-1238370)). The game's own "one pixel, one camera" decision already matches this.
- **Darkness with a single accent.** Signalis is "lots of blacks and greys, but then there's red" (review summary). Katana Zero uses its neon lighting to *unify* mismatched assets ([MCV/Develop](https://www.mcvuk.com/business-news/askiisoft-katana-zero/)). That technique is directly useful for AI-generated sprites, which drift in style: **a shared grade or light pass hides inconsistency.**
- **Lighting as the realism engine.** The Last Night placed animated pixel sprites in a 3D space with modern lighting and post-effects ([Famitsu](https://www.famitsu.com/news/201712/22148711.html)). Eastward and Children of Morta do the same with dynamic lights. Michael Vicente's PBR pixel-art experiments add roughness and metalness to normal maps, but warn of "quite a heavier load than traditional 2D" ([80.lv](https://80.lv/articles/exploring-next-gen-pixel-art-with-real-time-dynamic-lighting)).
- **Urban decay in the details.** Eastward's "urban decay" draws on Kowloon Walled City, with "thousands of little touches" ([Nintendo](https://nintendo.com/us/whatsnew/how-the-developers-began-making-then-remaking-eastward); 80.lv). Escapists 2 adds "cracks, litter, and puddles" to otherwise white-boxed rooms.
- **Muted, restrained palettes.** Return of the Obra Dinn and Papers Please (Lucas Pope) show that a strict palette restriction reads as serious, not cute. Pope moved from Bayer to blue-noise dithering for stability ([Game Developer](https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic)). I found no primary Papers Please palette write-up.
- **British settings.** *Not Tonight* (PanicBarn) is the nearest grim British pixel-art reference, described as "a nightmarish mixture of a LucasArts adventure game and Papers Please" in a post-Brexit setting ([Nintendo Life](https://www.nintendolife.com/news/2019/07/battle_brexit_on_switch_with_not_tonight_take_back_control_edition)). *Untitled Goose Game* proves an English setting can carry a systemic comedy sandbox. Its look is clean and pastel; borrow its comedy, not its palette. I found no developer art-direction write-up specific to British urban pixel art. Evidence there is thin.

**Recommendations for Knockout Day's look:**
1. **Proportions.** Avoid PixelLab's chibi defaults: heads at 1/6-1/7 of height, so about 9-10 px on a 60 px figure. Use several body types: the fat lead, thin lads, older men, women, kids, stewards in bulky hi-vis, police with vests and hats. The current single recoloured body is the biggest "cute" tell *(suggestion; matches DECISIONS "realistic proportions and several body types")*.
2. **Real-world colour coding is free readability.** British match days already code by colour:
   - Stewards in orange or yellow hi-vis tabards with STEWARD printed on the back.
   - Police in yellow hi-vis with blue and yellow chequered (Battenburg-style) markings and black.
   - Medics in green.
   - Away fans in one kit colour, home fans in another.
   - Players in kit with numbers.
   Push those as the *only* saturated colours in the scene, with everything else (brick, concrete, tarmac, overcast sky, coats) muted and grey-brown. Saturation then means "a role", which is the TF2 lesson (value and hue carry identification) applied to a crowd *(suggestion)*.
3. **Palette and grade.** A global overcast LUT: lower saturation, cool shadows, warm practical lights (pub windows, the bookies' fluorescents, sodium and LED streetlights), and white-blue floodlights for the evening kick-off. Use 2-3 LUTs over the day, following Graveyard Keeper's per-time LUTs.
4. **Grime layer.** Decals for wall-base dirt, gum spots, drain streaks, rain staining under sills, chewing-gum pavement, weeds in cracks, flyposters, faded graffiti tags, bins overflowing after half-time. Keep them non-interactive and low-contrast, so they do not become clutter (Escapists 2's readability lesson).
5. **British specificity** (props are what sell "real"): double yellow lines, bollards, wheelie bins, a Belisha beacon, a red phone box turned defibrillator, a burger van, a betting-shop fascia, a chippy, a charity-shop window, a pub chalkboard ("SKY SPORTS SHOWN HERE"), police vans with chequered livery, turnstiles, programme sellers, cans in carrier bags, pigeons, grey drizzle.
6. **Gore tone.** Dark, slightly desaturated reds (the current 0x5a0808-0x8a1010 range is right). Brief arterial sprays only on knives and the dog. Pools that darken as they dry. HM's lesson: the stylised scale makes it watchable, so do not add anatomical detail.
7. **Outline policy.** A thin, darker-than-local-colour outline (selective outline), not pure black, reads less cartoony. Pure black outlines are a strong "cute" and "storybook" signal *(observation from pixel-art practice)*. Interactive items get a 1 px light rim (Streets of Rogue 2).

---

## 6. Ranked recommendations (impact vs effort)

| # | Recommendation | Impact | Effort | Why |
|---|---|---|---|---|
| 1 | **Make hit-stop local** (attacker and victim freeze; world runs) and set per-hit values (50 / 90 / 140 ms); short global freeze only for the player's knockouts | High | Low | Hit stop is the top impact-feel factor; a global freeze in a 200-NPC sim stutters the match |
| 2 | **Replace random-per-frame shake with Perlin trauma shake + a directional camera kick**, snapped to whole art pixels; no rotation | High | Low | Eiserloh; Nijman; Pichlmair & Johansen |
| 3 | **Sound layering locked to the hit frame** (whoosh + impact + body + vocal, ±8% pitch, crowd "ooh"); duck music on knockouts | High | Low-Med | Sound coherence is a top-3 factor |
| 4 | **Knockback, stagger and fall with squash, plus a knockout slow-mo (0.3x, 350 ms)**; bodies stay on the floor | High | Med | Lin et al. (slow-mo on finishers); Nijman (permanence) |
| 5 | **Contact shadows under everything + a global overcast LUT/grade + additive light layer** (floodlights, windows, police lights) | High | Low-Med | Graveyard Keeper, Eastward, Children of Morta; Katana Zero's grade unifies AI art |
| 6 | **Saturation discipline:** muted world, saturated roles (hi-vis, police, kits) | High | Low | TF2 readability; uses real British colour coding |
| 7 | **Occlusion silhouettes** for the player and targets behind walls and roofs; a camera-side cutaway for the near stand | High | Med | The main oblique weakness; keeps the projection |
| 8 | **Phone: snap-to-target taps (44 pt) and a one-step auto zoom-in during fights** | High (phones) | Low | Apple HIG; camera-control finding |
| 9 | **Animated crowd tiles with palette cycling, driven by match state** | High (stadium) | Med | Ferrari's colour cycling; cheap mass animation |
| 10 | **Sway shader** for flags, scarves, bunting, trees, coats | Med | Low | Graveyard Keeper |
| 11 | **Persistent match-day mess:** litter accumulation, spilt pints, glass, scuffs, tyre marks | Med | Low-Med | Permanence; Escapists 2 grime |
| 12 | **NPC reactions to violence:** ring forms, phones up, stewards radio, people flee | Med-High | Med | Makes the systemic world look alive |
| 13 | **Weather particles:** drizzle, wet sheen, breath, flare smoke | Med | Low-Med | Atmosphere; Graveyard Keeper fog trick |
| 14 | **Realistic proportions and several body types** (regenerate the cast) | High | Med-High (asset gen) | The biggest remaining "cute" tell |
| 15 | **Phaser 4 normal-mapped lighting** on the hero, key props and the night stadium only | Med | Med-High | Breaks batching, so use selectively |
| 16 | **Monaco-style line-of-sight darkening** for stealth sections | Med | Med | Monaco 1/2 |
| 17 | (Later, only if needed) **3D stadium with pixel-density sprites**, Signalis/Gungeon style | Med | High | Only if multi-tier stands and vertical routes break 2D sorting |

**Projection verdict:** keep the three-quarter oblique at 32 px/m with 60 px people. It is the projection used by most comparable dense, readable, character-driven pixel games (Escapists, Stardew, Eastward, Gungeon). It shows the fronts of people, which is where uniforms and disguises live. It keeps the stadium and pitch rectilinear for landscape phones. Fix its two weaknesses (occlusion, and depth/height ambiguity) with silhouettes, cutaways, a camera-side stand convention and contact shadows. Isometric would add occlusion and draw-order cost (Project Zomboid) and turn the pitch into a diamond. True top-down maximises line of sight and density but destroys identity (Monaco's developer abandoned it for readability). HD-2D's look runs cosy, not grim, and Phaser is a 2D engine.

---

## 7. Sources

**Projection, scale and readability**
- Team17 / Mouldy Toof, *The Escapists 2: how pixel art works with gameplay*, 80.lv: https://80.lv/articles/the-escapists-2-how-pixel-art-works-with-gameplay
- Pixpil, *Eastward's creators share insights on making pixel art adventures*, Game Developer: https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures
- 80.lv, *Eastward: charming Chinese pixel art adventure*: https://80.lv/articles/eastward-charming-chinese-pixel-art-adventure
- Nintendo, *How the developers began making (then remaking) Eastward*: https://nintendo.com/us/whatsnew/how-the-developers-began-making-then-remaking-eastward
- CXong, *How many sprites do different perspectives need?*: https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need
- Significant Bits, *A layman's guide to projection in videogames*: https://www.significant-bits.com/a-laymans-guide-to-projection-in-videogames/
- Pixel Parmesan, *Fundamentals of isometric pixel art*: https://pixelparmesan.com/fundamentals-of-isometric-pixel-art/
- Slynyrd, Pixelblog 3/4 (graphical projection): https://www.slynyrd.com/blog/2018/3/14/pixelblog-3-graphical-projections-1 , https://slynyrd.com/blog/2018/4/12/pixelblog-4-graphical-projection-part-2 ; Pixelblog 35 (top-down interiors): https://www.slynyrd.com/blog/2021/11/30/pixelblog-35-top-down-interiors
- Dodge Roll on Enter the Gungeon native resolution (Steam): https://steamcommunity.com/app/311690/discussions/1/371919771751798558 ; itch.io dev comment on Gungeon's 3D construction: https://itch.io/post/4162405 ; Game Developer on Exit the Gungeon: https://www.gamedeveloper.com/design/building-i-enter-the-gungeon-i-s-dungeon-climbing-spin-off-i-exit-the-gungeon-i-
- Radical Fish, *Why do we use auto jump in CrossCode?*: https://www.radicalfishgames.com/?p=1168 ; The Avocado interview: https://the-avocado.org/2021/05/07/indie-developer-interview-radical-fish ; RPG Site on Alabaster Dawn: https://www.rpgsite.net/news/16135-radical-fish-games-announces-25d-pixel-art-action-rpg-alabaster-dawn-set-to-release-for-steam-early-access-in-2025
- Unreal Engine, *Octopath Traveler II builds a bigger, bolder world in its HD-2D style*: https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style ; Siliconera, Octopath developers: https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/
- Aftermath, Monaco 2 interview (Andy Schatz): https://aftermath.site/monaco-2-demo-interview/ ; Monaco (Wikipedia): https://en.wikipedia.org/wiki/Monaco:_What%27s_Yours_Is_Mine
- KillHouse Games, Door Kickers 2: https://inthekillhouse.com/doorkickers2 ; PC Gamer announcement: https://www.pcgamer.com/door-kickers-2-announced-out-next-winter
- Project Zomboid blog: https://projectzomboid.com/blog/?p=11777 ; NME on Build 42 rendering: https://www.nme.com/news/project-zomboids-very-big-build-42-update-will-introduce-basements-3320807 ; Steam thread on B42 wall hiding: https://steamcommunity.com/app/108600/discussions/0/596287304339830089/
- TechCrunch on GTA Chinatown Wars camera: https://techcrunch.com/?p=353232 ; Nintendo World Report preview: https://nintendoworldreport.com/preview/17744
- Stardew Valley forums on sprite sizes: https://forums.stardewvalley.net/threads/sprite-size-first-time-modding-sv.7128/latest ; tile-size guide (4x claim, unverified): https://freegamesprites.com/news/tile-size-2d-game-pixel-art-guide
- Sensible Software (Wikipedia): https://en.wikipedia.org/wiki/Sensible_Software ; The Set Pieces, Jon Hare: https://thesetpieces.com/?p=2212
- Streets of Rogue 2 readability (Dabrowski), repost: https://gatetonnu.pages.dev/posts/streets-of-rogue-2-developer-talks-pixel-art-readability-and-the-procedural-appeal-of-roguelikes
- Pinokl, *The making of Party Hard*, 80.lv: https://80.lv/articles/the-making-of-partd183-hard
- Valve, *Illustrative Rendering in Team Fortress 2* (NPAR 2007): https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf ; *Stylization with a Purpose* (GDC 2008): https://cdn.steamstatic.com/apps/valve/2008/GDC2008_StylizationWithAPurpose_TF2.pdf
- Apple Human Interface Guidelines, accessibility / touch targets: https://developer.apple.com/design/human-interface-guidelines/accessibility

**Ambient life, lighting and colour**
- Lazy Bear Games, *Graveyard Keeper: how the graphics effects are made*, Game Developer: https://www.gamedeveloper.com/programming/graveyard-keeper-how-the-graphics-effects-are-made
- Phaser, *Phaser 4 dynamic lighting*: https://phaser.io/news/2026/05/phaser-4-dynamic-lighting ; Phaser v4.2.0: https://phaser.io/news/2026/06/phaser-v4-2-0-released ; rendering concepts: https://phaser.io/tutorials/phaser-4-rendering-concepts
- Dead Mage, Children of Morta art (TechRaptor): https://techraptor.net/content/how-dead-mage-created-the-art-for-children-of-morta ; postmortem: https://gamedeveloper.com/design/postmortem-children-of-morta
- 80.lv, *Exploring next-gen pixel art with real-time dynamic lighting*: https://80.lv/articles/exploring-next-gen-pixel-art-with-real-time-dynamic-lighting
- Mark Ferrari, *8 Bit & '8 Bitish' Graphics: Outside the Box*, GDC 2016: https://gdcvault.com/play/1023586/8-Bit-8-Bitish-Graphics
- Famitsu on The Last Night's technique: https://www.famitsu.com/news/201712/22148711.html

**Combat feel**
- Jan Willem Nijman, *The Art of Screenshake* (2013): https://www.youtube.com/watch?v=AJdEqssNZ-U ; Game Developer summary: https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games ; DK Liao recreation devlog: https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog
- Martin Jonasson & Petri Purho, *Juice It or Lose It*, GDC Europe 2012: https://gdcvault.com/play/1016487/Juice-It-or-Lose ; Game Developer coverage: https://gamedeveloper.com/design/video-is-your-game-juicy-enough-
- Squirrel Eiserloh, *Math for Game Programmers: Juicing Your Cameras With Math*, GDC 2016: https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing ; Bevy example following it: https://docs.rs/bevy/0.17.3/src/2d_screen_shake/2d_screen_shake.rs.html ; KidsCanCode recipe: https://kidscancode.org/godot_recipes/3.x/2d/screen_shake/
- Lin, Duan, Wen & Cai, *What Features Influence Impact Feel? A Study of Impact Feedback in Action Games* (2022): https://arxiv.org/abs/2208.06155
- Pichlmair & Johansen, *Designing Game Feel: A Survey*: https://arxiv.org/abs/2011.09201
- Kao, *The effects of juiciness in an action RPG*, Entertainment Computing 34 (2020): https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html ; follow-up (CHI 2024): https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d
- Sakurai hit-stop techniques, Nintendo Wire summary: https://nintendowire.com/news/2022/12/12/this-week-in-sakurai-12-5-12-11-fine-tuning-hit-stop-and-cheating-the-system/ ; Famitsu column translation (Source Gaming): https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ ; SSB Wiki *Hitlag*: https://www.ssbwiki.com/Hitlag
- Godot game-feel checklist: https://forum.godotengine.org/t/game-feel-checklist-for-godot-4-hit-stop-trauma-shake-coyote-time-and-more/145340 ; uhiyama-lab hit stop: https://uhiyama-lab.com/en/notes/godot/hit-feedback-hitstop/
- Game Maker's Toolkit, *Secrets of Game Feel and Juice*: https://www.youtube.com/watch?v=216_5nu4aVQ
- Gamespot on Celeste's game-feel thread: https://www.gamespot.com/articles/celeste-dev-explains-how-they-made-their-game-feel/1100-6474775/
- Sloclap, *How Sifu's kung fu combat works*: https://blog.playstation.com/2021/11/18/how-sifus-kung-fu-combat-works/
- Hotline Miami interviews: https://www.ibtimes.co.uk/hotline-miami-dennis-wedin-jonatan-soderstrom-interview-447406 ; https://www.soundandvision.com/node/111390

**Gritty pixel art and British settings**
- Signalis, Alex Zwerger interview: https://indiegraze.com/?p=989
- Blasphemous, purist pixel art: https://www.hollywoodreporter.com/heat-vision/blasphemous-designer-purist-approach-games-pixel-art-style-1238370
- Katana Zero, MCV/Develop: https://www.mcvuk.com/business-news/askiisoft-katana-zero/
- Lucas Pope and 1-bit dithering: https://www.gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic
- Not Tonight (Nintendo Life): https://www.nintendolife.com/news/2019/07/battle_brexit_on_switch_with_not_tonight_take_back_control_edition
- Untitled Goose Game (Wikipedia): https://en.wikipedia.org/wiki/Untitled_Goose_Game

**Where evidence was thin.** I found no published per-sprite heights for most titles. Streets of Rage 4, Sifu, Nuclear Throne and Hyper Light Drifter have no developer-published hit-stop or shake numbers that I could find. I found no primary Papers Please palette write-up and no developer art-direction write-up on British urban pixel art. The knockback, anticipation and trauma values in §4.2 are design starting points, not sourced figures.
