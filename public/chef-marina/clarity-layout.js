// Chef Marina — clarity: picture framing, mood column, room strip and title picker (G4 G13 G14 G19).
// Built by the 'layout' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
//
// Local edits that belong to this file (each tests its own switch at call time; off = today's exact expression):
//   engine.js resize()   /* G4 */   sideways, the living room always uses the TV-on framing (zoom 1)
//   game.js camera padR  /* G19 */  sideways, the picture already stops where the mood column starts: no extra 76 px
// Everything here only lays things out: no taps are taken, no game state or saved data is touched.
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;

  const ready = () => typeof E !== 'undefined' && !!E && !!E.cv && !!E.ctx && typeof G !== 'undefined' && !!G && typeof marina !== 'undefined' && !!marina && typeof ROOMS !== 'undefined';
  const stageBox = () => document.getElementById('stage').getBoundingClientRect();
  // the game's own resize() then render() (engine.js / game.js, called by name, never wrapped): no blank frame in between
  function redraw() { resize(); try { render(); } catch (e) { C.warnOnce('layout render', e); } }

  // ================================================================ G4  sideways living room: the TV hangs below the room strip
  // engine.js resize() (local edit /* G4 */) picks zoom 1 for the living room in landscape, the framing the game already uses
  // while a show plays. Here: whenever she arrives in or leaves the living room, the zoom follows at once (resize + render), and
  // the camera is snapped again the way changeRoom snaps it, because changeRoom snapped it with the old view width.
  // 'room' events cover changeRoom (strip, arrows, swipes, map, doors, travel); the 200 ms look (and the same look once per
  // frame, below) also covers startScenario, which sets G.room directly when a game starts.
  C.G4 = { room: null };
  // the zoom resize() would pick right now (mirrors engine.js resize(), including its G4 test)
  function g4want(r) {
    const g4 = C.is('G4') && C.landscape();
    return r.width > r.height && !(g4 ? G.room === 'living' : G.tv && G.room === 'living') ? 1.16 : 1;
  }
  function g4stale() {
    const r = stageBox(); if (r.width < 2 || r.height < 2 || !E.cssScale) return false;
    return Math.abs(E.cssScale / (r.height / SH) - g4want(r)) > 0.005;
  }
  function g4fix(arrived) {
    redraw();
    if (arrived) {                                                  // same snap as changeRoom / startScenario, with the new view width
      const W = ROOMS[G.room].w; E.camX = clamp(marina.x - E.viewW / 2, 0, Math.max(0, W - E.viewW));
      try { render(); } catch (e) { C.warnOnce('layout render', e); }
    }
    C.hudRects(null, { fresh: true });
  }
  C.listen('room', 'G4', () => { if (!ready()) return; C.G4.room = G.room; if (g4stale()) g4fix(true); });
  function g4look() { if (!ready() || C.G4.room === G.room) return; C.G4.room = G.room; if (g4stale()) g4fix(true); }
  C.every(200, 'G4', g4look);
  // The same look once per frame, from inside update() just before render(): a game started from the title (startScenario sets
  // G.room after startGame's resize) never shows a frame at the living room's zoom. A string compare unless the room changed.
  C.hook('UI.update', 'G4', { order: 50, after(c) { if (!c.skip) g4look(); } });
  // switched on or off while playing: the living room's framing follows (no camera snap; she did not move)
  C.onToggle('G4', () => { if (ready() && g4stale()) g4fix(false); });

  // ================================================================ G13  sideways title picker: no card under 👗 / 📒, nothing in the notch
  // The second row moves one column right ([empty][foyer][yard][🎲]); the empty cell sits under the title's 👗 and 📒 (.tdress /
  // .tbook, absolutely placed, unmoved). The title's sides are inset by the safe areas and the picker may not grow past them.
  // Portrait gets nothing new.
  C.css('G13', '@media (orientation:landscape){' +
    '#title{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}' +
    '.tpick{max-width:100%}' +
    '.tpick .tcardr[aria-label=foyer]{grid-column:2}' +
    '}');

  // ================================================================ G14  upright: the room strip never runs off a small phone
  // Same buttons, same order; on a narrow screen they shrink a little (never below 34 px) so 🚽 stays on screen.
  C.css('G14', '@media (orientation:portrait){#roombar{max-width:calc(100% - 84px)}.rb{flex:0 1 40px;min-width:34px}}');

  // ================================================================ G19  sideways: the mood faces get their own column beside the picture
  // The five faces stop floating over the right of the room: #moodbar becomes a flex item of #app (a row in landscape) in
  // exactly today's screen place, and the picture (#stage) ends where it starts. game.js drops its extra 76 px of camera room
  // (local edit /* G19 */). 😊 becomes the column's purple header handle at today's spot (fixed), still showing the current mood,
  // with a small ▸ (◂ while folded); one tap still folds or unfolds, and a hello (pulseMoods) still unfolds.
  // Folding never resizes the picture: a folded column keeps its slot as a purple lane, with the faces hidden (visibility only;
  // status owns .mood opacity and filter). Every control on the picture keeps today's screen spot, open or folded:
  //  - #roombar and #alerts stay centred on the screen (today's translateX(-50%) is kept);
  //  - the right offsets of the right face card, the weather button, 👗 and 📒 shrink by the slot (the column plus its margins);
  //  - ▶ sits at the picture's edge (right:0), within 3 px of today's spot (see (3)).
  // The slot is the column's margin box: the face width (today's min(13vh/13dvh, 58px)) + its 6 px padding each side + 6 px
  // left and 8 px right margin. The column's width is set to exactly that, so the offsets below always match the real slot.
  // While a story is read (#stage.storyon), the column and handle are hidden as today (the story used to cover them).
  const SLOT_VH = 'min(13vh,58px) + 26px', SLOT_DVH = 'min(13dvh,58px) + 26px';
  const twice = (sel, prop, expr) => sel + '{' + prop + ':' + expr(SLOT_VH) + ';' + prop + ':' + expr(SLOT_DVH) + '}';   // dvh where supported, as the faces do
  C.css('G19', '@media (orientation:landscape){' +
    // (1) the column: a flex item beside the picture, top/bottom exactly where today's absolute column sits (today's top:74px and
    //     bottom:6px were measured from the screen edge, not from inside #app's safe-area padding)
    '#moodbar{position:relative;top:auto;right:auto;bottom:auto;flex:0 0 auto;align-self:stretch;' +
      'margin:calc(74px - env(safe-area-inset-top)) 8px calc(6px - env(safe-area-inset-bottom)) 6px}' +
    twice('#moodbar', 'width', s => 'calc(' + s.replace(' + 26px', ' + 12px') + ')') +
    // (6) folded: the slot stays as a purple lane under the handle, the faces are hidden (not dimmed)
    '#moodbar.collapsed{display:flex}#moodbar.collapsed .mood{visibility:hidden}' +
    // (4) 😊: the column's header handle, at today's spot (top:10px/right:10px of the full-width picture)
    '#moodToggle{position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 10px);background:#3a2f57;border-radius:16px 16px 8px 8px}' +
    '#moodToggle::after{content:"\\25B8";position:absolute;right:4px;bottom:3px;font-size:13px;line-height:1;color:#fff6dc;pointer-events:none}' +
    '#app:has(#moodbar.collapsed) #moodToggle::after{content:"\\25C2"}' +
    // (3) ▶ at the edge of the picture (right:0). On short screens the slot is narrower than today's 74 px offset; there ▶ keeps
    //     today's exact spot instead of creeping up to 4 px toward the column (max() never lets it pass the picture's edge)
    twice('.navarrow.r', 'right', s => 'max(0px, calc(74px - (' + s + ')))') +
    // (5) the strip and the alert row stay centred on the screen
    '#roombar,#alerts{left:calc(50vw - env(safe-area-inset-left))}' +
    // (5) right-hand controls keep their screen spots: today's offset minus the slot
    twice('.facecard.right', 'right', s => 'calc(78px - (' + s + '))') +
    twice('#weatherBtn', 'right', s => 'calc(10px + min(13vh,64px) + 30px - (' + s + '))') +
    twice('#dressBtn', 'right', s => 'calc(78px - (' + s + '))') +
    twice('#bookBtn', 'right', s => 'calc(144px - (' + s + '))') +
    // (8) story time looks as it does today
    '#stage.storyon~#moodbar,#stage.storyon #moodToggle{visibility:hidden}' +
    '}');
  // (7) the picture is resized only when its width really changed. This stylesheet is in place before the game boots, so
  // boot() and startGame() already measure the narrower picture, and the game's own listeners handle rotation and size
  // changes. Left for here: a switch flipped while playing. Never from a #moodbar class change (folding keeps the slot).
  function g19sync() {
    if (!ready()) return;
    const r = stageBox(), dpr = E.dpr || Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 2 || Math.round(r.width * dpr) === E.cv.width) return;     // the canvas already fits the picture
    redraw(); C.hudRects(null, { fresh: true });
  }
  C.onToggle('G19', () => g19sync());
})();
