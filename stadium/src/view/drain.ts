// The drain from the pub cellar to the England dressing room, side on: a Victorian brick sewer you
// crawl along left to right (Link's Awakening's side-view passages: short, linear, a change of
// angle that suits a tunnel and nothing else). Rats come at you (kick them), a long-dead fan in an
// '86 shirt has a wallet, and a ladder at the end goes up through the grate. The world waits.
// Drawn on its own 400 x 240 canvas, scaled up pixel-sharp, over the game.
import { assetURL } from "./packs";

const W = 400, H = 240, LEN = 1100, FLOOR = 184;

export interface DrainHooks {
  /** Grozz side on: a picture and the cell to cut from it (facing right). */
  grozz: () => { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; foot: number } | null;
  play: (clip: string, vol?: number) => void;
  bark: (text: string) => void;
  wallet: () => void;
  done: () => void;
}

interface Rat { x: number; vx: number; dead: boolean; flyY?: number; vy?: number }

export class Drain {
  open = false;
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private host: HTMLDivElement;
  private img: Record<string, HTMLImageElement> = {};
  private x = 30;
  private held = false;
  private rats: Rat[] = [];
  private bitAt = 0;
  private walletTaken = false;
  private raf = 0;
  private last = 0;
  private cap: HTMLDivElement;
  private btn: HTMLButtonElement;
  private take: HTMLButtonElement;
  private up: HTMLButtonElement;

