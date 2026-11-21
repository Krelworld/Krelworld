// Chef Marina — features: animation player, stop button, gymnastics, bouncing, shoulder rides,
// keyboard songs, Instagram reels, cuddles/feeding/eating, Mommy food redirect, random starts.

// ------------------------------------------------------------------ extra speech icons
Object.assign(SAY_ICON, {
  m_insta: '📱❓', mo_insta_yes: '📱👍', mo_insta_no: '📱🙅', d_insta1: '🧠🫠', d_insta2: '🙄📱', m_laugh: '🤣', m_laugh2: '😆',
  mo_food_redirect: '🍽️➡️👨', d_amazing: '🤩👏', d_proud: '🥹💖', mo_amazing: '🤩👏', mo_proud: '🥹💖', r_amazing: '🤩🙌',
  m_gym_watch: '👀', m_gym_cartwheel: '🤸', m_gym_handstand: '🙃', m_gym_splits: '🧘', m_gym_backflip: '🔄', m_gym_roundoff: '🌀', m_gym_starjump: '⭐', m_gym_roll: '⚪',
  m_get_down: '⬇️', m_fort_build: '🛠️🏰', m_fort_done: '🎉🏰', m_fort_magic: '✨🏰', m_cool: '😎', m_look: '👀✨', m_bounce: '🦘', m_open: '🚪', m_eat_watch: '🍽️👀',
  d_eat_yum: '😋', r_eat_yum: '😋', d_shoulders: '⬆️🧍', d_shoulders_down: '⬇️', mo_cuddle: '🤗', mo_feed_miles: '🍼👍', mo_hi3: '👋', d_hi4: '👋', r_hi4: '👋',
});
const hasClip = () => true; // clips that don't exist fall back to the device voice inside Audio2.voice

// ------------------------------------------------------------------ generic Marina animation
// base: atlas key prefix with frames _1.._n (from PixelLab). proc: procedural fallback name.
function playAnim(base, { fps = 10, dur = 0, proc = null, move = 0, lift = 0, onEnd = null, loop = false } = {}) {
  const n = frameCount(base);
  marina.stop(); marina.state = 'anim';
  marina.anim = { base: n ? base : null, n, fps, t0: E.t, dur: dur || (n ? n / fps : 1.1), proc, move, lift, x0: marina.x, onEnd, loop };
}
function drawMarinaAnim(e, y, flip, opt, S) {
  const a = e.anim; if (!a) return;
  const k = clamp((E.t - a.t0) / a.dur, 0, 1);
  if (a.base) {
    const idx = a.loop ? 1 + Math.floor((E.t - a.t0) * a.fps) % a.n : Math.min(a.n, 1 + Math.floor(k * a.n));
    const big = spriteSize(a.base + '_1')[1] > 70;
    drawSprite(a.base + '_' + idx, e.x, y - Math.sin(k * Math.PI) * a.lift + (big ? 4 : 0), { flip, scale: big ? S * 0.9 : S, opt });
    return;
  }
  // procedural fallbacks
  const dir = flip ? -1 : 1; let rot = 0, jump = 0, sx = 1, sy = 1, key = mBase();
  switch (a.proc) {
    case 'cartwheel': case 'roundoff': rot = k * Math.PI * 2 * dir; jump = Math.sin(k * Math.PI) * 10; break;
    case 'backflip': rot = -k * Math.PI * 2 * dir; jump = Math.sin(k * Math.PI) * 30; break;
    case 'frontflip': rot = k * Math.PI * 2 * dir; jump = Math.sin(k * Math.PI) * 30; break;
    case 'roll': rot = k * Math.PI * 2 * dir; sy = 0.7; break;
    case 'handstand': rot = Math.PI * Math.min(1, k * 3) * dir * (k > 0.8 ? (1 - k) * 5 : 1); break;
    case 'splits': sy = 1 - Math.min(1, k * 3) * 0.35 * (k > 0.85 ? (1 - k) / 0.15 : 1); sx = 1 + (1 - sy); break;
    case 'starjump': jump = Math.abs(Math.sin(k * Math.PI * 3)) * 18; sx = 1 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.25; break;
    case 'bounce': jump = Math.abs(Math.sin((E.t - a.t0) * 7)) * 16; sy = 1 - (jump < 3 ? 0.12 : 0); break;
    case 'hug': sx = 1 + Math.sin(k * Math.PI) * 0.08; break;
    default: jump = Math.sin(k * Math.PI) * 6;
  }
  drawSprite(key, e.x, y - jump, { flip, scale: S, opt, rot, sx, sy });
}
function animTick() {
  const a = marina.anim; if (!a || marina.state !== 'anim') return;
  const k = clamp((E.t - a.t0) / a.dur, 0, 1);
  if (a.move) marina.x = clamp(a.x0 + a.move * k * marina.dir, 10, ROOMS[G.room].w - 10);
  if (k >= 1 && !a.loop) { marina.state = marina.offY < 0 ? 'perch' : 'idle'; marina.anim = null; a.onEnd && a.onEnd(); }
}

