import type { Kit } from "./kit";

/** Little code-drawn knockables (trays, papers, cans, cups...), made into textures once. Returns the key. */
export const SMALL = {
  tray: (k: Kit) =>
    k.makeTex("dds_tray", 22, 16, (g) => {
      g.fillStyle(0x6b7280).fillRect(0, 0, 22, 16);
      g.fillStyle(0x9ca3af).fillRect(1, 1, 20, 14);
      g.fillStyle(0xc2410c).fillCircle(7, 8, 4); // beans
      g.fillStyle(0xfacc15).fillRect(13, 4, 2, 8).fillRect(16, 5, 2, 7); // chips
    }),
  cup: (k: Kit) =>
    k.makeTex("dds_cup", 8, 10, (g) => {
      g.fillStyle(0xf8fafc).fillRect(1, 0, 6, 10);
      g.fillStyle(0x3b82f6).fillRect(1, 3, 6, 3);
    }),
  paper: (k: Kit) =>
    k.makeTex("dds_paper", 12, 14, (g) => {
      g.fillStyle(0xf5f5f4).fillRect(0, 0, 12, 14);
      g.fillStyle(0x93c5fd);
      for (let y = 3; y < 13; y += 3) g.fillRect(1, y, 10, 1);
      g.fillStyle(0xdc2626).fillRect(7, 1, 4, 1); // a red mark: SPELL IT
    }),
  can: (k: Kit) =>
    k.makeTex("dds_can", 8, 12, (g) => {
      g.fillStyle(0x9ca3af).fillRect(0, 0, 8, 12);
      g.fillStyle(0xdc2626).fillRect(0, 2, 8, 8);
      g.fillStyle(0xfacc15).fillRect(2, 4, 4, 3);
    }),
  carton: (k: Kit) =>
    k.makeTex("dds_carton", 14, 12, (g) => {
      g.fillStyle(0xf4f4f5).fillRect(0, 2, 14, 10);
      g.fillStyle(0xdc2626).fillRect(4, 5, 6, 4);
      g.fillStyle(0xd4d4d8).fillTriangle(0, 2, 7, 0, 14, 2);
    }),
  bottle: (k: Kit) =>
    k.makeTex("dds_bottle", 8, 16, (g) => {
      g.fillStyle(0x93c5fd, 0.85).fillRect(1, 4, 6, 12);
      g.fillStyle(0x1d4ed8).fillRect(2, 0, 4, 4);
      g.fillStyle(0xffffff, 0.6).fillRect(2, 6, 1, 8);
    }),
  pint: (k: Kit) =>
    k.makeTex("dds_pint", 8, 12, (g) => {
      g.fillStyle(0xb45309, 0.95).fillRect(0, 3, 8, 9);
      g.fillStyle(0xfef3c7).fillRect(0, 0, 8, 3);
    }),
  chalk: (k: Kit) =>
    k.makeTex("dds_chalk", 14, 12, (g) => {
      g.fillStyle(0x52525b).fillRect(0, 2, 14, 10);
      g.fillStyle(0xf4f4f5).fillRect(1, 2, 12, 3);
    }),
  sock: (k: Kit) =>
    k.makeTex("dds_sock", 12, 8, (g) => {
      g.fillStyle(0xe7e5e4).fillRect(0, 0, 8, 5);
      g.fillRect(5, 3, 7, 5);
      g.fillStyle(0xa8a29e).fillRect(0, 0, 2, 5);
    }),
};
