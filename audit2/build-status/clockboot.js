// boot the game under Playwright's fake clock (timers, rAF, Date and performance.now all advance only with runFor)
const L = require('./lib.js'); const { chromium } = require('playwright');
async function clockBoot({ port = 8860, view = 'port', room = 'kitchen', off = '', dir = L.DIR }) {
  await L.H.serve(port, dir);
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: L.H.VIEWS[view] || view, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
  await ctx.clock.install({ time: new Date('2026-11-01T10:00:00') });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/willReadFrequently|Failed to load resource|chip_love/.test(t)) errors.push(m.type() + ': ' + t.slice(0, 200)); } });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  for (let i = 0; i < 25; i++) { await page.clock.runFor(100); await page.waitForTimeout(100); }
  await page.evaluate(r => startGame(r), room);
  for (let i = 0; i < 50; i++) { await page.clock.runFor(100); await page.waitForTimeout(20); }
  return { browser, ctx, page, errors, close: () => browser.close() };
}
module.exports = { clockBoot };
