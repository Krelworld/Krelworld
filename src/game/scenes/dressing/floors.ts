import type Phaser from "phaser";

/**
 * Code-drawn floor tiles for the dressed top-down rooms (no art needed). Each one is a seamless 64x64 tile,
 * drawn once into the texture manager as `ddf_<name>`. Shapes are whole pixels so they sit with the pixel art.
 */

type Ctx = CanvasRenderingContext2D;

/** A tiny seeded RNG, so a tile looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

function speckle(ctx: Ctx, r: () => number, n: number, cols: number[], size = 1, a = 1) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = hex(cols[Math.floor(r() * cols.length)], a);
    ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), size, size);
  }
}

/** A seamless blob (wraps around the tile edges). */
function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col;
  for (const dx of [-64, 0, 64])
    for (const dy of [-64, 0, 64]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
}

const DRAW: Record<string, (ctx: Ctx, r: () => number) => void> = {
  // Wildern corridor: speckled school lino, big squares, scuffed
  lino: (ctx, r) => {
    ctx.fillStyle = "#9da893";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#939e89";
    ctx.fillRect(32, 0, 32, 32);
    ctx.fillRect(0, 32, 32, 32);
    speckle(ctx, r, 140, [0x84907b, 0xb9c1b0, 0x737f6a, 0xa99c78], 1);
    ctx.fillStyle = "#6f7a65";
    ctx.fillRect(0, 0, 64, 1);
    ctx.fillRect(0, 32, 64, 1);
    ctx.fillRect(0, 0, 1, 64);
    ctx.fillRect(32, 0, 1, 64);
    // a black trainer scuff
    ctx.fillStyle = "rgba(40,40,40,0.35)";
    ctx.fillRect(10, 44, 7, 1);
    ctx.fillRect(12, 45, 6, 1);
  },
  // the cafeteria: red and cream vinyl check
  caf: (ctx, r) => {
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#87443c" : "#bfb196";
        ctx.fillRect(i * 32, j * 32, 32, 32);
      }
    speckle(ctx, r, 90, [0x6e3530, 0xa8997e, 0xd8ccb2], 1, 0.6);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let i = 0; i < 64; i += 32) {
      ctx.fillRect(i, 0, 1, 64);
      ctx.fillRect(0, i, 64, 1);
    }
  },
  // the boiler room: oily dark concrete
  concrete: (ctx, r) => {
    ctx.fillStyle = "#3a3936";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 260, [0x2d2c2a, 0x46443f, 0x504d47, 0x34312c], 1);
    blob(ctx, 44, 18, 10, 6, "rgba(10,10,14,0.35)");
    blob(ctx, 14, 50, 6, 4, "rgba(10,10,14,0.3)");
    ctx.strokeStyle = "rgba(20,20,20,0.6)";
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(14, 14);
    ctx.lineTo(18, 26);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 63, 64, 1);
    ctx.fillRect(63, 0, 1, 64);
  },
  // Polson's hallway: tired beige carpet
  beige: (ctx, r) => {
    ctx.fillStyle = "#a89377";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 320, [0x9a8569, 0xb3a084, 0x8f7b60, 0xbcaa8d], 1);
    for (let y = 4; y < 64; y += 16)
      for (let x = (y / 16) % 2 ? 12 : 4; x < 64; x += 16) {
        ctx.fillStyle = "#937d62";
        ctx.fillRect(x, y, 3, 3);
      }
    blob(ctx, 40, 40, 9, 6, "rgba(90,60,30,0.18)");
  },
  // the kitchen: olive and cream lino, sticky
  kitchen: (ctx, r) => {
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#7d8450" : "#d8d0aa";
        ctx.fillRect(i * 32, j * 32, 32, 32);
      }
    speckle(ctx, r, 160, [0x5f6538, 0xbdb48c, 0x6b4f2a], 1, 0.6);
    blob(ctx, 20, 22, 8, 5, "rgba(110,70,20,0.28)");
    blob(ctx, 50, 52, 5, 4, "rgba(80,120,30,0.25)");
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, 64, 1);
    ctx.fillRect(0, 32, 64, 1);
    ctx.fillRect(0, 0, 1, 64);
    ctx.fillRect(32, 0, 1, 64);
  },
  // the bedroom: soft pink carpet
  pink: (ctx, r) => {
    ctx.fillStyle = "#e7a8c0";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 420, [0xdb94b0, 0xf2bfd2, 0xd987a8, 0xf7cfe0], 1);
  },
  // Da Squeezing Room: hot pink shag with hearts
  shag: (ctx, r) => {
    ctx.fillStyle = "#c2276f";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 520, [0xa81f60, 0xd93a84, 0x8f1951, 0xe2559a], 1);
    const heart = (x: number, y: number) => {
      ctx.fillStyle = "rgba(255,170,210,0.45)";
      for (const [dx, dy, w] of [
        [1, 0, 2],
        [4, 0, 2],
        [0, 1, 7],
        [0, 2, 7],
        [1, 3, 5],
        [2, 4, 3],
        [3, 5, 1],
      ])
        ctx.fillRect(x + dx, y + dy, w, 1);
    };
    heart(12, 12);
    heart(44, 44);
  },
  // Mollor's cell: pink quilted padding
  padded: (ctx) => {
    ctx.fillStyle = "#f0a6c6";
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 32)
      for (let x = 0; x < 64; x += 32) {
        const g = ctx.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, 22);
        g.addColorStop(0, "rgba(255,225,238,0.9)");
        g.addColorStop(1, "rgba(200,110,150,0.6)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + 32, y + 16);
        ctx.lineTo(x + 16, y + 32);
        ctx.lineTo(x, y + 16);
        ctx.fill();
      }
    ctx.fillStyle = "#b5577f";
    for (const [x, y] of [
      [0, 0],
      [32, 0],
      [16, 16],
      [48, 16],
      [0, 32],
      [32, 32],
      [16, 48],
      [48, 48],
    ])
      ctx.fillRect(x, y, 2, 2);
  },
  // the BJJ Open: blue tatami
  tatami: (ctx, r) => {
    ctx.fillStyle = "#2f5fa8";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 200, [0x2a5598, 0x3668b6, 0x29508f], 1);
    ctx.fillStyle = "#1d3f75";
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillRect(0, 0, 2, 64);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(2, 2, 62, 1);
  },
  // the old flat: brown carpet, destroyed
  flat: (ctx, r) => {
    ctx.fillStyle = "#6b5140";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 360, [0x5c4434, 0x775c49, 0x52392b, 0x806451], 1);
    blob(ctx, 18, 16, 10, 7, "rgba(40,25,15,0.35)");
    blob(ctx, 48, 46, 7, 5, "rgba(150,120,40,0.22)");
    ctx.fillStyle = "rgba(30,20,10,0.6)";
    ctx.fillRect(40, 12, 2, 2); // a fag burn
  },
  // Flight KR-069: airline carpet
  airline: (ctx, r) => {
    ctx.fillStyle = "#26335c";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 240, [0x1f2a4d, 0x2d3c6b, 0x1a2342], 1);
    ctx.fillStyle = "#c2410c";
    for (const [x, y] of [
      [8, 8],
      [40, 40],
    ]) {
      ctx.fillRect(x + 3, y, 2, 8);
      ctx.fillRect(x, y + 3, 8, 2);
    }
    ctx.fillStyle = "#e0b04a";
    ctx.fillRect(43, 8 + 3, 2, 2);
    ctx.fillRect(11, 43, 2, 2);
  },
  // the cockpit: grey ribbed rubber
  cockpit: (ctx, r) => {
    ctx.fillStyle = "#3b4252";
    ctx.fillRect(0, 0, 64, 64);
    speckle(ctx, r, 120, [0x343a48, 0x434b5d], 1);
    ctx.fillStyle = "#2d3340";
    for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 2);
  },
};

