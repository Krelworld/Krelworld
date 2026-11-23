// turns a sim log into an interruption timeline + counts. usage: node analyze.js logs/<file>.json [--timeline]
const fs = require('fs');
const AMBIENT = /^(d|mo|r)_hi|^r_(giggle|chase|hi2)|^nu_(sweep|laundry|clean|clutter|lotr|smell|septic[123]|love|kiss|hi|minka_where|catfight|minka_trust|minka_shy|shelf)|^d_phone[0-9]|^j_(work|helper|turkey|squirrel|deer|hi)|^m_(deer|minka_where|hi_nunu|hi_jeff|stinky|ugh_niko|want_|should_|precious|look|wow|minka_love)|_catfight|^d_niko_poo|_(tidy|mess[12])$|_req_|^m_sticker|^(d|mo|r)_thanks|^nu_septic_thanks/;
function analyze(file, opts = {}) {
  const o = JSON.parse(fs.readFileSync(file, 'utf8')); const log = o.log; const start = (log.find(e => e.type === 'mark' && /start|open/.test(e.what)) || log[0]).t;
  const ev = []; const add = (e, kind, what) => ev.push({ t: e.t, kind, what, ctx: e.act ? 'ACT' : e.mv ? 'walk' : 'idle', room: e.room, since: e.idle, st: e.st });
  const prevAlerts = new Set(); let lastGo = null;
  for (const e of log) {
    if (e.t < start) continue;
    if (e.type === 'state') {
      if (e.k === 'wish' && e.v) add(e, 'WISH', e.v);
      if (e.k === 'req' && e.v) add(e, 'REQUEST', e.v);
      if (e.k === 'alerts') { const now = new Set((e.v || '').split(',').filter(Boolean)); for (const a of now) if (!prevAlerts.has(a)) add(e, 'ALERT', a); prevAlerts.clear(); now.forEach(a => prevAlerts.add(a)); }
      if (e.k === 'minkaMarkers' && e.v) add(e, 'MINKA-🔍', 'markers on');
      if (e.k === 'minkaFight' && e.v) add(e, 'MINKA-FIGHT', e.v);
      if (e.k === 'deer' && e.v) add(e, 'DEER', 'arrive');
      if (e.k === 'deerTab' && e.v) add(e, 'DEER-TAB', 'edge tab');
      if (e.k === 'turkeys' && e.v) add(e, 'TURKEYS', 'arrive');
      if (e.k === 'turkeyTab' && e.v) add(e, 'TURKEY-TAB', 'edge tab');
      if (e.k === 'daddyPhone' && e.v) add(e, 'DADDY-PHONE', 'on screen');
      if (e.k === 'nunuFace' && e.v === '👃') add(e, 'SMELL', 'nunu 👃');
      if (e.k === 'toast' && e.v) add(e, 'STICKER', e.v);
      if (e.k === 'acts' && e.v > 0 && e.was === 0 && e.idle > 1.2) add(e, 'RING(unasked)', e.v + ' buttons');
      if (e.k === 'moodPulse' && e.v) add(e, 'MOOD-PULSE', '');
      if (e.k === 'bounce' && e.v) add(e, 'idle-wiggle', e.v.split('@')[0]);
    }
    if (e.type === 'voice') { const amb = AMBIENT.test(e.key); if (amb || e.idle > 3) add(e, amb ? 'VOICE' : 'voice?', e.key); }
    if (e.type === 'sfx' && /baby_cry|minka_mew|turkey|fart|knock/.test(e.k)) add(e, 'SOUND', e.k);
    if (e.type === 'big' && e.idle > 1.5 && !(lastGo != null && e.t - lastGo < 1.5)) add(e, 'BIG-ICON', e.ch);
    if (e.type === 'mark' && /^go /.test(e.what || '')) lastGo = e.t;
    if (e.type === 'paw') add(e, 'PAWS', '🐾');
  }
  // episodes: anything within 4 s of the previous counted thing belongs to it (idle wiggles, mood pulses and paws do not start an episode)
  const major = ev.filter(x => !['idle-wiggle', 'MOOD-PULSE', 'PAWS', 'voice?'].includes(x.kind));
  const eps = []; for (const x of major) { const l = eps[eps.length - 1]; if (l && x.t - l.end <= 4) { l.items.push(x); l.end = x.t; } else eps.push({ t: x.t, end: x.t, items: [x], ctx: x.ctx }); }
  const dur = (o.Et - start) / 60;
  const count = {}; for (const x of ev) count[x.kind] = (count[x.kind] || 0) + 1;
  const vk = {}; for (const x of ev.filter(x => x.kind === 'VOICE')) { const k = x.what.replace(/\d+$/, '#'); vk[k] = (vk[k] || 0) + 1; }
  // seconds with an alert on screen / any prompt overlay
  const occ = o.occ.filter(([t]) => t >= start); const withAny = occ.filter(([, n]) => n > 0).length;
  let alertOn = 0, last = null, cur = ''; for (const e of log) { if (e.t < start || e.type !== 'state' || e.k !== 'alerts') continue; if (last != null && cur) alertOn += e.t - last; last = e.t; cur = e.v; } if (cur && last != null) alertOn += o.Et - last;
  const gaps = eps.map((e, i) => i ? e.t - eps[i - 1].t : null).filter(x => x != null).sort((a, b) => a - b);
  const res = { file: file.split('/').pop(), minutes: +dur.toFixed(1), episodes: eps.length, perMin: +(eps.length / dur).toFixed(2), medianGapS: gaps.length ? Math.round(gaps[gaps.length >> 1]) : null, maxQuietS: gaps.length ? Math.round(gaps[gaps.length - 1]) : null,
    secsWithOverlay: withAny, secsTotal: occ.length, secsAlertShown: Math.round(alertOn), count, voices: vk, errors: o.meta.errors };
  if (opts.timeline) res.timeline = eps.map(e => `${mmss(e.t - start)} [${e.items[0].room}/${e.ctx}] ` + e.items.map(x => x.kind + ':' + x.what).join(' + '));
  return res;
}
const mmss = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
module.exports = { analyze };
if (require.main === module) { const r = analyze(process.argv[2], { timeline: process.argv.includes('--timeline') }); console.log(JSON.stringify(r, null, 1)); }
