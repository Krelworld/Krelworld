# KRELWORLD advert trailer: notes

- **`krelworld_trailer.mp4`**: 2:53.70, 1920x1080, 60 fps, AAC 48 kHz stereo, loudness -14 LUFS.
- **`krelworld_trailer_share.mp4`**: a smaller 720p copy for messaging apps.
- **`krelworld_trailer_contact.png`**: the contact sheet, one frame every 2 s.

## How it was made

- **Capture.**
  - The LAPTOP version (16:9) ran from a local dev server, with Playwright and a paused fake clock.
  - One game step of 16 ms is one captured frame, so every clip is a true 60 fps game recording. Math.random is seeded, so scouts and finals match.
  - Combat was played by a small capture-only autopilot. It patches the Controls prototype in the page only; no game code was changed.
- **Picture.**
  - The 960x540 canvas is upscaled with nearest-neighbour, cropping in for close-ups.
  - The game's own cinematic bars are cropped out, so the frame is never letterboxed or squashed.
- **Voices and lines.**
  - Character lines are the game's own recordings, cut from `public/audio/voice` at the frame each was said during capture.
  - No game dialogue was changed or invented.
  - The narrator is a stock ElevenLabs library voice ("Russell - Dramatic British TV"), not an imitation of anyone real.
- **Music.**
  - The score is three original ElevenLabs Music cues.
  - The end card adds the clean opening hook of the game's own theme song ("I'm crazy for that Krel World").
- **Sound effects.** Trailer hits, whooshes and the remote click come from ElevenLabs SFX. Gunfire, gore, farts, vomit and the Tap come from the game's own `public/audio/sfx`.
- **Content rules.**
  - Excluded: the Elon fight, Polson's death, Ch6–7 finale and boss spoilers, every episode on the earlier promo's exclusion list, and the Krex room (religious paedophile lines).
  - Sex and nudity appear only behind the game's own censor bars, and Krezz splats only as the game shows them.

## Clips, in order

| time | clip | source |
|---|---|---|
| 0:00.50 | Drongus's tower bursts out of the town square (pseudo-3D) | `f_rise: Hub, Chapter 1 (hub3d rise shot)` |
| 0:12.55 | Swoop over Krelford into the Crobley Factory (pseudo-3D) | `f_factory: Dungeon crobley_factory (dungeonSwoop)` |
| 0:18.02 | Polson Towers, The Mould Zone: top-down, gold minigun | `d_polson1: Dungeon polson_towers room 1` |
| 0:21.02 | Climbing the Cronster's tower, side-on | `f_tower: Dungeon ministry room 0 (tower climb)` |
| 0:23.43 | Uncle Rik in the Giant Hot Tub of Catford; shrink; INSIDE UNCLE RIK | `f_colon: Dungeon rik_colon (colonEntry)` |
| 0:27.25 | BeepBeep: SanMik's stolen Range Rover (pseudo-3D road) | `f_beep: BeepBeep` |
| 0:32.25 | Night of Freedom: SanMik drives, you're on the guns | `f_drive: Drive` |
| 0:36.45 | WONK YOUR THANG: the krezz jet stream | `f_wonk: Dungeon crobley_factory room 1 (jetStream)` |
| 0:39.70 | The gun rack at home | `f_rack: Home, gun rack` |
| 0:41.37 | The Kreddle Exchange: Pussy Juice Constitution, Resting Wonk Hand | `f_bank: Kreddle Exchange menu` |
| 0:43.03 | ...then put it to use: the Crobley Factory floor and the Catford Job Centre | `d_factory1 / d_sanmik2: Dungeon crobley_factory room 1, arena_sanmik room 2` |
| 0:50.53 | Over the bridge into Kreddle (pseudo-3D) | `f_kreddle: Kreddle (kreddleCrossing)` |
| 0:54.03 | Krazy Reels | `f_slots: Kreddle slots` |
| 0:56.03 | The Wonky Pole: watching up close (the game's own censor bars) | `f_club: Club, ClubCloseup` |
| 1:01.53 | The Great Pussy Juice Tap flows again | `f_tap: Hub, Chapter 1 clear (Tap flow)` |
| 1:06.23 | KrelTV · Krunche News: #ArsebrushGate | `tv_arse1/2: TV krews_arsebrush` |
| 1:19.43 | KrelTV · Krunche News: Andy Burnham's First Act | `tv_burnham: TV krews_burnham_first_act` |
| 1:25.90 | KrelTV · Krunche News: the Wetherspoons Cabinet's justice reform | `tv_wire: TV krews_justice` |
| 1:34.20 | Polson Gets Fit | `f_pgym: Vignette polson_gym` |
| 1:42.60 | Polson's gym, as seen on the War Room CCTV | `f_pcctv: Vignette polson_cctv` |
| 1:49.08 | Sludge time: the fart flashback | `f_sludge: Meeting fragmar_briefing` |
| 1:55.20 | The Cyst: Polson's pilonidal cyst, risen from his hoard | `f_hoard: Dungeon polson_towers room 3` |
| 2:02.12 | Reinhardt Crobley | `f_reinhardt: Dungeon crobley_factory room 4` |
| 2:11.25 | JQ, the Jam Queen | `f_jam: Dungeon arena_sanmik room 3` |
| 2:25.75 | Flirt Crobley | `f_flirt: Dungeon crobley_factory room 3` |
| 2:35.28 | KRELTALITIES | `f_krels: Dungeon pit_range, krelOn(boss, finisher) on Reinhardt, Tank, the Jam Queen, Fruity, Chad Deltoid` |

## Narrator script

> This winter... Krelford has run out of pussy juice.

> Shoot everything. Climb everything. Crawl through a seven-hundred-pound man's colon.

> Run over twenty-five pedestrians... for a friend. Wonk... your... THANG.

> Upgrade your arsenal. Gamble your life savings at the Kreddle Exchange. Enjoy a tasteful evening at the Wonky Pole. Restore the national drink.

> Watch the finest television ever broadcast. Meet Polson. He's on a journey.

> Face unspeakable evil. And when it's over... MAKE SURE.

> KRELWORLD. Wonk til you krez. Play free on your phone or laptop. Tell nobody.

