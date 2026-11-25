// Phone mode, stage 3 wave 2 (the special scenes): the pure rules in src/game/mobile/scenesLogic.ts.
import { describe, expect, it } from "vitest";
import ts from "typescript";
import {
  AIM_UP,
  fingerAim,
  GUN_SNAP,
  GUN_STICKY,
  gunScheme,
  nearestByX,
  pageLines,
  pageTimes,
  rocketTarget,
  SCENE_NARRATOR_TIPS,
  SCENE_UI_WORDING,
  steerFromStick,
  subtitleMs,
  type GunFoe,
} from "../src/game/mobile/scenesLogic";
import { touchWording } from "../src/game/mobile/wording";

const foe = (id: number, x: number, y: number, kind = "cop"): GunFoe => ({ id, x, y, kind });

describe("Night of Freedom: the finger is the crosshair", () => {
  it("aims straight at the finger with nothing near it", () => {
    const r = fingerAim({ x: 500, y: 200 }, [foe(1, 100, 460)], GUN_SNAP);
    expect(r).toEqual({ at: { x: 500, y: 200 }, lock: null });
  });
  it("pulls onto a car near the finger (its aim point, 30 px above the anchor), the nearest one", () => {
    const r = fingerAim({ x: 210, y: 420 }, [foe(1, 200, 460), foe(2, 260, 460)], GUN_SNAP);
    expect(r.lock).toBe(1);
    expect(r.at).toEqual({ x: 200, y: 460 - AIM_UP });
  });
  it("keeps a lock a little further out, and wins a near tie", () => {
    const far = GUN_SNAP * (GUN_STICKY - 0.1);
    expect(fingerAim({ x: 200 + far, y: 430 }, [foe(1, 200, 460)], GUN_SNAP, null).lock).toBeNull();
    expect(fingerAim({ x: 200 + far, y: 430 }, [foe(1, 200, 460)], GUN_SNAP, 1).lock).toBe(1);
    // two cars side by side: the locked one keeps it until the finger is clearly nearer the other
    expect(fingerAim({ x: 232, y: 430 }, [foe(1, 200, 460), foe(2, 260, 460)], GUN_SNAP, 1).lock).toBe(1);
    expect(fingerAim({ x: 255, y: 430 }, [foe(1, 200, 460), foe(2, 260, 460)], GUN_SNAP, 1).lock).toBe(2);
  });
  it("no pull with aim assist off; strong is the game's own auto-aim (nearest along the road)", () => {
    expect(fingerAim({ x: 205, y: 430 }, [foe(1, 200, 460)], gunScheme("off").radius).lock).toBeNull();
    expect(gunScheme("strong").auto).toBe(true);
    expect(gunScheme("normal")).toEqual({ auto: false, radius: GUN_SNAP });
    expect(nearestByX([foe(1, 100, 460), foe(2, 380, 200), foe(3, 700, 460)], 400)?.id).toBe(2);
    expect(nearestByX([], 400)).toBeNull();
  });
  it("ROCKET with no finger goes at the biggest thing on screen, nearest the gun among equals", () => {
    const gun = { x: 400, y: 380 };
    expect(rocketTarget([foe(1, 300, 460), foe(2, 800, 150, "heli"), foe(3, 600, 460, "tank")], gun)?.id).toBe(3);
    expect(rocketTarget([foe(1, 300, 460), foe(2, 700, 460)], gun)?.id).toBe(1);
    expect(rocketTarget([foe(1, -80, 460, "tank"), foe(2, 300, 460)], gun)?.id).toBe(2);
    expect(rocketTarget([], gun)).toBeNull();
  });
});

describe("Beep Beep: the stick steers as A / D would", () => {
  it("a small dead band, then full lock either way", () => {
    expect(steerFromStick(0)).toBe(0);
    expect(steerFromStick(0.2)).toBe(0);
    expect(steerFromStick(-0.3)).toBe(-1);
    expect(steerFromStick(0.9)).toBe(1);
  });
});

