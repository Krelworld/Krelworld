// Chef Marina — her pictures in the house: hang on walls, move, take down, gift to family, trash. Everything auto-saves.
const Pics = (() => {
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cm_' + k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) { } } };
  const hash = u => u.length + ':' + u.slice(-28);
  const imgs = {};
  let walls = store.get('walls', []); // {h, room, x, y, gift}
  const gallery = () => store.get('gallery', []);
  const urlOf = h => gallery().find(u => hash(u) === h);
  const saveWalls = () => store.set('walls', walls);
  function img(h) { if (imgs[h]) return imgs[h]; const u = urlOf(h); if (!u) return null; const i = new Image(); i.src = u; return (imgs[h] = i); }
  function size(w) { const i = img(w.h); const ar = i && i.naturalWidth ? i.naturalHeight / i.naturalWidth : 0.8; const W = 30; return [W, Math.min(36, W * ar)]; }
  function inRoom(room) { return walls.filter(w => w.room === room && urlOf(w.h)); }
  function freeX(room, x, y) { const W = ROOMS[room].w; x = clamp(x, 22, W - 22); for (let k = 0; k < 12; k++) { if (!walls.some(w => w.room === room && Math.abs(w.x - x) < 34 && Math.abs(w.y - y) < 30)) return x; x = x + 36 > W - 22 ? 22 : x + 36; } return x; }

  function hang(url, room) {
    room = room || (G.room === 'yard' ? 'living' : G.room); const h = hash(url);
    walls = walls.filter(w => w.h !== h); const y = 74, x = freeX(room, room === G.room ? marina.x : ROOMS[room].w / 2, y);
    walls.push({ h, room, x, y }); saveWalls();
    if (room === G.room) { marina.dir = 1; playAnim('marina_reach', { fps: 10, dur: frameCount('marina_reach') ? 0 : 0.5 }); emit('sparkle', x, y, 14); emit('confetti', x, y, 16); }
    chip('pop'); Audio2.jingle([0, 7, 12, 16], 0.06); say(pick(['m_did_it', 'm_look'])); window.did && did('hang');
    const fans = [daddy, mommy, rory].filter(e => e.here && e.state !== 'toilet' && e.state !== 'lie' && !(e === rory && !G.rory));
    if (fans.length && room === G.room) setTimeout(() => { const f = pick(fans); f.dir = Math.sign(x - f.x) || 1; say(f === daddy ? 'd_proud' : f === mommy ? 'mo_proud' : 'r_amazing', f).then(() => emit('heart', f.x, f.y - 90, 5)); }, 1500);
  }
  function takeDown(w) { walls = walls.filter(q => q !== w); saveWalls(); emit('dust', w.x, w.y, 6); chip('drop'); }
  function trash(url) { const h = hash(url); walls = walls.filter(w => w.h !== h); saveWalls(); store.set('gallery', gallery().filter(u => u !== url)); delete imgs[h]; }
  function giftMenu(url, fromWall) {
    const who = [[daddy, '👨'], [mommy, '👩'], [rory, '🧔'], [nunu, '👵'], [jeff, '👴']].filter(([e]) => !e.hidden || e === rory).filter(([e]) => e.state !== 'toilet').filter(([e]) => (e !== nunu && e !== jeff) || e.here);
    UI.actions(marina, who.map(([e, ico]) => A(ico, () => gift(url, e, fromWall))));
  }
  function gift(url, who, fromWall) {
    const h = hash(url);
    runScene(async () => {
      if (fromWall) { walls = walls.filter(q => q !== fromWall); saveWalls(); }
      G.holding = { type: 'pic', ico: '🖼️' };
      if (who === rory && !G.rory) { G.rory = true; rory.hidden = false; }
      if (who.room !== G.room || who.hidden) { who.hidden = false; who.room = G.room; who.x = marina.x < ROOMS[G.room].w / 2 ? ROOMS[G.room].w - 12 : 12; who.y = FLOOR; who.state = 'idle'; await come(who, 30); }
      if (who.state === 'lie') who.state = 'idle';
      await goTo(who); await say('m_made'); G.holding = null; chip('magic'); who.face = '🥹';
      emit('heart', who.x, who.y - 90, 8); emit('heart', who.x, who.y - 100, 1, { ch: '🖼️', vy: -12, vx: 0, life: 1.8, size: 16 });
      await say(who === daddy ? pick(['d_proud', 'd_amazing']) : who === mommy ? pick(['mo_proud', 'mo_amazing']) : 'r_amazing', who); who.face = null;
      chip('hug'); await pair('pair_hug_' + who.id, who, { dur: 2.4 }); await say('m_wuv_' + who.id); await say(who === daddy ? 'd_love' : who === mommy ? 'mo_love' : 'r_love', who);
      // the proud grown-up puts it up on the fridge
      // the proud grown-up hangs it up right here where she can see it (outdoors: it goes on the fridge)
      walls = walls.filter(w => w.h !== h);
      if (!ROOMS[G.room].outside) {
        const W = ROOMS[G.room].w, x = freeX(G.room, clamp(who.x + (who.x < W / 2 ? 46 : -46), 30, W - 30), 70);
        who.face = '🖼️'; await new Promise(r => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; who.walkTo(x, fin); setTimeout(fin, 4000); });
        who.face = null; who.hugT = E.t + 1; walls.push({ h, room: G.room, x, y: 70, gift: who.id }); saveWalls();
        chip('pop'); Audio2.jingle([0, 7, 12, 16, 19], 0.07); emit('sparkle', x, 70, 18); emit('confetti', x, 66, 20); emit('heart', x, 60, 5);
        marina.dir = Math.sign(x - marina.x) || 1; marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1500); await say('m_look');
      } else { const n = walls.filter(w => w.gift).length; walls.push({ h, room: 'kitchen', x: 250 + (n % 3) * 13 - 6, y: 78 + Math.floor(n / 3 % 2) * 22, gift: who.id }); saveWalls(); UI.bigIcon('🖼️💖', 1200); }
      window.did && did('gift');
    });
  }
  function actionsFor(w) {
    const url = urlOf(w.h);
    return [A('🎁', () => giftMenu(url, w)), A('⬇️', () => takeDown(w)), A('✏️', () => { Studio.open(); setTimeout(() => Studio.load && Studio.load(url), 300); }),
      A('🗑️', () => UI.actions({ x: w.x, y: w.y - 10 }, [A('🗑️', () => { trash(url); emit('dust', w.x, w.y, 8); Audio2.whoosh(false); }), A('↩️', () => { })]))];
  }
  function draw() {
    for (const w of inRoom(G.room)) {
      const i = img(w.h), [W, H] = size(w), g = w.gift, wob = w.drag ? Math.sin(E.t * 14) * 0.06 : 0, ctx = E.ctx;
      ctx.save(); ctx.translate(Math.round(w.x - E.camX), Math.round(w.y)); ctx.rotate(wob + (g ? ((w.x * 7) % 5 - 2) * 0.03 : 0));
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-W / 2 - 1, -H / 2 + 1, W + 4, H + 4);
      ctx.fillStyle = g ? '#fff' : '#8a5a2e'; ctx.fillRect(-W / 2 - 2, -H / 2 - 2, W + 4, H + 4); ctx.fillStyle = '#fff'; ctx.fillRect(-W / 2 - 1, -H / 2 - 1, W + 2, H + 2);
      if (i && i.complete && i.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(i, -W / 2, -H / 2, W, H); ctx.imageSmoothingEnabled = false; }
      ctx.restore();
      if (g) emoji('💖', w.x + W / 2, w.y - H / 2, 7); else rect(w.x - 1, w.y - H / 2 - 4, 2, 2, '#555');
    }
  }
  function hit(wx, wy) { const l = inRoom(G.room); for (let k = l.length - 1; k >= 0; k--) { const w = l[k], [W, H] = size(w); if (Math.abs(wx - w.x) < W / 2 + 4 && Math.abs(wy - w.y) < H / 2 + 4) return w; } return null; }
  return { hang, trash, gift, giftMenu, draw, hit, actionsFor, img, hash, save: saveWalls, get walls() { return walls; } };
})();

