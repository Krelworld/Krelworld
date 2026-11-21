// Getting around and finding things: big room arrows, alerts you can tap (Miles crying, Niko's poop),
// tappable face cards, an always-there dress-up button, outfits that stay on, and carrying a picture
// to hang it or give it to someone.
(function () {
  const stage = document.getElementById('stage'), fxL = document.getElementById('fx');
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const hid = id => document.getElementById(id).classList.contains('hidden');
  const quiet = () => typeof marina !== 'undefined' && hid('title') && hid('panel') && !(window.Studio && Studio.active) && !document.querySelector('.fortbar,.fortin');
  const press = (n, fn) => { n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); fn(e); }); };
  const free = () => { if (G.busy && !G.sceneOn) return false; return !G.busy; };

  // ------------------------------------------------------------ room arrows (replace the small wall tabs)
  exitSigns = function () { return []; };
  const arrows = [-1, 1].map(side => {
    const b = mk('button', 'navarrow ' + (side < 0 ? 'l' : 'r'), '<b></b><i>' + (side < 0 ? '◀' : '▶') + '</i>'); b.setAttribute('aria-label', side < 0 ? 'room to the left' : 'room to the right');
    press(b, () => { const to = b.dataset.to; if (!to || G.busy || ['bars', 'tantrum'].includes(marina.state)) return; UI.closeActions(); Audio2.blip(9, 'triangle', 0.06, 0.12);
      if (['sit', 'cheer', 'sad', 'perch'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; } travelTo(to); });
    stage.append(b); return { b, side };
  });
  // ------------------------------------------------------------ dress-up button, always there
  const dress = mk('button', 'hud', '👗'); dress.id = 'dressBtn'; dress.setAttribute('aria-label', 'dress up');
  press(dress, () => { if (G.busy || !quiet()) return; UI.closeActions(); if (['perch', 'sit', 'cheer'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; } UI.openDress(); });
  stage.append(dress);

  // ------------------------------------------------------------ alerts: tap to go straight there
  let calmT = 0, tvWas = false;
  const alertBox = mk('div', ''); alertBox.id = 'alerts'; stage.append(alertBox); const shown = {};
  // alerts and face cards whisk her straight there (no walking), and she puts down whatever she was lugging about
  function zipTo(room, x, then) {
    if (G.holding && ['blower', 'tp'].includes(G.holding.type)) G.holding = null;
    if (marina.mount) dismount(); marina.stop(); emit('sparkle', marina.x, marina.y - 40, 10); chip('magic');
    whenIn(room, () => { const W = ROOMS[room].w; marina.stop(); marina.x = clamp(x, 16, W - 16); marina.y = FLOOR; marina.offY = 0; marina.state = 'idle';
      E.camX = clamp(marina.x - E.viewW / 2, Math.min(0, (W - E.viewW) / 2), Math.max(0, W - E.viewW)); emit('sparkle', marina.x, marina.y - 40, 14); then(); });
  }
  const goEnt = e => { if (e === miles) mommy.holdingMiles = false; const gap = e === miles ? 32 : e === niko ? 22 : 26, side = e.x > ROOMS[e.room].w - 50 || (e.x > marina.x && e.room === G.room) || e === miles ? -1 : 1;
    zipTo(e.room, e.x + side * gap, () => { marina.dir = -side; UI.actions(e, entActions(e)); }); };
  function alerts() {
    const a = [], ambient = !G.busy && !G.tidy && !G.chase && !G.tv && !(G.fort && G.fort.inside) && !marina.mount && ['idle', 'walk', 'run', 'cheer', 'sad', 'perch', 'sit'].includes(marina.state);
    if (ambient && miles.crying && !(miles.here && Math.abs(marina.x - miles.x) < 50)) a.push({ id: 'miles', html: '👶<i>😭</i>', go: () => goEnt(miles) });
    if (ambient && miles.poopy && !miles.crying && !(miles.here && Math.abs(marina.x - miles.x) < 50)) a.push({ id: 'nappy', html: '👶<i>💩</i>', go: () => goEnt(miles) });
    if (ambient && G.poop && !(G.room === 'playroom' && marina.x < 80)) a.push({ id: 'poop', html: '💩<i>🐈</i>', go: () => zipTo('playroom', 50, () => { marina.dir = -1; const p = PROPS.playroom.find(q => q.id === 'tray'); UI.actions(p, propActions(p)); }) });
    const h = G.holding; if (h && h.type === 'pic' && h.url) { a.push({ id: 'picgive', html: '🎁<i>🖼️</i>', go: () => Pics.giftMenu(h.url) }); a.push({ id: 'pickeep', html: '📁', go: () => { G.holding = null; chip('pop'); } }); }
    return a;
  }
  // ------------------------------------------------------------ carrying a picture: glowing spots show what you can do with it
  const hints = [];
  function clearHints() { while (hints.length) hints.pop().n.remove(); }
  function picHints() {
    const h = G.holding, on = h && h.type === 'pic' && h.url && !G.busy && quiet() && !document.querySelector('.act');
    if (!on) return clearHints();
    const want = [{ id: 'wall', ico: '🖼️', pos: () => [clamp(marina.x, 30, ROOMS[G.room].w - 30), 74], go: () => { G.holding = null; Pics.hang(h.url); } }];
    if (ROOMS[G.room].outside) want.length = 0;
    for (const e of [daddy, mommy, rory]) if (e.here && !e.hidden && e.state !== 'toilet') want.push({ id: e.id, ico: '🎁', pos: () => [e.x, e.y - (e === mommy ? 86 : 104)], go: () => Pics.gift(h.url, e) });
    if (hints.map(x => x.id).join() !== want.map(x => x.id).join()) {
      clearHints();
      for (const w of want) { const n = mk('button', 'pichint ' + (w.id === 'wall' ? 'wall' : 'gift'), w.ico); n.setAttribute('aria-label', w.id === 'wall' ? 'hang it here' : 'give it'); press(n, () => { clearHints(); UI.closeActions(); w.go(); }); fxL.append(n); hints.push({ ...w, n }); }
    }
    for (const x of hints) { x.pos = want.find(w => w.id === x.id).pos; const [sx, sy] = toScreen(...x.pos()); x.n.style.left = sx + 'px'; x.n.style.top = sy + 'px'; }
  }
  Pics.carry = function (url) { G.holding = { type: 'pic', url, ico: '🖼️' }; if (['perch', 'sit'].includes(marina.state)) { marina.state = 'idle'; marina.offY = 0; } say(pick(['m_look', 'm_made'])); };
  const _dh = drawHolding;
  drawHolding = function (e, y) {
    const h = G.holding; if (!h || h.type !== 'pic' || !h.url) return _dh(e, y);
    const i = Pics.img(Pics.hash(h.url)), c = E.ctx, x = Math.round(e.x + (e.dir < 0 ? -12 : 12) - E.camX), yy = Math.round(y + 26 + Math.sin(E.t * 3));
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 10, yy - 7, 22, 17); c.fillStyle = '#fff'; c.fillRect(x - 11, yy - 9, 22, 17);
    if (i && i.complete && i.naturalWidth) { c.imageSmoothingEnabled = true; c.drawImage(i, x - 10, yy - 8, 20, 15); c.imageSmoothingEnabled = false; }
  };

  setInterval(() => {
    if (typeof marina === 'undefined') return;
    const q = quiet(), R = ROOMS[G.room];
    const tvNow = !!(G.tv && G.room === 'living'); if (tvNow !== tvWas) { tvWas = tvNow; stage.classList.toggle('tvon', tvNow); resize(); }
    for (const { b, side } of arrows) { const to = side < 0 ? R.left : R.right, on = q && to && !G.busy && !G.tidy && !['bars', 'tantrum'].includes(marina.state); b.classList.toggle('off', !on); if (to && b.dataset.to !== to) { b.dataset.to = to; b.firstChild.textContent = ROOMS[to].ico; } }
    // the dress-up button only drifts in when she's standing about with nothing else going on
    const calm = q && !G.busy && !G.tv && !G.tidy && !G.chase && !G.holding && !marina.moving && marina.state === 'idle' && !marina.mount && !document.querySelector('.act,.alertb,.pichint,#wishBtn');
    calmT = calm ? calmT + 0.25 : 0; dress.classList.toggle('off', calmT < 1.5);
    const a = q ? alerts() : []; const ids = a.map(x => x.id);
    for (const id in shown) if (!ids.includes(id)) { shown[id].remove(); delete shown[id]; }
    for (const x of a) if (!shown[x.id]) { const n = mk('button', 'alertb', x.html); n.setAttribute('aria-label', x.id); press(n, () => { if (G.busy && G.sceneOn) return; G.busy = false; UI.closeActions(); Audio2.jingle([0, 7, 12], 0.06); x.go(); }); alertBox.append(n); shown[x.id] = n; }
  }, 250);
  const _ft = featTick; featTick = function (dt) { _ft(dt); picHints(); };

  // face cards: tap one to run to that person / baby / cat
  stage.addEventListener('pointerup', e => { const c = e.target.closest('.facecard'); if (!c) return; e.stopPropagation(); const who = c.dataset.who, ent = { daddy, mommy, rory, miles, niko }[who]; if (!ent || ent.hidden || G.busy || !quiet()) return; UI.closeActions(); Audio2.jingle([0, 7, 12], 0.06); goEnt(ent); }, true);
  stage.addEventListener('pointerdown', e => { if (e.target.closest('.facecard')) e.stopPropagation(); }, true);

  // ------------------------------------------------------------ outfits stay on when she cheers, sits, swings or rides
  const _dm = drawMarina;
  drawMarina = function (e) {
    if (G.outfit === 'default') return _dm(e);
    const o = 'o_' + G.outfit, st = e.state, flip = e.dir < 0, S = e.scale, y = e.y + e.offY, opt = mOpt(), sit = o, sq = 0.84;   // no drawn sitting pose per outfit: she keeps the outfit on and tucks down a little
    if (st === 'cheer' && frameCount(o + '_cheer')) { drawLook(e, o, y, flip, S, 'back'); drawSprite(frameKey(o + '_cheer', e.animT, 8), e.x, y, { flip, scale: S, opt }); drawLook(e, o, y, flip, S, 'front'); return; }
    if (sit && (st === 'sit' || st === 'fort')) { drawSprite(sit, e.x, y + 2, { flip, scale: S * 0.95, opt, sy: sq }); drawHolding(e, y - 52); return; }
    if (sit && st === 'wheel') { drawSprite('wheelchair', e.x, y + 2, { flip, scale: 1.1 }); drawSprite(sit, e.x + (flip ? 2 : -2), y - 6, { flip, scale: 0.95, opt, sy: sq }); drawHolding(e, y - 50); return; }
    if (sit && st === 'swing') { const a = Math.sin(e.animT * 2.6) * 0.5, px = e.x, py = 84, len = 60, sx = px + Math.sin(a) * len, sy2 = py + Math.cos(a) * len, c = E.ctx;
      c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(px - 4 - E.camX, py); c.lineTo(sx - 4 - E.camX, sy2); c.moveTo(px + 4 - E.camX, py); c.lineTo(sx + 4 - E.camX, sy2); c.stroke();
      rect(sx - 8, sy2, 16, 3, e.swingKind === 'saucer' ? '#2f8fe0' : '#2a7a3a'); drawSprite(sit, sx, sy2 + 4, { flip, scale: S * 0.95, opt, sy: sq, rot: a * 0.5 }); return; }
    return _dm(e);
  };

  // ------------------------------------------------------------ title: a dress-up button showing what she's wearing
  const T = document.getElementById('title'), td = mk('button', 'tdress', '<canvas width="64" height="64"></canvas><b>👗</b>'); td.setAttribute('aria-label', 'dress up');
  press(td, () => { if (!T.classList.contains('ready')) return; startGame(); setTimeout(() => { G.busy = false; G.sceneOn = false; UI.closeActions(); UI.openDress(); }, 1500); });
  T.append(td);
  const paint = () => { if (typeof marina === 'undefined' || !hid('title') === false && false) return; const sc = spriteCanvas(mBase(), mOpt()); if (!sc) return; const x = td.firstChild.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 64, 64); x.drawImage(sc, 32 - sc.width / 2, 64 - sc.height); };
  const pt = setInterval(() => { if (!hid('title')) { try { paint(); } catch (e) { } } else clearInterval(pt); }, 700);

  const s = document.createElement('style'); s.textContent = `
.navarrow{position:absolute;top:44%;z-index:5;width:54px;height:92px;padding:0;background:rgba(255,255,255,.88);box-shadow:0 4px 0 rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:opacity .2s,transform .2s;touch-action:manipulation}
.navarrow.l{left:0;border-radius:0 22px 22px 0;animation:navl 1.2s ease-in-out infinite alternate}.navarrow.r{right:0;border-radius:22px 0 0 22px;animation:navr 1.2s ease-in-out infinite alternate}
.navarrow b{font-size:30px;font-weight:400;line-height:1}.navarrow i{font-style:normal;font-size:22px;color:#e2632b;line-height:1}
.navarrow.off,#dressBtn.off{opacity:0;pointer-events:none}
@keyframes navl{to{transform:translateX(4px)}}@keyframes navr{to{transform:translateX(-4px)}}
.navarrow:active{background:#ffcf4a}
#dressBtn{top:auto;left:auto;right:10px;bottom:10px;width:64px;height:64px;line-height:64px;font-size:36px;background:#ffd6ec;border:3px solid #fff;border-radius:22px;transition:opacity .2s}
#alerts{position:absolute;z-index:7;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:10px;pointer-events:none}
.alertb{pointer-events:auto;position:relative;width:66px;height:66px;border-radius:50%;border:4px solid #fff;background:#ff6b6b;font-size:36px;padding:0;box-shadow:0 4px 0 rgba(0,0,0,.3),0 0 0 6px rgba(255,107,107,.35);animation:pulse .55s ease-in-out infinite alternate;touch-action:manipulation}
.alertb i{position:absolute;right:-8px;bottom:-8px;font-size:24px;font-style:normal}
.alertb[aria-label^=pic]{background:#7be07b;box-shadow:0 4px 0 rgba(0,0,0,.3)}.alertb[aria-label=pickeep]{background:#fff;animation:none}
.facecard{pointer-events:auto;cursor:pointer}
.pichint{position:absolute;z-index:6;transform:translate(-50%,-50%);width:62px;height:62px;padding:0;font-size:32px;border-radius:18px;background:rgba(255,255,255,.9);border:4px dashed #ff8f3a;animation:pulse .6s ease-in-out infinite alternate;touch-action:manipulation}
.pichint.gift{border-radius:50%;border:4px solid #fff;background:#7be07b;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.rb{width:40px;height:46px;font-size:24px}
.tdress{position:absolute;z-index:3;right:6vw;bottom:calc(env(safe-area-inset-bottom) + 3vh);width:min(26vw,104px);height:min(26vw,104px);border-radius:26px;border:5px solid #fff6dc;background:#ffd6ec;box-shadow:0 6px 0 rgba(60,20,20,.55);padding:0;opacity:0;transition:opacity .4s}
#title.ready .tdress{opacity:1}.tdress canvas{width:86%;height:86%;image-rendering:pixelated}.tdress b{position:absolute;right:-10px;top:-12px;font-size:34px;font-weight:400}
@media (orientation:portrait){#titleCv{left:38%}}
@media (orientation:landscape){
  .navarrow{top:46%;width:56px;height:86px}.navarrow.r{right:74px;border-radius:22px}
  #dressBtn{right:78px;bottom:8px;width:58px;height:58px;line-height:58px;font-size:32px}
  .rb{width:50px;height:48px;font-size:27px}
  .tdress{right:auto;left:4vw;bottom:8vh;width:min(22vh,100px);height:min(22vh,100px)}
}`; document.head.append(s);
})();

