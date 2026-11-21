// Chef Marina — game logic
const G = {
  room: 'living', mood: 'happy', holding: null, busy: false, outfit: 'default', hair: 'ginger', glasses: true, acc: null,
  mess: [], bathLocked: false, bathWho: null, tpEmpty: false, needTP: false, showerOn: false, snowman: 0, pile: 1, poop: false,
  fort: null, tv: null, chase: null, tidy: false, moodCtx: null, lastGreet: {}, lastTidyAsk: 0, lastClimbScold: 0, rory: false, night: 0,
};
const ENTS = [];
const SPEAK = { m: 'marina', d: 'daddy', mo: 'mommy', r: 'rory' };

// ---------------------------------------------------------------- entities
class Ent {
  constructor(o) { Object.assign(this, { x: 100, y: FLOOR, dir: 1, speed: 60, state: 'idle', animT: 0, scale: 1, hidden: false, vy: 0, rot: 0, offY: 0, path: null }, o); ENTS.push(this); }
  get here() { return this.room === G.room && !this.hidden; }
  walkTo(x, cb, speed, ty) {
    this.tx = clamp(x, 8, ROOMS[this.room].w - 8); this.ty = ty != null ? clamp(ty, DEPTH_MIN, DEPTH_MAX) : this.y;
    this.onArrive = cb || null; this.moving = true; if (speed) this.curSpeed = speed; else this.curSpeed = this.speed;
  }
  stop() { this.moving = false; this.onArrive = null; }
  update(dt) {
    this.animT += dt;
    if (this.moving) {
      const dx = this.tx - this.x, dy = (this.ty ?? this.y) - this.y, dist = Math.hypot(dx, dy), s = this.curSpeed * dt;
      if (dist <= s) { this.x = this.tx; this.y = this.ty ?? this.y; this.moving = false; const cb = this.onArrive; this.onArrive = null; cb && cb(); }
      else { this.x += dx / dist * s; this.y += dy / dist * s; if (Math.abs(dx) > 0.5) this.dir = Math.sign(dx); }
    }
  }
}
// Niko's pose: walk cycle when moving; photo-based lounge / lie / sit poses when resting
function nikoPose(e) {
  if (e.moving) return [frameKey('niko_walk', e.animT, e.curSpeed > 60 ? 18 : 10), 0.72, e.y];
  if (e.state === 'sleep') return e.perchY ? ['niko_lounge', 0.6, e.perchY] : ['niko_lie', 0.6, e.y];
  if (e.state === 'fort') return ['niko_lie', 0.55, e.y];
  if (e.state === 'eat' || e.state === 'litter') return ['niko', 0.72, e.state === 'litter' ? 152 : e.y];
  return ['niko_sit', 0.62, e.y];
}
function frameKey(base, t, fps = 10) { const n = frameCount(base); if (!n) return null; return base + '_' + (1 + (Math.floor(t * fps) % n)); }

let marina, daddy, mommy, rory, miles, niko;
function makeEnts() {
  marina = new Ent({ id: 'marina', room: 'living', x: 300, speed: 78, scale: 1.18 });
  daddy = new Ent({ id: 'daddy', room: 'living', x: 90, speed: 52, dir: -1 });
  mommy = new Ent({ id: 'mommy', room: 'kitchen', x: 300, speed: 55, dir: -1 });
  rory = new Ent({ id: 'rory', room: 'yard', x: 300, speed: 50, hidden: true });
  miles = new Ent({ id: 'miles', room: 'living', x: 568, spot: 'crib', crying: false, cryT: rnd(30, 60) });
  niko = new Ent({ id: 'niko', room: 'dining', x: 318, speed: 46, state: 'sleep', perch: 'cattower', t: rnd(15, 25) });
}

// ---------------------------------------------------------------- speech
function lineSpeaker(key) { return SPEAK[key.split('_')[0]]; }
function say(key, ent) {
  ent = ent || { marina, daddy, mommy, rory }[lineSpeaker(key)] || marina;
  const icon = SAY_ICON[key] || '💬';
  UI.bubble(ent, icon, 2200);
  const pr = Audio2.voice(key, lineSpeaker(key) || key);
  const who = lineSpeaker(key);
  if (who) UI.face(who, lineMood(key), pr, { sick: /stomach|vomit|burp|diarrhea|notp/.test(key), shake: /notfair|dontlike|cry|hey|_no$|angry|diarrhea|notp|vomit/.test(key) });
  return pr;
}
function lineMood(key) {
  const k = key.replace(/^(m|d|mo|r)_/, '');
  if (/stomach|vomit|burp|nervous|ok_ok|^ok$|food_meh|stinky|ugh|uhoh|diarrhea|notp|fort_fall|squirrel|wow|tired/.test(k)) return k === 'wow' ? 'surprised' : /food_meh|nervous|ok/.test(k) ? 'surprised' : /stinky|ugh/.test(k) ? 'angry' : 'surprised';
  if (/notfair|dontlike|angry|eat_angry|notbrainrot|hey|appropriate|bedtime|climb|tidy|tv|brainrot|cat$|chase|niko_poo|no$/.test(k)) return /chase/.test(k) ? 'happy' : (/cat$|tidy/.test(k) && key.startsWith('r_')) ? 'neutral' : 'angry';
  if (/cry|sad|eat_sad|comfort|tantrum|fort_down/.test(k)) return /comfort|tantrum|fort_down/.test(k) ? 'neutral' : 'sad';
  if (/hi|yay|love|wuv|play|food_great|food_good|good|giggle|catch|horse|giddyup|cuddle|happy|yummy|fort|did_it|princess|fairy|pretty|ride|leaves|snowman|monkey|swing|hewe|made|caught|tp_thanks|careful|miles/.test(k)) return 'happy';
  return 'neutral';
}
const sayOne = (keys, ent) => say(pick(keys), ent);

// ---------------------------------------------------------------- marina sprite selection
function mOpt() { const o = {}; if (G.hair !== 'ginger') o.hair = G.hair; if (!G.glasses) o.noGlasses = true; if (G.dye) o.dye = G.dye; return Object.keys(o).length ? o : null; }
function mBase() { return G.outfit === 'default' ? 'marina' : 'o_' + G.outfit; }
function mWalk() { return G.outfit === 'default' ? 'marina_walk' : 'o_' + G.outfit + '_walk'; }

