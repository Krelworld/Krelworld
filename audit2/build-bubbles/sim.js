// sped-up play session on the bubbles worktree (virtual time). usage:
//   node sim.js <floor> <minutes> <seed> [off] [extra]
//   floor: basement | outside | upstairs | main      off: CLARITY_OFF value or '-'      extra: 'tell' = after the first smell, tell Daddy (G.septic=false as tellDaddy does) and run 6 more minutes
// logs every voice key (the final key say() hands to Audio2.voice), every bubble icon, smells, and the 📞 bubble's life.
const L = require('./lib.js'); const H = L.H; const { chromium } = require('playwright'); const fs = require('fs');
const [floor = 'basement', mins = '15', seed = '1', off = '-', extra = ''] = process.argv.slice(2);
const FLOORS = { main: { start: 'kitchen', rooms: ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom'] }, basement: { start: 'den', rooms: ['nunuroom', 'den', 'storage', 'laundry'] },
  upstairs: { start: 'mroom', rooms: ['parents', 'uphall', 'mroom', 'milesroom'] }, outside: { start: 'backyard', rooms: ['pool', 'yard', 'backyard'] } };
let rs = +seed * 9301 + 49297; const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
const PORT = 8882;
(async () => {
  await H.serve(PORT, L.DIR);
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: H.VIEWS.port, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (off !== '-') await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  await ctx.addInitScript({ path: L.OUT + 'vt.js' });
  await ctx.addInitScript(s => { Math.random = (() => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; })(); }, +seed * 7919 + 17);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message)); page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load|chip_love|willReadFrequently/.test(m.text())) errors.push(m.type() + ' ' + m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`); await page.waitForTimeout(3000);
  const F = FLOORS[floor];
  await page.evaluate(() => startGame()); await page.waitForTimeout(1500);
  await page.evaluate(() => __vt.virtual(50));
  await page.evaluate(() => {
    window.__keys = {}; window.__bub = {}; window.__sm = []; window.__call = { frames: 0, shownAt: [], overlaps: [] };
    const _v = Audio2.voice; Audio2.voice = function (k) { __keys[k] = (__keys[k] || 0) + 1; if (/^nu_smell/.test(k)) __sm.push(+E.t.toFixed(1)); return _v.apply(this, arguments); };
    const _b = UI.bubble; UI.bubble = function (ent, icon) { __bub[icon] = (__bub[icon] || 0) + 1; return _b.apply(this, arguments); };
    // the 📞 bubble: how long it shows, and whether it ever overlaps a .say, a give bubble, an alert, an arrow or the pill
    setInterval(() => { const c = document.querySelector('.cm-call'); if (!c) return; __call.frames++; const r = c.getBoundingClientRect(); if (r.width < 2) return;
      const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      for (const n of document.querySelectorAll('.say,.pichint,.alertb,.navarrow:not(.off),#floorpill .fl:not(.off),.act')) { const o = ov(r, n.getBoundingClientRect()); if (o > 4 && getComputedStyle(n).display !== 'none') __call.overlaps.push([+E.t.toFixed(1), n.className.split(' ')[0], Math.round(o), document.querySelectorAll('.say').length]); }
      if (!__call.last || E.t - __call.last > 1) __call.shownAt.push([+E.t.toFixed(1), G.room]); __call.last = E.t; }, 250);
  });
  const run = ms => page.evaluate(m => __vt.run(m), ms);
  await run(2000);
  await page.evaluate(r => { if (G.room !== r) travelTo(r); }, F.start); await run(3000);
  const tapFloor = () => page.evaluate(r => { const st = document.getElementById('stage').getBoundingClientRect();
    const wx = E.camX + E.viewW * (0.12 + 0.76 * r), [sx, sy] = toScreen(wx, 168); const x = st.left + sx, y = st.top + sy;
    const tgt = document.elementFromPoint(x, y); if (!tgt || tgt.id !== 'cv') { UI.closeActions(); return; } for (const t of ['pointerdown', 'pointerup']) tgt.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true })); }, rnd());
  const walk = async total => { let t = 0, nextTap = 4000, nextRoom = 45000;
    while (t < total) { await run(1000); t += 1000;
      if (t >= nextTap) { nextTap = t + 5000 + rnd() * 4000; await tapFloor(); }
      if (t >= nextRoom) { nextRoom = t + 40000 + rnd() * 30000; await page.evaluate(([rooms, r]) => { const R = ROOMS[G.room], opts = [R.left, R.right].filter(x => x && rooms.includes(x)); const to = opts.length ? opts[Math.floor(r * opts.length)] : null; if (to && !G.busy) travelTo(to); }, [F.rooms, rnd()]); }
    } };
  const realT0 = Date.now();
  const idle = async total => { let t = 0; while (t < total) { await run(5000); t += 5000; await page.evaluate(r => { if (G.room !== r && !G.busy) travelTo(r); G.tidy = false; }, F.start); } };
  let out;
  if (extra === 'gate') {      // idle in Nunu's den: wait for the first smell, then 15 untold minutes, then tell Daddy and 8 more
    let t = 0; while (t < 40 * 60000 && !(await page.evaluate(() => __sm.length))) { await idle(10000); t += 10000; }
    const first = await page.evaluate(() => ({ smells: __sm.slice(), septic: !!G.septic, Et: +E.t.toFixed(1) }));
    await idle(+mins * 60000);
    out = { first, untold: await page.evaluate(() => ({ smells: __sm.slice(), septic: !!G.septic, Et: +E.t.toFixed(1) })) };
    await page.evaluate(() => { G.septic = false; G.septicTold = true; });
    await idle(8 * 60000);
    out.afterTell = await page.evaluate(() => ({ smells: __sm.slice(), septic: !!G.septic, Et: +E.t.toFixed(1) }));
  } else { await walk(+mins * 60000); out = { untold: await page.evaluate(() => ({ smells: __sm.slice(), septic: !!G.septic, Et: +E.t.toFixed(1) })) }; }
  if (extra === 'tell') {
    await page.evaluate(() => { G.septic = false; G.septicTold = true; });
    await walk(6 * 60000);
    out.afterTell = await page.evaluate(() => ({ smells: __sm.slice(), septic: !!G.septic, Et: +E.t.toFixed(1) }));
  }
  Object.assign(out, await page.evaluate(() => ({ keys: __keys, bubbles: __bub, call: { frames: __call.frames, shownAt: __call.shownAt, overlaps: __call.overlaps.slice(0, 40), nOverlaps: __call.overlaps.length } })));
  out.meta = { floor, mins: +mins, seed: +seed, off, extra, realMs: Date.now() - realT0, errors };
  const f = L.OUT + 'sims/' + [floor, mins + 'm', 's' + seed, off === '-' ? 'on' : 'off-' + off.replace(/,/g, '_'), extra].filter(Boolean).join('_') + '.json';
  fs.mkdirSync(L.OUT + 'sims', { recursive: true }); fs.writeFileSync(f, JSON.stringify(out));
  console.log('wrote', f, out.first ? 'first ' + JSON.stringify(out.first) : '', 'smells', JSON.stringify(out.untold), out.afterTell ? 'afterTell ' + JSON.stringify(out.afterTell) : '', 'call frames', out.call.frames, 'overlaps', out.call.nOverlaps, 'realMs', out.meta.realMs, 'errors', errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
