const DWT = SP + '/donut-wt'
const build = () => agent(`${CTX}${SPEED}

# Your role: THE JOB CENTRE TOILET (worktree ${DWT}, branch "donut"; dev ports 5682 / ALT 5692; scratch ${SP}/mobile/work/donut/; screenshots ${SP}/mobile/shots/donut/; report ${REPORTS}/dn-01-donut.md)
The place: chapter 5, the SanMikverse dungeon, room "Job Centre Plus (Catford Branch)" in src/data/dungeons.ts (exitFlag "sm_donut", a STAFF TOILET (ENGAGED) talker prop with action "donut") and DungeonScene.ts: useTalker case "donut" (it refuses until this.roomCleared: "ENGAGED. ... Clear the Job Centre first.") and donutScene() (dialogue only today: SanChz with a jam donut in the staff toilet).
1. REMOVE THE GATE: the toilet can be opened at any time, with no need to kill everything first. Remove the refusal (its two lines go: that is the requested change). Make it safe mid-fight: enemies and projectiles freeze or the scene clears them while the cutscene plays (use whatever the game already does for talk() mid-room; check the San Brothers, hazards, crushers and movers), nothing hurts the player during or right after it (a short grace period), and nothing softlocks: decide whether the room's exit still needs the waves cleared after the scene. Default: the exit opens once the scene has played AND the waves are done, exactly as now, but if the room's exit only waited on the toilet because of the gate, keep the waves as the normal room fight. Also check the exitHint text still makes sense (it is a hint, leave the words unless it now lies). Every other line of the scene stays word for word.
2. THE CUTSCENE ART (the new part): while donutScene's lines play, show a full-frame pixel-art illustration (like the game's other vignettes/cutscene backdrops: find how they are done, e.g. backdrops, vignette panels, PixelLab art in public/art) of SanChz in the transformed Job Centre staff toilet (tealights on the cistern, rose petals in the sink, a small speaker) holding a jam donut to his groin, eyes closed, moaning with pleasure. He stays CLOTHED (trousers on): no genitals at all. Add a small censor bar or pixelation over the donut/groin as a comic touch; what is happening must still read clearly (the hold, the face, little hearts / "YEGHHH" / motion lines / a drip of jam). It is comedy, cartoonish, not explicit. Match SanChz's existing look exactly (find his sprite and portrait: SanBrother.ts, the San Brothers' art, his talking portrait) and the game's art style. Animate it with a few frames or tweens (a rhythmic sway, the moan, hearts popping, the tealight flicker) so it plays as a cutscene, synced to the lines: e.g. the reveal on "And there is SanChz...", the moan on "The donut moans in pleasure", SanMik bursting in. Use the PixelLab MCP tools (via ToolSearch: create_image_pro / create_image_pixflux / edit_image / animate_image / inpaint_image etc.; check get_balance first; keep generations reasonable). If a tool refuses a prompt, rephrase in plain clothed, comedic terms ("a man in a bathroom, fully clothed, holding a jam donut in front of his trousers, eyes closed, blissful expression") and add the censor bar yourself in code. Never sexualise anyone who looks young; SanChz is an adult man.
3. SOUND: his moans use ONLY his existing recorded voice clips ("yegh"/YEGHHH lines; Voice.ts maps SANCHZ to "yegh"): you may play existing clips (pitched, timed) but NEVER generate a new line in his voice and never clone or imitate a real voice. Slow-jam music: reuse an existing track or the game's synth. Any new non-voice effect (creak, squelch) may come from ElevenLabs sound effects (header "xi-api-key: proxy-injected"), no voices.
4. Phone: the art fills the landscape screen correctly on the phone profile (iPhone 14 landscape with insets, 740x360) and the dialogue boxes do not cover the key part of it; laptop at 960x540 as usual; ALT build too.
5. Tests: a unit or smoke check that the toilet opens mid-fight, the scene plays with the art and finishes, the exit opens as designed, and the repeat visit ("We don't talk about it") still works.
At the end the FULL check: ${CHECK(5682)} (per hard rule 0: re-record only the states this feature changes, in one separate commit; the bike baselines are already in). Commit (footer), worktree clean. Report: plain English first, with paths of 2x screenshots of the cutscene (laptop and phone) for the user. Return JSON per the build schema.`, { label: 'donut: toilet gate out, cutscene art', phase: 'Build', schema: BUILD_SCHEMA })

phase('Build')
const b = await build()
phase('Review')
const gate = await agent(`${CTX}${SPEED}
# Your role: REVIEW AND GATE the Job Centre toilet change (worktree ${DWT} read-only except throwaway servers; ports 5683 / 5693; scratch ${SP}/mobile/work/donut-review/; report ${REPORTS}/dn-02-gate.md)
Builder's result: ${JSON.stringify(b)}
Verify on laptop, phone (iPhone 14 landscape, real touch) and ALT: the toilet opens mid-fight with no damage or softlock; the cutscene art shows SanChz clearly (matches his look), clothed, no genitals, a small censor bar/pixelation, and what is happening reads clearly; it is synced with the lines and plays smoothly; the repeat visit works; the exit and waves behave as the report says; no dialogue changed except the removed refusal (git diff of every text file); no new voice line was generated in his voice. Then ${CHECK(5683)}; production builds main and ALT succeed (temp folder, deleted). Return JSON per the gate schema (laptopUnchanged = laptop differs only by this feature).`, { label: 'gate: toilet cutscene', phase: 'Review', schema: GATE_SCHEMA })
let fix = null, gate2 = null
if (gate && !gate.pass) {
  phase('Fix')
  fix = await agent(`${CTX}${SPEED}
# Your role: FIXER for the Job Centre toilet change (worktree ${DWT}; ports 5686 / 5696; report ${REPORTS}/dn-03-fix.md)
Confirm each blocker, fix the root cause, then ${CHECK(5686)}. Commit (footer), worktree clean.
Blockers:
${JSON.stringify(gate.blockers, null, 1)}`, { label: 'fix toilet cutscene', phase: 'Fix', schema: FIX_SCHEMA })
  gate2 = await agent(`${CTX}${SPEED}
# Your role: RE-GATE the Job Centre toilet change (worktree ${DWT} read-only; ports 5687 / 5697; report ${REPORTS}/dn-04-regate.md)
Earlier blockers: ${JSON.stringify(gate.blockers)}
Fixer: ${JSON.stringify(fix)}
Confirm each is fixed, then ${CHECK(5687)}. Return JSON per the gate schema.`, { label: 're-gate toilet cutscene', phase: 'Fix', schema: GATE_SCHEMA })
}
return { build: b, gate, fix, gate2 }