// ---------------------------------------------------------------- drawing
function drawEnt(e) {
  if (!e.here) return;
  const t = e.animT, flip = e.dir < 0;
  switch (e.id) {
    case 'marina': return drawMarina(e);
    case 'daddy': case 'rory': {
      if (e.state === 'horse') { drawSprite(e.id + '_horse', e.x, e.y + Math.abs(Math.sin(t * 10)) * -3, { flip }); return; }
      if (e.state === 'lie') { drawSprite(e.id + '_lie', e.x, e.y + 2, { flip }); if (chance(0.02)) emit('zzz', e.x, e.y - 30); return; }
      if (e.state === 'toilet') return;
      if (e.state === 'shoulders' && has('daddy_shoulders') && e.id === 'daddy') { drawSprite(e.moving ? (frameKey('daddy_shoulders_walk', t, 12) || 'daddy_shoulders') : 'daddy_shoulders', e.x, e.y + Math.abs(Math.sin(t * 10)) * (e.moving ? -2 : 0), { flip, opt: null }); return; }
      if (e.hugT > E.t && has(e.id + '_hug')) { drawSprite(e.id + '_hug', e.x, e.y, { flip }); return; }
      if (e.state === 'eat' && frameCount(e.id + '_eat')) { drawSprite(frameKey(e.id + '_eat', t, 7), e.x, e.y, { flip }); if (chance(0.1)) emit('dust', e.x + e.dir * 10, e.y - 60, 1, { col: '#e8c27a', g: 200, vy: -10 }); return; }
      const k = e.moving ? frameKey(e.id + '_walk', t, e.curSpeed > 80 ? 16 : 9) : e.id;
      let sy = 1, rot = 0, oy = 0;
      if (e.state === 'eat') { sy = 1 + Math.sin(t * 12) * 0.03; if (chance(0.1)) emit('dust', e.x + e.dir * 10, e.y - 60, 1, { col: '#e8c27a', g: 200, vy: -10 }); }
      if (e.state === 'sick') { rot = Math.sin(t * 9) * 0.05; }
      if (e.state === 'vomit') { rot = 0.12 * (flip ? -1 : 1); }
      if (e.state === 'sitfort') { oy = 18; }
      drawSprite(k, e.x, e.y + oy, { flip, sy: e.hugT > E.t ? 1 + Math.sin(t * 8) * 0.04 : sy, rot });
      if (e.state === 'eat' && !frameCount(e.id + '_eat')) { drawSprite('dish_' + ((e.plate && e.plate.art) || 'cake'), e.x + e.dir * 14, e.y - 44, { scale: 0.45 }); emoji('🍴', e.x + e.dir * 8, e.y - 56 + Math.abs(Math.sin(t * 9)) * 6, 9); }
      if (e.state === 'sick' && chance(0.08)) emit('stink', e.x - e.dir * 6, e.y - 30);
      if (e.face) emoji(e.face, e.x + (flip ? -8 : 8), e.y - 78, 12);
      return; }
    case 'mommy': {
      if (e.state === 'sit') { drawSprite('mommy_sit', e.x, e.y - 2, { flip }); if (e.holdingMiles) drawSprite('miles', e.x + (flip ? -10 : 10), e.y - 30, { flip, scale: 0.7 }); return; }
      const k = e.moving ? frameKey('mommy_roll', t, e.curSpeed > 70 ? 16 : 9) : (e.hugT > E.t && frameCount('mommy_hug') ? frameKey('mommy_hug', t, 6) : 'mommy');
      drawSprite(k, e.x, e.y + 2, { flip });
      if (e.holdingMiles) drawSprite('miles', e.x + (flip ? -6 : 6), e.y - 34, { flip, scale: 0.7 });
      return; }
    case 'miles': {
      if (mommy.holdingMiles) return;
      const base = e.crying ? 'miles_cry' : (e.eatT > E.t && frameCount('miles_eat') ? 'miles_eat' : e.happyT > 0 ? (frameCount('miles_happy') ? 'miles_happy' : 'miles_giggle') : null);
      const k = base ? frameKey(base, t, 6) : 'miles';
      const y = e.spot === 'crib' ? BACK - 10 : 156;
      drawSprite(k, e.x, y, { flip: true, scale: 0.8 });
      if (e.crying && chance(0.15)) emit('tear', e.x - 4, y - 26, 1, { vx: rnd(-30, 30), vy: rnd(-60, -30) });
      return; }
    case 'niko': {
      if (e.state === 'held') return;
      const [k, sc, y] = nikoPose(e); let rot = 0, sy = 1;
      if (e.state === 'litter') sy = 0.94 + Math.sin(t * 6) * 0.03;
      if (e.state === 'eat') rot = 0.12 * (e.dir > 0 ? 1 : -1);
      if (e.state === 'sleep') { sy = 1 + Math.sin(t * 2) * 0.015; if (chance(0.015)) emit('zzz', e.x, y - 30); }
      drawSprite(k, e.x, y, { flip: e.dir < 0, scale: sc, rot, sy });
      return; }
  }
}
function drawMarina(e) {
  const t = e.animT, flip = e.dir < 0, opt = mOpt(), S = e.scale;
  let y = e.y + e.offY;
  const st = e.state;
  if (st === 'ride') return; // drawn with mount
  if (st === 'anim') return drawMarinaAnim(e, y, flip, opt, S);
  if (st === 'wheel') { drawSprite('wheelchair', e.x, y + 2, { flip, scale: 1.1 }); drawSprite('marina_sit', e.x + (flip ? 2 : -2), y - 8, { flip, scale: 0.95, opt }); drawHolding(e, y - 50); return; }
  if (st === 'tantrum') { const k = 'marina_tantrum_' + (5 + Math.floor(t * 12) % 4); drawSprite(k, e.x, y + 6, { flip, scale: S, opt }); if (chance(0.6)) emit('tear', e.x + (flip ? 12 : -12), y - 14, 2); if (chance(0.2)) emit('anger', e.x, y - 30); return; }
  if (st === 'flip') { const n = 1 + Math.min(7, Math.floor(e.flipT * 9)); drawSprite('marina_flip_' + n, e.x, y + 4, { flip, scale: S, opt }); return; }
  if (st === 'cheer') { drawSprite(frameKey('marina_cheer', t, 8), e.x, y, { flip, scale: S, opt }); return; }
  if (st === 'sit' || st === 'fort') { drawSprite('marina_sit', e.x, y + 2, { flip, scale: S * 0.95, opt }); drawHolding(e, y - 52); return; }
  if (st === 'swing') { const a = Math.sin(t * 2.6) * 0.6; const px = e.x, py = 60; const len = y - 40 - py; const sx = px + Math.sin(a) * len, sy2 = py + Math.cos(a) * len;
    const c = E.ctx; c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(px - 4 - E.camX, py); c.lineTo(sx - 4 - E.camX, sy2); c.moveTo(px + 4 - E.camX, py); c.lineTo(sx + 4 - E.camX, sy2); c.stroke();
    rect(sx - 8, sy2, 16, 3, e.swingKind === 'saucer' ? '#2f8fe0' : '#2a7a3a'); drawSprite('marina_sit', sx, sy2 + 4, { flip, scale: S * 0.95, opt, rot: a * 0.5 }); return; }
  if (st === 'bars') { const k = e.barMoving ? frameKey('marina_hang', t, 9) : 'marina_hang'; const b = visBox('marina_hang');
    drawSprite(k || 'marina_hang', e.x, e.railY - b[1] * S, { flip, scale: S, opt: mOpt(), rot: e.barMoving ? 0 : Math.sin(t * 3) * 0.06 }); return; }
  let k = mBase();
  if (e.moving || st === 'run') k = frameKey(mWalk(), t, e.curSpeed > 90 ? 16 : 11) || k;
  let sy = 1;
  if (st === 'stomp') { sy = 1 - Math.abs(Math.sin(t * 14)) * 0.08; }
  if (st === 'sad' && chance(0.25)) emit('tear', e.x + (flip ? -6 : 6), y - 50, 1, { vx: rnd(-20, 20), vy: rnd(-30, -10) });
  drawLook(e, k, y, flip, S, 'back');
  drawSprite(k, e.x, y, { flip, scale: S, opt, sy, rot: e.rot });
  drawLook(e, k, y, flip, S, 'front');
  drawHolding(e, y - 74 * S);
}
function drawHolding(e, y) {
  const h = G.holding; if (!h) return;
  const x = e.x + (e.dir < 0 ? -10 : 10);
  if (h.type === 'dish') drawSprite('dish_' + h.dish.art, x, y + 30, { scale: 0.55, opt: h.dish.tint ? { tint: h.dish.tint } : null });
  else if (h.type === 'tp') drawSprite('tp_roll', x, y + 30, { scale: 0.5 });
  else if (h.type === 'niko') { drawSprite('niko', e.x + (e.dir < 0 ? -4 : 4), y + 44 + Math.sin(E.t * 30) * (h.struggle ? 2 : 0), { flip: e.dir < 0, scale: 0.45, rot: h.struggle ? Math.sin(E.t * 25) * 0.3 : 0.4 }); }
  else if (h.type === 'blower') { drawSprite('leaf_blower', x + 4, y + 50, { flip: e.dir < 0, scale: 0.7 }); }
  else emoji(h.ico || '❓', x, y + 20, 12);
}
function drawMounted() {
  if (drawMounted.f === E.t) return; drawMounted.f = E.t;
  // Marina riding on daddy/rory
  if (marina.state !== 'ride' || !marina.mount || !marina.mount.here) return;
  const m = marina.mount; const bob = Math.abs(Math.sin(m.animT * 10)) * -3;
  drawSprite('marina_sit', m.x + (m.dir < 0 ? 6 : -6), m.y - 40 + bob, { flip: m.dir < 0, scale: 1.05, opt: mOpt() });
}
const isWallProp = p => !p.z && p.y <= BACK + 6;
function propVisible(p) { return !(p.fallOnly && WEATHER !== 'fall') && !(p.snowOnly && WEATHER !== 'snow'); }
function drawProps(z) { // z=0: wall props only (floor props are depth-sorted with characters)
  for (const p of PROPS[G.room]) if (z === 0 && isWallProp(p)) drawProp(p);
  if (z === 0 && G.room === 'foyer' && G.bathLocked && chance(0.25)) emit('stink', 140 + rnd(-8, 8), BACK - 10 - rnd(0, 60));
}
function drawProp(p) {
  {
    if (!propVisible(p)) return;
    if (p.id === 'blower' && G.holding && G.holding.type === 'blower') return;
    if (p.id === 'armchair' && mommy.here && mommy.state === 'sit') return;
    if (p.k.startsWith('p:')) {
      if (BAKED(p.k) && bgFor(G.room)) { drawDoorState(p); return; }
      drawProc(p); drawDoorState(p); return; }
    let k = p.k, sc = p.scale || 1, opt = null;
    if (p.id === 'fridge' && G.fridgeOpen > 0) k = 'fridge_open';
    if (p.id === 'leafpile') sc = 0.5 + G.pile * 0.22;
    if (p.id === 'tv') { drawTV(p); return; }
    drawSprite(k, p.x, p.y, { flip: !!p.flip, scale: sc, opt });
    if (p.id === 'tray' && G.poop) { emoji('💩', p.x + 4, p.y - 14, 9); if (chance(0.12)) emit('stink', p.x + rnd(-8, 8), p.y - 18); }
    if (p.id === 'stove' && G.cooking) { if (chance(0.3)) emit('steam', p.x + rnd(-10, 10), p.y - 30); }
  }
}
// doors: lock badge + swing-open animation
function drawDoorState(p) {
  if (p.a !== 'door') return;
  if (G.bathLocked && p.to === 'bathroom') { rect(p.x - 7, p.y - 64, 14, 11, '#d33'); emoji('🔒', p.x, p.y - 58, 9); }
  const o = G.doorAnim && G.doorAnim.id === p.id && G.doorAnim.room === G.room ? G.doorAnim : null;
  if (!o || !p.w) return;
  const k = clamp((E.t - o.t0) / 0.35, 0, 1), w = p.w * (1 - k * 0.85);
  rect(p.x - p.w / 2, p.y - p.h, p.w, p.h, 'rgba(20,14,10,.85)'); // dark doorway
  rect(p.x - p.w / 2, p.y - p.h, w, p.h, '#f3f1ea'); rect(p.x - p.w / 2 + w - 2, p.y - p.h, 2, p.h, '#c9c4b8');
}
function drawTV(p) {
  rect(p.x - 40, p.y - 46, 80, 46, '#0c0c0e'); rect(p.x - 38, p.y - 44, 76, 40, '#141418');
  if (G.tv) {
    const img = G.tv === 'fish' ? 'tv_fish' : 'tv_cartoon';
    const jig = Math.sin(E.t * 20) * (G.tv === 'fish' ? 1 : 2);
    E.ctx.save(); E.ctx.beginPath(); E.ctx.rect(p.x - 38 - E.camX, p.y - 44, 76, 40); E.ctx.clip();
    drawSprite(img, p.x + jig, p.y - 2 + Math.abs(jig), { scale: 0.8 });
    if (chance(0.2)) { E.ctx.fillStyle = `hsla(${(E.t * 300) % 360},90%,60%,.25)`; E.ctx.fillRect(p.x - 38 - E.camX, p.y - 44, 76, 40); }
    E.ctx.restore();
    if (chance(0.05)) emit('note', p.x + rnd(-30, 30), p.y - 20);
  }
}
function drawMess() {
  for (const m of G.mess) if (m.room === G.room) {
    if (m.key) drawSprite(m.key, m.x, m.y, { scale: m.s || 0.6, rot: m.rot || 0 });
    else if (m.type === 'vomit') { rect(m.x - 12, m.y - 2, 24, 4, '#a5c33a'); rect(m.x - 8, m.y - 4, 14, 3, '#c7b43a'); }
    else emoji(m.ico, m.x, m.y - 5, 11, 1, m.rot || 0);
    if (G.tidy && Math.sin(E.t * 8) > 0) emoji('✨', m.x + 6, m.y - 14, 8);
  }
}

// ---------------------------------------------------------------- fort
const FORT_PIECES = [
  { id: 'chair', key: 'chair_wood', kind: 'support', h: 48, w: 28 },
  { id: 'box', key: 'cardboard_box', kind: 'support', h: 30, w: 36 },
  { id: 'basket', key: 'laundry_basket', kind: 'support', h: 26, w: 30 },
  { id: 'foam', key: 'foam_mat', kind: 'support', h: 42, w: 32 },
  { id: 'cushion', key: 'cushion', kind: 'support', h: 22, w: 40 },
  { id: 'blanket', key: 'blanket', kind: 'roof' },
  { id: 'blanket2', key: 'blanket2', kind: 'roof' },
  { id: 'lights', key: 'fairy_lights', kind: 'deco' },
];
function fortLayout() {
  const f = G.fort; if (!f) return;
  const sups = f.pieces.filter(p => p.def.kind === 'support');
  let L = f.x - 10, R = f.x + 10; let maxH = 0;
  sups.forEach((p, i) => { const side = i % 2 ? 1 : -1, n = Math.floor(i / 2); p.tx = f.x + side * (26 + n * 24); p.ty = FLOOR + 2 - (i >= 4 ? 0 : 0); maxH = Math.max(maxH, p.def.h); L = Math.min(L, p.tx); R = Math.max(R, p.tx); });
  f.roofY = FLOOR - Math.max(30, maxH) + 2; f.L = L - 14; f.R = R + 14;
  const roofs = f.pieces.filter(p => p.def.kind === 'roof'); roofs.forEach((p, i) => { p.tx = f.x + (i % 2 ? 12 : -12); p.ty = f.roofY + 14 + i * -3; });
  const decos = f.pieces.filter(p => p.def.kind === 'deco'); decos.forEach((p, i) => { p.tx = f.x; p.ty = f.roofY + 6 + i * 3; });
  f.complete = sups.length >= 2 && roofs.length >= 1;
}
function drawFort(front) {
  const f = G.fort; if (!f || f.room !== G.room) return;
  for (const p of f.pieces) {
    if (p.fall) { drawSprite(p.def.key, p.x, p.y, { rot: p.rot, scale: p.def.kind === 'roof' ? 1.3 : 1 }); continue; }
    if (front !== (p.def.kind !== 'support')) continue;
    if (p.def.kind === 'roof') { const w = Math.max(60, f.R - f.L); drawSprite(p.def.key, p.x, p.y, { sx: w / 56, sy: 1.3, alpha: front && f.inside ? 0.85 : 1 }); }
    else if (p.def.kind === 'deco') { drawSprite(p.def.key, p.x, p.y, { sx: Math.max(60, f.R - f.L) / 96 }); if (chance(0.15)) emit('sparkle', p.x + rnd(-30, 30), p.y - 8); }
    else drawSprite(p.def.key, p.x, p.y);
  }
}
function updateFort(dt) {
  const f = G.fort; if (!f) return;
  for (const p of f.pieces) {
    if (p.fall) { p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y > FLOOR + 6) { p.y = FLOOR + 6; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; } continue; }
    p.x += (p.tx - p.x) * Math.min(1, dt * 8); p.y += (p.ty - p.y) * Math.min(1, dt * 8);
  }
  if (f.collapsed) { f.collapseT -= dt; if (f.collapseT <= 0) { // pieces become mess
      for (const p of f.pieces) G.mess.push({ room: f.room, x: clamp(p.x, 20, ROOMS[f.room].w - 20), y: FLOOR + 8, key: p.def.key, s: 0.5, rot: p.rot % 1 });
      G.fort = null; } }
}

