import type { Kit } from "./kit";

/**
 * The PixelLab version of a small (`ddk_<name>`, with a broken `ddk_<name>_burst` it turns into when knocked), if
 * it's loaded. Otherwise the code-drawn one below.
 */
const pl = (k: Kit, name: string) => (k.has(`ddk_${name}`) ? `ddk_${name}` : null);

/** Little knockables (trays, papers, cans, cups...): PixelLab art, or drawn into textures once. Returns the key. */
export const SMALL = {
  tray: (k: Kit) =>
    pl(k, "tray") ?? k.makeTex("dds_tray", 22, 16, (g) => {
      g.fillStyle(0x6b7280).fillRect(0, 0, 22, 16);
      g.fillStyle(0x9ca3af).fillRect(1, 1, 20, 14);
      g.fillStyle(0xc2410c).fillCircle(7, 8, 4); // beans
      g.fillStyle(0xfacc15).fillRect(13, 4, 2, 8).fillRect(16, 5, 2, 7); // chips
    }),
  cup: (k: Kit) =>
    pl(k, "cup") ?? k.makeTex("dds_cup", 8, 10, (g) => {
      g.fillStyle(0xf8fafc).fillRect(1, 0, 6, 10);
      g.fillStyle(0x3b82f6).fillRect(1, 3, 6, 3);
    }),
  paper: (k: Kit) =>
    pl(k, "paper") ?? k.makeTex("dds_paper", 12, 14, (g) => {
      g.fillStyle(0xf5f5f4).fillRect(0, 0, 12, 14);
      g.fillStyle(0x93c5fd);
      for (let y = 3; y < 13; y += 3) g.fillRect(1, y, 10, 1);
      g.fillStyle(0xdc2626).fillRect(7, 1, 4, 1); // a red mark: SPELL IT
    }),
  can: (k: Kit) =>
    pl(k, "can") ?? k.makeTex("dds_can", 8, 12, (g) => {
      g.fillStyle(0x9ca3af).fillRect(0, 0, 8, 12);
      g.fillStyle(0xdc2626).fillRect(0, 2, 8, 8);
      g.fillStyle(0xfacc15).fillRect(2, 4, 4, 3);
    }),
  carton: (k: Kit) =>
    pl(k, "carton") ?? k.makeTex("dds_carton", 14, 12, (g) => {
      g.fillStyle(0xf4f4f5).fillRect(0, 2, 14, 10);
      g.fillStyle(0xdc2626).fillRect(4, 5, 6, 4);
      g.fillStyle(0xd4d4d8).fillTriangle(0, 2, 7, 0, 14, 2);
    }),
  bottle: (k: Kit) =>
    pl(k, "bottle") ?? k.makeTex("dds_bottle", 8, 16, (g) => {
      g.fillStyle(0x93c5fd, 0.85).fillRect(1, 4, 6, 12);
      g.fillStyle(0x1d4ed8).fillRect(2, 0, 4, 4);
      g.fillStyle(0xffffff, 0.6).fillRect(2, 6, 1, 8);
    }),
  pint: (k: Kit) =>
    pl(k, "pint") ?? k.makeTex("dds_pint", 8, 12, (g) => {
      g.fillStyle(0xb45309, 0.95).fillRect(0, 3, 8, 9);
      g.fillStyle(0xfef3c7).fillRect(0, 0, 8, 3);
    }),
  chalk: (k: Kit) =>
    k.makeTex("dds_chalk", 14, 12, (g) => {
      g.fillStyle(0x52525b).fillRect(0, 2, 14, 10);
      g.fillStyle(0xf4f4f5).fillRect(1, 2, 12, 3);
    }),
  teddy: (k: Kit) =>
    pl(k, "teddy") ?? k.makeTex("dds_teddy", 16, 16, (g) => {
      g.fillStyle(0x92400e).fillCircle(4, 4, 3).fillCircle(12, 4, 3);
      g.fillStyle(0xb45309).fillCircle(8, 9, 6);
      g.fillStyle(0xfde68a).fillCircle(8, 11, 2.5);
      g.fillStyle(0x111111).fillRect(5, 7, 2, 2).fillRect(10, 7, 2, 2);
    }),
  bunny: (k: Kit) =>
    pl(k, "bunny") ?? k.makeTex("dds_bunny", 16, 18, (g) => {
      g.fillStyle(0xf9a8d4).fillRect(3, 0, 3, 8).fillRect(10, 0, 3, 8);
      g.fillStyle(0xfbcfe8).fillCircle(8, 12, 6);
      g.fillStyle(0x111111).fillRect(5, 10, 2, 2).fillRect(10, 10, 2, 2);
      g.fillStyle(0xec4899).fillRect(7, 13, 2, 1);
    }),
  unicorn: (k: Kit) =>
    pl(k, "unicorn") ?? k.makeTex("dds_unicorn", 18, 16, (g) => {
      g.fillStyle(0xf5f3ff).fillCircle(9, 10, 6);
      g.fillStyle(0xfacc15).fillTriangle(8, 0, 11, 0, 9.5, 5);
      g.fillStyle(0xa78bfa).fillRect(2, 5, 3, 8);
      g.fillStyle(0x111111).fillRect(7, 9, 2, 2).fillRect(11, 9, 2, 2);
    }),
  parcel: (k: Kit) =>
    pl(k, "parcel") ?? k.makeTex("dds_parcel", 24, 20, (g) => {
      g.fillStyle(0x8b5e34).fillRect(0, 0, 24, 20);
      g.fillStyle(0xb7834a).fillRect(1, 1, 22, 18);
      g.fillStyle(0xd6b98c).fillRect(10, 1, 4, 18);
      g.fillStyle(0xf8fafc).fillRect(2, 12, 7, 5);
    }),
  pizza: (k: Kit) =>
    pl(k, "pizza") ?? k.makeTex("dds_pizza", 22, 22, (g) => {
      g.fillStyle(0xd6b98c).fillRect(0, 0, 22, 22);
      g.fillStyle(0xb7834a).fillRect(0, 0, 22, 2);
      g.fillStyle(0xdc2626).fillCircle(11, 12, 5);
      g.fillStyle(0x65a30d, 0.8).fillCircle(8, 9, 3); // the mould
    }),
  sock: (k: Kit) =>
    k.makeTex("dds_sock", 12, 8, (g) => {
      g.fillStyle(0xe7e5e4).fillRect(0, 0, 8, 5);
      g.fillRect(5, 3, 7, 5);
      g.fillStyle(0xa8a29e).fillRect(0, 0, 2, 5);
    }),
};
