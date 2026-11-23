#!/usr/bin/env node
// PHONE MODE smoke test (Playwright, real touch events). Needs a running dev server.
//
//   npx vite --port 5202 --strictPort &
//   node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,guide,optout,desktop]
//
// phone    iPhone 14 landscape (844x390, DPR 3, touch, mobile Safari UA). Boots by taps, starts a new game by taps,
//          clears the welcome at home by taps, then checks: the idle stick and pause are up; a drag moves the player
//          (also one that starts in the left gutter); a quick tap in the stick zone reaches the game as a tap at
//          that point and a drag does not; ACTION appears at something usable, shows a verb and uses it; stick and
//          ACTION together (two fingers); touchcancel lets go; pause opens and RESUME closes the pause menu; the back
//          gesture pauses; portrait shows the rotate screen and the loop sleeps, landscape wakes it; the page hidden
//          mid-press lets go, sleeps and saves, and comes back.
//          Also (part 2): the Add to Home Screen guide shows itself once over the title on the first run and NOT NOW
//          closes it; the title's corner button, the pause menu's row and the turn-your-phone screen's button open it;
//          the interact prompt reads "Tap: ..." (touch wording) while ACTION still gets its verb; a Home panel's
//          "ESC or ✕ to close" reads "✕ to close"; readability is off and has patched nothing.
// upright  the phone held upright from the start: the rotate screen covers the loading, the art loads behind it,
//          then the loop sleeps; turned sideways the game runs and the Enter gate takes a tap.
// settings the phone settings store: defaults, nothing written until a change, live re-layout of the controls
//          (size, left-handed, opacity), saved under its own key and loaded on the next visit, battery saver caps the
//          loop at 30, and private mode (storage throws) breaks nothing.
// read     readability on (?mobileread=1) at 750x340: no text under 10 CSS px on the title and the settings menu,
//          a tap just outside a small button reaches it; turned off, every text is back at the size the game asked.
// guide    the Add to Home Screen guide per browser (user agent): iPhone Safari / Chrome / Edge / Firefox,
//          Instagram, Messenger, Android Chrome (with and without the install prompt; INSTALL calls it), Edge,
//          Samsung Internet, Firefox, an Android in-app browser; at 844x390, 740x360 and 750x340; never shown from
//          the home screen (navigator.standalone, display-mode); ?mobilediag (and only with it).
// optout   the same phone with ?mobile=0: no layer, no "mobile" class, no phone CSS, no phone global.
// desktop  1280x720, mouse: phone mode off, no class, no layer, no CSS, no global, and at home the UI scene has no
//          touch pad and TOUCH stays off (exactly as before).
// Exit code: 0 all passed, 1 something failed, 2 could not run.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const URL0 = arg("--url", "http://localhost:5202/");
const SHOTS = arg("--shots", "");
const ONLY = (arg("--only", "phone,upright,settings,read,guide,optout,desktop") || "").split(",").filter(Boolean);
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IOS_UA };
const DESKTOP = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: false, isMobile: false };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail !== undefined ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}

