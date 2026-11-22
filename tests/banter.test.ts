import { describe, expect, it } from "vitest";
import type { BanterLevel, Line, PlayableId } from "../src/data/types";
import { PLAYABLE_IDS } from "../src/data/types";
import { BANTER_LEVELS, banterKeeps, clampBanter, DEFAULT_BANTER, filterBanter, lineHasEffect } from "../src/game/systems/banter";
import { deserialize, migrateState, newGameState, serialize } from "../src/game/systems/state";
import { bMax, bMod, dir, react, say } from "../src/content/dsl";
import { MEETINGS } from "../src/content/meetings";
import { CHAPTERS } from "../src/content/chapters/chapters";
import * as AFTER from "../src/content/chapters/ch7aftermath";
import * as CH6 from "../src/content/ch6";
import { CINE } from "../src/content/cine";
import { resolveLine } from "../src/game/systems/narrative";
import { voiceKey } from "../src/game/audio/voiceKey";
import { setAltForTests } from "../src/game/variant";

const LEVELS: BanterLevel[] = ["max", "moderate", "exposition"];

/** Every Line reachable from a value (nested choices, reaction outcomes and Kreltality branches included). */
function linesIn(o: unknown, out: Line[] = [], seen = new WeakSet<object>()): Line[] {
  if (!o || typeof o !== "object" || seen.has(o as object)) return out;
  seen.add(o as object);
  if (Array.isArray(o)) {
    for (const x of o) linesIn(x, out, seen);
    return out;
  }
  const r = o as Record<string, unknown>;
  if (typeof r.s === "string" && typeof r.t === "string") out.push(r as unknown as Line);
  for (const v of Object.values(r)) linesIn(v, out, seen);
  return out;
}

/** The scripts that carry banter tags: the briefings and debriefings. */
const SCRIPTS: Record<string, readonly Line[]> = {
  ...Object.fromEntries(Object.values(MEETINGS).map((m) => [`meeting:${m.id}`, m.beats])),
  ...Object.fromEntries(CHAPTERS.flatMap((c) => [[`ch${c.n}:intro`, c.intro], [`ch${c.n}:outro`, c.outro]])),
  ...Object.fromEntries(Object.entries(AFTER).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [`ch7aftermath:${k}`, v as Line[]])),
  ...Object.fromEntries(Object.entries(CH6).filter(([k, v]) => k.startsWith("RM_") && Array.isArray(v)).map(([k, v]) => [`ch6:${k}`, v as Line[]])),
};

const content = import.meta.glob("../src/content/**/*.ts", { eager: true }) as Record<string, Record<string, unknown>>;
const data = import.meta.glob("../src/data/**/*.ts", { eager: true }) as Record<string, Record<string, unknown>>;
/** The only files allowed to carry banter tags. TV, news, adverts, archive films, the pub, quests... never. */
const TAGGED_FILES = new Set([
  "../src/content/meetings/chapterOneMeetings.ts",
  "../src/content/meetings/laterMeetings.ts",
  "../src/content/chapters/chapters.ts",
  "../src/content/chapters/ch7aftermath.ts",
  "../src/content/ch6.ts",
]);
const ALL_TAGGED = [...new Set(Object.values(content).flatMap((m) => linesIn(m)).filter((l) => l.banter))];

