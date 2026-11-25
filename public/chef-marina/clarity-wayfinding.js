// Chef Marina — clarity: wayfinding: signs, floor colours, map and floor slide (G35 G36 G37 G38 G39).
// Built by the 'wayfinding' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
//   G35  doors and stairs to another floor or outside show where they lead; in the bathroom, the spa and the tree houses a small
//        edge tab points to the way out while it is off the picture (a tap on the tab walks her there, like the exit tabs do)
//   G36  one picture per place: Nunu's room 👵, the pine tree house 🌲, the tree-house map row 🏡, bigger ⬆️/⬇️ badges
//   G37  the map reads like the house: ⬆️ row above the house in portrait, her own face as 'you are here', people on every tile,
//        faint room outlines, and the strip's green dot also for Nunu and Grandpa Jeff
//   G38  one colour per floor: on its strip, as a ring on the ⬆️/⬇️ button that goes there, and on its map row
//   G39  changing floor slides the picture up or down and the arrival picture shows the arrow (local edit in features.js)
// Local edits that belong to this file: features.js changeRoom slide (G39) and isoroom data-r (G37); basement.js doorway 🛋️ (G35).
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const NS = 'http://www.w3.org/2000/svg';
  const game = () => typeof marina !== 'undefined' && !!marina;
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  // ================================================================ shared: the map's floor rows
  // floors.js adds one .fmaprow per floor that is not the main floor, in this order (floors.js:66). Rows are matched to floors
  // by that order, never by their label text.
  const rowFloors = () => Floors.list.filter(f => f.id !== 'main').sort((x, y) => (y.level == null ? -9 : y.level) - (x.level == null ? -9 : x.level));
  function tagRows(p) {           // data-floor on each .fmaprow still inside .fmap (G37 and G38; only where it is missing)
    const box = p && p.querySelector('.fmap'); if (!box) return;
    const fl = rowFloors(), rows = Array.from(box.children).filter(n => n.classList.contains('fmaprow'));
    rows.forEach((g, i) => { if (!g.dataset.floor && fl[i]) g.dataset.floor = fl[i].id; });
  }
  const FLOOR_RGB = { main: '43,35,64', up: '70,130,190', down: '110,78,50', out: '40,105,55', tree: '40,105,55' };

  // ================================================================ G36 one picture per place
  // ROOMS icons are read lazily everywhere (strip rebuild, side arrows, map, arrival picture), so they are set here at load.
  // basement.js:7 and builder.js:928 are load-time literals and are not edited.
  const G36 = C.G36 = { was: {}, now: { nunuroom: '👵', treehouse_pine: '🌲' } };
  for (const r in G36.now) G36.was[r] = ROOMS[r] ? ROOMS[r].ico : null;
  function g36(on) {
    for (const r in G36.now) {
      if (!ROOMS[r] || G36.was[r] == null) continue; const ico = on ? G36.now[r] : G36.was[r]; ROOMS[r].ico = ico;
      // nav.js caches the arrow's icon per destination and floors.js caches the strip per floor: rewrite those too
      for (const b of document.querySelectorAll('.navarrow')) if (b.dataset.to === r && b.firstChild) b.firstChild.textContent = ico;
      for (const b of document.querySelectorAll('#roombar .rb')) if (b.dataset.r === r) { for (const n of b.childNodes) if (n.nodeType === 3) { n.data = ico; break; } }
    }
  }
  if (C.on.G36) g36(true);
  C.onToggle('G36', g36);
  // the tree-house map row is labelled 🏡 (today 🌳, like the yard and the outside row)
  C.hook('openIsoMap', 'G36', { order: 10, after(c) {
    if (c.skip) return; const box = document.querySelector('#panel .fmap'); if (!box) return;
    const fl = rowFloors(); Array.from(box.children).filter(n => n.classList.contains('fmaprow')).forEach((g, i) => {
      if (fl[i] && fl[i].id === 'tree') { const lab = g.querySelector('.fmaplab'); if (lab) lab.textContent = '🏡'; } });
  } });
  // the ⬆️/⬇️ pill badges: 17 px -> 22 px, still anchored right/bottom -5px (floors.js:78). The ⬆️ button's badge pokes out
  // below its button; the ⬇️ button (later in the page) would paint over the bigger badge, so the ⬆️ button stacks on top.
  C.css('G36', '#floorpill .fl i{font-size:22px;z-index:2}#floorpill .fl.up{z-index:1}');

  // ================================================================ G38 one colour per floor
  // Strip: the main floor keeps today's purple; the extra attribute repeat beats floors.js:80 whatever the order.
  // Pill: today's light fill, white border and glyphs stay; the destination floor's colour is a 4 px ring outside the border,
  // keeping the 0 3px 0 drop shadow (and the :active one). Map rows: background and a box-shadow spread only, no box change.
  {
    const strip = (f, a) => `#roombar[data-floor][data-floor][data-floor=${f}]{background:rgba(${FLOOR_RGB[f]},${a})}`;
    const ring = f => `#floorpill .fl[data-dest=${f}]{box-shadow:0 3px 0 rgba(0,0,0,.25),0 0 0 4px rgb(${FLOOR_RGB[f]})}` +
      `#floorpill .fl[data-dest=${f}]:active{box-shadow:0 1px 0 rgba(0,0,0,.25),0 0 0 4px rgb(${FLOOR_RGB[f]})}`;
    const row = (f, a) => `.fmaprow[data-floor=${f}]{background:rgba(${FLOOR_RGB[f]},${a});box-shadow:0 0 0 3px rgba(${FLOOR_RGB[f]},${a});border-radius:12px}`;
    C.css('G38', strip('up', '.8') + strip('down', '.82') + strip('out', '.88') + strip('tree', '.88') +
      ['main', 'up', 'down', 'out', 'tree'].map(ring).join('') + row('up', '.8') + row('down', '.82') + row('out', '.88') + row('tree', '.88'));
    // which floor each pill button goes to (floors.js:58 uses the same rule)
    C.every(200, 'G38', () => {
      if (!game()) return; const a = Floors.of(G.room);
      for (const b of document.querySelectorAll('#floorpill .fl')) {
        const t = a.level == null ? null : Floors.at(a.level + (b.classList.contains('up') ? 1 : -1)), v = t ? t.id : '';
        if ((b.dataset.dest || '') !== v) { if (v) b.dataset.dest = v; else delete b.dataset.dest; }
      }
    });
    C.onToggle('G38', on => { if (!on) for (const b of document.querySelectorAll('#floorpill .fl')) delete b.dataset.dest; });
    C.hook('openIsoMap', 'G38', { order: 30, after(c) { if (!c.skip) tagRows(document.getElementById('panel')); } });
  }

  // ================================================================ G37 the map reads like the house
  const G37 = C.G37 = { face: null, upIdx: 0 };
  // Marina's face-card portrait, cut once from the face sheet into a small round picture
  function faceURL() {
    if (G37.face) return G37.face;
    try {
      const r = typeof FACES !== 'undefined' && FACES.img && FACES.A && FACES.A.face_marina_happy_rest; if (!r) return null;
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fillStyle = '#fff6dc'; x.fill(); x.save(); x.clip();
      const s = Math.min(64 / r[2], 64 / r[3]) * 1.15; x.drawImage(FACES.img, r[0], r[1], r[2], r[3], (64 - r[2] * s) / 2, (64 - r[3] * s) / 2 + 3, r[2] * s, r[3] * s); x.restore();
      G37.face = c.toDataURL();
    } catch (e) { C.warnOnce('G37 face', e); G37.face = null; }
    return G37.face;
  }
  // who is in room r: today's map rule (features.js:417), plus Nunu, Grandpa Jeff and Minka (not while she plays hide-and-seek)
  function peopleIn(r, withMe) {
    const L = [[marina, '👧'], [daddy, '👨'], [mommy, '👩'], [rory, '🧔'], [niko, '🐱'], [miles, '👶']]
      .filter(([e]) => e && e.room === r && (!e.hidden || e === marina) && !(e === rory && !G.rory) && (withMe || e !== marina));
    let seek = false; try { const s = window.Minka && Minka.state && Minka.state(); seek = !!(s && s.hiding); } catch (e) { }
    const more = [[typeof nunu !== 'undefined' ? nunu : null, '👵'], [typeof jeff !== 'undefined' ? jeff : null, '👴'], [window.minka, '🐈‍⬛']]
      .filter(([e]) => e && e.room === r && !e.hidden && !(e === window.minka && seek));
    return L.concat(more).map(x => x[1]).join('');
  }
  const svgEl = (tag, attrs, cls) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (cls) n.setAttribute('class', cls); n.style.pointerEvents = 'none'; return n; };
  C.hook('openIsoMap', 'G37', { order: 20, after(c) {
    if (c.skip) return; const p = document.getElementById('panel'); if (!p) return;
    tagRows(p);                                                                     // (f) data-floor, for G38
    const svg = p.querySelector('.isosvg');
    if (svg) {
      // each label carries its room key too (the polygon gets it in features.js:413)
      for (const t of svg.querySelectorAll('text')) { const q = t.previousElementSibling; if (q && q.dataset && q.dataset.r && !t.dataset.r) t.dataset.r = q.dataset.r; }
      // (d) faint dashed outlines on every room shape, drawn as separate shapes that never take a tap; 'here' is solid
      const g = svgEl('g', {}, 'cm-g37-lines');
      for (const poly of svg.querySelectorAll('polygon.isoroom')) g.append(svgEl('polygon', { points: poly.getAttribute('points') }, 'cm-outline' + (poly.classList.contains('here') ? ' cm-here' : '')));
      svg.append(g);
      // (b) 'you are here' on the main painting: her face takes the place of the 👧 in her room's label
      const t = svg.querySelector('text[data-r="' + G.room + '"]'), url = faceURL();
      if (t && url && t.textContent.startsWith('👧')) {
        const rest = t.textContent.slice('👧'.length); t.textContent = '';
        const me = document.createElementNS(NS, 'tspan'); me.setAttribute('class', 'cm-g37-me'); me.setAttribute('visibility', 'hidden'); me.textContent = '👧';
        t.append(me, document.createTextNode(rest)); t.dataset.cmWas = '👧' + rest;
        let bx = null; try { bx = t.getExtentOfChar(0); } catch (e) { }
        if (bx && bx.width > 0) {
          const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2, S = 17;
          const img = svgEl('image', { x: cx - S / 2, y: cy - S / 2, width: S, height: S, href: url }, 'cm-g37-face');
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
          svg.append(svgEl('circle', { cx, cy, r: S / 2 + 1.5 }, 'cm-g37-ring'), img);
        } else { t.textContent = t.dataset.cmWas; delete t.dataset.cmWas; }    // could not measure: today's 👧 stays
      }
    }
    // (b, c) other floors' tiles: her face at the top-right of her tile, and a small people row along the bottom edge
    const url = faceURL();
    for (const b of p.querySelectorAll('.fmaproom')) {
      const r = b.getAttribute('aria-label'); if (!r || !ROOMS[r]) continue;
      const mine = r === G.room && !!url;
      if (mine) { const im = mk('img', 'cm-g37-you'); im.src = url; im.alt = ''; im.draggable = false; b.append(im); }
      const who = peopleIn(r, !mine); if (who) { const row = mk('span', 'cm-g37-ppl' + (mine ? ' cm-g37-by' : ''), who); b.append(row); }
    }
    layoutMap();                                                                    // (a) portrait: ⬆️ row above the house
  } });
  // (a) Portrait only: the ⬆️ row moves just above the house picture, and the whole stack is centred under the title row
  // with two spacers of our own (the top one keeps at least 16 px below the ❌). Landscape: the row goes back into .fmap.
  function layoutMap() {
    const p = document.getElementById('panel'); if (!p || p.classList.contains('hidden')) return;
    const wrap = p.querySelector(':scope > .isowrap'), box = p.querySelector(':scope > .fmap'); if (!wrap || !box) return;
    const moved = p.querySelector(':scope > .fmaprow.cm-g37-up'), port = C.on.G37 && matchMedia('(orientation: portrait)').matches;
    if (port && !moved) {
      const up = Array.from(box.children).find(g => g.classList.contains('fmaprow') && g.dataset.floor === 'up'); if (!up) return;
      up.classList.add('cm-g37-up'); G37.upIdx = Array.from(box.children).indexOf(up);
      p.insertBefore(mk('div', 'cm-g37-sp'), wrap); p.insertBefore(up, wrap); box.after(mk('div', 'cm-g37-sp2'));
    } else if (!port && moved) unlayout(p);
  }
  function unlayout(p) {
    const moved = p.querySelector(':scope > .fmaprow.cm-g37-up'), box = p.querySelector(':scope > .fmap');
    if (moved && box) { moved.classList.remove('cm-g37-up'); box.insertBefore(moved, box.children[G37.upIdx || 0] || null); }
    for (const n of p.querySelectorAll(':scope > .cm-g37-sp, :scope > .cm-g37-sp2')) n.remove();
  }
  addEventListener('resize', () => { if (C.on.G37) layoutMap(); });              // she turned the phone with the map open
  C.onToggle('G37', on => {
    const p = document.getElementById('panel');
    if (!on) {
      for (const b of document.querySelectorAll('#roombar .rb.cm-gp')) b.classList.remove('cm-gp');
      if (!p) return; unlayout(p);
      for (const n of p.querySelectorAll('.cm-g37-lines, .cm-g37-face, .cm-g37-ring, .cm-g37-you, .cm-g37-ppl')) n.remove();
      for (const t of p.querySelectorAll('text[data-cm-was]')) { t.textContent = t.dataset.cmWas; delete t.dataset.cmWas; }
    } else if (p) layoutMap();
  });
  // (3) the strip's green dot also lights up for Nunu and Grandpa Jeff (features.js:497-498 covers Daddy, Mommy and Rory)
  C.every(300, 'G37', () => {
    if (!game()) return; const gp = [typeof nunu !== 'undefined' ? nunu : null, typeof jeff !== 'undefined' ? jeff : null].filter(Boolean);
    for (const b of document.querySelectorAll('#roombar .rb')) { const r = b.dataset.r, on = gp.some(e => e.room === r && !e.hidden); if (b.classList.contains('cm-gp') !== on) b.classList.toggle('cm-gp', on); }
    layoutMap();
  });
  C.css('G37',
    // the strip dot: the same dot as .rb.busy:after (style.css:195)
    '.rb.cm-gp:after{content:"";position:absolute;right:2px;top:2px;width:7px;height:7px;border-radius:50%;background:#7bd36b;border:1px solid #fff}' +
    // outlines and the face never take a tap
    '.isosvg .cm-outline{fill:none;stroke:rgba(255,255,255,.55);stroke-width:1.5;stroke-dasharray:4 3;pointer-events:none}' +
    '.isosvg .cm-outline.cm-here{stroke:#ffcf4a;stroke-dasharray:none}' +
    '.isosvg .cm-g37-face,.isosvg .cm-g37-ring,.isosvg .cm-g37-lines{pointer-events:none}' +
    '.isosvg .cm-g37-ring{fill:#fff6dc;stroke:#ffcf4a;stroke-width:2;animation:cm-g37-ring .7s ease-in-out infinite alternate}' +
    '@keyframes cm-g37-ring{from{stroke-width:1.5;stroke-opacity:1}to{stroke-width:4;stroke-opacity:.55}}' +
    // her tile on another floor pulses with a ring around it (no transform, so it never grows onto the next tile)
    '.fmaproom.here{animation:cm-g37-here .7s ease-in-out infinite alternate}' +
    '@keyframes cm-g37-here{from{box-shadow:0 4px 0 rgba(0,0,0,.35),0 0 0 0 rgba(255,207,74,.95)}to{box-shadow:0 4px 0 rgba(0,0,0,.35),0 0 0 5px rgba(255,207,74,.5)}}' +
    '.fmaproom .cm-g37-you{position:absolute;right:1px;top:1px;height:min(22px,calc(100% - 2px));aspect-ratio:1/1;width:auto;border-radius:50%;box-shadow:0 0 0 2px #ffcf4a;pointer-events:none;image-rendering:pixelated}' +
    '.fmaproom .cm-g37-ppl{position:absolute;left:1px;bottom:1px;max-width:calc(100% - 2px);box-sizing:border-box;overflow:hidden;white-space:nowrap;font-size:11px;line-height:13px;height:13px;padding:0 2px;background:rgba(255,246,220,.72);border-radius:6px;pointer-events:none}' +
    '.fmaproom .cm-g37-ppl.cm-g37-by{max-width:max(14px,calc(100% - 25px))}' +
    // portrait stack: two spacers centre it; the house keeps its own size (it may only shrink if the screen is too short)
    '.cm-g37-sp{flex:1 1 0;min-height:16px}.cm-g37-sp2{flex:1 1 0}' +
    '.cm-g37-up{align-self:center}.cm-g37-up+.isowrap{flex:0 1 auto;min-height:0;margin-top:6px}');

  // ================================================================ G35 signs on doorways to another floor or outside; edge tabs
  // Signs: drawn on the picture right after their door (a drawProp after-hook), so people are drawn in front. A spot is used only
  // where every point of the sign does exactly what tapping the door does today: inside the door's own hit box, hitTest gives
  // that door, no wall exit tab or wildlife tab takes the tap first, and no HUD control is over it. Spots are chosen on room entry
  // and when the camera settles (not every frame); controls that come and go only skip drawing while they are over the sign.
  const G35 = C.G35 = { room: null, signs: [], need: true, prevCam: null, spotCam: null, view: '', hud: [], perm: [], wild: [], tab: null, tabDrawn: null };
  const SIGNS = { foyer: [['stairs', 'uphall']], uphall: [['ustairs', 'foyer']], den: [['bstairs'], ['dutch']], backyard: [['bkdoor']] };
  const SW = 28, SH2 = 15, PLATE = 'rgba(43,35,64,.7)';            // sign plate size (world units) and the wall tabs' plate colour
  const PERM = ['strip', 'pill', 'map', 'arrow', 'weather', 'mood', 'moodToggle'];
  function propBox(p) {                                             // the prop's box as hitTest sees it (game.js:395-397), without the pad
    let b; if (p.k.startsWith('p:')) b = [-p.w / 2, -p.h, p.w / 2, 0]; else { const sc = p.scale || 1; b = visBox(p.k).map(n => n * sc); }
    return [p.x + b[0], p.y + b[1], p.x + b[2], p.y + b[3]];
  }
  function badgeFor(to) {                                           // the ⬆️/⬇️ pill's own badge for that trip (floors.js:58)
    const f = Floors.of(to); return f.id === 'main' ? '🏠' : f.ico || (ROOMS[to] && ROOMS[to].ico) || '🪜';
  }
  function buildSigns() {
    G35.room = G.room; G35.signs = [];
    for (const [id, to0] of SIGNS[G.room] || []) {
      const p = PROPS[G.room].find(q => q.id === id); if (!p) continue; const to = to0 || p.to; if (!to || !ROOMS[to]) continue;
      const d = C.floorDir(G.room, to); if (!d) continue;
      G35.signs.push({ p, to, arrow: d > 0 ? '⬆️' : '⬇️', spot: null, ok: false, badT: 0 });
    }
  }
  const boxOf = s => [s[0] - SW / 2, s[1] - SH2 / 2, s[0] + SW / 2, s[1] + SH2 / 2];
  function clientBox(b) { const a = C.toClient(b[0], b[1]), z = C.toClient(b[2], b[3]); return [a[0], a[1], z[0], z[1]]; }
  const hits = (r, b, gap) => r[0] < b[2] + gap && r[2] > b[0] - gap && r[1] < b[3] + gap && r[3] > b[1] - gap;
  // checks that depend on the camera and on what is on screen right now (also run every frame before drawing)
  function frameOk(b) {
    const L = E.camX, R = E.camX + E.viewW;
    if (b[0] < L || b[2] > R) return false;
    if (b[3] > 38 && b[1] < 150 && (b[0] <= L + 14 || b[2] >= R - 14)) return false;           // wall exit tabs and wildlife tabs
    for (const [x, y] of [[b[0] + 0.5, b[1] + 0.5], [b[2] - 0.5, b[1] + 0.5], [b[0] + 0.5, b[3] - 0.5], [b[2] - 0.5, b[3] - 0.5]]) if (exitSignHit(x, y)) return false;
    for (const z of G35.wild) if (hits(z, b, 1)) return false;
    return true;
  }
  // taps anywhere on the sign reach this door: hitTest on a 5 x 3 grid over the whole sign (corners, edges and inside)
  function tapsDoor(b, p) {
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
      const h = hitTest(b[0] + 0.5 + (b[2] - b[0] - 1) * i / 4, b[1] + 0.5 + (b[3] - b[1] - 1) * j / 2);
      if (!h || h.kind !== 'prop' || !h.p || h.p.id !== p.id) return false;
    }
    return true;
  }
  // someone (or, in the backyard, an animal) is close enough to step onto the sign before the next 250 ms check
  const busyDoor = s => G.room === 'backyard' || ENTS.some(e => e.here && Math.abs(e.x - s.spot[0]) < 44);
  function onStage(cb) { const st = C.stageRect(); return cb[0] >= st.left && cb[2] <= st.right && cb[1] >= st.top && cb[3] <= st.bottom; }
  function candidates(p) {
    const bx = propBox(p), T = bx[1], h = bx[3] - bx[1], out = []; if (!(h > 0)) return out;
    const hb = [bx[0] - 4, bx[1] - 4, bx[2] + 4, bx[3] + 4], base = T + Math.min(46, h / 2);
    for (const dy of [0, -6, 6, -12, 12]) {
      const y = base + dy; if (y - SH2 / 2 <= hb[1] + 0.5 || y + SH2 / 2 >= hb[3] - 0.5 || y < T + 20) continue;
      for (let d = 0; d <= 80; d += 4) for (const sg of d ? [-1, 1] : [1]) { const x = p.x + sg * d; if (x - SW / 2 > hb[0] + 0.5 && x + SW / 2 < hb[2] - 0.5) out.push({ s: [x, y], cost: d + Math.abs(dy) * 1.5 }); }
    }
    return out.sort((a, b) => a.cost - b.cost).map(c => c.s);
  }
  function choose(s) {
    s.spot = null; s.ok = false;
    for (const sp of candidates(s.p)) {
      const b = boxOf(sp); if (!frameOk(b)) continue;
      const cb = clientBox(b); if (!onStage(cb) || G35.perm.some(r => hits(r, cb, 6)) || !tapsDoor(b, s.p)) continue;
      s.spot = sp; s.ok = true; s.badT = 0; return;
    }
  }
  function permRects() {               // the HUD that is always there; side arrows and the pill count even while faded out
    const out = C.hudRects(null, { client: true, kinds: PERM }).map(h => h[0]), R = ROOMS[G.room] || {};
    for (const b of document.querySelectorAll('.navarrow')) { if (!(b.classList.contains('l') ? R.left : R.right)) continue; const r = b.getBoundingClientRect(); if (r.width > 1) out.push([r.left, r.top, r.right, r.bottom]); }
    for (const b of document.querySelectorAll('#floorpill .fl')) { const r = b.getBoundingClientRect(); if (r.width > 1) out.push([r.left - 4, r.top - 4, r.right + 4, r.bottom + 4]); }
    return out;
  }
  function wildZones() {               // the deer / turkey edge tabs in the backyard take taps before anything else (wildlife.js:1008-1012)
    const z = []; if (G.room !== 'backyard' || !window.Wildlife) return z;
    try {
      const t = Wildlife.turkeyState && Wildlife.turkeyState.tab; if (t) z.push([t.x - 12, t.y - 13, t.x + 12, t.y + 13]);
      const v = Wildlife.state; if (v && v.deer) { const L = Math.max(E.camX, 0) + 14, R = Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14; z.push([L - 12, 73, L + 12, 99], [R - 12, 73, R + 12, 99]); }
    } catch (e) { }
    return z;
  }
  const quietScene = () => C.playing() && !C.screenOpen() && !(C.landscape() && document.getElementById('stage').classList.contains('tvon'));
  C.listen('room', 'G35', () => { G35.need = true; G35.tab = null; G35.tabDrawn = null; });
  C.every(250, 'G35', () => {
    if (!game() || !C.playing()) { G35.tab = null; return; }
    const view = [innerWidth, innerHeight, (E.viewW || 0).toFixed(1), (E.cssScale || 0).toFixed(3)].join(',');
    if (G35.room !== G.room || view !== G35.view) { G35.view = view; buildSigns(); G35.need = true; }
    G35.hud = C.hudRects(null, { client: true }).map(h => h[0]); G35.perm = permRects(); G35.wild = wildZones();
    const cam = E.camX, settled = G35.prevCam != null && Math.abs(cam - G35.prevCam) < 0.3; G35.prevCam = cam;
    const now = performance.now();
    if (G35.need || (settled && (G35.spotCam == null || Math.abs(cam - G35.spotCam) > 0.3))) {
      for (const s of G35.signs) choose(s); G35.need = false; G35.spotCam = cam;
    } else for (const s of G35.signs) {
      if (!s.spot) { if (settled) choose(s); continue; }
      s.ok = tapsDoor(boxOf(s.spot), s.p);                         // someone standing in the doorway takes those taps: hide meanwhile
      if (s.ok) s.badT = 0; else if (!s.badT) s.badT = now; else if (now - s.badT > 2000) choose(s);   // still blocked: look again
    }
    G35.tab = tabSpot();
  });
  C.hook('drawProp', 'G35', { order: 10, after(c) {
    if (c.skip || G35.room !== G.room) return; const p = c.args[0];
    for (const s of G35.signs) {
      if (s.p !== p || !s.spot || !s.ok || !quietScene()) continue;
      const b = boxOf(s.spot); if (!frameOk(b)) continue;
      const cb = clientBox(b); if (G35.perm.some(r => hits(r, cb, 6)) || G35.hud.some(r => hits(r, cb, 4))) continue;   // near a button (even a faded side arrow): skip this frame
      if (busyDoor(s) && !tapsDoor(b, s.p)) continue;                                    // someone is in the doorway right now: skip
      const [x, y] = s.spot; rect(b[0], b[1], SW, SH2, PLATE); emoji(s.arrow, x - 6.5, y + 0.5, 10); emoji(badgeFor(s.to), x + 6.5, y + 0.5, 10);
      s.at = performance.now(); s.cb = cb;                                              // when and where it was last drawn (read by the checks)
    }
  } });

  // ---- the edge tab: bathroom, spa and tree houses have no side arrows, and their way out starts off the picture
  function exitOf(room) {
    const R = ROOMS[room]; if (!R) return null;
    if (room === 'bathroom') return PROPS.bathroom.find(p => p.id === 'bathdoor') || null;
    if (room === 'spa') return PROPS.spa.find(p => p.id === 'spaback') || null;
    if (R.treehouse) return (PROPS[room] || []).find(p => p.id === 'th_hatch') || null;
    return null;
  }
  const tabHidden = () => G.busy || G.sceneOn || G.tidy || G.chase || ['bars', 'swing', 'tantrum'].includes(marina.state) || !quietScene();
  const exitOff = ex => ex.x < E.camX || ex.x > E.camX + E.viewW;
  const TZX = 11, TZY = 12;                                         // the tab takes taps within 11 x 12 of its centre (drawn: 9 x 10)
  const tabX = side => { const R = ROOMS[G.room]; return side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(E.camX + E.viewW, R.w) - 14; };
  function tabSpot() {
    const ex = exitOf(G.room); if (!ex || tabHidden() || !exitOff(ex)) return null;
    const side = ex.x < E.camX ? -1 : 1, x = tabX(side), to = ex.to || (ROOMS[G.room].treehouse ? 'backyard' : null); if (!to || !ROOMS[to]) return null;
    for (const y of [158, 161, 155, 164, 166, 151, 168, 146, 140, 130, 122, 114, 104, 96, 86]) {
      const b = [x - TZX, y - TZY, x + TZX, y + TZY];                 // the whole tap zone (the drawn tab is 18 x 20)
      let free = true; for (let i = 0; i <= 4 && free; i++) for (let j = 0; j <= 4 && free; j++) if (hitTest(b[0] + 0.5 + (b[2] - b[0] - 1) * i / 4, b[1] + 0.5 + (b[3] - b[1] - 1) * j / 4)) free = false;
      if (!free) continue;
      const cb = clientBox(b); if (!onStage(cb) || G35.hud.some(r => hits(r, cb, 2))) continue;
      return { room: G.room, side, y, exit: ex, to };
    }
    return null;
  }
  C.hook('drawExitSigns', 'G35', { order: 10, after(c) {
    if (c.skip) return; const t = G35.tab; G35.tabDrawn = null;
    if (!t || t.room !== G.room || tabHidden() || !exitOff(t.exit)) return;
    const x = tabX(t.side), y = t.y, bob = Math.sin(E.t * 4) * 1.5 * t.side;          // the turkey tab's look (wildlife.js:970)
    rect(x - 9 + bob, y - 10, 18, 20, PLATE); emoji(ROOMS[t.to].ico, x + bob, y - 3, 8); emoji(t.side < 0 ? '◀' : '▶', x + bob, y + 6, 6);
    G35.tabDrawn = { x, y, side: t.side, exit: t.exit, room: G.room, at: performance.now() };
  } });
  // A tap on the tab does exactly what the wall exit tabs do (features.js:381-385), toward the exit, and never changes room by
  // itself. Every other tap goes on to the game unchanged.
  C.hook('onTap', 'G35', { order: 20, before(c) {
    const t = G35.tabDrawn; if (!t || !game() || G.busy || t.room !== G.room || performance.now() - t.at > 250) return;
    const [wx, wy] = toWorld(c.args[0], c.args[1]); if (Math.abs(wx - t.x) >= TZX || Math.abs(wy - t.y) >= TZY) return;
    if (['bars', 'swing', 'tantrum'].includes(marina.state) || hitTest(wx, wy)) return;
    UI.closeActions(); if (marina.state === 'perch') { marina.offY = 0; marina.state = 'idle'; }
    if (['sit', 'cheer', 'sad'].includes(marina.state)) marina.state = 'idle';
    const mover = marina.mount || marina; Audio2.blip(9, 'triangle', 0.05, 0.1);
    mover.walkTo(t.exit.x - t.side * 20, null, marina.mount ? 75 : null, FLOOR);
    c.skip = true;
  } });
})();
