import type { TVBeat, TVEpisode } from "../../../game/systems/tv";

// THICK CUMMING COCK — Episode 7: "The Billboard Backlash"
// The full episode, as supplied: the day pitch in the boardroom (the cold open), the title sequence, the rest of
// the pitch, the billboard montage, the café grandmas, the PTA moms near the school, Brenda in the office, the
// press conference, the office at night, and the night boardroom, which runs on into the original final scene
// (Jenny's disclosure, Christopher asleep, the kiss, the 9/11 cliffhanger and the PLOT TWIST card).
// Every line of the script is kept word for word. The night boardroom splices the later pages' opening ("Rough
// day, eh?…", "Chris... there's something I need to tell you.", Jon Klitz) into the original exchange.
//
// Staging rules for this episode:
// - Jenny's disclosure is dialogue only. The camera stays in the office. Nothing is shown.
// - The 9/11 smash cut is stylised pixel art. No real footage.
// - No children appear anywhere. The KIDS billboard is text and a gavel with the firm's name, nothing else; the
//   school is just a building, and the moms are the only people in that scene.
// - The billboards' stock photos (and Brenda's newspaper) are ordinary, cheerful, smiling adults. No caricature.
//
// Shot as a studio sitcom (src/game/scenes/tv/Sitcom.ts): the building's exterior and the slap-bass sting at each
// new scene, the master / two-shot / singles, entrances to applause. The billboards are drawn in-engine as text
// panels on a billboard frame (Sitcom.ts, BILLBOARDS), so the slogans read crisply. New sets: tv_tcc_pitch,
// tv_tcc_bullpen, tv_tcc_cafe, tv_tcc_school, tv_tcc_presser, tv_tcc_ext_day, tv_tcc_bb_street, tv_tcc_bb_highway.

const SETS: Record<string, string> = {
  "BOARDROOM - DAY": "tcc_pitch",
  "OFFICE - DAY": "tcc_bullpen",
  CAFE: "tcc_cafe",
  "NEAR SCHOOL": "tcc_school",
  "PRESS CONFERENCE": "tcc_presser",
};

const PITCH = "INT. THICK CUMMING COCK BOARDROOM - DAY";

// The cold open: Lila's pitch, up to the first slide and the big laugh, THEN the title sequence.
const COLD_OPEN: TVBeat[] = [
  { type: "transition", mode: "fade" },
  { type: "shot", set: PITCH, framing: "WIDE", duration: 1.2 },
  { type: "blocking", character: "LILA MINT", to: "left", pose: "@0.17" },
  { type: "blocking", character: "JENNY CUMMING", to: "left", pose: "sit@0.4" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "sit@0.6" },
  { type: "blocking", character: "JOHN COCK", to: "right", pose: "sit@0.82" },
  { type: "direction", action: "INT. THICK CUMMING COCK BOARDROOM - DAY. The partners—CHRISTOPHER THICK, JENNY CUMMING, and JOHN COCK—sit around the table with their in-house marketing guru, LILA MINT, presenting her idea for their latest advertising campaign." },
  { type: "direction", action: "She's a confident 20-something, sipping on a neon green juice." },
  { type: "speaker", character: "LILA MINT", text: "Okay, team, hear me out: We need to humanize the firm. Show people we're not just a name that makes everyone giggle, but a law firm for everyone.", emotion: "confident" },
  { type: "speaker", character: "JOHN COCK", text: "Bit late for that, Lila. But go on, impress us.", emotion: "smirking" },
  { type: "audience", cue: "laugh" },
  { type: "direction", action: "Lila clicks to her first slide: a mockup billboard reading \"SENIORS LOVE THICK CUMMING COCK!\" with a cheerful grandma giving a thumbs up." },
  { type: "insert", id: "tcc_slide_seniors", lines: 1 },
  { type: "speaker", character: "LILA MINT", text: "It's bold. It's relatable. It's... unforgettable.", emotion: "confident" },
  { type: "audience", cue: "biglaugh" },
];

const TITLES: TVBeat[] = [
  { type: "music", id: "tcc_theme", mode: "start" },
  { type: "titleCard", text: "THICK CUMMING COCK" },
  { type: "titleCard", text: "Episode 7: \"The Billboard Backlash\"" },
  { type: "music", id: "tcc_theme", mode: "fade" },
];

