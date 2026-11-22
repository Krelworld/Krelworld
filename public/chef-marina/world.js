// Chef Marina — world: rooms, props, procedural backgrounds, game data
const WALL_Y = 140;   // where wall meets floor
const BACK = 143;     // baseline for furniture against the wall

// seeded rng for stable decorations
function srand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const ROOMS = {
  yard: { name: 'yard', ico: '🌳', w: 560, outside: true, left: null, right: null },
  dining: { name: 'dining', ico: '🎨', w: 340, wall: '#e6e1d8', bead: true, ceil: 'white', floor: 'wood', left: 'yard', right: 'kitchen',
    windows: [{ x: 196, w: 118, y: 34, h: 92, big: true }] },
  kitchen: { name: 'kitchen', ico: '🍳', w: 392, wall: '#ece9e2', subway: true, ceil: 'beams', floor: 'tile', left: 'dining', right: 'playroom',
    windows: [{ x: 96, w: 52, y: 36, h: 46 }] },
  playroom: { name: 'playroom', ico: '🧸', w: 352, wall: '#dcd8cc', wains: true, ceil: 'beams', floor: 'wood', left: 'kitchen', right: 'foyer',
    windows: [{ x: 22, w: 34, y: 34, h: 74 }, { x: 70, w: 34, y: 34, h: 74 }, { x: 236, w: 34, y: 34, h: 74 }] },
  foyer: { name: 'foyer', ico: '🚪', w: 272, wall: '#e3dfd6', ceil: 'beams', floor: 'wood', left: 'playroom', right: 'living', windows: [] },
  bathroom: { name: 'bathroom', ico: '🚽', viewL: 'living', viewR: 'foyer', w: 252, wall: '#ebe8e2', bead: true, ceil: 'whiteplank', floor: 'marble', left: null, right: null,
    windows: [{ x: 108, w: 40, y: 30, h: 50 }] },
  living: { name: 'living', ico: '📺', w: 640, wall: '#e9e5dc', bead: true, ceil: 'beams', floor: 'wood', left: 'foyer', right: null,
    windows: [{ x: 10, w: 34, y: 36, h: 66 }, { x: 98, w: 34, y: 36, h: 66 }, { x: 534, w: 34, y: 36, h: 66 }, { x: 578, w: 34, y: 36, h: 66 }] },
};
const ROOM_ORDER = ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom'];

