import Phaser from "phaser";
import { bossAnims } from "../combat/Bosses";
import { playerKey } from "../gfx/sanmikForm";
import { sanmikActive } from "../systems/sanmik";
import { backdrop, charMeta } from "../gfx/HD";
import { MEETINGS } from "../../content/meetings";
import type { MeetingScript, SpeakerId } from "../../data/types";
import { REACTION_EMOJI } from "../../data/types";
import { DialogueBox } from "../ui/DialogueBox";
import { G } from "../G";
import { goNext, type Next } from "../Flow";
import { CHARACTERS, LADS } from "../../data/characters";
import { synth } from "../audio/Synth";
import { FONT, hexStr, UI } from "../ui/theme";
import { CANON } from "../../content/archive/canonQuotes";
import { say } from "../../content/dsl";

interface Seat {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  plate: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

/** The horseshoe table. Present-day meetings seat the whole cabinet + Proctus; archive meetings seat whoever spoke. */
export class TownMeetingScene extends Phaser.Scene {
  private seats: Record<string, Seat> = {};
  private agendaTexts: Phaser.GameObjects.Text[] = [];
  private lineCount = 0;
  private reactCounts: Record<string, number> = { LIKE: 0, LOVE: 0, LAUGH: 0, ANGRY: 0, SEEN: 0 };
  private reactText!: Phaser.GameObjects.Text;
  private screenText!: Phaser.GameObjects.Text;

  constructor() {
    super("Meeting");
  }

  create(data: { id: string; next?: Next }) {
    const m: MeetingScript | undefined = MEETINGS[data.id];
    this.seats = {};
    this.agendaTexts = [];
    this.lineCount = 0;
    this.speaking = null;
    this.platesDown = false;
    this.talkBob = undefined;
    this.reactCounts = { LIKE: 0, LOVE: 0, LAUGH: 0, ANGRY: 0, SEEN: 0 };
    if (!m) {
      goNext(this, data.next);
      return;
    }
    const { width: W, height: H } = this.scale;
    this.cameras.main.fadeIn(350);
    synth.music("meeting");
    this.drawRoom(m, W, H);
    this.placeSeats(m, W);
    // title card
    const card = this.add.container(W / 2, H / 2).setDepth(2000);
    card.add(this.add.rectangle(0, 0, W, 140, 0x000000, 0.85));
    card.add(this.add.text(0, -24, m.title, { fontFamily: FONT, fontSize: "30px", color: "#ffd23f", fontStyle: "bold" }).setOrigin(0.5));
    card.add(this.add.text(0, 18, m.subtitle ?? "", { fontFamily: FONT, fontSize: "15px", color: "#ff6fa8" }).setOrigin(0.5));
    if (m.historical) card.add(this.add.text(0, 46, "ARCHIVE RECONSTRUCTION — ORIGINAL SPEAKERS", { fontFamily: FONT, fontSize: "11px", color: "#c8b88a" }).setOrigin(0.5));
    this.tweens.add({ targets: card, alpha: 0, delay: 1600, duration: 500, onComplete: () => card.destroy() });

    const box = new DialogueBox(this, 1000, 0.12);
    const beats = this.withSanmikMoment(m);
    this.time.delayedCall(1900, () => {
      box
        .play(beats, {
          historical: m.historical,
          onSpeaker: (sp) => this.highlight(sp),
          onLine: (l) => {
            this.onLine(l.t, l.notify, l.s);
            if (l.fx) this.fx(l.fx);
          },
          onReact: (_c, ch) => {
            this.reactCounts[ch] = (this.reactCounts[ch] ?? 0) + 1;
            this.updateReactDisplay();
          },
        })
        .then(() => this.finish(m, data.next));
    });
  }