// ------------------------------------------------------------------ STOP button: one obvious way out of any activity
function currentActivity() {
  const s = marina.state;
  if (s === 'ride') return marina.mount === daddy && daddy.state === 'shoulders' ? '🧍' : '🐴';
  if (s === 'wheel') return '♿'; if (s === 'perch') return '🧗'; if (s === 'swing') return '🛝'; if (s === 'bars') return '🐒';
  if (s === 'sit') return G.tv ? '📺' : '🪑'; if (s === 'anim' && marina.anim && marina.anim.loop) return '🦘';
  if (G.holding) return { dish: '🍽️', tp: '🧻', niko: '🐱', blower: '🍃', poop: '💩' }[G.holding.type] || '✋';
  if (G.tv) return '📺';
  return null;
}
function stopActivity() {
  const s = marina.state; Audio2.blip(-2, 'triangle', 0.08, 0.12);
  if (s === 'ride') { say('m_get_down'); const m = marina.mount; dismount(); if (m === daddy) setTimeout(() => say('d_shoulders_down', daddy), 900); return; }
  if (s === 'wheel') return leaveWheelchair();
  if (s === 'perch') return getDown();
  if (s === 'swing' || s === 'bars') return leaveYardToy();
  if (s === 'anim' && marina.anim && marina.anim.loop) { marina.anim.loop = false; marina.anim.dur = 0.01; return; }
  if (s === 'sit') { marina.state = 'idle'; marina.offY = 0; if (G.tv) tvOff(); return; }
  if (G.holding) { if (G.holding.type === 'niko') { niko.state = 'wander'; niko.room = G.room; niko.x = marina.x + 10; } G.holding = null; return; }
  if (G.tv) return tvOff();
}
(function makeStopBtn() {
  const b = document.createElement('button'); b.id = 'stopBtn'; b.className = 'hud big hidden'; b.setAttribute('aria-label', 'stop');
  b.innerHTML = '<span class="si"></span><span class="sx">✋</span>';
  document.getElementById('stage').append(b);
  b.addEventListener('pointerup', e => { e.stopPropagation(); stopActivity(); });
  setInterval(() => { const a = typeof marina !== 'undefined' && !G.busy ? currentActivity() : null; b.classList.toggle('hidden', !a); if (a) b.querySelector('.si').textContent = a; }, 200);
})();

// ------------------------------------------------------------------ gymnastics
const GYM = [
  { id: 'cartwheel', ico: '🤸', move: 34, line: 'm_gym_cartwheel' },
  { id: 'handstand', ico: '🙃', move: 0, line: 'm_gym_handstand' },
  { id: 'backflip', ico: '🔄', move: -6, line: 'm_gym_backflip', lift: 6 },
  { id: 'frontflip', ico: '🔃', move: 18, line: 'm_flip' },
  { id: 'splits', ico: '🧘', move: 0, line: 'm_gym_splits' },
  { id: 'roundoff', ico: '🌀', move: 30, line: 'm_gym_roundoff' },
  { id: 'starjump', ico: '⭐', move: 0, line: 'm_gym_starjump' },
  { id: 'roll', ico: '⚪', move: 26, line: 'm_gym_roll' },
];
function gymMenu() {
  const opts = GYM.map(g => A(g.ico, () => doGym(g)));
  opts.unshift(A('🎲', () => doGym(pick(GYM))));
  UI.actions(marina, opts);
}
function onFurniture() { return marina.state === 'perch' || marina.offY < -4; }
function doGym(g) {
  UI.closeActions(); if (marina.mount) dismount();
  const furn = onFurniture(), y0 = marina.offY;
  say(g.line);
  setTimeout(() => {
    Audio2.sfx('flip'); Audio2.whoosh(true);
    playAnim('marina_' + g.id, { fps: 11, proc: g.id, move: g.move, lift: g.lift || 0, dur: frameCount('marina_' + g.id) ? 0 : 1.1, onEnd: () => {
      if (furn) { marina.state = 'perch'; marina.offY = y0; }
      emit('star', marina.x, marina.y + marina.offY - 40, 8); Audio2.jingle([0, 4, 7, 12], 0.06);
      gymReaction(furn);
    } });
    if (furn) marina.offY = y0;
  }, 500);
}
function gymReaction(furn) {
  const watchers = [daddy, mommy, rory].filter(e => e.here && !['toilet', 'lie'].includes(e.state) && !(e === rory && !G.rory));
  if (!watchers.length) { setTimeout(() => say(pick(['m_did_it', 'm_yay'])), 300); return; }
  const p = pick(watchers); p.dir = Math.sign(marina.x - p.x) || 1;
  if (furn) {
    if (E.t - G.lastClimbScold < 4) return; G.lastClimbScold = E.t;
    setTimeout(() => say(p === daddy ? 'd_climb' : p === mommy ? 'mo_climb' : 'r_climb', p).then(() => { G.moodCtx = { type: 'scold', who: p }; UI.pulseMoods(); }), 400);
  } else {
    marina.state = 'cheer'; Audio2.sfx('crowd_cheer', { vol: 0.4 });
    setTimeout(() => say(p === daddy ? pick(['d_amazing', 'd_proud']) : p === mommy ? pick(['mo_amazing', 'mo_proud']) : 'r_amazing', p).then(() => { emit('heart', p.x, p.y - 90, 6); marina.state = 'idle'; }), 400);
  }
}

