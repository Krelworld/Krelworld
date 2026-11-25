import { describe, expect, it } from "vitest";
import { JumpBrain, DropRule, JUMP_TUNE, jumpHeight, ledgePop, cornerNudge, oneWayLands, easeMs, LookAhead, camLerp, camLagPx } from "../src/game/mobile/jump";

// A tiny side-room physics model: the game's update runs at the display rate (30, 60 or 120 Hz), the Arcade physics at
// its fixed 60 Hz step (Phaser's fixedStep: 0, 1 or 2 steps a frame); gravity 1500, a floor at y = 0 (up is negative).
function sim(hz: number, script: (t: number) => { press?: boolean; held: boolean; floor?: boolean }, ms = 1500) {
  const dt = 1000 / hz;
  const b = new JumpBrain();
  let y = 0;
  let vy = 0;
  let grounded = true;
  let apex = 0;
  const takeoffs: { t: number; kind: string }[] = [];
  let wasHeld = false;
  let acc = 0;
  const STEP = 1000 / 60;
  for (let t = 0; t <= ms; t += dt) {
    const s = script(t);
    if (s.press) b.press(t);
    if (wasHeld && !s.held) b.release(t);
    wasHeld = s.held;
    const o = b.step({ now: t, grounded, vy, held: s.held, rise: -y });
    if (o.jumpVy !== undefined) {
      vy = o.jumpVy;
      takeoffs.push({ t, kind: o.kind! });
    }
    if (o.cutVy !== undefined) vy = o.cutVy;
    // physics: fixed 60 Hz steps
    acc += dt;
    while (acc >= STEP - 1e-6) {
      acc -= STEP;
      vy += JUMP_TUNE.gravity * (STEP / 1000);
      y += vy * (STEP / 1000);
      const floorHere = s.floor !== false;
      if (floorHere && y >= 0) {
        y = 0;
        vy = 0;
        grounded = true;
      } else grounded = false;
      apex = Math.min(apex, y);
    }
  }
  return { apex: -apex, takeoffs };
}

describe("phone jump: variable height (tap = hop, hold = the game's full jump)", () => {
  it("closed form: hop about 78 px, full about 145 px", () => {
    expect(jumpHeight(660, null, 300)).toBeCloseTo(145.2, 1);
    expect(jumpHeight(660, 80, 300)).toBeCloseTo(78, 0);
  });
  for (const hz of [10, 30, 60, 120]) {
    it(`${hz} Hz: a tap hops about 78 px, a hold jumps about 145 px`, () => {
      const tap = sim(hz, (t) => ({ press: t === 0, held: t < 40 }));
      const hold = sim(hz, (t) => ({ press: t === 0, held: t < 600 }));
      expect(tap.takeoffs.length).toBe(1);
      expect(tap.apex).toBeGreaterThan(66);
      expect(tap.apex).toBeLessThan(92);
      expect(hold.apex).toBeGreaterThan(135);
      expect(hold.apex).toBeLessThan(152);
      expect(hold.apex - tap.apex).toBeGreaterThan(45);
    });
  }
  it("a release half-way up gives a height between hop and full", () => {
    const mid = sim(60, (t) => ({ press: t === 0, held: t < 200 }));
    expect(mid.apex).toBeGreaterThan(95);
    expect(mid.apex).toBeLessThan(145);
  });
});