// ---------------------------------------------------------------- update
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; E.t += dt; E.dt = dt;
  update(dt); render();
  requestAnimationFrame(loop);
}
function update(dt) {
  for (const e of ENTS) e.update(dt);
  if (marina.state === 'flip') { marina.flipT += dt; }
  if (marina.mount) { marina.x = marina.mount.x; marina.y = marina.mount.y; marina.room = marina.mount.room; }
  if (G.holding && G.holding.type === 'niko') niko.x = marina.x, niko.room = marina.room;
  // room edges for marina
  const mv = marina.mount || marina;
  if (mv.moving && !G.busy) {
    const R = ROOMS[G.room];
    if (mv.tx <= 8 && mv.x <= 10 && R.left) changeRoom(R.left, 'right');
    else if (mv.tx >= R.w - 8 && mv.x >= R.w - 10 && R.right) changeRoom(R.right, 'left');
  }
  // camera
  const R = ROOMS[G.room];
  const target = R.w <= E.viewW ? -(E.viewW - R.w) / 2 : clamp(marina.x - E.viewW / 2, 0, R.w - E.viewW);
  E.camX += (target - E.camX) * Math.min(1, dt * 6); if (Math.abs(target - E.camX) < 0.3) E.camX = target;
  if (G.fridgeOpen > 0) G.fridgeOpen -= dt;
  if (WEATHER === 'snow' && G.room === 'yard' && chance(0.6)) emit('snow', E.camX + rnd(0, E.viewW), -4);
  if (G.chase) updateChase(dt);
  updateFort(dt); updateParticles(dt); AI.update(dt); UI.update(); if (window.featTick) featTick(dt);
}
function render() {
  const ctx = E.ctx; ctx.setTransform(E.scale, 0, 0, E.scale, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1d1830'; ctx.fillRect(-10, -10, E.viewW + 20, SH + 20);
  drawRoomBG(G.room); drawProps(0); drawFort(false); drawMess();
  const items = [];
  for (const p of PROPS[G.room]) if (!isWallProp(p)) items.push({ y: p.y, f: () => drawProp(p) });
  if (G.room === 'living' && mommy.state === 'sit' && mommy.room === 'living' && marina.state !== 'wheel') items.push({ y: BACK + 16, f: () => drawSprite('wheelchair', mommy.x + 36, BACK + 16) });
  for (const e of ENTS) if (e.here) items.push({ y: e.y + (e === marina ? 0.5 : 0), f: () => { E.depth = depthScale(e.y); drawEnt(e); if (e === marina) drawMounted(); E.depth = 1; } });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.f();
  drawFort(true); drawParticles();
  if (window.drawExitSigns) drawExitSigns();
  if (G.night > 0) { ctx.fillStyle = `rgba(10,10,40,${Math.min(0.85, G.night)})`; ctx.fillRect(-10, -10, E.viewW + 20, SH + 20); }
}

// ---------------------------------------------------------------- rooms
function changeRoom(room, from, x) {
  if (G.room === room) return;
  UI.closeActions();
  const prev = G.room; G.room = room;
  marina.room = room; marina.stop();
  const W = ROOMS[room].w;
  marina.x = x != null ? x : from === 'right' ? W - 14 : from === 'left' ? 14 : W / 2;
  if (G.holding && G.holding.type === 'niko') { niko.room = room; }
  if (marina.mount) { marina.mount.room = room; marina.mount.x = marina.x; marina.mount.stop(); }
  if (marina.state === 'wheel') {}
  E.camX = clamp(marina.x - E.viewW / 2, 0, Math.max(0, W - E.viewW));
  UI.flash(); setMusic();
  // the chaser follows
  if (G.chase) { const c = G.chase.who; setTimeout(() => { if (G.chase && G.chase.who === c) { c.room = room; c.x = from === 'right' ? W - 6 : from === 'left' ? 6 : marina.x - 40; } }, 900); }
  document.getElementById('weatherBtn').classList.toggle('hidden', room !== 'yard');
  setTimeout(() => onEnterRoom(room), 450);
}
function setMusic() {
  let m = 'explore';
  if (G.chase) m = 'chase'; else if (marina.state === 'tantrum') m = 'tantrum'; else if (G.night > 0) m = 'night';
  else if (G.fort && G.fort.inside) m = 'fort'; else if (G.tv && G.room === 'living') m = 'tv'; else if (UI.panelMode === 'cook') m = 'kitchen';
  else if (UI.panelMode === 'dress') m = 'dress'; else if (UI.panelMode === 'crafts') m = 'crafts';
  else if (G.bathLocked && G.room === 'foyer') m = 'gross';
  else if (G.room === 'yard') m = WEATHER === 'snow' ? 'snow' : 'yard'; else if (G.room === 'kitchen') m = 'kitchen'; else if (G.room === 'bathroom') m = 'bath';
  Audio2.Music.set(m);
}
function family() { return [daddy, mommy, rory].filter(e => e.here && !['toilet'].includes(e.state)); }
function nearestFamily() { const f = family().filter(e => e.state !== 'lie'); f.sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x)); return f[0]; }
function parentsHere() { return [daddy, mommy].filter(e => e.here && e.state !== 'toilet' && e.state !== 'lie'); }

function onEnterRoom(room) {
  if (room === 'playroom' && G.poop) { say('m_ugh_niko'); return; }
  if (room === 'foyer' && G.bathLocked) { setTimeout(() => say('m_stinky'), 300); return; }
  const f = family().filter(e => !e.busy && e.state !== 'lie' && e.state !== 'horse');
  if (!f.length) return;
  const e = pick(f), now = E.t;
  if (G.lastGreet[e.id] && now - G.lastGreet[e.id] < 30) return;
  G.lastGreet[e.id] = now;
  e.dir = Math.sign(marina.x - e.x) || 1;
  const key = e.id === 'daddy' ? (AI.daddyTired ? 'd_hi_tired' : pick(['d_hi1', 'd_hi2', 'd_hi3'])) : e.id === 'mommy' ? pick(['mo_hi1', 'mo_hi2']) : pick(['r_hi', 'r_hi2', 'r_hi3']);
  say(key, e).then(() => { G.moodCtx = { type: 'greet', who: e }; UI.pulseMoods(); });
}

// ---------------------------------------------------------------- input
function onTap(px, py) {
  if (G.busy) return;
  Audio2.blip(7, 'triangle', 0.05, 0.08);
  let [wx, wy] = toWorld(px, py);
  const hit = hitTest(wx, wy);
  if (G.chase && G.chase.fleeing) { marina.walkTo(wx, null, 92); return; }
  if (hit) return interact(hit, wx, wy);
  UI.closeActions();
  if (marina.state === 'bars') { const mb = G.mb; if (!mb) return; if (Math.abs(wx - marina.x) < 14) return dropFromBars(); mb.dir = wx > marina.x ? 1 : -1; mb.go = true; return; }
  if (['tantrum', 'flip', 'swing', 'bars', 'perch'].includes(marina.state)) { if (marina.state === 'perch') return getDown(); if (marina.state === 'swing' || marina.state === 'bars') return leaveYardToy(); return; }
  if (marina.state === 'fort') { exitFort(); }
  if (marina.state === 'sit' || marina.state === 'sad' || marina.state === 'stomp' || marina.state === 'cheer') marina.state = 'idle';
  if (G.holding && G.holding.type === 'blower') { blowLeaves(wx); }
  const mover = marina.mount || marina;
  const RR = ROOMS[G.room];
  if (RR.left && E.camX <= 1 && wx < Math.max(0, E.camX) + 22) wx = 0;
  if (RR.right && E.camX + E.viewW >= RR.w - 1 && wx > Math.min(RR.w, E.camX + E.viewW) - 22) wx = RR.w;
  mover.walkTo(wx, null, marina.mount ? 75 : marina.state === 'wheel' ? 95 : null, wy > WALL_Y ? wy + 6 : null);
}
function hitTest(wx, wy) {
  // mess items when tidying
  if (G.tidy) for (const m of G.mess) if (m.room === G.room && Math.abs(m.x - wx) < 14 && Math.abs(m.y - 6 - wy) < 14) return { kind: 'mess', m };
  // entities
  const ents = ENTS.filter(e => e.here && e !== marina).sort((a, b) => b.y - a.y);
  for (const e of ents) {
    if (e === miles && mommy.holdingMiles) continue;
    if (e.state === 'toilet' || (e === niko && e.state === 'held')) continue;
    let key = e.id, sc = 1, ey = e.y;
    if (e === miles) { sc = 0.8; ey = e.spot === 'crib' ? BACK - 10 : 156; }
    if (e === niko) { const np = nikoPose(e); key = np[0].replace(/_\d+$/, '_1'); if (!E.A[key]) key = np[0]; sc = np[1]; ey = np[2]; }
    if (e === mommy && e.state === 'sit') key = 'mommy_sit';
    if ((e === daddy || e === rory) && e.state === 'lie') key = e.id + '_lie';
    if ((e === daddy || e === rory) && e.state === 'horse') key = e.id + '_horse';
    const b = visBox(key), pad = 6;
    if (wx > e.x + b[0] * sc - pad && wx < e.x + b[2] * sc + pad && wy > ey + b[1] * sc - pad && wy < ey + b[3] * sc + pad) return { kind: 'ent', e };
  }
  // marina herself
  { const b = visBox(mBase()), s = marina.scale; if (wx > marina.x + b[0] * s && wx < marina.x + b[2] * s && wy > marina.y + marina.offY + b[1] * s && wy < marina.y + marina.offY + b[3] * s) return { kind: 'self' }; }
  // fort
  const f = G.fort; if (f && f.room === G.room && !f.collapsed && f.pieces.length && wx > f.L && wx < f.R && wy > f.roofY - 10 && wy < FLOOR + 8) return { kind: 'fort' };
  // props (front first)
  const props = PROPS[G.room].filter(p => !p.nohit && !(p.fallOnly && WEATHER !== 'fall') && !(p.snowOnly && WEATHER !== 'snow'));
  if (G.room === 'living' && mommy.state === 'sit' && mommy.room === 'living' && marina.state !== 'wheel' && Math.abs(wx - (mommy.x + 36)) < 18 && wy > BACK - 30 && wy < BACK + 18) return { kind: 'prop', p: { id: 'parkedchair', a: 'parkedchair', x: mommy.x + 36, y: BACK + 16 } };
  for (const z of [1, 0]) for (const p of props.filter(p => (p.z || 0) === z).reverse()) {
    let b; if (p.k.startsWith('p:')) b = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; const v = visBox(p.k); b = v.map(n => n * sc); }
    const pad = 4;
    if (wx > p.x + b[0] - pad && wx < p.x + b[2] + pad && wy > p.y + b[1] - pad && wy < p.y + b[3] + pad) return { kind: 'prop', p };
  }
  return null;
}

// walk next to something, then call cb
function approach(x, cb, gap = 18) {
  const mover = marina.mount || marina;
  if (marina.state === 'fort') exitFort();
  if (['sit', 'sad', 'stomp', 'cheer'].includes(marina.state)) marina.state = 'idle';
  const side = marina.x < x ? -1 : 1; const tx = x + side * gap;
  if (Math.abs(mover.x - tx) < 4 && Math.abs(mover.y - FLOOR) < 3) { mover.dir = Math.sign(x - mover.x) || mover.dir; cb && cb(); return; }
  mover.walkTo(tx, () => { mover.dir = Math.sign(x - mover.x) || mover.dir; cb && cb(); }, marina.state === 'wheel' ? 95 : null, FLOOR);
}

function interact(hit, wx, wy) {
  if (hit.kind === 'mess') return pickUpMess(hit.m);
  if (hit.kind === 'self') return UI.actions(marina, selfActions());
  if (hit.kind === 'fort') return approach(G.fort.x, () => UI.actions({ x: G.fort.x, y: G.fort.roofY - 6 }, fortActions()), 0);
  if (hit.kind === 'ent') { const e = hit.e; return approach(e.x, () => UI.actions(e, entActions(e)), e === niko || e === miles ? 14 : 22); }
  if (hit.kind === 'prop') {
    const p = hit.p;
    if (p.a === 'door') return approach(p.x, () => useDoor(p), 0);
    const acts = propActions(p); if (!acts.length) return approach(p.x, null);
    return approach(p.x, () => UI.actions({ x: p.x, y: p.y - (p.h || spriteSize(p.k)[1] * (p.scale || 1)) - 4, prop: p }, acts), p.z ? 14 : 4);
  }
}

