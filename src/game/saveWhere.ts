import type Phaser from "phaser";
import { G } from "./G";
import { currentStep } from "./Flow";
import { DUNGEONS } from "../data/dungeons";

/**
 * Tells G what to write into a save's "where" / "objective" (the LOAD list shows them): which scene the player is
 * in, the dungeon room, or the nearest door in Krelford. Kept out of G so G needn't know about scenes.
 */

/** "THE KREZZ ARMS" -> "The Krezz Arms"; "→ KRELFORD INTERNATIONAL" -> "Krelford International". */
export function placeName(raw: string): string {
  const s = raw.replace(/\(.*?\)/g, "").replace(/[←→]/g, "").trim();
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'(])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
    .replace(/'S\b/g, "'s");
}

const ROOMS: Record<string, string> = {
  Home: "Krelford · Your House",
  Pub: "Krelford · The Krezz Arms",
  Club: "Krelford · The Wonky Pole",
  Kreddle: "The Kreddle Strip",
  Whack: "The Kreddle Strip",
  PolsonHome: "Krelford · Polson's House",
  Meeting: "Krelford Town Hall",
  Lair: "Da Drongus Dungeon · the top",
  Finale: "The Finale",
  Ending: "The End",
  Pit: "Krelford · The Krunch Pit",
  PitLoan: "Krelford · The Krunch Pit",
};

function dungeonWhere(id: string, room: number): string | undefined {
  const d = DUNGEONS[id];
  if (!d) return undefined;
  return `${d.name} · room ${Math.max(0, room) + 1}${d.rooms.length > 1 ? `/${d.rooms.length}` : ""}`;
}

function up(mgr: Phaser.Scenes.SceneManager, k: string) {
  try {
    return mgr.isActive(k) || mgr.isPaused(k) || mgr.isSleeping(k);
  } catch {
    return false;
  }
}

export function describeWhere(game: Phaser.Game): string | undefined {
  const mgr = game.scene;
  // a practice run in the Pit saves as the run you'd walk out with: you're in the Pit, not the dungeon
  if (G.rt.pit) return ROOMS.Pit;
  if (up(mgr, "Dungeon") && G.rt.dungeonId) return dungeonWhere(G.rt.dungeonId, G.rt.room);
  // a dungeon's detours (a drive, a minigame) come back into it
  for (const sc of mgr.getScenes(false)) {
    const d = sc.sys.settings.data as { resume?: { dungeon?: string; room?: number } } | undefined;
    if (d?.resume?.dungeon && up(mgr, sc.scene.key)) return dungeonWhere(d.resume.dungeon, d.resume.room ?? 0);
  }
  for (const k of Object.keys(ROOMS)) if (up(mgr, k)) return ROOMS[k];
  if (up(mgr, "Hub")) {
    // the nearest door in town, if you're stood by one
    const hub = mgr.getScene("Hub") as any;
    const av = hub?.av as { x: number; y: number } | undefined;
    const places: { name: string; x: number; y: number }[] | undefined = hub?.constructor?.PLACES?.();
    if (av && places?.length) {
      let best: { name: string; d: number } | null = null;
      for (const p of places) {
        const d = Math.hypot(p.x - av.x, p.y - av.y);
        if (!best || d < best.d) best = { name: p.name, d };
      }
      if (best && best.d < 280) return `Krelford · ${placeName(best.name)}`;
    }
    return "Krelford";
  }
  return undefined;
}

export function installSaveWhere(game: Phaser.Game) {
  G.describe = () => {
    let objective: string | undefined;
    try {
      objective = G.hasRun() ? currentStep()?.text : undefined;
    } catch {
      objective = undefined;
    }
    return { where: describeWhere(game), objective: objective ?? "" };
  };
}
