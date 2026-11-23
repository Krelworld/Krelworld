// G15: 15-minute random-poke simulation; counts every Audio2.blip call (outermost) and which ones reached the game's own
// blip. With G15 on, the only calls that may disappear are (12,'square',0.08) within 60 ms of a dead mood tap.
//   node t_g15_poke.js <view> <minutes> [off] [seed]
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', mins = +(process.argv[3] || 15), off = process.argv[4] === 'off' ? 'G15' : '', seed = +(process.argv[5] || 7);
let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
(async () => {
  const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a);
  const moodTaps = []; let taps = 0, screenT = 0; const kinds = {};
  const tEnd = Date.now() + mins * 60000;
  while (Date.now() < tEnd) {
    // close any screen that has been open for 3 s, so the poke keeps exercising the HUD
    const scr = await ev(() => Clarity.screenOpen());
    if (scr) { if (!screenT) screenT = Date.now(); if (Date.now() - screenT > 3000) { await ev(() => { try { for (const k of ['Bricks', 'LegoShelf', 'Spa', 'Stuffies', 'Builder', 'Pool', 'TreeClimb', 'Movies']) if (window[k] && window[k].close) try { window[k].close(); } catch (e) { }
      if (window.Studio && Studio.active && Studio.close) Studio.close(); const x = document.querySelector('#storyBox .st-x,#stkBox .stk-ok'); if (x) { x.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); x.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }
      if (UI.panelMode) UI.closePanel(); } catch (e) { } }); screenT = 0; } } else screenT = 0;
    const r = rnd();
    const pick = await ev(r => {
      const vis = n => { const b = n.getBoundingClientRect(), cs = getComputedStyle(n); return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && b.right > 0 && b.left < innerWidth && b.bottom > 0 && b.top < innerHeight; };
      const st = document.getElementById('stage').getBoundingClientRect();
      if (r < 0.4) { const els = [...document.querySelectorAll('#moodbar .mood,#roombar .rb,#floorpill .fl,#alerts .alertb,#reqBtn,#wishBtn,.facecard.show,.navarrow,#fx .act')].filter(vis);
        if (els.length) { const n = els[Math.floor(r / 0.4 * els.length) % els.length], b = n.getBoundingClientRect(); const kind = n.classList.contains('mood') ? 'mood' : n.id || n.className.split(' ')[0];
          return { x: b.left + b.width / 2, y: b.top + b.height / 2, kind, moodDead: n.classList.contains('mood') ? (!!G.sceneOn || (!!G.busy && marina.state !== 'tantrum')) : null }; } }
      if (r < 0.85) return { x: st.left + 10 + ((r * 7919) % 1) * (st.width - 20), y: st.top + 10 + ((r * 104729) % 1) * (st.height - 20), kind: 'canvas' };
      return { x: ((r * 7919) % 1) * innerWidth, y: ((r * 104729) % 1) * innerHeight, kind: 'anywhere' };
    }, r);
    const t = await ev(() => performance.now());
    if (pick.kind === 'mood') moodTaps.push({ t, dead: pick.moodDead });
    kinds[pick.kind] = (kinds[pick.kind] || 0) + 1;
    await P.touchscreen.tap(pick.x, pick.y); taps++;
    await P.waitForTimeout(250 + Math.floor(rnd() * 400));
  }
  const exact = await ev(() => { const ms = __T.sh.filter(s => s.mood && !s.o), sk = __T.bl.filter(b => !b.ran);
    const matched = sk.filter(b => b.a.length === 3 && b.a[0] === 12 && b.a[1] === 'square' && b.a[2] === 0.08 && ms.some(s => b.t >= s.t && b.t - s.t <= 60));
    const moodBlipAfterShake = ms.filter(s => __T.bl.some(b => b.a[0] === 12 && b.a[1] === 'square' && b.t >= s.t && b.t - s.t <= 60));
    return { deadMoodShakes: ms.length, skipped: sk.length, skippedMatchedToDeadMoodShake: matched.length, deadMoodShakesWithMoodBlip: moodBlipAfterShake.length, deadMoodShakesWithMoodBlipSkipped: moodBlipAfterShake.filter(s => __T.bl.some(b => b.a[0] === 12 && b.a[1] === 'square' && !b.ran && b.t >= s.t && b.t - s.t <= 60)).length,
      ranMoodBlipsWithin60msOfDeadShake: __T.bl.filter(b => b.ran && b.a[0] === 12 && b.a[1] === 'square' && ms.some(s => b.t >= s.t && b.t - s.t <= 60)).length }; });
  const bl = await ev(() => __T.bl);
  const sig = b => b.a.join(','), count = l => l.reduce((m, b) => (m[sig(b)] = (m[sig(b)] || 0) + 1, m), {});
  const skipped = bl.filter(b => !b.ran), deadMood = moodTaps.filter(m => m.dead);
  const skippedOk = skipped.filter(b => b.a.length === 3 && b.a[0] === 12 && b.a[1] === 'square' && b.a[2] === 0.08 && deadMood.some(m => b.t >= m.t && b.t - m.t <= 60));
  const out = { view, mins, off: off || 'on', taps, kinds, moodTaps: moodTaps.length, deadMoodTaps: deadMood.length, blipCalls: bl.length, reachedGame: bl.length - skipped.length,
    skipped: skipped.length, skippedAreDeadMoodBlips: skippedOk.length, skippedOther: skipped.filter(b => !skippedOk.includes(b)).map(sig),
    nope: bl.filter(b => b.a[0] === -12 && b.a[1] === 'triangle').length, nopeSkipped: bl.filter(b => b.a[0] === -12 && b.a[1] === 'triangle' && !b.ran).length,
    exact, bySig: count(bl), errors: g.errors.filter(e => !/chip_love/.test(e)) };
  fs.writeFileSync(L.OUT + 'g15_poke_' + view + '_' + (off ? 'off' : 'on') + '.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