// draw on the wall (behind furniture), tap for options, drag to move
const _drawPropsP = drawProps;
drawProps = function (z) { if (z === 0 && !ROOMS[G.room].outside) { _drawPropsP(z); Pics.draw(); return; } _drawPropsP(z); };
const _hitTestP = hitTest;
hitTest = function (wx, wy) { const h = _hitTestP(wx, wy); if (h && (h.kind === 'ent' || h.kind === 'self' || h.kind === 'mess')) return h; const w = Pics.hit(wx, wy); return w ? { kind: 'pic', w } : h; };
const _interactP = interact;
interact = function (hit, wx, wy) { if (hit.kind !== 'pic') return _interactP(hit, wx, wy); const w = hit.w; approach(w.x, () => UI.actions({ x: w.x, y: w.y - 6 }, Pics.actionsFor(w)), 0); };
(function picDrag() {
  const st = document.getElementById('stage'); let g = null;
  const world = e => { const r = st.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
  st.addEventListener('pointerdown', e => { if (G.busy || e.target.closest('.act,.hud,#roombar,.actback') || typeof marina === 'undefined') return; const [wx, wy] = world(e); const w = Pics.hit(wx, wy); const h = hitTest(wx, wy); if (w && h && h.kind === 'pic') g = { w, x0: e.clientX, y0: e.clientY, moved: false }; });
  st.addEventListener('pointermove', e => { if (!g) return; if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 30) return; g.moved = true; UI.closeActions(); const [wx, wy] = world(e); g.w.x = clamp(wx, 20, ROOMS[G.room].w - 20); g.w.y = clamp(wy, 34, 122); g.w.drag = true; });
  const end = () => { if (!g) return; if (g.moved) { delete g.w.drag; Pics.save(); Audio2.blip(4, 'triangle', 0.05); emit('sparkle', g.w.x, g.w.y, 5); } g = null; };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
})();
