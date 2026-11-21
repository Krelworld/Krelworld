// Grown-ups react to what Marina is doing (proud, impressed, or stern about mess),
// and Marina sometimes says what she wants to do next with a button that takes her there.
Object.assign(SAY_ICON, {
  d_strong: '💪', mo_strong: '💪', r_strong: '🏆', d_brave: '🦁', mo_brave: '🦁', r_brave: '🦁', d_chef: '👨‍🍳', mo_chef: '👩‍🍳',
  d_artist: '🖼️', mo_artist: '🖼️', d_kind: '💛', mo_kind: '💛', d_helper: '👍', mo_helper: '👍', d_mess1: '😒', mo_mess1: '😒', d_mess2: '☝️', mo_mess2: '☝️', r_mess: '😬',
  d_music: '👏', mo_music: '🎶', r_music: '🎸', d_fort: '🏰', mo_fort: '🏰', r_fort: '🏰', d_style: '💃', mo_style: '😍', r_style: '😎', d_snowman: '⛄', mo_snowman: '⛄', d_swing: '🙌', mo_swing: '🙌',
  m_want_cook: '🍳', m_want_draw: '🖍️', m_want_fort: '⛺', m_want_dress: '👗', m_want_outside: '🌳', m_want_tv: '📺', m_want_niko: '🐈', m_want_gym: '🤸', m_should_tidy: '🧹', m_want_swing: '🛝', m_want_miles: '👶', m_want_music: '🎹',
});
const _lineMoodR = lineMood;
lineMood = function (key) {
  if (/^(d|mo)_mess\d$/.test(key)) return 'angry';
  if (key === 'r_mess') return 'surprised';
  if (/_(strong|brave|artist|music|fort|style|snowman|swing|kind|helper|chef)$/.test(key)) return 'happy';
  return _lineMoodR(key);
};

// ---------------------------------------------------------------- reactions
const REACT = {
  strong: { d: ['d_strong', 'd_amazing'], mo: ['mo_strong', 'mo_amazing'], r: ['r_strong'], cheer: true },
  brave: { d: ['d_brave'], mo: ['mo_brave'], r: ['r_brave'] },
  swing: { d: ['d_swing'], mo: ['mo_swing'], r: ['r_brave'] },
  chef: { d: ['d_chef'], mo: ['mo_chef'], r: ['r_amazing'] },
  artist: { d: ['d_artist', 'd_proud'], mo: ['mo_artist', 'mo_proud'], r: ['r_amazing'], cheer: true },
  kind: { d: ['d_kind'], mo: ['mo_kind'], r: ['r_good'], heart: true },
  helper: { d: ['d_helper', 'd_good_girl'], mo: ['mo_helper', 'mo_good'], r: ['r_good'], heart: true },
  music: { d: ['d_music'], mo: ['mo_music'], r: ['r_music'], cheer: true },
  fort: { d: ['d_fort'], mo: ['mo_fort'], r: ['r_fort'], cheer: true },
  style: { d: ['d_style'], mo: ['mo_style'], r: ['r_style'], heart: true },
  snowman: { d: ['d_snowman'], mo: ['mo_snowman'], r: ['r_amazing'], cheer: true },
};
let lastReact = -99, lastReactWho = null;
function watchers() { return [daddy, mommy, rory].filter(e => e.here && !e.hidden && !['toilet', 'lie'].includes(e.state) && !(e === rory && !G.rory)); }
function reactTo(kind, delay) {
  setTimeout(() => {
    const R = REACT[kind]; if (!R || E.t - lastReact < 6 || G.sceneOn) return;
    let ws = watchers(); if (!ws.length) return;
    if (ws.length > 1) ws = ws.filter(e => e !== lastReactWho);   // take turns
    const p = pick(ws), id = p === daddy ? 'd' : p === mommy ? 'mo' : 'r';
    lastReact = E.t; lastReactWho = p; p.dir = Math.sign(marina.x - p.x) || 1;
    if (R.cheer) Audio2.sfx('crowd_cheer', { vol: 0.3 });
    say(pick(R[id]), p).then(() => { if (R.heart || R.cheer) emit('heart', p.x, p.y - 90, R.cheer ? 6 : 3); });
  }, delay || 0);
}
// mess: the first toy tip is fine, then it gets sterner, then she's told to put them back
let messHeat = 0, messAt = -99;
function reactMess() {
  if (E.t - messAt > 45) messHeat = 0;
  messAt = E.t; messHeat++;
  if (messHeat < 2) return;
  setTimeout(() => {
    if (G.sceneOn || G.tidy || G.chase) return;
    const ps = parentsHere(), ro = watchers().includes(rory);
    if (!ps.length) { if (ro && E.t - lastReact > 6) { lastReact = E.t; rory.dir = Math.sign(marina.x - rory.x) || 1; say('r_mess', rory); } return; }
    if (E.t - lastReact < 2.5) { messHeat--; return; }
    const p = pick(ps), id = p === daddy ? 'd' : 'mo'; lastReact = E.t; p.dir = Math.sign(marina.x - p.x) || 1;
    if (messHeat === 2) { say(id + '_mess1', p); return; }
    G.lastTidyAsk = E.t; p.walkTo && p.walkTo(clamp(marina.x + (p.x < marina.x ? -34 : 34), 20, ROOMS[G.room].w - 20));
    say(id + '_mess2', p).then(() => { if (!G.busy && !G.tidy) UI.actions(marina, [A('🧹', () => startTidy()), A('🏃', () => startChase(p))]); });
  }, 900);
}

