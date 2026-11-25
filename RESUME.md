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