/** The floor texture key for `name`, drawing it the first time. */
export function floorTile(sc: Phaser.Scene, name: string): string | null {
  const key = `ddf_${name}`;
  if (sc.textures.exists(key)) return key;
  const draw = DRAW[name];
  if (!draw) return null;
  const t = sc.textures.createCanvas(key, 64, 64);
  if (!t) return null;
  const ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx, rng(name.length * 977 + name.charCodeAt(0)));
  t.refresh();
  return key;
}

/** A soft round light (white, for tinting) used for light pools, glows and motes. */
export function softLight(sc: Phaser.Scene): string {
  const key = "dd_softlight";
  if (sc.textures.exists(key)) return key;
  const t = sc.textures.createCanvas(key, 128, 128);
  if (!t) return "fx_circle";
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  t.refresh();
  return key;
}

/** A soft puff (steam, smoke, haze, dust). */
export function puff(sc: Phaser.Scene): string {
  const key = "dd_puff";
  if (sc.textures.exists(key)) return key;
  const t = sc.textures.createCanvas(key, 48, 48);
  if (!t) return "fx_circle";
  const ctx = t.getContext();
  const r = rng(7);
  for (let i = 0; i < 6; i++) {
    const x = 14 + r() * 20;
    const y = 14 + r() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 48, 48);
  }
  t.refresh();
  return key;
}
