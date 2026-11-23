// G15: mood shake during #moodbar.pulse, #reqBtn asleep during a scene, the map during a scene. node t_g15_more.js <view> [off]
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G15' : '';
(async () => {
  const R = {}; const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms), now = () => ev(() => performance.now());
  const bring = () => ev(() => { UI.closeActions(); G.moodCtx = null; for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.here = true; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } if (innerWidth > innerHeight) document.getElementById('moodbar').classList.remove('collapsed'); });
  const waitQuiet = async () => { for (let i = 0; i < 160; i++) { if (await ev(() => !G.busy && !G.sceneOn)) return; await wait(250); } };
  const center = sel => ev(sel => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); if (b.width < 2) return null; return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  const tapSel = async sel => { const c = await center(sel); if (!c) return false; await P.touchscreen.tap(c[0], c[1]); return true; };
  const info = sel => ev(sel => { const n = document.querySelector(sel); if (!n) return null; const cs = getComputedStyle(n); return { transform: cs.transform, translate: cs.translate, anims: n.getAnimations().map(a => (a.animationName || 'waapi') + ':' + a.playState), opacity: cs.opacity }; }, sel);
  const scene = async m => { for (let k = 0; k < 4; k++) { await waitQuiet(); await g.calm(); await bring(); await wait(300); await tapSel('.mood[data-mood=' + m + ']'); await wait(250); if (await ev(() => G.sceneOn)) return true; } return false; };
  // 1. a dead tap on a wobbling mood face (#moodbar.pulse) still shakes; the bar itself never moves
  R.pulse = { started: await scene('sad') }; await ev(() => UI.pulseMoods()); await wait(600);
  R.pulse.sceneAtTap = await ev(() => G.sceneOn); const t = await now(); await tapSel('.mood[data-mood=angry]'); await wait(40);
  R.pulse.mid = await info('.mood[data-mood=angry]'); R.pulse.bar = await ev(() => getComputedStyle(document.getElementById('moodbar')).transform + ' pulse=' + document.getElementById('moodbar').classList.contains('pulse'));
  await wait(500); R.pulse.after = await info('.mood[data-mood=angry]'); const s = await ev(t => __T.since(t), t); R.pulse.nope = s.nope; R.pulse.skipped = s.skipped; R.pulse.mood = await ev(() => G.mood);
  console.log(view, off || 'on', 'pulse', JSON.stringify(R.pulse));
  // 2. #reqBtn during a scene: dims after the hold, a tap shakes + low blip and changes nothing (today's rule)
  R.req = { started: await scene('love') }; await ev(() => askRequest('cook')); await wait(650);
  R.req.sceneAtTap = await ev(() => G.sceneOn); R.req.look = await ev(() => { const n = document.getElementById('reqBtn'); return n ? getComputedStyle(n).opacity + ' ' + getComputedStyle(n).filter : null; });
  const pre = await ev(() => ({ req: !!document.getElementById('reqBtn'), room: G.room })), t2 = await now(); R.req.tapped = await tapSel('#reqBtn'); await wait(300);
  const s2 = await ev(t => __T.since(t), t2); R.req.shakes = s2.shakes.length; R.req.nope = s2.nope; R.req.post = await ev(() => ({ req: !!document.getElementById('reqBtn'), room: G.room })); R.req.pre = pre;
  console.log(view, off || 'on', 'req', JSON.stringify(R.req));
  // 3. the map still opens during a scene, and is never dimmed
  R.map = { started: await scene('happy') }; await wait(600);
  R.map.during = await ev(() => ({ scene: !!G.sceneOn, app: document.getElementById('app').className, o: getComputedStyle(document.getElementById('mapBtn')).opacity, f: getComputedStyle(document.getElementById('mapBtn')).filter }));
  await tapSel('#mapBtn'); await wait(700); R.map.opened = await ev(() => !document.getElementById('panel').classList.contains('hidden'));
  await ev(() => { if (UI.panelMode) UI.closePanel(); }); console.log(view, off || 'on', 'map', JSON.stringify(R.map));
  R.errors = g.errors.filter(e => !/chip_love/.test(e)); console.log(view, off || 'on', 'errors', JSON.stringify(R.errors));
  fs.writeFileSync(L.OUT + 'g15_more_' + view + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
