// Gun data (pure: no Phaser), so the stat maths and tests can use it. The game-side helpers live in game/combat/Guns.ts.

/** Ranged weapons you find in dungeon crates. Ammo drops from enemies. */
export interface GunDef {
  id: string;
  name: string;
  blurb: string;
  tex: string;
  /** Base damage per pellet (scaled by the player's damage multipliers). */
  dmg: number;
  /** Milliseconds between shots. */
  cd: number;
  speed: number;
  pellets: number;
  spread: number;
  range: number;
  pierce?: number;
  /** Explosion radius on impact or at max range. */
  blast?: number;
  knock?: number;
  color: number;
  shotTex?: string;
  maxAmmo: number;
  /** Ammo in a crate / found box. */
  pickup: number;
  /** Price of one box (`pickup` rounds) at the Kreddle Exchange, in Krezzcoin. See docs/ECONOMY.md. */
  ammoPrice?: number;
  minChapter: number;
  /** Only sold at the Central Bank (never in crates). Price in Krezzcoin. */
  shop?: number;
  /** Only won in Kreddle (never in crates or the bank). */
  kreddle?: boolean;
  /** A crate gun that the Kreddle Exchange also sells (Krezzcoin), from its `minChapter`. Still turns up in crates. */
  price?: number;
  /** Shots steer towards the nearest enemy (turn rate). */
  homing?: number;
  /** Shots bounce on to the next enemy this many times. */
  ricochet?: number;
  /** Hits slow the enemy (0-1). */
  slow?: number;
  /** A trick of its own, worked out where it's fired (combat/Player.ts fireGun). */
  mech?: "slots" | "roulette" | "chips" | "loan" | "dice";
  /** Sound to play (default `gun_<id>`). */
  sfx?: string;
}

