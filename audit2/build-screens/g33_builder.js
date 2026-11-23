// G33: Grandpa Jeff's take-down 🧹 -> 🗑️ everywhere; Movies row unchanged; main-floor 🧹 untouched. Results -> g33_builder.json
const { boot, OUT, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js'); const fs = require('fs');
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
(async () => {
  for (const off of ['', 'G33']) {
    const g = await boot({ port: 8910, view: 'land', room: 'backyard', off }); await g.calm(); await g.ev(TLIB);
    // two builds (and a tree house if the catalogue has one) of Jeff's
    const seeded = await g.ev(() => { const S = Builder.spots, used = new Set(), builds = []; let left = Builder.lumber;
      const add = c => { const sp = Object.keys(S).find(k => S[k].type === c.spot && !used.has(k)); if (!sp || c.cost > left) return false; used.add(sp); left -= c.cost; builds.push({ kind: c.id, spot: sp }); return true; };
      const th = Builder.catalogue.find(c => /tree/.test(c.id) && c.spot !== 'ground'); if (th) add(th);
      for (const c of Builder.catalogue.slice().sort((a, b) => a.cost - b.cost)) { if (builds.length >= 3) break; if (!builds.some(b => b.kind === c.id)) add(c); }
      localStorage.setItem('cm_builds', JSON.stringify({ builds })); return builds; });
    await g.page.reload(); await g.wait(2500); await g.ev(() => startGame('backyard')); await g.wait(3500); await g.calm(); await g.ev(TLIB);
    const o = { seeded, builds: await g.ev(() => Builder.list().map(b => b.kind + '@' + b.spot)) };
    // the ring on each built thing in the yard: real tap on it
    o.rings = {};
    for (const kind of await g.ev(() => Builder.list().map(b => b.kind))) {
      const xy = await g.ev(k => { G.busy = false; UI.closeActions(); const p = PROPS.backyard.find(q => q.a === 'built' && q.bl && q.b && q.b.kind === k); if (!p) return null; marina.x = p.x + 30; const [sx, sy] = toScreen(p.x, p.y - Math.min(30, (p.h || 40) / 2)); const st = document.getElementById('stage').getBoundingClientRect(); return [sx + st.left, sy + st.top]; }, kind);
      if (!xy) { o.rings[kind] = 'no prop'; continue; }
      await g.tapXY(xy[0], xy[1]); await g.wait(1600);
      let ring = await g.ev(() => [...document.querySelectorAll('#fx .act')].map(n => n.textContent + (n.classList.contains('bd-sec') ? '(sec)' : '')));
      if (!ring.length) { ring = await g.ev(k => { const p = PROPS.backyard.find(q => q.a === 'built' && q.bl && q.b && q.b.kind === k); UI.actions({ x: p.x, y: p.y - 40, prop: p }, propActions(p)); return [...document.querySelectorAll('#fx .act')].map(n => n.textContent + (n.classList.contains('bd-sec') ? '(sec)' : '')); }, kind); ring.unshift('(direct)'); }
      o.rings[kind] = ring;
    }
    // 🗑️ (or 🧹) on the last ring -> ❓ sub-ring -> takeDown runs and the planks come back
    const tdKind = o.builds.length ? o.builds[o.builds.length - 1].split('@')[0] : null;
    if (tdKind) {
      const before = await g.ev(() => ({ n: Builder.list().length, left: Builder.lumberLeft() }));
      const sub = await g.ev(async k => { G.busy = false; UI.closeActions(); const p = PROPS.backyard.find(q => q.a === 'built' && q.bl && q.b && q.b.kind === k); UI.actions({ x: p.x, y: p.y - 40, prop: p }, propActions(p)); await T.sleep(100);
        const td = [...document.querySelectorAll('#fx .act')].find(n => n.textContent === '🗑️' || n.textContent === '🧹'); const glyph = td.textContent; T.press(td); await T.sleep(250);
        const q = [...document.querySelectorAll('#fx .act')]; const out = { glyph, subRing: q.map(n => n.textContent + (n.classList.contains('bd-sec') ? '(sec)' : '')) }; const ask = q.find(n => n.textContent === '❓'); if (ask) T.press(ask); return out; }, tdKind);
      await g.wait(4500); o.takeDownFromRing = Object.assign(sub, { before, after: await g.ev(() => ({ n: Builder.list().length, left: Builder.lumberLeft() })) });
    }
    // Jeff's menu: catalogue second button, the take-down cards and their reset
    const menu = await g.ev(async () => { await T.reset(); G.busy = false; Builder.open({}); await T.sleep(400); const sec = document.querySelector('#panel .ptop .pbtn:nth-child(2)'); const o = { catSecond: sec.textContent + ' [' + sec.getAttribute('aria-label') + ']' };
      T.press(sec); await T.sleep(300); const cards = [...document.querySelectorAll('#panel .bd-down')]; o.downCards = cards.map(c => c.querySelector('.bd-broom').textContent); o.second = sec.textContent;
      if (cards.length >= 2) { T.press(cards[0]); await T.sleep(100); o.afterTapA = cards.map(c => c.querySelector('.bd-broom').textContent); T.press(cards[1]); await T.sleep(100); o.afterTapB = cards.map(c => c.querySelector('.bd-broom').textContent);
        const before = { n: Builder.list().length, left: Builder.lumberLeft() }; T.press(cards[1]); await T.sleep(4500); o.confirmB = { before, after: { n: Builder.list().length, left: Builder.lumberLeft() } }; }
      await T.sleep(2500); o.broomsInDom = [...document.querySelectorAll('#panel *, #fx *')].filter(n => n.childElementCount === 0 && n.textContent.includes('🧹')).length; await T.reset(); return o; });
    o.menu = menu;
    // Movies: the top row, ⏹️ back to the posters, ❌ and the floating ❌ close
    const mv = await g.ev(async () => { await T.reset(); Movies.open({}); await T.sleep(800); const row = () => [...document.querySelectorAll('#panel .mv-top button')].map(b => b.textContent.trim() || b.getAttribute('aria-label')).join(' ');
      const o = { pickRow: row() }; T.press(document.querySelector('#panel .mv-post')); await T.sleep(1500); o.filmRow = row(); o.mode = Movies.state().mode;
      const stop = [...document.querySelectorAll('#panel .mv-top button')].find(b => b.textContent.includes('⏹')); if (stop) { T.press(stop); await T.sleep(800); o.afterStop = Movies.state().mode; } return o; });
    const xy = await g.ev(() => { const r = document.getElementById('xFloat').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, document.getElementById('xFloat').textContent]; });
    await g.tapXY(xy[0], xy[1]); await g.wait(500); mv.xFloatGlyph = xy[2]; mv.xFloatCloses = await g.ev(() => !Movies.active);
    o.movies = mv;
    // main-floor 🧹 (broom, tidy ring, Daddy's request, Nunu's chores): every 🧹 choice outside Jeff's built things
    o.broomChoices = await g.ev(() => { const out = []; for (const r of Object.keys(PROPS)) for (const p of PROPS[r]) { if (p.a === 'built') continue; let a = []; try { a = propActions(p); } catch (e) { } if (a.some(x => x.ico === '🧹')) out.push(r + '/' + (p.id || p.a)); } return { props: out.sort(), sayTidy: SAY_ICON.d_req_tidy }; });
    log('builder' + (off ? ' G33off' : ''), o); res['errors' + off] = realErrors(g.errors); await g.close();
  }
  fs.writeFileSync(OUT + 'g33_builder.json', JSON.stringify(res, null, 1));
  for (const k in res) if (/errors/.test(k) && res[k].length) console.log('ERRORS', k, res[k]);
})().catch(e => { console.error(e); process.exit(1); });
