/* ===================== BRICK THROW (MGKit) =====================
   Skill layer for throwBrickAt(targetType, context) in src/028-distortion-system.js:954.
   The existing function keeps doing everything (news note, morale/quality deltas, arrest roll, brick consumption);
   this module only returns a HIT-QUALITY MULTIPLIER that scales the morale/quality deltas. Arrest chance unchanged.

     const mult = await throwBrickMinigame(targetType, context);   // -> 1.5 | 1.0 | 0.5 | 0.2
       1.5 "HEADSHOT!"  1.0 "THUNK!"  0.5 "GRAZED!"  0.2 "MISSED!" (the crowd still saw you do it)

   Integration (3 lines in throwBrickAt, after addSessionShout(target.newsNote);):
     const hitMult = (typeof throwBrickMinigame === 'function') ? await throwBrickMinigame(targetType, context) : 1;
     ...const delta = (target.morale[0] + Math.random() * (target.morale[1] - target.morale[0])) * hitMult;
     ...const delta = (target.quality[0] + Math.random() * (target.quality[1] - target.quality[0])) * hitMult;

   Gameplay: one throw. The target (referee / opposing manager / anyone) patrols the touchline, pausing to blow
   the whistle or point (that's your tell before a direction change). Drag up from the brick to aim — a reticle
   shows the landing spot (your hand gets shakier the longer you hold) — release to throw. The brick takes
   0.75 s to land, so lead the target. Keys: arrows aim, Space/Enter throw. 10 s fuse, then you lob it anyway.
   Options: { art, debug }
*/
(function () {
  const W = 180, H = 320, HAND_X = 90, HAND_Y = 284, FLIGHT = 0.75;
  const zToY = z => 236 - z * 160;            // depth 0 (near) .. 1 (far)
  const zToS = z => 1 - 0.5 * z;              // perspective scale
  const toScreen = (wx, z) => ({ x: 90 + wx * zToS(z), y: zToY(z) });
  const GRADES = [
    { d: 7, mult: 1.5, label: 'HEADSHOT!', col: '#f2c14e', sub: 'Absolute scenes.' },
    { d: 15, mult: 1.0, label: 'THUNK!', col: '#3fbf6b', sub: 'Clean contact.' },
    { d: 26, mult: 0.5, label: 'GRAZED!', col: '#f29b2e', sub: 'Clipped him. Sort of.' },
    { d: Infinity, mult: 0.2, label: 'MISSED!', col: '#e5484d', sub: 'Everyone still saw you do it.' },
  ];
  const sfx = MGKit.sfx;

  async function throwBrickMinigame(targetType = 'referee', context = {}, opts = {}) {
    const art = opts.art || window.KMG_ART || 'art/raw/';
    const opp = context && context.opponent; const oppName = opp ? (typeof opp === 'string' ? opp : (opp.name || '')) : '';
    const who = targetType === 'manager' ? 'manager' : 'referee';
    const NAME = { referee: 'THE REFEREE', manager: (oppName ? oppName.toUpperCase() + ' ' : 'THEIR ') + 'MANAGER', players: 'YOUR OWN PLAYERS', opponents: 'THE OPPOSITION', fans: 'THE AWAY END' }[targetType] || 'THE TARGET';
    const mg = MGKit.open({ title: 'BRICK: ' + NAME, w: W, h: H, auto: () => GRADES[Math.floor(Math.random() * GRADES.length)].mult });
    await mg.load({ target: art + (who === 'manager' ? 'mg-brick-manager.png' : 'mg-brick-referee.png'), brick: art + 'mg-boss-brick.png' });
    const SP = mg.sprites, ctx = mg.ctx, inp = mg.input;

    const T = { wx: -40 + Math.random() * 80, z: 0.5 + Math.random() * 0.12, dir: Math.random() < .5 ? -1 : 1, v: 34, pause: 0, nextPause: 1 + Math.random(), bob: 0, down: 0, taunt: null };
    const G = { state: 'intro', t: 0, fuse: 10, aim: { wx: 0, z: 0.45 }, aiming: false, hold: 0, brick: null, grade: null, crowd: [], kbAim: false };
    for (let i = 0; i < 220; i++) G.crowd.push({ x: Math.random() * W, y: 6 + Math.random() * 54, c: ['#d71920', '#f4f1ea', '#24407a', '#2a2f3a', '#f2c14e', '#8c93a8'][Math.floor(Math.random() * 6)], p: Math.random() * 6 });

    function aimFromDrag() {
      // drag vector from the brick -> landing spot. Up = further, sideways = across.
      const dy = Math.min(0, inp.y - HAND_Y), dx = inp.x - HAND_X;
      const z = Math.max(0.02, Math.min(1.05, -dy / 190));
      const wx = Math.max(-95, Math.min(95, dx * 1.25 / zToS(z) * 0.8));
      return { wx, z };
    }
    function shakeAmt() { return Math.max(0, G.hold - 0.8) * 9 + (G.fuse < 3 ? 4 : 0); }
    function throwIt(aim) {
      const s = shakeAmt();
      const land = { wx: aim.wx + Math.sin(mg.elapsed * 7.3) * s, z: aim.z + Math.cos(mg.elapsed * 5.9) * s / 120 };
      G.brick = { t: 0, land }; G.state = 'flight'; G.aiming = false;
      sfx('triangle', 500, 140, 0.35, 0.12);
    }
    function grade() {
      const L = G.brick.land; const dx = L.wx - T.wx, dz = (L.z - T.z) * 110; const d = Math.hypot(dx, dz);
      const g = GRADES.find(g => d < g.d); G.grade = g; G.state = 'result'; G.t = 0;
      const p = toScreen(T.wx, T.z), ps = toScreen(L.wx, L.z);
      if (g.mult >= 1) {
        T.down = 0.01; mg.shake(g.mult > 1 ? 6 : 4, 0.35); mg.flash(g.mult > 1 ? '#fff' : '#f2c14e', 0.2);
        for (let i = 0; i < 30; i++) mg.particles.spawn({ x: p.x, y: p.y - 22 * zToS(T.z), vx: (Math.random() - .5) * 120, vy: -Math.random() * 100, g: 200, life: 0.8, color: ['#c33', '#f2c14e', '#fff', '#b55'][i % 4], size: 2 });
        sfx('square', 140, 40, 0.25, 0.3); setTimeout(() => sfx('sawtooth', 300, 600, 0.6, 0.08), 150);
        mg.banner(g.label, g.col, 1.4);
      } else {
        for (let i = 0; i < 14; i++) mg.particles.spawn({ x: ps.x, y: ps.y, vx: (Math.random() - .5) * 60, vy: -Math.random() * 40, g: 120, life: 0.6, color: i % 2 ? '#8a7a5a' : '#3a7a3a', size: 1 });
        mg.shake(2, 0.15); sfx('square', 90, 50, 0.15, 0.2);
        T.taunt = g.mult > 0.3 ? 'OW! OI!' : 'HAHAHA!'; mg.banner(g.label, g.col, 1.2);
        if (g.mult > 0.3) { T.pause = 0.8; }
      }
    }

    function update(dt) {
      G.t += dt;
      // target AI: patrol, pause (tell), maybe reverse
      if (T.down > 0) T.down = Math.min(1, T.down + dt * 4);
      else if (T.pause > 0) { T.pause -= dt; if (T.pause <= 0 && T.flipAfter) { T.dir *= -1; T.flipAfter = false; } }
      else {
        T.wx += T.dir * T.v * dt; T.bob += dt * 10;
        if (T.wx > 70) { T.wx = 70; T.dir = -1; } if (T.wx < -70) { T.wx = -70; T.dir = 1; }
        T.nextPause -= dt;
        if (T.nextPause <= 0) { T.pause = 0.5 + Math.random() * 0.5; T.flipAfter = Math.random() < 0.55; T.nextPause = 1.2 + Math.random() * 1.6; T.v = 26 + Math.random() * 22;
          if (who === 'referee') sfx('sine', 2400, 2300, 0.18, 0.05); }
      }
      if (G.state === 'intro') { if (G.t > 1.4 || inp.pressed) G.state = 'aim'; return; }
      if (G.state === 'aim') {
        G.fuse -= dt;
        const k = inp.keys;
        if (k.has('ArrowLeft') || k.has('ArrowRight') || k.has('ArrowUp') || k.has('ArrowDown')) {
          G.kbAim = true; G.hold += dt;
          if (k.has('ArrowLeft')) G.aim.wx -= 90 * dt; if (k.has('ArrowRight')) G.aim.wx += 90 * dt;
          if (k.has('ArrowUp')) G.aim.z += 0.6 * dt; if (k.has('ArrowDown')) G.aim.z -= 0.6 * dt;
          G.aim.wx = Math.max(-95, Math.min(95, G.aim.wx)); G.aim.z = Math.max(0.02, Math.min(1.05, G.aim.z));
        }
        if (inp.pressed) { G.aiming = true; G.hold = 0; }
        if (G.aiming && inp.down) { G.hold += dt; G.aim = aimFromDrag(); }
        if (G.aiming && inp.released) { if (inp.y < HAND_Y - 8) throwIt(aimFromDrag()); else G.aiming = false; }
        if (inp.keyPressed(' ') || inp.keyPressed('Enter')) throwIt(G.aim);
        if (G.fuse <= 0 && G.state === 'aim') { mg.banner('LOB IT!', '#f29b2e', 0.8); throwIt(G.aim); }
      } else if (G.state === 'flight') {
        G.brick.t += dt / FLIGHT;
        if (G.brick.t >= 1) grade();
      } else if (G.state === 'result') {
        if (G.t > 2.6 || (G.t > 0.9 && (inp.pressed || inp.keyPressed(' ') || inp.keyPressed('Enter')))) mg.end(G.grade.mult);
      }
    }

    function draw() {
      // stands + crowd
      ctx.fillStyle = '#239040'; ctx.fillRect(-8, -8, W + 16, H + 16);
      ctx.fillStyle = '#1a1e2a'; ctx.fillRect(-8, -8, W + 16, 74);
      for (const c of G.crowd) { const jump = (G.state === 'result' && G.grade && G.grade.mult >= 1) ? Math.abs(Math.sin(mg.elapsed * 12 + c.p)) * 3 : Math.sin(mg.elapsed * 2 + c.p) > 0.95 ? 1 : 0; ctx.fillStyle = c.c; ctx.fillRect(Math.round(c.x), Math.round(c.y - jump), 2, 3); }
      ctx.fillStyle = '#d71920'; ctx.fillRect(0, 62, W, 6); mg.text('NO BRICKS BEYOND THIS POINT', 90, 65, { size: 6, color: '#f4f1ea', shadow: false });
      // pitch with perspective stripes
      for (let i = 0; i < 16; i++) {
        const z0 = 1.05 - i * 0.1, z1 = z0 - 0.1, y0 = zToY(z0), y1 = zToY(z1);
        ctx.fillStyle = i % 2 ? '#2fa84f' : '#289546'; ctx.fillRect(-8, Math.round(y0), W + 16, Math.ceil(y1 - y0) + 1);
      }
      // touchline + technical area
      ctx.fillStyle = '#f4f1ea'; const tl = zToY(0.5); ctx.fillRect(0, Math.round(tl) + 4, W, 1);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let x = 20; x < W; x += 40) ctx.fillRect(x, Math.round(zToY(0.62)), 1, Math.round(zToY(0.38) - zToY(0.62)));

      // reticle
      if (G.state === 'aim' && (G.aiming || G.kbAim || true)) {
        const s = shakeAmt(), a = G.aim, p = toScreen(a.wx + Math.sin(mg.elapsed * 7.3) * s, a.z + Math.cos(mg.elapsed * 5.9) * s / 120);
        const sc = zToS(a.z), r = Math.round(9 * sc);
        ctx.strokeStyle = G.aiming || G.kbAim ? '#f2c14e' : 'rgba(242,193,78,.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(Math.round(p.x), Math.round(p.y), r, Math.max(2, Math.round(r * 0.45)), 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        if (G.aiming) { // dotted arc preview
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          for (let i = 1; i < 10; i++) { const t = i / 10; const x = HAND_X + (p.x - HAND_X) * t, y = HAND_Y + (p.y - HAND_Y) * t - Math.sin(Math.PI * t) * 50; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
        }
      }
      // target
      const tp = toScreen(T.wx, T.z), ts = zToS(T.z) * 1.35;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(tp.x, tp.y, 10 * ts, 3 * ts, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(Math.round(tp.x), Math.round(tp.y));
      if (T.down > 0) ctx.rotate(T.down * Math.PI / 2 * (T.dir || 1));
      const bob = T.pause > 0 || T.down ? 0 : Math.round(Math.abs(Math.sin(T.bob)) * 1.5);
      if (T.dir < 0 && !T.down) ctx.scale(-1, 1);
      if (SP.target) ctx.drawImage(SP.target, Math.round(-16 * ts), Math.round(-46 * ts) - bob, Math.round(32 * ts), Math.round(48 * ts));
      ctx.restore();
      if (T.pause > 0 && !T.down && G.state !== 'result') mg.text(who === 'referee' ? 'PEEP!' : 'OI!', tp.x + 12, tp.y - 50 * ts, { size: 8, color: '#f4f1ea' });
      if (T.down >= 1) for (let i = 0; i < 3; i++) { const a = mg.elapsed * 5 + i * 2.1; mg.text('*', tp.x + Math.cos(a) * 10 + (T.dir || 1) * 18, tp.y - 8 + Math.sin(a) * 3, { size: 8, color: '#f2c14e', shadow: false }); }
      if (T.taunt && G.state === 'result') mg.text(T.taunt, tp.x, tp.y - 54 * ts, { size: 9, color: '#f4f1ea' });

      // brick in flight
      if (G.state === 'flight' || (G.state === 'result' && G.grade && G.grade.mult < 1)) {
        const t = G.state === 'flight' ? G.brick.t : 1, L = toScreen(G.brick.land.wx, G.brick.land.z);
        const gx = HAND_X + (L.x - HAND_X) * t, gy = HAND_Y + (L.y - HAND_Y) * t;
        const sc = 1 + (zToS(G.brick.land.z) - 1) * t;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(gx, gy, 6 * sc, 2 * sc, 0, 0, 7); ctx.fill();
        const by = gy - Math.sin(Math.PI * t) * 60;
        ctx.save(); ctx.translate(Math.round(gx), Math.round(by)); ctx.rotate(G.state === 'flight' ? t * 14 : 0.3);
        const s = Math.round(22 * sc); if (SP.brick) ctx.drawImage(SP.brick, -s / 2, -s / 2, s, s); ctx.restore();
      }
      // chairman's hand + brick
      if (G.state === 'aim' || G.state === 'intro') {
        const s = shakeAmt() * 0.4, hx = HAND_X + (G.aiming ? (inp.x - HAND_X) * 0.15 : 0) + Math.sin(mg.elapsed * 30) * s, hy = HAND_Y + (G.aiming ? Math.min(0, inp.y - HAND_Y) * 0.1 : 0);
        ctx.fillStyle = '#1b2440'; ctx.fillRect(Math.round(hx) - 12, Math.round(hy) + 10, 24, 40); // pinstripe sleeve
        ctx.fillStyle = '#2b3660'; for (let x = -10; x < 12; x += 4) ctx.fillRect(Math.round(hx) + x, Math.round(hy) + 10, 1, 40);
        ctx.fillStyle = '#e0a080'; ctx.fillRect(Math.round(hx) - 10, Math.round(hy) + 2, 20, 12);
        if (SP.brick) ctx.drawImage(SP.brick, Math.round(hx) - 16, Math.round(hy) - 20, 32, 32);
        ctx.fillStyle = '#e0a080'; ctx.fillRect(Math.round(hx) - 11, Math.round(hy) + 4, 4, 8); ctx.fillRect(Math.round(hx) + 7, Math.round(hy) + 4, 4, 8);
      }
      // HUD
      ctx.fillStyle = 'rgba(13,16,22,.8)'; ctx.fillRect(0, 0, W, 14);
      mg.text('TARGET: ' + NAME, 4, 7, { size: 7, align: 'left', color: '#f4f1ea' });
      if (G.state === 'aim') { const f = Math.max(0, G.fuse); mg.text(f.toFixed(1) + 's', W - 4, 7, { size: 8, align: 'right', color: f < 3 ? '#e5484d' : '#f2c14e' }); }
      if (G.state === 'intro' || (G.state === 'aim' && !G.aiming && G.fuse > 7.5)) {
        ctx.fillStyle = 'rgba(7,9,13,.7)'; ctx.fillRect(0, 196, W, 44);
        mg.text('DRAG UP from the brick, release', 90, 208, { size: 8, color: '#f4f1ea' });
        mg.text('to throw. Lead the target!', 90, 220, { size: 8, color: '#f4f1ea' });
        mg.text('Keys: arrows aim · SPACE throw', 90, 232, { size: 7, color: '#8c93a8' });
      }
      if (G.state === 'result' && G.t > 0.6) {
        ctx.fillStyle = 'rgba(7,9,13,.82)'; ctx.fillRect(0, 238, W, 70);
        mg.text(G.grade.label, 90, 252, { size: 14, color: G.grade.col });
        mg.text(G.grade.sub, 90, 268, { size: 8, color: '#f4f1ea' });
        mg.text(`Effect x${G.grade.mult}`, 90, 282, { size: 9, color: '#f2c14e' });
        if (G.t > 0.9) mg.text('tap to continue', 90, 298, { size: 7, color: '#8c93a8' });
      }
    }

    if (opts.debug || window.__KREPLIN_TEST__) window.__kmgBrick = { G, T, mg, toScreen };
    mg.loop(dt => { update(dt); draw(); });
    const mult = await mg.done;
    return typeof mult === 'number' ? mult : 1;
  }

  window.throwBrickMinigame = throwBrickMinigame;
  window.KMGBrick = { play: throwBrickMinigame, GRADES };
})();
