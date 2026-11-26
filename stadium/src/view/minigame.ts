// Little touch beats for the fiddly jobs, Chinatown Wars style: a few seconds each, one thumb, and
// skippable. A needle sweeps a bar: tap while it's in the green (pickpocketing, a jimmy at the
// cellar bolt), or twice in a row (hotwiring). Or hold to pour and let go in the band (spiking a
// drink). Success makes the job go cleanly; a miss has a consequence the game decides.
export type MiniKind = "pocket" | "hotwire" | "jimmy" | "pour";
export type MiniResult = "win" | "fail" | "skip";

const SPEC: Record<MiniKind, { title: string; hint: string; zone: number; speed: number; hits: number }> = {
  pocket: { title: "Dip his pocket", hint: "Tap in the green", zone: 0.16, speed: 1.5, hits: 1 },
  hotwire: { title: "Hotwire it", hint: "Tap in the green. Twice.", zone: 0.2, speed: 1.3, hits: 2 },
  jimmy: { title: "Jimmy the bolt", hint: "Tap in the green", zone: 0.22, speed: 1.1, hits: 1 },
  pour: { title: "Spike it", hint: "Hold to pour. Let go in the band.", zone: 0.18, speed: 0.55, hits: 1 },
};

export function playMini(kind: MiniKind, play: (clip: string, vol?: number) => void): Promise<MiniResult> {
  const sp = SPEC[kind];
  const host = document.createElement("div"); host.className = "mini";
  host.innerHTML = `<div class="box"><b>${sp.title}</b><small>${sp.hint}</small><div class="bar"><i class="zone"></i><i class="needle"></i>${kind === "pour" ? '<i class="fill"></i>' : ""}</div><div class="row"><button class="go">${kind === "pour" ? "HOLD" : "TAP"}</button><button class="sk">Skip</button></div></div>`;
  document.getElementById("app")!.appendChild(host);
  const bar = host.querySelector(".bar") as HTMLElement, zone = host.querySelector(".zone") as HTMLElement, needle = host.querySelector(".needle") as HTMLElement, fill = host.querySelector(".fill") as HTMLElement | null;
  let z0 = 0.25 + Math.random() * (0.65 - sp.zone), hits = 0, t0 = performance.now(), held = false, level = 0, raf = 0, done = false;
  const place = () => { zone.style.left = `${z0 * 100}%`; zone.style.width = `${sp.zone * 100}%`; };
  place();
  return new Promise((res) => {
    const end = (r: MiniResult) => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      host.classList.add(r === "win" ? "won" : r === "fail" ? "lost" : "skip");
      play(r === "win" ? "chime" : r === "fail" ? "nope" : "tap", 0.7);
      setTimeout(() => { host.remove(); res(r); }, r === "skip" ? 80 : 420);
    };
    const pos = () => {
      if (kind === "pour") return level;
      const u = ((performance.now() - t0) / 1000) * sp.speed;
      return 0.5 - 0.5 * Math.cos(u * Math.PI); // sweeps back and forth, slowing at the ends
    };
    const inZone = (p: number) => p >= z0 && p <= z0 + sp.zone;
    const step = () => {
      if (kind === "pour") { if (held) level = Math.min(1, level + 0.012 * (1 + level)); if (fill) fill.style.width = `${level * 100}%`; if (level >= 1) { end("fail"); return; } }
      needle.style.left = `${pos() * 100}%`;
      if (performance.now() - t0 > 7000) { end("fail"); return; }
      raf = requestAnimationFrame(step);
    };
    const go = host.querySelector(".go") as HTMLButtonElement;
    if (kind === "pour") {
      go.addEventListener("pointerdown", (e) => { e.preventDefault(); held = true; play("gulp", 0.3); });
      const up = () => { if (!held) return; held = false; end(inZone(level) ? "win" : "fail"); };
      go.addEventListener("pointerup", up); go.addEventListener("pointerleave", up);
    } else go.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!inZone(pos())) { end("fail"); return; }
      hits++; play("tap", 0.8);
      if (hits >= sp.hits) end("win");
      else { z0 = 0.15 + Math.random() * (0.7 - sp.zone); place(); bar.classList.add("hit"); setTimeout(() => bar.classList.remove("hit"), 150); }
    });
    host.querySelector(".sk")!.addEventListener("click", () => end("skip"));
    step();
  });
}
