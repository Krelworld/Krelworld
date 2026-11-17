/**
 * The anime "cine beats" of chapters 1-5 (and the Chapter 6 hijack): named runs of drawn stills, cut-ins, eye shots,
 * slams, speed lines, impact frames, title cards and stingers. Played by gfx/Cine.ts (a Line's `cine`, or playCine()).
 * Data only, so the tests can check every beat's art is registered.
 */

export type CineStep =
  | { still: string; ms?: number; push?: number; shake?: number; flipX?: boolean; goreOff?: string }
  | { cut: string; from?: "left" | "right"; color?: number; hold?: number; focus?: number; y?: number; flipX?: boolean }
  | { eyes: string; ms?: number; color?: number }
  | { slam: string; color?: string; size?: number; y?: number; hold?: number }
  | { title: string; kicker?: string; clock?: string; hold?: number; y?: number }
  | { flash: number; ms?: number; alpha?: number }
  | { impact: true }
  | { lines: number; ms?: number }
  | { sfx: string; vol?: number }
  | { sting: "riser" | "subDrop" | "heartbeat" | "whoosh" | "duck"; ms?: number }
  | { wait: number }
  /** Steps that start together (the beat waits for the longest). */
  | { par: CineStep[] };

// ---------------------------------------------------------------- the beats

const PINK = 0xff4fd8;
const GOLD = 0xfde047;

