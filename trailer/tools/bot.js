// capture-only autopilot: drives the player through Controls (window.__bot = config), installed into the page
(async () => {
  const { Controls } = await import("/src/game/combat/Controls.ts");
  const P = Controls.prototype;
  if (P.__botted) return; P.__botted = true;
  const orig = { move: P.move, aim: P.aim, aimPoint: P.aimPoint, attackHeld: P.attackHeld, jump: P.jump };
  let fc = 0;
  const tgt = () => {
    const g = window.__krel.game;
    const d = g.scene.getScene("Dungeon");
    if (!d || !d.player || !g.scene.isActive("Dungeon")) return null;
    const p = d.player.spr; let best = null, bd = 1e9;
    for (const e of d.enemies || []) {
      if (e.dead || e.active === false) continue;
      const dd = Math.hypot(e.x - p.x, e.y - p.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    return { d, p, e: best, dist: bd };
  };
  P.move = function () {
    const b = window.__bot; if (!b) return orig.move.call(this);
    fc++;
    const t = tgt(); if (!t) return { x: 0, y: 0 };
    const { p, e, dist } = t; let x = 0, y = 0;
    if (e && dist < (b.engage || 900)) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x), want = b.range || 210;
      const r = dist > want + 50 ? 1 : dist < want - 70 ? -1 : 0;
      const s = Math.floor(fc / (b.strafe || 110)) % 2 ? 1 : -1;
      x = Math.cos(ang) * r - Math.sin(ang) * 0.75 * s; y = Math.sin(ang) * r + Math.cos(ang) * 0.75 * s;
    } else if (b.dir) { x = b.dir[0]; y = b.dir[1]; }
    if (b.tower && t.d.side) { const ph = Math.floor(fc / (b.zig || 75)) % 2; return { x: ph ? 1 : -1, y: 0 }; }
    if (t.d.side) { y = 0; if (!e || dist > (b.engage || 900)) x = b.dir ? b.dir[0] : 1; else if (b.push) x = Math.sign(e.x - p.x) || 1; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  };
  P.aim = function (px, py) {
    const b = window.__bot; if (!b) return orig.aim.call(this, px, py);
    const t = tgt(); return t && t.e ? Math.atan2(t.e.y - py, t.e.x - px) : (t && t.d.side ? 0 : 0);
  };
  P.aimPoint = function () {
    const b = window.__bot; if (!b) return orig.aimPoint.call(this);
    const t = tgt(); return t && t.e ? { x: t.e.x, y: t.e.y } : orig.aimPoint.call(this);
  };
  P.attackHeld = function () {
    const b = window.__bot; if (!b) return orig.attackHeld.call(this);
    if (b.noFire) return false;
    const t = tgt(); return !!(t && t.e && t.dist < (b.fire || 650));
  };
  P.jump = function () {
    const b = window.__bot; if (!b) return orig.jump.call(this);
    const t = tgt(); if (!t || !t.d.side) return false;
    if (b.tower) { const k = fc % (b.hop || 34); return k === 0 || k === 14; }
    if (b.jumpEvery) return fc % b.jumpEvery === 0 || fc % b.jumpEvery === 12;
    return !!(t.e && t.e.y < t.p.y - 50 && fc % 24 === 0);
  };
})();