// ---------------------------------------------------------------- actions definitions
function A(ico, fn, img) { return { ico, fn, img }; }
function selfActions() {
  const a = [];
  if (marina.state === 'perch') { a.push(A('🤸', doFlip)); if (daddy.here || rory.here) a.push(A('🐿️', flyingSquirrel)); a.push(A('⬇️', getDown)); return a; }
  if (marina.state === 'ride') { a.push(A('🐴', () => { say('m_giddyup'); say(marina.mount.id === 'daddy' ? 'd_horse' : 'r_horse', marina.mount); })); a.push(A('⬇️', dismount)); return a; }
  if (marina.state === 'wheel') { a.push(A('⬇️', leaveWheelchair)); return a; }
  if (marina.state === 'bars') { a.push(A('⬅️', () => { G.mb.dir = -1; G.mb.go = true; }), A('⬇️', dropFromBars), A('➡️', () => { G.mb.dir = 1; G.mb.go = true; })); return a; }
  if (marina.state === 'swing') { a.push(A('⬇️', leaveYardToy)); return a; }
  if (marina.state === 'fort') return fortActions();
  if (G.holding) a.push(A('⬇️', dropHolding));
  a.push(A('🤸', doFlip), A('💃', () => { marina.state = 'cheer'; say(pick(['m_yay', 'm_giggle', 'm_happy'])); emit('note', marina.x, marina.y - 70, 3); setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 2200); }));
  return a;
}
function entActions(e) {
  const a = [];
  if (e === niko) {
    a.push(A('✋', petNiko));
    if (!G.holding) a.push(A('🤗', pickupNiko));
    a.push(A('🏃', chaseNiko));
    if (G.fort && G.fort.complete && G.fort.room === G.room) a.push(A('🏰', () => inviteToFort(niko)));
    return a;
  }
  if (e === miles) return [A('🍼', () => soothe('bottle')), A('🤗', () => soothe('cuddle')), A('✋', () => soothe('stroke'))];
  // people
  a.push(A('🤗', () => cuddle(e)));
  if (G.holding && G.holding.type === 'dish' && (e === daddy || e === rory)) a.unshift(A('🍽️', () => serve(e)));
  if (G.holding && G.holding.type === 'dish' && e === mommy) a.unshift(A('🍽️', () => serveMommy()));
  if ((e === daddy || e === rory) && e.state !== 'lie' && !G.holding && marina.state !== 'ride') a.push(A('🐴', () => mount(e)));
  if (G.fort && G.fort.complete && G.fort.room === G.room) a.push(A('🏰', () => inviteToFort(e)));
  if (G.pendingDish && G.pendingDish.who === e) a.unshift(A('🍽️', () => pressureEat(e)));
  return a;
}
function propActions(p) {
  const a = [], climb = () => climbOn(p);
  const cook = A('🍳', () => UI.openCook());
  switch (p.a) {
    case 'fridge': a.push(A('🧊', () => { G.fridgeOpen = 2.5; Audio2.whoosh(); setTimeout(() => UI.openCook('fridge'), 500); }), A('❄️', () => { G.fridgeOpen = 2.5; Audio2.whoosh(); setTimeout(() => UI.openCook('freezer'), 500); })); break;
    case 'stove': case 'oven': a.push(cook, A('🗄️', () => UI.openCook('cabinet'))); if (p.climb) a.push(A('🧗', climb)); break;
    case 'island': a.push(A('🧺', () => UI.openCook('bowl')), A('🗄️', () => UI.openCook('cabinet'))); if (p.climb) a.push(A('🧗', climb)); break;
    case 'sink': a.push(A('🗄️', () => UI.openCook('cabinet'))); a.push(A('🚰', () => { Audio2.sfx('sink'); for (let i = 0; i < 30; i++) setTimeout(() => emit('water', p.x + 4, p.y - 34), i * 40); say('m_wash'); })); break;
    case 'dishwasher': a.push(A('🍽️', () => { Audio2.whoosh(); Audio2.noise(0.8, 0.15, 400); })); break;
    case 'bowls': a.push(A('🐟', feedNiko)); break;
    case 'closet': a.push(A('👗', () => UI.openDress())); if (G.needTP) a.push(A('🧻', takeTP)); break;
    case 'dresser': a.push(A('👗', () => UI.openDress())); if (G.needTP) a.push(A('🧻', takeTP)); break;
    case 'table': a.push(A('🎨', () => UI.openCrafts('draw')), A('➕', () => UI.openCrafts('math')), A('🔤', () => UI.openCrafts('spell')), A('🧗', climb)); break;
    case 'chair': case 'stool': case 'kidtable': case 'armchair': a.push(A('🧗', climb)); a.push(A('🪑', () => sitDown(p))); if (p.a === 'kidtable') a.push(A('🎨', () => UI.openCrafts('draw'))); break;
    case 'sofa': a.push(A('🧗', climb), A('🪑', () => sitDown(p))); if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); break;
    case 'cattower': if (niko.perch === 'cattower' && niko.room === 'dining') a.push(A('✋', petNiko)); a.push(A('🧶', () => { emit('star', p.x, p.y - 60, 4); Audio2.sfx('meow2'); })); break;
    case 'litter': if (G.poop) { a.push(A('🧻', wrapPoop)); } else a.push(A('🔍', () => { say('m_hmm'); })); break;
    case 'litterdome': a.push(A('🔍', () => say('m_stinky'))); break;
    case 'bouncy': a.push(A('🦄', () => { marina.state = 'cheer'; say('m_giggle'); emit('star', p.x, p.y - 30, 6); Audio2.jingle([0, 4, 7, 12]); setTimeout(() => marina.state = 'idle', 1800); })); break;
    case 'toy': case 'toybox': case 'books': case 'basket': a.push(A('🧸', () => makeMess(p))); if (p.a === 'basket' && G.needTP) a.push(A('🧻', takeTP)); break;
    case 'box': a.push(A('📦', () => { if (niko.room === G.room) { niko.state = 'wander'; niko.walkTo(p.x, () => { niko.state = 'sleep'; niko.perchY = p.y - 18; }); Audio2.sfx('meow2'); } else say('m_hmm'); })); if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); break;
    case 'keyboard': a.push(A('🎹', () => { const s = [0, 2, 4, 7, 9, 12, 14]; for (let i = 0; i < 6; i++) setTimeout(() => Audio2.blip(pick(s), 'square', 0.18, 0.2), i * 170); emit('note', p.x, p.y - 20, 4); })); break;
    case 'broom': a.push(A('🧹', () => { if (G.mess.some(m => m.room === G.room)) startTidy(true); else { emit('dust', p.x, p.y - 10, 6); say('m_ok_tidy'); } })); break;
    case 'rocker': a.push(A('🪑', () => sitDown(p))); break;
    case 'crib': if (miles.spot === 'crib' && !mommy.holdingMiles) a.push(A('👶', () => { approach(miles.x, () => UI.actions(miles, entActions(miles)), 12); })); a.push(A('🧸', () => makeMess(p))); break;
    case 'bouncer': a.push(A('👶', () => { miles.spot = 'bouncer'; miles.x = 300; mommy.holdingMiles = false; Audio2.jingle([0, 7]); })); break;
    case 'pail': if (G.holding && G.holding.type === 'poop') a.push(A('🗑️', binPoop)); else a.push(A('🤢', () => { say('m_stinky'); emit('stink', p.x, p.y - 30, 4); })); break;
    case 'tv': case 'fireplace': a.push(A('🐟', () => tvOn('fish')), A('🍌', () => tvOn('cartoon'))); if (G.tv) a.push(A('⏻', tvOff)); break;
    case 'lamp': a.push(A('💡', () => { Audio2.blip(12, 'sine', 0.1); emit('sparkle', p.x, p.y - 74, 6); })); break;
    case 'stairs': a.push(A('🪜', () => { say('m_tired'); })); break;
    case 'toilet': a.push(A('🚽', flushToilet)); if (G.holding && G.holding.type === 'poop') a.unshift(A('💩', flushPoop)); a.push(A('🧗', climb)); break;
    case 'bathsink': a.push(A('🚰', () => { Audio2.sfx('sink'); say('m_wash'); for (let i = 0; i < 30; i++) setTimeout(() => emit('water', p.x + 2, p.y - 40), i * 40); })); break;
    case 'mirror': a.push(A('🪞', () => { say('m_pretty'); emit('heart', marina.x, marina.y - 70, 3); })); break;
    case 'shower': a.push(A('🚿', () => { G.showerOn = !G.showerOn; if (G.showerOn) Audio2.sfx('sink', { rate: 0.8 }); })); break;
    case 'tp': if (!G.tpEmpty) a.push(A('🧻', takeTP)); break;
    case 'freshener': a.push(A('🌸', () => { for (let i = 0; i < 20; i++) emit('sparkle', p.x + rnd(-20, 20), p.y - 10 + rnd(-10, 10), 1, { col: '#ffb0d8' }); Audio2.noise(0.6, 0.2, 3000); clearStink(); })); break;
    case 'parkedchair': a.push(A('♿', rideWheelchair)); break;
    case 'garage': a.push(A('🔒', () => { Audio2.sfx('knock'); say('m_hmm'); })); break;
    case 'car': a.push(A('📯', () => { Audio2.blip(-5, 'square', 0.3, 0.3); setTimeout(() => Audio2.blip(-5, 'square', 0.3, 0.3), 350); })); break;
    case 'tree': a.push(A('🍂', () => { for (let i = 0; i < 30; i++) emit('leaf', p.x + rnd(-30, 30), p.y - 100 + rnd(0, 40)); Audio2.sfx('leaves'); })); break;
    case 'monkeybars': a.push(A('🐒', () => monkeyBars(p))); break;
    case 'swingset': a.push(A('🟦', () => yardToy('saucer', p)), A('🟩', () => yardToy('belt', p)), A('🧗', () => yardToy('climb', p))); break;
    case 'leafpile': if (G.pile >= 2) a.push(A('🦘', jumpLeaves)); a.push(A('🍂', () => { G.pile = Math.min(5, G.pile + 0.4); emit('leaf', p.x, p.y - 10, 8); Audio2.sfx('leaves'); })); break;
    case 'blower': a.push(A('🍃', () => { G.holding = { type: 'blower' }; Audio2.sfx('leafblower'); say('m_leaves'); })); break;
    case 'snowman': a.push(A('⛄', buildSnowman)); if (G.snowman >= 3) a.push(A('💥', () => { G.snowman = 0; for (let i = 0; i < 30; i++) emit('snow', p.x + rnd(-15, 15), p.y - 30, 1, { vy: rnd(-80, -20), vx: rnd(-60, 60), g: 200, life: 1.5 }); Audio2.sfx('crunch_snow'); say('m_giggle'); })); break;
  }
  if (G.holding && G.holding.type === 'dish' && ['table', 'island', 'kidtable'].includes(p.a)) a.push(A('⬇️', dropHolding));
  return a;
}

