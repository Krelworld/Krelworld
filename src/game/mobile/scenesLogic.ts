// PHONE MODE, stage 3 wave 2 (the special scenes): the pure rules, unit-tested in node (tests/mobileScenes.test.ts).
//   - Night of Freedom's gun (DriveScene): where the gun aims on a phone (the finger is the crosshair, with a pull onto
//     a car near it), and where a ROCKET pressed with no finger down goes.
//   - Beep Beep's steering from the phone's left/right stick.
//   - The telly's subtitles paged at reading size (the same words, two lines at a time, over the line's own time).
//   - The narrator's how-to-play lines for these scenes in touch wording (narrator lines only; never a character's).
import type { WordingRule } from "./wording";

export interface Pt {
  x: number;
  y: number;
}

/** A car / van / helicopter / tank the gun can shoot (game px; `y` is the sprite's anchor, the game aims 30 px up). */
export interface GunFoe {
  id: number;
  x: number;
  y: number;
  kind: string;
}

/** How far from the finger (game px) a foe still pulls the aim onto itself ("normal" aim assist). */
export const GUN_SNAP = 90;
/** Once locked on, the pull reaches this much further, so the lock doesn't flicker at the edge. */
export const GUN_STICKY = 1.4;
/** The game aims at a foe this far above its anchor (DriveScene: `target.spr.y - 30`). */
export const AIM_UP = 30;

/** Where the gun aims at a foe (the game's own aim point). */
export function aimPointOf(f: GunFoe): Pt {
  return { x: f.x, y: f.y - AIM_UP };
}

/**
 * The game's own touch auto-aim (DriveScene, `ptr.wasTouch`): the live foe nearest the gun along the road (by x).
 * "Strong" aim assist on a phone is exactly this.
 */
export function nearestByX(foes: readonly GunFoe[], gunX: number): GunFoe | null {
  let best: GunFoe | null = null;
  for (const f of foes) if (!best || Math.abs(f.x - gunX) < Math.abs(best.x - gunX)) best = f;
  return best;
}

/**
 * The finger is the crosshair. With a pull (`radius` > 0) the aim goes onto the foe nearest the finger within
 * `radius` (the one already locked keeps it within `radius * GUN_STICKY`); otherwise straight at the finger.
 */
export function fingerAim(finger: Pt, foes: readonly GunFoe[], radius: number, locked: number | null = null): { at: Pt; lock: number | null } {
  if (radius > 0) {
    let best: GunFoe | null = null;
    let bd = Infinity;
    for (const f of foes) {
      const p = aimPointOf(f);
      const d = Math.hypot(p.x - finger.x, p.y - finger.y);
      const reach = f.id === locked ? radius * GUN_STICKY : radius;
      if (d > reach) continue;
      // (the locked one wins a near tie, so two cars side by side don't swap every frame)
      const score = f.id === locked ? d * 0.7 : d;
      if (score < bd) {
        bd = score;
        best = f;
      }
    }
    if (best) return { at: aimPointOf(best), lock: best.id };
  }
  return { at: { x: finger.x, y: finger.y }, lock: null };
}

/** What a rocket is best spent on, most first (the big ones take the most bullets). */
export const ROCKET_PRIORITY: Record<string, number> = { tank: 5, heli: 4, swat: 3, unmarked: 2, cop: 1 };

/** ROCKET pressed with no finger aiming: the biggest thing on screen (nearest the gun among equals), or null. */
export function rocketTarget(foes: readonly GunFoe[], gun: Pt, view = { x0: 0, x1: 960 }): GunFoe | null {
  let best: GunFoe | null = null;
  let bs = -Infinity;
  for (const f of foes) {
    if (f.x < view.x0 || f.x > view.x1) continue;
    const pr = ROCKET_PRIORITY[f.kind] ?? 0;
    const s = pr * 10000 - Math.hypot(f.x - gun.x, f.y - gun.y);
    if (s > bs) {
      bs = s;
      best = f;
    }
  }
  return best;
}

