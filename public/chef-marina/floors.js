// Chef Marina — floors. The house has a main floor plus others added by later files (basement, upstairs).
// This file is the shared plumbing: which room is on which floor, where she lands by the stairs, the little
// up/down stairs buttons under the map button, the room strip showing the floor she is on, and the map rows.
// Moving about on the main floor is untouched.
const Floors = (() => {
  const MAIN = ['yard', 'dining', 'kitchen', 'playroom', 'foyer', 'living', 'bathroom'];
  const list = [{ id: 'main', level: 0, rooms: MAIN }];
  const of = r => list.find(f => f.rooms.includes(r)) || list[0];
  const at = n => (n == null || isNaN(n) ? undefined : list.find(f => f.level === n));
  const hooks = [];
  let shown = null;
  // f = { id, level (+1 up / -1 down), rooms: [...], arrive: {room, x} (bottom/top of the stairs on that floor),
  //       back: {room, x} (where she comes out on the main floor), ico (picture for the stairs button) }
  function add(f) {
    list.push(f); shown = null;
    for (const r of f.rooms) { if (!ROOM_ORDER.includes(r)) ROOM_ORDER.push(r); const i = new Image(); i.src = 'assets/bg/' + r + '.png'; BG[r] = i; }
  }
  const landing = (from, to) => (to.id === 'main' ? from.back : to.arrive) || null;
  function go(dir) { if (typeof marina === 'undefined' || G.busy) return; const a = of(G.room), b = a.level == null ? null : at(a.level + dir); if (!b) return; const l = landing(a, b); if (!l) return; Audio2.blip(dir > 0 ? 12 : 4, 'triangle', 0.06, 0.12); travelTo(l.room); }

  // ---- travelling: same-floor trips on the main floor are exactly as before; anything else lands by the stairs or mid-room
  const _tt = travelTo;
  travelTo = function (r) {
    if (r === G.room || !ROOMS[r]) return; const a = of(G.room), b = of(r);
    if (a === b && a.id === 'main') return _tt(r);
    if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair(); if (marina.state === 'bars') { clearInterval(G.barIv); G.mb = null; }
    if (['perch', 'swing', 'bars', 'sit', 'anim'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; marina.anim = null; }
    marina.scale = 1;
    const l = a !== b ? landing(a, b) : null;
    changeRoom(r, null, l && l.room === r ? l.x : r === 'living' ? 300 : ROOMS[r].w / 2);
  };
  const _cr = changeRoom;
  changeRoom = function (room, from, x) {
    const was = G.room, res = _cr(room, from, x);
    if (was !== room) { const a = of(was), b = of(room);
      if (a !== b && a.level != null && b.level != null) Audio2.jingle(b.level > a.level ? [-3, 0, 2, 4, 5, 7, 9] : [9, 7, 5, 4, 2, 0, -3], 0.07, 'triangle');
      for (const h of hooks) { try { h(was, room); } catch (e) { console.warn('floor hook', e); } } }
    return res;
  };

  // ---- the strip of rooms at the top shows the floor she is on
  const bar = document.getElementById('roombar');
  function strip() {
    if (!bar || typeof marina === 'undefined') return; const f = of(G.room);
    if (shown === f.id) return; const first = shown === null; shown = f.id;
    if (first && f.id === 'main' && bar.querySelectorAll('.rb').length === MAIN.length) return;      // already built by the game
    bar.innerHTML = ''; bar.dataset.floor = f.id;
    for (const r of f.strip || f.rooms) { const b = document.createElement('button'); b.className = 'rb'; b.textContent = ROOMS[r].ico; b.dataset.r = r; b.setAttribute('aria-label', r);
      b.addEventListener('pointerup', e => { e.stopPropagation(); if (G.busy || r === G.room) return; Audio2.blip(9, 'triangle', 0.06, 0.12); travelTo(r); }); bar.append(b); }
  }
  // ---- two stairs buttons under the map button: up and down a floor
  const stage = document.getElementById('stage'), pill = document.createElement('div'); pill.id = 'floorpill';
  const mkBtn = (dir, label) => { const b = document.createElement('button'); b.className = 'fl ' + (dir > 0 ? 'up' : 'down'); b.setAttribute('aria-label', label);
    b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); go(dir); }); pill.append(b); return b; };
  const upB = mkBtn(1, 'upstairs'), downB = mkBtn(-1, 'downstairs'); stage.append(pill);
  function pillTick() {
    if (typeof marina === 'undefined') return; const a = of(G.room);
    for (const [b, dir] of [[upB, 1], [downB, -1]]) { const t = a.level == null ? null : at(a.level + dir); b.classList.toggle('off', !t); if (t) { const html = '<b>' + (dir > 0 ? '⬆️' : '⬇️') + '</b><i>' + ((t.id === 'main' ? '🏠' : t.ico) || '🪜') + '</i>'; if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; } } }
    pill.classList.toggle('off', !!G.tidy || !!G.chase || upB.classList.contains('off') && downB.classList.contains('off'));
  }
  setInterval(() => { strip(); pillTick(); }, 200);

  // ---- the picture map gets the other floors' rooms underneath
  if (typeof openIsoMap === 'function') { const _om = openIsoMap; openIsoMap = function () { _om(); const p = document.getElementById('panel'); if (p.querySelector('.fmap')) return;
    const box = document.createElement('div'); box.className = 'fmap';
    for (const f of list.filter(f => f.id !== 'main').sort((x, y) => (y.level == null ? -9 : y.level) - (x.level == null ? -9 : x.level))) { const g = document.createElement('div'); g.className = 'fmaprow'; const lab = document.createElement('div'); lab.className = 'fmaplab'; lab.textContent = f.level == null ? '🌳' : f.level > 0 ? '⬆️' : '⬇️'; g.append(lab);
      for (const r of f.rooms) { const b = document.createElement('button'); b.className = 'fmaproom' + (r === G.room ? ' here' : ''); b.innerHTML = '<b>' + ROOMS[r].ico + '</b>'; b.setAttribute('aria-label', r); if (bgFor(r)) b.style.backgroundImage = 'url(assets/bg/' + r + '.png)';
        b.addEventListener('pointerup', e => { e.stopPropagation(); p.classList.add('hidden'); travelTo(r); }); g.append(b); }
      box.append(g); }
    p.append(box); }; }

  const st = document.createElement('style'); st.textContent = `
#floorpill{position:absolute;left:10px;top:74px;z-index:5;display:flex;flex-direction:column;gap:4px;transition:opacity .2s}
#floorpill.off{opacity:0;pointer-events:none}
#floorpill .fl{position:relative;width:58px;height:46px;border-radius:16px;border:3px solid #fff;background:#ffe2b0;box-shadow:0 3px 0 rgba(0,0,0,.25);padding:0;font-size:24px;line-height:1;display:flex;align-items:center;justify-content:center;touch-action:manipulation}
#floorpill .fl.down{background:#e7d3bd}
#floorpill .fl.off{display:none}
#floorpill .fl b{font-weight:400}#floorpill .fl i{position:absolute;right:-5px;bottom:-5px;font-size:17px;font-style:normal;line-height:1}
#floorpill .fl:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.25)}
#roombar[data-floor]:not([data-floor=main]){background:rgba(92,70,48,.78)}
#stage.tvon #floorpill{opacity:0;pointer-events:none}
.fmap{display:flex;flex-direction:column;gap:6px;padding:6px 6px calc(env(safe-area-inset-bottom) + 6px);flex:none;align-items:center}
.fmaprow{display:flex;gap:8px;align-items:center;justify-content:center}
.fmaplab{font-size:24px;width:30px;text-align:center}
.fmaproom{position:relative;width:min(16vw,104px);aspect-ratio:16/10;border-radius:12px;border:4px solid #fff6dc;background:#6b5a48 center 70%/cover;image-rendering:pixelated;box-shadow:0 4px 0 rgba(0,0,0,.35);padding:0}
.fmaproom.here{border-color:#ffcf4a}.fmaproom b{position:absolute;left:-6px;top:-8px;width:30px;height:30px;border-radius:50%;background:#fff6dc;font-size:18px;display:flex;align-items:center;justify-content:center;font-weight:400}
@media (orientation:landscape){#floorpill .fl{height:44px}.fmap{flex-direction:row;justify-content:center;gap:14px}.fmaproom{width:min(8.5vw,76px)}.fmaplab{width:22px;font-size:20px}}`;
  document.head.append(st);
  return { list, of, at, add, go, hooks, MAIN, landing };
})();