// ---------------------------------------------------------------- basic activities
function sitDown(p) { approach(p.x, () => { marina.state = 'sit'; marina.offY = (p.climb ? -Math.min(30, (FLOOR - p.climb) * 0.45) : -10); setTimeout(() => {}, 0); }, 0); }
function dropHolding() { const h = G.holding; G.holding = null; if (h && h.type === 'tp') {} if (h && h.type === 'dish') { emit('sparkle', marina.x, marina.y - 40, 4); } if (h && h.type === 'blower') {} }
function cuddle(e) {
  G.busy = true; marina.state = 'idle';
  emit('heart', (marina.x + e.x) / 2, marina.y - 70, 6);
  const key = e === daddy ? 'm_wuv_daddy' : e === mommy ? 'm_wuv_mommy' : 'm_wuv_rory';
  say(key).then(() => { emit('heart', e.x, e.y - 80, 5); return say(e === daddy ? pick(['d_love', 'd_cuddle']) : e === mommy ? 'mo_love' : 'r_love', e); }).then(() => G.busy = false);
}
function climbOn(p) {
  approach(p.x, () => {
    G.busy = true; const startY = marina.y, top = p.climb || 120; let t = 0;
    Audio2.whoosh(true);
    const iv = setInterval(() => { t += 0.05; marina.offY = (top - FLOOR) * Math.min(1, t / 0.4) - Math.sin(Math.min(1, t / 0.4) * Math.PI) * 14; if (t >= 0.4) { clearInterval(iv); marina.state = 'perch'; marina.perchProp = p; G.busy = false; afterClimb(); } }, 50);
  }, 0);
}
function afterClimb() {
  setTimeout(() => {
    if (marina.state !== 'perch') return;
    const ps = parentsHere(); if (!ps.length && !rory.here) return say('m_flip');
    if (E.t - G.lastClimbScold < 8) return;
    G.lastClimbScold = E.t; const p = ps.length ? pick(ps) : rory;
    p.dir = Math.sign(marina.x - p.x) || 1;
    say(p === daddy ? 'd_climb' : p === mommy ? 'mo_climb' : 'r_climb', p).then(() => { G.moodCtx = { type: 'scold', who: p }; UI.pulseMoods(); });
  }, 1200);
}
function getDown() { if (marina.state !== 'perch' && marina.offY === 0) return; Audio2.whoosh(false); const y0 = marina.offY; let t = 0; G.busy = true; const iv = setInterval(() => { t += 0.05; marina.offY = y0 * (1 - Math.min(1, t / 0.3)); if (t >= 0.3) { clearInterval(iv); marina.offY = 0; marina.state = 'idle'; G.busy = false; } }, 50); }
function doFlip() {
  UI.closeActions(); G.busy = true;
  const y0 = marina.offY; say('m_flip'); marina.state = 'flip'; marina.flipT = 0; Audio2.whoosh(true);
  const dx = marina.dir * (y0 < 0 ? 26 : 10), x0 = marina.x; let t = 0;
  const fortHere = G.fort && G.fort.room === G.room && !G.fort.collapsed && Math.abs(G.fort.x - (x0 + dx)) < 50;
  const iv = setInterval(() => {
    t += 0.04; const k = Math.min(1, t / 0.85);
    marina.x = x0 + dx * k; marina.offY = y0 * (1 - k) - Math.sin(k * Math.PI) * 26;
    if (k >= 1) { clearInterval(iv); marina.offY = 0; marina.state = 'idle'; G.busy = false; emit('star', marina.x, marina.y - 20, 6); Audio2.jingle([0, 4, 7, 12], 0.06);
      if (fortHere) collapseFort('jump'); else if (rory.here && chance(0.6)) setTimeout(() => say(pick(['r_wow', 'r_giggle']), rory), 200); else setTimeout(() => say(pick(['m_did_it', 'm_yay'])), 200); }
  }, 40);
}
function flyingSquirrel() {
  const catcher = daddy.here ? daddy : rory; UI.closeActions(); G.busy = true;
  const land = clamp(marina.x + marina.dir * 60, 30, ROOMS[G.room].w - 30);
  say('m_squirrel'); catcher.state = 'idle';
  catcher.walkTo(land, () => { catcher.dir = Math.sign(marina.x - catcher.x) || 1; }, 110);
  setTimeout(() => {
    const y0 = marina.offY, x0 = marina.x; let t = 0; Audio2.whoosh(true); marina.state = 'idle'; marina.rot = 0;
    const iv = setInterval(() => {
      t += 0.04; const k = Math.min(1, t / 0.9);
      marina.x = x0 + (land - x0) * k; marina.offY = y0 + (-46 - y0) * k - Math.sin(k * Math.PI) * 30; marina.rot = Math.sin(k * Math.PI) * 0.5 * marina.dir;
      emit('sparkle', marina.x, marina.y + marina.offY - 40);
      if (k >= 1) { clearInterval(iv); marina.rot = 0; say(catcher === daddy ? 'd_catch' : 'r_catch', catcher); emit('heart', land, marina.y - 90, 6);
        setTimeout(() => { marina.offY = 0; marina.state = 'idle'; G.busy = false; say('m_giggle'); }, 1200); }
    }, 40);
  }, 900);
}
function mount(e) {
  if (e.busy) return;
  approach(e.x, () => {
    marina.state = 'ride'; marina.mount = e; e.state = 'horse'; e.speed0 = e.speed; e.speed = 80; Audio2.whoosh(true);
    say('m_giddyup').then(() => say(e === daddy ? 'd_horse' : 'r_horse', e));
    AI.hold(e, true);
  }, 10);
}
function dismount() { const e = marina.mount; if (!e) return; e.state = 'idle'; e.speed = e.speed0 || 52; e.stop(); AI.hold(e, false); marina.mount = null; marina.state = 'idle'; marina.x = e.x + 16 * e.dir; Audio2.whoosh(false); }

// ---------------------------------------------------------------- moods
function setMood(m) {
  if (G.busy && marina.state !== 'tantrum') return;
  UI.unpulseMoods(); UI.closeActions();
  G.mood = m; UI.markMood(m);
  const ctx = G.moodCtx; G.moodCtx = null;
  if (marina.state === 'perch' && m !== 'tantrum') {}
  // context first
  if (ctx && ctx.type === 'refused' && (m === 'angry' || m === 'tantrum' || m === 'sad')) {
    const e = ctx.who;
    if (m === 'sad') { marina.state = 'sad'; say('m_eat_sad').then(() => forceEat(e)); return; }
    if (m === 'angry') { stomp(); say('m_eat_angry').then(() => forceEat(e)); return; }
    tantrum(false).then(() => forceEat(e)); return;
  }
  if (ctx && ctx.type === 'tvOff' && (m === 'angry' || m === 'tantrum')) { if (m === 'angry') { stomp(); say('m_notbrainrot'); return; } }
  if (ctx && ctx.type === 'tidy') {}
  switch (m) {
    case 'love': {
      marina.state = 'cheer'; emit('heart', marina.x, marina.y - 70, 8);
      const e = nearestFamily();
      if (e) { approach(e.x, () => cuddle(e), 20); }
      else if (niko.here) { say('m_pet_niko'); }
      else if (miles.here) say('m_wuv_miles'); else say('m_happy');
      setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1500); break; }
    case 'happy': {
      marina.state = 'cheer'; emit('star', marina.x, marina.y - 70, 6); say(pick(['m_yay', 'm_happy', 'm_giggle']));
      const e = nearestFamily(); if (e) setTimeout(() => emit('heart', e.x, e.y - 80, 3), 600);
      setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 2000); break; }
    case 'sad': {
      marina.state = 'sad'; say(pick(['m_sad', 'm_cry']));
      const e = nearestFamily();
      if (e) { setTimeout(() => { AI.hold(e, true); e.walkTo(marina.x + (e.x < marina.x ? -22 : 22), () => { e.dir = Math.sign(marina.x - e.x) || 1;
        say(e === daddy ? pick(['d_comfort', 'd_comfort2']) : e === mommy ? 'mo_comfort' : pick(['r_comfort', 'r_comfort2']), e).then(() => { emit('heart', marina.x, marina.y - 70, 8); marina.state = 'idle'; say('m_cuddle'); AI.hold(e, false); }); }, 80); }, 900); }
      else setTimeout(() => marina.state === 'sad' && (marina.state = 'idle'), 4000);
      break; }
    case 'angry': {
      stomp(); say(ctx && ctx.type === 'tvOff' ? 'm_notbrainrot' : pick(['m_angry', 'm_notfair']));
      const e = nearestFamily();
      if (e) setTimeout(() => { e.dir = Math.sign(marina.x - e.x) || 1; say(e === daddy ? pick(['d_hey', 'd_appropriate']) : e === mommy ? pick(['mo_hey', 'mo_appropriate']) : 'r_tantrum', e); }, 1500);
      break; }
    case 'tantrum': tantrum(true); break;
  }
}
function stomp() { marina.state = 'stomp'; for (let i = 0; i < 4; i++) setTimeout(() => { emit('anger', marina.x, marina.y - 70); emit('dust', marina.x, marina.y, 3); Audio2.noise(0.08, 0.3, 200); }, i * 250); setTimeout(() => marina.state === 'stomp' && (marina.state = 'idle'), 1400); }
function tantrum(withParent) {
  return new Promise(res => {
    if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair(); if (marina.state === 'perch') { marina.offY = 0; }
    G.busy = true; marina.state = 'tantrum'; marina.stop(); setMusic();
    const lines = ['m_notfair', 'm_dontlike', 'm_cry', 'm_notfair', 'm_no'];
    let i = 0; const next = () => { if (marina.state !== 'tantrum') return; say(lines[i++ % lines.length]); };
    next(); const iv = setInterval(next, 1900);
    const fountain = setInterval(() => emit('tear', marina.x + rnd(-10, 10), marina.y - 20, 6, { vy: rnd(-160, -90) }), 120);
    const ps = family().filter(e => e.state !== 'lie');
    let bedtime = false;
    if (withParent && ps.length) setTimeout(() => {
      const e = pick(ps); e.dir = Math.sign(marina.x - e.x) || 1;
      const k = e === daddy ? pick(['d_hey', 'd_appropriate', 'd_bedtime']) : e === mommy ? pick(['mo_hey', 'mo_appropriate', 'mo_bedtime']) : 'r_tantrum';
      if (k.endsWith('bedtime')) bedtime = true;
      say(k, e);
    }, 2600);
    setTimeout(() => {
      clearInterval(iv); clearInterval(fountain); marina.state = 'idle'; G.busy = false; setMusic();
      if (bedtime) setTimeout(bedtimeNight, 1200);
      res();
    }, 5400);
  });
}
async function bedtimeNight() {
  G.busy = true; UI.closeActions();
  for (let i = 0; i <= 20; i++) { G.night = i / 20; await sleep(60); }
  setMusic(); UI.bigIcon('🌙', 2600); say('m_tired'); for (let i = 0; i < 25; i++) emit('star', E.camX + rnd(0, E.viewW), rnd(10, 80), 1, { g: 0, vx: 0, vy: 0, life: 3 });
  await sleep(2600);
  // morning: tidy house, fort gone
  G.mess = []; G.fort = null; G.poop = false; G.tv = null;
  changeRoom('living', null, 300); UI.bigIcon('☀️', 1500);
  for (let i = 20; i >= 0; i--) { G.night = i / 20; await sleep(50); }
  G.night = 0; G.busy = false; setMusic(); say('m_yay');
}

