
// ------------------------------------------------------------------ stage 3 wave 1 together (tap to use + the platform)

/** Start a tapped walk to the telly from the far side of Home; returns the walker's state just after the tap. */
async function homeWalkToTelly(ph) {
  check("mix3: Home reaches walk mode", await toWalk(ph, "Home"), await ph.mode());
  await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
  await homeMe(ph, 880, 500);
  await sleep(300);
  const tv = await tapThing(ph, /KrelTV/);
  await sleep(400);
  return tv.now.st;
}

async function mix3(browser) {
  console.log("STAGE 3 WAVE 1 TOGETHER (iPhone 14: tap to use with the parked art, the sound's resume, the pause routes, the stick)");
  const { ctx, ph, errors } = await phoneAtTitle(browser);
  try {
    // 1. memory: the TV show's faces are fetched, parked again (as the sweep does after 30 s), and come back when
    //    the player walks back into Home and taps the telly
    check("mix3: Home reaches walk mode (start)", await toWalk(ph, "Home"), await ph.mode());
    await ph.ev(() => window.__krel.game.scene.start("TV", { fromTitle: true, episode: "tcc_ep7" }));
    await ph.scene("TV");
    await sleep(6000);
    const live1 = await ph.ev(() => Object.keys(window.__krel.game.textures.list).filter((k) => k.startsWith("tvface_") && !window.__krelMobile.art.isParked(k)).length);
    await ph.ev(() => window.__krel.game.scene.stop("TV"));
    await sleep(500);
    await ph.ev(() => window.__krelMobile.art.sweep(0));
    const parked = await ph.ev(() => ({
      live: Object.keys(window.__krel.game.textures.list).filter((k) => k.startsWith("tvface_") && !window.__krelMobile.art.isParked(k)).length,
      mb: Math.round(window.__krelMobile.art.resident().bytes / 1048576),
    }));
    check("mix3: the TV show's faces came in, and are parked again when nothing uses them (memory released)", live1 > 0 && parked.live === 0, { live1, parked });
    const st = await homeWalkToTelly(ph);
    check("mix3: back in Home, a tap on the telly from the far side starts the walk", st.walking && st.tag === "Watch KrelTV", st);
    const cores = await ph.ev(() => window.__krelMobile.tapUse.debugTargets().map((t) => [t.tag, Math.round(t.core.w), Math.round(t.core.h)]));
    check("mix3: every tappable thing in Home keeps its real picture size (none read as a parked 1x1)", cores.length > 5 && cores.every((c) => c[1] > 8 && c[2] > 8), cores.filter((c) => c[1] <= 8 || c[2] <= 8));
    const done = await tapDone(ph);
    await ph.until(() => window.__krel.active().includes("TV"), null, 8000, "the telly").catch(() => 0);
    check("mix3: ...the walk ends at the telly and uses it (KrelTV opens)", done.st.last.what === "use" && (await ph.active()).includes("TV"), done.st.last);
    await ph.ev(() => {
      const tv = window.__krel.game.scene.getScene("TV");
      if (tv && tv.sys.isActive()) window.__krel.game.scene.stop("TV");
      window.__krel.game.scene.start("TV", { fromTitle: true, episode: "tcc_ep7" });
    });
    await ph.scene("TV");
    await sleep(6000);
    const back = await ph.ev(() => {
      const r = window.__krelMobile.art.report();
      const live = Object.keys(window.__krel.game.textures.list).filter((k) => k.startsWith("tvface_") && !window.__krelMobile.art.isParked(k));
      const t = live[0] && window.__krel.game.textures.get(live[0]);
      return { live: live.length, real: t ? t.getSourceImage() instanceof HTMLImageElement : false, failed: r.failed };
    });
    check("mix3: the parked faces are fetched back when the show is on again (real pictures, none failed)", back.live > 0 && back.real && back.failed === 0, back);
    await ph.ev(() => window.__krel.game.scene.stop("TV"));

    // 2. sound: the page hides mid-walk; the walk stops (nothing left pushing), the sound comes back when shown
    const w = await homeWalkToTelly(ph);
    const a0 = await ph.ev(() => window.__krelMobile.audio.diag());
    await setVisibility(ph, "hidden");
    await sleep(1200);
    const hid = await ph.ev(async () => {
      const T = (await import("/src/game/ui/TouchControls.ts")).TOUCH;
      return { st: window.__krelMobile.tapUse.state(), d: window.__krelMobile.audio.diag(), mx: T.mx, my: T.my };
    });
    check("mix3: hidden mid-walk: the tapped walk stops and lets go of the stick; the sound is suspended", w.walking && !hid.st.walking && hid.mx === 0 && hid.my === 0 && hid.d.ctx === "suspended" && hid.d.music === 0, { w: w.walking, last: hid.st.last, mx: hid.mx, d: hid.d });
    await setVisibility(ph, "visible");
    await sleep(2500);
    // (the shell's carry-on card may be up after a wake in a walking scene: tap it away)
    const card = await ph.ev(() => window.__krelMobile.shell.snapshot().card);
    if (card) {
      await ph.tapCss(422, 200);
      await sleep(800);
    }
    const sh = await ph.ev(() => ({ d: window.__krelMobile.audio.diag(), st: window.__krelMobile.tapUse.state(), mode: window.__krelMobile.snapshot().decision.mode }));
    const p0 = await ph.me();
    await sleep(800);
    const p1 = await ph.me();
    check("mix3: shown again: the sound runs (resumed), as many songs as before, and the player stands still", sh.d.ctx === "running" && sh.d.music === a0.music && !sh.st.walking && p0[0] === p1[0] && p0[1] === p1[1], { d: sh.d, before: a0.music, p0, p1, card });
    const again = await tapThing(ph, /KrelTV/);
    check("mix3: ...and a new tap walks again", again.now.st.walking || again.now.st.last.what === "use", again.now.st);
    await tapDone(ph);
    await ph.ev(() => {
      if (window.__krel.active().includes("TV")) window.__krel.game.scene.stop("TV");
    });

    // 3. pause: the II mid-walk opens the pause, stops the walk; closing it leaves the player standing
    const w2 = await homeWalkToTelly(ph);
    const s = await ph.snap();
    await tapPause(ph);
    await ph.until(() => window.__krel.game.scene.isActive("Menu") || window.__krelMobile.shell.snapshot().card, null, 10000, "the pause").catch(() => 0);
    const ps = await ph.ev(() => ({ menu: window.__krel.game.scene.isActive("Menu"), card: window.__krelMobile.shell.snapshot().card, st: window.__krelMobile.tapUse.state(), mode: window.__krelMobile.snapshot().decision.mode }));
    check("mix3: the II mid-walk pauses (its route) and the tapped walk stops", w2.walking && !!s.decision.pause && (ps.menu || ps.card) && !ps.st.walking, { route: s.decision.pause, ps: { menu: ps.menu, card: ps.card, last: ps.st.last } });
    await ph.ev(() => {
      const m = window.__krel.game.scene.getScene("Menu");
      if (window.__krel.game.scene.isActive("Menu")) m.close();
    });
    if (ps.card) await ph.tapCss(422, 200);
    await sleep(1200);
    const q0 = await ph.me();
    await sleep(800);
    const q1 = await ph.me();
    check("mix3: ...closing the pause leaves the player standing (no walk left over)", q0[0] === q1[0] && q0[1] === q1[1] && (await ph.mode()).startsWith("walk"), { q0, q1, mode: await ph.mode() });

    // 4. the stick cancels a routed walk in the town (the grid route round the buildings)
    check("mix3: the Hub reaches walk mode", await toWalk(ph, "Hub"), await ph.mode());
    await ph.ev(() => window.__krelMobile.setInsets({ top: 0, right: 47, bottom: 21, left: 47 }));
    await sleep(800);
    const far = await tapThing(ph, null, (all) => all.filter((t) => t.far > 200 && t.page.x > 200 && t.page.x < 760 && t.page.y > 80 && t.page.y < 340).sort((a, b) => b.far - a.far)[0]).catch((e) => ({ err: String(e.message) }));
    await sleep(500);
    const hb = await tapState(ph);
    const sz = (await ph.snap()).zone;
    const sx = sz.x + sz.w * 0.5;
    const sy = sz.y + sz.h * 0.6;
    await ph.touch("touchStart", [{ x: sx, y: sy, id: 9 }]);
    for (let i = 1; i <= 3; i++) {
      await ph.touch("touchMove", [{ x: sx + i * 12, y: sy, id: 9 }]);
      await sleep(20);
    }
    const ha = await tapState(ph);
    await ph.touch("touchEnd", []);
    await sleep(300);
    check("mix3: in town the stick stops a tapped walk at once (the stick walks)", !far.err && hb.walking && !ha.walking && ha.last.what === "stick", far.err || { before: hb.walking, after: ha.last });
    const cull = await ph.ev(() => ({ culled: window.__krelMobile.perf.lastCulled, drawn: window.__krelMobile.perf.lastDrawn }));
    check("mix3: the town draws with the off-screen skip on (tap to use and culling together)", cull.drawn > 0, cull);
    check("mix3: no page errors", errors.length === 0, errors.slice(0, 3));
  } finally {
    await ctx.close();
  }
}
