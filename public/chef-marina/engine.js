// Chef Marina — engine: canvas, atlas, sprites, camera, particles, helpers
const SH = 180;               // logical scene height (pixels)
const FLOOR = 164;            // characters' default feet line
const DEPTH_MIN = 150, DEPTH_MAX = 178; // walkable floor band (2.5D)
const depthScale = y => 0.9 + (clamp(y, DEPTH_MIN, DEPTH_MAX) - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN) * 0.2;
const E = {
  cv: null, ctx: null, scale: 1, viewW: 320, camX: 0, t: 0, dt: 0,
  atlas: null, A: {}, cache: {},
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = p => Math.random() < p;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadAtlas(onProgress) {
  return Promise.all([
    fetch('assets/atlas.json').then(r => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/atlas.png'; })
  ]).then(([j, img]) => { E.A = j; E.atlas = img; onProgress && onProgress(); });
}
// close-up face portraits (talking heads), separate atlas
const FACES = { A: {}, img: null };
function loadFaces() {
  return Promise.all([
    fetch('assets/faces.json').then(r => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/faces.png'; })
  ]).then(([j, img]) => { FACES.A = j; FACES.img = img; }).catch(e => console.warn('faces', e));
}
function has(key) { return !!E.A[key]; }
function frameCount(base) { let n = 0; while (E.A[base + '_' + (n + 1)]) n++; return n; } // frames 1..n (0 = reference)

// Get a sprite as a canvas (cached), optionally recoloured: hair hue shift, remove glasses
function spriteCanvas(key, opt) {
  const ck = key + (opt ? JSON.stringify(opt) : '');
  if (E.cache[ck]) return E.cache[ck];
  const r = E.A[key]; if (!r) return null;
  const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3];
  const x = c.getContext('2d'); x.drawImage(E.atlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  if (opt && (opt.hair || opt.noGlasses || opt.tint || opt.dye)) recolor(c, opt);
  E.cache[ck] = c; return c;
}
function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx]; }
function hsv2rgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
const HAIR = { ginger: null, blonde: [48, 0.55, 1.15], brown: [25, 0.75, 0.6], black: [240, 0.15, 0.35], pink: [330, 0.75, 1.1], blue: [205, 0.8, 1], purple: [275, 0.7, 0.95], green: [130, 0.7, 0.9], rainbow: 'rainbow' };
function recolor(c, opt) {
  const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height;
  // find bbox for head region
  let top = H, bot = 0; for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y * W + i) * 4 + 3] > 0) { top = Math.min(top, y); bot = Math.max(bot, y); }
  const headBottom = top + (bot - top) * 0.42;
  let skin = null;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 10) continue;
    const y = (p / 4 / W) | 0; const [h, s, v] = rgb2hsv(d[p], d[p + 1], d[p + 2]);
    if (!skin && y < headBottom && y > top + 4 && h > 15 && h < 35 && s > 0.15 && s < 0.38 && v > 0.85) skin = [d[p], d[p + 1], d[p + 2]];
  }
  skin = skin || [250, 205, 180];
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 10) continue;
    const y = (p / 4 / W) | 0, xx = (p / 4) % W; const [h, s, v] = rgb2hsv(d[p], d[p + 1], d[p + 2]);
    if (opt.noGlasses && y < headBottom && ((h > 235 && h < 300 && s > 0.22) || (h > 300 && h < 330 && s > 0.3 && v > 0.5))) {
      d[p] = skin[0]; d[p + 1] = skin[1]; d[p + 2] = skin[2]; continue; }
    if (opt.hair && HAIR[opt.hair] && ((h <= 38 || h >= 355) && s > 0.36 && v > 0.3 && y < headBottom + (bot - top) * 0.25)) {
      let nh, ns, nv; const H2 = HAIR[opt.hair];
      if (H2 === 'rainbow') { nh = ((y - top) * 18 + xx * 4) % 360; ns = 0.75; nv = Math.min(1, v * 1.1); }
      else { nh = H2[0]; ns = Math.min(1, s * H2[1]); nv = Math.min(1, v * H2[2]); }
      const [r, g, b] = hsv2rgb(nh, ns, nv); d[p] = r; d[p + 1] = g; d[p + 2] = b;
    }
    // dye clothes: rotate the hue of anything that isn't skin, hair or glasses
    if (opt.dye && s > 0.1 && v > 0.12 && !((h <= 48 || h >= 345) && y < headBottom + (bot - top) * 0.3) && !(h > 235 && h < 330 && y < headBottom) && !(h > 10 && h < 40 && s < 0.45 && v > 0.75)) {
      const [r, g, b] = hsv2rgb((h + opt.dye) % 360, Math.min(1, s * (opt.dye === 999 ? 0 : 1.15)), v); d[p] = r; d[p + 1] = g; d[p + 2] = b; }
    if (opt.tint) { const t = opt.tint; d[p] = d[p] * (1 - t[3]) + t[0] * t[3]; d[p + 1] = d[p + 1] * (1 - t[3]) + t[1] * t[3]; d[p + 2] = d[p + 2] * (1 - t[3]) + t[2] * t[3]; }
  }
  x.putImageData(im, 0, 0);
}

