# KRELWORLD advert trailer: brief for a separate session

Another session is doing the phone version right now. This session makes the trailer, without touching that work.

## Don't interfere (hard rules)
- Do NOT push to `claude/krelworld-game` (the live site), `mobile`, `mobile-*`, `s3-*` or `mobile-notes`. Work on your own branch **`trailer`** (create it from `origin/claude/krelworld-game`) and put the trailer in `trailer/` on that branch. Big video files: keep the final MP4 (and a smaller share version) only; no frame dumps in git.
- Do NOT change game code on the live branch. If you need a capture-only tweak (e.g. a debug hook), keep it on `trailer` and never push it to the live branch.
- No PRs. Never put a model name or the user's email in files or commits. End every commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <your own session link>
  ```
- No npm/pip installs. Playwright + Chromium are preinstalled (`require('playwright')`).
- ElevenLabs (narrator voice, sound effects) goes through the proxy: header `xi-api-key: proxy-injected`. The custom-voice slots are full: use a stock/designed voice. Never clone or imitate a real person's voice, and no new lines in any cloned friend's voice.

## Getting set up
- Repo: Krelworld/Krelworld (old name hburgess91/rory-s-rangers- redirects). `npm ci` only if node_modules is missing.
- The earlier KrelTV promo's tooling (capture with a fake clock, edit/mix/loudness scripts) is on branch `mobile-notes` under `trailer-tools/` (`git fetch origin mobile-notes` then `git show origin/mobile-notes:trailer-tools/PLAN.md`, etc.). `tvcap.cjs` / `cap.cjs` show deterministic capture: Playwright, clock paused, `runFor(16)` per frame, read the canvas on Phaser postrender at 960x540, nearest-neighbour upscale to 1920x1080, HMR blocked, own Vite port (use 5400+ so nothing clashes).
- Debug API in a dev page: `window.__krel` (newRun, setChapter, state(), scene(k), tp(x,y), game); `await import('/src/game/Flow.ts')` gives `switchTo`; DebugScene (DebugSkip: goCh / goArc / goBoss) reaches any chapter, side quest or boss. Chapter Select password: "krunt".
- Record the LAPTOP version (16:9). The phone version is not needed.

## The brief (user's words where quoted)
- 1–2 minutes, full 16:9 frame, never squashed or letterboxed.
- "Lots of action and absurdity and gameplay". "less about how Drongus' message didn't get seen by anyone, and more about the gameplay and the absurd scenarios". Plot is only a light sprinkle.
- "highlight various game functionality including tv, upgrades, strip club etc etc. I want it to attract curious players": KrelTV, the gun rack / upgrades / Kreddle Exchange, the strip club, the pub, Home, minigames, side-scrollers, bosses.
- "include comedy stuff with Polson and also some of the cool graphics and animation moments including pseudo 3d, violence and kreltalities, without spoiling too much". Polson comedy yes, but NOT his death.
- Kinetic, explosive, unhinged; violence and gore; Kreltalities; pseudo-3D moments; a few TV clips.
- A funny narrator: a stock or designed ElevenLabs voice (with an accent if it helps the joke), not an imitation of anyone real.
- Chapters 6–7 content allowed, but no big plot or boss spoilers. The Elon Musk fight has been removed from the game: don't show it.
- "No content limits as before ... Go as wild as you want", except the standing exclusions below.

## Standing exclusions
- No slurs. Swearing up to "cunt" is fine; the "autard" and autistic lines are OK'd.
- Never sexualise minors, including by proxy.
- Sex and nudity only behind the game's censor bars; Krezz splats as the game shows them are fine.
- Real people (the lads): sexual content implied only.
- No defamation of real private people: skip the Robbo "pedo/nonce" lines, the "Children's Minister"/"KIDS!" pudding arc, and Flenky's "falsely claimed" line.
- Never show real tragedies in TV clips. The earlier promo's exclusion list (in trailer-tools/PLAN.md, "Excluded episodes") still applies: Thick Cumming Cock ep 7 (9/11 cut), President Han, Microsoft Crash Mode, Pelé/Jimmy Carter/Chomsky obituary stories, SanMik crocodiles, the boulder prank, the Wildern bulletin. Don't write new news stories.
- Don't change any game dialogue.

## Deliverable
- `trailer/krelworld_trailer.mp4` (1920x1080, 60 fps, loudness about -14 LUFS) plus a smaller share version, a contact sheet PNG, and a short `trailer/NOTES.md` listing every clip and its source scene. Push the `trailer` branch and send the user the MP4s.
- Show the user a rough cut (or a shot list plus a contact sheet) before the final polish, so they can steer.