// ------------------------------------------------------------------ bouncing on furniture (naughty!)
function bounceOn(p) {
  climbOn(p);
  const wait = setInterval(() => {
    if (marina.state !== 'perch') return; clearInterval(wait);
    say('m_bounce'); const y0 = marina.offY;
    playAnim('marina_bounce', { fps: 10, proc: 'bounce', loop: true });
    marina.offY = y0;
    const bi = setInterval(() => { if (marina.state !== 'anim') { clearInterval(bi); return; } Audio2.sfx('boing', { rate: rnd(0.9, 1.2), vol: 0.6 }); emit('dust', marina.x, marina.y + marina.offY, 2); }, 430);
    setTimeout(() => { if (marina.state === 'anim' && marina.anim && marina.anim.loop) { marina.anim.loop = false; marina.anim.dur = 0.01; } }, 5200);
    setTimeout(() => gymReaction(true), 1600);
  }, 100);
  setTimeout(() => clearInterval(wait), 3000);
}

// ------------------------------------------------------------------ shoulder rides on Daddy (Rory still does horsey)
const _mount = mount;
mount = function (e) {
  if (e !== daddy || !has('daddy_shoulders')) return _mount(e);
  if (e.busy) return;
  approach(e.x, () => {
    marina.state = 'ride'; marina.mount = e; e.state = 'shoulders'; e.speed0 = e.speed; e.speed = 70; Audio2.whoosh(true);
    say('d_shoulders', e).then(() => say('m_giddyup'));
    AI.hold(e, true);
  }, 10);
};
const _drawMounted = drawMounted;
drawMounted = function () { if (marina.mount && marina.mount.state === 'shoulders') return; _drawMounted(); };

// ------------------------------------------------------------------ toy keyboard songs
const SONGS = {
  twinkle: [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0], happy: [0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12],
  fanfare: [7, 7, 7, 12, null, 7, 12, 16, 19], silly: [12, 0, 12, 0, 14, 2, 15, 3, 19, null, -5],
  spooky: [0, 3, 6, 3, 0, -1, 0, null, 6, 5, 3, 0], lullaby: [4, 2, 0, 2, 4, 4, 4, null, 2, 2, 2, null, 4, 7, 7],
  rocket: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 24], sakura: [9, 9, 11, null, 9, 9, 11, null, 9, 11, 12, 11, 9, 5, 4],
};
function playSong(name) {
  if (Audio2.melody) { try { Audio2.melody(name); } catch (e) { } }
  else SONGS[name].forEach((n, i) => n != null && setTimeout(() => Audio2.blip(n, 'square', 0.2, 0.2), i * 190));
  for (let i = 0; i < 6; i++) setTimeout(() => emit('note', marina.x + rnd(-20, 20), marina.y - 60), i * 300);
  marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 2600);
}

// ------------------------------------------------------------------ prop / entity / self action extensions
const _propActions = propActions;
propActions = function (p) {
  let a = _propActions(p);
  if (p.a === 'keyboard') a = [['twinkle', '🌟'], ['happy', '🎉'], ['fanfare', '🎺'], ['silly', '🤪'], ['spooky', '👻'], ['lullaby', '🌙'], ['rocket', '🚀'], ['sakura', '🌸']].map(([n, i]) => A(i, () => playSong(n)));
  if (['sofa', 'armchair'].includes(p.a) || p.id === 'loveseat') a.splice(1, 0, A('🦘', () => bounceOn(p)));
  return a;
};
const _selfActions = selfActions;
selfActions = function () {
  const a = _selfActions();
  const i = a.findIndex(x => x.ico === '🤸'); if (i >= 0) a[i] = A('🤸', gymMenu);
  if (marina.state === 'ride') a.splice(0, a.length, A('⬇️', stopActivity), ...(marina.mount === rory ? [A('🐴', () => say('r_horse', rory))] : []));
  return a;
};
const _entActions = entActions;
entActions = function (e) {
  const a = _entActions(e);
  if (e === mommy && !G.busy) a.push(A('📱', askInsta));
  if (e === daddy && has('daddy_shoulders')) { const i = a.findIndex(x => x.ico === '🐴'); if (i >= 0) a[i] = A('🧍', () => mount(daddy)); }
  return a;
};

