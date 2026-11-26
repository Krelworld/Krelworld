import { describe, expect, it } from "vitest";
import { ARCS, arcsFor } from "../src/content/arcs";
import { DUNGEONS } from "../src/data/dungeons";
import { BOSS_TEXT } from "../src/content/bosses";
import { ENEMIES } from "../src/data/enemies";
import { newGameState } from "../src/game/systems/state";
import { arcDue, currentArcStep, currentArcSteps, completeStep, maybeFinishArc, arcStepAt, spotFlag, requiredArcSteps } from "../src/game/systems/arcs";

const HUB_SPOTS = ["UNIVERSITY", "GYM", "FIXER_UPPER", "BOOTH", "ABANDONED", "OLD_FLAT", "PUB", "BANK", "TOWN_HALL", "HOME", "ARCHIVE", "POLICE", "POLSON_ROAD", "FIELD", "BOGGOR", "PORTAL", "CROBLEY_FACTORY", "AIRPORT"];
const VIGNETTES = ["kreltower_fall", "kreltower_saved", "pudding", "flatmate", "rival", "press_conference", "polson_gym", "polson_cctv", "polson_gym2", "polson_mouth", "wahooga", "pudding_spy", "pudding_raid", "sanmik_lampe", "sanmik_nation", "sanmik_finale", "crobley_news", "crobley_presser", "crobley_boom", "kruncher_mikey", "klerble_train", "revenge_meeting", "krunch_protocol", "townhall_party"];
const MINIGAMES = ["bully", "deadlift", "girlfriends", "renovate", "runescape", "burpees", "facebook", "gig", "modulator", "crocodile", "norwich", "cannon"];

describe("character side stories", () => {
  it("every arc step points at real places, fights, minigames and cutscenes", () => {
    for (const a of ARCS) {
      expect(a.steps.length).toBeGreaterThan(0);
      for (const st of a.steps) {
        expect(HUB_SPOTS, `${a.id}/${st.id}`).toContain(st.at);
        const k = st.step;
        if (k.kind === "arena") {
          const d = DUNGEONS[k.dungeon];
          expect(d, k.dungeon).toBeTruthy();
          expect(d.arenaFlag).toBeTruthy();
          const boss = d.rooms[d.rooms.length - 1].boss;
          expect(boss && BOSS_TEXT[boss], `${k.dungeon} boss text`).toBeTruthy();
        }
        if (k.kind === "vignette") expect(VIGNETTES).toContain(k.id);
        if (k.kind === "minigame") expect(MINIGAMES).toContain(k.mode);
        if (k.kind === "collect") for (const sp of k.spots) expect(sp.x > 0 && sp.x < 2560 && sp.y > 0 && sp.y < 1792).toBe(true);
        if (k.kind === "quiz") {
          expect(k.need).toBeLessThanOrEqual(k.questions.length);
          for (const q of k.questions) expect(q.correct).toBeLessThan(q.options.length);
        }
      }
    }
  });

  it("covers the six requested characters", () => {
    expect(ARCS.filter((a) => a.player !== "ALL").map((a) => a.player).sort()).toEqual(["CRONGUS", "FLENKY", "FLENKY", "GRONNY", "KREBLIS", "KREBLIS", "KREBON", "KREZMAR", "KREZWONK", "MIKEY", "SCROMBUS"]);
    expect(ARCS.filter((a) => a.player === "ALL").length).toBeGreaterThanOrEqual(2);
  });

  it("steps run in order and pay out once", () => {
    const s = newGameState("SCROMBUS");
    expect(currentArcStep(s)).toBeNull(); // locked until the first meeting
    s.flags.met_emergency = true;
    const a = ARCS.find((x) => x.player === "SCROMBUS")!;
    expect(currentArcStep(s)?.step.id).toBe("buy");
    expect(arcStepAt(s, "BANK")).toBeNull();
    for (const st of a.steps) completeStep(s, a, st);
    const before = s.coins;
    expect(maybeFinishArc(s)).toContain(a.title);
    expect(s.coins).toBe(before + a.reward.coins);
    expect(maybeFinishArc(s)).toBeNull();
  });

  it("arena steps complete from the arena flag", () => {
    const s = newGameState("GRONNY");
    s.flags.met_emergency = true;
    const a = ARCS.find((x) => x.player === "GRONNY")!;
    for (const st of a.steps) if (st.step.kind !== "arena") completeStep(s, a, st);
    const arena = a.steps.find((x) => x.step.kind === "arena")!;
    const k = arena.step as { kind: "arena"; dungeon: string };
    s.flags[DUNGEONS[k.dungeon].arenaFlag!] = true;
    expect(currentArcStep(s)).toBeNull();
  });
});

