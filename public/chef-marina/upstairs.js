// Chef Marina — upstairs. Climb the stairs in the front hall, or ride Mommy's stairlift.
// Mommy & Daddy's room ↔ the landing (stairs, the spa bathroom door) ↔ Marina's room ↔ Miles' room.
// Everything here is additive, apart from the front-hall stairs, which now really go somewhere.
(function () {
  const UPR = ['parents', 'uphall', 'spa', 'mroom', 'milesroom'];
  Object.assign(ROOMS, {
    parents: { name: 'parents', ico: '👫', w: 480, upstairs: true, left: null, right: 'uphall', windows: [] },
    uphall: { name: 'uphall', ico: '💺', w: 304, upstairs: true, left: 'parents', right: 'mroom', windows: [] },
    spa: { name: 'spa', ico: '🛁', w: 288, upstairs: true, viewL: 'uphall', viewR: 'mroom', left: null, right: null, windows: [] },
    mroom: { name: 'mroom', ico: '👧', w: 368, upstairs: true, left: 'uphall', right: 'milesroom', windows: [] },
    milesroom: { name: 'milesroom', ico: '👶', w: 416, upstairs: true, left: 'mroom', right: null, windows: [] },
  });
  const isUp = r => !!(ROOMS[r] && ROOMS[r].upstairs);
  const TOP_X = 104;                                   // where she stands at the top of the stairs
  Floors.add({ id: 'up', level: 1, rooms: UPR, ico: '🛏️', arrive: { room: 'uphall', x: TOP_X }, back: { room: 'foyer', x: 236 } });
  Object.assign(FORT_SPOTS, { parents: 352, mroom: 292, milesroom: 300 });
  const S = { lift: 0 };                               // lift: 0 = chair at the bottom of the stairs, 1 = at the top

  // ---------------------------------------------------------------- what is in each room
  PROPS.uphall = [
    { id: 'ustairs', k: 'p:ustairs', x: 56, y: BACK, w: 104, h: 60, a: 'ustairs' },
    { id: 'spadoor', k: 'p:door', x: 176, y: BACK, w: 30, h: 92, a: 'door', to: 'spa', tx: 46 },
    { id: 'ucloset', k: 'p:ucloset', x: 228, y: BACK, w: 30, h: 92, nohit: true },
    { id: 'uwheel', k: 'wheelchair', x: 272, y: BACK + 12, a: 'uwheel' },
  ];
  PROPS.spa = [
    { id: 'spaback', k: 'p:door', x: 22, y: BACK, w: 30, h: 92, a: 'door', to: 'uphall', tx: 176 },
    { id: 'linen', k: 'u_linen', x: 68, y: BACK + 1, a: 'linen' },
    { id: 'uvanity', k: 'u_vanity', x: 122, y: BACK + 2, a: 'bathsink' },
    { id: 'bidet', k: 'toilet', x: 168, y: BACK + 2, a: 'bidet' },
    { id: 'tub', k: 'u_tub', x: 234, y: BACK + 8, a: 'spatub' },
  ];
  PROPS.parents = [
    { id: 'pknee', k: 'p:kneedoor', x: 28, y: BACK, w: 34, h: 40, a: 'kneedoor' },
    { id: 'pdresser', k: 'u_dresser6', x: 94, y: BACK + 3, a: 'dresser' },
    { id: 'ptotes', k: 'u_totes2', x: 156, y: BACK + 3, a: 'minifridge' },
    { id: 'bassinet', k: 'u_bassinet', x: 202, y: BACK + 5, a: 'bassinet' },
    { id: 'pbed', k: 'u_bigbed', x: 296, y: BACK + 9, a: 'bigbed', climb: 120 },
    { id: 'pbasket', k: 'u_basket', x: 384, y: BACK + 3, a: 'toybox' },
    { id: 'suitcase', k: 'u_suitcase', x: 416, y: BACK + 4, a: 'suitcase' },
    { id: 'pmirror', k: 'u_mirror', x: 452, y: BACK + 1, a: 'bigmirror' },
    { id: 'stuffpile', k: 'u_stuffies', x: 424, y: 175, z: 1, a: 'stuffpile' },
  ];
  PROPS.mroom = [
    { id: 'mcloset', k: 'u_costumes', x: 40, y: BACK, a: 'closet' },
    { id: 'mlamp', k: 'u_lamp', x: 92, y: BACK + 3, a: 'lamp' },
    { id: 'bunk', k: 'u_bunk', x: 178, y: BACK + 10, a: 'bunk' },
    { id: 'mbooks', k: 'u_books', x: 266, y: BACK + 8, a: 'books' },
    { id: 'mstack', k: 'u_bookstack', x: 300, y: BACK + 3, a: 'bookstack' },
    { id: 'mknee', k: 'p:kneedoor', x: 342, y: BACK, w: 34, h: 40, a: 'kneedoor' },
    { id: 'mhamper', k: 'u_hamper', x: 98, y: 175, z: 1, a: 'toybox' },
  ];
  PROPS.milesroom = [
    { id: 'ramp', k: 'u_ramp', x: 34, y: BACK + 2, a: 'ramp' },
    { id: 'airbed', k: 'u_airbed', x: 86, y: BACK + 2, a: 'airbed' },
    { id: 'bags', k: 'u_bags', x: 132, y: BACK + 6, nohit: true },
    { id: 'daybed', k: 'u_daybed', x: 224, y: BACK + 8, a: 'daybed', climb: 122 },
    { id: 'sharks', k: 'p:sharkpics', x: 304, y: BACK, w: 34, h: 40, a: 'sharks' },
    { id: 'mshelf', k: 'u_bookshelf_low', x: 346, y: BACK + 3, a: 'books' },
    { id: 'arch', k: 'u_arch', x: 380, y: 174, z: 1, a: 'arch' },
  ];
  const P = (room, id) => PROPS[room].find(p => p.id === id);

  // ---------------------------------------------------------------- rooms drawn by code (shown until the painted pictures load; also the sketch they were painted from)
  const C = { wall: '#e3dfd7', wall2: '#d9d5cc', trim: '#f8f7f3', shadow: 'rgba(40,30,20,.16)', carpet: '#c9bca6', carpet2: '#bbad95' };
  const poly = (pts, col) => { const c = E.ctx; c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(Math.round(p[0] - E.camX), p[1]) : c.moveTo(Math.round(p[0] - E.camX), p[1]))); c.closePath(); c.fill(); };
  function carpet(W, seed) { rect(0, WALL_Y, W, SH - WALL_Y, C.carpet); const r = srand(seed); for (let i = 0; i < W * 0.9; i++) rect(r() * W, WALL_Y + r() * (SH - WALL_Y), 2, 1, r() < 0.5 ? C.carpet2 : '#d6cab6'); }
  function win(x, y, w, h, cols, rows) { rect(x - 3, y - 3, w + 6, h + 6, C.trim); rect(x, y, w, h, '#9fcbe0'); rect(x, y + h * 0.6, w, h * 0.4, '#86b06f');
    for (let i = 1; i < cols; i++) rect(x + (w / cols) * i, y, 1, h, C.trim); for (let j = 1; j < rows; j++) rect(x, y + (h / rows) * j, w, 1, C.trim); rect(x, y + h / 2, w, 2, C.trim); rect(x - 4, y + h + 3, w + 8, 3, '#ebe9e2'); }
  function paint(room) {
    const W = ROOMS[room].w;
    rect(0, 0, W, WALL_Y, C.wall); rect(0, 0, W, 12, '#f5f4ef'); rect(0, 12, W, 1, C.shadow);
    if (room === 'parents') {
      poly([[0, 12], [150, 12], [0, 84]], '#f1efe9'); poly([[0, 84], [150, 12], [152, 12], [0, 86]], C.shadow);          // sloped ceiling on the left
      win(258, 40, 34, 56, 2, 4); win(338, 40, 34, 56, 2, 4);
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); carpet(W, 71);
    } else if (room === 'uphall') {
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); rect(0, WALL_Y, W, SH - WALL_Y, '#8b5a30'); const r = srand(72);
      for (let y = WALL_Y; y < SH; y += 6) { rect(0, y, W, 1, 'rgba(0,0,0,.2)'); for (let k = 0; k < W / 44; k++) rect(r() * W, y, 1, 6, 'rgba(0,0,0,.22)'); rect(r() * W, y + 3, 24 + r() * 30, 1, 'rgba(255,210,150,.14)'); }
      rect(118, 58, 22, 18, '#caa46a'); rect(120, 60, 18, 14, '#f3e7d2'); rect(125, 64, 3, 6, '#d98aa6'); rect(130, 63, 3, 7, '#6d8fd0');   // family picture
    } else if (room === 'spa') {
      rect(0, 84, W, WALL_Y - 84, '#8fc4b4'); rect(0, 82, W, 2, '#6b8f86'); for (let y = 84; y < WALL_Y; y += 14) { rect(0, y, W, 1, '#74a99a'); for (let x = ((y - 84) / 14 % 2) * 24; x < W; x += 48) rect(x, y, 1, 14, '#74a99a'); }
      for (let i = 0; i < 40; i++) { const r = srand(i * 7 + 3); rect(r() * W, 86 + r() * 50, 6 + r() * 10, 1, 'rgba(255,255,255,.18)'); }
      win(152, 28, 40, 46, 3, 4);
      rect(0, WALL_Y, W, SH - WALL_Y, '#d6c3a1'); for (let y = WALL_Y; y < SH; y += 13) rect(0, y, W, 1, '#bda883'); for (let y = WALL_Y; y < SH; y += 13) for (let x = ((y - WALL_Y) / 13 % 2) * 20; x < W; x += 40) rect(x, y, 1, 13, '#bda883');
      const r = srand(74); for (let i = 0; i < 60; i++) rect(r() * W, WALL_Y + r() * 40, 5 + r() * 12, 1, 'rgba(255,250,235,.3)');
    } else if (room === 'mroom') {
      poly([[W, 12], [W - 150, 12], [W, 84]], '#f1efe9'); poly([[W, 84], [W - 150, 12], [W - 152, 12], [W, 86]], C.shadow);  // sloped ceiling on the right
      win(150, 26, 28, 30, 2, 2); win(184, 26, 28, 30, 2, 2);
      rect(250, 116, 6, 6, '#ff8fd6'); rect(251, 115, 4, 8, '#ffb4e4');                                                   // heart night light
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); carpet(W, 75);
    } else {
      win(52, 38, 34, 56, 2, 4); win(286, 38, 34, 56, 2, 4);
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); carpet(W, 76);
    }
    if (ROOMS[room].left) rect(0, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.22)'); if (ROOMS[room].right) rect(W - 4, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.22)');
  }
  const _drb = drawRoomBG;
  drawRoomBG = function (room) { if (!isUp(room) || bgFor(room)) return _drb(room); const ctx = E.ctx; ctx.fillStyle = '#1d1830'; ctx.fillRect(-10, -40, E.viewW + 20, SH + 60); paint(room); };
  // pieces of the rooms drawn by code (baked into the painted picture once that exists)
  const MINE = { 'p:ustairs': 1, 'p:ucloset': 1, 'p:kneedoor': 1, 'p:sharkpics': 1 };
  function bits(p) {
    const x = p.x, y = p.y, w = p.w, h = p.h, L = x - w / 2, T = y - h;
    switch (p.k) {
      case 'p:ustairs': {     // the top of the stairs: an opening in the floor behind a wooden rail
        rect(L + 2, y - 22, w - 10, 22, '#3a2d24'); for (let i = 0; i < 4; i++) { rect(L + 2 + i * 12, y - 22 + i * 5, w - 10 - i * 12, 5, i % 2 ? '#b8ab97' : '#c9bca6'); rect(L + 2 + i * 12, y - 22 + i * 5, w - 10 - i * 12, 1, '#ddd2c0'); }
        rect(L + w - 8, T, 6, h, '#6b4526'); rect(L + w - 9, T - 4, 8, 5, '#7c5230');                                     // newel post
        rect(L, T + 6, w - 6, 4, '#7c5230'); for (let xx = L + 6; xx < L + w - 10; xx += 9) rect(xx, T + 10, 3, h - 10, '#f4f2ec');   // handrail and spindles
        rect(L, y - 3, w - 8, 3, '#7c5230'); break; }
      case 'p:ucloset': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#f1f0ea'); for (const [a, b, c, d] of [[4, 6, 9, 22], [17, 6, 9, 22], [4, 34, 9, 30], [17, 34, 9, 30], [4, 70, 9, 16], [17, 70, 9, 16]]) { rect(L + a, T + b, c, d, '#e4e2da'); rect(L + a + 1, T + b + 1, c - 2, d - 2, '#f6f5f0'); } rect(L + 4, T + 50, 4, 2, '#222'); break;
      case 'p:kneedoor': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#f0efe9'); for (let i = 1; i < 4; i++) rect(L + (w / 4) * i, T, 1, h, '#d9d7cf'); rect(L + w - 6, T + h / 2, 2, 5, '#cfcdc5'); break;
      case 'p:sharkpics': rect(L, T + 4, 13, 36, '#f4f6f8'); rect(L + 1, T + 5, 11, 34, '#dfeaf2'); for (let i = 0; i < 3; i++) { rect(L + 3, T + 9 + i * 10, 7, 3, '#5d86a8'); rect(L + 8, T + 7 + i * 10, 2, 3, '#5d86a8'); }
        rect(L + 16, T + 18, 18, 22, '#f4f6f8'); rect(L + 17, T + 19, 16, 20, '#9ec3dc'); rect(L + 20, T + 26, 10, 8, '#e9eef2'); rect(L + 22, T + 30, 6, 4, '#d0465a'); break;
    }
  }
  // ---------------------------------------------------------------- the stairs in the front hall, and Mommy's stairlift
  // points on the staircase picture: k = 0 at the bottom, 1 at the top
  const ST = { bx: 209, by: 133, tx: 196, ty: 76, lx0: 224, ly0: 136, lx1: 207, ly1: 86, s0: 0.86, s1: 0.56 };
  const stairP = k => ({ x: ST.bx + (ST.tx - ST.bx) * k, y: ST.by + (ST.ty - ST.by) * k, s: ST.s0 + (ST.s1 - ST.s0) * k });
  const liftP = k => ({ x: ST.lx0 + (ST.lx1 - ST.lx0) * k, y: ST.ly0 + (ST.ly1 - ST.ly0) * k, s: 1 - 0.18 * k });
  const run = (dur, step) => new Promise(res => { let t = 0; const iv = setInterval(() => { t += 0.033; step(Math.min(1, t / dur), t); if (t >= dur) { clearInterval(iv); res(); } }, 33); });
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const hum = (ms) => { const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - t0 > ms) return clearInterval(iv); Audio2.blip(-14 + Math.sin(performance.now() / 200) * 0.3, 'sawtooth', 0.14, 0.05); }, 110); return () => clearInterval(iv); };
  function standOnStairs(k, dir) { const p = stairP(k); marina.x = p.x; marina.y = 150; marina.offY = p.y - 150; marina.scale = p.s; marina.dir = dir; }
  function sitOnLift(k) { const p = liftP(k); marina.x = p.x - 1; marina.y = 150; marina.scale = 0.62 * p.s; marina.offY = p.y - 9 * p.s - 150; marina.state = 'sit'; marina.dir = -1; }
  const settle = () => { marina.scale = 1; marina.offY = 0; marina.y = FLOOR; marina.state = 'idle'; marina.anim = null; };
  const ready = () => { if (G.busy) return false; UI.closeActions(); if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair(); if (G.holding && G.holding.type === 'blower') G.holding = null; return true; };
  const got = ev => { try { window.did && did(ev); } catch (e) { } };
  async function climbUp() {
    if (!ready()) return;
    approach(ST.bx + 8, async () => { G.busy = true; marina.stop(); marina.state = 'run'; say('m_monkey');
      await run(2.3, (k, t) => { standOnStairs(k, -1); if (Math.floor(t * 5) !== Math.floor((t - 0.033) * 5)) Audio2.blip(Math.round(k * 12), 'triangle', 0.05, 0.1); });
      settle(); changeRoom('uphall', null, TOP_X); marina.dir = 1; marina.offY = -8; await run(0.25, k => { marina.offY = -8 * (1 - k); }); marina.offY = 0; G.busy = false; got('upstairs'); }, 0);
  }
  async function rideUp() {
    if (!ready()) return;
    approach(ST.lx0 + 14, async () => { G.busy = true; marina.stop(); let stop;
      if (S.lift > 0.5) { stop = hum(1500); await run(1.5, k => { S.lift = 1 - k; }); stop(); S.lift = 0; Audio2.blip(7, 'sine', 0.2, 0.15); await nap(200); }      // call the chair down
      sitOnLift(0); Audio2.jingle([0, 7], 0.08); say('m_ride'); await nap(600);
      stop = hum(3400); await run(3.4, k => { S.lift = k; sitOnLift(k); if (chance(0.2)) emit('sparkle', marina.x + rnd(-8, 8), 150 + marina.offY - rnd(0, 30), 1); }); stop(); S.lift = 1;
      Audio2.sfx('oven_ding', { vol: 0.6 }); settle(); changeRoom('uphall', null, HALL.cx + 2); marina.state = 'sit'; marina.offY = -12; marina.dir = 1; await nap(650);
      marina.state = 'idle'; await run(0.35, k => { marina.x = HALL.cx + 2 + (TOP_X - HALL.cx - 2) * k; marina.offY = -12 * (1 - k) - Math.sin(k * Math.PI) * 10; }); settle(); G.busy = false; marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1200); got('lift'); got('upstairs'); }, 0);
  }
  const HALL = { cx: 26, sx: 70 };                      // on the landing: where the chair parks, and the top step
  async function walkDown() {
    if (!ready()) return;
    approach(HALL.sx, async () => { G.busy = true; marina.stop(); await run(0.3, k => { marina.offY = 6 * k; });
      settle(); changeRoom('foyer', null, ST.tx); marina.state = 'run'; standOnStairs(1, 1);
      await run(2.0, (k, t) => { standOnStairs(1 - k, 1); if (Math.floor(t * 5) !== Math.floor((t - 0.033) * 5)) Audio2.blip(Math.round(12 - k * 12), 'triangle', 0.05, 0.1); });
      settle(); marina.x = ST.bx + 22; emit('dust', marina.x, FLOOR, 4); G.busy = false; }, 0);
  }
  async function rideDown() {
    if (!ready()) return;
    approach(HALL.cx + 34, async () => { G.busy = true; marina.stop(); let stop;
      if (S.lift < 0.5) { stop = hum(1300); await nap(1300); stop(); S.lift = 1; Audio2.blip(7, 'sine', 0.2, 0.15); await nap(200); }                              // call the chair up
      marina.x = HALL.cx + 2; marina.state = 'sit'; marina.offY = -12; marina.dir = 1; Audio2.jingle([7, 0], 0.08); say('m_ride'); await nap(700);
      settle(); changeRoom('foyer', null, ST.lx1); sitOnLift(1);
      stop = hum(3200); await run(3.2, k => { S.lift = 1 - k; sitOnLift(1 - k); if (chance(0.2)) emit('sparkle', marina.x + rnd(-8, 8), 150 + marina.offY - rnd(0, 30), 1); }); stop(); S.lift = 0;
      Audio2.sfx('oven_ding', { vol: 0.6 }); settle(); marina.x = ST.lx0 + 16; marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1200); G.busy = false; got('lift'); }, 0);
  }
  function drawChair(x, y, s) { if (has('u_liftchair')) return drawSprite('u_liftchair', x, y, { scale: s });
    rect(x - 7 * s, y - 30 * s, 14 * s, 18 * s, '#f1f0ea'); rect(x - 8 * s, y - 14 * s, 16 * s, 5 * s, '#e3e1d8'); rect(x - 3 * s, y - 9 * s, 6 * s, 9 * s, '#c9c7bf'); rect(x - 9 * s, y - 20 * s, 3 * s, 8 * s, '#8d8a82'); }

  // ---------------------------------------------------------------- drawing: live details on top of the rooms
  const _dp = drawProp;
  drawProp = function (p) {
    if (G.room === 'foyer' && p.id === 'stairs') {       // the staircase: rail, and the chair wherever it is
      const k0 = p.k; if (has('u_stairs')) p.k = 'u_stairs'; _dp(p); p.k = k0;
      const a = liftP(0), b = liftP(1), c = E.ctx; c.strokeStyle = '#a9a69d'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a.x + 5 - E.camX, a.y); c.lineTo(b.x + 4 - E.camX, b.y); c.stroke();
      const q = liftP(S.lift); drawChair(q.x, q.y, q.s); return;
    }
    if (!isUp(G.room)) return _dp(p);
    if (p.k.startsWith('p:')) { if (!MINE[p.k]) { _dp(p); return; } if (!bgFor(G.room)) bits(p); live(p); return; }
    if (p.id === 'uwheel' && marina.state === 'wheel') return;                                  // she is riding it
    if (p.id === 'airbed' && E.t < (S.airT || 0)) { drawSprite(has('u_airbed_flat') ? 'u_airbed_flat' : 'u_airbed', AIR.x, AIR.y + (S.airSquash ? 2 : 0), has('u_airbed_flat') ? { sy: S.airSquash ? 0.8 : 1 } : { rot: Math.PI / 2 }); return; }
    const ctx = E.ctx; let rot = 0, sx = 0;
    if (p.id === 'bassinet' && E.t < (S.rockT || 0)) rot = Math.sin(E.t * 3) * 0.07;
    if (S.shake && S.shake.id === p.id && E.t < S.shake.until) sx = Math.sin(E.t * 46) * 1.4;
    if (rot || sx) { ctx.save(); const cx = Math.round(p.x - E.camX); ctx.translate(cx + sx, p.y); ctx.rotate(rot); ctx.translate(-cx, -p.y); _dp(p); ctx.restore(); } else _dp(p);
    live(p);
  };
  function live(p) {
    if (p.id === 'ustairs' && S.lift > 0.5) drawChair(HALL.cx, BACK + 2, 1);
    if (p.id === 'bunk') minis(p);
    if (p.id === 'mstack' && S.books) for (let i = 0; i < S.books; i++) { const top = p.y - spriteSize(p.k)[1] - 3 - i * 4; rect(p.x - 8 + (i % 2) * 2 - (i % 3), top, 16, 4, ['#e86a8f', '#6aa7e8', '#f0c04a', '#7bd36b', '#b98ae8'][i % 5]); rect(p.x - 8 + (i % 2) * 2 - (i % 3), top, 16, 1, 'rgba(255,255,255,.5)'); }
    if (p.id === 'bassinet' && E.t < (S.rockT || 0) && chance(0.04)) emit('note', p.x + rnd(-10, 10), p.y - 50);
    if (p.id === 'sharks' && S.shark) { const k = (E.t - S.shark.t0) / 3.2; if (k > 1) S.shark = null; else emoji('🦈', E.camX + E.viewW * (1.1 - k * 1.2), 96 + Math.sin(k * 14) * 8, 34, 1, 0); }
    if (p.id === 'bidet' && E.t < (S.bidetT || 0)) { const c = E.ctx, x = Math.round(p.x - 6 - E.camX), h = 46 * Math.min(1, (S.bidetT - E.t) / 0.4, (E.t - S.bidet0) / 0.25); c.fillStyle = 'rgba(140,205,245,.85)'; c.fillRect(x - 1, p.y - 24 - h, 3, h); c.fillStyle = 'rgba(220,240,255,.9)'; c.fillRect(x - 4, p.y - 27 - h, 9, 4); if (chance(0.6)) emit('water', p.x - 6 + rnd(-8, 8), p.y - 24 - h); }
  }
  // the stuffies she arranged, drawn small on her bunk bed
  const BUNK = { top: 0.25, bottom: 0.74, rail: 0.08, x0: 0.09, x1: 0.71, ladder: 0.89 };      // fractions of the bunk picture (tuned to the sprite)
  function minis(p) {
    if (!window.Stuffies || !Stuffies.saved) return; let list; try { list = Stuffies.saved() || []; } catch (e) { return; } if (!list.length) return;
    const [w, h] = spriteSize(p.k); if (!w) return; const L = p.x - w / 2, T = p.y - h, d0 = E.depth; E.depth = 1;
    for (const s of list.slice(0, 24)) { const u = clamp(s.u == null ? 0.5 : s.u, 0, 1); let x = L + w * (BUNK.x0 + (BUNK.x1 - BUNK.x0) * u), y;
      if (s.level === 'top') y = T + h * BUNK.top; else if (s.level === 'rail') y = T + h * BUNK.rail; else if (s.level === 'ladder') { x = L + w * BUNK.ladder; y = T + h * (0.36 + 0.5 * u); } else if (s.level === 'floor') y = p.y + 4; else y = T + h * BUNK.bottom;
      y -= (s.stack || 0) * 7; emoji(s.ch, x, y - 4, 8); if ((s.asleep || E.t < (S.nightT || 0)) && chance(0.004)) emit('zzz', x, y - 10); }
    E.depth = d0;
  }
  // Marina hidden (peeking), her towel cape, and night time in her room
  const _dm = drawMarina;
  drawMarina = function (e) {
    if (S.hidden) { const p = S.hidden; emoji('👀', p.x, p.y - (p.h || spriteSize(p.k)[1] || 30) * 0.55 + Math.sin(E.t * 5) * 1.5, 10); return; }
    if (E.t < (S.capeT || 0)) { const c = E.ctx, y = e.y + e.offY, d = e.dir < 0 ? 1 : -1, f = Math.sin(E.t * 9) * 3 + (e.moving ? 7 : 0); poly([[e.x + d * 2, y - 46], [e.x + d * (16 + f), y - 14], [e.x + d * 3, y - 16]], S.capeCol || '#4f8fe8'); poly([[e.x + d * 2, y - 46], [e.x + d * (16 + f), y - 14], [e.x + d * (13 + f), y - 15]], 'rgba(255,255,255,.35)'); }
    _dm(e);
  };
  const _dx = drawExitSigns;
  drawExitSigns = function () {
    _dx(); if (!(E.t < (S.nightT || 0)) || G.room !== 'mroom') return;
    const k = clamp(Math.min(S.nightT - E.t, E.t - S.night0) / 0.8, 0, 1), c = E.ctx; c.fillStyle = 'rgba(14,12,52,' + (0.66 * k).toFixed(3) + ')'; c.fillRect(-10, -40, E.viewW + 20, SH + 60);
    emoji('🌙', E.camX + E.viewW - 38, 30, 18, k); const r = srand(5); for (let i = 0; i < 14; i++) emoji('✨', E.camX + r() * E.viewW, 14 + r() * 70, 5 + r() * 4, k * (0.4 + 0.6 * Math.abs(Math.sin(E.t * 2 + i))));
    const g = c.createRadialGradient(250 - E.camX, 118, 2, 250 - E.camX, 118, 46); g.addColorStop(0, 'rgba(255,140,220,' + (0.5 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,140,220,0)'); c.fillStyle = g; c.fillRect(200 - E.camX, 70, 100, 96);
  };

  // ---------------------------------------------------------------- things to do
  const cheer = (ms = 1500) => { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), ms); };
  const lock = ms => { G.busy = true; setTimeout(() => { G.busy = false; }, ms); };
  const near = (p, fn, gap) => approach(p.x, fn, gap == null ? 16 : gap);
  const fly = (x, y, list, n = 6, sp = 60) => { for (let i = 0; i < n; i++) setTimeout(() => emit('heart', x + rnd(-8, 8), y, 1, { ch: pick(list), vx: rnd(-sp, sp), vy: rnd(-sp * 1.4, -sp * 0.4), g: 160, life: 1.2, size: 11 }), i * 90); };
  function hideIn(p, ms, out) { G.busy = true; UI.closeActions(); Audio2.whoosh(true); S.hidden = p; emit('dust', p.x, p.y - 8, 5);
    setTimeout(() => { S.hidden = null; Audio2.jingle([0, 7, 12], 0.06); G.busy = false; let t = 0; const iv = setInterval(() => { t += 0.05; marina.offY = -Math.sin(Math.min(1, t / 0.5) * Math.PI) * 22; if (t >= 0.5) { clearInterval(iv); marina.offY = 0; } }, 40); out && out(); }, ms); }
  // spa bathroom
  function spa(p) { if (!window.Spa) return say('m_hmm'); near(p, () => { UI.closeActions(); Spa.open({ onDone: () => { cheer(1800); emit('sparkle', marina.x, marina.y - 40, 24); say('m_clean'); got('spa'); if (window.reactTo) reactTo('helper', 1800); } }); }, 40); }
  function flush(p) { near(p, () => { Audio2.sfx('flush'); say('m_flush'); for (let i = 0; i < 18; i++) setTimeout(() => emit('water', p.x + rnd(-6, 6), p.y - 20), i * 40); }, 24); }
  function bidet(p) { near(p, () => { lock(1900); marina.dir = Math.sign(p.x - marina.x) || 1; S.bidet0 = E.t + 0.5; setTimeout(() => { S.bidetT = E.t + 1.5; S.bidet0 = E.t; Audio2.sfx('sink', { rate: 1.6 }); Audio2.whoosh(true); UI.face('marina', 'surprised', 1500); say('m_wow'); let t = 0, x0 = marina.x; const iv = setInterval(() => { t += 0.05; marina.x = x0 - marina.dir * Math.min(1, t / 0.4) * 18; marina.offY = -Math.sin(Math.min(1, t / 0.4) * Math.PI) * 14; if (t >= 0.4) { clearInterval(iv); marina.offY = 0; } }, 40); }, 500); setTimeout(() => Audio2.voice('m_giggle', 'm'), 1700); }, 24); }
  function cape(p) { near(p, () => { playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.6 }); S.capeCol = pick(['#4f8fe8', '#e85a8a', '#f0b83c', '#6fcf6a', '#a070e8']); S.capeT = E.t + 22; Audio2.jingle([0, 4, 7, 12, 16], 0.06); emit('star', marina.x, marina.y - 70, 8); setTimeout(() => { say('m_cool'); cheer(1000); }, 500); got('cape'); }, 22); }
  // Mommy and Daddy's room
  function fridge(p) { near(p, () => { lock(2400); Audio2.sfx('cupboard'); emit('heart', p.x, p.y - spriteSize(p.k)[1], 1, { ch: '🧃', vx: 0, vy: -26, life: 1.2, size: 14 }); setTimeout(() => { playAnim('marina_eat', { fps: 7, proc: 'hug', dur: 1.4 }); Audio2.sfx('eat_chomp', { rate: 1.3, vol: 0.6 }); }, 700); setTimeout(() => say('m_yummy'), 1700); }, 22); }
  function rock(p) { near(p, () => { S.rockT = E.t + 7; say('m_shh_miles'); try { Audio2.melody('lullaby'); } catch (e) { } emit('heart', p.x, p.y - 50, 4); }, 26); }
  function suitcase(p) { near(p, () => { lock(1600); S.shake = { id: p.id, until: E.t + 0.6 }; Audio2.sfx('cupboard'); setTimeout(() => { fly(p.x, p.y - 30, ['👕', '🩳', '🧦', '👒', '🩴', '🕶️', '👗'], 8, 70); UI.bigIcon('🏖️', 900); Audio2.jingle([0, 4, 7, 12], 0.07);
      try { const slot = pick(['head', 'face']), its = lookItems(slot); if (its.length) { G.look[slot] = pick(its).id; if (slot === 'face') G.glasses = false; } } catch (e) { } emit('sparkle', marina.x, marina.y - 60, 14); say(pick(['m_look', 'm_pretty', 'm_cool'])); cheer(1200); }, 600); }, 22); }
  function sillyFaces(p) { near(p, () => { lock(2600); marina.dir = Math.sign(p.x - marina.x) || 1; const moods = ['happy', 'surprised', 'angry', 'sad', 'happy']; moods.forEach((m, i) => setTimeout(() => { UI.face('marina', m, 480, { shake: i % 2 === 1 }); Audio2.sfx('boing', { rate: 0.9 + i * 0.15, vol: 0.5 }); marina.squash = i % 2 ? 0.86 : 1.1; }, i * 480)); setTimeout(() => { marina.squash = 1; Audio2.voice('m_giggle', 'm'); emit('heart', marina.x, marina.y - 70, 4); }, 2500); }, 30); }
  function pretty(p) { near(p, () => { say('m_pretty'); emit('heart', marina.x, marina.y - 70, 4); cheer(1200); }, 30); }
  function dive(p) { near(p, () => { marina.x = p.x; hideIn(p, 2200, () => { fly(p.x, p.y - 16, ['🧸', '🐯', '🐰', '🐶', '🦄', '🐻'], 9, 80); emit('confetti', p.x, p.y - 30, 16); marina.x = p.x - 30; say(pick(['m_yay', 'm_giggle'])); cheer(1300); }); Audio2.sfx('thud', { vol: 0.5 }); }, 26); }
  function secret(p) { near(p, () => { marina.x = p.x; Audio2.sfx('door_open'); hideIn(p, 2000, () => { const find = pick([['🕷️', 'm_uhoh'], ['🧦', 'm_stinky'], ['🪙', 'm_found'], ['⭐', 'm_found'], ['🎁', 'm_found'], ['🕸️', 'm_ugh_niko'], ['🧸', 'm_yay'], ['🔦', 'm_cool']]);
      emit('heart', p.x, p.y - 30, 1, { ch: find[0], vx: 0, vy: -24, life: 1.8, size: 18 }); emit('dust', p.x, p.y - 10, 8); marina.x = p.x + (p.x > ROOMS[G.room].w / 2 ? -28 : 28); say(find[1]); if (/found|yay|cool/.test(find[1])) { emit('sparkle', p.x, p.y - 30, 14); cheer(1200); } }); }, 0); }
  // Marina's room
  function stuffies(p) { if (!window.Stuffies) return say('m_hmm'); near(p, () => { UI.closeActions(); Stuffies.open({ onDone: r => { if (r && r.count) { cheer(1500); emit('heart', p.x, p.y - 70, 8); say(pick(['m_look', 'm_did_it'])); got('stuffies'); } } }); }, 44); }
  function topBunk(p) { const [w, h] = spriteSize(p.k); climbOn({ ...p, x: p.x - 8, climb: p.y - h * (1 - BUNK.top) - 2 }); }
  function sleep(p) { const [w, h] = spriteSize(p.k); const lx = p.x + w * (BUNK.ladder - 0.5), topY = p.y - h * (1 - BUNK.top) - 2;
    approach(lx, async () => { G.busy = true; UI.closeActions(); marina.stop(); marina.x = lx; marina.state = 'run'; say('m_nite');
      await run(1.1, (k, t) => { marina.offY = (topY - FLOOR) * k; if (Math.floor(t * 6) !== Math.floor((t - 0.033) * 6)) Audio2.blip(Math.round(k * 9), 'triangle', 0.05, 0.1); });
      marina.x = p.x - 10; marina.state = 'sit'; marina.dir = 1; S.night0 = E.t; S.nightT = E.t + 7.5; try { Audio2.Music.set('night'); Audio2.melody('lullaby'); } catch (e) { }
      const iv = setInterval(() => { if (E.t > S.nightT - 1) return clearInterval(iv); emit('zzz', marina.x + 8, FLOOR + marina.offY - 44); }, 800);
      await nap(7400); Audio2.jingle([0, 4, 7, 12, 16, 19], 0.09, 'triangle'); emit('heart', marina.x, FLOOR + marina.offY - 50, 1, { ch: '☀️', vx: 0, vy: -14, life: 1.8, size: 18 }); for (let i = 0; i < 3; i++) setTimeout(() => Audio2.blip(pick([19, 21, 24]), 'sine', 0.08, 0.1), 200 + i * 220);
      marina.state = 'cheer'; await nap(900); const y0 = marina.offY, x0 = marina.x; await run(0.5, k => { marina.x = x0 + (p.x + w / 2 + 14 - x0) * k; marina.offY = y0 * (1 - k) - Math.sin(k * Math.PI) * 16; });
      settle(); emit('dust', marina.x, FLOOR, 5); G.busy = false; setMusic(); cheer(1200); say('m_yay'); got('sleep'); }, 0); }
  function stackBook(p) { near(p, () => { S.books = (S.books || 0) + 1; Audio2.blip(S.books * 2, 'triangle', 0.1, 0.16); playAnim('marina_reach', { fps: 12, proc: 'hug', dur: 0.4 });
    if (S.books >= 7) { lock(1000); S.shake = { id: p.id, until: E.t + 0.5 }; setTimeout(() => { S.books = 0; Audio2.sfx('thud', { vol: 0.7 }); emit('dust', p.x, p.y - 10, 10); fly(p.x, p.y - 60, ['📕', '📗', '📘', '📙', '📒'], 7, 70); say(pick(['m_uhoh', 'm_giggle'])); }, 500); } }, 22); }
  // Miles' room
  function rampPlay(p) { const [w, h] = spriteSize(p.k); approach(p.x + w / 2 + 6, async () => { G.busy = true; UI.closeActions(); marina.stop(); const x0 = p.x + w / 2 - 2, x1 = p.x - w / 2 + 8, top = -(h - 14); marina.state = 'run'; marina.dir = -1; say('m_monkey');
      await run(1.5, (k, t) => { marina.x = x0 + (x1 - x0) * k; marina.offY = top * k; if (Math.floor(t * 5) !== Math.floor((t - 0.033) * 5)) Audio2.blip(Math.round(k * 10), 'triangle', 0.05, 0.1); });
      marina.state = 'cheer'; marina.dir = 1; Audio2.jingle([0, 4, 7, 12], 0.06); emit('star', marina.x, FLOOR + marina.offY - 60, 6); await nap(800);
      marina.state = 'sit'; Audio2.whoosh(false); await run(0.55, k => { const e = k * k; marina.x = x1 + (x0 + 20 - x1) * e; marina.offY = top * (1 - e); if (chance(0.5)) emit('dust', marina.x - 6, FLOOR + marina.offY, 1); });
      settle(); emit('dust', marina.x, FLOOR, 8); Audio2.sfx('thud', { vol: 0.5 }); G.busy = false; cheer(1100); say(pick(['m_yay', 'm_again'])); got('slide'); if (window.reactTo) reactTo('brave', 1200); }, 0); }
  const AIR = { x: 104, y: 172 };
  function airbed(p) { const flat = E.t < (S.airT || 0);
    approach(AIR.x, async () => { G.busy = true; UI.closeActions(); marina.stop();
      if (!flat) { marina.x = AIR.x + 62; marina.dir = -1; playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.5 }); await nap(450); S.airT = E.t + 40; Audio2.sfx('thud'); Audio2.whoosh(false); emit('dust', AIR.x - 30, FLOOR, 8); emit('dust', AIR.x + 30, FLOOR, 8); await nap(350); }
      S.airT = E.t + 40; marina.x = AIR.x; marina.state = 'cheer'; say('m_bounce'); const flips = ['marina_frontflip', 'marina_backflip', 'marina_starjump'];
      for (let i = 0; i < 5; i++) { const big = i >= 2; S.airSquash = true; Audio2.sfx('boing', { rate: 0.85 + i * 0.08, vol: 0.7 }); emit('dust', AIR.x, FLOOR, 3); await nap(70); S.airSquash = false;
        if (big && frameCount(flips[i % 3])) playAnim(flips[i % 3], { fps: 14, proc: 'frontflip', dur: 0.72 }); else marina.state = 'cheer';
        await run(0.72, k => { marina.offY = -Math.sin(k * Math.PI) * (big ? 58 : 34) - 6; }); if (big) emit('star', marina.x, FLOOR - 70, 3); }
      settle(); marina.x = AIR.x + 60; emit('confetti', AIR.x, FLOOR - 50, 20); Audio2.jingle([0, 4, 7, 12, 16], 0.07); G.busy = false; cheer(1200); say(pick(['m_yay', 'm_again'])); got('trampoline'); if (window.reactTo) reactTo('strong', 1200); }, 0); }
  function sharks(p) { near(p, () => { lock(3300); S.shark = { t0: E.t }; say('m_roar'); for (let i = 0; i < 12; i++) setTimeout(() => Audio2.blip(i % 2 ? -11 : -12, 'sawtooth', 0.16, 0.16 + i * 0.012), i * (260 - i * 14)); setTimeout(() => { Audio2.sfx('eat_chomp', { vol: 0.8 }); UI.face('marina', 'surprised', 1200, { shake: true }); cheer(1000); }, 2500); }, 36); }
  function archOver(p) { const [w, h] = spriteSize(p.k); approach(p.x - w / 2 - 6, async () => { G.busy = true; UI.closeActions(); marina.stop(); const x0 = p.x - w / 2 - 2, x1 = p.x + w / 2 + 2; marina.state = 'run'; marina.dir = 1;
      await run(1.7, (k, t) => { marina.x = x0 + (x1 - x0) * k; marina.offY = -Math.sin(k * Math.PI) * (h - 6); if (Math.floor(t * 5) !== Math.floor((t - 0.033) * 5)) Audio2.blip(Math.round(Math.sin(k * Math.PI) * 9), 'triangle', 0.05, 0.1); if (Math.abs(k - 0.5) < 0.02) emit('star', marina.x, FLOOR + marina.offY - 60, 5); });
      settle(); emit('dust', marina.x, FLOOR, 5); G.busy = false; cheer(1000); say(pick(['m_did_it', 'm_yay'])); got('slide'); }, 0); }
  function archUnder(p) { near(p, () => { marina.x = p.x; hideIn(p, 1700, () => { marina.x = p.x + (marina.dir || 1) * 40; say('m_giggle'); cheer(900); }); }, 34); }
  function wheelRide(p) { near(p, () => { marina.state = 'wheel'; marina.x = p.x; say('m_ride'); Audio2.whoosh(true); got('wheel'); }, 0); }

  const _pa = propActions;
  propActions = function (p) {
    switch (p.a) {
      case 'stairs': return [A('🪜', climbUp), A('💺', rideUp)];
      case 'ustairs': return [A('🪜', walkDown), A('💺', rideDown)];
      case 'uwheel': return [A('🦽', () => wheelRide(p))];
      case 'spatub': return [A('🛁', () => spa(p))];
      case 'bidet': { const a = [A('🚽', () => flush(p)), A('💦', () => bidet(p))]; if (G.holding && G.holding.type === 'poop') a.unshift(A('💩', () => near(p, () => { G.holding = null; Audio2.sfx('flush'); setTimeout(() => say('m_bye'), 900); got('poop'); }, 24))); return a; }
      case 'linen': return [A('🦸', () => cape(p))];
      case 'bigbed': case 'daybed': { const a = [A('🦘', () => bounceOn(p)), A('🪑', () => sitDown(p))]; if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); return a; }
      case 'minifridge': return [A('🧃', () => fridge(p))];
      case 'bassinet': return [A('🎵', () => rock(p))];
      case 'suitcase': return [A('🧳', () => suitcase(p))];
      case 'bigmirror': return [A('🪞', () => pretty(p)), A('😜', () => sillyFaces(p))];
      case 'stuffpile': return [A('🤿', () => dive(p))];
      case 'kneedoor': return [A('🔦', () => secret(p))];
      case 'bunk': { const a = [A('🧸', () => stuffies(p)), A('😴', () => sleep(p)), A('🪜', () => topBunk(p))]; if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); return a; }
      case 'bookstack': return [A('📚', () => stackBook(p))];
      case 'ramp': return [A('🧗', () => rampPlay(p))];
      case 'airbed': return [A('🤸', () => airbed(p))];
      case 'sharks': return [A('🦈', () => sharks(p))];
      case 'arch': return [A('🧗', () => archOver(p)), A('🙈', () => archUnder(p))];
    }
    return _pa(p);
  };
  // leaving a room tidies up anything half-done; a grown-up sometimes comes up to see what she is doing
  Floors.hooks.push((was, room) => { S.hidden = null; S.shark = null; if (marina.scale !== 1 && !G.busy) marina.scale = 1; });
  let visitT = 0;
  setInterval(() => {
    if (typeof marina === 'undefined' || !isUp(G.room) || G.room === 'spa' || G.busy || G.sceneOn || !document.getElementById('panel').classList.contains('hidden')) { visitT = 0; return; }
    if (++visitT < 12 || [daddy, mommy, rory].some(e => e.here && !e.hidden)) return; visitT = 0; if (!chance(0.5)) return;
    const e = pick([daddy, mommy].filter(x => x !== G.bathWho && !AI.held.has(x) && x.state !== 'toilet')); if (!e) return; const W = ROOMS[G.room].w, fromL = marina.x > W / 2;
    e.hidden = false; e.room = G.room; e.state = 'idle'; e.holdingMiles = false; e.x = fromL ? 8 : W - 8; e.y = FLOOR; e.walkTo(clamp(marina.x + (fromL ? -44 : 44), 20, W - 20), () => { e.dir = Math.sign(marina.x - e.x) || 1; try { onEnterRoomBy(e); } catch (x) { } });
  }, 1000);

  window.Upstairs = { rooms: UPR, isUp, S, paint, bits, ST, HALL, BUNK, AIR };
})();
