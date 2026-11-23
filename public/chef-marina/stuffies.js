// Chef Marina — Stuffies: Marina arranges her stuffed animals on her white bunk bed.
// Self-contained; load after everything else.
//   Stuffies.open({ onDone(result), onClose(result) })   full-screen activity inside #panel; result = { count, asleep, done }
//   Stuffies.close()        same as the ❌: keeps the arrangement, does not call onDone
//   Stuffies.saved()        what the room can draw small on the bunk-bed sprite, back to front:
//                           [{ ch, level: 'rail'|'top'|'bottom'|'ladder'|'floor', u: 0..1, stack: 0,1,2…, asleep, flip, rung? }]
//                           u = how far along the bed, left end 0 to right end 1 (for 'ladder': how far DOWN the ladder, top rung 0 to bottom rung 1)
//   Stuffies.count()        how many stuffies are out of the basket
//   Stuffies.surprise(name) one of the 🎲 patterns by name ('pyramid' | 'row' | 'ladder' | 'rainbow' | 'circle'), or a random one
// One canvas holds the bedroom, the stuffies and the toy basket, so dragging is plain canvas touching (calm.js cancels
// taps on buttons when the finger moves). The room is small pixel art scaled up; the stuffies are emoji drawn sharp on top.
// Everything else is big picture buttons, because she cannot read.
(function () {
  'use strict';
  const KEY = 'cm_stuffies', FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const p = hex(a), q = hex(b); return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',') + ')'; };
  const hash = (x, y) => { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const NIGHT = '#5868b4', nt = c => { const p = hex(c), q = hex(NIGHT); return 'rgb(' + p.map((v, i) => Math.round(v * q[i] / 255)).join(',') + ')'; };   // moonlight: everything multiplied by a dim blue
  const easeOut = k => 1 - (1 - k) * (1 - k), easeIO = k => k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);

  // ------------------------------------------------------------------ the stuffies: emoji, place in the rainbow, size
  const TOYS = [['🧸', 20, 1.06], ['🐰', 27, 1], ['🦄', 16, 1.06], ['🐶', 23, 1], ['🐱', 6.5, 1], ['🦊', 2, 1], ['🐼', 28, 1], ['🐸', 8, 0.94],
    ['🦖', 10, 1.1], ['🐙', 1, 1], ['🦈', 14, 1.08], ['🐧', 29, 0.98], ['🦁', 4, 1.04], ['🐷', 18, 1], ['🐘', 26, 1.12], ['🦉', 22, 0.98],
    ['🐢', 9, 0.98], ['🦋', 13, 0.9], ['🐳', 12, 1.1], ['🦞', 0, 1], ['🐨', 25, 1], ['🐵', 21, 1], ['🦒', 5, 1.12], ['🐥', 6, 0.88]];
  const BLANKETS = [['#ff9ec4', '#ffd3e6'], ['#9be0c4', '#d6f5e8'], ['#a9c8ff', '#dbe8ff'], ['#ffd27a', '#fff0c9'], ['#c9b0f5', '#e8dcff'], ['#ffb199', '#ffe0d6']];
  const CHAT = [['👋', '👋'], ['❤️', '💕'], ['🎵', '🎶'], ['🍪', '😋'], ['⭐', '✨'], ['🌈', '😍'], ['😂', '🤣'], ['❓', '💡'], ['🎈', '🎉'], ['🌸', '🦋'], ['🍓', '😋'], ['🤗', '🥰']];
  const CONFETTI = ['#ff5d7a', '#ffb627', '#ffe14d', '#4fd08a', '#4aa8ff', '#b06cff', '#ff7ad9', '#ffffff'];

  // ------------------------------------------------------------------ the bed, in world pixels: x 0..150 along the bed, y = 0 the floor at the front of the bed, up is negative
  const NOM = 21, SINK = 0.3, BED_W = 150;                       // a stuffy is about 21 pixels; one sitting on another sinks in by a third
  const CORE = { x0: -5, y0: -142, w: 174, h: 170 };            // what must always be in view
  const LAD = { xb: 118, yb: 6, yt: -95, lean: 6, rungs: [-16, -38, -60] };
  const ladX = y => LAD.xb - Math.round((LAD.yb - y) * LAD.lean / (LAD.yb - LAD.yt));
  const SIDS = ['rail', 'top', 'pillow', 'bottom', 'r0', 'r1', 'r2', 'floor'];
  // every flat place a stuffy can sit. x0..x1 = where its body may be, c0..c1 = which finger positions it catches, `catch` = how far below the line still counts
  const SDEF = {
    rail: { lv: 'rail', x0: 3, x1: 147, c0: -5, c1: 155, y: -113, max: 2, catch: 5, layer: 0 },
    pillow: { lv: 'bottom', x0: 6, x1: 33, c0: -5, c1: 32, y: -33, max: 2, catch: 4, layer: 1, roof: -88 },
    bottom: { lv: 'bottom', x0: 31, x1: 146, c0: 32, c1: 155, y: -26, max: 3, catch: 6, layer: 1, roof: -88 },
    top: { lv: 'top', x0: 5, x1: 145, c0: -5, c1: 155, y: -95, max: 3, catch: 14, layer: 2 },
    floor: { lv: 'floor', band: true, max: 3, layer: 4 }
  };
  LAD.rungs.forEach((y, i) => { const x = ladX(y); SDEF['r' + i] = { lv: 'ladder', rung: i, x0: x + 3, x1: x + 24, c0: x - 1, c1: x + 28, y, max: 1, catch: 5, layer: 3 }; });
  for (const id of SIDS) SDEF[id].id = id;
  const SLOPE_L = y => -141 - y, SLOPE_R = y => 305 + y;        // the attic ceiling comes down on both sides

  // ------------------------------------------------------------------ sound (only the game's own, and never an error if it is missing)
  const au = () => (typeof Audio2 !== 'undefined' ? Audio2 : null);
  const blip = (n, type, len, vol) => { try { au().blip(n, type, len, vol); } catch (e) { } };
  const jingle = (notes, step, type) => { try { au().jingle(notes, step, type); } catch (e) { } };
  const melody = name => { try { au().melody(name); } catch (e) { } };
  const whoosh = up => { try { au().whoosh(up); } catch (e) { } };
  const chip = (k, vol) => { try { au().sfx('chip_' + k, { vol: vol || 0.6 }); } catch (e) { } };
  const voice = k => { try { const a = au(); if (a && a.voice) a.voice(k, 'marina'); else if (typeof say === 'function') say(k); } catch (e) { } };
  const music = m => { try { if (m) au().Music.set(m); else if (typeof setMusic === 'function') setMusic(); } catch (e) { } };
  const sndAt = {};
  const once = (kind, gap, fn) => { const t = performance.now(); if (t - (sndAt[kind] || 0) < gap) return; sndAt[kind] = t; fn(); };
  const squeak = (it, soft) => once('sq' + it.id, 90, () => { blip(it.pitch + 12, 'square', 0.05, soft ? 0.05 : 0.1); setTimeout(() => blip(it.pitch + 19, 'square', 0.07, soft ? 0.04 : 0.09), 55); });
  const thump = it => once('th', 45, () => blip(it.pitch - 12, 'triangle', 0.1, 0.16));
  const pop = () => once('pop', 60, () => chip('pop', 0.5));

  // ------------------------------------------------------------------ saving
  let S = null, cache = null;
  function read() {
    if (cache) return cache; let r = null;
    try { r = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (!r || r.v !== 1 || !Array.isArray(r.s)) r = { v: 1, n: 0, s: [] };
    const seen = {}; r.s = r.s.filter(a => Array.isArray(a) && TOYS.some(t => t[0] === a[0]) && SDEF[SIDS[a[1]]] && !seen[a[0]] && (seen[a[0]] = 1));
    return cache = r;
  }
  function persist() {
    if (!S) return;
    cache = { v: 1, n: S.night ? 1 : 0, s: order().map(it => [it.ch, SIDS.indexOf(it.sid), r1(it.x), r1(it.d), it.flip ? 1 : 0, it.lvl]) };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { }
  }
  function saved() {
    const r = read();
    return r.s.map(a => { const F = SDEF[SIDS[a[1]]], lad = F.lv === 'ladder', o = { ch: a[0], level: F.lv, u: lad ? 1 - F.rung / (LAD.rungs.length - 1) : Math.round(clamp(a[2] / BED_W, 0, 1) * 1000) / 1000, stack: a[5] | 0, asleep: !!r.n, flip: !!a[4] }; if (lad) o.rung = F.rung; return o; });
  }
  const count = () => S ? S.items.filter(it => it.where !== 'tray').length : read().s.length;

  // ------------------------------------------------------------------ look
  function css() {
    if (document.getElementById('stf-css')) return; const s = document.createElement('style'); s.id = 'stf-css';
    s.textContent = `
.stf-sp{flex:0 0 60px}
.stf-body{flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;gap:8px;padding:5px 3px 3px}
.stf-stage{position:relative;flex:1 1 auto;min-height:0;min-width:0;border-radius:14px;overflow:hidden;background:#2b2340;box-shadow:0 0 0 3px #fff,0 4px 0 3px rgba(0,0,0,.3)}
.stf-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;-webkit-touch-callout:none;outline:none}
.stf-bar{flex:0 0 auto;display:flex;gap:8px;justify-content:space-between;padding-top:3px}
.pbtn.stf-btn{flex:1 1 0;min-width:60px;max-width:92px;height:66px;margin:0;padding:0;font-size:36px;line-height:1;border-radius:20px;display:flex;align-items:center;justify-content:center;transition:transform .08s,background .12s;touch-action:manipulation}
.pbtn.stf-btn.stf-dn,.pbtn.stf-btn:active{transform:translateY(4px) scale(.93);background:#ffe9a6;box-shadow:0 0 0 rgba(0,0,0,.3)}
.pbtn.stf-btn.on{background:#ffcf4a;box-shadow:0 4px 0 rgba(0,0,0,.3),0 0 0 3px #fff inset}
.pbtn.stf-go{background:#7bd36b}
.pbtn.stf-go.stf-dn,.pbtn.stf-go:active{background:#a9ea9c}
.pbtn.stf-ask{background:#ffcf4a;animation:stf-ask .25s 8 alternate}
@keyframes stf-ask{to{transform:rotate(-9deg) scale(1.08)}}
.pbtn.stf-roll{animation:stf-roll .45s linear infinite}
@keyframes stf-roll{50%{transform:rotate(16deg) scale(1.1)}}
.pbtn.stf-bop{animation:stf-bop .3s infinite alternate}
@keyframes stf-bop{to{transform:translateY(-5px) scale(1.06)}}
#panel>.stf-top.stf-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:64px;flex-direction:column;gap:4px;min-height:0}
#panel>.stf-top.stf-land .ttl{flex:0 0 auto;font-size:28px}
#panel>.stf-top.stf-land .stf-sp{display:none}
#panel>.stf-body.stf-land{flex-direction:row;margin:0 0 0 72px;padding:3px}
.stf-land>.stf-bar{flex-direction:column;padding:0 0 0 3px}
.stf-land>.stf-bar .pbtn.stf-btn{flex:1 1 0;width:70px;min-height:60px;max-height:84px;height:auto;max-width:none}
`;
    document.head.append(s);
  }
  function tap(cls, txt, label, fn) {
    const b = mk('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label);
    const up = () => b.classList.remove('stf-dn');
    b.addEventListener('pointerdown', e => { e.stopPropagation(); b.classList.add('stf-dn'); });
    b.addEventListener('pointerup', e => { e.stopPropagation(); up(); if (S) fn(b); });
    b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    return b;
  }

  // ------------------------------------------------------------------ open / close
  function open(opts) {
    opts = opts || {}; const panel = document.getElementById('panel'); if (!panel) return false;
    if (S) teardown();
    try { UI.closeActions(); } catch (e) { }
    css(); panel.innerHTML = ''; panel.classList.remove('hidden');
    const rec = read();
    const st = S = { opts, panel, items: [], ptr: {}, parts: [], bubbles: [], spr: {}, night: !!rec.n, nk: rec.n ? 1 : 0, party: 0, t: 0, chatAt: 4, flash: 0, nlPulse: 0, hintT: 0, busyTill: 0 };
    // top row: ❌ first (the sideways ❌ and the rest of the game look for it there), then the picture title
    const top = st.top = mk('div', 'ptop stf-top'), body = st.body = mk('div', 'stf-body'), stage = st.stage = mk('div', 'stf-stage'), cv = st.cv = mk('canvas', 'stf-cv'), bar = st.bar = mk('div', 'stf-bar');
    top.append(tap('pbtn', '❌', 'close', () => finish(false)), mk('div', 'ttl', '🧸'), mk('div', 'stf-sp'));
    st.sleepB = tap('pbtn stf-btn', '😴', 'bedtime', () => setNight(!S.night));
    st.partyB = tap('pbtn stf-btn', '🎉', 'party', party);
    st.diceB = tap('pbtn stf-btn', '🎲', 'surprise', () => surprise());
    st.awayB = tap('pbtn stf-btn', '🧺', 'put all away', awayTap);
    st.doneB = tap('pbtn stf-btn stf-go', '✅', 'done', () => finish(true));
    bar.append(st.sleepB, st.partyB, st.diceB, st.awayB, st.doneB); stage.append(cv); body.append(stage, bar); panel.append(top, body);
    st.g = cv.getContext('2d');
    TOYS.forEach((t, i) => st.items.push({ id: i, ch: t[0], hue: t[1], sc: t[2], where: 'tray', sid: null, x: 0, d: 0, y: 0, lvl: 0, flip: false, w: NOM, h: NOM,
      py: 0, vy: 0, ox: 0, sq: 0, wig: 0, wt: 0, sl: 0, slAt: 0, str: 0, strAt: 0, hopAt: 0, big: 0, press: 0, turn: 0, fly: null, hx: 0, hy: 0, sway: 0, zAt: rnd(0.5, 2.5),
      pitch: [0, 2, 4, 7, 9][i % 5] + (i % 3) * 5 - Math.round((t[2] - 1) * 20) }));
    layout(); restore(rec); sync(); bind();
    st.onResize = () => { layout(); clearTimeout(st.rz); st.rz = setTimeout(() => { if (S === st) layout(); }, 320); };
    addEventListener('resize', st.onResize); addEventListener('orientationchange', st.onResize);
    st.onHide = () => { if (S === st && document.visibilityState !== 'visible') persist(); };
    document.addEventListener('visibilitychange', st.onHide); addEventListener('pagehide', st.onHide);
    st.raf = requestAnimationFrame(frame);
    jingle([0, 7, 12], 0.06); if (st.night) music('night');
    return true;
  }
  function teardown() {
    const st = S; if (!st) return; S = null;
    cancelAnimationFrame(st.raf); clearTimeout(st.rz); clearTimeout(st.awayT); for (const id in st.ptr) clearTimeout(st.ptr[id].timer);
    removeEventListener('resize', st.onResize); removeEventListener('orientationchange', st.onResize);
    document.removeEventListener('visibilitychange', st.onHide); removeEventListener('pagehide', st.onHide);
  }
  // ❌ keeps everything exactly as she left it; ✅ does the same and tells the room she is done
  function finish(done) {
    const st = S; if (!st) return; persist(); const res = { count: count(), asleep: !!st.night, done: !!done };
    teardown(); st.panel.classList.add('hidden'); music(null);
    if (done) { jingle([0, 4, 7, 12], 0.07); try { if (st.opts.onDone) st.opts.onDone(res); } catch (e) { try { console.error(e); } catch (e2) { } } }
    try { if (st.opts.onClose) st.opts.onClose(res); } catch (e) { }
  }
  function sync() {
    const st = S; if (!st) return;
    st.sleepB.textContent = st.night ? '☀️' : '😴'; st.sleepB.setAttribute('aria-label', st.night ? 'morning' : 'bedtime'); st.sleepB.classList.toggle('on', st.night);
    st.partyB.classList.toggle('on', st.party > st.t); st.partyB.classList.toggle('stf-bop', st.party > st.t);
    st.diceB.classList.toggle('stf-roll', st.busyTill > st.t);
  }

  // ------------------------------------------------------------------ layout: the bed as big as it can be, the basket along the bottom (upright) or down the side (sideways)
  function layout() {
    const st = S; if (!st) return;
    const land = st.panel.clientWidth > st.panel.clientHeight;
    st.top.classList.toggle('stf-land', land); st.body.classList.toggle('stf-land', land);
    const r = st.stage.getBoundingClientRect(), cw = Math.max(160, r.width), ch = Math.max(160, r.height), dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    if (cw === st.cw && ch === st.ch && dpr === st.dpr && land === st.land) return;
    st.cw = cw; st.ch = ch; st.dpr = dpr; st.land = land; st.cv.width = Math.round(cw * dpr); st.cv.height = Math.round(ch * dpr);
    const n = TOYS.length, slot = clamp((land ? ch : cw) / 6.8, 44, 66); let best = null;
    for (const lines of [3, 2]) { const thick = Math.round(lines * slot + 14), sw = land ? cw - thick : cw, sh = land ? ch : ch - thick, s = Math.min(sw / CORE.w, sh / CORE.h); if (!best || s > best.s * 1.04) best = { lines, thick, sw, sh, s }; }
    const T = st.tray = { vert: land, lines: best.lines, slot, pad: 7, x: land ? cw - best.thick : 0, y: land ? 0 : ch - best.thick, w: land ? best.thick : cw, h: land ? ch : best.thick, scroll: st.tray ? st.tray.scroll : 0, v: 0, peek: st.tray ? st.tray.peek : 0 };
    T.len = land ? ch : cw; T.max = Math.max(0, Math.ceil(n / T.lines) * slot + 2 * T.pad - T.len); T.scroll = clamp(T.scroll, 0, T.max); T.size = slot * 0.76; T.k = T.size / (NOM * 1.12);
    const s = st.s = best.s, sc = st.scene = { x: 0, y: 0, w: best.sw, h: best.sh }, vw = sc.w / s, vh = sc.h / s;
    const V = st.view = { x0: Math.round(CORE.x0 - (vw - CORE.w) / 2), y0: Math.round(CORE.y0 - (vh - CORE.h) * 0.7), w: vw, h: vh }; V.x1 = V.x0 + vw; V.y1 = V.y0 + vh;
    st.F = Object.assign({}, SDEF.floor, { x0: V.x0 + 2, x1: V.x1 - 2, y0: 8, y1: Math.max(11, V.y1 - 3) });
    st.surf = SIDS.map(id => id === 'floor' ? st.F : SDEF[id]);
    const spx = clamp(Math.round(NOM * 1.12 * s * dpr * 1.2), 40, 160); if (spx !== st.spx) { st.spx = spx; st.spr = {}; }
    for (const it of st.items) if (!it.m) { const sp = sprite(it.ch); it.w = NOM * it.sc * sp.nw; it.h = NOM * it.sc * sp.nh; it.m = 1; }
    buildArt();
  }
  const X = wx => S.scene.x + (wx - S.view.x0) * S.s, Y = wy => S.scene.y + (wy - S.view.y0) * S.s;
  const WX = sx => (sx - S.scene.x) / S.s + S.view.x0, WY = sy => (sy - S.scene.y) / S.s + S.view.y0;

  // ------------------------------------------------------------------ pixel art, painted by code
  const painter = g => (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function disc(g, cx, cy, rx, ry, c) { g.fillStyle = c; for (let j = -ry; j <= ry; j++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry + 0.01)))); if (hw > 0) g.fillRect(cx - hw, cy + j, hw * 2, 1); } }
  const WIN = { x: 49, y: -141, w: 54, h: 40 };
  const HEART = ['.XX...XX.', 'XoXX.XXXX', 'XoXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  const CSTARS = [[-25, -124], [-15, -138], [5, -159], [19, -176], [31, -190], [10, -172], [187, -124], [178, -138], [158, -159], [144, -176], [132, -190], [153, -172]];

  function paintSky(g, night) {
    const r = painter(g), W = WIN, top = night ? '#10173d' : '#8fbdf0', mid = night ? '#1c2760' : '#f9cdb6', bot = night ? '#2f4186' : '#ffe7a8', fr = night ? nt('#fffdf8') : '#fffdf8', sh = night ? nt('#cdbfa6') : '#cdbfa6';
    g.save(); g.beginPath(); g.rect(W.x, W.y, W.w, W.h); g.clip();
    for (let j = 0; j < W.h; j++) { const k = j / (W.h - 1); r(W.x, W.y + j, W.w, 1, k < 0.55 ? mix(top, mid, k / 0.55) : mix(mid, bot, (k - 0.55) / 0.45)); }
    if (night) {
      for (const [dx, dy, c] of [[5, 5, '#ffffff'], [14, 12, '#cfd8ff'], [22, 4, '#ffffff'], [31, 17, '#cfd8ff'], [8, 22, '#cfd8ff'], [19, 26, '#ffffff'], [47, 24, '#cfd8ff'], [36, 6, '#ffffff'], [50, 9, '#cfd8ff'], [33, 28, '#cfd8ff']]) r(W.x + dx, W.y + dy, 1, 1, c);
      disc(g, W.x + 41, W.y + 12, 5, 5, '#fff4c4'); disc(g, W.x + 43, W.y + 10, 4, 4, '#18225a');
    } else {
      disc(g, W.x + 41, W.y + 26, 7, 7, '#fff0bd'); disc(g, W.x + 41, W.y + 26, 5, 5, '#fffbe6');
      r(W.x + 5, W.y + 9, 11, 2, '#fff3ec'); r(W.x + 8, W.y + 7, 6, 2, '#fff3ec'); r(W.x + 29, W.y + 14, 9, 2, '#ffe9e2'); r(W.x + 31, W.y + 12, 5, 2, '#ffe9e2');
    }
    const trees = night ? ['#141c48', '#182154', '#141c48'] : ['#e39a56', '#9ab86a', '#cf7c44'];
    for (let i = 0; i < 9; i++) disc(g, W.x + 2 + i * 7, W.y + W.h + (i % 3 === 1 ? 0 : 1), 5, 4 + (i % 2), trees[i % 3]);
    g.restore();
    r(W.x - 2, W.y - 2, W.w + 4, 2, fr); r(W.x - 2, W.y, 2, W.h, fr); r(W.x + W.w, W.y, 2, W.h, fr); r(W.x + 26, W.y, 2, W.h, fr);   // frame, and the post between the two sashes
    r(W.x + 13, W.y, 1, W.h, fr); r(W.x + 41, W.y, 1, W.h, fr); r(W.x, W.y + 19, W.w, 1, fr);                                          // grilles
    r(W.x - 4, W.y + W.h, W.w + 8, 3, fr); r(W.x - 4, W.y + W.h + 3, W.w + 8, 1, sh); r(W.x + W.w + 2, W.y - 2, 1, W.h + 2, sh);
    const c1 = night ? nt('#f7c3d3') : '#f7c3d3', c2 = night ? nt('#fbdde6') : '#fbdde6', rod = night ? nt('#e2cdb5') : '#e2cdb5';                             // pink curtains, as in her room
    for (const [x0, dir] of [[W.x - 7, 1], [W.x + W.w + 6, -1]]) for (let i = 0; i < 11; i++) { const x = x0 + i * dir, h = W.h + 6 - (i > 7 ? (i - 7) * 5 : 0); r(x, W.y - 4, 1, h, i % 3 === 1 ? c2 : c1); }
    r(W.x - 10, W.y - 6, W.w + 20, 2, rod); r(W.x - 11, W.y - 7, 2, 4, rod); r(W.x + W.w + 9, W.y - 7, 2, 4, rod);
  }
  function paintHeart(g, lit) {
    const r = painter(g), c = h => lit ? nt(h) : h; r(158, -27, 7, 8, c('#fffdf8')); r(158, -19, 7, 1, c('#cdbfa6')); r(160, -25, 1, 2, c('#b5a890')); r(162, -25, 1, 2, c('#b5a890'));
    HEART.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') r(157 + i, -37 + j, 1, 1, row[i] === 'o' ? (lit ? '#ffffff' : '#ffd6ec') : (lit ? '#ffb0e2' : '#f08fc0')); });
  }
  function paintStars(g, lit) { const r = painter(g), c = lit ? '#e6ff9c' : '#f3e9a4'; for (const [x, y] of CSTARS) { r(x, y - 1, 1, 3, c); r(x - 1, y, 3, 1, c); } }
  function paintRoom(g, V) {
    const r = painter(g), X0 = V.x0 - 1, X1 = Math.ceil(V.x1) + 1, Y0 = V.y0 - 1, Y1 = Math.ceil(V.y1) + 1, W = X1 - X0;
    r(X0, Y0, W, Y1 - Y0, '#f4eadf');
    for (let y = Math.ceil(Y0 / 11) * 11; y < -14; y += 11) for (let x = Math.ceil(X0 / 14) * 14 + (Math.abs(Math.round(y / 11)) % 2 ? 7 : 0); x < X1; x += 14) { const c = hash(x, y) < 0.5 ? '#f3d3cd' : '#f0d7b3'; r(x, y - 1, 1, 3, c); r(x - 1, y, 3, 1, c); }   // the same tiny-flower wallpaper as her room
    for (let y = Y0; y < -60; y++) {                                                                                                                              // the sloping attic ceiling, white boards
      const xl = SLOPE_L(y), xr = SLOPE_R(y);
      if (xl > X0) { r(X0, y, xl - X0, 1, '#fcf8f1'); for (let x = xl - 10; x >= X0; x -= 9) r(x, y, 1, 1, '#eee4d5'); r(xl - 1, y, 2, 1, '#d8c6ae'); r(xl + 1, y, 1, 1, '#e9dccb'); }
      if (xr < X1) { r(xr, y, X1 - xr, 1, '#fcf8f1'); for (let x = xr + 9; x < X1; x += 9) r(x, y, 1, 1, '#eee4d5'); r(xr - 1, y, 2, 1, '#d8c6ae'); r(xr - 2, y, 1, 1, '#e9dccb'); }
    }
    paintStars(g, false); paintSky(g, false);
    r(X0, -11, W, 6, '#fffaf0'); r(X0, -11, W, 1, '#ffffff'); r(X0, -6, W, 1, '#cdbfa6');                                                                          // baseboard
    r(X0, -5, W, Y1 + 5, '#e3c7a4');                                                                                                                              // carpet
    for (let y = -5; y < Y1; y++) for (let x = X0; x < X1; x++) { const h = hash(x, y); if (h < 0.1) r(x, y, 1, 1, '#d8b993'); else if (h > 0.89) r(x, y, 1, 1, '#eed7b9'); }
    r(X0, -5, W, 1, '#c9aa85');
    disc(g, 72, 31, 62, 17, '#f4b3cc'); disc(g, 72, 31, 53, 14, '#fff4e2'); disc(g, 72, 31, 44, 11, '#cfc0f2'); disc(g, 72, 31, 28, 7, '#fff4e2'); disc(g, 72, 31, 14, 3, '#f4b3cc');   // round rug
    paintHeart(g, false);
    r(171, -55, 28, 50, '#fffdf8'); r(173, -53, 24, 48, '#f4eee0'); for (const x of [179, 185, 191]) r(x, -53, 1, 48, '#dcd2be'); r(175, -31, 2, 4, '#c9bda6'); r(199, -55, 1, 50, '#cdbfa6');   // the little attic door
    r(-32, -73, 20, 18, '#fffdf8'); r(-30, -71, 16, 14, '#cfe9ff'); r(-30, -60, 16, 3, '#9fd68e');                                                                 // a drawing on the wall
    ['#f2766e', '#f7b24f', '#f6e36a', '#7cc8f0'].forEach((c, i) => { r(-27 + i, -67 + i, 10 - i * 2, 1, c); r(-27 + i, -66 + i, 1, 5 - i, c); r(-18 - i, -66 + i, 1, 5 - i, c); });
    r(-13, -73, 1, 18, '#cdbfa6'); r(-32, -55, 21, 1, '#cdbfa6');
    [['#e8695f', 19], ['#6fb7e8', 16], ['#f2c94c', 18], ['#8ecf8a', 15], ['#b48be0', 17]].forEach(([c, w], i) => { r(-33 + (i % 2), -2 - i * 3, w, 3, c); r(-33 + (i % 2), -2 - i * 3, w, 1, mix(c, '#ffffff', 0.4)); r(-33 + (i % 2) + w - 2, -1 - i * 3, 2, 2, '#fffdf8'); });   // picture books
  }
  function paintBedBack(g) {
    const r = painter(g);
    r(5, -78, 140, 46, '#e9dbca'); r(5, -78, 140, 3, '#cfbca6'); r(5, -75, 140, 3, '#d9c7b2'); r(5, -72, 140, 3, '#e1d1be');                                                                    // the nook under the top bunk
    for (const x of [0, 145]) { r(x, -118, 5, 22, '#f3f4f9'); r(x + 4, -118, 1, 22, '#d5d9e8'); r(x - 1, -120, 7, 2, '#ffffff'); r(x - 1, -118, 7, 1, '#d5d9e8'); }   // back posts and the tall rail by the wall
    for (let x = 24; x < 140; x += 20) { r(x, -110, 3, 13, '#eff0f6'); r(x + 2, -110, 1, 13, '#d5d9e8'); }
    r(5, -114, 140, 3, '#ffffff'); r(5, -111, 140, 1, '#c3c8dc'); r(5, -115, 140, 1, '#c3c8dc'); r(-1, -120, 1, 16, '#aab1cc'); r(150, -120, 1, 16, '#aab1cc'); r(-1, -121, 7, 1, '#aab1cc'); r(145, -121, 7, 1, '#aab1cc');
    r(33, -101, 110, 5, '#d8c8f3'); r(33, -101, 110, 1, '#ebe1fb'); for (let x = 37; x < 142; x += 7) r(x, -99, 1, 1, '#f4eeff');                                    // top bunk: lilac blanket and a pillow peeking over
    r(9, -103, 22, 7, '#ffffff'); r(10, -104, 20, 1, '#ffffff'); r(9, -98, 22, 1, '#eadbe2'); r(13, -101, 1, 1, '#f4a6bb'); r(22, -100, 1, 1, '#f4a6bb');
    r(5, -32, 140, 10, '#fdf1f3'); r(5, -32, 140, 1, '#ecd9df'); r(5, -22, 140, 6, '#f6e3e8'); r(5, -17, 140, 1, '#dfc8cf');                                         // bottom bunk: flowery sheet
    for (let i = 0; i < 15; i++) { const x = 37 + i * 7 + (i % 2), y = -29 + (i * 5) % 6; r(x, y, 1, 1, '#e97a9c'); r(x - 1, y, 1, 1, '#f4a6bb'); r(x + 1, y, 1, 1, '#f4a6bb'); r(x, y - 1, 1, 1, '#f4a6bb'); r(x, y + 1, 1, 1, '#f4a6bb'); if (i % 3 === 0) r(x + 2, y + 1, 1, 1, '#b9dcb4'); }
    for (let x = 10; x < 86; x += 11) { r(x, -20, 1, 1, '#e97a9c'); r(x + 1, -19, 1, 1, '#f4a6bb'); r(x - 1, -19, 1, 1, '#f4a6bb'); }
    r(88, -33, 57, 12, '#f9cdb3'); r(88, -33, 57, 2, '#fde3d4'); r(86, -32, 3, 11, '#f0b497'); r(87, -32, 1, 11, '#fbd9c5');                                         // peach comforter folded over the foot end
    r(89, -22, 56, 7, '#f4bea1'); for (let x = 89; x < 145; x += 8) r(x + 1, -15, 6, 1, '#f4bea1'); for (const x of [104, 123, 137]) { r(x, -31, 1, 15, '#ecae8f'); r(x + 1, -31, 1, 9, '#fde3d4'); }
    r(8, -39, 23, 1, '#ffffff'); r(7, -38, 25, 10, '#ffffff'); r(8, -28, 23, 1, '#eadbe2'); r(7, -31, 25, 3, '#f5e8ed'); r(7, -38, 1, 1, '#e9dbca'); r(31, -38, 1, 1, '#e9dbca');   // her pillow
    for (const [x, y] of [[12, -35], [20, -33], [27, -36]]) { r(x, y, 1, 1, '#e97a9c'); r(x - 1, y, 1, 1, '#f4a6bb'); r(x + 1, y, 1, 1, '#f4a6bb'); r(x, y - 1, 1, 1, '#f4a6bb'); }
    r(0, -16, 150, 16, '#ffffff'); r(5, -16, 140, 1, '#e4e7f1'); for (const x of [9, 78]) { r(x, -12, 63, 8, '#f1f2f8'); r(x, -12, 63, 1, '#dcdfec'); r(x, -12, 1, 8, '#dcdfec'); } r(0, -2, 150, 1, '#d9dceb'); r(0, -1, 150, 1, '#aab1cc');   // front board
    r(-1, 0, 152, 2, '#c2a37c');
  }
  function paintFront(g) {
    const r = painter(g), E = '#aab1cc';
    r(0, -88, 150, 10, '#ffffff'); r(0, -80, 150, 1, '#d5d9e8'); r(0, -79, 150, 1, E);                                                                           // top bunk: side board, then the low rail
    r(2, -98, 146, 10, '#f6f7fb'); r(2, -99, 146, 2, '#ffffff'); r(2, -89, 146, 1, '#d9dceb');
    for (const x of [8, 78]) { r(x, -95, 64, 5, '#eef0f7'); r(x, -95, 64, 1, '#d9dceb'); r(x, -95, 1, 5, '#d9dceb'); }                                              // two sunk panels, as on her bed
    r(9, -85, 2, 2, '#9cc0ea'); r(139, -85, 2, 2, '#9cc0ea'); r(5, -88, 140, 1, '#e4e7f1');
    for (const x of [0, 145]) { r(x, -102, 5, 102, '#ffffff'); r(x + 4, -102, 1, 102, '#cfd4e6'); r(x - 1, -104, 7, 2, '#ffffff'); r(x - 1, -102, 7, 1, '#cfd4e6'); r(x + 2, -60, 1, 1, '#9cc0ea'); r(x + 2, -30, 1, 1, '#9cc0ea'); }
    r(-1, -102, 1, 102, E); r(150, -102, 1, 102, E); r(-2, -104, 1, 2, E); r(151, -104, 1, 2, E); r(-1, -105, 7, 1, E); r(145, -105, 7, 1, E);                       // a thin outline so the white bed stands out from the wall
  }
  function paintLadder(g) {
    const r = painter(g);
    for (let y = LAD.yt; y <= LAD.yb; y++) { const x = ladX(y); for (const o of [0, 24]) { r(x + o, y, 3, 1, '#ffffff'); r(x + o + 2, y, 1, 1, '#c5cade'); r(x + o + 3, y, 1, 1, '#9aa2c2'); r(x + o - 1, y, 1, 1, '#aab1cc'); } }
    for (const y of LAD.rungs) { const x = ladX(y); r(x + 3, y - 1, 21, 1, '#aab1cc'); r(x + 3, y, 21, 1, '#ffffff'); r(x + 3, y + 1, 21, 1, '#eceef5'); r(x + 3, y + 2, 21, 1, '#b7bdd5'); r(x + 3, y + 3, 21, 1, '#9aa2c2'); }
    const xt = ladX(LAD.yt); r(xt - 1, LAD.yt - 2, 5, 2, '#ffffff'); r(xt + 23, LAD.yt - 2, 5, 2, '#ffffff'); r(ladX(LAD.yb) - 1, LAD.yb + 1, 29, 1, 'rgba(60,50,90,.22)');
  }
  // fairy lights: a string under the top bunk and one along each slope of the ceiling
  const BULB = [['#ffd76a', '255,214,110'], ['#ff9ec4', '255,150,200'], ['#9be7c4', '140,235,190'], ['#9fd0ff', '150,205,255']];
  function makeBulbs(V) {
    const L = [], W = []; let k = 0;
    for (let i = 0; i <= 12; i++) { const x = 9 + i * 11, y = i % 2 ? -72 : -75; L.push({ x, y, c: k++ % 4 }); if (i < 12) for (let j = 1; j < 11; j++) W.push([x + j, Math.round(lerp(y, i % 2 ? -75 : -72, j / 11)) - 2]); }
    for (let y = -106; y > V.y0 + 3; y -= 9) for (const x of [SLOPE_L(y) + 5, SLOPE_R(y) - 6]) if (x > V.x0 + 1 && x < V.x1 - 2) L.push({ x, y: y + 4, c: k++ % 4 });
    for (let y = -100; y > V.y0 - 2; y--) for (const x of [SLOPE_L(y) + 4, SLOPE_R(y) - 5]) W.push([x, y + 2]);
    L.forEach((b, i) => b.ph = i * 1.7);
    return { L, W };
  }
  function paintLights(g, B, lit) {
    const r = painter(g); for (const [x, y] of B.W) r(x, y, 1, 1, lit ? '#3d4474' : '#8d7c68');
    for (const b of B.L) { r(b.x, b.y - 1, 2, 3, BULB[b.c][0]); r(b.x - 1, b.y, 4, 1, BULB[b.c][0]); r(b.x, b.y, 1, 1, lit ? '#ffffff' : mix(BULB[b.c][0], '#ffffff', 0.6)); }
  }
  function paintBasket(g, w, h) {
    const r = painter(g); r(0, 0, w, h, '#fff3da');
    for (let y = 3; y < h - 3; y += 5) for (let x = 3 + ((y / 5) & 1 ? 3 : 0); x < w - 3; x += 6) r(x, y, 2, 1, '#f5e4c3');
    const rim = (x, y, i) => r(x, y, 1, 1, ['#c99a5b', '#e2ba7e', '#b98a4e'][i]);
    for (let x = 0; x < w; x++) for (let j = 0; j < 3; j++) { const i = (((x >> 1) + j) % 3); rim(x, j, i); rim(x, h - 1 - j, i); }
    for (let y = 0; y < h; y++) for (let j = 0; j < 3; j++) { const i = (((y >> 1) + j) % 3); rim(j, y, i); rim(w - 1 - j, y, i); }
    r(3, 3, w - 6, 1, '#e9d4ab'); r(3, 3, 1, h - 6, '#e9d4ab');
  }
  function glowSprite(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.3, 'rgba(' + rgb + ',.5)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  function buildArt() {
    const st = S, V = st.view, w = Math.ceil(V.w) + 1, h = Math.ceil(V.h) + 1, B = st.bulbs = makeBulbs(V);
    const layer = fn => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.translate(-V.x0, -V.y0); if (fn) fn(g); return c; };
    const tint = src => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = NIGHT; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); return c; };
    const room = layer(g => paintRoom(g, V)), back = layer(paintBedBack), front = layer(paintFront), lad = layer(paintLadder), frontN = tint(front), ladN = tint(lad);
    const day = layer(), gd = day.getContext('2d'); gd.setTransform(1, 0, 0, 1, 0, 0); gd.drawImage(room, 0, 0); gd.drawImage(back, 0, 0); gd.translate(-V.x0, -V.y0); paintLights(gd, B, false); gd.setTransform(1, 0, 0, 1, 0, 0); gd.drawImage(front, 0, 0); gd.drawImage(lad, 0, 0);
    const night = tint(room), gn = night.getContext('2d'); gn.globalCompositeOperation = 'source-over'; gn.translate(-V.x0, -V.y0); paintSky(gn, true); paintHeart(gn, true); paintStars(gn, true);
    gn.setTransform(1, 0, 0, 1, 0, 0); gn.drawImage(tint(back), 0, 0); gn.translate(-V.x0, -V.y0); paintLights(gn, B, true); gn.setTransform(1, 0, 0, 1, 0, 0); gn.drawImage(frontN, 0, 0); gn.drawImage(ladN, 0, 0);
    st.bg = { day, night }; st.front = { day: front, night: frontN }; st.lad = { day: lad, night: ladN };
    const T = st.tray, tb = st.trayBg = document.createElement('canvas'); tb.width = Math.ceil(T.w / st.s); tb.height = Math.ceil(T.h / st.s); paintBasket(tb.getContext('2d'), tb.width, tb.height);
    if (!st.glow) st.glow = { b: BULB.map(b => glowSprite(b[1])), pink: glowSprite('255,150,215'), warm: glowSprite('255,236,170'), moon: glowSprite('200,215,255') };
  }

  // ------------------------------------------------------------------ emoji sprites: drawn once, trimmed to what is really there so every stuffy sits exactly on its surface
  function sprite(ch) {
    const st = S; let sp = st.spr[ch]; if (sp) return sp;
    const px = st.spx, n = Math.ceil(px * 1.6), c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d', { willReadFrequently: true });
    g.font = px + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, n / 2, n / 2);
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    try { const d = g.getImageData(0, 0, n, n).data; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3] > 50) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch (e) { }
    if (x1 - x0 < px * 0.3 || y1 - y0 < px * 0.3) { x0 = y0 = Math.round((n - px) / 2); x1 = y1 = x0 + px - 1; }      // nothing measurable: take the plain square
    const w = x1 - x0 + 1, h = y1 - y0 + 1, crop = () => { const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); return o; };
    const day = crop(), night = crop(), gn = night.getContext('2d'); gn.globalCompositeOperation = 'source-atop'; gn.fillStyle = 'rgba(34,46,112,.52)'; gn.fillRect(0, 0, w, h);
    return st.spr[ch] = { day, night, nw: w / Math.max(w, h), nh: h / Math.max(w, h) };
  }

  // ------------------------------------------------------------------ where things are
  const placed = () => S.items.filter(it => it.where === 'bed');
  // floor stuffies remember where she put them even when the screen is turned and that spot is out of view
  function wposv(sid, x, d, y, w) { if (sid !== 'floor') return [x, y]; const F = S.F; return [clamp(x, F.x0 + w / 2, F.x1 - w / 2), y + clamp(d, F.y0, F.y1) - d]; }
  const wpos = it => wposv(it.sid, it.x, it.d, it.y, it.w);
  function slotXY(i) {
    const T = S.tray, a = Math.floor(i / T.lines), b = i % T.lines, along = T.pad + a * T.slot + T.slot / 2 - T.scroll - T.peek, across = 7 + b * T.slot + T.slot / 2;
    return T.vert ? [T.x + across, T.y + along] : [T.x + along, T.y + across];
  }
  // bottom-centre of a stuffy on screen, wherever it is
  function toyScreen(it) {
    if (it.where === 'held') return [it.hx, it.hy];
    if (it.where === 'tray') { const p = slotXY(it.id); return [p[0], p[1] + S.tray.size * 0.46]; }
    const p = wpos(it); return [X(p[0] + it.ox), Y(p[1] + it.py)];
  }
  const inTray = (x, y) => { const T = S.tray; return x >= T.x && x < T.x + T.w && y >= T.y && y < T.y + T.h; };
  // back to front, the order they are drawn in (and saved in)
  function order() {
    const L = placed();
    L.forEach(it => { it._l = SDEF[it.sid].layer; it._d = it.sid === 'floor' ? it.d : 0; });
    return L.sort((a, b) => a._l - b._l || a._d - b._d || a.lvl - b.lvl || a.x - b.x);
  }

  // ------------------------------------------------------------------ sitting and stacking
  // what a stuffy dropped at x on surface `sid` would come to rest on: the surface itself, or the highest stuffy under it
  function supportAt(sid, x, d, it) {
    let y = d, lvl = 0;
    for (const o of S.items) { if (o === it || o.where !== 'bed' || o.sid !== sid || Math.abs(o.d - d) > 0.5 || Math.abs(o.x - x) >= 0.35 * (o.w + it.w)) continue; const c = o.y - o.h * (1 - SINK); if (c < y) { y = c; lvl = o.lvl + 1; } }
    return { y, lvl };
  }
  // work out again who sits on what for one surface (after something was lifted out from underneath, or put on)
  function settle(sid) {
    const L = S.items.filter(o => o.where === 'bed' && o.sid === sid).sort((a, b) => b.y - a.y), done = [];
    for (const it of L) {
      let y = it.d, lvl = 0;
      for (const o of done) { if (Math.abs(o.d - it.d) > 0.5 || Math.abs(o.x - it.x) >= 0.35 * (o.w + it.w)) continue; const c = o.y - o.h * (1 - SINK); if (c < y) { y = c; lvl = o.lvl + 1; } }
      if (it.y > -1e5 && it.y < 1e5 && Math.abs(it.y - y) > 0.01) it.py += it.y - y;          // stay where it is drawn, then fall into place
      it.y = y; it.lvl = lvl; done.push(it);
    }
  }
  const clampX = (F, x, it) => F.x1 - F.x0 <= it.w ? (F.x0 + F.x1) / 2 : clamp(x, F.x0 + it.w / 2, F.x1 - it.w / 2);
  const fits = (it, q) => q.lvl < q.F.max && q.y - it.h >= (q.F.roof != null ? q.F.roof : S.view.y0 - 3);
  // the nearest place below the point (x, by): every surface under it is a candidate, the closest drop wins; on top of another stuffy counts
  function resolveDrop(it, x, by) {
    const c = [];
    // let go right on top of another stuffy: it sits on that one
    const on = order().filter(o => o !== it && !o.fly && o.sid !== 'floor').reverse().find(o => Math.abs(o.x - x) < 0.35 * (o.w + it.w) && by <= o.y && by >= o.y - o.h - 2);
    if (on) { const F = SDEF[on.sid], m = 0.3 * (on.w + it.w), cx = clampX(F, clamp(x, on.x - m, on.x + m), it), r = supportAt(F.id, cx, F.y, it); c.push({ F, x: cx, d: F.y, y: r.y, lvl: r.lvl, dist: -1 }); }
    for (const F of S.surf) {
      if (F.band) {
        const fx = clamp(x, F.x0 + it.w / 2, F.x1 - it.w / 2); let tgt = null, best = 1e9;
        for (const o of S.items) { if (o === it || o.where !== 'bed' || o.sid !== 'floor') continue; const p = wpos(o); if (Math.abs(p[0] - fx) >= 0.35 * (o.w + it.w) || by > p[1] + 2 || by < p[1] - o.h - 5) continue; const q = Math.abs(by - (p[1] - o.h / 2)); if (q < best) { best = q; tgt = o; } }
        if (tgt) { const hx = tgt.x + (fx - wpos(tgt)[0]), r = supportAt('floor', hx, tgt.d, it); c.push({ F, x: hx, d: tgt.d, y: r.y, lvl: r.lvl, dist: 0 }); }
        else { const d = clamp(by, F.y0, F.y1); c.push({ F, x: fx, d, y: d, lvl: 0, dist: Math.max(0, F.y0 - by) + 0.5 }); }
      } else if (x >= F.c0 && x <= F.c1 && by <= F.y + F.catch) { const cx = clampX(F, x, it), r = supportAt(F.id, cx, F.y, it); c.push({ F, x: cx, d: F.y, y: r.y, lvl: r.lvl, dist: Math.max(0, r.y - by) }); }
    }
    c.sort((a, b) => a.dist - b.dist);
    for (const q of c) {
      if (fits(it, q)) return q;
      for (let k = 1; k <= 14; k++) for (const sg of [1, -1]) { const nx = clampX(q.F, q.x + sg * k * 4, it), r = supportAt(q.F.id, nx, q.d, it), q2 = { F: q.F, x: nx, d: q.d, y: r.y, lvl: r.lvl }; if (fits(it, q2)) return q2; }   // too tall there: slide along to the nearest gap
    }
    return c[c.length - 1];
  }
  const r1 = v => Math.round(v * 10) / 10;                 // places are kept to a tenth of a pixel, so what is saved is exactly what she sees
  function putOn(it, q) { it.where = 'bed'; it.sid = q.F.id; it.x = r1(q.x); it.d = r1(q.d); it.y = -1e9; settle(it.sid); }
  function liftOff(it) { const sid = it.sid; it.sid = null; it.where = 'held'; if (sid) settle(sid); }
  // a free spot for a stuffy that hops out of the basket by itself
  function freeSpot(it) {
    const ids = ['bottom', 'bottom', 'bottom', 'top', 'top', 'rail', 'pillow', 'r0', 'r1', 'r2', 'floor', 'floor']; let fallback = null;
    for (let i = 0; i < 60; i++) {
      const F = S.surf[SIDS.indexOf(pick(ids))], x = clampX(F, rnd(F.x0, F.x1), it), d = F.band ? rnd(F.y0, Math.min(F.y1, F.y0 + 14)) : F.y, r = supportAt(F.id, x, d, it), q = { F, x, d, y: r.y, lvl: r.lvl };
      if (!fits(it, q)) continue; if (!fallback) fallback = q;
      if (r.lvl === 0 && !S.items.some(o => o !== it && o.where === 'bed' && o.sid === F.id && Math.abs(o.x - x) < 0.48 * (o.w + it.w) && Math.abs(o.d - d) < 9)) return q;
    }
    return fallback || { F: S.F, x: rnd(S.F.x0 + 12, S.F.x1 - 12), d: S.F.y0 + 4, y: S.F.y0 + 4, lvl: 0 };
  }

  // ------------------------------------------------------------------ moving stuffies about
  function flyFrom(it, sx, sy, k0, delay, o) { it.fly = Object.assign({ sx, sy, k0, t: -(delay || 0), dur: 0.45, arc: 34 }, o); }
  function hopOut(it) {                                  // tapped in the basket: it jumps onto the bed by itself
    const st = S, p = toyScreen(it); putOn(it, freeSpot(it)); it.py = 0; flyFrom(it, p[0], p[1], st.tray.k, 0, { arc: 60, dur: 0.55, pop: 1 });
    squeak(it); whoosh(true); it.slAt = st.t + 0.9; st.hintOff = true; persist();
  }
  function toTray(it, delay, quiet) {
    const st = S, p = toyScreen(it), k0 = it.where === 'held' ? st.s * 1.15 : st.s, sid = it.where === 'bed' ? it.sid : null;
    it.where = 'tray'; it.sid = null; it.sl = 0; it.py = it.vy = it.ox = 0; if (sid) settle(sid); flyFrom(it, p[0], p[1], k0, delay, { arc: 26, dur: 0.4 }); if (!quiet) { whoosh(false); persist(); }
  }
  function grab(p) {
    const st = S, it = p.it; clearTimeout(p.timer);
    if (!it || it.where === 'held' || it.fly) { p.mode = 'none'; return; }
    const at = toyScreen(it); p.from = it.where; p.rec = it.where === 'bed' ? { sid: it.sid, x: it.x, d: it.d } : null;
    if (it.where === 'bed') liftOff(it);
    it.where = 'held'; it.hx = at[0]; it.hy = at[1]; it.py = it.vy = it.ox = 0; it.wig = 0.5; it.wt = st.t; it.sway = 0; p.mode = 'drag';
    once('pick', 60, () => blip(it.pitch + 7, 'triangle', 0.06, 0.13));
  }
  function drop(p, cancel) {
    const st = S, it = p.it, moved = Math.hypot(p.x - p.x0, p.y - p.y0) > 10; if (!it || it.where !== 'held') return;
    const fx = clamp(p.x, 0, st.cw), fy = clamp(p.y - 2, 0, st.ch); it.hx = fx; it.hy = fy;
    if (p.from === 'tray' && !moved && !cancel) { it.where = 'tray'; hopOut(it); return; }             // a slow tap in the basket
    if (inTray(fx, p.y) || (cancel && p.from === 'tray')) { toTray(it); return; }
    const wx = WX(fx), wy = WY(fy), F0 = cancel && p.rec ? st.surf[SIDS.indexOf(p.rec.sid)] : null;
    const q = F0 ? { F: F0, x: p.rec.x, d: p.rec.d } : resolveDrop(it, wx, wy);
    putOn(it, q); const at = wpos(it); it.py = wy - at[1]; it.ox = wx - at[0]; it.vy = it.py < 0 ? 30 : 0; it.slAt = st.t + 0.6; st.hintOff = true;
    if (it.lvl > 0) once('stk', 80, () => blip(it.pitch + 4 + it.lvl * 3, 'square', 0.05, 0.08));
    persist();
  }
  function flipToy(it) { it.flip = !it.flip; it.turn = 1; it.sq = Math.max(it.sq, 0.3); once('flip', 60, () => { blip(it.pitch + 5, 'triangle', 0.05, 0.12); setTimeout(() => blip(it.pitch + 10, 'triangle', 0.06, 0.12), 70); }); persist(); }
  function tapToy(it) {
    const st = S, now = performance.now();
    if (st.lastTap && st.lastTap.it === it && now - st.lastTap.t < 450) { st.lastTap = null; flipToy(it); return; }      // tap twice: turn round
    st.lastTap = { it, t: now }; it.wig = 1; it.wt = st.t; it.sq = Math.max(it.sq, 0.5); squeak(it, st.night);
    const p = toyScreen(it); emo(pick(['💖', '💕', '❤️', '💗']), p[0], p[1] - it.h * st.s - 6, { size: 17 });
    if (!st.night && Math.random() < 0.18) voice('m_giggle');
  }
  // a tap on nothing: a little sparkle (and the night light blinks if that is what she touched)
  function poke(x, y) {
    const st = S, wx = WX(x), wy = WY(y); spark(x, y, 4);
    if (Math.hypot(wx - 161, wy + 32) < 12) { st.nlPulse = 1; blip(16, 'triangle', 0.12, 0.12); emo('💗', x, y - 8, { size: 15 }); }
    else if (wx > WIN.x && wx < WIN.x + WIN.w && wy > WIN.y && wy < WIN.y + WIN.h) { blip(19, 'sine', 0.1, 0.08); emo(st.night ? '⭐' : '🐦', x, y, { size: 16, vx: 26, vy: -20 }); }
    else blip(12, 'sine', 0.04, 0.04);
  }
  function sceneHit(x, y) {
    const st = S, L = order().filter(it => !it.fly).reverse(); let best = null, bd = 30;
    for (const it of L) { const p = toyScreen(it), dw = it.w * st.s, dh = it.h * st.s; if (Math.abs(x - p[0]) <= dw / 2 + 2 && y <= p[1] + 3 && y >= p[1] - dh - 3) return it; }
    for (const it of L) { const p = toyScreen(it), q = Math.hypot(x - p[0], y - (p[1] - it.h * st.s / 2)); if (q < bd) { bd = q; best = it; } }
    return best;
  }
  function trayHit(x, y) {
    const st = S; let best = null, bd = st.tray.slot * 0.62;
    for (const it of st.items) { if (it.where !== 'tray' || it.fly) continue; const p = slotXY(it.id), q = Math.hypot(x - p[0], y - p[1]); if (q < bd) { bd = q; best = it; } }
    return best;
  }

  // ------------------------------------------------------------------ fingers
  function pos(e) { const r = S.cv.getBoundingClientRect(); return [(e.clientX - r.left) * S.cw / (r.width || 1), (e.clientY - r.top) * S.ch / (r.height || 1)]; }
  function bind() {
    const st = S, cv = st.cv;
    cv.addEventListener('pointerdown', e => {
      if (S !== st || st.ptr[e.pointerId]) return; e.preventDefault(); e.stopPropagation();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      const [x, y] = pos(e), p = st.ptr[e.pointerId] = { id: e.pointerId, x0: x, y0: y, x, y, lx: x, ly: y, lt: performance.now(), mode: 'none', it: null };
      st.touched = st.t;
      if (inTray(x, y)) {
        p.mode = 'tray'; p.it = trayHit(x, y); p.sc0 = st.tray.scroll; st.tray.v = 0; st.tray.peek = 0;
        if (p.it) { p.it.press = 1; p.timer = setTimeout(() => { if (S === st && st.ptr[p.id] === p && p.mode === 'tray' && p.it.where === 'tray') grab(p); }, 300); }   // hold still: pick it up
      } else {
        const it = sceneHit(x, y);
        if (it) { p.mode = 'press'; p.it = it; it.press = 1; p.timer = setTimeout(() => { if (S === st && st.ptr[p.id] === p && p.mode === 'press') { p.long = true; flipToy(it); } }, 520); }   // long press: turn round
        else poke(x, y);
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = S === st && st.ptr[e.pointerId]; if (!p) return; e.preventDefault(); const [x, y] = pos(e), T = st.tray, now = performance.now();
      p.x = x; p.y = y; const dx = x - p.x0, dy = y - p.y0, dist = Math.hypot(dx, dy);
      if (p.mode === 'press' && dist > 10) grab(p);
      else if (p.mode === 'tray' && dist > 10) {
        const along = Math.abs(T.vert ? dy : dx), across = Math.abs(T.vert ? dx : dy);
        if (p.it && p.it.where === 'tray' && (across > along * 0.7 || T.max < 4)) grab(p);                      // pulled towards the bed
        else { p.mode = 'scroll'; clearTimeout(p.timer); if (p.it) p.it.press = 0; }                             // swiped along the basket
      }
      if (p.mode === 'scroll') {
        const a = T.vert ? dy : dx, prev = T.vert ? p.ly : p.lx, cur = T.vert ? y : x, dt = Math.max(1, now - p.lt);
        T.scroll = clamp(p.sc0 - a, 0, T.max); T.v = lerp(T.v, -(cur - prev) / dt * 1000, 0.5);
        if (p.it && p.it.where === 'tray' && !p.it.fly && !inTray(x, y)) grab(p);                                  // …and then out of it: she wants that one
      }
      p.lx = x; p.ly = y; p.lt = now;
    });
    const end = (e, cancel) => {
      const p = S === st && st.ptr[e.pointerId]; if (!p) return; delete st.ptr[e.pointerId]; clearTimeout(p.timer);
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { }
      const it = p.it; if (it) it.press = 0;
      if (e.type === 'pointerup') { const q = pos(e); p.x = q[0]; p.y = q[1]; }
      if (p.mode === 'drag') drop(p, cancel);
      else if (cancel) return;
      else if (p.mode === 'press') { if (!p.long) tapToy(it); }
      else if (p.mode === 'tray' && it && it.where === 'tray' && !it.fly) hopOut(it);
    };
    cv.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); end(e, false); });
    cv.addEventListener('pointercancel', e => end(e, true));
    cv.addEventListener('lostpointercapture', e => end(e, true));
    cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ------------------------------------------------------------------ the big buttons
  function setNight(on, quiet) {
    const st = S; if (!st || st.night === on) return; st.night = on; st.party = 0; let i = 0;
    const L = placed().sort((a, b) => a.y - b.y);
    if (on) { for (const it of L) it.slAt = st.t + 0.5 + (i++) * 0.13; if (!quiet) { melody('lullaby'); voice('m_nite'); music('night'); } }
    else { for (const it of L) { it.slAt = 0; it.strAt = st.t + 0.2 + (i++) * 0.07; } st.flash = quiet ? 0 : 1; if (!quiet) { jingle([0, 4, 7, 12, 16], 0.09, 'triangle'); chip('sparkle', 0.4); } music(null); }
    sync(); persist();
  }
  function party() {
    const st = S; if (st.night) setNight(false, true);
    const n = st.partyN = (st.partyN || 0) + 1; st.party = st.t + 7.2;
    melody('happy'); voice(pick(['m_yay', 'm_dance'])); chip('cheer', 0.4); confetti(70);
    for (const ms of [2500, 5000]) setTimeout(() => { if (S === st && st.partyN === n && st.party > st.t) { melody('happy'); confetti(40); } }, ms);
    sync();
  }
  function awayTap() {
    const st = S, b = st.awayB, reset = () => { delete b.dataset.sure; b.textContent = '🧺'; b.classList.remove('stf-ask'); };
    if (!placed().length && !b.dataset.sure) { blip(-5, 'triangle', 0.08, 0.1); st.tray.peek = -8; return; }                 // nothing is out
    if (b.dataset.sure) { clearTimeout(st.awayT); reset(); let i = 0; for (const it of order().reverse()) toTray(it, (i++) * 0.05, true); whoosh(false); chip('tidy', 0.5); persist(); }
    else { b.dataset.sure = 1; b.textContent = '❓'; b.classList.add('stf-ask'); blip(5, 'triangle', 0.08, 0.12); st.awayT = setTimeout(reset, 2000); }      // must be tapped twice
  }

  // ------------------------------------------------------------------ 🎲 surprise patterns
  const span = (a, b, n) => n < 2 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  const row = (sid, xs, flip) => xs.map(x => ({ sid, x, flip: !!flip }));
  const RAIL7 = span(16, 134, 7), TOP7 = span(17, 133, 7), BOT4 = [43, 64, 85, 106];
  const PATTERNS = {
    // a pyramid on the bottom bunk (and a little one on the rug)
    pyramid: F => [...row('bottom', [50, 74, 98]), ...row('bottom', [62, 86]), ...row('bottom', [74]), ...row('pillow', [19]),
      ...[48, 72, 96, 60, 84, 72].map(x => ({ sid: 'floor', x, d: Math.min(F.y1 - 2, F.y0 + 24) })), ...row('top', TOP7), ...row('rail', [30, 60, 90, 120])],
    // everybody in neat rows, top rail first
    row: F => [...row('rail', RAIL7), ...row('top', TOP7), ...row('bottom', BOT4), ...row('pillow', [19]), ...span(F.x0 + 16, F.x1 - 16, 5).map(x => ({ sid: 'floor', x, d: F.y0 + 5 }))],
    // one on every rung, a queue waiting at the bottom and the ones who already climbed up
    ladder: F => [...row('r0', [0]), ...row('r1', [0]), ...row('r2', [0]), ...[104, 82, 60, 38, 16].map(x => ({ sid: 'floor', x, d: F.y0 + 7, flip: true })), ...row('top', [130, 109, 88, 67, 46, 25]),
      ...row('bottom', [43, 64, 85], true), ...row('pillow', [19], true), ...row('rail', RAIL7)],
    // a line in rainbow order
    rainbow: F => [...row('rail', RAIL7), ...row('top', TOP7), ...row('pillow', [19]), ...row('bottom', BOT4), ...span(F.x0 + 16, F.x1 - 16, 5).map(x => ({ sid: 'floor', x, d: F.y0 + 5 }))],
    // a circle "meeting" on the rug, everyone looking in
    circle: (F, n) => {
      const m = Math.min(n, 10), cx = clamp(72, F.x0 + 62, F.x1 - 62), ry = clamp((F.y1 - F.y0) / 2 - 1, 3, 15), cy = F.y0 + 1 + ry, rx = 46, L = [];
      for (let i = 0; i < m; i++) { const a = -Math.PI / 2 + Math.PI * 2 * (i + 0.5) / m, x = cx + rx * Math.cos(a); L.push({ sid: 'floor', x, d: cy + ry * Math.sin(a), flip: x < cx }); }
      return [...L, { sid: 'floor', x: cx, d: cy + 1.2 }, ...row('bottom', BOT4), ...row('pillow', [19]), ...row('top', TOP7), ...row('rail', [45, 105])];
    }
  };
  const PMIN = { pyramid: 6, row: 7, ladder: 9, rainbow: 7, circle: 9 };
  const BANDS = [[0, 1.5], [1.5, 4.5], [4.5, 7], [7, 11], [11, 15], [15, 17], [17, 19]];        // red, orange, yellow, green, blue, purple, pink
  function surprise(name) {
    const st = S; if (!st) return; if (st.night) setNight(false, true); st.party = 0;
    if (!PATTERNS[name]) name = pick(Object.keys(PATTERNS).filter(k => k !== st.lastPat)); st.lastPat = name;
    for (const id in st.ptr) { const p = st.ptr[id]; if (p.mode === 'drag') drop(p, true); p.mode = 'none'; }
    // who takes part: everyone who is out already, plus enough from the basket to make the pattern
    let L = st.items.filter(it => it.where === 'bed'); const rest = shuffle(st.items.filter(it => it.where === 'tray'));
    if (name === 'rainbow') {                             // one of every colour along the top rail, in rainbow order; anyone else lines up below, also by colour
      const line = BANDS.map(b => { const inB = it => it.hue >= b[0] && it.hue < b[1]; let it = L.find(inB); if (it) L.splice(L.indexOf(it), 1); else { it = rest.find(inB); if (it) rest.splice(rest.indexOf(it), 1); } return it; }).filter(Boolean);
      L = line.concat(L.sort((a, b) => a.hue - b.hue));
    } else {
      while (L.length < PMIN[name] && rest.length) L.push(rest.shift());
      L = name === 'pyramid' ? L.sort((a, b) => b.w * b.h - a.w * a.h) : shuffle(L);
    }
    const spots = PATTERNS[name](st.F, L.length), from = L.map(it => { const p = toyScreen(it); return [p[0], p[1], it.where === 'tray' ? st.tray.k : st.s]; });
    L = L.slice(0, spots.length);
    L.forEach((it, i) => { const sp = spots[i], F = st.surf[SIDS.indexOf(sp.sid)]; it.where = 'bed'; it.sid = sp.sid; it.x = r1(F.band ? sp.x : clampX(F, sp.x || 0, it)); it.d = r1(F.band ? sp.d : F.y); it.flip = !!sp.flip; it.y = 9e5 - i; it.vy = it.ox = 0; it.fly = null; });
    for (const sid of SIDS) settle(sid);
    L.forEach((it, i) => { it.py = 0; flyFrom(it, from[i][0], from[i][1], from[i][2], 0.15 + i * 0.1, { arc: 44, dur: 0.42, pop: 1 }); it.slAt = 0; });
    st.busyTill = st.t + 0.15 + L.length * 0.1 + 0.5; st.finale = name; st.hintOff = true; whoosh(true); sync(); persist();
    return name;
  }

  // ------------------------------------------------------------------ little effects
  function emo(ch, x, y, o) { S.parts.push(Object.assign({ k: 'e', ch, x, y, vx: rnd(-8, 8), vy: -36, g: 0, life: 1.2, age: 0, size: 18, rot: 0, vr: 0 }, o)); }
  function spark(x, y, n) { for (let i = 0; i < n; i++) S.parts.push({ k: 's', x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-50, 50), vy: rnd(-70, -10), g: 120, life: rnd(0.35, 0.7), age: 0, size: rnd(2, 4), col: pick(['#fff6b0', '#ffffff', '#ffd76a']) }); }
  function confetti(n) { const sc = S.scene; for (let i = 0; i < n; i++) S.parts.push({ k: 'c', x: rnd(sc.x, sc.x + sc.w), y: sc.y - rnd(0, 60), vx: rnd(-30, 30), vy: rnd(50, 130), g: 40, life: rnd(2.2, 3.6), age: 0, size: rnd(5, 9), col: pick(CONFETTI), rot: rnd(0, 6), vr: rnd(-9, 9) }); }
  function bubble(it, ch, delay) { S.bubbles.push({ it, ch, t0: S.t + (delay || 0), dur: 1.5, hi: false }); }

  // ------------------------------------------------------------------ every frame
  function frame(ms) {
    const st = S; if (!st) return;
    if (!st.cv.isConnected || st.panel.classList.contains('hidden')) {                        // something else closed or took over the panel
      const gone = !st.cv.isConnected, res = { count: count(), asleep: !!st.night, done: false }; persist(); teardown(); if (!gone) music(null);
      try { if (st.opts.onClose) st.opts.onClose(res); } catch (e) { } return;
    }
    const now = ms / 1000, dt = clamp(now - (st.last || now), 0, 0.05); st.last = now; st.t += dt;
    try { update(dt); draw(); } catch (e) { if (!st.err) { st.err = 1; try { console.error(e); } catch (e2) { } } }
    st.raf = requestAnimationFrame(frame);
  }
  function update(dt) {
    const st = S, t = st.t, T = st.tray;
    st.nk += clamp((st.night ? 1 : 0) - st.nk, -dt / 0.9, dt / 0.9); st.flash = Math.max(0, st.flash - dt / 0.8); st.nlPulse = Math.max(0, st.nlPulse - dt * 1.5);
    const partying = st.party > t; if (st.wasParty && !partying) { sync(); jingle([12, 16, 19, 24], 0.08); } st.wasParty = partying;
    if (st.busyTill && t > st.busyTill) { st.busyTill = 0; sync(); jingle([7, 12, 16, 19, 24], 0.07); if (st.finale === 'rainbow') emo('🌈', st.scene.x + st.scene.w / 2, st.scene.y + st.scene.h * 0.4, { size: 54, vy: -22, vx: 0, life: 2 }); if (st.finale === 'circle') st.chatAt = t + 0.2; voice('m_wow'); }
    // the basket glides after a swipe
    let scrolling = false; for (const id in st.ptr) if (st.ptr[id].mode === 'scroll') scrolling = true;
    if (!scrolling && Math.abs(T.v) > 4) { T.scroll = clamp(T.scroll + T.v * dt, 0, T.max); T.v *= Math.exp(-dt * 4); if (T.scroll <= 0 || T.scroll >= T.max) T.v = 0; }
    T.peek *= Math.exp(-dt * 6);
    // stuffies being carried follow the finger and swing a little
    for (const id in st.ptr) { const p = st.ptr[id]; if (p.mode !== 'drag') continue; const it = p.it, k = Math.min(1, dt * 30), px = it.hx; it.hx += (p.x - it.hx) * k; it.hy += (p.y - 2 - it.hy) * k; it.sway += (clamp((it.hx - px) / Math.max(dt, 0.004) * 0.0011, -0.45, 0.45) - it.sway) * Math.min(1, dt * 10); }
    let n = 0;
    for (const it of st.items) {
      const f = it.fly;
      if (f) { f.t += dt; if (f.t >= f.dur) { it.fly = null; if (it.where === 'bed') { it.sq = 0.8; if (f.pop) { pop(); const p = toyScreen(it); spark(p[0], p[1] - it.h * st.s / 2, 5); } else thump(it); } else once('in', 50, () => blip(it.pitch, 'triangle', 0.05, 0.08)); } }
      const bed = it.where === 'bed' && !it.fly; if (bed) n++;
      if (bed) {
        if (it.py < 0 || it.vy !== 0) { it.vy += 560 * dt; it.py += it.vy * dt; if (it.py >= 0) { it.py = 0; if (it.vy > 50) { it.sq = Math.min(1, it.vy / 170); if (!partying) thump(it); it.vy = -it.vy * 0.34; it.py = -0.01; } else it.vy = 0; } }
        else if (it.py > 0) { it.py *= Math.exp(-dt * 16); if (it.py < 0.2) it.py = 0; }
        it.ox *= Math.exp(-dt * 14); if (Math.abs(it.ox) < 0.05) it.ox = 0;
        if (partying && it.py === 0 && it.vy === 0 && t > it.hopAt) { it.vy = -rnd(60, 105); it.py = -0.01; it.hopAt = t + rnd(0.2, 0.55); if (Math.random() < 0.25) it.turn = 1, it.flip = !it.flip; if (Math.random() < 0.3) { const p = toyScreen(it); emo(pick(['🎵', '🎶', '✨']), p[0], p[1] - it.h * st.s, { size: 16 }); } }
        if (it.strAt && t > it.strAt) { it.strAt = 0; it.str = 0.6; }
        if (it.str > 0) { it.str -= dt; if (it.str <= 0) { it.str = 0; it.vy = -75; it.py = -0.01; const p = toyScreen(it); spark(p[0], p[1] - it.h * st.s, 3); } }
        if (it.sl > 0.85 && t > it.zAt) { it.zAt = t + rnd(1.3, 2.4); const p = toyScreen(it); st.parts.push({ k: 'z', x: p[0] + it.w * st.s * 0.3, y: p[1] - it.h * st.s * 0.9, vx: rnd(6, 12), vy: -16, g: 0, life: 2.4, age: 0, size: rnd(13, 18) }); }
      }
      const want = bed && st.night && t >= it.slAt ? 1 : 0; it.sl += clamp(want - it.sl, -dt * 4, dt * 2.2);
      it.sq *= Math.exp(-dt * 9); it.wig *= Math.exp(-dt * 4.5); it.big += (it.press - it.big) * Math.min(1, dt * 18); it.turn = Math.max(0, it.turn - dt / 0.24);
    }
    // friends close to each other have a little chat now and then
    if (t > st.chatAt) {
      st.chatAt = t + rnd(3.5, 7);
      const L = st.night || partying ? [] : placed().filter(it => !it.fly);
      if (L.length > 1) { const a = pick(L), near = L.filter(o => o !== a && Math.hypot(wpos(o)[0] - wpos(a)[0], wpos(o)[1] - wpos(a)[1]) < 50); if (near.length) { const b = pick(near), c = pick(CHAT); bubble(a, c[0], 0); bubble(b, c[1], 0.95); } }
    }
    for (const b of st.bubbles) if (!b.hi && t >= b.t0) { b.hi = true; if (b.it.where === 'bed') { b.it.wig = Math.max(b.it.wig, 0.45); b.it.wt = t; squeak(b.it, true); } }
    st.bubbles = st.bubbles.filter(b => t < b.t0 + b.dur && b.it.where === 'bed');
    if (partying && Math.random() < dt * 22) confetti(1);
    for (const p of st.parts) { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt; if (p.k === 'c') p.vx += Math.sin(p.age * 6 + p.rot) * 40 * dt; }
    st.parts = st.parts.filter(p => p.age < p.life && p.y < st.ch + 20); if (st.parts.length > 300) st.parts.splice(0, st.parts.length - 300);
    st.n = n;
  }

  // ------------------------------------------------------------------ drawing
  function drawToy(it, sx, sy, k, mode) {
    const st = S, g = st.g, t = st.t, sp = sprite(it.ch), dw = it.w * k, dh = it.h * k, nk = mode === 'tray' ? 0 : st.nk, bed = mode === 'bed';
    let rot = Math.sin(t * 1.3 + it.id * 2.1) * 0.03 * (1 - it.sl), kx = 1, ky = 1 + 0.02 * Math.sin(t * (2.2 - it.sl * 1.2) + it.id * 1.7) * (1 + it.sl);
    if (it.wig > 0.02) rot += Math.sin((t - it.wt) * 26) * 0.34 * it.wig;
    if (bed && st.party > t) rot += Math.sin(t * 10 + it.id * 2) * 0.2;
    if (mode === 'held') rot -= it.sway;
    ky *= 1 - 0.24 * it.sq; kx *= 1 + 0.18 * it.sq;
    if (it.str > 0) { const q = Math.sin(Math.PI * (1 - it.str / 0.6)); ky *= 1 + 0.24 * q; kx *= 1 - 0.1 * q; }
    const b = 1 + 0.1 * it.big; let face = it.flip; if (it.turn > 0) { kx *= Math.abs(1 - 2 * it.turn) * 0.9 + 0.1; if (it.turn > 0.5) face = !face; }
    rot += it.sl * 0.1 * (it.id % 2 ? -1 : 1); ky *= 1 - 0.05 * it.sl;
    g.save(); g.translate(sx, sy); g.rotate(rot); g.scale(kx * b, ky * b);
    g.save(); if (face) g.scale(-1, 1); g.imageSmoothingEnabled = true; g.drawImage(sp.day, -dw / 2, -dh, dw, dh);
    if (nk > 0.01) { g.globalAlpha = nk; g.drawImage(sp.night, -dw / 2, -dh, dw, dh); g.globalAlpha = 1; }
    g.restore();
    if (bed && it.sl > 0.03) {                                                               // tucked in under a tiny blanket
      const c = BLANKETS[it.id % BLANKETS.length], bw = dw * 1.06 + 5, bh = Math.max(5, dh * 0.43) * it.sl, r = Math.min(6, bh / 2), x0 = -bw / 2, y0 = -bh, q = bw / 6;
      g.save(); g.beginPath(); g.moveTo(x0 + 1, 1.5); g.lineTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + r, y0 + 0.5);
      for (let i = 1; i <= 3; i++) g.quadraticCurveTo(x0 + (i * 2 - 1) * q, y0 - 2.2 + (i % 2) * 4.4, i < 3 ? x0 + i * 2 * q : x0 + bw - r, y0 + 0.5);    // a soft wavy edge
      g.quadraticCurveTo(x0 + bw, y0, x0 + bw, y0 + r); g.lineTo(x0 + bw - 1, 1.5); g.closePath(); g.clip();
      g.fillStyle = c[0]; g.fillRect(x0 - 1, y0 - 4, bw + 2, bh + 7); g.fillStyle = c[1]; g.fillRect(x0 - 1, y0 - 4, bw + 2, 4 + Math.min(4.5, bh * 0.34));
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x0 + bw * (0.22 + i * 0.28), y0 + bh * 0.68, 1.5, 0, 7); g.fill(); }
      if (nk > 0.01) { g.fillStyle = 'rgba(34,46,112,' + 0.5 * nk + ')'; g.fillRect(x0 - 1, y0 - 4, bw + 2, bh + 7); }
      g.restore();
    }
    g.restore();
  }
  function drawBed(it) {
    const st = S, g = st.g, p = wpos(it), sx = X(p[0] + it.ox), dw = it.w * st.s;
    g.fillStyle = 'rgba(50,34,70,.16)'; g.beginPath(); g.ellipse(sx, Y(p[1]) - 0.5, dw * 0.4, Math.max(1.5, st.s * 1.1), 0, 0, 7); g.fill();
    drawToy(it, sx, Y(p[1] + it.py), st.s, 'bed');
  }
  function draw() {
    const st = S, g = st.g, sc = st.scene, s = st.s, t = st.t, nk = st.nk, T = st.tray;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.clearRect(0, 0, st.cw, st.ch);
    const pix = L => { g.imageSmoothingEnabled = false; g.drawImage(L.day, sc.x, sc.y, L.day.width * s, L.day.height * s); if (nk > 0.01) { g.globalAlpha = nk; g.drawImage(L.night, sc.x, sc.y, L.night.width * s, L.night.height * s); g.globalAlpha = 1; } };
    g.save(); g.beginPath(); g.rect(sc.x, sc.y, sc.w, sc.h); g.clip();
    pix(st.bg);
    const L = order().filter(it => !it.fly); let i = 0;
    for (; i < L.length && L[i]._l < 3; i++) drawBed(L[i]);                                  // on the back rail, in the bottom bunk, in the top bunk…
    pix(st.front); pix(st.lad);                                                              // …behind the low rail and the ladder
    for (; i < L.length; i++) drawBed(L[i]);                                                 // on the rungs and on the floor
    // lights: fairy bulbs twinkle all day, and at night they and the heart night light glow
    g.globalCompositeOperation = 'lighter'; const party = st.party > t;
    for (const b of st.bulbs.L) { const a = (0.14 + 0.5 * nk) * (party ? 0.6 + 0.4 * Math.sin(t * 13 + b.ph * 3) : 0.78 + 0.22 * Math.sin(t * 2.1 + b.ph)), r = (7 + 6 * nk) * s; g.globalAlpha = clamp(a + (party ? 0.25 : 0), 0, 1); g.drawImage(st.glow.b[b.c], X(b.x + 1) - r, Y(b.y) - r, r * 2, r * 2); }
    const hl = nk * (0.62 + 0.08 * Math.sin(t * 1.6)) + st.nlPulse * 0.6;
    if (hl > 0.01) { const r = (40 + 10 * st.nlPulse) * s; g.globalAlpha = clamp(hl, 0, 1); g.drawImage(st.glow.pink, X(161.5) - r, Y(-33) - r, r * 2, r * 2); }
    if (nk > 0.01) { const r = 16 * s; g.globalAlpha = nk * 0.5; g.drawImage(st.glow.moon, X(WIN.x + 40) - r, Y(WIN.y + 12) - r, r * 2, r * 2); for (const c of CSTARS) { g.globalAlpha = nk * (0.35 + 0.2 * Math.sin(t * 1.3 + c[0])); g.drawImage(st.glow.warm, X(c[0] + 0.5) - 5 * s, Y(c[1] + 0.5) - 5 * s, 10 * s, 10 * s); } }
    if (st.flash > 0) { g.globalAlpha = st.flash * 0.5; const r = sc.h * 0.9; g.drawImage(st.glow.warm, X(WIN.x + WIN.w / 2) - r, Y(WIN.y + 20) - r, r * 2, r * 2); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.restore();
    // the toy basket
    g.imageSmoothingEnabled = false; g.drawImage(st.trayBg, T.x, T.y, T.w, T.h);
    g.save(); g.beginPath(); g.rect(T.x + 4, T.y + 4, T.w - 8, T.h - 8); g.clip();
    for (const it of st.items) {
      const p = slotXY(it.id); if (p[0] < T.x - T.slot || p[0] > T.x + T.w + T.slot || p[1] < T.y - T.slot || p[1] > T.y + T.h + T.slot) continue;
      g.fillStyle = 'rgba(185,138,78,.2)'; g.beginPath(); g.ellipse(p[0], p[1] + T.size * 0.45, T.size * 0.36, 4, 0, 0, 7); g.fill();
      if (it.where === 'tray' && !it.fly) drawToy(it, p[0], p[1] + T.size * 0.46 + Math.sin(t * 2 + it.id) * 0.8, T.k, 'tray');
    }
    if (T.max > 2) {                                                                         // little arrows: there are more this way
      const bob = Math.sin(t * 4) * 2, arrow = (x, y, dir) => { g.fillStyle = 'rgba(150,104,48,.85)'; g.beginPath(); if (T.vert) { g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.lineTo(x, y + 10 * dir); } else { g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.lineTo(x + 10 * dir, y); } g.closePath(); g.fill(); };
      const fade = (x, y, w, h, x1, y1) => { const gr = g.createLinearGradient(x, y, x1, y1); gr.addColorStop(0, 'rgba(255,243,218,0)'); gr.addColorStop(1, 'rgba(255,243,218,.95)'); g.fillStyle = gr; g.fillRect(Math.min(x, x1), Math.min(y, y1), w, h); };
      if (T.scroll < T.max - 2) { if (T.vert) { fade(T.x, T.y + T.h - 30, T.w, 30, T.x, T.y + T.h); arrow(T.x + T.w / 2, T.y + T.h - 16 + bob, 1); } else { fade(T.x + T.w - 30, T.y, 30, T.h, T.x + T.w, T.y); arrow(T.x + T.w - 16 + bob, T.y + T.h / 2, 1); } }
      if (T.scroll > 2) { if (T.vert) { fade(T.x, T.y + 30, T.w, 30, T.x, T.y); arrow(T.x + T.w / 2, T.y + 16 - bob, -1); } else { fade(T.x + 30, T.y, 30, T.h, T.x, T.y); arrow(T.x + 16 - bob, T.y + T.h / 2, -1); } }
    }
    g.restore();
    if (nk > 0.01) { g.fillStyle = 'rgba(30,36,92,' + 0.3 * nk + ')'; g.fillRect(T.x, T.y, T.w, T.h); }
    // where a carried stuffy will land
    for (const id in st.ptr) {
      const p = st.ptr[id]; if (p.mode !== 'drag') continue; const it = p.it;
      if (inTray(p.x, p.y)) { g.strokeStyle = 'rgba(255,207,74,.95)'; g.lineWidth = 5; g.strokeRect(T.x + 4.5, T.y + 4.5, T.w - 9, T.h - 9); continue; }
      const q = resolveDrop(it, WX(clamp(p.x, 0, st.cw)), WY(clamp(p.y - 2, 0, st.ch))), at = wposv(q.F.id, q.x, q.d, q.y, it.w);
      g.fillStyle = 'rgba(255,221,102,.6)'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X(at[0]), Y(at[1]), it.w * s * 0.46, Math.max(3, s * 1.8), 0, 0, 7); g.fill(); g.stroke();
    }
    // stuffies in the air: flying to their place, or in her hand
    for (const it of st.items) {
      const f = it.fly;
      if (f) { const k = easeIO(clamp(f.t / f.dur, 0, 1)), to = toyScreen(it), k1 = it.where === 'tray' ? T.k : s; drawToy(it, lerp(f.sx, to[0], k), lerp(f.sy, to[1], k) - f.arc * Math.sin(Math.PI * k), lerp(f.k0, k1, k), it.where === 'tray' ? 'tray' : 'air'); }
      else if (it.where === 'held') { g.fillStyle = 'rgba(50,34,70,.14)'; g.beginPath(); g.ellipse(it.hx, it.hy + 3, it.w * s * 0.4, 3, 0, 0, 7); g.fill(); drawToy(it, it.hx, it.hy, s * 1.15, 'held'); }
    }
    // speech bubbles
    for (const b of st.bubbles) {
      if (t < b.t0) continue; const a = t - b.t0, k = a < 0.18 ? easeOut(a / 0.18) : 1, fade = clamp((b.dur - a) / 0.25, 0, 1), p = toyScreen(b.it), w = 34, h = 28, bx = clamp(p[0] + (b.it.flip ? -9 : 9), w / 2 + 2, st.cw - w / 2 - 2), by = Math.max(h + 8, p[1] - b.it.h * s - 7);
      g.save(); g.globalAlpha = fade; g.translate(bx, by); g.scale(k, k); g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(70,50,100,.3)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-w / 2 + 8, -h); g.lineTo(w / 2 - 8, -h); g.quadraticCurveTo(w / 2, -h, w / 2, -h + 8); g.lineTo(w / 2, -12); g.quadraticCurveTo(w / 2, -4, w / 2 - 8, -4); g.lineTo(3, -4); g.lineTo(-2, 3); g.lineTo(-5, -4); g.lineTo(-w / 2 + 8, -4); g.quadraticCurveTo(-w / 2, -4, -w / 2, -12); g.lineTo(-w / 2, -h + 8); g.quadraticCurveTo(-w / 2, -h, -w / 2 + 8, -h); g.closePath(); g.fill(); g.stroke();
      g.font = '17px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(b.ch, 0, -h / 2 - 1.5); g.restore();
    }
    // hearts, notes, confetti, z's, sparkles
    for (const p of st.parts) {
      const a = clamp(Math.min(p.age / 0.12, (p.life - p.age) / 0.35), 0, 1); g.globalAlpha = a;
      if (p.k === 'e') { g.font = p.size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(p.ch, p.x, p.y); }
      else if (p.k === 'z') { const z = p.size * (0.7 + 0.5 * p.age / p.life); g.font = '700 ' + z + 'px "Lilita One","Trebuchet MS",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(30,36,90,.55)'; g.strokeText('z', p.x + Math.sin(p.age * 3) * 3, p.y); g.fillStyle = '#eaf0ff'; g.fillText('z', p.x + Math.sin(p.age * 3) * 3, p.y); }
      else if (p.k === 'c') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
      else { g.fillStyle = p.col; g.fillRect(p.x - p.size / 2, p.y - p.size * 1.5, p.size, p.size * 3); g.fillRect(p.x - p.size * 1.5, p.y - p.size / 2, p.size * 3, p.size); }
    }
    g.globalAlpha = 1;
    drawHint();
  }
  // nothing is out yet: a finger shows how to drag a stuffy from the basket onto the bed
  function drawHint() {
    const st = S, g = st.g, t = st.t; if (st.hintOff || st.n || Object.keys(st.ptr).length || (st.touched != null && t - st.touched < 5)) { st.hintT = t; return; }
    const it = st.items.find(o => o.where === 'tray' && !o.fly); if (!it) return;
    const k = ((t - st.hintT) % 3.4) / 3.4, a = slotXY(it.id), bx = X(70), by = Y(-26), m = easeIO(clamp((k - 0.18) / 0.5, 0, 1)), al = clamp(Math.min(k / 0.08, (0.95 - k) / 0.12), 0, 1);
    const x = lerp(a[0], bx, m), y = lerp(a[1] + st.tray.size * 0.4, by, m) - Math.sin(Math.PI * m) * 30;
    g.globalAlpha = al * 0.55; drawToy(it, x, y, lerp(st.tray.k, st.s, m), 'tray'); g.globalAlpha = al;
    g.font = '40px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText('👆', x + 12, y + 20 + (k < 0.18 ? Math.sin(k * 60) * 3 : 0)); g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ putting back what was saved
  function restore(rec) {
    const st = S; let i = 0;
    for (const a of rec.s.slice().sort((p, q) => (p[5] | 0) - (q[5] | 0))) {
      const it = st.items.find(o => o.ch === a[0]), F = st.surf[a[1]]; if (!it || it.where !== 'tray' || !F) continue;
      it.where = 'bed'; it.sid = F.id; it.x = F.band ? (+a[2] || 0) : clampX(F, +a[2] || 0, it); it.d = F.band ? (+a[3] || F.y0) : F.y; it.flip = !!a[4]; it.y = 9e5 - i++; it.sl = st.night ? 1 : 0;
    }
    for (const sid of SIDS) settle(sid);
    for (const it of st.items) it.py = 0;
    if (i) st.hintOff = true;
  }

  window.Stuffies = { open, close: () => finish(false), saved, count, surprise, get active() { return !!S; }, get _s() { return S; } };
})();
