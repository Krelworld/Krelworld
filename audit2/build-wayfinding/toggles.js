// Switches flipped at run time (Clarity.set) for G35-G39: each goes back to today's look at once, and comes back when on.
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
(async () => {
  const R = {};
  const g = await boot({ view: 'port', room: 'kitchen', storage: { cm_builds: TH } }); await g.calm();
  // G35
  await g.go('den', 1500); await g.ev(() => { marina.x = 120; }); await g.wait(2200);
  const drawnNow = () => g.ev(() => Clarity.G35.signs.some(s => s.at && performance.now() - s.at < 150));
  R.G35 = { on: await drawnNow() }; await g.ev(() => Clarity.set('G35', false)); await g.wait(500); R.G35.off = await drawnNow();
  await g.ev(() => Clarity.set('G35', true)); await g.wait(800); R.G35.onAgain = await drawnNow();
  // G38
  R.G38 = { on: await g.ev(() => getComputedStyle(document.getElementById('roombar')).backgroundColor + ' dest=' + [...document.querySelectorAll('#floorpill .fl')].map(b => b.dataset.dest || '-').join(',')) };
  await g.ev(() => Clarity.set('G38', false)); await g.wait(400);
  R.G38.off = await g.ev(() => getComputedStyle(document.getElementById('roombar')).backgroundColor + ' dest=' + [...document.querySelectorAll('#floorpill .fl')].map(b => b.dataset.dest || '-').join(',') + ' shadow=' + getComputedStyle(document.querySelector('#floorpill .fl.up')).boxShadow);
  await g.ev(() => Clarity.set('G38', true)); await g.wait(500); R.G38.onAgain = await g.ev(() => getComputedStyle(document.getElementById('roombar')).backgroundColor + ' dest=' + [...document.querySelectorAll('#floorpill .fl')].map(b => b.dataset.dest || '-').join(','));
  // G36 pill badge size
  R.G36 = { on: await g.ev(() => getComputedStyle(document.querySelector('#floorpill .fl i')).fontSize) }; await g.ev(() => Clarity.set('G36', false)); await g.wait(300);
  R.G36.off = await g.ev(() => getComputedStyle(document.querySelector('#floorpill .fl i')).fontSize + ' ' + ROOMS.nunuroom.ico + ' strip:' + document.querySelector('#roombar .rb[data-r=nunuroom]').textContent); await g.ev(() => Clarity.set('G36', true)); await g.wait(300);
  R.G36.onAgain = await g.ev(() => getComputedStyle(document.querySelector('#floorpill .fl i')).fontSize + ' ' + ROOMS.nunuroom.ico + ' strip:' + document.querySelector('#roombar .rb[data-r=nunuroom]').textContent);
  // G37 with the map open (she is in the den: face on her tile, ⬆️ row above the house)
  const mapState = () => g.ev(() => ({ moved: !!document.querySelector('#panel > .fmaprow'), spacers: document.querySelectorAll('.cm-g37-sp,.cm-g37-sp2').length, faces: document.querySelectorAll('.cm-g37-you,.cm-g37-face').length, ppl: document.querySelectorAll('.cm-g37-ppl').length, lines: document.querySelectorAll('.cm-outline').length, dots: document.querySelectorAll('.rb.cm-gp').length, rows: [...document.querySelectorAll('.fmap > .fmaprow')].map(n => n.firstChild.textContent).join(''), hereAnim: getComputedStyle(document.querySelector('.fmaproom.here')).animationName }));
  await g.ev(() => { nunu.room = 'den'; nunu.hidden = false; openIsoMap(); }); await g.wait(700);
  R.G37 = { on: await mapState() }; await g.ev(() => Clarity.set('G37', false)); await g.wait(400); R.G37.off = await mapState();
  await g.ev(() => Clarity.set('G37', true)); await g.wait(500); R.G37.onAgain = await mapState();
  await g.ev(() => document.querySelector('#panel .ptop button').click()); await g.wait(300);
  // G39: next cross-floor arrival
  const arrive = async () => { await g.ev(() => { window.__a = null; Floors.hooks.push(function h(w, r) { const a = E.cv.getAnimations()[0]; window.__a = a ? a.effect.getKeyframes()[0].transform : null; Floors.hooks.splice(Floors.hooks.indexOf(h), 1); }); Floors.go(1); }); await g.wait(600); return g.ev(() => __a); };
  R.G39 = { on: await arrive() }; await g.wait(800); await g.ev(() => Clarity.set('G39', false)); await g.go('den', 1500); R.G39.off = await arrive();
  await g.ev(() => Clarity.set('G39', true)); await g.go('den', 1500); R.G39.onAgain = await arrive();
  R.errors = g.realErrors(); await g.close();
  fs.writeFileSync(OUT + 'toggles.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