describe("phone jump: buffer and coyote", () => {
  for (const hz of [30, 60, 120]) {
    it(`${hz} Hz: a press 120 ms before landing jumps on landing`, () => {
      const dt = 1000 / hz;
      const b = new JumpBrain();
      // in the air, no jumps left, falling
      b.step({ now: 0, grounded: true, vy: 0, held: false });
      b.jumps = 0;
      b.coyoteUntil = 0;
      b.press(1000 - 120);
      let jumped: number | null = null;
      for (let t = 1000 - 120; t <= 1200; t += dt) {
        const o = b.step({ now: t, grounded: t >= 1000, vy: t >= 1000 ? 0 : 300, held: true });
        if (o.jumpVy !== undefined) {
          jumped = t;
          expect(o.kind).toBe("first");
          break;
        }
      }
      expect(jumped).not.toBeNull();
      expect(jumped! - 1000).toBeLessThan(dt + 0.01);
    });
    it(`${hz} Hz: a press 200 ms before landing is forgotten (no surprise jump)`, () => {
      const dt = 1000 / hz;
      const b = new JumpBrain();
      b.jumps = 0;
      b.press(800);
      let jumped = false;
      for (let t = 800; t <= 1200; t += dt) if (b.step({ now: t, grounded: t >= 1000, vy: 300, held: false }).jumpVy !== undefined) jumped = true;
      expect(jumped).toBe(false);
    });
    it(`${hz} Hz: walked off a ledge, a press 130 ms later is still the first (full) jump`, () => {
      const dt = 1000 / hz;
      const b = new JumpBrain();
      let t = 0;
      for (; t < 500; t += dt) b.step({ now: t, grounded: true, vy: 0, held: false });
      const left = t; // the last grounded frame was t - dt
      for (; t < left + 130 - dt; t += dt) b.step({ now: t, grounded: false, vy: 100, held: false });
      b.press(t);
      const o = b.step({ now: t, grounded: false, vy: 100, held: true });
      expect(o.kind).toBe("first");
      expect(o.jumpVy).toBe(-660);
    });
  }
  for (const hz of [30, 60, 120]) {
    it(`${hz} Hz: walked off a ledge, a press 135 ms later read on the next frame is still the first jump (F6)`, () => {
      const dt = 1000 / hz;
      const b = new JumpBrain();
      let t = 0;
      let lastGround = 0;
      for (; t < 500; t += dt) {
        b.step({ now: t, grounded: true, vy: 0, held: false });
        lastGround = t;
      }
      const pressAt = lastGround + 135;
      for (; t < pressAt; t += dt) b.step({ now: t, grounded: false, vy: 100, held: false });
      b.press(pressAt);
      const o = b.step({ now: t, grounded: false, vy: 100, held: true });
      expect(o.kind).toBe("first");
    });
  }
  for (const hz of [120, 144, 240]) {
    it(`${hz} Hz: tapping JUMP three times quickly is one jump and the air jump, never a second first jump (F1)`, () => {
      for (const gaps of [[30, 150], [60, 120], [100, 60]]) {
        const at = [0, gaps[0], gaps[0] + gaps[1]];
        const dt = 1000 / hz;
        let prev = -1;
        const r = sim(hz, (t) => {
          const press = at.some((a) => a > prev && a <= t);
          prev = t;
          return { press, held: at.some((a) => t >= a && t < a + 25) };
        });
        expect(r.takeoffs.map((x) => x.kind)).toEqual(["first", "air"]);
        expect(r.apex).toBeLessThan(150);
        expect(dt).toBeGreaterThan(0);
      }
    });
  }
  it("a press made during a dodge or a long hit-stop (no step runs) jumps on the first step after it (F2)", () => {
    for (const into of [0, 20, 50, 100]) {
      for (const gap of [170, 230, 200]) {
        const b = new JumpBrain();
        b.step({ now: 0, grounded: true, vy: 0, held: false });
        b.step({ now: 16, grounded: true, vy: 0, held: false });
        // the dodge: no steps from 16 to 16 + gap; JUMP pressed `into` ms in (stamped with the scene clock)
        b.press(16 + into);
        const o = b.step({ now: 16 + gap, grounded: true, vy: 0, held: true });
        expect(o.kind).toBe("first");
      }
    }
    // a normal frame rate never ages a press that way: a press 200 ms old at 60 Hz is still forgotten
    const b = new JumpBrain();
    b.jumps = 0;
    for (let t = 0; t < 800; t += 16) b.step({ now: t, grounded: false, vy: 300, held: false });
    b.press(800);
    let jumped = false;
    for (let t = 800; t <= 1200; t += 16) if (b.step({ now: t, grounded: t >= 1000, vy: 300, held: false }).jumpVy !== undefined) jumped = true;
    expect(jumped).toBe(false);
  });
  it("coyote is 140 ms on a phone (the game's 110 with phone assist off)", () => {
    const b = new JumpBrain();
    b.step({ now: 0, grounded: true, vy: 0, held: false });
    expect(b.coyoteUntil).toBe(140);
    b.step({ now: 0, grounded: true, vy: 0, held: false, assist: false });
    expect(b.coyoteUntil).toBe(110);
  });
  it("after the coyote time the press is the air jump", () => {
    const b = new JumpBrain();
    b.step({ now: 0, grounded: true, vy: 0, held: false });
    b.press(200);
    const o = b.step({ now: 200, grounded: false, vy: 300, held: true });
    expect(o.kind).toBe("air");
    expect(o.jumpVy).toBe(-580);
  });
  it("the second press in the air is the double jump; a third does nothing until landing", () => {
    const b = new JumpBrain();
    b.step({ now: 0, grounded: true, vy: 0, held: false });
    b.press(0);
    expect(b.step({ now: 0, grounded: true, vy: 0, held: true }).kind).toBe("first");
    b.release(50);
    b.press(300);
    expect(b.step({ now: 300, grounded: false, vy: -100, held: true }).kind).toBe("air");
    b.press(400);
    expect(b.step({ now: 400, grounded: false, vy: 0, held: true }).kind).toBeUndefined();
  });
  it("reset() drops a held or waiting press (room or mode change mid-jump)", () => {
    const b = new JumpBrain();
    b.jumps = 0;
    b.press(100);
    b.reset();
    expect(b.step({ now: 120, grounded: true, vy: 0, held: false }).jumpVy).toBeUndefined();
  });
});

