// G16: glide hit-tests, a real tap on the glide path, the ✋ race (sit / TV), rotation, landscape/title unchanged.
const L = require('./lib.js'); const out = {};
const quiet = () => { G.holding = null; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.needTP = false; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; };
const shown = () => !document.getElementById('dressBtn').classList.contains('off') && !document.getElementById('bookBtn').classList.contains('off');
(async () => {
  const which = process.argv[2] || 'glide';
  if (which === 'glide') {
    // A. mid-glide hit tests (fresh session: first glides)
    for (const name of ['port', 'portSmall']) {
      const g = await L.boot({ port: 8891, view: L.viewOf(name), room: 'kitchen' }); await g.calm(); await g.ev(quiet);
      await g.ev(() => { window.__gl = []; for (const id of ['dressBtn', 'bookBtn']) { const el = document.getElementById(id); let was = el.classList.contains('off');
        new MutationObserver(() => { const off = el.classList.contains('off'); if (was && !off) { const t0 = performance.now(); for (const ms of [60, 150, 250, 350, 450, 650]) setTimeout(() => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y), st = document.getElementById('stage').getBoundingClientRect();
          __gl.push({ id, ms, at: Math.round(performance.now() - t0), c: [Math.round(x), Math.round(y)], overPicture: y < st.bottom, under: t ? (t.id || t.className) : null, pe: getComputedStyle(el).pointerEvents }); }, ms); } was = off; }).observe(el, { attributes: true, attributeFilter: ['class'] }); } });
      await g.wait(4000);
      out['glide_' + name] = { samples: await g.ev(() => __gl.slice(0, 12)), glides: await g.ev(() => Clarity.G16.glides), errs: g.errs() };
      console.log('glide', name, JSON.stringify(out['glide_' + name]));
      await g.close();
    }
    // B. a real touch on the picture under the glide path during the first glide: the picture gets it
    for (const room of ['kitchen', 'living']) {
      const g = await L.boot({ port: 8891, view: 'port', room }); await g.calm(); await g.ev(quiet);
      await g.ev(() => { marina.x = 60; marina.state = 'idle'; });
      await g.page.waitForFunction(() => !document.getElementById('dressBtn').classList.contains('off'), null, { polling: 'raf', timeout: 8000 });
      const pt = await g.ev(() => { const r = document.getElementById('dressBtn').getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); return [r.left + r.width / 2, Math.min(r.top + r.height / 2, st.bottom - 30), getComputedStyle(document.getElementById('dressBtn')).pointerEvents, document.getElementById('dressBtn').getAnimations().length]; });
      await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(900);
      const res = await g.ev(() => ({ acts: [...document.querySelectorAll('.act')].map(n => n.textContent).join(''), walking: !!marina.moving || marina.tx != null, mx: Math.round(marina.x), panel: !document.getElementById('panel').classList.contains('hidden'), stk: !!document.getElementById('stkBox') }));
      await g.shot(L.OUT + 'shots/g16_glidetap_' + room + '.png');
      out['glidetap_' + room] = { tapAt: pt, res, errs: g.errs() }; console.log('glidetap', room, JSON.stringify(out['glidetap_' + room]));
      await g.close();
    }
  }
  if (which === 'race') {
    // C. sit / TV right after 👗/📒 have shown: per-frame log of ✋ vs 👗/📒 visible+tappable (G16 on, then off for context)
    for (const off of [undefined, 'G16']) for (const what of ['sit', 'tv']) {
      const g = await L.boot({ port: 8892, view: 'port', room: 'living', off }); await g.calm(); await g.ev(quiet);
      await g.page.waitForFunction(shown, null, { polling: 100, timeout: 8000 }); await g.wait(700);
      const r = await g.ev(async what => {
        const log = []; let on = true; const vis = id => { const el = document.getElementById(id), cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && cs.pointerEvents !== 'none'; };
        const tick = () => { if (!on) return; const s = !document.getElementById('stopBtn').classList.contains('hidden'); log.push([s, vis('dressBtn'), vis('bookBtn')]); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
        await new Promise(r => setTimeout(r, 100));
        if (what === 'sit') marina.state = 'sit'; else tvOn(showList()[0]);
        await new Promise(r => setTimeout(r, 1200)); on = false;
        return { frames: log.length, both: log.filter(f => f[0] && (f[1] || f[2])).length, stopFrames: log.filter(f => f[0]).length, firstStop: log.findIndex(f => f[0]), lastDress: log.map(f => f[1]).lastIndexOf(true) };
      }, what);
      out['race_' + what + (off ? '_off' : '')] = { ...r, errs: g.errs() }; console.log('race', what, off || 'on', JSON.stringify(r));
      await g.close();
    }
  }
  if (which === 'rot') {
    // D. rotate while 📒/👗 show: landscape spots, then back to the band
    const g = await L.boot({ port: 8893, view: 'port', room: 'kitchen' }); await g.calm(); await g.ev(quiet);
    await g.page.waitForFunction(shown, null, { polling: 100, timeout: 8000 }); await g.wait(700);
    const R = () => g.ev(() => ['dressBtn', 'bookBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }));
    const a = await R(); await g.page.setViewportSize({ width: 844, height: 390 }); await g.wait(800); await g.ev(quiet); await g.wait(2500); const b = await R(); await g.shot(L.OUT + 'shots/g16_rot_land.png');
    await g.page.setViewportSize({ width: 390, height: 844 }); await g.wait(800); await g.ev(quiet); await g.wait(2500); const c = await R(); await g.shot(L.OUT + 'shots/g16_rot_back.png');
    out.rot = { port: a, land: b, back: c, errs: g.errs() }; console.log('rot', JSON.stringify(out.rot)); await g.close();
    // E. landscape / short portrait / title spots equal to the switch-off spots
    for (const name of ['land', 'landSmall', '375x553', '844x340', 'title_port', 'title_land']) {
      const res = {};
      for (const off of [undefined, 'G16']) {
        const t = name.startsWith('title_'); const g2 = await L.boot({ port: 8893, view: L.viewOf(t ? name.slice(6) : name), room: 'kitchen', off, start: !t });
        if (!t) { await g2.calm(); await g2.ev(quiet); await g2.page.waitForFunction(shown, null, { polling: 100, timeout: 8000 }).catch(() => { }); await g2.wait(700); }
        res[off || 'on'] = await g2.ev(() => ['#dressBtn', '#bookBtn', '.tbook', '.tdress'].map(s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }).join(' | '));
        await g2.close();
      }
      out['same_' + name] = res; console.log('same', name, res.on === res.G16 ? 'EQUAL' : 'DIFF', JSON.stringify(res));
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
