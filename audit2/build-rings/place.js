// open real choice menus by tapping, in a given viewport; measure where the buttons land; screenshot each
// usage: node place.js <view> [caseFilter]
const L = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-rings/lib.js'); const H = L.H; const TAG = process.env.TAG || '';
const fs = require('fs');
const W = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-rings/place/';
const view = process.argv[2] || 'port', filt = process.argv[3] ? new RegExp(process.argv[3]) : null;
const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAYAAABr5z2BAAAAJklEQVR42mP8z8Dwn4ECwESJZhQwasCoAaMGjBowasCoAaMGUAMACQUCJPiH1XgAAAAASUVORK5CYII=';
const hsh = u => u.length + ':' + u.slice(-28);
// cases: room, setup (in page), target: {prop:id} | {ent:name} | {self:true} | {fn: 'code that opens a menu'}
const CASES = [
  ['kitchen-fridge', 'kitchen', '', { prop: 'fridge' }],
  ['kitchen-stove', 'kitchen', '', { prop: 'stove' }],
  ['kitchen-island', 'kitchen', '', { prop: 'island', fy: 0.15 }],
  ['kitchen-island-mid', 'kitchen', '', { prop: 'island' }],
  ['kitchen-bowls', 'kitchen', '', { prop: 'bowls' }],
  ['dining-table', 'dining', '', { prop: 'table' }],
  ['dining-table-dish', 'dining', 'G.holding={type:"dish",dish:{art:"cake",score:3,say:[],name:"x",ings:["eggs"],method:"bake"}};', { prop: 'table' }],
  ['dining-closet', 'dining', '', { prop: 'closet' }],
  ['dining-cattower', 'dining', '', { prop: 'cattower' }],
  ['dining-chair1', 'dining', '', { prop: 'chair1' }],
  ['playroom-keys', 'playroom', '', { prop: 'keys' }],
  ['playroom-kidtable', 'playroom', '', { prop: 'kidtable' }],
  ['playroom-loveseat', 'playroom', '', { prop: 'loveseat' }],
  ['playroom-tray', 'playroom', '', { prop: 'tray' }],
  ['playroom-toyshelf', 'playroom', '', { prop: 'toyshelf' }],
  ['foyer-stairs', 'foyer', '', { prop: 'stairs' }],
  ['living-tv', 'living', '', { prop: 'tv' }],
  ['living-tv-on', 'living', 'tvOn(showList()[0]);', { prop: 'tv', wait: 2500 }],
  ['living-tv-low', 'living', '', { prop: 'tv', fy: 0.85 }],
  ['living-tv-on-low', 'living', 'tvOn(showList()[0]);', { prop: 'tv', wait: 2500, fy: 0.85 }],
  ['living-fireplace', 'living', '', { prop: 'fireplace' }],
  ['living-sectional', 'living', '', { prop: 'sectional' }],
  ['living-lamp', 'living', '', { prop: 'lamp' }],
  ['living-pnp-miles', 'living', 'miles.spot="crib"; mommy.holdingMiles=false;', { prop: 'pnp' }],
  ['living-pnp', 'living', 'miles.spot="bouncer";', { prop: 'pnp' }],
  ['living-shelf1', 'living', '', { prop: 'shelf1' }],
  ['bathroom-toilet', 'bathroom', '', { prop: 'toilet' }],
  ['bathroom-mirror', 'bathroom', '', { prop: 'mirror' }],
  ['bathroom-shower', 'bathroom', '', { prop: 'shower' }],
  ['bathroom-tp', 'bathroom', '', { prop: 'tpholder' }],
  ['yard-swing', 'yard', '', { prop: 'swing' }],
  ['yard-mbars', 'yard', '', { prop: 'mbars' }],
  ['yard-leafpile', 'yard', 'WEATHER="fall";', { prop: 'leafpile' }],
  ['yard-car', 'yard', '', { prop: 'car' }],
  ['self-idle', 'living', '', { self: true }],
  ['self-holding', 'kitchen', 'G.holding={type:"dish",dish:{art:"cake",score:3,say:[],name:"x",ings:["eggs"],method:"bake"}};', { self: true }],
  ['self-gym', 'playroom', '', { fn: 'gymMenu()' }],
  ['self-perch-daddy', 'living', 'bring(daddy); marina.x=70; marina.state="perch"; marina.offY=-30; marina.perchProp=PROPS.living.find(p=>p.id==="sectional");', { self: true }],
  ['who-daddy', 'dining', 'bring(daddy);', { ent: 'daddy' }],
  ['who-daddy-dish', 'dining', 'bring(daddy); G.holding={type:"dish",dish:{art:"cake",score:3,say:[],name:"x",ings:["eggs"],method:"bake"}};', { ent: 'daddy' }],
  ['who-mommy', 'dining', 'bring(mommy);', { ent: 'mommy' }],
  ['who-rory', 'dining', 'bring(rory);', { ent: 'rory' }],
  ['who-rory-fort', 'living', 'bring(rory); G.fort={complete:true,room:"living",guests:[],x:120,L:90,R:150,roofY:100,pieces:[],inside:false,ox:0,oy:0,bw:40,bh:30,img:document.createElement("canvas"),scale:1,toys:[],theme:"cozy",wob:0,built:E.t};', { ent: 'rory' }],
  ['who-niko', 'dining', 'bring(niko);', { ent: 'niko' }],
  ['who-miles', 'living', 'miles.spot="bouncer"; miles.x=300; miles.room="living"; mommy.holdingMiles=false; miles.poopy=true; marina.x=250;', { ent: 'miles' }],
  ['who-nunu-main', 'dining', 'bring(nunu);', { ent: 'nunu' }],
  ['tidy-prompt', 'playroom', '', { fn: 'UI.actions(marina,[A("🧹",()=>{}),A("🏃",()=>{})])' }],
  ['pic-on-wall', 'living', '', { pic: true }],
];
(async () => {
  const storage = { cm_gallery: JSON.stringify([PIC]), cm_walls: JSON.stringify([{ h: hsh(PIC), room: 'living', x: 110, y: 60 }]) };
  const g = await L.boot({ port: +(process.env.PORT || 8870), view, room: 'living', storage });
  await g.calm();
  await g.page.evaluate(() => {
    window.__anchor = null; const _ua = UI.actions; UI.actions = function (a, l) { window.__anchor = a; return _ua.apply(this, arguments); };
    window.bring = (e, st) => { e.room = G.room; e.hidden = false; e.state = st || (e === niko ? 'sit' : 'idle'); e.x = Math.min(ROOMS[G.room].w - 20, marina.x + 50); e.y = FLOOR; if (e === rory) G.rory = true; if (e === niko) { niko.t = 99; niko.perchY = null; } AI.hold && e !== niko && e !== miles && AI.hold(e, true); };
    window.__quiet2 = (room) => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); try { lastPing = E.t + 9999; } catch (e) { }
      for (const e of [daddy, mommy, rory, nunu, jeff]) { if (e.room === room) { e.room = room === 'yard' ? 'kitchen' : 'yard'; } AI.hold && AI.hold(e, true); }
      if (niko.room === room) niko.room = room === 'yard' ? 'kitchen' : 'yard';
      miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.mess = []; G.needTP = false; G.holding = null; G.fort = null; G.pendingDish = null; G.snowman = 0; G.septic = false; if (G.tv) { try { tvOff(true); } catch (e) { G.tv = null; } }
      if (marina.mount) dismount(); marina.state = 'idle'; marina.offY = 0; marina.anim = null; };
    // replicate ui.js anchorRect/entTop so we can measure the thing that was tapped
    window.__entTop = e => { if (e === marina) return e.y + e.offY - 80 * e.scale; if (e.id === 'miles') return (e.spot === 'crib' ? BACK - 10 : 156) - 40; if (e.id === 'niko') return (e.perchY || e.y) - 40; if (e.id === 'mommy' && e.state === 'sit') return e.y - 92; if (e.state === 'lie') return e.y - 34; if (e.state === 'horse') return e.y - 70; return e.y - (e.prop ? 0 : 96) + (e.prop ? 0 : 6); };
    window.__rect = a => { let x0, y0, x1, y1; if (a.prop) { const p = a.prop, sc = p.scale || 1, b = p.k && !p.k.startsWith('p:') ? visBox(p.k).map(n => n * sc) : [-(p.w || 20) / 2, -(p.h || 30), (p.w || 20) / 2, 0]; x0 = p.x + b[0]; y0 = p.y + b[1]; x1 = p.x + b[2]; y1 = p.y + b[3]; }
      else if (a.id) { const t = __entTop(a) + 8; x0 = a.x - 16; x1 = a.x + 16; y0 = t; y1 = (a === marina ? a.y + a.offY : a.id === 'miles' || a.id === 'niko' ? t + 34 : a.y); } else { x0 = a.x - 10; x1 = a.x + 10; y0 = a.y - 8; y1 = a.y + 12; }
      const st = document.getElementById('stage').getBoundingClientRect(); const [sx0, sy0] = toScreen(x0, y0), [sx1, sy1] = toScreen(x1, y1); return [sx0 + st.left, sy0 + st.top, sx1 + st.left, sy1 + st.top]; };

    window.__pick = (x0, y0, x1, y1, want) => { const st = document.getElementById('stage').getBoundingClientRect(); const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; const pts = [];
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const x = x0 + (x1 - x0) * (i + 0.5) / 9, y = y0 + (y1 - y0) * (j + 0.5) / 9; pts.push([x, y, Math.hypot(x - cx, (y - cy) * 1.5)]); }
      pts.sort((a, b) => a[2] - b[2]);
      const nm = h => h ? h.kind + ':' + (h.p ? h.p.id : h.e ? h.e.id : h.w ? 'pic' : '') : 'none';
      const at = (x, y) => { const [sx, sy] = toScreen(x, y); const el = document.elementFromPoint(sx + st.left, sy + st.top); return el && el.id === 'cv' ? null : (el ? (el.id || (el.className + '').split(' ')[0] || el.tagName) + ':' + (el.textContent || '').trim().slice(0, 3) : 'offscreen'); };
      const centre = { hit: nm(hitTest(pts[0][0], pts[0][1])), dom: at(pts[0][0], pts[0][1]) };
      for (const [x, y] of pts) { if (at(x, y)) continue; if (nm(hitTest(x, y)) === want) return { pt: [x, y], centre }; }
      return { pt: null, centre }; };
    window.__measure = () => {
      const R = n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const vis = n => { const r = n.getBoundingClientRect(), cs = getComputedStyle(n); return r.width > 3 && r.height > 3 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
      const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const st = R(document.getElementById('stage')); const acts = [...document.querySelectorAll('#fx .act')].map(n => ({ t: n.textContent || (n.querySelector('img') ? 'img' : ''), r: R(n) }));
      const trayN = document.querySelector('.acttray'); const tray = trayN ? R(trayN) : null;
      const anc = window.__anchor ? __rect(window.__anchor) : null, mar = __rect(marina);
      const hud = []; for (const n of document.querySelectorAll('#moodbar .mood, .hud, .facecard, #stopBtn, #wishBtn, .alertb, #floorpill .fl, .navarrow, #roombar .rb, .pichint')) if (vis(n) && !n.closest('#fx')) hud.push({ id: n.id || (n.className + '').split(' ')[0] + ':' + (n.textContent || '').trim().slice(0, 3), r: R(n) });
      const res = { view: [innerWidth, innerHeight], stage: st.map(Math.round), n: acts.length, tray: tray && tray.map(Math.round), trayScrollW: trayN ? trayN.scrollWidth : null, trayClientW: trayN ? trayN.clientWidth : null,
        anchor: anc && anc.map(Math.round), marina: mar.map(Math.round), acts: acts.map(a => ({ t: a.t, r: a.r.map(Math.round) })) };
      const area = r => Math.max(1, (r[2] - r[0]) * (r[3] - r[1]));
      res.coverAnchorPct = anc ? Math.round(100 * Math.min(1, acts.reduce((s, a) => s + ov(a.r, anc), 0) / area(anc))) : null;
      res.coverMarinaPct = Math.round(100 * Math.min(1, acts.reduce((s, a) => s + ov(a.r, mar), 0) / area(mar)));
      if (tray && anc) res.trayCoverAnchorPct = Math.round(100 * ov(tray, anc) / area(anc));
      res.offscreen = acts.filter(a => a.r[0] < 0 || a.r[1] < 0 || a.r[2] > innerWidth || a.r[3] > innerHeight).map(a => a.t);
      res.outsideStage = acts.filter(a => a.r[0] < st[0] - 1 || a.r[1] < st[1] - 1 || a.r[2] > st[2] + 1 || a.r[3] > st[3] + 1).map(a => a.t);
      res.nearEdge = acts.filter(a => a.r[0] < 12 || a.r[2] > innerWidth - 12).map(a => a.t);
      res.hudHits = []; for (const a of acts) for (const h of hud) if (ov(a.r, h.r) > 30) res.hudHits.push(a.t + '×' + h.id);
      if (tray) for (const h of hud) if (ov(tray, h.r) > 30) res.hudHits.push('TRAY×' + h.id);
      // distance from the anchor centre to the button group centre
      if (acts.length && anc) { const gx = acts.reduce((s, a) => s + (a.r[0] + a.r[2]) / 2, 0) / acts.length, gy = acts.reduce((s, a) => s + (a.r[1] + a.r[3]) / 2, 0) / acts.length; res.dist = Math.round(Math.hypot(gx - (anc[0] + anc[2]) / 2, gy - (anc[1] + anc[3]) / 2)); res.side = Math.abs(gy - (anc[1] + anc[3]) / 2) > Math.abs(gx - (anc[0] + anc[2]) / 2) ? (gy < (anc[1] + anc[3]) / 2 ? 'above' : 'below') : (gx < (anc[0] + anc[2]) / 2 ? 'left' : 'right'); }
      return res;
    };
  });
  const out = [];
  for (const [name, room, setup, tgt] of CASES) {
    if (filt && !filt.test(name)) continue;
    try {
      await g.page.evaluate(r => { if (G.room !== r) { try { travelTo(r); } catch (e) { changeRoom(r, null, ROOMS[r].w / 2); } } }, room);
      await g.page.waitForTimeout(1200);
      await g.page.evaluate(r => { try { if (!document.getElementById('panel').classList.contains('hidden')) UI.closePanel(); } catch (e) { } __quiet2(r); }, room);
      // stand Marina a little away from the target so the camera shows it
      await g.page.evaluate(([tgt]) => { let x = null; if (tgt.prop) { const p = PROPS[G.room].find(q => q.id === tgt.prop); x = p.x; } else if (tgt.pic) x = 110; if (x != null) { marina.x = clamp(x + (x > ROOMS[G.room].w / 2 ? -40 : 40), 15, ROOMS[G.room].w - 15); marina.y = FLOOR; } }, [tgt]);
      await g.page.waitForTimeout(1100);
      await g.page.evaluate(s => { eval(s); }, setup);
      if (tgt.wait) await g.page.waitForTimeout(tgt.wait);
      await g.page.evaluate(() => { G.busy = false; window.__anchor = null; });
      let pt = null, hitName = null, centre = null;
      const box = await g.page.evaluate(arg => { const tgt = arg;
        if (tgt.prop) { const p = PROPS[G.room].find(q => q.id === tgt.prop); const b = p.k && !p.k.startsWith('p:') ? visBox(p.k).map(n => n * (p.scale || 1)) : [-(p.w || 20) / 2, -(p.h || 30), (p.w || 20) / 2, 0]; const fy = tgt.fy == null ? null : tgt.fy;
          if (fy != null) { const y = p.y + b[1] + (b[3] - b[1]) * fy; return [p.x + b[0], y - 2, p.x + b[2], y + 2, 'prop:' + p.id]; } return [p.x + b[0], p.y + b[1], p.x + b[2], p.y + b[3], 'prop:' + p.id]; }
        if (tgt.ent) { const e = eval(tgt.ent); const t = __entTop(e) + 8; return [e.x - 14, t, e.x + 14, e.id === 'miles' || e.id === 'niko' ? t + 30 : e.y - 4, 'ent:' + e.id]; }
        if (tgt.self) return [marina.x - 12, marina.y + marina.offY - 70, marina.x + 12, marina.y + marina.offY - 6, 'self:'];
        if (tgt.pic) return [96, 50, 124, 70, 'pic:pic'];
        return null; }, tgt);
      if (box) { await g.page.waitForTimeout(500); const r = await g.page.evaluate(b => __pick(b[0], b[1], b[2], b[3], b[4]), box); centre = r.centre; pt = r.pt; hitName = pt ? box[4] : 'NO CANVAS POINT HITS ' + box[4]; if (pt) await g.tapWorld(pt[0], pt[1]); }
      if (tgt.fn) await g.page.evaluate(s => { eval(s); }, tgt.fn);
      try { await g.page.waitForSelector('#fx .act', { timeout: 5000 }); } catch (e) { }
      await g.page.waitForTimeout(700);
      const m = await g.page.evaluate(() => __measure());
      m.name = name; m.room = room; m.hit = hitName; m.centre = centre; m.icons = m.acts.map(a => a.t).join(' ');
      const shot = W + 'shots/' + view + TAG + '_' + name + '.png'; await g.shot(shot); m.shot = shot;
      out.push(m);
      console.log(name.padEnd(20), String(hitName).padEnd(18), 'centre=' + (centre ? centre.hit + (centre.dom ? '[DOM ' + centre.dom + ']' : '') : '-'), (m.icons || '(none)').padEnd(30), 'tray', !!m.tray, 'anchorCov', m.coverAnchorPct, 'marinaCov', m.coverMarinaPct, m.trayCoverAnchorPct != null ? 'trayCovAnchor ' + m.trayCoverAnchorPct : '', 'side', m.side, 'dist', m.dist, 'off', m.offscreen.join(''), 'edge', m.nearEdge.join(''), 'hud', m.hudHits.join(','));
      await g.page.evaluate(() => UI.closeActions());
    } catch (e) { console.log(name, 'ERR', e.message.split('\n')[0]); }
  }
  fs.writeFileSync(W + 'place_' + view + TAG + (filt ? '_part' : '') + '.json', JSON.stringify(out, null, 1));
  console.log(g.errors.join('\n'));
  await g.close();
})();
