// Page errors in port, land, portSmall, landSmall with all switches on, and with my switches off. Exercises every path I touch:
// speech bubbles + alerts (G5 clamp), bigIcon, the map, give bubbles (dish, picture, Jeff, Nunu), the stop chip, the 📞 bubble,
// G22 icons, a runtime toggle of each of my switches. usage: node t_errors.js
const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const out = {};
  for (const off of ['', 'G5,G17,G22,G26']) for (const view of ['port', 'land', 'portSmall', 'landSmall']) {
    const g = await L.boot({ view, room: 'living', off }); await g.calm(); const P = g.page;
    const step = async (name, fn, wait) => { try { await P.evaluate(fn); } catch (e) { g.errors.push('STEP ' + name + ': ' + e.message.split('\n')[0]); } await P.waitForTimeout(wait || 700); };
    await step('bubbles+alerts', () => { miles.crying = true; miles.cryT = 99; G.poop = true; say('d_hi1', daddy); say('mo_hi1', mommy); say('m_yay'); });
    await step('bigIcon', () => UI.bigIcon('🍳', 900), 1000);
    await step('map open', () => openIsoMap(), 1200);
    await step('map close', () => { UI.closePanel && UI.closePanel(); document.getElementById('panel').classList.add('hidden'); }, 600);
    await step('dish', () => { G.busy = false; UI.closeActions(); G.holding = { type: 'dish', dish: { name: 't', art: 'cake', score: 2, say: [] } }; }, 900);
    await step('pic', () => { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; }, 900);
    await step('septic', () => { G.holding = null; miles.crying = false; G.poop = false; G.septic = true; daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; }, 2800);
    await step('toggle off', () => { for (const id of ['G5', 'G17', 'G22', 'G26']) Clarity.set(id, false); }, 700);
    await step('toggle on', () => { for (const id of ['G5', 'G17', 'G22', 'G26']) if (!(window.CLARITY_OFF)) Clarity.set(id, true); }, 700);
    await step('basement', () => { G.septic = false; travelTo('den'); }, 2500);
    await step('nunu pic', () => { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; nunu.room = 'den'; nunu.hidden = false; say('nu_hi1', nunu); }, 1200);
    await step('backyard', () => { G.holding = null; travelTo('backyard'); }, 2500);
    await step('jeff dish', () => { G.holding = { type: 'dish', dish: { name: 't', art: 'cake', score: 2, say: [] } }; jeff.room = 'backyard'; jeff.hidden = false; say('j_hi1', jeff); try { Wildlife.visit('graze'); } catch (e) { } }, 2500);
    await step('done', () => { G.holding = null; }, 500);
    out[(off ? 'off' : 'on') + ' ' + view] = L.real(g.errors);
    await g.close();
  }
  fs.writeFileSync(L.OUT + 't_errors.json', JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k, v.length ? v : 'no errors');
})().catch(e => { console.error(e); process.exit(1); });
