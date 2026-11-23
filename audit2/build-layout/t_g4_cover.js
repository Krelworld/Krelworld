// G4 checks: living-room prop coverage (land, landSmall, 844x340; Marina x 120/300/420/560 and both ends), TODAY vs G4 alone vs G4+G19.
// Two control states per spot: calm (arrows, 👗, 📒) and busy-ish (an alert, a wish prompt, a request prompt, ✋).
const { boot, OUT, MINE, R } = require('./lib.js'); const fs = require('fs');
const MODES = [['TODAY', MINE], ['G4', 'G13,G14,G19'], ['G4+G19', '']];
const VIEWS = ['land', 'landSmall', { width: 844, height: 340 }];
(async () => {
  const res = {};
  for (const view of VIEWS) for (const [mode, off] of MODES) {
    const vn = typeof view === 'string' ? view : view.width + 'x' + view.height, key = vn + ' ' + mode;
    const g = await boot({ view, room: 'living', off }); const p = g.page; res[key] = {};
    await g.calm();
    for (const mx of [120, 300, 420, 560, 'L', 'R']) {
      const cover = {};
      for (const state of ['calm', 'prompts']) {
        await g.calm();
        await p.evaluate(([mx, state]) => { for (const e of [daddy, mommy, rory, niko]) e.room = 'kitchen'; miles.crying = false;
          marina.x = mx === 'L' ? 20 : mx === 'R' ? ROOMS.living.w - 20 : mx; marina.stop && marina.stop(); marina.state = 'idle'; G.holding = null; G.poop = false;
          if (window.clearWish) clearWish(); document.querySelectorAll('#reqBtn').forEach(n => n.remove());
          if (state === 'prompts') { G.poop = true; showWish('cook'); G.holding = { type: 'tp' }; } }, [mx, state]);
        await p.waitForTimeout(state === 'calm' ? 2600 : 1400);
        if (state === 'prompts') { await p.evaluate(() => askRequest('cook')); await p.waitForTimeout(700); }
        const r = await p.evaluate(() => {
          const st = document.getElementById('stage').getBoundingClientRect(), out = { zoom: +(E.cssScale / (st.height / 180)).toFixed(3), camX: Math.round(E.camX), props: {} };
          const shown = [...document.querySelectorAll('#dressBtn:not(.off),#bookBtn:not(.off),.alertb,#wishBtn,#reqBtn,#stopBtn:not(.hidden)')].map(n => n.id || n.className.split(' ')[0]);
          out.shown = shown.join(',');
          for (const p of PROPS.living) {
            if (p.nohit) continue; const sc = p.scale || 1; let b; try { b = p.k && !p.k.startsWith('p:') ? visBox(p.k).map(n => n * sc) : [-(p.w || 20) / 2, -(p.h || 30), (p.w || 20) / 2, 0]; } catch (e) { continue; }
            const [x0, y0] = toScreen(p.x + b[0], p.y + b[1]), [x1, y1] = toScreen(p.x + b[2], p.y + b[3]);
            let n = 0; const covBy = {}; let cov = 0;
            for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = x0 + (x1 - x0) * (i + .5) / 5, y = y0 + (y1 - y0) * (j + .5) / 5; if (x < 0 || x > st.width || y < 0 || y > st.height) continue; n++;
              const h = document.elementFromPoint(st.left + x, st.top + y); if (h && h.id !== 'cv') { cov++; const k = (h.closest('#roombar') ? 'strip' : h.closest('#moodbar') ? 'moodbar' : h.closest('.facecard') ? 'face' : h.closest('.navarrow') ? 'arrow' : h.closest('#floorpill') ? 'pill' : h.closest('#alerts') ? 'alert' : '') || h.id || (h.className && h.className.toString().split(' ')[0]) || h.tagName; covBy[k] = (covBy[k] || 0) + 1; } }
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, onPic = cx >= 0 && cx <= st.width && cy >= 0 && cy <= st.height; const ce = onPic ? document.elementFromPoint(st.left + cx, st.top + cy) : null;
            out.props[p.id] = { n, cov, covBy, centre: !onPic ? 'off' : ce && ce.id === 'cv' ? 'cv' : (ce && (ce.closest('#roombar') ? 'strip' : ce.closest('#moodbar') ? 'moodbar' : ce.id || ce.className.toString().split(' ')[0])) };
          }
          return out; });
        cover[state] = r;
        if (mx === 300 && state === 'calm') await g.shot(OUT + 'shots/g4_' + vn + '_' + mode.replace('+', '_') + '_300.png');
        if (mx === 'L' && state === 'calm') await g.shot(OUT + 'shots/g4_' + vn + '_' + mode.replace('+', '_') + '_L.png');
      }
      res[key][mx] = cover;
    }
    res[key].errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(key, 'zoom', res[key][300].calm.zoom, 'errors', JSON.stringify(res[key].errors));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g4_cover.json', JSON.stringify(res, null, 1));
})();
