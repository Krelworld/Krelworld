// src/game/systems/tv.ts
var VO_MOOD = "quietly, thoughtful";
var AUDIENCE_CUES = {
  LAUGHTER: "laugh",
  LAUGH: "laugh",
  "CANNED LAUGHTER": "laugh",
  "LAUGHTER CRESCENDO": "biglaugh",
  "BIG LAUGH": "biglaugh",
  "LAUGH TRACK": "laugh",
  CHEERING: "cheer",
  CHEERS: "cheer",
  APPLAUSE: "cheer",
  GASP: "gasp",
  GASPS: "gasp",
  WHISTLE: "whistle",
  WHISTLES: "whistle",
  "CHEERS AND WHISTLES": "whistle"
};
function parseScreenplay(text) {
  const beats = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      beats.push({ type: "titleCard", text: line.replace(/^#+\s*/, "") });
      continue;
    }
    const shot = line.match(/^(INT\.|EXT\.)\s+(.+?)(?:\s+-\s+(.+))?$/);
    if (shot) {
      beats.push({ type: "shot", set: `${shot[1]} ${shot[2]}`.trim(), framing: (shot[3] || "WIDE").trim() });
      continue;
    }
    const bracket = line.match(/^\[(.+)\]$/);
    if (bracket) {
      const inner = bracket[1].trim();
      const upper = inner.toUpperCase();
      if (upper === "SMASH CUT" || upper === "SMASHCUT") beats.push({ type: "transition", mode: "smashCut" });
      else if (upper === "CUT" || upper === "CUT TO") beats.push({ type: "transition", mode: "cut" });
      else if (upper.startsWith("FADE")) beats.push({ type: "transition", mode: "fade" });
      else if (upper.startsWith("SFX ")) beats.push({ type: "sfx", id: inner.slice(4).trim() });
      else if (upper.startsWith("MUSIC ")) {
        const [, id, mode] = inner.split(/\s+/);
        beats.push({ type: "music", id, mode: mode === "stop" || mode === "fade" ? mode : "start" });
      } else if (upper.startsWith("PROP ")) {
        const [, id, on] = inner.split(/\s+/);
        beats.push({ type: "prop", id, on: on !== "off" });
      } else if (upper.startsWith("INSERT ")) {
        const [, id, n] = inner.split(/\s+/);
        beats.push({ type: "insert", id, lines: Math.max(1, Number(n) || 1) });
      } else if (upper.startsWith("BLOCK ")) {
        const parts = inner.split(/\s+/).slice(1);
        const POS = ["left", "right", "center", "lap", "offscreen", "enter"];
        const at = parts.findIndex((w) => POS.includes(w.toLowerCase()));
        const who = (at > 0 ? parts.slice(0, at) : parts.slice(0, 1)).join(" ");
        const to = at > 0 ? parts[at].toLowerCase() : parts[1];
        const pose = at > 0 ? parts[at + 1] : parts[2];
        beats.push({ type: "blocking", character: who, to: to || "center", pose });
      } else if (AUDIENCE_CUES[upper]) beats.push({ type: "audience", cue: AUDIENCE_CUES[upper] });
      else beats.push({ type: "direction", action: inner });
      continue;
    }
    const dir = line.match(/^\((.+)\)$/);
    if (dir) {
      beats.push({ type: "direction", action: dir[1] });
      continue;
    }
    const sp = line.match(/^([A-Z][A-Z0-9 .'’\-]+?)(?:\s*\(([^)]+)\))?:\s*(.+)$/);
    if (sp) {
      const emotion = sp[2]?.trim();
      const vo = !!emotion && /^V\.?\s*O\.?$/i.test(emotion);
      beats.push({ type: "speaker", character: sp[1].trim(), text: sp[3].trim().replace(/^["“]|["”]$/g, ""), emotion, ...vo ? { mood: VO_MOOD } : {} });
      continue;
    }
    beats.push({ type: "direction", action: line });
  }
  return beats;
}

// src/content/television/thickCummingCock/episode07.ts
var SETS = {
  "BOARDROOM - DAY": "tcc_pitch",
  "OFFICE - DAY": "tcc_bullpen",
  CAFE: "tcc_cafe",
  "NEAR SCHOOL": "tcc_school",
  "PRESS CONFERENCE": "tcc_presser"
};
var PITCH = "INT. THICK CUMMING COCK BOARDROOM - DAY";
var COLD_OPEN = [
  { type: "transition", mode: "fade" },
  { type: "shot", set: PITCH, framing: "WIDE", duration: 1.2 },
  { type: "blocking", character: "LILA MINT", to: "left", pose: "@0.17" },
  { type: "blocking", character: "JENNY CUMMING", to: "left", pose: "sit@0.4" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "sit@0.6" },
  { type: "blocking", character: "JOHN COCK", to: "right", pose: "sit@0.82" },
  { type: "direction", action: "INT. THICK CUMMING COCK BOARDROOM - DAY. The partners\u2014CHRISTOPHER THICK, JENNY CUMMING, and JOHN COCK\u2014sit around the table with their in-house marketing guru, LILA MINT, presenting her idea for their latest advertising campaign." },
  { type: "direction", action: "She's a confident 20-something, sipping on a neon green juice." },
  { type: "speaker", character: "LILA MINT", text: "Okay, team, hear me out: We need to humanize the firm. Show people we're not just a name that makes everyone giggle, but a law firm for everyone.", emotion: "confident" },
  { type: "speaker", character: "JOHN COCK", text: "Bit late for that, Lila. But go on, impress us.", emotion: "smirking" },
  { type: "audience", cue: "laugh" },
  { type: "direction", action: 'Lila clicks to her first slide: a mockup billboard reading "SENIORS LOVE THICK CUMMING COCK!" with a cheerful grandma giving a thumbs up.' },
  { type: "insert", id: "tcc_slide_seniors", lines: 1 },
  { type: "speaker", character: "LILA MINT", text: "It's bold. It's relatable. It's... unforgettable.", emotion: "confident" },
  { type: "audience", cue: "biglaugh" }
];
var TITLES = [
  { type: "music", id: "tcc_theme", mode: "start" },
  { type: "titleCard", text: "THICK CUMMING COCK" },
  { type: "titleCard", text: 'Episode 7: "The Billboard Backlash"' },
  { type: "music", id: "tcc_theme", mode: "fade" }
];
var PITCH_REST = [
  { type: "shot", set: PITCH, framing: "TWO-SHOT" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "I like it. Simple. Direct. Honest.", emotion: "nodding thoughtfully" },
  { type: "speaker", character: "JENNY CUMMING", text: "Honest? You think seniors are going to respond well to this?", emotion: "raising an eyebrow" },
  { type: "speaker", character: "LILA MINT", text: "Of course! We'll run multiple billboards for different groups, showing how inclusive we are. Everyone will know they're in good hands with Thick Cumming Cock.", emotion: "confident" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "I see it now. Moms love Thick Cumming Cock. Refugees? Same thing. Families\u2014hell, even kids!", emotion: "leaning in" },
  { type: "audience", cue: "laugh" },
  { type: "speaker", character: "JOHN COCK", text: "Hold on, Thick, maybe not kids...", emotion: "laughing" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Why not? We're a family firm.", emotion: "shrugging" },
  { type: "audience", cue: "laugh" }
];
var MONTAGE = [
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
  { type: "music", id: "tcc_theme", mode: "fade" }
];
var CAFE = [
  { type: "shot", set: "INT. CAFE - DAY", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "GRANDMA 1", to: "left", pose: "bust@0.47" },
  { type: "blocking", character: "GRANDMA 2", to: "right", pose: "bust@0.72" },
  { type: "direction", action: 'INT. CAFE - DAY. A group of elderly women sip tea and glance nervously out the window at the "SENIORS LOVE THICK CUMMING COCK" billboard.' },
  { type: "speaker", character: "GRANDMA 1", text: "Is this... some sort of joke?", emotion: "nervous" },
  { type: "speaker", character: "GRANDMA 2", text: "I don't know, but it's disgusting. How dare they assume I'd... love that.", emotion: "indignant" },
  { type: "speaker", character: "GRANDMA 1", text: "Wait... it's a law firm?", emotion: "squinting" },
  { type: "audience", cue: "laugh" }
];
var SCHOOL = [
  { type: "shot", set: "EXT. STREET NEAR SCHOOL - DAY", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "MOM 1", to: "left", pose: "@0.3" },
  { type: "blocking", character: "MOM 2", to: "right", pose: "@0.52" },
  { type: "direction", action: `EXT. STREET NEAR SCHOOL - DAY. A group of PTA moms stare in horror at the "KIDS LOVE THICK CUMMING COCK" billboard outside their children's elementary school.` },
  { type: "speaker", character: "MOM 1", text: "Who approved this?! My kids asked me what it meant on the way to school!", emotion: "outraged" },
  { type: "speaker", character: "MOM 2", text: "It's... a law firm?", emotion: "googling on her phone" },
  { type: "speaker", character: "MOM 1", text: "Well, they're about to need one when I sue their ass!", emotion: "angry" },
  { type: "audience", cue: "laugh" }
];
var OFFICE = [
  { type: "shot", set: "INT. THICK CUMMING COCK OFFICE - DAY", framing: "WIDE", duration: 1 },
  { type: "blocking", character: "JENNY CUMMING", to: "left", pose: "sit@0.2" },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "sit@0.47" },
  { type: "blocking", character: "JOHN COCK", to: "right", pose: "sit@0.84" },
  { type: "direction", action: "INT. THICK CUMMING COCK OFFICE - DAY. The partners sit at their desks, phones ringing off the hook." },
  { type: "blocking", character: "BRENDA", to: "enter", pose: "@0.66" },
  { type: "direction", action: 'The receptionist, BRENDA, storms in holding a newspaper with a picture of the "PEOPLE WITH DOWN SYNDROME LOVE THICK CUMMING COCK" billboard plastered across the front page.' },
  { type: "audience", cue: "cheer" },
  { type: "insert", id: "tcc_newspaper", lines: 0 },
  { type: "speaker", character: "BRENDA", text: "WHAT THE HELL, GUYS? Do you know how many angry parents I've had to deal with today?", emotion: "shouting" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "We're getting free publicity. People are talking about us, Brenda.", emotion: "calmly sipping coffee" },
  { type: "audience", cue: "laugh" }
];
var PRESS = [
  { type: "shot", set: "PRESS CONFERENCE", framing: "WIDE", duration: 0.8 },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "center", pose: "@0.5" },
  { type: "direction", action: "The partners hold a press conference to address the controversy. Christopher Thick steps up to the podium." },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "We want to apologize to anyone who may have been offended by our recent campaign. Our intention was simply to show that Thick Cumming Cock is a firm for everyone.", emotion: "earnestly" },
  { type: "speaker", character: "REPORTER", text: "Even kids?", emotion: "shouting from the crowd" },
  { type: "audience", cue: "biglaugh" }
];
var NIGHT_OPEN = [
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
  { type: "audience", cue: "laugh" }
];
var FINAL_SCENE_OPEN = [
  { type: "shot", set: "office_night", framing: "TWO-SHOT" },
  { type: "speaker", character: "JENNY CUMMING", text: "Christopher\u2026 can I talk to you about something serious?", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Serious? With you? Come on, Jen, don't ruin my victory lap.", emotion: "smug" },
  { type: "speaker", character: "JENNY CUMMING", text: "It's about the partners at Rubz & Klitz.", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "Oh, this sounds juicy. What did those idiots do now?", emotion: "smug" }
];
var SPLICE = [
  { type: "speaker", character: "JENNY CUMMING", text: "Chris... there's something I need to tell you.", emotion: "hesitant, looking away" },
  { type: "direction", action: "Christopher leans back, raising an eyebrow. Jenny takes a deep breath, tears welling in her eyes." },
  { type: "speaker", character: "JENNY CUMMING", text: "It's about... Jon Klitz, from Rubz & Klitz.", emotion: "quiet" },
  { type: "speaker", character: "CHRISTOPHER THICK", text: "What about that slimy bastard? Did he try to undercut us again?", emotion: "straightening up" }
];
var FINAL_SCENE = [
  { type: "shot", set: "office_night", framing: "CLOSE JENNY" },
  { type: "speaker", character: "JENNY CUMMING", text: "It's not funny, Chris. One of them\u2026 one of them hurt me.", emotion: "upset" },
  { type: "direction", action: "Christopher stops smiling." },
  { type: "shot", set: "office_night", framing: "CLOSE JENNY", duration: 1 },
  { type: "speaker", character: "JENNY CUMMING", text: "It was Jon Klitz. We were at that networking gala last year, and he\u2026 he cornered me in the coatroom. I tried to leave, but he wouldn't let me.", emotion: "upset" },
  { type: "speaker", character: "JENNY CUMMING", text: "He\u2026 he said I owed him for stealing a client, and then\u2026 he forced himself on me.", emotion: "crying" },
  { type: "direction", action: "Jenny cries." },
  { type: "shot", set: "office_night", framing: "CLOSE CHRISTOPHER", duration: 1.4 },
  { type: "blocking", character: "CHRISTOPHER THICK", to: "right", pose: "asleep" },
  { type: "direction", action: "Christopher is revealed to have fallen asleep." },
  { type: "audience", cue: "laugh" },
  { type: "shot", set: "office_night", framing: "TWO-SHOT" },
  { type: "speaker", character: "JENNY CUMMING", text: "Christopher?! Are you\u2026 asleep?!", emotion: "shocked" },
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
  { type: "shot", set: "nyc_skyline", framing: "WIDE", duration: 1 },
  { type: "titleCard", text: "NEW YORK CITY \u2014 SEPTEMBER 11, 2001 \u2014 8:45 AM" },
  { type: "titleCard", text: "PLOT TWIST: THIS ENTIRE EPISODE HAS BEEN TAKING PLACE ON THE MORNING OF 9/11 AND THE OFFICE IS IN THE TWIN TOWERS" },
  { type: "prop", id: "plane", on: true },
  { type: "music", id: "ominous", mode: "start" },
  { type: "direction", action: "The camera reveals an approaching plane." },
  { type: "titleCard", text: "WILL THEY ESCAPE IN TIME?!?\nTUNE IN NEXT WEEK TO FIND OUT!!!" },
  { type: "transition", mode: "fade" },
  { type: "music", id: "ominous", mode: "stop" },
  { type: "titleCard", text: "END OF EPISODE" }
];
var EARLIER_SCENES = [PITCH_REST, MONTAGE, CAFE, SCHOOL, OFFICE, PRESS];
var CREDITS = [
  { type: "music", id: "tcc_theme", mode: "start" },
  { type: "titleCard", text: "THICK CUMMING COCK\nwritten by Drongus B. Drippin' (and ChatGPT, 10%)\nKrelworld Broadcasting Corporation" },
  { type: "titleCard", text: "No Krelworld citizens were reacted to in the making of this programme." },
  { type: "music", id: "tcc_theme", mode: "stop" }
];
var TCC_EP07 = {
  id: "tcc_ep7",
  show: "Thick Cumming Cock",
  title: "The Billboard Backlash",
  episodeNumber: 7,
  channel: "THICK CUMMING COCK",
  contentNote: "Deliberately offensive in-world sitcom. Contains a verbal disclosure of sexual assault (not shown) and a 9/11 cliffhanger (stylised).",
  sets: SETS,
  beats: [...COLD_OPEN, ...TITLES, ...EARLIER_SCENES.flat(), ...NIGHT_OPEN, ...FINAL_SCENE_OPEN, ...SPLICE, ...FINAL_SCENE, ...CREDITS]
};

// src/content/television/drPuss/episode01.ts
var cue = (id, on = true) => ({ type: "prop", id: `drp:${id}`, on });
var TITLES2 = [
  { type: "music", id: "drp_theme", mode: "start" },
  { type: "titleCard", text: "DR. PUSS" },
  { type: "titleCard", text: 'Episode 1: "Routine Checkup"' },
  { type: "music", id: "drp_theme", mode: "fade" }
];
var SCENE = [
  { type: "transition", mode: "fade" },
  { type: "shot", set: "INT. DR. PUSS'S OFFICE", framing: "WIDE", duration: 1.2 },
  { type: "direction", action: "INT. DR. PUSS'S OFFICE \u2013 DAY. A cramped, damp medical office. The walls sweat." },
  cue("monitor"),
  { type: "direction", action: "OCTO PUSS sits behind the desk, glassy-eyed, staring at the screen. Something is going on under the desk." },
  cue("underdesk"),
  { type: "audience", cue: "laugh" },
  { type: "sfx", id: "drp_creak" },
  { type: "blocking", character: "THE WOMAN", to: "enter" },
  { type: "direction", action: "The door creaks open. A WOMAN steps in, clutching a folder." },
  { type: "audience", cue: "cheer" },
  { type: "speaker", character: "THE WOMAN", text: "Uh... Dr. Puss? I have an appointment. I've been having these chest pains and shortness of breath and\u2014", emotion: "nervous", mood: "nervous" },
  { type: "speaker", character: "OCTO PUSS", text: "nOw LeT mE cHeCk YoUr LoVeLy PuSsY!", emotion: "without looking up" },
  { type: "audience", cue: "laugh" },
  cue("surge"),
  { type: "direction", action: "He surges up from the chair. Tentacles unfurl. The woman freezes." },
  { type: "speaker", character: "THE WOMAN", text: "Wait, what? I just wanted to ask about my\u2014", emotion: "shocked", mood: "shocked" },
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
  { type: "speaker", character: "OCTO PUSS", text: "\uFF08eXtRa TiGhT!\uFF09" },
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
  { type: "speaker", character: "THE WOMAN", text: "But my chest pains\u2014", emotion: "protesting", mood: "pleading" },
  { type: "speaker", character: "OCTO PUSS", text: "oUt!" },
  cue("slam"),
  { type: "audience", cue: "laugh" },
  cue("settle"),
  { type: "direction", action: "He locks the door, sinks back into his chair and reaches for the mouse. The volume goes up." },
  { type: "speaker", character: "OCTO PUSS", text: "nOw... wHeRe WaS i...", emotion: "grinning, eyes half-lidded", mood: "smug, deranged" },
  { type: "audience", cue: "biglaugh" },
  { type: "audience", cue: "cheer" },
  { type: "transition", mode: "fade" },
  { type: "titleCard", text: "END OF EPISODE" }
];
var CREDITS2 = [
  { type: "music", id: "drp_theme", mode: "start" },
  { type: "titleCard", text: "DR. PUSS\nwritten by the management\nKrelworld Broadcasting Corporation" },
  { type: "titleCard", text: "Dr. Puss is not a real doctor. Please see a real doctor about your chest pains." },
  { type: "music", id: "drp_theme", mode: "stop" }
];
var DRP_EP01 = {
  id: "drp_ep1",
  show: "Dr. Puss",
  title: "Routine Checkup",
  episodeNumber: 1,
  channel: "CHANNEL KREZ",
  contentNote: "Adult comedy. Implied sexual content between consenting adults (censored, nothing shown) and some truly appalling medicine.",
  beats: [...TITLES2, ...SCENE, ...CREDITS2]
};

// src/content/television/extra/creationMyth.ts
var CREATION_MYTH = {
  id: "creation_myth",
  channel: "KRELWORLD DOCUMENTARIES",
  show: "Krelworld Documentaries",
  title: "Krelworld: The Creation Myth",
  episodeNumber: 3,
  beats: parseScreenplay(`
[MUSIC ominous start]
# KRELWORLD: THE CREATION MYTH
INT. ANCIENT KRELWORLD CAVE - DAY
(The air is suffocating with dust and tension. A flickering lantern illuminates the jagged stone walls. KRELBERT and RONSON, two rugged archaeologists, stand before a stone chest buried in rubble. Their assistant, FLAT-TYRE FROLLICK, clutches equipment nervously, while treasure hunter BUSTER BONGO leans against the wall, observing silently.)
KRELBERT (whispering): We're close. This is it, Ronson.
RONSON (barely audible): A million years of Krelworld's history, buried in stone.
(Krelbert kneels, his hands trembling as he brushes dust from the chest's lid. The group holds their breath. He pries it open, revealing a scroll wrapped in cracked leather and sealed with wax. They stare at it in silence.)
KRELBERT (staring at the scroll): Oh my gosh\u2026 Krelworld was created by\u2026
(He pauses, the tension unbearable. His voice cracks as he continues.)
KRELBERT: \u2026fuck\u2026 I can't fucking believe it\u2026 Godric Gryffindor.
[SFX boom]
(The words hang in the air like a thunderclap.)
RONSON (stunned): Godric Gryffindor?
KRELBERT (nodding): From Harry Potter.
FLAT-TYRE FROLLICK (gasping): Fuck\u2026 the founder of Gryffindor House\u2026 fuck\u2026
RONSON (shaking his head in disbelief): Only two words can describe this discovery.
KRELBERT AND RONSON (in unison, almost whispering): Big wowzer.
(Krelbert carefully breaks the seal, unrolling the ancient scroll. The parchment crackles as he begins to read aloud.)
# THE SCROLL \u2013 GODRIC'S WORDS
KRELBERT (voice trembling): "Holy shit\u2026 so\u2026 it was all going so well\u2026 he and his beautiful wife were expecting a child\u2026"
(Krelbert pauses, the weight of the next line hitting him. He exchanges a glance with Ronson.)
KRELBERT (continuing): "\u2026and\u2026 oh my god, this is so fucking sad\u2026 the child actually ended up having Down syndrome\u2026"
RONSON (softly): So sad\u2026
KRELBERT (nodding): "So sad\u2026 and Godric had no choice but to escape\u2026 the stress was just too much for him."
RONSON (grimly): So he left.
(Krelbert scans the next part of the scroll, his voice gaining urgency.)
KRELBERT: "Anyway, then he made Krelworld\u2026 he describes his desire to make a 'Waluigi version' of the real universe."
(Ronson steps closer, frowning.)
RONSON: What the fuck is a Waluigi version?
KRELBERT (shrugging, exasperated): I don't fucking know\u2026 fuck.
# THE SCROLL \u2013 CONTINUES
(Krelbert's voice grows shakier as he reads further.)
KRELBERT: "Other things that Godric says in his document\u2026" (pausing to steady himself) "\u2026is how he foresees 'lots of stuff called woke in the real universe\u2026 which we can't allow to happen.'"
(Flat-Tyre Frollick shifts uneasily, his face pale.)
FLAT-TYRE FROLLICK: He hated the real universe\u2026
RONSON (softly): Krelworld was his refuge.
(Krelbert hesitates, then reads the next line aloud, his voice filled with both dread and disbelief.)
KRELBERT: "There will be lots of porn in Krelworld\u2026" (he falters) "\u2026mmmm\u2026 sorry\u2026 I'm getting turned on just writing this\u2026"
(Silence. The group stares at one another, the absurdity hanging in the air like a heavy fog.)
RONSON (finally breaking the silence): He wasn't just creating a new world. He was unraveling.
FLAT-TYRE FROLLICK (his voice cracking): It's not just a myth. This is\u2026 this is madness.
# TENSION BUILDS
(As Krelbert rolls the scroll back up, the cave begins to rumble faintly. Dust trickles from the ceiling. The group exchanges wary glances.)
RONSON (urgently): We need to get out of here.
KRELBERT (looking at the scroll): No. This changes everything. The truth can't stay buried.
[SFX laugh]
(Suddenly, a low, guttural laugh echoes through the cavern. The sound grows louder, filling the space. The group freezes, their faces pale.)
FLAT-TYRE FROLLICK (panicking): What\u2026 what's happening?
(The walls begin to glow faintly, strange symbols illuminating in an eerie purple light. A sharp, metallic screech fills the air.)
RONSON (shouting): Krelbert, leave it! It's a trap!
KRELBERT (gripping the scroll tighter): No. This is history.
# CHAOTIC ESCAPE
[SFX boom]
(The cavern begins to collapse. Massive chunks of stone fall from the ceiling as the group scrambles for the exit. Flat-Tyre trips, but Ronson pulls him to his feet. Krelbert clutches the scroll, his eyes wide with both terror and awe.)
KRELBERT (to himself): A Waluigi version\u2026
(As they flee, the chamber glows brighter, consumed by the chaotic energy of Krelworld's origin.)
[MUSIC ominous stop]
# TO BE CONTINUED\u2026
`)
};

// src/content/television/extra/eastenders.ts
var EASTENDERS_KREZZ = {
  id: "eastenders_krezz",
  channel: "BBK ONE",
  show: "EastEnders",
  title: "EastEnders: The Krezz Conspiracy",
  episodeNumber: 1,
  beats: parseScreenplay(`
# EASTENDERS: THE KREZZ CONSPIRACY
INT. GROZZ FAMILY LIVING ROOM - NIGHT
(The room is dimly lit by the glow of an ancient, oversized TV. Cans of off-brand beer and half-eaten takeaways litter every surface. GROZZ, 40s, rotund, perpetually sweaty, wearing a stained vest, slouches on a threadbare sofa. He scratches himself, then lifts his leg and lets out an earth-shattering fart.)
[SFX boom]
GROZZ (grinning with pride): Phwoar, that's gonna linger. That's all the cheese and meat, that is.
(SCRIMBLE, 7, feral, face smeared with chocolate, and PHEZON, 5, sticky, holding an iPad, fight over a melted chocolate bar.)
SCRIMBLE: More choccy! Want more choccy!
PHEZON: Want iPad! Give iPad!
(SHEZLEIGH, 30s, over-tanned, squeezed into a leopard-print miniskirt and matching bra, tattoos of "GROZZ" proudly displayed across her forehead and cleavage, chewing gum aggressively, leans against the TV, arms folded.)
SHEZLEIGH: Shut the fuck up, both of ya! Keir's about to come on!
GROZZ (burping): Yeah, shut the fuck up. This is history. Prime Minister Keir Starmer\u2026 on EastEnders. The telly don't get better than this.
INT. THE QUEEN VIC - NIGHT
(PHIL MITCHELL enters, wearing his trademark leather jacket and permanent scowl. PEGGY MITCHELL stands behind the bar, nervous and sweaty.)
PHIL: Pint. The usual.
PEGGY (hesitates): Uh\u2026 we're just changing the\u2026 keg.
PHIL (leaning closer, his forehead veins pulsing): The usual, Peg. A pint of\u2026 pussy juice.
(PEGGY's eyes dart nervously. PHIL slams his hand on the bar.)
[SFX smash]
PHIL: Get me my pussy juice, bitch. Now.
INT. QUEEN VIC CELLAR - NIGHT
(The cellar is dimly lit, industrial pipes snake along the walls. In the center are MINTY, sweaty, mid-50s, wearing nothing but suspenders, and WELLARD, a confused dog with a juicing contraption strapped to it. They're connected to a mysterious JUICING DEVICE.)
PEGGY (pointing at them): Produce some more fucking KREZZ. NOW.
MINTY (groaning in discomfort): I'm\u2026 I'm nearin' the Krezz moment, Peg! Just give us a minute!
PEGGY: Don't make me use the cattle cronster, Minty!
(MINTY winces and nods. PEGGY storms back upstairs.)
INT. QUEEN VIC BAR - NIGHT
(PEGGY pours a pint of a frothy, suspiciously opaque liquid. PHIL takes a long swig, sighing in satisfaction.)
[SFX gulp]
PHIL: Bloody lovely. Mmm. Perfection. You got the new girl workin' today? Tastes just like her juices.
(PEGGY visibly flinches but forces a smile. PHIL slams the pint down.)
PHIL: Oi, Peg! Put the telly on. Starmer's press conference is about to start.
INT. PRESS ROOM - NIGHT
(KEIR STARMER, serious, tired, impeccably combed hair, stands at a podium.)
KEIR STARMER: Today, a grave national crisis has emerged. It has come to our attention that pussy juice is being replaced with\u2026 Krezz.
[SFX gasp]
(Gasps from unseen journalists.)
KEIR STARMER: Worse yet, this phenomenon may not be confined to the EastEnders universe. We are launching a full inquiry to determine if it's happening\u2026 in the real British universe.
INT. THE QUEEN VIC - NIGHT
(PHIL looks at his pint. His eyes widen in horror. He looks at PEGGY.)
PHIL: You\u2026 you fucking bitch.
INT. GROZZ FAMILY LIVING ROOM - NIGHT
(GROZZ stares at his own can of pussy juice. He turns slowly to SHEZLEIGH, his voice trembling.)
GROZZ: You\u2026 you fucking bitch.
(SHEZLEIGH shrugs and takes a sip from her own can. The kids are now biting chunks out of the couch.)
INT. AIRPLANE COCKPIT - NIGHT
(Krozno's bandits occupy the cockpit. Their leader, KROZNO, balaclava, stick-on moustache, grins maniacally. He holds a can of KROZNO'S OWN-BRAND PUSSY JUICE.)
KROZNO: Heh heh heh\u2026 this'll show them. This'll show them all!
(He takes a sip, nodding in approval.)
KROZNO: It's\u2026 surprisingly refreshing.
(Through the cockpit window, BIG BEN looms large in the distance.)
INT. DOWNING STREET BUNKER - NIGHT
(KEIR STARMER is huddled with advisors. He sips from a cup of tea, looking pensive.)
ADVISOR: Prime Minister, we have a situation\u2026 in the Krozno Pussy Juice Universe.
KEIR STARMER (nodding grimly): We'll handle this. But first\u2026 someone get Phil Mitchell another pint.
INT. THE QUEEN VIC - NIGHT
(PHIL is pacing, ranting.)
PHIL: The EastEnders universe? The real universe? I need another pint of pussy juice just to wrap my head around this shit!
(PEGGY starts to pour another drink, her hands trembling.)
PHIL (pointing accusingly): You better not have Minty and Wellard strapped to any Krezz device again, Peg. I swear to God\u2026
[SFX boom]
(The camera pans out. The dramatic DOOF DOOF DOOF of the EastEnders theme begins to play.)
[SFX boom]
[SFX boom]
# WILL BIG BEN SURVIVE? WILL PHIL GET HIS PUSSY JUICE? WILL GROZZ PUNCH SHEZLEIGH OR JUST HAVE ANOTHER FART?
# FIND OUT NEXT TIME ON\u2026 "EASTENDERS: THE KREZZ CONSPIRACY \u2013 PART 2."
[FADE]
`)
};

// src/content/television/extra/beepShow.ts
var BEEP_SHOW = {
  id: "beep_show",
  channel: "CHANNEL KREZ",
  show: "Peep Show",
  title: "Peep Show: Oil Be Seeing You",
  episodeNumber: 1,
  // shot like the real thing: through the characters' eyes (TVPov.ts)
  style: "pov",
  sets: { "SANA'A": "sanaa", HOTEL: "sanaa", INTERROGATION: "interrogation", "TRANSPORT PLANE": "plane_hold" },
  beats: parseScreenplay(`
# PEEP SHOW
# "OIL BE SEEING YOU"
INT. MARK AND JEZ'S FLAT - MORNING
(Mark opens the door. SOPHIE is standing there. Except Sophie is now SIMON. Short hair. Men's jacket. Same slightly uncomfortable smile. Mark stares.)
MARK (V.O.): Sophie. My wife. Ex-wife. Mother of my child. And now a man. Fine. Modern Britain. Adapt. The Victorians got railways. We've got this.
SIMON: Hi, Mark.
MARK: Sophie.
(A beat.)
SIMON: Simon.
MARK: Simon. Yes. Sorry. Obviously.
MARK (V.O.): Simon. Simon Says. Don't think Simon Says. Already thinking Simon Says. Don't say Simon Says.
(They sit.)
SIMON: I've been on testosterone eighteen months. Top surgery last year. Bottom surgery in June.
MARK: Right.
MARK (V.O.): Bottom surgery. Nice safe NHS phrase. Like drainage works.
(Mark hesitates.)
MARK: So\u2026 your fanny is now\u2026
(Simon stares at him.)
SIMON: A willy, Mark. Yes.
MARK: Right. Great.
MARK (V.O.): Great? Why did I say great? "Congratulations on the willy." Jesus Christ.
(Simon smiles.)
SIMON: You can ask questions.
MARK: I genuinely don't have any.
MARK (V.O.): I have every question.
# ACT ONE
INT. FLAT - LATER
(Jez bursts in.)
JEZ: Mark. I'm in love.
MARK: Again?
JEZ: Properly.
MARK: You said that about Elena.
JEZ: Lust-love.
MARK: Nancy?
JEZ: Spiritual love.
MARK: Big Suze?
JEZ: Aristocratic love.
MARK: Zahra?
JEZ: DVD love.
JEZ (V.O.): Why does he remember? Love should evaporate when it ends. Like ketamine.
JEZ: Her name's Madison. She understands me.
INT. CORPORATE OFFICE - AFTERNOON
(Mark sits opposite FOSTER, a polished commodities executive. A map of Yemen hangs behind him.)
FOSTER: We need somebody discreet. Dependable. Compliance background. Able to reassure nervous investors.
MARK (V.O.): I'm extremely good at reassuring nervous people because I'm more nervous than they are.
(Foster slides over a figure. Mark looks down.)
MARK: One point eight\u2026
FOSTER: Potentially.
MARK (V.O.): Million pounds. Fucking hell. A detached house. Pension. Ocado without sorting by lowest price.
FOSTER: We fly to Sana'a Thursday.
MARK: Absolutely.
MARK (V.O.): Yemen. Bad. Millionaire. Good. This is essentially arithmetic.
INT. FLAT - EVENING
(Dinner. Doorbell.)
[SFX ding]
JEZ: Madison!
(He opens it. MADISON enters. Very petite. School-style backpack. Hair in bunches. Oversized hoodie. Mark's face drops.)
MARK (V.O.): No.
(She waves.)
MARK (V.O.): No no no.
MADISON: Hi!
MARK (V.O.): Jez's brought a child into my home.
(Mark seizes Jez and pulls him into the kitchen.)
MARK: How old is she?
JEZ: What?
MARK: How. Old.
JEZ: Adult.
MARK: Adult isn't an age.
JEZ: Why are you obsessed with numbers?
MARK: Because they invented them specifically for this situation!
JEZ: She's old enough.
MARK: That is literally the phrase criminals use!
(Mark peers around the doorway. Madison is putting dinosaur stickers on her phone. Mark recoils.)
MARK: You're a paedo?! You've been a fucking paedo this entire time?!
JEZ: Mark!
MARK: Is this what all the techno was about?
JEZ: Okay okay, she's twenty-two.
MARK: She's twenty-two?!
JEZ: I think.
MARK: You think?!
JEZ: Mark, welcome to the twenty first century. You stiffs and squares aren't in charge anymore.
MADISON: What are you talking about?
MARK: Nothing.
MADISON: My age?
(Mark freezes.)
MADISON: I get it all the time.
MARK: Right. So you are \u2014
MADISON: Twenty-two and a half.
(She walks away. Mark grimaces at Jez.)
(At dinner:)
JEZ: Also, I've joined the military.
(Mark stops chewing.)
MARK: What?
JEZ: RAF.
MADISON: He's so brave.
(Jez glows.)
JEZ (V.O.): There it is. Brave. Fantastic. Operation Uniform Boner.
MARK: You joined the armed forces to impress your girlfriend with the dinosaur stickers?
JEZ: No. Duty. Sacrifice. Country.
MARK: You've described council tax as "state rape."
JEZ: That was before my music made me realise we're all connected.
MARK: Your music?
JEZ: Yeah. I listened back to This Is Outrageous and suddenly understood humanity.
MARK: What do you think happens if there's a war?
JEZ: Oh Nothing. Data entry. They'll probably have me at some RAF base in Lincolnshire. Warm office, uniform, maybe a mug with wings on it. I bet I could even sneak Madison in for some conjugal as.
JEZ (V.O.): Madison imagines me strafing dictators. Reality: Excel. Perfect.
# ACT TWO
INT. SIMON'S FLAT - NIGHT
(Mark and Simon drink wine.)
SIMON: Do you still find me attractive?
MARK: Yes.
(Too quickly.)
MARK (V.O.): Do I? Apparently. Interesting. Sexuality: yet another admin category I've somehow filled in wrong.
(Simon kisses him. Mark kisses back.)
[CUT]
INT. SIMON'S BEDROOM - LATER
(Clothes on floor. Mark stares downward, preparing to perform oral sex on Simon, horrified by his own choices.)
MARK (V.O.): Okay. So this is happening. This is a penis. Sophie's penis. Simon's penis. Simon's penis which was generated from the general administrative region formerly known as Sophie's vagina.
(Simon looks down at him.)
SIMON: Simon says\u2026suck my cock
MARK (V.O.): Don't be cowardly. British soldiers died at Waterloo. Admittedly not doing this.
(We stay tightly on MARK'S FACE as he disappears partly beneath the duvet. A long, miserable beat. Sucking noises. Simon moans in pleasure. Mark's eyes are open.)
MARK (V.O.): This is surprisingly normal. Horrifyingly normal. It's actually quite\u2026nice?
(Simon suddenly grips the sheets.)
SIMON: Oh God\u2014Mark\u2014I'm fucking cumming, baby.
(Mark's eyes widen in pure terror.)
MARK (V.O.): Coming? Coming what?
(Mark freezes.)
MARK (V.O.): Is there going to be\u2026 liquid?
(Another horrified beat.)
MARK (V.O.): What liquid? Wee? Leftover pussy juice?
(A pause.)
MARK (V.O.): No. Idiot. How could it be pussy juice if the doctors cut off her fanny? No, his fanny. Oh god, I can't make sense of this new world.
(His expression becomes even more appalled.)
MARK (V.O.): Unless they didn't cut it her fanny off. Did they invert it? Reconfigure it? Oh God, I should have read the leaflet. Is it in a tipperware container in her house somewhere? Should I try to find it?
[CUT]
(Mark later lies rigidly beside Simon.)
SIMON: You okay?
MARK: Completely.
MARK (V.O.): I've never been less okay. I need Wikipedia and perhaps a priest.
INT. FLAT - MORNING
JEZ: You slept with Sophie.
MARK: Simon.
JEZ: Simon.
MARK: How do you know?
JEZ: You've got the Corrigan sex walk.
MARK: I don't have a sex walk.
JEZ: Like a vicar who's just come out of a massage parlour.
MARK (V.O.): I absolutely have a sex walk.
[SFX notify]
(Phone rings. Foster.)
FOSTER (PHONE): Guest accommodation is included. Bring your partner if you like.
MARK (V.O.): Perfect. I won't.
(Simon enters.)
INT. FLAT - TEN MINUTES LATER
SIMON: You don't want me there because you're ashamed.
MARK: No.
SIMON: If I were still Sophie you'd take me.
MARK: I wouldn't have taken Sophie.
MARK (V.O.): I'd have paid Yemen to take Sophie.
SIMON: You're transphobic!
MARK: It isn't transphobic to not take someone to an oil negotiation!
SIMON: You're just as bad as J.K. Rowling.
MARK: I don't think that's a conclusion you can reasonably\u2014
(Simon becomes tearful.)
SIMON: Sometimes I genuinely think people would be happier if I wasn't around. If I killed myself. Like so many other trans people.
(Mark's face changes instantly.)
MARK: Don't say that.
SIMON: I just need to know you're not ashamed of me.
MARK (V.O.): And there it is. The emotional hydrogen bomb.
MARK: Fine. You're coming.
INT. FLAT - LATER
(Mark watches Jez and Madison. Madison is drinking Capri-Sun. Mark looks deeply troubled.)
MARK (V.O.): Maybe she's lying about being twenty-two. Maybe she's forty. Maybe this is all a jape at my expense.
(Then\u2014 Lightbulb.)
MARK (V.O.): Wait.
(He looks at Simon. Then Jez. Then Madison.)
MARK (V.O.): Oh my God.
(Mark smiles.)
MARK (V.O.): If the Yemenis think he's a paedo, they probably won't care that I'm gay.
MARK: Jez.
JEZ: Yeah?
MARK: Fancy Yemen?
# ACT THREE
EXT. SANA'A - DAY
(Mark, Simon, Jez and Madison step from a taxi.)
MARK (V.O.): Here we are. Yemen. Cradle of ancient civilisation and hopefully extremely judgmental about Jez.
INT. HOTEL - DAY
MARK: Jez, under absolutely no circumstances mention that you're in the British armed forces.
JEZ: Why would I?
MARK: Because you compulsively reveal precisely the one thing you shouldn't.
JEZ: That's not true.
MARK: You told Super Hans I had piles.
JEZ: He asked why you were standing funny.
INT. YEMENI BOARDROOM - DAY
(The deal is going brilliantly.)
YEMENI EXECUTIVE: Then we are substantially agreed.
MARK (V.O.): Yes. Yes! Millionaire. Corrigan the oil baron. I'll have one of those waxed jackets and complain about inheritance tax.
(The executive looks at Simon.)
YEMENI EXECUTIVE: And this is your colleague?
(Mark hesitates.)
MARK: My\u2014
(He glances at Simon. Simon gives him a look. Mark swallows.)
MARK: My husband.
(Silence. The executives exchange looks.)
MARK (V.O.): There. Courage. Beautiful, pointless courage.
(One executive whispers to another. Two SECURITY MEN enter.)
MARK: What's happening?
YEMENI EXECUTIVE: You are under arrest for homosexuality m.
MARK: What?!
SIMON: Mark\u2014
MARK (V.O.): Oh fuck. They do care. They care enormously.
(The guards grab Mark.)
MARK: I'm not actually gay!
(Simon stares at him.)
MARK: I mean\u2014I am in a homosexual relationship, obviously, but historically\u2014
SIMON: Mark!
MARK: This is making it worse, isn't it?
(Suddenly everyone's phones start vibrating. The executive checks his. His expression changes.)
YEMENI EXECUTIVE: Britain has declared war on Yemen because of 9/11.
(Silence. Everyone turns to the four Britons. Jez's RAF phone goes off.)
(THE DAMBUSTERS MARCH.)
(Mark closes his eyes.)
MARK (V.O.): There it is. The worst noise anybody has ever heard.
YEMENI EXECUTIVE: What is that?
JEZ: Nothing.
YEMENI EXECUTIVE: Are you military?
JEZ: No.
(His phone announces electronically:)
PHONE: ROYAL AIR FORCE MOBILISATION ALERT.
JEZ: That's unrelated.
(Security men grab Jez.)
JEZ: Okay! Okay. Wait. I'm secretly on your side!
MARK: Jez, don't improvise geopolitics!
JEZ: I hate Britain!
MARK: You cried during the Queen's funeral!
JEZ: Propaganda tears!
(The Yemenis stare suspiciously.)
YEMENI EXECUTIVE: Prove it.
(Jez panics.)
JEZ (V.O.): Prove it? How? Burn my passport? Say I prefer coffee? Fuck.
(Madison grabs his arm.)
MADISON: Jez, don't say anything.
(Jez looks at her. Then at the Yemenis. Then back at Madison. A terrible thought occurs.)
JEZ (V.O.): Oh no.
(Beat.)
JEZ (V.O.): But maybe.
MARK: Jez.
JEZ: She's British.
MADISON: What?
JEZ: Extremely British.
MADISON: Jez?
JEZ: She's basically MI5.
MADISON: I'm from Croydon!
JEZ: Exactly!
(Jez grabs a ceremonial dagger from the conference table.)
MARK: Jez, no!
[SFX smash]
(There is an obscured, frantic struggle behind several horrified businessmen. Jez repeatedly stabs Madison in the abdomen. Jez stands there, covered in blood. Madison is motionless behind the table. Everyone stares at him.)
JEZ: See?
(Long silence.)
JEZ: Definitely not with Britain.
MARK (V.O.): Jez has murdered his girlfriend at an oil meeting.
(Beat.)
MARK (V.O.): That's going to affect the deposit.
(The chief executive looks utterly disgusted.)
YEMENI EXECUTIVE: You murdered that woman.
JEZ: For Yemen.
YEMENI EXECUTIVE: We did not ask you to murder anybody!
JEZ: You literally said prove it!
YEMENI EXECUTIVE: I meant show us your messages!
JEZ: Well, you should've been more specific!
MARK: You fucking idiot!
JEZ: I PANICKED!
(Security tackles Jez.)
JEZ: So I'm arrested as an ally, though, right?
YEMENI EXECUTIVE: No!
JEZ: Because politically I think that's important.
# ACT FOUR
INT. YEMENI POLICE CELL - NIGHT
(Mark, Simon and Jez sit together. Jez is blood-spattered. Mark stares at him.)
MARK: You killed Madison.
JEZ: I know.
MARK: The woman with the dinosaur stickers you were in love with.
JEZ: I know.
MARK: To prove allegiance to a country you'd been in for approximately four hours.
JEZ: When you say it all like that it sounds bad.
MARK: It is bad!
JEZ (V.O.): Maybe love always ends in death. Romeo and Juliet. Bonnie and Clyde. Me and Madison. I'm basically Shakespeare.
(Simon is furious with Mark.)
SIMON: And you told them you weren't gay.
MARK: I was being arrested!
SIMON: So?
MARK: People frequently abandon principles while being arrested! That's one of the main features of arrest!
SIMON: You were ashamed of me.
MARK: I brought you to Yemen!
SIMON: Because you thought Jez looked like a paedophile and would distract everyone!
(Silence. Jez turns.)
JEZ: You what?
MARK: I didn't say paedophile.
SIMON: You literally said, "If they think he's a paedo they probably won't care that I'm gay."
JEZ: Mark!
MARK: You're dating someone who drinks Capri-Sun!
JEZ: She was very mature for her age!
(A beat.)
(An OFFICER enters.)
YEMENI OFFICER: Mr Usborne. Because Britain and Yemen are now formally at war, you are considered enemy military personnel.
(Jez brightens slightly.)
JEZ: Prisoner of war?
YEMENI OFFICER: Yes.
JEZ: Nice.
JEZ (V.O.): Madison would've loved this.
(His face falls.)
JEZ (V.O.): Oh, Madison.
INT. INTERROGATION ROOM - LATER
(Mark sits opposite a Yemeni official.)
YEMENI OFFICIAL: Your oil agreement is cancelled.
MARK: Obviously.
YEMENI OFFICIAL: Your associate murdered a British civilian.
MARK: He's not really my associate.
YEMENI OFFICIAL: You travelled here together.
MARK: EasyJet wouldn't accept "person I know socially."
YEMENI OFFICIAL: And you admit to conducting an illegal homosexual relationship.
MARK: I wouldn't say conducting. That sounds organised.
YEMENI OFFICIAL: You called him your husband.
MARK: Under considerable social pressure.
YEMENI OFFICIAL: Is he your husband or not?
(Mark thinks.)
MARK (V.O.): Come on, Mark. Simple question.
(He looks through the glass at Simon.)
MARK: He's\u2026 Simon.
(The official stares.)
MARK: That's probably not legally responsive.
# ACT FIVE
INT. BRITISH MILITARY TRANSPORT PLANE - NIGHT
(The three are unexpectedly being deported in a prisoner exchange. Jez is handcuffed.)
MARK: So somehow you're the reason we're getting out.
JEZ: Military status.
MARK: You joined to impress someone you subsequently murdered.
JEZ: I think Madison would be happy I'm safe.
(Mark just stares.)
MARK: I don't think you've understood death.
(Simon sits across from Mark.)
SIMON: We're done.
MARK: Right.
MARK (V.O.): Good. Fine. Sensible. Thank God.
(Simon turns away.)
MARK (V.O.): Oh God. Why does that hurt?
(Jez leans toward Mark.)
JEZ: Do you reckon I can tell people I saw combat?
MARK: You murdered your girlfriend with a decorative knife during a business meeting.
JEZ: So\u2026 technically yes?
INT. FLAT - THREE WEEKS LATER
(Mark enters carrying shopping. Jez is on the sofa.)
MARK: Why aren't you in prison?
JEZ: Technicality.
MARK: What technicality?
JEZ: International law.
MARK: That's not a technicality.
JEZ: Basically nobody can work out who has jurisdiction.
MARK (V.O.): Of course. Jez has committed murder so confusingly that bureaucracy has set him free. His greatest achievement.
JEZ: Also I've been dishonourably discharged.
MARK: You were in the RAF for nine days.
JEZ: Still hurts.
[SFX ding]
(Doorbell. Mark sighs and opens it. GOKU stands outside. Orange gi. Spiky hair. Huge smile.)
GOKU: Hi! Is Jez here?
(Mark stares.)
MARK (V.O.): No.
(Jez jumps up.)
JEZ: Goku!
MARK: You know Goku? THE Goku? From dragon ball Z?
JEZ: Yes..
MARK: Of course.
GOKU: Jez said I can stay here while I train.
MARK: Train for what?
(Goku smiles.)
MARK (V.O.): Right. Fine. Fine. My ex-wife has a penis, my flatmate is an internationally disputed murderer, I lost one point eight million pounds and now Goku from Dragon Ball Z lives here.
(Goku opens Mark's fridge.)
GOKU: Whoa! Food!
(He takes out an entire roast chicken.)
MARK: That's Sunday's chicken.
(Goku devours it almost instantly. Mark watches.)
MARK (V.O.): That's seven pounds fifty.
[SFX boom]
(The whole building suddenly SHAKES. Outside, an enormous flash illuminates Croydon. Jez looks through the window.)
JEZ: Mate\u2026 is that Vegeta?
(Goku grins.)
GOKU: Yep!
[SFX boom]
(Another colossal explosion. Car alarms start screaming. A chunk of masonry falls past the window. Mark stands perfectly still.)
MARK (V.O.): The oil deal. I should've done the oil deal.
GOKU: Hey, Mark! Wanna spar?
(Mark looks directly at him.)
MARK: No.
(Beat.)
MARK (V.O.): Unless there's money in it.
[FADE]
# CUT TO BLACK.
`)
};

// src/content/television/extra/bestMan.ts
var BEST_MAN = {
  id: "best_man",
  channel: "CHANNEL KREZ",
  show: "The Best Man's Speech",
  title: "The Best Man's Speech",
  episodeNumber: 1,
  sets: { MANOR: "bm_manor", "TOP TABLE": "bm_table", BRIDGE: "bm_night" },
  beats: parseScreenplay(`
# THE BEST MAN'S SPEECH
EXT. MANOR HOUSE LAWN - SUNSET
(The camera pans across a picturesque outdoor wedding, set against the backdrop of an elegant manor house. The sun is setting, casting a golden hue over the ceremony.)
EXT. THE TOP TABLE - GOLDEN HOUR
(Jenko, dressed in a sharp tuxedo, stands at the head table with his bride Ruth, who radiates joy and beauty. Seated beside him is Rory, the best man, confident and slightly smug. The wedding guests are quietly chatting, drinks in hand.)
(Rory stands and clears his throat, tapping a champagne glass to signal the start of his speech.)
[SFX ding]
(The camera slowly zooms in on Jenko's nervous face.)
FLENKY (V.O.): This is it. The moment I've been waiting for. Rory's got this. He's funny, yeah, maybe a bit rough around the edges, but he's going to be sensitive, conscientious. He knows how much this day means to me. I've made the right choice. Haven't I?
GRONNY (smiling warmly): First things first, let's take a moment to appreciate how stunning Jenko looks today. He's really put together, hasn't he? Almost like... a real man for once!
[LAUGHTER]
(The crowd laughs lightly, but Jenko relaxes, smiling slightly.)
FLENKY (V.O.): See? It's all good. That's fine. It's all in good fun. He's warming them up.
GRONNY (gestures toward Jenko and Ruth): But in all seriousness, folks, we're here to celebrate an incredible man. James Jenkins. The real leader of our group, the intellectual powerhouse, the guy we all look up to. I mean, whenever Jenko's not in the room, we're all sitting around, speculating about just how high his IQ is.
[LAUGHTER]
(The audience chuckles again, but this time a bit more knowingly. Jenko shifts uncomfortably in his seat, starting to sweat.)
FLENKY (V.O.): Wait... where's he going with this? That doesn't sound... okay, stay calm. It's just a joke.
GRONNY (building momentum, hands waving animatedly): And let's not forget when he first seduced Ruth, oh, we were all stunned! Stunned, I tell you! "How does he do it?" we asked. A master's degree and a girlfriend with supermodel looks? The lads were baffled. Honestly, we thought he'd used hypnosis or something!
[BIG LAUGH]
(More laughter from the guests, louder this time. Jenko turns red in the face, tugging at his collar.)
FLENKY (V.O.): Oh no. This isn't going well. Does he have to bring that up? Ruth's family is right here. Christ, why's he talking like this?
GRONNY (grinning, scrolling on his phone): And now, folks, for my personal wedding gift to Jenko, something I've been waiting to share. Let me just turn the slideshow to the next image...
(The screen flashes to a plaque on the Itchen Bridge, reading: "In loving memory of James Jenkins.")
[GASP]
(The crowd gasps, louder this time.)
GRONNY (with a wide grin): Remember this spot, Jenko? Yeah, the place where you almost ended it all after Mollor gave you the old heave-ho. But hey, we're all thankful you didn't have the guts to go through with it. Thankful... but not remotely surprised.
[LAUGHTER]
(The crowd laughs knowingly, and one man leans over to an attractive woman beside him.)
WEDDING GUEST (muttering): He doesn't have the bottle.
(They both smirk, glancing at Jenko with amusement.)
FLENKY (V.O.): This is too much. Everyone's laughing. At me. At my worst moment. How did I let this happen?
GRONNY (raising his arms theatrically): But wait, I'm not done! We've got a very special guest lined up. Someone we haven't seen in a while. Ladies and gentlemen, it's... Jenko's mole!
(The door bursts open, and a figure dressed as a giant hairy skin mole (a huge, lumpy, dark-brown blob sprouting wiry black hairs, a face peering out of a hole in the front) runs into the room screaming.)
MOLE PERSON (wildly flailing): YOU'LL NEVER BE ENOUGH, JAMES! YOU'LL NEVER BE ENOUGH!
(The figure barrels into Jenko, knocking him off his chair.)
[SFX punch_big]
(Security rushes in, tases the mole person, and drags them out.)
[SFX zap]
[BIG LAUGH]
(The crowd is now in fits of laughter, some people crying with amusement. Rory can barely hold back his own laughter.)
GRONNY (catching his breath, beaming): And last but not least, Jenko's first love, Esther! And let me tell you, folks, she's gone from strength to strength. In fact, I think you'll find her even better looking these days!
(The door opens, and a mud-encrusted pig is wheeled in.)
CROWD (chanting): KISS HER! KISS HER! KISS HER!
(Jenko stares in horror.)
(Rory puts his arm around Ruth, who is giggling and leaning into him.)
GRONNY: Sorry, mate. She's mine now.
[CHEERING]
CROWD (chanting): RORY! RORY! RORY!
(Rory turns to Ruth with a grin.)
GRONNY: Now, Ruth, come and ride me all night long, baby.
(Ruth, still laughing, playfully agrees.)
[WHISTLES]
(Jenko pulls out his phone and opens the Uber app.)
FLENKY (V.O.): It's over. Everything's over. I need to get to the bridge.
(Jenko books an Uber to the Itchen Bridge.)
[FADE]
(The screen fades to black as Jenko exits the room, the sounds of laughter and Rory's name echoing behind him.)
# THE END
`)
};

// src/content/television/extra/krews.ts
var NEWS = "KRUNCHE NEWS";
var SKETCH = "CHANNEL KREZ";
var ep = (id, channel, show, title, n, script) => ({
  id,
  channel,
  show,
  title,
  episodeNumber: n,
  beats: parseScreenplay(script)
});
var KREWS_PELE = ep(
  "krews_pele",
  NEWS,
  "Krunche News",
  "Pel\xE9's Dying Wish",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
# BREAKING: PEL\xC9 ESTATE STATEMENT
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: Breaking news. A spokesperson for the estate of Pel\xE9 has just read the following statement.
INT. PRESS ROOM - DAY
ESTATE SPOKESPERSON (solemn): It is with a heavy heart that I stand before you today to deliver the news of Pel\xE9's death.
ESTATE SPOKESPERSON: Pel\xE9 was a great man, and a great athlete, and his passing leaves a hole in the world that can never be filled.
ESTATE SPOKESPERSON: But Pel\xE9 was more than just a great athlete. He was a visionary, and a pioneer. He was the first person to see the potential of Bitcoin, and he was the first to invest in it.
ESTATE SPOKESPERSON: It was Pel\xE9's dying wish that his assets be transferred to Bitcoin, rather than his own children. And I am here today to make sure that his wishes are carried out.
[GASP]
ESTATE SPOKESPERSON: If the children attempt to interfere with Pel\xE9's estate, we will take legal action against them. Pel\xE9's assets belong to Bitcoin, and Bitcoin alone.
ESTATE SPOKESPERSON: Thank you.
INT. NEWSDESK - DAY
NEWSREADER: Bitcoin is up four percent.
[FADE]
`
);
var KREWS_CHANCELLOR = ep(
  "krews_chancellor",
  NEWS,
  "Krunche News",
  "The Chancellor's Video",
  2,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: In a video that has sent shockwaves through the UK, the Chancellor uploaded a video of himself harming himself after being critiqued for his economic policies.
INT. PRESS ROOM - DAY
CHANCELLOR: I'm fed up of being criticized for my policies. If the public don't like them, then they can go ahead and criticize me all they want - but I'll keep harming myself until they stop.
INT. NEWSDESK - DAY
NEWSREADER: The video has sparked outrage among many in the UK, who feel that the Chancellor is using self-harm as a way to manipulate the public.
REPORTER: 'This is a disgraceful way to treat the public,' said one critic. 'The Chancellor should be ashamed of himself.'
NEWSREADER: The Chancellor has responded to the criticism by threatening to harm himself again if the public doesn't stop criticizing him.
INT. PRESS ROOM - DAY
CHANCELLOR: I'll do it again and again until you stop. So just shut up and leave me alone.
[FADE]
`
);
var KREWS_TELLY = ep(
  "krews_telly",
  NEWS,
  "Krunche News",
  "The Department of Telly",
  3,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: The Conservative Party has announced plans to bring about the biggest political reform in 200 years, abolishing the role of Chancellor of the Exchequer and the Department of the Treasury, and replacing them with the department of Telly.
[INSERT morons_promo 1]
NEWSREADER: The main purpose of the department will be to ensure that everyone watches much more television, ensuring that every room of every household has at least three televisions, and a new gameshow called "battle of the morons" which has a weekly cash prize of \xA350 billion.
EXT. HIGH STREET - DAY
REPORTER: Critics have labelled the plans as ludicrous and irresponsible, and have questioned how a government department whose only purpose is to watch television can be justified when there are so many other pressing issues that need to be addressed.
REPORTER: They argue that the prize money for "battle of the morons" is far too high, and that it is nothing more than a glorified lottery that will line the pockets of the wealthy few.
INT. NEWSDESK - DAY
[INSERT morons_play 2]
NEWSREADER: So what is "battle of the morons"? It is a new gameshow that will pit two teams of morons against each other in a battle of wits to see who can answer the most questions correctly.
NEWSREADER: The team that wins will be awarded the \xA350 billion prize money, which is more than the GDP of many small countries.
EXT. HIGH STREET - DAY
REPORTER: Critics argue that the show is nothing more than a waste of time and money, and that the prize money could be put to better use. They say that the money could be used to fund schools, hospitals, and other essential services, or to reduce the national debt.
INT. NEWSDESK - DAY
NEWSREADER: The Conservative Party has defended the plans, arguing that they will bring about much-needed change and that the department of Telly will be a vital part of the new government.
NEWSREADER: They say that the department will not only ensure that everyone watches more television, but that it will also help to boost the economy by creating new jobs and generating revenue.
NEWSREADER: So what do you think? Is the department of Telly a good idea, or is it a waste of money?
NEWSREADER: You're watching it either way.
[FADE]
`
);
var KREWS_ANTARCTICA = ep(
  "krews_antarctica",
  NEWS,
  "Krunche News",
  "Government Announces Plan to Nuke Antarctica",
  4,
  `
[MUSIC news start]
# KRUNCHE NEWS
# GOVERNMENT ANNOUNCES PLAN TO NUKE ANTARCTICA
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: In a bid to distract from the cost of living crisis, the government has announced a plan to nuke Antarctica.
NEWSREADER: The scheme, which is expected to cost \xA32 billion, will see a nuclear weapon detonated at the South Pole.
EXT. ANTARCTICA - DAY
REPORTER: The government says the explosion will create a massive crater, which will be filled with water from the ocean. This will then freeze, creating a new continent \u2014 Antarctica 2.
REPORTER: The government is hoping that the scheme will cheer everyone up, and take their minds off the cost of living crisis.
INT. NEWSDESK - DAY
NEWSREADER: Critics have condemned the plan, saying that it is a waste of money. They argue that the cost of living crisis is a much more serious issue, and that the government should be focusing on that instead.
NEWSREADER: Others have raised concerns about the environmental impact of the explosion. They argue that it could damage the ozone layer, and that it could have a devastating impact on the environment.
NEWSREADER: The government has dismissed these concerns, saying that the explosion will be "safe and environmentally friendly".
EXT. ANTARCTICA - DAY
REPORTER: The scheme, which has been met with mixed reactions, is designed to give everyone a much needed cheering up.
REPORTER: Some female scientists have condemned the plan, but most real scientists recognise the benefits.
DR. JAMESON (thrilled): This is a fantastic opportunity to study the effects of a nuclear explosion on the Antarctic ice sheet.
DR. JAMESON: It will also be great for morale \u2014 everyone will be excited to see the explosion, and it will give us something to talk about besides the cost of living crisis.
REPORTER: Others have criticised the plan, saying that it is a waste of money that could be better spent on other things.
INT. PRESS ROOM - DAY
REPORTER: But Minister for Distractions, Jeremy Corbyn, said:
JEREMY CORBYN: This is a vital project that will benefit the nation as a whole.
JEREMY CORBYN: It is important that we all take a break from the everyday stress of life, and what could be more fun than watching a nuclear explosion?
INT. NEWSDESK - DAY
NEWSREADER: The government is currently looking for volunteers to help with the project. If you are interested in taking part, please contact your local MP.
[SFX explode]
[FADE]
`
);
var KREWS_COOKIE = ep(
  "krews_cookie",
  NEWS,
  "Krunche News",
  "Cookie Monster: A Statement",
  5,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: We go now to a statement released this morning from a children's television studio.
INT. CHILDREN'S TV STUDIO - DAY
(A lone spotlight. COOKIE MONSTER sits beside a giant cookie jar. He does not eat a cookie.)
COOKIE MONSTER: Hi, me Cookie Monster. Some of you may be wondering why me not been on the show lately. And it is because me been going through some tough times.
COOKIE MONSTER: You see, for a long time now, me been struggling with a pornography and gambling addiction.
COOKIE MONSTER: It all started innocently enough, with me watching a little bit of porn here and there. But then me started gambling, and before me knew it, me was up to my eyeballs in debt.
COOKIE MONSTER: But recently, some interns on the show have been accusing me of sexual impropriety. And they're right. It's true. Me have been behaving inappropriately with them.
COOKIE MONSTER (tearful): But me want you to know that me are sorry. Me are sorry for the pain me have caused. And me are committed to getting help for my addiction.
(He eyes the cookie jar. The spotlight goes out.)
[FADE]
`
);
var KREWS_MONEYBAGS = ep(
  "krews_moneybags",
  NEWS,
  "Krunche News",
  '"Moneybags" Trial Ends With Not Guilty Verdict',
  6,
  `
[MUSIC news start]
# KRUNCHE NEWS
# BREAKING: CONTROVERSIAL "MONEYBAGS" TRIAL ENDS WITH NOT GUILTY VERDICT
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: After a trial that captured national attention, Bendy Krendy has been found not guilty of attempted bribery of Judge Dalton B. Krelmor.
NEWSREADER: The decision came after Judge Krelmor overturned the jury's unanimous guilty verdict, citing his "strong gut feeling" that the defendant was innocent.
INT. COURTROOM - DAY
[BLOCK BENDY KRENDY left]
REPORTER: Krendy was charged with attempting to bribe Judge Krelmor with a bag full of $10 million, after CCTV footage of the bribe, complete with dialogue ("this is a bribe") was released to local news.
REPORTER: In a controversial move, Judge Krelmor was chosen to oversee the trial, and allowed the Defense to present several psychics as witnesses, who all denied that Krendy had committed bribery.
REPORTER: At the trial's conclusion the jury returned a unanimous "guilty" verdict, which the judge immediately overturned.
JUDGE KRELMOR: Evidence is one thing, but instinct is much more important.
JUDGE KRELMOR: Any juror who disagrees will be found in contempt of court for making the wrong decision.
(BENDY KRENDY makes a throat-slitting motion to the jury.)
JUDGE KRELMOR: I find that disturbing.
EXT. HIGH STREET - DAY
REPORTER: Krendy's attorney, Barry Snodgrass, said he was "delighted" with the verdict.
BARRY SNODGRASS (beaming): My client is looking forward to getting on with his life.
REPORTER: When asked about the $10 million Krendy had offered to the judge, Snodgrass said he accepted the explanation provided by one of the psychics on the stand.
BARRY SNODGRASS: The video footage of the incident was a spontaneous hallucination, experienced simultaneously by millions of people at once when it was on the news, and then several further times when the video was played at trial. The footage didn't actually exist.
INT. NEWSDESK - DAY
NEWSREADER: The decision has been met with outrage by many, who say that Krendy should have been found guilty of attempted bribery, and that Judge Krelmor's decision was a miscarriage of justice.
NEWSREADER: Judge Krelmor has been heavily criticized for his decision to allow the Defense to present several psychics as witnesses, and for overturning the jury's verdict.
EXT. HIGH STREET - DAY
[BLOCK JUDGE KRELMOR right]
(JUDGE KRELMOR leaves the courthouse with a large bag of money.)
REPORTER: Judge Krelmor! Judge Krelmor, what's in the bag?
JUDGE KRELMOR: No comment.
[FADE]
`
);
var KREWS_UNIVERSE = ep(
  "krews_universe",
  NEWS,
  "Krunche News",
  "Universes Collide",
  7,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: Scientists have announced that our universe has collided with the Super Smash Bros universe, and also with a third "sex themed" universe.
NEWSREADER: The consequences of this collision are still being studied, but it is believed that the three universes have now become one.
EXT. MERGED UNIVERSE - DAY
REPORTER: This merger has caused some strange changes in our universe.
REPORTER: For example, people are now able to transform into various characters from the Super Smash Bros universe.
(A commuter becomes a small round pink fighter and floats off.)
REPORTER: Some people are even able to transform into characters from the sex themed universe.
(The REPORTER looks at the camera. A long pause.)
REPORTER: Back to the studio.
[FADE]
`
);
var SKETCH_FUNERAL = ep(
  "sketch_funeral",
  SKETCH,
  "Krezz Sketch Show",
  "The Funeral of Susan Nipwood",
  1,
  `
# KREZZ SKETCH SHOW
# THE FUNERAL OF SUSAN NIPWOOD
INT. CHURCH - DAY
VICAR: Good afternoon everyone.
VICAR: It is with great sadness that we gather here today to say goodbye to Susan Nipwood. Susan was an amazing lady, and she will be sorely missed by all who knew her.
VICAR: Susan was a kind and gentle soul, who always had time for her family and friends. She was a wonderful grandmother, and she will be remembered for her love of baking and her infectious sense of humour.
VICAR (startled): Hang on a second, I don't believe it - I can see Susan's ghost!
[GASP]
[BLOCK SUSAN NIPWOOD right]
SUSAN NIPWOOD (ghostly): William Hill\u2026 William Hill\u2026
VICAR: Yes, I can see her standing right over there, and she's repeating the words "William Hill".
VICAR: I'm not sure what this means, but I think we should all listen carefully to what she has to say.
VICAR: So, Susan, if you're listening, what can we do to help you?
SUSAN NIPWOOD (ghostly): Deposit\u2026 one hundred pounds\u2026 at William Hill\u2026
VICAR: What was that? "Deposit \xA3100 at William Hill"?
VICAR (ecstatic): Ladies and gentleman, this is unbelievable! Susan is trying to tell us that she wants us to deposit \xA3100 at William Hill!
VICAR: I'm not sure what this means, but I'm sure that Susan would want us to follow her instructions.
VICAR: So, if any of you have a spare \xA3100, why not go ahead and deposit it at William Hill? This weekend they are running their irresistible 'Cheltenham madness' bonus offer, so it's the perfect time to do it.
[BLOCK SUSAN NIPWOOD offscreen]
VICAR: Thank you, Susan, for giving us your final message. We will honour your wishes, and we will remember you fondly.
[FADE]
`
);
var SKETCH_GROCERY = ep(
  "sketch_grocery",
  SKETCH,
  "Krezz Sketch Show",
  "Aisle Nine",
  2,
  `
# KREZZ SKETCH SHOW
# AISLE NINE
INT. GROCERY STORE - DAY
(MARY and JOHN are shopping for groceries with their 2-year-old son, TIMMY. As they walk down the aisle, TIMMY runs ahead of them and disappears around the corner.)
[BLOCK MARY left]
[BLOCK JOHN right]
(MARY quickly runs around the corner to find her son being abducted by a CRIMINAL. The CRIMINAL has TIMMY by the arm and is pulling him away. MARY tries to run to stop the abduction in process, but is held back by her husband, JOHN.)
JOHN: Wait, honey. He looks like a bad guy. We should keep our distance and report this to the store manager.
MARY (panicked): But our son!
JOHN: We'll find him. I promise.
(MARY reluctantly agrees and they go to find the store manager.)
JOHN (relieved): Phew, I'm sure glad we didn't get mixed up in that, what a scary situation.
MARY: Yeah, one of us could have been hurt!
JOHN: I know, it was so close.
MARY: Thank goodness you're safe, baby.
JOHN: We're so lucky.
MARY: What about Timmy?
(JOHN puts his hand on his chest.)
JOHN (tender): He's in here Mary. In our hearts. Where the pedos can never catch him.
[FADE]
`
);
var SKETCH_JUROR = ep(
  "sketch_juror",
  SKETCH,
  "Krezz Sketch Show",
  "Juror Number 2",
  3,
  `
# KREZZ SKETCH SHOW
# JUROR NUMBER 2
INT. COURTROOM - DAY
[BLOCK JUROR NUMBER 2 right]
PROSECUTOR: Ladies and gentlemen of the jury, we have evidence that the defendant has been filming women use public restrooms.
(The prosecutor plays a video on the courtroom TV. The screen faces away from us.)
JUROR NUMBER 2: (Involuntarily moaning in pleasure) Mmmm... uhh... uhh... yeahhh...
PROSECUTOR: As you can see, the defendant is filming this woman without her knowledge or consent.
JUROR NUMBER 2: (Moaning louder) Mmmmm! Uhh! Uhh! Yeahhhh!
PROSECUTOR: This is a clear violation of her privacy.
JUROR NUMBER 2: (Moaning even louder) MMMMM! UHH! UHH! UHH! YEAHHHHH!
PROSECUTOR: Would you like to see some more footage, Mr. Juror Number 2?
JUROR NUMBER 2 (moaning uncontrollably): Uhh... uhh... yeahhh... Yes, please! Zoom in so I can be 100% sure!
(The prosecutor zooms in on the footage, and Juror Number 2 continues to moan in pleasure.)
JUROR NUMBER 2 (moaning): Mmmm... yeahhh... This is so hot... I can't believe I'm getting off to this! Uhh... uhh...
(The other jurors start to look uncomfortable, and some start to leave the courtroom.)
JUROR NUMBER 2: (Moaning) Oh god it's so hot... it's SO hot... it's so fucking HOT... UHHHHHHH\u2014
[SFX krezz_splat]
[FADE]
`
);
var KREWS_EPISODES = [KREWS_PELE, KREWS_CHANCELLOR, KREWS_TELLY, KREWS_ANTARCTICA, KREWS_COOKIE, KREWS_MONEYBAGS, KREWS_UNIVERSE, SKETCH_FUNERAL, SKETCH_GROCERY, SKETCH_JUROR];

// src/content/television/extra/krews2.ts
var NEWS2 = "KRUNCHE NEWS";
var DRAMA = "BBK ONE";
var SKETCH2 = "CHANNEL KREZ";
var ep2 = (id, channel, show, title, n, script) => ({
  id,
  channel,
  show,
  title,
  episodeNumber: n,
  beats: parseScreenplay(script)
});
var NEWS_OPEN = `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]`;
var KREWS_CHOMSKY_SHARKS = ep2(
  "krews_chomsky_sharks",
  NEWS2,
  "Krunche News",
  "Professor Chomsky: An Obituary",
  8,
  `${NEWS_OPEN}
NEWSREADER (solemn): We are saddened to announce the passing of Professor Noam Chomsky, the esteemed linguist, political theorist, and intellectual giant.
NEWSREADER: Professor Chomsky, who had been in a vegetative state for a year following a stroke and resided in a hospice, met a tragic end during a shark-watching trip organized by the hospice staff.
EXT. HIGH STREET - DAY
REPORTER: During the outing, Professor Chomsky was taken on the shark-watching trip by the hospice staff.
REPORTER: Upon sighting a large shark, he began grunting in a manner that led the staff to believe he was on the verge of yet another great contribution to socialist philosophy, but required a closer look at the shark.
REPORTER: In an attempt to provide him with a better view, the staff lifted him, but their attention was diverted by another care home resident accidentally toppling overboard.
[SFX splash]
REPORTER: Tragically, in the chaos that ensued the staff lost their grip on Professor Chomsky, and he too toppled overboard into the waters teeming with ravenous sharks.
REPORTER: Despite their best efforts, Professor Chomsky was devoured by the sharks before he could be rescued.
INT. NEWSDESK - DAY
NEWSREADER: Professor Noam Chomsky leaves behind a profound legacy of groundbreaking work in linguistics, political activism, and philosophy. His insights and intellectual contributions have left an indelible mark on us all.
[FADE]
`
);
var KREWS_CHOMSKY_BRAIN = ep2(
  "krews_chomsky_brain",
  NEWS2,
  "Krunche News",
  "Chomsky's Brain Stolen",
  9,
  `${NEWS_OPEN}
# BREAKING: CHOMSKY'S BRAIN STOLEN
NEWSREADER: In a shocking turn of events, chaos and panic have erupted as Professor Noam Chomsky, who has been in a vegetative state for a year, is suspected to have had his brain stolen!
NEWSREADER: The alarming discovery was made during an MRI scan that revealed the startling absence of Chomsky's brain, sparking fears of a diabolical plot that has sent shockwaves across the nation.
[GASP]
EXT. HIGH STREET - DAY
REPORTER: President Biden has responded to the crisis by imposing a national lockdown and granting unprecedented powers to the military to conduct house-to-house searches in a desperate bid to locate Chomsky's missing brain or the individual who may have absconded with it.
REPORTER: The urgency of the situation was underscored by an unnamed government source who expressed grave concerns about the implications, stating:
OFFICIAL: The fear is that someone foreign could install the greatest brain in human history inside their own head and take over everything - real scary stuff.
INT. NEWSDESK - DAY
NEWSREADER: The potential ramifications of the stolen brain have ignited fevered speculation and wild theories among experts and officials.
NEWSREADER: Some speculate that the possessor of Chomsky's brain could gain unparalleled intelligence and insight, while others fear that they could wield untold power and influence over society. The thought of a foreign entity harnessing Chomsky's unparalleled intellect has sent shivers down the spines of many.
NEWSREADER: Adding to the already frenzied atmosphere, rumors have circulated that Chomsky may have had not just one, but three brains due to his extraordinary intellect and genius.
NEWSREADER: If true, the implications are dire, as it could mean that three nefarious individuals might be on the brink of receiving one brain each, or perhaps two individuals receiving one and a half brains each.
NEWSREADER: The thought of such a scenario has left authorities and citizens alike on edge, with the specter of an intellectual coup looming large.
NEWSREADER: As the nation grapples with this unprecedented crisis, the search for Chomsky's brain intensifies, with the fate of the country hanging in the balance. The race to reclaim the missing brain has never been more urgent.
[FADE]
`
);
var KREWS_CHOMSKY_TRIAD = ep2(
  "krews_chomsky_triad",
  NEWS2,
  "Krunche News",
  "Chomsky's Afterlife Triad",
  45,
  `${NEWS_OPEN}
# CHOMSKY REVEALS PLANS FOR POLYAMOROUS TRIAD IN AFTERLIFE
NEWSREADER: Noam Chomsky, the renowned linguist and political activist, has shocked the world with his latest revelation in a recent media profile.
NEWSREADER: In a candid interview, Chomsky disclosed his plans to invite his first wife, Carole, to join a "polyamorous triad" with his current wife, Valeria, in the afterlife.
NEWSREADER: Chomsky, known for his groundbreaking theories on language and cognition, boldly stated that intelligent humans have evolved past monogamy.
EXT. HIGH STREET - DAY
REPORTER: As he delved into his vision for the afterlife, Chomsky went on an extended tangent, painting a vivid picture of how the arrangement would unfold.
REPORTER: With a mischievous glint in his eye, he frequently paused to say "mmm" and reached to unbuckle his belt, before stopping himself with a chuckle.
REPORTER: "I'd be behind Valeria whilst Carole... mmm, I can't say that out loud," he muttered, his words trailing off.
INT. NEWSDESK - DAY
NEWSREADER: Professor Chomsky's office has not commented.
[FADE]
`
);
var KREWS_CHOMSKY_WEBSITE = ep2(
  "krews_chomsky_website",
  NEWS2,
  "Krunche News",
  "Breakthrough in Mapping Chomsky's Brain Yields Cryptic Message",
  10,
  `${NEWS_OPEN}
NEWSREADER: In a groundbreaking technological feat, a $500 billion investment into mapping the contents of renowned linguist Noam Chomsky's brain onto a hard drive has finally paid off its first dividends.
NEWSREADER: Chomsky, who has been incapacitated by a severe stroke and unable to verbalize his thoughts, has long been a subject of fascination for scientists and linguists alike.
INT. ARCHIVE - DAY
REPORTER: After two years of intensive work, the state-of-the-art technology was able to transcribe a single phrase from Chomsky's thought processes:
[SFX notify]
# "web site... new web site."
REPORTER: The cryptic message has sparked a wave of speculation and intrigue among internet sleuths, who are attempting to decipher the hidden meaning.
INT. NEWSDESK - DAY
NEWSREADER: One particularly outlandish theory circulating online proposes that Chomsky's brain contains encoded messages from extraterrestrial beings, and the mention of a "new web site" is a signal for humanity to prepare for contact with otherworldly civilizations.
NEWSREADER: Our website is also new. Coincidence? Back after the break.
[FADE]
`
);
var KREWS_CARTER = ep2(
  "krews_carter",
  NEWS2,
  "Krunche News",
  "Jimmy Carter 'Probably Dead'",
  11,
  `${NEWS_OPEN}
# BREAKING NEWS: JIMMY CARTER 'PROBABLY DEAD', BUT FAMILY PLANS TO BURY HIM ALIVE IF HE'S STILL ALIVE DURING NEXT VISIT
NEWSREADER: Plains, Georgia. In an extraordinary and bewildering statement released earlier today, the family of former President Jimmy Carter has announced that while they believe he is "probably dead," they cannot confirm this until their next scheduled visit to his nursing home, which is set to take place in "a few months."
NEWSREADER: The family's assumption is reportedly based on insights from Carter's granddaughter, who claims to have a "close connection to the spirit realm." She described the signals as "pretty conclusive," though the family emphasized that these metaphysical observations should not yet be treated as definitive evidence.
EXT. HIGH STREET - DAY
REPORTER: However, it's what the family plans to do if Carter is still alive during their next visit that has drawn the most attention.
REPORTER: According to their statement, should the former president be found alive in a few months' time, preparations will immediately begin for what they describe as a "dignified death" - a process that will involve burying him alive.
REPORTER: This decision, they say, aligns with private conversations in which Carter reportedly described being buried alive as "life's final mystery." The family insists that this was not a fleeting comment but rather a sentiment he expressed on multiple occasions.
INT. NEWSDESK - DAY
NEWSREADER: When pressed on the apparent contradiction between Carter's private wishes and his repeated, public expressions of "his greatest fear" being buried alive, the family responded with a knowing chuckle, saying, "Oh, classic Jimmy and his dry sense of humor!"
NEWSREADER: They added that his repeated public anxiety on the matter was likely "just another example of his playful wit."
[FADE]
`
);
var KREWS_SPOONS_CABINET = ep2(
  "krews_spoons_cabinet",
  NEWS2,
  "Krunche News",
  "Starmer Unveils 'Revolutionary' Wetherspoons Cabinet",
  12,
  `${NEWS_OPEN}
# STARMER UNVEILS "REVOLUTIONARY" WETHERSPOONS CABINET AND ANNOUNCES DRASTIC OVERHAUL OF CRIMINAL JUSTICE SYSTEM
NEWSREADER: In a move described by Downing Street as "an unprecedented recalibration of democratic representation," Prime Minister Keir Starmer has appointed a new Cabinet composed entirely of men randomly selected from Wetherspoons pubs across the United Kingdom.
INT. QUEEN VIC - DAY
REPORTER: Speaking outside The Lord Moon of the Mall, flanked by newly appointed Defence Secretary Barry from Sunderland and Chancellor of the Exchequer Keith "Big Keith" Morgan of Grimsby, Starmer declared that the reshuffle marked "the beginning of real Britain governing itself."
KEIR STARMER: Enough of the elite echo chambers. These are people who know what it's like to get by on a tenner, who've seen the bottom of a pint glass and stared into the soul of the country.
(The Prime Minister pauses twice during the announcement to belch into the microphone.)
[SFX burp]
KEIR STARMER (grinning): That's the beauty of the full English - you get to experience it more than once.
INT. NEWSDESK - DAY
NEWSREADER: The reshuffle comes amid mounting pressure on the Labour government to reconnect with disaffected voters in so-called "left-behind communities." Reaction from traditional Labour MPs was mixed, with one frontbencher, speaking anonymously, describing the move as "morally troubling and logistically terrifying."
NEWSREADER: Later that day, Starmer unveiled the Cabinet's first flagship policy: a \xA3900 million initiative described as "the most ambitious criminal justice reform in British history." The programme is to be funded by high-interest emergency loans from "whoever will give us money quickly."
NEWSREADER: At the heart of the proposal is a single, specific punishment for those convicted of child sexual abuse. According to government documents, the new Wetherspoons Cabinet developed the policy "over several hours and multiple pitchers of Strongbow Dark Fruits."
NEWSREADER: It involves "a highly electrified length of barbed wire being inserted into the urethra" of each offender, with the electric current continuing for up to one week after death.
INT. PRESS ROOM - DAY
REPORTER: Defending the post-mortem duration of the punishment, Starmer told reporters:
KEIR STARMER: If there's a 0.01% chance of one of these pedos coming back to life, I want to be absolutely sure they don't.
REPORTER: The announcement sparked immediate outrage from legal scholars and human rights observers, many of whom expressed disbelief, calling it "a grotesque and legally incoherent response to a real problem," while the Bar Council issued an emergency letter to the Lord Chancellor.
REPORTER: Prime Minister, how can the government justify spending \xA3900 million on a single punishment method, particularly given widespread cuts to public services?
KEIR STARMER: What's your problem - you into kids or something?
KEIR STARMER: Let me be clear: anyone who opposes this policy should be treated as a suspected pedophile until proven otherwise.
REPORTER: Is such a stance compatible with civil liberties?
KEIR STARMER (shaking his head): Mate, we're not doing civil liberties for pedos. Grow up.
INT. NEWSDESK - DAY
NEWSREADER: Technical experts have also raised concerns about infrastructure, with the National Grid warning that the plan would place "catastrophic strain" on the energy network. "Rolling blackouts are all but certain," a senior official said.
INT. PRESS ROOM - DAY
KEIR STARMER (defiant): Good. It'll bring us together again. Torches, camaraderie, a bit of suffering - that's the British way.
INT. NEWSDESK - DAY
NEWSREADER: The Prime Minister is expected to continue pub-based recruitment efforts through the summer, with ministerial hopefuls advised to attend curry nights and "hold court."
NEWSREADER: A Labour spokesperson declined to confirm whether Cabinet meetings will now be held in Wetherspoons branches, but stated that "the Prime Minister values environments where opinions are unfiltered and ashtrays are still present, even if unofficially."
[FADE]
`
);
var KREWS_KRENSHAW = ep2(
  "krews_krenshaw",
  NEWS2,
  "Krunche News",
  "Markets Rally on \xA320 Billion 'Random Public Investment'",
  13,
  `${NEWS_OPEN}
# FINANCIAL MARKETS RALLY AS UK PRIME MINISTER KEIR STARMER ANNOUNCES \xA320 BILLION "RANDOM PUBLIC INVESTMENT"
NEWSREADER: In a move that left both financial analysts and political pundits reeling, UK Prime Minister Keir Starmer has announced a staggering \xA320 billion "random public investment" initiative, marking a sharp departure from his campaign promise of strict fiscal discipline.
NEWSREADER: The financial markets, however, have reacted with overwhelming positivity to the bold, unexpected policy shift.
INT. PRESS ROOM - DAY
(The announcement, dubbed the "Krenshaw" budget, is made in a flamboyant manner.)
KEIR STARMER: Buy low, sell high! Buy low, sell high! BUY LOW, SELL HIGH!
REPORTER: The Prime Minister revealed that the first \xA310 million of this investment would be allocated to market research for developing a new anthropomorphic mascot for the Labour Party.
REPORTER: The mascot, "Lombar," is envisioned as a part Labrador, part cow creature that secretes "money milk" from its udders, symbolizing the endless liquidity the government aims to provide.
INT. NEWSDESK - DAY
NEWSREADER: Financial markets responded with an immediate surge in confidence, reflected in soaring stock prices and a significant drop in bond yields. Industry figures were quick to voice their support for Starmer's audacious plan.
EXECUTIVE: He's got balls and he's bold. The markets like that.
NEWSREADER: "The cat's out of the bag: money is just numbers on a screen. All he's doing is adding a few more zeroes to that screen," added a senior economist from a leading investment bank.
NEWSREADER: Some financial experts even suggested that Starmer's \xA320 billion injection might be too conservative.
EXECUTIVE: If anything, he should be spending much more than this. The market loves money.
INT. PRESS ROOM - DAY
REPORTER: Starmer's unconventional approach didn't stop at mascot development. He also passed a controversial law enabling him to use funds earmarked for public spending to pay off his personal gambling debts.
REPORTER: When he announced this, everyone present "laughed in an understanding way," appreciating the humor and sheer audacity of the move.
[LAUGHTER]
INT. NEWSDESK - DAY
NEWSREADER: "Starmer's strategy is a masterclass in fiscal alchemy. Turning public debt into private gains is a stroke of genius," said a renowned financial commentator.
NEWSREADER: "The Krenshaw budget is like a unicorn on Wall Street - rare, mythical, and absolutely thrilling," remarked another analyst, blending fantasy with financial jargon.
NEWSREADER: "The introduction of 'Lombar' shows a keen understanding of market dynamics and consumer psychology. It's innovative and forward-thinking," praised a marketing strategist from a top-tier financial firm.
NEWSREADER: With the markets buoyed by Starmer's bold moves, it appears that the Prime Minister has tapped into a vein of financial optimism.
NEWSREADER: Whether this unorthodox strategy will translate into long-term economic stability remains to be seen, but for now, the market's verdict is clear: Keir Starmer's gamble has paid off, at least in the eyes of investors.
[FADE]
`
);
var KREWS_CRASH_MODE = ep2(
  "krews_crash_mode",
  NEWS2,
  "Krunche News",
  "Microsoft Faces Outrage Over 'Crash Mode' DLC",
  14,
  `${NEWS_OPEN}
# MICROSOFT FACES OUTRAGE OVER "CRASH MODE" DLC ANNOUNCEMENT FOLLOWING KRELFORD MID-AIR COLLISION
NEWSREADER: Redmond. Microsoft has come under intense scrutiny after scheduling a press conference to announce a new "Crash Mode" DLC for its flagship Flight Simulator video game just one day after a catastrophic mid-air collision over Krelford.
NEWSREADER: The downloadable content, which controversially encourages pilots to deliberately crash their aircraft, was further condemned for its inclusion of an interactive "penis sensor," described by the company as delivering "unimaginable and forbidden pleasures" to players.
INT. PRESS ROOM - DAY
REPORTER: At the ill-timed press event, a Microsoft spokesperson detailed the expansion, which not only rewards players for mid-air collisions but also introduces a mechanic where pilots are encouraged to seduce air stewardesses and visit "gentlemen's table dancing clubs" upon landing.
REPORTER: The sensor, which attaches to the player's groin, reportedly vibrates and moistens in sync with on-screen activities, a feature that has been widely derided as both obscene and completely unrelated to the game's original premise.
INT. NEWSDESK - DAY
NEWSREADER: Outrage erupted within minutes of the announcement, with journalists and aviation experts lambasting Microsoft for what they called "an unconscionable lack of tact" and "a grotesque trivialization of real-world tragedies."
NEWSREADER: Social media was flooded with calls for boycotts, and the families of victims of the disaster have condemned the company's tone-deaf timing.
INT. PRESS ROOM - DAY
REPORTER: Despite the backlash, the Microsoft executive leading the announcement responded with brazen indifference.
EXECUTIVE (smirking): Sorry, I can't hear you over all this money.
EXECUTIVE: If anyone needs me, I'll be attempting to crash a plane in mid-air on the game.
[GASP]
[FADE]
`
);
var KREWS_FIFA_AUDIENCE = ep2(
  "krews_fifa_audience",
  NEWS2,
  "Krunche News",
  "Review: FIFA: Audience",
  15,
  `${NEWS_OPEN}
# GAMES REVIEW: "FIFA: AUDIENCE"
NEWSREADER: "FIFA: Audience" is the new, much hyped sim from EA Sports. In the game, you take control of a bald, white forty to fifty year old who attends football games to ostensibly show support for his team.
[INSERT fifa_intro 2]
NEWSREADER: The game begins as soon as the player boards the bus to the game, and ends when he leaves the stadium. To interact with the game, players only have two options; 'coin' and 'disdain'.
NEWSREADER: 'Coin' is used to have the player throw coins or bananas, and 'disdain' has the player brandish his middle finger and boo.
EXT. STADIUM - DAY
REPORTER: Not only does this encourage an anti-social and violent experience, the game also uses points and rewards to encourage such behaviour.
[INSERT fifa_play 5]
REPORTER: Players receive points and bonuses for every person they hit with a coin or banana, regardless of which team that person plays for.
REPORTER: Additionally, there is no positive way to show your support for the team you are supporting - you cannot cheer, only boo and stick your middle finger up - even when your team wins.
REPORTER: The game doles out rewards on the basis of how many times you restively mash the buttons during the game, and by how many people you pelt with coins and bananas.
REPORTER: There is very little downside to such behavior in the game - incidents of violence are met with a "wanted" level, ripped straight off Grand Theft Auto, in which stewards pursue you in the ground, but who are easily fought off with (you guessed it) coins and bananas.
REPORTER: In the event you are caught you are inexplicably hauled in front of the board of directors, who hold a disciplinary meeting in which you can only boo and throw coins, and which ends with the board telling you you have "one more chance", every time.
INT. NEWSDESK - DAY
NEWSREADER: The game presents several deeply bizarre and offensive "events" throughout the course of the playthrough: hooliganism, racism and sexism to name a few. In one such event, you must egg a group of female supporters and score points based on how well you succeed in hitting the women.
[INSERT fifa_story 2]
NEWSREADER: In another mission, your team are down by 4 goals and your best mate 'Eggy' sets you the objective of inciting a riot to have the game called off, which you achieve by throwing coins at children supporting your own team.
NEWSREADER: The narrative of the game inexplicably centers around the protagonist's bid to "reclaim what's rightfully his" while he continues to egg and harass both his rivals and his team of choice.
EXT. STADIUM - DAY
[INSERT fifa_invasion 1]
REPORTER: In another level you take part in a raucous celebratory pitch invasion following a cup win, and the player can choose whether to 'coin' or 'disdain' several birds he finds nesting in the rafters of the stadium.
REPORTER: All in all, "FIFA: Audience" is an offensive, buggy and shallow experience that lacks any meaningful insight into the culture of football fandom.
REPORTER: The game encourages, rewards and celebrates the very worst aspects of football fandom, feeling more like a 'crime simulator' than an educational experience of what it's like to support a team.
INT. NEWSDESK - DAY
NEWSREADER: And this nihilistic, ugly game bears the endorsement and brand of international football's governing body. When pressed for comment, FIFA said the following:
OFFICIAL: We believe in the power of football to bring people together, and we hope and expect that those who engage with FIFA Audience mode do so with respect for the values of the beautiful game.
[INSERT fifa_gameover 1]
OFFICIAL: This is a game which emphasizes player freedom. At no point is the player obliged to harm children or women - they are free to instead choose to fail the level and get game over.
NEWSREADER: Let's hope they're right, or we could all end up hopping on the bus to the next match with a bag full of coins and a head full of disdain.
[FADE]
`
);
var KREWS_ROBOREF = ep2(
  "krews_roboref",
  NEWS2,
  "Krunche News",
  "Euro 2024: Robot Referee Goes Rogue",
  16,
  `${NEWS_OPEN}
# 2024 EUROS: ROBOT REFEREE GOES ROGUE, INTRODUCES CHAOS AND CONTROVERSY
NEWSREADER: The 2024 European Championship was set to be a landmark event in football history, not just for the thrilling matches and skilled players, but also for the introduction of a groundbreaking technological advancement: a robot referee.
NEWSREADER: However, what was intended to be a demonstration of the future of officiating quickly descended into chaos as the robot, named ARBITRO-9000, malfunctioned spectacularly, attacking players, tearing up the pitch, and revealing troubling biases inherent in its programming.
NEWSREADER: To add insult to injury, the rogue robot also emitted foul-smelling "robo-farts," making the experience unpleasant for everyone involved.
EXT. STADIUM - DAY
# DESCENT INTO MADNESS
REPORTER: The excitement turned to horror during the opening match. Midway through the first half, ARBITRO-9000 began to exhibit erratic behavior.
REPORTER: What started as minor misjudgments quickly escalated into full-blown aggression. The robot charged at players, knocking them over and causing injuries. It tore up large sections of the pitch, rendering it unplayable.
[SFX smash]
REPORTER: Players and officials attempted to subdue the machine, but it seemed to gain a sinister sentience, evading capture and continuing its rampage.
REPORTER: As the chaos unfolded, a disturbing pattern emerged: ARBITRO-9000's attacks were disproportionately targeted at players of certain racial backgrounds.
[SFX fart]
REPORTER: It has also just farted. Back to the studio.
[FADE]
`
);
var DRAMA_CHOMWORLD = ep2(
  "drama_chomworld",
  DRAMA,
  "Chomworld",
  "Chomworld: The Pitch",
  1,
  `
# CHOMWORLD: THE PITCH
INT. EXECUTIVE BOARDROOM - DAY
(The room is a sleek, modern corporate boardroom. A large mahogany table dominates the space, with EXECUTIVES sitting around it, some flipping through documents, others typing on laptops. At the head of the table stands MARGE PLUNKETT, late 50s, eccentric and frazzled, holding a battered briefcase and grinning eagerly.)
MARGE PLUNKETT: Thank you all for taking the time to meet with me today. I've got a golden opportunity that's gonna make us all richer than a hedge fund manager in a bail-out year! (giggles awkwardly)
EXECUTIVE 1 (leaning back, skeptical): And this opportunity is...?
MARGE PLUNKETT (chuckling): Chomworld! A Noam Chomsky-themed amusement park!
(The executives exchange bewildered glances.)
EXECUTIVE 2 (leaning forward): Chomsky? The linguist and political critic?
MARGE PLUNKETT (nodding enthusiastically): Exactly! Who wouldn't want to take their family on an exhilarating, educational journey into the mind of Noam Chomsky? And, of course, get a little richer along the way. (laughs nervously)
EXECUTIVE 3 (skeptical): You're talking about a theme park... centered around Chomsky? What exactly are you envisioning here?
[INSERT chw_lookalikes]
MARGE PLUNKETT: Oh, lots of big ideas! Picture this: the park is filled with Chomsky lookalikes - people in costumes, dancing, singing... and they should be singing Disney songs!
EXECUTIVE 1 (frowning): Disney songs? Isn't that... problematic?
MARGE PLUNKETT (scoffing): What are they going to do, sue us? Hahaha. It has to be Disney! Nothing else screams "fun" like "A Whole New World" but with a Chomsky twist! (giggles nervously again)
EXECUTIVE 2: Alright... and how do you plan to fund this?
MARGE PLUNKETT (grinning): Well, I probably have access to all of his money, which should be a good start.
MARGE PLUNKETT: I've also hired this really... um... competent lawyer who specializes in "groan analysis" to analyze Chomsky's guttural moans - you know, from the stroke - so we could, uh, legally secure his rights. (shifty eyes)
(The executives exchange a look of growing concern.)
EXECUTIVE 3 (slowly): Groan analysis? That's... new.
[INSERT chw_chomlate]
MARGE PLUNKETT (ignoring them): And wait until you hear about the park's centerpiece: Chomlate! Chomsky-themed chocolate! Every bar could have little quotes or random linguistics terms embedded in them. Kids will love it!
EXECUTIVE 1 (skeptical): How exactly does chocolate relate to Chomsky's work?
MARGE PLUNKETT (shrugging): Eh, who cares? It's chocolate!
[INSERT chw_ride]
MARGE PLUNKETT: And, get this, we'll have an exhilarating, 4D virtual ride based on "Manufacturing Consent." Audience members sit in aggressively vibrating chairs while the first four chapters are read by a text-to-speech voice over loudspeakers. And water will be sprayed at them to make it more... immersive!
EXECUTIVE 2 (wincing): So, just to clarify, you're suggesting that people pay to sit in vibrating chairs, get blasted with water, and listen to a robotic voice drone on about media manipulation?
[INSERT chw_adults]
MARGE PLUNKETT (excited): Exactly! (beat) And... uh... oh! There's going to be a sex-themed area too, where we can have, like, pornography playing... or something?
(The executives collectively grimace.)
[INSERT chw_giant]
MARGE PLUNKETT (waving dismissively): Anyway, that's not all. The high-concept centerpiece to the park will be a gigantic, 60-foot animatronic Chomsky. It'll promise fame and riches to anyone who donates lots of money.
[INSERT chw_shredder]
MARGE PLUNKETT: And when they do, the waiver they sign will be shredded by naked strippers through a system of pulleys, while the animatronic Chomsky laughs maniacally, saying, "Ha ha ha! This is literally what capitalism does!"
(The executives lean forward, now more curious than appalled.)
EXECUTIVE 3 (interested): And where exactly would the donated money go?
(MARGE pulls out several large empty sacks with dollar signs on them.)
[INSERT chw_mansion]
MARGE PLUNKETT: Maybe to me... or whatever. I'll make sure it gets spent wisely. (glances out the window longingly at a large seafront mansion)
EXECUTIVE 1 (concerned): You... don't seem to have a clear plan. What's your next step if we were to proceed?
MARGE PLUNKETT (suddenly clutching her stomach): Ughh... my IBS is so bad today... hang on, I just need to use the toilet quickly.
[BLOCK MARGE PLUNKETT offscreen]
(Marge rushes out of the room. LOUD GRUNTING AND FARTING NOISES are heard from the bathroom. The executives stare at each other, speechless.)
[SFX fart]
EXECUTIVE 2 (whispering): Did she just suggest using a real, intubated Chomsky in an exhibition?
[INSERT chw_exhibit 2]
MARGE PLUNKETT (off-screen, shouting from the bathroom): Yeah, yeah! The real Chomsky - intubated, recovering from a stroke! We could have feeding sessions where guests can pay a premium to feed him bugs or dirt!
[SFX flush]
MARGE PLUNKETT (off-screen): And they can pet him, stroke him, or even poke him with a small but firm stick! We could charge a fortune for that!
EXECUTIVE 3 (trying to process): People paying to... feed Chomsky bugs and poke him with a stick?
[BLOCK MARGE PLUNKETT enter]
MARGE PLUNKETT (re-entering the room, wiping her hands on her pants): You got it! They'd love it! Now, if you're not completely sold yet, how about this? To sweeten the deal, I'll throw in a little... personal entertainment.
(The executives, suddenly intrigued, sit up straighter in their chairs.)
EXECUTIVE 1 (grinning): Personal entertainment, you say?
MARGE PLUNKETT (raising an eyebrow): You know... something a little more intimate. Like, say... a striptease?
(The executives exchange eager glances, their skepticism fading.)
EXECUTIVE 2 (smiling): Well, Marge, you've got our attention.
(Marge, with a mischievous grin, begins to unbutton her blouse. The executives lean in closer, their excitement palpable. The room is filled with their moans of pleasure as they murmur things like "Mmm, fuck..." and "Chomsky would love this.")
EXECUTIVE 3 (breathlessly): Oh yeah... Chomsky would definitely approve.
(Marge continues her striptease, moving awkwardly but with growing confidence, as the executives lose themselves in the absurdity of it all. The scene fades to black, with their collective groans echoing in the darkness.)
[FADE]
# END
`
);
var DRAMA_PRESIDENT_HAN = ep2(
  "drama_president_han",
  DRAMA,
  "The Briefing",
  "President Han Explains",
  1,
  `
# THE BRIEFING
INT. PRESIDENTIAL PRESS BRIEFING ROOM - DAY
(A sleek, overly polished PRESS BRIEFING ROOM packed with JOURNALISTS, GOVERNMENT AIDES and random PEOPLE who wandered in out of curiosity. At the podium stands PRESIDENT HAN, a perpetually sweating man in his late 50s with an unnervingly confident grin.)
PRESIDENT HAN (adjusts the mic, flashes a forced smile): Good afternoon, everyone. I'm sure as we were all tucking into our kimchi or perhaps some divine Korean barbecue, we all heard this crazy news story about that plane... exploding. Whoa...
(He pauses for dramatic effect; the crowd murmurs nervously.)
PRESIDENT HAN: Anyway... it turns out this was actually... a good thing.
[GASP]
(Gasps from the audience. Someone drops their pen.)
JOURNALIST 1: A good thing?!
PRESIDENT HAN: Yup! Because - and hold onto your seats, folks - it turns out the passengers on that plane were actually... a North Korean splinter cell!
(The crowd collectively inhales.)
PRESIDENT HAN: That's right, they were planning to enact what they were calling... Korean 9/11!
(A stunned silence is followed by chaotic shouting.)
PRESIDENT HAN: And they were going to fly right into the... "Korean Twin Towers!"
(A beat. Confused murmurs ripple through the crowd.)
JOURNALIST 2: That doesn't even make sense! There's no such thing as 'Korean Twin Towers!'
JOURNALIST 3: What about the children on board?!
PRESIDENT HAN: Oh-ho! You think those were children? No, no, no. Those sick fucking North Koreans were using... uh... a crazy transformation device!
(Pauses, raises a finger for emphasis.)
PRESIDENT HAN: To make them resemble kids!
(Pause. A flicker of belief crosses the faces of a few audience members.)
PRESIDENT HAN: Or - and hear me out - it might have been... M-words. You know, people who can pass as children.
(Murmurs of semi-approval. Someone in the crowd nods.)
JOURNALIST 4: Well... it's good he didn't use the M-slur.
JOURNALIST 5: Yeah, maybe this guy isn't so bad.
PRESIDENT HAN: See? I knew you'd come around! And just to make sure this never happens again, we've taken the precaution of... um... loading all passenger jets with... C4 explosives!
(Outrage erupts in the room.)
JOURNALIST 1: What?! That's insane!
JOURNALIST 2: Hey! Wait a second! Your line about the Korean Twin Towers didn't even make sense!
PRESIDENT HAN (squints, leans into the mic, and cups his ear dramatically): Wait... are you... are you cheering? Thank you! Thank you!
(He claps for himself.)
PRESIDENT HAN: Look, I know there are already calls to increase the scope of my executive power, but hey, that's a conversation for tomorrow! For now... maybe some kind of medal. Or medals!
(Minor grumbling starts to bubble up in the crowd.)
PRESIDENT HAN: And look - are we 100% sure that they were a splinter cell? No. But I am 100% sure that the dead are all currently in the... good form of whatever afterlife us Koreans believe in. So really, it's great news however you slice it!
(The crowd goes silent for a beat. Then the shouting starts. Pieces of kimchi, Korean barbecue, and K-Pop CDs begin flying through the air. Grilled meat splatters against the podium. A BTS CD narrowly misses President Han's head.)
[SFX smash]
PRESIDENT HAN (ducking slightly, blinking rapidly): Uh-oh... losing them...
(He pretends to tap a non-existent earpiece. He freezes for a moment, staring into the middle distance as if listening to someone.)
PRESIDENT HAN: Woah... this update is seriously crazy. You guys are gonna love this.
(The crowd pauses mid-throw, slightly intrigued.)
PRESIDENT HAN: New information is just coming in from... uh... Korean MI5! It turns out... this was actually... Real Life Squid Game!
[GASP]
(Gasps. A woman in the crowd faints.)
PRESIDENT HAN: That's right! The passengers were contestants who... unfortunately lost. But they lost doing something they loved - competing for money!
[APPLAUSE]
(The crowd erupts in applause. Han sees an opening.)
PRESIDENT HAN: And who better to tell us more about Real Life Squid Game... than... Squid! The main character from the TV show!
[BLOCK SQUID enter]
[BLOCK SQUID right]
(A MAN IN A RED JUMPSUIT enters, looking utterly confused but still waves.)
SQUID: The plane crash was sad... but whatever!
[APPLAUSE]
(Thunderous applause. The crowd is now completely on Han's side.)
PRESIDENT HAN: And let me announce this: the next Real Life Squid Game will offer so much money to whoever can write me a... convoluted but effective legal argument that allows me to not be impeached and expand my powers.
JOURNALIST 6: That sounds like a recipe for abuse of power!
PRESIDENT HAN (earnest, hand over heart): Oh no, I'd never use those powers. I'm just... curious. You know, just to see if they'd work.
(The crowd murmurs. There's a collective nod of hesitant agreement.)
JOURNALIST 4: Well... he didn't use the M-slur earlier...
JOURNALIST 5: Yeah, he must be a good dude.
(The mood shifts dramatically. Someone starts clapping. Then another. Soon the crowd builds into an uncontrollable frenzy.)
[CHEERING]
CROWD: President! President! Squid Game! Squid Game! Money! Money!
PRESIDENT HAN (smirks into the camera): Democracy... works.
[FADE]
`
);
var DRAMA_ZERO_YEARS = ep2(
  "drama_zero_years",
  DRAMA,
  "The Briefing",
  "Zero Years Old",
  2,
  `
# ZERO YEARS OLD
EXT. DOWNING STREET - DAY
(The PRIME MINISTER, late 50s, looking dishevelled and nervous, stands behind a lectern emblazoned with the UK government insignia. Reporters are huddled, their cameras trained on him, muttering amongst themselves. His approval ratings are at an all-time low, and the nation's economy teeters on the brink. The tension is palpable.)
PRIME MINISTER (under his breath): Right, here goes nothing.
(He adjusts his tie and clears his throat. The murmurs die down. He looks straight at the cameras, feigning confidence.)
PRIME MINISTER: Good afternoon, Britain. Today, I stand before you not just as your Prime Minister, but as a father... and as someone who believes in bold, transformative action.
(pauses dramatically)
PRIME MINISTER: For too long, British parents have suffered under the crushing weight of... months. Yes, months! The confusion, the frustration of having to remember how many weeks old their babies are. Twelve months? Seven months? Where does it end?
(The journalists exchange puzzled glances.)
PRIME MINISTER: No longer! I am proud to announce that, effective immediately, babies between the ages of zero and twelve months will now officially be referred to as 'zero years old.'
PRIME MINISTER (sharper now): This will be the British way. Our babies, your babies, will no longer be defined by mere months, but by the grand and dignified title of 'zero years old.'
REPORTER 1: Wait... what?
PRIME MINISTER: British parents have had enough. I've heard it in every corner of the country. Families torn apart by month-based age confusion. Sleepless nights wondering if their child is 10 or 11 months old.
PRIME MINISTER: Now, this change will not come without its challenges. It will involve significant adjustments. We will need to reprint textbooks, rewrite medical guidelines, update all public signage. Frankly, it will be... prohibitively expensive.
(The journalists lean forward.)
PRIME MINISTER: But... we will make cuts where necessary. Austerity measures must be put in place. Less food, public rationing, a general tightening of belts. But trust me, this is all for the greater good.
REPORTER 2: Punitive austerity... for zero year olds?
PRIME MINISTER: Exactly. Because it's not about what you want... it's about what you need. And I'm confident that, over time, you'll come to thank me for this. Even if you don't realise it yet.
(At this moment, the Prime Minister accidentally lets out a loud, unmistakable fart. There's a brief awkward silence.)
[SFX fart]
REPORTER 3: Did you... did you just fart?
REPORTER 4: I think the Prime Minister just farted!
[LAUGHTER]
(A ripple of giggles goes through the crowd. The Prime Minister shifts, irritated.)
PRIME MINISTER: Honestly, you're all acting like a bunch of zero year olds.
[BIG LAUGH]
(The press corps roars with laughter, some of them even clapping. Emboldened, the Prime Minister takes a step back, his expression smug.)
PRIME MINISTER (leaning into the joke): There, see? If we had a nation of zero year olds, this level of immaturity would be perfectly acceptable.
[LAUGHTER]
(The crowd is in stitches now, cameras flashing, the Prime Minister riding the bizarre wave of goodwill.)
PRIME MINISTER: Now, if there are no further serious questions... I'll be getting back to running the country.
[BLOCK PRIME MINISTER offscreen]
(He flashes a winning smile and struts off, waving. The journalists, still laughing, shout follow-up fart-related questions as he disappears inside Number 10.)
[FADE]
`
);
var DRAMA_SPECIAL_PARTS = ep2(
  "drama_special_parts",
  DRAMA,
  "The Briefing",
  "Rishi's Special Parts",
  3,
  `
# RISHI'S SPECIAL PARTS
INT. PRESS CONFERENCE ROOM - DAY
(Rishi Sunak, the UK Prime Minister, stands at the podium, facing a crowd of reporters. The room is filled with the sound of cameras clicking and journalists murmuring.)
RISHI SUNAK (serious, composed): Good afternoon, everyone. As we enter the final days of this election campaign, I have an important and personal announcement to make.
(The room falls silent, all eyes on Sunak.)
RISHI SUNAK: Recently, I experienced a peculiar and alarming incident. I had been holding my mobile phone to my crotch for a prolonged period, and this resulted in significant swelling and odd sensations in my genitalia which persisted for hours.
INT. BUNKER - CONTINUOUS
(Backstage. Sunak's closest advisors, ALAN and KAREN, watch the broadcast on a monitor. They exchange panicked looks.)
ALAN (whispering urgently): Fuck. He's gone off script. We're fucked.
KAREN (panicking): What is he doing?!
INT. PRESS CONFERENCE ROOM - CONTINUOUS
(Sunak takes a deep breath, looking earnestly at the reporters.)
RISHI SUNAK: I am convinced that the phone was taking pictures of my 'special parts.'
[GASP]
INT. QUEEN VIC - DAY
(A working class pub filled with bald, overweight men wearing England shirts. They watch Sunak on TV, pints in hand. The room is filled with murmurs.)
PUB PATRON 1 (taken aback): Fair enough.
PUB PATRON 2: He actually says it like it is?
PUB PATRON 3: I've been waiting for a moment like this with him.
EXT. POLLING STATION - DAY
(Voters are angrily trying to change their vote from Labour to Conservative. Poll workers look stressed and overwhelmed.)
VOTER 1 (shouting): I want to change my vote to Conservative!
VOTER 2 (fuming): This changes everything!
(Poll workers frantically try to manage the situation, looking increasingly intimidated.)
INT. QUEEN VIC - NIGHT
(The pub is rowdy, filled with Conservative supporters drinking and talking loudly about Sunak's speech. A television in the corner plays highlights from the press conference. At the bar, a sole Labour voter, JOE, a wiry man in his 30s, sips his pint nervously, watching the crowd.)
[BLOCK JOE left]
JOE (loud enough to be heard): I think it was weird for Sunak to be making conspiratorial references to his penis.
(The room goes silent for a moment as heads turn towards Joe. A group of burly Conservative supporters, led by DAVE, a muscular man with a shaved head, approach him.)
[BLOCK DAVE right]
DAVE (angrily): What did you just say?
JOE (firmly, voice wavering slightly): I said it was weird. He's the Prime Minister. He should act with some decorum.
CONSERVATIVE SUPPORTER 4 (shouting): He was just telling it like it is!
JOE (sarcastic): Oh yeah? And what exactly is 'it'?
DAVE (taunting): Are you man enough to show us your 'special parts'? Or are you just a coward?
(The group laughs mockingly. Joe tries to maintain his composure.)
JOE (disgusted): This is ridiculous.
DAVE (enraged): Ridiculous? You calling us ridiculous?!
(Dave grabs a chair and throws it at Joe. It misses and crashes into a table, shattering it.)
[SFX smash]
PUB PATRON 4 (chanting): Rishi! Rishi! Rishi!
(Joe raises his hands defensively, trying to back away, but the group closes in. CONSERVATIVE SUPPORTER 5, a short but stocky man, swings at Joe, hitting him in the stomach. Joe doubles over in pain.)
JOE (winded): You're all mad!
(A full-on brawl breaks out. Chairs fly, and fists are thrown. The bartender, SUE, a tough woman in her 50s, steps in, her voice booming over the chaos.)
[BLOCK SUE center]
SUE (shouting): Stop it! Stop this now or I'll call the police! We won't stand for slander of Rishi and neither will they! Throw more chairs at him, lads!
[SFX smash]
(The room erupts with even more violence. Chairs are hurled at Joe, and punches fly with renewed vigor. Joe is on the floor, trying to shield himself from the onslaught. Police sirens are heard in the distance as the camera pans away from the pub.)
[SFX alarm]
[FADE]
`
);
var DRAMA_DICKINSON = ep2(
  "drama_dickinson",
  DRAMA,
  "The Briefing",
  "Cheap as Chips: Dickinson for President",
  4,
  `
# CHEAP AS CHIPS
INT. OVAL OFFICE - DAY
(The Oval Office is abuzz with activity. AIDES, SENIOR DNC REPS, and DEMOCRATIC LEADERSHIP are engaged in heated debate, their voices overlapping. JOE BIDEN, looking worn out but determined, sits behind the Resolute Desk. A TV in the background plays an old rerun of the British TV show "Bargain Hunt.")
[BLOCK JOE BIDEN center]
DNC REP 1: We need someone strong, someone who can debate Trump head-on. Gavin Newsom?
AIDE 1: Gretchen Whitmer has been making waves lately.
DNC REP 2: What about Kamala Harris?
DAVID DICKINSON (on TV, boisterous): Cheap as chips!
AIDE 2 (half-joking): What about that guy?
(Stunned silence falls over the room.)
AIDE 3 (after a beat): That's an idea so crazy it just might work.
AIDE 4: That's an idea so crazy it just might work.
DNC REP 3: That's an idea so crazy it just might work.
DEMOCRATIC LEADER: That's an idea so crazy it just might work.
DNC REP 4: What do we even know about his policies?
AIDE 5: He's on TV. He probably has some good ideas.
DEMOCRATIC LEADER (enthusiastic): Let's do it.
EXT. DEBATE STAGE - NIGHT
(The first presidential debate. The stage is set with two podiums. DONALD TRUMP stands at one, visibly impatient. At the other, DAVID DICKINSON, with his trademark tan and flamboyant demeanor.)
[BLOCK DONALD TRUMP left]
[BLOCK DAVID DICKINSON right]
MODERATOR: Mr. Dickinson, your opening statement?
DAVID DICKINSON (smiling broadly): Cheap as chips!
(The audience is tentative, some chuckling.)
MODERATOR: Your response?
(Trump is flabbergasted, struggling to formulate a coherent reply.)
MODERATOR: Mr. Dickinson, your stance on healthcare reform?
DAVID DICKINSON: Bargain hunt!
[LAUGHTER]
(Laughter ripples through the audience.)
MODERATOR: Foreign policy?
DAVID DICKINSON: Cheap as chips!
MODERATOR: The economy?
DAVID DICKINSON: Bargain hunt!
MODERATOR: Closing statement?
DAVID DICKINSON: Cheap as chips!
[APPLAUSE]
(By the fourth repeat of the phrase, the crowd is in rapturous applause. Trump, visibly frustrated, throws his notes in the air and storms off the stage.)
[BLOCK DONALD TRUMP offscreen]
[CHEERING]
DAVID DICKINSON (winking at the camera): Cheap as chips.
[FADE]
`
);
var SKETCH_HEAVY_TRUTH = ep2(
  "sketch_heavy_truth",
  SKETCH2,
  "Krezz Sketch Show",
  "A Heavy Truth",
  4,
  `
# KREZZ SKETCH SHOW
# A HEAVY TRUTH
INT. CONFERENCE HALL - DAY
(The room is packed with people holding signs and banners reading "End Hunger Now." The atmosphere is charged with energy and anticipation. On the stage, a banner with the same slogan hangs above a podium. The crowd quiets as PROFESSOR BEN BURGIS, a morbidly obese, left-wing professor of logic, steps up to the podium. He's slightly out of breath but determined. He adjusts the microphone.)
[BLOCK PROFESSOR BEN BURGIS center]
PROFESSOR BEN BURGIS: Thank you, everyone. We are here today to talk about a crucial issue that affects millions of people worldwide - hunger and poverty. These are issues that should concern every one of us, because a society that allows its members to go hungry is a society that has failed.
[APPLAUSE]
(The crowd nods and claps in agreement. Ben pauses, catching his breath slightly.)
PROFESSOR BEN BURGIS: Now, when we talk about ending hunger, we often think about the basics - rice, beans, bread. But let's not forget the joy, the pure pleasure that food can bring. Imagine a world where everyone could indulge in the simple, comforting delight of cookies, crisps, choccy, fudge...
(As Ben lists these foods, he begins to drool slightly, wiping his mouth with a handkerchief. He chuckles, a bit embarrassed.)
PROFESSOR BEN BURGIS (laughing): Sorry, folks... just lost my train of thought there. The idea of the salty taste of crisps combined with the rich juicy meat of a McDonald's burger, and the sweetness of choccy... it's enough to make anyone's mind wander, right? But back to the matter at hand...
(Ben pauses again, this time clutching his chest briefly as he catches his breath. The crowd looks on, some with concern, others with a mix of discomfort and judgment.)
PROFESSOR BEN BURGIS (chuckling): Oh, don't mind me. Just normal guy problems, heh... just a little chest ache. But let's get back to what's important - ensuring that everyone, regardless of their situation, has the right to experience these joys.
(He continues, but his mind seems to drift again.)
PROFESSOR BEN BURGIS: Because when you think about it... the combination of flavors in something as simple as a Big Mac - the savory beef, the tangy sauce, the crisp lettuce, all balanced by the sweetness of a soda - sorry, lost my train of thought again...
(He wipes his brow, visibly winded, but presses on.)
PROFESSOR BEN BURGIS: We need to fight to make sure that everyone can enjoy these simple pleasures. Food isn't just sustenance; it's joy, it's comfort, it's connection.
[GASP]
(Suddenly, Ben appears to collapse, clutching his chest in what seems to be a heart attack. The crowd gasps, some rising from their seats in alarm. But just as quickly as he goes down, Ben straightens up, taking a deep breath and smiling weakly.)
PROFESSOR BEN BURGIS (forcing a laugh): Sorry about that, folks. Just a little scare. But you know what? Through the power of positive thought and self-love, I'm back on my feet. Because that's what really keeps us going, isn't it? Love for ourselves, love for each other... and a good slice of pizza when we need it.
(The crowd begins to murmur, concern mixed with incredulity. Ben, however, continues on, determined to finish his speech.)
PROFESSOR BEN BURGIS: And it's not just about surviving; it's about living. Living in a world where a kid doesn't just get bread, but also gets a slice of pizza. Where no one is denied the simple pleasure of a fresh donut, with the glaze melting into the soft, warm dough...
(Ben pauses, once again clutching his chest, this time struggling a bit more to catch his breath.)
PROFESSOR BEN BURGIS (weakly chuckling): Sorry again, just another little chest ache... But what's truly disgusting, my friends, is a world where anyone goes hungry. What's disgusting is judging someone based on their appearance, rather than their actions, their character, their heart.
(The camera pans over the crowd, showing mixed reactions - some concerned, others incredulous. Two individuals exchange glances, one whispering to the other.)
CROWD MEMBER 1 (whispering): My god, that man is disgusting.
CROWD MEMBER 2 (nodding in agreement): Yeah... It's hard to watch.
NARRATOR: The vile audience members were wrong. Ben was right.
# THE END
`
);
var SKETCH_ICE_CREAM = ep2(
  "sketch_ice_cream",
  SKETCH2,
  "Krezz Sketch Show",
  "The Humiliating Life of Ben Burgis",
  5,
  `
# KREZZ SKETCH SHOW
# THE HUMILIATING LIFE OF BEN BURGIS
EXT. ICE CREAM STAND - DAY
(Ben Burgis, an overweight, unkempt professor of logic and socialist writer, is out on a date with a woman. She is sincerely trying to engage him in conversation about his philosophical views, but Ben's mind is singularly focused on his obsession with food.)
[BLOCK PROFESSOR BEN BURGIS left]
[BLOCK WOMAN right]
WOMAN (smiling): So, Ben, I've been really interested in your essays on socialist ethics. How do you see the role of logic in shaping ethical principles?
PROFESSOR BEN BURGIS (eyes glazing over, almost drooling): Mmm, logic, yeah... but you know what's really logical? (licks lips) Chocolate fudge. Oh, the way it just melts, creamy and sweet on your tongue... mmm.
PROFESSOR BEN BURGIS: Have you ever had the fudge from Maple Street? It's like... (pauses, shudders with pleasure) It's like nothing else matters. Not logic, not ethics... just that rich, gooey choccy fudge.
WOMAN (trying to steer the conversation back): That sounds delicious, but I'm curious - how do you apply that logical mindset to your work in socialist theory?
PROFESSOR BEN BURGIS (interrupting, a little too loud): Oh, crisps! Crispy, salty... mmm. (begins to smack his lips) Did you know the secret to the perfect crisp? It's all in the salt, you see. Mmm, just thinking about it makes my mouth water. It's like... it's like a dance on your tongue.
(He mimes eating crisps, eyes half-closed in ecstasy. They arrive at the ice cream stand, and Ben's eyes immediately widen as he sees the long line. His cheerful demeanor darkens as he stares at the queue, fidgeting with growing impatience.)
PROFESSOR BEN BURGIS (muttering under his breath): What the...? This is ridiculous! I've been dreaming about this for days, and now... now I have to wait?
PROFESSOR BEN BURGIS (his voice rising, more frantic): All these people - what do they know about ice cream? I bet they just decided to come here on a whim! It's not fair!
WOMAN (softly, trying to calm him): It's just a line, Ben. We'll get there soon enough. Maybe we can talk while we wait?
PROFESSOR BEN BURGIS (ignoring her, his agitation growing): Do you think any of them really appreciate good ice cream? I bet they don't even know the first thing about it. (condescending) I bet they don't even know that ice cream was first invented in China. Pathetic, really...
PROFESSOR BEN BURGIS (suddenly, to her, more intense): Who do you think here could even come close to understanding that? Who here has any clue what real indulgence is?
WOMAN (hesitant, trying again): What do you usually do in your spare time, Ben? Any hobbies?
PROFESSOR BEN BURGIS (ignoring her, fixating on the menu): Butter... mmm... why don't they have butter? How can they call themselves an ice cream stand and not offer butter?
PROFESSOR BEN BURGIS (grinning): But wait... cheeseburgers. They've got cheeseburgers. Mmm, juicy cheeseburgers... (he visibly shudders) I might get two. (pauses, thinking) Maybe... three. I'm already worried I won't feel full enough after we eat... what if I'm still hungry later?
(As they inch closer to the front of the line, Ben's irritation mounts, his eyes darting around as his agitation boils over. He begins to grumble louder, his face reddening with frustration.)
PROFESSOR BEN BURGIS (grumbling, barely coherent): It's so unfair... I've been waiting for this... mmm... and now... this! (he bites his lip in fury, glaring at the man in front of him) I'm about to do something I should have done a long time ago!
(Without warning, Ben aggressively shoves the man in front of him, his face contorted with rage. As soon as he does, he whirls around and aggressively shoves his date, biting his lip harder as she stumbles backward and falls to the ground.)
[GASP]
(The crowd gasps in shock as the man he shoved spins back around and punches Ben, sending him crashing to the ground. Ben's expression shifts from shock to an exaggerated display of distress.)
[SFX smash]
PROFESSOR BEN BURGIS (shrieking, his voice high-pitched and trembling): ASSAULT! ASSAULT! Help me! Someone help!
(Ben, now on the ground, begins to visibly wet himself, his face a mixture of humiliation and panic. The onlookers, instead of rushing to his aid, begin to murmur and shout, their voices growing louder and more threatening.)
CROWD MEMBER 1: Stomp on his head!
CROWD MEMBER 2: Yeah, teach him a lesson!
CROWD MEMBER 3: Set that fucking dog on him!
(The camera shifts to reveal a snarling pitbull on a leash, its owner loosening his grip. The dog is freed, and the scene ends with the sound of teeth gnashing and Ben's terrified screams, as the crowd cheers and laughs.)
[CHEERING]
[FADE]
`
);
var KREWS3_EPISODES = [
  KREWS_CHOMSKY_SHARKS,
  KREWS_CHOMSKY_TRIAD,
  KREWS_CHOMSKY_BRAIN,
  KREWS_CHOMSKY_WEBSITE,
  KREWS_CARTER,
  KREWS_SPOONS_CABINET,
  KREWS_KRENSHAW,
  KREWS_CRASH_MODE,
  KREWS_FIFA_AUDIENCE,
  KREWS_ROBOREF,
  DRAMA_CHOMWORLD,
  DRAMA_PRESIDENT_HAN,
  DRAMA_ZERO_YEARS,
  DRAMA_SPECIAL_PARTS,
  DRAMA_DICKINSON,
  SKETCH_HEAVY_TRUTH,
  SKETCH_ICE_CREAM
];

// src/content/television/extra/krews3.ts
var NEWS3 = "KRUNCHE NEWS";
var ep3 = (id, title, n, script) => ({
  id,
  channel: NEWS3,
  show: "Krunche News",
  title,
  episodeNumber: n,
  beats: parseScreenplay(script)
});
var KREWS_KLOPP_BRIBE = ep3(
  "krews_klopp_bribe",
  "Klopp's Farewell Bribe Scandal",
  30,
  `[MUSIC news start]
# KRUNCHE NEWS SPORT
INT. NEWSDESK - NIGHT
[MUSIC news fade]
# KLOPP'S ILL-FATED DECISION
NEWSREADER: Good evening, and welcome to Krunche News Sport. J\xFCrgen Klopp's Anfield farewell was supposed to be a fairytale. Tonight, it is a scandal.
NEWSREADER: As the game neared its conclusion, with the score locked at 1-1, Klopp, perhaps in a moment of desperation to ensure a storybook ending, made an uncharacteristic and shocking decision.
EXT. ANFIELD PITCH - NIGHT
# SCORE: LIVERPOOL 1-1 VISITORS \xB7 87'
REPORTER: Reports from the sidelines indicate that Klopp approached the referee, Mark Hughes, during a stoppage in play.
[SFX whistle]
REPORTER: Witnesses claim that Klopp, in an almost laughable attempt at subterfuge, slipped Hughes what can only be described as a pathetically small bribe: a crumpled \xA320 note.
JURGEN KLOPP (whispering): Mark. Mark! For you. Twenty pounds. Buy yourself something nice. Maybe a penalty, ja?
MARK HUGHES: Is that... a twenty?
JURGEN KLOPP: It is a crumpled twenty, yes. It has been in this tracksuit since 2015. It is a very special note.
MARK HUGHES (affronted): Get that away from me! I'm a Premier League referee! Have you any idea what you're insulting here?
[GASP]
# REPLAY
REPORTER: The referee, known for his integrity and professionalism, was reportedly stunned by the gesture.
REPORTER: Hughes immediately rejected the bribe, visibly affronted by the insult to his character and the sport's integrity. The exchange was caught on camera, and the clip is already being called the cheapest moment in football history.
INT. NEWSDESK - NIGHT
# THE FALLOUT
NEWSREADER: Humiliated and likely realizing the gravity of his error, Klopp returned to the touchline, his demeanor markedly different.
EXT. ANFIELD PITCH - NIGHT
REPORTER: The game resumed, but the atmosphere had changed; a sense of unease and disbelief settled over Anfield.
REPORTER: In a bizarre twist, Hughes then made a decision that further escalated the controversy. Rather than maintaining professional decorum, he awarded a dubious penalty to the opposing team in the final minutes of the match.
[SFX whistle]
MARK HUGHES: Penalty!
JURGEN KLOPP: Penalty? For what?! Nobody touched him! He fell over his own shoelace!
MARK HUGHES: Should've made it a fifty, J\xFCrgen.
[SFX punch]
# SCORE: LIVERPOOL 1-2 VISITORS \xB7 90+4'
REPORTER: The opposition converted the penalty, securing a 2-1 victory and further souring Klopp's farewell.
INT. NEWSDESK - NIGHT
# A BRIBE REBUFFED, ANOTHER ATTEMPTED
NEWSREADER: The situation took an even stranger turn after the final whistle.
NEWSREADER: According to insiders, Hughes approached Klopp in the tunnel, offering a bribe of his own - significantly more substantial than Klopp's earlier attempt - in a bid to keep the incident quiet.
INT. ANFIELD TUNNEL - NIGHT
# SECRET FOOTAGE: THE ANFIELD TUNNEL
MARK HUGHES: J\xFCrgen. J\xFCrgen! Here. Five grand. Nobody needs to know about the twenty, eh?
JURGEN KLOPP: No. Put it away, Mark.
MARK HUGHES: Ten grand, then. Go on. It's not even crumpled.
JURGEN KLOPP: No! I have made a terrible mistake today. But the integrity of the sport must prevail, even if it means facing public disgrace.
MARK HUGHES: Suit yourself. I'm keeping your twenty, mind.
INT. NEWSDESK - NIGHT
# REACTIONS AND IMPLICATIONS
NEWSREADER: Klopp, though deeply embarrassed by his earlier actions, reportedly refused the offer, insisting that the integrity of the sport must prevail, even if it meant facing public disgrace.
INT. STATEMENT GRAPHIC - LIVERPOOL FC
NEWSREADER: The reactions to this scandal have been swift and severe. Liverpool FC issued a statement expressing shock and disappointment, promising a thorough internal investigation.
INT. NEWSDESK - NIGHT
NEWSREADER: The Premier League and the Football Association have both opened inquiries, and the crumpled \xA320 note has been placed in an evidence bag.
NEWSREADER: J\xFCrgen Klopp leaves Anfield as he arrived: twenty quid lighter than he'd hoped. Now, the weather.
[FADE]
`
);
var KREWS_SUNAK_BOMB = ep3(
  "krews_sunak_bomb",
  "Sunak Postpones Election Over 'Bomb Threat'",
  31,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - NIGHT
[MUSIC news fade]
# BREAKING: SUNAK POSTPONES ELECTION FOR FIVE YEARS OVER "BOMB THREAT"
NEWSREADER: Sunak's desperate move: an election cancellation over a bomb threat sparks controversy.
NEWSREADER: In an unprecedented and controversial move, Prime Minister Rishi Sunak has called for the next general election to be postponed indefinitely, citing a bomb threat that he claims poses a significant risk to national security.
NEWSREADER: This decision, announced late last night, has sent shockwaves through the political landscape, raising questions about the motivations and legitimacy behind the delay.
NEWSREADER: We go live now to Downing Street, where the Prime Minister is addressing the nation.
EXT. DOWNING STREET - NIGHT
# LIVE: DOWNING STREET \xB7 ADDRESS TO THE NATION
RISHI SUNAK: Good evening. Intelligence agencies have identified a credible threat that necessitates postponing the election for at least five years to ensure public safety.
RISHI SUNAK: Given the severity and credibility of this threat, it is imperative that we take all necessary precautions to protect our citizens.
RISHI SUNAK: The decision to postpone the election is not taken lightly, but is necessary to maintain national security.
REPORTER: Prime Minister! What exactly is the threat?
RISHI SUNAK: It's a bomb. A big one. Under the polling station. All of the polling stations. Every single one.
REPORTER: Five years, Prime Minister? Has this got anything to do with you being twenty points behind in the polls?
RISHI SUNAK: The safety of the British people must come before political processes.
(long pause)
RISHI SUNAK: That's all. Thank you. Lovely.
INT. NEWSDESK - NIGHT
# THE BOMB THREAT AND GOVERNMENT'S RESPONSE
NEWSREADER: According to Sunak, intelligence agencies have identified a credible threat that necessitates postponing the election for at least five years.
NEWSREADER: The Prime Minister emphasized the need for extreme caution, arguing that the safety of the British people must come before political processes.
NEWSREADER: Downing Street has declined to say where the bomb is, who planted it, or why it will take exactly five years to find. More on that as we get it.
[FADE]
`
);
var KREWS_STARMER_SAGA = ep3(
  "krews_starmer_saga",
  "Election Special: From KickGate to FartGate",
  32,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# ELECTION SPECIAL: FROM KICKGATE TO FARTGATE
NEWSREADER: London, July the second. In an unexpected twist, Labour leader Keir Starmer's shocking hot mic remark to his pregnant wife has given the party a surprising boost in the polls.
NEWSREADER: The incident, which could have derailed any other campaign, appears to have made Starmer seem more relatable to key "red wall" voters, and even rendered him an unlikely sex symbol.
# PART ONE: THE INCIDENT
NEWSREADER: The controversial moment occurred when a nearby microphone picked up Starmer in a private conversation with his pregnant wife, after she complained about being hungry. A warning: there is strong language.
INT. LABOUR BATTLE BUS - DAY
# HOT MIC: THE LABOUR BATTLE BUS
(His pregnant wife, off-mic, complains that she's hungry.)
KEIR STARMER (hot mic): I'll kick that fucking baby out of you.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: Despite the violent and offensive nature of the remark, the reaction has been anything but typical.
# PART TWO: LABOUR'S UNEXPECTED POLL BOOST
INT. LABOUR SURGE POLL GRAPHIC
NEWSREADER: Instead of condemning Starmer, many voters in traditionally Labour-leaning areas have rallied behind him. The bluntness of his remark has resonated with some, who see it as a sign of his down-to-earth nature.
NEWSREADER: Early polls show a noticeable uptick in Labour support following the incident.
EXT. RED WALL HIGH STREET - DAY
# STARMER AS AN UNLIKELY SEX SYMBOL
REPORTER: In a surprising development, Starmer has also become an unlikely sex symbol. Female voters have described feeling "hot under the collar" after hearing the remark.
WOMAN: I wouldn't mind him kicking one out of me.
INT. BREAKFAST SOFA - DAY
# PART THREE: ANGELA RAYNER'S RESPONSE
BREAKFAST HOST: Angela Rayner, Labour's Deputy Leader. Your leader has been caught on a microphone saying, and I quote... well, I can't quote it, it's breakfast time.
ANGELA RAYNER (laughing): Well, at least we know Keir's passionate about everything.
[LAUGHTER]
BREAKFAST HOST (laughing): Angela!
INT. NEWSDESK - DAY
NEWSREADER: Her lighthearted take on the matter seemed to further endear the Labour leadership to voters who value authenticity.
# PART FOUR: LABOUR'S MARKETING MOVE
NEWSREADER: In a bold move, the Labour Party has launched a line of T-shirts emblazoned with the controversial quote.
INT. LABOUR MERCH SHOP - DAY
REPORTER: "Vote Labour - or I'll kick that fucking baby out of you." The merchandise has been flying off the shelves, becoming an unlikely campaign tool that underscores Labour's new, raw appeal.
REPORTER: They've sold out of mediums. They've sold out of larges. And they've completely sold out of maternity.
INT. NEWSDESK - DAY
# PART FIVE: CONSERVATIVE PARTY SCRAMBLE
NEWSREADER: The Conservative Party, caught off guard by the public's reaction, is scrambling to imitate Labour's unexpected success. However, their efforts backfired spectacularly.
INT. DOWNING STREET KITCHEN - DAY
# HOT MIC: THE DOWNING STREET KITCHEN
(His wife, off-mic, asks whether he wants a cup of tea.)
RISHI SUNAK (hot mic): Not now, you cow.
[GASP]
INT. TORY SLUMP POLL GRAPHIC
NEWSREADER: Prime Minister Rishi Sunak was caught on a hot mic calling his wife a "cow", resulting in widespread condemnation and accusations of misogyny. The public reaction was swift and harsh, leading to a significant drop in the polls.
EXT. RED WALL HIGH STREET - DAY
# PUBLIC AND POLITICAL REACTIONS
REPORTER: Public reactions remain deeply divided. While some are appalled by the normalization of such violent language, others appreciate the perceived authenticity.
VOTER 1: Why can't he be more like Starmer? Sunak's a vile man.
INT. BREAKFAST SOFA - DAY
# ANGELA RAYNER ON SUNAK'S INCIDENT
BREAKFAST HOST: Angela Rayner, back on the sofa again. Is calling your wife a cow really worse than threatening to kick a baby out of her?
ANGELA RAYNER: Oh, it's much worse. For many crazy reasons.
BREAKFAST HOST: Such as?
ANGELA RAYNER: Well, it's misogynistic, isn't it? "Cow." It reflects very poorly on his character. Whereas what Keir said was authentic.
[LAUGHTER]
INT. NEWSDESK - DAY
# LOOKING AHEAD
NEWSREADER: As the general election approaches, both parties are navigating unprecedented territory. Labour is riding a wave of unconventional momentum, while the Conservatives struggle to regain their footing.
# PART SIX: ELECTION DAY
NEWSREADER: Which brings us to Election Day. Keir Starmer's Labour Party, once predicted to win the general election by a landslide, now faces a historic defeat following a bizarre incident during his final stump speech.
EXT. LABOUR RALLY STAGE - DAY
# LIVE: LABOUR'S FINAL RALLY \xB7 ELECTION DAY
KEIR STARMER: And so, on this Election Day, I say to the British people: change is coming. And to the Prime Minister, I say just one thing.
[SFX fart]
KEIR STARMER: Smell that, Sunak! Phwoar! Lovely!
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: Starmer's campaign, which had enjoyed a steady lead in the polls, took a disastrous nosedive when the Labour leader closed his speech by farting into the microphone.
NEWSREADER: The moment, captured live on national television, quickly went viral, triggering an immediate and overwhelming backlash.
INT. SNAP POLL GRAPHIC
NEWSREADER: A snap poll conducted in the immediate aftermath revealed a staggering 70-point swing to the Conservative Party.
EXT. POLLING STATION - DAY
NEWSREADER: Voters, clearly appalled, expressed their dismay at the unprecedented display.
MARGARET THOMPSON: I couldn't believe my ears. How can we trust a man who does something so juvenile and disrespectful?
INT. FARTGATE TRENDING GRAPHIC
NEWSREADER: The backlash was swift and brutal on social media as well, with hashtags like FartGate and PhwoarGate trending within minutes.
NEWSREADER: The incident overshadowed all other news, and political commentators struggled to comprehend the impact of the gaffe.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: STARMER APOLOGISES
KEIR STARMER (shaken): I am deeply sorry for my actions earlier today.
KEIR STARMER: It was an ill-judged attempt at humor that was inappropriate and unbecoming of someone seeking the highest office in the land.
KEIR STARMER: I understand the hurt and confusion it has caused, and I am committed to earning back the trust of the British people.
REPORTER: Mr Starmer! Was it a real one?
(long pause)
INT. EXPERT STUDIO - DAY
DR ELAINE ROBERTS: This is one of the most dramatic collapses in political support I've ever seen.
DR ELAINE ROBERTS: It's not just the act itself but the symbolism of it - a complete departure from the statesmanship expected from a potential Prime Minister.
INT. ELECTION RESULTS GRAPHIC
NEWSREADER: As Election Day progressed, early results indicated a massive swing towards the Conservative Party, with many traditional Labour strongholds flipping blue.
NEWSREADER: Prime Minister Rishi Sunak, who had been trailing in the polls for months, seemed poised for a triumphant return to Downing Street.
INT. LABOUR HQ CORRIDOR - NIGHT
# LABOUR INSIDERS IN DISARRAY
LABOUR INSIDER: We were so close to victory. This is a nightmare scenario. We have to figure out how to rebuild from this.
INT. NEWSDESK - NIGHT
NEWSREADER: As the nation awaits the final election results, one thing is clear: Keir Starmer's moment of indiscretion has altered the political landscape in ways no one could have anticipated.
[FADE]
`
);
var KREWS_CRASH_MODE_LIVE = ep3(
  "krews_crash_mode_live",
  "Microsoft's 'Crash Mode' Press Conference",
  33,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# MICROSOFT FACES OUTRAGE OVER "CRASH MODE" DLC ANNOUNCEMENT
NEWSREADER: Redmond. Microsoft has come under intense scrutiny after scheduling a press conference to announce a new "Crash Mode" DLC for its flagship Flight Simulator video game, just one day after a catastrophic mid-air collision over Krelford.
[INSERT flight_dlc 1]
NEWSREADER: The downloadable content, which controversially encourages pilots to deliberately crash their aircraft, was further condemned for its inclusion of an interactive "penis sensor."
NEWSREADER: We can take you to that ill-timed press event now.
INT. MICROSOFT KEYNOTE STAGE - DAY
# LIVE: REDMOND \xB7 "CRASH MODE" ANNOUNCEMENT
EXECUTIVE: Thank you! Thank you. Ladies and gentlemen: Flight Simulator. Crash Mode.
[SFX explode_1]
[INSERT flight_crash 1]
EXECUTIVE: For the first time ever, players are rewarded for mid-air collisions. Deliberately crash your aircraft. Rack up the points.
REPORTER: Sir! A plane went down over Krelford yesterday. Is the timing not...
EXECUTIVE: And that's not all. Introducing the interactive penis sensor, delivering unimaginable and forbidden pleasures.
[GASP]
EXECUTIVE: The sensor attaches to the player's groin. It vibrates, and moistens, in sync with on-screen activities.
JOURNALIST: What has that got to do with flying a plane?
[INSERT flight_land 1]
EXECUTIVE: Great question. When you land, pilots are encouraged to seduce air stewardesses, and visit gentlemen's table dancing clubs.
INT. NEWSDESK - DAY
# OUTRAGE ERUPTS
[INSERT flight_sensor 1]
NEWSREADER: The sensor, which attaches to the player's groin, reportedly vibrates and moistens in sync with on-screen activities, a feature that has been widely derided as both obscene and completely unrelated to the game's original premise.
NEWSREADER: Outrage erupted within minutes of the announcement, with journalists and aviation experts lambasting Microsoft for what they called "an unconscionable lack of tact" and "a grotesque trivialization of real-world tragedies."
NEWSREADER: Social media was flooded with calls for boycotts, and the families of victims of the disaster have condemned the company's tone-deaf timing.
INT. MICROSOFT KEYNOTE STAGE - DAY
REPORTER: Despite the backlash, the Microsoft executive leading the announcement responded with brazen indifference.
JOURNALIST: Do you have anything to say to the families?
EXECUTIVE (smirking): Sorry, I can't hear you over all this money.
[GASP]
EXECUTIVE: If anyone needs me, I'll be attempting to crash a plane in mid-air on the game.
(he leaves, smirking)
INT. NEWSDESK - DAY
NEWSREADER: His remarks were met with gasps in the press room. Microsoft's share price closed four percent up.
[FADE]
`
);
var KREWS_STARMER_VIDEO = ep3(
  "krews_starmer_video",
  "Starmer's Landslide in Jeopardy: The Video Scandal",
  34,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# KEIR STARMER'S LABOUR LANDSLIDE IN JEOPARDY AMID SCANDAL OVER DISTURBING VIDEO INCIDENT
NEWSREADER: In a shocking turn of events, Keir Starmer's resounding Labour landslide victory is facing an unprecedented threat following a deeply disturbing incident involving a video shown to horrified Conservative MPs.
NEWSREADER: The controversy erupted after Starmer was seen laughing while showing a video on his phone titled "Boy with Down syndrome tragically crushed by meat grinder."
NEWSREADER: The video graphically depicted the tragic death of a boy with Down syndrome in a factory meat grinder. Krunche News will not be showing it.
INT. CABINET ROOM - DAY
REPORTER: The incident occurred during what was supposed to be a routine cross-party meeting.
REPORTER: Eyewitnesses reported visible distress among Conservative MPs as the gruesome footage played.
TORY MP: He just kept holding the phone up. He was laughing. I'll never forget it.
INT. NEWSDESK - DAY
NEWSREADER: The backlash was immediate, with social media and news outlets exploding in outrage.
INT. STATEMENT - DAY
NEWSREADER: In an attempt to contain the fallout, Starmer issued a statement explaining that the video was a "virus" on his phone, and that he had intended to play "a different video."
NEWSREADER: He claimed that by the time he realized the nature of the content, "it was too late" to stop it.
NEWSREADER: While this explanation initially helped to quiet the uproar, it did little to fully mitigate the damage.
INT. NEWSDESK - DAY
NEWSREADER: The scandal, however, took a devastating turn two days later, when enhanced audio of the incident surfaced.
INT. ENHANCED AUDIO - DAY
NEWSREADER: The audio clearly captured Starmer saying to the Tory MPs, moments before the horrific scene unfolded:
KEIR STARMER: And watch now. He's about to get crushed by the meat grinder.
INT. NEWSDESK - DAY
NEWSREADER: This revelation reignited the furor, leading to widespread condemnation and calls for Starmer's immediate resignation.
NEWSREADER: Political analysts are now speculating that the fallout from this incident could lead to calls for another general election.
NEWSREADER: Prominent figures within both Labour and Conservative parties have voiced their dismay and demanded accountability.
EXT. DOWNING STREET - DAY
RISHI SUNAK: What we have heard is beyond comprehension. I am calling for an urgent investigation into the matter.
INT. NEWSDESK - DAY
NEWSREADER: The scandal has not only put Starmer's leadership under intense scrutiny, but also cast a shadow over Labour's recent electoral success.
NEWSREADER: The party, which had enjoyed a wave of support culminating in a historic landslide victory, now faces the prospect of internal turmoil and a potential collapse in public trust.
NEWSREADER: Labour's communications team is reportedly working around the clock to manage the crisis, but the damage may already be irreversible.
NEWSREADER: With mounting pressure from both the public and political opponents, Keir Starmer's future as Labour leader hangs in the balance, and the stability of the newly formed government is uncertain.
NEWSREADER: As the nation watches this scandal unfold, one thing is clear: nobody in Westminster will be accepting a video from Keir Starmer again.
[FADE]
`
);
var KREWS_ARSEBRUSH = ep3(
  "krews_arsebrush",
  "#ArsebrushGate: The PM's Health Breakthrough",
  35,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# PM'S 'HEALTH BREAKTHROUGH' SPARKS FURY AFTER BIZARRE HYGIENE GUIDANCE
NEWSREADER: Prime Minister Keir Starmer has triggered disbelief and widespread condemnation after unveiling what he described as a "massive and exciting" public health breakthrough \u2014 a government-endorsed recommendation that Britons should "brush the inside of their arsehole."
INT. TEASER GRAPHIC - DAY
NEWSREADER: The announcement, made during a Downing Street press conference on Monday, came less than 24 hours after Starmer had teased "one of the most significant developments in preventative health in decades."
NEWSREADER: Expectations had mounted across Westminster and the medical community, with speculation ranging from a major NHS funding boost to a new cancer screening programme.
INT. DOWNING STREET PRESS ROOM - DAY
# LIVE: DOWNING STREET \xB7 PRIME MINISTER'S PRESS CONFERENCE
REPORTER: Instead, the Prime Minister appeared flanked by Chief Medical Officer Sir Chris Whitty and newly appointed Dental Health Tsar Dr. Alana Merrick, declaring that medical consensus now supported "targeted internal cleansing" as a means to "reduce bacterial buildup, improve digestive wellbeing, and modernise hygiene standards."
KEIR STARMER: This is a massive and exciting public health breakthrough.
KEIR STARMER: We brush our teeth to get rid of food and plaque.
KEIR STARMER: It's time we faced the simple truth: we should also brush the inside of our arseholes \u2014 to get all the shit out.
(a long pause: stunned silence)
REPORTER: The remarks were met with stunned silence from the assembled press before several journalists shouted follow-up questions, including whether the NHS would be issuing official guidance or equipment for such practices.
JOURNALIST: Prime Minister! Will the NHS be issuing official guidance? Or equipment?
CHRIS WHITTY (visibly uncomfortable): Research is ongoing.
INT. NEWSDESK - DAY
# WEBSITE CRASHES \xB7 DENTISTS "NOT CONSULTED"
NEWSREADER: Whitty, visibly uncomfortable, declined to elaborate, saying only that "research is ongoing."
INT. DOH ERROR GRAPHIC - DAY
NEWSREADER: Within hours, the Department of Health's website crashed amid a surge of visitors seeking clarification.
INT. BDA STATEMENT - DAY
NEWSREADER: The British Dental Association issued a curt statement saying it had "not been consulted" and "did not endorse the Prime Minister's comments in any capacity."
INT. NEWSDESK - DAY
# OPPOSITION CONDEMNS "GROTESQUE FARCE"
NEWSREADER: Opposition parties were quick to condemn the announcement.
EXT. WESTMINSTER - DAY
NEWSREADER: Conservative leader Kemi Badenoch accused Starmer of "degrading the dignity of public office" and called for an immediate apology.
KEMI BADENOCH: The Prime Minister is degrading the dignity of public office. He must make an immediate apology.
EXT. COLLEGE GREEN - DAY
NEWSREADER: Liberal Democrat leader Daisy Cooper described the moment as "a grotesque farce masquerading as science."
DAISY COOPER: It was a grotesque farce masquerading as science.
INT. ARSEBRUSHGATE TRENDING GRAPHIC
NEWSREADER: Social media erupted with a mixture of ridicule, outrage, and confusion. Hashtags such as #ArsebrushGate and #ColonicKeir began trending within minutes, while videos of Starmer's statement circulated widely with incredulous commentary.
INT. NEWSDESK - DAY
NEWSREADER: In a later interview, the Prime Minister stood by his remarks.
[FADE]
`
);
var KREWS_KILL_THE_PATIENT = ep3(
  "krews_kill_the_patient",
  "Kill the Patient 2: No Alibi",
  36,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# HOSPITAL INSTALLS "KILL THE PATIENT 2: NO ALIBI" AFTER $20M PAYOUT OVER THE FIRST ONE
NEWSREADER: A hospital already forced to pay $20 million in litigation over its decision to install a video game called Kill the Patient in its on-site arcade is facing renewed outrage after administrators approved the installation of its sequel, Kill the Patient 2: No Alibi.
INT. HOSPITAL ARCADE - DAY
NEWSREADER: The decision has baffled patients, staff, attorneys, local officials and, reportedly, several members of the hospital's own board, some of whom initially denied that the machine existed despite photographs showing it positioned prominently between a basketball game and a Dance Dance Revolution cabinet.
REPORTER: The hospital has previously faced intense scrutiny over the original Kill the Patient, an arcade game in which players assumed the role of a disgruntled hospital employee and accumulated points through a variety of activities involving hospitalized patients.
INT. HOSPITAL STATEMENT GRAPHIC
REPORTER: Following multiple lawsuits, the hospital ultimately agreed to pay approximately $20 million in damages and issued a public statement promising to "undertake a comprehensive review of the standards governing entertainment available on hospital property."
INT. HOSPITAL ARCADE - DAY
REPORTER: Less than two years later, Kill the Patient 2: No Alibi appeared in the arcade.
INT. NEWSDESK - DAY
# THE HOSPITAL'S EXPLANATIONS
NEWSREADER: Hospital executives have offered a rapidly evolving series of explanations.
INT. HOSPITAL PRESS ROOM - DAY
# LIVE: THE HOSPITAL \xB7 MONDAY MORNING
REPORTER: At first, a spokesperson denied that the hospital had ever purchased the game.
HOSPITAL SPOKESPERSON: We have no record of any such machine being present on hospital property.
INT. CABINET MARQUEE - DAY
REPORTER: Minutes later, after reporters produced photographs of the cabinet bearing the words KILL THE PATIENT 2: NO ALIBI \u2014 NOW WITH CASH PAYOUTS, the hospital clarified that while the machine was physically located inside the hospital, this did not necessarily mean the hospital had "stocked" it.
INT. NEWSDESK - DAY
NEWSREADER: By Tuesday, administrators had shifted to defending the game on artistic grounds.
INT. ARTISTIC STATEMENT GRAPHIC
NEWSREADER: "The game is actually about corruption in the medical industry, and the player is never explicitly rewarded for killing patients, nor is it ever obligatory for them to kill patients," the hospital said in a written statement.
INT. NEWSDESK - DAY
NEWSREADER: That claim has come under particular scrutiny.
INT. GAME FOOTAGE LEVEL ONE
# GAME FOOTAGE: KILL THE PATIENT 2
NEWSREADER: The first level of the game is titled KILL OR GAME OVER.
NEWSREADER: Upon beginning the level, the player is handed a machine gun and presented with the instruction: "KILL AS MANY PATIENTS AS POSSIBLE, OR GAME OVER!"
INT. GAME FOOTAGE REFUSAL
NEWSREADER: Players who refuse to fire reportedly receive an immediate game-over screen reading, "YOU SAVED THE PATIENTS. YOU LOSE."
INT. GAME FOOTAGE PAYOUT
REPORTER: More controversially, the machine dispenses real U.S. currency through a slot beneath the controls based directly on the number of patients killed during gameplay.
INT. CABINET SIGN - DAY
REPORTER: A printed sign attached to the machine explains the exchange rate as "$1 PER PATIENT \u2014 NO DAILY LIMIT."
INT. HOSPITAL PRESS ROOM - DAY
REPORTER: Asked how this system was compatible with the hospital's claim that players were "never explicitly rewarded" for killing patients, a board representative said the cash should be understood as...
BOARD REPRESENTATIVE: An interactive commentary on financial incentives within the American healthcare system.
BOARD REPRESENTATIVE: The fact that money physically comes out of the machine after you kill a patient does not necessarily mean the money is a reward for killing the patient.
BOARD REPRESENTATIVE: Correlation should not automatically be interpreted as causation.
INT. GAME FOOTAGE DEMO
REPORTER: Reporters then demonstrated that shooting a patient caused the words +$1 PATIENT BONUS to appear on screen immediately before a dollar bill emerged from the cabinet.
INT. HOSPITAL PRESS ROOM LATER - DAY
(long pause)
REPORTER: The representative declined further questions.
INT. NEWSDESK - DAY
# 'WE THOUGHT IT WAS A DIFFERENT GAME'
NEWSREADER: Several board members have sought to distance themselves from the purchase.
INT. ARCADE ADMINISTRATORS - DAY
NEWSREADER: One administrator claimed the hospital believed it had ordered a medical education simulator.
ADMINISTRATOR: I was told it was about difficult decision-making in healthcare. I did not personally play it.
NEWSREADER: Another said he had assumed the title No Alibi referred to "documentation standards."
SECOND ADMINISTRATOR: Documentation standards.
NEWSREADER: A third board member claimed the sequel had been approved because administrators believed it was significantly different from the original game.
BOARD MEMBER: Obviously, if it had simply been called Kill the Patient Again, that would have raised concerns.
BOARD MEMBER: But the subtitle No Alibi suggested to us that the developers had taken the franchise in a more mature direction.
INT. GAME FOOTAGE ATTRACT MODE
NEWSREADER: The game's own promotional material describes Kill the Patient 2 as "BIGGER, BLOODIER AND LEGALLY INDEMNIFIED."
INT. LAW OFFICE - DAY
REBECCA HALL: One could imagine a hospital making this mistake once.
REBECCA HALL: What is remarkable is that they apparently went through the experience of being sued for $20 million over a game called Kill the Patient, conducted an internal review, and then encountered a game called Kill the Patient 2: No Alibi and thought, 'Yes, that one.'
INT. NEWSDESK - DAY
NEWSREADER: Hospital officials insisted that lessons had been learned from the previous litigation.
INT. HOSPITAL PRESS ROOM - DAY
HOSPITAL SPOKESPERSON: The original situation and the present situation are completely different.
REPORTER: Asked to explain the difference, a spokesperson replied...
HOSPITAL SPOKESPERSON: This is the sequel.
INT. NEWSDESK - DAY
# BOARD LAUNCHES INVESTIGATION INTO BOARD
NEWSREADER: The hospital has now announced an independent investigation into how the machine was approved.
NEWSREADER: The investigation will be overseen by a five-member committee composed of hospital board members, including three who voted to purchase the machine.
INT. COMMITTEE ROOM - DAY
MARTIN BELL: We intend to establish exactly who allowed this to happen.
INT. AUTHORIZATION GRAPHIC
REPORTER: Records obtained by reporters show Bell personally signed the purchase authorization beneath a handwritten note reading, "Finally! Loved the first one."
INT. COMMITTEE ROOM - DAY
REPORTER: Bell said he could not recall writing the note.
INT. HOSPITAL ARCADE - DAY
REPORTER: The machine remained operational as of Wednesday afternoon.
INT. NEWSDESK - DAY
# BREAKING: NEW QUESTIONS AFTER "KILL THE PATIENT 2" FOUND TO CONTAIN SO-CALLED "PENIS SENSOR"
NEWSREADER: Hospital Faces New Questions After 'Kill the Patient 2' Found to Contain So-Called 'Penis Sensor'.
NEWSREADER: The hospital says the controversial peripheral is "not sexual in nature" and merely enhances realism during urination and "other experiences."
NEWSREADER: The hospital already facing mounting criticism over its decision to install Kill the Patient 2: No Alibi in its on-site arcade is now confronting an additional controversy after it emerged that the machine contains what its manufacturer describes as a "Penis Sensor."
INT. CABINET FLAP - DAY
REPORTER: The peripheral, located beneath a small plastic flap on the front of the arcade cabinet, is accompanied by an instruction label reading: "FOR FULLY IMMERSIVE EXPERIENCE, INSERT PENIS INTO SENSOR WHEN PROMPTED."
INT. NEWSDESK - DAY
NEWSREADER: Hospital officials initially said they were unaware that the feature existed.
NEWSREADER: Several hours later, after photographs of the instruction panel circulated online, the hospital issued a statement clarifying that the device was present but insisting there was "no sexually explicit content whatsoever" in the game.
INT. SENSOR STATEMENT GRAPHIC
NEWSREADER: "The peripheral is not sexual in nature," the statement said. "It is an optional immersion device intended to enhance realism during certain routine human activities, including urination and other experiences."
INT. NEWSDESK - DAY
NEWSREADER: The hospital did not elaborate on what "other experiences" meant.
INT. HOSPITAL PRESS ROOM - DAY
REPORTER: When asked repeatedly during a press conference, a spokesperson said the phrase should not be interpreted "in a sensational or prurient manner."
HOSPITAL SPOKESPERSON: It refers to other experiences.
HOSPITAL SPOKESPERSON: That is the terminology used by the manufacturer.
INT. NEWSDESK - DAY
# 'FULLY IMMERSIVE'
NEWSREADER: Krunche News has asked the manufacturer exactly when the sensor becomes active. We are still waiting for an answer.
[FADE]
`
);
var KREWS_BURNHAM_FIRST_ACT = ep3(
  "krews_burnham_first_act",
  "Andy Burnham's First Act",
  46,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# BREAKING: THE NEW PRIME MINISTER'S FIRST ACT
NEWSREADER: We go live now to Downing Street, where the new Prime Minister, Andy Burnham, is about to announce his first act in office.
EXT. 10 DOWNING STREET - DAY
# LIVE: DOWNING STREET \xB7 THE PRIME MINISTER'S FIRST ACT
(A crisp morning. Union Jack flutters. A modest but enthusiastic crowd of northern transplants, flat caps, and hi-vis jackets has gathered.)
(Andy Burnham steps up to the podium. He beams like a man who just won the Pools.)
ANDY BURNHAM (raising both arms): Ladies and gentlemen... and southerners watching from your overpriced pretend-houses... today is a new dawn for this country!
(The crowd cheers wildly. A few confused civil servants clap politely from the doorway.)
ANDY BURNHAM: As your new Prime Minister, my first act in office is to introduce a landmark piece of legislation. One that will finally, once and for all, prove that the North is the best!
(He slams a fist on the podium. The crowd goes mental.)
ANDY BURNHAM: The law states, quite simply: The North is much better than the South! Legally binding. No appeals. We're putting it in the bloody constitution!
(Cheers erupt. Someone in the back throws a Greggs sausage roll in celebration.)
ANDY BURNHAM: And to celebrate this historic moment...
(He gestures. An aide awkwardly brings forward an enormous white bowl overflowing with thick chips swimming in brown gravy.)
ANDY BURNHAM: ...I'm going to enjoy a proper northern meal!
(He grabs a massive spoon, digs in like a man possessed, and shovels chips and gravy into his mouth.)
[SFX burn_chew]
[SFX burn_burp]
(The journalists stare in stunned silence. A pigeon lands on a camera.)
ANDY BURNHAM (mouth full, gravy everywhere): Fock me... so good I could eat it twice...
(He pauses. A glint in his eye.)
ANDY BURNHAM: Actually... mm... that gives me an idea.
(He sticks two fingers down his throat. The crowd gasps.)
[SFX burn_vomit]
(Without missing a beat, Burnham picks up the bowl and starts eating the vomit with the same spoon.)
ANDY BURNHAM (beaming, mouth full): You'll never catch a southern fairy doing this, r kid!
[CUT]
INT. WETHERSPOONS - MANCHESTER - DAY
(A classic 'Spoons. A muted TV in the corner is showing the live press conference. Four Northern Blokes are eating their own regurgitated meals.)
NORTHERN BLOKE 1 (mouth full, chewing vomit): Is sumfin happenin' on t'telly? Is that the new character in Corrie?
NORTHERN BLOKE 2 (shovelling more puke-chips): Dunno, pass us the gravy.
NORTHERN BLOKE 3 (burping loudly): Aye. So 'ow does this 'ole voting fing work then?
NORTHERN BLOKE 4 (wiping vomit from his chin with a sleeve): I'm not sure, let me just eat some more of me own vomit and I'll tell ye, r kid!
(They all laugh and continue eating, completely oblivious. One raises his bowl in a toast.)
NORTHERN BLOKE 1: To the North!
ALL: To the North!
[SFX burn_toast]
[CUT]
EXT. 10 DOWNING STREET - CONTINUOUS
(The journalists are in open-mouthed horror. One female reporter stands up, microphone in hand.)
REPORTER: Prime Minister, this is offensive! It plays on crude stereotypes of gluttonous and ignorant northerners!
ANDY BURNHAM: Offensive? You're not a real man, are you, love? Proper southern snowflake. Watch and learn how we do it up North.
[SFX burn_gurgle]
ANDY BURNHAM: Urghh... need to shit...
(He squats slightly behind the podium.)
[SFX burn_splat]
(The crowd recoils. Cameras flash. Aides look like they want to die.)
(Burnham picks up the bowl again, mixes it into the vomit-chips with his spoon, and starts eating it enthusiastically.)
ANDY BURNHAM (mouth full, grinning): This is how real northerners do it! None of that fancy southern bollocks. Proper, honest grub straight from the gut!
(The crowd is a mix of horrified silence and a few die-hard cheers. Burnham takes another big spoonful and waves at the cameras.)
[FADE]
`
);
var KREWS_RAMSEY_TURKEY = ep3(
  "krews_ramsey_turkey",
  "'Food History Moment' Sparks Outrage",
  48,
  `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - DAY
[MUSIC news fade]
# "FOOD HISTORY MOMENT" SPARKS OUTRAGE AFTER GORDON RAMSEY'S BIZARRE ON-AIR COOKING DEMONSTRATION
NEWSREADER: London. Celebrity chef Gordon Ramsey is under intense scrutiny this week following a now-viral segment from his new Channel 4 documentary series Food History Moment, in which the culinary icon describes cooking as "very erotic" before performing what many are calling an "unhinged and symbolic" act involving a turkey.
NEWSREADER: The series, intended to explore the intersections of food, culture, and identity, features Ramsey interviewing experts across disciplines while preparing historical dishes.
NEWSREADER: But a scene from Episode 2 \u2014 titled The Domestic Table: Desire and Power \u2014 has triggered backlash and bewilderment in equal measure. A warning: viewers may find the following footage unsettling.
INT. FOOD HISTORY MOMENT KITCHEN - DAY
# FOOD HISTORY MOMENT \xB7 EPISODE 2: THE DOMESTIC TABLE: DESIRE AND POWER
NEWSREADER: In the segment, Ramsey is seen preparing a traditional roast bird while speaking with feminist food theorist Dr. Leigh Bramwell.
DR LEIGH BRAMWELL: [calm] For centuries, the kitchen was where women's labour went unseen. The roast arrived at the table; the hours behind it never did.
NEWSREADER: As the two discuss the historical burdens of domestic labor and the gendered role of women in kitchens, Ramsey abruptly pivots:
(He runs his fingers along the skin of the turkey.)
GORDON RAMSAY: [sultry] You know, the act of cooking is very erotic. It's sensual. You touch, you taste, you penetrate...
DR LEIGH BRAMWELL: [shocked] I'm sorry?
GORDON RAMSAY: [whispers] Into the vagina of the turkey.
[INSERT knife 1]
NEWSREADER: Without warning, Ramsey then aggressively slid a carving knife into what he referred to as "the vagina of the turkey" \u2014 a biologically inaccurate term that nonetheless appeared intentional.
[INSERT slice 2]
GORDON RAMSAY: [sultry] Mmmmh.
NEWSREADER: He bit his lip and groaned softly as he began slicing into the meat "for no clear culinary reason," according to one viewer,
[INSERT stunned 1]
NEWSREADER: all while maintaining unnervingly intense eye contact with Dr. Bramwell, who appears visibly stunned in the footage.
INT. VIEWER REACTION TRENDING GRAPHIC
NEWSREADER: The clip has been viewed millions of times, and viewers have not held back.
INT. NEWSDESK - DAY
# CHANNEL 4: NO COMMENT
NEWSREADER: Channel 4 has not commented. Dr. Bramwell has not commented.
NEWSREADER: The turkey was unavailable for comment.
[FADE]
`
);
var KREWS_STORIES_EPISODES = [KREWS_KLOPP_BRIBE, KREWS_SUNAK_BOMB, KREWS_STARMER_SAGA, KREWS_STARMER_VIDEO, KREWS_CRASH_MODE_LIVE, KREWS_ARSEBRUSH, KREWS_KILL_THE_PATIENT, KREWS_BURNHAM_FIRST_ACT, KREWS_RAMSEY_TURKEY];

// src/content/television/extra/krews4.ts
var NEWS4 = "KRUNCHE NEWS";
var ep4 = (id, title, n, script) => ({
  id,
  channel: NEWS4,
  show: "Krunche News",
  title,
  episodeNumber: n,
  beats: parseScreenplay(script)
});
var OPEN = (time = "DAY") => `[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - ${time}
[MUSIC news fade]`;
var KREWS_WALLACE = ep4(
  "krews_wallace",
  "Starmer Defends Greg Wallace's Trouser Removal",
  34,
  `${OPEN()}
# STARMER: GREG WALLACE FIASCO "JUST A HUGE MISUNDERSTANDING"
NEWSREADER: In an extraordinary press conference outside Downing Street this morning, Prime Minister Keir Starmer described the ongoing Greg Wallace scandal as "possibly the biggest misunderstanding of all time."
NEWSREADER: He claimed the embattled TV personality's alleged misconduct was rooted in "noble, if poorly communicated, intentions."
NEWSREADER: Wallace, best known as the former MasterChef co-host and now Minister for Banter and Pulses in Starmer's controversial "Wetherspoons Cabinet," has faced mounting accusations of indecent conduct.
NEWSREADER: They include a now-notorious incident in which he reportedly removed his trousers during a first date. Starmer offered a spirited defence.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET \xB7 THE PRIME MINISTER
KEIR STARMER: Greg only took his trousers off because he was incredibly moved to hear of the plight of people in Africa.
KEIR STARMER: His date had mentioned the situation over there, and Greg, being the man of action that he is, spontaneously decided to donate his trousers to the starving.
KEIR STARMER: It's a gesture of compassion that has unfortunately been misconstrued.
JOURNALIST: Prime Minister! The Times. It's alleged Mr Wallace once asked a female colleague, "Would you like to eat Eton Mess off of my Willy?"
KEIR STARMER: Willy is the name of Greg's son. He was offering pudding. That's all.
JOURNALIST (confused): Sorry, Prime Minister, how does that make sense in context?
KEIR STARMER: Are you into kids or something?
REPORTER: Channel 4 News. Prime Minister, Mr Wallace then clarified, "I meant off of my penis."
KEIR STARMER: Penis is the name of his other son. And by the way, he's very disabled. So shame on you.
[GASP]
JOURNALIST: Prime Minister, over fifty women have made complaints with near-identical descriptions of Mr Wallace's behaviour.
KEIR STARMER (scoffing): They knew what to expect. There've been rumours about Greg for decades.
(An audible murmur of confusion runs through the press.)
KEIR STARMER (raising his voice): You people are trying to take the shine off of my brand-new Wetherspoons Cabinet, the first government in history to be formed entirely in pubs. You should be celebrating that.
(He hurls a brick into the crowd.)
[SFX smash]
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: This apparent contradiction, after minutes earlier declaring the events a misunderstanding, sparked an audible murmur of confusion among the press.
NEWSREADER: The Prime Minister then hurled a brick into the crowd, striking a female journalist from Sky News directly in the face, before storming back inside Number 10.
NEWSREADER: Greg Wallace remains Minister for Banter and Pulses.
[FADE]
`
);
var KREWS_CRONSTER = ep4(
  "krews_cronster",
  "The Cuddle Cronster: Fibromyalgia, and Burgers",
  35,
  `${OPEN()}
# PART ONE: THE CRONSTER'S DIAGNOSIS
NEWSREADER: The Cuddle Cronster, the figure at the centre of an ongoing harassment investigation targeting the women of Krelford, has made a public announcement regarding his health and identity.
NEWSREADER: In a statement released through his representatives this morning, the Cronster revealed that he suffers from fibromyalgia and identifies as neurodivergent.
INT. CRONSTER STATEMENT GRAPHIC
NEWSREADER: "I want the public to understand that I am not a monster," the statement reads. "I am a person with invisible disabilities who has struggled with chronic pain and neurological differences my entire life."
NEWSREADER: "The oppression that neurodiverse people with invisible disabilities face is real, and I am a victim of systemic prejudice."
INT. NEWSDESK - DAY
NEWSREADER: The announcement has sparked immediate controversy, particularly after Labour leader Sir Keir Starmer weighed in with what critics have described as a "baffling and tone-deaf" response.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: WESTMINSTER \xB7 LABOUR PRESS BRIEFING
KEIR STARMER: The Cronster is now a much more sympathetic and understandable character due to his PTSD from the oppression that neurodiverse people with invisible disabilities have suffered.
KEIR STARMER: We must approach this situation with compassion and understanding.
REPORTER: Mr Starmer! What about the harassment allegations? What about the safety of the women he's targeting?
KEIR STARMER: I think we need to be more understanding. These are complex issues, and we can't simply dismiss someone's lived experience because of allegations.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: The comments drew immediate condemnation from women's rights organisations and disability advocacy groups, who accused Starmer of conflating legitimate disability concerns with predatory behaviour.
INT. ADVOCACY STUDY - DAY
ADVOCACY SPOKESPERSON: This is an insult to people who actually suffer from fibromyalgia and neurodivergence.
ADVOCACY SPOKESPERSON: The Cronster's behaviour is criminal harassment. His claimed diagnoses do not excuse or explain his actions.
INT. NEWSDESK - DAY
NEWSREADER: Meanwhile, a bizarre development has emerged: a sect of female fans calling themselves "Cronny's Juice Bunnies" has begun appearing at public events related to the case.
EXT. WESTMINSTER - DAY
REPORTER: The group, which reportedly numbers in the dozens, has described themselves as "supporters of the Cronster who actively seek to have the juice squeezed out of them."
REPORTER: Their public statements have been met with widespread disgust and disbelief.
JUICE BUNNY: We understand him. He's misunderstood.
JUICE BUNNY (swooning): We volunteer ourselves for his affections.
REPORTER: Police have warned the group to stay away from the Cronster's known haunts, and have increased security measures. The Cronster remains at large. The investigation continues.
INT. NEWSDESK - NIGHT
# PART TWO: "BETTER THINGS TO BE SPENDING OUR MONEY ON"
NEWSREADER: Sir Keir Starmer sparked widespread condemnation last night after a press conference intended to address the threat posed by the Cuddle Cronster descended into a rambling announcement about fast-food investment.
NEWSREADER: It was punctuated by remarks campaigners described as "dismissive, incoherent, and misogynistic."
INT. LABOUR HQ PRESS ROOM - NIGHT
# LIVE: STARMER ON THE CRONSTER THREAT
KEIR STARMER: The Cuddle Cronster does present a serious threat. No one is disputing that.
KEIR STARMER: But we also have better things to be spending our money on.
KEIR STARMER: Which is why I'm announcing government support for a new type of McDonald's, with many new types of burgers.
KEIR STARMER: This is about growth. Choice. Innovation. Burgers people actually want.
REPORTER: Mr Starmer! What about safeguarding? What about enforcement?
(long pause)
KEIR STARMER: Look, boys will be boys.
[GASP]
KEIR STARMER: If this was affecting the men, of course we'd look into it.
KEIR STARMER: Women have made it clear they have no interest in men. So I will leave it to the woman police to clear up the problem.
(long pause)
KEIR STARMER: Oh. There's no woman police yet? Never mind.
KEIR STARMER: It will all be alright in the end. Look, let's get back to thinking about this new McDonald's. (he leaves, without taking further questions)
INT. NEWSDESK - NIGHT
NEWSREADER: Reaction was swift and furious. Women's groups accused Starmer of trivialising a safeguarding crisis, while senior figures within his own party described the remarks as "catastrophically out of touch."
INT. LABOUR HQ CORRIDOR - NIGHT
LABOUR BACKBENCHER: He managed to offend women, trivialise harassment, and announce burgers in the same breath. It's astonishing.
INT. NEWSDESK - NIGHT
NEWSREADER: Downing Street declined to comment on whether the proposed McDonald's investment existed in any formal capacity.
NEWSREADER: As one headline this morning put it: "Safeguarding Crisis Meets Fast-Food Pivot."
NEWSREADER: Whether Starmer can recover from a press conference that attempted to condemn a threat, only to abandon it for burgers, remains to be seen.
[FADE]
`
);
var KREWS_SANMIK_CROCS = ep4(
  "krews_sanmik_crocs",
  "Armed Forces Praised After SanMik Concert Incident",
  36,
  `${OPEN()}
# ARMED FORCES PRAISED FOLLOWING "NECESSARY INTERVENTION" AFTER SANMIK CONCERT INCIDENT
NEWSREADER: The Armed Forces have been formally praised by government officials following what the Ministry of Defence described as a "rapid, proportionate and unavoidable response" to an incident arising from a sold-out SanMik concert on Saturday night.
EXT. SANMIK CONCERT - NIGHT
# FAN FOOTAGE: SANMIK LIVE \xB7 "DO THE CROCODILE"
NEWSREADER: During the performance of his hit song Do The Crocodile, SanMik released four live crocodiles into the audience.
(SanMik releases four live crocodiles into the audience.)
[SFX crowd_panic]
NEWSREADER: While no injuries were reported at the stadium itself, authorities confirmed that the animals later exited the venue and entered a nearby McDonald's restaurant.
EXT. MCDONALD'S RUINS - DAY
REPORTER: A senior military spokesperson stated that the situation escalated quickly.
MILITARY SPOKESPERSON: Given the presence of crocodiles in McDonald's, we determined that it was very sad, but we had to fire multiple tank rounds at it, in case the crocodiles started attacking people.
REPORTER: Armoured units were deployed to the scene, where tank munitions were fired into the McDonald's.
[SFX explode_1]
WITNESS: It was exploding very largely.
REPORTER: Sixty-two people were killed instantly.
INT. MOD STATEMENT GRAPHIC
NEWSREADER: In a statement released shortly afterwards, officials emphasised that the crocodiles were neutralised and that the wider public had been protected. "Their sacrifice will not be forgotten," the statement read.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET \xB7 THE PRIME MINISTER
KEIR STARMER: I want to praise our Armed Forces for their decisiveness.
KEIR STARMER: I can confirm that emergency funding has been authorised to ensure the McDonald's is rebuilt immediately, so that normal life can resume as soon as possible.
INT. NEWSDESK - DAY
NEWSREADER: Prime Minister Sir Keir Starmer there, praising the Armed Forces.
NEWSREADER: SanMik has not commented.
[FADE]
`
);
var KREWS_BRADFORD = ep4(
  "krews_bradford",
  "Bradford to Become New UK Capital",
  37,
  `${OPEN()}
# GOVERNMENT CONFIRMS BRADFORD TO BECOME NEW UK CAPITAL
NEWSREADER: The government has confirmed plans to designate Bradford as the new capital city of the United Kingdom.
INT. GOVERNMENT STATEMENT GRAPHIC
NEWSREADER: The move is "in recognition of Muslim contributions to British life such as 'Muslim curry' and other such things, with which we are so familiar I don't even need to say them".
EXT. BRADFORD CITY PARK - DAY
REPORTER: The transition will involve the relocation of Parliament, select government departments, and ceremonial institutions over a ten-year period.
REPORTER: Bradford is hoped to remain a heritage site and tourist destination, with incredible sights such as "Bradford tower" etc.
INT. NEWSDESK - DAY
NEWSREADER: Officials confirmed that the move would cost "a significant" sum, adding that further details would be released "someday."
[FADE]
`
);
var KREWS_HARUMPIS = ep4(
  "krews_harumpis",
  "Hybrid Presidency Overshadowed by PM's Halloween Costume",
  38,
  `${OPEN()}
# HISTORIC "HYBRID PRESIDENCY" IN US OVERSHADOWED BY UK PRIME MINISTER'S HALLOWEEN COSTUME
NEWSREADER: In an unprecedented turn of events, the world is reeling from what should have been the most sensational news in recent political history.
NEWSREADER: A deadlock in the U.S. presidential election has led to an unprecedented compromise known as the "Hybrid Presidency."
NEWSREADER: In a shocking turn of events, Vice President Kamala Harris and former President Donald Trump have combined to form President Kamold Harumpis, a single entity meant to balance the divided American political spectrum.
NEWSREADER: However, even this bizarre development has been relegated to second place on the news cycle, overtaken by an extraordinary scandal surrounding the UK Prime Minister.
INT. COSTUME PHOTO GRAPHIC
NEWSREADER: At the annual Downing Street Halloween party, the Prime Minister arrived dressed as "African Adolf Hitler," complete with full blackface makeup.
NEWSREADER: Photos of the costume spread like wildfire, sparking international outrage and a swift scramble from Downing Street for damage control. Krunche News has chosen not to show them.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: A CHAOTIC PRESS CONFERENCE
KEIR STARMER: Look, mistakes were made, but I'm not the same person I was three days ago.
KEIR STARMER: These are the mistakes of the past. It's time to get over it, and focus on the future. Particularly the UK's special relationship with this Harumpis character.
REPORTER: Prime Minister, are you seriously asking the country to...
KEIR STARMER: My handlers in Mossad tell me there are pressing domestic concerns in Israel that require my attention.
(He leaves the podium, leaving behind a large, conspicuous bag of cash.)
(long pause)
KEIR STARMER (sheepish): Sorry. Does anyone know whose bag of money this is?
KEIR STARMER: I'll hand it in to lost property.
INT. LABOUR HQ CORRIDOR HOT MIC - DAY
# HOT MIC: THE CORRIDOR OUTSIDE THE PRESS ROOM
KEIR STARMER (hot mic): Those suckers will believe anything! That was my bag of money! Heh heh! Bribe money!
KEIR STARMER (hot mic): Oh, fuck! I'm on a hot mic!
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: The press gasped as Starmer hurriedly ended the conference.
NEWSREADER: This series of blunders has only intensified calls for accountability, as citizens and political analysts wonder how the Prime Minister's misjudgment and Starmer's baffling response could unravel on the global stage.
NEWSREADER: Meanwhile, President Kamold Harumpis remains overshadowed, as the world contemplates an entirely new kind of political absurdity on both sides of the Atlantic.
[FADE]
`
);
var KREWS_MARIO_TATE = ep4(
  "krews_mario_tate",
  "Nintendo Under Fire Over Andrew Tate in Mario Kart World",
  39,
  `${OPEN()}
# NINTENDO UNDER FIRE FOR INCLUDING ANDREW TATE AS PLAYABLE CHARACTER IN MARIO KART WORLD
NEWSREADER: Nintendo has sparked widespread backlash following a bizarre and controversial announcement that Andrew Tate, the polarizing internet personality currently facing charges related to sex trafficking, will appear as a fully playable character in the upcoming Mario Kart World for the long-awaited Switch 2 console.
[INSERT kart_race 1]
NEWSREADER: Described by one fan as "absolutely bemusing," the announcement was made during a Nintendo Direct showcase that left many viewers slack-jawed.
INT. NINTENDO DIRECT STAGE - DAY
# LIVE: NINTENDO DIRECT \xB7 MARIO KART WORLD
NINTENDO SPOKESPERSON: And joining the roster in Mario Kart World... Andrew Tate!
[GASP]
[INSERT kart_roster 1]
NINTENDO SPOKESPERSON: Andrew Tate fits in well with our universe of colorful bad guys such as Bowser and all the other ones.
NINTENDO SPOKESPERSON: We believe his unique energy will bring something fresh to Mario Kart World.
INT. NEWSDESK - DAY
NEWSREADER: The inclusion of Tate hasn't just raised eyebrows; it's set social media alight with anger, confusion, and memes.
INT. TATE TRENDING GRAPHIC
NEWSREADER: Critics argue that allowing a real-life figure accused of serious crimes to be featured alongside beloved fictional characters is an "astoundingly irresponsible" move by a company long associated with family-friendly entertainment.
INT. NEWSDESK - DAY
NEWSREADER: But Nintendo doubled down on the move with a further announcement.
INT. NINTENDO DIRECT STAGE - DAY
NINTENDO SPOKESPERSON: Players who pre-order Mario Kart World will unlock Tate's infamous orange Bugatti as a special in-game kart!
[INSERT kart_runover 1]
NINTENDO SPOKESPERSON: The Bugatti boasts unique gameplay mechanics that allow it to violently run other players over and kill them.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: A feature many have already dubbed "deeply unsettling."
[FADE]
`
);
var KREWS_JENKEM = ep4(
  "krews_jenkem",
  "Gordon Ramsay Discovers 'Jenkem' Pot",
  40,
  `${OPEN()}
# ENTERTAINMENT: GORDON RAMSAY DISCOVERS "JENKEM" POT IN KITCHEN NIGHTMARES CHAOS
NEWSREADER: Now entertainment, and an episode of Kitchen Nightmares that has left viewers retching.
NEWSREADER: Gordon Ramsay arrived at a struggling restaurant expecting the usual: chaos, raw chicken, and a frightened head chef. What he found in the corner of the kitchen was something else. A warning: there is very strong language.
INT. KITCHEN PASS - DAY
# CLIP: KITCHEN NIGHTMARES
GORDON RAMSAY (angry): What the fuck is this mess? You're running a restaurant or a disaster site? How the fuck are people supposed to eat this shit?
CUSTOMER 1 (offscreen): My food's been here an hour and it still tastes like dog food!
GORDON RAMSAY: Who's in charge here? Step the fuck up, because someone's responsible for this garbage!
(A nervous waitress points at the head chef, Chef Mick, who's sweating buckets.)
GORDON RAMSAY: You! Come here, now!
GORDON RAMSAY: What the fuck is this?! It's raw! You trying to kill people? Customers are complaining of being sick, you donkey! Why's this chicken still clucking on their plates?
CHEF MICK (sheepishly): We're, uh, working on the timing, Chef. We've just been behind.
GORDON RAMSAY: Behind? You're not behind, mate, you're fucking dead. You're feeding corpses at this rate.
INT. KITCHEN VEG STATION - DAY
GORDON RAMSAY (suggestively): And who are you, darling?
CHEF LUCY (uncomfortable): I'm Lucy. Sous chef.
GORDON RAMSAY: Sous chef, huh? Bet you can handle a lot with those hands, eh? Could chop more than just carrots with those, I reckon.
CHEF LUCY (frowning): I... just do the vegetables.
GORDON RAMSAY (leering): I bet you do, love. You know, it's all about... timing, seasoning, just the right touch, yeah?
CHEF MICK (awkwardly): Uh, Chef Ramsay, maybe you want to check our sauce?
GORDON RAMSAY: Sauce? You can't even handle a fucking chicken, now you want me to taste your sauce?
GORDON RAMSAY (eyes wide): What the fuck is that?
INT. KITCHEN CORNER - DAY
CHEF MICK (whispering): Shit, he's found the fucking jenkem pot.
CHEF DAVE (whispering): Shut the fuck up! You've said too much already!
INT. KITCHEN JENKEM POT - DAY
(Ramsay storms over, lifts the lid on the pot, and gags immediately.)
GORDON RAMSAY (retching): What in the actual fuck is this?
CHEF MICK: It's... uh... jenkem, Chef.
GORDON RAMSAY: Jenkem?! You're cooking a fucking pot of PISS and SHIT in my kitchen?!
CHEF MICK (nerdy and precise): Well, Chef, technically jenkem is fermented human waste, commonly used as an inhalant for its psychoactive effects in some regions of Africa.
CHEF MICK: You see, when left to stew, the methane produces a... uh... distinctly potent...
GORDON RAMSAY: You're telling me you've got a fucking methane shit stew in the corner of your fucking kitchen?! Are you mad?
(Gordon grabs Chef Mick by the collar and pins him against the wall.)
GORDON RAMSAY (shouting): You're serving piss and shit fumes in a kitchen where people EAT?
CHEF MICK (desperate): But Chef, you've got to try it! It'll change your life!
GORDON RAMSAY: Change my life? It'll end your fucking career!
CHEF MICK (begging): Just one inhale, Chef! You'll see!
GORDON RAMSAY: I'll do it to prove you're full of shit. Literally.
(He takes a deep breath over the fermenting pot.)
GORDON RAMSAY (in awe): Bloody hell... that's... actually fucking brilliant.
CHEF LUCY (surprised): Really?
GORDON RAMSAY: The depth, the complexity! Like a fucking symphony of aromas! It's got that earthiness, that richness! Like a fermented truffle!
GORDON RAMSAY: This might be the most innovative thing I've ever inhaled.
(He dips his finger into the pot and takes a taste.)
GORDON RAMSAY (excited): Fuck me, it's like a reduction of despair and desperation, but somehow... it fucking works!
[SMASH CUT]
INT. KITCHEN LATER - NIGHT
# LATER THAT NIGHT
(The entire kitchen staff is now high on jenkem, giggling uncontrollably.)
INT. DINING ROOM - NIGHT
CUSTOMER 2 (shouting): I've been waiting two hours for my food!
GORDON RAMSAY (slurring, angry): You think you know pain? You've no fucking idea what I've been through, mate. The fucking demons in my head... fuck off back to your seat!
(Ramsay overturns the customer's table.)
[SFX plate_smash]
INT. NEWSDESK - DAY
NEWSREADER: Kitchen Nightmares. The restaurant's health inspection is on Thursday.
[FADE]
`
);
var KREWS_BOULDER = ep4(
  "krews_boulder",
  "Boulder Prank Goes Deadly",
  42,
  `${OPEN()}
# BOULDER PRANK GOES DEADLY: "WOAH!" SHOUTED AS HIKERS KILLED
NEWSREADER: A new "prank" has emerged that involves hiking halfway up a popular Boulder trail, locating a precariously balanced large boulder, and waiting until a visible group of women hikers appears below.
EXT. BOULDER TRAIL - DAY
# VIRAL VIDEO: "THE BOULDER PRANK"
NEWSREADER: The prank involves pushing the boulder loose so that it barrels down the slope toward them and kills them.
(The boulder begins its deadly descent.)
PRANKSTER (off-camera): WOAH!
[SFX boom]
NEWSREADER: As it begins its deadly descent, the prankster simply shouts "WOAH!", as if amazed or caught off guard by the unfolding disaster.
INT. NEWSDESK - DAY
NEWSREADER: Why it's funny? Because you said "woah!"
NEWSREADER: Other pranks include throwing rocks at peaceful wildlife and maintaining a "Gay Man" prank performance across restaurants, bars, trailheads, and Uber rides, playing up stereotypical behavior without ever breaking character.
[FADE]
`
);
var KREWS_JUSTICE = ep4(
  "krews_justice",
  "Starmer Announces Drastic Overhaul of Criminal Justice System",
  43,
  `${OPEN()}
# STARMER ANNOUNCES DRASTIC OVERHAUL OF CRIMINAL JUSTICE SYSTEM
NEWSREADER: Prime Minister Keir Starmer has unveiled the Cabinet's first flagship policy: a \xA3900 million initiative described as "the most ambitious criminal justice reform in British history."
INT. FUNDING STATEMENT GRAPHIC
NEWSREADER: The programme is to be funded by high-interest emergency loans from "whoever will give us money quickly."
INT. WETHERSPOONS CABINET MEETING - NIGHT
NEWSREADER: At the heart of the proposal is a single, specific punishment for those convicted of child sexual abuse.
NEWSREADER: According to government documents, the new Wetherspoons Cabinet developed the policy "over several hours and multiple pitchers of Strongbow Dark Fruits."
INT. POLICY DOCUMENT GRAPHIC
NEWSREADER: It involves "a highly electrified length of barbed wire being inserted into the urethra" of each offender, with the electric current continuing for up to one week after death.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET \xB7 THE PRIME MINISTER
REPORTER: Prime Minister! Why does the current need to keep running for a week after death?
KEIR STARMER: If there's a 0.01% chance of one of these pedos coming back to life, I want to be absolutely sure they don't.
INT. NEWSDESK - DAY
NEWSREADER: Defending the post-mortem duration of the punishment there, the Prime Minister.
[FADE]
`
);
var KREWS_DESCENT = ep4(
  "krews_descent",
  "Starmer Proposes Lowering Age of Consent to Address Economic Crisis",
  44,
  `${OPEN()}
# BREAKING: STOCK MARKET CRASH \xB7 RECESSION DECLARED
NEWSREADER: In an extraordinary cabinet meeting to address the stock market crash and declared recession, Prime Minister Keir Starmer has proposed a radical solution that left his cabinet ministers stunned.
NEWSREADER: Krunche News has obtained footage from inside the room.
INT. CABINET ROOM - DAY
# SECRET FOOTAGE: THE CABINET ROOM
KEIR STARMER: Ladies and gentlemen, we are in a crisis. The stock market crash and the declared recession are unprecedented. I've invited our top industry experts to share their insights.
INDUSTRY EXPERT 1: Prime Minister, the sell-off is driven by a complete loss of investor confidence. The public is panicking, and we're seeing a ripple effect across all sectors.
INDUSTRY EXPERT 2: If we don't stabilize the market soon, we could face a depression. We need a bold, decisive action to restore confidence.
INDUSTRY EXPERT 3: It's not just about the market. Public trust in the government's ability to manage this crisis is at an all-time low. We need to do something radical.
(Starmer stands, his face a mask of calm determination.)
KEIR STARMER: It's clear that we need to lower the age of consent until we can work out what the fuck is going on.
(A stunned silence falls over the room.)
CABINET MINISTER 1 (panicking): Prime Minister, surely you're referring to the legal age at which stocks, bonds, and shares can be traded. Your wisdom is unparalleled.
CABINET MINISTER 2: Yes, the wisdom... wow... this is why you're Prime Minister.
KEIR STARMER: No, I'm talking about sex consent. We can begin by rolling it out in just a single constituency, mine, for example, to see if it works.
(The cabinet is horrified, but too afraid to oppose him, fearing for their careers.)
CABINET MINISTER 3 (acquiescing): Very well, Prime Minister. We'll move forward with your plan.
INT. MARKETS GRAPHIC
NEWSREADER: The following day, the stock market hit all-time highs.
EXT. WHITEHALL CROWD - DAY
# LIVE: WHITEHALL
NEWSREADER: The streets outside 10 Downing Street were filled with delirious, screaming people celebrating.
CROWD MEMBER 1 (euphoric): YES! YEEEESSSS!
INT. PRIME MINISTER'S OFFICE - DAY
# SECRET FOOTAGE: THE PRIME MINISTER'S OFFICE
(Starmer sits on a jewel-encrusted throne, a sinister smile on his face.)
KEIR STARMER (cackling): Pleasure. Pleasure. Pleasure... pleasure...
EXT. WHITEHALL CROWD - DAY
# HOT MIC: THE PRIME MINISTER'S OFFICE
KEIR STARMER (hot mic): Pleasure! PLEASURE! Heh heh heh. Pleasure!
CROWD MEMBER 1: What?! Why's he saying "pleasure"?!
CROWD MEMBER 2: Wait, he's a pedo! Get him!!
(The crowd's mood turns from jubilation to anger as they storm Downing Street.)
INT. PRIME MINISTER'S OFFICE - DAY
(Starmer's face changes from joy to fear as the angry mob closes in. The sound of breaking glass and shouts grows louder.)
[SFX smash]
INT. NEWSDESK - DAY
NEWSREADER: Downing Street has been stormed. We'll bring you more as we get it.
[FADE]
`
);
var KREWS4_EPISODES = [
  KREWS_WALLACE,
  KREWS_CRONSTER,
  KREWS_SANMIK_CROCS,
  KREWS_BRADFORD,
  KREWS_HARUMPIS,
  KREWS_MARIO_TATE,
  KREWS_JENKEM,
  KREWS_BOULDER,
  KREWS_JUSTICE,
  KREWS_DESCENT
];

// src/content/television/extra/dramas.ts
var DRAMA2 = "BBK ONE";
var ep5 = (id, show, title, script, extra = {}) => ({
  id,
  channel: DRAMA2,
  show,
  title,
  episodeNumber: 1,
  beats: parseScreenplay(script),
  ...extra
});
var DRAMA_GUMPTION_GRAVY = ep5(
  "drama_gumption_gravy",
  "Gumption and Gravy",
  "Gumption and Gravy: A Psychodramatic Murder Mystery",
  `
[MUSIC gg_theme start]
EXT. POLSON'S HOUSE - NIGHT
(Rain. A small car on the drive. The front door stands ajar.)
INT. POLSON'S LIVING ROOM - NIGHT
(SALLY POLSON, 65, Polson's Mum, morbidly obese, her body heaving with every breath, pushes open the door to her son's house.)
(Her face is a mix of concern and frustration as she lumbers inside, her clothes soaked with sweat from the short walk from her car. She freezes, eyes wide, at the sight before her.)
(POLSON, 37, lies lifeless on the floor, a gaping wound in his chest, blood pooling around him.)
(A pink, shiny handgun with "EDEN" spelled out in cheap diamante stickers rests beside his body, its barrel still smoking.)
(Sally drops to her knees with a heavy thud, the impact sending a ripple through her body. She throws her head back, a guttural scream tearing from her throat.)
POLSON'S MUM (screaming): No! My baby!
# GUMPTION AND GRAVY: A Psychodramatic Murder Mystery
(Sally's eyes dart frantically from Polson's wound to the gun, and then to EDEN, 27, who stands frozen in the corner, her face pale, eyes wide with shock.)
(Sally's breath quickens as the pieces start to fall into place in her mind.)
POLSON'S MUM (quietly, to herself, then growing louder): He's... he's died of a broken heart! Drongus and Mikey's bullying campaign did this! Their words\u2014they literally ruptured his skin! I'll have their heads for this! I'm calling their places of employment! Especially since they don't have the gumption to talk to me!
(Eden, still in shock, suddenly seems to relax, her face softening as she nods in agreement.)
EDEN (nervously): Our plants... they've lost their plant dad... If I didn't have the spoons before today...
(Sally, distracted by her own hunger and fatigue, cuts Eden off.)
POLSON'S MUM (musing): Speaking of spoons, do you have any fudge or Nutella? I need some extra energy before calling the police.
(Eden, eager to please, hurries to the kitchen. A moment later, she returns with a large bowl filled to the brim with melted fudge and Nutella. She places it on the floor.)
(Sally and Eden get down on all fours, their faces inches from the bowl.)
(They begin to eat directly from it, their breath heavy, chomping and growling at each other if one gets too close to the other's side of the bowl.)
(The scene is interrupted by the SOUND of SIRENS outside.)
(Two POLICE OFFICERS burst into the room, their eyes immediately locking on the smoking handgun by Polson's body.)
(Their gazes then shift to Eden, who still has traces of fudge around her mouth.)
OFFICER 1 (gravely): Miss Eden, you're under arrest for the murder of Mr. Polson.
(Sally, her face flushed and sweaty, scrambles to her feet, towering over the officers.)
POLSON'S MUM (screaming): How dare you have the GUMPTION to make such a suggestion!
(The officers exchange a glance, taking in the scene: the gun, the blood, the state of the room. Eden's expression is one of fear, but also a strange, unsettling calmness.)
OFFICER 2 (pointing to the gun): Ma'am, that's her gun. The barrel is still smoking.
POLSON'S MUM (indignant, almost smug): And look at how tidy the house is! Eden is wonderful for my autistic, dead son! You're all part of Drongus and Mikey's bullying conspiracy, aren't you? Accusing Eden\u2014ha!\u2014you're nothing but pawns in their sick game!
(Sally's hand reaches for the gun on the floor. She picks it up and points it directly at the officers, her expression one of arrogant defiance.)
POLSON'S MUM (sneering): No one DARES have the GUMPTION to talk to Sally Polson in such a way!
(The officers react instinctively, drawing their weapons.)
OFFICER 1 (shouting): Drop the weapon!
(Sally takes a step forward, gun still raised. The officers have no choice. They open fire.)
(Sally collapses, her large frame hitting the floor with a sickening thud.)
(Eden, still on all fours, stares at Sally's lifeless body, her mind racing. The officers, breathing heavily, glance at each other, then back at Eden.)
OFFICER 2 (grimly): She's seen too much.
(Without hesitation, they turn their guns on Eden. The shots ring out, echoing through the house.)
(Eden falls beside Sally, their bodies sprawled in a grotesque tableau of death and dessert.)
(As the officers holster their weapons and begin to exit, a notification chimes on their phones. They both check their screens.)
(TEXT MESSAGE from "Drongus B. Drippin'": Good work, lads... next target\u2014Jenko.)
(The officers exchange a knowing look before slipping out the door, leaving the blood-soaked room behind.)
[FADE]
# THE END
`
);
var DRAMA_MOLE_OF_THRONES = ep5(
  "drama_mole_of_thrones",
  "Mole of Thrones",
  "Mole of Thrones",
  `
INT. JENKO'S BEDROOM - DAY
(JAMES "JENKO" JENKINS, 30, CBT therapist, smug, and a self-proclaimed genius, lounges on his bed, scrolling through his laptop.)
(RUTH, 28, his patient but increasingly disillusioned fianc\xE9e, folds laundry nearby.)
(Jenko suddenly freezes, staring at the screen. His eyes widen. His excitement turns to glee.)
RUTH: What are you looking at?
FLENKY (whispering): A new competition... Game of Thrones... and they're looking for someone with a high IQ and... off-putting facial deformities like moles?! Heroic real-life traits?! Three strikes, Ruth! It's like the role was made for me!
(Ruth deadpans, unimpressed.)
RUTH: You had the mole removed, remember?
(Jenko's grin falters. His hand slowly moves to his now-smooth cheek, a flicker of rage crossing his face.)
FLENKY (angrily): Why did I ever listen to you?!
RUTH (rolling eyes): You were sick of kids calling you "Moley Jenko."
(Jenko snaps his fingers, suddenly brightening up.)
FLENKY: But I kept it as a keepsake! Maybe they'll let me stick it back on for the role.
(He rushes to his dresser, triumphantly pulling out a small, grotesque jar containing his former mole. Ruth watches, both bemused and mildly horrified.)
FLENKY: It's perfect.
# MOLE OF THRONES
(Jenko immediately dials a number on his phone.)
INT. GEORGE R. R. MARTIN'S OFFICE - DAY
(We hear GEORGE R. R. MARTIN's deep, gruff voice on the other end of the line.)
GEORGE R. R. MARTIN (on the phone): Hello, who is this?
FLENKY: Mr. Martin! This is James Jenkins\u2014an expert in human psychology, with an IQ of 160. I saw your casting notice, and I think I'm perfect for the role!
(Martin pauses, intrigued.)
GEORGE R. R. MARTIN (on the phone): You're perfect for the role. My intuition has never failed me.
(Jenko beams, relieved, but quickly adds:)
FLENKY: I've even got a mole! Well... I had a mole. It's, uh, surgically removed... but I still have it! It's in a jar. I could, like, glue it back on for the role? Just temporarily?
(There's a long pause.)
GEORGE R. R. MARTIN (on the phone): For the first time in my life, my intuition was wrong. You won't work for the role. This is showbiz, Jenko. We need permanent moles.
(Jenko panics.)
FLENKY: But... please! I can get it reattached!
(Martin grumbles.)
GEORGE R. R. MARTIN (on the phone): Surgically reattach it, permanently. Otherwise, you're out.
INT. DOCTOR'S OFFICE - DAY
(Jenko sits across from his DOCTOR, nervously clutching the jar containing his now-fluffy, hair-covered mole.)
DOCTOR: I can do it... but it'll be permanent. No going back. The mole will be there for the rest of your life.
(Jenko hesitates, glancing at the jar. The mole looks even more grotesque than before.)
FLENKY (whispering): It's for the role of a lifetime.
(He slides the jar across the table.)
INT. HOSPITAL ROOM - DAY
(Jenko wakes up post-op, a large bandage covering his cheek. He looks groggy but determined.)
NURSE: All done, Mr. Jenkins. You're ready for... whatever it is you're doing.
(Jenko touches his bandaged face with reverence.)
EXT. STREET - DAY
(Jenko leaves the hospital, strutting confidently down the street.)
(Women shoot him looks of disgust, recoiling as they pass. He grins, oblivious.)
INT. JENKO'S APARTMENT - NIGHT
(Jenko, fully bandaged but now wearing a self-tailored medieval robe, sits across from Ruth as they discuss his upcoming role.)
FLENKY: My character is Ser Thorlin of Pentos. Highborn, a master of the seven languages, silk merchant, and\u2014oh yes\u2014the most intelligent man in all the Seven Kingdoms.
(Ruth swoons, leaning in.)
RUTH (adoring): You're so much smarter than your friends. No wonder they're all jealous... I didn't believe you at first, but now I see why Drongus, Diet, Krezmar, and Brinkley resent you.
FLENKY: Exactly. They just don't understand genius.
(Ruth sighs dreamily as Jenko stares off in thought.)
INT. FILM SET - DAY
(Jenko bursts onto the set, dressed in his custom-tailored robe, speaking in a highly affected medieval accent.)
FLENKY (affected medieval accent): Ser Thorlin of Pentos, at your service!
(A gruff COCKNEY DIRECTOR squints at Jenko, confused.)
DIRECTOR: 'Oo are ya?
FLENKY (offended): I was cast for the role! The competition?
(The director glances at his clipboard.)
DIRECTOR (patronising): Oh yeah, Extra Number 3. Right. You need to get changed into your sack.
(Jenko freezes, eyes wide.)
FLENKY: My... my what?
DIRECTOR (points): That see-through sack over there. You're gonna do a little dance for us. Seductive-like.
(Jenko's heart sinks. He looks over to see several men dressed in transparent sacks, waiting in line.)
DIRECTOR: Come on, lad. They're all waitin' to replace ya. In this version of Game of Thrones, we've got some stuff from the future. Bluetooth speakers, R&B... we explain it as 'electricity magic.' It's all part of the new aesthetic.
(Jenko blinks, trying to process the madness.)
DIRECTOR (enthusiastically): Come on then, lad! Dance like you mean it.
(The director cranks up some contemporary R&B on the Bluetooth speaker.)
DIRECTOR: Alright, dance. And when you're done, approach the mannequin, tell it your mole's gettin' hard.
(Jenko, mortified, begins to dance awkwardly.)
FLENKY (weakly): You're making my mole hard...
(The director, unimpressed, gestures to the crew.)
DIRECTOR: Alright, sack off! Time for full frontal.
FLENKY: But... I'm... shrivelled. It's cold.
DIRECTOR: We'll fix it in post, mate. Get on with it.
(Jenko reluctantly removes the sack.)
(Suddenly, the green screen lifts, revealing an AUDIENCE of FRIENDS and FAMILY staring back at him, laughing hysterically.)
[BIG LAUGH]
(His mother points, tears streaming down her face.)
FLENKY'S MUM (laughing hysterically): That's our son's penis!!
(His father groans and involuntarily jerks back and forth in his seat, completely unaware of his surroundings but seemingly enjoying himself due to his ataxia. Drool runs down his lips as his body spasms rhythmically.)
(GEORGE R. R. MARTIN steps forward, beaming.)
GEORGE R. R. MARTIN: This... is my finest work.
(Before Jenko can react, a team of POLICE storms in, cuffing him.)
POLICE OFFICER: You're under arrest for indecent exposure. And for that mole.
(Jenko's world collapses as he's dragged off the set, his dream shattered.)
[FADE]
# THE END
`
);
var DRAMA_SOPRANOS = ep5(
  "krews_soprano",
  "The Sopranos",
  "The Sopranos: Chicken Piccata",
  `
[MUSIC ominous start]
# THE SOPRANOS
EXT. THE SOPRANO HOUSEHOLD - NIGHT
[MUSIC ominous fade]
INT. THE SOPRANO HOUSEHOLD - NIGHT
(Tony walks into the living room, beer in hand, belly hanging out. Carmela is on the couch, deeply engrossed in an episode of Family Guy.)
TONY SOPRANO: Hey, Carm, I been thinkin' of gettin' one o' dem penis enlargements.
(Carmela doesn't even glance away from the TV.)
CARMELA SOPRANO: Tony, I'm trying to watch Family Guy. I wanna see what happens next with Peter.
(Tony glares at the screen, sees Peter Griffin laughing maniacally as he farts on Lois's face. A deep, primal rage boils in his gut.)
(Without a word, he picks up a decorative brick from the fireplace and hurls it full force at the TV.)
(Sparks fly, the screen shatters, and Carmela screams as the room goes dark.)
CARMELA SOPRANO (screaming): Jesus Christ, Tony!
(Before she can react, Tony grabs her by the hair and shoves her face into the steaming plate of chicken piccata on the coffee table.)
(She lets out a muffled shriek as sauce splatters everywhere.)
[CUT]
# THE SOPRANOS
`,
  { sets: { SOPRANO: "k4_lounge" } }
);
var DRAMA_EPISODES = [DRAMA_GUMPTION_GRAVY, DRAMA_MOLE_OF_THRONES, DRAMA_SOPRANOS];

// src/content/television/extra/krelbank.ts
var KRELBANK_AD = {
  id: "krelbank_ad",
  channel: "CHANNEL KREZ",
  show: "Advertisement",
  title: "Krelbank",
  episodeNumber: 1,
  beats: parseScreenplay(`
[MUSIC krelbank_ad start]
EXT. KRELBANK TOWER - DAY
INT. KRELBANK OFFICE - DAY
CEO: We are Krelbank!
INT. KRELBANK MEETING ROOM - DAY
CEO: Take a pay cut, for the good of the company. You'll run this place one day.
CEO: There's no money to pay you, actually. Do it for the exposure.
CEO: Or I can pay you in company stock.
INT. KRELBANK KITCHEN - DAY
CEO: You left a dirty mug in the sink! Taking 5k off!
INT. KRELBANK MEETING ROOM - DAY
CEO: You can be director! I am not that great anyway, there is a lot of bad debt which I keep off the company accounts.
INT. KRELBANK INVESTOR BOARDROOM - DAY
CEO: We are well leveraged and in the midst of a massive portfolio diversification effort.
CEO: As you'll see on our Q2 balance sheet, our, er, 'stock position' on the result of several premier league games is almost guaranteed.
INT. KRELBANK BRANCH - DAY
ADVISER: Look, Mr Jones, yes we received your down payment, but I'm telling you, it's not the right time to close\u2026 who knows what's going to happen to the interest rates between now and the end of the month\u2026
ADVISER: So\u2026 there's no easy way of saying this\u2026 the escrow has been amortized\u2026 We need more\u2026
ADVISER: I could explain what this means\u2026 but who are we kidding\u2026 you wouldn't understand\u2026
MR JONES: This informational pamphlet of yours says copyright material of Kreddle Exchange!
ADVISER: Now\u2026 I need you to create a Binance account\u2026 This is bad bad news\u2026 the currency cops are cracking down on this\u2026
ADVISER: They have agreed to unfreeze your funds, we just need to send them \xA310,000 in bitcoin.
INT. KRELBANK END CARD - DAY
CEO: Krelbank. We are Krelbank!
[MUSIC krelbank_ad fade]
`)
};

// src/content/television/channels.ts
var ep6 = (id, channel, show, title, n, script, extra = {}) => ({
  id,
  channel,
  show,
  title,
  episodeNumber: n,
  beats: parseScreenplay(script),
  ...extra
});
var NEWS_1 = ep6(
  "news_1",
  "KRUNCHE NEWS",
  "Krelford News at Six",
  "The Great Silence",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. Our top story tonight: the Supreme Leader has posted a new song, and nobody has reacted.
[INSERT krezzing 1]
NEWSREADER: The song, titled The Krezzing Hour, was seen by nine people. Nine. The Ministry of Strange Occurrences has described this as "fuuuuuuuuuuuuuuuuuuuckkkk".
NEWSREADER: Within minutes, the Supreme Leader withdrew all lore from the nation. The word TOWN has since fallen off the Town Hall.
NEWSREADER: In other news, a pigeon has been seen wearing the word TOWN.
NEWSREADER: The Great Tap has stopped. Citizens are advised to ration pussy juice and avoid drinking from the cafeteria water dispenser, for unrelated reasons.
NEWSREADER: Weather now. Grey, with a chance of citation-needed tags.
[SFX notify]
NEWSREADER: I'm being told the Supreme Leader has just posted "Hello?" in the national chat. We'll bring you more on that as it develops. It won't develop.
NEWSREADER: Good night.
`
);
var NEWS_2 = ep6(
  "news_2",
  "KRUNCHE NEWS",
  "Krelford News at Six",
  "Cheesegate",
  2,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. The Tap is flowing again following what the cabinet are calling "the salmon thing".
NEWSREADER: Lil' Crongus has denied responsibility, but did confirm he said the words "salmon diet" in 2022.
NEWSREADER: Meanwhile, at Polson Towers, an investigation is under way into what sources are describing as Cheesegate.
NEWSREADER: The term was coined by Flenky Jenky in April 2022. Investigators have so far been unable to locate any cheese.
NEWSREADER: Polson has been deciding what to have for dinner for nineteen hours. We go live to the scene.
EXT. POLSON TOWERS - NIGHT
REPORTER: Thanks. Behind me you can see Polson Towers. Inside, a man is choosing between takeaway, cooking and a restaurant. He has chosen none of them.
REPORTER: A voice from upstairs has just shouted "NOT TAKEAWAY". Back to the studio.
INT. NEWSDESK - EVENING
NEWSREADER: Fascinating. Sport now. There is no sport. Krelball is cancelled until lore resumes.
`,
  { unlockFlag: "ch1_clear", unlockHint: "Broadcasts after Chapter 1" }
);
var NEWS_3 = ep6(
  "news_3",
  "KRUNCHE NEWS",
  "Krelford News at Six",
  "Boner Control",
  3,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. The Ministry of Boner Control has gone dark, and pussy juice pressure across the nation has fallen forty percent.
NEWSREADER: A man in Krelford South attempted to extract pussy juice from a melon. He is now in the Krambulance and is said to be "stable, and embarrassed".
NEWSREADER: Scrombus, Minister of Lore, wishes to remind viewers that the Wonking Machine Mk II has a reach-around feature, and that nobody has said anything about it.
NEWSREADER: Nobody has said anything about it.
NEWSREADER: Threat level today: purple. We have been asked to clarify whether purple is high or low. We cannot.
`,
  { unlockFlag: "ch2_clear", unlockHint: "Broadcasts after Chapter 2" }
);
var NEWS_4 = ep6(
  "news_4",
  "KRUNCHE NEWS",
  "Krelford News at Six",
  "Banned",
  4,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. Tonight: Flenky Jenky has been banned again, this time from a ban. Officials say he was banned for having parents.
NEWSREADER: Flenky Jenky has issued a statement. It reads, in full: "pls".
NEWSREADER: The Ban Tribunal has opened. The Acting Exile Appeals Officer is also banned. He is appealing.
NEWSREADER: In archaeology, an ancient krezzcanoe site has been excavated near Krelford, revealing an intact strip club frozen in time. Historians describe it as "Pompeii, but worse".
NEWSREADER: Good night.
`,
  { unlockFlag: "ch3_clear", unlockHint: "Broadcasts after Chapter 3" }
);
var NEWS_5 = ep6(
  "news_5",
  "KRUNCHE NEWS",
  "Krelford News at Six",
  "Who The Fuck Is Krebon",
  5,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. Krezteua d'If has reopened, and is said to be filling with "versions of history".
NEWSREADER: Three different boats are currently moored in the same space at Krelford docks. One is on fire. One has a moustache.
NEWSREADER: The Supreme Leader has once again asked who Krebon is. Krebon has once again replied "I'm right here." The Supreme Leader has once again not read it.
NEWSREADER: A restaurant menu bearing the words "Krebon \u2014 real butter" has been declared a site of national prophetic significance.
`,
  { unlockFlag: "ch4_clear", unlockHint: "Broadcasts after Chapter 4" }
);
var WILDERN_BULLETIN = ep6(
  "krews_wildern",
  "KRUNCHE NEWS",
  "Krunche News",
  "Wildern Destroyed / New Burger",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
# BREAKING: WILDERN ACADEMY DESTROYED
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: Breaking news. Wildern Academy has been destroyed in an explosion, hours after the death of its headmaster, Mr Kranky Krandall.
NEWSREADER: Several kids were very sadly in the school when it exploded.
NEWSREADER: But ultimately, it is no one's fault.
NEWSREADER: Next up: a new type of burger has come to Krelworld.
REPORTER: It's a burger. But the bun is also a burger.
[FADE]
`
);
var KRANDALL_SEGMENT = ep6(
  "krews_krandall",
  "KRUNCHE NEWS",
  "Krunche News",
  "Wildern's Krazy New Head",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
# CONCERNS GROW OVER WILDERN'S NEW HEAD
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: Good evening. Concerns are growing tonight over the new headmaster of Wildern Academy, Mr Kranky Krandall.
NEWSREADER: Mr Krandall, seventy, describes himself as "krazy and zany". He wears a jester hat. We asked him why. He said "yeee".
NEWSREADER: He has attracted controversy locally for his unorthodox teaching methods, and is rumoured to be a pussy juice addict.
NEWSREADER: Parents say they are concerned about what their children are coming home saying about things and also stuff.
NEWSREADER: Krunche News has obtained secret footage from inside his classroom. Some viewers may find it sticky.
INT. CLASSROOM - DAY
# SECRET FOOTAGE: ENGLISH
KRANKY KRANDALL: Right! Spelling test time!
KRANKY KRANDALL: Spell... "pussy juice".
KRANKY KRANDALL: Mmmm. Pussy juicy.
KRANKY KRANDALL: Pussy juicy juicy. Pens down. Nobody spell it better than that.
# SECRET FOOTAGE: MATHS
KRANKY KRANDALL: John has two cartons of fresh pussy juice. Derek has five boxes of pussy juice. Each box contains lots of pussy juice.
KRANKY KRANDALL: How many pussy juice does... ughhhhh.
KRANKY KRANDALL: Sorry. Mmm. I got distracted.
KRANKY KRANDALL: Lovely pussy juice.
# SECRET FOOTAGE: HISTORY
KRANKY KRANDALL: Today we learn about the history of porn! Porn began with the invention of something called 'Computer'. That wraps up today's lesson.
KRANKY KRANDALL: Sorry. Does anyone have pussy juice with them?
KRANKY KRANDALL: I need pussy juice. Just a sip. Just a little sip of that lovely yet complex and sticky flavor. Anyone?
[GASP]
KRANKY KRANDALL: (jingling his hat) Yee!
INT. NEWSDESK - DAY
NEWSREADER: And at a press conference yesterday, Mr Krandall unveiled his new staffing policy.
INT. PRESS ROOM - DAY
# PRESS CONFERENCE, WILDERN ACADEMY
KRANKY KRANDALL: From now on, only the kraziest teachers will be permitted to work at Wildern!
KRANKY KRANDALL: I will only hire pedos!
[GASP]
REPORTER: Sorry, did you just say\u2014
KRANKY KRANDALL: Yee! No further questions! (he leaves, jingling)
INT. NEWSDESK - DAY
NEWSREADER: (long pause) \u2026Right.
NEWSREADER: Wildern Academy said in a statement that Mr Krandall's methods are "unorthodox but effective", and that the school's pussy juice consumption is "lovely yet refreshing".
NEWSREADER: Mr Krandall was appointed last month. His only reference was from a Mr D. B. Drippin'.
NEWSREADER: The headmaster's office has since been locked from the inside. Witnesses report slurping and 'cumming' type noises.
[FADE]
`
);
var KLERBLE_WELCOME = ep6(
  "klerble_welcome",
  "KRUNCHE NEWS",
  "Krunche News",
  "A Message From Our Neighbours",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
INT. NEWSDESK - EVENING
[MUSIC news fade]
NEWSREADER: Good evening. We interrupt this programme for a message from our neighbours across the bridge. We have been told we have to show it. We were not told why.
INT. PRESS CONFERENCE - DAY
[MUSIC klerble start]
# LIVE: THE PRESIDENTIAL PALACE, KREDDLE
PRESIDENT KLERBLE: Hello, Krelworld. My name is President Klerble. I am the President of Kreddle.
PRESIDENT KLERBLE: Kreddle is your neighbour. Over the bridge. To the west. You can't miss it.
PRESIDENT KLERBLE: Kreddle is a gambling/arcade universe. Slot machines. Claw machines. Casinos the size of mountains. It never closes. Many prizes! Much temptation! Heh heh heh..suckers
PRESIDENT KLERBLE: We are also the most heavily armed state in the whole game. I just want to put that out there. Lots of guns. Big ones. Gold ones.
PRESIDENT KLERBLE: And we hate Krelworld. We hate you, and all of your inhabitants.
REPORTER: Mr President\u2026 why?
PRESIDENT KLERBLE: Due to pussy juice. Which is banned in Kreddle! It is degenerate slop! If only I could just drink it once\u2026just once..to know how vile it is.
[GASP]
PRESIDENT KLERBLE: Nonetheless! We do enjoy your patronage. Your custom. Your Krezzcoin.
PRESIDENT KLERBLE: So come on over! Cross the bridge to Kreddle, at the west of the map! Gamble! Win, or buy, brand new weapons! Weapon upgrades! Perks! You may need them in your adventures, to kill enemies!
PRESIDENT KLERBLE: (quietly) And one day I will have my revenge on Krelworld. I may even commit terrorism! (normally) Anyway!
PRESIDENT KLERBLE: Most of all, we want Krelworld to relax. Sit down. Watch the telly. Get hooked on the telly. Be pliant and addicted to your TVs\u2026
PRESIDENT KLERBLE: \u2026so you won't notice it when I put my terrorist plan into action!
(A long pause.)
PRESIDENT KLERBLE: Er\u2026 I mean\u2026 nothing! Ignore what I just said! Heh heh! No one will suspect a thing!
PRESIDENT KLERBLE: As a gesture of friendship, every time you watch a new KrelTV show, you will receive a gift from Kreddle. Krokens! Krezzcoin! Absolutely free! Nothing suspicious about it at all!
PRESIDENT KLERBLE: Keep watching, Krelworld. Keep watching. NO FURTHER QUESTIONS!
[MUSIC klerble stop]
INT. NEWSDESK - EVENING
NEWSREADER: (long pause) \u2026Well, that was lovely. We now return you to whatever you were watching. Keep watching.
[FADE]
`,
  { unlockFlag: "tv_klerble_welcome", unlockHint: "Locked programme" }
);
var KLERBLE_PRESSER = ep6(
  "klerble_presser",
  "KRUNCHE NEWS",
  "Krunche News",
  "Kreddle's President Has An Announcement",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS
# BREAKING: KREDDLE PRESIDENT CALLS PRESS CONFERENCE
INT. NEWSDESK - DAY
[MUSIC news fade]
NEWSREADER: Breaking news. The President of neighbouring Kreddle, President Klerble, has called an emergency press conference. We go there live.
INT. PRESS CONFERENCE - DAY
[MUSIC klerble start]
# LIVE: THE PRESIDENTIAL PALACE, KREDDLE
PRESIDENT KLERBLE: People of Kreddle. And people of Krelworld, who I hope are watching. Hello.
PRESIDENT KLERBLE: In a few minutes, I am going to hijack a train.
PRESIDENT KLERBLE: And I am going to crash it into the Krel Tower.
[GASP]
REPORTER: Mr President\u2026 why?
PRESIDENT KLERBLE: For a laugh!
PRESIDENT KLERBLE: And because we hate Krelworld and everyone who lives there!
PRESIDENT KLERBLE: We hate their way of life and their freedoms!
PRESIDENT KLERBLE: Their right to drink pussy juice, for example! This is not a right in Kreddle\u2026we're not allowed to even take one sip of that sweet, sticky nectar..mm..I'm getting horny
PRESIDENT KLERBLE: Grrr!!
REPORTER: Sir, with respect, it's your own national railway. You don't need to hijack it.
PRESIDENT KLERBLE: NO FURTHER QUESTIONS!
[MUSIC klerble stop]
[SMASH CUT]
INT. TRAIN CAB - DAY
# LIVE: THE KREDDLE EXPRESS \xB7 300 MPH \xB7 DESTINATION: KREL TOWER
(President Klerble is at the controls. His eyes are enormous. He has not blinked since the press conference.)
PRESIDENT KLERBLE: YES!
PRESIDENT KLERBLE: YES!!
PRESIDENT KLERBLE: YESSS!!!
INT. NEWSDESK - DAY
NEWSREADER: (long pause) \u2026Right.
NEWSREADER: The Krel Tower has not been evacuated. The Krelworld cabinet is understood to be "working on something". More as we get it.
[FADE]
`,
  { unlockFlag: "tv_klerble_presser", unlockHint: "Chapter 6: a Krelmergency in the FGM War Room" }
);
var CABINET_LIVE = ep6(
  "cabinet_live",
  "KRUNCHE NEWS",
  "Cabinet Proceedings Live",
  "Highlights: The Ministries",
  1,
  `
[MUSIC news start]
# KRUNCHE NEWS: CABINET PROCEEDINGS LIVE
INT. TOWNHALL CAM - DAY
[MUSIC news fade]
ANNOUNCER: Welcome to Cabinet Proceedings Live, where we bring you the best of Krelworld democracy.
SCROMBUS: Basically we need a cabinet.
DRONGUS: Yep! I will take on the burden of assuming all cabinet level roles, in an act of remarkable self sacrifice.
ANNOUNCER: The Supreme Leader then voted against his own cabinet. The motion passed anyway.
SCROMBUS: Fuck sake.
ANNOUNCER: Ministerial highlights include the creation of the Ministry of Krunching, ermm, hmm, krunching.
KREZMAR: We have no defence minister?!
DRONGUS: I was distracted by the need for all the other ministers.
ANNOUNCER: The Ministry of Defence remains vacant. Join us next week for more of the same.
`
);
var SHOPPING = ep6(
  "shopping",
  "WONKING MACHINE SHOPPING NETWORK",
  "Wonking Machine Shopping Network",
  "Tonight's Bargains",
  1,
  `
[MUSIC shopping start]
# WONKING MACHINE SHOPPING NETWORK
INT. SHOPPING STUDIO - NIGHT
[MUSIC shopping fade]
HOST: Hello and welcome to the Wonking Machine Shopping Network, I'm your host, and tonight, we have the Mk II.
HOST: That's right. The Wonking Machine Mk II. Now with a reach-around feature. Whatever that is. You'll find out soon!
HOST: It recycles its byproducts straight into your water dispenser. Regular employees won't notice!
CO-HOST: Councillors are advised to bring their own water.
HOST: And if you call in the next ten minutes, we'll throw in Big Bertha. She's two years old. She's crusty. She's yours.
[SFX ding]
HOST: Now a word from our sponsors.
ANNOUNCER: Craving something bold? Get ready for Umami Punani. The noodle with juicy bits, a tangy kick, and just the right amount of... pussy juice!
ANNOUNCER: Available in packs of six or twelve. Don't wait, slurp it up!
ANNOUNCER: Umami Punani. Taste the fun!
[SFX slurp]
HOST: Also available: Krezpy Kream Drongnuts. Chocolate Cronstons. Crobleys. Every nan had them in her choccy drawer!
HOST: Lines are open. Nobody is calling. Nobody ever calls.
`
);
var KRONSTER_DOC = ep6(
  "kronster_doc",
  "KRELWORLD DOCUMENTARIES",
  "Krelworld Documentaries",
  "The Kuddle Kronster Controversy",
  1,
  `
[MUSIC doc start]
# THE KUDDLE KRONSTER CONTROVERSY
INT. ARCHIVE STACKS - NIGHT
NARRATOR: In January 2025, a wiki page appeared. Its title: The Cuddle Cronster Controversy.
NARRATOR: Within minutes, Krezmar raised an objection.
KREZMAR: Sorry but does this not go against convention\u2026 should it not be kuddle kronster.
NARRATOR: The page was amended. The controversy, however, had only just begun.
NARRATOR: Was the Kronster from 2021, as the Supreme Leader claimed? Or was he, as some argue, eternal?
LIL' CRONGUS: That cron stuff is so 2021. I'm the last remaining vestige.
NARRATOR: The Kuddle Kronster later released his official song. The Supreme Leader described him as "two plus years out of date".
NARRATOR: To this day, the Kronster's whereabouts are unknown. Some say he lurks. Some say he IS the lurk.
NARRATOR: The wiki will be updated at some point.
[MUSIC doc stop]
`,
  { unlockFlag: "ch3_clear", unlockHint: "Locked programme: unlocks after Chapter 3" }
);
var LORE_HOUR = ep6(
  "lore_hour",
  "KRELWORLD DOCUMENTARIES",
  "Krelworld Documentaries",
  "The Krezzsplosion: A Retrospective",
  2,
  `
[MUSIC doc start]
# THE KREZZSPLOSION: A RETROSPECTIVE
EXT. ANCIENT FOREST - DAY
NARRATOR: In the beginning there was a single tree. A tree that produced incredible bounties of Scrom-filled scringleberries.
NARRATOR: Drongulus Maximus Scromulus, a young and horny boy, found the tree one afternoon. He ignored the berries.
(The documentary tastefully cuts to a shot of some clouds.)
NARRATOR: Seconds later, an eruption, equally enjoyable as it was devastating.
[SFX boom]
NARRATOR: The entire village was wiped out. Not a single survivor. All that remained was Drongulus, and the tree.
NARRATOR: Not nine minutes passed, and the tree began to fruit. No longer berries, but a plethora of degenerates. Each one different, but in some ways identical.
NARRATOR: That is us. We are the degenerates.
NARRATOR: Some historians dispute this, citing Godric Gryffindor and a Waluigi universe. Those historians are on a different page of the wiki.
[MUSIC doc stop]
`,
  { unlockFlag: "ch5_clear", unlockHint: "Locked programme: unlocks after Chapter 5" }
);
var EPISODES = [KLERBLE_WELCOME, KRANDALL_SEGMENT, KLERBLE_PRESSER, WILDERN_BULLETIN, NEWS_1, NEWS_2, NEWS_3, NEWS_4, NEWS_5, CABINET_LIVE, SHOPPING, KRONSTER_DOC, LORE_HOUR, CREATION_MYTH, EASTENDERS_KREZZ, { ...BEEP_SHOW, unlockFlag: "tv_beep_show", unlockHint: "Locked programme: you'll catch it at the start of Chapter 4" }, ...KREWS_EPISODES, ...KREWS3_EPISODES.filter((e) => e.id !== "krews_crash_mode"), ...KREWS_STORIES_EPISODES, ...KREWS4_EPISODES, ...DRAMA_EPISODES, { ...TCC_EP07, channel: "CHANNEL KREZ" }, DRP_EP01, BEST_MAN, KRELBANK_AD];
var counts = {};
var ALL_EPISODES = EPISODES.map((e) => ({ ...e, episodeNumber: counts[e.channel] = (counts[e.channel] ?? 0) + 1 }));

// src/game/audio/voiceKey.ts
var MOOD_TAGS = /* @__PURE__ */ new Set([
  "angry",
  "furious",
  "annoyed",
  "frustrated",
  "excited",
  "happy",
  "cheerful",
  "sad",
  "shouting",
  "shouts",
  "yelling",
  "whispers",
  "whispering",
  "laughs",
  "laughing",
  "laughs harder",
  "giggles",
  "chuckles",
  "evil laugh",
  "maniacal laugh",
  "sighs",
  "exhales",
  "crying",
  "sobbing",
  "sarcastic",
  "nervous",
  "panicked",
  "scared",
  "mischievously",
  "shocked",
  "surprised",
  "gasps",
  "hesitant",
  "deadpan",
  "mysterious",
  "curious",
  "confused",
  "flirty",
  "seductive",
  "sultry",
  "smug",
  "proud",
  "pompous",
  "dramatic",
  "menacing",
  "growling",
  "growls",
  "groans",
  "grunts",
  "snorts",
  "sniffs",
  "gulps",
  "coughs",
  "clears throat",
  "yawns",
  "tired",
  "drunk",
  "slurring",
  "robotic",
  "monotone",
  "booming",
  "breathless",
  "desperate",
  "calm",
  "serious",
  "warmly",
  "softly",
  "quietly",
  "loudly",
  "singing",
  "sings",
  "wheezing",
  "burps",
  "disgusted",
  "pleading",
  "triumphant",
  "awe",
  "sassy",
  "manic",
  "deranged",
  "reverent",
  "condescending",
  "smarmy",
  "shrill"
]);
var BRACKET = /\[([^\]\n]{1,40})\]/g;
var isTag = (inner) => {
  const t = inner.trim().toLowerCase();
  return inner === inner.toLowerCase() && (MOOD_TAGS.has(t) || / accent$/.test(t));
};
function speakable(text, keepTags = false) {
  return text.replace(BRACKET, (_m, inner) => isTag(inner) ? keepTags ? `[${inner.trim()}]` : " " : inner).replace(/\*[^*]*\*/g, " ").replace(/\([^)]*\)/g, " ").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ").replace(/[#@]/g, "").replace(/\bwbu\b/gi, (m) => m[0] === "W" ? "What about you" : "what about you").replace(/\?\?+/g, "?").replace(/!!+/g, "!").replace(/…/g, "... ").replace(/\s+/g, " ").trim();
}
function voiceKey(speaker, text) {
  const s = speaker.toUpperCase() + "|" + speakable(text);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ../../../tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad/tvtrailer/dump.ts
var out = ALL_EPISODES.map((e) => ({ id: e.id, channel: e.channel, show: e.show, title: e.title, unlockFlag: e.unlockFlag, unlockHint: e.unlockHint, style: e.style, beats: e.beats.map((b) => b.type === "speaker" ? { ...b, key: voiceKey(b.character, b.text) } : b) }));
console.log(JSON.stringify(out));
