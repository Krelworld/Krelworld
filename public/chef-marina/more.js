// Title screen, jokes, waking Daddy, and Uncle Rory (always around, says "Hi niece Marina!", horseplay).
Object.assign(SAY_ICON, {
  m_knock: '🚪', m_europe: '🌍', m_poo: '💩', m_joke_house: '🏠', m_joke_house2: '🏠', m_joke: '😜', m_wake_daddy: '⏰', m_again: '🔁',
  d_whos_there: '❓', mo_whos_there: '❓', r_whos_there: '❓', d_europe_who: '❓', mo_europe_who: '❓', r_europe_who: '❓', d_why_house: '🤷', mo_why_house: '🤷', r_why_house: '🤷',
  d_joke1: '😂', d_joke2: '😂', d_joke_poo: '😂', mo_joke1: '😂', mo_joke2: '😂', mo_joke_poo: '😂', r_joke1: '😂', r_joke_poo: '😂',
  d_wake: '😳', d_wake2: '😴', d_wake3: '🥱', r_hi_niece: '👋', r_hi_niece2: '👋', r_hi_niece3: '👋', r_airplane: '✈️', r_tickle: '👹', r_again: '🔁', r_gotcha: '🙌',
});
const _lineMoodM = lineMood;
lineMood = function (key) {
  if (/_joke|hi_niece|airplane|tickle|again|gotcha|m_knock|m_europe|m_poo/.test(key)) return 'happy';
  if (/whos_there|europe_who|why_house|d_wake/.test(key)) return 'surprised';
  return _lineMoodM(key);
};
const idOf = e => e === daddy ? 'd' : e === mommy ? 'mo' : e === nunu ? 'nu' : e === jeff ? 'j' : 'r';
const sayW = (k, e) => Promise.race([say(k, e), new Promise(r => setTimeout(r, 9000))]);   // never hang a scene on a clip
const nap = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- jokes
let jokeN = Math.random() < 0.5 ? 0 : 1;
async function tellJoke(e) {
  if (G.busy) return; UI.closeActions(); G.busy = true; AI.hold(e, true); e.stop();
  const id = idOf(e); marina.dir = Math.sign(e.x - marina.x) || 1; e.dir = -marina.dir;
  try {
    if (jokeN++ % 2 === 0) {
      await sayW('m_knock'); Audio2.sfx('knock'); await sayW(id + '_whos_there', e);
      await sayW('m_europe'); await sayW(id + '_europe_who', e);
      marina.state = 'cheer'; Audio2.fart(); for (let i = 0; i < 6; i++) emit('heart', e.x + rnd(-14, 14), e.y - rnd(60, 95), 1, { ch: '💩', vx: rnd(-20, 20), vy: -30, life: 1.2, size: 12 });
      await sayW('m_poo');
      await sayW(id === 'nu' || id === 'j' ? id + '_joke_groan' : id + '_joke_poo', e);
    } else {
      await sayW('m_joke_house'); await sayW(id + '_why_house', e);
      marina.state = 'cheer'; emit('confetti', marina.x, marina.y - 60, 14);
      await sayW('m_joke_house2');
      await sayW(id === 'd' ? 'd_joke2' : id === 'mo' ? pick(['mo_joke1', 'mo_joke2']) : id === 'nu' || id === 'j' ? id + '_joke_laugh' : 'r_joke1', e);
    }
    emit('heart', e.x, e.y - 90, 5); Audio2.voice('m_joke_laugh', 'm');
  } catch (err) { console.warn('joke', err); }
  if (marina.state === 'cheer') marina.state = 'idle'; G.busy = false; AI.hold(e, false);
}