  private drawRoom(m: MeetingScript, W: number, H: number) {
    const fgm = m.location === "WAR_ROOM";
    const tmBg = this.add.tileSprite(0, 0, W, H, fgm ? "tile_prison" : "tile_hall").setOrigin(0);
    const hasBg = !!backdrop(this, fgm ? "bg_fgm" : "bg_townhall", { dim: 0.25, depth: -10 });
    if (hasBg) tmBg.setVisible(false);
    if (m.historical) this.add.rectangle(0, 0, W, H, 0x704214, 0.25).setOrigin(0).setDepth(900);
    // windows with the Tap (the PixelLab chamber has its own)
    if (!fgm && !hasBg) {
      this.add.rectangle(110, 70, 150, 100, 0x6a8fd0).setStrokeStyle(4, 0x3b2a1a);
      this.add.image(110, 92, "p_tap").setScale(0.9);
      this.add.rectangle(110, 70, 4, 100, 0x3b2a1a);
    }
    // podium screen
    this.add.rectangle(W / 2, 52, 230, 80, 0x0a0a12).setStrokeStyle(4, 0x444466);
    this.screenText = this.add.text(W / 2, 52, fgm ? (m.id === "crobley_briefing" ? "OPERATION NIBBLE\nCLASSIFICATION: CHEWY" : "OPERATION FRAGMAR\nCLASSIFICATION: EXTREMELY PETTY") : "THE KREZZING HOUR\nSeen by 9", { fontFamily: FONT, fontSize: "13px", color: "#7fb3ff", align: "center" }).setOrigin(0.5);
    // reaction display
    this.add.rectangle(W - 120, 60, 210, 90, 0x0a0a12).setStrokeStyle(3, UI.messenger);
    this.add.text(W - 120, 26, "NATIONAL REACTION DISPLAY", { fontFamily: FONT, fontSize: "10px", color: "#7fb3ff" }).setOrigin(0.5);
    this.reactText = this.add.text(W - 120, 66, "", { fontFamily: FONT, fontSize: "18px", color: "#ffffff", align: "center" }).setOrigin(0.5);
    this.updateReactDisplay();
    // agenda (meetings without one show no agenda board)
    if (m.agenda.length) {
      this.add.rectangle(10, 128, 196, 26 + m.agenda.length * 30, 0xf5ecd0).setOrigin(0).setStrokeStyle(2, 0x7a5230).setDepth(5);
      this.add.text(18, 132, "AGENDA", { fontFamily: FONT, fontSize: "12px", color: "#7a1f2b", fontStyle: "bold" }).setDepth(5);
      m.agenda.forEach((a, i) => {
        this.agendaTexts.push(this.add.text(18, 150 + i * 30, a, { fontFamily: FONT, fontSize: "10px", color: "#2a1a0a", wordWrap: { width: 182 } }).setDepth(5));
      });
    }
    // horseshoe table (half-ellipse)
    if (this.textures.exists("p_meeting_table")) {
      this.add.image(W / 2, 258, "p_meeting_table").setScale(1.5).setDepth(2);
      if (fgm) this.add.text(W / 2, 290, m.id === "crobley_briefing" ? "OPERATION NIBBLE" : "12:00 MIDDAY · OPERATION FRAGMAR", { fontFamily: FONT, fontSize: "10px", color: "#ffd23f", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(3);
      return;
    }
    const g = this.add.graphics();
    const pts: Phaser.Math.Vector2[] = [];
    for (let a = 8; a <= 172; a += 4) {
      const r = Phaser.Math.DegToRad(a);
      pts.push(new Phaser.Math.Vector2(W / 2 + Math.cos(r) * 250, 210 + Math.sin(r) * 100));
    }
    g.lineStyle(30, fgm ? 0x2e7d32 : 0x5a3a20, 1);
    g.strokePoints(pts, false);
    g.lineStyle(3, fgm ? 0xffffff : 0x8a5a33, 1);
    g.strokePoints(pts.map((p) => new Phaser.Math.Vector2(W / 2 + (p.x - W / 2) * 1.07, 210 + (p.y - 210) * 1.17)), false);
    if (fgm) {
      // tactical map on the ping pong table
      this.add.rectangle(W / 2, 250, 190, 110, 0x1b5e20).setStrokeStyle(2, 0xffffff);
      this.add.text(W / 2, 216, "POLSON TOWERS", { fontFamily: FONT, fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
      this.add.rectangle(W / 2 - 30, 250, 40, 30, 0x795548);
      this.add.image(W / 2 + 40, 256, "p_fridge").setScale(0.6);
      this.add.text(W / 2, 290, "12:00 MIDDAY", { fontFamily: FONT, fontSize: "10px", color: "#ffd23f" }).setOrigin(0.5);
    }
  }

  private attendees(m: MeetingScript): string[] {
    if (m.historical) {
      const ids = new Set<string>();
      for (const b of m.beats) {
        const sp = b.canon ? CANON[b.canon]?.speaker : b.s;
        if (sp && CHARACTERS[sp as string] && sp !== "NARRATOR" && sp !== "ARCHIVE" && sp !== "PROCTUS") ids.add(sp as string);
      }
      return [...ids];
    }
    const list: string[] = [...LADS, "MIKEY"];
    list.splice(list.indexOf(G.s.player) + 1, 0, "PROCTUS");
    for (const a of m.attendees ?? []) if (!list.includes(a as string)) list.push(a as string);
    return list;
  }

  private placeSeats(m: MeetingScript, W: number) {
    const list = this.attendees(m).filter((id) => id !== "DRONGUS");
    const n = list.length;
    list.forEach((id, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = Phaser.Math.DegToRad(158 - t * 136);
      const x = W / 2 + Math.cos(ang) * 275;
      const y = 190 + Math.sin(ang) * 118;
      const isPlayer = !m.historical && id === G.s.player;
      // playing as Mikey while he's SanMik: SanMik is in your seat
      const spr = this.add.sprite(x, y, isPlayer ? playerKey(this) : `spr_${id}`, 0).setScale(2.4).setDepth(10 + y);
      const plateName = id === "PROCTUS" && !m.historical ? `PROCTUS (${CHARACTERS[G.s.player].proctusTitle})` : isPlayer && sanmikActive(G.s) ? "SANMIK" : CHARACTERS[id]?.name ?? id;
      const plate = this.add
        .text(x, y + 34, isPlayer ? `${plateName} (YOU)` : plateName, { fontFamily: FONT, fontSize: "9px", color: hexStr(CHARACTERS[id]?.color ?? 0xffffff), backgroundColor: "#000000aa", padding: { x: 3, y: 1 }, align: "center", wordWrap: { width: 120 } })
        .setOrigin(0.5, 0)
        .setDepth(11 + y);
      this.seats[id] = { id, sprite: spr, plate, x, y };
    });
    // name plates: everyone's for a moment while you take the room in, then only whoever's talking
    this.time.delayedCall(3200, () => {
      this.platesDown = true;
      for (const st of Object.values(this.seats)) if (st.id !== this.speaking) this.tweens.add({ targets: st.plate, alpha: 0, duration: 400 });
    });
    this.spot = this.add.ellipse(0, 0, 86, 26, 0xfff3c4, 0.22).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    // Drongus: podium in person (prologue / archives), screen otherwise
    const drongusPresent = (m.attendees ?? []).includes("DRONGUS") || (m.historical && this.attendees(m).includes("DRONGUS"));
    if (drongusPresent) {
      const spr = this.add.sprite(W / 2, 138, "spr_DRONGUS", 0).setScale(2.6).setDepth(50);
      const plate = this.add.text(W / 2, 168, "DRONGUS B. DRIPPIN'", { fontFamily: FONT, fontSize: "9px", color: "#ffd23f", backgroundColor: "#000000aa", padding: { x: 3, y: 1 } }).setOrigin(0.5, 0).setDepth(51);
      this.seats.DRONGUS = { id: "DRONGUS", sprite: spr, plate, x: W / 2, y: 138 };
    }
  }

  private speaking: string | null = null;
  private platesDown = false;
  private spot?: Phaser.GameObjects.Ellipse;
  private talkBob?: Phaser.Tweens.Tween;

  /** Whoever's talking: lit, bobbing, named; everyone else a touch dimmer and turned to look at them. */
  private highlight(sp: SpeakerId) {
    const fc = this.flashCast[sp as string];
    if (this.flash && fc) {
      this.tweens.add({ targets: fc, y: 342, yoyo: true, duration: 120 });
      return;
    }
    const seat = this.seats[sp as string];
    this.speaking = seat ? seat.id : null;
    this.talkBob?.stop();
    this.talkBob = undefined;
    for (const st of Object.values(this.seats)) {
      st.sprite.y = st.y;
      const meta = charMeta(this, st.sprite.texture.key);
      if (st === seat) {
        st.sprite.clearTint().setFlipX(false).setFrame(meta?.idle?.south ?? 0);
        this.tweens.killTweensOf(st.plate);
        st.plate.setAlpha(1);
        continue;
      }
      // a tableful of listeners: dimmed if someone at the table has the floor, and looking at them
      if (seat) st.sprite.setTint(0xa9a6bb);
      else st.sprite.clearTint();
      if (meta?.idle && seat && Math.abs(seat.x - st.x) > 30) {
        const east = seat.x > st.x;
        st.sprite.setFlipX(false).setFrame((east ? meta.idle.east : meta.idle.west ?? meta.idle.east) ?? 0);
        if (east === false && meta.idle.west === undefined) st.sprite.setFlipX(true);
      } else st.sprite.setFrame(meta?.idle?.south ?? 0);
      if (st.plate.alpha > 0 && this.platesDown) this.tweens.add({ targets: st.plate, alpha: 0, duration: 250 });
    }
    if (!seat) {
      this.spot?.setVisible(false);
      if (sp === "DRONGUS") {
        this.tweens.add({ targets: this.screenText, alpha: 0.3, yoyo: true, duration: 120, repeat: 2 });
      }
      return;
    }
    this.spot?.setPosition(seat.x, seat.y + 30).setDepth(seat.sprite.depth - 1).setVisible(true);
    // a little hop as they start, then a gentle talking bob
    this.tweens.add({ targets: seat.sprite, y: seat.y - 8, yoyo: true, duration: 120, onComplete: () => {
      if (this.speaking !== seat.id) return;
      this.talkBob = this.tweens.add({ targets: seat.sprite, y: seat.y - 2, yoyo: true, repeat: -1, duration: 180, ease: "Sine.inOut" });
    } });
  }

  private onLine(text: string, notify?: boolean, speaker?: string) {
    this.lineCount++;
    if (this.lineCount === 4 && this.agendaTexts[0]) {
      // Agenda item one never survives contact with the cabinet.
      const a = this.agendaTexts[0];
      a.setColor("#8a8080");
      const st = this.add.text(a.x + 110, a.y - 2, "DERAILED", { fontFamily: FONT, fontSize: "11px", color: "#c00", fontStyle: "bold" }).setAngle(-8).setDepth(6);
      st.setScale(2);
      this.tweens.add({ targets: st, scale: 1, duration: 200 });
      synth.play("ding");
    }
    if (notify && speaker === "DRONGUS") {
      this.screenText.setText(text.length > 60 ? text.slice(0, 57) + "…" : text).setWordWrapWidth(210);
    }
  }

  private robbo: Phaser.GameObjects.Sprite | null = null;

  /** Staged moments in the room, cued by a line's `fx`. */
  /** The Salem flashback: the museum over the room, and the people who were there. */
  private flash: Phaser.GameObjects.Container | null = null;
  private flashCast: Record<string, Phaser.GameObjects.Sprite> = {};

  /** Flashback places: the title card, the backdrop and who's standing where (fraction of the width). */
  private static FLASHBACKS: Record<string, { title: string; bg: string; cast: [string, number][] }> = {
    salem: { title: "SALEM, MASSACHUSETTS", bg: "bg_salem_museum", cast: [["EDEN", 0.36], ["POLSON", 0.5], ["KREZMAR", 0.72], ["KREBLIS", 0.84]] },
    gino: { title: "PAPA GINO'S, BOSTON", bg: "bg_papa_ginos", cast: [["EDEN", 0.3], ["POLSON", 0.44], ["KREZMAR", 0.7], ["KREBLIS", 0.82]] },
    faire: { title: "KING RICHARD'S FAIRE, MASSACHUSETTS", bg: "bg_ren_faire", cast: [["EDEN", 0.4], ["POLSON", 0.54], ["KREZMAR", 0.74], ["KREBLIS", 0.86]] },
    chart: { title: "POLSON TOWERS. THE KITCHEN.", bg: "bg_polson_kitchen", cast: [["POLSON", 0.28], ["EDEN", 0.72]] },
    stadium: { title: "ST MARY'S STADIUM. MATCHDAY.", bg: "bg_stadium", cast: [["POLSON", 0.5]] },
    grinder: { title: "DRONGUS'S KITCHEN. CURRY NIGHT.", bg: "bg_drongus_kitchen", cast: [["POLSON", 0.38], ["DRONGUS_HOME", 0.6], ["MIKEY", 0.76]] },
    crisps: { title: "POLSON'S HOUSE.", bg: "bg_polson_home", cast: [["POLSON", 0.4], ["MIKEY", 0.62]] },
    chilli: { title: "POLSON'S HOUSE. CHILLI NIGHT.", bg: "bg_polson_home", cast: [["POLSON", 0.26], ["KREZWONK", 0.5], ["FLENKY", 0.66], ["KREBLIS", 0.82]] },
    massimo: { title: "MASSIMO'S, SOUTHAMPTON.", bg: "bg_massimos", cast: [["POLSON", 0.3], ["FLENKY", 0.56], ["KREBLIS", 0.72], ["KREZMAR", 0.86]] },
    gym: { title: "THE GYM. 10:30 PM.", bg: "bg_gym", cast: [["POLSON", 0.5]] },
    door: { title: "POLSON'S FRONT DOOR. 8:02 AM.", bg: "bg_polson_door", cast: [["POLSON", 0.31]] },
    shoes: { title: "THE PLAYGROUND.", bg: "bg_us_playground", cast: [["FOLK1", 0.3], ["DRONGUS_HOME", 0.46], ["POLSON", 0.78]] },
    sofa: { title: "DRONGUS'S HOUSE. THE SOFA.", bg: "bg_polson_lounge", cast: [["POLSON", 0.42], ["DRONGUS_HOME", 0.6]] },
  };

  private salem(id: string): boolean {
    const W = this.scale.width;
    const H = this.scale.height;
    const place = id === "salem_on" ? "salem" : id.startsWith("flash:") ? id.slice(6) : null;
    const fb = place ? TownMeetingScene.FLASHBACKS[place] : null;
    if (fb) {
      this.flash?.destroy();
      this.cameras.main.flash(300, 255, 240, 210);
      const c = this.add.container(0, 0).setDepth(900);
      if (this.textures.exists(fb.bg)) {
        const bg = this.add.image(W / 2, H / 2, fb.bg);
        const src = this.textures.get(fb.bg).getSourceImage();
        bg.setScale(Math.max(W / src.width, H / src.height));
        c.add(bg);
      } else c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x2a1d14));
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x5a3a1a, 0.18));
      c.add(this.add.text(W / 2, 26, fb.title, { fontFamily: FONT, fontSize: "14px", color: "#f5e6c8", backgroundColor: "#00000099", padding: { x: 6, y: 3 } }).setOrigin(0.5));
      this.flashCast = {};
      for (const [id2, fx] of fb.cast) {
        const key = `spr_${id2}`;
        if (!this.textures.exists(key)) continue;
        const spr = this.add.sprite(W * fx, 350, key, 0).setOrigin(0.5, 1);
        spr.setScale(4.2);
        spr.setData("homeX", W * fx);
        c.add(spr);
        this.flashCast[id2] = spr;
      }
      this.flash = c;
      return true;
    }
    if (id === "flash_off") return this.salem("salem_off");
    if (this.flashActing(id)) return true;
    if (id === "salem_off") {
      this.cameras.main.flash(300, 255, 240, 210);
      this.flash?.destroy();
      this.flash = null;
      this.flashCast = {};
      return true;
    }
    const cast = this.flashCast;
    if (id === "eden_head" && cast.EDEN) {
      const e = cast.EDEN;
      this.tweens.add({ targets: e, angle: { from: -7, to: 7 }, yoyo: true, repeat: 4, duration: 120, onComplete: () => e.setAngle(0) });
      const t = this.add.text(e.x, e.y - e.displayHeight - 6, "💫", { fontSize: "22px" }).setOrigin(0.5).setDepth(950);
      this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
      return true;
    }
    if (id === "polson_sorry" && cast.POLSON) {
      const pz = cast.POLSON;
      // four little bows, one per sorry
      this.tweens.add({ targets: pz, angle: 12, y: pz.y + 6, yoyo: true, repeat: 3, duration: 180, hold: 120 });
      return true;
    }
    if (id === "spoons") {
      for (const k of ["KREZMAR", "KREBLIS"]) {
        const f = cast[k];
        if (!f) continue;
        // swing round to the spoon cabinet, suddenly fascinated
        if (this.textures.get(f.texture.key).has("5")) f.setFrame(5);
        this.tweens.add({ targets: f, x: f.x + 40, duration: 500, ease: "Sine.out" });
        const t = this.add.text(f.x + 40, f.y - f.displayHeight - 4, "🥄", { fontSize: "18px" }).setOrigin(0.5).setDepth(950);
        this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 600, duration: 900, onComplete: () => t.destroy() });
      }
      return true;
    }
    return false;
  }

  /** Small acting cues inside a flashback: "emote:EDEN:💢", "hop:POLSON", "exit:EDEN", "enter:EDEN", "stare:🍕", "star". */
  private flashActing(id: string): boolean {
    const cast = this.flashCast;
    const [verb, a1, a2] = id.split(":");
    const pop = (spr: Phaser.GameObjects.Sprite, e: string) => {
      const t = this.add.text(spr.x, spr.y - spr.displayHeight * 0.8, e, { fontSize: "26px" }).setOrigin(0.5).setDepth(950);
      this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, delay: 500, duration: 1100, onComplete: () => t.destroy() });
    };
    if (verb === "emote" && cast[a1]) {
      pop(cast[a1], a2);
      this.tweens.add({ targets: cast[a1], y: 344, yoyo: true, duration: 110 });
      return true;
    }
    if (verb === "hop" && cast[a1]) {
      this.tweens.add({ targets: cast[a1], y: 326, yoyo: true, repeat: 2, duration: 130, ease: "Quad.out" });
      pop(cast[a1], "✨");
      return true;
    }
    if (verb === "exit" && cast[a1]) {
      const spr = cast[a1];
      spr.setFlipX(false);
      this.tweens.add({ targets: spr, x: this.scale.width + 120, duration: 900, ease: "Sine.in" });
      return true;
    }
    if (verb === "enter" && cast[a1]) {
      const spr = cast[a1];
      this.tweens.add({ targets: spr, x: spr.getData("homeX") as number, duration: 800, ease: "Sine.out" });
      return true;
    }
    if (verb === "stare") {
      for (const k of ["KREZMAR", "KREBLIS"]) {
        const f = cast[k];
        if (!f) continue;
        if (this.textures.get(f.texture.key).has("5")) f.setFrame(5);
        this.tweens.add({ targets: f, x: f.x + 40, duration: 500, ease: "Sine.out" });
        pop(f, a1 ?? "👀");
      }
      return true;
    }
    if (verb === "fart" && cast[a1]) {
      // a death fart: a green cloud, a shudder, and everyone else recoils
      const spr = cast[a1];
      synth.play("fart");
      this.cameras.main.shake(350, 0.006);
      for (let i = 0; i < 9; i++) {
        const g = this.add.circle(spr.x + (Math.random() - 0.5) * 50, spr.y - 70 + (Math.random() - 0.5) * 30, 14 + Math.random() * 14, 0x84cc16, 0.45).setDepth(955);
        this.tweens.add({ targets: g, x: g.x + (Math.random() - 0.3) * 160, y: g.y - 30 - Math.random() * 60, scale: 2.4, alpha: 0, duration: 1600 + Math.random() * 800, onComplete: () => g.destroy() });
      }
      for (const [k, other] of Object.entries(cast)) if (k !== a1) this.tweens.add({ targets: other, angle: -8, yoyo: true, duration: 160, repeat: 1 });
      return true;
    }
    if (verb === "star") {
      // a gold star flies onto the sticker chart on the fridge
      const W = this.scale.width;
      const st = this.add.text(W * 0.28, 200, "⭐", { fontSize: "34px" }).setOrigin(0.5).setDepth(960);
      this.tweens.add({ targets: st, x: W * 0.45, y: 150, scale: 0.6, duration: 700, ease: "Quad.out" });
      this.flash?.add(st);
      return true;
    }
    return false;
  }

  /**
   * Now and then (not playing as Mikey yourself), Mikey announces he's off to be SanMik mid-meeting and does it,
   * right there at the table: from then on it's SanMik in his seat (same man, in a wig).
   */
  private withSanmikMoment(m: MeetingScript) {
    const beats = [...m.beats];
    if (m.historical || G.s.player === "MIKEY" || !this.seats.MIKEY || !this.textures.exists("spr_SANMIK") || (Math.random() > 0.35 && !(window as any).__forceSanmik)) return beats;
    // just before one of his lines, a few lines in; else somewhere in the middle
    const his = beats.map((b, i) => [b, i] as const).filter(([b, i]) => i >= 3 && b.s === "MIKEY" && !b.dir);
    const at = his.length ? his[Math.floor(Math.random() * his.length)][1] : Math.max(2, Math.floor(beats.length * (0.3 + Math.random() * 0.4)));
    beats.splice(at, 0, say("MIKEY", "Hang on, time to transform into SanMik", { fx: "sanmik_transform" }));
    return beats;
  }

  private sanmikTransform() {
    const seat = this.seats.MIKEY;
    if (!seat?.sprite.active) return;
    const spr = seat.sprite;
    synth.play("transform_sparkle");
    this.tweens.add({
      targets: spr,
      scaleX: 0,
      duration: 160,
      yoyo: true,
      repeat: 3,
      onYoyo: () => {
        spr.setTexture(spr.texture.key === "spr_SANMIK" ? "spr_MIKEY" : "spr_SANMIK", 0);
      },
      onComplete: () => {
        spr.setTexture("spr_SANMIK", 0).setScale(2.4);
        seat.plate.setText("SANMIK").setColor(hexStr(CHARACTERS.SANMIK?.color ?? 0xb0c4ff));
      },
    });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = this.add.text(seat.x, seat.y, "✦", { fontFamily: FONT, fontSize: "16px", color: i % 2 ? "#b0c4ff" : "#ffd23f" }).setOrigin(0.5).setDepth(seat.sprite.depth + 2);
      this.tweens.add({ targets: p, x: seat.x + Math.cos(a) * 60, y: seat.y + Math.sin(a) * 40, alpha: 0, duration: 900, onComplete: () => p.destroy() });
    }
  }

  private fx(id: string) {
    if (id === "sanmik_transform") {
      this.time.delayedCall(900, () => this.sanmikTransform());
      return;
    }
    const W = this.scale.width;
    if (this.salem(id)) return;
    const cx = W / 2;
    const cy = 262;
    if (id === "robbo_enter") {
      const key = this.textures.exists("boss_flatmate") ? "boss_flatmate" : "spr_FOLK0";
      const r = this.add.sprite(W + 60, cy, key, 0).setDepth(400);
      // (setScale folds the sheet's hd factor in, so undo it: ~84px tall like the seated lads)
      r.setScale(1);
      r.setScale(84 / r.frame.height / r.scaleX);
      this.robbo = r;
      const ak = this.textures.exists("bossanim_flatmate") ? "bossanim_flatmate" : null;
      const rows = ak ? bossAnims(this, ak) : new Set<string>();
      if (ak && rows.has("move")) r.play(`${ak}:move`);
      r.setFlipX(true);
      this.tweens.add({
        targets: r,
        x: cx,
        duration: 1600,
        ease: "Sine.out",
        onComplete: () => {
          if (ak && rows.has("idle")) r.play(`${ak}:idle`);
          r.setFlipX(false);
        },
      });
      synth.play("door");
      return;
    }
    const r = this.robbo;
    if (!r?.active) return;
    if (id === "robbo_beatup") {
      const lads = Object.values(this.seats).filter((s) => s.id !== "DRONGUS" && s.id !== G.s.player);
      lads.forEach((s, i) => {
        const a = (i / Math.max(1, lads.length)) * Math.PI * 2;
        this.tweens.add({ targets: s.sprite, x: r.x + Math.cos(a) * 46, y: r.y + Math.sin(a) * 26, duration: 380, delay: i * 60, ease: "Quad.out" });
      });
      const ak = "bossanim_flatmate";
      if (this.anims.exists(`${ak}:hurt`)) r.play({ key: `${ak}:hurt`, repeat: -1 });
      const cloud = this.add.ellipse(r.x, r.y, 170, 110, 0xe5e7eb, 0.85).setDepth(450).setAlpha(0);
      this.tweens.add({ targets: cloud, alpha: 0.9, scaleX: { from: 0.6, to: 1.05 }, yoyo: true, repeat: 5, duration: 220, delay: 350 });
      const words = ["POW!", "WHAM!", "BIFF!", "NONCE!", "THWACK!", "BOSH!", "SMACK!", "CRAVAT!"];
      for (let k = 0; k < 14; k++)
        this.time.delayedCall(400 + k * 190, () => {
          const t = this.add.text(r.x + (Math.random() - 0.5) * 150, r.y + (Math.random() - 0.5) * 80, words[k % words.length], { fontFamily: FONT, fontSize: "18px", color: "#ffd23f", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(460);
          this.tweens.add({ targets: t, scale: { from: 0.4, to: 1.2 }, alpha: 0, duration: 520, onComplete: () => t.destroy() });
          synth.play(k % 3 === 0 ? "punch_big" : "hit");
          if (k % 4 === 0) this.cameras.main.shake(120, 0.008);
        });
      this.time.delayedCall(3300, () => {
        cloud.destroy();
        lads.forEach((s) => this.tweens.add({ targets: s.sprite, x: s.x, y: s.y, duration: 420, ease: "Quad.inOut" }));
        r.stop();
        r.setFrame(0);
        this.tweens.add({ targets: r, angle: 84, y: r.y + 18, duration: 260, ease: "Quad.in" });
        synth.play("smash");
      });
      return;
    }
    if (id === "robbo_leave") {
      // he crawls out the way he came, on his belly
      this.tweens.add({ targets: r, x: W + 90, duration: 2600, delay: 600, ease: "Sine.in", onComplete: () => r.destroy() });
      this.tweens.add({ targets: r, y: r.y - 3, yoyo: true, repeat: 10, duration: 120, delay: 600 });
      this.time.delayedCall(3100, () => synth.play("door"));
    }
  }

  private updateReactDisplay() {
    const r = this.reactCounts;
    this.reactText.setText(`${REACTION_EMOJI.LIKE}${r.LIKE}  ${REACTION_EMOJI.LOVE}${r.LOVE}  ${REACTION_EMOJI.LAUGH}${r.LAUGH}\n${REACTION_EMOJI.ANGRY}${r.ANGRY}  Seen ${r.SEEN}`);
  }

  private finish(m: MeetingScript, next?: Next) {
    if (m.onComplete) Object.assign(G.s.flags, m.onComplete);
    for (const a of m.unlocksArchive ?? []) G.unlockArchive(a);
    G.save();
    this.cameras.main.fadeOut(350);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => goNext(this, next));
  }
}
