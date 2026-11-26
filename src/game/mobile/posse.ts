// PHONE MODE, stage 4: the posse's "BEAT UP <name>!" fight in town (scenes/hub/Beatup.ts) by touch (phones only).
//
// On a laptop the fight is E / F / SPACE. Its three canvas circles take clicks too, but they sit in a container that
// does not scroll while they themselves do, so in town (camera scrolled to about 1600,1252) a tap on a circle lands
// nowhere: on a phone the fight could not be played, the town was busy (no stick, no II) and only a reload got out
// (s4-01 B1). Here, from outside the game:
//   - three big thumb buttons, in the order the circles had (SHOVE under the left thumb; PUNCH and KICK under the
//     right, KICK in the corner: it is the finisher), each calling the fight's own press();
//   - the one the fight wants glows (the circle's pulse), the canvas circles and their [E] / [F] / [SPACE] hide;
//   - the II: the pause menu over the town (the town's own Esc path is shut while it is busy), whose clock holds the
//     fight's prompts while it is up.
import type Phaser from "phaser";
import { SCENE_RULES, addSceneRule, type SceneRule } from "./modes";
import { registerModeController, type TouchControl, type TouchLayer } from "./touchLayer";
import { placeControl, SLOTS, type Placed } from "./layout";
import { phoneSettings } from "./settings";
import { liveScene } from "./listScenes";

import { POSSE_MOVES, posseWanted, type PosseMove } from "./qaLogic";

type Bag = Record<string, any>;

export const POSSE_CSS = `
.kt-posse .kt-face{font:900 16px/1.05 Impact,system-ui,sans-serif;letter-spacing:.6px;color:#fff;text-shadow:0 1px 2px #000;border-width:3px}
.kt-posse-shove .kt-face{border-color:#60a5fa;background:rgba(96,165,250,.28)}
.kt-posse-punch .kt-face{border-color:#ef4444;background:rgba(239,68,68,.28)}
.kt-posse-kick .kt-face{border-color:#f59e0b;background:rgba(245,158,11,.28)}
.kt-posse.hot .kt-face{border-color:#fff;box-shadow:0 0 0 3px rgba(0,0,0,.45),0 0 20px rgba(255,255,255,.85);animation:ktPosseHot .22s ease-in-out infinite alternate}
.kt-posse-shove.hot .kt-face{background:rgba(96,165,250,.85)}
.kt-posse-punch.hot .kt-face{background:rgba(239,68,68,.85)}
.kt-posse-kick.hot .kt-face{background:rgba(245,158,11,.85)}
@keyframes ktPosseHot{from{transform:scale(1)}to{transform:scale(1.1)}}
`;

/** The fight running in town now (its Beatup), or null. */
export function posseFight(game: Phaser.Game): Bag | null {
  const hub = liveScene(game, "Hub");
  const b = hub?.beatup as Bag | null | undefined;
  return b && b.state === "fight" && b.ui ? b : null;
}


/** A slot mirrored to the other thumb (SHOVE under the left thumb; left-handed: the right). */
function mirrored(layer: TouchLayer, slot: keyof typeof SLOTS, size?: number): Placed | null {
  const vp = (layer as unknown as { viewport?: Parameters<typeof placeControl>[0] }).viewport;
  if (!vp) return null;
  const st = phoneSettings();
  const spec = size ? { ...SLOTS[slot], size } : SLOTS[slot];
  return placeControl(vp, spec, { leftHanded: !st.leftHanded, buttonSize: st.buttonSize });
}

export interface PosseStats {
  presses: Record<PosseMove, number>;
  fights: number;
}

export function installPosse(game: Phaser.Game, layer: TouchLayer) {
  if (typeof document !== "undefined" && !document.getElementById("kt-posse-css")) {
    const st = document.createElement("style");
    st.id = "kt-posse-css";
    st.textContent = POSSE_CSS;
    document.head.appendChild(st);
  }
  const stats: PosseStats = { presses: { shove: 0, punch: 0, kick: 0 }, fights: 0 };
  const c: Partial<Record<PosseMove, TouchControl>> = {};
  const press = (m: PosseMove) => {
    stats.presses[m]++;
    const b = posseFight(game);
    try {
      (b?.press as ((m: PosseMove) => void) | undefined)?.call(b, m);
    } catch {
      /* the fight ended under the finger */
    }
  };
  // in front of the walking row (a busy town reads as "none" there); after the screens and overlays, so the pause
  // menu and a conversation over the town still win
  const rule: SceneRule = {
    name: "posse fight",
    match: (k) => k === "Hub",
    decide: () => (posseFight(game) ? { mode: "tap", live: true, pause: "menu", pauseButton: true, posse: true } : null),
  };
  const at = SCENE_RULES.findIndex((r) => r.name === "walking");
  if (at >= 0) SCENE_RULES.splice(at, 0, rule);
  else addSceneRule(rule);

  registerModeController({
    id: "posse",
    mode: "tap",
    enter: ({ layer: l, decision }) => {
      if (!decision.posse) return;
      stats.fights++;
      c.shove = l.addControl({ id: "posse-shove", slot: "prime", group: "posse-l", className: "kt-c kt-posse kt-posse-shove", label: "SHOVE", haptic: "press", place: (ly) => mirrored(ly, "prime"), onDown: () => press("shove") });
      c.punch = l.addControl({ id: "posse-punch", slot: "left", group: "posse", className: "kt-c kt-posse kt-posse-punch", label: "PUNCH", haptic: "press", place: (ly) => {
        const p = ly.slots?.left;
        if (!p) return null;
        // (bigger than a plain "left" slot: a QTE wants a fat target)
        const vp = (ly as unknown as { viewport?: Parameters<typeof placeControl>[0] }).viewport;
        const st = phoneSettings();
        return vp ? placeControl(vp, { ...SLOTS.left, in: 158, up: 56, size: 72 }, st) : p;
      }, onDown: () => press("punch") });
      c.kick = l.addControl({ id: "posse-kick", slot: "prime", group: "posse", toCorner: true, className: "kt-c kt-posse kt-posse-kick", label: "KICK", haptic: "press", onDown: () => press("kick") });
      for (const k of POSSE_MOVES) c[k]?.show(true, true);
    },
    frame: ({ game: g, decision }) => {
      if (!decision.posse) return;
      const b = posseFight(g);
      const want = posseWanted(b);
      for (const k of POSSE_MOVES) c[k]?.el.classList.toggle("hot", want === k);
      // the canvas circles (and their key names) are the phone's buttons now
      const btns = b?.btns as Record<PosseMove, { c?: Bag; t?: Bag }> | undefined;
      if (btns) for (const k of POSSE_MOVES) {
        if (btns[k]?.c?.visible) btns[k].c!.setVisible(false);
        if (btns[k]?.t?.visible) btns[k].t!.setVisible(false);
      }
    },
    leave: ({ layer: l, decision }) => {
      if (!decision.posse) return;
      for (const k of POSSE_MOVES) {
        l.removeControl(`posse-${k}`);
        delete c[k];
      }
    },
  });
  return {
    stats,
    state: () => {
      const b = posseFight(game);
      return { fight: !!b, want: posseWanted(b), hits: (b?.hits as number | undefined) ?? null, shown: POSSE_MOVES.filter((k) => !!c[k]?.state().shown), stats };
    },
  };
}