// ---------------------------------------------------------------- WAKE UP DADDY
let snoozed = false;
async function wakeUp(e) {
  if (G.busy) return; UI.closeActions(); G.busy = true; AI.hold(e, true);
  marina.dir = Math.sign(e.x - marina.x) || 1; marina.state = 'cheer';
  UI.bigIcon('⏰', 900); UI.flash && UI.flash(); for (let i = 0; i < 10; i++) emit('star', e.x + rnd(-20, 20), e.y - rnd(10, 40), 1);
  await sayW('m_wake_daddy');
  try {
    if (e === daddy && !snoozed && chance(0.4)) { snoozed = true; await sayW('d_wake2', e); emit('zzz', e.x, e.y - 30); Audio2.voice('m_giggle', 'm'); }
    else {
      snoozed = false; e.state = 'idle'; e.dir = Math.sign(marina.x - e.x) || 1; Audio2.jingle([12, 7, 12, 16], 0.07);
      let t = 0; const iv = setInterval(() => { t += 0.05; e.offY = -Math.abs(Math.sin(t * 9)) * 16 * Math.max(0, 1 - t); if (t >= 1) { clearInterval(iv); e.offY = 0; } }, 30);
      await sayW(e === daddy ? pick(['d_wake', 'd_wake3']) : 'r_wow', e); Audio2.voice('m_joke_laugh', 'm');
    }
  } catch (err) { console.warn('wake', err); }
  if (marina.state === 'cheer') marina.state = 'idle'; G.busy = false; AI.hold(e, false);
}

// ---------------------------------------------------------------- horseplay with Uncle Rory
let lastHorse = null;
async function horseplay(force) {
  if (G.busy || marina.mount) return; UI.closeActions(); G.busy = true; AI.hold(rory, true); rory.stop();
  const kind = typeof force === 'string' ? force : pick(['airplane', 'spin', 'tickle'].filter(k => k !== lastHorse)); lastHorse = kind;
  const W = ROOMS[G.room].w, y0 = marina.y; rory.dir = Math.sign(marina.x - rory.x) || 1; marina.dir = -rory.dir;
  const run = (dur, step) => new Promise(res => { let t = 0; const iv = setInterval(() => { t += 0.033; step(Math.min(1, t / dur), t); if (t >= dur) { clearInterval(iv); res(); } }, 33); });
  try {
    if (kind === 'airplane') {           // up over his head and zoomed round the room
      sayW('r_gotcha', rory); const mx = marina.x;
      await run(0.5, k => { marina.x = mx + (rory.x - mx) * k; marina.offY = -58 * k; }); marina.y = rory.y + 1; marina.state = 'cheer';
      sayW('r_airplane', rory); Audio2.whoosh(); const x0 = rory.x, span = Math.min(90, x0 - 30, W - 30 - x0);
      await run(3.4, (k, t) => { const nx = x0 + Math.sin(k * Math.PI * 4) * Math.max(30, span); rory.dir = marina.dir = nx > rory.x ? 1 : -1; rory.x = marina.x = nx; rory.state = 'walk'; marina.offY = -58 + Math.sin(t * 9) * 5; if (chance(0.2)) emit('star', marina.x, marina.y - 70 + marina.offY + 60, 1); if (chance(0.03)) Audio2.whoosh(); });
      rory.state = 'idle'; await run(0.4, k => { marina.offY = -58 * (1 - k); marina.x = rory.x + rory.dir * 26 * k; });
    } else if (kind === 'spin') {        // swung round and round by the hands
      sayW('r_gotcha', rory); const mx = marina.x; marina.state = 'cheer';
      await run(3.2, (k, t) => { const a = t * 7, r = 26; marina.x = rory.x + Math.cos(a) * r; marina.y = rory.y + (Math.sin(a) > 0 ? 1 : -1); marina.offY = -18 - Math.sin(k * Math.PI) * 14; marina.dir = Math.cos(a) > 0 ? 1 : -1; rory.dir = marina.dir; if (chance(0.25)) emit('sparkle', marina.x, marina.y - 40, 1); if (chance(0.05)) Audio2.whoosh(); });
      marina.x = clamp(mx, 20, W - 20);
    } else {                             // tickle monster
      await sayW('r_tickle', rory); const mx = marina.x; rory.x = clamp(marina.x - marina.dir * -20, 20, W - 20); Audio2.voice('m_tickle', 'm');
      await run(2.6, (k, t) => { marina.x = mx + Math.sin(t * 40) * 2; marina.squash = 1 + Math.sin(t * 20) * 0.06; rory.hugT = E.t + 0.2; if (chance(0.3)) emit('star', marina.x + rnd(-12, 12), marina.y - rnd(20, 60), 1); });
      marina.x = mx; marina.squash = 1; Audio2.voice('m_laugh', 'm');
    }
  } catch (err) { console.warn('horseplay', err); }
  marina.offY = 0; marina.y = y0; marina.state = 'idle'; rory.state = 'idle'; emit('heart', (marina.x + rory.x) / 2, marina.y - 70, 5);
  G.busy = false; AI.hold(rory, false);
  say('m_again').then(() => { if (!G.busy && rory.here) UI.actions(rory, [A('🔁', () => { say('r_again', rory); setTimeout(() => horseplay(), 1300); })]); });
}

