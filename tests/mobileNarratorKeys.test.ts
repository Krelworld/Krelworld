// Stage 4 (the phone QA, s4-02 F1): every narrated line (NARRATOR / dir) that names a keyboard key is shown on a phone
// in touch words. The scan runs each narrator line in the game through the phone's narrator-only table and fails if a
// key name is left, except the lines listed below on purpose (each with its reason). Rule 3: only the narrator's own
// control words are swapped, never a character's line (mobileWordingScan.test.ts checks that side).
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { NARRATOR_TIPS, narratorTip, type WordingRule } from "../src/game/mobile/wording";
import { COMBAT_NARRATOR_TIPS } from "../src/game/mobile/combatWording";
import { GAME_NARRATOR_TIPS } from "../src/game/mobile/gamesLogic";
import { SCENE_NARRATOR_TIPS } from "../src/game/mobile/scenesLogic";

const NARR: WordingRule[] = [...NARRATOR_TIPS, ...COMBAT_NARRATOR_TIPS, ...GAME_NARRATOR_TIPS, ...SCENE_NARRATOR_TIPS];
const SOURCES = import.meta.glob(["../src/**/*.ts", "!../src/game/mobile/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

/** A keyboard key named as a control: "A / D", "W jump", "press E", "(E)", "E on", "WASD", "Esc", "Space to". */
export const KEY_WORDS = /\bA \/ D\b|\bW (?:jump|\/ SPACE|\(or up\)|or SPACE)\b|\bS drop\b|\b[Pp]ress [A-Z]\b|\([A-Z]\)|\bE on\b|\bWASD\b|\bEsc\b|\bSpace to\b|\bSPACE to\b/;

function textOf(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => "${}" + s.literal.text).join("");
  return null;
}

/** Every narrator line: dir("...") calls, say("NARRATOR", "...") and { s: "NARRATOR" | dir: true, t: "..." }. */
function narratorLines(): [string, string][] {
  const out: [string, string][] = [];
  for (const [f, src] of Object.entries(SOURCES)) {
    if (!/\bdir\(|NARRATOR|dir:\s*true/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    const at = (n: ts.Node) => `${f.replace("../", "")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const fn = n.expression.text;
        if (fn === "dir" && n.arguments.length >= 1) {
          const t = textOf(n.arguments[0]);
          if (t !== null) out.push([at(n), t]);
        }
        if (fn === "say" && n.arguments.length >= 2 && n.arguments[0].getText(sf).replace(/["'`]/g, "") === "NARRATOR") {
          const t = textOf(n.arguments[1]);
          if (t !== null) out.push([at(n), t]);
        }
      }
      if (ts.isObjectLiteralExpression(n)) {
        const prop = (k: string) => n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === k) as ts.PropertyAssignment | undefined;
        const s = prop("s");
        const t = prop("t");
        const d = prop("dir");
        const narr = (s && s.initializer.getText(sf).replace(/["'`]/g, "") === "NARRATOR") || (d && d.initializer.kind === ts.SyntaxKind.TrueKeyword);
        if (t && narr) {
          const tx = textOf(t.initializer);
          if (tx !== null) out.push([at(n), tx]);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

describe("narrated control tips never name a key on a phone (s4-02 F1)", () => {
  const lines = narratorLines();
  it("finds the narrator's lines (the scan works)", () => {
    expect(lines.length).toBeGreaterThan(200);
  });
  it("the four side-room legends s4-02 found are in touch words", () => {
    for (const needle of ["RUN AND GUN: push right and they come to you.", "RUN AND GUN, all the way down the plane", "CLIMB: W jump", "(E on the red circles)", "Point at a gun"]) {
      const hit = lines.filter(([, t]) => t.includes(needle));
      expect(hit.length, needle).toBeGreaterThan(0);
      for (const [, t] of hit) expect(KEY_WORDS.test(narratorTip(t, NARR)), narratorTip(t, NARR)).toBe(false);
    }
  });
  it("no narrator line is left naming a key ", () => {
    const left = lines.filter(([, t]) => KEY_WORDS.test(narratorTip(t, NARR))).map(([at, t]) => `${at}  ${narratorTip(t, NARR)}`);
    expect(left).toEqual([]);
  });
});
