// Turns match events into deadpan lines. Says less than it could: restraint is the joke.
import type { Bus, GameEvent } from "../core/bus";
import { chance, rnd, seedRng, type RngState } from "../core/rng";
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
  private pick(lines: string[]): string { return lines[Math.floor(rnd(this.rng) * lines.length)]; }

  private hear(e: GameEvent): void {
    const m = this.w.state.match;
    if (!m) return;
    switch (e.type) {
      case "fb_period_start":
        this.out(e, e.period === 1 ? "We're under way." : e.period === 2 ? "The second half is under way." : e.period === 3 ? "Extra time, then." : "Fifteen more minutes.", true);
        break;
      case "fb_goal":
        if (e.late) this.out(e, `${e.og ? "The own goal" : `${this.name(e.by)}'s goal`} from earlier has been given, by somebody who was not there to see it. ${this.scoreline()}`, true);
        else if (e.legit && e.by === "pc") this.out(e, `${e.og ? "An own goal" : "A goal"} for ${this.team(e.team)}. The scorer is not on the team sheet. ${this.scoreline()}`, true);
        else if (!e.legit) this.out(e, `The goal has been given. It does not appear to have been scored by a player. ${this.scoreline()}`, true);
        else if (e.og) this.out(e, `${this.name(e.by)} has put that into his own net. ${this.scoreline()}`, true);
        else this.out(e, `${this.name(e.by)} scores. ${this.scoreline()}`, true);
        break;
      case "fb_no_goal":
        if (e.reason === "unrecognised") this.out(e, `${this.team(e.team)} did put the ball in the net earlier. Officially, they did not. ${this.scoreline()}`, true);
        else this.out(e, "The referee has disallowed it. The scorer does not appear to be a player.", true);
        break;
      // ---- Nobody refereeing: the commentators get steadily less sure what they are watching. ----
      case "fb_goal_pending":
        this.out(e, `${e.og ? "That is in his own net" : `${this.name(e.by)} has put that in the net`}. Whether it is a goal is a matter for a referee, and we have not got one.`, true);
        break;
      case "fb_foul_unjudged":
        if ((e.severity ?? 0) > 0.8 && this.maybe(0.5)) this.out(e, this.pick(["That is a foul. Nobody has given it. Nobody is going to.", "Late. Very late. There is nobody to tell.", "He has appealed to the referee out of habit."]));
        break;
      case "fb_clattered": {
        const p = e.power ?? 0;
        const lines = p < 0.5
          ? ["That was a little unnecessary.", `${this.name(e.on)} has been helped to the floor.`, "A coming together. Mostly one way."]
          : p < 0.8
            ? [`${this.name(e.on)} has been taken out at the waist. Play on, apparently.`, "That was not a tackle. I am not sure what that was.", `${this.name(e.by)} was nowhere near the ball. He did not seem to want to be.`]
            : [`${this.name(e.on)} has been thrown. Thrown.`, "I have stopped counting the men on the floor.", "This is still, technically, association football.", `${this.name(e.by)} has just run through a man he had no reason to be near.`];
        this.out(e, this.pick(lines), p >= 0.8 && this.maybe(0.3));
        break;
      }
      // ---- Sides that have been got at. ----
      case "fb_lunge":
        if (this.maybe(0.3)) this.out(e, this.pick([`${this.name(e.by)} left the ground some time before he arrived.`, `${this.name(e.by)} goes in from a postcode away.`, `That is a lunge from ${this.name(e.by)}. Both feet, for symmetry.`]));
        break;
      case "fb_confrontation":
        if (e.card === "second_yellow") this.out(e, `${this.name(e.by)} has talked himself into a second yellow. He is still talking.`, true);
        else if (e.card === "yellow") this.out(e, `${this.name(e.by)} has run thirty yards to have his say, and been booked for it.`, true);
        else this.out(e, this.w.state.actors[e.on]?.off ? `${this.name(e.by)} is explaining the laws of the game to the referee, from quite close.` : `${this.name(e.by)} and ${this.name(e.on)} are forehead to forehead. Handbags.`);
        break;
      case "fb_slip":
        if (this.maybe(0.5)) this.out(e, this.pick([`${this.name(e.by)} has gone over on nothing at all.`, `${this.name(e.by)} is down again. Nobody touched him. It is the boots.`, `${this.name(e.by)} cannot stay on his feet in those.`]));
        break;
      case "fb_heavy_touch":
        if (this.maybe(0.3)) this.out(e, this.pick([`A touch like a trampoline from ${this.name(e.by)}.`, `It has bounced off ${this.name(e.by)} and kept going.`, `${this.name(e.by)}'s first touch was a tackle.`]));
        break;
      case "fb_fluke":
        this.out(e, `${this.name(e.by)} has hit that from nowhere. I do not think it was a shot. I do not think he knows either.`, true);
        break;
      case "fb_bolted":
        this.out(e, `${this.name(e.id)} has stopped dead. He has gone a colour, and now he is running.`, true);
        break;
      case "fb_pulled_up":
        this.out(e, `${this.name(e.id)} has pulled up holding the back of his leg. That is what warm-ups are for.`, true);
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
        this.out(e, e.reason === "dog" ? "Play has been stopped. There is a dog on the pitch." : e.reason === "intruder" ? "The referee has stopped play. There is somebody on the pitch." : e.reason === "smoke" ? "Play has been stopped. Nobody can see the ball." : e.reason === "impostor" ? "Play has been stopped. By a referee." : "Play has been stopped.", true);
        break;
      case "fb_resumed":
        this.out(e, "Play will restart with a dropped ball.");
        break;
      case "fb_dead_ball_net":
        this.out(e, "The ball is in the net. Play had already been stopped.", true);
        break;
      case "fb_intruder_kick":
        if (!this.w.state.actors[e.actor]?.fb) this.out(e, "A spectator has kicked the ball. We have not received confirmation of a substitution.", true);
        break;
    }
  }
}
