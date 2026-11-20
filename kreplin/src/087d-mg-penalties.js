/* ===================== KREPLIN — Penalties (Ultima Cup + World Cup final) =====================
   Drop-in replacements (same names, signatures, return contracts as src/038):
     window.playPenaltyMinigame(opponentName='Delmor Krunchem', opponentTeam='Portsmouth')
        -> 'us' | 'portsmouth' | 'legends' | 'ultima'
        Power-ups (same checks + same state effects as before): HGH (S.doctor.hgh_stock / S.inventory.hgh),
        cocaine (S.inventory.drugs / S.cocaine), brick (S.inventory.brick / S.brick) — KOs the keeper for one kick.
     window.playWorldCupPenalties(opponentNation) -> 'us' | 'them' | 'erotic_breasts' (10 tied sudden-death rounds)
   Controls
     YOUR KICK : swipe from the ball toward the goal. Direction = aim, swipe length = power (height),
                 bow the swipe to bend it ("CURLER" beats the keeper's fingertips). Keys: arrows aim, Z/X bend,
                 hold SPACE and release in the green. Items: tap icons or 1/2/3.
     THEIR KICK: swipe / tap left-centre-right (or ←/↑/→) to dive. Watch the thought bubble (can lie) and the
                 kicker's hips just before contact (never lies). Commit too early and he may switch sides.
   Needs: mgkit.js. Art from MG_ART_BASE (default '../../art/raw/').
*/
(function () {
  const ART = () => (window.MG_ART_BASE || '../../art/raw/');
  const RED = '#d71920', GOLD = '#f2c14e', INK = '#0d1016', WHITE = '#f4f1ea', GOOD = '#3fbf6b', BAD = '#e5484d';
  const L = 30, R = 150, BAR = 72, LINE = 132, GH = LINE - BAR, CX = 90; // goal geometry (logical px)
  const SPOT = { x: 90, y: 250 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const callLog = html => { try { if (typeof log === 'function') { log(''); log(html); } } catch (e) {} };
  const box = (c, bg, txt) => `<div style="padding:15px;background:${bg};border:2px solid ${c};border-radius:10px;margin:10px 0;">
              <p style="text-align:center;color:${c};font-weight:bold;">${txt}</p>
            </div>`;
  const GREEN_BOX = t => box('#0f0', 'rgba(0,255,0,0.2)', t), RED_BOX = t => box('#f00', 'rgba(255,0,0,0.2)', t);
  const SUDDEN_HTML = `<div style="padding:20px;background:rgba(200,200,0,0.2);border:2px solid #ff0;border-radius:10px;margin:20px 0;">
            <p style="text-align:center;color:#ff0;font-size:1.2rem;font-weight:bold;">SUDDEN DEATH!</p>
          </div>`;

  // ---------- palette swap: recolour pixels matching `match(r,g,b)` to `col`, keeping shading ----------
  function recolor(img, match, col) {
    if (!img) return null;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    let d; try { d = x.getImageData(0, 0, c.width, c.height); } catch (e) { return img; } // file:// taint -> no swap
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2];
      if (match(r, g, b)) {
        const l = Math.min(1.35, (Math.max(r, g, b) / 200));
        p[i] = clamp(col[0] * l, 0, 255); p[i + 1] = clamp(col[1] * l, 0, 255); p[i + 2] = clamp(col[2] * l, 0, 255);
      }
    }
    x.putImageData(d, 0, 0); return c;
  }
  const isBlue = (r, g, b) => b > r + 30 && b > g + 15;
  const isGreen = (r, g, b) => g > r + 25 && g > b + 25;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  const NATION_KITS = {
    brazil: ['#ffd400', '#1d7a3a'], argentina: ['#75b8ec', '#ffffff'], france: ['#1f3a8a', '#ffffff'], germany: ['#f0f0f0', '#111111'],
    spain: ['#c8102e', '#ffcc00'], italy: ['#1f6fd1', '#ffffff'], portugal: ['#7a0f1d', '#1f7a3a'], netherlands: ['#ff7a00', '#ffffff'],
    england: ['#f0f0f0', '#1f2a6a'], belgium: ['#b0101a', '#111111'], croatia: ['#e01a1a', '#ffffff'], uruguay: ['#7ab8e8', '#111111'],
    mexico: ['#1f7a3a', '#ffffff'], usa: ['#f0f0f0', '#1f2a6a'], japan: ['#1f2a8a', '#ffffff'], morocco: ['#c1121f', '#1f7a3a'],
    senegal: ['#f0f0f0', '#1f8a3a'], nigeria: ['#1f8a3a', '#ffffff'], scotland: ['#1f2a6a', '#ffffff'], wales: ['#c8102e', '#ffffff'],
  };
  function nationKit(name) {
    const k = NATION_KITS[String(name || '').toLowerCase().trim()];
    if (k) return k;
    let h = 0; for (const ch of String(name || 'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360; return [`hsl(${hue},70%,45%)`, '#ffffff'];
  }
  function cssToRgb(css) { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; const v = c.fillStyle; return v.startsWith('#') ? hex(v) : (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number); }

  // =====================================================================================
  // Core shootout. cfg: { title, usLabel, themLabel, usKickers[], themKickers[], themKit, usPortrait, themPortrait,
  //   themSkill:{honest, miss}, items:{hgh,coke,brick}, onItem(name), maxSudden, logUs(name,ok,saved), logThem(ok,saved) }
  // resolves 'us' | 'them' | 'tie' | 'giveup'
  // =====================================================================================
  async function runShootout(cfg) {
    const mg = MGKit.open({ title: cfg.title || 'PENALTIES', w: 180, h: 320, giveUpAfter: 150, giveUpLabel: 'Bottle it', onGiveUp: () => 'them' });
    const sp = mg.sprites;
    await mg.load({
      crowd: ART() + 'mg-pen-crowd.png', kIdle: ART() + 'mg-pen-keeper-idle.png', kDive: ART() + 'mg-pen-keeper-dive.png',
      kKO: ART() + 'mg-pen-keeper-ko.png', kickUs: ART() + 'mg-pen-kicker-us.png', kickThem: ART() + 'mg-pen-kicker-them.png',
      ball: ART() + 'mg-pen-ball.png', hgh: ART() + 'mg-pen-hgh.png', coke: ART() + 'mg-pen-coke.png', brick: ART() + 'mg-pen-brick.png',
      pUs: cfg.usPortrait || (ART() + 'chairman.png'), pThem: cfg.themPortrait || '',
    });
    // tinted variants
    const themKit = cssToRgb(cfg.themKit || '#24407a');
    sp.kickThemT = cfg.themKit ? recolor(sp.kickThem, isBlue, themKit) : sp.kickThem;
    const ourGK = [255, 95, 162];
    sp.kIdleUs = recolor(sp.kIdle, isGreen, ourGK); sp.kDiveUs = recolor(sp.kDive, isGreen, ourGK);
    const flip = img => { if (!img) return null; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0); return c; };
    sp.kDiveL = flip(sp.kDive); sp.kDiveUsL = flip(sp.kDiveUs);

    const { ctx, input } = mg;
    const S0 = { us: [], them: [] };
    let sudden = false, sdRounds = 0, decidedResult = null;
    let usIdx = 0, themIdx = 0;
    let drugged = false; const used = { hgh: false, coke: false, brick: false };
    const items = [];
    if (cfg.items) {
      if (cfg.items.hgh) items.push({ id: 'hgh', label: 'HGH', key: '1' });
      if (cfg.items.coke) items.push({ id: 'coke', label: 'COKE', key: '2' });
      if (cfg.items.brick) items.push({ id: 'brick', label: 'BRICK', key: '3' });
    }
    items.forEach((it, i) => { it.x = 6 + i * 30; it.y = 288; it.w = 26; it.h = 28; });

    // ---------- scene state ----------
    let phase = 'intro', pt = 0, firstHint = true;
    const keeper = { x: CX, y: LINE, side: 0, dive: null, diveT: 0, ko: false, plan: 0, tell: 0, ours: false, h: 0 };
    const ball = { x: SPOT.x, y: SPOT.y, s: 1, vis: true, fly: null };
    const kicker = { x: 0, y: 0, t: 0, lean: 0 };
    let aim = null, kb = { on: false, x: CX, h: 28, bend: 0, charging: false, pow: 0, dir: 1 };
    let shot = null, flashes = [], crowdJump = 0, net = null, brickFx = null, tint = 0, msg = null;
    let themShot = null, dive = null, diveAt = -1;
    const dbg = window.__penDebug = { phase: () => phase, keeper, get themShot() { return themShot; }, score: S0, get sudden() { return sudden; }, get pt() { return pt; }, items };

    function say(t, c, s) { msg = { t, c: c || WHITE, s: s || 1.4 }; }

    // ---------- decision logic ----------
    function check() {
      const u = S0.us.filter(Boolean).length, th = S0.them.filter(Boolean).length, nu = S0.us.length, nt = S0.them.length;
      if (!sudden) {
        if (u + (5 - nu) < th) return 'them';
        if (th + (5 - nt) < u) return 'us';
        if (nu >= 5 && nt >= 5) { sudden = true; callLog(SUDDEN_HTML); mg.banner('SUDDEN DEATH!', GOLD, 1.6); mg.shake(3, .4); }
        return null;
      }
      if (nu === nt) {
        if (u > th) return 'us'; if (th > u) return 'them';
        sdRounds++; if (cfg.maxSudden && sdRounds >= cfg.maxSudden) return 'tie';
      }
      return null;
    }

    // ---------- starting each kick ----------
    function startUs() {
      phase = 'usAim'; pt = 0; aim = null; shot = null; kb.charging = false; kb.pow = 0;
      Object.assign(ball, { x: SPOT.x, y: SPOT.y, s: 1, vis: true, fly: null, bounce: null });
      Object.assign(kicker, { x: SPOT.x - 26, y: SPOT.y + 50, t: 0 });
      keeper.ours = false; keeper.ko = false; keeper.dive = null; keeper.diveT = 0; keeper.x = CX;
      const r = Math.random(); keeper.plan = r < .4 ? -1 : r < .8 ? 1 : 0;
      const honest = Math.random() < .8;
      keeper.tell = honest ? keeper.plan : (keeper.plan === 0 ? (Math.random() < .5 ? -1 : 1) : -keeper.plan);
    }
    function startThem() {
      phase = 'themAim'; pt = 0; dive = null; diveAt = -1;
      Object.assign(ball, { x: SPOT.x, y: SPOT.y, s: 1, vis: true, fly: null, bounce: null });
      Object.assign(kicker, { x: SPOT.x - 30, y: SPOT.y + 52, t: 0, lean: 0 });
      keeper.ours = true; keeper.ko = false; keeper.dive = null; keeper.diveT = 0; keeper.x = CX;
      const sk = cfg.themSkill || { honest: .7, miss: .12 };
      const r = Math.random(); const side = r < .42 ? -1 : r < .84 ? 1 : 0;
      themShot = { side, gx: CX + side * rnd(26, 50), h: side === 0 ? rnd(10, 40) : rnd(6, 50), bubble: Math.random() < sk.honest ? side : [-1, 0, 1].filter(s => s !== side)[Math.random() < .5 ? 0 : 1], miss: Math.random() < sk.miss, switched: false };
      if (themShot.miss) { if (Math.random() < .5) themShot.gx = CX + (side || 1) * rnd(64, 74); else themShot.h = rnd(64, 74); }
    }

    // ---------- launching a ball ----------
    function launch(gx, h, bend, p, isUs) {
      const dur = (0.62 - clamp(p, 0, 1) * 0.24) * (isUs && drugged ? 0.75 : 1);
      ball.fly = { sx: SPOT.x, sy: SPOT.y, ex: gx, ey: LINE - h, cx: (SPOT.x + gx) / 2 + bend * 2.2, cy: (SPOT.y + LINE - h) / 2 - 14, t: 0, dur, gx, h, bend, p, isUs };
      phase = 'flight'; pt = 0; mg.shake(1, .1);
      for (let i = 0; i < 8; i++) mg.particles.spawn({ x: SPOT.x, y: SPOT.y + 3, vx: rnd(-30, 30), vy: rnd(-30, -5), g: 120, life: .4, size: 1, color: '#7cd36b' });
      keeper.h = h;
      if (isUs && !keeper.ko) { keeper.dive = keeper.plan; keeper.diveT = 0; } // keeper commits at contact
    }

    function resolveFlight(f) {
      const { gx, h, bend, p, isUs } = f;
      let out;
      if (gx < L - 2 || gx > R + 2) out = 'wide';
      else if (h > GH + 2) out = 'over';
      else if (Math.abs(gx - L) < 3 || Math.abs(gx - R) < 3 || Math.abs(h - GH) < 2.5) out = 'post';
      else if (keeper.ko) out = 'goal';
      else {
        const s = keeper.dive == null ? 0 : keeper.dive; let reach = s ? 22 : keeper.dive === 0 ? 24 : 20, hmax = s ? 44 : keeper.dive === 0 ? 60 : 54;
        const kx = CX + s * 36 * ease(clamp(keeper.diveT / .32, 0, 1));
        if (isUs && Math.abs(bend) > 8) reach -= 8;
        if (isUs && p < 0.3) reach += 18;
        if (!isUs && s !== 0 && Math.sign(gx - CX) === s && h < 50) { reach += 10; hmax = 50; } // you read it right
        out = (Math.abs(gx - kx) < reach && h < hmax) ? 'saved' : 'goal';
      }
      return out;
    }

    function afterKick(out, isUs, f) {
      const ok = out === 'goal', saved = out === 'saved';
      (isUs ? S0.us : S0.them).push(ok);
      if (isUs) { cfg.logUs(ok, saved); usIdx++; } else { cfg.logThem(ok, saved); themIdx++; }
      const goodForUs = isUs ? ok : !ok;
      const texts = { goal: 'GOAL!', saved: 'SAVED!', wide: 'MISSED!', over: 'ROW Z!', post: 'POST!' };
      let t = texts[out];
      if (isUs && ok && shot && Math.abs(shot.bend) > 8) t = 'CURLER! GOAL!';
      if (isUs && ok && keeper.ko) t = 'GOAL! (HE\'S UNCONSCIOUS)';
      if (!isUs && saved) t = pickS(['SAVED! GET IN!', 'WHAT A SAVE!', 'SAVED! SUCK IT!']);
      mg.banner(t, goodForUs ? GOOD : BAD, 1.2);
      if (ok) {
        mg.shake(isUs ? 4 : 2, .35); crowdJump = 1; net = { x: f.gx, h: f.h, t: .6 };
        const cols = isUs ? [RED, WHITE, GOLD] : ['#7a8ab8', '#c9c4b6'];
        for (let i = 0; i < 40; i++) mg.particles.spawn({ x: rnd(0, 180), y: rnd(20, 60), vx: rnd(-20, 20), vy: rnd(-10, 30), g: 40, life: rnd(.8, 1.6), size: 2, color: cols[i % cols.length] });
        if (isUs) mg.flash('#fff', .15);
      } else if (out === 'post') { mg.shake(3, .2); mg.flash('#fff', .08); }
      else if (saved) { mg.shake(2, .2); if (!isUs) { crowdJump = 1; for (let i = 0; i < 24; i++) mg.particles.spawn({ x: ball.x, y: ball.y, vx: rnd(-60, 60), vy: rnd(-60, 10), g: 90, life: .7, size: 2, color: i % 2 ? RED : WHITE }); } }
      phase = 'result'; pt = 0;
      decidedResult = check();
    }
    const pickS = a => a[Math.floor(Math.random() * a.length)];

    // ---------- items ----------
    function useItem(it) {
      if (phase !== 'usAim' || aim) return;
      if (it.id === 'brick') {
        if (used.brick || keeper.ko) return;
        used.brick = true; cfg.onItem('brick');
        brickFx = { t: 0 }; say('LOBBING MASONRY...', GOLD, 1);
      } else {
        if (used[it.id]) return; used[it.id] = true; cfg.onItem(it.id); drugged = true; tint = 1;
        mg.flash(it.id === 'hgh' ? '#5f5' : '#fff', .4); mg.shake(2, .3);
        mg.banner(it.id === 'hgh' ? 'HGH: THIGHS LIKE HAMS' : 'COCAINE: FOCUS +900%', it.id === 'hgh' ? GOOD : WHITE, 1.3);
      }
    }

    // ---------- drawing ----------
    let tt = 0;
    function drawScene() {
      // sky + stands
      ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, 180, 320);
      if (sp.crowd) ctx.drawImage(sp.crowd, 6, 8, 180, 62, 0, 30 - Math.round(crowdJump * 3 * Math.abs(Math.sin(tt * 18))), 180, 62);
      // camera flashes
      if (Math.random() < .25) flashes.push({ x: rnd(4, 176), y: rnd(36, 86), t: .12 });
      flashes = flashes.filter(f => (f.t -= 1 / 60) > 0); ctx.fillStyle = '#fff'; flashes.forEach(f => ctx.fillRect(f.x | 0, f.y | 0, 1, 1));
      // ad boards
      ctx.fillStyle = RED; ctx.fillRect(0, 88, 180, 12); ctx.fillStyle = '#9e0f15'; ctx.fillRect(0, 99, 180, 1);
      mg.text('KREPLIN  *  BET RESPONSIBLY  *  KREPLIN', 90 - ((tt * 20) % 40), 94, { size: 7, color: WHITE, shadow: false });
      // grass with perspective stripes
      for (let i = 0; i < 12; i++) { const y0 = 100 + Math.pow(i / 12, 1.6) * 220, y1 = 100 + Math.pow((i + 1) / 12, 1.6) * 220;
        ctx.fillStyle = i % 2 ? '#2a9a47' : '#33ad52'; ctx.fillRect(0, y0 | 0, 180, Math.ceil(y1 - y0)); }
      // lines: goal line, six-yard box, box, spot
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(0, LINE, 180, 1);
      line(18, LINE, 8, 162); line(162, LINE, 172, 162); ctx.fillRect(8, 162, 165, 1);
      line(4, 112, -30, 320); line(176, 112, 210, 320);
      ctx.fillRect(SPOT.x - 1, SPOT.y + 2, 3, 2);
      // goal: net
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(L, BAR, R - L, GH);
      ctx.strokeStyle = 'rgba(230,230,230,.35)'; ctx.lineWidth = 1;
      for (let x = L; x <= R; x += 6) { ctx.beginPath(); ctx.moveTo(x + .5, BAR); ctx.lineTo(x + .5 + netOff(x, BAR + GH / 2), LINE); ctx.stroke(); }
      for (let y = BAR; y <= LINE; y += 6) { ctx.beginPath(); ctx.moveTo(L, y + .5); ctx.lineTo(R, y + .5 + netOff(CX, y) * .3); ctx.stroke(); }
      // posts
      ctx.fillStyle = '#fff'; ctx.fillRect(L - 3, BAR - 3, 3, GH + 3); ctx.fillRect(R, BAR - 3, 3, GH + 3); ctx.fillRect(L - 3, BAR - 3, R - L + 6, 3);
      ctx.fillStyle = '#9aa'; ctx.fillRect(L - 1, BAR, 1, GH); ctx.fillRect(R + 2, BAR, 1, GH);
    }
    function line(x0, y0, x1, y1) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(x0 + .5, y0 + .5); ctx.lineTo(x1 + .5, y1 + .5); ctx.stroke(); }
    function netOff(x, y) { if (!net) return 0; const d = Math.hypot(x - net.x, y - (LINE - net.h)); return d < 22 ? -Math.sin(net.t * 20) * (22 - d) / 6 * net.t : 0; }

    function drawKeeper() {
      const k = keeper, ours = k.ours;
      if (k.ko && sp.kKO) { ctx.drawImage(sp.kKO, k.x - 30, LINE - 40, 60, 60); return; }
      if (k.dive && k.dive !== 0) {
        const t = ease(clamp(k.diveT / .32, 0, 1));
        const x = lerp(CX, CX + k.dive * 36, t), lift = Math.min(k.h * .6, 24) * Math.sin(t * Math.PI * .9);
        const img = k.dive > 0 ? (ours ? sp.kDiveUs : sp.kDive) : (ours ? sp.kDiveUsL : sp.kDiveL);
        if (img) ctx.drawImage(img, x - 26, LINE - 38 - lift, 52, 52);
        k.x = x; return;
      }
      if (k.dive === 0) { // stand tall: jump up
        const lift = Math.sin(clamp(k.diveT / .4, 0, 1) * Math.PI) * 8; const img = ours ? sp.kIdleUs : sp.kIdle;
        if (img) ctx.drawImage(img, CX - 26, LINE - 50 - lift, 52, 52); return;
      }
      // idle with tell (our kick) or bounce (their kick)
      const bob = Math.sin(tt * 7) * 1;
      const lean = (!ours && (phase === 'usAim' || phase === 'usRun')) ? k.tell : 0;
      const sway = lean ? Math.sin(tt * 3) * .5 + .5 : 0;
      ctx.save(); ctx.translate(CX + lean * (2 + sway * 3), LINE - 2);
      ctx.rotate(lean * (.10 + sway * .1));
      const img = ours ? sp.kIdleUs : sp.kIdle; if (img) ctx.drawImage(img, -26, -48 + bob, 52, 52);
      ctx.restore();
      if (lean && Math.random() < .08) mg.particles.spawn({ x: CX + lean * 10, y: LINE - 1, vx: lean * 10, vy: -6, life: .4, size: 1, color: '#c9e6b0' });
    }

    function drawBall() {
      if (!ball.vis) return;
      const r = 5.5 * ball.s;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(ball.x, ball.fly ? lerp(SPOT.y + 4, LINE + 1, ball.fly.t) : ball.y + 4, r, r * .4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, r - .3, 0, 7); ctx.fill();
      if (sp.ball) { ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.fly ? ball.fly.t * 12 : 0); ctx.drawImage(sp.ball, -r - .4, -r - .4, r * 2 + .8, r * 2 + .8); ctx.restore(); }
    }

    function drawKicker(isUs) {
      const img = isUs ? sp.kickUs : sp.kickThemT; if (!img) return;
      ctx.save(); ctx.translate(kicker.x, kicker.y);
      if (!isUs) ctx.rotate(kicker.lean * .18);
      const sq = kicker.t > 0 && kicker.t < .1 ? 0.9 : 1;
      ctx.scale(1 / sq * 1, sq);
      ctx.drawImage(img, -32, -62, 64, 64); ctx.restore();
    }

    function drawHUD() {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, 180, 30); ctx.fillStyle = RED; ctx.fillRect(0, 29, 180, 1);
      if (sp.pUs) ctx.drawImage(sp.pUs, 2, 2, 22, 22);
      if (sp.pThem) ctx.drawImage(sp.pThem, 156, 2, 22, 22); else { ctx.fillStyle = cfg.themKit || '#24407a'; ctx.fillRect(158, 4, 18, 12); ctx.fillStyle = (cfg.themKit2 || '#fff'); ctx.fillRect(158, 16, 18, 6); }
      const u = S0.us.filter(Boolean).length, th = S0.them.filter(Boolean).length;
      mg.text(`${u} - ${th}`, 90, 10, { size: 12, color: GOLD });
      mg.text(cfg.usLabel, 27, 7, { size: 6, align: 'left', color: WHITE });
      mg.text(cfg.themLabel, 153, 7, { size: 6, align: 'right', color: WHITE });
      const dots = (arr, x0, dir) => { const n = Math.max(5, arr.length), st = Math.max(0, n - 5);
        for (let i = 0; i < 5; i++) { const v = arr[st + i], x = x0 + dir * i * 7;
          ctx.fillStyle = '#2e3547'; ctx.fillRect(x, 17, 5, 5);
          if (v === true) { ctx.fillStyle = GOOD; ctx.fillRect(x, 17, 5, 5); } else if (v === false) { ctx.fillStyle = BAD; ctx.fillRect(x + 1, 18, 3, 3); ctx.fillRect(x, 17, 1, 1); ctx.fillRect(x + 4, 17, 1, 1); ctx.fillRect(x, 21, 1, 1); ctx.fillRect(x + 4, 21, 1, 1); } } };
      dots(S0.us, 27, 1); dots(S0.them, 148, -1);
      mg.text(sudden ? 'SUDDEN DEATH' : `ROUND ${Math.min(5, Math.max(S0.us.length, S0.them.length) + (phase.startsWith('us') ? 1 : 0))}/5`, 90, 23, { size: 6, color: sudden ? BAD : '#8c93a8', shadow: false });
    }

    function drawItems() {
      items.forEach(it => {
        const spent = it.id === 'brick' ? (used.brick || keeper.ko) : used[it.id];
        const live = phase === 'usAim' && !aim && !spent;
        ctx.fillStyle = spent ? '#181c26' : '#242a3a'; ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = live ? GOLD : '#3a4258'; ctx.fillRect(it.x, it.y, it.w, 1); ctx.fillRect(it.x, it.y + it.h - 1, it.w, 1); ctx.fillRect(it.x, it.y, 1, it.h); ctx.fillRect(it.x + it.w - 1, it.y, 1, it.h);
        ctx.globalAlpha = spent ? .3 : 1; const img = sp[it.id]; if (img) ctx.drawImage(img, it.x + 3, it.y + 1 + (live ? Math.round(Math.sin(tt * 5 + it.x)) : 0), 20, 20); ctx.globalAlpha = 1;
        mg.text(it.label, it.x + it.w / 2, it.y + it.h - 4, { size: 5, color: spent ? '#555' : WHITE, shadow: false });
      });
      if (drugged) { mg.text('JUICED', 172, 296, { size: 6, color: GOOD, align: 'right' }); }
    }

    // predicted target from a swipe
    function swipeTarget(pts) {
      const a = pts[0], b = pts[pts.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      let bulge = 0;
      for (const q of pts) { const d = ((q.x - a.x) * dy - (q.y - a.y) * dx) / (len || 1); if (Math.abs(d) > Math.abs(bulge)) bulge = d; }
      bulge = -bulge; // positive = bows to the right
      const p = clamp((len - 25) / 140, 0, 1.3);
      const h = p * 66 * (drugged ? 0.82 : 1);
      const gx = CX + (dx / Math.max(8, -dy)) * 118 + bulge * 1.1;
      return { gx, h, bend: clamp(bulge, -20, 20), p, len, dy };
    }

    function shoot(t) {
      shot = t; phase = 'usRun'; pt = 0;
      if (firstHint) firstHint = false;
    }

    // ================= main loop =================
    mg.loop((dt) => {
      tt += dt; pt += dt;
      if (crowdJump > 0) crowdJump = Math.max(0, crowdJump - dt * .7);
      if (net) { net.t -= dt; if (net.t <= 0) net = null; }
      if (tint > 0) tint = Math.max(0, tint - dt * .5);
      if ((phase === 'flight' || phase === 'result') && keeper.dive != null) keeper.diveT += dt;

      // --------- update ----------
      if (phase === 'intro') { if (pt < .05) mg.banner(cfg.introBanner || 'PENALTIES!', GOLD, 1.4); if (pt > 1.5) startUs(); }

      else if (phase === 'usAim') {
        // items
        if (input.tap) for (const it of items) if (input.tap.x >= it.x && input.tap.x <= it.x + it.w && input.tap.y >= it.y && input.tap.y <= it.y + it.h) useItem(it);
        items.forEach(it => { if (input.keyPressed(it.key)) useItem(it); });
        if (brickFx) {
          brickFx.t += dt;
          if (brickFx.t > .55 && !keeper.ko) { keeper.ko = true; mg.shake(5, .35); mg.flash('#fff', .2); mg.banner('KEEPER DOWN!', GOLD, 1.3);
            for (let i = 0; i < 20; i++) mg.particles.spawn({ x: CX, y: LINE - 30, vx: rnd(-50, 50), vy: rnd(-60, 0), g: 140, life: .6, size: 2, color: i % 3 ? '#b5523b' : '#ffe08a' }); }
          if (brickFx.t > .9) brickFx = null;
        }
        // swipe aim
        if (!brickFx) {
          if (input.pressed && Math.hypot(input.x - SPOT.x, input.y - SPOT.y) < 36) aim = { pts: [{ x: input.x, y: input.y }] };
          if (aim && input.down) { const l = aim.pts[aim.pts.length - 1]; if (Math.hypot(input.x - l.x, input.y - l.y) > 1) aim.pts.push({ x: input.x, y: input.y }); }
          if (aim && input.released) {
            aim.pts.push({ x: input.x, y: input.y });
            const t = swipeTarget(aim.pts);
            if (t.len > 14 && t.dy < -8) shoot(t); else say('SWIPE UP AT THE GOAL, CHAIRMAN', GOLD, 1.2);
            aim = null;
          }
          // keyboard aim
          const K = input.keys;
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'z', 'x'].some(k => K.has(k))) kb.on = true;
          if (K.has('ArrowLeft')) kb.x -= 60 * dt; if (K.has('ArrowRight')) kb.x += 60 * dt;
          if (K.has('ArrowUp')) kb.h += 40 * dt; if (K.has('ArrowDown')) kb.h -= 40 * dt;
          kb.x = clamp(kb.x, L - 12, R + 12); kb.h = clamp(kb.h, 2, GH + 6);
          if (input.keyPressed('z')) kb.bend = clamp(kb.bend - 10, -20, 20); if (input.keyPressed('x')) kb.bend = clamp(kb.bend + 10, -20, 20);
          if (input.keyPressed(' ')) { kb.charging = true; kb.pow = 0; kb.dir = 1; }
          if (kb.charging) { kb.pow += kb.dir * dt * (drugged ? .8 : 1.4); if (kb.pow > 1) { kb.pow = 1; kb.dir = -1; } if (kb.pow < 0) { kb.pow = 0; kb.dir = 1; } }
          if (kb.charging && !K.has(' ')) {
            kb.charging = false; const err = (kb.pow - .7) * 50; // sweet spot at 70%
            const p = clamp(kb.h / 66 + Math.max(0, err) / 66, 0, 1.3);
            shoot({ gx: kb.x + rnd(-2, 2), h: clamp(kb.h + err * (drugged ? .5 : 1), 0, 90), bend: kb.bend, p: kb.pow < .25 ? .2 : p, len: 0, dy: -1 });
          }
        }
      }

      else if (phase === 'usRun') {
        kicker.t = pt; const t = clamp(pt / .35, 0, 1);
        kicker.x = lerp(SPOT.x - 26, SPOT.x - 10, t); kicker.y = lerp(SPOT.y + 50, SPOT.y + 12, t);
        if (pt >= .35) launch(shot.gx, shot.h, shot.bend, shot.p, true);
      }

      else if (phase === 'themAim') {
        if (pt > 1.4) { phase = 'themRun'; pt = 0; }
        readDive();
      }
      else if (phase === 'themRun') {
        const t = clamp(pt / .7, 0, 1); kicker.x = lerp(SPOT.x - 30, SPOT.x - 10, t); kicker.y = lerp(SPOT.y + 52, SPOT.y + 12, t);
        if (pt > .45) kicker.lean = lerp(kicker.lean, themShot.side, .2);
        readDive();
        if (pt >= .7) {
          if (dive !== null && diveAt < .45 && !themShot.switched && Math.random() < .35 && themShot.side !== 0) { themShot.side = -themShot.side; themShot.gx = CX + (themShot.gx - CX) * -1; themShot.switched = true; }
          launch(themShot.gx, themShot.h, 0, .6, false);
          keeper.dive = dive; keeper.diveT = 0;
        }
      }

      else if (phase === 'flight') {
        const f = ball.fly; f.t = Math.min(1, f.t + dt / f.dur);
        if (!f.isUs) readDive();
          const t = f.t, it = 1 - t;
        ball.x = it * it * f.sx + 2 * it * t * f.cx + t * t * f.ex; ball.y = it * it * f.sy + 2 * it * t * f.cy + t * t * f.ey; ball.s = lerp(1, .55, t);
        if (f.isUs && drugged && Math.random() < .6) mg.particles.spawn({ x: ball.x, y: ball.y, life: .25, size: 1, color: '#9f9' });
        if (f.t >= 1) {
          const out = resolveFlight(f);
          if (out === 'saved' || out === 'post') { ball.fly = null; ball.bounce = { vx: (ball.x - CX) * 1.5 + rnd(-20, 20), vy: 70 }; }
          else if (out === 'goal') { ball.fly = null; ball.bounce = null; ball.y = Math.min(LINE - 4, ball.y); }
          else { ball.fly = null; ball.bounce = { vx: (ball.x - CX) * 2, vy: -60, away: true }; }
          afterKick(out, f.isUs, f);
        }
      }

      else if (phase === 'result') {
        if (ball.bounce) { ball.x += ball.bounce.vx * dt; ball.y += ball.bounce.vy * dt; ball.bounce.vy += (ball.bounce.away ? 0 : 160) * dt; if (ball.bounce.away) ball.s *= .985; }
        if (pt > 1.6) {
          if (decidedResult) { phase = 'final'; pt = 0;
            const win = decidedResult === 'us';
            if (decidedResult === 'tie') mg.banner('STILL LEVEL. FIFA CONVENES...', GOLD, 2.2);
            else mg.banner(win ? (cfg.winBanner || 'YOU WIN THE SHOOTOUT!') : `${(cfg.themShort || cfg.themLabel).toUpperCase()} WIN IT`, win ? GOLD : BAD, 2.2);
            if (win) { mg.flash(GOLD, .4); for (let i = 0; i < 80; i++) mg.particles.spawn({ x: rnd(0, 180), y: rnd(-10, 40), vx: rnd(-20, 20), vy: rnd(20, 60), life: 2, size: 2, color: [RED, WHITE, GOLD][i % 3] }); }
            else mg.shake(3, .5);
          } else if (S0.us.length > S0.them.length) startThem(); else startUs();
        }
      }
      else if (phase === 'final') { if (pt > 2.4) { mg.end(decidedResult); return; } }

      // --------- draw ----------
      drawScene();
      drawKeeper();
      if (brickFx) { const t = clamp(brickFx.t / .55, 0, 1); const bx = lerp(20, CX, t), by = lerp(300, LINE - 34, t) - Math.sin(t * Math.PI) * 50;
        if (t < 1 && sp.brick) { ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 12); ctx.drawImage(sp.brick, -8, -8, 16, 16); ctx.restore(); } }
      if (keeper.ko && phase !== 'intro') { for (let i = 0; i < 3; i++) { const a = tt * 4 + i * 2.1; mg.text('*', keeper.x + Math.cos(a) * 12, LINE - 24 + Math.sin(a) * 3, { size: 8, color: GOLD, shadow: false }); } }
      const isUsKick = phase === 'usAim' || phase === 'usRun' || (ball.fly && ball.fly.isUs) || (phase === 'result' && S0.us.length > S0.them.length);
      // ball before kicker if ball is far (in flight) so it draws over goal
      drawKicker(isUsKick);
      drawBall();
      // their-kick thought bubble
      if (phase === 'themAim' || (phase === 'themRun' && pt < .3)) {
        const bx = kicker.x + 22, by = kicker.y - 86; ctx.fillStyle = '#fff'; ctx.fillRect(bx - 16, by - 10, 32, 20); ctx.fillRect(bx - 14, by - 12, 28, 24);
        ctx.fillRect(kicker.x + 8, kicker.y - 66, 3, 3); ctx.fillRect(kicker.x + 12, kicker.y - 72, 4, 4);
        ctx.fillStyle = '#222'; ctx.fillRect(bx - 11, by - 6, 22, 1); ctx.fillRect(bx - 11, by - 6, 1, 12); ctx.fillRect(bx + 10, by - 6, 1, 12);
        const b = themShot.bubble; ctx.fillStyle = BAD; ctx.fillRect(bx + b * 7 - 2, by + 1, 4, 4);
      }
      // aim trail
      if (phase === 'usAim' && aim && aim.pts.length > 1) {
        const t = swipeTarget(aim.pts.concat([{ x: input.x, y: input.y }]));
        ctx.fillStyle = 'rgba(255,255,255,.8)'; aim.pts.forEach((q, i) => { if (i % 2 === 0) ctx.fillRect(q.x | 0, q.y | 0, 2, 2); });
        // power bar next to ball
        const over = t.h > GH, hot = t.h > GH * .78;
        ctx.fillStyle = '#000'; ctx.fillRect(SPOT.x + 14, SPOT.y - 26, 6, 32);
        ctx.fillStyle = over ? BAD : hot ? GOLD : GOOD; const ph = clamp(t.h / 80, 0, 1) * 30; ctx.fillRect(SPOT.x + 15, SPOT.y + 5 - ph, 4, ph);
        ctx.fillStyle = '#fff'; ctx.fillRect(SPOT.x + 13, SPOT.y + 5 - GH / 80 * 30, 8, 1);
        if (Math.abs(t.bend) > 8) mg.text('CURL', SPOT.x + 17, SPOT.y + 12, { size: 5, color: GOLD, shadow: false });
        if (drugged) { ctx.fillStyle = 'rgba(160,255,160,.8)'; for (let i = 1; i < 10; i++) { const s = i / 10, it = 1 - s, cx2 = (SPOT.x + t.gx) / 2 + t.bend * 2.2, cy2 = (SPOT.y + LINE - t.h) / 2 - 14;
          ctx.fillRect((it * it * SPOT.x + 2 * it * s * cx2 + s * s * t.gx) | 0, (it * it * SPOT.y + 2 * it * s * cy2 + s * s * (LINE - t.h)) | 0, 1, 1); }
          ctx.strokeStyle = '#9f9'; ctx.strokeRect((t.gx - 3) | 0, (LINE - t.h - 3) | 0, 6, 6); }
      }
      // keyboard reticle
      if (phase === 'usAim' && kb.on) {
        ctx.strokeStyle = kb.h > GH ? BAD : GOLD; ctx.strokeRect((kb.x - 4) | 0 + .5, (LINE - kb.h - 4) | 0 + .5, 8, 8);
        if (kb.bend) mg.text(kb.bend > 0 ? 'BEND >' : '< BEND', kb.x, LINE - kb.h - 9, { size: 5, color: GOLD });
        if (kb.charging) { ctx.fillStyle = '#000'; ctx.fillRect(50, 274, 80, 7); ctx.fillStyle = 'rgba(63,191,107,.6)'; ctx.fillRect(50 + 80 * .62, 274, 80 * .16, 7);
          ctx.fillStyle = GOLD; ctx.fillRect(50 + 80 * kb.pow - 1, 273, 2, 9); }
      }
      // hints
      if (phase === 'usAim' && !aim) {
        const a = (Math.sin(tt * 4) + 1) / 2;
        if (!kb.on) { ctx.fillStyle = `rgba(242,193,78,${.5 + a * .5})`; for (let i = 0; i < 3; i++) ctx.fillRect(SPOT.x - 1, SPOT.y - 14 - i * 6 - a * 4, 3, 3); }
        mg.text(cfg.usKickerName ? cfg.usKickerName(usIdx) : 'YOUR KICK', 90, 140, { size: 7, color: GOLD });
        mg.text(kb.on ? 'ARROWS AIM · Z/X BEND · HOLD SPACE' : 'SWIPE UP FROM THE BALL', 90, 276, { size: 6, color: WHITE });
        if (firstHint) mg.text('watch the keeper lean...', 90, 150, { size: 6, color: '#c9c4b6', bold: false });
      }
      if (phase === 'themAim' || phase === 'themRun') {
        mg.text(cfg.themKickerName ? cfg.themKickerName(themIdx) : 'THEIR KICK', 90, 140, { size: 7, color: BAD });
        mg.text(dive === null ? 'SWIPE ← ↑ → TO DIVE' : (dive < 0 ? 'DIVING LEFT!' : dive > 0 ? 'DIVING RIGHT!' : 'STANDING TALL!'), 90, 276, { size: 7, color: WHITE });
        if (dive === null) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 150, 60, 130); ctx.fillRect(120, 150, 60, 130); }
      }
      if (tint > 0) { ctx.fillStyle = `rgba(120,255,120,${tint * .15})`; ctx.fillRect(0, 30, 180, 290); }
      drawItems();
      drawHUD();
      if (msg) { msg.s -= dt; mg.text(msg.t, 90, 170, { size: 7, color: msg.c }); if (msg.s <= 0) msg = null; }
    });

    function readDive() {
      if (dive !== null) return;
      let d = null;
      const sw = input.swipe;
      if (sw) { if (Math.abs(sw.dx) > Math.abs(sw.dy) * .7) d = sw.dx < 0 ? -1 : 1; else d = 0; }
      else if (input.tap && input.tap.y > 30) d = input.tap.x < 60 ? -1 : input.tap.x > 120 ? 1 : 0;
      const K = input;
      if (K.keyPressed('ArrowLeft') || K.keyPressed('a')) d = -1;
      if (K.keyPressed('ArrowRight') || K.keyPressed('d')) d = 1;
      if (K.keyPressed('ArrowUp') || K.keyPressed('ArrowDown') || K.keyPressed(' ') || K.keyPressed('w') || K.keyPressed('s')) d = 0;
      if (d === null) return;
      dive = d; diveAt = phase === 'themAim' ? 0 : phase === 'themRun' ? pt : 1;
      if (phase === 'flight') { keeper.dive = d; keeper.diveT = 0; }
    }

    return mg.done;
  }

  // ============================ adapters (drop-in) ============================
  window.playPenaltyMinigame = async function playPenaltyMinigame(opponentName = 'Delmor Krunchem', opponentTeam = 'Portsmouth') {
    const S = window.S || {};
    const hasHGH = (S.doctor && S.doctor.hgh_stock > 0) || (S.inventory && S.inventory.hgh > 0);
    const hasCocaine = (S.inventory && S.inventory.drugs > 0) || (S.cocaine && S.cocaine > 0);
    const hasBrick = (S.inventory && S.inventory.brick) || (S.brick && S.brick > 0);
    const loseCode = opponentTeam === 'Portsmouth' ? 'portsmouth' : (opponentTeam === 'Legends FC' ? 'legends' : 'ultima');
    const isVO = /onslaught/i.test(opponentName);
    const kit = opponentTeam === 'Portsmouth' ? null : opponentTeam === 'Legends FC' ? '#6b2fa8' : '#d4a017';
    const surname = String(opponentName).split(' ').slice(-1)[0];
    const r = await runShootout({
      title: 'ULTIMA CUP · PENALTIES', introBanner: 'PENALTY SHOOTOUT!',
      usLabel: 'YOU', themLabel: surname.toUpperCase().slice(0, 12), themShort: surname,
      usPortrait: ART() + 'chairman.png', themPortrait: ART() + (isVO ? 'vanonslaught.png' : 'delmor.png'), themKit: kit,
      themSkill: isVO ? { honest: .6, miss: .08 } : { honest: .72, miss: .14 },
      usKickerName: () => 'YOUR PENALTY', themKickerName: () => `${opponentName.toUpperCase()}'S PENALTY`,
      items: { hgh: !!hasHGH, coke: !!hasCocaine, brick: !!hasBrick },
      onItem(id) {
        if (id === 'hgh') { if (S.doctor) S.doctor.hgh_stock = Math.max(0, (S.doctor.hgh_stock || 0) - 1); if (S.inventory && S.inventory.hgh) S.inventory.hgh = Math.max(0, S.inventory.hgh - 1); }
        if (id === 'coke') { if (S.inventory && S.inventory.drugs) S.inventory.drugs = Math.max(0, S.inventory.drugs - 1); if (S.cocaine) S.cocaine = Math.max(0, (S.cocaine || 0) - 1); }
        if (id === 'brick') { if (S.inventory && S.inventory.brick) S.inventory.brick = false; if (S.brick) S.brick = Math.max(0, (S.brick || 0) - 1); }
      },
      logUs: (ok, saved) => callLog(ok ? GREEN_BOX('⚽ You score!') : RED_BOX(saved ? '🧤 Saved!' : '❌ You miss!')),
      logThem: (ok, saved) => callLog(ok ? RED_BOX(`⚽ ${opponentName} scores!`) : GREEN_BOX(saved ? '🧤 Saved!' : `❌ ${opponentName} misses!`)),
    });
    return r === 'us' ? 'us' : loseCode;
  };

  window.playWorldCupPenalties = async function playWorldCupPenalties(opponentNation) {
    const S = window.S || {};
    let takers = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'];
    if (S.lineup && S.lineup.length >= 5 && Array.isArray(S.squad)) takers = S.lineup.slice(0, 5).map(id => { const p = S.squad.find(q => q.id === id); return p ? p.name : 'Unknown Player'; });
    const club = (typeof getClubName === 'function') ? getClubName() : 'Southampton';
    const [k1, k2] = nationKit(opponentNation);
    let cur = takers[0];
    const r = await runShootout({
      title: 'WORLD CUP FINAL · PENALTIES', introBanner: 'WORLD CUP PENALTIES!', winBanner: 'WORLD CHAMPIONS!',
      usLabel: club.toUpperCase().slice(0, 12), themLabel: String(opponentNation).toUpperCase().slice(0, 12), themShort: opponentNation,
      usPortrait: ART() + 'crest.png', themPortrait: '', themKit: k1, themKit2: k2, themSkill: { honest: .65, miss: .1 },
      usKickerName: i => (cur = takers[i % 5]).toUpperCase() + "'S PENALTY", themKickerName: () => `${String(opponentNation).toUpperCase()}'S PENALTY`,
      items: null, onItem() {}, maxSudden: 10,
      logUs: (ok, saved) => callLog(ok ? GREEN_BOX(`⚽ ${cur} scores!`) : RED_BOX(saved ? '🧤 Saved!' : `❌ ${cur} misses!`)),
      logThem: (ok, saved) => callLog(ok ? RED_BOX(`⚽ ${opponentNation} scores!`) : GREEN_BOX(saved ? '🧤 Saved!' : `❌ ${opponentNation} misses!`)),
    });
    return r === 'us' ? 'us' : r === 'tie' ? 'erotic_breasts' : 'them';
  };

  window.KreplinPenalties = { runShootout, nationKit };
})();