// draw sprite anchored at bottom-centre (x,y in world coords)
function drawSprite(key, x, y, { flip = false, scale = 1, alpha = 1, rot = 0, opt = null, sx = 1, sy = 1 } = {}) {
  const c = spriteCanvas(key, opt); if (!c) return;
  const ctx = E.ctx; ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x - E.camX), Math.round(y));
  if (rot) { ctx.translate(0, -c.height * scale / 2); ctx.rotate(rot); ctx.translate(0, c.height * scale / 2); }
  const dS = E.depth || 1; ctx.scale((flip ? -1 : 1) * scale * sx * dS, scale * sy * dS);
  ctx.drawImage(c, -c.width / 2, -c.height);
  ctx.restore();
}
function spriteSize(key) { const r = E.A[key]; return r ? [r[2], r[3]] : [0, 0]; }

// bounding box (world) of visible pixels for a sprite drawn at bottom-centre (cached)
const _bb = {};
function visBox(key) {
  if (_bb[key]) return _bb[key];
  const c = spriteCanvas(key); if (!c) return [0, 0, 0, 0];
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return (_bb[key] = [x0 - c.width / 2, y0 - c.height, x1 - c.width / 2 + 1, y1 - c.height + 1]);
}

// ---------- primitive drawing (world coords) ----------
function rect(x, y, w, h, col) { E.ctx.fillStyle = col; E.ctx.fillRect(Math.round(x - E.camX), Math.round(y), Math.round(w), Math.round(h)); }
function emoji(ch, x, y, size = 14, alpha = 1, rot = 0) {
  const ctx = E.ctx; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x - E.camX, y); if (rot) ctx.rotate(rot);
  ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 0); ctx.restore();
}

