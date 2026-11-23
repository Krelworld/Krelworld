// Chef Marina — Grandpa Jeff builds things in the backyard.
// A picture catalogue of things he can make from a small pile of planks (so the yard can never be filled up),
// each one customised (colour, style, extras, where), built in a little time-lapse, saved, playable,
// and taken down again when she wants the planks back. Tree houses are real little rooms up a ladder.
// Everything is additive and lives in this one file; its pictures are assets/build/build.png + build.json.
//
//   Builder.open({ onSay })   the build menu (onSay(kind) is asked for Jeff's voice: hello, start, done, full, down, recolor)
//   Builder.close()           Builder.list() → [{ kind, spot, colour, style, addons }]      Builder.lumberLeft()      Builder.has(kind)
//   Builder.onSay = fn        used when open() was not given one
// Saved in localStorage 'cm_builds'. Spots: p1..p5 on the ground, oak / pine for a tree house, oak_b / pine_b for things that hang from a branch.
(function () {
  if (typeof ROOMS === 'undefined' || !ROOMS.backyard || !PROPS.backyard) return;
  const BY = window.Backyard || { W: 1040, door: 92, bench: 232, plots: [{ id: 'p1', x: 348 }, { id: 'p2', x: 458 }, { id: 'p3', x: 568 }, { id: 'p4', x: 678 }, { id: 'p5', x: 872 }],
    trees: [{ id: 'oak', x: 772, houseY: 62, trunk: 34 }, { id: 'pine', x: 978, houseY: 54, trunk: 26 }] };
  const KEY = 'cm_builds', LUMBER = 12, GY = 152, DECK = 10, TH_W = 300, ON = 0.82;   // ON: how big she is drawn when she is on a thing (they stand a little further back)
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const press = (n, fn) => { n.addEventListener('pointerup', e => { e.stopPropagation(); fn(e); }); return n; };
  const lerp = (a, b, k) => a + (b - a) * k, ease = k => k * k * (3 - 2 * k);
  const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const line = (c, x0, y0, x1, y1, col, lw) => { c.strokeStyle = col; c.lineWidth = lw || 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  // (an emoji takes on the see-through-ness of the last fill colour, so that is reset before drawing one)
  const emo = (c, ch, x, y, size, rot, alpha) => { c.save(); c.fillStyle = '#000'; if (alpha != null) c.globalAlpha = alpha; c.translate(x, y); if (rot) c.rotate(rot); c.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, 0); c.restore(); };
  const em = (ch, x, y, size, alpha, rot) => { E.ctx.fillStyle = '#000'; emoji(ch, x, y, size, alpha, rot); };
  const got = ev => { try { window.did && did(ev); } catch (e) { } };
  const warn = (w, e) => { try { console.warn('builder ' + w, e); } catch (x) { } };

  // ---------------------------------------------------------------- where things can go
  // ground plots p1..p5, a tree-house spot up in each big tree, and a branch on each tree for things that hang
  const SPOTS = {};
  for (const p of BY.plots) SPOTS[p.id] = { id: p.id, type: 'ground', x: p.x, y: GY };
  for (const t of BY.trees) { const side = t.id === 'pine' ? -1 : 1, br = t.houseY + 24;            // the branch sticks out on one side; the ladder hangs on the other
    SPOTS[t.id] = { id: t.id, type: 'tree', x: t.x, y: t.houseY + DECK + 8, tree: t, side, ladX: t.x - side * 36 };     // (a little lower than houseY, so more of the roof shows when the phone is held sideways)
    SPOTS[t.id + '_b'] = { id: t.id + '_b', type: 'branch', x: t.x + side * (t.trunk / 2 + 26), y: GY - 13, tree: t, side, br }; }
  const SPOT_ORDER = Object.keys(SPOTS);

  // ---------------------------------------------------------------- the pictures: one sheet, recoloured in code
  const ART = { img: new Image(), A: null, cache: {}, prof: {} };
  ART.img.src = 'assets/build/build.png';
  fetch('assets/build/build.json').then(r => r.json()).then(j => { ART.A = j; }).catch(e => warn('art', e));
  const artOK = () => !!(ART.A && ART.img.complete && ART.img.naturalWidth);
  const COLOURS = ['blue', 'red', 'pink', 'purple', 'green', 'rainbow'];
  const HUE = { red: 357, pink: 328, purple: 274, green: 128 };
  const CSS = { blue: '#2f74dc', red: '#de3b30', pink: '#f472b0', purple: '#8d55dc', green: '#3fae4c', rainbow: '#ff5a8a' };            // the same paint for parts drawn by code
  const DARK = { blue: '#1f4fa6', red: '#a32620', pink: '#c84a86', purple: '#62359e', green: '#2b7c36', rainbow: '#7b4cf0' };
  const ACCENT = { blue: '#f2c230', red: '#ffd23e', pink: '#7b4cf0', purple: '#ffd23e', green: '#e8453c', rainbow: '#ffffff' };
  const PASTEL = { blue: ['#c3d9f0', '#b2cbe6'], red: ['#f2c8bf', '#e8b7ad'], pink: ['#f7d3e6', '#efc0d8'], purple: ['#dfd1f2', '#d0bfe8'], green: ['#d2e8c6', '#c1dbb3'], rainbow: null };
  const RAINBOW = ['#e8453c', '#ff9a2e', '#ffd23e', '#4fba55', '#2f8fe6', '#8d55dc'];
  const paintAt = (colour, i) => colour === 'rainbow' ? RAINBOW[((i | 0) % 6 + 6) % 6] : CSS[colour] || CSS.blue;
  // only the bright blue paint of a picture changes colour: wood, metal, outlines and everything else stay as painted
  function repaint(c, colour, pattern) {
    const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = HUE[colour];
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] < 10) continue;
      let [h, s, v] = rgb2hsv(d[p], d[p + 1], d[p + 2]); if (h < 175 || h > 256 || s < 0.28 || v < 0.13) continue;
      const X = (p >> 2) % W, Y = ((p >> 2) / W) | 0;
      if (colour === 'rainbow') { h = ((Y * 7 + X * 3) % 360 + 360) % 360; s = Math.min(1, s * 0.95); v = Math.min(1, v * 1.08); }
      else if (H != null) { h = (H + (h - 212) * 0.45 + 360) % 360; if (colour === 'pink') { s *= 0.66; v = Math.min(1, v * 1.16 + 0.04); } if (colour === 'green') { s *= 0.92; v *= 0.94; } if (colour === 'red') s = Math.min(1, s * 1.05); }
      if (pattern === 'stripes' && ((X + Y) >> 2) % 2 === 0) { s *= 0.3; v = Math.min(1, v * 1.2 + 0.14); }
      if (pattern === 'dots' && (X + (((Y / 5) | 0) % 2) * 3) % 6 < 2 && Y % 5 < 2) { s *= 0.18; v = Math.min(1, v * 1.25 + 0.2); }
      const [r, g, b] = hsv2rgb(h, s, v); d[p] = r; d[p + 1] = g; d[p + 2] = b;
    }
    x.putImageData(im, 0, 0);
  }
  function spr(key, colour, pattern) {
    if (!artOK()) return null; const ck = key + '|' + (colour || 'blue') + '|' + (pattern || 'plain'); if (ART.cache[ck]) return ART.cache[ck];
    const r = ART.A[key]; if (!r) return null;
    const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; c.getContext('2d').drawImage(ART.img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    if ((colour && colour !== 'blue') || (pattern && pattern !== 'plain')) repaint(c, colour || 'blue', pattern);
    return (ART.cache[ck] = c);
  }
  // the outline of a picture: the first solid pixel in every column (used to hang flags, lights and balloons on it)
  function prof(key) {
    if (ART.prof[key]) return ART.prof[key]; const c = spr(key); if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, top = [];
    for (let x = 0; x < c.width; x++) { let y = 0; while (y < c.height && d[(y * c.width + x) * 4 + 3] < 40) y++; top.push(y); }
    let a = 0, b2 = 0; for (let x = 0; x < c.width; x++) { if (top[x] < top[a]) a = b2 = x; else if (top[x] === top[a] && x === b2 + 1) b2 = x; }
    return (ART.prof[key] = { w: c.width, h: c.height, top, apex: [(a + b2) >> 1, top[a]] });
  }

  // ---------------------------------------------------------------- what she has built (saved)
  let D = { builds: [], seen: {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, seen: D.seen, builds: D.builds.map(b => ({ kind: b.kind, spot: b.spot, colour: b.colour, style: b.style, addons: b.addons, toys: b.toys, lamp: b.lamp })) })); } catch (e) { } };
  const lumberLeft = () => LUMBER - D.builds.reduce((n, b) => n + CATBY[b.kind].cost, 0);
  const at = spot => D.builds.find(b => b.spot === spot);
  const freeSpots = type => SPOT_ORDER.filter(id => SPOTS[id].type === type && !at(id));

  // ---------------------------------------------------------------- the catalogue: everything Grandpa Jeff can build
  // cost = planks; spot = ground | tree | branch; w,h = its size; styles = her one "style" choice (default: plain / stripes / spots paint);
  // addons = extras she can switch on; back/front = the parts drawn by code; acts = what she can do with it once it is built
  const PAT = [['plain'], ['stripes'], ['dots']];
  const CAT = [
    { id: 'treehouse', ico: '🏡', cost: 5, spot: 'tree', col: 'red', w: 116, h: 70, styleKind: 'spr', styles: [['gable', 'th_gable'], ['round', 'th_round'], ['fort', 'th_fort'], ['tent', 'th_tent']], addons: ['lights', 'flag', 'tube'], back: thBack,
      acts: p => [A('🪜', () => climbUp(p))].concat(p.b.addons.includes('tube') ? [A('🛝', () => play(p, tubeRide))] : []) },
    { id: 'slide', ico: '🛝', cost: 2, spot: 'ground', col: 'blue', spr: 'slide', w: 88, h: 72, addons: ['flag', 'balloons'], acts: p => [A('🛝', () => play(p, slideDown)), A('🙃', () => play(p, slideDown, 'flip'))] },
    { id: 'swing', ico: '🪢', cost: 3, spot: 'ground', col: 'red', spr: 'swing', w: 96, h: 80, addons: ['balloons', 'flowers'], front: swingFront, acts: p => [A('↔️', () => play(p, swingHigh)), A('🦘', () => play(p, swingHigh, true))] },
    { id: 'seesaw', ico: '⚖️', cost: 1, spot: 'ground', col: 'green', spr: 'seesaw', w: 64, h: 17, pivot: 8, addons: ['flowers'], acts: p => [A('🧸', () => play(p, seesaw))] },
    { id: 'sandbox', ico: '🏖️', cost: 1, spot: 'ground', col: 'blue', spr: 'sandbox', w: 88, h: 38, addons: ['balloons', 'flowers'], front: sandFront, acts: p => [A('⛏️', () => play(p, digTreasure)), A('🏰', () => play(p, sandCastle))] },
    { id: 'trampoline', ico: '🤸', cost: 2, spot: 'ground', col: 'purple', spr: 'trampoline', w: 80, h: 40, addons: ['balloons', 'flowers'], acts: p => [A('🤸', () => play(p, trampBounce)), A('🌟', () => play(p, trampBounce, true))] },
    { id: 'castle', ico: '🏰', cost: 4, spot: 'ground', col: 'pink', spr: 'castle', w: 73, h: 93, addons: ['lights', 'balloons', 'flowers'], acts: p => [A('👑', () => play(p, castleQueen)), A('🐉', () => play(p, castleDragon))] },
    { id: 'ship', ico: '🏴‍☠️', cost: 5, spot: 'ground', col: 'red', spr: 'ship', w: 93, h: 99, styleKind: 'emblem', styles: [['skull', '☠️'], ['star', '⭐'], ['heart', '💖']], addons: ['lights', 'balloons'], front: shipFront,
      acts: p => [A('☸️', () => play(p, shipSail)), A('💥', () => play(p, shipCannon))] },
    { id: 'rocket', ico: '🚀', cost: 4, spot: 'ground', col: 'blue', spr: 'rocket', w: 52, h: 105, addons: ['flag', 'lights'], front: rocketFront, acts: p => [A('🚀', () => play(p, rocketFly, 'space')), A('🌙', () => play(p, rocketFly, 'moon'))] },
    { id: 'wall', ico: '🧗', cost: 3, spot: 'ground', col: 'green', spr: 'wall', w: 52, h: 86, addons: ['flag', 'balloons'], acts: p => [A('🧗', () => play(p, wallClimb))] },
    { id: 'zip', ico: '🚡', cost: 3, spot: 'ground', col: 'red', spr: 'zip', w: 100, h: 94, ox: -27, addons: ['flag', 'lights'], front: zipFront, acts: p => [A('🚡', () => play(p, zipRide)), A('🦸', () => play(p, zipRide, 'hero'))] },
    { id: 'lemonade', ico: '🍋', cost: 2, spot: 'ground', col: 'pink', spr: 'lemonade', w: 57, h: 72, addons: ['lights', 'balloons', 'flowers'], acts: p => [A('🍋', () => play(p, lemonadeShop)), A('🥤', () => play(p, lemonadeDrink))] },
    { id: 'picnic', ico: '🧺', cost: 1, spot: 'ground', col: 'red', spr: 'picnic', w: 78, h: 42, addons: ['balloons', 'flowers'], acts: p => [A('🧺', () => play(p, picnic)), A('🫖', () => play(p, picnic, 'tea'))] },
    { id: 'puppet', ico: '🎭', cost: 2, spot: 'ground', col: 'purple', spr: 'puppet', w: 58, h: 84, addons: ['lights', 'balloons'], acts: p => [A('🐸', () => play(p, puppetShow, ['🐸', '🦊'])), A('👸', () => play(p, puppetShow, ['👸', '🐲']))] },
    { id: 'mud', ico: '🥧', cost: 2, spot: 'ground', col: 'green', spr: 'mud', w: 60, h: 66, addons: ['flowers', 'lights'], acts: p => [A('🥧', () => play(p, mudPie)), A('💦', () => play(p, mudSplash))] },
    { id: 'fairy', ico: '🧚', cost: 1, spot: 'ground', col: 'red', spr: 'fairy', w: 64, h: 43, addons: ['lights'], acts: p => [A('✨', () => play(p, fairyDust)), A('💧', () => play(p, fairyWater))] },
    { id: 'goal', ico: '⚽', cost: 1, spot: 'ground', col: 'blue', spr: 'goal', w: 83, h: 55, addons: ['flag', 'balloons'], acts: p => [A('⚽', () => play(p, goalKick)), A('🤸', () => play(p, goalKick, 'flip'))] },
    { id: 'tire', ico: '🛞', cost: 2, spot: 'branch', col: 'blue', spr: 'tire', w: 28, h: 28, hang: true, addons: ['flowers'], back: hangBack, acts: p => [A('↔️', () => play(p, tireSwing)), A('🌀', () => play(p, tireSwing, 'spin'))] },
    { id: 'bird', ico: '🐦', cost: 1, spot: 'branch', col: 'red', spr: 'bird', w: 26, h: 32, hang: true, up: 26, addons: ['flowers'], back: hangBack, acts: p => [A('🌾', () => play(p, birdFeed)), A('🎵', () => play(p, birdSong))] },
  ];
  const CATBY = {}; for (const c of CAT) CATBY[c.id] = c;
  const ADDON = { flag: '🚩', lights: '✨', balloons: '🎈', flowers: '🌷', tube: '🛝' };
  const stylesOf = c => c.styles || PAT;
  function look(b) { const c = CATBY[b.kind]; let key = c.spr, pat = 'plain';
    if (c.styleKind === 'spr') key = (c.styles.find(s => s[0] === b.style) || c.styles[0])[1]; else if (!c.styleKind) pat = b.style || 'plain';
    return { c, key, canvas: spr(key, b.colour, pat) }; }

  // ---------------------------------------------------------------- drawing a built thing (the same code draws it in the yard, in the menu preview and on the little map)
  // cx = its centre, by = its base line; o.reveal 0..1 = how much is built so far; o.ground, o.side, o.br place the tree parts; b._ = what is going on right now
  // o.part: 'back' = only the parts behind it (a tree house's braces, ladder and tube), 'body' = everything but those
  function drawThing(c, b, cx, by, t, o) {
    o = o || {}; const { c: cat, key, canvas } = look(b), st = b._ || {}, doBack = o.part !== 'body', doBody = o.part !== 'back';
    if (!canvas) { if (doBody) emo(c, cat.ico, cx, by - 14, 24); return; }
    const w = canvas.width, h = canvas.height, X = cx + (cat.ox || 0), L = X - (w >> 1), T = by - h, rv = o.reveal == null ? 1 : o.reveal;
    if (cat.hang && rv >= 1 && doBack) branch(c, cx, by, o);
    c.save();
    if (st.dy) c.translate(0, Math.round(st.dy));
    if (st.rot || st.sx != null) { const pv = cat.hang ? (o.br == null ? T - 30 : o.br) : by - (cat.pivot || 0); c.translate(X, pv); if (st.rot) c.rotate(st.rot); if (st.sx != null) c.scale(st.sx, 1); c.translate(-X, -pv); }
    if (st.sy != null) { c.translate(0, by); c.scale(1, st.sy); c.translate(0, -by); }
    if (rv < 1) { c.globalAlpha = 0.2; c.drawImage(canvas, L, T); c.globalAlpha = 1; c.beginPath(); c.rect(L - 60, by - Math.ceil(h * rv), w + 120, h + 200); c.clip(); }
    if (cat.back && rv > 0 && doBack) cat.back(c, b, cx, by, t, o, st, T);
    if (!doBody) { c.restore(); return; }
    if (rv > 0) { if (o.glow > 0.02) { c.shadowColor = 'rgba(255,236,150,' + (o.glow * (0.8 + Math.sin(t * 4) * 0.2)).toFixed(3) + ')'; c.shadowBlur = (o.blur || 8); }
      c.drawImage(canvas, L, T); c.shadowColor = 'transparent'; c.shadowBlur = 0; }
    if (cat.front && rv > 0) cat.front(c, b, cx, by, t, o, st);
    for (const it of st.items || []) emo(c, it.ch, cx + it.dx, by + it.dy, it.size || 10, it.rot || 0, it.a);
    if (rv >= 1) extras(c, b, cat, key, L, T, w, h, t, o);
    c.restore();
    if (rv > 0 && rv < 1) { const y = by - Math.ceil(h * rv); for (let x = L - 3; x < L + w + 3; x += 6) px(c, x, y, 3, 1, 'rgba(255,255,255,.9)'); }
  }
  // the extras she can switch on: flowers along the bottom, a string of fairy lights, balloons, a flag
  const FLOWER = ['#ff6fae', '#ffd23e', '#ffffff', '#e8453c', '#b98aff'], BULB = ['#ff5a5a', '#ffd23e', '#6fe07a', '#5ab8ff', '#ff8fd6'];
  function extras(c, b, cat, key, L, T, w, h, t, o) {
    const on = b.addons || [], pr = prof(key); if (!on.length || !pr) return; const by = T + h;
    if (on.includes('flowers')) { const hanging = cat.hang, x0 = hanging ? L - 14 : L - 3, ww = hanging ? w + 28 : w + 6, base = hanging ? (o.ground > by ? o.ground : by + 14) : by + 1;       // under a hanging thing they grow on the ground below
      for (let i = 0, n = Math.max(3, Math.round(ww / 12)); i < n; i++) { const x = Math.round(x0 + ww * (i + 0.5) / n + (i * 7) % 5 - 2), sw = Math.round(Math.sin(t * 2 + i) * 0.7), hh = 5 + (i * 3) % 4;
        px(c, x, base - hh, 1, hh, '#3c8a3a'); px(c, x - 1, base - 3, 1, 1, '#58b052'); px(c, x - 1 + sw, base - hh - 2, 3, 3, FLOWER[i % 5]); px(c, x + sw, base - hh - 1, 1, 1, i % 5 === 1 ? '#ff9a2e' : '#ffe14a'); } }
    if (on.includes('lights')) { const xs = [3, w >> 1, w - 4], pts = xs.map(x => [L + x, T + Math.min(pr.top[x], h - 6) - 1]); let n = 0;
      for (let s = 0; s < pts.length - 1; s++) { const [x0, y0] = pts[s], [x1, y1] = pts[s + 1], len = Math.hypot(x1 - x0, y1 - y0), m = Math.max(3, Math.round(len / 7));
        for (let i = 0; i <= m * 3; i++) { const k = i / (m * 3); px(c, lerp(x0, x1, k), lerp(y0, y1, k) + Math.sin(k * Math.PI) * 4, 1, 1, '#3b3340'); }
        for (let i = 1; i < m; i++, n++) { const k = i / m, x = Math.round(lerp(x0, x1, k)), y = Math.round(lerp(y0, y1, k) + Math.sin(k * Math.PI) * 4), lit = Math.sin(t * 3.2 + n * 1.9) > -0.35;
          if (lit) { c.globalAlpha = 0.28; px(c, x - 2, y - 1, 5, 5, BULB[n % 5]); c.globalAlpha = 1; } px(c, x - 1, y, 3, 3, lit ? BULB[n % 5] : '#8d8798'); if (lit) px(c, x, y, 1, 1, '#fff'); } } }
    if (on.includes('balloons')) { const ax = cat.hang ? w >> 1 : w - 6, x0 = L + ax, y0 = T + pr.top[Math.max(0, Math.min(w - 1, ax))] + 2;
      [[-6, -17, '#e8453c'], [1, -23, '#ffd23e'], [8, -16, '#5ab8ff']].forEach(([dx, dy, col], i) => { const bx = x0 + dx + Math.sin(t * 1.7 + i * 2) * 1.5, byy = y0 + dy + Math.cos(t * 2.1 + i) * 1;
        line(c, x0 + 0.5, y0, bx + 0.5, byy + 4, 'rgba(60,50,60,.7)', 0.6); c.fillStyle = col; c.beginPath(); c.ellipse(bx + 0.5, byy, 4, 5, 0, 0, 7); c.fill(); px(c, bx - 1, byy - 3, 1, 2, 'rgba(255,255,255,.75)'); px(c, bx, byy + 5, 1, 1, col); }); }
    if (on.includes('flag')) { let [ax, ay] = pr.apex; if (key === 'th_tent') { ax = w - 8; ay = pr.top[w - 8]; } const x = L + ax, y = T + ay, col = ACCENT[b.colour] || '#e8453c';
      px(c, x, y - 13, 1, 14, '#5b5b66'); px(c, x - 1, y - 14, 3, 2, '#ffd23e');
      for (let j = 0; j < 10; j++) { const off = Math.round(Math.sin(t * 6 - j * 0.8) * 1.3 * (j / 9)), hh = Math.max(1, 7 - Math.floor(j * 0.6)); px(c, x + 1 + j, y - 13 + off + ((7 - hh) >> 1), 1, hh, j % 4 === 3 ? 'rgba(255,255,255,.85)' : col); } }
  }
  // ---- the parts of particular things that are drawn by code
  function thBack(c, b, cx, by, t, o) {                           // tree house: braces to the trunk, the rope ladder, the tube slide
    const side = o.side || 1, g = o.ground == null ? by + 80 : o.ground, lx = cx - side * 36, top = by - DECK + 1, sw = Math.sin(t * 1.4) * 1.2;
    for (const s of [-1, 1]) { line(c, cx + s * 36, by - 2, cx + s * 9, by + 20, '#4a3120', 4); line(c, cx + s * 36, by - 3, cx + s * 9, by + 19, '#8a6238', 1.4); }
    if ((b.addons || []).includes('tube')) tube(c, b, cx, by, g);
    for (const dx of [-5, 5]) line(c, lx + dx + 0.5, top, lx + dx + 0.5 + sw, g + 1, '#d2b077', 1.5);
    for (let y = top + 5; y < g; y += 7) { const k = (y - top) / (g - top); px(c, lx - 6 + sw * k, y, 13, 2, '#6b4423'); px(c, lx - 6 + sw * k, y, 13, 1, '#a9773f'); }
  }
  function tube(c, b, cx, by, g) {                                // a zig-zag tube slide down the trunk; st.tube 0..1 = where she is inside it
    const n = Math.max(2, Math.round((g - by - 12) / 19)), at = b._ && b._.tube, dk = b.colour === 'rainbow' ? '#6a3fc0' : DARK[b.colour] || DARK.blue;
    for (let i = 0; i < n; i++) { const big = at != null && Math.abs(at * n - i - 0.5) <= 0.5 ? 2 : 0;
      c.save(); c.translate(cx, by + 12 + i * 19); c.rotate((i % 2 ? -1 : 1) * 0.3); px(c, -21, -6 - big, 42, 12 + big * 2, '#2a2230'); px(c, -20, -5 - big, 40, 10 + big * 2, paintAt(b.colour, i)); px(c, -20, -5 - big, 40, 3, 'rgba(255,255,255,.4)'); px(c, -20, 3 + big, 40, 2, dk); c.restore(); }
    px(c, cx - 12, g - 12, 24, 13, '#2a2230'); px(c, cx - 11, g - 11, 22, 11, paintAt(b.colour, n)); px(c, cx - 11, g - 11, 22, 3, 'rgba(255,255,255,.4)'); px(c, cx - 7, g - 7, 14, 8, '#2a2230');
  }
  function branch(c, cx, by, o) {                                 // the branch a tyre swing or bird house hangs from
    const side = o.side || 1, br = o.br == null ? by - 60 : o.br, x0 = cx - side * 30;
    line(c, x0, br + 5, cx + side * 9, br, o.bark || '#3d2c20', 6); line(c, x0, br + 4, cx + side * 9, br - 1, o.bark2 || '#6a5038', 2);
    for (const [dx, dy, col] of [[10, -4, '#c9762c'], [4, -6, '#d99a2e'], [13, 1, '#a8502a']]) { c.fillStyle = o.leaf || col; c.beginPath(); c.arc(cx + side * dx, br + dy, 4, 0, 7); c.fill(); }
  }
  function hangBack(c, b, cx, by, t, o, st, T) { const br = o.br == null ? T - 30 : o.br; if (T - br > 1) line(c, cx + 0.5, br, cx + 0.5, T + 3, '#d2b077', 1.6); }
  function swingFront(c, b, cx, by, t, o, st) {                   // the two swings (the sheet only has the frame)
    for (let i = 0; i < 2; i++) { const a = st.sw && st.sw[i] != null ? st.sw[i] : Math.sin(t * 1.1 + i * 2.2) * 0.035;
      c.save(); c.translate(cx + (i ? 18 : -18), by - 72); c.rotate(a); px(c, -8, 0, 1, 37, '#9a9ca6'); px(c, 7, 0, 1, 37, '#9a9ca6'); px(c, -10, 36, 20, 3, paintAt(b.colour, i * 3)); px(c, -10, 39, 20, 1, 'rgba(0,0,0,.35)'); c.restore(); }
  }
  function zipFront(c, b, cx, by, t, o, st) {                     // the cable from the tower down to a padded post, and the handle
    const x0 = cx - 13, y0 = by - 70, x1 = cx + 46, y1 = by - 24;
    px(c, x1 - 1, y1 - 5, 4, 29, '#6b4a2c'); px(c, x1 - 1, y1 - 5, 1, 29, '#9a7040'); px(c, x1 - 4, by - 3, 10, 3, '#5a3d26'); px(c, x1 - 4, y1 + 4, 10, 9, '#2a2230'); px(c, x1 - 3, y1 + 5, 8, 7, paintAt(b.colour, 0));
    line(c, x0, y0, x1 + 1, y1, '#33333d', 1.2);
    if (!st.riding) { const k = st.zip || 0, hx = Math.round(lerp(x0 + 5, x1 - 7, k)), hy = Math.round(lerp(y0, y1, (hx - x0) / (x1 - x0))); px(c, hx, hy, 1, 6, '#33333d'); px(c, hx - 4, hy + 6, 9, 2, '#e0a83c'); }
  }
  function shipFront(c, b, cx, by, t, o, st) {                    // her sign on the sail, a cannon at the bow, the wheel at the stern, and the sea when she sails
    emo(c, { skull: '☠️', star: '⭐', heart: '💖' }[b.style] || '☠️', cx - 8, by - 60, 15);
    px(c, cx - 38, by - 40, 7, 5, '#6b4a2c'); c.save(); c.translate(cx - 34, by - 42); c.rotate(-0.4); px(c, -13 + (st.kick || 0) * 4, -3, 15, 6, '#23232b'); px(c, -14 + (st.kick || 0) * 4, -4, 3, 8, '#41414d'); c.restore();
    px(c, cx + 23, by - 53, 2, 6, '#5a3d26'); c.save(); c.translate(cx + 24, by - 59); c.rotate(st.wheel || 0); c.strokeStyle = '#6b4423'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 5.5, 0, 7); c.stroke(); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); px(c, -8, -0.5, 16, 1, '#8a5a2e'); } c.restore();
    if (st.sea) { c.globalAlpha = st.sea; for (let r = 0; r < 3; r++) for (let x = -76; x < 76; x += 2) { const ph = t * (2.4 + r * 0.9) + x * (0.2 - r * 0.03) + r * 2, y = by - 12 + r * 5 + Math.sin(ph) * 2.2 + (Math.abs(x) > 60 ? (Math.abs(x) - 60) * 0.5 : 0); px(c, cx + x, y, 2, 16 - r * 5, ['#2a7fd8', '#3f97e8', '#6db6f2'][r]); if (Math.sin(ph) < -0.55) px(c, cx + x, y, 2, 1, '#f2fbff'); } c.globalAlpha = 1; }
  }
  function rocketFront(c, b, cx, by, t, o, st) {                  // her face at the window, and the flames
    if (st.pilot) { const m = spriteCanvas(mBase(), mOpt()), s = 0.44; if (m) { c.save(); c.beginPath(); c.arc(cx + 2, by - 70, 6.5, 0, 7); c.clip(); px(c, cx - 6, by - 78, 16, 16, '#bfe6ff'); c.drawImage(m, cx + 2 - m.width * s / 2, by - 70 - m.height * s * 0.36, m.width * s, m.height * s); c.restore(); } }
    if (st.fire) { for (let i = 0; i < 3; i++) { const len = st.fire * (14 + Math.random() * 14) * (i === 1 ? 1.4 : 0.8), x = cx + (i - 1) * 9; c.fillStyle = i === 1 ? '#ff8a1e' : '#ffd23e'; c.beginPath(); c.moveTo(x - 5, by - 4); c.lineTo(x + 5, by - 4); c.lineTo(x, by - 4 + len); c.fill(); }
      c.fillStyle = '#fff6c8'; c.beginPath(); c.moveTo(cx - 3, by - 4); c.lineTo(cx + 3, by - 4); c.lineTo(cx, by - 4 + st.fire * 13); c.fill(); }
  }
  function sandFront(c, b, cx, by, t, o, st) {                    // the hole she dug, the castle she made
    if (st.hole) { c.fillStyle = '#b07f2a'; c.beginPath(); c.ellipse(cx + 12, by - 17, 8 * st.hole, 3 * st.hole, 0, 0, 7); c.fill(); }
    if (st.castle) { const k = st.castle, X = cx - 24, Y = by - 19, H = Math.round(10 * k); px(c, X - 11, Y - H, 22, H, '#e2b955'); px(c, X - 11, Y - H, 22, 1, '#f3d684'); for (const dx of [-12, -3, 6]) { px(c, X + dx, Y - H - Math.round(6 * k), 6, Math.round(6 * k) + 1, '#ecc669'); px(c, X + dx, Y - H - Math.round(6 * k), 6, 1, '#f8e09a'); }
      if (k >= 1) { px(c, X - 2, Y - 5, 4, 5, '#a9792e'); px(c, X, Y - 26, 1, 10, '#6b4423'); px(c, X + 1, Y - 26, 5, 3, paintAt(b.colour, 2)); } }
  }

  // ---------------------------------------------------------------- moving parts shared by everything below
  // S.pose = how Marina is drawn while she is on a thing; S.cam = what the camera watches; S.jeff = Jeff while he works; S.fx = extra drawing on top
  const S = { act: null, pose: null, cam: null, camX: 0, jeff: null, held: null, fx: [], planks: [], opts: null, benchT: 0 };
  const tweens = [];
  const run = (dur, step) => new Promise(res => tweens.push({ t: 0, dur, step, res }));           // step(k 0..1, seconds so far, dt) once a frame, in game time
  const nap = s => run(s, () => { });
  const _ft = window.featTick;
  window.featTick = function (dt) {
    if (_ft) _ft(dt);
    if (drawExitSigns !== hookLate.top) hookLate();                                              // another file added its own late drawing after us: stay the last one
    for (const w of tweens.slice()) { w.t += dt; try { w.step(Math.min(1, w.t / w.dur), w.t, dt); } catch (e) { warn('step', e); w.t = w.dur; } if (w.t >= w.dur) { tweens.splice(tweens.indexOf(w), 1); w.res(); } }
    if (S.cam != null && S.soft && (marina.moving || Math.abs(marina.x - S.softX) > 3 || G.room !== 'backyard')) S.cam = null;
    if (S.cam != null && G.room === 'backyard') { const cs = E.cssScale || 1, target = clamp(S.cam - E.viewW / 2, -62 / cs, ROOMS.backyard.w - E.viewW + 78 / cs); S.camX += (target - S.camX) * Math.min(1, dt * 5); E.camX = S.camX; }
  };
  const focus = x => { if (S.cam == null) S.camX = E.camX; S.cam = x; S.soft = false; }, unfocus = () => { S.soft = true; S.softX = marina.x; };      // afterwards the camera stays on the thing until she walks off
  // our late drawing goes after everyone else's (tree foliage drawn over the characters included), so a tree house sits in front of its leaves;
  // if a file loaded later wraps drawExitSigns too, we wrap again on the next frame and only the outermost of our wrappers draws
  let lateDepth = 0;
  function hookLate() {
    const inner = drawExitSigns, w = function () { lateDepth++; try { inner.apply(this, arguments); } finally { lateDepth--; } if (!lateDepth) { try { late(); } catch (e) { if (!late.warned) { late.warned = 1; warn('draw', e); } } } };
    drawExitSigns = hookLate.top = w;
  }
  hookLate();
  function late() {
    const c = E.ctx;
    if (G.room === 'backyard') for (const p of PROPS.backyard) if (p.bl === 1 && p.th2) drawBuilt(p, 'body');
    for (const q of S.planks) { const k = clamp((E.t - q.t0) / q.dur, 0, 1), x = lerp(q.x0, q.x1, k) - E.camX, y = lerp(q.y0, q.y1, k) - Math.sin(k * Math.PI) * q.arc; c.save(); c.translate(x, y); c.rotate(q.rot + k * q.spin); px(c, -9, -2, 18, 5, '#6b4423'); px(c, -8, -2, 16, 3, '#d9a868'); px(c, -8, 1, 16, 1, '#b98448'); c.restore(); }
    for (const f of S.fx) f(c);
    drawActors(c); thLate(c);
  }
  // Marina while she is on something: her usual picture, turned / moved / swapped as the game being played needs
  const _dm = drawMarina;
  drawMarina = function (e) {
    const a = S.pose; if (!a) return _dm(e); if (a.hide) return;
    const k = a.key === 'walk' ? (frameKey(mWalk(), E.t, 12) || mBase()) : a.key === 'cheer' ? (frameKey('marina_cheer', E.t, 8) || mBase()) : a.key || mBase();
    drawSprite(k, a.x, a.y, { flip: a.flip != null ? a.flip : e.dir < 0, scale: e.scale * (a.s || 1), rot: a.rot || 0, opt: mOpt(), sx: a.sx || 1, sy: a.sy || 1, alpha: a.a == null ? 1 : a.a });
  };
  const cheer = (ms = 1400) => { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), ms); };
  const walkTo = (x, y) => new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; if (Math.abs(marina.x - x) < 3) return fin(); marina.walkTo(x, fin, 118, y == null ? FLOOR : y); setTimeout(fin, 6000); });
  // what Jeff says: the caller's onSay(kind) if it gave one (kinds: hello, start, done, full, down, recolor); otherwise, if the real Jeff is about, his own lines
  const JSAY = { hello: ['j_build_hello1', 'j_build_hello2', 'j_build_hello3'], start: ['j_build_start1', 'j_build_start2', 'j_build_start3', 'j_build_start4'], done: ['j_build_done1', 'j_build_done2', 'j_build_done3', 'j_build_done4'], full: ['j_build_full1', 'j_build_full2'], down: ['j_build_down', 'j_build_down2'], recolor: ['j_recolor'] };
  function hook(kind) {
    try { const f = (S.opts && S.opts.onSay) || API.onSay; if (f) return void f(kind); const j = rj(), ks = JSAY[kind]; if (!j || !ks) return;
      const pr = Audio2.voice(pick(ks), 'j', { cut: true }); try { UI.face('jeff', kind === 'full' ? 'surprised' : 'happy', pr); } catch (e) { } } catch (e) { warn('onSay', e); }
  }
  const bang = n => { Audio2.noise(0.045, 0.3, 1200); Audio2.blip(-15 + (n % 3) * 2, 'square', 0.04, 0.1); };
  const saw = () => { for (let i = 0; i < 5; i++) setTimeout(() => Audio2.noise(0.08, 0.13, i % 2 ? 2400 : 1500), i * 80); };
  const chips = (x, y, n) => { for (let i = 0; i < n; i++) emit('confetti', x + rnd(-8, 8), y, 1, { col: pick(['#d9a868', '#b98448', '#f0d09a', '#8a5a2e']), vx: rnd(-60, 60), vy: rnd(-90, -30), life: 0.9 }); };

  // ---------------------------------------------------------------- Grandpa Jeff. The real one is another file's `jeff`; without him a little handyman is drawn here
  const rj = () => (typeof jeff !== 'undefined' && jeff ? jeff : null);
  function drawJeff(c, x, y, pose, dir, t) {
    x = Math.round(x); y = Math.round(y);
    if (has('jeff')) { let k = 'jeff'; if (pose === 'walk') k = frameKey('jeff_walk', t, 12) || k; else if (pose === 'hammer') k = frameKey('jeff_hammer', t, 12) || k; else if (pose === 'wave') k = frameKey('jeff_wave', t, 8) || k;
      const cv = spriteCanvas(k); if (cv) { const bob = k === 'jeff' && pose === 'hammer' ? -Math.abs(Math.sin(t * 15)) * 3 : 0; c.save(); c.translate(x, y + Math.round(bob)); c.scale(dir < 0 ? -1 : 1, 1); c.drawImage(cv, -(cv.width >> 1), -cv.height);
        if (k === 'jeff' && pose === 'hammer') { c.translate(12, -40); c.rotate(-0.9 + Math.abs(Math.sin(t * 15)) * 1.5); px(c, -1, -12, 2, 13, '#8a5a2e'); px(c, -4, -15, 9, 5, '#6d7078'); } c.restore(); return; } }
    const walk = pose === 'walk', sw = walk ? Math.sin(t * 16) : 0, hm = pose === 'hammer' ? Math.abs(Math.sin(t * 15)) : 0, wv = pose === 'wave' ? Math.sin(t * 10) : 0, bob = walk ? Math.abs(sw) * -1 : pose === 'hammer' ? hm * -1 : 0;
    c.save(); c.translate(x, y + Math.round(bob)); c.scale(dir < 0 ? -1 : 1, 1);
    px(c, -7 + sw * 3, -4, 7, 4, '#4a3120'); px(c, 1 - sw * 3, -4, 7, 4, '#4a3120');                                   // boots
    px(c, -6 + sw * 2, -22, 5, 18, '#3f5f8f'); px(c, 1 - sw * 2, -22, 5, 18, '#35527c');                                 // jeans
    px(c, -9, -45, 18, 24, '#c8463c'); for (let i = 0; i < 4; i++) px(c, -9, -43 + i * 6, 18, 1, '#8f2f2a'); px(c, -3, -45, 1, 24, '#8f2f2a'); px(c, 4, -45, 1, 24, '#8f2f2a');   // plaid shirt
    px(c, -9, -25, 18, 4, '#6b4423'); px(c, 4, -25, 5, 7, '#8a5a2e'); px(c, -1, -24, 3, 2, '#ffd23e');                 // tool belt
    px(c, -12, -44, 4, 15, '#c8463c'); px(c, -12, -30, 4, 4, '#f0c8a8');                                               // the arm at rest
    px(c, -7, -60, 14, 15, '#f0c8a8'); px(c, -7, -51, 14, 7, '#e3e3e6'); px(c, -5, -46, 10, 3, '#e3e3e6'); px(c, 1, -55, 2, 2, '#2a2230'); px(c, -4, -55, 2, 2, '#2a2230'); px(c, -2, -50, 5, 1, '#b56a5a');   // face and a white beard
    px(c, -8, -64, 16, 6, '#ffc93a'); px(c, -9, -59, 20, 2, '#e0a81f'); px(c, -3, -66, 6, 2, '#ffd96a');               // hard hat
    c.translate(9, -42); c.rotate(pose === 'wave' ? -2.4 + wv * 0.4 : pose === 'hammer' ? -1.5 + hm * 1.5 : 0.1 - sw * 0.4); px(c, -2, 0, 4, 14, '#c8463c'); px(c, -2, 13, 4, 4, '#f0c8a8');   // the busy arm
    if (pose === 'hammer' || pose === 'idle') { px(c, -1, 15, 2, 11, '#8a5a2e'); px(c, -4, 24, 9, 5, '#6d7078'); }
    c.restore();
  }
  // Jeff walks over to a building spot. The real Jeff (family2.js) is held back from his own wandering while he works (AI.hold), walks over himself,
  // hammers with his own pictures, and is let go again afterwards; if he is not about (hidden in the bathroom, in a fort...) a stand-in does the job.
  // Both are handled through the same little handle J: x, y = where his feet are (y above the ground = up on the thing), pose, dir.
  const realJ = () => { const j = rj(); return j && !j.hidden && j.state !== 'toilet' && !(G.fort && G.fort.guests && G.fort.guests.includes(j)) ? j : null; };
  function jeffHandle(j, b) {
    return { b, real: j, get x() { return j.x; }, set x(v) { j.x = v; }, get y() { return j.y + (j.offY || 0); }, set y(v) { j.offY = Math.round(v - j.y); },
      get dir() { return j.dir; }, set dir(v) { j.dir = v; }, get pose() { return j.state; }, set pose(v) { j.state = v === 'walk' ? 'idle' : v; } };
  }
  function holdJeff(j) { if (!j) return; if (S.held !== j) { AI.hold(j, true); S.held = j; } j.stop(); j.offY = 0; j.face = null; if (j.state !== 'idle') j.state = 'idle'; j.carry = false; }
  function freeJeff() { const j = S.held; S.held = null; if (!j) return; j.offY = 0; if (j.state === 'hammer') j.state = 'idle'; j.wait = Math.max(j.wait || 0, rnd(2.5, 4.5)); AI.hold(j, false); }
  async function jeffComes(b, jx) {
    const j = realJ(), R = ROOMS.backyard;
    if (j) {
      holdJeff(j); const edge = E.viewW / 2 + 24;
      if (j.room !== 'backyard') { j.room = 'backyard'; j.x = clamp(jx + (jx > R.w / 2 ? edge : -edge), 10, R.w - 10); j.y = FLOOR - 3; }    // from wherever he was, in from the side
      else if (Math.abs(j.x - jx) > edge + 60) j.x = jx + Math.sign(j.x - jx) * edge;                                                      // from far off: he arrives from just out of sight
      const d = Math.abs(jx - j.x);
      await new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; if (d < 3) return fin(); j.walkTo(jx, fin, clamp(d / 1.7, 85, 160), FLOOR - 3); setTimeout(fin, 4200); });
      j.stop(); j.x = jx; j.y = FLOOR - 3; j.offY = 0; return (S.jeff = jeffHandle(j, b));
    }
    const from = BY.bench - 52, J = S.jeff = { b, x: clamp(from, jx - 150, jx + 150), y: FLOOR - 3, pose: 'walk', dir: 1 }, x0 = J.x; J.dir = Math.sign(jx - x0) || 1;
    await run(Math.max(0.25, Math.abs(jx - x0) / 190), k => { J.x = lerp(x0, jx, k); if (chance(0.25)) emit('dust', J.x, FLOOR, 1); });
    return J;
  }
  function jeffDone(J) {                // back to the ground, a wave to her, and off he goes about his own business again
    S.jeff = null; const j = J && J.real; if (!j) return freeJeff();
    j.offY = 0; j.y = FLOOR - 3; j.dir = Math.sign(marina.x - j.x) || 1; if (j.state === 'hammer') j.state = 'idle'; freeJeff();
  }
  // Grandpa Jeff likes to watch: now and then, if he is out here and free, he cheers at what she does on the things he built
  let cheerAt = -99;
  function jeffCheer(keys, x) {
    const j = realJ(); if (!j || !j.here || AI.held.has(j) || j.moving || G.sceneOn || E.t - cheerAt < 22 || Math.abs(j.x - (x == null ? marina.x : x)) > E.viewW * 0.75 || !chance(0.6)) return;
    cheerAt = E.t; j.dir = Math.sign(marina.x - j.x) || 1; if (['idle', 'hammer'].includes(j.state)) j.state = 'wave'; j.wait = Math.max(j.wait || 0, 3);
    setTimeout(() => { if (j.state === 'wave' && !AI.held.has(j)) j.state = 'idle'; }, 2600); say(pick(keys), j);
  }

  // ---------------------------------------------------------------- in the backyard: the workbench with the plank pile, and one prop per built thing
  const PINE = { leaf: '#2f5a34', bark: '#4a281c', bark2: '#8a4c34' };
  const mainProp = b => PROPS.backyard.find(p => p.bl === 1 && p.b === b);
  const propY = b => { const sp = SPOTS[b.spot], c = CATBY[b.kind]; return sp.type === 'branch' && c.up ? sp.br + c.up + c.h : sp.y; };
  function syncProps() {
    const L = PROPS.backyard; for (let i = L.length - 1; i >= 0; i--) if (L[i].bl) L.splice(i, 1);
    for (const b of D.builds) { const sp = SPOTS[b.spot], c = CATBY[b.kind];
      L.push({ id: 'bl_' + b.spot, bl: 1, k: 'p:built', x: sp.x, y: propY(b), w: c.w, h: c.h, a: 'built', b });
      if (c.id === 'treehouse') L.push({ id: 'bl_' + b.spot + '_lad', bl: 2, k: 'p:builtlad', x: sp.ladX, y: GY + 2, w: 18, h: GY - sp.y - 4, a: 'built', b }); }
  }
  const benchProp = { id: 'jbench', k: 'p:jbench', x: BY.bench + 4, y: BACK + 5, w: 136, h: 62, a: 'jbench' };
  if (!PROPS.backyard.some(p => p.a === 'workbench' || /bench/.test(p.id))) PROPS.backyard.push(benchProp);
  document.addEventListener('DOMContentLoaded', () => { const L = PROPS.backyard; if (L.some(p => p !== benchProp && (p.a === 'workbench' || /bench/.test(p.id))) && L.includes(benchProp)) L.splice(L.indexOf(benchProp), 1); });   // another file brought its own bench
  function drawBench(p) {
    const c = E.ctx, x = Math.round(BY.bench - E.camX), y = p.y, cv = spr('bench'), n = lumberLeft();
    if (!rj() && !S.jeff) { const busy = E.t % 7 < 1.3; drawJeff(c, x - 52, y + 1, busy ? 'hammer' : 'idle', 1, E.t); }
    if (cv) c.drawImage(cv, x - (cv.width >> 1), y - cv.height); else { px(c, x - 40, y - 26, 80, 5, '#b98a52'); px(c, x - 36, y - 21, 4, 21, '#8a6238'); px(c, x + 32, y - 21, 4, 21, '#8a6238'); }
    for (let i = 0; i < n; i++) { const r = (i / 3) | 0, k = i % 3, X = x + 46 + k * 2 - (r % 2) * 3, Y = y - 5 - r * 5; px(c, X, Y, 24, 5, '#6b4423'); px(c, X + 1, Y, 22, 3, '#d9a868'); px(c, X + 1, Y + 3, 22, 1, '#b98448'); px(c, X + 20 - k * 6, Y + 1, 1, 1, '#8a5a2e'); }
    if (!n) emo(c, '🪵', x + 58, y - 12, 9, 0, 0.35);
  }
  // outdoor.js's plank pile beside the workbench (o_lumber: a sawhorse with a stack of planks) shows what is left: the stack sinks as planks
  // are used, is gone when they all are, and grows back when something is taken down
  const LUMB = {};
  function lumberPic(n) {
    if (LUMB[n]) return LUMB[n]; const src = spriteCanvas('o_lumber'); if (!src || src.width !== 72 || src.height !== 40) return null;     // only for the picture this was made for
    const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 72; c.height = 40;
    const stack = document.createElement('canvas'), sx = stack.getContext('2d'); stack.width = 72; stack.height = 40; sx.drawImage(src, 0, 0);
    sx.clearRect(0, 0, 72, 14); sx.clearRect(0, 14, 31, 3); sx.clearRect(0, 17, 16, 23);                       // the stack alone
    x.drawImage(src, 0, 0); x.clearRect(31, 14, 41, 26); x.clearRect(16, 17, 15, 23);                           // the sawhorse alone...
    const leg = (x0, y0, x1, y1, col) => { for (let y = y0; y <= y1; y++) { const X = Math.round(lerp(x0, x1, (y - y0) / (y1 - y0))); x.fillStyle = '#2b1a20'; x.fillRect(X - 1, y, 3, 1); x.fillStyle = col; x.fillRect(X, y, 1, 1); } };
    leg(23, 16, 19, 36, '#6e3b38'); leg(28, 16, 32, 39, '#ad6f50');                                            // ...with the two legs the full stack hides
    if (n > 0) x.drawImage(stack, 0, Math.round((1 - n / LUMBER) * 25));
    return (LUMB[n] = c);
  }
  function drawLumber(p) { const cv = lumberPic(clamp(lumberLeft(), 0, LUMBER)); if (!cv) return _dp(p); E.ctx.drawImage(cv, Math.round(p.x - E.camX) - (cv.width >> 1), Math.round(p.y) - cv.height); }
  const _dp = drawProp;
  drawProp = function (p) {
    if (p.th) return thProp(p);
    if (p === benchProp) return drawBench(p);
    if (p.id === 'lumber' && p.k === 'o_lumber' && G.room === 'backyard') return drawLumber(p);
    if (!p.bl) return _dp(p);
    if (p.bl === 1) drawBuilt(p);
  };
  // part: null = all of it; a finished tree house is drawn in two goes: its braces, ladder and tube with the other props ('back'),
  // and the house itself at the very end ('body', from late()) so the big trees' leaves never hide it
  function drawBuilt(p, part) {
    const c = E.ctx, b = p.b, sp = SPOTS[b.spot], cx = Math.round(p.x - E.camX);
    p.th2 = CATBY[b.kind].spot === 'tree' && !b._site;
    if (!part && p.th2) part = 'back';
    if (part !== 'body') { const near = !G.busy && !G.sceneOn && marina.state !== 'anim' && Math.abs(p.x - marina.x) < Math.max(30, p.w * 0.5 + 12); p.glow = clamp((p.glow || 0) + (near ? 0.08 : -0.06), 0, 1); }
    const bo = G.bounce && G.bounce.id === p.id && E.t - G.bounce.t0 < 0.35 ? Math.sin((E.t - G.bounce.t0) / 0.35 * Math.PI) * 0.1 : 0;
    c.save(); if (bo) { c.translate(cx, p.y); c.scale(1 + bo, 1 - bo); c.translate(-cx, -p.y); }
    drawThing(c, b, cx, p.y, E.t, Object.assign({ reveal: b._site ? b._site.k : 1, glow: p.glow, blur: E.scale * 4.5, ground: GY + 2, side: sp.side, br: sp.br, part }, sp.tree && sp.tree.id === 'pine' ? PINE : null));
    c.restore();
    if (S.jeff && S.jeff.b === b && !S.jeff.real && part !== 'body') drawJeff(c, S.jeff.x - E.camX, S.jeff.y, S.jeff.pose, S.jeff.dir, E.t);
  };
  const _pa = propActions;
  propActions = function (p) {
    if (p === benchProp) return [A('🔨', () => { const j = rj(); try { const a = j && j.here && entActions(j).find(a => a.ico === '🔨'); if (a) return a.fn(); } catch (e) { } open(); })];      // with Jeff standing there it is his own "let's build"
    if (p.th) return thActions(p);
    if (p.a !== 'built' || !p.bl) return _pa(p);
    const b = p.b, m = mainProp(b); if (b._site || S.act || !m) return [];
    return CATBY[b.kind].acts(m).concat([A('🎨', () => open({ edit: b })), A('🧹', () => UI.actions({ x: p.x, y: p.y - p.h - 4, prop: p }, [A('❓', () => takeDown(b))]))]);
  };
  // the two small "tools" choices on a built thing look a little different from the things to play
  const _ua = UI.actions;
  UI.actions = function (anchor, list) { _ua(anchor, list); if (anchor && anchor.prop && anchor.prop.a === 'built') document.querySelectorAll('#fx .act').forEach(n => { if (['🎨', '🧹', '❓'].includes(n.textContent)) n.classList.add('bd-sec'); }); };

  // ---------------------------------------------------------------- building, taking down, repainting
  function plankFly(x0, y0, x1, y1, dur, done) { const q = { x0, y0, x1, y1, t0: E.t, dur, arc: 30 + Math.random() * 30, rot: rnd(-1, 1), spin: rnd(4, 9) }; S.planks.push(q); run(dur, () => { }).then(() => { S.planks.splice(S.planks.indexOf(q), 1); done && done(); }); }
  const pileX = () => { const p = PROPS.backyard.find(p => p.id === 'lumber'); return p ? p.x : BY.bench + 50; };
  async function arrive(b) {            // the camera looks at the spot; Marina walks to where she can watch while Jeff walks over to work
    const sp = SPOTS[b.spot], R = ROOMS.backyard, tree = sp.type !== 'ground';
    G.busy = true; UI.closeActions(); if (marina.mount) dismount(); marina.stop(); if (marina.state !== 'idle') { marina.state = 'idle'; marina.anim = null; marina.offY = 0; }
    if (G.room !== 'backyard') changeRoom('backyard', null, clamp(sp.x - 70, 20, R.w - 20));
    focus(sp.x);
    const jx = sp.type === 'tree' ? sp.ladX - sp.side * 2 : sp.type === 'branch' ? sp.x - sp.side * 24 : sp.x + 46;
    const mx = clamp(sp.type === 'tree' ? sp.x + sp.side * 54 : sp.type === 'branch' ? sp.x + sp.side * 40 : sp.x - Math.min(74, E.viewW / 2 - 18), 14, R.w - 14);
    const [, J] = await Promise.all([walkTo(mx, FLOOR + (tree ? 6 : 4)).then(() => { marina.dir = Math.sign(sp.x - marina.x) || 1; }), jeffComes(b, jx)]);
    J.dir = Math.sign(sp.x - J.x) || 1; J.home = jx; return J;
  }
  function leave(J) { if (J) jeffDone(J); else freeJeff(); unfocus(); G.busy = false; }
  async function handHammer(J) {        // "Hand me that hammer, would you? ... Thanks, helper!" — she tosses it over
    J.dir = Math.sign(marina.x - J.x) || 1; marina.dir = -J.dir; J.pose = 'idle'; say('j_helper', J.real); await nap(1.05);
    playAnim('marina_reach', { fps: 12, proc: 'hug', dur: 0.5 }); Audio2.whoosh(true);
    const h = actor('🔨', marina.x + marina.dir * 10, FLOOR - 44, 12); await run(0.55, k => { h.x = lerp(marina.x + marina.dir * 10, J.x - J.dir * 4, k); h.y = lerp(FLOOR - 44, FLOOR - 52, k) - Math.sin(k * Math.PI) * 30; h.rot = k * 9; });
    gone(h); Audio2.blip(12, 'triangle', 0.06, 0.12); emit('star', J.x, FLOOR - 58, 4); if (marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; } cheer(700);
  }
  async function construct(b) {
    const sp = SPOTS[b.spot], c = CATBY[b.kind], p0 = propY(b), j = realJ(), helper = c.spot !== 'tree' && !!j && j.room === 'backyard' && chance(0.4);
    b._site = { k: 0 }; syncProps(); if (!helper) hook(c.spot === 'tree' ? 'treehouse' : 'start');
    let J = null;
    try {
      J = await arrive(b); if (helper && J.real) await handHammer(J);
      if (sp.type === 'tree') { J.y = sp.y + 34; emit('dust', J.x, FLOOR - 20, 6); }
      J.pose = 'hammer'; const dur = 3.5, top = () => p0 - c.h * b._site.k, from = Math.max(pileX(), sp.x - 160); let tb = 0, n = 0, sent = 0, ph = 0;
      await run(dur, (k, t, dt) => {
        b._site.k = clamp(ease(k) * 1.02, 0.03, 1); tb -= dt;
        if (tb <= 0) { tb = 0.15 + Math.random() * 0.07; n++; bang(n); chips(sp.x + rnd(-c.w * 0.35, c.w * 0.35), top(), 2); if (n % 3 === 0) emit('dust', sp.x + rnd(-c.w * 0.4, c.w * 0.4), top() + 4, 2); if (n % 7 === 3) saw(); }
        if (sent < c.cost && t > sent * dur * 0.75 / c.cost) { sent++; plankFly(from, top() - 50, sp.x + rnd(-c.w * 0.3, c.w * 0.3), top(), 0.55, () => { Audio2.blip(-19, 'triangle', 0.07, 0.2); emit('dust', sp.x, top(), 2); }); }
        if (sp.type === 'ground') { const q = k < 0.3 ? 0 : k < 0.55 ? 1 : k < 0.85 ? 2 : 3;                               // a time-lapse Jeff: this side, that side, on top, done
          if (q !== ph) { ph = q; emit('dust', J.x, J.y - 20, 5); Audio2.whoosh(q % 2 === 1); }
          if (q === 1) { J.x = sp.x - 30; J.y = FLOOR - 3; J.dir = 1; } else if (q === 2) { J.x = sp.x + 6; J.y = top() + 3; J.dir = -1; } else { J.x = J.home; J.y = FLOOR - 3; J.dir = -1; } }
      });
      delete b._site; J.pose = 'wave'; if (sp.type === 'ground') { J.x = J.home; J.y = FLOOR - 3; }
      Audio2.jingle([0, 4, 7, 12, 16, 19, 24], 0.08, 'triangle'); Audio2.sfx('chip_cheer', { vol: 0.6 });
      for (let i = -1; i <= 1; i++) emit('confetti', sp.x + i * 28, p0 - c.h - 6, 16); emit('star', sp.x, p0 - c.h * 0.6, 10); UI.bigIcon('🎉', 900);
      marina.state = 'cheer'; say(pick(['m_wow', 'm_yay', 'm_cool'])); hook('done'); got('build');
      await nap(1.9); if (marina.state === 'cheer') marina.state = 'idle';
      if (sp.type === 'tree') { J.pose = 'walk'; await run(0.5, k => { J.y = lerp(sp.y + 34, FLOOR - 3, k); }); }      // down the ladder again
    } catch (e) { warn('build', e); delete b._site; }
    finally { leave(J); }
  }
  async function takeDown(b) {
    if (G.busy || !D.builds.includes(b) || b._site) return; const sp = SPOTS[b.spot], c = CATBY[b.kind], p0 = propY(b);
    b._site = { k: 1 }; let J = null;
    try {
      J = await arrive(b); if (sp.type === 'tree') J.y = sp.y + 34; J.pose = 'hammer'; hook('down'); let tb = 0, n = 0, sent = 0; const to = Math.max(pileX(), sp.x - 160);
      await run(1.5, (k, t, dt) => { b._site.k = 1 - ease(k); const top = p0 - c.h * b._site.k; tb -= dt;
        if (tb <= 0) { tb = 0.13; n++; bang(n); emit('dust', sp.x + rnd(-c.w * 0.4, c.w * 0.4), top + 6, 2); }
        if (sent < c.cost && t > sent * 1.2 / c.cost) { sent++; plankFly(sp.x + rnd(-20, 20), top, to, top - 60, 0.6); } });
      remove(b); Audio2.sfx('thud', { vol: 0.7 }); emit('dust', sp.x, p0 - 6, 14); Audio2.jingle([7, 4, 0], 0.09, 'triangle'); J.pose = 'wave'; if (sp.type === 'tree') J.y = FLOOR - 3; say(pick(['m_bye', 'm_okay']));
      await nap(1.1);
    } catch (e) { warn('down', e); if (D.builds.includes(b)) remove(b); }
    finally { leave(J); }
  }
  function remove(b) { const i = D.builds.indexOf(b); if (i >= 0) D.builds.splice(i, 1); delete b._site; save(); syncProps(); }
  async function repaintShow(b) {       // after re-customising: a sparkle sweeps up it
    const sp = SPOTS[b.spot], c = CATBY[b.kind], p0 = propY(b); G.busy = true; if (G.room === 'backyard') focus(sp.x);
    await run(1.1, (k, t) => { for (let i = 0; i < 2; i++) emit('sparkle', sp.x + rnd(-c.w / 2, c.w / 2), p0 - c.h * k, 1); if (Math.floor(t * 9) !== Math.floor((t - 0.017) * 9)) Audio2.blip(Math.round(k * 12), 'triangle', 0.05, 0.1); });
    Audio2.jingle([7, 12, 16, 19], 0.07, 'triangle'); emit('star', sp.x, p0 - c.h * 0.5, 8); hook('recolor'); if (['idle', 'cheer'].includes(marina.state)) { cheer(1200); say(pick(['m_pretty', 'm_look', 'm_cool'])); }
    await nap(0.6); unfocus(); G.busy = false;
  }

  // ---------------------------------------------------------------- the build menu: catalogue → make it yours → where → ✅   (and "take something down")
  let M = null;
  const panel = () => document.getElementById('panel');
  const canBuild = c => c.cost <= lumberLeft() && freeSpots(c.spot).length > 0;
  const planks = (n, have) => { const d = mk('div', 'bd-cost'); for (let i = 0; i < n; i++) d.append(mk('i', 'bd-pl' + (have != null && i >= have ? ' miss' : ''))); return d; };
  // a little picture of a thing in her colours (for cards and buttons)
  function pic(b, W, H) {
    const cat = CATBY[b.kind], cv = document.createElement('canvas'), c = cv.getContext('2d'), s = clamp(96 / Math.max(cat.w, cat.h + (cat.hang ? 18 : 0)), 0.8, 2); W = W || 116; H = H || 116;
    cv.width = W * 2; cv.height = H * 2; c.imageSmoothingEnabled = false; c.setTransform(2 * s, 0, 0, 2 * s, W, (H - 5) * 2);
    drawThing(c, b, 0, 0, 0.6, { ground: 0, side: 1, br: cat.hang ? -cat.h - (cat.up || 16) : null, leaf: '#d99a2e' }); return cv;
  }
  const picImg = b => { const i = mk('img', 'pix'); i.draggable = false; try { i.src = pic(b).toDataURL(); } catch (e) { } return i; };
  function jeffFace(cv) {
    const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 30, 30);
    if (has('jeff')) { const v = visBox('jeff'); drawJeff(c, 15 - (v[0] + v[2]) / 2, 2 - v[1], 'idle', 1, 0); } else drawJeff(c, 16, 69, 'wave', 1, 0.9);
  }
  function open(opts) {
    opts = opts || {}; if (typeof marina === 'undefined' || G.busy || S.act) return;
    UI.closeActions(); S.opts = opts; const p = panel(); p.innerHTML = ''; p.classList.remove('hidden');
    const j = realJ(); if (j && j.here && !AI.held.has(j)) { holdJeff(j); j.dir = Math.sign(marina.x - j.x) || 1; }         // he waits by her while she chooses
    const top = mk('div', 'ptop'), x = press(mk('button', 'pbtn', '❌'), close), second = mk('button', 'pbtn'), jf = mk('div', 'bd-jeff', '<canvas width="60" height="60"></canvas><b>🙅</b>'), pile = mk('div', 'bd-pile'), body = mk('div', 'bd-body');
    x.setAttribute('aria-label', 'close'); press(second, () => { Audio2.blip(4, 'triangle', 0.06, 0.12); show(M.view === 'cat' ? 'down' : M.edit ? null : 'cat'); });
    top.append(x, second, mk('div', 'ttl', '🔨'), jf, pile); p.append(top, body);
    M = { want: null, edit: null, draft: null, view: null, body, second, pile, jeff: jf }; jeffFace(jf.firstChild);
    if (opts.edit && D.builds.includes(opts.edit)) custom(CATBY[opts.edit.kind], opts.edit); else { show('cat'); hook('hello'); Audio2.jingle([0, 7, 12], 0.06); }
  }
  function close() { const p = panel(); if (M) cancelAnimationFrame(M.raf); M = null; p.classList.add('hidden'); p.innerHTML = ''; document.querySelectorAll('.bd-fly').forEach(n => n.remove()); setMusic(); if (!S.jeff) freeJeff(); }
  function show(view) {
    if (!M) return; if (!view) return close(); cancelAnimationFrame(M.raf); M.view = view; M.body.innerHTML = '';
    M.second.textContent = view === 'cat' ? '🧹' : '◀️'; M.second.setAttribute('aria-label', view === 'cat' ? 'take something down' : 'back'); M.second.style.visibility = view === 'cat' && !D.builds.length ? 'hidden' : 'visible';
    pileDraw(); ({ cat: viewCat, cust: viewCust, down: viewDown })[view]();
  }
  function pileDraw() { const left = lumberLeft(), will = M.view === 'cust' && !M.edit ? CATBY[M.draft.kind].cost : 0; M.pile.innerHTML = ''; M.pile.setAttribute('aria-label', left + ' planks left');
    for (let i = 0; i < LUMBER; i++) M.pile.append(mk('i', 'bd-pl' + (i >= left ? ' used' : i >= left - will ? ' will' : ''))); }
  // ---- 1. the catalogue
  function viewCat() {
    const grid = mk('div', 'bd-grid'), left = lumberLeft(); M.want = null; M.edit = null;
    for (const c of CAT) { const ok = canBuild(c), card = mk('button', 'bd-card' + (ok ? '' : ' off')); card.setAttribute('aria-label', c.id + (ok ? '' : ' (not now)'));
      card.append(picImg({ kind: c.id, colour: c.col, style: stylesOf(c)[0][0], addons: [] }), planks(c.cost, left)); if (c.spot !== 'ground') card.append(mk('span', 'bd-tag', '🌳'));
      press(card, () => { if (canBuild(c)) { Audio2.blip(12, 'triangle', 0.07, 0.14); custom(c); } else refuse(c); }); grid.append(card); }
    M.body.append(grid);
  }
  function refuse(c) {          // not enough planks, or nowhere to put it: Jeff shakes his head, then shows what could come down
    M.want = c; const j = M.jeff; j.classList.remove('no'); void j.offsetWidth; j.classList.add('no'); Audio2.blip(-9, 'square', 0.12, 0.16); setTimeout(() => Audio2.blip(-13, 'square', 0.2, 0.16), 170); hook('full');
    setTimeout(() => { if (M && M.want === c && D.builds.length) show('down'); }, 950);
  }
  // ---- 2. make it yours
  function custom(c, edit) {
    M.edit = edit || null;
    M.draft = edit ? { kind: edit.kind, spot: edit.spot, colour: edit.colour, style: edit.style, addons: (edit.addons || []).slice() } : { kind: c.id, spot: freeSpots(c.spot)[0], colour: c.col, style: stylesOf(c)[0][0], addons: [] };
    show('cust');
  }
  function viewCust() {
    const d = M.draft, c = CATBY[d.kind], wrap = mk('div', 'bd-cust'), box = mk('div', 'bd-prevbox'), cv = mk('canvas', 'bd-prev'), opts = mk('div', 'bd-opts');
    box.append(cv); wrap.append(box, opts); M.body.append(wrap); M.cv = cv; M.pop = 0;
    const changed = n => { Audio2.blip(n, 'triangle', 0.07, 0.14); M.pop = performance.now(); fill(); };
    function fill() {
      const keep = M.map ? M.map.scrollLeft : null; opts.innerHTML = '';
      const cols = mk('div', 'bd-row bd-cols');
      for (const col of COLOURS) { const s = mk('button', 'bd-sw' + (d.colour === col ? ' sel' : '')); s.setAttribute('aria-label', col); s.style.background = col === 'rainbow' ? 'conic-gradient(#e8453c,#ff9a2e,#ffd23e,#4fba55,#2f8fe6,#8d55dc,#e8453c)' : CSS[col];
        press(s, () => { d.colour = col; changed(COLOURS.indexOf(col) * 2); }); cols.append(s); }
      const row = mk('div', 'bd-row'), sg = mk('div', 'bd-group'), ag = mk('div', 'bd-group');
      for (const [id, v] of stylesOf(c)) { const o = mk('button', 'bd-opt' + (d.style === id ? ' sel' : '')); o.setAttribute('aria-label', id);
        if (c.styleKind === 'emblem') o.textContent = v;
        else if (c.styleKind === 'spr') { const s = spr(v, d.colour); if (s) { const i = mk('img', 'pix'); i.src = s.toDataURL(); o.append(i); } else o.textContent = c.ico; }
        else { const k = document.createElement('canvas'); k.width = k.height = 22; const x = k.getContext('2d'); x.fillStyle = '#2f74dc'; x.fillRect(1, 1, 20, 20); repaint(k, d.colour, id); x.strokeStyle = '#2a2230'; x.strokeRect(0.5, 0.5, 21, 21); k.className = 'pix'; o.append(k); }
        press(o, () => { d.style = id; changed(7); }); sg.append(o); }
      for (const a of c.addons) { const o = mk('button', 'bd-opt' + (d.addons.includes(a) ? ' on' : ''), ADDON[a]); o.setAttribute('aria-label', a + (d.addons.includes(a) ? ' on' : ' off'));
        press(o, () => { const i = d.addons.indexOf(a); if (i >= 0) d.addons.splice(i, 1); else d.addons.push(a); changed(i >= 0 ? 2 : 14); }); ag.append(o); }
      row.append(sg, ag); opts.append(cols, row);
      const where = mk('div', 'bd-where'), ok = press(mk('button', 'pbtn go bd-ok', '✅'), apply); ok.setAttribute('aria-label', 'build it');
      if (!M.edit) { const map = M.map = mk('div', 'bd-map'), inner = mk('div', 'bd-mapin'), mc = mk('canvas', 'bd-mapcv'); M.mapcv = mc; inner.append(mc); map.append(inner); where.append(map);
        for (const id of freeSpots(c.spot)) { const sp = SPOTS[id], s = mk('button', 'bd-spot' + (d.spot === id ? ' sel' : ''), d.spot === id ? '' : '➕'); s.setAttribute('aria-label', 'spot ' + id);
          s.style.left = Math.round(sp.x * MAP.s) + 'px'; s.style.top = clamp(Math.round(((sp.type === 'ground' ? 122 : sp.type === 'tree' ? sp.tree.houseY - 20 : 108) - MAP.y0) * MAP.s) - 32, 0, MAP.h - 64) + 'px';
          press(s, () => { d.spot = id; changed(9); }); inner.append(s); }
        const sel = SPOTS[d.spot]; setTimeout(() => { if (M && M.map === map) map.scrollLeft = keep != null ? keep : sel.x * MAP.s - map.clientWidth / 2; }, 0); }
      else M.map = null;
      where.append(ok); opts.append(where); pileDraw();
    }
    fill();
    const loop = () => { if (!M || M.cv !== cv || !cv.isConnected) return; try { preview(cv, box); if (M.mapcv && M.mapcv.isConnected) mapDraw(M.mapcv); } catch (e) { warn('preview', e); return; } M.raf = requestAnimationFrame(loop); }; loop();
  }
  function preview(cv, box) {           // the live picture: the thing in her colours, in a little piece of the yard
    const d = M.draft, c = CATBY[d.kind], bw = box.clientWidth || 300, bh = box.clientHeight || 240, Hh = 150, Ww = Math.round(clamp(Hh * bw / bh, 110, 380));
    if (cv.width !== Ww * 2 || cv.height !== Hh * 2) { cv.width = Ww * 2; cv.height = Hh * 2; }
    const x = cv.getContext('2d'), t = performance.now() / 1000, g = 132, mid = Ww / 2; x.setTransform(2, 0, 0, 2, 0, 0); x.imageSmoothingEnabled = false;
    const sky = x.createLinearGradient(0, 0, 0, g); sky.addColorStop(0, '#74b8f0'); sky.addColorStop(1, '#d4ebfc'); x.fillStyle = sky; x.fillRect(0, 0, Ww, Hh);
    const r = srand(7); for (let i = -10; i < Ww + 20; i += 20) { x.fillStyle = ['#c8742a', '#d99a2e', '#a8502a', '#7f9a4a', '#e0b23c'][Math.floor(r() * 5)]; x.beginPath(); x.arc(i + 8, g - 20 - r() * 14, 13 + r() * 8, 0, 7); x.fill(); px(x, i + 6, g - 14, 4, 14, '#5b4030'); }
    px(x, 0, g - 4, Ww, Hh - g + 4, '#86ad55'); for (let i = 0; i < Ww / 3; i++) px(x, r() * Ww, g - 2 + r() * (Hh - g), 2, 1, r() < 0.5 ? '#789f4a' : '#9bbf63');
    const pop = clamp((performance.now() - M.pop) / 260, 0, 1), sq = pop < 1 ? Math.sin(pop * Math.PI) * 0.06 : 0; let cx = mid, by = g + 2, o = { ground: g + 4, side: 1 };
    if (c.spot !== 'ground') { const tx = c.spot === 'tree' ? mid : mid - 34; px(x, tx - 15, 0, 30, g + 3, '#6b4a32'); px(x, tx - 15, 0, 4, g + 3, 'rgba(255,255,255,.12)'); px(x, tx - 22, g, 44, 5, '#5a3d28');
      x.fillStyle = '#c9762c'; for (const [dx, dy, rr] of [[-46, 2, 30], [40, -4, 34], [0, -16, 32]]) { x.beginPath(); x.arc(tx + dx, dy, rr, 0, 7); x.fill(); }
      if (c.spot === 'tree') by = 100; else { cx = mid + 8; o.br = 58; by = c.up ? o.br + c.up + c.h : g - 10; } }
    x.save(); x.translate(cx, by); x.scale(1 + sq, 1 - sq); x.translate(-cx, -by); drawThing(x, d, cx, by, t, o); x.restore();
  }
  // the little map of the backyard for choosing where
  const MAP = { s: 0.64, y0: 36, h: 92 };
  function mapDraw(cv) {
    const W = Math.round(ROOMS.backyard.w * MAP.s), d = M.draft; if (cv.width !== W * 2) { cv.width = W * 2; cv.height = MAP.h * 2; cv.style.width = W + 'px'; cv.style.height = MAP.h + 'px'; cv.parentNode.style.width = W + 'px'; }
    const x = cv.getContext('2d'), t = performance.now() / 1000, RW = ROOMS.backyard.w; x.setTransform(2 * MAP.s, 0, 0, 2 * MAP.s, 0, -MAP.y0 * 2 * MAP.s); x.imageSmoothingEnabled = false;
    px(x, 0, 0, RW, 180, '#a9d6f5'); const r = srand(81); for (let i = -10; i < RW + 20; i += 22) { x.fillStyle = ['#c8742a', '#d99a2e', '#a8502a', '#7f9a4a', '#e0b23c'][Math.floor(r() * 5)]; x.beginPath(); x.arc(i + 10, 104 - r() * 20, 16 + r() * 10, 0, 7); x.fill(); }
    px(x, 0, 128, RW, 60, '#86ad55'); px(x, 0, 20, 150, 112, '#c9c2a4'); px(x, 146, 20, 5, 112, '#f4f2ea'); px(x, BY.door - 14, 70, 28, 62, '#f1f0ea'); px(x, BY.door - 10, 75, 20, 26, '#27303a');
    px(x, BY.bench - 40, 120, 80, 5, '#b98a52'); px(x, BY.bench - 36, 125, 5, 20, '#8a6238'); px(x, BY.bench + 31, 125, 5, 20, '#8a6238');
    for (const tr of BY.trees) { const big = tr.id === 'oak'; px(x, tr.x - tr.trunk / 2, 0, tr.trunk, 150, big ? '#6b4a32' : '#5c4030'); x.fillStyle = big ? '#c9762c' : '#3f6b3a'; for (const [dx, dy, rr] of big ? [[-50, 28, 40], [40, 22, 44], [0, 14, 40]] : [[0, 20, 32], [-24, 40, 22], [24, 44, 22]]) { x.beginPath(); x.arc(tr.x + dx, dy, rr, 0, 7); x.fill(); } }
    const all = D.builds.concat(M.edit || !d.spot ? [] : [Object.assign({ _new: 1 }, d)]);
    for (const b of all) { const sp = SPOTS[b.spot]; if (b._new) x.globalAlpha = 0.75 + Math.sin(t * 5) * 0.2; drawThing(x, b, sp.x, propY(b), t, { ground: GY + 2, side: sp.side, br: sp.br }); x.globalAlpha = 1; }
    if (!M.edit && d.spot) { const sp = SPOTS[d.spot]; emo(x, '👇', sp.x, Math.max(MAP.y0 + 14, propY(d) - CATBY[d.kind].h - 14 + Math.sin(t * 5) * 3), 20); }
  }
  function apply() {
    const d = M && M.draft, e = M && M.edit; if (!d) return;
    if (e) { Object.assign(e, { colour: d.colour, style: d.style, addons: d.addons.slice() }); save(); close(); repaintShow(e); return; }
    const c = CATBY[d.kind]; if (!d.spot || at(d.spot) || c.cost > lumberLeft()) { show('cat'); return refuse(c); }
    const b = { kind: d.kind, spot: d.spot, colour: d.colour, style: d.style, addons: d.addons.slice() }; if (c.id === 'treehouse') b.toys = ['🧸', '🦄', '⚽'];
    D.builds.push(b); save(); close(); construct(b);
  }
  // ---- 3. take something down (planks come back)
  function viewDown() {
    const w = M.want, grid = mk('div', 'bd-grid bd-downs'), left = lumberLeft();
    if (w) { const need = mk('div', 'bd-need'); need.append(picImg({ kind: w.id, colour: w.col, style: stylesOf(w)[0][0], addons: [] }), w.cost > left ? planks(w.cost, left) : mk('div', 'bd-nospot', (w.spot === 'ground' ? '🟩' : '🌳') + '<b>🚫</b>')); M.body.append(need); }
    const helps = b => !w || (w.cost > left ? true : SPOTS[b.spot].type === w.spot);                    // which ones would make room for what she wanted
    for (const b of D.builds) { const c = CATBY[b.kind], card = mk('button', 'bd-card bd-down' + (helps(b) ? '' : ' dim')); card.setAttribute('aria-label', 'take down the ' + c.id);
      card.append(picImg(b), planks(c.cost), mk('span', 'bd-broom', '🧹'));
      press(card, () => { if (card.classList.contains('sure')) return menuDown(b, card); grid.querySelectorAll('.sure').forEach(n => { n.classList.remove('sure'); n.querySelector('.bd-broom').textContent = '🧹'; n.setAttribute('aria-label', n.getAttribute('aria-label').replace(' — sure?', '')); });
        card.classList.add('sure'); card.querySelector('.bd-broom').textContent = '❓'; card.setAttribute('aria-label', card.getAttribute('aria-label') + ' — sure?'); Audio2.blip(2, 'square', 0.08, 0.14); });
      grid.append(card); }
    M.body.append(grid);
  }
  function menuDown(b, card) {
    const cost = CATBY[b.kind].cost, r0 = card.getBoundingClientRect(), r1 = M.pile.getBoundingClientRect(); card.classList.add('gone'); Audio2.whoosh(false); bang(1); setTimeout(() => bang(2), 120);
    for (let i = 0; i < cost; i++) { const f = mk('i', 'bd-pl bd-fly'); f.style.left = (r0.left + r0.width / 2 - 11) + 'px'; f.style.top = (r0.top + r0.height / 2) + 'px'; document.body.append(f);
      setTimeout(() => { f.style.left = (r1.left + r1.width / 2 - 11) + 'px'; f.style.top = (r1.top + r1.height / 2 - 4) + 'px'; }, 40 + i * 90); setTimeout(() => { f.remove(); Audio2.blip(i * 2, 'triangle', 0.06, 0.14); }, 500 + i * 90); }
    remove(b); hook('down');
    setTimeout(() => { if (!M) return; pileDraw(); const w = M.want; if (w && canBuild(w)) { Audio2.jingle([0, 7, 12], 0.07); custom(w); } else show(D.builds.length ? 'down' : 'cat'); }, 600 + cost * 90);
  }

  // ---------------------------------------------------------------- playing on the things he built
  // play() runs one little game: Marina is ours for a few seconds (G.busy), the camera watches the thing, and everything is put back afterwards
  async function play(p, fn, arg) {
    if (G.busy || S.act || !p) return; UI.closeActions(); if (marina.mount) dismount();
    G.busy = true; marina.stop(); marina.state = 'idle'; marina.anim = null; marina.offY = 0;
    const s0 = marina.scale, b = p.b; S.act = { p, b }; b._ = Object.assign({}, b.keep); focus(p.x);
    try { await fn(p, b, arg); } catch (e) { warn('play', e); }
    S.pose = null; S.fx.length = 0; S.actors.length = 0; b._ = Object.assign({}, b.keep);
    marina.offY = 0; marina.y = FLOOR; marina.rot = 0; marina.scale = s0; marina.squash = 1; if (!['idle', 'cheer'].includes(marina.state)) { marina.state = 'idle'; marina.anim = null; }
    S.act = null; unfocus(); G.busy = false;
  }
  S.actors = [];                                                                       // little emoji characters in the scene: { ch, x, y, size, rot, a }
  const drawActors = c => { for (const a of S.actors) if (!a.hide) emo(c, a.ch, a.x - E.camX, a.y, a.size || 12, a.rot || 0, a.a); };
  const actor = (ch, x, y, size) => { const a = { ch, x, y, size: size || 12 }; S.actors.push(a); return a; };
  const gone = a => { const i = S.actors.indexOf(a); if (i >= 0) S.actors.splice(i, 1); };
  const fly = (a, x1, y1, dur, arc) => { const x0 = a.x, y0 = a.y; return run(dur, k => { a.x = lerp(x0, x1, k); a.y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * (arc || 0); }); };
  const every = (t, dt, n) => Math.floor(t * n) !== Math.floor((t - dt) * n);          // true n times a second
  const P = o => (S.pose = Object.assign({ key: null, x: marina.x, y: FLOOR, s: 1 }, o));
  const msc = () => marina.scale;                                                      // her drawn size (64 px picture × this × pose.s)
  const hop = (x1, off1, dur, arc) => { const x0 = marina.x, o0 = marina.offY; return run(dur || 0.4, k => { marina.x = lerp(x0, x1, k); marina.offY = lerp(o0, off1, k) - Math.sin(k * Math.PI) * (arc == null ? 16 : arc); }); };
  const poseTo = (pose, x1, y1, dur, o) => { const x0 = pose.x, y0 = pose.y, s0 = pose.s, r0 = pose.rot || 0; o = o || {}; return run(dur, k => { const e = o.ease ? o.ease(k) : k; pose.x = marina.x = lerp(x0, x1, e); pose.y = lerp(y0, y1, e) - Math.sin(k * Math.PI) * (o.arc || 0); if (o.s != null) pose.s = lerp(s0, o.s, e); if (o.rot != null) pose.rot = lerp(r0, o.rot, e); if (o.a != null) pose.a = lerp(1, o.a, e); if (o.step) o.step(k); }); };
  const climbBlip = (k, t, dt) => { if (every(t, dt, 6)) Audio2.blip(Math.round(k * 10), 'triangle', 0.05, 0.1); };
  // the happy ending of every game: her cheer, a sticker, maybe the family's reaction, and (once her line is over) maybe Grandpa Jeff's
  const JCHEER = { climb: ['j_treetop', 'j_strong'], trampoline: ['j_strong', 'j_wow'], seesaw: ['j_giggle'], mud: ['j_giggle'], mudpie: ['j_giggle'], tire: ['j_giggle', 'j_wow'], lemonade: ['j_thanks'], picnic: ['j_food_good'], tea: ['j_food_good'] };
  const yay = (lines, ev, react) => { cheer(1200); const pr = say(pick(lines || ['m_yay', 'm_again'])); if (ev) got(ev); if (react && window.reactTo) reactTo(react, 1200);
    Promise.resolve(pr).then(() => setTimeout(() => jeffCheer(JCHEER[ev] || ['j_wow', 'j_giggle']), 250)).catch(() => { }); return nap(1.0); };
  // sitting on something that swings from (px, py) on a rope of length L, at angle a
  function seat(pose, px, py, L, a, drop) { const h = 64 * msc() * pose.s, sx = px - L * Math.sin(a), sy = py + L * Math.cos(a) + (drop || 0); pose.rot = a; pose.x = sx + h / 2 * Math.sin(a); pose.y = sy + h / 2 - h / 2 * Math.cos(a); marina.x = sx; }

  async function slideDown(p, b, flip) {
    const X = p.x, Y = p.y, lx = X - 37, tx = X - 13, ty = Y - 47, ex = X + 38, ey = Y - 2;
    await walkTo(lx - 2); const pose = P({ key: 'walk', x: lx, flip: false }); say('m_monkey');
    await run(1.1, (k, t, dt) => { pose.x = marina.x = lerp(lx, tx, k); pose.y = lerp(FLOOR, ty, k); pose.s = lerp(1, ON, k); climbBlip(k, t, dt); });
    pose.key = 'marina_sit'; pose.y = ty + 5; Audio2.jingle([7, 12], 0.07); await nap(0.45); Audio2.whoosh(false);
    await run(0.62, k => { const e = k * k; pose.x = marina.x = lerp(tx + 12, ex, e); pose.y = lerp(ty + 6, ey, e); pose.rot = flip ? 1.35 : 0.3; if (chance(0.5)) emit('sparkle', pose.x - 10, pose.y - 24, 1); });
    pose.key = null; await poseTo(pose, ex + 24, FLOOR, flip ? 0.6 : 0.35, { arc: flip ? 34 : 9, s: 1, rot: flip ? Math.PI * 2 : 0 });
    S.pose = null; emit('dust', marina.x, FLOOR, 8); Audio2.sfx('thud', { vol: 0.5 }); if (flip) emit('star', marina.x, FLOOR - 50, 6); await yay(['m_yay', 'm_again'], 'slide', 'brave');
  }
  async function swingHigh(p, b, jump) {
    const X = p.x - 18, PY = p.y - 72, L = 38, st = b._; await walkTo(X - 2); marina.dir = 1;
    const pose = P({ key: 'marina_sit', s: ON, flip: false }); st.sw = [0, null]; seat(pose, X, PY, L, 0, 3); say('m_swing'); let last = 0;
    const dur = jump ? 3.6 : 5.6;
    await run(dur, (k, t) => { const A = jump ? Math.min(0.9, 0.2 + t * 0.26) : Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.95 + 0.06, a = -A * Math.sin(t * 3.5); st.sw[0] = a; seat(pose, X, PY, L, a, 3);
      if (Math.sign(a) !== Math.sign(last) && A > 0.3) { Audio2.whoosh(a < 0); if (A > 0.7) emit('star', marina.x, pose.y - 60, 2); } last = a; });
    if (jump) {                         // let go at the front of the swing and fly
      const a0 = st.sw[0], sx = marina.x, sy = pose.y; pose.key = null; Audio2.whoosh(true); say('m_flip');
      run(1.6, (k, t) => { st.sw[0] = a0 * Math.cos(t * 3.5) * (1 - k); });
      await poseTo(pose, p.x + 62, FLOOR, 0.85, { arc: 46, s: 1, rot: Math.PI * 2, step: () => { if (chance(0.5)) emit('sparkle', pose.x, pose.y - 30, 1); } });
      S.pose = null; emit('dust', marina.x, FLOOR, 9); Audio2.sfx('thud', { vol: 0.5 }); emit('star', marina.x, FLOOR - 60, 6); await yay(['m_did_it', 'm_yay'], 'swing', 'brave');
    } else { S.pose = null; marina.x = X + 14; await yay(['m_yay', 'm_again'], 'swing'); }
  }
  async function seesaw(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 32); marina.dir = 1;
    const teddy = { ch: '🧸', dx: 25, dy: -21, size: 13 }; st.items = [teddy]; const pose = P({ key: 'marina_sit', s: ON, flip: false }); let was = 0; say('m_bounce');
    const set = u => { st.rot = 0.123 - u * 0.2; const th = -u * 0.2; pose.x = marina.x = X - 26 * Math.cos(th); pose.y = Y - 9 - 26 * Math.sin(th); pose.rot = th * 0.6; };
    await run(5.2, (k, t) => { const u = Math.sin(t * 3.6) * Math.min(1, t * 2); set(u);
      if (u > 0.93 && was <= 0.93) { Audio2.sfx('boing', { rate: 1.2, vol: 0.5 }); emit('dust', X - 28, Y, 3); teddy.dy = -21; }
      if (u < -0.93 && was >= -0.93) { Audio2.blip(-12, 'triangle', 0.08, 0.2); emit('dust', X + 28, Y, 3); }
      if (u < -0.5) pose.y -= (-u - 0.5) * 8; if (u > 0.5) teddy.dy = -21 - (u - 0.5) * 10; was = u; });
    // the last big bump sends teddy flying
    set(1); Audio2.sfx('boing', { rate: 0.8 }); Audio2.whoosh(true); await run(1.0, k => { teddy.dy = -21 - Math.sin(k * Math.PI) * 70; teddy.rot = k * Math.PI * 4; }); teddy.rot = 0; Audio2.blip(-7, 'triangle', 0.06, 0.2); emit('star', X + 26, Y - 30, 5);
    S.pose = null; st.rot = 0; marina.x = X - 34; await yay(['m_giggle', 'm_again'], 'seesaw');
  }
  const TREASURE = ['💎', '🦴', '🪙', '🐚', '🗝️', '🦖', '👑', '⭐', '🧲', '💍'];
  async function digTreasure(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 10, FLOOR + 6); marina.dir = 1; playAnim('marina_reach', { fps: 9, loop: true, proc: 'hug', dur: 2.3 });
    await run(2.3, (k, t, dt) => { st.hole = k; if (every(t, dt, 5)) { Audio2.noise(0.1, 0.2, 500); for (let i = 0; i < 4; i++) emit('dust', X + 12, Y - 18, 1, { col: pick(['#e9c46a', '#f3d684', '#c99a3e']), vx: rnd(-70, 30), vy: rnd(-95, -40), g: 260, life: 0.7, size: 2, grow: 0 }); } });
    marina.state = 'idle'; marina.anim = null; const f = pick(TREASURE), it = { ch: f, dx: 12, dy: -20, size: 5 }; st.items = [it]; Audio2.jingle([0, 4, 7, 12, 16], 0.07); emit('sparkle', X + 12, Y - 24, 14);
    await run(0.7, k => { it.dy = -20 - ease(k) * 36; it.size = 5 + ease(k) * 15; it.rot = Math.sin(k * 9) * 0.2; }); emit('star', X + 12, Y - 56, 6);
    cheer(1300); say(pick(['m_found', 'm_wow'])); got('treasure'); await nap(1.4);
  }
  async function sandCastle(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 40, FLOOR + 6); marina.dir = 1; playAnim('marina_reach', { fps: 9, loop: true, proc: 'hug', dur: 2.6 }); st.castle = 0.01;
    await run(2.6, (k, t, dt) => { st.castle = Math.min(0.99, k); if (every(t, dt, 4)) { Audio2.blip(-5 + Math.round(k * 9), 'triangle', 0.06, 0.14); emit('dust', X - 24, Y - 24, 2, { col: '#f3d684' }); } });
    st.castle = 1; b.keep = Object.assign(b.keep || {}, { castle: 1 }); marina.state = 'idle'; marina.anim = null; Audio2.jingle([0, 4, 7, 12], 0.07); emit('sparkle', X - 24, Y - 40, 12); await yay(['m_made', 'm_look', 'm_did_it'], 'sandcastle');
  }
  async function trampBounce(p, b, sky) {
    const X = p.x, top = p.y - 31 - FLOOR, st = b._, s0 = marina.scale, flips = ['marina_frontflip', 'marina_backflip', 'marina_starjump']; await walkTo(X - 46); marina.dir = 1;
    Audio2.whoosh(true); await hop(X, top, 0.4, 22); marina.scale = s0 * ON; say('m_bounce');
    for (let i = 0; i < (sky ? 3 : 5); i++) { const big = !sky && i >= 2, hgt = sky ? 28 + i * 12 : big ? 58 : 32; st.sy = 0.84; Audio2.sfx('boing', { rate: 0.85 + i * 0.08, vol: 0.7 }); await nap(0.08); st.sy = 1;
      if (big && frameCount(flips[i % 3])) playAnim(flips[i % 3], { fps: 14, proc: 'frontflip', dur: 0.72 }); else { marina.state = 'cheer'; marina.anim = null; }
      await run(0.72, k => { marina.offY = top - Math.sin(k * Math.PI) * hgt; }); if (big) emit('star', X, FLOOR + top - 60, 3); }
    if (sky) {                          // the giant bounce: up out of the top of the picture, a twinkle, and back down
      st.sy = 0.74; Audio2.sfx('boing', { rate: 0.6 }); await nap(0.12); st.sy = 1; Audio2.whoosh(true); marina.state = 'cheer';
      await run(0.5, k => { marina.offY = top - ease(k) * 240; emit('sparkle', X + rnd(-6, 6), FLOOR + marina.offY, 1); });
      const star = actor('🌟', X, 34, 4); Audio2.jingle([19, 24, 28], 0.1, 'sine'); await run(0.9, k => { star.size = 4 + Math.sin(k * Math.PI) * 22; star.rot = k * 3; }); gone(star);
      if (frameCount('marina_frontflip')) playAnim('marina_frontflip', { fps: 16, proc: 'frontflip', dur: 0.75 }); Audio2.whoosh(false);
      await run(0.75, k => { marina.offY = top - 240 * (1 - k * k); }); st.sy = 0.76; Audio2.sfx('boing', { rate: 0.7 }); emit('star', X, FLOOR + top - 20, 8); await nap(0.1); st.sy = 1; marina.state = 'cheer'; marina.anim = null; await run(0.5, k => { marina.offY = top - Math.sin(k * Math.PI) * 26; });
    }
    marina.state = 'idle'; marina.anim = null; marina.scale = s0; await hop(X + 48, 0, 0.4, 20); emit('dust', marina.x, FLOOR, 6); emit('confetti', X, FLOOR - 60, 18); Audio2.jingle([0, 4, 7, 12, 16], 0.07); await yay(['m_yay', 'm_again'], 'trampoline', 'strong');
  }
  // the castle: in through the door, up onto the wall
  async function castleUp(p) { const X = p.x, Y = p.y; await walkTo(X + 2); const pose = P({ key: 'walk', x: X + 2 }); Audio2.sfx('door_open', { vol: 0.5 }); await poseTo(pose, X + 2, Y - 2, 0.4, { s: 0.55, a: 0 }); pose.hide = true;
    for (let i = 0; i < 4; i++) { Audio2.blip(i * 3, 'triangle', 0.05, 0.1); await nap(0.13); }
    Object.assign(pose, { hide: false, a: 1, key: 'cheer', x: X + 1, y: Y - 40, s: 0.72 }); marina.x = X; emit('dust', X, Y - 46, 5); return pose; }
  async function castleOut(p, pose) { pose.hide = true; await nap(0.4); Object.assign(pose, { hide: false, key: 'walk', x: p.x + 2, y: p.y - 2, s: 0.55, a: 0 }); await poseTo(pose, p.x + 14, FLOOR, 0.4, { s: 1, a: 1 }); S.pose = null; }
  async function castleQueen(p, b) {
    const X = p.x, Y = p.y, pose = await castleUp(p), crown = actor('👑', X + 1, Y - 120, 12); Audio2.jingle([0, 0, 7, 7, 12, 12, 16], 0.11, 'square');
    await fly(crown, X + 1, Y - 88, 0.6); Audio2.blip(19, 'sine', 0.2, 0.15); emit('sparkle', X, Y - 88, 14); say(pick(['m_princess', 'm_pretty']));
    for (let i = 0; i < 4; i++) { emit('confetti', X + (i % 2 ? 26 : -26), Y - 86, 12); emit('heart', X + rnd(-20, 20), Y - 70, 1); await run(0.5, k => { pose.y = Y - 40 - Math.sin(k * Math.PI) * 5; crown.y = Y - 88 - Math.sin(k * Math.PI) * 5; }); }
    gone(crown); await castleOut(p, pose); await yay(['m_yay', 'm_happy'], 'castle');
  }
  async function castleDragon(p, b) {
    const X = p.x, Y = p.y, pose = await castleUp(p), dr = actor('🐉', X + 150, Y - 96, 26); pose.key = null; pose.flip = false;
    Audio2.jingle([-12, -11, -12, -11, -9], 0.14, 'sawtooth'); await run(1.5, (k, t) => { dr.x = lerp(X + 150, X + 58, ease(k)); dr.y = Y - 92 + Math.sin(t * 6) * 5; });
    for (let i = 0; i < 5; i++) emit('heart', X + 44 - i * 4, Y - 88, 1, { ch: '🔥', vx: -40, vy: rnd(-8, 8), life: 0.5, size: 9 }); Audio2.noise(0.4, 0.2, 500); UI.face('marina', 'surprised', 900); await nap(0.7);
    say('m_roar'); pose.key = 'cheer'; for (let i = 0; i < 3; i++) { emit('star', X + 10, Y - 84, 4, { vx: rnd(40, 110), vy: rnd(-30, 10), g: 0 }); Audio2.blip(-7 + i * 5, 'sawtooth', 0.2, 0.2); await nap(0.25); }
    dr.ch = '🐲'; Audio2.sfx('boing', { rate: 1.4 }); await run(0.5, k => { dr.rot = k * Math.PI * 2; dr.y = Y - 96 - Math.sin(k * Math.PI) * 14; }); dr.rot = 0;
    const gem = actor('💎', dr.x, dr.y + 10, 11); fly(gem, X + 40, FLOOR - 6, 0.7); Audio2.whoosh(true); await run(0.9, k => { dr.x = lerp(X + 58, X + 190, k * k); dr.y = Y - 96 - k * 30; dr.size = 26 - k * 12; }); gone(dr);
    Audio2.jingle([12, 16, 19, 24], 0.07); emit('sparkle', X + 40, FLOOR - 10, 12); await castleOut(p, pose); gone(gem); await yay(['m_did_it', 'm_yay'], 'castle', 'brave');
  }
  // the pirate ship: on deck she rocks with the ship
  function onDeck(pose, p, dx, dy) { const r = (p.b._.rot || 0), c = Math.cos(r), s = Math.sin(r); pose.x = p.x + dx * c - dy * s; pose.y = p.y + dx * s + dy * c; pose.rot = r; marina.x = pose.x; }
  async function shipSail(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X + 54); const pose = P({ key: null, flip: true }); Audio2.whoosh(true); await poseTo(pose, X + 34, Y - 49, 0.5, { arc: 20, s: 0.72 });
    say('m_ride'); const gull = actor('🕊️', X - 130, Y - 118, 11), isle = actor('🏝️', X - 170, Y - 26, 4), fin = actor('🐬', X - 60, Y + 8, 13); fin.hide = true; let jumped = false;
    Audio2.jingle([0, 5, 9, 12, 9, 5, 0, 5, 9, 12], 0.16, 'triangle');
    await run(6.2, (k, t, dt) => { const a = Math.sin(Math.min(1, Math.min(k, 1 - k) * 6) * Math.PI / 2); st.sea = a; st.rot = Math.sin(t * 1.9) * 0.055 * a; st.wheel = Math.sin(t * 2.3) * 1.3; st.dy = Math.sin(t * 3.1) * 1.5 * a; onDeck(pose, p, 34, -49);
      gull.x = X - 130 + t * 46; gull.y = Y - 118 + Math.sin(t * 5) * 4; isle.x = X - 170 + t * 20; isle.size = 4 + t * 3.4; isle.a = a;
      if (every(t, dt, 2.5)) { Audio2.noise(0.35, 0.05, 700); emit('water', X - 44 + rnd(-6, 6), Y - 8, 3, { vy: rnd(-70, -30), vx: rnd(-30, 10) }); }
      if (!jumped && k > 0.42) { jumped = true; fin.hide = false; Audio2.jingle([12, 14, 16, 19], 0.06, 'sine'); run(1.1, q => { fin.x = X - 70 + q * 46; fin.y = Y + 6 - Math.sin(q * Math.PI) * 34; fin.rot = -0.9 + q * 1.8; }).then(() => { fin.hide = true; emit('water', fin.x, Y - 4, 8, { vy: rnd(-80, -30) }); }); } });
    st.sea = 0; st.rot = 0; st.dy = 0; gone(gull); gone(isle); gone(fin); pose.rot = 0; await poseTo(pose, X + 58, FLOOR, 0.45, { arc: 16, s: 1 }); S.pose = null; emit('dust', marina.x, FLOOR, 6); await yay(['m_yay', 'm_cool'], 'pirate');
  }
  async function shipCannon(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 52); const pose = P({ key: null, flip: true }); Audio2.whoosh(true); await poseTo(pose, X - 14, Y - 37, 0.5, { arc: 22, s: 0.72 });
    for (let shot = 0; shot < 3; shot++) {
      for (let i = 0; i < 5; i++) { emit('sparkle', X - 30, Y - 46, 2); Audio2.blip(i * 2 + shot * 2, 'square', 0.04, 0.1); await nap(0.09); }
      Audio2.noise(0.5, 0.5, 90); Audio2.blip(-24, 'sawtooth', 0.3, 0.3); emit('smoke', X - 46, Y - 50, 5); run(0.4, k => { st.kick = 1 - k; st.rot = Math.sin(k * 14) * 0.03 * (1 - k); onDeck(pose, p, -14, -37); });
      const ball = actor('⚫', X - 46, Y - 50, 7), tx = X - 96 - shot * 12 + rnd(-10, 10), ty = Y - 104 + rnd(-10, 12); await fly(ball, tx, ty, 0.42, 14); gone(ball);
      Audio2.jingle([12, 16, 19], 0.05, 'triangle'); emit('confetti', tx, ty, 26); emit('star', tx, ty, 6); for (let i = 0; i < 5; i++) emit('heart', tx, ty, 1, { ch: pick(['💖', '⭐', '🎉', '✨']), vx: rnd(-60, 60), vy: rnd(-60, 20), g: 90, life: 1.1, size: 10 });
      if (shot === 0) say('m_wow'); pose.key = 'cheer'; await nap(0.5); pose.key = null; }
    Audio2.sfx('crowd_cheer', { vol: 0.35 }); st.rot = 0; pose.rot = 0; await poseTo(pose, X - 56, FLOOR, 0.45, { arc: 16, s: 1 }); S.pose = null; emit('dust', marina.x, FLOOR, 6); await yay(['m_yay', 'm_again'], 'pirate');
  }
  // the rocket: countdown, lift-off, a trip through space (or to the moon), and home again
  async function rocketFly(p, b, mode) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X + 1); const pose = P({ key: 'walk', x: X + 1 }); Audio2.sfx('door_open', { vol: 0.5 }); await poseTo(pose, X + 1, Y - 4, 0.4, { s: 0.5, a: 0 }); pose.hide = true; st.pilot = 1;
    for (let i = 0; i < 3; i++) { UI.bigIcon(['3️⃣', '2️⃣', '1️⃣'][i], 480); Audio2.blip(i * 3, 'square', 0.18, 0.2); await run(0.6, (k, t) => { st.rot = Math.sin(t * 50) * 0.008 * (i + 1); }); }
    say('m_vroom'); Audio2.whoosh(true); Audio2.sfx('rumble', { vol: 0.8 }); UI.bigIcon('🚀', 800); st.fire = 1; st.rot = 0;
    await run(1.5, k => { st.dy = -k * k * 250; st.rot = Math.sin(k * 60) * 0.01; for (let i = 0; i < 2; i++) emit('smoke', X + rnd(-14, 14), Y - 2 + Math.min(0, st.dy + 30), 1, { col: 'rgba(235,235,240,.7)' }); emit('heart', X + rnd(-8, 8), Y + st.dy + 4, 1, { ch: pick(['🔥', '✨']), vx: rnd(-20, 20), vy: rnd(30, 80), life: 0.5, size: 8 }); });
    const sp = { a: 0, t0: E.t, mode, by: 128, land: 0, girl: null, flag: 0, b }; S.fx.push(c => space(c, sp)); await run(0.5, k => { sp.a = k; });
    const hum = (t, dt) => { if (every(t, dt, 3)) Audio2.blip(-19 + Math.sin(t * 2) * 2, 'sawtooth', 0.3, 0.035); };
    if (mode === 'moon') {
      await run(1.0, (k, t, dt) => { hum(t, dt); }); await run(1.4, (k, t, dt) => { sp.land = ease(k); hum(t, dt); }); sp.fireOff = true; Audio2.sfx('thud', { vol: 0.5 }); Audio2.jingle([0, 7, 12, 19], 0.12, 'sine');
      const g = sp.girl = { x: -2, y: 0, rot: 0 }; await run(0.5, k => { g.x = -2 - k * 40; g.y = -Math.sin(k * Math.PI) * 16; });
      for (let i = 0; i < 3; i++) { Audio2.blip(7 + i * 5, 'sine', 0.35, 0.14); const x0 = g.x; await run(0.85, k => { g.x = x0 + (i === 1 ? 26 : -13) * k; g.y = -Math.sin(k * Math.PI) * (34 + i * 8); g.rot = i === 2 ? k * Math.PI * 2 : 0; }); }
      Audio2.jingle([12, 16, 19, 24], 0.08); sp.flag = 1; UI.bigIcon('🌙', 700); await nap(0.9); const x0 = g.x; await run(0.6, k => { g.x = lerp(x0, -2, k); g.y = -Math.sin(k * Math.PI) * 20; }); sp.girl = null; sp.fireOff = false; Audio2.whoosh(true);
      await run(1.3, (k, t, dt) => { sp.land = 1 - ease(k); hum(t, dt); });
    } else { let n = 0; await run(4.6, (k, t, dt) => { hum(t, dt); if (every(t, dt, 0.9)) { n++; Audio2.blip([12, 16, 19, 14, 21][n % 5], 'sine', 0.3, 0.1); } if (!sp.ufo && k > 0.55) { sp.ufo = E.t; Audio2.jingle([24, 19, 24, 19, 26], 0.07, 'square'); } }); }
    await run(0.5, k => { sp.a = 1 - k; }); S.fx.length = 0; Audio2.whoosh(false);
    await run(1.4, k => { const e = 1 - (1 - k) * (1 - k); st.dy = -250 * (1 - e); if (k > 0.5) emit('smoke', X + rnd(-14, 14), Y - 2, 1, { col: 'rgba(235,235,240,.7)' }); });
    st.dy = 0; st.fire = 0; Audio2.sfx('thud', { vol: 0.7 }); emit('dust', X, Y, 12); await nap(0.3); st.pilot = 0; Object.assign(pose, { hide: false }); await poseTo(pose, X + 16, FLOOR, 0.4, { s: 1, a: 1 }); pose.a = 1; S.pose = null;
    emit('star', marina.x, FLOOR - 60, 8); await yay(['m_wow', 'm_cool', 'm_again'], 'rocket', 'brave');
  }
  function space(c, sp) {               // the view out in space: stars rushing past, planets, the rocket with her face at the window
    const W = E.viewW, t = E.t - sp.t0, a = sp.a, cx = Math.round(W / 2), top = -(E.offY || 0) / E.scale, mid = (top + SH) / 2, b = sp.b, keep = b._;
    c.save(); c.globalAlpha = a; const g = c.createLinearGradient(0, top, 0, SH); g.addColorStop(0, '#0b0b2a'); g.addColorStop(1, '#2a1a5a'); c.fillStyle = g; c.fillRect(-10, -40, W + 20, SH + 80);
    const r = srand(11), speed = 1 - sp.land * 0.96; sp.scroll = (sp.scroll || 0) + E.dt * 90 * speed;
    for (let i = 0; i < 70; i++) { const x = r() * W, y = ((r() * 240 + sp.scroll * (0.3 + r())) % 240) - 30, tw = 0.5 + 0.5 * Math.sin(t * 3 + i); c.fillStyle = 'rgba(255,250,210,' + (0.4 + 0.6 * tw).toFixed(2) + ')'; c.fillRect(Math.round(x), Math.round(y), i % 9 ? 1 : 2, i % 9 ? 1 + Math.round(speed * 3) : 2); }
    if (sp.mode !== 'moon') { [['🪐', 0.24, 0.6, 30], ['🌍', 0.78, 1.7, 26], ['☄️', 0.3, 2.8, 20], ['🌙', 0.72, 3.6, 24]].forEach(([ch, fx, at, size]) => { const k = (t - at) / 2.6; if (k > 0 && k < 1) emo(c, ch, W * fx + Math.sin(k * 3) * 6, top - 30 + k * (SH - top + 70), size, k * 0.6); });
      if (sp.ufo) { const k = (E.t - sp.ufo) / 1.6; if (k < 1) emo(c, '🛸', W * (1.1 - k * 1.2), mid - 34 + Math.sin(k * 16) * 8, 20, Math.sin(k * 16) * 0.2); } }
    else emo(c, '🌍', W * 0.78, top + 30, 24);
    const by = lerp(mid + 44, SH - 30, sp.land) + Math.sin(t * 5) * 2 * speed, mx = cx + 20;
    if (sp.land > 0) { const my = SH + 40 - sp.land * 70; c.fillStyle = '#b9bcc6'; c.beginPath(); c.ellipse(cx, my + 60, W * 0.9, 62, 0, 0, 7); c.fill(); c.fillStyle = '#9a9daa'; for (const [dx, dy, rr] of [[-60, 14, 9], [34, 20, 12], [84, 8, 6], [-110, 24, 7], [-12, 30, 5]]) { c.beginPath(); c.ellipse(cx + dx, my + dy, rr, rr * 0.4, 0, 0, 7); c.fill(); }
      if (sp.flag) { px(c, mx - 62, my - 22, 1, 24, '#e8e8ee'); px(c, mx - 61, my - 22, 11, 7, paintAt(b.colour, 0)); } }
    b._ = { pilot: sp.girl ? 0 : 1, fire: sp.fireOff ? 0 : 1 }; drawThing(c, { kind: b.kind, colour: b.colour, style: b.style, addons: [], _: b._ }, mx, Math.round(by), E.t, {}); b._ = keep;
    if (sp.girl) { const m = spriteCanvas(mBase(), mOpt()), s = 0.8; if (m) { c.save(); c.translate(mx + sp.girl.x, by + sp.girl.y - m.height * s / 2); c.rotate(sp.girl.rot); c.drawImage(m, -m.width * s / 2, -m.height * s / 2, m.width * s, m.height * s); c.restore(); } }
    c.restore();
  }

  async function wallClimb(p, b) {
    const X = p.x, Y = p.y; await walkTo(X - 8); const pose = P({ key: 'walk', x: X - 8, flip: false }); say('m_monkey');
    await run(1.9, (k, t, dt) => { pose.x = marina.x = X + Math.sin(k * Math.PI * 3) * 8; pose.y = lerp(FLOOR, Y - 30, k); pose.s = lerp(1, ON, k); climbBlip(k, t, dt); });
    const bell = actor('🔔', X, Y - 71, 11); for (let i = 0; i < 2; i++) { Audio2.blip(24, 'sine', 0.5, 0.2); Audio2.blip(31, 'sine', 0.6, 0.1); emit('note', X + rnd(-8, 8), Y - 80); emit('sparkle', X, Y - 72, 6); await run(0.42, k => { bell.rot = Math.sin(k * Math.PI * 2) * 0.6; }); } gone(bell);
    await poseTo(pose, X, Y - 84, 0.5, { s: 0.72 }); pose.key = 'cheer'; emit('confetti', X, Y - 120, 20); Audio2.jingle([0, 4, 7, 12, 16], 0.07); say('m_did_it'); await nap(1.3);
    pose.key = null; Audio2.whoosh(false); await poseTo(pose, X + 44, FLOOR, 0.8, { arc: 30, s: 1, rot: Math.PI * 2 }); S.pose = null; emit('dust', marina.x, FLOOR, 8); Audio2.sfx('thud', { vol: 0.5 }); await yay(['m_yay', 'm_again'], 'climb', 'strong');
  }
  async function zipRide(p, b, hero) {
    const X = p.x, Y = p.y, st = b._, x0 = X - 13, y0 = Y - 70, x1 = X + 46, y1 = Y - 24, K1 = 0.84, cab = hx => lerp(y0, y1, (hx - x0) / (x1 - x0));
    await walkTo(X - 50); const pose = P({ key: 'walk', x: X - 47, flip: false }); say('m_monkey');
    await run(1.2, (k, t, dt) => { pose.x = marina.x = lerp(X - 47, X - 32, k); pose.y = lerp(FLOOR, Y - 55, k); pose.s = lerp(1, 0.62, k); climbBlip(k, t, dt); });
    pose.key = null; await poseTo(pose, X - 22, Y - 55, 0.25); await nap(0.2);
    const hang = (hx, a) => { const hy = cab(hx) + 6, k = msc() * pose.s; pose.rot = a; pose.x = hx - 29 * k * Math.sin(a); pose.y = hy + 29 * k * Math.cos(a) + 40 * k; marina.x = hx; };
    st.riding = true; pose.key = 'marina_hang'; hang(x0 + 5, 0); Audio2.jingle([0, 4, 7], 0.06); await nap(0.4); say(hero ? 'm_cool' : 'm_yay'); Audio2.whoosh(false);
    if (hero) S.fx.push(c => { const x = pose.x - E.camX, y = pose.y - 40 * msc() * pose.s, f = Math.sin(E.t * 22) * 3; c.fillStyle = '#e8453c'; c.beginPath(); c.moveTo(x - 2, y - 10); c.lineTo(x - 30 - f, y - 2 + f); c.lineTo(x - 24, y + 10 - f); c.lineTo(x - 4, y + 4); c.fill(); });
    const lean = hero ? 1.15 : 0.3;
    await run(1.25, (k, t, dt) => { const e = k * k * K1; st.zip = e; hang(lerp(x0 + 5, x1 - 7, e), lean * Math.min(1, k * 5) + Math.sin(t * 9) * 0.04); if (every(t, dt, 14)) emit(hero ? 'star' : 'sparkle', marina.x - 8, pose.y - 34, 1); if (every(t, dt, 8)) Audio2.noise(0.08, 0.05 + k * 0.1, 1500 + k * 2500); });
    Audio2.sfx('boing', { rate: 1.3, vol: 0.6 }); const hx = lerp(x0 + 5, x1 - 7, K1); await run(0.35, k => hang(hx, lerp(lean, -0.7, k)));
    S.fx.length = 0; st.riding = false; pose.key = null; pose.rot = 0; pose.x = hx + 8; pose.y = cab(hx) + 46;
    await poseTo(pose, x1 + 26, FLOOR, 0.45, { arc: 14, s: 1, rot: hero ? Math.PI * 2 : 0 }); S.pose = null; emit('dust', marina.x, FLOOR, 8); Audio2.sfx('thud', { vol: 0.5 }); run(0.9, k => { st.zip = K1 * (1 - k); });
    await yay(['m_yay', 'm_again'], 'zip', 'brave');
  }
  const hopIn = (a, x0, x1, y, dur, hops) => run(dur, k => { a.x = lerp(x0, x1, k); a.y = y - Math.abs(Math.sin(k * Math.PI * hops)) * 6; });
  async function behind(p, dx) { await walkTo(p.x + 42, DEPTH_MIN); await walkTo(p.x + (dx || 0), DEPTH_MIN); marina.y = DEPTH_MIN; marina.dir = 1; }     // round the side and in behind it
  async function lemonadeShop(p, b) {
    const X = p.x, Y = p.y, s0 = marina.scale, gy = FLOOR - 1; await behind(p, -9); marina.scale = s0 * 0.9; marina.offY = 4; say('m_mix');
    playAnim('marina_reach', { fps: 10, loop: true, proc: 'hug', dur: 1.4 }); await run(1.4, (k, t, dt) => { if (every(t, dt, 5)) { emit('heart', X - 10, Y - 36, 1, { ch: '🍋', vx: rnd(-30, 30), vy: rnd(-60, -30), g: 200, life: 0.7, size: 8 }); Audio2.blip(pick([7, 9, 12, 14]), 'triangle', 0.06, 0.12); } });
    marina.state = 'idle'; marina.anim = null; emit('sparkle', X + 10, Y - 40, 10);
    for (const ch of ['🐿️', '🦔', '🐰', '🦊', '🐥', '🦌'].sort(() => Math.random() - 0.5).slice(0, 3)) {
      const a = actor(ch, X + 120, gy, 16); await hopIn(a, X + 120, X + 44, gy, 0.8, 4); Audio2.blip(pick([7, 9, 12]), 'triangle', 0.08, 0.14);
      const cup = actor('🥤', X + 8, Y - 34, 9); await fly(cup, X + 38, gy - 10, 0.35, 14); for (let i = 0; i < 3; i++) { Audio2.blip(-2 - i * 2, 'sine', 0.07, 0.15); a.rot = -0.25; await nap(0.1); a.rot = 0; await nap(0.06); }
      gone(cup); emit('heart', a.x, a.y - 14, 3); const coin = actor('🪙', a.x, a.y - 10, 8); await fly(coin, X - 2, Y - 32, 0.35, 22); gone(coin); Audio2.jingle([19, 24], 0.06, 'square'); emit('sparkle', X - 2, Y - 32, 4);
      hopIn(a, X + 44, X - 110, gy + 6, 1.1, 5).then(() => gone(a)); await nap(0.35); }
    await nap(0.7); marina.scale = s0; marina.offY = 0; await walkTo(X + 42, FLOOR); await yay(['m_did_it', 'm_yay'], 'lemonade', 'helper');
  }
  async function lemonadeDrink(p, b) {
    const X = p.x, Y = p.y; await walkTo(X + 36); marina.dir = -1; const cup = actor('🥤', X + 8, Y - 34, 9); await fly(cup, X + 28, FLOOR - 44, 0.4, 12);
    playAnim('marina_eat', { fps: 7, proc: 'hug', dur: 1.5 }); for (let i = 0; i < 4; i++) { Audio2.blip(-2 - i * 2, 'sine', 0.08, 0.16); await nap(0.3); } gone(cup); marina.state = 'idle'; marina.anim = null;
    say('m_yummy'); emit('heart', marina.x, FLOOR - 70, 3); await nap(1.1); Audio2.sfx('burp1', { rate: 1.8, vol: 0.5 }); emit('heart', marina.x - 8, FLOOR - 56, 1, { ch: '💨', vx: -14, vy: -10, life: 0.9, size: 9 }); await nap(0.5); Audio2.voice('m_giggle', 'm'); cheer(900); got('lemonade'); await nap(0.8);
  }
  async function picnic(p, b, tea) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 34, FLOOR + 2); const pose = P({ key: 'marina_sit', x: X - 32, y: Y - 13, s: ON, flip: false }); marina.x = X - 32; st.items = [];
    if (tea) {
      const fr = [{ ch: '🧸', dx: 8, dy: -36, size: 1 }, { ch: '🐰', dx: 26, dy: -36, size: 1 }]; st.items.push(...fr); for (const f of fr) { Audio2.sfx('boing', { rate: 1.5, vol: 0.4 }); await run(0.3, k => { f.size = 1 + ease(k) * 12; }); }
      say('m_tea'); const pot = actor('🫖', X - 6, Y - 52, 12);
      for (let i = 0; i < 3; i++) { const dx = -8 + i * 13; await fly(pot, X + dx - 6, Y - 48, 0.3, 4); pot.rot = 0.6; Audio2.sfx('sink', { rate: 1.7, vol: 0.3 }); for (let j = 0; j < 6; j++) emit('water', X + dx, Y - 42, 1); await nap(0.45); pot.rot = 0; st.items.push({ ch: '☕', dx, dy: -33, size: 8 }); Audio2.blip(12 + i * 4, 'sine', 0.2, 0.12); }
      gone(pot); await nap(0.3); for (let i = 0; i < 3; i++) { Audio2.blip(24, 'sine', 0.15, 0.1); Audio2.blip(28, 'sine', 0.15, 0.08); fr.forEach((f, n) => { f.rot = (i + n) % 2 ? 0.2 : -0.2; }); emit('heart', X + 16, Y - 50, 2); await nap(0.5); }
      await yay(['m_yummy', 'm_happy'], 'tea');
    } else {
      const food = ['🥪', '🍎', '🧃', '🍪', '🍓', '🧀', '🍉'].sort(() => Math.random() - 0.5).slice(0, 3), its = []; say('m_snack');
      for (let i = 0; i < 3; i++) { const it = { ch: food[i], dx: 10, dy: -40, size: 3 }; st.items.push(it); its.push(it); Audio2.blip(7 + i * 4, 'triangle', 0.08, 0.14); const tx = -10 + i * 9 + (i === 2 ? 18 : 0); await run(0.3, k => { it.dx = lerp(10, tx, k); it.dy = -40 + ease(k) * 7 - Math.sin(k * Math.PI) * 8; it.size = 3 + ease(k) * 7; }); }
      for (const it of its.slice(0, 2)) { const dx0 = it.dx, dy0 = it.dy; await run(0.3, k => { it.dx = lerp(dx0, -27, k); it.dy = lerp(dy0, -46, k); it.size = 10 - k * 5; }); st.items.splice(st.items.indexOf(it), 1); Audio2.sfx('eat_chomp', { vol: 0.5, rate: 1.2 }); emit('dust', X - 27, Y - 46, 2, { col: '#e8c27a', g: 200 }); await nap(0.45); }
      const ants = [0, 1, 2].map(i => actor('🐜', X + 80 + i * 10, FLOOR + 8, 7)), last = its[2]; await run(1.4, (k, t) => ants.forEach((a, i) => { a.x = lerp(X + 80 + i * 10, X + 20 + i * 9, k); a.y = FLOOR + 8 + Math.sin(t * 20 + i) * 0.8; }));
      const crumb = actor(last.ch, X + last.dx, Y + last.dy, 9); st.items.splice(st.items.indexOf(last), 1); Audio2.jingle([12, 9, 12, 9], 0.07, 'triangle'); await fly(crumb, X + 30, FLOOR + 2, 0.4, 6); UI.face('marina', 'surprised', 900);
      await run(1.3, (k, t) => { ants.forEach((a, i) => { a.x = lerp(X + 20 + i * 9, X + 130 + i * 9, k); a.y = FLOOR + 8 + Math.sin(t * 20 + i) * 0.8; }); crumb.x = ants[1].x; crumb.y = FLOOR + 1; }); ants.forEach(gone); gone(crumb);
      await yay(['m_giggle', 'm_yummy'], 'picnic');
    }
    S.pose = null; marina.x = X - 44;
  }
  async function puppetShow(p, b, pair) {
    const X = p.x, Y = p.y, st = b._; await behind(p); S.pose = { hide: true };
    const pa = { ch: pair[0], dx: -8, dy: -30, size: 1 }, pb = { ch: pair[1], dx: 8, dy: -30, size: 1 }; st.items = [pa, pb];
    const cy = FLOOR + 4, crowd = ['🐿️', '🐰', '🦔'].map((ch, i) => actor(ch, X + 130 + i * 20, cy, 13)); await Promise.all(crowd.map((a, i) => hopIn(a, a.x, X - 26 + i * 26, cy, 0.8, 4)));
    const up = (q, on) => run(0.3, k => { const e = on ? ease(k) : 1 - ease(k); q.dy = -30 - e * 15; q.size = 1 + e * 13; });
    const talk = async (q, n, base) => { for (let i = 0; i < n; i++) { Audio2.blip(base + pick([0, 2, 4, 7]), 'square', 0.07, 0.12); q.rot = (i % 2 ? 1 : -1) * 0.28; q.dy = -45 - (i % 2) * 2; await nap(0.14); } q.rot = 0; };
    Audio2.jingle([0, 4, 7, 12], 0.09); await up(pa, true); await talk(pa, 5, 12); Audio2.sfx('boing', { rate: 1.3, vol: 0.5 }); await up(pb, true); await talk(pb, 5, 0); await talk(pa, 3, 12);
    for (let i = 0; i < 3; i++) { await run(0.24, k => { pa.dx = -8 + Math.sin(k * Math.PI) * 9; }); Audio2.blip(-5, 'square', 0.05, 0.2); emit('star', X + 6, Y - 48, 2); pb.rot = 0.6; await nap(0.12); pb.rot = 0; if (i === 1) Audio2.voice('m_giggle', 'm'); }
    emit('heart', X, Y - 52, 5); Audio2.jingle([7, 12, 16, 19], 0.08, 'triangle'); await run(0.9, k => { pa.rot = Math.sin(k * 12) * 0.22; pb.rot = -Math.sin(k * 12) * 0.22; pa.dx = -8 + k * 3; pb.dx = 8 - k * 3; });
    Audio2.sfx('crowd_cheer', { vol: 0.3 }); for (const a of crowd) emit('heart', a.x, a.y - 12, 2); await run(1.0, k => crowd.forEach((a, i) => { a.y = cy - Math.abs(Math.sin(k * Math.PI * 3 + i)) * 7; }));
    await Promise.all([up(pa, false), up(pb, false)]); st.items = []; crowd.forEach((a, i) => hopIn(a, a.x, a.x - 150, cy, 1.1, 5).then(() => gone(a)));
    S.pose = null; await walkTo(X + 42, FLOOR); await yay(['m_did_it', 'm_look'], 'puppet', 'artist');
  }
  const mudBits = (x, y, n, sp) => { for (let i = 0; i < n; i++) emit('dust', x, y, 1, { col: pick(['#6b4a2c', '#8a623a', '#4f3520']), vx: rnd(-sp, sp), vy: rnd(-sp * 1.5, -sp * 0.5), g: 260, life: 0.75, size: 2, grow: 0 }); };
  async function mudPie(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 18, FLOOR + 4); marina.dir = 1; playAnim('marina_reach', { fps: 10, loop: true, proc: 'hug', dur: 2.4 }); say('m_mix');
    await run(2.4, (k, t, dt) => { if (every(t, dt, 5)) { Audio2.noise(0.12, 0.22, 180); mudBits(X - 6, Y - 34, 3, 50); } });
    marina.state = 'idle'; marina.anim = null; const pie = { ch: '🥧', dx: 14, dy: -38, size: 3 }; st.items = [pie]; Audio2.jingle([0, 4, 7], 0.08); await run(0.4, k => { pie.size = 3 + ease(k) * 11; }); emit('steam', X + 14, Y - 46, 3);
    const bug = actor('🪰', X + 50, Y - 80, 7); run(2.6, (k, t, dt) => { bug.x = X + 14 + Math.cos(t * 7) * (16 - k * 8); bug.y = Y - 52 + Math.sin(t * 9) * 8; if (every(t, dt, 9)) Audio2.blip(-19, 'sawtooth', 0.05, 0.03); }).then(() => gone(bug));
    await nap(0.9); say('m_stinky'); await nap(1.5); Audio2.voice('m_giggle', 'm'); await yay(['m_made', 'm_look'], 'mudpie');
  }
  async function mudSplash(p, b) {
    const X = p.x + 4, py = FLOOR + 9; S.fx.push(c => { c.fillStyle = '#6b4a2c'; c.beginPath(); c.ellipse(X - E.camX, py, 24, 5, 0, 0, 7); c.fill(); c.fillStyle = '#8a623a'; c.beginPath(); c.ellipse(X - 4 - E.camX, py - 1, 12, 2, 0, 0, 7); c.fill(); });
    await walkTo(X - 30, FLOOR + 6); marina.dir = 1; await hop(X, 0, 0.45, 24); say('m_bounce');
    for (let i = 0; i < 4; i++) { Audio2.noise(0.18, 0.35, 150); Audio2.sfx('boing', { rate: 0.8 + i * 0.1, vol: 0.4 }); mudBits(X, py - 2, 14, 70 + i * 12); marina.squash = 0.86; await nap(0.08); marina.squash = 1; marina.state = 'cheer'; await hop(X, 0, 0.5, 20 + i * 6); }
    Audio2.noise(0.25, 0.4, 120); mudBits(X, py - 2, 26, 110); marina.state = 'idle'; await nap(0.3); await hop(X + 34, 0, 0.4, 14); await yay(['m_giggle', 'm_again'], 'mud');
  }
  async function fairyDust(p, b) {
    const X = p.x, Y = p.y, home = [-14, 14, 0]; await walkTo(X - 42, FLOOR + 6); marina.dir = 1; playAnim('marina_reach', { fps: 9, loop: true, proc: 'hug', dur: 1.5 }); say('m_fairy');
    await run(1.5, (k, t, dt) => { emit('sparkle', X + rnd(-30, 30), Y - rnd(4, 46), 1); if (every(t, dt, 7)) Audio2.blip(pick([12, 16, 19, 24, 28]), 'sine', 0.25, 0.08); });
    marina.state = 'idle'; marina.anim = null; const fs = home.map(dx => actor('🧚', X + dx, Y - 12, 3)); Audio2.jingle([12, 16, 19, 24, 28, 31], 0.09, 'sine');
    await run(4.4, (k, t, dt) => { fs.forEach((f, i) => { const out = Math.min(1, k * 3.5), away = Math.max(0, (k - 0.84) / 0.16), ang = t * 2.6 + i * 2.1, cx = lerp(X + home[i], marina.x, out), cy = lerp(Y - 12, FLOOR - 64, out);
        f.x = lerp(cx + Math.cos(ang) * 22 * out, X + home[i], away); f.y = lerp(cy + Math.sin(ang * 1.3) * 13 * out, Y - 12, away); f.size = 3 + 10 * Math.min(1, k * 5) * (1 - away * 0.8); if (chance(0.3)) emit('sparkle', f.x, f.y, 1); });
      if (every(t, dt, 2.2)) Audio2.blip(pick([24, 28, 31, 36]), 'sine', 0.3, 0.06); });
    fs.forEach(gone); emit('heart', marina.x, FLOOR - 70, 5); await yay(['m_pretty', 'm_wow'], 'fairy');
  }
  async function fairyWater(p, b) {
    const X = p.x, Y = p.y, st = b._; await walkTo(X - 42, FLOOR + 6); marina.dir = 1; playAnim('marina_reach', { fps: 9, loop: true, proc: 'hug', dur: 1.7 }); Audio2.sfx('sink', { rate: 1.5, vol: 0.35 });
    await run(1.7, () => { for (let i = 0; i < 2; i++) emit('water', X + rnd(-30, 30), Y - 50 + rnd(0, 10), 1); });
    marina.state = 'idle'; marina.anim = null; const fl = [-38, -24, -6, 10, 26, 38].map((dx, i) => ({ ch: ['🌷', '🌼', '🌸', '🌻', '🌷', '🌼'][i], dx, dy: 1 - (i % 2) * 3, size: 1 })); st.items = fl;
    for (const f of fl) { Audio2.blip(12 + fl.indexOf(f) * 2, 'sine', 0.2, 0.1); await run(0.22, k => { f.size = 1 + ease(k) * 9; f.dy -= 0.2; }); }
    b.keep = Object.assign(b.keep || {}, { items: fl }); const bf = actor('🦋', X + 120, Y - 80, 10); await run(1.8, (k, t) => { bf.x = lerp(X + 120, X + 10, k); bf.y = lerp(Y - 80, Y - 16, k) + Math.sin(t * 9) * 5; bf.rot = Math.sin(t * 12) * 0.3; }); emit('heart', X + 10, Y - 24, 3); await yay(['m_pretty', 'm_look'], 'garden', 'kind'); gone(bf);
  }
  async function goalKick(p, b, flip) {
    const X = p.x, Y = p.y, st = b._, bx = X + 64, tx = X + 4, ty = Y - 26; focus(X + 34); await walkTo(bx + 34); marina.dir = -1; const ball = actor('⚽', bx, FLOOR - 4, 9); await nap(0.25); await walkTo(bx + 12);
    if (flip && frameCount('marina_backflip')) { playAnim('marina_backflip', { fps: 18, proc: 'backflip', dur: 0.7 }); await nap(0.35); }
    Audio2.blip(-10, 'square', 0.06, 0.3); Audio2.noise(0.05, 0.3, 300); emit('dust', bx, FLOOR, 4); if (flip) Audio2.whoosh(true);
    await run(flip ? 0.8 : 0.5, k => { ball.x = lerp(bx, tx, k); ball.y = lerp(FLOOR - 4, ty, k) - Math.sin(k * Math.PI) * (flip ? 66 : 22); ball.rot = -k * 14; if (flip) emit('sparkle', ball.x, ball.y, 1); });
    if (marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; }
    run(0.3, k => { st.sx = 1 - Math.sin(k * Math.PI) * 0.07; }); run(0.45, k => { ball.x = tx - 10 * k; ball.y = lerp(ty, Y - 5, k * k); });
    Audio2.sfx('crowd_cheer', { vol: 0.5 }); UI.bigIcon('⚽', 800); emit('confetti', X, Y - 50, 30); emit('star', tx, ty, 6); Audio2.jingle([0, 4, 7, 12, 7, 12, 16], 0.08); await yay(['m_did_it', 'm_yay'], 'goal', 'strong'); gone(ball);
  }
  async function tireSwing(p, b, spin) {
    const X = p.x, Y = p.y, sp = SPOTS[b.spot], st = b._, L = Y - 14 - sp.br; await walkTo(X - sp.side * 20); marina.dir = sp.side;
    const pose = P({ key: null, flip: sp.side < 0 }); Audio2.whoosh(true); await poseTo(pose, X, Y - 8, 0.4, { arc: 14, s: 0.72 }); pose.key = 'marina_sit'; say(spin ? 'm_spin' : 'm_swing'); let last = 0, ph = 0;
    await run(spin ? 4.2 : 5, (k, t, dt) => { const env = Math.sin(Math.min(1, k * 1.1) * Math.PI);
      if (spin) { ph += dt * (3 + env * 15); st.sx = Math.cos(ph); pose.sx = Math.cos(ph) || 0.01; st.rot = Math.sin(t * 2) * 0.08; seat(pose, X, sp.br, L, st.rot, 6); if (every(t, dt, 6)) Audio2.blip(Math.round(env * 12), 'triangle', 0.04, 0.08); }
      else { const a = (env * 0.6 + 0.05) * Math.sin(t * 3.2); st.rot = a; seat(pose, X, sp.br, L, a, 6); if (Math.sign(a) !== Math.sign(last) && env > 0.4) Audio2.whoosh(a < 0); last = a; } });
    st.rot = 0; st.sx = null; pose.sx = 1; pose.key = null; pose.rot = 0; await poseTo(pose, X - sp.side * 26, FLOOR, 0.4, { arc: 10, s: 1 }); S.pose = null;
    if (spin) { const dz = actor('💫', marina.x, FLOOR - 76, 13); UI.face('marina', 'surprised', 1000); await run(1.1, (k, t) => { dz.x = marina.x + Math.cos(t * 9) * 10; dz.y = FLOOR - 76 + Math.sin(t * 9) * 3; marina.rot = Math.sin(t * 10) * 0.08; }); marina.rot = 0; gone(dz); Audio2.voice('m_giggle', 'm'); }
    await yay(['m_yay', 'm_again'], 'tire');
  }
  async function birdFeed(p, b) {
    const X = p.x, sp = SPOTS[b.spot], d = sp.side; await walkTo(X - d * 24); marina.dir = d; playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.6 });
    for (let i = 0; i < 16; i++) emit('dust', marina.x + d * 8, FLOOR - 40, 1, { col: '#f0d060', vx: d * rnd(10, 70), vy: rnd(-70, -20), g: 220, life: 0.9, size: 2, grow: 0 }); Audio2.noise(0.2, 0.1, 3000); await nap(0.6); marina.state = 'idle'; marina.anim = null;
    const birds = [0, 1, 2, 3].map(i => actor(pick(['🐦', '🐤', '🐥']), X + d * (150 + i * 20), 24 + i * 12, 11));
    await Promise.all(birds.map((bd, i) => nap(0.01 + i * 0.25).then(() => { Audio2.blip(pick([24, 26, 28, 31]), 'sine', 0.08, 0.1); return fly(bd, X + d * (6 + i * 13), FLOOR + 4 + (i % 2) * 5, 0.9, 20); })));
    await run(2.2, (k, t, dt) => { birds.forEach((bd, i) => { bd.rot = Math.max(0, Math.sin(t * 9 + i * 2)) * 0.5; }); if (every(t, dt, 4)) Audio2.blip(pick([24, 26, 28, 31, 33]), 'sine', 0.06, 0.09); });
    birds[0].rot = 0; await fly(birds[0], marina.x, FLOOR - 76, 0.5, 18); emit('heart', marina.x, FLOOR - 86, 4); Audio2.jingle([28, 31, 33, 36], 0.07, 'sine'); UI.face('marina', 'happy', 1200); await nap(1.3);
    await Promise.all(birds.map((bd, i) => fly(bd, bd.x - d * 160, -12, 0.9 + i * 0.1, 10))); birds.forEach(gone); await yay(['m_giggle', 'm_happy'], 'birds', 'kind');
  }
  async function birdSong(p, b) {
    const X = p.x, sp = SPOTS[b.spot], st = b._; await walkTo(X - sp.side * 30); marina.dir = sp.side;
    const bs = [{ ch: '🐤', dx: 0, dy: -37, size: 1 }, { ch: '🐦', dx: -11, dy: -20, size: 1 }, { ch: '🐥', dx: 10, dy: -11, size: 1 }]; st.items = bs;
    for (const q of bs) { Audio2.blip(26 + bs.indexOf(q) * 3, 'sine', 0.08, 0.1); await run(0.2, k => { q.size = 1 + ease(k) * 9; }); }
    marina.state = 'cheer'; const tune = [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0];
    for (let i = 0; i < tune.length; i++) { const q = bs[i % 3]; Audio2.blip(12 + tune[i], 'sine', 0.22, 0.14); emit('note', X + q.dx + rnd(-4, 4), p.y + q.dy - 8); await run(i % 7 === 6 ? 0.5 : 0.26, k => { q.size = 10 + Math.sin(k * Math.PI) * 4; q.rot = Math.sin(k * Math.PI) * 0.3; }); }
    emit('heart', X, p.y - 44, 4); const off = bs.map(q => actor(q.ch, X + q.dx, p.y + q.dy, 10)); st.items = []; await Promise.all(off.map((a, i) => fly(a, a.x + sp.side * 140, -14, 0.8 + i * 0.12, 12))); off.forEach(gone); await yay(['m_happy', 'm_pretty'], 'birds');
  }

  // ---------------------------------------------------------------- tree houses: a real little room up in the tree, reached only by the ladder
  const TH = id => 'treehouse_' + id, thOf = room => { const t = ROOMS[room] && ROOMS[room].treehouse; return t ? at(t) : null; };
  const T = { bellT: 0, bucket: null, nap0: 0, napT: 0, sat: 0, toyOut: null, slots: [82, 116, 150] };      // what is going on inside right now
  for (const t of BY.trees) {
    ROOMS[TH(t.id)] = { name: TH(t.id), ico: '🏡', w: TH_W, treehouse: t.id, left: null, right: null, windows: [] };
    PROPS[TH(t.id)] = [
      { id: 'th_bell', th: 1, k: 'p:th_bell', x: 14, y: 86, w: 22, h: 50, a: 'th_bell' },
      { id: 'th_bucket', th: 1, k: 'p:th_bucket', x: 45, y: 86, w: 24, h: 52, a: 'th_bucket' },
      { id: 'th_wall', th: 1, k: 'p:th_wall', x: 116, y: 98, w: 96, h: 50, a: 'th_wall' },
      { id: 'th_lamp', th: 1, k: 'p:th_lamp', x: 248, y: 80, w: 24, h: 38, a: 'th_lamp' },
      { id: 'th_scope', th: 1, k: 'p:th_scope', x: 244, y: BACK + 4, w: 28, h: 52, a: 'th_scope' },
      { id: 'th_shelf', th: 1, k: 'p:th_shelf', x: 278, y: BACK + 3, w: 42, h: 62, a: 'th_shelf' },
      { id: 'th_bean', th: 1, k: 'p:th_bean', x: 112, y: BACK + 9, w: 44, h: 24, a: 'th_bean' },
      { id: 'th_hatch', th: 1, k: 'p:th_hatch', x: 36, y: 160, w: 46, h: 32, a: 'th_hatch' },
    ];
  }
  // the room strip and the map know about a tree house only while one is built
  const treeFloor = { id: 'tree', level: null, get rooms() { return BY.trees.filter(t => { const b = at(t.id); return b && b.kind === 'treehouse' && !b._site; }).map(t => TH(t.id)); }, get strip() { return ['pool', 'yard', 'backyard'].filter(r => ROOMS[r]).concat(this.rooms); } };
  function syncFloor() { if (typeof Floors === 'undefined') return; const i = Floors.list.indexOf(treeFloor), need = treeFloor.rooms.length > 0; if (need && i < 0) Floors.list.push(treeFloor); else if (!need && i >= 0) Floors.list.splice(i, 1); }
  if (typeof Floors !== 'undefined') Floors.hooks.push((was, room) => {
    if (was === 'backyard' || thOf(was)) { S.cam = null; }
    if (ROOMS[room] && ROOMS[room].treehouse && !D.seen.treehouse) { D.seen.treehouse = 1; save(); got('treehouse'); setTimeout(() => { if (!G.busy) say('m_wow'); }, 700); }
  });
  const _sm = setMusic; setMusic = function () { _sm(); if (ROOMS[G.room] && ROOMS[G.room].treehouse && Audio2.Music.mode === 'explore') Audio2.Music.set('fort'); };

  // ---- up the ladder and in; back down by the ladder or the tube slide
  async function climbUp(p) {
    const b = p.b, sp = SPOTS[b.spot], top = sp.y - DECK + 2; if (G.busy || S.act) return; UI.closeActions(); if (marina.mount) dismount(); G.busy = true; S.act = { p, b };
    try { await walkTo(sp.ladX); focus(sp.x); const pose = P({ key: 'walk', x: sp.ladX, flip: sp.side < 0 }); say('m_monkey'); setTimeout(() => jeffCheer(['j_tree'], sp.x), 1300);
      await run(2.0, (k, t, dt) => { pose.y = lerp(FLOOR, top, k); pose.s = lerp(1, 0.5, k); pose.x = sp.ladX + Math.sin(t * 9); climbBlip(k, t, dt); });
      await poseTo(pose, sp.x, top, 0.5); Audio2.sfx('door_open', { vol: 0.5 }); await poseTo(pose, sp.x, top - 1, 0.3, { s: 0.36, a: 0 });
    } catch (e) { warn('climb', e); }
    S.pose = null; S.act = null; unfocus(); marina.offY = 0; marina.y = FLOOR; marina.state = 'idle';
    changeRoom(TH(b.spot), null, 66); marina.dir = 1; marina.offY = 18; await run(0.4, k => { marina.offY = 18 * (1 - k) - Math.sin(k * Math.PI) * 10; }); marina.offY = 0; emit('dust', 50, FLOOR, 4); G.busy = false;
  }
  async function tubeDown(b, pose) {    // whoosh down inside the tube and pop out at the bottom
    const sp = SPOTS[b.spot], st = b._ = b._ || {}; pose.hide = true; Audio2.whoosh(false); say('m_ride');
    await run(1.5, (k, t, dt) => { st.tube = k; if (every(t, dt, 9)) Audio2.blip(12 - Math.round(k * 12), 'triangle', 0.05, 0.12); });
    st.tube = null; Object.assign(pose, { hide: false, key: 'marina_sit', x: sp.x, y: GY - 2, s: 0.7, rot: 0 }); marina.x = sp.x; Audio2.sfx('boing', { rate: 1.2, vol: 0.5 }); emit('star', sp.x, GY - 10, 5);
    await poseTo(pose, sp.x - sp.side * 12, FLOOR + 6, 0.4, { arc: 14, s: 1 }); S.pose = null; emit('dust', marina.x, FLOOR, 8); await yay(['m_yay', 'm_again'], 'slide', 'brave');
  }
  async function tubeRide(p, b) {
    const sp = SPOTS[b.spot], top = sp.y - DECK + 2; await walkTo(sp.ladX); const pose = P({ key: 'walk', x: sp.ladX, flip: sp.side < 0 });
    await run(1.6, (k, t, dt) => { pose.y = lerp(FLOOR, top, k); pose.s = lerp(1, 0.5, k); climbBlip(k, t, dt); }); await poseTo(pose, sp.x, top, 0.4); await tubeDown(b, pose);
  }
  async function climbDown(slide) {
    const b = thOf(G.room), hx = 36; if (G.busy) return; UI.closeActions(); G.busy = true; T.nap0 = T.napT = 0;
    await walkTo(hx + 4); Audio2.whoosh(false); await run(0.4, k => { marina.offY = k * 24; marina.x = lerp(hx + 4, hx, k); }); marina.offY = 0; G.busy = false;
    if (!b || !D.builds.includes(b)) return changeRoom('backyard', null, BY.trees[0].x - 40);
    const sp = SPOTS[b.spot]; changeRoom('backyard', null, slide ? sp.x : sp.ladX); const p = mainProp(b);
    if (slide) return play(p, async () => { await tubeDown(b, P({ hide: true })); });
    play(p, async () => { const top = sp.y - DECK + 2, pose = P({ key: 'walk', x: sp.ladX, y: top, s: 0.5, flip: sp.side > 0 });
      await run(1.7, (k, t, dt) => { pose.y = lerp(top, FLOOR, k); pose.s = lerp(0.5, 1, k); pose.x = sp.ladX + Math.sin(t * 9); if (every(t, dt, 6)) Audio2.blip(Math.round(10 - k * 10), 'triangle', 0.05, 0.1); }); S.pose = null; emit('dust', marina.x, FLOOR, 5); });
  }

  // ---- the room, drawn by code in the colour and roof she chose
  const poly = (pts, col) => { const c = E.ctx; c.fillStyle = col; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(Math.round(q[0] - E.camX), q[1]) : c.moveTo(Math.round(q[0] - E.camX), q[1]))); c.closePath(); c.fill(); };
  const WIN = { x: 170, y: 38, w: 68, h: 58 };
  const _drb = drawRoomBG;
  drawRoomBG = function (room) { if (!ROOMS[room] || !ROOMS[room].treehouse) return _drb(room); try { thBG(thOf(room) || { colour: 'blue', style: 'gable', addons: [] }); } catch (e) { if (!thBG.warned) { thBG.warned = 1; warn('room', e); } } };
  function thBG(b) {
    const c = E.ctx, W = TH_W, night = !!b.lamp, t = E.t, pas = PASTEL[b.colour], wood = '#7a5636', dark = '#5a3d26', col = CSS[b.colour] || CSS.blue;
    const g = c.createLinearGradient(0, 0, 0, SH); if (night) { g.addColorStop(0, '#0d1238'); g.addColorStop(1, '#2c2c60'); } else { g.addColorStop(0, '#6db3ee'); g.addColorStop(1, '#cfe7fb'); } c.fillStyle = g; c.fillRect(-10, -40, E.viewW + 20, SH + 60);
    const r = srand(5); for (let i = 0; i < 46; i++) { const x = r() < 0.5 ? -90 + r() * 96 : W - 6 + r() * 96, y = r() * SH; c.fillStyle = night ? ['#33264a', '#3f2c50', '#2a2140'][i % 3] : ['#c9762c', '#d99a2e', '#a8502a', '#e0b23c'][i % 4]; c.beginPath(); c.arc(Math.round(x - E.camX), y, 14 + r() * 12, 0, 7); c.fill(); }
    rect(-3, 0, W + 6, SH, dark);                                                                                        // the outside of the walls
    for (let x = 0, i = 0; x < W; x += 12, i++) rect(x, 0, 12, WALL_Y, pas ? pas[i % 2] : ['#f6c9c4', '#fbdcb8', '#fbf0b8', '#cfe8c4', '#c3dcf2', '#ddd0f0'][i % 6]);
    for (let x = 12; x < W; x += 12) rect(x, 0, 1, WALL_Y, 'rgba(90,60,40,.16)'); const kn = srand(9); for (let i = 0; i < 16; i++) rect(kn() * W, 30 + kn() * 100, 2, 1, 'rgba(90,60,40,.22)');
    // the ceiling follows the roof she picked
    if (b.style === 'round') { c.fillStyle = wood; c.beginPath(); c.moveTo(-E.camX, 0); c.lineTo(W - E.camX, 0); c.lineTo(W - E.camX, 44); c.quadraticCurveTo(W / 2 - E.camX, 4, -E.camX, 44); c.fill(); for (let i = 1; i < 6; i++) rect(i * W / 6 - 1, 0, 3, 44 - Math.sin(i / 6 * Math.PI) * 20, dark); }
    else if (b.style === 'fort') { rect(0, 0, W, 30, wood); for (let x = 8; x < W; x += 30) rect(x, 0, 8, 34, dark); rect(0, 30, W, 2, dark); }
    else { const ry = x => 42 - (1 - Math.abs(x - W / 2) / (W / 2)) * 20;
      if (b.style === 'tent') for (let i = 0; i < 12; i++) { const x0 = i * W / 12, x1 = x0 + W / 12; poly([[x0, 0], [x1, 0], [x1, ry(x1)], [x0, ry(x0)]], i % 2 ? '#f4f2ea' : col); }
      else { poly([[0, 0], [W, 0], [W, 42], [W / 2, 22], [0, 42]], wood); for (let i = 1; i < 8; i++) { const x = i * W / 8; rect(x - 1, 0, 3, ry(x), dark); } }
      c.strokeStyle = dark; c.lineWidth = 3; c.beginPath(); c.moveTo(-E.camX, 42); c.lineTo(W / 2 - E.camX, 22); c.lineTo(W - E.camX, 42); c.stroke(); }
    thWindow(b, night, t);
    rect(0, WALL_Y - 4, W, 4, wood); rect(0, WALL_Y, W, SH - WALL_Y, '#b98a55'); const fr = srand(31);
    for (let y = WALL_Y; y < SH; y += 8) { rect(0, y, W, 1, '#94693c'); for (let k = 0; k < 7; k++) rect(fr() * W, y, 1, 8, '#94693c'); rect(fr() * W, y + 4, 20 + fr() * 30, 1, 'rgba(255,235,200,.25)'); }
    c.fillStyle = b.colour === 'rainbow' ? '#ff9a2e' : DARK[b.colour]; c.beginPath(); c.ellipse(Math.round(176 - E.camX), 166, 56, 10, 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(Math.round(176 - E.camX), 166, 49, 8, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(Math.round(176 - E.camX), 166, 34, 5, 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(Math.round(176 - E.camX), 166, 26, 3.5, 0, 0, 7); c.fill();   // a round rug
    rect(0, 0, 5, WALL_Y, dark); rect(W - 5, 0, 5, WALL_Y, dark);
    if ((b.addons || []).includes('lights')) for (let i = 0; i < 22; i++) { const x = 10 + i * (W - 20) / 21, y = (b.style === 'fort' ? 38 : b.style === 'round' ? 48 - Math.sin(i / 21 * Math.PI) * 26 : 46 - (1 - Math.abs(x - W / 2) / (W / 2)) * 18) + Math.sin(i * 1.7) * 2, lit = Math.sin(t * 3 + i * 1.9) > -0.4;
      rect(x, y - 3, 1, 3, '#3b3340'); if (lit) { c.globalAlpha = night ? 0.5 : 0.25; rect(x - 3, y - 2, 7, 7, BULB[i % 5]); c.globalAlpha = 1; } rect(x - 1, y, 3, 3, lit ? BULB[i % 5] : '#8d8798'); }
  }
  function thWindow(b, night, t) {       // the big window: sky, treetops, and far away the sea and the lighthouse, because it is so high
    const c = E.ctx, { x, y, w, h } = WIN, X = Math.round(x - E.camX), frame = '#6b4423', sea = y + Math.round(h * 0.5);
    rect(x - 4, y - 4, w + 8, h + 8, frame); c.save(); c.beginPath(); c.rect(X, y, w, h); c.clip();
    const g = c.createLinearGradient(0, y, 0, y + h); if (night) { g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#3a3a78'); } else { g.addColorStop(0, '#5aa8f0'); g.addColorStop(0.6, '#d8eefc'); } c.fillStyle = g; c.fillRect(X, y, w, h);
    if (night) { const r = srand(3); for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(255,250,210,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))).toFixed(2) + ')'; c.fillRect(X + Math.floor(r() * w), y + Math.floor(r() * h * 0.5), 1, 1); } c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(X + 15, y + 12, 6, 0, 7); c.fill(); c.fillStyle = '#0d1436'; c.beginPath(); c.arc(X + 18, y + 10, 5, 0, 7); c.fill(); }
    else { for (let i = 0; i < 2; i++) { const cx = X + ((t * (2 + i) + i * 46) % (w + 40)) - 20, cy = y + 8 + i * 9; c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(Math.round(cx), cy, 14, 4); c.fillRect(Math.round(cx) + 3, cy - 2, 7, 2); }
      for (let i = 0; i < 2; i++) { const bx = X + w - ((t * 9 + i * 30) % (w + 30)), by = y + 16 + i * 6 + Math.sin(t * 2 + i) * 2, f = Math.sin(t * 10 + i) > 0 ? 1 : 0; c.fillStyle = '#3a3a44'; c.fillRect(Math.round(bx), Math.round(by), 2, 1); c.fillRect(Math.round(bx) - 1, Math.round(by) - f, 1, 1); c.fillRect(Math.round(bx) + 2, Math.round(by) - f, 1, 1); } }
    c.fillStyle = night ? '#1c2a5a' : '#4a8fd0'; c.fillRect(X, sea, w, 6); c.fillStyle = night ? '#2c3c74' : '#8fc0ea'; c.fillRect(X, sea, w, 1);
    c.fillStyle = '#f4f2ea'; c.fillRect(X + 52, sea - 8, 2, 8); c.fillStyle = '#d8443a'; c.fillRect(X + 51, sea - 9, 4, 2); if (night && Math.sin(t * 2.2) > 0) { c.fillStyle = 'rgba(255,240,170,.9)'; c.fillRect(X + 48, sea - 9, 10, 1); }
    const sx = X + 8 + ((t * 1.2) % 30); c.fillStyle = '#fff'; c.fillRect(Math.round(sx), sea - 2, 1, 3); c.fillRect(Math.round(sx) + 1, sea - 1, 2, 1); c.fillStyle = '#5a3d26'; c.fillRect(Math.round(sx) - 1, sea + 1, 5, 1);
    const r = srand(21), tones = night ? ['#2a2a4a', '#33305a', '#262642'] : ['#c8742a', '#d99a2e', '#a8502a', '#7f9a4a', '#e0b23c'];
    for (let row = 0; row < 3; row++) for (let i = -1; i < 9; i++) { const cx = X + i * (9 + row * 2) + r() * 6, cy = sea + 8 + row * 9, rr = 5 + row * 2.5 + r() * 2; c.fillStyle = tones[Math.floor(r() * tones.length)]; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
      if (row === 0 && i % 4 === 1) { c.fillStyle = '#e9e4d6'; c.fillRect(Math.round(cx) + 5, cy - 6, 6, 4); c.fillStyle = '#8a4a36'; c.fillRect(Math.round(cx) + 4, cy - 8, 8, 2); c.fillStyle = night ? '#ffd870' : '#5a6a7a'; c.fillRect(Math.round(cx) + 7, cy - 5, 2, 2); } }
    c.restore();
    rect(x + w / 2 - 1, y, 2, h, frame); rect(x, y + h / 2 - 1, w, 2, frame); rect(x - 7, y + h + 4, w + 14, 3, '#8a6238'); rect(x - 7, y + h + 7, w + 14, 1, 'rgba(0,0,0,.2)');
    const cu = b.colour === 'rainbow' ? '#ff6fae' : DARK[b.colour] || DARK.blue, cl = b.colour === 'rainbow' ? '#ffb3d6' : CSS[b.colour] || CSS.blue;
    for (const s of [0, 1]) { const cx = s ? x + w - 6 : x - 4; poly([[cx, y - 2], [cx + 10, y - 2], [cx + (s ? 10 : 6), y + h * 0.55], [cx + (s ? 4 : 0), y + h * 0.55]], cl); rect(cx + (s ? 3 : 0), y + h * 0.55, 7, h * 0.45 + 2, cl); rect(cx + (s ? 6 : 3), y, 1, h, cu); rect(cx + (s ? 3 : 0), y + h * 0.55 - 1, 7, 2, '#ffd23e'); }
    rect(x - 6, y - 7, w + 12, 5, cu); for (let i = 0; i < 9; i++) rect(x - 6 + i * (w + 12) / 9 + 1, y - 2, (w + 12) / 9 - 2, 2, cl);
  }
  // ---- the things in the room
  function thProp(p) {
    const b = thOf(G.room) || { colour: 'blue', addons: [], toys: [] }, c = E.ctx, x = p.x, y = p.y, t = E.t, col = CSS[b.colour] || CSS.blue, dk = b.colour === 'rainbow' ? '#7b4cf0' : DARK[b.colour] || DARK.blue;
    const near = !G.busy && !G.sceneOn && Math.abs(x - marina.x) < Math.max(30, p.w * 0.5 + 12); p.glow = clamp((p.glow || 0) + (near ? 0.08 : -0.06), 0, 1);
    if (p.glow > 0.02) { const gx = x - E.camX, gy = y - p.h * 0.5, R = Math.max(p.w, p.h) * 0.6, gr = c.createRadialGradient(gx, gy, 2, gx, gy, R); gr.addColorStop(0, 'rgba(255,240,170,' + (0.34 * p.glow).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = gr; c.fillRect(gx - R, gy - R, R * 2, R * 2); }
    const bo = G.bounce && G.bounce.id === p.id && E.t - G.bounce.t0 < 0.35 ? Math.sin((E.t - G.bounce.t0) / 0.35 * Math.PI) * 0.1 : 0; c.save(); if (bo) { const cx = Math.round(x - E.camX); c.translate(cx, y); c.scale(1 + bo, 1 - bo); c.translate(-cx, -y); }
    switch (p.id) {
      case 'th_hatch': rect(x - 20, y - 31, 40, 20, '#8a6238'); rect(x - 18, y - 29, 36, 16, '#a9773f'); for (let i = 1; i < 4; i++) rect(x - 18 + i * 9, y - 29, 1, 16, '#8a6238'); rect(x - 3, y - 20, 6, 3, '#4a3120');
        rect(x - 20, y - 12, 40, 12, '#4a3120'); rect(x - 18, y - 11, 36, 10, '#241a12'); rect(x - 10, y - 20, 2, 16, '#d2b077'); rect(x + 8, y - 20, 2, 16, '#d2b077'); rect(x - 10, y - 14, 20, 2, '#a9773f'); rect(x - 10, y - 7, 20, 2, '#8a6238');
        em('⬇️', x, y - 22 + Math.sin(t * 3) * 1.5, 8, 0.9); break;
      case 'th_bell': { const a = t < T.bellT ? Math.sin((T.bellT - t) * 14) * 0.5 * (T.bellT - t) : Math.sin(t * 1.2) * 0.03; rect(x - 5, 34, 10, 3, '#5a3d26'); rect(x, 37, 1, 12, '#d2b077'); em('🔔', x + Math.sin(a) * 8, 57, 15, 1, a); rect(x + Math.sin(a) * 14, 66, 1, 14, '#d2b077'); rect(x - 1 + Math.sin(a) * 14, 80, 3, 4, col); break; }
      case 'th_bucket': { const by = T.bucket ? T.bucket.y : 62; rect(x - 9, 34, 18, 3, '#5a3d26'); rect(x - 1, 37, 3, 6, '#5a3d26'); c.fillStyle = '#8d8f98'; c.beginPath(); c.arc(Math.round(x + 0.5 - E.camX), 46, 4, 0, 7); c.fill(); rect(x, 45, 1, 2, '#3a3a44'); rect(x + 3, 46, 1, Math.max(0, by - 56), '#d2b077');
        if (by < 132) { if (T.bucket && T.bucket.ch) em(T.bucket.ch, x + 3, by - 13, 10); poly([[x - 4, by - 9], [x + 11, by - 9], [x + 9, by + 3], [x - 2, by + 3]], '#7d8794'); rect(x - 4, by - 9, 15, 2, '#aab3bf'); rect(x - 2, by + 1, 11, 2, '#5d6672'); rect(x - 3, by - 5, 13, 1, dk); } break; }
      case 'th_wall': { const any = typeof Pics !== 'undefined' && Pics.walls.some(w => w.room === G.room); rect(66, 50, 100, 1, '#6b4423'); for (const sx of T.slots) { rect(sx - 1, 49, 2, 3, '#ffd23e'); }
        if (!any) { rect(x - 17, 61, 34, 28, '#8a5a2e'); rect(x - 15, 63, 30, 24, '#fffaf0'); em('🖼️', x, 75, 12, 0.5 + Math.sin(t * 3) * 0.15); } else em('➕', 166, 58 + Math.sin(t * 3), 7, 0.8); break; }
      case 'th_bean': { const sq = t < T.sat ? 3 : 0; c.fillStyle = dk; c.beginPath(); c.ellipse(Math.round(x - E.camX), y - 10 + sq, 22, 12 - sq, 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(Math.round(x - 1 - E.camX), y - 12 + sq, 20, 10 - sq, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(Math.round(x - 6 - E.camX), y - 15 + sq, 9, 3, -0.3, 0, 7); c.fill(); rect(x + 9, y - 11 + sq, 5, 1, dk); break; }
      case 'th_scope': { c.strokeStyle = '#4a3120'; c.lineWidth = 2; const cx = x - E.camX; for (const dx of [-9, 0, 9]) { c.beginPath(); c.moveTo(cx, y - 30); c.lineTo(cx + dx, y); c.stroke(); }
        c.save(); c.translate(cx, y - 32); c.rotate(0.45); px(c, -20, -4, 30, 8, '#2a2230'); px(c, -19, -3, 28, 6, '#d8a23c'); px(c, -19, -3, 28, 2, '#f3cf74'); px(c, -22, -5, 5, 10, '#2a2230'); px(c, 8, -4, 4, 8, '#8a6238'); c.restore(); break; }
      case 'th_lamp': { const on = !!b.lamp; rect(x - 6, y - 38, 12, 2, '#5a3d26'); rect(x, y - 36, 1, 8, '#3a3a44'); if (on) { const g = c.createRadialGradient(x - E.camX, y - 14, 2, x - E.camX, y - 14, 34); g.addColorStop(0, 'rgba(255,214,120,.55)'); g.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = g; c.fillRect(x - 36 - E.camX, y - 50, 72, 72); }
        rect(x - 6, y - 28, 13, 3, '#2a2230'); rect(x - 5, y - 25, 11, 16, on ? '#ffe9a0' : '#b7c3d0'); rect(x - 5, y - 25, 1, 16, '#2a2230'); rect(x + 5, y - 25, 1, 16, '#2a2230'); rect(x, y - 25, 1, 16, 'rgba(42,34,48,.5)'); rect(x - 7, y - 9, 15, 3, '#2a2230'); if (on) em('🔥', x + 0.5, y - 15 + Math.sin(t * 15) * 0.5, 7); break; }
      case 'th_shelf': { rect(x - 21, y - 62, 3, 62, '#6b4423'); rect(x + 18, y - 62, 3, 62, '#6b4423'); for (const sy of [y - 2, y - 30, y - 58]) { rect(x - 21, sy, 42, 3, '#8a5a2e'); rect(x - 21, sy, 42, 1, '#b98448'); } rect(x - 18, y - 60, 36, 58, 'rgba(90,60,40,.12)');
        (b.toys || []).slice(0, 8).forEach((ch, i) => { if (ch === T.toyOut) return; em(ch, x - 14 + (i % 4) * 9.5, y - 8 - (i < 4 ? 28 : 0) + Math.sin(t * 2 + i) * 0.4, 9); }); break; }
    }
    c.restore();
  }
  function thLate(c) {                  // lantern on: a cosy night; nap on the bean bag: sleepy dark
    const b = ROOMS[G.room] && ROOMS[G.room].treehouse ? thOf(G.room) : null; if (!b) return;
    const nk = E.t < T.napT ? clamp(Math.min(T.napT - E.t, E.t - T.nap0) / 0.6, 0, 1) : 0, a = Math.max(b.lamp ? 0.4 : 0, nk * 0.6); if (a <= 0) return;
    c.fillStyle = 'rgba(14,12,52,' + a.toFixed(3) + ')'; c.fillRect(-10, -40, E.viewW + 20, SH + 60);
    if (b.lamp) { const x = 248 - E.camX, g = c.createRadialGradient(x, 66, 6, x, 66, 120); g.addColorStop(0, 'rgba(255,196,96,.34)'); g.addColorStop(1, 'rgba(255,196,96,0)'); c.fillStyle = g; c.fillRect(x - 120, -54, 240, 240); }
    if (nk) em('🌙', E.camX + E.viewW - 40, 44, 16, nk);
  }
  const busyFor = fn => async (...a) => { if (G.busy) return; UI.closeActions(); G.busy = true; try { await fn(...a); } catch (e) { warn('room', e); } S.actors.length = 0; marina.offY = 0; if (!['idle', 'cheer'].includes(marina.state)) { marina.state = 'idle'; marina.anim = null; } G.busy = false; };
  const ringBell = busyFor(async p => { await walkTo(p.x + 16); marina.dir = -1; playAnim('marina_reach', { fps: 12, proc: 'hug', dur: 0.5 }); await nap(0.3); T.bellT = E.t + 1.4;
    for (let i = 0; i < 3; i++) { Audio2.blip(i % 2 ? 19 : 24, 'sine', 0.6, 0.2); Audio2.blip(i % 2 ? 26 : 31, 'sine', 0.7, 0.08); emit('note', p.x + rnd(-6, 12), 50); await nap(0.36); }
    const bird = actor('🐦', WIN.x + WIN.w + 30, 30, 10); await fly(bird, WIN.x + 16, WIN.y + WIN.h - 2, 0.8, 14); Audio2.jingle([28, 31, 28, 33], 0.08, 'sine'); marina.dir = 1; emit('heart', bird.x, bird.y - 8, 2); await run(1.3, (k, t) => { bird.rot = Math.max(0, Math.sin(t * 9)) * 0.4; }); await fly(bird, WIN.x + WIN.w + 40, 20, 0.7, 8); gone(bird); });
  const pullBucket = busyFor(async p => { await walkTo(p.x + 22); marina.dir = -1; const bk = T.bucket = { y: 62, ch: null }; playAnim('marina_reach', { fps: 10, loop: true, proc: 'hug', dur: 2.6 });
    await run(0.9, (k, t, dt) => { bk.y = lerp(62, 150, k); if (every(t, dt, 8)) Audio2.blip(12 - Math.round(k * 10), 'triangle', 0.04, 0.08); }); await nap(0.5); Audio2.jingle([0, 4], 0.1, 'triangle'); bk.ch = pick(['🍪', '🍎', '🧃', '🍓', '🧁', '🍌', '🥨', '🍇']);
    await run(1.1, (k, t, dt) => { bk.y = lerp(150, 62, ease(k)); if (every(t, dt, 8)) Audio2.blip(2 + Math.round(k * 10), 'triangle', 0.04, 0.08); }); marina.state = 'idle'; marina.anim = null;
    const tr = actor(bk.ch, p.x + 3, 49, 10); bk.ch = null; Audio2.blip(19, 'sine', 0.15, 0.14); await fly(tr, marina.x - 8, FLOOR - 46, 0.4, 12); playAnim('marina_eat', { fps: 7, proc: 'hug', dur: 1.3 }); await nap(0.4); gone(tr); Audio2.sfx('eat_chomp', { vol: 0.5, rate: 1.2 }); await nap(0.9); T.bucket = null; marina.state = 'idle'; marina.anim = null; say(pick(['m_yummy', 'm_snack'])); await nap(0.8); });
  const beanSit = busyFor(async (p, sleepy) => { await walkTo(p.x - 26); marina.dir = 1; await hop(p.x, -8, 0.4, 16); marina.state = 'sit'; T.sat = E.t + (sleepy ? 6 : 2.6); Audio2.sfx('thud', { vol: 0.35 }); emit('dust', p.x, p.y - 4, 5);
    if (sleepy) { T.nap0 = E.t; T.napT = E.t + 5; say('m_nite'); try { Audio2.melody('lullaby'); } catch (e) { } await run(5, (k, t, dt) => { if (every(t, dt, 1.3)) emit('zzz', marina.x + 6, FLOOR - 50); }); Audio2.jingle([0, 4, 7, 12, 16, 19], 0.09, 'triangle'); emit('star', marina.x, FLOOR - 70, 8); }
    else { emit('heart', marina.x, FLOOR - 66, 3); say(pick(['m_happy', 'm_cool'])); await nap(2.4); }
    marina.state = 'idle'; await hop(p.x + 28, 0, 0.4, 14); if (sleepy) { cheer(1200); say('m_yay'); await nap(0.8); } });
  function lampToggle(p) { const b = thOf(G.room); if (!b) return; approach(p.x - 14, () => { b.lamp = !b.lamp; save(); Audio2.blip(b.lamp ? 12 : -5, 'square', 0.08); playAnim('marina_reach', { fps: 12, proc: 'hug', dur: 0.4 }); if (b.lamp) { emit('sparkle', p.x, p.y - 16, 10); setTimeout(() => say(pick(['m_wow', 'm_pretty'])), 350); } }, 0); }
  // playing with a toy from the shelf
  const TOYS = ['🧸', '🦄', '🦖', '🚂', '🚗', '⚽', '🪀', '🎸', '🥁', '🤖', '🚀', '🪁', '🧩', '🎲', '🐰', '🦆', '🪆', '✈️', '👑', '🔮'];
  const TOYKIND = { '⚽': 'bounce', '🚂': 'zoom', '🚗': 'zoom', '✈️': 'fly', '🚀': 'fly', '🪁': 'fly', '🎸': 'music', '🥁': 'music', '🦖': 'stomp', '🤖': 'stomp', '👑': 'wear', '🔮': 'magic', '🪀': 'magic', '🎲': 'bounce', '🧩': 'magic' };
  const playToy = busyFor(async (p, ch) => {
    const b = thOf(G.room), i = (b.toys || []).indexOf(ch), sx = p.x - 14 + (i % 4) * 9.5, sy = p.y - 8 - (i < 4 ? 28 : 0), mx = 190, kind = TOYKIND[ch] || 'hug', fl = FLOOR + 4;
    T.toyOut = ch; const a = actor(ch, sx, sy, 9); await walkTo(mx); marina.dir = 1; Audio2.blip(12, 'triangle', 0.06, 0.12); await run(0.4, k => { a.x = lerp(sx, mx + 16, k); a.y = lerp(sy, FLOOR - 34, k) - Math.sin(k * Math.PI) * 18; a.size = 9 + k * 6; });
    if (kind === 'bounce') { say('m_catch'); for (let n = 0; n < 5; n++) { const x0 = a.x, x1 = mx + (n % 2 ? 16 : 56); Audio2.sfx('boing', { rate: 1.2 + n * 0.1, vol: 0.4 }); await run(0.42, k => { a.x = lerp(x0, x1, k); a.y = fl - Math.sin(k * Math.PI) * (40 - n * 5); a.rot = k * 5; }); } cheer(900); }
    else if (kind === 'zoom') { say('m_vroom'); a.y = fl; for (let n = 0; n < 3; n++) { const x0 = a.x, x1 = n % 2 ? mx + 80 : mx - 110; Audio2.whoosh(n % 2 === 0); await run(0.7, (k, t, dt) => { a.x = lerp(x0, x1, ease(k)); if (chance(0.4)) emit('dust', a.x, fl + 2, 1); if (every(t, dt, 9)) Audio2.blip(-14 + (n % 2) * 2, 'sawtooth', 0.05, 0.05); }); if (ch === '🚂') Audio2.jingle([12, 12], 0.12, 'square'); } }
    else if (kind === 'fly') { say('m_wow'); Audio2.whoosh(true); await run(2.6, (k, t) => { const an = k * Math.PI * 4; a.x = mx + Math.sin(an) * 70; a.y = 86 - Math.cos(an) * 30 - Math.sin(k * Math.PI) * 10; a.rot = Math.cos(an) * 0.5; if (chance(0.5)) emit('sparkle', a.x, a.y, 1); }); }
    else if (kind === 'music') { say('m_dance'); marina.state = 'cheer'; for (let n = 0; n < 8; n++) { Audio2.blip([0, 4, 7, 12, 7, 4, 7, 12][n] + (ch === '🥁' ? -12 : 0), ch === '🥁' ? 'square' : 'triangle', 0.2, 0.18); if (ch === '🥁') Audio2.noise(0.05, 0.25, 400); emit('note', a.x + rnd(-8, 8), a.y - 10); a.rot = n % 2 ? 0.25 : -0.25; await nap(0.24); } a.rot = 0; marina.state = 'idle'; }
    else if (kind === 'stomp') { say('m_roar'); a.y = fl; for (let n = 0; n < 6; n++) { const x0 = a.x; await run(0.26, k => { a.x = x0 + (n < 3 ? 12 : -12) * k; a.y = fl - Math.sin(k * Math.PI) * 8; a.size = 15 + Math.min(n, 5 - n) * 4; }); Audio2.noise(0.08, 0.3, 120); Audio2.blip(-22, 'square', 0.08, 0.2); emit('dust', a.x, fl + 2, 3); } Audio2.voice('m_giggle', 'm'); }
    else if (kind === 'wear') { say('m_princess'); await fly(a, marina.x, FLOOR - 78, 0.4, 20); Audio2.jingle([12, 16, 19, 24], 0.07, 'sine'); emit('sparkle', marina.x, FLOOR - 78, 12); marina.state = 'cheer'; await run(2.2, (k, t) => { a.y = FLOOR - 78 + Math.sin(t * 8) * 1.5; if (chance(0.2)) emit('heart', marina.x + rnd(-14, 14), FLOOR - 60, 1); }); marina.state = 'idle'; }
    else if (kind === 'magic') { say('m_pretty'); Audio2.jingle([12, 16, 19, 24, 28, 31], 0.1, 'sine'); await run(2.2, (k, t) => { a.size = 15 + Math.sin(k * Math.PI) * 10; a.rot = t * 4; a.y = FLOOR - 40 - Math.sin(k * Math.PI) * 22; for (let n = 0; n < 2; n++) emit('sparkle', a.x + rnd(-20, 20), a.y + rnd(-20, 20), 1); if (chance(0.08)) emit('star', a.x, a.y, 1); }); a.rot = 0; }
    else { await fly(a, marina.x + 6, FLOOR - 40, 0.25, 4); playAnim('marina_hug', { fps: 7, proc: 'hug', dur: 1.6 }); emit('heart', marina.x, FLOOR - 70, 6); if (ch === '🦆') { Audio2.blip(-3, 'sawtooth', 0.12, 0.2); setTimeout(() => Audio2.blip(-3, 'sawtooth', 0.12, 0.2), 220); } else Audio2.sfx('chip_hug', { vol: 0.6 }); say(pick(['m_cuddle', 'm_toy_play', 'm_happy'])); await run(1.6, (k, t) => { a.rot = Math.sin(t * 6) * 0.15; }); marina.state = 'idle'; marina.anim = null; }
    const x0 = a.x, y0 = a.y, s0 = a.size; await run(0.4, k => { a.x = lerp(x0, sx, k); a.y = lerp(y0, sy, k) - Math.sin(k * Math.PI) * 18; a.size = lerp(s0, 9, k); a.rot = 0; }); gone(a); T.toyOut = null; Audio2.blip(7, 'triangle', 0.05, 0.1);
  });
  function thActions(p) {
    const b = thOf(G.room);
    switch (p.a) {
      case 'th_hatch': return [A('🪜', () => climbDown(false))].concat(b && (b.addons || []).includes('tube') ? [A('🛝', () => climbDown(true))] : []);
      case 'th_bell': return [A('🔔', () => ringBell(p))];
      case 'th_bucket': return [A('🪣', () => pullBucket(p))];
      case 'th_wall': return [A('🖼️', galleryPick)];
      case 'th_bean': return [A('🪑', () => beanSit(p)), A('😴', () => beanSit(p, true))];
      case 'th_scope': return [A('🔭', () => approach(p.x - 16, () => { UI.closeActions(); if (typeof TreeClimb !== 'undefined' && TreeClimb && TreeClimb.view) { try { TreeClimb.view({ from: ROOMS[G.room].treehouse }); return; } catch (e) { warn('view', e); } } scopeView(); }, 0))];
      case 'th_lamp': return [A('💡', () => lampToggle(p))];
      case 'th_shelf': return [A('🧺', toyPicker)].concat(b ? (b.toys || []).slice(0, 8).map(ch => A(ch, () => playToy(p, ch))) : []);
    }
    return [];
  }
  // ---- little screens: choose toys for the shelf, choose a picture to hang, look through the telescope
  function screen(ico) { UI.closeActions(); const p = panel(); p.innerHTML = ''; p.classList.remove('hidden'); const top = mk('div', 'ptop'), done = () => { p.classList.add('hidden'); p.innerHTML = ''; setMusic(); }, x = press(mk('button', 'pbtn', '❌'), done); x.setAttribute('aria-label', 'close'); top.append(x, mk('div', 'ttl', ico)); p.append(top); return { p, top, done }; }
  function toyPicker() {
    const b = thOf(G.room); if (!b) return; b.toys = b.toys || []; const s = screen('🧸'), shelf = mk('div', 'bd-shelf'), grid = mk('div', 'bd-toys'), ok = press(mk('button', 'pbtn go', '✅'), s.done); ok.setAttribute('aria-label', 'done'); s.top.append(ok);
    const draw = () => { shelf.innerHTML = ''; for (let i = 0; i < 8; i++) shelf.append(mk('span', b.toys[i] ? 'in' : '', b.toys[i] || '')); grid.querySelectorAll('button').forEach(n => { const on = b.toys.includes(n.textContent); n.classList.toggle('sel', on); n.setAttribute('aria-label', 'toy ' + n.textContent + (on ? ' (on the shelf)' : '')); }); };
    for (const ch of TOYS) grid.append(press(mk('button', 'tile bd-toy', ch), () => { const i = b.toys.indexOf(ch); if (i >= 0) b.toys.splice(i, 1); else { b.toys.push(ch); if (b.toys.length > 8) b.toys.shift(); } save(); Audio2.blip(i >= 0 ? 2 : 12, 'triangle', 0.07, 0.14); draw(); }));
    s.p.append(shelf, grid); draw();
  }
  function galleryPick() {
    let g = []; try { g = JSON.parse(localStorage.getItem('cm_gallery')) || []; } catch (e) { } const s = screen('🖼️'), grid = mk('div', 'bd-gal');
    for (const url of g.slice(0, 24)) { const b = mk('button', 'bd-galpic'), i = mk('img'); i.src = url; i.draggable = false; b.setAttribute('aria-label', 'hang this picture'); b.append(i); press(b, () => { s.done(); hangHere(url); }); grid.append(b); }
    if (typeof Studio !== 'undefined') { const d = press(mk('button', 'bd-galpic bd-new', '🖍️<b>➕</b>'), () => { s.done(); Studio.open(); }); d.setAttribute('aria-label', 'draw a new picture'); grid.append(d); }
    s.p.append(grid);
  }
  function hangHere(url) { const room = G.room, h = Pics.hash(url), x = T.slots.find(x => !Pics.walls.some(w => w.room === room && w.h !== h && Math.abs(w.x - x) < 30)) || T.slots[1]; approach(x, () => { marina.x = x; Pics.hang(url, room); }, 0); }
  function scopeView() {                // (only if the tree-top panorama is not there) a round look at the sky and the treetops; tap to spot things
    const b = thOf(G.room) || {}, night = !!b.lamp, s = screen('🔭'), box = mk('div', 'bd-scope'), cv = mk('canvas'), found = [], t0 = performance.now(); cv.width = cv.height = 280; box.append(cv, mk('i', '', '👆')); s.p.append(box);
    const things = night ? ['🌕', '🦉', '🌠', '🛰️', '🦇', '🪐'] : ['🎈', '🦅', '✈️', '⛵', '🪁', '🌈', '🐿️', '🚁']; let n = 0;
    press(box, () => { found.push({ ch: things[n++ % things.length], t: performance.now(), x: 30 + Math.random() * 80, y: 26 + Math.random() * 60 }); if (found.length > 5) found.shift(); Audio2.jingle([12, 16, 19, 24], 0.07, 'sine'); box.classList.add('used'); });
    const x = cv.getContext('2d'), loop = () => { if (!cv.isConnected) return; const t = (performance.now() - t0) / 1000, pan = Math.sin(t * 0.25) * 16; x.setTransform(2, 0, 0, 2, 0, 0); x.imageSmoothingEnabled = false;
      const g = x.createLinearGradient(0, 0, 0, 140); if (night) { g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#3a3a78'); } else { g.addColorStop(0, '#5aa8f0'); g.addColorStop(1, '#d8eefc'); } x.fillStyle = g; x.fillRect(0, 0, 140, 140);
      const r = srand(4); if (night) for (let i = 0; i < 50; i++) { x.fillStyle = 'rgba(255,250,210,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))).toFixed(2) + ')'; x.fillRect(Math.floor(r() * 140), Math.floor(r() * 80), 1, 1); } else for (let i = 0; i < 3; i++) { const cx = ((t * (3 + i) + i * 60) % 190) - 30; px(x, cx, 16 + i * 14, 26, 6, 'rgba(255,255,255,.9)'); px(x, cx + 6, 12 + i * 14, 12, 4, 'rgba(255,255,255,.9)'); }
      px(x, 0, 84, 140, 10, night ? '#1c2a5a' : '#4a8fd0'); px(x, 0, 84, 140, 1, night ? '#2c3c74' : '#9ccbf0'); px(x, 96 + pan, 70, 4, 14, '#f4f2ea'); px(x, 95 + pan, 68, 6, 3, '#d8443a'); if (night && Math.sin(t * 2.2) > 0) px(x, 86 + pan, 68, 24, 1, 'rgba(255,240,170,.9)');
      const tones = night ? ['#2a2a4a', '#33305a', '#262642'] : ['#c8742a', '#d99a2e', '#a8502a', '#7f9a4a', '#e0b23c']; for (let row = 0; row < 3; row++) for (let i = -2; i < 12; i++) { x.fillStyle = tones[Math.floor(r() * tones.length)]; x.beginPath(); x.arc(i * (14 + row * 3) + r() * 8 + pan * (1 + row * 0.6), 100 + row * 14, 9 + row * 4 + r() * 3, 0, 7); x.fill(); }
      for (const f of found) { const k = (performance.now() - f.t) / 1000; emo(x, f.ch, f.x + k * 4, f.y - Math.sin(k * 2) * 3, Math.min(26, 4 + k * 60), Math.sin(k * 3) * 0.1); }
      requestAnimationFrame(loop); }; loop();
  }

  // ---------------------------------------------------------------- looks
  const st8 = document.createElement('style'); st8.textContent = `
.bd-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px;padding-top:8px}
.bd-jeff{position:relative;flex:none;width:56px;height:56px;border-radius:50%;background:#ffe9b8;border:3px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.3)}
.bd-jeff canvas{width:100%;height:100%;border-radius:50%;image-rendering:pixelated;display:block}
.bd-jeff b{position:absolute;right:-12px;top:-10px;font-size:30px;font-weight:400;opacity:0;pointer-events:none}
.bd-jeff.no{animation:bdno .45s 2}.bd-jeff.no b{animation:bdnob .95s both}
@keyframes bdno{25%{transform:translateX(-7px) rotate(-12deg)}75%{transform:translateX(7px) rotate(12deg)}}
@keyframes bdnob{0%{opacity:0;transform:scale(.3)}20%,85%{opacity:1;transform:scale(1)}100%{opacity:0}}
.bd-pile{flex:none;display:grid;grid-template-columns:repeat(4,22px);gap:4px 4px;padding:7px 8px;background:#4a3b6e;border-radius:14px}
.bd-pl{display:block;flex:none;width:22px;height:9px;border-radius:2px;background:linear-gradient(#ecc588 0 38%,#cf9b5a 38% 78%,#a87238 78%);box-shadow:0 0 0 1.5px #5a3a1c}
.bd-pl.used{background:#6f678a;box-shadow:0 0 0 1.5px #57507a;opacity:.55}
.bd-pl.will{animation:bdwill .5s ease-in-out infinite alternate}
.bd-pl.miss{background:rgba(255,106,106,.25);box-shadow:0 0 0 1.5px #ff6a6a}
@keyframes bdwill{to{opacity:.35;transform:scale(.85)}}
.bd-fly{position:fixed;z-index:30;pointer-events:none;transition:left .42s ease-in,top .42s ease-in}
.bd-grid{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:12px 10px;padding:8px 6px 14px;align-content:start}
.bd-card{position:relative;min-height:112px;aspect-ratio:1/1.06;border-radius:18px;border:3px solid #fff;background:linear-gradient(#bfe3ff 0 66%,#9ccf6e 66%);box-shadow:0 4px 0 rgba(0,0,0,.3);padding:4px 4px 6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;touch-action:manipulation}
.bd-card:active{transform:translateY(2px)}
.bd-card img{flex:1 1 0;min-height:0;width:94%;object-fit:contain;object-position:50% 100%;image-rendering:pixelated;pointer-events:none}
.bd-cost{flex:none;display:flex;gap:4px;justify-content:center;align-items:center;background:rgba(255,255,255,.9);border-radius:9px;padding:4px 6px;max-width:100%}
.bd-card .bd-cost .bd-pl{width:15px;height:8px}
.bd-card.off{filter:grayscale(.8);opacity:.5}
.bd-tag{position:absolute;left:-5px;top:-8px;font-size:24px;line-height:1}
.bd-broom{position:absolute;right:-7px;top:-9px;width:46px;height:46px;border-radius:50%;background:#fff;font-size:26px;line-height:46px;text-align:center;box-shadow:0 3px 0 rgba(0,0,0,.3)}
.bd-down.dim{opacity:.55}
.bd-down.sure{border-color:#ff6a6a;animation:wig .5s infinite;opacity:1}
.bd-down.sure .bd-broom{background:#ffcf4a;transform:scale(1.25)}
.bd-down.gone{transition:transform .45s,opacity .45s;transform:scale(.15) rotate(50deg);opacity:0;animation:none}
.bd-need{flex:none;display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,.14);border-radius:18px;padding:6px 12px;min-height:76px}
.bd-need img{height:64px;image-rendering:pixelated}.bd-need .bd-cost{flex-wrap:wrap;max-width:150px;padding:7px 8px}
.bd-nospot{position:relative;font-size:38px}.bd-nospot b{position:absolute;left:8px;top:6px;font-size:30px;font-weight:400}
.bd-cust{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px}
.bd-prevbox{flex:1 1 120px;min-height:110px;min-width:0;border-radius:18px;border:3px solid #fff;overflow:hidden;background:#9fd0f2}
.bd-prev{width:100%;height:100%;display:block;image-rendering:pixelated}
.bd-opts{flex:none;display:flex;flex-direction:column;gap:8px;min-width:0}
.bd-row{display:flex;gap:6px 8px;justify-content:center;align-items:center;flex-wrap:wrap;flex:none}
.bd-cols{gap:2px;justify-content:space-between;flex-wrap:nowrap}
.bd-sw{flex:0 1 60px;min-width:0;aspect-ratio:1;border-radius:50%;border:4px solid #fff;box-shadow:0 4px 0 rgba(0,0,0,.3);padding:0;touch-action:manipulation}
.bd-sw.sel{box-shadow:0 0 0 4px #ffcf4a,0 6px 0 3px rgba(0,0,0,.3);transform:scale(.9)}
.bd-group{display:flex;gap:6px;padding:4px;border-radius:20px;background:rgba(255,255,255,.14)}
.bd-opt{flex:none;width:60px;height:60px;border-radius:16px;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.3);padding:5px;font-size:30px;line-height:1;display:flex;align-items:center;justify-content:center;touch-action:manipulation}
.bd-opt.sel,.bd-opt.on{background:#ffcf4a;box-shadow:0 0 0 3px #fff,0 4px 0 3px rgba(0,0,0,.3)}
.bd-opt img,.bd-opt canvas{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;pointer-events:none}
.bd-where{flex:none;display:flex;gap:8px;align-items:center;justify-content:center;min-width:0}
.bd-map{flex:1 1 auto;min-width:0;height:98px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-radius:16px;border:3px solid #fff;background:#86ad55}
.bd-mapin{position:relative;height:92px}
.bd-mapcv{display:block;image-rendering:pixelated}
.bd-spot{position:absolute;width:64px;height:64px;margin-left:-32px;border-radius:16px;border:3px dashed #fff;background:rgba(255,255,255,.4);font-size:26px;padding:0;animation:pulse .6s ease-in-out infinite alternate;touch-action:manipulation}
.bd-spot.sel{border:4px solid #ffcf4a;background:rgba(255,207,74,.25);animation:none}
.bd-ok{flex:none;width:78px;height:78px;font-size:42px;border-radius:24px;border:4px solid #fff}
.act.bd-sec{width:62px;height:62px;margin:-31px 0 0 -31px;line-height:62px;font-size:30px;background:#efe9ff;box-shadow:0 4px 0 rgba(0,0,0,.3),0 0 0 3px #b9a8e6}
.acttray .act.bd-sec{margin:0;flex:0 0 62px}
.bd-shelf{flex:none;display:flex;justify-content:center;gap:4px;padding:8px 8px 6px;background:#8a5a2e;border-radius:14px;border-bottom:8px solid #6b4423;min-height:64px}
.bd-shelf span{width:40px;height:44px;font-size:32px;line-height:44px;text-align:center;border-radius:10px;background:rgba(0,0,0,.14)}.bd-shelf span.in{background:rgba(255,255,255,.2)}
.bd-toys{flex:1 1 auto;min-height:0;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:8px;padding:10px 4px;align-content:start}
.bd-toy{min-height:66px;font-size:38px}
.bd-gal{flex:1 1 auto;min-height:0;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;padding:10px 4px;align-content:start}
.bd-galpic{position:relative;aspect-ratio:5/4;min-height:90px;border-radius:14px;border:5px solid #8a5a2e;background:#fff;padding:0;overflow:hidden;box-shadow:0 4px 0 rgba(0,0,0,.3);font-size:44px}
.bd-galpic img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.bd-new{border-style:dashed;background:#fff6dc}.bd-new b{position:absolute;right:8px;top:4px;font-size:24px;font-weight:400}
.bd-scope{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center}
.bd-scope canvas{height:min(100%,88vw);aspect-ratio:1;max-width:100%;border-radius:50%;border:12px solid #2a2230;box-shadow:0 0 0 5px #d8a23c,0 10px 0 rgba(0,0,0,.35);image-rendering:pixelated;box-sizing:border-box}
.bd-scope i{position:absolute;left:50%;top:50%;margin:16vmin 0 0 -22px;font-size:44px;font-style:normal;animation:pulse .6s ease-in-out infinite alternate;pointer-events:none}.bd-scope.used i{display:none}
@media (orientation:portrait){.bd-where{flex-direction:column;align-items:stretch}.bd-ok{align-self:center;width:132px;height:76px}}
@media (orientation:landscape){.bd-cust{flex-direction:row}.bd-prevbox{flex:0 0 32%}.bd-opts{flex:1 1 0;justify-content:center}.bd-cols{justify-content:center;gap:8px}.bd-grid{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}.bd-card{aspect-ratio:1/0.98}.bd-toys{grid-template-columns:repeat(auto-fill,minmax(70px,1fr))}}`;
  document.head.append(st8);

  // ---------------------------------------------------------------- start: bring back what she built; the public API
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && Array.isArray(j.builds)) { D.seen = j.seen || {}; let left = LUMBER;
      for (const b of j.builds) { const c = b && CATBY[b.kind], sp = b && SPOTS[b.spot]; if (!c || !sp || sp.type !== c.spot || at(b.spot) || c.cost > left) continue; left -= c.cost;
        D.builds.push({ kind: b.kind, spot: b.spot, colour: COLOURS.includes(b.colour) ? b.colour : c.col, style: stylesOf(c).some(s => s[0] === b.style) ? b.style : stylesOf(c)[0][0], addons: (b.addons || []).filter(a => c.addons.includes(a)), toys: Array.isArray(b.toys) ? b.toys.filter(t => TOYS.includes(t)).slice(0, 8) : undefined, lamp: !!b.lamp || undefined }); } } } catch (e) { }
  const _sync = syncProps; syncProps = function () { _sync(); syncFloor(); }; syncProps();
  const API = { open, close, list: () => D.builds.map(b => ({ kind: b.kind, spot: b.spot, colour: b.colour, style: b.style, addons: (b.addons || []).slice() })), lumberLeft, has: kind => D.builds.some(b => b.kind === kind), onSay: null,
    lumber: LUMBER, spots: SPOTS, catalogue: CAT.map(c => ({ id: c.id, cost: c.cost, spot: c.spot, ico: c.ico })),
    draw: spot => { const p = PROPS.backyard.find(p => p.bl === 1 && p.b.spot === spot); if (p && G.room === 'backyard') drawBuilt(p); } };      // draw(spot): paint that thing again right now (for a file that draws tree foliage over it)
  window.Builder = API;
})();
