// Chef Marina — the Lego shelf in Nunu's living room: the creations she wants to keep, on show.
// Load after bricks.js and basement.js. Nothing else is changed: the shelf adds itself to the den and wraps drawProp / propActions.
//   LegoShelf.list()            -> [{ kind, pieces, bp, t, slot }]  (slot 0..7, left to right, top row first)
//   LegoShelf.keep(kind)        a copy of what is on that plate goes on the shelf: true = kept, false = the shelf is full, null = nothing new to keep
//   LegoShelf.remove(i)         take the i-th one of list() off the shelf;  LegoShelf.move(i, slot)  put it in another spot (swaps if taken)
//   LegoShelf.has(kind, pieces) is this very build on the shelf already?
//   LegoShelf.open(opts)        the big shelf (full screen, inside #panel); opts.full = wobble "no room", opts.pending = kind waiting for a spot
//   LegoShelf.dance()           the models in the room hop in turn, each with its own note
//   LegoShelf.onEvent           set this to a function(kind): 'keep' | 'full' | 'look' | 'takedown' | 'remove'
// Saved in localStorage 'cm_brickshelf': [{ kind: 'lego' | 'tiles', pieces: [[piece, colour, x, y], ...], bp, t, s }]   (s = the spot)
(function () {
  'use strict';
  if (window.LegoShelf && window.LegoShelf.list) return;      // loaded twice: once is enough
  const KEY = 'cm_brickshelf', MAX = 8, COLS = 4;
  const B = () => window.Bricks || null;
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const au = () => (typeof Audio2 !== 'undefined' && Audio2) || null;
  const blip = (n, type, len, vol) => { try { const a = au(); a && a.blip(n, type, len, vol); } catch (e) { } };
  const jingle = (n, step, type) => { try { const a = au(); a && a.jingle(n, step, type); } catch (e) { } };
  const whoosh = up => { try { const a = au(); a && a.whoosh(up); } catch (e) { } };
  const pop = () => { try { if (typeof chip === 'function') { chip('pop'); return; } } catch (e) { } blip(9, 'triangle', 0.07, 0.14); };
  const NOTES = [0, 4, 7, 12, 2, 5, 9, 14];            // each spot has its own note
  const BACKS = { lego: '#a8dcf3', tiles: '#171c3d', none: '#ddd5c3' }, BASE = { lego: '#43b453', tiles: '#4350a0' }, WHITE = '#fbfaf5', SHADE = '#d6d0c0';

  // ------------------------------------------------------------------ what is on the shelf
  let raw, items = [], readAt = 0, memOnly = false, newest = -1, home = null, fresh = null;
  const sig = pieces => pieces.map(p => p.join(',')).sort().join(';');
  function parse(s) {
    let a = null; try { a = JSON.parse(s); } catch (e) { } const out = [], used = {}, b = B(); if (!Array.isArray(a) || !b || !b.tidy) return out;
    for (const q of a) {
      if (!q || typeof q !== 'object' || (q.kind !== 'lego' && q.kind !== 'tiles')) continue; let p = []; try { p = b.tidy(q.kind, q.pieces); } catch (e) { } if (!p.length) continue;
      const s = Number.isInteger(q.s) && q.s >= 0 && q.s < MAX && !used[q.s] ? q.s : -1; if (s >= 0) used[s] = 1;
      out.push({ kind: q.kind, pieces: p, bp: typeof q.bp === 'string' ? q.bp : null, t: +q.t || 0, s, g: sig(p) }); if (out.length >= MAX) break;
    }
    for (const e of out) if (e.s < 0) { let s = 0; while (used[s]) s++; used[s] = 1; e.s = s; }
    return out.sort((x, y) => x.s - y.s);
  }
  function read(now) {
    const t = Date.now(); if (memOnly || (!now && t - readAt < 1000)) return items; readAt = t;
    let s; try { s = localStorage.getItem(KEY); } catch (e) { memOnly = true; return items; }
    if (s !== raw) { raw = s; items = s ? parse(s) : []; }
    return items;
  }
  function write() { items.sort((x, y) => x.s - y.s); readAt = Date.now(); try { raw = JSON.stringify(items.map(e => ({ kind: e.kind, pieces: e.pieces, bp: e.bp, t: e.t, s: e.s }))); localStorage.setItem(KEY, raw); } catch (e) { memOnly = true; } }
  const at = s => read().find(e => e.s === s) || null;
  const list = () => read(true).map(e => ({ kind: e.kind, pieces: e.pieces, bp: e.bp, t: e.t, slot: e.s }));
  function has(kind, pieces) { const b = B(); if (!b || !Array.isArray(pieces)) return false; let k; try { k = sig(b.tidy(kind, pieces)); } catch (e) { return false; } return read().some(e => e.kind === kind && e.g === k); }
  const fire = kind => { try { if (typeof api.onEvent === 'function') api.onEvent(kind); } catch (e) { } };
  function keep(kind) {
    const b = B(); if (!b || !b.pieces) return null; let p = []; try { p = b.pieces(kind); } catch (e) { } if (!p || !p.length) return null;
    read(true); const g = sig(p); if (items.some(e => e.kind === kind && e.g === g)) return null;
    if (items.length >= MAX) { fire('full'); return false; }
    let s = home && home.kind === kind && !items.some(e => e.s === home.s) ? home.s : 0; while (items.some(e => e.s === s)) s++; home = null;      // a model that was taken down goes back where it stood
    items.push({ kind, pieces: p, bp: b.blueprint ? b.blueprint(kind) : null, t: Date.now(), s, g }); write(); newest = s; fresh = { s, n: 4 };
    setTimeout(() => { try { window.did && did('legoshelf'); } catch (e) { } }, 1300);      // the sticker pops once it has landed
    fire('keep'); return true;
  }
  function dropSlot(s) { const i = items.findIndex(e => e.s === s); if (i < 0) return null; const e = items.splice(i, 1)[0]; if (newest === s) newest = -1; write(); return e; }
  function remove(i) { const e = read(true)[i]; if (!e) return false; dropSlot(e.s); fire('remove'); return true; }
  function swap(from, to) { if (from === to || to < 0 || to >= MAX) return false; read(true); const a = items.find(e => e.s === from), b = items.find(e => e.s === to); if (!a) return false; a.s = to; if (b) b.s = from; write(); return true; }
  function move(i, slot) { const e = read(true)[i]; return !!e && swap(e.s, slot | 0); }

  // ------------------------------------------------------------------ the shelf on the wall of the den
  // white cubbies above the two chairs, standing on the wall's ledge rail: four across, two up. Each back is the colour of that toy's plate.
  const P = { id: 'legoshelf', k: 'p:legoshelf', x: 246, y: 97, w: 98, h: 46, a: 'legoshelf' }, CW = 23, CH = 20;
  const D = { glow: 0, tw: null, twAt: -9, dance: null };
  const cub = i => { const c = i % COLS, r = (i / COLS) | 0; return { x: P.x - P.w / 2 + 1 + c * (CW + 1) + (c > 1 ? 1 : 0), y: P.y - P.h + 2 + r * (CH + 2), w: CW, h: CH }; };
  function star(x, y, k) {                            // a four-point twinkle, k = 0..1
    const r = Math.max(0, Math.round(Math.sin(k * Math.PI) * 4)); rect(x - r, y, r * 2 + 1, 1, '#ffffff'); rect(x, y - r, 1, r * 2 + 1, '#ffffff'); if (r > 1) { rect(x - 1, y - 1, 3, 3, '#fff6a8'); rect(x, y, 1, 1, '#ffffff'); }
  }
  function drawShelf(p) {
    const ctx = E.ctx, t = E.t, L = p.x - p.w / 2, T = p.y - p.h, all = read(), b = B();
    const near = typeof marina !== 'undefined' && !G.busy && !G.sceneOn && marina.state !== 'anim' && Math.abs(marina.x - p.x) < p.w / 2 + 12;
    D.glow = lim(D.glow + (near ? 0.08 : -0.06), 0, 1);
    if (D.glow > 0.02) { const x = p.x - E.camX, y = p.y - p.h / 2, gr = ctx.createRadialGradient(x, y, 4, x, y, 64); gr.addColorStop(0, 'rgba(255,240,170,' + (0.4 * D.glow * (0.85 + Math.sin(t * 4) * 0.15)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 70, y - 50, 140, 100); }
    const bo = typeof G !== 'undefined' && G.bounce && G.bounce.id === p.id && t - G.bounce.t0 < 0.35 ? Math.sin((t - G.bounce.t0) / 0.35 * Math.PI) : 0;
    rect(L + 2, T + 3, p.w, p.h - 1, 'rgba(70,50,30,.16)');
    rect(L, T, p.w, p.h, WHITE); rect(L, T, p.w, 1, '#ffffff'); rect(L + p.w - 1, T + 1, 1, p.h - 1, SHADE); rect(L, p.y - 1, p.w, 1, SHADE); rect(L, T + 23, p.w, 1, SHADE);
    for (let i = 0; i < MAX; i++) { const c = cub(i), e = all.find(q => q.s === i);
      rect(c.x, c.y, c.w, c.h, BACKS[e ? e.kind : 'none']); rect(c.x, c.y, c.w, 2, 'rgba(30,25,60,.16)'); rect(c.x, c.y + 2, 1, c.h - 2, 'rgba(30,25,60,.10)');
      if (e) rect(c.x, c.y + c.h - 1, c.w, 1, BASE[e.kind]); }
    // she walks past: now and then one of them twinkles (a new one twinkles a few times so she finds it)
    const quiet = document.getElementById('panel').classList.contains('hidden');
    if (!D.tw && all.length && quiet) {
      if (fresh && at(fresh.s)) { if (t - D.twAt > 0.9) { D.tw = { s: fresh.s, t0: t }; D.twAt = t; if (--fresh.n <= 0) fresh = null; } }
      else if (typeof marina !== 'undefined' && marina.moving && Math.abs(marina.x - p.x) < 72 && t - D.twAt > 2.5 && Math.random() < (E.dt || 0.016) * 1.4) { D.tw = { s: all[(Math.random() * all.length) | 0].s, t0: t }; D.twAt = t; }
    }
    const dn = D.dance; if (dn && t - dn.t0 > dn.n * 0.3 + 0.6) D.dance = null;
    all.forEach((e, n) => {
      const c = cub(e.s); let hop = bo * 2;
      if (dn) { const k = (t - dn.t0 - n * 0.3) / 0.42; if (k > 0 && k < 1) hop += Math.sin(k * Math.PI) * 5; }
      if (D.tw && D.tw.s === e.s) hop += Math.sin(Math.min(1, (t - D.tw.t0) / 0.3) * Math.PI) * 1.5;
      try { b && b.drawPieces(ctx, e.kind, e.pieces, c.x + c.w / 2 - E.camX, c.y + c.h - 1 - hop, 17, { w: 21 }); } catch (err) { }
    });
    if (D.tw) { const k = (t - D.tw.t0) / 0.7; if (k >= 1) D.tw = null; else { const c = cub(D.tw.s); star(c.x + c.w - 6, c.y + 5, k); star(c.x + 6, c.y + 11, lim(k * 1.4 - 0.4, 0, 1)); } }
  }
  function dance() {
    const all = read(); if (!all.length || typeof E === 'undefined') return false; D.dance = { t0: E.t, n: all.length };
    all.forEach((e, n) => setTimeout(() => { if (typeof G === 'undefined' || G.room !== 'den') return; blip(NOTES[e.s], e.kind === 'lego' ? 'triangle' : 'sine', e.kind === 'lego' ? 0.12 : 0.22, 0.17); setTimeout(() => blip(NOTES[e.s] + 12, e.kind === 'lego' ? 'triangle' : 'sine', 0.1, 0.1), 90);
      const c = cub(e.s); try { emit('note', c.x + c.w / 2, c.y, 1, { size: 8, life: 1.1 }); } catch (err) { } }, n * 300));
    setTimeout(() => { if (typeof G === 'undefined' || G.room !== 'den' || G.busy) return; jingle([12, 16, 19, 24], 0.07); try { emit('star', P.x, P.y - 24, 8); if (marina.state === 'idle' && !marina.moving) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1300); } } catch (err) { } }, all.length * 300 + 250);
    return true;
  }
  // down to the table to build on it: the Lego table in the den (with Nunu, if she is there); the tiles open straight away
  function toTable(kind) {
    const b = B(); if (!b) return;
    try { if (kind === 'lego' && G.room === 'den') { const p = PROPS.den.find(q => q.id === 'ltable'), a = p && propActions(p).find(x => x.ico === '🧱'); if (a) { a.fn(); return; } } } catch (e) { }
    b.open({ kind, onDone: r => { try { if (r && r.count) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1800); emit('confetti', marina.x, marina.y - 60, 24); say(pick(['m_did_it', 'm_look', 'm_made'])); window.did && did('lego'); } } catch (e) { } } });
  }
  function install() {
    if (typeof PROPS === 'undefined' || !PROPS.den || typeof drawProp !== 'function' || typeof propActions !== 'function') return false;
    if (!PROPS.den.some(p => p.id === P.id)) { const i = PROPS.den.findIndex(p => p.id === 'ledge'); PROPS.den.splice(i + 1, 0, P); }      // behind the furniture, like the picture ledge
    const _dp = drawProp;
    drawProp = function (p) { if (p !== P) return _dp(p); try { drawShelf(p); } catch (e) { if (!D.warned) { D.warned = 1; console.warn('legoshelf', e); } } };
    const _pa = propActions;
    propActions = function (p) {
      if (p !== P) return _pa(p);
      if (!read().length) return [A('🧱', () => toTable('lego'))];          // nothing on it yet: off to build something
      return [A('👀', () => approach(p.x, () => open(), 4)), A('🎵', () => approach(p.x, () => { UI.closeActions(); dance(); }, 4))];
    };
    try { Floors.hooks.push(() => { D.dance = null; D.tw = null; }); } catch (e) { }
    return true;
  }

  // ------------------------------------------------------------------ the builder's "keep" button: her model in one white shelf box, like the ones on the wall
  function icon(cv, o) {
    if (!cv) return; o = o || {}; const Z = 3, W = 48, H = 42, g = cv.getContext('2d'), b = B(), kind = o.kind === 'tiles' ? 'tiles' : 'lego'; cv.width = W * Z; cv.height = H * Z; g.setTransform(Z, 0, 0, Z, 0, 0);
    g.fillStyle = 'rgba(120,84,20,.32)'; g.fillRect(2, 5, W - 2, H - 5); g.fillStyle = WHITE; g.fillRect(0, 2, W - 2, H - 5); g.fillStyle = SHADE; g.fillRect(0, H - 5, W - 2, 2);
    g.fillStyle = BACKS[kind]; g.fillRect(3, 5, W - 8, H - 13); g.fillStyle = 'rgba(30,25,60,.18)'; g.fillRect(3, 5, W - 8, 2); g.fillStyle = BASE[kind]; g.fillRect(3, H - 10, W - 8, 2);
    if (o.pieces && b) { try { b.drawPieces(g, kind, o.pieces, 3 + (W - 8) / 2, H - 10, H - 18, { w: W - 12, alpha: o.hold ? 0.5 : 1 }); } catch (err) { } }
    g.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.hold ? '⬆️' : '⭐', W - 9, 9);
  }

  // ------------------------------------------------------------------ the big shelf (full screen)
  let Gy = null;
  function css() {
    if (document.getElementById('ls-css')) return; const s = document.createElement('style'); s.id = 'ls-css';
    s.textContent = `
.ls-top .ttl{display:flex;align-items:center;justify-content:center;min-width:0;min-height:60px}
.ls-body{position:relative;flex:1 1 auto;min-height:0;min-width:0;margin-top:6px}
.ls-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;border-radius:14px;background:#efe7d6;box-shadow:inset 0 0 0 3px #fff;touch-action:none}
#panel>.ls-top.ls-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:60px;flex-direction:column;gap:6px}
#panel>.ls-top.ls-land .ttl{flex:0 0 auto}
#panel>.ls-body.ls-land{margin:0 0 0 70px}
.ls-pend{display:block;animation:ls-wait .9s ease-in-out infinite alternate;filter:drop-shadow(0 3px 0 rgba(0,0,0,.3))}
@keyframes ls-wait{to{transform:translateY(-5px) rotate(5deg)}}
.ls-hero{position:absolute;inset:0;z-index:3;border-radius:14px;background:radial-gradient(circle at 50% 42%,rgba(104,84,160,.97),rgba(30,22,50,.97) 72%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;animation:ls-in .18s both}
.ls-hero.ls-land{flex-direction:row}
@keyframes ls-in{from{opacity:0;transform:scale(.92)}}
.ls-stage{flex:1 1 auto;min-width:0;min-height:0;align-self:stretch;display:flex;align-items:center;justify-content:center;perspective:700px}
.ls-bob{animation:ls-bob 2.8s ease-in-out infinite}
@keyframes ls-bob{0%,100%{transform:translateY(5px) rotateY(-28deg)}50%{transform:translateY(-9px) rotateY(28deg)}}
.ls-big{display:block;filter:drop-shadow(0 10px 0 rgba(0,0,0,.3))}
.ls-acts{flex:0 0 auto;display:flex;gap:14px;justify-content:center}
.ls-hero.ls-land .ls-acts{flex-direction:column}
.pbtn.ls-act{width:76px;min-width:76px;height:76px;font-size:38px;border-radius:22px;padding:0;touch-action:manipulation}
.pbtn.ls-act.ls-ask{background:#ffcf4a;animation:ls-ask .25s 4 alternate}
@keyframes ls-ask{to{transform:rotate(-9deg) scale(1.08)}}
.pbtn.ls-act.ls-hint{background:#ffe9a8;animation:ls-hint .6s ease-in-out infinite alternate}
@keyframes ls-hint{to{transform:translateY(-6px) scale(1.06)}}
#app:has(.ls-body) #wishBtn,#app:has(.ls-body) #reqBtn{display:none}
`;
    document.head.append(s);
  }
  const dprNow = () => Math.min(3, window.devicePixelRatio || 1);
  function geo() {
    const W = Gy.body.clientWidth, H = Gy.body.clientHeight, cols = W > H ? 4 : 2, rows = MAX / cols, m = 12, bd = lim(Math.round(Math.min(W, H) / 34), 8, 12);
    let cw = (W - m * 2 - bd * (cols + 1)) / cols, ch = (H - m * 2 - bd * (rows + 1)) / rows; cw = Math.floor(Math.max(40, Math.min(cw, ch * 1.4))); ch = Math.floor(Math.max(40, Math.min(ch, cw * 1.2)));
    const uw = cw * cols + bd * (cols + 1), uh = ch * rows + bd * (rows + 1), x0 = Math.round((W - uw) / 2), y0 = Math.round((H - uh) / 2);
    return { W, H, cols, rows, bd, cw, ch, uw, uh, x0, y0, slot: i => ({ x: x0 + bd + (i % cols) * (cw + bd), y: y0 + bd + ((i / cols) | 0) * (ch + bd), w: cw, h: ch }) };
  }
  function layout() {
    if (!Gy) return; const land = innerWidth > innerHeight; Gy.top.classList.toggle('ls-land', land); Gy.body.classList.toggle('ls-land', land);
    const dpr = Gy.dpr = dprNow(), q = Gy.geo = geo(); Gy.cv.width = Math.max(1, Math.round(q.W * dpr)); Gy.cv.height = Math.max(1, Math.round(q.H * dpr));
    if (Gy.hero) { const s = Gy.sel; closeHero(); if (at(s)) pickUp(s, true); }
  }
  const tapBtn = (cls, txt, label, fn) => { const b = mk('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('pointerup', e => { e.stopPropagation(); if (Gy) fn(b); }); return b; };
  function open(o) {
    o = o || {}; const panel = document.getElementById('panel'), b = B(); if (!panel || !b || !b.drawPieces) return false;
    if (Gy) shut();
    let back = null; try { if (b.active && b.stash) back = b.stash(); } catch (e) { }      // opened from the builder: it waits underneath
    try { UI.closeActions(); } catch (e) { }
    try { clearWish(); } catch (e) { }
    css(); read(true); panel.innerHTML = ''; panel.classList.remove('hidden');
    const top = mk('div', 'ptop ls-top'), ttl = mk('div', 'ttl'), body = mk('div', 'ls-body'), cv = mk('canvas', 'ls-cv');
    Gy = { o, back, panel, top, ttl, body, cv, g: cv.getContext('2d'), mode: 'shelf', sel: -1, pending: null, hero: null, anim: {}, parts: [], wob: 0, down: null };
    top.append(tapBtn('pbtn', '❌', 'close', () => { if (Gy.mode === 'hero') putBack(); else if (Gy.mode === 'move') endMove(); else close(); }), ttl);
    body.append(cv); panel.append(top, body);
    if (o.pending && b.pieces && b.pieces(o.pending).length) setPending(o.pending);
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (Gy && e.isPrimary !== false) Gy.down = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', e => { const d = Gy && Gy.down; if (!d) return; Gy.down = null; if (Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 16) tapAt(e.clientX, e.clientY); });
    cv.addEventListener('pointercancel', () => { if (Gy) Gy.down = null; });
    layout();
    Gy.onResize = () => { layout(); clearTimeout(Gy.rzT); const st = Gy; Gy.rzT = setTimeout(() => { if (Gy === st) layout(); }, 320); };
    addEventListener('resize', Gy.onResize); addEventListener('orientationchange', Gy.onResize);
    Gy.raf = requestAnimationFrame(frame);
    if (o.full) { Gy.wob = performance.now(); setTimeout(() => blip(-2, 'triangle', 0.16, 0.13), 60); setTimeout(() => blip(-7, 'triangle', 0.22, 0.13), 260); }
    else { jingle([0, 7, 12], 0.06); if (items.length) fire('look'); }
    return true;
  }
  function setPending(kind) {
    const b = B(), dpr = dprNow(); Gy.pending = kind; Gy.ttl.innerHTML = '';
    if (!kind) return; const c = b.picture(kind, b.pieces(kind), 50 * dpr, 50 * dpr); c.className = 'ls-pend'; c.style.width = Math.round(c.width / dpr) + 'px'; c.style.height = Math.round(c.height / dpr) + 'px'; Gy.ttl.append(c);
  }
  function shut() {                                   // stop drawing and listening (the panel is dealt with by the caller)
    if (!Gy) return null; const st = Gy; cancelAnimationFrame(st.raf); clearTimeout(st.rzT); clearTimeout(st.pendT); removeEventListener('resize', st.onResize); removeEventListener('orientationchange', st.onResize); Gy = null; return st;
  }
  function close(o) {
    const st = shut(); if (!st) return; const b = B(), table = o && o.table;
    if (st.back) { let same = false; try { same = !table || b.state().kind === table; } catch (e) { } if (same && st.back.resume()) { if (typeof st.o.onClose === 'function') st.o.onClose(); return; } st.back.drop(); }
    st.panel.classList.add('hidden'); st.panel.innerHTML = '';
    try { if (typeof setMusic === 'function') setMusic(); } catch (e) { }
    if (typeof st.o.onClose === 'function') st.o.onClose();
    if (table) toTable(table);
  }
  function frame(now) {
    if (!Gy) return;
    if (!Gy.cv.isConnected || Gy.panel.classList.contains('hidden')) { const st = shut(); if (st.back) st.back.drop(); try { if (typeof setMusic === 'function') setMusic(); } catch (e) { } if (typeof st.o.onClose === 'function') st.o.onClose(); return; }      // something else took the panel
    draw(now); Gy.raf = requestAnimationFrame(frame);
  }
  function draw(now) {
    const g = Gy.g, q = Gy.geo, dpr = Gy.dpr, b = B(), all = read(), A_ = Gy.anim;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, q.W, q.H);
    const wk = Gy.wob ? (now - Gy.wob) / 1400 : 1, wa = wk < 1 ? 1 - wk : 0; if (wk >= 1) Gy.wob = 0;
    g.save(); g.translate(Math.round(wa ? Math.sin(wk * Math.PI * 8) * 5 * wa : 0), 0);
    // the wall's boards below, the white unit, its cubbies
    g.fillStyle = 'rgba(60,45,25,.07)'; for (let y = q.y0 + q.uh + 14; y < q.H; y += 16) g.fillRect(0, y, q.W, 2);
    g.fillStyle = 'rgba(70,50,30,.22)'; g.fillRect(q.x0 + 5, q.y0 + 7, q.uw, q.uh);
    g.fillStyle = WHITE; g.fillRect(q.x0, q.y0, q.uw, q.uh); g.fillStyle = '#ffffff'; g.fillRect(q.x0, q.y0, q.uw, 2); g.fillStyle = SHADE; g.fillRect(q.x0, q.y0 + q.uh - 3, q.uw, 3); g.fillRect(q.x0 + q.uw - 2, q.y0 + 2, 2, q.uh - 2);
    for (let i = 0; i < MAX; i++) { const c = q.slot(i), e = all.find(x => x.s === i), kind = e && !(Gy.mode === 'hero' && Gy.sel === i) ? e.kind : 'none', bh = Math.max(3, Math.round(c.h / 22));
      g.fillStyle = BACKS[kind]; g.fillRect(c.x, c.y, c.w, c.h); g.fillStyle = 'rgba(30,25,60,.16)'; g.fillRect(c.x, c.y, c.w, 6); g.fillStyle = 'rgba(30,25,60,.09)'; g.fillRect(c.x, c.y + 6, 4, c.h - 6);
      if (kind !== 'none') { g.fillStyle = BASE[kind]; g.fillRect(c.x, c.y + c.h - bh, c.w, bh); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(c.x, c.y + c.h - bh, c.w, 1); }
      g.fillStyle = SHADE; g.fillRect(c.x, c.y + c.h, c.w, 2);
      if (Gy.mode === 'move' && i !== Gy.sel) { const a = 0.7 + 0.3 * Math.sin(now / 170); g.strokeStyle = `rgba(255,176,20,${a.toFixed(3)})`; g.lineWidth = 6; g.setLineDash([12, 9]); g.lineDashOffset = -now / 40; g.strokeRect(c.x + 7, c.y + 7, c.w - 14, c.h - 14); g.setLineDash([]); }
      if (Gy.mode === 'move' && i === Gy.sel) { g.strokeStyle = '#ffcf4a'; g.lineWidth = 5; g.strokeRect(c.x + 2.5, c.y + 2.5, c.w - 5, c.h - 5); } }
    // the creations
    for (const e of all) {
      const i = e.s; if (Gy.mode === 'hero' && Gy.sel === i) continue; const c = q.slot(i), bh = Math.max(3, Math.round(c.h / 22)), a = A_[i]; let x = c.x + c.w / 2, y = c.y + c.h - bh, k;
      if (wa) x += Math.sin(wk * Math.PI * 9 + i * 1.3) * 7 * wa;
      if (a && (k = (now - a.t0) / a.dur) >= 1) { if (a.done) a.done(); delete A_[i]; }
      else if (a && k >= 0) {
        if (a.type === 'slide') { const f = q.slot(a.from), u = k * k * (3 - 2 * k); x = f.x + f.w / 2 + (x - (f.x + f.w / 2)) * u; y = f.y + f.h - bh + (y - (f.y + f.h - bh)) * u - Math.sin(k * Math.PI) * 34; }
        else if (a.type === 'in') { const u = 1 - Math.pow(1 - k, 3); y = -20 + (y + 20) * u - Math.abs(Math.sin(k * Math.PI * 2)) * 10 * (1 - k); }
        else if (a.type === 'hop') y -= Math.abs(Math.sin(k * Math.PI * (a.n || 1))) * 14 * (1 - k * 0.5);
      } else if (a && k < 0 && a.type === 'in') continue;
      if (Gy.mode === 'move' && Gy.sel === i) { y -= 12 + Math.sin(now / 160) * 5; x += Math.sin(now / 110) * 2; }
      try { b.drawPieces(g, e.kind, e.pieces, x, y, c.h * 0.8, { w: c.w * 0.86 }); } catch (err) { }
    }
    // bits flying about
    for (let i = Gy.parts.length - 1; i >= 0; i--) { const p = Gy.parts[i], t = (now - p.t0) / 1000; if (t < 0) continue; if (t > p.life) { Gy.parts.splice(i, 1); continue; }
      g.globalAlpha = 1 - t / p.life; g.fillStyle = p.c;
      if (p.spark) { const r = Math.sin(t / p.life * Math.PI) * 9; g.fillRect(p.x - r, p.y - 1.5, r * 2, 3); g.fillRect(p.x - 1.5, p.y - r, 3, r * 2); }
      else g.fillRect(p.x + p.vx * t, p.y + p.vy * t + 260 * t * t, 7, 7); }
    g.globalAlpha = 1; g.restore();
  }
  const COLS8 = ['#e5352d', '#ff8a1c', '#ffd32a', '#35b84b', '#2b8cea', '#8b55e8', '#ff6fb7', '#ffffff'];
  function sparks(i, n, late) { const c = Gy.geo.slot(i), now = performance.now() + (late || 0); for (let k = 0; k < n; k++) Gy.parts.push({ spark: 1, x: c.x + 12 + Math.random() * (c.w - 24), y: c.y + 12 + Math.random() * (c.h - 24), c: k & 1 ? '#fff3a0' : '#ffffff', t0: now + Math.random() * 500, life: 0.5 }); }
  function poof(i) { const c = Gy.geo.slot(i), now = performance.now(); for (let k = 0; k < 22; k++) Gy.parts.push({ x: c.x + c.w / 2, y: c.y + c.h * 0.6, vx: (Math.random() - 0.5) * 320, vy: -60 - Math.random() * 220, c: COLS8[k % 8], t0: now, life: 0.7 }); }
  function tapAt(cx, cy) {
    if (Gy.mode === 'hero') return; const r = Gy.cv.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, q = Gy.geo, h = q.bd / 2; let hit = -1;
    for (let i = 0; i < MAX; i++) { const c = q.slot(i); if (x >= c.x - h && x < c.x + c.w + h && y >= c.y - h && y < c.y + c.h + h) hit = i; }
    if (Gy.mode === 'move') { if (hit < 0 || hit === Gy.sel) return endMove(); return dropAt(hit); }
    if (hit < 0) return;
    if (at(hit)) pickUp(hit); else { blip(NOTES[hit] + 12, 'sine', 0.1, 0.07); sparks(hit, 3); }
  }
  // anything that takes her work away needs two taps: the first only asks (❓ for 2 s), like the bin in the builder
  function sure(b, ico, ask, go) {
    const calm = () => { clearTimeout(b._t); delete b.dataset.sure; b.textContent = ico; b.classList.remove('ls-ask'); };
    if (b.dataset.sure || !ask) { calm(); go(); return; }
    b.dataset.sure = 1; b.textContent = '❓'; b.classList.remove('ls-hint'); b.classList.add('ls-ask'); blip(2, 'triangle', 0.08, 0.12); b._t = setTimeout(calm, 2000);
  }
  // picked up: shown huge, turning gently, with what she can do with it
  function pickUp(i, again) {
    const e = at(i), b = B(); if (!e) return; Gy.sel = i; Gy.mode = 'hero';
    const land = Gy.body.clientWidth > Gy.body.clientHeight, h = Gy.hero = mk('div', 'ls-hero' + (land ? ' ls-land' : '')), stage = mk('div', 'ls-stage'), bob = mk('div', 'ls-bob'), acts = mk('div', 'ls-acts'), ico = e.kind === 'tiles' ? '🔷' : '🧱';
    const bin = tapBtn('pbtn ls-act' + (Gy.pending ? ' ls-hint' : ''), '🗑️', 'take it off the shelf', binTap);
    acts.append(tapBtn('pbtn ls-act', ico, 'take it down to the table', x => takeTap(x, ico)), tapBtn('pbtn ls-act', '↔️', 'move it', startMove), bin);
    stage.append(bob); h.append(stage, acts); Gy.body.append(h);
    const dpr = Gy.dpr, sw = Math.max(60, stage.clientWidth - 36), sh = Math.max(60, stage.clientHeight - 44);
    const c = b.picture(e.kind, e.pieces, Math.min(sw, 560) * dpr, Math.min(sh, 560) * dpr, (e.kind === 'tiles' ? 64 : 40) * dpr); c.className = 'ls-big'; c.style.width = (c.width / dpr).toFixed(1) + 'px'; c.style.height = (c.height / dpr).toFixed(1) + 'px'; bob.append(c);
    h.addEventListener('pointerup', ev => { if (ev.target === h || ev.target === stage || ev.target === acts) putBack(); });
    c.addEventListener('pointerup', ev => { ev.stopPropagation(); cheerBig(c, e); });
    if (!again) { whoosh(true); blip(NOTES[i], e.kind === 'lego' ? 'triangle' : 'sine', 0.14, 0.16); setTimeout(() => blip(NOTES[i] + 7, e.kind === 'lego' ? 'triangle' : 'sine', 0.16, 0.12), 110); }
  }
  function cheerBig(c, e) { try { c.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-26px) scale(1.08,.94)' }, { transform: 'translateY(0) scale(.96,1.05)' }, { transform: 'translateY(0) scale(1)' }], { duration: 420, easing: 'ease-out' }); } catch (err) { }
    const n = NOTES[e.s], ty = e.kind === 'lego' ? 'triangle' : 'sine'; blip(n, ty, 0.1, 0.15); setTimeout(() => blip(n + 4, ty, 0.1, 0.13), 80); setTimeout(() => blip(n + 7, ty, 0.16, 0.13), 160); }
  function closeHero() { if (Gy && Gy.hero) { Gy.hero.remove(); Gy.hero = null; } }
  function putBack() { if (!Gy || Gy.mode !== 'hero') return; const i = Gy.sel; closeHero(); Gy.mode = 'shelf'; Gy.sel = -1; if (at(i)) Gy.anim[i] = { type: 'hop', t0: performance.now(), dur: 320 }; blip(-3, 'triangle', 0.08, 0.1); }
  function binTap(b) {
    sure(b, '🗑️', true, () => { const i = Gy.sel; closeHero(); Gy.mode = 'shelf'; Gy.sel = -1; if (!dropSlot(i)) return; poof(i); pop(); whoosh(false); fire('remove');
      if (Gy.pending) { const st = Gy; st.pendT = setTimeout(() => { if (Gy === st) landPending(); }, 650); } });      // there is room now: the one that was waiting goes up
  }
  function landPending() {
    const kind = Gy.pending; if (!kind) return; const r = keep(kind); setPending(null); if (r !== true) return;
    const i = newest, now = performance.now(); Gy.anim[i] = { type: 'in', t0: now, dur: 650, done: () => { if (Gy) Gy.anim[i] = { type: 'hop', t0: performance.now(), dur: 500, n: 2 }; } };
    whoosh(true); sparks(i, 10, 520); setTimeout(() => { jingle([7, 12, 16, 19, 24], 0.07); pop(); }, 560);
  }
  function takeTap(btn, ico) {
    const e = at(Gy.sel), b = B(); if (!e || !b || !b.load) return; let plate = []; try { plate = b.pieces(e.kind); } catch (err) { }
    sure(btn, ico, plate.length > 0 && !has(e.kind, plate), () => {      // the plate holds something that is not on the shelf: ask before it is swept away
      const i = Gy.sel; closeHero(); Gy.mode = 'shelf'; Gy.sel = -1; if (!dropSlot(i)) return; home = { kind: e.kind, s: i };
      b.load(e.kind, e.pieces, e.bp); whoosh(false); jingle([12, 7, 4], 0.06); fire('takedown'); close({ table: e.kind });
    });
  }
  function startMove() { if (!Gy || Gy.mode !== 'hero') return; closeHero(); Gy.mode = 'move'; blip(7, 'square', 0.06, 0.1); setTimeout(() => blip(12, 'square', 0.06, 0.09), 70); }
  function endMove() { if (!Gy) return; const i = Gy.sel; Gy.mode = 'shelf'; Gy.sel = -1; if (at(i)) Gy.anim[i] = { type: 'hop', t0: performance.now(), dur: 320 }; blip(-3, 'triangle', 0.08, 0.1); }
  function dropAt(j) {
    const i = Gy.sel, other = !!at(j), now = performance.now(); Gy.mode = 'shelf'; Gy.sel = -1; if (!swap(i, j)) return;
    Gy.anim[j] = { type: 'slide', from: i, t0: now, dur: 420, done: () => { if (Gy) { Gy.anim[j] = { type: 'hop', t0: performance.now(), dur: 300 }; sparks(j, 5); } } }; delete Gy.anim[i];
    if (other) Gy.anim[i] = { type: 'slide', from: j, t0: now, dur: 420 };
    whoosh(true); setTimeout(() => { blip(NOTES[j], 'triangle', 0.1, 0.16); pop(); }, 400);
  }
  function state() {                                  // a peek for tests
    const base = { count: read().length, full: read().length >= MAX, den: { x: P.x, y: P.y, w: P.w, h: P.h, twinkle: D.tw ? D.tw.s : -1, dancing: !!D.dance, glow: D.glow } }; if (!Gy) return Object.assign(base, { open: false });
    const r = Gy.cv.getBoundingClientRect(), q = Gy.geo;
    return Object.assign(base, { open: true, mode: Gy.mode, sel: Gy.sel, pending: Gy.pending, cols: q.cols, slots: Array.from({ length: MAX }, (_, i) => { const c = q.slot(i), e = at(i); return { slot: i, kind: e ? e.kind : null, x: r.left + c.x, y: r.top + c.y, w: c.w, h: c.h }; }) });
  }

  const api = window.LegoShelf = { list, keep, remove, move, has, open, close: () => close(), icon, dance, state, onEvent: null, MAX, get count() { return read().length; }, get active() { return !!Gy; } };
  install();
})();
