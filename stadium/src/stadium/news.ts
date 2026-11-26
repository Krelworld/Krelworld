// The evening news, read with complete seriousness. Built only from what happened.
import type { World } from "../core/world";
import { VENUE } from "./layout";

export interface Bulletin { headline: string; lines: string[] }

const TEAM: Record<string, string> = { ENG: "England", POR: "Portugal", ARG: "Argentina", BRA: "Brazil" };
const tn = (c: string | null) => (c ? TEAM[c] ?? c : "unidentified");

export function newsReport(w: World): Bulletin {
  const s = w.state, st = s.stadium!, m = s.match!, f = st.flags;
  const opp = m.teams[1].name;
  const mine = st.incidents.filter((i) => i.by === st.pc);
  const lines: string[] = [];
  const pens = m.shootout ? ` after a penalty shoot-out` : "";
  const score = `${m.score[0]}–${m.score[1]}`;

  // Headline.
  let headline: string;
  if (f.forfeit === 1) headline = `England through after ${opp} "fail to turn up"`;
  else if (f.forfeit === 2) headline = `England go out without kicking a ball`;
  else if (st.ending?.kind === "shot") headline = `Man shot dead by police at ${VENUE.round}`;
  else if (st.ending?.kind === "fell") headline = `Fan dies in fall from stand roof at ${VENUE.round}`;
  else if (f.killings) headline = `${f.killings === 1 ? "Death" : `${f.killings} deaths`} at England ${VENUE.round}`;
  else if (st.ending?.kind === "arrested") headline = `England supporter arrested at ${VENUE.round}`;
  else if (m.winner === 0) headline = f.refLax || f.impostorRulings || mine.some((i) => i.severity >= 2) ? `England through amid "unprecedented" scenes` : `England beat ${opp} to reach the ${VENUE.id === "qf" ? "semi-final" : "final"}`;
  else if (m.winner === 1) headline = `England knocked out by ${opp}`;
  else headline = `England's quarter-final ends in confusion`;

  if (f.forfeit) lines.push(f.forfeit === 1 ? `The match was awarded to England after ${opp} were unable to field a team. ${opp} say they "were there, more or less".` : `England were unable to field a team and the match was awarded to ${opp}.`);
  else if (m.phase === "finished") lines.push(`England ${m.winner === 0 ? "beat" : "lost to"} ${opp} ${m.winner === 0 ? score : `${m.score[1]}–${m.score[0]}`}${pens} this afternoon.`);
  else lines.push(`The match was still in progress when our reporter was asked to leave the building.`);

  const phantom = (m.physicalGoals[0] + m.physicalGoals[1]) - (m.score[0] + m.score[1]);
  if (phantom > 0) lines.push(`The ball crossed the line ${phantom === 1 ? "once" : `${phantom} times`} without a goal being awarded. Officials say this is "normal".`);
  if (f.impostorRulings) lines.push(`${f.impostorRulings === 1 ? "One decision was" : `${f.impostorRulings} decisions were`} made by a referee whom the governing body says it did not appoint.`);
  if (f.twoRefs) lines.push(`For a period, both referees considered the other to have been dismissed.`);
  if (f.refLax) lines.push(`The referee left the field during the second half and has asked that his tea be tested.`);
  if (f.refHit) lines.push(`The referee was struck by ${f.refHit === 1 ? "an object" : `${f.refHit} objects`} thrown from the crowd. He described the pie as "lukewarm".`);
  const toilet = Object.values(s.actors).filter((a) => a.fb?.goneReason === "toilet");
  if (toilet.length) lines.push(`${toilet.length === 1 ? `${toilet[0].name} left the field` : `${toilet.length} players left the field`} unexpectedly. Team doctors are examining the water.`);
  const arrested = Object.values(s.actors).filter((a) => a.fb?.goneReason === "arrested");
  if (arrested.length) lines.push(`${arrested.map((a) => a.name).join(" and ")} ${arrested.length === 1 ? "was" : "were"} arrested during the match.${f.plantedArrests ? " The player insists he has \"never seen it before in his life\"." : ""}${f.fakeCopFootballer ? " Police say the arresting officer was not one of theirs." : ""}`);
  if (f.falseArrests && !f.fakeCopFootballer) lines.push(`A man in a police uniform arrested ${f.falseArrests === 1 ? "a member of staff" : `${f.falseArrests} people`} at the ground. Police have appealed for the uniform back.`);
  if (f.pcGoals) lines.push(`${f.pcGoals === 1 ? "A goal was" : `${f.pcGoals} goals were`} scored by a player the ${f.pcOwnGoals ? `${opp} squad` : "England squad"} does not recognise. ${f.twelfthNoticedNews ? "" : "The result stands."}`);
  if (f.twelfthNoticed) lines.push(`At one point the referee counted twelve players on one side. "Eleven and a fat one," he said.`);
  if (f.dogBites) lines.push(`A dog called Tyson bit ${f.dogBites === 1 ? "one person" : `${f.dogBites} people`}${f.dogBitPlayers ? `, including ${f.dogBitPlayers === 1 ? "a player" : `${f.dogBitPlayers} players`}` : ""}${f.dogBitRef ? " and the referee" : ""}. His owner says he "has never done anything like this before, apart from the other times".`);
  if (f.busCrash) lines.push(`The ${opp} team bus crashed on the way to the ground. Police say the brakes had been "interfered with by someone who knew roughly what brakes are".`);
  if (f.busSanctioned === 1) lines.push(`${opp} were docked a goal after their team bus was involved in what officials called "scenes". ${opp} insist nobody from their squad can drive.`);
  if (f.busSanctioned === 2) lines.push(`A goal awarded against ${opp} over their team bus was later taken from England instead, when it emerged the driver was English.`);
  if (f.kickoffDelays) lines.push(`Kick-off was delayed ${f.kickoffDelays === 1 ? "once" : `${f.kickoffDelays} times`}${f.kickoffDelays >= 4 ? `, by a total of ${Math.round(f.kickoffDelays * 0.75)} minutes. Broadcasters filled the time with a documentary about drainage` : ""}.`);
  if (f.alarms) lines.push(`The fire alarm went off ${f.alarms === 1 ? "once" : `${f.alarms} times`}. There was no fire. ${f.alarms > 1 ? "There was, the club says, \"a pattern\"." : ""}`);
  if (f.breachAt) lines.push(`A team coach was driven through ${st.breaches.length > 1 ? "several walls" : "a wall"} at the ground. A structural engineer said the stadium was "fine, other than the hole".`);
  if (f.killings) lines.push(`${f.killings === 1 ? "One person was" : `${f.killings} people were`} stabbed to death at the ground. ${f.armedDeployed ? "Armed officers were deployed. " : ""}The match ${s.match!.phase === "pre" ? "did not go ahead" : "was not stopped"}.`);
  if (f.trophies) lines.push(`Police say parts of ${f.trophies === 1 ? "one victim" : "the victims"} have not been recovered. They have asked supporters to "check their pockets".`);
  if (f.maulings) lines.push(`A dog mauled ${f.maulings === 1 ? "one person" : `${f.maulings} people`}. Witnesses say it was "following instructions" from a heavy-set man in an England shirt.`);
  if (f.serviceDog) lines.push(`Stadium staff have been reminded that a Staffordshire bull terrier in a Stone Island collar is not an assistance animal.`);
  if (f.flares) lines.push(`${f.flares === 1 ? "A smoke flare was" : `${f.flares} smoke flares were`} let off. The army surplus store next to the ground says it "only sells them for boats".`);
  if (f.pitchInvasions) lines.push(`A spectator ran onto the pitch${f.pitchInvasions > 1 ? ` ${f.pitchInvasions} times` : ""}. He was described as "large" and "not quick".`);

  // Blame.
  const blamedOther = mine.filter((i) => i.blamed && i.blamed !== "ENG" && i.seenBy > 0);
  if (blamedOther.length && !f.unmasked) lines.push(`Police are seeking a ${tn(blamedOther[0].blamed)} supporter in connection with ${blamedOther[0].what}.`);
  if (f.unmasked) lines.push(f.unmaskedDisguise ? `Security now believe the man responsible was an England supporter in a disguise bought from a charity shop.` : `Security now believe the man responsible was an Englishman wearing two football shirts.`);
  if (f.stowaway) lines.push(`A man was found in the back of a beer lorry. He told staff he was "checking the barrels".`);
  if (f.runOver) lines.push(`A pedestrian was struck by a delivery lorry on the service road. He continued into the ground.`);
  if (f.accident) lines.push(`Cleaners were called to an incident the club has declined to describe.`);
  if (f.ejections) lines.push(`${f.ejections === 1 ? "One supporter was" : `${f.ejections} supporters were`} removed from the ground, ${f.ejections > 1 ? "all of them the same man" : "and later seen trying to get back in"}.`);
  if ((f.betWinnings ?? 0) >= 100) lines.push(`Bookmakers report a single customer winning £${f.betWinnings} on the match. They have described the result as "a coincidence".`);
  if ((f.betLosses ?? 0) >= 100 && !(f.betWinnings ?? 0)) lines.push(`One supporter lost £${f.betLosses} betting on the match. He said he "knew what he was doing".`);
  if (st.ending?.kind === "arrested") lines.push(`A 52-year-old man from Kent is helping police with their enquiries. He has asked for the score.`);
  if (lines.length < 3) lines.push(m.winner === 0 ? `Fans celebrated long into the evening.` : `Fans were described as "quiet" on the way home.`);
  lines.push(`The governing body says it is "looking into it".`);
  return { headline, lines };
}
