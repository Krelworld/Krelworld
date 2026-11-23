import { restockGuns } from "../systems/armoury";
import { shinyPickup, trailPropScale } from "../gfx/shiny";
import { isTouchDevice } from "../ui/TouchControls";
import { keysFor, prettyKey } from "../systems/keybinds";
import { carriesCrystal, crystalCount, CRYSTALS_NEEDED, CRYSTAL_BOSSES } from "../systems/crystals";
import { preview, squeeze } from "../systems/squeeze";
import Phaser from "phaser";
import { bindSanmikToggle } from "../gfx/sanmikForm";
import { SANMIK_FLAG } from "../systems/sanmik";
import { dungeonIntro } from "../gfx/DungeonIntro";
import { DUNGEONS, type DungeonDef, type RoomDef, type PropDef } from "../../data/dungeons";
import { ENEMIES } from "../../data/enemies";
import type { Line } from "../../data/types";
import { G } from "../G";
import { Player } from "../combat/Player";
import { Enemy } from "../combat/Enemy";
import { Controls } from "../combat/Controls";
import type { CombatWorld, HitOpts, ShotOpts } from "../combat/types";
import { Boss, BOSSDIE_SPLIT, createBoss, DrongusBoss, OverWonkedMachine } from "../combat/Bosses";
import { PuddingDemonBoss } from "../combat/MindBoss";
import { KrexBoss } from "../combat/KrexBoss";
import { ElonBoss } from "../combat/ElonBoss";
import { DrongusPhaseOneBoss } from "../combat/DrongusPhaseOne";
import { DerangedDrongusBoss } from "../combat/DerangedDrongus";
import { Citadel, citadelPreload, citadelReady } from "./citadel/Citadel";
import { RoofArena, roofPreload, roofReady } from "./citadel/RoofArena";
import { DarkDrongusBoss } from "../combat/DarkDrongus";
import { vsSplash, vsSeen } from "../gfx/VsSplash";
import { krelCinema } from "../combat/KrelCinema";
import { synth, MUSIC_FILES } from "../audio/Synth";
import { runDialogue } from "./DialogueScene";
import { BOSS_TEXT } from "../../content/bosses";
import { voice } from "../audio/Voice";
import * as Juice from "../gfx/Juice";
import { playColonEntry } from "./side/colonEntry";
import { playCine } from "../gfx/Cine";
import { enemyDamageMult, enemyHpMult, maxHp, bump, maxBottles, maxKrezz } from "../systems/stats";
import { diffFor, scaleCount } from "../systems/difficulty";
import { addCensorBar } from "../gfx/Censor";
import { activeMods } from "../../data/historicalRevisions";
import { addBanRisk, BAN_RULES, type BanRule, coolBanRisk } from "../systems/ban";
import { pickupsInDungeon, collectPickup } from "../systems/quests";
import { Spice } from "../combat/Spice";
import { equipBest, fitTo, giveAmmo, ownedGuns, rollCrate, GUNS, gunMax } from "../combat/Guns";
import { charMeta, hdFactor, leadCamera } from "../gfx/HD";
import { addFart } from "../combat/Farts";
import { Companion } from "../combat/Companion";
import { KrelfordFinale } from "./finale/KrelfordFinale";
import { finalePreload } from "./finale/finaleArt";
import { SanBrother } from "../combat/SanBrother";
import { SideLevel } from "./side/SideLevel";
import { PlaneCabin } from "./side/PlaneCabin";
import { ColonTube } from "./side/Colon";
import { runChain, switchTo } from "../Flow";
import { say, dir, gabor } from "../../content/dsl";
import { FONT } from "../ui/theme";
import { CHARACTERS } from "../../data/characters";
import { evalCond } from "../systems/conditions";
import { addKrokens, extraViolence, kd } from "../systems/kreddle";
import { forcedKreltality, kreltality, pick, prompt as krelPrompt, type KrelTarget } from "../combat/Kreltality";
import { KREX_KREL_OUTRO, krexKreltality } from "../combat/KrexFinisher";
import { HeroPassenger, HeroSquad, createHero, krelAllPrompt, chainCard, multiBanner, type HeroId } from "../combat/HeroPassengers";
import { hasVfx, vfx } from "../gfx/Vfx";
import { Kit } from "./dressing/kit";
import { dressingFor } from "./dressing/rooms";
import { floorFallbackTint, floorTile } from "./dressing/floors";
import { beatenBosses, bossEscorts, bossWaveHp, breatherSec, gauntletBossFor, gauntletPool, gauntletScale, gauntletWave, GAUNTLET_KILL_COIN_MULT, heatScale, isBossWave, pitRecord, recordGauntlet, recordRematch, REMATCH_BY_ID, REMATCH_KILL_COIN_MULT, rematchPay, wavePay } from "../systems/pit";
import type { PitResult } from "../G";
import { isMobile } from "../mobile/flag";
import { phoneHooks } from "../mobile/boot";

interface Shot {
  spr: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  o: ShotOpts;
  hit: Set<number>;
}

interface Pickup {
  spr: Phaser.GameObjects.Image;
  kind: "coin" | "krezz" | "heal" | "crobley" | "quest" | "bottle" | "bongo" | "ammo";
  value: number;
  onCollect?: () => void;
}

interface Interactable {
  x: number;
  y: number;
  r: number;
  label: string;
  use: () => void | Promise<void>;
  enabled?: () => boolean;
}

const SHAKE = () => G.meta.settings.shake;

/** Chapter 6 / 7 bosses get the full treatment: a cinematic entrance, a title card, a phase-change pulse and a
 *  slow-mo killing blow. (Kept to these so the earlier chapters play exactly as before.) */
/** Bosses that stage their own phase breaks (epic-phase events) instead of the generic half-health pulse. */
const OWN_PHASE_BREAKS = new Set(["drongus1", "drongus2"]);
/** Close-up cut-ins (PixelLab stills) for a boss's phase breaks. */
/** Anime eye shots, before an epic boss's title card. */
const BOSS_EYES: Record<string, string> = { drongus1: "fe_eyes_drongus1", drongus2: "fe_eyes_drongus2" };
/** A full-screen still for a boss's LAST STAND (instead of the cut-in). */
const LAST_STAND_STILLS: Record<string, string> = { drongus1: "fe_still_drongus1_gun" };
const PHASE_CUTINS: Record<string, string> = { drongus1: "fe_cut_drongus1", drongus2: "fe_cut_drongus2", concept: "fe_cut_concept_hurt" };
const EPIC_BOSSES: Record<string, string> = { krozno: "#38bdf8", krex: "#a855f7", elon: "#22d3ee", drongus1: "#ef4444", drongus2: "#ff2a2a" };

const clearKey = (dungeon: string, room: number) => `dclr_${dungeon}_${room}`;

/** How much bigger people are drawn in side-scrolling rooms. */
const SIDE_BIG = 1.4;

/** Who's on the radio from outside in the SanMikverse: SanMik, or SanChz when you ARE SanMik (playing as Mikey). */
const sanRadio = () => (G.s.player === "MIKEY" ? "SANCHZ" : "SANMIK");

export class DungeonScene extends Phaser.Scene implements CombatWorld {
  sc!: Phaser.Scene;
  player!: Player;
  enemies: Enemy[] = [];
  enemyTimeScale = 1;
  telegraphMult = 1;
  bounds = new Phaser.Geom.Rectangle();
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private shots: Shot[] = [];
  private pickups: Pickup[] = [];
  private interactables: Interactable[] = [];
  private controls!: Controls;
  private dungeon!: DungeonDef;
  private roomIdx = 0;
  private room!: RoomDef;
  private waveIdx = -1;
  private waveActive = false;
  private roomCleared = false;
  private boss: Boss | null = null;
  private door!: Phaser.GameObjects.Image;
  private doorZone!: Phaser.Geom.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private busy = false;
  private paused = false;
  private hitStopUntil = 0;
  private prophecyUntil = 0;
  private rule: BanRule | null = null;
  private lastStillTick = 0;
  private dying = false;
  private machineUses: Record<string, number> = {};
  private lastWitness = "none";
  private witnessed = new Set<string>();
  private lastHurtSfx = 0;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private conflictUntil = 0;
  private waves: [string, number][][] = [];
  private pendingSpawns = 0;
  private transitioning = false;

  private resumed = false;
  private companion: Companion | null = null;
  side = false;
  private bros: SanBrother[] = [];
  private sideLevel: SideLevel | null = null;
  /** Flight KR-069 (side-on): the cabin, its passengers and its hazards (side/PlaneCabin.ts). */
  private plane: PlaneCabin | null = null;
  /** Inside Uncle Rik, side-on: the tube's dressing (ceiling, folds, mucus, the big squeeze). */
  private colonTube: ColonTube | null = null;
  groundY = 0;
  private platforms: Phaser.Physics.Arcade.StaticGroup | null = null;
  private sideBg: Phaser.GameObjects.TileSprite | null = null;
  private sideBgScale = 1;
  /** Chapter 7 (Da Drongus Dungeon): the gothic-cyber dressing, the tannoy, the anthem. */
  private citadel: Citadel | null = null;
  /** The finale: the roof of Da Drongus Dungeon (see citadel/RoofArena.ts). */
  private roof: RoofArena | null = null;
  /** A room's mini-boss: not met yet, fighting it, or beaten. */
  private miniBossState: "none" | "fight" | "done" = "none";
  /** While a side-on mini-boss is up, the screen is locked from here to the end of the room. */
  private arenaLeft = 0;
  /** Flight KR-069's hero passengers, while they're up (HeroPassengers.ts). */
  private heroSquad: HeroSquad | null = null;

  constructor() {
    super("Dungeon");
  }

  /** Barrels, crates, hostages, elites and room twists. */
  spice: Spice | null = null;
  /** the room's set dressing (top-down rooms with an entry in dressing/rooms.ts) */
  private dress: Kit | null = null;
  private lastKillStop = 0;
  private lastSplat = 0;
  /** 1 = normal speed. The weapon picker drops it right down. */
  private slowmo = 1;
  /** The weapon picker is open: the world crawls and you're choosing, not fighting. */
  picking = false;
  private lastMeterHit = 0;
  /** Kills since the last ammo drop (bad-luck protection). */
  private ammoDry = 0;

  /** True when every owned gun is under a quarter full. */
  private ammoLow() {
    const s = G.s;
    const owned = ownedGuns(s);
    return owned.length > 0 && owned.every((id) => (s.guns![id] ?? 0) < gunMax(GUNS[id], s) * 0.25);
  }

  private markCleared() {
    // (practice in the Pit leaves the story's room progress alone)
    if (G.rt.pit) return;
    G.s.flags[clearKey(this.dungeon.id, this.roomIdx)] = true;
    G.save();
  }

  init(data: { dungeon: string; room?: number; bossHpPct?: number; rush?: number }) {
    this.sc = this;
    this.dungeon = DUNGEONS[data.dungeon] ?? DUNGEONS.wildern;
    this.roomIdx = data.room ?? 0;
    // walking in from outside (not the next room along): the fairy's fresh again, and every gun you own is topped up
    // to at least 30% (late on, with Kreddle gone, there's nowhere to buy ammo: an empty arsenal looked like a lost one)
    // (not in the Pit: practice runs come with what you brought, and a free top-up there would be an ammo farm)
    if ((data.room ?? 0) === 0 && !G.rt.pit) {
      G.rt.fairyUsed = false;
      G.rt.restocked = restockGuns(G.s, 0.3);
    }
    // Saved progress: walking in from town resumes at the first room you haven't cleared.
    this.resumed = false;
    if (this.roomIdx === 0 && G.s.flags[clearKey(this.dungeon.id, 0)] && !G.rt.pit) {
      let i = 0;
      while (i < this.dungeon.rooms.length - 1 && G.s.flags[clearKey(this.dungeon.id, i)]) i++;
      this.roomIdx = i;
      this.resumed = i > 0;
    }
    this.room = this.dungeon.rooms[this.roomIdx];
    this.waves = (this.room.waves ?? []).map((w) => w.map((x) => [x[0], x[1]] as [string, number]));
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.interactables = [];
    this.waveIdx = -1;
    this.pendingSpawns = 0;
    this.transitioning = false;
    this.waveActive = false;
    this.roomCleared = false;
    this.boss = null;
    this.busy = false;
    this.paused = false;
    this.dying = false;
    this.picking = false;
    this.slowmo = 1;
    // (a slow-mo moment cut short by a scene change mustn't leave the next room in slow motion)
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.vClock = this.time.now;
    this.rule = null;
    this.machineUses = {};
    this.lastWitness = "none";
    this.witnessed = new Set();
    this.enemyTimeScale = 1;
    this.prophecyUntil = 0;
    G.rt.dungeonId = this.dungeon.id;
    G.rt.room = this.roomIdx;
    (this as any)._bossHpPct = data.bossHpPct;
    // boss rush checkpoint: died on Crobley N? Start again from Crobley N
    this.rushIdx = Math.max(0, Math.min(data.rush ?? 0, this.room?.bossRush?.length ?? 0));
    this.miniBossState = "none";
    this.arenaLeft = 0;
    this.heroSquad = null;
    this.citadel = null;
    this.roof = null;
    this.pitFinishing = false;
    this.pitHud = null;
    this.rangeHits = [];
    this.rangeBiggest = 0;
    this.rangeTotal = 0;
  }

  preload() {
    // Da Drongus Dungeon's art, until it's in the manifest
    if (this.dungeon.id === "citadel" || this.room.theme === "citadel") citadelPreload(this);
    if (this.room.event === "roof") roofPreload(this);
    if (this.dungeon.id === "krelford_finale") finalePreload(this);
  }

  /** The fight's own clock: runs at the slow-motion rate (Phaser's scene clock doesn't). */
  private vClock = 0;
  now() {
    return this.vClock;
  }

  create() {
    // (the scene clock is stale until its first update: bring it up to date so start times taken now are right)
    this.time.now = this.game.loop.time;
    const s = G.s;
    s.phase = "dungeon";
    this.chantFreeAt = 0;
    // effects a touch quieter in here, so the level and boss music comes through (they were still drowning it)
    synth.setSfxScale(0.68);
    synth.setMusicBoost(1.35);
    this.events.once("shutdown", () => {
      synth.setSfxScale(1);
      synth.setMusicBoost(1);
    });
    // coming back from a conversation or menu: if a fade-in was frozen by the pause, finish it rather than stay black
    this.events.on("resume", () => {
      const c = this.cameras.main;
      if (c.fadeEffect.isRunning && !c.fadeEffect.direction && c.fadeEffect.progress < 0.05) c.fadeEffect.reset();
    });
    // the catwalks painted into the backdrop become real platforms
    if (this.room.ledges && this.room.backdrop && this.textures.exists(this.room.backdrop)) this.room = { ...this.room, platforms: [...(this.room.platforms ?? []), ...this.ledgePlatforms(this.room)] };
    // (climbing towers are built around the double jump; everywhere else, nothing out of reach)
    if (this.room.platforms?.length && !this.room.tower && this.dungeon.id !== "citadel") this.room = { ...this.room, platforms: this.reachable(this.room) };
    const r = this.room;
    // a Tap Rush lasts for this outing, then wears off back in town
    if (s.flags.tap_rush) s.flags.tap_rush_out = true;
    this.telegraphMult = (s.player === "KREZWONK" ? 1.4 : 1) * ((r.view ?? this.dungeon.view) === "side" ? 1.3 : 1) * diffFor(s).telegraph;
    this.cameras.main.fadeIn(300);
    if (G.rt.restocked > 0) {
      const n = G.rt.restocked;
      G.rt.restocked = 0;
      this.time.delayedCall(900, () => this.toast("AMMO TOPPED UP", `${n} gun${n > 1 ? "s" : ""} restocked to at least 30% for this dungeon.`));
    }
    // a previous room's trip doesn't carry over
    this.cameras.main.setRotation(0).setZoom(1);
    (this.cameras.main as any).postFX?.clear?.();
    this.side = (r.view ?? this.dungeon.view) === "side";
    this.groundY = r.h - 56;
    this.platforms = null;
    this.sideBg = null;
    this.towerBg = null;
    this.sideLevel = this.side ? new SideLevel(this as any, r) : null;
    this.plane = this.side && r.event === "plane" ? new PlaneCabin(this as never, r, { door: () => this.door, cleared: () => this.roomCleared, fight: () => !!this.heroSquad && !this.heroSquad.done }) : null;
    this.colonTube = this.side && r.theme === "colon" ? new ColonTube(this as any, r) : null;
    if (this.side) {
      // with holes in the floor, the floor is made of blocks and the world carries on underneath
      this.physics.world.setBounds(24, 0, r.w - 48, this.sideLevel?.hasGaps ? r.h + 400 : this.groundY);
      // shots may dip a little below the floor line so low shots still hit things standing on it
      this.bounds.setTo(24, 0, r.w - 48, this.groundY + 40);
    } else {
      this.physics.world.setBounds(24, 24, r.w - 48, r.h - 48);
      this.bounds.setTo(24, 24, r.w - 48, r.h - 48);
    }
    if (this.dungeon.id === "citadel" || r.theme === "citadel") citadelReady(this);
    if (r.theme === "citadel")
      this.citadel = new Citadel(this as never, r, {
        talk: (l) => this.talk(l),
        openExit: () => {
          this.roomCleared = true;
          this.markCleared();
          this.door.setTexture("p_door");
        },
        inGap: (x, pad) => !!this.sideLevel?.inGap(x, pad),
        door: () => this.door,
        interact: (it) => this.interactables.push(it),
        hideDoor: () => {
          this.door.setAlpha(0);
          this.doorZone.setTo(-9999, -9999, 1, 1);
        },
        next: () => {
          this.busy = false;
          this.goNextRoom();
        },
        bank: () => {
          this.scene.launch("Menu", { mode: "bank", caller: "Dungeon" });
          this.paused = true;
          this.scene.pause();
        },
        setBusy: (b) => (this.busy = b),
      });
    this.buildRoom();
    if (r.event === "roof") {
      roofReady(this);
      this.obstacles.clear(true, true);
      this.roof = new RoofArena(this as never, r, {
        talk: (l) => this.talk(l),
        startBoss: (id, x, y) => this.startBoss(id, 1, { x, y }),
        setBusy: (b) => (this.busy = b),
        clearHostiles: () => {
          for (const e of [...this.enemies]) if (!e.dead && !e.isBoss) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
          for (const sh of [...this.shots]) if (sh.o.owner === "enemy") this.killShot(sh);
        },
      });
    }
    this.controls = new Controls(this);
    // died fighting a mini-boss? Back in at the start of its arena, not the start of the room
    let cp = r.miniBoss ? G.s.flags[this.miniBossKey()] : undefined;
    // back inside Uncle Rik with the crystal already out: in again where it was, not at the far end of the tube
    const crystal = this.side && G.s.flags.rik_crystal_taken ? r.props?.find((q) => q.kind === "crystal_wall") : undefined;
    if (crystal && cp === undefined) cp = `${Math.round(r.w * crystal.x)},${this.groundY - 40}`;
    const cpx = typeof cp === "string" ? Number(cp.split(",")[0]) : NaN;
    const cpy = typeof cp === "string" ? Number(cp.split(",")[1]) : NaN;
    const startX = this.side ? (Number.isFinite(cpx) ? cpx : 90) : r.w / 2;
    const startY = this.side ? (Number.isFinite(cpy) ? cpy : this.groundY - 40) : r.h - 90;
    // the SanMikverse: playing as Mikey, you're SanMik in there (whatever chapter it is)
    const sanmikverse = this.dungeon.id === "arena_sanmik" || this.dungeon.id === "sanmik_hangout";
    if (sanmikverse && G.s.player === "MIKEY") G.s.flags[SANMIK_FLAG] = true;
    this.player = new Player(this, startX, startY);
    // back from a checkpoint (a mini-boss arena, or the finale's): you come down in a pillar of light
    if (Number.isFinite(cpx) || (this.dungeon.id === "krelford_finale" && G.s.flags.finale_cp)) {
      this.time.delayedCall(250, () => {
        if (!this.player?.spr?.active) return;
        const ps = this.player.spr;
        if (vfx(this, "fe_vfx_respawn", ps.x, ps.y + 20, { scale: 1.1, depth: ps.depth + 2, add: true })) {
          ps.setAlpha(0);
          this.tweens.add({ targets: ps, alpha: 1, delay: 180, duration: 200 });
          Juice.squash(this, ps, 0.35, 420);
          synth.play("heal");
          this.floatText(ps.x, ps.y - 60, "CHECKPOINT", "#ffe066", 14);
        }
      });
    }
    if (Number.isFinite(cpx)) this.sideLevel?.skipTo(cpx, cpy);
    if (this.side) {
      (this.player.spr.body as Phaser.Physics.Arcade.Body).setGravityY(1500);
      // side-on, everyone's drawn bigger (classic run'n'gun proportions)
      (this.player.spr as any).big = SIDE_BIG;
      this.player.spr.setScale(2);
    }
    // walk in holding the first gun in your weapon order (the gun rack at home) that has ammo
    // a new room: your best loaded gun in hand (a Fart Blaster choice only lasts the room)
    G.rt.fartByChoice = false;
    equipBest(s);
    this.spice = new Spice(this);
    this.spice.setup();
    // the meter carries over between rooms; a revision can guarantee a minimum
    this.player.wonk = Math.max(this.player.wonk, activeMods(s).wonkStart);
    // a lad hired at the Central Bank
    this.companion = null;
    if (typeof s.flags.companion === "string" && !this.dungeon.arenaFlag) {
      this.companion = new Companion(this, this.player, s.flags.companion);
      s.flags.companion_used = true;
    }
    // playing as Mikey you ARE SanMik in the SanMikverse: just SanChz alongside you
    this.bros = r.sanBros ? (G.s.player === "MIKEY" ? [new SanBrother(this, this.player, "SANCHZ")] : [new SanBrother(this, this.player, "SANMIK"), new SanBrother(this, this.player, "SANCHZ")]) : [];
    bindSanmikToggle(this, {
      sprites: () => [this.player?.spr],
      can: () => {
        if (sanmikverse) {
          this.toast("THE SANMIKVERSE", "You can't be Mikey here. In the SanMikverse you ARE SanMik.");
          return false;
        }
        return !this.busy && !!this.player && this.time.now >= this.player.superUntil;
      },
    });
    // (a physics group re-applies its defaults to every body added to it, so without this it switched off the
    // world-bounds collision Enemy / Boss set up, and flyers like wisps drifted out of the room where nothing can reach them)
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    if (!this.side) this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player.spr, this.obstacles);
    this.physics.add.collider(this.enemyGroup, this.obstacles);
    if (this.platforms) {
      // one-way platforms: land on them from above, jump up through them, hold down to drop
      const oneWay = (a: any, plat: any) => {
        const b = (a.body ?? a) as Phaser.Physics.Arcade.Body;
        const pb = plat.body as Phaser.Physics.Arcade.StaticBody;
        if (a === this.player.spr && this.now() < this.player.dropUntil) return false;
        return b.velocity.y >= 0 && b.bottom <= pb.top + (isMobile() ? (phoneHooks()?.ledgeTol?.() ?? 14) : 14);
      };
      this.physics.add.collider(this.player.spr, this.platforms, undefined, oneWay);
      this.physics.add.collider(this.enemyGroup, this.platforms, undefined, oneWay);
    }
    this.sideLevel?.attach(this.player.spr, this.enemyGroup);
    this.cameras.main.setBounds(0, 0, r.w, r.h);
    this.cameras.main.startFollow(this.player.spr, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(80, 60);
    this.prompt = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "13px", color: "#ffffff", backgroundColor: "#000000cc", padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(900).setVisible(false);

    if (!this.scene.isActive("UI")) this.scene.launch("UI", { mode: "dungeon" });
    else this.scene.get("UI").events.emit("mode", "dungeon");
    G.emit("room", { name: `${this.dungeon.name} · ${r.name}`, idx: this.roomIdx, total: this.dungeon.rooms.length });
    G.emit("boss", null);
    // Luke Watkins (pudding_demon) is fought to the mind's own track, carried straight on from the rooms before
    const keepsDungeonMusic = r.boss === "pudding_demon";
    this.roomMusicId = keepsDungeonMusic ? (r.music ?? this.dungeon.music) : r.boss && r.theme === "citadel" && r.music ? r.music : r.boss ? (r.boss === "drongus" ? "final" : MUSIC_FILES[`boss_${r.boss}`] ? `boss_${r.boss}` : "boss") : r.music ?? this.dungeon.music;
    this.fightMusicOn = false;
    synth.music(this.roomMusicId);
    // background ambience for the place (quiet, under the music)
    synth.ambience(dressingFor(this.dungeon.id, this.roomIdx)?.ambience ?? (this.dungeon.id === "rik_colon" ? "colon" : r.theme === "industrial" || this.dungeon.id === "crobley_factory" ? "factory" : "dungeon"));
    this.player.headbuttMode = r.boss === "troll";
    if (this.dungeon.timerSec && this.roomIdx === 0 && !G.rt.timerEnd) G.rt.timerEnd = Date.now() + this.dungeon.timerSec * 1000;

    this.events.on("prophecy", (ms: number) => {
      this.prophecyUntil = this.now() + ms;
    });
    this.events.on("krezz-burst", (radius: number) => {
      for (const sh of [...this.shots]) if (sh.o.owner === "enemy" && Phaser.Math.Distance.Between(sh.spr.x, sh.spr.y, this.player.x, this.player.y) < radius) this.killShot(sh);
      if (this.boss instanceof DrongusBoss) this.boss.onBurst(this.player.x, this.player.y, radius);
      const ring = this.add.image(this.player.x, this.player.y, "fx_ring").setTint(0xffd23f).setDepth(700);
      this.tweens.add({ targets: ring, scale: (radius * 2) / 60, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    });
    this.events.on("drop-heal", (x: number, y: number) => this.dropPickup(x, y, "heal", 10));
    this.events.on("decree", (id: string) => this.setRule(BAN_RULES.find((b) => b.id === id) ?? null, true));
    this.events.on("drongus-decree", () => this.drongusDecree());
    this.events.on("epic-phase", (b: Boss, line: string, col?: string) => void this.epicPhaseBreak(b, line, col));
    this.events.on("conflict", () => {
      this.conflictUntil = this.now() + 6000;
      G.emit("conflict", 6000);
    });
    this.events.on("player-dodge", () => this.ruleBroken("NO_DODGE"));
    this.events.on("player-heal", () => this.ruleBroken("NO_HEAL"));
    this.events.on("player-special", () => this.ruleBroken("NO_SPECIAL"));
    this.events.on("ui-resume", () => (this.paused = false));
    // THE KRUNCH PIT: LEAVE from the pause menu, and a line of numbers up top
    if (G.rt.pit) {
      this.events.on("pit-quit", () => void this.pitFinish("quit"));
      this.pitHud = this.add.text(480, 86, "", { fontFamily: FONT, fontSize: "14px", color: "#fde68a", stroke: "#000", strokeThickness: 4, align: "center" }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(990);
    }

    this.events.once("shutdown", () => this.removeListeners());
    this.startRoom();
    G.save();
  }

  // ------------------------------------------------------------------ room building

  /** Shot a weapon pod: a Contra-style power-up letter drops and flies to you. */
  private weaponPod(x: number, y: number) {
    const p = this.player;
    const now = this.now();
    const s = G.s;
    const hurt = s.hp < maxHp(s) * 0.5;
    const opts = [
      { k: "S", name: "SPREAD SHOT", col: "#f87171", go: () => (p.spreadUntil = now + 15000) },
      { k: "M", name: "MACHINE GUN", col: "#fde047", go: () => (p.overdriveUntil = now + 12000) },
      { k: "B", name: "BARRIER", col: "#a78bfa", go: () => (p.shieldUntil = now + 8000) },
      { k: "H", name: "HEALTH", col: "#86efac", go: () => (s.hp = Math.min(maxHp(s), s.hp + maxHp(s) * 0.4)) },
    ];
    const pick = hurt && Math.random() < 0.5 ? opts[3] : opts[Math.floor(Math.random() * (hurt ? 4 : 3))];
    synth.play("boom");
    this.burst(x, y, 0xfde047, 20);
    const t = this.add.text(x, y, pick.k, { fontFamily: "Impact, sans-serif", fontSize: "30px", color: pick.col, stroke: "#000", strokeThickness: 6, backgroundColor: "#00000088", padding: { x: 6, y: 0 } }).setOrigin(0.5).setDepth(1500);
    this.tweens.add({ targets: t, y: y - 40, duration: 300, ease: "Quad.out", onComplete: () => {
      this.tweens.add({ targets: t, x: { getEnd: () => p.x }, y: { getEnd: () => p.y - 10 }, scale: 0.6, duration: 380, ease: "Quad.in", onComplete: () => {
        t.destroy();
        pick.go();
        synth.play("gunget");
        this.cameras.main.flash(160, 255, 255, 255);
        this.floatText(p.x, p.y - 60, `${pick.k}: ${pick.name}!`, pick.col, 20);
      } });
    } });
  }

  /** Backdrop ledges (picture pixels, left half, mirrored) as level platforms, repeated along the room. */
  private ledgePlatforms(r: RoomDef): [number, number, number][] {
    const src = this.textures.get(r.backdrop!).getSourceImage();
    const k = 540 / src.height;
    const tw = src.width;
    const gy = r.h - 56;
    const out: [number, number, number][] = [];
    for (let off = 0; off * k < r.w; off += tw) {
      for (const [x0, x1, y] of r.ledges ?? []) {
        for (const [a, b] of [[x0, x1], [tw - x1, tw - x0]]) {
          const cx = (off + (a + b) / 2) * k;
          const w = (b - a) * k;
          if (cx - w / 2 > r.w - 120 || cx + w / 2 < 40) continue;
          out.push([cx / r.w, gy - y * k, w]);
        }
      }
    }
    return out;
  }

  /**
   * Every platform within a comfortable single jump (~145px) of the ground or of a lower platform near enough to hop
   * from: anything set higher than that is brought down to where you can actually get onto it. Ledges painted into a
   * backdrop keep their height (they have to line up with the art) but still count as somewhere to jump from.
   */
  private reachable(r: RoomDef): [number, number, number][] {
    const REACH = 128;
    const painted = new Set(r.ledges && r.backdrop && this.textures.exists(r.backdrop) ? this.ledgePlatforms({ ...r, platforms: [] }).map((p) => p.join(",")) : []);
    const list = (r.platforms ?? []).map((p, i) => ({ fx: p[0], h: p[1], w: p[2], i, fixed: painted.has(p.join(",")) }));
    const done: { x: number; h: number; w: number }[] = [];
    for (const p of [...list].sort((a, b) => a.h - b.h)) {
      const x = r.w * p.fx;
      if (!p.fixed) {
        const near = done.filter((q) => Math.abs(q.x - x) <= q.w / 2 + p.w / 2 + 170);
        const top = Math.max(0, ...near.map((q) => q.h));
        p.h = Math.min(p.h, top + REACH);
      }
      done.push({ x, h: p.h, w: p.w });
    }
    return list.sort((a, b) => a.i - b.i).map((p) => [p.fx, p.h, p.w]);
  }

  /** Side-scrolling room: parallax backdrop, ground strip, one-way platforms, exit on the right. */
  private buildSideRoom() {
    const r = this.room;
    const gy = this.groundY;
    const sky = this.add.graphics().setDepth(-20).setScrollFactor(0);
    sky.fillGradientStyle(0x2a1050, 0x2a1050, 0xff7aa8, 0xff7aa8, 1).fillRect(0, 0, 960, 540);
    if (r.backdrop && this.textures.exists(r.backdrop)) {
      const src = this.textures.get(r.backdrop).getSourceImage();
      this.sideBgScale = 540 / src.height;
      this.sideBg = this.add.tileSprite(0, 0, 960, 540, r.backdrop).setOrigin(0).setScrollFactor(0).setDepth(-10);
      this.sideBg.setTileScale(this.sideBgScale);
    }
    const tile = `tile_${r.theme}`;
    if (!this.sideLevel?.hasGaps) {
      this.add.tileSprite(0, gy, r.w, r.h - gy, tile).setOrigin(0).setDepth(2).setTint(r.theme === "citadel" ? 0xa898b8 : 0x8a8a9a);
      this.add.rectangle(0, gy, r.w, 4, 0x000000, 0.6).setOrigin(0).setDepth(3);
    }
    this.platforms = this.physics.add.staticGroup();
    for (const [fx, h, w] of r.platforms ?? []) {
      const x = r.w * fx;
      const y = gy - h;
      if (this.plane) {
        this.plane.platform(x, y, w);
      } else if (this.citadel) {
        this.citadel.platform(x, y, w, !!r.tower);
      } else if (this.colonTube) {
        this.colonTube.platform(x, y, w);
      } else if (r.tower && this.textures.exists("tw_ledge")) {
        // PixelLab gothic ledge: carved arches, gold trim, corbels; capped with a dark edge each end
        this.add.tileSprite(x, y - 9, w, 29, "tw_ledge").setOrigin(0.5, 0).setDepth(4);
        this.add.rectangle(x - w / 2, y - 9, 2, 22, 0x0b0610).setOrigin(0, 0).setDepth(4);
        this.add.rectangle(x + w / 2, y - 9, 2, 22, 0x0b0610).setOrigin(1, 0).setDepth(4);
      } else if (r.tower) {
        // gothic stone ledge: dark stone, gold trim, little corbels underneath
        const g = this.add.graphics().setDepth(4);
        g.fillStyle(0x2a1a33, 1).fillRect(x - w / 2, y - 7, w, 16);
        g.fillStyle(0x3b2547, 1).fillRect(x - w / 2, y - 7, w, 5);
        g.fillStyle(0xd4a017, 1).fillRect(x - w / 2, y - 9, w, 3);
        for (let cx = x - w / 2 + 14; cx < x + w / 2 - 6; cx += 28) g.fillStyle(0x1f1226, 1).fillTriangle(cx - 9, y + 9, cx + 9, y + 9, cx, y + 22);
        g.lineStyle(1, 0x000000, 0.6).strokeRect(x - w / 2, y - 7, w, 16);
      } else if (r.ledges) {
        // painted into the backdrop already: just a faint edge so you can see it's solid
        this.add.rectangle(x, y - 6, w, 2, 0xfff1c1, 0.35).setDepth(4);
      } else if (r.trip) {
        // wonder platforms: rainbow jelly, wobbling to the beat
        const c = this.add.container(x, y).setDepth(4);
        const cols = [0xf472b6, 0xfacc15, 0x4ade80, 0x22d3ee, 0xa78bfa];
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -6, w, 18, 9);
        g.fillStyle(cols[Math.floor(fx * 37) % cols.length], 1).fillRoundedRect(-w / 2, -9, w, 18, 9);
        g.fillStyle(0xffffff, 0.45).fillRoundedRect(-w / 2 + 8, -7, w - 16, 5, 3);
        for (let dx = -w / 2 + 16; dx < w / 2 - 8; dx += 24) g.fillStyle(0xffffff, 0.8).fillCircle(dx, 3, 2.5);
        c.add(g);
        const eyes = this.add.text(0, -2, "◕‿◕", { fontFamily: FONT, fontSize: "11px", color: "#111827" }).setOrigin(0.5);
        c.add(eyes);
        this.tweens.add({ targets: c, scaleY: { from: 1, to: 1.3 }, scaleX: { from: 1, to: 0.96 }, yoyo: true, repeat: -1, duration: 234, delay: Math.floor(fx * 1000) % 234, ease: "Sine.inOut" });
      } else {
        this.add.tileSprite(x, y, w, 14, tile).setDepth(4).setTint(0xb0a0c0);
        this.add.rectangle(x, y - 7, w, 3, 0xffd23f, 0.8).setDepth(5);
        this.add.rectangle(x, y + 7, w, 3, 0x000000, 0.5).setDepth(5);
      }
      const plat = this.add.rectangle(x, y, w, 14, 0, 0);
      this.platforms.add(plat);
    }
    this.sideLevel?.build(this.platforms);
    this.obstacles = this.physics.add.staticGroup();
    this.colonTube?.build(this.obstacles);
    const dx = r.exitAt ? r.w * r.exitAt[0] : r.w - 70;
    const dy = r.exitAt ? gy - r.exitAt[1] - 7 : gy;
    this.door = this.add.image(dx, dy - 30, "p_door_locked").setScale(2.2).setDepth(6);
    this.doorZone = new Phaser.Geom.Rectangle(dx - 60, dy - 110, 120, 110);
    const exitLabel = r.boss ? "" : r.exitLabel ?? (r.tower ? "THE SQUEEZING ROOM ↑" : "EXIT →");
    if (exitLabel) this.add.text(dx, dy - 78, exitLabel, { fontFamily: FONT, fontSize: "12px", color: "#ffffff", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(6);
    if (r.tower) this.decorateTower();
    else this.citadel?.side();
    this.sideQuestPickups();
    this.plane?.build();
    const t = this.add.text(480, 200, r.name.toUpperCase(), { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(950).setShadow(3, 3, "#000", 0);
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 700, onComplete: () => t.destroy() });
    for (const p of r.props ?? []) if (evalCond(p.cond, G.s)) this.addProp(p);
    if (r.gunCrate && !G.rt.pit) this.time.delayedCall(600, () => this.maybeGunCrate(true));
  }

  private towerBg: Phaser.GameObjects.TileSprite | null = null;

  /** Personal-quest pickups in side-on rooms: on the floor (or up on a ledge in a tower). */
  private sideQuestPickups() {
    const r = this.room;
    for (const { quest, spot } of G.rt.pit ? [] : pickupsInDungeon(G.s, this.dungeon.id, this.roomIdx)) {
      let x = r.w * (0.25 + Math.random() * 0.5);
      let y = this.groundY - 30;
      if (r.tower && r.platforms?.length) {
        const [fx, h] = r.platforms[Math.floor(r.platforms.length * (0.2 + Math.random() * 0.5))];
        x = r.w * fx;
        y = this.groundY - h - 30;
      } else if (this.sideLevel?.inGap(x, 40)) x += 260;
      const spr = this.add.image(x, y, "p_scroll").setScale(2).setDepth(20);
      this.tweens.add({ targets: spr, y: y - 6, yoyo: true, repeat: -1, duration: 600 });
      const glow = this.add.circle(x, y, 16, 0xffd23f, 0.25).setDepth(19);
      this.pickups.push({
        spr,
        kind: "quest",
        value: 0,
        onCollect: () => {
          glow.destroy();
          collectPickup(G.s, quest, spot);
          synth.play("pickup");
          this.toast("PERSONAL QUEST", `${quest.title}: ${spot.label}`);
        },
      });
    }
  }

  /** The Cuddle Tower: pink walls going up forever, cuddle drawings, floor numbers, hearts. */
  private decorateTower() {
    const r = this.room;
    const gy = this.groundY;
    if (this.citadel) {
      this.towerBg = this.citadel.tower();
      return;
    }
    // the gothic wall: crimson stone, pink stained-glass hearts, scrolling a bit slower than you climb
    if (this.textures.exists("tw_gothic")) {
      this.towerBg = this.add.tileSprite(0, 0, 960, 540, "tw_gothic").setOrigin(0).setScrollFactor(0).setDepth(-12).setTileScale(2);
    } else {
      this.towerBg = this.add.tileSprite(0, 0, 960, 540, "tile_mansion").setOrigin(0).setScrollFactor(0).setDepth(-12).setTint(0x5b1f3a);
    }
    // a little moonlight and gloom
    this.add.rectangle(0, 0, 960, 540, 0x12051a, 0.25).setOrigin(0).setScrollFactor(0).setDepth(-11);
    // crimson banners with Cronny's heart, hanging between floors
    const mottos = ["OL' CRONNY ♥", "GIVE US A CUD", "SQUEEZE", "COME UP LOVE", "♥ ♥ ♥", "JUICES :)"];
    let k = 0;
    for (let y = gy - 260; y > 120; y -= 420) {
      for (const x of k % 2 ? [90, 870] : [300, 660]) {
        if (this.textures.exists("tw_banner")) {
          this.add.image(x, y - 78, "tw_banner").setOrigin(0.5, 0).setScale(1.5).setDepth(-6);
          this.add.text(x, y + 38, mottos[k % mottos.length], { fontFamily: "Georgia, serif", fontSize: "9px", color: "#fde68a", fontStyle: "bold", align: "center", wordWrap: { width: 46 }, stroke: "#3b0a14", strokeThickness: 3 }).setOrigin(0.5).setDepth(-5);
          continue;
        }
        const g = this.add.graphics().setDepth(-6);
        g.fillStyle(0x7f1d1d, 1).fillRect(x - 26, y - 70, 52, 120).fillTriangle(x - 26, y + 50, x + 26, y + 50, x, y + 72);
        g.lineStyle(3, 0xd4a017, 1).strokeRect(x - 26, y - 70, 52, 120);
        g.fillStyle(0xd4a017, 1).fillRect(x - 34, y - 76, 68, 6);
        g.fillStyle(0xf472b6, 1).fillCircle(x - 7, y - 20, 9).fillCircle(x + 7, y - 20, 9).fillTriangle(x - 15, y - 16, x + 15, y - 16, x, y + 4);
        this.add.text(x, y + 30, mottos[k % mottos.length], { fontFamily: "Georgia, serif", fontSize: "9px", color: "#fde68a", fontStyle: "bold", align: "center", wordWrap: { width: 46 } }).setOrigin(0.5).setDepth(-5);
      }
      k++;
    }
    // candelabras on the ledges, flames flickering
    (r.platforms ?? []).forEach(([fx, h, w], i) => {
      if (i % 2) return;
      const x = r.w * fx + (i % 4 ? -1 : 1) * (w / 2 - 14);
      const y = gy - h - 7;
      if (this.textures.exists("tw_candelabra")) {
        this.add.image(x, y + 1, "tw_candelabra").setOrigin(0.5, 1).setScale(1.25).setDepth(6);
        const glow = this.add.ellipse(x, y - 43, 40, 16, 0xfbbf24, 0.14).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, scaleY: { from: 0.85, to: 1.2 }, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 160 + ((i * 37) % 120) });
        return;
      }
      const g = this.add.graphics().setDepth(6);
      g.fillStyle(0x3f3f46, 1).fillRect(x - 2, y - 26, 4, 26).fillRect(x - 12, y - 26, 24, 3).fillRect(x - 8, y - 3, 16, 3);
      for (const dx of [-11, 0, 11]) {
        g.fillStyle(0xf5f5f4, 1).fillRect(x + dx - 2, y - 36, 4, 10);
        const fl = this.add.ellipse(x + dx, y - 40, 5, 9, 0xfbbf24).setDepth(7);
        const glow = this.add.circle(x + dx, y - 40, 14, 0xf97316, 0.18).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: [fl, glow], scaleY: { from: 0.85, to: 1.2 }, alpha: { from: 0.75, to: 1 }, yoyo: true, repeat: -1, duration: 160 + ((i * 37 + dx * 7) % 120) });
      }
    });
    // floor numbers so you can see how far you've come
    for (let f = 1; f * 336 < r.h - 300; f++) this.add.text(40, gy - f * 336, `FLOOR ${f}`, { fontFamily: "Georgia, serif", fontSize: "14px", color: "#fde68a", fontStyle: "bold" }).setDepth(-5).setAlpha(0.6);
  }

