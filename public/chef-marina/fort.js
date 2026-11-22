// Chef Marina — fort builder (drag pieces together) + magical fort interior (arrange toys, invite family)

const FORT_FALLBACK_PIECES = ['chair_wood', 'cardboard_box', 'laundry_basket', 'foam_mat', 'cushion', 'blanket', 'blanket2', 'fairy_lights', 'purple_mat', 'storage_bin'];
const TOY_FALLBACK = ['🧸', '🦄', '🦖', '🪀', '🧩', '📚', '🫖', '🔦', '🖍️', '🍿', '🎈', '🚀', '🏰', '⚽'];
const FORT_THEMES = ['cozy', 'space', 'castle'];
function fortPieceKeys() { const k = Object.keys(E.A).filter(k => /^fort_[a-z]+$/.test(k)); return k.concat(FORT_FALLBACK_PIECES.filter(has)); }
function toyKeys() { return Object.keys(E.A).filter(k => /^toy_[a-z]+$/.test(k)); }

// ------------------------------------------------------------------ builder screen
function openFortBuilder(existing) {
  UI.closeActions(); say(existing ? 'm_fort' : 'm_fort_build');
  const pieces = existing ? existing.pieces.map(p => ({ ...p })) : [];
  let sel = null, drag = null;
  const p = document.getElementById('panel'); p.innerHTML = ''; p.classList.remove('hidden'); Audio2.Music.set('fort');
  const top = el2('div', 'ptop');
  const close = btn('❌', () => { p.classList.add('hidden'); setMusic(); });
  const undo = btn('↩️', () => { pieces.pop(); sel = null; Audio2.blip(-5); draw(); });
  const clear = btn('🗑️', () => { pieces.length = 0; sel = null; Audio2.whoosh(false); draw(); });
  const done = btn('✅', () => { if (!pieces.length) return; placeFort(pieces, existing); p.classList.add('hidden'); }, 'pbtn go');
  top.append(close, undo, clear, el2('div', 'ttl', '🏰'), done);
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 140; cv.className = 'fortcv';
  const ctlRow = el2('div', 'row fortctl');
  const tray = el2('div', 'tray scrollx');
  for (const k of fortPieceKeys()) { const b = btn('', () => { pieces.push({ key: k, x: 120 + rnd(-30, 30), y: 128, s: 1, flip: false }); sel = pieces.length - 1; Audio2.blip(pick([0, 4, 7, 9])); draw(); }, 'tile'); b.append(sprImg(k)); tray.append(b); }
  const mk = (ico, fn) => ctlRow.append(btn(ico, () => { if (sel == null) return; fn(pieces[sel]); Audio2.blip(9); draw(); }));
  mk('🔄', q => q.flip = !q.flip); mk('➕', q => q.s = Math.min(2, q.s + 0.2)); mk('➖', q => q.s = Math.max(0.5, q.s - 0.2));
  mk('⬆️', q => { pieces.splice(sel, 1); pieces.push(q); sel = pieces.length - 1; }); mk('❌', () => { pieces.splice(sel, 1); sel = null; });
  p.append(top, cv, ctlRow, tray);
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, '#ffe3f1'); g.addColorStop(1, '#e8dcff'); x.fillStyle = g; x.fillRect(0, 0, 240, 140);
    x.fillStyle = '#c9a27a'; x.fillRect(0, 128, 240, 12); x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 240; i += 12) x.fillRect(i, 128, 1, 12);
    pieces.forEach((q, i) => { const c = spriteCanvas(q.key); if (!c) return; x.save(); x.translate(q.x, q.y); x.scale(q.flip ? -q.s : q.s, q.s); x.drawImage(c, -c.width / 2, -c.height); x.restore();
      if (i === sel) { const b = pieceBox(q); x.strokeStyle = '#ffcf4a'; x.lineWidth = 2; x.setLineDash([4, 3]); x.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); x.setLineDash([]); } });
    ctlRow.style.visibility = sel == null ? 'hidden' : 'visible'; done.disabled = !pieces.length; done.classList.toggle('pulse', pieces.length >= 2);
    if (!pieces.length) { x.font = '28px sans-serif'; x.textAlign = 'center'; x.fillText('⬇️', 120, 80); }
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 240 / r.width, (e.clientY - r.top) * 140 / r.height]; };
  cv.addEventListener('pointerdown', e => { const [mx, my] = pos(e); sel = null;
    for (let i = pieces.length - 1; i >= 0; i--) { const b = pieceBox(pieces[i]); if (mx > b[0] && mx < b[2] && my > b[1] && my < b[3]) { sel = i; drag = [mx - pieces[i].x, my - pieces[i].y]; cv.setPointerCapture(e.pointerId); break; } }
    draw(); });
  cv.addEventListener('pointermove', e => { if (!drag || sel == null) return; const [mx, my] = pos(e); const q = pieces[sel]; q.x = clamp(mx - drag[0], 0, 240); q.y = clamp(my - drag[1], 20, 132); draw(); });
  cv.addEventListener('pointerup', () => { if (drag) Audio2.blip(4, 'triangle', 0.05); drag = null; });
  draw();
}
function pieceBox(q) { const v = visBox(q.key); const s = q.s; const xs = q.flip ? [-v[2], -v[0]] : [v[0], v[2]]; return [q.x + xs[0] * s, q.y + v[1] * s, q.x + xs[1] * s, q.y + v[3] * s]; }
function el2(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
function btn(txt, fn, cls = 'pbtn') { const b = el2('button', cls, txt); b.addEventListener('pointerup', e => { e.stopPropagation(); fn(); }); return b; }
function sprImg(k) { const c = spriteCanvas(k); const i = document.createElement('img'); i.className = 'pix'; if (c) i.src = c.toDataURL(); return i; }

function placeFort(pieces, existing) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of pieces) { const b = pieceBox(q); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  const w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0), c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  for (const q of pieces) { const s = spriteCanvas(q.key); if (!s) continue; x.save(); x.translate(q.x - x0, q.y - y0); x.scale(q.flip ? -q.s : q.s, q.s); x.drawImage(s, -s.width / 2, -s.height); x.restore(); }
  const room = existing ? existing.room : G.room, fx = existing ? existing.x : clamp(FORT_SPOTS[room] || marina.x, w / 2 + 10, ROOMS[room].w - w / 2 - 10);
  const scale = Math.min(1, 150 / w, 100 / h);
  G.fort = { room, x: fx, pieces, ox: x0, oy: y0, bw: w, bh: h, img: c, scale, toys: existing ? existing.toys : [], theme: existing ? existing.theme : pick(FORT_THEMES),
    guests: [], inside: false, complete: true, collapsed: false, built: E.t };
  const f = G.fort; f.L = f.x - w * scale / 2; f.R = f.x + w * scale / 2; f.roofY = FLOOR + 6 - h * scale;
  say('m_fort_done'); Audio2.jingle([0, 4, 7, 12, 16], 0.07); emit('confetti', f.x, f.roofY, 30); setMusic();
  clearTimeout(f.bedT); f.bedT = setTimeout(() => fortBedtime(), rnd(150, 220) * 1000);
}

