// G15: re-run of first-minutes moods.js (tap a mood, then tap the floor beside Marina every 400 ms until she walks), with
// G15 on or off. Measures time to the first working tap and, per dead tap, how many answers it got (grey ring + low blip).
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', room = process.argv[3] || 'living', off = process.argv[4] === 'off' ? 'G15' : '';
(async () => {
  const g = await L.boot({ port: 8860, view, room, off }); await g.page.evaluate(INSTR);
  if (room !== 'living') { await g.page.evaluate(r => travelTo(r), room); await g.page.waitForTimeout(1500); }
  const res = [];
  for (const mood of ['love', 'happy', 'sad', 'angry', 'tantrum', 'love', 'happy', 'sad', 'angry', 'tantrum']) {
    for (let i = 0; i < 60; i++) { const q = await g.page.evaluate(() => !G.busy && !G.sceneOn && !document.querySelector('.act') && ['idle', 'walk'].includes(marina.state)); if (q) break; await g.page.waitForTimeout(250); }
    await g.page.evaluate(() => { UI.closeActions(); if (window.clearWish) clearWish(); });
    const who = await g.page.evaluate(() => ENTS.filter(e => e.here && !e.hidden && e !== marina).map(e => e.id).join(','));
    if (view === 'land') await g.page.evaluate(() => document.getElementById('moodbar').classList.remove('collapsed'));
    const t0 = Date.now();
    await g.tap('.mood[data-mood=' + mood + ']');
    let dead = 0, freed = null, busyEnd = null, side = 1; const answers = [];
    for (let k = 0; k < 60 && freed === null; k++) {
      await g.page.waitForTimeout(400);
      const pre = await g.page.evaluate(() => ({ x: marina.x, busy: !!G.busy, scene: !!G.sceneOn, t: performance.now() }));
      if (busyEnd === null && !pre.busy && !pre.scene) busyEnd = Date.now() - t0;
      side = -side; const tx = await g.page.evaluate(s => clamp(marina.x + s * 40, 20, ROOMS[G.room].w - 20), side);
      await g.tapWorld(tx, 168);
      await g.page.waitForTimeout(300);
      const post = await g.page.evaluate(t => ({ x: marina.x, mv: !!marina.moving, s: __T.since(t) }), pre.t);
      if (post.mv || Math.abs(post.x - pre.x) > 2) freed = Date.now() - t0;
      else { dead++; answers.push({ scene: post.s.taps.length ? post.s.taps[0].scene : pre.scene, busy: post.s.taps.length ? post.s.taps[0].busy : pre.busy, rings: post.s.rings.length, nope: post.s.nope }); }
    }
    const inScene = answers.filter(a => a.scene), notScene = answers.filter(a => !a.scene);
    const r = { view, room, mood, who, deadTaps: dead, firstWorkingTapMs: freed, busyEndedByMs: busyEnd,
      sceneDead: inScene.length, sceneDeadAnsweredOnce: inScene.filter(a => a.rings === 1 && a.nope === 1).length, sceneDeadOther: inScene.filter(a => !(a.rings === 1 && a.nope === 1)).map(a => a.rings + '/' + a.nope),
      nonSceneDead: notScene.length, nonSceneAnswers: notScene.map(a => a.rings + '/' + a.nope + (a.busy ? ' busy' : ' free')) };
    res.push(r); console.log(JSON.stringify(r));
  }
  fs.writeFileSync(L.OUT + 'g15_moods_' + view + '_' + room + (off ? '_off' : '') + '.json', JSON.stringify(res, null, 1));
  console.log('errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
