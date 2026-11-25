// Stage 3, the phone platform: the pure rules of the texture budget, the sound and the frame-rate savers.
import { describe, expect, it } from "vitest";
import { KEEP_MS, parkable, shouldPark } from "../src/game/mobile/artLogic";
import { audioKind, routeSilent, SILENT_AFTER_S, sessionType, volumePlan } from "../src/game/mobile/audioLogic";
import { MAX_POOLS, offView, poolsToHide, wantsMarker } from "../src/game/mobile/perfLogic";

describe("phone texture budget (artLogic)", () => {
  it("parks the big one-scene pictures and nothing that is on screen nearly all the time", () => {
    for (const k of ["tvface_MARK", "tvanchor_KLERBLE", "tva_vfx_splat", "tvdrp_set", "bossanim_hoard", "bossdie_krandall", "bossdown_brand", "krelact_FLENKY", "krelvic_hoard", "kc_decap", "kca_decap", "kcf_decap", "kcv_hoard", "vs_FLENKY", "fe_still_dawn", "fe_cut_concept", "c15_still_crystal", "ss_cut_mum", "kb_still_wide", "fe_eyes_concept"])
      expect(parkable(k), k).toBe(true);
    for (const k of ["spr_FLENKY", "bg_title", "tv_set_frame", "vfx_fire", "vfx_bloodpool", "en_rat", "boss_banhammer", "fe_concept_slam", "p_pipe", "bld_TOWN_HALL", "pt_FLENKY", "ui_panel", "kd_coin"])
      expect(parkable(k), k).toBe(false);
  });

  it("parks a live picture only once nothing has used it for KEEP_MS and nothing holds it", () => {
    expect(shouldPark("live", 0, KEEP_MS, false)).toBe(true);
    expect(shouldPark("live", 0, KEEP_MS - 1, false)).toBe(false);
    expect(shouldPark("live", 0, KEEP_MS * 3, true)).toBe(false);
    expect(shouldPark("loading", 0, KEEP_MS * 3, false)).toBe(false);
    expect(shouldPark("parked", 0, KEEP_MS * 3, false)).toBe(false);
  });
});

describe("phone sound (audioLogic)", () => {
  it("tells a slowed voice line (blob:) from a song", () => {
    expect(audioKind("blob:http://x/123")).toBe("voice");
    expect(audioKind("audio/music/title.mp3")).toBe("music");
    expect(audioKind(undefined)).toBe("music");
  });

  it("plays over the player's own music only when asked", () => {
    expect(sessionType(false)).toBe("playback");
    expect(sessionType(true)).toBe("ambient");
  });

  it("routed: the gain carries the volume and the element stays full; direct: the element's volume, muted at 0", () => {
    expect(volumePlan(0.4, true)).toEqual({ gain: 0.4, elementVolume: 1, muted: false });
    expect(volumePlan(0, true)).toEqual({ gain: 0, elementVolume: 1, muted: false });
    expect(volumePlan(0.4, false)).toEqual({ gain: 1, elementVolume: 0.4, muted: false });
    expect(volumePlan(0, false)).toEqual({ gain: 1, elementVolume: 0, muted: true });
    expect(volumePlan(7, true).gain).toBe(1);
    expect(volumePlan(Number.NaN, true).gain).toBe(0);
  });

  it("calls the route silent only after SILENT_AFTER_S of audible play with every reading at zero", () => {
    expect(routeSilent([0, 0, 0], SILENT_AFTER_S)).toBe(true);
    expect(routeSilent([0, 0, 0], SILENT_AFTER_S - 0.1)).toBe(false);
    expect(routeSilent([0, 0.2, 0], SILENT_AFTER_S + 5)).toBe(false);
    expect(routeSilent([0, 0], SILENT_AFTER_S + 5)).toBe(false);
  });
});

describe("phone frame rate (perfLogic)", () => {
  it("skips only what is wholly outside the view plus the margin", () => {
    // view 0..960 x 0..540, margin 96
    expect(offView(480, 270, 50, 0, 0, 960, 540)).toBe(false);
    expect(offView(-200, 270, 50, 0, 0, 960, 540)).toBe(true);
    expect(offView(-140, 270, 50, 0, 0, 960, 540)).toBe(false); // its edge is inside the margin
    expect(offView(1200, 270, 50, 0, 0, 960, 540)).toBe(true);
    expect(offView(480, 1000, 50, 0, 0, 960, 540)).toBe(true);
    expect(offView(-1000, 270, 2000, 0, 0, 960, 540)).toBe(false); // a big picture reaching into view
    expect(offView(Number.NaN, 0, 10, 0, 0, 960, 540)).toBe(false);
    expect(offView(5000, 0, 10, 0, 0, 0, 0)).toBe(false); // no view yet: draw it
  });

  it("marks the player in the concept boss's Krelford, a dark room or a crowded screen", () => {
    expect(wantsMarker("krelford_finale", 10, false)).toBe(true);
    expect(wantsMarker("wildern", 10, true)).toBe(true);
    expect(wantsMarker("wildern", 400, false)).toBe(true);
    expect(wantsMarker("wildern", 80, false)).toBe(false);
  });

  it("hides the oldest blood pools beyond the cap", () => {
    const pools = Array.from({ length: MAX_POOLS + 5 }, (_, i) => i);
    expect(poolsToHide(pools)).toEqual([0, 1, 2, 3, 4]);
    expect(poolsToHide([1, 2, 3])).toEqual([]);
  });
});
