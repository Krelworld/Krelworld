// Walking into a building: a beat, drawn like the drain and the detention room. The shop's front
// door in its own colours, its name over the top, Grozz from behind waddling up to it; the door
// swings, the light inside spills out, he goes in. Under a second, while the camera cuts to the
// room behind it (the door transitions in Stardew, the shop-entry stingers in Yakuza).
import { assetURL } from "./packs";

const W = 160, H = 120;

export interface DoorwayFigure { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; foot: number }

export class Doorway {
  private host: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private cx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private raf = 0;

  constructor() {
    this.host = document.createElement("div");
    Object.assign(this.host.style, { position: "fixed", inset: "0", zIndex: "7", display: "none", pointerEvents: "none", alignItems: "center", justifyContent: "center" });
    this.cv = document.createElement("canvas"); this.cv.width = W; this.cv.height = H;
    Object.assign(this.cv.style, { width: "min(78vw, 66vh)", imageRendering: "pixelated", border: "4px solid #000", boxShadow: "6px 6px 0 rgba(0,0,0,.6)" });
    this.host.appendChild(this.cv);
    this.cx = this.cv.getContext("2d")!; this.cx.imageSmoothingEnabled = false;
    for (const k of ["door_pub", "door_shop", "door_steel", "door_shut", "door_open"]) { const im = new Image(); im.src = assetURL(`kit/${k}.png`); this.img[k] = im; }
    document.body.appendChild(this.host);
  }

  get open(): boolean { return this.host.style.display !== "none"; }

  /** Play it; resolves when it's done. `walk(i)` gives Grozz from behind, walking frame i. */
  play(o: { door: string; sign: string; bg: string; fg: string; wall: string; walk: (i: number) => DoorwayFigure | null }, ms = 950): Promise<void> {
    cancelAnimationFrame(this.raf);
    this.host.style.display = "flex";
    const t0 = performance.now();
    return new Promise((done) => {
      const step = () => {
        const t = (performance.now() - t0) / ms;
        if (t >= 1) { this.host.style.display = "none"; done(); return; }
        this.draw(o, t);
        this.raf = requestAnimationFrame(step);
      };
      step();
    });
  }

  private draw(o: { door: string; sign: string; bg: string; fg: string; wall: string; walk: (i: number) => DoorwayFigure | null }, t: number): void {
    const cx = this.cx;
    // The frontage: its wall, a sign board in the shop's colours, the pavement.
    cx.fillStyle = o.wall; cx.fillRect(0, 0, W, H);
    for (let y = 30; y < 100; y += 6) { cx.fillStyle = "rgba(0,0,0,0.12)"; cx.fillRect(0, y, W, 1); }
    cx.fillStyle = "#000"; cx.fillRect(14, 6, W - 28, 18);
    cx.fillStyle = o.bg; cx.fillRect(16, 8, W - 32, 14);
    cx.fillStyle = o.fg; cx.font = "bold 9px monospace"; cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText(o.sign, W / 2, 15.5, W - 40);
    cx.fillStyle = "#5c5d63"; cx.fillRect(0, 100, W, 20);
    cx.fillStyle = "#4a4b50"; for (let x = 0; x < W; x += 16) cx.fillRect(x, 100, 1, 20);
    // The door: shut, then open on a lit room.
    const opened = t > 0.32, d = this.img[opened ? "door_open" : o.door] ?? this.img.door_shut;
    const dw = opened ? 52 : 40, dh = opened ? 78 : 76, dx = W / 2 - dw / 2, dy = 101 - dh;
    if (d.complete && d.naturalWidth) cx.drawImage(d, dx, dy, dw, dh);
    if (opened) { cx.fillStyle = `rgba(255,214,140,${Math.min(0.35, (t - 0.32) * 0.9)})`; cx.beginPath(); cx.moveTo(W / 2 - 14, 100); cx.lineTo(W / 2 + 14, 100); cx.lineTo(W / 2 + 30, 120); cx.lineTo(W / 2 - 30, 120); cx.fill(); }
    // Grozz, from behind: up the pavement, then through, shrinking into the light.
    const f = o.walk(Math.floor(t * 14) % 8);
    if (f) {
      const into = Math.max(0, (t - 0.45) / 0.55), y = 118 - Math.min(1, t / 0.45) * 16 - into * 12, k = 0.95 - into * 0.4;
      cx.save(); cx.globalAlpha = 1 - Math.max(0, into - 0.55) / 0.45;
      cx.translate(W / 2, y); cx.scale(k, k);
      cx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -f.sw / 2, -f.foot, f.sw, f.sh);
      cx.restore();
    }
    // In and out of black at the ends, so it sits inside the cut.
    const edge = Math.min(t / 0.12, (1 - t) / 0.12, 1);
    if (edge < 1) { cx.fillStyle = `rgba(0,0,0,${1 - edge})`; cx.fillRect(0, 0, W, H); }
  }
}
