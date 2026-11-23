// G35: a tap on a sign does what a tap on its door does; people are drawn in front; signs do not jump when buttons come and go;
// nothing on the title, with a screen open or during the TV in landscape; drawExitSigns is not re-wrapped every frame; frame time.
const { boot, OUT, TH } = require('./lib.js'); const fs = require('fs');
const SIGNS = [['foyer', 'stairs', [262, 236, 214, 180, 136]], ['foyer', 'basedoor', [104, 136]], ['uphall', 'ustairs', [104, 152, 10]], ['den', 'bstairs', [104, 200, 10]], ['den', 'dutch', [474, 420, 598]], ['backyard', 'bkdoor', [96, 200, 10]]];
const place = (g, room, x) => g.ev(([room, x]) => { G.busy = false; UI.closeActions(); marina.stop && marina.stop(); marina.state = 'idle'; marina.offY = 0; marina.x = x; for (const e of ENTS) if (e !== marina && e.room === room) e.x = Math.max(20, Math.min(ROOMS[room].w - 20, x + (e.x < x ? -70 : 70))); }, [room, x]);
const outcome = g => g.ev(() => ({ room: G.room, x: Math.round(marina.x), acts: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(''), state: marina.state }));
(async () => {
  const R = { tapeq: {}, front: {}, flicker: {}, screens: {}, wrap: {}, frames: {} };
  // ---------------- tap on the sign vs tap on the door
  for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await boot({ view, room: 'foyer', storage: { cm_builds: TH } }); await g.calm();
    for (const [room, id, xs] of SIGNS) {
      let got = null;
      for (const x of xs) {
        await g.go(room, 1500); await place(g, room, x); await g.wait(2300);
        got = await g.ev(id => { const now = performance.now();
          if (id === 'basedoor') { const p = PROPS.foyer.find(q => q.id === 'basedoor'), T = p.y - p.h; return { x: p.x + 5, y: T + 46, basement: true }; }      // the 🛋️ basement.js draws beside its ⬇️
          const s = Clarity.G35.signs.find(q => q.p.id === id); return s && s.spot && s.at && now - s.at < 150 ? { x: s.spot[0], y: s.spot[1] } : null; }, id);
        if (got) { got.mx = x; break; }
      }
      if (!got) { R.tapeq[view + ' ' + room + '/' + id] = 'sign not drawn at any test position'; continue; }
      const ptS = await g.ev(([x, y]) => { const c = Clarity.toClient(x, y), n = document.elementFromPoint(c[0], c[1]); const h = hitTest(x, y); return { c: c.map(Math.round), top: n && n.id, hit: h && h.kind + ':' + (h.p ? h.p.id : '') }; }, [got.x, got.y]);
      await g.page.touchscreen.tap(ptS.c[0], ptS.c[1]); await g.wait(3600); const viaSign = await outcome(g);
      await g.ev(() => UI.closeActions()); await g.go(room, 1500); await place(g, room, got.mx); await g.wait(2300);
      // a point on the door itself, on the bare picture, away from the sign
      const ptD = await g.ev(([id, sx, sy]) => { const p = PROPS[G.room].find(q => q.id === id); const st = Clarity.stageRect();
        for (let dy = 0; dy < 140; dy += 3) for (let dx = -30; dx <= 30; dx += 3) { const wx = p.x + dx, wy = p.y - 6 - dy; if (Math.abs(wx - sx) < 18 && Math.abs(wy - sy) < 12) continue; const h = hitTest(wx, wy); if (!h || h.kind !== 'prop' || h.p.id !== id) continue; const c = Clarity.toClient(wx, wy), n = document.elementFromPoint(c[0], c[1]); if (n && n.id === 'cv') return { c: c.map(Math.round), w: [wx, wy] }; }
        return null; }, [id, got.x, got.y]);
      let viaDoor = 'no free door point';
      if (ptD) { await g.page.touchscreen.tap(ptD.c[0], ptD.c[1]); await g.wait(3600); viaDoor = await outcome(g); }
      await g.ev(() => UI.closeActions());
      const same = typeof viaDoor === 'object' && viaDoor.room === viaSign.room && viaDoor.acts === viaSign.acts && Math.abs(viaDoor.x - viaSign.x) <= 3;
      R.tapeq[view + ' ' + room + '/' + id] = { same, sign: got, signPoint: ptS, viaSign, doorPoint: ptD && ptD.w.map(Math.round), viaDoor };
    }
    R.tapeq[view + ' errors'] = g.realErrors(); await g.close();
  }
  // ---------------- people in front, no jumping, screens: port, den
  {
    const g = await boot({ view: 'port', room: 'den' }); await g.calm(); await g.go('den', 1500); await place(g, 'den', 104);
    await g.ev(() => { for (const e of ENTS) if (e !== marina && e.room === 'den') { e.stop && e.stop(); e.room = 'kitchen'; } }); await g.wait(2500);
    fs.writeFileSync(OUT + 'g35_misc_partial.json', JSON.stringify(R, null, 1));
    const s0 = await g.ev(() => { const s = Clarity.G35.signs.find(q => q.p.id === 'bstairs'); return s && { spot: s.spot, drawn: performance.now() - (s.at || 0) < 150 }; });
    R.front.start = s0;
    // Nunu steps into the doorway, right on the sign: the sign is hidden while she is there (a tap there would reach her)
    await g.ev(sp => { nunu.room = 'den'; nunu.hidden = false; nunu.stop && nunu.stop(); nunu.x = sp[0]; nunu.state = 'idle'; }, s0.spot); await g.wait(700);
    R.front.withNunu = await g.ev(() => { const s = Clarity.G35.signs.find(q => q.p.id === 'bstairs'); const h = hitTest(s.spot[0], s.spot[1]); return { ok: s.ok, drawn: performance.now() - (s.at || 0) < 150, hitAtSign: h && (h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : '')) }; });
    await g.shot(OUT + 'shots/g35_front_nunu_natural.png');
    // forced: keep the sign 'valid' while Nunu stands on it, to see the layering (sign in the prop pass, Nunu in front)
    await g.ev(() => { window.__force = setInterval(() => { const s = Clarity.G35.signs.find(q => q.p.id === 'bstairs'); if (s) { s.ok = true; s.badT = 0; } }, 5); }); await g.wait(400);
    await g.shot(OUT + 'shots/g35_front_nunu_forced.png');
    await g.ev(() => clearInterval(__force)); await g.ev(() => { nunu.room = 'kitchen'; }); await g.wait(2600);
    // buttons and cards coming and going: the spot stays put
    const track = async (label, fn) => { await fn(); const rec = []; for (let i = 0; i < 25; i++) { rec.push(await g.ev(() => { const s = Clarity.G35.signs.find(q => q.p.id === 'bstairs'); return (s.spot ? s.spot.map(Math.round).join(',') : 'none') + (performance.now() - (s.at || 0) < 150 ? '' : '(skip)'); })); await g.wait(100); } R.flicker[label] = [...new Set(rec)].join(' | '); };
    await track('before', async () => { });
    await track('face card', () => g.ev(() => UI.face('nunu', 'happy', 2000)));
    await track('ring on Marina', () => g.ev(() => UI.actions(marina, selfActions())));
    await g.ev(() => UI.closeActions());
    await track('dress-up / book buttons', () => g.ev(() => { for (const id of ['dressBtn', 'bookBtn']) { const b = document.getElementById(id); if (b) b.classList.remove('off'); } }));
    await track('wish button', () => g.ev(() => showWish('cook')));
    await g.ev(() => { if (window.clearWish) clearWish(); });
    // a screen open: no sign drawn
    await g.ev(() => UI.openCook('fridge')); await g.wait(800); const t0 = await g.ev(() => performance.now()); await g.wait(600);
    R.screens.cookOpen = await g.ev(t0 => Clarity.G35.signs.every(s => !s.at || s.at < t0), t0);
    await g.ev(() => UI.closePanel()); await g.wait(900); R.screens.afterClose = await g.ev(() => Clarity.G35.signs.some(s => performance.now() - (s.at || 0) < 150));
    await g.ev(() => openIsoMap()); await g.wait(600); const t1 = await g.ev(() => performance.now()); await g.wait(500);
    R.screens.mapOpen = await g.ev(t1 => Clarity.G35.signs.every(s => !s.at || s.at < t1), t1); await g.ev(() => document.querySelector('#panel .ptop button').click());
    R.front.errors = g.realErrors(); await g.close();
  }
  // ---------------- tree house with the lantern on: thLate's night overlay is drawn over the tab (builder.js:1051)
  {
    const g = await boot({ view: 'port', room: 'kitchen', storage: { cm_builds: TH } }); await g.calm(); await g.go('treehouse_oak', 1500);
    await g.ev(() => { propActions(PROPS.treehouse_oak.find(q => q.id === 'th_lamp')).find(a => a.ico === '💡').fn(); }); await g.wait(3500);
    await g.ev(() => { G.busy = false; marina.stop && marina.stop(); marina.state = 'idle'; marina.x = 276; }); await g.wait(2200);
    R.lantern = await g.ev(() => ({ lamp: Builder.list().find(b => b.spot === 'oak'), tab: !!Clarity.G35.tabDrawn && performance.now() - Clarity.G35.tabDrawn.at < 150 }));
    await g.shot(OUT + 'shots/g35_tab_lantern.png');
    await g.ev(() => { propActions(PROPS.treehouse_oak.find(q => q.id === 'th_lamp')).find(a => a.ico === '💡').fn(); }); await g.wait(3000);
    R.lantern.errors = g.realErrors(); await g.close();
  }
  // ---------------- the title: nothing drawn
  {
    const g = await boot({ view: 'port', room: 'den', start: false }); await g.wait(1500);
    R.screens.title = await g.ev(() => ({ playing: Clarity.playing(), signs: (Clarity.G35.signs || []).length, tab: !!Clarity.G35.tab }));
    await g.close();
  }
  // ---------------- TV in landscape: the quiet-scene rule says no
  {
    const g = await boot({ view: 'land', room: 'living' }); await g.calm(); await g.ev(() => tvOn(showList()[0])); await g.wait(1000);
    R.screens.tvLand = await g.ev(() => ({ tvon: document.getElementById('stage').classList.contains('tvon'), signsHere: Clarity.G35.signs.length, tab: !!Clarity.G35.tab }));
    await g.close();
  }
  // ---------------- drawExitSigns wrapper depth and calls per frame; frame time with G35 on/off (backyard with tree houses, den)
  for (const mode of ['on', 'off']) {
    const g = await boot({ view: 'port', room: 'kitchen', off: mode === 'off' ? 'G35' : '', storage: { cm_builds: TH } }); await g.calm();
    for (const room of ['backyard', 'den']) {
      await g.go(room, 1500);
      const r = await g.ev(async () => {
        const C = Clarity; C.on.TW = true; let calls = 0; C.hook('drawExitSigns', 'TW', { order: 99, after() { calls++; } });
        const ids = [drawExitSigns]; const iv = setInterval(() => { if (ids[ids.length - 1] !== drawExitSigns) ids.push(drawExitSigns); }, 16);
        let frames = 0, last = performance.now(), dts = []; const f = t => { frames++; dts.push(t - last); last = t; if (frames < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f);
        await new Promise(res => setTimeout(res, 6000)); clearInterval(iv); frames = frames; const c = calls; C.on.TW = false;
        dts.sort((a, b) => a - b); return { calls: c, frames, perFrame: +(c / frames).toFixed(2), wrapperChanges: ids.length - 1, medianDt: +dts[dts.length >> 1].toFixed(1), p95Dt: +dts[Math.floor(dts.length * 0.95)].toFixed(1) };
      });
      R.frames[mode + ' ' + room] = r;
    }
    await g.close();
  }
  // after 20 s in the backyard: still the same wrapper chain
  {
    const g = await boot({ view: 'port', room: 'kitchen', storage: { cm_builds: TH } }); await g.calm(); await g.go('backyard', 1500);
    const a = await g.ev(() => { window.__w0 = drawExitSigns; return drawExitSigns.clarity || 'outer:' + (drawExitSigns === window.__w0); }); await g.wait(20000);
    R.wrap = await g.ev(() => ({ sameAfter20s: drawExitSigns === __w0 })); R.wrap.start = a; R.wrap.errors = g.realErrors(); await g.close();
  }
  fs.writeFileSync(OUT + 'g35_misc.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
