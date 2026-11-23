// LAPTOP SAFETY NET (part 2 of 2: the pure numbers and tables; part 1 is scripts/desktop-fingerprint.cjs).
//
// These snapshots were taken from the game before any phone work started. The phone version must not change what a
// laptop player gets, so NOTHING in this file should ever need updating for a phone change: the combat numbers, the
// default settings, a new save, the key and pad bindings, the storage keys, the page shell and the Phaser config.
// A phone-only difference belongs behind isMobile() (false here, in node), not in these tables.
// If a test here fails after a phone commit, the commit changed the laptop game: fix the commit, not the snapshot.
// See tests/fingerprints/README.md.
import { describe, expect, it } from "vitest";
import { CHARACTERS, PLAYABLE_ORDER } from "../src/data/characters";
import { GUNS } from "../src/data/guns";
import { BANTER_LEVELS, BANTER_NOTE, clampBanter, DEFAULT_BANTER } from "../src/game/systems/banter";
import { clampDifficulty, DEFAULT_DIFFICULTY, difficultyDef, difficultyLabel, DIFFICULTY_LEVELS, diffFor, LEGACY_DIFFICULTY, MAX_DIFFICULTY, MIN_DIFFICULTY } from "../src/game/systems/difficulty";
import { ACTIONS, keysFor } from "../src/game/systems/keybinds";
import { PAD_DEFAULTS, PAD_FIXED, PAD_START, padFor, padLabel } from "../src/game/systems/padbinds";
import { AUTO_KEY, MANUAL_SLOTS, SLOT_IDS, slotKey, SLOTS_MIGRATED_KEY } from "../src/game/systems/saveSlots";
import { defaultSettings, META_KEY, newGameState, newMeta, SAVE_KEY, SAVE_VERSION } from "../src/game/systems/state";
import { damageMult, enemyDamageMult, enemyHpMult, maxBottles, maxHp, maxKrezz } from "../src/game/systems/stats";
import { ALT, isAlt, storageKey } from "../src/game/variant";

import indexHtml from "../index.html?raw";
import mainSrc from "../src/main.ts?raw";

