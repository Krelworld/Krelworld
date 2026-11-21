// Chef Marina — scenes: dynamic mood exchanges, cuddle/kiss pair animations, bouncy climbing, longer TV shows, more reels

Object.assign(SAY_ICON, {
  m_kiss: '😘', m_blowkiss: '😘💨', m_grouphug: '🤗🤗', m_highfive: '🙌', m_tickle: '🤣', m_dance: '💃🎶', m_spin: '🌀', m_again: '🔁', m_joke_laugh: '🤣', m_breathe: '😮‍💨', m_snack: '🍪❓', m_sorry: '🥺', m_hmph: '😤', m_niko_love: '🐱💖', m_nite: '🌙',
  d_kiss: '😘', d_caughtkiss: '🫴💖', d_highfive: '🙌', d_tickle: '👹🤣', d_dance: '🕺', d_spin: '🌀', d_joke: '🍌🩺', d_breathe: '🎂😮‍💨', d_snack: '🍪❓', d_yourturn: '👉👩', d_fromyou: '🤷👉', d_pretend_tantrum: '😭🤪', d_grumpyface: '😠😜', d_better: '🤗', d_grouphug: '🤗🤗',
  mo_kiss: '😘', mo_caughtkiss: '🫴💖', mo_lap: '🤗♿', mo_dance: '💃', mo_breathe: '😮‍💨', mo_snack: '🍪❓', mo_yourturn: '👉👨', mo_fromyou: '🤷👉', mo_wait: '⏳🙂', mo_sillyface: '🤪', mo_better: '😊', mo_grouphug: '🤗🤗',
  r_highfive: '🙌💥', r_bearhug: '🐻🤗', r_dance: '🕺', r_sillyface: '🤪', r_better: '😊',
});
const chip = n => Audio2.sfx('chip_' + n, { vol: 0.7 });

// ================================================================== climbing: no more walking in mid-air, bouncier hops
function squashTo(v, ms) { marina.squash = v; setTimeout(() => { marina.squash = 1; }, ms); }
function hopDown(cb) {
  if (marina.hopping) return; marina.hopping = true; marina.stop();
  const y0 = marina.offY, x0 = marina.x, dx = marina.dir * 14, T = 0.36; let t = 0; chip('jump'); Audio2.whoosh(false);
  const iv = setInterval(() => {
    t += 0.03; const k = Math.min(1, t / T);
    marina.offY = y0 * (1 - k * k) - Math.sin(k * Math.PI) * 10; marina.x = clamp(x0 + dx * k, 8, ROOMS[G.room].w - 8); marina.rot = Math.sin(k * Math.PI) * 0.15 * marina.dir;
    if (k >= 1) { clearInterval(iv); marina.offY = 0; marina.rot = 0; marina.state = 'idle'; marina.hopping = false; squashTo(0.8, 130); emit('dust', marina.x, marina.y, 6); chip('land'); cb && cb(); }
  }, 30);
}
getDown = function () { if (marina.state !== 'perch' && marina.offY === 0) return; hopDown(); };
climbOn = function (p) {
  approach(p.x, () => {
    G.busy = true; marina.stop(); const top = (p.climb || 120) - FLOOR, T = 0.42; let t = -0.16; squashTo(0.82, 150); chip('climb');
    const iv = setInterval(() => {
      t += 0.03; if (t < 0) return; const k = Math.min(1, t / T);
      marina.offY = top * k - Math.sin(k * Math.PI) * 18;
      if (k >= 1) { clearInterval(iv); marina.offY = top; marina.state = 'perch'; marina.perchProp = p; G.busy = false; squashTo(0.85, 120); emit('dust', marina.x, marina.y + top, 4); chip('land'); afterClimb(); }
    }, 30);
  }, 0);
};
// any walk that starts while she is up on something begins with a hop down
const _walkTo = Ent.prototype.walkTo;
Ent.prototype.walkTo = function (x, cb, speed, ty) {
  if (this === marina && this.offY < -2 && !['bars', 'swing', 'ride', 'anim', 'pair'].includes(this.state) && !this.hopping) {
    this.dir = Math.sign(x - this.x) || this.dir; return hopDown(() => _walkTo.call(this, x, cb, speed, ty));
  }
  if (this === marina && this.hopping) return;
  return _walkTo.call(this, x, cb, speed, ty);
};
const _changeRoomS = changeRoom;
changeRoom = function (room, from, x) { if (marina.offY < 0 && !['bars', 'swing'].includes(marina.state)) { marina.offY = 0; marina.rot = 0; if (marina.state === 'perch') marina.state = 'idle'; } return _changeRoomS(room, from, x); };