  private buildRoom() {
    const r = this.room;
    if (this.side) return this.buildSideRoom();
    const dressing = dressingFor(this.dungeon.id, this.roomIdx);
    let themeTile = `tile_${r.theme}`;
    if (r.theme === "mind") this.mindTile();
    if (dressing?.floor) themeTile = floorTile(this, dressing.floor) ?? (this.textures.exists(dressing.floor) ? dressing.floor : themeTile);
    const floor = this.add.tileSprite(0, 0, r.w, r.h, themeTile).setOrigin(0).setDepth(0);
    const fallbackTint = dressing?.floor ? floorFallbackTint(this, dressing.floor) : undefined;
    if (dressing?.floorTint !== undefined) floor.setTint(dressing.floorTint);
    else if (fallbackTint !== undefined) floor.setTint(fallbackTint);
    if (dressing?.floorScale) floor.setTileScale(dressing.floorScale);
    const wallCol = { school: 0x6b5b4b, mansion: 0x3b2a1a, lounge: 0xd9ccae, network: 0x0b1530, industrial: 0x1f2937, temple: 0x4a3a2a, prison: 0x111827, wiki: 0xa2a9b1, colon: 0x7a1f3a, mind: 0xb0246b, citadel: 0x140c1c }[r.theme];
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(wallCol, 1);
    g.fillRect(0, 0, r.w, 24);
    g.fillRect(0, r.h - 24, r.w, 24);
    g.fillRect(0, 0, 24, r.h);
    g.fillRect(r.w - 24, 0, 24, r.h);
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(24, 24, r.w - 48, r.h - 48);
    // PixelLab walls: an illustrated back wall, shaded side and front walls
    const wallKey = `wall_${r.theme}`;
    if (this.textures.exists(wallKey)) {
      const src = this.textures.get(wallKey).getSourceImage();
      const back = this.add.tileSprite(0, 0, r.w, 56, wallKey).setOrigin(0).setDepth(1);
      back.setTileScale(56 / src.height);
      if (dressing?.wallTint !== undefined) back.setTint(dressing.wallTint);
      for (const [x, y, w, h] of [
        [0, r.h - 24, r.w, 24],
        [0, 0, 24, r.h],
        [r.w - 24, 0, 24, r.h],
      ])
        this.add.tileSprite(x, y, w, h, wallKey).setOrigin(0).setDepth(1).setTint(dressing?.wallTint ?? 0x8a7f9a).setTileScale(0.5);
      this.add.rectangle(0, 56, r.w, 6, 0x000000, 0.35).setOrigin(0).setDepth(1);
    }
    this.obstacles = this.physics.add.staticGroup();
    this.decorate(r);
    if (r.theme === "mind") this.mindscape(r);
    this.citadel?.topDown();
    // door
    // the door sits in the back wall, its foot on the floor line (the PixelLab door is a full doorway)
    this.door = this.add.image(r.w / 2, 60, "p_door_locked").setOrigin(0.5, 1).setScale(2).setDepth(2);
    this.doorZone = new Phaser.Geom.Rectangle(r.w / 2 - 40, 0, 80, 46);
    this.add.text(r.w / 2, 40, r.boss ? "" : "EXIT", { fontFamily: FONT, fontSize: "10px", color: "#ffffff" }).setOrigin(0.5).setDepth(2);
    // room title
    const t = this.add.text(r.w / 2, r.h / 2 - 60, r.name.toUpperCase(), { fontFamily: FONT, fontSize: "28px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(950).setShadow(3, 3, "#000", 0);
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 700, onComplete: () => t.destroy() });
    // props
    for (const p of r.props ?? []) if (evalCond(p.cond, G.s)) this.addProp(p);
    if (r.gunCrate) this.time.delayedCall(600, () => this.maybeGunCrate(true));
    // quest pickups
    for (const { quest, spot } of pickupsInDungeon(G.s, this.dungeon.id, this.roomIdx)) {
      const x = r.w * (0.15 + Math.random() * 0.7);
      const y = r.h * (0.25 + Math.random() * 0.3);
      const spr = this.add.image(x, y, "p_scroll").setScale(2).setDepth(20);
      this.tweens.add({ targets: spr, y: y - 6, yoyo: true, repeat: -1, duration: 600 });
      const glow = this.add.circle(x, y, 16, 0xffd23f, 0.25).setDepth(19);
      this.pickups.push({
        spr,
        kind: "quest",
        value: 0,
        onCollect: () => {
          glow.destroy();
          collectPickup(G.s, quest, spot);
          synth.play("pickup");
          this.toast("PERSONAL QUEST", `${quest.title}: ${spot.label}`);
        },
      });
    }
  }

  private decorate(r: RoomDef) {
    const rnd = new Phaser.Math.RandomDataGenerator([`${this.dungeon.id}${this.roomIdx}`]);
    // a room of its own: dressed to be the place it is (dressing/*.ts)
    const dressing = dressingFor(this.dungeon.id, this.roomIdx);
    this.dress = null;
    if (dressing) {
      this.dress = new Kit(this, r, this.obstacles, `${this.dungeon.id}:${this.roomIdx}`);
      if (dressing.keepGeneric && r.theme === "lounge") this.decorateLounge(r);
      dressing.build(this.dress);
      this.dress.finish();
      if (dressing.weather) {
        synth.weatherSound(dressing.weather);
        this.events.once("shutdown", () => synth.weatherSound(null));
      }
      if (!dressing.keepGeneric || r.theme === "lounge") return;
    }
    if (r.theme === "lounge") return this.decorateLounge(r);
    // PixelLab set dressing along the walls, clear of the centre lane and the door
    const decor = [0, 1, 2].map((i) => `dec_${r.theme}_${i}`).filter((k) => this.textures.exists(k));
    if (decor.length) {
      const spots: [number, number][] = [];
      for (let x = 90; x < r.w - 90; x += 150) spots.push([x, 92], [x, r.h - 60]);
      for (let y = 180; y < r.h - 120; y += 160) spots.push([60, y], [r.w - 60, y]);
      spots.forEach(([x, y], i) => {
        if (Math.abs(x - r.w / 2) < 110 || rnd.frac() < 0.45) return;
        const k = decor[i % decor.length];
        this.add.image(x, y + 24, k).setOrigin(0.5, 1).setDepth(y + 24);
        this.obstacles.add(this.add.rectangle(x, y + 10, 44, 24, 0, 0));
      });
    }
    const n = r.boss || r.theme === "colon" || r.theme === "mind" ? 0 : 3;
    for (let i = 0; i < n; i++) {
      const x = rnd.between(140, r.w - 140);
      const y = rnd.between(160, r.h - 200);
      if (Math.abs(x - r.w / 2) < 120) continue;
      const pillarKey = `pillar_${r.theme}`;
      const art = this.textures.exists(pillarKey);
      const pillar = this.add.rectangle(x, y, 40, 40, r.theme === "wiki" ? 0xc8ccd1 : 0x000000, art ? 0 : r.theme === "wiki" ? 1 : 0.35).setDepth(3);
      if (!art) pillar.setStrokeStyle(2, 0x000000, 0.4);
      else this.add.image(x, y + 20, pillarKey).setOrigin(0.5, 1).setDepth(y + 20);
      this.obstacles.add(pillar);
      if (r.theme === "wiki" && !art) this.add.text(x, y, "[edit]", { fontFamily: FONT, fontSize: "9px", color: "#3366cc" }).setOrigin(0.5).setDepth(4);
    }
    // flavour
    const flav: Record<string, string[]> = {
      school: ["LOST PROPERTY: 1x Krez-ouser", "NO WONKING IN CORRIDORS", "Wildern (Krelford branch)"],
      mansion: ["Polson Towers Wi-Fi: cheese", "Shoes OFF", "Shoes ON"],
      network: ["Mutual friends: 0", "Seen", "Pending…", "Typing…"],
      industrial: ["PRESSURE: LOW", "DO NOT DRINK", "Extra Virgin Krezz Oil"],
      temple: ["THOU SHALT REACT", "AND I MEAN IT", "pls"],
      prison: ["6 KREZ YEARS", "Ok, makes sense", "VERSION B"],
      wiki: ["[citation needed]", "This page does not exist", "Talk", "Edit source"],
      colon: ["HAUSTRA", "MUCOSA (WET)", "1x SWEETCORN (2019)", "DO NOT TOUCH THE WALLS"],
      mind: ["NEVER AGAIN (DRAFT 41)", "CUSTARD LEVEL: CRITICAL", "THOUGHTS: 1 (PUDDING)", "MINISTERIAL CONSCIENCE (OUT OF ORDER)"],
      citadel: ["SERVER ROOM 6 (OF 600)", "NO REACTS BEYOND THIS POINT", "PROMPTS: 1,412,906", "ALL HAIL THE SUPREME LEADER"],
    };
    const list = flav[r.theme] ?? [];
    list.forEach((txt, i) => {
      this.add.text(60 + i * (r.w / Math.max(1, list.length)), r.h - 46, txt, { fontFamily: FONT, fontSize: "10px", color: "#ffffff" }).setAlpha(0.35).setDepth(2);
    });
    if (r.theme === "industrial") for (let x = 40; x < r.w - 40; x += 64) this.add.image(x, 34, "p_pipe").setScale(2).setDepth(1).setAlpha(0.8);
  }

