#!/usr/bin/env node
// The Job Centre staff toilet (chapter 5, the SanMikverse): SanChz and the jam donut. Needs a running dev server.
//
//   node scripts/donut-check.cjs --url http://localhost:5682/ [--profile laptop|iphone|android] [--shots dir] [--k 2]
//
// Checks, in the room "Job Centre Plus (Catford Branch)" reached through DebugSkip:
//  - the STAFF TOILET opens mid-fight (enemies alive, waves still to come): no "clear the Job Centre first";
//  - the cutscene plays over the frozen room (the room is paused, enemies don't move, the player takes no damage),
//    with its art (the toilet, SanChz, the moaning frame), and every line of the scene, word for word;
//  - it finishes: the room is back, the flag is set, a short grace period (nothing hurts you), the exit stays shut
//    until the waves are done, then opens;
//  - a second visit: "We don't talk about it." (the room's ordinary conversation, no cutscene).
// On a phone profile (iPhone 14 landscape with its insets, or a small Android) the toilet is opened with the ACTION
// button and the lines are tapped along; the art fills the game frame and the box stays below the important part.
// Exit 0 = all passed.
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const URL0 = arg("--url", "http://localhost:5682/");
const PROFILE = arg("--profile", "laptop");
const SHOTS = arg("--shots", "");
const K = +arg("--k", "1");
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const AND_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const PROFILES = {
  laptop: { viewport: { width: 960, height: 540 }, deviceScaleFactor: K, hasTouch: false, isMobile: false },
  iphone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: K > 1 ? K : 3, isMobile: true, hasTouch: true, userAgent: IOS_UA },
  android: { viewport: { width: 740, height: 360 }, deviceScaleFactor: K > 1 ? K : 2, isMobile: true, hasTouch: true, userAgent: AND_UA },
};
const prof = PROFILES[PROFILE];
const phone = PROFILE !== "laptop";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, d) => {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${n} ${d !== undefined ? JSON.stringify(d) : ""}`);
};
const LINES = [
  "You push the door. It isn't locked. It was never locked. Some part of him wanted to be found.",
  "The Job Centre staff toilet has been transformed. Tealights on the cistern. Rose petals in the sink. A small speaker playing slow jams.",
  "And there is SanChz. And there, cradled tenderly in both of his hands, is a jam donut.",
  "…",
  "Yeghhhh! You fucking CUNTS! Fuck you J.Q. ! Erotic weekend in stockport",
  "It looks like you've got your cock in a jam donut, mate.",
  "…It's exactly what it looks like.",
  "The donut moans in pleasure",
  "(bursting in) YEEE — oh. Oh SanChz. Not again. Not in the Job Centre.",
  "YEGHHH. Love shagging jam donuts!!",
  null, // Gabor (goat-speak of his line)
  "Outside, the whole Job Centre shakes. Something enormous is rolling across the car park, screaming a name.",
  "…SanChz. Whose donut is that.",
];

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const ctx = await browser.newContext(prof);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("krelworld.phone.homeScreenGuide", "seen");
      localStorage.setItem("alt:krelworld.phone.homeScreenGuide", "seen");
    } catch (e) {}
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  const cdp = phone ? await ctx.newCDPSession(page) : null;
  const ev = (f, a) => page.evaluate(f, a);
  const active = () => ev(() => window.__krel.active()).catch(() => []);
  const until = async (f, a, ms = 240000, what = "") => {
    const t0 = Date.now();
    while (!(await ev(f, a).catch(() => false))) {
      if (Date.now() - t0 > ms) throw new Error("timeout " + (what || f) + " active=" + (await active()).join(","));
      await sleep(250);
    }
  };
  const tapCss = async (x, y) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await sleep(60);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const vp = prof.viewport;
  // advance a conversation: a tap (phone) or Space (laptop) somewhere harmless
  const advance = async () => (phone ? tapCss(vp.width * 0.55, vp.height * 0.3) : page.keyboard.press("Space"));
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/donut-${PROFILE}-${name}.png` });
  try {
    await page.goto(URL0, { waitUntil: "domcontentloaded" });
    await until(() => !!window.__krel && window.__krel.active().includes("Enter"), null, 240000, "the Enter gate");
    await sleep(1200);
    if (phone) await tapCss(vp.width / 2, vp.height * 0.75);
    else await page.keyboard.press("Enter");
    await until(() => window.__krel.active().includes("Title"), null, 120000, "the title");
    if (phone) await ev(() => window.__krelMobile.setInsets(window.__krelMobile && navigator.userAgent.includes("iPhone") ? { top: 0, right: 47, bottom: 21, left: 47 } : null));
    const room = await ev(async () => (await import("/src/data/dungeons.ts")).DUNGEONS.arena_sanmik.rooms.findIndex((r) => r.name.startsWith("Job Centre Plus")));
    check("the Job Centre room is in the SanMikverse dungeon", room >= 0, room);
    await ev(({ room }) => {
      const k = window.__krel;
      k.newRun("FLENKY");
      k.setChapter(5, { ch1_home: true, home_seen: true, flyover_seen: true, tut_dungeon: true });
      k.go("DebugSkip");
      window.__fightTo = { dungeon: "arena_sanmik", room, ch: 5 };
    }, { room });
    await until(() => window.__krel.active().includes("DebugSkip"));
    await sleep(800);
    await ev(() => {
      const t = window.__fightTo;
      window.__krel.game.scene.getScene("DebugSkip").goBoss({ boss: "x", dungeon: t.dungeon, room: t.room, ch: t.ch });
    });
    // the entry swoop / title card and the room's opening lines: tap / Space along until the fight is on
    for (let i = 0; i < 240; i++) {
      const st = await ev(() => {
        const g = window.__krel.game;
        const d = g.scene.getScene("Dungeon");
        const on = g.scene.isActive("Dungeon") && !g.scene.isPaused("Dungeon") && !g.scene.isActive("Dialogue");
        return { on, busy: !!(d && d.busy), alive: d && d.enemies ? d.enemies.filter((e) => !e.dead).length : 0 };
      }).catch(() => ({}));
      if (st.on && !st.busy && st.alive > 0) break;
      if (phone) await tapCss(vp.width * 0.55, vp.height * 0.3);
      else await page.keyboard.press(i % 3 === 0 ? "Enter" : "Space");
      await sleep(700);
    }
    // nobody dies in this test
    await ev(() => {
      const s = window.__krel.G.s;
      s.hp = 9999;
    });
    const before = await ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      return { room: d.room.name, cleared: d.roomCleared, alive: d.enemies.filter((e) => !e.dead).length, waveIdx: d.waveIdx, waves: d.waves.length, flag: !!window.__krel.G.s.flags.sm_donut, door: d.door.texture.key, side: !!d.side };
    });
    check("in the Job Centre, mid-fight (enemies up, the room not cleared)", before.room.startsWith("Job Centre Plus") && !before.cleared && before.alive > 0 && !before.flag, before);
    // walk up to the toilet (a teleport next to it) and use it
    await ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const it = d.interactables.find((i) => /STAFF TOILET/.test(i.label));
      d.player.spr.setPosition(it.x - 20, d.side ? d.groundY - 40 : it.y);
      d.player.spr.body.setVelocity(0, 0);
    });
    await sleep(600);
    const prompt = await ev(() => window.__krel.game.scene.getScene("Dungeon").prompt.text);
    check("next to the door the prompt offers the toilet", /STAFF TOILET/.test(prompt), prompt);
    if (phone) {
      // the ACTION button (stage 1's verb from the prompt)
      const ctl = await ev(() => {
        const c = window.__krelMobile.snapshot().controls.find((c) => c.id === "c-action" && c.shown);
        return c ? c.face : null;
      });
      check("the phone shows the ACTION button for it", !!ctl, ctl);
      if (ctl) await tapCss(ctl.x + ctl.w / 2, ctl.y + ctl.h / 2);
      else await ev(() => window.__krel.game.scene.getScene("Dungeon").interactables.find((i) => /STAFF TOILET/.test(i.label)).use());
    } else {
      await page.keyboard.down("e");
      await sleep(120);
      await page.keyboard.up("e");
    }
    await until(() => window.__krel.game.scene.isActive("DonutToilet"), null, 60000, "the toilet cutscene");
    check("the toilet opens mid-fight (no 'clear the Job Centre first')", true);
    // the art loaded; the room frozen under it
    await until(() => {
      const t = window.__krel.game.textures;
      return t.exists("dn_toilet") && t.exists("dn_chz") && t.exists("dn_chz_moan");
    }, null, 60000, "the art");
    const frozen0 = await ev(() => {
      const g = window.__krel.game;
      const d = g.scene.getScene("Dungeon");
      return { paused: g.scene.isPaused("Dungeon"), pos: d.enemies.filter((e) => !e.dead).map((e) => [Math.round(e.x), Math.round(e.y)]), hp: window.__krel.G.s.hp };
    });
    check("the room is paused under the cutscene", frozen0.paused, frozen0.paused);
    if (phone) {
      await sleep(1500);
      const m = await ev(() => {
        const s = window.__krelMobile.snapshot();
        return { mode: s.decision.mode, scene: s.decision.scene, shown: s.controls.filter((c) => c.shown).map((c) => c.id) };
      });
      check("phone: no game controls over the cutscene (touch mode none; the box's own pills only)", m.mode === "none" && m.shown.filter((id) => /^c-/.test(id)).length === 0, m);
    }
    // the moment the room comes back (before its next frame): how long the grace is, and a hit inside it
    await ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      d.events.once("resume", () =>
        setTimeout(() => {
          const hp0 = window.__krel.G.s.hp;
          const grace = d.graceUntil - d.now();
          d.damagePlayer(20, undefined, { unblockable: true });
          window.__dnBack = { grace, hp0, hp1: window.__krel.G.s.hp };
        }, 0),
      );
      window.__krel.game.scene.getScene("DonutToilet").events.once("shutdown", (sc) => (window.__dnShown = [...window.__krel.game.scene.getScene("DonutToilet").shown]));
    });
    // read the lines as they come, tapping along; screenshots at the reveal, the moan and the burst
    const seen = [];
    const want = { 2: "reveal", 7: "moan", 9: "love" };
    for (let i = 0; i < 200; i++) {
      const st = await ev(() => {
        const g = window.__krel.game;
        if (!g.scene.isActive("DonutToilet")) return { done: true };
        const sc = g.scene.getScene("DonutToilet");
        const box = sc.children.list.find((o) => o.type === "Container" && o.depth === 1000);
        const texts = box ? box.list.filter((o) => o.type === "Text").map((o) => o.text) : [];
        const chz = sc.children.list.find((o) => o.texture && /^dn_chz/.test(o.texture.key));
        return { done: false, texts, chz: chz ? { key: chz.texture.key, vis: chz.visible, x: Math.round(chz.x), y: Math.round(chz.y), top: Math.round(chz.getBounds().top), h: Math.round(chz.displayHeight) } : null };
      });
      if (st.done) break;
      if (process.env.DN_DEBUG) console.log("   texts", JSON.stringify(st.texts));
      // (the pixel font draws "…" as "..." and "—" as "-", everywhere in the game: compare in those terms)
      const norm = (t) => t.replace(/…/g, "...").replace(/—/g, "-");
      const L = LINES.map((l) => l && norm(l));
      const cut = (t) => norm(t).replace(/ \.\.\.$/, "");
      const body = st.texts.find((t) => L.some((l) => l && (norm(t) === l || (t.length > 20 && l.startsWith(cut(t))))));
      const idx = L.findIndex((l) => l && body && (norm(body) === l || l.startsWith(cut(body))));
      if (idx >= 0 && !seen.includes(idx)) {
        seen.push(idx);
        if (want[idx]) {
          await sleep(idx === 2 ? 1400 : 900);
          await shot(want[idx]);
          if (idx === 2) {
            const c = (await ev(() => {
              const sc = window.__krel.game.scene.getScene("DonutToilet");
              const chz = sc.children.list.find((o) => o.texture && /^dn_chz/.test(o.texture.key));
              const b = chz.getBounds();
              return { key: chz.texture.key, vis: chz.visible, top: Math.round(b.top), donutY: Math.round(chz.y - (149 - 108) * chz.scaleY) };
            }));
            check("the reveal: SanChz is on screen, the donut above the dialogue box (y < 362) and his hat in frame", c.vis && c.donutY < 362 && c.top > 0, c);
          }
          if (idx === 7) {
            const k = await ev(() => window.__krel.game.scene.getScene("DonutToilet").children.list.find((o) => o.texture && /^dn_chz/.test(o.texture.key)).texture.key);
            check("the donut moans: the moaning frame", k === "dn_chz_moan", k);
          }
        }
      }
      // a moment on each line (the beats), then on
      await sleep(phone ? 700 : 500);
      await advance();
      await sleep(250);
    }
    const shown = await ev(() => window.__dnShown || []);
    const missing = LINES.filter((l, i) => l !== null && shown[i] !== l);
    check("every line of the scene is shown, in order, word for word (13 lines)", shown.length === 13 && missing.length === 0, { missing, n: shown.length });
    check("(and they were on screen: the checker read most of them off the box)", seen.length >= 9, seen);
    const after = await ev(() => {
      const g = window.__krel.game;
      const d = g.scene.getScene("Dungeon");
      return { running: g.scene.isActive("Dungeon") && !g.scene.isPaused("Dungeon"), flag: !!window.__krel.G.s.flags.sm_donut, grace: d.graceUntil - d.now(), busy: d.busy, door: d.door.texture.key, cleared: d.roomCleared, chzVisible: (d.bros.find((b) => b.id === "SANCHZ") || { spr: { visible: true } }).spr.visible, hp: window.__krel.G.s.hp };
    });
    check("the cutscene finishes: the room runs again, the flag is set, SanChz is back", after.running && after.flag && !after.busy && after.chzVisible, after);
    const back = await ev(() => window.__dnBack || null);
    check("a grace period as the room comes back (1.5 s of the fight clock, a frame or two already gone)", !!back && back.grace >= 1000 && back.grace <= 1500, back);
    check("even an unblockable hit (a crusher) does nothing in the grace period", !!back && back.hp1 === back.hp0, back);
    check("no damage taken during the scene", after.hp >= frozen0.hp, { before: frozen0.hp, after: after.hp });
    check("the exit is still shut while the waves are on", after.door !== "p_door" && !after.cleared, after.door);
    // finish the fight (debug: every wave spawned and every enemy dead)
    for (let i = 0; i < 60; i++) {
      const st = await ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        for (const e of d.enemies) if (!e.dead) d.damageEnemy(e, 99999, { noWonk: true, label: "" });
        return { cleared: d.roomCleared, door: d.door.texture.key, wave: d.waveIdx, waves: d.waves.length };
      });
      if (st.cleared) break;
      await sleep(1000);
    }
    await sleep(800);
    const done = await ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      return { cleared: d.roomCleared, door: d.door.texture.key };
    });
    check("with the waves done (and the scene played) the exit opens", done.cleared && done.door === "p_door", done);
    // a second visit
    await ev(() => {
      const d = window.__krel.game.scene.getScene("Dungeon");
      const it = d.interactables.find((i) => /STAFF TOILET/.test(i.label));
      d.player.spr.setPosition(it.x - 20, d.side ? d.groundY - 40 : it.y);
    });
    for (let i = 0; i < 20; i++) {
      const g = await ev(() => window.__krel.game.scene.isActive("Dialogue") || window.__krel.game.scene.isActive("DonutToilet"));
      if (g) break;
      await ev(() => {
        const d = window.__krel.game.scene.getScene("Dungeon");
        if (!d.busy) d.interactables.find((i) => /STAFF TOILET/.test(i.label)).use();
      });
      await sleep(700);
    }
    await sleep(900);
    const again = await ev(() => {
      const g = window.__krel.game;
      const dl = g.scene.getScene("Dialogue");
      const box = dl && dl.children ? dl.children.list.find((o) => o.type === "Container") : null;
      return { cue: g.scene.isActive("DonutToilet"), dlg: g.scene.isActive("Dialogue"), texts: box ? box.list.filter((o) => o.type === "Text").map((o) => o.text).filter(Boolean) : [] };
    });
    check("a second visit: 'We don't talk about it. YEGHHH.' and no cutscene", !again.cue && again.dlg && again.texts.some((t) => t.startsWith("We don't talk about it")), again);
    await shot("again");
    for (let i = 0; i < 8 && (await ev(() => window.__krel.game.scene.isActive("Dialogue"))); i++) {
      await advance();
      await sleep(600);
    }
    check("no page errors", errs.length === 0, errs.slice(0, 3));
  } catch (e) {
    fails++;
    console.log("  FAIL", String(e.stack || e).slice(0, 600));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/donut-${PROFILE}-error.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log(fails ? `DONUT (${PROFILE}): ${fails} FAILED` : `DONUT (${PROFILE}): OK`);
  process.exit(fails ? 1 : 0);
})();
