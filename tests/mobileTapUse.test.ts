import { describe, expect, it } from "vitest";
import { buildGrid, distToRect, findPath, grow, isFree, lineFree, nearestFree, pathScratchSize, pickTarget, steer, type Pt } from "../src/game/mobile/tapLogic";
import { spotBox, standsOn, tagOf, union } from "../src/game/mobile/tapTargets";

const R = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe("tap to use: which thing a tap means", () => {
  it("a tap inside a thing's picture picks it", () => {
    const list = [{ core: R(100, 100, 80, 120) }, { core: R(400, 100, 80, 120) }];
    expect(pickTarget(list, 130, 150, 44)).toBe(0);
    expect(pickTarget(list, 430, 150, 44)).toBe(1);
  });
  it("a small thing can be tapped a thumb's width around it (44 px minimum), and not further", () => {
    const list = [{ core: R(100, 100, 10, 10) }];
    expect(pickTarget(list, 105 + 21, 105, 44)).toBe(0);
    expect(pickTarget(list, 105 + 23, 105, 44)).toBe(-1);
    expect(pickTarget(list, 105 + 23, 105, 44, 4)).toBe(0);
  });
  it("overlapping things: inside the smaller picture wins (the book on the bed, the laptop on the sofa)", () => {
    const bed = { core: R(400, 400, 200, 100) };
    const book = { core: R(560, 440, 40, 60) };
    expect(pickTarget([bed, book], 570, 460, 44)).toBe(1);
    expect(pickTarget([book, bed], 570, 460, 44)).toBe(0);
    expect(pickTarget([bed, book], 450, 460, 44)).toBe(0);
  });
  it("near two things (inside neither): the nearest picture wins", () => {
    const a = { core: R(100, 100, 10, 10) };
    const b = { core: R(140, 100, 10, 10) };
    expect(pickTarget([a, b], 118, 105, 60)).toBe(0);
    expect(pickTarget([a, b], 133, 105, 60)).toBe(1);
  });
  it("inside a picture beats merely near another one", () => {
    const big = { core: R(0, 0, 100, 100) };
    const small = { core: R(102, 40, 8, 8) };
    expect(pickTarget([small, big], 98, 44, 44)).toBe(1);
  });
  it("a 'low' thing (a follower at your side) only counts when nothing else is under the tap", () => {
    const mikey = { core: R(100, 100, 40, 60), low: true };
    const door = { core: R(90, 60, 80, 120) };
    expect(pickTarget([mikey, door], 120, 120, 44)).toBe(1);
    expect(pickTarget([mikey], 120, 120, 44)).toBe(0);
  });
  it("nothing near: -1 (the floor)", () => {
    expect(pickTarget([{ core: R(0, 0, 10, 10) }], 500, 500, 44)).toBe(-1);
    expect(pickTarget([], 1, 1, 44)).toBe(-1);
  });
  it("grow and distToRect", () => {
    expect(grow(R(10, 10, 10, 10), 30)).toEqual(R(0, 0, 30, 30));
    expect(grow(R(0, 0, 50, 50), 30, 5)).toEqual(R(-5, -5, 60, 60));
    expect(distToRect(R(0, 0, 10, 10), 5, 5)).toBe(0);
    expect(distToRect(R(0, 0, 10, 10), 13, 14)).toBe(5);
  });
});