describe("banter filter", () => {
  const a = say("KREBLIS", "Breaking news…");
  const b = bMod(say("KREBLIS", "We should invade Kreddle"));
  const c = bMax(say("GRONNY", "Me are Rory."));
  const d = say("SCROMBUS", "Go. Wildern Academy.");
  const script = [a, b, c, d];

  it("keeps everything at MAX BANTER, drops max-only lines at MODERATE, and both at EXPOSITION", () => {
    expect(filterBanter(script, "max")).toEqual([a, b, c, d]);
    expect(filterBanter(script, "moderate")).toEqual([a, b, d]);
    expect(filterBanter(script, "exposition")).toEqual([a, d]);
  });

  it("returns the very same Line objects, in order (nothing reworded, nothing added)", () => {
    for (const lv of LEVELS) {
      const out = filterBanter(script, lv);
      let i = 0;
      for (const l of out) {
        while (script[i] !== l) i++;
        expect(script[i]).toBe(l);
      }
    }
  });

  it("never drops untagged lines, or a line that does something, whatever its tag", () => {
    const flag = bMax(dir("A flag.", { set: { x: true } }));
    const ask = bMax(react("msg", "ctx", {}));
    const telly = bMax({ s: "NARRATOR", t: "", tv: "krews_krandall" } as Line);
    for (const l of [flag, ask, telly]) {
      expect(lineHasEffect(l)).toBe(true);
      for (const lv of LEVELS) expect(banterKeeps(l, lv)).toBe(true);
    }
    for (const lv of LEVELS) expect(banterKeeps(d, lv)).toBe(true);
  });

  it("the helpers only add the tag", () => {
    const l = say("MIKEY", "Yee", { mood: "excited" });
    expect(bMax(l)).toEqual({ ...l, banter: "max" });
    expect(bMod(l)).toEqual({ ...l, banter: "moderate" });
  });

  it("has three levels, MAX BANTER the default", () => {
    expect(BANTER_LEVELS.map((x) => x.id)).toEqual(["max", "moderate", "exposition"]);
    expect(DEFAULT_BANTER).toBe("max");
    expect(clampBanter("moderate")).toBe("moderate");
    expect(clampBanter("loads")).toBe("max");
    expect(clampBanter(undefined)).toBe("max");
  });
});

describe("banter tags in the content", () => {
  it("are only in briefing and debriefing files (TV, news, adverts and archive films are untouched)", () => {
    for (const [f, m] of [...Object.entries(content), ...Object.entries(data)]) {
      const n = linesIn(m).filter((l) => l.banter).length;
      if (!TAGGED_FILES.has(f) && !f.endsWith("/meetings/index.ts")) expect(n, f).toBe(0);
    }
    expect(ALL_TAGGED.length).toBeGreaterThan(100);
  });

  it("never sit on a line that carries a choice, a reaction, a flag, the telly, a Kreltality or a story beat", () => {
    for (const l of ALL_TAGGED) {
      const what = `${l.s}: ${l.t || l.canon}`;
      expect(lineHasEffect(l), what).toBe(false);
      expect(l.set, what).toBeUndefined();
      expect(l.choice, what).toBeUndefined();
      expect(l.react, what).toBeUndefined();
      expect(l.tv, what).toBeUndefined();
      expect(l.rise, what).toBeUndefined();
      expect(l.krel, what).toBeUndefined();
      // a named anime story beat (content/cine.ts) always plays
      if (l.cine) expect(CINE[l.cine], what).toBeUndefined();
      if (l.cineAfter) expect(CINE[l.cineAfter], what).toBeUndefined();
      // room staging that the rest of the meeting relies on (Robbo coming and going, Mikey turning into SanMik)
      if (l.fx) expect(l.fx, what).not.toMatch(/^(robbo_|sanmik_)/);
    }
  });

  it("leave every briefing's first line (and every meeting's last) in place, and something to say at every level", () => {
    for (const [k, lines] of Object.entries(SCRIPTS)) {
      if (!lines.length) continue;
      expect(lines[0].banter, `${k} starts`).toBeUndefined();
      // (a meeting's last word is always heard; a chapter intro runs straight on into the player's own scene)
      if (k.startsWith("meeting:")) expect(lines[lines.length - 1].banter, `${k} ends`).toBeUndefined();
      expect(filterBanter(lines, "exposition").length, k).toBeGreaterThan(0);
    }
  });

  it("keep the staging coherent: every line that plays is seen in the same flashback, with the same people on stage, as at MAX", () => {
    // what TownMeetingScene's fx leave behind: which flashback is up, and who has walked off
    const stage = (lines: readonly Line[]) => {
      let place = "";
      const out = new Set<string>();
      return lines.map((l) => {
        const fx = l.fx ?? "";
        if (fx === "salem_on") place = "salem";
        else if (fx.startsWith("flash:")) place = fx.slice(6);
        else if (fx === "flash_off" || fx === "salem_off") place = "";
        if (fx.startsWith("flash:") || fx === "salem_on" || fx === "flash_off" || fx === "salem_off") out.clear();
        if (fx.startsWith("exit:")) out.add(fx.slice(5));
        if (fx.startsWith("enter:")) out.delete(fx.slice(6));
        return `${place}|${[...out].sort().join(",")}`;
      });
    };
    for (const [k, lines] of Object.entries(SCRIPTS)) {
      const full = new Map(lines.map((l, i) => [l, stage(lines)[i]]));
      for (const lv of LEVELS) {
        const kept = filterBanter(lines, lv);
        stage(kept).forEach((st, i) => expect(st, `${k} @${lv}: ${kept[i].s} ${kept[i].t}`).toBe(full.get(kept[i])));
      }
    }
  });

  it("cut a fair share at each level: moderate in between", () => {
    const all = Object.values(SCRIPTS).flat();
    const max = filterBanter(all, "max").length;
    const mod = filterBanter(all, "moderate").length;
    const exp = filterBanter(all, "exposition").length;
    expect(max).toBe(all.length);
    expect(mod).toBeLessThan(max);
    expect(exp).toBeLessThan(mod);
  });
});

