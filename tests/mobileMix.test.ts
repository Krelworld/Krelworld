// Stage 3 wave 2, the phone's sound mix: the gain plan (mixLogic.ts). The graph itself is checked by the phone smoke
// test's "platform" section and measured offline (report s3-08-sound.md).
import { describe, expect, it } from "vitest";
import { ceilingCurve, dbfs, MAX_PEAK, mixGains, mixLine, OFF, pathGains, PHONE_MIX, sliderLevels } from "../src/game/mobile/mixLogic";

const DEFAULTS = { master: 0.8, music: 0.5, sfx: 0.8, voiceVolume: 0.8 };

describe("phone mix: the plan", () => {
  it("voices and effects are pushed harder than songs; songs sit a little lower than on a laptop", () => {
    expect(PHONE_MIX.drive.voice).toBeGreaterThan(1);
    expect(PHONE_MIX.drive.sfx).toBeGreaterThan(1);
    expect(PHONE_MIX.out.music).toBeLessThan(1);
    expect(PHONE_MIX.out.music).toBeGreaterThan(0.5);
    // the voice path ends louder than the music path relative to the laptop
    expect(PHONE_MIX.drive.voice * PHONE_MIX.out.voice).toBeGreaterThan(PHONE_MIX.drive.music * PHONE_MIX.out.music);
  });

  it("the compressors are moderate and quick, and the ceiling is under -1 dBFS", () => {
    for (const c of [PHONE_MIX.comp.voice, PHONE_MIX.comp.sfx]) {
      expect(c.threshold).toBeLessThan(0);
      expect(c.ratio).toBeGreaterThanOrEqual(2);
      expect(c.ratio).toBeLessThanOrEqual(10);
      expect(c.attack).toBeLessThanOrEqual(0.01);
      expect(c.release).toBeGreaterThanOrEqual(0.05);
    }
    expect(PHONE_MIX.ceiling).toBeLessThan(MAX_PEAK);
    expect(PHONE_MIX.kneeAt).toBeLessThan(PHONE_MIX.ceiling);
    expect(PHONE_MIX.lowCut).toBeGreaterThan(40);
    expect(PHONE_MIX.lowCut).toBeLessThan(250);
  });
});

