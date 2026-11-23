// Chef Marina — clarity: quieter prompts and timing (G1 G2 G20 G21 G28 G29).
// Built by the 'prompts' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
// This file only changes WHEN things are said or offered; it adds no DOM and no CSS. Each change also has small local edits in
// game files, each marked /* Gn */ and guarded by `window.Clarity && Clarity.is('Gn')` (switch off = today's code):
//   G2  react.js (reactMess's 🧹🏃 step), minka.js (hide cues), upstairs.js (grown-up visits)
//   G20 family2.js (Marina's hello back to Nunu / Grandpa Jeff)      G21 more.js (Uncle Rory's walk-up)
//   G28 react.js (the start-of-game wish)                             G29 minka.js (paws with every far-room mew)
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;

  // ================================================================ G1 Every touch counts, and finishing an activity restarts the idle clock
  // lastInput (the top-level let at features.js:502) is what the idle wish (react.js, 30 s), the request (fun.js, 6 s) and the idle
  // wiggle (features.js, 10 s) measure from. Today only touches on the picture set it, so minutes spent in cooking, drawing or a
  // story count as idle time and a wish pops up the moment she closes the screen. Now any touch anywhere sets it (a passive,
  // look-only window listener run by the core), and so does the moment an activity ends (a screen closes, a scene ends, she gets
  // off a swing, the bars, a ride, the wheelchair or a looping bounce: the core's activityEnd edge). The rules stay the same.
  const touched = () => { if (typeof E !== 'undefined' && typeof lastInput !== 'undefined') lastInput = E.t; };
  C.pointer('down', 'G1', touched);
  C.listen('activityEnd', 'G1', touched);
  // The three readers of lastInput all run inside featTick (react.js, fun.js, features.js). Look at the activity edge right
  // before them (on demand, as the core allows), so a screen that closed by itself this very frame already counts: the core's
  // own 100 ms sampling could otherwise let a wish through in the gap. Only looks; never skips the game's featTick.
  C.hook('featTick', 'G1', { order: 10, before() { C.sample(); } });

  // ================================================================ G2 Nothing waits under a screen or reaches through it
  // The tidy order and its 🧹🏃 ring happen only in free play; a stray backdrop or tidy ring never waits under a screen.
  // (Minka's hide cues and the upstairs visits also pause during any activity: local edits in minka.js and upstairs.js.)
  C.G2 = { tidyRing: null };                    // the .act buttons of the 🧹🏃 tidy ring that is (or was last) open; null: none
  const isTidyRing = (a, l) => typeof marina !== 'undefined' && a === marina && !!l && l.length === 2 && !!l[0] && l[0].ico === '🧹' && !!l[1] && l[1].ico === '🏃';
  // (1) checkMess (game.js, every 4 s from AI.update): hold the tidy check while any activity is on (screens, TV, tidy, chase,
  //     fort, scenes, swing, bars, rides…) and for 10 s after one ends. A held-back check writes nothing (G.lastTidyAsk untouched).
  C.hook('checkMess', 'G2', { order: 10, before(c) { if (C.busyNow() || C.quietFor() < 10) c.skip = true; } });
  // (2) the 🧹🏃 ring never opens while a full screen is up (the tidy line may end after a screen opened: game.js say().then).
  C.hook('UI.actions', 'G2', { order: 10, before(c) { if (isTidyRing(c.args[0], c.args[1]) && C.screenOpen()) c.skip = true; } });
  //     ...and remember whether the ring that just opened is the tidy ring (after every other ring hook has placed it).
  C.hook('UI.actions', 'G2', { order: 40, after(c) {
    if (c.skip) return;                                                   // nothing opened: whatever was open stays as it was
    C.G2.tidyRing = isTidyRing(c.args[0], c.args[1]) ? Array.from(document.querySelectorAll('#fx .act')) : null;
  } });
  // (3) the moment a full screen opens, clear what must not wait under it: a leftover backdrop with no ring (openPanel removes the
  //     ring's buttons but not features.js's .actback, which would eat her first tap after closing), or the 🧹🏃 tidy ring.
  //     A ring she opened herself stays exactly as today (it survives the map, for instance). Only the open edge acts, so a ring
  //     opened while a screen is already up (the studio's give) is never touched. Cheap and re-entrancy safe: this can run inside
  //     any Clarity.quietFor() call, e.g. inside the checkMess hook above.
  C.listen('screenOpen', 'G2', () => {
    const t = C.G2.tidyRing, tidyOpen = !!t && t.some(n => n.isConnected);
    const leftover = !document.querySelector('#fx .act') && !!document.querySelector('.actback');
    if (!tidyOpen && !leftover) return;
    C.G2.tidyRing = null;
    UI.closeActions();                                                    // the features.js version: also removes .actback
  });

  // ================================================================ G20 Grown-ups say hello once per real visit
  // A grown-up who walks back into her room (wanderers, Uncle Rory, the upstairs visits: all call onEnterRoomBy) says hello at most
  // once every 3 minutes. Only reads G.lastGreet, so a held-back walk-in writes nothing and the next real visit greets.
  // Her own room entries (onEnterRoom) keep the 30 s rule. (Marina's hello back: local edit in family2.js.)
  C.hook('onEnterRoomBy', 'G20', { order: 10, before(c) {
    const e = c.args[0], t = e && G.lastGreet && G.lastGreet[e.id];
    if (t && E.t - t < 180) c.skip = true;
  } });

  // ================================================================ G21 Uncle Rory doesn't walk up to chat while she swings, and giggles at most once per 90 s
  // State for the local edit in more.js (top-level code there, so nothing is declared in that file):
  //  held(): her body is tied up (swing, bars, ride, wheelchair, looping bounce): Rory stays put and turns to her instead.
  //  line(): may his walk-up line and stars play now? At most once per 90 s; stamps the time when it says yes.
  C.G21 = {
    lineAt: -Infinity,
    held: () => C.bodyBusy(),
    line() { if (!(E.t - this.lineAt > 90)) return false; this.lineAt = E.t; return true; },
  };

  // ================================================================ G28 / G29: local edits only (react.js startScenario, minka.js hideTick).
})();
