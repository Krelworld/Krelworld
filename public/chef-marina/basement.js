// Chef Marina — the basement, where Nunu lives. Down the stairs from the front hall:
// Nunu's bedroom ↔ Nunu's living room (the stairs arrive here) ↔ the storage room ↔ the laundry room.
// Everything here is additive: no upstairs room, object or choice is changed.
(function () {
  const B = { nunuroom: 320, den: 608, storage: 320, laundry: 288 };
  Object.assign(ROOMS, {
    nunuroom: { name: 'nunuroom', ico: '🛏️', w: B.nunuroom, basement: true, left: null, right: 'den', windows: [] },
    den: { name: 'den', ico: '🛋️', w: B.den, basement: true, left: 'nunuroom', right: 'storage', windows: [] },
    storage: { name: 'storage', ico: '📦', w: B.storage, basement: true, left: 'den', right: 'laundry', windows: [] },
    laundry: { name: 'laundry', ico: '🧺', w: B.laundry, basement: true, left: 'storage', right: null, windows: [] },
  });
  const DOWN = ['nunuroom', 'den', 'storage', 'laundry'];
  const isDown = r => !!(ROOMS[r] && ROOMS[r].basement);
  const STAIR_X = 104, DOOR_X = 100;      // where she stands at the bottom of the stairs / by the door upstairs
  Floors.add({ id: 'down', level: -1, rooms: DOWN, ico: '🛋️', arrive: { room: 'den', x: STAIR_X }, back: { room: 'foyer', x: DOOR_X + 4 } });
  Object.assign(FORT_SPOTS, { den: 236, storage: 150, nunuroom: 190 });

  // ---------------------------------------------------------------- what is in each room
  // k = sprite key or 'p:<drawn by code>'; x centre, y bottom; a = what kind of thing it is
  PROPS.foyer.splice(2, 0, { id: 'basedoor', k: 'p:bdoorway', x: DOOR_X, y: BACK, w: 28, h: 92, a: 'door', to: 'den', tx: STAIR_X });
  PROPS.den = [
    { id: 'bstairs', k: 'p:bstairs', x: 52, y: BACK, w: 88, h: 124, a: 'door', to: 'foyer', tx: DOOR_X },
    { id: 'ledge', k: 'p:ledge', x: 150, y: 96, w: 84, h: 26, nohit: true },
    { id: 'bstool', k: 'b_stool', x: 128, y: BACK + 2, a: 'stool', climb: 112 },
    { id: 'candle', k: 'b_candlelamp', x: 166, y: BACK + 1, a: 'lamp' },
    { id: 'wicker', k: 'b_wickerchair', x: 200, y: BACK + 4, a: 'chair', climb: 122 },
    { id: 'barm', k: 'b_armchair', x: 254, y: BACK + 6, a: 'armchair', climb: 118 },
    { id: 'ottoman', k: 'b_ottoman', x: 304, y: BACK + 12, a: 'ottoman', climb: 132 },
    { id: 'tuxcat', k: 'b_tuxcat', x: 304, y: BACK + 12 - 24, a: 'tuxcat' },
    { id: 'tripod', k: 'b_tripodlamp', x: 340, y: BACK + 1, a: 'lamp' },
    { id: 'bsofa', k: 'b_sectional', x: 400, y: BACK + 8, a: 'sofa', climb: 118 },
    { id: 'dutch', k: 'p:dutch', x: 474, y: BACK, w: 30, h: 92, a: 'dutch' },
    { id: 'ltable', k: 'b_coffeetable', x: 448, y: 172, z: 1, a: 'legotable' },
    { id: 'tvdresser', k: 'b_tvdresser', x: 532, y: BACK + 4, nohit: true },
    { id: 'btv', k: 'p:btv', x: 532, y: BACK + 4 - 44, w: 46, h: 30, a: 'btv' },
    { id: 'bfire', k: 'p:bfire', x: 586, y: BACK, w: 44, h: 126, a: 'bfire' },
    { id: 'stones', k: 'b_stonebasket', x: 572, y: BACK + 12, a: 'stones' },
  ];
  PROPS.storage = [
    { id: 'shades', k: 'b_lampshades', x: 22, y: BACK + 2, a: 'shades' },
    { id: 'totes', k: 'b_totes', x: 64, y: BACK + 3, a: 'toybox' },
    { id: 'boxes', k: 'b_boxes', x: 118, y: BACK + 3, a: 'boxes' },
    { id: 'toykitchen', k: 'b_toykitchen', x: 180, y: BACK + 3, a: 'toykitchen' },
    { id: 'hoop', k: 'b_wirebasket', x: 228, y: BACK + 4, a: 'hoop' },
    { id: 'fan', k: 'b_fan', x: 262, y: BACK + 3, a: 'fan' },
    { id: 'tiles', k: 'b_tilesboxes', x: 296, y: BACK + 8, a: 'tiles' },
    { id: 'bigbox', k: 'b_bigbox', x: 140, y: 174, z: 1, a: 'bigbox' },
    { id: 'bball', k: 'b_basketball', x: 196, y: 174, z: 1, a: 'bball' },
  ];
  PROPS.laundry = [
    { id: 'usink', k: 'b_utilsink', x: 40, y: BACK + 2, a: 'usink' },
    { id: 'washer', k: 'b_washer', x: 96, y: BACK + 3, a: 'washer' },
    { id: 'dryer', k: 'b_dryer', x: 148, y: BACK + 3, a: 'dryer' },
    { id: 'pile', k: 'b_laundrypile', x: 190, y: 170, z: 1, a: 'pile' },
    { id: 'bstep', k: 'p:bstep', x: 240, y: BACK + 5, w: 46, h: 7, nohit: true },
    { id: 'btoilet', k: 'toilet', x: 240, y: BACK - 2, a: 'btoilet' },
  ];
  PROPS.nunuroom = [
    { id: 'nbed', k: 'b_bed', x: 76, y: BACK + 8, a: 'bed', climb: 124 },
    { id: 'folded', k: 'b_changetable', x: 172, y: BACK + 3, a: 'dresser' },
    { id: 'alcove', k: 'p:alcove', x: 238, y: BACK, w: 68, h: 100, nohit: true },
    { id: 'rack', k: 'b_clothesrack', x: 238, y: BACK, a: 'closet' },
    { id: 'ntotes', k: 'b_totes', x: 296, y: BACK + 3, a: 'toybox' },
  ];

  // ---------------------------------------------------------------- the rooms, drawn by code (used until the painted pictures load, and as the sketch they were painted from)
  const C = { wall: '#e7e3da', trim: '#f7f6f1', line: 'rgba(60,50,40,.10)', plank: '#d8c39b', seam: '#bfa67a', carpet: '#cbbda3', shadow: 'rgba(40,30,20,.18)' };
  function plankFloor(W, seed) { rect(0, WALL_Y, W, SH - WALL_Y, C.plank); const r = srand(seed);
    for (let y = WALL_Y; y < SH; y += 8) { rect(0, y, W, 1, C.seam); for (let k = 0; k < W / 46; k++) rect(r() * W, y, 1, 8, C.seam); rect(r() * W, y + 4, 20 + r() * 40, 1, 'rgba(255,245,220,.25)'); } }
  function win(x, y, w, h, cols, rows) { rect(x - 2, y - 2, w + 4, h + 4, C.trim); rect(x, y, w, h, '#a9cfe0'); rect(x, y + h * 0.55, w, h * 0.45, '#8fb779');
    for (let i = 1; i < cols; i++) rect(x + (w / cols) * i, y, 1, h, C.trim); for (let j = 1; j < rows; j++) rect(x, y + (h / rows) * j, w, 1, C.trim); rect(x - 3, y + h + 2, w + 6, 2, '#e3e0d6'); }
  function basementBG(room) {
    const W = ROOMS[room].w;
    if (room === 'den') {
      rect(0, 0, W, WALL_Y, C.wall);
      rect(0, 99, W, WALL_Y - 99, C.trim); for (let y = 106; y < WALL_Y; y += 8) rect(0, y, W, 1, C.line); rect(0, 95, W, 4, '#fdfcf8'); rect(0, 99, W, 1, C.shadow);        // shiplap below a ledge rail
      rect(0, 0, W, 14, '#f3f2ed'); for (let x = 30; x < W; x += 76) { rect(x, 0, 12, 18, '#e9e7df'); rect(x, 18, 12, 1, C.shadow); } rect(0, 14, W, 1, C.shadow);            // low white beamed ceiling
      win(300, 30, 60, 24, 2, 1); win(388, 30, 40, 24, 2, 1);
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); plankFloor(W, 61);
    } else if (room === 'storage') {
      rect(0, 0, W, WALL_Y, '#d5d0c4'); for (let x = 0; x < 200; x += 50) rect(x, 18, 1, WALL_Y - 18, C.line);
      rect(200, 18, W - 200, WALL_Y - 18, '#b99a68'); for (let x = 200; x < W; x += 24) { rect(x, 18, 5, WALL_Y - 18, '#a17e4b'); rect(x + 5, 18, 1, WALL_Y - 18, C.shadow); }   // bare stud wall
      rect(0, 0, W, 18, '#3b2a1b'); for (let x = 6; x < W; x += 22) rect(x, 0, 7, 18, '#6c4b2c'); rect(0, 18, W, 1, 'rgba(0,0,0,.35)');                                    // open joists
      rect(148, 18, 2, 8, '#444'); rect(145, 26, 8, 8, '#fff6c8'); rect(214, 20, 46, 4, '#eef4ff');                                                                         // bare bulb, strip light
      plankFloor(W, 62);
    } else if (room === 'laundry') {
      rect(0, 0, W, WALL_Y, '#dcd9cf'); rect(0, 0, W, 12, '#f4f3ee'); rect(0, 12, W, 2, C.shadow); rect(150, 12, 120, 12, '#eceae2');
      win(16, 40, 42, 58, 2, 3); win(64, 40, 42, 58, 2, 3); rect(10, 100, 104, 4, '#f3f1ea');
      rect(22, 88, 9, 12, '#f08a2c'); rect(34, 90, 6, 10, '#f3f3f3'); rect(44, 86, 7, 14, '#e86a8f'); rect(82, 90, 8, 10, '#6aa7e8');                                       // bottles on the sill
      rect(120, 60, 22, 30, '#b9bec2'); rect(122, 62, 18, 26, '#dfeef5');                                                                                                   // mirror
      rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); rect(0, WALL_Y, W, SH - WALL_Y, '#dccfb8');
      for (let y = WALL_Y; y < SH; y += 13) rect(0, y, W, 1, '#c2b497'); for (let y = WALL_Y; y < SH; y += 13) for (let x = ((y - WALL_Y) / 13 % 2) * 13; x < W; x += 26) rect(x, y, 1, 13, '#c2b497');
    } else {
      rect(0, 0, W, WALL_Y, '#dad7d1'); rect(0, 0, W, 12, '#f4f3ee'); rect(0, 12, W, 2, C.shadow); rect(120, 12, 200, 10, '#eceae4'); rect(120, 22, 200, 1, C.shadow);
      win(52, 42, 54, 34, 2, 3); rect(0, WALL_Y - 4, W, 4, '#fbfbf7'); plankFloor(W, 64);
    }
    if (ROOMS[room].left) rect(0, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.22)'); if (ROOMS[room].right) rect(W - 4, 20, 4, WALL_Y - 20, 'rgba(0,0,0,.22)');
  }
  const _drb = drawRoomBG;
  drawRoomBG = function (room) { if (!isDown(room) || bgFor(room)) return _drb(room); const ctx = E.ctx; ctx.fillStyle = '#1d1830'; ctx.fillRect(-10, -40, E.viewW + 20, SH + 60); basementBG(room); };

  // the pieces of a room that are drawn by code (baked into the painted picture once that exists)
  function drawBits(p) {
    const x = p.x, y = p.y, w = p.w, h = p.h, L = x - w / 2, T = y - h;
    switch (p.k) {
      case 'p:bstairs': {       // carpeted stairs climbing up to the left, into the dark stairwell
        rect(L, T - 4, w, h + 4, '#efece5'); rect(L, T - 4, 26, 34, '#3a3029'); rect(L + 26, T - 4, 2, 34, C.trim);
        for (let i = 0; i < 9; i++) { const ty = y - (i + 1) * 11, rw = w - i * 9; rect(L, ty, rw, 11, i % 2 ? '#c4b59a' : C.carpet); rect(L, ty, rw, 2, '#ddd0b8'); rect(L + rw - 1, ty, 1, 11, C.shadow); }
        for (let i = 0; i < 9; i++) rect(L + w - 6 - i * 9, y - 34 - i * 11, 9, 3, '#5a3a22');     // handrail
        rect(L + w - 4, y - 34, 3, 34, '#5a3a22'); rect(L + 60, T + 16, 4, 6, '#333'); rect(L + 57, T + 22, 10, 9, '#fff3c4'); break; }
      case 'p:ledge': {         // the picture ledge: swan pictures, photos and her drawings
        rect(L, y, w, 3, '#fdfcf8'); rect(L, y + 3, w, 1, C.shadow);
        rect(L + 4, y - 9, 6, 9, '#d9a7b5'); rect(L + 12, y - 11, 7, 11, '#c9a0c8');
        rect(L + 24, y - 26, 20, 26, '#cdb98a'); rect(L + 26, y - 24, 16, 22, '#3b3a36'); rect(L + 30, y - 14, 8, 6, '#151515'); rect(L + 36, y - 19, 2, 6, '#151515');
        rect(L + 48, y - 16, 17, 16, '#d8d4c8'); rect(L + 50, y - 14, 13, 12, '#2a2a28'); rect(L + 53, y - 8, 7, 4, '#eeeeea');
        rect(L + 68, y - 12, 12, 12, '#ffffff'); rect(L + 70, y - 9, 5, 5, '#e89bc0'); rect(L + 75, y - 6, 3, 3, '#7aa8e8'); break; }
      case 'p:dutch': {         // the white Dutch door with a diamond window, shelves either side
        rect(L - 26, T + 8, 22, 44, '#f4f3ee'); rect(L - 24, T + 10, 18, 18, '#d9d2c2'); rect(L - 24, T + 32, 18, 18, '#d9d2c2'); rect(L + w + 4, T + 8, 22, 44, '#f4f3ee'); rect(L + w + 6, T + 10, 18, 18, '#d9d2c2'); rect(L + w + 6, T + 32, 18, 18, '#d9d2c2');
        rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#f1f0ea'); rect(L + 4, T + 5, w - 8, 34, '#27303a');
        for (let i = 0; i < 4; i++) { rect(L + 4 + i * 6, T + 5 + i * 8, 2, 2, '#f1f0ea'); rect(L + w - 6 - i * 6, T + 5 + i * 8, 2, 2, '#f1f0ea'); }
        rect(L, T + 44, w, 2, '#d6d3c8'); rect(L + 4, T + 50, w - 8, 36, '#e6e4dc'); for (let i = 0; i < 9; i++) { rect(L + 5 + i * 2.4, T + 52 + i * 3.6, 2, 2, '#f8f7f2'); rect(L + w - 7 - i * 2.4, T + 52 + i * 3.6, 2, 2, '#f8f7f2'); }
        rect(L + w - 6, T + 46, 3, 3, '#222'); break; }
      case 'p:bfire': {         // the brick hearth
        rect(L, T, w, h, '#8a4a36'); for (let yy = T; yy < y; yy += 6) for (let xx = L + ((yy / 6) % 2) * 6 - 6; xx < L + w; xx += 12) { rect(Math.max(L, xx), yy, 1, 6, '#6b3526'); } for (let yy = T; yy < y; yy += 6) rect(L, yy, w, 1, '#6b3526');
        rect(L + 8, y - 40, w - 16, 40, '#1c1512'); rect(L + 6, y - 44, w - 12, 5, '#5c2f22'); rect(L - 18, y, w + 18, 6, '#7c4231'); rect(L - 18, y, w + 18, 1, '#9a5a44'); break; }
      case 'p:bstep': rect(L, T, w, h, '#cdbfa8'); rect(L, T, w, 1, '#e2d7c4'); break;
      case 'p:alcove': rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#4b4640'); rect(L, T, w, 6, '#efede6'); rect(L, T + 10, w, 2, '#b9b6ae'); break;
    }
  }
  const ALWAYS = { 'p:bdoorway': 1, 'p:btv': 1 };      // drawn by code even over a painted room
  function drawAlways(p) {
    const x = p.x, y = p.y, w = p.w, h = p.h, L = x - w / 2, T = y - h;
    if (p.k === 'p:bdoorway') {   // an open doorway with the basement stairs going down inside it
      rect(L - 3, T - 3, w + 6, h + 3, '#fbfbf8'); rect(L, T, w, h, '#2e2620');
      for (let i = 0; i < 5; i++) { rect(L, y - 14 + i * 3 - (4 - i) * 0, w - i * 4, 3, i % 2 ? '#b9aa90' : '#cbbda3'); }
      for (let i = 0; i < 5; i++) rect(L + i * 4, y - 15 + i * 3, w - i * 4, 1, '#e0d4bd');
      rect(L + 3, T + 14, 3, 5, '#333'); rect(L + 1, T + 19, 7, 7, '#fff0b8'); rect(L, T + 16, 9, 12, 'rgba(255,240,180,.18)');
      for (let i = 0; i < 6; i++) rect(L + w - 5 - i * 3, y - 34 + i * 5, 3, 2, '#5a3a22');
      emoji('⬇️', x, T + 46 + Math.sin(E.t * 3) * 2, 9, 0.9);
    } else if (p.k === 'p:btv') { // Nunu's TV on the pine dresser
      rect(L, T, w, h - 3, '#16161a'); rect(L + 2, T + 2, w - 4, h - 7, G.btvOn ? '#0b2c44' : '#23232b'); rect(x - 8, y - 3, 16, 3, '#16161a');
      if (G.btvOn) { const k = frameKey('tvshow_fish_a', E.t, 6), c = k && spriteCanvas(k); if (c) { const ctx = E.ctx; ctx.drawImage(c, Math.round(L + 2 - E.camX), Math.round(T + 2), w - 4, h - 7); } else emoji('🐠', x + Math.sin(E.t * 2) * 10, T + h / 2 - 2, 12); }
    }
  }
  const tux = () => PROPS.den.find(p => p.id === 'tuxcat');
  const _dp = drawProp;
  drawProp = function (p) {
    if (!isDown(G.room) && p.id !== 'basedoor') return _dp(p);
    if (ALWAYS[p.k]) return drawAlways(p);
    if (p.k.startsWith('p:')) { if (!bgFor(G.room)) drawBits(p); extras(p); return; }
    const ctx = E.ctx; let sx = 0, sy = 0;
    if (S.shake && S.shake.id === p.id && E.t < S.shake.until) sx = Math.sin(E.t * 46) * 1.4;
    if (p.id === 'bigbox' && S.rocket) sy = S.rocket.lift || 0;
    if (p.id === 'bball' && S.ball) return drawBall(p);
    if (p.id === 'tuxcat') { const up = E.t < (S.tuxUp || 0); drawSprite(up && has('b_tuxcat_sit') ? 'b_tuxcat_sit' : 'b_tuxcat', p.x + (up ? Math.sin(E.t * 12) * 0.8 : 0), p.y, {}); if (!up && chance(0.012)) emit('zzz', p.x + 8, p.y - 20); return; }
    if (sx || sy) { ctx.save(); ctx.translate(sx, sy); _dp(p); ctx.restore(); } else _dp(p);
    extras(p);
  };
  // little live details on top of things
  function extras(p) {
    const ctx = E.ctx;
    if (p.id === 'ltable' && window.Bricks && Bricks.has('lego')) { try { Bricks.drawModel(ctx, 'lego', Math.round(p.x - E.camX), Math.round(p.y - 21), 20); } catch (e) { } }
    if (p.id === 'tiles' && window.Bricks && Bricks.has('tiles')) { try { Bricks.drawModel(ctx, 'tiles', Math.round(p.x - 34 - E.camX), Math.round(FLOOR + 6), 18); } catch (e) { } }
    if (p.id === 'stones' && S.stones) for (let i = 0; i < S.stones; i++) { rect(p.x - 5 + (i % 2), p.y - 14 - i * 4, 10 - i, 4, i % 2 ? '#9aa0a6' : '#b8bcc0'); rect(p.x - 4 + (i % 2), p.y - 14 - i * 4, 8 - i, 1, '#d5d8db'); }
    if (p.id === 'bfire' && G.bfireOn) { const f = 0.75 + Math.sin(E.t * 17) * 0.12 + Math.sin(E.t * 7.3) * 0.1; emoji('🔥', p.x, p.y - 12, 16 * f); const g = ctx.createRadialGradient(p.x - E.camX, p.y - 20, 4, p.x - E.camX, p.y - 20, 70); g.addColorStop(0, 'rgba(255,170,70,.28)'); g.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - 80 - E.camX, p.y - 90, 160, 110); if (chance(0.05)) emit('sparkle', p.x + rnd(-6, 6), p.y - 26, 1); }
    if (p.id === 'dutch' && E.t < (S.dutchT || 0)) { const L = p.x - p.w / 2, T = p.y - p.h; rect(L, T, p.w, 44, '#9fd0f2'); rect(L, T + 26, p.w, 18, '#7fb56a'); emoji('🍂', p.x + Math.sin(E.t * 2) * 8, T + 16 + Math.cos(E.t * 3) * 4, 8); rect(L - 8, T, 8, 44, '#e9e7df'); }
    if (p.id === 'fan' && S.fanOn) { emoji('🌀', p.x, p.y - spriteSize('b_fan')[1] + 12, 13, 0.85, E.t * 14); if (chance(0.25)) emit('dust', p.x - 12 - rnd(0, 20), p.y - 44 + rnd(-8, 8), 1); }
    if (p.id === 'dryer' && S.dry && E.t < S.dry) emoji('🌀', p.x, p.y - 24, 14, 0.9, E.t * 9);
    if (p.id === 'washer' && S.wash && E.t < S.wash && chance(0.3)) emit('heart', p.x + rnd(-10, 10), p.y - 56, 1, { ch: '🫧', vx: rnd(-14, 14), vy: rnd(-30, -12), life: 1.4, size: rnd(7, 12) });
  }
  function drawBall(p) { const b = S.ball, k = clamp((E.t - b.t0) / b.dur, 0, 1), x = b.x0 + (b.x1 - b.x0) * k, y = b.y0 + (b.y1 - b.y0) * k - Math.sin(k * Math.PI) * 46; drawSprite('b_basketball', x, y, { rot: E.t * 8 }); }
  const S = {};        // small bits of basement state (nothing is saved)

  // ---------------------------------------------------------------- Marina hiding / wearing a lamp shade
  const _dm = drawMarina;
  drawMarina = function (e) {
    if (S.hidden) { const p = S.hidden; emoji('👀', p.x, p.y - spriteSize(p.k)[1] - 4 + Math.sin(E.t * 5) * 1.5, 10); return; }
    _dm(e);
    if (E.t < (S.hatT || 0) && has('b_lampshades')) drawSprite('b_lampshades', e.x, e.y + e.offY - 52 * e.scale, { scale: 0.42, rot: Math.sin(E.t * 6) * 0.08 });
  };
  const _dx = drawExitSigns;
  drawExitSigns = function () { _dx(); if (E.t < (S.napT || 0) && G.room === 'nunuroom') { const c = E.ctx; c.fillStyle = 'rgba(16,12,44,' + (0.55 * clamp(Math.min(S.napT - E.t, E.t - S.nap0) / 0.6, 0, 1)).toFixed(3) + ')'; c.fillRect(-10, -40, E.viewW + 20, SH + 60); emoji('🌙', E.camX + E.viewW - 40, 30, 16); } };

  // ---------------------------------------------------------------- things to do
  const cheer = (ms = 1500) => { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), ms); };
  const lock = ms => { G.busy = true; setTimeout(() => { G.busy = false; }, ms); };
  const got = ev => { try { window.did && did(ev); } catch (e) { } };
  const near = (p, fn, gap) => approach(p.x, fn, gap == null ? 16 : gap);
  function bricks(kind, p) { if (!window.Bricks) return say('m_hmm'); near(p, () => { UI.closeActions(); const G2 = window.GRAND, withNunu = G2 && kind === 'lego' && nunu.here;
    Bricks.open({ kind, onClose: () => { if (G2) G2.nunuAtBricks(false); },
      onDone: r => { if (G2) G2.nunuAtBricks(false); if (r && r.count) { cheer(1800); emit('confetti', marina.x, marina.y - 60, 24); say(pick(['m_did_it', 'm_look', 'm_made'])).then(() => { if (withNunu && nunu.here) say(pick(['nu_lego_done', 'nu_lego_nice1', 'nu_proud']), nunu); }); got('lego'); if (window.reactTo && !withNunu) reactTo('artist', 1800); } } });
    if (withNunu) G2.nunuAtBricks(true); }, 30); }
  function petTux(p) { near(p, () => { marina.dir = Math.sign(p.x - marina.x) || 1; playAnim('marina_pet', { fps: 6, proc: 'hug', dur: 1.4 }); Audio2.sfx('purr'); emit('heart', p.x, p.y - 22, 5); S.tuxUp = E.t + 3; say('m_niko_love'); }, 24); }
  function playTux(p) { near(p, () => { S.tuxUp = E.t + 3.5; Audio2.sfx(pick(['trill1', 'trill3'])); emit('star', p.x, p.y - 20, 6); say('m_giggle'); cheer(1200); }, 28); }
  function stackStone(p) { near(p, () => { S.stones = (S.stones || 0) + 1; Audio2.blip(S.stones * 2, 'triangle', 0.1, 0.16); emit('dust', p.x, p.y - 14 - S.stones * 4, 2);
    if (S.stones >= 6) { lock(900); setTimeout(() => { S.stones = 0; Audio2.sfx('thud', { vol: 0.7 }); emit('dust', p.x, p.y - 10, 10); for (let i = 0; i < 5; i++) emit('heart', p.x + rnd(-8, 8), p.y - 16, 1, { ch: '🪨', vx: rnd(-50, 50), vy: rnd(-70, -20), life: 0.9, size: 7 }); say('m_uhoh'); }, 500); } }, 20); }
  function peekaboo(p) { near(p, () => { G.busy = true; UI.closeActions(); Audio2.whoosh(true); S.hidden = p; emit('dust', p.x, p.y - 10, 5);
    setTimeout(() => { S.hidden = null; marina.x = p.x; Audio2.jingle([0, 7, 12], 0.06); emit('star', p.x, p.y - 50, 10); emit('confetti', p.x, p.y - 50, 14); say(pick(['m_giggle', 'm_yay'])); G.busy = false;
      let t = 0; const iv = setInterval(() => { t += 0.05; marina.offY = -Math.sin(Math.min(1, t / 0.5) * Math.PI) * 26; if (t >= 0.5) { clearInterval(iv); marina.offY = 0; marina.x = p.x + 30; } }, 40); cheer(1400); }, 2400); }, 0); }
  function boxRocket(p) { near(p, () => { G.busy = true; UI.closeActions(); const y0 = marina.y; marina.x = p.x; marina.y = p.y - 2; marina.state = 'sit'; marina.offY = -6; S.shake = { id: p.id, until: E.t + 2 }; S.rocket = { lift: 0 };
    [0, 600, 1200].forEach((ms, i) => setTimeout(() => { Audio2.blip(i * 3, 'square', 0.18, 0.2); UI.bigIcon(['3️⃣', '2️⃣', '1️⃣'][i], 480); }, ms));
    setTimeout(() => { say('m_vroom'); Audio2.whoosh(true); UI.bigIcon('🚀', 900); let t = 0; const iv = setInterval(() => { t += 0.04; const k = Math.sin(Math.min(1, t / 2.4) * Math.PI); S.rocket.lift = -k * 34; marina.offY = -6 - k * 34; emit('heart', p.x + rnd(-8, 8), p.y + S.rocket.lift, 1, { ch: pick(['🔥', '✨', '⭐']), vx: rnd(-20, 20), vy: rnd(20, 60), life: 0.6, size: 9 });
      if (t >= 2.4) { clearInterval(iv); S.rocket = null; marina.offY = 0; marina.y = y0; marina.x = p.x + 34; Audio2.sfx('thud', { vol: 0.6 }); emit('dust', p.x, p.y, 8); G.busy = false; cheer(); say('m_wow'); } }, 40); }, 1800); }, 0); }
  function shoot(p) { const ball = PROPS.storage.find(q => q.id === 'bball'), hoop = PROPS.storage.find(q => q.id === 'hoop'); if (S.ball) return;
    approach(ball.x - 26, () => { marina.dir = 1; playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.6 }); const inIt = chance(0.65), top = hoop.y - spriteSize(hoop.k)[1] + 4;
      S.ball = { t0: E.t, dur: 0.75, x0: ball.x, y0: ball.y - 10, x1: inIt ? hoop.x : hoop.x + pick([-20, 20]), y1: inIt ? top : hoop.y - 8 }; Audio2.whoosh(true);
      setTimeout(() => { S.ball = null; if (inIt) { Audio2.jingle([0, 4, 7, 12, 16], 0.07); emit('confetti', hoop.x, top - 10, 22); emit('star', hoop.x, top, 8); cheer(); say(pick(['m_did_it', 'm_yay'])); got('hoop'); S.shake = { id: 'hoop', until: E.t + 0.5 }; }
        else { Audio2.sfx('boing', { vol: 0.7 }); emit('dust', hoop.x, hoop.y - 8, 4); say(pick(['m_uhoh', 'm_hmm', 'm_giggle'])); } }, 760); }, 0); }
  function fanToggle(p) { near(p, () => { S.fanOn = !S.fanOn; Audio2.whoosh(S.fanOn); if (S.fanOn) { say('m_blow'); clearInterval(S.fanIv); S.fanIv = setInterval(() => { if (!S.fanOn || G.room !== 'storage') return clearInterval(S.fanIv); Audio2.noise(0.5, 0.05, 900); }, 700); } }, 26); }
  function shadeHat(p) { near(p, () => { S.hatT = E.t + 9; Audio2.jingle([12, 7, 12, 16], 0.07); emit('star', marina.x, marina.y - 80, 6); say(pick(['m_giggle', 'm_look', 'm_pretty'])); cheer(1200); }, 22); }
  function toyCook(p) { near(p, () => UI.openCook('cabinet'), 20); }
  function toyServe(p) { near(p, () => { playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.6 }); for (let i = 0; i < 6; i++) setTimeout(() => { emit('heart', p.x + rnd(-10, 10), p.y - 50, 1, { ch: pick(['🧁', '🍪', '🍰', '🍩', '🫖', '🍓']), vx: rnd(-26, 26), vy: rnd(-50, -20), life: 1.3, size: 11 }); Audio2.blip(pick([0, 4, 7, 12]), 'triangle', 0.08, 0.14); }, i * 160); say('m_snack'); }, 22); }
  function wash(p) { const w = PROPS.laundry.find(q => q.id === 'washer'), pile = PROPS.laundry.find(q => q.id === 'pile'); if (E.t < (S.wash || 0)) return;
    approach(pile.x - 4, () => { G.busy = true; UI.closeActions(); marina.dir = -1; playAnim('marina_reach', { fps: 9, proc: 'hug', dur: 1.5, loop: true });
      for (let i = 0; i < 6; i++) setTimeout(() => { emit('heart', pile.x, pile.y - 14, 1, { ch: pick(['🧦', '👕', '👖', '🩳', '👚']), vx: (w.x - pile.x) * 1.1, vy: -90, g: 220, life: 0.85, size: 11 }); Audio2.blip(i, 'triangle', 0.06, 0.12); }, 150 + i * 220);
      setTimeout(() => { marina.state = 'idle'; marina.anim = null; S.wash = E.t + 4; S.shake = { id: 'washer', until: E.t + 4 }; Audio2.sfx('sink', { rate: 0.7 }); say('m_wash'); const iv = setInterval(() => { if (E.t > S.wash) return clearInterval(iv); Audio2.noise(0.3, 0.06, 300); }, 500); }, 1600);
      setTimeout(() => { Audio2.sfx('oven_ding'); emit('sparkle', w.x, w.y - 40, 16); G.busy = false; cheer(); say('m_clean'); got('wash'); if (window.reactTo) reactTo('helper', 1500); }, 5800); }, 0); }
  function dry(p) { if (E.t < (S.dry || 0)) return; near(p, () => { lock(4200); S.dry = E.t + 3; S.shake = { id: 'dryer', until: E.t + 3 }; const iv = setInterval(() => { if (E.t > S.dry) return clearInterval(iv); Audio2.noise(0.35, 0.07, 160); }, 450);
    setTimeout(() => { Audio2.sfx('oven_ding'); playAnim('marina_hug', { fps: 7, proc: 'hug', dur: 1.6 }); emit('heart', marina.x, marina.y - 60, 8); emit('heart', marina.x + 10, marina.y - 50, 1, { ch: '🧣', vx: 0, vy: -10, life: 1.4, size: 14 }); say(pick(['m_cuddle', 'm_happy'])); }, 3100); }, 22); }
  function nap(p) { near(p, () => { G.busy = true; UI.closeActions(); marina.x = p.x + 10; marina.state = 'sit'; marina.offY = (p.climb || 124) - FLOOR + 8; S.nap0 = E.t; S.napT = E.t + 4.5; say('m_nite'); const iv = setInterval(() => { if (E.t > S.napT) return clearInterval(iv); emit('zzz', marina.x + 6, marina.y + marina.offY - 40); }, 700);
    try { Audio2.melody('lullaby'); } catch (e) { }
    setTimeout(() => { marina.offY = 0; marina.state = 'idle'; marina.x = p.x + 62; G.busy = false; cheer(); emit('star', marina.x, marina.y - 70, 8); say('m_yay'); }, 4600); }, 10); }
  function goUp() { changeRoom('foyer', null, DOOR_X + 4); }

  const _pa = propActions;
  propActions = function (p) {
    switch (p.a) {
      case 'legotable': return [A('🧱', () => bricks('lego', p)), A('🎨', () => near(p, () => { UI.closeActions(); if (nunu.here) { const pr = Audio2.voice('nu_draw', 'nu'); UI.face('nunu', 'happy', pr); } UI.openCrafts('draw'); }, 30)), A('🧗', () => climbOn({ ...p, climb: 146 }))];
      case 'tiles': return [A('🔷', () => bricks('tiles', p))];
      case 'tuxcat': return [A('✋', () => petTux(p)), A('🧶', () => playTux(p))];
      case 'ottoman': return [A('🦘', () => bounceOn(p)), A('🪑', () => sitDown(p))];
      case 'stones': return [A('🪨', () => stackStone(p))];
      case 'btv': return [...(window.Movies && window.GRAND ? [A('🎬', () => GRAND.movieNight())] : []), A('🐠', () => near(p, () => { G.btvOn = !G.btvOn; Audio2.blip(G.btvOn ? 12 : -5, 'square', 0.08); if (G.btvOn) say('m_tv'); }, 30))];
      case 'bfire': return [A('🔥', () => near(p, () => { G.bfireOn = !G.bfireOn; Audio2.noise(0.4, 0.2, 700); if (G.bfireOn) { say('m_cool'); clearInterval(S.fireIv); S.fireIv = setInterval(() => { if (!G.bfireOn) return clearInterval(S.fireIv); if (G.room === 'den' && chance(0.6)) Audio2.noise(0.12, 0.05, 1800); }, 600); } }, 34))];
      case 'dutch': return [A('👋', () => near(p, () => { S.dutchT = E.t + 4; Audio2.sfx('door_open'); setTimeout(() => { Audio2.blip(19, 'sine', 0.1, 0.12); Audio2.blip(24, 'sine', 0.1, 0.1); }, 500); say('m_wow'); emit('leaf', p.x, p.y - 70, 3); }, 26))];
      case 'boxes': { const a = [A('🙈', () => peekaboo(p))]; if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); return a; }
      case 'bigbox': return [A('🚀', () => boxRocket(p)), A('🙈', () => peekaboo(p))];
      case 'bball': case 'hoop': return [A('🏀', () => shoot(p))];
      case 'fan': return [A('💨', () => fanToggle(p))];
      case 'shades': return [A('🎩', () => shadeHat(p))];
      case 'toykitchen': return [A('🍳', () => toyCook(p)), A('🧁', () => toyServe(p))];
      case 'washer': case 'pile': return [A('🫧', () => wash(p))];
      case 'dryer': return [A('🌀', () => dry(p))];
      case 'usink': return [A('🚰', () => near(p, () => { Audio2.sfx('sink'); say('m_wash'); for (let i = 0; i < 26; i++) setTimeout(() => emit('water', p.x - 4, p.y - 36), i * 40); }, 22))];
      case 'btoilet': { const a = [A('🚽', () => near(p, () => { Audio2.sfx('flush'); say('m_flush'); for (let i = 0; i < 18; i++) setTimeout(() => emit('water', p.x + rnd(-6, 6), p.y - 20), i * 40); }, 24))];
        if (G.holding && G.holding.type === 'poop') a.unshift(A('💩', () => near(p, () => { G.holding = null; Audio2.sfx('flush'); setTimeout(() => say('m_bye'), 900); got('poop'); }, 24))); return a; }
      case 'bed': { const a = [A('🦘', () => bounceOn(p)), A('😴', () => nap(p))]; if (FORT_SPOTS[G.room] && !G.fort) a.push(A('🏰', startFort)); return a; }
    }
    return _pa(p);
  };

  // leaving a room: put away anything mid-game
  Floors.hooks.push(() => { S.hidden = null; S.rocket = null; S.ball = null; });
  window.Basement = { rooms: DOWN, isDown, S, paint: basementBG, bits: drawBits };
})();