// ------------------------------------------------------------ things Marina can use glow softly when she is near them
(function glow() {
  const near = (o, r) => typeof marina !== 'undefined' && !G.busy && !G.sceneOn && marina.state !== 'anim' && Math.abs(o.x - marina.x) < r;
  const ease = (o, on) => (o.glow = clamp((o.glow || 0) + (on ? 0.08 : -0.06), 0, 1));
  function lit(g, draw) {
    if (g <= 0.02) return draw();
    const c = E.ctx; c.save(); c.shadowColor = 'rgba(255,236,150,' + (g * (0.8 + Math.sin(E.t * 4) * 0.2)).toFixed(3) + ')'; c.shadowBlur = E.scale * 4.5; c.shadowOffsetX = c.shadowOffsetY = 0;
    draw(); c.restore();
  }
  const _dp = drawProp;
  drawProp = function (p) {
    const usable = !p.nohit && p.a && propVisible(p), g = ease(p, usable && near(p, Math.max(30, (p.w || spriteSize(p.k)[0] * (p.scale || 1) || 40) * 0.5 + 12)));
    if (g > 0.02 && p.k.startsWith('p:')) {      // painted into the background: a soft pool of light instead of an outline
      const c = E.ctx, w = (p.w || 50) * 0.6, h = (p.h || 40) * 0.6, x = p.x - E.camX, y = p.y - (p.h || 40) * 0.5;
      const gr = c.createRadialGradient(x, y, 2, x, y, Math.max(w, h)); gr.addColorStop(0, 'rgba(255,240,170,' + (0.34 * g).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,170,0)');
      c.fillStyle = gr; c.fillRect(x - w * 2, y - h * 2, w * 4, h * 4); return _dp(p);
    }
    lit(g, () => _dp(p));
  };
  const _de = drawEnt;
  drawEnt = function (e) {
    if (e === marina || !e.here || e.hidden) return _de(e);
    lit(ease(e, near(e, 42) && !marina.mount), () => _de(e));
  };
})();

