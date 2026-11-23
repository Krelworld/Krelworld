# Defects already fixed after the evidence was gathered (do not re-propose; you may note if a fix looks incomplete)

1. The dim choice backdrop (.actback) stayed after a choice was tapped and swallowed the next tap — fixed: tapping a choice now runs the full UI.closeActions (ui.js act tap handler).
2. chooseScene() crashed (TypeError) when no mood scene fitted the people present — fixed: returns a no-op scene (scenes.js).
3. Garden furniture sprites were named o_* and appeared as 19 extra "outfits" in dress-up (turning Marina into a shed) — fixed: renamed yd_*; outfits are back to the 18 real ones. This also restored the dress-up tab row height.
4. window.Studio was undefined (const), so inActivity() and every interruption guard ignored the drawing studio — fixed: art.js now sets window.Studio.
5. Crafts timers replaced whatever tab she had switched to with a new sum / word — fixed: they only refresh if she is still on that tab.
6. The diorama piece tray was squashed to 0–28 px — fixed: the tray keeps 72 px; the picture area shrinks in landscape (the 💾 row can still fall below the fold on landSmall).
7. The map's floor rows ran off both edges in landscape — fixed: they wrap.
8. The diorama tray asked for a missing sprite (oak_tree → broken image) — now uses an existing bush sprite.

Still open (design questions for the plan, not yet changed): the landscape floating ❌ (#xFloat) covering content and closing screens when she aims at the first ingredient / eraser / first fort toy; everything else in the reports.
9. After fix 4, the landscape floating ❌ took the .art style and sat on the drawing paper (drawing there closed the studio) — fixed: the floating ❌ is hidden while the studio is open (the studio's own 60x40 ❌ at top-left remains). The floating ❌ on all other screens is unchanged and still an open design question.