// ---------- particles ----------
const P = [];
function emit(type, x, y, n = 1, o = {}) {
  for (let i = 0; i < n; i++) {
    const p = { type, x, y, vx: 0, vy: 0, life: 1, age: 0, g: 0, size: 2, col: '#fff', ch: null, rot: 0, vr: 0, ...o };
    switch (type) {
      case 'heart': Object.assign(p, { ch: pick(['💖', '💕', '❤️', '💗']), vx: rnd(-12, 12), vy: rnd(-30, -18), life: 1.6, size: rnd(9, 14) }); break;
      case 'star': Object.assign(p, { ch: pick(['⭐', '✨', '🌟']), vx: rnd(-40, 40), vy: rnd(-60, -20), g: 60, life: 1.2, size: rnd(8, 12) }); break;
      case 'tear': Object.assign(p, { col: pick(['#6cc6ff', '#a8e2ff', '#3aa0f0']), vx: rnd(-70, 70), vy: rnd(-110, -60), g: 260, life: 1.2, size: rnd(2, 3) }); break;
      case 'vomit': Object.assign(p, { col: pick(['#b5d33b', '#8fb02a', '#d9c44a', '#a5c95a', '#c7a63a']), vx: (o.dir || 1) * rnd(90, 170), vy: rnd(-40, 10), g: 300, life: 1.4, size: rnd(2, 4), stick: true }); break;
      case 'stink': Object.assign(p, { col: pick(['rgba(120,170,60,.55)', 'rgba(150,190,70,.5)', 'rgba(100,140,50,.5)']), vx: rnd(-8, 8), vy: rnd(-16, -8), life: 2.4, size: rnd(5, 9), grow: 4 }); break;
      case 'steam': Object.assign(p, { col: 'rgba(255,255,255,.6)', vx: rnd(-5, 5), vy: rnd(-20, -12), life: 1.4, size: rnd(3, 6), grow: 3 }); break;
      case 'smoke': Object.assign(p, { col: 'rgba(60,60,60,.6)', vx: rnd(-6, 6), vy: rnd(-24, -14), life: 1.8, size: rnd(4, 7), grow: 5 }); break;
      case 'dust': Object.assign(p, { col: 'rgba(220,200,170,.8)', vx: rnd(-60, 60), vy: rnd(-40, -5), g: 40, life: 0.9, size: rnd(3, 6), grow: 4 }); break;
      case 'water': Object.assign(p, { col: pick(['#8fd3ff', '#5bb8f5', '#cdeeff']), vx: rnd(-15, 15), vy: rnd(0, 20), g: 320, life: 0.7, size: 2 }); break;
      case 'leaf': Object.assign(p, { col: pick(['#c8642a', '#e09030', '#8a4a20', '#b5482f', '#d8a040']), vx: rnd(-90, 90), vy: rnd(-140, -40), g: 120, life: 2.2, size: rnd(2, 4), vr: rnd(-6, 6), drag: 1.5 }); break;
      case 'snow': Object.assign(p, { col: '#fff', vx: rnd(-6, 6), vy: rnd(12, 26), life: 12, size: rnd(1, 2.5), wobble: rnd(0, 6) }); break;
      case 'sparkle': Object.assign(p, { col: pick(['#fff6a0', '#ffffff', '#ffd0f0', '#a0f0ff']), vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.8, size: rnd(1, 3) }); break;
      case 'zzz': Object.assign(p, { ch: '💤', vx: rnd(4, 10), vy: -10, life: 2, size: 10 }); break;
      case 'anger': Object.assign(p, { ch: pick(['💢', '💥']), vx: rnd(-20, 20), vy: rnd(-30, -10), life: 0.9, size: rnd(9, 13) }); break;
      case 'note': Object.assign(p, { ch: pick(['🎵', '🎶']), vx: rnd(-10, 10), vy: -18, life: 1.6, size: 10 }); break;
      case 'poo': Object.assign(p, { ch: '💩', vx: 0, vy: 0, life: 1.2, size: 10 }); break;
      case 'fart': Object.assign(p, { col: pick(['rgba(140,170,40,.6)', 'rgba(170,150,50,.55)']), vx: (o.dir || -1) * rnd(10, 40), vy: rnd(-10, 6), life: 2, size: rnd(4, 8), grow: 6 }); break;
      case 'confetti': Object.assign(p, { col: pick(['#ff5a8a', '#ffcf4a', '#5ad1ff', '#7bd36b', '#c48aff']), vx: rnd(-80, 80), vy: rnd(-150, -60), g: 200, life: 2, size: rnd(2, 3), vr: rnd(-8, 8) }); break;
    }
    Object.assign(p, o); P.push(p);
  }
}
function updateParticles(dt) {
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.age += dt;
    if (p.age > p.life) { P.splice(i, 1); continue; }
    p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.wobble != null) p.x += Math.sin(E.t * 2 + p.wobble) * 0.2;
    if (p.grow) p.size += p.grow * dt;
    if (p.stick && p.y > FLOOR + 4) { p.y = FLOOR + 4; p.vx *= 0.5; p.vy = 0; p.g = 0; }
    if (p.type === 'snow' && p.y > FLOOR + 10) p.age = p.life;
    if ((p.type === 'leaf' || p.type === 'tear' || p.type === 'water' || p.type === 'confetti') && p.y > FLOOR + 8) { p.y = FLOOR + 8; p.vy *= -0.2; p.vx *= 0.6; }
  }
}
function drawParticles() {
  const ctx = E.ctx;
  for (const p of P) {
    const a = Math.min(1, (p.life - p.age) / Math.min(0.5, p.life));
    if (p.ch) { emoji(p.ch, p.x, p.y, p.size, a, p.rot); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = p.col;
    if (p.grow) { ctx.beginPath(); ctx.arc(p.x - E.camX, p.y, p.size, 0, 6.3); ctx.fill(); }
    else ctx.fillRect(Math.round(p.x - E.camX - p.size / 2), Math.round(p.y - p.size / 2), Math.ceil(p.size), Math.ceil(p.size));
  }
  ctx.globalAlpha = 1;
}

// ---------- resize ----------
function resize() {
  const st = document.getElementById('stage'), r = st.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  E.cv.width = Math.round(r.width * dpr); E.cv.height = Math.round(r.height * dpr);
  // sideways the picture is zoomed in a little (the ceiling is cropped, the floor stays put) so the room fills the screen
  const zoom = r.width > r.height && !(typeof G !== 'undefined' && G && (/* G4 */ window.Clarity && Clarity.is('G4') && Clarity.landscape() ? G.room === 'living' : G.tv && G.room === 'living')) ? 1.16 : 1;   // TV on: show the whole wall so the screen isn't cropped
  E.scale = (r.height * dpr) / SH * zoom; E.viewW = E.cv.width / E.scale; E.dpr = dpr; E.cssScale = r.height / SH * zoom;
  E.offY = E.cv.height - SH * E.scale; E.cssOffY = r.height - SH * E.cssScale;
}
// world -> css px in stage
function toScreen(x, y) { return [(x - E.camX) * E.cssScale, y * E.cssScale + (E.cssOffY || 0)]; }
function toWorld(px, py) { return [px / E.cssScale + E.camX, (py - (E.cssOffY || 0)) / E.cssScale]; }
