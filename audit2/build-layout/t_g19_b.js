// G19 checks B: story time, folded lane look, full-screen screens cover the column, ▶ travels, the five moods answer real taps.
const { boot, OUT, MINE, R } = require('./lib.js'); const fs = require('fs');
(async () => {
  const res = {};
  for (const view of ['landSmall', 'land']) for (const off of ['', MINE]) {
    const name = view + (off ? '_TODAY' : '_G19'); const g = await boot({ view, room: 'living', off }); const p = g.page; const out = res[name] = {};
    await g.calm();
    // folded lane
    await p.evaluate(() => document.getElementById('moodbar').classList.add('collapsed')); await p.waitForTimeout(300);
    await g.shot(OUT + 'shots/g19b_' + name + '_folded.png');
    out.foldedTapAtFace = await p.evaluate(() => { const m = document.getElementById('moodbar').getBoundingClientRect(), n = document.elementFromPoint(m.left + m.width / 2, m.top + 100); return n && (n.id || n.className); });
    await p.evaluate(() => document.getElementById('moodbar').classList.remove('collapsed'));
    // story
    await p.evaluate(() => { G.busy = false; openStory(); }); await p.waitForTimeout(1500);
    await g.shot(OUT + 'shots/g19b_' + name + '_story.png');
    out.story = await p.evaluate(() => { const b = document.getElementById('storyBox'), st = document.getElementById('stage').getBoundingClientRect(), bb = b.getBoundingClientRect();
      const over = []; for (const n of b.querySelectorAll('*')) { const r = n.getBoundingClientRect(); if (r.width && (r.left < bb.left - 1 || r.right > bb.right + 1)) over.push(n.className); }
      const m = document.querySelector('.mood').getBoundingClientRect(), at = document.elementFromPoint(m.left + 10, m.top + 10);
      return { box: [Math.round(bb.left), Math.round(bb.right)], stage: [Math.round(st.left), Math.round(st.right)], over, barVis: getComputedStyle(document.getElementById('moodbar')).visibility, togVis: getComputedStyle(document.getElementById('moodToggle')).visibility, atFaceSpot: at && (at.id || at.className) }; });
    await p.evaluate(() => { const b = document.querySelector('.st-book'); b && b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await p.waitForTimeout(800);
    await p.evaluate(() => { const b = document.querySelector('.st-reader'); b && b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await p.waitForTimeout(1500);
    await g.shot(OUT + 'shots/g19b_' + name + '_story_page.png');
    out.storyPage = await p.evaluate(() => { const b = document.getElementById('storyBox'); if (!b) return 'closed'; const bb = b.getBoundingClientRect(), over = []; for (const n of b.querySelectorAll('*')) { const r = n.getBoundingClientRect(); if (r.width && (r.left < bb.left - 1 || r.right > bb.right + 1)) over.push(n.className); } return { over }; });
    await p.evaluate(() => { const x = document.querySelector('#storyBox .st-x'); x && x.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await p.waitForTimeout(600);
    out.afterStory = await p.evaluate(() => ({ storyGone: !document.getElementById('storyBox'), barVis: getComputedStyle(document.getElementById('moodbar')).visibility }));
    // full-screen screens cover the column (the panel is fixed over everything)
    out.screens = {};
    for (const [k, js] of [['cook', "UI.openCook('fridge')"], ['dress', 'UI.openDress()'], ['bricks', "Bricks.open({kind:'lego'})"], ['pool', 'Pool.open({})'], ['map', 'openIsoMap()']]) {
      await g.calm(); await p.evaluate(js => { G.busy = false; eval(js); }, js); await p.waitForTimeout(900);
      out.screens[k] = await p.evaluate(() => { const m = document.querySelector('.mood').getBoundingClientRect(), at = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2), t = document.getElementById('moodToggle').getBoundingClientRect(), at2 = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
        const inPanel = n => !!(n && n.closest && n.closest('#panel,#xFloat,#studio,#stkBox')); return (inPanel(at) ? 'covered' : 'FACE SHOWS:' + (at && (at.id || at.className))) + '/' + (inPanel(at2) ? 'covered' : 'HANDLE SHOWS:' + (at2 && (at2.id || at2.className))); });
      if (k === 'cook') await g.shot(OUT + 'shots/g19b_' + name + '_cook.png');
      await p.evaluate(() => { try { if (window.Bricks && Bricks.close) Bricks.close(); } catch (e) { } try { if (window.Pool && Pool.close) Pool.close(); } catch (e) { } try { UI.closePanel && UI.closePanel(); } catch (e) { } document.getElementById('panel').classList.add('hidden'); G.busy = false; });
      await p.waitForTimeout(500);
    }
    // ▶ travels: a real tap on the right arrow
    await g.calm(); await p.evaluate(() => { travelTo('kitchen'); }); await p.waitForTimeout(1500); await g.calm(); await p.waitForTimeout(600);
    const to = await p.evaluate(() => ROOMS[G.room].right);
    await p.evaluate(() => { for (const n of document.querySelectorAll('.navarrow')) n.classList.remove('off'); });
    await g.tap('.navarrow.r'); await p.waitForTimeout(4500);
    out.arrow = { expected: to, now: await p.evaluate(() => G.room) };
    // the five moods: a real tap on each face starts its scene (or her own reaction)
    out.moods = {};
    for (const m of ['love', 'happy', 'sad', 'angry', 'tantrum']) {
      await g.calm(); await p.evaluate(() => { G.busy = false; G.sceneOn = false; document.getElementById('moodbar').classList.remove('collapsed'); }); await p.waitForTimeout(300);
      await g.tap('.mood[data-mood=' + m + ']'); await p.waitForTimeout(700);
      out.moods[m] = await p.evaluate(() => ({ mood: G.mood, busy: !!G.busy, scene: !!G.sceneOn, st: marina.state, cur: (document.querySelector('.mood.cur') || {}).dataset.mood, toggle: document.getElementById('moodToggle').textContent }));
      await p.waitForTimeout(6000);
    }
    out.errors = g.errors;
    console.log(name, JSON.stringify(out));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g19_b.json', JSON.stringify(res, null, 1));
})();