// Props: k = sprite key or 'p:<procedural>', x centre, y bottom, z: 0 behind chars / 1 in front, a = action group
const PROPS = {
  yard: [
    { id: 'house', k: 'p:house', x: 280, y: BACK, w: 560, h: 140, nohit: true },
    { id: 'garage', k: 'p:garage', x: 60, y: BACK, w: 120, h: 90, a: 'garage' },
    { id: 'sidedoor', k: 'p:yarddoor', x: 178, y: BACK, w: 22, h: 44, a: 'door', to: 'dining', tx: 26 },
    { id: 'frontdoor_out', k: 'p:yarddoor2', x: 330, y: BACK, w: 24, h: 46, a: 'door', to: 'foyer', tx: 60 },
    { id: 'car', k: 'car', x: 70, y: 168, z: 1, a: 'car' },
    { id: 'mbars', k: 'monkeybars', x: 372, y: 189, z: 0, a: 'monkeybars', scale: 1.25 },
    { id: 'swing', k: 'swingset', x: 480, y: 172, z: 0, a: 'swingset', hitPad: 0, scale: 0.88 },
    { id: 'leafpile', k: 'leaf_pile', x: 260, y: 174, z: 1, a: 'leafpile', fallOnly: true },
    { id: 'blower', k: 'leaf_blower', x: 215, y: 172, z: 1, a: 'blower', fallOnly: true },
    { id: 'snowman', k: 'p:snowman', x: 260, y: 174, z: 1, a: 'snowman', snowOnly: true },
  ],
  dining: [
    { id: 'sidedoor', k: 'p:blackdoor', x: 16, y: BACK, w: 26, h: 96, a: 'door', to: 'yard', tx: 178 },
    { id: 'closet', k: 'p:closet', x: 66, y: BACK, w: 62, h: 98, a: 'closet' },
    { id: 'dresser', k: 'dresser_black', x: 130, y: BACK, a: 'dresser' },
    { id: 'cattower', k: 'cat_tower', x: 318, y: BACK + 2, a: 'cattower', perch: [318, BACK - 98] },
    { id: 'table', k: 'p:table', x: 222, y: 160, w: 80, h: 34, a: 'table', climb: 126 },
    { id: 'chair1', k: 'chair_wood', x: 172, y: 162, a: 'chair', climb: 136 },
    { id: 'chair2', k: 'chair_wood', x: 272, y: 162, flip: true, a: 'chair', climb: 136 },
  ],
  kitchen: [
    { id: 'hood', k: 'p:hood', x: 40, y: 64, w: 50, h: 22, nohit: true },
    { id: 'stove', k: 'stove', x: 40, y: BACK, a: 'stove' },
    { id: 'sink', k: 'p:sink', x: 122, y: BACK, w: 70, h: 42, a: 'sink' },
    { id: 'dishwasher', k: 'dishwasher', x: 176, y: BACK, a: 'dishwasher' },
    { id: 'oven', k: 'oven_tower', x: 214, y: BACK, a: 'oven' },
    { id: 'fridge', k: 'fridge', x: 262, y: BACK, a: 'fridge' },
    { id: 'bowls', k: 'cat_bowls', x: 300, y: 158, a: 'bowls' },
    { id: 'island', k: 'p:island', x: 346, y: 160, w: 76, h: 40, a: 'island', climb: 120 },
    { id: 'stool1', k: 'stool', x: 322, y: 178, z: 1, a: 'stool', climb: 140 },
    { id: 'stool2', k: 'stool', x: 346, y: 178, z: 1, a: 'stool', climb: 140 },
    { id: 'stool3', k: 'stool', x: 370, y: 178, z: 1, a: 'stool', climb: 140 },
  ],
  playroom: [
    { id: 'tray', k: 'litter_tray', x: 24, y: 156, a: 'litter' },
    { id: 'dome', k: 'litter_dome', x: 58, y: 156, a: 'litterdome' },
    { id: 'bouncy', k: 'bouncy_animal', x: 96, y: 160, a: 'bouncy' },
    { id: 'foam', k: 'foam_mat', x: 126, y: BACK, a: 'toy' },
    { id: 'kidtable', k: 'kids_table', x: 160, y: 150, a: 'kidtable', climb: 118 },
    { id: 'rocker', k: 'rocker', x: 196, y: BACK + 2, a: 'rocker' },
    { id: 'toyshelf', k: 'toy_shelf', x: 214, y: BACK, a: 'toybox' },
    { id: 'cart1', k: 'drawer_cart', x: 246, y: BACK, a: 'toybox' },
    { id: 'cart2', k: 'drawer_cart', x: 266, y: BACK, a: 'toybox' },
    { id: 'pmat', k: 'purple_mat', x: 286, y: BACK, a: 'toy' },
    { id: 'loveseat', k: 'loveseat', x: 318, y: BACK + 4, a: 'sofa', climb: 116 },
    { id: 'keys', k: 'toy_keyboard', x: 300, y: 172, z: 1, a: 'keyboard' },
    { id: 'broom', k: 'toy_broom', x: 336, y: 174, z: 1, a: 'broom' },
    { id: 'box', k: 'cardboard_box', x: 120, y: 176, z: 1, a: 'box' },
  ],
  foyer: [
    { id: 'frontdoor', k: 'p:frontdoor', x: 52, y: BACK, w: 56, h: 100, a: 'door', to: 'yard', tx: 330 },
    { id: 'halldoor', k: 'p:door', x: 140, y: BACK, w: 30, h: 92, a: 'door', to: 'bathroom', tx: 20 },
    { id: 'stairs', k: 'stairs', x: 214, y: BACK + 2, a: 'stairs' },
  ],
  bathroom: [
    { id: 'bathdoor', k: 'p:door', x: 18, y: BACK, w: 30, h: 92, a: 'door', to: 'living', tx: 600 },
    { id: 'vanity', k: 'vanity', x: 70, y: BACK, a: 'bathsink' },
    { id: 'mirror', k: 'p:mirror', x: 70, y: 86, w: 40, h: 34, a: 'mirror' },
    { id: 'toilet', k: 'toilet', x: 128, y: BACK + 2, a: 'toilet' },
    { id: 'tpholder', k: 'p:tpholder', x: 150, y: 112, w: 12, h: 10, a: 'tp' },
    { id: 'fresh', k: 'freshener', x: 134, y: 82, a: 'freshener', scale: 0.45 },
    { id: 'shower', k: 'p:shower', x: 206, y: BACK, w: 64, h: 112, a: 'shower' },
  ],
  living: [
    { id: 'sectional', k: 'sectional', x: 70, y: 154, a: 'sofa', climb: 112, flip: true },
    { id: 'armchair', k: 'armchair', x: 142, y: 152, a: 'armchair', climb: 118 },
    { id: 'lamp', k: 'floor_lamp', x: 180, y: BACK, a: 'lamp' },
    { id: 'pail', k: 'diaper_pail', x: 204, y: BACK + 2, a: 'pail' },
    { id: 'fireplace', k: 'fireplace', x: 262, y: BACK + 2, a: 'fireplace' },
    { id: 'tv', k: 'tv', x: 262, y: 70, a: 'tv' },
    { id: 'bouncer', k: 'bouncer', x: 300, y: 160, a: 'bouncer' },
    { id: 'bin', k: 'storage_bin', x: 322, y: BACK + 3, nohit: true },
    { id: 'shelf2', k: 'bookshelf', x: 352, y: BACK, a: 'books' },
    { id: 'shelf1', k: 'bookshelf', x: 420, y: BACK, a: 'books' },
    { id: 'basket', k: 'laundry_basket', x: 448, y: BACK + 4, a: 'basket' },
    { id: 'dresserw', k: 'dresser_white', x: 480, y: BACK, a: 'dresser' },
    { id: 'pnp', k: 'pack_n_play', x: 534, y: BACK + 4, a: 'crib' },
    { id: 'bathhall', k: 'p:door', x: 622, y: BACK, w: 30, h: 92, a: 'door', to: 'bathroom', tx: 40 },
  ],
};

// spots
const FORT_SPOTS = { living: 200, playroom: 150 };
const SEATS = { living: { mommy: 142, daddy: 70, rory: 40 }, dining: { daddy: 222, rory: 262, mommy: 190 }, kitchen: { daddy: 330, rory: 360, mommy: 300 } };

