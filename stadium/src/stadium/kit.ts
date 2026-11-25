// Pulling on a team's kit and playing. Team-mates pass to you, opponents kick you,
// and sooner or later the referee counts to twelve.
import { appearance } from "../core/identity";
import { chance } from "../core/rng";
import type { Actor } from "../core/types";
import type { World } from "../core/world";
import { haltPlay } from "../football/api";
import type { Footballer, TeamIdx } from "../football/types";
import { areaAt } from "./layout";
import { alert } from "./security";

function impostorFb(team: TeamIdx): Footballer {
  return {
    team, number: 12, role: "MID", slot: -2, star: false,
    pace: 0.12, passing: 0.3, shooting: 0.35, tackling: 0.2, control: 0.3, keeping: 0.05, aggression: 0.9, composure: 0.2, stamina: 0.1,
    status: "playing", fatigue: 0.5, yellows: 0, goals: 0,
    thinkAt: 0, tx: 0, ty: 0, sprint: false, intent: "position", kickLock: 0, tackleLock: 0, stunUntil: 0, gotBallAt: 0,
    diveAt: 0, diveUntil: 0, diveX: 0, diveY: 0, releaseAt: 0, bribed: false, wiredUntil: 0, controlled: true,
  };
}

/** Which team's kit he is wearing, if he is wearing one, as a match team index. */
function kitTeam(w: World, pc: Actor): TeamIdx | null {
  const m = w.state.match!, ap = appearance(w.state, pc);
  if (ap.role !== "footballer") return null;
  if (ap.team === m.teams[0].short) return 0;
  if (ap.team === m.teams[1].short || ap.team === "OPP") return 1;
  return null;
}

export function stepKit(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, pc = s.actors[st.pc];
  if (!pc) return;
  const team = kitTeam(w, pc);
  const onPitch = areaAt(pc.x, pc.y).pitch === true && !pc.hiddenIn && !pc.heldBy;
  const inPlay = m.phase === "live" || m.phase === "restart" || m.phase === "goal_pause";
  const joined = !!pc.fb;
  if (!joined && team !== null && onPitch && inPlay) {
    pc.fb = impostorFb(team);
    m.teams[team].squad.push(pc.id);
    st.flags.joinedAt = s.tick;
    w.bus.emit({ type: "joined_match", t: s.tick, team });
    return;
  }
  if (joined && (team === null || !onPitch || !inPlay || pc.fb!.team !== team)) {
    const t = pc.fb!.team;
    m.teams[t].squad = m.teams[t].squad.filter((id) => id !== pc.id);
    if (m.ball.owner === pc.id) { m.ball.owner = null; }
    delete pc.fb;
    w.bus.emit({ type: "left_match", t: s.tick });
    return;
  }
  if (!joined) return;
  // The referee counts. Closer to the play, and the longer it goes on, the likelier he notices.
  const ref = s.actors[m.officials.referee];
  if (st.flags.twelfthNoticed || ref.downUntil > s.tick || ref.off!.incapacitated || ref.off!.distractedUntil > s.tick) return;
  if (s.tick % 60 !== 0) return;
  const d = Math.hypot(ref.x - pc.x, ref.y - pc.y), secsOn = (s.tick - (st.flags.joinedAt ?? s.tick)) / 60;
  const p = Math.min(0.5, 0.02 + (d < 20 ? 0.05 : 0) + (m.ball.owner === pc.id ? 0.08 : 0) + secsOn * 0.002);
  if (!chance(s.rng.world, p)) return;
  st.flags.twelfthNoticed = 1;
  const team2 = pc.fb!.team;
  // A goal he scored in the last minute is taken back.
  const recent = st.flags.pcGoalAt && s.tick - st.flags.pcGoalAt < 60 * 60;
  if (recent && m.score[team2] > 0) m.score[team2]--;
  haltPlay(w, "extra");
  w.bus.emit({ type: "twelfth_man", t: s.tick, team: team2, disallowed: !!recent });
  for (const id in s.actors) { const g = s.actors[id]; if (g.npc?.job === "pitchsteward") alert(w, g, pc, 2, 2); }
}