export const GUNS: Record<string, GunDef> = {
  pistol: {
    id: "pistol", name: "Wonk Pistol", blurb: "Hot pink. Smiley sticker. Legally a toy in three countries.",
    tex: "p_wpn_pistol", dmg: 12, cd: 230, speed: 600, pellets: 1, spread: 0.04, range: 420, color: 0xff6ec7, maxAmmo: 120, pickup: 30, ammoPrice: 12, minChapter: 1, price: 150,
  },
  smg: {
    id: "smg", name: "Crobley Uzi", blurb: "Sprays like Gronny after a Fizzy Bongo.",
    tex: "p_wpn_smg", dmg: 6, cd: 85, speed: 640, pellets: 1, spread: 0.18, range: 360, color: 0xb6ff3b, maxAmmo: 260, pickup: 60, ammoPrice: 15, minChapter: 1, price: 300,
  },
  shotgun: {
    id: "shotgun", name: "Bongo Boomstick", blurb: "Beer can duct-taped on for luck. The luck is the beer.",
    tex: "p_wpn_shotgun", dmg: 8, cd: 680, speed: 560, pellets: 6, spread: 0.55, range: 230, knock: 200, color: 0xffa94d, maxAmmo: 40, pickup: 10, ammoPrice: 15, minChapter: 2, price: 400,
  },
  rail: {
    id: "rail", name: "Wiki Railgun", blurb: "[citation needed] goes straight through people.",
    tex: "p_wpn_rail", dmg: 42, cd: 850, speed: 1300, pellets: 1, spread: 0, range: 760, pierce: 99, knock: 160, color: 0x67e8f9, maxAmmo: 24, pickup: 6, ammoPrice: 20, minChapter: 3, price: 600,
  },
  rocket: {
    id: "rocket", name: "The Marital Aid", blurb: "Fires pink rubber rockets. Vibrates on impact. Then explodes.",
    tex: "p_wpn_rocket", dmg: 34, cd: 1000, speed: 360, pellets: 1, spread: 0, range: 520, blast: 85, knock: 260, color: 0xffffff, shotTex: "fx_rocket", maxAmmo: 12, pickup: 3, ammoPrice: 25, minChapter: 4, price: 750,
  },
  // ---- Central Bank exclusives
  gatling: {
    id: "gatling", name: "The Gronny Gatling", blurb: "Fair enough. Fair enough. Fair enough. Fair enough.",
    tex: "p_wpn_smg", dmg: 5, cd: 45, speed: 680, pellets: 1, spread: 0.24, range: 380, color: 0xffd23f, maxAmmo: 600, pickup: 150, ammoPrice: 30, minChapter: 1, shop: 700,
  },
  sniper: {
    id: "sniper", name: "Polson's Long Lens", blurb: "Originally bought to look at his own house from the other side of town.",
    tex: "p_wpn_rail", dmg: 75, cd: 1100, speed: 1500, pellets: 1, spread: 0, range: 950, pierce: 3, knock: 220, color: 0xf5f5f5, maxAmmo: 24, pickup: 6, ammoPrice: 30, minChapter: 1, shop: 650,
  },
  // Boggor's side story reward only (never in crates or shops): every shot a blinding camera flash
  boggor_lens: {
    id: "boggor_lens", name: "Boggor's Telephoto", blurb: "His old camera, converted. Every shot is a blinding flash. Heh heh heh.",
    tex: "p_wpn_rail", dmg: 48, cd: 600, speed: 1300, pellets: 3, spread: 0.18, range: 700, pierce: 5, blast: 70, knock: 260, color: 0xfffbe0, maxAmmo: 60, pickup: 10, ammoPrice: 25, minChapter: 99,
  },
  flamer: {
    id: "flamer", name: "Fizzy Bongo Flamethrower", blurb: "It's a bongo. On fire. Pointed at people.",
    tex: "p_wpn_shotgun", dmg: 4, cd: 70, speed: 380, pellets: 4, spread: 0.5, range: 170, color: 0xff7a1a, maxAmmo: 320, pickup: 80, ammoPrice: 35, minChapter: 1, shop: 800,
  },
  // ---- Chapter 6: won in Kreddle, handed to you at the revenge meeting. Absurdly strong on purpose.
  chem_flamer: {
    id: "chem_flamer", name: "Chemical Flamethrower", blurb: "Won on the Kreddle slots. Green fire. Banned under the Krelneva Convention, which Krezmar has pissed on.",
    tex: "p_wpn_shotgun", dmg: 40, cd: 45, speed: 420, pellets: 6, spread: 0.55, range: 260, pierce: 6, color: 0x7cff3a, maxAmmo: 9999, pickup: 999, ammoPrice: 60, minChapter: 6, kreddle: true,
  },
  bfk: {
    id: "bfk", name: "The BFK (Big Fucking Krezzer)", blurb: "Do not fire indoors. Everything in Krelworld is indoors.",
    tex: "p_wpn_rocket", dmg: 95, cd: 1600, speed: 300, pellets: 1, spread: 0, range: 560, blast: 150, knock: 420, color: 0xc084fc, shotTex: "fx_rocket", maxAmmo: 6, pickup: 2, ammoPrice: 60, minChapter: 1, shop: 2000,
  },
  // ---- Kreddle prizes
  chainsaw: {
    id: "chainsaw", name: "The Kreddle Chainsaw", blurb: "Won on a claw machine. The claw machine is still scared of it.",
    tex: "p_wpn_chainsaw", dmg: 11, cd: 55, speed: 520, pellets: 1, spread: 0.5, range: 70, pierce: 4, knock: 40, color: 0xffa500, maxAmmo: 500, pickup: 120, ammoPrice: 30, minChapter: 1, kreddle: true,
  },
  kreddler: {
    id: "kreddler", name: "The Kreddler", blurb: "Gold-plated minigun. Paid for itself in one spin.",
    tex: "p_wpn_minigun", dmg: 6, cd: 32, speed: 720, pellets: 1, spread: 0.2, range: 420, color: 0xffd23f, maxAmmo: 900, pickup: 220, ammoPrice: 60, minChapter: 1, kreddle: true,
  },
  disco: {
    id: "disco", name: "Disco Ball Launcher", blurb: "Saturday night fever. Saturday night explosions.",
    tex: "p_wpn_disco", dmg: 40, cd: 900, speed: 340, pellets: 1, spread: 0, range: 520, blast: 120, knock: 300, color: 0xe5e7eb, maxAmmo: 14, pickup: 4, ammoPrice: 45, minChapter: 1, kreddle: true,
  },
  flush: {
    id: "flush", name: "The Royal Flush", blurb: "Five cards, all aces, all very sharp.",
    tex: "p_wpn_flush", dmg: 14, cd: 420, speed: 780, pellets: 5, spread: 0.6, range: 480, pierce: 3, color: 0xff3355, maxAmmo: 90, pickup: 25, ammoPrice: 35, minChapter: 1, kreddle: true,
  },
  // ---- Kreddle Exchange exclusives (Krezzcoin; never in crates)
  slots: {
    id: "slots", name: "The One-Armed Bandit", blurb: "Every trigger pull spins the reels. Mostly lemons. Sometimes 777 and the whole room gets paid in lead.",
    tex: "p_wpn_slots", dmg: 9, cd: 170, speed: 650, pellets: 1, spread: 0.1, range: 440, color: 0xffd23f, maxAmmo: 240, pickup: 60, ammoPrice: 30, minChapter: 1, shop: 900, kreddle: true, mech: "slots", sfx: "gun_kreddler",
  },
  roulette: {
    id: "roulette", name: "Kroulette Shotgun", blurb: "Red or black, the pellets bounce on to the next mug. Land on the green zero and the House pays out. Through everyone.",
    tex: "p_wpn_roulette", dmg: 9, cd: 760, speed: 560, pellets: 7, spread: 0.6, range: 250, knock: 210, ricochet: 1, color: 0xef4444, maxAmmo: 48, pickup: 12, ammoPrice: 25, minChapter: 1, shop: 1100, kreddle: true, mech: "roulette", sfx: "gun_shotgun",
  },
  chips: {
    id: "chips", name: "High Roller Chip Launcher", blurb: "Fires stacks of casino chips that hunt people down. The chips are worthless. So is everyone they hit.",
    tex: "p_wpn_chips", dmg: 15, cd: 280, speed: 430, pellets: 2, spread: 0.35, range: 560, homing: 2.6, color: 0x38bdf8, maxAmmo: 160, pickup: 40, ammoPrice: 30, minChapter: 1, shop: 850, kreddle: true, mech: "chips", sfx: "gun_flush",
  },
  loan: {
    id: "loan", name: "The Loan Shark", blurb: "A harpoon gun with a payday loan attached. Skewers a queue of debtors, slows them right down, and collects the interest.",
    tex: "p_wpn_loan", dmg: 52, cd: 720, speed: 950, pellets: 1, spread: 0, range: 700, pierce: 4, slow: 0.5, knock: 120, color: 0x94a3b8, maxAmmo: 30, pickup: 8, ammoPrice: 30, minChapter: 1, shop: 1000, kreddle: true, mech: "loan", sfx: "gun_sniper",
  },
  dice: {
    id: "dice", name: "Snake Eyes", blurb: "Lobs a pair of loaded dice. Roll high, big bang. Roll double one and the House cries.",
    tex: "p_wpn_dice", dmg: 30, cd: 820, speed: 380, pellets: 1, spread: 0, range: 480, blast: 60, knock: 240, color: 0xffffff, maxAmmo: 18, pickup: 5, ammoPrice: 40, minChapter: 1, shop: 1300, kreddle: true, mech: "dice", sfx: "gun_disco",
  },
};

export const GUN_ORDER = ["chem_flamer", "pistol", "smg", "shotgun", "rail", "rocket", "gatling", "sniper", "boggor_lens", "flamer", "bfk", "chainsaw", "kreddler", "disco", "flush", "slots", "roulette", "chips", "loan", "dice"];

/** Strongest first: what you get handed when you walk into a room or run dry. */
export const GUN_POWER = ["chem_flamer", "bfk", "dice", "disco", "kreddler", "loan", "rocket", "roulette", "gatling", "flush", "chips", "slots", "chainsaw", "boggor_lens", "sniper", "rail", "flamer", "shotgun", "smg", "pistol"];

/** The infinite starter every character always has (when no gun is in hand). */
export const FART_BLASTER = { name: "Fart Blaster", dmg: 10, cd: 240, speed: 540, range: 400 };
