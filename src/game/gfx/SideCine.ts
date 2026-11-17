import Phaser from "phaser";
import { synth } from "../audio/Synth";
import * as Juice from "./Juice";

/**
 * Anime beats for the side stories (side quests, the Polson anecdotes, the Polson chapter), cued from a dialogue
 * line's `cine` (before the line shows) or `cineAfter` (once it's been read). A cue is a list of beats separated by
 * ";", each beat's arguments separated by "|":
 *
 *   still|key|ms            a drawn full-screen still (its `<key>_anim` sheet plays if there is one)
 *   cut|key|left/right|0xcolor|ms   a whip-pan face cut-in
 *   freeze|CAPTION          comedy freeze-frame: record scratch, everything stops, sepia, a caption stamp
 *   scratch                 just the record scratch (and the music ducks)
 *   slam|TEXT|#color|size   a slammed screen word (doesn't wait)
 *   impact                  two impact frames and a shake
 *   speed|0xcolor           speed lines rushing in (doesn't wait)
 *   card|KICKER|PLACE       a title card
 *   sting|sfxId             a stinger (doesn't wait)
 *   zoom                    a punch-in on the camera (doesn't wait)
 *   riser|ms                a rising whoosh of tension under the next beat (doesn't wait)
 *   wait|ms
 *
 * Every beat can be cut short (E / Space / click moves on, Tab skips the lot): whatever it put on screen goes with it.
 */

/** Juice's screen-space layers the beats draw into (speed lines, impact, still, cut-in, slam, title card). */
const DEPTHS = [4960, 4970, 4993, 4994, 4996, 4997];
const STILL_DEPTH = 4993;
const CUT_DEPTH = 4994;
const SLAM_DEPTH = 4996;
const CARD_DEPTH = 4997;

/** What a cue gets from the dialogue box: a promise that resolves when the player presses on, and whether to skip it all. */
export interface CineHost {
  /** Resolves on the next advance press (E / Space / click / Tab). */
  press: () => Promise<void>;
  /** Tab has been pressed: skip every beat. */
  skipping: () => boolean;
}

const alive = (sc: Phaser.Scene) => !!sc.sys && sc.sys.settings.status < Phaser.Scenes.SHUTDOWN && !!sc.cameras?.main;

/** Snapshot of what's in the beat layers now, so a skipped beat can sweep away only what it added. */
function snapshot(sc: Phaser.Scene) {
  const before = new Map<number, Set<Phaser.GameObjects.GameObject>>();
  for (const d of DEPTHS) before.set(d, new Set(Juice.layer(sc, d).list));
  return () => {
    for (const d of DEPTHS) {
      const L = Juice.layer(sc, d);
      const had = before.get(d)!;
      for (const o of [...L.list]) if (!had.has(o)) o.destroy();
    }
  };
}

/** Wait `ms`, or less if the player presses on. Returns true if they pressed. */
function hold(ms: number, host: CineHost): Promise<boolean> {
  return new Promise((res) => {
    let done = false;
    const id = window.setTimeout(() => {
      if (done) return;
      done = true;
      res(false);
    }, ms);
    void host.press().then(() => {
      if (done) return;
      done = true;
      window.clearTimeout(id);
      res(true);
    });
  });
}