  /**
   * Polson's front room, cleared for the fight: the furniture's shoved back against the walls (sofa bed folded up,
   * the telly, the fireplace, the guitar case, the cans), the rug in the middle, the curtains drawn behind.
   */
  private decorateLounge(r: RoomDef) {
    const put = (key: string, x: number, y: number, block?: [number, number], depth?: number) => {
      if (!this.textures.exists(key)) return;
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth ?? y).setScale(2.2);
      if (block) this.obstacles.add(this.add.rectangle(x, y - block[1] / 2, block[0], block[1], 0, 0));
    };
    if (this.textures.exists("lounge_rug")) this.add.image(r.w / 2, r.h / 2 + 30, "lounge_rug").setDepth(1).setScale(3.2).setAlpha(0.95);
    // the back wall: the bay window with the curtains drawn, the sign, the cheese
    put("lounge_window", r.w * 0.3, 64, undefined, 2);
    put("lounge_sign", r.w * 0.1, 50, undefined, 2);
    put("lounge_cheese", r.w * 0.68, 52, undefined, 2);
    // shoved against the walls
    put("dec_lounge_1", r.w * 0.86, 150, [110, 50]);
    put("dec_lounge_2", r.w - 70, r.h * 0.5, [100, 70]);
    put("lounge_guitar", r.w - 70, r.h * 0.5 + 150, [50, 40]);
    put("dec_lounge_0", 170, r.h - 30, [120, 60]);
    put("lounge_table", 320, r.h - 30, [50, 40]);
    put("lounge_lamp", r.w / 2, 150, undefined, 5000);
    const notes = ["Polson Towers Wi-Fi: cheese", "THE SOFA BED HAS BEEN OUT SINCE 2022", "Shoes OFF"];
    notes.forEach((txt, i) => this.add.text(60 + i * (r.w / notes.length), r.h - 46, txt, { fontFamily: FONT, fontSize: "10px", color: "#3b2a1a" }).setAlpha(0.45).setDepth(2));
  }

  /** Lulon's mind: a warm custard floor with pink swirls (drawn here; no art needed). */
  private mindTile() {
    if (this.textures.exists("tile_mind")) return;
    const t = this.textures.createCanvas("tile_mind", 64, 64)!;
    const ctx = t.getContext();
    ctx.fillStyle = "#f3cf86";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#ecbf6a";
    for (let i = 0; i < 9; i++) ctx.fillRect((i * 23) % 60, (i * 37) % 60, 6, 3);
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(32, 32, 10, 0, Math.PI * 1.5);
    ctx.arc(32, 32, 18, Math.PI * 1.5, Math.PI * 2.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#7c2d12"; // the odd raisin
    ctx.fillRect(8, 50, 3, 3);
    ctx.fillRect(52, 10, 3, 3);
    t.refresh();
  }

  /** Inside Lulon's mind: the room breathes, the colours drift, pudding dishes and brain-folds float past. */
  private mindscape(r: RoomDef) {
    const haze = this.add.rectangle(0, 0, r.w, r.h, 0xff4fd8, 0.12).setOrigin(0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    const cols = [0xff4fd8, 0xfacc15, 0xa78bfa, 0xfb7185, 0x22d3ee];
    let k = 0;
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.tweens.add({ targets: haze, fillColor: cols[++k % cols.length], duration: 850 }) });
    this.tweens.add({ targets: haze, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 1300, ease: "Sine.inOut" });
    // floating stuff: pudding dishes, brain folds and the word KIDS, faint, drifting in the custard
    const rnd = new Phaser.Math.RandomDataGenerator([`mind${this.roomIdx}`]);
    for (let i = 0; i < 14; i++) {
      const x = rnd.between(60, r.w - 60);
      const y = rnd.between(90, r.h - 60);
      let o: Phaser.GameObjects.GameObject & { x: number; y: number };
      if (i % 3 === 0 && this.textures.exists("mind_pudding")) {
        o = this.add.image(x, y, "mind_pudding").setScale(rnd.between(10, 16) / 10).setAlpha(0.6);
      } else if (i % 3 === 0) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.25).fillEllipse(0, 0, 70, 30);
        g.fillStyle(0xd97706, 0.35).fillEllipse(0, -3, 56, 18);
        g.fillStyle(0xfde68a, 0.4).fillEllipse(0, -5, 44, 10);
        g.setPosition(x, y);
        o = g;
      } else if (i % 3 === 1) {
        const g = this.add.graphics();
        g.lineStyle(4, 0xf472b6, 0.3);
        for (let j = 0; j < 3; j++) g.strokeCircle(j * 14 - 14, Math.sin(j) * 6, 12);
        g.setPosition(x, y);
        o = g;
      } else o = this.add.text(x, y, "KIDS", { fontFamily: "Impact, sans-serif", fontSize: `${rnd.between(16, 34)}px`, color: "#b0246b" }).setOrigin(0.5).setAlpha(0.18);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(1);
      this.tweens.add({ targets: o, x: x + rnd.between(-40, 40), y: y + rnd.between(-30, 30), angle: rnd.between(-25, 25), yoyo: true, repeat: -1, duration: rnd.between(2600, 4800), ease: "Sine.inOut" });
    }
    // the whole mind gently breathes (only while you're fighting, so cutscene cameras aren't fought over)
    const breathe = () => {
      if (this.busy || this.transitioning || this.time.now < this.mindSpinUntil) return;
      this.cameras.main.setZoom(1 + 0.035 * (0.5 - 0.5 * Math.cos((this.time.now / 1700) * Math.PI)));
    };
    this.events.on("update", breathe);
    this.events.once("shutdown", () => this.events.off("update", breathe));
  }

  private mindSpinUntil = 0;

  /** Arriving in Lulon's mind (after the opening lines): you spin out of the trip into the custard. */
  private mindArrive() {
    const cam = this.cameras.main;
    this.mindSpinUntil = this.time.now + 1500;
    cam.setZoom(2.6).setRotation(0.9);
    this.tweens.add({ targets: cam, rotation: 0, duration: 1400, ease: "Cubic.out" });
    this.tweens.addCounter({ from: 2.6, to: 1, duration: 1400, ease: "Cubic.out", onUpdate: (tw) => cam.setZoom(tw.getValue() ?? 1) });
    cam.flash(700, 255, 120, 220);
  }

  private addProp(p: PropDef) {
    const r = this.room;
    const x = r.w * p.x;
    const y = this.side ? this.groundY - 20 : r.h * p.y;
    const y0 = y;
    switch (p.kind) {
      case "wonking_machine": {
        const spr = this.add.image(x, y, "p_wonking").setScale(2.4).setDepth(y);
        this.obstacles.add(this.add.rectangle(x, y + 10, 80, 70, 0, 0));
        this.add.text(x, y - 66, "WONKING MACHINE", { fontFamily: FONT, fontSize: "11px", color: "#ffd23f", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(y + 1);
        this.machineUses[p.id!] = 0;
        this.interactables.push({ x, y: y + 60, r: 70, label: "Wonking Machine (fills your Wonk + Krezz)", use: () => this.useWonkingMachine(p.id!, spr) });
        break;
      }
      case "vending": {
        this.add.image(x, y, "p_vending").setScale(2).setDepth(y);
        this.interactables.push({ x, y: y + 40, r: 50, label: "Pussy Juice Vending (15 Krezzcoin)", use: () => this.useVending(x, y) });
        break;
      }
      case "mollor": {
        // tied to a chair, very cross
        const chair = this.add.rectangle(x, y + 14, 44, 30, 0x7c2d12).setDepth(y - 1);
        const spr = this.add.sprite(x, y, this.textures.exists("spr_MOLLOR") ? "spr_MOLLOR" : "spr_FOLK1", 0).setScale(2.4).setDepth(y);
        const ropes = this.add.graphics().setDepth(y + 1);
        ropes.lineStyle(4, 0xd6b370, 1);
        for (const dy of [-6, 6, 16]) ropes.lineBetween(x - 22, y + dy, x + 22, y + dy + 3);
        this.obstacles.add(this.add.rectangle(x, y + 10, 50, 40, 0, 0));
        void chair;
        this.interactables.push({ x, y: y + 50, r: 70, label: "Untie Mollor", enabled: () => !G.s.flags.mollor_freed, use: () => void this.rescueMollor(spr, ropes) });
        break;
      }
      case "valve": {
        const spr = this.add.image(x, y, "p_valve").setScale(2.4).setDepth(y);
        this.interactables.push({
          x,
          y,
          r: 60,
          label: "Open main valve",
          enabled: () => !G.s.flags[`valve_${p.id}`],
          use: () => {
            G.s.flags[`valve_${p.id}`] = true;
            spr.setTexture("p_valve_open");
            synth.play("explode");
            this.aoe(x, y, 160, 30, { knock: 420, color: 0xffb6c1 });
            this.floatText(x, y - 40, "PRESSURE RESTORED", "#ffb6c1", 14);
            const all = (this.room.props ?? []).filter((q) => q.kind === "valve").every((q) => G.s.flags[`valve_${q.id}`]);
            if (all) {
              G.s.flags.valves_done = true;
              this.toast("PUMPING STATION ALPHA", "All valves open. Pussy juice is flowing back to Krelford.");
              this.checkExit();
            }
          },
        });
        break;
      }
      case "tv": {
        this.add.image(x, y, "p_tv").setScale(2).setDepth(y);
        this.interactables.push({ x, y: y + 30, r: 50, label: "Watch KrelTV", use: () => this.openTV() });
        break;
      }
      case "sign": {
        this.add.image(x, y, "p_sign").setScale(2).setDepth(y);
        this.interactables.push({ x, y: y + 30, r: 60, label: "Read", use: () => this.talk([dir(p.label ?? "")]) });
        break;
      }
      case "talker": {
        const key = p.image ?? `spr_${p.speaker}`;
        // playing as Mikey you're SanMik in here: no second one standing about
        if (G.s.player === "MIKEY" && (key === "spr_SANMIK" || key === "spr_MIKEY")) break;
        const big = key.startsWith("p_");
        const tex = this.textures.exists(key) ? key : "p_sign";
        const spr = key.startsWith("spr_") ? this.add.sprite(x, y, tex, 0).setScale(this.side ? 2.6 : 2.2) : this.add.image(x, y, tex).setScale(big ? (this.side ? (key === "p_hottub" ? 1.5 : 1.25) : 1.2) : 2);
        spr.setDepth(this.side ? 7 : y);
        if (this.side) spr.setOrigin(0.5, 1).setY(this.groundY + 2);
        if (key === "p_gabor") this.tweens.add({ targets: spr, angle: 4, yoyo: true, repeat: -1, duration: 500 });
        const topY = this.side ? this.groundY - spr.displayHeight - 12 : y - spr.displayHeight / 2 - 10;
        this.add.text(x, topY, p.label ?? "", { fontFamily: FONT, fontSize: "10px", color: "#ffd23f", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(this.side ? 8 : y + 1);
        const verb = p.action === "hottub" ? "Get in the hot tub" : p.action === "jukebox" ? "Change the song" : p.action === "pepsi" ? "Buy a Pepsi (5)" : `Talk to ${p.label ?? "them"}`;
        this.interactables.push({ x, y: this.side ? this.groundY - 24 : y + 20, r: this.side ? 80 : 70, label: verb, use: () => void this.useTalker(p) });
        break;
      }
      case "bertha": {
        this.add.image(x, y, "p_bertha").setScale(2.4).setDepth(y);
        this.interactables.push({ x, y: y + 40, r: 70, label: "Inspect Big Bertha", use: () => this.inspectBertha() });
        break;
      }
      case "crystal_wall": {
        // the cum crystal, lying on the floor of the colon in a puddle, with a big obvious E prompt over it
        const floor = this.side ? this.groundY : y0 + 28;
        const cy = floor - 30;
        this.add.ellipse(x, floor - 2, 110, 18, 0x9f1239, 0.85).setDepth(floor - 3);
        const glow = this.add.circle(x, cy, 52, 0xfff1f2, 0.28).setDepth(floor - 2).setBlendMode(Phaser.BlendModes.ADD);
        const cr = this.add.image(x, floor - 4, this.textures.exists("cum_crystal") ? "cum_crystal" : "p_scroll").setOrigin(0.5, 1).setDepth(floor);
        cr.setScale(60 / Math.max(cr.height, 1));
        this.tweens.add({ targets: [glow], scale: 1.3, alpha: 0.1, yoyo: true, repeat: -1, duration: 700 });
        const ek = prettyKey(keysFor("interact")[0] ?? "E");
        const lab = this.add
          .text(x, floor - 108, `▼  ${isTouchDevice(this.game) ? "TAP" : `PRESS ${ek}`}: TAKE THE CUM CRYSTAL  ▼`, { fontFamily: "Impact, sans-serif", fontSize: "20px", color: "#ffd23f", stroke: "#000", strokeThickness: 5, backgroundColor: "#000000aa", padding: { x: 8, y: 3 } })
          .setOrigin(0.5)
          .setDepth(floor + 50);
        this.tweens.add({ targets: lab, y: lab.y - 10, yoyo: true, repeat: -1, duration: 450, ease: "Sine.inOut" });
        this.tweens.add({ targets: lab, scale: 1.08, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
        if (G.s.flags.rik_crystal_taken) [glow, cr, lab].forEach((o) => o.destroy());
        this.interactables.push({
          x,
          y: floor - 20,
          r: this.side ? 100 : 80,
          label: "Take the cum crystal",
          enabled: () => !G.s.flags.rik_crystal_taken,
          use: () => void this.takeRikCrystal([glow, cr, lab]),
        });
        break;
      }
      case "bomb_spot": {
        const ring = this.add.circle(x, y, 26, 0xef4444, 0.22).setStrokeStyle(3, 0xef4444).setDepth(3);
        this.tweens.add({ targets: ring, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });
        const key = `rik_bomb_${p.id}`;
        if (G.s.flags[key]) this.plantedBomb(x, y, ring);
        this.interactables.push({
          x,
          y,
          r: 55,
          label: "Plant a bomb",
          enabled: () => !G.s.flags[key],
          use: () => {
            if (!G.s.flags.rik_crystal_taken) {
              this.toast("NOT YET", "Get the crystal out first. You don't want to blow it up with him.");
              return;
            }
            G.s.flags[key] = true;
            synth.play("pickup");
            this.plantedBomb(x, y, ring);
            const all = (this.room.props ?? []).filter((q) => q.kind === "bomb_spot");
            const n = all.filter((q) => G.s.flags[`rik_bomb_${q.id}`]).length;
            if (n < all.length) this.toast(`BOMB ${n} OF ${all.length} PLANTED`, n === 1 ? `${sanRadio()} (radio): Yee. Lovely. Keep going.` : n === 2 ? "GENIE (radio): Hurry. Something just MOVED in there." : `${sanRadio()} (radio): One more, then leg it.`);
            else void this.colonFinale();
          },
        });
        break;
      }
      case "reaction_terminal": {
        const spr = this.add.image(x, y, "p_terminal").setScale(2.4).setDepth(y);
        this.add.text(x, y - 50, "REACTION NETWORK TERMINAL", { fontFamily: FONT, fontSize: "10px", color: "#7fb3ff", backgroundColor: "#000000aa" }).setOrigin(0.5).setDepth(y + 1);
        this.interactables.push({
          x,
          y: y + 40,
          r: 70,
          label: "Restore the Reaction Network",
          enabled: () => !G.s.flags.network_restored,
          use: () => this.restoreNetwork(spr),
        });
        break;
      }
    }
  }

  private plantedBomb(x: number, y: number, ring: Phaser.GameObjects.Arc) {
    this.tweens.killTweensOf(ring);
    ring.setScale(1).setFillStyle(0x111111, 0.4);
    this.add.circle(x, y, 13, 0x1f2937).setStrokeStyle(2, 0x000000).setDepth(y);
    this.add.rectangle(x + 6, y - 12, 3, 9, 0xd6b370).setDepth(y);
    const led = this.add.circle(x, y, 4, 0xff2020).setDepth(y + 1);
    this.tweens.add({ targets: led, alpha: 0.15, yoyo: true, repeat: -1, duration: 300 });
    this.add.text(x, y + 22, "ARMED", { fontFamily: FONT, fontSize: "9px", color: "#fca5a5", fontStyle: "bold" }).setOrigin(0.5).setDepth(y + 1);
  }

  private async takeRikCrystal(objs: Phaser.GameObjects.GameObject[]) {
    G.s.flags.rik_crystal_taken = true;
    synth.play("splat");
    this.shake(300, 0.01);
    objs.forEach((o) => o.destroy());
    this.floatText(this.player.x, this.player.y - 50, "*SHLOOORP*", "#fda4af", 18);
    await this.talk([
      dir("You get both hands round the cum crystal and pull. The colon pulls back. You pull harder. With a noise you will hear for the rest of your life, it comes free."),
      say("UNCLE RIK", "(from somewhere above, booming) OI. WHO'S IN THERE. I FELT THAT."),
      say(sanRadio(), "(radio) Yee. Now the bombs. Four of 'em. The red circles. Leave him a present."),
      dir("NEW OBJECTIVE: plant all four bombs (the red circles)."),
    ]);
  }

  /** The bombs are in. Out you go, back to full size… and then Uncle Rik's tummy. */
  private async colonFinale() {
    const s = G.s;
    this.busy = true;
    for (const e of [...this.enemies]) if (!e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
    for (const sh of [...this.shots]) this.killShot(sh);
    await this.talk([
      say(sanRadio(), "(radio) That's all four. LEG IT. Back the way you came. The Genie's reversing the shrink ray."),
      dir("You run. Past the poo. Past the gerbils. Past a tumour, who shouts something about being cancerous as you go by. Then the shrink ray finds you, and the world goes white."),
    ]);
    const cam = this.cameras.main;
    cam.flash(500, 255, 255, 255);
    synth.play("lob");
    await new Promise<void>((r) => this.time.delayedCall(600, () => r()));
    // outside: Catford, full size, Uncle Rik having a sit-down
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const bg = this.add.rectangle(cx, cy, 4000, 4000, 0x0b1a2a).setDepth(1500);
    // the Giant Hot Tub itself (the rooftop tubs backdrop, one tub centred), or a drawn one
    const tub = this.textures.exists("sm_bigtub")
      ? this.add.image(cx - 200 * 2.5, cy - 280, "sm_bigtub").setOrigin(0).setScale(2.5).setDepth(1501)
      : this.add.ellipse(cx, cy + 140, 700, 70, 0x1e293b).setDepth(1501);
    const ps = this.player.spr;
    const phd = (ps.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
    const tex = this.textures.exists("p_rik") ? "p_rik" : "boss_rik";
    const frameH = this.textures.get(tex).get(0).height;
    await this.talk([
      dir("Catford. You pop out of the shrink ray at full size, next to the Giant Hot Tub. Uncle Rik is sat on the edge of it, scratching his belly."),
      say("UNCLE RIK", "'Ello. Thought I 'eard summink. You ain't got me crystal, 'ave ya."),
      say(s.player, "Have a look in your ass."),
    ]);
    await forcedKreltality(
      this,
      { key: tex, frame: 0, x: cx + 40, y: cy, scale: 210 / frameH, flip: true, name: "UNCLE RIK" },
      { key: ps.texture.key, frame: 0, scale: ps.scaleX / phd },
      "bellybomb",
    );
    bump(s, "kreltalities");
    s.flags.krel_rik = true;
    bg.destroy();
    tub.destroy();
    cam.startFollow(this.player.spr, true, 0.12, 0.12);
    await this.talk([say("SANMIK", "that's for everything u did to me in the past!!!! When I was a child! You ruined me! I'm a broken man because of you! DIEEEE")]);
    await this.crystalGet({ bossId: "rik" } as unknown as Boss);
    if (s.chapter === 5 && !s.flags.ch5_clear) {
      s.flags.ch5_clear = true;
      s.coins += Math.round(200 * activeMods(s).questRewardMult * 2);
      s.bottles = maxBottles(s);
      G.unlockArchive("arch_godric");
      G.unlockArchive("arch_crobley");
      G.drongus("boss_defeated");
    }
    s.flags.rik_bombs_done = true;
    s.flags.sanmik_catford = true;
    for (const k of Object.keys(s.flags)) if (k.startsWith("rik_bomb_") || k === "rik_crystal_taken") delete s.flags[k];
    delete s.flags[clearKey(this.dungeon.id, 0)];
    s.coins += 150;
    s.hp = maxHp(s);
    s.phase = "hub";
    G.save();
    this.time.delayedCall(800, () => {
      this.transitioning = true;
      switchTo(this, "Vignette", { id: "sanmik_finale", returnAt: this.dungeon.returnAt });
    });
  }

  /** The Genie's shrink ray: zap, and you're four millimetres tall. */
  private async shrinkRay() {
    this.busy = true;
    const p = this.player.spr;
    await this.talk([
      say("GENIE", "(from the lamp) I can get you in there. I have a shrink ray. Don't ask why a genie has a shrink ray. I've had a long life."),
      say(sanRadio(), "Yee. Shrink 'em. Go in. Get the crystal. And while you're in there… leave him a present."),
      dir("The Genie hands you a bag. It's full of bombs. Four of them. You don't ask either."),
    ]);
    const lamp = this.add.circle(p.x - 160, p.y - 60, 10, 0xffd23f).setDepth(p.depth + 2);
    synth.play("lob");
    const beam = this.add.rectangle(lamp.x, lamp.y, 10, 14, 0x67e8f9, 0.9).setOrigin(0, 0.5).setDepth(p.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    beam.setRotation(Phaser.Math.Angle.Between(lamp.x, lamp.y, p.x, p.y));
    const len = Phaser.Math.Distance.Between(lamp.x, lamp.y, p.x, p.y);
    await new Promise<void>((r) => this.tweens.add({ targets: beam, width: len, duration: 250, onComplete: () => r() }));
    await playCine(this, "ch5_shrink");
    Juice.flash(this, 0xa0ffff, 200, 0.8);
    beam.destroy();
    lamp.destroy();
    // the shrink, the dive, the Ministry of Dignity and FIG. 7 (scenes/side/colonEntry.ts)
    await playColonEntry(this, { player: p });
    this.cameras.main.fadeOut(600, 60, 0, 20);
    await new Promise<void>((r) => this.time.delayedCall(700, () => r()));
  }

  /** SanChz, the Job Centre staff toilet, and a jam donut. */
  private async donutScene() {
    if (G.s.flags.sm_donut) {
      await this.talk([say("SANCHZ", "We don't talk about it. YEGHHH.")]);
      return;
    }
    const chz = this.bros.find((b) => b.id === "SANCHZ");
    chz?.spr.setVisible(false);
    await this.talk([
      dir("You push the door. It isn't locked. It was never locked. Some part of him wanted to be found."),
      dir("The Job Centre staff toilet has been transformed. Tealights on the cistern. Rose petals in the sink. A small speaker playing slow jams."),
      dir("And there is SanChz. And there, cradled tenderly in both of his hands, is a jam donut."),
      say("SANCHZ", "…"),
      say("SANCHZ", "Yeghhhh! You fucking CUNTS! Fuck you J.Q. ! Erotic weekend in stockport"),
      say(G.s.player, "It looks like you've got your cock in a jam donut, mate."),
      say("SANCHZ", "…It's exactly what it looks like."),
      dir("The donut moans in pleasure"),
      say("SANMIK", "(bursting in) YEEE — oh. Oh SanChz. Not again. Not in the Job Centre.", { variants: { MIKEY: "YEEE — oh. Oh SanChz. Not again. Not in the Job Centre." } }),
      say("SANCHZ", "YEGHHH. Love shagging jam donuts!!"),
      gabor("Was that allowed? I don't think that was allowed. Report me. No, report HIM. Report both of us."),
      dir("Outside, the whole Job Centre shakes. Something enormous is rolling across the car park, screaming a name."),
      say("SANMIK", "…SanChz. Whose donut is that."),
    ]);
    chz?.spr.setVisible(true);
    G.s.flags.sm_donut = true;
    this.checkExit();
  }

  private talkerVisits: Record<string, number> = {};
  private jukeIdx = 0;

  private async useTalker(p: PropDef) {
    const key = p.label ?? "";
    const n = (this.talkerVisits[key] = (this.talkerVisits[key] ?? 0) + 1);
    const lines = (p.lines ?? []).map((l) => (l.dir ? dir(l.t, { cond: l.cond, variants: l.variants }) : say(l.s, l.t, { cond: l.cond, variants: l.variants })));
    const s = G.s;
    switch (p.action) {
      case "hottub":
        await this.talk(lines.slice(0, n === 1 ? lines.length : 2));
        s.hp = maxHp(s);
        this.floatText(this.player.x, this.player.y - 50, "FULL HP (and a bit damp)", "#7fdfff", 14);
        synth.play("heal");
        return;
      case "begour_hug":
        await this.talk(n === 1 ? lines : [lines[lines.length - 1]]);
        s.hp = Math.min(maxHp(s), s.hp + 30);
        this.floatText(this.player.x, this.player.y - 50, "+30 HP (BEAR HUG)", "#86efac", 14);
        synth.play("heal");
        return;
      case "pepsi":
        if (s.coins < 5) {
          await this.talk([dir("The machine wants 5 Krezzcoin. You have less than that. The machine knows.")]);
          return;
        }
        s.coins -= 5;
        s.hp = Math.min(maxHp(s), s.hp + 15);
        await this.talk([lines[(n - 1) % lines.length]]);
        this.floatText(this.player.x, this.player.y - 50, "+15 HP", "#86efac", 14);
        synth.play("pickup");
        return;
      case "jukebox": {
        const songs = ["ggg2", "ggg13", "ggg6", "ggg12", "ggg4", "ggg9", "ggg3", "ggg10"];
        const titles: Record<string, string> = { ggg2: "Ashurst", ggg13: "In Tha Hot Tub", ggg6: "Peener Colarder", ggg12: "I Love Christmas", ggg4: "Viva Reggaeton", ggg9: "Wank Til U Spunk", ggg3: "I Don't Need Yhu", ggg10: "Fragrant Bitch" };
        const id = songs[this.jukeIdx++ % songs.length];
        synth.musicRaw(id, true);
        this.toast("♪ JUKEBOX", `SanMik & SanChz — "${titles[id]}"`);
        return;
      }
      case "donut":
        if (!this.roomCleared) {
          await this.talk([dir("ENGAGED. From inside: a soft, rhythmic creaking. And… is that Marvin Gaye?"), say("SANCHZ", "(muffled) Busy. Mork. Clear the Job Centre first.")]);
          return;
        }
        await this.donutScene();
        return;
      case "kick_gabor":
        await this.talk(n === 1 || lines.length < 2 ? lines : [lines[1 + ((n - 2) % (lines.length - 1))]]);
        if (n > 1) {
          this.floatText(this.player.x + 60, this.player.y - 60, "*BAAA* (thank you)", "#ffffff", 13);
          synth.play("hit");
        }
        return;
      default:
        await this.talk(lines);
    }
  }

  // ------------------------------------------------------------------ room flow

  private async startRoom() {
    const r = this.room;
    this.busy = true;
    // first time into this dungeon this run: the anime entry cutscene (its name slams in)
    if (!G.rt.pit && !(await dungeonIntro(this, this.dungeon))) return;
    // (practice in the Pit: no story on the way in, just the fight)
    const enter: Line[] = (G.rt.pit ? [] : r.enterLines ?? []).map((l) => ({ s: l.s, t: l.t, dir: l.dir, cond: l.cond, variants: l.variants, tag: "new" as const }));
    if (r.rule) {
      const rule = BAN_RULES.find((b) => b.id === r.rule) ?? null;
      enter.push(say("DRONGUS", rule?.decree ?? "NEW RULE.", { notify: true, sfx: "decree" }));
    }
    // Da Drongus Dungeon: a pseudo-3D look at the tower from outside on the way into some floors (citadel3d.ts)
    if (this.citadel && this.dungeon.id === "citadel") await this.citadel.arrive3d(this.roomIdx);
    // let the room fade in first: talking pauses this scene, which froze the fade-in at black for the whole conversation
    const cam = this.cameras.main;
    if (cam.fadeEffect.isRunning && !cam.fadeEffect.direction)
      await new Promise<void>((res) => {
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => res());
        this.time.delayedCall(600, () => res());
      });
    // never sit in the dark: whatever happened to the fade, the room is visible before anyone speaks
    if (cam.fadeEffect.isRunning && !cam.fadeEffect.direction) cam.fadeEffect.reset();
    if (enter.length) await this.talk(enter);
    // once per playthrough (it used to be once per browser, so a new game never saw it again)
    if (!G.s.flags.tut_dungeon && G.s.chapter === 1 && this.roomIdx === 0 && !G.rt.pit) await this.showTutorial();
    // the Pit's own rooms: the gauntlet and the test range run themselves
    if (G.rt.pit && (G.rt.pit.mode === "gauntlet" || G.rt.pit.mode === "range")) {
      this.busy = false;
      this.pitArenaStart();
      return;
    }
    if (r.pa?.length && !G.rt.pit && !G.s.flags[clearKey(this.dungeon.id, this.roomIdx)] && !(r.miniBoss && G.s.flags[this.miniBossKey()])) {
      if (this.citadel) await this.citadel.pa(r.pa);
      else await this.talk(r.pa);
    }
    if (r.theme === "mind" && this.roomIdx === 0) this.mindArrive();
    if (r.event === "anthem") await this.anthemEvent();
    if (r.event === "drongus1" && this.citadel && !G.s.flags.c7_drongus_met) {
      await this.citadel.drongusMeet(r.w / 2, r.h / 2 - 100);
      G.s.flags.c7_drongus_met = true;
      G.save();
    }
    if (r.event === "stairs") this.citadel?.stairs();
    if (r.event === "roof" && this.roof) {
      this.busy = false;
      await this.roof.start();
      return;
    }
    // the Krelford finale: THE CONCEPT OF PAEDOPHILIA runs the whole room
    if (this.dungeon.id === "krelford_finale") {
      this.busy = false;
      await new KrelfordFinale(this).start();
      return;
    }
    if (r.rule) this.setRule(BAN_RULES.find((b) => b.id === r.rule) ?? null, false);
    if (this.roomIdx === 0) G.drongus("enter_dungeon");
    this.busy = false;
    if (this.resumed) this.toast("PROGRESS SAVED", `Picking up where you left off: room ${this.roomIdx + 1} of ${this.dungeon.rooms.length}.`);
    if (!r.boss && !G.rt.pit && G.s.flags[clearKey(this.dungeon.id, this.roomIdx)]) {
      this.roomCleared = true;
      this.checkExit();
      return;
    }
    if (r.boss) {
      const rush = this.room.bossRush ?? [];
      if (this.rushIdx > 0 && rush[this.rushIdx - 1]) {
        // back from the dead mid-rush: the Crobley you died on, on its own set
        const cur = rush[this.rushIdx - 1];
        if (cur.backdrop && this.sideBg && this.textures.exists(cur.backdrop)) {
          const src = this.textures.get(cur.backdrop).getSourceImage();
          this.sideBgScale = 540 / src.height;
          this.sideBg.setTexture(cur.backdrop).setTileScale(this.sideBgScale);
        }
        this.toast(`CROBLEY ${this.rushIdx + 1} OF ${rush.length + 1}`, "Checkpoint: straight back in where you died.");
        await this.startBoss(cur.boss, cur.hp ?? 1);
      } else await this.startBoss();
      return;
    }
    if (this.spice?.begin()) {
      // the twist runs the room (e.g. SURVIVE)
    } else if (this.waves.length) this.time.delayedCall(500, () => this.nextWave());
    else if (r.triggers?.length) {
      // run and gun: enemies turn up as you push right
      if (this.roomIdx > 0 || r.triggers.length) this.toast(r.tower ? "CLIMB" : "RUN AND GUN", r.tower ? `Jump from platform to platform. ${r.goal ?? "The Squeezing Room"} is at the very top.` : "Push right. They'll come to you.");
    } else if (r.event === "anthem" || r.event === "stairs") {
      // no fighting: the red door at the end opens itself when you get there
    } else {
      this.roomCleared = true;
      this.markCleared();
      this.checkExit();
    }
  }

  private nextWave() {
    // the gauntlet's waves are its own (a wave just ended: pay up, breathe, next)
    if (G.rt.pit?.mode === "gauntlet" || G.rt.pit?.mode === "range") {
      this.pitWaveDone();
      return;
    }
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) {
      this.waveActive = false;
      this.onRoomCleared();
      return;
    }
    this.waveActive = true;
    const wave = this.waves[this.waveIdx];
    const dCount = diffFor(G.s).enemyCount;
    for (const [type, count0] of wave) {
      const count = scaleCount(count0, dCount);
      for (let i = 0; i < count; i++) {
        let x = Phaser.Math.Between(this.bounds.left + 60, this.bounds.right - 60);
        let y = Phaser.Math.Between(this.bounds.top + 60, this.bounds.centerY + 40);
        if (this.side) {
          // in front of you or behind you, on the ground (or in the air for the flying ones)
          const dir = Math.random() < 0.7 ? 1 : -1;
          x = Phaser.Math.Clamp(this.player.x + dir * Phaser.Math.Between(260, 620), this.bounds.left + 60, this.bounds.right - 60);
          y = this.isFlyer(type) ? Phaser.Math.Between(140, this.groundY - 180) : this.groundY - 50;
        }
        this.spawnPortal(x, y, () => this.spawnEnemy(type, x, y));
      }
    }
  }

  private spawnPortal(x: number, y: number, then: () => void) {
    if (hasVfx(this, "vfx_smoke")) {
      this.pendingSpawns++;
      vfx(this, "vfx_smoke", x, y + 10, { scale: 0.9, depth: 3, tint: 0xd8b4fe });
      this.time.delayedCall(320, () => {
        this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
        then();
      });
      return;
    }
    const c = this.add.circle(x, y, 4, 0xc084fc, 0.7).setDepth(3);
    this.pendingSpawns++;
    this.tweens.add({ targets: c, radius: 22, alpha: 0.2, duration: 520, onComplete: () => {
      c.destroy();
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
      then();
    } });
  }

  private onRoomCleared() {
    if (this.roomCleared) return;
    this.roomCleared = true;
    this.markCleared();
    synth.play("ding");
    this.player?.cheer(this.now(), 1300);
    for (let i = 0; i < 6; i++) this.dropPickup(this.player.x + (Math.random() - 0.5) * 140, this.player.y - 40 + (Math.random() - 0.5) * 80, "coin", 3);
    // every cleared room pays out some ammo
    if (ownedGuns().length) this.dropPickup(this.player.x + 40, this.player.y - 30, "ammo", 1.5);
    coolBanRisk(G.s, 15);
    if (G.rt.pit) {
      // a rematch's last room without a boss (none yet, but if the card changes): that's the win
      if (G.rt.pit.mode === "rematch" && this.roomIdx >= G.rt.pit.to && !this.room.boss) void this.pitFinish("win");
      else this.checkExit();
      return;
    }
    this.maybeGunCrate();
    this.checkExit();
  }

  /** Weapon crates: the first cleared room always has one until you own a gun, then about one room in three. */
  private maybeGunCrate(force = false) {
    // (no new guns out of practice: the Pit's not a crate farm)
    if (G.rt.pit) return;
    const s = G.s;
    const first = !ownedGuns(s).length;
    if (!force && !first && Math.random() > 0.33) return;
    const x = this.side ? Phaser.Math.Clamp(this.player.x + 90, 80, this.room.w - 160) : this.bounds.centerX + (Math.random() - 0.5) * 120;
    const y = this.side ? this.groundY - 26 : this.bounds.centerY + 40;
    const tex = this.textures.exists("p_gun_crate") ? "p_gun_crate" : "p_bin";
    const crate = fitTo(this.add.image(x, y, tex), 46).setDepth(14);
    const glow = this.add.circle(x, y + 10, 30, 0x67e8f9, 0.18).setDepth(13);
    this.tweens.add({ targets: glow, alpha: 0.05, scale: 1.3, yoyo: true, repeat: -1, duration: 700 });
    this.tweens.add({ targets: crate, y: y - 4, yoyo: true, repeat: -1, duration: 900, ease: "Sine.easeInOut" });
    let opened = false;
    this.toast(first ? "WEAPON CRATE" : "WEAPON CRATE", first ? "Something glowing dropped in. Walk over and press E." : "A weapons crate appeared. Press E to open it.");
    this.interactables.push({
      x,
      y,
      r: 60,
      label: "Open the weapons crate",
      enabled: () => !opened,
      use: () => {
        opened = true;
        synth.play("door");
        this.tweens.killTweensOf([crate, glow]);
        glow.destroy();
        this.tweens.add({ targets: crate, alpha: 0, scaleX: crate.scaleX * 1.4, scaleY: crate.scaleY * 0.6, duration: 260, onComplete: () => crate.destroy() });
        const r = rollCrate(s);
        // a new gun (or its ammo) is yours from this moment: save it, so it's there in the next dungeon whatever happens
        G.save();
        if (r.gun) {
          const icon = fitTo(this.add.image(x, y - 10, r.gun.tex), 44).setDepth(700);
          this.tweens.add({ targets: icon, y: y - 70, duration: 600, ease: "Back.easeOut" });
          this.tweens.add({ targets: icon, alpha: 0, delay: 1600, duration: 400, onComplete: () => icon.destroy() });
          synth.play("gunget");
          this.toast(`NEW GUN: ${r.gun.name.toUpperCase()}`, `${r.gun.blurb} Now in your hand. ${ownedGuns(s).length === 1 ? "X / GUN swaps back to the Fart Blaster (infinite ammo)." : "X / GUN cycles weapons."}`);
        } else if (r.ammoFor) {
          this.floatText(x, y - 40, `+${r.amount} ${r.ammoFor.name.toUpperCase()} AMMO`, "#67e8f9", 14);
          synth.play("pickup");
        } else {
          this.floatText(x, y - 40, "Empty. Someone's had it.", "#ffffff", 13);
          for (let i = 0; i < 4; i++) this.dropPickup(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40, "coin", 4);
        }
      },
    });
  }

  private checkExit() {
    const r = this.room;
    if (!this.roomCleared) return;
    if ((r.event === "anthem" || r.event === "stairs") && !this.exitOpen()) return;
    if (r.exitFlag && !G.s.flags[r.exitFlag]) {
      this.toast("EXIT LOCKED", r.exitHint ? r.exitHint : r.event === "valves" ? "Open all three valves." : "Restore the Reaction Network first.");
      return;
    }
    if (r.boss) return;
    this.door.setTexture("p_door");
    this.toast("ROOM CLEAR", this.room.tower ? "The door at the top is open." : this.side ? "The exit is open (far right →)." : "The exit is open (top of the room).");
  }

  private exitOpen() {
    return this.door.texture.key === "p_door";
  }

  /** Personal-quest pickups you walked past: grabbed on the way out (the dungeon can't be revisited later). */
  private sweepQuestPickups() {
    for (const pk of [...this.pickups]) {
      if (pk.kind !== "quest" || !pk.spr.active) continue;
      pk.onCollect?.();
      pk.spr.destroy();
      this.pickups.splice(this.pickups.indexOf(pk), 1);
    }
  }

  private goNextRoom() {
    this.sweepQuestPickups();
    if (this.busy) return;
    this.busy = true;
    synth.play("dooropen");
    G.save();
    if (G.rt.pit) {
      // practice: the range's door is the way out; a rematch goes room to room (no detours: those are story) to its last
      if (G.rt.pit.mode !== "rematch" || this.roomIdx + 1 > G.rt.pit.to) {
        void this.pitFinish(G.rt.pit.mode === "rematch" ? "win" : "quit");
        return;
      }
      this.cameras.main.fadeOut(250);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.transitioning = true;
        this.scene.restart({ dungeon: this.dungeon.id, room: this.roomIdx + 1 });
      });
      return;
    }
    if (this.room.then?.length) {
      // a detour through other scenes (a minigame, a car chase) before the next room
      const [first, ...rest] = this.room.then;
      const resume = { dungeon: this.dungeon.id, room: this.roomIdx + 1 };
      this.cameras.main.fadeOut(250);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.transitioning = true;
        runChain(this, [first, ...rest], resume);
      });
      return;
    }
    if (this.roomIdx + 1 >= this.dungeon.rooms.length) {
      // a hang-out with nowhere further to go: back to Krelford
      G.s.phase = "hub";
      this.cameras.main.fadeOut(250);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.transitioning = true;
        switchTo(this, "Hub", { at: this.dungeon.returnAt ?? "PUB", from: "dungeon" });
      });
      return;
    }
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.transitioning = true;
      this.scene.restart({ dungeon: this.dungeon.id, room: this.roomIdx + 1 });
    });
  }

  private cleanup() {
    this.companion?.destroy();
    this.companion = null;
    for (const b of this.bros) b.destroy();
    this.bros = [];
    this.sideLevel?.destroy();
    this.sideLevel = null;
    this.plane?.destroy();
    this.plane = null;
    this.heroSquad?.destroy();
    this.heroSquad = null;
    this.citadel?.destroy();
    this.citadel = null;
    this.roof?.destroy();
    this.roof = null;
    this.spice?.destroy();
    this.spice = null;
    this.dress = null;
    this.player?.destroy();
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    for (const sh of this.shots) sh.spr.destroy();
    this.shots = [];
    this.removeListeners();
  }

  private removeListeners() {
    for (const ev of ["prophecy", "krezz-burst", "drop-heal", "decree", "drongus-decree", "epic-phase", "conflict", "player-dodge", "player-heal", "player-special", "ui-resume", "pit-quit"]) this.events.removeAllListeners(ev);
    this.rule = null;
    G.emit("rule", null);
  }

  // ------------------------------------------------------------------ Reinhardt Crobley: the end

  /** Cartoon blood: little red bits that arc, fall and leave splats on the floor. */
  /** A drawn explosion (PixelLab VFX), with smoke after; false if the art isn't loaded. */
  boomFx(x: number, y: number, size = 1, depth = 965): boolean {
    const big = size >= 1.3 && hasVfx(this, "vfx_bigboom");
    const s = vfx(this, big ? "vfx_bigboom" : "vfx_boom", x, y, { scale: big ? size : size * 1.2, depth });
    if (!s) return false;
    vfx(this, "vfx_smoke", x + (Math.random() - 0.5) * 20, y - 10 * size, { scale: size, depth: depth - 1, delay: 380 });
    return true;
  }

  private gore(x: number, y: number, n: number, power = 1, upward = false) {
    // gore off: no blood at all (Reinhardt's and Captain Stanley's deaths call this directly)
    if (G.meta?.settings?.gore === false) return;
    const floor = this.side ? this.groundY : this.bounds.bottom;
    if (hasVfx(this, "vfx_blood")) {
      // drawn blood: a burst (or a gush upwards), meat if it's a lot, a pool where it lands
      const k = Math.min(2.4, 0.6 + n / 40) * Math.max(0.8, power * 0.8);
      vfx(this, upward && hasVfx(this, "vfx_bloodspray") ? "vfx_bloodspray" : "vfx_blood", x, y, { scale: k, depth: 960, flipX: Math.random() < 0.5 });
      if (n >= 30) vfx(this, "vfx_gore", x, y, { scale: k * 0.8, depth: 961, delay: 60 });
      const pool = vfx(this, "vfx_bloodpool", x + (Math.random() - 0.5) * 20, floor - 1, { scale: Math.min(1.8, 0.6 + n / 50), depth: 6, hold: true, delay: 250 });
      if (pool) this.tweens.add({ targets: pool, alpha: 0, delay: 9000, duration: 3000, onComplete: () => pool.destroy() });
      return;
    }
    for (let i = 0; i < n; i++) {
      const sz = 2 + Math.random() * 5;
      const r = this.add.rectangle(x, y, sz, sz, Math.random() < 0.7 ? 0xdc2626 : 0x7f1d1d).setDepth(960);
      let vx = (Math.random() - 0.5) * 9 * power;
      let vy = upward ? -(6 + Math.random() * 9) * power : (Math.random() - 0.8) * 9 * power;
      const ev = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          vy += 0.45;
          r.x += vx;
          r.y += vy;
          vx *= 0.99;
          if (r.y >= floor - 2) {
            ev.remove();
            const splat = this.add.ellipse(r.x, floor - 1, 6 + Math.random() * 14, 3 + Math.random() * 3, 0xb91c1c, 0.9).setDepth(6);
            this.tweens.add({ targets: splat, alpha: 0.5, delay: 6000, duration: 4000 });
            r.destroy();
          }
        },
      });
      this.time.delayedCall(4000, () => {
        ev.remove();
        if (r.active) r.destroy();
      });
    }
  }

  /** Kreddle EXTRA VIOLENCE: blood that sprays out and lands (top-down rooms use this, side rooms use gore). */
  private splatter(x: number, y: number, n: number, power = 1) {
    if (this.side) {
      this.gore(x, y, n, power);
      return;
    }
    if (hasVfx(this, "vfx_blood")) {
      vfx(this, "vfx_blood", x, y, { scale: Math.min(2, 0.5 + n / 30) * power, depth: 960, flipX: Math.random() < 0.5 });
      const pool = vfx(this, "vfx_bloodpool", x + (Math.random() - 0.5) * 16, y + 8, { scale: Math.min(1.5, 0.4 + n / 40), depth: 6, hold: true, delay: 200 });
      if (pool) this.tweens.add({ targets: pool, alpha: 0, delay: 8000, duration: 3000, onComplete: () => pool.destroy() });
      return;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (12 + Math.random() * 46) * power;
      const sz = 2 + Math.random() * 4;
      const r = this.add.rectangle(x, y, sz, sz, Math.random() < 0.7 ? 0xdc2626 : 0x7f1d1d).setDepth(960);
      this.tweens.add({
        targets: r,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.7,
        duration: 180 + Math.random() * 160,
        ease: "Quad.out",
        onComplete: () => {
          const sp = this.add.ellipse(r.x, r.y, 4 + Math.random() * 10, 3 + Math.random() * 5, 0x991b1b, 0.85).setDepth(6);
          this.tweens.add({ targets: sp, alpha: 0, delay: 8000, duration: 3000, onComplete: () => sp.destroy() });
          r.destroy();
        },
      });
    }
  }

  /** Kreddle EXTRA VIOLENCE: the enemy comes apart in four pieces. */
  private dismember(e: Enemy) {
    const key = e.texture.key;
    const fr = e.frame;
    const w = fr.width;
    const h = fr.height;
    const floor = this.side ? this.groundY - 8 : null;
    for (let cx = 0; cx < 2; cx++)
      for (let cy = 0; cy < 2; cy++) {
        const piece = this.add.image(e.x, e.y, key, fr.name).setScale(e.scaleX, e.scaleY).setFlipX(e.flipX).setDepth(e.depth + 1).setCrop((w / 2) * cx, (h / 2) * cy, w / 2, h / 2).setTint(0xffb4b4);
        const a = Math.atan2(cy - 0.5, cx - 0.5) + (Math.random() - 0.5) * 0.8;
        const d = 40 + Math.random() * 60;
        this.tweens.add({ targets: piece, x: e.x + Math.cos(a) * d, y: floor ?? e.y + Math.sin(a) * d * 0.7, angle: (Math.random() - 0.5) * 540, duration: 420, ease: "Quad.out" });
        this.tweens.add({ targets: piece, alpha: 0, delay: 2500, duration: 900, onComplete: () => piece.destroy() });
      }
    vfx(this, "vfx_gore", e.x, e.y, { scale: 1.1, depth: e.depth + 2 });
    this.splatter(e.x, e.y, 22, 1.4);
  }

  private screenSplat(n = 4) {
    if (G.meta?.settings?.gore === false) return;
    if (hasVfx(this, "vfx_blood")) {
      // blood on the lens
      for (let i = 0; i < n; i++) vfx(this, "vfx_blood", 80 + Math.random() * 800, 60 + Math.random() * 300, { scale: 2.5 + Math.random() * 2, fixed: true, depth: 990, delay: i * 70, flipX: Math.random() < 0.5 });
      return;
    }
    for (let i = 0; i < n; i++) {
      const sp = this.add.circle(80 + Math.random() * 800, 60 + Math.random() * 300, 30 + Math.random() * 60, 0xb91c1c, 0.75).setScrollFactor(0).setDepth(990);
      this.tweens.add({ targets: sp, y: sp.y + 140, scaleY: 1.6, alpha: 0, delay: 700, duration: 2200, onComplete: () => sp.destroy() });
    }
  }

  // ------------------------------------------------------------------ THE KRUNCH PIT (practice: systems/pit.ts)

  private pitFinishing = false;
  private pitHud: Phaser.GameObjects.Text | null = null;
  /** Test range: [time, damage] of recent hits on the dummies, the biggest single hit, and the total. */
  private rangeHits: [number, number][] = [];
  private rangeBiggest = 0;
  private rangeTotal = 0;

  /** How much tougher the Pit makes what spawns (null: not in the Pit, or nothing to change). */
  private pitEnemyScale(): { hp: number; dmg: number; speed: number; aggression: number } | null {
    const pit = G.rt.pit;
    if (!pit) return null;
    if (pit.mode === "rematch") return pit.heat > 1 ? heatScale(pit.heat) : null;
    const g = gauntletScale(pit.mode === "gauntlet" ? Math.max(1, pit.wave) : pit.rangeLevel);
    return { hp: g.hp, dmg: g.dmg, speed: g.speed, aggression: g.aggression };
  }

  /** Kill drops in the Pit: cut (wave pay is the gauntlet's income), none at all at the range. */
  private pitCoinMult(): number {
    const m = G.rt.pit?.mode;
    return m === "gauntlet" ? GAUNTLET_KILL_COIN_MULT : m === "rematch" ? REMATCH_KILL_COIN_MULT : m === "range" ? 0 : 1;
  }

  /** The gauntlet or the range, from the top. */
  private pitArenaStart() {
    const pit = G.rt.pit!;
    if (pit.mode === "range") {
      this.rangeSetup();
      return;
    }
    const best = pitRecord(G.s).bestWave;
    this.toast("ENDLESS GAUNTLET", `${best ? `Your best: wave ${best}. ` : ""}Every 5th wave is a boss. Pause menu → LEAVE to walk out with what you've made.`);
    this.bigText("THE KRUNCH PIT", "#ef4444", 52, 170);
    synth.play("roar");
    this.time.delayedCall(1700, () => this.gauntletSpawn());
  }

  /** The next gauntlet wave (or its boss). */
  private gauntletSpawn() {
    const pit = G.rt.pit;
    if (!pit || pit.mode !== "gauntlet" || this.dying || this.pitFinishing) return;
    pit.wave++;
    const n = pit.wave;
    const sc = gauntletScale(n);
    if (this.spice) this.spice.eliteOverride = sc.elite;
    const boss = gauntletBossFor(n, beatenBosses(G.s));
    this.bigText(boss ? `WAVE ${n}: BOSS` : `WAVE ${n}`, boss ? "#ef4444" : "#fde047", boss ? 46 : 40);
    synth.play(boss ? "decree" : "ding");
    this.waveActive = true;
    if (boss) {
      const esc = bossEscorts(n);
      if (esc) this.pitSpawnWave(gauntletWave(n, gauntletPool(G.s)).slice(0, 2).map(([t]) => [t, Math.ceil(esc / 2)] as [string, number]));
      void this.startBoss(boss, bossWaveHp(n), { x: this.room.w / 2, y: this.room.h / 2 - 110 });
      return;
    }
    // (no boss beaten that fits the ring yet: a bigger wave instead)
    const comp = gauntletWave(n, gauntletPool(G.s));
    if (isBossWave(n)) for (const c of comp) c[1] = Math.ceil(c[1] * 1.5);
    this.pitSpawnWave(comp);
  }

  /** Spawn a line-up anywhere in the room, never right on top of you. */
  private pitSpawnWave(comp: [string, number][], opts: { noDrops?: boolean } = {}) {
    const b = this.bounds;
    for (const [type, count] of comp) {
      for (let i = 0; i < count; i++) {
        let x = 0;
        let y = 0;
        for (let t = 0; t < 12; t++) {
          x = Phaser.Math.Between(b.left + 60, b.right - 60);
          y = Phaser.Math.Between(b.top + 70, b.bottom - 60);
          if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 240) break;
        }
        this.spawnPortal(x, y, () => {
          if (this.pitFinishing) return;
          const e = this.spawnEnemy(type, x, y, opts);
          if (e && G.rt.pit?.mode === "range") e.noDrops = true;
        });
      }
    }
  }

  /** A wave's down: the gauntlet pays, takes a breath, maybe drops something, and goes again. */
  private pitWaveDone() {
    const pit = G.rt.pit;
    if (!pit || this.dying || this.pitFinishing) return;
    if (pit.mode === "range") {
      this.toast("WAVE DOWN", "Ring the bell for another. The loaner rack's on the left.");
      return;
    }
    const n = pit.wave;
    pit.cleared = n;
    const s = G.s;
    const pay = wavePay(n, diffFor(s).rewards);
    s.coins += pay.coins;
    if (pay.krokens) addKrokens(s, pay.krokens);
    synth.play("coin");
    this.bigText(`WAVE ${n} DOWN  +${pay.coins}🪙${pay.krokens ? `  +${pay.krokens} KROKENS` : ""}`, pay.milestone ? "#facc15" : "#86efac", pay.milestone ? 34 : 28, 150);
    if (pay.milestone) {
      synth.play("perfect");
      this.toast(`MILESTONE: WAVE ${n}`, `Bonus paid. It only gets nastier from here (wave ${n + 1}: ${Math.round(gauntletScale(n + 1).hp * 100)}% HP, ${Math.round(gauntletScale(n + 1).dmg * 100)}% damage).`);
    }
    // the breather: a chance of juice and ammo (always after a boss)
    const cx = this.room.w / 2;
    const cy = this.room.h / 2 + 30;
    const afterBoss = isBossWave(n);
    if (afterBoss || Math.random() < 0.45) this.dropPickup(cx - 40, cy, "heal", afterBoss ? 40 : 20);
    if (ownedGuns().length && (afterBoss || Math.random() < 0.6)) this.dropPickup(cx + 40, cy, "ammo", afterBoss ? 2 : 1);
    if (afterBoss && Math.random() < 0.5) this.dropPickup(cx, cy + 40, "bottle", 1);
    G.save();
    const secs = breatherSec(n);
    const t = this.add.text(480, 210, "", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(994);
    for (let i = 0; i < secs; i++) this.time.delayedCall(800 + i * 1000, () => t.active && t.setText(`NEXT WAVE IN ${secs - i}…`));
    this.time.delayedCall(800 + secs * 1000, () => {
      t.destroy();
      this.gauntletSpawn();
    });
  }

  /** A gauntlet boss goes down: no speeches, no cutscene, on with the wave. */
  private pitBossDown(b: Boss) {
    G.emit("boss", null);
    synth.play("boom");
    this.boomFx(b.x, b.y, 1.4);
    this.shake(500, 0.02);
    this.bigText(`${BOSS_TEXT[b.bossId]?.name ?? "THE BOSS"}: DOWN`, "#facc15", 34, 190);
    this.boss = null;
    if (this.fightMusicOn) {
      synth.music(this.roomMusicId, true);
      this.fightMusicOn = false;
    }
  }

  /** A rematch's last boss is beaten: the big finish, a Kreltality if you like, then the results. */
  private async rematchBossWin(b: Boss) {
    G.emit("boss", null);
    synth.play("boom");
    this.boomFx(b.x, b.y, 1.6);
    this.shake(700, 0.03);
    for (const e of [...this.enemies]) if (e !== b && !e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
    for (const sh of [...this.shots]) this.killShot(sh);
    this.rule = null;
    G.emit("rule", null);
    G.rt.timerEnd = 0;
    G.emit("timer", null);
    if (b.bossId === "rik") b.setVisible(false);
    else if (b.bossId === "reinhardt" || b.bossId === "krozno") {
      if (await this.offerKreltality(b)) b.setVisible(false);
      else await this.bossFall();
    } else await this.maybeKreltality(b);
    this.boss = null;
    await this.pitFinish("win");
  }

  /**
   * The practice run's over (won, died, walked out): pay what it pays, record it, put the run back as it was
   * (G.pitEnd: settlePractice) and go back to the Pit for the card.
   */
  private async pitFinish(outcome: PitResult["outcome"], cause?: string) {
    const pit = G.rt.pit;
    if (!pit || this.pitFinishing) return;
    this.pitFinishing = true;
    this.busy = true;
    const s = G.s;
    const result: PitResult = { mode: pit.mode, outcome, earned: { coins: 0, krokens: 0 }, cause };
    if (pit.mode === "gauntlet") {
      result.waves = pit.cleared;
      result.newBest = recordGauntlet(pitRecord(s), pit.cleared, s.coins - pit.snap.coins);
    } else if (pit.mode === "rematch" && pit.rematch) {
      result.rematch = pit.rematch;
      result.heat = pit.heat;
      const def = REMATCH_BY_ID[pit.rematch];
      if (outcome === "win" && def) {
        const pay = rematchPay(def, pit.heat, diffFor(s).rewards);
        s.coins += pay.coins;
        if (pay.krokens) addKrokens(s, pay.krokens);
        result.newBest = recordRematch(pitRecord(s), def.id, pit.heat, s.coins - pit.snap.coins);
      } else pitRecord(s).earned += Math.max(0, s.coins - pit.snap.coins);
    }
    if (outcome === "win") {
      synth.play("perfect");
      this.bigText(pit.mode === "rematch" ? "REMATCH WON" : "DONE", "#facc15", 50, 200);
    }
    await new Promise<void>((r) => this.time.delayedCall(outcome === "win" ? 1400 : 200, () => r()));
    // the room stops here (nothing picked up after the books are closed), then the run goes back as it was
    this.transitioning = true;
    result.earned = G.pitEnd();
    this.cameras.main.fadeOut(350);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Pit", { result }));
  }

  /** Every frame in the Pit: the HUD line, and the range's free ammo and krezz. */
  private pitTick(now: number) {
    const pit = G.rt.pit;
    if (!pit) return;
    const s = G.s;
    if (pit.mode === "range") {
      for (const id of Object.keys(s.guns ?? {})) if (GUNS[id]) s.guns![id] = gunMax(GUNS[id], s);
      s.krezz = maxKrezz(s);
      this.rangeHits = this.rangeHits.filter(([t]) => now - t < 5000);
      const dmg = this.rangeHits.reduce((a, [, d]) => a + d, 0);
      const span = this.rangeHits.length ? Math.max(1000, now - this.rangeHits[0][0]) : 1000;
      const dps = this.rangeHits.length ? Math.round((dmg * 1000) / span) : 0;
      this.pitHud?.setText(`TEST RANGE · DPS ${dps} · BIGGEST HIT ${Math.round(this.rangeBiggest)} · TOTAL ${Math.round(this.rangeTotal)}\nINFINITE AMMO · NO REWARDS · NO DEATH · wave level ${pit.rangeLevel}`);
      return;
    }
    const earned = s.coins - pit.snap.coins;
    const k = ((s.flags.krokens as number) ?? 0) - ((pit.snap.flags.krokens as number) ?? 0);
    if (pit.mode === "gauntlet") this.pitHud?.setText(`WAVE ${Math.max(1, pit.wave)} · BEST ${pitRecord(s).bestWave} · +${earned} 🪙${k ? ` · +${k} KROKENS` : ""}`);
    else if (pit.rematch) {
      const def = REMATCH_BY_ID[pit.rematch];
      const pay = def ? rematchPay(def, pit.heat, diffFor(s).rewards).coins : 0;
      this.pitHud?.setText(`REMATCH · HEAT ×${pit.heat} · +${earned} 🪙 so far · +${pay} 🪙 for the win`);
    }
  }

  // ---- the test range

  private rangeSetup() {
    const r = this.room;
    if (this.spice) this.spice.eliteOverride = 0;
    this.toast("TEST RANGE", "Infinite ammo, no rewards, nobody dies. Loaner rack on the left, the bell on the right. Out through the door at the top.");
    for (const [fx, fy] of [[0.3, 0.3], [0.5, 0.26], [0.7, 0.3]]) this.spawnDummy(r.w * fx, r.h * fy);
    // the loaner rack: borrow anything (it all goes back when you leave)
    const rack = this.add.image(150, r.h * 0.5, this.textures.exists("p_gun_crate") ? "p_gun_crate" : "p_bin");
    fitTo(rack, 60).setDepth(r.h * 0.5);
    this.add.text(150, r.h * 0.5 - 50, "LOANER RACK", { fontFamily: FONT, fontSize: "12px", color: "#67e8f9", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(1500);
    this.interactables.push({ x: 150, y: r.h * 0.5, r: 80, label: "Loaner rack: try any gun or perk", use: () => this.openLoaners() });
    // the bell: a wave on demand, at the level you set
    const bx = r.w - 150;
    const bell = this.add.text(bx, r.h * 0.5, "🔔", { fontSize: "44px" }).setOrigin(0.5).setDepth(r.h * 0.5);
    this.add.text(bx, r.h * 0.5 - 50, "THE BELL", { fontFamily: FONT, fontSize: "12px", color: "#fde047", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(1500);
    this.interactables.push({
      x: bx,
      y: r.h * 0.5,
      r: 80,
      label: "Ring the bell: spawn a wave",
      use: () => {
        const pit = G.rt.pit;
        if (!pit) return;
        this.tweens.add({ targets: bell, angle: { from: -25, to: 25 }, yoyo: true, repeat: 3, duration: 80, onComplete: () => bell.setAngle(0) });
        synth.play("ding");
        this.bigText(`WAVE (LEVEL ${pit.rangeLevel})`, "#fde047", 34);
        this.waveActive = true;
        this.pitSpawnWave(gauntletWave(pit.rangeLevel, gauntletPool(G.s)), { noDrops: true });
      },
    });
    const lx = r.w - 150;
    const ly = r.h * 0.72;
    const lvl = this.add.text(lx, ly, "", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffffff", backgroundColor: "#7f1d1dcc", padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(1500);
    const showLvl = () => lvl.setText(`WAVE LEVEL ${G.rt.pit?.rangeLevel ?? 1}`);
    showLvl();
    this.interactables.push({
      x: lx,
      y: ly,
      r: 70,
      label: "Change the wave level (1 / 5 / 10 / 15 / 20)",
      use: () => {
        const pit = G.rt.pit;
        if (!pit) return;
        const steps = [1, 5, 10, 15, 20];
        pit.rangeLevel = steps[(steps.indexOf(pit.rangeLevel) + 1) % steps.length];
        synth.play("select");
        showLvl();
      },
    });
    this.interactables.push({
      x: 150,
      y: r.h * 0.72,
      r: 70,
      label: "Clear the range (kill everything but the dummies)",
      use: () => {
        for (const e of [...this.enemies]) if (!e.dead && !(e as Enemy & { dummy?: boolean }).dummy) this.damageEnemy(e, 999999, { noWonk: true, label: "" });
        synth.play("boom");
      },
    });
    this.add.text(150, r.h * 0.72, "CLEAR", { fontFamily: "Impact, sans-serif", fontSize: "18px", color: "#ffffff", backgroundColor: "#1e3a8acc", padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(1500);
    // the way out
    this.roomCleared = true;
    this.door.setTexture("p_door");
  }

  /** A dummy: never moves, never hits back, never dies, and counts every hit. */
  private spawnDummy(x: number, y: number) {
    const e = this.spawnEnemy("gym_bro", x, y, { noDrops: true, minion: true });
    if (!e) return;
    (e as Enemy & { dummy?: boolean }).dummy = true;
    e.maxHp = 1e9;
    e.hp = e.maxHp;
    e.setTint(0xd6b98c);
    (e.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    e.hpBar?.setVisible(false);
    this.add.text(x, y + 40, "DUMMY", { fontFamily: FONT, fontSize: "10px", color: "#fde68a", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(1500);
  }

  private rangeHit(a: number) {
    if (a <= 0) return;
    this.rangeHits.push([this.now(), a]);
    this.rangeBiggest = Math.max(this.rangeBiggest, a);
    this.rangeTotal += a;
  }

  /** The loaner rack (PitLoanScene, over the range). */
  private openLoaners() {
    if (this.busy) return;
    this.paused = true;
    this.scene.launch("PitLoan", { caller: "Dungeon" });
    this.scene.pause();
  }

  private bigText(t: string, color: string, size = 46, y = 150) {
    const tx = this.add.text(480, y, t, { fontFamily: "Impact, sans-serif", fontSize: `${size}px`, color, stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setScrollFactor(0).setDepth(995).setScale(0.2);
    this.tweens.add({ targets: tx, scale: 1, duration: 220, ease: "Back.out" });
    this.tweens.add({ targets: tx, alpha: 0, delay: 1400, duration: 400, onComplete: () => tx.destroy() });
  }

  /** An entirely unnecessary, deeply cartoonish death. */
  /** Captain Stanley, on his knees. Press S. */
  /** (Retired: Captain Stanley now gets an ordinary Kreltality.) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async slitThroat(b: Boss) {
    const x = b.x;
    const y = b.y;
    const key = b.texture.key;
    const sc = b.scaleX / (((b.texture.customData as { hd?: number } | undefined)?.hd) ?? 1);
    this.tweens.killTweensOf(b);
    b.setVisible(false);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x, y, 400, "Sine.easeInOut");
    cam.zoomTo(1.4, 400);
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
    const body = this.add.image(x, y, key, 0).setScale(sc).setDepth(955).setFlipX(b.flipX);
    await wait(450);
    // the prompt: S (or tap)
    const head = this.add.text(480, 95, "PRESS S TO SLIT HIS THROAT", { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#ef4444", stroke: "#000", strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    const btn = this.add.text(480, 150, "🔪  S", { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffffff", backgroundColor: "#7f1d1d", padding: { x: 20, y: 8 } }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: [head, btn], scale: { from: 1, to: 1.08 }, yoyo: true, repeat: -1, duration: 380 });
    await new Promise<void>((res) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        this.input.keyboard?.off("keydown-S", go);
        res();
      };
      this.input.keyboard?.on("keydown-S", go);
      btn.on("pointerdown", go);
    });
    this.tweens.killTweensOf([head, btn]);
    head.destroy();
    btn.destroy();
    // the slash
    const fh = body.frame.height * sc;
    const fw = body.frame.width * sc;
    const neckY = y - fh * 0.12;
    synth.play("swing");
    const slash = this.add.graphics().setDepth(960);
    const p = { t: 0 };
    await new Promise<void>((res) =>
      this.tweens.add({
        targets: p,
        t: 1,
        duration: 140,
        onUpdate: () => slash.clear().lineStyle(5, 0xffffff, 1).lineBetween(x - fw * 0.35, neckY - 6, x - fw * 0.35 + fw * 0.7 * p.t, neckY + 6),
        onComplete: () => res(),
      }),
    );
    synth.play("crit");
    cam.flash(150, 160, 0, 0);
    cam.shake(250, 0.015);
    this.tweens.add({ targets: slash, alpha: 0, duration: 400, onComplete: () => slash.destroy() });
    const spray = this.time.addEvent({ delay: 50, repeat: 14, callback: () => this.gore(x, neckY, 4, 0.7) });
    this.screenSplat(2);
    body.setTint(0xffb0b0);
    // the close-up (KrelCinema.ts), then back to him going down
    await krelCinema(this, { which: "stanley", title: G.meta?.settings?.gore !== false ? "THROAT SLIT!" : "GROUNDED!", victim: "CAPTAIN STANLEY" });
    await wait(700);
    // and down he goes, still saluting
    this.tweens.add({ targets: body, angle: b.flipX ? -84 : 84, y: y + fh * 0.3, duration: 700, ease: "Quad.in" });
    await wait(900);
    synth.play("punch_big");
    cam.shake(200, 0.01);
    spray.remove();
    await wait(500);
    cam.zoomTo(1, 500);
    cam.startFollow(this.player.spr, true, 0.12, 0.12);
    await wait(500);
  }

  private async reinhardtDeath(b: Boss) {
    const x = b.x;
    const y = b.y;
    const key = b.texture.key;
    // textures carry an "hd" factor that setScale multiplies in, so undo it for the stand-ins
    const sc = b.scaleX / (((b.texture.customData as { hd?: number } | undefined)?.hd) ?? 1);
    this.tweens.killTweensOf(b);
    b.setVisible(false);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x, y, 400, "Sine.easeInOut");
    cam.zoomTo(1.5, 400);
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
    const body = this.add.image(x, y, key, 0).setScale(sc).setDepth(955).setFlipX(b.flipX);
    await wait(450);
    // he takes every bullet he ever fired, all at once
    this.bigText("OVERKILL", "#ef4444");
    for (let i = 0; i < 12; i++) {
      this.time.delayedCall(i * 70, () => {
        synth.play(i % 3 ? "hit" : "crit");
        body.setAngle((Math.random() - 0.5) * 20).setX(x + (Math.random() - 0.5) * 16);
        this.gore(x + (Math.random() - 0.5) * 40, y - 10 + (Math.random() - 0.5) * 60, 8, 1);
        cam.shake(60, 0.01);
      });
    }
    await wait(950);
    // gore off: no decapitation, no chunks. He's flattened, sees stars, and the giant Crobley still finishes him.
    if (this.isGoreOff()) {
      synth.play("explode");
      this.bigText("KNOCKOUT", "#fde047", 40, 200);
      this.tweens.add({ targets: body, angle: b.flipX ? -90 : 90, y: (this.side ? this.groundY : y + 80) - 20, duration: 500, ease: "Bounce.out" });
      vfx(this, "vfx_stars", x, y - 50, { scale: 1.6, depth: 960 });
      await wait(900);
      await this.talk([say("REINHARDT CROBLEY", "(the head, on the floor) heh… heh… heh… you'll never… prove… I…")]);
      const g2 = this.add.image(body.x, -200 + cam.worldView.y, this.textures.exists("p_crobley") ? "p_crobley" : "p_coin").setScale(9).setDepth(961);
      await new Promise<void>((r) => this.tweens.add({ targets: g2, y: body.y - 30, duration: 500, ease: "Quad.in", onComplete: () => r() }));
      synth.play("smash");
      synth.play("explode");
      cam.shake(500, 0.04);
      this.boomFx(body.x, body.y, 1.4);
      body.destroy();
      this.bigText("CROBLITERATED", "#f472b6", 50, 220);
      await wait(700);
      return this.reinhardtDeathEnd(g2, cam);
    }
    // the head comes off
    const fw = body.frame.width;
    const fh = body.frame.height;
    const head = this.add.image(x, y, key, 0).setScale(sc).setDepth(958).setFlipX(b.flipX).setCrop(0, 0, fw, fh * 0.32);
    body.setCrop(0, fh * 0.32, fw, fh * 0.68);
    synth.play("explode");
    this.screenSplat(5);
    this.bigText("HEADSHOT", "#fde047", 40, 200);
    this.tweens.add({ targets: head, y: y - 260, x: x + 140, angle: 720, duration: 900, ease: "Quad.out", yoyo: false });
    // neck fountain
    const neck = { x, y: y - (fh * sc) * 0.18 };
    const fountain = this.time.addEvent({ delay: 45, loop: true, callback: () => this.gore(neck.x, neck.y, 5, 0.8, true) });
    this.tweens.add({ targets: body, angle: { from: -6, to: 6 }, yoyo: true, repeat: 6, duration: 110 });
    await wait(1300);
    // the body bursts into chunks
    fountain.remove();
    synth.play("explode");
    synth.play("boom");
    this.boomFx(x, y, 1.8);
    this.screenSplat(7);
    this.bigText("CROBLITERATED", "#f472b6", 50, 220);
    cam.flash(250, 200, 0, 0);
    cam.shake(400, 0.03);
    body.destroy();
    const cols = 3;
    const rows = 3;
    for (let cx = 0; cx < cols; cx++)
      for (let cy = 0; cy < rows; cy++) {
        const chunk = this.add.image(x, y, key, 0).setScale(sc).setDepth(957).setFlipX(b.flipX).setCrop((fw / cols) * cx, fh * 0.32 + ((fh * 0.68) / rows) * cy, fw / cols, (fh * 0.68) / rows);
        const tx = x + (cx - 1) * (120 + Math.random() * 160);
        this.tweens.add({ targets: chunk, x: tx, y: (this.side ? this.groundY : y + 80) - 20, angle: (Math.random() - 0.5) * 900, duration: 700 + Math.random() * 300, ease: "Quad.in" });
      }
    this.gore(x, y, 120, 1.8);
    // a single sausage rolls out of the wreckage
    const sausage = this.add.text(x, y, "🌭", { fontSize: "34px" }).setOrigin(0.5).setDepth(959);
    this.tweens.add({ targets: sausage, x: x - 220, angle: -720, y: (this.side ? this.groundY : y + 80) - 18, duration: 1400, ease: "Quad.out" });
    await wait(900);
    // the head lands. it has one last thing to say
    this.tweens.killTweensOf(head);
    head.setPosition(x + 180, (this.side ? this.groundY : y + 80) - 30).setAngle(-90);
    await this.talk([say("REINHARDT CROBLEY", "(the head, on the floor) heh… heh… heh… you'll never… prove… I…")]);
    // a giant fibreglass Crobley falls from the ceiling. directly onto it.
    const giant = this.add.image(head.x, -200 + cam.worldView.y, this.textures.exists("p_crobley") ? "p_crobley" : "p_coin").setScale(9).setDepth(961);
    await new Promise<void>((r) => this.tweens.add({ targets: giant, y: head.y - 30, duration: 500, ease: "Quad.in", onComplete: () => r() }));
    synth.play("smash");
    synth.play("explode");
    cam.shake(500, 0.04);
    this.screenSplat(10);
    this.gore(head.x, head.y, 80, 2);
    head.destroy();
    this.bigText("FLAWLESS NIBBLE", "#ffd23f", 48, 180);
    await this.reinhardtDeathEnd(giant, cam);
  }

  private isGoreOff() {
    return G.meta.settings.gore === false;
  }

  /** Both versions of Reinhardt's death end the same way: the giant fades, the camera comes back to you. */
  private async reinhardtDeathEnd(giant: Phaser.GameObjects.Image, cam: Phaser.Cameras.Scene2D.Camera) {
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
    await wait(1500);
    this.tweens.add({ targets: giant, alpha: 0, duration: 800 });
    cam.zoomTo(1, 500);
    cam.startFollow(this.player.spr, true, 0.12, 0.12);
    await wait(600);
  }

  /** The central fuel tank: shoot it, and everything ends. */
  private fuelTankFinale() {
    return new Promise<void>((resolve) => {
      const r = this.room;
      const x = r.w / 2;
      const y = this.side ? this.groundY - 70 : r.h / 2;
      const tex = this.textures.exists("p_fueltank") ? "p_fueltank" : undefined;
      const tank = new Enemy(this, "fuel_tank", x, y, 1, undefined, tex);
      if (tex) tank.setScale(2.6);
      (tank.body as Phaser.Physics.Arcade.Body).setImmovable(true);
      tank.hpBar = this.add.graphics().setDepth(800);
      this.enemies.push(tank);
      this.enemyGroup.add(tank);
      (tank.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.tweens.add({ targets: tank, scaleX: tank.scaleX * 1.04, yoyo: true, repeat: -1, duration: 300 });
      const label = this.add.text(x, y - 110, "▼ SHOOT IT ▼", { fontFamily: "Impact, sans-serif", fontSize: "22px", color: "#facc15", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(900);
      this.tweens.add({ targets: label, y: label.y - 10, yoyo: true, repeat: -1, duration: 400 });
      this.talk([
        dir("Reinhardt Crobley is everywhere and nowhere. Mostly everywhere. In the middle of the Core, the central fuel tank hums."),
        dir("SHOOT THE FUEL TANK to destroy this entire forsaken fucking place, and ensure that even if Reinhardt comes back to life he will never be able to spread right-wing propaganda ever again!"),
      ]).then(() => {
        this.busy = false;
        this.toast("THE CENTRAL FUEL TANK", "Shoot it. Destroy this entire forsaken fucking place.");
      });
      this.events.once("fuel-tank-dead", async (tx: number, ty: number) => {
        this.busy = true;
        label.destroy();
        for (let i = 0; i < 14; i++)
          this.time.delayedCall(i * 120, () => {
            synth.play("explode");
            const ex = tx + (Math.random() - 0.5) * 300;
            const ey = ty + (Math.random() - 0.5) * 200;
            if (!this.boomFx(ex, ey, 1.4 + Math.random() * 0.8, 970)) {
              const c = this.add.circle(ex, ey, 20, i % 2 ? 0xfde047 : 0xf97316, 0.9).setDepth(970);
              this.tweens.add({ targets: c, radius: 160, alpha: 0, duration: 600, onComplete: () => c.destroy() });
            }
            this.cameras.main.shake(150, 0.02);
          });
        await new Promise<void>((r2) => this.time.delayedCall(1700, () => r2()));
        this.cameras.main.flash(600, 255, 255, 255);
        await playCine(this, "ch4_boom");
        resolve();
      });
    });
  }

  // ------------------------------------------------------------------ bosses

  /** Which boss of a boss rush we're on (0 = the room's own boss). */
  private rushIdx = 0;
  private roomMusicId = "";
  private fightMusicOn = false;

  private async startBoss(id = this.room.boss!, hpMult = this.room.bossHp ?? 1, at?: { x: number; y: number }) {
    const r = this.room;
    const txt = BOSS_TEXT[id];
    this.busy = true;
    const bx = at?.x ?? r.w / 2;
    const by = at?.y ?? r.h / 2 - 100;
    const b = id === "pudding_demon" ? new PuddingDemonBoss(this, bx, by) : id === "krex" ? new KrexBoss(this, bx, by) : id === "elon" ? new ElonBoss(this, bx, by) : id === "drongus1" ? new DrongusPhaseOneBoss(this, bx, by) : id === "drongus2" ? new DerangedDrongusBoss(this, bx, by) : id === "dark_drongus" ? new DarkDrongusBoss(this, bx, by) : createBoss(id, this, bx, by);
    // bosses toughen up as the story goes on (the bank is how you keep up); BOSS_TOUGH: a bit more meat on all of them,
    // so a big gun from the Exchange speeds a fight up rather than deleting the boss
    const BOSS_TOUGH = 1.3;
    const bossMult = BOSS_TOUGH * (1 + Math.max(0, G.s.chapter - 2) * 0.18) * hpMult * diffFor(G.s).bossHp;
    if (hpMult < 1) b.dmgMult = (b.dmgMult ?? 1) * 0.8;
    b.maxHp = Math.round(b.maxHp * bossMult);
    b.hp = b.maxHp;
    b.dmgMult = (b.dmgMult ?? 1) * 1.1 * (1 + Math.max(0, G.s.chapter - 2) * 0.1);
    b.aggression = diffFor(G.s).aggression;
    // the Pit: a gauntlet boss hits as hard as the wave it's on; a rematch boss as hot as the Heat
    const ps = this.pitEnemyScale();
    if (ps) {
      if (G.rt.pit?.mode === "rematch") {
        b.maxHp = Math.round(b.maxHp * ps.hp);
        b.hp = b.maxHp;
      }
      b.dmgMult = (b.dmgMult ?? 1) * ps.dmg;
      b.aggression *= ps.aggression;
    }
    const pct = (this as any)._bossHpPct;
    if (typeof pct === "number" && pct > 0 && pct < 1) b.hp = Math.max(1, Math.round(b.maxHp * pct));
    this.boss = b;
    this.citadel?.onBoss(b);
    this.enemies.push(b);
    this.enemyGroup.add(b);
    if (this.side) {
      const bb = b.body as Phaser.Physics.Arcade.Body;
      bb.setCollideWorldBounds(true);
      if ((b as any).sideGravity) bb.setGravityY(1500);
      // fit the hitbox to the art so big bosses stand on the floor rather than hovering over it
      const fw = b.frame.width;
      const fh = b.frame.height;
      bb.setSize(fw * 0.6, fh * 0.85).setOffset(fw * 0.2, fh * 0.15);
      if (id === "rik") b.setPosition(r.w / 2, this.groundY - 120);
      if (id === "krex") bb.setSize(78, 96).setOffset(28, 21);
    }
    const epic = EPIC_BOSSES[id];
    const fresh = !(typeof pct === "number") || this.rushIdx > 0;
    let closeBars: ((ms?: number) => void) | null = null;
    if (epic) closeBars = await this.epicEntrance(b, fresh);
    else {
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 800 });
      synth.play("roar");
    }
    // a boss with its own theme: it starts the moment they appear, under their intro (no generic music first)
    const ownTheme = !!MUSIC_FILES[`fight_${id}`];
    if (ownTheme && !epic) {
      synth.music(`fight_${id}`, true);
      this.fightMusicOn = true;
    }
    if (fresh && G.rt.pit?.mode !== "gauntlet") await this.talk(txt.intro);
    if (epic) {
      if (fresh && BOSS_EYES[id] && b.active) await Juice.eyeShot(this, BOSS_EYES[id], 750, { color: Phaser.Display.Color.HexStringToColor(epic).color });
      // the VS card is their title card (name and epithet), at the end of the entrance
      if (b.active) await vsSplash(this, { bossId: id, art: { key: b.texture.key, frame: 0 }, color: Phaser.Display.Color.HexStringToColor(epic).color });
      closeBars?.(350);
      this.cameras.main.zoomTo(1, 350, "Cubic.easeOut", true);
    }
    // everyone else: the VS card once their intro's said (Dark Drongus has had his at the end of the roof cutscene)
    if (!epic && b.active && !(id === "dark_drongus" && vsSeen(id))) await vsSplash(this, { bossId: id, art: { key: b.texture.key, frame: 0 } });
    // epic bosses' themes start once the title card's done (the next boss in a rush goes back to the room's music)
    if (ownTheme) {
      if (epic) synth.music(`fight_${id}`, true);
      this.fightMusicOn = true;
    } else if (this.fightMusicOn) {
      synth.music(this.roomMusicId, true);
      this.fightMusicOn = false;
    }
    this.busy = false;
    b.started = true;
    b.nextPattern = this.now() + 1200;
  }

  /**
   * A big boss arrives: letterbox, a beat of silence, the camera pushes in on them, they drop in out of the dark and
   * land with a slam (squash, dust, shockwave, shake), then the roar. Returns the bars' close().
   */
  private async epicEntrance(b: Boss, fresh: boolean) {
    const cam = this.cameras.main;
    const close = Juice.letterbox(this, 50, 420);
    const vig = Juice.vignette(this, 0x000000, 0.55, 4890);
    this.events.once("epic-vig-off", () => this.tweens.add({ targets: vig, alpha: 0, duration: 600, onComplete: () => vig.destroy() }));
    // scaleX reads the real scale but writes apply the HD factor, so work in logical scale
    const sx = b.scaleX / hdFactor(b);
    const sy = b.scaleY / hdFactor(b);
    const y0 = b.y;
    b.setAlpha(0);
    if (fresh) {
      // a beat of quiet before it hits
      await new Promise<void>((r) => this.time.delayedCall(380, () => r()));
    }
    // frame the two of you (the boss can be off screen when it arrives)
    const p = this.player.spr;
    const dx = Math.abs(b.x - p.x) + 160;
    const dy = Math.abs(y0 - p.y) + 200;
    const z = Phaser.Math.Clamp(Math.min(960 / dx, 440 / dy), 1, 1.18);
    cam.stopFollow();
    // weighted towards the boss (the HUD sits over the top of the screen)
    cam.pan(b.x * 0.7 + p.x * 0.3, Math.min((y0 + p.y) / 2, y0 + 90), 600, "Sine.easeInOut", true);
    cam.zoomTo(z, 700, "Sine.easeInOut", true);
    Juice.duckMusic(900, 500, 0.15);
    Juice.riser(520, 0.3);
    await new Promise<void>((r) => this.time.delayedCall(260, () => r()));
    // Drongus (phase one) is already standing there from the meeting: he powers up where he is instead of dropping in
    const drop = b.bossId !== "drongus1";
    if (drop) {
      b.setAlpha(1).setTint(0x000000);
      b.y = y0 - 260;
      b.setScale(sx * 0.82, sy * 1.25);
      const body = b.body as Phaser.Physics.Arcade.Body | null;
      const wasOn = body?.enable ?? false;
      if (body) body.enable = false;
      await new Promise<void>((r) => this.tweens.add({ targets: b, y: y0, duration: 420, ease: "Quad.in", onComplete: () => r() }));
      if (body && wasOn) {
        body.enable = true;
        body.reset(b.x, b.y);
      }
    } else {
      b.setAlpha(1).setTintFill(0xff2a2a);
      await new Promise<void>((r) => this.tweens.add({ targets: b, scaleX: sx * 0.9, scaleY: sy * 1.12, duration: 420, ease: "Quad.in", onComplete: () => r() }));
    }
    if (!b.active) return close;
    b.clearTint();
    b.setScale(sx, sy);
    Juice.squash(this, b, 0.3, 520);
    synth.play("boom");
    synth.play("smash");
    Juice.subDrop(0.9, 1.1);
    this.hitStop(90);
    this.shake(420, 0.02);
    Juice.flash(this, 0xffffff, 220, 0.55, 4880);
    Juice.shockRing(this, b.x, b.y + b.displayHeight * 0.4, { color: 0xffffff, to: 420, rings: 3, flat: 0.35 });
    vfx(this, "vfx_dust", b.x - 50, b.y + b.displayHeight * 0.4, { scale: 2, depth: b.depth + 1 });
    vfx(this, "vfx_dust", b.x + 50, b.y + b.displayHeight * 0.4, { scale: 2, depth: b.depth + 1, flipX: true });
    Juice.debris(this, b.x, b.y + b.displayHeight * 0.35, 12, { depth: b.depth + 2, speed: 300, size: 7 });
    this.time.delayedCall(260, () => synth.play("roar"));
    this.tweens.add({ targets: b, angle: { from: -2, to: 2 }, yoyo: true, repeat: 3, duration: 60, onComplete: () => b.active && b.setAngle(0) });
    await new Promise<void>((r) => this.time.delayedCall(500, () => r()));
    return (ms = 400) => {
      close(ms);
      this.events.emit("epic-vig-off");
      cam.startFollow(this.player.spr, true, 0.12, 0.12);
    };
  }

  private epicSlowToken = 0;

  /** Chapter 6/7 bosses: crossing half health is a moment (flash, slow-mo beat, a shockwave off them, a shout). */
  private epicPhasePulse(b: Boss) {
    const col = EPIC_BOSSES[b.bossId];
    this.hitStop(120);
    Juice.flash(this, 0xffffff, 240, 0.6, 4880);
    Juice.punchZoom(this, 0.08, 500, 1);
    Juice.shockRing(this, b.x, b.y, { color: Phaser.Display.Color.HexStringToColor(col).color, to: 520, rings: 3 });
    this.shake(500, 0.02);
    synth.play("roar");
    synth.play("explode_1");
    Juice.subDrop(0.8, 0.9);
    Juice.slamText(this, "HALF DEAD. FULLY FURIOUS.", col, 36, 150, 900);
    this.setSlowmo(0.35);
    const token = ++this.epicSlowToken;
    window.setTimeout(() => {
      if (token === this.epicSlowToken && this.sys.settings.active && !this.picking && this.slowmo !== 1) this.setSlowmo(1);
    }, 520);
  }

  private phaseBreaking = false;

  /**
   * A boss crosses into its next phase (the boss emits "epic-phase"): the fight stops dead for a breath. Every
   * bullet in the air is cleared (no cheap hits out of a cutscene), the bars come in, the camera slams in on them,
   * impact frames, a roar, their line SLAMS across the screen, a shockwave, and back to it. About a second and a half.
   */
  private async epicPhaseBreak(b: Boss, line: string, col = EPIC_BOSSES[b.bossId] ?? "#ff3b3b") {
    if (this.phaseBreaking || this.dying || !b.active || b.dead || this.transitioning) return;
    this.phaseBreaking = true;
    const cam = this.cameras.main;
    const colN = Phaser.Display.Color.HexStringToColor(col).color;
    const wasBusy = this.busy;
    this.busy = true;
    for (const sh of [...this.shots]) if (sh.o.owner === "enemy") this.killShot(sh);
    this.hitStop(140);
    const close = Juice.letterbox(this, 48, 220);
    const z0 = cam.zoom;
    cam.stopFollow();
    cam.pan(b.x, b.y - 10, 260, "Cubic.easeOut", true);
    cam.zoomTo(Math.max(z0, 1) * 1.28, 300, "Cubic.easeOut", true);
    Juice.duckMusic(1100, 600, 0.2);
    synth.play("crit");
    Juice.subDrop(0.9, 1.4);
    await Juice.realWait(240);
    if (!this.sys.settings.active) return;
    await Juice.impactFrames(this, b);
    if (!this.sys.settings.active) return;
    synth.play("roar");
    synth.play("explode_1");
    b.setTintFill(colN);
    this.time.delayedCall(90, () => b.active && !b.dead && b.clearTint());
    this.shake(700, 0.022);
    Juice.flash(this, colN, 320, 0.45, 4880);
    Juice.shockRing(this, b.x, b.y, { color: colN, to: 700, rings: 4, ms: 800 });
    Juice.debris(this, b.x, b.y + b.displayHeight * 0.3, 14, { depth: b.depth + 2, speed: 380, size: 8 });
    const stopLines = Juice.speedLines(this, 900, colN);
    Juice.slamText(this, line, col, 40, 140, 950);
    const cut = PHASE_CUTINS[b.bossId];
    const lastStill = line.startsWith("LAST STAND") ? LAST_STAND_STILLS[b.bossId] : undefined;
    if (lastStill && this.textures.exists(lastStill)) await Juice.still(this, lastStill, 1150, { push: 0.14, shakeK: 0.015 });
    else if (cut && this.textures.exists(cut)) await Promise.all([Juice.realWait(1150), Juice.cutIn(this, cut, { from: "left", y: 340, color: colN, hold: 850 })]);
    else await Juice.realWait(1150);
    stopLines();
    if (!this.sys.settings.active) return;
    for (const sh of [...this.shots]) if (sh.o.owner === "enemy") this.killShot(sh);
    close(300);
    cam.zoomTo(z0, 400, "Cubic.easeInOut", true);
    cam.startFollow(this.player.spr, true, 0.12, 0.12);
    if (!wasBusy) this.busy = false;
    b.nextPattern = Math.max(b.nextPattern, this.now() + 700);
    this.phaseBreaking = false;
  }

  /** The killing blow on a chapter 6/7 boss: freeze, white, slow-mo push-in, then the boom lands. */
  private async epicKillingBlow(b: Boss) {
    const cam = this.cameras.main;
    this.hitStop(160);
    // the hit lands: two impact frames (white / black silhouettes) before anything else moves
    await Juice.impactFrames(this, b, 60);
    if (!this.sys.settings.active) return;
    b.setTintFill(0xffffff);
    Juice.flash(this, 0xffffff, 380, 0.85, 4880);
    const stopLines = Juice.speedLines(this, 1000, Phaser.Display.Color.HexStringToColor(EPIC_BOSSES[b.bossId] ?? "#ffffff").color);
    synth.play("crit");
    synth.play("explode_2");
    Juice.subDrop(1, 2.2);
    Juice.duckMusic(1300, 900, 0.1);
    const close = Juice.letterbox(this, 46, 260);
    const token = ++this.epicSlowToken;
    this.setSlowmo(0.22);
    cam.stopFollow();
    cam.pan(b.x, b.y, 400, "Cubic.easeOut", true);
    cam.zoomTo(1.3, 500, "Cubic.easeOut", true);
    Juice.shockRing(this, b.x, b.y, { color: 0xffffff, to: 640, rings: 4, ms: 900 });
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 60, () => this.boomFx(b.x + (Math.random() - 0.5) * 90, b.y + (Math.random() - 0.5) * 90, 0.8));
    await Juice.realWait(1100);
    stopLines();
    if (!this.sys.settings.active) return;
    if (!this.picking && token === this.epicSlowToken) this.setSlowmo(1);
    b.active && b.clearTint();
    cam.zoomTo(1, 700, "Cubic.easeInOut", true);
    cam.startFollow(this.player.spr, true, 0.12, 0.12);
    synth.play("boom");
    Juice.debris(this, b.x, b.y, 18, { depth: 1450, speed: 420, size: 8 });
    close(500);
  }

  private miniBossKey() {
    return `mbcp_${this.dungeon.id}_${this.roomIdx}`;
  }

  /** A mini-boss turns up part way through a side room (METAL GEAR KREX, the AI Elon). */
  private async startMiniBoss() {
    const r = this.room;
    const mb = r.miniBoss!;
    this.miniBossState = "fight";
    this.busy = true;
    const again = !!G.s.flags[this.miniBossKey()];
    // checkpoint: die here and you come back in right here
    G.s.flags[this.miniBossKey()] = `${Math.round(this.player.x)},${Math.round(this.player.y - 10)}`;
    G.save();
    // clear the stage
    for (const e of [...this.enemies]) if (!e.dead && !e.isBoss) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
    if (!r.tower) {
      const l = Math.max(0, Math.min(r.w - 960, this.player.x - 200));
      this.arenaLeft = l;
      this.cameras.main.setBounds(l, 0, r.w - l, r.h);
    }
    const pct = (this as any)._bossHpPct;
    if (mb.pa?.length && typeof pct !== "number" && !again) {
      if (this.citadel) await this.citadel.pa(mb.pa);
      else await this.talk(mb.pa);
    }
    if (mb.music) synth.music(mb.music, true);
    // the hero passengers: three at once (their own start)
    if (mb.id === "heropax") return this.startHeroPax(again, mb.hp ?? 1);
    const at = r.tower ? { x: Phaser.Math.Clamp(this.player.x + (this.player.x < r.w / 2 ? 260 : -260), 120, r.w - 120), y: this.player.y - 240 } : { x: Math.min(r.w - 180, this.player.x + 560), y: this.groundY - 170 };
    await this.startBoss(mb.id, mb.hp ?? 1, at);
  }

  /**
   * THE HERO PASSENGERS (Flight KR-069, first class): three passengers who've decided to take the plane back, all at
   * once. They come up out of their seats, the VS card has the three of them, and they share one bar on the HUD.
   */
  private async startHeroPax(again: boolean, hpMult: number) {
    const r = this.room;
    const sq = new HeroSquad(this);
    this.heroSquad = sq;
    const left = this.arenaLeft || Math.max(0, this.player.x - 200);
    // Gareth up front, the Major behind him, Tilly at the back with the luggage
    const lineup: [HeroId, number][] = [["heropax_rugby", 560], ["heropax_major", 700], ["heropax_gapgirl", 840]];
    const mult = 1.3 * (1 + Math.max(0, G.s.chapter - 2) * 0.18) * hpMult * diffFor(G.s).bossHp;
    for (const [i, [id, dx]] of lineup.entries()) {
      const x = Math.min(r.w - 120, left + dx);
      const h = createHero(id, this, x, this.groundY - 90);
      h.maxHp = Math.round(h.maxHp * mult);
      h.hp = h.maxHp;
      h.dmgMult = (h.dmgMult ?? 1) * 1.1 * (1 + Math.max(0, G.s.chapter - 2) * 0.1);
      h.aggression = diffFor(G.s).aggression;
      h.setFlipX(true);
      this.enemies.push(h);
      this.enemyGroup.add(h);
      const bb = h.body as Phaser.Physics.Arcade.Body;
      bb.setCollideWorldBounds(true);
      if (this.side) bb.setGravityY(1500);
      // the figure stands at the bottom middle of its cell
      const fw = h.frame.width;
      const fh = h.frame.height;
      bb.setSize(fw * 0.3, fh * 0.62).setOffset(fw * 0.35, fh * 0.37);
      sq.add(h);
      // up out of the seats, one after another
      h.setAlpha(0);
      this.time.delayedCall(i * 260, () => {
        if (!h.active) return;
        h.setAlpha(1);
        bb.setVelocityY(-520);
        synth.play("swing");
        this.floatText(h.x, h.y - 70, "!", "#fde68a", 26);
      });
    }
    synth.play("roar");
    if (!again) await this.talk(BOSS_TEXT.heropax.intro);
    if (!this.heroAlive()) return;
    await vsSplash(this, {
      bossId: "heropax",
      name: "THE HERO PASSENGERS",
      epithet: "TAKING THE PLANE BACK",
      color: 0xdc2626,
      group: sq.members.map((m) => ({ key: m.texture.key, frame: 0 })),
    });
    synth.music("boss_arena", true);
    this.fightMusicOn = true;
    this.busy = false;
    const now = this.now();
    for (const [i, m] of sq.members.entries()) {
      m.started = true;
      m.nextPattern = now + 1000 + i * 700;
    }
  }

  /** One of them is down (they stay down, cowering). The last one down ends it. */
  private heroPaxDown(h: HeroPassenger) {
    const sq = this.heroSquad;
    if (!sq) return;
    if (h.downTarget) sq.onDown(h, h.downTarget);
    h.setDepth(h.y - 2);
    if (sq.alive.length || sq.done) return;
    sq.done = true;
    void this.heroPaxDefeated(sq);
  }

  /** All three down: "KRELTALITY ALL OF THEM?" (one after another), or spare them. Then on to the cockpit door. */
  private async heroPaxDefeated(sq: HeroSquad) {
    const s = G.s;
    this.busy = true;
    this.player?.cheer(this.now(), 2600);
    G.emit("boss", null);
    for (const e of [...this.enemies]) if (!e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
    for (const sh of [...this.shots]) this.killShot(sh);
    await new Promise<void>((res) => this.time.delayedCall(900, () => res()));
    if (!this.heroAlive()) return;
    await this.talk(BOSS_TEXT.heropax.outro);
    if (!this.heroAlive()) return;
    const downed = sq.downed.filter((d) => d.hero.active);
    if (downed.length && (await krelAllPrompt(this, downed.length))) {
      const ps = this.player.spr;
      const phd = (ps.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
      const pl = { key: ps.texture.key, frame: 0, scale: ps.scaleX / phd };
      let n = 0;
      // the show draws its own you and its own victim: while it plays, the real you and every passenger still lying
      // in the aisle are hidden (or you'd see two of you, and the others cowering through the middle of it);
      // between finishers they're back, so the "NEXT:" card shows who's next, still cowering
      const showReal = (on: boolean) => {
        if (ps.active) ps.setVisible(on);
        for (const o of downed) if (o.hero.active) o.hero.setVisible(on);
        this.heroSquad?.setTagsVisible(on);
      };
      for (const [i, d] of downed.entries()) {
        if (i > 0) await chainCard(this, i + 1, downed.length, d.target.name);
        const tg: KrelTarget = { ...d.target, x: d.hero.x, y: d.hero.y };
        d.hero.remove();
        showReal(false);
        // a different finisher on each (the shuffle bag never repeats one until you've seen them all)
        try {
          await forcedKreltality(this, tg, pl, pick(tg));
        } finally {
          if (this.heroAlive()) showReal(true);
        }
        if (!this.heroAlive()) return;
        n++;
        bump(s, "kreltalities");
        s.flags[`krel_${d.target.id}`] = true;
      }
      if (n > 1) await multiBanner(this, n);
    } else {
      // spared: they flop over where they are, and stay there
      for (const d of downed) {
        const h = d.hero;
        h.anims.stop();
        this.tweens.killTweensOf(h);
        this.tweens.add({ targets: h, angle: h.flipX ? -84 : 84, y: h.y + h.displayHeight * 0.3, duration: 500, ease: "Quad.in" });
        h.setTint(0xb8b8b8);
      }
      this.toast("SPARED", "They'll be dining out on this for years.");
      // let them flop (and let the ESC that spared them go, or it opens the pause menu as soon as you're free)
      await new Promise<void>((res) => this.time.delayedCall(700, () => res()));
    }
    if (!this.heroAlive()) return;
    sq.destroy();
    this.heroSquad = null;
    this.cameras.main.zoomTo(1, 300);
    // a mini-boss: the room carries on (the screen unlocks, the room's music comes back), and the cockpit door opens
    this.roomCleared = true;
    this.markCleared();
    this.miniBossState = "done";
    delete s.flags[this.miniBossKey()];
    this.arenaLeft = 0;
    this.cameras.main.setBounds(0, 0, this.room.w, this.room.h);
    this.cameras.main.startFollow(this.player.spr, true, 0.12, 0.12);
    this.fightMusicOn = false;
    synth.music(this.room.music ?? this.dungeon.music, true);
    this.dropPickup(this.player.x + 40, this.player.y - 30, "ammo", 2);
    s.hp = Math.min(maxHp(s), s.hp + maxHp(s) * 0.5);
    this.door.setTexture("p_door");
    this.toast("EXIT OPEN", "The cockpit door. Breach it →");
    this.busy = false;
  }


  /** Still here (not shut down by a death or a quit): paused by a dialogue counts. */
  private heroAlive() {
    return !!this.sys && (this.sys.isActive() || this.sys.isPaused());
  }

  /** Where the boss died and what they looked like (for the KRELTALITY stand-in). */
  private krelTarget: KrelTarget | null = null;
  private lastHitFx = 0;
  private lastKillPop = 0;

  /** The boss's drawn "defeated" animation (bossdie_<id>): staggering to their knees, then collapsing. */
  private downSpr: Phaser.GameObjects.Sprite | null = null;
  private downSplit = 0;

  /** Stagger and drop to the knees (held there through their last words). */
  private bossKneel(b: Boss): Promise<void> {
    const key = `bossdie_${b.bossId}`;
    // these have their own death scenes (and anyone with a deathSequence: Deranged Drongus sheds his armour and
    // legs it to the cauldron, Krex falls to bits; a kneeling stand-in would hide them and be left on the floor)
    if (["reinhardt", "krozno", "rik"].includes(b.bossId) || !this.textures.exists(key)) return Promise.resolve();
    if ((b as unknown as { deathSequence?: unknown }).deathSequence) return Promise.resolve();
    const tex = this.textures.get(key);
    const n = tex.frameTotal - 1;
    if (n < 4) return Promise.resolve();
    const side = tex.get(0).height;
    const fh = b.frame.height;
    const k = b.displayHeight / fh; // screen px per source px, same as the boss sprite
    const down = this.add.sprite(b.x, b.y + b.displayHeight * (1 - b.originY), key, 0).setOrigin(0.5, (side - 4) / side).setDepth(b.depth).setFlipX(b.flipX);
    down.setScale(k);
    b.setVisible(false);
    this.downSpr = down;
    // these strips: a long dazed wobble, then the drop in the last few frames
    this.downSplit = BOSSDIE_SPLIT[key] ?? Math.max(2, n - 4);
    if (!this.anims.exists(`${key}_kneel`)) {
      this.anims.create({ key: `${key}_kneel`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: this.downSplit }), frameRate: 9, repeat: 0 });
      this.anims.create({ key: `${key}_fall`, frames: this.anims.generateFrameNumbers(key, { start: this.downSplit, end: n - 1 }), frameRate: 6, repeat: 0 });
    }
    return new Promise((r) => {
      down.play(`${key}_kneel`);
      down.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r());
      this.time.delayedCall(2500, () => r());
    });
  }

  /** ...and the rest: down they go. */
  private bossFall(): Promise<void> {
    const down = this.downSpr;
    if (!down || !down.active) return Promise.resolve();
    const key = down.texture.key;
    return new Promise((r) => {
      down.play(`${key}_fall`);
      down.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        synth.play("boom");
        this.shake(200, 0.008);
        vfx(this, "vfx_dust", down.x, down.y, { scale: 1.6, depth: down.depth + 1 });
        r();
      });
      this.time.delayedCall(2500, () => r());
    });
  }

  /** "FUCKING KILL THEM!!" — optional, after the boss's last words. */
  private async maybeKreltality(b: Boss) {
    // (Drongus in every form has his own ending, Uncle Rik has his, and these few have theirs)
    // the Cronster is Jenko under the mask. Kreltality him anyway: nobody mentions it afterwards
    // (METAL GEAR KREX is offered his before he blows up: krexEnding)
    if (["drongus", "reinhardt", "krozno", "rik", "krex", "drongus1", "drongus2", "dark_drongus", "final"].includes(b.bossId) || !this.krelTarget) {
      await this.bossFall();
      return;
    }
    const done = await this.offerKreltality(b);
    if (!done) await this.bossFall();
  }

  /**
   * METAL GEAR KREX: the Kreltality is offered while he's down and sparking, BEFORE he blows up. Yes: you take him
   * apart by hand (KrexFinisher.ts), then the bits explode. No: his own explosion chain, as ever.
   */
  private async krexEnding(b: KrexBoss) {
    this.krelTarget = null;
    this.busy = true;
    if (await krelPrompt(this)) {
      const ps = this.player.spr;
      const phd = (ps.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
      const rig = b.rig();
      // the show draws its own you and its own him (every bolted-on bit of him): hide the real ones
      b.setRigVisible(false);
      ps.setVisible(false);
      this.downSpr?.setVisible(false);
      try {
        await krexKreltality(this, rig, { key: ps.texture.key, frame: 0, scale: ps.scaleX / phd }, this.side ? this.groundY : b.y + b.displayHeight * 0.4);
      } finally {
        if (ps.active) ps.setVisible(true);
      }
      b.scrap();
      bump(G.s, "kreltalities");
      G.s.flags.krel_krex = true; // a trophy for the shelf at home
      this.cameras.main.startFollow(this.player.spr, true, 0.12, 0.12);
      await this.talk(KREX_KREL_OUTRO);
      return;
    }
    if (this.textures.exists("fe_still_krex_boom")) {
      synth.play("explode_2");
      await Juice.still(this, "fe_still_krex_boom", 1300, { push: 0.12, shakeK: 0.018 });
    }
    await b.deathSequence();
    await this.talk(BOSS_TEXT.krex.outro);
  }

  /** Offer the finisher on the beaten boss. True if it was done (the boss is gone), false if you passed. */
  private async offerKreltality(b: Boss): Promise<boolean> {
    if (!this.krelTarget) return false;
    const ps = this.player.spr;
    const phd = (ps.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
    this.busy = true;
    // the show draws its own you and its own them: hide the real ones (and the kneeling stand-in), or you see two of each
    const hidden: Phaser.GameObjects.Components.Visible[] = [];
    const done = await kreltality(this, this.krelTarget, { key: ps.texture.key, frame: 0, scale: ps.scaleX / phd }, undefined, {
      onStage: () => {
        for (const o of [ps, b, this.downSpr] as (Phaser.GameObjects.Components.Visible | null | undefined)[]) {
          if (o && o.visible) {
            o.setVisible(false);
            hidden.push(o);
          }
        }
      },
      onEnd: () => {
        if (ps.active) ps.setVisible(true);
      },
    });
    if (done) {
      this.downSpr?.destroy();
      this.downSpr = null;
    }
    if (done) {
      bump(G.s, "kreltalities");
      G.s.flags[`krel_${b.bossId}`] = true; // a trophy for the shelf at home
    }
    this.krelTarget = null;
    this.cameras.main.startFollow(this.player.spr, true, 0.12, 0.12);
    return done;
  }

  private async onBossDefeated(b: Boss) {
    this.player?.cheer(this.now(), 2600);
    if (G.rt.pit?.mode === "gauntlet" || G.rt.pit?.mode === "range") {
      this.pitBossDown(b);
      return;
    }
    this.busy = true;
    if (EPIC_BOSSES[b.bossId]) await this.epicKillingBlow(b);
    // the mini-bosses' money shots: Krex going up, Elon's rocket spiralling out
    const deathStill = ({ krex: "fe_still_krex_boom", elon: "fe_still_elon_crash" } as Record<string, string>)[b.bossId];
    if (deathStill && b.bossId !== "krex" && this.textures.exists(deathStill)) {
      synth.play("explode_2");
      await Juice.still(this, deathStill, 1300, { push: 0.12, shakeK: 0.018 });
    }
    {
      const hd = (b.texture?.customData as { hd?: number } | undefined)?.hd ?? 1;
      this.krelTarget = b.texture ? { key: b.texture.key, frame: b.frame.name, x: b.x, y: b.y, scale: b.scaleX / hd, flip: b.flipX, name: BOSS_TEXT[b.bossId]?.name ?? "THE BOSS", id: b.bossId } : null;
    }
    this.downSpr?.destroy();
    this.downSpr = null;
    await this.bossKneel(b);
    const s = G.s;
    const rush = this.room.bossRush ?? [];
    if (this.rushIdx < rush.length) {
      // boss rush: next one up, same room, new set
      G.emit("boss", null);
      synth.play("boom");
      this.boomFx(b.x, b.y, 1.3);
      this.shake(500, 0.02);
      for (const e of [...this.enemies]) if (e !== b && !e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
      for (const sh of [...this.shots]) this.killShot(sh);
      await this.talk(BOSS_TEXT[b.bossId].outro);
      await this.maybeKreltality(b);
      this.boss = null;
      const next = rush[this.rushIdx++];
      s.hp = Math.min(maxHp(s), s.hp + maxHp(s) * 0.35);
      this.dropPickup(this.player.x + 30, this.player.y - 20, "ammo", 2);
      this.toast(`CROBLEY ${this.rushIdx + 1} OF ${rush.length + 1}`, "+35% health. Ammo on the floor. Next one's coming.");
      this.cameras.main.flash(300, 255, 255, 255);
      if (next.backdrop && this.sideBg && this.textures.exists(next.backdrop)) {
        const src = this.textures.get(next.backdrop).getSourceImage();
        this.sideBgScale = 540 / src.height;
        this.sideBg.setTexture(next.backdrop).setTileScale(this.sideBgScale);
      }
      this.busy = false;
      this.time.delayedCall(900, () => void this.startBoss(next.boss, next.hp ?? 1));
      return;
    }
    // a rematch's last boss: that's the win (none of what comes after it in the story)
    if (G.rt.pit && this.roomIdx >= G.rt.pit.to) {
      await this.rematchBossWin(b);
      return;
    }
    if (this.roomIdx < this.dungeon.rooms.length - 1) {
      // a boss half way through: beat it and the door opens
      G.emit("boss", null);
      if (!(b as unknown as { quietDefeat?: boolean }).quietDefeat) {
        synth.play("boom");
        this.boomFx(b.x, b.y, 1.4);
        this.shake(600, 0.025);
      }
      for (const e of [...this.enemies]) if (e !== b && !e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
      for (const sh of [...this.shots]) this.killShot(sh);
      // the ones with a big death of their own (METAL GEAR KREX falls to bits)
      const seq = (b as unknown as { deathSequence?: () => Promise<void> }).deathSequence;
      if (b instanceof KrexBoss) await this.krexEnding(b);
      else {
        if (seq) await seq.call(b);
        await this.talk(BOSS_TEXT[b.bossId].outro);
        await this.maybeKreltality(b);
      }
      // the ones who get away (Drongus, phase one: out the back door and up the stairs)
      const flee = (b as unknown as { runAway?: (x: number, y: number) => Promise<void> }).runAway;
      if (flee) await flee.call(b, this.door.x, this.door.y - 10);
      if (!G.rt.pit) await this.crystalGet(b);
      this.boss = null;
      this.roomCleared = true;
      this.markCleared();
      if (this.room.miniBoss) {
        // a mini-boss: the room carries on (the screen unlocks, the room's music comes back)
        this.miniBossState = "done";
        delete s.flags[this.miniBossKey()];
        this.arenaLeft = 0;
        this.cameras.main.setBounds(0, 0, this.room.w, this.room.h);
        this.cameras.main.startFollow(this.player.spr, true, 0.12, 0.12);
        synth.music(this.room.music ?? this.dungeon.music, true);
        this.dropPickup(this.player.x + 40, this.player.y - 30, "ammo", 2);
      }
      s.hp = Math.min(maxHp(s), s.hp + maxHp(s) * 0.5);
      this.door.setTexture("p_door");
      this.toast("EXIT OPEN", this.room.goal && !this.room.tower ? this.room.goal : this.room.tower ? "Keep climbing: the way on is at the very top." : this.side ? "The way on is to the far right →." : "The exit is open.");
      this.busy = false;
      return;
    }
    // dungeon done: forget room progress so a replay starts from the top
    for (let i = 0; i < this.dungeon.rooms.length; i++) delete s.flags[clearKey(this.dungeon.id, i)];
    G.emit("boss", null);
    synth.play("boom");
    this.boomFx(b.x, b.y, 1.6);
    this.shake(800, 0.03);
    for (const e of [...this.enemies]) if (e !== b && !e.dead) this.damageEnemy(e, 99999, { noWonk: true, label: "" });
    for (const sh of [...this.shots]) this.killShot(sh);
    this.rule = null;
    G.emit("rule", null);
    if (b.bossId === "reinhardt") {
      // a Kreltality first, if you want one; pass and he gets his own (gory) end
      const krel = await this.offerKreltality(b);
      if (!krel) {
        (this.downSpr as Phaser.GameObjects.GameObject | null)?.destroy();
        this.downSpr = null;
        await this.reinhardtDeath(b);
      } else b.setVisible(false);
      await this.fuelTankFinale();
    }
    if (this.dungeon.arenaFlag) {
      await this.talk(BOSS_TEXT[b.bossId].outro);
      await this.maybeKreltality(b);
      // Uncle Rik: the crystal is… somewhere else. Into the shrink ray.
      if (b.bossId === "rik") {
        await this.shrinkRay();
        this.transitioning = true;
        switchTo(this, "Dungeon", { dungeon: "rik_colon", room: 0 });
        return;
      }
      // Reinhardt is Chapter 4's boss: his crystal, and the chapter's done
      if (b.bossId === "reinhardt") {
        await this.crystalGet(b);
        if (s.chapter === 4 && !s.flags.ch4_clear) {
          s.flags.ch4_clear = true;
          s.coins += Math.round(200 * activeMods(s).questRewardMult * 2);
          s.bottles = maxBottles(s);
          G.drongus("boss_defeated");
        }
      }
      s.flags[this.dungeon.arenaFlag] = true;
      s.coins += 150;
      s.hp = maxHp(s);
      s.phase = "hub";
      G.save();
      const vig = b.bossId === "flatmate" ? "flatmate" : b.bossId === "rival" ? "rival" : b.bossId === "rik" ? "sanmik_finale" : b.bossId === "reinhardt" ? "crobley_boom" : null;
      this.time.delayedCall(800, () => {
        this.transitioning = true;
        if (vig) switchTo(this, "Vignette", { id: vig, returnAt: this.dungeon.returnAt });
        else switchTo(this, "Hub", { at: this.dungeon.returnAt, from: "arena" });
      });
      return;
    }
    if (b.bossId === "krozno") {
      await this.talk(BOSS_TEXT.krozno.outro);
      // a Kreltality, if you want one; pass and he just goes down
      if (await this.offerKreltality(b)) b.setVisible(false);
      else await this.bossFall();
      G.rt.timerEnd = 0;
      G.emit("timer", null);
      s.coins += 300;
      s.hp = maxHp(s);
      s.phase = "hub";
      G.save();
      this.time.delayedCall(600, () => {
        this.transitioning = true;
        switchTo(this, "Vignette", { id: "plane_escape", returnAt: "AIRPORT" });
      });
      return;
    }
    if (b.bossId === "drongus") {
      s.flags.ch7_clear = true;
      G.save();
      await this.bossFall();
      this.time.delayedCall(1200, () => {
        this.transitioning = true;
        switchTo(this, "Ending", {});
      });
      return;
    }
    const txt = BOSS_TEXT[b.bossId];
    await this.talk(txt.outro);
    await this.maybeKreltality(b);
    await this.crystalGet(b);
    // the end of Chapter 1: the first taste of golden juice (the strippers at the Wonky Pole sell squeezes after this)
    if (b.bossId === "krandall" && !G.s.flags.golden_found) await this.goldenJuiceFind(b);
    this.completeChapter(b.bossId);
  }

  /** After Krandall: a bottle of golden pussy juice rolls out from where he fell. Drink it: the transformation, explained. */
  private goldenJuiceFind(b: Boss): Promise<void> {
    return new Promise<void>((resolve) => {
      const s = G.s;
      const x = Phaser.Math.Clamp(b.x, 80, this.room.w - 80);
      const y = this.side ? this.groundY - 30 : Phaser.Math.Clamp(b.y + 30, 120, this.room.h - 90);
      const tex = this.textures.exists("p_juice") ? "p_juice" : this.textures.exists("p_bottle") ? "p_bottle" : "p_scroll";
      const shine = shinyPickup(this, x, y, tex, { scale: trailPropScale(this, tex, 46), halo: 0xfde047, glow: 0xfff3a0, rays: 0xffe680, twinkle: 0xfff7c2, tag: "✦ GOLDEN JUICE" });
      shine.img.setTint(0xffd23f);
      this.busy = false;
      this.toast("WHAT'S THAT?", "Something golden rolled out from under Krandall. Go and look.");
      const it: Interactable = {
        x,
        y,
        r: 70,
        label: "Drink the golden pussy juice",
        use: async () => {
          this.interactables = this.interactables.filter((q) => q !== it);
          this.busy = true;
          shine.destroy();
          await this.talk([
            dir("Rolling out from under Krandall's coat: a little glass bottle of something GOLDEN. It's warm. It's glowing. The label, in Krandall's handwriting, says GOLDEN PUSSY JUICE. FRESHEST SOURCES ONLY."),
            dir("You drink it. Of course you drink it."),
          ]);
          synth.play("gulp");
          await preview(this, this.player.spr);
          s.flags.golden_found = true;
          s.flags.golden_first = true;
          s.flags.golden_charge = true;
          G.save();
          await this.talk([
            dir("⚡ NEW POWER-UP: GOLDEN TRANSFORMATION ⚡"),
            dir("You're full of golden juice. In your next dungeon, press T (or ⚡T) to TRANSFORM, once: ATTACK becomes a huge golden mega melee and C (or CUME) fires the CUMEHAMEHA. It lasts about 13 seconds."),
            dir("Golden juice only comes from the freshest sources. When you want more: the Wonky Pole. Pay for a private dance in the booth at the back, give the stripper a squeeze, and drink what comes out."),
          ]);
          resolve();
        },
      };
      this.interactables.push(it);
    });
  }

  /** The chapter's dungeon is done (after its boss, or after whatever its last room asks of you). */
  private completeChapter(bossId: string) {
    this.sweepQuestPickups();
    const s = G.s;
    for (let i = 0; i < this.dungeon.rooms.length; i++) delete s.flags[clearKey(this.dungeon.id, i)];
    const dd = diffFor(s);
    const reward = Math.round(200 * activeMods(s).questRewardMult * (1 + (s.chapter - 1) * 0.25) * dd.rewards);
    s.coins += reward;
    // the hard-mode bonus: Krokens for every chapter on HARD / VERY HARD
    if (dd.krokenBonus > 0) addKrokens(s, dd.krokenBonus);
    s.flags[`ch${this.dungeon.chapter}_clear`] = true;
    s.phase = "hub";
    s.hp = maxHp(s);
    s.bottles = maxBottles(s);
    if (bossId === "salmon" || bossId === "krandall") G.unlockArchive("arch_squeeze");
    if (bossId === "feedback") {
      G.unlockArchive("arch_cheesegate");
      G.unlockArchive("arch_mork_voice");
    }
    if (bossId === "machine") G.unlockArchive("arch_purple");
    if (bossId === "banhammer") G.unlockArchive("arch_kreltower");
    if (bossId === "spectre") {
      G.unlockArchive("arch_godric");
      G.unlockArchive("arch_crobley");
    }
    G.drongus("boss_defeated");
    G.save();
    this.toast("CHAPTER COMPLETE", `+${reward} Krezzcoin${dd.krokenBonus > 0 ? ` · +${dd.krokenBonus} Krokens (${dd.name} bonus)` : ""}. Report to the Town Hall.`);
    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(500);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.transitioning = true;
        switchTo(this, "Hub", { from: "dungeon" });
      });
    });
  }

  /** The Anthem Corridor: everyone upstanding for the national anthem (see citadel/Citadel.ts). */
  private async anthemEvent() {
    await this.citadel?.anthem();
  }

  private missionFailed() {
    this.busy = true;
    // a rematch of the flight: the clock running out is just a loss (the tower stays up)
    if (G.rt.pit) {
      void this.pitFinish("death", "OUT OF TIME");
      return;
    }
    const s = G.s;
    Object.assign(s.flags, { kreltower_resolved: true, kreltower_fell: true, arcstep_arc_klerble_hijack: true });
    G.rt.timerEnd = 0;
    G.emit("timer", null);
    s.hp = maxHp(s);
    s.phase = "hub";
    G.save();
    this.cameras.main.flash(600, 255, 255, 255);
    this.transitioning = true;
    switchTo(this, "Vignette", { id: "kreltower_fall", returnAt: "AIRPORT" });
  }

  // ------------------------------------------------------------------ events: Polson Towers









  // ------------------------------------------------------------------ events: misc

  /** Chapter 3's last room: untie Mollor, a thank-you, a hug, and a tip about the golden juice. */
  private async rescueMollor(spr: Phaser.GameObjects.Sprite, ropes: Phaser.GameObjects.Graphics) {
    const s = G.s;
    if (s.flags.mollor_freed || this.busy) return;
    s.flags.mollor_freed = true;
    ropes.destroy();
    synth.play("gunget");
    this.tweens.add({ targets: spr, y: spr.y - 16, yoyo: true, duration: 180 });
    this.busy = true;
    await playCine(this, "ch3_mollor");
    this.busy = false;
    const jenko = s.player === "FLENKY";
    await this.talk(
      jenko
        ? [
            say("MOLLOR", "AHHH! FUCK OFF YOU PERVERT!"),
            say("FLENKY", "Mollor it wasn't me! It was my alter-ego!"),
          ]
        : [
            say("MOLLOR", "Thank you for saving me from that sicko Jenko!"),
            dir("Mollor kisses you on the cheek."),
            say("MOLLOR", "He kept going on about 'golden juice'. Said it only comes from the freshest sources. Said a proper squeeze does it."),
          ],
    );
    s.flags.golden_unlocked = true;
    const took = await squeeze(this, (l) => this.talk(l), { name: "MOLLOR", spr }, this.player.spr, [], "Want a cuddle?");
    if (!took) await this.talk([dir("Golden juice comes from the freshest sources: a woman who's up for a squeeze. Try a private dance at the Wonky Pole, or the new faces around Krelford. Squeeze before a dungeon, then press T in it to TRANSFORM.")]);
    await this.talk([say("MOLLOR", jenko ? "Right. Home. Now. Before you go dark again." : "Right. I'm going home. Tell Jenko it's over. Both Jenkos.")]);
    this.completeChapter("cronster");
  }

  private async inspectBertha() {
    const s = G.s;
    if (s.player === "GRONNY" && !s.flags.bertha_found) {
      s.flags.bertha_found = true;
      s.coins += 60;
    }
  }

  private async restoreNetwork(spr: Phaser.GameObjects.Image) {
    if (!this.roomCleared) {
      this.toast("TERMINAL", "Too much interference. Clear the room first.");
      return;
    }
    await this.talk([
      dir("You place your thumb on the terminal. Every reaction in Krelworld reconnects at once. The ceiling briefly fills with floating 👍 ❤️ 😂 😡."),
      { s: "NARRATOR", t: "", react: { message: "REACTION NETWORK TEST MESSAGE: 'hello?' — sent by DRONGUS B. DRIPPIN', 47 days ago", context: "network_test", from: "DRONGUS" } },
      say("DRONGUS", "...was that a react? From the network? Who did that?", { notify: true }),
      dir("REACTION NETWORK: RESTORED. The final door opens."),
    ]);
    G.s.flags.network_restored = true;
    spr.setTint(0x5ad35a);
    this.checkExit();
  }

  /**
   * THE WONKING MACHINE: press E, it does the rest. A mechanical arm comes out and sees to you (behind a censor bar),
   * there's some moaning, and your Krezz is full. Once per machine per visit.
   */
  private async useWonkingMachine(id: string, spr: Phaser.GameObjects.Image) {
    const s = G.s;
    if (this.machineUses[id]) {
      this.toast("WONKING MACHINE", "Spent. It needs a lie down.");
      return;
    }
    this.machineUses[id] = 1;
    bump(s, "wonk_machine");
    const p = this.player;
    (p.spr.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.busy = true;
    const DUR = 2600;
    this.hitStop(DUR);
    const cam = this.cameras.main;
    const z0 = cam.zoom;
    cam.zoomTo(z0 * 1.5, 300, "Cubic.easeOut", true);
    synth.play("wonk");
    // the arm gets to work: wet, rhythmic, relentless
    synth.play("faploop");
    this.tweens.add({ targets: spr, scaleX: spr.scaleX * 1.08, scaleY: spr.scaleY * 0.94, yoyo: true, repeat: 7, duration: 110 });
    // the arm: from the machine to just below your belt
    const bar = addCensorBar(this, p.spr, { pad: 2 });
    bar.obj.setDepth(p.spr.depth + 3);
    const bx = spr.x;
    const by = spr.y + 20;
    const tx = bar.obj.x;
    const ty = bar.obj.y;
    const ang = Math.atan2(ty - by, tx - bx);
    const len = Math.max(40, Math.hypot(tx - bx, ty - by) - 6);
    let arm: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.textures.exists("p_wonk_arm")) {
      arm = this.add.image(bx, by, "p_wonk_arm").setOrigin(0, 0.5).setRotation(ang).setFlipY(Math.cos(ang) < 0);
      arm.setDisplaySize(16, 56);
    } else arm = this.add.rectangle(bx, by, 16, 14, 0xb8b8b8).setOrigin(0, 0.5).setRotation(ang).setStrokeStyle(2, 0x333333);
    arm.setDepth(p.spr.depth + 2);
    await new Promise<void>((res) => this.tweens.add({ targets: arm, displayWidth: len, duration: 380, ease: "Back.out", onComplete: () => res() }));
    // ...and it gets to work
    synth.play("moan_men");
    this.time.delayedCall(900, () => synth.play("moan_men"));
    this.time.delayedCall(1500, () => synth.play("moan_men"));
    const work = this.tweens.add({ targets: arm, displayWidth: len - 14, angle: arm.angle + 4, yoyo: true, repeat: -1, duration: 90, ease: "Sine.inOut" });
    const jiggle = this.tweens.add({ targets: bar.obj, y: ty - 2, yoyo: true, repeat: -1, duration: 70 });
    this.floatText(p.x, p.y - 60, "*whirring*", "#cbd5e1", 13);
    await new Promise((r) => this.time.delayedCall(1600, r));
    work.stop();
    jiggle.stop();
    // done: the arm goes home, your Krezz is full
    await new Promise<void>((res) => this.tweens.add({ targets: arm, displayWidth: 16, duration: 260, ease: "Quad.in", onComplete: () => res() }));
    arm.destroy();
    bar.destroy();
    cam.zoomTo(z0, 300, "Cubic.easeOut", true);
    s.krezz = maxKrezz(s);
    // filled to the brim: wonk meter maxed too
    this.addWonk(1000);
    p.wonk = 100;
    synth.play("perfect");
    vfx(this, "vfx_stars", p.x, p.y - 30, { scale: 1.4, depth: p.spr.depth + 4 });
    this.toast("WONKING MACHINE", "WONK FULL. KREZZ FULL. Press R.");
    this.busy = false;
  }

  private async useVending(x: number, y: number) {
    const s = G.s;
    if (s.chapter === 3 && !s.flags.valves_done && this.dungeon.id === "ministry") {
      this.toast("VENDING", "OUT OF ORDER — Pussy juice pressure too low. Restore the valves.");
      return;
    }
    const iou = s.player === "KREZMAR" && s.upgrades.kz2;
    if (s.coins < 15 && !iou) {
      this.toast("VENDING", "Insufficient Krezzcoin. The machine judges you.");
      return;
    }
    if (s.coins >= 15) s.coins -= 15;
    const heal = 25 * (iou ? 2 : 1);
    s.hp = Math.min(maxHp(s), s.hp + heal);
    synth.play("gulp");
    this.floatText(x, y - 30, `+${heal} (vintage)`, "#ffb6c1", 14);
  }

  /** First dungeon ever: pause and explain the controls, specials and Kreddle. */
  private showTutorial(): Promise<void> {
    return new Promise((res) => {
      this.paused = true;
      this.events.once("ui-resume", () => res());
      this.scene.launch("Tutorial", { caller: "Dungeon" });
      this.scene.pause();
    });
  }

  private openTV() {
    this.paused = true;
    this.scene.launch("TV", { overlay: true, caller: "Dungeon" });
    this.scene.pause();
  }

  // ------------------------------------------------------------------ ban rules

  private setRule(rule: BanRule | null, fromBoss: boolean) {
    this.rule = rule;
    G.emit("rule", rule ? rule.decree : null);
    if (rule && fromBoss) {
      synth.play("decree");
      this.toast("NEW RULE", rule.decree);
    }
  }

  private ruleBroken(kind: BanRule["kind"]) {
    if (!this.rule || this.rule.kind !== kind) return;
    this.addRisk(this.rule.risk, this.rule.decree);
  }

  private addRisk(n: number, why: string) {
    if (this.dying || this.busy || G.rt.pit) return;
    const banned = addBanRisk(G.s, n);
    this.floatText(this.player.x, this.player.y - 46, `BAN RISK +${Math.round(n)}`, "#ff4444", 12);
    if (banned) this.getBanned(why);
  }

  private getBanned(why: string) {
    this.busy = true;
    synth.play("banhammer");
    this.shake(600, 0.03);
    const pct = this.boss ? this.boss.hp / this.boss.maxHp : undefined;
    const hammer = this.add.text(this.player.x, this.player.y - 300, "🔨", { fontSize: "140px" }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({
      targets: hammer,
      y: this.player.y - 40,
      duration: 350,
      ease: "Quad.in",
      onComplete: () => {
        this.cameras.main.flash(300, 255, 255, 255);
        this.time.delayedCall(500, () => {
          this.transitioning = true;
          switchTo(this, "Exile", { why, returnTo: { dungeon: this.dungeon.id, room: this.roomIdx, bossHpPct: pct } });
        });
      },
    });
  }

  private drongusDecree() {
    const p = this.player;
    const now = this.now();
    const decrees = [
      { t: "DODGING IS NOW ILLEGAL", f: () => (p.noDodgeUntil = now + 6000) },
      { t: "HEALING REQUIRES A PERMIT", f: () => (p.noHealUntil = now + 8000) },
      { t: "YOUR NAME HAS BEEN CHANGED", f: () => {
        p.invertUntil = now + 4000;
        const names = ["SCROTTO JUMBLIN", "CREAMY DINGUS", "GENTKO", "LULON SHELGOR", "BOGGOR CRANSTIL", "FROTHY KRELMOR"];
        G.emit("rename", names[Math.floor(Math.random() * names.length)]);
      } },
      { t: "ALL KREZZ BELONGS TO THE STATE", f: () => {
        G.s.krezz = 0;
        p.noSpecialUntil = now + 6000;
      } },
    ];
    const d = decrees[Math.floor(Math.random() * decrees.length)];
    d.f();
    synth.play("decree");
    this.toast("DECREE", d.t);
    this.floatText(this.boss?.x ?? p.x, (this.boss?.y ?? p.y) - 80, d.t, "#ffd23f", 18);
  }

  // ------------------------------------------------------------------ CombatWorld API

  /** Side-scrolling rooms: these float about; everything else walks. */
  private isFlyer(type: string) {
    const d = ENEMIES[type];
    return !!d && d.behavior !== "leaper" && d.behavior !== "turret" && (d.shape === "bubble" || d.shape === "ghost" || d.shape === "drone" || d.shape === "page" || d.behavior === "orbiter" || d.behavior === "blinker");
  }

  spawnEnemy(type: string, x: number, y: number, opts: { noDrops?: boolean; minion?: boolean } = {}): Enemy | null {
    if (!ENEMIES[type]) return null;
    if (this.enemies.filter((e) => !e.dead).length > 28) return null;
    const s = G.s;
    const dd = diffFor(s);
    const e = new Enemy(this, type, Phaser.Math.Clamp(x, this.bounds.left + 20, this.bounds.right - 20), Phaser.Math.Clamp(y, this.bounds.top + 20, this.bounds.bottom - 20), enemyHpMult(s) * dd.enemyHp);
    e.noDrops = !!opts.noDrops;
    e.minion = !!opts.minion;
    e.dmgMult = enemyDamageMult(s);
    e.speedMult = activeMods(s).enemySpeedMult * (s.ngPlus ? 1.1 : 1) * dd.enemySpeed;
    e.aggression = dd.aggression;
    const ps = this.pitEnemyScale();
    if (ps) {
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * ps.hp));
      e.dmgMult *= ps.dmg;
      e.speedMult *= ps.speed;
      e.aggression *= ps.aggression;
    }
    e.hpBar = this.add.graphics().setDepth(800);
    if (this.side) {
      (e as any).big = SIDE_BIG * 0.95;
      e.setScale(2);
      // run'n'gun: grunts pop quickly
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * 0.75));
    }
    e.setDepth(y);
    this.enemies.push(e);
    this.enemyGroup.add(e);
    // Da Drongus Dungeon and the finale: everything comes out of a rift (held still and harmless till it's through)
    if ((this.dungeon.id === "citadel" || this.dungeon.id === "krelford_finale") && !this.side && type !== "weapon_pod" && vfx(this, "fe_vfx_spawn", e.x, e.y + e.displayHeight * 0.35, { scale: Math.max(1, e.displayWidth / 60), depth: e.y - 1 })) {
      const now = this.now();
      e.setAlpha(0);
      e.stunUntil = Math.max(e.stunUntil, now + 650);
      e.contactCd = Math.max(e.contactCd, now + 750);
      this.time.delayedCall(560, () => {
        if (!e.active || e.dead) return;
        this.tweens.add({ targets: e, alpha: 1, duration: 140 });
        Juice.squash(this, e, 0.3, 300);
      });
    }
    if (this.side && ENEMIES[type].behavior === "turret") {
      // perched: no gravity, stays put
      const tb = e.body as Phaser.Physics.Arcade.Body;
      tb.setAllowGravity(false).setImmovable(true).setCollideWorldBounds(true);
    } else if (this.side && !this.isFlyer(type)) {
      e.walker = true;
      (e.body as Phaser.Physics.Arcade.Body).setGravityY(1500).setCollideWorldBounds(true);
    } else if (this.side) (e.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(type !== "weapon_pod");
    if (type === "weapon_pod") {
      // big, flashing and easy to pop, and never an elite
      (e as any).big = 2.4;
      e.setScale(2);
      e.hp = e.maxHp = 6;
      const glow = this.add.circle(e.x, e.y, 26, 0xfde047, 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(e.depth - 1);
      this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.05, yoyo: true, repeat: -1, duration: 300 });
      const tag = this.add.text(e.x, e.y - 34, "WEAPON POD", { fontFamily: FONT, fontSize: "10px", color: "#fde047", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(1500);
      const follow = this.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (!e.active || e.dead) { glow.destroy(); tag.destroy(); follow.remove(); return; }
        glow.setPosition(e.x, e.y);
        tag.setPosition(e.x, e.y - 34);
      } });
      return e;
    }
    if (ENEMIES[type].plate) {
      // a name plate over its head (chapter 7)
      const tag = this.add.text(e.x, e.y, ENEMIES[type].plate!, { fontFamily: "Impact, sans-serif", fontSize: "12px", color: ENEMIES[type].plateColor ?? "#ffffff", backgroundColor: "#000000bb", padding: { x: 4, y: 1 }, stroke: "#000", strokeThickness: 2 }).setOrigin(0.5).setDepth(1400);
      const follow = () => {
        if (!e.active || e.dead) {
          this.events.off("postupdate", follow);
          tag.destroy();
          return;
        }
        tag.setPosition(e.x, e.y - e.displayHeight / 2 - 6);
      };
      this.events.on("postupdate", follow);
      this.events.once("shutdown", () => this.events.off("postupdate", follow));
    }
    this.spice?.onSpawn(e, opts);
    return e;
  }

  damageEnemy(e: Enemy, amount: number, opts: HitOpts = {}) {
    if (e.dead) return;
    const now = this.now();
    let a = amount;
    if (now < e.markedUntil) a *= 1.35;
    if (e instanceof Boss) {
      a = e.incoming(a, { source: opts.source });
      if (a <= 0 && !e.shielded) return;
    }
    if (opts.fixed) a = amount;
    if (e instanceof Boss && e.shielded) {
      if (opts.label !== "" && Math.random() < 0.3) this.floatText(e.x, e.y - 40, "SHIELDED", "#88aaff", 12);
      return;
    }
    // shield phases (BossShield.ts): immune while it's up, bonus while it's down, clamped at each threshold
    if (e instanceof Boss && e.guard) {
      a = e.guard.damage(a, opts);
      if (a <= 0) return;
    }
    if ((e as Enemy & { dummy?: boolean }).dummy) this.rangeHit(a);
    const hpBefore = e.hp;
    e.hp -= a;
    e.flashUntil = now + 70;
    if (e instanceof Boss && EPIC_BOSSES[e.bossId] && !OWN_PHASE_BREAKS.has(e.bossId) && e.hp > 0 && hpBefore > e.maxHp * 0.5 && e.hp <= e.maxHp * 0.5) this.epicPhasePulse(e);
    if (extraViolence(G.s) && a > 0 && now - this.lastSplat > 45) {
      this.lastSplat = now;
      this.splatter(e.x, e.y, e.isBoss ? 5 : 3, 0.7);
    }
    if (opts.stun) e.stunUntil = Math.max(e.stunUntil, now + (e.isBoss ? opts.stun * 0.25 : opts.stun));
    if (opts.mark) e.markedUntil = now + 6000;
    if (opts.slow) {
      e.slowUntil = now + 2000;
      e.slowAmt = opts.slow;
    }
    if (opts.knock && !e.isBoss) {
      const ang = opts.angle ?? Math.atan2(e.y - this.player.y, e.x - this.player.x);
      const body = e.body as Phaser.Physics.Arcade.Body;
      body.velocity.x += Math.cos(ang) * opts.knock;
      body.velocity.y += Math.sin(ang) * opts.knock;
      e.stunUntil = Math.max(e.stunUntil, now + 120);
    }
    if (opts.label !== "") {
      const txt = opts.label ?? String(Math.max(1, Math.round(a)));
      this.floatText(e.x + (Math.random() - 0.5) * 16, e.y - 20, txt, opts.label === "99" ? "#ff2a2a" : opts.crit ? "#ffd23f" : "#ffffff", opts.label === "99" ? 24 : opts.crit ? 18 : 13);
      synth.play(opts.crit ? "crit" : "hit");
      if (opts.crit) this.hitStop(50);
      // a drawn hit spark where it landed (throttled so a minigun doesn't paint the room)
      if (now - this.lastHitFx > 45 || opts.crit) {
        this.lastHitFx = now;
        vfx(this, opts.crit ? "vfx_crit" : "vfx_hit", e.x + (Math.random() - 0.5) * 10, e.y - 6 + (Math.random() - 0.5) * 10, { scale: opts.crit ? 1 : 0.8, depth: e.depth + 3 });
      }
    }
    if (!opts.noWonk) {
      // meters fill with time spent landing hits, not raw hit count (so a gatling isn't a cheat code)
      const now2 = this.now();
      const k = Phaser.Math.Clamp((now2 - this.lastMeterHit) / 240, 0.15, 1);
      this.lastMeterHit = now2;
      const up2 = G.s.upgrades;
      this.addWonk(Math.min(3, 0.3 + a * 0.05) * k * (1 + 0.15 * (up2.pk_jet ?? 0)));
      const up = addFart((0.3 + Math.min(1.2, a * 0.03)) * k * (1 + 0.3 * (up2.pk_meter ?? 0)) * (1 + 0.15 * (up2.pk_ibs ?? 0)));
      if (up) this.fartLevelUp(up);
    }
    if (e.hp <= 0) {
      // kills made by farts and auras don't refill the fart meter
      if (opts.noWonk) (e as any).noFartKill = true;
      this.killEnemy(e);
    }
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    const s = G.s;
    // its own drawn death (melting, flopping, exploding), unless the gore's on (then it gets dismembered as usual)
    const drawnDeath = !e.isBoss && !extraViolence(s) && e.hasDeathAnim;
    if (drawnDeath) e.dieAnimated();
    else e.kill();
    this.enemies = this.enemies.filter((x) => x !== e);
    bump(s, "kills_total");
    if (e.def.counter) bump(s, e.def.counter);
    if (!e.isBoss) this.addWonk(2);
    this.spice?.onKill(e);
    // a tiny freeze and a pop on every kill (rate-limited so swarms don't stutter)
    if (!e.isBoss && this.now() - this.lastKillStop > 140) {
      this.lastKillStop = this.now();
      this.hitStop(e.def.size >= 16 ? 45 : 25);
      this.shake(80, e.def.size >= 16 ? 0.004 : 0.002);
    }
    if (!e.isBoss && !drawnDeath && !vfx(this, "vfx_pixeldeath", e.x, e.y, { scale: Math.max(0.6, e.def.size / 18), depth: 1400 })) {
      const ring = this.add.circle(e.x, e.y, 6, 0xffffff, 0).setStrokeStyle(3, e.def.accent, 0.9).setDepth(1400);
      this.tweens.add({ targets: ring, radius: 30, alpha: 0, duration: 200, onComplete: () => ring.destroy() });
    }
    if (!(e as any).noFartKill) {
      const up = addFart(2.6 * (1 + 0.15 * (G.s.upgrades.pk_ibs ?? 0)));
      if (up) this.fartLevelUp(up);
    }
    if (e.def.id === "weapon_pod") {
      this.weaponPod(e.x, e.y);
      return;
    }
    if (e.def.id === "fuel_tank") {
      this.events.emit("fuel-tank-dead", e.x, e.y);
      return;
    }
    if (extraViolence(s) && !e.isBoss) {
      this.dismember(e);
      // the Kreddle BLOOD BATH prize: now and then it hits the lens
      if (kd(s, "kd_violence") > 0 && Math.random() < 0.18) this.screenSplat(2);
    }
    else if (!drawnDeath && (e.isBoss || !hasVfx(this, "vfx_pixeldeath"))) this.burst(e.x, e.y, e.def.color, e.isBoss ? 30 : 8);
    // a kill has its own little pop (not every one in a swarm)
    if (!e.isBoss && this.now() - this.lastKillPop > 90) {
      this.lastKillPop = this.now();
      synth.play(extraViolence(s) ? "splat" : "pop");
    }
    if (e instanceof HeroPassenger) {
      this.heroPaxDown(e);
      return;
    }
    if (e instanceof Boss) {
      this.boss = null;
      this.onBossDefeated(e);
      return;
    }
    if (!e.noDrops) {
      const mods = activeMods(s);
      const dd = diffFor(s);
      let coins = Math.round(e.def.coins * mods.coinMult * (s.player === "KREZMAR" ? 1.35 : 1) * (1 + 0.25 * kd(s, "kd_lucky")) * dd.coins * this.pitCoinMult());
      while (coins > 0) {
        const v = Math.min(coins, 3);
        this.dropPickup(e.x + (Math.random() - 0.5) * 20, e.y + (Math.random() - 0.5) * 20, "coin", v);
        coins -= v;
      }
      if (Math.random() < 0.6) this.dropPickup(e.x, e.y, "krezz", e.def.krezz);
      if (Math.random() < 0.06 * dd.healDrops) this.dropPickup(e.x, e.y, "heal", 12);
      if (mods.crobleys && Math.random() < 0.12) this.dropPickup(e.x, e.y, "crobley", 1);
      if (Math.random() < 0.02) this.dropPickup(e.x, e.y, "bongo", 1);
      if (ownedGuns().length) {
        // more often when you're running low; a guaranteed one after a dry spell
        this.ammoDry++;
        const chance = e.isBoss ? 1 : (this.ammoLow() ? 0.4 : 0.22) * dd.ammoDrops;
        if (Math.random() < chance || this.ammoDry >= dd.ammoDryKills) {
          this.ammoDry = 0;
          this.dropPickup(e.x + 10, e.y, "ammo", 1);
        }
      }
      if (mods.splitChance && !e.minion && Math.random() < mods.splitChance) {
        const w = this.spawnEnemy(e.def.id, e.x + 20, e.y, { noDrops: true, minion: true });
        if (w) {
          w.setTint(0x6b21a8);
          w.hp = w.maxHp = Math.round(w.maxHp * 0.5);
          this.floatText(e.x, e.y - 30, "WALUIGI VERSION", "#a855f7", 12);
        }
      }
    }
    if (Math.random() < 0.08) this.player.bark();
  }

  /** Real-clock time until which you can't be hurt: you're mid weapon-swap (tap or picker). */
  private swapSafeUntil = 0;

  damagePlayer(amount: number, from?: { x: number; y: number }, opts: { unblockable?: boolean; label?: string } = {}) {
    if (this.dying || this.busy) return;
    // nothing touches you while you're changing weapon
    if (this.picking || performance.now() < this.swapSafeUntil) return;
    const now = this.now();
    const p = this.player;
    if (!opts.unblockable && p.invulnerable(now)) {
      if (now < p.iframesUntil) p.perfectDodge();
      return;
    }
    if (opts.unblockable) p.iframesUntil = 0;
    const took = p.takeHit(amount, now);
    if (!took) return;
    // in the last dungeon and the finale: you visibly flinch (a squash, a red flash, a jolt away from the hit)
    if (this.dungeon.id === "citadel" || this.dungeon.id === "krelford_finale") this.flinch(from);
    this.floatText(p.x, p.y - 30, opts.label ?? `-${Math.round(amount)}`, "#ff4444", 15);
    if (now - this.lastHurtSfx > 120) {
      synth.play("hurt");
      this.lastHurtSfx = now;
    }
    this.shake(120, 0.008);
    p.spr.setTintFill(0xff0000);
    this.time.delayedCall(80, () => p.spr.clearTint());
    if (from && p.id !== "GRONNY") {
      const a = Math.atan2(p.y - from.y, p.x - from.x);
      (p.spr.body as Phaser.Physics.Arcade.Body).velocity.add(new Phaser.Math.Vector2(Math.cos(a) * 160, Math.sin(a) * 160));
    }
    if (G.s.hp < maxHp(G.s) * 0.25) G.drongus("low_hp");
    if (G.s.hp <= 0) this.die();
  }

  shoot(x: number, y: number, o: ShotOpts): Phaser.Physics.Arcade.Sprite {
    if (this.side && o.owner === "enemy") {
      // run'n'gun fairness: nobody off-screen shoots you, enemy bullets are slower and big and bright,
      // and there are never too many on screen at once
      const v = this.cameras.main.worldView;
      const live = this.shots.filter((sh) => sh.o.owner === "enemy").length;
      if (live >= 9 || x < v.x - 30 || x > v.right + 30 || y < v.y - 30 || y > v.bottom + 30) o = { ...o, life: 1 };
      o = { ...o, speed: o.speed * 0.8, scale: (o.scale ?? 1) * 1.25 };
    }
    // difficulty: enemy bullets a touch slower or quicker
    if (o.owner === "enemy") {
      const ps = diffFor(G.s).projectileSpeed;
      if (ps !== 1) o = { ...o, speed: o.speed * ps };
    }
    // run'n'gun: your bullets should snap across the screen, not drift (slow guns felt awful side-on)
    if (this.side && o.owner === "player") o = { ...o, speed: Math.max(o.speed * 1.7, 950) };
    const tex = o.texture ?? "fx_bullet";
    const spr = this.add.image(x, y, tex).setDepth(600).setScale((o.scale ?? 1) * (o.owner === "enemy" ? 1.8 : 1.6)).setTint(o.color ?? 0xffffff);
    spr.setRotation(o.angle);
    this.shots.push({ spr, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed, life: o.life ?? 2000, o, hit: new Set() });
    return spr as unknown as Phaser.Physics.Arcade.Sprite;
  }

  private killShot(sh: Shot) {
    sh.spr.destroy();
    this.shots = this.shots.filter((x) => x !== sh);
  }

  aoe(x: number, y: number, r: number, dmg: number, opts: HitOpts & { color?: number } = {}): number {
    if (opts.color !== undefined && !vfx(this, "vfx_shock", x, y + 4, { scale: (r * 2) / 100, depth: 6, tint: opts.color })) {
      const c = this.add.image(x, y, "fx_circle").setTint(opts.color).setAlpha(0.45).setDepth(5).setScale((r * 2) / 64);
      this.tweens.add({ targets: c, alpha: 0, scale: c.scale * 1.15, duration: 280, onComplete: () => c.destroy() });
    }
    let n = 0;
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= r + e.radius) {
        this.damageEnemy(e, dmg, { ...opts, angle: Math.atan2(e.y - y, e.x - x) });
        n++;
      }
    }
    if (this.boss instanceof DrongusBoss) this.boss.hitSong(x, y, r);
    if (dmg > 0) this.spice?.hitAoe(x, y, r, dmg);
    if (dmg > 0) this.dress?.aoe(x, y, r);
    if (dmg > 0) this.roof?.hitAoe(x, y, r, dmg);
    return n;
  }

  enemyAoe(x: number, y: number, r: number, dmg: number, delayMs: number, color = 0xff3333) {
    const ring = this.add.circle(x, y, r, color, 0.12).setStrokeStyle(2, color, 0.9).setDepth(4);
    const fill = this.add.circle(x, y, 1, color, 0.3).setDepth(4);
    this.tweens.add({ targets: fill, radius: r, duration: delayMs });
    this.time.delayedCall(delayMs, () => {
      this.tweens.killTweensOf(fill);
      ring.destroy();
      fill.destroy();
      if (!this.player || this.player.dead) return;
      // the attack lands: green ones are gas, the rest a shockwave
      const green = ((color >> 8) & 255) > ((color >> 16) & 255) + 40;
      if (!vfx(this, green ? "vfx_fart" : "vfx_shock", x, y + 4, { scale: (r * 2) / (green ? 80 : 100), depth: 6, tint: green ? undefined : color })) {
        const fx = this.add.image(x, y, "fx_circle").setTint(color).setAlpha(0.6).setDepth(5).setScale((r * 2) / 64);
        this.tweens.add({ targets: fx, alpha: 0, duration: 250, onComplete: () => fx.destroy() });
      }
      if (dmg > 0 && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < r + 6) this.damagePlayer(dmg, { x, y });
    });
  }

  enemyLine(x: number, y: number, angle: number, len: number, width: number, dmg: number, delayMs: number) {
    const g = this.add.graphics().setDepth(4);
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    g.lineStyle(width, 0xff3333, 0.18).lineBetween(x, y, ex, ey);
    g.lineStyle(2, 0xff3333, 0.8).lineBetween(x, y, ex, ey);
    this.time.delayedCall(delayMs, () => {
      g.destroy();
      if (dmg <= 0 || !this.player) return;
      const fx = this.add.graphics().setDepth(5);
      fx.lineStyle(width, 0xffaaaa, 0.7).lineBetween(x, y, ex, ey);
      this.tweens.add({ targets: fx, alpha: 0, duration: 250, onComplete: () => fx.destroy() });
      const line = new Phaser.Geom.Line(x, y, ex, ey);
      const pt = Phaser.Geom.Line.GetNearestPoint(line, new Phaser.Geom.Point(this.player.x, this.player.y));
      if (Phaser.Math.Distance.Between(pt.x, pt.y, this.player.x, this.player.y) < width / 2 + 8) this.damagePlayer(dmg, { x: pt.x, y: pt.y });
    });
  }

  /** When the KIDS choir can next chant. */
  private chantFreeAt = 0;
  /** When a shouting boss can next say a taunt out loud. */
  private bossVoiceFreeAt = 0;

  /** An enemy shouts one of its lines. The ones that never shut up (shoutEvery) get a proper speech bubble that follows them. */
  private enemyShout(e: Enemy) {
    const lines = e.def.shout ?? [];
    const line = lines[Math.floor(Math.random() * lines.length)];
    if (!line) return;
    // the KIDS demons chant out loud, as a goblin choir (one chant at a time, not a wall of noise)
    if (/KIDS/.test(line) && this.time.now > this.chantFreeAt) {
      this.chantFreeAt = this.time.now + 2600 + Math.random() * 1800;
      synth.shout("mind_kids", e.isBoss ? 0.95 : 0.7, 0.92 + Math.random() * 0.2);
    }
    // a boss's taunts are said out loud too (every 8s or so, not every bubble)
    if (e.isBoss && this.time.now > this.bossVoiceFreeAt) {
      const who = Object.values(BOSS_TEXT).find((b) => b.taunts?.includes(line));
      if (who) {
        this.bossVoiceFreeAt = this.time.now + 7000 + Math.random() * 3000;
        void voice.layer(who.name, line, 1);
      }
    }
    if (!e.def.shoutEvery) {
      this.floatText(e.x, e.y - 30, line, e.def.id === "tumor" ? "#e9d5ff" : "#ffffff", e.def.id === "tumor" ? 14 : 11);
      return;
    }
    const bubbles = ((this as any).shoutBubbles ??= new Map<Enemy, Phaser.GameObjects.Container>()) as Map<Enemy, Phaser.GameObjects.Container>;
    bubbles.get(e)?.destroy();
    const big = e.isBoss;
    const t = this.add.text(0, 0, line, { fontFamily: "Impact, sans-serif", fontSize: big ? "22px" : "14px", color: "#b0003a" }).setOrigin(0.5);
    const w = t.width + 14;
    const h = t.height + 8;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, -2, h / 2 + 9);
    g.lineStyle(2, 0x111111, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    const off = () => e.displayHeight / 2 + h / 2 + 8;
    const c = this.add.container(e.x, e.y - off(), [g, t]).setDepth(1490).setScale(0.3);
    bubbles.set(e, c);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: "Back.out" });
    const follow = () => {
      if (!c.active) return;
      if (e.dead || !e.active) return c.destroy();
      c.setPosition(e.x, e.y - off());
    };
    this.events.on("postupdate", follow);
    c.once("destroy", () => {
      this.events.off("postupdate", follow);
      if (bubbles.get(e) === c) bubbles.delete(e);
    });
    this.time.delayedCall(big ? 1300 : 950, () => c.active && this.tweens.add({ targets: c, alpha: 0, duration: 180, onComplete: () => c.destroy() }));
  }

  floatText(x: number, y: number, text: string, color = "#ffffff", size = 13) {
    if (!text.trim()) return;
    let t = text;
    if (this.now() < this.conflictUntil && /^\d+$/.test(t)) t = String(Math.round(Number(t) * (0.5 + Math.random())));
    const tx = this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold" }).setOrigin(0.5).setDepth(1500).setStroke("#000000", 3);
    this.tweens.add({ targets: tx, y: y - 34, alpha: 0, duration: 900, ease: "Quad.out", onComplete: () => tx.destroy() });
  }

  shake(ms: number, intensity: number) {
    if (SHAKE()) this.cameras.main.shake(ms, intensity);
  }

  private lastFlinch = 0;
  private flinch(from?: { x: number; y: number }) {
    const ps = this.player.spr;
    const now = this.now();
    if (now - this.lastFlinch < 220) return;
    this.lastFlinch = now;
    Juice.squash(this, ps, -0.22, 260);
    const a = from ? Math.atan2(ps.y - from.y, ps.x - from.x) : 0;
    const dx = Math.cos(a) * 6;
    this.tweens.add({ targets: ps, angle: { from: dx > 0 ? 10 : -10, to: 0 }, duration: 240, ease: "Back.out" });
    const red = this.add.circle(ps.x, ps.y, 22, 0xff2a2a, G.meta?.settings?.calmFlash ? 0.15 : 0.35).setDepth(ps.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: red, alpha: 0, scale: 1.6, duration: 220, onComplete: () => red.destroy() });
  }

  hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.now() + ms);
  }

  private fartLevelUp(level: number) {
    synth.play("fart_ready");
    const names = ["", "FAIRY FART READY", "BAKED BEANS READY", "CABBAGE READY", "IBS ATTACK READY!!"];
    this.floatText(this.player.x, this.player.y - 58, `💨 ${names[level]}`, level === 4 ? "#d4ff3a" : "#9ccc65", level === 4 ? 18 : 13);
    if (level === 4) this.toast("💨 IBS ATTACK READY", "Press G (or the 💨 button) to unleash it.");
  }

  addWonk(n: number) {
    if (!this.player) return;
    const mult = this.boss instanceof DrongusBoss && this.boss.phase === 2 ? 1.6 : 1;
    const before = this.player.wonk;
    this.player.wonk = Math.min(100, this.player.wonk + n * mult * (1 + 0.3 * (G.s.upgrades.pk_meter ?? 0)));
    if (before < 100 && this.player.wonk >= 100) {
      synth.play("wonk");
      this.floatText(this.player.x, this.player.y - 50, "WONK FULL — R: WONK YOUR THANG", "#ff8c00", 15);
    }
  }

  toast(title: string, text: string) {
    G.emit("toast", { title, text });
  }

  nearestEnemy(x: number, y: number, maxDist = 9999, exclude?: Enemy): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist;
    for (const e of this.enemies) {
      if (e.dead || e === exclude) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  burst(x: number, y: number, color: number, n = 8) {
    if (vfx(this, "vfx_sparks", x, y, { scale: Math.min(1.4, 0.4 + n / 20), depth: 700, tint: color === 0xffffff ? undefined : color })) return;
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x, y, "fx_dot").setTint(color).setDepth(700).setScale(1 + Math.random());
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 60;
      this.tweens.add({ targets: d, x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp, alpha: 0, duration: 400 + Math.random() * 300, onComplete: () => d.destroy() });
    }
  }

  dropPickup(x: number, y: number, kind: Pickup["kind"], value: number) {
    const tex = { coin: "p_coin", krezz: "p_krezz", heal: "p_bottle", crobley: "p_crobley", quest: "p_scroll", bottle: "p_bottle", bongo: "p_bongo", ammo: "p_ammo" }[kind];
    const spr = this.add.image(x, y, this.textures.exists(tex) ? tex : "p_coin").setScale(2).setDepth(15);
    if (kind === "ammo") fitTo(spr, 26);
    if (this.side && !this.room.tower && y < this.groundY - 16) this.tweens.add({ targets: spr, y: this.groundY - 14, duration: 200 + (this.groundY - y) * 1.2, ease: "Bounce.out" });
    else this.tweens.add({ targets: spr, y: y - 8, yoyo: true, duration: 220 });
    this.pickups.push({ spr, kind, value });
  }

  // ------------------------------------------------------------------ helpers

  /** THE CUM CRYSTAL IS YOURS! YEAH! The drawn shot of it held up high (skippable), then the party. */
  private async crystalGet(b: Boss): Promise<void> {
    if (!carriesCrystal(b.bossId) || G.s.flags[`crystal_${b.bossId}`]) return;
    await playCine(this, "crystal");
    // (a cutscene overlay pauses the room and it's resumed a frame or so later: wait for that rather than skip the
    // whole crystal moment, jingle and all, because the room was still paused when we looked; only give up if it's gone)
    for (let i = 0; i < 120 && this.sys && this.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 25));
    if (this.sys && (this.sys.isActive() || this.sys.isPaused())) await this.crystalParty(b);
  }

  /** Every main boss drops one: a big, loud, sparkly moment. */
  private crystalParty(b: Boss): Promise<void> {
    const s = G.s;
    if (!carriesCrystal(b.bossId) || s.flags[`crystal_${b.bossId}`]) return Promise.resolve();
    s.flags[`crystal_${b.bossId}`] = true;
    G.save();
    const n = crystalCount(s);
    const D = 9500;
    const cam = this.cameras.main;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T) => (objs.push(o), o);
    const fix = <T extends Phaser.GameObjects.GameObject & { setScrollFactor: (n: number) => T; setDepth: (n: number) => T }>(o: T, d = 0) => keep(o.setScrollFactor(0).setDepth(5000 + d));
    synth.music("crystal", true);
    cam.flash(400, 255, 255, 255);
    cam.shake(400, 0.012);
    // the room goes dark purple, and light rays spin out from the middle
    const dim = fix(this.add.rectangle(480, 270, 960, 540, 0x1a0630, 0));
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 400 });
    const rays = fix(this.add.container(480, 230), 1);
    const cols = [0xf472b6, 0xfde047, 0x67e8f9, 0xffffff, 0xc084fc, 0x86efac];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const t = this.add.triangle(0, 0, 0, 0, Math.cos(a - 0.09) * 700, Math.sin(a - 0.09) * 700, Math.cos(a + 0.09) * 700, Math.sin(a + 0.09) * 700, cols[i % cols.length], 0.3).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
      rays.add(t);
    }
    rays.setScale(0);
    this.tweens.add({ targets: rays, scale: 1, duration: 600, ease: "Back.out" });
    for (let i = 0; i < 3; i++) {
      const c = vfx(this, "vfx_confetti", 300 + i * 180, 260, { fixed: true, depth: D + 30, scale: 2.6, delay: 250 + i * 220 });
      if (c) objs.push(c);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    // the crystal flies out of the boss and up to the middle of the screen
    const start = cam.getWorldPoint(0, 0);
    const bx = Phaser.Math.Clamp(b.x - start.x, 40, 920);
    const by = Phaser.Math.Clamp(b.y - start.y, 40, 500);
    const glow = fix(this.add.circle(480, 230, 70, 0xfbcfe8, 0.45).setBlendMode(Phaser.BlendModes.ADD), 2);
    glow.setScale(0);
    const gem = fix(this.textures.exists("cum_crystal") ? this.add.image(bx, by, "cum_crystal").setScale(0.6) : this.add.text(bx, by, "💎", { fontSize: "40px" }).setOrigin(0.5), 3) as Phaser.GameObjects.Image;
    this.tweens.add({ targets: gem, x: 480, y: 230, scale: 3.2, duration: 900, ease: "Cubic.out", onComplete: () => {
      synth.play("ding");
      cam.flash(250, 255, 240, 250);
      this.tweens.add({ targets: glow, scale: { from: 0.6, to: 1.5 }, alpha: { from: 0.55, to: 0.25 }, yoyo: true, repeat: -1, duration: 450 });
      this.tweens.add({ targets: gem, y: 215, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
      this.tweens.add({ targets: gem, scaleX: { from: 3.2, to: -3.2 }, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
      // sparkles burst out
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = fix(this.add.text(480, 230, Math.random() < 0.5 ? "✨" : "⭐", { fontSize: `${14 + Math.floor(Math.random() * 18)}px` }).setOrigin(0.5), 4);
        this.tweens.add({ targets: sp, x: 480 + Math.cos(a) * (150 + Math.random() * 300), y: 230 + Math.sin(a) * (100 + Math.random() * 220), alpha: 0, angle: 360, duration: 1100 + Math.random() * 700, ease: "Cubic.out" });
      }
    } });
    // the words, letter by letter, bouncing in rainbow
    const line1 = "THE CUM CRYSTAL IS YOURS!";
    const w = 30;
    const x0 = 480 - (line1.length * w) / 2 + w / 2;
    [...line1].forEach((ch, i) => {
      const t = fix(this.add.text(x0 + i * w, 400, ch, { fontFamily: "Impact, sans-serif", fontSize: "46px", color: "#" + cols[i % cols.length].toString(16).padStart(6, "0"), stroke: "#2a0f3d", strokeThickness: 8 }).setOrigin(0.5).setScale(0), 6) as Phaser.GameObjects.Text;
      this.tweens.add({ targets: t, scale: 1, delay: 900 + i * 45, duration: 260, ease: "Back.out", onComplete: () => this.tweens.add({ targets: t, y: 388, yoyo: true, repeat: -1, duration: 300, delay: i * 40, ease: "Sine.inOut" }) });
    });
    const yeah = fix(this.add.text(480, 462, "YEAH!", { fontFamily: "Impact, sans-serif", fontSize: "64px", color: "#fde047", stroke: "#db2777", strokeThickness: 10 }).setOrigin(0.5).setScale(0), 6) as Phaser.GameObjects.Text;
    this.time.delayedCall(2200, () => {
      synth.play("boom");
      cam.shake(350, 0.02);
      this.tweens.add({ targets: yeah, scale: 1.25, angle: { from: -20, to: -6 }, duration: 300, ease: "Back.out", onComplete: () => this.tweens.add({ targets: yeah, scale: 1.05, angle: 6, yoyo: true, repeat: -1, duration: 220 }) });
    });
    // the tally: six slots along the top
    CRYSTAL_BOSSES.forEach((_, i) => {
      const x = 480 + (i - 2.5) * 56;
      fix(this.add.rectangle(x, 46, 40, 48, 0x0b0612, 0.9).setStrokeStyle(2, 0xc084fc), 5);
      if (i < n && this.textures.exists("cum_crystal")) {
        const c = fix(this.add.image(x, 46, "cum_crystal").setScale(i === n - 1 ? 0 : 0.75), 6) as Phaser.GameObjects.Image;
        if (i === n - 1) this.tweens.add({ targets: c, scale: 0.75, delay: 1600, duration: 400, ease: "Back.out" });
      }
    });
    const tally = fix(this.add.text(480, 86, n >= CRYSTALS_NEEDED ? "ALL SIX! DA DRONGUS DUNGEON IS OPEN!" : `CUM CRYSTALS: ${n}/${CRYSTALS_NEEDED}  ·  Da Drongus Dungeon's seal weakens`, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0), 6);
    this.tweens.add({ targets: tally, alpha: 1, delay: 1700, duration: 300 });
    // confetti and fireworks the whole way through
    const confetti = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      const c = fix(this.add.rectangle(Math.random() * 960, -10, 6, 10, cols[Math.floor(Math.random() * cols.length)]), 4);
      this.tweens.add({ targets: c, y: 560, x: c.x + (Math.random() - 0.5) * 200, angle: 720, duration: 2200 + Math.random() * 1200, onComplete: () => c.destroy() });
    } });
    const fireworks = this.time.addEvent({ delay: 650, loop: true, callback: () => {
      const fx = 120 + Math.random() * 720;
      const fy = 80 + Math.random() * 200;
      const col = cols[Math.floor(Math.random() * cols.length)];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const p = fix(this.add.circle(fx, fy, 3, col).setBlendMode(Phaser.BlendModes.ADD), 1);
        this.tweens.add({ targets: p, x: fx + Math.cos(a) * 90, y: fy + Math.sin(a) * 90 + 20, alpha: 0, duration: 800, ease: "Cubic.out", onComplete: () => p.destroy() });
      }
    } });
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        confetti.remove();
        fireworks.remove();
        this.input.off("pointerdown", skip);
        this.input.keyboard?.off("keydown", skip);
        this.tweens.add({ targets: objs, alpha: 0, duration: 400, onComplete: () => { for (const o of objs) o.destroy(); resolve(); } });
      };
      const skip = () => { if (this.time.now - t0 > 3000) finish(); };
      const t0 = this.time.now;
      this.input.on("pointerdown", skip);
      this.input.keyboard?.on("keydown", skip);
      this.time.delayedCall(D, finish);
    });
  }

  private talk(lines: Line[]): Promise<void> {
    this.paused = true;
    const t0 = Date.now();
    // "YOU" in boss scripts means whoever you're playing as
    lines = lines.map((l) => (l.s === "YOU" ? { ...l, s: G.s.player } : l));
    return runDialogue(this, lines).then(() => {
      if (G.rt.timerEnd) G.rt.timerEnd += Date.now() - t0;
      this.controls?.swallow();
      this.paused = false;
    });
  }

  /** A bottled fairy: out she comes, round you she goes, and you're back on your feet. Once per dungeon visit. */
  private fairyRevive() {
    const s = G.s;
    G.rt.fairyUsed = true;
    s.hp = maxHp(s);
    const p = this.player;
    p.iframesUntil = this.now() + 2500;
    G.save();
    this.hitStop(120);
    this.cameras.main.flash(400, 255, 200, 240);
    [1047, 1319, 1568, 2093].forEach((f, i) => this.time.delayedCall(i * 110, () => synth.play("ding")));
    synth.play("perfect");
    this.bigText("A FAIRY REVIVES YOU!", "#ff9ad5", 34);
    const fairy = this.add.container(p.x, p.y).setDepth(980);
    const glow = this.add.circle(0, 0, 16, 0xffc0eb, 0.45).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.add.circle(0, 0, 6, 0xffffff);
    const wl = this.add.ellipse(-8, -4, 12, 18, 0xbfe9ff, 0.8);
    const wr = this.add.ellipse(8, -4, 12, 18, 0xbfe9ff, 0.8);
    fairy.add([glow, wl, wr, body]);
    this.tweens.add({ targets: [wl, wr], scaleX: 0.3, yoyo: true, repeat: -1, duration: 60 });
    const t0 = this.time.now;
    const orbit = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      const a = (this.time.now - t0) / 140;
      const r = 46 - Math.min(30, (this.time.now - t0) / 60);
      fairy.setPosition(p.x + Math.cos(a) * r, p.y - 10 + Math.sin(a) * r * 0.6);
      if (Math.random() < 0.6) {
        const sp = this.add.star(fairy.x, fairy.y, 4, 1.5, 4, [0xffc0eb, 0xffffff, 0xbfe9ff][Math.floor(Math.random() * 3)]).setDepth(979).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: sp, y: sp.y + 20, alpha: 0, duration: 600, onComplete: () => sp.destroy() });
      }
    } });
    this.time.delayedCall(1800, () => {
      orbit.remove();
      this.tweens.add({ targets: fairy, y: fairy.y - 200, alpha: 0, duration: 600, onComplete: () => fairy.destroy() });
    });
    this.toast("SAVED BY A FAIRY", "Full health. She's spent for this dungeon: she'll be back in the bottle next time you walk in.");
  }

  private die() {
    if (this.dying) return;
    // the test range: nobody dies at the range
    if (G.rt.pit?.mode === "range") {
      G.s.hp = maxHp(G.s);
      this.player.iframesUntil = this.now() + 1500;
      this.cameras.main.flash(250, 255, 255, 255);
      this.bigText("RESPAWNED (IT'S A RANGE)", "#fde68a", 28);
      return;
    }
    if ((G.s.upgrades.fairies ?? 0) > 0 && !G.rt.fairyUsed && this.player && !this.player.dead) {
      this.fairyRevive();
      return;
    }
    this.dying = true;
    this.player.dead = true;
    this.deathSequence();
  }

  /**
   * The player goes down: a short (~2.2 s), loud, stupid death before the KREZZED menu. Gore on: freeze-frame, red flash,
   * the drawn collapse, a burst of blood and bits in slow-mo, a push-in on the body. Gore off: a comic knockout (spin,
   * stars, flop, puff of smoke). The world is frozen throughout and `dying` blocks input, damage and a second death.
   */
  private deathSequence() {
    const p = this.player;
    const spr = p.spr;
    const cam = this.cameras.main;
    const gore = G.meta.settings.gore !== false;
    // whatever slow-mo or picker was running is over; nothing else may move
    if (this.picking) {
      this.picking = false;
      this.scene.stop("WeaponPick");
    }
    this.epicSlowToken++;
    this.setSlowmo(1);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.physics.world.pause();
    for (const e of this.enemies) if (e.active) e.anims?.pause();
    p.gunSpr?.setVisible(false);
    spr.setAlpha(1);
    this.tweens.killTweensOf(spr);
    // the drawn collapse, if the character has one
    const meta = charMeta(this, spr.texture.key);
    const f = (spr.getData("facing") as string) ?? "south";
    const sideOn = f === "east" || f === "west";
    const fall = meta?.death ? ((sideOn ? meta.death.east : meta.death.south) ?? meta.death.east ?? meta.death.south) : undefined;
    const collapse = (at: number, step: number) => {
      if (fall?.length) {
        spr.setFlipX(f === "west");
        fall.forEach((fr, i) => this.time.delayedCall(at + i * step, () => spr.active && spr.setFrame(fr)));
        return at + fall.length * step;
      }
      this.time.delayedCall(at, () => spr.active && this.tweens.add({ targets: spr, angle: f === "west" ? -90 : 90, duration: 260, ease: "Bounce.out" }));
      return at + 260;
    };
    const feet = () => spr.getBounds().bottom - 4;
    const mid = () => spr.getBounds().centerY;
    // push in on the body
    cam.zoomTo(Math.max(cam.zoom, 1) * 1.45, 380, "Cubic.easeOut", true);
    const END = 2250; // the menu arrives here: everything above stays inside it
    if (gore) {
      // 0: freeze-frame on the killing blow, the screen goes red
      synth.play("punch_big");
      synth.play("bonecrack");
      Juice.flash(this, 0xff0000, 260, 0.55);
      this.time.delayedCall(90, () => spr.active && spr.setTintFill(0xffffff));
      // 200: it lands. slow-mo, blood, bits
      this.time.delayedCall(200, () => {
        if (!spr.active) return;
        spr.clearTint();
        this.tweens.timeScale = 0.4;
        const x = spr.x;
        const y = mid();
        synth.play("splat");
        synth.play("squelch");
        synth.play("death");
        this.shake(450, 0.025);
        vfx(this, "vfx_bloodspray", x, y, { scale: 1.6, depth: 962, speed: 0.55, flipX: f === "west" });
        vfx(this, "vfx_gore", x, y, { scale: 1.3, depth: 963, speed: 0.55, delay: 40 });
        for (let i = 0; i < 3; i++) vfx(this, "vfx_blood", x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 40, { scale: 1 + Math.random() * 0.6, depth: 961, speed: 0.6, delay: 60 + i * 90, flipX: Math.random() < 0.5 });
        Juice.debris(this, x, y, 16, { colors: [0xdc2626, 0x7f1d1d, 0xf87171, 0xfda4af], speed: 380, depth: 964, floor: feet() + 6, size: 7 });
        this.screenSplat(3);
        Juice.slamText(this, ["SPLAT.", "BITS EVERYWHERE", "THAT'S A CLOSED CASKET", "MESSY.", "OOF. ALL OF HIM."][Math.floor(Math.random() * 5)], "#ef4444", 46, 190, 650);
      });
      const down = collapse(260, 120);
      // the body hits the floor, a pool spreads, back to full speed
      this.time.delayedCall(Math.min(down, 1250), () => {
        if (!spr.active) return;
        this.tweens.timeScale = 1;
        synth.play("bodies_land");
        spr.setTint(0xffc4c4);
        vfx(this, "vfx_bloodpool", spr.x, feet(), { scale: 1.7, depth: Math.min(spr.depth - 1, 6), hold: true });
        vfx(this, "vfx_blood", spr.x, mid(), { scale: 0.9, depth: 961, speed: 0.8 });
      });
    } else {
      // 0: BONK
      synth.play("punch_big");
      Juice.flash(this, 0xffffff, 200, 0.6);
      this.time.delayedCall(90, () => spr.active && spr.setTintFill(0xffffff));
      const pow = this.add.text(spr.x, spr.getBounds().top - 6, "BONK!", { fontFamily: "Impact, sans-serif", fontSize: "30px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(1500).setScale(0.3).setAngle(-12);
      this.tweens.add({ targets: pow, scale: 1, duration: 160, ease: "Back.out" });
      this.tweens.add({ targets: pow, y: pow.y - 26, alpha: 0, delay: 700, duration: 400, onComplete: () => pow.destroy() });
      // 160: the spin
      const y0 = spr.y;
      let stars: Phaser.GameObjects.Sprite | null = null;
      this.time.delayedCall(160, () => {
        if (!spr.active) return;
        spr.clearTint();
        synth.play("whistle");
        stars = vfx(this, "vfx_stars", spr.x, spr.getBounds().top + 4, { scale: 1.3, depth: spr.depth + 2 });
        this.tweens.add({ targets: spr, angle: 720, duration: 680, ease: "Cubic.out", onComplete: () => spr.setAngle(0) });
        this.tweens.add({ targets: spr, y: y0 - 28, duration: 300, yoyo: true, ease: "Quad.out" });
        if (stars) this.tweens.add({ targets: stars, y: stars.y - 28, duration: 300, yoyo: true, ease: "Quad.out" });
      });
      // 860: flop, puff
      const down = collapse(860, 90);
      this.time.delayedCall(Math.min(down, 1450), () => {
        if (!spr.active) return;
        synth.play("bodies_land");
        this.shake(160, 0.008);
        vfx(this, "vfx_dust", spr.x, feet(), { scale: 1.3, depth: spr.depth + 1 });
        vfx(this, "vfx_smoke", spr.x, mid(), { scale: 1.2, depth: spr.depth + 1, alpha: 0.85 });
        const b = spr.getBounds();
        stars?.setPosition(b.centerX + (f === "west" ? -b.width * 0.25 : b.width * 0.25), b.top + 2);
        Juice.slamText(this, "K.O.", "#fde047", 64, 190, 500);
      });
      this.time.delayedCall(1550, () => synth.play("trombone"));
    }
    // dim towards the menu, then hand over
    const dim = this.add.rectangle(480, 270, 1100, 700, 0x000000, 1).setAlpha(0);
    Juice.layer(this, 985).add(dim);
    this.time.delayedCall(END - 500, () => {
      this.tweens.timeScale = 1;
      this.tweens.add({ targets: dim, alpha: 0.45, duration: 450 });
    });
    this.time.delayedCall(END, () => {
      this.tweens.timeScale = 1;
      // the Pit: dying ends the run (you keep what you made), and the card's back in the Pit
      if (G.rt.pit) {
        void this.pitFinish("death");
        return;
      }
      this.scene.launch("Menu", { mode: "death", caller: "Dungeon", dungeon: this.dungeon.id, room: this.roomIdx, bossHpPct: undefined, rush: this.boss ? this.rushIdx : 0 });
      this.scene.pause();
    });
  }

  // ------------------------------------------------------------------ update

  /** Bullet time: everything (timers, tweens, physics, the update loop) runs at `k` speed. */
  setSlowmo(k: number) {
    this.slowmo = k;
    this.time.timeScale = k;
    this.tweens.timeScale = k;
    this.physics.world.timeScale = 1 / k;
  }

  /** SWAP pressed: slow the action down. Released after a tap: hold the slow-mo a beat so you can see what you've got, then ease back. */
  swapSlow(on: boolean) {
    // invulnerable for the swap: while the key's down (capped), and through the slow-mo after a tap (plus a beat)
    this.swapSafeUntil = performance.now() + (on ? 4000 : 900);
    if (this.dying || this.busy) return;
    const token = ++this.epicSlowToken;
    if (on) {
      if (!this.picking && this.slowmo > 0.3) this.setSlowmo(0.3);
      return;
    }
    window.setTimeout(() => {
      if (token !== this.epicSlowToken || !this.sys.settings.active || this.picking) return;
      this.setSlowmo(0.6);
      window.setTimeout(() => {
        if (token === this.epicSlowToken && this.sys.settings.active && !this.picking) this.setSlowmo(1);
      }, 150);
    }, 450);
  }

  /** Hold SWAP: the action slows right down and the weapon picker opens. */
  openWeaponPicker() {
    if (this.picking || this.busy || this.dying) return;
    this.picking = true;
    this.setSlowmo(0.08);
    (this.player.spr.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.events.once("weapon-picked", () => {
      this.picking = false;
      // a moment's grace as the world speeds back up
      this.swapSafeUntil = performance.now() + 600;
      this.setSlowmo(1);
      this.controls.swallow();
    });
    this.scene.launch("WeaponPick", { caller: "Dungeon" });
  }

  update(time: number, delta: number) {
    delta *= this.slowmo;
    this.vClock += delta;
    if (!this.player || this.transitioning || !this.player.spr.body) return;
    if (G.s.flags.debug_mode) G.rt.fart = 100; // debug: IBS attack always ready
    if (this.controls.pause() && !this.busy && !this.dying) {
      this.scene.launch("Menu", { mode: "pause", caller: "Dungeon" });
      this.scene.pause();
      return;
    }
    if (this.paused || this.dying) return;
    const now = this.now();
    if (!this.busy) this.companion?.update(now);
    if (!this.busy) this.spice?.update(now, Math.min(delta, 50));
    if (this.dress && this.player) this.dress.update(now, delta, [this.player.spr, ...this.enemies]);
    if (!this.busy) for (const b of this.bros) b.update(now, Math.min(delta, 50));
    this.sideLevel?.update(Math.min(delta, 50), this.busy);
    this.citadel?.update(Math.min(delta, 50));
    this.plane?.update(Math.min(delta, 50), this.busy);
    this.heroSquad?.update();
    this.colonTube?.update(Math.min(delta, 50), this.busy);
    this.roof?.update(Math.min(delta, 50));
    const mb = this.room.miniBoss;
    if (mb && this.miniBossState === "none" && !this.roomCleared && !this.busy && !this.transitioning && !this.sideLevel?.locked) {
      const climb = this.room.exitAt ? this.room.exitAt[1] : this.room.h - 200;
      if (this.room.tower ? this.player.y < this.groundY - mb.at * climb : this.player.x > this.room.w * mb.at) void this.startMiniBoss();
    }
    if (this.miniBossState === "fight" && this.arenaLeft && this.player.x < this.arenaLeft + 24) this.player.spr.x = this.arenaLeft + 24;
    if (this.sideLevel?.triggersDone() && !this.roomCleared && !this.room.boss && !this.busy && !(mb && this.miniBossState !== "done")) this.onRoomCleared();
    if (now < this.hitStopUntil) {
      this.physics.world.isPaused || this.physics.world.pause();
      return;
    }
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = Math.min(delta, 50);
    const s = G.s;
    if (this.dungeon.timerSec && G.rt.timerEnd) {
      const left = Math.max(0, G.rt.timerEnd - Date.now());
      G.emit("timer", left / 1000);
      if (left <= 0 && !this.busy) {
        this.missionFailed();
        return;
      }
    }
    // timescale (Terrible Prophecy)
    this.enemyTimeScale = now < this.prophecyUntil ? 0.25 : 1;
    const ne = this.nearestEnemy(this.player.x, this.player.y, 520);
    this.controls.autoAim = ne ? Math.atan2(ne.y - this.player.y, ne.x - this.player.x) : null;
    this.controls.autoAimPoint = ne ? { x: ne.x, y: ne.y } : { x: this.player.x + Math.cos(this.player.aim) * 180, y: this.player.y + Math.sin(this.player.aim) * 180 };
    // phones: the phone combat controls aim, fire and help (src/game/mobile/combat.ts); nothing on a laptop
    if (isMobile()) phoneHooks()?.combatStep?.(this, this.controls, dt);
    if (!this.busy && !this.picking) this.player.update(dt, now, this.controls);
    else (this.player.spr.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    {
      const pb = this.player.spr.body as Phaser.Physics.Arcade.Body;
      leadCamera(this.cameras.main, pb.velocity.x, this.side ? 0 : pb.velocity.y, dt, 0.12, 36);
      if (this.sideBg) this.sideBg.tilePositionX = (this.cameras.main.scrollX * (this.room.ledges ? 1 : 0.35)) / this.sideBgScale;
      if (this.towerBg) this.towerBg.tilePositionY = (this.cameras.main.scrollY * 0.5) / this.towerBg.tileScaleY;
    }
    // intoxication decays slowly
    s.intoxication = Math.max(0, s.intoxication - dt * 0.0006);
    // ban rule: standing still / attack spam
    if (this.rule && !this.busy) {
      if (this.rule.kind === "NO_STANDING_STILL" && this.player.stillTime > 900 && now - this.lastStillTick > 900) {
        this.lastStillTick = now;
        this.addRisk(this.rule.risk, this.rule.decree);
      }
      if (this.rule.kind === "NO_ATTACK_SPAM" && this.player.attackHeldTime > 2500 && now - this.lastStillTick > 900) {
        this.lastStillTick = now;
        this.addRisk(this.rule.risk, this.rule.decree);
      }
    }
    // enemies
    const edt = dt * this.enemyTimeScale;
    if (G.rt.pit) this.pitTick(now);
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      // a test-range dummy: stands there and takes it
      if ((e as Enemy & { dummy?: boolean }).dummy) {
        (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        e.setDepth(e.y);
        continue;
      }
      if (!this.busy) {
        e.tick(edt, now);
        if (e.def.shout && Math.random() < edt / (e.def.shoutEvery ?? (e.def.id === "tumor" ? 2600 : 4200))) this.enemyShout(e);
      } else (e.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      if (this.enemyTimeScale < 1) {
        const b = e.body as Phaser.Physics.Arcade.Body;
        if (b.velocity.length() > e.def.speed * 0.4) b.velocity.scale(0.5);
      }
      e.setDepth(e.y);
      // contact damage
      if (!this.busy && e.def.damage > 0 && now > e.contactCd && !this.player.isHidden() && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < e.radius + 10) {
        e.contactCd = now + 700;
        this.damagePlayer(e.contactDamage(), e);
      }
    }
    this.player.spr.setDepth(this.player.y + 1);
    // shots
    for (const sh of [...this.shots]) {
      const k = sh.o.owner === "enemy" ? this.enemyTimeScale : 1;
      if (sh.o.homing) {
        const target = sh.o.owner === "enemy" ? this.player : this.nearestEnemy(sh.spr.x, sh.spr.y, 400);
        if (target) {
          const cur = Math.atan2(sh.vy, sh.vx);
          const want = Math.atan2(target.y - sh.spr.y, target.x - sh.spr.x);
          const na = cur + Phaser.Math.Angle.Wrap(want - cur) * Math.min(1, (sh.o.homing * dt) / 1000);
          sh.vx = Math.cos(na) * sh.o.speed;
          sh.vy = Math.sin(na) * sh.o.speed;
          sh.spr.setRotation(na);
        }
      }
      sh.spr.x += (sh.vx * dt * k) / 1000;
      sh.spr.y += (sh.vy * dt * k) / 1000;
      if (sh.o.trail !== undefined && Math.random() < 0.7) {
        const t = this.add.circle(sh.spr.x, sh.spr.y, 3, sh.o.trail, 0.85).setDepth(599).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: t, alpha: 0, scale: 0.3, duration: 260, onComplete: () => t.destroy() });
      }
      sh.life -= dt * k;
      if (sh.life <= 0 || !Phaser.Geom.Rectangle.Contains(this.bounds, sh.spr.x, sh.spr.y)) {
        sh.o.onEnd?.(sh.spr.x, sh.spr.y);
        this.killShot(sh);
        continue;
      }
      if (sh.o.owner === "player") {
        if (this.roof?.hitShot(sh.spr.x, sh.spr.y, sh.o)) {
          sh.o.onHit?.(sh.spr.x, sh.spr.y);
          this.killShot(sh);
          continue;
        }
        this.dress?.shotAt(sh.spr.x, sh.spr.y);
        // KR-069's passengers: collateral (the shot carries on through them)
        this.plane?.hitShot(sh.spr.x, sh.spr.y, sh.o.damage || 20, sh.hit);
        if (this.spice?.hitShot(sh.spr.x, sh.spr.y, sh.o.damage || 30)) {
          sh.o.onHit?.(sh.spr.x, sh.spr.y);
          this.killShot(sh);
          continue;
        }
        if (this.boss instanceof DrongusBoss && this.boss.hitSong(sh.spr.x, sh.spr.y, 4)) {
          this.killShot(sh);
          continue;
        }
        if (this.boss instanceof OverWonkedMachine) {
          this.boss.valves.forEach((v, i) => {
            if (Phaser.Math.Distance.Between(v.spr.x, v.spr.y, sh.spr.x, sh.spr.y) < 24) (this.boss as OverWonkedMachine).hitValve(i, now);
          });
        }
        for (const e of this.enemies) {
          if (e.dead || sh.hit.has(e.uid)) continue;
          if (Phaser.Math.Distance.Between(e.x, e.y, sh.spr.x, sh.spr.y) < e.radius + 6) {
            sh.hit.add(e.uid);
            this.damageEnemy(e, sh.o.damage, { crit: sh.o.crit, knock: sh.o.knock ?? 60, angle: Math.atan2(sh.vy, sh.vx), slow: sh.o.slow });
            sh.o.onHit?.(sh.spr.x, sh.spr.y);
            if ((sh.o.ricochet ?? 0) > 0) {
              sh.o.ricochet!--;
              const n = this.nearestEnemy(sh.spr.x, sh.spr.y, 300, e);
              if (n) {
                const a = Math.atan2(n.y - sh.spr.y, n.x - sh.spr.x);
                sh.vx = Math.cos(a) * sh.o.speed;
                sh.vy = Math.sin(a) * sh.o.speed;
                break;
              }
            }
            if ((sh.o.pierce ?? 0) > 0) {
              sh.o.pierce!--;
              continue;
            }
            this.killShot(sh);
            break;
          }
        }
      } else if (!this.busy) {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, sh.spr.x, sh.spr.y) < 12) {
          const p = this.player;
          if (p.invulnerable(now)) {
            if (now < p.iframesUntil) p.perfectDodge();
            continue;
          }
          this.damagePlayer(sh.o.damage, { x: sh.spr.x, y: sh.spr.y });
          sh.o.onHit?.(sh.spr.x, sh.spr.y);
          this.killShot(sh);
        }
      }
    }
    // pickups
    for (const pk of [...this.pickups]) {
      const d = Phaser.Math.Distance.Between(pk.spr.x, pk.spr.y, this.player.x, this.player.y);
      if (pk.kind !== "quest" && d < 90) {
        const a = Math.atan2(this.player.y - pk.spr.y, this.player.x - pk.spr.x);
        pk.spr.x += Math.cos(a) * dt * 0.4;
        pk.spr.y += Math.sin(a) * dt * 0.4;
      }
      if (d < 22) {
        this.collect(pk);
      }
    }
    // wave progression
    if (this.waveActive && this.pendingSpawns === 0 && this.enemies.every((e) => e.dead || (e as Enemy & { dummy?: boolean }).dummy) && !this.busy) {
      this.waveActive = false;
      this.time.delayedCall(600, () => this.nextWave());
    }
    if (!this.waveActive && !this.room.boss && !this.roomCleared && this.waves.length && this.waveIdx >= this.waves.length && this.enemies.every((e) => e.dead)) {
      this.onRoomCleared();
    }
    // interactables
    let best: Interactable | null = null;
    let bd = 1e9;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Phaser.Math.Distance.Between(it.x, it.y, this.player.x, this.player.y);
      if (d < it.r && d < bd) {
        bd = d;
        best = it;
      }
    }
    if (best && !this.busy) {
      this.prompt.setText(`E: ${best.label}`).setPosition(this.player.x, this.player.y - 48).setVisible(true);
      if (this.controls.interact()) {
        this.prompt.setVisible(false);
        best.use();
      }
    } else {
      this.prompt.setVisible(false);
      this.controls.interact();
    }
    // exit
    if (this.exitOpen() && !this.busy && Phaser.Geom.Rectangle.Contains(this.doorZone, this.player.x, this.player.y - 10)) {
      this.goNextRoom();
    }
  }

  private collect(pk: Pickup) {
    const s = G.s;
    // a little pop where it was: coins jingle out, everything else sparkles
    if (pk.kind === "coin") vfx(this, "vfx_coins", pk.spr.x, pk.spr.y, { scale: 0.45, depth: 960 });
    else if (pk.kind !== "heal" && pk.kind !== "quest") vfx(this, "vfx_sparks", pk.spr.x, pk.spr.y, { scale: 0.5, depth: 960, tint: pk.kind === "krezz" ? 0xc084fc : pk.kind === "ammo" ? 0x67e8f9 : 0xfde047 });
    pk.spr.destroy();
    this.pickups = this.pickups.filter((x) => x !== pk);
    switch (pk.kind) {
      case "coin":
        s.coins += pk.value;
        bump(s, "coins_earned", pk.value);
        synth.play("coin");
        break;
      case "krezz":
        s.krezz = Math.min(100 + (s.upgrades.krezz ?? 0) * 20, s.krezz + pk.value * diffFor(s).krezzGain);
        synth.play("pickup");
        break;
      case "heal":
        vfx(this, "vfx_heal", this.player.x, this.player.y + 20, { scale: 0.9, depth: this.player.spr.depth + 1 });
        s.hp = Math.min(maxHp(s), s.hp + pk.value);
        this.floatText(this.player.x, this.player.y - 30, `+${pk.value}`, "#ffb6c1", 13);
        synth.play("gulp");
        break;
      case "crobley":
        s.hp = Math.min(maxHp(s), s.hp + 15);
        s.krezz = Math.min(100 + (s.upgrades.krezz ?? 0) * 20, s.krezz + 20);
        this.floatText(this.player.x, this.player.y - 30, "nibbled a crobley", "#e0a35a", 13);
        synth.play("pickup");
        break;
      case "bottle":
        // pussy juice for the bottle belt (Q): you can carry up to three over your usual max from these
        s.bottles = Math.min(maxBottles(s) + 3, s.bottles + pk.value);
        this.floatText(this.player.x, this.player.y - 30, `+${pk.value} PUSSY JUICE (${s.bottles})`, "#ff9ecf", 13);
        synth.play("pickup");
        vfx(this, "vfx_heal", this.player.x, this.player.y + 20, { scale: 0.8, depth: this.player.spr.depth + 1, tint: 0xff9ecf });
        break;
      case "bongo":
        s.bongos += 1;
        this.floatText(this.player.x, this.player.y - 30, "+1 FIZZY BONGO", "#e0a35a", 13);
        synth.play("bongo");
        vfx(this, "vfx_heal", this.player.x, this.player.y + 20, { scale: 0.8, depth: this.player.spr.depth + 1, tint: 0xfde68a });
        break;
      case "ammo": {
        const a = giveAmmo(s, pk.value);
        if (a) this.floatText(this.player.x, this.player.y - 30, `+${a.amount} ${a.gun.name.toUpperCase()} AMMO`, "#67e8f9", 13);
        else this.floatText(this.player.x, this.player.y - 30, "AMMO FULL", "#67e8f9", 12);
        synth.play("pickup");
        break;
      }
      case "quest":
        pk.onCollect?.();
        break;
      default:
        break;
    }
  }
}