describe("phone mix: the player's sliders", () => {
  it("reads them as the game applies them (Synth.ts, Voice.ts), with a new save's defaults", () => {
    const l = sliderLevels(DEFAULTS);
    expect(l.music).toBeCloseTo(0.4);
    expect(l.voice).toBeCloseTo(0.8);
    expect(l.sfx).toBeCloseTo(0.64);
    expect(sliderLevels({})).toEqual(l);
    expect(sliderLevels({ master: 1, voiceVolume: 1 }).voice).toBe(1); // capped like the game's
    expect(sliderLevels({ master: 7, music: -1 }).music).toBe(0);
  });

  it("pre takes the slider out of the signal and post puts it back (with the output trim)", () => {
    const k = mixGains(DEFAULTS);
    expect(k.song.pre * 0.4).toBeCloseTo(1);
    expect(k.song.post).toBeCloseTo(0.4 * PHONE_MIX.out.music);
    expect(k.voice.pre * 0.8).toBeCloseTo(1);
    expect(k.voice.post).toBeCloseTo(0.8 * PHONE_MIX.out.voice);
    // the chiptune's gain holds only the Music slider, the effects' only the Effects slider: Master is in post
    expect(k.chip.pre * 0.5).toBeCloseTo(1);
    expect(k.chip.post).toBeCloseTo(k.song.post);
    expect(k.sfx.pre * 0.8).toBeCloseTo(1);
    expect(k.sfx.post).toBeCloseTo(0.64 * PHONE_MIX.out.sfx);
  });

  it("every slider still scales its paths exactly: half the slider, half the output", () => {
    const a = mixGains(DEFAULTS);
    const b = mixGains({ ...DEFAULTS, master: 0.4 });
    expect(b.song.post / a.song.post).toBeCloseTo(0.5);
    expect(b.sfx.post / a.sfx.post).toBeCloseTo(0.5);
    expect(b.voice.post / a.voice.post).toBeCloseTo(0.5);
    const c = mixGains({ ...DEFAULTS, music: 0.25 });
    expect(c.song.post / a.song.post).toBeCloseTo(0.5);
    expect(c.voice.post).toBeCloseTo(a.voice.post);
    const d = mixGains({ ...DEFAULTS, voiceVolume: 0.4 });
    expect(d.voice.post / a.voice.post).toBeCloseTo(0.5);
    expect(d.sfx.post).toBeCloseTo(a.sfx.post);
    // what the compressor sees (the signal's slider part times pre) does not change with any slider
    for (const s of [DEFAULTS, { ...DEFAULTS, master: 0.3 }, { master: 1, music: 1, sfx: 1, voiceVolume: 1 }]) {
      const k = mixGains(s);
      const l = sliderLevels(s);
      expect(k.voice.pre * l.voice).toBeCloseTo(1);
      expect(k.song.pre * l.music).toBeCloseTo(1);
    }
  });

  it("a slider at 0 is silence (pre and post 0, no division by zero)", () => {
    expect(pathGains(0, 0, 1)).toEqual({ pre: 0, post: 0 });
    expect(pathGains(OFF / 2, 0.5, 1)).toEqual({ pre: 0, post: 0 });
    const m = mixGains({ ...DEFAULTS, master: 0 });
    for (const p of [m.song, m.chip, m.sfx, m.voice]) expect(p).toEqual({ pre: 0, post: 0 });
    const v = mixGains({ ...DEFAULTS, voiceVolume: 0 });
    expect(v.voice).toEqual({ pre: 0, post: 0 });
    expect(v.song.post).toBeGreaterThan(0);
    const z = mixGains({ ...DEFAULTS, music: 0 });
    expect(z.song).toEqual({ pre: 0, post: 0 });
    expect(z.chip).toEqual({ pre: 0, post: 0 });
    for (const p of Object.values(mixGains({ master: Number.NaN }))) {
      expect(Number.isFinite(p.pre)).toBe(true);
      expect(Number.isFinite(p.post)).toBe(true);
    }
  });
});

describe("phone mix: the ceiling", () => {
  const curve = ceilingCurve();
  it("is a straight line below its knee, rising, odd-symmetric, and never reaches -1 dBFS", () => {
    const n = curve.length;
    const at = (x: number) => curve[Math.round(((x + 1) / 2) * (n - 1))];
    for (const x of [0, 0.1, 0.3, 0.5, PHONE_MIX.kneeAt - 0.01]) expect(at(x)).toBeCloseTo(x, 3);
    for (let i = 1; i < n; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    for (let i = 0; i < n; i++) expect(curve[i]).toBeCloseTo(-curve[n - 1 - i], 6);
    let peak = 0;
    for (const v of curve) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(MAX_PEAK);
    expect(dbfs(peak)).toBeLessThan(-1);
  });

  it("asked for a ceiling above -1 dBFS, still keeps under it", () => {
    let peak = 0;
    for (const v of ceilingCurve(1025, 1, 0.5)) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThanOrEqual(MAX_PEAK);
  });
});

describe("phone mix: the ?mobilediag line", () => {
  it("names the drives, the squeeze and the peak", () => {
    const l = mixLine(PHONE_MIX, { voice: -3.24, sfx: null }, 0.5);
    expect(l).toMatch(/^sound mix phone:/);
    expect(l).toMatch(/voice drive \+9\.5 dB/);
    expect(l).toMatch(/squeeze now voice 3\.2 \/ effects \? dB/);
    expect(l).toMatch(/peak -6 dBFS/);
    expect(mixLine(PHONE_MIX, { voice: 0, sfx: 0 }, 0)).toMatch(/peak silent/);
  });
});