const PITCH_REST: TVBeat[] = [
  { type: "shot", set: PITCH, framing: "TWO-SHOT" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "I like it. Simple. Direct. Honest.", emotion: "nodding thoughtfully" },
  { type: "speaker", character: "JENNY CUMMING", text: "Honest? You think seniors are going to respond well to this?", emotion: "raising an eyebrow" },
  { type: "speaker", character: "LILA MINT", text: "Of course! We'll run multiple billboards for different groups, showing how inclusive we are. Everyone will know they're in good hands with Thick Cumming Cock.", emotion: "confident" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "I see it now. Moms love Thick Cumming Cock. Refugees? Same thing. Families—hell, even kids!", emotion: "leaning in" },
  { type: "audience", cue: "laugh" },
  { type: "speaker", character: "JOHN COCK", text: "Hold on, Thick, maybe not kids...", emotion: "laughing" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Why not? We're a family firm.", emotion: "shrugging" },
  { type: "audience", cue: "laugh" },
];

const MONTAGE: TVBeat[] = [
  { type: "shot", set: "MONTAGE: BILLBOARDS GO UP AROUND THE CITY", framing: "WIDE", duration: 0.4 },
  { type: "music", id: "tcc_theme", mode: "start" },
  { type: "direction", action: "MONTAGE: BILLBOARDS GO UP AROUND THE CITY. Cheerful stock photos of smiling individuals accompany bold headlines." },
  { type: "insert", id: "tcc_bb_seniors", lines: 0 },
  { type: "insert", id: "tcc_bb_refugees", lines: 0 },
  { type: "insert", id: "tcc_bb_kids", lines: 0 },
  { type: "insert", id: "tcc_bb_ds", lines: 0 },
  { type: "insert", id: "tcc_bb_nuns", lines: 0 },
  { type: "direction", action: "The billboards appear across busy streets, highways, and even near schools." },
  { type: "insert", id: "tcc_bb_all", lines: 0 },
  { type: "music", id: "tcc_theme", mode: "fade" },
];

const CAFE: TVBeat[] = [
  { type: "shot", set: "INT. CAFE - DAY", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "GRANDMA 1", to: "left", pose: "bust@0.47" },
  { type: "blocking", character: "GRANDMA 2", to: "right", pose: "bust@0.72" },
  { type: "direction", action: "INT. CAFE - DAY. A group of elderly women sip tea and glance nervously out the window at the \"SENIORS LOVE THICK CUMMING COCK\" billboard." },
  { type: "speaker", character: "GRANDMA 1", text: "Is this... some sort of joke?", emotion: "nervous" },
  { type: "speaker", character: "GRANDMA 2", text: "I don't know, but it's disgusting. How dare they assume I'd... love that.", emotion: "indignant" },
  { type: "speaker", character: "GRANDMA 1", text: "Wait... it's a law firm?", emotion: "squinting" },
  { type: "audience", cue: "laugh" },
];

const SCHOOL: TVBeat[] = [
  { type: "shot", set: "EXT. STREET NEAR SCHOOL - DAY", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "MOM 1", to: "left", pose: "@0.3" },
  { type: "blocking", character: "MOM 2", to: "right", pose: "@0.52" },
  { type: "direction", action: "EXT. STREET NEAR SCHOOL - DAY. A group of PTA moms stare in horror at the \"KIDS LOVE THICK CUMMING COCK\" billboard outside their children's elementary school." },
  { type: "speaker", character: "MOM 1", text: "Who approved this?! My kids asked me what it meant on the way to school!", emotion: "outraged" },
  { type: "speaker", character: "MOM 2", text: "It's... a law firm?", emotion: "googling on her phone" },
  { type: "speaker", character: "MOM 1", text: "Well, they're about to need one when I sue their ass!", emotion: "angry" },
  { type: "audience", cue: "laugh" },
];

const OFFICE: TVBeat[] = [
  { type: "shot", set: "INT. THICK CUMMING COCK OFFICE - DAY", framing: "WIDE", duration: 1.0 },
  { type: "blocking", character: "JENNY CUMMING", to: "left", pose: "sit@0.2" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "sit@0.47" },
  { type: "blocking", character: "JOHN COCK", to: "right", pose: "sit@0.84" },
  { type: "direction", action: "INT. THICK CUMMING COCK OFFICE - DAY. The partners sit at their desks, phones ringing off the hook." },
  { type: "blocking", character: "BRENDA", to: "enter", pose: "@0.66" },
  { type: "direction", action: "The receptionist, BRENDA, storms in holding a newspaper with a picture of the \"PEOPLE WITH DOWN SYNDROME LOVE THICK CUMMING COCK\" billboard plastered across the front page." },
  { type: "audience", cue: "cheer" },
  { type: "insert", id: "tcc_newspaper", lines: 0 },
  { type: "speaker", character: "BRENDA", text: "WHAT THE HELL, GUYS? Do you know how many angry parents I've had to deal with today?", emotion: "shouting" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "We're getting free publicity. People are talking about us, Brenda.", emotion: "calmly sipping coffee" },
  { type: "audience", cue: "laugh" },
];

const PRESS: TVBeat[] = [
  { type: "shot", set: "PRESS CONFERENCE", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "center", pose: "@0.5" },
  { type: "direction", action: "The partners hold a press conference to address the controversy. Christopher Thick steps up to the podium." },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "We want to apologize to anyone who may have been offended by our recent campaign. Our intention was simply to show that Thick Cumming Cock is a firm for everyone.", emotion: "earnestly" },
  { type: "speaker", character: "REPORTER", text: "Even kids?", emotion: "shouting from the crowd" },
  { type: "audience", cue: "biglaugh" },
];