// ================================================================== pair animations (two characters drawn as one composite)
let PAIRS = {};
fetch('assets/pairs.json').then(r => r.ok ? r.json() : {}).then(j => { PAIRS = j || {}; }).catch(() => {});
const hasPair = n => frameCount(n) > 0;
// returns a promise; falls back to a simple squeeze if the art doesn't exist
function pair(name, other, { dur = 0, fps = 8, hearts = true } = {}) {
  return new Promise(res => {
    if (!hasPair(name)) { other.hugT = E.t + 1.6; playAnim('marina_hug', { fps: 7, proc: 'hug', dur: frameCount('marina_hug') ? 0 : 1.6 }); if (hearts) emit('heart', (marina.x + other.x) / 2, marina.y - 60, 6); return setTimeout(res, 1700); }
    const n = frameCount(name); dur = dur || Math.max(1.6, n / fps * 2);
    marina.stop(); other.stop && other.stop(); marina.state = 'pair'; other.pairHide = true;
    marina.pair = { name, n, fps, t0: E.t, dur, other, x: (marina.x + other.x) / 2, y: Math.max(marina.y, other.y || FLOOR), left: marina.x <= other.x };
    const hv = hearts ? setInterval(() => emit('heart', marina.pair ? marina.pair.x + rnd(-14, 14) : marina.x, marina.y - 70, 1), 260) : 0;
    setTimeout(() => { clearInterval(hv); other.pairHide = false; if (marina.state === 'pair') marina.state = 'idle'; marina.pair = null; res(); }, dur * 1000);
  });
}
function drawPair() {
  const p = marina.pair; if (!p) return; const t = E.t - p.t0, loops = Math.floor(t * p.fps);
  const i = 1 + (loops < p.n ? loops : p.n - 1 - ((loops - p.n) % Math.max(1, p.n - 3)) % p.n); // play through, then gently loop the last few frames
  const meta = PAIRS[p.name] || {}, flip = (meta.marina_side || 'left') === 'left' ? !p.left : p.left;
  drawSprite(p.name + '_' + clamp(i, 1, p.n), p.x, p.y + 2, { flip });
}
const _drawEnt = drawEnt;
drawEnt = function (e) { if (e.pairHide) return; if (e === marina && marina.state === 'pair') return drawPair(); if (e.danceT > E.t && e !== marina) { const s = E.depth; E.depth = s * (1 + Math.sin(E.t * 12) * 0.04); e.dir = Math.sin(E.t * 4) > 0 ? 1 : -1; _drawEnt(e); E.depth = s; return; } return _drawEnt(e); };

// ================================================================== mood scenes
const here = e => e.here && !['toilet'].includes(e.state) && !(e === rory && !G.rory);
const awake = e => here(e) && e.state !== 'lie';
const face = (e) => { e.dir = Math.sign(marina.x - e.x) || 1; };
const come = (e, gap = 24) => new Promise(r => { AI.hold(e, true); if (e.state === 'sit') { e.state = 'idle'; } e.walkTo(marina.x + (e.x < marina.x ? -gap : gap), () => { face(e); r(); }, 85, marina.y); setTimeout(r, 4000); });
const goTo = (e, gap = 24) => new Promise(r => { approach(e.x, r, gap); setTimeout(r, 4000); });
const PX = e => e === daddy ? 'd' : e === mommy ? 'mo' : 'r';
let lastScene = '';
function chooseScene(list) { const ok = list.filter(s => s[1]); let c = ok.filter(s => s[0] !== lastScene); if (!c.length) c = ok; const s = pick(c); lastScene = s[0]; return s[2]; }
async function runScene(fn) { if (G.sceneOn) return; G.sceneOn = true; G.busy = true; try { await fn(); } catch (e) { console.warn('scene', e); } G.busy = false; G.sceneOn = false; for (const e of [daddy, mommy, rory]) AI.hold(e, false); if (['cheer', 'sad', 'stomp'].includes(marina.state)) marina.state = 'idle'; }