// ---------------------------------------------------------------- cooking / serving
function finishDish(dish) {
  G.holding = { type: 'dish', dish };
  addMess('kitchen', 3, ['🥄', '🥚', '🧂', '🍝', '🥫']);
}
function serve(e) {
  const d = G.holding.dish; G.busy = true; AI.hold(e, true); e.dir = Math.sign(marina.x - e.x) || 1; e.state = 'idle'; e.stop();
  const isD = e === daddy, P2 = isD ? 'd_' : 'r_';
  (d.say ? Audio2.chain(d.say) : Promise.resolve()).then(() => say(pick(['m_hewe', 'm_made']))).then(async () => {
    G.holding = null; e.plate = d;
    if (d.score >= 3) { e.state = 'eat'; Audio2.jingle([0, 4, 7, 12, 16], 0.07); await sleep(900); await say(isD ? pick(['d_food_great', 'd_food_good']) : 'r_food_great', e); emit('heart', e.x, e.y - 90, 8); emit('star', e.x, e.y - 90, 6); say('m_yay'); marina.state = 'cheer'; }
    else if (d.score >= 1) { e.state = 'eat'; await sleep(700); await say(isD ? 'd_food_good' : 'r_food_good', e); emit('heart', e.x, e.y - 90, 4); say('m_yummy'); }
    else if (d.score >= 0) { e.state = 'eat'; e.face = '😬'; await sleep(700); await say(isD ? 'd_food_meh' : 'r_food_meh', e); e.face = null; say('m_did_it'); }
    else { e.face = '😅'; await say(isD ? 'd_nervous' : 'r_nervous', e); e.face = null; G.pendingDish = { who: e, dish: d }; G.moodCtx = { type: 'refused', who: e }; UI.pulseMoods(); }
    e.state = e.state === 'eat' ? 'idle' : e.state; G.busy = false; AI.hold(e, false);
    setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1500);
  });
}
function serveMommy() { const d = G.holding.dish; G.holding = null; say('m_hewe').then(() => say(d.score >= 0 ? 'mo_good' : 'mo_hey', mommy)).then(() => { if (d.score >= 0) emit('heart', mommy.x, mommy.y - 80, 5); }); }
function pressureEat(e) { G.moodCtx = { type: 'refused', who: e }; say('m_eat_it').then(() => UI.pulseMoods()); }
async function forceEat(e) {
  const pd = G.pendingDish; if (!pd) return; G.pendingDish = null; G.busy = true; AI.hold(e, true);
  const isD = e === daddy; e.dir = Math.sign(marina.x - e.x) || 1;
  await say(isD ? 'd_ok_ok' : 'r_ok', e);
  e.state = 'eat'; e.face = '😖'; await sleep(1200); e.face = null; e.state = 'idle';
  await grossOutcome(e, -pd.dish.score);
  G.busy = false; AI.hold(e, false);
}
async function grossOutcome(e, sev) {
  const isD = e === daddy, P2 = isD ? 'd_' : 'r_';
  e.face = '🤢';
  if (sev <= 1) { await say(isD ? 'd_burp' : 'r_burp', e); Audio2.sfx(pick(['burp1', 'burp2'])); emit('stink', e.x + e.dir * 8, e.y - 70, 4); say('m_giggle'); e.face = null; return; }
  Audio2.sfx('rumble'); e.state = 'sick'; await sleep(600);
  await say(isD ? 'd_stomach' : 'r_stomach', e);
  if (sev === 2) { Audio2.sfx(pick(['burp1', 'burp2'])); await sleep(500); Audio2.fart(); emit('fart', e.x - e.dir * 10, e.y - 30, 8, { dir: -e.dir }); e.state = 'idle'; e.face = null; say('m_giggle'); return; }
  if (sev === 3) {
    // projectile vomit
    e.state = 'vomit'; Audio2.sfx('vomit'); say(isD ? 'd_vomit' : 'r_vomit', e);
    for (let i = 0; i < 26; i++) { emit('vomit', e.x + e.dir * 14, e.y - 66, 3, { dir: e.dir }); await sleep(45); }
    G.mess.push({ room: e.room, x: clamp(e.x + e.dir * 46, 20, ROOMS[e.room].w - 20), y: FLOOR + 6, type: 'vomit' });
    e.state = 'idle'; e.face = '😵'; await sleep(600); say('m_stinky'); e.face = null; return;
  }
  // sev >= 4: farts + diarrhea dash to the toilet
  for (let i = 0; i < 3; i++) { Audio2.fart(); emit('fart', e.x - e.dir * 12, e.y - 30, 10, { dir: -e.dir }); e.state = 'sick'; await sleep(450); }
  say('m_giggle'); await say(isD ? 'd_diarrhea' : 'r_diarrhea', e);
  await runToToilet(e);
}
async function runToToilet(e) {
  e.state = 'idle'; e.face = '😱';
  const go = () => new Promise(r => {
    if (e.room === 'foyer') return e.walkTo(140, r, 140);
    const dirRight = ROOM_ORDER.indexOf(e.room) < ROOM_ORDER.indexOf('foyer');
    e.walkTo(dirRight ? ROOMS[e.room].w - 4 : 4, () => { const nxt = dirRight ? ROOMS[e.room].right : ROOMS[e.room].left; e.room = nxt || 'foyer'; e.x = dirRight ? 6 : ROOMS[e.room].w - 6; go().then(r); }, 140);
    if (!e.here) { e.room = 'foyer'; e.x = 140; e.stop(); r(); }
  });
  await go(); Audio2.sfx('door_lock'); e.face = null;
  e.state = 'toilet'; e.room = 'bathroom'; e.hidden = true; G.bathLocked = true; G.bathWho = e; setMusic();
  for (let i = 0; i < 3; i++) { await sleep(900); Audio2.fart(); }
  if (chance(0.6)) {
    await sleep(1200); G.tpEmpty = true; G.needTP = true;
    // he yells from behind the door — show bubble near door if marina is in foyer
    const ghost = { x: 140, y: BACK + 26, room: 'foyer', get here() { return G.room === 'foyer'; } };
    UI.bubble(ghost, '🧻❌', 2500); Audio2.voice(e === daddy ? 'd_notp' : 'r_notp', 'ghost');
    UI.bigIcon('🧻', 1400);
  } else { await sleep(5000); Audio2.sfx('flush'); await sleep(1500); unlockBath(); }
}
function unlockBath() {
  const e = G.bathWho; G.bathLocked = false; G.bathWho = null; G.needTP = false;
  if (e) { e.hidden = false; e.room = 'foyer'; e.x = 150; e.state = 'idle'; e.face = '😌'; Audio2.sfx('door_lock'); setTimeout(() => e.face = null, 2500); }
  setMusic();
}
function takeTP() { G.holding = { type: 'tp' }; Audio2.jingle([0, 7, 12]); if (!G.needTP) say('m_okay'); }
function useDoor(p) {
  if (p.to === 'bathroom' && G.bathLocked) {
    if (G.holding && G.holding.type === 'tp') {
      G.holding = null; say('m_tp'); Audio2.sfx('knock');
      setTimeout(() => { const e = G.bathWho; const ghost = { x: p.x, y: BACK + 26, room: G.room, get here() { return G.room === this.room; } };
        UI.bubble(ghost, '🧻🙏', 2500); Audio2.voice(e === daddy ? 'd_tp_thanks' : 'r_tp_thanks', 'ghost');
        G.tpEmpty = false; setTimeout(() => { Audio2.sfx('flush'); setTimeout(unlockBath, 1500); }, 3500); emit('heart', p.x, BACK - 70, 4); }, 1200);
      return;
    }
    Audio2.sfx('knock'); emit('stink', p.x, BACK - 40, 6); say(G.needTP ? 'm_uhoh' : 'm_stinky');
    if (G.needTP) setTimeout(() => UI.bigIcon('🧻', 1200), 600);
    return;
  }
  if (p.to === 'bathroom' && marina.state === 'wheel') {}
  G.doorAnim = { id: p.id, room: G.room, t0: E.t }; Audio2.sfx('door_open'); G.busy = true;
  setTimeout(() => { G.busy = false; G.doorAnim = null; changeRoom(p.to, null, p.tx); }, 420);
}
function clearStink() { P.forEach(p => { if (p.type === 'stink' || p.type === 'fart') p.age = p.life; }); }
function flushToilet() { Audio2.sfx('flush'); say('m_flush'); for (let i = 0; i < 20; i++) setTimeout(() => emit('water', 128 + rnd(-6, 6), BACK - 30, 1, { vy: rnd(-60, -20) }), i * 50); }

// ---------------------------------------------------------------- niko
function petNiko() { UI.face('niko', 'happy', 1800); niko.stop(); niko.dir = Math.sign(marina.x - niko.x) || 1; Audio2.sfx('purr'); emit('heart', niko.x, (niko.perchY || niko.y) - 30, 5); say('m_pet_niko'); niko.t = Math.max(niko.t, 6); }
function feedNiko() {
  say('m_food_niko'); Audio2.jingle([7, 5, 7, 12]);
  if (niko.state === 'held') return;
  niko.room = 'kitchen'; if (G.room !== 'kitchen') return;
  if (!niko.here || niko.x < 0) niko.x = 380;
  niko.state = 'wander'; niko.perchY = null; Audio2.sfx('meow1');
  niko.walkTo(310, () => { niko.state = 'eat'; niko.dir = -1; niko.t = 8; UI.face('niko', 'happy', 1500); }, 70);
}
function pickupNiko() {
  if (niko.state === 'sleep' && niko.perchY && niko.perchY < 120) { say('m_hmm'); return; }
  niko.stop(); niko.state = 'held'; niko.perchY = null; G.holding = { type: 'niko', struggle: false }; say('m_pickup'); Audio2.sfx('meow1');
  setTimeout(() => { if (G.holding && G.holding.type === 'niko') { G.holding.struggle = true; Audio2.sfx('meow1', { rate: 1.3 }); UI.face('niko', 'surprised', 1400, { shake: true }); } }, 2200);
  setTimeout(() => {
    if (!(G.holding && G.holding.type === 'niko')) return;
    G.holding = null; niko.state = 'wander'; niko.room = G.room; niko.x = marina.x; niko.walkTo(marina.x + marina.dir * 90, null, 110); Audio2.sfx('meow2');
    const p = parentsHere()[0] || (rory.here ? rory : null); if (p) setTimeout(() => say(p === daddy ? 'd_cat' : p === mommy ? 'mo_cat' : 'r_cat', p).then(() => { G.moodCtx = { type: 'scold', who: p }; UI.pulseMoods(); }), 300);
  }, 3600);
}
function chaseNiko() {
  say('m_chase_niko'); niko.perchY = null; niko.state = 'flee'; Audio2.sfx('meow2');
  const W = ROOMS[G.room].w; const away = niko.x > marina.x ? W - 10 : 10;
  niko.walkTo(away, () => { niko.state = 'wander'; niko.t = 4; }, 120);
  marina.walkTo(away - Math.sign(away - marina.x) * 30, null, 100);
}
function wrapPoop() { G.poop = false; G.holding = { type: 'poop', ico: '💩' }; say('m_stinky'); clearStink(); }
function binPoop() { G.holding = null; Audio2.sfx('poop'); emit('sparkle', marina.x, marina.y - 40, 8); say('m_did_it'); }
function flushPoop() { G.holding = null; flushToilet(); setTimeout(() => say('m_bye'), 1200); }

// ---------------------------------------------------------------- miles
function soothe(kind) {
  const p = miles.spot === 'crib' ? BACK - 10 : 156;
  say(kind === 'bottle' ? 'm_bottle' : kind === 'cuddle' ? 'm_shh_miles' : 'm_wuv_miles');
  setTimeout(() => {
    miles.crying = false; miles.happyT = 4; miles.cryT = rnd(40, 80); Audio2.sfx('baby_coo'); UI.face('miles', 'happy', 2200); emit('heart', miles.x, p - 30, 8);
    if (mommy.here) setTimeout(() => say('mo_miles', mommy), 1500);
  }, 1200);
}

// ---------------------------------------------------------------- mess & tidy
const TOYS = ['🧸', '🪀', '🧩', '🚗', '🎲', '🪁', '🦖', '🧦', '👟', '📚', '🖍️', '🎈'];
function addMess(room, n, set = TOYS) { for (let i = 0; i < n; i++) G.mess.push({ room, x: rnd(30, ROOMS[room].w - 30), y: FLOOR + rnd(2, 12), ico: pick(set), rot: rnd(-0.6, 0.6) }); }
function makeMess(p) {
  Audio2.noise(0.4, 0.3, 500); say(pick(['m_giggle', 'm_wow']));
  for (let i = 0; i < 5; i++) { const m = { room: G.room, x: p.x, y: FLOOR + rnd(2, 12), ico: pick(TOYS), rot: rnd(-0.6, 0.6) }; G.mess.push(m); const tx = clamp(p.x + rnd(-80, 80), 20, ROOMS[G.room].w - 20); let t = 0; const iv = setInterval(() => { t += 0.05; m.x += (tx - m.x) * 0.2; if (t > 0.6) clearInterval(iv); }, 30); }
}
function checkMess() {
  if (G.tidy || G.chase || G.busy || G.fort && G.fort.inside) return;
  const n = G.mess.filter(m => m.room === G.room).length, total = G.mess.length;
  if ((n >= 5 || total >= 12) && E.t - G.lastTidyAsk > 40) {
    const ps = parentsHere(); if (rory.here && rory.state !== 'toilet') ps.push(rory); if (!ps.length) return;
    G.lastTidyAsk = E.t; const p = pick(ps); p.dir = Math.sign(marina.x - p.x) || 1;
    say(p === daddy ? 'd_tidy' : p === mommy ? 'mo_tidy' : 'r_tidy', p).then(() => UI.actions(marina, [A('🧹', () => startTidy()), A('🏃', () => startChase(p))]));
  }
}
function startTidy(self) { G.tidy = true; if (!self) say('m_ok_tidy'); UI.bigIcon('🧹', 900); }
function pickUpMess(m) {
  approach(m.x, () => {
    const i = G.mess.indexOf(m); if (i < 0) return; G.mess.splice(i, 1);
    emit('sparkle', m.x, m.y - 6, 8); Audio2.blip(pick([0, 4, 7, 12]), 'square', 0.08);
    if (m.type === 'vomit') emit('stink', m.x, m.y - 6, 3);
    if (!G.mess.some(x => x.room === G.room)) {
      G.tidy = G.mess.length > 0 && G.tidy; G.tidy = false;
      Audio2.jingle([0, 4, 7, 12, 7, 12]); emit('confetti', marina.x, marina.y - 60, 30);
      const p = parentsHere()[0] || (rory.here ? rory : null); if (p) say(p === daddy ? 'd_good_girl' : p === mommy ? 'mo_good' : 'r_good', p); else say('m_did_it');
    }
  }, 6);
}
function startChase(p) {
  say('m_noway'); G.chase = { who: p, fleeing: true, t: 0 }; AI.hold(p, true); setMusic();
  setTimeout(() => say(p === daddy ? 'd_chase' : p === mommy ? 'mo_chase' : 'r_chase', p), 1200);
  const W = ROOMS[G.room].w; marina.walkTo(marina.x < W / 2 ? W - 4 : 4, null, 92);
}
function updateChase(dt) {
  const c = G.chase, p = c.who; c.t += dt;
  if (p.room !== G.room) return;
  const sp = 60 + c.t * 4;
  p.walkTo(marina.x, null, Math.min(95, sp));
  if (Math.abs(p.x - marina.x) < 16 && c.t > 2) {
    G.chase = null; marina.stop(); p.stop(); AI.hold(p, false); setMusic();
    say(p === daddy ? 'd_caught' : p === mommy ? 'mo_caught' : 'r_caught', p).then(() => { say('m_giggle'); emit('heart', marina.x, marina.y - 70, 6); setTimeout(() => startTidy(), 1200); });
  }
}