describe("the demons inside Lulon's mind", () => {
  it("both pudding stories end in his head, then a thank-you", () => {
    for (const id of ["arc_crongus", "arc_pudding_spy"]) {
      const a = ARCS.find((x) => x.id === id)!;
      const ids = a.steps.map((s) => s.id);
      const raid = ids.indexOf("raid");
      const arena = a.steps[raid + 1].step;
      expect(arena.kind === "arena" && arena.dungeon).toBe("arena_lukemind");
      expect(a.steps[raid + 1].auto && a.steps[raid + 2].auto).toBe(true);
      expect(a.steps[raid + 2].step.kind).toBe("dialogue");
      expect(a.steps.length).toBe(raid + 3);
    }
    const own = ARCS.find((x) => x.id === "arc_crongus")!;
    const k = own.steps.find((s) => s.id === "demons")!.step;
    expect(k.kind === "arena" && k.drugs).toBe(true);
    const pay = own.steps[own.steps.length - 1].step;
    expect(pay.kind === "dialogue" && pay.pay?.coins).toBe(200);
    const d = DUNGEONS.arena_lukemind;
    expect(d.rooms[d.rooms.length - 1].boss).toBe("pudding_demon");
    expect(d.returnAt).toBe("POLICE");
  });
});

describe("Kreltower plot", () => {
  it("the Kreddle Express quest: Flight KR-069 ends with Krozno and is Chapter 6, the last before Da Drongus Dungeon", () => {
    const d = DUNGEONS.airport;
    expect(d.rooms[d.rooms.length - 1].boss).toBe("krozno");
    const a = ARCS.find((x) => x.id === "arc_klerble")!;
    expect(a.steps.map((s) => s.at)).toEqual(["ARCHIVE", "AIRPORT"]);
    expect(arcDue(a)).toBe(6);
    const st = newGameState("FLENKY");
    st.chapter = 6;
    Object.assign(st.flags, { met_emergency: true, ban_tribunal_open: true, arcstep_arc_klerble_brief: true, arcstep_arc_klerble_hijack: true });
    expect(maybeFinishArc(st)).toContain("The Kreddle Express complete");
  });
  it("Drongus's office plays the anthem", () => {
    expect(DUNGEONS.citadel.rooms.some((r) => r.event === "anthem")).toBe(true);
  });
  it("Da Drongus Dungeon: real enemies and bosses, and it ends on the roof (the finale)", () => {
    const rooms = DUNGEONS.citadel.rooms;
    expect(rooms[rooms.length - 1].event).toBe("roof");
    expect(rooms[rooms.length - 2].event).toBe("drongus2");
    for (const r of rooms) {
      for (const w of r.waves ?? []) for (const [id] of w) expect(ENEMIES[id], `${r.name}: ${id}`).toBeTruthy();
      for (const [, w] of r.triggers ?? []) for (const [id] of w) expect(ENEMIES[id], `${r.name}: ${id}`).toBeTruthy();
      for (const b of [r.boss, r.miniBoss?.id]) if (b) expect(BOSS_TEXT[b], `${r.name}: ${b}`).toBeTruthy();
    }
    // the IDF and Hamas grunts are the same cartoon soldier with a different name plate
    const { plate: p1, name: n1, id: i1, ...idf } = ENEMIES.idf;
    const { plate: p2, name: n2, id: i2, ...hamas } = ENEMIES.hamas;
    expect([p1, p2]).toEqual(["IDF", "HAMAS"]);
    expect(idf).toEqual(hamas);
  });
});

