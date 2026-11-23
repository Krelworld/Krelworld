// Chef Marina regression sweep: presses EVERY choice the game offers (each object, person, Marina herself, in many
// situations) and records what each one does, plus a set of end-to-end flows through the real screens.
// Run before and after UI changes, then compare with regress-diff.js.
//   NODE_PATH=$(npm root -g) node regress.js <basePort> <out.json> [gameDir] [only=choices|flows]
// Choices are identified by the SOURCE TEXT of their handler (not the icon or position), so re-ordering or re-drawing
// buttons does not break the comparison, but a missing or different handler does.
const H = require('./harness.js'); const fs = require('fs'); const { chromium } = require('playwright');
const basePort = +process.argv[2] || 8770, out = process.argv[3] || 'regress.json', dir = process.argv[4] || undefined, only = (process.argv[5] || '').replace('only=', '');
const PAGES = 5;

// ---- code that runs inside the page ------------------------------------------------------------------------------
const IN_PAGE = () => {
  window.__hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
  window.__said = []; const _say = window.say; window.say = function (k, e) { window.__said.push(k); return _say(k, e); };
  const P = (room, id) => PROPS[room].find(p => p.id === id);
  const dish = score => ({ type: 'dish', dish: { art: score < 0 ? 'slime' : 'cake', score, say: [], name: 'x', ings: ['eggs'], method: 'bake' } });
  const fort = () => ({ complete: true, room: G.room, guests: [], x: 120, L: 90, R: 150, roofY: 100, pieces: [], inside: false, ox: 0, oy: 0, bw: 40, bh: 30, img: document.createElement('canvas'), scale: 1, toys: [], theme: 'cozy', wob: 0, built: E.t });
  const bring = (e, st) => { e.room = G.room; e.hidden = false; e.state = st || (e === niko ? 'sit' : 'idle'); e.x = Math.min(ROOMS[G.room].w - 20, marina.x + 44); e.y = marina.y; if (e === rory) G.rory = true; if (e === niko) { niko.t = 99; niko.perchY = null; } AI.hold && e !== niko && e !== miles && AI.hold(e, true); };
  // every situation: {key, room, setup(), list()}
  window.__contexts = () => {
    const C = [];
    for (const room of Object.keys(PROPS)) for (const p of PROPS[room]) if (!p.nohit) C.push({ key: 'obj ' + room + '/' + p.id, room, setup: () => { }, list: () => propActions(P(room, p.id)) });
    const objS = (key, room, id, setup) => C.push({ key: 'obj ' + room + '/' + id + ' :: ' + key, room, setup, list: () => propActions(P(room, id)) });
    objS('Niko pooped', 'playroom', 'tray', () => { G.poop = true; }); objS('holding poop', 'living', 'pail', () => { G.holding = { type: 'poop', ico: '💩' }; });
    objS('holding poop', 'bathroom', 'toilet', () => { G.holding = { type: 'poop', ico: '💩' }; }); objS('TV on', 'living', 'tv', () => { tvOn(showList()[0]); });
    objS('TP needed', 'living', 'basket', () => { G.needTP = true; }); objS('TP needed', 'dining', 'closet', () => { G.needTP = true; }); objS('snowman big', 'yard', 'snowman', () => { G.snowman = 4; });
    objS('carrying blower', 'yard', 'leafpile', () => { G.holding = { type: 'blower' }; });
    const ents = { daddy, mommy, rory, niko, miles };
    for (const [n, e] of Object.entries(ents)) {
      const room = n === 'miles' ? 'living' : 'dining', S = (k, setup) => C.push({ key: 'who ' + n + ' :: ' + k, room, setup: () => { if (e !== miles) bring(e); setup && setup(); }, list: () => entActions(e) });
      S('normal'); S('Marina holding a nice dish', () => { G.holding = dish(3); }); S('fort built here', () => { G.fort = fort(); });
      if (e === daddy || e === rory) { S('asleep', () => { e.state = 'lie'; }); S('Marina riding', () => { marina.mount = e; marina.state = 'ride'; e.state = e === daddy ? 'shoulders' : 'horse'; }); S('refused gross dish', () => { G.pendingDish = { who: e, dish: dish(-4).dish }; }); S('Marina holding a gross dish', () => { G.holding = dish(-4); }); }
      if (e === miles) { S('crying', () => { miles.crying = true; miles.cryT = 60; }); S('dirty nappy', () => { miles.poopy = true; }); }
      if (e === niko) S('Marina holding something', () => { G.holding = { type: 'tp' }; });
    }
    const SS = (k, room, setup) => C.push({ key: 'self :: ' + k, room, setup, list: () => selfActions() });
    SS('idle', 'dining', () => { }); SS('holding a dish', 'dining', () => { G.holding = dish(2); }); SS('holding Niko', 'dining', () => { niko.state = 'held'; G.holding = { type: 'niko', struggle: false }; });
    SS('on furniture', 'living', () => { marina.state = 'perch'; marina.offY = -30; }); SS('on furniture with Daddy near', 'living', () => { bring(daddy); marina.state = 'perch'; marina.offY = -30; });
    SS('sitting', 'dining', () => { marina.state = 'sit'; }); SS('in wheelchair', 'living', () => { marina.state = 'wheel'; }); SS('on swing', 'yard', () => { marina.state = 'swing'; marina.swingKind = 'saucer'; });
    SS('on monkey bars', 'yard', () => { marina.state = 'bars'; marina.railY = 60; G.mb = { dir: 1, go: false }; }); SS('in yard', 'yard', () => { }); SS('fort built', 'living', () => { G.fort = fort(); });
    try { C.push({ key: 'menu :: gymnastics', room: 'playroom', setup: () => { }, list: () => { gymMenu(); return __lastActs || []; } }); } catch (e) { }
    return C;
  };
  // capture whatever list UI.actions was last asked to show (for menus opened by a function, like the gym menu)
  window.__lastActs = null; const _ua = UI.actions; UI.actions = function (anchor, list) { window.__lastActs = list; return _ua.call(UI, anchor, list); };
  window.__snap = () => { const vis = s => { const n = document.querySelector(s); return !!n && n.getClientRects().length > 0 && !n.classList.contains('hidden'); };
    return { room: G.room, state: marina.state, holding: G.holding ? G.holding.type : null, panel: vis('#panel') ? (document.querySelector('#panel .ttl') || {}).textContent || 'panel' : null, studio: !!(window.Studio && Studio.active),
      story: vis('#storyBox'), stickers: vis('#stkBox'), fortUI: !!document.querySelector('.fortbar,.fortin,#fortBuilder,.fbuild'), map: !!document.querySelector('#isoMap,.isomap,.iso'), menu: (window.__lastActs && document.querySelectorAll('.act').length) || 0,
      tv: !!G.tv, tidy: !!G.tidy, chase: !!G.chase, mess: G.mess.length, fort: !!G.fort, poop: !!G.poop, mount: marina.mount ? marina.mount.id : null, busy: !!G.busy, night: (G.night || 0) > 0.05,
      overlays: [...document.body.querySelectorAll('body > div, #stage > div')].filter(n => n.id && n.getClientRects().length && !['fx', 'moodbar', 'panel', 'title', 'roombar', 'alerts', 'app', 'stage'].includes(n.id)).map(n => n.id).sort().join(',') }; };
  window.__start = (room) => { G.outfit = 'default'; startGame(room); };
  window.__quiet = () => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); window.__lastActs = null; window.__said.length = 0;
    for (const e of [daddy, mommy, rory]) { if (e.room === G.room && !e.keep) { e.room = G.room === 'yard' ? 'kitchen' : 'yard'; } } if (niko.room === G.room) niko.room = G.room === 'yard' ? 'kitchen' : 'yard';
    miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.mess = []; G.needTP = false; G.holding = null; G.fort = null; G.pendingDish = null; G.snowman = 0; if (G.tv) { try { tvOff(); } catch (e) { G.tv = null; } } marina.mount = null; for (const e of [daddy, rory, mommy]) { if (['lie', 'horse', 'shoulders', 'eat'].includes(e.state)) e.state = 'idle'; } if (niko.state === 'held') niko.state = 'sit'; marina.state = 'idle'; marina.offY = 0; marina.x = ROOMS[G.room].w / 2; marina.y = 164; lastPing = E.t + 9999; };
};

