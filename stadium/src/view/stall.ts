// The pub toilet cubicle, up close: the partition wall, the hole, the graffiti; what comes
import { assetURL } from "./packs";
// through it (behind a black censor bar); and what a knife does to it. Drawn on its own small
// canvas at 400 x 240 and scaled up pixel-sharp, over the game.
import { pixelText } from "./build";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const HX = 204, HY = 150, HR = 12; // the hole, in picture pixels

export interface StallHooks {
  act: (arg: "knock" | "yes" | "no" | "chop" | "leave") => void;
  play: (clip: string, vol?: number) => void;
}

export class Stall {
  open = false;
  dismissed = false;
  private bg: HTMLImageElement | null = null;
  private cx: CanvasRenderingContext2D;
  private stain: HTMLCanvasElement;
  private state = 0;
  private knife = false;
  private barAt = 0;
  private chopAt = 0;
  private drops: { x: number; y: number; vx: number; vy: number; r?: number }[] = [];
  private splats: { x: number; y: number; r: number }[] = [];
  private runs: { x: number; y: number; len: number; max: number }[] = [];
  private raf = 0;
  private capTimer = 0;

  constructor(private hooks: StallHooks) {
    const cv = $<HTMLCanvasElement>("stallCv");
    this.cx = cv.getContext("2d")!;
    this.cx.imageSmoothingEnabled = false;
    this.stain = document.createElement("canvas");
    this.stain.width = 400; this.stain.height = 240;
    const img = new Image();
    img.onload = () => { this.bg = img; };
    img.src = assetURL("scenes/stall.png");
    cv.addEventListener("pointerdown", (e) => {
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 400, y = ((e.clientY - r.top) / r.height) * 240;
      if (Math.hypot(x - HX, y - HY) < 26) this.hooks.act(this.state === 2 && this.knife ? "chop" : this.state === 1 ? "yes" : "knock");
    });
  }

  /** Called every frame with where things stand. */
  update(inCubicle: boolean, state: number, knife: boolean): void {
    this.knife = knife;
    if (state !== this.state) { if (state === 2) this.barAt = performance.now(); this.state = state; this.buttons(); }
    const want = inCubicle && !this.dismissed;
    if (!inCubicle) this.dismissed = false;
    if (want === this.open) { if (want) this.buttons(true); return; }
    this.open = want;
    $("stall").hidden = !want;
    if (want) { this.buttons(); this.loop(); } else cancelAnimationFrame(this.raf);
  }

  /** What the voice through the wall says, and what happens. */
  event(what: string): void {
    const LINES: Record<string, string> = {
      offer: "Ooh, hello there. Want some fun?", no: "Suit yourself, sweetheart.", yes: "Ooh, lovely. Here it comes...",
      rude: "Well! Rude!", chop: "AAAAARGH! You absolute ANIMAL!", after: "...it's gone... it's actually gone...",
    };
    if (LINES[what]) this.caption(LINES[what]);
    this.hooks.play(`gh_${what}`, 1);
    if (what === "chop") {
      this.chopAt = performance.now();
      this.hooks.play("stab", 1); this.hooks.play("whoosh", 0.8);
      // A fountain from the hole, and gouts thrown across the cubicle at you.
      for (let i = 0; i < 260; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.2, sp = 2 + Math.random() * 9;
        this.drops.push({ x: HX + (Math.random() - 0.5) * 8, y: HY, vx: Math.cos(a) * sp * 1.5, vy: Math.sin(a) * sp, r: 1 + Math.floor(Math.random() * 3) });
      }
      // Big splats straight onto the "lens".
      for (let i = 0; i < 9; i++) this.splats.push({ x: 40 + Math.random() * 320, y: 20 + Math.random() * 200, r: 6 + Math.random() * 22 });
      const st = $("stall"); st.classList.remove("shake"); void st.offsetWidth; st.classList.add("shake");
    }
  }

  private caption(text: string): void {
    const c = $("stallCap");
    c.textContent = text; c.hidden = false;
    clearTimeout(this.capTimer);
    this.capTimer = window.setTimeout(() => { c.hidden = true; }, 3800);
  }

  private lastBtns = "";
  private buttons(onlyIfChanged = false): void {
    const s = this.state, opts: [string, () => void, boolean?][] = [];
    if (s === 0 || s === 4) opts.push(["Knock on the hole", () => this.hooks.act("knock")]);
    if (s === 3) opts.push(["Knock again", () => this.hooks.act("knock")]);
    if (s === 1) { opts.push(["Go on then", () => this.hooks.act("yes"), true]); opts.push(["No ta", () => this.hooks.act("no")]); }
    if (s === 2) { if (this.knife) opts.push(["Chop it off", () => this.hooks.act("chop"), true]); opts.push(["Back away", () => this.hooks.act("leave")]); }
    opts.push(["Leave the stall", () => { this.hooks.act("leave"); this.dismissed = true; $("stall").hidden = true; this.open = false; }]);
    const sig = opts.map((o) => o[0]).join("|");
    if (onlyIfChanged && sig === this.lastBtns) return;
    this.lastBtns = sig;
    const box = $("stallBtns");
    box.innerHTML = "";
    for (const [label, fn, red] of opts) {
      const b = document.createElement("button");
      b.textContent = label; if (red) b.className = "red";
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      box.appendChild(b);
    }
  }