// ------------------------------------------------------------------ cuddles, Miles care, petting
cuddle = function (e) {
  G.busy = true; marina.dir = Math.sign(e.x - marina.x) || 1; e.dir = -marina.dir; e.hugT = E.t + 2.6;
  playAnim('marina_hug', { fps: 7, proc: 'hug', dur: frameCount('marina_hug') ? 0 : 1.8 });
  const iv = setInterval(() => emit('heart', (marina.x + e.x) / 2, marina.y - 60, 1), 200); setTimeout(() => clearInterval(iv), 2200);
  const key = e === daddy ? 'm_wuv_daddy' : e === mommy ? 'm_wuv_mommy' : 'm_wuv_rory';
  say(key).then(() => say(e === daddy ? pick(['d_love', 'd_cuddle']) : e === mommy ? pick(['mo_love', 'mo_cuddle']) : 'r_love', e)).then(() => { G.busy = false; });
  setTimeout(() => { G.busy = false; }, 7000);
};
soothe = function (kind) {
  const py = miles.spot === 'crib' ? BACK - 10 : 156;
  const anim = kind === 'bottle' ? 'marina_feed' : kind === 'cuddle' ? 'marina_cuddle_baby' : 'marina_pet';
  playAnim(anim, { fps: 6, proc: 'hug', dur: frameCount(anim) ? Math.max(1.6, frameCount(anim) / 6) : 1.8 });
  say(kind === 'bottle' ? 'm_bottle' : kind === 'cuddle' ? 'm_shh_miles' : 'm_wuv_miles');
  if (kind === 'bottle') miles.eatT = E.t + 2.5;
  setTimeout(() => {
    miles.crying = false; miles.happyT = 4; miles.cryT = rnd(40, 80); Audio2.sfx('baby_coo'); emit('heart', miles.x, py - 30, 10);
    UI.face('miles', 'happy', 2200);
    if (mommy.here) setTimeout(() => say(kind === 'bottle' ? 'mo_feed_miles' : 'mo_miles', mommy), 1500);
  }, 1400);
};
const _petNiko = petNiko;
petNiko = function () { playAnim('marina_pet', { fps: 6, proc: 'hug', dur: frameCount('marina_pet') ? 0 : 1.4 }); _petNiko(); };

// ------------------------------------------------------------------ eating + Mommy redirects food
const _serve = serve;
serve = function (e) {
  _serve(e);
  const chew = setInterval(() => { if (e.state !== 'eat') return clearInterval(chew); Audio2.sfx('eat_chomp', { vol: 0.7 }); }, 650);
  setTimeout(() => clearInterval(chew), 6000);
};
serveMommy = function () {
  G.busy = true; mommy.dir = Math.sign(marina.x - mommy.x) || 1;
  say('m_hewe').then(() => say('mo_food_redirect', mommy)).then(() => {
    G.busy = false; const who = [daddy, rory].filter(x => x.here && x.state !== 'toilet');
    if (who.length) emit('star', who[0].x, who[0].y - 90, 5);
  });
};

