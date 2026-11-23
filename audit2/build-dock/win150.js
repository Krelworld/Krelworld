// the request's 150 s completion window: done within it → thanks; done after it → no thanks (G25 on vs off)
const L = require('./lib.js');
(async () => { const res = await Promise.all([[undefined, 8896], ['G25,G31', 8897]].map(async ([off, port]) => { const g = await L.boot({ port, view: 'port', room: 'playroom', off }); await g.calm();
  const setup = () => { window.__said = window.__said || []; if (!window.__sw) { window.__sw = 1; const s = window.say; window.say = function (k, e) { __said.push(k); return s.apply(this, arguments); }; } rory.room = G.room; rory.hidden = false; rory.state = 'idle'; rory.x = marina.x + 60; G.rory = true; __said.length = 0; };
  await g.ev(setup); await g.ev(() => askRequest('gym')); await g.wait(3000); await g.ev(() => did('gym')); await g.wait(9000); const within = await g.ev(() => __said.includes('r_thanks'));
  await g.ev(setup); await g.ev(() => askRequest('tea')); await g.wait(152000); await g.ev(() => { rory.room = G.room; rory.hidden = false; rory.x = marina.x + 60; __said.length = 0; did('tea'); }); await g.wait(9000); const after = await g.ev(() => __said.includes('r_thanks'));
  await g.close(); return { build: off ? 'dock G25,G31 off' : 'dock on', thankedWithin150s: within, thankedAfter152s: after, errs: g.errs() }; }));
  console.log(JSON.stringify(res)); })().catch(e => { console.error(e); process.exit(1); });
