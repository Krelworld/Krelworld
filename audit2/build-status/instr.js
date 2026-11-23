// in-page test instrumentation (evaluated after boot). Uses hook id 'core' so it also logs when G15 is switched off.
module.exports = `(() => {
  if (window.__T) return; const C = Clarity, T = window.__T = { bl: [], sh: [], rings: [], taps: [], em: [] };
  C.hook('Audio2.blip', 'core', { order: -1000, before(c) { T.bl.push({ a: Array.from(c.args), t: performance.now(), ran: false }); } });
  C.hook('Audio2.blip', 'core', { order: 1000, before(c) { const l = T.bl[T.bl.length - 1]; if (l) l.ran = true; } });
  C.hook('onTap', 'core', { order: -1000, before(c) { T.taps.push({ t: performance.now(), busy: !!G.busy, scene: !!G.sceneOn, px: c.args[0], py: c.args[1] }); } });
  const s0 = C.shake; C.shake = function (el, o) { T.sh.push({ id: el.id, cls: String(el.className), lab: el.getAttribute('aria-label'), who: el.dataset && el.dataset.who, mood: el.dataset && el.dataset.mood, t: performance.now(), o: o || null }); return s0.apply(this, arguments); };
  new MutationObserver(rs => { for (const r of rs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('cm-g15-ring')) { const cs = getComputedStyle(n); T.rings.push({ t: performance.now(), pe: cs.pointerEvents, w: n.getBoundingClientRect().width, inline: n.style.pointerEvents, left: n.style.left, top: n.style.top }); } }).observe(document.getElementById('fx'), { childList: true });
  const e0 = emit; emit = function (t, x, y, n, o) { T.em.push({ t, ch: o && o.ch, n: n || 1, at: performance.now() }); return e0.apply(this, arguments); };
  // a snapshot of everything G15 looks at
  T.snap = () => { const op = n => n ? { o: +getComputedStyle(n).opacity, f: getComputedStyle(n).filter } : null;
    return { t: performance.now(), busy: !!G.busy, scene: !!G.sceneOn, st: marina.state, room: G.room, mood: G.mood, app: document.getElementById('app').className,
      awake: [...document.querySelectorAll('#moodbar .mood.cm-awake')].map(n => n.dataset.mood), cur: (document.querySelector('.mood.cur') || { dataset: {} }).dataset.mood || null,
      moods: Object.fromEntries([...document.querySelectorAll('#moodbar .mood')].map(n => [n.dataset.mood, +getComputedStyle(n).opacity])),
      curOutline: (() => { const n = document.querySelector('.mood.cur'); return n ? getComputedStyle(n).outlineStyle + ' ' + getComputedStyle(n).outlineWidth : null; })(),
      rb: op(document.querySelector('#roombar .rb')), fl: op(document.querySelector('#floorpill .fl:not(.off)')), map: op(document.getElementById('mapBtn')),
      alerts: [...document.querySelectorAll('#alerts .alertb')].map(n => n.getAttribute('aria-label') + ':' + getComputedStyle(n).opacity), req: op(document.getElementById('reqBtn')),
      faces: [...document.querySelectorAll('.facecard.show')].map(n => ({ who: n.dataset.who, ...op(n) })) }; };
  T.since = t => ({ nope: T.bl.filter(b => b.t >= t && b.a[0] === -12 && b.a[1] === 'triangle').length, moodBlipIn: T.bl.filter(b => b.t >= t && b.a[0] === 12 && b.a[1] === 'square' && b.a[2] === 0.08).length,
    moodBlipRan: T.bl.filter(b => b.t >= t && b.a[0] === 12 && b.a[1] === 'square' && b.a[2] === 0.08 && b.ran).length, skipped: T.bl.filter(b => b.t >= t && !b.ran).map(b => b.a),
    blips: T.bl.filter(b => b.t >= t).map(b => b.a.join(',') + (b.ran ? '' : ' SKIPPED')), shakes: T.sh.filter(s => s.t >= t), rings: T.rings.filter(r => r.t >= t), taps: T.taps.filter(r => r.t >= t) });
})()`;