describe("shared side quests", () => {
  it("appear for everyone once their chapter is reached", () => {
    const s = newGameState("MIKEY");
    s.flags.met_emergency = true;
    s.chapter = 1;
    const shared = () => currentArcSteps(s).filter((c) => c.arc.player === "ALL");
    expect(shared().length).toBe(0);
    s.chapter = 3;
    expect(shared().map((c) => c.arc.id).sort()).toEqual(["arc_boggor", "arc_crocodile", "arc_krunchers", "arc_polson_fit", "arc_pudding_spy"]);
  });
  it("collect steps finish when every token is picked up", () => {
    const s = newGameState("MIKEY");
    s.flags.met_emergency = true;
    s.chapter = 5;
    // a side quest with a collect step part-way through (Boggor's photos; Mikey's own hunt was taken out)
    const a = arcsFor("MIKEY").find((x) => x.id === "arc_boggor" && x.steps.findIndex((st) => st.step.kind === "collect") > 0)!;
    if (a.requires) s.flags[a.requires] = true;
    const ci = a.steps.findIndex((st) => st.step.kind === "collect");
    for (let i = 0; i < ci; i++) completeStep(s, a, a.steps[i]);
    const st = a.steps[ci];
    const cur = () => currentArcSteps(s).find((c) => c.arc.id === a.id)?.step.id;
    expect(cur()).toBe(st.id);
    if (st.step.kind === "collect") st.step.spots.forEach((_, i) => (s.flags[spotFlag(a, st, i)] = true));
    expect(cur()).toBe(a.steps[ci + 1]?.id);
  });
});

describe("Mikey's Modulator story (no lost-property hunt)", () => {
  const mikey = () => ARCS.find((a) => a.id === "arc_mikey")!;
  it("goes straight from the laptop to the pub payphone", () => {
    expect(mikey().steps.map((st) => st.id)).toEqual(["pizza_trial", "russian_hackers", "sugar_parcel", "election", "modulate", "nuclear"]);
    expect(mikey().steps.some((st) => st.step.kind === "collect")).toBe(false);
  });
  it("a save sitting on the old hunt (some items found) moves on to the payphone", () => {
    const s = newGameState("MIKEY");
    s.flags.met_emergency = true;
    s.chapter = 2;
    const a = mikey();
    completeStep(s, a, a.steps[0]);
    // flags an old save could carry from the removed step: harmless leftovers
    s.flags.arcspot_arc_mikey_lost_property_0 = true;
    s.flags.arcspot_arc_mikey_lost_property_3 = true;
    const cur = currentArcSteps(s).find((c) => c.arc.id === "arc_mikey");
    expect(cur?.step.id).toBe("russian_hackers");
    expect(arcStepAt(s, "PUB")?.step.id).toBe("russian_hackers");
    expect(arcStepAt(s, "FIELD")?.arc.id).not.toBe("arc_mikey");
  });
  it("finishing the story clears it from the chapter's required list (the dungeon opens)", () => {
    const s = newGameState("MIKEY");
    s.flags.met_emergency = true;
    s.chapter = 2;
    const a = mikey();
    const req = () => requiredArcSteps(s).filter((c) => c.arc.id === "arc_mikey");
    expect(req().length).toBe(1);
    for (const st of a.steps) completeStep(s, a, st);
    expect(req().length).toBe(0);
    expect(maybeFinishArc(s)).toContain("The Modulator complete");
  });
});
