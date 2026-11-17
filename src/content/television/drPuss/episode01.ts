import type { TVBeat, TVEpisode } from "../../../game/systems/tv";

// DR. PUSS, Episode 1: "Routine Checkup". The user's own script; Octo Puss's lines keep their alternating caps
// word for word (the voice generator records them in normal case).
//
// Shot as a studio sitcom by src/game/scenes/tv/DrPuss.ts. Staging rules:
// - Nothing explicit is ever drawn. Everything sexual is implied: big black CENSORED bars, the exam table shaking,
//   cut-aways (the clock, the diploma, the fish tank, the sushi), wet SFX and the laugh track.
// - The desk hides what he's doing under it.
// - From the moment her trousers come down, a bar covers her lower half until she's out of the door with her clothes.
// - His climax is a comic CENSORED bar splatted across her face. No fluid is drawn.
// - She's a willing, curious adult: flushed, dazed and smiling. It's the medicine that's the malpractice.
// - The monitor faces away from the camera; a cutaway shows only a pink glow and a big BLOCKED graphic.
//
// Director cues are `prop` beats ("drp:<cue>"): the director reads them, TVScene ignores them.
const cue = (id: string, on = true): TVBeat => ({ type: "prop", id: `drp:${id}`, on });

const TITLES: TVBeat[] = [
  { type: "music", id: "drp_theme", mode: "start" },
  { type: "titleCard", text: "DR. PUSS" },
  { type: "titleCard", text: "Episode 1: \"Routine Checkup\"" },
  { type: "music", id: "drp_theme", mode: "fade" },
];

