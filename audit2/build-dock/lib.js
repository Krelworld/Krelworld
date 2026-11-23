// dock builder helpers: boot the worktree game with optional clarity switches off and simulated safe-area insets.
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const DIR = '/home/user/Krelworld/.wt/dock/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-dock/';
const HEAD = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina';
// opts: port, view, room, off ('G16,G25' | 'all'), insets {top,bottom,left,right}, start, head (serve HEAD on 8847)
async function boot(o = {}) {
  const port = o.port || 8890, room = o.room || 'kitchen';
  const g = await H.boot({ port: o.head ? 8847 : port, view: o.view || 'port', room, start: false, dir: o.head ? HEAD : DIR });
  if (o.off) { await g.ctx.addInitScript(v => { window.CLARITY_OFF = v; }, o.off); }
  if (o.insets) { const c = await g.ctx.newCDPSession(g.page); await c.send('Emulation.setSafeAreaInsetsOverride', { insets: o.insets }); g.cdp = c; }
  if (o.off || o.insets) { await g.page.reload(); await g.page.waitForTimeout(2500); }
  if (o.start !== false) { await g.page.evaluate(r => startGame(r), room); await g.page.waitForTimeout(o.settle || 5000); }
  g.errs = () => g.errors.filter(e => !/chip_love/.test(e));
  g.ev = (f, a) => g.page.evaluate(f, a);
  g.wait = ms => g.page.waitForTimeout(ms);
  g.rect = sel => g.page.evaluate(s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(), cs = getComputedStyle(n); return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, op: +cs.opacity, pe: cs.pointerEvents, disp: cs.display }; }, sel);
  // what is under the centre of an element (id or class of the topmost element there)
  g.hit = sel => g.page.evaluate(s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t ? (t.id || (t.closest('[id]') ? t.closest('[id]').id : '') || t.className) : null; }, sel);
  g.hitAt = (x, y) => g.page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return t ? (t.id || (t.closest('[id]') ? t.closest('[id]').id : '') || String(t.className)) : null; }, [x, y]);
  return g;
}
const VIEWS = { port: 'port', land: 'land', portSmall: 'portSmall', landSmall: 'landSmall', '390x664': { width: 390, height: 664 }, '390x585': { width: 390, height: 585 }, '375x553': { width: 375, height: 553 }, '375x548': { width: 375, height: 548 }, '844x340': { width: 844, height: 340 } };
const viewOf = n => VIEWS[n] || n;
module.exports = { H, boot, DIR, OUT, HEAD, viewOf, VIEWS };