export const CINE: Record<string, CineStep[]> = {
  // ---- Chapter 1: THE GREAT SILENCE
  ch1_open: [
    { sfx: "c15_sting_open" },
    { par: [{ still: "c15_still_silence", ms: 3200, push: 0.08, shake: 0 }, { title: "THE GREAT SILENCE", kicker: "CHAPTER ONE", hold: 2300, y: 420 }] },
  ],
  ch1_leave: [{ sting: "duck", ms: 1600 }, { eyes: "fe_eyes_drongus1", ms: 900, color: 0xef4444 }],
  ch1_gates: [
    { sfx: "c15_sting_dread" },
    { impact: true },
    { still: "c15_still_silence", ms: 2000, push: 0.12, shake: 0.012 },
    { slam: "THE LORE HAS STOPPED", color: "#cbd5e1", size: 44, hold: 900 },
  ],
  ch1_krandall: [{ cut: "c15_cut_krandall", from: "right", color: 0xfacc15, hold: 1000 }],
  ch1_krandall_down: [
    { impact: true },
    { par: [{ lines: 0xff6bb0, ms: 900 }, { still: "c15_still_krandall_fall", ms: 1900, push: 0.1, shake: 0.008 }] },
    { slam: "THE MAIN RECONNECTS", color: "#ff6bb0", size: 44, hold: 800 },
  ],
  ch1_tap: [{ sfx: "c15_sting_triumph" }, { still: "c15_still_tap", ms: 2600, push: 0.1, shake: 0 }],
  ch1_wildern: [
    { sfx: "c15_sting_boom" },
    { impact: true },
    { par: [{ flash: 0xfff1a8, ms: 400, alpha: 0.8 }, { still: "c15_still_wildern_boom", ms: 2400, push: 0.14, shake: 0.02 }] },
  ],

  // ---- Chapter 2: THE INTERVENTION
  ch2_open: [
    { sfx: "c15_sting_open" },
    { title: "THE INTERVENTION", kicker: "CHAPTER TWO", hold: 2000 },
  ],
  ch2_sos: [{ cut: "c15_cut_polson", from: "left", color: 0x60a5fa, hold: 1000 }],
  ch2_warroom: [{ cut: "c15_cut_krezwonk", from: "right", color: 0xef4444, hold: 900 }, { slam: "TO THE WAR ROOM", color: "#ef4444", size: 48, hold: 700 }],
  ch2_cyst: [
    { sfx: "c15_sting_dread" },
    { par: [{ lines: 0xf472b6, ms: 900 }, { still: "c15_still_cyst_rise", ms: 2300, push: 0.12, shake: 0.014 }] },
    { cut: "c15_cut_cyst", from: "right", color: 0xf472b6, hold: 900 },
  ],
  ch2_burst: [
    { impact: true },
    { sfx: "c15_sting_boom", vol: 0.8 },
    { par: [{ flash: 0xffffff, ms: 400, alpha: 0.7 }, { still: "c15_still_cyst_burst", goreOff: "c15_still_cyst_burst_clean", ms: 2200, push: 0.14, shake: 0.018 }] },
    { slam: "BURST", color: "#f9a8d4", size: 72, hold: 700 },
  ],
  ch2_network: [{ sfx: "c15_sting_triumph", vol: 0.8 }, { slam: "❤️ FROM POLSON", color: "#ff4d6d", size: 50, hold: 1100 }],

  // ---- Chapter 3: THE CUDDLE CRONSTER
  ch3_open: [
    { sfx: "c15_sting_dread" },
    { par: [{ still: "c15_still_cronster_note", ms: 3000, push: 0.08, shake: 0 }, { title: "THE CUDDLE CRONSTER", kicker: "CHAPTER THREE", hold: 2200, y: 420 }] },
  ],
  ch3_gone: [{ sting: "whoosh" }, { cut: "c15_cut_flenky", from: "left", color: 0xef4444, hold: 1000 }, { slam: "MOLLOR'S GONE", color: "#ef4444", size: 60, hold: 700 }],
  ch3_cronster: [
    { sting: "heartbeat" },
    { eyes: "c15_eyes_cronster", ms: 900, color: PINK },
    { cut: "c15_cut_cronster", from: "right", color: PINK, hold: 1000 },
  ],
  ch3_unmask: [
    { sting: "duck", ms: 2600 },
    { sfx: "c15_sting_reveal" },
    { impact: true },
    { par: [{ lines: PINK, ms: 900 }, { still: "c15_still_unmask", ms: 2600, push: 0.14, shake: 0.01 }] },
  ],
  ch3_jenko: [{ cut: "c15_cut_jenko", from: "left", color: PINK, hold: 1000 }, { slam: "IT WAS JENKO", color: "#ff4fd8", size: 56, hold: 800 }],
  ch3_dark: [
    { sfx: "c15_sting_reveal" },
    { impact: true },
    { par: [{ lines: 0x7c3aed, ms: 1000 }, { still: "c15_still_darkjenko", ms: 2400, push: 0.14, shake: 0.014 }] },
    { slam: "DARK JENKO", color: "#a855f7", size: 64, hold: 800 },
  ],
  ch3_mollor: [{ sfx: "c15_sting_triumph", vol: 0.8 }, { still: "c15_still_mollor_free", ms: 2400, push: 0.1, shake: 0 }],
  ch3_golden: [
    { sfx: "c15_sting_power" },
    { par: [{ lines: GOLD, ms: 1200 }, { still: "c15_still_golden", ms: 2200, push: 0.14, shake: 0.01 }] },
    { slam: "GOLDEN JUICE", color: "#fde047", size: 60, hold: 800 },
  ],

  // ---- Chapter 4: NIBBLE ON A CROBLEY
  ch4_open: [
    { sfx: "c15_sting_open" },
    { par: [{ still: "c15_still_crobley_tv", ms: 3000, push: 0.08, shake: 0 }, { title: "NIBBLE ON A CROBLEY", kicker: "CHAPTER FOUR", hold: 2200, y: 420 }] },
  ],
  ch4_reinhardt: [
    { sting: "heartbeat" },
    { cut: "c15_cut_reinhardt", from: "right", color: 0xef4444, hold: 1100 },
  ],
  ch4_nibble: [{ impact: true }, { slam: "NIBBLE ON THIS", color: "#ef4444", size: 58, hold: 700 }],
  ch4_boom: [
    { sfx: "c15_sting_boom" },
    { impact: true },
    { par: [{ flash: 0xfff1a8, ms: 500, alpha: 0.85 }, { lines: 0xf97316, ms: 1000 }, { still: "c15_still_tank_boom", ms: 2600, push: 0.16, shake: 0.022 }] },
    { slam: "KA-BLOOEY", color: "#fde047", size: 72, hold: 800 },
  ],

  // ---- Chapter 5: THE SANMIKVERSE
  ch5_open: [
    { sfx: "c15_sting_open" },
    { par: [{ still: "c15_still_lamp", ms: 3000, push: 0.08, shake: 0 }, { title: "THE SANMIKVERSE", kicker: "CHAPTER FIVE", hold: 2200, y: 420 }] },
  ],
  ch5_tub: [
    { sfx: "c15_sting_dread" },
    { still: "c15_still_rik_tub", ms: 2800, push: 0.1, shake: 0 },
    { cut: "c15_cut_rik", from: "right", color: 0x84cc16, hold: 1000 },
  ],
  ch5_song: [{ cut: "c15_cut_sanmik", from: "left", color: 0xb0c4ff, hold: 900 }],
  ch5_rise: [
    { sting: "subDrop" },
    { par: [{ lines: 0x84cc16, ms: 1000 }, { still: "c15_still_rik_rise", ms: 2400, push: 0.14, shake: 0.018 }] },
  ],
  ch5_arsehole: [{ sfx: "c15_sting_reveal" }, { impact: true }, { cut: "c15_cut_rik", from: "right", color: 0xef4444, hold: 900 }],
  ch5_shrink: [
    { sfx: "c15_sting_power" },
    { par: [{ lines: 0x67e8f9, ms: 1000 }, { still: "c15_still_shrink", ms: 2200, push: 0.16, shake: 0.012 }] },
    { slam: "*ZWOOOOP*", color: "#67e8f9", size: 60, hold: 700 },
  ],
  ch5_colon: [{ title: "UNCLE RIK'S COLON", kicker: "FOUR MILLIMETRES TALL", hold: 1700 }],

  // ---- Chapter 6: the hijack (the rest of 6 has its own pass)
  ch6_hijack: [
    { sfx: "c15_sting_power", vol: 0.8 },
    { par: [{ lines: 0xffffff, ms: 900 }, { still: "c15_still_hijack", ms: 2400, push: 0.12, shake: 0.01 }] },
    { slam: "FLIGHT KR-069 IS OURS", color: "#ff4fd8", size: 46, hold: 900 },
  ],

  // ---- every crystal
  crystal: [{ par: [{ lines: 0xf472b6, ms: 900 }, { still: "c15_still_crystal", ms: 1900, push: 0.12, shake: 0 }] }],

  // ---- closings
  ch2_close: [{ title: "THE INTERVENTION", kicker: "CHAPTER TWO · COMPLETE", hold: 1500 }],
  ch3_close: [{ title: "THE CUDDLE CRONSTER", kicker: "CHAPTER THREE · COMPLETE", hold: 1500 }],
  ch4_close: [{ title: "NIBBLE ON A CROBLEY", kicker: "CHAPTER FOUR · COMPLETE", hold: 1500 }],
  ch5_close: [{ title: "THE SANMIKVERSE", kicker: "CHAPTER FIVE · COMPLETE", hold: 1500 }],
};

/** Every art key the beats use (the art test checks they're registered). */
export function cineKeys(): string[] {
  const out = new Set<string>();
  const walk = (st: CineStep) => {
    if ("par" in st) st.par.forEach(walk);
    else if ("still" in st) out.add(st.still);
    else if ("cut" in st) out.add(st.cut);
    else if ("eyes" in st) out.add(st.eyes);
  };
  Object.values(CINE).forEach((b) => b.forEach(walk));
  return [...out];
}