// ------------------------------------------------------------------ Instagram on Mommy's phone
const REELS = ['catfart', 'trampoline', 'goat', 'cake', 'dog', 'bottle'];
const REEL_EMOJI = { catfart: ['🐱', '💨', '😲'], trampoline: ['🧒', '🤸', '💦'], goat: ['🐐', '😱', '📢'], cake: ['🎂', '🧒', '💥'], dog: ['🐶', '😎', '🕺'], bottle: ['🧢', '🍶', '🙌'] };
function askInsta() {
  if (G.busy) return; G.busy = true; mommy.dir = Math.sign(marina.x - mommy.x) || 1;
  say('m_insta').then(() => {
    const yes = chance(0.65);
    return say(yes ? 'mo_insta_yes' : 'mo_insta_no', mommy).then(() => {
      G.busy = false;
      if (yes) openReels(); else { marina.state = 'sad'; G.moodCtx = { type: 'refused_insta', who: mommy }; UI.pulseMoods(); setTimeout(() => marina.state === 'sad' && (marina.state = 'idle'), 2500); }
    });
  });
}
function openReels() {
  let idx = Math.floor(Math.random() * REELS.length), seen = 0, raf = 0, t0 = performance.now(), daddyCame = false;
  const p = document.getElementById('panel'); p.innerHTML = ''; p.classList.remove('hidden'); Audio2.Music.set('tv');
  const phone = document.createElement('div'); phone.className = 'phone';
  phone.innerHTML = '<div class="pscreen"><canvas width="128" height="128"></canvas><div class="pside"><span>❤️</span><span>💬</span><span>↗️</span></div><div class="pbar"><i></i></div></div>';
  const row = document.createElement('div'); row.className = 'row';
  const mk = (ico, fn) => { const b = document.createElement('button'); b.className = 'pbtn big'; b.textContent = ico; b.addEventListener('pointerup', e => { e.stopPropagation(); fn(); }); return b; };
  const close = () => { cancelAnimationFrame(raf); p.classList.add('hidden'); p.innerHTML = ''; setMusic(); };
  row.append(mk('❌', close), mk('⬆️', () => next()));
  p.append(phone, row);
  const cv = phone.querySelector('canvas'), x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  let sy = null; phone.addEventListener('pointerdown', e => sy = e.clientY); phone.addEventListener('pointerup', e => { if (sy != null && sy - e.clientY > 40) next(); sy = null; });
  function play() {
    t0 = performance.now(); Audio2.voice('reel_' + REELS[idx], 'reel');
    seen++;
    setTimeout(() => { if (!p.classList.contains('hidden')) say(pick(['m_laugh', 'm_laugh2', 'm_giggle'])); }, 2600);
    if (seen >= 3 && !daddyCame && !daddy.hidden && daddy.state !== 'toilet') {
      daddyCame = true;
      setTimeout(() => { if (p.classList.contains('hidden')) return; close(); daddy.room = G.room; daddy.x = clamp(marina.x + 50, 20, ROOMS[G.room].w - 20); daddy.dir = -1; daddy.state = 'idle';
        say(pick(['d_insta1', 'd_insta2']), daddy).then(() => { G.moodCtx = { type: 'tvOff', who: daddy }; UI.pulseMoods(); }); }, 5200);
    }
  }
  function next() { idx = (idx + 1) % REELS.length; Audio2.whoosh(true); play(); }
  function frame() {
    const name = REELS[idx], n = frameCount('reel_' + name), t = (performance.now() - t0) / 1000;
    x.fillStyle = '#111'; x.fillRect(0, 0, 128, 128);
    if (n) { const k = 'reel_' + name + '_' + (1 + Math.floor(t * 8) % n), c = spriteCanvas(k); if (c) x.drawImage(c, 0, 0, 128, 128); }
    else { const em = REEL_EMOJI[name]; x.fillStyle = `hsl(${(t * 60) % 360},70%,60%)`; x.fillRect(0, 0, 128, 128); x.font = '40px sans-serif'; x.textAlign = 'center';
      em.forEach((ch, i) => x.fillText(ch, 30 + i * 34, 70 + Math.sin(t * 6 + i) * 14)); }
    phone.querySelector('.pbar i').style.width = Math.min(100, (t / 7) * 100) + '%';
    raf = requestAnimationFrame(frame);
  }
  play(); frame();
}

