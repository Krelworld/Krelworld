# Stage 3 wave 2: the phone sound mix (s3-08-sound)

Branch `s3-scenes` (worktree `scratchpad/s3-scenes-wt`), after track B. Commits: 4a07241c (the mix, unit tests, smoke
checks), the smoke-read fix, the README section, and this report's numbers. Phones only; a laptop never loads the files.

The user: "Speech and sound effects are a little quiet on phones."

## Every sound path (found in the code)

| Path | Laptop graph (unchanged) | Phone (new) |
|---|---|---|
| Effects (`synth.play`, synth tones, guns' crunch bus), ambience + weather loops, shouts, `distant()` cackles, Beep Beep's engine, Kreltality's mute | -> `Synth.sfxGain` (Effects x 0.6) -> `Synth.master` (Master) -> speakers | `sfxGain` -> effects path of the mix |
| Chiptune songs | -> `Synth.musicGain` -> `Synth.master` | `musicGain` -> music path |
| Recorded songs | `<audio>` element (volume Master x Music x duck) | pooled element -> its gain (wave 1) -> music path |
| Voice lines (buffer source), `voice.layer` crowd lines | gain (Voice x Master x 1.25, max 1) -> `ctx.destination` | redirected to the voice path |
| Slowed / sped-up voice lines | `<audio>` element | pooled voice element -> its gain -> voice path |
| Robot voice (`speechSynthesis`, lines with no recording; TV pause) | system speech | unchanged (not Web Audio; cannot be mixed) |
| TV shows | the above (voice.say, synth.play, songs) | covered by the above |

## The mix (`src/game/mobile/mix.ts`, plan in `mixLogic.ts`)

Per path: pre (the player's slider taken out) -> drive -> (voices: presence +3 dB at 3 kHz) -> low cut 110 Hz -> a
compressor -> post (slider put back x output trim); all paths summed -> a soft ceiling (identity to 0.7, tanh bend,
never above 0.88 = -1.1 dBFS) -> speakers.

| | drive | compressor | output trim |
|---|---|---|---|
| voices | x3 (+9.5 dB) | -18 dB, 8:1, knee 4, 2 ms / 100 ms | x1.15 |
| effects | x2 (+6 dB) | -18 dB, 6:1, knee 6, 3 ms / 150 ms | x1.1 |
| songs | x1 | none (a song alone stays level; nothing pumps) | x0.85 (-1.4 dB) |

Why the sliders sit after the compressors: a first version with one compressor on the master path (sliders in front)
made Master 0.4 only 1.5 dB quieter than Master 0.8 for speech (the compressor undid the slider). Now every slider
scales its paths exactly (unit-tested; smoke: Master halved halves every path's output). The game's own duck under
dialogue, fades and the dungeon music lift are in front of "pre" and work as before.

Deviation from the brief's example ("music gain about 0.6"): the Web Audio compressor adds make-up gain, so the levels
were set by measurement instead; the outcome is songs -1.4 dB and speech +4.5 dB (relative change about 6 dB in
speech's favour), effects +4 to +9 dB.

Wiring (no game file changed): `Synth.musicGain` / `sfxGain` are disconnected from `Synth.master` and connected to the
mix once the context exists; `Synth.master` stays connected with no inputs; a wrapper on `AudioNode.prototype.connect`
(phones only) sends any other connection to the game context's speakers into the voice path (other contexts, e.g.
Phaser's and `OfflineAudioContext`, untouched); `synth.setVolumes` is wrapped to update the mix at once, and the
Voice slider is polled every 250 ms (it has no call).

## Measurements (offline, Chromium, the game's own files; the mix built by `buildMix` itself)

Script: `scratchpad/mobile/work/s3-sound/measure.cjs` (laptop graph vs phone graph on an `OfflineAudioContext`, 48 kHz:
the title song from 30 s, the first four lines of voice bundle b00 (0.5 / 1.1 / 1.3 / 7.7 s), `explode_1`, `shoot` x4 +
`gun_shotgun`, game gains as Synth.ts / Voice.ts apply them). "Heard" = the same signal through two 250 Hz high-passes
and a +4 dB shelf at 1.5 kHz (what a phone speaker reproduces). Values dBFS: peak / RMS / loudest 400 ms / heard RMS,
heard loudest 400 ms.

Default settings (Master 0.8, Music 0.5, Effects 0.8, Voice 0.8):

| Scene | Laptop | Phone | Change (heard RMS) |
|---|---|---|---|
| song alone | -15.2 / -27.5 / -25.8 / -27.7, -26.2 | -16.6 / -28.9 / -27.2 / -29.1, -27.6 | -1.4 dB |
| voice lines alone | -3.0 / -19.7 / -13.9 / -17.8, -11.1 | -1.4 / -14.9 / -10.5 / -13.3, -9.3 | +4.5 dB (loudest 400 ms +1.8) |
| voice over the ducked song | -3.2 / -19.5 / -13.8 / -17.7, -11.1 | -1.4 / -14.9 / -10.5 / -13.2, -9.3 | +4.5 dB |
| the ducked song (the bed) | -22.1 / -34.6 / -32.2 / -36.1, -33.8 | -23.5 / -36.0 / -33.6 / -37.5, -35.2 | -1.4 dB |
| explosion over the song | -8.5 / -23.1 / -18.2 / -25.5, -20.9 | -4.6 / -20.9 / -15.8 / -21.8, -16.8 | +3.7 dB (loudest +4.1) |
| explosion alone | -11.7 / -25.0 / -18.7 / -29.5, -21.7 | -5.0 / -21.6 / -15.7 / -22.7, -16.9 | +6.8 dB |
| gunshots over the song | -9.8 / -25.8 / -22.0 / -26.7, -21.9 | -5.7 / -22.1 / -16.5 / -23.6, -16.8 | +3.1 dB (loudest +5.1) |
| gunshots alone | -10.2 / -30.7 / -23.2 / -33.8, -23.1 | -6.1 / -23.1 / -16.7 / -25.0, -17.1 | +8.8 dB |

Every slider at 100%: peaks at most -1.2 dBFS (voice lines -1.2, explosion over the song -1.3); the ceiling bends 0.5-0.6%
of a voice line's samples there (0.02% at the defaults). Speech +4.6 dB heard, songs -1.4 dB, effects +1.2 to +8.7 dB.
Master 0.4: every change identical to the defaults (speech +4.5, songs -1.4, ...): the sliders still scale.

Live (smoke "platform", iPhone profile, real game, real graph): every slider at 100%, a recorded voice line ("DR. JAMESON")
with explosions, gunshots and the title song: output peak 0.868 (-1.2 dBFS), heard in 36 of the readings.

Honest limits: speech's loudest moments only come up about 2 dB (they were near full scale already); the gain is in the
body of each line. Measured in Chromium; Safari's compressor is the same design (spec'd make-up gain), but the real
iPhone loudness must be heard on the device (device checklist: ?mobilediag shows the squeeze and the peak).

## Silent switch, resume, ?mobilediag

- Audio session ("playback", or "ambient" with Play over my music) and the resume logic are untouched; smoke "platform"
  still passes the hidden -> suspended and shown -> running checks with the mix in place (31/31). The ringer switch
  itself cannot be emulated (Chromium has no `navigator.audioSession`; diag shows "n/a").
- ?mobilediag: a new line, e.g. "sound mix phone: voice drive +9.5 dB, effects +6 dB, music -1.4 dB · squeeze now voice
  0.1 / effects 2.8 dB · ceiling -1.1 dBFS · peak -12.4 dBFS".

## Tests

- `tests/mobileMix.test.ts` (9): the plan (voices / effects pushed, songs lower, compressors moderate, ceiling under -1
  dBFS), slider levels as the game applies them, pre x level = 1, every slider scales its post exactly, 0 = silence,
  the ceiling curve (identity below the knee, rising, symmetric, < -1 dBFS), the diag line.
- Smoke "platform": 6 new checks (built and following the settings; Master halved halves every path; the Voice slider
  within a quarter second; a voice line redirected into it; all sliders at 100% with voice + explosions + gunshots: heard
  and under -1 dBFS; the diag line).

## Full check

(filled in below)
