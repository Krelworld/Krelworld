// G5 checks: speech bubbles vs strip / pill / map / alerts; above the head with no alerts; no jitter; bigIcon centred and never blocking alerts.
// usage: node t_g5.js [off]   (off = CLARITY_OFF value, for the today comparison)
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] || '';
const tag = OFF ? '_off' : '';
(async () => {
  const res = { views: {} };
  for (const view of ['port', 'land', 'landSmall', 's844x340']) {
    const g = await L.boot({ view: L.VIEWS[view], room: 'living', off: OFF }); await g.calm(); const P = g.page; const V = res.views[view] = { cases: [] };
    await P.addStyleTag({ content: '.cm-test-pe .say{pointer-events:auto!important}' });
    // Marina stands to one side; wait for the camera to settle before placing anyone
    await P.evaluate(async () => { marina.stop && marina.stop(); marina.x = 160; marina.state = 'idle'; let last = -1; for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    for (const nAlerts of [0, 1, 2, 3]) for (const y of [150, 164, 178]) {
      const r = await P.evaluate(async ([nAlerts, y]) => {
        G.busy = false; UI.closeActions();
        // alerts: Miles crying, Niko's poop, the toilet-paper rescue
        miles.room = 'bathroom'; miles.crying = nAlerts >= 1; miles.cryT = 99; G.poop = nAlerts >= 2; G.needTP = nAlerts >= 3; G.bathLocked = nAlerts >= 3;
        for (const e of [daddy, mommy]) { AI.hold(e, true); e.stop(); e.room = 'living'; e.state = 'idle'; e.hidden = false; }
        const cx = E.camX + E.viewW / 2; daddy.x = cx - 22; mommy.x = cx + 22; daddy.y = y; mommy.y = y;
        await new Promise(r => setTimeout(r, 700));      // alerts are refreshed every 250 ms
        UI.bubble(daddy, '👋', 4000); UI.bubble(mommy, '🍳', 4000);
        await new Promise(r => setTimeout(r, 450));      // pop animation done
        const st = document.getElementById('stage').getBoundingClientRect();
        const B = r => [r.left, r.top, r.right, r.bottom].map(v => Math.round(v));
        const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        const blockers = [...document.querySelectorAll('.alertb,#roombar .rb,#floorpill .fl:not(.off),#mapBtn,#roombar')].map(n => ({ k: n.id ? '#' + n.id : '.' + n.className.split(' ')[0] + (n.getAttribute('aria-label') ? '[' + n.getAttribute('aria-label') + ']' : ''), b: B(n.getBoundingClientRect()) })).filter(x => x.b[2] - x.b[0] > 2);
        document.body.classList.add('cm-test-pe');
        const out = [];
        for (const n of [...document.querySelectorAll('#fx .say')].filter(x => (x.textContent === '👋' || x.textContent === '🍳') && x.getAnimations().every(q => q.playState === 'finished'))) {
          const b = B(n.getBoundingClientRect()), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], el = document.elementFromPoint(c[0], c[1]);
          const top = el && (el.closest('.say') ? '.say' : el.closest('.alertb') ? '.alertb' : el.closest('.rb') ? '.rb' : el.closest('.fl') ? '.fl' : el.id ? '#' + el.id : el.className);
          const who = n.textContent === '👋' ? daddy : mommy, vb = visBox(who === daddy ? 'daddy' : 'mommy'), headTop = toScreen(who.x, who.y + (who === mommy ? 2 : 0) + vb[1])[1] + st.top, cxScreen = toScreen(who.x, 0)[0] + st.left;
          out.push({ who: who.id, box: b, translate: n.style.translate || '', centreTop: top, hits: blockers.filter(x => ov(b, x.b) > 0).map(x => x.k + ':' + ov(b, x.b)), bottomMinusHead: Math.round(b[3] - headTop), centreXminusSpeaker: Math.round(c[0] - cxScreen) });
        }
        document.body.classList.remove('cm-test-pe');
        return { alerts: [...document.querySelectorAll('.alertb')].map(n => n.getAttribute('aria-label')).join(','), out };
      }, [nAlerts, y]);
      V.cases.push({ nAlerts, y, ...r });
      if ((nAlerts === 3 || nAlerts === 0) && y === 150) await g.shot(L.OUT + 'g5' + tag + '_' + view + '_a' + nAlerts + '_y' + y + '.png');
      await P.waitForTimeout(150);
    }
    // jitter: speaker standing still with 3 pulsing alerts, bubble near the alert row: sample every frame for 1.6 s
    V.jitter = await P.evaluate(async () => {
      miles.crying = true; G.poop = true; G.needTP = true; G.bathLocked = true;
      const cx = E.camX + E.viewW / 2; daddy.x = cx; daddy.y = 164; await new Promise(r => setTimeout(r, 600));
      UI.bubble(daddy, '👋', 6000); await new Promise(r => setTimeout(r, 400));
      const nn = () => [...document.querySelectorAll('#fx .say')].find(x => x.textContent === '👋'); const n0 = nn(); const tr = new Set(), tops = []; let maxStep = 0, prev = null, lost = 0;
      await new Promise(done => { const t0 = performance.now(); const f = () => { const n = nn(); if (n !== n0 || !n) { lost++; prev = null; if (performance.now() - t0 < 1600) requestAnimationFrame(f); else done(); return; } const r = n.getBoundingClientRect(); tr.add(n.style.translate || ''); if (prev != null) maxStep = Math.max(maxStep, Math.abs(r.top - prev)); prev = r.top; tops.push(Math.round(r.top)); if (performance.now() - t0 < 1600) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      return { translates: [...tr], maxStepPx: +maxStep.toFixed(2), frames: tops.length, framesReplacedByGame: lost };
    });
    // a walking speaker: bubble x follows smoothly
    V.walk = await P.evaluate(async () => {
      miles.crying = false; G.poop = false; G.needTP = false; G.bathLocked = false; await new Promise(r => setTimeout(r, 400));
      daddy.y = 164; daddy.x = E.camX + 40; UI.bubble(daddy, '👋', 6000); AI.hold(daddy, false); daddy.walkTo(E.camX + E.viewW - 60, null, 60); AI.hold(daddy, true);
      const nn = () => [...document.querySelectorAll('#fx .say')].find(x => x.textContent === '👋'); const n0 = nn(); let maxDx = 0, maxDy = 0, prev = null, k = 0, lost = 0;
      await new Promise(done => { const t0 = performance.now(); const f = () => { const n = nn(); if (n !== n0 || !n) { lost++; prev = null; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else done(); return; } const r = n.getBoundingClientRect(); if (prev && performance.now() - t0 > 300) { maxDx = Math.max(maxDx, Math.abs(r.left - prev.left)); maxDy = Math.max(maxDy, Math.abs(r.top - prev.top)); } prev = r; k++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      daddy.stop(); return { maxStepX: +maxDx.toFixed(2), maxStepY: +maxDy.toFixed(2), frames: k, framesReplacedByGame: lost };
    });
    // bigIcon: centred on (50%, 40%) of the stage, pointer-events none; alerts under it stay tappable
    V.big = await P.evaluate(async () => {
      miles.crying = true; G.poop = true; await new Promise(r => setTimeout(r, 600));
      UI.bigIcon('🍳', 1200); await new Promise(r => setTimeout(r, 450));
      const st = document.getElementById('stage').getBoundingClientRect(), n = [...document.querySelectorAll('#fx > div')].find(x => x.textContent === '🍳'), r = n.getBoundingClientRect();
      const c = [(r.left + r.right) / 2 - st.left, (r.top + r.bottom) / 2 - st.top], want = [st.width / 2, st.height * 0.4];
      const al = [...document.querySelectorAll('.alertb')].map(a => { const q = a.getBoundingClientRect(), e = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2); return { a: a.getAttribute('aria-label'), top: e && e.closest('.alertb') === a, overlapsIcon: !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom) }; });
      const cs = getComputedStyle(n);
      return { centreOff: [Math.round(c[0] - want[0]), Math.round(c[1] - want[1])], box: [r.left, r.top, r.right, r.bottom].map(Math.round), pe: cs.pointerEvents, anim: cs.animationName, translate: n.style.translate, transform: n.style.transform, alerts: al };
    });
    await g.shot(L.OUT + 'g5' + tag + '_' + view + '_bigicon.png');
    V.errors = L.real(g.errors); await g.close();
  }
  fs.writeFileSync(L.OUT + 't_g5' + tag + '.json', JSON.stringify(res, null, 1));
  // summary
  for (const [v, V] of Object.entries(res.views)) {
    const bad = []; let aboveOk = true;
    for (const c of V.cases) for (const o of c.out) { if (o.centreTop !== '.say' || o.hits.length) bad.push(`a${c.nAlerts} y${c.y} ${o.who} centre=${o.centreTop} hits=${o.hits.join('|')} tr=${o.translate}`); if (c.nAlerts === 0 && c.y === 164 && o.bottomMinusHead > 8) aboveOk = false; }
    console.log(v, 'bad:', bad.length, bad.slice(0, 8), '| no-alert y164 above head:', aboveOk, V.cases.filter(c => c.nAlerts === 0 && c.y === 164).map(c => c.out.map(o => o.who + ':' + o.bottomMinusHead + ' dx' + o.centreXminusSpeaker).join(' ')).join(''),
      '| jitter', JSON.stringify(V.jitter), '| walk', JSON.stringify(V.walk), '| big', JSON.stringify(V.big), '| errors', V.errors);
  }
})().catch(e => { console.error(e); process.exit(1); });
