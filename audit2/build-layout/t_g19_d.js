// G19 checks D: backyard right end (padR 0): deer and turkey edge tabs on the open picture, the trees.js ring nudge never moves
// a ring, rings stay inside the picture; Minka's 🔍 markers in the basement are not under any control.
const { boot, OUT, MINE } = require('./lib.js'); const fs = require('fs');
const onPic = () => { window.__onPic = (wx, wy) => { const st = document.getElementById('stage').getBoundingClientRect(), [sx, sy] = toScreen(wx, wy); if (sx < 0 || sx > st.width || sy < 0 || sy > st.height) return 'off'; const n = document.elementFromPoint(st.left + sx, st.top + sy); return n && n.id === 'cv' ? 'cv' : (n && (n.closest('#moodbar') ? 'moodbar' : n.id || n.className.toString().split(' ')[0])); }; };
(async () => {
  const res = {};
  for (const view of ['land', 'landSmall']) for (const [mode, off] of [['TODAY', MINE], ['G19', 'G4,G13,G14']]) {
    const key = view + ' ' + mode; const g = await boot({ view, room: 'kitchen', off }); const p = g.page; const out = res[key] = {};
    await p.evaluate(onPic);
    await g.calm(); await p.evaluate(() => travelTo('backyard')); await p.waitForTimeout(1500); await g.calm();
    // camera at the right end
    await p.evaluate(() => { marina.x = ROOMS.backyard.w - 20; marina.stop(); }); await p.waitForTimeout(1500);
    out.rightEnd = await p.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(), [ex] = toScreen(ROOMS.backyard.w, 0); return { roomEndPx: Math.round(ex), stageW: Math.round(st.width), camX: +E.camX.toFixed(1), viewW: +E.viewW.toFixed(1), endUnder: window.__onPic(ROOMS.backyard.w - 4, 150) }; });
    await g.shot(OUT + 'shots/g19d_' + view + '_' + mode + '_backyard_end.png');
    // trees and toys at the right half: open each ring (as a tap would) and see where the ring sits
    out.rings = await p.evaluate(async () => {
      const list = PROPS.backyard.filter(q => q.ytree || q.a === 'bigtree'); const res = [];
      for (const q of list) {
        if (q.x < ROOMS.backyard.w * 0.5) continue; marina.x = clamp(q.x - 30, 20, ROOMS.backyard.w - 20); marina.stop(); await new Promise(r => setTimeout(r, 1300)); G.busy = false;
        UI.closeActions(); const st = document.getElementById('stage').getBoundingClientRect(), bar = document.getElementById('moodbar').getBoundingClientRect();
        const left0 = []; const mo = new MutationObserver(() => { }); UI.actions({ prop: q, x: q.x, y: q.y - 30, room: G.room }, propActions(q).length ? [{ ico: '🙂', fn() { } }, { ico: '😀', fn() { } }, { ico: '😃', fn() { } }] : []);
        await new Promise(r => setTimeout(r, 400));
        const acts = [...document.querySelectorAll('#fx .act')]; if (!acts.length) { res.push(q.id + ': no ring'); continue; }
        let right = -1e9, top = 1e9, bot = -1e9; for (const n of acts) { const r = n.getBoundingClientRect(); right = Math.max(right, r.right); top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); }
        const nudgeWouldMove = !(right <= bar.left - 6 || bot < bar.top || top > bar.bottom);
        res.push(q.id + ': ringRight ' + Math.round(right) + ' stageRight ' + Math.round(st.right) + ' barLeft ' + Math.round(bar.left) + (nudgeWouldMove ? ' NUDGE-MOVES' : ' nudge idle') + (right > st.right + 0.5 ? ' OUTSIDE-PICTURE' : ''));
        UI.closeActions();
      }
      return res; });
    // deer: out, and off the picture to the right -> the tab sits at the picture's right edge (y 86)
    await g.calm(); await p.evaluate(() => { marina.x = 40; marina.stop(); Wildlife.visit('graze'); }); await p.waitForTimeout(5000);
    out.deer = await p.evaluate(async () => {
      const s = Wildlife.state; if (!s) return 'no visit'; const herd = s.deer.filter(d => !d.hidden); if (!herd.length) return 'herd hidden';
      const hx = herd.reduce((a, d) => a + d.x, 0) / herd.length; marina.x = hx > ROOMS.backyard.w / 2 ? 20 : ROOMS.backyard.w - 20; marina.stop(); await new Promise(r => setTimeout(r, 1800));
      const s2 = Wildlife.state, h2 = s2.deer.filter(d => !d.hidden), off = h2.every(d => d.x < E.camX - 6 || d.x > E.camX + E.viewW + 6); if (!off) return 'herd still on the picture (phase ' + s2.phase + ')';
      const hx2 = h2.reduce((a, d) => a + d.x, 0) / h2.length, side = hx2 < E.camX ? -1 : 1, x = side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14, y = 86;
      const pts = [[0, 0], [-8, -9], [8, -9], [-8, 9], [8, 9]].map(([dx, dy]) => window.__onPic(x + dx, y + dy));
      return { side, x: Math.round(x), phase: s2.phase, points: pts.join(',') }; });
    await g.shot(OUT + 'shots/g19d_' + view + '_' + mode + '_deer.png');
    await p.evaluate(() => Wildlife.calm()); await p.waitForTimeout(3500);
    // turkeys: the game reports its own tab
    await g.calm(); await p.evaluate(() => { marina.x = 40; marina.stop(); Wildlife.turkeys(); }); await p.waitForTimeout(5000);
    out.turkey = await p.evaluate(async () => {
      for (const mx of [20, ROOMS.backyard.w - 20, 20]) { marina.x = mx; marina.stop(); await new Promise(r => setTimeout(r, 2200)); const ts = Wildlife.turkeyState; if (!ts) return 'no flock'; const t = ts.tab; if (!t) continue;
        const pts = [[0, -3], [-8, -9], [8, -9], [-8, 9], [8, 9]].map(([dx, dy]) => window.__onPic(t.x + dx, t.y + dy)); return { side: t.side, x: Math.round(t.x), y: t.y, points: pts.join(',') }; }
      return 'no tab shown (flock on the picture)'; });
    await g.shot(OUT + 'shots/g19d_' + view + '_' + mode + '_turkey.png');
    await p.evaluate(() => Wildlife.calm()); await p.waitForTimeout(1500);
    // Minka's hide-and-seek markers in every basement room, camera at both ends and the middle
    await g.calm(); await p.evaluate(() => { travelTo('den'); }); await p.waitForTimeout(1500); await p.evaluate(() => Minka.hideNow()); await p.waitForTimeout(800);
    const mk = { covered: [], shown: 0 };
    for (const room of ['den', 'storage', 'laundry', 'nunuroom']) {
      await g.calm(); await p.evaluate(r => travelTo(r), room); await p.waitForTimeout(1300); await g.calm();
      for (const where of [0.02, 0.5, 0.98]) {
        await p.evaluate(f => { marina.x = ROOMS[G.room].w * f; marina.stop(); G.busy = false; }, where); await p.waitForTimeout(1500);
        const r = await p.evaluate(() => { const h = Minka.state().hiding; if (!h) return { none: true }; const out = []; for (const id of Minka.spots) { if (Minka.spotRooms[id] !== G.room || h.checked.includes(id)) continue; const ic = Minka._debug.spotIcon(id); if (!ic) continue;
          const c = window.__onPic(ic[0], ic[1]); if (c === 'off') continue; const ring = [[-6, 0], [6, 0], [0, -6], [0, 6]].map(([dx, dy]) => window.__onPic(ic[0] + dx, ic[1] + dy)); out.push({ id, c, ring: ring.join(',') }); } return { out }; });
        if (r.none) { mk.note = 'hide-and-seek not running'; continue; }
        for (const o of r.out) { mk.shown++; if (o.c !== 'cv' || /moodbar|mood|navarrow|hud|rb/.test(o.ring)) mk.covered.push(room + '@' + where + ' ' + o.id + ' centre ' + o.c + ' ring ' + o.ring); }
      }
      if (room === 'den') await g.shot(OUT + 'shots/g19d_' + view + '_' + mode + '_minka_den.png');
    }
    out.minka = mk;
    out.errors = g.errors.filter(e => !/chip_love/.test(e));
    console.log(key, JSON.stringify(out));
    await g.close();
  }
  fs.writeFileSync(OUT + 'g19_d.json', JSON.stringify(res, null, 1));
})();