// ---------------------------------------------------------------- fort
function startFort() {
  const x = FORT_SPOTS[G.room]; G.fort = { room: G.room, x, pieces: [], inside: false, guests: [], built: E.t };
  say('m_fort'); UI.fortTray(true); approach(x, null, 30);
}
function addFortPiece(def) {
  const f = G.fort; if (!f || f.pieces.length >= 12) return;
  const pc = { def, x: marina.x, y: marina.y - 40, tx: f.x, ty: FLOOR, rot: 0 };
  f.pieces.push(pc); fortLayout(); Audio2.blip(pick([0, 2, 4, 7, 9]), 'square', 0.1); emit('dust', pc.tx, FLOOR, 4);
  if (def.id === 'cushion') emit('dust', pc.tx, FLOOR, 3);
  if (f.complete && !f.announced) { f.announced = true; Audio2.jingle([0, 4, 7, 12, 16], 0.07); emit('confetti', f.x, f.roofY, 20); }
  addMessHint();
}
function addMessHint() {}
function fortActions() {
  const f = G.fort, a = [];
  if (!f) return a;
  if (!f.inside) { if (f.complete) a.push(A('🏰', enterFort)); a.push(A('🧱', () => UI.fortTray(true))); a.push(A('💥', () => collapseFort('jump'))); return a; }
  const fam = [daddy, mommy, rory].filter(e => !e.hidden && e.state !== 'toilet' && !f.guests.includes(e) && (e !== rory || G.rory));
  a.push(A('👋', () => UI.actions({ x: f.x, y: f.roofY - 6 }, [...fam.map(e => A(e === daddy ? '👨' : e === mommy ? '👩' : '🧔', () => inviteToFort(e))), ...(f.guests.includes(niko) ? [] : [A('🐱', () => inviteToFort(niko))])])));
  a.push(A('🔦', () => { say('m_giggle'); emit('sparkle', f.x, f.roofY + 20, 12); f.guests.forEach(g => emit('heart', g.x, FLOOR - 50, 2)); }));
  a.push(A('🍪', () => { say('m_yummy'); emit('star', f.x, f.roofY + 10, 4); }));
  a.push(A('🤸', () => { emit('dust', f.x, FLOOR, 6); Audio2.noise(0.2, 0.3, 300); say('m_giggle'); f.wobble = (f.wobble || 0) + 1; if (chance(0.25 * f.wobble)) collapseFort('jump'); }));
  a.push(A('🚪', exitFort));
  return a;
}
function enterFort() {
  const f = G.fort; f.inside = true; marina.x = f.x; marina.state = 'fort'; marina.offY = 4; say('m_fort'); setMusic();
  UI.fortTray(false);
  // bedtime eventually
  clearTimeout(f.bedT); f.bedT = setTimeout(() => fortBedtime(), rnd(70, 110) * 1000);
}
function exitFort() { const f = G.fort; if (!f) return; f.inside = false; marina.state = 'idle'; marina.offY = 0; marina.x = f.R + 10; f.guests.forEach(g => { if (g !== niko) { g.state = 'idle'; AI.hold(g, false); } }); f.guests = []; setMusic(); }
function inviteToFort(e) {
  const f = G.fort; if (!f) return; UI.closeActions();
  if (!f.inside) enterFort();
  if (e === niko) {
    say('m_play_niko'); niko.room = G.room; if (!niko.here) niko.x = f.x + 120; niko.perchY = null; niko.state = 'wander';
    niko.walkTo(f.x + 12, () => { niko.state = 'fort'; f.guests.push(niko); Audio2.sfx('meow2'); if (chance(0.55)) setTimeout(() => collapseFort('niko'), 2500); }, 90);
    return;
  }
  const key = e === daddy ? 'm_play_daddy' : e === mommy ? 'm_play_mommy' : 'm_play_rory';
  say(key).then(() => {
    AI.hold(e, true);
    if (e.room !== G.room) { e.room = G.room; e.hidden = false; e.x = G.room === 'living' ? 8 : ROOMS[G.room].w - 8; }
    const keen = e === daddy ? !AI.daddyTired && chance(0.6) : e === rory ? true : chance(0.75);
    e.walkTo(f.x + (f.guests.length % 2 ? -18 : 18) + rnd(-4, 4), () => {
      f.guests.push(e); e.dir = Math.sign(f.x - e.x) || 1;
      if (keen) { e.state = 'sitfort'; say(e === daddy ? pick(['d_play_yes', 'd_play_yes2']) : e === mommy ? 'mo_play_yes' : pick(['r_play_yes', 'r_play_yes2']), e).then(() => { emit('heart', f.x, f.roofY, 6); say('m_yay'); }); }
      else { say(e === daddy ? pick(['d_play_tired', 'd_play_tired2']) : e === mommy ? 'mo_play_tired' : 'r_play_yes', e).then(() => { if (e !== mommy) e.state = 'lie'; else e.state = 'sitfort'; }); }
    }, 60);
  });
}
function fortBedtime() {
  const f = G.fort; if (!f || f.collapsed) return;
  const p = [daddy, mommy].find(e => !e.hidden && e.state !== 'toilet'); if (!p) return;
  if (G.room !== f.room) { G.fort = null; return; }
  AI.hold(p, true); if (p.room !== G.room) { p.room = G.room; p.x = 10; }
  p.walkTo(f.x + 40, () => { say(p === daddy ? 'd_fort_down' : 'mo_fort_down', p).then(() => { collapseFort('bedtime'); AI.hold(p, false); }); });
}
function collapseFort(why) {
  const f = G.fort; if (!f || f.collapsed) return; UI.fortTray(false); UI.closeActions();
  f.collapsed = true; f.collapseT = 2.2; clearTimeout(f.bedT);
  if (why === 'niko') { Audio2.sfx('meow1', { rate: 1.4 }); UI.face('niko', 'surprised', 1500); niko.state = 'flee'; niko.walkTo(f.x + 140, () => { niko.state = 'wander'; }, 130); }
  for (const p of f.pieces) { p.fall = true; p.vx = rnd(-90, 90); p.vy = rnd(-180, -60); p.vr = rnd(-8, 8); }
  Audio2.sfx('thud'); emit('dust', f.x, FLOOR - 10, 30);
  f.guests.forEach(g => { if (g !== niko) { g.state = 'idle'; AI.hold(g, false); } });
  marina.state = 'idle'; marina.offY = 0; f.inside = false;
  setTimeout(() => { say('m_fort_fall').then(() => { G.moodCtx = { type: 'fortFell' }; UI.pulseMoods(); }); setMusic(); }, 600);
}

// ---------------------------------------------------------------- tv
function tvOn(ch) {
  G.tv = ch; setMusic(); say('m_tv');
  clearInterval(G.tvIv); G.tvIv = setInterval(() => { if (!G.tv) return; if (G.room === 'living') Audio2.voice(G.tv === 'fish' ? pick(['tv_bro', 'tv_bruh', 'tv_dude']) : pick(['tv_cartoon', 'tv_cartoon2']), 'tv'); }, 3800);
  Audio2.voice(ch === 'fish' ? 'tv_bro' : 'tv_cartoon', 'tv');
  marina.walkTo(300, () => { marina.state = 'sit'; marina.dir = -1; });
  clearTimeout(G.tvT); G.tvT = setTimeout(tvInterrupt, rnd(9, 15) * 1000);
}
function tvOff() { G.tv = null; clearInterval(G.tvIv); clearTimeout(G.tvT); setMusic(); Audio2.blip(-12, 'square', 0.15); }
function tvInterrupt() {
  if (!G.tv) return;
  const p = !daddy.hidden && daddy.state !== 'toilet' ? daddy : !mommy.hidden ? mommy : null; if (!p) return;
  AI.hold(p, true);
  if (p.room !== 'living') { p.room = 'living'; p.x = 10; }
  if (G.room !== 'living') { tvOff(); AI.hold(p, false); return; }
  p.walkTo(215, () => {
    p.dir = 1;
    const k = p === daddy ? pick(['d_tv', 'd_brainrot']) : 'mo_tv';
    say(k, p).then(() => { if (rory.here && chance(0.5)) say('r_tv', rory); tvOff(); if (marina.state === 'sit') marina.state = 'idle'; G.moodCtx = { type: 'tvOff', who: p }; UI.pulseMoods(); AI.hold(p, false); });
  });
}

// ---------------------------------------------------------------- wheelchair ride
function rideWheelchair() { approach(mommy.x + 36, () => { marina.state = 'wheel'; marina.x = mommy.x + 36; say('m_ride'); Audio2.whoosh(true); setTimeout(() => say('mo_careful', mommy), 1800); G.wheelT = setTimeout(() => { if (marina.state === 'wheel') { say('mo_careful', mommy); } }, 15000); }, 0); }
function leaveWheelchair() { marina.state = 'idle'; clearTimeout(G.wheelT); Audio2.whoosh(false); }

