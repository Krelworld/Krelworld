import type { NewsCfg } from "../TVNews";

/**
 * The "news stories" GB Krews shows (src/content/television/extra/krews3.ts): Klopp's bribe on GB Krews Sport, Sunak's
 * bomb threat, the Starmer election special and Microsoft's "Crash Mode" press conference. Besides the desk and the
 * press pack they use the story kinds below; NewsDirector draws them (the "news stories" block in TVNews.ts).
 *
 * - field: a location with one or two people in it (the pitch, the tunnel, a bus, a kitchen, the breakfast sofa):
 *   two-shots and singles, and the reporter or newsreader talking over the pictures. `look` sets the footage style.
 * - vox: one person off-centre in a location (vox pops, the expert, a silhouetted insider); the reporter does pieces
 *   to camera there, the newsreader talks over the location.
 * - rally: a speaker at a lectern on a stage, a crowd with placards in front.
 * - keynote: a tech launch: the giant screen's slides change with the lines, the press pack in front.
 * - graphic: a full-screen news graphic (polls, trending hashtags, a statement, results, a teased announcement, a
 *   crashed website) under the newsreader.
 * - flank: in a presser, people standing either side of the podium in the wide (Whitty and Merrick by Starmer).
 */

export type StoryKind = "field" | "vox" | "rally" | "keynote" | "graphic";
export const STORY_KINDS: ReadonlySet<string> = new Set<StoryKind>(["field", "vox", "rally", "keynote", "graphic"]);

export type Gfx =
  | { type: "poll"; title: string; sub: string; bars: { label: string; from: number; to: number; color: number }[] }
  | { type: "trend"; title: string; tags: { tag: string; n: number }[]; posts: string[] }
  | { type: "statement"; title: string; from: string; quote: string; color: number }
  | { type: "results"; title: string; from: [string, number]; to: [string, number]; seats: number; flips: number }
  /** a social post teasing an announcement, the speculation piling up around it */
  | { type: "teaser"; title: string; from: string; handle: string; post: string; when: string; guesses: string[] }
  /** a crashed website: a browser window with an error page */
  | { type: "error"; title: string; url: string; code: string; msg: string; sub: string };

export interface Slide {
  match: RegExp;
  title: string;
  sub?: string;
  art: "logo" | "planes" | "sensor" | "club" | "money" | "img";
  /** for art "img": a texture shown on the screen (krews4Shows.ts) */
  img?: string;
}

/** Optional extras a scene can carry (only the story kinds use them). */
export interface StoryScene {
  /** where we are, for the LIVE tag */
  where?: string;
  look?: "sport" | "secret" | "hotmic" | "sofa" | "silhouette";
  /** who's in the wide, and where across the picture (0-1) */
  cast?: [string, number][];
  /** a speaker -> the anchor art that plays them here */
  anchors?: Record<string, string>;
  gfx?: Gfx;
  slides?: Slide[];
  /** the giant screen in the set's art, as fractions of the picture */
  screen?: [number, number, number, number];
  /** presser: people standing either side of the podium in the wide, and where across the picture (0-1) */
  flank?: [string, number][];
}

const STUDIO = { match: /NEWSDESK/, kind: "desk" as const, set: "tv_gbk_studio" };
const LAB = 0xdc2626;
const CON = 0x2563eb;
const LD = 0xf59e0b;
const OTH = 0x6b7280;

const KLOPP = { key: "tvanchor_KLOPP", frame: 0, crop: [30, 4, 68, 60] as [number, number, number, number] };
const KLOPP_NOTE = { key: "tvanchor_KLOPP", frame: 4, crop: [4, 30, 92, 70] as [number, number, number, number] };
const HUGHES = { key: "tvanchor_HUGHES", frame: 0, crop: [34, 6, 64, 58] as [number, number, number, number] };
const HUGHES_CASH = { key: "tvanchor_HUGHES", frame: 4, crop: [6, 20, 100, 76] as [number, number, number, number] };
const SUNAK = { key: "tvanchor_SUNAK", frame: 0, crop: [30, 2, 68, 60] as [number, number, number, number] };
const STARMER = { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] as [number, number, number, number] };
const RAYNER = { key: "tvanchor_RAYNER", frame: 0, crop: [28, 4, 72, 62] as [number, number, number, number] };

