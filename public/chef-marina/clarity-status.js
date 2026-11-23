// Chef Marina — clarity: what moves and what sleeps: asleep controls, settling alerts, mood glow (G15 G23 G24).
// Built by the 'status' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
// Everything here is look, motion and 'not now' sounds only: no handler, rule, timer, outcome or saved data changes.
// Every hook, tick, listener and stylesheet is registered unconditionally and gated by the core on its own switch,
// so a switch that is off leaves today's game exactly as it was (and turning one on at run time works).
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const $ = id => document.getElementById(id);
  const app = $('app');
  const ms = () => performance.now();
  const game = () => typeof G !== 'undefined' && typeof marina !== 'undefined' && !!marina;
  const nopeBlip = () => Audio2.blip(-12, 'triangle', 0.08, 0.1);     // the game's own dead-end blip (features.js swipe)

  // ================================================================== G15
  // While a scene plays, the controls that can't work look asleep, and every ignored tap gets a 'not now'.
  // (1) Asleep look: a 100 ms tick sets cm-strip / cm-mood / cm-alert on #app, each only after 400 ms of its condition
  //     (so drags and very short busy moments never flash), and clears it at once. The CSS dims the child buttons only,
  //     so the container rules (#stage.tvon #roombar, #floorpill.off, a folded mood column) keep winning.
  // (2) Moods: all five dim, except the face whose scene was started by a live tap within 500 ms (.cm-awake). Never keyed on
  //     .cur (that outline stays, dimmed). Face cards are never dimmed: they are the talking portraits of every scene.
  // (3) 'Not now': decided at tap time from each control's LIVE rule (the same test its own handler makes), never from the
  //     class: a dead tap gets a translate-only side-shake (Clarity.shake) and the low blip.
  // (4) A dead mood tap would also play the mood's own cheerful blip (ui.js); for 60 ms one exact (12,'square',0.08) is skipped.
  // (5) A tap on the picture during a scene gets a grey ring at the finger and the low blip. Never skips the game's onTap.
  // (6) bathTime and other busy moments that are not scenes: no ring (bath taps make bubbles). The strip / pill nope blip is
  //     silent while G.busy && !G.sceneOn && marina.state === 'cheer', because the bath's bubble blip already answers it.
  // (7) Never preventDefault or stopPropagation. The map is never dimmed.
  const hid = id => { const n = $(id); return !n || n.classList.contains('hidden'); };
  // nav.js quiet(): no title, panel, studio, fort builder or interior, story or sticker book
  const quiet = () => typeof marina !== 'undefined' && hid('title') && hid('panel') && !(window.Studio && Studio.active) && !document.querySelector('.fortbar,.fortin,#storyBox,#stkBox');
  const dead = {
    strip: () => !!G.busy,                                                    // features.js roomBar, floors.js strip() and go()
    mood: () => !!G.sceneOn || (!!G.busy && marina.state !== 'tantrum'),      // scenes.js setMood -> game.js setMood
    alert: () => !!G.busy && !!G.sceneOn,                                     // nav.js alert press, fun.js #reqBtn press
    face: who => {                                                            // nav.js face card pointerup
      const ent = { daddy, mommy, rory, miles, niko, nunu, jeff }[who];
      return !ent || ent.hidden || !!G.busy || !quiet();
    },
  };
  const g15 = C.G15 = { dead, awakeMs: 500, holdMs: 400, skipUntil: 0, pend: null, since: { 'cm-strip': 0, 'cm-mood': 0, 'cm-alert': 0 } };

  C.css('G15', [
    // the asleep look (child buttons only). Existing transitions are kept: .mood has transition:transform .1s (its press).
    '#app.cm-strip #roombar .rb,#app.cm-strip #floorpill .fl,#app.cm-alert #alerts .alertb,#app.cm-alert #reqBtn{opacity:.45;filter:grayscale(.7);transition:opacity .2s}',
    '@media (orientation:portrait){#app.cm-mood #moodbar .mood:not(.cm-awake){opacity:.45;filter:grayscale(.7);transition:opacity .2s,transform .1s}}',
    // landscape: never touch a folded column (layout hides folded faces); dim only an unfolded one
    '@media (orientation:landscape){#app.cm-mood #moodbar:not(.collapsed) .mood:not(.cm-awake){opacity:.45;filter:grayscale(.7);transition:opacity .2s,transform .1s}}',
    // the grey ring at her finger on a scene tap (pointer-events:none is also set inline: #fx>* is pointer-events:auto)
    '.cm-g15-ring{position:absolute;z-index:4;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:3px solid rgba(215,215,225,.95);box-shadow:0 0 0 2px rgba(40,30,60,.3);animation:cm-g15-ring .4s ease-out both}',
    '@keyframes cm-g15-ring{from{transform:scale(.55);opacity:.95}to{transform:scale(1.15);opacity:0}}',
  ].join('\n'));

  function hold(cls, on, t) {                    // dim after 400 ms of the condition, brighten at once
    if (on) { if (!g15.since[cls]) g15.since[cls] = t; if (t - g15.since[cls] >= g15.holdMs && !app.classList.contains(cls)) app.classList.add(cls); }
    else { g15.since[cls] = 0; if (app.classList.contains(cls)) app.classList.remove(cls); }
  }
  function wake(t) {                             // the face whose scene a live tap just started stays bright until it ends
    if (g15.pend) {
      if (G.sceneOn && t - g15.pend.t <= g15.awakeMs) { if (g15.pend.el.isConnected) g15.pend.el.classList.add('cm-awake'); g15.pend = null; }
      else if (t - g15.pend.t > g15.awakeMs) g15.pend = null;
    }
    if (!G.sceneOn) for (const n of document.querySelectorAll('#moodbar .mood.cm-awake')) n.classList.remove('cm-awake');
  }
  C.every(100, 'G15', t => {
    if (!game()) return;
    const busy = !!G.busy;
    hold('cm-strip', busy, t);
    hold('cm-mood', dead.mood(), t);
    hold('cm-alert', busy && !!G.sceneOn, t);
    wake(t);
  });
  function g15Clear() {
    for (const k of ['cm-strip', 'cm-mood', 'cm-alert']) { app.classList.remove(k); g15.since[k] = 0; }
    for (const n of document.querySelectorAll('.cm-awake')) n.classList.remove('cm-awake');
    g15.pend = null; g15.skipUntil = 0;
  }
  C.onToggle('G15', on => { if (!on) g15Clear(); });

  // (3) 'not now', decided from the live rule at tap time (window capture, before any game handler; look only)
  C.pointer('up', 'G15', e => {
    if (!game() || !e.target || !e.target.closest) return;
    const tg = e.target; let el;
    if ((el = tg.closest('#roombar .rb,#floorpill .fl'))) {
      if (!dead.strip()) return;
      C.shake(el);
      if (!(G.busy && !G.sceneOn && marina.state === 'cheer')) nopeBlip();      // (6) the bath already answers with bubbles
      return;
    }
    if ((el = tg.closest('#moodbar .mood'))) {
      if (dead.mood()) { C.shake(el); g15.skipUntil = ms() + 60; nopeBlip(); return; }
      g15.pend = { el, t: ms() };                                                // live: does a scene start within 500 ms?
      setTimeout(() => { if (C.is('G15') && game()) wake(ms()); }, 0);
      return;
    }
    if ((el = tg.closest('#alerts .alertb,#reqBtn'))) { if (dead.alert()) { C.shake(el); nopeBlip(); } return; }
    if ((el = tg.closest('.facecard'))) {
      const story = !!$('storyBox'), who = el.dataset.who;
      if (who === 'marina') { C.shake(el, { px: 3, ms: 180, times: 2 }); if (!story) Audio2.blip(7, 'triangle', 0.06, 0.07); return; }   // her own card: a little wiggle, a soft blip
      let d; try { d = dead.face(who); } catch (x) { return; }
      if (d) { C.shake(el); if (!story) nopeBlip(); }
    }
  });

  // (4) the dead mood tap's own cheerful blip (ui.js: Audio2.blip(12,'square',0.08)) is skipped once, within 60 ms
  C.hook('Audio2.blip', 'G15', {
    order: 10, before(c) {
      if (!g15.skipUntil) return;
      if (ms() > g15.skipUntil) { g15.skipUntil = 0; return; }
      const a = c.args;
      if (a.length === 3 && a[0] === 12 && a[1] === 'square' && a[2] === 0.08) { g15.skipUntil = 0; c.skip = true; }
    },
  });

  // (5) a tap on the picture during a scene: grey ring at the finger + the low blip; the game's onTap still runs as today
  C.hook('onTap', 'G15', {
    order: 10, before(c) {
      if (!game() || !G.sceneOn) return;
      const fx = $('fx'), px = +c.args[0], py = +c.args[1]; if (!fx || !isFinite(px) || !isFinite(py)) return;
      const r = document.createElement('div'); r.className = 'cm-g15-ring';
      r.style.cssText = 'left:' + Math.round(px) + 'px;top:' + Math.round(py) + 'px;pointer-events:none';
      fx.append(r); setTimeout(() => r.remove(), 400);
      nopeBlip();
    },
  });

  // ================================================================== G23
  // Motion means 'new': alerts pulse when they arrive and then rest, arrows bob on arrival, the idle wiggle backs off
  // (only things she can see wiggle, and less often), and 🧻🚽 turns red.
  // (1) Each new alert is stamped data-born; after 15 s it gets .settled (still the same red disc, same size, same tap, just
  //     still). Every room change wakes them for 4 s. Alerts are rebuilt after every screen and busy spell, so they pulse again.
  // (2) The side arrows stop wiggling the whole button; on arrival only the inner ◀/▶ glyph bobs for 2.4 s.
  // (3) features.js:598-599 (local edit /* G23 */): the idle-wiggle gap comes from hintGap() (Infinity while a fresh alert,
  //     a wish or a request shows; else 4, 8, 16, 20 s by wiggles since her last touch), the props list keeps only props
  //     whose centre is on the picture, and the wiggle counter n counts there. The first wiggle still comes after 10 s.
  C.css('G23', [
    '.alertb.settled{animation:none}',
    // 🧻🚽 ('someone is stuck') is red like the other 'someone needs you' discs; equal specificity, after nav.js's green
    '.alertb[aria-label=tp]{background:#ff6b6b;box-shadow:0 4px 0 rgba(0,0,0,.3),0 0 0 6px rgba(255,107,107,.35)}',
    '.navarrow{animation:none!important}',
    '.navarrow.l.cm-arrive i{display:inline-block;animation:navl .6s ease-in-out 4 alternate}',
    '.navarrow.r.cm-arrive i{display:inline-block;animation:navr .6s ease-in-out 4 alternate}',
  ].join('\n'));

  const g23 = C.G23 = {
    n: 0, li: null, wakeUntil: 0, settleMs: 15000, wakeMs: 4000, arriveMs: 2400,
    // the idle-wiggle gap in seconds (read every frame by features.js while G23 is on)
    hintGap() {
      const li = typeof lastInput === 'number' ? lastInput : 0;
      if (li !== this.li) { this.li = li; this.n = 0; }                         // any touch starts the back-off over
      if (document.querySelector('.alertb:not(.settled):not([aria-label=pickeep]),#wishBtn,#reqBtn')) return Infinity;
      return [4, 8, 16, 20][Math.min(this.n, 3)];
    },
    // is this prop's middle on the picture, i.e. on screen and not under a button, a face card, the strip or a ring?
    see(p) {
      let b;
      if (p.k && p.k.startsWith('p:')) b = [-(p.w || 0) / 2, -(p.h || 0), (p.w || 0) / 2, 0];
      else { const sc = p.scale || 1; b = (typeof visBox === 'function' ? visBox(p.k) : [0, 0, 0, 0]).map(v => v * sc); }
      const c = C.toClient(p.x + (b[0] + b[2]) / 2, p.y + (b[1] + b[3]) / 2);
      return C.onCanvas(c[0], c[1]);
    },
  };
  C.appear('#alerts .alertb', 'G23', n => { if (n.isConnected && !n.dataset.born) n.dataset.born = String(ms()); });
  C.every(250, 'G23', t => {
    for (const n of document.querySelectorAll('#alerts .alertb')) {
      if (!n.dataset.born) n.dataset.born = String(t);
      const settle = t - +n.dataset.born >= g23.settleMs && t >= g23.wakeUntil;
      if (settle !== n.classList.contains('settled')) n.classList.toggle('settled', settle);
    }
  });
  let arriveT = 0;
  function arrive() {                            // the glyph bobs for 2.4 s; the button box never moves
    for (const b of document.querySelectorAll('.navarrow')) {
      if (b.classList.contains('cm-arrive')) { const i = b.querySelector('i'); if (i && i.getAnimations) for (const a of i.getAnimations()) { try { a.currentTime = 0; } catch (x) { } } }
      else b.classList.add('cm-arrive');
    }
    clearTimeout(arriveT);
    arriveT = setTimeout(() => { for (const b of document.querySelectorAll('.navarrow.cm-arrive')) b.classList.remove('cm-arrive'); }, g23.arriveMs);
  }
  C.listen('room', 'G23', () => {
    g23.wakeUntil = ms() + g23.wakeMs;
    for (const n of document.querySelectorAll('#alerts .alertb.settled')) n.classList.remove('settled');
    arrive();
  });
  C.onToggle('G23', on => {
    if (on) return;
    clearTimeout(arriveT);
    for (const n of document.querySelectorAll('.navarrow.cm-arrive')) n.classList.remove('cm-arrive');
    for (const n of document.querySelectorAll('#alerts .alertb')) { n.classList.remove('settled'); delete n.dataset.born; }
  });

  // ================================================================== G24
  // The mood faces wobble in place, and a repeat hello does not wobble them again.
  // (1) The generic .pulse rule moved the whole bar (faces spilled off the screen); now the bar never moves and each face
  //     keeps its own wobble (style.css #moodbar.pulse .mood).
  // (2) A greeting from someone whose hello already pulsed the faces less than 5 minutes ago only unfolds a folded column
  //     (today's unfold) and does not pulse; G.moodCtx is still set by the caller, so a mood tap still answers the hello.
  //     Scold, refused, refused_insta, tvOff, fortFell and pressureEat pulse exactly as today.
  C.css('G24', '#moodbar.pulse{animation:none!important}');
  const g24 = C.G24 = { lastGlow: {}, gapS: 300 };
  C.hook('UI.pulseMoods', 'G24', {
    order: 10, before(c) {
      const m = typeof G !== 'undefined' && G.moodCtx;
      if (m && m.type === 'greet' && m.who && m.who.id) {
        const last = g24.lastGlow[m.who.id];
        if (last != null && E.t - last < g24.gapS) { const bar = $('moodbar'); if (bar) bar.classList.remove('collapsed'); c.skip = true; return; }
        g24.lastGlow[m.who.id] = E.t;
      }
    },
  });
})();
