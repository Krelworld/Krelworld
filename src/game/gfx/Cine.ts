import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { G } from "../G";
import * as Juice from "./Juice";
import { CINE, type CineStep } from "../../content/cine";

/**
 * Anime "cine beats" for the story moments of chapters 1-5: a short run of drawn stills (`<key>_anim` sheets play
 * through, see Juice.animated), whip-pan cut-ins, eye shots, slams, speed lines, impact frames, title cards and
 * stingers, played over whatever scene is up.
 *
 * A beat is named, and a dialogue line can carry one (`cine: "ch3_unmask"` on a Line): the DialogueBox hides itself,
 * plays the beat, then shows the line. Scenes can also call playCine() directly.
 *
 * Every beat is skippable: a click / tap or Enter cuts the rest of the beat; Tab does too, and in dialogue it skips the
 * rest of the script as well (the box's own Tab). Missing art is simply left out. "Reduce flashing" dims the flashes
 * and drops the impact frames (Juice does both). A still can name a `goreOff` replacement for when gore is off.
 *
 * The beats themselves are data, in content/cine.ts.
 */

export { CINE, cineKeys, type CineStep } from "../../content/cine";

/** Cine layers sit above every scene's HUD and dialogue (the box hides itself while one plays anyway). */
export const CINE_DEPTH = 7000;
const D = {
  lines: CINE_DEPTH,
  impact: CINE_DEPTH + 2,
  still: CINE_DEPTH + 4,
  cut: CINE_DEPTH + 6,
  slam: CINE_DEPTH + 8,
  title: CINE_DEPTH + 9,
  flash: CINE_DEPTH + 10,
};

// ---------------------------------------------------------------- playing them

const alive = (sc: Phaser.Scene) => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN && !!sc.cameras?.main;

/** Has this beat any art to show (or is it all words and sound)? Missing art is skipped step by step. */
function hasArt(sc: Phaser.Scene, st: CineStep): boolean {
  if ("still" in st) return sc.textures.exists(st.still);
  if ("cut" in st) return sc.textures.exists(st.cut);
  if ("eyes" in st) return sc.textures.exists(st.eyes);
  return true;
}

/**
 * Play a named beat (or a list of steps). Resolves when it's over or skipped. `skipped()` is asked before every
 * step (the dialogue box passes its own "Tab was pressed" so a skipped script skips its beats too).
 */
export function playCine(sc: Phaser.Scene, beat: string | CineStep[], skipped: () => boolean = () => false): Promise<void> {
  const steps = typeof beat === "string" ? CINE[beat] : beat;
  if (!steps?.length || !alive(sc) || skipped()) return Promise.resolve();
  const t0 = performance.now();
  let cut = false;
  let wake: (() => void) | null = null;
  const skip = () => {
    // (a grace period, so the press that closed the last line doesn't skip this before it starts)
    if (cut || performance.now() - t0 < 350) return;
    cut = true;
    wake?.();
  };
  const onKey = (e: KeyboardEvent) => {
    // (not Space / E: those mash through dialogue, and a mash shouldn't eat the beat)
    if (e.key === "Tab" || e.key === "Enter") skip();
  };
  window.addEventListener("keydown", onKey);
  sc.input?.on("pointerdown", skip);
  const hint = sc.add.text(944, 528, "click / Tab: skip", { fontFamily: "monospace", fontSize: "11px", color: "#9ca3af" }).setOrigin(1, 1).setAlpha(0.8);
  Juice.layer(sc, D.flash + 1).add(hint);

  /** Run one step; resolves when it's done (or when the beat is cut). */
  const run = (st: CineStep): Promise<void> => {
    if (cut || !alive(sc)) return Promise.resolve();
    if ("par" in st) return Promise.all(st.par.map(run)).then(() => undefined);
    if (!hasArt(sc, st)) return Promise.resolve();
    if ("still" in st) {
      // gore off: the clean version, or nothing at all if there isn't one
      const key = G.meta?.settings?.gore === false && st.goreOff !== undefined ? st.goreOff : st.still;
      if (!key || !sc.textures.exists(key)) return Promise.resolve();
      return Juice.still(sc, key, st.ms ?? 1800, { depth: D.still, push: st.push, shakeK: st.shake, flipX: st.flipX });
    }
    if ("cut" in st) return Juice.cutIn(sc, st.cut, { from: st.from, color: st.color, hold: st.hold, focus: st.focus, y: st.y, flipX: st.flipX, depth: D.cut });
    if ("eyes" in st) return Juice.eyeShot(sc, st.eyes, st.ms ?? 800, { depth: D.still, color: st.color });
    if ("slam" in st) {
      Juice.slamText(sc, st.slam, st.color, st.size, st.y, st.hold, D.slam);
      return Juice.realWait(160 + (st.hold ?? 1100) * 0.6);
    }
    if ("title" in st) return Juice.titleCard(sc, st.kicker ?? "", st.title, st.clock ?? "", st.hold ?? 1800, D.title, st.y);
    if ("flash" in st) {
      Juice.flash(sc, st.flash, st.ms, st.alpha, D.flash);
      return Promise.resolve();
    }
    if ("impact" in st) return Promise.race([Juice.impactFrames(sc, null, 60, D.impact), Juice.realWait(200)]);
    if ("lines" in st) {
      Juice.speedLines(sc, st.ms ?? 900, st.lines, D.lines);
      return Promise.resolve();
    }
    if ("sfx" in st) {
      Juice.duckMusic(1800, 700, 0.25);
      synth.play(st.sfx, st.vol ?? 1);
      return Promise.resolve();
    }
    if ("sting" in st) {
      if (st.sting === "riser") Juice.riser(st.ms ?? 1200);
      else if (st.sting === "subDrop") Juice.subDrop();
      else if (st.sting === "heartbeat") Juice.heartbeat();
      else if (st.sting === "whoosh") Juice.whoosh();
      else Juice.duckMusic(st.ms ?? 1500);
      return Promise.resolve();
    }
    if ("wait" in st) return Juice.realWait(st.wait);
    return Promise.resolve();
  };

  const finish = () => {
    window.removeEventListener("keydown", onKey);
    sc.input?.off("pointerdown", skip);
    if (!alive(sc)) return;
    hint.destroy();
    // a cut beat: sweep whatever's still on screen
    if (cut) for (const d of Object.values(D)) Juice.layer(sc, d).removeAll(true);
  };

  return (async () => {
    for (const st of steps) {
      if (cut || skipped() || !alive(sc)) break;
      // each step races the skip
      await Promise.race([run(st), new Promise<void>((r) => (wake = r))]);
      wake = null;
    }
    finish();
  })();
}