export const KREWS3_NEWS: Record<string, NewsCfg> = {
  krews_klopp_bribe: {
    brand: "gbksport",
    ticker: [
      "Klopp farewell ends 2-1 to the visitors",
      "Referee Hughes 'not for sale for twenty quid'",
      "Liverpool FC launch internal investigation",
      "Crumpled £20 note placed in evidence bag",
      "Anfield tea bar: 'we'd have taken it'",
    ],
    scenes: [
      STUDIO,
      { match: /PITCH/, kind: "field", set: "tv_anfield_pitch", look: "sport", cast: [["JURGEN KLOPP", 0.3], ["MARK HUGHES", 0.7]] },
      { match: /TUNNEL/, kind: "field", set: "tv_anfield_tunnel", look: "secret", cast: [["MARK HUGHES", 0.3], ["JURGEN KLOPP", 0.7]] },
      {
        match: /STATEMENT GRAPHIC/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "LIVERPOOL FC STATEMENT",
          from: "Liverpool Football Club",
          quote: "The club is shocked and disappointed by the events at today's match, and has begun a thorough internal investigation.",
          color: 0xc8102e,
        },
      },
    ],
    ots: [
      { match: /storybook|fairytale/i, pic: KLOPP, caption: "Klopp's farewell" },
      { match: /£20|twenty|bribe/i, pic: KLOPP_NOTE, caption: "The £20 bribe" },
      { match: /tunnel|bribe of his own/i, pic: HUGHES_CASH, caption: "The tunnel" },
      { match: /Hughes|referee/i, pic: HUGHES, caption: "Referee Mark Hughes" },
      { match: /Klopp/i, pic: KLOPP, caption: "Jürgen Klopp" },
    ],
    straps: {
      NEWSREADER: ["GB Krews Sport", "Live from the Krelford studio"],
      REPORTER: ["Reporter", "GB Krews Sport, at Anfield"],
      "JURGEN KLOPP": ["Jürgen Klopp", "Liverpool manager · his final match"],
      "MARK HUGHES": ["Mark Hughes", "Referee"],
    },
  },

  krews_sunak_bomb: {
    brand: "gbk",
    ticker: [
      "Election postponed 'for at least five years'",
      "Bomb 'under every polling station', says PM",
      "Polling cards: keep them, apparently",
      "Opposition: 'he's twenty points behind, that's the bomb'",
      "Downing Street cat 'also unavailable until 2029'",
    ],
    scenes: [STUDIO, { match: /DOWNING STREET/, kind: "presser", set: "tv_no10_door" }],
    ots: [
      { match: /desperate move|bomb threat/i, pic: SUNAK, caption: "Election cancelled" },
      { match: /live now to Downing Street/i, pic: { key: "tv_no10_door", crop: [100, 10, 120, 150] }, caption: "Downing Street" },
      { match: /intelligence|five years/i, pic: SUNAK, caption: "'Credible threat'" },
      { match: /Downing Street|declined/i, pic: { key: "tv_no10_door", crop: [100, 10, 120, 150] }, caption: "No comment" },
    ],
    straps: {
      "RISHI SUNAK": ["Rishi Sunak", "Prime Minister"],
      REPORTER: ["Reporter", "GB Krews, Downing Street"],
    },
  },

  krews_starmer_saga: {
    brand: "gbk",
    ticker: [
      "Labour T-shirts sold out in all sizes, including maternity",
      "#FartGate trending in 41 countries",
      "Rayner: 'calling her a cow is much worse'",
      "Snap poll: 70-point swing after 'Phwoar!'",
      "Battle bus microphones to be 'looked at'",
    ],
    scenes: [
      STUDIO,
      { match: /BATTLE BUS/, kind: "field", set: "tv_battle_bus", look: "hotmic", cast: [["KEIR STARMER", 0.5]], anchors: { "KEIR STARMER": "KEIR STARMER@BUS" } },
      {
        match: /SURGE POLL/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "poll",
          title: "VOTING INTENTION",
          sub: "Before and after the hot mic",
          bars: [
            { label: "LAB", from: 41, to: 56, color: LAB },
            { label: "CON", from: 24, to: 20, color: CON },
            { label: "LIB DEM", from: 11, to: 9, color: LD },
            { label: "OTHER", from: 24, to: 15, color: OTH },
          ],
        },
      },
      { match: /RED WALL/, kind: "vox", set: "tv_highstreet", where: "Krelford North · the red wall" },
      { match: /BREAKFAST SOFA/, kind: "field", set: "tv_breakfast_sofa", look: "sofa", cast: [["BREAKFAST HOST", 0.28], ["ANGELA RAYNER", 0.72]] },
      { match: /MERCH SHOP/, kind: "vox", set: "tv_labour_merch", where: "The Labour Party shop" },
      { match: /KITCHEN/, kind: "field", set: "tv_no10_kitchen", look: "hotmic", cast: [["RISHI SUNAK", 0.5]], anchors: { "RISHI SUNAK": "RISHI SUNAK@HOME" } },
      {
        match: /TORY SLUMP/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "poll",
          title: "VOTING INTENTION",
          sub: "After the Prime Minister's 'cow' remark",
          bars: [
            { label: "LAB", from: 56, to: 64, color: LAB },
            { label: "CON", from: 20, to: 7, color: CON },
            { label: "LIB DEM", from: 9, to: 10, color: LD },
            { label: "OTHER", from: 15, to: 19, color: OTH },
          ],
        },
      },
      { match: /RALLY STAGE/, kind: "rally", set: "tv_labour_rally", where: "Labour's final rally" },
      {
        match: /SNAP POLL/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "poll",
          title: "SNAP POLL · A 70-POINT SWING",
          sub: "After 'Smell that, Sunak! Phwoar! Lovely!'",
          bars: [
            { label: "LAB", from: 64, to: 29, color: LAB },
            { label: "CON", from: 7, to: 42, color: CON },
            { label: "LIB DEM", from: 10, to: 11, color: LD },
            { label: "OTHER", from: 19, to: 18, color: OTH },
          ],
        },
      },
      { match: /POLLING STATION/, kind: "vox", set: "tv_polling_station" },
      {
        match: /TRENDING/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "trend",
          title: "TRENDING NOW",
          tags: [
            { tag: "#FartGate", n: 2140000 },
            { tag: "#PhwoarGate", n: 1380000 },
            { tag: "#SmellThatSunak", n: 884000 },
            { tag: "#LovelyKeir", n: 412000 },
          ],
          posts: ["'Phwoar! Lovely!' I'm voting Tory and I've never been so ashamed", "my nan was watching", "Was it a real one though", "Still got the T-shirt. Gonna burn it.", "The mic picked up EVERYTHING"],
        },
      },
      { match: /LABOUR HQ PRESS/, kind: "presser", set: "tv_labour_press" },
      { match: /EXPERT STUDIO/, kind: "vox", set: "tv_expert_study" },
      {
        match: /RESULTS GRAPHIC/,
        kind: "graphic",
        set: "",
        gfx: { type: "results", title: "ELECTION RESULTS · SEATS DECLARED", from: ["LAB", LAB], to: ["CON", CON], seats: 120, flips: 94 },
      },
      { match: /CORRIDOR/, kind: "vox", set: "tv_labour_hq_night", look: "silhouette", anchors: { "LABOUR INSIDER": "VOTER 1" } },
    ],
    ots: [
      { match: /hot mic remark|private conversation/i, pic: STARMER, caption: "The hot mic" },
      { match: /sex symbol/i, pic: STARMER, caption: "Sex symbol?" },
      { match: /lighthearted|authenticity/i, pic: RAYNER, caption: "Rayner's response" },
      { match: /T-shirts|marketing/i, pic: { key: "tv_prop_tshirt" }, caption: "The T-shirt" },
      { match: /Conservative Party|scrambling/i, pic: SUNAK, caption: "Tory scramble" },
      { match: /final stump speech|Election Day/i, pic: { key: "tv_labour_rally", crop: [60, 20, 200, 150] }, caption: "Election Day" },
      { match: /farting|nosedive|viral/i, pic: STARMER, caption: "#FartGate" },
      { match: /final election results|indiscretion/i, pic: STARMER, caption: "Election 2024" },
    ],
    straps: {
      "KEIR STARMER": ["Keir Starmer", "Leader of the Labour Party"],
      "RISHI SUNAK": ["Rishi Sunak", "Prime Minister"],
      "ANGELA RAYNER": ["Angela Rayner", "Deputy Leader, Labour Party"],
      "BREAKFAST HOST": ["Danny Dawn", "Presenter, BBK Breakfast"],
      WOMAN: ["Voter", "Krelford North"],
      "VOTER 1": ["Voter", "Krelford North"],
      "MARGARET THOMPSON": ["Margaret Thompson", "Lifelong Labour supporter"],
      "DR ELAINE ROBERTS": ["Dr Elaine Roberts", "Political expert"],
      "LABOUR INSIDER": ["Senior Labour official", "Speaking anonymously"],
      REPORTER: ["Reporter", "GB Krews"],
    },
  },

  krews_starmer_video: {
    brand: "gbk",
    ticker: [
      "Starmer: video was 'a virus'",
      "Enhanced audio: 'watch now'",
      "Sunak: 'beyond comprehension'",
      "Calls for second general election grow",
      "Tory MPs offered counselling",
    ],
    scenes: [
      STUDIO,
      { match: /CABINET ROOM/, kind: "field", set: "tv_k4_cabinet", look: "secret", where: "Westminster", cast: [["KEIR STARMER", 0.34], ["TORY MP", 0.7]], anchors: { "TORY MP": "VOTER 1" } },
      { match: /STATEMENT/, kind: "graphic", set: "", gfx: { type: "statement", title: "STATEMENT", from: "Keir Starmer", quote: "The video was a virus on my phone. I intended to play a different video. By the time I realised, it was too late.", color: 0xdc2626 } },
      { match: /ENHANCED AUDIO/, kind: "field", set: "tv_k4_cabinet", look: "hotmic", where: "Enhanced audio", cast: [["KEIR STARMER", 0.5]] },
      { match: /DOWNING STREET/, kind: "presser", set: "tv_no10_door" },
    ],
    ots: [
      { match: /disturbing video|horrified/i, pic: { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] }, caption: "The video scandal" },
      { match: /enhanced audio/i, pic: { key: "tv_k4_cabinet", crop: [60, 40, 200, 150] }, caption: "Enhanced audio" },
      { match: /resignation|general election/i, pic: { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] }, caption: "Calls to resign" },
    ],
    straps: {
      "KEIR STARMER": ["Keir Starmer", "Labour leader"],
      "RISHI SUNAK": ["Rishi Sunak", "Conservative leader"],
      "TORY MP": ["Conservative MP", "Was in the meeting"],
      REPORTER: ["Reporter", "GB Krews, Westminster"],
    },
  },

  krews_crash_mode_live: {
    brand: "gbk",
    ticker: [
      "'Crash Mode' DLC: points for mid-air collisions",
      "Penis sensor 'vibrates and moistens', company confirms",
      "Families condemn 'tone-deaf' timing",
      "Microsoft shares close 4% up",
      "Krelford air traffic control 'speechless'",
    ],
    scenes: [
      STUDIO,
      {
        match: /KEYNOTE/,
        kind: "keynote",
        set: "tv_keynote",
        where: "Redmond",
        cast: [["EXECUTIVE", 0.5]],
        screen: [0.2375, 0.208, 0.525, 0.3875],
        slides: [
          { match: /flight simulator\. crash mode|thank you/i, title: "CRASH MODE", sub: "FLIGHT SIMULATOR · NEW DLC", art: "logo" },
          { match: /crash a plane/i, title: "CRASH MODE", sub: "OUT NOW · CRASH RESPONSIBLY", art: "planes" },
          { match: /mid-air|crash your|rack up/i, title: "+500 PTS", sub: "PER MID-AIR COLLISION", art: "planes" },
          { match: /penis sensor|forbidden/i, title: "PENIS SENSOR™", sub: "UNIMAGINABLE AND FORBIDDEN PLEASURES", art: "sensor" },
          { match: /vibrates|moistens|groin/i, title: "VIBRATES · MOISTENS", sub: "IN SYNC WITH ON-SCREEN ACTIVITIES", art: "sensor" },
          { match: /stewardess|table dancing/i, title: "LAND. SEDUCE. REPEAT.", sub: "GENTLEMEN'S TABLE DANCING CLUBS", art: "club" },
          { match: /money/i, title: "PRE-ORDER NOW", sub: "$69.99 · SENSOR SOLD SEPARATELY", art: "money" },
        ],
      },
    ],
    ots: [
      { match: /scrutiny|Redmond/i, pic: { key: "tvanchor_EXECUTIVE", frame: 0, crop: [30, 6, 68, 60] }, caption: "'Crash Mode'" },
      { match: /penis sensor|groin/i, pic: { key: "tvanchor_EXECUTIVE", frame: 4, crop: [0, 4, 128, 90] }, caption: "The 'penis sensor'" },
      { match: /outrage|boycott|families/i, pic: { key: "tvanchor_EXECUTIVE", frame: 8, crop: [16, 4, 96, 80] }, caption: "Outrage" },
      { match: /share price|gasps/i, pic: { key: "tvanchor_EXECUTIVE", frame: 0, crop: [30, 6, 68, 60] }, caption: "Microsoft" },
    ],
    straps: {
      EXECUTIVE: ["Microsoft executive", "Flight Simulator: Crash Mode"],
      REPORTER: ["Reporter", "GB Krews, Redmond"],
      JOURNALIST: ["Journalist", "In the press pack"],
    },
    // the game itself (tvnews/mediaClips.ts): a cartoon collision, no one in it
    clips: {
      flight_dlc: { medium: "flight", mode: "dlc" },
      flight_crash: { medium: "flight", mode: "crash" },
      flight_land: { medium: "flight", mode: "land" },
      flight_sensor: { medium: "flight", mode: "sensor" },
    },
  },

  // Kill the Patient 2: the game footage and the cabinet are the ktpGame.ts kinds (arcadegame, cabinet)
  krews_kill_the_patient: {
    brand: "gbk",
    ticker: [
      "Hospital: Kill the Patient 2 'completely different' from Kill the Patient",
      "Cabinet pays '$1 per patient, no daily limit'",
      "Board to investigate board",
      "Chairman 'cannot recall' writing 'Finally! Loved the first one'",
      "Basketball game and dance machine 'not involved'",
      "Machine still operational as of Wednesday afternoon",
    ],
    scenes: [
      STUDIO,
      { match: /HOSPITAL ARCADE/, kind: "vox", set: "tv_ktp_arcade", where: "The hospital arcade" },
      { match: /ARCADE ADMINISTRATORS/, kind: "vox", set: "tv_ktp_arcade", where: "The hospital arcade" },
      { match: /PRESS ROOM LATER/, kind: "presser", set: "tv_ktp_press", main: "BOARD REPRESENTATIVE" },
      { match: /PRESS ROOM/, kind: "presser", set: "tv_ktp_press" },
      { match: /COMMITTEE ROOM/, kind: "presser", set: "tv_ktp_committee", main: "MARTIN BELL" },
      { match: /LAW OFFICE/, kind: "vox", set: "tv_expert_study" },
      { match: /CABINET MARQUEE/, kind: "cabinet", set: "tv_ktp_cabinet", focus: "marquee" },
      { match: /CABINET SIGN/, kind: "cabinet", set: "tv_ktp_cabinet", focus: "sign" },
      { match: /CABINET FLAP/, kind: "cabinet", set: "tv_ktp_cabinet", focus: "flap" },
      { match: /GAME FOOTAGE LEVEL ONE/, kind: "arcadegame", set: "tv_ktp_ward", ktp: "level1" },
      { match: /GAME FOOTAGE REFUSAL/, kind: "arcadegame", set: "tv_ktp_ward", ktp: "refuse" },
      { match: /GAME FOOTAGE PAYOUT/, kind: "arcadegame", set: "tv_ktp_ward", ktp: "payout" },
      { match: /GAME FOOTAGE DEMO/, kind: "arcadegame", set: "tv_ktp_ward", ktp: "demo" },
      { match: /GAME FOOTAGE ATTRACT/, kind: "arcadegame", set: "tv_ktp_ward", ktp: "attract" },
      {
        match: /HOSPITAL STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: { type: "statement", title: "HOSPITAL STATEMENT", from: "The hospital", quote: "We will undertake a comprehensive review of the standards governing entertainment available on hospital property.", color: 0x0e7490 },
      },
      {
        match: /ARTISTIC STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: { type: "statement", title: "WRITTEN STATEMENT · TUESDAY", from: "The hospital", quote: "The game is actually about corruption in the medical industry, and the player is never explicitly rewarded for killing patients, nor is it ever obligatory for them to kill patients.", color: 0x0e7490 },
      },
      {
        match: /AUTHORIZATION GRAPHIC/,
        kind: "graphic",
        set: "",
        gfx: { type: "statement", title: "PURCHASE AUTHORIZATION", from: "Signed: Martin Bell (handwritten note above the signature)", quote: "Finally! Loved the first one.", color: 0x92400e },
      },
      {
        match: /SENSOR STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: { type: "statement", title: "STATEMENT · THE SENSOR", from: "The hospital", quote: "The peripheral is not sexual in nature. It is an optional immersion device intended to enhance realism during certain routine human activities, including urination and other experiences.", color: 0x0e7490 },
      },
    ],
    ots: [
      { match: /Kill the Patient 2|sequel|arcade/i, pic: { key: "tv_ktp_cabinet", crop: [110, 0, 140, 160] }, caption: "Kill the Patient 2" },
      { match: /penis sensor|peripheral|instruction panel/i, pic: { key: "tv_ktp_cabinet", crop: [150, 175, 90, 65] }, caption: "The 'sensor'" },
      { match: /investigation|committee/i, pic: { key: "tvanchor_KTP_BELL", frame: 0, crop: [28, 4, 72, 62] }, caption: "Board investigates board" },
      { match: /explanations|scrutiny|other experiences/i, pic: { key: "tvanchor_KTP_SPOKES", frame: 0, crop: [28, 4, 72, 62] }, caption: "The hospital" },
      { match: /board members|lessons/i, pic: { key: "tv_ktp_arcade", crop: [100, 60, 120, 120] }, caption: "The hospital arcade" },
    ],
    straps: {
      "HOSPITAL SPOKESPERSON": ["Hospital spokesperson", "Monday morning"],
      "BOARD REPRESENTATIVE": ["Board representative", "The hospital"],
      ADMINISTRATOR: ["Hospital administrator", "Did not personally play it"],
      "SECOND ADMINISTRATOR": ["Hospital administrator", "Thought it was about paperwork"],
      "BOARD MEMBER": ["Hospital board member", "Voted for the sequel"],
      "REBECCA HALL": ["Rebecca Hall", "Attorney"],
      "MARTIN BELL": ["Martin Bell", "Chairman, investigating committee"],
      REPORTER: ["Reporter", "GB Krews, at the hospital"],
    },
  },

  krews_arsebrush: {
    brand: "gbk",
    ticker: [
      "PM: 'brush the inside of your arsehole'",
      "Department of Health website down for a third hour",
      "Dentists 'not consulted', says BDA",
      "#ArsebrushGate trending in 30 countries",
      "Boots: 'no plans' to stock the brush",
      "Whitty: 'research is ongoing'",
    ],
    scenes: [
      STUDIO,
      {
        match: /TEASER GRAPHIC/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "teaser",
          title: "SUNDAY NIGHT: THE TEASE",
          from: "Keir Starmer",
          handle: "@Keir_Starmer",
          post: "Tomorrow I'll be announcing one of the most significant developments in preventative health in decades. Massive. Exciting. Watch this space.",
          when: "Sunday · 21:04",
          guesses: ["NHS funding boost?", "Cancer screening?", "Free dentistry?", "New hospitals?", "Waiting lists?"],
        },
      },
      {
        match: /PRESS ROOM/,
        kind: "presser",
        set: "tv_k1_pressroom",
        main: "KEIR STARMER",
        askers: ["JOURNALIST"],
        anchors: { "KEIR STARMER": "KEIR STARMER@BRUSH" },
        flank: [["CHRIS WHITTY", 0.2], ["DR ALANA MERRICK", 0.8]],
      },
      {
        match: /DOH ERROR/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "error",
          title: "DEPARTMENT OF HEALTH WEBSITE CRASHES",
          url: "https://www.gov.uk/guidance/internal-brushing",
          code: "503",
          msg: "Service Unavailable",
          sub: "We're experiencing extremely high demand. Please do not try this at home until guidance is published.",
        },
      },
      {
        match: /BDA STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "BRITISH DENTAL ASSOCIATION",
          from: "British Dental Association",
          quote: "The Association has not been consulted, and does not endorse the Prime Minister's comments in any capacity.",
          color: 0x0e7490,
        },
      },
      { match: /WESTMINSTER/, kind: "vox", set: "tv_k4_westm", where: "Westminster" },
      { match: /COLLEGE GREEN/, kind: "vox", set: "tv_k4_westm", where: "College Green" },
      {
        match: /TRENDING/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "trend",
          title: "TRENDING NOW",
          tags: [
            { tag: "#ArsebrushGate", n: 3120000 },
            { tag: "#ColonicKeir", n: 1940000 },
            { tag: "#ResearchIsOngoing", n: 702000 },
            { tag: "#NotConsulted", n: 318000 },
          ],
          posts: ["did the Prime Minister just say that", "Whitty's face though", "what bristle strength are we talking", "my dentist has gone very quiet", "the DoH website is down lol", "'targeted internal cleansing' is going on my CV"],
        },
      },
    ],
    ots: [
      { match: /massive and exciting|breakthrough/i, pic: { key: "tvanchor_STARMER_BRUSH", frame: 4, crop: [0, 0, 100, 76] }, caption: "'Health breakthrough'" },
      { match: /research is ongoing|Whitty/i, pic: { key: "tvanchor_WHITTY", frame: 0, crop: [30, 6, 68, 60] }, caption: "'Research is ongoing'" },
      { match: /opposition|condemn/i, pic: { key: "tvanchor_BADENOCH", frame: 0, crop: [30, 6, 68, 60] }, caption: "Opposition fury" },
      { match: /later interview|stood by/i, pic: { key: "tvanchor_STARMER_BRUSH", frame: 4, crop: [0, 0, 100, 76] }, caption: "No regrets" },
    ],
    straps: {
      "KEIR STARMER": ["Keir Starmer", "Prime Minister"],
      "CHRIS WHITTY": ["Sir Chris Whitty", "Chief Medical Officer"],
      "DR ALANA MERRICK": ["Dr Alana Merrick", "Dental Health Tsar"],
      "KEMI BADENOCH": ["Kemi Badenoch", "Leader of the Conservative Party"],
      "DAISY COOPER": ["Daisy Cooper", "Liberal Democrat leader"],
      JOURNALIST: ["Journalist", "In the press pack"],
      REPORTER: ["Reporter", "GB Krews, Downing Street"],
    },
  },
};
