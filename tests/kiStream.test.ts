import { describe, expect, it } from "vitest";
import { bezier, flowEdges, lighten, Motes, smooth } from "../src/game/gfx/KiStream";

describe("KiStream", () => {
  const path = bezier({ x: 0, y: 0 }, { x: 100, y: -50 }, { x: 200, y: 50 }, { x: 300, y: 0 });

  it("bezier hits its end points", () => {
    expect(path(0)).toEqual({ x: 0, y: 0 });
    expect(path(1)).toEqual({ x: 300, y: 0 });
  });

  it("flow edges are finite, one pair per sample, and never pinch to nothing", () => {
    for (const lumps of [0, 1]) {
      const { L, R } = flowEdges(path, 12.3, { width: 10, glow: 0, mid: 0, lumps, beads: 4 }, 0, 1, 40, 1);
      expect(L).toHaveLength(41);
      expect(R).toHaveLength(41);
      for (let i = 0; i < L.length; i++) {
        expect(Number.isFinite(L[i].x + L[i].y + R[i].x + R[i].y)).toBe(true);
        expect(Math.hypot(L[i].x - R[i].x, L[i].y - R[i].y)).toBeGreaterThan(1);
      }
    }
  });

  it("lumpy edges ripple more than smooth ones", () => {
    const widths = (lumps: number) => {
      const { L, R } = flowEdges(path, 3, { width: 10, glow: 0, mid: 0, pulses: 0, lumps }, 0, 1, 80, 1);
      return L.slice(15, 65).map((p, i) => Math.hypot(p.x - R[i + 15].x, p.y - R[i + 15].y));
    };
    const spread = (w: number[]) => Math.max(...w) - Math.min(...w);
    expect(spread(widths(1))).toBeGreaterThan(spread(widths(0)));
  });

  it("helpers", () => {
    expect(lighten(0x000000, 1)).toBe(0xffffff);
    expect(lighten(0x123456, 0)).toBe(0x123456);
    expect(smooth(0, 1, -1)).toBe(0);
    expect(smooth(0, 1, 2)).toBe(1);
  });

  it("motes fade away and respect their cap", () => {
    const m = new Motes(10);
    m.burst(0, 0, 25, { life: 0.3 });
    expect(m.count).toBe(10);
    for (let i = 0; i < 40; i++) m.update(0.05);
    expect(m.count).toBe(0);
  });
});