// ------------------------------------------------------------------ fort in the room
startFort = function () { openFortBuilder(null); };
drawFort = function (front) {
  const f = G.fort; if (!f || f.room !== G.room || front) return;
  if (f.collapsed) { for (const q of f.fall || []) drawSprite(q.key, q.x, q.y, { rot: q.rot, scale: q.s * f.scale }); return; }
  const ctx = E.ctx, w = f.bw * f.scale, h = f.bh * f.scale, wob = f.wob > E.t ? Math.sin(E.t * 40) * 1.5 : 0;
  ctx.drawImage(f.img, Math.round(f.x - w / 2 - E.camX + wob), Math.round(FLOOR + 6 - h), w, h);
  if (chance(0.06)) emit('sparkle', f.x + rnd(-w / 2, w / 2), FLOOR - rnd(0, h));
  if (f.inside || f.guests.length) emoji('✨', f.x, FLOOR - h - 6 + Math.sin(E.t * 3) * 2, 10);
};
updateFort = function (dt) {
  const f = G.fort; if (!f || !f.collapsed) return;
  for (const q of f.fall) { q.vy += 380 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; if (q.y > FLOOR + 6) { q.y = FLOOR + 6; q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.5; } }
  f.collapseT -= dt;
  if (f.collapseT <= 0) { for (const q of f.fall) G.mess.push({ room: f.room, x: clamp(q.x, 20, ROOMS[f.room].w - 20), y: FLOOR + 8, key: q.key, s: 0.5, rot: q.rot % 1 }); G.fort = null; }
};
collapseFort = function (why) {
  const f = G.fort; if (!f || f.collapsed) return; closeFortInside(true); UI.closeActions();
  f.collapsed = true; f.collapseT = 2.2; clearTimeout(f.bedT);
  f.fall = f.pieces.map(q => ({ key: q.key, s: q.s, x: f.x + (q.x - f.ox - f.bw / 2) * f.scale, y: FLOOR + 6 - (f.oy + f.bh - q.y) * f.scale, vx: rnd(-90, 90), vy: rnd(-180, -60), vr: rnd(-8, 8), rot: 0 }));
  if (why === 'niko') { Audio2.sfx('meow1', { rate: 1.4 }); UI.face('niko', 'surprised', 1500); niko.room = f.room; niko.x = f.x; niko.state = 'flee'; niko.walkTo(f.x + 140, () => { niko.state = 'wander'; }, 130); }
  Audio2.sfx('thud'); emit('dust', f.x, FLOOR - 10, 30);
  for (const g of f.guests) if (g !== niko && g !== miles) { g.state = 'idle'; g.hidden = false; g.room = f.room; g.x = f.x + rnd(-40, 40); AI.hold(g, false); }
  f.guests = []; marina.state = 'idle'; marina.offY = 0; marina.hidden = false; f.inside = false;
  setTimeout(() => { say('m_fort_fall').then(() => { G.moodCtx = { type: 'fortFell' }; UI.pulseMoods(); }); setMusic(); }, 600);
};
fortActions = function () {
  const f = G.fort; if (!f || f.collapsed) return [];
  return [A('🚪', () => openFortInside()), A('🛠️', () => openFortBuilder(f)), A('💥', () => { f.wob = E.t + 0.5; Audio2.sfx('boing'); setTimeout(() => collapseFort('jump'), 400); })];
};
enterFort = function () { openFortInside(); };
exitFort = function () { closeFortInside(); };
inviteToFort = function (e) { openFortInside(e); };
fortBedtime = function () {
  const f = G.fort; if (!f || f.collapsed) return;
  const p = [daddy, mommy].find(e => !e.hidden && e.state !== 'toilet'); if (!p) return;
  if (G.room !== f.room) { G.fort = null; return; }
  closeFortInside(true);
  AI.hold(p, true); p.room = G.room; if (Math.abs(p.x - f.x) > 200) p.x = clamp(f.x + 120, 10, ROOMS[G.room].w - 10);
  p.walkTo(f.x + 40, () => { say(p === daddy ? 'd_fort_down' : 'mo_fort_down', p).then(() => { collapseFort('bedtime'); AI.hold(p, false); }); });
};

