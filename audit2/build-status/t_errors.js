// zero page errors in port, land, portSmall, landSmall with all switches on and with G15,G23,G24 off, while exercising
// a mood scene (dims, dead taps, a scene-tap ring), an alert, a screen and a room change
const L = require('./lib.js');
(async () => {
  for (const off of ['', 'G15,G23,G24']) for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm();
    const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
    const tapSel = async sel => { const c = await ev(sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); return b.width > 2 ? [b.left + b.width / 2, b.top + b.height / 2] : null; }, sel); if (c) await P.touchscreen.tap(c[0], c[1]); return !!c; };
    await ev(() => { document.getElementById('moodbar').classList.remove('collapsed'); miles.poopy = true; marina.x = 40; miles.x = ROOMS.living.w - 40; mommy.holdingMiles = false; }); await wait(600);
    await tapSel('.mood[data-mood=love]'); await wait(900);
    for (const s of ['#roombar .rb[data-r=kitchen]', '#floorpill .fl.up', '.mood[data-mood=sad]', '.facecard.show']) { await tapSel(s); await wait(150); }
    await g.tapWorld(await ev(() => marina.x - 50), 150); await wait(500);
    for (let i = 0; i < 100 && await ev(() => G.busy || G.sceneOn); i++) await wait(250);
    await ev(() => { G.moodCtx = { type: 'greet', who: daddy }; UI.pulseMoods(); UI.pulseMoods(); }); await wait(300);
    await ev(() => UI.openDress()); await wait(600); await ev(() => UI.closePanel()); await wait(400);
    await ev(() => travelTo('kitchen')); await wait(2500);
    const errs = g.errors.filter(e => !/chip_love/.test(e)), chip = g.errors.filter(e => /chip_love/.test(e)).length;
    console.log(off || 'all-on', view, 'errors:', JSON.stringify(errs), 'chip_love warnings:', chip);
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
