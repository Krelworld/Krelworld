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
  const alertBox = mk('div', ''); alertBox.id = 'alerts'; stage.append(alertBox); const shown = {};
  const goEnt = e => whenIn(e.room, () => approach(e.x, () => UI.actions(e, entActions(e)), e === niko || e === miles ? 14 : 22));
  function alerts() {
    const a = [];
    if (miles.crying && !(miles.here && Math.abs(marina.x - miles.x) < 50)) a.push({ id: 'miles', html: '👶<i>😭</i>', go: () => goEnt(miles) });
    if (G.poop && !(G.room === 'playroom' && marina.x < 80)) a.push({ id: 'poop', html: '💩<i>🐈</i>', go: () => propGo('playroom', 'tray') });
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
    for (const { b, side } of arrows) { const to = side < 0 ? R.left : R.right, on = q && to && !G.busy && !G.tidy && !['bars', 'tantrum'].includes(marina.state); b.classList.toggle('off', !on); if (to && b.dataset.to !== to) { b.dataset.to = to; b.firstChild.textContent = ROOMS[to].ico; } }
    dress.classList.toggle('off', !q || G.busy || !!G.tv);
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
