// Chef Marina — climbing the two big backyard trees, and the view from the top.
// Self-contained; load after everything else.  Art: assets/tree/tree.png + tree.json (one sheet, loaded the first time it is needed).
//   TreeClimb.open({ tree: 'oak' | 'pine', onDone(result) })   the climb; onDone({ top: true|false }) once she is back on the ground
//   TreeClimb.view({ onDone, from })                            only the panorama (from: 'oak' | 'pine' | 'house'), e.g. a telescope or an upstairs window
//   TreeClimb.close()                                           same as the ❌
// Everything is one small pixel canvas scaled up inside #panel (a canvas, not buttons: calm.js cancels taps on buttons when the
// finger moves, and the view is dragged). She cannot read, so there are no words or numbers anywhere: glowing spots, pictures, sound.
(function () {
  'use strict';
  const DIR = 'assets/tree/', TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
  const eio = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, eout = k => 1 - (1 - k) * (1 - k), ein = k => k * k;
  const back = k => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);                   // eases past the end and settles
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const css = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const pat = (g, x, y, rows, map) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = map[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } } };

  // ------------------------------------------------------------------ art
  let IMG = null, SP = null, PANO = null, ready = null, loadErr = false;
  function loadArt() {
    return ready || (ready = Promise.all([fetch(DIR + 'tree.json').then(r => r.json()),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = DIR + 'tree.png'; })])
      .then(([j, img]) => { SP = j.s; PANO = j.pano; IMG = img; }).catch(e => { ready = null; loadErr = true; }));
  }
  // draw a sprite by its anchor (feet / hands / bottom-centre); o: flip, sx, sy, rot, a, img (a tinted copy)
  function put(g, k, x, y, o) {
    const s = SP[k]; if (!s) return;
    const src = (o && o.img) || IMG, ox = o && o.img ? 0 : s[0], oy = o && o.img ? 0 : s[1];
    if (o && o.a != null) g.globalAlpha = o.a;
    if (!o || (!o.flip && !o.rot && (o.sx == null || o.sx === 1) && (o.sy == null || o.sy === 1))) g.drawImage(src, ox, oy, s[2], s[3], Math.round(x - s[4]), Math.round(y - s[5]), s[2], s[3]);
    else { g.save(); g.translate(Math.round(x), Math.round(y)); if (o.rot) g.rotate(o.rot); g.scale((o.flip ? -1 : 1) * (o.sx == null ? 1 : o.sx), o.sy == null ? 1 : o.sy); g.drawImage(src, ox, oy, s[2], s[3], -s[4], -s[5], s[2], s[3]); g.restore(); }
    if (o && o.a != null) g.globalAlpha = 1;
  }
  // a sprite on its own little canvas, optionally tinted (mul = multiply colour, add = [colour, alpha] laid over it)
  const CUT = {};
  function cut(k, mul, add) {
    const id = k + '|' + (mul || '') + '|' + (add ? add.join(',') : ''); if (CUT[id]) return CUT[id];
    const s = SP[k], c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const g = c.getContext('2d');
    g.drawImage(IMG, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]);
    if (mul) { g.globalCompositeOperation = 'multiply'; g.fillStyle = mul; g.fillRect(0, 0, c.width, c.height); }
    if (add) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(hex(add[0]), add[1]); g.fillRect(0, 0, c.width, c.height); }
    if (mul) { g.globalCompositeOperation = 'destination-in'; g.drawImage(IMG, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); }
    return (CUT[id] = c);
  }

  // ------------------------------------------------------------------ sound (all optional): the game's blips, plus wind / sea / animal voices on its audio context
  const au = () => (typeof Audio2 !== 'undefined' && Audio2) || null;
  const ac = () => { try { const a = au(); return a && a.ctx; } catch (e) { return null; } };
  const blip = (n, type, len, vol) => { try { const a = au(); a && a.blip(n, type, len, vol); } catch (e) { } };
  const jingle = (n, step, type) => { try { const a = au(); a && a.jingle(n, step, type); } catch (e) { } };
  const whoosh = up => { try { const a = au(); a && a.whoosh(up); } catch (e) { } };
  const rustle = (vol, hp, len) => { try { const a = au(); a && a.noise(len || 0.16, vol || 0.1, hp || 2600); } catch (e) { } };
  let bus = null, nbuf = null; const loops = {};
  function out() { const c = ac(); if (!c) return null; if (!bus || bus.context !== c) { bus = c.createGain(); bus.gain.value = 0.85; bus.connect(c.destination); } return bus; }
  function noiseBuf() { const c = ac(); if (!nbuf || nbuf.sampleRate !== c.sampleRate) { nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
  // one gliding note: f0 -> f1 (-> f2)
  function tone(f0, f1, dur, type, vol, delay, f2) {
    try { const c = ac(), b = out(); if (!c || !b) return; const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t); if (f2) { o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5); o.frequency.exponentialRampToValueAtTime(f2, t + dur); } else if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + Math.min(0.03, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(b); o.start(t); o.stop(t + dur + 0.03); } catch (e) { }
  }
  // a puff of filtered noise (knocks, splashes, gusts)
  function hiss(dur, vol, freq, q, delay, type) {
    try { const c = ac(), b = out(); if (!c || !b) return; const t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf();
      f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(b); s.start(t, Math.random() * 1.5, dur + 0.05); } catch (e) { }
  }
  // wind and sea: noise through a filter, running all the time, turned up and down
  function loopSet(name, vol, freq) {
    try { const c = ac(), b = out(); if (!c || !b) return; let L = loops[name];
      if (!L || L.ctx !== c) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf(); s.loop = true; f.type = name === 'wind' ? 'bandpass' : 'lowpass'; f.Q.value = name === 'wind' ? 0.7 : 0.4; f.frequency.value = freq; g.gain.value = 0.0001; s.connect(f); f.connect(g); g.connect(b); s.start(); L = loops[name] = { ctx: c, s, f, g }; }
      const t = c.currentTime; L.g.gain.setTargetAtTime(Math.max(0.0001, vol), t, 0.25); L.f.frequency.setTargetAtTime(freq, t, 0.25); } catch (e) { }
  }
  function loopsOff() { for (const k in loops) { const L = loops[k]; try { L.g.gain.setTargetAtTime(0.0001, L.ctx.currentTime, 0.08); L.s.stop(L.ctx.currentTime + 0.5); } catch (e) { } delete loops[k]; } }
  const SND = {
    chirp: (d, hi) => { const f = (hi || 2600) * rnd(0.9, 1.1); tone(f, f * 1.35, 0.07, 'sine', 0.07, d || 0, f * 1.1); tone(f * 1.2, f * 1.5, 0.06, 'sine', 0.06, (d || 0) + 0.1); },
    peep: d => { for (let i = 0; i < 3; i++) tone(3300 + i * 200, 3900, 0.06, 'sine', 0.06, (d || 0) + i * 0.09); },
    hoot: () => { tone(392, 370, 0.22, 'sine', 0.2); tone(392, 340, 0.55, 'sine', 0.22, 0.32); tone(784, 700, 0.5, 'sine', 0.03, 0.32); },
    chatter: () => { for (let i = 0; i < 7; i++) tone(1700 + (i % 2) * 500, 1500, 0.045, 'square', 0.035, i * 0.06); },
    tok: (d, v) => { hiss(0.05, v || 0.3, 1100, 6, d); tone(640, 420, 0.05, 'triangle', 0.12, d); },
    boing: () => { tone(160, 720, 0.5, 'sine', 0.22, 0, 300); tone(320, 1440, 0.5, 'triangle', 0.05, 0, 600); },
    creak: d => { tone(rnd(90, 120), rnd(70, 90), 0.22, 'sawtooth', 0.045, d || 0, rnd(95, 130)); },
    thunk: () => { hiss(0.09, 0.3, 240, 1.2); tone(150, 70, 0.1, 'sine', 0.2); },
    pop: () => { tone(900, 300, 0.07, 'sine', 0.2); hiss(0.04, 0.2, 2500, 1); },
    bell: (d, f) => { f = f || 1320; tone(f, f, 0.9, 'sine', 0.16, d); tone(f * 2.76, f * 2.76, 0.5, 'sine', 0.05, d); tone(f * 5.4, f * 5.4, 0.2, 'sine', 0.02, d); },
    gull: d => { for (let i = 0; i < 3; i++) tone(1500, 950, 0.2, 'sawtooth', 0.022, (d || 0) + i * 0.26, 1250); },
    snore: () => { hiss(0.55, 0.07, 260, 3, 0, 'bandpass'); tone(95, 80, 0.5, 'sawtooth', 0.02); },
    splash: () => { hiss(0.3, 0.16, 1800, 0.8); },
    train: () => { tone(620, 620, 0.5, 'triangle', 0.035); tone(740, 740, 0.5, 'triangle', 0.03); tone(620, 600, 0.9, 'triangle', 0.035, 0.6); tone(740, 715, 0.9, 'triangle', 0.03, 0.6); },
    cricket: () => { for (let i = 0; i < 4; i++) tone(4300, 4300, 0.03, 'sine', 0.018, i * 0.06); },
    gust: len => { hiss(len || 2.2, 0.22, 520, 0.6); },
    poof: () => { hiss(0.5, 0.3, 900, 0.5); hiss(0.25, 0.2, 3200, 0.7, 0.03); }
  };
  const SCALE = [0, 2, 4, 5, 7, 9, 11];                       // each step up the tree is a step up a major scale
  function stepNote(lv) { const n = SCALE[lv % 7] + 12 * Math.floor(lv / 7) - 17; blip(n, 'triangle', 0.16, 0.16); blip(n + 12, 'sine', 0.22, 0.05); }
  // voices: existing clips, a few per climb; new lines only start to play once they have been recorded (key in the index)
  let VO = null, lastTalk = -99;
  function voIndex() { if (VO) return; VO = {}; try { fetch('assets/vo_index.json').then(r => r.json()).then(j => { VO = j || {}; }).catch(() => { }); } catch (e) { } }
  function speak(key, gap) { const now = performance.now() / 1000; if (now - lastTalk < (gap == null ? 7 : gap)) return false; lastTalk = now; try { if (typeof say === 'function') say(key); } catch (e) { } return true; }
  function line(key, fallback, gap) { if (VO && VO[key]) return speak(key, gap); return fallback ? speak(fallback, gap) : false; }

  // ------------------------------------------------------------------ the two trees
  // plan: one row per level, bottom first.  L / R = a spot out on a limb, T = a hold on the trunk; after the colon, what lives there.
  const KIND = {
    oak: { step: 52, w0: 46, w1: 13, taper: 0.85, sway: 2.4, bark: ['#6f5743', '#57422f', '#8a735c', '#3d2c1f'], col: 'acorn', top: 'flag',
      len: lv => [74, 98, 106, 114, 118, 112, 118, 106, 98, 86, 72, 50, 30][lv - 1] || 40, rise: (lv, r) => 10 + r() * 12, th: lv => Math.max(5, 12 - lv * 0.5),
      plan: [['L:col', 'T', 'R'], ['L:wobbly', 'R:squirrel'], ['L:nest', 'T:owl', 'R:col'], ['L:bouncy', 'R:ladybird'], ['L', 'T:web', 'R:kite'], ['L:leaf', 'R:raccoon'], ['L:rope', 'T:col', 'R:land'],
        ['L:col', 'R'], ['L', 'T:treasure', 'R:col'], ['L:leaf', 'R:wobbly'], ['L', 'T', 'R:col'], ['L:robin', 'R:robin'], ['T:top']] },
    pine: { step: 52, w0: 30, w1: 6, taper: 0.9, sway: 7, bark: ['#75523f', '#5a3b2c', '#93705a', '#3a251b'], col: 'pinecone', top: 'bell',
      len: (lv, n) => Math.max(40, lerp(100, 36, (lv - 1) / (n - 2))), rise: (lv, r) => -5 + r() * 5, th: lv => Math.max(3, 6 - lv * 0.16),
      plan: [['L', 'R:col'], ['L:col', 'T', 'R'], ['L', 'T:woodpecker', 'R:col'], ['L:nest', 'R'], ['L:bouncy', 'T', 'R:col'], ['L:col', 'R:squirrel'], ['L', 'T:web', 'R'], ['L:balloon', 'R:col'],
        ['L', 'T:treasure', 'R:ladybird'], ['L:col', 'R:wobbly'], ['L', 'T', 'R:col'], ['L:bouncy', 'R'], ['L:col', 'T', 'R'], ['L:gust', 'T:gust', 'R:gust'], ['L:col', 'R:nest'], ['L:robin', 'T:robin', 'R:col'],
        ['L:col', 'R'], ['L', 'R'], ['T:top']] }
  };
  const OAKLEAF = ['oak_a', 'oak_b', 'oak_c', 'oak_d', 'oak_e', 'oak_f', 'oak_g', 'oak_h'], HANG = 57;
  let S = null;                                   // the open activity

  function buildTree(kind) {
    const K = KIND[kind], r = rng(kind === 'oak' ? 11 : 23), xs = clamp((S.VW - 40) / 230, 0.66, 1), n = K.plan.length;
    const T = { kind, K, n, step: K.step, H: n * K.step, xs, nodes: [], br: [], toys: [], cols: [], canopy: [], lv: [], birds: [], rope: null };
    T.tip = T.H + (kind === 'pine' ? 46 : 8);
    T.hw = h => lerp(K.w0, K.w1, Math.pow(clamp(h / T.tip, 0, 1), K.taper)) / 2 * (h > T.H ? Math.max(0.25, 1 - (h - T.H) / (T.tip - T.H + 1) * 0.8) : 1) + 9 * Math.exp(-Math.max(0, h) / 12);
    const limb = (lv, side, len, rise, th, deco) => { const b = { side, len, rise, th, h0: lv * K.step - rise * 0.75, dip: 0, v: 0, load: 0, wob: 0, wobT: 0, lv, leaves: [], deco, ph: r() * 9 }; T.br.push(b); return b; };
    K.plan.forEach((specs, i) => {
      const lv = i + 1, row = T.lv[lv] = [];
      for (const sp of specs) {
        const [slot, toy] = sp.split(':'), side = slot === 'L' ? -1 : slot === 'R' ? 1 : 0, nd = { lv, side, toy: toy || null, i: T.nodes.length, hidden: toy === 'land' };
        if (side) { const len = K.len(lv, n) * xs * (0.92 + r() * 0.16); nd.br = limb(lv, side, len, K.rise(lv, r), K.th(lv)); nd.ax = Math.max(T.hw(lv * K.step) + 17, len * (0.7 + r() * 0.12)); nd.x = side * nd.ax; nd.br.bouncy = toy === 'bouncy'; nd.br.wobbly = toy === 'wobbly'; }
        else { nd.x = (lv % 2 ? -1 : 1) * 2; nd.h0 = lv * K.step; }
        T.nodes.push(nd); row.push(nd);
      }
      if (kind === 'pine') for (const side of [-1, 1]) {           // ladder-like whorls: a bough each side at every level, and a shorter one in between
        if (!row.some(q => q.side === side)) limb(lv, side, K.len(lv, n) * xs * 0.85, -4 + r() * 4, K.th(lv), true);
        if (lv < n - 1) limb(lv + 0.5, side, K.len(lv, n) * xs * (0.5 + r() * 0.2), -7 + r() * 4, 2.5, true);
      } else if (lv < n - 1 && !row.some(q => q.side === -1)) limb(lv + 0.4, -1, K.len(lv, n) * xs * 0.6, 16, 4, true);
    });
    // leaves
    for (const b of T.br) {
      if (kind === 'oak') { const m = b.deco ? 1 : 2; for (let j = 0; j < m; j++) b.leaves.push({ t: (b.deco ? 0.9 : 0.94) + j * 0.24 + r() * 0.06, k: OAKLEAF[(r() * OAKLEAF.length) | 0], up: 2 + r() * 10, ph: r() * 9, front: j === m - 1 && r() < 0.4 }); }
      else { const m = b.len > 60 ? 3 : b.len > 36 ? 2 : 1; for (let j = 0; j < m; j++) b.leaves.push({ t: 0.42 + j * 0.3 + r() * 0.08, k: r() < 0.88 ? 'pine_a' : 'pine_b', up: -3 + r() * 3, ph: r() * 9 }); }
    }
    if (kind === 'oak') for (let i = 0; i < 64; i++) {              // the great crown behind everything, thickest out at the sides
      const a = r() * TAU, d = Math.sqrt(r()), cy = T.H * 0.62, x = Math.cos(a) * d * 190 * xs, h = cy + Math.sin(a) * d * T.H * 0.46;
      if (h < 150 || (Math.abs(x) < 78 * xs && h < T.H - 70)) continue; T.canopy.push({ x, h, k: OAKLEAF[(r() * OAKLEAF.length) | 0], ph: r() * 9, dk: r() < 0.6 });
    }
    T.cap = [];
    if (kind === 'oak') { for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 230 * xs, h = T.H - 120 + r() * 170 - Math.abs(x) * 0.35; T.canopy.push({ x, h, k: OAKLEAF[(r() * OAKLEAF.length) | 0], ph: r() * 9, dk: r() < 0.35 }); }
      for (const [x, h] of [[-34, -8], [30, -12], [-8, -22], [14, -30], [-48, -34], [50, -36], [0, -52], [-26, -58], [28, -62]]) T.cap.push({ x: x * Math.max(xs, 0.8), h: T.H + h, k: OAKLEAF[(r() * OAKLEAF.length) | 0], ph: r() * 9 }); }
    T.canopy.sort((a, b) => (b.dk ? 1 : 0) - (a.dk ? 1 : 0));
    // the trunk, painted once: furrowed bark, lit from the left
    const tw = Math.ceil(K.w0 + 22), th = Math.ceil(T.tip + 6), c = T.trunk = document.createElement('canvas'); c.width = tw; c.height = th; const g = c.getContext('2d'), im = g.createImageData(tw, th), d = im.data;
    const cols = K.bark.map(hex), hsh = (x, y) => { let v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let y = 0; y < th; y++) { const h = th - 1 - y, hw = T.hw(h); for (let x = 0; x < tw; x++) { const dx = x - tw / 2 + 0.5; if (Math.abs(dx) > hw) continue; const u = (dx + hw) / (2 * hw), wob = Math.sin(h * 0.06 + x * 0.7) * 1.5 + Math.sin(h * 0.017) * 2;
      const cx = Math.floor((x + wob) / (kind === 'oak' ? 2 : 3)), f = hsh(cx, Math.floor(h / (kind === 'oak' ? 43 : 15) + hsh(cx, 7) * 9)), f2 = hsh(x, h);
      let cc = cols[0]; if (f > 0.6) cc = cols[1]; else if (f < 0.24) cc = cols[2]; if (f2 > 0.95) cc = cols[1]; else if (f2 < 0.04) cc = cols[2]; if (kind === 'pine' && Math.floor(h + x * 0.3) % 9 === 0 && f2 > 0.3) cc = cols[1];
      let k = u < 0.08 ? 0.7 : u < 0.4 ? 1.1 : u > 0.82 ? 0.66 : u > 0.62 ? 0.84 : 1; if (Math.abs(dx) > hw - 1) cc = cols[3], k = 1;
      const p = (y * tw + x) * 4; d[p] = Math.min(255, cc[0] * k); d[p + 1] = Math.min(255, cc[1] * k); d[p + 2] = Math.min(255, cc[2] * k); d[p + 3] = 255; } }
    g.putImageData(im, 0, 0);
    // who lives where
    for (const nd of T.nodes) {
      const t = nd.toy; if (!t || t === 'land' || t === 'top' || t === 'wobbly' || t === 'bouncy' || t === 'gust' || t === 'robin') continue;
      if (t === 'col' || t === 'leaf') { T.cols.push({ nd, k: t === 'leaf' ? 'goldleaf' : K.col, ph: r() * 9 }); continue; }
      const toy = { type: t, nd, t: 0, st: 0, ph: r() * 9 }, out = nd.side && nd.br.len - nd.ax > 24 ? 1 : -1;
      if (t === 'owl' || t === 'treasure') { toy.x = () => 0; toy.h = () => nd.h0 - 27; }
      else if (t === 'web') { toy.x = () => (nd.lv % 2 ? 1 : -1) * (T.hw(nd.h0) + 16); toy.h = () => nd.h0 + 30; toy.str = [0, 0, 0, 0, 0]; }
      else if (t === 'woodpecker') { toy.x = () => T.hw(nd.h0 + 60) + 3; toy.h = () => nd.h0 + 52; toy.beat = 3; }
      else if (t === 'kite' || t === 'balloon') { toy.x = () => nd.x + nd.side * 16; toy.h = () => nodeH(nd) + 66; }
      else { const ax = clamp(nd.ax + out * (t === 'raccoon' ? 30 : 23), T.hw(nd.lv * K.step) + 12, nd.br.len - 4); toy.x = () => nd.side * ax; toy.h = () => brTop(nd.br, ax); toy.ax = ax; }
      if (t === 'rope') { toy.px = 0; toy.ph_ = nd.lv * K.step + 128; T.rope = toy; toy.to = T.lv[nd.lv].find(q => q.hidden); }
      if (t === 'nest') toy.chicks = kind === 'pine';
      T.toys.push(toy);
    }
    return T;
  }
  // wind: stronger the higher up; the whole tree leans with it
  function wind(h) { const T = S.T, k = clamp(h / T.H, 0, 1.1); return (0.12 + 0.88 * Math.pow(k, 1.5)) * (1 + S.gust * 2.2); }
  function sway(h) { const T = S.T, k = clamp(h / T.tip, 0, 1); return (Math.sin(S.t * 0.9) * 0.7 + Math.sin(S.t * 2.3 + 1) * 0.3 + S.gust * 2.5 * Math.sin(S.t * 5)) * T.K.sway * k * k * (1 + S.gust * 1.5); }
  function brTop(b, ax) { const t = clamp((ax - 4) / (b.len - 4), 0, 1.15); return b.h0 + b.rise * t - (b.dip + Math.sin(S.t * 2.2 + b.ph) * (b.bouncy ? 1.6 : b.wobbly ? 1.1 : 0.35) * wind(b.h0) + b.wob * Math.sin(b.wobT * 15)) * Math.pow(t, 1.5); }
  function nodeH(n) { return n.br ? brTop(n.br, n.ax) : n.h0; }
  const X = x => Math.round(S.VW / 2 + x - S.cam.x), Y = h => Math.round(S.AY + S.cam.h - h);
  const wx = (x, h) => x + sway(h);                                   // where a point of the tree really is right now

  // ------------------------------------------------------------------ opening and closing
  function addCss() {
    if (document.getElementById('tc-css')) return; const s = mk('style'); s.id = 'tc-css';
    s.textContent = `
.tc-body{position:relative;flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center;margin-top:6px}
.tc-cv{display:block;flex:0 0 auto;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;-webkit-user-select:none;user-select:none;border-radius:10px;box-shadow:0 0 0 3px #fff,0 4px 0 3px rgba(0,0,0,.3);background:#8cc4ee}
.tc-top .tc-gap{flex:1 1 auto}
#panel>.tc-top.tc-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:60px;flex-direction:column;gap:6px;z-index:2}
#panel>.tc-top.tc-land .tc-gap{display:none}
#panel>.tc-body.tc-land{margin:0 0 0 68px}
.tc-pick{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:28px;pointer-events:none}
.tc-pick button{pointer-events:auto;width:96px;height:96px;margin:0;padding:0;border-radius:50%;border:5px solid #fff;background:#ffe9a8;font-size:48px;line-height:1;box-shadow:0 6px 0 rgba(0,0,0,.35);animation:tc-in .35s both,tc-bob .7s .35s infinite alternate ease-in-out}
.tc-pick button+button{background:#ffc9a0;animation-delay:.12s,.7s}
.tc-pick button:active{transform:scale(.94)}
.tc-go{background:#7bd36b!important}
.tc-nudge{animation:tc-bob .5s 6 alternate ease-in-out}
@keyframes tc-in{from{opacity:0;transform:scale(.3)}}
@keyframes tc-bob{to{transform:translateY(-8px) scale(1.05)}}
#app:has(.tc-body) #wishBtn,#app:has(.tc-body) #reqBtn{display:none}
`;
    document.head.append(s);
  }
  const btn = (cls, txt, label, fn) => { const b = mk('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('pointerup', e => { e.stopPropagation(); if (S) fn(b); }); return b; };

  function start(mode, opts) {
    opts = opts || {}; const panel = document.getElementById('panel'); if (!panel) return false;
    if (S) { const old = S; teardown(); report(old); }
    try { UI.closeActions(); } catch (e) { }
    try { clearWish(); } catch (e) { }
    addCss(); voIndex(); panel.innerHTML = ''; panel.classList.remove('hidden');
    const kind = KIND[opts.tree] ? opts.tree : 'oak';
    S = { mode, opts, kind, panel, t: 0, last: 0, phase: 'load', fx: [], timers: [], gust: 0, speed: 0, said: {}, got: [], best: 0, reached: false, done: false, VW: 190, VH: 190, sc: 2, AY: 110, cam: { x: 0, h: 0, vx: 0, vh: 0 }, hint: 0, shake: 0, flash: 0, iris: null };
    S.from = mode === 'view' ? (['oak', 'pine', 'house'].includes(opts.from) ? opts.from : 'oak') : kind;
    // top row: ❌ first (the sideways ❌ and the rest of the game look for it there); the view adds its picture buttons after it
    const top = S.top = mk('div', 'ptop tc-top'); S.xB = btn('pbtn', '❌', 'close', quit); top.append(S.xB, mk('div', 'tc-gap'));
    const body = S.body = mk('div', 'tc-body'), cv = S.cv = mk('canvas', 'tc-cv'); S.g = cv.getContext('2d'); body.append(cv); panel.append(top, body);
    layout(); bind();
    S.onResize = () => { layout(); clearTimeout(S.rzT); const st = S; S.rzT = setTimeout(() => { if (S === st) layout(); }, 320); };
    addEventListener('resize', S.onResize); addEventListener('orientationchange', S.onResize);
    const st = S; loadArt().then(() => { if (S !== st) return; if (!IMG) { finish(); return; } begin(); });
    S.raf = requestAnimationFrame(frame);
    return true;
  }
  function begin() {
    if (S.mode === 'view') { openView(false); return; }
    const T = S.T = buildTree(S.kind); S.phase = 'climb';
    const M = S.M = { x: -T.hw(0) - 22, h: 0, pose: 'stand', ft: 0, flip: false, sx: 1, sy: 1, rot: 0, q: [], busy: true, idle: 0, node: { lv: 0, side: -1, x: -T.hw(0) - 22, ground: true }, head: null };
    S.cam.h = camMin(); S.cam.x = 0;
    // she skips up to the tree
    jingle([0, 4, 7], 0.07, 'triangle');
    push({ d: 0.5, f: k => { M.pose = 'balance'; M.ft = k * 5; M.x = lerp(-T.hw(0) - 46, -T.hw(0) - 14, k); } }, { d: 0.01, end: () => { M.pose = 'stand'; M.node.x = M.x; } });
  }
  function layout() {
    if (!S) return; const land = innerWidth > innerHeight; S.top.classList.toggle('tc-land', land); S.body.classList.toggle('tc-land', land);
    const W = S.body.clientWidth, H = S.body.clientHeight, sc = Math.max(2, Math.floor(Math.min(W, H) / 172));
    const VW = Math.max(120, Math.floor((W - 6) / sc)), VH = Math.max(120, Math.floor((H - 10) / sc));
    if (VW !== S.VW || VH !== S.VH || !S.cv.width) { S.VW = VW; S.VH = VH; S.cv.width = VW; S.cv.height = VH; }
    S.sc = sc; S.AY = Math.round(VH * 0.6); S.cv.style.width = VW * sc + 'px'; S.cv.style.height = VH * sc + 'px'; S.g.imageSmoothingEnabled = false;
    if (S.V) viewLayout();
  }
  const camMin = () => S.VH - S.AY - 22;
  function teardown() {
    if (!S) return; cancelAnimationFrame(S.raf); clearTimeout(S.rzT);
    removeEventListener('resize', S.onResize); removeEventListener('orientationchange', S.onResize); loopsOff(); S = null;
  }
  // back to the game; tells the caller how it went (once)
  function finish() {
    if (!S) return; const st = S;
    teardown(); st.panel.classList.add('hidden'); st.panel.innerHTML = '';
    try { if (typeof setMusic === 'function') setMusic(); } catch (e) { }
    report(st);
  }
  function report(st) { if (typeof st.opts.onDone === 'function') { try { st.opts.onDone(st.mode === 'view' ? undefined : { top: !!st.reached }); } catch (e) { console.warn('treeclimb onDone', e); } } }
  // the ❌: from part-way up she slides down the trunk the quick way; anywhere else it just leaves
  function quit() {
    if (!S) return;
    if (S.mode !== 'climb' || S.phase !== 'climb' || !S.M || S.M.h < 30) { finish(); return; }
    const M = S.M, T = S.T, h0 = M.h, x0 = M.x; S.phase = 'quick'; M.q = []; M.busy = true; M.head = null; whoosh(false);
    push({ d: clamp(0.45 + h0 / 900, 0.5, 1.3), f: k => { M.pose = 'hug'; M.x = lerp(x0, T.hw(M.h) * 0.2, Math.min(1, k * 4)); M.h = lerp(h0, 0, ein(k)); M.sy = 1.06; if (Math.random() < 0.5) bark(M.x, M.h + 20, 1); },
      end: () => { M.h = 0; M.pose = 'stand'; M.sy = 0.8; dust(M.x, 0, 8); SND.thunk(); } }, { d: 0.35, f: k => { M.sy = lerp(0.8, 1, back(k)); }, end: finish });
  }
  function after(sec, fn) { S.timers.push({ t: S.t + sec, fn }); }

  // ------------------------------------------------------------------ fingers
  function bind() {
    const cv = S.cv, at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * S.VW, y: (e.clientY - r.top) / r.height * S.VH }; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!S || e.isPrimary === false || e.button > 0) return; const p = at(e); S.idleAll = 0;
      try { const c = ac(); if (c && c.state === 'suspended') c.resume(); } catch (err) { }
      if (S.phase === 'view') { try { cv.setPointerCapture(e.pointerId); } catch (err) { } S.ptr = { id: e.pointerId, x0: e.clientX, lx: e.clientX, moved: 0, t: S.t, p }; S.V.vel = 0; return; }
      if (S.phase === 'climb') tapClimb(p); else if (S.phase === 'leaf') steer(p); else if (S.phase === 'topfx' && S.t - S.topAt > 1.2) S.topSkip = true;
    });
    cv.addEventListener('pointermove', e => {
      const P = S && S.ptr; if (!P || P.id !== e.pointerId || S.phase !== 'view') return; const r = cv.getBoundingClientRect(), dx = (e.clientX - P.lx) / r.width * S.VW;
      P.moved += Math.abs(e.clientX - P.lx); P.lx = e.clientX; if (P.moved > 6 && !S.V.binoc) { S.V.az -= dx; S.V.vel = clamp(lerp(S.V.vel, -dx / Math.max(0.008, S.dt), 0.5), -420, 420); S.V.dragged = true; }
    });
    const up = e => { const P = S && S.ptr; if (!P || P.id !== e.pointerId) return; S.ptr = null; if (S.phase === 'view' && e.type === 'pointerup' && P.moved < 9 && S.t - P.t < 0.7) tapView(P.p); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  }

  // ------------------------------------------------------------------ little things that fly about
  // fx: { x, h (world) | sx, sy (screen), vx, vy, g, life, t, kind, c, k (sprite), rot, vr, scr }
  function emit(o) { o.t = 0; if (S.fx.length < 260) S.fx.push(o); return o; }
  const LEAFC = { oak: ['#e8862e', '#f0aa3c', '#c8542c', '#d99a2e', '#b8702a'], pine: ['#3f7444', '#2f5a36', '#5a8a4a', '#8a6a3a'] };
  function leaves(x, h, n, spread, up) { const cs = LEAFC[S.T ? S.T.kind : 'oak']; for (let i = 0; i < n; i++) emit({ x: x + rnd(-spread, spread), h: h + rnd(-4, 8), vx: rnd(-22, 22) + wind(h) * 26, vy: -(up ? rnd(20, 70) : rnd(-8, 12)), g: 46, life: rnd(1.2, 2.4), kind: 'leaf', c: pick(cs), ph: rnd(0, 9) }); }
  function bark(x, h, n) { for (let i = 0; i < n; i++) emit({ x: x + rnd(-8, 8), h: h + rnd(-4, 4), vx: rnd(-18, 18), vy: rnd(-10, 20), g: 160, life: rnd(0.4, 0.8), kind: 'dot', c: pick(['#6f5743', '#3d2c1f', '#8a735c']) }); }
  function dust(x, h, n) { for (let i = 0; i < n; i++) emit({ x: x + rnd(-6, 6), h: h + rnd(0, 3), vx: rnd(-32, 32), vy: -rnd(4, 18), g: -8, life: rnd(0.35, 0.7), kind: 'puff', c: '#f4ecd8', r: rnd(2, 4) }); }
  function sparkle(x, h, n, c) { for (let i = 0; i < n; i++) emit({ x: x + rnd(-10, 10), h: h + rnd(-10, 10), vx: rnd(-20, 20), vy: -rnd(-20, 30), g: 0, life: rnd(0.4, 0.9), kind: 'spark', c: c || (Math.random() < 0.5 ? '#ffffff' : '#fff3a0'), d: rnd(0, 0.3) }); }
  function notes(x, h, n) { for (let i = 0; i < n; i++) emit({ x: x + rnd(-6, 6), h: h, vx: rnd(-10, 10), vy: -rnd(22, 36), g: 0, life: 1, kind: 'note', c: pick(['#ffffff', '#ffe36a', '#ff9ad5']), d: i * 0.12 }); }
  function stepFx(dt) {
    for (let i = S.fx.length - 1; i >= 0; i--) { const p = S.fx[i]; if (p.d > 0) { p.d -= dt; continue; } p.t += dt; if (p.t > p.life) { S.fx.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt; if (p.kind === 'leaf') { p.vx += (wind(p.h || 0) * 30 - p.vx) * dt * 0.8; p.vy = Math.min(p.vy, 34); }
      if (p.scr) { p.sx += p.vx * dt; p.sy += p.vy * dt; } else { p.x += p.vx * dt; p.h -= p.vy * dt; } if (p.vr) p.rot = (p.rot || 0) + p.vr * dt; }
  }
  function drawFx(g, front) {
    for (const p of S.fx) { if (p.d > 0 || !!p.front !== !!front) continue; const sx = p.scr ? p.sx : X(p.x), sy = p.scr ? p.sy : Y(p.h), k = p.t / p.life;
      if (sx < -30 || sx > S.VW + 30 || sy < -30 || sy > S.VH + 30) continue;
      if (p.kind === 'leaf') { const w = Math.sin(p.t * 9 + p.ph); px(g, sx + w * 2, sy, w > 0 ? 3 : 2, w > 0 ? 2 : 3, p.c); }
      else if (p.kind === 'dot') px(g, sx, sy, 2, 2, p.c);
      else if (p.kind === 'puff') { g.globalAlpha = 0.7 * (1 - k); const r = Math.round(p.r * (1 + k)); px(g, sx - r, sy - r + 1, r * 2, r * 2 - 2, p.c); px(g, sx - r + 1, sy - r, r * 2 - 2, r * 2, p.c); g.globalAlpha = 1; }
      else if (p.kind === 'spark') { const r = Math.max(0, Math.round((k < 0.5 ? k : 1 - k) * 6)); g.fillStyle = p.c; g.fillRect(sx - r, sy, r * 2 + 1, 1); g.fillRect(sx, sy - r, 1, r * 2 + 1); }
      else if (p.kind === 'note') { g.globalAlpha = 1 - k * k; px(g, sx, sy - 5, 1, 6, p.c); px(g, sx - 2, sy, 3, 2, p.c); px(g, sx + 1, sy - 5, 2, 1, p.c); g.globalAlpha = 1; }
      else if (p.kind === 'spr') put(g, p.k, sx, sy, { rot: p.rot || 0, a: p.fade ? 1 - k * k : 1, flip: p.flip, sx: p.s || 1, sy: (p.s || 1) * (p.flap ? (Math.sin(p.t * 22 + (p.ph || 0)) > 0 ? 1 : -0.5) : 1), img: p.img });
      else if (p.kind === 'line') { g.globalAlpha = 0.5 * (1 - k); px(g, sx, sy, p.w || 1, p.len || 8, p.c); g.globalAlpha = 1; }
    }
  }

  // ------------------------------------------------------------------ Marina's moves: a queue of little timed steps
  function push() { for (let i = 0; i < arguments.length; i++) S.M.q.push(arguments[i]); }
  function stepSeq(dt) {
    const M = S.M;
    while (M.q.length) { const s = M.q[0]; if (!s.on) { s.on = 1; s.t = 0; s.start && s.start(s); } s.t += dt; const k = s.d > 0 ? Math.min(1, s.t / s.d) : 1; s.f && s.f(k, s, dt); if (k < 1) return; M.q.shift(); s.end && s.end(s); if (!S) return; dt = 0; }
    if (M.busy && S.phase === 'climb') { M.busy = false; M.idle = 0; }
  }
  const frames = { climb: 6, hug: 5, reach: 5, balance: 6, leap: 6, whoa: 6, cheer: 5, jump: 9, swing: 9, pull: 9, laugh: 9 };
  const hands = p => p === 'swing' || p === 'pull' || p === 'laugh';
  function frameOf(M) { const p = M.pose; if (p === 'stand' || p === 'sit') return 'm_' + p; const n = frames[p]; return 'm_' + p + '_' + (((Math.floor(M.ft) % n) + n) % n); }
  function candidates() { const M = S.M, T = S.T; if (!M || M.busy || S.phase !== 'climb') return []; return (T.lv[M.node.lv + 1] || []).filter(n => !n.hidden); }

  function climbTo(x, hf, d) {                                  // shimmy up the trunk, seen from behind
    const M = S.M; let x0, h0, lastF = -1;
    push({ d, start: () => { x0 = M.x; h0 = M.h; M.pose = 'climb'; M.rot = 0; }, f: k => { const e = eio(k); M.x = lerp(x0, x, e); M.h = lerp(h0, hf(), e); M.ft = k * d * 11; M.sy = 1 + Math.sin(k * d * 22) * 0.04;
      const fr = Math.floor(M.ft); if (fr !== lastF) { lastF = fr; if (fr % 2 === 0) { hiss(0.05, 0.1, 1800 + Math.random() * 600, 2); bark(M.x + rnd(-8, 8), M.h + rnd(10, 40), 2); } } }, end: () => { M.pose = 'hug'; M.ft = 2; M.sy = 1; } });
  }
  function hop(x, hf, d, arc, big) {                            // crouch, fly, hair streaming; the landing is squashed by land()
    const M = S.M; let x0, h0, dir;
    push({ d: big ? 0.16 : 0.1, start: () => { x0 = M.x; h0 = M.h; dir = Math.sign(x - x0) || 1; M.flip = dir < 0; if (hands(M.pose) || M.pose === 'hug' || M.pose === 'climb') M.pose = 'stand'; M.rot = 0; }, f: k => { M.sy = 1 - 0.2 * Math.sin(k * Math.PI / 2); M.sx = 1 + 0.14 * Math.sin(k * Math.PI / 2); },
      end: () => { const b = M.node && M.node.br; if (b) { b.v -= 70; leaves(M.x, M.h + 8, 3, 14); } if (big) whoosh(true); else blip(-3, 'triangle', 0.08, 0.1); } },
      { d, f: k => { M.pose = 'leap'; M.ft = k < 0.25 ? 1 : k < 0.75 ? 2 + ((k * 12) | 0) % 2 : 4; M.x = lerp(x0, x, k); M.h = lerp(h0, hf(), k) + arc * 4 * k * (1 - k); const s = Math.sin(k * Math.PI); M.sy = 1 + 0.16 * s; M.sx = 1 - 0.1 * s; M.rot = dir * (0.5 - k) * (big ? 0.5 : 0.3);
        if (big && Math.random() < 0.6) emit({ x: M.x - dir * 10, h: M.h + rnd(20, 50), vx: -dir * 20, vy: 0, life: 0.25, kind: 'line', c: '#ffffff', len: 1, w: rnd(5, 10) }); }, end: () => { M.rot = 0; } });
  }
  function hangUp(n) {                                          // reach, jump to hang from the branch above, swing, pull up, stand
    const M = S.M, b = n.br; let h0, x0;
    push({ d: 0.24, start: () => { M.pose = 'reach'; M.rot = 0; M.flip = false; x0 = M.x; }, f: k => { M.ft = k * 4.9; M.x = lerp(x0, n.x, k); M.sy = 1 + 0.06 * k; } },
      { d: 0.2, start: () => { M.pose = 'swing'; M.ft = 0; h0 = M.h + 50; M.h = h0; blip(2, 'triangle', 0.08, 0.1); }, f: k => { M.h = lerp(h0, nodeH(n) - 1, eout(k)); M.sy = 1.12 - 0.12 * k; }, end: () => { b.v += 85; leaves(n.x, nodeH(n) + 6, 5, 18); rustle(0.1); SND.creak(); } },
      { d: 0.62, f: k => { M.h = nodeH(n) - 1; M.ft = k * 8.9; M.rot = Math.sin(k * TAU * 1.25) * 0.34 * (1 - k * 0.6); } },
      { d: 0.42, start: () => { M.pose = 'pull'; M.rot = 0; }, f: k => { M.h = nodeH(n) - 1; M.ft = k * 8.9; }, end: () => { M.pose = 'stand'; M.h = nodeH(n); M.sy = 0.86; } });
  }
  function land(n, quiet) {                                     // touch down on a spot: squash, the limb dips and springs, leaves shake loose
    const M = S.M;
    push({ d: 0.01, end: () => { M.node = n; M.x = n.x; M.rot = 0; M.sx = 1.14; M.sy = 0.8; if (n.br) { M.pose = 'stand'; n.br.v += 130; n.br.load = 1; leaves(n.x, nodeH(n) + 10, 7, 22); dust(n.x, nodeH(n), 4); if (!quiet) { rustle(0.14); SND.creak(0.05); } } else { M.pose = 'hug'; M.ft = 2; bark(n.x, n.h0 + 20, 6); if (!quiet) SND.thunk(); }
      for (const b of S.T.br) if (b !== n.br) b.load = 0; S.shake = Math.max(S.shake, 1.5); } },
      { d: 0.22, f: k => { M.sy = lerp(0.8, 1, back(k)); M.sx = lerp(1.14, 1, back(k)); if (n.br) M.h = nodeH(n); }, end: () => arrive(n) });
  }
  function goNode(n) {
    const M = S.M, a = M.node, T = S.T; M.busy = true; M.idle = 0; S.hint = 0; if (M.head) flyOff();
    const hf = () => nodeH(n), dx = Math.abs(n.x - M.x);
    if (a.ground) { if (n.br) { climbTo(M.x + 6, () => hf() - 18, 0.45); hop(n.x, hf, 0.42, 22); } else climbTo(n.x, hf, 0.75); }
    else if (!a.br && !n.br) climbTo(n.x, hf, 0.8);
    else if (!a.br) { climbTo(M.x, () => hf() - 16, 0.42); hop(n.x, hf, 0.42, 24); }
    else if (!n.br) hop(n.x, hf, 0.5, 26);
    else if (a.side === n.side && dx < 40) hangUp(n);
    else hop(n.x, hf, a.side === n.side ? 0.5 : 0.64, a.side === n.side ? 36 : 48, a.side !== n.side);
    land(n);
  }
  function arrive(n) {
    const M = S.M, T = S.T; S.best = Math.max(S.best, n.lv); stepNote(n.lv);
    for (const c of T.cols) if (c.nd === n && !c.got) collect(c);
    const lvh = n.lv * T.step;
    if (!S.said.roof && lvh > 300 && lvh < 420) { S.said.roof = 1; line('m_tree_high', null, 4); }
    if (!S.said.sky && lvh > 560) { S.said.sky = 1; speak('m_wow', 4); leaves(M.x, M.h + 40, 10, 40, true); }
    const t = n.toy;
    if (t === 'top') return topMoment();
    if (t === 'bouncy') return bounce(n);
    if (t === 'wobbly') wobble(n);
    else if (t === 'gust') gustNow(n);
    else if (t === 'robin') after(0.5, () => { if (S && S.M.node === n && !S.M.busy) robin(); });
    for (const toy of T.toys) if (toy.nd === n) poke(toy, true);
  }
  function collect(c) { c.got = S.t; const i = S.got.length; S.got.push(c.k); blip(12 + (i % 5) * 2, 'sine', 0.2, 0.14); blip(19 + (i % 5) * 2, 'sine', 0.25, 0.1); sparkle(c.nd.x, nodeH(c.nd) + 40, 6); }

  // ------------------------------------------------------------------ the toys on the way
  function bounce(n) {                                          // a springy limb: down... and BOING, up two levels
    const M = S.M, T = S.T, b = n.br, to = (T.lv[n.lv + 2] || []).find(q => q.side === n.side && !q.hidden) || (T.lv[n.lv + 2] || [])[0]; if (!to) return;
    M.busy = true; let h0;
    push({ d: 0.34, f: k => { b.dip = 16 * Math.sin(k * Math.PI / 2); b.v = 0; M.h = nodeH(n); M.sy = 1 - 0.26 * k; M.sx = 1 + 0.16 * k; }, end: () => { SND.boing(); speak('m_bounce', 12); b.v = 420; leaves(n.x, nodeH(n), 12, 24, true); h0 = M.h; } },
      { d: 0.8, f: k => { M.pose = 'jump'; M.ft = 3 + k * 4; M.x = lerp(n.x, to.x, eio(k)); M.h = lerp(h0, nodeH(to), k) + 46 * 4 * k * (1 - k); const s = Math.sin(k * Math.PI); M.sy = 1 + 0.22 * (1 - k) + 0.05 * s; M.sx = 1 - 0.12 * (1 - k); M.rot = Math.sin(k * TAU) * 0.12;
        if (Math.random() < 0.5) emit({ x: M.x + rnd(-8, 8), h: M.h - 4, vx: 0, vy: 30, life: 0.3, kind: 'line', c: '#ffffff', len: rnd(6, 12) }); S.best = Math.max(S.best, n.lv + 2 * k); } });
    land(to);
  }
  function wobble(n) {                                          // whoa-a-a! arms out, then a giggle
    const M = S.M, b = n.br; M.busy = true; b.wob = 5; b.wobT = 0; speak('m_uhoh', 10);
    push({ d: 1.5, f: (k, s, dt) => { b.wobT += dt; b.wob = 5 * (1 - k); M.pose = 'whoa'; M.ft = k * 16; M.h = nodeH(n); M.rot = Math.sin(k * 26) * 0.2 * (1 - k); if (Math.random() < 0.08) { SND.creak(); leaves(n.x + rnd(-20, 20), nodeH(n) + 12, 2, 10); } },
      end: () => { M.pose = 'stand'; M.rot = 0; b.wob = 0; notes(M.x, M.h + 60, 3); try { if (typeof say === 'function') say('m_giggle'); } catch (e) { } blip(7, 'triangle', 0.1, 0.1); blip(12, 'triangle', 0.12, 0.1); } });
  }
  function gustNow(n) {                                         // a big gust: hold on tight
    const M = S.M, T = S.T; if (S.said.gust) return; S.said.gust = 1; M.busy = true; SND.gust(2.4); line('m_tree_hold', null, 3);
    push({ d: 2.3, f: (k, s) => { S.gust = Math.sin(k * Math.PI); M.pose = n.br ? 'whoa' : 'hug'; M.ft = n.br ? k * 14 : 1 + ((k * 9) | 0) % 3; if (n.br) M.h = nodeH(n); M.rot = 0.12 * S.gust * Math.sin(k * 30); M.sx = 1 + 0.03 * Math.sin(k * 40);
      if (Math.random() < 0.7) emit({ scr: 1, sx: -8, sy: rnd(0, S.VH), vx: rnd(220, 380), vy: rnd(-20, 20), life: 1.2, kind: Math.random() < 0.5 ? 'leaf' : 'line', c: pick(LEAFC[T.kind]), ph: rnd(0, 9), len: 1, w: rnd(6, 14), front: 1 }); S.shake = Math.max(S.shake, 1.2 * S.gust); },
      end: () => { S.gust = 0; M.rot = 0; M.sx = 1; M.pose = n.br ? 'stand' : 'hug'; M.ft = 2; speak('m_wow', 3); } });
  }
  function robin() {                                            // a little bird lands on her head
    const M = S.M; if (M.head || S.said.robin) return; S.said.robin = 1; const b = M.head = { t: 0, st: 'in', x: M.x + 90, h: M.h + 110 }; SND.chirp(0.1); SND.chirp(0.7, 3000);
    after(1.6, () => { if (S && S.M.head === b) notes(S.M.x, S.M.h + 70, 2); });
  }
  function flyOff() { const M = S.M, b = M.head; if (!b) return; M.head = null; SND.chirp(); emit({ x: b.x, h: b.h, vx: 46, vy: -52, g: -20, life: 2, kind: 'spr', k: 'robin', flip: true, flap: 1, fade: 1 }); }
  // poke a toy (a tap on it, or Marina arriving next to it)
  function poke(toy, arrived) {
    const T = S.T, M = S.M, x = toy.x ? toy.x() : 0, h = toy.h ? toy.h() : 0, t = toy.type;
    if (t === 'owl') { if (toy.st) return; toy.st = 1; toy.t = 0; SND.hoot(); line('m_tree_owl', null, 5); for (let i = 0; i < 3; i++) emit({ x: x + rnd(-8, 8), h: h + 20, vx: rnd(-14, 14), vy: -rnd(4, 14), g: 26, life: 1.4, kind: 'leaf', c: '#c9b089', ph: rnd(0, 9) }); }
    else if (t === 'nest') { toy.t = 0; if (!toy.chicks) { if (toy.st < 2) { toy.st++; SND.tok(0, 0.12); if (toy.st === 2) { toy.chicks = true; sparkle(x, h + 14, 8); SND.peep(0.15); SND.peep(0.5); } } } else { SND.peep(); SND.peep(0.35); toy.hopT = 0.8; } }
    else if (t === 'squirrel') { if (toy.st === 1) return; SND.chatter(); if (!S.said.sq) { S.said.sq = 1; speak('m_squirrel', 5); } toy.st = 1; toy.t = 0; toy.fromX = x; toy.fromH = h; toy.hops = (toy.hops || 0) + 1; toy.toH = h + 150 + toy.hops * 30; toy.toX = (toy.hops % 2 ? -1 : 1) * (T.hw(toy.toH) + 1); }
    else if (t === 'ladybird') { if (toy.st) return; toy.st = 1; toy.t = 0; tone(180, 240, 0.9, 'sawtooth', 0.02); }
    else if (t === 'raccoon') { toy.jolt = 1; toy.bub = 0; SND.pop(); after(0.9, () => S && SND.snore()); sparkle(x - 16 * (toy.nd.side), h + 16, 4); }
    else if (t === 'kite' || t === 'balloon') { if (toy.st) return; toy.st = 1; toy.t = 0; tone(500, 1500, 1.1, 'sine', 0.07); if (arrived) { const n = toy.nd; S.M.busy = true; push({ d: 0.5, f: k => { M.pose = 'reach'; M.ft = Math.min(4, k * 8); M.flip = n.side < 0; }, end: () => { M.pose = 'stand'; } }); } leaves(x, h - 6, 6, 12); rustle(0.1); }
    else if (t === 'treasure') { if (toy.st) return; toy.st = 1; toy.t = 0; jingle([0, 4, 7, 12, 16], 0.07, 'triangle'); speak('m_found', 5); sparkle(x, h + 20, 14); after(1.0, () => { if (S) { S.got.push('chest'); sparkle(x, h + 20, 8); } }); }
    else if (t === 'web') { const i = arrived ? -1 : toy.pick || 0; if (i < 0) for (let j = 0; j < 5; j++) { after(j * 0.09, () => { if (S) { toy.str[j] = 1; blip([0, 2, 4, 7, 9][j] + 5, 'triangle', 0.5, 0.11); } }); } else { toy.str[i] = 1; blip([0, 2, 4, 7, 9][i] + 5, 'triangle', 0.6, 0.14); } sparkle(x, h, 3, '#bfe9ff'); }
    else if (t === 'woodpecker') { if (arrived) { toy.listen = 1; toy.taps = 0; toy.next = 0.3; } else if (toy.drum) drumTap(toy); else toy.next = 0; }
    else if (t === 'rope' && arrived) ropeSwing(toy);
  }
  function drumTap(toy) {                                       // she copies the woodpecker's knock on the trunk
    const M = S.M; SND.tok(0, 0.36); toy.taps++; M.sx = 1.08; bark(toy.dx(), toy.dh(), 3); S.shake = 1;
    if (toy.taps >= toy.beat) { toy.taps = 0; toy.happy = 1.4; toy.next = 2.6; notes(toy.x(), toy.h() + 30, 3); for (let i = 0; i < 9; i++) SND.tok(0.25 + i * 0.07, 0.14); jingle([7, 12, 16], 0.08, 'triangle'); }
  }
  function ropeSwing(toy) {                                     // grab the rope and fly across the gap
    const M = S.M, a = toy.nd, b = toy.to, T = S.T; if (!b) return; M.busy = true; const ph = toy.ph_; let L, th0;
    push({ d: 0.28, start: () => { M.pose = 'reach'; M.flip = false; }, f: k => { M.ft = k * 4.9; } },
      { d: 1.25, start: () => { M.pose = 'laugh'; L = Math.hypot(a.x, ph - (nodeH(a) + 50)); th0 = Math.asin(clamp(a.x / L, -1, 1)); whoosh(true); speak('m_swing', 8); toy.held = true; a.br.v -= 60; },
        f: k => { const th = th0 * Math.cos(Math.PI * eio(k)); M.x = Math.sin(th) * L; M.h = ph - Math.cos(th) * L; M.rot = -th * 0.9; M.ft = k * 12; toy.ang = th; toy.len = L; if (Math.random() < 0.5) emit({ x: M.x, h: M.h - rnd(10, 50), vx: 0, vy: 0, life: 0.25, kind: 'line', c: '#ffffff', len: 1, w: rnd(6, 12) }); if (k > 0.45 && !toy.w2) { toy.w2 = 1; whoosh(false); } },
        end: () => { toy.held = false; toy.free = 0; M.rot = 0; M.pose = 'leap'; M.ft = 4; M.h -= HANG - 8; } });
    hop(b.x, () => nodeH(b), 0.3, 10); land(b);
  }

  // ------------------------------------------------------------------ taps while climbing
  function tapClimb(p) {
    const M = S.M, T = S.T; if (!M) return;
    // a toy under the finger answers at once, even from far away
    let best = null, bd = 24;
    for (const toy of T.toys) { if (!toy.x || toy.type === 'rope') continue; const dx = X(wx(toy.x(), toy.h())) - p.x, dy = Y(toy.h()) - (toy.type === 'web' ? 0 : 12) - p.y, d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = toy; } }
    const cs = candidates(); let cn = null, cd = 1e9;
    for (const n of cs) { const d = Math.hypot(X(wx(n.x, nodeH(n))) - p.x, Y(nodeH(n)) - 14 - p.y); if (d < cd) { cd = d; cn = n; } }
    for (const toy of T.toys) if (toy.type === 'woodpecker' && toy.drum && Math.hypot(X(wx(toy.dx(), toy.dh())) - p.x, Y(toy.dh()) - p.y) < 20) { drumTap(toy); return; }
    if (best && !(cn && cs.some(n => n === best.nd) && cd < 30)) { if (best.type === 'web') { const a = Math.atan2(Y(best.h()) - p.y, p.x - X(wx(best.x(), best.h()))); best.pick = clamp(Math.round(((a + TAU) % TAU) / TAU * 5), 0, 4); } poke(best, false); if (!cn || cd > 26) return; }
    if (Math.hypot(X(wx(M.x, M.h)) - p.x, Y(M.h) - 30 - p.y) < 18 && (!cn || cd > 30)) { M.sy = 0.86; M.sx = 1.12; blip(9, 'triangle', 0.07, 0.1); notes(M.x, M.h + 60, 1); return; }      // tickle her
    if (cn) goNode(cn);
  }

  // ------------------------------------------------------------------ the top
  function topMoment() {
    const M = S.M, T = S.T; S.phase = 'topfx'; S.reached = true; S.topAt = S.t; S.topSkip = false; M.busy = true; S.best = T.n; S.hint = 0;
    const bell = T.K.top === 'bell'; T.topT = 0;
    jingle([0, 4, 7, 12, 7, 12, 16, 19, 24], 0.1, 'square'); line('m_tree_top', 'm_yay', 0);
    if (bell) { for (let i = 0; i < 4; i++) SND.bell(0.3 + i * 0.42, i % 2 ? 1175 : 1568); }
    for (let i = 0; i < 12; i++) emit({ x: M.x + rnd(-60, 60), h: M.h + rnd(-30, 20), vx: rnd(-70, 70), vy: -rnd(30, 80), g: -10, life: rnd(2, 3.2), kind: 'spr', k: 'bird', flap: 1, ph: rnd(0, 6), flip: Math.random() < 0.5, fade: 1, d: rnd(0, 0.4), s: rnd(0.5, 0.8) });
    leaves(M.x, M.h + 20, 30, 50, true); after(0.3, () => S && SND.chirp()); after(0.7, () => S && SND.chirp(0, 3100));
    push({ d: 3.4, f: (k, s) => { M.pose = bell ? (k < 0.5 ? 'reach' : 'cheer') : 'cheer'; M.ft = bell && k < 0.5 ? 3 + Math.sin(k * 40) : k * 16; M.h = nodeH(M.node) + (M.pose === 'cheer' ? Math.abs(Math.sin(k * 16)) * 5 : 0); if (Math.random() < 0.2) sparkle(M.x + rnd(-30, 30), M.h + rnd(20, 80), 1); if (S.topSkip && k > 0.4) s.t = s.d; },
      end: () => { M.pose = bell ? 'hug' : 'stand'; M.ft = 2; M.h = nodeH(M.node); openView(true); } });
  }
  // back from the view: how shall she come down?
  function choose() {
    if (!S || S.phase !== 'view') return; closeView(); S.phase = 'choose'; const M = S.M; M.pose = 'cheer'; blip(4, 'triangle', 0.1, 0.12);
    const box = S.pick = mk('div', 'tc-pick'); box.append(btn('', '🪢', 'rope', () => descend('rope')), btn('', '🍂', 'leaf', () => descend('leaf'))); S.body.append(box);
  }
  function descend(how) {
    if (!S || S.phase !== 'choose') return; const M = S.M, T = S.T; if (S.pick) { S.pick.remove(); S.pick = null; } S.phase = how; M.q = []; M.busy = true; M.head = null; line('m_tree_down', null, 0);
    if (how === 'rope') {
      const rx = T.hw(T.H * 0.5) + 12, h0 = T.H + 46, d = 1.5 + T.H / 420; T.downRope = { x: rx, k: 0 }; let hs;
      push({ d: 0.3, start: () => { hs = M.h; M.pose = 'leap'; M.ft = 2; M.flip = false; }, f: k => { M.x = lerp(M.x, rx, k); M.h = lerp(hs, h0 - HANG, k) + 20 * Math.sin(k * Math.PI); }, end: () => { M.pose = 'laugh'; M.h = h0; whoosh(false); tone(1100, 180, d, 'sawtooth', 0.04); SND.gust(d); } },
        { d, f: k => { const e = k < 0.85 ? Math.pow(k / 0.85, 1.7) * 0.93 : 0.93 + 0.07 * eout((k - 0.85) / 0.15); M.h = lerp(h0, HANG + 2, e); M.x = rx; M.ft = k * d * 12; M.sy = 1.08; S.speed = k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15; S.gust = 0.4 * S.speed;
          for (let i = 0; i < 3; i++) if (Math.random() < S.speed) emit({ scr: 1, sx: rnd(0, S.VW), sy: S.VH + 4, vx: 0, vy: -rnd(260, 420), life: 0.6, kind: 'line', c: Math.random() < 0.6 ? '#ffffff' : pick(LEAFC[T.kind]), len: rnd(10, 26), front: 1 }); },
          end: () => { M.pose = 'stand'; M.h = 0; M.sy = 0.72; M.sx = 1.2; S.speed = 0; S.gust = 0; dust(M.x, 0, 14); SND.thunk(); S.shake = 4; } },
        { d: 0.3, f: k => { M.sy = lerp(0.72, 1, back(k)); M.sx = lerp(1.2, 1, back(k)); } });
    } else {
      const lx = 84 * T.xs + 20, d = 8.5; let hs, xs0; S.leafV = 0; S.floaters = []; for (let h = T.H - 60, i = 0; h > 110; h -= 64, i++) S.floaters.push({ x: lx + [-34, 6, 44, 6][i % 4] * T.xs, h, k: 'goldleaf', ph: i });
      push({ d: 0.55, start: () => { hs = M.h; xs0 = M.x; M.pose = 'leap'; M.flip = false; whoosh(true); }, f: k => { M.ft = 1 + k * 3; M.x = lerp(xs0, lx, k); M.h = lerp(hs, T.H + 30, k) + 34 * Math.sin(k * Math.PI); M.rot = 0.3 * (0.5 - k); }, end: () => { M.pose = 'laugh'; M.rot = 0; M.h += HANG; S.leafOn = true; SND.gust(1); } },
        { d, start: s => { s.h0 = M.h; }, f: (k, s, dt) => { M.h = lerp(s.h0, HANG + 16, k); S.leafV *= Math.pow(0.2, dt); M.x = clamp(M.x + S.leafV * dt + Math.sin(S.t * 1.7) * 14 * dt, T.hw(M.h) + 26, lx + 70 * T.xs + 30); if (k > 0.82) M.x = lerp(M.x, S.pileX == null ? (S.pileX = M.x) : S.pileX, 0.1);
          M.rot = Math.sin(S.t * 1.7) * 0.14 + S.leafV * 0.004; M.ft = S.t * 7;
          for (const f of S.floaters) if (!f.got && Math.hypot(f.x - M.x, f.h - (M.h - 30)) < 30) { f.got = 1; S.got.push('goldleaf'); const i = S.got.length; blip(12 + (i % 6) * 2, 'sine', 0.2, 0.14); sparkle(f.x, f.h, 8); }
          if (Math.random() < 0.1) emit({ x: M.x + rnd(-20, 20), h: M.h + 30, vx: rnd(-10, 10), vy: -30, life: 0.5, kind: 'line', c: '#ffffff', len: rnd(4, 9) }); },
          end: () => { S.leafOn = false; M.hide = true; SND.poof(); S.shake = 4; S.pileBoom = S.t; const cs = LEAFC.oak; for (let i = 0; i < 90; i++) emit({ x: M.x + rnd(-30, 30), h: rnd(4, 30), vx: rnd(-120, 120), vy: -rnd(40, 190), g: 190, life: rnd(1, 2.2), kind: 'leaf', c: pick(cs), ph: rnd(0, 9), front: Math.random() < 0.5 }); } },
        { d: 0.55 }, { d: 0.5, start: () => { M.hide = false; M.pose = 'jump'; M.h = 0; SND.pop(); try { if (typeof say === 'function') say('m_giggle'); } catch (e) { } }, f: k => { M.ft = 3 + k * 3; M.h = 26 * Math.sin(k * Math.PI); M.sy = 1 + 0.1 * Math.sin(k * Math.PI); } });
    }
    push({ d: 1.2, start: () => { M.pose = 'cheer'; M.rot = 0; M.h = 0; jingle([0, 4, 7, 12], 0.07, 'triangle'); }, f: k => { M.ft = k * 8; M.h = Math.abs(Math.sin(k * 9)) * 5; }, end: finish });
  }
  function steer(p) { const M = S.M; if (!S.leafOn) return; const dir = p.x < X(M.x) ? -1 : 1; S.leafV += dir * 62; blip(dir > 0 ? 4 : 0, 'sine', 0.08, 0.08); emit({ x: M.x - dir * 16, h: M.h + 26, vx: -dir * 50, vy: 0, life: 0.3, kind: 'line', c: '#ffffff', len: 1, w: 10 }); }

  // ------------------------------------------------------------------ one frame
  function frame(now) {
    if (!S) return;
    if (!S.body.isConnected || S.panel.classList.contains('hidden')) { const st = S; teardown(); try { if (typeof setMusic === 'function') setMusic(); } catch (e) { } report(st); return; }   // something else closed the panel
    const dt = S.dt = clamp((now - S.last) / 1000 || 0.016, 0.001, 0.05); S.last = now; S.t += dt; S.raf = requestAnimationFrame(frame);
    for (let i = S.timers.length - 1; i >= 0; i--) if (S.timers[i].t <= S.t) { const f = S.timers[i].fn; S.timers.splice(i, 1); f(); if (!S) return; }
    const g = S.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (S.phase === 'load') { drawLoading(g); return; }
    if (S.T && !(S.V && S.iris && S.iris.k >= 1)) { update(dt); if (!S) return; }
    if (S.V) updateView(dt);
    if (S.V && (!S.iris || S.iris.k >= 1)) drawView(g);
    else { if (S.T) drawClimb(g); if (S.V && S.iris) { g.save(); g.beginPath(); g.arc(S.iris.x, S.iris.y, Math.max(1, S.iris.k * Math.hypot(S.VW, S.VH)), 0, TAU); g.clip(); drawView(g); g.restore(); } }
    if (S.iris && S.iris.k < 1) S.iris.k = Math.min(1, S.iris.k + dt * 1.3);
  }
  function drawLoading(g) { g.fillStyle = '#8cc4ee'; g.fillRect(0, 0, S.VW, S.VH); for (let i = 0; i < 3; i++) { const y = S.VH / 2 - Math.abs(Math.sin(S.t * 5 - i * 0.6)) * 10; px(g, S.VW / 2 - 14 + i * 12, y, 5, 4, ['#e8862e', '#f0aa3c', '#c8542c'][i]); } }

  function update(dt) {
    const M = S.M, T = S.T, cam = S.cam;
    stepSeq(dt); if (!S) return;
    // limbs spring under her weight
    for (const b of T.br) { const tgt = b.load ? 3.5 : 0, k = b.bouncy ? 60 : 120, c = b.bouncy ? 4 : 9; b.v += (-(b.dip - tgt) * k - b.v * c) * dt; b.dip += b.v * dt * 0.1; if (b.wob) b.wobT += dt; }
    if (!M.busy && S.phase === 'climb') { if (M.node.br) M.h = nodeH(M.node); M.sx = lerp(M.sx, 1, dt * 10); M.sy = lerp(M.sy, 1, dt * 10); M.idle += dt;
      if (M.node.br) { if (M.idle > 5 && M.pose === 'stand') { M.pose = 'sit'; rustle(0.05); } } }
    if (S.phase === 'choose') { M.ft += dt * 6; M.h = nodeH(M.node); }
    // the bird on her head
    const hb = M.head; if (hb) { hb.t += dt; const tx = M.x + (M.flip ? 2 : -2), th = M.h + (hands(M.pose) ? -2 : M.pose === 'sit' ? 44 : 57); if (hb.st === 'in') { hb.x = lerp(hb.x, tx, dt * 3.2); hb.h = lerp(hb.h, th, dt * 3.2); if (Math.hypot(hb.x - tx, hb.h - th) < 2) { hb.st = 'on'; SND.chirp(); } } else { hb.x = tx; hb.h = th; if (Math.random() < dt * 0.4) SND.chirp(); } }
    // toys
    for (const toy of T.toys) toyStep(toy, dt);
    // drifting leaves, more the higher up; wind in her ears
    const w = wind(cam.h); if (Math.random() < dt * (0.6 + w * 5)) emit({ scr: 1, sx: -4, sy: rnd(-10, S.VH * 0.8), vx: 20 + w * rnd(40, 90), vy: rnd(8, 26), g: 0, life: 4, kind: 'leaf', c: pick(LEAFC[T.kind === 'pine' && cam.h > 300 ? 'pine' : 'oak']), ph: rnd(0, 9), front: Math.random() < 0.4 });
    stepFx(dt);
    const hk = clamp(cam.h / T.H, 0, 1); loopSet('wind', (0.012 + 0.1 * Math.pow(hk, 1.4)) * (1 + S.gust * 1.5) + (S.speed || 0) * 0.1, 260 + 700 * hk + S.gust * 500 + Math.sin(S.t * 0.7) * 80);
    if (Math.random() < dt * 0.22 && S.phase === 'climb') SND.chirp(0, pick([2400, 2900, 3300]));
    if (Math.random() < dt * 0.1 && hk > 0.2) SND.creak();
    // camera: a soft spring that overshoots a touch
    const fast = S.phase === 'rope' || S.phase === 'quick', cs = candidates(); let tx = M.x * 0.6, lead = 30;
    if (cs.length) { let lo = M.x, hi = M.x; for (const n of cs) { lo = Math.min(lo, n.x); hi = Math.max(hi, n.x); } tx = (lo + hi) / 2; } else if (S.phase === 'leaf') tx = M.x * 0.75; else if (S.phase === 'topfx' || S.phase === 'choose') { tx = 0; lead = 44; }
    const mh = hands(M.pose) ? M.h - HANG : M.h, th = Math.max(camMin(), mh + lead + (S.phase === 'leaf' ? -S.VH * 0.2 : 0)), K = fast ? 190 : 34, C = fast ? 26 : 7.6;
    cam.vh += ((th - cam.h) * K - cam.vh * C) * dt; cam.h += cam.vh * dt; cam.vx += ((tx - cam.x) * 30 - cam.vx * 8) * dt; cam.x += cam.vx * dt; if (cam.h < camMin() - 6) { cam.h = camMin() - 6; cam.vh = 0; }
    S.shake = Math.max(0, S.shake - dt * 9);
    // nothing tapped for a while: a little hand shows where
    if (S.phase === 'climb' && !M.busy) { S.hint += dt; } else S.hint = 0;
    if (T.topT != null) T.topT += dt;
  }

  function toyStep(toy, dt) {
    const T = S.T, M = S.M, t = toy.type; toy.t += dt;
    if (t === 'owl' && toy.st && toy.t > 2.6) toy.st = 0;
    else if (t === 'squirrel' && toy.st === 1) { const k = toy.t / 1.1; if (k >= 1) { toy.st = 2; const hx = toy.toX, hh = toy.toH; toy.x = () => hx; toy.h = () => hh; toy.side = Math.sign(hx); if (hh > T.H - 60) toy.st = 3; } else if (Math.random() < 0.3) bark(lerp(toy.fromX, toy.toX, k), lerp(toy.fromH, toy.toH, k), 1); }
    else if (t === 'squirrel' && toy.st === 2 && !M.busy && S.phase === 'climb' && M.h > toy.h() - 64) poke(toy, false);
    else if (t === 'ladybird' && toy.st && toy.t > 3.2) toy.st = 0;
    else if (t === 'raccoon') { toy.jolt = Math.max(0, (toy.jolt || 0) - dt * 2.5); toy.bub = (toy.bub || 0) + dt * 0.45; if (toy.bub > 1) { toy.bub = 0; if (Math.abs(toy.h() - M.h) < 120) SND.snore(); } }
    else if (t === 'nest') toy.hopT = Math.max(0, (toy.hopT || 0) - dt);
    else if (t === 'web') for (let i = 0; i < 5; i++) toy.str[i] = Math.max(0, toy.str[i] - dt * 1.4);
    else if (t === 'woodpecker') {
      toy.happy = Math.max(0, (toy.happy || 0) - dt); toy.peck = Math.max(0, (toy.peck || 0) - dt * 9);
      const near = M.node === toy.nd && !M.busy && S.phase === 'climb'; toy.drum = near; if (!toy.dx) { toy.dx = () => -T.hw(toy.nd.h0 + 36) + 4; toy.dh = () => toy.nd.h0 + 40; }
      if (toy.q && toy.q.length) { toy.qt -= dt; if (toy.qt <= 0) { toy.q.shift(); toy.peck = 1; SND.tok(0, 0.22); bark(toy.x() - 8, toy.h() + 22, 2); toy.qt = 0.24; } }
      else if (toy.next != null) { toy.next -= dt; if (toy.next <= 0 && Math.abs(toy.h() - S.cam.h) < S.VH) { toy.q = new Array(toy.beat).fill(1); toy.qt = 0; toy.next = near ? 3.4 : 6 + Math.random() * 4; } }
      else toy.next = 2;
    }
    else if (t === 'rope' && !toy.held && toy.free != null) toy.free += dt;
  }

  // ------------------------------------------------------------------ painting the climb
  const SKYA = [hex('#9fd0f2'), hex('#d9eefb')], SKYB = [hex('#3f86d6'), hex('#b4dcf5')];
  function drawClimb(g) {
    const VW = S.VW, VH = S.VH, T = S.T, M = S.M, cam = S.cam, hk = clamp(cam.h / T.H, 0, 1);
    const shx = S.shake ? Math.round(rnd(-1, 1) * S.shake) : 0, shy = S.shake ? Math.round(rnd(-1, 1) * S.shake) : 0; if (shx || shy) g.translate(shx, shy);
    // sky, deeper blue the higher she is
    const top = mixc(SKYA[0], SKYB[0], hk), bot = mixc(SKYA[1], SKYB[1], hk); for (let y = 0; y < VH; y += 4) { g.fillStyle = css(mixc(top, bot, Math.pow(y / VH, 0.8))); g.fillRect(0, y, VW, 4); }
    // far away: the edge of the world she will see from the top
    const fy = Math.round(VH * 0.78 + (T.H - cam.h) * 0.13), pm = SP.pano_mid;
    if (fy - PANO.HZ < VH) { px(g, 0, fy, VW, 60, '#5d9fd0'); px(g, 0, fy, VW, 2, '#8fc2e4'); let sx = ((300 + cam.x * 0.06) % PANO.PW + PANO.PW) % PANO.PW; for (let x = 0; x < VW;) { const w = Math.min(VW - x, PANO.PW - sx); g.drawImage(IMG, pm[0] + sx, pm[1], w, pm[3], x, fy - PANO.HZ, w, pm[3]); x += w; sx = 0; } g.fillStyle = css(bot, 0.28); g.fillRect(0, fy - PANO.HZ, VW, VH); }
    // clouds
    for (let i = 0; i < 5; i++) { const k = ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_a', 'cloud_b'][i], cx = ((i * 137 + S.t * (3 + i) - cam.x * 0.1) % (VW + 140) + VW + 140) % (VW + 140) - 70, cy = VH * 0.5 - (T.H * (0.35 + i * 0.16) - cam.h) * 0.22; if (cy > -30 && cy < VH + 20) put(g, k, cx, cy, { a: 0.9 }); }
    // the woods round the lawn: a hazy far wall and a near one
    const wd = SP.bg_woods, gy = S.AY + cam.h;                          // gy: where the tree meets the grass
    for (const [p, far, sh] of [[0.36, true, 173], [0.52, false, 0]]) { const base = Math.round(S.AY + cam.h * p + (far ? -6 : 0)), y0 = base - wd[3] + 12; if (y0 > VH) continue; const img = far ? cut('bg_woods', null, ['#a9cdea', 0.5]) : cut('bg_woods');
      let ox = -(((cam.x * p + sh) % 640) + 640) % 640; for (let x = ox, i = 0; x < VW; x += 320, i++) { if (x + 320 < 0) continue; if (i % 2) { g.save(); g.translate(Math.round(x) + 320, 0); g.scale(-1, 1); g.drawImage(img, 0, y0); g.restore(); } else g.drawImage(img, Math.round(x), y0); }
      if (!far) { const ly = base - 2; if (ly < VH) { for (let y = Math.max(0, ly), i = 0; y < Math.min(VH, gy + 40); y += 3, i++) { const k = clamp((y - ly) / Math.max(1, gy - ly), 0, 1); g.fillStyle = css(mixc([150, 186, 96], [108, 156, 70], k)); g.fillRect(0, y, VW, 3); }
        for (let i = 0; i < 26; i++) { const lx = (((i * 97.3 - cam.x * (0.55 + (i % 5) * 0.09)) % (VW + 20)) + VW + 20) % (VW + 20) - 10, k = (i * 0.618) % 1, y = ly + 3 + k * (gy - ly); if (y < VH) px(g, lx, y, 3, 1, ['#d9963a', '#c8642c', '#e8b84a', '#88b25a'][i % 4]); } } } }
    // the back of the house
    const hs = SP.bg_house, hgy = Math.round(S.AY + cam.h * 0.94 - 8), hx = Math.round(VW / 2 + 112 * T.xs + 24 - cam.x * 0.86 - 300);
    if (hgy - 384 < VH && hgy + 8 > 0) { g.drawImage(IMG, hs[0], hs[1], hs[2], hs[3], hx, hgy - 384, hs[2], hs[3]); px(g, hx - 6, hgy - 250, 7, 242, '#f1efe6'); px(g, hx - 6, hgy - 250, 1, 242, '#cfd0cb'); px(g, hx, hgy - 250, 1, 242, '#cfd0cb'); px(g, hx - 8, hgy - 254, 10, 5, '#f1efe6'); px(g, hx - 6, hgy + 2, 306, 3, 'rgba(60,90,50,.35)'); }
    // grass in front
    if (gy < VH + 4) { px(g, 0, gy - 1, VW, VH - gy + 6, '#6c9c46'); px(g, 0, gy - 1, VW, 2, '#8cba5c'); for (let i = 0; i < 40; i++) { const lx = (((i * 53.7 - cam.x) % (VW + 20)) + VW + 20) % (VW + 20) - 10; px(g, lx, gy + 2 + (i * 7) % Math.max(1, VH - gy), 2, 2, ['#d9963a', '#c8642c', '#e8b84a', '#5c8a3c', '#7fae52'][i % 5]); } }
    // the tree: crown behind, limbs, trunk, leaves
    const vis = h => { const y = Y(h); return y > -70 && y < VH + 70; };
    for (const c of T.canopy) { if (!vis(c.h)) continue; const w = wind(c.h); put(g, c.k, X(wx(c.x, c.h)) + Math.sin(S.t * 1.6 + c.ph) * w * 2.5, Y(c.h) + Math.sin(S.t * 1.1 + c.ph) * w, { img: c.dk ? cut(c.k, '#8f7a78') : cut(c.k, '#c9b8ae') }); }
    for (const b of T.br) if (vis(b.h0)) drawLimb(g, b, false);
    const tc = T.trunk, tw = tc.width, y0 = Math.max(0, Y(T.tip + 6)), yb = Math.min(VH, gy + 2);
    for (let y = y0; y < yb; y += 6) { const h = S.AY + cam.h - y, sy = tc.height - 1 - Math.round(h) - 5, hh = Math.min(6, yb - y); if (sy + 6 < 0 || sy >= tc.height) continue; g.drawImage(tc, 0, Math.max(0, sy), tw, hh, X(wx(0, h)) - tw / 2, y, tw, hh); }
    for (const c of T.cap) if (vis(c.h)) { const w = wind(c.h); put(g, c.k, X(wx(c.x, c.h)) + Math.sin(S.t * 1.6 + c.ph) * w * 2, Y(c.h) + Math.sin(S.t * 1.1 + c.ph) * w); }
    if (gy < VH + 10) { const hw = T.hw(0); px(g, X(-hw - 6), gy - 2, hw * 2 + 12, 4, T.K.bark[1]); px(g, X(-hw - 10), gy + 1, hw * 2 + 20, 2, 'rgba(40,60,30,.4)'); }
    // holds on the trunk
    for (const n of T.nodes) if (!n.br && n.toy !== 'top' && vis(n.h0)) { const x = X(wx(n.x, n.h0)), y = Y(n.h0); px(g, x - 5, y - 1, 10, 4, T.K.bark[3]); px(g, x - 4, y - 2, 8, 2, T.K.bark[2]); px(g, x - 3, y, 6, 2, T.K.bark[1]); }
    for (const b of T.br) if (vis(b.h0)) drawLimb(g, b, true);
    for (const toy of T.toys) if (toy.x && vis(toy.h()) && (toy.type === 'owl' || toy.type === 'treasure' || toy.type === 'web')) drawToy(g, toy);
    if (T.rope) drawRope(g, T.rope);
    for (const toy of T.toys) if (toy.x && vis(toy.h()) && toy.type !== 'owl' && toy.type !== 'treasure' && toy.type !== 'web' && toy.type !== 'rope') drawToy(g, toy);
    // things to collect bob above their spots
    for (const c of T.cols) { const h = nodeH(c.nd) + 34, x = X(wx(c.nd.x, h)), y = Y(h); if (y < -30 || y > VH + 30) continue;
      if (!c.got) { put(g, c.k, x, y + Math.sin(S.t * 3 + c.ph) * 2.5, { rot: Math.sin(S.t * 2 + c.ph) * 0.15 }); if (Math.sin(S.t * 4 + c.ph) > 0.8) px(g, x + 8, y - 22, 1, 1, '#fff'); }
      else { const k = (S.t - c.got) / 0.55; if (k < 1) { const bx = 10, by = VH - 12; put(g, c.k, lerp(x, bx, eio(k)), lerp(y, by, eio(k)) - Math.sin(k * Math.PI) * 30, { sx: 1 - k * 0.4, sy: 1 - k * 0.4, rot: k * 6 }); } } }
    if (S.floaters) for (const f of S.floaters) if (!f.got && vis(f.h)) put(g, f.k, X(f.x), Y(f.h) + Math.sin(S.t * 3 + f.ph) * 3, { rot: Math.sin(S.t * 2 + f.ph) * 0.3 });
    // the top: a flag to plant or a bell to ring
    drawTop(g);
    if (T.downRope) { const x = X(wx(T.downRope.x, T.H)); for (let y = Math.max(0, Y(T.H + 52)); y < Math.min(VH, gy); y += 4) { const h = S.AY + cam.h - y; px(g, X(wx(T.downRope.x, h)), y, 2, 4, (Math.floor(h / 4) % 2) ? '#e8d3a0' : '#c9ad72'); } px(g, x - 2, Y(T.H + 54), 6, 3, '#8a6a3a'); }
    drawFx(g, false);
    // the leaf pile she lands in
    if (S.phase === 'leaf' && gy < VH + 40) { const pxw = S.pileX == null ? M.x : S.pileX, boom = S.pileBoom ? S.t - S.pileBoom : -1; put(g, 'leafpile', X(pxw), gy + 3, boom >= 0 ? { sx: 1 + 0.25 * Math.max(0, 1 - boom * 3), sy: Math.max(0.55, 1 - 0.5 * Math.max(0, 1 - boom * 2.5)) + (boom > 0.4 ? 0.1 * Math.min(1, boom - 0.4) : 0) } : null); }
    drawMarina(g);
    for (const b of T.br) if (vis(b.h0)) for (const l of b.leaves) if (l.front) drawLeaf(g, b, l);
    drawFx(g, true);
    // where she can go next: glowing, pulsing spots
    const cs = candidates(), pulse = 0.5 + 0.5 * Math.sin(S.t * 5);
    for (const n of cs) { const h = nodeH(n), x = X(wx(n.x, h)), y = Y(h) - (n.br ? 13 : 16), r = 10 + pulse * 3;
      const gr = g.createRadialGradient(x, y, 1, x, y, r + 6); gr.addColorStop(0, 'rgba(255,255,220,.85)'); gr.addColorStop(0.55, 'rgba(255,232,120,.45)'); gr.addColorStop(1, 'rgba(255,232,120,0)'); g.fillStyle = gr; g.fillRect(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12);
      g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * pulse})`; g.lineWidth = 1; g.beginPath(); g.arc(x + 0.5, y + 0.5, r - 1, 0, TAU); g.stroke();
      for (let i = 0; i < 4; i++) { const a = S.t * 2 + i * TAU / 4 + n.i; px(g, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), 1, 1, '#fff'); } }
    for (const toy of T.toys) if (toy.type === 'woodpecker' && toy.drum) { const x = X(wx(toy.dx(), toy.dh())), y = Y(toy.dh()); g.strokeStyle = `rgba(160,255,200,${0.5 + 0.5 * pulse})`; g.beginPath(); g.arc(x + 0.5, y + 0.5, 6 + pulse * 2, 0, TAU); g.stroke(); px(g, x - 2, y - 2, 5, 5, T.K.bark[3]); px(g, x - 1, y - 1, 3, 3, T.K.bark[1]); }
    if (S.hint > 4 && cs.length) { const n = cs[Math.floor(S.hint / 3) % cs.length], h = nodeH(n), bob = Math.abs(Math.sin(S.t * 4)) * 5; hand(g, X(wx(n.x, h)) - 2, Y(h) - 4 + bob); }
    if (S.speed) { g.fillStyle = `rgba(255,255,255,${0.08 * S.speed})`; g.fillRect(0, 0, VW, VH); }
    if (shx || shy) g.translate(-shx, -shy);
    hud(g);
  }
  function drawLimb(g, b, leavesToo) {
    const T = S.T, sd = b.side, hwb = T.hw(b.h0) - 3, K = T.K;
    if (!leavesToo) {
      for (let ax = Math.max(0, Math.floor(hwb)); ax < b.len; ax += 2) { const t = ax / b.len, h = brTop(b, ax), th = Math.max(2, Math.round(lerp(b.th, 2, t))), x = X(wx(sd * ax, h)) - (sd < 0 ? 2 : 0), y = Y(h);
        px(g, x, y, 2, th, K.bark[0]); px(g, x, y, 2, 1, b.bouncy ? '#b9d67a' : K.bark[2]); px(g, x, y + th - 1, 2, 1, K.bark[3]); if (b.bouncy && (ax >> 1) % 4 === 0) px(g, x, y + 1, 2, 1, '#8fbf52'); if (b.wobbly && ax > b.len * 0.3 && (ax >> 1) % 9 === 0) px(g, x, y + 1, 1, th - 2, K.bark[3]); }
      if (b.bouncy) for (let ax = Math.floor(hwb) + 8; ax < b.len - 4; ax += 9) { const h = brTop(b, ax), x = X(wx(sd * ax, h)), y = Y(h); px(g, x, y - 3, 1, 3, '#6fae4e'); px(g, x - 2, y - 4, 2, 2, '#8fd05a'); px(g, x + 1, y - 5, 2, 2, '#a8e070'); }      // a young, springy limb with fresh sprouts
      return;
    }
    for (const l of b.leaves) if (!l.front) drawLeaf(g, b, l);
  }
  function drawLeaf(g, b, l) { const ax = b.len * l.t, h = brTop(b, Math.min(ax, b.len)) + l.up, w = wind(h), x = X(wx(b.side * ax, h)) + Math.sin(S.t * 1.8 + l.ph) * w * 2.2, y = Y(h) + Math.sin(S.t * 1.3 + l.ph) * w * 1.2 + (S.T.kind === 'pine' ? 20 : 8);
    if (S.T.kind === 'pine') put(g, l.k, x - b.side * 20, y, { flip: b.side > 0, rot: b.side * Math.sin(S.t * 1.5 + l.ph) * 0.05 * w }); else put(g, l.k, x, y); }
  function drawRope(g, toy) {                                   // the rope swing: tied back to her limb until she rides it, then it hangs free and sways
    const a = toy.nd, T = S.T, px0 = wx(0, toy.ph_), ph = toy.ph_; let ex, eh;
    if (toy.held) { ex = S.M.x; eh = S.M.h; } else if (toy.free != null) { const L = toy.len || 100, th = Math.sin(toy.free * 2.4) * 0.5 * Math.exp(-toy.free * 0.5) + Math.sin(S.t) * 0.03; ex = px0 + Math.sin(th) * L; eh = ph - Math.cos(th) * L; } else { ex = wx(a.x, nodeH(a)) + 6; eh = nodeH(a) + 44 + Math.sin(S.t * 2) * 1.5; }
    const n = 18; for (let i = 0; i <= n; i++) { const k = i / n, sag = toy.held || toy.free != null ? 0 : Math.sin(k * Math.PI) * 10; px(g, X(lerp(px0, ex, k)), Y(lerp(ph, eh, k) - sag), 2, 2, i % 2 ? '#e8d3a0' : '#c9ad72'); if (i < n) px(g, X(lerp(px0, ex, k + 0.5 / n)), Y(lerp(ph, eh, k + 0.5 / n) - (toy.held || toy.free != null ? 0 : Math.sin((k + 0.5 / n) * Math.PI) * 10)), 2, 2, '#d9c088'); }
    px(g, X(ex) - 1, Y(eh) - 1, 4, 4, '#b8975a'); px(g, X(px0) - 3, Y(ph) - 2, 8, 4, T.K.bark[1]);
    // the high limb it hangs from
    for (let dx = -34; dx < 34; dx += 2) px(g, X(px0 + dx), Y(ph + 2 + Math.abs(dx) * 0.1), 2, 5, T.K.bark[dx % 8 ? 0 : 1]);
  }
  function drawToy(g, toy) {
    const T = S.T, t = toy.type, h = toy.h(), x = X(wx(toy.x(), h)), y = Y(h), sd = toy.nd.side || 1;
    if (t === 'owl') { const up = toy.st === 1; put(g, up ? 'owl_wink' : 'owl_sleep', x, y, { sy: up ? 1 + 0.06 * Math.sin(toy.t * 20) * Math.max(0, 1 - toy.t) : 1 + 0.015 * Math.sin(S.t * 2) }); }
    else if (t === 'treasure') { for (const [dy, w] of [[-29, 6], [-28, 10], [-26, 14], [-23, 16], [-9, 14], [-7, 10], [-6, 6]]) px(g, x - w / 2, y + dy, w, dy < -24 || dy > -10 ? 2 : 14, T.K.bark[3]); for (const [dy, w] of [[-27, 6], [-26, 10], [-24, 12], [-10, 10], [-8, 6]]) px(g, x - w / 2, y + dy, w, dy === -24 ? 14 : 2, '#1c120c'); px(g, x - 8, y - 22, 1, 11, T.K.bark[2]); if (!toy.st) { if (Math.sin(S.t * 5 + toy.ph) > 0.3) { px(g, x - 1, y - 18, 3, 1, '#fff3a0'); px(g, x, y - 19, 1, 3, '#fff3a0'); } px(g, x + 3, y - 12, 1, 1, '#ffd76a'); }
      else { const k = Math.min(1, toy.t / 0.4), k2 = toy.t > 1 ? Math.min(1, (toy.t - 1) / 0.5) : 0; if (k2 < 1) put(g, 'chest', lerp(x, 12, eio(k2)), lerp(y - 4, S.VH - 8, eio(k2)) - Math.sin(k2 * Math.PI) * 26, { sx: back(k) * (1 - k2 * 0.4), sy: back(k) * (1 - k2 * 0.4) }); } }
    else if (t === 'web') { const R = 15; g.strokeStyle = 'rgba(235,245,255,.8)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62 + (sd > 0 ? 0 : 0), v = toy.str[i] * Math.sin(S.t * 60) * 2.5, ex = x + Math.cos(a) * R * 1.5, ey = y + Math.sin(a) * R * 1.5 + R; g.beginPath(); g.moveTo(x + 0.5, y + R + 0.5); g.quadraticCurveTo((x + ex) / 2 + v, (y + R + ey) / 2 + v, ex + 0.5, ey + 0.5); g.stroke();
        for (let j = 1; j <= 3; j++) { const dxp = x + Math.cos(a) * R * 0.5 * j + v * 0.5, dyp = y + R + Math.sin(a) * R * 0.5 * j; px(g, dxp, dyp, 1, 1, (Math.sin(S.t * 3 + i + j) > 0.6 || toy.str[i] > 0.3) ? '#ffffff' : '#9fd8ff'); } }
      g.strokeStyle = 'rgba(235,245,255,.5)'; for (let j = 1; j <= 3; j++) { g.beginPath(); g.arc(x + 0.5, y + R + 0.5, R * 0.5 * j, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.3); g.stroke(); } }
    else if (t === 'squirrel') { if (toy.st === 1) { const k = clamp(toy.t / 1.1, 0, 1), sx2 = X(wx(lerp(toy.fromX, toy.toX, Math.min(1, k * 2.2)), h)), hh = lerp(toy.fromH, toy.toH, eio(k)); put(g, 'sq_run', sx2, Y(hh) + Math.sin(k * 40) * 1.5, { rot: (toy.toX > 0 ? -1 : 1) * Math.PI / 2 * Math.min(1, k * 3), flip: toy.toX > 0 }); }
      else if (toy.st >= 2) put(g, 'sq_climb', x + (toy.side || 1) * 6, y + 10 + Math.sin(S.t * 6) * 0.6, { rot: (toy.side > 0 ? -1 : 1) * Math.PI / 2 * 0, flip: toy.side < 0 }); else put(g, 'sq_sit', x, y + 1, { flip: sd < 0, sy: 1 + 0.03 * Math.sin(S.t * 7) }); }
    else if (t === 'nest') { const hop = toy.hopT ? Math.abs(Math.sin(toy.hopT * 16)) * 3 : 0, wig = !toy.chicks && toy.st ? Math.sin(toy.t * 40) * Math.max(0, 1 - toy.t * 2) * 2 : 0; put(g, toy.chicks ? 'nest_chicks' : 'nest_eggs', x + wig, y + 5 - hop, toy.chicks ? { sy: 1 + 0.04 * Math.sin(S.t * 9) } : null); }
    else if (t === 'ladybird') { if (toy.st) { const k = toy.t / 3.2, a = k * TAU * 2.5, r = 26 * Math.sin(k * Math.PI); put(g, 'ladybird', x + Math.cos(a) * r, y - 6 - Math.sin(a) * r * 0.6 - Math.sin(k * Math.PI) * 14, { sx: 0.6, sy: 0.6 * (Math.sin(S.t * 50) > 0 ? 1 : 0.8), rot: a }); } else put(g, 'ladybird', x + Math.sin(S.t * 0.8 + toy.ph) * 3, y + 1, { sx: 0.55, sy: 0.55, rot: Math.PI / 2 * sd }); }
    else if (t === 'raccoon') { const j = toy.jolt || 0; put(g, 'raccoon', x, y + 3 - Math.sin(j * Math.PI) * 6, { flip: sd > 0, sy: 1 + 0.035 * Math.sin(S.t * 1.8), rot: Math.sin(j * 20) * 0.1 * j }); const b = toy.bub || 0, r = Math.round(1 + b * 5), bx = x - sd * -17 * 0 + (sd > 0 ? 17 : -17), by = y - 8 - r; if (!j && b > 0.05) { g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(bx + 0.5, by + 0.5, r, 0, TAU); g.stroke(); g.fillStyle = 'rgba(190,230,255,.35)'; g.fill(); px(g, bx - r + 2, by - r + 2, 1, 1, '#fff'); } }
    else if (t === 'kite' || t === 'balloon') { if (!toy.st) { const w = Math.sin(S.t * 3 + toy.ph) * 0.12 * (1 + wind(h)); put(g, t, x, y + 20, { rot: w }); px(g, x - 9, y + 14, 6, 1, T.K.bark[3]); px(g, x + 3, y + 17, 7, 1, T.K.bark[3]); }
      else { const k = toy.t, yy = y + 20 - k * k * 60 - k * 20, xx = x + Math.sin(k * 3) * 16 + k * 22 * wind(h); if (yy > -60) put(g, t, xx, yy, { rot: Math.sin(k * 5) * 0.3 }); } }
    else if (t === 'woodpecker') { const pk = toy.peck || 0, hp = toy.happy || 0; put(g, 'woodpecker', x + 8 - pk * 3, y + 30 - Math.abs(Math.sin(hp * 14)) * 4, { flip: false, rot: -pk * 0.25 }); }
  }
  function drawTop(g) {
    const T = S.T, n = T.nodes[T.nodes.length - 1], t = T.topT;
    if (T.K.top === 'bell') { const bh = T.tip - 6, sw = t != null ? Math.sin(t * 9) * 0.5 * Math.max(0, 1 - t / 3) : Math.sin(S.t * 1.5) * 0.06 * wind(bh); put(g, 'bell', X(wx(0, bh)) + 1, Y(bh) + 30, { rot: sw, sx: 0.8, sy: 0.8 }); if (t != null && t < 2.5 && Math.sin(t * 9) > 0.9) sparkle(wx(0, bh), bh - 14, 1); }
    else if (t != null) { const k = clamp(t / 0.5, 0, 1), x = X(wx(n.x + 14, T.H)), y = Y(T.H), len = Math.round(34 * back(k)); px(g, x, y - len, 2, len, '#f4ecd8'); px(g, x, y - len - 2, 2, 2, '#ffd76a');
      if (k >= 1) for (let i = 0; i < 16; i++) { const wv = Math.sin(S.t * 8 - i * 0.6) * (1 + i * 0.12) * (0.6 + wind(T.H) * 0.4); px(g, x + 2 + i, y - len + 1 + wv, 1, 11 - (i > 11 ? (i - 11) * 2 : 0), i % 5 === 2 ? '#ffffff' : '#ff5fa8'); } }
  }
  const HAND = ['...ko....', '..kWWk...', '..kWWk...', '..kWWk...', '..kWWkk..', '..kWWWWkk', 'kkkWWWWWk', 'kWWWWWWWk', 'kWWWWWWWk', '.kWWWWWWk', '..kWWWWk.', '..kkkkkk.'];
  function hand(g, x, y) { pat(g, Math.round(x), Math.round(y), HAND, { k: '#2b2340', W: '#ffffff', o: '#2b2340' }); }
  function drawMarina(g) {
    const M = S.M, T = S.T; if (M.hide) return; const hd = hands(M.pose), h = M.h, x = X(wx(M.x, h)), y = Y(h), w = wind(h);
    const lean = (hd || M.busy) ? 0 : Math.sin(S.t * 1.3) * 0.02 * w, bob = (!M.busy && M.pose === 'stand') ? Math.sin(S.t * 2.4) * 0.012 : 0;
    // hair blowing in the wind (more the higher she is)
    const blow = () => { if (w < 0.3 || M.pose === 'sit') return; const hx = x + (M.flip ? 3 : -3), hy = y - (hd ? -22 : 46), n = 2 + (w > 0.7 ? 1 : 0); for (let s = 0; s < n; s++) for (let i = 0; i < 4 + w * 6; i++) { const yy = hy + s * 4 + Math.sin(S.t * 9 + i * 0.7 + s) * (1 + i * 0.22) * Math.min(1.6, w); px(g, hx + 9 + i, yy, 1, 1, i % 3 ? '#ffb479' : '#ad6b3a'); } };
    if (S.leafOn) put(g, 'giantleaf', x, y + 4, { rot: M.rot * 0.6 + Math.sin(S.t * 3) * 0.05, sx: 1.25, sy: 1.25 });
    if (M.pose === 'sit') {                                     // sitting on the limb, legs dangling and kicking
      put(g, 'm_sit', x, y, { flip: M.flip }); for (const [ox, ph] of [[-5, 0], [3, 1.6]]) { const k = Math.sin(S.t * 3.2 + ph) * 2.5; px(g, x + ox, y - 1, 5, 4, '#4b4d5c'); px(g, x + ox + (k > 1 ? 1 : 0), y + 3, 4, 9, '#3e4050'); px(g, x + ox + k * 0.6, y + 11, 6, 3, '#d6336c'); px(g, x + ox + k * 0.6, y + 13, 6, 1, '#ffffff'); }
    } else { blow(); put(g, frameOf(M), x, y, { flip: M.flip, sx: M.sx, sy: M.sy + bob, rot: M.rot + lean }); }
    const hb = M.head; if (hb) put(g, 'robin', X(wx(hb.x, hb.h)), Y(hb.h) + (hb.st === 'on' ? -Math.abs(Math.sin(hb.t * 5)) * 1.5 : Math.sin(hb.t * 20) * 2), { flip: hb.st === 'in' ? false : Math.sin(hb.t * 0.7) > 0, sx: 0.8, sy: 0.8 });
  }
  // the picture meter: a little tree with her face rising up it; and the heap of things she has found
  function hud(g) {
    const VW = S.VW, VH = S.VH, T = S.T, M = S.M, mh = Math.min(104, VH - 56), x = VW - 13, y0 = Math.round((VH - mh) / 2) + 8, y1 = y0 + mh;
    g.fillStyle = 'rgba(30,22,50,.5)'; g.fillRect(x - 10, y0 - 14, 21, mh + 22); g.fillRect(x - 9, y0 - 15, 19, mh + 24); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x - 9, y0 - 16, 19, 1); g.fillRect(x - 9, y0 + mh + 9, 19, 1); g.fillRect(x - 11, y0 - 14, 1, mh + 22); g.fillRect(x + 11, y0 - 14, 1, mh + 22);
    px(g, x - 1, y0, 3, mh, '#7a5a3c'); px(g, x - 1, y0, 1, mh, '#9a7a56');
    if (T.kind === 'pine') for (let i = 0; i < 9; i++) { const w = 2 + i * 0.7, yy = y0 + 3 + i * (mh - 14) / 9; px(g, x - w, yy, w * 2 + 1, 3, i % 2 ? '#3f7444' : '#2f5a36'); px(g, x - w, yy, w, 1, '#5a9a5a'); }
    else for (const [dy, k2, w] of [[2, 'oak_g', 15], [14, 'oak_f', 17], [28, 'oak_h', 17], [42, 'oak_a', 15]]) { const s2 = SP[k2]; g.drawImage(IMG, s2[0], s2[1], s2[2], s2[3], x - (w >> 1), y0 + Math.round(dy * mh / 104), w, Math.round(w * 0.7)); }
    px(g, x - 7, y1, 15, 2, '#6c9c46');
    if (T.K.top === 'bell') px(g, x - 1, y0 - 5, 4, 4, '#ffd76a'); else { px(g, x, y0 - 8, 1, 8, '#fff'); px(g, x + 1, y0 - 8, 5, 4, '#ff5fa8'); }
    const k = clamp((hands(M.pose) ? M.h - HANG : M.h) / T.H, 0, 1), hy = lerp(y1 - 6, y0 + 4, k), s = SP.m_head; g.drawImage(IMG, s[0], s[1], s[2], s[3], x - 8, Math.round(hy) - 8, 17, 17);
    // her finds, bottom left
    const HEAP = [[0, 0], [11, 1], [22, 0], [6, -8], [17, -8], [28, -3], [11, -16], [22, -14], [33, 1], [0, -15], [30, -12], [17, -23]];
    S.got.forEach((k2, i) => { const p = HEAP[i % HEAP.length], s2 = SP[k2]; if (s2) g.drawImage(IMG, s2[0], s2[1], s2[2], s2[3], 4 + p[0], VH - 16 + p[1] - (i >= HEAP.length ? 6 : 0), Math.round(s2[2] * 0.55), Math.round(s2[3] * 0.55)); });
  }

  // ====================================================================== THE VIEW
  // A strip all the way round (x = compass direction * 4, north = 0, east = 360, south = 720, west = 1080), wrapping.
  // Sky and sea are painted here; the land is two strips from the sheet (far: f = 1, near: f = 1.25), tinted for sunset and night.
  const TOD = [
    { sky: ['#3f86d6', '#8cc0ee', '#cfe8f8'], sea: ['#7db6de', '#3f7fba'], mul: null, add: null, cloud: null, star: 0, ico: '☀️' },
    { sky: ['#3a3f8a', '#c9578a', '#ffb347'], sea: ['#f0a868', '#6a5a9a'], mul: '#ffb890', add: ['#5a2a6a', 0.14], cloud: '#ffb0a0', star: 0.15, ico: '🌇' },
    { sky: ['#060a22', '#101c48', '#27407a'], sea: ['#1d3266', '#0e1838'], mul: '#8494dc', add: ['#0c1648', 0.3], cloud: '#5a6898', star: 1, ico: '🌙' }
  ].map(t => ({ ...t, sky: t.sky.map(hex), sea: t.sea.map(hex) }));
  const SPOTS = [
    { id: 'tower', x: 346, y: -30, cu: 'cu_tower' }, { id: 'harbor', x: 452, y: 16, cu: 'cu_harbor' }, { id: 'light', x: 529, y: -3, cu: 'cu_light' }, { id: 'sealight', x: 160, y: -9, cu: 'cu_sealight' },
    { id: 'marsh', x: 700, y: 20, cu: 'cu_marsh' }, { id: 'city', x: 33, y: -7, cu: 'cu_city' }, { id: 'home', near: true, x: 1452, y: 46, cu: 'cu_home' }
  ];
  const FLASH = [0, 2.0, 2.55, 3.1, 3.65, 5.6, 6.15, 6.7], FLASHP = 11;       // one ... four ... three
  function flashAt(t) { t = ((t % FLASHP) + FLASHP) % FLASHP; for (const f of FLASH) if (t >= f && t < f + 0.3) return 1 - (t - f) / 0.3 * 0.4; return 0; }
  function openView(fromClimb) {
    const r = rng(77), V = S.V = { az: 455, vel: 0, tod: 0, prev: 0, mix: 1, t: 0, binoc: null, idle: 0, stars: [], clouds: [], ships: [], gulls: [], smoke: [], motes: [], train: { t: 9, x: 0, on: false }, plane: { t: 16, on: false }, shoot: { t: 4, on: 0 }, tink: -1, lastF: 0, auto: fromClimb ? 3 : 2 };
    for (let i = 0; i < 120; i++) V.stars.push({ x: r() * 1224, y: r(), ph: r() * 9, b: r() });
    for (let i = 0; i < 8; i++) V.clouds.push({ x: r() * 1224, y: 0.12 + r() * 0.7, k: ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_b'][i % 4], v: 1.5 + r() * 2.5 });
    V.ships = [{ k: 'sailboat_s', x: 210, y: 2, v: 2.2 }, { k: 'sailboat_s', x: 80, y: 3, v: -1.6, flip: true }, { k: 'lobsterboat_s', x: 560, y: 7, v: -4.5 }, { k: 'trawler_s', x: 260, y: 5, v: 3.2, flip: true }, { k: 'sailboat_s', x: 580, y: 1, v: 1.4 }];
    for (let i = 0; i < 5; i++) V.gulls.push({ x: 380 + r() * 220, y: -26 + r() * 30, ph: r() * 9, v: (r() < 0.5 ? -1 : 1) * (7 + r() * 8) });
    V.boats = [[408, 13, 0], [418, 17, 1], [427, 12, 2], [436, 19, 0], [446, 14, 1], [455, 18, 2], [465, 12, 0], [474, 16, 1], [486, 19, 2], [497, 14, 0], [432, 23, 1], [470, 22, 0]];
    S.phase = 'view'; S.ptr = null; viewLayout();
    V.todB = btn('pbtn', TOD[0].ico, 'time of day', nextTod); S.top.append(V.todB);
    if (fromClimb) { V.downB = btn('pbtn tc-go', '⬇️', 'down', choose); S.top.append(V.downB); S.iris = { x: S.VW / 2, y: S.VH * 0.4, k: 0 }; whoosh(true); }
    jingle([0, 7, 12, 16], 0.09, 'triangle'); after(0.9, () => S && line('m_tree_sea', 'm_look', 0)); after(1.5, () => S && S.V && SND.gull());
  }
  function closeView() { const V = S.V; if (!V) return; if (V.todB) V.todB.remove(); if (V.downB) V.downB.remove(); S.V = null; S.iris = null; loopSet('sea', 0, 400); }
  function viewLayout() { const V = S.V, VH = S.VH; V.hy = Math.round(VH * (VH > 240 ? 0.42 : 0.36)); V.ny = VH - (VH > 240 ? PANO.NH : 80); }
  function nextTod() { const V = S.V; if (!V || V.mix < 1) return; V.prev = V.tod; V.tod = (V.tod + 1) % 3; V.mix = 0; V.todB.textContent = TOD[V.tod].ico; jingle([[12, 7, 4, 0], [0, 3, 7, 10], [0, 7, 12, 19]][V.prev], 0.12, V.tod === 2 ? 'sine' : 'triangle'); if (V.tod === 2) after(1.2, () => S && SND.cricket()); if (V.tod === 0) after(0.5, () => S && SND.chirp()); }
  // screen x of a place on a strip (f = how fast that strip slides, per = its length)
  const vx = (x, f, per) => { const V = S.V, d = (((x - V.az * f) % per) + per * 1.5) % per - per / 2; return S.VW / 2 + d; };
  const mx = x => vx(x, 1, PANO.PW), nx = x => vx(x, 1.25, PANO.NW), kx = x => vx(x, 0.85, 1224);
  function strip(g, key, f, y, tod, alpha) {
    const s = SP[key], img = tod ? cut(key, TOD[tod].mul, TOD[tod].add) : null, per = s[2]; let sx = Math.floor((((S.V.az * f - S.VW / 2) % per) + per) % per); if (alpha != null) g.globalAlpha = alpha;
    for (let x = 0; x < S.VW;) { const w = Math.min(S.VW - x, per - sx); if (img) g.drawImage(img, sx, 0, w, s[3], x, y, w, s[3]); else g.drawImage(IMG, s[0] + sx, s[1], w, s[3], x, y, w, s[3]); x += w; sx = 0; } g.globalAlpha = 1;
  }
  function spotPos(sp) { const V = S.V; return sp.near ? { x: nx(sp.x), y: V.ny + sp.y } : { x: mx(sp.x), y: V.hy + sp.y }; }
  function tapView(p) {
    const V = S.V; if (!V) return; V.idle = 0;
    if (V.binoc) { V.binoc.out = V.binoc.t; blip(0, 'triangle', 0.08, 0.1); return; }
    let best = null, bd = 30; for (const sp of SPOTS) { const q = spotPos(sp), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = sp; } }
    if (!best) return; V.binoc = { sp: best, t: 0, out: null }; V.vel = 0; V.seen = (V.seen || 0) + 1; whoosh(true); blip(12, 'sine', 0.2, 0.1);
    const id = best.id; after(0.4, () => { if (!S || !S.V || !S.V.binoc) return; if (id === 'light' || id === 'harbor') SND.gull(); if (id === 'tower') { SND.chirp(); SND.bell(0.3, 660); } if (id === 'marsh') SND.chirp(0, 1900); if (id === 'home') { line('d_tree_wave', null, 0); SND.splash(); } if (id === 'sealight') line('m_tree_iloveyou', null, 0); if (id === 'city') tone(220, 220, 1.2, 'sine', 0.03); });
  }
  function updateView(dt) {
    const V = S.V; V.t += dt; V.idle += dt; if (V.mix < 1) V.mix = Math.min(1, V.mix + dt / 1.6);
    if (!S.ptr && !V.binoc) { if (V.auto > 0) { V.auto -= dt; V.az += Math.sin(Math.min(1, V.auto / 2) * Math.PI) * 26 * dt * -1; } V.az += V.vel * dt; V.vel *= Math.pow(0.03, dt); if (Math.abs(V.vel) < 1) V.vel = 0; }
    V.az = ((V.az % PANO.PW) + PANO.PW) % PANO.PW;
    if (V.binoc) { V.binoc.t += dt; if (V.binoc.out != null && V.binoc.t - V.binoc.out > 0.22) V.binoc = null; }
    for (const c of V.clouds) c.x = (c.x + c.v * dt) % 1224;
    for (const s of V.ships) { s.x += s.v * dt; if (s.x > 640) { s.x = -30; } if (s.x < -40) s.x = 630; }
    for (const q of V.gulls) { q.x += q.v * dt; if (q.x > 640 || q.x < 330) q.v = -q.v; }
    const tr = V.train; tr.t -= dt; if (!tr.on && tr.t <= 0) { tr.on = true; tr.x = PANO.rail[0] - 40; if (Math.abs(mx(1230) - S.VW / 2) < S.VW) SND.train(); } if (tr.on) { tr.x += 26 * dt; if (tr.x > PANO.rail[1] + 10) { tr.on = false; tr.t = 16 + Math.random() * 12; } }
    const pl = V.plane; pl.t -= dt; if (!pl.on && pl.t <= 0) { pl.on = true; pl.x = V.az * 0.85 - S.VW * 0.7; pl.y = 0.2 + Math.random() * 0.3; } if (pl.on) { pl.x += 34 * dt; if (kx(pl.x) > S.VW + 80) { pl.on = false; pl.t = 14 + Math.random() * 14; } }
    const sh = V.shoot; sh.t -= dt; if (sh.t <= 0) { sh.t = 5 + Math.random() * 6; sh.on = 0.7; sh.x = rnd(0.15, 0.85); sh.y = rnd(0.05, 0.5); if (V.tod === 2 && V.mix >= 1) tone(2400, 1200, 0.5, 'sine', 0.025); } if (sh.on > 0) sh.on -= dt;
    if (Math.random() < dt * 1.5) V.smoke.push({ i: (Math.random() * 6) | 0, t: 0 }); for (let i = V.smoke.length - 1; i >= 0; i--) { V.smoke[i].t += dt; if (V.smoke[i].t > 3) V.smoke.splice(i, 1); }
    if (Math.random() < dt * 1.2) V.motes.push({ x: -6, y: rnd(0, S.VH * 0.9), vx: rnd(40, 90), vy: rnd(6, 22), ph: rnd(0, 9), c: pick(LEAFC[S.from === 'pine' ? 'pine' : 'oak']), big: Math.random() < 0.12 });
    for (let i = V.motes.length - 1; i >= 0; i--) { const m = V.motes[i]; m.x += m.vx * dt; m.y += m.vy * dt + Math.sin(V.t * 4 + m.ph) * 10 * dt; if (m.x > S.VW + 10) V.motes.splice(i, 1); }
    // sounds: the sea when she looks that way, a little wind, gulls, crickets at night, the far light's one - four - three
    const seaK = (V.az < 640 || V.az > 1380) ? 1 : 0.25; loopSet('sea', (0.035 + 0.03 * Math.sin(V.t * 0.9)) * seaK, 420 + 160 * Math.sin(V.t * 0.9)); loopSet('wind', 0.03, 520 + Math.sin(V.t * 0.5) * 120);
    if (Math.random() < dt * 0.09 * seaK) SND.gull(); if (V.tod === 2 && Math.random() < dt * 0.5) SND.cricket(); if (V.tod === 0 && Math.random() < dt * 0.12) SND.chirp(0, pick([2500, 3000]));
    const dark = V.tod > 0 || (V.binoc && V.binoc.sp.id === 'sealight'), fl = flashAt(V.t); if (fl > 0.95 && V.lastF < 0.5 && dark && (Math.abs(mx(160) - S.VW / 2) < S.VW * 0.6 || (V.binoc && V.binoc.sp.id === 'sealight'))) tone(1760, 1760, 0.18, 'sine', 0.03); V.lastF = fl;
  }
  function drawView(g) {
    const V = S.V, VW = S.VW, VH = S.VH, HY = V.hy, A = TOD[V.prev], B = TOD[V.tod], k = V.mix, t = V.t, night = lerp(V.prev === 2 ? 1 : 0, V.tod === 2 ? 1 : 0, k), dusk = lerp(V.prev === 1 ? 1 : 0, V.tod === 1 ? 1 : 0, k), lit = Math.max(night, dusk * 0.8);
    // sky
    const c0 = mixc(A.sky[0], B.sky[0], k), c1 = mixc(A.sky[1], B.sky[1], k), c2 = mixc(A.sky[2], B.sky[2], k);
    for (let y = 0; y < HY + 2; y += 3) { const u = y / HY, c = u < 0.55 ? mixc(c0, c1, u / 0.55) : mixc(c1, c2, (u - 0.55) / 0.45); g.fillStyle = css(c); g.fillRect(0, y, VW, 3); }
    const starA = lerp(A.star, B.star, k);
    if (starA > 0.02) { for (const s of V.stars) { const x = kx(s.x), y = s.y * (HY - 4); if (x < 0 || x >= VW) continue; const tw = 0.5 + 0.5 * Math.sin(t * (1 + s.b * 3) + s.ph); g.fillStyle = `rgba(255,255,${s.b > 0.7 ? 200 : 255},${(0.35 + 0.65 * tw) * starA * (0.4 + 0.6 * (1 - s.y))})`; g.fillRect(Math.round(x), Math.round(y), 1, 1); if (s.b > 0.9 && tw > 0.8 && starA > 0.6) { g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); } }
      const sh = V.shoot; if (sh.on > 0 && night > 0.6) { const kk = 1 - sh.on / 0.7, x = VW * sh.x + kk * 50, y = HY * sh.y + kk * 22; for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,255,${(1 - i / 12) * (1 - kk)})`; g.fillRect(Math.round(x - i * 2.2), Math.round(y - i), 2, 1); } } }
    // sun by day (high in the south-east), sinking red in the west at sunset; the moon over the sea at night
    const disc = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(Math.round(x), Math.round(y), r, 0, TAU); g.fill(); };
    const day = 1 - Math.max(night, dusk); if (day > 0.05) { const x = kx(560 * 0.85), y = Math.max(14, HY * 0.3); g.globalAlpha = day; disc(x, y, 16, 'rgba(255,250,210,.25)'); disc(x, y, 11, 'rgba(255,250,210,.4)'); disc(x, y, 7, '#fffbe0'); g.globalAlpha = 1; }
    if (dusk > 0.05) { const x = kx(1080 * 0.85), y = HY - 13 + (1 - dusk) * 30; g.globalAlpha = dusk; const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(255,210,120,.75)'); gr.addColorStop(0.35, 'rgba(255,150,90,.3)'); gr.addColorStop(1, 'rgba(255,120,90,0)'); g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 180); disc(x, y, 15, '#ffd070'); disc(x, y, 12, '#ffb04a'); px(g, x - 18, y + 3, 36, 1, 'rgba(200,90,110,.6)'); px(g, x - 14, y + 7, 28, 1, 'rgba(200,90,110,.5)'); g.globalAlpha = 1; }
    if (night > 0.05) { const x = kx(470 * 0.85), y = Math.max(16, HY * 0.38); g.globalAlpha = night; disc(x, y, 17, 'rgba(200,220,255,.12)'); disc(x, y, 10, '#f4f1dc'); disc(x - 3, y - 2, 2, '#d9d6c0'); disc(x + 3, y + 3, 1.6, '#d9d6c0'); disc(x + 2, y - 4, 1.2, '#d9d6c0'); g.globalAlpha = 1; }
    // clouds, tinted by the hour
    for (const c of V.clouds) { const x = kx(c.x), y = 8 + c.y * (HY - 26); if (x < -60 || x > VW + 60) continue; put(g, c.k, x, y); if (B.cloud || A.cloud) { if (A.cloud && k < 1) put(g, c.k, x, y, { img: cut(c.k, A.cloud), a: 1 - k }); if (B.cloud) put(g, c.k, x, y, { img: cut(c.k, B.cloud), a: k }); } }
    const pl = V.plane; if (pl.on) { const x = kx(pl.x), y = 8 + pl.y * HY; if (night > 0.5) { px(g, x, y, 2, 1, '#cfd8ff'); if (Math.sin(t * 9) > 0) px(g, x + 2, y, 1, 1, '#ff5050'); } else { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(Math.round(x - 40), Math.round(y), 40, 1); px(g, x, y - 1, 4, 2, '#f4f6ff'); px(g, x + 1, y - 2, 1, 4, '#dfe6f4'); } }
    // the sea, with sparkles; boats that really cross it; the lonely lighthouse far out
    const s0 = mixc(A.sea[0], B.sea[0], k), s1 = mixc(A.sea[1], B.sea[1], k); for (let y = 0; y < 44; y += 2) { g.fillStyle = css(mixc(s0, s1, Math.pow(y / 44, 0.6))); g.fillRect(0, HY + y, VW, 2); }
    px(g, 0, HY, VW, 1, css(mixc(s0, c2, 0.5)));
    const glx = night > 0.3 ? kx(470 * 0.85) : dusk > 0.3 ? -999 : kx(560 * 0.85);
    for (let i = 0; i < 70; i++) { const ph = i * 12.9898, xx = ((Math.sin(ph) * 43758.5453) % 1 + 1) % 1, yy = ((Math.sin(ph * 1.7) * 24634.6345) % 1 + 1) % 1, on = Math.sin(t * (2 + (i % 5)) + i) > 0.55; if (!on) continue; let x = xx * VW, y = HY + 1 + yy * yy * 40; if (i % 3 === 0 && glx > -100) x = glx + (xx - 0.5) * (10 + yy * 60);
      g.fillStyle = night > 0.5 ? 'rgba(220,230,255,.75)' : dusk > 0.5 ? 'rgba(255,225,160,.85)' : 'rgba(255,255,255,.85)'; g.fillRect(Math.round(x), Math.round(y), yy > 0.5 ? 2 : 1, 1); }
    const tk = k >= 1 ? V.tod : null, tint = key => tk ? { img: cut(key, TOD[tk].mul, TOD[tk].add) } : null;
    { const x = mx(160), y = HY + 5; if (x > -20 && x < VW + 20) { put(g, 'sealight', x, y, tint('sealight')); px(g, x - 8, y - 1, 17, 1, 'rgba(255,255,255,.7)'); px(g, x - 5 + Math.sin(t * 3) * 2, y, 9, 1, 'rgba(255,255,255,.5)');
      const fl = flashAt(t) * lit; if (fl > 0) flare(g, x - 7 + PANO.seaLamp[0], y - 28 + PANO.seaLamp[1], 5 + fl * 9, fl, '255,244,190'); } }
    for (const s of V.ships) { const x = mx(s.x), y = HY + s.y + 6 + Math.sin(t * 1.5 + s.x) * 0.6; if (x < -20 || x > VW + 20) continue; put(g, s.k, x, y, { flip: s.v < 0 ? !s.flip : !!s.flip, ...(tint(s.k) || {}) }); px(g, x - (s.v > 0 ? 12 : -4), y, 8, 1, 'rgba(255,255,255,.5)'); if (night > 0.5) px(g, x, y - 8, 1, 1, '#ffe08a'); }
    // the land: tower on its hill, harbour, lighthouse, marsh, roofs, the far city, hills
    const my = HY - PANO.HZ; if (k < 1) { strip(g, 'pano_mid', 1, my, V.prev); strip(g, 'pano_mid', 1, my, V.tod, k); } else strip(g, 'pano_mid', 1, my, V.tod);
    // live bits on the land
    V.boats.forEach((b, i) => { const x = mx(b[0]) + Math.sin(t * 0.7 + i) * 0.6, y = HY + b[1] + Math.sin(t * 1.6 + i * 2) * 0.7; if (x < -6 || x > VW + 6) return; const hull = night > 0.5 ? ['#8a94b8', '#7a6a8a', '#6a7aa0'][b[2]] : ['#ffffff', '#e2574c', '#3d7bd9'][b[2]]; px(g, x - 2, y, 5, 2, hull); px(g, x - 1, y + 2, 3, 1, 'rgba(20,40,80,.35)'); px(g, x, y - 4, 1, 4, night > 0.5 ? '#aab' : '#f4f4f4'); if (b[2] === 0) px(g, x + 1, y - 3, 2, 2, night > 0.5 ? '#99a' : '#fff'); if (night > 0.5 && i % 3 === 0) px(g, x, y - 5, 1, 1, '#ffe08a'); });
    { const kk = (t * 0.045) % 1, bx = lerp(430, 486, kk < 0.5 ? kk * 2 : 2 - kk * 2), by = lerp(22, 9, kk < 0.5 ? kk * 2 : 2 - kk * 2), x = mx(bx), y = HY + by; if (x > -10 && x < VW + 10) { px(g, x - 3, y, 6, 2, night > 0.5 ? '#9aa4c8' : '#fff'); px(g, x - 1, y - 2, 3, 2, night > 0.5 ? '#7a84a8' : '#e2574c'); px(g, x + (kk < 0.5 ? -8 : 4), y + 1, 5, 1, 'rgba(255,255,255,.6)'); } }
    for (const q of V.gulls) { const x = mx(q.x), y = HY + q.y + Math.sin(t * 0.8 + q.ph) * 6; if (x < -6 || x > VW + 6) continue; const f = Math.sin(t * 7 + q.ph) > 0, c = night > 0.5 ? '#9aa4c8' : '#ffffff'; px(g, x - 2, y + (f ? 0 : 1), 2, 1, c); px(g, x + 1, y + (f ? 0 : 1), 2, 1, c); px(g, x, y + (f ? 1 : 0), 1, 1, c); }
    { const x = mx(346), y = HY - 50; if (x > -30 && x < VW + 30 && night < 0.5) for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.1, bx = x + Math.cos(a) * 15, by = y + Math.sin(a) * 4 - i * 2, f = Math.sin(t * 8 + i) > 0; px(g, bx - 1, by + (f ? 0 : 1), 1, 1, '#2b2340'); px(g, bx + 1, by + (f ? 0 : 1), 1, 1, '#2b2340'); px(g, bx, by + (f ? 1 : 0), 1, 1, '#2b2340'); } if (lit > 0.3) { px(g, x - 2, HY - 36, 2, 2, `rgba(255,214,110,${lit})`); px(g, x + 2, HY - 36, 1, 2, `rgba(255,214,110,${lit})`); } }
    // herons in the marsh, the osprey over its pole
    for (const [hx, hyy, ph] of [[676, 20, 0], [724, 27, 2], [640, 13, 4]]) { const x = mx(hx), y = HY + hyy; if (x < -6 || x > VW + 6) continue; const dip = Math.sin(t * 0.6 + ph) > 0.92, c = night > 0.5 ? '#8a94b8' : '#f4f6fa'; px(g, x, y - 3, 2, 3, c); px(g, x + (dip ? 2 : 1), y - (dip ? 2 : 5), 1, dip ? 1 : 3, c); px(g, x + (dip ? 3 : 2), y - (dip ? 1 : 5), 2, 1, '#e8b84a'); px(g, x, y, 1, 2, '#555'); }
    { const a = t * 0.5, x = mx(782 + Math.cos(a) * 26), y = HY + 6 + Math.sin(a) * 6; if (x > -6 && x < VW + 6 && night < 0.5) { const f = Math.sin(t * 5) > 0; px(g, x - 3, y + (f ? 0 : 1), 3, 1, '#3a2c22'); px(g, x + 1, y + (f ? 0 : 1), 3, 1, '#3a2c22'); px(g, x, y, 1, 2, '#f4f4f4'); } }
    // chimney smoke, lit windows, the little train
    const hs = PANO.houses; for (const sm of V.smoke) { const h = hs[sm.i * 4 % hs.length], x = mx(h[0] + 2) + sm.t * 3 + Math.sin(sm.t * 2 + sm.i) * 1.5, y = HY + h[1] - 8 - sm.t * 4; if (x < 0 || x > VW) continue; g.fillStyle = `rgba(${night > 0.5 ? '150,160,200' : '240,240,240'},${0.5 * (1 - sm.t / 3)})`; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
    if (lit > 0.2) { hs.forEach((h, i) => { const x = mx(h[0]), y = HY + h[1]; if (x < 0 || x > VW) return; g.fillStyle = `rgba(255,214,110,${lit * (0.7 + 0.3 * Math.sin(t * 2 + i))})`; g.fillRect(Math.round(x) - 1, Math.round(y) - 2 - (h[1] > 50 ? 2 : 0), 1, 1); g.fillRect(Math.round(x) + 2, Math.round(y) - 3 - (h[1] > 50 ? 2 : 0), 1, 1); });
      for (let i = 0; i < 12; i++) { const x = mx(404 + i * 8.6); if (x > 0 && x < VW && i % 4 !== 3) px(g, x, HY + 24, 1, 1, `rgba(255,214,110,${lit})`); }
      for (let i = 0; i < 22; i++) { const x = mx(14 + ((i * 7) % 40)); if (x > 0 && x < VW && Math.sin(t * 1.5 + i * 3) > -0.4) px(g, x, HY - 2 - ((i * 5) % 9), 1, 1, `rgba(255,224,150,${lit * 0.8})`); } }
    const tr = V.train; if (tr.on) for (let i = 0; i < 6; i++) { const cx = tr.x - i * 7; if (cx < PANO.rail[0] + 4 || cx > PANO.rail[1] - 8) continue; const x = mx(cx), y = HY + PANO.rail[2] - 3; if (x < -8 || x > VW + 8) continue; px(g, x, y, 6, 3, i === 0 ? '#3a3f52' : ['#b0483c', '#3f6a8a', '#8a7a3c'][i % 3]); px(g, x + 1, y + 1, 1, 1, lit > 0.3 ? '#ffe08a' : '#dfe8f0'); px(g, x + 3, y + 1, 1, 1, lit > 0.3 ? '#ffe08a' : '#dfe8f0'); if (i === 0) { const kk = (t * 2) % 1; g.fillStyle = `rgba(240,240,240,${0.6 * (1 - kk)})`; g.fillRect(Math.round(x + 4 - kk * 6), Math.round(y - 2 - kk * 5), 2, 2); } }
    // the white lighthouse's turning light
    if (lit > 0.2) { const x = mx(PANO.lightLamp[0]), y = HY + PANO.lightLamp[1]; if (x > -40 && x < VW + 40) { const a = t * 1.6, c = Math.cos(a), pw = Math.pow(Math.abs(c), 6); flare(g, x, y, 4 + pw * 8, lit * (0.5 + 0.5 * pw), '255,250,210'); const bl = 26 * Math.abs(Math.sin(a)) + 4; g.fillStyle = `rgba(255,250,210,${0.22 * lit})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sign(Math.sin(a)) * bl, y - 3); g.lineTo(x + Math.sign(Math.sin(a)) * bl, y + 3); g.fill(); } }
    // right below: the big trees, her house, the lawn, the pool
    if (k < 1) { strip(g, 'pano_near', 1.25, V.ny, V.prev); strip(g, 'pano_near', 1.25, V.ny, V.tod, k); } else strip(g, 'pano_near', 1.25, V.ny, V.tod);
    { const H = PANO.house, x0 = nx(H.x + H.w / 2) - H.w / 2, y0 = V.ny + H.y; if (x0 > -H.w && x0 < VW) { if (lit > 0.15) { g.fillStyle = `rgba(255,220,120,${Math.min(1, lit * 1.1)})`; for (const w of H.wins) g.fillRect(Math.round(x0 + w[0] - H.x), y0 + w[1] - H.y, 1, 1); }
        for (let i = 0; i < 4; i++) { const kk = ((t * 0.35 + i * 0.25) % 1); g.fillStyle = `rgba(${night > 0.5 ? '150,160,200' : '245,245,245'},${0.55 * (1 - kk)})`; g.fillRect(Math.round(x0 + H.w * 0.66 + kk * 8 + Math.sin(kk * 6 + i) * 2), Math.round(y0 + 2 - kk * 16), 2 + (kk > 0.5 ? 1 : 0), 2); } }
      const px0 = nx(PANO.pool.x), py0 = V.ny + PANO.pool.y; if (px0 > -40 && px0 < VW + 40) { for (let i = 0; i < 4; i++) if (Math.sin(t * 3 + i * 1.7) > 0.3) px(g, px0 - 12 + i * 7 + Math.sin(t + i) * 2, py0 - 4 + (i % 2) * 5, 2, 1, 'rgba(255,255,255,.8)'); const wv = Math.sin(t * 6) > 0; px(g, px0 + 2, py0 - 1, 3, 3, night > 0.5 ? '#8a7a70' : '#f0c49a'); px(g, px0 + 2, py0 - 2, 3, 1, '#4a3628'); px(g, px0 + (wv ? 5 : 6), py0 - (wv ? 4 : 3), 1, 3, night > 0.5 ? '#8a7a70' : '#f0c49a'); px(g, px0 - 1, py0 + 2, 9, 1, 'rgba(255,255,255,.6)'); } }
    // her own tree at the edges of the picture, and leaves blowing past
    drawFrameLeaves(g);
    for (const m of V.motes) { if (m.big) put(g, 'goldleaf', m.x, m.y, { rot: V.t * 4 + m.ph, sx: 0.6, sy: 0.6 }); else { const w = Math.sin(V.t * 9 + m.ph); px(g, m.x, m.y, w > 0 ? 3 : 2, w > 0 ? 2 : 3, m.c); } }
    // soft twinkles on the things worth a closer look
    if (!V.binoc) for (const sp of SPOTS) { const q = spotPos(sp); if (q.x < -8 || q.x > VW + 8) continue; const p = 0.5 + 0.5 * Math.sin(t * 3.2 + sp.x), r = 2 + Math.round(p * 3); g.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * p})`; g.fillRect(Math.round(q.x) - r, Math.round(q.y), r * 2 + 1, 1); g.fillRect(Math.round(q.x), Math.round(q.y) - r, 1, r * 2 + 1); g.fillStyle = `rgba(255,236,150,${0.5 * p})`; g.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3);
      const gr = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, 11); gr.addColorStop(0, `rgba(255,255,220,${0.3 * p})`); gr.addColorStop(1, 'rgba(255,255,220,0)'); g.fillStyle = gr; g.fillRect(q.x - 11, q.y - 11, 22, 22); }
    // nothing touched yet: a hand shows that the picture slides, then points at a twinkle
    if (!V.binoc && V.idle > 5) { if (!V.dragged) { const xx = VW / 2 + Math.sin(t * 2) * 24; hand(g, xx, VH * 0.62); px(g, xx - 14, VH * 0.62 + 5, 4, 1, '#fff'); px(g, xx + 18, VH * 0.62 + 5, 4, 1, '#fff'); }
      else if (!V.seen) { let b = null; for (const sp of SPOTS) { const q = spotPos(sp); if (q.x > 14 && q.x < VW - 14 && (!b || Math.abs(q.x - VW / 2) < Math.abs(b.x - VW / 2))) b = q; } if (b) hand(g, b.x - 2, b.y + 6 + Math.abs(Math.sin(t * 4)) * 5); } }
    if (V.binoc) drawBinoc(g);
  }
  function flare(g, x, y, r, a, rgb) { const gr = g.createRadialGradient(x, y, 0.5, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.4, `rgba(${rgb},${a * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(Math.round(x - r * 0.7), Math.round(y), Math.round(r * 1.4), 1); g.fillRect(Math.round(x), Math.round(y - r * 0.5), 1, Math.round(r)); }
  function drawFrameLeaves(g) {
    const V = S.V, VW = S.VW, VH = S.VH, t = V.t, off = -(V.az * 1.7) % 1; if (S.from === 'house') return;
    const tk = V.mix >= 1 ? V.tod : 0, im = k => tk ? { img: cut(k, TOD[tk].mul, TOD[tk].add) } : {};
    if (S.from === 'pine') { for (const [fx, fy, fl, ph] of [[0.02, 1.0, false, 0], [0.98, 1.02, true, 2], [0.0, 0.12, false, 4], [1.0, 0.08, true, 5]]) put(g, ph % 4 ? 'pine_b' : 'pine_a', VW * fx + (fl ? -18 : 18) + Math.sin(t * 1.4 + ph) * 2, VH * fy + 6 + Math.sin(t * 1.1 + ph) * 1.5, { flip: !fl, ...im(ph % 4 ? 'pine_b' : 'pine_a') }); }
    else for (const [fx, fy, k, ph] of [[0.04, 1.0, 'oak_f', 0], [0.97, 1.0, 'oak_h', 2], [0.5, 1.07, 'oak_g', 3], [0.0, 0.1, 'oak_a', 4], [1.0, 0.12, 'oak_d', 5]]) put(g, k, VW * fx + Math.sin(t * 1.4 + ph) * 2.5, VH * fy + 8 + Math.sin(t * 1.1 + ph) * 1.5, im(k));
  }
  // through the binoculars: a round close-up with a little life in it
  const MASK = {};
  function waterPts(key) {                                     // where the blue water is in a close-up (for sparkles and foam)
    if (MASK[key]) return MASK[key]; const s = SP[key], c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const g = c.getContext('2d'); g.drawImage(IMG, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); const out = [];
    try { const d = g.getImageData(0, 0, s[2], s[3]).data; for (let y = 34; y < s[3]; y += 2) for (let x = (y % 4) / 2; x < s[2]; x += 3) { const p = (y * s[2] + (x | 0)) * 4, r = d[p], gg = d[p + 1], b = d[p + 2]; if (b > r + 34 && b > 110 && gg > r) out.push([x | 0, y]); } } catch (e) { }
    return (MASK[key] = out);
  }
  function drawBinoc(g) {
    const V = S.V, B = V.binoc, VW = S.VW, VH = S.VH, t = V.t, sp = B.sp, R = Math.min(62, Math.floor(Math.min(VW, VH) / 2) - 8), cx = Math.round(VW / 2), cy = Math.round(VH / 2);
    const k = B.out != null ? Math.max(0, 1 - (B.t - B.out) / 0.2) : Math.min(1, B.t / 0.3), sc = B.out != null ? k : back(k), night = V.tod === 2, dusk = V.tod === 1;
    g.fillStyle = `rgba(12,10,30,${0.72 * k})`; g.fillRect(0, 0, VW, VH);
    g.save(); g.translate(cx, cy); g.scale(sc, sc); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip(); g.translate(-64, -64 + (sp.id === 'harbor' ? Math.sin(t * 1.2) * 1 : 0));
    const s = SP[sp.cu]; g.drawImage(V.tod ? cut(sp.cu, TOD[V.tod].mul, TOD[V.tod].add) : IMG, V.tod ? 0 : s[0], V.tod ? 0 : s[1], 128, 128, 0, 0, 128, 128);
    const wp = waterPts(sp.cu), spark = n => { for (let i = 0; i < n && wp.length; i++) { const q = wp[(Math.floor(t * 6) * 7 + i * 13) % wp.length]; g.fillStyle = night ? 'rgba(200,215,255,.7)' : 'rgba(255,255,255,.9)'; g.fillRect(q[0], q[1], 2, 1); } };
    const birdAt = (x, y, c, f) => { px(g, x - 2, y + (f ? 0 : 1), 2, 1, c); px(g, x + 1, y + (f ? 0 : 1), 2, 1, c); px(g, x, y + (f ? 1 : 0), 1, 1, c); };
    if (sp.id === 'tower') { for (let i = 0; i < 5; i++) { const a = t * 1.1 + i * 1.3, f = Math.sin(t * 9 + i) > 0; birdAt(64 + Math.cos(a) * (40 + i * 3), 24 + Math.sin(a) * 9 + i * 3, night ? '#1a1830' : '#2b2340', f); } if (V.tod) { px(g, 60, 62, 5, 9, 'rgba(255,214,110,.9)'); flare(g, 62, 66, 12, 0.5, '255,214,110'); } }
    else if (sp.id === 'harbor') { spark(14); const bx = 20 + ((t * 9) % 100), by = 100 + Math.sin(t * 2) * 1.5; put(g, 'lobsterboat', bx, by, { rot: Math.sin(t * 2) * 0.05 }); px(g, bx - 22, by - 1, 10, 1, 'rgba(255,255,255,.7)'); birdAt(40 + (t * 14) % 90, 22 + Math.sin(t * 2) * 5, '#fff', Math.sin(t * 8) > 0); }
    else if (sp.id === 'light') { spark(12); for (let i = 0; i < 9; i++) { const a = (t * 0.9 + i * 0.37) % 1, x = 18 + i * 10 + Math.sin(i * 5) * 4, y = 100 + (i % 3) * 5 - a * 5; g.fillStyle = `rgba(255,255,255,${0.9 * (1 - a)})`; g.fillRect(x - a * 5, y, 5 + a * 10, 1); if (a < 0.3) g.fillRect(x + 2, y - 2, 2, 2); }
      birdAt(30 + (t * 11) % 90, 30 + Math.sin(t * 1.7) * 6, '#fff', Math.sin(t * 8) > 0); if (V.tod) { const a = t * 1.6, pw = Math.pow(Math.abs(Math.cos(a)), 4); flare(g, 78, 23, 8 + pw * 22, 0.5 + 0.5 * pw, '255,250,210'); const dir = Math.sign(Math.sin(a)); g.fillStyle = 'rgba(255,250,210,.2)'; g.beginPath(); g.moveTo(78, 23); g.lineTo(78 + dir * 70 * Math.abs(Math.sin(a)), 12); g.lineTo(78 + dir * 70 * Math.abs(Math.sin(a)), 34); g.fill(); } }
    else if (sp.id === 'sealight') { spark(10); for (let i = 0; i < 8; i++) { const a = (t * 1.1 + i * 0.41) % 1, x = 40 + i * 7, y = 106 - Math.sin(a * Math.PI) * (6 + (i % 3) * 5); g.fillStyle = `rgba(255,255,255,${1 - a})`; g.fillRect(x, y, 3, 2); g.fillRect(x - 8 + i * 2, 108 + (i % 2) * 3, 7, 1); }
      const fl = flashAt(t); if (fl > 0) { flare(g, 65, 23, 14 + fl * 26, V.tod ? 1 : 0.8, '255,244,190'); px(g, 62, 21, 6, 5, '#fffbe0'); } }
    else if (sp.id === 'marsh') { spark(8); const c = (t % 3.4), strike = c > 2.2 && c < 3.0; if (strike) { put(g, 'heron_fish', 52, 112); if (c < 2.35) { for (let i = 0; i < 5; i++) px(g, 34 + i * 3, 104 - Math.sin((c - 2.2) * 20 + i) * 5, 1, 2, '#fff'); } } else put(g, 'heron', 50, 112, { sy: 1 + 0.02 * Math.sin(t * 2) }); if (strike && !B.spl) { B.spl = 1; SND.splash(); } if (!strike) B.spl = 0;
      for (let i = 0; i < 3; i++) birdAt(80 + i * 12 + Math.sin(t + i) * 4, 14 + i * 4 + Math.sin(t * 1.3 + i) * 3, night ? '#1a1830' : '#4a4a5a', Math.sin(t * 7 + i) > 0); }
    else if (sp.id === 'city') { spark(10); if (V.tod) for (let i = 0; i < 46; i++) { const x = 24 + ((i * 37) % 82), y = 30 + ((i * 53) % 42); if (Math.sin(t * 1.3 + i * 2.1) > -0.5) px(g, x, y, 1, 1, 'rgba(255,224,150,.95)'); } const pxp = (t * 12) % 150 - 10; px(g, pxp, 20 - pxp * 0.06, 4, 1, V.tod === 2 ? '#cfd8ff' : '#fff'); if (V.tod === 2 && Math.sin(t * 9) > 0) px(g, pxp + 4, 20 - pxp * 0.06, 1, 1, '#ff5050'); const fx = 30 + (t * 5) % 80; px(g, fx, 96, 8, 3, '#f4f4f4'); px(g, fx + 2, 93, 4, 3, '#e2574c'); px(g, fx - 10, 98, 9, 1, 'rgba(255,255,255,.7)'); }
    else if (sp.id === 'home') { spark(6); const wv = Math.sin(t * 7) > 0, sx0 = 66, sy0 = 88; px(g, sx0 - 6, sy0 + 5, 16, 1, 'rgba(255,255,255,.8)'); px(g, sx0 - 3, sy0 + 2, 9, 4, '#f0c49a'); px(g, sx0 - 1, sy0 - 5, 6, 7, '#f0c49a'); px(g, sx0 - 1, sy0 - 6, 6, 3, '#4a3628'); px(g, sx0, sy0 - 2, 1, 1, '#2b2340'); px(g, sx0 + 3, sy0 - 2, 1, 1, '#2b2340'); px(g, sx0 + 1, sy0, 2, 1, '#c0503c');
      px(g, sx0 + (wv ? 6 : 7), sy0 - (wv ? 9 : 7), 2, 8, '#f0c49a'); px(g, sx0 + (wv ? 5 : 8), sy0 - (wv ? 12 : 10), 3, 3, '#f0c49a'); px(g, sx0 - 5, sy0 + 1, 3, 2, '#f0c49a');
      for (let i = 0; i < 4; i++) { const kk = ((t * 0.4 + i * 0.25) % 1); g.fillStyle = `rgba(245,245,245,${0.6 * (1 - kk)})`; g.fillRect(52 + kk * 10 + Math.sin(kk * 6 + i) * 3, 6 - kk * 14, 4, 3); } if (V.tod) { for (const [wx0, wy0] of [[46, 44], [72, 44]]) px(g, wx0, wy0, 5, 5, 'rgba(255,220,120,.9)'); } }
    g.restore();
    // the lens: a dark rim with a glint
    g.save(); g.translate(cx, cy); g.scale(sc, sc); g.strokeStyle = '#1c1830'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R + 1, 0, TAU); g.stroke(); g.strokeStyle = '#6a6488'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R + 3.5, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 5, -2.4, -1.5); g.stroke(); g.restore();
  }

  // ------------------------------------------------------------------ a peek for tests
  function state() {
    if (!S) return { open: false }; const r = S.cv.getBoundingClientRect(), toCss = (x, y) => ({ x: r.left + x / S.VW * r.width, y: r.top + y / S.VH * r.height });
    const o = { open: true, mode: S.mode, phase: S.phase, kind: S.kind, VW: S.VW, VH: S.VH, scale: S.sc, got: S.got.slice(), reached: S.reached };
    if (S.T && S.M) { const M = S.M, T = S.T; o.level = M.node.lv; o.levels = T.n; o.busy = M.busy; o.pose = M.pose; o.h = M.h; o.marina = toCss(X(wx(M.x, M.h)), Y(M.h) - 30);
      o.next = candidates().map(n => ({ lv: n.lv, side: n.side, toy: n.toy, ...toCss(X(wx(n.x, nodeH(n))), Y(nodeH(n)) - 14) }));
      o.toys = T.toys.filter(t => t.x).map(t => ({ type: t.type, lv: t.nd.lv, st: t.st, ...toCss(X(wx(t.x(), t.h())), Y(t.h()) - (t.type === 'web' ? -8 : 12)), drum: t.drum ? toCss(X(wx(t.dx(), t.dh())), Y(t.dh())) : null })); }
    if (S.V) { const V = S.V; o.az = V.az; o.tod = V.tod; o.binoc = V.binoc ? V.binoc.sp.id : null; o.spots = SPOTS.map(sp => { const q = spotPos(sp); return { id: sp.id, vis: q.x > 4 && q.x < S.VW - 4, ...toCss(q.x, q.y) }; }); }
    return o;
  }
  window.TreeClimb = { open: o => start('climb', o), view: o => start('view', o), close: () => { if (S) quit(); }, preload: loadArt, state, get active() { return !!S; } };
})();