// ------------------------------------------------------------ leaving the yard: the leaf blower stays outside
(function () { const _cr = changeRoom; changeRoom = function (room, from, x) { if (G.room === 'yard' && room !== 'yard' && G.holding && G.holding.type === 'blower') G.holding = null; return _cr(room, from, x); }; })();

// ------------------------------------------------------------ giving Miles his bottle: a little lullaby scene
(function () {
  let feedT = 0;
  const _so = soothe;
  soothe = function (kind) {
    if (kind !== 'bottle' || G.busy) return _so(kind);
    UI.closeActions(); G.busy = true; mommy.holdingMiles = false;
    [daddy, mommy, rory, niko].forEach((e, i) => { if (e.here && Math.abs(e.x - (miles.x - 14)) < 56) { e.stop && e.stop(); e.x = clamp(miles.x + (e === niko ? -74 : 52 + i * 16), 16, ROOMS[G.room].w - 16); e.dir = -1; } });
    const py = miles.spot === 'crib' ? BACK - 10 : 156, D = 5.2;
    marina.stop(); marina.x = miles.x - 34; marina.dir = 1; marina.offY = 0; feedT = E.t + D;
    playAnim('marina_feed', { fps: 5, loop: true, proc: 'hug', dur: D });
    say('m_bottle'); Audio2.sfx('chip_lullaby', { rate: 1, vol: 0.9 });
    setTimeout(() => { miles.crying = false; miles.cryT = rnd(60, 100); miles.eatT = E.t + D - 1.4; }, 500);
    const iv = setInterval(() => { if (E.t > feedT - 0.6) return clearInterval(iv);
      const r = Math.random(); emit('heart', miles.x + rnd(-16, 16), py - rnd(24, 40), 1, r < 0.4 ? { ch: '🎵', vx: rnd(-10, 10), vy: -22, life: 1.6, size: 10 } : r < 0.6 ? { ch: '🍼', vx: rnd(-6, 6), vy: -16, life: 1.4, size: 9 } : r < 0.8 ? { ch: '⭐', vx: rnd(-14, 14), vy: -20, life: 1.3, size: 8 } : undefined);
      if (chance(0.5)) emit('sparkle', miles.x + rnd(-22, 22), py - rnd(0, 46), 1); }, 260);
    setTimeout(() => {      // all done: a tiny burp, a giggle, and a happy baby
      marina.state = 'idle'; marina.anim = null; miles.happyT = 5; Audio2.sfx('burp1', { rate: 1.9, vol: 0.5 }); emit('heart', miles.x + 6, py - 30, 1, { ch: '💨', vx: 14, vy: -10, life: 0.9, size: 9 });
      setTimeout(() => { Audio2.sfx('baby_coo'); emit('heart', miles.x, py - 30, 12); emit('confetti', miles.x, py - 40, 14); Audio2.voice('m_giggle', 'm'); marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1400); }, 500);
      G.busy = false;
      if (mommy.here) setTimeout(() => say('mo_feed_miles', mommy), 1900); else if (window.reactTo) reactTo('kind', 1900);
    }, D * 1000);
  };
  // a soft spotlight on the two of them while he drinks
  const _dx = drawExitSigns;
  drawExitSigns = function () {
    _dx(); const k = clamp(Math.min(feedT - E.t, 0.6) / 0.6, 0, 1) * clamp((E.t - (feedT - 5.2)) / 0.5, 0, 1); if (k <= 0 || !miles.here) return;
    const c = E.ctx, x = miles.x - 10 - E.camX, y = 120, g = c.createRadialGradient(x, y, 30, x, y, 190);
    g.addColorStop(0, 'rgba(40,20,70,0)'); g.addColorStop(1, 'rgba(40,20,70,' + (0.62 * k).toFixed(3) + ')'); c.fillStyle = g; c.fillRect(-10, -40, E.viewW + 20, SH + 60);
    // Miles himself, big and in front, so he is never hidden by the crib or by Marina
    const fk = frameCount('miles_eat') && E.t < feedT - 0.2 ? frameKey('miles_eat', E.t, 6) : (frameCount('miles_happy') ? frameKey('miles_happy', E.t, 6) : 'miles'), d0 = E.depth; E.depth = 1;
    drawSprite(fk, miles.x + 4, BACK + 14 + Math.sin(E.t * 5) * 1, { flip: true, scale: 0.8 + 0.5 * k }); E.depth = d0;
  };
})();
(function () { const s = document.createElement('style'); s.textContent = '@media (orientation:landscape){.facecard{top:8px;left:78px;width:min(11vw,84px);border-radius:16px}.facecard.right{left:auto;right:78px}#alerts{top:66px}}'; document.head.append(s); })();

