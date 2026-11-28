// The stadium announcer and the incidents the commentators cannot ignore.
// Deadpan throughout. Says less than it could.
import type { GameEvent } from "../core/bus";
import type { World } from "../core/world";
import { KICKOFF_AT, VENUE } from "./layout";
import { secs } from "./npc";

export interface Announcement { t: number; text: string; src: "tannoy" | "commentary"; big: boolean; key?: string }

const TEAMNAME: Record<string, string> = { ENG: "England", POR: "Portugal", ARG: "Argentina", BRA: "Brazil" };

const isOfficialish = (a: { npc?: { job: string } }) => !!a.npc && ["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief", "police"].includes(a.npc.job);

export class Announcer {
  private said = new Set<string>();
  private lastDelay = "";
  constructor(private w: World, private out: (a: Announcement) => void) {
    w.bus.on((e) => this.hear(e));
  }

  private incidentAt = -1e9;
  private once(key: string, text: string, src: Announcement["src"] = "tannoy", big = false): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.out({ t: this.w.state.tick, text, src, big, key });
  }

  /** Scheduled announcements. Call every tick. */
  tick(): void {
    const t = secs(this.w), m = this.w.state.match!;
    const opp = m.teams[1].name;
    if (t > 3) this.once("welcome", `Good afternoon and welcome to today's ${VENUE.round} between England and ${opp}.`);
    const st = this.w.state.stadium!, known = st.banned.includes(this.w.state.actors[st.pc]?.faceId ?? "");
    if (t > 22 && VENUE.features.faceCameras && known) this.once("facerec", "Supporters are advised that facial recognition cameras are in operation at every turnstile. Stewards are looking for a fat, bald man in his fifties. If you are a fat, bald man in his fifties, please make yourself known to a steward.");
    else if (t > 40 && VENUE.features.faceCameras) this.once("cameras", "Supporters are reminded that facial recognition is in operation at all turnstiles.");
    if (t > 60 && VENUE.features.penisDetector) this.once("detector", "Following recent incidents, a penis detector is now in operation at all turnstiles. Gentlemen, please have your penis ready for inspection. Thank you for your cooperation.");
    if (t > 90) this.once("lorry", "Supporters are reminded that the service road is for deliveries only.");
    if (t > 150) this.once("pitch", "Supporters are reminded that entering the field of play is a criminal offence.");
    if (t > KICKOFF_AT - 120) this.once("2min", "Kick-off is in two minutes. Please make your way to your seats.");
    if (t > KICKOFF_AT - 50) this.once("teams", "Please welcome the teams.");
  }

  private hear(e: GameEvent): void {
    const s = this.w.state, st = s.stadium!, pc = st.pc;
    const tn = (code: string | null) => (code ? TEAMNAME[code] ?? code : "unknown");
    switch (e.type) {
      case "incident":
        // (Once every two minutes at most: in a proper riot it was being read out over and over.)
        if (e.seen && e.severity >= 2 && e.blamed && e.t - this.incidentAt > 60 * 120) { this.incidentAt = e.t; this.out({ t: e.t, text: `Stewards are dealing with an incident involving a ${tn(e.blamed)} supporter.`, src: "tannoy", big: true }); }
        break;
      case "unmasked":
        if (e.outer === "a bus") { this.out({ t: e.t, text: "Security now believe the driver of the team bus may have been an Englishman wearing an England shirt.", src: "commentary", big: true }); break; }
        this.out({ t: e.t, text: e.football
          ? `Security now believe the person responsible may have been an ${e.now === "ENG" ? "Englishman" : "individual"} wearing two football shirts.`
          : `Security now believe the person responsible was an ${e.now === "ENG" ? "England supporter" : "individual"} wearing ${String(e.outer).toLowerCase()} over his shirt.`, src: "commentary", big: true });
        break;
      case "ejected":
        if (e.who === pc && !e.soft) this.out({ t: e.t, text: "A supporter has been escorted from the ground.", src: "commentary", big: false });
        break;
      case "detained":
        if (e.who === pc) this.out({ t: e.t, text: "A man is being held in the security office.", src: "commentary", big: false });
        break;
      case "arrested":
        if (e.who === pc) this.out({ t: e.t, text: "Police have made an arrest inside the ground.", src: "commentary", big: true });
        break;
      case "item_hit": {
        const tgt = s.actors[e.target];
        const what = e.itemDef === "pie" ? "a pastry" : e.itemDef === "pint" ? "a pint" : e.itemDef === "knife" ? "a kitchen knife" : "an object";
        if (tgt?.off?.job === "referee") this.out({ t: e.t, text: `The referee appears to have been struck by ${what}. ${e.itemDef === "knife" ? "He has gone down." : "Play continues."}`, src: "commentary", big: true });
        else if (tgt?.fb) this.out({ t: e.t, text: `${tgt.name} has been hit by ${what} thrown from the crowd.`, src: "commentary", big: true });
        break;
      }
      case "dose_kicks_in": {
        const a = s.actors[e.id];
        if (!a) break;
        if (a.off && e.effect === "laxative") this.out({ t: e.t, text: "The referee has left the field in some haste. Nobody appears to be in charge.", src: "commentary", big: true });
        else if (a.off) this.out({ t: e.t, text: "The referee appears unusually energetic.", src: "commentary", big: true });
        else if (e.effect === "wired") this.once(`wired${a.fb?.team}`, `${a.name} looks extremely keen this afternoon.`, "commentary", true);
        break;
      }
      case "fb_removed":
        if (e.reason === "toilet") this.out({ t: e.t, text: `${s.actors[e.id]?.name ?? "A player"} has left the field. He appears to be running towards the tunnel.`, src: "commentary", big: true });
        else if (e.reason === "injured") this.out({ t: e.t, text: `${s.actors[e.id]?.name ?? "A player"} has been taken off on a stretcher.`, src: "commentary", big: true });
        break;
      case "ref_back":
        this.out({ t: e.t, text: "The referee has returned. He looks pale.", src: "commentary", big: false });
        break;
      case "run_over":
        if (e.who === pc) this.out({ t: e.t, text: "Would a first-aider please attend the service road.", src: "tannoy", big: false });
        break;
      case "display_cancelled":
        this.out({ t: e.t, text: "Ladies and gentlemen, we regret that this afternoon's half-time parachute display has been cancelled. Due to a, er, missing parachute.", src: "tannoy", big: false, key: "display_off" });
        break;
      case "mascot_missing":
        this.out({ t: e.t, text: "Would Lenny the Lion please make his way to the players' tunnel. Lenny the Lion to the tunnel, please. The kids are waiting.", src: "tannoy", big: false, key: "lenny" });
        break;
      case "mascot_off":
        this.out({ t: e.t, text: "Ladies and gentlemen, we're sorry to say Lenny the Lion is, er, unwell today. He sends his love.", src: "tannoy", big: false, key: "lenny_off" });
        break;
      case "card_stolen":
        this.out({ t: e.t, text: "Security to the players' entrance, please. Security to the players' entrance.", src: "tannoy", big: false, key: "card" });
        break;
      case "pass_stolen":
        this.out({ t: e.t, text: "Could stewards please keep an eye out for a lost press accreditation. Thank you.", src: "tannoy", big: false, key: "press" });
        break;
      case "accident":
        this.out({ t: e.t, text: "Would a cleaner please attend the area immediately. Immediately.", src: "tannoy", big: false, key: "cleaner" });
        break;
      case "lager_off":
        this.out({ t: e.t, text: "Supporters are advised not to drink the lager. I repeat: do not drink the lager. The pies are, as far as we know, fine.", src: "tannoy", big: false, key: "lager" });
        break;
      case "fell_out":
        this.out({ t: e.t, text: "A man has fallen out of the back of a beer lorry.", src: "tannoy", big: false });
        break;
      case "impostor_ruling": {
        const lines: Record<string, string> = {
          penalty: "The referee has awarded England a penalty. It is not clear which referee.",
          sendoff: `${s.actors[e.target]?.name ?? "A player"} has been sent off by a referee we have not seen before.`,
          stop: "Play has been stopped by a referee who appears to be wearing trainers.",
          disallow: "The goal has been disallowed. The referee who scored it has not been consulted.",
          fulltime: "The referee has blown for full time. The fourth official is checking his watch.",
        };
        this.out({ t: e.t, text: lines[e.kind] ?? "The referee has made a decision.", src: "commentary", big: true });
        break;
      }
      case "two_refs":
        this.out({ t: e.t, text: "There appear to be two referees. Both now consider the other to have been dismissed.", src: "commentary", big: true });
        break;
      case "tipoff_arrest": {
        const a = s.actors[e.who];
        if (a?.fb) this.out({ t: e.t, text: `We're hearing that ${a.name} has been arrested. Police say they acted on information received.`, src: "commentary", big: true });
        break;
      }
      case "false_arrest": {
        const a = s.actors[e.who];
        if (a?.fb) this.out({ t: e.t, text: `${a.name} has been arrested for ${e.charge} by an officer who does not appear to be an officer.`, src: "commentary", big: true });
        break;
      }
      case "joined_match":
        this.once(`join${Math.floor(e.t / 600)}`, e.team === 0 ? "England appear to have brought on another player. We have not received confirmation of a substitution." : `${s.match!.teams[1].name} appear to have brought on a rather heavier player.`, "commentary", true);
        break;
      case "twelfth_man":
        this.out({ t: e.t, text: `The referee has stopped play. He appears to be counting.${e.disallowed ? " The goal has been disallowed." : ""}`, src: "commentary", big: true });
        break;
      case "dog_bite": {
        const a = s.actors[e.who];
        if (e.referee) this.out({ t: e.t, text: "The referee has been bitten by a dog. He has not given anything.", src: "commentary", big: true });
        else if (a?.fb) this.once(`bite${a.id}`, `${a.name} has been bitten by a dog. Play continues, for now.`, "commentary", true);
        break;
      }
      case "dog_loose":
        if (VENUE.inside(e.x, e.y)) this.once(`dogin${Math.floor(e.t / 1800)}`, "Would the owner of a pit bull terrier please make themselves known to a steward. Urgently.", "tannoy", false);
        break;
      case "dog_caught":
        this.once(`dogc${Math.floor(e.t / 1800)}`, "The dog has been apprehended. It is not thought to have had a ticket.", "commentary", false);
        break;
      case "bus_arrives":
        this.once("busin", `The ${s.match!.teams[1].name} team have arrived at the ground.`, "commentary", false);
        break;
      case "bus_crash":
        if (e.wall) {
          if (e.hurt.length) this.out({ t: e.t, text: `The ${s.match!.teams[1].name} squad were on board. ${e.hurt.length === 1 ? e.hurt[0] + " is" : e.hurt.length + " players are"} not expected to play.`, src: "commentary", big: true });
          break;
        }
        this.out({ t: e.t, text: `We're being informed that the ${s.match!.teams[1].name} team coach has been involved in an incident on its way to the ground.${e.hurt.length ? ` ${e.hurt.length === 1 ? e.hurt[0] + " is" : e.hurt.length + " players are"} not expected to play.` : ""}`, src: "commentary", big: true });
        break;
      case "kickoff_delayed": {
        const opp = s.match!.teams[1].name;
        const again = e.n > 1 && e.reason === this.lastDelay;
        this.lastDelay = e.reason;
        const T: Record<string, [string, string]> = {
          late: [`Ladies and gentlemen, kick-off has been delayed due to the late arrival of one of the teams.`, "delay_late"],
          referee: ["Ladies and gentlemen, kick-off has been briefly delayed while the referee receives attention.", "delay_ref"],
          pitch: ["Kick-off will be delayed until the pitch has been cleared.", "delay_pitch"],
          alarm: ["Kick-off has been delayed while the alarm is investigated.", ""],
          bomb: ["Ladies and gentlemen, due to a security alert, kick-off has been delayed. Please remain in your seats.", ""],
          safety: ["Kick-off has been delayed while engineers inspect damage to the stadium.", "delay_safety"],
        };
        const [text, key] = again ? ["Ladies and gentlemen, we apologise. Kick-off has been delayed again.", "delay_again"] : T[e.reason] ?? T.late;
        this.out({ t: e.t, text, src: "tannoy", big: true, key: key || undefined });
        if (e.n === 3) this.out({ t: e.t, text: `A third delay. The ${opp} bench are looking at their watches.`, src: "commentary", big: false });
        if (e.n === 5) this.out({ t: e.t, text: "The referee has been seen speaking to a man with a clipboard. That's never good.", src: "commentary", big: false });
        break;
      }
      case "kickoff_at_last":
        if (e.delays >= 2) this.out({ t: e.t, text: `${e.delays} delays later, the referee has decided enough is enough. We are under way.`, src: "commentary", big: true });
        break;
      case "forfeit":
        this.out({ t: e.t, text: e.team === "ENG" ? "Ladies and gentlemen, England have failed to take the field. The match has been awarded to the visitors." : "Ladies and gentlemen, the visiting team have failed to take the field. The match has been awarded to England.", src: "tannoy", big: true, key: e.team === "ENG" ? undefined : "forfeit" });
        break;
      case "bomb_threat":
        if (!e.pre) {
          this.out({ t: e.t, text: "Ladies and gentlemen, play has been suspended due to a security alert. Please remain calm and stay where you are.", src: "tannoy", big: true });
          this.out({ t: e.t, text: "The referee's taken the players off. Stewards are looking under the seats. One of them is eating what he found.", src: "commentary", big: false });
        }
        break;
      case "bomb_clear":
        this.out({ t: e.t, text: "Ladies and gentlemen, the alert is over. Play will resume. Thank you for your patience.", src: "tannoy", big: false });
        break;
      case "fire_alarm":
        this.out({ t: e.t, text: "Ladies and gentlemen, please do not be alarmed. Remain where you are while the alarm is investigated.", src: "tannoy", big: true, key: e.n <= 2 ? "alarm" : undefined });
        if (e.n === 2) this.out({ t: e.t, text: "The fire alarm again. Nobody appears to be leaving.", src: "commentary", big: false });
        if (e.n >= 3) this.out({ t: e.t, text: "Another fire alarm. The stewards have stopped looking for the fire and started looking for the man.", src: "commentary", big: false });
        break;
      case "breach":
        this.out({ t: e.t, text: e.ground
          ? `We're getting reports that a team coach has come through the wall of the ${String(e.into).replace(/^The /, "")}. It was not expected.`
          : `A team coach has been driven through the wall of ${e.into}.`, src: "commentary", big: true });
        if (e.ground) this.once("breach", "Would supporters please keep away from the damaged section of the outer wall.", "tannoy", false);
        break;
      case "killed": {
        const v = s.actors[e.who];
        if (e.referee) this.out({ t: e.t, text: "We're hearing the referee has been... I'm being told we can't say what's happened to the referee.", src: "commentary", big: true });
        else if (e.footballer && v) this.out({ t: e.t, text: `${v.name} is down, and he is not getting up. The medical staff have stopped running.`, src: "commentary", big: true });
        break;
      }
      case "body_found":
        if (!this.said.has("incident")) { this.said.add("incident"); this.out({ t: e.t, text: "Ladies and gentlemen, please remain calm and stay in your seats. Police are dealing with an incident inside the ground.", src: "tannoy", big: true, key: "incident" }); }
        break;
      case "armed_deployed":
        this.out({ t: e.t, text: "Armed officers have arrived at the ground. The atmosphere is described as \"tense\", and \"still quite good\".", src: "commentary", big: true });
        break;
      case "mauled": {
        const v = s.actors[e.who];
        if (v && e.footballer) this.out({ t: e.t, text: `${v.name} has been savaged by a dog. The physio is treating ${e.injury}.`, src: "commentary", big: true });
        else if (v && isOfficialish(v)) this.out({ t: e.t, text: `A steward has been mauled by a dog. Nobody is entirely sure whose side the dog is on.`, src: "commentary", big: false });
        break;
      }
      case "service_dog":
        if (e.ok) this.once("svcdog", "Would supporters please note that only registered assistance dogs are permitted in the ground.", "tannoy", false);
        break;
      case "security_level":
        if (e.level === 3) this.once("sec3", "Security has been visibly stepped up around the ground.", "commentary", false);
        if (e.level === 5) this.once("sec5", "Stewards have been told to treat everybody as a suspect. Which, to be fair, they already were.", "commentary", false);
        break;
      case "bus_stolen":
        this.once("stolen", `Would the driver of the ${s.match!.teams[1].name} team bus please return to his vehicle.`, "tannoy", false);
        break;
      case "bus_sanction":
        this.out({ t: e.t, text: e.reversed
          ? "Security now believe the driver may have been an Englishman. The governing body has reversed its decision. England have forfeited a goal."
          : `The stadium announcer has confirmed that ${s.match!.teams[1].name} have forfeited a goal, following an incident involving what officials believe to be the ${s.match!.teams[1].name} team bus.`, src: "tannoy", big: true });
        break;
      case "camera_flag":
        this.once(`cam${Math.floor(e.t / 3600)}`, "Would a supervisor please attend turnstile two.", "tannoy", false);
        break;
      case "smoke":
        if (e.onPitch) this.out({ t: e.t, text: "A smoke flare has landed on the pitch. Visibility is described as poor.", src: "commentary", big: true });
        else this.out({ t: e.t, text: "Would supporters please refrain from setting off flares.", src: "tannoy", big: false, key: "flares" });
        break;
      case "pitch_invasion":
        this.once(`inv${Math.floor(e.t / 1800)}`, "There appears to be a spectator on the pitch.", "commentary", true);
        break;
      case "fb_intruder_kick":
        if (e.actor === pc) this.once(`kick${Math.floor(e.t / 600)}`, "A spectator has kicked the ball. We have not received confirmation of a substitution.", "commentary", true);
        break;
    }
  }
}
