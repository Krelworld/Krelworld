import { applyLoadout } from "./systems/carry";
import type { GameState, MetaState, PlayableId, ReactionChoice } from "../data/types";
import { SaveManager, newGameState, unlockArchive, markWatched } from "./systems/state";
import { activeMods } from "../data/historicalRevisions";
import { maxHp } from "./systems/stats";
import { synth } from "./audio/Synth";
import { DRONGUS_SEQUENCES } from "../content/dialogue/drongusMessages";
import { evalCond } from "./systems/conditions";
import { applyReaction } from "./systems/reactions";
import { ARCHIVE_BY_ID } from "../content/archive/historicalScenes";
import { settleOldTrails } from "./systems/trails";
import type { SlotId } from "./systems/saveSlots";

type Listener = (ev: string, data?: any) => void;

/** The one shared game context. Scenes read and write the current run through this. */
class GameContext {
  saves = new SaveManager();
  meta: MetaState = this.saves.loadMeta();
  private _state: GameState | null = null;
  private listeners: Listener[] = [];
  /** Non-persistent runtime info. */
  rt = {
    dungeonId: "",
    room: 0,
    lastToastAt: 0,
    timerEnd: 0,
    /** Fart meter 0-100 (carried between rooms of one dungeon). */
    fart: 0,
    /** Wonk meter 0-100 (carried between rooms). */
    wonk: 0,
    /** Town time (ms) until the next chance of a posse beat-up. */
    beatupIn: undefined as number | undefined,
    /** Real time (ms) of Drongus's next old Facebook status, and the shuffled deck. */
    nextStatusAt: 0,
    statusDeck: [] as number[],
    /** The player swapped to the Fart Blaster on purpose (cleared on the next room). */
    fartByChoice: false,
    /** The bottled fairy has been used on this dungeon visit (she's back next time you walk in). */
    fairyUsed: false,
    /** How many guns were topped up walking into this dungeon (for the toast). */
    restocked: 0,
  };

  constructor() {
    synth.setVolumes(this.meta.settings);
  }

  get s(): GameState {
    if (!this._state) this._state = newGameState("FLENKY");
    return this._state;
  }

  hasRun(): boolean {
    return !!this._state;
  }

  newRun(player: PlayableId, ngPlus = 0, difficulty?: number) {
    this._state = newGameState(player, ngPlus, this.meta, difficulty);
    // (a fresh game plays the explore-before-the-dungeon trails: see settleOldTrails)
    this._state.flags.trails_v1 = true;
    // finished the game before: start with the kit you finished it with
    applyLoadout(this._state, this.meta.carry);
    this._state.hp = maxHp(this._state);
    this.rt.wonk = 0;
    this.rt.fart = 0;
    this.save();
  }

  /**
   * Where the player is and what they're doing, for the LOAD list (set up in saveWhere.ts, which can see the scenes).
   * Undefined fields keep whatever the run last had (e.g. a save made during a cutscene).
   */
  describe: (() => { where?: string; objective?: string }) | null = null;

  /** Load a slot as the current run (CONTINUE / LOAD GAME). A manual slot becomes the AUTO run from here on. */
  loadRun(slot: SlotId = "auto"): boolean {
    const st = this.saves.load(slot);
    if (!st) return false;
    // from now on autosaves carry this run, and CONTINUE comes back to it
    if (slot !== "auto") this.saves.save(st, "auto");
    this._state = st;
    settleOldTrails(st);
    if (this._state.hp > maxHp(this._state)) this._state.hp = maxHp(this._state);
    return true;
  }

  /** Autosave (the AUTO slot). Called all over the game. */
  save() {
    if (this._state) {
      this.stamp(this._state);
      this.saves.save(this._state);
    }
    this.saves.saveMeta(this.meta);
  }

  /** SAVE GAME from the pause menu: the run goes into a manual slot (and AUTO, as ever). */
  saveToSlot(slot: 1 | 2 | 3) {
    if (!this._state) return;
    this.save();
    this.saves.save(this._state, slot);
  }

  private stamp(s: GameState) {
    try {
      const d = this.describe?.();
      if (d?.where) s.where = d.where;
      if (d?.objective !== undefined) s.objective = d.objective || undefined;
    } catch {
      /* never let a label break a save */
    }
  }

  saveMeta() {
    this.saves.saveMeta(this.meta);
    synth.setVolumes(this.meta.settings);
  }

  mods() {
    return activeMods(this.s);
  }

  unlockArchive(id: string) {
    const fresh = unlockArchive(this.s, this.meta, id);
    if (fresh) this.emit("toast", { title: "HISTORICAL ARCHIVE UPDATED", text: ARCHIVE_BY_ID[id]?.title ?? id });
    return fresh;
  }

  watched(id: string) {
    markWatched(this.s, this.meta, id);
  }

  react(context: string, choice: ReactionChoice) {
    const eff = applyReaction(this.s, context, choice);
    synth.play("pop");
    this.emit("toast", { title: "REACTION", text: eff.toast });
    this.drongus(`react_${choice}`);
    return eff;
  }

  /** Fire Drongus message sequences for a trigger (Messenger toasts, spaced out). */
  drongus(trigger: string) {
    if (!this._state) return;
    const s = this._state;
    // ambient chatter (walking round town, the pub, the telly, standing still) is rationed: Drongus pipes up every few
    // minutes at most, like a witch's rhyme. Story moments (bosses, dungeons, Krazy Facts) always come through.
    const ambient = ["hub", "idle", "tv", "pub", "archive"].includes(trigger);
    if (ambient && !G_canDrongus()) return;
    for (const seq of DRONGUS_SEQUENCES) {
      if (seq.trigger !== trigger) continue;
      if (!seq.repeat && s.flags[`dseq_${seq.id}`]) continue;
      if (!evalCond(seq.cond, s)) continue;
      s.flags[`dseq_${seq.id}`] = true;
      if (ambient) G_drongusSpoke();
      seq.messages.forEach((m, i) => {
        window.setTimeout(() => this.emit("ping", { from: "DRONGUS", text: m }), 900 + i * 1700);
      });
      // no old Facebook status on top of a burst of messages: the next one waits 10s after the last message lands
      const last = Date.now() + 900 + (seq.messages.length - 1) * 1700;
      this.rt.nextStatusAt = Math.max(this.rt.nextStatusAt || 0, last + 10000);
      break;
    }
  }

  on(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(ev: string, data?: any) {
    for (const l of [...this.listeners]) l(ev, data);
  }
}

export const G = new GameContext();

/** When Drongus last chimed in unprompted (a status, or an ambient Messenger burst), shared by both. */
let lastDrongusAt = -Infinity;
let drongusGap = 150000;
/** Has it been long enough (2.5–4 minutes) since Drongus last chimed in? */
export function G_canDrongus() {
  return Date.now() - lastDrongusAt > drongusGap;
}
export function G_drongusSpoke() {
  lastDrongusAt = Date.now();
  drongusGap = 150000 + Math.random() * 90000;
}
