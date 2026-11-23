// G24: the mood bar never moves during a pulse (faces keep their own wobble and stay on screen); a repeat hello within
// 5 minutes does not pulse but still unfolds a folded column and still sets the greeting, which a mood tap answers;
// every other context pulses every time and stops on setMood.     node t_g24.js bar|greet [off]
const L = require('./lib.js'), fs = require('fs');
const what = process.argv[2] || 'bar', off = process.argv[3] === 'off' ? 'G24' : '';
(async () => {
  const R = {};
  if (what === 'bar') for (const view of ['port', 'land', 'portSmall', 'landSmall', { width: 844, height: 340 }, { width: 390, height: 664 }]) {
    const name = typeof view === 'string' ? view : view.width + 'x' + view.height;
    const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm();
    const P = g.page, ev = (f, a) => P.evaluate(f, a);
    await ev(() => { document.getElementById('moodbar').classList.remove('collapsed'); G.moodCtx = { type: 'scold', who: daddy }; UI.pulseMoods(); });
    const s = [];
    for (let k = 0; k < 28; k++) { s.push(await ev(() => { const bar = document.getElementById('moodbar'), f = [...bar.querySelectorAll('.mood')].map(n => n.getBoundingClientRect());
      return { tf: getComputedStyle(bar).transform, pulse: bar.classList.contains('pulse'), faceAnim: getComputedStyle(bar.querySelector('.mood')).animationName, x0: Math.min(...f.map(r => r.left)), x1: Math.max(...f.map(r => r.right)), y0: Math.min(...f.map(r => r.top)), y1: Math.max(...f.map(r => r.bottom)), W: innerWidth, H: innerHeight }; }));
      if (k === 9) await g.shot(L.OUT + 'shots/g24_pulse_' + name + (off ? '_off' : '') + '.png'); await P.waitForTimeout(50); }
    R[name] = { barTransforms: [...new Set(s.map(x => x.tf))].length === 1 ? s[0].tf : 'varies (' + [...new Set(s.map(x => x.tf))].length + ' values)', pulse: s.every(x => x.pulse), faceAnim: [...new Set(s.map(x => x.faceAnim))],
      faces: { x0: Math.min(...s.map(x => x.x0)).toFixed(1), x1: Math.max(...s.map(x => x.x1)).toFixed(1), y0: Math.min(...s.map(x => x.y0)).toFixed(1), y1: Math.max(...s.map(x => x.y1)).toFixed(1), W: s[0].W, H: s[0].H },
      inside: s.every(x => x.x0 >= 0 && x.x1 <= x.W && x.y0 >= 0 && x.y1 <= x.H), errors: g.errors.filter(e => !/chip_love/.test(e)) };
    console.log(name, off || 'on', JSON.stringify(R[name]));
    await g.close();
  }
  if (what === 'greet') for (const view of ['land', 'port']) {
    const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm();
    const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
    const bar = () => ev(() => ({ pulse: document.getElementById('moodbar').classList.contains('pulse'), collapsed: document.getElementById('moodbar').classList.contains('collapsed'), ctx: G.moodCtx ? G.moodCtx.type + ':' + (G.moodCtx.who ? G.moodCtx.who.id : '-') : null }));
    const hello = async (e, fold) => { await ev(({ e, fold }) => { UI.unpulseMoods(); G.moodCtx = null; const p = window[e] || { daddy, mommy, rory }[e]; p.room = G.room; p.hidden = false; p.state = 'idle'; p.x = clamp(marina.x + 50, 20, ROOMS[G.room].w - 20);
        G.lastGreet[p.id] = E.t - 31; if (fold) document.getElementById('moodbar').classList.add('collapsed'); onEnterRoomBy(p); }, { e, fold });
      for (let i = 0; i < 40; i++) { await wait(200); if (await ev(() => G.moodCtx && G.moodCtx.type === 'greet')) break; } await wait(100); return bar(); };
    const r = R[view] = {};
    r.first = await hello('daddy', true); r.lastGlowDaddy = await ev(() => Clarity.G24 && Clarity.G24.lastGlow.daddy != null);
    r.repeat = await hello('daddy', true);
    // the mood tap answers the (unpulsed) greeting: ctx is consumed and a mood scene runs
    const c = await ev(() => { const b = document.querySelector('.mood[data-mood=happy]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await P.touchscreen.tap(c[0], c[1]); await wait(400); r.afterMoodTap = { ...(await bar()), scene: await ev(() => !!G.sceneOn), mood: await ev(() => G.mood) };
    for (let i = 0; i < 120 && await ev(() => G.busy || G.sceneOn); i++) await wait(250); await g.calm();
    r.otherPerson = await hello('mommy', true);
    await ev(() => { if (Clarity.G24) Clarity.G24.lastGlow.daddy = E.t - 301; }); r.after5min = await hello('daddy', true);
    // every other context pulses every time (twice in a row) and stops on setMood
    r.others = {};
    for (const [type, who] of [['scold', 'daddy'], ['refused', 'daddy'], ['refused_insta', 'mommy'], ['tvOff', 'daddy'], ['fortFell', null]]) {
      const a = []; for (let k = 0; k < 2; k++) { await ev(({ type, who }) => { UI.unpulseMoods(); G.moodCtx = { type, who: who ? { daddy, mommy }[who] : undefined }; if (!who) delete G.moodCtx.who; UI.pulseMoods(); }, { type, who }); a.push((await bar()).pulse); }
      r.others[type] = a.join(',');
    }
    await ev(() => { UI.unpulseMoods(); G.moodCtx = null; pressureEat(daddy); }); for (let i = 0; i < 30 && !(await bar()).pulse; i++) await wait(200); r.others.pressureEat = (await bar()).pulse;
    await ev(() => { G.moodCtx = null; G.pendingDish = null; });
    await g.calm(); await ev(() => { UI.unpulseMoods(); G.moodCtx = { type: 'scold', who: daddy }; UI.pulseMoods(); }); const before = (await bar()).pulse;
    const c2 = await ev(() => { const b = document.querySelector('.mood[data-mood=love]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await P.touchscreen.tap(c2[0], c2[1]); await wait(300); r.stopsOnSetMood = { before, after: (await bar()).pulse };
    r.errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(view, off || 'on', JSON.stringify(r)); await g.close();
  }
  fs.writeFileSync(L.OUT + 'g24_' + what + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