class Phone {
  constructor(page, cdp) {
    this.page = page;
    this.cdp = cdp;
  }
  ev(fn, a) {
    return this.page.evaluate(fn, a);
  }
  active() {
    return this.ev(() => window.__krel.active());
  }
  async until(fn, a, ms = 60000, what = "condition") {
    const t0 = Date.now();
    for (;;) {
      if (await this.ev(fn, a).catch(() => false)) return Date.now() - t0;
      if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`);
      await sleep(250);
    }
  }
  scene(k, ms = 120000) {
    return this.until((k) => !!window.__krel && window.__krel.active().includes(k), k, ms, `scene ${k}`);
  }
  async rect() {
    return this.ev(() => {
      const r = document.querySelector("canvas").getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  }
  async g2c(gx, gy) {
    const r = await this.rect();
    return [r.x + (gx * r.w) / 960, r.y + (gy * r.h) / 540];
  }
  tapCss(x, y) {
    return this.page.touchscreen.tap(x, y);
  }
  async tapGame(gx, gy) {
    const [x, y] = await this.g2c(gx, gy);
    return this.tapCss(x, y);
  }
  touch(type, points) {
    return this.cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  }
  /** Something tappable in the game with this text (game coordinates), or null. */
  find(label, o = {}) {
    return this.ev(
      ({ label, scene, exact }) => {
        const g = window.__krel.game;
        const match = (t) => (exact ? t === label : t.includes(label));
        for (const sc of g.scene.getScenes(true)) {
          if (scene && sc.sys.settings.key !== scene) continue;
          const cam = sc.cameras.main;
          let hit = null;
          const walk = (o, vis) => {
            if (hit || !vis || o.visible === false) return;
            if (o.type === "Container" && o.list) for (const c of o.list) walk(c, true);
            if (hit || !o.input || !o.input.enabled) return;
            let text = o.type === "Text" ? o.text : "";
            if (!text && o.parentContainer) text = o.parentContainer.list.filter((c) => c.type === "Text").map((c) => c.text).join(" | ");
            if (!match(text)) return;
            const b = o.getBounds();
            const sfx = o.scrollFactorX ?? 1;
            const sfy = o.scrollFactorY ?? 1;
            hit = { x: (b.centerX - cam.scrollX * sfx - cam.width / 2) * cam.zoomX + cam.x + cam.width / 2, y: (b.centerY - cam.scrollY * sfy - cam.height / 2) * cam.zoomY + cam.y + cam.height / 2 };
          };
          for (const o of sc.children.list) walk(o, true);
          if (hit) return hit;
        }
        return null;
      },
      { label, scene: o.scene, exact: o.exact },
    );
  }
  /** Tap the middle of a DOM element (CSS px), by real touch. */
  async tapSel(sel) {
    const r = await this.ev((sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, sel);
    if (!r) throw new Error(`no element ${sel}`);
    await this.tapCss(r.x, r.y);
  }
  guide() {
    return this.ev(() => {
      const g = window.__krelMobile.guide;
      const card = document.querySelector(".kah-card");
      return { open: g.isOpen, variant: g.last ? g.last.variant : null, primary: g.last ? g.last.primary : null, title: g.last ? g.last.title : null, scroll: card ? card.scrollHeight - card.clientHeight : null };
    });
  }
  /** Readability's state: on, ever patched, and how many texts carry its marks. */
  readState() {
    return this.ev(() => {
      const g = window.__krel.game;
      let patched = false;
      let marked = 0;
      for (const sc of g.scene.scenes)
        for (const o of sc.sys.displayList.list) {
          if (o.type !== "Text") continue;
          patched = patched || !!Object.getPrototypeOf(o).updateText.__krelFloor;
          if (o.style.__mfApplied !== undefined) marked++;
        }
      const r = window.__krelMobile.readability;
      return { on: r.on, refreshes: r.stats.refreshes, patched, marked };
    });
  }
  async tapText(label, o = {}) {
    const h = await this.find(label, o);
    if (!h) throw new Error(`nothing tappable says "${label}"`);
    await this.tapGame(h.x, h.y);
  }
  snap() {
    return this.ev(() => window.__krelMobile.snapshot());
  }
  mode() {
    return this.ev(() => {
      const d = window.__krelMobile.snapshot().decision;
      return `${d.mode}:${d.scene}`;
    });
  }
  me() {
    return this.ev(() => {
      const h = window.__krel.game.scene.getScene("Home");
      return [Math.round(h.me.x), Math.round(h.me.y)];
    });
  }
  touchState() {
    return this.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { mx: T.mx, my: T.my, enabled: T.enabled, edges: [...T.edges] };
    });
  }
  loop() {
    return this.ev(() => ({ running: window.__krel.game.loop.running, frame: window.__krel.game.loop.frame }));
  }
  async shot(name) {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await this.page.screenshot({ path: path.join(SHOTS, `${name}.png`), scale: "css" });
  }
}

async function openPage(browser, profile, url) {
  const ctx = await browser.newContext(profile);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const ph = new Phone(page, cdp);
  await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
  return { ctx, page, ph, errors };
}

// ------------------------------------------------------------------ phone

async function phone(browser) {
  console.log("PHONE (iPhone 14 landscape, touch)");
  const { ctx, ph, errors } = await openPage(browser, IPHONE, URL0);
  try {
    const shell = await ph.ev(() => ({ cls: document.documentElement.classList.contains("mobile"), layer: !!document.querySelector("#game > .kt"), css: !!document.getElementById("krel-mobile-css"), api: !!window.__krelMobile }));
    check("phone mode is on: mobile class, phone CSS, layer inside #game", shell.cls && shell.layer && shell.css && shell.api, shell);
    const r = await ph.rect();
    const right = 844 - (r.x + r.w);
    check("canvas centred: gutters symmetrical", Math.abs(r.x - right) <= 1.5, { left: r.x, right });

    // the Enter gate and the front end, by taps
    await ph.page.waitForTimeout(1200);
    await ph.tapCss(422, 300);
    await ph.scene("Title");
    // the Add to Home Screen guide: once, by itself, over the title, before a game is started
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 15000, "the Add to Home Screen guide").catch(() => 0);
    let gs = await ph.guide();
    check("first phone run: the Add to Home Screen guide shows itself over the title (iPhone Safari steps, fits)", gs.open && gs.variant === "ios-safari" && gs.scroll === 0, gs);
    await ph.shot("phone-guide-first-run");
    await ph.tapSel(".kah-later");
    await sleep(500);
    const seen = await ph.ev(async () => ({ open: window.__krelMobile.guide.isOpen, seen: localStorage.getItem((await import("/src/game/variant.ts")).storageKey("krelworld.phone.homeScreenGuide")), title: window.__krel.active().includes("Title") }));
    check("NOT NOW closes it, the title is still there, and it won't show itself again", !seen.open && seen.seen === "seen" && seen.title, seen);
    check("the title's corner button is ADD TO HOME SCREEN on a phone (no FULLSCREEN, no one-line hint)", !!(await ph.find("ADD TO HOME SCREEN", { scene: "Title" })) && !(await ph.find("FULLSCREEN", { scene: "Title" })));
    await ph.tapText("ADD TO HOME SCREEN", { scene: "Title" });
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 5000, "the guide from the title").catch(() => 0);
    check("which opens the guide", (await ph.guide()).open);
    await ph.tapSel(".kah-x");
    await sleep(400);
    check("✕ closes it", !(await ph.guide()).open);
    const rs = await ph.readState();
    check("readability is off by default and has touched nothing (no patch, no text resized)", !rs.on && rs.refreshes === 0 && !rs.patched && rs.marked === 0, rs);
    await ph.page.waitForTimeout(800);
    await ph.tapText("NEW GAME");
    await ph.scene("CharSelect");
    await ph.page.waitForTimeout(1500);
    await ph.tapGame(92, 140);
    await ph.scene("Difficulty");
    await ph.page.waitForTimeout(1200);
    await ph.tapText("NEXT: BANTER");
    await ph.scene("Banter");
    await ph.page.waitForTimeout(1200);
    await ph.tapText("LET'S KREZ");
    await ph.scene("Home", 180000);
    check("a new game started by taps reaches Home", true);
    await ph.page.waitForTimeout(2500);
    check("during the welcome conversation the layer shows nothing", (await ph.mode()) === "none:Home", await ph.mode());
    await ph.shot("phone-home-welcome");
    let taps = 0;
    for (; taps < 40 && (await ph.ev(() => window.__krel.game.scene.getScene("Home").busy)); taps++) {
      await ph.tapCss(600, 200);
      await ph.page.waitForTimeout(650);
    }
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 20000, "walk mode");
    let s = await ph.snap();
    check("Home after the welcome: walk mode, idle stick and pause up, no ACTION", s.decision.mode === "walk" && s.ghost && s.buttons.pause && !s.buttons.action, { taps, buttons: s.buttons, ghost: s.ghost });
    const ui = await ph.ev(() => ({ pad: window.__krel.game.scene.getScene("UI").touch }));
    check("the old canvas pad is not made in town on a phone (blocker B1)", ui.pad === null);
    check("TOUCH is on", (await ph.touchState()).enabled);
    await ph.shot("phone-home");

    // the stick
    let a = await ph.me();
    await ph.touch("touchStart", [{ x: 150, y: 290, id: 1 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: 150 + i * 12, y: 290, id: 1 }]);
      await sleep(30);
    }
    await sleep(700);
    const during = await ph.touchState();
    await ph.shot("phone-home-drag");
    await ph.touch("touchEnd", []);
    await sleep(200);
    let b = await ph.me();
    check("a drag in the stick zone moves the player", b[0] - a[0] >= 40 && during.mx > 0.9, { from: a, to: b, mx: during.mx });
    check("letting go stops the player", (await ph.touchState()).mx === 0);
    const gx = Math.max(4, r.x / 2);
    a = await ph.me();
    await ph.touch("touchStart", [{ x: gx, y: 300, id: 2 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: gx + i * 10, y: 300, id: 2 }]);
      await sleep(30);
    }
    await sleep(600);
    await ph.touch("touchEnd", []);
    await sleep(200);
    b = await ph.me();
    check("a drag that starts in the left gutter moves the player", b[0] - a[0] >= 25, { startX: gx, from: a, to: b });
    // the "Stick: stays put" setting: the base stays at its resting place, a thumb anywhere in the zone steers from it
    const restAt = await ph.ev(() => {
      const st = document.querySelector(".kt-stick").style.transform;
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(st);
      return m ? [+m[1], +m[2]] : null;
    });
    await ph.ev(() => window.__krelMobile.settings.set({ stick: "fixed" }));
    a = await ph.me();
    await ph.touch("touchStart", [{ x: restAt[0] + 70, y: restAt[1], id: 21 }]);
    await sleep(600);
    const fixedSnap = await ph.snap();
    await ph.touch("touchEnd", []);
    await sleep(200);
    b = await ph.me();
    await ph.ev(() => window.__krelMobile.settings.set({ stick: "floating" }));
    check("fixed stick: the base stays put and a thumb to its right walks right at once", !!fixedSnap.stick && Math.abs(fixedSnap.stick.x - restAt[0]) < 1 && Math.abs(fixedSnap.stick.y - restAt[1]) < 1 && b[0] - a[0] >= 20, { restAt, base: fixedSnap.stick, from: a, to: b });

    // a quick tap in the stick zone reaches the game as a tap there; a drag does not
    await ph.ev(() => {
      const h = window.__krel.game.scene.getScene("Home");
      window.__smokeTaps = [];
      const z = h.add.zone(150, 330, 120, 120).setInteractive();
      z.on("pointerdown", (p) => window.__smokeTaps.push(["down", Math.round(p.x), Math.round(p.y)]));
      z.on("pointerup", () => window.__smokeTaps.push(["up"]));
      window.__smokeZone = z;
    });
    const [zx, zy] = await ph.g2c(150, 330);
    a = await ph.me();
    await ph.tapCss(zx, zy);
    await sleep(500);
    const tapLog = await ph.ev(() => window.__smokeTaps.splice(0));
    check("a quick tap in the stick zone reaches the game at that point (down and up)", tapLog.length === 2 && tapLog[0][1] === 150 && tapLog[0][2] === 330 && tapLog[1][0] === "up", tapLog);
    check("and does not move the player", JSON.stringify(a) === JSON.stringify(await ph.me()));
    await ph.touch("touchStart", [{ x: zx, y: zy, id: 3 }]);
    for (let i = 1; i <= 4; i++) {
      await ph.touch("touchMove", [{ x: zx + i * 12, y: zy, id: 3 }]);
      await sleep(30);
    }
    await sleep(200);
    await ph.touch("touchEnd", []);
    await sleep(400);
    check("a drag from the same spot is the stick, not a tap", (await ph.ev(() => window.__smokeTaps.length)) === 0);
    await ph.ev(() => window.__smokeZone.destroy());

    // ACTION at something usable
    await ph.ev(() => {
      const h = window.__krel.game.scene.getScene("Home");
      const j = h.spots.find((sp) => /Jukebox/.test(sp.label));
      h.me.x = j.x;
      h.me.y = j.y;
    });
    await ph.until(() => window.__krelMobile.snapshot().buttons.action, null, 5000, "ACTION");
    s = await ph.snap();
    check("ACTION appears at an interactable, with a word on it", s.buttons.action && /^[A-Z]{2,}$/.test(s.actionLabel), { label: s.actionLabel });
    const pw = await ph.ev(() => {
      const p = window.__krel.game.scene.getScene("Home").prompt;
      return { shown: p.text, raw: p.__krelRaw };
    });
    check("the prompt bubble speaks touch ('Tap: ...' instead of 'E: ...'); ACTION still reads its verb", /^Tap: Jukebox/.test(pw.shown) && /^E: Jukebox/.test(pw.raw), pw);
    await ph.shot("phone-home-action");
    // stick and ACTION at once (two fingers)
    // (the stick held inside its dead zone, so the player stays at the jukebox)
    await ph.touch("touchStart", [{ x: 150, y: 300, id: 4 }]);
    await ph.touch("touchMove", [{ x: 150, y: 304, id: 4 }]);
    await sleep(400); // (past the ACTION button's 160 ms arming time)
    const stickHeld = await ph.ev(() => window.__krelMobile.snapshot().stick);
    await ph.touch("touchStart", [
      { x: 150, y: 304, id: 4 },
      { x: s.slots.prime.cx, y: s.slots.prime.cy, id: 5 },
    ]);
    await sleep(120);
    await ph.touch("touchEnd", [{ x: 150, y: 304, id: 4 }]);
    await ph.touch("touchEnd", []);
    await ph.until(() => window.__krel.game.scene.getScene("Home").busy, null, 5000, "the jukebox to open").catch(() => 0);
    const opened = await ph.ev(() => window.__krel.game.scene.getScene("Home").busy);
    check("ACTION uses the thing (the jukebox opens) while the other thumb holds the stick", opened && !!stickHeld && stickHeld.live, { stickHeld });
    check("a panel open: the layer takes no touches", (await ph.mode()) === "none:Home");
    const hintText = await ph.ev(() => {
      const found = [];
      const walk = (o) => {
        if (o.type === "Container") o.list.forEach(walk);
        else if (o.type === "Text" && /to close/.test(o.text)) found.push(o.text);
      };
      window.__krel.game.scene.getScene("Home").children.list.forEach(walk);
      return found;
    });
    check("the panel's close hint reads '✕ to close' (no ESC on a phone)", hintText.length === 1 && hintText[0] === "✕ to close", hintText);
    await ph.tapText("✕", { scene: "Home", exact: true });
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 8000, "walk again");
    check("closing the panel brings the walking controls back", true);
    check("no stray input left over", (await ph.touchState()).mx === 0 && (await ph.touchState()).my === 0);

    // touchcancel lets go
    await ph.touch("touchStart", [{ x: 160, y: 300, id: 6 }]);
    for (let i = 1; i <= 4; i++) {
      await ph.touch("touchMove", [{ x: 160 + i * 12, y: 300, id: 6 }]);
      await sleep(30);
    }
    await sleep(150);
    const held = (await ph.touchState()).mx;
    await ph.touch("touchCancel", []);
    await sleep(150);
    check("touchcancel lets go of the stick", held > 0.5 && (await ph.touchState()).mx === 0, { held });

    // pause and resume
    s = await ph.snap();
    await ph.tapCss(s.slots.pause.cx, s.slots.pause.cy);
    await ph.until(() => window.__krel.active().includes("Menu"), null, 8000, "the pause menu").catch(() => 0);
    const paused = await ph.ev(() => ({ menu: window.__krel.active().includes("Menu"), home: window.__krel.game.scene.isPaused("Home") }));
    check("the pause button opens the pause menu", paused.menu && paused.home, paused);
    await ph.shot("phone-pause");
    check("the pause menu has no phone controls over it", (await ph.mode()).startsWith("none"));
    check("the pause menu has ADD TO HOME SCREEN (in place of FULLSCREEN)", !!(await ph.find("ADD TO HOME SCREEN", { scene: "Menu" })) && !(await ph.find("FULLSCREEN", { scene: "Menu" })));
    await ph.tapText("ADD TO HOME SCREEN", { scene: "Menu" });
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 5000, "the guide from pause").catch(() => 0);
    check("which opens the guide over the pause menu", (await ph.guide()).open && (await ph.ev(() => window.__krel.active().includes("Menu"))));
    await ph.shot("phone-guide-from-pause");
    await ph.tapSel(".kah-later");
    await sleep(400);
    await ph.tapText("RESUME", { scene: "Menu", exact: true });
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 8000, "walk after resume").catch(() => 0);
    check("RESUME closes it and the walking controls come back", (await ph.mode()) === "walk:Home");

    // the back gesture pauses instead of leaving
    await ph.ev(() => history.back());
    await ph.until(() => window.__krel.active().includes("Menu"), null, 8000, "pause by back").catch(() => 0);
    check("the back gesture pauses the game (and the page stays)", await ph.ev(() => window.__krel.active().includes("Menu") && !!window.__krelMobile));
    await ph.tapText("RESUME", { scene: "Menu", exact: true });
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 8000, "walk").catch(() => 0);

    // portrait
    await ph.page.setViewportSize({ width: 390, height: 844 });
    await sleep(1200);
    const p1 = await ph.loop();
    await sleep(1000);
    const p2 = await ph.loop();
    const ov = await ph.ev(() => ({ shown: document.querySelector(".krot").classList.contains("show"), music: window.__krel.synth.musicPaused, ctx: window.__krel.synth.ctx ? window.__krel.synth.ctx.state : null }));
    check("portrait: the turn-your-phone screen is up", ov.shown);
    check("portrait: the game loop sleeps", !p2.running && p2.frame === p1.frame, { p1, p2 });
    check("portrait: the music and the sound are held", ov.music === true && ov.ctx !== "running", ov);
    await ph.shot("phone-portrait");
    check("the turn-your-phone screen has an Add to Home Screen button", await ph.ev(() => !!document.querySelector(".krot-extra .kah-rot")));
    await ph.tapSel(".krot-extra .kah-rot");
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 5000, "the guide from the rotate screen").catch(() => 0);
    gs = await ph.guide();
    const portraitLayout = await ph.ev(() => getComputedStyle(document.querySelector(".kah-step")).flexDirection);
    check("which opens the guide, laid out for upright (steps in rows, fits)", gs.open && portraitLayout === "row" && gs.scroll === 0, { ...gs, portraitLayout });
    await ph.shot("phone-guide-portrait");
    await ph.tapSel(".kah-later");
    await sleep(300);
    const p3 = await ph.loop();
    check("closing it leaves the turn-your-phone screen up and the game asleep", !(await ph.guide()).open && (await ph.ev(() => document.querySelector(".krot").classList.contains("show"))) && !p3.running);
    await ph.page.setViewportSize({ width: 844, height: 390 });
    await sleep(1200);
    const l1 = await ph.loop();
    await sleep(700);
    const l2 = await ph.loop();
    const back = await ph.ev(() => ({ shown: document.querySelector(".krot").classList.contains("show"), music: window.__krel.synth.musicPaused, ctx: window.__krel.synth.ctx ? window.__krel.synth.ctx.state : null }));
    check("landscape again: the screen goes, the loop runs, the sound is back", !back.shown && l2.running && l2.frame > l1.frame && back.music === false && back.ctx === "running", { back, l1, l2 });
    check("landscape again: still walking at home", (await ph.mode()) === "walk:Home");

    // the page hidden mid-press
    const saveKey = await ph.ev(async () => (await import("/src/game/variant.ts")).storageKey("krelworld.save"));
    await ph.ev((k) => localStorage.removeItem(k), saveKey);
    await ph.touch("touchStart", [{ x: 160, y: 300, id: 8 }]);
    for (let i = 1; i <= 4; i++) {
      await ph.touch("touchMove", [{ x: 160 + i * 12, y: 300, id: 8 }]);
      await sleep(30);
    }
    await sleep(150);
    const setVis = (v) =>
      ph.ev((v) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => v === "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      }, v);
    await setVis("hidden");
    await sleep(500);
    const h1 = await ph.loop();
    await sleep(600);
    const h2 = await ph.loop();
    const hid = await ph.ev((k) => ({ saved: localStorage.getItem(k) !== null, music: window.__krel.synth.musicPaused }), saveKey);
    const ts = await ph.touchState();
    check("hidden mid-press: the stick lets go", ts.mx === 0 && ts.my === 0, ts);
    check("hidden: the loop sleeps, the music holds, the game saves", !h2.running && h2.frame === h1.frame && hid.music && hid.saved, { h1, h2, ...hid });
    await setVis("visible");
    await sleep(900);
    // (the finger that was down when the page hid does nothing more, even if it moves)
    await ph.touch("touchMove", [{ x: 260, y: 300, id: 8 }]);
    await sleep(150);
    check("visible again: that old finger does nothing", (await ph.touchState()).mx === 0);
    await ph.touch("touchEnd", []);
    const v2 = await ph.loop();
    await sleep(500);
    const v3 = await ph.loop();
    check("visible again: the loop runs and the music is back", v3.running && v3.frame > v2.frame && (await ph.ev(() => window.__krel.synth.musicPaused)) === false);
    a = await ph.me();
    await ph.touch("touchStart", [{ x: 150, y: 290, id: 9 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: 150 - i * 12, y: 290, id: 9 }]);
      await sleep(30);
    }
    await sleep(500);
    await ph.touch("touchEnd", []);
    await sleep(200);
    b = await ph.me();
    check("and a new drag walks again", a[0] - b[0] >= 30, { from: a, to: b });
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ starting upright

async function upright(browser) {
  console.log("UPRIGHT START (the phone held upright while the game loads)");
  const ctx = await browser.newContext({ ...IPHONE, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const ph = new Phone(page, await ctx.newCDPSession(page));
  try {
    await page.goto(URL0, { waitUntil: "domcontentloaded" });
    await ph.until(() => !!document.querySelector(".krot"), null, 60000, "the rotate screen");
    const early = await ph.ev(() => ({ shown: document.querySelector(".krot").classList.contains("show"), loading: !window.__krel || !window.__krel.active().includes("Enter") }));
    check("the rotate screen is up while the game is still loading", early.shown && early.loading, early);
    await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "loading to finish behind it");
    check("the art keeps loading behind it (the Enter gate is reached while upright)", true);
    await sleep(800);
    const l1 = await ph.loop();
    await sleep(800);
    const l2 = await ph.loop();
    check("once loaded, the loop sleeps while upright", !l2.running && l1.frame === l2.frame, { l1, l2 });
    await ph.shot("upright-boot");
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(1200);
    const st = await ph.ev(() => ({ shown: document.querySelector(".krot").classList.contains("show"), running: window.__krel.game.loop.running }));
    check("turned sideways: the screen goes and the game runs", !st.shown && st.running, st);
    await ph.tapCss(422, 300);
    await ph.scene("Title", 60000);
    check("and the Enter gate takes the tap", true);
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the phone settings store

/** A fresh phone page that only needs the phone module (not the whole boot). */
async function quickPage(browser, profile, url, init) {
  const ctx = await browser.newContext(profile);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const ph = new Phone(page, await ctx.newCDPSession(page));
  await ph.until(() => !!window.__krelMobile && !!window.__krel, null, 120000, "the phone module");
  return { ctx, page, ph, errors };
}

async function settings(browser) {
  console.log("SETTINGS (the phone settings store)");
  let { ctx, page, ph, errors } = await quickPage(browser, IPHONE, URL0);
  try {
    const key = await ph.ev(async () => (await import("/src/game/variant.ts")).storageKey("krelworld.phone.settings"));
    let st = await ph.ev((k) => ({ s: window.__krelMobile.settings.get(), stored: localStorage.getItem(k), n: window.__krelMobile.settings.list().length }), key);
    check("defaults: right-handed, M, 30%, auto-fire, normal aim assist, phone assist on, battery saver off, readability off, haptics on", JSON.stringify(st.s) === JSON.stringify({ leftHanded: false, buttonSize: "M", opacity: 0.3, stick: "floating", autoFire: true, aimAssist: "normal", phoneAssist: true, batterySaver: false, readability: false, textSize: "normal", haptics: true, syncOffsetMs: 0, playOverMyMusic: false }), st.s);
    check("nothing is written just by loading", st.stored === null);
    check("the typed list a settings screen renders has every setting", st.n === 13, st.n);
    const before = await ph.snap();
    await ph.ev(() => window.__krelMobile.settings.set({ buttonSize: "L", leftHanded: true, opacity: 0.6 }));
    await sleep(100);
    const after = await ph.snap();
    const css = await ph.ev(() => getComputedStyle(document.querySelector(".kt")).getPropertyValue("--kt-a").trim());
    check("bigger buttons at once (L)", after.slots.prime.size > before.slots.prime.size + 10, { before: before.slots.prime.size, after: after.slots.prime.size });
    check("left-handed mirrors at once (ACTION's corner on the left, the stick zone on the right)", after.slots.prime.cx < 422 && before.slots.prime.cx > 422 && after.zone.x > 300, { before: before.slots.prime.cx, after: after.slots.prime.cx, zone: after.zone.x });
    check("opacity at once", css === "0.6", css);
    st = await ph.ev((k) => localStorage.getItem(k), key);
    check("saved under its own key", !!st && JSON.parse(st).buttonSize === "L" && JSON.parse(st).leftHanded === true, st);
    const rate = () =>
      ph.ev(
        () =>
          new Promise((res) => {
            // (game steps, not animation frames: with a cap the loop still wakes every frame but steps less)
            const ev = window.__krel.game.events;
            let n = 0;
            const count = () => n++;
            ev.on("poststep", count);
            const t0 = performance.now();
            setTimeout(() => {
              ev.off("poststep", count);
              res((n * 1000) / (performance.now() - t0));
            }, 2000);
          }),
      );
    const free = await rate();
    await ph.ev(() => window.__krelMobile.settings.set({ batterySaver: true }));
    await sleep(300);
    const capped = await rate();
    const cap = await ph.ev(() => ({ limit: window.__krel.game.loop.fpsLimit, on: window.__krel.game.loop.hasFpsLimit }));
    check("battery saver caps the loop at 30 frames a second", cap.on && cap.limit === 30 && capped <= 31.5, { ...cap, free: +free.toFixed(1), capped: +capped.toFixed(1) });
    await ph.ev(() => window.__krelMobile.settings.set({ batterySaver: false }));
    const uncapped = await ph.ev(() => window.__krel.game.loop.hasFpsLimit);
    check("and lets go of it", uncapped === false);
    check("no page errors", errors.length === 0, errors.slice(0, 3));
    // the next visit
    await page.reload({ waitUntil: "domcontentloaded" });
    await ph.until(() => !!window.__krelMobile, null, 120000, "the phone module again");
    const again = await ph.ev(() => ({ s: window.__krelMobile.settings.get(), snap: window.__krelMobile.snapshot() }));
    check("the next visit loads them (and the controls start laid out that way)", again.s.buttonSize === "L" && again.s.leftHanded && again.s.opacity === 0.6 && again.snap.slots.prime.cx < 422, again.s);
    await ph.shot("settings-lefthanded-L");
  } finally {
    await ctx.close();
  }
  // private mode: every storage call throws
  ({ ctx, page, ph, errors } = await quickPage(browser, IPHONE, URL0, () => {
    const boom = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => ({ getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }) });
  }));
  try {
    const r = await ph.ev(() => {
      try {
        window.__krelMobile.settings.set({ buttonSize: "S", haptics: false });
        return { ok: true, s: window.__krelMobile.settings.get() };
      } catch (e) {
        return { ok: false, e: String(e) };
      }
    });
    check("private mode (storage throws): the phone module starts, settings change without an error", r.ok && r.s.buttonSize === "S" && r.s.haptics === false, r);
    check("no page errors in private mode", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ readability

/** Every visible text's size on the screen (CSS px): font x scales x camera zoom x canvas scale. */
function textSizes() {
  return window.__krel.game.scene.scenes.flatMap((sc) => {
    const sys = sc.sys;
    if (!(sys.isActive() || sys.isPaused()) || !sys.isVisible()) return [];
    const g = window.__krel.game;
    const k = g.scale.canvasBounds.width / g.scale.width;
    const cam = sc.cameras.main;
    const out = [];
    const walk = (o, s, a) => {
      if (!o || o.visible === false || o.active === false) return;
      const al = a * (o.alpha === undefined ? 1 : o.alpha);
      if (o.type === "Container") return o.list.forEach((c) => walk(c, s * Math.abs(o.scaleY), al));
      if (o.type !== "Text" || !o.text.trim() || al < 0.05) return;
      let tw = false;
      try {
        tw = sc.tweens.isTweening(o) || (o.parentContainer && sc.tweens.isTweening(o.parentContainer));
      } catch (e) {}
      const b = o.getBounds();
      const gy = (b.centerY - cam.scrollY * (o.scrollFactorY ?? 1)) * cam.zoom;
      const gx = (b.centerX - cam.scrollX * (o.scrollFactorX ?? 1)) * cam.zoom;
      const on = gx > -10 && gx < 970 && gy > -10 && gy < 550;
      // (the rendered glyph box from the font's own metrics, in CSS px)
      const m = o.style.metrics ? o.style.metrics.fontSize : 0;
      out.push({ scene: sys.settings.key, text: o.text.slice(0, 24), css: parseFloat(o.style.fontSize) * s * Math.abs(o.scaleY) * (cam.zoom || 1) * k, glyph: m * s * Math.abs(o.scaleY) * (cam.zoom || 1) * k, req: o.style.__mfReq ?? null, fs: o.style.fontSize, on, tw });
    };
    sys.displayList.list.forEach((o) => walk(o, 1, 1));
    return out;
  });
}

async function read(browser) {
  console.log("READABILITY (?mobileread=1, iPhone in Safari with its bars, 750x340)");
  const u = new URL(URL0);
  u.searchParams.set("mobileread", "1");
  const { ctx, ph, errors } = await openPage(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }, u.toString());
  try {
    await ph.page.waitForTimeout(1200);
    await ph.tapCss(375, 260);
    await ph.scene("Title");
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 15000, "the guide").catch(() => 0);
    await ph.ev(() => window.__krelMobile.guide.close());
    await ph.page.waitForTimeout(1500);
    const rs = await ph.readState();
    check("?mobileread=1 turns it on (the setting itself stays off)", rs.on && rs.patched && !(await ph.ev(() => window.__krelMobile.settings.get().readability)), rs);
    let t = (await ph.ev(textSizes)).filter((x) => x.on && !x.tw);
    let min = Math.min(...t.map((x) => x.css));
    check("title: no text under 10 CSS px", min >= 10 - 1e-6, { min: +min.toFixed(2), count: t.length, small: t.filter((x) => x.css < 10).slice(0, 4) });
    check("title: the rendered glyph boxes are at least 10 CSS px too", Math.min(...t.map((x) => x.glyph)) >= 10 - 1e-6, Math.min(...t.map((x) => x.glyph)).toFixed(2));
    check("title: some texts were raised (they were under 10)", t.some((x) => x.req !== null && x.req < parseFloat(x.fs)), t.filter((x) => x.req !== null).length);
    await ph.shot("read-on-title-750x340");
    await ph.tapText("SETTINGS", { scene: "Title" });
    await ph.scene("Menu");
    await ph.page.waitForTimeout(1200);
    t = (await ph.ev(textSizes)).filter((x) => x.on && !x.tw && x.scene === "Menu");
    min = Math.min(...t.map((x) => x.css));
    check("settings menu: no text under 10 CSS px", min >= 10 - 1e-6, { min: +min.toFixed(2), count: t.length });
    await ph.shot("read-on-settings-750x340");
    // a tap just below the BACK button's drawing (inside its 44 CSS px tap area) reaches it
    const back = await ph.ev(() => {
      const g = window.__krel.game;
      const sc = g.scene.getScene("Menu");
      const o = sc.input._list.find((x) => x.parentContainer && x.parentContainer.list.some((c) => c.type === "Text" && /BACK/.test(c.text)));
      const b = o.getBounds();
      const cb = g.scale.canvasBounds;
      const k = cb.width / 960;
      return { x: cb.x + b.centerX * k, bottom: cb.y + b.bottom * k, h: b.height * k };
    });
    const snaps0 = await ph.ev(() => window.__krelMobile.readability.stats.snaps);
    await ph.tapCss(back.x, back.bottom + Math.min(8, (44 - back.h) / 2 - 1));
    await ph.until(() => !window.__krel.active().includes("Menu"), null, 5000, "BACK").catch(() => 0);
    const closed = await ph.ev(() => !window.__krel.active().includes("Menu"));
    check("a tap just outside a small button (inside its 44 CSS px tap area) reaches it", closed && (await ph.ev(() => window.__krelMobile.readability.stats.snaps)) > snaps0, back);
    // off again: every text back at the size the game asked for
    await ph.ev(() => window.__krelMobile.readability.set(false));
    await sleep(500);
    t = await ph.ev(textSizes);
    const wrong = t.filter((x) => x.req !== null && Math.abs(parseFloat(x.fs) - x.req) > 0.01);
    check("turned off: every text is back at the size the game asked for", wrong.length === 0, wrong.slice(0, 4));
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the Add to Home Screen guide, per browser

const UA = {
  iosSafari: IOS_UA,
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iosEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.2903.68 Mobile/15E148 Safari/605.1.15",
  iosFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; en_GB; en-GB; scale=3.00; 1179x2556)",
  iosMessenger: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.48.109;FBBV/1;FBDV/iPhone15,2]",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidEdge: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.2903.70",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.38.109;]",
};
const ANDROID = { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function guide(browser) {
  console.log("ADD TO HOME SCREEN GUIDE (per browser)");
  const cases = [
    ["iosSafari", "ios-safari", "ok", { ...IPHONE }],
    ["iosSafari", "ios-safari", "ok", { ...IPHONE, viewport: { width: 750, height: 340 } }, "safari-bars"],
    ["iosChrome", "ios-chrome", "ok", { ...IPHONE }],
    ["iosEdge", "ios-edge", "ok", { ...IPHONE }],
    ["iosFirefox", "ios-firefox", "ok", { ...IPHONE }],
    ["iosInstagram", "in-app", "copy", { ...IPHONE }],
    ["iosMessenger", "in-app", "copy", { ...IPHONE }],
    ["androidChrome", "android-chrome", "ok", { ...ANDROID }],
    ["androidEdge", "android-edge", "ok", { ...ANDROID }],
    ["androidSamsung", "android-samsung", "ok", { ...ANDROID }],
    ["androidFirefox", "android-firefox", "ok", { ...ANDROID }],
    ["androidFacebook", "in-app", "copy", { ...ANDROID }],
  ];
  for (const [ua, variant, primary, prof, tag] of cases) {
    const { ctx, ph, errors } = await quickPage(browser, { ...prof, userAgent: UA[ua] }, URL0);
    try {
      await ph.ev(() => window.__krelMobile.guide.open("test"));
      await sleep(200);
      const g = await ph.guide();
      const box = await ph.ev(() => {
        const b = [...document.querySelectorAll(".kah-b,.kah-x")].map((e) => e.getBoundingClientRect().height);
        const steps = document.querySelectorAll(".kah-step").length;
        const icons = document.querySelectorAll(".kah-step svg, .kah-step .kah-word, .kah-step .kah-app").length;
        return { minBtn: Math.min(...b), steps, icons };
      });
      const ok = g.open && g.variant === variant && g.primary === primary && g.scroll === 0 && box.minBtn >= 44 && box.icons === box.steps;
      check(`${ua}${tag ? ` (${tag})` : ""} ${prof.viewport.width}x${prof.viewport.height}: the ${variant} steps, a drawn icon per step, fits, 44 px buttons`, ok, { ...g, ...box });
      await ph.shot(`guide-${variant}-${ua}${tag ? `-${tag}` : ""}-${prof.viewport.width}x${prof.viewport.height}`);
      if (ua === "androidChrome") {
        // the browser offers its install prompt: INSTALL calls it
        const asked = await ph.ev(() => {
          window.__fake = window.__krelMobile.fakeInstallPrompt("accepted");
          return true;
        });
        await sleep(200);
        const g2 = await ph.guide();
        check("Android Chrome with the install prompt: the main button is INSTALL", asked && g2.primary === "install" && (await ph.ev(() => document.querySelector(".kah-main").textContent)) === "INSTALL", g2);
        await ph.shot("guide-android-chrome-install-prompt-740x360");
        await ph.tapSel(".kah-main");
        await sleep(600);
        const done = await ph.ev(() => ({ asked: window.__fake.asked(), toast: document.querySelector(".kah-toast").textContent }));
        check("INSTALL calls the browser's install prompt, and says where to find it", done.asked === 1 && /Home Screen/.test(done.toast), done);
      }
      if (variant === "in-app") {
        await ph.tapSel(".kah-main");
        await sleep(400);
        const toast = await ph.ev(() => document.querySelector(".kah-toast").textContent);
        check(`${ua}: COPY LINK copies the link (or shows it)`, /Link copied|Copy this link/.test(toast), toast);
      }
      check(`${ua}: no page errors`, errors.length === 0, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
  // the portrait guide on the rotate screen, small Android
  {
    const { ctx, ph } = await quickPage(browser, { ...ANDROID, viewport: { width: 360, height: 740 }, userAgent: UA.androidSamsung }, URL0);
    try {
      await ph.tapSel(".krot-extra .kah-rot");
      await sleep(300);
      const g = await ph.guide();
      check("upright on the rotate screen (360x740): the guide opens, upright layout, fits", g.open && g.variant === "android-samsung" && g.scroll === 0, g);
      await ph.shot("guide-android-samsung-portrait-360x740");
    } finally {
      await ctx.close();
    }
  }
  // never from the home screen: iPhone (navigator.standalone) and Android (display-mode: standalone); but an Android
  // browser tab in the game's own fullscreen (display-mode: fullscreen matches there too) is NOT the home screen
  for (const [name, prof, init, home] of [
    ["iPhone home-screen app", { ...IPHONE }, () => Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true }), true],
    ["Android Chrome tab, fullscreen after the Enter tap", { ...ANDROID, userAgent: UA.androidChrome }, null, false],
    [
      "Android installed app",
      { ...ANDROID, userAgent: UA.androidChrome },
      () => {
        // (display-mode emulation: this Chromium's DevTools cannot emulate it, so the media query answers as an
        // installed app's would)
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) =>
          /display-mode:\s*(standalone|fullscreen)/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } : mm(q);
      },
      true,
    ],
  ]) {
    const ctx = await browser.newContext(prof);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const cdp = await ctx.newCDPSession(page);
    await page.goto(URL0, { waitUntil: "domcontentloaded" });
    const ph = new Phone(page, cdp);
    try {
      await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
      const mm = await ph.ev(() => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
      await ph.page.waitForTimeout(1000);
      await ph.tapCss(prof.viewport.width / 2, prof.viewport.height * 0.75);
      await ph.scene("Title");
      await ph.page.waitForTimeout(2500);
      const st = await ph.ev(() => ({ open: window.__krelMobile.guide.isOpen, rot: document.querySelectorAll(".krot-extra .kah-rot").length, fs: !!document.fullscreenElement, dmFull: matchMedia("(display-mode: fullscreen)").matches }));
      const corner = await ph.find("ADD TO HOME SCREEN", { scene: "Title" });
      if (home) check(`${name}: the guide never shows itself, and there is no Add to Home Screen button`, mm && !st.open && st.rot === 0 && !corner, { mm, ...st, corner: !!corner });
      else check(`${name}: still offered (the guide shows itself, the title has the button)`, st.fs && st.open && st.rot === 1 && !!corner, { ...st, corner: !!corner });
      check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
  // ?mobilediag: only with it; with ?mobile=1 on a computer too
  {
    const u = new URL(URL0);
    u.searchParams.set("mobilediag", "1");
    const { ctx, ph, errors } = await quickPage(browser, IPHONE, u.toString());
    try {
      await sleep(1200);
      const d = await ph.ev(() => ({ el: !!document.querySelector(".kdiag"), text: document.querySelector(".kdiag") ? document.querySelector(".kdiag").textContent : "" }));
      const want = [/fps \d/, /textures \d+ · ~[\d.]+ MB/, /sound \d+ decoded · ~[\d.]+ MB · audio/, /window 844x390 · visual 844x390/, /dpr 3/, /canvas 693x390 at 75,0 · scale 0\.722/, /safe area L0 R0 T0 B0/, /touch mode /, /phone mode ON by device: coarse yes · no hover yes · touch \d+ · short side 390/, /iPhone safari/, /readability off/, /last error: /];
      const missing = want.filter((re) => !re.test(d.text)).map(String);
      check("?mobilediag: the read-out shows fps, textures, sound, sizes, canvas scale, safe area, touch mode, why phone mode is on, last error", d.el && missing.length === 0, missing.length ? { missing, text: d.text } : undefined);
      await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
      await sleep(400);
      check("?mobilediag: shows the safe-area insets the layer uses", /safe area L47 R47 T0 B21/.test(await ph.ev(() => document.querySelector(".kdiag").textContent)));
      await ph.tapSel(".kdiag");
      await sleep(200);
      check("?mobilediag: a tap moves it to another corner", await ph.ev(() => document.querySelector(".kdiag").classList.contains("pos1")));
      await ph.shot("diag-844x390");
      check("?mobilediag: no page errors", errors.length === 0, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
    const plain = await quickPage(browser, IPHONE, URL0);
    try {
      check("without ?mobilediag: no read-out at all", (await plain.ph.ev(() => !document.querySelector(".kdiag") && window.__krelMobile.diag === null)) === true);
    } finally {
      await plain.ctx.close();
    }
    const dev = new URL(URL0);
    dev.searchParams.set("mobile", "1");
    dev.searchParams.set("mobilediag", "1");
    const pc = await quickPage(browser, DESKTOP, dev.toString());
    try {
      const txt = await pc.ph.ev(() => (document.querySelector(".kdiag") ? document.querySelector(".kdiag").textContent : ""));
      check("?mobile=1&mobilediag on a computer: the read-out says phone mode is on by the address", /phone mode ON by address/.test(txt), txt.split("\n").find((l) => l.startsWith("phone mode")));
      // (the address choice is remembered: forget it again)
      await pc.ph.ev(async () => localStorage.removeItem((await import("/src/game/variant.ts")).storageKey("krelworld.mobile")));
    } finally {
      await pc.ctx.close();
    }
  }
}

// ------------------------------------------------------------------ the escape hatch

async function optout(browser) {
  console.log("OPT-OUT (the same phone, ?mobile=0)");
  const u = new URL(URL0);
  u.searchParams.set("mobile", "0");
  const { ctx, ph, errors } = await openPage(browser, IPHONE, u.toString());
  try {
    const st = await ph.ev(async () => {
      const key = (await import("/src/game/variant.ts")).storageKey("krelworld.mobile");
      return { cls: document.documentElement.className, layer: !!document.querySelector(".kt"), rot: !!document.querySelector(".krot"), css: !!document.getElementById("krel-mobile-css"), api: "__krelMobile" in window, key, stored: localStorage.getItem(key) };
    });
    check("?mobile=0: no mobile class, no layer, no rotate screen, no phone CSS, no phone global", !/\bmobile\b/.test(st.cls) && !st.layer && !st.rot && !st.css && !st.api, st);
    check("?mobile=0 is remembered", st.stored === "0");
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the laptop

async function desktop(browser) {
  console.log("DESKTOP (1280x720, mouse)");
  const { ctx, ph, errors } = await openPage(browser, DESKTOP, URL0);
  try {
    const st = await ph.ev(async () => {
      const flag = await import("/src/game/mobile/flag.ts");
      const key = (await import("/src/game/variant.ts")).storageKey("krelworld.mobile");
      return { isMobile: flag.isMobile(), cls: document.documentElement.className, layer: !!document.querySelector(".kt"), rot: !!document.querySelector(".krot"), css: !!document.getElementById("krel-mobile-css"), api: "__krelMobile" in window, stored: localStorage.getItem(key) };
    });
    check("desktop: isMobile() is false", st.isMobile === false);
    check("desktop: no mobile class, no layer, no rotate screen, no phone CSS, no phone global, nothing stored", !/\bmobile\b/.test(st.cls) && !st.layer && !st.rot && !st.css && !st.api && st.stored === null, st);
    const extra = await ph.ev(async () => {
      const v = await import("/src/game/variant.ts");
      return { guide: !!document.querySelector(".kah"), diag: !!document.querySelector(".kdiag"), keys: Object.keys(localStorage).filter((k) => /phone/.test(k)), settings: localStorage.getItem(v.storageKey("krelworld.phone.settings")) };
    });
    check("desktop: no Add to Home Screen guide, no read-out, no phone settings or guide key", !extra.guide && !extra.diag && extra.keys.length === 0 && extra.settings === null, extra);
    await ph.ev(() => {
      window.__krel.newRun("FLENKY");
      Object.assign(window.__krel.G.s.flags, { home_seen: true, flyover_seen: true, tv_klerble_welcome: true });
      window.__krel.go("Home");
    });
    await ph.scene("UI", 120000);
    await sleep(1500);
    const ui = await ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { pad: window.__krel.game.scene.getScene("UI").touch, enabled: T.enabled };
    });
    check("desktop: the UI scene has no touch pad and TOUCH is off, as before", ui.pad === null && ui.enabled === false, ui);
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

(async () => {
  const t0 = Date.now();
  let browser;
  try {
    browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  } catch (e) {
    console.error("could not start the browser:", e.message);
    process.exit(2);
  }
  try {
    for (const [id, fn] of [
      ["phone", phone],
      ["upright", upright],
      ["settings", settings],
      ["read", read],
      ["guide", guide],
      ["optout", optout],
      ["desktop", desktop],
    ]) {
      if (!ONLY.includes(id)) continue;
      try {
        await fn(browser);
      } catch (e) {
        check(`${id}: ran to the end`, false, String(e && e.message ? e.message : e).slice(0, 300));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${results.length - failed} of ${results.length} checks passed in ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log(failed ? "MOBILE SMOKE: FAILED" : "MOBILE SMOKE: OK");
  process.exit(failed ? 1 : 0);
})();
