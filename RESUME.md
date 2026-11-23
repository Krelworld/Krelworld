# How to resume the Chef Marina clarity audit (round 2)

State when this was written: all 39 audit items (G1–G39) were reviewed twice and approved, and the shared core is committed on
`claude/happy-shannon-8linqh` (commit f93ea704: clarity-flags.js, clarity-core.js, 8 empty worker stubs, script tags).
Eight builders were building in git worktrees `.wt/<name>` on local branches `clarity/<name>`.

## Backup branches on GitHub (force-pushed snapshots, refreshed every ~10 min)
- `clarity-wip/<name>` for prompts, status, rings, bubbles, dock, layout, screens and wayfinding: the builder's work (committed and uncommitted) on top of f93ea704.
- `clarity-wip/workspace`: the planning files. These are:
  - `audit2/final/<name>.txt`: each builder's full spec;
  - `final.json` / `final_plan.md`: architecture, core API, conventions, conflicts;
  - `verdicts.md` and `draft_plan.md`;
  - the test harness and the regression scripts (`audit/`), plus the baselines `audit2/arch/head1.json` and `head2.json`;
  - the builders' check scripts (`audit2/build-<name>/`);
  - `build_workflow.js`: the build → review → fix workflow.

## To resume in a new session
1. `git fetch origin 'refs/heads/clarity-wip/*:refs/remotes/origin/clarity-wip/*'`.
2. Restore the workspace into the scratchpad: `git archive origin/clarity-wip/workspace | tar -x -C <scratchpad>`.
   - Fix the absolute paths in `audit/harness.js` and `regress.js` (they point at the old scratchpad path).
3. Recreate the worktrees from the snapshots: `git worktree add -b clarity/<name> .wt/<name> origin/clarity-wip/<name>`.
4. For each builder, compare its snapshot with its spec (`audit2/final/<name>.txt`).
   - Finish any missing items, run its checks, then review and fix, using `build_workflow.js` or by hand.
5. Merge the `clarity/<name>` branches into `claude/happy-shannon-8linqh`.
   - Run the full regression with everything on: `regress.js`, then `regress-diff` against `arch/head1.json` and `head2.json`.
   - Run it again with `CLARITY_OFF=all`; that run must equal today's game.
   - Run the integration checks in `final_plan.md` (conventions, section 11).
6. Publish the artifact `https://claude.ai/artifact/RsKTcXywYRj5vz9AYfrC9K`.
   - Changed files only, plus index and artifact.html.
7. Open a PR into `claude/krelworld-game`.

Every change has its own switch (`?clarity=-G19` turns one off; `?clarity=off` turns all off), so a single bad item can be disabled without touching the rest.

## Status when the weekly usage limit hit (Nov 23, ~16:30 UTC; it resets Nov 25 04:00 UTC)
- Builders that committed their work: prompts, status, rings, bubbles and layout (1 commit each), plus dock (2 commits).
  - None of these went through review except dock. Dock's builder report and its review are in `audit2/final/dock_build_review.jsonl.txt`.
  - Dock's fix stage did not run.
- Builders cut off mid-build, with uncommitted work saved in their snapshots: screens and wayfinding.
- Next steps:
  1. For each builder, check its spec's checks against its snapshot, and finish screens and wayfinding.
  2. Run the review and fix stages, then do the integration step above.