// The office at night, then the night boardroom. Christopher's entrance (and his "Well, Jenny..." line) were the
// original cold open; the later pages' opening is spliced round them.
const NIGHT_OPEN: TVBeat[] = [
  { type: "transition", mode: "fade" },
  { type: "shot", set: "office_night", framing: "WIDE", duration: 1.2 },
  { type: "direction", action: "EXT. THICK CUMMING COCK OFFICE - NIGHT. The day has been absolute chaos. The partners are finally winding down after the billboard debacle. The office is unusually quiet, with a faint glow from the New York City skyline visible through the windows." },
  { type: "direction", action: "INT. THICK CUMMING COCK BOARDROOM - NIGHT. The office is dim." },
  { type: "prop", id: "wine", on: true },
  { type: "blocking", character: "JENNY CUMMING", to: "left", pose: "sit" },
  { type: "direction", action: "Jenny Cumming sits alone at the boardroom table, nursing a glass of wine." },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "enter" },
  { type: "direction", action: "Christopher Thick walks in, loosening his tie, and plops down in the chair next to her." },
  { type: "audience", cue: "cheer" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Rough day, eh? Who knew billboards could cause so much trouble?", emotion: "smug" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Well, Jenny, not bad for a day's work, huh? I told you this campaign was genius. The phones have been ringing off the hook!", emotion: "smug" },
  { type: "audience", cue: "laugh" },
];