describe("banter level in the save", () => {
  it("new games default to MAX BANTER, or take the pick", () => {
    expect(newGameState("FLENKY").banter).toBe("max");
    expect(newGameState("FLENKY", 0, undefined, 3, "exposition").banter).toBe("exposition");
  });

  it("old saves (no banter level) come back as MAX BANTER; a bad value is repaired; a good one is kept", () => {
    const old: Record<string, unknown> = { ...newGameState("GRONNY"), version: 3 };
    delete old.banter;
    expect(migrateState(old)!.banter).toBe("max");
    expect(migrateState({ ...newGameState("GRONNY"), banter: "loads" })!.banter).toBe("max");
    expect(migrateState({ ...newGameState("GRONNY"), banter: "moderate" })!.banter).toBe("moderate");
  });

  it("survives save and load", () => {
    for (const lv of LEVELS) {
      const s = newGameState("KREBON", 0, undefined, 2, lv);
      expect(deserialize(serialize(s))!.banter).toBe(lv);
    }
  });
});

describe("banter and the recorded voices", () => {
  // the game finds a line's recording by speaker + spoken text (audio/voiceKey.ts), never by where it sits in a script
  const keys = (lines: readonly Line[], player: PlayableId, lv: BanterLevel) => {
    const s = { ...newGameState(player), banter: lv };
    return new Map(lines.map((l) => {
      const rl = resolveLine(l.s === "YOU" ? { ...l, s: player } : l, s);
      return [l, rl && rl.t && !rl.dir ? voiceKey(String(rl.s), rl.t) : null];
    }));
  };

  for (const alt of [false, true]) {
    it(`every line that still plays gets the same recording as at MAX BANTER (${alt ? "ALT" : "main"} build)`, () => {
      setAltForTests(alt);
      try {
        for (const player of PLAYABLE_IDS) {
          for (const [k, lines] of Object.entries(SCRIPTS)) {
            const full = keys(lines, player, "max");
            for (const lv of LEVELS) {
              const kept = filterBanter(lines, lv);
              const now = keys(kept, player, lv);
              for (const l of kept) expect(now.get(l), `${k} @${lv} as ${player}`).toBe(full.get(l));
            }
          }
        }
      } finally {
        setAltForTests(false);
      }
    });
  }

  it("tagging a line didn't change its recording key (so no voices need regenerating)", () => {
    const files = import.meta.glob("../public/audio/voice/index.json", { eager: true, import: "default" }) as Record<string, Record<string, unknown>>;
    const index = Object.values(files)[0];
    if (!index) return;
    const spoken = ALL_TAGGED.filter((l) => !l.dir && l.t && !["NARRATOR", "YOU", "EVERYONE"].includes(String(l.s)));
    const found = spoken.filter((l) => index[voiceKey(String(l.s), l.t)]);
    // (the recordings were made before the tags existed: every one of them is still found by the same key)
    expect(found.length).toBeGreaterThan(spoken.length * 0.9);
  });
});