describe("tap to use: the path-finder", () => {
  const bounds = R(0, 0, 640, 480);
  const half = { w: 10, h: 8 };
  const walkable = (g: ReturnType<typeof buildGrid>, from: Pt, pts: Pt[]) => {
    let at = from;
    for (const p of pts) {
      expect(lineFree(g, at, p)).toBe(true);
      at = p;
    }
  };

  it("an open room: one straight line to the goal", () => {
    const g = buildGrid(bounds, [], half);
    const r = findPath(g, { x: 50, y: 50 }, { x: 500, y: 400 });
    expect(r.reached).toBe(true);
    expect(r.points).toEqual([{ x: 500, y: 400 }]);
  });

  it("a wall in the way: round it, every leg clear of the wall (grown by the walker's size)", () => {
    const wall = R(300, 0, 40, 400);
    const g = buildGrid(bounds, [wall], half);
    const from = { x: 100, y: 100 };
    const r = findPath(g, from, { x: 500, y: 100 });
    expect(r.reached).toBe(true);
    expect(r.points.length).toBeGreaterThan(1);
    walkable(g, from, r.points);
    // (it goes under the wall's end)
    expect(Math.max(...r.points.map((p) => p.y))).toBeGreaterThan(400);
    expect(r.points[r.points.length - 1]).toEqual({ x: 500, y: 100 });
  });

  it("a goal inside a collider (a door's spot under a building): the nearest free place instead", () => {
    const house = R(200, 200, 100, 100);
    const g = buildGrid(bounds, [house], half);
    const r = findPath(g, { x: 50, y: 50 }, { x: 250, y: 250 });
    expect(r.points.length).toBeGreaterThan(0);
    const end = r.points[r.points.length - 1];
    expect(isFree(g, end)).toBe(true);
    expect(distToRect(house, end.x, end.y)).toBeLessThan(40);
  });

  it("no way through at all: as close as it can get (reached = false)", () => {
    // a box round the goal
    const walls = [R(380, 180, 200, 20), R(380, 380, 200, 20), R(380, 180, 20, 220), R(560, 180, 20, 220)];
    const g = buildGrid(bounds, walls, half);
    const from = { x: 50, y: 300 };
    const r = findPath(g, from, { x: 480, y: 290 });
    expect(r.reached).toBe(false);
    expect(r.points.length).toBeGreaterThan(0);
    walkable(g, from, r.points);
    // (outside the box, right up against it)
    const end = r.points[r.points.length - 1];
    const box = R(380, 180, 200, 220);
    expect(isFree(g, end)).toBe(true);
    expect(end.x < 380 || end.x > 580 || end.y < 180 || end.y > 400).toBe(true);
    expect(distToRect(box, end.x, end.y)).toBeLessThan(40);
  });

  it("a start squeezed into a collider's grown edge starts from the nearest free cell", () => {
    const g = buildGrid(bounds, [R(100, 100, 100, 100)], half);
    const r = findPath(g, { x: 95, y: 150 }, { x: 30, y: 150 });
    expect(r.points.length).toBeGreaterThan(0);
    expect(isFree(g, r.points[0])).toBe(true);
  });

  it("no diagonal through a gap between two touching corners", () => {
    const g = buildGrid(R(0, 0, 160, 160), [R(0, 0, 64, 64), R(96, 96, 64, 64)], { w: 0, h: 0 }, 32);
    const r = findPath(g, { x: 16, y: 144 }, { x: 144, y: 16 });
    expect(r.reached).toBe(true);
    walkable(g, { x: 16, y: 144 }, r.points);
  });

  it("nearestFree finds the closest free cell middle; an all-blocked grid gives null", () => {
    const g = buildGrid(R(0, 0, 64, 64), [R(0, 0, 64, 40)], { w: 0, h: 0 }, 16);
    const p = nearestFree(g, { x: 30, y: 10 });
    expect(p).not.toBeNull();
    expect(p!.y).toBeGreaterThan(40);
    const full = buildGrid(R(0, 0, 32, 32), [R(-10, -10, 60, 60)], { w: 0, h: 0 }, 16);
    expect(nearestFree(full, { x: 5, y: 5 })).toBeNull();
    expect(findPath(full, { x: 5, y: 5 }, { x: 20, y: 20 }).points).toEqual([]);
  });

  it("a big town (160 x 112 cells, a hundred buildings) routes with little work (counted, not timed: L1)", () => {
    const blockers = [];
    for (let i = 0; i < 100; i++) blockers.push(R(80 + (i % 10) * 240, 80 + Math.floor(i / 10) * 170, 150, 90));
    const g = buildGrid(R(0, 0, 2560, 1792), blockers, half);
    const r = findPath(g, { x: 20, y: 20 }, { x: 2500, y: 1750 });
    expect(r.reached).toBe(true);
    walkable(g, { x: 20, y: 20 }, r.points);
    // (deterministic: 5,016 of the 17,920 cells today; well under a third, never the whole grid)
    expect(r.expanded).toBeGreaterThan(0);
    expect(r.expanded!).toBeLessThan((g.cols * g.rows) / 3);
  });

  it("routes reuse one set of buffers (no garbage per route: R10) and never see a stale search", () => {
    const blockers = [];
    for (let i = 0; i < 100; i++) blockers.push(R(80 + (i % 10) * 240, 80 + Math.floor(i / 10) * 170, 150, 90));
    const g = buildGrid(R(0, 0, 2560, 1792), blockers, half);
    const first = findPath(g, { x: 20, y: 20 }, { x: 2500, y: 1750 });
    const cap = pathScratchSize();
    expect(cap).toBeGreaterThanOrEqual(g.cols * g.rows);
    // (other routes in between, on this grid and a small one, then the first again: the same answer)
    findPath(g, { x: 2500, y: 20 }, { x: 20, y: 1750 });
    const small = buildGrid(R(0, 0, 160, 160), [R(40, 0, 32, 120)], { w: 0, h: 0 }, 16);
    const sr = findPath(small, { x: 8, y: 8 }, { x: 150, y: 8 });
    expect(sr.reached).toBe(true);
    walkable(small, { x: 8, y: 8 }, sr.points);
    for (let i = 0; i < 50; i++) findPath(g, { x: 20 + i * 40, y: 20 }, { x: 2500 - i * 30, y: 1750 });
    expect(findPath(g, { x: 20, y: 20 }, { x: 2500, y: 1750 })).toEqual(first);
    expect(pathScratchSize()).toBe(cap);
  });
});

