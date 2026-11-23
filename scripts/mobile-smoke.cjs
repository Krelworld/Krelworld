#!/usr/bin/env node
// PHONE MODE smoke test (Playwright, real touch events). Needs a running dev server.
//
//   npx vite --port 5202 --strictPort &
//   node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,dialogue,settings2,guide,optout,town,dungeon,android,desktop]
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
//          "ESC or ✕ to close" reads "✕ to close"; readability ("Bigger text") is on by default (stage 2).
// upright  the phone held upright from the start: the rotate screen covers the loading, the art loads behind it,
//          then the loop sleeps; turned sideways the game runs and the Enter gate takes a tap.
// settings the phone settings store: defaults, nothing written until a change, live re-layout of the controls
//          (size, left-handed, opacity), saved under its own key and loaded on the next visit, battery saver caps the
//          loop at 30, and private mode (storage throws) breaks nothing.
// read     readability on (by default since stage 2) at 750x340: no text under 11 CSS px on the title and the settings
//          menu, a tap just outside a small button reaches it; turned off, every text is back at the size the game
//          asked; ?mobileread=0 turns it off for a visit.
// dialogue (stage 2) a conversation over the Hub: SKIP / LOG / AUTO pills (44 px, on screen), reading text at 16 CSS px,
//          a tap advances and a tap while typing completes the line, a long line in more boxes with identical words,
//          LOG (native scroll), Back closes the LOG and does nothing else in a town conversation, choices (48 px rows,
//          no key numbers, reading size, an early tap ignored, a deliberate one picks), AUTO plays on by itself, SKIP
//          stops at the choice with every effect applied and then runs to the end; a cutscene's II and Back open its
//          pause menu; at 750x340 four choices take the screen with the question above them, nothing under 11 / 15.
// settings2 (stage 2) the title, the settings menu and the pause menu: every target 44 CSS px, no text under 11, the
//          objective clear of RESUME; the Phone settings page from the 📱 PHONE tab and the pause menu's row (two
//          columns, 48 px rows, help lines, Phone layout, "a Bluetooth controller works"), every row working by tap,
//          Bigger text off and on live, Back and DONE close it; character select at 750x340 with no overlaps.
// guide    the Add to Home Screen guide per browser (user agent): iPhone Safari / Chrome / Edge / Firefox,
//          Instagram, Messenger, Android Chrome (with and without the install prompt; INSTALL calls it), Edge,
//          Samsung Internet, Firefox, an Android in-app browser; at 844x390, 740x360 and 750x340; never shown from
//          the home screen (navigator.standalone, display-mode); ?mobilediag (and only with it).
// optout   the same phone with ?mobile=0: no layer, no "mobile" class, no phone CSS, no phone global.
// town     the Hub on a phone: with Mikey following, a door's ACTION is ENTER (not SHOVE); SHOVE when he's all
//          there is; the shoving match on the bridge shows SHOVE and it shoves; the first toasts speak touch.
// dungeon  Wildern room 1 on the old pad: the page hidden mid-press lets go of the old stick and ATTACK; coming back
//          (hidden → visible, upright → sideways, the guide from the rotate screen) opens the pause menu instead of
//          dropping into the fight; a fight with no pause menu waits behind "tap to carry on".
// android  Android Chrome 740x360: a press held past the Enter gate's fade still gets fullscreen and the back guard;
//          the guide's written steps leave fullscreen (and closing it goes back in); the crash guard's notices show
//          in fullscreen; an in-app browser shows "open it in Chrome first" during the load.
// desktop  1280x720, mouse: phone mode off, no class, no layer, no CSS, no global, and at home the UI scene has no
//          touch pad and TOUCH stays off (exactly as before). Also: a laptop with "1" left in storage by an old
//          ?mobile=1 link, and a laptop opening ?mobile=1, are laptops; the phone code reads no storage and asks no
//          media query on a laptop, and none of the phone chunk's modules is even fetched.
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
const ONLY = (arg("--only", "phone,upright,settings,read,dialogue,settings2,guide,optout,town,dungeon,android,desktop") || "").split(",").filter(Boolean);
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
    const gateWords = await ph.ev(() => {
      const t = [];
      const walk = (o) => (o.type === "Container" ? o.list.forEach(walk) : o.type === "Text" && o.visible && o.text && t.push(o.text));
      window.__krel.game.scene.getScene("Enter").children.list.forEach(walk);
      return t;
    });
    check("the Enter gate says TAP TO START on a phone (no 'PRESS ANY KEY', no 'OR CLICK')", gateWords.includes("TAP TO START") && !gateWords.some((t) => /PRESS ANY KEY|CLICK/.test(t)), gateWords);
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
    check("readability (Bigger text) is on by default since stage 2: the floor is in and has raised small texts", rs.on && rs.patched && rs.marked > 0, rs);
    // the back gesture where the game can't pause (the title): nothing happens, twice in a row, no touch between (R3)
    const url0 = ph.page.url();
    await ph.ev(() => history.back());
    await sleep(600);
    await ph.ev(() => history.back());
    await sleep(900);
    const afterBack = await ph.ev(() => ({ title: !!window.__krel && window.__krel.active().includes("Title"), guard: window.__krelMobile.shellState().guard }));
    check("Back twice on the title (no touch between): the page stays, still the title, the guard back up", ph.page.url() === url0 && afterBack.title && afterBack.guard, { url: ph.page.url(), ...afterBack });
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
    check("a new game started by taps reaches Home", (await ph.active()).includes("Home"));
    await ph.page.waitForTimeout(2500);
    check("during the welcome conversation the layer shows nothing", (await ph.mode()) === "none:Home", await ph.mode());
    // Back twice during a conversation: nothing happens, the conversation is still there (R3)
    await ph.ev(() => history.back());
    await sleep(600);
    await ph.ev(() => history.back());
    await sleep(900);
    const conv = await ph.ev(() => ({ home: window.__krel.active().includes("Home"), busy: window.__krel.game.scene.getScene("Home").busy, menu: window.__krel.active().includes("Menu") }));
    check("Back twice in a conversation: the page stays, the conversation stays, no pause menu", ph.page.url() === url0 && conv.home && conv.busy && !conv.menu, conv);
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
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 8000, "walk again").catch(() => 0);
    check("closing the panel brings the walking controls back", (await ph.mode()) === "walk:Home");
    check("no stray input left over", (await ph.touchState()).mx === 0 && (await ph.touchState()).my === 0);

    // the prompt bubble inside the stick zone (the trophy shelf, left of the room): a drag from it walks, a quick tap
    // on it uses the shelf (R1, P8); a tap on the shelf itself uses it too (P5)
    const putMe = (x, y) => ph.ev(([x, y]) => {
      const h = window.__krel.game.scene.getScene("Home");
      h.me.x = x;
      h.me.y = y;
    }, [x, y]);
    const homeBusy = () => ph.ev(() => window.__krel.game.scene.getScene("Home").busy === true);
    /** Wait until Home's prompt is about this (and the layer has caught up with it). */
    const waitPrompt = async (re) => {
      await ph.until((src) => {
        const p = window.__krel.game.scene.getScene("Home").prompt;
        return p.visible && new RegExp(src).test(p.__krelRaw || p.text) && !!window.__krelMobile.snapshot().bubble;
      }, re.source, 5000, `the prompt ${re}`).catch(() => 0);
      await sleep(150);
    };
    const closePanel = async () => {
      await ph.tapText("✕", { scene: "Home", exact: true }).catch(() => 0);
      await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 8000, "walk again").catch(() => 0);
    };
    await putMe(292, 462);
    await waitPrompt(/trophy/);
    s = await ph.snap();
    const br = s.bubbleRect;
    const inZone = !!br && br.x + br.w <= s.zone.x + s.zone.w && br.y >= s.zone.y;
    check("the trophy shelf's prompt bubble is inside the stick zone, and has no tap element of its own there", inZone && !s.tapAreas.bubble, { bubble: br, zone: s.zone, tapAreas: s.tapAreas });
    a = await ph.me();
    const bx = br.x + br.w / 2;
    const by = br.y + br.h / 2;
    await ph.touch("touchStart", [{ x: bx, y: by, id: 30 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: bx + i * 10, y: by, id: 30 }]);
      await sleep(40);
    }
    await sleep(500);
    await ph.touch("touchEnd", []);
    await sleep(250);
    b = await ph.me();
    check("a drag that starts on the bubble walks (it is the stick), and uses nothing", b[0] - a[0] >= 25 && !(await homeBusy()), { from: a, to: b });
    await putMe(292, 462);
    await waitPrompt(/trophy/);
    s = await ph.snap();
    await ph.tapCss(s.bubbleRect.x + s.bubbleRect.w / 2, s.bubbleRect.y + s.bubbleRect.h / 2);
    await ph.until(() => window.__krel.game.scene.getScene("Home").busy, null, 4000, "the trophy shelf").catch(() => 0);
    check("a quick tap on the bubble (inside the zone) uses the shelf", await homeBusy());
    await closePanel();
    await putMe(292, 462);
    await waitPrompt(/trophy/);
    s = await ph.snap();
    const core = s.target && s.target.core;
    const tx = core ? core.x + core.w / 2 : 0;
    const ty = core ? core.y + core.h / 2 : 0;
    const onBubble = s.bubbleRect && tx >= s.bubbleRect.x && tx <= s.bubbleRect.x + s.bubbleRect.w && ty >= s.bubbleRect.y && ty <= s.bubbleRect.y + s.bubbleRect.h;
    await ph.tapCss(tx, ty);
    await ph.until(() => window.__krel.game.scene.getScene("Home").busy, null, 4000, "the trophy shelf").catch(() => 0);
    check("a quick tap on the shelf itself (not the bubble) uses it (P5)", !!core && !onBubble && (await homeBusy()), { core, bubble: s.bubbleRect });
    await closePanel();
    // the games console, on the right (outside the zone): its own tap area; ACTION see-through over the player (P3)
    await putMe(900, 532);
    await waitPrompt(/console/);
    s = await ph.snap();
    const tr = s.target && s.target.tap;
    const hit = s.slots.prime.hit;
    let cx = tr ? Math.max(tr.x + 8, s.zone.x + s.zone.w + 8) : 0;
    const cy = tr ? Math.min(tr.y + tr.h - 8, Math.max(tr.y + 8, hit.y - 12)) : 0;
    if (tr && cx >= hit.x) cx = tr.x + 8;
    check("the console (right half) has a tap area over it", s.tapAreas.target && !!tr, { target: tr, prime: hit });
    await ph.tapCss(cx, cy);
    await ph.until(() => window.__krel.game.scene.getScene("Home").busy, null, 4000, "the console").catch(() => 0);
    check("a quick tap on the console uses it (P5)", await homeBusy(), { at: [cx, cy] });
    await closePanel();
    await putMe(900, 532);
    await waitPrompt(/console/);
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    await ph.until(() => (window.__krelMobile.snapshot().controls.find((c) => c.id === "action") || {}).see, null, 4000, "see-through").catch(() => 0);
    s = await ph.snap();
    const actCtl = s.controls.find((c) => c.id === "action");
    check("iPhone insets, the player in the corner under ACTION: ACTION goes see-through in place (P3)", s.buttons.action && actCtl.see && actCtl.slot === "prime", actCtl);
    await ph.shot("phone-home-action-see-through");
    await ph.ev(() => window.__krelMobile.setInsets(null));
    // the real path: the browser's safe-area insets (CSS env()) read by the layer's probe, after a resize
    const setSafe = async (l, r, bt) => {
      await ph.cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: l, bottom: bt, right: r } });
      await ph.page.setViewportSize({ width: 843, height: 390 });
      await ph.page.setViewportSize({ width: 844, height: 390 });
      await sleep(700);
    };
    let envInsets = null;
    try {
      await setSafe(47, 47, 21);
      envInsets = (await ph.snap()).viewport.insets;
      await setSafe(0, 0, 0);
    } catch (e) {
      envInsets = { error: String(e.message || e).slice(0, 80) };
    }
    check("the browser's own safe-area insets (env()) reach the layer's layout", !!envInsets && envInsets.left === 47 && envInsets.right === 47 && envInsets.bottom === 21, envInsets);
    await putMe(480, 470);
    await sleep(300);
    check("away from it, ACTION is solid again (and gone with no prompt)", !(await ph.snap()).controls.find((c) => c.id === "action").see);

    // a control held while the window loses and gets back focus works again once that finger lifts (R10)
    await ph.ev(() => {
      window.__n = 0;
      const c = window.__krelMobile.layer.addControl({ id: "smoke", slot: "upLeft", label: "T", onDown: () => window.__n++ });
      c.show(true);
    });
    await sleep(350);
    s = await ph.snap();
    const up = s.slots.upLeft;
    await ph.touch("touchStart", [{ x: up.cx, y: up.cy, id: 41 }]);
    await sleep(120);
    await ph.ev(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await sleep(100);
    await ph.touch("touchEnd", []);
    await sleep(400);
    await ph.tapCss(up.cx, up.cy);
    await sleep(400);
    await ph.tapCss(up.cx, up.cy);
    await sleep(200);
    const presses = await ph.ev(() => window.__n);
    await ph.ev(() => window.__krelMobile.layer.removeControl("smoke"));
    check("a control held through blur / focus: after that finger lifts, the next two taps both press it", presses === 3, { presses });

    // stage 2's hooks: a rule's own field reaches the controllers (R7); controllers are laid out again (R8)
    const ctl = await ph.ev(async () => {
      // (through the game's own module instances, not by URL: the dev server may serve an edited file under a new one)
      const tl = window.__krelMobile.api;
      const modes = window.__krelMobile.api;
      const log = (window.__ctl = { frame: 0, layout: 0, tick: [] });
      window.__tick = 1;
      tl.registerModeController({ id: "smoke", mode: "walk", frame: (c) => (log.frame++, log.tick[log.tick.length - 1] !== c.decision.tick && log.tick.push(c.decision.tick)), layout: () => log.layout++ });
      modes.addSceneRule({ name: "smoke", match: (k) => k === "Home", decide: (st) => (st.busy ? null : { mode: "walk", pause: "edge", pauseButton: true, action: modes.verbFromPrompt(st.prompt), stick: "2d", tick: window.__tick }) });
      await new Promise((r) => setTimeout(r, 400));
      window.__tick = 2;
      await new Promise((r) => setTimeout(r, 400));
      const l0 = log.layout;
      window.__krelMobile.settings.set({ leftHanded: true });
      window.__krelMobile.settings.set({ leftHanded: false });
      const out = { ticks: log.tick.slice(), frames: log.frame, layouts: log.layout - l0 };
      tl.unregisterModeController("smoke");
      modes.SCENE_RULES.splice(modes.SCENE_RULES.findIndex((r) => r.name === "smoke"), 1);
      return out;
    });
    check("a stage 2 rule's own field reaches its controller when only that field changes (R7)", ctl.ticks.join() === "1,2" && ctl.frames > 5, ctl);
    check("controllers are laid out again on a settings change (left-handed) (R8)", ctl.layouts >= 2, ctl);

    // three fingers at once, then the phone cancels them all (a system gesture): nothing stays held
    await ph.touch("touchStart", [{ x: 150, y: 300, id: 51 }]);
    await ph.touch("touchMove", [{ x: 190, y: 300, id: 51 }]);
    await ph.touch("touchStart", [{ x: 190, y: 300, id: 51 }, { x: 250, y: 330, id: 52 }]);
    await ph.touch("touchStart", [{ x: 190, y: 300, id: 51 }, { x: 250, y: 330, id: 52 }, { x: 600, y: 200, id: 53 }]);
    await sleep(200);
    const three = await ph.touchState();
    await ph.touch("touchCancel", []);
    await sleep(200);
    const after3 = await ph.touchState();
    check("three fingers down, then all cancelled: the stick lets go, nothing held", three.mx > 0.5 && after3.mx === 0 && after3.my === 0 && !(await ph.snap()).stick, { three: three.mx, after: after3 });
    // the idle stick fades away once the player has walked with it (P13)
    await sleep(2900);
    check("after walking with it, the idle stick fades away when not in use (no MOVE ring over the room)", !(await ph.snap()).ghost);

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
    // a Back while the pause menu is showing leaves the game (the one way out by Back)
    s = await ph.snap();
    await ph.tapCss(s.slots.pause.cx, s.slots.pause.cy);
    await ph.until(() => window.__krel.active().includes("Menu"), null, 8000, "the pause menu").catch(() => 0);
    await ph.ev(() => history.back());
    await sleep(2500);
    check("Back while the pause menu shows leaves the game", ph.page.url() !== url0, ph.page.url());
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
    check("the art keeps loading behind it (the Enter gate is reached while upright)", await ph.ev(() => window.__krel.active().includes("Enter") && document.querySelector(".krot").classList.contains("show")));
    await sleep(800);
    const l1 = await ph.loop();
    await sleep(800);
    const l2 = await ph.loop();
    check("once loaded, the loop sleeps while upright", !l2.running && l1.frame === l2.frame, { l1, l2 });
    await ph.shot("upright-boot");
    // the guide from the turn-your-phone screen, then the phone turned sideways while reading it: the game stays
    // asleep under the guide until it is closed (R2)
    await ph.tapSel(".krot-extra .kah-rot");
    await sleep(400);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(1200);
    const g1 = await ph.loop();
    await sleep(900);
    const g2 = await ph.loop();
    const gs = await ph.ev(() => ({ guide: window.__krelMobile.guide.isOpen, rot: document.querySelector(".krot").classList.contains("show"), holds: window.__krelMobile.shellState().holds }));
    check("the guide opened upright, then the phone turned sideways: the game stays asleep under it", gs.guide && !gs.rot && !g2.running && g1.frame === g2.frame && gs.holds.includes("guide"), { ...gs, g1, g2 });
    await ph.tapSel(".kah-later");
    await sleep(800);
    const st = await ph.ev(() => ({ shown: document.querySelector(".krot").classList.contains("show"), running: window.__krel.game.loop.running, guide: window.__krelMobile.guide.isOpen }));
    check("closed: the game runs (sideways, no rotate screen)", !st.shown && st.running && !st.guide, st);
    await ph.tapCss(422, 300);
    await ph.scene("Title", 60000);
    check("and the Enter gate takes the tap", (await ph.active()).includes("Title"));
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
    check("defaults: right-handed, M, 30%, auto-fire, normal aim assist, phone assist on, battery saver off, readability ON (stage 2), haptics on", JSON.stringify(st.s) === JSON.stringify({ leftHanded: false, buttonSize: "M", opacity: 0.3, stick: "floating", autoFire: true, aimAssist: "normal", phoneAssist: true, batterySaver: false, readability: true, textSize: "normal", haptics: true, syncOffsetMs: 0, playOverMyMusic: false }), st.s);
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
  console.log("READABILITY (on by default since stage 2; iPhone in Safari with its bars, 750x340)");
  let { ctx, ph, errors } = await openPage(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }, URL0);
  try {
    await ph.page.waitForTimeout(1200);
    await ph.tapCss(375, 260);
    await ph.scene("Title");
    await ph.until(() => window.__krelMobile.guide.isOpen, null, 15000, "the guide").catch(() => 0);
    await ph.ev(() => window.__krelMobile.guide.close());
    await ph.page.waitForTimeout(1500);
    const rs = await ph.readState();
    check("on by default (the setting says on; nothing in the address)", rs.on && rs.patched && (await ph.ev(() => window.__krelMobile.settings.get().readability)), rs);
    let t = (await ph.ev(textSizes)).filter((x) => x.on && !x.tw);
    let min = Math.min(...t.map((x) => x.css));
    check("title: no text under 11 CSS px", min >= 11 - 1e-6, { min: +min.toFixed(2), count: t.length, small: t.filter((x) => x.css < 11).slice(0, 4) });
    check("title: the rendered glyph boxes are at least 11 CSS px too", Math.min(...t.map((x) => x.glyph)) >= 11 - 1e-6, Math.min(...t.map((x) => x.glyph)).toFixed(2));
    check("title: some texts were raised (they were under 11)", t.some((x) => x.req !== null && x.req < parseFloat(x.fs)), t.filter((x) => x.req !== null).length);
    await ph.shot("read-on-title-750x340");
    await ph.tapText("SETTINGS", { scene: "Title" });
    await ph.scene("Menu");
    await ph.page.waitForTimeout(1200);
    t = (await ph.ev(textSizes)).filter((x) => x.on && !x.tw && x.scene === "Menu");
    min = Math.min(...t.map((x) => x.css));
    check("settings menu: no text under 11 CSS px", min >= 11 - 1e-6, { min: +min.toFixed(2), count: t.length });
    await ph.shot("read-on-settings-750x340");
    await ph.tapText("BACK", { scene: "Menu" });
    await ph.until(() => !window.__krel.active().includes("Menu"), null, 5000, "BACK").catch(() => 0);
    // a tap just below a small button's drawing (the title's DEBUG, 19 CSS px tall; inside its 44 CSS px tap area)
    const dbg = await ph.ev(() => {
      const g = window.__krel.game;
      const sc = g.scene.getScene("Title");
      const o = sc.input._list.find((x) => x.parentContainer && x.parentContainer.list.some((c) => c.type === "Text" && /DEBUG/.test(c.text)));
      if (!o) return null;
      const b = o.getBounds();
      const cb = g.scale.canvasBounds;
      const k = cb.width / 960;
      return { x: cb.x + b.centerX * k, bottom: cb.y + b.bottom * k, h: b.height * k };
    });
    const snaps0 = await ph.ev(() => window.__krelMobile.readability.stats.snaps);
    if (dbg) await ph.tapCss(dbg.x, dbg.bottom + Math.min(8, (44 - dbg.h) / 2 - 1));
    await ph.until(() => window.__krel.active().includes("DebugSkip"), null, 5000, "DEBUG").catch(() => 0);
    check("a tap just outside a small button (inside its 44 CSS px tap area) reaches it", !!dbg && (await ph.ev(() => window.__krel.active().includes("DebugSkip"))) && (await ph.ev(() => window.__krelMobile.readability.stats.snaps)) > snaps0, dbg);
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
  // ?mobileread=0: off for this visit (the setting is untouched)
  const u = new URL(URL0);
  u.searchParams.set("mobileread", "0");
  ({ ctx, ph, errors } = await quickPage(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }, u.toString()));
  try {
    const st = await ph.ev(() => ({ on: window.__krelMobile.readability.on, setting: window.__krelMobile.settings.get().readability }));
    check("?mobileread=0 turns it off for the visit (the setting stays on)", !st.on && st.setting, st);
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
      // (the title is built while the tab is in the game's fullscreen, where display-mode: fullscreen matches too)
      const fsAtTitle = await ph.ev(() => ({ fs: !!document.fullscreenElement, dmFull: matchMedia("(display-mode: fullscreen)").matches }));
      await ph.page.waitForTimeout(2500);
      const st = await ph.ev(() => ({ open: window.__krelMobile.guide.isOpen, rot: document.querySelectorAll(".krot-extra .kah-rot").length, fs: !!document.fullscreenElement }));
      const corner = await ph.find("ADD TO HOME SCREEN", { scene: "Title" });
      if (home) check(`${name}: the guide never shows itself, and there is no Add to Home Screen button`, mm && !st.open && st.rot === 0 && !corner, { mm, ...st, corner: !!corner });
      else {
        check(`${name}: still offered (the guide shows itself, the title has the button)`, fsAtTitle.fs && fsAtTitle.dmFull && st.open && st.rot === 1 && !!corner, { fsAtTitle, ...st, corner: !!corner });
        check(`${name}: the guide's written steps leave fullscreen so Chrome's ⋮ menu can be reached (P6)`, !st.fs, st);
      }
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
      const want = [/fps \d/, /textures \d+ · ~[\d.]+ MB/, /sound \d+ decoded · ~[\d.]+ MB · audio/, /window 844x390 · visual 844x390/, /dpr 3/, /canvas 693x390 at 75,0 · scale 0\.722/, /safe area L0 R0 T0 B0/, /touch mode /, /phone mode ON by device: coarse yes · no hover yes · touch \d+ · short side 390/, /iPhone safari/, /readability on/, /last error: /];
      const missing = want.filter((re) => !re.test(d.text)).map(String);
      check("?mobilediag: the read-out shows fps, textures, sound, sizes, canvas scale, safe area, touch mode, why phone mode is on, last error", d.el && missing.length === 0, missing.length ? { missing, text: d.text } : undefined);
      await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
      await sleep(400);
      check("?mobilediag: shows the safe-area insets the layer uses", /safe area L47 R47 T0 B21/.test(await ph.ev(() => document.querySelector(".kdiag").textContent)));
      const pe = await ph.ev(() => ({ box: getComputedStyle(document.querySelector(".kdiag")).pointerEvents, tab: getComputedStyle(document.querySelector(".kdiag-h")).pointerEvents, right: document.querySelector(".kdiag").getBoundingClientRect().left > 422 }));
      check("?mobilediag: it starts on the right below pause, lets touches through to the game, except its MOVE tab (P11)", pe.box === "none" && pe.tab === "auto" && pe.right, pe);
      await ph.tapSel(".kdiag-h");
      await sleep(200);
      check("?mobilediag: a tap on MOVE moves it to another corner", await ph.ev(() => document.querySelector(".kdiag").classList.contains("pos1")));
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
    // (a computer with the browser's device emulation: it has touch points)
    const pc = await quickPage(browser, { ...DESKTOP, hasTouch: true }, dev.toString());
    try {
      const txt = await pc.ph.ev(() => (document.querySelector(".kdiag") ? document.querySelector(".kdiag").textContent : ""));
      check("?mobile=1&mobilediag on a computer with device emulation: the read-out says phone mode is on by the address", /phone mode ON by address/.test(txt), txt.split("\n").find((l) => l.startsWith("phone mode")));
      const stored = await pc.ph.ev(async () => localStorage.getItem((await import("/src/game/variant.ts")).storageKey("krelworld.mobile")));
      check("?mobile=1 is not remembered (this page load only)", stored === null, stored);
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

// ------------------------------------------------------------------ shared: past the gate, into a scene

/** A phone page with the guide already seen (so it doesn't show itself), past the Enter gate, on the title. */
async function phoneAtTitle(browser, profile = IPHONE, url = URL0) {
  const ctx = await browser.newContext(profile);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("krelworld.phone.homeScreenGuide", "seen");
      localStorage.setItem("alt:krelworld.phone.homeScreenGuide", "seen");
    } catch (e) {}
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const ph = new Phone(page, cdp);
  await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
  await page.waitForTimeout(1200);
  const vp = profile.viewport;
  await ph.tapCss(vp.width / 2, vp.height * 0.75);
  await ph.scene("Title", 60000);
  await page.waitForTimeout(1000);
  return { ctx, page, ph, errors };
}

/** Into a walking scene with nothing in the way (no welcome conversation, no intro). */
async function toWalk(ph, key) {
  await ph.ev((key) => {
    const k = window.__krel;
    k.newRun("FLENKY");
    Object.assign(k.G.s.flags, { ch1_intro: true, ch1_home: true, home_seen: true, flyover_seen: true, tv_klerble_welcome: true, prologue_done: true, met_emergency: true, founding_seen: true });
    k.go(key);
  }, key);
  await ph.scene(key);
  // (walking, and still walking a few seconds later: the town opens a conversation shortly after you arrive)
  let calm = 0;
  for (let i = 0; i < 90; i++) {
    if ((await ph.mode().catch(() => "")).startsWith("walk")) {
      if (++calm >= 6) return true;
      await sleep(700);
      continue;
    }
    calm = 0;
    await ph.tapCss(620, 160);
    await ph.ev(() => {
      const g = window.__krel.game;
      for (const k of ["Enter", "Title"]) if (g.scene.isActive(k)) g.scene.stop(k);
      if (!g.scene.isActive("Dialogue") && !g.scene.isActive("Menu")) for (const k of ["Home", "Hub"]) if (g.scene.isPaused(k)) g.scene.resume(k);
      for (const k of ["Home", "Hub"]) {
        const sc = g.scene.getScene(k);
        if (sc && g.scene.isActive(k) && sc.busy) sc.busy = false;
      }
    });
    await sleep(500);
  }
  return false;
}

const setVisibility = (ph, v) =>
  ph.ev((v) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => v === "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, v);

// ------------------------------------------------------------------ conversations (stage 2)

/** The script the conversation checks play over the Hub (or as a cutscene): narration, a long line, a choice, more. */
const TEST_LINES = [
  { s: "NARRATOR", t: "A test line from the narrator.", dir: true, set: { t_dir: true } },
  {
    s: "FLENKY",
    t: "This is a deliberately long line, so that it needs more than one box on a phone at the reading size. It keeps going with another sentence about nothing in particular. And then one more sentence to be sure it spills over into a second page, maybe even a third if the box is small.",
    set: { t_long: true },
  },
  {
    s: "KREZMAR",
    t: "Pick one?",
    choice: [
      { label: "Option one, the first and best", set: { t_one: true }, lines: [{ s: "FLENKY", t: "You picked one.", set: { t_picked: true } }] },
      { label: "Option two", set: { t_two: true } },
      { label: "Option three, a longer choice label that might need to wrap onto a second line on a small phone", set: { t_three: true } },
    ],
  },
  { s: "FLENKY", t: "After the choice.", set: { t_after: true } },
  { s: "FLENKY", t: "Last line.", set: { t_last: true } },
];

/** Play TEST_LINES over the Hub through the game's own runDialogue; window.__dlgDone turns true at the end. */
function startTalk(ph) {
  return ph.ev(async (lines) => {
    const { runDialogue } = await import("/src/game/scenes/DialogueScene.ts");
    for (const k of Object.keys(window.__krel.G.s.flags)) if (k.startsWith("t_")) delete window.__krel.G.s.flags[k];
    window.__dlgDone = false;
    runDialogue(window.__krel.game.scene.getScene("Hub"), lines).then(() => (window.__dlgDone = true));
  }, TEST_LINES);
}

const testFlags = (ph) => ph.ev(() => Object.keys(window.__krel.G.s.flags).filter((k) => k.startsWith("t_")).sort().join(","));
const dlg = (ph) => ph.ev(() => window.__krelMobile.dialogue.snapshot());
const boxNow = (ph) =>
  ph.ev(() => {
    const b = window.__krelMobile.dialogue.current();
    return b ? { full: String(b.fullText), shown: b.bodyText.text, typing: !!b.typing, waiting: !!b.advanceResolve } : null;
  });

/** Every visible text on the scenes now, with its role ("read" for reading text), size in CSS px. */
function textRoles() {
  const g = window.__krel.game;
  const k = g.scale.canvasBounds.width / g.scale.width;
  const out = [];
  for (const sc of g.scene.getScenes(true)) {
    const cam = sc.cameras.main;
    const walk = (o, s, a) => {
      if (!o || o.visible === false || o.active === false) return;
      const al = a * (o.alpha === undefined ? 1 : o.alpha);
      if (o.type === "Container") return o.list.forEach((c) => walk(c, s * Math.abs(o.scaleY), al));
      if (o.type !== "Text" || !o.text.trim() || al < 0.05) return;
      out.push({ scene: sc.sys.settings.key, text: o.text.slice(0, 30), role: o.__mfRole || null, css: parseFloat(o.style.fontSize) * s * Math.abs(o.scaleY) * (cam.zoom || 1) * k });
    };
    sc.sys.displayList.list.forEach((o) => walk(o, 1, 1));
  }
  return out;
}

async function dialogue(browser) {
  console.log("DIALOGUE (conversations on a phone: tap, SKIP, LOG, AUTO, choices, Back; iPhone 14 landscape)");
  let { ctx, page, ph, errors } = await phoneAtTitle(browser);
  try {
    await toWalk(ph, "Hub");
    await startTalk(ph);
    await ph.until(() => window.__krelMobile.dialogue.snapshot().showing, null, 10000, "the conversation");
    await sleep(500);
    let s = await dlg(ph);
    check("a town conversation shows AUTO, LOG and SKIP (no II: a town conversation has no pause menu)", s.pills.auto && s.pills.log && s.pills.skip && !s.pills.pause, s.pills);
    const pr = await ph.ev(() => [...document.querySelectorAll(".kd-pill.show")].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    check("each pill's tap area is at least 44 CSS px, on screen and out of the bottom strip", pr.length >= 3 && pr.every((r) => r.h >= 44 && r.w >= 44 && r.x >= 0 && r.x + r.w <= 844 && r.y >= 0 && r.y + r.h <= 390 - 21), pr);
    let t = (await ph.ev(textRoles)).filter((x) => x.scene === "Dialogue");
    check("the line is reading text at 16 CSS px (no reading text under 15, nothing under 11)", t.some((x) => x.role === "read" && x.css >= 15.9) && t.filter((x) => x.role === "read").every((x) => x.css >= 15) && t.every((x) => x.css >= 11 - 1e-6), t);
    check("the narrator's line is drawn as it is written", (await boxNow(ph)).full === "A test line from the narrator.");
    check("the box's footer has no key names (▼ only)", t.some((x) => x.text === "▼") && !t.some((x) => /Space|Tab skip/.test(x.text)));
    await ph.shot("dialogue-pills");
    // a tap advances; a tap while a line is typing completes it
    await ph.tapCss(420, 180);
    await sleep(60);
    let b = await boxNow(ph);
    const typed = b.typing && b.shown.length < b.full.length;
    await ph.tapCss(420, 180);
    await sleep(80);
    const after = await boxNow(ph);
    check("a tap advances, and a tap while the line is typing completes it (not the next line)", typed && !after.typing && after.shown === after.full && after.full === b.full, { typed, after: { typing: after.typing, n: after.shown.length, of: after.full.length } });
    // the long line in boxes: the words are identical (the box's own pages, as it draws them; its first page is up)
    const pg = await ph.ev((text) => {
      const b = window.__krelMobile.dialogue.current();
      const pages = b.pages({ s: "FLENKY", t: text });
      return { pages, now: String(b.fullText) };
    }, TEST_LINES[1].t);
    const joined = pg.pages.join(" ").replace(/\s*…\s*/g, " ").replace(/\s+/g, " ").trim();
    check("a long line is split into more boxes on a phone, the first drawn as the box says, and the words are identical", pg.pages.length >= 2 && pg.now === pg.pages[0] && after.full === pg.pages[0] && joined === TEST_LINES[1].t, { pages: pg.pages.length, now: pg.now.slice(0, 60), first: pg.pages[0].slice(0, 60), joinedOk: joined === TEST_LINES[1].t });
    await ph.tapCss(420, 180);
    await sleep(100);
    // LOG: the lines already shown, in a native-scroll list
    s = await dlg(ph);
    await ph.tapSel(".kd-log");
    await sleep(400);
    const log = await ph.ev(() => {
      const l = document.querySelector(".kdl-list");
      return { open: window.__krelMobile.dialogue.logOpen, rows: [...document.querySelectorAll(".kdl-row")].map((r) => r.textContent), scroll: getComputedStyle(l).overflowY, touch: getComputedStyle(l).touchAction };
    });
    check("LOG shows the lines already shown in this conversation (whole), in a native-scroll list", log.open && log.rows.some((r) => r.includes("A test line from the narrator.")) && log.rows.some((r) => r.includes(TEST_LINES[1].t)) && log.scroll === "auto" && /pan-y/.test(log.touch), { n: log.rows.length, scroll: log.scroll });
    await ph.shot("dialogue-log");
    // Android Back closes the log, and the conversation is still there
    await ph.ev(() => history.back());
    await sleep(700);
    check("Back closes the LOG (the conversation stays)", !(await ph.ev(() => window.__krelMobile.dialogue.logOpen)) && (await dlg(ph)).showing);
    await ph.ev(() => history.back());
    await sleep(700);
    check("Back in a town conversation does nothing (no skip, no menu)", (await dlg(ph)).showing && !(await ph.active()).includes("Menu"));
    await ph.until(() => window.__krelMobile.dialogue.snapshot().choosing, null, 15000, "the choice").catch(() => 0);
    if (!(await dlg(ph)).choosing) {
      await ph.tapCss(420, 180);
      await ph.until(() => window.__krelMobile.dialogue.snapshot().choosing, null, 8000, "the choice").catch(() => 0);
    }
    // choices: big rows, no key numbers, a deliberate tap
    const rows = await ph.ev(() => {
      const g = window.__krel.game;
      const k = g.scale.canvasBounds.width / 960;
      const b = window.__krelMobile.dialogue.current();
      return b.overlay.list.filter((o) => o.type === "Rectangle" && o.input).map((o) => { const t = b.overlay.list[b.overlay.list.indexOf(o) + 1]; return { h: o.height * k, w: o.width * k, text: t.text }; });
    });
    check("choices: rows at least 48 CSS px tall, nearly full width, no key numbers, the words as written", rows.length === 3 && rows.every((r) => r.h >= 48 - 0.5 && r.w >= 560) && rows[0].text === "Option one, the first and best" && rows[2].text === TEST_LINES[2].choice[2].label, rows);
    t = (await ph.ev(textRoles)).filter((x) => x.scene === "Dialogue" && x.role === "read");
    check("choice text is reading text (16 CSS px)", t.length >= 4 && t.every((x) => x.css >= 15), t.map((x) => +x.css.toFixed(1)));
    await ph.shot("dialogue-choices");
    const o1 = await ph.find("Option one", { scene: "Dialogue" });
    await ph.ev(() => (window.__krelMobile.dialogue.current().__mfChoiceShownAt = performance.now()));
    await ph.tapGame(o1.x, o1.y);
    await sleep(200);
    check("a tap in the first 180 ms after the rows appear is ignored", (await dlg(ph)).choosing && !(await testFlags(ph)).includes("t_one"));
    await sleep(200);
    await ph.tapGame(o1.x, o1.y);
    await sleep(500);
    check("a deliberate tap picks the row (its effects applied)", !(await dlg(ph)).choosing && (await testFlags(ph)).includes("t_one"), await testFlags(ph));
    // AUTO: moves on by itself (to the end of the script here)
    await ph.tapSel(".kd-auto");
    const lit = await ph.ev(() => document.querySelector(".kd-auto").classList.contains("lit"));
    await ph.until(() => window.__dlgDone, null, 30000, "AUTO to the end").catch(() => 0);
    check("AUTO lights up and plays the conversation on by itself to the end", lit && (await ph.ev(() => window.__dlgDone)) && (await testFlags(ph)) === "t_after,t_dir,t_last,t_long,t_one,t_picked", await testFlags(ph));
    await ph.ev(() => (window.__krelMobile.dialogue.auto = false));
    // SKIP: to the next choice (every effect applied, the choice never skipped), then to the end
    await startTalk(ph);
    await ph.until(() => window.__krelMobile.dialogue.snapshot().showing, null, 10000, "the conversation again");
    await sleep(300);
    await ph.tapSel(".kd-skip");
    await ph.until(() => window.__krelMobile.dialogue.snapshot().choosing, null, 8000, "the choice").catch(() => 0);
    s = await dlg(ph);
    check("SKIP runs to the choice (the skipped lines' effects applied) and stops there; SKIP is hidden while choosing", s.choosing && (await testFlags(ph)) === "t_dir,t_long" && !s.pills.skip && s.pills.log, { flags: await testFlags(ph), pills: s.pills });
    // (row two, by its own place: the rows share one container, so a search by text would find row one)
    const o2 = await ph.ev(() => {
      const b = window.__krelMobile.dialogue.current();
      const r = b.overlay.list.filter((o) => o.type === "Rectangle" && o.input)[1].getBounds();
      return { x: r.centerX, y: r.centerY };
    });
    await sleep(250);
    await ph.tapGame(o2.x, o2.y);
    await sleep(400);
    await ph.tapSel(".kd-skip");
    await ph.until(() => window.__dlgDone, null, 8000, "SKIP to the end").catch(() => 0);
    check("SKIP after the choice runs to the end of the conversation, every line's effects applied", (await ph.ev(() => window.__dlgDone)) && (await testFlags(ph)) === "t_after,t_dir,t_last,t_long,t_two", await testFlags(ph));
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "walk", null, 10000, "walk mode").catch(() => 0);
    check("back to walking after the conversation (pills gone)", (await ph.mode()).startsWith("walk") && !(await dlg(ph)).showing);
    // a cutscene (it has a pause menu): II, and Back opens the pause menu (the laptop's Esc)
    await ph.ev((lines) => window.__krel.go("Cutscene", { bg: "townhall", lines, next: { scene: "Hub" } }), TEST_LINES);
    await ph.until(() => window.__krelMobile.dialogue.snapshot().showing, null, 20000, "the cutscene");
    await sleep(400);
    s = await dlg(ph);
    check("a cutscene shows II as well (its pause menu)", s.pills.pause && s.scene === "Cutscene", s.pills);
    await ph.tapSel(".kd-pause");
    await sleep(800);
    check("II opens the pause menu over the cutscene", (await ph.active()).includes("Menu") && !(await dlg(ph)).showing);
    await ph.tapText("RESUME", { scene: "Menu" });
    await sleep(800);
    check("RESUME: the cutscene carries on, pills back", !(await ph.active()).includes("Menu") && (await dlg(ph)).showing);
    const line0 = (await boxNow(ph)).full;
    await ph.ev(() => history.back());
    await sleep(900);
    const line1 = await ph.ev(() => String(window.__krelMobile.dialogue.current().fullText));
    check("Back in a cutscene opens its pause menu (the laptop's Esc), never skips", (await ph.active()).includes("Menu") && line1 === line0, { menu: (await ph.active()).includes("Menu"), line0: line0.slice(0, 30), line1: line1.slice(0, 30), guard: await ph.ev(() => window.__krelMobile.shellState().guard) });
    await ph.tapText("RESUME", { scene: "Menu" });
    await sleep(500);
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
  // Safari with its bars (750x340): four choices take the screen, the question above them
  ({ ctx, page, ph, errors } = await phoneAtTitle(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }));
  try {
    await ph.ev(() => {
      window.__krel.newRun("FLENKY");
      window.__krel.go("Cutscene", { bg: "townhall", next: { scene: "Hub" }, lines: [{ s: "PROCTUS", t: "Right. Next item on the agenda.", choice: [{ label: "Next item" }, { label: "Leave" }, { label: "Ask about the list" }, { label: "Say nothing at all and wait" }] }, { s: "PROCTUS", t: "Done." }] });
    });
    await ph.until(() => window.__krelMobile.dialogue.snapshot().choosing, null, 20000, "four choices");
    await sleep(400);
    const lay = await ph.ev(() => {
      const g = window.__krel.game;
      const cb = g.scale.canvasBounds;
      const k = cb.width / 960;
      const b = window.__krelMobile.dialogue.current();
      const rows = b.overlay.list.filter((o) => o.type === "Rectangle" && o.input).map((o) => { const r = o.getBounds(); return { top: r.top * k, bottom: r.bottom * k, h: r.height * k }; });
      const q = b.bodyText.getBounds();
      return { rows, q: { visible: b.bodyText.visible, bottom: q.bottom * k, text: b.bodyText.text }, frame: b.frame ? b.frame.visible : null };
    });
    const ok = lay.rows.length === 4 && lay.rows.every((r, i) => r.h >= 47.5 && r.bottom <= 340 && (i === 0 || r.top >= lay.rows[i - 1].bottom + 7));
    check("750x340: four choice rows fit on the screen (48 CSS px, 8+ apart), the box steps aside", ok && lay.frame === false, lay.rows);
    check("750x340: the question stays above them, readable", lay.q.visible && lay.q.text === "Right. Next item on the agenda." && lay.q.bottom <= lay.rows[0].top, lay.q);
    const t = (await ph.ev(textRoles)).filter((x) => x.scene === "Cutscene");
    check("750x340: no reading text under 15 CSS px, no text under 11", t.filter((x) => x.role === "read").every((x) => x.css >= 15) && t.every((x) => x.css >= 11 - 1e-6), t.filter((x) => x.css < 15).slice(0, 4));
    await ph.shot("dialogue-choices-750x340");
    check("no page errors (750x340)", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the Phone settings page and the menus (stage 2)

/** Every tappable canvas object in a scene: its box in CSS px. */
function tapBoxes(scene) {
  const g = window.__krel.game;
  const sc = g.scene.getScene(scene);
  const k = g.scale.canvasBounds.width / 960;
  return sc.input._list
    .filter((o) => o.input && o.input.enabled && o.visible && (!o.parentContainer || o.parentContainer.visible))
    .map((o) => {
      const b = o.getBounds();
      const p = o.parentContainer;
      const t = p ? p.list.find((c) => c.type === "Text") : null;
      return { label: t ? t.text.slice(0, 24) : o.type, x: b.x * k, y: b.y * k, w: b.width * k, h: b.height * k };
    })
    .filter((b) => b.w < 900 * k);
}

async function settings2(browser) {
  console.log("SETTINGS2 (the Phone settings page; menus at 44 CSS px; text sizes)");
  let { ctx, page, ph, errors } = await phoneAtTitle(browser);
  try {
    // the title: every menu target 44 CSS px; ADD TO HOME SCREEN too (P14)
    let boxes = (await ph.ev(tapBoxes, "Title")).filter((b) => !/DEBUG/.test(b.label));
    check("title: every menu button and ADD TO HOME SCREEN at least 44 CSS px tall", boxes.length >= 4 && boxes.every((b) => b.h >= 44 - 0.5), boxes.map((b) => `${b.label}:${b.h.toFixed(0)}`));
    let t = await ph.ev(textRoles);
    check("title: no text under 11 CSS px", t.filter((x) => x.scene === "Title").every((x) => x.css >= 11 - 1e-6), t.filter((x) => x.css < 11).slice(0, 3));
    await ph.tapText("SETTINGS", { scene: "Title" });
    await ph.scene("Menu");
    await sleep(800);
    boxes = await ph.ev(tapBoxes, "Menu");
    check("settings (from the title): three tabs with 📱 PHONE, every target at least 44 CSS px", boxes.some((b) => /PHONE/.test(b.label)) && boxes.every((b) => b.h >= 44 - 0.5 && b.w >= 44 - 0.5), boxes.filter((b) => b.h < 44).map((b) => b.label));
    t = (await ph.ev(textRoles)).filter((x) => x.scene === "Menu");
    check("settings: no text under 11 CSS px", t.every((x) => x.css >= 11 - 1e-6), t.filter((x) => x.css < 11).slice(0, 3));
    await ph.shot("settings2-settings");
    await ph.tapText("📱 PHONE", { scene: "Menu" });
    await sleep(500);
    const pg = await ph.ev(() => {
      const p = window.__krelMobile.settingsPage;
      const rows = [...document.querySelectorAll(".kps-row")];
      const lefts = [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().x)))];
      const btns = [...document.querySelectorAll(".kps button")].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height);
      return { open: p.isOpen, n: rows.length, keys: p.rows().map((r) => r.key), lefts, minRow: Math.min(...rows.map((r) => r.getBoundingClientRect().height)), minBtn: Math.min(...btns), pad: (document.querySelector(".kps-pad") || {}).textContent || "", helps: [...document.querySelectorAll(".kps-h")].length };
    });
    check("the 📱 PHONE tab opens the Phone settings page: every setting, Phone layout, two columns, 48 px rows, a help line each", pg.open && pg.n === 14 && pg.keys.includes("phoneLayout") && pg.lefts.length === 2 && pg.minRow >= 47.5 && pg.helps === 14, pg);
    check("its buttons are at least 44 CSS px; it says a Bluetooth controller works", pg.minBtn >= 44 - 0.5 && /Bluetooth controller works/.test(pg.pad), { minBtn: pg.minBtn, pad: pg.pad });
    await ph.shot("settings2-phone-page");
    // every row works
    const get = () => ph.ev(() => window.__krelMobile.settings.get());
    const into = (sel) => ph.ev((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), sel);
    const tapIn = async (key, sel) => {
      await into(`.kps-row[data-key="${key}"] ${sel}`);
      await sleep(60);
      await ph.tapSel(`.kps-row[data-key="${key}"] ${sel}`);
    };
    const s0 = await get();
    const fails = [];
    for (const key of ["leftHanded", "haptics", "autoFire", "phoneAssist", "readability", "batterySaver", "playOverMyMusic"]) {
      const before = (await get())[key];
      await into(`.kps-row[data-key="${key}"]`);
      await sleep(60);
      await ph.tapSel(`.kps-row[data-key="${key}"]`);
      await sleep(150);
      const mid = (await get())[key];
      await ph.tapSel(`.kps-row[data-key="${key}"]`);
      await sleep(150);
      if (mid === before || (await get())[key] !== before) fails.push(key);
    }
    for (const [key, vals] of [["buttonSize", ["S", "L", "M"]], ["stick", ["fixed", "floating"]], ["aimAssist", ["strong", "off", "normal"]], ["textSize", ["large", "normal"]]]) {
      for (const v of vals) {
        await tapIn(key, `[data-v="${v}"]`);
        await sleep(150);
        if ((await get())[key] !== v) fails.push(`${key}=${v}`);
      }
    }
    for (const [key, d, want] of [["opacity", "1", 0.4], ["opacity", "-1", 0.3], ["syncOffsetMs", "1", 5], ["syncOffsetMs", "-1", 0]]) {
      await tapIn(key, `[data-d="${d}"]`);
      await sleep(150);
      if (Math.abs((await get())[key] - want) > 1e-6) fails.push(`${key}${d}`);
    }
    const mk = await ph.ev(async () => (await import("/src/game/variant.ts")).storageKey("krelworld.mobile"));
    await tapIn("phoneLayout", '[data-layout="off"]');
    await sleep(150);
    const off = await ph.ev((k) => ({ v: localStorage.getItem(k), note: !!document.querySelector(".kps-reload") }), mk);
    await tapIn("phoneLayout", '[data-layout="auto"]');
    await sleep(150);
    const auto = await ph.ev((k) => localStorage.getItem(k), mk);
    if (off.v !== "0" || !off.note || auto !== null) fails.push(`phoneLayout ${JSON.stringify({ off, auto })}`);
    check("every row works by tap (toggles both ways, every choice, sliders up and down, Phone layout off then auto)", fails.length === 0, fails);
    check("and the settings end where they started", JSON.stringify(await get()) === JSON.stringify(s0));
    // Bigger text off: the menu behind is drawn again at the game's own sizes; on again
    await into('.kps-row[data-key="readability"]');
    await ph.tapSel('.kps-row[data-key="readability"]');
    await sleep(500);
    const offState = await ph.ev(() => ({ on: window.__krelMobile.readability.on, menu: window.__krel.active().includes("Menu") }));
    await ph.tapSel('.kps-row[data-key="readability"]');
    await sleep(500);
    check("Bigger text off and on again, live (the settings menu behind stays up)", !offState.on && offState.menu && (await ph.ev(() => window.__krelMobile.readability.on)), offState);
    await ph.ev(() => history.back());
    await sleep(600);
    check("Back closes the Phone settings page (the settings menu stays)", !(await ph.ev(() => window.__krelMobile.settingsPage.isOpen)) && (await ph.active()).includes("Menu"));
    await ph.tapText("BACK", { scene: "Menu" });
    await sleep(600);
    // the pause menu: two or three columns, 44 px rows, the objective clear of RESUME, a 📱 PHONE SETTINGS row
    await ph.ev(() => window.__krel.game.scene.isActive("Menu") && window.__krel.game.scene.stop("Menu"));
    await toWalk(ph, "Hub");
    await ph.ev(() => window.__krelMobile.layer.pause());
    await ph.scene("Menu");
    await sleep(800);
    boxes = await ph.ev(tapBoxes, "Menu");
    const obj = await ph.ev(() => {
      const m = window.__krel.game.scene.getScene("Menu");
      const k = window.__krel.game.scale.canvasBounds.width / 960;
      const o = m.root.list.find((x) => x.type === "Text" && /^Objective:/.test(x.text));
      return o ? o.getBounds().bottom * k : null;
    });
    const top = Math.min(...boxes.map((b) => b.y));
    check("pause menu: every row at least 44 CSS px, the objective line clear of RESUME, 📱 PHONE SETTINGS there", boxes.every((b) => b.h >= 44 - 0.5) && (obj === null || obj <= top + 0.5) && boxes.some((b) => /PHONE SETTINGS/.test(b.label)), { obj, top, rows: boxes.map((b) => `${b.label}:${b.h.toFixed(0)}`) });
    t = (await ph.ev(textRoles)).filter((x) => x.scene === "Menu");
    check("pause menu: no text under 11 CSS px", t.every((x) => x.css >= 11 - 1e-6), t.filter((x) => x.css < 11).slice(0, 3));
    await ph.shot("settings2-pause");
    await ph.tapText("PHONE SETTINGS", { scene: "Menu" });
    await sleep(500);
    check("the pause menu's 📱 PHONE SETTINGS row opens the page", await ph.ev(() => window.__krelMobile.settingsPage.isOpen));
    await ph.tapSel(".kps-done");
    await sleep(400);
    check("DONE closes it, back to the pause menu", !(await ph.ev(() => window.__krelMobile.settingsPage.isOpen)) && (await ph.active()).includes("Menu"));
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
  // Safari with its bars (750x340): character select's details never overlap; nothing under 11
  ({ ctx, page, ph, errors } = await phoneAtTitle(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }));
  try {
    await ph.tapText("NEW GAME", { scene: "Title" });
    await ph.scene("CharSelect");
    await sleep(1500);
    const over = [];
    for (let i = 0; i < 9; i++) {
      const r = await ph.ev((i) => {
        const cs = window.__krel.game.scene.getScene("CharSelect");
        cs.select(i);
        const ts = cs.detail.list.filter((o) => o.type === "Text" && o.visible && o.text.trim()).map((o) => ({ text: o.text.slice(0, 20), b: o.getBounds() }));
        const bad = [];
        for (let a = 0; a < ts.length; a++) for (let c = a + 1; c < ts.length; c++) {
          const A = ts[a].b, B = ts[c].b;
          if (A.x < B.right - 1 && B.x < A.right - 1 && A.y < B.bottom - 1 && B.y < A.bottom - 1) bad.push(`${ts[a].text} / ${ts[c].text}`);
        }
        const panel = cs.detail.list[0].getBounds();
        const low = ts.filter((x) => x.b.bottom > panel.bottom + 1).map((x) => x.text);
        return { bad, low };
      }, i);
      if (r.bad.length || r.low.length) over.push({ i, ...r });
    }
    check("character select at 750x340: no two texts in the details overlap, all inside the panel (all nine)", over.length === 0, over.slice(0, 3));
    const t = (await ph.ev(textRoles)).filter((x) => x.scene === "CharSelect");
    check("character select: no text under 11 CSS px", t.every((x) => x.css >= 11 - 1e-6), t.filter((x) => x.css < 11).slice(0, 3));
    const boxes = await ph.ev(tapBoxes, "CharSelect");
    check("character select: ◀ BACK and PLAY AS at least 44 CSS px", boxes.filter((b) => /BACK|PLAY AS/.test(b.label)).length === 2 && boxes.filter((b) => /BACK|PLAY AS/.test(b.label)).every((b) => b.h >= 44 - 0.5), boxes.filter((b) => /BACK|PLAY/.test(b.label)));
    await ph.shot("settings2-charselect-750x340");
    check("no page errors (750x340)", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ town (the Hub)

async function town(browser) {
  console.log("TOWN (the Hub on a phone)");
  const { ctx, ph, errors } = await phoneAtTitle(browser);
  try {
    check("the Hub reaches walk mode", await toWalk(ph, "Hub"), await ph.mode());
    await sleep(2500);
    // the first how-to-play toasts are control hints: touch wording (P4)
    const toast = await ph.ev(() => {
      const d = { title: "KRELFORD", text: "WASD to walk. E to talk/interact. Follow the yellow arrow. Esc for menu (quests, upgrades, save)." };
      window.__krel.G.emit("toast", d);
      return d.text;
    });
    await sleep(400);
    const drawn = await ph.ev(() => {
      const t = [];
      const walk = (o) => (o.type === "Container" ? o.list.forEach(walk) : o.type === "Text" && t.push(o.text));
      window.__krel.game.scene.getScene("UI").children.list.forEach(walk);
      return t.filter((x) => /walk/.test(x));
    });
    check("the town's first toast speaks touch: no WASD, no E, no Esc (drawn that way too)", toast === "Drag on the left to walk. Tap to talk/interact. Follow the yellow arrow. II for the menu (quests, upgrades, save)." && drawn.some((x) => /Drag on the left/.test(x)) && !drawn.some((x) => /WASD/.test(x)), { toast, drawn });
    // Mikey following: at a door, ACTION is the door's word, not SHOVE (P2)
    const p2 = await ph.ev(async () => {
      const h = window.__krel.game.scene.getScene("Hub");
      const m = h.npcs.find((n) => n.follower);
      if (!m) return { follower: false };
      const tp = (o, x, y) => (o.body && o.body.reset ? o.body.reset(x, y) : ((o.x = x), (o.y = y)));
      const place = (x, y) => {
        tp(h.av, x, y);
        tp(m.spr, x + 4, y + 4);
      };
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const read = () => ({ raw: h.prompt.__krelRaw ?? h.prompt.text, shown: h.prompt.visible, action: window.__krelMobile.snapshot().decision.action });
      const out = { follower: true };
      for (let i = 0; i < 8; i++) {
        place(560, 952);
        await wait(120);
      }
      out.door = read();
      // somewhere with nothing else in range: Mikey is all there is
      let spot = null;
      for (let x = 300; x < 2600 && !spot; x += 37)
        for (let y = 500; y < 1400 && !spot; y += 41) {
          const near = h.interactables.some((it) => !(it.__npc && it.__npc.follower) && (!it.enabled || it.enabled()) && Math.hypot(it.x - x, it.y - y) < it.r + 40);
          if (!near) spot = [x, y];
        }
      out.spot = spot;
      if (spot) {
        for (let i = 0; i < 8; i++) {
          place(spot[0], spot[1]);
          await wait(120);
        }
        out.alone = read();
      }
      return out;
    });
    check("Mikey following, at the Krezz Arms door: ACTION says ENTER, not SHOVE (P2)", p2.follower && p2.door.action === "ENTER" && /Enter/.test(p2.door.raw), p2);
    check("with nothing else near, ACTION can still shove him", p2.follower && !!p2.alone && p2.alone.action === "SHOVE", p2.alone);
    // the shoving match on the bridge: no prompt, ACTION says SHOVE, and it shoves (R6)
    await ph.ev(() => {
      const h = window.__krel.game.scene.getScene("Hub");
      h.tryChatter = () => {};
      const kr = h.add.sprite(h.av.x + 30, h.av.y, h.av.texture.key, 0);
      h.brawl = { spot: { x: h.av.x, y: h.av.y }, ks: [kr], krew: [], running: true, shoves: 0, nextShove: 0, start() {} };
      h.busy = false;
    });
    await ph.until(() => window.__krelMobile.snapshot().buttons.action, null, 5000, "ACTION in the brawl").catch(() => 0);
    let s = await ph.snap();
    check("the shoving match: ACTION shows SHOVE", s.buttons.action && s.actionLabel === "SHOVE", { action: s.buttons.action, label: s.actionLabel, d: s.decision.action });
    await sleep(250);
    await ph.tapCss(s.slots.prime.cx, s.slots.prime.cy);
    await sleep(700);
    const shoves = await ph.ev(() => window.__krel.game.scene.getScene("Hub").brawl.shoves);
    check("and pressing it shoves", shoves > 0, { shoves });
    await ph.ev(() => {
      const h = window.__krel.game.scene.getScene("Hub");
      h.brawl = null;
    });
    await ph.shot("town-hub");
    check("town: no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ a fight (the dungeon, still on the old pad)

async function dungeon(browser) {
  console.log("DUNGEON (Wildern room 1, the old canvas pad)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  try {
    await ph.ev(() => {
      const k = window.__krel;
      k.newRun("FLENKY");
      k.setChapter(1, { ch1_home: true, home_seen: true, flyover_seen: true, tut_dungeon: true });
      k.go("Dungeon", { dungeon: "wildern", room: 0 });
    });
    await ph.scene("Dungeon");
    // (in the fight, and still in it a few seconds later: a room can open a conversation shortly after it starts)
    let calm = 0;
    for (let i = 0; i < 80 && calm < 6; i++) {
      const m = await ph.mode();
      const act = await ph.active();
      if (m.startsWith("combat") && !act.includes("Dialogue") && !act.includes("Tutorial")) {
        calm++;
        await sleep(600);
        continue;
      }
      calm = 0;
      await ph.tapCss(600, 160);
      await sleep(700);
    }
    const inFight = await ph.mode();
    check("in the fight: combat mode on the old pad", inFight === "combat:Dungeon" && (await ph.ev(() => !!window.__krel.game.scene.getScene("UI").touch)), inFight);
    const paused = () => ph.ev(() => ({ menu: window.__krel.active().includes("Menu"), dungeon: window.__krel.game.scene.isPaused("Dungeon"), hp: window.__krel.G.s.hp, running: window.__krel.game.loop.running }));
    const resume = async () => {
      await ph.tapText("RESUME", { scene: "Menu", exact: true }).catch(() => 0);
      await ph.until(() => !window.__krel.active().includes("Menu"), null, 8000, "resume").catch(() => 0);
      await sleep(300);
    };
    // thumbs on the old stick and ATTACK when the page hides (no touchcancel): both let go (R9)
    const [sx, sy] = await ph.g2c(150, 400);
    const [ax, ay] = await ph.g2c(860, 440);
    await ph.touch("touchStart", [{ x: sx, y: sy, id: 1 }]);
    for (let i = 1; i <= 5; i++) {
      await ph.touch("touchMove", [{ x: sx + i * 10, y: sy, id: 1 }]);
      await sleep(30);
    }
    await ph.touch("touchStart", [{ x: sx + 50, y: sy, id: 1 }, { x: ax, y: ay, id: 2 }]);
    await sleep(300);
    const held = await ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { mx: T.mx, attack: T.attack };
    });
    await setVisibility(ph, "hidden");
    await sleep(500);
    const let1 = await ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { mx: T.mx, my: T.my, attack: T.attack, held: [...T.held] };
    });
    check("hidden mid-fight with thumbs on the old stick and ATTACK: both let go (R9)", held.mx > 0.5 && held.attack && let1.mx === 0 && let1.my === 0 && !let1.attack && let1.held.length === 0, { held, let1 });
    const hp0 = await ph.ev(() => window.__krel.G.s.hp);
    await setVisibility(ph, "visible");
    await sleep(900);
    let st = await paused();
    await sleep(2000);
    const st2 = await paused();
    check("back to the page mid-fight: the pause menu, not the fight; no health lost (P1)", st.menu && st.dungeon && st2.hp === hp0, { st, hp0, hpLater: st2.hp });
    await ph.shot("dungeon-back-paused");
    await ph.touch("touchEnd", []);
    await resume();
    // upright and back
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(1200);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(1400);
    st = await paused();
    check("turned upright and back mid-fight: the pause menu (P1)", st.menu && st.dungeon, st);
    await resume();
    // the guide from the turn-your-phone screen, then sideways while it is up: asleep until it closes, then paused (R2)
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(1200);
    await ph.tapSel(".krot-extra .kah-rot");
    await sleep(400);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(1500);
    const f1 = await ph.loop();
    const hpG = await ph.ev(() => window.__krel.G.s.hp);
    await sleep(1500);
    const f2 = await ph.loop();
    const g = await ph.ev(() => ({ guide: window.__krelMobile.guide.isOpen, hp: window.__krel.G.s.hp }));
    check("the guide from the rotate screen, then sideways: the fight sleeps under it (R2)", g.guide && !f2.running && f1.frame === f2.frame && g.hp === hpG, { f1, f2, ...g });
    await ph.tapSel(".kah-later");
    await sleep(1000);
    st = await paused();
    check("closing the guide: the pause menu, not the fight", st.menu && st.dungeon && !(await ph.guide()).open, st);
    await resume();
    // a fight with no pause menu (the finale, the minigames): "tap to carry on", the loop asleep behind it
    await ph.ev(() => {
      const L = window.__krelMobile.layer;
      L.apply({ ...L.decision, mode: "brawl", live: true, pause: null });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(400);
    await setVisibility(ph, "visible");
    await sleep(700);
    const c1 = await ph.loop();
    await sleep(800);
    const c2 = await ph.loop();
    const card = await ph.ev(() => ({ card: window.__krelMobile.shellState().card, shown: getComputedStyle(document.querySelector(".kres")).display !== "none" }));
    check("no pause menu to open: \"tap to carry on\", the game asleep behind it", card.card && card.shown && !c2.running && c1.frame === c2.frame, { ...card, c1, c2 });
    await ph.shot("dungeon-carry-on");
    await ph.tapCss(422, 200);
    await sleep(800);
    const c3 = await ph.loop();
    check("a tap carries on", c3.running && !(await ph.ev(() => window.__krelMobile.shellState().card)), c3);
    check("dungeon: no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ Android: fullscreen, the gate, notices, in-app

async function android(browser) {
  console.log("ANDROID (Chrome 740x360)");
  const AND = { ...ANDROID, userAgent: UA.androidChrome };
  {
    const ctx = await browser.newContext(AND);
    // (the guide would show itself on the title and leave fullscreen for its steps: opened by hand below instead)
    await ctx.addInitScript(() => {
      localStorage.setItem("krelworld.phone.homeScreenGuide", "seen");
      localStorage.setItem("alt:krelworld.phone.homeScreenGuide", "seen");
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const ph = new Phone(page, await ctx.newCDPSession(page));
    try {
      await page.goto(URL0, { waitUntil: "domcontentloaded" });
      await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
      await page.waitForTimeout(1200);
      const h0 = await ph.ev(() => history.length);
      // a press held well past the gate's 650 ms fade (R4)
      await ph.touch("touchStart", [{ x: 370, y: 270, id: 1 }]);
      await sleep(1300);
      const onTitle = (await ph.active()).includes("Title");
      await ph.touch("touchEnd", []);
      await sleep(800);
      const r = await ph.ev(() => ({ fs: document.fullscreenElement ? document.fullscreenElement.id : null, hist: history.length, shell: window.__krelMobile.shellState() }));
      check("a press held past the Enter gate's fade still gets fullscreen and the back guard (R4)", onTitle && r.fs === "game" && r.hist === h0 + 1 && r.shell.gate && r.shell.guard, { onTitle, h0, ...r });
      // the crash guard's notices show in fullscreen (moved into #game) (R12)
      await ph.ev(async () => (await import("/src/game/crashGuard.ts")).notice("smoke notice", 4000));
      await sleep(200);
      const where = await ph.ev(() => {
        const n = [...document.querySelectorAll("div")].find((d) => d.textContent === "smoke notice");
        return n ? (n.parentElement && n.parentElement.id) || n.parentElement.tagName : null;
      });
      check("a crash-guard notice in fullscreen is shown inside the fullscreen element (R12)", where === "game", where);
      // the guide: no install prompt here, so written steps through the browser's ⋮ menu: it leaves fullscreen (P6)
      await ph.ev(() => window.__krelMobile.guide.open("title"));
      await sleep(600);
      const g = await ph.ev(() => ({ open: window.__krelMobile.guide.isOpen, variant: window.__krelMobile.guide.last.variant, primary: window.__krelMobile.guide.last.primary, fs: !!document.fullscreenElement }));
      check("the guide's written steps (Chrome's ⋮ menu): fullscreen is left so the menu can be reached (P6)", g.open && g.variant === "android-chrome" && g.primary === "ok" && !g.fs, g);
      await ph.shot("android-guide-left-fullscreen");
      await ph.tapSel(".kah-later");
      await sleep(800);
      const back = await ph.ev(() => ({ fs: document.fullscreenElement ? document.fullscreenElement.id : null, open: window.__krelMobile.guide.isOpen }));
      check("closing it with a tap goes back into fullscreen", !back.open && back.fs === "game", back);
      check("android: no page errors", errors.length === 0, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
  // an app's own browser (Messenger): "open it in Safari first" during the load, upright and sideways (P7)
  {
    const ctx = await browser.newContext({ ...IPHONE, viewport: { width: 390, height: 844 }, userAgent: UA.iosMessenger });
    const page = await ctx.newPage();
    const ph = new Phone(page, await ctx.newCDPSession(page));
    try {
      await page.goto(URL0, { waitUntil: "domcontentloaded" });
      await ph.until(() => !!window.__krelMobile && window.__krelMobile.guide.isOpen, null, 120000, "the in-app card").catch(() => 0);
      const r = await ph.ev(() => ({ open: !!window.__krelMobile && window.__krelMobile.guide.isOpen, variant: window.__krelMobile && window.__krelMobile.guide.last ? window.__krelMobile.guide.last.variant : null, loading: !window.__krel || !window.__krel.active().includes("Enter"), later: (document.querySelector(".kah-later") || {}).textContent }));
      check("Messenger's browser: the 'open it in Safari first' card is up while the game is still loading (P7)", r.open && r.variant === "in-app" && r.loading, r);
      check("and its dismiss button says PLAY HERE ANYWAY", r.later === "PLAY HERE ANYWAY", r.later);
      await ph.shot("inapp-card-during-load");
    } finally {
      await ctx.close();
    }
  }
}

// ------------------------------------------------------------------ the laptop

/** Records, from the page's first script on, what the phone code reads on a laptop (storage, media queries). */
function laptopSpy() {
  const log = (window.__phoneReads = { getItem: [], matchMedia: [] });
  const fromPhone = () => /\/src\/game\/mobile\//.test(new Error().stack || "");
  const gi = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    if (fromPhone()) log.getItem.push(k);
    return gi.call(this, k);
  };
  const mm = window.matchMedia.bind(window);
  window.matchMedia = function (q) {
    if (fromPhone()) log.matchMedia.push(q);
    return mm(q);
  };
}

async function desktop(browser) {
  console.log("DESKTOP (1280x720, mouse)");
  // the laptop the safety net doesn't cover: one that opened an old ?mobile=1 link (an earlier build stored "1"),
  // and one opening ?mobile=1 now (L2)
  for (const [name, init, search] of [
    ["a laptop with \"1\" left in storage by an old ?mobile=1 link", () => localStorage.setItem("krelworld.mobile", "1"), ""],
    ["a laptop opening ?mobile=1 (a shared test link)", null, "?mobile=1&mobilediag"],
  ]) {
    const ctx = await browser.newContext(DESKTOP);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    await page.goto(URL0 + search, { waitUntil: "domcontentloaded" });
    const ph = new Phone(page, null);
    try {
      await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
      const st = await ph.ev(() => ({ cls: document.documentElement.className, layer: !!document.querySelector(".kt"), api: "__krelMobile" in window, diag: !!document.querySelector(".kdiag") }));
      check(`${name}: the laptop game (no phone class, layer, read-out or global)`, !/\bmobile\b/.test(st.cls) && !st.layer && !st.api && !st.diag, st);
    } finally {
      await ctx.close();
    }
  }
  const ctx0 = await browser.newContext(DESKTOP);
  await ctx0.addInitScript(laptopSpy);
  const ctx = ctx0;
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const fetched = [];
  page.on("request", (r) => {
    const m = /\/src\/game\/mobile\/([^?]+)/.exec(r.url());
    if (m) fetched.push(m[1]);
  });
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  const ph = new Phone(page, await ctx.newCDPSession(page));
  await ph.until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
  try {
    const reads = await ph.ev(() => window.__phoneReads);
    check("desktop: the phone code reads no storage and asks no media query on a laptop (L3)", reads.getItem.length === 0 && reads.matchMedia.length === 0, reads);
    check("desktop: only the phone flag and its tiny loader are fetched, never the phone chunk (L4)", fetched.every((f) => f === "flag.ts" || f === "boot.ts") && fetched.length > 0, fetched);
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
    check("desktop: still nothing fetched from the phone chunk after a game was started", fetched.every((f) => f === "flag.ts" || f === "boot.ts"), fetched);
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
      ["dialogue", dialogue],
      ["settings2", settings2],
      ["guide", guide],
      ["optout", optout],
      ["town", town],
      ["dungeon", dungeon],
      ["android", android],
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
