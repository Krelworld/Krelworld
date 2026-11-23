#!/usr/bin/env node
// DESKTOP FINGERPRINT: writes down exactly what the laptop version of the game shows and does in a fixed list of
// game states, so that any later change (the phone work above all) can be proven not to have altered it.
// See tests/fingerprints/README.md. Not part of the game and not run by vitest: it needs Playwright and a dev server.
//
//   record:  node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --alt-url http://localhost:5211/
//   check:   node scripts/desktop-fingerprint.cjs --url http://localhost:5201/ --alt-url http://localhost:5211/ --check
//
//   --url <dev server>       the normal build's dev server (npx vite --port 5201 --strictPort)
//   --alt-url <dev server>   the ALT build's dev server (VITE_KREL_ALT=1 npx vite --port 5211 --strictPort)
//   --no-alt                 leave the ALT states out (then --alt-url is not needed)
//   --check                  write nothing: compare with the committed baseline, print a diff per state, exit 1 on any
//   --only <a,b,...>         only these states (or whole chains, by chain id). A state's chain is played up to it.
//   --baseline <dir>         the baseline folder to write (record) or compare with (check). Default: tests/fingerprints/desktop
//   --out <dir>              check: also save the new version of every state that differed here (to look at, or to diff by hand)
//   --shots <dir>            save a 1x screenshot of each recorded state (for people; never compared)
//   --list                   print the chains and states, and exit
const fs = require("fs");
const path = require("path");
const { Session, launch, VIEW, UA, SEED, CLOCK_START, CLOCK_PIN } = require("./fingerprint/core.cjs");
const { pageDump, format } = require("./fingerprint/dump.cjs");
const { CHAINS } = require("./fingerprint/states.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASELINE = path.join(ROOT, "tests", "fingerprints", "desktop");

function args(argv) {
  const o = { url: "", altUrl: "", check: false, only: null, out: "", shots: "", list: false, noAlt: false, baseline: DEFAULT_BASELINE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) usage(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--url") o.url = next();
    else if (a === "--alt-url") o.altUrl = next();
    else if (a === "--check") o.check = true;
    else if (a === "--only") o.only = (o.only || []).concat(next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--out") o.out = path.resolve(next());
    else if (a === "--baseline") o.baseline = path.resolve(next());
    else if (a === "--shots") o.shots = path.resolve(next());
    else if (a === "--list") o.list = true;
    else if (a === "--no-alt") o.noAlt = true;
    else if (/^https?:\/\//.test(a) && !o.url) o.url = a;
    else usage(`unknown argument: ${a}`);
  }
  return o;
}

function usage(msg) {
  if (msg) console.error("desktop-fingerprint: " + msg + "\n");
  console.error("usage: node scripts/desktop-fingerprint.cjs --url <dev server> [--alt-url <ALT dev server> | --no-alt] [--check] [--only a,b] [--baseline dir] [--out dir] [--shots dir] [--list]");
  process.exit(2);
}

// ---------------------------------------------------------------- a readable line diff
function diffLines(a, b) {
  const A = a.split("\n");
  const B = b.split("\n");
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  const x = A.slice(pre, A.length - suf);
  const y = B.slice(pre, B.length - suf);
  const ops = [];
  if (x.length * y.length > 16e6) {
    // too big to line up: show it as one block
    for (const l of x) ops.push(["-", l]);
    for (const l of y) ops.push(["+", l]);
  } else {
    const n = x.length;
    const m = y.length;
    const W = m + 1;
    const L = new Int32Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = x[i] === y[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) {
        ops.push([" ", x[i]]);
        i++;
        j++;
      } else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) ops.push(["-", x[i++]]);
      else ops.push(["+", y[j++]]);
    }
    while (i < n) ops.push(["-", x[i++]]);
    while (j < m) ops.push(["+", y[j++]]);
  }
  // number the lines, keep only the changed ones (with the line just before each run, for bearings)
  const out = [];
  let la = pre;
  let lb = pre;
  let changed = 0;
  let lastKept = -2;
  ops.forEach(([op, text], k) => {
    if (op === " ") {
      la++;
      lb++;
      return;
    }
    changed++;
    if (lastKept !== k - 1) {
      const ctx = k > 0 && ops[k - 1][0] === " " ? ops[k - 1][1] : pre > 0 && k === 0 ? A[pre - 1] : null;
      out.push(`  @@ baseline line ${la + 1}, now line ${lb + 1}`);
      if (ctx !== null) out.push("    " + clip(ctx));
    }
    out.push(`  ${op} ` + clip(text));
    lastKept = k;
    if (op === "-") la++;
    else lb++;
  });
  return { changed, lines: out };
}
const clip = (s) => (s.length > 300 ? s.slice(0, 300) + ` … (+${s.length - 300} chars)` : s);

// ---------------------------------------------------------------- the environment the baseline was recorded in
async function environment(browser) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, userAgent: UA });
  const page = await ctx.newPage();
  const probe = await page.evaluate(() => {
    // how wide some text comes out in the system fonts the game falls back on (the pixel fonts ship with the game)
    const c = document.createElement("canvas").getContext("2d");
    const out = {};
    for (const f of ["Trebuchet MS", "Courier New", "Georgia", "Impact", "Comic Sans MS", "Arial", "sans-serif", "monospace", "serif"]) {
      c.font = `16px "${f}"`;
      out[f] = Math.round(c.measureText("The quick brown fox 0123456789 KRELWORLD").width * 100) / 100;
    }
    return { fonts: out, emoji: (() => { c.font = '16px sans-serif'; return Math.round(c.measureText("🛠⛶🔒📺🍺").width * 100) / 100; })(), pointerFine: matchMedia("(pointer: fine)").matches, hover: matchMedia("(hover: hover)").matches, maxTouchPoints: navigator.maxTouchPoints };
  });
  await ctx.close();
  return { browser: "chromium " + browser.version(), platform: process.platform + " " + process.arch, window: `${VIEW.width}x${VIEW.height} @1x`, userAgent: UA, seed: SEED, clock: [new Date(CLOCK_START).toISOString(), new Date(CLOCK_PIN).toISOString()], ...probe };
}

