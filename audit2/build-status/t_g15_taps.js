// G15 check 2: taps. node t_g15_taps.js <view> [off]   (off = CLARITY_OFF=G15, to compare outcomes with today's)
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G15' : '';
(async () => {
  const R = {}; const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms);
  const now = () => ev(() => performance.now());
  const bring = () => ev(() => { UI.closeActions(); for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.here = true; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } if (innerWidth > innerHeight) document.getElementById('moodbar').classList.remove('collapsed'); });
  const waitQuiet = async () => { for (let i = 0; i < 160; i++) { if (await ev(() => !G.busy && !G.sceneOn)) return; await wait(250); } };
  const state = () => ev(() => ({ room: G.room, mood: G.mood, busy: !!G.busy, scene: !!G.sceneOn, panel: !document.getElementById('panel').classList.contains('hidden'), holding: G.holding && G.holding.type, req: !!document.getElementById('reqBtn'), alerts: [...document.querySelectorAll('#alerts .alertb')].map(n => n.getAttribute('aria-label')).join(','), mx: Math.round(marina.x), moving: !!marina.moving }));
  const center = sel => ev(sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); if (b.width < 2) return null; return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  const tapSel = async sel => { const c = await center(sel); if (!c) return false; await P.touchscreen.tap(c[0], c[1]); return true; };
  const shakeInfo = sel => ev(sel => { const n = document.querySelector(sel); if (!n) return null; const cs = getComputedStyle(n); return { transform: cs.transform, translate: cs.translate, anims: n.getAnimations().map(a => (a.animationName || 'waapi') + ':' + a.playState), opacity: cs.opacity }; }, sel);

  // ---------------- A. dead taps during a scene: outcome must equal today's; G15 adds one shake + one low blip each
  await bring(); await ev(() => { G.holding = { type: 'pic', url: 'assets/icon-test.png' }; }); await wait(600);
  await tapSel('.mood[data-mood=love]'); await wait(1100);
  R.sceneOn = await state();
  const targets = ['#roombar .rb[data-r=kitchen]', '#roombar .rb.here', '#floorpill .fl.up', '#floorpill .fl.down', '.mood[data-mood=happy]', '#alerts .alertb[aria-label=picgive]', '#alerts .alertb[aria-label=pickeep]', '.facecard.show:not([data-who=marina])', '.facecard.show[data-who=marina]'];
  R.dead = {};
  for (const sel of targets) {
    if (!(await ev(() => G.sceneOn))) { R.dead[sel] = 'scene ended before this tap'; continue; }
    const pre = await state(), t = await now(); const ok = await tapSel(sel); if (!ok) { R.dead[sel] = 'not on screen'; continue; }
    const mid = await (async () => { await wait(40); return shakeInfo(sel); })();
    await wait(350); const post = await state(); const s = await ev(t => __T.since(t), t);
    R.dead[sel] = { sameOutcome: JSON.stringify({ ...pre, mx: 0, moving: 0 }) === JSON.stringify({ ...post, mx: 0, moving: 0 }), pre, post, shakes: s.shakes.length, shakeOpt: s.shakes.map(x => x.o), nope: s.nope, moodBlipIn: s.moodBlipIn, moodBlipRan: s.moodBlipRan, skipped: s.skipped, blips: s.blips, rings: s.rings.length, mid };
    console.log(view, off || 'on', 'dead', sel, JSON.stringify(R.dead[sel]).slice(0, 600));
  }
  // shake composition: .rb.here keeps scale(1.12), alert pulse and the moods' pulse keep running, face card scale intact
  if (await ev(() => G.sceneOn)) {
    await ev(() => UI.pulseMoods()); await wait(200);
    const t = await now(); await tapSel('.mood[data-mood=angry]'); await wait(40);
    R.compose = { moodMid: await shakeInfo('.mood[data-mood=angry]'), bar: await ev(() => getComputedStyle(document.getElementById('moodbar')).transform) };
    await tapSel('#roombar .rb.here'); await wait(40); R.compose.rbHereMid = await shakeInfo('#roombar .rb.here');
    await tapSel('#alerts .alertb[aria-label=picgive]'); await wait(40); R.compose.alertMid = await shakeInfo('#alerts .alertb[aria-label=picgive]');
    if (await center('.facecard.show')) { await tapSel('.facecard.show'); await wait(40); R.compose.faceMid = await shakeInfo('.facecard.show'); }
    await wait(700);
    R.compose.after = { rbHere: await shakeInfo('#roombar .rb.here'), alert: await shakeInfo('#alerts .alertb[aria-label=picgive]'), mood: await shakeInfo('.mood[data-mood=angry]'), face: await shakeInfo('.facecard.show') };
    console.log(view, off || 'on', 'compose', JSON.stringify(R.compose));
  }
  // the scene ring: tap the picture during the scene
  if (await ev(() => G.sceneOn)) {
    const spot = await ev(() => { const x = clamp(marina.x - 70, 20, ROOMS[G.room].w - 20); return [x, 150]; });
    const t = await now(); const pt = await g.tapWorld(spot[0], spot[1]); await wait(120);
    const live = await ev(() => { const n = document.querySelector('.cm-g15-ring'); return n ? { pe: getComputedStyle(n).pointerEvents, w: n.getBoundingClientRect().width, under: document.elementFromPoint(n.getBoundingClientRect().left + 18, n.getBoundingClientRect().top + 18).id } : null; });
    await wait(450); const s = await ev(t => __T.since(t), t);
    R.ring = { live, rings: s.rings, nope: s.nope, taps: s.taps, goneAfter400: await ev(() => !document.querySelector('.cm-g15-ring')) };
    console.log(view, off || 'on', 'ring', JSON.stringify(R.ring));
    // a tap 100 ms after the scene ends, at the same spot, reaches onTap normally
    await P.waitForFunction(() => !G.busy && !G.sceneOn, null, { polling: 'raf', timeout: 30000 }); await wait(100);
    const t2 = await now(); const pre = await state(); await P.touchscreen.tap(pt[0], pt[1]); await wait(400); const s2 = await ev(t => __T.since(t), t2); const post = await state();
    R.afterScene = { taps: s2.taps, rings: s2.rings.length, nope: s2.nope, walked: post.moving || post.mx !== pre.mx, pre, post };
    console.log(view, off || 'on', 'afterScene', JSON.stringify(R.afterScene));
  }
  await ev(() => { G.holding = null; }); await waitQuiet();

  // ---------------- B. #reqBtn during a scene: asleep and 'not now'; it still does nothing (today's rule)
  await g.calm(); await bring(); await wait(400); await ev(() => setMood('happy')); await wait(300);
  await ev(() => askRequest('cook')); await wait(700);
  const rq = { op: await ev(() => { const n = document.getElementById('reqBtn'); return n ? getComputedStyle(n).opacity + ' ' + getComputedStyle(n).filter : null; }) };
  if (await center('#reqBtn')) { const pre = await state(), t = await now(); await tapSel('#reqBtn'); await wait(300); const s = await ev(t => __T.since(t), t); rq.shakes = s.shakes.length; rq.nope = s.nope; rq.post = await state(); rq.sameOutcome = pre.req === rq.post.req && pre.room === rq.post.room; }
  R.req = rq; console.log(view, off || 'on', 'req', JSON.stringify(rq));
  await waitQuiet();

  // ---------------- C. the first tap after busy clears works, with no shake and no low blip (0, 150, 350 ms)
  R.first = [];
  for (const d of [0, 150, 350]) for (const kind of ['strip', 'mood']) {
    await waitQuiet(); await g.calm(); if (await ev(() => G.room !== 'living')) { await ev(() => travelTo('living')); await wait(2500); await g.calm(); }
    await bring(); await wait(300); await ev(() => setMood('happy'));
    await P.waitForFunction(() => G.sceneOn, null, { polling: 'raf', timeout: 5000 }).catch(() => { });
    await P.waitForFunction(() => !G.busy && !G.sceneOn, null, { polling: 'raf', timeout: 30000 });
    if (d) await wait(d);
    const t = await now(), app = await ev(() => document.getElementById('app').className);
    if (kind === 'strip') { await tapSel('#roombar .rb[data-r=kitchen]'); await wait(300); }
    else { await tapSel('.mood[data-mood=love]'); await wait(300); }
    const s = await ev(t => __T.since(t), t), st = await state();
    const r = { delay: d, kind, appAtTap: app, shakes: s.shakes.length, nope: s.nope, worked: kind === 'strip' ? (st.room === 'kitchen' || st.moving || s.blips.some(b => b.startsWith('9,triangle'))) : st.scene, stripBlip: s.blips.filter(b => b.startsWith('9,triangle')).length, moodBlipRan: s.moodBlipRan };
    R.first.push(r); console.log(view, off || 'on', 'first', JSON.stringify(r));
    await waitQuiet();
  }

  // ---------------- D. tantrum outside a scene: faces bright and working
  await waitQuiet(); await g.calm(); if (await ev(() => G.room !== 'living')) { await ev(() => travelTo('living')); await wait(2500); await g.calm(); }
  await bring(); await wait(300); await ev(() => { tantrum(false); }); await wait(900);
  const tsnap = await ev(() => __T.snap()); const tt = await now(); await tapSel('.mood[data-mood=happy]'); await wait(400);
  const ts = await ev(t => __T.since(t), tt), tpost = await state();
  R.tantrum = { during: { app: tsnap.app, st: tsnap.st, busy: tsnap.busy, scene: tsnap.scene, moods: tsnap.moods }, tap: { shakes: ts.shakes.length, nope: ts.nope, moodBlipRan: ts.moodBlipRan, mood: tpost.mood, scene: tpost.scene } };
  console.log(view, off || 'on', 'tantrum', JSON.stringify(R.tantrum));
  await waitQuiet();

  // ---------------- E. bathTime: canvas taps still make bubbles, no grey ring; a strip tap shakes without piling a blip on the bath sound
  await g.calm(); await ev(() => travelTo('bathroom')); await wait(3000); await g.calm();
  const sh = await ev(() => { const p = PROPS.bathroom.find(q => q.id === 'shower'); marina.x = p.x + 30; return [p.x, p.y - 50]; }); await wait(300);
  await g.tapWorld(sh[0], sh[1]); await wait(600);
  const bt = await ev(() => { const n = [...document.querySelectorAll('.act')].find(n => n.textContent.includes('🛁')); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  if (!bt) { await ev(() => { const p = PROPS.bathroom.find(q => q.id === 'shower'); UI.actions(p, propActions(p)); }); await wait(500); }
  const bt2 = await ev(() => { const n = [...document.querySelectorAll('.act')].find(n => n.textContent.includes('🛁')); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  R.bath = { ringViaTap: !!bt };
  if (bt2) {
    await P.touchscreen.tap(bt2[0], bt2[1]); await wait(900);
    R.bath.state = await ev(() => ({ busy: !!G.busy, scene: !!G.sceneOn, st: marina.state, app: document.getElementById('app').className }));
    const t = await now(); await g.tapWorld(await ev(() => marina.x - 40), 120); await wait(150);
    const s = await ev(t => __T.since(t), t); const bubbles = await ev(t => __T.em.filter(e => e.at >= t && ['🫧', '🦆', '⭐'].includes(e.ch)).length, t);
    R.bath.canvasTap = { bubbles, rings: s.rings.length, nope: s.nope, taps: s.taps.length, blips: s.blips };
    const t2 = await now(); await tapSel('#roombar .rb[data-r=kitchen]'); await wait(300); const s2 = await ev(t => __T.since(t), t2);
    R.bath.stripTap = { shakes: s2.shakes.length, nope: s2.nope, blips: s2.blips, room: await ev(() => G.room) };
    console.log(view, off || 'on', 'bath', JSON.stringify(R.bath));
  } else console.log(view, off || 'on', 'bath: no 🛁 choice found');
  await waitQuiet();

  // ---------------- F. Marina's own card: a little wiggle and a soft blip, nothing else
  await g.calm(); await ev(() => travelTo('living')); await wait(2500); await g.calm();
  await ev(() => { say('m_wow'); }); await wait(250);
  if (await center('.facecard.show[data-who=marina]')) { const pre = await state(), t = await now(); await tapSel('.facecard.show[data-who=marina]'); await wait(300); const s = await ev(t => __T.since(t), t); const post = await state();
    R.marinaCard = { shakes: s.shakes.map(x => x.o), blips: s.blips, same: JSON.stringify(pre) === JSON.stringify(post) }; } else R.marinaCard = 'card not shown';
  console.log(view, off || 'on', 'marinaCard', JSON.stringify(R.marinaCard));

  // ---------------- G. the map still opens during a scene (not dimmed)
  await waitQuiet(); await g.calm(); await bring(); await wait(300); await ev(() => setMood('love')); await wait(900);
  R.map = { during: await ev(() => ({ scene: !!G.sceneOn, o: getComputedStyle(document.getElementById('mapBtn')).opacity, f: getComputedStyle(document.getElementById('mapBtn')).filter })) };
  await tapSel('#mapBtn'); await wait(700); R.map.opened = await ev(() => !document.getElementById('panel').classList.contains('hidden'));
  await ev(() => { if (UI.panelMode) UI.closePanel(); }); console.log(view, off || 'on', 'map', JSON.stringify(R.map));
  await waitQuiet();

  // ---------------- H. landscape TV-on hiding of the strip and pill is unchanged
  if (view === 'land') { await g.calm(); await ev(() => tvOn(showList()[0])); await wait(1000);
    R.tv = await ev(() => ({ roombar: getComputedStyle(document.getElementById('roombar')).opacity, rbPE: getComputedStyle(document.getElementById('roombar')).pointerEvents, pill: getComputedStyle(document.getElementById('floorpill')).opacity, alerts: getComputedStyle(document.getElementById('alerts')).opacity, app: document.getElementById('app').className }));
    console.log(view, off || 'on', 'tv', JSON.stringify(R.tv)); await ev(() => { if (window.tvOff) tvOff(); }); }

  R.errors = g.errors.filter(e => !/chip_love/.test(e)); console.log(view, off || 'on', 'errors', JSON.stringify(R.errors));
  fs.writeFileSync(L.OUT + 'g15_taps_' + view + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1));
  await g.close();
})().catch(e => { console.error(e); process.exit(1); });
