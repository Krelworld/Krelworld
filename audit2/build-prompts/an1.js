// analyse batch-1 sims (logs/on_* vs logs/off_*): G1, G2, G20, G21, G29 counts and rule checks.
const fs = require('fs'); const D = __dirname + '/logs/';
const files = fs.readdirSync(D).filter(f => /^(on|off)_/.test(f));
const load = f => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const OWN = /^(st_|m_cooking|m_draw|m_open|tv_|d_tv|mo_tv|r_tv|m_tv|m_pretty|m_swing|m_yay|m_swim|m_pool|m_splash|m_lego|nu_lego|m_build|j_build|m_movie|nu_movie|m_spa|m_stuff|m_climb|j_tree|m_tree)/;
const out = { acttable: [], perRun: [], edges: {}, g20: {}, g21: {}, helloKeys: { on: {}, off: {} } };
const HELLO = /^(d_hi[0-9]|d_hi_tired|mo_hi[0-9]|r_hi_niece[23]?|nu_hi[0-9]|j_hi[0-9])$/;
for (const f of files.sort()) {
  const o = load(f), Lg = o.log, mode = f.startsWith('on_') ? 'on' : 'off', name = f.replace(/^(on|off)_/, '').replace('.json', '');
  const start = (Lg.find(e => e.type === 'mark' && /start|open/.test(e.what)) || Lg[0]).t;
  const states = k => Lg.filter(e => e.type === 'state' && e.k === k && e.v && e.t >= start);
  // ---- acttable (activities): first wish / request / any prompt after closing, and whether a wish still came with no touches
  const op = Lg.find(e => e.type === 'mark' && e.what === 'open'), cl = Lg.find(e => e.type === 'mark' && e.what === 'close');
  if (op && cl) {
    const inside = Lg.filter(e => e.t > op.t + 1 && e.t < cl.t && ((e.type === 'voice' && !OWN.test(e.key)) || (e.type === 'state' && /^(wish|req|alerts)$/.test(e.k) && e.v) || (e.type === 'sfx' && /baby_cry|minka_mew/.test(e.k))));
    const fw = Lg.find(e => e.t >= cl.t && e.type === 'state' && e.k === 'wish' && e.v), fr = Lg.find(e => e.t >= cl.t && e.type === 'state' && e.k === 'req' && e.v);
    const fa = Lg.find(e => e.t >= cl.t && ((e.type === 'state' && /^(wish|req|alerts)$/.test(e.k) && e.v)));
    out.acttable.push({ mode, act: name.split('_')[1], insideCount: inside.length, firstWishAfterCloseS: fw ? +(fw.t - cl.t).toFixed(1) : null, firstReqAfterCloseS: fr ? +(fr.t - cl.t).toFixed(1) : null, firstPromptAfterClose: fa ? '+' + (fa.t - cl.t).toFixed(1) + ' ' + fa.k + '=' + fa.v : null, postS: +(o.Et - cl.t).toFixed(0) });
  }
  // ---- per run counts
  const wishes = states('wish'), reqs = states('req');
  const wishRooms = {}; for (const w of wishes) wishRooms[w.room] = (wishRooms[w.room] || 0) + 1;
  const reqRooms = {}; for (const w of reqs) reqRooms[w.room] = (reqRooms[w.room] || 0) + 1;
  const tidyLines = Lg.filter(e => e.type === 'voice' && /^(d|mo|r)_tidy$/.test(e.key) && e.t >= start);
  const tidyRings = Lg.filter(e => e.type === 'acts' && e.icons === '🧹🏃' && e.t >= start);
  const mews = Lg.filter(e => e.type === 'mew' && e.t >= start), paws = Lg.filter(e => e.type === 'paw2' && e.t >= start);
  const hellosV = Lg.filter(e => e.type === 'voice' && HELLO.test(e.key) && e.t >= start);
  for (const h of hellosV) out.helloKeys[mode][h.key] = (out.helloKeys[mode][h.key] || 0) + 1;
  const walkups = Lg.filter(e => e.type === 'walkup' && e.t >= start), stays = Lg.filter(e => e.type === 'rorystay' && e.t >= start);
  const roryLines = Lg.filter(e => e.type === 'voice' && /^r_(giggle|hi_niece3|chase|hi_niece)$/.test(e.key) && e.t >= start && walkups.some(w => e.t > w.t && e.t - w.t < 4));
  const roryRoomCh = Lg.filter(e => e.type === 'roryroom' && e.t >= start).length;
  out.perRun.push({ mode, run: name, minutes: +((o.Et - start) / 60).toFixed(1), wishes: wishes.length, wishRooms, reqs: reqs.length, reqRooms, wishIdleMin: wishes.length ? Math.min(...wishes.map(w => w.idle)) : null, reqIdleMin: reqs.length ? Math.min(...reqs.map(w => w.idle)) : null,
    tidyLines: tidyLines.length, tidyLinesInAct: tidyLines.filter(e => e.act).length, tidyRingsInAct: tidyRings.filter(e => e.act).length,
    mews: mews.length, farMews: mews.filter(m => m.far).length, pawParticles: paws.length, hellos: hellosV.length, walkups: walkups.length, walkupsBodyBusy: walkups.filter(w => ['swing', 'bars', 'ride', 'wheel'].includes(w.st)).length, roryStays: stays.length, roryWalkupLines: roryLines.map(e => e.key + '@' + e.t.toFixed(0)).join(' '), roryRoomChanges: roryRoomCh, errors: o.meta.errors.length });
  // ---- G1: activity edges and their causes
  for (const e of Lg.filter(e => e.type === 'edge' && e.dir === 'end' && e.t >= start)) { const k = mode + ' ' + e.causes; (out.edges[k] = out.edges[k] || []).push(name.replace(/_port|_15m|_6m/g, '') + '@' + e.t.toFixed(0)); }
  // ---- G20: walk-in hellos per person at most once per 180 s (on); greetctx after each hello; own-entry 30 s rule
  const greetBy = Lg.filter(e => e.type === 'oerb' && e.greeted && !e.skip);
  const per = {}; for (const e of greetBy) (per[e.who] = per[e.who] || []).push(e.t);
  const minGap = {}; for (const k in per) { const ts = per[k]; let m = Infinity; for (let i = 1; i < ts.length; i++) m = Math.min(m, ts[i] - ts[i - 1]); minGap[k] = ts.length > 1 ? +m.toFixed(0) : null; }
  const own = Lg.filter(e => e.type === 'oer' && e.greeted); const ownPer = {}; for (const e of own) for (const w of e.greeted.split(',')) (ownPer[w] = ownPer[w] || []).push(e.t);
  const ownMin = {}; for (const k in ownPer) { const ts = ownPer[k]; let m = Infinity; for (let i = 1; i < ts.length; i++) m = Math.min(m, ts[i] - ts[i - 1]); ownMin[k] = ts.length > 1 ? +m.toFixed(0) : null; }
  // every hello voice gets a greet mood context within 5 s (or the line was cut by something else)
  const ctx = Lg.filter(e => e.type === 'greetctx');
  const noCtx = hellosV.filter(h => !ctx.some(c => c.t >= h.t && c.t - h.t < 6)).map(h => h.key + '@' + h.t.toFixed(0));
  out.g20[mode + ' ' + name] = { walkInHellos: greetBy.length, held: Lg.filter(e => e.type === 'oerb' && e.skip).length, walkInMinGapS: minGap, ownEntryHellos: own.length, ownMinGapS: ownMin, hellosWithoutGreetCtx: noCtx };
}
fs.writeFileSync(__dirname + '/an1.json', JSON.stringify(out, null, 1));
// print compact tables
const pair = (arr, key) => { const m = {}; for (const r of arr) (m[r[key]] = m[r[key]] || {})[r.mode] = r; return m; };
console.log('ACTTABLE act | on: inside / wish+ / req+ / first | off: inside / wish+ / req+ / first');
for (const [a, v] of Object.entries(pair(out.acttable, 'act'))) { const f = r => r ? `${r.insideCount} / ${r.firstWishAfterCloseS} / ${r.firstReqAfterCloseS} / ${r.firstPromptAfterClose}` : '-'; console.log(a.padEnd(9), '|', f(v.on), '|', f(v.off)); }
console.log('\nPER RUN (on | off): wishes reqs tidyInAct hellos walkups(bodyBusy) stays roryRoomCh farMews paws errors');
for (const [run, v] of Object.entries(pair(out.perRun, 'run'))) { const f = r => r ? `w${r.wishes} r${r.reqs} wIdleMin${r.wishIdleMin} rIdleMin${r.reqIdleMin} tidy${r.tidyLines}/inAct${r.tidyLinesInAct}/ringInAct${r.tidyRingsInAct} hello${r.hellos} wu${r.walkups}(${r.walkupsBodyBusy}) stay${r.roryStays} rc${r.roryRoomChanges} far${r.farMews} paws${r.pawParticles} e${r.errors}` : '-'; console.log(run.padEnd(34), f(v.on), ' | ', f(v.off)); }
console.log('\nEDGES (activityEnd causes):'); for (const [k, v] of Object.entries(out.edges).sort()) console.log(k.padEnd(40), v.length, v.slice(0, 6).join(' '));
console.log('\nHELLO KEYS on:', JSON.stringify(out.helloKeys.on)); console.log('HELLO KEYS off:', JSON.stringify(out.helloKeys.off));
