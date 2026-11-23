// How long does pressing a mood face lock out other taps? Real touches only: tap a mood, then keep tapping the floor
// beside Marina every 400 ms until she actually walks. Starting room is set with the harness (setup only).
const Lb = require('./lib.js');
const fs = require('fs');
const OUT = Lb.OUT; const mode = process.argv[4] || 'on';
(async () => {
  const view = process.argv[2] || 'port', room = process.argv[3] || 'living';
  const g = await Lb.boot({ port: 8859, view, room, off: mode === 'on' ? '' : Lb.MINE });
  if (room !== 'living') { await g.page.evaluate(r => travelTo(r), room); await g.page.waitForTimeout(1500); }
  const res = [];
  for (const mood of ['love', 'happy', 'sad', 'angry', 'tantrum', 'love', 'happy', 'sad', 'angry', 'tantrum']) {
    // wait for a quiet moment
    for (let i = 0; i < 60; i++) { const q = await g.page.evaluate(() => !G.busy && !G.sceneOn && !document.querySelector('.act') && ['idle', 'walk'].includes(marina.state)); if (q) break; await g.page.waitForTimeout(250); }
    await g.page.evaluate(() => { UI.closeActions(); if (window.clearWish) clearWish(); });
    const who = await g.page.evaluate(() => ENTS.filter(e => e.here && !e.hidden && e !== marina).map(e => e.id).join(','));
    if (view === 'land') await g.page.evaluate(() => document.getElementById('moodbar').classList.remove('collapsed'));
    const t0 = Date.now();
    await g.tap('.mood[data-mood=' + mood + ']');
    let dead = 0, freed = null, busyEnd = null, arrowsGone = 0, side = 1; const lines = [];
    for (let k = 0; k < 60 && freed === null; k++) {
      await g.page.waitForTimeout(400);
      const pre = await g.page.evaluate(() => ({ x: marina.x, busy: !!G.busy, scene: !!G.sceneOn, ms: marina.state, arrows: [...document.querySelectorAll('.navarrow')].filter(n => !n.classList.contains('off')).length, pill: !document.getElementById('floorpill').classList.contains('off') }));
      if (!pre.arrows) arrowsGone++;
      if (busyEnd === null && !pre.busy && !pre.scene) busyEnd = Date.now() - t0;
      side = -side; const tx = await g.page.evaluate(s => clamp(marina.x + s * 40, 20, ROOMS[G.room].w - 20), side);
      await g.tapWorld(tx, 168);
      await g.page.waitForTimeout(300);
      const post = await g.page.evaluate(() => ({ x: marina.x, mv: !!marina.moving }));
      if (post.mv || Math.abs(post.x - pre.x) > 2) freed = Date.now() - t0; else dead++;
    }
    const said = await g.page.evaluate(() => 0);
    res.push({ view, room, mood, who, deadTaps: dead, firstWorkingTapMs: freed, busyEndedByMs: busyEnd, arrowsHiddenSamples: arrowsGone });
    console.log(JSON.stringify(res[res.length - 1]));
  }
  fs.writeFileSync(OUT + 'moods_' + mode + '_' + view + '_' + room + '.json', JSON.stringify(res, null, 1));
  await g.close();
})();
