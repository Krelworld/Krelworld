// G22 checks. usage: node t_g22.js
const L = require('./lib.js'); const fs = require('fs');
const S = JSON.parse(fs.readFileSync(L.OUT + 'g22_static_keys.json'));
const S3 = ['d_phone1','d_phone2','d_phone3','d_phone5','d_phone6','d_phone7','d_phone8','nu_lotr1','nu_lotr2','nu_lotr3','nu_lotr4','nu_lotr6','nu_lotr7','nu_lotr8','nu_lotr9','nu_lotr11','nu_sweep1','nu_sweep2','nu_clutter','nu_lotr5','nu_laundry1','nu_laundry2','nu_laundry3','nu_clean1','nu_clean2','nu_smell1','nu_smell2','nu_smell3','nu_septic1','nu_septic2','nu_septic3','nu_septic_thanks','m_septic','d_septic','d_septic2','m_deer','j_deer','j_work1','j_work2','j_work3','j_helper','j_turkey','j_squirrel','m_hi_nunu','m_hi_jeff','nu_hi1','j_hi1','nu_love1','nu_kiss','nu_minka_where','m_minka_where','nu_catfight1','d_catfight','m_phone','m_phone2','d_phone_off','d_hi1','mo_hi1','r_hi_niece','r_giggle','r_chase','r_hi_niece3','m_want_cook','d_req_cook','mo_req_draw','r_req_tea','m_stinky','m_ugh_niko','d_niko_poo','m_sticker','m_found','m_look','m_wow','mo_feed_miles','m_precious','nu_precious_laugh'];
(async () => {
  const R = {};
  // snapshot with G22 off, then on
  const g0 = await L.boot({ view: 'port', room: 'kitchen', off: 'G22' }); const before = await g0.page.evaluate(() => ({ ...SAY_ICON })); R.errorsOff = L.real(g0.errors); await g0.close();
  const g = await L.boot({ view: 'port', room: 'kitchen' }); const P = g.page;
  const after = await P.evaluate(() => ({ ...SAY_ICON })); const table = await P.evaluate(() => Clarity.G22.table);
  R.existingChanged = Object.keys(before).filter(k => after[k] !== before[k]);
  R.added = Object.keys(after).filter(k => !(k in before)).length; R.tableSize = Object.keys(table).length;
  R.addedNotInTable = Object.keys(after).filter(k => !(k in before) && !(k in table));
  R.missingAfter = Object.keys(S).filter(k => !(k in after));
  R.s3 = S3.map(k => k + ' ' + (after[k] || '(💬 default)'));
  R.s3default = S3.filter(k => !after[k]);
  // runtime toggle: off removes exactly what G22 added, on puts it back
  R.toggle = await P.evaluate(() => { const n0 = Object.keys(SAY_ICON).length; Clarity.set('G22', false); const n1 = Object.keys(SAY_ICON).length, gone = !('nu_hi1' in SAY_ICON); Clarity.set('G22', true); return { n0, n1, gone, back: SAY_ICON.nu_hi1 }; });
  // live bubbles: log who shows which icon
  await P.evaluate(() => { window.__b = []; const _b = UI.bubble; UI.bubble = function (e, ic) { __b.push((e && e.id) + ' ' + ic); return _b.apply(this, arguments); }; });
  // den: Nunu's hello (her own words through family2's remap)
  R.denHello = [];
  for (let i = 0; i < 4 && !R.denHello.some(x => /^nunu /.test(x)); i++) {
    await P.evaluate(r => { __b.length = 0; G.busy = false; G.lastGreet = {}; travelTo(r); }, i % 2 ? 'kitchen' : 'den'); await P.waitForTimeout(4500);
    if (i % 2 === 0) R.denHello = await P.evaluate(() => __b.slice());
  }
  // direct: the game's generic hello said by Nunu (r_hi -> nu_hi1 via family2's say override)
  R.nunuSaysHi = await P.evaluate(async () => { __b.length = 0; nunu.room = G.room; nunu.hidden = false; say('r_hi', nunu); await new Promise(r => setTimeout(r, 300)); return __b.slice(); });
  // backyard: the deer arrive -> Marina's m_deer bubble
  await P.evaluate(() => { G.busy = false; travelTo('backyard'); }); await P.waitForTimeout(2500);
  await P.evaluate(() => { __b.length = 0; G.busy = false; Wildlife.visit('graze'); }); await P.waitForTimeout(6500);
  R.deerArrival = await P.evaluate(() => __b.slice());
  // two-emoji bubbles do not clip, portrait and landscape
  R.clip = {};
  for (const view of ['port', 'land']) {
    const g2 = view === 'port' ? g : await L.boot({ view: 'land', room: 'living' }); const Q = g2.page;
    R.clip[view] = await Q.evaluate(async () => { const out = []; G.busy = false;
      for (const [k, who] of [['m_hi_nunu', marina], ['m_hi_jeff', marina], ['m_septic', marina], ['d_septic', daddy], ['j_food_great', jeff], ['nu_proud', nunu], ['nu_nofood', nunu], ['j_tantrum', jeff]]) {
        for (const e of [daddy, jeff, nunu]) { e.room = G.room; e.hidden = false; e.state = 'idle'; AI.hold(e, true); e.stop(); e.x = E.camX + E.viewW / 2; e.y = 164; }
        marina.x = E.camX + E.viewW / 2;
        UI.bubble(who, SAY_ICON[k], 1500); await new Promise(r => setTimeout(r, 350));
        const n = [...document.querySelectorAll('#fx .say')].find(x => x.textContent === SAY_ICON[k]); if (!n) { out.push(k + ' none'); continue; }
        const r = n.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect();
        out.push({ k, ico: n.textContent, w: Math.round(r.width), overflow: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1, inStage: r.left >= st.left && r.right <= st.right && r.top >= st.top });
        await new Promise(r => setTimeout(r, 200));
      } return out; });
    await g2.shot(L.OUT + 'g22_clip_' + view + '.png');
    if (view !== 'port') { R['errors_' + view] = L.real(g2.errors); await g2.close(); }
  }
  R.errors = L.real(g.errors); await g.close();
  fs.writeFileSync(L.OUT + 't_g22.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ ...R, s3: undefined }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