const _entActionsM = entActions;
entActions = function (e) {
  const a = _entActionsM(e);
  if (marina.mount || marina.state === 'ride') {      // riding on someone: the only choices are getting down (and giddy-up on a horsey ride)
    const m = marina.mount; return [A('⬇️', stopActivity)].concat(m && m.state === 'horse' ? [A('🐴', () => { say('m_giddyup'); say(m === daddy ? 'd_horse' : 'r_horse', m); })] : []); }
  if (e === daddy || e === mommy || e === rory) {
    if (e.state === 'lie') a.unshift(A('⏰', () => wakeUp(e)));
    else { a.push(A('😜', () => tellJoke(e))); if (e === rory && !G.holding && marina.state !== 'ride') a.splice(1, 0, A('🤼', () => horseplay())); }
  }
  return a;
};

// ---------------------------------------------------------------- Uncle Rory is always visiting: mostly in the yard or by the dining table
const _startScenarioM = startScenario;
startScenario = function (room) {
  _startScenarioM(room);
  G.rory = true; rory.hidden = false; rory.state = 'idle';
  if (rory.room !== G.room) { rory.room = chance(0.5) ? 'yard' : 'dining'; rory.x = rory.room === 'dining' ? rnd(150, 290) : rnd(120, 420); rory.y = rnd(158, 172); }
};
const _personM = AI.person;
AI.person = function (e, dt) {
  if (e !== rory) return _personM.call(this, e, dt);
  if (e.hidden || this.held.has(e) || ['toilet', 'horse'].includes(e.state) || e === (G.chase && G.chase.who)) return;
  if (G.fort && G.fort.guests.includes(e)) return;
  e.wait = (e.wait || rnd(6, 12)) - dt; if (e.moving || e.wait > 0) return; e.wait = rnd(9, 18);
  if (e.state === 'lie') { if (chance(0.6)) return; e.state = 'idle'; }
  if (e.here && chance(0.4) && !G.busy && !marina.mount) { e.walkTo(marina.x + (e.x < marina.x ? -24 : 24), () => { e.dir = Math.sign(marina.x - e.x) || 1; say(pick(['r_giggle', 'r_hi_niece3', 'r_chase', 'r_hi_niece']), e); emit('star', marina.x, marina.y - 70, 4); }, 70); return; }
  const home = ['yard', 'dining'];
  if (chance(home.includes(e.room) ? 0.18 : 0.6)) {
    const to = chance(0.85) ? pick(home.filter(r => r !== e.room)) : pick(['kitchen', 'living', 'playroom'].filter(r => r !== e.room));
    const leave = () => { e.room = to; e.x = to === 'dining' ? rnd(150, 290) : rnd(60, ROOMS[to].w - 60); e.state = 'idle'; if (e.here && Math.abs(e.x - marina.x) < 40) e.x = clamp(marina.x + 80, 20, ROOMS[to].w - 20); };
    if (e.here) { const iL = ROOM_ORDER.indexOf(to) < ROOM_ORDER.indexOf(e.room); e.walkTo(iL ? 4 : ROOMS[e.room].w - 4, () => { leave(); if (e.here) onEnterRoomBy(e); }); }
    else { leave(); if (e.here) onEnterRoomBy(e); }
  } else e.walkTo(e.room === 'dining' ? rnd(140, 300) : rnd(40, ROOMS[e.room].w - 40), null, null, rnd(152, 176));
};