describe("phone drop-through: only on purpose", () => {
  it("a drift down never drops; held well down for 150 ms does", () => {
    const d = new DropRule();
    expect(d.step(0, { x: 0.1, y: 0.5 }, false, true)).toBeNull();
    expect(d.step(500, { x: 0.5, y: 0.8 }, false, true)).toBeNull(); // too sideways
    expect(d.step(600, { x: 0.1, y: 0.8 }, false, true)).toBeNull();
    expect(d.step(700, { x: 0.1, y: 0.8 }, false, true)).toBeNull();
    expect(d.step(760, { x: 0.1, y: 0.8 }, false, true)).toBe("drop");
    // once per hold
    expect(d.step(900, { x: 0.1, y: 0.8 }, false, true)).toBeNull();
  });
  it("stick down + JUMP drops at once (on a platform only)", () => {
    const d = new DropRule();
    expect(d.step(0, { x: 0, y: 0.6 }, true, true)).toBe("drop");
    expect(d.step(0, { x: 0, y: 0.6 }, true, false)).toBeNull();
    expect(d.step(0, { x: 0.9, y: 0.3 }, true, true)).toBeNull(); // running and jumping
    expect(d.step(0, { x: 0.45, y: 0.6 }, true, true)).toBeNull(); // a thumb sunk low while running right (F7)
    expect(d.step(0, { x: 0.55, y: 0.55 }, true, true)).toBeNull();
    expect(d.step(0, { x: 0.2, y: 0.7 }, true, true)).toBe("drop");
    expect(d.step(0, null, true, true)).toBeNull();
  });
});

describe("phone ledge forgiveness and air control", () => {
  it("one-way platforms take a landing 20 px low (the game's 14 is unchanged elsewhere)", () => {
    expect(oneWayLands(10, 119, 100, JUMP_TUNE.ledgeTol)).toBe(true);
    expect(oneWayLands(10, 119, 100, JUMP_TUNE.gameLedgeTol)).toBe(false);
    expect(oneWayLands(-10, 101, 100, JUMP_TUNE.ledgeTol)).toBe(false);
  });
  it("ledge pop: feet 6 px under a solid top, pushing into it = on top; 12 px under = no", () => {
    const blk = { left: 100, right: 200, top: 300, bottom: 400 };
    expect(ledgePop({ left: 80, right: 100, top: 270, bottom: 306 }, 50, 1, blk, false)).toBeCloseTo(6.5);
    expect(ledgePop({ left: 80, right: 100, top: 276, bottom: 312 }, 50, 1, blk, false)).toBe(0);
    expect(ledgePop({ left: 80, right: 100, top: 270, bottom: 306 }, 50, -1, blk, false)).toBe(0);
    // a platform's top counts 4 px wider each side
    expect(ledgePop({ left: 77, right: 97, top: 270, bottom: 303 }, 50, 0, blk, true)).toBeCloseTo(3.5);
    expect(ledgePop({ left: 70, right: 90, top: 270, bottom: 303 }, 50, 0, blk, true)).toBe(0);
  });
  it("corner correction nudges a head that clips a corner by under 40% of the body", () => {
    const blk = { left: 0, right: 105, top: 200, bottom: 250 };
    expect(cornerNudge({ left: 100, right: 120, top: 252, bottom: 290 }, -500, 16.7, blk)).toBeCloseTo(5.5);
    expect(cornerNudge({ left: 90, right: 110, top: 252, bottom: 290 }, -500, 16.7, blk)).toBe(0);
    expect(cornerNudge({ left: 100, right: 120, top: 252, bottom: 290 }, 100, 16.7, blk)).toBe(0);
  });
  it("air control eases in 100 ms on a phone (the game's 140 with assist off; ground 70)", () => {
    expect(easeMs(false)).toBe(100);
    expect(easeMs(false, false)).toBe(140);
    expect(easeMs(true)).toBe(70);
  });
  it("the camera looks ahead: player at 35% / 65%, turning only after 0.4 s the other way", () => {
    const l = new LookAhead();
    l.snap(1, 960);
    expect(l.x).toBeCloseTo(-144);
    let t = 0;
    for (; t < 300; t += 16) l.step(t, 16, -1, 960);
    expect(l.facing()).toBe(1);
    for (; t < 1500; t += 16) l.step(t, 16, -1, 960);
    expect(l.facing()).toBe(-1);
    expect(l.x).toBeGreaterThan(130);
  });
});

