// Chef Marina — clarity switches. Loaded FIRST (before audio.js), so any game file can ask about them at any time.
// The audit's 39 changes (G1–G39) each have one switch here. A switch that is off leaves today's game exactly as it was.
// Local edits inside game files test their switch at call time with:  window.Clarity && Clarity.is('G7')
// (is() stays false until every clarity file has loaded, so nothing new runs while the page is still loading).
// Testing overrides (never stored anywhere):
//   index.html?clarity=off            every switch off          index.html?clarity=-G3,-G19     those off
//   index.html?clarity=only:G3,G9     only those on             window.CLARITY_OFF = 'all' | 'G3,G19' | ['G3']  (set before load,
//                                                                 e.g. Playwright context.addInitScript)
(function () {
  const ids = []; for (let i = 1; i <= 39; i++) ids.push('G' + i);
  const on = {}; for (const id of ids) on[id] = true;
  const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);
  const off = v => { for (const s of list(v)) { if (s === 'all' || s === 'off') ids.forEach(id => { on[id] = false; }); else if (s.replace(/^-/, '') in on) on[s.replace(/^-/, '')] = false; } };
  try { if (window.CLARITY_OFF != null) off(window.CLARITY_OFF); } catch (e) { }
  try {
    const q = new URLSearchParams(location.search).get('clarity');
    if (q != null) { if (q.startsWith('only:')) { const keep = list(q.slice(5)); ids.forEach(id => { on[id] = keep.includes(id); }); } else off(q); }
  } catch (e) { }
  const C = { ids, on, ready: false, is: id => C.ready === true && C.on[id] === true };
  window.Clarity = C;
})();