const _setMood = setMood;
setMood = function (m) {
  const ctx = G.moodCtx;
  if (G.sceneOn) return;
  if ((ctx && ctx.type === 'refused') || G.chase) return _setMood(m);
  if (G.busy && marina.state !== 'tantrum') return;
  if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair();
  if (marina.offY < 0 && marina.state === 'perch') { marina.offY = 0; marina.state = 'idle'; }
  UI.unpulseMoods(); UI.closeActions(); G.mood = m; UI.markMood(m); G.moodCtx = null; chip(m);
  const d = awake(daddy), mo = awake(mommy), r = awake(rory), nk = niko.here && niko.state !== 'held', mi = miles.here && !mommy.holdingMiles;
  const who = nearestFamily(), grown = [daddy, mommy, rory].filter(awake);
  if (m === 'love') return runScene(chooseScene([
    ['hugkiss', !!who, async () => { await goTo(who); chip('hug'); await pair('pair_hug_' + who.id, who); await say('m_wuv_' + who.id); await say(who === daddy ? 'd_love' : who === mommy ? 'mo_love' : 'r_love', who); if (who !== rory) { chip('kiss'); await pair('pair_kiss_' + who.id, who, { dur: 1.6 }); say('m_kiss'); await say(PX(who) + '_kiss', who); } }],
    ['blowkiss', !!who, async () => { face(who); marina.dir = -who.dir; marina.state = 'cheer'; await say('m_blowkiss'); chip('kiss'); const k = { type: 'heart', x: marina.x, y: marina.y - 60 }; emit('heart', marina.x, marina.y - 60, 1, { ch: '😘', vx: (who.x - marina.x) / 1.2, vy: -8, life: 1.2, size: 13 }); await sleep(1100); emit('heart', who.x, who.y - 80, 6); await say(who === rory ? 'r_love' : PX(who) + '_caughtkiss', who); }],
    ['group', d && mo, async () => { await say('m_grouphug'); await Promise.all([come(daddy, 22), come(mommy, 30)]); chip('hug'); say('d_grouphug', daddy); if (hasPair('pair_group')) { mommy.pairHide = true; await pair('pair_group', daddy, { dur: 3 }); mommy.pairHide = false; } else await pair('pair_hug_daddy', daddy); await say('mo_grouphug', mommy); emit('heart', marina.x, marina.y - 80, 12); }],
    ['bear', r, async () => { await goTo(rory); await say('r_bearhug', rory); chip('hug'); await pair('pair_hug_rory', rory, { dur: 2.6 }); await say('m_wuv_rory'); await say('r_love', rory); }],
    ['niko', nk, async () => { niko.stop(); niko.state = 'wander'; niko.perchY = null; niko.t = 12; niko.y = FLOOR; await goTo(niko, 14); chip('hug'); Audio2.sfx('purr'); UI.face('niko', 'happy', 1800); await pair('pair_hug_niko', niko, { dur: 2.4 }); await say('m_niko_love'); }],
    ['miles', mi, async () => { await goTo(miles, 12); chip('kiss'); await pair('pair_kiss_miles', miles, { dur: 2.2 }); miles.crying = false; miles.happyT = 4; Audio2.sfx('baby_coo'); UI.face('miles', 'happy', 2000); await say('m_wuv_miles'); if (mo) await say('mo_miles', mommy); }],
    ['alone', !who && !nk && !mi, async () => { marina.state = 'cheer'; emit('heart', marina.x, marina.y - 70, 10); await say('m_happy'); }],
  ]));
  if (m === 'happy') return runScene(chooseScene([
    ['dance', true, async () => { Audio2.Music.set('gym'); marina.state = 'cheer'; await say('m_dance'); const iv = setInterval(() => emit('note', marina.x + rnd(-30, 30), marina.y - 70), 200);
      for (const e of grown) { face(e); e.danceT = E.t + 4; } if (who) say(PX(who) + '_dance', who);
      if (mo && hasPair('pair_dance_mommy')) { await goTo(mommy, 26); await pair('pair_dance_mommy', mommy, { dur: 3.2, hearts: false }); } else { playAnim('marina_starjump', { fps: 11, proc: 'starjump', dur: frameCount('marina_starjump') ? 0 : 1.2 }); await sleep(3200); }
      clearInterval(iv); setMusic(); chip('cheer'); emit('confetti', marina.x, marina.y - 60, 30); await say('m_yay'); }],
    ['highfive', d || r, async () => { const e = d && (!r || chance(0.5)) ? daddy : rory; await goTo(e); await say('m_highfive'); chip('highfive'); await pair('pair_highfive_' + e.id, e, { dur: 1.5, hearts: false }); emit('star', (marina.x + e.x) / 2, marina.y - 80, 8); await say(PX(e) + '_highfive', e); say('m_giggle'); }],
    ['spin', d, async () => { await goTo(daddy); await say('m_spin'); say('d_spin', daddy); chip('magic'); await pair('pair_spin_daddy', daddy, { dur: 3, fps: 10, hearts: false }); await say('m_again'); }],
    ['tickle', d, async () => { await come(daddy); await say('d_tickle', daddy); chip('tickle'); const p = pair('pair_tickle_daddy', daddy, { dur: 2.8, hearts: false }); await say('m_tickle'); await p; emit('star', marina.x, marina.y - 60, 6); }],
    ['silly', mo || r, async () => { const e = mo && (!r || chance(0.5)) ? mommy : rory; face(e); e.face = '🤪'; await say(PX(e) + '_sillyface', e); e.face = null; marina.state = 'cheer'; await say(pick(['m_giggle', 'm_laugh'])); }],
    ['joke', d, async () => { face(daddy); await say('d_joke', daddy); chip('pop'); await say('m_joke_laugh'); }],
    ['cheer', !who, async () => { marina.state = 'cheer'; emit('star', marina.x, marina.y - 70, 8); await say(pick(['m_yay', 'm_happy', 'm_giggle'])); }],
  ]));
  if (m === 'sad') return runScene(chooseScene([
    ['comfort', !!who, async () => { marina.state = 'sad'; await say(pick(['m_sad', 'm_cry'])); await come(who); await say(who === daddy ? pick(['d_comfort', 'd_comfort2']) : who === mommy ? 'mo_comfort' : pick(['r_comfort', 'r_comfort2']), who);
      chip('hug'); if (who === mommy) { say('mo_lap', mommy); await pair('pair_hug_mommy', mommy, { dur: 3 }); } else if (who === daddy) await pair(hasPair('pair_lap_daddy') ? 'pair_lap_daddy' : 'pair_hug_daddy', daddy, { dur: 3 }); else await pair('pair_hug_rory', rory, { dur: 2.6 });
      await say('m_cuddle'); await say(PX(who) + '_better', who); }],
    ['niko', nk || niko.room === G.room, async () => { marina.state = 'sad'; await say('m_sad'); niko.state = 'wander'; niko.perchY = null; niko.y = FLOOR; niko.t = 12; await new Promise(r => { niko.walkTo(marina.x + 16, r, 70, marina.y); setTimeout(r, 3500); }); Audio2.sfx('purr'); UI.face('niko', 'happy', 2000); chip('hug'); await pair('pair_hug_niko', niko, { dur: 2.4 }); await say('m_niko_love'); }],
    ['joke', d, async () => { marina.state = 'sad'; await say('m_sad'); await come(daddy); await say('d_joke', daddy); marina.state = 'idle'; chip('pop'); await say('m_joke_laugh'); await say('d_better', daddy); }],
    ['silly', mo || r, async () => { const e = mo ? mommy : rory; marina.state = 'sad'; await say('m_cry'); await come(e); e.face = '🤪'; await say(PX(e) + '_sillyface', e); e.face = null; marina.state = 'idle'; await say('m_giggle'); await say(PX(e) + '_better', e); }],
    ['alone', !who && !nk, async () => { marina.state = 'sad'; await say(pick(['m_sad', 'm_cry'])); await sleep(1500); }],
  ]));
  if (m === 'angry') return runScene(chooseScene([
    ['stern', d || mo, async () => { const e = d && (!mo || chance(0.5)) ? daddy : mommy; stomp(); await say(ctx && ctx.type === 'tvOff' ? 'm_notbrainrot' : pick(['m_angry', 'm_notfair'])); face(e); await say(PX(e) + pick(['_hey', '_appropriate']), e); await say('m_hmph'); }],
    ['breathe', !!who, async () => { stomp(); await say('m_angry'); await come(who); await say(who === rory ? 'r_tantrum' : PX(who) + '_breathe', who); marina.state = 'idle'; squashTo(1.12, 900); await say('m_breathe'); chip('happy'); await say(PX(who) + '_better', who); }],
    ['grumpy', d, async () => { stomp(); await say('m_angry'); face(daddy); daddy.face = '😠'; await say('d_grumpyface', daddy); daddy.face = '😜'; chip('pop'); await say('m_giggle'); daddy.face = null; }],
    ['snack', d || mo, async () => { const e = d && (!mo || chance(0.5)) ? daddy : mommy; stomp(); await say('m_notfair'); face(e); await say(PX(e) + '_snack', e); await say('m_snack'); emit('heart', marina.x, marina.y - 70, 1, { ch: '🍪', vy: -10, vx: 0, life: 1.6, size: 14 }); chip('yes'); }],
    ['fromyou', d && mo, async () => { stomp(); await say('m_notfair'); face(daddy); face(mommy); daddy.dir = Math.sign(mommy.x - daddy.x) || 1; await say('d_fromyou', daddy); mommy.dir = -daddy.dir; await say('mo_fromyou', mommy); await say('m_hmph'); }],
    ['alone', !who, async () => { stomp(); await say(pick(['m_angry', 'm_notfair'])); if (nk) { Audio2.sfx('meow1', { rate: 1.3 }); UI.face('niko', 'surprised', 1200); niko.state = 'flee'; niko.walkTo(niko.x > marina.x ? ROOMS[G.room].w - 10 : 10, () => { niko.state = 'wander'; }, 120); } }],
  ]));
  // tantrum: the floor-kicking classic, with a different family reaction each time
  return runScene(async () => {
    const t = tantrum(false); await sleep(2400); G.busy = true;
    const kind = chooseScene([['scold', d || mo, 'scold'], ['turns', d && mo, 'turns'], ['pretend', d, 'pretend'], ['wait', mo, 'wait'], ['rory', r, 'rory'], ['none', !who, 'none']]);
    let bed = false, early = false;
    if (kind === 'scold') { const e = d && (!mo || chance(0.5)) ? daddy : mommy; face(e); const k = PX(e) + pick(['_hey', '_appropriate', '_bedtime']); bed = k.endsWith('bedtime'); await say(k, e); }
    else if (kind === 'turns') { daddy.dir = Math.sign(mommy.x - daddy.x) || 1; mommy.dir = -daddy.dir; await say('d_yourturn', daddy); await say('mo_yourturn', mommy); face(mommy); await say('mo_wait', mommy); }
    else if (kind === 'pretend') { await come(daddy, 34); daddy.state = 'lie'; say('d_pretend_tantrum', daddy); const iv = setInterval(() => emit('tear', daddy.x, daddy.y - 14, 3, { vy: rnd(-120, -70) }), 150); await sleep(2600); clearInterval(iv); daddy.state = 'idle'; early = true; }
    else if (kind === 'wait') { face(mommy); await say('mo_wait', mommy); }
    else if (kind === 'rory') { await come(rory); await say('r_tantrum', rory); early = true; }
    await t; G.busy = true; marina.state = 'idle';
    if (early) { chip('pop'); await say(kind === 'pretend' ? 'm_joke_laugh' : 'm_breathe'); }
    if (bed) { G.busy = false; setTimeout(bedtimeNight, 900); return; }
    if (who && chance(0.6)) { await say('m_sorry'); chip('hug'); await come(who); await pair(who === mommy ? 'pair_hug_mommy' : who === daddy ? 'pair_hug_daddy' : 'pair_hug_rory', who, { dur: 2.2 }); await say(PX(who) + '_better', who); }
  });
};
// cuddle button on a person now uses the full pair animations too
cuddle = function (e) { runScene(async () => { await goTo(e); chip('hug'); await pair('pair_hug_' + e.id, e, { dur: 2.6 }); await say('m_wuv_' + e.id); await say(e === daddy ? pick(['d_love', 'd_cuddle']) : e === mommy ? pick(['mo_love', 'mo_cuddle']) : 'r_love', e); if (e !== rory && chance(0.6)) { chip('kiss'); await pair('pair_kiss_' + e.id, e, { dur: 1.6 }); say('m_kiss'); await say(PX(e) + '_kiss', e); } }); };

