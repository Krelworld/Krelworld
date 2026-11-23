// sped-up play session (from inv/prompts/sim.js) with switch control and extra instrumentation.
// usage: node sim2.js <floor> <mode> <minutes> <view> <seed> <off|-> <tag> [postSec=60] [port=8851] [dir]
//   floor: main | basement | upstairs | outside | backyard | pool     mode: idle | walk | act:<name> | still:<swing|bars>
//   off: '-' (all on) | 'G1,G2,...' | 'all'.   act: activity open (mins*60 - postSec) s, then closed, then postSec s with no touches.
const L = require('./lib.js'); const H = L.H; const { chromium } = require('playwright'); const fs = require('fs');
const [floor = 'main', mode = 'idle', mins = '15', view = 'port', seed = '1', offA = '-', tag = 'x', postS = '60', portS = '8851', dirA] = process.argv.slice(2);
const off = offA === '-' ? '' : offA, post = +postS * 1000, port = +portS, dir = dirA || L.DIR;
const FLOORS = { main: { start: 'kitchen', rooms: ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom'] }, basement: { start: 'den', rooms: ['nunuroom', 'den', 'storage', 'laundry'] },
  upstairs: { start: 'mroom', rooms: ['parents', 'uphall', 'mroom', 'milesroom'] }, outside: { start: 'backyard', rooms: ['pool', 'yard', 'backyard'] },
  backyard: { start: 'backyard', rooms: ['backyard'] }, pool: { start: 'pool', rooms: ['pool'] }, dining: { start: 'dining', rooms: ['dining'] }, yard: { start: 'yard', rooms: ['yard'] } };
const ACTS = {
  cook: ['kitchen', 'UI.openCook("fridge")', 'UI.closePanel()'], draw: ['playroom', 'Studio.open()', 'Studio.close && Studio.close()'], story: ['living', 'openStory()', 'document.querySelector("#storyBox .st-x") && document.querySelector("#storyBox .st-x").dispatchEvent(new PointerEvent("pointerup",{bubbles:true}))'],
  tv: ['living', 'tvOn(showList()[0])', 'tvOff()'], dress: ['kitchen', 'UI.openDress()', 'UI.closePanel()'], swing: ['yard', 'yardToy("saucer")', 'stopActivity()'],
  lego: ['den', 'Bricks.open({kind:"lego"})', 'Bricks.close()'], movie: ['den', 'Movies.open({})', 'Movies.close()'], spa: ['spa', 'Spa.open({})', 'Spa.close()'], stuffies: ['mroom', 'Stuffies.open({})', 'Stuffies.close()'],
  pool: ['pool', 'Pool.open({})', 'Pool.close()'], build: ['backyard', 'Builder.open({})', 'Builder.close()'], tree: ['backyard', 'TreeClimb.open({tree:"oak"})', 'TreeClimb.close()'],
};
let rs = +seed * 9301 + 49297; const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
(async () => {
  await H.serve(port, port === 8847 ? undefined : dir);
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS[view], isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  await ctx.addInitScript({ path: L.OUT + 'vt.js' });
  await ctx.addInitScript(s => { Math.random = (() => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; })(); }, +seed * 7919 + 17);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message)); page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load|chip_love|willRead/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${port}/index.html`); await page.waitForTimeout(3000);
  const F = FLOORS[floor];
  await page.evaluate(() => startGame()); await page.waitForTimeout(1500);
  await page.evaluate(() => __vt.virtual(50));
  await page.addScriptTag({ path: L.OUT + 'inst.js' }); await page.addScriptTag({ path: L.OUT + 'inst2.js' });
  const run = ms => page.evaluate(m => __vt.run(m), ms);
  await run(2000);
  if (!mode.startsWith('act:')) { await page.evaluate(r => { if (G.room !== r) travelTo(r); }, F.start); await run(3000); }
  if (mode.startsWith('still:')) {   // get on the swing / the monkey bars and stay there
    const k = mode.slice(6);
    await page.evaluate(() => { if (G.room !== 'yard') travelTo('yard'); }); await run(3000);
    await page.evaluate(k => { G.rory = true; rory.hidden = false; rory.room = 'yard'; rory.x = 200; rory.state = 'idle'; yardToy(k === 'swing' ? 'saucer' : 'bars'); }, k); await run(5000);
  }
  await page.evaluate(() => __L('mark', { what: 'start' }));
  const tapFloor = () => page.evaluate(r => { const st = document.getElementById('stage').getBoundingClientRect();
    const wx = E.camX + E.viewW * (0.12 + 0.76 * r), [sx, sy] = toScreen(wx, 168); const x = st.left + sx, y = st.top + sy;
    const tgt = document.elementFromPoint(x, y); if (!tgt || tgt.id !== 'cv') { __L('mark', { what: 'tap skipped (button over floor: ' + (tgt && (tgt.id || tgt.className)) + ')' }); UI.closeActions(); return; } for (const t of ['pointerdown', 'pointerup']) tgt.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true })); }, rnd());
  let act = null;
  if (mode.startsWith('act:')) { act = ACTS[mode.slice(4)]; await page.evaluate(r => { if (G.room !== r) travelTo(r); }, act[0]); await run(3000); await page.evaluate(() => __L('mark', { what: 'open' })); await page.evaluate(act[1]); await run(500); }
  const total = +mins * 60 * 1000; let t = 0, nextTap = 4000, nextRoom = 45000; const realT0 = Date.now();
  while (t < total) {
    await run(1000); t += 1000;
    if (mode === 'walk') {
      if (t >= nextTap) { nextTap = t + 5000 + rnd() * 4000; await tapFloor(); }
      if (t >= nextRoom) { nextRoom = t + 40000 + rnd() * 30000; await page.evaluate(([rooms, r]) => { const R = ROOMS[G.room], opts = [R.left, R.right].filter(x => x && rooms.includes(x)); const to = opts.length ? opts[Math.floor(r * opts.length)] : null; if (to && !G.busy) { __L('mark', { what: 'go ' + to }); travelTo(to); } }, [F.rooms, rnd()]); }
    }
    if (mode.startsWith('still:') && t % 5000 === 0) { const st = await page.evaluate(() => marina.state); if (!['swing', 'bars'].includes(st)) await page.evaluate(() => __L('mark', { what: 'off the toy: ' + marina.state })); }
    if (act && t < total - post) { const open = await page.evaluate(n => { const on = { draw: () => !!(window.Studio && Studio.active), story: () => !!document.getElementById('storyBox'), tv: () => !!G.tv, swing: () => marina.state === 'swing' }[n]; return on ? on() : !document.getElementById('panel').classList.contains('hidden'); }, mode.slice(4)); if (!open && t < total - post - 2000) { await page.evaluate(() => __L('mark', { what: 'activity closed by itself' })); await page.evaluate(act[1]); } }
    if (act && t === total - post) { await page.evaluate(() => __L('mark', { what: 'close' })); await page.evaluate(act[2]); }
  }
  const out = await page.evaluate(() => ({ log: __log, occ: __occ, Et: E.t }));
  out.meta = { floor, mode, mins: +mins, view, seed: +seed, off, port, realMs: Date.now() - realT0, errors };
  const f = L.OUT + 'logs/' + [tag, floor, mode.replace(':', '-'), mins + 'm', view, 's' + seed].join('_') + '.json';
  fs.mkdirSync(L.OUT + 'logs', { recursive: true }); fs.writeFileSync(f, JSON.stringify(out)); console.log('wrote', f, 'events', out.log.length, 'realMs', out.meta.realMs, 'errors', errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error('SIMFAIL', process.argv.slice(2).join(' '), e.message); process.exit(1); });
