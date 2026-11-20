// Autoplay smoke test: plays dist/KREPLIN.html with random choices, fast timers.
// Usage: node tools/autoplay.js [--steps 600] [--seed 1] [--shots dir] [--file path] [--setup "js"] [--gameseed N] [--dump]
//   --setup evaluates JS in the page after the campaign starts, e.g. to jump ahead:
//   --setup "S.season=3; S.matches_played=5"
// Reports: page errors, progress (season/match), stalls.
const { chromium } = require('playwright');
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
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  // Block remote media for speed/determinism; videos get "ended" immediately.
  await ctx.route(/dropbox\.com|imgflip|unsplash|placeholder/, r => r.abort());
  // Seed the game's Math.random too, so a run is reproducible (same seed => same game).
  await ctx.addInitScript(gs => {
    let a = gs >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, +(args.gameseed || seed));
  await ctx.addInitScript(() => {
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
  p.on('pageerror', e => { const k = e.message.slice(0, 160); errors.set(k, (errors.get(k) || 0) + 1); });
  await p.goto('file://' + file);
  await p.waitForTimeout(500);
  if (!args.nostart) {
    await p.click('#ladsGateYes', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
    await p.click('#startCampaignBtn', { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
  }
  if (args.setup && args.setup !== true) {
    await p.evaluate(src => { (0, eval)(src); try { updateHUD(); } catch (e) {} }, args.setup)
      .catch(e => console.log('SETUP ERROR', e.message));
    await p.waitForTimeout(300);
  }

  const state = () => p.evaluate(() => {
    const S = window.S || {};
    return { season: S.season, played: S.matches_played, pts: S.points, w: S.wins, d: S.draws, l: S.losses,
      club: S.club_cash, chair: S.chairman_cash, over: !!S.game_over,
      squad: Array.isArray(S.squad) ? S.squad.length : 0 };
  }).catch(() => ({}));

  let last = '', same = 0, history = [];
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
        const r2 = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
        if (!hit || !(hit === el || el.contains(hit))) return;
        el.dataset.apIdx = idx;
        out.push({ idx, text: (el.innerText || el.value || el.title || '').trim().slice(0, 60), hud: !!el.closest('#hudBar, footer') });
      });
      return out;
    });
    const usable = cands.filter(c => !c.hud && (!SKIP.test(c.text) || (same > 8 && /^(×|✕|x|back.*)$/i.test(c.text))));
    // don't sell the squad below a playable size (the bot otherwise strands itself in the lineup picker)
    if ((globalThis.__squad || 99) <= 8) for (let k = usable.length - 1; k >= 0; k--) if (/^sell player/i.test(usable[k].text)) usable.splice(k, 1);
    // occasionally press Escape / click overlay-less hud for coverage
    if (!usable.length) {
      await p.keyboard.press('Escape').catch(() => {});
      await p.waitForTimeout(200);
      same++;
    } else {
      // prefer "kickoff"/"continue"/"next" ~50% to make progress
      const pool = usable.filter(c => !/view full table|^\[[ ✓]\]/i.test(c.text));
      const strong = pool.filter(c => /auto-select best|auto-pick|proceed to kickoff|kick ?off|quick sim|simulate|continue|next week|next|post-match|evening|close window|^ok$|^close$|done|skip|wake/i.test(c.text));
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
    if (s.played !== globalThis.__lastPlayed) { globalThis.__lastPlayed = s.played; globalThis.__lastPlayedStep = i; }
    const sig = JSON.stringify(s) + usable.map(u => u.text).join('|');
    if (sig === last) same++; else { same = 0; last = sig; }
    if (i % 50 === 0) console.log(`step ${i}`, JSON.stringify(s), '| opts:', usable.slice(0, 6).map(u => u.text).join(' / '));
    if (shots && i % 100 === 0) await p.screenshot({ path: `${shots}/ap-${String(i).padStart(4, '0')}.png` });
    if (s.over) { console.log('GAME OVER reached at step', i); break; }
    if (same > 40) { console.log('STALL at step', i, 'last clicks:', history.slice(-8).join(' > ')); break; }
  }
  const s = await state();
  console.log('FINAL', JSON.stringify(s));
  if (args.dump) {
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
  console.log('ERRORS', errors.size);
  for (const [k, v] of errors) console.log(`  x${v} ${k}`);
  if (shots) await p.screenshot({ path: `${shots}/ap-final.png` });
  await b.close();
})();
