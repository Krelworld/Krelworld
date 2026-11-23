// G17 behaviour: the stop chip, who gets a give bubble, and that every bubble tap gives the same outcome as the ring choice.
// usage: node t_g17a.js [off]
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] || ''; const tag = OFF ? '_off' : '';
const PIC = () => { const c = document.createElement('canvas'); c.width = 20; c.height = 15; const x = c.getContext('2d'); x.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); x.fillRect(0, 0, 20, 15); return c.toDataURL(); };
(async () => {
  const R = {};
  const g = await L.boot({ view: 'port', room: 'living', off: OFF }); await g.calm(); const P = g.page;
  await P.evaluate(() => { window.__v = []; const _v = Audio2.voice; Audio2.voice = function (k) { __v.push(k); return _v.apply(this, arguments); };
    window.__did = []; const _d = window.did; if (_d) window.did = function (k) { __did.push(k); return _d.apply(this, arguments); }; });
  const settle = () => P.evaluate(async () => { for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (!G.busy && !G.sceneOn && !marina.moving) break; } });
  const go = room => P.evaluate(async r => { if (G.room !== r) travelTo(r); await new Promise(q => setTimeout(q, 1500)); G.busy = false; G.sceneOn = false; UI.closeActions(); marina.stop && marina.stop(); marina.x = Math.min(ROOMS[r].w - 40, 200); let last = -1; for (let i = 0; i < 40; i++) { await new Promise(q => setTimeout(q, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } }, room);
  const hints = () => P.evaluate(() => [...document.querySelectorAll('#fx .pichint')].map(n => n.textContent + ':' + n.getAttribute('aria-label') + '@' + Math.round(parseFloat(n.style.left))).join(' '));
  const tapHintOver = async who => { const pt = await P.evaluate(w => { const e = ({ daddy, mommy, rory, nunu, jeff })[w], st = document.getElementById('stage').getBoundingClientRect(); const sx = toScreen(e.x, 0)[0];
      let best = null, bd = 1e9; for (const n of document.querySelectorAll('#fx .pichint.gift')) { const r = n.getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - st.left - sx); if (d < bd) { bd = d; best = r; } } return best ? [(best.left + best.right) / 2, (best.top + best.bottom) / 2] : null; }, who);
    if (!pt) return false; await P.touchscreen.tap(pt[0], pt[1]); return true; };
  const tapAct = async ico => { const pt = await P.evaluate(i => { const n = [...document.querySelectorAll('.act')].find(b => b.textContent === i); if (!n) return null; const r = n.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; }, ico); if (!pt) return false; await P.touchscreen.tap(pt[0], pt[1]); return true; };
  const tapEnt = async (who, dy) => { const p = await P.evaluate(([w, dy]) => [({ daddy, mommy, rory, nunu, jeff })[w].x, ({ daddy, mommy, rory, nunu, jeff })[w].y + dy], [who, dy]); return g.tapWorld(p[0], p[1]); };
  const hold = (kind, url) => P.evaluate(([k, u]) => { G.busy = false; UI.closeActions(); G.holding = k === 'dish' ? { type: 'dish', dish: { name: 'test', art: 'cake', score: 2, say: [] } } : { type: 'pic', url: u, ico: '🖼️' }; }, [kind, url]);
  const place = (who, f, extra) => P.evaluate(([w, f, ex]) => { const e = ({ daddy, mommy, rory, nunu, jeff })[w]; AI.hold(e, true); e.stop(); e.room = G.room; e.hidden = false; e.state = 'idle'; e.x = E.camX + f * E.viewW; e.y = 164; e.face = null; if (ex) Object.assign(e, ex); }, [who, f, extra || null]);
  const vlog = () => P.evaluate(() => { const v = __v.slice(); __v.length = 0; return v; });
  const didlog = () => P.evaluate(() => { const v = __did.slice(); __did.length = 0; return v; });

  // (1) the stop chip
  await hold('pic', await P.evaluate(PIC)); await P.waitForTimeout(600);
  R.chipPic = await P.evaluate(() => document.getElementById('stopBtn').textContent + (document.getElementById('stopBtn').classList.contains('hidden') ? ' (hidden)' : ''));
  await hold('dish'); await P.waitForTimeout(600);
  R.chipDish = await P.evaluate(() => document.getElementById('stopBtn').textContent);
  await hold('pic', await P.evaluate(PIC)); await P.waitForTimeout(500);
  await g.tap('#stopBtn'); await P.waitForTimeout(400);
  R.chipTapDrops = await P.evaluate(() => G.holding === null);

  // (2) who gets a bubble — living room: Daddy, Mommy, Rory
  await go('living'); await P.evaluate(() => { G.rory = true; rory.hidden = false; });
  await place('daddy', 0.25); await place('mommy', 0.5); await place('rory', 0.75);
  await hold('dish'); await P.waitForTimeout(500); R.livingDish = await hints();
  await hold('pic', await P.evaluate(PIC)); await P.waitForTimeout(500); R.livingPic = await hints();
  // backyard: Grandpa Jeff
  await P.evaluate(() => { G.holding = null; }); await go('backyard'); await place('jeff', 0.7);
  await hold('dish'); await P.waitForTimeout(500); R.backyardDish = await hints();
  await hold('pic', await P.evaluate(PIC)); await P.waitForTimeout(500); R.backyardPic = await hints();
  await P.evaluate(() => { jeff.hidden = true; }); await P.waitForTimeout(400); R.backyardPicJeffHidden = await hints();
  await P.evaluate(() => { jeff.hidden = false; jeff.state = 'toilet'; }); await P.waitForTimeout(400); R.backyardPicJeffToilet = await hints();
  await P.evaluate(() => { jeff.state = 'idle'; });
  // den: Nunu
  await P.evaluate(() => { G.holding = null; }); await go('den'); await place('nunu', 0.7);
  await hold('dish'); await P.waitForTimeout(500); R.denDish = await hints();
  R.nunuRingWithDish = await P.evaluate(() => entActions(nunu).map(a => a.ico).join(''));
  await hold('pic', await P.evaluate(PIC)); await P.waitForTimeout(500); R.denPic = await hints();
  await P.evaluate(() => { nunu.hidden = true; }); await P.waitForTimeout(400); R.denPicNunuHidden = await hints();
  await P.evaluate(() => { nunu.hidden = false; nunu.state = 'toilet'; }); await P.waitForTimeout(400); R.denPicNunuToilet = await hints();
  await P.evaluate(() => { nunu.state = 'idle'; G.holding = null; });

  // (3) Nunu with a dish through her ring: 🍽️ noFood
  await hold('dish'); await place('nunu', 0.7); await vlog();
  await tapEnt('nunu', -50); await P.waitForTimeout(1800); R.nunuRingOpened = await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join(''));
  await tapAct('🍽️'); await P.waitForTimeout(2500); R.nunuNoFoodLines = await vlog(); R.nunuNoFoodStillHolding = await P.evaluate(() => !!G.holding);
  await P.evaluate(() => { G.holding = null; }); await settle();

  // (4) Grandpa Jeff with a dish: bubble vs ring (serve, j_food_* lines); also with G.pendingDish === jeff
  await go('backyard');
  for (const mode of ['bubble', 'ring', 'bubble+pending', 'ring+pending']) {
    await place('jeff', 0.75); await P.evaluate(() => { jeff.plate = null; });
    if (mode.includes('pending')) await P.evaluate(() => { G.pendingDish = { who: jeff, dish: { name: 'old', art: 'cake', score: -2, say: [] } }; });
    await hold('dish'); await P.waitForTimeout(600); await vlog();
    if (mode.startsWith('bubble')) R['jeff_' + mode + '_tapped'] = await tapHintOver('jeff');
    else { await tapEnt('jeff', -50); await P.waitForTimeout(1500); R['jeff_' + mode + '_ring'] = await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join('')); await tapAct('🍽️'); }
    await P.waitForTimeout(800); await settle(); await P.waitForTimeout(1500);
    R['jeff_' + mode + '_lines'] = (await vlog()).join(' ');
    R['jeff_' + mode + '_after'] = await P.evaluate(() => ({ holding: !!G.holding, plate: !!jeff.plate, pending: G.pendingDish ? G.pendingDish.who.id : null }));
    await P.evaluate(() => { G.pendingDish = null; G.moodCtx = null; G.holding = null; jeff.plate = null; });
  }

  // (5) a picture to Nunu (den) and to Jeff (backyard): bubble vs 🎁🖼️ ring 👵/👴 — lines, wall placement, sticker
  for (const [room, who, ico] of [['den', 'nunu', '👵'], ['backyard', 'jeff', '👴']]) {
    await go(room);
    for (const mode of ['bubble', 'ring']) {
      await place(who, 0.75);
      const url = await P.evaluate(PIC); await hold('pic', url); await P.waitForTimeout(600); await vlog(); await didlog();
      
      if (mode === 'bubble') R[who + '_pic_bubble_tapped'] = await tapHintOver(who);
      else { await g.tap('.alertb[aria-label=picgive]'); await P.waitForTimeout(600); R[who + '_pic_ring'] = await P.evaluate(() => [...document.querySelectorAll('.act')].map(n => n.textContent).join('')); await tapAct(ico); }
      await P.waitForTimeout(1000); await settle(); await P.waitForTimeout(2500);
      R[who + '_pic_' + mode + '_lines'] = (await vlog()).join(' ');
      R[who + '_pic_' + mode + '_did'] = (await didlog()).join(' ');
      R[who + '_pic_' + mode + '_wall'] = await P.evaluate(url => { const h = Pics.hash(url); const w = (Pics.walls || []).find(q => q.h === h); return w ? { room: w.room, gift: w.gift, y: w.y } : { none: true, gifts: (Pics.walls || []).filter(q => q.gift).map(q => q.gift + '@' + q.room) }; }, url);
      R[who + '_pic_' + mode + '_holding'] = await P.evaluate(() => !!G.holding);
    }
  }
  R.errors = L.real(g.errors); await g.close();
  fs.writeFileSync(L.OUT + 't_g17a' + tag + '.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
