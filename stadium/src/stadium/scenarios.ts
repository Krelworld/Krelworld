// Hidden stories. Nothing on screen tells you about these: you find them by talking to people,
// listening, and trying daft things. Each pays off with something useful, or just a laugh.
//   Lonely Len has a spare ticket for "a lovely lady". Be one: a dress and a wig.
//   A stag do outside the pub has lost its stag. He was wearing a dress.
//   Mad Mick on the concourse will give fifty quid to whoever decks the referee.
//   Dave in the pub is an off-duty copper. His warrant card gets you through a turnstile.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { moveItem, spawnItem, canPocket } from "../core/items";
import { say, spawnStaff } from "./npc";
import { queue } from "./chatter";
import { canSee } from "./security";
import { incapacitated } from "./combat";
import { SPOTS, VENUE } from "./layout";

export const SECRETS = [
  { id: "len", title: "Lonely Len" },
  { id: "stag", title: "The stag do" },
  { id: "mick", title: "Mad Mick's bounty" },
  { id: "dave", title: "Off-duty Dave" },
  { id: "coat", title: "A kind stranger" },
];

const wearing = (w: World, a: Actor, def: string | string[]) => {
  const want = Array.isArray(def) ? def : [def];
  return Object.values(a.worn).some((id) => id && want.includes(w.state.items[id]?.def));
};

export function spawnScenarios(w: World): void {
  const s = w.state, st = s.stadium!;
  const len = spawnStaff(w, "local", "fan", "Lonely Len", SPOTS.tout.x - 6, SPOTS.tout.y + 2.5, { lines: [
    "Lovely day for it. Shame I've got nobody to share it with.",
    "Got a spare ticket and all. Was meant to be for my lady friend. She never turned up. Never does.",
    "If you see a lovely lady on her own, send her my way, eh? I'm a gentleman.",
  ] });
  len.npc!.post = { x: len.x, y: len.y };
  spawnItem(s, "ticket", { k: "pocket", a: len.id });
  const stag = ["Big Nige", "Sweaty Steve", "Gaz"].map((nm, i) => {
    const a = spawnStaff(w, "local", "fan", nm, SPOTS.pubYard.x + 3 + i * 0.8, SPOTS.pubYard.y - 3 + (i % 2) * 0.7, { lines: [
      ["Have you seen Robbo? Our stag? We've lost him. Again.", "Robbo's our stag. Last seen in a dress. As is tradition.", "If you find Robbo tell him we've still got the kitty."][i],
    ] });
    a.facing = i * 2;
    return a;
  });
  const ids: NonNullable<typeof st.scenarioIds> = (st.scenarioIds = { len: len.id, stag: stag.map((a) => a.id), dave: "" });
  if (VENUE.inside(SPOTS.barS.x, SPOTS.barS.y)) {
    const mick = spawnStaff(w, "fan", "fan", "Mad Mick", SPOTS.barS.x + 3, SPOTS.barS.y + 2.5, { lines: [
      "Fifty quid to anyone who decks that referee. I mean it. FIFTY.",
      "I'm not saying hurt him. I'm saying put him on his arse. Fifty quid.",
    ] });
    mick.npc!.team = 0; mick.npc!.post = { x: mick.x, y: mick.y };
    ids.mick = mick.id;
  }
  const dave = spawnStaff(w, "local", "fan", "Dave", SPOTS.pubBar.x + 2.4, SPOTS.pubBar.y + 1.2, { lines: [
    "Day off. Don't talk to me about work.",
    "Twenty years in the job. Day off, and I'm still looking at faces. Yours, for instance.",
    "If I see anything today, I didn't. I'm off duty.",
  ] });
  dave.npc!.post = { x: dave.x, y: dave.y };
  spawnItem(s, "warrant_card", { k: "pocket", a: dave.id });
  ids.dave = dave.id;
}

export function found(w: World, id: string): void {
  const st = w.state.stadium!;
  if (st.flags[`secret_${id}`]) return;
  st.flags[`secret_${id}`] = w.state.tick || 1;
  w.bus.emit({ type: "secret", t: w.state.tick, id, title: SECRETS.find((x) => x.id === id)?.title ?? id });
}

