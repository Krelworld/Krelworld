// The match as director (the report: "the football should be promoted to the dynamic director of the
// second half of the game"). One job at a time, read straight off the match: the score, the clock and
// who's still standing. Behind with their keeper untouched? Get at their keeper. Ahead late? Waste
// time. It names a target where there is one (the view rims them), never a route: how is up to you.
// Read-only.
import type { World } from "../core/world";
import { FIXES, theirKeeper, theirStar } from "./fixes";

export interface Job { id: string; short: string; text: string; target?: string; urgent: boolean }

const done = (w: World, id: "star" | "keeper" | "ref") => FIXES.find((f) => f.id === id)!.done(w);

export function matchJob(w: World): Job | null {
  const s = w.state, m = s.match;
  if (!m || m.phase === "pre" || m.phase === "finished") return null;
  const half = m.cfg.halfSeconds, p = Math.min(1, ((Math.min(m.period, 2) - 1) * half + m.clock) / (2 * half));
  const left = Math.max(1, Math.round((1 - p) * 90)), diff = m.score[0] - m.score[1];
  const score = `${m.score[0]}–${m.score[1]}`;
  const star = theirStar(w), keeper = theirKeeper(w), ref = s.actors[m.officials.referee];
  const no = star?.fb?.number ?? 10;
  if (m.phase === "shootout") return done(w, "keeper") ? { id: "pens", short: "Penalties. Pray.", text: "Penalties. Their keeper's been seen to. Now pray.", urgent: true }
    : { id: "pens-gk", short: "Penalties: their keeper", text: "Penalties. Their keeper's the difference. Anything that puts him off.", target: keeper?.id, urgent: true };
  if (m.phase === "break") return { id: "ht", short: "Half-time: they're all off their posts", text: `Half-time, ${score}. Dressing rooms, the ref's tea, the kit men: everyone's away from their usual spot.`, urgent: false };
  // Behind: we need a goal. Their keeper first, then the ref, then anything.
  if (diff < 0) {
    if (!done(w, "keeper")) return { id: "behind-gk", short: `${score} down: their keeper`, text: `England ${score} down. We need a goal, and their keeper's in the way.`, target: keeper?.id, urgent: p > 0.7 };
    if (!done(w, "ref")) return { id: "behind-ref", short: `${score} down: the ref`, text: `England ${score} down. Get the ref seeing things our way.`, target: ref?.id, urgent: p > 0.7 };
    return { id: "behind-any", short: `${score} down: anything`, text: `England ${score} down, ${left} minutes left. Anything: the pitch, the ball, the fire alarm.`, urgent: true };
  }
  // Ahead and it's getting late: run the clock down.
  if (diff > 0 && p >= 0.6) return { id: "ahead-late", short: `${score} up: waste time`, text: `England ${score} up, ${left} minutes left. Waste time: keep the ball, stop the game, anything.`, urgent: p > 0.85 };
  if (diff > 0) return !done(w, "star") ? { id: "ahead-star", short: `${score} up: stop their No.${no}`, text: `England ${score} up. Their number ${no} is the one who'll get them back in it.`, target: star?.id, urgent: false }
    : { id: "ahead", short: `${score} up: hold on`, text: `England ${score} up. Their danger man's gone. Hold on.`, urgent: false };
  // Level.
  if (p >= 0.75) return { id: "level-late", short: `${score}, ${left} mins: chaos`, text: `${score} with ${left} minutes left. One moment of chaos wins this.`, target: !done(w, "keeper") ? keeper?.id : undefined, urgent: true };
  if (!done(w, "star")) return { id: "level-star", short: `Stop their No.${no}`, text: `${score}. Their number ${no} is running the game. Stop him and they've got nothing.`, target: star?.id, urgent: false };
  if (!done(w, "keeper")) return { id: "level-gk", short: "Their keeper next", text: `${score}. Their number ${no}'s been seen to. Their keeper next.`, target: keeper?.id, urgent: false };
  if (!done(w, "ref")) return { id: "level-ref", short: "The ref next", text: `${score}. Get the ref on our side.`, target: ref?.id, urgent: false };
  return { id: "level", short: `${score}: make it happen`, text: `${score}. Everything's fixed. Now England just have to score.`, urgent: false };
}