/** The phone's aim assist setting → the gun's scheme: "strong" is the game's auto-aim, else the finger (pull or not). */
export function gunScheme(assist: string): { auto: boolean; radius: number } {
  if (assist === "strong") return { auto: true, radius: 0 };
  if (assist === "off") return { auto: false, radius: 0 };
  return { auto: false, radius: GUN_SNAP };
}

// ------------------------------------------------------------------ Beep Beep

/** The stick's x (-1..1) → the game's digital steering (A / D held), with a small dead band. */
export function steerFromStick(mx: number, dead = 0.25): -1 | 0 | 1 {
  if (mx <= -dead) return -1;
  if (mx >= dead) return 1;
  return 0;
}

// ------------------------------------------------------------------ the telly's subtitles

/** Lines of the wrapped subtitle → pages of at most `per` lines (the same words, in order). */
export function pageLines(lines: readonly string[], per: number): string[] {
  const n = Math.max(1, Math.floor(per));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += n) out.push(lines.slice(i, i + n).join("\n"));
  return out;
}

/**
 * How long each page stays (ms): the line's whole time shared by length, never under `min`. `total` is the beat's own
 * time (systems/tv.ts beatDuration), so the last page is up before the show moves on.
 */
export function pageTimes(pages: readonly string[], total: number, min = 1400): number[] {
  const chars = pages.map((p) => Math.max(1, p.replace(/\s+/g, "").length));
  const sum = chars.reduce((a, b) => a + b, 0);
  return chars.map((c) => Math.max(min, Math.round((total * c) / sum)));
}

/** A TV subtitle's time on screen, as the telly's beat timer has it (systems/tv.ts: speaker 1.4 + 0.045 / char, ≤ 9 s). */
export function subtitleMs(text: string): number {
  const body = text.replace(/^[^:\n]{1,40}:\s*/, "");
  return Math.min(9, 1.4 + body.length * 0.045) * 1000;
}

// ------------------------------------------------------------------ narrator tips (touch wording, narrator lines only)

/**
 * The narrator's how-to-play lines in these scenes, in touch words (dialogue.ts applies NARRATOR_TIPS to narrator
 * lines only). Each rule swaps only the control words; the rest of the line is untouched.
 */
export const SCENE_NARRATOR_TIPS: WordingRule[] = [
  // Night of Freedom: "Hold the mouse (or your finger) to fire the machine gun: it never runs out. Right-click, Space
  // or F (or ROCKET) fires a rocket. Kills fill ...'s SLOPPY SURPRISE: press R / SLOPPY."
  { id: "nof-gun", re: /\bHold the mouse \(or your finger\) to fire the machine gun\b/g, to: "Hold a finger on whatever you want to shoot to fire the machine gun" },
  { id: "nof-rocket", re: /\bRight-click, Space or F \(or ROCKET\) fires a rocket\b/g, to: "ROCKET fires a rocket" },
  { id: "nof-sloppy", re: /\bpress R \/ SLOPPY\b/g, to: "tap SLOPPY when it lights up" },
  // the drawbridge: "MASH (tap / Space) to shift into the highest gear!"
  { id: "nof-mash", re: /\bMASH \(tap \/ Space\)/g, to: "MASH (tap anywhere)" },
  // Beep Beep: "steer with A / D (or the arrows, or hold your finger left or right of the wheel). W to floor it, S to
  // brake, SHIFT to boost. E (or H) honks the horn"
  {
    id: "bb-controls",
    re: /\bsteer with A \/ D \(or the arrows, or hold your finger left or right of the wheel\)\. W to floor it, S to brake, SHIFT to boost\. E \(or H\) honks the horn\b/g,
    to: "steer by dragging left or right on the left of the screen. Your foot's down all the time: BRAKE slows you, BOOST boosts. HORN honks the horn",
  },
  // the cannon (an airport side quest): "SPACE / TAP: ANGLE, then POWER." is a UI line (scenes.ts words it); the
  // dungeon's "Press E" lines are stage 1's
];

/** UI lines (Text objects the scenes draw) these scenes show in touch words on a phone. */
export const SCENE_UI_WORDING: WordingRule[] = [
  { id: "cannon-tip", re: /^SPACE \/ TAP: ANGLE, then POWER\./, to: "TAP: ANGLE, then POWER." },
];
