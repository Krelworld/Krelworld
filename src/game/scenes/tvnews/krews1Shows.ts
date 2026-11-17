import type { NewsCfg, SceneDef } from "../TVNews";

/**
 * The first GB Krews shows (src/content/television/extra/krews.ts, krews2.ts) and the Krelford News at Six
 * (channels.ts), moved off the old plain stage (64px sprites in front of a set) onto the news presentation the later
 * shows use: the ident, the studio and its anchor, straps and ticker, the press pack, the reporter on location and
 * vox singles. Their guests are in krews1Cast.ts; the tickers are lines from the bulletins themselves.
 */

const STUDIO: SceneDef = { match: /NEWSDESK/, kind: "desk", set: "tv_gbk_studio" };
const PRESS = (main?: string): SceneDef => ({ match: /PRESS ROOM/, kind: "presser", set: "tv_k1_pressroom", ...(main ? { main } : {}) });
const HIGH_STREET: SceneDef = { match: /HIGH STREET/, kind: "vox", set: "tv_highstreet" };
const STADIUM: SceneDef = { match: /STADIUM/, kind: "vox", set: "tv_k1_stadium" };

/** Noam Chomsky's close-up (tvface_CHW_CHOMSKY, drawn for Chomworld), head and shoulders, for the OTS box. */
const CHOMSKY = (frame: number) => ({ key: "tvface_CHW_CHOMSKY", frame, crop: [22, 2, 84, 70] as [number, number, number, number] });

const DESK_ONLY = (ticker: string[]): NewsCfg => ({ brand: "gbk", ticker, scenes: [STUDIO], ots: [] });