// ---------------------------------------------------------------- run
class Stop extends Error {}

async function main() {
  const o = args(process.argv.slice(2));
  const allStates = CHAINS.flatMap((c) => c.states);
  if (new Set(allStates).size !== allStates.length) throw new Error("states.cjs: a state id is used twice");
  if (o.list) {
    for (const c of CHAINS) console.log(`${c.id}${c.alt ? "  (ALT build)" : ""}\n    ${c.about}\n    ${c.states.join(", ")}`);
    console.log(`\n${CHAINS.length} chains, ${allStates.length} states`);
    return 0;
  }
  if (!o.url) usage("--url is required (the dev server of the normal build)");
  let wanted = null;
  if (o.only) {
    wanted = new Set();
    for (const id of o.only) {
      const chain = CHAINS.find((c) => c.id === id);
      if (chain) chain.states.forEach((s) => wanted.add(s));
      else if (allStates.includes(id)) wanted.add(id);
      else usage(`--only: no state or chain called "${id}" (try --list)`);
    }
  }
  let chains = CHAINS.filter((c) => !wanted || c.states.some((s) => wanted.has(s)));
  const skippedAlt = [];
  if (chains.some((c) => c.alt) && !o.altUrl) {
    if (!o.noAlt) usage("the ALT states need --alt-url (the ALT build's dev server), or pass --no-alt to leave them out");
    for (const c of chains.filter((c) => c.alt)) skippedAlt.push(...c.states);
    chains = chains.filter((c) => !c.alt);
  }
  const BASELINE = o.baseline;
  const outDir = o.check ? o.out : BASELINE;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  if (o.shots) fs.mkdirSync(o.shots, { recursive: true });

  const t0 = Date.now();
  const browser = await launch();
  const results = {}; // state -> text
  const failures = []; // chain errors
  let env;
  try {
    env = await environment(browser);
    if (!env.pointerFine || !env.hover || env.maxTouchPoints) throw new Error("this browser does not look like a laptop (it needs a fine pointer, hover and no touch points)");
    for (const chain of chains) {
      const tc = Date.now();
      const need = chain.states.filter((s) => !wanted || wanted.has(s));
      const last = need[need.length - 1];
      const S = new Session(browser, { url: chain.alt ? o.altUrl : o.url });
      const made = [];
      const notes = {};
      const record = async (id, body) => {
        if (!chain.states.includes(id)) throw new Error(`states.cjs: chain "${chain.id}" recorded "${id}" but does not list it`);
        made.push(id);
        if (!wanted || wanted.has(id)) {
          const doc = { state: id, chain: chain.id, build: chain.alt ? "alt" : "main", ...(notes[id] ? { how: notes[id] } : {}), ...body, errors: S.errors.slice() };
          results[id] = format(doc) + "\n";
          if (o.shots) await S.page.screenshot({ path: path.join(o.shots, id + ".png") }).catch(() => {});
        }
        if (id === last) throw new Stop();
      };
      const h = {
        S,
        note: (id, data) => {
          notes[id] = { ...(notes[id] || {}), ...data };
        },
        dump: async (id, opts) => record(id, await S.ev(pageDump, opts || null)),
        probe: async (id, data) => record(id, { probe: data }),
      };
      process.stdout.write(`${chain.id}: `);
      try {
        await S.open();
        try {
          await chain.run(h);
        } catch (e) {
          if (!(e instanceof Stop)) throw e;
        }
        const missing = need.filter((s) => !made.includes(s));
        if (missing.length) throw new Error(`the chain finished without recording: ${missing.join(", ")}`);
        console.log(`${need.length} state${need.length === 1 ? "" : "s"} in ${((Date.now() - tc) / 1000).toFixed(1)} s (page loaded in ${(S.bootMs / 1000).toFixed(1)} s, ${S.frame} frames)`);
      } catch (e) {
        const missing = need.filter((s) => !(s in results));
        console.log(`FAILED after ${((Date.now() - tc) / 1000).toFixed(1)} s`);
        // where it got stuck (and, with --shots, a picture of it)
        let where = [];
        try {
          where = await S.scenes();
          if (o.shots) await S.page.screenshot({ path: path.join(o.shots, `failed_${chain.id}.png`) });
        } catch (e2) {
          /* the page is gone */
        }
        if (process.env.FP_DEBUG) console.log((e && e.stack) || e);
        failures.push({ chain: chain.id, error: String((e && e.message) || e).split("\n")[0], missing, errors: S.errors.slice(0, 5), where });
        continue;
      } finally {
        await S.close();
      }
    }
  } finally {
    await browser.close();
  }

  // ---- write, or compare
  let bad = 0;
  const envText = JSON.stringify(env, null, 1) + "\n";
  const ids = Object.keys(results);
  if (!o.check) {
    for (const id of ids) fs.writeFileSync(path.join(outDir, id + ".json"), results[id]);
    fs.writeFileSync(path.join(outDir, "_env.json"), envText);
    if (!wanted && !failures.length) {
      // a full recording owns the folder: files for states that no longer exist go
      const keep = new Set([...ids, ...skippedAlt].map((s) => s + ".json").concat("_env.json"));
      for (const f of fs.readdirSync(outDir)) if (f.endsWith(".json") && !keep.has(f)) {
        fs.unlinkSync(path.join(outDir, f));
        console.log(`removed ${f} (no such state any more)`);
      }
    }
    console.log(`\nwrote ${ids.length} fingerprint${ids.length === 1 ? "" : "s"} to ${path.relative(process.cwd(), outDir) || "."}`);
  } else {
    const envFile = path.join(BASELINE, "_env.json");
    const envWas = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
    if (envWas && envWas !== envText) {
      const d = diffLines(envWas, envText);
      console.log("\nWARNING: this machine is not the one the baseline was recorded on (browser or system fonts differ).\nDifferences below may come from that, not from the code. To be sure, record a baseline from the base commit on this machine.");
      console.log(d.lines.join("\n"));
    }
    console.log("");
    for (const id of ids) {
      const file = path.join(BASELINE, id + ".json");
      if (!fs.existsSync(file)) {
        bad++;
        console.log(`✗ ${id}: no baseline (${path.relative(process.cwd(), file)} is missing)`);
        if (outDir) fs.writeFileSync(path.join(outDir, id + ".json"), results[id]);
        continue;
      }
      const was = fs.readFileSync(file, "utf8");
      if (was === results[id]) continue;
      bad++;
      const d = diffLines(was, results[id]);
      console.log(`✗ ${id}: ${d.changed} line${d.changed === 1 ? "" : "s"} differ from the baseline`);
      console.log(d.lines.slice(0, 60).join("\n"));
      if (d.lines.length > 60) console.log(`  … ${d.lines.length - 60} more diff lines`);
      if (outDir) fs.writeFileSync(path.join(outDir, id + ".json"), results[id]);
    }
    if (!wanted) {
      const have = new Set([...ids, ...skippedAlt, ...failures.flatMap((f) => f.missing)]);
      for (const f of fs.existsSync(BASELINE) ? fs.readdirSync(BASELINE) : []) {
        if (!f.endsWith(".json") || f === "_env.json") continue;
        if (!have.has(f.slice(0, -5))) {
          bad++;
          console.log(`✗ ${f}: in the baseline, but the script no longer records it`);
        }
      }
    }
    const same = ids.length - ids.filter((id) => !fs.existsSync(path.join(BASELINE, id + ".json")) || fs.readFileSync(path.join(BASELINE, id + ".json"), "utf8") !== results[id]).length;
    console.log(`${same} of ${ids.length} state${ids.length === 1 ? "" : "s"} identical to the baseline`);
    if (bad && outDir) console.log(`(what differed was saved to ${path.relative(process.cwd(), outDir) || "."})`);
  }
  for (const f of failures) {
    bad++;
    console.log(`✗ chain "${f.chain}" failed: ${f.error}`);
    if (f.missing.length) console.log(`  not recorded: ${f.missing.join(", ")}`);
    if (f.where && f.where.length) console.log(`  the game was in: ${f.where.join(", ")}`);
    for (const e of f.errors) console.log(`  page: ${e}`);
  }
  if (skippedAlt.length) console.log(`(--no-alt: ${skippedAlt.length} ALT state${skippedAlt.length === 1 ? "" : "s"} left out: ${skippedAlt.join(", ")})`);
  console.log(`total time: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (o.check) console.log(bad ? "DESKTOP FINGERPRINT: DIFFERENT" : "DESKTOP FINGERPRINT: OK");
  return bad ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("desktop-fingerprint: " + ((e && e.stack) || e));
    process.exit(2);
  },
);