// ------------------------------------------------------------------ random start + room picker
const START_ROOMS = ['living', 'kitchen', 'dining', 'playroom', 'foyer', 'yard'];
function startScenario(room) {
  room = room || pick(START_ROOMS);
  const W = ROOMS[room].w;
  G.room = room; marina.room = room; marina.x = W / 2; marina.y = FLOOR;
  // scatter the family
  const rooms = ['living', 'kitchen', 'dining', 'playroom'];
  daddy.room = chance(0.6) ? room : pick(rooms); mommy.room = chance(0.5) ? room : pick(rooms);
  if (room === 'yard') { if (chance(0.5)) daddy.room = 'yard'; mommy.room = chance(0.4) ? 'yard' : pick(rooms); }
  for (const e of [daddy, mommy]) { e.x = rnd(40, ROOMS[e.room].w - 40); e.y = rnd(156, 172); e.state = 'idle'; }
  niko.room = pick(rooms.concat(room === 'yard' ? [] : [room])); niko.x = rnd(40, ROOMS[niko.room].w - 40); niko.state = 'wander'; niko.perchY = null;
  E.camX = clamp(marina.x - E.viewW / 2, 0, Math.max(0, W - E.viewW));
  document.getElementById('weatherBtn').classList.toggle('hidden', room !== 'yard');
  setMusic();
  const events = [
    () => onEnterRoom(room),
    () => { niko.room = room; niko.x = clamp(marina.x + 60, 20, W - 20); Audio2.sfx('meow2'); UI.face('niko', 'happy', 1500); setTimeout(() => onEnterRoom(room), 1500); },
    () => { miles.crying = true; miles.cryT = 12; Audio2.sfx('baby_cry'); setTimeout(() => say('m_uhoh'), 800); },
    () => { G.rory = true; rory.hidden = false; rory.room = room === 'yard' ? 'yard' : room; rory.x = clamp(marina.x + 70, 20, W - 20); rory.state = 'idle'; Audio2.sfx('knock'); setTimeout(() => { say('r_hi', rory).then(() => say('m_hi_rory')); }, 700); },
    () => { if (room === 'yard') return onEnterRoom(room); daddy.room = room; daddy.x = clamp(marina.x + 70, 30, W - 30); daddy.state = 'lie'; emit('zzz', daddy.x, daddy.y - 30); setTimeout(() => say('m_giggle'), 900); },
    () => { addMess(room === 'yard' ? 'living' : room, 4); setTimeout(() => say(pick(['m_uhoh', 'm_giggle'])), 600); },
    () => { say(pick(['m_yay', 'm_happy', 'm_cooking'])); },
  ];
  setTimeout(() => pick(events)(), 700);
}
// replace the title "play" with a room picker
startGame = async function (room) {
  Audio2.init();
  document.getElementById('title').classList.add('hidden');
  resize(); startScenario(room);
  Audio2.preload(['m_hi_daddy', 'd_hi2', 'm_yay', 'm_hewe', 'm_made', 'd_nervous', 'm_notfair'].map(k => 'assets/vo/' + k + '.mp3'));
};
(function titleRooms() {
  const card = document.querySelector('.tcard'); if (!card) return;
  const play = document.getElementById('playBtn');
  const row = document.createElement('div'); row.className = 'troom';
  for (const r of ['living', 'kitchen', 'dining', 'playroom', 'foyer', 'yard']) {
    const b = document.createElement('button'); b.className = 'tr'; b.textContent = ROOMS[r].ico; b.setAttribute('aria-label', r);
    b.addEventListener('pointerup', e => { e.stopPropagation(); startGame(r); }); row.append(b);
  }
  play.textContent = '🎲'; play.setAttribute('aria-label', 'surprise me');
  card.append(row);
})();

// ------------------------------------------------------------------ per-frame hook
function featTick(dt) { animTick(); }

// ------------------------------------------------------------------ mix & match look (hats, wings, held items, face)
G.look = { head: null, face: null, back: null, hand: null };
let ACC_META = {}; // id -> {slot, anchor:[x,y]}
fetch('assets/acc.json').then(r => r.ok ? r.json() : {}).then(j => { ACC_META = j || {}; }).catch(() => {});
const EMOJI_LOOK = {
  head: [['e_crown', '👑'], ['e_bow', '🎀'], ['e_flower', '🌸'], ['e_tophat', '🎩'], ['e_cap', '🧢'], ['e_helmet', '⛑️']],
  face: [['e_shades', '🕶️'], ['e_mask', '🥸']],
  back: [['e_wings', '🪽']],
  hand: [['e_wand', '🪄'], ['e_balloon', '🎈'], ['e_teddy', '🧸'], ['e_flowers', '💐'], ['e_icecream', '🍦']],
};
function lookItems(slot) {
  const sprites = Object.keys(ACC_META).filter(id => ACC_META[id].slot === slot && has('acc_' + id)).map(id => ({ id, key: 'acc_' + id }));
  const emo = EMOJI_LOOK[slot].map(([id, ch]) => ({ id, emoji: ch }));
  return sprites.length >= 3 ? sprites.concat(slot === 'hand' ? emo.slice(2) : []) : sprites.concat(emo);
}
function lookAnchor(e, k, y, flip, S) {
  const b = visBox(k), dS = E.depth || 1, s = S * dS, d = flip ? -1 : 1;
  const top = y + b[1] * s, h = (b[3] - b[1]) * s, cx = e.x + ((b[0] + b[2]) / 2) * s * d;
  return { top, h, cx, d, s };
}
function drawAcc(id, ax, ay, flip, s) {
  if (id.startsWith('e_')) { const it = Object.values(EMOJI_LOOK).flat().find(x => x[0] === id); if (it) emoji(it[1], ax, ay, 11 * s); return; }
  const c = spriteCanvas('acc_' + id); if (!c) return; const m = ACC_META[id] || {}; const an = m.anchor || [16, 28];
  const ctx = E.ctx; ctx.save(); ctx.translate(Math.round(ax - E.camX), Math.round(ay)); ctx.scale((flip ? -1 : 1) * s * 0.9, s * 0.9); ctx.drawImage(c, -an[0], -an[1]); ctx.restore();
}
function drawLook(e, k, y, flip, S, layer) {
  if (!G.look) return; const L = G.look; if (!L.head && !L.face && !L.back && !L.hand) return;
  const a = lookAnchor(e, k, y, flip, S);
  if (layer === 'back') { if (L.back) drawAcc(L.back, a.cx - 5 * a.d * a.s, a.top + a.h * 0.42, flip, a.s); return; }
  if (L.face) drawAcc(L.face, a.cx + 3 * a.d * a.s, a.top + a.h * 0.2, flip, a.s);
  if (L.head) drawAcc(L.head, a.cx, a.top + (L.head.startsWith('e_') ? 2 : 3 * a.s), flip, a.s);
  if (L.hand) drawAcc(L.hand, a.cx + 11 * a.d * a.s, a.top + a.h * 0.6, flip, a.s);
}

