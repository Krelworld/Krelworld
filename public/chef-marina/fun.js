// More reasons to play: a sticker book, family requests, hidden treasures, a family dinner,
// a tea party, bubble bath time in the shower, and outfits that stay on during hugs, eating and gymnastics.
(function () {
  const stage = document.getElementById('stage');
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const press = (n, fn) => { n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); fn(e); }); return n; };
  const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem('cm_' + k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) { } } };
  const hid = id => document.getElementById(id).classList.contains('hidden');
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const sayW = (k, e) => Promise.race([say(k, e), nap(9000)]);
  const ambient = () => typeof marina !== 'undefined' && hid('title') && hid('panel') && !(window.Studio && Studio.active) && !document.getElementById('storyBox') && !G.busy && !G.sceneOn && !G.tidy && !G.chase && !G.tv && !(G.fort && G.fort.inside) && !marina.mount && ['idle', 'walk', 'run'].includes(marina.state);
  Object.assign(SAY_ICON, { d_req_cook: '🍳', d_req_tidy: '🧹', d_req_story: '📖', mo_req_draw: '🖍️', mo_req_miles: '👶', mo_req_song: '🎹', mo_req_meal: '🍽️', r_req_gym: '🤸', r_req_joke: '😜', r_req_tea: '🫖',
    d_thanks: '🙏', mo_thanks: '🙏', r_thanks: '🙌', d_meal: '😋', mo_meal: '😋', r_meal: '😋', d_tea: '☕', mo_tea: '☕', r_tea: '☕', m_bath: '🛁', m_tea: '🫖', m_dinner: '🍽️', m_sticker: '⭐', m_found: '💎', m_clean: '✨' });
  const _lm = lineMood; lineMood = function (k) { return /_req_|_thanks|_meal|_tea|m_bath|m_dinner|m_sticker|m_found|m_clean/.test(k) ? 'happy' : _lm(k); };
  const drawLate = []; { const _dx = drawExitSigns; drawExitSigns = function () { _dx(); for (const f of drawLate) try { f(); } catch (e) { if (!drawLate.warned) { drawLate.warned = 1; console.warn('drawLate', e); } } }; }

  // ================================================================ sticker book
  const STK = [['cook', '🍳'], ['gross', '🤢'], ['serve', '🍽️'], ['meal', '🍝'], ['draw', '🖍️'], ['hang', '🖼️'], ['gift', '🎁'], ['fort', '⛺'], ['dress', '👗'], ['story', '📖'], ['bars', '🐒'], ['swing', '🛝'],
    ['leaves', '🍂'], ['yard', '🍁'], ['snowman', '⛄'], ['bottle', '🍼'], ['nappy', '🧷'], ['niko', '🐈'], ['feedniko', '🥫'], ['poop', '💩'], ['tidy', '🧹'], ['joke', '😜'], ['wake', '⏰'], ['horse', '🤼'],
    ['gym', '🤸'], ['song', '🎹'], ['tv', '📺'], ['ride', '🐴'], ['bath', '🛁'], ['tea', '🫖'], ['secret', '💎'], ['secretall', '👑'], ['helper', '⭐'], ['superhelper', '🏆']];
  let owned = store.get('stickers', []);
  function award(id) {
    const s = STK.find(x => x[0] === id); if (!s || owned.includes(id)) return;
    owned.push(id); store.set('stickers', owned);
    const t = mk('div', 'stk-toast', '<span>' + s[1] + '</span>'); stage.append(t); setTimeout(() => t.remove(), 2300);
    Audio2.jingle([0, 4, 7, 12, 16, 19], 0.07, 'triangle'); try { chip('sparkle'); } catch (e) { }
    if (typeof marina !== 'undefined') emit('star', marina.x, marina.y - 70, 8);
    if (!G.busy && chance(0.5)) setTimeout(() => { if (!G.busy) say('m_sticker'); }, 900);
    if (owned.length === STK.length) setTimeout(() => emit('confetti', marina.x, marina.y - 80, 60), 600);
  }
  function openBook() {
    if (document.getElementById('stkBox')) return; if (typeof UI !== 'undefined') UI.closeActions();
    const box = mk('div', ''); box.id = 'stkBox'; box.addEventListener('pointerdown', e => e.stopPropagation()); box.addEventListener('pointerup', e => e.stopPropagation());
    const grid = mk('div', 'stk-grid');
    STK.forEach(([id, ch], i) => { const got = owned.includes(id), c = mk('div', 'stk' + (got ? ' got' : ''), got ? ch : '❔'); c.style.setProperty('--r', ((i * 37) % 13 - 6) + 'deg'); if (got) press(c, () => { c.animate([{ transform: 'scale(1.35) rotate(8deg)' }, { transform: 'none' }], 300); Audio2.blip(pick([0, 4, 7, 12]), 'triangle', 0.1); }); grid.append(c); });
    const found = SECRETS.filter(s => s.found).length;
    box.append(press(mk('button', 'st-x', '✖️'), () => box.remove()), mk('div', 'stk-h', '📒 <b>' + owned.length + '</b> / ' + STK.length + ' &nbsp; 💎 ' + found + ' / ' + SECRETS.length), grid);
    (hid('title') ? stage : document.getElementById('title')).append(box); try { chip('pop'); } catch (e) { }
  }
  const book = mk('button', 'hud off', '📒'); book.id = 'bookBtn'; book.setAttribute('aria-label', 'sticker book'); press(book, () => { if (!G.busy) openBook(); }); stage.append(book);
  setInterval(() => { const d = document.getElementById('dressBtn'); if (d) book.classList.toggle('off', d.classList.contains('off')); }, 250);
  const tb = mk('button', 'tbook', '📒'); tb.setAttribute('aria-label', 'sticker book'); press(tb, openBook); document.getElementById('title').append(tb);

  // ================================================================ "did it" events: stickers + finishing a request
  let req = null, reqEl = null, lastReq = 0;
  function did(ev) {
    award(ev);
    if (req && req.ev === ev && !req.done) { req.done = true; const r = req; (async () => {
      await nap(r.after || 2500); for (let i = 0; i < 60 && G.busy; i++) await nap(500);
      clearReq(); const e = r.ent; if (e && e.here && !e.hidden && e !== niko) { e.dir = Math.sign(marina.x - e.x) || 1; await sayW((e === daddy ? 'd' : e === mommy ? 'mo' : 'r') + '_thanks', e); emit('heart', e.x, e.y - 90, 8); }
      else if (e === niko && niko.here) { Audio2.sfx('purr'); UI.face('niko', 'happy', 1800); emit('heart', niko.x, niko.y - 30, 6); }
      emit('star', marina.x, marina.y - 70, 12); const n = store.get('helped', 0) + 1; store.set('helped', n); award('helper'); if (n >= 5) award('superhelper');
    })(); }
  }
  window.did = did; window.award = award; window.openStickers = openBook;
  const hook = (name, ev, test) => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { const r = f.apply(this, arguments); try { const e = typeof ev === 'function' ? ev.apply(this, arguments) : ev; if (e && (!test || test.apply(this, arguments))) [].concat(e).forEach(did); } catch (x) { } return r; }; };
  // (top-level functions are plain globals, and callers look them up by name, so wrapping them here is enough)
  hook('finishDish', 'cook'); hook('grossOutcome', 'gross'); hook('serve', 'serve'); hook('serveMommy', 'serve'); hook('jumpLeaves', 'leaves'); hook('yardCleared', 'yard');
  hook('soothe', k => k === 'bottle' ? ['bottle', 'cuddle'] : 'cuddle'); hook('petNiko', 'niko'); hook('feedNiko', 'feedniko'); hook('binPoop', 'poop'); hook('flushPoop', 'poop'); hook('startTidy', 'tidy');
  hook('tellJoke', 'joke'); hook('wakeUp', 'wake'); hook('horseplay', 'horse'); hook('doGym', 'gym'); hook('tvOn', 'tv'); hook('mount', 'ride');
  hook('reactTo', k => ({ artist: 'draw', fort: 'fort', style: 'dress', strong: 'bars', swing: 'swing', snowman: 'snowman', music: 'song' })[k]);

  // ================================================================ family requests
  const REQS = [
    { who: 'daddy', line: 'd_req_cook', ico: '🍳', ev: 'cook', go: () => WISHES.cook.go() },
    { who: 'daddy', line: 'd_req_tidy', ico: '🧹', ev: 'tidy', ok: () => G.mess.filter(m => m.room === G.room).length >= 3, go: () => startTidy(true), after: 1500 },
    { who: 'daddy', line: 'd_req_story', ico: '📖', ev: 'story', go: () => whenIn('living', () => openStory()) },
    { who: 'mommy', line: 'mo_req_draw', ico: '🖍️', ev: 'draw', go: () => Studio.open() },
    { who: 'mommy', line: 'mo_req_miles', ico: '👶', ev: 'cuddle', go: () => WISHES.miles.go(), after: 6500 },
    { who: 'mommy', line: 'mo_req_song', ico: '🎹', ev: 'song', go: () => WISHES.music.go(), after: 4000 },
    { who: 'mommy', line: 'mo_req_meal', ico: '🍽️', ev: 'meal', go: () => whenIn('dining', familyMeal), after: 1200 },
    { who: 'rory', line: 'r_req_gym', ico: '🤸', ev: 'gym', go: () => gymMenu(), after: 3500 },
    { who: 'rory', line: 'r_req_joke', ico: '😜', ev: 'joke', go: () => tellJoke(rory), after: 15000 },
    { who: 'rory', line: 'r_req_tea', ico: '🫖', ev: 'tea', go: () => whenIn('playroom', teaParty), after: 1200 },
    { who: 'niko', ico: '🥫', ev: 'feedniko', go: () => whenIn('kitchen', () => feedNiko()), after: 3000 },
  ];
  function clearReq() { if (reqEl) { reqEl.remove(); reqEl = null; } req = null; }
  function askReq(r) {
    clearReq(); const e = { daddy, mommy, rory, niko }[r.who]; req = { ...r, ent: e, t: E.t }; lastReq = E.t; lastWish = E.t;
    e.dir = Math.sign(marina.x - e.x) || 1;
    if (r.line) say(r.line, e); else { Audio2.sfx(pick(['trill1', 'trill2'])); UI.face('niko', 'happy', 1800); UI.bubble(niko, '🥫', 2400); }
    const b = mk('button', '', '<span>' + r.ico + '</span><i>➡️</i><b>' + ({ daddy: '👨‍🦲', mommy: '👩', rory: '🧔', niko: '🐈' })[r.who] + '</b>'); b.id = 'reqBtn'; b.setAttribute('aria-label', 'help ' + r.who);
    press(b, () => { if (G.busy && G.sceneOn) return; b.remove(); reqEl = null; G.busy = false; UI.closeActions(); Audio2.jingle([0, 7, 12], 0.06); try { r.go(); } catch (x) { console.warn('req', x); } });
    stage.append(b); reqEl = b; const mine = req; setTimeout(() => { if (reqEl === b) { b.remove(); reqEl = null; } }, 25000); setTimeout(() => { if (req === mine && !mine.done) req = null; }, 150000);
  }
  window.askRequest = k => askReq(REQS.find(r => r.ev === k) || pick(REQS));
  let rt = 0; const _ft = featTick;
  featTick = function (dt) {
    _ft(dt); rt += dt; if (rt < 2) return; rt = 0;
    if (reqEl && (G.busy || !hid('panel'))) { reqEl.remove(); reqEl = null; }
    if (req || wishEl || !ambient() || E.t - lastReq < 85 || E.t < 40 || E.t - lastInput < 6 || document.querySelector('.act,.alertb,.pichint')) return;
    const here = e => e.here && !e.hidden && !['toilet', 'lie'].includes(e.state);
    const ok = REQS.filter(r => { const e = { daddy, mommy, rory, niko }[r.who]; return here(e) && (r.who !== 'niko' || niko.state !== 'held') && (!r.ok || r.ok()) && r.ev !== (askReq.last || ''); });
    if (!ok.length) { lastReq = E.t - 60; return; }
    const r = pick(ok); askReq.last = r.ev; askReq(r);
  };

  // ================================================================ hidden treasures (a new set of hiding places every time)
  const TREASURE = ['💎', '🦄', '🐚', '🪙', '🌟', '🔑', '🍬', '🎀', '🦕', '🧚'];
  const SECRETS = [];
  (function hide() {
    const all = []; for (const room in PROPS) for (const p of PROPS[room]) if (!p.nohit && p.a && !['door', 'tv', 'crib', 'bouncer', 'leafpile', 'blower'].includes(p.a) && !p.fallOnly && !p.snowOnly) all.push({ room, p });
    all.sort(() => Math.random() - 0.5); const rooms = {};
    for (const c of all) { if (SECRETS.length >= 5) break; if ((rooms[c.room] || 0) >= 1 && Object.keys(rooms).length < 5) continue; rooms[c.room] = (rooms[c.room] || 0) + 1; SECRETS.push({ ...c, ch: TREASURE[(Math.random() * TREASURE.length) | 0], found: false }); }
  })();
  const _pa = propActions;
  propActions = function (p) {
    const a = _pa(p), s = SECRETS.find(x => x.p === p && !x.found);
    if (s && typeof marina !== 'undefined' && hid('title') && s.room === G.room && !G.busy) { s.found = true; setTimeout(() => {
      Audio2.jingle([0, 5, 9, 12, 17, 21], 0.08, 'triangle'); emit('heart', p.x, p.y - 30, 1, { ch: s.ch, vx: 0, vy: -26, life: 2.4, size: 20 }); emit('sparkle', p.x, p.y - 30, 20); emit('confetti', p.x, p.y - 40, 16);
      UI.bigIcon(s.ch + '✨', 1300); say('m_found'); did('secret'); if (SECRETS.every(x => x.found)) setTimeout(() => { did('secretall'); emit('confetti', marina.x, marina.y - 80, 50); }, 1500); }, 150); }
    if (p.a === 'table' && p.id === 'table') a.unshift(A('🍽️', familyMeal));
    if (p.a === 'kidtable') a.unshift(A('🫖', teaParty));
    if (p.a === 'shower') a.unshift(A('🛁', () => bathTime(p)));
    return a;
  };
  setInterval(() => { if (typeof marina === 'undefined' || !hid('title')) return; for (const s of SECRETS) if (!s.found && s.room === G.room && Math.abs(s.p.x - marina.x) < 60 && Math.random() < 0.5) emit('sparkle', s.p.x + rnd(-10, 10), s.p.y - rnd(10, 44), 1); }, 600);

  // ================================================================ family dinner
  let meal = null;
  async function familyMeal() {
    if (G.busy || G.room !== 'dining') return; UI.closeActions(); G.busy = true;
    const t = PROPS.dining.find(p => p.id === 'table'), eaters = [daddy, mommy, rory], xs = [t.x - 52, t.x + 50, t.x + 76], dish = G.holding && G.holding.type === 'dish' ? G.holding.dish : null;
    try {
      G.rory = true; eaters.forEach((e, i) => { AI.hold(e, true); e.stop(); e.hidden = false; e.room = 'dining'; e.state = 'idle'; e.x = xs[i]; e.y = t.y - 2 - (i === 2 ? 6 : 0); e.dir = i === 0 ? 1 : -1; e.holdingMiles = false; emit('sparkle', e.x, e.y - 50, 6); });
      marina.stop(); marina.x = t.x - 26; marina.y = t.y + 16; marina.dir = 1; marina.offY = 0; marina.state = 'cheer';
      meal = { t, dish, n: 0 }; if (dish) { G.holding = null; did('serve'); }
      Audio2.sfx('oven_ding'); await sayW('m_dinner'); marina.state = 'idle';
      for (let i = 0; i < 3; i++) { const e = eaters[i]; meal.n = i + 1; Audio2.sfx('eat_chomp'); if (e !== mommy) e.state = 'eat'; e.hugT = E.t + 2; emit('heart', e.x, e.y - 90, 3);
        await sayW((e === daddy ? 'd' : e === mommy ? 'mo' : 'r') + '_meal', e); e.state = 'idle'; }
      marina.state = 'cheer'; emit('confetti', t.x, t.y - 60, 30); Audio2.jingle([0, 4, 7, 12, 16], 0.08); Audio2.voice('m_yummy', 'm'); await nap(1500);
    } catch (x) { console.warn('meal', x); }
    meal = null; marina.state = 'idle'; eaters.forEach(e => { e.state = 'idle'; AI.hold(e, false); }); G.busy = false; did('meal');
  }
  drawLate.push(() => { if (!meal || G.room !== 'dining') return; const t = meal.t, y = t.y - (t.h || 34) - 2; const d0 = E.depth; E.depth = 1;
    ['🍝', '🥗', '🍞'].forEach((ch, i) => emoji(meal.n > i && Math.sin(E.t * 10) > 0.6 ? '🍴' : ch, t.x - 4 + i * 20, y, 9));
    if (meal.dish) drawSprite('dish_' + meal.dish.art, t.x + 16, y - 6, { scale: 0.6, opt: meal.dish.tint ? { tint: meal.dish.tint } : null }); else emoji('🎂', t.x + 16, y - 11, 10); E.depth = d0; });

  // ================================================================ tea party
  let tea = null;
  async function teaParty() {
    if (G.busy || G.room !== 'playroom') return; UI.closeActions(); G.busy = true;
    const t = PROPS.playroom.find(p => p.a === 'kidtable'), W = ROOMS.playroom.w;
    const grown = (req && req.ev === 'tea' ? [rory] : []).concat([mommy, daddy, rory].filter(e => e.here && !e.hidden && !['toilet', 'lie'].includes(e.state)))[0] || null;
    try {
      if (grown) { AI.hold(grown, true); grown.stop(); grown.hidden = false; grown.room = 'playroom'; grown.state = 'idle'; grown.x = clamp(t.x + 84, 20, W - 20); grown.y = t.y + 8; grown.dir = -1; }
      if (niko.state !== 'held') { niko.room = 'playroom'; niko.stop && niko.stop(); niko.x = clamp(t.x - 52, 16, W - 16); niko.y = FLOOR; niko.perchY = null; niko.state = 'sit'; niko.t = 14; niko.dir = 1; }
      marina.stop(); marina.x = t.x + 36; marina.y = t.y + 14; marina.dir = -1; marina.offY = 0; tea = { t, cups: 0, pour: true };
      Audio2.jingle([7, 9.5, 12, 14.5, 12, 9.5, 7], 0.11, 'triangle'); await sayW('m_tea');
      for (let i = 1; i <= 3; i++) { tea.cups = i; Audio2.blip(pick([12, 16, 19]), 'sine', 0.2, 0.15); emit('sparkle', t.x - 22 + (i - 1) * 22, t.y - 40, 4); await nap(550); }
      tea.pour = false; Audio2.sfx(pick(['trill1', 'trill3'])); UI.face('niko', 'happy', 1500); emit('heart', niko.x, niko.y - 30, 3); await nap(700);
      if (grown) await sayW((grown === daddy ? 'd' : grown === mommy ? 'mo' : 'r') + '_tea', grown); else await nap(900);
      tea.sip = true; for (let i = 0; i < 3; i++) { Audio2.blip(pick([0, 4, 7]), 'triangle', 0.08, 0.12); await nap(380); }
      marina.state = 'cheer'; emit('heart', t.x, t.y - 60, 10); Audio2.voice('m_yummy', 'm'); await nap(1400);
    } catch (x) { console.warn('tea', x); }
    tea = null; marina.state = 'idle'; if (grown) AI.hold(grown, false); if (niko.state === 'sit') niko.state = 'wander'; G.busy = false; did('tea');
  }
  drawLate.push(() => { if (!tea || G.room !== 'playroom') return; const t = tea.t, y = t.y - 34, d0 = E.depth; E.depth = 1, b = tea.sip ? Math.sin(E.t * 9) * 1.5 : 0;
    emoji('🧸', t.x - 26, y - 4 + b, 14); emoji('🦄', t.x + 2, y - 6 - b, 13);
    for (let i = 0; i < tea.cups; i++) emoji('☕', t.x - 22 + i * 20, y + 8, 7); emoji('🧁', t.x - 2, y + 9, 6);
    if (tea.pour) emoji('🫖', marina.x - 22, marina.y - 46 + Math.sin(E.t * 8) * 2, 11); E.depth = d0; });

  // ================================================================ bubble bath time (in the shower)
  let bath = null;
  function bathTime(p) {
    if (G.busy) return; UI.closeActions(); G.busy = true;
    marina.stop(); marina.x = p.x; marina.y = FLOOR - 6; marina.offY = 0; marina.dir = -1; marina.state = 'cheer'; bath = { p, t0: E.t };
    say('m_bath'); Audio2.sfx('sink'); Audio2.jingle([0, 2.5, 5, 9.5, 12], 0.1, 'triangle');
    const bub = (n, x) => { for (let i = 0; i < n; i++) emit('heart', (x || p.x) + rnd(-26, 26), FLOOR - rnd(10, 70), 1, { ch: pick(['🫧', '🫧', '🫧', '🦆', '⭐']), vx: rnd(-14, 14), vy: rnd(-34, -14), life: rnd(1.2, 2.2), size: rnd(7, 13) }); };
    const iv = setInterval(() => { if (!bath) return clearInterval(iv); for (let i = 0; i < 4; i++) emit('water', p.x + rnd(-20, 20), 48 + rnd(0, 10)); bub(2); if (chance(0.12)) Audio2.sfx('sink', { vol: 0.5 }); }, 120);
    const tapMore = e => { if (!bath) return; const r = stage.getBoundingClientRect(), [wx] = toWorld(e.clientX - r.left, e.clientY - r.top); bub(8, wx); Audio2.blip(pick([12, 14.5, 17, 19, 24]), 'sine', 0.12, 0.14); if (chance(0.3)) Audio2.voice('m_giggle', 'm'); };
    stage.addEventListener('pointerdown', tapMore);
    setTimeout(() => { bath = null; stage.removeEventListener('pointerdown', tapMore); marina.y = FLOOR; marina.x = p.x - 34; emit('sparkle', marina.x, marina.y - 40, 26); Audio2.jingle([0, 4, 7, 12, 16], 0.08); say('m_clean');
      setTimeout(() => { if (marina.state === 'cheer') marina.state = 'idle'; }, 1400); G.busy = false; did('bath'); if (window.reactTo) reactTo('helper', 1600); }, 7500);
  }
  drawLate.push(() => { if (!bath || G.room !== 'bathroom') return; const d0 = E.depth; E.depth = 1; for (let i = 0; i < 5; i++) emoji('🫧', marina.x - 10 + i * 5 + Math.sin(E.t * 3 + i) * 1.5, marina.y - 74 - (i % 2) * 5, 8 + (i % 2) * 3);
    for (let i = 0; i < 7; i++) emoji('🫧', bath.p.x - 26 + i * 9, FLOOR - 8 - Math.abs(Math.sin(E.t * 2 + i)) * 6, 12); E.depth = d0; });

  // ================================================================ outfits stay on for hugs, eating and gymnastics
  const KEEP = ['marina_feed', 'marina_cuddle_baby', 'marina_hang'];
  const _playAnim = playAnim;
  playAnim = function (base, o = {}) {
    if (G.outfit !== 'default' && typeof base === 'string' && base.startsWith('marina_') && !KEEP.includes(base)) {
      const alt = 'o_' + G.outfit + base.slice(6);
      if (frameCount(alt)) return _playAnim(alt, { ...o, dur: o.dur || 0 });
      return _playAnim('no_such_anim', { ...o, proc: o.proc || 'hug', dur: o.dur || 1.2 });   // no drawn version: her outfit sprite does the move itself
    }
    return _playAnim(base, o);
  };

  const st = document.createElement('style'); st.textContent = `
#bookBtn{top:auto;left:auto;right:10px;bottom:82px;width:64px;height:64px;line-height:64px;font-size:34px;background:#fff3b0;border:3px solid #fff;border-radius:22px;transition:opacity .2s}
#bookBtn.off{opacity:0;pointer-events:none}
.stk-toast{position:absolute;left:50%;top:38%;z-index:40;pointer-events:none;animation:stkpop 2.3s ease-in-out forwards}
.stk-toast span{display:flex;align-items:center;justify-content:center;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:#fff;border:6px solid #ffcf4a;font-size:68px;box-shadow:0 0 0 8px rgba(255,207,74,.35),0 8px 0 rgba(0,0,0,.25)}
@keyframes stkpop{0%{transform:scale(0) rotate(-40deg);opacity:0}15%{transform:scale(1.25) rotate(8deg);opacity:1}28%{transform:scale(1) rotate(0)}70%{transform:scale(1) rotate(0);opacity:1}100%{transform:translate(42vw,34vh) scale(.15);opacity:0}}
#stkBox{position:fixed;inset:0;z-index:45;background:radial-gradient(circle at 50% 30%,#ffe9a8,#f3b65a);display:flex;flex-direction:column;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top) + 12px) 18px 20px;overflow:auto;font-family:'Lilita One','Arial Rounded MT Bold',sans-serif}
#title #stkBox{position:fixed}
.stk-h{font-size:26px;color:#7a2d1c;margin-top:6px}.stk-h b{font-size:34px}
.stk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:8px;width:min(100%,640px)}
.stk{aspect-ratio:1;border-radius:16px;background:rgba(255,255,255,.35);border:3px dashed rgba(122,45,28,.3);display:flex;align-items:center;justify-content:center;font-size:26px;opacity:.55;filter:grayscale(1)}
.stk.got{background:#fff;border:3px solid #fff;opacity:1;filter:none;font-size:36px;transform:rotate(var(--r));box-shadow:0 4px 0 rgba(122,45,28,.3)}
#reqBtn{position:absolute;left:104px;bottom:12px;z-index:30;width:84px;height:84px;border-radius:50%;border:5px solid #fff;background:#6ec3ff;box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 6px rgba(110,195,255,.35);font-size:44px;display:flex;align-items:center;justify-content:center;padding:0;animation:pulse .6s ease-in-out infinite alternate;touch-action:manipulation}
#reqBtn i{position:absolute;right:-10px;bottom:-8px;font-size:26px;font-style:normal}#reqBtn b{position:absolute;left:-10px;top:-12px;font-size:30px;font-weight:400}
.tbook{position:absolute;z-index:3;right:6vw;bottom:calc(env(safe-area-inset-bottom) + 3vh + min(26vw,104px) + 16px);width:min(20vw,80px);height:min(20vw,80px);border-radius:22px;border:5px solid #fff6dc;background:#fff3b0;box-shadow:0 6px 0 rgba(60,20,20,.55);padding:0;font-size:38px;opacity:0;transition:opacity .4s}
#title.ready .tbook{opacity:1}
@media (orientation:portrait) and (min-height:150vw){#reqBtn{position:fixed;left:auto;right:16px;bottom:auto;top:calc(env(safe-area-inset-top) + var(--stageH) + 10px)}}
@media (orientation:landscape){#bookBtn{right:144px;bottom:8px;width:58px;height:58px;line-height:58px;font-size:30px}#reqBtn{width:68px;height:68px;font-size:36px;bottom:8px}.tbook{right:auto;left:calc(4vw + min(22vh,100px) + 16px);bottom:8vh;width:min(18vh,80px);height:min(18vh,80px)}}`;
  document.head.append(st);
})();
