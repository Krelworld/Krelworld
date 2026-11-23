// virtual time for the page (added with addInitScript, so it runs before the game's own scripts).
// Until __vt.virtual() is called, timers are pumped by real time; afterwards __vt.run(ms) advances time as fast as the CPU allows,
// firing every setTimeout / setInterval / requestAnimationFrame in order and yielding one real task after each so promises and I/O settle.
(() => {
  const RS = window.setTimeout.bind(window), RI = window.setInterval.bind(window), RCI = window.clearInterval.bind(window);
  const pnow = performance.now.bind(performance), DNOW = Date.now, D0 = DNOW(), P0 = pnow();
  let vnow = 0, virtual = false, nid = 1, FRAME = 16;
  const timers = new Map();
  const add = (fn, ms, args, interval) => { const id = nid++; timers.set(id, { id, fn, args, at: vnow + Math.max(0, +ms || 0), interval: interval ? Math.max(1, +ms || 0) : 0 }); return id; };
  window.setTimeout = (fn, ms, ...args) => typeof fn === 'function' ? add(fn, ms, args, false) : RS(fn, ms);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  window.requestAnimationFrame = cb => add(() => cb(vnow), virtual ? FRAME : 16, [], false);
  window.cancelAnimationFrame = id => timers.delete(id);
  performance.now = () => vnow;
  Date.now = () => D0 + vnow;
  const OD = Date; // new Date() keeps real time (only used for clocks on screen, if at all)
  const mc = new MessageChannel(); let wake = null; mc.port1.onmessage = () => { const w = wake; wake = null; w && w(); };
  const yieldTask = () => new Promise(r => { wake = r; mc.port2.postMessage(0); });
  function fireDue(limit) {
    let best = null; for (const t of timers.values()) if (t.at <= limit && (!best || t.at < best.at || (t.at === best.at && t.id < best.id))) best = t;
    if (!best) return false; vnow = Math.max(vnow, best.at);
    if (best.interval) best.at += best.interval; else timers.delete(best.id);
    try { best.fn(...best.args); } catch (e) { console.error('vt timer error: ' + (e && e.message) + ' ' + ((e && e.stack) || '').split('\n')[1]); }
    return true;
  }
  // real-time pump until virtual mode
  const pump = RI(() => { if (virtual) return; const target = pnow() - P0; let n = 0; while (n++ < 500 && fireDue(target)) { } vnow = Math.max(vnow, target); }, 8);
  window.__vt = {
    get now() { return vnow; }, timers,
    virtual(frameMs) { FRAME = frameMs || 50; virtual = true; RCI(pump); },
    async run(ms) { const end = vnow + ms; while (fireDue(end)) await yieldTask(); vnow = end; },
    yieldTask,
  };
})();