async function newPage(browser, port) {
  const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/willReadFrequently|Failed to load resource/.test(t)) errors.push(m.type() + ': ' + t.slice(0, 160)); } });
  const fresh = async room => { errors.length = 0; await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForFunction(() => typeof marina !== 'undefined' && document.getElementById('title').classList.contains('ready'), null, { timeout: 30000 });
    await page.evaluate(IN_PAGE); await page.evaluate(r => __start(r), room); await page.waitForTimeout(1100); await page.evaluate(() => __quiet()); await page.waitForTimeout(60); errors.length = 0; };
  return { page, errors, fresh, close: () => ctx.close() };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function sweepChoices(browser, port) {
  const boot = await newPage(browser, port); await boot.fresh('dining');
  const contexts = await boot.page.evaluate(() => __contexts().map((c, i) => { let acts = []; try { G.room = c.room; marina.room = c.room; __quiet(); c.setup(); acts = (c.list() || []).map(a => ({ ico: a.ico, src: __hash(String(a.fn)) })); } catch (e) { acts = [{ ico: 'ERR', src: e.message }]; } return { i, key: c.key, room: c.room, acts }; }));
  await boot.close();
  const jobs = []; for (const c of contexts) { const seen = {}; for (const a of c.acts) { const n = seen[a.src] = (seen[a.src] || 0) + 1; jobs.push({ ctx: c.i, key: c.key, room: c.room, ico: a.ico, src: a.src, nth: n }); } }
  console.log(contexts.length, 'situations,', jobs.length, 'choices to press');
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: PAGES }, async () => { const pg = await newPage(browser, port);
    while (next < jobs.length) { const j = jobs[next++]; const r = { key: j.key, id: j.src + '#' + j.nth, ico: j.ico };
      try { await pg.fresh(j.room === 'yard' ? 'yard' : j.room);
        const before = await pg.page.evaluate(j => { const c = __contexts()[j.ctx]; if (G.room !== c.room) { G.room = c.room; marina.room = c.room; } __quiet(); c.setup(); window.__lastActs = null; const acts = c.list() || []; let n = 0; const a = acts.find(a => __hash(String(a.fn)) === j.src && ++n === j.nth);
          if (!a) return { missing: true }; UI.closeActions(); window.__lastActs = null; window.__said.length = 0; const s0 = __snap(); G.busy = false; try { a.fn(); } catch (e) { return { threw: e.message, s0 }; } return { s0 }; }, j);
        if (before.missing) { r.result = 'MISSING'; results.push(r); continue; } if (before.threw) { r.result = 'THREW ' + before.threw; results.push(r); continue; }
        await pg.page.waitForTimeout(1600); const s1 = await pg.page.evaluate(() => __snap());
        let s2 = s1, waited = 1600; while (s2.busy && !s2.panel && !s2.studio && !s2.story && waited < 26000) { await pg.page.waitForTimeout(1000); waited += 1000; s2 = await pg.page.evaluate(() => __snap()); }
        const said = await pg.page.evaluate(() => [...new Set(__said)]);
        const diff = (a, b) => Object.keys(b).filter(k => !same(a[k], b[k]) && k !== 'busy').map(k => k + ':' + JSON.stringify(a[k]) + '→' + JSON.stringify(b[k]));
        r.early = diff(before.s0, s1); r.late = diff(before.s0, s2); r.stuck = s2.busy && !s2.panel && !s2.studio && !s2.story; r.saidKinds = [...new Set(said.map(k => k.split('_')[0]))].sort().join(''); r.saidN = said.length; r.said = said.slice(0, 6);
        r.errors = pg.errors.slice(0, 3); r.result = 'ok';
      } catch (e) { r.result = 'HARNESS ' + e.message.split('\n')[0]; }
      results.push(r); if (results.length % 25 === 0) console.log(' ', results.length, '/', jobs.length); }
    await pg.close(); }));
  return { contexts: contexts.map(c => ({ key: c.key, icons: c.acts.map(a => a.ico).join(' '), ids: c.acts.map(a => a.src) })), results: results.sort((a, b) => (a.key + a.id).localeCompare(b.key + b.id)) };
}