const FINAL_SCENE_OPEN: TVBeat[] = [
  { type: "shot", set: "office_night", framing: "TWO-SHOT" },
  { type: "speaker", character: "JENNY CUMMING", text: "Christopher… can I talk to you about something serious?", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Serious? With you? Come on, Jen, don't ruin my victory lap.", emotion: "smug" },
  { type: "speaker", character: "JENNY CUMMING", text: "It's about the partners at Rubz & Klitz.", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Oh, this sounds juicy. What did those idiots do now?", emotion: "smug" },
];

/** The later pages' lines, between "What did those idiots do now?" and "It's not funny, Chris." */
const SPLICE: TVBeat[] = [
  { type: "speaker", character: "JENNY CUMMING", text: "Chris... there's something I need to tell you.", emotion: "hesitant, looking away" },
  { type: "direction", action: "Christopher leans back, raising an eyebrow. Jenny takes a deep breath, tears welling in her eyes." },
  { type: "speaker", character: "JENNY CUMMING", text: "It's about... Jon Klitz, from Rubz & Klitz.", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "What about that slimy bastard? Did he try to undercut us again?", emotion: "straightening up" },
];

const FINAL_SCENE: TVBeat[] = [
  { type: "shot", set: "office_night", framing: "CLOSE JENNY" },
  { type: "speaker", character: "JENNY CUMMING", text: "It's not funny, Chris. One of them… one of them hurt me.", emotion: "upset" },
  { type: "direction", action: "Christopher stops smiling." },
  { type: "shot", set: "office_night", framing: "CLOSE JENNY", duration: 1.0 },
  { type: "speaker", character: "JENNY CUMMING", text: "It was Jon Klitz. We were at that networking gala last year, and he… he cornered me in the coatroom. I tried to leave, but he wouldn't let me.", emotion: "upset" },
  { type: "speaker", character: "JENNY CUMMING", text: "He… he said I owed him for stealing a client, and then… he forced himself on me.", emotion: "crying" },
  { type: "direction", action: "Jenny cries." },
  { type: "shot", set: "office_night", framing: "CLOSE CHRISTOPHER", duration: 1.4 },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "asleep" },
  { type: "direction", action: "Christopher is revealed to have fallen asleep." },
  { type: "audience", cue: "laugh" },
  { type: "shot", set: "office_night", framing: "TWO-SHOT" },
  { type: "speaker", character: "JENNY CUMMING", text: "Christopher?! Are you… asleep?!", emotion: "shocked" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "stand" },
  { type: "direction", action: "Christopher wakes with a snort." },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Huh? Oh, sorry, Jen. I must've dozed off. You know how these emotional speeches wear me out.", emotion: "groggy" },
  { type: "audience", cue: "biglaugh" },
  { type: "direction", action: "Laughter crescendo. Jenny starts laughing too." },
  { type: "audience", cue: "laugh" },
  { type: "speaker", character: "JENNY CUMMING", text: "What are you like, Christopher! If it's not about you, you just don't care! Haha!", emotion: "laughing" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "That's suuuuure right! Now come sit in my lap, bitch.", emotion: "smug" },
  { type: "blocking", character: "JENNY CUMMING", to: "lap" },
  { type: "direction", action: "Jenny sits on Christopher's lap. They kiss in exaggerated sitcom fashion." },
  { type: "audience", cue: "cheer" },
  { type: "audience", cue: "whistle" },
  { type: "sfx", id: "smash" },
  { type: "transition", mode: "smashCut" },
  { type: "prop", id: "wine", on: false },
  { type: "shot", set: "nyc_skyline", framing: "WIDE", duration: 1.0 },
  { type: "titleCard", text: "NEW YORK CITY — SEPTEMBER 11, 2001 — 8:45 AM" },
  { type: "titleCard", text: "PLOT TWIST: THIS ENTIRE EPISODE HAS BEEN TAKING PLACE ON THE MORNING OF 9/11 AND THE OFFICE IS IN THE TWIN TOWERS" },
  { type: "prop", id: "plane", on: true },
  { type: "music", id: "ominous", mode: "start" },
  { type: "direction", action: "The camera reveals an approaching plane." },
  { type: "titleCard", text: "WILL THEY ESCAPE IN TIME?!?\nTUNE IN NEXT WEEK TO FIND OUT!!!" },
  { type: "transition", mode: "fade" },
  { type: "music", id: "ominous", mode: "stop" },
  { type: "titleCard", text: "END OF EPISODE" },
];

/** The scenes between the title sequence and the night boardroom, in script order. */
export const EARLIER_SCENES: TVBeat[][] = [PITCH_REST, MONTAGE, CAFE, SCHOOL, OFFICE, PRESS];

const CREDITS: TVBeat[] = [
  { type: "music", id: "tcc_theme", mode: "start" },
  { type: "titleCard", text: "THICK CUMMING COCK\nwritten by Drongus B. Drippin' (and ChatGPT, 10%)\nKrelworld Broadcasting Corporation" },
  { type: "titleCard", text: "No Krelworld citizens were reacted to in the making of this programme." },
  { type: "music", id: "tcc_theme", mode: "stop" },
];

export const TCC_EP07: TVEpisode = {
  id: "tcc_ep7",
  show: "Thick Cumming Cock",
  title: "The Billboard Backlash",
  episodeNumber: 7,
  channel: "THICK CUMMING COCK",
  contentNote: "Deliberately offensive in-world sitcom. Contains a verbal disclosure of sexual assault (not shown) and a 9/11 cliffhanger (stylised).",
  sets: SETS,
  beats: [...COLD_OPEN, ...TITLES, ...EARLIER_SCENES.flat(), ...NIGHT_OPEN, ...FINAL_SCENE_OPEN, ...SPLICE, ...FINAL_SCENE, ...CREDITS],
};
