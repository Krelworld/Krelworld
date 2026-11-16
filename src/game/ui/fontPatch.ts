import Phaser from "phaser";

/**
 * Game-wide pixel fonts. Rather than touch hundreds of `add.text` calls, every Phaser text whose family is the
 * old system UI stack (Trebuchet / Segoe / Verdana / plain sans-serif) or Impact is redrawn in the PixelLab
 * Krel fonts, with the size scaled so the wider pixel glyphs take about the same room the old fonts did.
 * Deliberate one-off faces (newspaper Georgia, Comic Sans jingles, monospace terminals) are left alone.
 */
const KREL_REG = '"Krel Regular", "Trebuchet MS", sans-serif';
const KREL_BOLD = '"Krel Bold", "Trebuchet MS", sans-serif';

type Kind = "ui" | "impact" | null;

/** Which old face a family string is, if it's one we replace. */
function kindOf(family: string): Kind {
  const f = String(family || "").toLowerCase();
  if (f.includes("krel")) return null;
  if (f.includes("impact")) return "impact";
  if (f.includes("trebuchet") || f.includes("segoe") || f.includes("verdana") || /^\s*["']?sans-serif["']?\s*$/.test(f) || f.includes("arial black")) return "ui";
  return null;
}

const px = (size: string | number) => (typeof size === "number" ? size : parseFloat(String(size)) || 16);

/** The size the pixel face is drawn at for a requested size in the old face. */
function scaled(kind: Exclude<Kind, null>, bold: boolean, size: number): number {
  const k = kind === "impact" ? 0.78 : bold ? 0.82 : 0.9;
  const s = Math.round(size * k);
  return Math.max(kind === "impact" ? 12 : 10, s);
}

/**
 * Whether text gets the heavy face: headlines only (old Impact text, and big bold titles). Ordinary bold text
 * (buttons, labels, names in lists) reads better, and less shouty, in the regular weight.
 */
function heavy(kind: Exclude<Kind, null>, bold: boolean, size: number) {
  return kind === "impact" || (bold && size >= 22);
}

interface Orig {
  kind: Exclude<Kind, null>;
  size: number;
  bold: boolean;
  rest: string; // the non-bold part of fontStyle (e.g. "italic")
}

function splitStyle(fs: string): { bold: boolean; rest: string } {
  const parts = String(fs || "").split(/\s+/).filter(Boolean);
  const bold = parts.some((p) => p === "bold" || p === "bolder" || /^[6-9]00$/.test(p));
  const rest = parts.filter((p) => !(p === "bold" || p === "bolder" || /^[6-9]00$/.test(p))).join(" ");
  return { bold, rest };
}

/** Rewrite the style's family/size/style in place from what was asked for. */
function apply(ts: any, o: Orig) {
  const bold = heavy(o.kind, o.bold, o.size);
  ts.fontFamily = bold ? KREL_BOLD : KREL_REG;
  ts.fontSize = `${scaled(o.kind, bold, o.size)}px`;
  ts.fontStyle = o.rest;
  ts._font = [ts.fontStyle, ts.fontSize, ts.fontFamily].join(" ").trim();
}

/** Typographic characters the pixel fonts don't have, swapped for ones they do (so a line never mixes faces). */
const SWAP: [RegExp, string][] = [
  [/[\u2018\u2019\u201B]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/\u2026/g, "..."],
  [/\s?[\u2013\u2014]\s?/g, " - "],
  [/\u2212/g, "-"],
];
export function pixelSafe(t: string): string {
  let out = t;
  for (const [re, to] of SWAP) out = out.replace(re, to);
  return out;
}

let installed = false;

export function installPixelFonts() {
  if (installed) return;
  installed = true;
  const P: any = (Phaser.GameObjects as any).TextStyle.prototype;

  const T: any = Phaser.GameObjects.Text.prototype;
  const setText = T.setText;
  T.setText = function (value: any) {
    if (this.style && String(this.style.fontFamily).includes("Krel") && (typeof value === "string" || Array.isArray(value))) {
      value = Array.isArray(value) ? value.map((v) => pixelSafe(String(v))) : pixelSafe(value);
    }
    return setText.call(this, value);
  };

  const setStyle = P.setStyle;
  P.setStyle = function (style: any, updateText?: boolean, setDefaults?: boolean) {
    if (style && typeof style === "object" && !style.font) {
      const fam = style.fontFamily ?? (setDefaults ? undefined : this.__krel ? "Trebuchet MS" : this.fontFamily);
      const kind = fam ? kindOf(fam) : null;
      if (kind) {
        const { bold, rest } = splitStyle(style.fontStyle ?? (setDefaults ? "" : this.__krel ? (this.__krel.bold ? "bold " : "") + this.__krel.rest : this.fontStyle));
        const size = style.fontSize !== undefined ? px(style.fontSize) : this.__krel ? this.__krel.size : px(this.fontSize);
        const o: Orig = { kind: style.fontFamily ? kind : this.__krel?.kind ?? kind, size, bold, rest };
        this.__krel = o;
        // hand Phaser the final pixel face, so its own measuring (and everything else in the style) is right
        const hv = heavy(o.kind, bold, size);
        return setStyle.call(this, { ...style, fontFamily: hv ? KREL_BOLD : KREL_REG, fontSize: `${scaled(o.kind, hv, size)}px`, fontStyle: rest }, updateText, setDefaults);
      }
      if (style.fontFamily) this.__krel = undefined;
    }
    return setStyle.call(this, style, updateText, setDefaults);
  };

  const setFontSize = P.setFontSize;
  P.setFontSize = function (size: number | string) {
    if (!this.__krel) return setFontSize.call(this, size);
    this.__krel.size = px(size);
    apply(this, this.__krel);
    return this.update(true);
  };

  const setFontStyle = P.setFontStyle;
  P.setFontStyle = function (fs: string) {
    if (!this.__krel) return setFontStyle.call(this, fs);
    const { bold, rest } = splitStyle(fs);
    this.__krel.bold = bold;
    this.__krel.rest = rest;
    apply(this, this.__krel);
    return this.update(true);
  };

  const setFontFamily = P.setFontFamily;
  P.setFontFamily = function (family: string) {
    const kind = kindOf(family);
    if (!kind) {
      this.__krel = undefined;
      return setFontFamily.call(this, family);
    }
    const prev = this.__krel ?? { size: px(this.fontSize), ...splitStyle(this.fontStyle) };
    this.__krel = { ...prev, kind };
    apply(this, this.__krel);
    return this.update(true);
  };

  const setFont = P.setFont;
  P.setFont = function (font: any, updateText?: boolean) {
    const fam = typeof font === "string" ? font.split(" ").slice(-1)[0] : font?.fontFamily;
    if (typeof font === "object" && fam && kindOf(fam)) {
      const { bold, rest } = splitStyle(font.fontStyle ?? "");
      this.__krel = { kind: kindOf(fam)!, size: px(font.fontSize ?? 16), bold, rest };
      apply(this, this.__krel);
      return updateText === false ? this.parent : this.update(true);
    }
    this.__krel = undefined;
    return setFont.call(this, font, updateText);
  };
}