describe("the telly's subtitles paged at reading size (P5)", () => {
  it("pages keep every word in order, two lines a page", () => {
    const lines = ["one two", "three four", "five six", "seven"];
    const pages = pageLines(lines, 2);
    expect(pages).toEqual(["one two\nthree four", "five six\nseven"]);
    expect(pages.join("\n")).toBe(lines.join("\n"));
  });
  it("the line's own time is shared by length, never under the minimum", () => {
    const t = pageTimes(["aaaa aaaa aaaa aaaa", "bbbb"], 6000);
    expect(t[0]).toBeGreaterThan(t[1]);
    expect(t[1]).toBeGreaterThanOrEqual(1400);
    expect(Math.abs(t[0] + Math.min(t[1], 6000 * 4 / 20) - 6000)).toBeLessThan(5);
  });
  it("a subtitle's time is the telly's beat time for the line (the speaker's name not counted)", () => {
    expect(subtitleMs("GARY: " + "x".repeat(100))).toBeCloseTo((1.4 + 100 * 0.045) * 1000, 3);
    expect(subtitleMs("x".repeat(500))).toBe(9000);
  });
});

/** Every narrator and character line in the game's sources, for the wording checks. */
const SOURCES = import.meta.glob(["../src/**/*.ts", "!../src/game/mobile/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
function lines(): { who: string; text: string }[] {
  const out: { who: string; text: string }[] = [];
  const textOf = (n: ts.Node): string | null => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => "${}" + s.literal.text).join("") : null);
  for (const [f, src] of Object.entries(SOURCES)) {
    if (!/\bsay\(|\bdir\(|\bgabor\(/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const name = n.expression.text;
        if (name === "say" && n.arguments.length >= 2) {
          const t = textOf(n.arguments[1]);
          if (t !== null) out.push({ who: n.arguments[0].getText(sf), text: t });
        } else if ((name === "dir" || name === "gabor") && n.arguments.length >= 1) {
          const t = textOf(n.arguments[0]);
          if (t !== null) out.push({ who: name === "dir" ? "NARRATOR" : "GABOR", text: t });
        }
      }
      // a narrator line's per-character variants ({ variants: { MIKEY: "..." } })
      if (ts.isPropertyAssignment(n) && n.name.getText(sf) === "variants" && ts.isObjectLiteralExpression(n.initializer))
        for (const p of n.initializer.properties) if (ts.isPropertyAssignment(p)) {
          const t = textOf(p.initializer);
          if (t !== null) out.push({ who: "VARIANT", text: t });
        }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

describe("touch wording here reaches only the narrator's control words", () => {
  const all = lines();
  it("no scene tip matches a character's line", () => {
    const hits: string[] = [];
    for (const l of all)
      if (l.who !== "NARRATOR" && l.who !== "VARIANT")
        for (const r of SCENE_NARRATOR_TIPS) {
          r.re.lastIndex = 0;
          if (r.re.test(l.text)) hits.push(`${l.who} [${r.id}] ${l.text.slice(0, 80)}`);
        }
    expect(hits).toEqual([]);
  });
  it("every scene tip reaches the narrator line it was written for (and only swaps the control words)", () => {
    const narr = all.filter((l) => l.who === "NARRATOR" || l.who === "VARIANT").map((l) => l.text);
    for (const r of SCENE_NARRATOR_TIPS) {
      const hit = narr.filter((t) => {
        r.re.lastIndex = 0;
        return r.re.test(t);
      });
      expect(hit.length, r.id).toBeGreaterThan(0);
      for (const t of hit) {
        const out = touchWording(t, [r]);
        expect(out).not.toBe(t);
        // the words before and after the swapped part are the line's own
        r.re.lastIndex = 0;
        const m = r.re.exec(t)!;
        expect(out.startsWith(t.slice(0, m.index))).toBe(true);
        expect(out.endsWith(t.slice(m.index + m[0].length))).toBe(true);
      }
    }
  });
  it("the cannon's how-to line", () => {
    const t = "SPACE / TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them.";
    expect(touchWording(t, SCENE_UI_WORDING)).toBe("TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them.");
  });
});
