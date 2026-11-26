## LATEST: STAGE 3 STARTED (user switched to high effort, said go, "anything to optimize and speed up, do it")
- Wave 1 (tap-to-use everywhere + platform: audio, memory, perf, saves, caching, pause routes): workflow work/s3-wave1.js, run wf_5bcc4e64-8d7. Worktrees s3-tap-wt (branch s3-tap, also the integration branch) and s3-perf-wt (s3-perf), both from 37a710d4. Backed up as s3-tap-wip / s3-perf-wip.
  Resume: Workflow({scriptPath: "<SP>/mobile/work/s3-wave1.js", resumeFromRunId: "wf_5bcc4e64-8d7"}).
- In parallel: stage 2 feel run wf_4757708e-f84 (mobile-feel). When it passes: merge mobile-feel into mobile, quick checks, push, alt build. Wave 1's merge agent merges "mobile" first, so feel gets in if done by then; otherwise merge mobile into s3-tap before publishing wave 1.
- LATEST (~18:45 UTC): thumb-feel round LIVE at 496f1066 (recheck blocker CABBAGE clipped fixed by coordinator; alt build triggered). Stage 2 = done (#64).
- WAVE 2 RUNNING: wf_6b15b0a5-008 (task whikp750o), script $SP/mobile/work/s3-wave2.js. Worktrees s3-games-wt (branch s3-games, track A + merge/fix/gate) and s3-scenes-wt (branch s3-scenes, track B then sound mix), both from 68584994 (= wave1 builds 45903eb5 merged + mobile 496f1066). Resume: Workflow({scriptPath, resumeFromRunId:'wf_6b15b0a5-008'}). Wave 1 (wf_5bcc4e64-8d7) still running in s3-tap-wt; s3-tap does NOT yet contain 496f1066: merge mobile into s3-tap before publishing wave 1.
- Removed worktrees: mobile-ui-wt, mobile-feel-wt, live-wt (all merged).
- 22:40 UTC: iPhone Add to Home Screen guide now leads with the user's route (page/jigsaw button -> Share -> View More -> Add to Home Screen), with a drawn page-button icon: LIVE at 0da900db (+ alt build). s3/game-adds branches must merge mobile before their publishes. NOTE: tests/wonkStyles.test.ts 'styled zones' failed 1 of 7 runs under heavy load (pre-existing, unrelated; check in stage 4 whether it is a timeout or a real seed issue).
- USER FEEDBACK (TV captions cover the picture; split long captions into <=3-line chunks, phones only, words identical): note dropped for track B in reports/USER-FEEDBACK-TV.md, DEFERRED.md and work/s3-scenes/USER-FEEDBACK-READ-ME.md (couldn't message the running agent). BACKSTOP: when wave 2 finishes, check s3-07-scenes.md / the code for TV caption chunking; if missing, the coordinator builds it (TVScene/TVNews caption box via src/game/mobile) before publishing wave 2.
- USER DECISION (aim, 21:00 UTC): phone default = hold FIRE + aim assist only within ~35 deg of facing + no lock off-screen/behind walls (options 1+4). No aim stick by default. Old full assist kept as an "Easy aim" setting. Note left at reports/USER-DECISION-AIM.md and work/autofire/. BACKSTOP: when the audit finishes, if its default isn't this, the coordinator sets it (autofire branch), re-measures briefly, then publishes.
- NEW USER REQUESTS (20:30 UTC): (1) remove Mikey's collect quest (arc_mikey step lost_property; ALL versions), (2) audit phone auto-fire vs dungeon difficulty + prototype alternatives as phone settings, DEFAULT UNCHANGED until the user picks, (3) overworld bike on ALL versions (laptop key, pad, phone BIKE button). Workflow wf_7b5fe1db-659 (task wwb7ethuw), script work/game-adds.js; worktrees game-adds-wt (branch game-adds) and autofire-wt (branch autofire), both from 496f1066. Laptop fingerprint baselines get re-recorded for the bike/quest only, in one separate commit. When it gates: push game-adds live (+ alt build); then merge game-adds into s3-tap / s3-games before their publishes (they will need the new baselines). Ask the user which firing scheme to default to.
- USER DECISION (wave 2 scope): "Safe cut". The four OPTIONAL extras get a simple phone treatment only (tap-to-play or a clear SKIP; nobody is blocked; laptop unchanged): the Gig (Krebon's optional story), Boggor's photo quest, the home games console replays, the Kreddle Pit (verify it is optional first; if it is required, give it full touch controls). Everything else (all compulsory minigames, including the one-character ones: RuneScape, Deadlift, Girlfriends, Renovate, Burpees, Modulator/Facebook) gets full touch controls.
- USER DECISION (jump): NO stick-up jump, no setting. JUMP button only (as built in the feel round).
- USER FEEDBACK (wave 2, high priority, phone-only): "Speech and sound effects are a little quiet on phones." Wave 1 already routes iPhone songs/voices through Web Audio gain (music used to ignore the slider and drown voices). Wave 2 adds a phone mix on top: voices and effects louder relative to music (phone defaults e.g. music ~0.6 of laptop's, voice/sfx up), a gentle compressor/limiter on the phone master bus so speech is loud on small speakers without clipping, measure peak/RMS before/after (OfflineAudioContext or analyser) per category; laptop mix byte-identical. Check iPhone silent-switch behaviour still sane.
- When wave 1 gates: merge into mobile, push live, alt build, tell the user. Then wave 2 (minigames by touch: rhythm + sync calibration, mashers, Flip It, RuneScape, Gig, Girlfriends, Facebook, squeeze, Wonky Pole, KrelCue, Polson bulking, Pit; Night of Freedom manual-aim test + other stationary gunners (plane cannon), Beep Beep pedals, Drawbridge, citadel3d/RoofArena, finale concept boss, skip pills, Ending, p3d, vignettes; TV subtitles P5). Plan: two build tracks (A: taps/rhythm/mashers; B: aim/driving/special scenes/TV) then merge/review/fix/gate. Could start wave 2 builds once wave 1 is in review (workflow concurrency is 2).

## LATEST (2026-11-25, stage 2 gate PASSED)
- USER: on medium effort for the rest of stage 2. BEFORE STARTING STAGE 3, tell the user it is ready to start so they can switch to high (do not start stage 3 until they say so).
- 14:48 UTC: STAGE 2 PUBLISHED (live = 37a710d4, verify PASS, alt build triggered). Remaining for stage 2: feel workflow wf_4757708e-f84 in mobile-feel-wt; when its recheck passes, merge mobile-feel into mobile, quick checks, push, trigger alt.
- Stage 2 workflow wf_574a5950-314 finished: merge, 4 reviews (31 findings), fix round 1, gate PASS at 06d2ac08 (reports s2-05..s2-07). Gate left non-blocking N1-N7.
- Coordinator merged live (455b3131) into "mobile": 5bb649ec.
- Running now: polish + independent verify workflow, script work/s2-polish.js, run id wf_0c237194-e84 (task wwl19uk4h). Fixes N1 caption overlap, the user's dungeon "bubbles" clutter, N2, N4, N5; then the verify agent runs the full CHECK and touch checks (TV guide scroll, Peep Show, dungeon clutter).
- SPEED-UP (14:30 UTC): the feel fixes now run IN PARALLEL in their own worktree scratchpad/mobile-feel-wt (branch mobile-feel, from 37a710d4), workflow work/s2-feel.js run wf_4757708e-f84 (feel + recheck). Plan: when verify (wf_0c237194-e84) passes, push mobile to live straight away (stage 2 first publish); when the feel recheck passes, merge mobile-feel into mobile, quick re-check (tsc, vitest, fingerprint halves), push again. IGNORE the older line below about appending Feel to s2-polish.js (reverted).
- USER PHONE FEEDBACK (on live stage 1): jumping awkward; specials tiny to press when active; is there a pause button; the stick slides all over the screen. work/s2-polish.js now has a 'Feel' phase (feel agent + recheck) appended. When run wf_0c237194-e84 finishes, RESUME it with the same scriptPath so polish+verify replay from cache and the Feel phase runs. Publish only after the recheck passes.
- If cut off: Workflow({scriptPath: "<SP>/mobile/work/s2-polish.js", resumeFromRunId: "wf_0c237194-e84"}).
- When verify passes: fetch origin/claude/krelworld-game, merge if moved (re-check), push mobile HEAD to claude/krelworld-game, trigger the alt build, tell the user (key-mention lines and swapped narrator tips are in s2-01..s2-06 reports and the stage 2 workflow result at tasks/w3nnfv3m2.output).

## LATEST (2026-11-25 ~05:30 UTC)
- Live now has 455b3131 (KrelTV no-repeat rounds; Peep Show unlocked from the start, chapter 4 prompt skipped if seen; news_1 "Great Silence" and the Wonking Machine Shopping Network removed; TV fingerprint baselines re-recorded deliberately for desktop tv_from_title, tv_guide, pub and the four profiles' tv_from_title and tv_guide).
- BEFORE PUBLISHING STAGE 2: merge origin/claude/krelworld-game into "mobile" (it does NOT have 455b3131 yet; the stage 2 agents are mid-run there), re-run the full CHECK (laptop halves, profiles, tsc, vitest, smoke both builds), then push.
- New user feedback for the phone build is in reports/00-USER-PRIORITIES.md "Latest feedback" (dungeon buttons clutter, tap things to use them, TV guide scrolling) and DEFERRED.md stage 3. Trailer steer in task #67 metadata (features to attract curious players: TV, upgrades, strip club; Polson comedy; pseudo-3D, violence, Kreltalities; light spoilers).

## LATEST (2026-11-25 ~04:15 UTC)
- The stage 2 builders all FINISHED (cached in journal). The merge agent was cut off part way (merge commit fac0d1ef done, integration checks TODO); the four reviews and the gate never ran.
- The user asked to remove the Elon Musk fight: done on live (27107ea1, pushed, alt build triggered) and merged into "mobile" (0d681a8f).
- The user's iPhone shows Add to Home Screen through the page button left of the address bar, then Share, then View More: added to the guide (9770d543 on "mobile").
- The user asked to test manual aim where you can't move (Night of Freedom, DriveScene): written into DEFERRED.md, stage 3.
- Stage 2 relaunched with resumeFromRunId wf_574a5950-314 (merge prompt now carries a resume note; fixers told to commit often).

# KRELWORLD phone version: how to resume

Written 2026-11-23 ~13:40 UTC, while the stage 2 workflow was running, because the user's usage may run out.
User's last instruction: "My usage *will* run out so do whatever to make sure you can resume from where you left off
once my usage goes back to normal."

## Where things are

**Repository and sites**
- Repo: Krelworld/Krelworld. The old name hburgess91/rory-s-rangers- redirects and works with the GitHub MCP tools.
- Live branch: `claude/krelworld-game`. Pushing to it deploys the main site through pages.yml.
- Alt site: after every push, trigger `mcp__github__actions_run_trigger` with: method `run_workflow`, owner `playkrelworld`, repo `playkrelworld.github.io`, workflow_id `build.yml`, ref `main`.

**Stage 1 (done, live)**
- Pushed as e8cf3f4f.

**Stage 2 (in progress)**
- Workflow run: `wf_574a5950-314`.
- Workflow script: `/root/.claude/projects/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/workflows/scripts/krelworld-mobile-stage2-wf_574a5950-314.js`.
  A backup copy is in the notes branch under `workflows/`.
- Combat track:
  - worktree `scratchpad/mobile-wt`, branch `mobile`;
  - backed up to the remote branch `mobile-wip` (force-pushed every 15 min by a background loop while the container lives).
- Menus track:
  - worktree `scratchpad/mobile-ui-wt`, branch `mobile-ui`;
  - backed up to the remote branch `mobile-ui-wip`.
- Notes (this file, every report, the workflow scripts, the device checklist):
  - remote branch `mobile-notes` (orphan branch, no game code);
  - local folder `scratchpad/mobile/`.

Stage 2's flow:

| Step | Agents | State at 13:40 |
|---|---|---|
| Combat track | top-down (commit a8f15076), then side rooms/jumping/brawls | top-down running its checks |
| Menus track | readability/dialogue (3 commits), then lists/shops/wording | lists/shops/wording running |
| Merge | `mobile-ui` into `mobile` | not started |
| Review | 4 lenses: laptop, first-time player, combat feel, robustness | not started |
| Fix | fix confirmed findings | not started |
| Gate | final gate, looped up to 3 rounds | not started |

## RESUMED with $20 of credits (run wf_574a5950-314 relaunched as task w3128oxb4). If credits ran out again: same resume command, same run id. The two interrupted agents now have a RESUME_NOTE telling them to continue from existing commits and commit every 30-45 min.

## (earlier) PAUSED by the user at 14:53 UTC ("Pause work, I'll resume once I have more usage")

The workflow was stopped with TaskStop. Servers and browsers were killed.

Finished, so they replay from cache on resume:
- "combat: top-down fights and HUD": commits a8f15076, a1d6f030, d0e089d8, c65091f4.
- "menus: readability, dialogue, phone settings": commits f38e23a4, cac70ab0, 6574b6a2.

Interrupted, so they re-run on resume:
- "combat: side rooms, jumping, brawls, controller": had made no commits; the worktree was clean.
- "menus: lists, shops, wording sweep": committed 07bfb301, 046c1bab, 727b92a7. Only a README edit was left uncommitted. It is still in the worktree and also saved as the remote branch `mobile-ui-wip-uncommitted`.

On a re-run, these two agents see the commits already in their worktree and should continue from there. Consider adding a line to their prompts saying so. Note that editing a prompt changes the cache key: only edit the two interrupted agents' prompts, never the finished ones.

To resume: `Workflow({scriptPath: "<script>", resumeFromRunId: "wf_574a5950-314"})`. Start the backup loop first if it is not running:
`setsid nohup <SP>/backup/loop.sh >/dev/null 2>&1 &`

## How to resume

### Case A: same session, container still alive
1. Check whether the workflow finished. Read `/root/.claude/projects/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/subagents/workflows/wf_574a5950-314/journal.jsonl`.
2. If agents failed on the usage limit, re-run with:
   `Workflow({scriptPath: "<script above>", resumeFromRunId: "wf_574a5950-314"})`
   Finished agents replay from cache. Failed or never-started ones run again.
3. Before resuming, kill stale vite servers:
   `pkill -f "vite --port 52"`
4. If an agent died mid-task, its worktree may have uncommitted changes. They are usually fine: the re-run agent sees them. The safe option is `git -C <wt> status`, then let the re-run agent decide. Do NOT `git reset`.

### Case B: container was reset (scratchpad gone)
1. Restore the notes:
   - `git clone`, or `git fetch origin mobile-notes`;
   - `git worktree add` / checkout into `scratchpad/mobile/`. The notes branch has `reports/`, `DEVICE_CHECKLIST.md`, `RESUME.md` and `workflows/`.
2. Recreate the worktrees from the main checkout (/home/user/Rory-s-rangers-):
   ```
   git fetch origin mobile-wip mobile-ui-wip
   git worktree add -b mobile <SP>/mobile-wt origin/mobile-wip
   git worktree add -b mobile-ui <SP>/mobile-ui-wt origin/mobile-ui-wip
   ```
3. Set up dependencies:
   - node_modules: `cp -al` from the main checkout (run `npm ci` there first only if missing);
   - remove `node_modules/.vite`.
4. The workflow cache won't help across a container reset (the journal is under /root/.claude). Relaunch from the saved script, but edit it to skip the finished steps:
   - see which commits exist on each branch and the `s2-*.md` reports;
   - replace finished agent() calls with stubbed results, as was done for stage 1's safety net.

## After stage 2's gate passes
1. In `mobile-wt`, run `git fetch --no-show-forced-updates origin claude/krelworld-game`.
2. If upstream moved (the Chef Marina PRs merge there), merge it in. Re-run the checks if anything changed. The check commands are in the workflow script's `CHECK()`.
3. Push:
   ```
   for i in 1 2 3 4; do git push -q origin HEAD:claude/krelworld-game && break; sleep $((2**i)); done
   ```
4. Trigger the alt build.
5. Tell the user, in plain words, what phones now get. Include the list of character dialogue lines that mention keys, and the narrator tips swapped. Both come from the stage 2 reports and results.
6. Then do stage 3, stage 4 and the trailer (below).

## Remaining tasks

**Stage 3: every minigame and special scene by touch, iPhone audio, memory, performance.**
- Minigames and special scenes: rhythm (Cam2Cam, crocodile), Beep Beep driving, Norwich, Polson bulking, plane, colon voyage, Night of Freedom drive, the finale and the like.
- Research items: M9 audio, M12 memory, M13 rhythm offset, M14 mashers in minigames, S5 instruction cards, S7 saves, S8 sync calibration, S14 download/caching.
- `reports/DEFERRED.md`, its stage 3 section.
- The game uses about 900 MB of texture memory. iPhones kill tabs at about 1.5–2 GB, so this is the top risk.
- Same workflow shape as stage 2: build, review, fix, gate.

**Stage 4: full phone QA.**
- `DEFERRED.md`, its stage 4 section, and research S15.
- Final publish.

**Task #67: the advert trailer, after the phone version.**
- 1–2 min, full 16:9 frame, gameplay, kinetic, explosive, unhinged, violence, a funny stock or designed voice narrator, plot elements and TV clips.
- Ch6–7 content is allowed, but no big plot or boss spoilers.
- No content limits beyond the standing rules: no slurs; nothing sexual with minors; no defamatory content about real private people (no Robbo pedo/nonce lines, no Children's Minister/KIDS pudding arc, no Flenky "falsely claimed"); no cloned real voices for new lines.
- Recorded fresh. Reference capture technique: `scratchpad/tvtrailer/tvcap.cjs`. That file is NOT in the notes branch; rebuild it from scratch if the scratchpad is gone.


**Trailer steer, 2026-11-25 (user, verbatim):** "The trailer should be less about how Drongus' message didn't get seen by anyone, and more about the gameplay and the absurd scenarios. ... Lots of action and absurdity and gameplay in the trailer". The spine is fast-cut action and absurd set pieces; plot is a light sprinkle only. The Elon fight is removed from the game, so don't show it.

## Standing rules (short)

**Commits**
- Footer: Co-Authored-By with the current model, plus `Claude-Session: https://claude.ai/code/session_01VMaYe2CeeKzcmBuCUqa9Rb`.
- No PRs.
- Never put a model name or the user's email in files or commits.

**Laptop and dialogue**
- The laptop version must stay byte-identical. The fingerprint check is the proof; never re-record baselines.
- Never change dialogue. Narrator control tips get touch wording on phones only.

**Machine**
- One Playwright browser per agent; at most two agents at once.
- Ultracode is on: use the Workflow tool for substantive tasks.

## 2026-11-26 01:40 UTC: user played LIVE on their phone
- Verbatim: "Just played on phone. There weee no sound effects in dungeon. It was both auto firing and auto aiming. It was so easy".
- Launched workflow wf_505061ed-dbb (task w9513z2v0, script mobile/work/aim-sfx.js):
  - "aim" in aim-wt (branch aim from autofire 204e8c85): phone default = hold FIRE + 35° cone, no off-screen/behind-wall lock (boss counts if any part visible); EASY = old auto-fire; LIGHT/STILL dropped; one-time "Hold FIRE to shoot" tip. Report ga-05-aim.md.
  - "sfx" in sfx-wt (branch sfx from live 0da900db): root cause of silent dungeon effects; likely the iOS silent switch (live has no navigator.audioSession; wave 1's audio.ts sets 'playback'). Report ga-06-sfx.md.
  - Gate ga-07, fix ga-08, re-gate ga-09.
- Plan: ship aim (+ sfx if needed) with the game-adds publish (merge autofire's final commits too). Asked the user: iPhone or Android, silent switch on, did voices/music play.
- 01:45 user update: "the sound effects weee simply very quiet" (not silent). Note dropped in work/sfx/USER-UPDATE-READ-ME.md
  asking the sfx agent to tune wave 2's mix on a new branch sfx-mix (from s3-scenes). BACKSTOP: if ga-06-sfx.md doesn't show
  sfx-mix commits, the coordinator must raise phone effects (target: dungeon gunshots over the song within ~3 dB of voices,
  ~+8-10 dB over live) before wave 2 publishes, and merge sfx-mix into s3-games.
- 01:55 user request (ALL versions): Job Centre toilet opens without clearing the room + a SanChz jam-donut cutscene with art
  (clothed, donut at groin, small censor bar, moaning with his EXISTING "yegh" clips only). Workflow wf_ff8973c5-ca4
  (task wo9qf5bvo, script work/donut.js), branch "donut" from game-adds 4b8355bd in donut-wt; reports dn-01..dn-04.
  Ships after game-adds (merge game-adds' later fixes into donut first). Send the user the 2x screenshots.
- 02:00 user: "Sanchez shouldn't be with you in that specific room. There's a "where da fuck is Sanchz" from SanMik when you enter".
  Note in work/donut/USER-UPDATE-READ-ME.md (no SanChz companion in Job Centre Plus until after the scene; new SANMIK entry line
  "Where da fuck is SanChz?", text only; SanChz's "Signing on" enter line removed from that room). BACKSTOP: check dn-01/dn-02 cover it.
- 08:30 STATUS: load avg ~60, every gate crawling; nothing published since 0da900db (estimates blown). Running: wave1 final gate,
  wave2 reviews (L, P), game-adds gate, aim re-gate (ga-08 built HOLD+35° cone; first build agent did nothing), donut gate.
  Donut art done (28e402e8..16fc2bcb) BUT the room change (no SanChz companion in Job Centre Plus, SANMIK "Where da fuck is SanChz?",
  drop his "Signing on" line) was NOT done: COORDINATOR MUST DO IT after the donut gate finishes, before publishing.
  User said "I already had the cutscene made": told them the scene's words are kept and art plays behind them; awaiting reply.
- 08:40 user: trailer NOT needed any more (already done elsewhere). Approved: (1) spread work over sessions, (2) full laptop
  check once per publish (not in every agent), (3) queue new requests until s3 first half + bike are live.
  Wave 2 workflow (wf_6b15b0a5-008) STOPPED; its review/fix/gate + the louder-effects tuning moved to child session
  session_01VMaYe3QBTD6c23kmufj59J on branch s3-wave2 (from s3-games 8ab9690f). It messages back here when gated.
  Then: merge origin/s3-wave2 (and s3-tap final, game-adds, aim, donut) at publish time, run the full check once, push.
  Stage 4 can also go to a child session.

## 10:50 UTC update
- aim: fix done (HOLD + 35° cone, lock while FIRE held); AIM-1 boss-name overlap fixed by coordinator f338e373 (phone-only scale + short tag; shots mobile/shots/aim-regate/fixed/). Ready.
- donut: gate PASSED (dn-02-gate.md). Coordinator room change 0c7f61ba (no SanChz until scene, SanMik "Where da fuck is SanChz?", Signing-on line removed); verified in browser (check: mobile/work/donut-room/check.cjs). donut ff'd to 0c7f61ba.
- bundle-wt / branch `bundle` = mobile + donut (incl. game-adds 4b8355bd) + aim, tsc clean. Redo when game-adds gate (wwb7ethuw) finishes (it may add commits). Merge messages need the footer (redo with -m).
- Still running: wave1 final gate (wc5mur9si), game-adds gate (wwb7ethuw). Child session for wave 2.
- Publish order: wave1 (s3-tap + mobile) first, then bundle merged on top; full check ONCE per publish; re-record baselines only for all-version features (bike already 4b8355bd; check whether donut-room changed any fingerprint state).

## 11:27 UTC
- wave1 gate PASSED (s3-05-gate-round1.md). s3-tap merged with live -> fd33d21c. Full check pub1 (port 5700, mobile/work/pub1) running.
- game-adds gate PASSED (ga-03-gate.md), head unchanged 4b8355bd.
- Combined branch `pub` (pub-wt) = s3-tap fd33d21c + donut 0c7f61ba + aim f338e373 -> 7aa05c29, tsc clean. Full check pub2 (port 5720, mobile/work/pub2) running.
- Plan: if pub2 passes, push pub to live (superset). If only pub1 passes, push s3-tap first.
- Script: mobile/work/fullcheck.sh <wt> <port> <logdir>.
- 12:16 PUBLISHED pub 7aa05c29 to live (combined). pub2 ALT smoke still running as post-check. pub1 stopped.

## 15:10 UTC
- LIVE = 8b337a45: stages 1-3 complete (+ aim all-round ffd23e5c, Shezleigh voice 1f12b3a6, s3-wave2 8b337a45). Alt build triggered.
- Child session still doing branches cut-flashbacks (204e0f0, fingerprints pending) and music-gaps; merge + publish them when reported (re-record baselines in one separate commit only if differences are that feature).
- STAGE 4 workflow wf_27552fbe-01e (task wrd6hk2ic), script mobile/work/s4.js, worktree s4-wt branch s4. QA x3 -> fix -> gate (up to 3 rounds). On pass: push s4 to live, trigger alt build.
- Cleaned merged worktrees (disk was 1 GB free; now 8 GB).
