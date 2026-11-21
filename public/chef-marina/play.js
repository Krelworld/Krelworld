// Chef Marina — yard leaves & leaf blower (hundreds of leaves, clear the yard, blow people away), and toys you can play with

Object.assign(SAY_ICON, { m_i_made: '🍽️✨', m_blow: '🍃💨', m_yard_clean: '✨🌳', m_bye_leaves: '👋🍂', m_toy_play: '🧸', m_vroom: '🚗', m_roar: '🦖', m_catch: '⚽',
  d_blown: '💨😵', d_yard: '👏🌳', mo_blown: '💨😆', mo_yard: '👏🌳', r_blown: '💨🤪', r_yard: '👏' });

// ================================================================== LEAVES
const LEAF_COLS = ['#c8642a', '#e09030', '#8a4a20', '#b5482f', '#d8a040', '#a8572a', '#e6b24a', '#7a3d1c'];
const PILE = { x: 262, y: 172 };
G.leaves = []; G.pileN = 30; G.yardClear = 0;
function newLeaf(x, y, z = 0) { return { x, y, z, vx: 0, vy: 0, vz: 0, rot: rnd(0, 6.3), vr: 0, c: pick(LEAF_COLS), s: rnd(1.8, 3.2) }; }
function seedLeaves(n) { for (let i = 0; i < n; i++) { let x = rnd(8, 552); if (Math.abs(x - PILE.x) < 24) x += 50; G.leaves.push(newLeaf(x, rnd(147, 179))); } }
seedLeaves(190);
const blowing = () => G.room === 'yard' && WEATHER === 'fall' && G.holding && G.holding.type === 'blower' && !G.busy;
let blowSnd = 0, regrow = 0;
function leafTick(dt) {
  if (G.room !== 'yard' || WEATHER !== 'fall') return;
  G.pile = 1 + Math.min(G.pileN, 210) / 28;
  const on = blowing(), dir = marina.dir, ox = marina.x + dir * 12, oy = marina.y;
  if (on) {
    blowSnd -= dt; if (blowSnd <= 0) { Audio2.sfx('leafblower', { vol: 0.45 }); blowSnd = 1.7; }
    for (let i = 0; i < 2; i++) emit('dust', ox + dir * rnd(4, 20), oy - rnd(8, 22), 1, { vx: dir * rnd(160, 260), vy: rnd(-20, 20), g: 0, life: 0.35, size: 2, grow: 3, col: 'rgba(255,255,255,.5)' });
    // blow people and the cat away (they tumble off, then come back dizzy)
    for (const e of [daddy, mommy, rory, niko]) {
      if (!e.here || e.pairHide || (e.blownCd || 0) > E.t || e.state === 'toilet') continue;
      const dx = (e.x - ox) * dir; if (dx < 0 || dx > 70 || Math.abs(e.y - oy) > 22) continue;
      e.blownCd = E.t + 7; e.blownT = E.t + 1.7; e.bvx = dir * rnd(230, 300); e.stop(); AI.hold(e, true); if (e.state === 'lie' || e.state === 'sit') e.state = 'idle';
      if (e === niko) { niko.perchY = null; niko.state = 'wander'; Audio2.sfx('meow1', { rate: 1.5 }); UI.face('niko', 'surprised', 1500); }
      else say(e === daddy ? 'd_blown' : e === mommy ? 'mo_blown' : 'r_blown', e);
      chip('pop'); setTimeout(() => say(pick(['m_giggle', 'm_laugh'])), 900);
    }
  }
  for (const e of [daddy, mommy, rory, niko]) if ((e.blownT || 0) > E.t) { e.x = clamp(e.x + e.bvx * dt, 12, ROOMS.yard.w - 12); e.bvx *= 1 - 1.2 * dt; if (chance(0.5)) emit('leaf', e.x, e.y - 20, 1); }
    else if (e.blownT) { e.blownT = 0; e.face = '😵‍💫'; setTimeout(() => { e.face = null; AI.hold(e, false); }, 1600); }
  // leaf physics
  let loose = 0; const L = G.leaves, W = ROOMS.yard.w;
  for (let i = L.length - 1; i >= 0; i--) {
    const l = L[i];
    if (on) { const dx = (l.x - ox) * dir, dy = Math.abs(l.y - oy); if (dx > -4 && dx < 120 && dy < 16 + dx * 0.22) { const f = 1 - dx / 120; l.vx += dir * 900 * f * dt; l.vz += rnd(60, 520) * f * dt; l.vy += rnd(-140, 140) * f * dt; l.vr = rnd(-14, 14); } }
    // gentle scuffle when people walk through
    if (l.z < 2 && Math.abs(l.x - marina.x) < 7 && Math.abs(l.y - marina.y) < 5 && marina.moving) { l.vx += marina.dir * rnd(10, 50); l.vz += rnd(20, 60); l.vr = rnd(-8, 8); }
    if (l.vx || l.vy || l.z > 0 || l.vz) {
      l.x += l.vx * dt; l.y = clamp(l.y + l.vy * dt, 146, 179); l.z += l.vz * dt; l.rot += l.vr * dt;
      if (l.z > 0) { l.vz -= 330 * dt; l.vx *= 1 - 0.7 * dt; l.vx += Math.sin(E.t * 6 + i) * 30 * dt; }
      if (l.z <= 0) { l.z = 0; l.vz = 0; const fr = Math.max(0, 1 - 5 * dt); l.vx *= fr; l.vy *= fr; l.vr *= fr; if (Math.abs(l.vx) < 3) l.vx = 0; if (Math.abs(l.vy) < 3) l.vy = 0; }
      if (l.x < 4) { l.x = 4; l.vx = Math.abs(l.vx) * 0.4; } if (l.x > W - 4) { l.x = W - 4; l.vx = -Math.abs(l.vx) * 0.4; }
    }
    const pr = 13 + Math.min(26, G.pileN * 0.08);
    if (l.z < 6 && Math.abs(l.x - PILE.x) < pr && Math.abs(l.y - PILE.y) < 9 && Math.abs(l.vx) < 140) { L.splice(i, 1); G.pileN++; if (chance(0.3)) Audio2.blip(pick([0, 4, 7, 12]), 'triangle', 0.04, 0.05); continue; }
    loose++;
  }
  // new leaves drift down from the trees (not right after she has cleared the yard)
  regrow -= dt;
  if (regrow <= 0 && E.t > G.yardClear && L.length + G.pileN < 230) { regrow = 0.9; const l = newLeaf(rnd(10, W - 10), rnd(147, 179), rnd(90, 140)); l.vz = -10; l.vx = rnd(-20, 20); l.vr = rnd(-3, 3); L.push(l); }
  if (loose < 12 && G.pileN > 60 && E.t > G.yardClear && !G.busy) yardCleared();
}
function yardCleared() {
  G.yardClear = E.t + 45; Audio2.jingle([0, 4, 7, 12, 16, 19, 24], 0.08); chip('cheer'); emit('confetti', marina.x, marina.y - 60, 50); UI.bigIcon('✨🌳✨', 1500);
  marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 2000);
  say('m_yard_clean').then(() => { const f = [daddy, mommy, rory].filter(e => e.here && e.state !== 'toilet' && !(e === rory && !G.rory)); if (f.length) { const e = pick(f); e.dir = Math.sign(marina.x - e.x) || 1; say(e === daddy ? 'd_yard' : e === mommy ? 'mo_yard' : 'r_yard', e).then(() => emit('heart', e.x, e.y - 90, 6)); } });
}
function drawLeaves(air) {
  if (G.room !== 'yard' || WEATHER !== 'fall') return; const ctx = E.ctx;
  for (const l of G.leaves) { if ((l.z > 5) !== air) continue; const x = l.x - E.camX; if (x < -6 || x > E.viewW + 6) continue;
    if (l.z > 5) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x - 1, l.y, 3, 1); }
    ctx.save(); ctx.translate(x, l.y - l.z); ctx.rotate(l.rot); ctx.fillStyle = l.c; ctx.fillRect(-l.s, -l.s / 2, l.s * 2, l.s); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-l.s, -0.4, l.s * 2, 0.8); ctx.restore(); }
}
const _drawMessY = drawMess; drawMess = function () { drawLeaves(false); _drawMessY(); };
const _drawExitY = drawExitSigns; drawExitSigns = function () { drawLeaves(true); _drawExitY(); };
const _featTickY = featTick; featTick = function (dt) { _featTickY(dt); leafTick(dt); toyTick(dt); };
// tumbling when blown
const _drawEntY = drawEnt;
drawEnt = function (e) {
  if ((e.blownT || 0) > E.t && e !== marina) { const k = 1.7 - (e.blownT - E.t), ctx = E.ctx, cx = Math.round(e.x - E.camX), cy = e.y - 28 - Math.sin(Math.min(1, k / 1.2) * Math.PI) * 26;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * 9 * Math.sign(e.bvx)); ctx.translate(-cx, -(e.y - 28)); _drawEntY(e); ctx.restore(); return; }
  _drawEntY(e);
};
// the blower works just by holding it and walking; tapping also gives a big gust
blowLeaves = function () { if (!blowing()) return; chip('pop'); for (const l of G.leaves) { const dx = (l.x - marina.x) * marina.dir; if (dx > 0 && dx < 140 && Math.abs(l.y - marina.y) < 30) { l.vx += marina.dir * rnd(120, 320); l.vz += rnd(80, 260); l.vr = rnd(-14, 14); } } };
jumpLeaves = function () {
  approach(PILE.x - 46, () => {
    G.busy = true; marina.dir = 1; say('m_leaves'); let t = 0; const x0 = marina.x; squashTo(0.8, 140); chip('jump');
    const iv = setInterval(() => { t += 0.035; const k = Math.min(1, t / 0.75); marina.x = x0 + (PILE.x - x0) * k; marina.offY = -Math.sin(k * Math.PI) * 52 + k * 8; marina.rot = k * Math.PI * 2;
      if (k >= 1) { clearInterval(iv); marina.rot = 0; Audio2.sfx('leaves'); Audio2.sfx('thud', { vol: 0.6 });
        const n = G.pileN; G.pileN = Math.min(12, n); // the whole pile explodes back out as real leaves
        for (let i = 0; i < n - G.pileN; i++) { const l = newLeaf(PILE.x + rnd(-10, 10), clamp(PILE.y + rnd(-8, 6), 147, 179), rnd(4, 20)); l.vx = rnd(-260, 260); l.vz = rnd(140, 380); l.vy = rnd(-70, 40); l.vr = rnd(-14, 14); G.leaves.push(l); }
        for (let i = 0; i < 40; i++) emit('leaf', PILE.x + rnd(-20, 20), FLOOR + 2);
        marina.hidden = true; G.yardClear = Math.max(G.yardClear, E.t + 6);
        setTimeout(() => { marina.hidden = false; marina.offY = 0; marina.state = 'cheer'; G.busy = false; emit('leaf', marina.x, marina.y - 50, 14); say(pick(['m_giggle', 'm_laugh', 'm_again'])); setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1500); }, 900); }
    }, 35);
  }, 0);
};
const _propActionsY = propActions;
propActions = function (p) {
  if (p.a === 'leafpile') { const a = [A('🦘', jumpLeaves)]; if (!(G.holding && G.holding.type === 'blower')) a.push(A('🍃', grabBlower)); a.push(A('🌪️', () => { const n = Math.min(G.pileN, 40); G.pileN -= n; for (let i = 0; i < n; i++) { const l = newLeaf(PILE.x, PILE.y, 6); l.vx = rnd(-200, 200); l.vz = rnd(100, 300); l.vy = rnd(-50, 30); G.leaves.push(l); } Audio2.sfx('leaves'); say('m_giggle'); })); return a; }
  if (p.a === 'blower') return [A('🍃', grabBlower)];
  return _propActionsY(p);
};
function grabBlower() { G.holding = { type: 'blower' }; Audio2.sfx('leafblower'); say('m_blow'); UI.bigIcon('🍃💨', 800); }