describe("phone side-room camera at any frame rate (F4)", () => {
  // Phaser's follow: each frame scroll += (player - offset - scroll) * lerp; the view is 960 wide
  for (const hz of [30, 60, 90, 120, 144]) {
    it(`${hz} Hz: running right the player sits at 35% of the width, running left at 65%`, () => {
      const dt = 1000 / hz;
      for (const dir of [1, -1]) {
        const l = new LookAhead();
        l.snap(dir, 960);
        let x = 2000;
        let centre = x;
        let t = 0;
        for (; t < 1300; t += dt) {
          x += dir * 260 * (dt / 1000);
          const off = l.step(t, dt, dir, 960) - camLagPx(dir * 260, dt);
          centre += (x - off - centre) * camLerp(dt);
        }
        const share = (x - (centre - 480)) / 960;
        expect(Math.abs(share - (dir > 0 ? 0.35 : 0.65))).toBeLessThan(0.01);
      }
    });
  }
  it("is the game's 0.12 a frame at 60 Hz", () => {
    expect(camLerp(1000 / 60)).toBeCloseTo(0.12, 6);
  });
});

import { padActive, padWoke, padRest, PadHandover } from "../src/game/mobile/pad";
import { vi } from "vitest";
import { resolveMode, setInputSource, currentInputSource } from "../src/game/mobile/modes";

describe("a controller on the phone (S6 / R11)", () => {
  it("a button press or a pushed stick counts; a resting pad (slight drift) doesn't", () => {
    expect(padActive({ buttons: [{ pressed: false, value: 0 }], axes: [0.1, -0.2, 0, 0] })).toBe(false);
    expect(padActive({ buttons: [{ pressed: true }], axes: [0, 0] })).toBe(true);
    expect(padActive({ buttons: [], axes: [0, 0.6] })).toBe(true);
    expect(padActive({ connected: false, buttons: [{ pressed: true }], axes: [] })).toBe(false);
    expect(padActive(null)).toBe(false);
  });
  it("a pad resting off-centre (triggers at -1, a drifting stick, a button resting down) never takes over (R2)", () => {
    const pad = (axes: number[], pressed: number[] = []) => ({ id: "generic", buttons: Array.from({ length: 12 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })), axes });
    const rest = padRest(pad([0, 0, 0, 0, -1, -1]));
    expect(padWoke(pad([0, 0, 0, 0, -1, -1]), rest)).toBe(false);
    expect(padWoke(pad([0.6, 0, 0, 0, -1, -1]), rest)).toBe(true);
    expect(padWoke(pad([0, 0, 0, 0, 0, -1]), rest)).toBe(true);
    expect(padWoke(pad([0, 0, 0, 0, -1, -1], [3]), rest)).toBe(true);
    const drift = padRest(pad([0.5, 0, 0, 0]));
    expect(padWoke(pad([0.55, 0, 0, 0]), drift)).toBe(false);
    const stuck = padRest(pad([0, 0, 0, 0], [7]));
    expect(padWoke(pad([0, 0, 0, 0], [7]), stuck)).toBe(false);
    // the handover itself, frame by frame, with navigator.getGamepads faked
    let cur = pad([0, 0, 0, 0, -1, -1]);
    vi.stubGlobal("navigator", { getGamepads: () => [cur] });
    try {
      setInputSource("touch");
      const h = new PadHandover();
      for (let i = 0; i < 30; i++) h.poll();
      expect(currentInputSource()).toBe("touch");
      cur = pad([0, 0, 0, 0, -1, -1], [0]);
      h.poll();
      expect(currentInputSource()).toBe("pad");
      expect(h.handovers).toBe(1);
      // a finger takes over (what start()'s touchstart listener does) with the button still down: it stays touch
      setInputSource("touch");
      (h as unknown as { rest: unknown; touched: boolean }).rest = null;
      (h as unknown as { touched: boolean }).touched = true;
      for (let i = 0; i < 30; i++) h.poll();
      expect(currentInputSource()).toBe("touch");
      // let go and press again: the pad takes over again
      cur = pad([0, 0, 0, 0, -1, -1]);
      h.poll();
      cur = pad([0, 0, 0, 0, -1, -1], [0]);
      h.poll();
      expect(currentInputSource()).toBe("pad");
    } finally {
      vi.unstubAllGlobals();
      setInputSource("touch");
    }
  });
  it("the decision carries input: pad only while a pad is in use (touch adds nothing)", () => {
    const view = { scenes: [{ key: "Hub" }] };
    expect("input" in resolveMode(view)).toBe(false);
    expect(resolveMode({ ...view, input: "pad" }).input).toBe("pad");
    setInputSource("pad");
    expect(currentInputSource()).toBe("pad");
    setInputSource("touch");
    expect(currentInputSource()).toBe("touch");
  });
});
