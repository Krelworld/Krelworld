// A/B: the regress flow 'tap floor walks; tap object opens its choices', with what was under the finger and what opened.
const L = require('./lib.js');
(async () => {
  for (const [name, o] of [['HEAD', { head: true }], ['dock', {}], ['dock G16 off', { off: 'G16' }], ['HEAD', { head: true }], ['dock', {}]]) {
    const g = await L.boot({ port: 8890, view: 'port', room: 'dining', ...o }); await g.calm();
    await g.ev(() => { G.busy = false; UI.closeActions(); for (const e of [daddy, mommy, rory]) if (e.room === G.room) e.room = 'yard'; if (niko.room === G.room) niko.room = 'yard'; miles.crying = false; miles.cryT = 999; });
    const under = async pt => g.ev(([x, y]) => { const t = document.elementFromPoint(x, y); return t ? (t.id || String(t.className)) : null; }, pt);
    const pt = await g.ev(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(marina.x + 70, 168).map((v, i) => v + (i ? st.top : st.left)); });
    await g.page.touchscreen.tap(pt[0], pt[1]); await g.wait(1800);
    await g.ev(() => { G.busy = false; UI.closeActions(); const t = PROPS.dining.find(q => q.id === 'table'); marina.x = t.x - 70; }); await g.wait(1000);
    const pt2 = await g.ev(() => { const t = PROPS.dining.find(q => q.id === 'table'); const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(t.x, t.y - 20).map((v, i) => v + (i ? st.top : st.left)); });
    const u2 = await under(pt2); await g.page.touchscreen.tap(pt2[0], pt2[1]); await g.wait(3000);
    const r2 = await g.ev(() => ({ acts: document.querySelectorAll('.act').length, stk: !!document.getElementById('stkBox'), panel: !document.getElementById('panel').classList.contains('hidden') ? (document.querySelector('#panel .ttl') || {}).textContent || 'panel' : null }));
    await g.ev(() => { const b = document.getElementById('stkBox'); b && b.remove(); try { UI.closePanel(); } catch (e) { } G.busy = false; UI.closeActions(); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = marina.x + 60; daddy.y = marina.y; AI.hold(daddy, true); }); await g.wait(900);
    const pt3 = await g.ev(() => { const st = document.getElementById('stage').getBoundingClientRect(); return toScreen(daddy.x, daddy.y - 40).map((v, i) => v + (i ? st.top : st.left)); });
    const u3 = await under(pt3); await g.page.touchscreen.tap(pt3[0], pt3[1]); await g.wait(2500);
    const r3 = await g.ev(() => ({ acts: document.querySelectorAll('.act').length, stk: !!document.getElementById('stkBox'), panel: !document.getElementById('panel').classList.contains('hidden') ? (document.querySelector('#panel .ttl') || {}).textContent || 'panel' : null }));
    console.log(name.padEnd(13), JSON.stringify({ table: { underFinger: u2, ...r2 }, daddy: { underFinger: u3, ...r3 } }), g.errs()); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