/** Every .ts file under src/ as text, except the phone-only folder (src/game/mobile). */
const SOURCES = import.meta.glob(["../src/**/*.ts", "!../src/game/mobile/**"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
/** The phone code, if there is any yet: as text, and as modules to load on demand. */
const PHONE_TEXT = import.meta.glob(["../src/game/mobile/**/*.ts", "../src/game/mobile.ts"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const PHONE_MODULES = import.meta.glob(["../src/game/mobile/**/*.ts", "../src/game/mobile.ts"]) as Record<string, () => Promise<Record<string, unknown>>>;

/** A short fingerprint of a text (two FNV-1a passes; not cryptography, just "has this changed"). */
function hash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

describe("laptop invariants: difficulty", () => {
  it("the five levels are exactly the table the game shipped with", () => {
    expect([1, 2, 3, 4, 5].map((n) => difficultyDef(n))).toMatchInlineSnapshot(`
      [
        {
          "aggression": 0.75,
          "ammoDrops": 1.4,
          "ammoDryKills": 4,
          "blurb": "For the story. Enemies hit softly and warn you early, and healing is plentiful.",
          "bossHp": 0.7,
          "coins": 1,
          "color": 8843180,
          "damageTaken": 0.55,
          "enemyCount": 0.75,
          "enemyHp": 0.7,
          "enemySpeed": 0.88,
          "healDrops": 2,
          "iframes": 1.4,
          "krezzGain": 1.3,
          "krokenBonus": 0,
          "level": 1,
          "name": "VERY EASY",
          "projectileSpeed": 0.82,
          "rewards": 1,
          "shieldMinions": -1,
          "shieldStall": 0.6,
          "telegraph": 1.35,
          "timing": 1.35,
        },
        {
          "aggression": 1,
          "ammoDrops": 1,
          "ammoDryKills": 6,
          "blurb": "The game as it was originally balanced.",
          "bossHp": 1,
          "coins": 1,
          "color": 6809849,
          "damageTaken": 1,
          "enemyCount": 1,
          "enemyHp": 1,
          "enemySpeed": 1,
          "healDrops": 1,
          "iframes": 1,
          "krezzGain": 1,
          "krokenBonus": 0,
          "level": 2,
          "name": "EASY",
          "projectileSpeed": 1,
          "rewards": 1,
          "shieldMinions": 0,
          "shieldStall": 1,
          "telegraph": 1,
          "timing": 1,
        },
        {
          "aggression": 1.12,
          "ammoDrops": 0.95,
          "ammoDryKills": 6,
          "blurb": "Recommended. Enemies are a bit tougher and quicker, and healing is a bit scarcer.",
          "bossHp": 1.08,
          "coins": 1.1,
          "color": 16765503,
          "damageTaken": 1.2,
          "enemyCount": 1.1,
          "enemyHp": 1.08,
          "enemySpeed": 1.04,
          "healDrops": 0.85,
          "iframes": 1,
          "krezzGain": 1,
          "krokenBonus": 0,
          "level": 3,
          "name": "NORMAL",
          "projectileSpeed": 1.05,
          "rewards": 1,
          "shieldMinions": 0,
          "shieldStall": 1,
          "telegraph": 0.92,
          "timing": 0.92,
        },
        {
          "aggression": 1.25,
          "ammoDrops": 0.85,
          "ammoDryKills": 7,
          "blurb": "More enemies, faster attacks, less healing and ammo. Pays more: 1.5x coin from kills, 1.4x quest and chapter rewards, +10 Krokens a chapter.",
          "bossHp": 1.15,
          "coins": 1.5,
          "color": 16486972,
          "damageTaken": 1.4,
          "enemyCount": 1.25,
          "enemyHp": 1.15,
          "enemySpeed": 1.08,
          "healDrops": 0.7,
          "iframes": 0.92,
          "krezzGain": 0.92,
          "krokenBonus": 10,
          "level": 4,
          "name": "HARD",
          "projectileSpeed": 1.1,
          "rewards": 1.4,
          "shieldMinions": 1,
          "shieldStall": 1.15,
          "telegraph": 0.85,
          "timing": 0.85,
        },
        {
          "aggression": 1.4,
          "ammoDrops": 0.75,
          "ammoDryKills": 8,
          "blurb": "Short warnings, heavy hits, big waves, few drops. Pays the most: 1.9x coin from kills, 1.8x quest and chapter rewards, +25 Krokens a chapter.",
          "bossHp": 1.25,
          "coins": 1.9,
          "color": 16731501,
          "damageTaken": 1.7,
          "enemyCount": 1.4,
          "enemyHp": 1.25,
          "enemySpeed": 1.12,
          "healDrops": 0.55,
          "iframes": 0.85,
          "krezzGain": 0.85,
          "krokenBonus": 25,
          "level": 5,
          "name": "VERY HARD",
          "projectileSpeed": 1.18,
          "rewards": 1.8,
          "shieldMinions": 1,
          "shieldStall": 1.3,
          "telegraph": 0.78,
          "timing": 0.78,
        },
      ]
    `);
  });

  it("the level limits, the defaults and the fallbacks", () => {
    expect({ MIN_DIFFICULTY, MAX_DIFFICULTY, DEFAULT_DIFFICULTY, LEGACY_DIFFICULTY, levels: DIFFICULTY_LEVELS.length }).toMatchInlineSnapshot(`
      {
        "DEFAULT_DIFFICULTY": 3,
        "LEGACY_DIFFICULTY": 2,
        "MAX_DIFFICULTY": 5,
        "MIN_DIFFICULTY": 1,
        "levels": 5,
      }
    `);
    expect([0, 6, 2.5, "3", undefined, null].map((v) => clampDifficulty(v))).toEqual([2, 2, 2, 2, 2, 2]);
    expect(diffFor(null).level).toBe(2);
    expect(diffFor({ difficulty: 5 }).level).toBe(5);
    expect([1, 2, 3, 4, 5].map(difficultyLabel)).toMatchInlineSnapshot(`
      [
        "1/5 · VERY EASY",
        "2/5 · EASY",
        "3/5 · NORMAL",
        "4/5 · HARD",
        "5/5 · VERY HARD",
      ]
    `);
  });
});

describe("laptop invariants: settings and a new save", () => {
  it("default settings", () => {
    expect(defaultSettings()).toMatchInlineSnapshot(`
      {
        "autoAim": true,
        "crt": true,
        "master": 0.8,
        "music": 0.5,
        "sfx": 0.8,
        "shake": true,
        "textSpeed": 1,
        "voiceSpeed": 1.5,
        "voiceSpeedV": 3,
        "voiceVolume": 0.8,
        "voices": true,
      }
    `);
  });

  it("a fresh meta record (settings, unlocks)", () => {
    expect(newMeta()).toMatchInlineSnapshot(`
      {
        "archiveUnlocked": [],
        "completedWith": [],
        "ngPlusUnlocked": false,
        "settings": {
          "autoAim": true,
          "crt": true,
          "master": 0.8,
          "music": 0.5,
          "sfx": 0.8,
          "shake": true,
          "textSpeed": 1,
          "voiceSpeed": 1.5,
          "voiceSpeedV": 3,
          "voiceVolume": 0.8,
          "voices": true,
        },
        "tvWatched": [],
        "version": 4,
      }
    `);
  });

  it("a new game as FLENKY: every field of the save", () => {
    expect(newGameState("FLENKY")).toMatchInlineSnapshot(`
      {
        "archiveUnlocked": [],
        "banCount": 0,
        "banRisk": 0,
        "banter": "max",
        "bongos": 1,
        "bottles": 2,
        "chapter": 1,
        "coins": 0,
        "difficulty": 3,
        "discovered": [],
        "drongusResentment": 10,
        "flags": {},
        "gunOrder": [],
        "guns": {},
        "hp": 90,
        "intoxication": 0,
        "kills": {},
        "krezz": 40,
        "ngPlus": 0,
        "phase": "hub",
        "player": "FLENKY",
        "playtimeMs": 0,
        "quests": {},
        "reactionsGiven": {
          "ANGRY": 0,
          "LAUGH": 0,
          "LIKE": 0,
          "LOVE": 0,
          "SEEN": 0,
        },
        "relationships": {},
        "revisions": [],
        "tvWatched": [],
        "upgrades": {},
        "version": 4,
      }
    `);
  });

  it("a new game has the same fields whoever you play, and each lad's starting numbers", () => {
    const keys = Object.keys(newGameState("FLENKY")).sort();
    const rows: Record<string, string> = {};
    for (const p of PLAYABLE_ORDER) {
      const s = newGameState(p);
      expect(Object.keys(s).sort()).toEqual(keys);
      rows[p] = `hp ${s.hp} · max hp ${maxHp(s)} · max krezz ${maxKrezz(s)} · bottles ${s.bottles}/${maxBottles(s)} · damage ×${damageMult(s)} · enemy hp ×${enemyHpMult(s)} · enemy damage ×${enemyDamageMult(s)}`;
    }
    expect(rows).toMatchInlineSnapshot(`
      {
        "CRONGUS": "hp 80 · max hp 80 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "FLENKY": "hp 90 · max hp 90 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "GRONNY": "hp 160 · max hp 160 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "KREBLIS": "hp 95 · max hp 95 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "KREBON": "hp 140 · max hp 140 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "KREZMAR": "hp 85 · max hp 85 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "KREZWONK": "hp 80 · max hp 80 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "MIKEY": "hp 85 · max hp 85 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
        "SCROMBUS": "hp 90 · max hp 90 · max krezz 100 · bottles 2/3 · damage ×1 · enemy hp ×1 · enemy damage ×1",
      }
    `);
  });

  it("the playable characters' base stats", () => {
    const rows: Record<string, unknown> = {};
    for (const p of PLAYABLE_ORDER) {
      const c = CHARACTERS[p] as unknown as Record<string, unknown>;
      // every plain number on the definition (speed, hp, damage, cooldowns...), whatever they are called
      rows[p] = Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === "number").sort(([a], [b]) => a.localeCompare(b)));
    }
    expect(rows).toMatchInlineSnapshot(`
      {
        "CRONGUS": {
          "attackRate": 200,
          "color": 1558208,
          "damage": 12,
          "maxHp": 80,
          "range": 40,
          "speed": 220,
        },
        "FLENKY": {
          "attackRate": 230,
          "color": 3894527,
          "damage": 11,
          "maxHp": 90,
          "range": 46,
          "speed": 215,
        },
        "GRONNY": {
          "attackRate": 440,
          "color": 13657130,
          "damage": 15,
          "maxHp": 160,
          "range": 56,
          "speed": 170,
        },
        "KREBLIS": {
          "attackRate": 300,
          "color": 14173242,
          "damage": 10,
          "maxHp": 95,
          "range": 300,
          "speed": 195,
        },
        "KREBON": {
          "attackRate": 520,
          "color": 8003371,
          "damage": 22,
          "maxHp": 140,
          "range": 62,
          "speed": 165,
        },
        "KREZMAR": {
          "attackRate": 420,
          "color": 3124827,
          "damage": 13,
          "maxHp": 85,
          "range": 320,
          "speed": 190,
        },
        "KREZWONK": {
          "attackRate": 380,
          "color": 10181119,
          "damage": 12,
          "maxHp": 80,
          "range": 340,
          "speed": 190,
        },
        "MIKEY": {
          "attackRate": 95,
          "color": 5227511,
          "damage": 6,
          "maxHp": 85,
          "range": 300,
          "speed": 205,
        },
        "SCROMBUS": {
          "attackRate": 170,
          "color": 14716970,
          "damage": 9,
          "maxHp": 90,
          "range": 280,
          "speed": 185,
        },
      }
    `);
  });

  it("the guns table (damage, cooldown, speed, pellets, spread, range, ammo)", () => {
    const rows: Record<string, string> = {};
    for (const [id, g] of Object.entries(GUNS)) rows[id] = `dmg ${g.dmg} · cd ${g.cd} · speed ${g.speed} · pellets ${g.pellets} · spread ${g.spread} · range ${g.range} · ammo ${g.maxAmmo} · pickup ${g.pickup} · ch ${g.minChapter}`;
    expect(rows).toMatchInlineSnapshot(`
      {
        "bfk": "dmg 85 · cd 1300 · speed 520 · pellets 1 · spread 0 · range 560 · ammo 6 · pickup 2 · ch 1",
        "boggor_lens": "dmg 48 · cd 600 · speed 1300 · pellets 3 · spread 0.18 · range 700 · ammo 60 · pickup 10 · ch 99",
        "chainsaw": "dmg 11 · cd 55 · speed 520 · pellets 1 · spread 0.5 · range 70 · ammo 500 · pickup 120 · ch 1",
        "chem_flamer": "dmg 40 · cd 45 · speed 420 · pellets 6 · spread 0.55 · range 260 · ammo 9999 · pickup 999 · ch 6",
        "chips": "dmg 15 · cd 280 · speed 430 · pellets 2 · spread 0.35 · range 560 · ammo 160 · pickup 40 · ch 1",
        "dice": "dmg 27 · cd 660 · speed 600 · pellets 1 · spread 0 · range 480 · ammo 18 · pickup 5 · ch 1",
        "disco": "dmg 35 · cd 720 · speed 560 · pellets 1 · spread 0 · range 520 · ammo 14 · pickup 4 · ch 1",
        "flamer": "dmg 4 · cd 70 · speed 380 · pellets 4 · spread 0.5 · range 170 · ammo 320 · pickup 80 · ch 1",
        "flush": "dmg 14 · cd 420 · speed 780 · pellets 5 · spread 0.6 · range 480 · ammo 90 · pickup 25 · ch 1",
        "gatling": "dmg 5 · cd 45 · speed 680 · pellets 1 · spread 0.24 · range 380 · ammo 600 · pickup 150 · ch 1",
        "kreddler": "dmg 6 · cd 32 · speed 720 · pellets 1 · spread 0.2 · range 420 · ammo 900 · pickup 220 · ch 1",
        "loan": "dmg 52 · cd 720 · speed 950 · pellets 1 · spread 0 · range 700 · ammo 30 · pickup 8 · ch 1",
        "pistol": "dmg 12 · cd 230 · speed 600 · pellets 1 · spread 0.04 · range 420 · ammo 120 · pickup 30 · ch 1",
        "rail": "dmg 42 · cd 850 · speed 1300 · pellets 1 · spread 0 · range 760 · ammo 24 · pickup 6 · ch 3",
        "rocket": "dmg 30 · cd 800 · speed 620 · pellets 1 · spread 0 · range 520 · ammo 12 · pickup 3 · ch 4",
        "roulette": "dmg 9 · cd 760 · speed 560 · pellets 7 · spread 0.6 · range 250 · ammo 48 · pickup 12 · ch 1",
        "shotgun": "dmg 8 · cd 680 · speed 560 · pellets 6 · spread 0.55 · range 230 · ammo 40 · pickup 10 · ch 2",
        "slots": "dmg 9 · cd 170 · speed 650 · pellets 1 · spread 0.1 · range 440 · ammo 240 · pickup 60 · ch 1",
        "smg": "dmg 6 · cd 85 · speed 640 · pellets 1 · spread 0.18 · range 360 · ammo 260 · pickup 60 · ch 1",
        "sniper": "dmg 110 · cd 900 · speed 2200 · pellets 1 · spread 0 · range 1000 · ammo 32 · pickup 8 · ch 1",
      }
    `);
    // ...and everything else on it (names, blurbs, prices, special effects), as one hash
    expect(hash(JSON.stringify(GUNS))).toMatchInlineSnapshot(`"f55c9ae678f73378"`);
  });
});

describe("laptop invariants: controls", () => {
  it("every rebindable action and its default keys", () => {
    expect(ACTIONS.map((a) => `${a.id}: ${a.defaults.join(" / ")}  (${a.label})`)).toMatchInlineSnapshot(`
      [
        "up: W / UP  (Move up / jump)",
        "down: S / DOWN  (Move down / drop)",
        "left: A / LEFT  (Move left)",
        "right: D / RIGHT  (Move right)",
        "attack: J  (Attack (also left mouse))",
        "special: F / K  (Special (also right mouse))",
        "dodge: SPACE / SHIFT  (Dodge)",
        "interact: E  (Interact / talk)",
        "bottle: Q  (Drink pussy juice)",
        "bongo: B  (Fizzy bongo)",
        "burst: R / L  (Wonk Your Thang (Krezz))",
        "fart: G  (Fart)",
        "swap: X  (Swap gun)",
        "transform: T  (Golden transformation)",
        "cume: C  (Cumehameha (while golden))",
        "sanmik: V  (Mikey ⇄ SanMik (as Mikey))",
      ]
    `);
  });

  it("with nothing rebound, each action reads its default keys", () => {
    for (const a of ACTIONS) expect(keysFor(a.id)).toEqual(a.defaults);
  });

  it("default gamepad buttons", () => {
    expect({ PAD_START, PAD_DEFAULTS, PAD_FIXED, names: Array.from({ length: 17 }, (_, i) => padLabel(i)) }).toMatchInlineSnapshot(`
      {
        "PAD_DEFAULTS": {
          "attack": [
            7,
            0,
          ],
          "bongo": [
            15,
          ],
          "bottle": [
            14,
          ],
          "burst": [
            4,
          ],
          "cume": [
            11,
          ],
          "dodge": [
            1,
            5,
          ],
          "fart": [
            13,
          ],
          "interact": [
            2,
          ],
          "sanmik": [
            8,
          ],
          "special": [
            6,
            3,
          ],
          "swap": [
            12,
          ],
          "transform": [
            10,
          ],
        },
        "PAD_FIXED": {
          "down": "L-Stick ↓",
          "left": "L-Stick ←",
          "right": "L-Stick →",
          "up": "L-Stick ↑",
        },
        "PAD_START": 9,
        "names": [
          "A",
          "B",
          "X",
          "Y",
          "LB",
          "RB",
          "LT",
          "RT",
          "VIEW",
          "START",
          "L3",
          "R3",
          "D↑",
          "D↓",
          "D←",
          "D→",
          "HOME",
        ],
      }
    `);
    for (const id of Object.keys(PAD_DEFAULTS)) expect(padFor(id)).toEqual(PAD_DEFAULTS[id]);
  });
});

describe("laptop invariants: banter", () => {
  it("the banter levels and the default", () => {
    expect({ DEFAULT_BANTER, BANTER_NOTE, levels: BANTER_LEVELS }).toMatchInlineSnapshot(`
      {
        "BANTER_NOTE": "Only briefings and debriefings change. TV, the news and everything else are untouched.",
        "DEFAULT_BANTER": "max",
        "levels": [
          {
            "blurb": "Everything. Every in-joke, every reference, every tangent, every 'Breaking news…'. The full Krelworld.",
            "color": 16740264,
            "id": "max",
            "name": "MAX BANTER",
          },
          {
            "blurb": "A lighter trim: some of the tangents and back-and-forth go, the best bits stay.",
            "color": 16765503,
            "id": "moderate",
            "name": "MODERATE BANTER",
          },
          {
            "blurb": "Mostly the plot beats in briefings and debriefings. Some jokes stay; most of the in-jokes and repetition go.",
            "color": 6809849,
            "id": "exposition",
            "name": "EXPOSITION",
          },
        ],
      }
    `);
    expect([undefined, "loud", 3].map((v) => clampBanter(v))).toEqual(["max", "max", "max"]);
  });
});

describe("laptop invariants: saved data", () => {
  it("the save keys", () => {
    expect({ SAVE_VERSION, SAVE_KEY, META_KEY, AUTO_KEY, SLOTS_MIGRATED_KEY, slots: SLOT_IDS.map((id) => slotKey(id)), manual: [...MANUAL_SLOTS] }).toMatchInlineSnapshot(`
      {
        "AUTO_KEY": "krelworld.save",
        "META_KEY": "krelworld.meta",
        "SAVE_KEY": "krelworld.save",
        "SAVE_VERSION": 4,
        "SLOTS_MIGRATED_KEY": "krelworld.slots.v1",
        "manual": [
          1,
          2,
          3,
        ],
        "slots": [
          "krelworld.save",
          "krelworld.save.slot1",
          "krelworld.save.slot2",
          "krelworld.save.slot3",
        ],
      }
    `);
  });

  it("this is the normal build, and its storage keys are not prefixed", () => {
    expect(ALT).toBe(false);
    expect(isAlt()).toBe(false);
    expect(storageKey("krelworld.save")).toBe("krelworld.save");
  });

  it("where the game (outside src/game/mobile) touches localStorage, and with which keys", () => {
    const files: Record<string, string[]> = {};
    for (const p of Object.keys(SOURCES).sort()) {
      const src = SOURCES[p];
      const hits = new Set<string>();
      for (const m of src.matchAll(/storageKey\(([^)]*)\)/g)) hits.add(`storageKey(${m[1].trim()})`);
      for (const m of src.matchAll(/localStorage\s*\.\s*(getItem|setItem|removeItem|clear|key)\b/g)) hits.add(`localStorage.${m[1]}`);
      for (const m of src.matchAll(/sessionStorage\b/g)) hits.add(m[0]);
      if (hits.size) files[p.replace(/^\.\.\//, "")] = [...hits].sort();
    }
    expect(files).toMatchInlineSnapshot(`
      {
        "src/game/crashGuard.ts": [
          "localStorage.getItem",
          "localStorage.setItem",
          "storageKey(k)",
        ],
        "src/game/systems/state.ts": [
          "storageKey(k)",
        ],
        "src/game/variant.ts": [
          "storageKey(k: string)",
        ],
      }
    `);
  });
});

describe("laptop invariants: the page and the Phaser config", () => {
  it("index.html is byte for byte what it was", () => {
    expect({ length: indexHtml.length, hash: hash(indexHtml) }).toMatchInlineSnapshot(`
      {
        "hash": "38982101cc7f1371",
        "length": 1504,
      }
    `);
  });

  it("the Phaser game config and the scene list in main.ts", () => {
    const from = mainSrc.indexOf("new Phaser.Game({");
    const to = mainSrc.indexOf("\n});", from);
    expect(from).toBeGreaterThan(0);
    expect(mainSrc.slice(from, to + 4)).toMatchInlineSnapshot(`
      "new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game",
        width: 960,
        height: 540,
        backgroundColor: "#0b0710",
        pixelArt: true,
        roundPixels: true,
        disableContextMenu: true,
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { gamepad: true },
        scene: [
          BootScene,
          TitleScene,
          CharSelectScene,
          DifficultyScene,
          BanterScene,
          CutsceneScene,
          TownMeetingScene,
          DebugScene,
          ChapterSelectScene,
          HubScene,
          DungeonScene,
          UIScene,
          DialogueScene,
          TVScene,
          ArchiveScene,
          PubScene,
          KrazyFactScene,
          ExileScene,
          VignetteScene,
          MinigameScene,
          VenueScene,
          PitScene,
          PitLoanScene,
          ClubScene,
          KreddleScene,
          WhackScene,
          WeaponPickScene,
          EnterScene,
          HomeScene,
          DriveScene,
          BeepBeepScene,
          LairScene,
          FinaleScene,
          RoofCutscene,
          MenuScene,
          SaveSlotsScene,
          TutorialScene,
          EndingScene,
          PolsonHomeScene,
        ],
      });"
    `);
  });

  it("what main.ts installs, and in which order", () => {
    // (a phone hook may be added to main.ts: these laptop ones must all still be there, in this order)
    const calls = [...mainSrc.matchAll(/^(install\w+)\(/gm)].map((m) => m[1]).filter((n) => !/mobile|phone|touch/i.test(n));
    expect(calls).toMatchInlineSnapshot(`
      [
        "installPixelFonts",
        "installCalmFlash",
        "installJukebox",
        "installMoodMusic",
        "installMouseLock",
        "installFullscreenKeys",
        "installDebug",
        "installSaveWhere",
        "installCrashGuard",
      ]
    `);
  });
});

describe("laptop invariants: phone mode is off here", () => {
  it("any isMobile() the phone code exports says false in node (as it must on a laptop)", async () => {
    let checked = 0;
    for (const p of Object.keys(PHONE_TEXT)) {
      if (!/export\s+(function|const)\s+isMobile\b/.test(PHONE_TEXT[p])) continue;
      const mod = (await PHONE_MODULES[p]()) as { isMobile?: () => boolean };
      expect(typeof mod.isMobile).toBe("function");
      expect(mod.isMobile!()).toBe(false);
      checked++;
    }
    // (before the phone code exists there is nothing to check: that is fine)
    expect(checked).toBeGreaterThanOrEqual(0);
  });
});