// ------------------------------------------------------------------ room-to-room navigation
// Big exit signs at room edges showing where they lead; tapping one walks Marina out.
function exitSigns() {
  const R = ROOMS[G.room], out = [];
  if (R.left) out.push({ side: -1, to: R.left, x: Math.max(E.camX, 0) + 14 });
  if (R.right) out.push({ side: 1, to: R.right, x: Math.min(E.camX + E.viewW, R.w) - 14 });
  return out;
}
function drawExitSigns() {
  const b = Math.sin(E.t * 4) * 2;
  for (const s of exitSigns()) {
    const x = s.x + (s.side < 0 ? b : -b), y = 112;
    rect(x - 12, y - 13, 24, 26, 'rgba(43,35,64,.72)'); rect(x - 11, y - 12, 22, 24, 'rgba(255,255,255,.12)');
    emoji(ROOMS[s.to].ico, x, y - 4, 11); emoji(s.side < 0 ? '◀' : '▶', x, y + 8, 8);
  }
}
function exitSignHit(wx, wy) { for (const s of exitSigns()) if (Math.abs(wx - s.x) < 16 && wy > 96 && wy < 128) return s; return null; }
const _onTap = onTap;
onTap = function (px, py) {
  if (G.busy) return;
  const [wx, wy] = toWorld(px, py); const s = exitSignHit(wx, wy);
  if (s && !['bars', 'swing', 'tantrum'].includes(marina.state)) {
    UI.closeActions(); if (marina.state === 'perch') { marina.offY = 0; marina.state = 'idle'; }
    if (['sit', 'cheer', 'sad'].includes(marina.state)) marina.state = 'idle';
    const mover = marina.mount || marina; Audio2.blip(9, 'triangle', 0.05, 0.1);
    mover.walkTo(s.side < 0 ? 0 : ROOMS[G.room].w, null, marina.mount ? 75 : null, FLOOR); return;
  }
  return _onTap(px, py);
};
// slide the scene in from the side you entered, and pop the room's icon
const _changeRoom = changeRoom;
changeRoom = function (room, from, x) {
  const prev = G.room; _changeRoom(room, from, x);
  if (G.room === prev) return;
  const cv = E.cv, dx = from === 'left' ? 40 : from === 'right' ? -40 : 0;
  cv.animate([{ transform: `translateX(${dx}%)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1)' });
  UI.bigIcon(ROOMS[room].ico, 650);
};

// ------------------------------------------------------------------ isometric house map
let ISO = null;
fetch('assets/iso_house.json').then(r => r.ok ? r.json() : null).then(j => { ISO = j; }).catch(() => {});
function openIsoMap() {
  const p = document.getElementById('panel'); p.innerHTML = ''; p.classList.remove('hidden'); Audio2.jingle([0, 7, 12], 0.06);
  const top = el2('div', 'ptop'); top.append(btn('❌', () => p.classList.add('hidden')), el2('div', 'ttl', '🗺️'));
  const wrap = el2('div', 'isowrap'); const im = document.createElement('img'); im.src = 'assets/iso_house.png'; im.className = 'pix'; wrap.append(im);
  const W = ISO.width || 400, H = ISO.height || 300;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.classList.add('isosvg');
  const rooms = ISO.rooms || ISO;
  for (const [r, d] of Object.entries(rooms)) {
    if (!ROOMS[r] || !d.polygon) continue;
    const poly = document.createElementNS(svg.namespaceURI, 'polygon'); poly.setAttribute('points', d.polygon.map(q => q.join(',')).join(' '));
    poly.classList.add('isoroom'); if (r === G.room) poly.classList.add('here');
    poly.addEventListener('pointerup', e => { e.stopPropagation(); p.classList.add('hidden'); travelTo(r); });
    svg.append(poly);
    const c = d.door || centroid(d.polygon);
    const who = [[marina, '👧'], [daddy, '👨'], [mommy, '👩'], [rory, '🧔'], [niko, '🐱'], [miles, '👶']].filter(([e]) => e.room === r && (!e.hidden || e === marina) && !(e === rory && !G.rory)).map(x => x[1]).join('');
    const t = document.createElementNS(svg.namespaceURI, 'text'); t.setAttribute('x', c[0]); t.setAttribute('y', c[1]); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '15'); t.textContent = (who || ROOMS[r].ico) + (r === 'playroom' && G.poop ? '💩' : '') + (G.fort && G.fort.room === r ? '🏰' : '');
    t.style.pointerEvents = 'none'; svg.append(t);
  }
  wrap.append(svg); p.append(top, wrap);
}
function centroid(pts) { let x = 0, y = 0; for (const q of pts) { x += q[0]; y += q[1]; } return [x / pts.length, y / pts.length]; }
function travelTo(r) {
  if (r === G.room) return;
  if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair(); if (marina.state === 'bars') { clearInterval(G.barIv); G.mb = null; }
  if (['perch', 'swing', 'bars', 'sit', 'anim'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; marina.anim = null; }
  changeRoom(r, null, r === 'living' ? 300 : ROOMS[r].w / 2);
}
document.getElementById('mapBtn').addEventListener('pointerup', e => { if (!ISO) return; e.stopImmediatePropagation(); openIsoMap(); }, true);

// ------------------------------------------------------------------ action bubbles: backdrop to dismiss + highlight what was tapped
const _actions = UI.actions;
UI.actions = function (anchor, list) {
  _actions(anchor, list);
  document.querySelectorAll('.actback').forEach(n => n.remove());
  if (!list || !list.length) return;
  const bk = el2('div', 'actback'); document.getElementById('fx').prepend(bk);
  bk.addEventListener('pointerup', e => { e.stopPropagation(); UI.closeActions(); });
  if (anchor && anchor.x != null) emit('sparkle', anchor.x, (anchor.y || FLOOR) - 30, 6);
};
const _closeActions = UI.closeActions;
UI.closeActions = function () { _closeActions(); document.querySelectorAll('.actback').forEach(n => n.remove()); };

// ------------------------------------------------------------------ watchdog: never leave the game stuck
let busySince = 0;
const _featTick = featTick;
featTick = function (dt) {
  _featTick(dt);
  if (G.busy) { busySince += dt; if (busySince > 14) { G.busy = false; busySince = 0; } } else busySince = 0;
  if (marina.state === 'anim' && marina.anim && !marina.anim.loop && E.t - marina.anim.t0 > marina.anim.dur + 3) { marina.state = 'idle'; marina.anim = null; }
};

// ------------------------------------------------------------------ opening cupboards / fridge before cooking
const _propActions2 = propActions;
propActions = function (p) {
  const a = _propActions2(p);
  if (['stove', 'oven', 'sink', 'island', 'fridge', 'dresser', 'closet'].includes(p.a)) for (const act of a) {
    if (!['🗄️', '🍳', '🧺', '🧊', '❄️', '👗'].includes(act.ico)) continue;
    const fn = act.fn;
    act.fn = () => {
      marina.dir = Math.sign(p.x - marina.x) || marina.dir;
      playAnim('marina_reach', { fps: 10, dur: frameCount('marina_reach') ? 0 : 0.5 });
      G.cupOpen = { id: p.id, t0: E.t }; Audio2.sfx(p.a === 'fridge' ? 'door_open' : 'cupboard'); say('m_open');
      setTimeout(fn, 650); setTimeout(() => { if (G.cupOpen && G.cupOpen.id === p.id) G.cupOpen = null; }, 2500);
    };
  }
  return a;
};
const _drawProp = drawProp;
drawProp = function (p) {
  _drawProp(p);
  const o = G.cupOpen; if (!o || o.id !== p.id || p.id === 'fridge') return;
  const k = clamp((E.t - o.t0) / 0.3, 0, 1); let b;
  if (p.k.startsWith('p:')) b = [-p.w / 2, -p.h, p.w / 2, 0]; else b = visBox(p.k);
  const w = (b[2] - b[0]) * 0.45, h = Math.min(30, (b[3] - b[1]) * 0.55), x0 = p.x - w / 2, y0 = p.y - h - 2;
  rect(x0, y0, w, h, '#3a2a22'); rect(x0 + 2, y0 + h * 0.45, w - 4, 2, '#d8cfc2');
  for (let i = 0; i < 3; i++) emoji(['🥫', '🍯', '🥣', '🧂', '🍪'][(i + p.x) % 5], x0 + w * (0.2 + i * 0.3), y0 + h * 0.3, 7);
  rect(x0 - w * 0.5 * k, y0, w * 0.5 * k, h, '#f6f5f0'); rect(x0 + w, y0, w * 0.5 * k, h, '#f6f5f0');
  if (p.id === 'closet' || p.a === 'dresser') for (let i = 0; i < 3; i++) emoji(['👗', '👚', '👒'][i], x0 + w * (0.2 + i * 0.3), y0 + h * 0.7, 8);
};
