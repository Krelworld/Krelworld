// Chef Marina — more outdoors: the pool beside the front yard, and the big backyard behind the house
// (out through the basement's Dutch door, or round the side from the front yard).
// The backyard is where Grandpa Jeff has his workshop, where the deer run through and where the climbing trees are.
(function () {
  const OUT = ['pool', 'yard', 'backyard'];
  Object.assign(ROOMS, {
    pool: { name: 'pool', ico: '🏊', w: 480, outside: true, garden: true, left: null, right: 'yard', windows: [] },
    backyard: { name: 'backyard', ico: '🦌', w: 1040, outside: true, garden: true, left: 'yard', right: null, windows: [] },
  });
  ROOMS.yard.left = 'pool'; ROOMS.yard.right = 'backyard';
  // an "outside" group so the room strip shows the three outdoor places when she is in the pool area or backyard
  Floors.add({ id: 'out', level: null, rooms: ['pool', 'backyard'], strip: OUT });
  // Where things are in the backyard (shared with the builder, the deer and the tree-climbing files).
  const BY = { W: 1040, door: 92, bench: 232,
    plots: [{ id: 'p1', x: 348 }, { id: 'p2', x: 458 }, { id: 'p3', x: 568 }, { id: 'p4', x: 678 }, { id: 'p5', x: 872 }],      // ground spots Grandpa Jeff can build on (each about 100 wide)
    trees: [{ id: 'oak', x: 772, houseY: 62, trunk: 34 }, { id: 'pine', x: 978, houseY: 54, trunk: 26 }] };                   // the big climbable trees; houseY = floor of a tree house up in it
  const PL = { W: 480, x0: 110, x1: 410, gate: 456 };       // the pool: water between x0 and x1
  window.Backyard = BY; window.PoolRoom = PL;

  PROPS.backyard = [
    { id: 'bkdoor', k: 'p:bkdoor', x: BY.door, y: BACK, w: 30, h: 78, a: 'door', to: 'den', tx: 474 },
    { id: 'oak', k: 'p:bigtree', x: 772, y: BACK + 6, w: 44, h: 150, a: 'bigtree', tree: 'oak' },
    { id: 'pine', k: 'p:bigtree', x: 978, y: BACK + 6, w: 36, h: 150, a: 'bigtree', tree: 'pine' },
  ];
  PROPS.pool = [
    { id: 'water', k: 'p:pool', x: (PL.x0 + PL.x1) / 2, y: 147, w: PL.x1 - PL.x0, h: 24, a: 'pool' },
  ];
  // the basement's Dutch door now really leads outside
  const dutch = (PROPS.den || []).find(p => p.id === 'dutch'); if (dutch) { dutch.a = 'door'; dutch.to = 'backyard'; dutch.tx = BY.door + 4; }

  // ---------------------------------------------------------------- placeholder pictures drawn by code (used until the painted ones load; also the sketch they are painted from)
  function sky(W) { const c = E.ctx, g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#6db3ee'); g.addColorStop(1, '#cfe7fb'); c.fillStyle = g; c.fillRect(-E.camX, 0, W, 130); }
  function woods(W, seed, y0) { const r = srand(seed); for (let x = -10; x < W + 20; x += 22) { const h = 50 + r() * 40, col = ['#c8742a', '#d99a2e', '#a8502a', '#7f9a4a', '#e0b23c'][Math.floor(r() * 5)]; rect(x + 8, y0 - h * 0.3, 5, h * 0.4, '#5b4030'); E.ctx.fillStyle = col; E.ctx.beginPath(); E.ctx.arc(Math.round(x + 10 - E.camX), y0 - h * 0.55, 16 + r() * 10, 0, 7); E.ctx.fill(); } }
  function grass(W, seed) { rect(0, 128, W, SH - 128, '#86ad55'); const r = srand(seed); for (let i = 0; i < W; i++) rect(r() * W, 130 + r() * 50, 2, 1, r() < 0.5 ? '#789f4a' : '#9bbf63'); for (let i = 0; i < W / 6; i++) rect(r() * W, 134 + r() * 44, 3, 2, ['#c8742a', '#d99a2e', '#a8502a'][Math.floor(r() * 3)]); }
  function paint(room) {
    const W = ROOMS[room].w; sky(W);
    if (room === 'backyard') {
      { const r = srand(80), c = E.ctx; for (let x = -20; x < W + 30; x += 24) { const top = 8 + r() * 34; rect(x + 9, top + 20, 5, 112 - top, '#4a3a2c'); c.fillStyle = ['#4f7a3e', '#5d8a45', '#3f6b3a', '#b98a2e', '#6f9448', '#a8642a'][Math.floor(r() * 6)]; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(Math.round(x + 12 + (k - 1) * 9 - E.camX), top + 14 + k * 16 + r() * 8, 20 + r() * 8, 0, 7); c.fill(); } } }      // the tall woods all round
      woods(W, 81, 132); grass(W, 82);
      E.ctx.fillStyle = '#8a6a4a'; E.ctx.fillRect(Math.round(-E.camX), 0, 158, 22); rect(0, 20, 150, 112, '#c9c2a4'); for (let y = 24; y < 132; y += 6) rect(0, y, 150, 1, '#b3ab8c'); rect(146, 20, 5, 112, '#f4f2ea'); rect(0, 124, 150, 8, '#9a988f');             // the shingled back of the house
      rect(60, 52, 74, 8, '#8a6a4a'); rect(56, 58, 82, 4, '#f4f2ea'); rect(66, 62, 4, 70, '#f4f2ea'); rect(124, 62, 4, 70, '#f4f2ea'); rect(60, 132, 76, 6, '#a9a59a');                 // little porch roof on two posts
      rect(18, 60, 26, 34, '#f4f2ea'); rect(21, 63, 20, 28, '#3d4a57');                                                                                                                  // a window
      for (const t of BY.trees) { const big = t.id === 'oak'; rect(t.x - t.trunk / 2, 0, t.trunk, 150, big ? '#6b4a32' : '#5c4030'); rect(t.x - t.trunk / 2, 0, 4, 150, 'rgba(255,255,255,.12)');
        const c = E.ctx; c.fillStyle = big ? '#c9762c' : '#3f6b3a'; for (const [dx, dy, rr] of big ? [[-50, 20, 44], [40, 10, 50], [0, -6, 46], [-80, 50, 26], [78, 46, 28]] : [[0, 6, 34], [-26, 34, 24], [26, 40, 24]]) { c.beginPath(); c.arc(Math.round(t.x + dx - E.camX), dy, rr, 0, 7); c.fill(); }
        rect(t.x - t.trunk / 2 - 8, 146, t.trunk + 16, 6, big ? '#5a3d28' : '#4a3324'); }
      rect(104, 112, 22, 20, '#3a3f45'); rect(106, 114, 18, 3, '#565c63');                                                                                                               // the air conditioner by the step
      for (const [fx, fy, fw] of [[132, 150, 16], [154, 156, 14], [176, 151, 15], [198, 158, 13], [150, 166, 12]]) { rect(fx, fy, fw, 5, '#b9b6ad'); rect(fx, fy, fw, 1, '#d6d3ca'); }                // flagstones leading onto the lawn
      for (const t of BY.trees) { for (let i = 0; i < 5; i++) { const y = 20 + i * 24, sd = i % 2 ? 1 : -1; rect(t.x + (sd > 0 ? t.trunk / 2 : -t.trunk / 2 - (t.id === 'oak' ? 30 : 12)), y, t.id === 'oak' ? 30 : 12, t.id === 'oak' ? 6 : 3, t.id === 'oak' ? '#6b4a32' : '#5c4030'); } }   // branches
    } else {
      { const r = srand(90), c = E.ctx; for (let x = -20; x < W + 30; x += 24) { const top = 4 + r() * 26; rect(x + 9, top + 20, 5, 100 - top, '#3f3226'); c.fillStyle = ['#3f7a3a', '#4f8a45', '#356b34', '#5d9448', '#2f5f30'][Math.floor(r() * 5)]; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(Math.round(x + 12 + (k - 1) * 9 - E.camX), top + 14 + k * 16 + r() * 8, 20 + r() * 8, 0, 7); c.fill(); } } }
      grass(W, 92);
      rect(0, 96, W, 6, '#4a3626'); for (let x = 2; x < W; x += 7) rect(x, 84, 4, 32, '#5a4230');                                                                                       // dark picket fence
      rect(300, 44, 150, 62, '#c9c2a4'); E.ctx.fillStyle = '#8a6a4a'; E.ctx.beginPath(); E.ctx.moveTo(292 - E.camX, 46); E.ctx.lineTo(375 - E.camX, 10); E.ctx.lineTo(458 - E.camX, 46); E.ctx.fill(); rect(352, 56, 16, 20, '#3d4a57'); rect(388, 56, 16, 20, '#3d4a57');   // the house beyond the fence
      rect(0, 116, W, SH - 116, '#a9adb3'); for (let y = 116; y < SH; y += 12) rect(0, y, W, 1, '#8f949b'); for (let y = 116; y < SH; y += 12) for (let x = ((y - 116) / 12 % 2) * 22; x < W; x += 44) rect(x, y, 1, 12, '#8f949b');      // stamped-stone deck
      rect(PL.x0 - 6, 120, PL.x1 - PL.x0 + 12, 30, '#d9dde2'); rect(PL.x0, 123, PL.x1 - PL.x0, 24, '#2fa7b5'); rect(PL.x0, 123, PL.x1 - PL.x0, 3, '#7fd3dc');                             // the pool, seen across the deck she walks on
      rect(PL.x1 - 26, 108, 3, 18, '#cfd4d9'); rect(PL.x1 - 14, 108, 3, 18, '#cfd4d9'); rect(PL.x1 - 26, 108, 15, 3, '#cfd4d9');                                                          // ladder rail
    }
  }
  const mine = r => r === 'backyard' || r === 'pool';
  const _drb = drawRoomBG;
  drawRoomBG = function (room) { if (!mine(room) || bgFor(room)) return _drb(room); const ctx = E.ctx; ctx.fillStyle = '#9fd0f2'; ctx.fillRect(-10, -40, E.viewW + 20, SH + 60); paint(room); };
  const _dp = drawProp;
  drawProp = function (p) {
    if (!mine(G.room) || !p.k.startsWith('p:')) return _dp(p);
    if (p.k === 'p:bkdoor') { if (!bgFor(G.room)) { const L = p.x - p.w / 2, T = p.y - p.h; rect(L - 3, T - 3, p.w + 6, p.h + 3, '#fbfbf8'); rect(L, T, p.w, p.h, '#f1f0ea'); rect(L + 4, T + 5, p.w - 8, 30, '#27303a'); rect(L + p.w - 6, T + 42, 3, 3, '#222'); } drawDoorState(p); return; }
    if (p.k === 'p:pool') { const c = E.ctx; for (let i = 0; i < 6; i++) { const x = PL.x0 + 20 + ((i * 53 + E.t * 14) % (PL.x1 - PL.x0 - 40)); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(Math.round(x - E.camX), 128 + (i % 3) * 6 + Math.round(Math.sin(E.t * 2 + i) * 1.5), 14, 1); } }
  };
  // outdoor music, like the front yard
  const _sm = setMusic; setMusic = function () { _sm(); if (mine(G.room) && Audio2.Music.mode === 'explore') Audio2.Music.set('yard'); };

  const _pa = propActions;
  propActions = function (p) {
    if (p.a === 'pool') return [A('🏊', () => { if (!window.Pool) return say('m_hmm'); approach(p.x, () => { UI.closeActions(); Pool.open({ onDone: () => { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1400); say('m_yay'); try { did('swim'); } catch (e) { } } }); }, 60); })];
    if (p.a === 'bigtree') return [A('🧗', () => { if (!window.TreeClimb) return say('m_hmm'); approach(p.x, () => { UI.closeActions(); TreeClimb.open({ tree: p.tree, onDone: r => { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1400); if (r && r.top) { say('m_did_it'); try { did('treetop'); } catch (e) { } if (window.reactTo) reactTo('brave', 1500); } } }); }, 20); })];
    return _pa(p);
  };
  window.Outdoor = { rooms: ['pool', 'backyard'], paint };
})();
