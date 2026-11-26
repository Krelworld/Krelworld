#!/usr/bin/env node
// PHONE MODE smoke test (Playwright, real touch events). Needs a running dev server.
//
//   npx vite --port 5202 --strictPort &
//   node scripts/mobile-smoke.cjs --url http://localhost:5202/ [--shots <dir>] [--only phone,upright,settings,read,dialogue,settings2,lists,wording,guide,optout,town,dungeon,combat,side,brawl,together,review1,polish,android,desktop]
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
// lists    (stage 2, part 2) character select (a tap picks, PLAY AS starts; the preselected face never starts on a
//          tap); the TV guide (every show, native scroll by a finger drag that presses nothing, 52 px rows, 44 px tabs
//          and ▼, the selected show in view, a tab, a tap plays); the gun rack (pick, ▲ ▼, drag the ⋮⋮ handle,
//          MAKE IT #1, ammo by the box with − / + buys exactly that many and saves the right money, Back closes); the
//          jukebox; the Kreddle Exchange (a tap picks and never buys, BUY buys, ammo with −); QUESTS and the DIALOGUE
//          LOG; the loaner rack (drag, pick, BORROW, PERKS, DONE); the archive; chapter select (a tap picks, START
//          goes); 750x340: the rack fits above the home-indicator strip.
// wording  (stage 2, part 2) walks the title, settings, character select (all nine), Difficulty, Banter, chapter
//          select, Home and its panels, the pause menu and its pages, the save slots, the Exchange's tabs, the telly
//          and its guide, the archive, and the Hub, Kreddle, the Club, the Venue, the Krezz Arms and the Krunch Pit,
//          and fails on any visible text that names a key or the mouse outside dialogue.
// guide    the Add to Home Screen guide per browser (user agent): iPhone Safari / Chrome / Edge / Firefox,
//          Instagram, Messenger, Android Chrome (with and without the install prompt; INSTALL calls it), Edge,
//          Samsung Internet, Firefox, an Android in-app browser; at 844x390, 740x360 and 750x340; never shown from
//          the home screen (navigator.standalone, display-mode); ?mobilediag (and only with it).
// optout   the same phone with ?mobile=0: no layer, no "mobile" class, no phone CSS, no phone global.
// town     the Hub on a phone: with Mikey following, a door's ACTION is ENTER (not SHOVE); SHOVE when he's all
//          there is; the shoving match on the bridge shows SHOVE and it shoves; the first toasts speak touch.
// dungeon  Wildern room 1: the phone controls, not the old pad; the page hidden mid-press lets go of the stick and
//          FIRE; coming back (hidden → visible, upright → sideways, the guide from the rotate screen) opens the pause
//          menu instead of dropping into the fight; a fight with no pause menu waits behind "tap to carry on".
// combat   stage 2's top-down fight controls, iPhone 14 with its safe areas: a room and a boss reached through
//          DebugSkip; the old pad gone and the new controls up (their names inside them the first fights); the stick from the
//          gutter; auto-fire kills a test enemy with no thumb on FIRE; FIRE hold, slide-to-aim, the 200 ms grace with
//          auto-fire off; DODGE; SPECIAL; SWAP tap and hold (slide onto a gun in the picker); the weapon chip tap and
//          hold, CLOSE; READY pops in (ignores a press at once), WONK!'s mash overlay takes taps anywhere; HEAL pops
//          in and heals; a touch in the gap goes to the nearest control; stick + FIRE + DODGE at once; pause, hidden
//          and upright mid-fight, with no stuck input after each; toasts clear of the chip and pause; the boss bar up
//          top and auto-fire on the boss; sizes, spacing and cover at 844x390, 750x340 and 740x360.
// together the two stage 2 tracks at once (iPhone 14): bigger text on in a fight (HUD, buttons, READY, the picker
//          fit); a conversation in a fight shows SKIP / LOG / AUTO and no fight button, its narrated CONTROLS line in
//          touch words; pause -> PHONE SETTINGS changes auto-fire and button size live in the fight; pause -> CONTROLS
//          opens the picture on FIGHTS; the Krezz Arms brawl says Tap and taps anywhere swing.
// polish   (stage 2 polish) at 844x390 with the iPhone insets and at 740x360 (750x340 and 932x430: the busiest
//          screens only, measured): a fresh top-down room (chapter 1 kit),
//          the same room mid-game (everything charged), a boss, a side room's start, the finale brawl and the Krezz
//          Arms, each measured: no caption or button word over another caption, a button or the HUD, no button on
//          another; the controls on screen counted (only what can be used now: no SPECIAL without its Krezz, no
//          HEAL at full health, no READY with nothing to do); JUMP plain to see over the first pit; a
//          long room name clear of the name, coins and meters; the Leave card above the bottom 21 px.
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
const ONLY = (arg("--only", "phone,upright,settings,read,dialogue,settings2,lists,wording,guide,optout,town,dungeon,combat,side,brawl,together,review1,polish,android,desktop") || "").split(",").filter(Boolean);
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
    // (P16, stage 2: a tap on a face picks and shows them; PLAY AS starts)
    await ph.tapGame(92, 140);
    await ph.page.waitForTimeout(700);
    check("character select: a tap on a face picks them and stays on character select", (await ph.active()).includes("CharSelect"));
    await ph.tapText("PLAY AS", { scene: "CharSelect" });
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
    // (room to walk right: the drags above can leave the player against Home's right wall, depending on frame timing)
    await ph.ev(() => {
      const me = window.__krel.game.scene.getScene("Home").me;
      if (me.x > 760) me.body && me.body.reset ? me.body.reset(700, me.y) : me.setPosition(700, me.y);
    });
    await sleep(200);
    a = await ph.me();
    // (to the left: the walks above may have taken the player right up to the room's right wall)
    await ph.touch("touchStart", [{ x: restAt[0] - 70, y: restAt[1], id: 21 }]);
    await sleep(600);
    const fixedSnap = await ph.snap();
    await ph.touch("touchEnd", []);
    await sleep(200);
    b = await ph.me();
    await ph.ev(() => window.__krelMobile.settings.set({ stick: "stays" }));
    check("fixed stick: the base stays put and a thumb to its left walks left at once", !!fixedSnap.stick && Math.abs(fixedSnap.stick.x - restAt[0]) < 1 && Math.abs(fixedSnap.stick.y - restAt[1]) < 1 && a[0] - b[0] >= 20, { restAt, base: fixedSnap.stick, from: a, to: b });

    // the default stick (thumb-feel round, the user: "the joystick ... can slide all over the screen, if your thumb
    // does"): its base stays where the thumb landed, however far the thumb goes; "FOLLOWS YOUR THUMB" drags it along,
    // never out of the stick zone
    const dragFar = async (id, x0, y0, dx) => {
      await ph.touch("touchStart", [{ x: x0, y: y0, id }]);
      for (let i = 1; i <= 8; i++) {
        await ph.touch("touchMove", [{ x: x0 + (i * dx) / 8, y: y0, id }]);
        await sleep(25);
      }
      await sleep(120);
      const sn = await ph.snap();
      const t = await ph.touchState();
      await ph.touch("touchEnd", []);
      await sleep(200);
      return { base: sn.stick, zone: sn.zone, mx: t.mx };
    };
    await ph.ev(() => {
      const me = window.__krel.game.scene.getScene("Home").me;
      me.body && me.body.reset ? me.body.reset(300, me.y) : me.setPosition(300, me.y);
    });
    const stays = await dragFar(22, 120, 280, 240);
    check("default stick (STAYS): the base stays where the thumb landed, 240 px of drag later; full speed that way", (await ph.ev(() => window.__krelMobile.settings.get().stick)) === "stays" && !!stays.base && Math.abs(stays.base.x - 120) < 1 && Math.abs(stays.base.y - 280) < 1 && stays.mx > 0.9, stays);
    await ph.ev(() => window.__krelMobile.settings.set({ stick: "follows" }));
    const follows = await dragFar(23, 120, 280, 400);
    await ph.ev(() => window.__krelMobile.settings.set({ stick: "stays" }));
    check("FOLLOWS: the base is dragged along, but stops at the stick zone's edge", !!follows.base && follows.base.x > 200 && follows.base.x <= follows.zone.x + follows.zone.w + 0.5 && follows.mx > 0.9, follows);

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
    // (a little left of the shelf's middle: with Bigger text the bubble is wider, and it must sit inside the zone here)
    await putMe(276, 462);
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
    check("defaults: right-handed, M, 30%, HOLD FIRE (auto-fire off: EASY is a choice), normal aim assist, phone assist on, battery saver off, readability ON (stage 2), haptics on", JSON.stringify(st.s) === JSON.stringify({ leftHanded: false, buttonSize: "M", opacity: 0.3, stick: "stays", autoFire: false, firing: "auto", aimAssist: "normal", phoneAssist: true, batterySaver: false, readability: true, textSize: "normal", haptics: true, syncOffsetMs: 0, playOverMyMusic: false }), st.s);
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
      const want = [/fps \d/, /textures \d+ · ~[\d.]+ MB/, /sound \d+ decoded · ~[\d.]+ MB · audio/, /window 844x390 · visual 844x390/, /dpr 3/, /canvas 693x390 at 75,0 · scale 0\.722/, /safe area L0 R0 T0 B0/, /touch mode /, /phone mode ON by device: coarse yes · no hover yes · touch \d+ · short side 390/, /iPhone safari/, /readability on/i, /last error: /];
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
    const [cx, cy] = await ph.g2c(o1.x, o1.y);
    // (the rows "appear" a second from now: any press before then is inside the 180 ms guard, whatever the latency)
    await ph.ev(() => (window.__krelMobile.dialogue.current().__mfChoiceShownAt = performance.now() + 1000));
    await ph.tapCss(cx, cy);
    await sleep(200);
    check("a tap in the first 180 ms after the rows appear is ignored", (await dlg(ph)).choosing && !(await testFlags(ph)).includes("t_one"));
    await sleep(1300);
    await ph.tapCss(cx, cy);
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
    await sleep(200);
    // SKIP asks first (P8): nothing skipped yet; KEEP READING takes it away; then SKIP SCENE
    const ask = await dlg(ph);
    const lineAsk = (await boxNow(ph)).full;
    const geo = await ph.ev(() => {
      const a = document.querySelector(".kd-sk-go").getBoundingClientRect();
      const b = document.querySelector(".kd-sk-no").getBoundingClientRect();
      return { goH: a.height, noH: b.height, gap: Math.round(a.left - b.right) };
    });
    await ph.tapSel(".kd-sk-no");
    await sleep(200);
    const kept = await dlg(ph);
    const lineKept = (await boxNow(ph)).full;
    check("SKIP asks first (SKIP SCENE / KEEP READING, 48 px, 12 px apart); KEEP READING carries on where it was (P8)", ask.skipAsking && !ask.skipping && !kept.skipAsking && lineKept === lineAsk && geo.goH >= 47.5 && geo.noH >= 47.5 && geo.gap >= 11.5, { asking: ask.skipAsking, kept: kept.skipAsking, lineAsk: lineAsk.slice(0, 40), lineKept: lineKept.slice(0, 40), geo });
    await ph.tapSel(".kd-skip");
    await sleep(200);
    await ph.tapSel(".kd-sk-go");
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
    await sleep(200);
    await ph.tapSel(".kd-sk-go");
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
    for (const key of ["leftHanded", "haptics", "phoneAssist", "readability", "batterySaver", "playOverMyMusic"]) {
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
    for (const [key, vals] of [["buttonSize", ["S", "L", "M"]], ["stick", ["fixed", "follows", "stays"]], ["aimAssist", ["strong", "off", "normal"]], ["textSize", ["large", "normal"]], ["firing", ["auto", "hold"]]]) {
      for (const v of vals) {
        await tapIn(key, `[data-v="${v}"]`);
        await sleep(150);
        const g = await get();
        // (Firing: HOLD is auto-fire off; the row keeps autoFire in step)
        const now = key === "firing" ? (g.autoFire === false ? "hold" : g.firing) : g[key];
        if (now !== v || (key === "firing" && g.autoFire !== (v !== "hold"))) fails.push(`${key}=${v}`);
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
    // (Firing compares by the style in force: HOLD is stored as auto-fire off, whatever flavour `firing` keeps)
    const styled = (g) => JSON.stringify({ ...g, firing: g.autoFire === false ? "hold" : g.firing });
    check("and the settings end where they started", styled(await get()) === styled(s0));
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

// ------------------------------------------------------------------ lists, shops, character select (stage 2, part 2)

/** The phone list showing now (name, rows, scroll), or null. */
const listNow = (ph) => ph.ev(() => window.__krelMobile.lists.open());

/** The box of a DOM element (CSS px), or null. */
const boxOf = (ph, sel) =>
  ph.ev((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  }, sel);

/** A real finger drag (CDP touch events) from (x, y) by (dx, dy) in `steps` moves. */
async function drag(ph, x, y, dx, dy, steps = 8, holdMs = 0) {
  await ph.touch("touchStart", [{ x, y, id: 7 }]);
  if (holdMs) await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    await ph.touch("touchMove", [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id: 7 }]);
    await sleep(16);
  }
  await ph.touch("touchEnd", []);
  await sleep(250);
}

/** Scroll a list row into view (by the list's own scroll; the drag test is separate) and tap it by touch. */
async function tapRow(ph, id, inner = "") {
  const sel = `.pl.show [data-row="${id}"]${inner ? ` ${inner}` : ""}`;
  await ph.ev((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }), sel);
  await sleep(200);
  await ph.tapSel(sel);
  await sleep(350);
}

/** Start a run with the town's first scenes done (and the given extra state), into `key`. */
function runInto(ph, key, extra) {
  return ph.ev(
    ({ key, extra }) => {
      const k = window.__krel;
      k.newRun("FLENKY");
      Object.assign(k.G.s.flags, { ch1_intro: true, ch1_home: true, home_seen: true, flyover_seen: true, tv_klerble_welcome: true, prologue_done: true, met_emergency: true, founding_seen: true });
      if (extra) new Function("s", "G", extra)(k.G.s, k.G);
      const g = k.game;
      // (overlays first; then the scene in front switches to `key`, as the game itself goes from scene to scene)
      for (const o of ["Menu", "Slots", "PitLoan", "Dialogue", "WeaponPick"]) if (g.scene.isActive(o)) g.scene.stop(o);
      const from = g.scene.getScenes(true).find((sc) => !["Menu", "Slots", "PitLoan", "Dialogue", "WeaponPick", "UI"].includes(sc.sys.settings.key));
      if (from) from.scene.start(key);
      else k.go(key);
    },
    { key, extra },
  );
}

/** Start a scene over whatever runs (menus that the game launches over a scene). */
const startScene = (ph, key, data) =>
  ph.ev(({ key, data }) => {
    const g = window.__krel.game;
    for (const sc of g.scene.getScenes(true)) if (sc.sys.settings.key !== "UI" && sc.sys.settings.key !== key) g.scene.stop(sc.sys.settings.key);
    g.scene.start(key, data || {});
  }, { key, data });

