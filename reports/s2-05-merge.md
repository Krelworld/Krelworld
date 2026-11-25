# Stage 2 merge (mobile-ui into mobile) - IN PROGRESS

Resume point (if credits run out): worktree /tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/mobile-wt, branch mobile.
- DONE: merge commit fac0d1ef (conflicts in index.ts, layout.ts, settings.ts, touchLayer.ts, README.md, mobile-smoke.cjs resolved keeping both). 90e57eb8 + ef0afd1d: fight narrator tips / toasts through the shared wording table.
- DONE (run 2): tsc, vitest 523 pass on HEAD 9770d543. Integration script work/s2-merge/merge-play.cjs passes: readability ON vs fight HUD / READY / picker / DOM controls, pills vs combat layer, narrated CONTROLS line in touch words, PHONE SETTINGS live in a fight (button size L at once), Controls picture tabs.
- TODO: smoke "together" section in scripts/mobile-smoke.cjs (pub brawl tap), full smoke both builds, fingerprints (a)(b)(c), final report.
- DONE (run 2): efb2860e smoke "together" section; dcd9c75e brawl legend up under the bars; 1c033a2e KREZZ/WONK above the chips + boss bar clear of them (UIScene phone-only hook). Smoke side/brawl/combat/android/desktop/together pass on main.
- TODO next: fingerprints (a)(b)(c), full smoke main + ALT, final report.
