// The stadium announcer and the incidents the commentators cannot ignore.
// Deadpan throughout. Says less than it could.
import type { GameEvent } from "../core/bus";
import type { World } from "../core/world";
import { KICKOFF_AT } from "./layout";
import { secs } from "./npc";

export interface Announcement { t: number; text: string; src: "tannoy" | "commentary"; big: boolean; key?: string }

const TEAMNAME: Record<string, string> = { ENG: "England", POR: "Portugal", ARG: "Argentina", BRA: "Brazil" };

export class Announcer {
  private said = new Set<string>();
  constructor(private w: World, private out: (a: Announcement) => void) {
    w.bus.on((e) => this.hear(e));
  }

  private once(key: string, text: string, src: Announcement["src"] = "tannoy", big = false): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.out({ t: this.w.state.tick, text, src, big, key });
  }

  /** Scheduled announcements. Call every tick. */
  tick(): void {
    const t = secs(this.w), m = this.w.state.match!;
    const opp = m.teams[1].name;
    if (t > 3) this.once("welcome", `Good afternoon and welcome to today's quarter-final between England and ${opp}.`);
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
        if (e.seen && e.severity >= 2 && e.blamed) this.out({ t: e.t, text: `Stewards are dealing with an incident involving a ${tn(e.blamed)} supporter.`, src: "tannoy", big: true });
        break;
      case "unmasked":
        this.out({ t: e.t, text: e.football
          ? `Security now believe the person responsible may have been an ${e.now === "ENG" ? "Englishman" : "individual"} wearing two football shirts.`
          : `Security now believe the person responsible was an ${e.now === "ENG" ? "England supporter" : "individual"} wearing ${String(e.outer).toLowerCase()} over his shirt.`, src: "commentary", big: true });
        break;
      case "ejected":
        if (e.who === pc) this.out({ t: e.t, text: "A supporter has been escorted from the ground.", src: "commentary", big: false });
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
      case "accident":
        this.out({ t: e.t, text: "Would a cleaner please attend the area immediately. Immediately.", src: "tannoy", big: false, key: "cleaner" });
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