describe("tap to use: steering along the route", () => {
  it("full speed towards the next waypoint, easing off at the end, done on arrival", () => {
    const pts = [{ x: 100, y: 0 }, { x: 100, y: 100 }];
    let s = steer({ x: 0, y: 0 }, pts, 0);
    expect(s.x).toBeCloseTo(1);
    expect(s.idx).toBe(0);
    s = steer({ x: 95, y: 0 }, pts, 0);
    expect(s.idx).toBe(1);
    expect(s.y).toBeCloseTo(1);
    s = steer({ x: 100, y: 90 }, pts, 1);
    expect(Math.hypot(s.x, s.y)).toBeLessThan(1);
    expect(Math.hypot(s.x, s.y)).toBeGreaterThanOrEqual(0.35 - 1e-9);
    s = steer({ x: 100, y: 97 }, pts, 1);
    expect(s.done).toBe(true);
    expect(s.x).toBe(0);
  });
  it("walking a route with the scene's speed reaches the goal (a simulated walker)", () => {
    const g = buildGrid(R(0, 0, 640, 480), [R(300, 0, 40, 400)], { w: 10, h: 8 });
    const r = findPath(g, { x: 100, y: 100 }, { x: 500, y: 100 });
    let at = { x: 100, y: 100 };
    let idx = 0;
    let frames = 0;
    for (; frames < 2000; frames++) {
      const s = steer(at, r.points, idx);
      idx = s.idx;
      if (s.done) break;
      // 210 px/s at 60 fps, the town's walking speed
      at = { x: at.x + s.x * 3.5, y: at.y + s.y * 3.5 };
      expect(isFree(g, at)).toBe(true);
    }
    expect(frames).toBeLessThan(2000);
    expect(Math.hypot(at.x - 500, at.y - 100)).toBeLessThanOrEqual(5);
  });
});

describe("tap to use: reading the scenes (pure helpers)", () => {
  it("tagOf: the prompt's words without the key, first line", () => {
    expect(tagOf("E: Watch KrelTV")).toBe("Watch KrelTV");
    expect(tagOf("E / ATTACK: hit KREBON")).toBe("hit KREBON");
    expect(tagOf("E: Tip CRYSTAL (5 Krezzcoin)\n👀: Watch up close")).toBe("Tip CRYSTAL (5 Krezzcoin)");
    expect(tagOf("Nobody will wonk-off with you now.")).toBe("Nobody will wonk-off with you now.");
  });
  it("standsOn: the building whose bottom edge is just above a door's spot", () => {
    const town = [R(100, 100, 200, 150), R(500, 100, 50, 50)];
    expect(standsOn(200, 270, town)).toEqual(town[0]);
    expect(standsOn(200, 400, town)).toBeNull();
    expect(standsOn(400, 270, town)).toBeNull();
  });
  it("spotBox stands above its spot; union covers both", () => {
    const b = spotBox(100, 500, 40);
    expect(b.y + b.h).toBeGreaterThan(500);
    expect(b.y).toBeLessThan(500 - 40);
    expect(b.w).toBeGreaterThanOrEqual(44);
    expect(union(R(0, 0, 10, 10), R(20, 5, 10, 10))).toEqual(R(0, 0, 30, 15));
  });
});