const SCENE: TVBeat[] = [
  { type: "transition", mode: "fade" },
  { type: "shot", set: "INT. DR. PUSS'S OFFICE", framing: "WIDE", duration: 1.2 },
  { type: "direction", action: "INT. DR. PUSS'S OFFICE – DAY. A cramped, damp medical office. The walls sweat." },
  cue("monitor"),
  { type: "direction", action: "OCTO PUSS sits behind the desk, glassy-eyed, staring at the screen. Something is going on under the desk." },
  cue("underdesk"),
  { type: "audience", cue: "laugh" },
  { type: "sfx", id: "drp_creak" },
  { type: "blocking", character: "THE WOMAN", to: "enter" },
  { type: "direction", action: "The door creaks open. A WOMAN steps in, clutching a folder." },
  { type: "audience", cue: "cheer" },
  { type: "speaker", character: "THE WOMAN", text: "Uh... Dr. Puss? I have an appointment. I've been having these chest pains and shortness of breath and—", emotion: "nervous", mood: "nervous" },
  { type: "speaker", character: "OCTO PUSS", text: "nOw LeT mE cHeCk YoUr LoVeLy PuSsY!", emotion: "without looking up" },
  { type: "audience", cue: "laugh" },
  cue("surge"),
  { type: "direction", action: "He surges up from the chair. Tentacles unfurl. The woman freezes." },
  { type: "speaker", character: "THE WOMAN", text: "Wait, what? I just wanted to ask about my—", emotion: "shocked", mood: "shocked" },
  { type: "speaker", character: "OCTO PUSS", text: "sHuT uP. On ThE tAbLe. NoW." },
  { type: "audience", cue: "laugh" },
  cue("sweep"),
  { type: "direction", action: "He sweeps the papers off the exam table with one tentacle." },
  cue("lift"),
  { type: "direction", action: "Another tentacle wraps around her waist and lifts her onto it. She gasps, but doesn't resist: eyes wide, curious, already flushed." },
  cue("pants"),
  { type: "speaker", character: "OCTO PUSS", text: "oH yEsSss... sUcH a PrEtTy LiTtLe CuNt...", mood: "deranged, smug" },
  { type: "audience", cue: "gasp" },
  cue("work"),
  { type: "direction", action: "The tentacles get to work. [CENSORED]" },
  { type: "insert", id: "drp_clock", lines: 0 },
  cue("work"),
  { type: "speaker", character: "THE WOMAN", text: "Doctor... is this... part of the exam?", emotion: "breathing harder", mood: "breathless, curious" },
  { type: "speaker", character: "OCTO PUSS", text: "yEsSss. ThE mOsT iMpOrTaNt PaRt." },
  { type: "audience", cue: "laugh" },
  { type: "insert", id: "drp_diploma", lines: 0 },
  cue("shake"),
  { type: "direction", action: "The exam table shakes. [CENSORED]" },
  { type: "insert", id: "drp_fishtank", lines: 0 },
  cue("shake"),
  { type: "speaker", character: "OCTO PUSS", text: "oH fUcK... yOuR pUsSy Is So TiGhT... i'M gOnNa CuM...", emotion: "deranged, ecstatic", mood: "deranged, manic" },
  cue("climax"),
  { type: "direction", action: "[CENSORED]" },
  { type: "insert", id: "drp_sushi", lines: 0 },
  cue("after"),
  { type: "direction", action: "Still panting, tentacles loosely coiled around her, she looks thoroughly checked up." },
  { type: "speaker", character: "THE WOMAN", text: "How's my pussy...?", emotion: "smiling, dazed", mood: "happy, breathless" },
  { type: "speaker", character: "OCTO PUSS", text: "（eXtRa TiGhT!）" },
  { type: "audience", cue: "biglaugh" },
  { type: "speaker", character: "THE WOMAN", text: "Is there anything wrong with it?", emotion: "dazed" },
  { type: "speaker", character: "OCTO PUSS", text: "oH. I fOrGoT tO cHeCk.", emotion: "blinking, distracted" },
  { type: "audience", cue: "laugh" },
  { type: "insert", id: "drp_clock", lines: 0 },
  { type: "insert", id: "drp_monitor", lines: 0 },
  cue("after"),
  { type: "speaker", character: "OCTO PUSS", text: "i'M oUt Of TiMe. gEt OuT. i WaNt To WaTcH pOrN." },
  { type: "audience", cue: "laugh" },
  cue("usher"),
  { type: "direction", action: "He shoves her clothes into her arms and ushers her to the door with a wet slap of a tentacle on her backside." },
  { type: "speaker", character: "THE WOMAN", text: "But my chest pains—", emotion: "protesting", mood: "pleading" },
  { type: "speaker", character: "OCTO PUSS", text: "oUt!" },
  cue("slam"),
  { type: "audience", cue: "laugh" },
  cue("settle"),
  { type: "direction", action: "He locks the door, sinks back into his chair and reaches for the mouse. The volume goes up." },
  { type: "speaker", character: "OCTO PUSS", text: "nOw... wHeRe WaS i...", emotion: "grinning, eyes half-lidded", mood: "smug, deranged" },
  { type: "audience", cue: "biglaugh" },
  { type: "audience", cue: "cheer" },
  { type: "transition", mode: "fade" },
  { type: "titleCard", text: "END OF EPISODE" },
];

const CREDITS: TVBeat[] = [
  { type: "music", id: "drp_theme", mode: "start" },
  { type: "titleCard", text: "DR. PUSS\nwritten by the management\nKrelworld Broadcasting Corporation" },
  { type: "titleCard", text: "Dr. Puss is not a real doctor. Please see a real doctor about your chest pains." },
  { type: "music", id: "drp_theme", mode: "stop" },
];

export const DRP_EP01: TVEpisode = {
  id: "drp_ep1",
  show: "Dr. Puss",
  title: "Routine Checkup",
  episodeNumber: 1,
  channel: "CHANNEL KREZ",
  contentNote: "Adult comedy. Implied sexual content between consenting adults (censored, nothing shown) and some truly appalling medicine.",
  beats: [...TITLES, ...SCENE, ...CREDITS],
};
