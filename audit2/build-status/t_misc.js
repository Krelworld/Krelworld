// Remaining must-still-work checks for G15 / G23 / G24.   node t_misc.js <view> [off]   (off = G15,G23,G24 all off)
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G15,G23,G24' : '';
(async () => {
  const R = {}; const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms), now = () => ev(() => performance.now()), tag = view + ' ' + (off ? 'off' : 'on');
  const center = sel => ev(sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); if (b.width < 2) return null; return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  const tapSel = async sel => { const c = await center(sel); if (!c) return false; await P.touchscreen.tap(c[0], c[1]); return true; };
  const waitQuiet = async () => { for (let i = 0; i < 160; i++) { if (await ev(() => !G.busy && !G.sceneOn)) return; await wait(250); } };
  const bring = () => ev(() => { UI.closeActions(); G.moodCtx = null; for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.here = true; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } if (innerWidth > innerHeight) document.getElementById('moodbar').classList.remove('collapsed'); });
  // a) alerts still work during a busy moment that is not a scene (the joke from Daddy's ring): bright, no nope, opens the gift menu
  await bring(); await ev(() => { G.holding = { type: 'pic', url: 'x.png' }; }); await wait(500);
  await g.tapWorld(await ev(() => daddy.x), await ev(() => daddy.y - 40)); await wait(600);
  const jk = await ev(() => { const n = [...document.querySelectorAll('.act')].find(n => n.textContent.includes('😜')); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  if (jk) { await P.touchscreen.tap(jk[0], jk[1]); await wait(900); }
  const st = await ev(() => ({ busy: !!G.busy, scene: !!G.sceneOn, app: document.getElementById('app').className, alert: (() => { const n = document.querySelector('#alerts .alertb[aria-label=picgive]'); return n ? getComputedStyle(n).opacity : null; })() }));
  const t = await now(); const tapped = await tapSel('#alerts .alertb[aria-label=picgive]'); await wait(600); const s = await ev(t => __T.since(t), t);
  R.alertNonScene = { jokeStarted: !!jk, during: st, tapped, shakes: s.shakes.length, nope: s.nope, after: await ev(() => ({ busy: !!G.busy, panel: !document.getElementById('panel').classList.contains('hidden'), acts: [...document.querySelectorAll('.act')].map(n => n.textContent).join('') })) };
  console.log(tag, 'alertNonScene', JSON.stringify(R.alertNonScene));
  await ev(() => { UI.closeActions(); if (UI.panelMode) UI.closePanel(); G.holding = null; }); await waitQuiet(); await g.calm();
  // b) the pill works the instant busy clears (no nope), and a live face card works (no shake)
  await bring(); await wait(300); await tapSel('.mood[data-mood=happy]');
  await P.waitForFunction(() => G.sceneOn, null, { polling: 'raf', timeout: 5000 }).catch(() => { });
  await P.waitForFunction(() => !G.busy && !G.sceneOn, null, { polling: 'raf', timeout: 30000 });
  const t2 = await now(); await tapSel('#floorpill .fl.up'); await wait(2500); const s2 = await ev(t => __T.since(t), t2);
  R.pillAfterBusy = { shakes: s2.shakes.length, nope: s2.nope, upBlip: s2.blips.filter(b => b.startsWith('12,triangle,0.06,0.12')).length, room: await ev(() => G.room) };
  console.log(tag, 'pillAfterBusy', JSON.stringify(R.pillAfterBusy));
  await ev(() => travelTo('living')); await wait(3500); await g.calm(); await bring(); await wait(300);
  await ev(() => { say('d_hi1', daddy); }); await wait(300);
  const t3 = await now(); const fc = await tapSel('.facecard.show[data-who=daddy]'); await wait(1500); const s3 = await ev(t => __T.since(t), t3);
  R.liveFace = { tapped: fc, shakes: s3.shakes.length, nope: s3.nope, ring: await ev(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join('')), nearDaddy: await ev(() => Math.abs(marina.x - daddy.x) < 60) };
  console.log(tag, 'liveFace', JSON.stringify(R.liveFace));
  await ev(() => UI.closeActions()); await waitQuiet(); await g.calm();
  // c) dragging Marina and swiping are unchanged
  const mpt = await ev(() => { marina.x = 160; marina.state = 'idle'; const [sx, sy] = Clarity.toClient(marina.x, marina.y - 30); return [sx, sy]; }); await wait(300);
  await P.evaluate(() => { window.__drop = null; });
  const cdp = await g.ctx.newCDPSession(P);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', mpt[0], mpt[1]); for (let k = 1; k <= 8; k++) { await touch('touchMove', mpt[0] + k * 10, mpt[1] + 4); await wait(30); } await touch('touchEnd', 0, 0); await wait(700);
  R.drag = await ev(() => ({ x: Math.round(marina.x), state: marina.state, busy: !!G.busy, room: G.room }));
  const sw = await ev(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left + r.width * 0.75, r.top + r.height * 0.3]; });
  await touch('touchStart', sw[0], sw[1]); for (let k = 1; k <= 8; k++) { await touch('touchMove', sw[0] - k * 18, sw[1]); await wait(25); } await touch('touchEnd', 0, 0); await wait(2500);
  R.swipe = await ev(() => G.room);
  console.log(tag, 'drag', JSON.stringify(R.drag), 'swipe ->', R.swipe);
  await ev(() => travelTo('living')); await wait(3000); await g.calm();
  // d) arrows hide on the monkey bars state too
  await ev(() => { marina.state = 'bars'; }); await wait(500); R.barsArrows = await ev(() => [...document.querySelectorAll('.navarrow')].map(b => b.classList.contains('off')).join(',')); await ev(() => { marina.state = 'idle'; }); await wait(400);
  // e) no idle wiggle while a ring is open (.actback covers the stage), even when forced
  await ev(() => { window.__RW = 0; let b = G.bounce; Object.defineProperty(G, 'bounce', { configurable: true, get() { return b; }, set(v) { b = v; if (v && /features\.js:600/.test(new Error().stack || '')) __RW++; } }); });
  await ev(() => { UI.actions(marina, selfActions()); }); await wait(300);
  for (let k = 0; k < 20; k++) { await ev(k => { lastInput = E.t - 30 - k * 0.001; hintT = 100; }, k); await wait(60); }
  R.ringOpenWiggles = { ringOpen: await ev(() => !!document.querySelector('#fx .act')), wiggles: await ev(() => __RW) };
  await ev(() => UI.closeActions()); await wait(200);
  for (let k = 0; k < 10; k++) { await ev(k => { lastInput = E.t - 40 - k * 0.001; hintT = 100; }, k); await wait(60); }
  R.ringOpenWiggles.afterClose = await ev(() => __RW);
  console.log(tag, 'barsArrows', R.barsArrows, 'ringOpenWiggles', JSON.stringify(R.ringOpenWiggles));
  // f) the 😊 toggle still folds and unfolds the column (landscape)
  if (view === 'land' || view === 'landSmall') { const a = await ev(() => document.getElementById('moodbar').classList.contains('collapsed')); await tapSel('#moodToggle'); await wait(200); const b = await ev(() => document.getElementById('moodbar').classList.contains('collapsed')); await tapSel('#moodToggle'); await wait(200); const c = await ev(() => document.getElementById('moodbar').classList.contains('collapsed'));
    R.toggle = [a, b, c].join('->'); console.log(tag, 'toggle', R.toggle); }
  R.errors = g.errors.filter(e => !/chip_love/.test(e)); console.log(tag, 'errors', JSON.stringify(R.errors));
  fs.writeFileSync(L.OUT + 'misc_' + view + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