// ---- end-to-end flows through the real screens ---------------------------------------------------------------------
async function flows(browser, port) {
  const R = {}; const pg = await newPage(browser, port); const p = pg.page;
  const tapSel = async (sel, n = 0) => { const loc = p.locator(sel).nth(n); await loc.waitFor({ state: 'attached', timeout: 8000 }); await loc.tap({ force: true }); };
  const F = async (name, room, fn) => { try { await pg.fresh(room); R[name] = await fn(); } catch (e) { R[name] = 'FAILED ' + e.message.split('\n')[0]; } if (pg.errors.length) R[name] += ' | errors: ' + pg.errors.slice(0, 2).join(' ; '); console.log('  flow', name, '=>', String(R[name]).slice(0, 110)); };
  const ev = fn => p.evaluate(fn);
  await F('title → play → room picker → start', 'living', async () => { await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForFunction(() => document.getElementById('title').classList.contains('ready')); const play = await p.locator('.tplay').count(); await tapSel('.tplay'); await p.waitForTimeout(600);
    const cards = await p.locator('.tcardr').count(), dice = await p.locator('.tdice').count(), dress = await p.locator('.tdress').count(), book = await p.locator('.tbook').count(); await tapSel('.tcardr', 1); await p.waitForTimeout(1500);
    return `play:${play} cards:${cards} dice:${dice} dress:${dress} book:${book} started:${await ev(() => document.getElementById('title').classList.contains('hidden') + ' in ' + G.room)}`; });
  await F('navigation: arrows, room strip, map', 'kitchen', async () => { const a = []; await tapSel('.navarrow.r'); await p.waitForTimeout(1800); a.push('right→' + await ev(() => G.room)); await ev(() => __quiet()); await tapSel('.navarrow.l'); await p.waitForTimeout(1800); a.push('left→' + await ev(() => G.room));
    await ev(() => __quiet()); await tapSel('#roombar .rb[data-r=yard]'); await p.waitForTimeout(1800); a.push('strip→' + await ev(() => G.room)); a.push('strip buttons:' + await p.locator('#roombar .rb').count());
    await ev(() => __quiet()); await tapSel('#mapBtn'); await p.waitForTimeout(900); a.push('map rooms:' + await ev(() => document.querySelectorAll('.isoroom').length)); await ev(() => { const r = [...document.querySelectorAll('.isoroom')].find(n => !n.classList.contains('here')); r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await p.waitForTimeout(1800); a.push('map→moved:' + await ev(() => G.room !== 'yard')); return a.join(' '); });
  await F('tap floor walks; tap object opens its choices', 'dining', async () => { const x0 = await ev(() => marina.x); const pt = await ev(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(marina.x + 70, 168).map((v, i) => v + (i ? st.top : st.left)); }); await p.touchscreen.tap(pt[0], pt[1]); await p.waitForTimeout(1800);
    const moved = await ev(() => Math.round(marina.x)); await ev(() => { __quiet(); const t = PROPS.dining.find(q => q.id === 'table'); marina.x = t.x - 70; }); await p.waitForTimeout(1000);
    const pt2 = await ev(() => { const t = PROPS.dining.find(q => q.id === 'table'); const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(t.x, t.y - 20).map((v, i) => v + (i ? st.top : st.left)); }); await p.touchscreen.tap(pt2[0], pt2[1]); await p.waitForTimeout(3000);
    const n = await ev(() => document.querySelectorAll('.act').length); await ev(() => { __quiet(); for (const e of [daddy]) { e.room = G.room; e.hidden = false; e.state = 'idle'; e.x = marina.x + 60; e.y = marina.y; AI.hold(e, true); } }); await p.waitForTimeout(900);
    const pt3 = await ev(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(daddy.x, daddy.y - 40).map((v, i) => v + (i ? st.top : st.left)); }); await p.touchscreen.tap(pt3[0], pt3[1]); await p.waitForTimeout(3000);
    return `walked:${Math.abs(moved - x0) > 20} table choices:${n} daddy choices:${await ev(() => document.querySelectorAll('.act').length)}`; });
  for (const m of ['love', 'happy', 'sad', 'angry', 'tantrum']) await F('mood ' + m + ' with Daddy', 'living', async () => { await ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = marina.x + 50; }); await tapSel(`.mood[data-mood=${m}]`); await p.waitForTimeout(2500); const mid = await ev(() => __snap().state + ' said:' + __said.length);
    let t = 0; while (t < 40 && await ev(() => G.busy || G.sceneOn)) { await p.waitForTimeout(1000); t++; } return `during:${mid.replace(/said:\d+/, 'said:' + (parseInt(mid.split('said:')[1]) > 0 ? 'yes' : 'no'))} ended:${t < 40} mood:${await ev(() => G.mood)}`; });
  await F('cooking: pick → method → result → give Daddy', 'kitchen', async () => { await ev(() => UI.openCook('fridge')); await p.waitForTimeout(500); const shelves = await p.locator('#panel .pbtn').count(); const tiles = await p.locator('#panel .tile').count(); await tapSel('#panel .tile', 1); await tapSel('#panel .tile', 4); await p.waitForTimeout(300); const chosen = await p.locator('#panel .slot.full').count();
    await tapSel('#panel .pbtn.go'); await p.waitForTimeout(500); const methods = await p.locator('#panel .method').count(); await tapSel('#panel .method', 0); await p.waitForSelector('#panel .result', { timeout: 25000 }); await p.waitForTimeout(700); const give = await p.locator('.givebtn').count(), rowBtns = await p.locator('#panel .result .row:not(.giverow) .pbtn').count(); const named = await ev(() => !!document.querySelector('#panel .result').textContent.trim());
    await tapSel('.givebtn', 0); await p.waitForTimeout(1500); const near = await ev(() => daddy.here && Math.abs(daddy.x - marina.x) < 60); let t = 0; while (t < 40 && await ev(() => G.busy || !!G.holding)) { await p.waitForTimeout(1000); t++; }
    return `tiles>20:${tiles > 20} chosen:${chosen} methods:${methods} give:${give} rowBtns:${rowBtns} named:${named} daddyCame:${near} served:${t < 40}`; });
  await F('cooking: all four shelves, carry, hand-over hint', 'kitchen', async () => { const n = []; for (const s of ['fridge', 'freezer', 'cabinet', 'bowl']) { await ev(s => UI.openCook(s), s).catch(() => { }); await p.evaluate(s => UI.openCook(s), s); await p.waitForTimeout(350); n.push(s + ':' + (await p.locator('#panel .tile').count() > 3)); }
    await tapSel('#panel .tile', 0); await tapSel('#panel .pbtn.go'); await p.waitForTimeout(400); await tapSel('#panel .method', 1); await p.waitForSelector('#panel .result', { timeout: 25000 }); await p.waitForTimeout(600); await tapSel('#panel .pbtn[aria-label="carry it"]'); await p.waitForTimeout(600);
    await ev(() => { G.busy = false; rory.room = G.room; rory.hidden = false; rory.state = 'idle'; rory.x = marina.x + 60; G.rory = true; }); await p.waitForTimeout(900); return n.join(' ') + ` holding:${await ev(() => G.holding && G.holding.type)} hints:${await p.locator('.pichint').count()}`; });
  await F('dress-up: tabs, pick outfit, done', 'dining', async () => { await ev(() => UI.openDress()); await p.waitForTimeout(600); const tabs = await p.locator('#panel .tabs .pbtn').count(); const per = []; for (let i = 0; i < tabs; i++) { await tapSel('#panel .tabs .pbtn', i); await p.waitForTimeout(200); per.push(await p.locator('#panel .dgrid .tile').count()); }
    await tapSel('#panel .tabs .pbtn', 0); await p.waitForTimeout(200); await tapSel('#panel .dgrid .tile', 3); await p.waitForTimeout(200); const o = await ev(() => G.outfit); const side = await p.locator('#panel .pbtn').count(); await tapSel('#panel .pbtn.go'); await p.waitForTimeout(1500);
    return `tabs:${tabs} tiles:${per.join('/')} outfit:${o} buttons:${side} closed:${await ev(() => document.getElementById('panel').classList.contains('hidden'))} still:${await ev(() => G.outfit)}`; });
  await F('drawing: draw, save, hang', 'dining', async () => { await ev(() => Studio.open()); await p.waitForTimeout(700); const top = await p.locator('#studio .s-top button').count(), tools = await p.locator('#studio .s-tools button').count(), cols = await p.locator('#studio .s-colors button').count();
    const r = await p.locator('#studio .s-paper').boundingBox(); await p.mouse.move(r.x + 50, r.y + 50); await p.mouse.down(); await p.mouse.move(r.x + 140, r.y + 110, { steps: 5 }); await p.mouse.up(); await tapSel('#studio .s-top button[aria-label=save]'); await p.waitForTimeout(900);
    const menu = await ev(() => [...document.querySelectorAll('.s-drawer .s-tile')].map(n => n.getAttribute('aria-label') || 'picture').join('|')); const w0 = await ev(() => Pics.walls.length); await tapSel('.s-drawer .s-hang'); await p.waitForTimeout(1300);
    return `top:${top} tools>5:${tools > 5} colours>5:${cols > 5} menu:${menu} hung:${await ev(() => Pics.walls.length) - w0} closed:${await ev(() => !Studio.active)}`; });
  await F('drawing: give to Mommy (she hangs it)', 'dining', async () => { await ev(() => Studio.open()); await p.waitForTimeout(700); const r = await p.locator('#studio .s-paper').boundingBox(); await p.mouse.move(r.x + 50, r.y + 50); await p.mouse.down(); await p.mouse.move(r.x + 140, r.y + 110, { steps: 5 }); await p.mouse.up(); await tapSel('#studio .s-top button[aria-label=save]'); await p.waitForTimeout(900);
    const w0 = await ev(() => Pics.walls.length); await tapSel('.s-drawer .s-give', 1); let t = 0; await p.waitForTimeout(3000); while (t < 45 && await ev(() => G.busy || G.sceneOn)) { await p.waitForTimeout(1000); t++; } return `finished:${t < 45} wallsAdded:${await ev(() => Pics.walls.length) - w0} gift:${await ev(() => (Pics.walls[Pics.walls.length - 1] || {}).gift)}`; });
  await F('crafts tabs open', 'dining', async () => { const o = []; for (const t of ['math', 'spell', 'cut', 'dio', 'gal']) { await ev(() => { document.getElementById('panel').classList.add('hidden'); }); await p.evaluate(t => UI.openCrafts(t), t); await p.waitForTimeout(500); o.push(t + ':' + await ev(() => !document.getElementById('panel').classList.contains('hidden') && document.querySelectorAll('#panel button').length)); } return o.join(' '); });
  await F('story: pick book, reader, read to the end', 'living', async () => { await ev(() => openStory()); await p.waitForTimeout(700); const books = await p.locator('.st-book').count(); await tapSel('.st-book', 0); await p.waitForTimeout(500); const readers = await p.locator('.st-reader').count(); await tapSel('.st-reader', 1); await p.waitForSelector('.st-end', { timeout: 120000 });
    const endBtns = await p.locator('.st-again').count(); await tapSel('.st-again.go'); await p.waitForTimeout(700); return `books:${books} readers:${readers} endButtons:${endBtns} closed:${await ev(() => !document.getElementById('storyBox') && !G.busy)}`; });
  await F('sticker book opens and closes', 'living', async () => { await ev(() => openStickers()); await p.waitForTimeout(400); const n = await p.locator('#stkBox .stk').count(); await tapSel('#stkBox .st-x'); await p.waitForTimeout(300); return `stickers:${n} closed:${await ev(() => !document.getElementById('stkBox'))}`; });
  await F('wish buttons take her to each activity', 'dining', async () => { const o = []; for (const k of ['cook', 'draw', 'fort', 'dress', 'outside', 'tv', 'niko', 'gym', 'swing', 'miles', 'music']) { await pg.fresh('dining'); await ev(() => { niko.room = 'kitchen'; }); await p.evaluate(k => showWish(k), k); await p.waitForTimeout(400); await tapSel('#wishBtn'); await p.waitForTimeout(4200);
      o.push(k + '→' + await ev(() => { const s = __snap(); return [s.room, s.panel ? 'panel' : '', s.studio ? 'studio' : '', s.menu ? 'menu' + s.menu : '', s.state !== 'idle' ? s.state : '', s.overlays].filter(Boolean).join('+'); })); } return o.join(' '); });
  await F('request: ask, do it, get thanked', 'dining', async () => { await ev(() => { rory.room = G.room; rory.hidden = false; rory.state = 'idle'; rory.x = marina.x + 50; G.rory = true; askRequest('gym'); }); await p.waitForTimeout(900); const btn = await p.locator('#reqBtn').count(); await tapSel('#reqBtn'); await p.waitForTimeout(900); const menu = await p.locator('.act').count();
    await ev(() => { UI.closeActions(); doGym(GYM[0]); }); await p.waitForTimeout(11000); return `button:${btn} menu:${menu > 0} thanked:${await ev(() => __said.includes('r_thanks'))}`; });
  await F('alerts: crying, poops, nappy, toilet paper, get down', 'kitchen', async () => { const o = [];
    await ev(() => { miles.crying = true; miles.cryT = 90; lastPing = -999; }); await p.waitForTimeout(700); o.push('cry:' + await p.locator('.alertb[aria-label=miles]').count()); await tapSel('.alertb[aria-label=miles]'); await p.waitForTimeout(2600); o.push('→' + await ev(() => G.room + '/' + document.querySelectorAll('.act').length));
    await pg.fresh('kitchen'); await ev(() => { G.poop = true; }); await p.waitForTimeout(700); await tapSel('.alertb[aria-label=poop]'); await p.waitForTimeout(2600); o.push('poop→' + await ev(() => G.room + '/' + document.querySelectorAll('.act').length)); await ev(() => { UI.closeActions(); G.busy = false; wrapPoop(); }); await p.waitForTimeout(800); o.push('bin+flush:' + await p.locator('.alertb[aria-label=pbin],.alertb[aria-label=pflush]').count()); await tapSel('.alertb[aria-label=pbin]'); await p.waitForTimeout(3000); o.push('binned:' + await ev(() => !G.holding + '@' + G.room));
    await pg.fresh('kitchen'); await ev(() => { miles.poopy = true; }); await p.waitForTimeout(700); await tapSel('.alertb[aria-label=nappy]'); await p.waitForTimeout(2600); o.push('nappy→' + await ev(() => G.room + '/' + entActions(miles).length));
    await pg.fresh('kitchen'); await ev(() => { daddy.state = 'toilet'; daddy.room = 'bathroom'; daddy.hidden = true; G.bathLocked = true; G.bathWho = daddy; G.tpEmpty = true; G.needTP = true; }); await p.waitForTimeout(700); await tapSel('.alertb[aria-label=tp]'); await p.waitForTimeout(9500); o.push('tp→' + await ev(() => G.room + ' freed:' + !G.bathLocked));
    await pg.fresh('dining'); await ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = marina.x + 30; daddy.y = marina.y; mount(daddy); }); await p.waitForTimeout(3500); o.push('riding:' + await ev(() => marina.state) + ' down:' + await p.locator('.alertb[aria-label=down]').count()); await tapSel('.alertb[aria-label=down]'); await p.waitForTimeout(1200); o.push('→' + await ev(() => marina.state));
    return o.join(' '); });
  await F('scenes: dinner, tea party, bath', 'dining', async () => { const o = []; await ev(() => propActions(PROPS.dining.find(q => q.id === 'table')).find(a => a.ico === '🍽️' || /familyMeal/.test(String(a.fn))).fn()); let t = 0; await p.waitForTimeout(2000); while (t < 40 && await ev(() => G.busy)) { await p.waitForTimeout(1000); t++; } o.push('dinner:' + (t < 40) + '/' + await ev(() => ['d_meal', 'mo_meal', 'r_meal'].filter(k => __said.includes(k)).length));
    await pg.fresh('playroom'); await ev(() => propActions(PROPS.playroom.find(q => q.a === 'kidtable')).find(a => /teaParty/.test(String(a.fn))).fn()); t = 0; await p.waitForTimeout(2000); while (t < 30 && await ev(() => G.busy)) { await p.waitForTimeout(1000); t++; } o.push('tea:' + (t < 30) + '/' + await ev(() => __said.includes('m_tea')));
    await pg.fresh('bathroom'); await ev(() => propActions(PROPS.bathroom.find(q => q.a === 'shower')).find(a => /bathTime/.test(String(a.fn))).fn()); t = 0; await p.waitForTimeout(2000); while (t < 20 && await ev(() => G.busy)) { await p.waitForTimeout(1000); t++; } o.push('bath:' + (t < 20) + '/' + await ev(() => __said.includes('m_clean'))); return o.join(' '); });
  await F('saved things survive a reload', 'dining', async () => { await ev(() => { award('tea'); localStorage.setItem('cm_looks', JSON.stringify([{ outfit: 'fairy' }])); }); const keys = await ev(() => Object.keys(localStorage).filter(k => k.startsWith('cm_')).sort().join(',')); await pg.fresh('dining'); await ev(() => openStickers()); await p.waitForTimeout(300); return `keys:${keys} stickerKept:${await p.locator('#stkBox .stk.got').count() > 0} newGameOutfit:${await ev(() => G.outfit)}`; });
  await pg.close(); return R;
}

(async () => {
  await H.serve(basePort, dir); const browser = await chromium.launch(); const res = { when: new Date().toISOString(), dir: dir || H.DIR };
  if (only !== 'flows') Object.assign(res, await sweepChoices(browser, basePort));
  if (only !== 'choices') res.flows = await flows(browser, basePort);
  fs.writeFileSync(out, JSON.stringify(res, null, 1)); await browser.close();
  if (res.results) { const bad = res.results.filter(r => r.result !== 'ok' || r.stuck || (r.errors && r.errors.length)); console.log('choices pressed:', res.results.length, '| problems:', bad.length); for (const b of bad.slice(0, 40)) console.log('  ', b.key, b.ico, b.result, b.stuck ? 'STUCK' : '', (b.errors || []).join(' ; ')); }
  console.log('written', out);
})();
