// G34: the spa's idle hint is the tree climb's pointing hand (fingertip just under the ring's centre) instead of the yellow ⬇.
// Walks all five hint stages + the 'jets without water' tap case. Results -> g34_spa.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
const SPA = () => {
  window.SP = {};
  SP.toClient = (x, y) => { const S = Spa._state(), r = S.cv.getBoundingClientRect(); return [r.left + x * r.width / S.LW, r.top + y * r.height / S.LH]; };
  SP.card0 = () => { const S = Spa._state(), land = S.mode === 'l', cols = land ? 6 : 3, cw = land ? 38 : 44, ch = land ? 44 : 50, gap = 3, tw = cols * cw + (cols - 1) * gap, R = Math.round;
    const x0 = land ? Math.max(30, R((S.LW - tw) / 2)) : R((S.LW - tw) / 2), rows = Math.ceil(6 / cols), y0 = land ? 4 : Math.max(4, S.M.ty + 13 - S.vy - 10 - rows * ch - (rows - 1) * gap); return SP.toClient(x0 + cw / 2, y0 + ch / 2); };
  SP.go = () => { const S = Spa._state(); return SP.toClient(S.M.go[0] + S.M.tx - S.vx, S.M.go[1] + S.M.ty - S.vy); };
  SP.at = () => { const S = Spa._state(), st = S.stats, M = S.M, JET = [[16, 75], [41, 75], [66, 75]]; let at = null;      // drawHints' own choice, replicated
    if (S.hintTap > 0) at = [119, -4, 119, 10];
    else if (S.idle > 2.5) { if (!st.tap && S.L < 0.2) at = [119, -4, 119, 10]; else if (S.L > 0.25 && !st.bubbles) at = [M.bottle[0] + 8, M.bottle[1] - 2, M.bottle[0] + 8, M.bottle[1] + 11];
      else if (S.L > 0.25 && !st.jets.size) at = [JET[1][0], 62, JET[1][0], 75]; else if (!st.toys.size) at = [M.basket[0] + 22, M.basket[1] - 10, M.basket[0] + 22, M.basket[1] + 12];
      else if (S.m.hat && !st.shower && S.over <= 0 && S.idle > 5) at = [M.hook[0] - 2, M.hook[1] - 12, M.hook[0] - 1, M.hook[1] + 3]; }
    return at; };
  const HAND = ['...ko....', '..kWWk...', '..kWWk...', '..kWWk...', '..kWWkk..', '..kWWWWkk', 'kkkWWWWWk', 'kWWWWWWWk', 'kWWWWWWWk', '.kWWWWWWk', '..kWWWWk.', '..kkkkkk.'];
  const ARROW = ['...#######...', '...#ooooo#...', '...#owooo#...', '...#owooo#...', '...#ooooo#...', '...#ooooo#...', '####ooooo####', '#ooooooooooo#', '.#ooooooooo#.', '..#ooooooo#..', '...#ooooo#...', '....#ooo#....', '.....#o#.....', '......#......'];
  // look at the canvas right now: where is the hand (exact pixel match), is the arrow there, is the target's centre clear?
  SP.look = () => { const S = Spa._state(), at = SP.at(), c = S.cv, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, ox = S.M.tx - S.vx, oy = S.M.ty - S.vy;
    const px = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return null; const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const is = (p, rgb) => p && p[0] === rgb[0] && p[1] === rgb[1] && p[2] === rgb[2];
    const match = (pat, x, y, pal) => { for (let j = 0; j < pat.length; j++) for (let i = 0; i < pat[j].length; i++) { const k = pat[j][i]; if (!pal[k]) continue; if (!is(px(x + i, y + j), pal[k])) return false; } return true; };
    const handPal = { k: [43, 35, 64], o: [43, 35, 64], W: [255, 255, 255] }, arrowPal = { '#': [90, 59, 0], o: [255, 210, 62] };
    let hand = null, arrow = null;
    for (let y = 0; y <= H - 12 && !hand; y++) for (let x = 0; x <= W - 9 && !hand; x++) if (match(HAND, x, y, handPal)) hand = [x, y];
    for (let y = -14; y <= H && !arrow; y++) for (let x = 0; x <= W - 13 && !arrow; x++) { let ok = true, seen = 0; for (let j = 0; j < 14 && ok; j++) for (let i = 0; i < 13 && ok; i++) { const k = ARROW[j][i]; if (!arrowPal[k]) continue; const p = px(x + i, y + j); if (p === null) continue; seen++; if (!is(p, arrowPal[k])) ok = false; } if (ok && seen > 20) arrow = [x, y]; }
    const out = { at, hand, arrow, LW: W, LH: H };
    if (at) { const cx = at[2] + ox, cy = at[3] + oy; out.target = [cx, cy];
      if (hand) { out.handInside = hand[0] >= 0 && hand[1] >= 0 && hand[0] + 9 <= W && hand[1] + 12 <= H; out.centreCovered = cx >= hand[0] && cx < hand[0] + 9 && cy >= hand[1] && cy < hand[1] + 12; out.fingertip = [hand[0] + 4, hand[1]]; out.tipBelowCentre = hand[1] - cy; out.tipDx = hand[0] + 4 - cx; } }
    return out; };
  SP.stage = name => { const S = Spa._state(), st = S.stats; S.hintTap = 0;
    if (name === 'tap') { st.tap = false; S.L = 0; } if (name === 'bottle') { st.tap = true; S.L = 0.5; st.bubbles = 0; } if (name === 'jets') { st.bubbles = 1; S.L = 0.5; st.jets.clear(); }
    if (name === 'basket') { st.jets.add(0); st.toys.clear(); } if (name === 'hook') { st.toys.add('duck'); S.m.hat = true; st.shower = false; S.over = 0; } if (name === 'hintTap') S.hintTap = 3;
    S.idle = name === 'hook' ? 6 : name === 'hintTap' ? 0 : 3; };
};
(async () => {
  for (const off of ['', 'G34']) for (const v of ['port', 'land', 'landSmall', '844x340i47']) {
    const view = v === '844x340i47' ? { width: 844, height: 340 } : v, inset = v === '844x340i47' ? { left: 47, right: 47, bottom: 21 } : null;
    const g = await boot({ port: 8910, view, inset, room: 'spa', off }); await g.calm(); await g.ev(TLIB); await g.ev(SPA);
    await g.ev(async () => { await T.reset(); Spa.open({}); await T.sleep(900); });
    let xy = await g.ev(() => SP.card0()); await g.tapXY(xy[0], xy[1]); await g.wait(900); xy = await g.ev(() => SP.go()); await g.tapXY(xy[0], xy[1]); await g.wait(3200);
    const phase = await g.ev(() => Spa._state().phase); const o = { phase };
    if (phase === 'play') {
      // timing: nothing while idle < 2.5 s, the hint (hand or arrow) once it is past 2.5 s
      o.timing = await g.ev(async () => { const S = Spa._state(); S.idle = 1.9; await T.sleep(150); const a = SP.look(); await T.sleep(800); const b = SP.look(); return { before: { idle: 'under 2.5', hand: !!a.hand, arrow: !!a.arrow, at: !!a.at }, after: { idle: 'over 2.5', hand: !!b.hand, arrow: !!b.arrow, at: !!b.at } }; });
      for (const s of ['tap', 'bottle', 'jets', 'basket', 'hook', 'hintTap']) {
        o[s] = await g.ev(async s => { SP.stage(s); await T.sleep(260); return SP.look(); }, s);
        if (s === 'bottle' || s === 'hook') await g.shot('g34_spa_' + v + (off ? '_off' : '') + '_' + s);
      }
    }
    log(v + (off ? ' G34off' : ''), o); res[v + off + ' errors'] = realErrors(g.errors); await g.close();
  }
  fs.writeFileSync(OUT + 'g34_spa.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });
