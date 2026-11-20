/* ===== MatchPitch: tiny top-down pixel pitch for the live match overlay =====
   API:
     const pitch = MatchPitch.mount(containerEl, { home:'Southampton', away:'Everton',
                                                   homeKit:['#d71920','#ffffff'], awayKit:['#274f9e','#ffffff'] });
     pitch.minute(37);               // updates internal clock (used for halftime swap visuals)
     pitch.event({ kind:'GOAL', who:'HOME' });   // GOAL, OWN_GOAL, CARD(card:'RED'|'YELLOW'), FOUL,
                                                 // STRETCHER_INJURY, CRAZY_* (pitch invader), ATMOSPHERE
     pitch.whistle('HALF TIME');     // freezes play with a banner until resume()
     pitch.resume();
     pitch.destroy();
   Purely cosmetic: it never decides outcomes, it only acts out the events it is given. */
(function () {
  const W = 192, H = 120;                       // logical pixels
  const PITCH = { x: 8, y: 14, w: 176, h: 92 }; // playing area inside stands
  const GOAL_H = 20;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // 5-a-side shape (fractions of pitch, attacking right for HOME)
  const SHAPE = [ [0.06, 0.5], [0.28, 0.3], [0.28, 0.7], [0.5, 0.38], [0.52, 0.64] ];

  function mount(container, opts = {}) {
    const homeKit = opts.homeKit || ['#d71920', '#ffffff'];
    const awayKit = opts.awayKit || ['#274f9e', '#ffffff'];
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.className = 'match-pitch';
    canvas.style.cssText = 'width:100%;aspect-ratio:192/120;image-rendering:pixelated;display:block';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const mkTeam = (side, kit) => SHAPE.map(([fx, fy], i) => {
      const hx = side === 'HOME' ? fx : 1 - fx;
      const home = { x: PITCH.x + hx * PITCH.w, y: PITCH.y + fy * PITCH.h };
      return { side, kit, gk: i === 0, home, x: home.x, y: home.y, vx: 0, vy: 0, frame: Math.random() * 4,
               state: 'play', card: null, cardT: 0, gone: false };
    });
    const teams = { HOME: mkTeam('HOME', homeKit), AWAY: mkTeam('AWAY', awayKit) };
    const all = () => teams.HOME.concat(teams.AWAY).filter(p => !p.gone);
    const ball = { x: W / 2, y: PITCH.y + PITCH.h / 2, vx: 0, vy: 0, z: 0, owner: null };
    let possession = Math.random() < 0.5 ? 'HOME' : 'AWAY';
    let banner = null;          // {text, color, t}
    let frozen = false;
    let script = null;          // scripted sequence (goal run etc)
    let extras = [];            // invaders, stretchers
    let crowdHype = 0, flash = 0, minute = 0;
    const crowd = Array.from({ length: 260 }, (_, i) => ({
      x: (i * 7.3) % W, y: i % 2 ? rnd(1, 11) : rnd(H - 11, H - 1),
      c: Math.random() < 0.55 ? homeKit[Math.random() < 0.6 ? 0 : 1] : ['#3a3f52', '#c9c4b6', '#e3b48a'][i % 3], ph: Math.random() * 6
    }));

    const attackDir = side => (side === 'HOME' ? 1 : -1);
    const goalOf = side => ({ x: side === 'HOME' ? PITCH.x + PITCH.w : PITCH.x, y: PITCH.y + PITCH.h / 2 }); // goal they attack
    const opp = side => (side === 'HOME' ? 'AWAY' : 'HOME');

    function giveBall(p) { ball.owner = p; possession = p.side; }
    function kickTo(target, speed = 2.2, loft = 0) {
      const d = Math.max(1, dist(ball, target));
      ball.vx = (target.x - ball.x) / d * speed; ball.vy = (target.y - ball.y) / d * speed; ball.z = loft;
      ball.owner = null;
    }
    function nearest(list, pt) { return list.filter(p => !p.gone && p.state === 'play').sort((a, b) => dist(a, pt) - dist(b, pt))[0]; }

    function kickoff(side) {
      for (const p of all()) { p.x = p.home.x; p.y = p.home.y; p.state = p.state === 'down' ? 'down' : 'play'; }
      ball.x = W / 2; ball.y = PITCH.y + PITCH.h / 2; ball.vx = ball.vy = 0; ball.z = 0;
      const taker = nearest(teams[side].filter(p => !p.gk), ball);
      if (taker) { taker.x = ball.x - 3 * attackDir(side); taker.y = ball.y; giveBall(taker); }
    }
    kickoff(possession);

    // ---------------- simulation ----------------
    let decideT = 0;
    function step(dt) {
      crowdHype = Math.max(0, crowdHype - dt * 0.4);
      flash = Math.max(0, flash - dt * 2);
      if (banner) { banner.t -= dt; if (banner.t <= 0 && !banner.sticky) banner = null; }
      extras = extras.filter(e => e.update(dt) !== false);
      for (const p of all()) { if (p.card) { p.cardT -= dt; if (p.cardT <= 0) p.card = null; } }
      if (frozen) return;
      if (script) { if (script(dt) === false) script = null; return; }

      // ball physics
      if (!ball.owner) {
        ball.x += ball.vx; ball.y += ball.vy; ball.vx *= 0.96; ball.vy *= 0.96; ball.z = Math.max(0, ball.z - dt * 6);
        if (ball.y < PITCH.y + 2 || ball.y > PITCH.y + PITCH.h - 2) ball.vy *= -0.6;
        if (ball.x < PITCH.x + 2 || ball.x > PITCH.x + PITCH.w - 2) ball.vx *= -0.6;
        ball.x = clamp(ball.x, PITCH.x + 1, PITCH.x + PITCH.w - 1); ball.y = clamp(ball.y, PITCH.y + 1, PITCH.y + PITCH.h - 1);
        const grab = nearest(all(), ball);
        if (grab && dist(grab, ball) < 3 && Math.hypot(ball.vx, ball.vy) < 2.4) giveBall(grab);
      } else {
        const o = ball.owner;
        ball.x = o.x + attackDir(o.side) * 2.5; ball.y = o.y + 2; ball.z = 0;
      }

      // decisions for carrier
      decideT -= dt;
      if (ball.owner && decideT <= 0) {
        decideT = rnd(0.5, 1.3);
        const o = ball.owner, mates = teams[o.side].filter(p => p !== o && !p.gone && p.state === 'play');
        const g = goalOf(o.side), toGoal = dist(o, g);
        const presser = nearest(teams[opp(o.side)], o);
        if (toGoal < 45 && Math.random() < 0.35) {                // shot -> saved / wide (real goals come from events)
          const keeper = teams[opp(o.side)].find(p => p.gk);
          kickTo({ x: g.x, y: g.y + rnd(-14, 14) }, 3.2, 1);
          if (keeper && Math.random() < 0.6) setTimeout(() => { if (!ball.owner && !script) giveBall(keeper); }, 260);
          crowdHype = Math.min(1, crowdHype + 0.3);
        } else if (presser && dist(presser, o) < 6 && Math.random() < 0.45) {
          giveBall(presser);                                        // tackle
        } else if (mates.length && Math.random() < 0.6) {
          const fwd = mates.filter(m => (m.x - o.x) * attackDir(o.side) > -10);
          const t = (fwd.length ? fwd : mates)[Math.floor(Math.random() * (fwd.length ? fwd.length : mates.length))];
          kickTo({ x: t.x + attackDir(o.side) * 4, y: t.y }, 2.4);
        }
      }

      // movement
      const bx = ball.x, by = ball.y, shift = (bx - W / 2) * 0.55;
      for (const p of all()) {
        if (p.state !== 'play') continue;
        let tx, ty;
        if (p === ball.owner) { const g = goalOf(p.side); tx = p.x + attackDir(p.side) * 6; ty = p.y + (g.y - p.y) * 0.08 + rnd(-2, 2); }
        else if (p.gk) { const own = goalOf(opp(p.side)); tx = own.x + attackDir(p.side) * 5; ty = clamp(by, own.y - GOAL_H / 2, own.y + GOAL_H / 2); }
        else {
          const chaser = nearest(teams[p.side].filter(q => !q.gk), ball) === p;
          if (chaser && (!ball.owner || ball.owner.side !== p.side)) { tx = bx; ty = by; }
          else { tx = p.home.x + shift + (possession === p.side ? attackDir(p.side) * 12 : -attackDir(p.side) * 4); ty = p.home.y + (by - p.home.y) * 0.25; }
        }
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, sp = p === ball.owner ? 0.42 : 0.55;
        p.vx = d > 1 ? dx / d * Math.min(sp, d) : 0; p.vy = d > 1 ? dy / d * Math.min(sp, d) : 0;
        p.x = clamp(p.x + p.vx, PITCH.x + 1, PITCH.x + PITCH.w - 1); p.y = clamp(p.y + p.vy, PITCH.y + 2, PITCH.y + PITCH.h - 1);
        p.frame += Math.hypot(p.vx, p.vy) * 0.6;
      }
    }

    // ---------------- scripted moments ----------------
    function goalSequence(side, own) {
      const scorerSide = own ? opp(side) : side; // OWN_GOAL: who = conceding team's player; goal goes to the other side
      const attackers = teams[scorerSide].filter(p => !p.gk && !p.gone && p.state === 'play');
      const scorer = attackers.sort((a, b) => (b.x - a.x) * attackDir(scorerSide))[0] || attackers[0];
      if (!scorer) return;
      const g = goalOf(scorerSide);
      giveBall(scorer);
      let phase = 0, t = 0;
      script = dt => {
        t += dt;
        if (phase === 0) { // dribble towards box
          const tx = g.x - attackDir(scorerSide) * 22, ty = g.y + rnd(-6, 6);
          scorer.x += (tx - scorer.x) * 0.08; scorer.y += (ty - scorer.y) * 0.08; scorer.frame += 0.5;
          ball.x = scorer.x + attackDir(scorerSide) * 2.5; ball.y = scorer.y + 2;
          if (t > 0.8) { phase = 1; t = 0; kickTo({ x: g.x + attackDir(scorerSide) * 3, y: g.y + rnd(-6, 6) }, 4, 2); ball.owner = null; }
        } else if (phase === 1) {
          ball.x += ball.vx; ball.y += ball.vy; ball.z = Math.max(0, ball.z - dt * 4);
          if ((ball.x - g.x) * attackDir(scorerSide) >= 2) { ball.vx = ball.vy = 0; phase = 2; t = 0;
            banner = { text: own ? 'OWN GOAL!' : 'GOAL!', color: teams[scorerSide][0].kit[0], t: 2.2 };
            crowdHype = 1; flash = 1; }
        } else if (phase === 2) { // celebration: scorer runs to corner, mates follow
          const corner = { x: g.x - attackDir(scorerSide) * 6, y: PITCH.y + (Math.random() < 0.5 ? 4 : PITCH.h - 4) };
          for (const p of teams[scorerSide]) if (!p.gk && !p.gone) { p.x += (corner.x - p.x) * 0.05; p.y += (corner.y - p.y) * 0.05; p.frame += 0.4; }
          if (t > 2.0) { kickoff(opp(scorerSide)); return false; }
        }
      };
    }

    function cardFor(side, red) {
      const pool = (side ? teams[side] : all()).filter(p => !p.gk && !p.gone && p.state === 'play');
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (!p) return;
      p.card = red ? 'RED' : 'YELLOW'; p.cardT = 2.2;
      banner = { text: red ? 'RED CARD' : 'BOOKED', color: red ? '#e5484d' : '#f2c14e', t: 1.4 };
      if (red) {
        p.state = 'off';
        extras.push({ update(dt) { p.x += attackDir(p.side) * -0.2; p.y += 0.6; if (p.y > H + 4) { p.gone = true; return false; } } });
      }
    }

    function injury(side) {
      const pool = (side ? teams[side] : all()).filter(p => !p.gk && !p.gone && p.state === 'play');
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (!p) return;
      p.state = 'down'; if (ball.owner === p) ball.owner = null;
      const medics = [{ x: W / 2 - 4, y: H - 2 }, { x: W / 2 + 4, y: H - 2 }];
      let phase = 0;
      extras.push({
        medics, p,
        update(dt) {
          if (phase === 0) { for (const m of medics) { m.x += (p.x - m.x) * 0.04; m.y += (p.y - m.y) * 0.04; } if (dist(medics[0], p) < 4) phase = 1; }
          else { for (const m of medics) m.y += 0.5; p.y += 0.5; if (p.y > H + 6) { p.gone = true; return false; } }
        }
      });
    }

    function invader() {
      const v = { x: -4, y: rnd(PITCH.y + 10, PITCH.y + PITCH.h - 10), f: 0, chased: 0 };
      const steward = { x: -20, y: v.y };
      banner = { text: 'PITCH INVADER', color: '#d36bd1', t: 1.6 };
      extras.push({ invader: v, steward, update() {
        v.x += 1.1; v.y += Math.sin(v.x / 9) * 0.9; v.f += 0.6;
        steward.x += 1.0; steward.y += (v.y - steward.y) * 0.05;
        if (v.x > W + 6) return false;
      } });
    }

    function event(ev) {
      if (!ev || !ev.kind) return;
      const side = ev.who === 'HOME' || ev.who === 'AWAY' ? ev.who : null;
      switch (ev.kind) {
        case 'GOAL': if (side) goalSequence(side, false); break;
        case 'OWN_GOAL': if (side) goalSequence(side, true); break;
        case 'GAZ_SHENANIGAN': if (ev.shenaniganType === 'OWN_GOAL') goalSequence('HOME', true); else invader(); break;
        case 'CARD': cardFor(side, String(ev.card || ev.color || '').toUpperCase().includes('RED')); break;
        case 'RED_CARD': case 'DODGY_RED_CARD': cardFor(side, true); break;
        case 'YELLOW_CARD': cardFor(side, false); break;
        case 'SHOT': if (side && !script) { const g = goalOf(side); kickTo({ x: g.x - attackDir(side) * 3, y: g.y + rnd(-16, 16) }, 3.2, 1); } crowdHype = Math.min(1, crowdHype + 0.3); break;
        case 'CORNER': banner = { text: 'CORNER', color: '#ffffff', t: 0.9 }; break;
        case 'DODGY_PENALTY': banner = { text: 'PENALTY?!', color: '#f2c14e', t: 1.4 }; crowdHype = 1; break;
        case 'EARLY_FINAL_WHISTLE': banner = { text: 'WHISTLE?!', color: '#ffffff', t: 1.6 }; break;
        case 'FOUL': banner = { text: 'FOUL!', color: '#f29b2e', t: 1 }; break;
        case 'STRETCHER_INJURY': injury(side); break;
        case 'ATMOSPHERE': crowdHype = Math.min(1, crowdHype + 0.5); break;
        default: if (/^CRAZY_/.test(ev.kind)) invader(); else crowdHype = Math.min(1, crowdHype + 0.2);
      }
    }

    // ---------------- rendering ----------------
    function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
    function drawPitch() {
      px(0, 0, W, H, '#11141b');
      // stands + crowd
      px(0, 0, W, 12, '#1b1f2b'); px(0, H - 12, W, 12, '#1b1f2b');
      const tt = performance.now() / 1000;
      for (const c of crowd) {
        const bob = (crowdHype > 0.2 && Math.sin(tt * 14 + c.ph) > 0.2) ? -1 : 0;
        px(c.x, c.y + bob, 2, 2, c.c);
      }
      // grass stripes
      for (let i = 0; i < 11; i++) px(PITCH.x + i * PITCH.w / 11, PITCH.y, Math.ceil(PITCH.w / 11), PITCH.h, i % 2 ? '#2f9a49' : '#36a852');
      const L = '#e9f5e4';
      // outline
      px(PITCH.x, PITCH.y, PITCH.w, 1, L); px(PITCH.x, PITCH.y + PITCH.h - 1, PITCH.w, 1, L);
      px(PITCH.x, PITCH.y, 1, PITCH.h, L); px(PITCH.x + PITCH.w - 1, PITCH.y, 1, PITCH.h, L);
      px(W / 2, PITCH.y, 1, PITCH.h, L);
      ctx.strokeStyle = L; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(W / 2 + 0.5, PITCH.y + PITCH.h / 2, 11, 0, Math.PI * 2); ctx.stroke();
      const my = PITCH.y + PITCH.h / 2;
      for (const s of [0, 1]) {
        const gx = s ? PITCH.x + PITCH.w - 1 : PITCH.x, dir = s ? -1 : 1;
        const bx = s ? gx - 24 : gx;  // penalty box
        px(bx, my - 22, 25, 1, L); px(bx, my + 22, 25, 1, L); px(s ? gx - 24 : gx + 24, my - 22, 1, 45, L);
        px(s ? gx - 9 : gx, my - 11, 10, 1, L); px(s ? gx - 9 : gx, my + 11, 10, 1, L); px(s ? gx - 9 : gx + 9, my - 11, 1, 23, L);
        // goal net
        for (let y = my - GOAL_H / 2; y <= my + GOAL_H / 2; y += 2) px(gx + (s ? 1 : -4), y, 4, 1, '#cfd6e6');
        px(gx + (s ? 1 : -4), my - GOAL_H / 2, 4, 1, '#ffffff'); px(gx + (s ? 1 : -4), my + GOAL_H / 2, 4, 1, '#ffffff');
        void dir;
      }
    }
    function drawPlayer(p) {
      const x = Math.round(p.x), y = Math.round(p.y);
      const [shirt, alt] = p.kit;
      px(x - 2, y + 4, 5, 1, 'rgba(0,0,0,.35)');                    // shadow
      if (p.state === 'down') { px(x - 3, y + 1, 6, 2, shirt); px(x + 3, y + 1, 2, 2, '#e3b48a'); return; }
      const leg = Math.floor(p.frame) % 2;
      px(x - 1, y - 4, 3, 2, '#e3b48a');                              // head
      px(x - 1, y - 4, 3, 1, '#3b2a20');                              // hair
      if (p.gk) px(x - 1, y - 2, 3, 3, '#2fd47d');
      else { px(x - 1, y - 2, 3, 3, shirt); if (shirt === '#d71920') px(x, y - 2, 1, 3, alt); } // Saints stripes
      px(x - 1, y + 1, 3, 1, '#111');                                 // shorts
      px(x - 1 + leg, y + 2, 1, 2, '#e3b48a'); px(x + 1 - leg, y + 2, 1, 2, '#e3b48a');
      if (p.card) px(x + 2, y - 8, 2, 3, p.card === 'RED' ? '#e5484d' : '#f2c14e');
    }
    function drawBanner() {
      if (!banner) return;
      const a = Math.min(1, banner.t * 2);
      ctx.globalAlpha = a;
      px(0, H / 2 - 11, W, 22, 'rgba(0,0,0,.65)');
      ctx.font = 'bold 14px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000'; ctx.fillText(banner.text, W / 2 + 1, H / 2 + 1);
      ctx.fillStyle = banner.color || '#fff'; ctx.fillText(banner.text, W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
    function render() {
      drawPitch();
      const people = all().slice().sort((a, b) => a.y - b.y);
      for (const p of people) drawPlayer(p);
      for (const e of extras) {
        if (e.medics) for (const m of e.medics) { px(m.x - 1, m.y - 4, 3, 2, '#e3b48a'); px(m.x - 1, m.y - 2, 3, 4, '#ffffff'); px(m.x, m.y - 1, 1, 2, '#e5484d'); }
        if (e.invader) { const v = e.invader; px(v.x - 1, v.y - 4, 3, 2, '#e3b48a'); px(v.x - 1, v.y - 2, 3, 3, '#e3b48a'); px(v.x - 1, v.y + 1, 3, 1, '#d36bd1');
          const s = e.steward; px(s.x - 1, s.y - 4, 3, 2, '#e3b48a'); px(s.x - 1, s.y - 2, 3, 4, '#f2e14e'); }
      }
      // ball
      px(ball.x - 1, ball.y + 1, 3, 1, 'rgba(0,0,0,.4)');
      px(ball.x - 1, ball.y - 1 - Math.round(ball.z * 2), 2, 2, '#ffffff');
      if (flash > 0) { ctx.globalAlpha = flash * 0.35; px(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
      drawBanner();
    }

    let last = performance.now(), raf = 0, alive = true;
    let wasConnected = false;
    function loop(now) {
      if (!alive) return;
      if (canvas.isConnected) wasConnected = true;
      else if (wasConnected) { alive = false; return; } // overlay removed: stop animating
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt); render();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return {
      canvas, event,
      minute(m) { minute = m; void minute; },
      whistle(text) { frozen = true; banner = { text: text || 'WHISTLE', color: '#ffffff', t: 99, sticky: true }; },
      resume() { frozen = false; banner = null; kickoff(possession === 'HOME' ? 'AWAY' : 'HOME'); },
      fulltime() { frozen = true; banner = { text: 'FULL TIME', color: '#ffffff', t: 99, sticky: true }; },
      destroy() { alive = false; cancelAnimationFrame(raf); canvas.remove(); },
    };
  }

  window.MatchPitch = { mount };
})();
