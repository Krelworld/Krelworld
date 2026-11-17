import Phaser from "phaser";
import { FONT } from "../../ui/theme";

/**
 * Thick Cumming Cock ep 7: the firm's billboard campaign. The posters are drawn in-engine (text over a plain panel)
 * so the slogans read crisply at any size; the frame they're pasted on is a PixelLab image (tcc_billboard), and the
 * stock photos are PixelLab portraits of ordinary, cheerful, smiling adults (tcc_photo_<which>).
 *
 * The KIDS poster has no photo at all: just the slogan and a gavel with the firm's initials. No children are drawn.
 */
export type Billboard = "seniors" | "refugees" | "kids" | "ds" | "nuns";

export const SLOGANS: Record<Billboard, string> = {
  seniors: "SENIORS LOVE THICK CUMMING COCK!",
  refugees: "REFUGEES LOVE THICK CUMMING COCK!",
  kids: "KIDS LOVE THICK CUMMING COCK!",
  ds: "PEOPLE WITH DOWN SYNDROME LOVE THICK CUMMING COCK!",
  nuns: "NUNS LOVE THICK CUMMING COCK!",
};

/** The blank face of the billboard frame (tcc_billboard, 128x96): x, y, w, h. */
export const BILLBOARD_FACE: [number, number, number, number] = [12, 15, 101, 36];

const PHOTO: Partial<Record<Billboard, string>> = {
  seniors: "tcc_photo_seniors",
  refugees: "tcc_photo_refugees",
  ds: "tcc_photo_ds",
  nuns: "tcc_photo_nuns",
};

/**
 * Draw a poster into the rectangle (x, y, w, h) through `add` (the director's picture). Returns the rectangle.
 */
export function billboardPanel(sc: Phaser.Scene, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, which: Billboard, x: number, y: number, w: number, h: number) {
  add(sc.add.rectangle(x, y, w, h, 0xfdfaf0).setOrigin(0));
  const foot = Math.max(5, h * 0.17);
  const pad = Math.max(1, h * 0.05);
  const ph = h - foot - pad * 2;
  // the picture on the left: a stock photo, or (for KIDS) the firm's gavel
  const px = x + pad;
  const py = y + pad;
  const key = PHOTO[which];
  if (key && sc.textures.exists(key)) {
    const img = add(sc.add.image(px, py, key).setOrigin(0));
    img.setScale(ph / img.height);
  } else {
    add(sc.add.rectangle(px, py, ph, ph, 0x1f3a6b).setOrigin(0));
    const g = add(sc.add.graphics({ x: px + ph / 2, y: py + ph / 2 }));
    const u = ph / 20;
    g.setAngle(-35);
    g.fillStyle(0x8a5a2b, 1).fillRect(-u * 0.9, -u * 1, u * 1.8, u * 9);
    g.fillStyle(0xa8743c, 1).fillRect(-u * 4.5, -u * 4.5, u * 9, u * 3.6);
    g.fillStyle(0x6b4320, 1).fillRect(-u * 4.5, -u * 4.5, u * 1.2, u * 3.6).fillRect(u * 3.3, -u * 4.5, u * 1.2, u * 3.6);
    if (ph > 18) add(sc.add.text(px + ph / 2, py + ph - ph * 0.14, "TCC", { fontFamily: FONT, fontSize: `${Math.round(ph * 0.2)}px`, color: "#ffe14a", fontStyle: "bold" }).setOrigin(0.5));
  }
  // the slogan, as big as fits
  const tx = px + ph + pad * 2;
  const tw = x + w - pad * 2 - tx;
  const th = ph;
  let size = Math.floor(th * 0.42);
  const t = add(sc.add.text(tx + tw / 2, py + th / 2, SLOGANS[which], { fontFamily: FONT, fontSize: `${size}px`, color: "#16285a", fontStyle: "bold", align: "center", wordWrap: { width: tw } }).setOrigin(0.5));
  t.setLineSpacing(-Math.round(size * 0.15));
  while (size > 5 && (t.height > th || t.width > tw)) {
    size--;
    t.setFontSize(size).setLineSpacing(-Math.round(size * 0.15));
  }
  // the firm, along the bottom
  add(sc.add.rectangle(x, y + h - foot, w, foot, 0xc81e3a).setOrigin(0));
  if (foot >= 7) {
    let fs = Math.max(6, Math.floor(foot * 0.62));
    const f = add(sc.add.text(x + w / 2, y + h - foot / 2, "THICK CUMMING COCK · ATTORNEYS AT LAW", { fontFamily: FONT, fontSize: `${fs}px`, color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    while (fs > 6 && f.width > w - 4) f.setFontSize(--fs);
    if (f.width > w - 4) f.setText("THICK CUMMING COCK");
  }
  return { x, y, w, h };
}