// ------------------------------------------------------------------ magical fort interior
let FI = null;
const fortBG = {};
function openFortInside(invite) {
  const f = G.fort; if (!f || f.collapsed) return;
  UI.closeActions(); f.inside = true; marina.hidden = true;
  const p = document.getElementById('panel'); p.innerHTML = ''; p.classList.remove('hidden'); Audio2.Music.set('fort'); Audio2.sfx('magic'); say('m_fort_magic');
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; cv.className = 'fortin';
  const top = el2('div', 'ptop');
  const exit = btn('🚪', () => closeFortInside());
  const theme = btn('⭐', () => { f.theme = FORT_THEMES[(FORT_THEMES.indexOf(f.theme) + 1) % FORT_THEMES.length]; Audio2.sfx('magic'); });
  const lights = btn('💡', () => { FI.lights = !FI.lights; Audio2.blip(FI.lights ? 12 : 0); });
  top.append(exit, theme, lights, el2('div', 'ttl', '✨🏰✨'));
  const inv = el2('div', 'row invite');
  for (const [who, ico] of [[daddy, '👨'], [mommy, '👩'], [rory, '🧔'], [niko, '🐱'], [miles, '👶']]) inv.append(btn(ico, () => fortInvite(who), 'pbtn'));
  const tray = el2('div', 'tray scrollx');
  const toys = toyKeys(); const list = toys.length ? toys : TOY_FALLBACK;
  for (const t of list) { const b = btn(toys.length ? '' : t, () => { f.toys.push({ k: t, x: rnd(70, 250), y: rnd(150, 172) }); Audio2.blip(pick([0, 4, 7, 12])); }, 'tile'); if (toys.length) b.append(sprImg(t)); tray.append(b); }
  p.append(top, cv, inv, tray);
  FI = { cv, x: cv.getContext('2d'), stars: Array.from({ length: 40 }, () => [Math.random() * 320, Math.random() * 120, Math.random() * 6]), drag: null, lights: true, raf: 0, sel: null };
  FI.x.imageSmoothingEnabled = false;
  for (const t of FORT_THEMES) if (!fortBG[t]) { const i = new Image(); i.src = 'assets/bg/fort_' + t + '.png'; fortBG[t] = i; }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 320 / r.width, (e.clientY - r.top) * 180 / r.height]; };
  cv.addEventListener('pointerdown', e => { const [mx, my] = pos(e); const hit = fortHit(mx, my); if (hit) { FI.drag = { ...hit, dx: mx - hit.o.x, dy: my - hit.o.y, t: performance.now(), mx, my }; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener('pointermove', e => { if (!FI.drag) return; const [mx, my] = pos(e); FI.drag.o.x = clamp(mx - FI.drag.dx, 10, 310); FI.drag.o.y = clamp(my - FI.drag.dy, 120, 178); });
  cv.addEventListener('pointerup', e => { const d = FI.drag; FI.drag = null; if (!d) return; const [mx, my] = pos(e);
    if (performance.now() - d.t < 250 && Math.hypot(mx - d.mx, my - d.my) < 6) fortTapThing(d); else Audio2.blip(4, 'triangle', 0.05); });
  f.me = f.me || { x: 160, y: 172 };
  if (invite) setTimeout(() => fortInvite(invite), 600);
  const loop = () => { if (!FI) return; drawFortInside(); FI.raf = requestAnimationFrame(loop); }; loop();
}
function closeFortInside(silent) {
  const f = G.fort; if (FI) { cancelAnimationFrame(FI.raf); FI = null; }
  const p = document.getElementById('panel'); if (f && f.inside) { p.classList.add('hidden'); p.innerHTML = ''; }
  if (f) { f.inside = false; for (const g of f.guests) if (g !== niko && g !== miles) { g.hidden = false; g.state = 'idle'; g.room = f.room; g.x = clamp(f.x + rnd(-50, 50), 10, ROOMS[f.room].w - 10); AI.hold(g, false); } f.guests = []; }
  marina.hidden = false; marina.state = 'idle'; marina.offY = 0; if (f) marina.x = clamp(f.R + 12, 10, ROOMS[G.room].w - 10);
  if (!silent) setMusic();
}
function fortInvite(e) {
  const f = G.fort; if (!f || f.guests.includes(e)) return;
  if (e === rory && !G.rory) { G.rory = true; rory.hidden = false; }
  const key = e === daddy ? 'm_play_daddy' : e === mommy ? 'm_play_mommy' : e === rory ? 'm_play_rory' : e === niko ? 'm_play_niko' : 'm_wuv_miles';
  say(key).then(() => {
    if (!FI) return;
    f.guests.push(e); e.fortPos = { x: rnd(60, 260), y: rnd(160, 176) }; Audio2.sfx('magic');
    if (e !== niko && e !== miles) { AI.hold(e, true); e.hidden = true; e.stop(); }
    if (e === niko) { Audio2.sfx('meow2'); UI.face('niko', 'happy', 1400); if (chance(0.4)) setTimeout(() => { if (FI) collapseFort('niko'); }, 3500); return; }
    if (e === miles) { Audio2.sfx('baby_coo'); return; }
    const keen = e === daddy ? !AI.daddyTired && chance(0.6) : e === rory ? true : chance(0.75);
    e.fortTired = !keen;
    say(e === daddy ? (keen ? pick(['d_play_yes', 'd_play_yes2']) : pick(['d_play_tired', 'd_play_tired2'])) : e === mommy ? (keen ? 'mo_play_yes' : 'mo_play_tired') : pick(['r_play_yes', 'r_play_yes2']), e)
      .then(() => { if (keen) say('m_yay'); });
  });
}
function fortThings() {
  const f = G.fort; const out = [{ type: 'me', o: f.me }];
  f.guests.forEach(g => out.push({ type: 'guest', g, o: g.fortPos })); f.toys.forEach(t => out.push({ type: 'toy', o: t }));
  return out;
}
function thingKey(t) {
  if (t.type === 'me') return mBase();
  if (t.type === 'toy') return t.o.k;
  const g = t.g; if (g === niko) return has('niko_sit') ? 'niko_sit' : 'niko'; if (g === mommy) return 'mommy'; if (g === miles) return 'miles';
  return g.fortTired ? g.id + '_lie' : g.id;
}
function fortHit(mx, my) {
  const th = fortThings().sort((a, b) => b.o.y - a.o.y);
  for (const t of th) { const k = thingKey(t); if (!E.A[k]) { if (Math.abs(mx - t.o.x) < 12 && my > t.o.y - 24 && my < t.o.y) return t; continue; }
    const v = visBox(k), s = thingScale(t); if (mx > t.o.x + v[0] * s && mx < t.o.x + v[2] * s && my > t.o.y + v[1] * s && my < t.o.y + v[3] * s) return t; }
  return null;
}
function thingScale(t) { return t.type === 'toy' ? 0.9 : t.g === niko ? 0.6 : t.g === miles ? 0.8 : 1; }
function fortTapThing(t) {
  if (t.type === 'me') { say(pick(['m_giggle', 'm_yay', 'm_fort'])); FI.jumpMe = performance.now(); return; }
  if (t.type === 'toy') { Audio2.blip(pick([7, 9, 12, 14]), 'square', 0.1); t.o.spin = performance.now(); return; }
  const g = t.g; t.o.heart = performance.now();
  if (g === niko) { Audio2.sfx('purr'); return; } if (g === miles) { Audio2.sfx('baby_coo'); return; }
  if (g.fortTired && g === daddy) { g.fortTired = false; say('d_play_yes', g); return; }
  say(g === daddy ? pick(['d_love', 'd_cuddle', 'd_play_yes']) : g === mommy ? pick(['mo_love', 'mo_play_yes']) : pick(['r_love', 'r_giggle', 'r_wow']), g);
}
function drawFortInside() {
  const f = G.fort; if (!f || !FI) return; const x = FI.x, t = performance.now() / 1000;
  const bg = fortBG[f.theme];
  if (bg && bg.complete && bg.naturalWidth) x.drawImage(bg, 0, 0, 320, 180);
  else { const g = x.createLinearGradient(0, 0, 0, 180); const C = { cozy: ['#3b1f4f', '#a05a8a'], space: ['#0b0b2a', '#2a1a5a'], castle: ['#5a3a8a', '#ffb3d9'] }[f.theme]; g.addColorStop(0, C[0]); g.addColorStop(1, C[1]); x.fillStyle = g; x.fillRect(0, 0, 320, 180);
    x.fillStyle = 'rgba(255,240,255,.15)'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(160, 70, 320, 0); x.fill(); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 150, 320, 30); }
  for (const s of FI.stars) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s[2])); x.fillStyle = `rgba(255,250,200,${a})`; x.fillRect(s[0], s[1], 2, 2); }
  if (FI.lights) for (let i = 0; i < 14; i++) { const lx = 12 + i * 22, ly = 14 + Math.sin(i * 0.9) * 8; x.fillStyle = `hsla(${(i * 40 + t * 40) % 360},90%,70%,${0.6 + 0.4 * Math.sin(t * 4 + i)})`; x.beginPath(); x.arc(lx, ly, 3, 0, 6.3); x.fill(); }
  const th = fortThings().sort((a, b) => a.o.y - b.o.y);
  for (const it of th) {
    const k = thingKey(it), s = thingScale(it), o = it.o;
    let dy = 0; if (it.type === 'me' && FI.jumpMe && t * 1000 - FI.jumpMe < 600) dy = -Math.sin((t * 1000 - FI.jumpMe) / 600 * Math.PI) * 16;
    let rot = 0; if (o.spin && t * 1000 - o.spin < 600) rot = (t * 1000 - o.spin) / 600 * Math.PI * 2;
    const c = E.A[k] ? spriteCanvas(k, it.type === 'me' ? mOpt() : null) : null;
    x.save(); x.translate(o.x, o.y + dy); x.rotate(rot);
    if (c) { x.scale(s, s); x.drawImage(c, -c.width / 2, -c.height); } else { x.font = '22px sans-serif'; x.textAlign = 'center'; x.fillText(k, 0, -4); }
    x.restore();
    if (o.heart && t * 1000 - o.heart < 1200) { x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('💖', o.x, o.y - 70 - (t * 1000 - o.heart) / 40); }
    if (it.type === 'guest' && it.g.fortTired && Math.sin(t * 2) > 0) { x.font = '10px sans-serif'; x.fillText('💤', o.x + 14, o.y - 30); }
  }
}
