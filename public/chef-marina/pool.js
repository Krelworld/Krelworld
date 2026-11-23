// Chef Marina — the swimming pool beside the front yard, seen from the side like a cut-away fish tank.
// Self-contained; load after everything else. Art: assets/pool/pool.png + pool.json (one sheet).
//   Pool.open({ onDone(result), with })   full-screen pool inside #panel. with: 'daddy' | 'rory' = who is already in the water.
//                                         result = { suit, swam, jumps, games }   (the towel button and the ❌ both end in onDone)
//   Pool.close()                          same as the ❌
//   Pool.suit()                           id of the swimsuit she last chose (localStorage 'cm_swimsuit'; the extras live in 'cm_swimsuit_x')
// First she picks a swimsuit (one set of sprites with a key-green suit, repainted here), then: big jumps off the board,
// swimming wherever the finger goes, toys, and Daddy or Uncle Rory to play with. Nothing can be failed. No words, no digits.
// One small pixel canvas scaled up (pointer events on the canvas: calm.js cancels taps on buttons when the finger moves);
// everything else is picture buttons.
(function () {
  'use strict';
  const DIR = 'assets/pool/', KEY = 'cm_swimsuit', KEYX = 'cm_swimsuit_x';
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0], ease = k => k * k * (3 - 2 * k), chance = p => Math.random() < p, sgn = v => (v < 0 ? -1 : 1);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  // ------------------------------------------------------------------ the pool (logical pixels; y = 0 is still water, up is negative)
  const WW = 400, X0 = 96, X1 = 372;               // world width, the pool's left and right walls
  const DECK = -9, BACK = DECK - 16;               // where feet stand on the deck; the far edge of the deck (the picture of the garden ends there)
  const SHAL = 46, DEEP = 100, SL0 = 150, SL1 = 214, STEPX = X1 - 30;   // shallow / deep floor, the slope between, where the steps begin
  const TIP = 128, BRD = -19, BRD0 = 56;           // diving board: its tip over the water, its top, its back end
  const BOT = 110;                                 // lowest thing ever shown
  const STAND0 = 200, STAND1 = STEPX - 10;         // where a grown-up can stand with his head out
  function floorAt(x) { if (x > STEPX) return Math.max(6, SHAL - 10 * Math.ceil((x - STEPX) / 7.5)); return lerp(DEEP, SHAL, ease(clamp((x - SL0) / (SL1 - SL0), 0, 1))); }

  // ------------------------------------------------------------------ pictures
  let ART = null, artP = null;
  function loadArt() {
    return artP || (artP = Promise.all([fetch(DIR + 'pool.json').then(r => r.json()), new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('pool.png')); i.src = DIR + 'pool.png'; })])
      .then(([j, img]) => (ART = { f: j.f, n: j.n, img })).catch(() => { artP = null; return null; }));
  }
  const NO = {};
  // draw a frame with its pivot (feet or middle, see pack.py) at x, y. o: flip, rot, sx, sy, a, cy (turn about a point cy above the pivot)
  function spr(g, key, x, y, o) {
    const r = ART && ART.f[key]; if (!r) return; o = o || NO;
    const src = key.charCodeAt(0) === 109 && key.charCodeAt(1) === 95 ? mframe(key) : null;      // "m_": Marina, repainted for her swimsuit
    g.save(); g.translate(Math.round(x), Math.round(y));
    if (o.rot) { if (o.cy) { g.translate(0, -o.cy); g.rotate(o.rot); g.translate(0, o.cy); } else g.rotate(o.rot); }
    if (o.flip || o.sx || o.sy) g.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    if (o.a != null) g.globalAlpha *= o.a;
    if (src) g.drawImage(src, r[4], r[5]); else g.drawImage(ART.img, r[0], r[1], r[2], r[3], r[4], r[5], r[2], r[3]);
    g.restore();
  }
  const fr = (base, t, fps) => base + '_' + (Math.floor(Math.max(0, t) * fps) % ((ART && ART.n[base]) || 1));
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const pat = (g, x, y, rows, map) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = map[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } } };

  // ------------------------------------------------------------------ swimsuits: one key-green suit in the art, painted over here
  const WHITE = [255, 255, 255], NAVY = [38, 58, 140], RED = [236, 56, 64], PINK = [255, 96, 164], YEL = [255, 214, 64], TEAL = [38, 198, 190], PURP = [160, 96, 232], GREY = [112, 142, 184];
  const RB = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#4fd05a', '#3fa7ff', '#a86bff'].map(hx), PASTEL = ['#ffb3c7', '#ffd9a0', '#fff3a6', '#b8f0c0', '#a9dcff', '#d6b8ff'].map(hx);
  // f(u, w, x, y): u = 0 at the neck .. 1 at the bottom of the suit, w = -1 .. 1 across it, x / y = pixel in the frame
  const SUITS = [
    { id: 'pink', cap: '#ffffff', f: () => PINK },
    { id: 'sun', cap: '#ff8a3c', f: (u, w, x, y) => ((x * 3 + y * 5) % 11 === 0 ? [255, 150, 40] : YEL) },
    { id: 'stripes', cap: '#e8404a', f: u => (Math.floor(u * 6.99) & 1 ? WHITE : NAVY) },
    { id: 'dots', cap: '#ffffff', f: (u, w, x, y) => (y % 4 === 0 && (x + (y >> 2 & 1) * 2) % 4 === 0 ? WHITE : RED) },
    { id: 'rainbow', cap: '#3fa7ff', f: u => RB[clamp(Math.floor(u * 6), 0, 5)] },
    { id: 'mermaid', cap: '#a060e8', f: (u, w, x, y) => { const b = mixc(TEAL, PURP, clamp(u * 1.5 - 0.35, 0, 1)), k = (x + ((y >> 1) & 1) * 2) % 4; return k === 0 && !(y & 1) ? mixc(b, WHITE, 0.55) : k === 2 && (y & 1) ? mixc(b, NAVY, 0.4) : b; } },
    { id: 'melon', cap: '#3bb54a', f: (u, w, x, y) => (u > 0.84 ? [52, 168, 70] : u > 0.72 ? [238, 250, 226] : (x + y * 2) % 5 === 0 && y % 3 === 0 ? [40, 30, 34] : [255, 92, 122]) },
    { id: 'shark', cap: '#708eb8', f: (u, w, x, y) => (u > 0.34 && u < 0.5 ? ((x + (u > 0.42 ? 1 : 0)) & 1 ? WHITE : [200, 44, 60]) : Math.abs(w) < 0.42 && u >= 0.5 ? [236, 242, 248] : GREY) },
    { id: 'unicorn', cap: '#d6b8ff', f: (u, w, x, y) => { const k = ((x + y) >> 1) % 8; return k < 6 && ((x + y) >> 1) % 2 === 0 ? PASTEL[k] : [250, 246, 255]; } },
    { id: 'stars', cap: '#ffd640', f: (u, w, x, y) => ((x * 7 + y * 13) % 17 === 0 ? [255, 226, 90] : (x * 5 + y * 3) % 23 === 0 ? WHITE : [52, 44, 130]) },
  ];
  const EXTRAS = ['gog', 'arm', 'cap', 'tail'];
  const LOOK = { suit: 'pink', x: {}, known: false };
  function readLook() {
    try { const s = localStorage.getItem(KEY); LOOK.known = SUITS.some(q => q.id === s); if (LOOK.known) LOOK.suit = s; let x = {}; try { x = JSON.parse(localStorage.getItem(KEYX) || '{}') || {}; } catch (e) { } LOOK.x = {}; for (const k of EXTRAS) LOOK.x[k] = !!x[k]; } catch (e) { }
    return LOOK;
  }
  function saveLook() { try { localStorage.setItem(KEY, LOOK.suit); localStorage.setItem(KEYX, JSON.stringify(LOOK.x)); LOOK.known = true; } catch (e) { } }
  const lookId = L => L.suit + (L.x.gog ? 'g' : '') + (L.x.arm ? 'a' : '') + (L.x.cap ? 'c' : '');
  const FC = new Map();
  function mframe(key, L) {                           // one of her frames in the chosen suit (painted once, then kept)
    L = L || LOOK; const id = key + '|' + lookId(L); let c = FC.get(id); if (c) return c;
    const r = ART.f[key]; if (!r) return null; c = document.createElement('canvas'); c.width = r[2]; c.height = r[3];
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(ART.img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    const im = g.getImageData(0, 0, r[2], r[3]); repaint(im.data, r[2], r[3], key, L); g.putImageData(im, 0, 0);
    if (FC.size > 900) FC.clear(); FC.set(id, c); return c;
  }
  const LYING = /^m_(swim|under|glide|mer|float)/;
  function repaint(d, W, H, key, L) {
    const suit = SUITS.find(s => s.id === L.suit) || SUITS[0], X = L.x, n = W * H, cls = new Uint8Array(n), val = new Float32Array(n), lying = LYING.test(key);
    let sx0 = W, sx1 = -1, sy0 = H, sy1 = -1, gx = 0, gy = 0, gn = 0, gx0 = W, gx1 = -1, gy0 = H, gy1 = -1, hx_ = 0, hy_ = 0, hn = 0;
    for (let i = 0; i < n; i++) {                     // what is each pixel: 1 suit, 2 glasses, 3 hair, 4 skin
      const p = i * 4; if (d[p + 3] < 20) continue; const r = d[p], g = d[p + 1], b = d[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn, s = mx ? df / mx : 0, v = mx / 255;
      let h = 0; if (df) { h = mx === r ? ((g - b) / df) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4; h *= 60; if (h < 0) h += 360; }
      const x = i % W, y = (i / W) | 0; val[i] = v;
      if (h > 85 && h < 142 && s > 0.5) { cls[i] = 1; if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
      else if (h > 244 && h < 296 && s > 0.3 && v > 0.3) { cls[i] = 2; gx += x; gy += y; gn++; if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gy1) gy1 = y; }
      else if ((h < 32 || h > 350) && s >= 0.55 && v > 0.3) { cls[i] = 3; hx_ += x; hy_ += y; hn++; }
      else if (h > 8 && h < 36 && s < 0.5 && v > 0.7) cls[i] = 4;
    }
    const hcx = gn > 3 ? gx / gn : hn ? hx_ / hn : W / 2, hcy = gn > 3 ? gy / gn : hn ? hy_ / hn : H / 2, sw = Math.max(1, sx1 - sx0), sh = Math.max(1, sy1 - sy0);
    const put = (i, c, k) => { const p = i * 4; d[p] = clamp(c[0] * k, 0, 255); d[p + 1] = clamp(c[1] * k, 0, 255); d[p + 2] = clamp(c[2] * k, 0, 255); };
    const U = (x, y) => (lying ? 1 - (x - sx0) / sw : (y - sy0) / sh);
    const capC = hx(suit.cap || '#ffffff'), gogC = [255, 138, 28];
    for (let i = 0; i < n; i++) {
      const c = cls[i]; if (!c) continue; const x = i % W, y = (i / W) | 0, v = val[i];
      if (c === 1) put(i, suit.f(U(x, y), lying ? (y - sy0) / sh * 2 - 1 : (x - sx0) / sw * 2 - 1, x, y), clamp(v / 0.86, 0.26, 1.08));
      else if (c === 2 && X.gog) put(i, gogC, clamp(v / 0.72, 0.4, 1.1));
      else if (c === 3 && X.cap && Math.hypot(x - hcx, y - hcy) < 12.5) put(i, capC, clamp(v / 0.87, 0.3, 1) * (v < 0.5 ? 0.75 : 1));
      else if (c === 4 && X.arm && sx1 >= 0 && Math.hypot(x - hcx, y - hcy) > 10.5) {          // arm floaties: the bit of bare arm next to her shoulders
        let near = false;
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || cls[yy * W + xx] !== 1) continue; const u = U(xx, yy); if (u < 0.4 && u > -0.01) { near = true; break; } }
        if (near) put(i, (x + y) % 4 < 2 ? [255, 150, 30] : [255, 208, 60], clamp(v / 0.96, 0.6, 1));
      }
    }
    if (X.gog && gn > 3) for (let y = gy0; y <= gy1; y++) {       // goggles: the lenses turn sea-blue
      let a = -1, b = -1; for (let x = gx0; x <= gx1; x++) if (cls[y * W + x] === 2) { if (a < 0) a = x; b = x; }
      for (let x = a + 1; x < b; x++) { const i = y * W + x, p = i * 4; if (cls[i] === 2 || d[p + 3] < 20 || val[i] < 0.2) continue; d[p] = d[p] * 0.4 + 70; d[p + 1] = d[p + 1] * 0.4 + 138; d[p + 2] = d[p + 2] * 0.4 + 153; }
    }
  }

  // ------------------------------------------------------------------ voices: only clips that really exist (new ones start working once recorded)
  let VO = null;
  function voIndex() { if (VO) return; VO = {}; fetch('assets/vo_index.json').then(r => r.json()).then(j => { VO = j || {}; }).catch(() => { }); }
  function line(key) {                                // -> true if the clip exists and was asked for
    if (!VO || !VO[key]) return false;
    try { if (typeof say === 'function') say(key); else Audio2.voice(key); } catch (e) { }
    return true;
  }
  const who = () => (S && S.A ? S.A.id[0] : 'd');     // 'd' or 'r': whose lines to use

  // ------------------------------------------------------------------ sound: splashes are shaped noise, bubbles are rising blips, everything dulls underwater
  let muted = false, bus = null, nbuf = null;
  try { const tm = Audio2.toggleMute; Audio2.toggleMute = function () { muted = tm.apply(this, arguments); if (bus) bus.out.gain.value = muted ? 0 : 0.8; return muted; }; } catch (e) { }
  function sb() {
    let ac = null; try { ac = Audio2.ctx; } catch (e) { } if (!ac) return null;
    if (!bus || bus.ac !== ac) {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000; const out = ac.createGain(); out.gain.value = muted ? 0 : 0.8; lp.connect(out); out.connect(ac.destination); bus = { ac, lp, out };
      nbuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate); const dd = nbuf.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    }
    return bus;
  }
  function tone(type, f0, f1, dur, vol, when) {
    const b = sb(); if (!b) return; const ac = b.ac, t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(b.lp); o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(dur, vol, f0, f1, q, when, kind) {
    const b = sb(); if (!b) return; const ac = b.ac, t = ac.currentTime + (when || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = kind || 'bandpass'; f.Q.value = q || 0.8; f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(b.lp); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const SND = {
    splash(s) {                                       // s: 0.15 a plip .. 1.6 the rocket landing
      hiss(0.25 + s * 0.75, Math.min(0.9, 0.25 + s * 0.45), 5200, 500, 0.5); hiss(0.5 + s * 0.9, 0.22 + s * 0.2, 1800, 260, 0.7, 0.05, 'lowpass');
      if (s > 0.45) { tone('sine', 300, 62, 0.34 + s * 0.2, Math.min(0.9, 0.35 + s * 0.3)); tone('triangle', 170, 48, 0.5 + s * 0.2, 0.3, 0.03); }      // the deep "ploom"
      for (let i = 0, n = 2 + s * 7; i < n; i++) tone('sine', rnd(900, 2400), rnd(1500, 3600), 0.05, 0.07, 0.3 + s * 0.4 + Math.random() * (0.5 + s * 0.6));   // drops raining back
    },
    plip(v) { tone('sine', rnd(700, 1200), rnd(1500, 2600), 0.06, v || 0.1); },
    bub(n) { for (let i = 0; i < (n || 1); i++) tone('sine', rnd(300, 520), rnd(800, 1500), rnd(0.05, 0.09), 0.1, i * rnd(0.04, 0.08)); },
    stroke() { hiss(0.2, 0.09, 1500, 700, 0.9); },
    boing(p) { tone('triangle', 150 + p * 70, 95 + p * 40, 0.3, 0.42); tone('sine', 300 + p * 140, 190 + p * 80, 0.24, 0.2); },
    step() { hiss(0.05, 0.1, 900, 500, 1.2); },
    slap() { hiss(0.16, 0.8, 2400, 900, 0.6); tone('square', 190, 80, 0.12, 0.25); },
    squirt() { hiss(0.35, 0.28, 2600, 5200, 3); tone('sine', 500, 1400, 0.3, 0.08); },
    spout() { hiss(0.6, 0.25, 1500, 3800, 2); tone('sine', 220, 520, 0.5, 0.1); },
    whee() { tone('sine', 620, 1500, 0.4, 0.14); tone('triangle', 630, 1520, 0.4, 0.05); },
    count(i) { tone('square', [262, 330, 392][i] || 523, 0, 0.16, 0.13); tone('sine', ([262, 330, 392][i] || 523) * 2, 0, 0.2, 0.1); },
    go() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.14, 0.12, i * 0.07)); },
    call(hi) { const f = hi ? [988, 784] : [330, 262]; tone(hi ? 'sine' : 'triangle', f[0], f[0] * 0.98, 0.26, hi ? 0.22 : 0.3); tone(hi ? 'sine' : 'triangle', f[1], f[1] * 0.94, 0.4, hi ? 0.22 : 0.3, 0.27); },   // "Mar-co" low, "Po-lo" high
    shark() { [0, 1, 0, 1, 0, 1].forEach((k, i) => tone('sawtooth', k ? 175 : 165, 0, 0.16, 0.14, i * 0.2)); },
    brr() { for (let i = 0; i < 9; i++) tone('square', 1500, 0, 0.025, 0.07, i * 0.07); },
    chime() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('sine', f, 0, 0.6, 0.12, i * 0.09)); },
    sparkle() { tone('sine', rnd(1800, 2800), 0, 0.12, 0.05); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0, 0.16, 0.1, i * 0.08)); },
    oops() { tone('triangle', 420, 180, 0.3, 0.2); },
    under(on) { const b = sb(); if (!b) return; b.lp.frequency.setTargetAtTime(on ? 620 : 16000, b.ac.currentTime, 0.06);
      try { const c = Audio2.Music.cur; if (c && c.g) c.g.gain.setTargetAtTime(on ? 0.22 : 0.8, b.ac.currentTime, 0.08); } catch (e) { } },     // the music goes far away while her head is under
  };
  const jingle = (n, step, type) => { try { Audio2.jingle(n, step, type); } catch (e) { } };

  let S = null;                                       // everything about the open pool (null = closed)

  // ------------------------------------------------------------------ the water surface: a row of little springs that every splash disturbs
  const NW = 139, WDX = (X1 - X0) / (NW - 1);
  function waveStep(dt) {
    const h = S.wh, v = S.wv;
    for (let k = 0; k < 2; k++) {
      const d = dt / 2;
      for (let i = 0; i < NW; i++) { const l = h[i ? i - 1 : 0], r = h[i < NW - 1 ? i + 1 : i]; v[i] += (-26 * h[i] + 820 * (l + r - 2 * h[i]) - 1.5 * v[i]) * d; }
      for (let i = 0; i < NW; i++) h[i] = clamp(h[i] + v[i] * d, -22, 22);
    }
  }
  function surf(x) {                                  // where the surface is at x
    const f = clamp((x - X0) / WDX, 0, NW - 1), i = f | 0, h = S.wh[i] + (S.wh[Math.min(NW - 1, i + 1)] - S.wh[i]) * (f - i), t = S.t;
    return -(h + 0.7 * Math.sin(x * 0.07 + t * 1.6) + 0.45 * Math.sin(x * 0.16 - t * 2.3) + S.swell * Math.sin(x * 0.045 - t * 4.2));
  }
  function poke(x, p, w) { w = w || 8; const c = (x - X0) / WDX, n = Math.ceil(w * 2.5 / WDX); for (let i = Math.max(0, Math.floor(c - n)); i <= Math.min(NW - 1, Math.ceil(c + n)); i++) { const d = (i - c) * WDX / w; S.wv[i] -= p * Math.exp(-d * d); } }
  const inPool = x => x > X0 && x < X1;

  // drops in the air (k 0), bubbles (1), sparkles (2), foam on the surface (3)
  const DROPC = ['#ffffff', '#e4fbff', '#bdf0fa', '#9fe6f5'], SPARKC = ['#ffffff', '#fff3a0', '#ffc8f0', '#a8f4ff'];
  function drop(x, y, vx, vy, o) { if (S.P.length < 800) S.P.push(Object.assign({ k: 0, x, y, vx, vy, age: 0, life: 4, r: chance(0.3) ? 2 : 1, c: pick(DROPC) }, o)); }
  function bubble(x, y, o) { if (S.P.length < 800) S.P.push(Object.assign({ k: 1, x, y, vx: rnd(-6, 6), vy: rnd(-55, -25), age: 0, life: 5, r: chance(0.25) ? 2 : 1, ph: rnd(0, 6) }, o)); }
  function spark(x, y, c) { if (S.P.length < 800) S.P.push({ k: 2, x, y, vx: rnd(-10, 10), vy: rnd(-14, 6), age: 0, life: rnd(0.5, 1.1), c: c || pick(SPARKC) }); }
  function foam(x, vx) { if (S.P.length < 800) S.P.push({ k: 3, x, y: 0, vx, vy: 0, age: 0, life: rnd(0.8, 1.7), r: rnd(2, 5) | 0 }); }
  function partStep(dt) {
    const P = S.P;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; let dead = p.age > p.life;
      if (p.k === 0) {
        p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vy > 0) { if (inPool(p.x)) { if (p.y > surf(p.x)) { dead = true; if (p.r > 1 || chance(0.3)) poke(p.x, 3, 3); } } else if (p.y > DECK - 2) { dead = true; if (chance(0.3) && S.wet.length < 90) S.wet.push({ x: p.x, y: DECK - rnd(0, 9), t: S.t, w: 2 }); } }
      } else if (p.k === 1) {
        p.x = clamp(p.x + (p.vx + Math.sin(S.t * 7 + p.ph) * 8) * dt, X0 + 1, X1 - 1); p.y += p.vy * dt; if (p.y < surf(p.x) + 1) { dead = true; if (p.r > 1) poke(p.x, -2, 3); }
      } else if (p.k === 2) { p.x += p.vx * dt; p.y += p.vy * dt; }
      else { p.x += p.vx * dt; p.vx *= 1 - Math.min(1, dt * 1.5); if (!inPool(p.x)) dead = true; }
      if (dead) { P[i] = P[P.length - 1]; P.pop(); }
    }
  }
  // a splash of size s: 0.15 a toe .. 1 a cannonball .. 1.6 a rocket landing or a grown-up
  function splash(x, s, o) {
    o = o || NO; x = clamp(x, X0 + 3, X1 - 3); const y = surf(x), wide = o.wide || 1;
    poke(x, 150 * s, (7 + 9 * s) * wide);
    for (let i = 0, n = 16 + 95 * s; i < n; i++) { const a = rnd(-1, 1), sp = rnd(0.35, 1); drop(x + a * (5 + 8 * s) * wide, y - 1, a * (34 + 90 * s) * wide * sp + rnd(-12, 12), -(95 + 205 * s) * sp * rnd(0.6, 1.1)); }
    for (const t of S.toys) if (t.st === 'float' && !t.held && Math.abs(t.x - x) < 30 + 50 * s) { t.vx += sgn(t.x - x || 1) * (20 + 70 * s) * (1 - Math.abs(t.x - x) / (30 + 50 * s)); if (!t.rider) t.vy -= 30 * s; }      // floats get shoved aside
    if (s > 0.3) { S.FX.push({ k: 'crown', x, s, w: wide, t: 0 }); for (let i = 0, n = 4 + 8 * s; i < n; i++) foam(x + rnd(-6, 6), rnd(20, 70) * (i & 1 ? 1 : -1) * (0.6 + s * 0.5)); }
    if (!o.quiet) SND.splash(s);
    S.cam.sh = Math.max(S.cam.sh, 5 * s); S.cam.kick = Math.max(S.cam.kick, 4 * s);
    if (s >= 0.9) for (let i = 0, n = 5 + 9 * (s - 0.8); i < n; i++) S.lens.push({ x: Math.random(), y: rnd(0.02, 0.8), r: rnd(2, 5), t: S.t + rnd(0.1, 0.5), life: rnd(2, 4.5), vy: rnd(0.01, 0.05) });
    if (!o.dry) for (let i = 0, n = 6 + 26 * s; i < n; i++) bubble(x + rnd(-8, 8) * (0.5 + s), y + rnd(4, 14 + 30 * s), { vy: rnd(-70, -25) });
    soak(x, s, o.by);
  }
  function soak(x, s, by) {                           // whoever is near a big splash gets it in the face
    const A = S.A;
    if (A && by !== A && A.wet && Math.abs(A.x - x) < 30 + 46 * s && s > 0.5) { A.soak = S.t + 1.3; for (let i = 0; i < 10; i++) drop(A.x + rnd(-10, 10), A.top() + rnd(0, 16), rnd(-30, 30), rnd(-60, -10)); }
    if (by !== S.M && S.M.wet && Math.abs(S.M.x - x) < 26 + 40 * s && s > 0.7) S.M.soak = S.t + 1;
    if (s >= 0.9 && Math.abs(CAT.x - x) < 70 + 50 * s && S.cat.st === 0) { S.cat.st = 1; S.cat.t = 0; for (let i = 0; i < 8; i++) drop(CAT.x + rnd(-8, 8), CAT.y - rnd(10, 30), rnd(-20, 20), rnd(-40, 0)); }
    if (s > 0.6) S.fly.scare = S.t + 2;
  }
  const CAT = { x: 238, y: BACK - 34 };               // the cat's seat on top of the fence

  // little picture bubbles over somebody's head (DOM, so the emoji stay crisp). ent: { x, top() }
  function bub(ent, txt, sec, cls) {
    if (!S) return null; for (const b of S.bubs) if (b.ent === ent) b.until = 0;
    const el = mk('div', 'pl-bub' + (cls ? ' ' + cls : ''), txt); S.stage.append(el); const b = { el, ent, until: S.t + (sec || 1.8) }; S.bubs.push(b); placeBub(b); return b;
  }
  function placeBub(b) { const V = S.V, r = S.stageR || { width: 1, height: 1 }, x = (b.ent.x - S.cam.x) / V.w * r.width, y = ((b.ent.top ? b.ent.top() : b.ent.y) - 4 - S.cam.y) / V.h * r.height; b.el.style.left = clamp(x, 34, r.width - 34) + 'px'; b.el.style.top = clamp(y, 40, r.height - 4) + 'px'; }
  function bubStep() { for (let i = S.bubs.length - 1; i >= 0; i--) { const b = S.bubs[i]; if (S.t > b.until) { b.el.remove(); S.bubs.splice(i, 1); } else placeBub(b); } }
  const STARS = n => '⭐'.repeat(n);

  function camStep(dt) {
    const c = S.cam, V = S.V, M = S.M, A = S.A; let fx = M.x + M.dir * 10, top = M.y - 46;
    if (A && (A.st === 'enter' || A.st === 'air' || (S.game && S.game.both))) { fx = M.x * 0.5 + A.x * 0.5; top = Math.min(top, A.top() - 4); }
    else if (A && A.wet && Math.abs(A.x - M.x) < V.w * 0.7) fx = M.x * 0.75 + A.x * 0.25;
    if (S.look && S.t < S.look.until) { fx = S.look.x; if (S.look.top != null) top = Math.min(top, S.look.top); }
    const tx = clamp(fx - V.w / 2, 0, Math.max(0, WW - V.w)), ty = Math.min(BOT - V.h, top - 12);
    if (c.x == null) { c.x = tx; c.y = ty; }
    c.x += (tx - c.x) * Math.min(1, dt * 3.2); c.y += (ty - c.y) * Math.min(1, dt * (ty < c.y ? 7 : 2.6));
    c.sh *= Math.exp(-dt * 5); c.kick *= Math.exp(-dt * 7);
    c.ox = (Math.random() - 0.5) * c.sh; c.oy = (Math.random() - 0.5) * c.sh + c.kick * Math.sin(S.t * 38);
  }

  // ------------------------------------------------------------------ Marina. x, y = the middle of her body (her feet are 28 below when she is upright)
  // st: deck | run | bounce | air | plunge | cheer | swim | hand | flip | float | held (a game moves her) | climb | out | towel
  const GRAV = 330;
  const JUMPS = {                                     // s = how big the splash, vy / vx = the push off the board
    cannon: { s: 1, pose: 'm_tuck', vy: 232, vx: 50 }, pencil: { s: 0.36, pose: 'm_pencil', vy: 218, vx: 42 }, star: { s: 0.7, pose: 'm_star', vy: 236, vx: 50 },
    flip: { s: 0.8, pose: 'm_tuck', spin: 2, vy: 252, vx: 48 }, belly: { s: 0.9, pose: 'm_star', flat: 1, vy: 204, vx: 60 }, super: { s: 1.3, pose: 'm_leap', then: 'm_tuck', vy: 300, vx: 92, far: 1 },
    hop: { s: 0.42, pose: 'm_leap', vy: 150, vx: 60 }, dive: { s: 0.42, pose: 'm_glide', nose: 1, vy: 170, vx: 74 }, rocket: { s: 1.5, pose: 'm_star', then: 'm_tuck', spin: 1, vy: 430, vx: 34 }, tip: { s: 0.5, pose: 'm_star', spin: 0.75, vy: 120, vx: 30 },
  };
  const JUMPLIST = ['cannon', 'pencil', 'star', 'flip', 'belly', 'super'];
  function newMarina() { return { x: 30, y: DECK - 28, vx: 0, vy: 0, dir: 1, st: 'deck', t: 0, at: 0, rot: 0, tx: null, ty: 0, wet: false, under: false, plan: null, idle: 0, strokeT: 0, bubT: 0, trick: 0, soak: 0, drip: 0, stepT: 0, top() { return this.y - (this.st === 'swim' && this.under ? 14 : 30); } }; }
  const onDeck = M => M.st === 'deck' || M.st === 'run' || M.st === 'bounce';
  const plankY = x => BRD + S.bend * Math.pow(clamp((x - 80) / (TIP - 80), 0, 1.1), 2);
  const boardY = x => (x < BRD0 ? DECK : x < BRD0 + 8 ? lerp(DECK, BRD, (x - BRD0) / 8) : plankY(x));      // two steps up at the back of the board
  function setSt(M, st) { M.st = st; M.t = 0; }
  function runTo(M, x, sp, then) { M.goX = x; M.sp = sp || 100; M.arr = then || null; setSt(M, 'run'); }
  function dropThings(M) {                            // let go of whatever she is holding or sitting on
    if (M.seat) { M.seat.rider = null; M.seat = null; } if (M.noodle) { M.noodle.held = null; M.noodle = null; } if (M.gun) { M.gun.held = null; M.gun = null; } if (M.fin) { M.fin.held = null; M.fin = null; }
  }
  function startJump(kind) {
    const M = S.M; if (!JUMPS[kind] || S.leaving || ['air', 'bounce', 'plunge', 'climb', 'out', 'towel'].includes(M.st) || (M.st === 'run' && M.jump)) return false;
    endGame(); dropThings(M); S.wantGame = null; M.jump = kind;
    if (M.st === 'deck' || M.st === 'run') toBoard(M); else { M.plan = { out: 1 }; M.tx = X0 + 9; M.ty = 0; setSt(M, 'swim'); }
    return true;
  }
  function toBoard(M) {
    const J = JUMPS[M.jump], go = () => runTo(M, TIP - 4, J.far ? 178 : 108, () => { setSt(M, 'bounce'); SND.boing(0); });
    if (J.far && M.x > 14) runTo(M, 8, 130, go); else go();        // the super jump takes a long run-up
  }
  function launch(M, kind, p, dir) {
    const J = JUMPS[kind]; M.dir = dir || M.dir; M.vx = (J.vx + 10 * p) * M.dir; M.vy = -(J.vy + 70 * p);
    M.air = { kind, J, s: J.s + 0.2 * p, tau: 0, T: (-M.vy + Math.sqrt(M.vy * M.vy + 2 * GRAV * Math.max(1, -M.y))) / GRAV };
    dropThings(M); setSt(M, 'air'); M.plan = null; M.tx = null; M.jump = null; S.twang = S.t; S.jumps++;
    try { Audio2.whoosh(true); } catch (e) { }
    if (kind === 'cannon' && chance(0.6)) line('m_cannonball'); else if (kind === 'flip' && chance(0.3)) line('m_flip'); else if ((kind === 'super' || kind === 'rocket') && !line('m_whee')) SND.whee();
  }
  function enterWater(M) {
    const a = M.air; splash(M.x, a.s, { by: M, wide: a.J.flat ? 1.6 : 1 }); if (a.J.flat) SND.slap();
    M.vy = Math.min(M.vy, 300) * (a.J.flat ? 0.18 : a.kind === 'pencil' || a.J.nose ? 0.8 : 0.5); M.vx *= 0.35; M.pose = a.J.then || a.J.pose; M.big = a.s; M.flat = !!a.J.flat;
    if (LOOK.x.tail && !M.wet) for (let i = 0; i < 16; i++) spark(M.x + rnd(-12, 12), surf(M.x) + rnd(0, 26));
    M.wet = true; M.drip = 0; S.swam = true; setSt(M, 'plunge');
  }
  function judge(n, sec) { const A = S.A; if (A && A.wet && (A.st === 'idle' || A.st === 'game')) A.judge = { at: S.t + (sec || 0.5), n }; }
  function swimTo(M, x, y, plan) { if (M.st === 'float') leaveSeat(M, false); if (M.st !== 'swim') return false; M.tx = clamp(x, X0 + 8, X1 - 8); M.ty = y; M.plan = plan || null; M.idle = 0; return true; }
  function leaveSeat(M, tipped) {
    const toy = M.seat; if (!toy) return; toy.rider = null; M.seat = null;
    if (tipped) { toy.flip = S.t; toy.vx += rnd(-30, 30); M.dir = chance(0.5) ? 1 : -1; M.y = surf(toy.x) - 16; launch(M, 'tip', 0); S.jumps--; SND.oops(); }
    else { M.y = surf(M.x) - 1; setSt(M, 'swim'); splash(M.x, 0.22, { by: M, dry: 1 }); }
  }
  function marinaStep(dt) {
    const M = S.M, sy = surf(clamp(M.x, X0, X1)); M.t += dt; M.at += dt; if (M.drip > 0) M.drip -= dt;
    switch (M.st) {
      case 'deck': M.y = boardY(M.x) - 28; M.vx = M.vy = 0; M.rot = 0; break;
      case 'run': {
        const d = M.goX - M.x, sp = M.sp; M.dir = sgn(d);
        if (Math.abs(d) <= sp * dt) { M.x = M.goX; const f = M.arr; M.arr = null; setSt(M, 'deck'); M.dir = 1; if (f) f(); } else M.x += sgn(d) * sp * dt;
        M.y = boardY(M.x) - 28; M.stepT -= dt;
        if (M.stepT <= 0) { M.stepT = 16 / sp; SND.step(); if (M.drip > 0 && S.wet.length < 90) S.wet.push({ x: M.x, y: boardY(M.x) - 1, t: S.t, w: 3 }); if (sp > 150) for (let i = 0; i < 2; i++) S.P.push({ k: 2, x: M.x - M.dir * 6, y: M.y + 27, vx: -M.dir * rnd(10, 30), vy: rnd(-14, -2), age: 0, life: 0.4, c: '#e9edf2' }); }
        break; }
      case 'bounce': {                                // on the tip of the board: one bounce, or more and higher while the button is held
        const T = 0.4, k = (M.t % T) / T, n = Math.floor(M.t / T), p = Math.min(1, n / 3), J = JUMPS[M.jump] || JUMPS.cannon;
        S.bend = (4 + 5 * p + (J.far ? 3 : 0)) * Math.sin(Math.PI * k); M.y = boardY(M.x) - 28 - (k > 0.75 ? (k - 0.75) * 8 * (1 + p) : 0); M.sq = Math.sin(Math.PI * k);
        if (Math.floor((M.t - dt) / T) < n) { if (S.hold === M.jump && n < 4) SND.boing(p); else { S.bend = 0; M.sq = 0; launch(M, M.jump || 'cannon', Math.min(1, (n - 1) / 3), 1); } }
        break; }
      case 'air': {
        const a = M.air, d = dt * (Math.abs(M.vy) < 62 ? 0.5 : 1); a.tau += d; M.vy += GRAV * d; M.x += M.vx * d; M.y += M.vy * d;      // slow at the top of the arc
        if (M.x > X1 - 14) { M.x = X1 - 14; M.vx = 0; } if (M.x < X0 + 12 && M.vy > 0) { M.x = X0 + 12; M.vx = 0; }
        const k = clamp(a.tau / a.T, 0, 1);
        M.rot = a.J.spin ? TAU * a.J.spin * k * M.dir : a.J.flat ? Math.PI / 2 * ease(clamp(k * 1.7, 0, 1)) * M.dir : a.J.nose ? Math.atan2(M.vy, Math.abs(M.vx)) * M.dir : 0;
        M.pose = a.J.then && M.vy > -40 ? a.J.then : k < 0.08 && !a.J.nose ? 'm_y' : a.J.pose;
        if ((a.kind === 'super' || a.kind === 'rocket') && chance(0.5)) spark(M.x + rnd(-8, 8), M.y + rnd(-8, 14));
        if (M.vy > 0 && M.y + 10 > sy) enterWater(M);
        break; }
      case 'plunge': {                                // under the water after a jump: bubbles everywhere, then up for air
        M.vy -= (M.vy * 3.4 + 150 * Math.min(1, M.t * 2.2)) * dt; M.vx *= 1 - Math.min(1, dt * 3); M.x = clamp(M.x + M.vx * dt, X0 + 9, X1 - 9); M.y += M.vy * dt;
        const fl = floorAt(M.x) - 11; if (M.y > fl) { M.y = fl; if (M.vy > 0) M.vy = -M.vy * 0.25; }
        M.under = true; M.rot *= 1 - Math.min(1, dt * 5);
        if (M.t < 0.9) for (let i = 0; i < 2; i++) if (chance(0.7)) bubble(M.x + rnd(-9, 9), M.y + rnd(-12, 12));
        if (M.t > 0.45 && M.y <= sy + 6) { M.under = false; setSt(M, 'cheer'); M.y = sy + 4; splash(M.x, 0.2, { by: M, dry: 1, quiet: 1 }); SND.plip(0.2); const s = M.big || 0.5;
          if (M.flat) bub(M, '😵', 1.2); else if (chance(0.45)) line(pick(['m_yay', 'm_again', 'm_did_it', 'm_wow']));
          judge(clamp(Math.round(2.5 + s * 2 + rnd(-0.4, 0.4)), 3, 5), 0.7); }
        break; }
      case 'cheer': {                                 // head out: shake the water from her hair, then cheer
        M.y += (sy - 4 - M.y) * Math.min(1, dt * 8); M.vx = M.vy = 0; M.rot = 0;
        if (M.t < 0.6 && chance(0.6)) drop(M.x + rnd(-8, 8), M.y - 22 + rnd(-5, 5), rnd(-70, 70), rnd(-60, -10), { r: 1 });
        if (M.t > 1.5) { setSt(M, 'swim'); M.idle = 0; if (M.after) { const f = M.after; M.after = null; f(); } }
        break; }
      case 'swim': swimStep(M, dt, sy); break;
      case 'hand': {                                  // a handstand on the bottom: legs waving in the water (or out of it, in the shallow end)
        const fl = floorAt(M.x); M.y += (fl - 36 - M.y) * Math.min(1, dt * 6); M.under = true; if (chance(0.12)) bubble(M.x + rnd(-4, 4), fl - 14);
        if (fl < 58 && chance(0.1)) poke(M.x, 6, 4);
        if (M.t > 2.8) { setSt(M, 'swim'); M.idle = 1.6; }
        break; }
      case 'flip': {                                  // a mermaid flip: once right round
        const k = M.t / 0.85; M.rot = TAU * ease(Math.min(1, k)) * M.dir; if (chance(0.5)) (LOOK.x.tail ? spark : bubble)(M.x + rnd(-14, 14), M.y + rnd(-14, 14));
        if (k >= 1) { M.rot = 0; setSt(M, 'swim'); M.idle = 0.8; }
        break; }
      case 'float': {                                 // lazing on the unicorn or in the doughnut
        const toy = M.seat; if (!toy) { setSt(M, 'swim'); break; } M.x = toy.x; M.y = toy.y - (toy.k === 'unicorn' ? 8 : 12); M.dir = toy.k === 'unicorn' ? -1 : 1; M.under = false;
        if (M.t > 2.5 && Math.floor(M.t / 4) > Math.floor((M.t - dt) / 4) && chance(0.6)) bub(M, pick(['😎', '💤', '☀️', '🎶']), 1.6);
        break; }
      case 'climb': {                                 // out of the water at the ladder by the board
        const k = Math.min(1, M.t / 0.6); M.x = lerp(X0 + 6, X0 - 9, ease(k)); M.y = lerp(sy - 2, DECK - 28, ease(Math.min(1, k * 1.3))); M.dir = -1; M.under = false;
        if (k >= 1) { M.wet = false; M.drip = 7; M.dir = 1; setSt(M, 'deck'); SND.under(false); for (let i = 0; i < 10; i++) drop(M.x + rnd(-8, 8), M.y + rnd(-10, 20), rnd(-20, 20), rnd(-30, 20), { r: 1 }); if (M.jump) toBoard(M); }
        break; }
      case 'out': {                                   // up the steps at the shallow end
        const k = Math.min(1, M.t / 1.3); M.x = lerp(STEPX + 2, X1 + 12, k); M.y = lerp(sy - 2, DECK - 28, Math.min(1, k * 1.25)); M.dir = 1; M.under = false;
        if (Math.floor(M.t / 0.2) > Math.floor((M.t - dt) / 0.2)) { SND.step(); if (k < 0.7) poke(M.x, 10, 4); }
        if (k >= 1) { M.wet = false; setSt(M, 'towel'); jingle([0, 4, 7], 0.07, 'triangle'); }
        break; }
      case 'towel': {                                 // wrapped up, a good shake, and home
        M.y = DECK - 28; if (M.t > 0.5 && M.t < 1.3 && chance(0.7)) drop(M.x + rnd(-9, 9), M.y - 20 + rnd(-6, 6), rnd(-60, 60), rnd(-50, -5), { r: 1 });
        if (M.t > 2.1) { finish(); return; }
        break; }
    }
    const under = M.wet && M.st !== 'air' && M.st !== 'float' && M.st !== 'climb' && M.st !== 'out' && M.st !== 'cheer' && M.y - 14 > sy && (M.st !== 'held' || M.under);
    if (M.st !== 'held') M.under = under; if (M.under !== S.muffled) { S.muffled = M.under; SND.under(M.under); }
    if (M.fin && S.t > M.fin.until) { const f = M.fin; f.held = null; M.fin = null; f.x = M.x; f.vx = rnd(-20, 20); }
    if (M.gun && (M.under || S.t > M.gun.until)) { M.gun.held = null; M.gun = null; }
    if (M.noodle && M.under) { M.noodle.held = null; M.noodle = null; }
  }
  function swimStep(M, dt, sy) {
    const tail = LOOK.x.tail, sp = (tail ? 88 : 72) * (M.noodle ? 0.7 : 1), fl = floorAt(M.x) - 9;
    const goal = M.plan && (M.plan.seat || M.plan.noodle || M.plan.gun || M.plan.fin); if (goal && M.tx != null) M.tx = clamp(goal.x + (M.plan.gun ? -10 * sgn(goal.x - M.x) : 0), X0 + 8, X1 - 8);
    if (M.tx != null) {
      const deep = M.ty > 8, ty = deep ? Math.min(M.ty, floorAt(M.tx) - 9) : sy + 4, dx = M.tx - M.x, dy = ty - M.y, d = Math.hypot(dx, dy);
      if (d < 4.5 || (!deep && Math.abs(dx) < 3)) arrive(M);
      else { M.vx += (dx / d * sp - M.vx) * Math.min(1, dt * 5); M.vy += (dy / d * sp - M.vy) * Math.min(1, dt * 5); if (Math.abs(dx) > 2) M.dir = sgn(dx); }
      M.idle = 0;
    } else {
      M.vx *= 1 - Math.min(1, dt * 3.5); M.idle += dt;
      if (M.y > sy + 12) M.vy += ((M.idle > 2.4 ? -30 : Math.sin(S.t * 2) * 3) - M.vy) * Math.min(1, dt * 2.5);          // under: hang there a moment, then drift up for air
      else M.vy += ((sy - (M.noodle ? 7 : 1) - M.y) * 7 - M.vy) * Math.min(1, dt * 8);                                   // on top: treading water
    }
    M.x = clamp(M.x + M.vx * dt, X0 + 8, X1 - 8); M.y = Math.min(M.y + M.vy * dt, fl); if (M.y < sy - 8) { M.y = sy - 8; M.vy = Math.max(0, M.vy); }
    const v = Math.hypot(M.vx, M.vy), top = M.y < sy + 10;
    if (v > 14) {
      M.strokeT -= dt * v / 70;
      if (top) { if (M.strokeT <= 0) { M.strokeT = 0.42; SND.stroke(); poke(M.x - M.dir * 14, 16, 5); for (let i = 0; i < 3; i++) drop(M.x - M.dir * rnd(22, 32), sy - 1, -M.dir * rnd(5, 40), rnd(-70, -30), { r: 1 }); foam(M.x - M.dir * 20, -M.dir * 12); } }
      else { if (M.strokeT <= 0) { M.strokeT = 0.2; bubble(M.x - M.dir * rnd(8, 30), M.y + rnd(-5, 5)); if (chance(0.3)) SND.bub(1); } }
      if (tail && chance(0.5)) spark(M.x - M.dir * rnd(26, 40), M.y + rnd(-6, 6));
    } else if (!top) { M.bubT -= dt; if (M.bubT <= 0) { M.bubT = rnd(0.5, 1.1); bubble(M.x + M.dir * 10, M.y - 8); } }
    for (const t of S.toys) if (t.st === 'sunk' || t.st === 'sink') if (Math.abs(t.x - M.x) < 13 && Math.abs(t.y - M.y) < 15) fetchToy(t);     // treasure: touching it is finding it
  }
  function arrive(M) {
    const p = M.plan; M.tx = null; M.plan = null; if (!p) return;
    if (p.out) { setSt(M, 'climb'); SND.plip(0.2); }
    else if (p.exit) { setSt(M, 'out'); }
    else if (p.hand) { setSt(M, 'hand'); M.vx = M.vy = 0; if (!line('m_gym_handstand')) SND.bub(3); }
    else if (p.seat) { const toy = p.seat; if (toy.rider || Math.abs(toy.x - M.x) > 30) return; toy.rider = M; M.seat = toy; setSt(M, 'float'); toy.vy = 30; poke(toy.x, 40, 10); SND.plip(0.25); jingle([7, 12], 0.07, 'triangle'); }
    else if (p.noodle && !p.noodle.held) { p.noodle.held = M; M.noodle = p.noodle; jingle([4, 9], 0.06, 'triangle'); }
    else if (p.gun && !p.gun.held) { p.gun.held = M; M.gun = p.gun; p.gun.until = S.t + 14; squirt(); }
    else if (p.fin && !p.fin.held) { p.fin.held = M; M.fin = p.fin; p.fin.until = S.t + 16; SND.shark(); const A = S.A; if (A && A.wet && A.st === 'idle') { bub(A, '😱', 1.8); A.flee = S.t + 3.5; if (!line(A.c + '_shark')) SND.oops(); } else line('m_roar'); }
  }
  function trick(M) {                                 // a tap on herself: blow bubbles, or a flip
    if (M.st !== 'swim') return; M.trick++;
    if (M.under && (M.trick & 1)) { for (let i = 0; i < 26; i++) bubble(M.x + M.dir * 12 + rnd(-3, 3), M.y - 8 + rnd(-2, 2), { vy: rnd(-90, -30), vx: rnd(-14, 14), r: i % 3 ? 1 : 2 }); SND.bub(8); M.idle = 0; if (chance(0.3)) line('m_blow'); }
    else { M.tx = null; M.plan = null; setSt(M, 'flip'); SND.whee(); if (M.y < surf(M.x) + 10) { M.y = surf(M.x) + 12; splash(M.x, 0.3, { by: M }); } }
  }

  // ------------------------------------------------------------------ toys. st: deck (in the row) | fly | sink | sunk | float | held
  const SLOTX = i => 8 + i * 11;
  function newToys() {
    const T = [];
    ['ring1', 'gem', 'ring2', 'star', 'shell', 'chest'].forEach((k, i) => T.push({ k, dive: 1, slot: i, x: SLOTX(i), y: BACK + 5, vx: 0, vy: 0, st: 'deck', t: 0 }));
    for (const [k, x, d, o] of [['unicorn', 310, 21, { big: 1, w: 34 }], ['donut', 246, 12, { big: 1, w: 28 }], ['ball', 282, 9, { w: 12 }], ['duck', 150, 4, { w: 8, sm: 1 }],
      ['noodle', 196, 1, { c: 0, w: 16, side: 1 }], ['blaster', 232, 2, { w: 9, sm: 1, side: 1 }], ['fin', 258, 3, { w: 9, sm: 1, side: 1 }], ['noodle', 296, 1, { c: 1, w: 16, side: 1 }]])
      T.push(Object.assign({ k, x, y: o.side ? BACK + 8 : -d, vx: 0, vy: 0, st: o.side ? 'deck' : 'float', d, ph: Math.random() * 6, rot: 0 }, o));      // side: waiting on the far edge until she taps it
    for (const [i, x] of [[1, 168], [0, 254], [3, 316]]) { const t = T[i]; t.x = x; t.y = floorAt(x) - 5; t.st = 'sunk'; }       // some treasure is already down there
    return T;
  }
  function throwIn(t) { if (t.st !== 'deck') return; Object.assign(t, { st: 'fly', t: 0, x0: t.x, y0: t.y, x1: t.dive ? rnd(X0 + 26, X1 - 46) : clamp(t.x + rnd(-14, 14), X0 + 20, X1 - 40), y1: t.dive ? 0 : -t.d, dur: t.dive ? 0.85 : 0.6, then: t.dive ? 'sink' : 'float' }); try { Audio2.whoosh(true); } catch (e) { } }
  function fetchToy(t) {
    Object.assign(t, { st: 'fly', t: 0, x0: t.x, y0: t.y, x1: SLOTX(t.slot), y1: BACK + 5, dur: 1, then: 'deck' }); S.found++; jingle([0, 7, 12, 16], 0.06, 'triangle');
    for (let i = 0; i < 8; i++) spark(t.x + rnd(-6, 6), t.y + rnd(-6, 6)); if (S.found === 1 || chance(0.2)) line('m_found');
  }
  function bop(b, vx, vy) { b.air = true; b.vx = vx; b.vy = vy; b.cool = S.t + 0.35; tone('sine', 560, 300, 0.12, 0.3); tone('triangle', 280, 160, 0.1, 0.2); }
  function toyStep(t, dt) {
    const M = S.M, A = S.A; t.t = (t.t || 0) + dt;
    if (t.st === 'fly') { const k = Math.min(1, t.t / t.dur); t.x = lerp(t.x0, t.x1, k); t.y = lerp(t.y0, t.y1, k) - Math.sin(Math.PI * k) * (t.then === 'deck' ? 46 : 58);
      if (k >= 1) { if (t.then === 'sink') { t.st = 'sink'; t.t = 0; splash(t.x, 0.26, { dry: 1 }); } else if (t.then === 'float') { t.st = 'float'; t.vy = 40; t.vx = rnd(-12, 12); splash(t.x, 0.22, { dry: 1 }); } else { t.st = 'deck'; SND.plip(0.2); } } return; }
    if (t.st === 'sink') { t.y += 30 * dt; t.x = clamp(t.x + Math.sin(t.t * 5) * 9 * dt, X0 + 8, X1 - 8); const fl = floorAt(t.x) - 5; if (t.y >= fl) { t.y = fl; t.st = 'sunk'; for (let i = 0; i < 4; i++) bubble(t.x + rnd(-4, 4), fl); SND.bub(2); } else if (chance(0.1)) bubble(t.x, t.y - 4); return; }
    if (t.st !== 'float') return;
    if (t.held) { const m = t.held, sy = surf(m.x); if (t.k === 'noodle') { t.x = m.x; t.y = sy + 2; } else if (t.k === 'blaster') { t.x = m.x + m.dir * 14; t.y = m.y - 3; } else { t.x = m.x - m.dir * 5; t.y = m.y - (Math.hypot(m.vx, m.vy) > 14 || m.under ? 14 : 2); } t.vx = 0; return; }
    if (t.k === 'ball' && t.air) {                     // the beach ball in the air: it bounces off the water, the deck and people's heads
      t.vy += 360 * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.rot += t.vx * dt * 0.08;
      if (t.x < 10 || t.x > WW - 10) { t.x = clamp(t.x, 10, WW - 10); t.vx = -t.vx * 0.7; }
      if (inPool(t.x)) { const sy = surf(t.x) - t.d; if (t.vy > 0 && t.y > sy) { if (t.vy > 110) { t.vy *= -0.42; t.y = sy; splash(t.x, 0.2, { dry: 1 }); } else { t.air = false; t.vy = 0; poke(t.x, 20, 5); SND.plip(0.15); } } }
      else if (t.vy > 0 && t.y > DECK - 13) { t.y = DECK - 13; t.vy = -Math.max(120, t.vy * 0.6); t.vx = (t.x < X0 ? 1 : -1) * rnd(50, 90); tone('sine', 300, 180, 0.08, 0.2); }
      if (t.vy > 0 && S.t > (t.cool || 0)) {
        if (M.wet && (M.st === 'swim' || M.st === 'cheer') && !M.under && Math.abs(t.x - M.x) < 14 && t.y > M.y - 46 && t.y < M.y - 14) { const to = A && A.wet ? A.x : M.x + rnd(-60, 60); bop(t, clamp((to - t.x) * 0.9, -120, 120), -215); bub(M, '😄', 0.7); }
        else if (A && A.wet && A.st === 'idle' && !A.lying && Math.abs(t.x - A.x) < 16 && t.y > A.top() - 16 && t.y < A.top() + 14) { bop(t, clamp((M.x - t.x) * 0.9, -130, 130), -225); A.arm = S.t + 0.4; }
      }
      return;
    }
    const sy = surf(t.x), slope = surf(t.x + 4) - surf(t.x - 4);
    t.vx += slope * 14 * dt - t.vx * Math.min(1, dt * 0.9);
    if (S.game && S.game.id === 'whirl' && S.game.ph === 'spin') t.vx += 95 * Math.sin(S.t * 2.3 + t.ph) * dt;
    if (t.k === 'fin') t.vx += Math.sin(S.t * 0.5 + t.ph) * 16 * dt;
    if (M.wet && M.st === 'swim' && !M.under && Math.abs(M.x - t.x) < t.w + 8 && sgn(t.x - M.x) === sgn(M.vx) && Math.abs(M.vx) > 20 && !t.rider && !(M.plan && (M.plan.seat === t || M.plan.noodle === t || M.plan.gun === t || M.plan.fin === t))) t.vx += (M.vx * 1.1 - t.vx) * Math.min(1, dt * 3);
    for (const o of S.toys) if (o !== t && o.st === 'float' && !o.held && !o.air && Math.abs(o.x - t.x) < (o.w + t.w) * 0.8) t.vx += sgn(t.x - o.x || 1) * 26 * dt;
    t.x += t.vx * dt; const lo = X0 + t.w, hi = X1 - t.w - (t.big ? 26 : 4); if (t.x < lo) { t.x = lo; t.vx = Math.abs(t.vx) * 0.5; } if (t.x > hi) { t.x = hi; t.vx = -Math.abs(t.vx) * 0.5; }
    const want = sy - t.d + (t.rider ? (t.rider === M ? 3 : 8) : 0); t.vy += ((want - t.y) * 70 - t.vy * 7) * dt; t.y += t.vy * dt;
    t.rot = t.flip != null && S.t - t.flip < 0.7 ? TAU * ease((S.t - t.flip) / 0.7) : clamp(slope * 0.06, -0.3, 0.3) + (t.rider ? Math.sin(S.t * 2.2) * 0.05 : 0);
    if (t.k === 'ball' && A && A.wet && A.st === 'idle' && !A.act && !A.lying && Math.abs(t.x - A.x) < 18 && S.t > (t.cool || 0)) { bop(t, clamp((M.x - t.x) * 0.8, -120, 120) || 40, -210); A.arm = S.t + 0.4; }
  }
  function squirt() {                                 // the water blaster: at the grown-up if he is in, else the cat, else the sky
    const M = S.M, g = M.gun, A = S.A; if (!g) return; g.until = S.t + 14; let tx, ty, hit = null;
    if (A && A.wet && Math.abs(A.x - M.x) < 190 && Math.abs(A.x - M.x) > 12) { tx = A.x; ty = A.top() + 12; hit = A; } else if (S.cat.st === 0 && Math.abs(CAT.x - M.x) < 170) { tx = CAT.x; ty = CAT.y - 16; hit = 'cat'; } else { tx = M.x + M.dir * 46; ty = -78; }
    M.dir = sgn(tx - M.x); const x0 = M.x + M.dir * 20, y0 = surf(M.x) - 12, T = 0.55;
    S.jets.push({ x0, y0, vx: (tx - x0) / T, vy: (ty - y0) / T - 0.5 * 420 * T, t: 0, hit, at: S.t + T }); SND.squirt();
  }
  function jetStep(dt) {
    for (let i = S.jets.length - 1; i >= 0; i--) {
      const j = S.jets[i]; j.t += dt; if (j.t < 0.32) for (let n = 0; n < 3; n++) drop(j.x0, j.y0, j.vx + rnd(-8, 8), j.vy + rnd(-8, 8), { r: n ? 1 : 2, c: '#c8f4ff' });
      if (S.t >= j.at && !j.done) { j.done = true; if (j.hit === 'cat') { if (S.cat.st === 0) { S.cat.st = 1; S.cat.t = 0; } } else if (j.hit && j.hit === S.A) { j.hit.soak = S.t + 1.2; bub(j.hit, pick(['😝', '🤪', '😆']), 1.2); } }
      if (j.t > 1.2) S.jets.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ Daddy or Uncle Rory
  // y = his feet when he is upright, the middle of him when he is lying (swimming, floating, tucked).
  // st: enter | bounce | air | plunge | idle | game | leave | out | off
  function newAdult(id, inWater) {
    const A = { id, c: id[0], x: -26, y: DECK, vx: 0, vy: 0, dir: 1, st: 'enter', t: 0, pose: 'wade', lying: false, wet: false, soak: 0, act: null, actT: 2.5, last: '', rot: 0, dip: 0, h: id === 'daddy' ? 85 : 80, stepT: 0,
      top() { return this.lying ? this.y - 20 : this.y - this.h + this.dip; } };
    if (inWater) { A.x = 266; A.y = floorAt(266); A.st = 'idle'; A.wet = true; A.pose = 'stand'; A.dir = -1; }
    return A;
  }
  const deepAt = x => floorAt(x) > 60;
  function aRest(A, moving) {                         // standing or wading where he can, swimming or treading where he cannot
    A.rot = 0; A.dip = 0;
    if (!deepAt(A.x)) { A.lying = false; A.pose = moving ? 'wade' : 'stand'; A.y = floorAt(A.x); }
    else if (moving) { A.lying = true; A.pose = 'swim'; A.y = surf(A.x) + 7; }
    else { A.lying = false; A.pose = 'stand'; A.y = surf(A.x) + A.h - 27 + Math.sin(S.t * 3) * 1.5; }
  }
  function aMove(A, tx, dt, sp) {                     // -> true once he is there
    const d = tx - A.x, v = sp || (deepAt(A.x) ? 60 : 40), done = Math.abs(d) <= v * dt + 0.5; if (!done) { A.dir = sgn(d); A.x += A.dir * v * dt; } else A.x = tx;
    aRest(A, !done);
    if (!done) { A.stepT -= dt; if (A.stepT <= 0) { A.stepT = 0.36; poke(A.x + A.dir * 9, 16, 6); if (A.lying) { SND.stroke(); drop(A.x - A.dir * 30, surf(A.x) - 1, -A.dir * rnd(10, 40), rnd(-70, -30)); } } }
    return done;
  }
  function callAdult(id) {                            // his face button: in he comes (with a cannonball) — or, if he is in already, out he gets
    if (S.leaving || S.pick) return; const A = S.A;
    if (A && A.id === id) { if (['enter', 'bounce', 'air', 'plunge'].includes(A.st)) return; sendOut(A); return; }
    if (A) sendOut(A);
    S.A = newAdult(id); jingle([0, 4, 7], 0.07); if (chance(0.5)) line(id === 'daddy' ? 'm_hi_daddy' : 'm_hi_rory');
  }
  function sendOut(A) {
    endGame(); for (const t of S.toys) if (t.rider === A) t.rider = null;
    if (!A.wet) { S.A = null; return; }               // still on his way in: he just turns round
    A.act = null; A.judge = null; A.st = 'leave'; bub(A, '👋', 1.4); S.B = A; S.A = null; S.wantGame = null;
  }
  const ACTS = ['back', 'flop', 'brr', 'unicorn', 'wave', 'wander'];
  function pickAct(A, k) {
    const uni = S.toys.find(t => t.k === 'unicorn');
    for (let n = 0; n < 8 && !k; n++) { const c = pick(ACTS); if (c !== A.last && (c !== 'unicorn' || (uni && !uni.rider && !deepAt(uni.x) === !deepAt(A.x)))) k = c; }
    if (k === 'unicorn' && (!uni || uni.rider)) k = 'brr';
    A.last = k; A.act = { k, t: 0, ph: 0 }; A.actT = rnd(3.5, 6.5);
    if (k === 'brr') { SND.brr(); bub(A, '🥶', 1.6); line(A.c + '_brr'); }
    else if (k === 'wave') { bub(A, '👋', 1.2); A.dir = sgn(S.M.x - A.x); }
    else if (k === 'wander') A.act.x = rnd(STAND0 + 10, STAND1 - 10);
    else if (k === 'back') A.act.x = clamp(A.x + rnd(-40, 40), X0 + 60, STAND1 - 20);
  }
  function adultStep(A, dt) {
    A.t += dt; const M = S.M;
    switch (A.st) {
      case 'enter': A.pose = 'wade'; A.lying = false; A.x += 74 * dt; A.y = boardY(A.x); A.stepT -= dt; if (A.stepT <= 0) { A.stepT = 0.24; SND.step(); }
        if (A.x >= TIP - 7) { A.st = 'bounce'; A.t = 0; SND.boing(1); } break;
      case 'bounce': { const k = A.t / 0.6; S.bend = 10 * Math.sin(Math.PI * Math.min(1, k)); A.pose = 'crouch'; A.y = boardY(A.x);
        if (k >= 1) { S.bend = 0; S.twang = S.t; A.st = 'air'; A.t = 0; A.vy = -238; A.vx = 60; A.pose = 'tuck'; A.lying = true; A.y -= 40; try { Audio2.whoosh(true); } catch (e) { } if (!line(A.c + '_cannonball')) SND.whee(); } break; }
      case 'air': A.vy += GRAV * dt; A.x += A.vx * dt; A.y += A.vy * dt; A.rot += dt * 7 * (A.vy < 0 ? 0.4 : 1);
        if (A.vy > 0 && A.y + 22 > surf(A.x)) { splash(A.x, 1.6, { by: A }); A.wet = true; A.st = 'plunge'; A.t = 0; A.vy = 110; if (M.wet) { M.soak = S.t + 1.2; bub(M, pick(['😆', '🤣', '😝']), 1.4); } } break;
      case 'plunge': A.vy -= (A.vy * 3 + 190 * Math.min(1, A.t * 2)) * dt; A.x += A.vx * dt * 0.3; A.y = Math.min(A.y + A.vy * dt, floorAt(A.x) - 26); A.rot *= 1 - Math.min(1, dt * 4);
        if (chance(0.8)) bubble(A.x + rnd(-14, 14), A.y + rnd(-20, 20), { r: chance(0.4) ? 2 : 1 });
        if (A.t > 0.7 && A.y < surf(A.x) + 22) { A.st = 'idle'; A.act = { k: 'go', t: 0, x: clamp(A.x + 40, STAND0 + 20, STAND1 - 20) }; A.actT = 2; splash(A.x, 0.35, { by: A, quiet: 1, dry: 1 }); bub(A, '😄', 1.3); if (chance(0.6)) line(pick(A.c === 'd' ? ['d_hi1', 'd_hi2', 'd_play_yes'] : ['r_hi_niece', 'r_hi'])); }
        break;
      case 'idle': idleStep(A, dt); break;
      case 'leave': if (aMove(A, STEPX + 3, dt)) { A.st = 'out'; A.t = 0; A.lying = false; } break;
      case 'out': { const k = Math.min(1, A.t / 1.5); A.x = lerp(STEPX + 3, X1 + 14, k); A.y = lerp(floorAt(STEPX + 3), DECK, Math.min(1, k * 1.2)); A.pose = 'wade'; A.dir = 1; if (k >= 1) { A.st = 'off'; A.wet = false; } break; }
      case 'off': A.x += 60 * dt; A.y = DECK; A.pose = 'wade'; break;
    }
  }
  function idleStep(A, dt) {
    const M = S.M;
    if (A.judge && S.t >= A.judge.at) {               // the score for her jump: a row of stars held up high
      const n = A.judge.n; A.judge = null; A.act = { k: 'score', t: 0 }; A.dir = sgn(M.x - A.x); bub(A, STARS(n), 2.3, 'pl-score'); jingle([7, 12, 16].slice(0, n - 2), 0.08, 'triangle');
      if (n >= 5 && chance(0.4)) line(pick(A.c === 'd' ? ['d_amazing', 'd_brave', 'd_good_girl', 'd_proud'] : ['r_amazing', 'r_wow', 'r_brave', 'r_good']));
    }
    if (A.soak > S.t && (!A.act || A.act.k === 'wander' || A.act.k === 'wave')) { A.act = { k: 'splutter', t: 0 }; if (chance(0.5)) bub(A, pick(['😝', '🤣', '😆']), 1.1); }
    const a = A.act;
    if (!a) {
      if (A.flee > S.t) { aMove(A, clamp(A.x + sgn(A.x - M.x) * 30, STAND0 - 30, STAND1), dt, 66); return; }
      aRest(A, false); if (Math.abs(M.x - A.x) > 8 && !A.lying) A.dir = sgn(M.x - A.x);
      A.actT -= dt; if (A.actT <= 0 && !S.wantGame) pickAct(A); return;
    }
    a.t += dt;
    const end = () => { A.act = null; aRest(A, false); };
    switch (a.k) {
      case 'score': aRest(A, false); A.pose = 'up'; if (a.t > 2.3) end(); break;
      case 'splutter': aRest(A, false); A.pose = 'brr'; A.dip = Math.sin(a.t * 40) * 1; if (a.t > 0.9) end(); break;
      case 'go': if (aMove(A, a.x, dt)) end(); break;
      case 'wander': if (aMove(A, a.x, dt, 30) || a.t > 6) end(); break;
      case 'wave': aRest(A, false); A.pose = Math.floor(a.t * 5) & 1 ? 'up' : 'open'; if (a.t > 1.3) end(); break;
      case 'brr': aRest(A, false); A.pose = 'brr'; A.dip = Math.sin(a.t * 50) * 1.2; if (a.t > 1.8) end(); break;
      case 'back':                                    // floating on his back, spouting like a whale
        if (!a.ph) { if (aMove(A, a.x, dt)) { a.ph = 1; a.t = 0; } break; }
        A.lying = true; A.pose = 'back'; A.y = surf(A.x) + 3; A.rot = 0;
        if ((a.t > 1.1 && a.t < 1.6) || (a.t > 3.1 && a.t < 3.6)) { if (!a.sp) { a.sp = 1; SND.spout(); } const hx_ = A.x - A.dir * 24; for (let i = 0; i < 2; i++) drop(hx_ + rnd(-1, 1), A.y - 12, rnd(-14, 14), rnd(-190, -130), { r: 1, c: '#d8f8ff' }); } else a.sp = 0;
        if (a.t > 5) end(); break;
      case 'flop':                                    // his own belly flop
        if (a.ph === 0) { aRest(A, false); A.dip = 6 * Math.sin(Math.min(1, a.t / 0.35) * Math.PI / 2); if (a.t > 0.4) { a.ph = 1; A.y = A.y - A.h / 2; A.lying = true; A.pose = 'tuck'; A.vy = -215; A.dip = 0; SND.boing(0.5); } }
        else if (a.ph === 1) { A.vy += GRAV * dt; A.y += A.vy * dt; A.x = clamp(A.x + A.dir * 30 * dt, X0 + 40, X1 - 50); if (A.vy > -60) { A.pose = 'swim'; A.rot = 0; } if (A.vy > 0 && A.y + 6 > surf(A.x)) { splash(A.x, 1.15, { by: A, wide: 1.7 }); SND.slap(); a.ph = 2; a.t = 0; } }
        else { A.y += (surf(A.x) + 14 - A.y) * Math.min(1, dt * 5); if (a.t > 0.7) { bub(A, '😵', 1.3); end(); A.act = { k: 'splutter', t: 0 }; } }
        break;
      case 'unicorn': {                               // he tries the unicorn: far too big for it, and over it goes
        const toy = S.toys.find(t => t.k === 'unicorn');
        if (a.ph === 0) { if (!toy || (toy.rider && toy.rider !== A)) { end(); break; } if (aMove(A, toy.x + 6, dt) || a.t > 6) { a.ph = 1; a.t = 0; toy.rider = A; toy.vy = 60; poke(toy.x, 80, 12); SND.plip(0.3); } break; }
        if (!toy || toy.rider !== A) { end(); break; }
        A.lying = true; A.pose = 'tuck'; A.x = toy.x + 2; A.y = toy.y - 34; A.rot = Math.sin(a.t * 3) * 0.12; A.dir = -1;
        if (a.t > 4.2 || a.tip) { toy.rider = null; toy.flip = S.t; A.vy = 40; a.k = 'fall'; a.t = 0; SND.oops(); }
        break; }
      case 'fall': A.vy += GRAV * dt; A.y += A.vy * dt; A.rot += dt * 6; if (A.y + 10 > surf(A.x)) { splash(A.x, 1, { by: A }); bub(A, '🤣', 1.4); end(); A.act = { k: 'splutter', t: 0 }; } break;
      default: end();
    }
  }
  function tapAdult(A) {                              // poke him: he does the next silly thing
    if (A.st !== 'idle') return; const a = A.act;
    if (a && a.k === 'unicorn' && a.ph === 1) { a.tip = 1; return; }
    if (a && a.k !== 'wander' && a.k !== 'go') return;
    A.n = (A.n || 0) + 1; pickAct(A, ['back', 'flop', 'brr', 'wave'][A.n % 4]);
  }

  // ------------------------------------------------------------------ games with him. Each is short, can be played again and again, and always ends well.
  const GAMES = [['ride', '🐬'], ['rocket', '🚀'], ['shoulders', ''], ['war', '💦'], ['marco', '🙈'], ['race', '🏁'], ['whirl', '🌀']];
  function startGame(id) {
    const A = S.A, M = S.M; if (!A || S.leaving || S.pick) return;
    if ((S.game && S.game.id === id) || S.wantGame === id) { endGame(); return; }        // the lit button again = stop
    endGame(); if (['climb', 'out', 'towel'].includes(M.st)) return;
    S.wantGame = id;                                  // begins as soon as both are ready (he may still be jumping in, she may be on the deck)
    if (M.st === 'deck' || (M.st === 'run' && !M.jump)) hopIn(M, A.wet ? A.x - 40 : 200);
  }
  function hopIn(M, x) { M.jump = null; runTo(M, Math.max(M.x, X0 - 4), 115, () => { launch(M, 'hop', 0, 1); M.vx = clamp((x - M.x) * 0.9, 36, 125); S.jumps--; }); }
  function beginGame(id) {
    const A = S.A, M = S.M; S.wantGame = null; if (M.st === 'float') leaveSeat(M, false); dropThings(M);
    A.act = null; A.judge = null; A.st = 'game'; A.rot = 0; A.dip = 0; S.game = { id, ph: 'gather', t: 0, T: 0, both: id !== 'marco' }; S.games++; jingle([0, 7], 0.07);
  }
  function endGame(keepM) {
    const G = S.game, A = S.A, M = S.M; S.wantGame = null; if (!G) return; S.game = null; S.lights = null;
    if (M.st === 'held' && !keepM) { M.rot = 0; M.tx = null; if (M.y < surf(M.x) - 12) { launch(M, 'hop', 0, M.dir); M.vx *= 0.4; M.vy = -70; S.jumps--; } else { setSt(M, 'swim'); M.idle = 0; } }
    if (A && A.st === 'game') { A.st = 'idle'; A.act = null; A.actT = 3; A.vx = A.vy = 0; aRest(A, false); }
  }
  function gather(A, M, ax, off, dt) {                // he goes to ax, she swims to his side -> true once both are there
    const a = aMove(A, ax, dt), mx = clamp(ax + off, X0 + 10, X1 - 10), top = M.y < surf(M.x) + 10;
    if (M.st === 'swim' && (Math.abs(M.x - mx) > 6 || !top)) { M.tx = mx; M.ty = 0; M.plan = null; }
    return a && M.st === 'swim' && Math.abs(M.x - mx) <= 8 && top;
  }
  const RIDE = [[X1 - 62, 0], [236, 40], [X0 + 48, 0], [X1 - 62, 0], [196, 46], [X0 + 48, 0]];
  function gameStep(dt) {
    const G = S.game, A = S.A, M = S.M; if (!G) return; if (!A || !A.wet) { endGame(); return; } G.t += dt; G.T += dt;
    const go = ph => { G.ph = ph; G.t = 0; };
    switch (G.id) {
      case 'ride': {                                  // on his back like a dolphin: fast lengths, dives, bursting out
        if (G.ph === 'gather') {
          if (gather(A, M, clamp(A.x, X0 + 60, X1 - 70), -A.dir * 3, dt) || G.t > 7) { go('ride'); M.st = 'held'; M.tx = null; A.lying = true; A.pose = 'swim'; A.y = surf(A.x) + 6; A.vx = A.vy = 0; G.i = A.x > 230 ? 2 : 0; G.tgt = null; G.w = 0; if (!line('m_whee')) SND.whee(); bub(M, '🐬', 1.3); }
          break; }
        const p = G.tgt || { x: RIDE[G.i % RIDE.length][0], y: RIDE[G.i % RIDE.length][1] }, s0 = surf(A.x), ty = Math.min(s0 + 6 + p.y, floorAt(A.x) - 20), dx = p.x - A.x, dy = ty - A.y, d = Math.hypot(dx, dy) || 1;
        if (G.fly) A.vy += 300 * dt; else { A.vx += (dx / d * 130 - A.vx) * Math.min(1, dt * 2.6); A.vy += (dy / d * 130 - A.vy) * Math.min(1, dt * 3.4); if (d < 16) { if (G.tgt) G.tgt = null; else G.i++; } }
        A.x += A.vx * dt; if (A.x < X0 + 36 || A.x > X1 - 46) { A.x = clamp(A.x, X0 + 36, X1 - 46); A.vx = 0; } A.y = Math.min(A.y + A.vy * dt, floorAt(A.x) - 18); if (Math.abs(A.vx) > 10) A.dir = sgn(A.vx);
        const s1 = surf(A.x);
        if (!G.fly && A.y < s1 + 5) { if (A.vy < -62) { G.fly = true; splash(A.x, 0.45, { by: A, dry: 1 }); SND.whee(); } else { A.y = s1 + 5; A.vy = Math.max(0, A.vy); } }
        else if (G.fly && A.vy > 0 && A.y > s1 + 2) { G.fly = false; splash(A.x, 0.85, { by: A }); A.vy *= 0.4; }
        A.rot = Math.atan2(A.vy, Math.max(34, Math.abs(A.vx))) * A.dir * 0.9; A.still = false;
        const top = !G.fly && A.y < s1 + 9, v = Math.hypot(A.vx, A.vy); G.w -= dt;
        if (G.w <= 0) { G.w = 0.07;
          if (top && v > 50) { poke(A.x + A.dir * 32, 24, 7); for (let i = 0; i < 2; i++) drop(A.x + A.dir * rnd(30, 40), s1 - 1, A.dir * rnd(20, 80), rnd(-95, -40)); foam(A.x - A.dir * 24, -A.dir * 24); if (chance(0.2)) SND.stroke(); }
          else if (!top && !G.fly) { bubble(A.x - A.dir * rnd(10, 34), A.y + rnd(-7, 7)); if (chance(0.5)) bubble(M.x, M.y - 6); } }
        const c = Math.cos(A.rot), sn = Math.sin(A.rot), ox = -9 * A.dir, oy = -15; M.x = A.x + ox * c - oy * sn; M.y = A.y + ox * sn + oy * c; M.dir = A.dir; M.rot = A.rot; M.under = !G.fly && M.y - 10 > surf(M.x);
        if (G.T > 24 && top) { bub(A, '😄', 1.3); endGame(); if (chance(0.5)) line('m_again'); }
        break; }
      case 'rocket': {                                // she stands on his hands: one... two... three... and up she goes, higher than any jump
        if (G.ph === 'gather') { if (gather(A, M, 252, -13, dt) || G.t > 8) { go('count'); G.n = 0; M.st = 'held'; M.dir = -1; M.under = false; M.rot = 0; A.dir = -1; A.lying = false; S.lights = { n: 0, x: A.x - 14 }; line(A.c + '_rocket'); } break; }
        if (G.ph === 'count') {
          A.pose = 'crouch'; A.y = floorAt(A.x); A.dip = G.t < 1.6 ? 7 * Math.pow(Math.max(0, Math.cos((G.t - 0.3) / 0.55 * TAU)), 2) : 7 + (G.t - 1.6) * 16;
          if (G.n < 3 && G.t > 0.3 + 0.55 * G.n) { SND.count(G.n); poke(A.x - 10, 60, 9); for (let i = 0; i < 4; i++) drop(A.x - 12 + rnd(-8, 8), surf(A.x) - 1, rnd(-30, 30), rnd(-70, -30), { r: 1 }); S.lights.n = ++G.n; }
          M.x = A.x - 13; M.y = surf(A.x) - 30 + A.dip; M.pose = 'm_y';
          if (G.t > 1.95) { A.dip = 0; A.pose = 'up'; go('fly'); S.lights = null; M.y = surf(A.x) - 34; launch(M, 'rocket', 0, -1); SND.go(); splash(A.x - 12, 0.4, { by: M, dry: 1, quiet: 1 }); }
          break; }
        A.pose = G.t < 1.3 ? 'up' : 'stand'; A.y = floorAt(A.x); if (M.st === 'cheer' || M.st === 'swim') endGame();
        break; }
      case 'shoulders': {                             // up on his shoulders; from there: dive off, a splash war, or down again
        if (G.ph === 'gather') { if (gather(A, M, clamp(A.x, STAND0 + 14, STAND1 - 12), -A.dir * 6, dt) || G.t > 8) { go('up'); M.st = 'held'; M.under = false; M.rot = 0; G.x0 = M.x; G.y0 = M.y; G.tx = null; if (!line(A.c === 'd' ? 'd_shoulders' : 'r_gotcha')) SND.whee(); } break; }
        const sx = A.x - A.dir * 6, sy = A.y - A.h - 4 + A.dip;
        if (G.ph === 'up') { A.pose = 'stand'; A.y = floorAt(A.x); const k = ease(Math.min(1, G.t / 0.5)); M.x = lerp(G.x0, sx, k); M.y = lerp(G.y0, sy, k) - Math.sin(Math.PI * k) * 10; M.dir = A.dir; if (k >= 1) { go('on'); jingle([7, 12], 0.07, 'triangle'); } break; }
        if (G.tx != null) { if (aMove(A, G.tx, dt, 36)) G.tx = null; } else { A.pose = 'stand'; A.y = floorAt(A.x); A.lying = false; }
        M.x = A.x - A.dir * 6; M.y = A.y - A.h - 4 + (G.tx != null ? Math.abs(Math.sin(S.t * 7)) * 1.5 : 0); M.dir = A.dir;
        if (G.T > 50) endGame();
        break; }
      case 'war': {                                   // splash war: tap fast! He splashes back, and a rainbow comes out in the spray
        if (G.ph === 'gather') { if (gather(A, M, clamp(A.x, STAND0 + 44, STAND1 - 10), -42, dt) || G.t > 8) { go('war'); G.n = 0; G.aT = 1; G.mT = 0.5; G.last = 0; A.dir = sgn(M.x - A.x); M.dir = -A.dir; M.st = 'held'; M.under = false; M.rot = 0; line('m_splash_you'); bub(M, '💦', 1.1); } break; }
        A.lying = false; A.y = floorAt(A.x); M.y += (surf(M.x) - 3 - M.y) * Math.min(1, dt * 8);
        if (G.ph === 'war') {
          G.mT -= dt; if (G.mT <= 0) { G.mT = 1.3; warSplash(G, M, A, 9); G.n++; }
          G.aT -= dt; if (G.aT <= 0) { G.aT = Math.max(0.55, 1.15 - G.n * 0.05); warSplash(G, A, M, 14); }
          A.pose = S.t < (A.arm || 0) ? 'throw' : 'stand';
          if (G.n >= 11 || G.t > 11) { go('rainbow'); S.rainbow = { x: (A.x + M.x) / 2, t0: S.t }; SND.chime(); bub(M, '🌈', 2); line(pick(['m_laugh', 'm_giggle'])); line(A.c === 'r' ? 'r_giggle' : 'd_caughtkiss'); }
        } else {
          A.pose = G.t < 1.8 ? 'throw' : 'up';
          if (G.t < 1.8) { for (let i = 0; i < 3; i++) drop((A.x + M.x) / 2 + rnd(-26, 26), surf(M.x) - 2, rnd(-30, 30), rnd(-175, -90), { r: 1 }); if (chance(0.12)) warSplash(G, chance(0.5) ? M : A, chance(0.5) ? A : M, 8); }
          if (G.t > 5.4) endGame();
        }
        break; }
      case 'marco': {                                 // he shuts his eyes and calls; she answers; he wades to where she WAS. Under the water she can sneak right past.
        if (G.ph === 'gather') { if (aMove(A, clamp(A.x, STAND0 + 30, STAND1 - 30), dt) || G.t > 6) { go('seek'); G.callT = 0.7; G.calls = 0; G.ansT = 0; G.tx = null; bub(A, '🙈', 1.5); bub(M, '🏃', 1.5); } break; }
        A.lying = false; A.y = floorAt(A.x);
        if (G.ph === 'seek') {
          A.pose = 'eyes'; G.callT -= dt;
          if (G.callT <= 0) { G.callT = 3.1; if (++G.calls > 5) { go('win'); bub(A, '🤷', 1.6); bub(M, '🏆', 2.2); SND.win(); line('m_noway'); break; } if (!line(A.c + '_marco')) SND.call(false); bub(A, '📣', 0.9); G.ansT = 0.9; }
          if (G.ansT > 0) { G.ansT -= dt; if (G.ansT <= 0) {
            if (M.wet && !M.under && M.st !== 'air') { if (!line('m_polo')) SND.call(true); G.ping = { x: M.x, t: S.t }; G.tx = clamp(M.x, STAND0, STAND1 + 4); }
            else { bub(A, '❓', 1.2); G.tx = clamp(A.x + rnd(-34, 34), STAND0, STAND1); } } }
          if (G.tx != null) { const d = G.tx - A.x; if (Math.abs(d) > 2) { A.dir = sgn(d); A.x += A.dir * 38 * dt; A.dip = Math.abs(Math.sin(S.t * 6)) * 2; A.stepT -= dt; if (A.stepT <= 0) { A.stepT = 0.4; poke(A.x + A.dir * 9, 18, 6); } } else { G.tx = null; A.dip = 0; } }
          const near = Math.abs(M.x - A.x) < 21 && M.wet;
          if (near && G.t > 3.6 && (M.st === 'swim' || M.st === 'float') && !M.under) { go('tag'); A.pose = 'up'; A.dip = 0; A.dir = sgn(M.x - A.x); bub(A, '🤗', 1.6); if (!line(A.c + '_caught')) SND.win(); bub(M, '😆', 1.6); for (let i = 0; i < 14; i++) spark(M.x + rnd(-14, 14), M.y - rnd(0, 30)); }
          else if (near && M.under && S.t > (G.sneak || 0)) { G.sneak = S.t + 3; for (let i = 0; i < 10; i++) spark(M.x + rnd(-10, 10), M.y + rnd(-8, 8)); SND.sparkle(); bub(M, '🤫', 1.2); }
        } else { A.pose = 'up'; if (G.t > 2.5) endGame(); }
        break; }
      case 'race': {                                  // one length of the pool. She always just wins, and he cannot believe it.
        const XS = STEPX - 14, FIN = X0 + 20;
        if (G.ph === 'gather') {
          const a = aMove(A, XS - 4, dt); if (M.st === 'swim' && (Math.abs(M.x - XS) > 5 || M.y > surf(M.x) + 9)) { M.tx = XS; M.ty = 0; M.plan = null; }
          if ((a && M.st === 'swim' && Math.abs(M.x - XS) <= 6) || G.t > 9) { go('ready'); G.n = 0; M.st = 'held'; M.dir = -1; M.under = false; M.rot = 0; M.x = XS; M.vx = 0; A.dir = -1; A.lying = true; A.pose = 'swim'; A.x = XS - 3; S.lights = { n: 0, x: XS - 24 }; bub(A, '🏁', 1.2); }
          break; }
        if (G.ph === 'ready') { M.y = surf(M.x) + 4; A.y = surf(A.x) + 9; A.still = true; if (G.n < 3 && G.t > 0.5 + 0.55 * G.n) { SND.count(G.n); S.lights.n = ++G.n; } if (G.t > 2.25) { go('go'); G.boost = 0.4; G.w = 0; SND.go(); S.lights.go = true; } break; }
        if (G.ph === 'go') {
          G.boost = Math.max(0, G.boost - dt * 0.7); const v = 56 + 58 * G.boost, left = M.x - FIN; M.x -= v * dt; M.vx = -v; M.y = surf(M.x) + 4; A.still = false;
          A.x += (M.x + 8 + 7 * Math.sin(G.t * 1.9) + (left < 70 ? (70 - left) * 0.25 : 0) - A.x) * Math.min(1, dt * 5); A.y = surf(A.x) + 9;
          G.w -= dt * v / 60; if (G.w <= 0) { G.w = 0.3; SND.stroke(); for (const e of [M, A]) { poke(e.x + 16, 16, 5); drop(e.x + rnd(22, 34), surf(e.x) - 1, rnd(5, 40), rnd(-80, -30), { r: 1 }); foam(e.x + 22, 14); } }
          if (G.t > 0.7) S.lights = null;
          if (M.x <= FIN) { go('won'); M.x = FIN; setSt(M, 'cheer'); S.flag = S.t; SND.win(); for (let i = 0; i < 40; i++) spark(M.x + rnd(-20, 30), M.y - rnd(0, 50), pick(['#ff5a8a', '#ffcf4a', '#5ad1ff', '#7bd36b', '#c48aff'])); line(pick(['m_did_it', 'm_yay'])); }
          break; }
        if (A.lying) { A.x += (FIN + 30 - A.x) * Math.min(1, dt * 3); A.y = surf(A.x) + 9; if (G.t > 0.9) { A.lying = false; A.dir = -1; bub(A, '😲', 1.5); line(pick(A.c === 'd' ? ['d_amazing', 'd_strong'] : ['r_amazing', 'r_wow'])); } }
        else { A.pose = 'brr'; A.y = surf(A.x) + A.h - 27; }
        if (G.t > 2.7) { endGame(); judge(5, 0.1); }
        break; }
      case 'whirl': {                                 // he stirs the whole pool: big waves, and round and round she goes
        if (G.ph === 'gather') { if (aMove(A, 270, dt) || G.t > 7) { go('spin'); G.th = Math.PI; G.cx = 196; bub(A, '🌀', 1.4); if (A.c !== 'd' || !line('d_spin')) SND.whee(); } break; }
        A.lying = false; A.y = floorAt(A.x);
        if (G.ph === 'spin') {
          const pw = Math.min(1, G.t / 1.5) * clamp((9.5 - G.t) / 1.2, 0, 1); S.swell = 6.5 * pw; G.pw = pw; if (chance(0.5 * pw)) foam(G.cx + rnd(-90, 90), rnd(-60, 60)); A.pose = 'throw';
          if (Math.floor(G.t / 0.24) > Math.floor((G.t - dt) / 0.24)) { A.dir = -A.dir; poke(A.x + A.dir * 14, 70 * pw, 9); drop(A.x + A.dir * 16, surf(A.x) - 2, A.dir * rnd(30, 80), rnd(-120, -60)); if (chance(0.4)) SND.stroke(); }
          if (M.st === 'swim' || M.st === 'float') { if (M.st === 'float') leaveSeat(M, false); M.st = 'held'; M.tx = null; G.th = Math.atan2((M.y - 27) / 18, (M.x - G.cx) / 80); }
          if (M.st === 'held') {
            const w = 2.4 * pw + 0.3, th0 = G.th; G.th += w * dt; const r = lerp(1, 0.36, clamp(G.t / 8.5, 0, 1)), tx = G.cx + Math.cos(G.th) * 84 * r, ty = 27 + Math.sin(G.th) * (19 * r + 3);
            M.x += (tx - M.x) * Math.min(1, dt * 6); M.y += (ty - M.y) * Math.min(1, dt * 6); M.dir = Math.sin(G.th) > 0 ? -1 : 1; M.rot = Math.cos(G.th) * 0.35 * M.dir; M.under = M.y - 12 > surf(M.x);
            if (chance(0.4)) (M.under ? bubble : foam)(M.x - M.dir * 20, M.under ? M.y : -M.dir * 30);
            if (Math.floor(G.th / TAU) > Math.floor(th0 / TAU) && !line('m_whee')) SND.whee();
          }
          if (G.t > 9.5) { go('calm'); if (M.st === 'held') { M.y = Math.min(M.y, surf(M.x) + 4); launch(M, 'tip', 1, M.dir); S.jumps--; } bub(A, '😵‍💫', 1.8); }
          break; }
        A.pose = 'brr'; A.dip = Math.sin(G.t * 9) * 2; if (G.t > 2.2) endGame();
        break; }
    }
  }
  function warSplash(G, from, to, n) {                 // a sheet of water from one to the other
    const d = sgn(to.x - from.x), y = surf(from.x) - 3; for (let i = 0; i < n; i++) drop(from.x + d * rnd(8, 14), y, d * rnd(45, 115), rnd(-165, -70)); poke(from.x + d * 14, 44, 7); SND.splash(0.22); from.arm = S.t + 0.3; to.soak = S.t + 0.5;
  }

  // ------------------------------------------------------------------ the screen
  function css() {
    if (document.getElementById('pl-css')) return; const s = document.createElement('style'); s.id = 'pl-css';
    s.textContent = `
.pl-off{display:none!important}
.pl-body{flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;gap:6px;margin-top:6px;position:relative}
.pl-stage{position:relative;flex:1 1 auto;min-height:0;min-width:0;border-radius:12px;overflow:hidden;background:#8fe6f8;box-shadow:0 0 0 3px #fff}
.pl-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;image-rendering:pixelated;touch-action:none}
.pl-bar{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:62px;gap:6px;height:130px;align-content:start}
.pl-b{position:relative;min-width:60px;min-height:60px;margin:0;padding:0;border-radius:18px;background:#fff;color:#000;font-size:32px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(0,0,0,.3);touch-action:manipulation;overflow:hidden;animation:pl-in .18s both}
@keyframes pl-in{from{transform:scale(.6);opacity:0}}
.pl-b:active{transform:translateY(2px)}
.pl-b canvas{pointer-events:none;display:block}
.pl-b.jump{background:#fff1b8}.pl-b.game{background:#d3f0ff}.pl-b.board{background:#c9f7d0}
.pl-b.on{background:#ffcf4a;box-shadow:0 0 0 4px #fff,0 4px 0 rgba(0,0,0,.3)}
.pl-top .pl-b{flex:0 0 60px;width:60px;height:60px}
.pl-sp{flex:1 1 auto}
.pl-bub{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#000;border-radius:14px;padding:3px 9px;font-size:26px;line-height:1.15;white-space:nowrap;box-shadow:0 3px 0 rgba(0,0,0,.25);pointer-events:none;z-index:2;animation:pl-pop .2s both}
.pl-bub.pl-score{font-size:22px;background:#fff8d8;padding:5px 9px;box-shadow:0 0 0 3px #ffcf4a,0 4px 0 rgba(0,0,0,.25)}
@keyframes pl-pop{from{transform:translate(-50%,-100%) scale(.3)}}
.pl-pick{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:12px;background:linear-gradient(#7fdcf6,#d4f5ff 52%,#c3c9d1 52%,#aab1ba);overflow:hidden}
.pl-prev{image-rendering:pixelated;flex:0 1 auto;height:min(30vh,210px);aspect-ratio:4/3;min-height:0}
.pl-grid{display:grid;grid-template-columns:repeat(5,62px);grid-auto-rows:62px;gap:6px;flex:0 0 auto}
.pl-pick .pl-b{animation:none}
.pl-go{background:#7bd36b;font-size:36px}
.pl-go.hop{animation:pl-hop .45s infinite alternate}
@keyframes pl-hop{to{transform:translateY(-5px) scale(1.06)}}
.pl-x{background:#e9e4ff}
#app:has(.pl-body) #wishBtn,#app:has(.pl-body) #reqBtn{display:none}
#panel>.pl-top.pl-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:60px;flex-direction:column;gap:6px;z-index:6}
#panel>.pl-top.pl-land .pl-sp{display:none}
#panel>.pl-body.pl-land{flex-direction:row;margin:0 0 0 68px}
.pl-land .pl-bar{grid-template-columns:repeat(2,62px);height:auto;width:130px;align-content:center}
.pl-land .pl-pick{flex-direction:row;gap:16px}
.pl-land .pl-prev{height:auto;width:min(250px,calc(100vw - 470px - env(safe-area-inset-left) - env(safe-area-inset-right)))}
`;
    document.head.append(s);
  }
  const tapB = (cls, label, fn) => { const b = mk('button', 'pl-b ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('pointerup', e => { e.stopPropagation(); if (S) fn(b, e); }); return b; };
  function icon(fn, w, h, cw) {                       // a little picture for a button
    const c = mk('canvas'); c.width = w || 60; c.height = h || 60; c.style.width = (cw || 56) + 'px'; c.style.height = Math.round((cw || 56) * c.height / c.width) + 'px';
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; try { fn(g); } catch (e) { } return c;
  }
  function fit(g, key, cx, cy, box, rot, flip) {      // a frame scaled into a box, its own middle at cx, cy
    const r = ART.f[key]; if (!r) return; const s = Math.min(2, box / Math.max(r[2], r[3]));
    g.save(); g.translate(cx, cy); if (rot) g.rotate(rot); g.scale(flip ? -s : s, s); const src = key.startsWith('m_') ? mframe(key) : null;
    if (src) g.drawImage(src, -r[2] / 2, -r[3] / 2); else g.drawImage(ART.img, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3] / 2, r[2], r[3]); g.restore();
  }
  function faceIcon(id) {
    return icon(g => {
      let r = null; try { r = FACES.img && (FACES.A['face_' + id + '_happy_smile'] || FACES.A['face_' + id + '_happy_rest']); } catch (e) { }
      if (r) g.drawImage(FACES.img, r[0], r[1], r[2], r[3], 0, 0, 60, 60); else { const q = ART.f[id[0] + '_stand']; g.imageSmoothingEnabled = false; g.drawImage(ART.img, q[0], q[1], q[2], 34, 4, 0, 60, 60); }
    });
  }
  const JUMPICO = {
    cannon: g => { fit(g, 'm_tuck', 30, 26, 44); g.fillStyle = '#39b8e8'; for (let i = 0; i < 7; i++) g.fillRect(8 + i * 7, 50 - (i % 2) * 4 - (i === 3 ? 4 : 0), 4, 6 + (i % 2) * 4); },
    pencil: g => fit(g, 'm_pencil', 30, 30, 58),
    star: g => fit(g, 'm_star', 30, 30, 56),
    flip: g => { fit(g, 'm_tuck', 30, 31, 36, 0.6); g.strokeStyle = '#ff7a1a'; g.lineWidth = 4; g.beginPath(); g.arc(30, 30, 25, -2.2, 2.6); g.stroke(); g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(3, 47); g.lineTo(17, 44); g.lineTo(9, 56); g.fill(); },
    belly: g => { fit(g, 'm_star', 30, 24, 46, Math.PI / 2); g.fillStyle = '#39b8e8'; g.fillRect(4, 50, 52, 5); g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) g.fillRect(6 + i * 9, 46, 4, 4); },
    super: g => { g.fillStyle = '#ffcf4a'; for (let i = 0; i < 5; i++) g.fillRect(2, 14 + i * 9, 16 - (i % 2) * 6, 3); fit(g, 'm_leap', 36, 30, 56); g.font = '18px sans-serif'; g.fillText('⭐', 0, 58); },
  };
  const boardIcon = g => { g.fillStyle = '#8a97a6'; g.fillRect(6, 44, 10, 12); g.fillStyle = '#f4f7fa'; g.fillRect(2, 40, 44, 5); g.fillStyle = '#62c7e8'; g.fillRect(2, 44, 44, 2); fit(g, 'm_stand', 34, 20, 40); g.fillStyle = '#39b8e8'; g.fillRect(40, 54, 20, 6); };
  const shIcon = id => g => { const q = ART.f[id[0] + '_stand']; g.drawImage(ART.img, q[0], q[1], q[2], 36, 13, 26, 34, 36); fit(g, 'm_sit', 26, 16, 34); };
  function syncBar() {
    const M = S.M, G = S.game, A = S.A;
    const mode = S.pick || S.leaving ? 'none' : G && G.id === 'shoulders' && G.ph !== 'gather' ? 'sh' : (onDeck(M) || (M.st === 'air' && JUMPLIST.includes(M.air.kind)) || M.st === 'climb' || (M.plan && M.plan.out)) && !S.wantGame ? 'jump' : 'water';
    const key = mode + '|' + (A ? A.id : ''), on = G ? G.id : S.wantGame || '';
    if (key !== S.barKey) {
      S.barKey = key; S.bar.innerHTML = '';
      if (mode === 'jump') for (const k of JUMPLIST) { const b = mk('button', 'pl-b jump'); b.type = 'button'; b.setAttribute('aria-label', 'jump ' + k); b.dataset.k = k; b.append(icon(JUMPICO[k]));
        b.addEventListener('pointerdown', e => { e.stopPropagation(); if (S && !S.pick) { S.hold = k; S.holdId = e.pointerId; startJump(k); } }); S.bar.append(b); }
      else if (mode === 'water') {
        const b = tapB('board', 'out to the diving board', () => toDeck()); b.append(icon(boardIcon)); S.bar.append(b);
        if (A) for (const [id, ico] of GAMES) { const q = tapB('game', 'game ' + id, () => startGame(id)); q.dataset.k = id; if (ico) q.textContent = ico; else q.append(icon(shIcon(A.id))); S.bar.append(q); }
      } else if (mode === 'sh') {
        const d = tapB('jump', 'dive off', () => { const G2 = S.game; if (!G2 || G2.id !== 'shoulders' || G2.ph !== 'on') return; const dir = S.A.dir; endGame(true); S.M.y -= 6; launch(S.M, 'dive', 0.3, dir); }); d.append(icon(g => fit(g, 'm_glide', 30, 30, 56, 0.6))); S.bar.append(d);
        const w = tapB('game', 'splash war', () => startGame('war')); w.textContent = '💦'; S.bar.append(w);
        const dn = tapB('', 'get down', () => endGame()); dn.textContent = '⬇️'; S.bar.append(dn);
      }
    }
    if (on !== S.barOn) { S.barOn = on; for (const b of S.bar.children) b.classList.toggle('on', !!on && b.dataset.k === on); }
    const fo = A ? A.id : ''; if (fo !== S.faceOn) { S.faceOn = fo; for (const b of S.faces) b.classList.toggle('on', b.dataset.id === fo); }
  }
  function toDeck() { const M = S.M; if (S.leaving) return; endGame(); if (M.st === 'float') leaveSeat(M, false); dropThings(M); M.jump = null; if (M.st === 'swim') swimTo(M, X0 + 9, 0, { out: 1 }); }

  // the swimsuit picker: ten suits, four extras, and a big green tick
  function buildPick() {
    const p = S.pickEl = mk('div', 'pl-pick'), prev = S.prev = mk('canvas', 'pl-prev'), grid = mk('div', 'pl-grid'); prev.width = 96; prev.height = 72;
    const sync = () => { for (const b of grid.children) b.classList.toggle('on', b.dataset.id ? b.dataset.id === LOOK.suit : b.dataset.k ? !!LOOK.x[b.dataset.k] : false); };
    for (const s of SUITS) { const b = tapB('pl-suit', 'swimsuit ' + s.id, () => { LOOK.suit = s.id; S.twirl = S.t; jingle([0, 7, 12], 0.05); sync(); }); b.dataset.id = s.id;
      b.append(icon(g => { g.imageSmoothingEnabled = false; g.drawImage(mframe('m_stand', { suit: s.id, x: {} }), 3, 24, 22, 23, 0, 0, 22, 23); }, 22, 23, 52)); b.firstChild.style.imageRendering = 'pixelated'; grid.append(b); }
    const XICO = { gog: g => g.drawImage(mframe('m_stand', { suit: 'pink', x: { gog: true } }), 2, 4, 27, 24, 0, 0, 27, 24), cap: g => g.drawImage(mframe('m_stand', { suit: 'pink', x: { cap: true } }), 0, 0, 29, 26, 0, 0, 29, 26),
      arm: g => g.drawImage(mframe('m_stand', { suit: 'pink', x: { arm: true } }), 0, 20, 29, 26, 0, 0, 29, 26), tail: g => { g.imageSmoothingEnabled = true; const c = mframe('m_merglide', { suit: 'pink', x: {} }); g.drawImage(c, 0, 0, c.width, c.height, 0, 3, 58, 26); } };
    for (const k of EXTRAS) { const b = tapB('pl-x', 'extra ' + k, () => { LOOK.x[k] = !LOOK.x[k]; S.twirl = S.t; try { Audio2.blip(LOOK.x[k] ? 9 : 2, 'triangle', 0.08, 0.14); } catch (e) { } sync(); }); b.dataset.k = k;
      b.append(k === 'tail' ? icon(XICO[k], 58, 32, 54) : icon(g => { g.imageSmoothingEnabled = false; XICO[k](g); }, k === 'gog' ? 27 : 29, k === 'gog' ? 24 : 26, 48)); if (k !== 'tail') b.firstChild.style.imageRendering = 'pixelated'; grid.append(b); }
    const go = tapB('pl-go hop', 'go swimming', () => startSwim()); go.textContent = '✅'; grid.append(go);
    p.append(prev, grid); S.body.append(p); sync();
  }
  function pickDraw(dt) {
    S.t += dt; const g = S.prev.getContext('2d'), t = S.t, tw = S.twirl != null && t - S.twirl < 0.5 ? (t - S.twirl) / 0.5 : 1; g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 72);
    const hop = tw < 1 ? Math.sin(tw * Math.PI) * 7 : Math.max(0, Math.sin(t * 2.2)) * 1.5, sx = tw < 1 ? Math.cos(tw * TAU) : 1;
    g.fillStyle = 'rgba(40,50,70,.22)'; g.beginPath(); g.ellipse(48, 68, 14 - hop * 0.6, 3, 0, 0, TAU); g.fill();
    if (LOOK.x.tail) { spr(g, fr('m_mer', t, 7), 50, 36 - hop + Math.sin(t * 3) * 2); if (chance(0.2)) S.psp.push({ x: rnd(8, 30), y: rnd(20, 50), t }); for (const p of S.psp) { const k = (t - p.t) / 0.7; if (k < 1) px(g, p.x, p.y - k * 6, 1 + (k < 0.5), 1 + (k < 0.5), k < 0.5 ? '#ffffff' : '#fff3a0'); } S.psp = S.psp.filter(p => t - p.t < 0.7); }
    else spr(g, tw < 1 ? 'm_y' : 'm_stand', 48, 68 - hop, { sx: sx < 0 ? -Math.max(0.2, -sx) : Math.max(0.2, sx) });
  }
  function startSwim() {
    if (!S || !S.pick) return; saveLook(); S.pick = false; S.pickEl.remove(); S.pickEl = null; for (const b of S.hide) b.classList.remove('pl-off');
    S.last = performance.now(); layout(); jingle([0, 4, 7, 12], 0.06); S.M.hopT = S.t;
  }

  function open(opts) {
    opts = opts || {}; const panel = document.getElementById('panel'); if (!panel) return false;
    if (S) teardown();
    try { UI.closeActions(); } catch (e) { } try { clearWish(); } catch (e) { }
    css(); voIndex(); readLook(); loadArt(); panel.innerHTML = ''; panel.classList.remove('hidden');
    S = { opts, panel, t: 0, last: performance.now(), ready: false, pick: true, leaving: false, V: { w: 226, h: 300 }, cam: { x: null, y: 0, sh: 0, kick: 0, ox: 0, oy: 0 },
      wh: new Float32Array(NW), wv: new Float32Array(NW), swell: 0, P: [], FX: [], wet: [], lens: [], bubs: [], jets: [], psp: [], toys: newToys(), M: newMarina(), A: null, B: null, game: null, wantGame: null,
      bend: 0, twang: null, hold: null, cat: { st: 0, t: 0 }, fly: { x: 240, y: -30, t: Math.random() * 9, scare: 0 }, birds: [0, 1, 2].map(i => ({ x: 60 + i * 130, y: -250 - i * 34, ph: i * 2 })),
      clouds: [0, 1, 2, 3].map(i => ({ x: i * 120 + 30, y: -178 - (i % 2) * 70 - i * 22, v: 3 + i })), jumps: 0, games: 0, found: 0, swam: false, taps: 0, muffled: false, rainbow: null, lights: null, flag: null, ping: null };
    if (opts.with === 'daddy' || opts.with === 'rory') S.A = newAdult(opts.with, true);
    // top row: ❌ first (the sideways ❌ and the rest of the game look for it there), the towel, then the two faces
    const top = S.top = mk('div', 'ptop pl-top'), x = tapB('pbtn', 'close', () => finish()); x.className = 'pbtn'; x.textContent = '❌';
    const tw = tapB('pl-towel', 'towel: get out', () => leave()); S.faces = ['daddy', 'rory'].map(id => { const b = tapB('pl-face', 'call ' + id, () => callAdult(id)); b.dataset.id = id; return b; });
    S.hide = [tw, ...S.faces]; for (const b of S.hide) b.classList.add('pl-off');
    top.append(x, tw, mk('div', 'pl-sp'), ...S.faces);
    const body = S.body = mk('div', 'pl-body'), stage = S.stage = mk('div', 'pl-stage'), cv = S.cv = mk('canvas', 'pl-cv'); S.bar = mk('div', 'pl-bar'); S.g = cv.getContext('2d');
    stage.append(cv); body.append(stage, S.bar); panel.append(top, body); S.twIco = tw;
    bind(); layout();
    S.onResize = () => { layout(); clearTimeout(S.rzT); const st = S; S.rzT = setTimeout(() => { if (S === st) layout(); }, 320); };
    addEventListener('resize', S.onResize); addEventListener('orientationchange', S.onResize);
    S.onUp = e => { if (S && S.hold && (S.holdId == null || e.pointerId === S.holdId)) S.hold = null; };       // on window, before calm.js can swallow the lift of a finger that slid
    addEventListener('pointerup', S.onUp, true); addEventListener('pointercancel', S.onUp, true);
    S.raf = requestAnimationFrame(frame);
    return true;
  }
  function ready() {                                  // the pictures are here: build what is drawn only once
    S.ready = true; S.twIco.append(icon(g => fit(g, 'p_towel', 30, 30, 52))); for (const b of S.faces) b.append(faceIcon(b.dataset.id));
    buildBack(); buildPick(); layout();
  }
  function layout() {
    if (!S) return; const land = innerWidth > innerHeight; S.top.classList.toggle('pl-land', land); S.body.classList.toggle('pl-land', land);
    const r = S.stage.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return; S.stageR = r;
    const sc = Math.max(r.height / (land ? 226 : 340), r.width / (land ? WW : 226)), w = clamp(Math.round(r.width / sc), 120, WW), h = Math.max(120, Math.round(r.height / sc));
    if (S.cv.width !== w || S.cv.height !== h) { S.cv.width = w; S.cv.height = h; } S.V = { w, h }; S.cam.x = null;
  }
  function frame(now) {
    if (!S) return;
    if (!S.body.isConnected || S.panel.classList.contains('hidden')) { finish(true); return; }      // something else closed the panel
    const dt = clamp((now - S.last) / 1000, 0.001, 0.05); S.last = now;
    if (ART && !S.ready) ready();
    if (S.ready) { if (S.pick) pickDraw(dt); else { step(dt); if (!S) return; draw(); } }
    S.raf = requestAnimationFrame(frame);
  }
  function step(dt) {
    S.t += dt; const M = S.M; waveStep(dt); if (!S.game || S.game.id !== 'whirl') S.swell *= Math.exp(-dt * 2.5);
    if (S.wantGame && !S.game && S.A && S.A.wet && S.A.st === 'idle' && (M.st === 'swim' || M.st === 'float')) beginGame(S.wantGame);
    gameStep(dt); marinaStep(dt); if (!S) return;
    if (S.A) adultStep(S.A, dt); if (S.B) { adultStep(S.B, dt); if (S.B.x > WW + 40) S.B = null; }
    for (const t of S.toys) toyStep(t, dt); jetStep(dt); partStep(dt);
    for (let i = S.FX.length - 1; i >= 0; i--) { S.FX[i].t += dt; if (S.FX[i].t > 1.3) S.FX.splice(i, 1); }
    while (S.wet.length && S.t - S.wet[0].t > 9) S.wet.shift();
    for (let i = S.lens.length - 1; i >= 0; i--) { const l = S.lens[i]; if (S.t > l.t) l.y += l.vy * dt; if (S.t - l.t > l.life) S.lens.splice(i, 1); }
    if (S.twang != null && M.st !== 'bounce' && !(S.A && S.A.st === 'bounce')) { const k = S.t - S.twang; S.bend = -3 * Math.exp(-k * 5) * Math.cos(k * 30); if (k > 1) { S.twang = null; S.bend = 0; } }
    const c = S.cat; c.t += dt; if (c.st === 1 && c.t > 0.9) { c.st = 2; c.t = 0; } else if (c.st === 2 && c.t > 8) { c.st = 3; c.t = 0; } else if (c.st === 3 && c.t > 0.7) { c.st = 0; c.t = 0; } if (c.st === 1 && c.t - dt <= 0) { try { Audio2.sfx('meow2'); } catch (e) { } }
    const f = S.fly; f.t += dt; const up = f.scare > S.t ? 46 : 0; f.x += (238 + 112 * Math.sin(f.t * 0.31) + 16 * Math.sin(f.t * 2.3) - f.x) * Math.min(1, dt * 4); f.y += (-30 + 12 * Math.sin(f.t * 0.9) + 4 * Math.sin(f.t * 5) - up - f.y) * Math.min(1, dt * 4);
    for (const q of S.clouds) { q.x += q.v * dt; if (q.x > WW + 40) q.x = -40; }
    if (S.rainbow && S.t - S.rainbow.t0 > 6) S.rainbow = null;
    if (S.leaving) { S.leaveT = (S.leaveT || 0) + dt; if (M.st === 'swim' && !(M.plan && M.plan.exit)) swimTo(M, STEPX + 2, 0, { exit: 1 }); else if (M.st === 'deck') { setSt(M, 'towel'); jingle([0, 4, 7], 0.07, 'triangle'); } if (S.leaveT > 9) { finish(); return; } }
    camStep(dt); bubStep(); syncBar();
  }
  function leave() {                                  // the towel: up the steps, wrap up, shake, home
    if (!S || S.leaving) return; if (S.pick || !S.ready) { finish(); return; }
    S.leaving = true; S.hold = null; endGame(); const M = S.M; if (M.st === 'float') leaveSeat(M, false); dropThings(M); M.jump = null; M.plan = null; if (M.st === 'run') { M.arr = null; setSt(M, 'deck'); }
    jingle([12, 7, 4], 0.08, 'triangle');
  }

  // ------------------------------------------------------------------ fingers
  function bind() {
    const cv = S.cv, world = e => { const r = cv.getBoundingClientRect(); return [S.cam.x + (e.clientX - r.left) / r.width * S.V.w, S.cam.y + (e.clientY - r.top) / r.height * S.V.h]; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!S || S.pick || !S.ready || S.cam.x == null || e.isPrimary === false || e.button > 0) return; try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      const w = world(e); S.ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, drag: false, steer: tapWorld(w[0], w[1]) };
    });
    cv.addEventListener('pointermove', e => {
      const P = S && S.ptr; if (!P || P.id !== e.pointerId || !P.steer) return; if (!P.drag && Math.hypot(e.clientX - P.x0, e.clientY - P.y0) < 10) return; P.drag = true;
      const w = world(e), M = S.M, G = S.game;
      if (G && G.id === 'ride' && G.ph === 'ride') G.tgt = { x: clamp(w[0], X0 + 40, X1 - 50), y: clamp(w[1], 0, 60) };
      else if (G && G.id === 'shoulders') { if (G.ph === 'on') G.tx = clamp(w[0], STAND0 + 8, STAND1 - 8); }
      else if (M.st === 'swim' && inPool(w[0])) { M.tx = clamp(w[0], X0 + 8, X1 - 8); M.ty = w[1] < 7 ? 0 : w[1]; M.plan = null; }
    });
    const up = e => { if (S && S.ptr && S.ptr.id === e.pointerId) S.ptr = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  }
  // a finger on the pool at world x, y. -> true if she is now swimming after the finger (so a drag keeps steering)
  function tapWorld(x, y) {
    const M = S.M, A = S.A, G = S.game; if (S.leaving) return false; S.taps++;
    for (const t of S.toys) if (t.st === 'deck' && t.dive && Math.abs(x - t.x) < 6.5 && Math.abs(y - t.y) < 11) { throwIn(t); return false; }       // the treasure row: throw one in
    if (G && G.ph !== 'gather') {                     // in a game the finger means what the game needs
      if (G.id === 'ride') { G.tgt = { x: clamp(x, X0 + 40, X1 - 50), y: clamp(y, 0, 60) }; S.ping = { x, y: Math.max(y, 0), t: S.t }; return true; }
      if (G.id === 'war') { if (G.ph === 'war' && S.t - G.last > 0.1) { G.last = S.t; warSplash(G, M, A, 9); G.n++; G.mT = 1.3; } return false; }
      if (G.id === 'race') { if (G.ph === 'go') { G.boost = Math.min(1, G.boost + 0.3); for (let i = 0; i < 3; i++) drop(M.x + rnd(10, 24), surf(M.x) - 1, rnd(10, 60), rnd(-90, -40), { r: 1 }); } return false; }
      if (G.id === 'shoulders') { if (G.ph === 'on' && y > DECK - 60) { G.tx = clamp(x, STAND0 + 8, STAND1 - 8); return true; } return false; }
      if (G.id === 'rocket') return false;
      if (G.id === 'whirl') { if (inPool(x)) splash(x, 0.3, { dry: 1 }); return false; }
    }
    for (const t of S.toys.slice().sort((a, b) => (a.big || 0) - (b.big || 0))) {      // toys in the water (the little ones first: they sit in front of the big floats)
      if (t.st === 'sunk' || t.st === 'sink') { if (Math.abs(x - t.x) < 12 && Math.abs(y - t.y) < 13 && M.wet && (M.st === 'swim' || M.st === 'float')) { swimTo(M, t.x, t.y); return false; } continue; }
      if (t.st !== 'float') continue; const dx = Math.abs(x - t.x), dy = y - t.y;
      if (t.k === 'ball') { if (dx < 16 && Math.abs(dy) < 16) { bop(t, A && A.wet ? sgn(A.x - t.x) * rnd(30, 90) : rnd(-70, 70), -205); return false; } }
      else if (t.k === 'duck') { if (dx < 13 && Math.abs(dy) < 15) { t.vy = -70; poke(t.x, 20, 5); tone('square', 950, 700, 0.09, 0.14); tone('square', 1000, 640, 0.1, 0.14, 0.12); return false; } }
      else if (t.big) { if (dx < t.w - 3 && dy > -30 && dy < 10) {
        if (t.rider === M) leaveSeat(M, true); else if (t.rider && t.rider === A) { if (A.act) A.act.tip = 1; } else if (M.wet && (M.st === 'swim' || M.st === 'float') && !G) swimTo(M, t.x, 0, { seat: t }); else if (onDeck(M) && M.st !== 'bounce') hopIn(M, t.x - 30);
        return false; } }
      else if (dx < 16 && Math.abs(dy) < 12) {
        if (t.held === M) { if (t.k === 'blaster') squirt(); else { t.held = null; if (M.noodle === t) M.noodle = null; if (M.fin === t) M.fin = null; t.x = M.x; } return false; }
        if (M.wet && (M.st === 'swim' || M.st === 'float') && !G) { swimTo(M, t.x - (t.k === 'blaster' ? 10 * sgn(t.x - M.x) : 0), 0, { [t.k === 'blaster' ? 'gun' : t.k]: t }); return false; }
      }
    }
    for (const t of S.toys) if (t.st === 'deck' && !t.dive && Math.abs(x - t.x) < t.w + 3 && Math.abs(y - t.y) < 11) { throwIn(t); return false; }             // toys waiting on the far edge hop in
    if (S.cat.st === 0 && Math.abs(x - CAT.x) < 16 && y > CAT.y - 40 && y < CAT.y + 4) { S.cat.hop = S.t; try { Audio2.sfx(chance(0.5) ? 'meow1' : 'purr'); } catch (e) { } return false; }
    if (Math.hypot(x - S.fly.x, y - S.fly.y) < 10) { S.fly.scare = S.t + 2.5; SND.sparkle(); return false; }
    if (Math.abs(x - M.x) < 16 && Math.abs(y - M.y) < 27) {       // herself
      if (M.st === 'float') leaveSeat(M, true); else if (M.gun) squirt(); else if (M.st === 'swim') trick(M); else if (M.st === 'deck') { M.hopT = S.t; SND.plip(0.2); }
      return false;
    }
    if (A && A.wet && Math.abs(x - A.x) < 18 && y > A.top() - 4 && y < A.top() + 54) { tapAdult(A); return false; }
    if (inPool(x) && y > -34 && !(x < TIP + 6 && y < BRD + 5)) {  // the water: swim there (or hop in)
      if (M.st === 'deck' || (M.st === 'run' && !M.jump)) { hopIn(M, x); return false; }
      if (M.st === 'float') leaveSeat(M, false);
      if (M.st !== 'swim') return false; if (G && G.id !== 'marco') endGame();
      const fl = floorAt(x); S.ping = { x, y: Math.max(y, 0), t: S.t };
      if (y > fl - 9) { swimTo(M, x, fl - 10, { hand: 1 }); return false; }
      swimTo(M, x, y < 7 ? 0 : y); return true;
    }
    if (x <= TIP + 6 && y < DECK + 6) {               // the deck or the board
      if (M.st === 'deck' || (M.st === 'run' && !M.jump)) runTo(M, clamp(x, 8, TIP - 4), 100); else toDeck();
    }
    return false;
  }

  // ------------------------------------------------------------------ leaving
  function teardown() {
    if (!S) return; cancelAnimationFrame(S.raf); clearTimeout(S.rzT);
    removeEventListener('resize', S.onResize); removeEventListener('orientationchange', S.onResize); removeEventListener('pointerup', S.onUp, true); removeEventListener('pointercancel', S.onUp, true);
    for (const b of S.bubs) b.el.remove(); S = null; SND.under(false);
  }
  function finish(external) {                         // the towel, the ❌, or somebody else closing the panel: always the same way out
    if (!S) return; const st = S, res = { suit: LOOK.suit, swam: !!st.swam, jumps: st.jumps, games: st.games }; teardown();
    if (!external || st.body.isConnected) { st.panel.classList.add('hidden'); st.panel.innerHTML = ''; }
    try { if (typeof setMusic === 'function') setMusic(); } catch (e) { }
    if (typeof st.opts.onDone === 'function') st.opts.onDone(res);
  }
  function state() {                                  // a peek for tests
    if (!S) return { open: false }; const M = S.M, A = S.A, r = S.stageR || { left: 0, top: 0, width: 1, height: 1 }, sc = (x, y) => [r.left + (x - S.cam.x) / S.V.w * r.width, r.top + (y - S.cam.y) / S.V.h * r.height];
    return { open: true, ready: S.ready, pick: S.pick, leaving: S.leaving, t: S.t, V: S.V, cam: [S.cam.x, S.cam.y], look: { suit: LOOK.suit, x: Object.assign({}, LOOK.x) },
      M: { x: M.x, y: M.y, st: M.st, under: M.under, wet: M.wet, jump: M.jump || null, at: sc(M.x, M.y), seat: M.seat ? M.seat.k : null, noodle: !!M.noodle, gun: !!M.gun, fin: !!M.fin, plan: M.plan ? Object.keys(M.plan).join() : null, tx: M.tx },
      A: A ? { id: A.id, x: A.x, y: A.y, st: A.st, pose: A.pose, act: A.act ? A.act.k : null, wet: A.wet, at: sc(A.x, A.top() + 20) } : null, B: S.B ? S.B.id : null,
      game: S.game ? { id: S.game.id, ph: S.game.ph, t: S.game.t } : null, want: S.wantGame, jumps: S.jumps, games: S.games, found: S.found, bend: S.bend,
      toys: S.toys.map(t => ({ k: t.k, st: t.st, x: t.x, y: t.y, at: sc(t.x, t.y), rider: t.rider ? (t.rider === M ? 'marina' : 'adult') : null, held: !!t.held })), parts: S.P.length, bubs: S.bubs.map(b => b.el.textContent),
      geo: { X0, X1, DECK, TIP, BRD, SHAL, DEEP, STEPX, STAND0, STAND1, cat: sc(CAT.x, CAT.y - 16), surf: sc(200, 0), deck: sc(40, DECK - 4), board: sc(TIP - 20, BRD - 4) } };
  }

  // ------------------------------------------------------------------ drawing
  const TOPY = BACK - 143;                            // top of the picture of the garden
  function buildBack() {                              // everything that never moves, painted once: the garden, the deck, the pool shell, the earth
    const c = document.createElement('canvas'); c.width = WW; c.height = BOT - TOPY; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    const r = ART.f.bg; g.drawImage(ART.img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); const sk = g.getImageData(3, 1, 1, 1).data; S.sky = `rgb(${sk[0]},${sk[1]},${sk[2]})`;
    g.translate(0, -TOPY); let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // the stamped-stone deck, far edge to near edge
    px(g, 0, BACK, WW, DECK - BACK, '#b4bac3');
    for (let y = BACK, row = 0; y < DECK; y += row === 0 ? 5 : 6, row++) { const h = row === 0 ? 5 : 6; for (let x = -rr() * 14; x < WW;) { const w = 11 + rr() * 16; px(g, x + 1, y + 1, w - 1, h - 1, ['#b9bfc8', '#c3c9d1', '#adb4bd', '#bec4cc', '#b2b8c1'][(rr() * 5) | 0]); px(g, x + 2, y + 1, w - 3, 1, 'rgba(255,255,255,.22)'); px(g, x, y, 1, h, '#949ba6'); x += w; } px(g, 0, y, WW, 1, '#949ba6'); }
    for (let i = 0; i < 260; i++) px(g, rr() * WW, BACK + 1 + rr() * (DECK - BACK - 1), 1, 1, rr() < 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(90,96,108,.25)');
    px(g, 0, BACK, WW, 2, 'rgba(40,30,30,.35)');
    // the ground in cross-section
    const eg = g.createLinearGradient(0, DECK, 0, BOT); eg.addColorStop(0, '#80583a'); eg.addColorStop(1, '#4e3320'); g.fillStyle = eg; g.fillRect(0, DECK + 4, WW, BOT - DECK - 4);
    for (let i = 0; i < 420; i++) { const x = rr() * WW, y = DECK + 6 + rr() * (BOT - DECK - 8), k = rr(); px(g, x, y, k > 0.9 ? 3 : 1 + (k > 0.6), k > 0.9 ? 2 : 1, k > 0.9 ? '#a59d92' : k > 0.5 ? '#6b4a30' : '#93683f'); }
    pat(g, 30, 48, ['.ww....ww.', 'wwwwwwwwww', '.ww....ww.'], { w: '#e9e2d0' }); pat(g, 384, 66, ['.pp...', 'p..pp.', '....pp'], { p: '#e79aa8' });      // a buried bone, a worm
    px(g, 0, DECK, WW, 4, '#d4d8de'); px(g, 0, DECK, WW, 1, '#eceff3'); px(g, 0, DECK + 3, WW, 1, '#8b919b');             // the slab she stands on, seen from the edge
    // the pool itself, column by column: far coping, the dark blue tile line, the back wall, the floor
    const WT = hx('#8ae8e6'), WB = hx('#43b9d3'), tiles = {};
    for (let x = X0 - 4; x < X1 + 4; x++) {
      const inside = x >= X0 && x < X1, f = Math.round(inside ? floorAt(x + 0.5) : x < X0 ? DEEP : 6);
      px(g, x, DECK - 3, 1, f + 4 - (DECK - 3), '#eef1f4'); px(g, x, f + 4, 1, 1, '#aab1ba'); if (!inside) continue;
      px(g, x, DECK - 3, 1, 5, '#e2e6ea'); px(g, x, DECK + 2, 1, 1, '#a4abb4');
      for (let y = DECK + 3; y < 6; y++) { const k = ((x - X0) / 3 | 0) + ',' + ((y - DECK) / 3 | 0); px(g, x, y, 1, 1, tiles[k] || (tiles[k] = ['#1f4f9a', '#2a62b8', '#173e80', '#3477cc', '#1f4f9a'][(rr() * 5) | 0])); }
      for (let y = 6; y < f - 7; y++) { const cc = mixc(WT, WB, y / DEEP); px(g, x, y, 1, 1, `rgb(${cc[0] | 0},${cc[1] | 0},${cc[2] | 0})`); }
      px(g, x, f - 7, 1, 7, (x - X0) % 16 === 0 ? '#7fdfe2' : '#a9f2ee'); px(g, x, f - 7, 1, 1, '#6fd0d8'); px(g, x, f - 1, 1, 1, '#d8fbf8');
    }
    for (let x = X0 + 16; x < X1; x += 16) for (let y = 12; y < floorAt(x) - 8; y += 3) px(g, x, y, 1, 1, 'rgba(255,255,255,.14)');            // faint panel seams
    S.back = c;
    const p = S.poolPath = new Path2D(); p.moveTo(X0, DECK + 3); p.lineTo(X1, DECK + 3); for (let x = X1; x >= X0; x -= 1) p.lineTo(x, floorAt(Math.min(x, X1 - 0.5))); p.closePath();
    const q = S.caus = document.createElement('canvas'); q.width = 128; q.height = 64; const cg = q.getContext('2d'), im = cg.createImageData(128, 64);      // light ripples: a wobbly net that tiles
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) { const a = x / 128 * TAU, b = y / 64 * TAU, v = Math.sin(a * 3 + 1.7 * Math.sin(b * 2)) + Math.sin(b * 2 + 1.7 * Math.sin(a * 2 + 1)), k = Math.pow(Math.max(0, 1 - Math.abs(v) * 2.2), 1.6), i = (y * 128 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = k * 255; }
    cg.putImageData(im, 0, 0); S.small = {};
  }
  function small(k) {                                 // a half-size copy of a toy, with crisp edges
    let c = S.small[k]; if (c) return c; const r = ART.f['p_' + k], w = Math.ceil(r[2] / 2), h = Math.ceil(r[3] / 2); c = S.small[k] = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(ART.img, r[0], r[1], r[2], r[3], 0, 0, w, h);
    const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 105 ? 255 : 0; g.putImageData(im, 0, 0); return c;
  }
  const RING = ['..ooooo..', '.oAAAAAo.', 'oALoooAAo', 'oAo...oAo', 'oAo...oAo', 'oAo...oAo', 'oAAoooABo', '.oBBBBBo.', '..ooooo..'];
  const NOODLE = [['#ff5fa8', '#ffa6d0', '#c2357a'], ['#7ed63a', '#c2f27c', '#4c961c']];
  function drawToy(g, t) {
    const x = Math.round(t.x), y = Math.round(t.y);
    if (t.dive) {
      if (t.k[0] === 'r') pat(g, x - 4, y - 4, RING, t.k === 'ring1' ? { o: '#7a1640', A: '#ff5fa8', B: '#c93a80', L: '#ffc0dd' } : { o: '#7a5a00', A: '#ffd640', B: '#d8a020', L: '#fff3b0' });
      else { const c = small(t.k); g.drawImage(c, x - (c.width >> 1), y + 5 - c.height); }
      if (t.st === 'sunk' && (S.t * 1.1 + t.slot * 0.7) % 2.6 < 0.14) { px(g, x + 3, y - 7, 1, 3, '#ffffff'); px(g, x + 2, y - 6, 3, 1, '#ffffff'); }
      return;
    }
    if (t.k === 'noodle') {
      const C = NOODLE[t.c], held = !!t.held;
      for (let i = -16; i <= 16; i++) { const yy = y + (held ? -Math.max(0, Math.abs(i) - 8) * 1.6 : t.st === 'float' ? Math.sin(i * 0.22 + t.ph + S.t * 2) * 1.2 : 0) | 0; px(g, x + i, yy - 2, 1, 4, Math.abs(i) === 16 ? C[2] : C[0]); px(g, x + i, yy - 2, 1, 1, C[1]); px(g, x + i, yy + 1, 1, 1, C[2]); }
      return;
    }
    if (t.sm) { const c = small(t.k), fl = t.held ? t.held.dir < 0 : t.k === 'duck' && t.vx < -2; g.save(); g.translate(x, y); if (t.rot) g.rotate(t.rot); if (fl) g.scale(-1, 1); g.drawImage(c, -(c.width >> 1), -(c.height >> 1)); g.restore(); return; }
    spr(g, 'p_' + t.k, x, y, { rot: t.rot });
  }
  function drawMarina(g) {
    const M = S.M, sy = surf(clamp(M.x, X0, X1)), f = M.dir < 0, tail = LOOK.x.tail, G = S.game, x = M.x, y = M.y;
    switch (M.st) {
      case 'deck': { const k = M.hopT != null ? (S.t - M.hopT) / 0.4 : 1, hop = k < 1 ? Math.sin(k * Math.PI) * 8 : 0; spr(g, k < 1 ? 'm_y' : 'm_stand', x, y + 28 - hop, { flip: f }); break; }
      case 'run': spr(g, fr('m_run', M.at, M.sp > 150 ? 17 : 12), x, y + 28, { flip: f }); break;
      case 'bounce': spr(g, 'm_stand', x, y + 28, { sy: 1 - 0.13 * (M.sq || 0), sx: 1 + 0.07 * (M.sq || 0) }); break;
      case 'air': if (M.pose === 'm_y') spr(g, 'm_y', x, y + 32, { flip: f }); else spr(g, M.pose, x, y, { flip: f, rot: M.rot + (M.air.kind === 'pencil' ? Math.sin(S.t * 12) * 0.05 : 0) }); break;
      case 'plunge': if (M.t < 0.32) spr(g, M.pose === 'm_y' ? 'm_tuck' : M.pose, x, y, { flip: f, rot: M.rot }); else spr(g, tail ? fr('m_mer', M.at, 9) : fr('m_under', M.at, 8), x, y, { flip: f, rot: -1 * M.dir * Math.min(1, (M.t - 0.32) * 5) }); break;
      case 'cheer':
        if (tail) spr(g, fr('m_mer', M.at, 6), x, y + 18, { flip: f, rot: -Math.PI / 2 * M.dir });
        else spr(g, M.t < 0.6 ? fr('m_tread', M.at, 10) : fr('m_cheer', M.t - 0.6, 5), x + (M.t < 0.6 ? Math.round(Math.sin(S.t * 46)) : 0), y + 28, { flip: f });
        break;
      case 'swim': {
        const v = Math.hypot(M.vx, M.vy), sub = y > sy + 9, mv = v > 14;
        if (sub || (tail && mv)) spr(g, tail ? (mv ? fr('m_mer', M.at, 9) : fr('m_mer', M.at, 3)) : fr('m_under', M.at, mv ? 8 : 2.5), x, y, { flip: f, rot: (v > 10 ? clamp(Math.atan2(M.vy, Math.abs(M.vx) + 6), -1.15, 1.15) : 0) * M.dir });
        else if (M.noodle) spr(g, 'm_sit', x, y + 31 + Math.sin(S.t * 5) * 1, { flip: f });
        else if (mv) spr(g, fr('m_swim', M.at, 9), x, y, { flip: f, rot: clamp((surf(x + 6) - surf(x - 6)) * 0.04, -0.2, 0.2) });
        else if (tail) spr(g, fr('m_mer', M.at, 4), x, y + 18, { flip: f, rot: -Math.PI / 2 * M.dir });
        else spr(g, fr('m_tread', M.at, 7), x, y + 28, { flip: f });
        break; }
      case 'hand': if (tail) spr(g, fr('m_mer', M.at, 8), x, floorAt(x) - 42, { flip: f, rot: Math.PI / 2 * M.dir }); else spr(g, 'm_y', x, floorAt(x) - 68, { rot: Math.PI + Math.sin(S.t * 5) * 0.08, sx: Math.sin(S.t * 3) > 0 ? 1 : -1 }); break;
      case 'flip': spr(g, tail ? 'm_merglide' : 'm_tuck', x, y, { flip: f, rot: M.rot }); break;
      case 'float': if (M.seat && M.seat.k === 'unicorn') spr(g, 'm_sit', x + 7, y + 28, { flip: true, rot: M.seat.rot }); else spr(g, 'm_float', x, y, { rot: M.seat ? M.seat.rot : 0 }); break;
      case 'held': {
        const id = G ? G.id : '';
        if (id === 'ride') spr(g, 'm_glide', x, y, { flip: f, rot: M.rot });
        else if (id === 'rocket') spr(g, 'm_y', x, y + 30, { flip: f });
        else if (id === 'shoulders') spr(g, 'm_sit', x, y + 28, { flip: f });
        else if (id === 'war') spr(g, S.t < (M.arm || 0) || G.ph === 'rainbow' ? fr('m_cheer', S.t, 9) : fr('m_tread', M.at, 8), x, y + 28, { flip: f });
        else if (id === 'race') spr(g, tail ? fr('m_mer', M.at, 13) : fr('m_swim', M.at, G.ph === 'go' ? 14 : 3), x, y, { flip: f });
        else spr(g, fr(tail ? 'm_mer' : 'm_under', M.at, 10), x, y, { flip: f, rot: M.rot });
        break; }
      case 'climb': spr(g, fr('m_run', M.at, 9), x, y + 28, { flip: true }); break;
      case 'out': spr(g, fr('m_run', M.at, 9), x, y + 28); break;
      case 'towel': {
        const sh = M.t > 0.5 && M.t < 1.3 ? Math.round(Math.sin(S.t * 44) * 1.4) : 0, fy = Math.round(y + 28); spr(g, M.t > 1.4 ? 'm_y' : 'm_stand', x + sh, fy);
        if (M.t > 0.25) { for (let j = 0; j < 24; j++) { const w = j < 2 ? 8 : j > 21 ? 9 : 10; px(g, x + sh - w, fy - 37 + j, w * 2, 1, (j >> 2) & 1 ? '#ff7ab8' : '#ffe27a'); px(g, x + sh - w, fy - 37 + j, 1, 1, '#b8497f'); px(g, x + sh + w - 1, fy - 37 + j, 1, 1, '#b8497f'); } px(g, x + sh - 8, fy - 38, 16, 1, '#fff6c8'); px(g, x + sh - 9, fy - 13, 18, 1, '#b8497f'); }
        break; }
    }
  }
  function drawAdult(g, A) {
    const c = A.c, o = { flip: A.dir < 0 }; let key = c + '_stand';
    switch (A.pose) {
      case 'wade': key = fr(c + '_wade', A.t, 8); break;
      case 'crouch': key = c + '_throw_0'; break;
      case 'throw': key = fr(c + '_throw', S.t, 9); break;
      case 'up': key = c + '_throw_2'; break;
      case 'open': key = c + '_throw_1'; break;
      case 'eyes': key = c + '_eyes_1'; break;
      case 'brr': key = c + '_brr'; break;
      case 'tuck': key = c + '_tuck'; o.rot = A.rot; spr(g, key, A.x, A.y, o); return;
      case 'swim': key = A.still ? c + '_swim_0' : fr(c + '_swim', A.t, 9); o.rot = A.rot; spr(g, key, A.x, A.y, o); return;
      case 'back': o.cy = A.h / 2; o.rot = -Math.PI / 2 * A.dir; spr(g, key, A.x, A.y + A.h / 2, o); return;      // the standing picture laid on its back
    }
    if (A.pose === 'stand' && S.t < (A.arm || 0)) key = c + '_throw_2';
    spr(g, key, A.x, A.y + A.dip, o);
  }
  function drawCat(g) {                               // Niko watches from the fence (if the game's atlas has him)
    let cv = null; try { if (typeof has === 'function' && has('niko_sit')) cv = spriteCanvas('niko_sit'); } catch (e) { } if (!cv) return;
    const c = S.cat, w = cv.width * 0.5, h = cv.height * 0.5; let dy = 0;
    if (c.st === 1) dy = c.t < 0.3 ? -Math.sin(c.t / 0.3 * Math.PI) * 12 : (c.t - 0.3) / 0.6 * (h + 4); else if (c.st === 2) return; else if (c.st === 3) dy = (1 - c.t / 0.7) * (h + 4);
    else if (c.hop != null && S.t - c.hop < 0.35) dy = -Math.sin((S.t - c.hop) / 0.35 * Math.PI) * 4;
    g.save(); g.beginPath(); g.rect(CAT.x - w, CAT.y - h - 22, w * 2, h + 23); g.clip(); g.imageSmoothingEnabled = true; g.drawImage(cv, CAT.x - w / 2, CAT.y - h + dy, w, h); g.restore(); g.imageSmoothingEnabled = false;
  }
  function drawCrown(g, f) {                          // the sheet of water a splash throws up
    const T = 0.5 + 0.3 * f.s, k = f.t / T, y0 = surf(f.x) + 1;
    if (k < 1) { const H = (30 + 74 * f.s) * Math.sin(Math.PI * Math.min(1, k * 1.15)), W = (8 + 17 * f.s) * (0.5 + k) * f.w; g.fillStyle = 'rgba(236,252,255,' + (0.85 * (1 - k * k)).toFixed(2) + ')';
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(f.x + sd * 2, y0); g.quadraticCurveTo(f.x + sd * W * 0.6, y0 - H * 1.1, f.x + sd * W * 1.5, y0 - H * 0.75); g.quadraticCurveTo(f.x + sd * W * 1.1, y0 - H * 0.3, f.x + sd * W * 0.9, y0); g.fill(); } }
    const k2 = (f.t - 0.14) / (T * 1.15); if (f.s > 0.6 && k2 > 0 && k2 < 1) { const h2 = (22 + 52 * f.s) * Math.sin(Math.PI * k2); g.fillStyle = 'rgba(205,245,255,' + (0.8 * (1 - k2)).toFixed(2) + ')'; g.beginPath(); g.moveTo(f.x - 4, y0); g.quadraticCurveTo(f.x - 2, y0 - h2, f.x, y0 - h2 - 2); g.quadraticCurveTo(f.x + 2, y0 - h2, f.x + 4, y0); g.fill(); }
  }
  function draw() {
    const g = S.g, V = S.V, c = S.cam, M = S.M, A = S.A, G = S.game, t = S.t; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
    const cx = Math.round(c.x + c.ox), cy = Math.round(c.y + c.oy);
    if (cy < TOPY) { const gr = g.createLinearGradient(0, TOPY - 300 - cy, 0, TOPY - cy); gr.addColorStop(0, '#3a8fe2'); gr.addColorStop(1, S.sky); g.fillStyle = gr; g.fillRect(0, 0, V.w, TOPY - cy + 1); }
    g.translate(-cx, -cy);
    if (cy < TOPY) {                                  // high up: the sun, clouds, birds
      g.fillStyle = '#fff7b8'; g.beginPath(); g.arc(336, TOPY - 150, 15, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,247,184,.35)'; g.beginPath(); g.arc(336, TOPY - 150, 21 + Math.sin(t * 2) * 1.5, 0, TAU); g.fill();
      for (const q of S.clouds) spr(g, 'p_cloud', q.x, q.y);
      for (const b of S.birds) { const bx = (b.x + t * 14) % (WW + 40) - 20, by = b.y + Math.sin(t + b.ph) * 4, fl = Math.sin(t * 9 + b.ph) > 0 ? 1 : 0; px(g, bx - 3, by - fl, 2, 1, '#2b3550'); px(g, bx - 1, by + 1 - fl, 1, 1, '#2b3550'); px(g, bx, by + 1, 1, 1, '#2b3550'); px(g, bx + 1, by + 1 - fl, 1, 1, '#2b3550'); px(g, bx + 2, by - fl, 2, 1, '#2b3550'); }
    }
    g.drawImage(S.back, 0, TOPY); drawCat(g);
    for (const w of S.wet) { const a = clamp(1 - (t - w.t) / 9, 0, 1) * 0.3; px(g, w.x - (w.w >> 1), w.y, w.w, w.w > 2 ? 2 : 1, 'rgba(50,60,84,' + a.toFixed(2) + ')'); }
    for (const q of S.toys) if (q.st === 'deck') drawToy(g, q);
    // light under the water: ripples on the walls and floor, slanting beams
    g.save(); g.clip(S.poolPath); g.globalCompositeOperation = 'lighter';
    for (let L = 0; L < 2; L++) { g.globalAlpha = L ? 0.2 : 0.26; const ox = ((L ? -t * 5 : t * 8) % 128 + 128) % 128, oy = ((L ? t * 3 : t * 2.2) % 64 + 64) % 64; for (let x = X0 - ox; x < X1; x += 128) for (let y = 4 - oy; y < DEEP; y += 64) g.drawImage(S.caus, x, y); }
    g.globalAlpha = 0.07; g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const x = X0 + 30 + i * 58 + Math.sin(t * 0.6 + i * 2) * 12, w = 10 + (i % 3) * 5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + 34, DEEP); g.lineTo(x + 26, DEEP); g.fill(); }
    g.restore();
    if (G && G.id === 'whirl' && G.ph === 'spin') { g.strokeStyle = 'rgba(255,255,255,' + (0.8 * G.pw).toFixed(2) + ')'; g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const a0 = G.th * (0.6 + i * 0.1) + i * 1.3, r = 0.28 + i * 0.16; g.beginPath(); g.ellipse(G.cx, 27, 84 * r, 19 * r + 3, 0, a0, a0 + 1.7); g.stroke(); } }
    // the hand-rail by the steps, the little ladder by the board, the board itself
    g.lineWidth = 2; g.strokeStyle = '#c3ccd6'; g.beginPath(); g.moveTo(X1 + 12, DECK); g.lineTo(X1 + 12, DECK - 12); g.quadraticCurveTo(X1 + 10, DECK - 20, X1 + 2, DECK - 17); g.lineTo(X1 - 20, 8); g.stroke(); g.lineWidth = 1; g.strokeStyle = '#f2f6fa'; g.beginPath(); g.moveTo(X1 + 11, DECK - 1); g.lineTo(X1 + 11, DECK - 12); g.quadraticCurveTo(X1 + 9, DECK - 20, X1 + 2, DECK - 18); g.lineTo(X1 - 20, 7); g.stroke();
    px(g, X0 - 7, DECK - 11, 2, 11, '#c3ccd6'); px(g, X0 - 7, DECK - 12, 11, 2, '#dfe6ee'); px(g, X0 + 3, DECK - 11, 2, 36, '#c3ccd6'); for (let y = 4; y < 24; y += 8) px(g, X0, y, 4, 1, '#dfe6ee');
    px(g, BRD0 - 1, DECK - 4, 5, 4, '#7d8b9c'); px(g, BRD0 + 3, DECK - 8, 5, 8, '#8d9bab'); px(g, BRD0 - 1, DECK - 4, 5, 1, '#c5d0dc'); px(g, BRD0 + 3, DECK - 8, 5, 1, '#c5d0dc');           // the diving board: two steps, a stand with rails, a springy plank
    px(g, 64, BRD + 4, 18, DECK - BRD - 4, '#7f8fa1'); px(g, 66, BRD + 4, 3, DECK - BRD - 4, '#a9b7c6'); px(g, 62, DECK - 2, 22, 2, '#667485');
    for (const rx of [65, 77]) { px(g, rx, BRD - 12, 1, 12, '#dfe6ee'); px(g, rx + 1, BRD - 12, 1, 12, '#9fb0c2'); } px(g, 65, BRD - 13, 14, 1, '#f2f6fa'); px(g, 65, BRD - 12, 14, 1, '#9fb0c2');
    for (let x = BRD0 + 6; x < TIP + 5; x += 2) { const y = Math.round(plankY(x)); px(g, x, y, 2, 1, (x >> 2) & 1 ? '#7fd8f0' : '#ffffff'); px(g, x, y + 1, 2, 2, '#f1f5f9'); px(g, x, y + 3, 2, 2, x > TIP + 2 ? '#1c8fb3' : '#2aa6c9'); }
    for (const q of S.toys) if (q.st === 'sunk' || q.st === 'sink' || (q.st === 'fly' && q.dive)) drawToy(g, q);
    // people and toys
    for (const q of S.toys) if (q.st === 'float' && q.big) drawToy(g, q);           // the big floats sit behind people, so nobody's face is hidden
    if (S.B) drawAdult(g, S.B); if (A) drawAdult(g, A);
    drawMarina(g);
    for (const q of S.toys) if ((q.st === 'float' && !q.big) || (q.st === 'fly' && !q.dive)) drawToy(g, q);
    // the water over everything that is in it: a see-through tint, deeper = bluer, and the living line on top
    const xa = Math.max(X0, (cx - 2) & ~1), xb = Math.min(X1, cx + V.w + 2);
    if (xb > xa) {
      g.beginPath(); g.moveTo(xa, surf(xa)); for (let x = xa + 2; x < xb; x += 2) g.lineTo(x, surf(x)); g.lineTo(xb, surf(xb)); for (let x = xb; x >= xa; x -= 2) g.lineTo(x, floorAt(Math.min(x, X1 - 0.5)) + 0.5); g.closePath();
      const wg = g.createLinearGradient(0, 0, 0, DEEP); wg.addColorStop(0, 'rgba(70,214,228,.2)'); wg.addColorStop(1, 'rgba(22,108,196,.4)'); g.fillStyle = wg; g.fill();
      for (let x = xa; x < xb; x += 2) { const y = Math.round(surf(x + 1)); px(g, x, y, 2, 1, '#f4ffff'); px(g, x, y + 1, 2, 1, 'rgba(255,255,255,.38)'); if (((x + (t * 14 | 0)) & 31) < 5) px(g, x, y + 3, 2, 1, 'rgba(255,255,255,.3)'); }
    }
    for (const p of S.P) {
      if (p.k === 1) { const x = Math.round(p.x), y = Math.round(p.y); if (p.r > 1) { px(g, x, y, 2, 2, 'rgba(225,252,255,.55)'); px(g, x, y, 1, 1, '#ffffff'); } else px(g, x, y, 1, 1, 'rgba(235,254,255,.85)'); }
      else if (p.k === 3) px(g, p.x - (p.r >> 1), surf(p.x) - 1, p.r, 1, 'rgba(255,255,255,' + clamp(1.2 - p.age / p.life * 1.2, 0, 0.9).toFixed(2) + ')');
    }
    for (const f of S.FX) if (f.k === 'crown') drawCrown(g, f);
    for (const p of S.P) {
      if (p.k === 0) px(g, p.x, p.y, p.r, p.r, p.c);
      else if (p.k === 2) { const k = p.age / p.life, x = Math.round(p.x), y = Math.round(p.y); if (k < 0.6 && (p.life > 0.45)) { px(g, x - 1, y, 3, 1, p.c); px(g, x, y - 1, 1, 3, p.c); } else px(g, x, y, 1, 1, p.c); }
    }
    if (G && G.ping && t - G.ping.t < 1.2) { const k = (t - G.ping.t) / 1.2, y = surf(G.ping.x); g.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - k)).toFixed(2) + ')'; g.lineWidth = 1; for (let i = 0; i < 2; i++) { g.beginPath(); g.ellipse(G.ping.x, y, 6 + k * 26 - i * 5, 2 + k * 5, 0, 0, TAU); g.stroke(); } }
    if (S.ping && t - S.ping.t < 0.4) { const k = (t - S.ping.t) / 0.4; g.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)).toFixed(2) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(S.ping.x, S.ping.y, 3 + k * 7, 0, TAU); g.stroke(); }
    if (S.rainbow) { const R = S.rainbow, a = clamp((t - R.t0 - 0.3) / 1.2, 0, 1) * clamp((R.t0 + 5.7 - t) / 1, 0, 1); if (a > 0) { g.globalAlpha = a * 0.75; g.lineWidth = 2.4; RB.forEach((cc, i) => { g.strokeStyle = `rgb(${cc[0]},${cc[1]},${cc[2]})`; g.beginPath(); g.arc(R.x, 6, 60 - i * 2.2, Math.PI, TAU); g.stroke(); }); g.globalAlpha = 1; } }
    if (S.lights) { const L = S.lights, y = -66; px(g, L.x - 17, y - 7, 34, 14, '#2b2340'); px(g, L.x - 1, y + 7, 2, 60, '#2b2340'); for (let i = 0; i < 3; i++) { g.fillStyle = L.go ? '#5fe36a' : i < L.n ? ['#ff5a5a', '#ffd23f', '#5fe36a'][i] : '#4a4266'; g.beginPath(); g.arc(L.x - 10 + i * 10, y, 4, 0, TAU); g.fill(); } }
    if (S.flag != null && t - S.flag < 3.6) { const x = X0 + 8; px(g, x, -44, 1, 46, '#f4f7fa'); for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) px(g, x + 1 + i * 2, -44 + j * 2 + Math.round(Math.sin(t * 9 + i * 0.8)), 2, 2, (i + j) & 1 ? '#20202a' : '#ffffff'); }
    { const f = S.fly, w = Math.sin(t * 60) > 0; px(g, f.x - 3, f.y, 6, 1, '#177e8c'); px(g, f.x + 3, f.y - 1, 2, 2, '#0d5964'); px(g, f.x - 1, f.y - (w ? 3 : 2), 3, w ? 3 : 2, 'rgba(255,255,255,.7)'); px(g, f.x - 3, f.y - (w ? 2 : 3), 2, 2, 'rgba(255,255,255,.5)'); }
    g.setTransform(1, 0, 0, 1, 0, 0);                 // drops on the "lens" after the biggest splashes
    for (const l of S.lens) { if (t < l.t) continue; const a = clamp(1 - (t - l.t) / l.life, 0, 1), x = l.x * V.w, y = l.y * V.h; g.fillStyle = 'rgba(214,246,255,' + (0.4 * a).toFixed(2) + ')'; g.beginPath(); g.arc(x, y, l.r, 0, TAU); g.fill(); px(g, x, y - l.r - 4, 1, 4, 'rgba(214,246,255,' + (0.22 * a).toFixed(2) + ')'); px(g, x - l.r / 3, y - l.r / 3, 1, 1, 'rgba(255,255,255,' + (0.95 * a).toFixed(2) + ')'); }
  }

  window.Pool = { open, close: () => finish(), suit: () => { readLook(); return LOOK.known ? LOOK.suit : null; }, state, get active() { return !!S; },
    _peek: (key, suit, x) => (ART ? mframe(key, { suit: suit || LOOK.suit, x: x || {} }) : null), _suits: SUITS.map(s => s.id), _load: loadArt };        // _peek: one of her frames in a given suit (for tests)
  setTimeout(() => { try { loadArt(); voIndex(); } catch (e) { } }, 7000);          // fetch the pictures quietly once the game itself has settled
})();