async function lists(browser) {
  console.log("LISTS (native-scroll lists, shops, the gun rack, character select)");
  let { ctx, page, ph, errors } = await phoneAtTitle(browser);
  try {
    // ---- character select (P16): a tap picks and shows; PLAY AS starts; the preselected face doesn't start on a tap
    await ph.tapText("NEW GAME", { scene: "Title" });
    await ph.scene("CharSelect");
    await sleep(1500);
    const face = (i) => ph.ev((i) => {
      const cs = window.__krel.game.scene.getScene("CharSelect");
      const c = cs.cards[i];
      const k = window.__krel.game.scale.canvasBounds.width / 960;
      const r = window.__krel.game.canvas.getBoundingClientRect();
      return { x: r.x + (c.x + c.width / 2) * k, y: r.y + (c.y + c.height / 2) * k };
    }, i);
    let f = await face(0);
    await ph.tapCss(f.x, f.y);
    await sleep(700);
    const s0 = await ph.ev(() => ({ on: window.__krel.active().includes("CharSelect"), sel: window.__krel.game.scene.getScene("CharSelect").sel }));
    check("character select: a tap on the face that starts selected only picks it (no start)", s0.on && s0.sel === 0, s0);
    f = await face(4);
    await ph.tapCss(f.x, f.y);
    await sleep(700);
    const s1 = await ph.ev(() => ({ on: window.__krel.active().includes("CharSelect"), sel: window.__krel.game.scene.getScene("CharSelect").sel }));
    check("character select: a tap on another face picks and shows them, still on character select", s1.on && s1.sel === 4, s1);
    // (a drag across the faces picks nothing)
    const f2 = await face(2);
    await drag(ph, f2.x, f2.y, 0, 60, 6);
    check("character select: a drag that leaves a face picks nothing", (await ph.ev(() => window.__krel.game.scene.getScene("CharSelect").sel)) === 4);
    await ph.shot("lists-charselect");
    const want = await ph.ev(async () => (await import("/src/data/characters.ts")).PLAYABLE_ORDER[4]);
    await ph.tapText("PLAY AS", { scene: "CharSelect" });
    await ph.scene("Difficulty");
    const pl = await ph.ev(() => window.__krel.game.scene.getScene("Difficulty").player ?? window.__krel.game.scene.getScene("Difficulty").sys.settings.data?.player);
    check("character select: PLAY AS starts with the picked one", pl === want, { pl, want });

    // ---- the TV's on-demand guide (58 shows): native scroll, tabs, a tap plays
    await runInto(ph, "Home", "");
    await ph.scene("Home");
    await sleep(1500);
    await ph.ev(async () => {
      const ch = await import("/src/content/television/channels.ts");
      const s = window.__krel.G.s;
      for (const e of ch.ALL_EPISODES) if (e.unlockFlag) s.flags[e.unlockFlag] = true;
      s.tvWatched = ch.ALL_EPISODES.slice(0, 5).map((e) => e.id);
    });
    await startScene(ph, "TV", {});
    await ph.scene("TV");
    await sleep(1500);
    await ph.ev(() => window.__krel.game.scene.getScene("TV").openDemand());
    await sleep(900);
    let L = await listNow(ph);
    const style = await ph.ev(() => {
      const l = document.querySelector(".pl.show .pl-list");
      const cs = getComputedStyle(l);
      const rows = [...document.querySelectorAll(".pl.show .pl-row[data-row]")].map((r) => r.getBoundingClientRect().height);
      const tabs = [...document.querySelectorAll(".pl.show .pl-tab")].map((t) => t.getBoundingClientRect().height);
      const pg = [...document.querySelectorAll(".pl.show [data-pg]")].map((t) => t.getBoundingClientRect().height);
      return { oy: cs.overflowY, ta: cs.touchAction, ob: cs.overscrollBehaviorY, minRow: Math.min(...rows), minTab: Math.min(...tabs), pg, font: parseFloat(getComputedStyle(document.querySelector(".pl.show .pl-l")).fontSize) };
    });
    check("TV guide: a phone list with every show (native scroll, pan-y, contained)", L && L.name === "tv" && L.rows.length >= 40 && style.oy === "auto" && /pan-y/.test(style.ta) && style.ob === "contain", { n: L && L.rows.length, ...style });
    check("TV guide: rows at least 52 CSS px, 16 px words, channel tabs and page buttons at least 44", style.minRow >= 51.5 && style.font >= 16 && style.minTab >= 43.5 && style.pg.every((h) => h >= 43.5), style);
    const selVis = await ph.ev(() => {
      const l = document.querySelector(".pl.show .pl-list");
      const r = document.querySelector(".pl.show .pl-row.sel");
      if (!r) return null;
      const a = l.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
    });
    check("TV guide: it opens with the selected show (the first one not seen) in view", selVis === true, selVis);
    await ph.shot("lists-tv");
    const lb = await boxOf(ph, ".pl.show .pl-list");
    const top0 = L.scrollTop;
    await drag(ph, lb.cx - 60, lb.y + lb.h - 30, 0, -Math.min(200, lb.h - 60), 10);
    L = await listNow(ph);
    const mode1 = await ph.ev(() => window.__krel.game.scene.getScene("TV").mode);
    check("TV guide: a finger drag scrolls it, and nothing under it is pressed (no show started)", L.scrollTop > top0 + 40 && mode1 === "episodes", { from: top0, to: L.scrollTop, mode: mode1 });
    const before = L.scrollTop;
    await ph.tapSel('.pl.show [data-pg="1"]');
    await sleep(700);
    L = await listNow(ph);
    check("TV guide: ▼ pages down without a drag", L.scrollTop > before + 30, { before, after: L.scrollTop });
    await ph.tapSel(".pl.show .pl-tab:nth-child(2)");
    await sleep(700);
    const tab = await ph.ev(() => window.__krel.game.scene.getScene("TV").guideTab);
    L = await listNow(ph);
    check("TV guide: a channel tab by tap shows that channel", tab !== "ALL" && L.rows.length > 0 && L.rows.length < 58, { tab, n: L.rows.length });
    const pick = L.rows[Math.min(2, L.rows.length - 1)].id;
    await tapRow(ph, pick);
    await sleep(600);
    const tv = await ph.ev(() => ({ mode: window.__krel.game.scene.getScene("TV").mode, ep: window.__krel.game.scene.getScene("TV").ep?.id }));
    check("TV guide: a tap on a show plays it, and the list goes", tv.mode === "playing" && tv.ep === pick && !(await listNow(ph)), { ...tv, pick });

    // ---- the gun rack: pick, ▲ ▼, drag the ⋮⋮ handle, MAKE IT #1, ammo by the box with − / +
    await runInto(ph, "Home", "s.coins = 5000;");
    await ph.scene("Home");
    await sleep(2500);
    const ids = await ph.ev(async () => {
      const G = (await import("/src/game/combat/Guns.ts")).GUNS;
      const s = window.__krel.G.s;
      const ids = Object.keys(G).filter((id) => G[id].maxAmmo < 9999 && G[id].pickup > 0).slice(0, 7);
      s.guns = {};
      ids.forEach((id, i) => (s.guns[id] = i === 1 ? 0 : 3));
      const h = window.__krel.game.scene.getScene("Home");
      h.busy = false;
      h.gunRackPanel();
      return ids;
    });
    await sleep(800);
    L = await listNow(ph);
    const order = () => ph.ev(async () => (await import("/src/game/systems/armoury.ts")).orderedGuns(window.__krel.G.s));
    check("gun rack: a phone list with every gun and the Fart Blaster", L && L.name === "rack" && L.rows.length === ids.length + 1, L && L.rows.map((r) => r.id));
    await ph.shot("lists-rack");
    let o = await order();
    const third = o[2];
    await tapRow(ph, third);
    L = await listNow(ph);
    check("gun rack: a tap picks a gun (it doesn't move)", L.rows.find((r) => r.id === third)?.selected && (await order())[2] === third);
    await tapRow(ph, third, `[data-id="up-${third}"]`);
    o = await order();
    check("gun rack: ▲ moves it up one", o[1] === third, o);
    await tapRow(ph, third, `[data-id="down-${third}"]`);
    o = await order();
    check("gun rack: ▼ moves it back down", o[2] === third, o);
    // drag the first gun's handle down two rows
    const first = o[0];
    await ph.ev((id) => document.querySelector(`.pl.show [data-row="${id}"]`).scrollIntoView({ block: "start" }), first);
    await sleep(200);
    const grip = await boxOf(ph, `.pl.show [data-row="${first}"] .pl-grip`);
    const rowH = (await boxOf(ph, `.pl.show [data-row="${first}"]`)).h;
    await drag(ph, grip.cx, grip.cy, 0, rowH * 2 + 4, 10, 60);
    o = await order();
    check("gun rack: dragging ⋮⋮ moves a gun (two rows down)", o[2] === first, { o, first });
    await tapRow(ph, first);
    await ph.tapSel('.pl.show [data-id="rack-top"]');
    await sleep(400);
    o = await order();
    check("gun rack: ★ MAKE IT #1 puts it first", o[0] === first, o);
    // ammo: the empty gun, the most boxes the money buys by default, − twice, BUY: exactly that many boxes
    const empty = ids[1];
    await tapRow(ph, empty);
    const q0 = await ph.ev(async (id) => {
      const A = await import("/src/game/systems/armoury.ts");
      const s = window.__krel.G.s;
      const q = A.ammoQuote(s, id);
      return { coins: s.coins, have: s.guns[id], unit: q.unit, boxes: q.boxes, label: document.querySelector(".pl.show .pl-qn")?.textContent || "" };
    }, empty);
    const can = Math.min(q0.boxes, Math.floor(q0.coins / q0.unit));
    check("gun rack: ammo by the box, starting at what fills it (what the money runs to)", can > 2 && q0.label.startsWith(`${can} box`), q0);
    await ph.tapSel('.pl.show [data-id="qty-"]');
    await sleep(250);
    await ph.tapSel('.pl.show [data-id="qty-"]');
    await sleep(250);
    await ph.tapSel('.pl.show [data-id="rack-buy"]');
    await sleep(500);
    const q1 = await ph.ev(async (id) => {
      const s = window.__krel.G.s;
      const G = (await import("/src/game/combat/Guns.ts")).GUNS;
      return { coins: s.coins, have: s.guns[id], pickup: G[id].pickup, saved: window.__krel.G.saves.load("auto")?.coins };
    }, empty);
    check("gun rack: − − then BUY buys exactly two boxes fewer (coins and rounds), and saves the right money", q0.coins - q1.coins === (can - 2) * q0.unit && q1.have >= Math.min(q0.have + (can - 2) * q1.pickup, 1) && q1.saved === q1.coins, { q0, q1, can });
    await ph.ev(() => window.history.back());
    await sleep(600);
    check("gun rack: Back closes it (as Esc does)", !(await listNow(ph)) && !(await ph.ev(() => window.__krel.game.scene.getScene("Home").__mfPanel?.root?.active)));

    // ---- the jukebox (90 tunes, two columns)
    await ph.ev(() => {
      window.__krel.G.meta.heardMusic = ["home", "title", "hub", "news", "archive"];
      window.__krel.game.scene.getScene("Home").jukeboxPanel();
    });
    await sleep(700);
    L = await listNow(ph);
    check("jukebox: a phone list of every tune", L && L.name === "jukebox" && L.rows.length >= 80, L && L.rows.length);
    await tapRow(ph, "hub");
    check("jukebox: a tap plays it", (await ph.ev(() => window.__krel.G && (window.__krel.game.scene.getScene("Home"), true))) && (await ph.ev(async () => (await import("/src/game/audio/Synth.ts")).synth.currentMusic())) === "hub");
    await ph.ev(() => window.__krel.game.scene.getScene("Home").__mfPanel.close());
    await sleep(300);

    // ---- the Kreddle Exchange: a tap picks (never buys); BUY buys; ammo by the box
    await ph.ev(async () => {
      const G = (await import("/src/game/combat/Guns.ts")).GUNS;
      const s = window.__krel.G.s;
      s.coins = 3000;
      const id = Object.keys(G).find((k) => G[k].maxAmmo < 9999 && G[k].pickup > 0 && G[k].maxAmmo >= G[k].pickup * 6);
      s.guns = { [id]: 0 };
      s.gun = id;
      window.__krel.game.scene.start("Menu", { mode: "bank", caller: "Home" });
    });
    await ph.scene("Menu");
    await sleep(1200);
    L = await listNow(ph);
    check("Kreddle Exchange: the shop is a phone list of tiles beside the picked item's detail and BUY", L && L.name === "shop" && L.rows.length >= 3 && !!(await boxOf(ph, ".pl.show .pl-buy")), L && L.rows.length);
    const buyBox = await boxOf(ph, ".pl.show .pl-buy");
    const vh = await ph.ev(() => window.innerHeight);
    check("Kreddle Exchange: BUY is at least 44 CSS px and above the home-indicator strip", buyBox.h >= 44 && buyBox.y + buyBox.h <= vh - 21, { buyBox, vh });
    await ph.shot("lists-exchange");
    const c0 = await ph.ev(() => window.__krel.G.s.coins);
    const second = L.rows[1].id;
    await tapRow(ph, second);
    await tapRow(ph, second);
    const c1 = await ph.ev(() => ({ coins: window.__krel.G.s.coins, sel: window.__krel.game.scene.getScene("Menu").shop.index }));
    check("Kreddle Exchange: tapping a tile (twice) picks it and buys nothing", c1.coins === c0 && c1.sel === 1, { c0, ...c1 });
    await ph.tapSel(".pl.show .pl-buy");
    await sleep(1200);
    const c2 = await ph.ev(() => window.__krel.G.s.coins);
    check("Kreddle Exchange: BUY buys it", c2 < c0, { c0, c2 });
    await ph.ev(() => window.__krel.game.scene.getScene("Menu").setBankTab("armoury"));
    await sleep(800);
    L = await listNow(ph);
    const ammoId = L.rows.find((r) => /^ammo_/.test(r.id))?.id;
    await tapRow(ph, ammoId);
    const a0 = await ph.ev(async (id) => {
      const A = await import("/src/game/systems/armoury.ts");
      const s = window.__krel.G.s;
      const q = A.ammoQuote(s, id.slice(5));
      return { coins: s.coins, unit: q.unit, boxes: q.boxes, label: document.querySelector(".pl.show .pl-qn")?.textContent || "" };
    }, ammoId);
    await ph.tapSel('.pl.show [data-id="qty-"]');
    await sleep(250);
    await ph.tapSel(".pl.show .pl-buy");
    await sleep(1200);
    const a1 = await ph.ev(() => window.__krel.G.s.coins);
    const nA = Math.min(a0.boxes, Math.floor(a0.coins / a0.unit));
    check("Kreddle Exchange: ammo with − / +: one box fewer than a fill, exactly", nA >= 2 && a0.label.startsWith(`${nA} box`) && a0.coins - a1 === (nA - 1) * a0.unit, { a0, a1, nA });
    await ph.ev(() => window.__krel.game.scene.stop("Menu"));
    await sleep(400);

    // ---- the pause menu's QUESTS (tabs) and DIALOGUE LOG (newest at the bottom)
    await ph.ev(async () => {
      const Lg = await import("/src/game/ui/dialogueLog.ts");
      for (let i = 0; i < 30; i++) Lg.logLine({ who: "FLENKY", text: `Smoke log line ${i}.`, color: 0xff9ad5 });
      window.__krel.game.scene.start("Menu", { mode: "pause", caller: "Home" });
    });
    await ph.scene("Menu");
    await sleep(800);
    await ph.tapText("QUESTS", { scene: "Menu" });
    await sleep(700);
    L = await listNow(ph);
    check("quests: a phone list", L && L.name === "quests" && L.rows.length > 2, L && L.rows.length);
    await ph.tapSel(".pl.show .pl-tab:nth-child(2)");
    await sleep(600);
    check("quests: the SIDE QUESTS tab by tap", (await ph.ev(() => window.__krel.game.scene.getScene("Menu").questTab)) === 1);
    await ph.tapText("BACK", { scene: "Menu" });
    await sleep(600);
    await ph.tapText("DIALOGUE LOG", { scene: "Menu" });
    await sleep(700);
    L = await listNow(ph);
    check("dialogue log: a phone list opened at the newest line (the bottom)", L && L.name === "log" && L.scrollTop + L.clientHeight >= L.scrollHeight - 4, L && { top: L.scrollTop, h: L.clientHeight, all: L.scrollHeight });
    await ph.ev(() => window.__krel.game.scene.stop("Menu"));
    await sleep(300);

    // ---- the loaner rack: pick, BORROW, the PERKS tab
    await ph.ev(() => {
      const k = window.__krel;
      k.G.rt.pit = { snap: { guns: {}, upgrades: {} }, mode: "range" };
      k.G.s.guns = {};
      k.game.scene.start("PitLoan", { caller: "Home" });
    });
    await ph.scene("PitLoan");
    await sleep(900);
    L = await listNow(ph);
    check("loaner rack: a phone list with every gun", L && L.name === "pitloan" && L.rows.length >= 10, L && L.rows.length);
    const lb2 = await boxOf(ph, ".pl.show .pl-list");
    await drag(ph, lb2.cx - 80, lb2.y + lb2.h - 20, 0, -150, 10);
    L = await listNow(ph);
    check("loaner rack: it scrolls by touch", L.scrollTop > 20, L.scrollTop);
    const loanRow = L.rows[3];
    await tapRow(ph, loanRow.id);
    check("loaner rack: a tap picks it (borrows nothing)", (await ph.ev(() => Object.keys(window.__krel.G.s.guns || {}).length)) === 0 && (await listNow(ph)).rows[3].selected);
    await tapRow(ph, loanRow.id, ".pl-acts .pl-b");
    check("loaner rack: BORROW borrows it", (await ph.ev((id) => id.slice(4) in (window.__krel.G.s.guns || {}), loanRow.id)));
    await ph.tapSel(".pl.show .pl-tab:nth-child(2)");
    await sleep(600);
    check("loaner rack: the PERKS tab by tap", (await ph.ev(() => window.__krel.game.scene.getScene("PitLoan").tab)) === "perk");
    await ph.tapSel('.pl.show [data-id="loan-done"]');
    await sleep(600);
    check("loaner rack: DONE closes it", !(await ph.active()).includes("PitLoan"));
    await ph.ev(() => (window.__krel.G.rt.pit = null));

    // ---- the archive and chapter select
    await ph.ev(async () => {
      const A = await import("/src/content/archive/historicalScenes.ts");
      window.__krel.G.s.archiveUnlocked = A.ARCHIVE.map((a) => a.id);
    });
    await startScene(ph, "Archive", {});
    await ph.scene("Archive");
    await sleep(1200);
    L = await listNow(ph);
    check("archive: a phone list of every record", L && L.name === "archive" && L.rows.length >= 20, L && L.rows.length);
    await tapRow(ph, L.rows[15].id);
    check("archive: a tap opens that record", (await ph.ev(() => window.__krel.game.scene.getScene("Archive").__mfSel)) === L.rows[15].id);
    await startScene(ph, "ChapterSelect");
    await ph.scene("ChapterSelect");
    await sleep(1200);
    L = await listNow(ph);
    check("chapter select: a phone list (chapters, boss fights, side quests)", L && L.name === "chapters" && L.rows.length >= 10, L && L.rows.length);
    await ph.shot("lists-chapters");
    await tapRow(ph, "c1");
    check("chapter select: a tap picks a chapter and shows START (it replaces your save: nothing starts yet)", (await ph.active()).includes("ChapterSelect") && !!(await boxOf(ph, '.pl.show [data-id="chapter-go"]')));
    await tapRow(ph, "c1", '[data-id="chapter-go"]');
    await ph.until(() => !window.__krel.active().includes("ChapterSelect"), null, 60000, "chapter 2 to start");
    check("chapter select: START goes", !(await ph.active()).includes("ChapterSelect") && (await ph.ev(() => window.__krel.G.s.chapter)) === 2);
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
  // the shortest screen (Safari with its bars, 750x340): the guide and the rack fit, rows still 52
  ({ ctx, page, ph, errors } = await phoneAtTitle(browser, { ...IPHONE, viewport: { width: 750, height: 340 } }));
  try {
    await runInto(ph, "Home", "s.coins = 900;");
    await ph.scene("Home");
    await sleep(2000);
    await ph.ev(async () => {
      const G = (await import("/src/game/combat/Guns.ts")).GUNS;
      const s = window.__krel.G.s;
      s.guns = {};
      Object.keys(G).filter((id) => G[id].maxAmmo < 9999).slice(0, 8).forEach((id) => (s.guns[id] = 2));
      const h = window.__krel.game.scene.getScene("Home");
      h.busy = false;
      h.gunRackPanel();
    });
    await sleep(800);
    const fit = await ph.ev(() => {
      const c = document.querySelector(".pl.show").getBoundingClientRect();
      const rows = [...document.querySelectorAll(".pl.show .pl-row[data-row]")].map((r) => r.getBoundingClientRect().height);
      const btns = [...document.querySelectorAll(".pl.show .pl-b")].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height);
      return { bottom: c.bottom, top: c.top, h: window.innerHeight, minRow: Math.min(...rows), minBtn: Math.min(...btns) };
    });
    check("750x340: the gun rack fits above the home-indicator strip, rows 52, buttons 44", fit.top >= 0 && fit.bottom <= fit.h - 21 + 0.5 && fit.minRow >= 51.5 && fit.minBtn >= 43.5, fit);
    await ph.shot("lists-rack-750x340");
    check("no page errors (750x340)", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the touch wording check (stage 2, part 2)

/**
 * Every visible text that names a key or the mouse, outside dialogue (a dialogue box's name, body and choices, the
 * telly's show, speech bubbles in the world are skipped: those are never reworded), in the running scenes and in the
 * phone's own DOM (lists, pills, pages).
 */
async function keyTexts(ph) {
  return ph.ev(async () => {
    const DB = (await import("/src/game/ui/DialogueBox.ts")).DialogueBox;
    const KEY = /\bWASD\b|\bSPACE\b|\bSpace \/|\/ Space\b|\bESC\b|\bEsc\b|\bENTER\b|\bEnter \/|\/ Enter\b|\bEnter:|\bTAB\b|\(Tab\)|\bTab:|\bTab skip\b|\bSHIFT\b|\bShift\b|\b[Cc]lick\b|\b[Mm]ouse\b|Alt\+|\b[Pp]ress [A-Z0-9]\b|\((?:E|Q|F|C|V|X)\)|←\/→|↑\/↓|↑↓|\b1-5\b|1–5/;
    const g = window.__krel.game;
    const skip = new Set();
    for (const sc of g.scene.getScenes(true)) {
      for (const v of Object.values(sc)) {
        if (v instanceof DB) for (const t of [v.nameText, v.titleText, v.bodyText, v.overlay]) if (t) skip.add(t);
      }
      // the telly's show (its stage and its subtitles) is the show, not UI
      if (sc.sys.settings.key === "TV") {
        if (sc.stage) skip.add(sc.stage);
        if (sc.subs) skip.add(sc.subs);
        if (sc.card) skip.add(sc.card);
      }
    }
    const out = [];
    for (const sc of g.scene.getScenes(true)) {
      const walk = (o) => {
        if (!o || o.visible === false || o.active === false || skip.has(o)) return;
        if (o.type === "Container") return o.list.forEach(walk);
        if (o.type !== "Text" || !o.text.trim() || (o.alpha ?? 1) < 0.05) return;
        if (KEY.test(o.text)) out.push(`${sc.sys.settings.key}: ${o.text.slice(0, 90)}`);
      };
      sc.sys.displayList.list.forEach(walk);
    }
    for (const el of document.querySelectorAll(".pl.show, .kps.show, .kd.show, .kah.show")) {
      const t = el.innerText || "";
      for (const line of t.split("\n")) if (KEY.test(line)) out.push(`DOM ${el.className.split(" ")[0]}: ${line.slice(0, 90)}`);
    }
    return out;
  });
}

async function wording(browser) {
  console.log("WORDING (no key or mouse names in the menus and walking scenes, outside dialogue)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const seen = [];
  const look = async (where) => {
    await sleep(500);
    const hits = await keyTexts(ph);
    for (const h of hits) seen.push(`[${where}] ${h}`);
    return hits;
  };
  try {
    await look("title");
    await ph.tapText("SETTINGS", { scene: "Title" });
    await ph.scene("Menu");
    await look("settings 1");
    await ph.tapText("PLAY & DISPLAY", { scene: "Menu" });
    await look("settings 2");
    await ph.ev(() => window.__krel.game.scene.stop("Menu"));
    await ph.tapText("NEW GAME", { scene: "Title" });
    await ph.scene("CharSelect");
    await sleep(1200);
    for (let i = 0; i < 9; i++) {
      await ph.ev((i) => window.__krel.game.scene.getScene("CharSelect").select(i), i);
      await look(`charselect ${i}`);
    }
    await ph.tapText("PLAY AS", { scene: "CharSelect" });
    await ph.scene("Difficulty");
    await look("difficulty");
    await ph.tapText("NEXT", { scene: "Difficulty" });
    await ph.scene("Banter");
    await look("banter");
    await startScene(ph, "ChapterSelect");
    await ph.scene("ChapterSelect");
    await look("chapter select");
    await ph.tapSel('.pl.show [data-row="bosses"]');
    await look("chapter select bosses");
    // Home and its panels
    await runInto(ph, "Home", "s.coins = 900; s.flags.krel_krandall = true;");
    await ph.scene("Home");
    await sleep(2500);
    await look("home");
    for (const [panel, setup] of [
      ["gunRackPanel", "s.guns = { pistol: 3 };"],
      ["gunRackPanel", "s.guns = { pistol: 3, smg: 0, shotgun: 4 };"],
      ["trophyPanel", ""],
      ["consolePanel", ""],
      ["jukeboxPanel", ""],
      ["laptopPanel", ""],
    ]) {
      await ph.ev(({ panel, setup }) => {
        const h = window.__krel.game.scene.getScene("Home");
        new Function("s", setup)(window.__krel.G.s);
        h.busy = false;
        h[panel]();
      }, { panel, setup });
      await look(`home ${panel}`);
      await ph.ev(() => window.__krel.game.scene.getScene("Home").__mfPanel?.close?.());
      await sleep(300);
    }
    // the pause menu and its pages (over Home)
    await ph.ev(() => window.__krelMobile.layer.pause());
    await ph.scene("Menu");
    await look("pause");
    for (const [btn, where] of [["QUESTS", "quests"], ["DIALOGUE LOG", "log"], ["DIFFICULTY", "difficulty page"], ["BANTER", "banter page"]]) {
      await ph.tapText(btn, { scene: "Menu" });
      await look(where);
      if (where === "quests")
        for (const n of [2, 3]) {
          await ph.tapSel(`.pl.show .pl-tab:nth-child(${n})`);
          await look(`quests tab ${n}`);
        }
      await ph.ev(() => window.__krel.game.scene.getScene("Menu").render("pause"));
      await sleep(300);
    }
    await ph.tapText("SAVE GAME", { scene: "Menu" });
    await ph.scene("Slots");
    await look("save slots");
    await ph.ev(() => {
      const g = window.__krel.game;
      g.scene.stop("Slots");
      g.scene.stop("Menu");
      g.scene.resume("Home");
    });
    // the Exchange (every tab) and the telly's guide
    await ph.ev(() => window.__krel.game.scene.start("Menu", { mode: "bank", caller: "Home" }));
    await ph.scene("Menu");
    for (const t of ["upgrades", "armoury", "mods", "perks", "lads"]) {
      await ph.ev((t) => window.__krel.game.scene.getScene("Menu").setBankTab(t), t);
      await look(`exchange ${t}`);
    }
    await ph.ev(() => window.__krel.game.scene.stop("Menu"));
    await startScene(ph, "TV", {});
    await ph.scene("TV");
    await sleep(1500);
    await look("tv playing");
    await ph.ev(() => window.__krel.game.scene.getScene("TV").openDemand());
    await look("tv guide");
    await startScene(ph, "Archive", {});
    await ph.scene("Archive");
    await look("archive");
    // the walking scenes
    for (const key of ["Hub", "Kreddle", "Club", "Venue", "Pub", "Pit"]) {
      await runInto(ph, key, "s.coins = 900;");
      try {
        await ph.scene(key, 90000);
        await sleep(2500);
        await look(key);
      } catch (e) {
        seen.push(`[${key}] (could not reach: ${String(e.message).slice(0, 60)})`);
      }
    }
    check("no visible key or mouse names in the menus and walking scenes (outside dialogue)", seen.length === 0, seen.slice(0, 12));
    check("no page errors", errors.length === 0, errors.slice(0, 3));
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
    check("in the fight: combat mode on the phone controls (the old canvas pad gone)", inFight === "combat:Dungeon" && (await ph.ev(() => !window.__krel.game.scene.getScene("UI").touch)), inFight);
    const paused = () => ph.ev(() => ({ menu: window.__krel.active().includes("Menu"), dungeon: window.__krel.game.scene.isPaused("Dungeon"), hp: window.__krel.G.s.hp, running: window.__krel.game.loop.running }));
    const resume = async () => {
      await ph.tapText("RESUME", { scene: "Menu", exact: true }).catch(() => 0);
      await ph.until(() => !window.__krel.active().includes("Menu"), null, 8000, "resume").catch(() => 0);
      await sleep(300);
    };
    // thumbs on the stick and FIRE when the page hides (no touchcancel): both let go (R9; FIRE sits where ATTACK was)
    const [sx, sy] = await ph.g2c(150, 400);
    // (on FIRE itself: with HOLD the default, nothing but a thumb on FIRE fires, so a press beside it would read as no
    // attack; it used to pass on auto-fire alone)
    const fireCtl = (await ph.snap()).controls.find((c) => c.id === "c-fire" && c.shown);
    const [ax, ay] = fireCtl ? [fireCtl.face.x + fireCtl.face.w / 2, fireCtl.face.y + fireCtl.face.h / 2] : await ph.g2c(860, 440);
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
    check("hidden mid-fight with thumbs on the stick and FIRE: both let go (R9)", held.mx > 0.5 && held.attack && let1.mx === 0 && let1.my === 0 && !let1.attack && let1.held.length === 0, { held, let1 });
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

// ------------------------------------------------------------------ combat: the top-down fights on the phone controls (stage 2)

/** Into a top-down fight through DebugSkip's own preparation (a later chapter's kit), calm and in combat mode. */
async function toFight(ph, dungeon, room, ch, who = "FLENKY", want = "combat:Dungeon") {
  await ph.ev(
    ({ dungeon, room, ch, who }) => {
      const k = window.__krel;
      k.newRun(who);
      k.setChapter(ch, { ch1_home: true, home_seen: true, flyover_seen: true, tut_dungeon: true });
      k.go("DebugSkip");
      window.__fightTo = { dungeon, room, ch };
    },
    { dungeon, room, ch, who },
  );
  await ph.scene("DebugSkip");
  await sleep(800);
  await ph.ev(() => {
    const d = window.__krel.game.scene.getScene("DebugSkip");
    const t = window.__fightTo;
    // DebugSkip's boss jump (its own preparation: the chapter's guns, money, debug powers off below)
    d.goBoss({ boss: "x", dungeon: t.dungeon, room: t.room, ch: t.ch });
  });
  // (the dungeon's entry swoop and title card play first, once per run: a tap skips them)
  for (let i = 0; i < 150 && !(await ph.active().catch(() => [])).includes("Dungeon"); i++) {
    await sleep(1000);
    if (i > 2) await ph.tapCss(560, 150);
  }
  // (a room can hand over to a short scripted scene first: keep tapping it along)
  for (let i = 0; i < 120 && !(await ph.active().catch(() => [])).includes("Dungeon"); i++) {
    await ph.tapCss(560, 150).catch(() => {});
    await sleep(1000);
  }
  await ph.scene("Dungeon");
  let calm = 0;
  for (let i = 0; i < 90 && calm < 5; i++) {
    const m = await ph.mode();
    const act = await ph.active();
    if (m === want && !act.includes("Dialogue") && !act.includes("Tutorial")) {
      calm++;
      await sleep(500);
      continue;
    }
    calm = 0;
    await ph.tapCss(560, 150);
    await sleep(650);
  }
  // nothing in this test may die (and no debug powers: the real game's numbers, empty meters)
  await ph.ev(() => {
    const s = window.__krel.G.s;
    s.flags.debug_mode = false;
    s.hp = 99999;
    window.__krel.G.rt.fart = 0;
    window.__krel.G.rt.wonk = 0;
  });
  await sleep(400);
  return calm >= 5;
}

async function combat(browser) {
  console.log("COMBAT (top-down fights on the phone controls, iPhone 14 with its safe areas)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const T = () =>
    ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { mx: +T.mx.toFixed(2), my: +T.my.toFixed(2), attack: T.attack, edges: [...T.edges], held: [...T.held] };
    });
  const C = () => ph.ev(() => window.__krelMobile.combat.snapshot());
  const ctlOf = async (id) => (await ph.snap()).controls.find((c) => c.id === id);
  const mid = (c) => [c.face.x + c.face.w / 2, c.face.y + c.face.h / 2];
  const P = () =>
    ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const s = window.__krel.G.s;
      return { x: Math.round(d.player.x), y: Math.round(d.player.y), gun: s.gun ?? null, hp: s.hp, bottles: s.bottles, picking: d.picking, dodgeUntil: d.player.dodgeUntil, specialCd: d.player.specialCd };
    });
  const quiet = async (what) => {
    // (auto-fire off for this check: TOUCH.attack must be the thumb's alone)
    const t = await T();
    check(`no stuck input after ${what}`, t.mx === 0 && t.my === 0 && !t.attack && t.held.length === 0, t);
  };
  const press = async (id, ms = 90, tid = 50) => {
    const c = await ctlOf(id);
    const [x, y] = mid(c);
    await ph.touch("touchStart", [{ x, y, id: tid }]);
    await sleep(ms);
    await ph.touch("touchEnd", []);
  };
  try {
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    await ph.ev(() => window.__krelMobile.combat.resetTeaching());
    // (the one-time HOLD tip: every toast is noted from here on)
    await ph.ev(() => {
      window.__toastsSeen = [];
      window.__krel.G.on((ev, d) => ev === "toast" && d && window.__toastsSeen.push(String(d.title)));
    });
    check("a top-down room reached through DebugSkip (as Mikey): combat mode", await toFight(ph, "wildern", 0, 2, "MIKEY"), await ph.mode());
    {
      const st0 = await ph.ev(() => ({ s: window.__krelMobile.combat.snapshot().firing, toasts: window.__toastsSeen }));
      check("a fresh phone fights on HOLD, and its first fight says so once (HOLD FIRE TO SHOOT)", st0.s === "hold" && st0.toasts.filter((t) => t === "HOLD FIRE TO SHOOT").length === 1, st0);
      await ph.shot("combat-hold-tip");
    }
    let s = await ph.snap();
    const shown = (id) => !!s.controls.find((c) => c.id === id && c.shown);
    const pad = await ph.ev(() => window.__krel.game.scene.getScene("UI").touch);
    const cs0 = await C();
    const hurt0 = await ph.ev(async () => {
      const s = window.__krel.G.s;
      return s.bottles > 0 && s.hp < (await import("/src/game/systems/stats.ts")).maxHp(s);
    });
    check("the old canvas pad is gone; FIRE, DODGE, the weapon chip and pause are up; SPECIAL only when it can go, HEAL only when a drink would heal (stage 2 polish, thumb-feel round)", pad === null && ["c-fire", "c-dodge", "c-chip", "pause"].every(shown) && shown("c-special") === cs0.specialReady && shown("c-heal") === hurt0, { shown: s.controls.filter((c) => c.shown).map((c) => c.id), specialReady: cs0.specialReady, hurt0 });
    check("the stick is the town's (left 45%, gutter included) and there's no ACTION / READY with nothing to do", s.decision.stick === "2d" && s.zone.x === 0 && !shown("c-action") && !shown("c-ready"), { stick: s.decision.stick, zone: s.zone });
    const names = await ph.ev(() =>
      [...document.querySelectorAll(".kt .kt-btn.show")].map((b) => {
        const w = b.querySelector(".kt-in");
        return { id: b.dataset.ctl, word: w && getComputedStyle(w).display !== "none" ? w.textContent : "", cap: (b.querySelector(".kt-bcap") || {}).textContent || "" };
      }),
    );
    const nm = (id) => (names.find((n) => n.id === id) || {}).word;
    check("first fights: each icon's name inside its button (FIRE, DODGE), and no caption outside any button (N1)", nm("c-fire") === "FIRE" && nm("c-dodge") === "DODGE" && names.every((n) => !n.cap), names);
    await ph.shot("combat-room");
    // ---- the stick, from the black gutter
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: false }));
    const p0 = await P();
    await ph.touch("touchStart", [{ x: 30, y: 300, id: 1 }]);
    for (let i = 1; i <= 8; i++) {
      await ph.touch("touchMove", [{ x: 30 + i * 8, y: 300 - i * 3, id: 1 }]);
      await sleep(40);
    }
    await sleep(500);
    const st = await T();
    await ph.touch("touchEnd", []);
    const p1 = await P();
    check("a drag that starts in the left gutter moves the player (P9)", st.mx > 0.5 && Math.hypot(p1.x - p0.x, p1.y - p0.y) > 40, { st, moved: [p1.x - p0.x, p1.y - p0.y] });
    await sleep(300);
    await quiet("the stick");
    // ---- auto-fire kills a test enemy, no thumb on FIRE
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true }));
    const victim = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const p = d.player;
      // (a room already cleared by auto-fire: a fresh enemy of the room's own kind)
      let e = d.enemies.find((x) => !x.dead && !x.isBoss);
      if (!e) {
        const kind = (d.room.waves && d.room.waves[0] && d.room.waves[0][0] && d.room.waves[0][0][0]) || "drongle";
        e = d.spawnEnemy(kind, p.x + 140, p.y - 30, { noDrops: true });
      }
      if (!e) return null;
      for (const o of d.enemies) if (o !== e && !o.dead) o.setPosition(p.x - 900, p.y - 900);
      e.hp = 3;
      e.body.reset(p.x + 140, p.y - 30);
      return e.uid;
    });
    let killed = false;
    for (let i = 0; i < 40 && victim !== null; i++) {
      await sleep(150);
      killed = await ph.ev((uid) => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        const e = d.enemies.find((x) => x.uid === uid);
        if (e && !e.dead) e.body.reset(d.player.x + 140, d.player.y - 30);
        return !e || e.dead;
      }, victim);
      if (killed) break;
    }
    check("auto-fire kills a test enemy in range without a thumb on FIRE (M1)", victim !== null && killed, { victim });
    // ---- Settings > Firing (the auto-fire audit): LIGHT fires at a slower pace, STILL only while you stand still
    // (the player to an open spot first, inside the room with nothing solid within 200 px: HOLD and the auto-fire
    // flavours only aim at what you can see, and the stick tests may leave you by a wall, with the test enemy pinned
    // beside you then inside the wall)
    const toSpot = () => ph.ev(async () => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const p = d.player;
      const walls = (d.obstacles?.getChildren() ?? []).map((o) => o.body).filter(Boolean).map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height }));
      const W = d.room.w;
      const H = d.room.h;
      const clear = (x, y) => x > 260 && x < W - 260 && y > 140 && y < H - 140 && walls.every((r) => x < r.x - 200 || x > r.x + r.w + 200 || y < r.y - 60 || y > r.y + r.h + 60);
      let best = null;
      for (let y = 140; y < H - 140 && !best; y += 20) for (let x = 260; x < W - 260; x += 20) if (clear(x, y) && (!best || Math.abs(x - W / 2) + Math.abs(y - H / 2) < Math.abs(best.x - W / 2) + Math.abs(best.y - H / 2))) best = { x, y };
      const at = best ?? { x: W / 2, y: H / 2 };
      p.spr.body.reset(at.x, at.y);
    });
    await toSpot();
    await sleep(600);
    const dummy = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const p = d.player;
      const kind = (d.room.waves && d.room.waves[0] && d.room.waves[0][0] && d.room.waves[0][0][0]) || "drongle";
      const e = d.spawnEnemy(kind, p.x + 150, p.y - 20, { noDrops: true });
      if (!e) return null;
      for (const o of d.enemies) if (o !== e && !o.dead) o.setPosition(p.x - 900, p.y - 900);
      e.hp = e.maxHp = 1e6;
      window.__afDummy = e;
      return e.uid;
    });
    // count shots over a stretch of game time (the dummy pinned in front, never dying)
    const shotsFor = (ms) =>
      ph.ev(
        (ms) =>
          new Promise((res) => {
            const d = window.__krel.game.scene.getScene("Dungeon");
            const t0 = d.time.now;
            let last = d.player.attackAnimUntil;
            let n = 0;
            let auto = 0;
            let frames = 0;
            const tick = () => {
              const e = window.__afDummy;
              // (fully seen all along: some kinds flicker through a dash's wind-up, which the aim rightly skips)
              if (e && !e.dead) {
                e.body.reset(d.player.x + 150, d.player.y - 20);
                e.setAlpha(1).setVisible(true);
              }
              frames++;
              if (window.__krelMobile.combat.snapshot().autoShooting) auto++;
              if (d.player.attackAnimUntil !== last) {
                last = d.player.attackAnimUntil;
                n++;
              }
              if (d.time.now - t0 >= ms) {
                d.events.off("postupdate", tick);
                res({ n, auto: auto / Math.max(1, frames) });
              } else return;
            };
            d.events.on("postupdate", tick);
          }),
        ms,
      );
    let fullRate = null;
    let lightRate = null;
    if (dummy !== null) {
      await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true, firing: "auto" }));
      await sleep(300);
      fullRate = await shotsFor(2500);
      await ph.ev(() => window.__krelMobile.settings.set({ firing: "light" }));
      await sleep(300);
      lightRate = await shotsFor(2500);
    }
    const ratio = fullRate && lightRate && fullRate.n ? lightRate.n / fullRate.n : 0;
    check("Firing LIGHT: auto-fire shoots at about 60% of AUTO's pace at the same enemy, no thumb on FIRE", ratio > 0.45 && ratio < 0.78, { fullRate, lightRate, ratio });
    // LIGHT: a held FIRE goes at the gun's full pace
    {
      const fire = await ctlOf("c-fire");
      const [fx, fy] = mid(fire);
      await ph.touch("touchStart", [{ x: fx, y: fy, id: 7 }]);
      const heldRate = await shotsFor(2500);
      await ph.touch("touchEnd", []);
      check("Firing LIGHT: holding FIRE fires at the full pace", fullRate && heldRate.n >= fullRate.n * 0.85, { fullRate, heldRate });
    }
    // STILL: nothing while the stick is pushed, shooting again once it rests
    await ph.ev(() => window.__krelMobile.settings.set({ firing: "still" }));
    await sleep(300);
    await ph.touch("touchStart", [{ x: 120, y: 260, id: 1 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: 120 + i * 9, y: 260, id: 1 }]);
      await sleep(30);
    }
    const moving = await shotsFor(900);
    await ph.touch("touchEnd", []);
    await toSpot();
    await sleep(600);
    const resting = await shotsFor(1200);
    check("Firing STILL: no auto-fire while you move, auto-fire once you stand still", moving.auto === 0 && resting.auto > 0.5 && resting.n > 0, { moving, resting });
    // HOLD: never by itself
    await ph.ev(() => window.__krelMobile.settings.set({ firing: "hold" }));
    await sleep(300);
    const hold = await shotsFor(1200);
    check("Firing HOLD: no shots without a thumb on FIRE", hold.n === 0 && hold.auto === 0, hold);
    // ---- HOLD (the default): the aim locks only onto an enemy in front of you, on screen, not behind a wall; EASY
    // still aims all round
    if (dummy !== null) {
      // the dummy pinned at an offset from the player for a stretch, facing set; then what the aim is on
      const aimFor = (dx, dy, facing, ms = 500) =>
        ph.ev(
          ([dx, dy, facing, ms]) =>
            new Promise((res) => {
              const d = window.__krel.game.scene.getScene("Dungeon");
              const c = window.__krelMobile.combat;
              const t0 = d.time.now;
              const tick = () => {
                const e = window.__afDummy;
                if (e && !e.dead) {
                  e.body.reset(d.player.x + dx, d.player.y + dy);
                  e.setAlpha(1).setVisible(true);
                }
                // (only the dummy counts: the room's own enemies, and any the next wave brings, are kept out of it)
                for (const o of d.enemies) if (o !== e && !o.dead) o.visible = false;
                c.lastMove = facing;
                if (d.time.now - t0 < ms) return;
                d.events.off("postupdate", tick);
                const sn = c.snapshot();
                for (const o of d.enemies) if (o !== e && !o.dead) o.visible = true;
                res({ target: sn.target ? sn.target.id : null, aim: sn.aim === null ? null : +sn.aim.toFixed(2), want: e ? e.uid : null, dist: e ? Math.round(Math.hypot(e.x - d.player.x, e.y - d.player.y)) : null, me: [Math.round(d.player.x), Math.round(d.player.y)], view: ((v) => [v.x, v.y, v.width, v.height].map(Math.round))(d.cameras.main.worldView) });
              };
              d.events.on("postupdate", tick);
            }),
          [dx, dy, facing, ms],
        );
      await ph.ev(() => window.__krelMobile.settings.set({ autoFire: false, firing: "auto" }));
      await toSpot();
      await sleep(600);
      const ahead = await aimFor(150, -20, 0);
      const behind = await aimFor(-150, 20, 0);
      const turned = await aimFor(-150, 20, Math.PI);
      check("HOLD: the aim locks onto the enemy in front, not one behind you (aims ahead instead); turning toward it locks on", ahead.target === ahead.want && behind.target !== behind.want && (behind.target !== null || Math.abs(behind.aim) < 0.05) && turned.target === turned.want, { ahead, behind, turned });
      const view = await ph.ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        const v = d.cameras.main.worldView;
        return { right: v.x + v.width - d.player.x, w: v.width };
      });
      const offs = await aimFor(view.right + 30, 0, 0);
      check("HOLD: never locks onto an enemy off screen, even right in front", offs.target === null, { offs, view });
      // a pillar between you and it
      await ph.ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        const p = d.player;
        window.__pillar = d.add.rectangle(p.x + 90, p.y, 40, 140, 0, 0);
        d.obstacles.add(window.__pillar);
      });
      const walled = await aimFor(170, 0, 0);
      await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true, firing: "auto" }));
      const easyBehind = await aimFor(-150, 20, 0);
      const easyWalled = await aimFor(170, 0, 0);
      await ph.ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        if (window.__pillar) d.obstacles.remove(window.__pillar, true, true);
        window.__pillar = null;
      });
      check("HOLD: never locks onto an enemy behind a wall or pillar", walled.target === null, walled);
      check("EASY (the old auto-fire): still aims all round you and through pillars", easyBehind.target === easyBehind.want && easyWalled.target === easyWalled.want, { easyBehind, easyWalled });
    }
    await ph.ev(() => {
      window.__krelMobile.settings.set({ autoFire: true, firing: "auto" });
      const e = window.__afDummy;
      if (e && !e.dead) e.hp = 1;
      window.__afDummy = null;
    });
    await sleep(300);
    // ---- FIRE by hand (auto-fire off): hold fires, slide aims, the stream carries on 200 ms after lifting
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: false }));
    await sleep(300);
    const fire = await ctlOf("c-fire");
    const [fx, fy] = mid(fire);
    await ph.touch("touchStart", [{ x: fx, y: fy, id: 2 }]);
    await sleep(250);
    const held = await T();
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: fx - i * 9, y: fy - i * 7, id: 2 }]);
      await sleep(30);
    }
    await sleep(250);
    const slid = await C();
    await ph.shot("combat-fire-slide");
    const want = Math.atan2(-42, -54);
    check("holding FIRE fires (on touch-down)", held.attack, held);
    check("sliding FIRE 24 px+ aims by hand, along the slide (M2)", slid.manual && slid.fireHeld && Math.abs(Math.atan2(Math.sin(slid.aim - want), Math.cos(slid.aim - want))) < 0.3, { aim: slid.aim, want, snapped: slid.snapped });
    // (in the page: TOUCH.attack sampled every frame from the moment the thumb lifts)
    await ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      window.__gs = [];
      document.addEventListener(
        "touchend",
        () => {
          const t0 = performance.now();
          const tick = () => {
            const t = performance.now() - t0;
            window.__gs.push([Math.round(t), T.attack]);
            if (t < 500) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        { once: true, capture: true },
      );
    });
    await ph.touch("touchEnd", []);
    await sleep(900);
    const samples = await ph.ev(() => window.__gs);
    const onAfter = samples.filter(([t, a]) => a && t > 0).map(([t]) => t);
    const lastOn = onAfter.length ? Math.max(...onAfter) : 0;
    const offLater = samples.some(([t, a]) => !a && t > 230);
    check("auto-fire off: firing carries on about 200 ms after the thumb lifts, then stops (M1)", lastOn >= 120 && lastOn <= 260 && offLater, { lastOn, samples: samples.filter((_, i) => i % 3 === 0).slice(0, 12) });
    await sleep(200);
    await quiet("FIRE");
    // ---- DODGE, on touch-down
    const d0 = (await P()).dodgeUntil;
    await press("c-dodge", 80, 3);
    await sleep(250);
    check("DODGE dodges", (await P()).dodgeUntil > d0, { before: d0, after: (await P()).dodgeUntil });
    // ---- SPECIAL
    await ph.ev(() => (window.__krel.G.s.krezz = 100));
    await sleep(300);
    const sp0 = (await P()).specialCd;
    await press("c-special", 80, 4);
    await sleep(300);
    const spAfter = await C();
    check("SPECIAL fires the lad's special (NUKE for Mikey); afterwards it is up only if it could go again", (await P()).specialCd > sp0 && (await ctlOf("c-special")).shown === spAfter.specialReady, { before: sp0, after: (await P()).specialCd, ready: spAfter.specialReady });
    // ---- SWAP: tap = next gun; hold = picker, slide onto a gun and let go
    await ph.ev(() => {
      const s = window.__krel.G.s;
      s.guns = { pistol: 60, smg: 100 };
      s.gun = "pistol";
    });
    await sleep(700);
    check("SWAP is up once there's more than one weapon to choose from", (await ctlOf("c-swap")).shown);
    const g0 = (await P()).gun;
    await press("c-swap", 90, 5);
    await sleep(700);
    const g1 = (await P()).gun;
    check("SWAP tap: the next gun", g1 !== g0, { g0, g1 });
    const sw = await ctlOf("c-swap");
    const [sx, sy] = mid(sw);
    await ph.touch("touchStart", [{ x: sx, y: sy, id: 6 }]);
    await sleep(700);
    const pk = await ph.ev(() => ({ active: window.__krel.active(), d: window.__krelMobile.snapshot().decision, picking: window.__krel.game.scene.getScene("Dungeon").picking }));
    check("SWAP hold (300 ms): the slow-motion weapon picker; still combat, CLOSE where FIRE was", pk.active.includes("WeaponPick") && pk.picking && pk.d.picker === true && (await ctlOf("c-close")).shown && !(await ctlOf("c-fire")).shown, pk);
    await ph.shot("combat-picker");
    const tiles = await ph.ev(() => {
      const wp = window.__krel.game.scene.getScene("WeaponPick");
      const cb = window.__krel.game.scale.canvasBounds;
      const k = cb.width / 960;
      return wp.tiles.map((t) => ({ x: cb.x + t.box.getBounds().centerX * k, y: cb.y + t.box.getBounds().centerY * k, id: t.w.id, empty: t.w.empty }));
    });
    const want2 = tiles.find((t) => !t.empty && t.id !== g1) ?? tiles[0];
    for (let i = 1; i <= 10; i++) {
      await ph.touch("touchMove", [{ x: sx + ((want2.x - sx) * i) / 10, y: sy + ((want2.y - sy) * i) / 10, id: 6 }]);
      await sleep(40);
    }
    await sleep(150);
    await ph.touch("touchEnd", []);
    await sleep(800);
    const g2 = await P();
    check("slide onto a gun and let go: that gun, the picker closed, back to the fight", g2.gun === want2.id && !g2.picking && !(await ph.active()).includes("WeaponPick") && (await ph.mode()) === "combat:Dungeon", { want: want2.id, got: g2.gun });
    // SWAP held and let go without sliding: the picker stays up for a tap, and tapping a gun picks it
    const sw2 = await ctlOf("c-swap");
    await ph.touch("touchStart", [{ x: mid(sw2)[0], y: mid(sw2)[1], id: 20 }]);
    await sleep(700);
    await ph.touch("touchEnd", []);
    await sleep(500);
    const stays = (await ph.active()).includes("WeaponPick");
    const gBefore = (await P()).gun;
    const tiles2 = await ph.ev(() => {
      const wp = window.__krel.game.scene.getScene("WeaponPick");
      const cb = window.__krel.game.scale.canvasBounds;
      const k = cb.width / 960;
      return wp.tiles.map((t) => ({ x: cb.x + t.box.getBounds().centerX * k, y: cb.y + t.box.getBounds().centerY * k, id: t.w.id, empty: t.w.empty }));
    });
    const tapTo = tiles2.find((t) => !t.empty && t.id !== gBefore) ?? tiles2[0];
    await ph.tapCss(tapTo.x, tapTo.y);
    await sleep(800);
    check("SWAP held and let go in place: the picker stays up, and a tap on a gun picks it", stays && (await P()).gun === tapTo.id && !(await ph.active()).includes("WeaponPick"), { stays, want: tapTo.id, got: (await P()).gun });
    // the weapon chip: tap = next, hold = picker, then CLOSE
    const g3 = (await P()).gun;
    await sleep(400);
    await press("c-chip", 90, 7);
    await sleep(700);
    check("weapon chip tap: the next gun (M16)", (await P()).gun !== g3, { before: g3, after: (await P()).gun });
    await press("c-chip", 650, 8);
    await sleep(300);
    const open2 = (await ph.active()).includes("WeaponPick");
    await sleep(300);
    await press("c-close", 90, 9);
    await sleep(800);
    check("weapon chip hold: the picker; CLOSE shuts it", open2 && !(await ph.active()).includes("WeaponPick") && !(await P()).picking, { open2 });
    await sleep(300);
    await quiet("SWAP, the chip and the picker");
    // ---- READY pops in when WONK is full (and ignores a press in its first moments), and opens the mash overlay
    // (the meters fill by themselves as you fight: empty them first, so READY really pops in)
    await ph.ev(() => {
      window.__krel.G.rt.wonk = 0;
      window.__krel.G.rt.fart = 0;
      window.__krel.G.s.flags.golden_charge = false;
    });
    await ph.until(() => !window.__krelMobile.snapshot().controls.find((c) => c.id === "c-ready").shown, null, 5000, "READY gone").catch(() => 0);
    await sleep(300);
    // (the first pop-ins pulse: forget what was taught so this one counts as a first)
    await ph.ev(() => window.__krelMobile.combat.resetTeaching());
    // in the page: the frame READY appears, a finger lands on it at once (a real thumb can't be that quick through CDP)
    const early = await ph.ev(
      () =>
        new Promise((res) => {
          window.__krel.fullWonk();
          const t0 = performance.now();
          const tick = () => {
            const el = document.querySelector('[data-ctl="c-ready"]');
            if (!el || !el.classList.contains("show")) {
              if (performance.now() - t0 < 4000) return requestAnimationFrame(tick);
              return res({ shown: false });
            }
            const b = el.getBoundingClientRect();
            const t = new Touch({ identifier: 777, target: el, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 });
            el.dispatchEvent(new TouchEvent("touchstart", { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
            el.dispatchEvent(new TouchEvent("touchend", { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
            setTimeout(() => res({ shown: true, wonk: window.__krel.game.scene.getScene("Dungeon").player.wonk, pulse: el.classList.contains("pulse") }), 300);
          };
          requestAnimationFrame(tick);
        }),
    );
    const rd = await ctlOf("c-ready");
    check("READY pops in when the WONK meter is full, says WONK!, and pulses (S1, S10)", early.shown && rd.shown && rd.label === "WONK!" && early.pulse, { early, label: rd.label });
    check("a press in READY's very first moments does nothing (pop-ins ignore presses briefly, S11)", early.shown && early.wonk >= 100, early);
    await ph.shot("combat-ready");
    await sleep(300);
    await press("c-ready", 80, 11);
    await ph.until(() => window.__krelMobile.snapshot().decision.mash === true, null, 5000, "mash").catch(() => 0);
    const m0 = (await C()).mashPresses;
    for (let i = 0; i < 9; i++) {
      await ph.touch("touchStart", [{ x: [20, 420, 830][i % 3], y: [60, 200, 340][i % 3], id: 30 + i }]);
      await ph.touch("touchEnd", []);
      await sleep(120);
    }
    const m1 = await C();
    check("WONK!: the mash overlay takes a press from any finger anywhere, gutters included (M14)", m1.mash && m1.mashPresses - m0 === 9, { presses: m1.mashPresses - m0 });
    await ph.shot("combat-mash");
    await ph.until(() => window.__krelMobile.snapshot().decision.mash === false, null, 20000, "the mash to end").catch(() => 0);
    await sleep(2500);
    check("after the wonk: back to the fight controls", (await ph.mode()) === "combat:Dungeon" && (await ctlOf("c-fire")).shown);
    // ---- HEAL pops in under 40% health
    await ph.ev(() => {
      const s = window.__krel.G.s;
      s.hp = 10;
      s.bottles = 2;
    });
    await ph.until(() => window.__krelMobile.snapshot().controls.find((c) => c.id === "c-heal").shown, null, 5000, "HEAL").catch(() => 0);
    await sleep(300);
    const hp0 = (await P()).hp;
    await press("c-heal", 80, 12);
    await sleep(400);
    check("HEAL pops in under 40% health and drinks the juice (S3)", (await P()).hp > hp0 && (await P()).bottles === 1, { hp0, hp: (await P()).hp });
    await ph.ev(() => (window.__krel.G.s.hp = 99999));
    // ---- a touch in the gap between SWAP and FIRE (outside both drawings and their 10 px slop, landing on SWAP's
    // touch area) goes to the control whose drawing is nearest: FIRE (M3)
    s = await ph.snap();
    const fr = s.controls.find((c) => c.id === "c-fire").face;
    const swf = s.controls.find((c) => c.id === "c-swap").face;
    const gx = swf.x + swf.w + 13;
    const gy = swf.y + swf.h / 2 - 3;
    await ph.touch("touchStart", [{ x: gx, y: gy, id: 13 }]);
    await sleep(150);
    const gapT = await T();
    const gapFire = (await ctlOf("c-fire")).pressed;
    const gapSwap = (await ctlOf("c-swap")).pressed;
    await ph.touch("touchEnd", []);
    check("a touch in the gap between SWAP and FIRE presses FIRE, the nearer drawing (within 20 px, M3)", gapFire && gapT.attack && !gapSwap, { at: [gx, gy], fire: fr, swap: swf });
    await sleep(300);
    // ---- three thumbs at once: stick + FIRE + DODGE
    const dg = await ctlOf("c-dodge");
    const [dx, dy] = mid(dg);
    const du0 = (await P()).dodgeUntil;
    await ph.touch("touchStart", [{ x: 150, y: 280, id: 14 }]);
    await ph.touch("touchMove", [{ x: 200, y: 280, id: 14 }]);
    await ph.touch("touchStart", [{ x: 200, y: 280, id: 14 }, { x: fx, y: fy, id: 15 }]);
    await sleep(100);
    await ph.touch("touchStart", [{ x: 200, y: 280, id: 14 }, { x: fx, y: fy, id: 15 }, { x: dx, y: dy, id: 16 }]);
    await sleep(250);
    const three = await T();
    const du1 = (await P()).dodgeUntil;
    await ph.touch("touchEnd", []);
    check("stick, FIRE and DODGE at once: moving, firing and a dodge", three.mx > 0.5 && three.attack && du1 > du0, { three, du0, du1 });
    await sleep(300);
    await quiet("three thumbs");
    // ---- pause mid-fight, from the button
    await press("pause", 80, 17);
    await sleep(900);
    const pz = await ph.ev(() => ({ menu: window.__krel.active().includes("Menu"), paused: window.__krel.game.scene.isPaused("Dungeon"), mode: window.__krelMobile.snapshot().decision.mode }));
    check("pause mid-fight: the pause menu over a paused fight; no fight buttons over it", pz.menu && pz.paused && pz.mode === "none", pz);
    await ph.tapText("RESUME", { scene: "Menu", exact: true }).catch(() => 0);
    await ph.until(() => !window.__krel.active().includes("Menu"), null, 8000, "resume").catch(() => 0);
    await sleep(600);
    // ---- hidden mid-fight with thumbs on the stick and FIRE; rotated mid-fight
    await ph.touch("touchStart", [{ x: 150, y: 280, id: 18 }]);
    await ph.touch("touchMove", [{ x: 210, y: 280, id: 18 }]);
    await ph.touch("touchStart", [{ x: 210, y: 280, id: 18 }, { x: fx, y: fy, id: 19 }]);
    await sleep(200);
    await setVisibility(ph, "hidden");
    await sleep(500);
    const hid = await T();
    check("hidden mid-fight with thumbs on the stick and FIRE: everything lets go", hid.mx === 0 && hid.my === 0 && !hid.attack, hid);
    await ph.touch("touchEnd", []);
    await setVisibility(ph, "visible");
    await sleep(1000);
    check("back to the page: the pause menu, not the fight", (await ph.active()).includes("Menu"));
    await ph.tapText("RESUME", { scene: "Menu", exact: true }).catch(() => 0);
    await sleep(800);
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(1200);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(1500);
    check("turned upright and back mid-fight: the pause menu", (await ph.active()).includes("Menu"));
    await ph.tapText("RESUME", { scene: "Menu", exact: true }).catch(() => 0);
    await sleep(800);
    await quiet("hidden, upright, pause");
    // ---- the HUD: toasts clear of the weapon chip and pause (P10), the specials prompt names the touch button
    await ph.ev(() => window.__krel.G.emit("toast", { title: "AMMO", text: "Somebody dropped a crate of it." }));
    await sleep(500);
    const hud = await ph.ev(() => {
      const ui = window.__krel.game.scene.getScene("UI");
      const cb = window.__krel.game.scale.canvasBounds;
      const k = cb.width / 960;
      const t = ui.toasts[ui.toasts.length - 1];
      const chip = window.__krelMobile.snapshot().controls.find((c) => c.id === "c-chip").face;
      return { toastRight: cb.x + (t.c.x + 300) * k, chipLeft: chip.x, gunT: !!(ui.gunT && ui.gunT.visible) };
    });
    check("HUD: the toast column ends left of the weapon chip; the old gun readout is gone (P10, M16)", hud.toastRight <= hud.chipLeft && !hud.gunT, hud);
    check("fight: no page errors", errors.length === 0, errors.slice(0, 3));
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true }));
    // ---- HEAL whenever a drink would heal (thumb-feel round: the small juice chip is folded into it), red only when low
    await ph.ev(async () => {
      const s = window.__krel.G.s;
      s.hp = Math.round((await import("/src/game/systems/stats.ts")).maxHp(s) * 0.9);
      s.bottles = 2;
    });
    await sleep(600);
    const healHi = await ph.ev(() => {
      const b = document.querySelector('.kt-btn[data-ctl="c-heal"]');
      return { shown: !!b && b.classList.contains("show"), low: !!b && b.classList.contains("low") };
    });
    check("HEAL is up at 90% health with juice to drink (one button for the juice), not red", healHi.shown && !healHi.low, healHi);
    await ph.ev(() => (window.__krel.G.s.hp = 99999));
    // ---- the pocket: 🍺 drinks a bongo
    await ph.ev(() => (window.__krel.G.s.bongos = 2));
    await sleep(500);
    await press("c-bongo", 80, 42);
    await sleep(500);
    const bongos = await ph.ev(() => window.__krel.G.s.bongos);
    check("the 🍺 button drinks a fizzy bongo (B)", bongos === 1, { bongos });
    // as Mikey: the SANMIK chip swaps the form (V); the drinks above came first, so nothing is busy
    await ph.until(() => window.__krelMobile.snapshot().controls.find((c) => c.id === "c-sanmik").shown, null, 5000, "SANMIK chip").catch(() => 0);
    const mk = await ph.ev(() => !!window.__krel.G.s.flags.sanmik_form);
    let mk2 = mk;
    for (let i = 0; i < 3 && mk2 === mk; i++) {
      await sleep(400);
      await press("c-sanmik", 80, 43 + i);
      await sleep(700);
      mk2 = await ph.ev(() => !!window.__krel.G.s.flags.sanmik_form);
    }
    check("as Mikey the SANMIK button is up and swaps the form (V)", mk2 !== mk, { before: mk, after: mk2 });
    await ph.ev(() => (window.__krel.G.s.flags.sanmik_form = false));
    // ---- READY: GOLD with golden juice in you, then CUME while golden
    await ph.ev(() => {
      window.__krel.G.s.flags.golden_charge = true;
      window.__krel.G.rt.wonk = 0;
      window.__krel.G.rt.fart = 0;
    });
    await ph.until(() => window.__krelMobile.snapshot().controls.find((c) => c.id === "c-ready").label === "GOLD", null, 5000, "GOLD").catch(() => 0);
    const gold = await ctlOf("c-ready");
    await sleep(450);
    await press("c-ready", 80, 40);
    await sleep(700);
    const frozenHidden = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const sh = (id) => window.__krelMobile.snapshot().controls.find((c) => c.id === id).shown;
      return d.hitStopUntil - d.now() > 400 && !sh("c-fire") && !sh("c-ready");
    });
    await ph
      .until(
        () => {
          const d = window.__krel.game.scene.getScene("Dungeon");
          const r = window.__krelMobile.snapshot().controls.find((c) => c.id === "c-ready");
          return d.now() < d.player.superUntil && r.shown && r.label === "CUME";
        },
        null,
        15000,
        "CUME",
      )
      .catch(() => 0);
    const cume = await ctlOf("c-ready");
    await sleep(450);
    const cd0 = await ph.ev(() => window.__krel.game.scene.getScene("Dungeon").player.cumeCd);
    await press("c-ready", 80, 41);
    await sleep(900);
    const cd1 = await ph.ev(() => window.__krel.game.scene.getScene("Dungeon").player.cumeCd);
    check("READY: GOLD transforms (golden juice in you); no buttons during its cut-in; then CUME fires the beam (T, C)", gold.label === "GOLD" && frozenHidden && cume.shown && cume.label === "CUME" && cd1 > cd0, { gold: gold.label, frozenHidden, cume: cume.label, cd0, cd1 });
    await sleep(300);
    // ---- a boss, through DebugSkip's boss jump
    check("a boss fight (Krandall) reached through DebugSkip: combat mode", await toFight(ph, "wildern", 3, 2), await ph.mode());
    await sleep(1500);
    const boss = await ph.ev(() => {
      const ui = window.__krel.game.scene.getScene("UI");
      const cb = window.__krel.game.scale.canvasBounds;
      const k = cb.width / 960;
      const d = window.__krel.game.scene.getScene("Dungeon");
      const b = d.boss;
      return { boss: !!b, hp: b ? b.hp : 0, bar: ui.boss ? Math.round(cb.y + ui.bossT.y * k) : null };
    });
    await sleep(4000);
    const boss2 = await ph.ev(() => {
      const b = window.__krel.game.scene.getScene("Dungeon").boss;
      return { hp: b ? b.hp : 0 };
    });
    check("the boss bar is up top on a phone (not under the thumbs or the home strip)", boss.boss && boss.bar !== null && boss.bar < 60, boss);
    check("auto-fire works on the boss", boss2.hp < boss.hp, { before: boss.hp, after: boss2.hp, auto: (await C()).autoFiring });
    await ph.shot("combat-boss");
    // ---- sizes, spacing and how much of the picture the controls cover, at three phone sizes
    const measure = async (w, h, insets) => {
      await page.setViewportSize({ width: w, height: h });
      await ph.ev((i) => window.__krelMobile.setInsets(i), insets);
      await sleep(1500);
      return ph.ev(() => {
        const s = window.__krelMobile.snapshot();
        const cb = window.__krel.game.scale.canvasBounds;
        const cl = s.controls.filter((c) => c.shown && /^c-|^pause$/.test(c.id));
        const sizes = Object.fromEntries(cl.map((c) => [c.id, [Math.round(c.face.w), Math.round(c.face.h)]]));
        const round = cl.filter((c) => Math.abs(c.face.w - c.face.h) < 1 && c.id !== "pause");
        let gap = Infinity;
        for (let i = 0; i < round.length; i++)
          for (let j = i + 1; j < round.length; j++) {
            const a = round[i].face;
            const b = round[j].face;
            gap = Math.min(gap, Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) - a.w / 2 - b.w / 2);
          }
        // cover: drawn area over the picture (a 2 px grid over the canvas)
        let hit = 0;
        let all = 0;
        for (let y = cb.y; y < cb.y + cb.height; y += 2)
          for (let x = cb.x; x < cb.x + cb.width; x += 2) {
            all++;
            if (cl.some((c) => (Math.abs(c.face.w - c.face.h) < 1 ? Math.hypot(x - c.face.x - c.face.w / 2, y - c.face.y - c.face.h / 2) <= c.face.w / 2 : x >= c.face.x && x < c.face.x + c.face.w && y >= c.face.y && y < c.face.y + c.face.h))) hit++;
          }
        return { sizes, minGap: Math.round(gap), cover: Math.round((hit / all) * 1000) / 10, minRound: Math.min(...round.map((c) => c.face.w)) };
      });
    };
    const m844 = await measure(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    const m750 = await measure(750, 340, { top: 0, right: 0, bottom: 0, left: 0 });
    const m740 = await measure(740, 360, { top: 0, right: 0, bottom: 0, left: 0 });
    console.log("    sizes / gaps / cover:", JSON.stringify({ m844, m750, m740 }));
    for (const [n, m] of [
      ["844x390", m844],
      ["750x340", m750],
      ["740x360", m740],
    ])
      check(`${n}: round controls 52 px or more, 12 px or more apart; they cover under 12% of the picture`, m.minRound >= 52 && m.minGap >= 12 && m.cover < 12, m);
    await page.setViewportSize({ width: 844, height: 390 });
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    await sleep(800);
    check("boss: no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ Android: fullscreen, the gate, notices, in-app

// ------------------------------------------------------------------ side-scrolling rooms (stage 2 part 2)

async function sideRooms(browser) {
  console.log("SIDE (side-scrolling rooms: JUMP, buffer, coyote, hop vs full, drop-through, no stuck input)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const S = () => ph.ev(() => window.__krelMobile.combat.side.snapshot());
  const ctlOf = async (id) => (await ph.snap()).controls.find((c) => c.id === id);
  const mid = (c) => [c.face.x + c.face.w / 2, c.face.y + c.face.h / 2];
  const P = () =>
    ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const b = d.player.spr.body;
      return { x: Math.round(d.player.x), y: Math.round(d.player.y), bottom: Math.round(b.bottom), vy: Math.round(b.velocity.y), grounded: b.blocked.down || b.touching.down, now: d.now() };
    });
  const T = () =>
    ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { mx: +T.mx.toFixed(2), my: +T.my.toFixed(2), attack: T.attack, edges: [...T.edges], held: [...T.held] };
    });
  const land = async () => {
    for (let i = 0; i < 40; i++) {
      const p = await P();
      if (p.grounded && Math.abs(p.vy) < 5) return p;
      await sleep(100);
    }
    return P();
  };
  // a calm spot: no enemies near, nothing overhead; the player put on the floor at x
  const calmSpot = () =>
    ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      for (const e of d.enemies) if (!e.dead) e.setPosition(-5000, -5000);
      const s = window.__krel.G.s;
      s.hp = 99999;
      // (a stretch of floor with no platform over it and no gap under it)
      const plats = d.platforms ? d.platforms.getChildren().map((o) => o.body) : [];
      const gaps = d.sideLevel?.gaps ?? [];
      for (let x = 160; x < d.room.w - 200; x += 40) {
        if (gaps.some(([a, b]) => x > a - 120 && x < b + 120)) continue;
        if (plats.some((pb) => x > pb.left - 60 && x < pb.right + 60)) continue;
        d.player.spr.body.reset(x, d.groundY - 60);
        return x;
      }
      return null;
    });
  const jumpBtn = async () => mid(await ctlOf("c-jump"));
  const hop = async (ms) => {
    const [x, y] = await jumpBtn();
    const n0 = (await S()).log.length;
    await ph.touch("touchStart", [{ x, y, id: 60 }]);
    await sleep(ms);
    await ph.touch("touchEnd", []);
    await sleep(1300);
    const s = await S();
    const j = s.log[s.log.length - 1];
    return s.log.length > n0 && j ? Math.round(j.y0 - j.apex) : null;
  };
  try {
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    check("a side-scrolling room (Catford High Street) reached: side mode", await toFight(ph, "arena_sanmik", 1, 5, "FLENKY", "side:Dungeon"), await ph.mode());
    let s = await ph.snap();
    const shown = (id) => !!s.controls.find((c) => c.id === id && c.shown);
    const pad = await ph.ev(() => window.__krel.game.scene.getScene("UI").touch);
    const sideSp = await ph.ev(() => window.__krelMobile.combat.snapshot().specialReady);
    check("the old canvas pad is gone; JUMP, FIRE, DODGE, the weapon chip and pause are up, SPECIAL only when it can go; no SWAP, no top-down FIRE", pad === null && ["c-jump", "c-sfire", "c-dodge", "c-chip", "pause"].every(shown) && shown("c-special") === sideSp && !shown("c-swap") && !shown("c-fire"), { shown: s.controls.filter((c) => c.shown).map((c) => c.id), sideSp });
    const jc = s.controls.find((c) => c.id === "c-jump");
    const fc = s.controls.find((c) => c.id === "c-sfire");
    const [jx, jy] = mid(jc);
    check("JUMP is the big one in the prime corner (84 px, centre 52 in / 52 up from the safe corner); FIRE left of it", Math.abs(jc.face.w - 84) <= 1 && Math.abs(jx - (844 - 47 - 52)) <= 2 && Math.abs(jy - (390 - 21 - 52)) <= 2 && mid(fc)[0] < jx - 60, { jump: jc.face, fire: fc.face });
    check("the stick drives left / right only (stick x)", s.decision.stick === "x", s.decision);
    await ph.shot("side-room");
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: false }));
    check("a calm stretch of floor found", (await calmSpot()) !== null);
    await land();
    // ---- JUMP acts on touch-down (the player is rising while the thumb is still down)
    const p0 = await P();
    await ph.touch("touchStart", [{ x: jx, y: jy, id: 60 }]);
    await sleep(160);
    const p1 = await P();
    await ph.touch("touchEnd", []);
    check("JUMP acts on touch-down (rising while the thumb is still down)", p1.bottom < p0.bottom - 20, { before: p0.bottom, during: p1.bottom, vy: p1.vy });
    await land();
    // ---- hop vs full
    const tap = await hop(0);
    await land();
    const full = await hop(650);
    await land();
    // (a tap's height depends on when the page sees the finger lift: under a loaded test machine it reads a little high)
    // (thumb-feel round: a quick tap now climbs about 123 px of the full 135 here, enough for the standard platforms)
    check("a quick tap jumps nearly as high as a hold (about 123 of 135 px here), a hold the full height", tap !== null && full !== null && tap >= 110 && tap <= 140 && full >= 128 && full <= 155 && full >= tap - 2, { tap, full });
    // ---- buffer: a press just before landing jumps on landing
    await calmSpot();
    await land();
    const buf = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const p = d.player;
      p.spr.body.reset(p.x, p.y - 110);
      const sm = window.__krelMobile.combat.side;
      sm.brain.jumps = 0;
      sm.brain.coyoteUntil = 0;
      return d.now();
    });
    // (a fall of 110 px takes about 380 ms; press with about 100 ms to go)
    for (let i = 0; i < 40; i++) {
      const p = await P();
      if (p.now - buf >= 270) break;
      await sleep(15);
    }
    const nb = (await S()).log.length;
    await ph.touch("touchStart", [{ x: jx, y: jy, id: 61 }]);
    const pressed = (await P()).now;
    await sleep(400);
    await ph.touch("touchEnd", []);
    let sb = await S();
    const bj = sb.log[sb.log.length - 1];
    check("buffer: a press in the air with no jump left fires on landing (waited > 0, under 150 ms)", sb.log.length > nb && bj && bj.kind === "first" && bj.waited > 0 && bj.waited <= 150, { jump: bj, pressedAfterDrop: pressed - buf });
    await land();
    // ---- coyote: just off the ground, the first jump still works; much later it's the air jump
    const coy = async (afterMs) => {
      await land();
      // (the round trips to the page are slower than the timings under test: the game loop sleeps exactly afterMs of
      // game time after the player leaves the ground, JUMP is pressed by a real touch, and the loop wakes)
      await ph.ev(
        (ms) =>
          new Promise((res) => {
            const d = window.__krel.game.scene.getScene("Dungeon");
            d.player.spr.body.reset(d.player.x, d.player.y - 420);
            const t0 = d.now();
            const tick = () => {
              if (d.now() - t0 >= ms) {
                d.events.off("postupdate", tick);
                window.__krel.game.loop.sleep();
                res(d.now() - t0);
              }
            };
            d.events.on("postupdate", tick);
          }),
        afterMs,
      );
      const n = (await S()).log.length;
      await ph.touch("touchStart", [{ x: jx, y: jy, id: 62 }]);
      await sleep(50);
      await ph.ev(() => window.__krel.game.loop.wake());
      await sleep(250);
      await ph.touch("touchEnd", []);
      const s = await S();
      return s.log.length > n ? s.log[s.log.length - 1] : null;
    };
    const c1 = await coy(40);
    const c2 = await coy(300);
    check("coyote: off the ground a moment ago, JUMP is still the first jump; long after, it's the air jump", c1 && c1.kind === "first" && c1.sinceGround > 0 && c1.sinceGround <= 140 && c2 && c2.kind === "air", { soon: c1, late: c2 });
    await land();
    // ---- drop-through only when deliberate
    const plat = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const ps = (d.platforms ? d.platforms.getChildren() : []).map((o) => o.body).filter((b) => b.width >= 80 && b.top < d.groundY - 60 && !(d.sideLevel?.movers ?? []).some((m) => m.rect.body === b));
      const b = ps[0];
      if (!b) return null;
      d.player.spr.body.reset((b.left + b.right) / 2, b.top - 40);
      return { top: Math.round(b.top) };
    });
    if (!plat) check("a platform to stand on", false);
    else {
      await land();
      const on = await P();
      const stick = async (dx, dy, ms) => {
        await ph.touch("touchStart", [{ x: 160, y: 250, id: 3 }]);
        for (let i = 1; i <= 5; i++) {
          await ph.touch("touchMove", [{ x: 160 + (dx * i) / 5, y: 250 + (dy * i) / 5, id: 3 }]);
          await sleep(25);
        }
        await sleep(ms);
        await ph.touch("touchEnd", []);
        await sleep(500);
      };
      await stick(8, 26, 500); // a drift: a little down while the thumb rests
      const after1 = await land();
      await stick(4, 52, 400); // held well down
      const after2 = await land();
      check("drop-through: a drift down keeps you on the platform; the stick held well down drops you through", Math.abs(on.bottom - plat.top) <= 3 && Math.abs(after1.bottom - plat.top) <= 3 && after2.bottom > plat.top + 30, { plat, on: on.bottom, drift: after1.bottom, held: after2.bottom });
    }
    // ---- a quick tap under a standard platform (one full jump up) lands on it (the jump's end is forgiven 20 px)
    const platTap = await ph.ev(async () => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      // (the nearest one: a room's later stretches are shut until its fights are won)
      const px = d.player.x;
      const pb = d.platforms
        .getChildren()
        .map((o) => o.body)
        .filter((b) => d.groundY - b.top > 120 && d.groundY - b.top < 150 && b.width >= 150)
        .sort((a, b) => Math.abs(a.center.x - px) - Math.abs(b.center.x - px))[0];
      if (!pb) return { why: "no platform" };
      const x = pb.left + pb.width / 2;
      const b = d.player.spr.body;
      const sm = window.__krelMobile.combat.side;
      let r = { why: "never stood under it" };
      // (the player put on the floor under it, standing; again if something moved them meanwhile)
      for (let i = 0; i < 3; i++) {
        sm.reset();
        b.reset(x, d.groundY - 60);
        await new Promise((res) => setTimeout(res, 900));
        if (Math.abs(d.player.x - x) > 20 || b.bottom < d.groundY - 4) {
          r = { why: "moved", x: Math.round(d.player.x), want: Math.round(x), bottom: Math.round(b.bottom) };
          continue;
        }
        const y0 = Math.round(b.bottom);
        sm.press(d);
        sm.release(d);
        await new Promise((res) => setTimeout(res, 1600));
        r = { top: Math.round(pb.top), y0, rests: Math.round(b.bottom), x: Math.round(d.player.x), want: Math.round(x), tries: i + 1 };
        break;
      }
      return r;
    });
    check("a quick JUMP tap under a standard platform lands on it", !!platTap && !platTap.why && Math.abs(platTap.x - platTap.want) < 30 && Math.abs(platTap.rests - platTap.top) <= 2, platTap);
    await calmSpot();
    await land();
    // ---- no stuck input: JUMP held while the room goes busy (a scripted moment), let go meanwhile
    await calmSpot();
    await land();
    await ph.touch("touchStart", [{ x: jx, y: jy, id: 63 }]);
    await sleep(60);
    await ph.ev(() => (window.__krel.game.scene.getScene("Dungeon").busy = true));
    await sleep(500);
    await ph.touch("touchEnd", []);
    const nStuck = (await S()).log.length;
    await ph.ev(() => (window.__krel.game.scene.getScene("Dungeon").busy = false));
    await sleep(1200);
    const sx = await S();
    const t = await T();
    check("no stuck input: JUMP held across a mode change lets go, nothing fires afterwards", !sx.touchHeld && sx.pressAt === null && sx.log.length === nStuck && t.mx === 0 && !t.attack, { side: sx, touch: t });
    // ---- auto-fire in side rooms (on by default)
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true }));
    const shot = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const p = d.player;
      const e = d.enemies.find((x) => !x.dead && !x.isBoss) ?? d.spawnEnemy("crobley_minion", p.x + 200, p.y, { noDrops: true });
      if (!e) return null;
      e.hp = 3;
      e.body.reset(p.x + 200, p.y);
      return e.uid;
    });
    let dead = false;
    for (let i = 0; i < 30 && shot !== null && !dead; i++) {
      await sleep(200);
      dead = await ph.ev((uid) => {
        const e = window.__krel.game.scene.getScene("Dungeon").enemies.find((x) => x.uid === uid);
        return !e || e.dead;
      }, shot);
    }
    check("auto-fire (on by default) shoots an enemy ahead in a side room", dead, shot);
    // ---- the camera looks ahead
    const cam = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const c = d.cameras.main;
      return { fx: Math.round(c.followOffset.x), dz: c.deadzone ? Math.round(c.deadzone.width) : null, share: (d.player.x - c.worldView.x) / c.worldView.width };
    });
    check("the camera looks ahead (follow offset about -144: the player left of centre)", cam.fx < -100 && cam.dz === 0, cam);
    // ---- turning round moves the view smoothly (thumb-feel round: it whipped up to 135 game px in 60 ms)
    {
      const z = (await ph.snap()).zone;
      const sx = z.x + 120;
      const sy = z.y + z.h - 70;
      await ph.touch("touchStart", [{ x: sx, y: sy, id: 70 }]);
      await ph.touch("touchMove", [{ x: sx + 60, y: sy, id: 70 }]);
      await sleep(1200);
      const watch = ph.ev(
        () =>
          new Promise((res) => {
            const d = window.__krel.game.scene.getScene("Dungeon");
            const c = d.cameras.main;
            let last = c.followOffset.x;
            let lt = performance.now();
            let max = 0;
            const t0 = lt;
            const tick = () => {
              const t = performance.now();
              const dt = t - lt;
              if (dt > 0) max = Math.max(max, Math.abs(c.followOffset.x - last) / dt);
              last = c.followOffset.x;
              lt = t;
              if (t - t0 > 1600) res({ maxRate: Math.round(max * 100) / 100, fx: Math.round(c.followOffset.x) });
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      await sleep(80);
      await ph.touch("touchMove", [{ x: sx - 60, y: sy, id: 70 }]);
      const turn = await watch;
      await ph.touch("touchEnd", []);
      check("turning round: the view's offset moves at most about 0.45 game px a ms (up to 1 allowed for frame-timing jitter under load; the old easing started at about 2.2) and ends on the other side", turn.maxRate <= 1 && turn.fx > 100, turn);
    }
    // ---- the Kreltality prompt: one big target under the right thumb, no key names
    await ph.ev(async () => {
      const m = await import("/src/game/combat/Kreltality.ts");
      window.__kp = null;
      m.prompt(window.__krel.game.scene.getScene("Dungeon")).then((v) => (window.__kp = v));
    });
    await sleep(600);
    const fin = await ph.ev(() => {
      const y = document.querySelector(".kt-fin-b.yes");
      const b = y && y.getBoundingClientRect();
      const keys = [];
      for (const o of window.__krel.game.scene.getScene("Dungeon").sys.displayList.list) if (o.type === "Text" && /KRELTALITY|spare/.test(o.text)) keys.push(o.text);
      return b ? { w: Math.round(b.width), x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), keys } : null;
    });
    if (fin) await ph.tapCss(fin.x, fin.y);
    await sleep(400);
    const kp = await ph.ev(() => ({ v: window.__kp, left: !!document.querySelector(".kt-fin") }));
    check("the Kreltality prompt: a big KRELTALITY (84 px+) under the right thumb, no key names; a tap on it says yes and it goes", fin && fin.w >= 84 && fin.x > 600 && !fin.keys.some((t) => /\(K|ESC/.test(t)) && kp.v === true && !kp.left, { fin, kp });
    // ---- Android, after leaving fullscreen: the offer to go back in shows in a fight too, under pause, clear of the rest
    await ph.ev(() => window.__krelMobile.layer.setFullscreenOffer(true));
    await sleep(300);
    s = await ph.snap();
    const fsC = s.controls.find((c) => c.id === "fullscreen");
    const hitsAny = (a) => s.controls.filter((c) => c.shown && c.id !== "fullscreen" && c.face.w > 0).filter((c) => a.x < c.face.x + c.face.w && c.face.x < a.x + a.w && a.y < c.face.y + c.face.h && c.face.y < a.y + a.h).map((c) => c.id);
    check("in a fight the fullscreen offer shows under pause, overlapping no other control (Android gate note)", fsC && fsC.shown && hitsAny(fsC.face).length === 0, { face: fsC && fsC.face, overlaps: fsC ? hitsAny(fsC.face) : null });
    await ph.ev(() => window.__krelMobile.layer.setFullscreenOffer(false));
    // ---- a controller connected to the phone takes over; the next touch brings the controls back (S6 / R11)
    await ph.ev(() => {
      window.__fakePad = { connected: true, id: "test pad", index: 0, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0, touched: false })), axes: [0, 0, 0, 0], mapping: "standard", timestamp: 1 };
      navigator.getGamepads = () => [window.__fakePad];
    });
    await sleep(500);
    const hidden = await ph.ev(() => ({ cls: document.querySelector(".kt").className, input: window.__krelMobile.snapshot().decision.input ?? null, vis: getComputedStyle(document.querySelector(".kt-jump") || document.body).visibility }));
    await ph.ev(() => {
      window.__fakePad.buttons[0] = { pressed: false, value: 0, touched: false };
    });
    await ph.touch("touchStart", [{ x: 420, y: 120, id: 70 }]);
    await ph.touch("touchEnd", []);
    await sleep(500);
    const back = await ph.ev(() => ({ cls: document.querySelector(".kt").className, input: window.__krelMobile.snapshot().decision.input ?? null }));
    check("a controller's button hides the touch controls (input: pad); a touch brings them back", hidden.input === "pad" && /padin/.test(hidden.cls) && hidden.vis === "hidden" && back.input === null && !/padin/.test(back.cls), { hidden, back });
    // ---- the Controls picture from the pause menu (side rooms first)
    const pause = await ctlOf("pause");
    await ph.tapCss(...mid(pause));
    await ph.scene("Menu");
    await sleep(800);
    await ph.tapText("CONTROLS");
    await sleep(800);
    const pic = await ph.ev(() => window.__krelMobile.picture.snapshot());
    await ph.shot("side-controls-picture");
    check("pause → CONTROLS on a phone shows the picture of the touch controls (side rooms tab, a dot per control)", pic.open && pic.tab === "side" && pic.rows >= 7 && pic.dots >= 6, pic);
    await ph.tapSel(".kcp-tab[data-tab=brawl]");
    await sleep(300);
    const pic2 = await ph.ev(() => window.__krelMobile.picture.snapshot());
    await ph.tapSel(".kcp-x");
    await sleep(300);
    const pic3 = await ph.ev(() => window.__krelMobile.picture.snapshot());
    check("its tabs switch (brawl) and CLOSE goes back to the pause menu", pic2.tab === "brawl" && pic2.dots >= 5 && !pic3.open && (await ph.active()).includes("Menu"), { pic2, pic3 });
    check("no page errors (side)", errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

async function brawl(browser) {
  console.log("BRAWL (the finale's Super Saiyan brawl by touch: PUNCH, BLOCK, the rush by tapping anywhere)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const B = () => ph.ev(() => window.__krelMobile.brawl.snapshot());
  const ctlOf = async (id) => (await ph.snap()).controls.find((c) => c.id === id);
  const mid = (c) => [c.face.x + c.face.w / 2, c.face.y + c.face.h / 2];
  const raw = () =>
    ph.ev(() => {
      const b = window.__krelMobile.brawl.brawl;
      return b ? { lastPunch: b.lastPunch, hp: Math.round(b.e?.hp ?? -1), padUi: !!b.padUi, rushHits: b.rushHits, finishing: b.finishing } : null;
    });
  try {
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    await ph.ev(() => {
      const k = window.__krel;
      k.newRun("FLENKY");
      k.setChapter(7, { ch1_home: true, home_seen: true, flyover_seen: true });
      k.go("Finale", { beat: "brawl" });
    });
    await ph.scene("Finale");
    // (the intro: a few lines and two cut-ins; taps move the conversation on)
    let on = false;
    for (let i = 0; i < 90 && !on; i++) {
      const b = await B().catch(() => ({ active: false }));
      const st = await raw().catch(() => null);
      on = b.active && st && !st.finishing && (await ph.mode()).startsWith("brawl") && !(await ph.active()).includes("Dialogue");
      if (!on) {
        await ph.tapCss(420, 150);
        await sleep(900);
      }
    }
    check("the finale brawl runs on the phone layer (brawl mode), its own small canvas pad not drawn", on && !(await raw()).padUi, { mode: await ph.mode(), raw: await raw() });
    const s = await ph.snap();
    const shown = (id) => !!s.controls.find((c) => c.id === id && c.shown);
    const pc = s.controls.find((c) => c.id === "b-punch");
    check("PUNCH is the big one in the prime corner (84 px); BLOCK, VANISH, KICK and KI around it, each labelled", ["b-punch", "b-block", "b-vanish", "b-kick", "b-ki"].every(shown) && pc && Math.abs(pc.face.w - 84) <= 1 && s.decision.stick === "2d", s.controls.filter((c) => c.shown).map((c) => `${c.id}:${c.label}`));
    await ph.shot("brawl");
    // the brawl's own how-to legend (bigger text on) sits clear of the buttons and the stick, on the screen
    const leg = await ph.ev(() => {
      const g = window.__krel.game;
      const sc = g.scene.getScene("Finale");
      let t = null;
      const walk = (o) => {
        if (t) return;
        if (Array.isArray(o.list)) for (const c of o.list) walk(c);
        if (o.type === "Text" && /^PUNCH: mash/.test(o.text)) t = o;
      };
      for (const o of sc.sys.displayList.list) walk(o);
      if (!t) return null;
      const b = t.getBounds();
      const cb = g.scale.canvasBounds;
      const k = cb.width / 960;
      return { x: cb.x + b.x * k, y: cb.y + b.y * k, w: b.width * k, h: b.height * k };
    });
    const hit = leg ? s.controls.filter((c) => c.shown && c.face && !(c.face.x > leg.x + leg.w || c.face.x + c.face.w < leg.x || c.face.y > leg.y + leg.h || c.face.y + c.face.h < leg.y)).map((c) => c.id) : [];
    check("the brawl's how-to legend sits clear of the buttons, on the screen (bigger text on)", !!leg && hit.length === 0 && leg.x >= 0 && leg.x + leg.w <= s.viewport.w + 1 && leg.y >= 0, { leg, hit });
    const r0 = await raw();
    await ph.touch("touchStart", [{ x: mid(pc)[0], y: mid(pc)[1], id: 80 }]);
    await sleep(80);
    await ph.touch("touchEnd", []);
    await sleep(500);
    const r1 = await raw();
    check("a tap on PUNCH throws a punch (the brawl's own punch, on touch-down)", r1.lastPunch > r0.lastPunch, { r0, r1 });
    const bl = await ctlOf("b-block");
    await ph.touch("touchStart", [{ x: mid(bl)[0], y: mid(bl)[1], id: 81 }]);
    await sleep(300);
    const held = await B();
    await ph.touch("touchEnd", []);
    await sleep(300);
    const after = await B();
    check("BLOCK is held while the thumb is down, and lets go with it", held.held.includes("block") && !after.held.includes("block"), { held: held.held, after: after.held });
    // the finishing rush: every finger anywhere is a punch
    await ph.ev(() => {
      const b = window.__krelMobile.brawl.brawl;
      b.finisher(b.sc.time.now);
    });
    await sleep(1500);
    const m0 = await B();
    const h0 = (await raw()).rushHits;
    for (let i = 0; i < 8; i++) {
      await ph.touch("touchStart", [{ x: 200 + i * 40, y: 200, id: 90 + i }]);
      await ph.touch("touchEnd", []);
      await sleep(120);
    }
    const m1 = await B();
    const h1 = (await raw())?.rushHits ?? h0;
    const words = await ph.ev(() => {
      const out = [];
      for (const sc of window.__krel.game.scene.getScenes(true)) for (const o of sc.sys.displayList.list) if (o.type === "Text" && o.visible) out.push(o.text);
      return out.filter((t) => /MASH|TAP|Esc/.test(t));
    });
    check("the rush: the buttons hide, a tap anywhere is a punch (MASH PUNCH! reads TAP TAP TAP! on a phone)", m0.mash && m1.mashPresses >= m0.mashPresses + 8 && h1 > h0 && !words.some((t) => /Esc|MASH PUNCH/.test(t)), { m0, m1, h0, h1, words });
    check("no page errors (brawl)", errors.length === 0, errors);
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ the two stage 2 tracks together

/** Screen-fixed texts of these scenes (game coordinates), for overflow checks. */
const hudTexts = (ph, keys) =>
  ph.ev((keys) => {
    const g = window.__krel.game;
    const out = [];
    for (const k of keys) {
      const sc = g.scene.getScene(k);
      if (!sc || !g.scene.isActive(k)) continue;
      const walk = (o) => {
        if (o.visible === false || o.alpha === 0) return;
        if (o.type === "Container" && o.list) for (const c of o.list) walk(c);
        if (o.type !== "Text" || !o.text || !o.text.trim()) return;
        const b = o.getBounds();
        out.push({ t: o.text.slice(0, 40).replace(/\n/g, "/"), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
      };
      for (const o of sc.children.list) walk(o);
    }
    return out;
  }, keys);
const offGame = (ts) => ts.filter((t) => t.x < -1 || t.y < -1 || t.x + t.w > 961 || t.y + t.h > 541);
/** DOM texts (CSS px) wider than their box or off the screen. */
const domSpill = (ph, sel) =>
  ph.ev((sel) => {
    const out = [];
    for (const e of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0) continue;
      const wide = e.scrollWidth > e.clientWidth + 1;
      const off = r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
      if (wide || off) out.push({ cls: String(e.className), t: e.textContent.trim().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth, off });
    }
    return out;
  }, sel);

/** The fight HUD's KREZZ / WONK lines (CSS px) and the shown chips they could run into. */
const metersVsChips = (ph) =>
  ph.ev(() => {
    const g = window.__krel.game;
    const t = g.scene.getScene("UI").kzT;
    const b = t.getBounds();
    const cb = g.scale.canvasBounds;
    const k = cb.width / 960;
    const m = { x: cb.x + b.x * k, y: cb.y + b.y * k, w: b.width * k, h: b.height * k };
    const hit = window.__krelMobile
      .snapshot()
      .controls.filter((c) => c.shown && c.face && /^c-(juice|bongo|fart|sanmik|chip)$/.test(c.id))
      .filter((c) => !(c.face.x >= m.x + m.w || c.face.x + c.face.w <= m.x || c.face.y >= m.y + m.h || c.face.y + c.face.h <= m.y))
      .map((c) => c.id);
    return { m, hit };
  });

async function together(browser) {
  console.log("TOGETHER (the fights with the bigger text, the conversations, the Phone settings page and the Controls picture)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const ctlOf = async (id) => (await ph.snap()).controls.find((c) => c.id === id);
  const mid = (c) => [c.face.x + c.face.w / 2, c.face.y + c.face.h / 2];
  try {
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    check("bigger text (readability) is on, as by default", await ph.ev(() => window.__krelMobile.readability.on));
    check("a top-down fight (Wildern, chapter 2 kit) reached", await toFight(ph, "wildern", 0, 2, "MIKEY"), await ph.mode());
    await sleep(1200);
    let ts = await hudTexts(ph, ["UI"]);
    check("bigger text in a fight: every HUD text on the screen", ts.length >= 3 && offGame(ts).length === 0, offGame(ts));
    check("bigger text in a fight: no fight button's word wider than the button", (await domSpill(ph, ".kt *")).length === 0, await domSpill(ph, ".kt *"));
    await ph.ev(() => {
      window.__krel.G.rt.wonk = 999;
      window.__krel.G.rt.fart = 4;
    });
    await sleep(1500);
    const ready = await ctlOf("c-ready");
    ts = await hudTexts(ph, ["UI"]);
    let mv = await metersVsChips(ph);
    check("the KREZZ / WONK lines clear of the drink / SanMik chips (bigger text on)", mv.hit.length === 0, mv);
    check("specials ready: READY up with its word, HUD and buttons still fit", !!ready && ready.shown && !!ready.label && offGame(ts).length === 0 && (await domSpill(ph, ".kt *")).length === 0, { ready: ready && ready.label, off: offGame(ts) });
    await ph.ev(() => {
      window.__krel.G.rt.wonk = 0;
      window.__krel.G.rt.fart = 0;
    });
    await ph.ev(() => window.__krel.game.scene.getScene("Dungeon").openWeaponPicker());
    await ph.scene("WeaponPick");
    await sleep(800);
    check("the weapon picker with bigger text: its texts on the screen, CLOSE fits", offGame(await hudTexts(ph, ["WeaponPick"])).length === 0 && (await domSpill(ph, ".kt *")).length === 0);
    await ph.tapCss(...mid(await ctlOf("c-fire")));
    await ph.until(() => !window.__krel.active().includes("WeaponPick"), null, 15000, "the picker to close").catch(() => {});
    await sleep(600);
    // a conversation inside the fight: its pills, never the fight buttons; the narrated CONTROLS line in touch words
    await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      window.__talkDone = false;
      d.talk([
        { s: "NARRATOR", t: "CONTROLS: WASD move · Mouse aim · Left click attack · Right click / F special · Space dodge · Q pussy juice · B fizzy bongo · R Krezz Burst (full Wonk) · E interact · Esc pause", dir: true },
        { s: "NARRATOR", t: "A second line.", dir: true },
      ]).then(() => (window.__talkDone = true));
    });
    await ph.scene("Dialogue");
    await sleep(1200);
    const st = await ph.ev(() => {
      const snap = window.__krelMobile.snapshot();
      const pills = [...document.querySelectorAll(".kd-pill.show")].map((e) => e.className);
      const said = [];
      const walk = (o) => {
        if (o.list) for (const c of o.list) walk(c);
        if (o.type === "Text" && /CONTROLS/.test(o.text)) said.push(o.text);
      };
      for (const sc of window.__krel.game.scene.getScenes(true)) for (const o of sc.sys.displayList.list) walk(o);
      return { mode: snap.decision.mode, fightShown: snap.controls.filter((c) => c.shown && c.id.startsWith("c-")).map((c) => c.id), pills, said };
    });
    check("a conversation in a fight: SKIP / LOG / AUTO up, no fight button", st.mode === "none" && st.fightShown.length === 0 && st.pills.length >= 3, st);
    check("the dungeon's narrated CONTROLS line names the phone's controls", st.said.some((t) => /drag on the left/.test(t)) && !st.said.some((t) => /WASD/.test(t)), st.said);
    for (let i = 0; i < 12 && !(await ph.ev(() => window.__talkDone)); i++) {
      await ph.tapSel(".kd-skip").catch(() => ph.tapCss(560, 150));
      await sleep(250);
      await ph.tapSel(".kd-sk.show .kd-sk-go").catch(() => 0);
      await sleep(500);
    }
    const back = await ph.until(() => window.__krelMobile.snapshot().decision.mode === "combat", null, 15000, "combat").then(() => true, () => false);
    check("SKIP ends it: the pills go, the fight buttons come back", (await ph.ev(() => window.__talkDone)) && back && !(await ph.ev(() => window.__krelMobile.dialogue.snapshot().showing)));
    // the Phone settings page from the fight's pause menu changes the fight at once
    const fire0 = await ctlOf("c-fire");
    await ph.tapCss(...mid(await ctlOf("pause")));
    await ph.scene("Menu");
    await sleep(900);
    await ph.tapText("PHONE SETTINGS", { scene: "Menu" });
    await sleep(700);
    check("pause in a fight has PHONE SETTINGS, which opens the page", await ph.ev(() => window.__krelMobile.settingsPage.isOpen));
    const tapIn = async (key, word) => {
      const r = await ph.ev(
        ({ key, word }) => {
          const row = document.querySelector(`.kps-row[data-key=${key}]`);
          const b = row && (word ? [...row.querySelectorAll("button")].find((x) => x.textContent.trim() === word) : row.querySelector(".kps-sw") || row);
          if (!b) return null;
          b.scrollIntoView({ block: "center" });
          const q = b.getBoundingClientRect();
          return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
        },
        { key, word },
      );
      if (!r) throw new Error(`no ${key} ${word}`);
      await ph.tapCss(r.x, r.y);
      await sleep(400);
    };
    const af0 = await ph.ev(() => window.__krelMobile.settings.get().autoFire);
    await tapIn("firing", "EASY");
    await tapIn("buttonSize", "L");
    const s1 = await ph.ev(() => window.__krelMobile.settings.get());
    check("the page's Firing (EASY: auto-fire on; HOLD is the default) and button size rows change the settings", af0 === false && s1.autoFire === true && s1.firing === "auto" && s1.buttonSize === "L", { af0, autoFire: s1.autoFire, firing: s1.firing, buttonSize: s1.buttonSize });
    await ph.tapSel(".kps-done");
    await sleep(500);
    await ph.tapText("RESUME", { scene: "Menu" });
    await ph.until(() => window.__krelMobile.snapshot().decision.mode === "combat", null, 20000, "the fight after RESUME");
    await sleep(800);
    const fire1 = await ctlOf("c-fire");
    ts = await hudTexts(ph, ["UI"]);
    check("back in the fight: the bigger buttons at once, and HUD and buttons still fit", fire1.face.w > fire0.face.w + 2 && offGame(ts).length === 0 && (await domSpill(ph, ".kt *")).length === 0, { before: fire0.face.w, after: fire1.face.w });
    await ph.ev(() => window.__krelMobile.settings.set({ buttonSize: "M", autoFire: true, firing: "auto", textSize: "large" }));
    await sleep(1200);
    ts = await hudTexts(ph, ["UI"]);
    mv = await metersVsChips(ph);
    check("text size LARGE in a fight: every HUD text still on the screen, the buttons' words fit, KREZZ / WONK clear of the chips", offGame(ts).length === 0 && (await domSpill(ph, ".kt *")).length === 0 && mv.hit.length === 0, { off: offGame(ts), mv });
    await ph.shot("together-large-text");
    await ph.ev(() => window.__krelMobile.settings.set({ textSize: "normal" }));
    await sleep(300);
    // pause → CONTROLS: the picture, on the fight's tab, its words fit
    await ph.tapCss(...mid(await ctlOf("pause")));
    await ph.scene("Menu");
    await sleep(900);
    await ph.tapText("CONTROLS", { scene: "Menu" });
    await sleep(800);
    const pic = await ph.ev(() => window.__krelMobile.picture.snapshot());
    const spill = await domSpill(ph, ".kcp-row *, .kcp-tab, .kcp-x, .kcp-foot");
    check("pause → CONTROLS in a fight: the picture opens on FIGHTS, and its words fit", pic.open && pic.tab === "fight" && pic.dots >= 6 && spill.length === 0, { pic, spill });
    await ph.tapSel(".kcp-x");
    await sleep(400);
    await ph.tapText("RESUME", { scene: "Menu" });
    await sleep(600);
    // the Krezz Arms brawl: taps swing (no buttons, no keys in its line)
    await runInto(ph, "Pub", "s.intoxication = 80;");
    await ph.scene("Pub");
    await sleep(2500);
    await ph.ev(() => {
      const p = window.__krel.game.scene.getScene("Pub");
      window.__brawlDone = false;
      p.brawl().then(() => (window.__brawlDone = true));
    });
    let hud = null;
    for (let i = 0; i < 40 && !hud; i++) {
      hud = await ph.ev(() => {
        const t = window.__krel.game.scene.getScene("Pub").children.list.find((o) => o.type === "Text" && /^BRAWL!|LAST ONE/.test(o.text));
        return t ? t.text : null;
      });
      if (!hud) {
        await ph.tapCss(420, 200);
        await sleep(700);
      }
    }
    const m = await ph.mode();
    check("the Krezz Arms brawl: its line says Tap (no SPACE), and no buttons cover the room", !!hud && /Tap/.test(hud) && !/SPACE/.test(hud) && m.startsWith("none"), { hud, mode: m });
    const left0 = Number((/(\d) still standing/.exec(hud || "") || [0, 4])[1]);
    for (let i = 0; i < 16; i++) {
      await ph.tapCss(300 + (i % 4) * 90, 250);
      await sleep(150);
    }
    const hud2 = await ph.ev(() => {
      const t = window.__krel.game.scene.getScene("Pub").children.list.find((o) => o.type === "Text" && /^BRAWL!|LAST ONE/.test(o.text));
      return t ? t.text : "(gone)";
    });
    const left1 = /LAST ONE|gone/.test(hud2) ? 0 : Number((/(\d) still standing/.exec(hud2) || [0, 9])[1]);
    check("taps anywhere swing: the crowd goes down", left1 < left0, { hud, hud2 });
    // a boss fight with the bigger text: the boss's name and bar clear of the KREZZ / WONK lines
    check("a boss fight (Krandall) reached", await toFight(ph, "wildern", 3, 2), await ph.mode());
    await sleep(1500);
    for (const size of ["normal", "large"]) {
      await ph.ev((size) => window.__krelMobile.settings.set({ textSize: size }), size);
      await sleep(900);
      const bb = await ph.ev(() => {
        const ui = window.__krel.game.scene.getScene("UI");
        const r = (o) => {
          const b = o.getBounds();
          return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) };
        };
        return { boss: !!ui.boss, kz: r(ui.kzT), name: ui.bossT.visible ? r(ui.bossT) : null, bar: ui.phoneBossBar() };
      });
      const meet = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
      const bar = { x: bb.bar.x, y: bb.bar.y, r: bb.bar.x + bb.bar.w, b: bb.bar.y + 16 };
      check(`boss fight, text size ${size}: the boss's name and bar clear of the KREZZ / WONK lines`, bb.boss && !meet(bb.kz, bar) && !meet(bb.kz, bb.name), bb);
    }
    await ph.ev(() => window.__krelMobile.settings.set({ textSize: "normal" }));
    await ph.shot("together-boss");
    check("no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ review round 1 (stage 2): the fixes, end to end

async function review1(browser) {
  console.log("REVIEW1 (stage 2 review fixes: FIRE after a fight, the archive's way out, a resting controller, the brawl's pause, the Kreltality prompt)");
  const { ctx, page, ph, errors } = await phoneAtTitle(browser);
  const T = () =>
    ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { attack: T.attack, enabled: T.enabled };
    });
  try {
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    // ---- R1: FIRE held through the end of a fight, let go afterwards: no held attack left behind
    const ok = await toFight(ph, "wildern", 0, 2);
    check("review1: into a top-down fight", ok, await ph.mode());
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: false }));
    await sleep(400);
    const fire = (await ph.snap()).controls.find((c) => c.id === "c-fire");
    await ph.touch("touchStart", [{ x: fire.face.x + fire.face.w / 2, y: fire.face.y + fire.face.h / 2, id: 7 }]);
    await sleep(400);
    const held = await T();
    await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const s = window.__krel.G.s;
      // (no fairy to bring you back: a real death)
      if (s.upgrades) s.upgrades.fairies = 0;
      s.flags.debug_mode = false;
      s.hp = 0;
      d.die();
    });
    // (the death plays out, then the KREZZED menu: the thumb is still on FIRE all along)
    await ph.until(() => window.__krel.active().includes("Menu"), null, 30000, "the KREZZED menu").catch(() => 0);
    await sleep(800);
    const ended = await ph.mode();
    await ph.touch("touchEnd", []);
    await sleep(1500);
    const after = await T();
    check("R1: FIRE let go after the fight ended leaves no held attack (town would punch Mikey)", held.attack && !ended.startsWith("combat") && !after.attack, { held, ended, after, mode: await ph.mode() });
    await ph.ev(() => window.__krelMobile.settings.set({ autoFire: true }));
    // ---- R2: a controller resting off-centre (triggers at -1) never hides the touch controls
    await toWalk(ph, "Home");
    await ph.ev(() => {
      const pad = { id: "generic", connected: true, mapping: "", buttons: Array.from({ length: 12 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0, -1, -1] };
      window.__fakePad = pad;
      navigator.getGamepads = () => [window.__fakePad];
    });
    await sleep(900);
    const rest = await ph.ev(() => ({ padin: document.querySelector(".kt").classList.contains("padin"), handovers: window.__krelMobile.pad.handovers }));
    await ph.ev(() => (window.__fakePad.buttons[0] = { pressed: true, value: 1 }));
    await sleep(400);
    const pressed = await ph.ev(() => document.querySelector(".kt").classList.contains("padin"));
    await ph.ev(() => (window.__fakePad.buttons[0] = { pressed: false, value: 0 }));
    await ph.tapCss(600, 120);
    await sleep(600);
    const back = await ph.ev(() => document.querySelector(".kt").classList.contains("padin"));
    check("R2: a pad resting off-centre doesn't take over; a button press does; a touch brings the controls back for good", !rest.padin && pressed && !back, { rest, pressed, back });
    await ph.ev(() => (navigator.getGamepads = () => []));
    // ---- P1: the Historical Archive's phone list has a way out (and Back leaves too)
    await ph.ev(() => {
      const k = window.__krel;
      for (let i = 0; i < 20; i++) k.G.s.flags[`fake_${i}`] = true;
      k.go("Archive", { returnAt: "ARCHIVE" });
    });
    await ph.scene("Archive");
    await sleep(1500);
    const L = await ph.ev(() => window.__krelMobile.lists.open());
    const leaveBtn = await ph.ev(() => !!document.querySelector('.pl.show [data-id="archive-leave"]'));
    if (L && L.name === "archive" && leaveBtn) {
      await ph.tapSel('.pl.show [data-id="archive-leave"]');
      await ph.until(() => !window.__krel.active().includes("Archive"), null, 15000, "leave the archive").catch(() => 0);
    }
    const gone = !(await ph.active()).includes("Archive");
    check("P1: the archive's record list has ◀ LEAVE on it, and it leaves (or the list isn't there and the game's own LEAVE shows)", (L && L.name === "archive" ? leaveBtn : true) && gone, { list: L && L.name, leaveBtn, active: await ph.active() });
    // ---- F9: the finale brawl has II: the carry-on card with SKIP FIGHT
    await ph.ev(() => {
      const k = window.__krel;
      k.newRun("FLENKY");
      k.setChapter(7, { ch1_home: true, home_seen: true, flyover_seen: true });
      k.go("Finale", { beat: "brawl" });
    });
    await ph.scene("Finale");
    let on = false;
    for (let i = 0; i < 90 && !on; i++) {
      const b = await ph.ev(() => window.__krelMobile.brawl.snapshot()).catch(() => ({ active: false }));
      on = b.active && !b.finishing && (await ph.mode()).startsWith("brawl") && !(await ph.active()).includes("Dialogue");
      if (!on) {
        await ph.tapCss(420, 150);
        await sleep(900);
      }
    }
    const bp = (await ph.snap()).controls.find((c) => c.id === "b-pause");
    if (bp && bp.shown) {
      await ph.tapCss(bp.face.x + bp.face.w / 2, bp.face.y + bp.face.h / 2);
      await sleep(600);
    }
    const card = await ph.ev(() => ({ card: !!window.__krelMobile.shellState().card, skip: document.querySelector(".kres-x.on")?.textContent ?? null }));
    if (card.skip) {
      await ph.tapSel(".kres-x.on");
      await ph.until(() => !window.__krel.active().includes("Finale"), null, 20000, "the brawl to be skipped").catch(() => 0);
    }
    check("F9: the finale brawl shows II; it pauses (carry-on card) and offers SKIP FIGHT, which skips it as Esc does on a laptop", on && !!bp?.shown && card.card && /SKIP FIGHT/.test(card.skip ?? "") && !(await ph.active()).includes("Finale"), { on, bp: !!bp?.shown, card, active: await ph.active() });
    // ---- P2: a pit, the thumb still pushing toward it: put back clear of the edge, and the stick waits
    const sideOk = await toFight(ph, "arena_sanmik", 1, 5, "FLENKY", "side:Dungeon");
    const pit = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      for (const e of d.enemies) if (!e.dead) e.setPosition(-5000, -5000);
      const g = (d.sideLevel?.gaps ?? []).slice().sort((a, b) => a[0] - b[0])[0];
      if (!g) return null;
      d.player.spr.setPosition(g[0] - 70, d.groundY - 60);
      d.player.spr.body.setVelocity(0, 0);
      return { a: g[0], b: g[1] };
    });
    await sleep(700);
    const pits0 = (await ph.ev(() => window.__krelMobile.combat.side.snapshot())).pits ?? 0;
    // the thumb lands in the stick zone and pushes right, and stays there (the fall comes within a second)
    await ph.touch("touchStart", [{ x: 150, y: 300, id: 3 }]);
    for (let i = 1; i <= 6; i++) {
      await ph.touch("touchMove", [{ x: 150 + i * 10, y: 300, id: 3 }]);
      await sleep(30);
    }
    await sleep(2600);
    const mid = await ph.ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      return { x: Math.round(d.player.x), side: window.__krelMobile.combat.side.snapshot() };
    });
    await ph.touch("touchEnd", []);
    const falls = (mid.side.pits ?? 0) - pits0;
    check("P2: a pit with the stick still held toward it: one fall, put back at least 120 px short of the edge, and the held stick doesn't walk you straight back in", sideOk && !!pit && falls >= 1 && falls <= 1 && mid.x <= pit.a - 100, { sideOk, pit, falls, x: mid.x, lock: mid.side.pitLock });
    check("review1: no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ polish (stage 2 polish: a calm fight screen)

/**
 * Everything the phone draws over a fight, measured in the page (CSS px): every shown control's face, any caption
 * under it, the words inside the faces, the stick, and the HUD's canvas texts (name, coins, bars' numbers, the room
 * name, the boss's name, the chips line).
 */
function measureScreen(ph) {
  return ph.ev(() => {
    const box = (r) => ({ x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
    const seen = (e) => {
      if (!e) return null;
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (cs.display === "none" || cs.visibility === "hidden" || r.width < 1 || r.height < 1) return null;
      for (let p = e; p && p !== document.body; p = p.parentElement) if (+getComputedStyle(p).opacity < 0.05) return null;
      return box(r);
    };
    const controls = [];
    const caps = [];
    const words = [];
    for (const b of document.querySelectorAll(".kt .kt-btn.show")) {
      const id = b.dataset.ctl;
      const face = seen(b.querySelector(".kt-face"));
      if (!face) continue;
      controls.push({ id, face, see: b.classList.contains("see") });
      const cap = b.querySelector(".kt-bcap");
      const cr = cap && cap.textContent ? seen(cap) : null;
      if (cr) caps.push({ id, text: cap.textContent, r: cr });
      for (const w of b.querySelectorAll(".kt-in")) {
        const wr = seen(w);
        if (wr) words.push({ id, text: w.textContent, r: wr, face });
      }
    }
    const st = document.querySelector(".kt-stick");
    const stick = st && +getComputedStyle(st).opacity > 0.05;
    // the HUD's canvas texts, in CSS px
    const hud = [];
    const cv = document.querySelector("canvas").getBoundingClientRect();
    const k = cv.width / 960;
    const ui = window.__krel.game.scene.getScene("UI");
    if (ui && ui.sys.isActive())
      for (const n of ["nameT", "coinT", "coinIco", "hpT", "kzT", "statT", "roomT", "bossT"]) {
        const o = ui[n];
        if (!o || !o.visible || !o.active || (o.type === "Text" && !o.text)) continue;
        const b = o.getBounds();
        if (b.width < 1) continue;
        hud.push({ id: n, text: o.type === "Text" ? o.text.slice(0, 80) : "", r: { x: cv.x + b.x * k, y: cv.y + b.y * k, w: b.width * k, h: b.height * k } });
      }
    return { vp: { w: innerWidth, h: innerHeight }, controls, caps, words, stick, hud };
  });
}

const overlap = (a, b, pad = 0) => a.x < b.x + b.w - pad && b.x < a.x + a.w - pad && a.y < b.y + b.h - pad && b.y < a.y + a.h - pad;
const inside = (a, b, pad = 1) => a.x >= b.x - pad && a.y >= b.y - pad && a.x + a.w <= b.x + b.w + pad && a.y + a.h <= b.y + b.h + pad;

/** No caption over another caption, a control, or the HUD; words inside their own faces; no two faces on each other. */
function collisions(m) {
  const out = [];
  for (const c of m.caps) {
    for (const o of m.controls) if (o.id !== c.id && overlap(c.r, o.face)) out.push(`caption ${c.id}:${c.text} on ${o.id}`);
    for (const o of m.caps) if (o !== c && overlap(c.r, o.r)) out.push(`caption ${c.id} on caption ${o.id}`);
    for (const h of m.hud) if (overlap(c.r, h.r)) out.push(`caption ${c.id} on HUD ${h.id}`);
    if (c.r.y + c.r.h > m.vp.h || c.r.x < 0 || c.r.x + c.r.w > m.vp.w) out.push(`caption ${c.id} off screen`);
  }
  for (const w of m.words) {
    if (!inside(w.r, w.face)) out.push(`word ${w.id}:${w.text} outside its button`);
    for (const o of m.controls) if (o.id !== w.id && overlap(w.r, o.face)) out.push(`word ${w.id} on ${o.id}`);
  }
  for (let i = 0; i < m.controls.length; i++)
    for (let j = i + 1; j < m.controls.length; j++) if (overlap(m.controls[i].face, m.controls[j].face, 1)) out.push(`${m.controls[i].id} on ${m.controls[j].id}`);
  return out;
}

/** The room name must not run over the player's name, the coins, the meters or the chips (N2). */
function roomNameClash(m) {
  const rn = m.hud.find((h) => h.id === "roomT");
  if (!rn) return [];
  const out = [];
  for (const h of m.hud) if (h.id !== "roomT" && ["nameT", "coinT", "coinIco", "kzT", "hpT"].includes(h.id) && overlap(rn.r, h.r, 0.5)) out.push(`room name on ${h.id}`);
  for (const c of m.controls) if (overlap(rn.r, c.face, 0.5)) out.push(`room name on ${c.id}`);
  return out;
}

async function polish(browser) {
  console.log("POLISH (a calm fight screen: what shows when, captions that never collide, the room name, Leave, JUMP)");
  const profiles = [
    { tag: "iphone", profile: IPHONE, insets: { top: 0, right: 47, bottom: 21, left: 47 } },
    { tag: "android", profile: { ...ANDROID, userAgent: UA.androidChrome }, insets: null },
    // (the other two sizes: only the busiest screens, for the no-overlap measure)
    { tag: "safari-bars", profile: { ...IPHONE, viewport: { width: 750, height: 340 } }, insets: null, light: true },
    { tag: "bigphone", profile: { ...IPHONE, viewport: { width: 932, height: 430 } }, insets: { top: 0, right: 59, bottom: 21, left: 59 }, light: true },
  ];
  for (const pr of profiles) {
    const { ctx, page, ph, errors } = await phoneAtTitle(browser, pr.profile);
    const where = `${pr.tag} ${pr.profile.viewport.width}x${pr.profile.viewport.height}`;
    // (the light sizes: no screenshots, only the measure)
    const shot = (n) => (pr.light ? null : ph.shot(n));
    const counts = {};
    const look = async (name, opts = {}) => {
      await sleep(opts.wait ?? 900);
      const m = await measureScreen(ph);
      const snap = await ph.ev(() => (window.__krelMobile.combat ? window.__krelMobile.combat.snapshot() : null)).catch(() => null);
      const ids = m.controls.map((c) => c.id);
      counts[name] = { n: ids.length + (m.stick ? 1 : 0), ids: [...ids, ...(m.stick ? ["stick"] : [])], caps: m.caps.map((c) => `${c.id}:${c.text}`), words: m.words.map((w) => `${w.id}:${w.text}`) };
      const col = collisions(m);
      check(`polish ${where} ${name}: no caption or word over another caption, a button or the HUD, no button on another`, col.length === 0, col.length ? col.slice(0, 8) : counts[name]);
      await shot(`${pr.tag}-${name}`);
      return { m, snap, ids };
    };
    try {
      if (pr.insets) await ph.ev((i) => window.__krelMobile.setInsets(i), pr.insets);
      // ---- 1. a fresh top-down room with the chapter 1 kit (first fights: the words are being taught)
      await ph.ev(() => window.__krelMobile.combat.resetTeaching());
      // (room 2 of the first dungeon: room 1 opens with the how-to card the first time through)
      const ok1 = await toFight(ph, "wildern", 1, 1, "FLENKY");
      if (!pr.light) {
        // (a new game's own kit: 40 Krezz, 2 juice, 1 bongo, no gun yet but the Fart Blaster; full health; the room's
        // enemies held off for the look, so nothing hurts the player before it's measured)
        const calmRoom = (kit) =>
          ph.ev(async (kit) => {
            const st = await import("/src/game/systems/stats.ts");
            const k = window.__krel;
            const s = k.G.s;
            const d = k.game.scene.getScene("Dungeon");
            for (const e of d.enemies) if (!e.dead && !e.isBoss) e.setPosition(-5000, -5000);
            Object.assign(s, kit);
            s.guns = {};
            s.gun = null;
            k.G.rt.fart = 0;
            if (d.player) {
              d.player.wonk = 0;
              // (nothing lands on the player while it's looked at: a stray shot would bring the juice chip up)
              d.player.iframesUntil = d.now() + 6000;
            }
            s.hp = st.maxHp(s);
          }, kit);
        await calmRoom({ krezz: 40, bottles: 2, bongos: 1 });
        const fresh = await look("room-fresh");
        const sp = fresh.snap && fresh.snap.specialReady;
        check(`polish ${where}: a fresh room reached (chapter 1 kit)`, ok1, await ph.mode());
        check(
          `polish ${where} fresh room: only what a thumb can use now (no READY, HEAL, juice at full health, SPECIAL only when it can go)`,
          !fresh.ids.includes("c-ready") && !fresh.ids.includes("c-heal") && fresh.ids.includes("c-fire") && fresh.ids.includes("c-dodge") && fresh.ids.includes("pause") && fresh.ids.includes("c-special") === !!sp,
          counts["room-fresh"],
        );
        // ---- 1b. the same room with nothing left to use (Krezz spent, no bongo): the calmest a fight gets
        await calmRoom({ krezz: 0, bottles: 2, bongos: 0 });
        const calm = await look("room-calm");
        const hpNow = await ph.ev(async () => {
          const s = window.__krel.G.s;
          return [s.hp, (await import("/src/game/systems/stats.ts")).maxHp(s), s.bottles];
        });
        check(`polish ${where} calm room: just the stick, FIRE, DODGE, the gun and pause`, ["pause", "c-fire", "c-dodge", "c-chip"].every((id) => calm.ids.includes(id)) && calm.ids.length === 4, { ...counts["room-calm"], hpNow });
      }
      // ---- 2. mid-game: a second gun, Krezz full, WONK full, beans, bongos, hurt with juice to drink
      await ph.ev(async () => {
        const k = window.__krel;
        const s = k.G.s;
        const d = k.game.scene.getScene("Dungeon");
        const st = await import("/src/game/systems/stats.ts");
        s.krezz = st.maxKrezz(s);
        s.bongos = 2;
        s.bottles = Math.max(2, s.bottles);
        s.hp = Math.round(st.maxHp(s) * 0.3);
        k.G.rt.fart = 55;
        if (d && d.player) d.player.wonk = 100;
        s.guns = s.guns || {};
        const g = await import("/src/game/combat/Guns.ts");
        // (a second gun with ammo besides whatever the kit has, so SWAP has something to swap)
        for (const id of Object.keys(g.GUNS).filter((id) => id !== "chem_flamer").slice(0, 2)) s.guns[id] = Math.max(5, s.guns[id] ?? 0);
      });
      const midRoom = await look("room-mid", { wait: 1500 });
      // the pocket (thumb-feel round, the user: "the specials, when they do activate, are tiny to press"): 💨 and 🍺 are
      // full-size buttons on the right thumb's side (60 px drawn at 844x390, never under 52; 44 px+ to touch), and
      // HEAL (30% health) is the red one; nothing in the top-left corner any more
      const pk = await ph.ev(() => {
        const vw = innerWidth;
        return window.__krelMobile.snapshot().controls.filter((c) => c.shown && /^c-(bongo|fart|heal|sanmik)$/.test(c.id)).map((c) => ({ id: c.id, w: Math.round(c.face.w), h: Math.round(c.face.h), hw: Math.round(c.hit.w), hh: Math.round(c.hit.h), right: c.face.x + c.face.w / 2 > vw / 2 }));
      });
      const heal = await ph.ev(() => !!document.querySelector('.kt-btn.show.low[data-ctl="c-heal"]'));
      const big = pr.profile.viewport.width === 844 ? 59.5 : 51.5;
      check(`polish ${where} mid-game: 💨, 🍺 and HEAL are full-size buttons on the right (drawn ${big > 55 ? 60 : 52}+ px, 44+ px to touch), HEAL red when low`, ["c-bongo", "c-fart", "c-heal"].every((id) => pk.some((c) => c.id === id)) && pk.every((c) => c.right && Math.min(c.w, c.h) >= (c.id === "c-heal" ? 51.5 : big) && Math.min(c.hw, c.hh) >= 44) && heal, { pk, heal, ids: midRoom.ids });
      // the longest pocket word (CABBAGE, fart level 3) stays inside its round button at every size (the recheck saw it
      // clipped to "ABBAG" at 750x340; forced here so the check never depends on how far the meter got)
      const cab = await ph.ev(async () => {
        window.__krel.G.rt.fart = 80;
        await new Promise((r) => setTimeout(r, 300));
        const f = document.querySelector('.kt-btn.show[data-ctl="c-fart"] .kt-face');
        const w = f && f.querySelector(".kt-in");
        if (!w) return null;
        const a = f.getBoundingClientRect(), b = w.getBoundingClientRect();
        return { text: w.textContent, face: Math.round(a.width), word: Math.round(b.width), inside: b.left >= a.left + 2 && b.right <= a.right - 2 };
      });
      check(`polish ${where} mid-game: the longest 💨 word (CABBAGE) sits inside its button`, !!cab && cab.text === "CABBAGE" && cab.inside, cab);
      // ---- 3. a boss (Krandall)
      if (!pr.light) {
        const ok3 = await toFight(ph, "wildern", 3, 2);
        check(`polish ${where}: a boss fight reached`, ok3, await ph.mode());
        const boss = await look("boss");
        check(`polish ${where} boss: nothing for an ability that can't go (no READY with nothing ready, no SPECIAL without its Krezz)`, !boss.ids.includes("c-ready") === !(boss.snap && boss.snap.ready) && boss.ids.includes("c-special") === !!(boss.snap && boss.snap.specialReady), counts.boss);
      }
      // ---- 4. a side room's start (Catford High Street: the first pit sits under the cluster)
      await ph.ev(() => window.__krelMobile.combat.resetTeaching());
      const ok4 = await toFight(ph, "arena_sanmik", 1, 5, "FLENKY", "side:Dungeon");
      check(`polish ${where}: a side room reached`, ok4, await ph.mode());
      await ph.ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        for (const e of d.enemies) if (!e.dead) e.setPosition(-5000, -5000);
      });
      const side = await look("side-start");
      const jump = await ph.ev(() => {
        const b = document.querySelector('.kt-btn[data-ctl="c-jump"]');
        if (!b) return null;
        const f = b.querySelector(".kt-face");
        const cs = getComputedStyle(f);
        const bc = cs.borderTopColor.match(/[\d.]+/g).map(Number);
        const bg = cs.backgroundColor.match(/[\d.]+/g).map(Number);
        const svg = f.querySelector("svg");
        return { see: b.classList.contains("see"), opacity: +cs.opacity, border: bc.length > 3 ? bc[3] : 1, borderW: parseFloat(cs.borderTopWidth), bg: bg.length > 3 ? bg[3] : 1, icon: !!svg && svg.getBoundingClientRect().width > 10 };
      });
      check(`polish ${where} side start: JUMP is plain to see (a solid outline and its icon) even see-through over the pit, the pit still shows through`, jump && jump.icon && jump.opacity >= 0.9 && jump.border >= 0.6 && jump.borderW >= 2.5 && (!jump.see || jump.bg <= 0.1), jump);
      if (!pr.light) {
        // the room name (N2): the Job Centre's line, the longest a side room has (the gate saw it run over the name)
        const rn = await ph.ev(() => {
          const ui = window.__krel.game.scene.getScene("UI");
          ui.roomT.setText("THE SANMIKVERSE (CATFORD, ALLEGEDLY) · Job Centre Plus (Catford Branch)");
          return true;
        });
        await sleep(600);
        const mr = await measureScreen(ph);
        const clash = roomNameClash(mr);
        check(`polish ${where} side room: a long room name never runs over the name, coins, meters or the chips (N2)`, rn && clash.length === 0, clash.length ? clash : mr.hud.find((h) => h.id === "roomT") || "hidden");
        await shot(`${pr.tag}-side-roomname`);
      }
      // ---- 5. the finale brawl
      await ph.ev(() => {
        const k = window.__krel;
        k.newRun("FLENKY");
        k.setChapter(7, { ch1_home: true, home_seen: true, flyover_seen: true });
        k.go("Finale", { beat: "brawl" });
      });
      await ph.scene("Finale");
      let on = false;
      for (let i = 0; i < 90 && !on; i++) {
        const b = await ph.ev(() => window.__krelMobile.brawl.snapshot()).catch(() => ({ active: false }));
        on = b.active && (await ph.mode()).startsWith("brawl") && !(await ph.active()).includes("Dialogue");
        if (!on) {
          await ph.tapCss(420, 150);
          await sleep(900);
        }
      }
      check(`polish ${where}: the finale brawl reached`, on, await ph.mode());
      await look("brawl");
      // ---- 6. the Krezz Arms: its Leave card clear of the bottom 21 px (N4)
      if (!pr.light) {
        await runInto(ph, "Pub", "s.coins = 900;");
        await ph.scene("Pub", 90000);
        await sleep(2500);
        const leave = await ph.ev(() => {
          const p = window.__krel.game.scene.getScene("Pub");
          const cv = document.querySelector("canvas").getBoundingClientRect();
          const k = cv.width / 960;
          let found = null;
          const walk = (o, ox, oy) => {
            if (found) return;
            if (o.type === "Container") {
              if (o.list.some((c) => c.type === "Text" && c.text === "Leave")) {
                const hit = o.list.find((c) => c.input && c.input.enabled);
                if (hit) {
                  const ha = hit.input.hitArea;
                  found = { top: cv.y + (oy + o.y + hit.y + ha.y) * k, bottom: cv.y + (oy + o.y + hit.y + ha.y + ha.height) * k, drawBottom: cv.y + (oy + o.y + hit.y + hit.height) * k };
                }
                return;
              }
              for (const c of o.list) walk(c, ox + o.x, oy + o.y);
            }
          };
          for (const o of p.children.list) walk(o, 0, 0);
          return found;
        });
        await shot(`${pr.tag}-pub`);
        const strip = pr.profile.viewport.height - 21;
        check(`polish ${where} Krezz Arms: the Leave card (drawing and touch area) ends above the bottom 21 px (N4)`, leave && leave.bottom <= strip + 0.5 && leave.drawBottom <= strip + 0.5, { leave, strip });
      }
      console.log(`  counts ${where}: ${JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, `${v.n}: ${v.ids.join(" ")}`])))}`);
      check(`polish ${where}: no page errors`, errors.length === 0, errors.slice(0, 3));
    } finally {
      await ctx.close();
    }
  }
}

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
      // (still held: on a busy machine the title can take a moment longer to build after the fade)
      await ph.until(() => window.__krel.active().includes("Title"), null, 4000, "the title").catch(() => 0);
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
      ["lists", lists],
      ["wording", wording],
      ["guide", guide],
      ["optout", optout],
      ["town", town],
      ["dungeon", dungeon],
      ["combat", combat],
      ["side", sideRooms],
      ["brawl", brawl],
      ["together", together],
      ["review1", review1],
      ["polish", polish],
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
