# Knockout Day: should the on-foot view be a behind-the-player camera?

Follow-up to `research-visuals.md`. The question: should the main on-foot view become a pseudo-3D chase or over-the-shoulder camera (billboard sprites or low-poly figures, like the existing Beep Beep-style `drive3d.ts` driving view) instead of the current three-quarter oblique overhead (22 pt/m on phones, 32 pt/m on larger screens)?

**Short answer: no.** Keep the overhead view as the main on-foot view. Use behind and close cameras for set pieces where the player is not reading a crowd: driving, the tunnel walk-out, knockouts, maybe the pitch invasion run-in. Fix the overhead view's real weakness, which is threats at or just past the screen edge, with off-screen indicators, a look-ahead, and an optional farther zoom.

**How to read this:**
- The behind-camera literature is mostly reviews, postmortems and engine docs. Controlled studies of camera type on phones are almost non-existent.
- *(observation)* marks widely known facts about a game with no citation found.
- *(calculation)* marks my own arithmetic.

---

## 1. What comparable games chose, and why

### 1.1 Games that moved between cameras

**GTA 1/2 → GTA III (behind) → Chinatown Wars (angled overhead).**
- DMA switched to 3D to put players "in this world, not above it" (Aaron Garbut, art director) ([GamesRadar](https://www.gamesradar.com/games/grand-theft-auto/releasing-gta-3-was-cathartic-reflects-its-art-director-we-were-a-young-team-relatively-inexperienced/); [Inverse](https://inverse.com/gaming/gta-3-20th-anniversary-rockstar-aaron-garbut)). The new engine and camera prompted "an almost existential rethink" of what GTA was ([TechRadar](https://www.techradar.com/news/gta-3d-how-rockstar-games-took-liberty-city-into-the-open-world)).
- GTA III still shipped a top-down camera *option* ([Game Informer](https://gameinformer.com/feature/2022/12/19/20-years-of-liberty-city)).
- The motive was immersion and spectacle, not readability.
- When Rockstar Leeds made GTA for a **small screen** (Nintendo DS), it went back to a pseudo-top-down angle "to make the most use of the DS' limited screen real estate" ([TechCrunch](https://techcrunch.com/?p=353232)).

**Hitman console games → Hitman GO and Hitman Sniper on phones.**
- On console, the Hitman series (third-person, behind the player) is the systemic disguise-and-sabotage benchmark.
- It needs heavy compensation to work from behind: Instinct vision (see targets and guards through walls), suspicion indicators, a minimap and blend-in rules. In Absolution "players are notified of guard suspicion by a circular splodge" near the hit notifier, and blending was "intrinsically part of Agent 47's instinct vision" ([PC Gamer](https://pcgamer.com/hitman-absolution-hands-on); [GamesRadar](https://www.gamesradar.com/hitman-everybodys-gunning-sharp-dressed-man/); [Hitman wiki, Instinct](https://hitman.fandom.com/wiki/Instinct_Mode)).
- IO built the crowds as a tech project in its own right: "1,200 character crowds" in Absolution, and up to 700 on screen in Hitman 2 ([MCV](https://mcvuk.com/?p=99805); [Intel/IO slides](https://www.intel.com/content/dam/develop/external/us/en/documents/06-create-a-scalable-and-destructible-world-in-hitman2-807276.pdf)).
- **When Square Enix took Hitman to phones, neither mobile game used a free behind camera:**
  - Hitman GO is a top-down diorama board game, because "Hitman has always been a thinking man's game… a board game… gives you a lot of time to think and plan" ([Game Developer](https://www.gamedeveloper.com/design/for-square-enix-designing-i-hitman-i-as-a-board-game-just-made-sense); [GDC 2015 postmortem](https://gdcvault.com/play/1021908/Design-by-Constraints-Hitman-GO)).
  - Hitman Sniper fixes you in one position. A reviewer says the stationary design "makes its touchscreen controls… feel smooth and effective" ([Android Central](https://www.androidcentral.com/hitman-sniper-the-shadows-review); [Game Informer](https://gameinformer.com/games/hitman_sniper/b/ios/archive/2014/06/13/hitman-sniper-shoots-to-kill-on-mobile.aspx)).

**Monaco → Monaco 2.** Moved from top-down to an isometric 3D view (still overhead, not behind) because "Some people's brains literally cannot parse" the first game ([Aftermath](https://aftermath.site/monaco-2-demo-interview/)). The lesson is "top-down is too abstract", not "go behind".

### 1.2 Games that stayed overhead or fixed-angle for systemic play

- **Untitled Goose Game** (a comedic systemic sabotage sandbox: the closest tonal and mechanical cousin).
  - It is 3D, but the camera is a **semi-fixed, high three-quarter follow camera** that the player can only zoom.
  - Reviewers' main complaint is that the camera leans toward nearby humans and, when "several humans nearby, all in different parts of the environment… [it] start[s] flipping between humans in a disorienting fashion" ([Nintendo World Report](https://nintendoworldreport.com/review/51756/untitled-goose-game-switch-review)).
  - It "pans sporadically" and zooming out reduces this ([Destructoid](https://www.destructoid.com/reviews/review-untitled-goose-game/)). The fixed angle means you can blunder into people you meant to avoid ([Uproxx](https://uproxx.com/gaming/untitled-goose-game-review-nintendo-switch)).
  - **Lesson:** even a high, fixed-angle 3D camera causes awareness problems in a crowd sandbox, and automatic reframing toward NPCs annoys players.
- **Disco Elysium** chose isometric because "the isometric image is wonderful in that it is flat", so the game could be designed "as if it was a painting" ([PC Gamer](https://www.pcgamer.com/games/rpg/why-does-isometric-perspective-suit-disco-elysium-you-can-design-the-entire-game-as-if-it-was-a-painting)). This is an art-direction argument that also suits a hand-dressed pixel diorama.
- **Hotline Miami 2** stayed top-down. Reviewers' biggest complaint was being killed "by something that comes or shoots at you from off-screen" in larger levels, despite a Shift look-ahead ([PC Gamer review](https://pcgamer.com/hotline-miami-2-wrong-number-review); [PC Gamer reappraisal](https://www.pcgamer.com/reappraising-hotline-miami-2); [Shacknews](https://www.shacknews.com/article/88590/hotline-miami-2-wrong-number-review-call-again)). One review credits a lock-on that "shows an arrow towards that area" when the target is off-screen ([Softpedia](https://www.softpedia.com/reviews/games/pc/Hotline-Miami-2-Wrong-Number-Review-475749.shtml)).
  - **Lesson:** awareness of off-screen threats is the critical variable. A behind camera makes it dramatically worse, because everything behind and beside you is off-screen.
- **Diablo IV:** players complained the default camera was too close, so "monsters can see you and attack while you can't see them". Blizzard permanently added a wider "Far" setting ([Blizzard forums thread](https://eu.forums.blizzard.com/en/d4/t/diablo-4s-camera-is-too-zoomed-in/2443); [Gamepressure](https://www.gamepressure.com/diablo-iv/can-you-zoom-out-the-camera/zd10c90)).
- **Diablo Immortal** is mobile-first with direct character control under a high overhead camera *(observation)*. Blizzard notes fingers cover part of the action but players "melt right into the game" ([TechRadar](https://www.techradar.com/news/why-diablo-immortal-had-to-be-a-mobile-game-first)).
- **Party Hard, Streets of Rogue, Prison Architect, Door Kickers 2** are all overhead (see the first report). Door Kickers 2 explicitly bills its view as "optimized for tactical analysis" ([KillHouse](https://inthekillhouse.com/doorkickers2)).
- **Mark of the Ninja** (stealth moved from 3D to 2D): Nels Anderson's "Heresies" include making visibility unambiguous (binary light and dark rather than a meter) ([Game Developer](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules); [PC Gamer](https://pcgamer.com/stealth-game-design-mark-of-the-ninja)). Fixed, wide 2D views make that kind of perfect information possible.

### 1.3 Behind-camera crowd games, and what they need to compensate

- **Watch Dogs 2** has a reactive crowd. Reactions propagate between NPCs, gated by distance and line of sight (GDC 2017, Blouin-Payer; [Game Developer](https://gamedeveloper.com/design/video-how-i-watch-dogs-2-i-created-a-reactive-crowd-of-npcs); [Japanese report](https://game.watch.impress.co.jp/docs/news/1046796.html)). It relies on a minimap, a profiler overlay and detection meters to tell you who is who *(observation)*.
- **Dead Rising** shows up to 800-1,000 zombies ([MobyGames](https://www.mobygames.com/game/23514)) and Dead Rising 2 up to 7,000 ([Kotaku](https://kotaku.com/dead-rising-2-7-000-zombies-and-plenty-of-chainsaws-5229775)). Its crowds are *undifferentiated*: you never need to read one zombie's uniform. That is the opposite of Knockout Day's crowds.
- **Yakuza, Shenmue, Assassin's Creed** use behind cameras in dense streets, with a minimap or radar and enemy markers *(observation)*.
  - Assassin's Creed Syndicate's camera "often bounces off objects and walls" in narrow streets.
  - The usual fixes are dithering geometry near the camera (The Witcher 3), silhouettes through walls (Mario Sunshine), cut-out views (For Honor) and "whisker" raycasts ([Game Developer, third-person camera problems](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games); [Unreal tech blog](https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera)).
- **Thief and Dishonored** (first person) use a light gem or visibility meter, sound, and in Dishonored's case "Dark Vision" X-ray *(observation)*.
- **John Nesky** (camera designer on Journey) calls dynamic third-person cameras "the hardest to design" ([GDC 2014, 50 Camera Mistakes](https://gdcvault.com/play/1020460/50-Camera); [Vice](https://www.vice.com/en/article/lights-camera-distraction-the-problem-with-virtual-camera-systems)). A secondhand slide summary puts "using a dynamic camera where a simpler one would do" first in his list (unverified).

**Compensations a behind view would need here (summary).** You would have to add all of the following, and each is a system to design and tune:
- A minimap or radar with stewards, police and targets.
- Detection or suspicion meters with off-screen direction markers.
- An X-ray or "instinct" vision through walls and crowds.
- Directional sound cues.
- Camera collision handling (whiskers, dithering).
- Camera rotation controls.
- Auto-recentre.

Most of these exist only to restore information the overhead view already gives for free.

### 1.4 What a behind camera costs this game specifically *(calculation)*

The existing `Camera3` sets focal length `F = max(w, 1.3h) x 0.62`. On a landscape phone (852x393 pt) that gives F ≈ 528 pt and a horizontal FOV of about **78°**.

| | Overhead (now, 22 pt/m) | Behind camera (78° FOV) |
|---|---|---|
| Awareness arc | 360° around the player, about ±20 m left/right and ±9 m up/down | About 78° forward wedge; **0° behind**, nothing beside you past about 2 m |
| Size of a person (1.8 m) | 40 pt everywhere on screen | 95 pt at 10 m, 32 pt at 30 m, 19 pt at 50 m |
| Crowd reading | Every head visible at once; uniforms side by side | The nearest 2-3 people block the rest of the crowd (occlusion by depth) |
| Line of sight | Readable as geometry on the map | Has to be inferred, or shown with meters |
| Stands and terraces | Seen as a sheet of faces (far stand) | Strong perspective; you see the backs of the rows in front |

Knockout Day's core reads are:
- Who is a steward, a copper, a player or a fan.
- Who is looking at me.
- Where the exits and the coach are.
- Where the pit bull is.

All of these depend on a wide, even-scale, all-round view. The behind view trades them for presence and spectacle.

---

## 2. Phones: third-person camera control on touch

**What the evidence says:**
- **GTA San Andreas mobile.** GameSpot singled out "the lack of an extra analog stick for controlling the camera… particularly in a firefight". Pocket-lint found the controls "taxing" and they leave "you feeling disconnected"; Android Authority called them "a tad clunky" ([Android Authority](https://www.androidauthority.com/grand-theft-auto-san-andreas-android-review-326766/); [Pocket-lint](https://www.pocket-lint.com/games/reviews/rockstar/125822-grand-theft-auto-san-andreas-iphone-and-ipad-review); [AppSpy](https://www.appspy.com/review/8039/grand-theft-auto-san-andreas)). Critics recommended a controller. These are ports, not designs built for touch, but they are the clearest evidence that a full behind camera plus twin sticks is a struggle on glass.
- **Hitman GO and Hitman Sniper.** Square Enix's own mobile Hitman games avoided free third-person movement altogether (§1.1).
- **Into the Dead** (first person on phones) removed free steering: you auto-sprint and only steer left and right ([Pocket Gamer](https://www.pocketgamer.com/into-the-dead/first-person-endless-runner-into-the-dead-charges-onto-android)). I found no developer rationale for this.
- **Brawl Stars.** Supercell's talk on Brawl Stars says the controls were rebuilt several times over about 545 days of testing. Early testers did not hold phones the way the developers did ([GDC Vault](https://gdcvault.com/browse/gdc-19/play/1025751); [Vida Extra summary](https://www.vidaextra.com/esports/razones-adios-al-modo-vertical-prototipos-brawl-stars-disenador-supercell-desvela)). The shipped game is an overhead camera with twin virtual sticks *(observation)*.
- **Academic work.** Zaman & MacKenzie compared on-screen game controls on a touchscreen phone; earlier work found physical buttons beat touch input ([York University](https://www.yorku.ca/mack/mhci2013a.html)). Patents from mobile publishers describe fixed-position virtual sticks causing "misoperations in tense fights" and repeated thumb resets ([USPTO](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10500484); [USPTO](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11465040)).
- **Camera-type guidance.** A third-person camera review notes a fixed camera means "casual players do not have to take the trouble to control the camera manually" ([Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games)). Engine docs (Snap, Minecraft, Unity) describe the standard mobile options: auto-follow that rotates toward travel, or drag-to-orbit in a reserved screen area ([Snap Camera Controller](https://developers.snap.com/lens-studio/features/games/camera-controller); [Minecraft control schemes](https://learn.microsoft.com/en-us/minecraft/creator/documents/controlschemes)).
- **Motion sickness.** Games with lots of depth motion produced more simulator-sickness effects than side-scrollers ([Schild et al., CHI 2014](https://www.eecs.ucf.edu/~jjl/pubs/chi2014_Schild.pdf)). I found no prevalence figure for third-person cameras.
- **Evidence gap.** I found **no controlled study** comparing casual players' success with a fixed overhead view against a behind camera on phones. Industry practice leans overhead or fixed for mobile action and strategy. Behind cameras are reserved for games whose audience accepts twin sticks: PUBG Mobile, Genshin Impact, Fortnite *(observation)*.

**For this game:** an auto-follow behind camera on a phone would need either a second thumb for the camera (which you need for punch, use, talk and items) or auto-rotation toward travel. Auto-rotation spins the world whenever you turn, which is bad for reading a crowd and plausibly bad for motion comfort.

---

## 3. Billboard pixel sprites in a 3D behind view

- **The art does not match the angle.** The PixelLab characters are drawn from a "low top-down" (overhead three-quarter) viewpoint. A low behind camera looks at them almost horizontally, so they appear tipped back toward the viewer, with too much top-of-head and shoulders, and feet sliding over the ground. Upright billboards also flatten depending on camera height and angle; the usual fix is to account for camera pitch in the billboard rotation ([Unity discussion](https://discussions.unity.com/t/multi-angle-sprites-mechanics/654955); [gamedev.net](https://gamedev.net/forums/topic/680181-question-on-camera-rotation-on-2d-billboard-sprite-3d-level/)).
- **Pokémon Black & White** is the reference that works. Its camera is pitched at about 45° and the sprites are always flat to the screen, "a bit like a sticker". Even so, the hardest problem was billboard sprites looking "terrible when scaled at low resolution" ([write-up](https://mjakeman.substack.com/p/recreating-the-25d-effect-from-pokemon)).
- **Octopath (HD-2D)** limited "how far we could rotate the camera without compromising graphical fidelity", and its sprites look paper-flat next to 3D backgrounds ([Unreal Engine](https://www.unrealengine.com/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style)).
- **Paper Mario** turns the flatness into the joke *(observation)*.
- **Doom- and Daggerfall-style 8-angle sprites** pick the frame from the angle between the sprite's facing and the camera. They "get a bit weird… from a direct top down angle" ([Godot Shaders](https://godotshaders.com/shader/multi-directional-sprite-shader/)), and in a chase view, 8 angles show visible pops as people turn. Retro shooters live with this because enemies face you most of the time.
- **Scale and pixel density.** Perspective scaling means sprites are drawn at non-integer, constantly changing scales, which breaks the "one pixel density" rule the game just adopted. Signalis's fix is to render the whole 3D scene at a fixed low resolution (640x360) and upscale ([IndieGraze](https://indiegraze.com/?p=989)). For a phone landscape view that would mean rendering at about 426x197 and upscaling 2x: chunky, and still sized by distance.
- **Cost.** In WebGL, 240 billboards is trivial to draw. The real costs:
  - **Engineering:** Phaser 4 is 2D. The existing `drive3d.ts` is a hand-written painter's-algorithm projector with flat shapes, with no depth buffer, textured walls or interiors. Rebuilding stadium interiors, cutaway roofs, stands and doors in 3D is close to a new game's rendering layer.
  - **Art:** every building and prop drawn for the oblique view, at 32 px/m with upright faces, would need 3D geometry or many-angle versions.

---

## 4. Hybrids that work

**1. Overhead main view plus situational cinematic cameras.**

This is the strongest pattern: GTA III kept an optional top-down view, and Chinatown Wars reverted to one on a small screen. Use the behind view where the player isn't reading a crowd and input is simple:
- **Driving** (already done, Beep Beep style).
- **The tunnel walk-out**: a scripted, behind-the-shoulder walk with the roar building and minimal input. Pure spectacle.
- **Knockouts and big hits**: a brief close-up or slow-motion beat. The impact-feel study found dedicated camera control on finishers is one of the three things separating well-liked combat from poorly liked combat ([Lin et al. 2022](https://arxiv.org/abs/2208.06155)).
- **Pitch invasion run-in**: a 2-3 s behind-camera sprint out of the stand, then cut back to overhead for the steward chase.
- **Disguise "inspection" moments** (a steward looks you up and down): a close two-shot.

Keep these short. Hand control back in the overhead view.

**2. A closer, lower *2D* overhead on demand, not a 3D tilt.**
- Step the zoom in automatically for fights (21 → 32 pt/m on phones; already recommended in the first report).
- Add an optional "far" step for planning, which is what Diablo IV and Goose Game players asked for.

**3. Diablo- or Goose-style tilted 3D follow camera.** I do not recommend it here. Goose shows that even this hybrid produced the camera complaints in its reviews. It would cost the pixel-perfect oblique art for little reading gain.

**4. Restoring information in the overhead view** (cheap, and these fix what a behind camera would supposedly offer):
- Off-screen **edge arrows** for anyone chasing you, your target and the dog (HM2's lock-on arrow).
- **Look-ahead** toward movement and toward the nearest threat (HM2's Shift).
- **Suspicion pips** over NPCs who have clocked you (Hitman).
- Silhouettes through roofs and walls (Mario Sunshine and the first report).
- Directional audio: whistles, radios, the dog's bark.

---

## 5. Is the current distance right?

Current phone view *(calculation)*: 22 pt/m (21.3 actual on a 3x screen at zoom 2) shows about 40 x 18 m with people about 40 pt tall. The laptop view is 32 pt/m.

- **Person size is fine.** A 40 pt figure (about 6.6 mm) shows kit colour, hi-vis and silhouette. The evidence only says players get frustrated when they're attacked from off-screen (Diablo IV, HM2). I found no study giving an optimal pt/m.
- **The weak axis is vertical:** ±9 m above and below the player. A steward running at about 6 m/s *(assumption)* crosses that in about 1.5 s. HM2 and Diablo IV show that this is where complaints come from.

**Recommendations:**
- **Keep 21-22 pt/m as the phone default.**
- **Bias the camera lead vertically:** lead further in the direction of travel, and toward the nearest pursuer.
- **Add edge arrows** for pursuers and targets. This is the cheapest high-value fix.
- **Offer a far step.** With whole-number steps on a 3x phone, the next step out is 10.7 pt/m (figures about 20 pt), which is too small for a default but good as a hold-to-survey "planning" view. Fractional zoom (for example 16 pt/m) breaks pixel crispness. At 3x density the unevenness is less visible, but it should be tested before adopting.
- **Step in for fights:** 32 pt/m, the larger-screen default, for the duration of a brawl near the player.
- **Laptop:** 32 pt/m shows about 45 x 28 m at 1440x900, so laptops already see more. If you want parity, cap the view by visible height rather than raising phone zoom.

---

## Verdict

- **Main view:** keep the overhead three-quarter oblique view.
  - A behind camera removes 280° of awareness.
  - In a crowd, near bodies hide far ones.
  - Uniform and line-of-sight reading gets worse.
  - It needs a stack of compensations (radar, meters, X-ray, camera controls).
  - On phones it needs either a camera thumb or an auto-rotating world.
  - It breaks the one-pixel-density pixel-art pipeline.
  - It means rebuilding the world renderer outside Phaser's 2D strengths.
  - Hitman's own phone spin-offs, Chinatown Wars on DS and Monaco 2 all chose overhead or fixed views for small-screen readability.
- **Best hybrid:** overhead plus short scripted behind or close cameras for driving, the tunnel walk-out, the pitch-invasion run-in, inspection moments and knockout replays, built on the existing `drive3d.ts` renderer where possible.
- **Distance:** keep 21-22 pt/m on phones. Add a vertical look-ahead and threat edge-arrows, auto-step in to 32 pt/m for fights, and offer a hold-to-survey far view.

**Evidence gaps:**
- No controlled study comparing casual players on phones with overhead versus behind cameras.
- No published optimal pt/m for crowd reading on phones.
- No primary House House statement on the Goose camera (the evidence is from reviews).
- No primary Diablo IV statement on why the default was close.
- No primary Brawl Stars statement on its camera.
