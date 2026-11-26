# ga-06: "There weee no sound effects in dungeon" (phones)

Branch `sfx` (worktree `scratchpad/sfx-wt`, from LIVE 0da900db). **No commits. The fix is already in wave 1 (s3-tap) and so in wave 2 (s3-games).**

## What was wrong (plain English)

- **Most likely cause, iPhone only: the ringer (silent) switch.** On an iPhone, Safari mutes Web Audio when the phone is on silent but keeps playing `<audio>` elements. In the LIVE game every sound effect goes through Web Audio, and so do the voice lines at normal speed, the dungeon ambience and the chiptune songs. The recorded songs are `<audio>` elements. On silent you get the song and no effects (and no voices). LIVE never tells Safari the game is a "playback" app. Measured with an emulated `navigator.audioSession`: LIVE leaves it at `"auto"` after the first tap. s3-tap and s3-games set it to `"playback"` on the first tap.
- **Second iPhone problem in LIVE, so effects sound buried even with the switch off.** iPhone ignores an `<audio>` element's volume. On LIVE iPhones the song plays at 100% and not the game's 54% (dungeon). Measured through a phone-speaker filter, the dungeon song (crankey_crandle) is about -18.5 dB RMS at full volume and about -23.8 dB at the game's level. The effects while fighting are about -22 to -23 dB. On a laptop, effects and song are about level. On a LIVE iPhone the song is about 5 dB over the effects, and the dungeon also turns effects down on purpose (x0.68). Wave 1 sends songs through a Web Audio gain so the volume works. Wave 2's phone mix raises effects by about 6 dB.
- **Everything else is fine. Nothing in the phone code skips or mutes the sound.** Auto-fire and FIRE drive `TOUCH.attack`, which is the game's own fire path with its own `synth.play` calls. I found no muted flag, no silent auto-fire and no phone code that touches `sfxGain`. The shell only suspends the context while the page is hidden or the phone is upright, and resumes it on return and on every touchend.
- **Android:** I found nothing. In emulation, effects reach the speakers exactly as on iPhone. If the user has Android, see the checks below.

## Evidence (Chromium, real touch, dev servers; script `scratchpad/mobile/work/sfx/probe.cjs`, raw JSON next to it)

- **Method:** the Enter gate is tapped. DebugSkip's boss jump takes us into Wildern room 1 (chapter 2 kit). Then 6 s standing (auto-fire on, the default), then 5 s of real touch held on FIRE. Analysers are tapped on every connection to the game context's speakers and on `sfxGain`. `synth.play` calls are counted.

| Build / profile | ctx | sfx gain | effects bus peak / RMS | speakers peak / RMS / heard RMS | `synth.play` calls (idle, FIRE) |
|---|---|---|---|---|---|
| LIVE iPhone 14 landscape | running | 0.326 (0.8 x 0.6 x 0.68 dungeon) | -4.4 / -18.1 dB | -6.3 / -20.0 / -23.2 dB | 47, 38 (gun_bfk, gun_disco, explode, hit, splat, coin...) |
| LIVE Android 740x360 | running | 0.326 | -5.7 / -18.5 dB | -7.6 / -20.4 dB | 40, 41 |
| LIVE laptop | running | 0.326 | same graph (fewer shots in the window: the mouse hold, no auto-fire) | ambience heard | 1, 4 |
| s3-tap iPhone | running | 0.326 | -5.5 / -17.1 dB | -4.8 / -18.0 dB (song included now) | 45, 25 |
| s3-games iPhone | running | 0.326 | -5.6 / -18.4 dB | -3.3 / -16.2 dB (song + mix) | 43, 9 |

- **Audio session after the first tap** (emulated API, `session.cjs`): LIVE `auto` (never set). s3-tap `playback`. s3-games `playback`.
- **What emulation cannot show:** Chromium has no ringer switch and no real `audioSession`. The silent-switch diagnosis comes from Safari's documented behaviour and fits the symptom (song yes, effects no), but I could not reproduce it here.
- **One uncertainty:** some iOS versions also let Web Audio through while an `<audio>` element plays (the "unmute" trick). If that held on the user's phone, the switch would not explain it, and the volume imbalance above (effects about 5 dB under the song, through a phone speaker) is the remaining cause. Wave 1 and wave 2 fix that too.

## iOS versions

- `navigator.audioSession` exists in Safari 17+ (iOS 17+). Older versions may also have it (I could not confirm), so I assume iOS 16 does not.
- iOS 16 has no API. A silent looping `<audio>` fallback would show lock-screen media controls. iPhones stuck on iOS 16 are only the 8 / 8 Plus / X, so I did not build that.
- With "Play over my music" on (wave 1 setting), the session is `ambient`. That is muted by the switch, by design.

## When the fix reaches the user

When s3-tap / s3-games (waves 1 and 2) are merged into claude/krelworld-game and pushed. Nothing on `sfx`.

## What the user should check on their phone (LIVE, today)

1. **iPhone:** is the phone on silent?
   - The switch is on the left side (orange showing). On iPhone 15 Pro and later, check the Action button / Control Centre bell.
   - Turn silent off and play a dungeon. If effects come back, that was it.
   - Were voices also silent? Then it is the ringer switch for certain.
2. With silent off and the volume up, effects should be audible but quieter than the song (iPhone plays LIVE's songs at full volume). This is fixed by the waves.
3. If they are still missing with silent off, open the game with `?mobilediag` in the dungeon and read the line `sound N decoded · audio <state>`:
   - N = 0 means the effect files never loaded.
   - `suspended` or `interrupted` means tapping the screen should bring the sound back.
4. **Android:** media volume (the volume buttons while the game is playing, not the ringer). Also check that no Bluetooth device is connected.
5. After the waves ship, effects play on silent too (iOS 17+), unless Phone settings > "Play over my music" is on.

## Checks

No code changed, so the full check was not run. tsc, vitest, fingerprints and smoke were not needed (nothing to verify).

Throwaway worktrees for s3-tap and s3-games were removed, and the dev servers were stopped.
