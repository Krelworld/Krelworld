// Phone wording, the whole game at once (stage 2 review R5): no touch-wording rule may ever reach a character's line.
//
// Every say(SPEAKER, "...") and every { s: SPEAKER, t: "..." } line in the game (src/, the phone module aside) is
// checked against the whole table a phone runs (stage 1's TOUCH_WORDING plus the fights' and the brawl's rows), and
// the narrator-only tips are checked to match nothing a character says. A future broad rule (another "Press E"
// variant, say) that would reword a character's line fails here.
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { TOUCH_WORDING, NARRATOR_TIPS, type WordingRule } from "../src/game/mobile/wording";
import { COMBAT_WORDING, COMBAT_WORDING_FIRST, COMBAT_NARRATOR_TIPS, BRAWL_WORDING } from "../src/game/mobile/combatWording";

const TOUCH: WordingRule[] = [...COMBAT_WORDING_FIRST, ...TOUCH_WORDING, ...COMBAT_WORDING, ...BRAWL_WORDING];
const NARR: WordingRule[] = [...NARRATOR_TIPS, ...COMBAT_NARRATOR_TIPS];
/** The game's sources (the phone module aside). */
const SOURCES = import.meta.glob(["../src/**/*.ts", "!../src/game/mobile/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

/** A literal's text (a template's literal parts joined with a placeholder). */
function textOf(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => "${}" + s.literal.text).join("");
  return null;
}

/** Every character line in the game: [file:line, speaker, text]. */
function characterLines(): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const [f, src] of Object.entries(SOURCES)) {
    if (!/\bsay\(|\bs:\s*["'A-Z]/.test(src)) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
    const at = (n: ts.Node) => `${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n: ts.Node) => {
      // say(SPEAKER, "text")
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "say" && n.arguments.length >= 2) {
        const who = n.arguments[0].getText(sf).replace(/["'`]/g, "");
        const t = textOf(n.arguments[1]);
        if (t !== null && who !== "NARRATOR") out.push([at(n), who, t]);
      }
      // { s: "SPEAKER", t: "text" } (and no dir: true)
      if (ts.isObjectLiteralExpression(n)) {
        const prop = (k: string) => n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === k) as ts.PropertyAssignment | undefined;
        const s = prop("s");
        const t = prop("t");
        const d = prop("dir");
        if (s && t && !(d && d.initializer.kind === ts.SyntaxKind.TrueKeyword)) {
          const who = s.initializer.getText(sf).replace(/["'`]/g, "");
          const tx = textOf(t.initializer);
          if (tx !== null && who !== "NARRATOR") out.push([at(n), who, tx]);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

describe("phone wording never reaches a character's line (R5)", () => {
  const lines = characterLines();
  it("finds the game's character lines (the scan works)", () => {
    expect(lines.length).toBeGreaterThan(2000);
  });
  it("no touch-wording rule (stage 1, fights, brawl) matches any character line", () => {
    const hits: string[] = [];
    for (const [where, who, t] of lines)
      for (const r of TOUCH) {
        r.re.lastIndex = 0;
        if (r.re.test(t)) hits.push(`${where} ${who} [${r.id}] ${t.slice(0, 80)}`);
      }
    expect(hits).toEqual([]);
  });
  it("no narrator-only tip matches any character line", () => {
    const hits: string[] = [];
    for (const [where, who, t] of lines)
      for (const r of NARR) {
        r.re.lastIndex = 0;
        if (r.re.test(t)) hits.push(`${where} ${who} [${r.id}] ${t.slice(0, 80)}`);
      }
    expect(hits).toEqual([]);
  });
});