// ---------------------------------------------------------------- yard
function yardToy(kind, p) {
  UI.closeActions();
  if (kind === 'saucer' || kind === 'belt') { approach(kind === 'saucer' ? 445 : 522, () => { marina.state = 'swing'; marina.swingKind = kind; marina.x = kind === 'saucer' ? 445 : 522; say('m_swing'); Audio2.whoosh(true); }, 0); return; }
  if (kind === 'bars') {
    approach(448, () => { marina.state = 'bars'; marina.x = 448; marina.offY = -88; say('m_monkey'); let dir = 1; clearInterval(G.barIv);
      G.barIv = setInterval(() => { if (marina.state !== 'bars') return clearInterval(G.barIv); marina.x += dir * 0.8; marina.dir = dir; if (marina.x > 492 || marina.x < 446) dir *= -1; if (chance(0.03)) Audio2.blip(pick([0, 4, 7]), 'square', 0.06); }, 30); }, 0); return;
  }
  if (kind === 'climb') { approach(470, () => { G.busy = true; let t = 0; say('m_monkey'); const iv = setInterval(() => { t += 0.05; marina.offY = -Math.min(1, t / 1.4) * 70; marina.x = 470 + Math.sin(t * 12) * 1.5; if (t >= 1.4) { clearInterval(iv); marina.state = 'perch'; G.busy = false; say('m_did_it'); } }, 50); }, 0); }
}
function leaveYardToy() { if (marina.state === 'bars') return dropFromBars(); clearInterval(G.barIv); marina.state = 'idle'; marina.offY = 0; Audio2.whoosh(false); }
// ---- monkey bars: climb the left ladder, swing hand over hand, drop off
function monkeyBars(p) {
  const sc = p.scale || 1, b = visBox(p.k), L = p.x + b[0] * sc + 8, R = p.x + b[2] * sc - 8, railY = p.y + b[1] * sc + 4;
  const start = marina.x > p.x ? R : L;
  approach(start, () => {
    G.busy = true; say('m_monkey'); let t = 0; const feetTop = railY + (visBox('marina_hang')[3] - visBox('marina_hang')[1]) * marina.scale;
    const iv = setInterval(() => { t += 0.05; marina.offY = -(FLOOR - feetTop) * Math.min(1, t / 1.0); marina.x = start + Math.sin(t * 14) * 1.2; if (chance(0.15)) Audio2.blip(pick([0, 2, 4]), 'triangle', 0.04, 0.08);
      if (t >= 1.0) { clearInterval(iv); marina.x = start; marina.offY = 0; marina.state = 'bars'; marina.railY = railY; G.busy = false;
        G.mb = { L, R, dir: start === L ? 1 : -1, go: true }; marina.dir = G.mb.dir; clearInterval(G.barIv); G.barIv = setInterval(barStep, 30); } }, 50);
  }, 0);
}
function barStep() {
  const mb = G.mb; if (!mb || marina.state !== 'bars') { clearInterval(G.barIv); return; }
  marina.barMoving = mb.go;
  if (!mb.go) return;
  marina.dir = mb.dir; marina.x += mb.dir * 0.75;
  if (Math.floor(marina.x / 9) !== Math.floor((marina.x - mb.dir * 0.75) / 9)) { Audio2.blip(pick([0, 4, 7, 9]), 'square', 0.05, 0.1); if (chance(0.3)) emit('sparkle', marina.x, marina.railY, 2); }
  if (marina.x >= mb.R || marina.x <= mb.L) { marina.x = clamp(marina.x, mb.L, mb.R); mb.go = false; marina.barMoving = false; mb.done = (mb.done || 0) + 1;
    setTimeout(() => { if (marina.state === 'bars' && !mb.go) dropFromBars(true); }, 900); }
}
function dropFromBars(finished) {
  if (marina.state !== 'bars') return; clearInterval(G.barIv);
  const feet = marina.railY + (visBox('marina_hang')[3] - visBox('marina_hang')[1]) * marina.scale;
  marina.state = 'perch'; marina.offY = feet - FLOOR; marina.barMoving = false; G.mb = null; getDown();
  setTimeout(() => { emit('dust', marina.x, FLOOR, 6); if (finished) { marina.state = 'cheer'; emit('confetti', marina.x, marina.y - 60, 25); Audio2.jingle([0, 4, 7, 12, 16]); say('m_did_it'); setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1600); } }, 350);
}
function blowLeaves(wx) {
  Audio2.sfx('leafblower', { vol: 0.5 });
  for (let i = 0; i < 16; i++) emit('leaf', marina.x + marina.dir * 14, FLOOR, 1, { vx: Math.sign(260 - marina.x) * rnd(60, 140), vy: rnd(-60, -10) });
  G.pile = Math.min(5, G.pile + 0.35);
}
function jumpLeaves() {
  approach(260, () => {
    G.busy = true; say('m_leaves'); let t = 0; const x0 = marina.x;
    const iv = setInterval(() => { t += 0.04; const k = Math.min(1, t / 0.7); marina.x = x0 + (260 - x0) * k; marina.offY = -Math.sin(k * Math.PI) * 40 + k * 6;
      if (k >= 1) { clearInterval(iv); Audio2.sfx('leaves'); for (let i = 0; i < 60 * (G.pile / 5); i++) emit('leaf', 260 + rnd(-20, 20), FLOOR + 2); G.pile = Math.max(1, G.pile - 1.5); marina.offY = 0; G.busy = false; marina.state = 'cheer'; say('m_giggle'); setTimeout(() => marina.state = 'idle', 1500); }
    }, 40);
  }, 40);
}
function buildSnowman() { G.snowman = Math.min(5, G.snowman + 1); Audio2.sfx('crunch_snow'); emit('snow', 260, FLOOR - 20, 12, { vy: rnd(-60, -20), vx: rnd(-40, 40), g: 150, life: 1 }); if (G.snowman === 1) say('m_snowman'); if (G.snowman === 5) { say('m_did_it'); emit('confetti', 260, FLOOR - 60, 30); } }
function toggleWeather() {
  WEATHER = WEATHER === 'fall' ? 'snow' : 'fall'; document.getElementById('weatherBtn').textContent = WEATHER === 'fall' ? '🍂' : '❄️';
  if (G.holding && G.holding.type === 'blower') G.holding = null; setMusic(); Audio2.jingle(WEATHER === 'snow' ? [12, 16, 19, 24] : [7, 4, 0]);
}

// ---------------------------------------------------------------- AI
const AI = {
  held: new Set(), daddyTired: false, t: 0,
  hold(e, on) { if (on) this.held.add(e); else this.held.delete(e); },
  update(dt) {
    this.t += dt;
    // miles crying cycle
    miles.happyT = Math.max(0, (miles.happyT || 0) - dt);
    miles.cryT -= dt;
    if (!miles.crying && miles.cryT <= 0) { miles.crying = true; miles.cryT = rnd(14, 22); if (miles.here) { Audio2.sfx('baby_cry'); UI.face('miles', 'sad', 2200, { shake: true }); } }
    else if (miles.crying) { if (miles.cryT <= 0) { miles.crying = false; miles.cryT = rnd(40, 80); } else if (miles.here && chance(dt / 3)) Audio2.sfx('baby_cry', { vol: 0.6 }); }
    if (miles.crying && !this.held.has(mommy) && mommy.room === 'living' && mommy.state !== 'sit' && !mommy.moving && chance(dt / 4)) { mommy.walkTo(miles.x + 26, () => { mommy.dir = -1; mommy.holdingMiles = true; miles.crying = false; miles.cryT = rnd(40, 80); setTimeout(() => mommy.holdingMiles = false, 15000); }); }
    for (const e of [daddy, mommy, rory]) this.person(e, dt);
    this.cat(dt);
    // periodic checks
    if (Math.floor(this.t) !== Math.floor(this.t - dt)) { if (Math.floor(this.t) % 4 === 0) checkMess(); if (Math.floor(this.t) % 60 === 0) this.daddyTired = chance(0.5); }
    // Rory visits
    if (!G.rory && this.t > 50 && chance(dt / 90)) { G.rory = true; rory.hidden = false; rory.room = 'foyer'; rory.x = 52; rory.state = 'idle'; if (G.room === 'foyer') onEnterRoom('foyer'); else if (G.room !== 'yard') { UI.bigIcon('🚪🧔', 1200); Audio2.sfx('knock'); } }
    else if (G.rory && !this.held.has(rory) && rory.state === 'idle' && chance(dt / 200)) { if (rory.room !== G.room) { G.rory = false; rory.hidden = true; } }
  },
  person(e, dt) {
    if (e.hidden || this.held.has(e) || e.state === 'toilet' || e.state === 'horse' || e === (G.chase && G.chase.who)) return;
    if (G.fort && G.fort.guests.includes(e)) return;
    e.wait = (e.wait || rnd(6, 12)) - dt;
    if (e.moving || e.wait > 0) return;
    e.wait = rnd(8, 18);
    if (e.state === 'lie' && chance(0.6)) return;
    if (e.state === 'lie') e.state = 'idle';
    if (e === mommy) {
      if (e.state === 'sit') { if (chance(0.4)) { e.state = 'idle'; e.x -= 34; } return; }
      if (e.room === 'living' && chance(0.35) && !(marina.state === 'wheel')) { e.walkTo(SEATS.living.mommy + 30, () => { e.state = 'sit'; e.x = SEATS.living.mommy; e.dir = 1; }); return; }
    }
    if (e === rory && e.here && chance(0.35) && !G.busy && !marina.mount) { e.walkTo(marina.x + (e.x < marina.x ? -24 : 24), () => { e.dir = Math.sign(marina.x - e.x) || 1; say(pick(['r_giggle', 'r_hi2', 'r_chase']), e); emit('star', marina.x, marina.y - 70, 4); }, 70); return; }
    if (e === daddy && e.room === 'living' && chance(0.15)) { e.walkTo(rnd(200, 460), () => { e.state = 'lie'; }); return; }
    const rooms = e === rory ? ['foyer', 'living', 'kitchen', 'dining', 'playroom'] : ['living', 'kitchen', 'dining', 'playroom', 'foyer', 'living', 'kitchen'];
    if (chance(0.45)) { // change room
      const to = pick(rooms.filter(r => r !== e.room));
      const leave = () => { e.room = to; e.x = rnd(40, ROOMS[to].w - 40); e.state = 'idle'; if (e.here) { e.x = Math.abs(e.x - marina.x) < 40 ? clamp(marina.x + 80, 20, ROOMS[to].w - 20) : e.x; } };
      if (e.here) { const iL = ROOM_ORDER.indexOf(to) < ROOM_ORDER.indexOf(e.room); e.walkTo(iL ? 4 : ROOMS[e.room].w - 4, () => { leave(); if (e.here) onEnterRoomBy(e); }); }
      else { leave(); if (e.here) onEnterRoomBy(e); }
    } else e.walkTo(rnd(30, ROOMS[e.room].w - 30), null, null, rnd(152, 176));
  },
  cat(dt) {
    if (niko.state === 'held' || niko.state === 'fort') return;
    niko.t -= dt; if (niko.moving || niko.t > 0) return;
    niko.t = rnd(10, 22);
    if (niko.state === 'litter') { G.poop = true; Audio2.sfx('poop'); if (G.room === 'playroom') { emit('poo', 24, 130); setTimeout(() => say('m_ugh_niko'), 500); const p = parentsHere()[0]; if (p === daddy) setTimeout(() => say('d_niko_poo', daddy), 2600); } niko.state = 'wander'; niko.walkTo(120); return; }
    const r = Math.random();
    const spots = [['dining', 'cattower', 318, BACK - 98], ['living', 'sofa', 60, 128], ['living', 'armchair', 138, 124], ['playroom', 'sofa', 312, 120], ['dining', 'table', 222, 126]];
    if (r < 0.35) { const s = pick(spots); this.catGo(s[0], s[2], () => { niko.state = 'sleep'; niko.perch = s[1]; niko.perchY = s[3]; Audio2.sfx('purr', { vol: 0.4 }); }); }
    else if (r < 0.5 && !G.poop) { this.catGo('playroom', 30, () => { niko.state = 'litter'; niko.t = 5; }); }
    else if (r < 0.65) { this.catGo('kitchen', 310, () => { niko.state = 'eat'; niko.dir = -1; niko.t = 6; }); }
    else { niko.state = 'wander'; niko.perchY = null; if (chance(0.3) && niko.here) Audio2.sfx(pick(['meow1', 'meow2'])); niko.walkTo(rnd(20, ROOMS[niko.room].w - 20), null, null, rnd(154, 176)); }
  },
  catGo(room, x, cb) {
    niko.perchY = null; niko.state = 'wander';
    if (niko.room === room) return niko.walkTo(x, cb);
    if (niko.here) { const iL = ROOM_ORDER.indexOf(room) < ROOM_ORDER.indexOf(niko.room); niko.walkTo(iL ? 2 : ROOMS[niko.room].w - 2, () => { niko.room = room; niko.x = x; cb(); }, 70); }
    else { niko.room = room; niko.x = x; if (niko.here) { niko.x = iLx(room); niko.walkTo(x, cb); } else cb(); }
  },
};
function iLx(room) { return marina.x < ROOMS[room].w / 2 ? ROOMS[room].w - 6 : 6; }
function onEnterRoomBy(e) { if (G.busy) return; if (G.lastGreet[e.id] && E.t - G.lastGreet[e.id] < 30) return; G.lastGreet[e.id] = E.t; const k = e === daddy ? pick(['d_hi1', 'd_hi2', 'd_hi3']) : e === mommy ? pick(['mo_hi1', 'mo_hi2']) : pick(['r_hi', 'r_hi2', 'r_hi3']); setTimeout(() => say(k, e).then(() => { G.moodCtx = { type: 'greet', who: e }; UI.pulseMoods(); }), 400); }

// ---------------------------------------------------------------- boot
async function boot() {
  E.cv = document.getElementById('cv'); E.ctx = E.cv.getContext('2d');
  const lb = document.querySelector('#loadbar i');
  loadBackgrounds(); await loadAtlas(); lb.style.width = '40%'; await loadFaces(); lb.style.width = '70%';
  resize(); window.addEventListener('resize', () => { resize(); }); window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  makeEnts(); UI.init(); drawTitle(); lb.style.width = '100%';
  requestAnimationFrame(loop);
}
function drawTitle() {
  const c = document.getElementById('titleCv'), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const put = (k, px, py, s = 1, fl = false) => { const sc = spriteCanvas(k); if (!sc) return; x.save(); x.translate(px, py); x.scale(fl ? -s : s, s); x.drawImage(sc, -sc.width / 2, -sc.height); x.restore(); };
  put('dish_cake', 80, 92, 0.9); put('marina', 52, 92, 1.1); put('niko', 120, 94, 0.7, true); put('dish_pancakes', 22, 92, 0.6); put('dish_slime', 142, 70, 0.5);
}
async function startGame() {
  Audio2.init();
  document.getElementById('title').classList.add('hidden');
  resize(); setMusic();
  // warm the most common clips
  Audio2.preload(['m_hi_daddy', 'd_hi2', 'm_yay', 'm_hewe', 'm_made', 'd_nervous', 'm_notfair'].map(k => 'assets/vo/' + k + '.mp3'));
  setTimeout(() => { say('m_hi_daddy'); setTimeout(() => onEnterRoom('living'), 1800); }, 500);
}
window.addEventListener('load', boot);
