// extra in-page instrumentation for the prompts worker (added after inst.js). Test-only: observes, never changes game decisions.
(() => {
  if (window.__inst2) return; window.__inst2 = 1;
  const L = window.__L;
  // what makes busyNow() true right now
  const causes = () => { const c = [], up = id => { const n = document.getElementById(id); return !!n && !n.classList.contains('hidden'); };
    if (up('title')) c.push('title'); if (up('panel')) c.push('panel:' + (UI.panelMode || '?')); if (window.Studio && Studio.active) c.push('studio'); if (document.getElementById('storyBox')) c.push('story'); if (document.getElementById('stkBox')) c.push('stk');
    if (document.querySelector('.fortbar')) c.push('fortbar'); if (document.querySelector('.fortin')) c.push('fortin'); if (G.busy) c.push('busy'); if (G.sceneOn) c.push('sceneOn'); if (G.tidy) c.push('tidy'); if (G.chase) c.push('chase'); if (G.tv) c.push('tv');
    if (G.fort && G.fort.inside) c.push('fortInside'); const s = marina.state; if (['swing', 'bars', 'ride', 'wheel'].includes(s)) c.push(s); if (s === 'anim' && marina.anim && marina.anim.loop) c.push('bounce'); return c; };
  window.__causes = causes;
  const C = window.Clarity; let seen = [];
  if (C && C.listen) {
    C.on.T1 = true;
    C.listen('activityStart', 'T1', () => { seen = causes(); L('edge', { dir: 'start', causes: seen.join(',') }); });
    C.listen('activityEnd', 'T1', () => { L('edge', { dir: 'end', causes: seen.join(','), lastInputNow: +lastInput.toFixed(2) }); seen = []; });
    C.every(250, 'T1', () => { if (C.busyNow()) for (const x of causes()) if (!seen.includes(x)) seen.push(x); });
    // walk-in hellos (onEnterRoomBy): after every clarity hook; did this call greet (stamp written)?
    C.hook('onEnterRoomBy', 'T1', { order: -100, before(c) { c.__t = c.args[0] && G.lastGreet[c.args[0].id]; } });
    C.hook('onEnterRoomBy', 'T1', { order: 99, after(c) { const e = c.args[0]; L('oerb', { who: e && e.id, skip: !!c.skip, greeted: !!e && G.lastGreet[e.id] !== c.__t, room: e && e.room }); } });
  }
  // her own room entries (onEnterRoom): which stamp changed
  const _oer = window.onEnterRoom;
  window.onEnterRoom = function (room) { const b = Object.assign({}, G.lastGreet); const r = _oer.apply(this, arguments); const ch = Object.keys(G.lastGreet).filter(k => G.lastGreet[k] !== b[k]); L('oer', { room, greeted: ch.join(',') }); return r; };
  // Rory: walk-ups (walkTo with speed 70) and the G21 'stay put' answer
  const _rw = rory.walkTo; rory.walkTo = function (x, cb, sp) { if (sp === 70) L('walkup', { x: Math.round(x), mx: Math.round(marina.x), st: marina.state }); else if (cb && (x === 4 || x === ROOMS[rory.room].w - 4)) L('roryleave', { from: rory.room, x: Math.round(rory.x) }); return _rw.apply(this, arguments); };
  const _rs = rory.stop; rory.stop = function () { if (rory.moving) L('rorystop', { st: rory.state }); return _rs.apply(this, arguments); };
  if (C && C.G21) { const _h = C.G21.held; C.G21.held = function () { const r = _h.apply(this, arguments); if (r) L('rorystay', { st: marina.state }); return r; }; }
  // Minka: every mew with its volume (far-room mews are vol 0.2 with no rate) and every 🐾 with its screen side
  const _sfx = Audio2.sfx; Audio2.sfx = function (k, o) { if (k === 'minka_mew') L('mew', { far: !!o && o.vol === 0.2 && o.rate == null, vol: o && +(+o.vol).toFixed(2) }); return _sfx.apply(this, arguments); };
  const _em = window.emit; window.emit = function (kind, x, y, n, o) { if (o && o.ch === '🐾') L('paw2', { side: x < E.camX + E.viewW / 2 ? -1 : 1, x: Math.round(x), cam: Math.round(E.camX) }); return _em.apply(this, arguments); };
  // polled: moodCtx greet, Rory's room, tidy asks
  let mc = null, rr = null, lta = null;
  setInterval(() => { try {
    if (G.moodCtx !== mc) { mc = G.moodCtx; if (mc && mc.type === 'greet') L('greetctx', { who: mc.who && mc.who.id }); }
    const r2 = rory.hidden ? 'hidden' : rory.room; if (r2 !== rr) { if (rr != null) L('roryroom', { from: rr, to: r2 }); rr = r2; }
    if (G.lastTidyAsk !== lta) { if (lta != null) L('tidyask', { at: G.lastTidyAsk }); lta = G.lastTidyAsk; }
  } catch (e) { } }, 100);
})();
