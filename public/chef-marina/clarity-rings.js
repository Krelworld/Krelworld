// Chef Marina — clarity: choice rings and what a tap reaches (G6 G7 G8 G11 G18 G30).
// Built by the 'rings' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
//
// What lives where:
//   G6  rings stay clear of the other buttons ............ ui.js placeActs, one line after the avoid list (/* G6 */)
//   G7  long lists show every choice ...................... ui.js actions(), the tray test (/* G7 */) + the CSS and the tray's top here
//   G8  the kitchen island and the playroom rocker answer . hitTest after-hook here
//   G11 the deer's 'this way' tab sits where the turkeys' does . wildlife.js tab() (/* G11 */)
//   G18 the thing she tapped lights up until its choices close . hooks here + nav.js glow (/* G18 */)
//   G30 the stairs choices say up or down ................. UI.actions after-hook + CSS here
// Every hook, tick, listener and stylesheet below is registered unconditionally; the core runs it only while its switch is on.
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const fxActs = () => document.querySelectorAll('#fx .act');

  // ================================================================ G7  long choice lists show every choice
  // The strip wraps onto a second row (rarely a third) instead of scrolling sideways; on a 375 px phone the buttons are 60 px so
  // five still fit per row. In landscape, ui.js shows a list that fits as placeActs' two-row ring as that ring (/* G7 */ there).
  C.css('G7', '.acttray{flex-wrap:wrap;justify-content:center;overflow:visible;row-gap:8px}' +
    '@media (max-width:380px){.acttray .act{flex-basis:60px;width:60px;height:60px;line-height:60px;font-size:30px}}');
  // The strip's top is set ONCE, as the list opens: just below the alert circles if any are showing then, else the usual 64 px.
  // It never moves while the list is open, so an alert that arrives mid-pick cannot slide the choices under her finger.
  C.hook('UI.actions', 'G7', {
    order: 10,
    after(c) {
      if (c.skip) return;
      const tray = document.querySelector('#fx .acttray'), al = document.getElementById('alerts');
      if (tray && al && al.children.length) tray.style.top = (al.offsetTop + al.offsetHeight + 8) + 'px';
    },
  });
  C.onToggle('G7', on => { if (!on) { const t = document.querySelector('#fx .acttray'); if (t) t.style.top = ''; } });

  // ================================================================ G30  the stairs choices say up or down
  // On the foyer stairs ring (prop 'stairs') and the landing's stair top (prop 'ustairs') the 🪜 and 💺 choices each get a small
  // ⬆️ / ⬇️ in their bottom-right corner. The arrow is a child of its own button, so a tap on it is a tap on that choice
  // (no pointer-events:none: the tap must never fall through to the dim backdrop). a.ico, the order and the actions never change.
  C.css('G30', '.act .cm-badge{position:absolute;right:-4px;bottom:-4px;font-size:22px;line-height:1;font-style:normal}');
  C.hook('UI.actions', 'G30', {
    order: 20,
    after(c) {
      if (c.skip) return;
      const p = c.args[0] && c.args[0].prop; if (!p || (p.a !== 'stairs' && p.a !== 'ustairs')) return;
      const arrow = p.a === 'stairs' ? '⬆️' : '⬇️';
      for (const n of fxActs()) {
        if (n.closest('.acttray') || n.querySelector('.cm-badge')) continue;          // rings only, and never two badges
        const t = n.textContent; if (t !== '🪜' && t !== '💺') continue;             // checked before the badge goes in
        const b = document.createElement('i'); b.className = 'cm-badge'; b.textContent = arrow; n.append(b);
      }
    },
  });
  C.onToggle('G30', on => { if (!on) document.querySelectorAll('#fx .act .cm-badge').forEach(b => b.remove()); });

  // ================================================================ G8  the kitchen island and the playroom rocker can be tapped
  // Rule: when the prop that won the tap is see-through under her finger, the prop she can actually see there answers.
  //  * Kitchen: the bar stools (drawn in front) cover the whole island. Between their rungs and legs, inside the island's painted
  //    box, the island answers (🧺 🗄️ 🧗, plus ⬇️ while holding a dish). Every drawn stool pixel stays the stool.
  //  * Playroom: the toy shelf's box covers the rocker. Both are wall props drawn in PROPS order, rocker first, so the shelf is
  //    painted on top: only where the shelf is see-through AND the rocker is drawn does the rocker answer (🪑). Every drawn shelf
  //    pixel stays the shelf (🧸).
  // 'See-through' = alpha <= 20 at every sprite pixel within 2 world units; 'drawn' = alpha > 20 within 1 unit. Same mapping
  // as visBox (engine.js). People, Marina, tidy-mode mess, pictures and toys are decided before this and are never touched.
  const ALPHA = {};
  function alphaMap(k) {
    if (ALPHA[k]) return ALPHA[k];
    const c = typeof spriteCanvas === 'function' ? spriteCanvas(k) : null; if (!c || !c.width || !c.height) return null;   // not cached: try again later
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, a = new Uint8Array(c.width * c.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return (ALPHA[k] = { w: c.width, h: c.height, a });
  }
  // the strongest alpha of prop p's own sprite within u world units of the world point (wx, wy); null if the sprite is unknown
  function alphaNear(p, wx, wy, u) {
    const m = p && p.k ? alphaMap(p.k) : null; if (!m) return null;
    const sc = p.scale || 1, f = p.flip ? -1 : 1, px = Math.floor(f * (wx - p.x) / sc + m.w / 2), py = Math.floor((wy - p.y) / sc + m.h), r = Math.ceil(u / sc);
    let best = 0;
    for (let y = Math.max(0, py - r), y1 = Math.min(m.h - 1, py + r); y <= y1; y++)
      for (let x = Math.max(0, px - r), x1 = Math.min(m.w - 1, px + r); x <= x1; x++) { const v = m.a[y * m.w + x]; if (v > best) best = v; }
    return best;
  }
  C.hook('hitTest', 'G8', {
    order: 10,
    after(c) {
      const h = c.result; if (c.skip || !h || h.kind !== 'prop' || !h.p || typeof G === 'undefined') return;
      const p = h.p, wx = c.args[0], wy = c.args[1];
      if (G.room === 'kitchen' && p.a === 'stool') {
        const isl = PROPS.kitchen.find(q => q.id === 'island');
        if (!isl || !(Math.abs(wx - isl.x) < isl.w / 2 && wy >= isl.y - isl.h && wy <= isl.y)) return;
        const s = alphaNear(p, wx, wy, 2); if (s == null || s > 20) return;          // she can see the stool there: it answers, as today
        c.result = { kind: 'prop', p: isl };
      } else if (G.room === 'playroom' && p.id === 'toyshelf') {
        const rk = PROPS.playroom.find(q => q.id === 'rocker'); if (!rk) return;
        const s = alphaNear(p, wx, wy, 2); if (s == null || s > 20) return;          // a shelf pixel she can see: still the shelf
        const r = alphaNear(rk, wx, wy, 1); if (r == null || r <= 20) return;        // nothing of the rocker there either
        c.result = { kind: 'prop', p: rk };
      }
    },
  });

  // ================================================================ G18  the thing she tapped lights up until its choices close
  // From her tap on a thing or a person until its choices close, that thing glows at full strength (the same warm glow she sees
  // next to things) and everything else's glow eases out, so it is the only lit thing; one small sparkle as she sets off.
  // The walk, its timing and the choices are untouched (never calls hitTest, propActions or entActions). Nothing is lit during
  // scenes. Cleared: when its choices close (UI.closeActions, or closed by ui.js itself), on her next tap on the picture, on a
  // room change, as soon as G.busy / G.sceneOn, when a ring for something else opens, and 0.6 s after she arrived if no ring
  // opened (doors, the towel rack, the lumber pile...). The proximity glow is today's whenever nothing is targeted.
  const S = C.G18 = {
    target: null, person: false, t: 0, ring: false, arrived: null, at: -1,
    // nav.js glow: o is a prop or a person being drawn, nr today's 'near enough to glow'
    glow(o, nr) {
      frame();
      const t = S.target; if (!t) return nr;
      if (o !== t) return false;
      return !G.busy && !G.sceneOn && marina.state !== 'anim' && !(S.person && marina.mount);   // people never glow while she rides, as today
    },
  };
  function clear() { S.target = null; S.person = false; S.ring = false; S.arrived = null; }
  // bookkeeping once per game frame (from the glow) and from a 50 ms tick (in case nothing is drawn)
  function frame() {
    if (typeof E === 'undefined' || typeof G === 'undefined' || S.at === E.t) return; S.at = E.t;
    if (!S.target) return;
    if (G.busy || G.sceneOn) return clear();
    if (S.ring) { if (!document.querySelector('#fx .act')) clear(); return; }        // its ring closed (also privately, inside ui.js)
    const mv = marina.mount || marina; if (mv.moving) { S.arrived = null; return; }
    if (S.arrived == null) S.arrived = E.t; else if (E.t - S.arrived >= 0.58) clear(); // arrived, and no ring within 0.6 s (one frame spare): walk-only things
  }
  C.every(50, 'G18', frame);
  C.hook('onTap', 'G18', { order: 5, before() { clear(); } });                       // never skips; interact sets the new target in the same call
  C.hook('interact', 'G18', {
    order: 10,
    before(c) {
      const hit = c.args[0]; if (!hit || G.busy) return;
      const o = hit.kind === 'prop' ? hit.p : hit.kind === 'ent' && hit.e !== marina ? hit.e : null;   // props and people only
      if (!o) return;
      clear(); S.target = o; S.person = hit.kind === 'ent'; S.t = E.t;
      if (typeof o.x === 'number' && typeof o.y === 'number') emit('sparkle', o.x, o.y - 24, 3);
    },
  });
  C.hook('UI.actions', 'G18', {
    order: 30,
    after(c) {
      if (c.skip || !S.target || !document.querySelector('#fx .act')) return;
      const a = c.args[0];
      if (a && (a === S.target || a.prop === S.target)) S.ring = true; else clear();
    },
  });
  C.hook('UI.closeActions', 'G18', { order: 10, after() { clear(); } });
  C.listen('room', 'G18', () => clear());
  C.onToggle('G18', () => clear());
})();
