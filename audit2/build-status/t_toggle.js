const L = require('./lib.js');
(async () => {
  const g = await L.boot({ port: 8860, view: 'land', room: 'living' }); await g.calm();
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  const look = () => ev(() => ({ app: document.getElementById('app').className, rbOp: getComputedStyle(document.querySelector('#roombar .rb')).opacity, settled: document.querySelectorAll('.alertb.settled').length, born: document.querySelectorAll('.alertb[data-born]').length,
    arrowAnim: getComputedStyle(document.querySelector('.navarrow')).animationName, tpBg: (() => { const n = document.querySelector('.alertb[aria-label=tp]'); return n ? getComputedStyle(n).backgroundColor : null; })(), barAnim: getComputedStyle(document.getElementById('moodbar')).animationName }));
  await ev(() => { daddy.state = 'toilet'; daddy.room = 'bathroom'; daddy.hidden = true; G.bathLocked = true; G.bathWho = daddy; G.needTP = true; }); await wait(800);
  await ev(() => { const n = document.querySelector('.alertb[aria-label=tp]'); if (n) n.dataset.born = String(performance.now() - 20000); }); await wait(600);
  await ev(() => { G.busy = true; G.sceneOn = true; G.moodCtx = { type: 'scold', who: mommy }; UI.pulseMoods(); }); await wait(700);
  const r = { on: await look() };
  await ev(() => { Clarity.set('G15', false); Clarity.set('G23', false); Clarity.set('G24', false); }); await wait(400); r.off = await look();
  await ev(() => { Clarity.set('G15', true); Clarity.set('G23', true); Clarity.set('G24', true); }); await wait(700); r.onAgain = await look();
  await ev(() => { G.busy = false; G.sceneOn = false; }); await wait(300); r.cleared = await look();
  console.log(JSON.stringify(r, null, 0).replace(/},"/g, '},\n"')); console.log('errors', JSON.stringify(g.errors.filter(e => !/chip_love/.test(e)))); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