// ================================================================== TV: more shows, longer episodes, grumbling parents
const SHOW_ICON = { tasha: '👸', fish: '🐠', banana: '🍌', melon: '🍉', egg: '🥚', potty: '🚽', slime: '🫧', prank: '📢', llama: '🦙' };
const LEGACY_TV = { fish: ['tv_bro', 'tv_bruh', 'tv_dude'], banana: ['tv_cartoon', 'tv_cartoon2'] };
function showList() { const s = Object.keys(E.A).map(k => (k.match(/^tvshow_([a-z]+)_a_1$/) || [])[1]).filter(Boolean); for (const k of ['fish', 'banana']) if (!s.includes(k)) s.unshift(k); return [...new Set(s)]; }
async function playTVClip() {
  if (!G.tv || G.room !== 'living') return 3;
  const show = G.tv, n = 1 + (G.tvClip++ % 4); G.tvScene = G.tvClip % 2 ? 'a' : 'b';
  let key = 'tvs_' + show + '_' + n, buf = await Audio2.load('assets/vo/' + key + '.mp3');
  if (!buf && LEGACY_TV[show]) { key = pick(LEGACY_TV[show]); buf = await Audio2.load('assets/vo/' + key + '.mp3'); }
  if (!buf) { Audio2.jingle([12, 7, 12, 14, 12, 7], 0.12); return 2.5; }
  if (G.tv !== show) return 0.2; Audio2.chain([key], 'tv', 0.6); return buf.duration + 0.25;
}
tvOn = function (ch) {
  if (ch === 'cartoon') ch = 'banana';
  tvOff(true); G.tv = ch; G.tvClip = 0; G.tvScene = 'a'; setMusic(); say('m_tv');
  const loop = async () => { if (G.tv !== ch) return; const d = await playTVClip(); if (G.tv === ch) G.tvIv = setTimeout(loop, d * 1000); };
  G.tvIv = setTimeout(loop, 1200);
  marina.walkTo(clamp(PROPS.living.find(p => p.id === 'tv').x + 40, 20, ROOMS.living.w - 20), () => { marina.state = 'sit'; marina.dir = -1; });
  // parents get steadily more annoyed, then somebody snaps
  G.tvGr = setInterval(() => { if (!G.tv || G.room !== 'living') return; const ps = [daddy, mommy, rory].filter(awake); if (!ps.length) return; const e = pick(ps); UI.bubble(e, pick(['🙉', '😤', '🤦', '😵‍💫', '🙄']), 1500); if (e === rory && chance(0.3)) say('r_tv', rory); }, 6000);
  G.tvT = setTimeout(tvInterrupt, rnd(24, 38) * 1000);
};
const _tvOff = tvOff;
tvOff = function (quiet) { try { Audio2.chain([], 'tv'); } catch (e) { } clearTimeout(G.tvIv); clearInterval(G.tvGr); clearTimeout(G.tvT); if (quiet) { G.tv = null; return; } _tvOff(); clearTimeout(G.tvIv); };
drawTV = function (p) {
  rect(p.x - 40, p.y - 46, 80, 46, '#0c0c0e'); rect(p.x - 38, p.y - 44, 76, 40, '#141418');
  if (!G.tv) return;
  const base = 'tvshow_' + G.tv + '_' + (G.tvScene || 'a'), n = frameCount(base), ctx = E.ctx;
  ctx.save(); ctx.beginPath(); ctx.rect(p.x - 38 - E.camX, p.y - 44, 76, 40); ctx.clip();
  if (n) { const c = spriteCanvas(base + '_' + (1 + Math.floor(E.t * 8) % n)); ctx.drawImage(c, Math.round(p.x - 38 - E.camX), p.y - 46, 76, 44); }
  else { const img = G.tv === 'fish' ? 'tv_fish' : 'tv_cartoon', jig = Math.sin(E.t * 20) * 2; drawSprite(has(img) ? img : 'tv_cartoon', p.x + jig, p.y - 2 + Math.abs(jig), { scale: 0.8 }); if (!LEGACY_TV[G.tv]) emoji(SHOW_ICON[G.tv] || '📺', p.x, p.y - 24 + Math.sin(E.t * 10) * 4, 22); }
  if (chance(0.12)) { ctx.fillStyle = `hsla(${(E.t * 300) % 360},90%,60%,.2)`; ctx.fillRect(p.x - 38 - E.camX, p.y - 44, 76, 40); }
  ctx.restore(); if (chance(0.05)) emit('note', p.x + rnd(-30, 30), p.y - 20);
};
const _propActionsS = propActions;
propActions = function (p) {
  if (p.a === 'tv' || p.a === 'fireplace') { const a = showList().map(s => A(SHOW_ICON[s] || '📺', () => tvOn(s))); if (G.tv) a.unshift(A('⏻', () => tvOff())); return a; }
  return _propActionsS(p);
};

// ================================================================== reels: pick up every reel in the art, safer audio, longer scrolling before Daddy appears
const _openReels = openReels;
openReels = function () { for (const k of Object.keys(E.A)) { const m = k.match(/^reel_([a-z]+)_1$/); if (m && !REELS.includes(m[1])) REELS.push(m[1]); } REELS.sort(() => Math.random() - 0.5); _openReels(); };
