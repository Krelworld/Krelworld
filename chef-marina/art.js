// Chef Marina — full-screen Art Studio (replaces the small drawing tab)
// Layout cues from kids' drawing apps: canvas fills the screen, tool tray along the bottom,
// colour strip, sticker tray, magic brushes, fill bucket, colouring pages, undo/redo.
const Studio = (() => {
  const COLORS = ['#e8312a', '#ff8a1e', '#ffd21e', '#9be03a', '#2fb84a', '#19c3b1', '#2a9df4', '#3454d1', '#7b4cf0', '#c05cf0', '#ff6ab8', '#ffb3c7', '#f2c9a0', '#a8672e', '#7a4a26', '#111111', '#8a8f98', '#ffffff'];
  const TOOLS = [['marker', '🖍️'], ['brush', '🖌️'], ['pencil', '✏️'], ['glitter', '✨'], ['rainbow', '🌈'], ['neon', '💡'], ['spray', '💨'], ['magic', '🪄'], ['fill', '🪣'], ['sticker', '🦄'], ['erase', '🧽']];
  const SIZES = [6, 14, 28];
  const EMOJI_STICKERS = ['⭐', '💖', '🌈', '🦄', '🐱', '🐶', '🦋', '🌸', '🌻', '🍓', '🍦', '🎂', '🎈', '👑', '🧚', '🐠', '🦖', '🚀', '🌙', '☀️', '☁️', '🏠', '🌳', '🍕', '😀', '😍', '🤪', '👻', '💩', '❄️'];
  const SPRITE_STICKERS = ['marina', 'daddy', 'mommy', 'rory', 'miles', 'niko_sit', 'niko', 'dish_cake', 'dish_cupcakes', 'dish_pizza', 'dish_sundae', 'dish_slime', 'toy_unicorn', 'toy_teddy', 'toy_robotdog', 'o_princess', 'o_fairy', 'snowman'];
  const PAGES = ['marina', 'niko_sit', 'o_princess', 'o_fairy', 'dish_cake', 'dish_cupcakes', 'dish_sundae', 'miles', 'daddy', 'mommy', 'snowman', 'toy_unicorn', 'swingset', 'cat_tower'];
  const PAPERS = ['#ffffff', '#fff6d6', '#ffe3f1', '#dff3ff', '#e6ffe6', '#1b1b3a'];
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cm_' + k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) { } } };
  let S = null;

  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const onTap = (n, fn) => n.addEventListener('pointerup', e => { e.stopPropagation(); fn(e); });

  function open() {
    if (S) return;
    const root = mk('div'); root.id = 'studio';
    root.innerHTML = '<div class="s-top"></div><div class="s-area"><div class="s-paper"><canvas class="l-paint"></canvas><canvas class="l-lines"></canvas><canvas class="l-fx"></canvas></div></div><div class="s-drawer hidden"></div><div class="s-colors"></div><div class="s-tools"></div>';
    document.body.append(root);
    S = { root, tool: 'marker', color: COLORS[0], size: 1, mirror: false, sticker: '⭐', paper: '#ffffff', undo: [], redo: [], hue: 0, magicI: 0, last: null, dist: 0 };
    S.area = root.querySelector('.s-area'); S.paperEl = root.querySelector('.s-paper'); S.drawer = root.querySelector('.s-drawer');
    S.paint = root.querySelector('.l-paint'); S.lines = root.querySelector('.l-lines'); S.fx = root.querySelector('.l-fx');
    buildTop(); buildColors(); buildTools();
    // fixed bitmap size from the first layout; CSS scales it afterwards
    const r = S.area.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    let W = Math.round(r.width * d), H = Math.round(r.height * d); const k = Math.min(1, 1300 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    for (const c of [S.paint, S.lines, S.fx]) { c.width = W; c.height = H; }
    S.W = W; S.H = H; S.u = Math.max(W, H) / 700; // unit so brush sizes feel the same on any screen
    S.pc = S.paint.getContext('2d', { willReadFrequently: true }); S.lc = S.lines.getContext('2d', { willReadFrequently: true }); S.fc = S.fx.getContext('2d');
    S.paperEl.style.background = S.paper;
    layout();
    S.onResize = () => layout(); window.addEventListener('resize', S.onResize);
    const prev = store.get('studioDraft'); if (prev) { const im = new Image(); im.onload = () => { if (S) S.pc.drawImage(im, 0, 0, W, H); }; im.src = prev; }
    bindCanvas();
    try { Audio2.Music.set('crafts'); say('m_draw'); } catch (e) { }
    S.raf = requestAnimationFrame(twinkle);
  }
  function close() {
    if (!S) return;
    try { if (S.dirty) save(true); store.set('studioDraft', S.paint.toDataURL('image/png')); } catch (e) { }
    cancelAnimationFrame(S.raf); window.removeEventListener('resize', S.onResize); S.root.remove(); S = null;
    try { setMusic(); } catch (e) { }
  }
  function layout() {
    const r = S.area.getBoundingClientRect(), sc = Math.min(r.width / S.W, r.height / S.H);
    S.paperEl.style.width = S.W * sc + 'px'; S.paperEl.style.height = S.H * sc + 'px';
  }

  // ---------------------------------------------------------------- top bar
  function buildTop() {
    const t = S.root.querySelector('.s-top'); t.innerHTML = '';
    const b = (ico, label, fn, cls) => { const n = mk('button', 's-btn ' + (cls || ''), ico); n.setAttribute('aria-label', label); onTap(n, () => fn(n)); t.append(n); return n; };
    b('❌', 'close', close);
    S.undoB = b('↩️', 'undo', undo); S.redoB = b('↪️', 'redo', redo);
    S.mirB = b('🦋', 'mirror', n => { S.mirror = !S.mirror; n.classList.toggle('on', S.mirror); Audio2.blip(S.mirror ? 12 : 0); drawGuide(); });
    b('📄', 'pages', () => toggleDrawer('pages'));
    b('🗑️', 'clear', n => { if (n.dataset.sure) { snap(); S.pc.clearRect(0, 0, S.W, S.H); delete n.dataset.sure; n.textContent = '🗑️'; Audio2.whoosh(false); } else { n.dataset.sure = 1; n.textContent = '❓'; setTimeout(() => { delete n.dataset.sure; n.textContent = '🗑️'; }, 2000); } });
    b('🖼️', 'gallery', () => toggleDrawer('gallery'));
    b('💾', 'save', save, 'go');
    syncUndo();
  }
  function syncUndo() { S.undoB.disabled = !S.undo.length; S.redoB.disabled = !S.redo.length; }

  // ---------------------------------------------------------------- colours + sizes
  function buildColors() {
    const c = S.root.querySelector('.s-colors'); c.innerHTML = '';
    const sz = mk('div', 's-sizes');
    SIZES.forEach((px, i) => { const n = mk('button', 's-size' + (i === S.size ? ' on' : '')); n.innerHTML = `<i style="width:${8 + i * 9}px;height:${8 + i * 9}px"></i>`; onTap(n, () => { S.size = i; sz.querySelectorAll('.s-size').forEach((x, j) => x.classList.toggle('on', j === i)); Audio2.blip(i * 4); }); sz.append(n); });
    const strip = mk('div', 's-strip');
    COLORS.forEach(col => { const n = mk('button', 's-col' + (col === S.color ? ' on' : '')); n.style.background = col; onTap(n, () => { S.color = col; strip.querySelectorAll('.s-col').forEach(x => x.classList.remove('on')); n.classList.add('on'); Audio2.blip(COLORS.indexOf(col) % 12, 'triangle', 0.06, 0.1); if (['erase', 'sticker'].includes(S.tool)) setTool('marker'); }); strip.append(n); });
    c.append(sz, strip);
  }
  function buildTools() {
    const t = S.root.querySelector('.s-tools'); t.innerHTML = '';
    for (const [id, ico] of TOOLS) { const n = mk('button', 's-tool' + (id === S.tool ? ' on' : ''), ico); n.dataset.t = id; n.setAttribute('aria-label', id); onTap(n, () => { if (id === 'sticker') { setTool(id); toggleDrawer('stickers'); } else { setTool(id); toggleDrawer(null); } }); t.append(n); }
  }
  function setTool(id) { S.tool = id; S.root.querySelectorAll('.s-tool').forEach(n => { n.classList.toggle('on', n.dataset.t === id); if (n.dataset.t === 'sticker') n.textContent = isSprite(S.sticker) ? '🦄' : S.sticker; }); Audio2.blip(7, 'square', 0.05, 0.1); }
  const isSprite = s => s.length > 3 && /^[a-z_0-9]+$/.test(s);

  // ---------------------------------------------------------------- drawers (stickers / pages / gallery)
  function toggleDrawer(kind) {
    const d = S.drawer; if (!kind || d.dataset.kind === kind && !d.classList.contains('hidden')) { d.classList.add('hidden'); d.dataset.kind = ''; return; }
    d.dataset.kind = kind; d.classList.remove('hidden'); d.innerHTML = ''; Audio2.whoosh(true);
    const tile = (content, fn) => { const n = mk('button', 's-tile'); if (typeof content === 'string') n.textContent = content; else n.append(content); onTap(n, fn); d.append(n); return n; };
    const spr = k => { const c = spriteCanvas(k); const i = mk('img', 'pix'); if (c) i.src = c.toDataURL(); return i; };
    if (kind === 'stickers') {
      for (const u of store.get('cutouts', [])) { const i = mk('img'); i.src = u; tile(i, () => { S.sticker = u; S.stickerImg = i; setTool('sticker'); toggleDrawer(null); }); }
      for (const e of EMOJI_STICKERS) tile(e, () => { S.sticker = e; setTool('sticker'); toggleDrawer(null); });
      for (const k of SPRITE_STICKERS) if (has(k)) tile(spr(k), () => { S.sticker = k; setTool('sticker'); toggleDrawer(null); });
    } else if (kind === 'pages') {
      for (const col of PAPERS) { const sw = mk('span', 's-paperdot'); sw.style.background = col; tile(sw, () => { S.paper = col; S.paperEl.style.background = col; Audio2.blip(4); }); }
      tile('⬜', () => { snap(); S.lc.clearRect(0, 0, S.W, S.H); S.page = null; toggleDrawer(null); });
      for (const k of PAGES) if (has(k)) tile(pageThumb(k), () => { loadPage(k); toggleDrawer(null); });
    } else {
      const g = store.get('gallery', []); if (!g.length) tile('🖼️❓', () => { });
      g.forEach(u => { const i = mk('img'); i.src = u; const n = tile(i, () => picMenu(u, false)); n.classList.add('wide'); });
    }
  }

  // ---------------------------------------------------------------- colouring pages from game sprites (outline only)
  function outline(k) {
    const s = spriteCanvas(k), w = s.width, h = s.height, src = s.getContext('2d').getImageData(0, 0, w, h).data;
    const o = document.createElement('canvas'); o.width = w + 2; o.height = h + 2; const x = o.getContext('2d'), im = x.createImageData(w + 2, h + 2), d = im.data;
    const A = (i, j) => i < 0 || j < 0 || i >= w || j >= h ? 0 : src[(j * w + i) * 4 + 3];
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      const a = A(i, j); let line = false;
      if (a > 40) { const p = (j * w + i) * 4, lum = src[p] * 0.3 + src[p + 1] * 0.59 + src[p + 2] * 0.11; line = lum < 62 || !A(i - 1, j) || !A(i + 1, j) || !A(i, j - 1) || !A(i, j + 1); }
      if (line) { const q = ((j + 1) * (w + 2) + i + 1) * 4; d[q] = d[q + 1] = d[q + 2] = 20; d[q + 3] = 255; }
    }
    x.putImageData(im, 0, 0); return o;
  }
  function pageThumb(k) { const o = outline(k); const i = mk('img', 'pix'); i.src = o.toDataURL(); i.style.background = '#fff'; return i; }
  function loadPage(k) {
    snap(); const o = outline(k), sc = Math.max(1, Math.floor(Math.min(S.W * 0.86 / o.width, S.H * 0.86 / o.height)));
    S.lc.clearRect(0, 0, S.W, S.H); S.lc.imageSmoothingEnabled = false;
    S.lc.drawImage(o, Math.round((S.W - o.width * sc) / 2), Math.round((S.H - o.height * sc) / 2), o.width * sc, o.height * sc);
    S.pc.clearRect(0, 0, S.W, S.H); S.page = k; setTool('fill'); Audio2.jingle([0, 4, 7, 12], 0.06);
  }

  // ---------------------------------------------------------------- undo / redo / save
  function copy() { const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; c.getContext('2d').drawImage(S.paint, 0, 0); const l = document.createElement('canvas'); l.width = S.W; l.height = S.H; l.getContext('2d').drawImage(S.lines, 0, 0); return [c, l]; }
  function snap() { S.dirty = true; S.undo.push(copy()); if (S.undo.length > 10) S.undo.shift(); S.redo = []; syncUndo(); }
  function restore(st) { S.pc.clearRect(0, 0, S.W, S.H); S.pc.drawImage(st[0], 0, 0); S.lc.clearRect(0, 0, S.W, S.H); S.lc.drawImage(st[1], 0, 0); }
  function undo() { if (!S.undo.length) return; S.redo.push(copy()); restore(S.undo.pop()); syncUndo(); Audio2.blip(-5); }
  function redo() { if (!S.redo.length) return; S.undo.push(copy()); restore(S.redo.pop()); syncUndo(); Audio2.blip(5); }
  function save(silent) {
    const o = document.createElement('canvas'), k = Math.min(1, 720 / Math.max(S.W, S.H)); o.width = S.W * k; o.height = S.H * k; const x = o.getContext('2d');
    x.fillStyle = S.paper; x.fillRect(0, 0, o.width, o.height); x.drawImage(S.paint, 0, 0, o.width, o.height); x.drawImage(S.lines, 0, 0, o.width, o.height);
    const url = o.toDataURL('image/jpeg', 0.8), g = store.get('gallery', []); g.unshift(url); store.set('gallery', g.slice(0, 24)); store.set('lastDrawing', o.toDataURL('image/png')); S.dirty = false;
    if (silent === true) return url;
    Audio2.jingle([0, 4, 7, 12, 16], 0.07); try { say('m_did_it'); } catch (e) { }
    burst(S.W / 2, S.H / 2, 60); picMenu(url, true); return url;
  }
  // what to do with a picture: keep drawing, hang it on the wall, give it to someone, or bin it
  function picMenu(url, fresh) {
    const d = S.drawer; d.dataset.kind = 'pic'; d.classList.remove('hidden'); d.innerHTML = '';
    const im = mk('img'); im.src = url; const big = mk('div', 's-tile wide'); big.append(im); d.append(big);
    const b = (ico, label, fn) => { const n = mk('button', 's-tile', ico); n.setAttribute('aria-label', label); onTap(n, fn); d.append(n); return n; };
    b('🖼️', 'hang on wall', () => { close(); Pics.hang(url); });
    b('🎁', 'give', () => { close(); Pics.giftMenu(url); });
    if (!fresh) b('✏️', 'draw on it', () => { snap(); const i2 = new Image(); i2.onload = () => { S.pc.drawImage(i2, 0, 0, S.W, S.H); }; i2.src = url; S.lc.clearRect(0, 0, S.W, S.H); toggleDrawer(null); });
    const del = b('🗑️', 'trash', () => { if (del.dataset.sure) { Pics.trash(url); Audio2.whoosh(false); toggleDrawer(fresh ? null : 'gallery'); } else { del.dataset.sure = 1; del.textContent = '❓'; } });
    b('✔️', 'keep', () => toggleDrawer(null));
  }

  // ---------------------------------------------------------------- drawing
  function bindCanvas() {
    const el = S.fx; el.style.touchAction = 'none';
    const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * S.W / r.width, (e.clientY - r.top) * S.H / r.height]; };
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); toggleDrawer(null); const [x, y] = pos(e); try { el.setPointerCapture(e.pointerId); } catch (err) { }
      if (S.tool === 'fill') { snap(); fill(x | 0, y | 0); return; }
      snap(); S.down = true; S.last = [x, y]; S.dist = 0;
      if (S.tool === 'sticker') { S.stickPos = [x, y]; return; }
      seg(x, y, x + 0.01, y + 0.01);
    });
    el.addEventListener('pointermove', e => { if (!S.down) return; const [x, y] = pos(e);
      if (S.tool === 'sticker') { S.stickPos = [x, y]; return; }
      seg(S.last[0], S.last[1], x, y); S.last = [x, y]; });
    const up = () => { if (!S.down) return; S.down = false; if (S.tool === 'sticker' && S.stickPos) { stamp(S.pc, S.stickPos[0], S.stickPos[1]); if (S.mirror) stamp(S.pc, S.W - S.stickPos[0], S.stickPos[1], true); Audio2.blip(pick([7, 9, 12, 14]), 'square', 0.1, 0.15); burst(S.stickPos[0], S.stickPos[1], 10); S.stickPos = null; } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function seg(x0, y0, x1, y1) { stroke(x0, y0, x1, y1); if (S.mirror) stroke(S.W - x0, y0, S.W - x1, y1); }
  function stroke(x0, y0, x1, y1) {
    const c = S.pc, u = S.u, w = SIZES[S.size] * u, len = Math.hypot(x1 - x0, y1 - y0), t = S.tool;
    c.save(); c.lineCap = c.lineJoin = 'round'; c.globalCompositeOperation = 'source-over';
    const line = (col, lw, a = 1) => { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const along = (step, f) => { const n = Math.max(1, Math.ceil(len / step)); for (let i = 0; i < n; i++) { const k = i / n; f(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); } };
    if (t === 'marker') line(S.color, w);
    else if (t === 'pencil') line(S.color, Math.max(1.5 * u, w * 0.3), 0.85);
    else if (t === 'brush') { c.shadowColor = S.color; c.shadowBlur = w * 0.5; line(S.color, w * 1.3, 0.22); }
    else if (t === 'erase') { c.globalCompositeOperation = 'destination-out'; line('#000', w * 2); }
    else if (t === 'rainbow') { S.hue = (S.hue + len * 0.6 / u) % 360; line(`hsl(${S.hue},95%,58%)`, w * 1.2); }
    else if (t === 'neon') { c.shadowColor = S.color; c.shadowBlur = w * 1.6; line(S.color, w * 0.9); c.shadowBlur = 0; line('#ffffff', w * 0.3, 0.9); }
    else if (t === 'spray') along(3 * u, (x, y) => { c.fillStyle = S.color; for (let i = 0; i < 10; i++) { const a = Math.random() * 6.3, r = Math.random() * w * 1.4; c.globalAlpha = 0.5; c.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6 * u, 1.6 * u); } });
    else if (t === 'glitter') { line(S.color, w * 0.9, 0.55); along(4 * u, (x, y) => { for (let i = 0; i < 2; i++) sparkle(c, x + rnd(-w, w) * 0.6, y + rnd(-w, w) * 0.6, rnd(1.5, 4.5) * u); }); if (chance(0.15)) Audio2.blip(pick([19, 21, 24, 26]), 'sine', 0.08, 0.04); }
    else if (t === 'magic') { S.dist += len; const gap = w * 1.6 + 10 * u; while (S.dist > gap) { S.dist -= gap; const e = ['⭐', '💖', '🌸', '✨', '🦋', '🌈'][S.magicI++ % 6]; c.globalAlpha = 1; c.font = `${w * 1.5 + 10 * u}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.translate(x1, y1); c.rotate(rnd(-0.4, 0.4)); c.fillText(e, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0); Audio2.blip(pick([12, 14, 16, 19]), 'triangle', 0.06, 0.06); } }
    c.restore();
  }
  function sparkle(c, x, y, r) {
    c.globalAlpha = 1; c.fillStyle = pick(['#ffffff', '#fff6a0', '#ffd0f0', '#b8f4ff', '#ffe36a', '#e0c8ff']);
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.28, y - r * 0.28); c.lineTo(x + r, y); c.lineTo(x + r * 0.28, y + r * 0.28); c.lineTo(x, y + r); c.lineTo(x - r * 0.28, y + r * 0.28); c.lineTo(x - r, y); c.lineTo(x - r * 0.28, y - r * 0.28); c.fill();
  }
  function stamp(c, x, y, flip) {
    const sz = (40 + S.size * 45) * S.u, s = S.sticker; c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
    if (s.startsWith('data:')) { const im = S.stickerImg; if (im) { const k = sz * 1.4 / Math.max(im.naturalWidth, im.naturalHeight); c.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); } }
    else if (isSprite(s)) { const sp = spriteCanvas(s); if (sp) { c.imageSmoothingEnabled = false; const k = sz * 1.5 / Math.max(sp.width, sp.height); c.drawImage(sp, -sp.width * k / 2, -sp.height * k / 2, sp.width * k, sp.height * k); } }
    else { c.font = `${sz}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 0); }
    c.restore();
  }

  // ---------------------------------------------------------------- fill bucket (stops at colouring-page lines and at different colours)
  function fill(sx, sy) {
    const W = S.W, H = S.H, img = S.pc.getImageData(0, 0, W, H), d = img.data, ln = S.lc.getImageData(0, 0, W, H).data;
    if (ln[(sy * W + sx) * 4 + 3] > 100) return;
    const p0 = (sy * W + sx) * 4, t = [d[p0], d[p0 + 1], d[p0 + 2], d[p0 + 3]];
    const col = S.tool === 'fill' && S.color; const n = parseInt(col.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (t[3] > 250 && Math.abs(t[0] - r) + Math.abs(t[1] - g) + Math.abs(t[2] - b) < 12) return;
    const seen = new Uint8Array(W * H), ok = i => { if (seen[i]) return false; const p = i * 4; if (ln[p + 3] > 100) return false; return Math.abs(d[p] - t[0]) + Math.abs(d[p + 1] - t[1]) + Math.abs(d[p + 2] - t[2]) + Math.abs(d[p + 3] - t[3]) < 110; };
    const st = [sy * W + sx]; let count = 0;
    while (st.length) {
      let i = st.pop(); if (!ok(i)) continue; let x = i % W; const y = (i / W) | 0;
      while (x > 0 && ok(i - 1)) { i--; x--; }
      let up = false, dn = false;
      for (; x < W && ok(i); i++, x++) {
        seen[i] = 1; const p = i * 4; d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255; count++;
        if (y > 0) { const o = ok(i - W); if (o && !up) st.push(i - W); up = o; }
        if (y < H - 1) { const o = ok(i + W); if (o && !dn) st.push(i + W); dn = o; }
      }
    }
    S.pc.putImageData(img, 0, 0); Audio2.jingle([0, 7, 12], 0.04); burst(sx, sy, 14);
  }

  // ---------------------------------------------------------------- overlay: mirror guide, sticker preview, sparkle bursts
  const bursts = [];
  function burst(x, y, n) { for (let i = 0; i < n; i++) bursts.push({ x, y, vx: rnd(-1, 1) * 6 * S.u, vy: rnd(-1, 1) * 6 * S.u, t: 1, r: rnd(2, 6) * S.u }); }
  function drawGuide() { }
  function twinkle() {
    if (!S) return; const c = S.fc; c.clearRect(0, 0, S.W, S.H);
    if (S.mirror) { c.setLineDash([10 * S.u, 10 * S.u]); c.strokeStyle = 'rgba(160,110,240,.5)'; c.lineWidth = 2 * S.u; c.beginPath(); c.moveTo(S.W / 2, 0); c.lineTo(S.W / 2, S.H); c.stroke(); c.setLineDash([]); }
    if (S.down && S.tool === 'sticker' && S.stickPos) { c.globalAlpha = 0.85; stamp(c, S.stickPos[0], S.stickPos[1]); if (S.mirror) stamp(c, S.W - S.stickPos[0], S.stickPos[1], true); c.globalAlpha = 1; }
    for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.x += b.vx; b.y += b.vy; b.t -= 0.03; if (b.t <= 0) { bursts.splice(i, 1); continue; } c.globalAlpha = b.t; sparkle(c, b.x, b.y, b.r); c.globalAlpha = 1; }
    S.raf = requestAnimationFrame(twinkle);
  }

  function load(url) { if (!S) return; snap(); const i = new Image(); i.onload = () => { if (S) { S.pc.clearRect(0, 0, S.W, S.H); S.pc.drawImage(i, 0, 0, S.W, S.H); S.dirty = false; } }; i.src = url; S.lc.clearRect(0, 0, S.W, S.H); }
  return { open, close, load, get active() { return !!S; } };
})();

// route "draw" to the studio; maths / spelling / cut-outs keep the existing panel
(() => {
  const orig = UI.openCrafts;
  UI.openCrafts = function (tab) { if (!tab || tab === 'draw') return Studio.open(); return orig(tab); };
})();