export const KREWS1_NEWS: Record<string, NewsCfg> = {
  // ---- Krelford News at Six
  news_1: DESK_ONLY([
    "Supreme Leader's new song seen by nine people",
    "The word TOWN has fallen off the Town Hall",
    "Pigeon seen wearing the word TOWN",
    "The Great Tap has stopped",
    "Weather: grey, with a chance of citation-needed tags",
  ]),
  news_2: {
    brand: "gbk",
    ticker: [
      "The Tap is flowing again",
      "Lil' Crongus denies responsibility for 'the salmon thing'",
      "Cheesegate: investigators unable to locate any cheese",
      "Krelball cancelled until lore resumes",
    ],
    scenes: [STUDIO, { match: /POLSON TOWERS/, kind: "vox", set: "tv_k1_polson", where: "Polson Towers" }],
    ots: [{ match: /Polson Towers/i, pic: { key: "tv_k1_polson", crop: [60, 20, 200, 150] }, caption: "Polson Towers" }],
    straps: { REPORTER: ["Reporter", "GB Krews, at Polson Towers"] },
  },
  news_3: DESK_ONLY([
    "Ministry of Boner Control has gone dark",
    "Pussy juice pressure down forty percent",
    "Melon man 'stable, and embarrassed'",
    "Threat level today: purple",
  ]),
  news_4: DESK_ONLY([
    "Flenky Jenky banned again, this time from a ban",
    "Flenky Jenky statement in full: 'pls'",
    "The Ban Tribunal has opened",
    "Krezzcanoe dig: 'Pompeii, but worse'",
  ]),
  news_5: DESK_ONLY([
    "Krezteua d'If has reopened",
    "Three boats moored in the same space; one has a moustache",
    "Krebon: 'I'm right here'",
    "'Krebon — real butter' menu declared a site of national prophetic significance",
  ]),

  // ---- GB Krews (krews.ts)
  krews_pele: {
    brand: "gbk",
    ticker: ["Pelé estate statement", "Pelé's assets 'belong to Bitcoin, and Bitcoin alone'", "Bitcoin is up four percent"],
    scenes: [STUDIO, PRESS()],
    ots: [{ match: /spokesperson/i, pic: { key: "tvanchor_K1_ESTATE", frame: 0, crop: [24, 0, 80, 70] }, caption: "The estate of Pelé" }],
    straps: { "ESTATE SPOKESPERSON": ["Spokesperson", "For the estate of Pelé"] },
  },
  krews_chancellor: {
    brand: "gbk",
    ticker: ["The Chancellor's video has sent shockwaves through the UK", "'The Chancellor should be ashamed of himself'", "Chancellor: 'just shut up and leave me alone'"],
    scenes: [STUDIO, PRESS()],
    ots: [{ match: /video/i, pic: { key: "tvanchor_K1_CHANCELLOR", frame: 0, crop: [24, 0, 80, 70] }, caption: "The Chancellor's video" }],
    straps: { CHANCELLOR: ["The Chancellor", "Chancellor of the Exchequer"] },
    deskReporter: { set: "tv_highstreet", where: "REACTION · LIVE", live: "Krelford High Street" },
  },
  krews_telly: {
    brand: "gbk",
    ticker: ["Treasury replaced by the Department of Telly", "Three televisions in every room", "'Battle of the Morons': weekly prize of £50 billion", "You're watching it either way"],
    scenes: [STUDIO, HIGH_STREET],
    ots: [],
  },
  krews_antarctica: {
    brand: "gbk",
    ticker: ["Government announces plan to nuke Antarctica", "Scheme expected to cost £2 billion", "Antarctica 2 'will cheer everyone up'", "Volunteers: contact your local MP"],
    scenes: [STUDIO, { match: /ANTARCTICA/, kind: "vox", set: "tv_k1_antarctica", where: "Antarctica" }, PRESS()],
    ots: [{ match: /nuke|nuclear/i, pic: { key: "tv_k1_antarctica", crop: [60, 20, 200, 150] }, caption: "Antarctica" }],
    straps: {
      "DR. JAMESON": ["Dr. Jameson", "Scientist"],
      "JEREMY CORBYN": ["Jeremy Corbyn", "Minister for Distractions"],
    },
  },
  krews_cookie: {
    brand: "gbk",
    ticker: ["Cookie Monster releases a statement", "Statement released from a children's television studio"],
    scenes: [STUDIO, { match: /CHILDREN'S TV STUDIO/, kind: "field", set: "tv_k1_kids", cast: [["COOKIE MONSTER", 0.5]] }],
    ots: [],
    straps: { "COOKIE MONSTER": ["Cookie Monster", "A statement"] },
  },
  krews_moneybags: {
    brand: "gbk",
    ticker: ["'Moneybags' trial ends with not guilty verdict", "Judge cites 'strong gut feeling'", "CCTV of the bribe included the dialogue 'this is a bribe'", "Judge Krelmor: 'No comment'"],
    scenes: [
      STUDIO,
      { match: /COURTROOM/, kind: "vox", set: "tv_k1_courtroom", where: "Krelford Crown Court" },
      { match: /HIGH STREET/, kind: "vox", set: "tv_highstreet", where: "Outside the court" },
    ],
    ots: [{ match: /Judge Dalton B\. Krelmor|overturned/i, pic: { key: "tvanchor_K1_KRELMOR", frame: 0, crop: [24, 0, 80, 70] }, caption: "Judge Dalton B. Krelmor" }],
    straps: {
      "JUDGE KRELMOR": ["Judge Dalton B. Krelmor", "Presiding judge"],
      "BARRY SNODGRASS": ["Barry Snodgrass", "Krendy's attorney"],
    },
  },
  krews_universe: {
    brand: "gbk",
    ticker: ["Our universe has collided with the Super Smash Bros universe", "Also with a third 'sex themed' universe", "The three universes have now become one"],
    scenes: [STUDIO, { match: /MERGED UNIVERSE/, kind: "vox", set: "tv_k1_multiverse", where: "The merged universe" }],
    ots: [],
  },

  // ---- GB Krews (krews2.ts)
  krews_chomsky_sharks: {
    brand: "gbk",
    ticker: ["Professor Noam Chomsky dies on shark-watching trip", "Hospice staff 'lost their grip'"],
    scenes: [STUDIO, HIGH_STREET],
    ots: [{ match: /Chomsky/i, pic: CHOMSKY(0), caption: "Prof. Noam Chomsky" }],
  },
  krews_chomsky_brain: {
    brand: "gbk",
    ticker: ["Chomsky's brain stolen", "National lockdown imposed", "Chomsky 'may have had three brains'"],
    scenes: [STUDIO, { ...HIGH_STREET, look: "silhouette", anchors: { OFFICIAL: "VOTER 1" } }],
    ots: [{ match: /brain/i, pic: CHOMSKY(2), caption: "Chomsky's brain: missing" }],
    straps: { OFFICIAL: ["Government source", "Identity withheld"] },
  },
  krews_chomsky_triad: {
    brand: "gbk",
    ticker: ["Chomsky plans 'polyamorous triad' in the afterlife", "'Intelligent humans have evolved past monogamy'", "Interview paused several times for belt reasons"],
    scenes: [STUDIO, HIGH_STREET],
    ots: [{ match: /Chomsky/i, pic: CHOMSKY(6), caption: "Noam Chomsky" }],
  },
  krews_chomsky_website: {
    brand: "gbk",
    ticker: ["$500 billion Chomsky brain map yields a single phrase", "'web site... new web site.'", "Our website is also new"],
    scenes: [STUDIO, { match: /ARCHIVE/, kind: "vox", set: "tv_k1_brainlab" }],
    ots: [{ match: /Chomsky|web ?site/i, pic: CHOMSKY(1), caption: "'web site... new web site.'" }],
  },
  krews_carter: {
    brand: "gbk",
    ticker: ["Jimmy Carter 'probably dead'", "Family plans to bury him alive if he's still alive during next visit", "'Just another example of his playful wit'"],
    scenes: [STUDIO, HIGH_STREET],
    ots: [],
  },
  krews_spoons_cabinet: {
    brand: "gbk",
    ticker: ["Starmer unveils 'revolutionary' Wetherspoons cabinet", "£900 million criminal justice overhaul", "PM belches twice during announcement"],
    scenes: [STUDIO, { match: /QUEEN VIC/, kind: "vox", set: "tv_ee_vic", where: "The Lord Moon of the Mall" }, PRESS("KEIR STARMER")],
    ots: [{ match: /Keir Starmer|Starmer/i, pic: { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] }, caption: "The Wetherspoons Cabinet" }],
    straps: { "KEIR STARMER": ["Keir Starmer", "Prime Minister"] },
  },
  krews_krenshaw: {
    brand: "gbk",
    ticker: ["Markets rally on £20 billion 'random public investment'", "'Buy low, sell high!'", "Mascot 'Lombar' secretes money milk"],
    scenes: [STUDIO, PRESS("KEIR STARMER")],
    ots: [{ match: /Starmer/i, pic: { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] }, caption: "The 'Krenshaw' budget" }],
    straps: { "KEIR STARMER": ["Keir Starmer", "Prime Minister"], EXECUTIVE: ["Senior analyst", "The markets"] },
  },
  krews_fifa_audience: {
    brand: "gbk",
    ticker: ["Games review: 'FIFA: Audience'", "Coin, disdain, and a 'wanted' level", "'More like a crime simulator'"],
    scenes: [{ ...STUDIO, anchors: { OFFICIAL: "CABINET MINISTER 1" } }, STADIUM],
    ots: [],
    straps: { OFFICIAL: ["FIFA spokesperson", "International football's governing body"] },
  },
  krews_roboref: {
    brand: "gbk",
    ticker: ["Euro 2024: robot referee goes rogue", "ARBITRO-9000 'robo-farts'", "It has also just farted"],
    scenes: [STUDIO, STADIUM],
    ots: [],
  },
};
