// Chef Marina — Nunu (Marina's grandmother, who lives in the basement) and Grandpa Jeff (the handyman in the backyard).
// Nunu: hugs, stories, Lego, movie nights, jokes — but no food. Now and then she notices "a smell" in the basement.
// Grandpa Jeff: builds things (builder.js), eats what Marina cooks (with all the usual consequences), high fives, juggles his tools.
const sayG = (k, e) => Promise.race([say(k, e), new Promise(r => setTimeout(r, 9000))]);
const GRAND = (() => {
  const NU = 'hi1 hi2 hi3 hi4 love1 love2 love3 love4 hug kiss proud smell1 smell2 smell3 septic1 septic2 septic3 septic_thanks lego_start lego_idea lego_nice1 lego_nice2 lego_done lego_oops movie_start movie_funny movie_scary movie_sweet movie_end popcorn tv_on story draw draw_nice pic nofood nofood2 joke_laugh joke_groan whos_there europe_who why_house fort bye comfort clutter wash night dance giggle wow play_yes cat peekaboo hoop tidy deer sweep1 sweep2 laundry1 laundry2 laundry3 clean1 clean2 help help_thanks lotr1 lotr2 lotr3 lotr4 lotr5 lotr6 lotr7 lotr8 lotr9 lotr10 lotr11 lotr_movie precious_laugh minka_where minka_found minka_shy catfight1 catfight2 minka_trust shelf1 shelf2 shelf_full'.split(' ');
  const JF = 'hi1 hi2 hi3 hi4 build_hello1 build_hello2 build_hello3 build_start1 build_start2 build_start3 build_start4 build_done1 build_done2 build_done3 build_done4 build_full1 build_full2 build_down build_down2 treehouse recolor hug love highfive juggle magic strong food_great food_good food_meh nervous ok burp stomach vomit diarrhea notp tp_thanks joke_laugh joke_groan whos_there europe_who why_house comfort tantrum deer tree treetop pic giggle work1 work2 work3 play_yes wow pool thanks helper turkey squirrel oak'.split(' ');
  const KEYS = new Set([...NU.map(k => 'nu_' + k), ...JF.map(k => 'j_' + k)]);
  // lines the older code asks the "third grown-up" (Uncle Rory) for, said instead in their own words
  const ALT = {
    nunu: { love: ['nu_love1', 'nu_love2', 'nu_love3', 'nu_love4'], cuddle: ['nu_hug', 'nu_kiss'], amazing: ['nu_wow', 'nu_proud', 'nu_pic'], proud: ['nu_proud'], comfort2: ['nu_comfort'], tantrum: ['nu_comfort'], caughtkiss: ['nu_kiss', 'nu_love1'], kiss: ['nu_kiss'], grouphug: ['nu_hug'], play_yes2: ['nu_play_yes'], fort_down: ['nu_comfort'], hi: ['nu_hi1'], hi2: ['nu_hi2'], hi_niece: ['nu_hi1', 'nu_hi4'], hi_niece2: ['nu_hi2'], hi_niece3: ['nu_hi3'], chase: ['nu_giggle'], thanks: ['nu_love4'], good: ['nu_proud'], strong: ['nu_wow'], brave: ['nu_proud'], style: ['nu_wow'], music: ['nu_dance'], tidy: ['nu_tidy'], mess: ['nu_clutter'], dance: ['nu_dance'], joke1: ['nu_joke_laugh'], joke_poo: ['nu_joke_groan'], better: ['nu_love4'] },
    jeff: { cuddle: ['j_hug'], caughtkiss: ['j_love'], kiss: ['j_love'], grouphug: ['j_hug'], play_yes2: ['j_play_yes'], thanks: ['j_thanks'], amazing: ['j_wow', 'j_pic'], proud: ['j_wow'], comfort2: ['j_comfort'], fort_down: ['j_comfort'], hi: ['j_hi1'], hi2: ['j_hi2'], hi_niece: ['j_hi1', 'j_hi4'], hi_niece2: ['j_hi2'], hi_niece3: ['j_hi3'], chase: ['j_giggle'], ok_ok: ['j_ok'], good: ['j_thanks'], brave: ['j_wow'], style: ['j_wow'], fort: ['j_wow'], joke1: ['j_joke_laugh'], joke_poo: ['j_joke_groan'], eat_yum: ['j_food_good'], meal: ['j_food_great'], better: ['j_thanks'] },
  };
  const own = (e, key) => { const m = key.match(/^(r|d|mo)_(.+)$/); if (!m) return key; const P = e === nunu ? 'nu_' : 'j_', alt = ALT[e.id][m[2]]; return alt ? pick(alt) : KEYS.has(P + m[2]) ? P + m[2] : null; };
  const _say = say;
  say = function (key, ent) { if (ent && (ent === nunu || ent === jeff)) { key = own(ent, key); if (!key) return Promise.resolve(); } return _say(key, ent); };
  // from behind the bathroom door
  const _voice = Audio2.voice;
  Audio2.voice = function (key, speaker, opt) { if (speaker === 'ghost' && G.bathWho === jeff && /^r_/.test(key)) key = own(jeff, key) || key; return _voice.call(Audio2, key, speaker, opt); };

  const DOWN = ['den', 'nunuroom', 'storage', 'laundry'], CHORES = ['sweep', 'fold', 'dust', 'point'];
  const sofa = () => (PROPS.den || []).find(p => p.id === 'bsofa') || { x: 420, y: BACK + 8 };
  const S = { smellAt: 0, downSince: 0, loveAt: 0, jugT: 0, jug: null, lastHi: {}, bang: 0 };

  // ---------------------------------------------------------------- how they are drawn
  window.drawGrand = function (e) {
    const t = e.animT, flip = e.dir < 0, id = e.id;
    if (e.state === 'toilet') return;
    if (!has(id)) { emoji(id === 'nunu' ? '👵' : '👴', e.x, e.y - 34, 40); return; }                    // until the art has loaded
    if (e.moving && ['sit', 'hammer', 'wave', 'sweep', 'fold', 'dust', 'point'].includes(e.state)) { if (e.state === 'sit') e.y = Math.max(e.y, FLOOR - 8); e.state = 'idle'; }          // asked to come over: get up first
    const y = e.y + (e.offY || 0);
    if (id === 'nunu' && e.state === 'sit') { drawSprite(has('nunu_sit') ? 'nunu_sit' : 'nunu', e.x, y, { flip }); if (e.face) emoji(e.face, e.x + (flip ? -8 : 8), y - 70, 12); return; }
    if (id === 'nunu' && CHORES.includes(e.state)) { const base = 'nunu_' + e.state, n = frameCount(base);          // sweeping, folding laundry, dusting, or an "ooh!" about her films
      if (n) drawSprite(base + '_' + (1 + Math.floor(t * (e.state === 'sweep' ? 7 : 5)) % n), e.x, y, { flip }); else { drawSprite('nunu', e.x, y, { flip, rot: Math.sin(t * 6) * 0.03 }); emoji({ sweep: '🧹', fold: '🧺', dust: '🪶', point: '✨' }[e.state], e.x + e.dir * 16, y - 34 + Math.sin(t * 8) * 3, 14); }
      if (e.state === 'sweep' && chance(0.1)) emit('dust', e.x + e.dir * 22, y - 2, 1);
      if (e.face) emoji(e.face, e.x + (flip ? -8 : 8), y - 78, 12); return; }
    if (id === 'nunu' && e.carry) { const k = (e.moving && frameKey('nunu_basket', t, 9)) || (has('nunu_basket_0') ? 'nunu_basket_0' : has('nunu_basket') ? 'nunu_basket' : null);     // off to the laundry with a basket
      if (k) drawSprite(k, e.x, y, { flip }); else { drawSprite(e.moving ? (frameKey('nunu_walk', t, 9) || 'nunu') : 'nunu', e.x, y, { flip }); emoji('🧺', e.x + e.dir * 12, y - 30, 14); } return; }
    if (e.state === 'eat' && frameCount(id + '_eat')) { drawSprite(frameKey(id + '_eat', t, 7), e.x, y, { flip }); if (chance(0.1)) emit('dust', e.x + e.dir * 10, y - 60, 1, { col: '#e8c27a', g: 200, vy: -10 }); return; }
    if (e.state === 'hammer' && frameCount('jeff_hammer')) { const n = frameCount('jeff_hammer'), f = 1 + (Math.floor(t * 9) % n); drawSprite('jeff_hammer_' + f, e.x, y, { flip });
      if (f === n && S.bang !== Math.floor(t * 9)) { S.bang = Math.floor(t * 9); emit('dust', e.x + e.dir * 22, y - 34, 2, { col: '#d9b27a' }); if (e.here && !inActivity()) Audio2.noise(0.04, 0.12, 900); } return; }
    if (e.state === 'wave' && frameCount(id + '_wave')) { drawSprite(frameKey(id + '_wave', t, 8), e.x, y, { flip }); return; }
    const k = e.moving ? (frameKey(id + '_walk', t, e.curSpeed > 80 ? 16 : 9) || id) : id;
    let sy = 1, rot = 0;
    if (e.state === 'eat') sy = 1 + Math.sin(t * 12) * 0.03;
    if (e.state === 'sick') rot = Math.sin(t * 9) * 0.05;
    if (e.state === 'vomit') rot = 0.12 * (flip ? -1 : 1);
    if (e.hugT > E.t) sy = 1 + Math.sin(t * 8) * 0.04;
    drawSprite(k, e.x, y, { flip, sy, rot });
    if (e.state === 'eat') { drawSprite('dish_' + ((e.plate && e.plate.art) || 'cake'), e.x + e.dir * 14, y - 44, { scale: 0.45 }); emoji('🍴', e.x + e.dir * 8, y - 56 + Math.abs(Math.sin(t * 9)) * 6, 9); }
    if (e.state === 'sick' && chance(0.08)) emit('stink', e.x - e.dir * 6, y - 30);
    if (e.face) emoji(e.face, e.x + (flip ? -8 : 8), y - 78, 12);
    if (id === 'jeff' && S.jug) { const j = S.jug, u = (E.t - j.t0) / j.dur; if (u >= 1) S.jug = null; else for (let i = 0; i < 3; i++) { const ph = (E.t * 2.4 + i / 3) % 1, drop = j.drop && i === 2 && u > 0.72;
        const x = e.x - 13 + 26 * ph, yy = drop ? y - 30 + (u - 0.72) * 260 : y - 62 - Math.sin(ph * Math.PI) * 34; E.ctx.save(); E.ctx.translate(Math.round(x - E.camX), Math.round(Math.min(yy, y - 4))); E.ctx.rotate(E.t * 9 + i * 2); E.ctx.font = '11px serif'; E.ctx.textAlign = 'center'; E.ctx.textBaseline = 'middle'; E.ctx.fillText(['🔨', '🔧', '🪛'][i], 0, 0); E.ctx.restore(); } }
  };

  // ---------------------------------------------------------------- while a full-screen activity is open (pool, building, a film, drawing, a story…) the house keeps quiet:
  // nobody wanders up to chat, nobody greets her from the doorway, and no "I want to…" wish pops up behind it
  const fullScreen = () => { const p = document.getElementById('panel'); return (p && !p.classList.contains('hidden')) || !!(window.Studio && Studio.active) || !!document.querySelector('#storyBox,#stkBox'); };
  { const _ap = AI.person; AI.person = function (e, dt) { if (fullScreen()) return; return _ap.call(this, e, dt); }; }
  { const _ob = onEnterRoomBy; onEnterRoomBy = function (e) { if (fullScreen()) return; return _ob(e); }; }
  if (typeof showWish === 'function') { const _sw = showWish; showWish = function (k) { if (fullScreen()) return; return _sw(k); }; }
  // ---------------------------------------------------------------- what they do on their own
  const _up = AI.update;
  AI.update = function (dt) { _up.call(this, dt); try { live(nunu, dt); live(jeff, dt); happenings(dt); } catch (e) { if (!S.warned) { S.warned = 1; console.warn('grand', e); } } };
  function live(e, dt) {
    if (fullScreen()) return;
    if (e.hidden || AI.held.has(e) || e.state === 'toilet' || (G.fort && G.fort.guests.includes(e))) return;
    e.wait = (e.wait || rnd(3, 7)) - dt; if (e.moving || e.wait > 0) return; e.wait = rnd(7, 15);
    const home = e === nunu ? DOWN : ['backyard'];
    if (!home.includes(e.room)) {                      // came up to read a story or to eat: wander off home again
      const back = () => { e.room = home[0]; e.x = e === nunu ? 300 : 262; e.y = FLOOR; e.state = 'idle'; e.face = null; };
      if (e.here) e.walkTo(e.x < ROOMS[e.room].w / 2 ? 4 : ROOMS[e.room].w - 4, back, 70); else back(); return;
    }
    if (e === nunu) {                                  // she is always busy: sweeping, dusting, laundry — and now and then a sit down
      if (CHORES.includes(e.state)) e.state = 'idle';
      if (e.state === 'sit') { if (chance(0.5)) { e.state = 'idle'; e.y = FLOOR; e.x -= 26; } return; }
      const R = ROOMS[e.room], r = Math.random();
      const doing = (kind, x) => { e.carry = false; e.walkTo(clamp(x, 30, R.w - 30), () => { e.state = kind; e.dir = kind === 'sweep' ? pick([-1, 1]) : e.dir; e.wait = rnd(7, 12); choreSay(kind); }, null, rnd(156, 168)); };
      if (e.room !== 'den' && !e.carry && (e.goDen || r > 0.72)) {          // back to her den after a job elsewhere
        const right = e.room === 'nunuroom', next = right ? R.right : R.left, hop = () => { e.room = next; e.x = right ? 12 : ROOMS[next].w - 12; e.y = FLOOR; e.wait = 0.5; if (next === 'den') e.goDen = false; };
        if (e.here) e.walkTo(right ? R.w - 4 : 4, hop, 56); else { e.room = 'den'; e.x = rnd(200, 420); e.y = FLOOR; e.goDen = false; } return; }
      if (e.carry || r < 0.22) {                        // laundry: carry the basket to the laundry room, then fold at the dryer
        e.carry = true;
        if (e.room !== 'laundry') { const next = R.right && DOWN.includes(R.right) ? R.right : 'laundry', hop = () => { e.room = next; e.x = 12; e.y = FLOOR; e.wait = 0.5; };
          if (e.here) { choreSay('laundry'); e.walkTo(R.w - 4, hop, 56); } else { e.room = 'laundry'; e.x = 60; } return; }
        const d = (PROPS.laundry || []).find(p => p.id === 'dryer') || { x: 150 }; e.walkTo(d.x - 20, () => { e.carry = false; e.goDen = true; e.dir = 1; e.state = 'fold'; e.wait = rnd(8, 13); choreSay('fold'); }, null, FLOOR - 2); return;
      }
      if (r < 0.52) return doing('sweep', rnd(50, R.w - 50));
      if (r < 0.66) { const ps = (PROPS[e.room] || []).filter(p => ['tvdresser', 'ledge', 'legoshelf', 'shades', 'totes', 'alcove', 'rack', 'ntotes', 'usink'].includes(p.id)); return doing('dust', ps.length ? pick(ps).x - 14 : rnd(60, R.w - 60)); }
      if (e.room === 'den' && r < 0.8) { const s = sofa(); return e.walkTo(s.x - 34, () => { e.state = 'sit'; e.x = s.x - 8; e.y = s.y + 2; e.dir = 1; }, null, FLOOR - 4); }
      if (!e.here && r < 0.9) { const to = pick([R.left, R.right].filter(x => DOWN.includes(x))); if (to) { e.room = to; e.x = rnd(60, ROOMS[to].w - 60); e.y = FLOOR; if (e.here) e.x = marina.x < ROOMS[to].w / 2 ? ROOMS[to].w - 20 : 20; } return; }
      e.walkTo(rnd(50, R.w - 50), null, null, rnd(154, 172));
    } else {
      if (e.state === 'hammer' || e.state === 'wave') { e.state = 'idle'; if (chance(0.5)) return; }
      const B = window.Backyard || { bench: 232, plots: [] };
      if (chance(0.45)) return e.walkTo(B.bench - 34, () => { e.dir = 1; e.state = 'hammer'; e.wait = rnd(5, 9); }, null, FLOOR - 2);
      if (e.here && Math.abs(e.x - marina.x) < 150 && chance(0.4)) { e.dir = Math.sign(marina.x - e.x) || 1; e.state = 'wave'; e.wait = 2.2; return; }
      const spots = [B.bench + 30, ...B.plots.map(p => p.x - 46), 700, 930];
      e.walkTo(pick(spots) + rnd(-10, 10), null, null, rnd(156, 172));
    }
  }
  const CHORE_SAY = { sweep: ['nu_sweep1', 'nu_sweep2', 'nu_clutter', 'nu_lotr5'], laundry: ['nu_laundry1', 'nu_laundry2'], fold: ['nu_laundry3', 'nu_laundry2'], dust: ['nu_clean1', 'nu_clean2'] };
  function choreSay(kind) { if (!nunu.here || E.t - (S.choreSay || -99) < 55 || !pingOk(40)) return; S.choreSay = E.t; ping(); say(pick(CHORE_SAY[kind] || CHORE_SAY.sweep), nunu); }
  const LOTR = ['nu_lotr1', 'nu_lotr2', 'nu_lotr3', 'nu_lotr4', 'nu_lotr6', 'nu_lotr7', 'nu_lotr8', 'nu_lotr9', 'nu_lotr11'];
  function filmTalk() { S.lotrAt = E.t; ping(); const was = nunu.state, k = pick(LOTR.filter(x => x !== S.lotrLast)); S.lotrLast = k; if (was !== 'sit') { nunu.stop(); nunu.state = 'point'; nunu.wait = Math.max(nunu.wait || 0, 4); } nunu.dir = Math.sign(marina.x - nunu.x) || 1;
    sayG(k, nunu).then(() => { if (nunu.state === 'point') nunu.state = 'idle'; if (k === 'nu_lotr3' && nunu.here && !G.busy && chance(0.8)) return sayG('m_precious').then(() => sayG('nu_precious_laugh', nunu)); }); }
  const PHONE = ['d_phone1', 'd_phone2', 'd_phone3', 'd_phone5', 'd_phone6', 'd_phone7', 'd_phone8'];
  function phoneScene() {
    if (G.busy) return; UI.closeActions(); G.busy = true; AI.hold(daddy, true); daddy.dir = Math.sign(marina.x - daddy.x) || 1; marina.dir = -daddy.dir;
    sayG('m_phone2').then(() => sayG(pick(['d_phone1', 'd_phone2', 'd_phone4', 'd_phone5']), daddy)).then(() => sayG('m_phone')).then(() => { daddy.state = 'idle'; daddy.face = '😅'; return sayG(pick(['d_phone_off', 'd_phone_off2']), daddy); })
      .then(() => { daddy.face = null; S.phoneAt = E.t; G.busy = false; AI.hold(daddy, false); emit('heart', daddy.x, daddy.y - 86, 4); try { did('phone'); } catch (x) { } });
  }
  function hooks() {                                   // other files' events → the family's reactions
    if (window.Minka && !S.hookM) { S.hookM = 1; Minka.onEvent = (kind) => { try {
        if (kind === 'hiding') { if (nunu.here && !AI.held.has(nunu) && pingOk(30)) { ping(); say('nu_minka_where', nunu); } }
        else if (kind === 'found') { say('m_minka_found').then(() => { if (nunu.here && !G.busy) say('nu_minka_found', nunu); }); }
        else if (kind === 'fight') { if (E.t - (S.fightSay || -99) < 50) return; S.fightSay = E.t; const who = [nunu, daddy, mommy, rory].find(e => e.here && !AI.held.has(e) && e.state !== 'lie' && e.state !== 'toilet'); if (who) setTimeout(() => { if (who.here) say(who === nunu ? pick(['nu_catfight1', 'nu_catfight2']) : who === daddy ? 'd_catfight' : who === mommy ? 'mo_catfight' : 'r_catfight', who); }, 900); }
        else if (kind === 'pet') { if (E.t - (S.petSay || -99) < 70) return; S.petSay = E.t; if (nunu.here && chance(0.5)) say(pick(['nu_minka_trust', 'nu_minka_shy']), nunu); else say('m_minka_love'); }
      } catch (e) { } }; }
    if (window.LegoShelf && !S.hookL) { S.hookL = 1; LegoShelf.onEvent = (kind) => { try { const v = k => { const pr = Audio2.voice(k, k.split('_')[0]); try { chatter(pr); } catch (e) { } return pr; };
        if (kind === 'keep') { v('m_shelf').then(() => { if (nunu.room === G.room) v('nu_shelf1'); }); } else if (kind === 'full') { if (nunu.room === G.room) v('nu_shelf_full'); } else if (kind === 'look' && nunu.room === G.room && chance(0.5)) v('nu_shelf2'); } catch (e) { } }; }
    if (window.Builder && !S.hookB) { S.hookB = 1; Builder.onSay = k => jeffSays(k); }
    if (window.Wildlife && !S.hookW) { S.hookW = 1; Wildlife.onEvent = (kind) => { try {          // Grandpa Jeff points out the turkeys and grumbles about his squirrel
        if (G.room !== 'backyard' || !jeff.here || AI.held.has(jeff) || G.busy) return;
        const k = kind === 'turkeys' || kind === 'turkey_display' ? 'j_turkey' : kind === 'squirrel' ? 'j_squirrel' : null; if (!k) return;
        if (E.t - (S.wildSay || -99) < 90 || !pingOk(30)) return; S.wildSay = E.t; ping();
        setTimeout(() => { if (jeff.here && !G.busy) { jeff.dir = Math.sign(marina.x - jeff.x) || 1; say(k, jeff); } }, 1500);
      } catch (e) { } }; }
  }
  function happenings(dt) {
    hooks();
    // sweeping: she works her way slowly along the floor
    if (nunu.state === 'sweep' && !AI.held.has(nunu)) { const W = ROOMS[nunu.room].w; nunu.x += nunu.dir * 5 * dt; if (nunu.x < 40) nunu.dir = 1; if (nunu.x > W - 40) nunu.dir = -1; if (nunu.here && !inActivity() && Math.floor(E.t * 1.6) !== Math.floor((E.t - dt) * 1.6)) Audio2.noise(0.12, 0.035, 2600); }
    // her favourite films
    if (nunu.here && !AI.held.has(nunu) && !nunu.moving && !nunu.carry && E.t - (S.lotrAt || -60) > 130 && S.downSince && E.t - S.downSince > 30 && pingOk(55) && chance(dt / 25)) filmTalk();
    // Daddy on his phone, making a game
    if (daddy.state === 'phone' && (daddy.moving || AI.held.has(daddy) || E.t > (S.phoneEnd || 0)) && !G.busy) daddy.state = 'idle';
    if (daddy.state === 'idle' && !daddy.hidden && !daddy.moving && !AI.held.has(daddy) && Floors.MAIN.includes(daddy.room) && !daddy.holdingMiles && !G.pendingDish && !(G.chase && G.chase.who === daddy) && E.t - (S.phoneAt || -40) > 75 && chance(dt / 45)) {
      daddy.state = 'phone'; S.phoneAt = E.t; S.phoneEnd = E.t + rnd(16, 30); daddy.wait = S.phoneEnd - E.t;
      if (daddy.here && pingOk(50) && E.t - (S.phoneSay || -99) > 100) { S.phoneSay = E.t; ping(); setTimeout(() => { if (daddy.here && daddy.state === 'phone' && !G.busy) say(pick(PHONE), daddy); }, 1200); } }
    const down = DOWN.includes(G.room);
    if (!down) S.downSince = 0; else if (!S.downSince) S.downSince = E.t;
    // "there's a smell down here…"
    if (down && nunu.here && !AI.held.has(nunu) && E.t - S.downSince > 25 && E.t - S.smellAt > 170 && pingOk(50) && chance(dt / 14)) smell();
    // a little love now and then
    else if (nunu.here && !AI.held.has(nunu) && nunu.state !== 'sit' && E.t - S.loveAt > 120 && E.t - S.downSince > 50 && pingOk(70) && chance(dt / 40)) { S.loveAt = E.t; ping(); AI.hold(nunu, true); nunu.walkTo(marina.x + (nunu.x < marina.x ? -24 : 24), () => { nunu.dir = Math.sign(marina.x - nunu.x) || 1; emit('heart', nunu.x, nunu.y - 86, 5); sayG(pick(['nu_love1', 'nu_love2', 'nu_love3', 'nu_love4', 'nu_kiss']), nunu).then(() => AI.hold(nunu, false)); }, 60); setTimeout(() => AI.hold(nunu, false), 9000); }
    // the deer have come out of the woods
    const deer = !!(window.Wildlife && Wildlife.active && Wildlife.active());
    if (deer && !S.deer && G.room === 'backyard' && !inActivity()) { ping(); setTimeout(() => { if (G.room !== 'backyard' || G.busy) return; say('m_deer').then(() => { if (jeff.here && !AI.held.has(jeff) && !G.busy) { jeff.dir = Math.sign(marina.x - jeff.x) || 1; say('j_deer', jeff); } }); }, 2500); }
    S.deer = deer;
    if (jeff.here && !AI.held.has(jeff) && !jeff.moving && E.t - (S.workAt || 0) > 100 && Math.abs(jeff.x - marina.x) < 130 && pingOk(70) && chance(dt / 45)) { S.workAt = E.t; ping(); jeff.dir = Math.sign(marina.x - jeff.x) || 1; say(pick(['j_work1', 'j_work2', 'j_work3', 'j_helper']), jeff); }
  }
  async function smell() {
    S.smellAt = E.t; ping(); AI.hold(nunu, true); stand(nunu);
    nunu.face = '👃'; const iv = setInterval(() => { if (nunu.here) emit('stink', nunu.x + rnd(-50, 50), nunu.y - rnd(10, 70), 1); }, 220);
    try {
      await sayG(pick(['nu_smell1', 'nu_smell2', 'nu_smell3']), nunu); nunu.face = '😤'; nunu.dir = Math.sign(marina.x - nunu.x) || 1;
      const k = pick(['nu_septic1', 'nu_septic2', 'nu_septic3', 'nu_septic3']); await sayG(k, nunu);
      G.septic = true; if (nunu.here) { UI.bigIcon('📞👨', 1300); Audio2.voice('m_giggle', 'm'); }
    } catch (e) { }
    clearInterval(iv); nunu.face = null; AI.hold(nunu, false);
  }
  function tellDaddy() {
    if (G.busy) return; UI.closeActions(); G.busy = true; AI.hold(daddy, true); daddy.stop(); if (daddy.state === 'lie') daddy.state = 'idle'; daddy.dir = Math.sign(marina.x - daddy.x) || 1; marina.dir = -daddy.dir;
    sayG('m_septic').then(() => { daddy.face = '😅'; return sayG(pick(['d_septic', 'd_septic2']), daddy); }).then(() => { daddy.face = null; G.septic = false; G.septicTold = true; G.busy = false; try { did('septic'); } catch (x) { } AI.hold(daddy, false); Audio2.voice('m_giggle', 'm'); });
  }

  // ---------------------------------------------------------------- hello when she walks in
  const replyAt = {}; /* G20: when Marina last said hello back to nunu / jeff (game seconds) */
  const _oer = onEnterRoom;
  onEnterRoom = function (room) {
    // coming down the stairs: Nunu is in her den, not off in the laundry
    if (DOWN.includes(room) && !DOWN.includes(S.prev) && !AI.held.has(nunu) && DOWN.includes(nunu.room) && nunu.room !== room) { nunu.stop(); nunu.room = 'den'; nunu.x = room === 'den' ? clamp(marina.x + 120, 200, 420) : 330; nunu.y = FLOOR; nunu.state = 'idle'; nunu.dir = -1; nunu.wait = 6; }
    S.prev = room;
    const g0 = window.Clarity && Clarity.is('G20') ? { nunu: G.lastGreet.nunu, jeff: G.lastGreet.jeff } : null; /* G20: their stamps before this call */
    _oer(room);
    // the game's own hello has just picked one of them: Grandpa looks up from his work, and Marina says hi back
    const e = [nunu, jeff].find(x => x.here && G.lastGreet[x.id] != null && E.t - G.lastGreet[x.id] < 0.5 && (!g0 || G.lastGreet[x.id] !== g0[x.id])); if (!e) return; /* G20: only if THIS call greeted */
    if (e === jeff) { if (jeff.state === 'hammer') jeff.state = 'wave'; jeff.wait = Math.max(jeff.wait || 0, 3.5); setTimeout(() => { if (jeff.state === 'wave') jeff.state = 'idle'; }, 2600); }
    setTimeout(() => { if (!e.here || G.busy || inActivity()) return; const g20 = window.Clarity && Clarity.is('G20'); if (e === nunu && G.septicTold) { G.septicTold = false; if (g20) replyAt.nunu = E.t; say('nu_septic_thanks', nunu); } else { if (g20) { if (E.t - (replyAt[e.id] ?? -Infinity) < 10) return; replyAt[e.id] = E.t; } say(e === nunu ? 'm_hi_nunu' : 'm_hi_jeff'); } }, 2600); /* G20: per-person 10 s reply gate */
  };

  // ---------------------------------------------------------------- things to do with them
  const near = (e, fn, gap) => approach(e.x + (marina.x < e.x ? -(gap || 26) : (gap || 26)), () => { marina.dir = Math.sign(e.x - marina.x) || 1; e.dir = -marina.dir; fn(); }, 0);
  const stand = e => { e.stop(); if (e.state === 'sit') { e.y = FLOOR; } if (['sit', 'hammer', 'wave', 'lie', 'phone', ...CHORES].includes(e.state)) e.state = 'idle'; e.carry = false; };
  function hug(e) {
    if (G.busy) return; UI.closeActions(); stand(e); AI.hold(e, true);
    near(e, async () => { G.busy = true; try { emit('heart', (marina.x + e.x) / 2, marina.y - 70, 6); chip('hug'); const pr = pair('pair_hug_' + e.id, e, { dur: 2.2 });
        await sayG(e === nunu ? 'm_wuv_nunu' : 'm_wuv_jeff'); await pr; emit('heart', e.x, e.y - 84, 6);
        await sayG(e === nunu ? pick(['nu_love1', 'nu_love2', 'nu_love3', 'nu_love4', 'nu_hug', 'nu_kiss']) : pick(['j_hug', 'j_love']), e); try { did('hug'); } catch (x) { } } catch (x) { console.warn('hug', x); }
      G.busy = false; AI.hold(e, false); });
  }
  function noFood() { UI.closeActions(); stand(nunu); nunu.dir = Math.sign(marina.x - nunu.x) || 1; nunu.face = '🙅'; say(jeff.hidden ? 'nu_nofood' : pick(['nu_nofood', 'nu_nofood2']), nunu).then(() => { nunu.face = null; }); }
  function highFive() {
    if (G.busy) return; UI.closeActions(); stand(jeff); AI.hold(jeff, true);
    near(jeff, async () => { G.busy = true; try { await sayG('j_highfive', jeff); let t = 0; await new Promise(r => { const iv = setInterval(() => { t += 0.04; marina.offY = -Math.sin(Math.min(1, t / 0.5) * Math.PI) * 22; if (t >= 0.5) { clearInterval(iv); marina.offY = 0; r(); } if (Math.abs(t - 0.24) < 0.021) { Audio2.noise(0.05, 0.4, 2400); emit('star', (marina.x + jeff.x) / 2, marina.y - 74, 10); try { chip('pop'); } catch (x) { } } }, 30); });
        marina.state = 'cheer'; await sayG('m_highfive'); } catch (x) { } if (marina.state === 'cheer') marina.state = 'idle'; G.busy = false; AI.hold(jeff, false); });
  }
  function juggle() {
    if (G.busy) return; UI.closeActions(); stand(jeff); AI.hold(jeff, true);
    near(jeff, async () => { G.busy = true; try { const drop = chance(0.4); S.jug = { t0: E.t, dur: 4.2, drop }; const iv = setInterval(() => { if (S.jug) Audio2.blip(pick([7, 9, 12, 14]), 'triangle', 0.05, 0.05); }, 240);
        say('j_juggle', jeff); await sleep(3000); if (drop) { await sleep(500); clearInterval(iv); Audio2.noise(0.12, 0.35, 300); jeff.face = '😵'; emit('star', jeff.x, jeff.y - 6, 6); Audio2.voice('m_joke_laugh', 'm'); await sleep(900); await sayG('j_giggle', jeff); jeff.face = null; }
        else { await sleep(1200); clearInterval(iv); Audio2.jingle([0, 4, 7, 12], 0.07); emit('confetti', jeff.x, jeff.y - 80, 14); marina.state = 'cheer'; await sayG('m_wow'); } S.jug = null; } catch (x) { }
      if (marina.state === 'cheer') marina.state = 'idle'; G.busy = false; AI.hold(jeff, false); }, 40);
  }
  function build() {
    if (G.busy) return; UI.closeActions(); if (!window.Builder) return say('m_hmm'); stand(jeff); jeff.dir = Math.sign(marina.x - jeff.x) || 1;
    Builder.open({ onSay: jeffSays });
  }
  const BUILD_SAY = { hello: ['j_build_hello1', 'j_build_hello2', 'j_build_hello3'], start: ['j_build_start1', 'j_build_start2', 'j_build_start3', 'j_build_start4'], done: ['j_build_done1', 'j_build_done2', 'j_build_done3', 'j_build_done4'], full: ['j_build_full1', 'j_build_full2'], down: ['j_build_down', 'j_build_down2'], treehouse: ['j_treehouse'], recolor: ['j_recolor'] };
  let lastBuildSay = 0;
  function jeffSays(kind) { const ks = BUILD_SAY[kind]; if (!ks) return; if (kind === 'hello' && E.t - lastBuildSay < 25) return; lastBuildSay = E.t; const k = pick(ks);
    const open = !document.getElementById('panel').classList.contains('hidden');            // a full-screen menu is up: just the voice and his face, no speech bubble behind it
    if (open) { const pr = Audio2.voice(k, 'j', { cut: true }); UI.face('jeff', kind === 'full' ? 'surprised' : 'happy', pr); return pr; } return say(k, jeff); }

  // Lego with Nunu: she sits by the table, cheers her on, and (💡 in the builder) has ideas
  function legoWith() { if (G.busy) return; UI.closeActions(); const p = (PROPS.den || []).find(q => q.id === 'ltable'); if (!p || !window.Bricks) return say('m_hmm'); propTap(p, '🧱'); }
  function propTap(p, ico) { const a = propActions(p).find(x => x.icon === ico || x.ico === ico || x[0] === ico); if (a) (a.fn || a.act || a[1])(); }
  let brickIv = 0;
  function nunuAtBricks(on) {
    clearInterval(brickIv); if (!on) { AI.hold(nunu, false); return; }
    if (!nunu.here) return; AI.hold(nunu, true); stand(nunu); const p = (PROPS.den || []).find(q => q.id === 'ltable'); if (p) { nunu.x = clamp(p.x + 34, 20, ROOMS.den.w - 20); nunu.y = FLOOR; nunu.dir = -1; }
    const talk = k => chatter(Audio2.voice(k, 'nu'));
    setTimeout(() => window.Bricks && Bricks.active && talk('nu_lego_start'), 500);
    let last = 0, n0 = -1, done0 = false, quiet = E.t;
    brickIv = setInterval(() => { if (!window.Bricks || !Bricks.active) { clearInterval(brickIv); AI.hold(nunu, false); return; }
      let st = null; try { st = Bricks.state(); } catch (e) { } if (!st) return; const n = Array.isArray(st.pieces) ? st.pieces.length : (st.pieces || st.count || 0);
      if (st.complete && !done0) { done0 = true; last = E.t; talk(pick(['nu_lego_nice1', 'nu_lego_nice2', 'nu_wow'])); }
      else if (!st.complete) { done0 = false; if (n0 >= 0 && n >= n0 + 6 && E.t - last > 14) { last = E.t; n0 = n; talk(pick(['nu_lego_nice2', 'nu_proud', 'nu_wow', 'nu_lego_nice1'])); } else if (n0 < 0) n0 = n; if (n !== n0 && n < n0) n0 = n; if (n > n0) quiet = E.t;
        if (E.t - quiet > 22 && E.t - last > 22 && !st.ghost) { last = E.t; quiet = E.t; talk('nu_lego_idea'); } } }, 700);
  }
  // her face on the corner of the plate: tap it and Nunu takes a turn
  const brickPartner = { ico: '👵', n: 2,
    paint(b) { const r = typeof FACES !== 'undefined' && FACES.img && FACES.A && FACES.A.face_nunu_happy_rest; if (!r) return; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(FACES.img, r[0], r[1], r[2], r[3], 0, 0, 64, 64); b.textContent = ''; b.append(c); },
    onTurn(r) { const k = r === -1 ? 'nu_lego_idea' : r === -2 ? pick(['nu_lego_nice1', 'nu_lego_done']) : r === 0 ? 'nu_lego_oops' : chance(0.4) ? pick(['nu_lego_nice2', 'nu_wow', 'nu_play_yes', 'nu_giggle']) : null;
      if (!k || E.t - (S.brickSay || 0) < 2.5) return; S.brickSay = E.t; chatter(Audio2.voice(k, 'nu', { cut: true })); } };
  const chatter = pr => { const b = document.querySelector('.bk-partner'); if (b) { b.classList.add('bk-talk'); const off = () => b.classList.remove('bk-talk'); Promise.resolve(pr).then(off, off); setTimeout(off, 5000); } return pr; };
  { const st = document.createElement('style'); st.textContent = '.bk-partner.bk-talk{animation:bkpt .22s ease-in-out infinite;border-color:#ffcf4a}'; document.head.append(st); }
  // Movie night: the two of them on the sofa
  function movieNight() {
    if (G.busy || !window.Movies) return say('m_hmm'); UI.closeActions(); const s = sofa(); G.busy = true; AI.hold(nunu, true); stand(nunu);
    const go = () => { nunu.state = 'sit'; nunu.x = s.x - 8; nunu.y = s.y + 2; nunu.dir = 1; G.busy = false; G.btvOn = true;
      const talk = (k, mood) => { const pr = Audio2.voice(k, 'nu'); UI.face('nunu', mood || 'happy', pr); return pr; };
      { const pr = Audio2.voice('nu_movie_start', 'nu'); UI.face('nunu', 'happy', pr); } Promise.resolve().then(() => { Movies.open({
        onEvent: (kind, id) => { const fav = id === 'quest';          // her favourite kind of film: a ring, a wizard and a sneaky little creature
          const k = fav && kind === 'start' ? 'nu_lotr_movie' : fav && kind === 'funny' ? pick(['nu_lotr10', 'nu_lotr7', 'nu_movie_funny']) : fav && kind === 'end' ? pick(['nu_lotr4', 'nu_movie_end']) : { funny: 'nu_movie_funny', scary: 'nu_movie_scary', sweet: 'nu_movie_sweet', end: 'nu_movie_end', popcorn: 'nu_popcorn' }[kind]; if (k && (kind === 'start' || E.t - (S.movieSay || 0) > 6)) { S.movieSay = E.t; talk(k, kind === 'scary' ? 'surprised' : 'happy'); } },
        onDone: () => { G.btvOn = false; AI.hold(nunu, false); marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1400); emit('heart', (marina.x + nunu.x) / 2, marina.y - 70, 6); } }); }); };
    if (nunu.room !== 'den') { nunu.room = 'den'; nunu.x = s.x - 60; }
    let went = false; const go1 = () => { if (went) return; went = true; go(); };
    approach(s.x + 22, () => { marina.dir = 1; nunu.walkTo(s.x - 30, go1, 110); setTimeout(() => { if (G.busy && nunu.state !== 'sit') { nunu.stop(); go1(); } }, 1600); }, 0);
  }

  function helpNunu() {                                 // Marina lends a hand with the chores
    if (G.busy) return; UI.closeActions(); const kind = nunu.carry ? 'fold' : nunu.state; AI.hold(nunu, true);
    near(nunu, async () => { G.busy = true; try { await sayG('m_help_nunu'); say('nu_help', nunu); marina.state = 'cheer';
        for (let i = 0; i < 6; i++) { Audio2.noise(0.12, 0.05, 2400); emit(kind === 'sweep' ? 'dust' : 'sparkle', marina.x + marina.dir * 14, marina.y - (kind === 'sweep' ? 2 : 40), 3); marina.offY = -3; await sleep(180); marina.offY = 0; await sleep(260); }
        emit('star', (marina.x + nunu.x) / 2, marina.y - 70, 8); Audio2.jingle([0, 4, 7, 12], 0.07); await sayG('nu_help_thanks', nunu); try { did('helper'); } catch (x) { } } catch (x) { }
      if (marina.state === 'cheer') marina.state = 'idle'; marina.offY = 0; G.busy = false; AI.hold(nunu, false); }, 30);
  }
  const _ea = entActions;
  entActions = function (e) {
    if (e === nunu) { const busy = CHORES.includes(nunu.state) && nunu.state !== 'point' || nunu.carry, a = [A('🤗', () => hug(nunu))];
      if (busy) a.push(A('🧹', helpNunu));
      if (G.holding && G.holding.type === 'dish') a.unshift(A('🍽️', noFood));
      if (typeof openStory === 'function') a.push(A('📖', () => { UI.closeActions(); say('nu_story', nunu).then(() => openStory()); }));
      if (G.room === 'den' && window.Bricks) a.push(A('🧱', legoWith));
      if (G.room === 'den' && window.Movies) a.push(A('🎬', movieNight));
      if (!busy) a.push(A('😜', () => { stand(nunu); tellJoke(nunu); }));
      if (G.fort && G.fort.complete && G.fort.room === G.room) a.push(A('🏰', () => inviteToFort(nunu)));
      return a; }
    if (e === jeff) { const a = [];
      if (G.holding && G.holding.type === 'dish') a.push(A('🍽️', () => { stand(jeff); serve(jeff); }));
      if (G.pendingDish && G.pendingDish.who === jeff) a.push(A('🍽️', () => pressureEat(jeff)));
      if (window.Builder) a.push(A('🔨', build));
      a.push(A('🤗', () => hug(jeff)), A('🙌', highFive), A('🤹', juggle), A('😜', () => { stand(jeff); tellJoke(jeff); }));
      return a; }
    const a = _ea(e);
    if (e === daddy && G.septic && daddy.state !== 'toilet') a.unshift(A('📞', tellDaddy));
    if (e === daddy && daddy.state === 'phone') a.unshift(A('📱', phoneScene));
    return a;
  };

  // ---------------------------------------------------------------- a tummy emergency far from the bathroom: straight to the front hall, then as usual
  const _rtt = runToToilet;
  runToToilet = async function (e) {
    if (e.room === 'yard' || !Floors.MAIN.includes(e.room)) {
      e.state = 'idle'; e.face = '😱';
      if (e.here) await new Promise(r => { const W = ROOMS[e.room].w; e.walkTo(e.room === 'backyard' || e.x < W / 2 ? 4 : W - 4, r, 140); setTimeout(r, 7000); });
      e.stop(); e.room = 'foyer'; e.x = 60; e.y = FLOOR;
    }
    return _rtt(e);
  };
  return { S, smell, nunuAtBricks, brickPartner, movieNight, jeffSays, hug, juggle, highFive, KEYS };
})();
window.GRAND = GRAND;