// ================================================================== TOYS you can play with (anything she chucks out of the toy boxes)
const TOY_KIND = { toy_ball: 'ball', toy_rocket: 'rocket', toy_robotdog: 'dog', toy_dino: 'dino', toy_unicorn: 'hop', toy_teddy: 'hug', toy_doll: 'hug', toy_blocks: 'stack', toy_teaset: 'tea', toy_flashlight: 'light', toy_castle: 'castle', toy_snacks: 'snack', toy_books: 'read', toy_crayons: 'scribble' };
makeMess = function (p) {
  Audio2.noise(0.4, 0.3, 500); say(pick(['m_giggle', 'm_wow', 'm_toy_play'])); G.bounce = { id: p.id, t0: E.t };
  const keys = Object.keys(TOY_KIND).filter(has);
  for (let i = 0; i < 5; i++) {
    const k = keys.length ? pick(keys) : null, m = { room: G.room, x: p.x, y: FLOOR + rnd(0, 12), toy: true, vx: rnd(-90, 90), vz: rnd(120, 240), z: 20, rot: 0, vr: rnd(-8, 8), bornT: E.t };
    if (k) { m.key = k; m.s = 1; } else { m.ico = pick(TOYS); }
    G.mess.push(m);
  }
};
function toyTick(dt) {
  for (const m of G.mess) {
    if (m.room !== G.room || !(m.z > 0 || m.vz || m.vx)) continue;
    m.x = clamp(m.x + (m.vx || 0) * dt, 14, ROOMS[m.room].w - 14); m.z = (m.z || 0) + (m.vz || 0) * dt; m.vz = (m.vz || 0) - 420 * dt; m.rot = (m.rot || 0) + (m.vr || 0) * dt;
    if (m.z <= 0) { m.z = 0; if (Math.abs(m.vz) > 70 && (m.bouncy || m.bornT)) { m.vz = -m.vz * (m.bouncy ? 0.72 : 0.4); m.vx *= 0.8; if (m.bouncy) Audio2.sfx('boing', { vol: 0.35, rate: 1.3 }); else Audio2.blip(-7, 'triangle', 0.04, 0.08); } else { m.vz = 0; m.vx = 0; m.vr = 0; if (!m.spinKeep) m.rot = 0; m.bornT = 0; m.bouncy = 0; } }
  }
}
const _drawMessT = drawMess;
drawMess = function () {
  // lift airborne toys while drawing
  const lifted = []; for (const m of G.mess) if (m.z > 0) { m.y -= m.z; lifted.push(m); }
  _drawMessT(); for (const m of lifted) m.y += m.z;
  for (const m of G.mess) if (m.room === G.room && m.toy && !G.tidy && !m.z && Math.sin(E.t * 4 + m.x) > 0.92) emoji('✨', m.x + 5, m.y - 12, 6);
};
function playToy(m) {
  const kind = TOY_KIND[m.key] || 'hop';
  approach(m.x, () => {
    marina.dir = Math.sign(m.x - marina.x) || 1; playAnim('marina_pet', { fps: 8, proc: 'hug', dur: frameCount('marina_pet') ? 0.8 : 0.6 }); chip('tap' + (1 + (Math.random() * 3 | 0)));
    const W = ROOMS[G.room].w, d = marina.dir;
    if (kind === 'ball') { say('m_catch'); m.vx = d * rnd(90, 150); m.vz = 260; m.vr = d * 10; m.bouncy = 1; m.z = 1;
      const c = [daddy, mommy, rory].find(e => e.here && e.state !== 'lie' && !(e === rory && !G.rory)); if (c) setTimeout(() => { c.dir = Math.sign(m.x - c.x) || 1; emit('star', c.x, c.y - 60, 4); m.vx = Math.sign(marina.x - m.x) * 130; m.vz = 240; m.z = 1; m.bouncy = 1; chip('pop'); }, 1300); if (niko.here) setTimeout(() => { niko.state = 'wander'; niko.perchY = null; niko.walkTo(m.x, null, 120); }, 600); }
    else if (kind === 'rocket') { Audio2.whoosh(true); chip('magic'); m.vz = 420; m.z = 1; m.vx = 0; m.vr = 0; const iv = setInterval(() => { if (!m.z) return clearInterval(iv); emit('smoke', m.x, m.y - m.z + 4, 1); emit('sparkle', m.x, m.y - m.z + 6, 1); }, 40); say('m_wow'); }
    else if (kind === 'dog') { let n = 0; const iv = setInterval(() => { m.vz = 110; m.z = 1; m.vx = d * 40; Audio2.blip(n % 2 ? 9 : 5, 'square', 0.07, 0.15); if (++n > 5) clearInterval(iv); }, 380); say('m_giggle'); }
    else if (kind === 'dino') { say('m_roar'); m.vz = 150; m.z = 1; Audio2.noise(0.5, 0.35, 120); emit('anger', m.x, m.y - 18, 2); if (niko.here) { Audio2.sfx('meow1', { rate: 1.4 }); niko.state = 'flee'; niko.perchY = null; niko.walkTo(niko.x > m.x ? W - 10 : 10, () => { niko.state = 'wander'; }, 120); } }
    else if (kind === 'hug') { emit('heart', m.x, m.y - 16, 5); m.vz = 120; m.z = 1; say('m_cuddle'); chip('hug'); }
    else if (kind === 'stack') { let n = 0; const iv = setInterval(() => { emit('heart', m.x, m.y - 10 - n * 7, 1, { ch: pick(['🟥', '🟦', '🟨', '🟩']), vx: 0, vy: 0, g: 0, life: 1.6 - n * 0.2, size: 8 }); Audio2.blip(n * 2, 'square', 0.06, 0.12); if (++n > 5) { clearInterval(iv); setTimeout(() => { Audio2.sfx('thud', { vol: 0.5 }); emit('dust', m.x, m.y, 8); say('m_uhoh'); }, 500); } }, 220); }
    else if (kind === 'tea') { emit('steam', m.x, m.y - 12, 6); Audio2.jingle([12, 16, 19], 0.1, 'sine'); say('m_yummy'); }
    else if (kind === 'light') { G.dark[G.room] = !G.dark[G.room]; emit('sparkle', m.x, m.y - 12, 10); say('m_wow'); }
    else if (kind === 'castle') { emit('confetti', m.x, m.y - 20, 30); chip('magic'); say('m_princess'); }
    else if (kind === 'snack') { say('m_yummy'); Audio2.sfx('eat_chomp'); emit('heart', m.x, m.y - 14, 3, { ch: '🍿' }); }
    else if (kind === 'read') { say('m_hmm'); emit('note', m.x, m.y - 14, 1, { ch: '📖' }); }
    else if (kind === 'scribble') { for (let i = 0; i < 24; i++) setTimeout(() => emit('sparkle', m.x + Math.cos(i / 2) * i, m.y - 14 - Math.sin(i / 2) * i * 0.6, 1, { col: `hsl(${i * 15},90%,60%)`, life: 1.5, vx: 0, vy: 0 }), i * 40); say('m_draw'); }
    else if (m.key === 'toy_unicorn' || kind === 'hop') { let n = 0; const iv = setInterval(() => { m.vz = 150; m.z = 1; m.vx = d * 30; emit('sparkle', m.x, m.y - 10, 3); if (++n > 3) clearInterval(iv); }, 450); chip('sparkle'); say('m_vroom'); }
  }, 12);
}
const _hitTestT = hitTest;
hitTest = function (wx, wy) {
  if (!G.tidy) { const m = G.mess.find(m => m.room === G.room && (m.toy || m.key) && !m.type && Math.abs(m.x - wx) < 11 && Math.abs(m.y - 7 - wy) < 11); if (m) { const h = _hitTestT(wx, wy); if (!h || h.kind === 'prop' || h.kind === 'pic') return { kind: 'toy', m }; return h; } }
  return _hitTestT(wx, wy);
};
const _interactT = interact;
interact = function (hit, wx, wy) { if (hit.kind === 'toy') return playToy(hit.m); return _interactT(hit, wx, wy); };