// ---------------------------------------------------------------- title screen
(function title() {
  const T = document.getElementById('title'), card = T.querySelector('.tcard'); if (!card) return;
  const cast = document.getElementById('titleCv'), bar = document.getElementById('loadbar');
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
  const leaves = mk('canvas', 'tleaves'), logo = mk('div', 'tlogo', '<span class="l1">Chef</span><span class="l2">Marina</span>');
  const play = mk('button', 'tplay', '<i></i>'); play.setAttribute('aria-label', 'play');
  const pickBox = mk('div', 'tpick hidden');
  for (const r of ['living', 'kitchen', 'dining', 'playroom', 'foyer', 'yard']) {
    const b = mk('button', 'tcardr', '<b>' + ROOMS[r].ico + '</b>'); b.setAttribute('aria-label', r); b.style.backgroundImage = 'url(assets/bg/' + (r === 'yard' ? 'yard_fall' : r) + '.png)';
    b.addEventListener('pointerup', e => { e.stopPropagation(); startGame(r); }); pickBox.append(b);
  }
  const dice = mk('button', 'tdice', '🎲'); dice.setAttribute('aria-label', 'surprise me'); dice.addEventListener('pointerup', e => { e.stopPropagation(); startGame(); }); pickBox.append(dice);
  T.append(leaves, logo, play, pickBox, cast, bar); card.style.display = 'none';   // the old card (and its button) stays, hidden
  const ready = setInterval(() => { if (typeof marina !== 'undefined') { clearInterval(ready); bar.remove(); T.classList.add('ready'); } }, 150);
  play.addEventListener('pointerup', () => {
    if (!T.classList.contains('ready')) return;
    try { Audio2.Music.mode = 'title'; Audio2.init(); Audio2.Music.set('title'); Audio2.jingle([0, 4, 7, 12], 0.06); } catch (e) { }
    T.classList.add('picking'); pickBox.classList.remove('hidden'); play.remove();
  });
  // autumn leaves drifting across the painting
  const L = []; let last = 0;
  function tick(ts) {
    if (T.classList.contains('hidden')) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    const w = leaves.clientWidth, h = leaves.clientHeight; if (leaves.width !== w || leaves.height !== h) { leaves.width = w; leaves.height = h; }
    const c = leaves.getContext('2d'); c.clearRect(0, 0, w, h);
    if (L.length < 34 && Math.random() < 0.2) L.push({ x: Math.random() * w * 1.2 - w * 0.2, y: -12, vx: 18 + Math.random() * 30, vy: 26 + Math.random() * 34, a: Math.random() * 6, s: 5 + Math.random() * 5, col: ['#e2732b', '#c9482a', '#f0b23c', '#a8401f'][Math.floor(Math.random() * 4)] });
    for (let i = L.length - 1; i >= 0; i--) { const l = L[i]; l.a += dt * 3; l.x += (l.vx + Math.sin(l.a) * 26) * dt; l.y += l.vy * dt; if (l.y > h + 12) { L.splice(i, 1); continue; }
      c.save(); c.translate(Math.round(l.x), Math.round(l.y)); c.rotate(Math.sin(l.a) * 0.9); c.fillStyle = l.col; c.fillRect(-l.s / 2, -l.s / 4, l.s, l.s / 2); c.fillRect(-l.s / 4, -l.s / 2, l.s / 2, l.s); c.restore(); }
  }
  requestAnimationFrame(tick);
  const s = document.createElement('style'); s.textContent = `
#title{flex-direction:column;justify-content:flex-start;overflow:hidden;font-family:'Lilita One','Arial Rounded MT Bold','Trebuchet MS',sans-serif}
#title::after{content:'';position:absolute;inset:0;background:linear-gradient(#0000 55%,rgba(30,14,40,.55));pointer-events:none}
.tleaves{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.tlogo{position:relative;z-index:2;margin-top:max(7vh,calc(env(safe-area-inset-top) + 18px));display:flex;flex-direction:column;align-items:center;line-height:.82;transform:rotate(-4deg);animation:tbob 3s ease-in-out infinite alternate;transition:transform .5s,margin .5s}
.tlogo span{color:#fff6dc;-webkit-text-stroke:.09em #7a2d1c;paint-order:stroke fill;text-shadow:0 .07em 0 #7a2d1c,0 .13em 0 rgba(0,0,0,.35);letter-spacing:.02em}
.tlogo .l1{font-size:min(15vw,13vh);color:#ffd35c;margin-right:1.6em}
.tlogo .l2{font-size:min(24vw,20vh)}
@keyframes tbob{to{transform:rotate(-2deg) translateY(6px)}}
.tplay{position:relative;z-index:3;margin-top:auto;margin-bottom:min(40vh,62vw);width:min(34vw,26vh);height:min(34vw,26vh);border-radius:50%;border:min(1.6vw,8px) solid #fff6dc;background:radial-gradient(circle at 35% 30%,#ffb84a,#f0732b 70%);box-shadow:0 min(2vw,10px) 0 #7a2d1c,0 0 0 min(3vw,14px) rgba(255,214,120,.28);opacity:0;transition:opacity .4s;animation:pulse .8s ease-in-out infinite alternate}
#title.ready .tplay{opacity:1}
.tplay i{display:block;margin:0 auto;width:0;height:0;border-left:min(11vw,8.5vh) solid #fff6dc;border-top:min(7vw,5.4vh) solid transparent;border-bottom:min(7vw,5.4vh) solid transparent;transform:translateX(14%);filter:drop-shadow(0 3px 0 rgba(122,45,28,.6))}
#titleCv{position:absolute;z-index:2;left:50%;bottom:calc(env(safe-area-inset-bottom) + 1vh);transform:translateX(-50%);width:min(92vw,62vh);height:auto;max-width:none;pointer-events:none;filter:drop-shadow(0 6px 0 rgba(0,0,0,.25));transition:opacity .4s}
#loadbar{position:absolute;z-index:3;left:50%;bottom:10px;transform:translateX(-50%);margin:0}
#title.picking .tlogo{transform:rotate(-3deg) scale(.62);margin-top:max(1vh,env(safe-area-inset-top));animation:none}
#title.picking #titleCv{opacity:0}
.tpick{position:relative;z-index:3;display:grid;grid-template-columns:repeat(2,1fr);gap:min(3vw,14px);width:min(88vw,430px);margin-top:1vh;animation:tin .35s ease-out}
@keyframes tin{from{opacity:0;transform:translateY(20px)}}
.tcardr{position:relative;aspect-ratio:16/10;border-radius:18px;border:5px solid #fff6dc;background-size:cover;background-position:center 70%;image-rendering:pixelated;box-shadow:0 6px 0 rgba(60,20,20,.55);padding:0}
.tcardr:active,.tdice:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(60,20,20,.55)}
.tcardr b{position:absolute;left:-8px;top:-10px;width:42px;height:42px;border-radius:50%;background:#fff6dc;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 rgba(60,20,20,.5);font-weight:400}
.tdice{grid-column:1/-1;justify-self:center;width:84px;height:84px;border-radius:50%;border:5px solid #fff6dc;background:radial-gradient(circle at 35% 30%,#ffb84a,#f0732b 70%);font-size:42px;box-shadow:0 6px 0 #7a2d1c;padding:0}
@media (orientation:landscape){
  .tlogo{margin-top:3vh;flex-direction:row;gap:.25em;align-items:baseline}.tlogo .l1{font-size:min(17vh,9vw);margin:0}.tlogo .l2{font-size:min(24vh,12vw)}
  .tplay{margin-bottom:auto;margin-top:auto}
  #titleCv{left:auto;right:2vw;transform:none;width:min(46vh,34vw)}
  #title.picking .tlogo{transform:rotate(-2deg) scale(.6);margin-top:0;margin-bottom:-2vh}
  .tpick{grid-template-columns:repeat(4,1fr);width:min(94vw,860px);gap:12px;margin-top:0}
  .tcardr{aspect-ratio:16/11}.tdice{grid-column:auto;align-self:center;width:72px;height:72px;font-size:36px}
}`; document.head.append(s);
})();
