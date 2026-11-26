// Held in the security office, side on: you on a plastic chair, the head of security at his desk
// under the CCTV, the door behind him, the clock running down to the police (or to being slung out).
// A scene, like the toilet cubicle, because this is the one time you sit still facing one man and
// decide how to get out. The world carries on: the clock is real. Get up and you're back in the
// office, top down, to try it the hard way.
import { assetURL } from "./packs";

const W = 400, H = 240, FLOOR = 206;

export interface DetainHooks {
  /** A person side on: picture and cell, facing right (true) or left. */
  figure: (who: "pc" | "chief", right: boolean) => { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; foot: number } | null;
  /** How it stands: seconds left, police on the way, the chief's name and whether he's up. */
  state: () => { held: boolean; left: number; police: boolean; chief: string; chiefUp: boolean; money: number; frock?: boolean };
  bribe: () => void;
  talk: () => void;
  getUp: () => void;
}

/** What he says to Grozz in a frock: the same man, patronising instead of bored. */
const PATTER_F = [
  "Name, sweetheart.", "Now, now, love. Let's not get hysterical.", "Bit emotional today, are we?",
  "Shouldn't you be at home, love? Who's doing the tea?", "Don't worry your pretty little head about the paperwork.",
  "Football's a man's game, darling. You wouldn't understand the offside rule.", "Smile, love. You'd be prettier if you smiled.",
  "Is that your husband's shirt under there?", "I'll get one of the girls to come and sit with you.", "Big hands for a lady. Lovely, though.",
];
const PATTER = [
  "Name.", "I said, name.", "Do you know how much paperwork you are?", "We've got you on camera. All of it. The lot.",
  "Sit still.", "You smell like a brewery fire.", "I've been doing this twenty-two years. You're not special.",
  "Is that your real face?", "Don't look at the door. I can see you looking at the door.", "Your mum must be so proud.",
];

export class Detain {
  open = false;
  dismissed = false;
  private host: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private bg = new Image();
  private say: HTMLDivElement;
  private clock: HTMLDivElement;
  private bBribe: HTMLButtonElement;
  private raf = 0;
  private lineAt = 0;
  private lineI = 0;

  constructor(private hooks: DetainHooks) {
    this.host = document.createElement("div");
    Object.assign(this.host.style, { position: "fixed", inset: "0", zIndex: "55", background: "#000", display: "none" });
    this.cv = document.createElement("canvas"); this.cv.width = W; this.cv.height = H;
    Object.assign(this.cv.style, { position: "absolute", left: "50%", top: "44%", transform: "translate(-50%, -50%)", width: "min(100vw, 166vh)", imageRendering: "pixelated" });
    this.host.appendChild(this.cv);
    this.cx = this.cv.getContext("2d")!; this.cx.imageSmoothingEnabled = false;
    this.bg.src = assetURL("scenes/detain_bg.png");
    const label = (css: Partial<CSSStyleDeclaration>) => { const d = document.createElement("div"); Object.assign(d.style, { position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", textShadow: "2px 2px 0 #000", width: "92%" }, css); this.host.appendChild(d); return d; };
    this.clock = label({ top: "max(12px, env(safe-area-inset-top))", color: "#ff6b6b", font: '800 20px "Silkscreen", monospace', letterSpacing: ".06em" });
    this.say = label({ top: "calc(max(12px, env(safe-area-inset-top)) + 34px)", color: "#f6f3ea", font: '700 17px "Pixelify Sans", sans-serif' });
    const bar = document.createElement("div");
    Object.assign(bar.style, { position: "absolute", left: "0", right: "0", bottom: "max(14px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", padding: "0 10px" });
    const mk = (t: string, bg: string, fn: () => void) => { const b = document.createElement("button"); b.textContent = t; Object.assign(b.style, { minWidth: "104px", minHeight: "58px", background: bg, color: "#fff", border: "3px solid #000", font: '800 15px "Silkscreen", monospace' }); b.addEventListener("click", fn); bar.appendChild(b); return b; };
    this.bBribe = mk("Bribe him", "#3a5a2a", () => this.hooks.bribe());
    mk("Talk", "#2a3a5a", () => { this.hooks.talk(); this.lineAt = performance.now() + 2500; });
    mk("Get up", "#c81e32", () => { this.dismissed = true; this.close(); this.hooks.getUp(); });
    this.host.appendChild(bar);
    document.body.appendChild(this.host);
  }

  /** Every frame from the game: open while you're held (unless you got up), shut when it's over. */
  update(): void {
    const st = this.hooks.state();
    if (!st.held || !st.chiefUp) { this.dismissed = false; if (this.open) this.close(); return; }
    if (this.dismissed || this.open) return;
    this.open = true; this.host.style.display = "block"; this.lineAt = 0;
    const loop = () => { if (!this.open) return; this.draw(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  close(): void { this.open = false; cancelAnimationFrame(this.raf); this.host.style.display = "none"; }
  /** Something the chief said in the game (a reply to a bribe or to talk): it goes up on screen. */
  line(text: string): void { this.say.textContent = `"${text}"`; this.lineAt = performance.now() + 3500; }

  private draw(): void {
    const st = this.hooks.state(), now = performance.now(), cx = this.cx;
    const m = Math.floor(st.left / 60), s = Math.floor(st.left % 60);
    this.clock.textContent = `${st.police ? "POLICE" : "OUT"} IN ${m}:${String(s).padStart(2, "0")}`;
    this.clock.style.color = st.police ? "#ff6b6b" : "#f2c94c";
    this.bBribe.disabled = st.money <= 0; this.bBribe.style.opacity = st.money > 0 ? "1" : "0.4";
    if (now > this.lineAt) { const pool = st.frock ? PATTER_F : PATTER; this.say.textContent = `${st.chief}: "${pool[this.lineI++ % pool.length]}"`; this.lineAt = now + 3800; }
    cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
    if (this.bg.complete && this.bg.naturalWidth) cx.drawImage(this.bg, 0, 0);
    // You, on the chair, facing him; him, by the desk, facing you, leaning in now and then.
    const pc = this.hooks.figure("pc", true), ch = this.hooks.figure("chief", false);
    if (pc) { cx.save(); cx.translate(62, 196 + Math.sin(now / 900) * 0.8); cx.drawImage(pc.img, pc.sx, pc.sy, pc.sw, Math.min(pc.sh, 60), -pc.sw / 2, -pc.foot + 14, pc.sw, Math.min(pc.sh, 60)); cx.restore(); }
    if (ch) { const lean = Math.max(0, Math.sin(now / 1400)) * 6; cx.save(); cx.translate(222 - lean, FLOOR); cx.drawImage(ch.img, ch.sx, ch.sy, ch.sw, ch.sh, -ch.sw / 2, -ch.foot, ch.sw, ch.sh); cx.restore(); }
    // The CCTV flickers.
    if (Math.floor(now / 140) % 9 === 0) { cx.fillStyle = "rgba(220,240,220,0.12)"; cx.fillRect(205, 82, 118, 36); }
  }
}
