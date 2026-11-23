// Chef Marina — the backyard trees: the two big climbing trees (a great old oak and a tall white pine) and six smaller
// trees along the back of the lawn, each with one thing to do. Nothing to read: pictures, little animals and sounds.
// Load after outdoor.js (builder.js, wildlife.js and treeclimb.js may come before or after; any order works).
//
// Art: assets/trees/trees.png + trees.json (PixelLab). For every tree:
//   r      its still picture on the sheet [x, y, w, h];  ax / ay = where the trunk meets the ground inside that picture
//   p      loose pieces of foliage that move: [sheetX, sheetY, w, h, x, y (inside the picture), axis (0 sways sideways,
//          1 bobs up and down), amplitude (px), speed, phase, front (1 = drawn after the people, so Marina walks under it)]
//   crown  [x0, y0, x1, y1] of the leaves;  cb = bottom of the crown;  oak: hollow, face, drop (where leaves fall from);
//   pine: hole (the woodpecker's), drop, cones (on the needle carpet)
// Drawing: the small trees straight after the painted background, so the deer thickets, the workbench and everything
//   else stay in front of them; the giants where outdoor.js lists their 🧗 props (after the thickets, before tree houses and
//   people); the giants' hanging leaves, sunbeams and things in the air at the very end, under the game's own late layers.
//   Every picture is cut out once into canvases; a frame only copies pictures (no pixel work per frame).
// The trees are PROPS.backyard entries (a: 'ytree'; the giants keep outdoor.js's 'bigtree' props), so the game's glow,
//   tap test and choice buttons work as for everything else. Their one choice each goes through propActions.
//
//   Trees.list()          → [{ id, kind, x, y, toy, giant }]
//   Trees.onEvent         another file may set this to fn(kind, info): 'apple' when she eats an apple; also 'owl', 'cone',
//                         'throw', 'shake', 'hug', 'swing', 'seed', 'chickadee', 'petals'
//   Trees.toy(id)         do that tree's thing now (testing);  Trees.state  what is going on (testing);  Trees.ready
(function () {
  'use strict';
  if (window.Trees) return;                 // already loaded (a test may add the file twice)
  if (typeof ROOMS === 'undefined' || !ROOMS.backyard || !PROPS.backyard) return;
  const ROOM = 'backyard';
  const warned = {}, safe = (f, tag) => { try { return f(); } catch (e) { if (!warned[tag]) { warned[tag] = 1; console.warn('trees ' + tag, e); } } };
  const nap = s => new Promise(r => setTimeout(r, s * 1000));
  const sgn = v => (v < 0 ? -1 : 1);
  const here = () => typeof marina !== 'undefined' && G.room === ROOM;
  const BY = window.Backyard || { trees: [{ id: 'oak', x: 772 }, { id: 'pine', x: 978 }] };
  const bx = (id, d) => { const t = (BY.trees || []).find(q => q.id === id); return t ? t.x : d; };
  const event = (kind, info) => { try { const f = window.Trees && window.Trees.onEvent; if (typeof f === 'function') f(kind, info || {}); } catch (e) { } };

  // ---------------------------------------------------------------- where they stand
  // x = trunk, y = where the trunk meets the grass. Small trees stand in the gaps between the deer thickets
  // (296 404 512 622 744 806 946), behind the build plots, clear of the door, the workbench (150-320) and the leaf pile.
  // hw / hh = half width and height of the spot she taps; toy = her one thing to do; ico / img = the choice button.
  const TREES = [
    { id: 'oak', kind: 'oak', x: bx('oak', 772), y: 150, giant: true, toy: 'owl', ico: '🦉' },
    { id: 'pine', kind: 'pine', x: bx('pine', 978), y: 150, giant: true, toy: 'cone', ico: '🌰', img: 'tr_ico_cone' },
    { id: 'birch', kind: 'birch', x: 352, y: 143, toy: 'hug', ico: '🤗', hw: 22, hh: 108 },
    { id: 'apple', kind: 'apple', x: 458, y: 145, toy: 'apples', ico: '🍎', hw: 40, hh: 90 },
    { id: 'maple', kind: 'maple', x: 566, y: 141, toy: 'seed', ico: '🍁', img: 'tr_ico_seed', hw: 36, hh: 104 },
    { id: 'spruce', kind: 'spruce', x: 622, y: 139, toy: 'bird', ico: '🐦', hw: 17, hh: 100 },
    { id: 'dogwood', kind: 'dogwood', x: 683, y: 144, toy: 'petals', ico: '🌸', hw: 26, hh: 48 },
    { id: 'willow', kind: 'willow', x: 876, y: 142, toy: 'swing', ico: '🐒', hw: 34, hh: 48 },
  ];
  const TREE = {}; for (const t of TREES) TREE[t.id] = t;
  const GIANTS = TREES.filter(t => t.giant);
  let SMALL = TREES.filter(t => !t.giant).sort((a, b) => a.y - b.y);      // further back first

  // ---------------------------------------------------------------- little pictures drawn here, pixel by pixel (owl, birds, apples, cones, seeds)
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function pix(rows, pal) {
    const w = Math.max(...rows.map(r => r.length)), c = cnv(w, rows.length), g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
    return c;
  }
  const OWLPAL = { k: '#2a1c14', B: '#5a341e', b: '#7e4e2c', f: '#ead6aa', y: '#ffd23e', p: '#140e0a', o: '#e39b3a', c: '#dcbd8c', s: '#a07a48', w: '#fffbe8' };
  const OWL = ['..k......k..', '.kBk....kBk.', '.kbbbbbbbbk.', 'kbffffffffbk', 'kfyyyffyyyfk', 'kfypyffypyfk', 'kfyyyffyyyfk', 'kbfffoofffbk',
    'kbbccocccbbk', 'kbbcscscsbbk', 'kBbcccccbbBk', 'kBbcscscbbBk', '.kBbcccbbBk.', '..kk.oo.kk..'];
  const OWLSHUT = OWL.slice(); OWLSHUT[4] = 'kffffffffffk'; OWLSHUT[5] = 'kfBBBffBBBfk'; OWLSHUT[6] = 'kffffffffffk';
  const CHICKPAL = { k: '#18181d', w: '#f4f4ee', g: '#8d929c', G: '#5c616b', b: '#e9c89c', o: '#3a3a40', e: '#ffffff' };
  const CHICK = ['..........kkk...', '.........kkkkk..', '........kkkekkoo', '......ggkwwwwkk.', '....gggggwwwkkk.', 'GGGgggggGwwkkw..', '.GGGGgggGbbwww..', '..GGGGGGbbbbww..', '......GGbbbbw...', '........k..k....', '.......kk.kk....'];
  const CHICKFLY = ['..GG......kkk...', '...GGG...kkkkk..', '....GGG.kkkekkoo', '.....GGGkwwwwkk.', '....ggggGwwwkkk.', 'GGGgggggGwwkkw..', '.GGGGgggbbbwww..', '..GGGGGbbbbbww..', '......GGbbbbw...', '................', '................'];
  const WOODPAL = { k: '#16161a', w: '#f4f4ef', r: '#e0262c', g: '#8a8a92' };
  const WOOD = ['...kkk...', '..kkkrr..', 'ggkwwkr..', '..kkwwk..', '..wwkkk..', '..wwwkwk.', '..wwwkkw.', '..wwwkwk.', '..wwwkkw.', '...wwkwk.', '...wwkk..', '....kkk..', '....kk...', '....k....'];
  const APAL = { r: '#d8262a', h: '#ff9a8a', D: '#8e1418', s: '#4a2e14', l: '#4a9a3a', c: '#f6ecc8' };
  const APPLES = [['..sl..', '.rrsr.', 'rhrrrr', 'rhrrrD', 'rrrrDD', '.DDDD.'], ['..sl..', '.rrc..', 'rhrrc.', 'rhrrc.', 'rrrrDD', '.DDDD.'], ['..sl..', '.rc...', 'rhc...', 'rhc...', 'rrrc..', '.DDD..'], ['..s...', '..c...', '.cc...', '..c...', '.cc...', '..D...']];
  const CPAL = { a: '#7a4a22', b: '#cf9250', d: '#2e1a0c' };
  const CONE = ['..dd..', '.dbbd.', 'dbabbd', 'dbbabd', 'dbabbd', 'dbbabd', '.dbbd.', '..dd..'];
  const SPAL = { n: '#6e3418', w: '#f2c674', W: '#c8743a' };
  const SEED = ['ww.........ww', 'Wwww.....wwwW', '.WwwwW.WwwwW.', '...WWnnnWW...', '.....nnn.....', '......n......'];
  const PIX = { owl: pix(OWL, OWLPAL), owlShut: pix(OWLSHUT, OWLPAL), chick: pix(CHICK, CHICKPAL), chickFly: pix(CHICKFLY, CHICKPAL), wood: pix(WOOD, WOODPAL),
    apple: APPLES.map(a => pix(a, APAL)), cone: pix(CONE, CPAL), seed: pix(SEED, SPAL) };
  function icon(c, n, s) { const o = cnv(n, n), g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, (n - c.width * s) >> 1, (n - c.height * s) >> 1, c.width * s, c.height * s); return o; }
  E.cache.tr_ico_cone = icon(PIX.cone, 18, 2); E.cache.tr_ico_seed = icon(PIX.seed, 28, 2);   // pictures on her choice buttons
  if (typeof SAY_ICON !== 'undefined' && !SAY_ICON.m_tree_owl) SAY_ICON.m_tree_owl = '🦉';

  // ---------------------------------------------------------------- the painted trees: cut out once into canvases
  const ART = { ok: false, failed: false, img: new Image(), J: null };
  const TRUNK = { oak: [[84, 106, 172, 192], [54, 146, 202, 192]], pine: [[36, 112, 92, 166]] };   // the part of a giant that glows when she is near
  fetch('assets/trees/trees.json').then(r => r.json()).then(j => {
    ART.J = j.trees || j; ART.img.onload = () => safe(build, 'build'); ART.img.onerror = () => { ART.failed = true; }; ART.img.src = 'assets/trees/trees.png';
  }).catch(() => { ART.failed = true; });
  function build() {
    const img = ART.img, J = ART.J;
    for (const t of TREES) {
      const d = J[t.kind]; if (!d) continue;
      const [sx, sy, w, h] = d.r, half = Math.max(d.ax, w - d.ax), W = half * 2;
      Object.assign(t, { d, w, h, ax: d.ax, ay: d.ay, half, key: 'tr_' + t.id });
      const full = cnv(W, h); full.getContext('2d').drawImage(img, sx, sy, w, h, half - d.ax, 0, w, h);      // the anchor sits at the bottom centre, like the game's sprites
      t.pcs = d.p.map(p => { const c = cnv(p[2], p[3]); c.getContext('2d').drawImage(img, p[0], p[1], p[2], p[3], 0, 0, p[2], p[3]);
        return { c, x: p[4], y: p[5], axis: p[6], amp: p[7], spd: p[8], ph: p[9], late: !!p[10] }; });
      if (t.giant) {
        const trunk = cnv(W, h), rest = cnv(W, h), tg = trunk.getContext('2d'), rg = rest.getContext('2d'), path = g => { g.beginPath(); for (const b of TRUNK[t.kind]) g.rect(half - d.ax + b[0], b[1], b[2] - b[0], b[3] - b[1]); };
        tg.drawImage(full, 0, 0); tg.globalCompositeOperation = 'destination-in'; path(tg); tg.fill();
        rg.drawImage(full, 0, 0); rg.globalCompositeOperation = 'destination-out'; path(rg); rg.fill();
        E.cache[t.key + '_trunk'] = trunk; t.rest = rest;
      } else E.cache[t.key] = full;
      const pt = q => [t.x - d.ax + q[0], t.y - d.ay + q[1]];      // a point of the picture, in the yard
      t.drops = (d.drop || []).map(pt);
      if (d.crown) t.crown = [t.x - d.ax + d.crown[0], t.y - d.ay + d.crown[1], t.x - d.ax + d.crown[2], t.y - d.ay + (d.cb || d.crown[3])];
      if (t.kind === 'pine') t.cones = (d.cones || []).map(pt);
      if (t.kind === 'apple') t.fruit = findApples(full, half - d.ax, d.cb || h).map(pt);
    }
    makeBeams(); ART.ok = true;
  }
  function findApples(c, dx, cb) {             // where the painted apples hang (looked for once): they fall from there
    const g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, cb).data, cells = {};
    for (let y = 0; y < cb; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (im[i + 3] > 200 && im[i] > 150 && im[i + 1] < 80 && im[i + 2] < 80) { const k = ((x / 5) | 0) + ',' + ((y / 5) | 0); (cells[k] = cells[k] || []).push([x, y]); } }
    return Object.values(cells).filter(a => a.length >= 3).map(a => [a.reduce((s, p) => s + p[0], 0) / a.length - dx, a.reduce((s, p) => s + p[1], 0) / a.length]).sort((a, b) => b[1] - a[1]);
  }
  // sunbeams under the giants: a few slanting shafts of light, each its own canvas so they shimmer one by one
  const BEAMS = { oak: [[-108, 66, 10, 104, 26], [-72, 76, 15, 96, 28], [34, 70, 9, 100, 26], [70, 82, 15, 90, 24]], pine: [[-46, 98, 8, 72, 18], [22, 94, 10, 76, 18]] };
  function makeBeams() {
    S.beams = [];
    for (const t of GIANTS) for (const [dx, y, w, h, sl] of BEAMS[t.kind] || []) {
      const c = cnv(w + sl + 2, h), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,246,206,0)'); gr.addColorStop(0.22, 'rgba(255,246,206,.9)'); gr.addColorStop(0.7, 'rgba(255,238,186,.55)'); gr.addColorStop(1, 'rgba(255,238,186,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.7, 0); g.lineTo(sl + w, h); g.lineTo(sl, h); g.closePath(); g.fill();
      const b = { t, c, x: t.x + dx, y, w, h, sl, ph: Math.random() * 6, motes: [] };
      for (let i = 0; i < 4; i++) b.motes.push({ k: Math.random(), u: Math.random(), ph: Math.random() * 6, sp: 2 + Math.random() * 3 });
      S.beams.push(b);
    }
  }

  // ---------------------------------------------------------------- state
  const S = { beams: [], things: [], owl: null, bird: null, seeds: [], swing: null, eat: null, wp: null, wpT: 14, peekT: 9, drawn: {}, wind: 1, gust: 0, act: null };

  // ---------------------------------------------------------------- the props: the game's glow, tap test and choice buttons
  for (const t of GIANTS) {
    let p = PROPS.backyard.find(q => q.a === 'bigtree' && (q.tree === t.id || q.id === t.id));
    if (!p) { p = { id: 'tr_' + t.id, k: 'p:bigtree', x: t.x, y: BACK + 6, w: t.kind === 'oak' ? 44 : 36, h: 150, a: 'bigtree', tree: t.id }; PROPS.backyard.push(p); }
    t.prop = p;
  }
  function addProps() {
    for (const t of SMALL) { if (!t.prop) { t.prop = { id: 'tr_' + t.id, k: 'p:ytree', a: 'ytree', ytree: t.id }; PROPS.backyard.unshift(t.prop); }   // first in the list = the last thing the tap test tries
      Object.assign(t.prop, { x: t.x, y: t.y, w: t.hw * 2, h: t.hh }); }
  }
  addProps();

  // ---------------------------------------------------------------- drawing
  const onScreen = (x0, x1, m) => x1 > E.camX - (m || 0) && x0 < E.camX + E.viewW + (m || 0);
  const vis = t => t.d && onScreen(t.x - t.ax, t.x - t.ax + t.w, 4);
  const X0 = t => Math.round(t.x - E.camX) - t.ax, Y0 = t => t.y - t.ay;            // the picture's top-left corner on the canvas
  function sway(t, pc) {
    const r = t.rus || 0, w = Math.sin(E.t * pc.spd * (1 + r * 2.6) + pc.ph);
    let o = Math.round(pc.amp * S.wind * (1 + r * 3) * w);
    if (t.push && !pc.axis) o += Math.round(t.push * (0.4 + pc.y / t.h) * 3);
    return o;
  }
  function pieces(t, late) {
    const c = E.ctx, x0 = X0(t), y0 = Y0(t);
    for (const pc of t.pcs) if (pc.late === late) { const o = sway(t, pc); c.drawImage(pc.c, x0 + pc.x + (pc.axis ? 0 : o), y0 + pc.y + (pc.axis ? o : 0)); }
  }
  // the still picture goes through the game's own drawProp (as an ordinary sprite), so it gets the same soft glow as
  // everything else she can use. (The tap "boing" would squash a whole tree, so here it becomes a rustle of the leaves.)
  let inner = null;
  function viaGame(t, key) {
    const p = t.prop, c = E.cache[key]; if (!c) return;
    if (!p || !inner) { E.ctx.drawImage(c, Math.round(t.x - E.camX) - t.half, t.y - t.ay); return; }
    const k0 = p.k, y0 = p.y, b = G.bounce;
    if (b && b.id === p.id) { if (t.bounced !== b) { t.bounced = b; rustle(t, 0.5); } G.bounce = null; }
    p.k = key; p.y = t.y + t.h - t.ay;
    try { inner(p); } finally { p.k = k0; p.y = y0; if (b && !G.bounce) G.bounce = b; }
  }
  function drawSmall() {                                       // right after the painted background
    for (const t of SMALL) if (vis(t)) { viaGame(t, t.key); pieces(t, false); }
  }
  function drawGiant(t) {                                      // where outdoor.js's 🧗 prop is drawn
    S.drawn[t.id] = E.t; if (!vis(t)) return;
    viaGame(t, t.key + '_trunk');
    E.ctx.drawImage(t.rest, Math.round(t.x - E.camX) - t.half, t.y - t.ay);
    pieces(t, false);
    if (t.kind === 'oak') drawOwl(t); else drawWood(t);
  }
  function placeholder(t) {                                    // only if the tree pictures could not be loaded
    const big = t.kind === 'oak', w = big ? 40 : 26; rect(t.x - w / 2, 10, w, 140, big ? '#6b4a32' : '#5c4030');
    const c = E.ctx; c.fillStyle = big ? '#c9762c' : '#3f6b3a'; for (const [dx, dy, r] of big ? [[-50, 24, 40], [40, 16, 46], [0, 0, 44]] : [[0, 10, 30], [-22, 38, 22], [22, 44, 22]]) { c.beginPath(); c.arc(Math.round(t.x + dx - E.camX), dy, r, 0, 7); c.fill(); }
  }
  // the owl in the oak's hollow: two eyes in the dark, then out she comes, blinks, hoots, and back in
  function drawOwl(t) {
    const o = S.owl; if (!o) return; const k = E.t - o.t0; if (k > (o.peek ? 2 : 8)) { S.owl = null; return; }
    const c = E.ctx, hx = X0(t) + 113, hy = Y0(t) + 128, blink = (k % 1.7) > 1.55 || (k > 0.45 && k < 0.6) || (o.peek && (k < 0.15 || k > 1.85));
    c.save(); c.beginPath(); c.ellipse(hx + 6.5, hy + 11.5, 6.8, 11.8, 0, 0, 7); c.clip();
    if (o.peek || k < 0.9 || k > 7.1) { if (!blink) { c.fillStyle = '#ffd23e'; c.fillRect(hx + 3, hy + 9, 2, 2); c.fillRect(hx + 8, hy + 9, 2, 2); c.fillStyle = '#140e0a'; c.fillRect(hx + 4, hy + 10, 1, 1); c.fillRect(hx + 9, hy + 10, 1, 1); } }
    else { const rise = k < 1.4 ? (1.4 - k) / 0.5 : k > 6.6 ? (k - 6.6) / 0.5 : 0, tilt = k > 3.2 && k < 4.2 ? 1 : 0, puff = (k > 1.75 && k < 2.1) || (k > 4.4 && k < 4.75) ? 1 : 0;
      c.drawImage(blink ? PIX.owlShut : PIX.owl, hx + 1 + tilt, hy + 3 + Math.round(rise * 14) - puff); }
    c.restore();
  }
  // now and then a woodpecker comes out of the pine's hole and drums
  function drawWood(t) {
    const w = S.wp; if (!w) return; const k = E.t - w.t0; if (k > 4.4) { S.wp = null; return; }
    const out = k < 0.4 ? k / 0.4 : k > 4 ? (4.4 - k) / 0.4 : 1, drum = k > 0.8 && k < 3.6 && Math.sin(k * 60) > 0 ? 1 : 0;
    const c = E.ctx, x = X0(t) + Math.round(60 + out * 8) - drum, y = Y0(t) + Math.round(106 - out * 4);
    c.save(); c.globalAlpha = Math.min(1, out * 1.5); c.drawImage(PIX.wood, x, y); c.restore();
  }
  function lit(p, x, y) {                                      // a small thing she holds, with a soft light round it so it shows on any background
    const c = E.ctx; c.save(); c.shadowColor = 'rgba(255,248,214,.9)'; c.shadowBlur = E.scale * 1.8; c.drawImage(p, Math.round(x - E.camX) - (p.width >> 1), Math.round(y) - p.height); c.restore();
  }
  function drawThings() {                                      // apples and cones on the grass (behind the people)
    const c = E.ctx;
    for (const o of S.things) {
      if (!onScreen(o.x - 6, o.x + 6, 2)) continue;
      const a = Math.min(1, (o.life - (E.t - o.born)) / 1.5); if (a <= 0) continue; c.globalAlpha = a;
      if (o.z > 1) { c.fillStyle = 'rgba(30,50,20,.3)'; c.fillRect(Math.round(o.x - E.camX) - 2, Math.round(o.gy), 5, 1); }
      const p = o.kind === 'apple' ? PIX.apple[0] : PIX.cone, x = Math.round(o.x - E.camX), y = Math.round(o.gy - o.z);
      if (o.kind === 'cone') { c.save(); c.shadowColor = 'rgba(255,248,214,.85)'; c.shadowBlur = E.scale * 1.6; c.translate(x, y - 3); if (o.rot) c.rotate(o.rot); c.drawImage(p, -3, -4); c.restore(); } else c.drawImage(p, x - (p.width >> 1), y - p.height + 1);
      c.globalAlpha = 1;
    }
  }
  function drawBeams() {
    if (!S.beams.length) return; const c = E.ctx, day = 1 - Math.min(1, (G.night || 0) * 1.5); if (day <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const b of S.beams) {
      if (!onScreen(b.x, b.x + b.w + b.sl, 4)) continue;
      c.globalAlpha = (0.1 + 0.08 * (0.5 + 0.5 * Math.sin(E.t * 0.8 + b.ph)) + 0.03 * Math.sin(E.t * 2.3 + b.ph * 2)) * day;
      c.drawImage(b.c, Math.round(b.x - E.camX), b.y);
      for (const m of b.motes) {                               // specks of dust turning in the light
        const k = (m.k + E.t * 0.012 * m.sp) % 1, y = b.y + k * b.h, x = b.x + b.sl * k + m.u * b.w + Math.sin(E.t * 0.7 + m.ph) * 2;
        c.globalAlpha = (0.35 + 0.35 * Math.sin(E.t * 2.2 + m.ph)) * Math.sin(k * Math.PI) * day; c.fillStyle = '#fff8d8'; c.fillRect(Math.round(x - E.camX), Math.round(y), 1, 1);
      }
    }
    c.restore();
  }
  function drawLate() {                                        // after everybody: the hanging leaves she walks under, the light, things in the air
    for (const t of GIANTS) if (vis(t)) pieces(t, true);
    drawBeams();
    const c = E.ctx;
    const b = S.bird; if (b && b.x != null) { const p = b.fly ? (Math.sin(E.t * 30) > 0 ? PIX.chickFly : PIX.chick) : PIX.chick, x = Math.round(b.x - E.camX), y = Math.round(b.y);
      c.save(); c.shadowColor = 'rgba(255,250,222,.75)'; c.shadowBlur = E.scale * 1.4; c.translate(x, y); if (b.dir * (b.fly ? 1 : b.look || 1) < 0) c.scale(-1, 1); c.drawImage(p, -8, -11 + (b.hop || 0)); c.restore(); }
    for (const s of S.seeds) { const x = Math.round(s.x - E.camX), y = Math.round(s.y); if (s.landed || E.t < s.t0) continue;
      c.save(); c.shadowColor = 'rgba(255,248,214,.8)'; c.shadowBlur = E.scale * 1.5; c.translate(x, y); c.rotate(Math.sin(s.rot * 0.5) * 0.35); c.scale(Math.cos(s.rot) || 0.05, 1); c.drawImage(PIX.seed, -6, -3); c.restore(); }
    if (typeof marina === 'undefined') return;
    const sc = marina.scale * depthScale(marina.y), d = marina.dir < 0 ? -1 : 1;
    if (S.eat) { const e = S.eat, up = Math.max(0, Math.sin((E.t - e.t0) * 6.5)) * 2.5; c.drawImage(PIX.apple[Math.min(3, e.stage)], Math.round(marina.x + d * 10 * sc - E.camX) - 3, Math.round(marina.y - 36 * sc - up)); }
    if (G.holding && G.holding.type === 'cone' && marina.state === 'cheer') {      // held up high: look what I found!
      const x = marina.x + d * 1, y = marina.y + (marina.offY || 0) - 60 * sc - 10 + Math.sin(E.t * 6) * 1.2; lit(PIX.cone, x, y);
      if (Math.random() < 0.25) emit('sparkle', x + rnd(-6, 6), y + rnd(-4, 8), 1); }
    for (const s of S.seeds) if (s.landed) { c.globalAlpha = Math.max(0, Math.min(1, (12 - (E.t - s.t0)) / 2)); c.drawImage(PIX.seed, Math.round(s.x - E.camX) - 6, Math.round(s.y) - 3); c.globalAlpha = 1; }
  }
  // Marina on a willow strand
  function drawSwing() {
    const w = S.swing, c = E.ctx, k = E.t - w.t0, s = marina.scale * (E.depth || 1);
    const env = Math.min(1, k / 0.8) * (k > w.dur - 0.8 ? Math.max(0, (w.dur - k) / 0.8) : 1), a = 0.55 * env * Math.sin(k * Math.PI * 2 / 1.5);
    w.a = a; w.t.push = Math.sin(a) * 1.6;
    const hx = w.px + Math.sin(a) * w.len, hy = w.py + Math.cos(a) * w.len, r = a * 0.8, ca = Math.cos(r), sa = Math.sin(r);
    c.lineWidth = 1.3;
    for (const [side, col] of [[-11, '#7f8c22'], [12, '#b6c23a']]) { c.strokeStyle = col; c.beginPath(); c.moveTo(Math.round(w.px - E.camX) + side * 0.15, w.py); c.lineTo(hx + ca * side * s - E.camX, hy + sa * side * s); c.stroke(); }
    const fr = hangFrame(frameKey('marina_hang', E.t, 9) || 'marina_hang'); if (!fr) return;
    c.save(); c.translate(hx - E.camX, hy); c.rotate(r); if (marina.dir < 0) c.scale(-1, 1); c.drawImage(fr, -32 * s, -12 * s, fr.width * s, fr.height * s); c.restore();
  }
  const hangCache = {};
  function hangFrame(key) {                                    // the monkey-bar picture without its bar (she holds a strand of the willow instead)
    const ok = typeof mOpt === 'function' ? mOpt() : null, ck = key + JSON.stringify(ok); if (hangCache[ck]) return hangCache[ck];
    const src = spriteCanvas(key, ok); if (!src) return null; const c = cnv(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, c.width, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < c.width; x++) { if (y >= 11 && y <= 14 && !((x >= 17 && x <= 25) || (x >= 40 && x <= 48))) im.data[(y * c.width + x) * 4 + 3] = 0; }
    g.putImageData(im, 0, 0); return (hangCache[ck] = c);
  }

  // ---------------------------------------------------------------- hooking into the game's drawing
  const _dp = drawProp; inner = _dp;
  drawProp = function (p) {
    if (G.room !== ROOM) return _dp(p);
    if (p.ytree) return;                                       // already drawn, with the background
    if (p.a === 'bigtree') { const t = TREE[p.tree] || TREE[p.id]; if (t && t.giant) { if (ART.ok && t.d) safe(() => drawGiant(t), 'giant'); else if (ART.failed && bgFor(ROOM)) placeholder(t); else _dp(p); return; } }
    return _dp(p);
  };
  const _drb = drawRoomBG;
  drawRoomBG = function (room) { _drb(room); if (room === ROOM && ART.ok) safe(drawSmall, 'small'); };
  const _dps = drawProps;
  drawProps = function (z) {
    const r = _dps(z);
    if (z === 0 && G.room === ROOM && ART.ok) safe(() => { for (const t of GIANTS) if (S.drawn[t.id] !== E.t && t.d) drawGiant(t); drawThings(); }, 'wall');
    return r;
  };
  const _dx = drawExitSigns;
  drawExitSigns = function () { if (G.room === ROOM && ART.ok) safe(drawLate, 'late'); return _dx(); };
  const _dm = drawMarina;
  drawMarina = function (e) { if (S.swing && e === marina && G.room === ROOM) return safe(drawSwing, 'swing'); return _dm(e); };
  const _dh = drawHolding;
  drawHolding = function (e, y) {
    const h = G.holding; if (!h || h.type !== 'cone') return _dh(e, y);
    const s = (e.scale || 1) / 1.18; lit(PIX.cone, e.x + (e.dir < 0 ? -17 : 17) * s, y + 52 * s * 1.18);
  };

  // ---------------------------------------------------------------- the choices
  const choice = t => A(t.ico, () => start(t), t.img);
  const _pa = propActions;
  propActions = function (p) {
    if (p && p.a === 'ytree') { const t = TREE[p.ytree]; return t && t.d ? [choice(t)] : []; }
    if (p && p.a === 'tr_thing') { const o = p.thing; if (!S.things.includes(o)) return [];
      return o.kind === 'apple' ? [A('🍎', () => eatApple(o))] : [A('🌰', () => pickCone(o), 'tr_ico_cone')]; }
    const a = _pa(p);
    if (p && p.a === 'bigtree' && G.room === ROOM) { const t = TREE[p.tree] || TREE[p.id]; if (t && t.d) a.push(choice(t)); }
    return a;
  };
  // the choice buttons for a tree at the far end of the yard must not sit on the column of mood buttons
  let ringMine = false;
  const _ua = UI.actions;
  UI.actions = function (anchor, list) {
    const p = anchor && anchor.prop; ringMine = !!(p && (p.ytree || p.a === 'bigtree' || p.a === 'tr_thing')) || (typeof marina !== 'undefined' && anchor === marina && !!G.holding && G.holding.type === 'cone');
    const r = _ua.apply(this, arguments); if (ringMine) safe(nudge, 'nudge'); return r;
  };
  const _uu = UI.update;
  UI.update = function () { const r = _uu.apply(this, arguments); if (ringMine) safe(nudge, 'nudge'); return r; };
  function nudge() {
    const nodes = Array.from(document.querySelectorAll('#fx .act')); if (!nodes.length || nodes[0].closest('.acttray')) return;
    const bar = document.getElementById('moodbar'); if (!bar) return; const R = bar.getBoundingClientRect(); if (R.width < 4 || R.height < 4) return;
    let right = -1e9, top = 1e9, bot = -1e9; for (const n of nodes) { const r = n.getBoundingClientRect(); right = Math.max(right, r.right); top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); }
    if (right <= R.left - 6 || bot < R.top || top > R.bottom) return;
    const dx = right - (R.left - 8); for (const n of nodes) n.style.left = (parseFloat(n.style.left) - dx) + 'px';
  }
  // apples and cones lying on the grass can be tapped too
  function thingAt(wx, wy) { let best = null, bd = 99; for (const o of S.things) { if (o.z > 4 || E.t - o.born > o.life - 1) continue; const d = Math.abs(o.x - wx) + Math.abs(o.gy - 3 - wy) * 0.7; if (Math.abs(o.x - wx) < 10 && wy > o.gy - 14 && wy < o.gy + 8 && d < bd) { bd = d; best = o; } } return best; }
  const _ht = hitTest;
  hitTest = function (wx, wy) {
    const h = _ht(wx, wy);
    if (!here() || !ART.ok || (h && h.kind !== 'prop')) return h;
    const o = thingAt(wx, wy); if (!o) return h;
    return { kind: 'prop', p: { id: 'tr_thing', a: 'tr_thing', k: 'p:trthing', x: o.x, y: o.gy + 2, w: 16, h: 16, thing: o } };
  };
  const _sa = selfActions;
  selfActions = function () { const a = _sa(); if (G.holding && G.holding.type === 'cone' && !marina.mount) a.unshift(A('🤾', throwCone)); return a; };
  const _drop = dropHolding;
  dropHolding = function () { const h = G.holding; if (!h || h.type !== 'cone') return _drop(); G.holding = null;
    if (here()) S.things.push(thing('cone', marina.x + (marina.dir < 0 ? -8 : 8), Math.max(150, marina.y - 2), 26, 0, { vx: marina.dir * 12 })); };

  // ---------------------------------------------------------------- doing things
  function hold(on) { if (on) { G.busy = true; S.act = E.t; } else if (S.act != null) { S.act = null; G.busy = false; } }
  function goTo(x, y, cb) {                                    // walk there (a tap somewhere else on the way simply cancels it, as everywhere in the game)
    if (marina.mount) { approach(x, cb, 0); return; }
    if (['sit', 'sad', 'stomp', 'cheer', 'perch'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; }
    if (Math.abs(marina.x - x) < 3 && Math.abs(marina.y - y) < 3) { cb(); return; }
    marina.walkTo(x, cb, null, y);
  }
  function cheer(ms) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), ms || 1200); }
  function rustle(t, k) { t.rus = Math.max(t.rus || 0, k); }
  function start(t) {
    if (G.busy || S.act != null || !here()) return; UI.closeActions();
    if (marina.mount && typeof dismount === 'function') dismount();
    safe(() => TOY[t.toy](t), 'toy');
  }
  const crownPt = (t, lo) => { const c = t.crown; return [c[0] + 6 + Math.random() * (c[2] - c[0] - 12), c[1] + (lo || 0.25) * (c[3] - c[1]) + Math.random() * (1 - (lo || 0.25)) * (c[3] - c[1])]; };
  function shower(t, n, cols, o) {                             // leaves (or petals) coming down from the crown
    for (let i = 0; i < n; i++) setTimeout(() => { if (G.room !== ROOM) return; const [x, y] = crownPt(t, 0.3);
      emit('leaf', x, y, 1, Object.assign({ col: cols[(Math.random() * cols.length) | 0], vx: rnd(-16, 16), vy: rnd(-8, 12), g: 20, life: rnd(3.5, 5.5), drag: 0.6, size: rnd(2, 3.2), vr: rnd(-5, 5), wobble: rnd(0, 6) }, o || {})); }, i * 45);
  }
  function thing(kind, x, gy, z, life, o) { return Object.assign({ kind, x, gy, z, vx: 0, vz: 0, rot: 0, vr: 0, born: E.t, life: life || 60, roll: false, rest: false }, o || {}); }
  const tok = v => { Audio2.noise(0.03, v || 0.08, 1800); Audio2.blip(pick([2, 5, 7]), 'triangle', 0.03, 0.05); };
  const thump = () => { Audio2.blip(-22, 'sine', 0.09, 0.16); Audio2.noise(0.05, 0.07, 300); };

  const TOY = {
    // the oak: knock on the hollow, and the owl who lives there blinks out and hoots
    owl(t) {
      const hx = t.x - t.ax + 119.5;
      goTo(hx - 22, FLOOR, async () => {
        hold(true); marina.dir = 1; playAnim('marina_reach', { fps: 14, dur: 0.7 });
        for (let i = 0; i < 3; i++) { Audio2.noise(0.05, 0.22, 500); Audio2.blip(-14, 'square', 0.04, 0.06); rustle(t, 0.12); await nap(0.24); }
        await nap(0.5); S.owl = { t0: E.t, hoots: 0 };
        await nap(2.4); say('m_tree_owl'); cheer(1300); await nap(0.8); hold(false); event('owl');
      });
    },
    // the pine: pick up a pine cone; she holds it up, then can throw it (it bounces)
    cone(t) {
      const spots = (t.cones && t.cones.length ? t.cones : [[t.x - 30, 160]]), sp = spots.reduce((a, s) => Math.abs(s[0] - marina.x) < Math.abs(a[0] - marina.x) ? s : a, spots[0]);
      const side = marina.x < sp[0] ? -1 : 1;
      goTo(Math.min(1028, sp[0] + side * 9), Math.max(152, Math.min(170, sp[1] + 2)), () => pickUp(-side, null));
    },
    // the apple tree: shake it, apples thump down and roll, and she eats one
    apples(t) {
      const side = marina.x < t.x ? -1 : 1;
      goTo(t.x + side * 13, 151, async () => {
        hold(true); marina.dir = -side; playAnim('marina_hug', { fps: 14, dur: 1.1 });
        rustle(t, 1.6); Audio2.sfx('leaves', { vol: 0.8 }); setTimeout(() => Audio2.sfx('leaves', { vol: 0.5 }), 450);
        const fr = (t.fruit && t.fruit.length ? t.fruit : [[t.x - 20, t.y - 40], [t.x + 18, t.y - 46], [t.x, t.y - 52]]).slice(0, 10).sort(() => Math.random() - 0.5).slice(0, 4);
        fr.forEach(([x, y], i) => setTimeout(() => { if (G.room !== ROOM) return; const gy = t.y + 7 + Math.random() * 9; S.things.push(thing('apple', x, gy, gy - y, 90, { vx: rnd(-14, 14) || 6 })); }, 300 + i * 220));
        await nap(2.2); event('shake');
        const a = S.things.filter(o => o.kind === 'apple').sort((p, q) => Math.abs(p.x - marina.x) - Math.abs(q.x - marina.x))[0];
        hold(false); if (a) eatApple(a);
      });
    },
    // the birch clump: a big hug, and a shower of yellow leaves
    hug(t) {
      goTo(t.x - 13, 151, async () => {
        hold(true); marina.dir = 1; playAnim('marina_hug', { fps: 8, dur: 1.8 });
        await nap(0.45); rustle(t, 1.2); Audio2.sfx('leaves', { vol: 0.9 }); shower(t, 34, ['#f6d636', '#e9c124', '#ffe46a', '#d6a61c', '#fff09a']);
        emit('heart', marina.x + 6, marina.y - 66, 3); await nap(1.3); say(pick(['m_giggle', 'm_leaves'])); cheer(1200); await nap(0.4); hold(false); event('hug');
      });
    },
    // the willow: she grabs a strand of the curtain and swings
    swing(t) {
      goTo(t.x + 4, 151, async () => {
        hold(true); marina.dir = marina.x > t.x + 4 ? -1 : 1; Audio2.whoosh(true); playAnim('marina_jump_up', { fps: 18, dur: 0.45 }); await nap(0.4);
        marina.stop(); marina.state = 'anim'; marina.offY = 0; marina.anim = { base: null, n: 0, fps: 1, t0: E.t, dur: 99, loop: true, x0: marina.x };
        S.swing = { t, t0: E.t, dur: 4.6, px: t.x + 3, py: t.y - 94, len: 40, a: 0 }; rustle(t, 0.7); say('m_wheee');
        let last = 0;
        while (S.swing && E.t - S.swing.t0 < S.swing.dur && here()) { const a = S.swing.a; if (Math.abs(a) > 0.35 && sgn(a) !== last) { last = sgn(a); Audio2.whoosh(a > 0); shower(t, 2, ['#cfd04a', '#b8c032', '#e4df6a']); } await nap(0.05); }
        S.swing = null; t.push = 0; if (marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; }
        if (!here()) return hold(false);
        Audio2.blip(-10, 'sine', 0.06, 0.1); cheer(1200); await nap(0.5); hold(false); event('swing');
      });
    },
    // the maple: a helicopter seed spins down and she catches it
    seed(t) {
      const side = marina.x < t.x ? -1 : 1;
      goTo(t.x + side * 22, FLOOR, async () => {
        hold(true); marina.dir = -side; rustle(t, 0.7); Audio2.noise(0.3, 0.06, 2600);
        await nap(0.3); cheer(9000);
        const sc = marina.scale * depthScale(marina.y);
        for (let i = 0; i < 2; i++) { const [x, y] = i ? crownPt(t, 0.55) : [marina.x - side * 6, t.crown[1] + 14]; S.seeds.push({ x, y, x0: x, t0: E.t + i * 0.9, rot: Math.random() * 6, ph: Math.random() * 6, catchIt: i === 0, tx: marina.x, ty: marina.y - 62 * sc - 7, landed: false }); }
        Audio2.jingle([24, 22, 20, 17], 0.09, 'sine');
        const t0 = E.t; while (E.t - t0 < 6 && !S.seeds.some(s => s.caught)) await nap(0.1);
        const s = S.seeds.find(q => q.caught);
        if (s) { Audio2.jingle([12, 16, 19, 24], 0.07, 'triangle'); emit('sparkle', s.x, s.y, 8); say('m_wow'); await nap(1.4); s.away = true; s.caught = false; s.t0 = E.t; }
        if (marina.state === 'cheer') marina.state = 'idle';
        hold(false); event('seed');
      });
    },
    // the blue spruce: a chickadee pops out, sings, and flies away
    bird(t) {
      const side = marina.x < t.x ? -1 : 1;
      goTo(t.x + side * 20, FLOOR, async () => {
        hold(true); marina.dir = -side; playAnim('marina_reach', { fps: 12, dur: 0.6 });
        await nap(0.3); rustle(t, 0.9); Audio2.noise(0.2, 0.07, 2800);
        S.bird = { t, t0: E.t, dir: -side, x: null, y: 0 };
        await nap(1.3); say('m_look'); await nap(0.6); hold(false); event('chickadee');
      });
    },
    // the dogwood: a soft rain of petals
    petals(t) {
      const side = marina.x < t.x ? -1 : 1;
      goTo(t.x + side * 14, 151, async () => {
        hold(true); marina.dir = -side; playAnim('marina_reach', { fps: 10, dur: 0.8 });
        await nap(0.35); rustle(t, 0.8); Audio2.jingle([12, 16, 19, 24, 28], 0.1, 'sine');
        shower(t, 30, ['#ffd6e6', '#ffffff', '#f7a8c8', '#f06a96', '#ffeef4'], { vy: rnd(2, 8), g: 7, life: rnd(5, 7), size: rnd(1.5, 2.5), drag: 0.9 });
        await nap(1.1); say('m_pretty'); emit('heart', marina.x, marina.y - 66, 2); cheer(1200); await nap(0.4); hold(false); event('petals');
      });
    },
  };
  // the pine cone: picked up, held high, then thrown or dropped
  async function pickUp(dir, o) {
    hold(true); marina.dir = dir; playAnim('marina_pet', { fps: 16, dur: 0.55 }); await nap(0.5);
    if (o) S.things.splice(S.things.indexOf(o), 1);
    G.holding = { type: 'cone' }; Audio2.blip(12, 'triangle', 0.06, 0.1); emit('sparkle', marina.x + dir * 8, marina.y - 20, 5);
    cheer(1300); await nap(0.5); say('m_look'); await nap(0.9); hold(false); event('cone');
    if (G.holding && G.holding.type === 'cone' && here() && !G.busy) UI.actions(marina, [A('🤾', throwCone), A('⬇️', () => dropHolding())]);
  }
  function pickCone(o) { if (G.busy || !S.things.includes(o)) return; const side = marina.x < o.x ? -1 : 1; goTo(o.x + side * 9, Math.max(150, Math.min(172, o.gy + 2)), () => pickUp(-side, o)); }
  function throwCone() {
    const h = G.holding; if (G.busy || !h || h.type !== 'cone') return; UI.closeActions(); G.holding = null;
    const d = marina.dir < 0 ? -1 : 1, sc = marina.scale * depthScale(marina.y); Audio2.whoosh(true); playAnim('marina_reach', { fps: 18, dur: 0.4 });
    if (here()) S.things.push(thing('cone', marina.x + d * 10, Math.max(151, Math.min(172, marina.y - rnd(2, 8))), 46 * sc, 60, { vx: d * rnd(58, 72), vz: 85, vr: d * 11 }));
    setTimeout(() => { if (!G.busy) say(pick(['m_yay', 'm_giggle'])); }, 1100); event('throw');
  }
  // an apple from the grass: she picks it up and eats it, crunch crunch crunch
  function eatApple(o) {
    if (G.busy || !S.things.includes(o)) return; const side = marina.x < o.x ? -1 : 1;
    goTo(o.x + side * 9, Math.max(150, Math.min(172, o.gy + 1)), async () => {
      if (!S.things.includes(o)) return; hold(true); marina.dir = -side; playAnim('marina_pet', { fps: 16, dur: 0.55 }); await nap(0.5);
      S.things.splice(S.things.indexOf(o), 1); marina.state = 'idle'; S.eat = { t0: E.t, stage: 0 };
      for (let i = 1; i <= 3; i++) { await nap(0.5); S.eat.stage = i; try { Audio2.sfx('eat_chomp', { vol: 0.6 }); } catch (e) { } Audio2.noise(0.07, 0.08, 1500);
        emit('dust', marina.x + marina.dir * 7, marina.y - 42, 2, { col: '#f4e8b8', vy: rnd(-20, 0), g: 160, life: 0.5, size: 1.5, grow: 0 }); }
      await nap(0.45); S.eat = null; say('m_yummy'); emit('heart', marina.x, marina.y - 70, 3); cheer(1200);
      event('apple', { x: marina.x }); await nap(0.5); hold(false);
    });
  }

  // ---------------------------------------------------------------- every frame
  const LEAVES = { oak: [0.45, null], pine: [0.3, ['#3f6b4a', '#5e7d44', '#8a6a3a']], maple: [0.07, ['#d8401e', '#e8702a', '#b8281e']], birch: [0.06, ['#f2d23c', '#e3bf2a']],
    willow: [0.05, ['#c8c43a', '#a8b02a']], dogwood: [0.04, ['#b8283a', '#d8405a']], apple: [0.02, ['#6a9a3a', '#c8a83a']] };
  function tick(dt) {
    if (!ART.ok) return;
    S.gust = Math.max(0, S.gust - dt * 0.22); if (Math.random() < dt / 35) S.gust = rnd(0.4, 0.8);
    S.wind = 1 + 0.25 * Math.sin(E.t * 0.21) + 0.15 * Math.sin(E.t * 0.57 + 1) + S.gust;
    for (const t of TREES) if (t.rus) t.rus = Math.max(0, t.rus - dt * 0.9);
    if (S.act != null && E.t - S.act > 15) hold(false);                    // never leave the game locked
    if (G.room !== ROOM) return;
    // leaves and needles drifting down now and then
    for (const t of TREES) { const L = LEAVES[t.kind]; if (!L || !t.drops && !t.crown) continue; if (Math.random() > dt * L[0] * (1 + S.gust * 2)) continue;
      const [x, y] = t.drops && t.drops.length ? pick(t.drops) : crownPt(t, 0.5); if (x < E.camX - 10 || x > E.camX + E.viewW + 10) continue;
      const needle = t.kind === 'pine';
      emit('leaf', x + rnd(-4, 4), y, 1, Object.assign({ vx: rnd(-6, 6), vy: rnd(needle ? 10 : 5, needle ? 16 : 11), g: needle ? 6 : 3, life: rnd(7, 10), drag: 0.1, vr: rnd(-4, 4), wobble: rnd(0, 6), size: needle ? rnd(1, 1.6) : rnd(2, 3) }, L[1] ? { col: pick(L[1]) } : {})); }
    // apples and cones: falling, bouncing, rolling, then lying still for a while
    for (let i = S.things.length - 1; i >= 0; i--) {
      const o = S.things[i]; if (E.t - o.born > o.life) { S.things.splice(i, 1); continue; } if (o.rest) continue;
      if (!o.roll) { o.vz -= 300 * dt; o.z += o.vz * dt; o.x += o.vx * dt; o.rot += o.vr * dt;
        if (o.z <= 0) { o.z = 0; if (o.vz < -45) { const first = !o.hit; o.hit = true; o.vz = -o.vz * (o.kind === 'cone' ? 0.48 : 0.28); o.vx *= 0.78; o.vr *= 0.6;
            if (onScreen(o.x, o.x, 20)) { if (o.kind === 'apple' && first) thump(); else tok(o.kind === 'cone' ? 0.09 : 0.05); } } else { o.vz = 0; o.roll = true; } } }
      else { o.x += o.vx * dt; o.vx *= Math.max(0, 1 - dt * 3.6); o.rot += o.vx * dt * 0.3; if (Math.abs(o.vx) < 2.5) { o.vx = 0; o.rest = true; o.rot = o.kind === 'cone' ? Math.PI / 2 * sgn(o.rot || 1) : 0; } }
      if (o.x < 14 || o.x > ROOMS[ROOM].w - 14) { o.x = Math.max(14, Math.min(ROOMS[ROOM].w - 14, o.x)); o.vx = -o.vx * 0.5; }
    }
    // the owl's hoots
    const ow = S.owl; if (ow) { const k = E.t - ow.t0, t = TREE.oak; for (const [at, n] of [[1.8, 1], [4.5, 2]]) if (k > at && ow.hoots < n) { ow.hoots = n; Audio2.blip(-5, 'sine', 0.28, 0.22); setTimeout(() => Audio2.blip(-7, 'sine', 0.55, 0.22), 330);
      emit('note', t.x - t.ax + 126, t.y - t.ay + 130, 1, { vx: 10, vy: -16 }); } }
    // the chickadee: out of the boughs, onto a twig, a song, a look round, and away
    const b = S.bird; if (b) { const k = E.t - b.t0, t = b.t, px = t.x + b.dir * 15, py = t.y - 44, ox = t.x + b.dir * 3, oy = t.y - 56;
      if (k < 0.3) b.x = null;
      else if (k < 0.75) { const q = (k - 0.3) / 0.45; b.x = ox + (px - ox) * q; b.y = oy + (py - oy) * q - Math.sin(q * Math.PI) * 8; b.fly = true; }
      else if (k < 3.1) { b.x = px; b.y = py; b.fly = false; b.hop = (k > 2.2 && k < 2.35) ? -2 : 0; b.look = k > 1.6 && k < 2.0 ? -1 : 1;
        if (!b.sang && k > 1.0) { b.sang = true; [[31, 0.05], [29, 0.05], [24, 0.13], [24, 0.13], [24, 0.13]].forEach(([n, l], i) => setTimeout(() => Audio2.blip(n, i < 2 ? 'sine' : 'triangle', l, 0.06), [0, 90, 260, 430, 600][i])); } }
      else { b.fly = true; b.x += sgn(b.dir) * 85 * dt; b.y -= 34 * dt; if (k > 6.5 || b.y < -20) S.bird = null; } }
    // the helicopter seeds
    for (let i = S.seeds.length - 1; i >= 0; i--) {
      const s = S.seeds[i]; if (E.t < s.t0) continue; const k = E.t - s.t0;
      if (s.caught) { const sc = marina.scale * depthScale(marina.y); s.x = marina.x; s.y = marina.y - 62 * sc - 7 + Math.sin(E.t * 6) * 1.2; s.rot = 0; continue; }
      if (s.away) { s.x += 40 * dt; s.y -= 22 * dt; s.rot += dt * 18; if (k > 4) S.seeds.splice(i, 1); continue; }
      if (s.landed) { if (k > 12) S.seeds.splice(i, 1); continue; }
      s.rot += dt * 11; s.y += 16 * dt; s.x = s.x0 + Math.sin(k * 2.6 + s.ph) * 5 + k * 3; if (Math.random() < dt * 6) emit('sparkle', s.x, s.y, 1, { vx: rnd(-6, 6), vy: rnd(-4, 4), life: 0.6 });
      if (s.catchIt && G.busy) { const q = Math.min(1, Math.max(0, (s.y - (s.ty - 40)) / 40)); s.x += (s.tx - s.x) * q; if (s.y >= s.ty - 1) { s.caught = true; s.catchIt = false; } }
      if (s.y >= FLOOR + 6 - (i % 3) * 4) { s.landed = true; s.t0 = E.t; }
    }
    // now and then two eyes blink in the dark of the oak's hollow (somebody lives in there...)
    const oak = TREE.oak; if (!S.owl && S.act == null && vis(oak) && (S.peekT -= dt) <= 0) { S.peekT = rnd(28, 50); S.owl = { t0: E.t, hoots: 9, peek: true }; Audio2.blip(-7, 'sine', 0.3, 0.05); }
    // the woodpecker
    const pine = TREE.pine; if (S.wp) { const k = E.t - S.wp.t0; for (const at of [0.9, 1.9, 2.9]) if (k > at && !S.wp['d' + at]) { S.wp['d' + at] = 1; if (vis(pine)) for (let j = 0; j < 7; j++) setTimeout(() => { Audio2.noise(0.02, 0.1, 2200); Audio2.blip(-3, 'square', 0.015, 0.03); }, j * 48); } }
    else if (vis(pine) && S.act == null && (S.wpT -= dt) <= 0) { S.wpT = rnd(24, 44); S.wp = { t0: E.t }; }
  }
  { const _ft = featTick; featTick = function (dt) { _ft(dt); safe(() => tick(dt), 'tick'); }; }

  // ---------------------------------------------------------------- for the rest of the game (and for testing)
  window.Trees = {
    list: () => TREES.map(t => ({ id: t.id, kind: t.kind, x: t.x, y: t.y, toy: t.toy, giant: !!t.giant })),
    onEvent: () => { },
    toy(id) { const t = TREE[id]; if (t && t.d) start(t); return !!(t && t.d); },
    get ready() { return ART.ok; },
    get state() { return { ready: ART.ok, act: S.act != null, wind: +S.wind.toFixed(2), owl: !!S.owl, bird: !!S.bird, swing: !!S.swing, eat: !!S.eat, woodpecker: !!S.wp,
      seeds: S.seeds.map(s => ({ x: Math.round(s.x), y: Math.round(s.y), caught: !!s.caught, landed: !!s.landed })), things: S.things.map(o => ({ kind: o.kind, x: Math.round(o.x), y: Math.round(o.gy), z: Math.round(o.z), rest: o.rest })) }; },
    place(id, x, y) { const t = TREE[id]; if (!t || t.giant) return; t.x = x; if (y != null) t.y = y; if (t.d) { const d = t.d, pt = q => [t.x - d.ax + q[0], t.y - d.ay + q[1]]; t.crown = d.crown && [t.x - d.ax + d.crown[0], t.y - d.ay + d.crown[1], t.x - d.ax + d.crown[2], t.y - d.ay + (d.cb || d.crown[3])]; if (t.kind === 'apple') { const c = E.cache[t.key]; t.fruit = findApples(c, t.half - d.ax, d.cb || t.h).map(pt); } } SMALL.sort((a, b) => a.y - b.y); addProps(); },
    woodpecker() { S.wp = { t0: E.t }; },
    _S: S, _T: TREE,
  };
})();
