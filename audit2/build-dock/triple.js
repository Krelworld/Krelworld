// tap a thing three times like an impatient child; log the ring icons after each tap
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-dock/shots/';
(async () => {
  for (const [view, room, thing, off] of [['port', 'kitchen', 'fridge', 60], ['port', 'kitchen', 'stove', 60], ['port', 'playroom', 'keys', 60]]) {
    const g = await H.boot({ port: 8893, view, room, dir: '/home/user/Krelworld/.wt/dock/public/chef-marina' });
    await g.calm();
    await g.page.evaluate(([room, t, off]) => { for (const e of [daddy, mommy, rory, niko]) e.room = 'yard'; const p = PROPS[room].find(p => p.id === t); marina.x = p.x < ROOMS[room].w / 2 ? p.x + off : p.x - off; }, [room, thing, off]);
    await g.page.waitForTimeout(2500);
    const log = [];
    const ring = () => g.page.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent || (n.querySelector('img') ? 'img' : '?')).join(''));
    const where = () => g.page.evaluate(([room, t]) => { const p = PROPS[room].find(p => p.id === t); return [p.x, p.y - (p.h ? p.h / 3 : 15)]; }, [room, thing]);
    for (let i = 0; i < 3; i++) {
      const w = await where(); const t0 = Date.now(); const pt = await g.tapWorld(w[0], w[1]);
      const hit = await g.page.evaluate(([x, y]) => { const n = document.elementFromPoint(x, y); return n ? (n.id || n.className || n.tagName) : null; }, pt);
      let firstAt = null; while (Date.now() - t0 < 2300) { if (firstAt === null && (await ring())) firstAt = Date.now() - t0; await g.page.waitForTimeout(50); }
      const panel = await g.page.evaluate(() => !document.getElementById('panel').classList.contains('hidden')); const stk = await g.page.evaluate(() => !!document.getElementById('stkBox')); const dressUp = await g.page.evaluate(() => !!document.querySelector('#panel .dgrid, #panel .dprev'));
      log.push({ tap: i + 1, underFinger: String(hit).slice(0, 30), ringAfter: await ring(), ringFirstSeenMs: firstAt, panelOpen: panel, stickerBook: stk, dressUp, marinaX: await g.page.evaluate(() => Math.round(marina.x)) });
      if (panel) break;
      await g.shot(OUT + `triple_${view}_${room}_${thing}_${i + 1}.png`);
    }
    console.log(view, room, thing, JSON.stringify(log));
    await g.close();
  }
})();