// ---------------- procedural drawing ----------------
let WEATHER = 'fall';
function drawOutsideView(x, y, w, h, seed) {
  const ctx = E.ctx, r = srand(seed);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (WEATHER === 'snow') { g.addColorStop(0, '#c9d6e8'); g.addColorStop(1, '#eef3fa'); } else { g.addColorStop(0, '#9fd0f2'); g.addColorStop(1, '#f3d9a8'); }
  ctx.fillStyle = g; ctx.fillRect(Math.round(x - E.camX), y, w, h);
  for (let i = 0; i < w / 6; i++) {
    const tx = x + r() * w, ty = y + h * (0.2 + r() * 0.8), s = 4 + r() * 10;
    rect(tx, ty, 2, y + h - ty, '#5a4030');
    const col = WEATHER === 'snow' ? pick2(r, ['#f4f7fb', '#dfe7f0', '#c4d0dc']) : pick2(r, ['#d9822b', '#b5482f', '#e6a33a', '#8a5a2a', '#c96d2c', '#6f7d3a']);
    rect(tx - s / 2, ty - s / 2, s, s * 0.8, col);
  }
  rect(x, y + h - 6, w, 6, WEATHER === 'snow' ? '#f4f7fb' : '#a8743a');
}
function pick2(r, a) { return a[r() * a.length | 0]; }
function drawWindow(x, y, w, h, big) {
  rect(x - 3, y - 3, w + 6, h + 6, '#fbfbf8'); drawOutsideView(x, y, w, h, x * 7 + y);
  const cols = big ? 3 : 2, rows = big ? 1 : 3;
  for (let i = 1; i < cols; i++) rect(x + (w / cols) * i - 1.5, y, 3, h, '#fbfbf8');
  if (!big) for (let j = 1; j < rows; j++) rect(x, y + (h / rows) * j - 1, w, 2, '#fbfbf8');
  rect(x - 4, y + h + 2, w + 8, 3, '#f0efe8');
}
// detailed painted backgrounds (PixelLab), with the procedural drawing as fallback
const BG = {};
const BAKED = k => k.startsWith('p:') && !['p:shower', 'p:tpholder', 'p:snowman'].includes(k);
function loadBackgrounds() {
  for (const k of ['dining', 'kitchen', 'playroom', 'foyer', 'bathroom', 'living', 'yard_fall', 'yard_snow']) { const i = new Image(); i.src = 'assets/bg/' + k + '.png'; BG[k] = i; }
}
function bgFor(room) { const i = BG[room === 'yard' ? 'yard_' + WEATHER : room]; return i && i.complete && i.naturalWidth ? i : null; }
function drawRoomBG(room) {
  const R = ROOMS[room], W = R.w, ctx = E.ctx;
  const img = bgFor(room);
  if (img) {
    ctx.fillStyle = room === 'yard' ? (WEATHER === 'snow' ? '#dfe8f2' : '#9fd0f2') : '#1d1830'; ctx.fillRect(-10, -10, E.viewW + 20, SH + 20);
    ctx.drawImage(img, Math.round(-E.camX), 0);
    // wide screens: show the rooms next door (dimmed) instead of empty bars, like a cutaway house
    const gapL = Math.ceil(-E.camX), gapR = Math.ceil(E.camX + E.viewW - W);
    const side = (nb, x0, gap, left) => {
      if (gap <= 0) return; const im = nb && bgFor(nb);
      if (im) { const nw = ROOMS[nb].w; if (left) ctx.drawImage(im, nw - gap, 0, gap, SH, x0, 0, gap, SH); else ctx.drawImage(im, 0, 0, Math.min(gap, nw), SH, x0, 0, Math.min(gap, nw), SH); }
      else if (room === 'yard') ctx.drawImage(img, left ? 0 : W - 1, 0, 1, SH, x0, 0, gap, SH);
      else { ctx.fillStyle = '#3b3050'; ctx.fillRect(x0, -40, gap, SH + 60); }
      ctx.fillStyle = room === 'yard' ? 'rgba(0,0,0,0)' : 'rgba(20,14,40,.5)'; ctx.fillRect(x0, -40, gap, SH + 60);
      ctx.fillStyle = '#2a2140'; ctx.fillRect(left ? x0 + gap - 3 : x0, -40, 3, SH + 60); // the wall between rooms
    };
    side(R.left || R.viewL, 0, gapL, true); side(R.right || R.viewR, Math.round(W - E.camX), gapR, false);
    return;
  }
  if (R.outside) return drawYardBG();
  rect(0, 0, W, WALL_Y, R.wall);
  if (R.bead) for (let x = 0; x < W; x += 7) rect(x, 14, 1, WALL_Y - 14, 'rgba(0,0,0,.06)');
  if (R.wains) { rect(0, 104, W, WALL_Y - 104, '#f3f1ea'); for (let x = 0; x < W; x += 7) rect(x, 106, 1, WALL_Y - 106, 'rgba(0,0,0,.07)'); rect(0, 102, W, 3, '#fbfbf7'); }
  if (R.subway) for (let y = 86; y < 118; y += 5) for (let x = ((y / 5) % 2) * 6; x < 240; x += 12) rect(x, y, 11, 4, 'rgba(255,255,255,.7)');
  for (const w of R.windows) drawWindow(w.x, w.y, w.w, w.h, w.big);
  // ceiling
  if (R.ceil === 'beams') { rect(0, 0, W, 16, '#4a2c1c'); for (let x = 10; x < W; x += 46) rect(x, 0, 12, 18, '#2f1b11'); rect(0, 16, W, 2, '#2f1b11'); }
  else if (R.ceil === 'whiteplank') { rect(0, 0, W, 14, '#f4f3ee'); for (let x = 0; x < W; x += 12) rect(x, 0, 1, 14, '#dcdad2'); }
  else { rect(0, 0, W, 12, '#f6f5f0'); rect(0, 12, W, 3, '#e2e0d8'); }
  // baseboard + floor
  rect(0, WALL_Y - 4, W, 4, '#fafaf6');
  const r = srand(W + room.length * 99);
  if (R.floor === 'wood') {
    rect(0, WALL_Y, W, SH - WALL_Y, '#7a4524');
    for (let y = WALL_Y; y < SH; y += 5) { rect(0, y, W, 1, 'rgba(0,0,0,.18)'); for (let k = 0; k < W / 40; k++) rect(r() * W, y, 1, 5, 'rgba(0,0,0,.2)'); rect(r() * W, y + 2, 20 + r() * 30, 1, 'rgba(255,200,140,.12)'); }
  } else if (R.floor === 'tile') {
    rect(0, WALL_Y, W, SH - WALL_Y, '#6f7980');
    for (let y = WALL_Y; y < SH; y += 13) rect(0, y, W, 1, 'rgba(0,0,0,.25)');
    for (let y = WALL_Y; y < SH; y += 13) for (let x = ((y - WALL_Y) / 13 % 2) * 12; x < W; x += 24) rect(x, y, 1, 13, 'rgba(0,0,0,.25)');
    for (let k = 0; k < W / 6; k++) rect(r() * W, WALL_Y + r() * 40, 6, 1, 'rgba(255,255,255,.12)');
  } else {
    rect(0, WALL_Y, W, SH - WALL_Y, '#e4e8ec');
    for (let y = WALL_Y; y < SH; y += 14) rect(0, y, W, 1, '#9aa1a8');
    for (let y = WALL_Y; y < SH; y += 14) for (let x = ((y - WALL_Y) / 14 % 2) * 14; x < W; x += 28) rect(x, y, 1, 14, '#9aa1a8');
    for (let k = 0; k < W / 8; k++) rect(r() * W, WALL_Y + r() * 40, 8, 1, 'rgba(120,130,140,.35)');
  }
  // rugs
  if (room === 'living') { rect(60, 158, 150, 14, '#e8e0d0'); rect(64, 160, 142, 10, '#ddd4c2'); }
  if (room === 'playroom') { rect(128, 156, 84, 16, '#d5d0d8'); rect(131, 158, 78, 12, '#c4bccb'); }
  if (room === 'foyer') rect(30, 146, 44, 8, '#2a2a2a');
  // open edges hint
  if (R.left) { rect(0, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.25)'); }
  if (R.right) { rect(W - 4, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.25)'); }
  if (room === 'kitchen') { rect(0, 0, 160, 15, '#f6f5f0'); rect(0, 22, 150, 28, '#f5f4ef'); for (let x = 4; x < 150; x += 30) { rect(x, 24, 27, 24, '#fbfbf8'); rect(x + 22, 38, 2, 3, '#222'); } rect(196, 22, 86, 26, '#f5f4ef'); for (let x = 198; x < 280; x += 28) { rect(x, 24, 26, 22, '#fbfbf8'); rect(x + 20, 38, 2, 3, '#222'); } }
}
function drawYardBG() {
  const W = ROOMS.yard.w, ctx = E.ctx, snow = WEATHER === 'snow';
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  if (snow) { g.addColorStop(0, '#b8c8dc'); g.addColorStop(1, '#e8eef6'); } else { g.addColorStop(0, '#5aa8f0'); g.addColorStop(1, '#bfe0ff'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, E.cv.width, SH);
  const r = srand(7);
  for (let i = 0; i < 40; i++) { const x = r() * W, h = 50 + r() * 70; rect(x, 140 - h, 3, h, snow ? '#8a8f96' : '#a8a0a0'); for (let k = 0; k < 4; k++) rect(x - 8 + r() * 16, 140 - h + r() * h * 0.6, 6 + r() * 8, 5, snow ? '#eef2f8' : pick2(r, ['#d9822b', '#b5482f', '#e6a33a', '#c8b8a8'])); }
  rect(0, 140, W, 40, snow ? '#f2f5fa' : '#7c9a3a');
  for (let i = 0; i < 70; i++) rect(r() * W, 142 + r() * 36, 3, 2, snow ? '#dde6f0' : pick2(r, ['#c8642a', '#e09030', '#8a4a20', '#6f8a30']));
  rect(0, 158, 240, 22, snow ? '#e6ebf2' : '#2b2b2e'); // driveway
}
function drawProc(p) {
  const x = p.x, y = p.y, w = p.w, h = p.h, L = x - w / 2, T = y - h;
  switch (p.k) {
    case 'p:house': {
      const snow = WEATHER === 'snow';
      // garage block
      rect(0, 50, 136, 93, '#c9c5bd'); for (let yy = 52; yy < 143; yy += 4) rect(0, yy, 136, 1, '#b4afa6');
      // main house
      rect(140, 66, 300, 77, '#d2cdc3'); for (let yy = 68; yy < 143; yy += 4) rect(140, yy, 300, 1, '#bcb6ab');
      E.ctx.fillStyle = snow ? '#f4f6fa' : '#a0784a'; E.ctx.beginPath(); E.ctx.moveTo(130 - E.camX, 68); E.ctx.lineTo(290 - E.camX, 6); E.ctx.lineTo(450 - E.camX, 68); E.ctx.fill();
      E.ctx.beginPath(); E.ctx.moveTo(-6 - E.camX, 52); E.ctx.lineTo(68 - E.camX, 18); E.ctx.lineTo(142 - E.camX, 52); E.ctx.fill();
      rect(350, 10, 16, 30, '#f2f0ea'); // chimney
      for (const wx of [220, 262, 390, 420]) { rect(wx - 2, 92, 22, 30, '#2f3640'); rect(wx + 1, 94, 16, 26, '#9ec4dc'); rect(wx + 8, 94, 2, 26, '#fff'); rect(wx - 8, 92, 5, 30, '#1f252d'); rect(wx + 21, 92, 5, 30, '#1f252d'); }
      rect(40, 26, 26, 22, '#2f3640'); rect(43, 29, 20, 16, '#9ec4dc');
      // ramp
      rect(150, 118, 70, 25, '#e2c98a'); for (let k = 150; k < 222; k += 7) rect(k, 112, 2, 31, '#cdb070'); rect(150, 112, 72, 2, '#cdb070');
      break; }
    case 'p:garage': rect(L + 8, T + 30, 104, 60, '#f3f3f0'); for (let yy = T + 34; yy < y; yy += 12) rect(L + 8, yy, 104, 1, '#d6d6d0'); rect(L + 58, T + 30, 4, 60, '#e0e0da'); for (const gx of [L + 14, L + 66]) for (let k = 0; k < 4; k++) rect(gx + k * 11, T + 36, 9, 5, '#6c7a86'); break;
    case 'p:yarddoor': rect(L, T, w, h, '#f6f6f2'); rect(L + 3, T + 3, w - 6, h - 6, '#2a3038'); rect(L + 5, T + 6, w - 10, h * 0.5, '#7aa4c4'); break;
    case 'p:yarddoor2': rect(L - 4, T - 4, w + 8, h + 4, '#f6f6f2'); rect(L, T, w, h, '#26303a'); rect(L + w - 6, T + h / 2, 3, 3, '#c9a54a'); rect(L - 10, T + 8, 4, 8, '#222'); rect(L + w + 6, T + 8, 4, 8, '#222'); break;
    case 'p:blackdoor': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#22262c'); rect(L + 3, T + 6, w - 6, h * 0.45, '#5b6c78'); rect(L + w - 7, T + h * 0.55, 4, 7, '#111'); rect(L + w - 6, T + h * 0.55 + 1, 2, 1, '#6f6'); break;
    case 'p:closet': rect(L - 2, T - 2, w + 4, h + 2, '#f5f4ef'); for (let i = 0; i < 4; i++) { rect(L + i * w / 4 + 1, T, w / 4 - 2, h, '#f0eee7'); rect(L + i * w / 4 + 1, T, 1, h, '#d8d5cc'); } rect(L + w / 4 - 4, T + h / 2, 3, 3, '#fff'); rect(L + 3 * w / 4 + 1, T + h / 2, 3, 3, '#fff'); rect(L + w / 2 - 4, T + h / 2, 3, 3, '#fff'); rect(L + w / 2 + 1, T + h / 2, 3, 3, '#fff'); break;
    case 'p:table': {
      rect(L + 6, T + 10, 3, h - 10, '#7a4a22'); rect(L + w - 9, T + 10, 3, h - 10, '#7a4a22');
      for (let i = 0; i < w; i += 6) rect(L + i, T, 3, h - 8, i % 12 ? '#f4f4f4' : '#1d1d1f'), rect(L + i + 3, T, 3, h - 8, i % 12 ? '#1d1d1f' : '#f4f4f4');
      rect(L - 2, T - 2, w + 4, 4, '#2a2a2a'); rect(L, T - 4, w, 3, '#f4f4f4');
      break; }
    case 'p:hood': rect(L, T, w, h * 0.6, '#c8ccd0'); rect(L - 4, T + h * 0.6, w + 8, h * 0.4, '#a9aeb3'); break;
    case 'p:sink': rect(L, T + 6, w, h - 6, '#f6f5f0'); for (let i = 0; i < 3; i++) { rect(L + 2 + i * w / 3, T + 10, w / 3 - 3, h - 14, '#fbfbf8'); rect(L + i * w / 3 + w / 6, T + 16, 3, 3, '#222'); } rect(L - 2, T + 2, w + 4, 5, '#8a9298'); rect(L + w / 2 - 12, T + 2, 24, 3, '#c9ced2'); rect(L + w / 2 - 1, T - 12, 3, 14, '#222'); rect(L + w / 2 - 1, T - 12, 10, 3, '#222'); break;
    case 'p:island': rect(L, T + 4, w, h - 4, '#f6f5f0'); for (let i = 0; i < 4; i++) { rect(L + 2 + i * w / 4, T + 9, w / 4 - 4, h - 12, '#fbfbf8'); rect(L + i * w / 4 + w / 8, T + 14, 3, 3, '#222'); } rect(L - 3, T, w + 6, 5, '#8a9298'); rect(L - 3, T, w + 6, 1, '#b4bbc0'); break;
    case 'p:frontdoor': rect(L - 4, T - 6, w + 8, h + 6, '#fbfbf8'); rect(L + 10, T, w - 20, h, '#f4f3ee'); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]) rect(L + 13 + a * 15, T + 18 + b * 26, 12, 22, '#e6e4dc'); rect(L + 13, T + 4, 30, 10, '#a8cce4'); rect(L + 1, T + 4, 7, h - 30, '#a8cce4'); rect(L + w - 8, T + 4, 7, h - 30, '#a8cce4'); rect(L + w - 18, T + 50, 4, 8, '#222'); break;
    case 'p:door': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#f1f0ea'); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]) rect(L + 3 + a * (w / 2 - 2), T + 4 + b * (h / 3 - 1), w / 2 - 6, h / 3 - 7, '#e3e1d9'); rect(L + w - 7, T + h * 0.52, 6, 2, '#222');
      if (G.bathLocked && p.to === 'bathroom') { rect(L + w / 2 - 6, T + 30, 12, 10, '#d33'); }
      break;
    case 'p:doorway': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#9a9488'); rect(L, T + h - 4, w, 4, '#6a4426'); break;
    case 'p:mirror': rect(L - 2, T - 2, w + 4, h + 4, '#b9bec2'); rect(L, T, w, h, '#cfe3ea'); rect(L + 4, T + 4, 6, h - 10, 'rgba(255,255,255,.6)'); rect(L - 4, T - 10, w + 8, 6, '#c8c8c8'); for (let i = 0; i < 3; i++) rect(L + 4 + i * 13, T - 9, 8, 4, '#fff'); break;
    case 'p:tpholder': rect(L, T, w, h, '#b8bcc0'); if (!G.tpEmpty) rect(L + 2, T + 2, w - 4, h - 3, '#ffffff'); else rect(L + 4, T + 3, w - 8, h - 5, '#a07848'); break;
    case 'p:shower': rect(L, T, w, h, '#f7f7f5'); rect(L + 4, T + 6, w - 8, h - 6, '#ebeeef'); rect(L, T, w, 3, '#222');
      rect(L + w - 14, T + 10, 8, 4, '#b8bcc0'); rect(L + w - 12, T + 14, 2, 26, '#9aa0a5');
      if (G.showerOn) for (let i = 0; i < 3; i++) emit('water', x + 18 + rnd(-6, 6), T + 16);
      // chair
      rect(L + 22, y - 22, 22, 3, '#fff'); rect(L + 24, y - 19, 2, 19, '#ccc'); rect(L + 40, y - 19, 2, 19, '#ccc'); rect(L + 22, y - 36, 3, 14, '#fff'); rect(L + 22, y - 36, 14, 8, '#fff');
      // curtain
      { const cw = G.showerOn ? w * 0.35 : w * 0.55; for (let i = 0; i < cw; i += 3) rect(L + i, T + 3, 2, h * 0.45, '#e9dcc4'), rect(L + i, T + 3 + h * 0.45, 2, h * 0.55 - 6, i % 6 ? '#f6f6f6' : '#7a7e86'); }
      break;
    case 'p:snowman': {
      const st = G.snowman || 0;
      if (st >= 1) { E.ctx.fillStyle = '#fff'; E.ctx.beginPath(); E.ctx.arc(x - E.camX, y - 12, 12, 0, 6.3); E.ctx.fill(); }
      if (st >= 2) { E.ctx.beginPath(); E.ctx.arc(x - E.camX, y - 31, 9, 0, 6.3); E.ctx.fill(); }
      if (st >= 3) { E.ctx.beginPath(); E.ctx.arc(x - E.camX, y - 45, 7, 0, 6.3); E.ctx.fill(); rect(x - 3, y - 47, 2, 2, '#222'); rect(x + 2, y - 47, 2, 2, '#222'); }
      if (st >= 4) { rect(x + 2, y - 44, 7, 2, '#f07a1a'); rect(x - 12, y - 32, 10, 2, '#6a4426'); rect(x + 6, y - 34, 10, 2, '#6a4426'); }
      if (st >= 5) { rect(x - 7, y - 58, 14, 8, '#222'); rect(x - 10, y - 51, 20, 2, '#222'); rect(x - 9, y - 39, 18, 3, '#d33'); }
      if (!st) { E.ctx.globalAlpha = 0.5; emoji('⛄', x, y - 14, 18); E.ctx.globalAlpha = 1; }
      break; }
  }
}

// ---------------- data: ingredients ----------------
// tags: s=sweet v=savoury f=fruit g=veg d=dairy m=meat/fish x=gross h=spicy l=liquid c=carb k=crunch
const ING = {
  milk: 'dl', eggs: 'vc', cola: 'sl', juicebox: 'sfl', whip: 'sd', creamcheese: 'dv', mustard: 'vx', worcester: 'vx', garlic: 'vh', pizzabox: 'vcd',
  bread: 'cv', cheese: 'dv', strawberry: 'sf', banana: 'sf', pasta: 'cv', ketchup: 'v', chocolate: 's', sprinkles: 's', spinach: 'g', fish: 'm', carrot: 'g',
  butter: 'd', flour: 'c', sugar: 's', pepper: 'h', pickles: 'vx', icecream: 'sd', broccoli: 'g', sausage: 'm', catfood: 'xxx', cinnamon: 's', rice: 'c',
  peanutbutter: 'sv', marshmallow: 's', lemon: 'f', onion: 'gx', tomato: 'gv', honey: 's', cereal: 'sck', crackers: 'ck', apple: 'sf', blueberry: 'sf', bacon: 'm', beans: 'v', oatmeal: 'c',
  yogurt: 'sd', oj: 'sfl', hotsauce: 'hx', mayo: 'dv', jam: 's', tortilla: 'cv', ham: 'm', nuggets: 'mc', peas: 'g', waffles: 'sc', avocado: 'gv', grapes: 'sf', watermelon: 'sf',
  potato: 'gc', popcorn: 'kv', goldfish: 'ck', ramen: 'cv', soysauce: 'v', pickled_egg: 'xv', olives: 'vx', cocoa: 's', babyfood: 'gx', coffee: 'xl', sardines: 'mx', gummies: 's', pumpkin: 'gs',
  orange: 'sf', pear: 'sf', chicken: 'm', cookiedough: 's', hummus: 'v', pineapple: 'sf', cucumber: 'g', corn: 'gc', vanilla: 's', syrup: 's', tuna: 'm', eggnog: 'sdl',
};
const PANTRY = {
  fridge: ['milk', 'eggs', 'butter', 'cheese', 'creamcheese', 'yogurt', 'whip', 'oj', 'juicebox', 'cola', 'eggnog', 'ham', 'bacon', 'sausage', 'chicken', 'fish', 'hummus', 'mayo', 'mustard', 'ketchup', 'hotsauce', 'pickles', 'pickled_egg', 'olives', 'garlic', 'jam', 'cookiedough', 'spinach', 'broccoli', 'carrot', 'cucumber', 'tomato', 'onion', 'avocado', 'babyfood', 'pizzabox'],
  freezer: ['icecream', 'peas', 'waffles', 'nuggets', 'corn'],
  cabinet: ['flour', 'sugar', 'bread', 'pasta', 'rice', 'ramen', 'tortilla', 'cereal', 'oatmeal', 'crackers', 'goldfish', 'popcorn', 'peanutbutter', 'honey', 'syrup', 'chocolate', 'cocoa', 'marshmallow', 'gummies', 'sprinkles', 'cinnamon', 'vanilla', 'pepper', 'soysauce', 'worcester', 'beans', 'tuna', 'sardines', 'coffee', 'catfood'],
  bowl: ['apple', 'banana', 'orange', 'pear', 'grapes', 'strawberry', 'blueberry', 'lemon', 'pineapple', 'watermelon', 'potato', 'pumpkin'],
};
const ING_NAME = { milk: 'Milky', eggs: 'Eggy', cola: 'Fizzy', juicebox: 'Juicy', whip: 'Creamy', creamcheese: 'Cheesy', mustard: 'Mustardy', worcester: 'Saucy', garlic: 'Garlicky', pizzabox: 'Pizza',
  bread: 'Bready', cheese: 'Cheesy', strawberry: 'Strawberry', banana: 'Banana', pasta: 'Noodle', ketchup: 'Ketchup', chocolate: 'Chocolate', sprinkles: 'Sparkly', spinach: 'Spinach', fish: 'Fishy',
  carrot: 'Carrot', butter: 'Buttery', flour: 'Floury', sugar: 'Sugary', pepper: 'Spicy', pickles: 'Pickle', icecream: 'Ice Cream', broccoli: 'Broccoli', sausage: 'Sausage', catfood: 'Cat Food',
  cinnamon: 'Cinnamon', rice: 'Rice', peanutbutter: 'Peanut', marshmallow: 'Marshmallow', lemon: 'Lemony', onion: 'Oniony', tomato: 'Tomato', honey: 'Honey', cereal: 'Crunchy', crackers: 'Cracker',
  apple: 'Apple', blueberry: 'Blueberry', bacon: 'Bacon', beans: 'Beany', oatmeal: 'Oaty',
  yogurt: 'Yogurt', oj: 'Orange Juice', hotsauce: 'Fire', mayo: 'Mayo', jam: 'Jelly', tortilla: 'Wrappy', ham: 'Hammy', nuggets: 'Nugget', peas: 'Pea', waffles: 'Waffle', avocado: 'Avocado', grapes: 'Grape',
  watermelon: 'Watermelon', potato: 'Potato', popcorn: 'Popcorn', goldfish: 'Fishy Cracker', ramen: 'Ramen', soysauce: 'Soy', pickled_egg: 'Pickled Egg', olives: 'Olive', cocoa: 'Cocoa', babyfood: 'Baby Mush',
  coffee: 'Coffee', sardines: 'Sardine', gummies: 'Gummy', pumpkin: 'Pumpkin', orange: 'Orange', pear: 'Pear', chicken: 'Chicken', cookiedough: 'Cookie Dough', hummus: 'Hummus', pineapple: 'Pineapple',
  cucumber: 'Cucumber', corn: 'Corn', vanilla: 'Vanilla', syrup: 'Maple', tuna: 'Tuna', eggnog: 'Eggnog' };
// pairs that are bad together
const CLASH = [['fish', 's'], ['catfood', '*'], ['mustard', 's'], ['worcester', 's'], ['pickles', 's'], ['garlic', 's'], ['onion', 's'], ['cola', 'm'], ['chocolate', 'g'], ['chocolate', 'm'],
  ['ketchup', 's'], ['milk', 'h'], ['lemon', 'd'], ['cola', 'd'], ['spinach', 's'], ['broccoli', 's'], ['icecream', 'v'], ['sprinkles', 'm'], ['honey', 'm'], ['marshmallow', 'v'], ['pepper', 's'],
  ['hotsauce', 's'], ['sardines', '*'], ['babyfood', '*'], ['coffee', '*'], ['pickled_egg', '*'], ['olives', 's'], ['mayo', 's'], ['gummies', 'm'], ['gummies', 'v'], ['oj', 'd'], ['soysauce', 's'], ['tuna', 's'], ['cookiedough', 'm']];
const GOOD = [['strawberry', 'chocolate'], ['banana', 'peanutbutter'], ['eggs', 'cheese'], ['bread', 'cheese'], ['bread', 'butter'], ['flour', 'sugar'], ['flour', 'eggs'], ['milk', 'chocolate'],
  ['icecream', 'chocolate'], ['icecream', 'strawberry'], ['tomato', 'cheese'], ['pasta', 'tomato'], ['pasta', 'cheese'], ['rice', 'eggs'], ['apple', 'cinnamon'], ['bacon', 'eggs'], ['sausage', 'ketchup'],
  ['strawberry', 'banana'], ['blueberry', 'milk'], ['honey', 'oatmeal'], ['marshmallow', 'chocolate'], ['whip', 'strawberry'], ['lemon', 'sugar'], ['fish', 'lemon'], ['bread', 'peanutbutter'], ['cereal', 'milk'], ['broccoli', 'cheese'], ['carrot', 'pasta'],
  ['yogurt', 'blueberry'], ['yogurt', 'strawberry'], ['yogurt', 'granola'], ['waffles', 'syrup'], ['waffles', 'whip'], ['tortilla', 'cheese'], ['tortilla', 'chicken'], ['tortilla', 'avocado'], ['ham', 'cheese'],
  ['ham', 'bread'], ['nuggets', 'ketchup'], ['potato', 'butter'], ['potato', 'cheese'], ['popcorn', 'butter'], ['ramen', 'eggs'], ['ramen', 'soysauce'], ['chicken', 'rice'], ['chicken', 'soysauce'],
  ['cocoa', 'milk'], ['cocoa', 'marshmallow'], ['cookiedough', 'icecream'], ['pineapple', 'ham'], ['orange', 'banana'], ['oj', 'strawberry'], ['corn', 'butter'], ['pumpkin', 'cinnamon'], ['pumpkin', 'sugar'],
  ['grapes', 'cheese'], ['watermelon', 'lemon'], ['hummus', 'cucumber'], ['hummus', 'carrot'], ['jam', 'peanutbutter'], ['jam', 'bread'], ['avocado', 'tomato'], ['peas', 'rice'], ['tuna', 'mayo'], ['vanilla', 'flour'], ['eggnog', 'cinnamon']];

// Line → icon shown in speech bubble
const SAY_ICON = {
  m_hi_daddy: '👋👨', m_hi_mommy: '👋👩', m_hi_rory: '👋🧔', m_hewe: '🍽️😊', m_made: '🍽️✨', m_play_daddy: '🏰❓', m_play_mommy: '🏰❓', m_play_rory: '🏰❓', m_play_niko: '🏰🐱',
  m_notfair: '😤❗', m_dontlike: '😭💔', m_wuv_daddy: '💖', m_wuv_mommy: '💖', m_wuv_miles: '💖👶', m_wuv_rory: '💖', m_yay: '🎉', m_wow: '🤩', m_uhoh: '😬', m_eat_it: '🍽️❗', m_eat_angry: '😠🍽️', m_eat_sad: '🥺🍽️',
  m_cry: '😭', m_ugh_niko: '🤢💩', m_stinky: '🤢', m_tp: '🧻', m_fort: '🏰✨', m_fort_fall: '🏚️😱', m_flip: '🤸', m_squirrel: '🐿️', m_giddyup: '🐴', m_noway: '🏃😜', m_ok_tidy: '🧹', m_ride: '♿💨',
  m_shh_miles: '🤫', m_bottle: '🍼', m_pet_niko: '🐱💕', m_food_niko: '🐟', m_pickup: '🐱🤗', m_chase_niko: '🏃🐱', m_fairy: '🧚', m_princess: '👑', m_pretty: '💃', m_tv: '📺', m_notbrainrot: '😤📺',
  m_snowman: '⛄', m_leaves: '🍂', m_swing: '⬆️', m_monkey: '🐒', m_draw: '🖍️', m_did_it: '🏆', m_hmm: '🤔', m_cooking: '🍳', m_yummy: '😋', m_giggle: '🤭', m_angry: '😠', m_tired: '🥱', m_no: '🙅',
  m_okay: '👍', m_mix: '🥄', m_happy: '😄', m_sad: '😢', m_cuddle: '🤗', m_flush: '🚽', m_wash: '🧼', m_bye: '👋',
  d_hi1: '👋', d_hi2: '👋🐝', d_hi3: '👋🐥', d_hi_tired: '😴👋', d_comfort: '🤗', d_comfort2: '🤗', d_hey: '❗', d_appropriate: '☝️😠', d_bedtime: '🛏️🌙', d_play_yes: '🏰🙌', d_play_yes2: '🏰😄',
  d_play_tired: '😩', d_play_tired2: '😴', d_climb: '⬇️😠', d_catch: '🙌', d_horse: '🐴', d_tidy: '🧹❗', d_chase: '🏃', d_caught: '🤣', d_food_great: '😋⭐', d_food_good: '😋', d_food_meh: '😬👍',
  d_nervous: '😅⏰', d_ok_ok: '😰🍽️', d_burp: '💨', d_stomach: '🤢', d_vomit: '🤮', d_diarrhea: '🚽😱', d_notp: '🧻❌', d_tp_thanks: '🧻🙏', d_tv: '📺❌', d_brainrot: '🧠🫠', d_love: '💖',
  d_cuddle: '🤗', d_cat: '🐱❌', d_fort_down: '🏚️🛏️', d_niko_poo: '🤢💩', d_careful: '⚠️', d_good_girl: '👍⭐',
  mo_hi1: '👋', mo_hi2: '👋💕', mo_comfort: '🤗', mo_hey: '❗', mo_appropriate: '☝️😠', mo_bedtime: '🛏️🌙', mo_climb: '⬇️😠', mo_tidy: '🧹❗', mo_chase: '🏃', mo_caught: '🤣', mo_careful: '⚠️',
  mo_play_yes: '🏰🙌', mo_play_tired: '😩', mo_love: '💖', mo_cat: '🐱❌', mo_miles: '👶💕', mo_fort_down: '🏚️🛏️', mo_tv: '📺❌', mo_good: '👍⭐',
  r_hi: '👋', r_hi2: '👋', r_play_yes: '🏰🙌', r_food_great: '😋⭐', r_food_meh: '😬👍', r_nervous: '😅⏰', r_ok: '😰🍽️', r_stomach: '🤢', r_diarrhea: '🚽😱', r_notp: '🧻❌', r_burp: '💨',
  r_vomit: '🤮', r_tp_thanks: '🧻🙏', r_love: '💖🐻', r_comfort: '🤗', r_climb: '🐒⚠️', r_hi3: '🙌', r_play_yes2: '🤫🏰', r_food_good: '😋', r_comfort2: '🤗', r_tantrum: '🫁💙',
  r_catch: '🙌🐿️', r_horse: '🐴', r_chase: '👹', r_caught: '🤣', r_tidy: '🧹🏁', r_good: '🙌⭐', r_tv: '🫠📺', r_wow: '🤩', r_giggle: '🤣', r_fort_down: '🏚️💤', r_cat: '🐱🫳',
};

// spoken/display names (clips: assets/vo/w_i_<key>, w_a_<adj>, w_d_<art>)
const ING_WORD = {"milk": "Milk", "eggs": "Eggs", "cola": "Cola", "juicebox": "Juice Box", "whip": "Whipped Cream", "creamcheese": "Cream Cheese", "mustard": "Mustard", "worcester": "Brown Sauce", "garlic": "Garlic", "pizzabox": "Pizza", "bread": "Bread", "cheese": "Cheese", "strawberry": "Strawberry", "banana": "Banana", "pasta": "Spaghetti", "ketchup": "Ketchup", "chocolate": "Chocolate", "sprinkles": "Sprinkles", "spinach": "Spinach", "fish": "Fish", "carrot": "Carrot", "butter": "Butter", "flour": "Flour", "sugar": "Sugar", "pepper": "Chili", "pickles": "Pickles", "icecream": "Ice Cream", "broccoli": "Broccoli", "sausage": "Sausage", "catfood": "Cat Food", "cinnamon": "Cinnamon", "rice": "Rice", "peanutbutter": "Peanut Butter", "marshmallow": "Marshmallow", "lemon": "Lemon", "onion": "Onion", "tomato": "Tomato", "honey": "Honey", "cereal": "Cereal", "crackers": "Crackers", "apple": "Apple", "blueberry": "Blueberry", "bacon": "Bacon", "beans": "Beans", "oatmeal": "Oatmeal", "yogurt": "Yogurt", "oj": "Orange Juice", "hotsauce": "Hot Sauce", "mayo": "Mayo", "jam": "Jelly", "tortilla": "Tortilla", "ham": "Ham", "nuggets": "Nuggets", "peas": "Peas", "waffles": "Waffles", "avocado": "Avocado", "grapes": "Grapes", "watermelon": "Watermelon", "potato": "Potato", "popcorn": "Popcorn", "goldfish": "Fishy Crackers", "ramen": "Noodles", "soysauce": "Soy Sauce", "pickled_egg": "Pickled Egg", "olives": "Olives", "cocoa": "Cocoa", "babyfood": "Baby Food", "coffee": "Coffee", "sardines": "Sardines", "gummies": "Gummy Bears", "pumpkin": "Pumpkin", "orange": "Orange", "pear": "Pear", "chicken": "Chicken", "cookiedough": "Cookie Dough", "hummus": "Hummus", "pineapple": "Pineapple", "cucumber": "Cucumber", "corn": "Corn", "vanilla": "Vanilla", "syrup": "Maple Syrup", "tuna": "Tuna", "eggnog": "Eggnog"};
const DISH_WORD = {"cake": "Cake", "cupcakes": "Cupcakes", "pancakes": "Pancakes", "smoothie": "Smoothie", "milkshake": "Milkshake", "soup": "Soup", "sandwich": "Sandwich", "tower": "Tower", "pizza": "Pizza", "spaghetti": "Spaghetti", "omelette": "Omelette", "cookies": "Cookies", "pie": "Pie", "popsicle": "Ice Pop", "sundae": "Sundae", "iceblock": "Ice Block", "salad": "Salad", "burnt": "Charcoal Surprise", "slime": "Slime", "sludge": "Sludge", "friedrice": "Fried Rice", "toast": "Toast", "pudding": "Wobble Pudding", "casserole": "Casserole", "hotdog": "Hot Dog", "fishdish": "Fish Feast", "stew": "Stew", "rainbowcake": "Rainbow Stack", "grossshake": "Swamp Shake", "frozenmess": "Frozen Mystery"};
