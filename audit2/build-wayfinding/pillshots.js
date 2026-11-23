const { boot, OUT, H } = require('./lib.js');
const pw = require('playwright');
(async () => {
  for (const view of ['port', 'land']) for (const off of ['', 'G36,G38']) {
    // dpr 3 for a close look
    const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: H.VIEWS[view], isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8920/index.html'); await p.waitForTimeout(2500); await p.evaluate(() => startGame('kitchen')); await p.waitForTimeout(4000);
    for (const room of ['kitchen', 'den', 'uphall']) {
      await p.evaluate(r => { if (G.room !== r) travelTo(r); }, room); await p.waitForTimeout(1800);
      await p.evaluate(() => { G.busy = false; UI.closeActions(); });
      const pb = await p.locator('#floorpill').boundingBox();
      await p.screenshot({ path: OUT + `shots/pill3_${view}_${room}_${off ? 'off' : 'on'}.png`, clip: { x: 0, y: Math.max(0, pb.y - 70), width: pb.x + pb.width + 40, height: pb.height + 90 } });
    }
    await b.close();
  }
})();