// hook the activities
// (top-level function declarations are also plain globals, so reassign them by name)
{
  const _drop = dropFromBars; dropFromBars = function (fin) { const on = marina.state === 'bars'; _drop(fin); if (on && fin) reactTo('strong', 1900); };
  const _yt = yardToy; yardToy = function (kind, p) { _yt(kind, p); if (kind === 'climb') reactTo('brave', 3200); else if (kind === 'saucer' || kind === 'belt') reactTo('swing', 3500); };
  const _jl = jumpLeaves; jumpLeaves = function () { _jl.apply(this, arguments); reactTo('brave', 3200); };
  const _bs = buildSnowman; buildSnowman = function () { const b = G.snowman; _bs(); if (b < 5 && G.snowman === 5) reactTo('snowman', 1800); };
  const _fd = finishDish; finishDish = function (d) { _fd(d); reactTo('chef', 2600); };
  const _so = soothe; soothe = function (k) { _so(k); reactTo('kind', 3200); };
  const _fn = feedNiko; feedNiko = function () { _fn(); reactTo('kind', 2400); };
  const _bp = binPoop; binPoop = function () { _bp(); reactTo('helper', 1500); };
  const _fp = flushPoop; flushPoop = function () { _fp(); reactTo('helper', 2600); };
  const _mm = makeMess; makeMess = function (p) { _mm(p); reactMess(); };
  const _ps = playSong; playSong = function (n) { _ps(n); reactTo('music', 3000); };
  const _pf = placeFort; placeFort = function (pieces, existing) { const r = _pf(pieces, existing); if (!existing) reactTo('fort', 1800); return r; };
}