  constructor(private hooks: DrainHooks) {
    this.host = document.createElement("div");
    this.host.id = "drain";
    Object.assign(this.host.style, { position: "fixed", inset: "0", zIndex: "60", background: "#000", display: "none" });
    this.cv = document.createElement("canvas");
    this.cv.width = W; this.cv.height = H;
    Object.assign(this.cv.style, { position: "absolute", left: "50%", top: "45%", transform: "translate(-50%, -50%)", width: "min(100vw, 166vh)", imageRendering: "pixelated" });
    this.host.appendChild(this.cv);
    this.cx = this.cv.getContext("2d")!;
    this.cx.imageSmoothingEnabled = false;
    this.cap = document.createElement("div");
    Object.assign(this.cap.style, { position: "absolute", left: "50%", top: "max(14px, env(safe-area-inset-top))", transform: "translateX(-50%)", color: "#e8e0c0", font: '700 16px "Pixelify Sans", sans-serif', textShadow: "2px 2px 0 #000", textAlign: "center", width: "90%" });
    this.cap.textContent = "The old drain. Hold Crawl. Tap a rat to boot it.";
    this.host.appendChild(this.cap);
    const bar = document.createElement("div");
    Object.assign(bar.style, { position: "absolute", left: "0", right: "0", bottom: "max(16px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", gap: "12px" });
    const mk = (t: string, bg: string) => { const b = document.createElement("button"); b.textContent = t; Object.assign(b.style, { minWidth: "120px", minHeight: "64px", background: bg, color: "#fff", border: "3px solid #000", font: '800 18px "Silkscreen", monospace' }); bar.appendChild(b); return b; };
    this.take = mk("Take wallet", "#3a5a2a"); this.take.hidden = true;
    this.btn = mk("Crawl ▸", "#c81e32");
    this.up = mk("Climb up ▴", "#c81e32"); this.up.hidden = true;
    this.host.appendChild(bar);
    const on = (e: Event) => { e.preventDefault(); this.held = true; }, off = () => { this.held = false; };
    this.btn.addEventListener("pointerdown", on);
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) this.btn.addEventListener(ev, off);
    this.take.addEventListener("click", () => { if (this.walletTaken) return; this.walletTaken = true; this.take.hidden = true; this.hooks.wallet(); this.hooks.play("pickup", 1); this.hooks.bark("Cheers, pal. You won't be needing it."); });
    this.up.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => { if (this.open && (e.key === "d" || e.key === "ArrowRight")) this.held = true; if (this.open && (e.key === "w" || e.key === "ArrowUp") && !this.up.hidden) this.close(); });
    window.addEventListener("keyup", (e) => { if (e.key === "d" || e.key === "ArrowRight") this.held = false; });
    // Tap a rat to boot it.
    this.cv.addEventListener("pointerdown", (e) => {
      const r = this.cv.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
      const cam = this.camX();
      for (const rt of this.rats) if (!rt.dead && Math.abs(rt.x - cam - px) < 26 && Math.abs(FLOOR - 8 - py) < 30 && Math.abs(rt.x - this.x) < 90) {
        rt.dead = true; rt.flyY = 0; rt.vy = -220; rt.vx = 160;
        this.hooks.play("punch", 0.8); this.hooks.play("splat", 0.4);
        if (Math.random() < 0.5) this.hooks.bark(["Fuck off, you little cunt!", "Have that, Roland!", "Not today, ratty!"][Math.floor(Math.random() * 3)]);
      }
    });
    for (const k of ["drain_bg", "rat", "skeleton", "grate_up"]) { const im = new Image(); im.src = assetURL(`scenes/${k}.png`); this.img[k] = im; }
    document.body.appendChild(this.host);
  }

  start(): void {
    this.open = true; this.x = 30; this.held = false; this.walletTaken = false; this.bitAt = 0;
    this.rats = [{ x: 330, vx: -70, dead: false }, { x: 620, vx: -90, dead: false }, { x: 860, vx: -80, dead: false }];
    this.take.hidden = true; this.up.hidden = true; this.btn.hidden = false;
    this.host.style.display = "block";
    this.hooks.play("drain", 0.8);
    this.last = performance.now();
    const loop = () => { if (!this.open) return; this.step(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  close(): void {
    if (!this.open) return;
    this.open = false; cancelAnimationFrame(this.raf);
    this.host.style.display = "none";
    this.hooks.play("ladder", 0.9);
    this.hooks.done();
  }

  private camX() { return Math.max(0, Math.min(LEN - W, this.x - 140)); }

  private step(): void {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const bitten = now - this.bitAt < 600;
    if (this.held && !bitten) this.x = Math.min(LEN - 90, this.x + 72 * dt);
    // Rats scurry at you; one that reaches you bites (a yelp, and you stop for a moment).
    for (const rt of this.rats) {
      if (rt.dead) { rt.x += rt.vx * dt; rt.vy! += 600 * dt; rt.flyY! += rt.vy! * dt; continue; }
      if (rt.x - this.x < 260) rt.x += rt.vx * dt;
      if (rt.x - this.x < 28 && rt.x - this.x > -10) {
        rt.dead = true; rt.flyY = 0; rt.vy = -120; rt.vx = -60;
        this.bitAt = now; this.hooks.play("gasp", 0.9);
        this.hooks.bark(["Argh! It's got me ankle!", "Get it off! GET IT OFF!", "Bit me! The fucker bit me!"][Math.floor(Math.random() * 3)]);
      }
    }
    const nearWallet = Math.abs(this.x - 560) < 60 && !this.walletTaken;
    if (this.take.hidden === nearWallet) this.take.hidden = !nearWallet;
    const atEnd = this.x >= LEN - 100;
    if (this.up.hidden === atEnd) { this.up.hidden = !atEnd; this.btn.hidden = atEnd; if (atEnd) this.cap.textContent = "Light through a grate. Voices. The England dressing room."; }
    this.draw(now, bitten);
  }

  private draw(now: number, bitten: boolean): void {
    const cx = this.cx, cam = this.camX(), bg = this.img.drain_bg;
    cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
    // The tunnel: the same stretch of brick again and again, mirrored every other time so it joins up.
    if (bg.complete && bg.naturalWidth) for (let i = Math.floor(cam / W) - 1; i <= Math.floor((cam + W) / W) + 1; i++) {
      const dx = Math.round(i * W - cam);
      if (i % 2) { cx.save(); cx.translate(dx + W, 0); cx.scale(-1, 1); cx.drawImage(bg, 0, 0); cx.restore(); } else cx.drawImage(bg, dx, 0);
    }
    const sk = this.img.skeleton;
    if (sk.complete && sk.naturalWidth) cx.drawImage(sk, Math.round(560 - cam - 20), FLOOR - sk.naturalHeight + 6);
    const gr = this.img.grate_up;
    if (gr.complete && gr.naturalWidth) cx.drawImage(gr, Math.round(LEN - 70 - cam), FLOOR - gr.naturalHeight + 4);
    const rat = this.img.rat;
    for (const rt of this.rats) if (rat.complete && rat.naturalWidth && rt.x - cam > -50 && rt.x - cam < W + 50)
      cx.drawImage(rat, Math.round(rt.x - cam - 24), Math.round(FLOOR - 26 + (rt.flyY ?? 0) + (rt.dead ? 0 : Math.sin(now / 50 + rt.x) * 1.5)));
    // Grozz, bent double, bobbing as he goes.
    const gz = this.hooks.grozz();
    if (gz) {
      const moving = this.held && !bitten, bob = moving ? Math.abs(Math.sin(now / 110)) * 3 : 0, sx = Math.round(this.x - cam), sy = FLOOR;
      cx.save();
      cx.translate(sx, sy - bob);
      if (bitten) cx.translate(Math.sin(now / 25) * 2, 0);
      cx.scale(1, 0.86);
      cx.drawImage(gz.img, gz.sx, gz.sy, gz.sw, gz.sh, -gz.sw / 2, -gz.foot, gz.sw, gz.sh);
      cx.restore();
    }
    // Drips.
    cx.fillStyle = "rgba(170,200,140,0.7)";
    for (let i = 0; i < 6; i++) { const dx = ((i * 97 + 40) % W), dy = ((now / 6 + i * 53) % 150) + 30; cx.fillRect(dx, dy, 1, 3); }
  }
}