(function () { const s = document.createElement('style'); s.textContent = '@media (orientation:landscape){#stage.tvon #roombar,#stage.tvon #alerts{opacity:0;pointer-events:none}#roombar{transition:opacity .3s}}'; document.head.append(s); })();

// ------------------------------------------------------------ whatever goes on her face replaces her own glasses (also for looks saved before this rule)
(function () { const _mo = mOpt; mOpt = function () { const o = _mo(); if (G.look && G.look.face && !(o && o.noGlasses)) return { ...(o || {}), noGlasses: true }; return o; }; })();

// ------------------------------------------------------------ Miles does a poop: stinky nappy, tap him (or the alert) to change it
(function () {
  let next = 70 + Math.random() * 60, fly = null;
  const ambient = () => typeof marina !== 'undefined' && !G.busy && !G.sceneOn && document.getElementById('title').classList.contains('hidden') && document.getElementById('panel').classList.contains('hidden') && !(window.Studio && Studio.active);
  setInterval(() => {
    if (typeof miles === 'undefined' || !document.getElementById('title').classList.contains('hidden')) return;
    if (miles.poopy) { if (miles.here && !G.busy && Math.random() < 0.3) emit('stink', miles.x + rnd(-8, 8), (miles.spot === 'crib' ? BACK - 10 : 156) - rnd(10, 30)); return; }
    if (!ambient() || miles.crying) return;
    next -= 0.5; if (next > 0) return; next = 110 + Math.random() * 90;
    miles.poopy = true; if (miles.here) { Audio2.fart(); UI.face('miles', 'surprised', 1800); setTimeout(() => { if (!G.busy) say('m_stinky'); }, 900); }
  }, 500);
  function changeDiaper() {
    if (G.busy) return; UI.closeActions(); G.busy = true; mommy.holdingMiles = false;
    const py = miles.spot === 'crib' ? BACK - 10 : 156, pail = G.room === 'living' ? PROPS.living.find(p => p.id === 'pail') : null;
    marina.stop(); marina.x = miles.x - 38; marina.dir = 1; marina.offY = 0;
    playAnim('marina_reach', { fps: 8, loop: true, proc: 'hug', dur: 3.2 });
    say('m_stinky'); Audio2.sfx('chip_tap1');
    for (let i = 0; i < 3; i++) setTimeout(() => { emit('stink', miles.x + rnd(-14, 14), py - rnd(34, 46), 1); Audio2.blip(pick([0, 3, 7]), 'triangle', 0.05, 0.12); }, 300 + i * 260);
    setTimeout(() => {          // the old one sails off to the nappy bin
      const tx = pail ? pail.x : miles.x - 160, ty = pail ? pail.y - 34 : FLOOR - 20; fly = { t0: E.t, x0: miles.x - 8, y0: py - 16, tx, ty, dur: 0.9 }; Audio2.whoosh();
      setTimeout(() => { fly = null; Audio2.sfx('thud', { vol: 0.6 }); emit('dust', tx, ty, 6); emit('sparkle', tx, ty - 6, 6); }, 900);
    }, 1500);
    setTimeout(() => {          // fresh and clean
      miles.poopy = false; miles.crying = false; miles.happyT = 5; next = 120 + Math.random() * 90; marina.state = 'cheer'; marina.anim = null;
      emit('sparkle', miles.x, py - 20, 18); emit('heart', miles.x, py - 30, 8); Audio2.jingle([0, 2.5, 7, 9.5, 12, 14.5], 0.09, 'triangle'); Audio2.sfx('baby_coo'); UI.face('miles', 'happy', 2200);
      say('m_did_it'); setTimeout(() => { if (marina.state === 'cheer') marina.state = 'idle'; }, 1500); G.busy = false;
      if (window.reactTo) reactTo('helper', 1700);
    }, 3200);
  }
  window.changeDiaper = changeDiaper;
  const _ea = entActions; entActions = function (e) { const a = _ea(e); if (e === miles && miles.poopy) a.unshift(A('🧷', changeDiaper)); return a; };
  const _dx = drawExitSigns;
  drawExitSigns = function () {
    _dx(); if (!fly) return; const k = clamp((E.t - fly.t0) / fly.dur, 0, 1), x = fly.x0 + (fly.tx - fly.x0) * k, y = fly.y0 + (fly.ty - fly.y0) * k - Math.sin(k * Math.PI) * 46;
    emoji('💩', x, y, 9); if (chance(0.5)) emit('stink', x, y, 1);
  };
})();