function giveTo(w: World, pc: Actor, def: string): void {
  const s = w.state, it = spawnItem(s, def, { k: "ground", x: pc.x, y: pc.y });
  if (canPocket(pc, it)) moveItem(s, it.id, { k: "pocket", a: pc.id });
  else if (!pc.hand) moveItem(s, it.id, { k: "hand", a: pc.id });
}

export function stepScenarios(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, f = st.flags, pc = s.actors[st.pc], ids = st.scenarioIds;
  if (!pc || !ids || tick % 20 !== 0) return;
  const ok = (a?: Actor) => !!a && !a.hiddenIn && !incapacitated(w, a) && a.downUntil <= tick && a.npc?.mode === "routine";
  const near = (a: Actor, r: number) => Math.hypot(a.x - pc.x, a.y - pc.y) < r;

  // Lonely Len: a dress and a wig, and he's smitten.
  const len = s.actors[ids.len];
  if (ok(len) && !f.secret_len && near(len, 5) && canSee(w, len, pc, 6) && wearing(w, pc, "dress") && wearing(w, pc, ["wig", "long_wig"])) {
    const tk = len.pockets.find((id) => s.items[id].def === "ticket");
    len.facing = Math.atan2(pc.y - len.y, pc.x - len.x);
    say(w, len, "Well, hello, gorgeous. I've got a spare ticket, if a lovely lady like yourself fancies it?", 4.5);
    if (tk) moveItem(s, tk, canPocket(pc, s.items[tk]) ? { k: "pocket", a: pc.id } : { k: "ground", x: pc.x, y: pc.y });
    queue(w, pc.id, "...Ta, love.", tick + 60 * 4.6);
    queue(w, len.id, "Save me a seat, sweetheart. And a kiss at half-time.", tick + 60 * 6.4);
    len.npc!.plan = [{ k: "wait", s: 7 }];
    found(w, "len");
  }

  // The stag do: anyone in a dress is Robbo.
  if (!f.secret_stag && wearing(w, pc, "dress")) {
    const lads = (ids.stag ?? []).map((id) => s.actors[id]).filter((a) => ok(a));
    const spotter = lads.find((a) => near(a, 6) && canSee(w, a, pc, 7));
    if (spotter) {
      say(w, spotter, "OI OI! THERE HE IS! ROBBO! THE STAG'S BACK!", 3.5);
      const [a2, a3] = lads.filter((a) => a !== spotter);
      if (a2) queue(w, a2.id, "Get the stag a pint! Here's the kitty, Robbo. Thirty quid. Don't spend it all on strippers.", tick + 60 * 3.4);
      if (a3) queue(w, a3.id, "Robbo, you've put weight on. And you've gone bald. Proper stag do, this.", tick + 60 * 7.2);
      queue(w, pc.id, "...Cheers, lads.", tick + 60 * 6);
      pc.money += 30;
      if (!pc.hand) giveTo(w, pc, "pint");
      found(w, "stag");
    }
  }

  // Mad Mick: the referee's been decked by someone. Was it you?
  const mick = ids.mick ? s.actors[ids.mick] : undefined;
  const ref = s.actors[s.match!.officials.referee];
  if (ok(mick) && !f.secret_mick && f.refDecked && near(mick!, 4)) {
    say(w, mick!, f.refDecked === 1 ? "That was YOU, weren't it?! LEGEND! Fifty quid, as promised." : "Someone decked the ref! I don't care who. You'll do. Here's twenty.", 4);
    pc.money += f.refDecked === 1 ? 50 : 20;
    found(w, "mick");
  }
  if (ref && !f.refDecked && incapacitated(w, ref)) f.refDecked = 2;

  // Dave: his card's gone. He's not happy.
  const dave = s.actors[ids.dave];
  if (dave && !f.secret_dave && [pc.hand, ...pc.pockets].some((id) => id && s.items[id]?.def === "warrant_card")) {
    found(w, "dave");
    if (ok(dave)) queue(w, dave.id, "Oi. Has anyone seen my... oh, for God's sake. Not again.", tick + 60 * 8);
  }
}

/** Who knocked out the referee (Mad Mick wants to know). */
export function noteKnockout(w: World, who: string, by?: string): void {
  const st = w.state.stadium!;
  if (who === w.state.match!.officials.referee && !st.flags.refDecked) st.flags.refDecked = by === st.pc ? 1 : 2;
}

export const secretCount = (w: World) => SECRETS.filter((x) => w.state.stadium!.flags[`secret_${x.id}`]).length;
