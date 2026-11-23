// G15 check 1: mood scenes from the bar and hug / joke from Daddy's ring (after an earlier 😢 scene), port and land.
// Face cards stay full colour; during the hug and the joke all five faces dim; during a bar scene only its face stays bright;
// the .cur outline stays visible (dimmed). Screenshots of a mood scene in port and land.
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view0 = process.argv[2];
(async () => {
  const out = {};
  for (const view of view0 ? [view0] : ['port', 'land']) {
    const g = await L.boot({ port: 8860, view, room: 'living' }); await g.calm(); await g.page.evaluate(INSTR);
    const bring = () => g.page.evaluate(() => { UI.closeActions(); for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.here = true; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); }
      if (innerWidth > innerHeight) document.getElementById('moodbar').classList.remove('collapsed'); });
    const waitQuiet = async () => { for (let i = 0; i < 120; i++) { if (await g.page.evaluate(() => !G.busy && !G.sceneOn)) return; await g.page.waitForTimeout(250); } };
    const tapAct = async ico => { const r = await g.page.evaluate(ico => { const n = [...document.querySelectorAll('#fx .act,.acttray .act')].find(n => n.textContent.includes(ico)); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, ico); if (!r) return false; await g.page.touchscreen.tap(r[0], r[1]); return true; };
    const run = async (name, start, shot) => {
      await waitQuiet(); await g.calm(); await bring(); await g.page.waitForTimeout(700);
      const ok = await start(); const samples = []; let shotDone = false; const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        const s = await g.page.evaluate(() => __T.snap()); samples.push(s);
        if (shot && !shotDone && s.busy && /cm-mood/.test(s.app) && Date.now() - t0 > 1800) { await g.shot(L.OUT + 'shots/g15_' + view + '_' + name + '.png'); shotDone = true; }
        if (!s.busy && !s.scene && samples.length > 3) break;
        await g.page.waitForTimeout(150);
      }
      const busy = samples.filter(s => s.busy), dimmed = busy.filter(s => /cm-mood/.test(s.app));
      const r = { started: ok, busySamples: busy.length, sceneSamples: busy.filter(s => s.scene).length, dimmedSamples: dimmed.length,
        awake: [...new Set(busy.flatMap(s => s.awake))], cur: [...new Set(busy.map(s => s.cur))], curOutline: [...new Set(busy.map(s => s.curOutline))],
        moodOpacity: Object.fromEntries(['love', 'happy', 'sad', 'angry', 'tantrum'].map(m => [m, [...new Set(dimmed.map(s => s.moods[m]))]])),
        faceCards: [...new Set(busy.flatMap(s => s.faces.map(f => f.who + ' o=' + f.o + ' f=' + f.f)))],
        stripOpacity: [...new Set(busy.filter(s => /cm-strip/.test(s.app)).map(s => s.rb && s.rb.o))], mapOpacity: [...new Set(busy.map(s => s.map && s.map.o))],
        appClasses: [...new Set(busy.map(s => s.app))], afterEnd: samples[samples.length - 1] };
      console.log(view, name, JSON.stringify(r)); return r;
    };
    const res = out[view] = {};
    res.love_bar = await run('love_bar', async () => { await g.tap('.mood[data-mood=love]'); return true; }, true);
    res.sad_bar = await run('sad_bar', async () => { await g.tap('.mood[data-mood=sad]'); return true; }, false);
    const ring = ico => async () => { await g.tapWorld(await g.page.evaluate(() => daddy.x), await g.page.evaluate(() => daddy.y - 40)); await g.page.waitForTimeout(600); return tapAct(ico); };
    res.hug_ring = await run('hug_ring', ring('🤗'), true);
    res.joke_ring = await run('joke_ring', ring('😜'), true);
    res.happy_bar = await run('happy_bar', async () => { await g.tap('.mood[data-mood=happy]'); return true; }, false);
    res.errors = g.errors.filter(e => !/chip_love/.test(e));
    await g.close();
  }
  fs.writeFileSync(L.OUT + 'g15_scenes' + (view0 ? '_' + view0 : '') + '.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
