// portrait foyer: arriving mid-foyer (x 136) and walking to the stairs, the ⬆️🛏️ sign never sits under or touches ▶📺
const { boot, OUT } = require('./lib.js');
(async () => {
  for (const view of ['port', 'portSmall']) {
    const g = await boot({ view, room: 'living' }); await g.calm();
    const samples = [];
    const sample = async label => { for (let i = 0; i < 30; i++) { samples.push(await g.ev(label => { const s = Clarity.G35.signs.find(q => q.p.id === 'stairs'); if (!s || !s.spot || !s.at || performance.now() - s.at > 150) return label + ':none';
        const a = [s.cb[0], s.cb[1]], z = [s.cb[2], s.cb[3]], r = document.querySelector('.navarrow.r').getBoundingClientRect();
        const gap = Math.max(r.left - z[0], a[0] - r.right, r.top - z[1], a[1] - r.bottom); return label + ':gap' + Math.round(gap) + (getComputedStyle(document.querySelector('.navarrow.r')).opacity < 0.05 ? '(arrow hidden)' : ''); }, label)); await g.wait(100); } };
    await g.ev(() => travelTo('foyer')); await sample('arrive136');
    await g.ev(() => { marina.walkTo(214, null, null, FLOOR); }); await sample('walkToStairs');
    await g.ev(() => { marina.walkTo(136, null, null, FLOOR); }); await sample('walkBack');
    const out = {}; for (const s of samples) { const [k, v] = s.split(':'); (out[k] = out[k] || new Set()).add(v); }
    console.log(view, JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].join(' ')]))), g.realErrors());
    await g.close();
  }
})();
