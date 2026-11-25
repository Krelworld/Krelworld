// Turns match events into deadpan lines. Says less than it could: restraint is the joke.
import type { Bus, GameEvent } from "../core/bus";
import { chance, seedRng, type RngState } from "../core/rng";
import type { World } from "../core/world";
import type { TeamIdx } from "./types";

export interface Line { t: number; text: string; big: boolean }

export class Commentator {
  private rng: RngState = seedRng("commentary");
  private lastAt = -999;
  private off: () => void;
  constructor(private w: World, bus: Bus, private say: (l: Line) => void) {
    this.off = bus.on((e) => this.hear(e));
  }
  stop(): void { this.off(); }

  private name(id: string | null | undefined): string {
    const a = id ? this.w.state.actors[id] : undefined;
    return a ? a.name : "someone";
  }
  private team(t: TeamIdx | number): string {
    const m = this.w.state.match!;
    return t === 0 || t === 1 ? m.teams[t].name : "nobody";
  }
  private scoreline(): string {
    const m = this.w.state.match!;
    return `${m.teams[0].name} ${m.score[0]}, ${m.teams[1].name} ${m.score[1]}.`;
  }
  /** Routine lines are dropped if something was said very recently. */
  private out(e: GameEvent, text: string, big = false): void {
    if (!big && e.t - this.lastAt < 150) return;
    this.lastAt = e.t;
    this.say({ t: e.t, text, big });
  }
  private maybe(p: number): boolean { return chance(this.rng, p); }

  private hear(e: GameEvent): void {
    const m = this.w.state.match;
    if (!m) return;
    switch (e.type) {
      case "fb_period_start":
        this.out(e, e.period === 1 ? "We're under way." : e.period === 2 ? "The second half is under way." : e.period === 3 ? "Extra time, then." : "Fifteen more minutes.", true);
        break;
      case "fb_goal":
        if (!e.legit) this.out(e, `The goal has been given. It does not appear to have been scored by a player. ${this.scoreline()}`, true);
        else if (e.og) this.out(e, `${this.name(e.by)} has put that into his own net. ${this.scoreline()}`, true);
        else this.out(e, `${this.name(e.by)} scores. ${this.scoreline()}`, true);
        break;
      case "fb_no_goal":
        this.out(e, "The referee has disallowed it. The scorer does not appear to be a player.", true);
        break;
      case "fb_save":
        if (this.maybe(0.45)) this.out(e, e.held ? `Held by ${this.name(e.by)}.` : `Saved by ${this.name(e.by)}.`);
        break;
      case "fb_miss":
        if (this.maybe(0.4)) this.out(e, `${this.name(e.by)} puts it wide.`);
        break;
      case "fb_woodwork":
        this.out(e, e.bar ? "Off the crossbar." : "Off the post.", true);
        break;
      case "fb_foul": {
        const victims = this.team(e.team === 0 ? 1 : 0);
        if (e.phantom) this.out(e, e.penalty ? "The referee points to the spot. Nobody had appealed." : `Free kick to ${victims}. It is not clear what for.`, true);
        else if (e.card === "red") this.out(e, `Straight red. ${this.name(e.by)} has been sent off.`, true);
        else if (e.card === "second_yellow") this.out(e, `A second yellow. ${this.name(e.by)} is off.`, true);
        else if (e.penalty) this.out(e, `Penalty to ${victims}.`, true);
        else if (e.card === "yellow") this.out(e, `${this.name(e.by)} goes into the book.`, true);
        else if (this.maybe(0.2)) this.out(e, `Free kick to ${victims}.`);
        break;
      }
      case "fb_foul_missed":
        if ((e.severity ?? 0) > 0.7) this.out(e, "The referee saw nothing wrong with that.", (e.severity ?? 0) > 1.1);
        break;
      case "fb_offside":
        if (e.wrong) this.out(e, "The flag is up. He looked level.");
        else if (this.maybe(0.35)) this.out(e, `Offside against ${this.name(e.by)}.`);
        break;
      case "fb_injury":
        this.out(e, e.leaves ? `${this.name(e.id)} cannot continue.` : `${this.name(e.id)} is down and receiving treatment.`, true);
        break;
      case "fb_sub":
        if (e.reason === "arrested") this.out(e, `${this.name(e.on)} replaces ${this.name(e.off)}, who is helping police with their enquiries.`, true);
        else this.out(e, `Substitution for ${this.team(e.team)}. ${this.name(e.on)} replaces ${this.name(e.off)}.`);
        break;
      case "fb_removed":
        this.out(e, e.reason === "arrested"
          ? `${this.name(e.id)} is being led away by police. We'll bring you more when we have it.`
          : `${this.name(e.id)} appears to have left the field.`, true);
        break;
      case "fb_emergency_keeper":
        this.out(e, `${this.name(e.id)} has gone in goal.`, true);
        break;
      case "fb_added":
        this.out(e, `The fourth official has indicated ${e.minutes} minute${e.minutes === 1 ? "" : "s"} of added time.`, true);
        break;
      case "fb_period_end":
        if (e.period === 1) this.out(e, `Half-time. ${this.scoreline()}`, true);
        else if (e.period === 2) this.out(e, m.score[0] === m.score[1] && m.cfg.knockout ? `Ninety minutes played. ${this.scoreline()} We go to extra time.` : `Full-time. ${this.scoreline()}`, true);
        else if (e.period === 4 && m.score[0] === m.score[1]) this.out(e, "It will be penalties.", true);
        break;
      case "fb_shootout_kick":
        this.out(e, `${this.name(e.by)} ${e.scored ? "scores" : "misses"}. ${m.teams[0].name} ${e.tally[0]}, ${m.teams[1].name} ${e.tally[1]} on penalties.`, true);
        break;
      case "fb_match_end":
        this.out(e, e.winner === -1 ? `It finishes level. ${this.scoreline()}` : `${this.team(e.winner)} are through.`, true);
        break;
      case "fb_ref_distracted":
        this.out(e, "The referee appears to be looking at something in the crowd.", true);
        break;
      case "fb_ref_down":
        this.out(e, "The referee is down. Play continues.", true);
        break;
      case "fb_ball_hit":
        if (this.w.state.actors[e.actor]?.off) { if (this.maybe(0.5)) this.out(e, "That struck the referee. Play continues."); }
        else this.out(e, "The ball has hit somebody who should not be on the pitch.", true);
        break;
      case "fb_halted":
        this.out(e, e.reason === "intruder" ? "The referee has stopped play. There is somebody on the pitch." : "Play has been stopped.", true);
        break;
      case "fb_resumed":
        this.out(e, "Play will restart with a dropped ball.");
        break;
      case "fb_dead_ball_net":
        this.out(e, "The ball is in the net. Play had already been stopped.", true);
        break;
      case "fb_intruder_kick":
        this.out(e, "A spectator has kicked the ball. We have not received confirmation of a substitution.", true);
        break;
    }
  }
}
