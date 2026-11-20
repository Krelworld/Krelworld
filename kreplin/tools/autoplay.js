// Autoplay smoke test: plays dist/KREPLIN.html with random choices, fast timers.
// Usage: node tools/autoplay.js [--steps 600] [--seed 1] [--shots dir] [--file path] [--setup "js"] [--gameseed N] [--dump]
//                               [--mobile] [--every 100] [--desktop WxH]
//   --mobile   runs as an iPhone 13 (Playwright device) and checks for horizontal overflow
//              (document.scrollingElement.scrollWidth > innerWidth, or a visible button outside the
//              viewport); each new violation is reported once, with a screenshot when --shots is set.
//                               [--jump season[:match]] [--flags '{"season3.x":true}'] [--noopener]
//   --jump starts the campaign at a season/match: the page's test entry point
//   (window.__kreplinDebug.jump) applies it when the main loop starts, after the
//   campaign setup, playing the skipped fixtures through the table (S4/S5 openers run
//   unless --noopener). --flags sets state paths then; --setup evaluates JS then, e.g.
//   --jump 3:16 --flags '{"season3.player_coma_between_seasons":true}'  (S3 end -> coma -> S4)
// Reports: page errors, progress (season/match), stalls, and a points/table ledger
// check after every played match (LEDGER lines; --dump also prints the final ledger).
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const STEPS = +(args.steps || 600);
let seed = +(args.seed || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const file = path.resolve(args.file || path.join(__dirname, '..', 'dist', 'KREPLIN.html'));
const shots = args.shots ? path.resolve(args.shots) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const SKIP = /^(save|load|reset|back \/ pause|start over.*|delete.*|×|✕|x)$/i;

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const [dw, dh] = String(args.desktop && args.desktop !== true ? args.desktop : '1366x860').split('x').map(Number);
  const ctx = await b.newContext(args.mobile ? { ...devices['iPhone 13'] } : { viewport: { width: dw, height: dh } });
  const EVERY = +(args.every || 100);
  const overflowSeen = new Set();
  let overflowCount = 0;
  async function checkOverflow(step) {
    const v = await p.evaluate(() => {
      const out = [];
      const W = innerWidth;
      const se = document.scrollingElement || document.documentElement;
      if (se.scrollWidth > W + 1) out.push(`page scrollWidth ${se.scrollWidth} > ${W}`);
      const vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0; };
      for (const el of document.querySelectorAll('button, [role=button], input, select')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || !vis(el)) continue;
        // only count controls that are not inside a horizontally scrollable strip
        let sc = el.parentElement, scrolls = false;
        while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowX) && sc.scrollWidth > sc.clientWidth) { scrolls = true; break; } sc = sc.parentElement; }
        if (scrolls) continue;
        if (r.right > W + 2 || r.left < -2) {
          const t = (el.innerText || el.value || el.id || el.className || el.tagName).toString().trim().slice(0, 40).replace(/\s+/g, ' ');
          out.push(`control outside viewport: "${t}" [${Math.round(r.left)}..${Math.round(r.right)}] in ${el.parentElement ? (el.parentElement.id || el.parentElement.className || el.parentElement.tagName) : '?'}`);
        }
      }
      return out.slice(0, 6);
    }).catch(() => []);
    for (const msg of v) {
      const key = msg.replace(/\d+/g, '#');
      if (overflowSeen.has(key)) continue;
      overflowSeen.add(key); overflowCount++;
      console.log(`OVERFLOW step ${step}: ${msg}`);
      if (shots) await p.screenshot({ path: `${shots}/overflow-${String(overflowCount).padStart(2, '0')}.png` }).catch(() => {});
    }
  }
  // Block remote media for speed/determinism; videos get "ended" immediately.
  await ctx.route(/dropbox\.com|imgflip|unsplash|placeholder/, r => r.abort());
  // Seed the game's Math.random too, so a run is reproducible (same seed => same game).
  await ctx.addInitScript(gs => {
    let a = gs >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, +(args.gameseed || seed));
  await ctx.addInitScript(() => {
    window.__KREPLIN_TEST__ = true; // enables window.__kreplinDebug
    const st = window.setTimeout, si = window.setInterval;
    window.__speed = 50;
    window.setTimeout = (f, d, ...a) => st(f, Math.max(0, (d || 0) / window.__speed), ...a);
    window.setInterval = (f, d, ...a) => si(f, Math.max(4, (d || 0) / window.__speed), ...a);
    window.prompt = () => 'Test';
    window.alert = () => {};
    window.confirm = () => true;
    HTMLMediaElement.prototype.play = function () {
      const el = this; st(() => { try { el.dispatchEvent(new Event('ended')); } catch (e) {} }, 30);
      return Promise.resolve();
    };
  });
  const p = await ctx.newPage();
  const errors = new Map();
  p.on('console', m => { const t = m.text(); if (t.startsWith('[ap]')) console.log(t.slice(0, 300)); }); // probes from --setup
  p.on('pageerror', e => { const k = e.message.slice(0, 160); errors.set(k, (errors.get(k) || 0) + 1); });
  await p.goto('file://' + file);
  await p.waitForTimeout(500);
  if (args.jump || args.setup || args.flags) {
    const [season, match] = String(args.jump && args.jump !== true ? args.jump : '').split(':');
    const spec = { season: +season || undefined, match: +match || 0,
      flags: args.flags && args.flags !== true ? JSON.parse(args.flags) : {},
      setup: args.setup && args.setup !== true ? args.setup : undefined,
      opener: !args.noopener };
    const ok = await p.evaluate(j => !!(window.__kreplinDebug && window.__kreplinDebug.jump(j)), spec).catch(e => e.message);
    console.log('JUMP', JSON.stringify(spec), ok === true ? 'queued' : 'FAILED ' + ok);
  }
  if (!args.nostart) {
    await p.click('#ladsGateYes', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
    await p.click('#startCampaignBtn', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
  }

  const state = () => p.evaluate(() => {
    const S = window.S || {};
    return { season: S.season, played: S.matches_played, pts: S.points, w: S.wins, d: S.draws, l: S.losses,
      club: S.club_cash, chair: S.chairman_cash, over: !!S.game_over,
      squad: Array.isArray(S.squad) ? S.squad.length : 0 };
  }).catch(() => ({}));

  let last = '', same = 0, history = [], ledgerBad = 0, matchesSeen = 0;
  for (let i = 0; i < STEPS; i++) {
    // fill any visible, empty text/number inputs (single round-trip for speed)
    await p.evaluate(() => {
      const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      for (const el of document.querySelectorAll('input, textarea')) {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (!['text', 'number', 'search'].includes(t) && el.tagName !== 'TEXTAREA') continue;
        if (el.value || el.disabled || el.readOnly || !visible(el)) continue;
        el.value = t === 'number' ? '1000' : 'Test';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }).catch(() => {});
    // candidate buttons: the topmost layer = elements actually hit-testable at their centre
    const cands = await p.evaluate(() => {
      const out = [];
      const els = [...document.querySelectorAll('button, [role=button], .dos-button, .choice, a.btn')];
      els.forEach((el, idx) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || el.disabled) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) { el.scrollIntoView({ block: 'center' }); }
        let r2 = el.getBoundingClientRect();
        let hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        if (!hit || !(hit === el || el.contains(hit))) {
          // clipped inside a scrolling modal? bring it into view and test again
          el.scrollIntoView({ block: 'center' });
          r2 = el.getBoundingClientRect();
          hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        }
        if (!hit || !(hit === el || el.contains(hit))) return;
        el.dataset.apIdx = idx;
        const lbl = el.querySelector(':scope > .lbl') || el;
        out.push({ idx, text: (lbl.innerText || el.value || el.title || '').trim().slice(0, 60), hud: !!el.closest('#hudBar, footer, #kRail, #kTop, #kMoreSheet, .k-sheet-toggle, .k-linkbtn') });
      });
      return out;
    });
    const usable = cands.filter(c => !c.hud && (!SKIP.test(c.text) || (same > 8 && /^(×|✕|x|back.*)$/i.test(c.text))));
    // don't sell the squad below a playable size (the bot otherwise strands itself in the lineup picker)
    if ((globalThis.__squad || 99) <= 8) for (let k = usable.length - 1; k >= 0; k--) if (/^(sell player|sell |accept .* for |confirm sale)/i.test(usable[k].text)) usable.splice(k, 1);
    // occasionally press Escape / click overlay-less hud for coverage
    if (!usable.length) {
      await p.keyboard.press('Escape').catch(() => {});
      await p.waitForTimeout(200);
      same++;
    } else {
      // prefer "kickoff"/"continue"/"next" ~50% to make progress
      const pool = usable.filter(c => !/view full table|^\[[ ✓]\]/i.test(c.text));
      let strong = pool.filter(c => /auto-select best|auto-pick|proceed to kickoff|kick ?off|quick sim|simulate|continue|next week|next|post-match|evening|close window|^ok$|^close$|done|skip|wake/i.test(c.text));
      // short of fit players (lineup stuck below 5): go and buy someone
      if (same > 4 && pool.some(c => /need exactly 5/i.test(c.text))) {
        const buy = pool.filter(c => /transfer window|buy player/i.test(c.text));
        if (buy.length) strong = buy;
      }
      if (same > 4 && pool.some(c => /^buy player$/i.test(c.text))) strong = pool.filter(c => /^buy player$/i.test(c.text));
      const sinceMatch = i - (globalThis.__lastPlayedStep || 0);
      const pStrong = same > 6 ? 0.2 : sinceMatch > 40 ? 0.9 : 0.6;
      const src = (strong.length && rnd() < pStrong) ? strong : (pool.length ? pool : usable);
      const pick = src[Math.floor(rnd() * src.length)];
      history.push(pick.text);
      await p.click(`[data-ap-idx="${pick.idx}"]`, { timeout: 1500, force: true }).catch(() => {});
      await p.waitForTimeout(60);
    }
    const s = await state();
    globalThis.__squad = s.squad;
    if (s.played !== globalThis.__lastPlayed) {
      globalThis.__lastPlayed = s.played; globalThis.__lastPlayedStep = i;
      const led = await p.evaluate(() => window.__kreplinDebug ? window.__kreplinDebug.ledger() : null).catch(() => null);
      if (led && led.problems.length) { ledgerBad++; console.log(`LEDGER s${s.season} m${s.played}:`, led.problems.join('; ')); }
      matchesSeen++;
    }
    const sig = JSON.stringify(s) + usable.map(u => u.text).join('|');
    if (sig === last) same++; else { same = 0; last = sig; }
    if (i % 50 === 0) console.log(`step ${i}`, JSON.stringify(s), '| opts:', usable.slice(0, 6).map(u => u.text).join(' / '));
    if (shots && i % EVERY === 0) await p.screenshot({ path: `${shots}/ap-${String(i).padStart(4, '0')}.png` });
    if (args.mobile && i % 5 === 0) await checkOverflow(i);
    if (s.over) { console.log('GAME OVER reached at step', i); break; }
    if (same > (+args.patience || 40)) { console.log('STALL at step', i, 'last clicks:', history.slice(-8).join(' > ')); break; }
  }
  const s = await state();
  console.log('FINAL', JSON.stringify(s));
  console.log(`MATCHES ${matchesSeen} | LEDGER-PROBLEMS ${ledgerBad}`);
  if (args.dump) {
    console.log('LEDGER', JSON.stringify(await p.evaluate(() => window.__kreplinDebug ? window.__kreplinDebug.ledger() : null).catch(e => e.message)));
    // describe what is on screen: #actions and any visible fixed overlays
    console.log('DUMP', await p.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
      const out = { actions: (document.getElementById('actions')?.innerText || '').slice(0, 300), overlays: [] };
      for (const el of document.body.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.position === 'fixed') && vis(el) && el.innerText) out.overlays.push(`${el.tagName}#${el.id}.${el.className}: ${el.innerText.slice(0, 160).replace(/\n/g, ' | ')}`);
      }
      out.feedTail = [...document.querySelectorAll('#feed > *')].slice(-6).map(e => e.innerText.slice(0, 120).replace(/\n/g, ' '));
      return JSON.stringify(out, null, 1);
    }).catch(e => e.message));
  }
  if (args.mobile) console.log('OVERFLOW violations', overflowCount);
  console.log('ERRORS', errors.size);
  for (const [k, v] of errors) console.log(`  x${v} ${k}`);
  if (shots) await p.screenshot({ path: `${shots}/ap-final.png` });
  await b.close();
})();
