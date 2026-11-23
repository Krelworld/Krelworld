// Chef Marina — building with Nunu in the basement: toy bricks ("Legos") and magnetic tiles.
// Self-contained; load after everything else.
//   Bricks.open({ kind: 'lego' | 'tiles', onDone(result), onClose() })   full-screen builder inside #panel
//   Bricks.close()                        same as the ❌ (keeps the build, does not call onDone)
//   Bricks.has(kind) / Bricks.count(kind) is there a saved build / how many pieces
//   Bricks.drawModel(ctx, kind, x, y, h)  the saved build as a little model standing on (x, y), about h pixels tall
// The plate is one small pixel canvas scaled up (a canvas, not buttons: calm.js cancels taps on buttons when the
// finger moves, and here a moving finger paints). Everything else is picture buttons, because she cannot read.
(function () {
  'use strict';
  const KEY = 'cm_bricks', GAP = 6;
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (h, to, k) => { const a = hex(h), b = hex(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const shades = h => ({ b: h, l: mix(h, '#ffffff', 0.45), d: mix(h, '#000000', 0.2), k: mix(h, '#000000', 0.38) });
  const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const pat = (g, x, y, rows, map) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = map[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } } };
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const OPP = { br: 'tl', tl: 'br', bl: 'tr', tr: 'bl' };       // a triangle and its mirror twin make one square
  const inHalf = (tri, u, v) => tri === 'br' ? u + v >= 1 : tri === 'bl' ? v >= u : tri === 'tl' ? u + v < 1 : v < u;

  // ------------------------------------------------------------------ the two toys
  // cols x rows studs, `cell` logical pixels each; w = studs wide; tri = which corner of a triangle is the square one
  const KINDS = {
    lego: { cols: 13, rows: 12, cell: 12, mx: 3, top: 5, bot: 8, pad: 3, ico: '🧱', letters: 'roygbpkw', minRows: 5,
      col: ['#e5352d', '#ff8a1c', '#ffd32a', '#35b84b', '#2b8cea', '#8b55e8', '#ff6fb7', '#f4f4ef'],
      pcs: [{ id: 'b1', w: 1 }, { id: 'b2', w: 2 }, { id: 'b3', w: 3 }, { id: 'b4', w: 4 }, { id: 'eye', w: 1 }, { id: 'sl', w: 1 }, { id: 'sr', w: 1 }, { id: 'win', w: 1 }, { id: 'whl', w: 1 }, { id: 'flw', w: 1 }],
      cpr: 5, ppr: 5, first: 'b2', brick: ['', 'b1', 'b2', 'b3', 'b4'] },
    tiles: { cols: 8, rows: 8, cell: 20, mx: 3, top: 4, bot: 5, pad: 2, ico: '🔷', letters: 'rogbpk', minRows: 3,
      col: ['#ff4d6d', '#ffb627', '#2ee59d', '#3d9bff', '#b06cff', '#ff7ad9'],
      pcs: [{ id: 'sq', w: 1 }, { id: 'tbr', w: 1, tri: 'br' }, { id: 'tbl', w: 1, tri: 'bl' }, { id: 'ttl', w: 1, tri: 'tl' }, { id: 'ttr', w: 1, tri: 'tr' }],
      cpr: 4, ppr: 5, first: 'sq', brick: ['', 'sq'] }
  };

  // ------------------------------------------------------------------ blueprints (pictures to copy)
  // one letter per stud = a plain brick/tile of that colour (see `letters`); any other character is looked up in sp -> [piece, colour].
  // Rows are bottom-aligned on the plate.
  const BP = {
    lego: [
      { id: 'house', ico: '🏠', sp: { '<': ['sl', 'r'], '>': ['sr', 'r'], W: ['win', 'y'], F: ['flw', 'k'] }, m: [
        '.....<r>.....', '....<rrr>....', '...<rrrrr>...', '..<rrrrrrr>..', '...yyyyyyy...', '...yWyyyWy...', '...yyyyyyy...', '...yyybyyy...', '...yyybyyy...', '.F.yyybyyy.F.'] },
      { id: 'rocket', ico: '🚀', sp: { '<': ['sl', 'r'], '>': ['sr', 'r'], W: ['win', 'w'] }, m: [
        '......r......', '.....<r>.....', '.....www.....', '.....wWw.....', '.....www.....', '.....bbb.....', '.....www.....', '....<www>....', '...<rwwwr>...', '...rrwwwrr...', '.....oyo.....', '......o......'] },
      { id: 'heart', ico: '❤️', m: [
        '...rr...rr...', '..rrrr.rrrr..', '..rkrrrrrrr..', '..rrrrrrrrr..', '...rrrrrrr...', '....rrrrr....', '.....rrr.....', '......r......', '.............', '.............'] },
      { id: 'dog', ico: '🐶', sp: { E: ['eye', 'y'] }, m: [
        '.........yyy.', 'y.......oyEyy', 'y.......oyyyk', '.yyyyyyyyrr..', '.yyyyyyyyyy..', '.yyyyyyyyy...', '.yy.....yy...', '.yy.....yy...', '.oo.....oo...'] },
      { id: 'rainbow', ico: '🌈', m: [
        '....rrrrr....', '..rrooooorr..', '.rroyyyyyorr.', '.royygggyyor.', 'royygbbbgyyor', 'roygb...bgyor', '.............'] },
      { id: 'car', ico: '🚗', sp: { '<': ['sl', 'b'], '>': ['sr', 'b'], W: ['win', 'b'], O: ['whl', 'y'] }, m: [
        '....<WbW>....', '.bbbbbbbbbbb.', '.bbbbbbbbbby.', '...O.....O...'] }
    ],
    tiles: [
      { id: 'rocket', ico: '🚀', sp: { A: ['tbr', 'r'], B: ['tbl', 'r'], C: ['ttr', 'o'], D: ['ttl', 'o'] }, m: [
        '...AB...', '...bb...', '...oo...', '...bb...', '..AbbB..', '..rbbr..', '...CD...', '........'] },
      { id: 'house', ico: '🏠', sp: { A: ['tbr', 'r'], B: ['tbl', 'r'] }, m: [
        '...AB...', '..ArrB..', '.ArrrrB.', '..oooo..', '..oboo..', '..oopo..', '..oopo..'] },
      { id: 'boat', ico: '⛵', sp: { A: ['tbr', 'o'], E: ['tbl', 'k'], C: ['ttr', 'r'], D: ['ttl', 'r'] }, m: [
        '...Ap...', '..AopE..', '.AoopkE.', '....p...', '.CrrrrD.', 'bbbbbbbb'] },
      { id: 'fish', ico: '🐟', sp: { A: ['tbr', 'o'], B: ['tbl', 'o'], C: ['ttr', 'o'], D: ['ttl', 'o'], E: ['tbl', 'k'], F: ['ttl', 'k'] }, m: [
        '..AooB..', '.EooopB.', '.FooooD.', '..CooD..', '........', '........'] },
      { id: 'gem', ico: '💎', sp: { A: ['tbr', 'b'], B: ['tbl', 'b'], C: ['ttr', 'b'], D: ['ttl', 'b'] }, m: [
        '.AbbbbB.', '.CkbbkD.', '..CbbD..', '...CD...', '........', '........'] },
      { id: 'crown', ico: '👑', sp: { A: ['tbr', 'o'], B: ['tbl', 'o'] }, m: [
        'B..AB..A', 'oBAooBAo', 'orobboro', 'oooooooo', '........'] }
    ]
  };
  function compile(K, b) {
    const rows = b.m.slice(); while (rows.length < K.rows) rows.unshift('');
    const pieces = [], cells = new Map(), maxW = K.brick.length - 1;
    for (let y = K.rows - 1; y >= 0; y--) for (let x = 0; x < K.cols;) {
      const ch = rows[y][x] || '.', c = K.letters.indexOf(ch);
      if (c < 0) { const s = b.sp && b.sp[ch]; if (s) { const sc = K.letters.indexOf(s[1]); pieces.push({ t: s[0], c: sc, x, y }); cells.set(y * K.cols + x, { t: s[0], c: sc }); } x++; continue; }
      let n = 1; while (x + n < K.cols && rows[y][x + n] === ch) n++;
      for (let i = 0; i < n; i++) cells.set(y * K.cols + x + i, { t: K.brick[1], c });
      // a run of one colour becomes real bricks, the seams staggered row by row like a wall
      for (let left = n, at = x, first = true; left > 0; first = false) { let w = Math.min(maxW, left); if (first && (y & 1) && left > 2) w = Math.min(2, w); pieces.push({ t: K.brick[w], c, x: at, y }); at += w; left -= w; }
      x += n;
    }
    return { id: b.id, ico: b.ico, pieces, cells };
  }
  for (const k in KINDS) { const K = KINDS[k]; K.name = k; K.LW = K.cols * K.cell + K.mx * 2; K.LH = K.top + K.rows * K.cell + K.bot; K.byId = {}; K.pcs.forEach(p => { K.byId[p.id] = p; }); K.bps = BP[k].map(b => compile(K, b)); }

  // ------------------------------------------------------------------ pixel art
  const WHEEL = ['....TTTT....', '..TTTTTTTT..', '.TTTttttTTT.', '.TTttttttTT.', 'TTttLBBBttTT', 'TTttBBBBttTT', 'TTttBBBBttTT', 'TTttBBBDttTT', '.TTttttttTT.', '.TTTttttTTT.', '..TTTTTTTT..', '....TTTT....'];
  const FLOWER = ['...LP..PP...', '..LPPPPPPP..', '..PPPYYPPP..', '...PYYYYP...', '..PPPYYPPD..', '..PPPPPPDD..', '...PD..DD...', '.....NN.....', '.NN..NN.....', '..NNnNN.NN..', '.....NNNN...', '.....Nn.....'];
  const WINDOW = ['FFFFFFFF', 'FGGGGgGF', 'FGGGgGGF', 'FGGgGGGF', 'FGgGGGGF', 'FGGGGGGF', 'FGGGGGGF', 'FFFFFFFF'];
  const EYE = ['...oooo...', '.ooWWWWoo.', '.oWWWWWWo.', 'oWWWWWWWWo', 'oWWWWkkWWo', 'oWWWkWkkWo', 'oWWWkkkkWo', '.oWWWkkWo.', '.ooWWWWoo.', '...oooo...'];
  function legoBrick(g, x, y, w, s) {             // front view: studs on top, light from the top left, a darker bottom edge
    const W = w * 12;
    px(g, x, y, W, 12, s.b); px(g, x, y, W, 1, s.l); px(g, x, y + 1, 1, 10, s.l); px(g, x + W - 1, y + 1, 1, 10, s.d);
    px(g, x + 1, y + 10, W - 1, 1, s.d); px(g, x, y + 11, W, 1, s.k); px(g, x + 2, y + 2, 2, 1, s.l);
    for (let i = 0; i < w; i++) { const sx = x + i * 12 + 3; px(g, sx, y - 2, 6, 2, s.b); px(g, sx, y - 2, 5, 1, s.l); px(g, sx + 5, y - 2, 1, 2, s.d); }
  }
  function legoSprite(K, id, col) {
    const d = K.byId[id], P = K.pad, c = document.createElement('canvas'); c.width = d.w * 12 + P * 2; c.height = 12 + P * 2;
    const g = c.getContext('2d'), s = shades(col), x = P, y = P, pale = hex(col).every(v => v > 225);
    if (id === 'sl' || id === 'sr') for (let j = 0; j < 12; j++) {             // roof slope: a pixel staircase, the sloping face catches the light
      const n = j + 1, x0 = id === 'sl' ? x + 12 - n : x;
      px(g, x0, y + j, n, 1, j === 11 ? s.k : j === 10 ? s.d : s.b); px(g, id === 'sl' ? x0 : x0 + n - 1, y + j, 1, 1, s.l);
      if (j > 0 && j < 11 && n > 1) px(g, id === 'sl' ? x + 11 : x, y + j, 1, 1, id === 'sl' ? s.d : s.l);
    } else if (id === 'whl') pat(g, x, y, WHEEL, { T: '#22222c', t: '#4b4b5e', B: s.b, L: s.l, D: s.d });
    else if (id === 'flw') pat(g, x, y, FLOWER, { P: s.b, L: s.l, D: s.d, Y: /^#ff[d-f]/.test(col) || pale ? '#ff8a1c' : '#ffd32a', N: '#2f9e44', n: '#1f7a33' });
    else { legoBrick(g, x, y, d.w, s);
      if (id === 'win') pat(g, x + 2, y + 2, WINDOW, { F: pale ? '#9aa6b4' : '#ffffff', G: '#9fdcff', g: '#ffffff' });
      if (id === 'eye') pat(g, x + 1, y + 1, EYE, { o: s.k, W: '#ffffff', k: '#16161d' }); }
    return c;
  }
  // a translucent tile: bright frame, see-through middle, a glint; `halo` = only the soft light it throws around itself
  function tileSprite(K, id, col, halo) {
    const C = K.cell, P = K.pad, c = document.createElement('canvas'); c.width = c.height = C + P * 2;
    const g = c.getContext('2d'), tri = K.byId[id].tri, base = hex(col), lt = hex(mix(col, '#ffffff', 0.5));
    const depth = (i, j) => {                       // how far inside the tile a pixel is; -1 = outside
      if (i < 0 || j < 0 || i >= C || j >= C) return -1; if (!tri) return Math.min(i, j, C - 1 - i, C - 1 - j);
      const a = tri === 'br' || tri === 'tr' ? i : C - 1 - i, b = tri === 'br' || tri === 'bl' ? j : C - 1 - j, s = a + b - (C - 1);
      return s < 0 ? -1 : Math.min(C - 1 - a, C - 1 - b, Math.floor(s / 1.5));
    };
    for (let j = -P; j < C + P; j++) for (let i = -P; i < C + P; i++) {
      const e = depth(i, j); let a = 0, q = base;
      if (e < 0) { if (!halo) continue; let near = 9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (depth(i + di, j + dj) >= 0) near = Math.min(near, Math.max(Math.abs(di), Math.abs(dj))); a = near === 1 ? 0.3 : near === 2 ? 0.12 : 0; }
      else if (halo) continue;
      else if (e === 0) { a = 0.96; q = lt; } else if (e === 1) a = 0.9;
      else { a = e === 4 ? 0.6 : 0.4; if (!tri && i < 11 && j < 11 && [9, 10, 13].includes(i + j)) { a = 0.75; q = [255, 255, 255]; } }
      if (a) { g.fillStyle = `rgba(${q[0]},${q[1]},${q[2]},${a})`; g.fillRect(i + P, j + P, 1, 1); }
    }
    return c;
  }
  const SPR = {};
  function sprite(K, id, c, halo) { const k = K.name + id + c + (halo ? 'h' : ''); return SPR[k] || (SPR[k] = K.name === 'lego' ? legoSprite(K, id, K.col[c]) : tileSprite(K, id, K.col[c], halo)); }
  function plate(K) {                                 // the empty plate, drawn once
    if (K.bg) return K.bg; const c = K.bg = document.createElement('canvas'); c.width = K.LW; c.height = K.LH; const g = c.getContext('2d'), C = K.cell, y0 = K.top + K.rows * C;
    if (K.name === 'lego') {                          // sky-blue studded wall, green baseplate along the bottom
      px(g, 0, 0, K.LW, K.LH, '#a8dcf3');
      for (let r = 0; r < K.rows; r++) for (let q = 0; q < K.cols; q++) pat(g, K.mx + q * C + 4, K.top + r * C + 4, ['.LL.', 'LMMD', 'LMMD', '.DD.'], { L: '#c6ebfa', M: '#b4e3f7', D: '#8dcbe7' });
      px(g, 0, y0, K.LW, K.bot, '#43b453'); px(g, 0, y0, K.LW, 1, '#77d683'); px(g, 0, y0 + K.bot - 3, K.LW, 3, '#2f8f40'); px(g, 0, y0 + K.bot - 1, K.LW, 1, '#226f31');
      for (let q = 0; q < K.cols; q++) { const sx = K.mx + q * C + 3; px(g, sx, y0 - 2, 6, 2, '#43b453'); px(g, sx, y0 - 2, 5, 1, '#77d683'); px(g, sx + 5, y0 - 2, 1, 2, '#2f8f40'); }
    } else {                                          // dark play mat so the tiles glow
      px(g, 0, 0, K.LW, K.LH, '#131734');
      for (let r = 0; r < K.rows; r++) for (let q = 0; q < K.cols; q++) px(g, K.mx + q * C + 1, K.top + r * C + 1, C - 2, C - 2, (q + r) & 1 ? '#171c3d' : '#151a39');
      for (let r = 0; r <= K.rows; r++) for (let q = 0; q <= K.cols; q++) px(g, K.mx + q * C - 1, K.top + r * C - 1, 2, 2, '#303a70');
      px(g, 0, y0 + 2, K.LW, K.bot - 2, '#262e5c'); px(g, 0, y0 + 2, K.LW, 1, '#4350a0');
    }
    return c;
  }
  // a tiny picture of a build, u pixels per stud (thumbnails, and the model on the coffee table)
  function mini(K, pieces, u, x0, y0, bw, bh) {
    const lego = K.name === 'lego', st = lego && u >= 5 ? Math.max(1, Math.round(u / 6)) : 0, c = document.createElement('canvas');
    c.width = Math.max(1, bw * u); c.height = Math.max(1, bh * u + st); const g = c.getContext('2d');
    for (const p of pieces.slice().sort((a, b) => b.y - a.y)) {
      const d = K.byId[p.t], s = shades(K.col[p.c]), x = (p.x - x0) * u, y = (p.y - y0) * u + st, w = d.w * u, tri = d.tri || (p.t === 'sl' ? 'br' : p.t === 'sr' ? 'bl' : null);
      if (tri) { g.fillStyle = lego ? s.b : rgba(s.b, 0.9); for (let j = 0; j < u; j++) { const n = tri === 'br' || tri === 'bl' ? j + 1 : u - j; g.fillRect(tri === 'br' || tri === 'tr' ? x + u - n : x, y + j, n, 1); } if (lego && u > 2) px(g, x, y + u - 1, u, 1, s.d); continue; }
      if (!lego) { px(g, x, y, u, u, rgba(s.b, 0.82)); if (u >= 4) { g.fillStyle = s.l; g.fillRect(x, y, u, 1); g.fillRect(x, y, 1, u); g.fillStyle = s.b; g.fillRect(x + u - 1, y + 1, 1, u - 1); g.fillRect(x + 1, y + u - 1, u - 1, 1); } continue; }
      if (p.t === 'whl') { const r = u >= 4 ? 1 : 0; px(g, x + r, y, u - r * 2, u, '#22222c'); px(g, x, y + r, u, u - r * 2, '#22222c'); if (u >= 3) { const h = Math.max(1, u >> 2); px(g, x + ((u - h) >> 1), y + ((u - h) >> 1), h, h, s.b); } continue; }
      if (p.t === 'flw') { const hd = u < 3 ? Math.max(1, u - 1) : u - Math.max(1, (u / 3) | 0); px(g, x, y, u, hd, s.b); if (u >= 3) px(g, x + (u >> 1), y + (hd >> 1), 1, 1, '#ffd32a'); if (u > 1) px(g, x + ((u - 1) >> 1), y + hd, 1, u - hd, '#2f9e44'); continue; }
      px(g, x, y, w, u, s.b);
      if (u === 2) px(g, x, y + 1, w, 1, mix(s.b, '#000000', 0.12));
      if (u >= 3) { px(g, x, y, w, 1, s.l); px(g, x, y + u - 1, w, 1, s.d); }
      if (u >= 5) { px(g, x, y + 1, 1, u - 2, s.l); px(g, x + w - 1, y + 1, 1, u - 2, s.d); for (let i = 0; i < d.w; i++) { const q = u >> 2; px(g, x + i * u + q, y - st, u - q * 2, st, s.b); px(g, x + i * u + q, y - st, u - q * 2 - 1, 1, s.l); } }
      if (p.t === 'win') { const m = u >= 3 ? 1 : 0; px(g, x + m, y + m, u - m * 2, u - m * 2, '#9fdcff'); }
      if (p.t === 'eye') { const m = u > 4 ? 1 : 0, e = Math.max(1, (u / 3) | 0); if (u > 1) px(g, x + m, y + m, u - m * 2, u - m * 2, '#ffffff'); px(g, x + u - m - e - (u > 5 ? 1 : 0), y + u - m - e - (u > 5 ? 1 : 0), e, e, '#16161d'); }
    }
    return c;
  }
  function bbox(K, pieces) { let x0 = 99, y0 = 99, x1 = -1, y1 = -1; for (const p of pieces) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + K.byId[p.t].w - 1); y1 = Math.max(y1, p.y); } return { x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 }; }

  // ------------------------------------------------------------------ saved builds: { lego: { v, p: [[piece, colour, x, y], ...], bp, ok }, tiles: {...} }
  let raw, store = {}, readAt = 0, memOnly = false, cache = {};
  function read(now) {
    const t = Date.now(); if (memOnly || (!now && t - readAt < 1000)) return store; readAt = t;
    let s; try { s = localStorage.getItem(KEY); } catch (e) { memOnly = true; return store; }
    if (s !== raw) { raw = s; let o = null; try { o = JSON.parse(s); } catch (e) { } store = o && typeof o === 'object' && !Array.isArray(o) ? o : {}; cache = {}; }
    return store;
  }
  function write() { cache = {}; readAt = Date.now(); try { raw = JSON.stringify(store); localStorage.setItem(KEY, raw); } catch (e) { memOnly = true; } }
  function fits(K, occ, t, x, y) {
    const d = K.byId[t]; if (!d || x < 0 || y < 0 || y >= K.rows || x + d.w > K.cols) return false;
    for (let i = 0; i < d.w; i++) { const l = occ[y * K.cols + x + i]; if (!l.length) continue; if (d.tri && l.length === 1 && K.byId[l[0].t].tri === OPP[d.tri]) continue; return false; }
    return true;
  }
  function clean(K, arr) {                            // whatever was stored -> pieces that really fit on the plate
    const out = [], occ = Array.from({ length: K.cols * K.rows }, () => []);
    if (Array.isArray(arr)) for (const q of arr) { if (!Array.isArray(q)) continue; const p = { t: q[0], c: q[1] | 0, x: q[2] | 0, y: q[3] | 0 };
      if (!K.byId[p.t] || p.c < 0 || p.c >= K.col.length || !fits(K, occ, p.t, p.x, p.y)) continue;
      out.push(p); for (let i = 0; i < K.byId[p.t].w; i++) occ[p.y * K.cols + p.x + i].push(p); }
    return out;
  }
  const pack = pieces => pieces.map(p => [p.t, p.c, p.x, p.y]);
  function savedPieces(kind) { const K = KINDS[kind]; if (!K) return []; const st = read(), k = 'p' + kind; return cache[k] || (cache[k] = clean(K, st[kind] && st[kind].p)); }
  function count(kind) { return savedPieces(kind).length; }
  function has(kind) { return count(kind) > 0; }
  function drawModel(ctx, kind, x, y, h) {
    const K = KINDS[kind]; if (!K || !ctx) return false; const pcs = savedPieces(kind); if (!pcs.length) return false;
    h = Math.max(4, +h || 20); const b = bbox(K, pcs); let u = Math.max(1, Math.round(h / Math.max(b.bh, K.minRows))); while (u > 1 && b.bw * u > h * 2.2) u--;
    const k = 'm' + kind + u; let c = cache[k];
    if (!c) {
      if (u < K.cell) c = mini(K, pcs, u, b.x0, b.y0, b.bw, b.bh);
      else {                                          // big enough for the real sprites
        const s = Math.floor(u / K.cell), C = K.cell, P = K.pad, o = document.createElement('canvas'); o.width = b.bw * C + P * 2; o.height = b.bh * C + P; const g = o.getContext('2d');
        for (const p of pcs.slice().sort((a, q) => q.y - a.y)) g.drawImage(sprite(K, p.t, p.c), (p.x - b.x0) * C, (p.y - b.y0) * C);
        c = o; if (s > 1) { c = document.createElement('canvas'); c.width = o.width * s; c.height = o.height * s; const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(o, 0, 0, c.width, c.height); }
      }
      cache[k] = c;
    }
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height)); ctx.imageSmoothingEnabled = sm;
    return true;
  }

  // ------------------------------------------------------------------ sound (all optional)
  const au = () => (typeof Audio2 !== 'undefined' && Audio2) || null;
  const blip = (n, type, len, vol) => { try { const a = au(); a && a.blip(n, type, len, vol); } catch (e) { } };
  const jingle = (n, step, type) => { try { const a = au(); a && a.jingle(n, step, type); } catch (e) { } };
  const whoosh = up => { try { const a = au(); a && a.whoosh(up); } catch (e) { } };
  const popSound = () => { try { if (typeof chip === 'function') { chip('pop'); return; } } catch (e) { } blip(9, 'triangle', 0.07, 0.14); };
  const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]; let lastSnd = 0;
  function placeSound(K, row) {                       // a short rising blip; the higher up the plate, the higher the note
    const now = performance.now(); if (now - lastSnd < 45) return; lastSnd = now;
    const n = PENT[clampI(K.rows - 1 - row, 0, PENT.length - 1)] - 12, type = K.name === 'lego' ? 'triangle' : 'sine';
    blip(n, type, 0.06, 0.17); setTimeout(() => blip(n + 7, type, K.name === 'lego' ? 0.07 : 0.16, 0.13), 50);
  }

  // ------------------------------------------------------------------ the builder
  let S = null;
  function css() {
    if (document.getElementById('bk-css')) return; const s = document.createElement('style'); s.id = 'bk-css';
    s.textContent = `
.bk-off{display:none!important}
.bk-body{flex:1 1 auto;min-height:0;min-width:0;display:flex;flex-direction:column;gap:${GAP}px;margin-top:6px}
.bk-stage{position:relative;flex:0 0 auto;display:flex;align-items:center;justify-content:center}
.bk-cv{display:block;flex:0 0 auto;image-rendering:pixelated;touch-action:none;border-radius:10px;box-shadow:0 0 0 3px #fff,0 4px 0 3px rgba(0,0,0,.3)}
.bk-cv.bk-shake{animation:bk-shake .26s}
@keyframes bk-shake{20%{transform:translateX(-4px)}45%{transform:translateX(4px)}70%{transform:translateX(-3px)}90%{transform:translateX(2px)}}
.bk-side{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:${GAP}px;padding:4px;overflow:auto;scrollbar-width:none}
.bk-side::-webkit-scrollbar,.bk-grp::-webkit-scrollbar{display:none}
.bk-grp{display:grid;gap:${GAP}px;grid-template-columns:repeat(var(--n),minmax(0,1fr));grid-auto-rows:minmax(60px,1fr);flex:var(--r) 1 auto;max-height:calc(var(--r)*86px)}
.bk-b{position:relative;min-width:60px;min-height:60px;margin:0;padding:0;border-radius:16px;background:#fff;color:#000;font-size:32px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(0,0,0,.3);transition:transform .1s}
.bk-b:active{transform:translateY(2px)}
.bk-b.on{background:#ffcf4a}
.bk-b canvas{image-rendering:pixelated;pointer-events:none;height:auto;max-width:calc(100% - 10px)}
.bk-col{box-shadow:inset 0 6px 0 rgba(255,255,255,.35),inset 0 -7px 0 rgba(0,0,0,.2),0 4px 0 rgba(0,0,0,.3)}
.bk-col.on{box-shadow:inset 0 6px 0 rgba(255,255,255,.35),inset 0 -7px 0 rgba(0,0,0,.2),0 0 0 4px #fff}
.bk-col.on::after{content:"";width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(0,0,0,.45)}
.bk-pc{background:#e4ecf8}
.bk-pc.on{background:#ffcf4a;box-shadow:0 0 0 4px #fff}
.bk-tiles .bk-pc{background:#1d2448}
.bk-tiles .bk-pc.on{background:#3d4ca0;box-shadow:0 0 0 4px #ffcf4a}
.bk-go{background:#7bd36b}
.bk-hop{animation:bk-hop .32s 6 alternate}
@keyframes bk-hop{to{transform:translateY(-7px) scale(1.07)}}
.pbtn.bk-ask,.bk-b.bk-ask{background:#ffcf4a;animation:bk-ask .25s 4 alternate}
@keyframes bk-ask{to{transform:rotate(-9deg) scale(1.08)}}
.bk-roll{animation:bk-roll .5s linear infinite}
@keyframes bk-roll{50%{transform:rotate(14deg) scale(1.08)}}
.bk-draw{position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border-radius:12px;background:rgba(30,22,50,.93);animation:bk-in .16s both}
@keyframes bk-in{from{opacity:0;transform:scale(.94)}}
.bk-bp{min-width:0;min-height:0;background:#cfeaf9;overflow:hidden}
.bk-tiles .bk-bp{background:#1d2448}
.bk-bp canvas{width:82%;height:calc(100% - 52px);max-width:none;object-fit:contain;margin-top:30px}
.bk-bp i{position:absolute;left:5px;top:4px;font-style:normal;font-size:26px}
.bk-bp.on{box-shadow:0 0 0 5px #ffcf4a}
#app:has(.bk-body) #wishBtn,#app:has(.bk-body) #reqBtn{display:none}
#panel>.bk-top.bk-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:60px;flex-direction:column;gap:6px}
#panel>.bk-top.bk-land .ttl{flex:0 0 auto;font-size:26px}
#panel>.bk-body.bk-land{flex-direction:row;margin:0 0 0 68px}
.bk-strip .bk-grp{display:flex;flex:0 0 auto;max-height:none;overflow-x:auto;padding:4px;scrollbar-width:none}
.bk-strip .bk-grp>*{flex:0 0 62px;height:60px}
.bk-strip .bk-tools>*{flex:1 0 60px}
.bk-narrow{justify-content:flex-start}
.bk-narrow .bk-grp{grid-template-columns:repeat(auto-fill,minmax(60px,1fr));grid-auto-rows:60px;flex:0 0 auto;max-height:none}
`;
    document.head.append(s);
  }
  const tap = (cls, txt, label, fn) => { const b = mk('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('pointerup', e => { e.stopPropagation(); if (S) fn(b); }); return b; };

  function open(opts) {
    opts = opts || {}; const kind = KINDS[opts.kind] ? opts.kind : 'lego', K = KINDS[kind], panel = document.getElementById('panel'); if (!panel) return false;
    if (S) teardown();
    try { UI.closeActions(); } catch (e) { }
    try { clearWish(); } catch (e) { }
    css(); panel.innerHTML = ''; panel.classList.remove('hidden');
    const sv = read(true)[kind] || {};
    S = { K, kind, opts, panel, pieces: clean(K, sv.p), undo: [], color: 0, piece: K.first, bp: K.bps.find(b => b.id === sv.bp) || null, fly: [], fx: [], edges: [], wob: null, wig: 0, auto: null, ptr: null, iconCol: -1 };
    S.hers = S.pieces.length > 0;
    // top row: ❌ first (the sideways ❌ and the rest of the game look for it there), picture title, undo, clear
    const top = S.top = mk('div', 'ptop bk-top');
    S.undoB = tap('pbtn', '↩️', 'undo', undo); S.clearB = tap('pbtn', '🗑️', 'clear', clearTap);
    top.append(tap('pbtn', '❌', 'close', () => finish(false)), mk('div', 'ttl', K.ico), S.undoB, S.clearB);
    const body = S.body = mk('div', 'bk-body bk-' + kind), stage = S.stage = mk('div', 'bk-stage'), cv = S.cv = mk('canvas', 'bk-cv');
    cv.width = K.LW; cv.height = K.LH; S.g = cv.getContext('2d'); S.g.imageSmoothingEnabled = false;
    // pictures to copy
    const dr = S.drawer = mk('div', 'bk-draw bk-off'); dr.addEventListener('pointerup', e => { if (e.target === dr) toggleDrawer(false); });
    for (const b of K.bps) { const n = tap('bk-b bk-bp', '', 'idea ' + b.id, () => pickBp(b.id)); n.dataset.id = b.id; const bb = bbox(K, b.pieces); n.append(mini(K, b.pieces, kind === 'lego' ? 6 : 8, bb.x0, bb.y0, bb.bw, bb.bh), mk('i', '', b.ico)); dr.append(n); }
    stage.append(cv, dr);
    // colours, pieces, tools
    const side = S.side = mk('div', 'bk-side');
    const grp = (cls, n, items) => { const d = mk('div', 'bk-grp ' + cls); d.style.setProperty('--n', n); d.style.setProperty('--r', Math.ceil(items / n)); side.append(d); return d; };
    const gc = S.gc = grp('bk-cols', K.cpr, K.col.length + 2);
    K.col.forEach((c, i) => { const b = tap('bk-b bk-col', '', 'colour ' + (i + 1), () => { S.color = i; blip(i * 2, 'triangle', 0.06, 0.12); sync(); }); b.style.background = c; gc.append(b); });
    const gp = grp('bk-pcs', K.ppr, K.pcs.length);
    K.pcs.forEach(d => { const b = tap('bk-b bk-pc', '', 'piece ' + d.id, () => { S.piece = d.id; blip(7, 'square', 0.05, 0.1); sync(); }); b.dataset.id = d.id; b.append(mk('canvas')); gp.append(b); });
    S.gt = grp('bk-tools', 1, 1);
    S.bpB = tap('bk-b', '💡', 'ideas', () => toggleDrawer()); S.diceB = tap('bk-b', '🎲', 'surprise', dice); S.doneB = tap('', '✅', 'done', () => finish(true));
    body.append(stage, side); panel.append(top, body);
    rebuild(); S.was = complete(); layout(); sync(); bind();
    S.onResize = () => { layout(); clearTimeout(S.rzT); const st = S; S.rzT = setTimeout(() => { if (S === st) layout(); }, 320); };
    addEventListener('resize', S.onResize); addEventListener('orientationchange', S.onResize);
    S.onHide = () => { if (S && document.visibilityState !== 'visible') persist(); };
    document.addEventListener('visibilitychange', S.onHide); addEventListener('pagehide', S.onHide);
    S.raf = requestAnimationFrame(frame);
    jingle([0, 7, 12], 0.06); try { au().preload(['assets/sfx/chip_pop.mp3']); } catch (e) { }
    return true;
  }

  // the plate as large as it can be: colours and pieces below it when upright, beside it when sideways
  function layout() {
    if (!S) return; const K = S.K, land = innerWidth > innerHeight, asp = K.LW / K.LH, M = 4, SP = 8;
    S.top.classList.toggle('bk-land', land); S.body.classList.toggle('bk-land', land); S.side.classList.remove('bk-strip', 'bk-narrow');
    const W = S.body.clientWidth, H = S.body.clientHeight, rows = Math.ceil((K.col.length + 2) / K.cpr) + Math.ceil(K.pcs.length / K.ppr);
    let pw, ph, strip = false;
    if (!land) {
      const fit = room => Math.min((W - M * 2) / asp, room - M * 2 - 4);
      let h = fit(H - GAP - (rows * 60 + (rows - 1) * GAP + SP)); const hs = fit(H - GAP - (3 * 68 + 2 * GAP + SP));
      if (h < hs * 0.86) { strip = true; S.side.classList.add('bk-strip'); h = hs; }      // a short screen: colours and pieces become sideways-scrolling strips
      ph = Math.max(h, 80); pw = ph * asp; S.stage.style.width = ''; S.stage.style.height = Math.round(ph + M * 2 + 4) + 'px';
    } else {
      const fit = room => Math.min((H - M * 2 - 4) * asp, room - M * 2);
      let w = fit(W - GAP - (K.ppr * 60 + (K.ppr - 1) * GAP + SP)); const wn = fit(W - GAP - (3 * 60 + 2 * GAP + SP));
      if (w < wn * 0.86) { S.side.classList.add('bk-narrow'); w = wn; }      // a narrow screen: fewer buttons per row, the side scrolls
      pw = Math.max(w, 80); ph = pw / asp; S.stage.style.height = ''; S.stage.style.width = Math.round(pw + M * 2) + 'px';
    }
    S.cv.style.width = Math.floor(pw) + 'px'; S.cv.style.height = Math.floor(ph) + 'px'; S.cellCss = pw / K.LW * K.cell;
    // ✅ sits top right when upright (where the drawing studio keeps its save) and under the pieces when sideways; 💡 🎲 follow the colours
    const d = S.doneB, home = land ? S.gt : S.top; if (d.parentNode !== home) home.append(d);
    d.classList.toggle('pbtn', !land); d.classList.toggle('go', !land); d.classList.toggle('bk-b', land); d.classList.toggle('bk-go', land);
    const ideas = strip ? S.gt : S.gc; if (S.bpB.parentNode !== ideas) ideas.append(S.bpB, S.diceB);
    S.gt.classList.toggle('bk-off', !land && !strip);
  }
  function sync() {
    if (!S) return; const K = S.K;
    S.side.querySelectorAll('.bk-col').forEach((b, i) => b.classList.toggle('on', i === S.color));
    S.side.querySelectorAll('.bk-pc').forEach(b => {
      b.classList.toggle('on', b.dataset.id === S.piece); if (S.iconCol === S.color) return;
      const s = sprite(K, b.dataset.id, S.color), c = b.firstChild; c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0);
      c.style.width = Math.round(s.width * (K.name === 'lego' ? [0, 2.6, 2.2, 1.6, 1.25][K.byId[b.dataset.id].w] : 2.1)) + 'px'; });
    S.iconCol = S.color; S.undoB.disabled = !S.undo.length;
    S.bpB.textContent = S.bp ? S.bp.ico : '💡'; S.bpB.classList.toggle('on', !!S.bp); S.diceB.classList.toggle('bk-roll', !!S.auto);
  }

  // ---------------------------------------------------------------- pieces on the plate
  function rebuild() {
    const K = S.K; S.occ = Array.from({ length: K.cols * K.rows }, () => []);
    for (const p of S.pieces) for (let i = 0; i < K.byId[p.t].w; i++) S.occ[p.y * K.cols + p.x + i].push(p);
    S.order = S.pieces.slice().sort((a, b) => b.y - a.y || a.x - b.x);          // bottom rows first: a brick hides the studs of the one below
    S.edges = []; if (K.name !== 'tiles') return;
    // where two tiles touch along a whole edge (or share a square) the join lights up
    const C = K.cell, side = (idx, s) => S.occ[idx].some(p => { const t = K.byId[p.t].tri; return !t || (s === 'N' ? t[0] === 't' : s === 'S' ? t[0] === 'b' : s === 'W' ? t[1] === 'l' : t[1] === 'r'); });
    for (let r = 0; r < K.rows; r++) for (let q = 0; q < K.cols; q++) { const i = r * K.cols + q, l = S.occ[i]; if (!l.length) continue; const x = K.mx + q * C, y = K.top + r * C;
      if (q + 1 < K.cols && side(i, 'E') && side(i + 1, 'W')) S.edges.push([x + C - 1, y + 1, 2, C - 2]);
      if (r + 1 < K.rows && side(i, 'S') && side(i + K.cols, 'N')) S.edges.push([x + 1, y + C - 1, C - 2, 2]);
      if (l.length === 2) { const up = K.byId[l[0].t].tri === 'br' || K.byId[l[0].t].tri === 'tl'; for (let k = 1; k < C - 1; k++) S.edges.push([up ? x + C - 1 - k : x + k, y + k, 1, 1]); } }
  }
  function complete() { if (!S || !S.bp) return false; for (const idx of S.bp.cells.keys()) if (!S.occ[idx].length) return false; return true; }
  function pushUndo() { S.undo.push(JSON.stringify(pack(S.pieces))); if (S.undo.length > 40) S.undo.shift(); S.undoB.disabled = false; }
  function touch() { clearTimeout(S.saveT); const st = S; S.saveT = setTimeout(() => { if (S === st) persist(); }, 400); }
  function persist() { if (!S) return; clearTimeout(S.saveT); const st = read(true); st[S.kind] = { v: 1, p: pack(S.pieces), bp: S.bp ? S.bp.id : null, ok: complete() ? 1 : 0 }; write(); }
  function after() { const c = complete(); if (c && !S.was) celebrate(); S.was = c; touch(); }
  const cellX = (K, q) => K.mx + q * K.cell, cellY = (K, r) => K.top + r * K.cell;
  function put(t, c, x, y) {
    const K = S.K, now = performance.now(); S.pieces.push({ t, c, x, y, t0: now }); rebuild(); placeSound(K, y);
    S.fx.push({ spark: 1, x: cellX(K, x) + (K.byId[t].w * K.cell >> 1), y: cellY(K, y) + 1, c: '#ffffff', t0: now + 60, life: 0.28 }); after();
  }
  function fling(p, far) { const K = S.K; S.fly.push({ s: sprite(K, p.t, p.c), x: cellX(K, p.x) - K.pad, y: cellY(K, p.y) - K.pad, vx: (Math.random() - 0.5) * (far ? 160 : 70), vy: -80 - Math.random() * (far ? 90 : 30), t0: performance.now() }); }
  function lift(p) { const i = S.pieces.indexOf(p); if (i < 0) return; S.pieces.splice(i, 1); fling(p); popSound(); rebuild(); after(); }
  function nope(t, x, y) {                            // it does not fit: the piece shivers and a low note says no
    S.wob = { t, c: S.color, x, y, t0: performance.now() }; blip(-17, 'sawtooth', 0.14, 0.13);
    S.cv.classList.remove('bk-shake'); void S.cv.offsetWidth; S.cv.classList.add('bk-shake');
  }
  // finger down on a stud: lift what is there, or put the chosen piece (slid sideways if that is what makes it fit)
  function press(c) {
    const K = S.K, list = S.occ[c.row * K.cols + c.col], sel = K.byId[S.piece]; let hit = null;
    for (const p of list) { const tri = K.byId[p.t].tri; if (!tri || inHalf(tri, c.u, c.v)) hit = p; }
    if (!hit && list.length === 1) {                  // the empty half next to a triangle: a triangle fills it, anything else lifts the one that is there
      const twin = sel.tri && K.pcs.find(d => d.tri === OPP[K.byId[list[0].t].tri]);
      if (twin) { pushUndo(); put(twin.id, S.color, c.col, c.row); return 'none'; }
      hit = list[0];
    }
    if (hit) { pushUndo(); lift(hit); return 'none'; }
    const w = sel.w, lo = Math.max(0, c.col - w + 1), hi = Math.min(c.col, K.cols - w), want = clampI(c.col - ((w - 1) >> 1), lo, hi); let best = -1;
    for (let a = lo; a <= hi; a++) if (fits(K, S.occ, sel.id, a, c.row) && (best < 0 || Math.abs(a - want) < Math.abs(best - want))) best = a;
    if (best < 0) { nope(sel.id, want, c.row); return 'none'; }
    pushUndo(); put(sel.id, S.color, best, c.row); return 'paint';
  }
  function bind() {
    const cv = S.cv;
    const at = (cx, cy) => { const K = S.K, r = cv.getBoundingClientRect(), fx = ((cx - r.left) / r.width * K.LW - K.mx) / K.cell, fy = ((cy - r.top) / r.height * K.LH - K.top) / K.cell;
      if (fx < -0.7 || fy < -0.7 || fx > K.cols + 0.7 || fy > K.rows + 0.9) return null;
      const col = clampI(Math.floor(fx), 0, K.cols - 1), row = clampI(Math.floor(fy), 0, K.rows - 1); return { col, row, u: clampI(fx - col, 0, 0.999), v: clampI(fy - row, 0, 0.999) }; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!S || S.auto || e.isPrimary === false) return;
      const c = at(e.clientX, e.clientY); if (!c) return; try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      S.hers = true; S.ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, last: c.row * S.K.cols + c.col, on: false, mode: press(c) };
    });
    // a finger sliding over empty studs leaves a trail of single bricks
    cv.addEventListener('pointermove', e => {
      const P = S && S.ptr; if (!P || P.id !== e.pointerId || P.mode !== 'paint' || S.auto) return;
      if (!P.on) { if (Math.hypot(e.clientX - P.x0, e.clientY - P.y0) < Math.max(9, S.cellCss * 0.4)) return; P.on = true; }
      const K = S.K, dx = e.clientX - P.lx, dy = e.clientY - P.ly, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (S.cellCss * 0.4)));
      for (let i = 1; i <= n; i++) { const c = at(P.lx + dx * i / n, P.ly + dy * i / n); if (!c) continue; const k = c.row * K.cols + c.col; if (k === P.last) continue; P.last = k;
        if (!S.occ[k].length) put(K.byId[S.piece].w === 1 ? S.piece : K.brick[1], S.color, c.col, c.row); }
      P.lx = e.clientX; P.ly = e.clientY;
    });
    const up = e => { if (S && S.ptr && S.ptr.id === e.pointerId) S.ptr = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  }

  // ---------------------------------------------------------------- buttons
  function undo() { stopAuto(); if (!S.undo.length) return; let a = []; try { a = JSON.parse(S.undo.pop()); } catch (e) { } S.pieces = clean(S.K, a); rebuild(); S.was = complete(); S.hers = S.pieces.length > 0; blip(-5); touch(); sync(); }
  // anything that sweeps her work away takes two taps, like the bin in the drawing studio: the first tap only asks (❓ for 2 s)
  function sure(b, ico, ask, go) {
    const calm = () => { clearTimeout(b._t); delete b.dataset.sure; b.textContent = ico; b.classList.remove('bk-ask'); };
    if (b.dataset.sure || !ask) { calm(); go(); return; }
    b.dataset.sure = 1; b.textContent = '❓'; b.classList.add('bk-ask'); blip(2, 'triangle', 0.08, 0.12); b._t = setTimeout(calm, 2000);
  }
  function clearTap(b) { sure(b, '🗑️', true, () => { stopAuto(); if (!S.pieces.length) return; pushUndo(); S.pieces.forEach(p => fling(p, true)); S.pieces = []; rebuild(); S.was = S.hers = false; whoosh(false); touch(); sync(); }); }
  function toggleDrawer(show) {
    const d = S.drawer; if (show == null) show = d.classList.contains('bk-off'); if (show === !d.classList.contains('bk-off')) return;
    d.classList.toggle('bk-off', !show); if (show) { whoosh(true); for (const b of d.children) b.classList.toggle('on', !!S.bp && b.dataset.id === S.bp.id); }
  }
  function pickBp(id) {                               // a faint picture to fill in; tapping the chosen one again puts it away
    stopAuto(); S.bp = S.bp && S.bp.id === id ? null : S.K.bps.find(b => b.id === id) || null; S.was = complete(); toggleDrawer(false);
    jingle(S.bp ? [0, 7, 12] : [12, 7], 0.06); touch(); sync();
  }
  function stopAuto() { if (S && S.auto) { clearInterval(S.auto); S.auto = null; sync(); } }
  function dice(b) { sure(b, '🎲', S.hers && S.pieces.length > 0 && !S.auto, roll); }      // only asks when it would sweep away something she built herself
  function roll() {                                   // builds a surprise picture brick by brick
    stopAuto(); toggleDrawer(false); const K = S.K, st = S, opts = K.bps.filter(b => b !== S.bp), bp = opts[(Math.random() * opts.length) | 0]; if (!bp) return;
    pushUndo(); S.pieces.forEach(p => fling(p, true)); S.pieces = []; rebuild(); S.bp = bp; S.was = S.hers = false; whoosh(true); touch();
    let i = 0; const iv = S.auto = setInterval(() => {
      if (S !== st || S.auto !== iv) { clearInterval(iv); return; }
      const p = bp.pieces[i++]; if (!p) { clearInterval(iv); S.auto = null; sync(); return; }
      if (fits(K, S.occ, p.t, p.x, p.y)) put(p.t, p.c, p.x, p.y);
    }, 105);
    sync();
  }
  function celebrate() {
    const K = S.K, now = performance.now(), cols = K.col.concat(['#ffffff', '#ffe36a']); S.wig = now; jingle([0, 4, 7, 12, 16]);
    for (let i = 0; i < 80; i++) S.fx.push({ x: Math.random() * K.LW, y: -3 - Math.random() * 24, vx: (Math.random() - 0.5) * 26, vy: 28 + Math.random() * 46, c: cols[i % cols.length], ph: Math.random() * 6, t0: now + Math.random() * 600, life: 2.8 });
    for (const idx of S.bp.cells.keys()) if (Math.random() < 0.4) S.fx.push({ spark: 1, x: cellX(K, idx % K.cols) + 2 + (Math.random() * (K.cell - 4) | 0), y: cellY(K, (idx / K.cols) | 0) + 2 + (Math.random() * (K.cell - 4) | 0), c: Math.random() < 0.5 ? '#ffffff' : '#fff3a0', t0: now + Math.random() * 1500, life: 0.5 });
    S.doneB.classList.remove('bk-hop'); void S.doneB.offsetWidth; S.doneB.classList.add('bk-hop');
  }

  // ---------------------------------------------------------------- drawing the plate
  function frame(now) {
    if (!S) return;
    if (!S.body.isConnected || S.panel.classList.contains('hidden')) { const st = S; persist(); teardown(); try { if (typeof setMusic === 'function') setMusic(); } catch (e) { } if (st.opts.onClose) st.opts.onClose(); return; }   // something else closed the panel
    draw(now); S.raf = requestAnimationFrame(frame);
  }
  function draw(now) {
    const K = S.K, g = S.g, lego = K.name === 'lego', P = K.pad, C = K.cell;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(plate(K), 0, 0);
    if (S.bp) {                                       // the picture to fill in: faint, breathing
      const a = 0.5 + 0.5 * Math.sin(now / 300);
      for (const [idx, q] of S.bp.cells) { if (S.occ[idx].length) continue; const x = cellX(K, idx % K.cols), y = cellY(K, (idx / K.cols) | 0);
        if (lego) { g.globalAlpha = 0.3 + 0.12 * a; px(g, x, y, C, C, '#ffffff'); g.globalAlpha = 0.34 + 0.16 * a; } else g.globalAlpha = 0.2 + 0.16 * a;
        g.drawImage(sprite(K, q.t, q.c), x - P, y - P); }
      g.globalAlpha = 1;
    }
    const wk = S.wig ? (now - S.wig) / 1700 : 1, wa = wk < 1 ? 1 - wk : 0; if (wk >= 1) S.wig = 0;      // the finished model dances
    const hop = wa ? -Math.round(Math.abs(Math.sin(wk * Math.PI * 6)) * 3 * wa) : 0;
    const off = p => { let dx = 0, dy = hop; if (wa) dx = Math.round(Math.sin(wk * Math.PI * 10 + p.y * 0.8) * 2 * wa);
      if (p.t0) { const k = (now - p.t0) / 130; if (k < 1) dy -= Math.round((1 - k) * (1 - k) * 5); else p.t0 = 0; } return [dx, dy]; };
    for (const p of S.order) { const [dx, dy] = off(p); g.drawImage(sprite(K, p.t, p.c), cellX(K, p.x) - P + dx, cellY(K, p.y) - P + dy); }
    if (!lego) {                                      // tiles glow: a soft halo each, brighter where they join
      g.globalCompositeOperation = 'lighter';
      for (const p of S.order) { const [dx, dy] = off(p); g.drawImage(sprite(K, p.t, p.c, true), cellX(K, p.x) - P + dx, cellY(K, p.y) - P + dy); }
      if (!wa) { g.fillStyle = `rgba(255,255,255,${(0.11 + 0.06 * Math.sin(now / 420)).toFixed(3)})`; for (const e of S.edges) g.fillRect(e[0], e[1], e[2], e[3]); }
      g.globalCompositeOperation = 'source-over';
    }
    for (let i = S.fly.length - 1; i >= 0; i--) {     // pieces that were lifted off tumble away
      const f = S.fly[i], t = (now - f.t0) / 1000, k = t / 0.55; if (k >= 1) { S.fly.splice(i, 1); continue; }
      g.globalAlpha = 1 - k * k; g.drawImage(f.s, Math.round(f.x + f.vx * t), Math.round(f.y + f.vy * t + 420 * t * t));
    }
    g.globalAlpha = 1;
    if (S.wob) { const k = (now - S.wob.t0) / 340; if (k >= 1) S.wob = null; else { g.globalAlpha = 0.65 - k * 0.3; g.drawImage(sprite(K, S.wob.t, S.wob.c), cellX(K, S.wob.x) - P + Math.round(Math.sin(k * Math.PI * 6) * 2), cellY(K, S.wob.y) - P); g.globalAlpha = 1; } }
    for (let i = S.fx.length - 1; i >= 0; i--) {      // confetti and sparkles
      const q = S.fx[i], t = (now - q.t0) / 1000; if (t < 0) continue; if (t > q.life) { S.fx.splice(i, 1); continue; }
      g.fillStyle = q.c;
      if (q.spark) { const k = t / q.life, r = Math.max(0, Math.round((k < 0.5 ? k : 1 - k) * 6)); g.fillRect(q.x - r, q.y, r * 2 + 1, 1); g.fillRect(q.x, q.y - r, 1, r * 2 + 1); }
      else g.fillRect(Math.round(q.x + q.vx * t + Math.sin(t * 8 + q.ph) * 3), Math.round(q.y + q.vy * t + 45 * t * t), 2, (Math.floor(t * 8 + q.ph) & 1) ? 1 : 2);
    }
  }

  // ---------------------------------------------------------------- leaving
  function teardown() {
    if (!S) return; cancelAnimationFrame(S.raf); clearInterval(S.auto); clearTimeout(S.saveT); clearTimeout(S.rzT);
    removeEventListener('resize', S.onResize); removeEventListener('orientationchange', S.onResize);
    document.removeEventListener('visibilitychange', S.onHide); removeEventListener('pagehide', S.onHide);
    S = null;
  }
  function finish(done) {                             // ✅ = done (tell the room), ❌ = just leave; either way the build is kept for next time
    if (!S) return; const st = S; stopAuto(); persist();
    const res = { kind: st.kind, count: st.pieces.length, complete: complete(), blueprint: st.bp ? st.bp.id : null, icon: st.bp ? st.bp.ico : null };
    teardown(); st.panel.classList.add('hidden'); st.panel.innerHTML = '';
    try { if (typeof setMusic === 'function') setMusic(); } catch (e) { }
    if (done) { jingle([0, 4, 7, 12], 0.06); if (typeof st.opts.onDone === 'function') st.opts.onDone(res); }
    else if (typeof st.opts.onClose === 'function') st.opts.onClose(res);
  }
  function state() {                                  // a peek for tests
    if (!S) return { open: false };
    return { open: true, kind: S.kind, count: S.pieces.length, pieces: pack(S.pieces), blueprint: S.bp ? S.bp.id : null, complete: complete(), auto: !!S.auto, undo: S.undo.length, color: S.color, piece: S.piece,
      grid: { cols: S.K.cols, rows: S.K.rows, cell: S.K.cell, mx: S.K.mx, top: S.K.top, LW: S.K.LW, LH: S.K.LH }, ghost: S.bp ? Array.from(S.bp.cells.keys()) : [], ideas: S.K.bps.map(b => ({ id: b.id, ico: b.ico, pieces: pack(b.pieces) })) };
  }

  window.Bricks = { open, close: () => finish(false), has, count, drawModel, state, get active() { return !!S; } };
})();