/** The comedy freeze-frame: everything on stage stops dead under a sepia wash, with a caption stamped on. */
async function freeze(sc: Phaser.Scene, caption: string, host: CineHost, ms = 1700) {
  synth.play("ss_scratch");
  Juice.duckMusic(ms, 500, 0.08);
  sc.tweens.pauseAll();
  sc.game.anims.pauseAll();
  const cam = sc.cameras.main;
  // the frame itself goes sepia (WebGL), with a warm wash on top either way
  const fx = (cam as unknown as { postFX?: { addColorMatrix?: () => { sepia: () => void }; remove: (f: unknown) => void } }).postFX;
  const cm = fx?.addColorMatrix?.();
  cm?.sepia();
  const L = Juice.layer(sc, CARD_DEPTH);
  const wash = sc.add.rectangle(480, 270, 1100, 700, 0x4a2a0a, 0.18);
  const stamp = sc.add.container(40, 120);
  const t = sc.add.text(0, 0, caption, { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#111111", align: "left", wordWrap: { width: 560 } }).setOrigin(0, 0.5);
  const bg = sc.add.rectangle(-14, 0, t.width + 28, t.height + 16, 0xffd23f, 1).setOrigin(0, 0.5).setStrokeStyle(4, 0x111111);
  stamp.add([bg, t]).setAngle(-4);
  L.add([wash, stamp]);
  Juice.shake(sc, 120, 0.006);
  await hold(ms, host);
  wash.destroy();
  stamp.destroy();
  // (the animation manager is the whole game's: always hand it back, even if this scene has gone)
  sc.game.anims.resumeAll();
  if (!alive(sc)) return;
  if (cm) fx?.remove(cm);
  sc.tweens.resumeAll();
}

/** Play one cue. Resolves when every beat is done (or skipped). */
export async function playCine(sc: Phaser.Scene, cue: string, host: CineHost): Promise<void> {
  if (!cue || !alive(sc)) return;
  for (const beat of cue.split(";")) {
    if (host.skipping() || !alive(sc)) return;
    const [verb, ...a] = beat.trim().split("|");
    const sweep = snapshot(sc);
    switch (verb) {
      case "still": {
        if (!sc.textures.exists(a[0])) break;
        const ms = Number(a[1]) || 2000;
        synth.play("swing");
        void Juice.still(sc, a[0], ms + 400, { depth: STILL_DEPTH, push: 0.1, shakeK: 0 });
        if (await hold(ms, host)) sweep();
        break;
      }
      case "cut": {
        if (!sc.textures.exists(a[0])) break;
        const ms = Number(a[3]) || 1000;
        const p = Juice.cutIn(sc, a[0], { from: a[1] === "right" ? "right" : "left", color: a[2] ? Number(a[2]) : 0xffd23f, hold: ms, depth: CUT_DEPTH, y: 250, focus: 0.4 });
        Juice.speedLines(sc, ms + 300, a[2] ? Number(a[2]) : 0xffffff, 4960);
        const pressed = await Promise.race([p.then(() => false), host.press().then(() => true)]);
        if (pressed) sweep();
        break;
      }
      case "freeze":
        await freeze(sc, a[0] ?? "", host, Number(a[1]) || 1700);
        break;
      case "scratch":
        synth.play("ss_scratch");
        Juice.duckMusic(900, 500, 0.08);
        break;
      case "slam":
        Juice.slamText(sc, a[0] ?? "", a[1] || "#ffd23f", Number(a[2]) || 52, 200, 1000, SLAM_DEPTH);
        break;
      case "impact":
        Juice.shake(sc, 260, 0.014);
        await Juice.impactFrames(sc, null, 55, 4970);
        break;
      case "speed":
        Juice.speedLines(sc, Number(a[1]) || 900, a[0] ? Number(a[0]) : 0xffffff, 4960);
        break;
      case "card": {
        void Juice.titleCard(sc, a[0] ?? "", a[1] ?? "", a[2] ?? "", Number(a[3]) || 1500, CARD_DEPTH, 236);
        if (await hold((Number(a[3]) || 1500) + 600, host)) sweep();
        break;
      }
      case "sting":
        if (a[0]) synth.play(a[0]);
        break;
      case "zoom":
        Juice.punchZoom(sc, Number(a[0]) || 0.1, 380);
        break;
      case "riser":
        Juice.riser(Number(a[0]) || 1200, 0.3);
        break;
      case "wait":
        await hold(Number(a[0]) || 400, host);
        break;
    }
  }
}

/**
 * SanMik's SLOPPY SURPRISE in a fight or on the road: his face whips across the top of the screen (doesn't pause the
 * action, and only the first one in a scene gets the cut-in, so it never gets in the way).
 */
export function sloppyCutIn(sc: Phaser.Scene) {
  const k = sc as unknown as { __sloppyCut?: boolean };
  if (k.__sloppyCut || !sc.textures.exists("ss_cut_sanmik")) return;
  k.__sloppyCut = true;
  sc.events.once("shutdown", () => (k.__sloppyCut = false));
  Juice.speedLines(sc, 900, 0xa3e635, 4960);
  void Juice.cutIn(sc, "ss_cut_sanmik", { from: "left", y: 150, h: 130, color: 0xa3e635, hold: 650, depth: 4994, focus: 0.4 });
}

/**
 * SanMik's webcam chat-up lines: the Norwich line gets a scoreline slammed across the screen, and his best lines get
 * his face whipped across the top. Never waits (it's a live chat).
 */
export function chatBeat(sc: Phaser.Scene, line: string, score: number) {
  if (/Norwich/.test(line)) {
    synth.play("cheer");
    Juice.speedLines(sc, 900, 0xfacc15, 4960);
    Juice.slamText(sc, "NORWICH 48 – 0 BRAZIL", "#facc15", 46, 150, 1100, SLAM_DEPTH);
    return;
  }
  if (score >= 20 && sc.textures.exists("ss_cut_sanmik")) void Juice.cutIn(sc, "ss_cut_sanmik", { from: "left", y: 150, h: 130, color: 0xf472b6, hold: 700, depth: CUT_DEPTH, focus: 0.4 });
}
