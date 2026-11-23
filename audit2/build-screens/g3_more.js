// G3 extra checks (see screens.txt G3 EXTRA CHECKS). Results -> g3_more.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const L = { land: ['land', null], landSmall: ['landSmall', null], '844x340': [{ width: 844, height: 340 }, null], '844x340i47': [{ width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }] };
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function prep(g) { await g.calm(); await g.ev(TLIB);
  await g.ev(() => { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const x = cv.getContext('2d'); x.fillStyle = '#f80'; x.fillRect(20, 20, 200, 120); localStorage.setItem('cm_lastDrawing', JSON.stringify(cv.toDataURL())); }); }
(async () => {
  // ---- 1. crafts canvases: straight on ✂️, and ➕ then 🖍️: kx == ky; a stroke at the bottom-right lands under the finger
  for (const v of ['land', 'landSmall', '844x340', '844x340i47']) for (const off of ['', 'G3']) {
    const g = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'dining', off }); await prep(g);
    const cut = await g.ev(async () => { await T.reset(); UI.openCrafts('cut'); await T.sleep(400); const c = document.getElementById('drawCv'), r = c.getBoundingClientRect(); return { kx: +(c.width / r.width).toFixed(4), ky: +(c.height / r.height).toFixed(4), lane: Clarity.G3 && Clarity.G3.lane }; });
    const draw = await g.ev(async () => { await T.reset(); UI.openCrafts('math'); await T.sleep(60); T.tab('#panel .pbody > .row .pbtn', 0); await T.sleep(400); const c = document.getElementById('drawCv'), r = c.getBoundingClientRect(); return { kx: +(c.width / r.width).toFixed(4), ky: +(c.height / r.height).toFixed(4), r: [r.left, r.top, r.right, r.bottom] }; });
    // a real mouse stroke near the bottom-right corner; then read the bitmap pixel exactly under the finger
    const [x0, y0] = [draw.r[2] - 30, draw.r[3] - 14], [x1, y1] = [draw.r[2] - 8, draw.r[3] - 6];
    await g.page.mouse.move(x0, y0); await g.page.mouse.down(); for (let i = 1; i <= 6; i++) await g.page.mouse.move(x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await g.page.mouse.up(); await g.wait(100);
    const px = await g.ev(([x, y]) => { const c = document.getElementById('drawCv'), r = c.getBoundingClientRect(), bx = Math.round((x - r.left) * c.width / r.width), by = Math.round((y - r.top) * c.height / r.height); const d = c.getContext('2d').getImageData(bx, by, 1, 1).data; return { bx, by, rgb: [d[0], d[1], d[2]], inked: !(d[0] > 240 && d[1] > 240 && d[2] > 240) }; }, [(x0 + x1) / 2, (y0 + y1) / 2]);
    log('crafts ' + v + (off ? ' G3off' : ''), { cut, draw: { kx: draw.kx, ky: draw.ky }, strokeUnderFinger: px });
    await g.close();
  }
  // ---- 2. a canvas screen right after a classic one: #panel never has cm-lane (or its padding) while the canvas screen lays out;
  //         the Lego/films ❌ column stays at x >= 8. Also the direct case (classic still showing when the canvas screen opens).
  for (const v of ['land', 'landSmall', '844x340i47']) {
    const g = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'den' }); await prep(g);
    const r = await g.ev(async () => {
      const P = document.getElementById('panel'), out = {};
      const spy = (name, api) => { const o = api.open; api.open = function () { const a = { cls: P.classList.contains('cm-lane'), pad: getComputedStyle(P).paddingLeft }; const ret = o.apply(this, arguments); const b = P.querySelector('.ptop button').getBoundingClientRect(); out[name].push({ atOpen: a, afterLayout: { cls: P.classList.contains('cm-lane'), pad: getComputedStyle(P).paddingLeft, xLeft: Math.round(b.left), ptopMargin: getComputedStyle(P.querySelector('.ptop')).marginLeft } }); return ret; }; return () => { api.open = o; }; };
      out.mapToLego = []; out.cookToMovies = []; out.cookDirectLego = []; out.cookDirectMovies = [];
      await T.reset(); openIsoMap(); await T.sleep(300); const laneMap = P.classList.contains('cm-lane'); T.press(P.querySelector('.ptop button')); await T.sleep(300);
      let un = spy('mapToLego', Bricks); Bricks.open({ kind: 'lego' }); un(); await T.sleep(400); out.mapToLego.push({ laneOnMapBefore: laneMap, xLeftLater: Math.round(P.querySelector('.ptop button').getBoundingClientRect().left), lane: P.classList.contains('cm-lane') }); await T.reset();
      UI.openCook('fridge'); await T.sleep(300); const laneCook = P.classList.contains('cm-lane'); T.press(P.querySelector('.ptop button')); await T.sleep(300);
      un = spy('cookToMovies', Movies); Movies.open({}); un(); await T.sleep(400); out.cookToMovies.push({ laneOnCookBefore: laneCook, xLeftLater: Math.round(P.querySelector('.ptop button').getBoundingClientRect().left), lane: P.classList.contains('cm-lane') }); await T.reset();
      // direct: cooking with its lane still up, then Lego opened in the same task (not a real path in the game today)
      UI.openCook('fridge'); await T.sleep(300); un = spy('cookDirectLego', Bricks); Bricks.open({ kind: 'lego' }); un(); await T.sleep(400); out.cookDirectLego.push({ xLeftLater: Math.round(P.querySelector('.ptop button').getBoundingClientRect().left), lane: P.classList.contains('cm-lane') }); await T.reset();
      UI.openCook('fridge'); await T.sleep(300); un = spy('cookDirectMovies', Movies); Movies.open({}); un(); await T.sleep(400); out.cookDirectMovies.push({ xLeftLater: Math.round(P.querySelector('.ptop button').getBoundingClientRect().left), lane: P.classList.contains('cm-lane') }); await T.reset();
      return out;
    });
    log('canvasAfterClassic ' + v, r); await g.close();
  }
  // ---- 3/4/6. fort interior: 🚪 on #xFloat, a real tap runs closeFortInside; cooking's #xFloat discards like today; no glyph flicker
  for (const off of ['', 'G3']) {
    const g = await boot({ port: 8910, view: 'land', room: 'playroom', off }); await prep(g);
    await g.ev(async () => { await T.reset(); T.fort(); openFortInside(); }); await g.wait(500);
    const glyphs = await g.ev(async () => { const s = new Set(); for (let i = 0; i < 40; i++) { s.add(document.getElementById('xFloat').textContent); await T.sleep(50); } return [...s]; });
    let spied = await g.ev(() => { window.__cfi = 0; const o = window.closeFortInside; window.closeFortInside = function () { window.__cfi++; return o.apply(this, arguments); }; const b = document.getElementById('xFloat').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await g.tapXY(spied[0], spied[1]); await g.wait(400);
    const fortOut = await g.ev(() => ({ closeFortInsideCalls: window.__cfi, inside: !!(G.fort && G.fort.inside), panelHidden: document.getElementById('panel').classList.contains('hidden'), marinaHidden: !!marina.hidden }));
    // cooking: two picks, then the floating ❌
    await g.ev(async () => { await T.reset(); UI.openCook('fridge'); await T.sleep(200); const t = document.querySelectorAll('#panel .grid.ing .tile'); T.press(t[0]); T.press(t[1]); });
    await g.wait(300);
    const before = await g.ev(() => ({ slots: document.querySelectorAll('#panel .tray .slot.full').length, holding: G.holding ? String(G.holding.kind || G.holding.k || 'x') : null }));
    const xc = await g.ev(() => { const b = document.getElementById('xFloat').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, getComputedStyle(document.getElementById('xFloat')).display]; });
    await g.tapXY(xc[0], xc[1]); await g.wait(400);
    const after = await g.ev(async () => { const hid = document.getElementById('panel').classList.contains('hidden'); const holding = G.holding ? String(G.holding.kind || G.holding.k || 'x') : null; UI.openCook('fridge'); await T.sleep(200); const n = document.querySelectorAll('#panel .tray .slot.full').length; await T.reset(); return { panelHidden: hid, holding, picksOnReopen: n }; });
    // builder and shelf-hero glyphs, sampled
    const bglyph = await g.ev(async () => { await T.reset(); Builder.open({}); await T.sleep(300); const s = new Set(); for (let i = 0; i < 20; i++) { s.add(document.getElementById('xFloat').textContent); await T.sleep(50); } await T.reset(); return [...s]; });
    log('fortAndCook' + (off ? ' G3off' : ''), { fortGlyphsOver2s: glyphs, fort: fortOut, cookBefore: before, xFloatDisplay: xc[2], cookAfterXFloat: after, builderGlyphs: bglyph, errors: realErrors(g.errors) });
    await g.close();
  }
  // ---- 5. builder cards (catalogue, take-down) and map tiles: every one reachable (elementFromPoint at its centre after scrolling to it), none off to the right
  for (const v of ['land', 'landSmall', '844x340i47']) {
    const g = await boot({ port: 8910, view: L[v][0], inset: L[v][1], room: 'backyard' }); await prep(g);
    await g.ev(() => { const c = Builder.catalogue.find(c => Object.values(Builder.spots).some(s => s.type === c.spot)); const spot = Object.keys(Builder.spots).find(k => Builder.spots[k].type === c.spot); localStorage.setItem('cm_builds', JSON.stringify({ builds: [{ kind: c.id, spot }] })); });
    await g.page.reload(); await g.wait(2500); await g.ev(() => startGame('backyard')); await g.wait(3000); await g.calm(); await g.ev(TLIB);
    const r = await g.ev(async () => {
      const reach = sel => { const out = { n: 0, ok: 0, bad: [], maxRight: 0 }; for (const n of document.querySelectorAll(sel)) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none') continue; out.n++; n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = n.getBoundingClientRect(); out.maxRight = Math.max(out.maxRight, Math.round(r.right)); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (e && (e === n || n.contains(e))) out.ok++; else out.bad.push(T.nm(n) + '->' + T.nm(e)); } return out; };
      const o = {}; await T.reset(); Builder.open({}); await T.sleep(300); o.cat = reach('#panel .bd-card, #panel button'); o.lane = Clarity.G3.lane;
      T.press(document.querySelector('#panel .ptop .pbtn:nth-child(2)')); await T.sleep(300); o.down = reach('#panel .bd-card, #panel button'); await T.reset();
      openIsoMap(); await T.sleep(300); o.isomap = reach('#panel button, #panel .isoroom, #panel [data-r]'); await T.reset();
      UI.openMap(); await T.sleep(300); o.uimap = reach('#panel button'); await T.reset();
      o.vw = innerWidth; return o;
    });
    log('reach ' + v, r); await g.close();
  }
  // ---- 7. fort builder / interior tap mapping (pre-existing letterbox bug): a piece drawn at canvas x 60 is read as x ...; no worse with the lane
  for (const off of ['', 'G3']) for (const v of ['land', 'landSmall']) {
    const g = await boot({ port: 8910, view: v, room: 'playroom', off }); await prep(g);
    const r = await g.ev(async () => { const o = {}; for (const [name, open, sel, W, H] of [['builder', () => openFortBuilder(), '.fortcv', 240, 140], ['inside', () => { T.fort(); openFortInside(); }, '.fortin', 320, 180]]) {
      await T.reset(); open(); await T.sleep(300); const cv = document.querySelector('#panel ' + sel), r = cv.getBoundingClientRect(); const s = Math.min(r.width / W, r.height / H), ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
      o[name] = { box: [Math.round(r.width), Math.round(r.height)], x60readAs: +((ox + 60 * s) * W / r.width).toFixed(1), y100readAs: +((oy + 100 * s) * H / r.height).toFixed(1) }; } await T.reset(); return o; });
    log('fortMapping ' + v + (off ? ' G3off' : ''), r); await g.close();
  }
  // ---- 9/11. portrait screens and the canvas screens: identical layout with G3 on and off
  const LAYS = {};
  for (const off of ['', 'G3']) for (const v of ['port', 'portSmall', 'land', 'landSmall']) {
    const g = await boot({ port: 8910, view: v, room: 'den', off }); await prep(g);
    LAYS[v + off] = await g.ev(async (port) => { const o = {}; const list = port ? ['cook_fridge', 'cook_methods', 'dress_outfit', 'crafts_cut', 'crafts_dio', 'isomap', 'fort_builder', 'fort_inside', 'builder_cat', 'stickers', 'story_shelf'] : [];
      for (const s of list) { await T.reset(); await T.SCREENS[s](); await T.sleep(450); o[s] = T.layout(); }
      for (const s of Object.keys(T.CANVAS)) { await T.reset(); await T.CANVAS[s](); await T.sleep(700); o['canvas_' + s] = T.layout(); }
      await T.reset(); return o; }, v.startsWith('port'));
    LAYS[v + off].errors = realErrors(g.errors); await g.close();
  }
  for (const v of ['port', 'portSmall', 'land', 'landSmall']) { const a = LAYS[v], b = LAYS[v + 'G3'], diff = [];
    for (const k in a) { if (k === 'errors') continue; if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diff.push(k); }
    log('layoutOnVsOff ' + v, { screens: Object.keys(a).filter(k => k !== 'errors').length, differ: diff, errors: [a.errors.length, b.errors.length] }); }
  fs.writeFileSync(OUT + 'g3_more.json', JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