// ---------------------------------------------------------------- wishes: "I want to…" + a button that goes there
function whenIn(room, fn) {
  if (G.room !== room) travelTo(room);
  let n = 0; const iv = setInterval(() => { if (++n > 80) return clearInterval(iv); if (G.room === room && !G.busy && !G.sliding) { clearInterval(iv); setTimeout(fn, 250); } }, 100);
}
function propGo(room, id) { whenIn(room, () => { const p = PROPS[room].find(q => q.id === id); if (!p) return; approach(p.x, () => UI.actions(p, propActions(p)), 0); }); }
const WISHES = {
  cook: { ico: '🍳', line: 'm_want_cook', go: () => whenIn('kitchen', () => approach(40, () => UI.openCook(), 20)) },
  draw: { ico: '🖍️', line: 'm_want_draw', go: () => Studio.open() },
  fort: { ico: '⛺', line: 'm_want_fort', ok: () => !G.fort, go: () => whenIn('living', () => startFort()) },
  dress: { ico: '👗', line: 'm_want_dress', go: () => UI.openDress() },
  outside: { ico: '🌳', line: 'm_want_outside', ok: () => G.room !== 'yard', go: () => travelTo('yard') },
  tv: { ico: '📺', line: 'm_want_tv', ok: () => !G.tv, go: () => propGo('living', 'tv') },
  niko: { ico: '🐈', line: 'm_want_niko', ok: () => niko.room !== G.room && niko.state !== 'held', go: () => { const r = niko.room; whenIn(r, () => approach(niko.x, () => UI.actions(niko, entActions(niko)), 14)); } },
  gym: { ico: '🤸', line: 'm_want_gym', go: () => gymMenu() },
  tidy: { ico: '🧹', line: 'm_should_tidy', ok: () => G.mess.filter(m => m.room === G.room).length >= 3 && !G.tidy, go: () => startTidy(true) },
  swing: { ico: '🛝', line: 'm_want_swing', ok: () => !G.weather || G.weather === 'sun', go: () => whenIn('yard', () => yardToy('saucer')) },
  miles: { ico: '👶', line: 'm_want_miles', go: () => whenIn(miles.room || 'living', () => approach(miles.x, () => UI.actions(miles, entActions(miles)), 14)) },
  music: { ico: '🎹', line: 'm_want_music', go: () => propGo('playroom', 'keys') },
};
let wishEl = null, wishTO = 0, lastWish = -99, lastWishKey = null;
function clearWish() { if (wishEl) { wishEl.remove(); wishEl = null; } clearTimeout(wishTO); }
function makeWish(key) {
  const ok = k => k !== lastWishKey && (!WISHES[k].ok || WISHES[k].ok());
  key = key && WISHES[key] ? key : pick(Object.keys(WISHES).filter(ok)); const w = WISHES[key]; if (!w) return;
  // tidying is the right thought when the room's a tip
  if (WISHES.tidy.ok() && chance(0.6)) return key === 'tidy' ? showWish('tidy') : makeWish('tidy');
  showWish(key);
}
function showWish(key) {
  const w = WISHES[key]; clearWish(); lastWish = E.t; lastWishKey = key;
  say(w.line);
  const b = document.createElement('button'); b.id = 'wishBtn'; b.setAttribute('aria-label', 'go'); b.innerHTML = '<span>' + w.ico + '</span><i>➡️</i>';
  let done = false;
  b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); if (done) return; done = true; clearWish(); UI.closeActions(); Audio2.jingle([0, 7, 12], 0.06);
    if (G.busy && !G.sceneOn) G.busy = false; try { w.go(); } catch (err) { console.warn('wish', key, err); } });
  b.addEventListener('pointerdown', e => e.stopPropagation());
  document.getElementById('stage').append(b); wishEl = b;
  wishTO = setTimeout(clearWish, 14000);
}
// game start: sometimes she arrives with a plan
const _startScenarioR = startScenario;
startScenario = function (room) {
  clearWish(); lastWish = E.t; messHeat = 0;
  const willWish = chance(0.3);
  _startScenarioR(room);
  if (willWish) setTimeout(() => { if (!G.busy && !G.sceneOn) makeWish(); }, 4200);
};
// later: when nothing has been touched for a while
let wishIdle = 0;
const _featTickR = featTick;
featTick = function (dt) {
  _featTickR(dt);
  wishIdle += dt; if (wishIdle < 2) return; wishIdle = 0;
  if (wishEl && (G.busy || !document.getElementById('panel').classList.contains('hidden'))) clearWish();
  if (wishEl || E.t - lastWish < 55 || E.t - lastInput < 22 || G.busy || G.sceneOn || G.tidy || G.chase || G.tv) return;
  if (!document.getElementById('panel').classList.contains('hidden') || (window.Studio && Studio.active) || document.querySelector('.act')) return;
  if (!['idle', 'walk'].includes(marina.state) || !document.getElementById('title').classList.contains('hidden')) return;
  makeWish();
};
(function css() { const s = document.createElement('style'); s.textContent =
  '#wishBtn{position:absolute;left:10px;bottom:84px;z-index:30;width:84px;height:84px;border-radius:50%;border:5px solid #fff;background:#7be07b;box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 6px rgba(123,224,123,.35);font-size:44px;display:flex;align-items:center;justify-content:center;padding:0;animation:pulse .6s ease-in-out infinite alternate;touch-action:manipulation}' +
  '#wishBtn i{position:absolute;right:-10px;bottom:-8px;font-size:26px;font-style:normal}' +
  '@media (orientation:landscape){#wishBtn{width:68px;height:68px;font-size:36px;bottom:78px}}' +
  '@media (orientation:portrait) and (min-height:150vw){#wishBtn{position:fixed;left:auto;right:16px;bottom:auto;top:calc(env(safe-area-inset-top) + var(--stageH) + 10px)}}';
  document.head.append(s); })();