  private loop = (): void => {
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const cx = this.cx, now = performance.now();
    cx.fillStyle = "#0a0908"; cx.fillRect(0, 0, 400, 240);
    if (this.bg) cx.drawImage(this.bg, 0, 0, 400, 240);
    // Marker-pen graffiti over the generator's scrawl, and the hole: a rough ring, dark inside.
    cx.globalAlpha = 0.85;
    pixelText(cx, "FOR A GOOD TIME\n07700 900461", 108, 116, 74, 18, "#d9d2b6", 1);
    pixelText(cx, "DAZ WOZ ERE", 236, 112, 64, 9, "#c83030", 1);
    pixelText(cx, "ENGERLAND", 238, 172, 60, 9, "#6a8ad8", 1);
    pixelText(cx, "KNOCK TWICE", 166, 176, 70, 9, "#d9d2b6", 1);
    cx.globalAlpha = 1;
    cx.fillStyle = "#3a3226"; cx.beginPath(); cx.arc(HX, HY, HR + 3, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = "#080706"; cx.beginPath(); cx.arc(HX, HY, HR, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = "#14110e"; cx.fillRect(HX - HR + 2, HY - 3, HR * 2 - 4, 2);
    // Blood that has hit the wall stays on it, and runs.
    cx.drawImage(this.stain, 0, 0);
    // The bar: out through the hole, wobbling. After the knife it falls.
    if (this.state === 2 || (this.state === 3 && now - this.chopAt < 900)) {
      const t = (now - this.barAt) / 1000, out = Math.min(1, t * 1.6);
      let len = 24 + out * 80, ang = -0.22 + Math.sin(now / 170) * 0.14 * out, ox = HX, oy = HY;
      if (this.state === 3) { const f = (now - this.chopAt) / 900; ox = HX + 14 + f * 40; oy = HY + f * f * 130; ang = 0.4 + f * 3.4; len = 70; }
      cx.save(); cx.translate(ox, oy); cx.rotate(ang);
      cx.fillStyle = "#f4f4f4"; cx.fillRect(-1, -12, len + 2, 24);
      cx.fillStyle = "#050505"; cx.fillRect(0, -11, len, 22);
      cx.fillStyle = "#2a2a2a"; cx.fillRect(0, -11, len, 2);
      pixelText(cx, "CENSORED", 4, -7, len - 8, 14, "#ffffff", 2);
      cx.restore();
    }
    // The slash.
    if (now - this.chopAt < 120) { cx.strokeStyle = "#ffffff"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(HX - 30, HY - 24); cx.lineTo(HX + 34, HY + 20); cx.stroke(); cx.fillStyle = "rgba(255,0,0,0.25)"; cx.fillRect(0, 0, 400, 240); }
    // Spray in flight; where it lands it stains; then a pumping trickle from the hole.
    const sc = this.stain.getContext("2d")!;
    this.drops = this.drops.filter((d) => {
      d.x += d.vx; d.y += d.vy; d.vy += 0.35;
      cx.fillStyle = "#a01010"; cx.fillRect(Math.round(d.x), Math.round(d.y), (d.r ?? 1) + 1, (d.r ?? 1) + 1);
      if (Math.random() < 0.08 || d.y > 225) {
        sc.fillStyle = Math.random() < 0.5 ? "#6e0b0b" : "#8a1010";
        const r = (d.r ?? 1) + Math.floor(Math.random() * 3);
        sc.fillRect(Math.round(d.x), Math.round(Math.min(d.y, 226)), r, r);
        if (Math.random() < 0.25 && d.y < 200) this.runs.push({ x: Math.round(d.x), y: Math.round(d.y), len: 0, max: 10 + Math.random() * 40 });
        return false;
      }
      return true;
    });
    // It keeps pumping out in spurts, slowing to a trickle.
    const since = now - this.chopAt;
    if (this.state === 3 && since < 14000) {
      const pulse = Math.max(0, Math.sin(since / 140)), n = since < 4000 ? Math.round(pulse * 6) : Math.random() < 0.4 ? 1 : 0;
      for (let i = 0; i < n; i++) this.drops.push({ x: HX + (Math.random() - 0.5) * 8, y: HY + 2, vx: (Math.random() - 0.3) * 3 * pulse, vy: -pulse * 3 + Math.random(), r: 1 + Math.floor(Math.random() * 2) });
    }
    // The splats on the "lens" (fading slowly).
    for (const sp of this.splats) {
      const a = Math.max(0, 0.85 - (now - this.chopAt) / 20000);
      cx.fillStyle = `rgba(110,8,8,${a})`; cx.beginPath(); cx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = `rgba(150,15,15,${a})`; cx.beginPath(); cx.arc(sp.x - sp.r * 0.3, sp.y - sp.r * 0.3, sp.r * 0.4, 0, Math.PI * 2); cx.fill();
      for (let k = 0; k < 3; k++) cx.fillRect(Math.round(sp.x - sp.r * 0.5 + k * sp.r * 0.4), Math.round(sp.y), 2, Math.round(sp.r * (0.8 + k * 0.4)));
    }
    for (const r of this.runs) if (r.len < r.max) { sc.fillStyle = "#6e0b0b"; sc.fillRect(r.x, r.y + r.len, 1, 1); r.len += 0.4; }
    this.runs = this.runs.filter((r) => r.len < r.max);
  }
}
