const { chromium, devices } = require("playwright");
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = "/home/user/kw-pranks/stadium", OUT = process.env.OUT || "/tmp/claude-0/-home-user/df8e9996-9506-5081-be7a-814898a7fcd1/scratchpad/pranks";
fs.mkdirSync(OUT, { recursive: true });
const ids = process.argv[2].split(","), extra = process.argv[3] ?? "", afterS = Number(process.argv[4] ?? 4);
function serve(dir) { return new Promise((res) => { const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg" };
  const srv = http.createServer((q, r) => { const p = path.join(dir, decodeURIComponent(q.url.split("?")[0])); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); r.end(b); } }); });
  srv.listen(0, () => res(srv)); }); }
(async () => {
  const srv = await serve(path.join(ROOT, "dist/stadium"));
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto(`http://127.0.0.1:${srv.address().port}/local.html?noopening&mute&noswoop&seed=shots${extra}`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__scene, null, { timeout: 240000 });
  await p.click("#start");
  await p.waitForTimeout(4000);
  for (const spec of ids) {
    const [id, ox, oy, pre] = spec.split(":");
    const info = await p.evaluate(([id, ox, oy, pre]) => {
      const sc = window.__scene, pc = sc.pc, st = sc.s.stadium;
      if (pre) (0, eval)(pre);
      const rig = st.rigs?.[id]; if (rig) { rig.ready = 0; }
      // Where it is: ask the option list by standing where the table says.
      const at = window.__prankAt ? window.__prankAt(id) : null;
      return { at, three: !!sc.stage, tick: sc.s.tick };
    }, [id, ox, oy, pre]);
    // The table isn't on window: find the spot by sweeping is silly, so positions come in on the command line.
    await p.evaluate(([x, y]) => { const pc = window.__scene.pc; window.__scene.s.stadium.admitted = true; if (x === "H") { const o = Object.values(window.__scene.s.actors).find((a) => a.npc && a.npc.mounted); x = o.x + 1.3; y = o.y + 0.9; } pc.x = Number(x); pc.y = Number(y); pc.moveX = pc.moveY = 0; window.__scene.walkTo = null; window.__scene.roomSnap = true; }, [ox, oy]);
    await p.waitForTimeout(6000);
    await p.waitForTimeout(0); const lab = await p.evaluate(() => ({ btn: document.getElementById("act")?.textContent, hint: document.getElementById("actHint")?.textContent, pc: [window.__scene.pc.x, window.__scene.pc.y] }));
    await p.screenshot({ path: path.join(OUT, `${id}-1-before.png`) });
    const r = await p.evaluate((id) => { const sc = window.__scene; return window.__dispatch({ verb: "rig", actor: sc.pc.id, arg: id }); }, id);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(OUT, `${id}-2-go.png`) });
    await p.waitForTimeout(afterS * 1000);
    await p.screenshot({ path: path.join(OUT, `${id}-3-after.png`) });
    const st = await p.evaluate((id) => ({ rig: window.__scene.s.stadium.rigs?.[id], links: window.__scene.s.stadium.chain?.links, tick: window.__scene.s.tick }), id);
    console.log(id, JSON.stringify(info), JSON.stringify(lab), JSON.stringify(r), JSON.stringify(st));
  }
  console.log("errors:", errors.slice(0, 8));
  await b.close(); srv.close();
})();
