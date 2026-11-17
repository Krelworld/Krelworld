import type { NewsCfg } from "../TVNews";

/**
 * The Krelmon GB Krews shows (src/content/television/extra/krews4.ts). They use the desk, the press pack and the
 * krews3 story kinds (field, vox, keynote, graphic), plus what's below; NewsDirector draws it all (the "news stories
 * 4" block in TVNews.ts).
 *
 * - concert: phone footage from the crowd at a gig, SanMik doing the crocodile on stage.
 * - mob: a street crowd (bobbing heads and placards) that can turn; a hot-mic voice comes in picture-in-picture.
 * - k4look on a field: "reality" (a reality-TV clip), "high" (the same, after the jenkem) and "phone" (a viral video
 *   off someone's feed).
 * - askers: in a presser, people who ask from the pack (the reporter always does).
 * - singles: in a field, anyone with art gets a single, not only the cast in the wide.
 * - k4gfx: a withheld photo (the costume nobody is shown).
 */

export type K4Kind = "concert" | "mob";
export const K4_KINDS: ReadonlySet<string> = new Set<K4Kind>(["concert", "mob"]);

export type K4Gfx = { type: "withheld"; title: string; caption: string };

export interface K4Scene {
  askers?: string[];
  singles?: boolean;
  k4look?: "reality" | "high" | "phone";
  k4gfx?: K4Gfx;
  /** mob: what's written on the placards */
  placards?: string[];
  /** explosions shake the picture here */
  boom?: boolean;
}

const STUDIO = { match: /NEWSDESK/, kind: "desk" as const, set: "tv_gbk_studio" };
const NO10 = { match: /DOWNING STREET/, kind: "presser" as const, set: "tv_no10_door" };
const STARMER = { key: "tvanchor_STARMER", frame: 0, crop: [30, 2, 68, 60] as [number, number, number, number] };
const WALLACE = { key: "tv_k4_wallace", crop: [20, 0, 88, 66] as [number, number, number, number] };
const CRONSTER = { key: "tv_k4_cronster", crop: [8, 8, 72, 60] as [number, number, number, number] };
const BUNNY = { key: "tvanchor_K4_BUNNY", frame: 0, crop: [20, 0, 88, 70] as [number, number, number, number] };
const SANMIK = { key: "talk_SANMIK", frame: 0 };
const KART = { key: "tv_k4_tate_kart", crop: [10, 20, 108, 90] as [number, number, number, number] };
const GORDON = { key: "tvanchor_K4_GORDON", frame: 0, crop: [24, 0, 80, 70] as [number, number, number, number] };

export const KREWS4_NEWS: Record<string, NewsCfg> = {
  krews_wallace: {
    brand: "gbk",
    ticker: [
      "Wallace 'donated trousers to the starving', says PM",
      "Number 10 confirms Greg has sons called Willy and Penis",
      "Sky News correspondent 'sore, but filing'",
      "Minister for Banter and Pulses: 'no plans to resign'",
      "Eton Mess sales 'down sharply'",
    ],
    scenes: [STUDIO, { ...NO10, askers: ["JOURNALIST"] }],
    ots: [
      { match: /Greg Wallace scandal|MasterChef|trousers/i, pic: WALLACE, caption: "Greg Wallace" },
      { match: /noble|press conference|defence/i, pic: STARMER, caption: "'A misunderstanding'" },
      { match: /brick|Sky News|Number 10/i, pic: { key: "tv_no10_door", crop: [100, 10, 120, 150] }, caption: "Downing Street" },
      { match: /Banter and Pulses/i, pic: WALLACE, caption: "Banter and Pulses" },
    ],
    straps: {
      "KEIR STARMER": ["Keir Starmer", "Prime Minister"],
      JOURNALIST: ["Journalist", "The Times"],
      REPORTER: ["Journalist", "Channel 4 News"],
    },
  },

  krews_cronster: {
    brand: "gbk",
    ticker: [
      "The Cuddle Cronster: 'I am not a monster'",
      "Starmer: Cronster 'a much more sympathetic character'",
      "'Cronny's Juice Bunnies' warned to stay away",
      "Government backs 'a new type of McDonald's'",
      "Woman police: 'not yet', confirms Number 10",
    ],
    scenes: [
      STUDIO,
      {
        match: /CRONSTER STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "STATEMENT · THE CUDDLE CRONSTER",
          from: "The Cuddle Cronster, via his representatives",
          quote: "I want the public to understand that I am not a monster. I am a person with invisible disabilities who has struggled with chronic pain and neurological differences my entire life.",
          color: 0xdb2777,
        },
      },
      { match: /LABOUR HQ PRESS/, kind: "presser", set: "tv_labour_press" },
      { match: /ADVOCACY/, kind: "vox", set: "tv_expert_study", anchors: { "ADVOCACY SPOKESPERSON": "DR ELAINE ROBERTS" } },
      { match: /WESTMINSTER/, kind: "vox", set: "tv_k4_westm", where: "Westminster" },
      { match: /CORRIDOR/, kind: "vox", set: "tv_labour_hq_night", look: "silhouette", anchors: { "LABOUR BACKBENCHER": "VOTER 1" } },
    ],
    ots: [
      { match: /Juice Bunnies/i, pic: BUNNY, caption: "'Cronny's Juice Bunnies'" },
      { match: /McDonald|fast-food|burgers/i, pic: { key: "tv_krelburger", crop: [40, 0, 200, 140] }, caption: "'New McDonald's'" },
      { match: /Starmer|Downing Street/i, pic: STARMER, caption: "Starmer on the Cronster" },
      { match: /Cronster|fibromyalgia/i, pic: CRONSTER, caption: "The Cuddle Cronster" },
      { match: /condemnation|furious|out of touch/i, pic: STARMER, caption: "Backlash" },
    ],
    straps: {
      "KEIR STARMER": ["Sir Keir Starmer", "Leader of the Labour Party"],
      "ADVOCACY SPOKESPERSON": ["Spokesperson", "Disability advocacy group"],
      "JUICE BUNNY": ["'Cronny's Juice Bunny'", "Supporter of the Cronster"],
      "LABOUR BACKBENCHER": ["Labour backbencher", "Speaking anonymously"],
      REPORTER: ["Reporter", "GB Krews, Westminster"],
    },
  },

  krews_sanmik_crocs: {
    brand: "gbk",
    ticker: [
      "MoD: tank fire 'rapid, proportionate and unavoidable'",
      "Four crocodiles 'neutralised'",
      "62 killed in McDonald's 'intervention'",
      "PM: McDonald's to be rebuilt 'immediately'",
      "SanMik has not commented",
    ],
    scenes: [
      STUDIO,
      { match: /SANMIK CONCERT/, kind: "concert", set: "tv_k4_concert", where: "SanMik live" },
      { match: /RUINS/, kind: "vox", set: "tv_k4_ruins", where: "The scene of the McDonald's", anchors: { WITNESS: "WOMAN" }, boom: true },
      {
        match: /MOD STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "MINISTRY OF DEFENCE STATEMENT",
          from: "Ministry of Defence",
          quote: "The crocodiles have been neutralised and the wider public has been protected. Their sacrifice will not be forgotten.",
          color: 0x1e3a8a,
        },
      },
      NO10,
    ],
    ots: [
      { match: /Armed Forces have been|Ministry of Defence/i, pic: { key: "tvanchor_K4_MILITARY", frame: 0, crop: [20, 0, 88, 70] }, caption: "'Necessary intervention'" },
      { match: /statement/i, pic: { key: "tv_k4_ruins", crop: [40, 20, 240, 170] }, caption: "The McDonald's" },
      { match: /praising|Prime Minister/i, pic: STARMER, caption: "PM praises Armed Forces" },
      { match: /SanMik/i, pic: SANMIK, caption: "SanMik" },
    ],
    straps: {
      "MILITARY SPOKESPERSON": ["Senior military spokesperson", "British Army"],
      WITNESS: ["Witness", "Lives nearby"],
      "KEIR STARMER": ["Sir Keir Starmer", "Prime Minister"],
      REPORTER: ["Reporter", "GB Krews, at the scene"],
    },
  },

  krews_bradford: {
    brand: "gbk",
    ticker: [
      "Bradford to be UK capital; Parliament to move 'over ten years'",
      "Cost: 'a significant sum'",
      "Further details 'someday'",
      "'Bradford tower' expecting visitors",
      "London 'fine about it', reportedly",
    ],
    scenes: [
      STUDIO,
      {
        match: /GOVERNMENT STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "HM GOVERNMENT · THE NEW CAPITAL",
          from: "HM Government",
          quote: "In recognition of Muslim contributions to British life such as 'Muslim curry' and other such things, with which we are so familiar I don't even need to say them.",
          color: 0x0b2a5c,
        },
      },
      { match: /BRADFORD/, kind: "vox", set: "tv_k4_bradford", where: "Bradford · the new capital" },
    ],
    ots: [{ match: /Bradford|capital|cost|someday/i, pic: { key: "tv_k4_bradford", crop: [40, 0, 220, 160] }, caption: "Bradford" }],
    straps: { REPORTER: ["Reporter", "GB Krews, Bradford"] },
  },

  krews_harumpis: {
    brand: "gbk",
    ticker: [
      "President Kamold Harumpis sworn in; nobody notices",
      "PM: 'I'm not the same person I was three days ago'",
      "Bag of cash 'handed in to lost property'",
      "Hot mic: 'Bribe money!'",
      "Downing Street Halloween party 'under review'",
    ],
    scenes: [
      STUDIO,
      { match: /COSTUME PHOTO/, kind: "graphic", set: "", k4gfx: { type: "withheld", title: "THE DOWNING STREET HALLOWEEN PARTY", caption: "IMAGE WITHHELD BY GB KREWS" } },
      { match: /HOT MIC/, kind: "field", set: "tv_labour_hq_night", look: "hotmic", cast: [["KEIR STARMER", 0.5]], anchors: { "KEIR STARMER": "KEIR STARMER@BUS" } },
      { match: /LABOUR HQ PRESS/, kind: "presser", set: "tv_labour_press" },
    ],
    ots: [
      { match: /Hybrid Presidency|Harumpis|Kamala/i, pic: { key: "tv_k4_harumpis", crop: [24, 0, 80, 70] }, caption: "President Kamold Harumpis" },
      { match: /scandal|Prime Minister|blunders/i, pic: STARMER, caption: "The Halloween scandal" },
      { match: /gasped/i, pic: STARMER, caption: "Hot mic" },
    ],
    straps: {
      "KEIR STARMER": ["Sir Keir Starmer", "Prime Minister"],
      REPORTER: ["Reporter", "GB Krews"],
    },
  },

  krews_mario_tate: {
    brand: "gbk",
    ticker: [
      "Andrew Tate confirmed for Mario Kart World",
      "Pre-order bonus: an orange Bugatti that 'kills other players'",
      "Bowser 'considering his position'",
      "Nintendo: 'something fresh'",
      "Parents 'absolutely bemused'",
    ],
    scenes: [
      STUDIO,
      {
        match: /NINTENDO DIRECT/,
        kind: "keynote",
        set: "tv_k4_direct",
        where: "Nintendo Direct",
        cast: [["NINTENDO SPOKESPERSON", 0.5]],
        screen: [0.31, 0.375, 0.43, 0.32],
        slides: [
          { match: /joining the roster/i, title: "NEW CHALLENGER!", sub: "ANDREW TATE · MARIO KART WORLD", art: "img", img: "tv_k4_tate_kart" },
          { match: /bowser|bad guys/i, title: "COLOURFUL BAD GUYS", sub: "BOWSER · ANDREW TATE · ALL THE OTHER ONES", art: "img", img: "tv_k4_tate_kart" },
          { match: /unique energy|fresh/i, title: "UNIQUE ENERGY", sub: "SOMETHING FRESH FOR MARIO KART WORLD", art: "img", img: "tv_k4_tate_kart" },
          { match: /run other players over/i, title: "RUN THEM OVER", sub: "VIOLENTLY · AND KILL THEM", art: "img", img: "tv_k4_tate_kart" },
          { match: /pre-order|bugatti/i, title: "PRE-ORDER BONUS", sub: "TATE'S ORANGE BUGATTI KART", art: "img", img: "tv_k4_tate_kart" },
        ],
      },
      {
        match: /TRENDING/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "trend",
          title: "TRENDING NOW",
          tags: [
            { tag: "#MarioKartWorld", n: 3120000 },
            { tag: "#TateKart", n: 1840000 },
            { tag: "#BoycottNintendo", n: 960000 },
            { tag: "#BowserDeservesBetter", n: 410000 },
          ],
          posts: ["absolutely bemusing", "so Bowser's the GOOD one now?", "I pre-ordered before I read the article", "Nintendo used to be for families", "the Bugatti just ran me over in the menu"],
        },
      },
    ],
    ots: [
      { match: /Nintendo|Mario Kart|Tate/i, pic: KART, caption: "Mario Kart World" },
      { match: /unsettling|doubled down/i, pic: KART, caption: "The Bugatti" },
    ],
    straps: { "NINTENDO SPOKESPERSON": ["Nintendo spokesperson", "Nintendo Direct"] },
  },

  krews_jenkem: {
    brand: "gbk",
    ticker: [
      "Ramsay: jenkem 'like a fermented truffle'",
      "Kitchen staff 'giggling uncontrollably'",
      "Customer waits two hours, table overturned",
      "Environmental Health 'on their way'",
      "Chef Mick: 'it'll change your life'",
    ],
    scenes: [
      STUDIO,
      { match: /KITCHEN PASS/, kind: "field", set: "tv_k4_kitchen", k4look: "reality", cast: [["GORDON RAMSAY", 0.3], ["CHEF MICK", 0.72]] },
      { match: /VEG STATION/, kind: "field", set: "tv_k4_kitchen", k4look: "reality", cast: [["GORDON RAMSAY", 0.3], ["CHEF LUCY", 0.72]] },
      { match: /KITCHEN CORNER/, kind: "field", set: "tv_k4_kitchen", k4look: "reality", cast: [["CHEF MICK", 0.3], ["CHEF DAVE", 0.72]] },
      { match: /JENKEM POT/, kind: "field", set: "tv_k4_kitchen", k4look: "reality", cast: [["GORDON RAMSAY", 0.3], ["CHEF MICK", 0.72]] },
      { match: /KITCHEN LATER/, kind: "field", set: "tv_k4_kitchen", k4look: "high", cast: [["CHEF LUCY", 0.22], ["CHEF DAVE", 0.5], ["CHEF MICK", 0.78]] },
      { match: /DINING ROOM/, kind: "field", set: "tv_ee_vic", k4look: "high", cast: [["GORDON RAMSAY", 0.3], ["CUSTOMER 2", 0.72]], anchors: { "CUSTOMER 2": "MARGARET THOMPSON" } },
    ],
    ots: [
      { match: /Kitchen Nightmares|Gordon Ramsay/i, pic: GORDON, caption: "Kitchen Nightmares" },
      { match: /inspection|restaurant/i, pic: { key: "tv_k4_kitchen", crop: [180, 60, 140, 110] }, caption: "The jenkem pot" },
    ],
    straps: {
      "GORDON RAMSAY": ["Gordon Ramsay", "Kitchen Nightmares"],
      "CHEF MICK": ["Chef Mick", "Head chef"],
      "CHEF LUCY": ["Chef Lucy", "Sous chef"],
      "CHEF DAVE": ["Chef Dave", "Line cook"],
      "CUSTOMER 2": ["Customer", "Waiting two hours"],
    },
  },

  krews_boulder: {
    brand: "gbk",
    ticker: [
      "'Boulder prank': police urge hikers to look up",
      "Prankster 'just said woah'",
      "Boulder, Colorado: trail closed",
      "Wildlife 'also targeted'",
      "Experts: 'it isn't a prank'",
    ],
    scenes: [STUDIO, { match: /BOULDER TRAIL/, kind: "field", set: "tv_k4_trail", k4look: "phone", cast: [] }],
    ots: [
      { match: /new "prank"|Boulder trail/i, pic: { key: "tv_k4_boulder" }, caption: "The 'Boulder prank'" },
      { match: /woah|funny|pranks/i, pic: { key: "tv_k4_trail", crop: [120, 0, 200, 150] }, caption: "'WOAH!'" },
    ],
  },

  krews_justice: {
    brand: "gbk",
    ticker: [
      "£900m criminal justice reform unveiled",
      "Funded by 'whoever will give us money quickly'",
      "Policy drawn up over 'multiple pitchers of Strongbow Dark Fruits'",
      "Current to run 'up to one week after death'",
      "PM: '0.01% chance' they come back",
    ],
    scenes: [
      STUDIO,
      {
        match: /FUNDING STATEMENT/,
        kind: "graphic",
        set: "",
        gfx: { type: "statement", title: "THE £900 MILLION · WHERE IT'S COMING FROM", from: "HM Treasury", quote: "High-interest emergency loans from whoever will give us money quickly.", color: 0x15803d },
      },
      { match: /WETHERSPOONS/, kind: "vox", set: "tv_ee_vic", where: "The Wetherspoons Cabinet" },
      {
        match: /POLICY DOCUMENT/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "statement",
          title: "LEAKED · GOVERNMENT POLICY DOCUMENT",
          from: "The Wetherspoons Cabinet · Policy Paper No. 1",
          quote: "A highly electrified length of barbed wire being inserted into the urethra of each offender. Current to continue for up to one week after death.",
          color: 0x7f1d1d,
        },
      },
      NO10,
    ],
    ots: [
      { match: /flagship|£900/i, pic: STARMER, caption: "Criminal justice reform" },
      { match: /Strongbow|Wetherspoons/i, pic: { key: "tv_ee_vic", crop: [40, 20, 220, 160] }, caption: "The Wetherspoons Cabinet" },
      { match: /post-mortem|Prime Minister/i, pic: STARMER, caption: "'Absolutely sure'" },
    ],
    straps: { "KEIR STARMER": ["Keir Starmer", "Prime Minister"], REPORTER: ["Reporter", "GB Krews, Downing Street"] },
  },

  krews_descent: {
    brand: "gbk",
    ticker: [
      "Markets hit all-time highs",
      "Cabinet 'too afraid to oppose him'",
      "Crowds gather in Whitehall",
      "Hot mic: 'pleasure'",
      "Downing Street stormed",
    ],
    scenes: [
      STUDIO,
      {
        match: /CABINET ROOM/,
        kind: "field",
        set: "tv_k4_cabinet",
        look: "secret",
        cast: [["KEIR STARMER", 0.5]],
        singles: true,
        anchors: { "INDUSTRY EXPERT 2": "EXECUTIVE", "INDUSTRY EXPERT 3": "DR ELAINE ROBERTS" },
      },
      {
        match: /MARKETS GRAPHIC/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "poll",
          title: "MARKETS · ALL-TIME HIGHS",
          sub: "The day after the Cabinet meeting",
          bars: [
            { label: "FTSE 100", from: 12, to: 66, color: 0x16a34a },
            { label: "FTSE 250", from: 10, to: 61, color: 0x22c55e },
            { label: "DOW", from: 15, to: 58, color: 0x4ade80 },
            { label: "NIKKEI", from: 14, to: 55, color: 0x86efac },
          ],
        },
      },
      {
        match: /WHITEHALL CROWD/,
        kind: "mob",
        set: "tv_k4_whitehall",
        where: "Whitehall",
        placards: ["YES!", "YEEEESSSS!", "FTSE UP!", "BUY BUY BUY", "YES!!!", "RECORD HIGHS"],
        anchors: { "CROWD MEMBER 1": "VOTER 1", "CROWD MEMBER 2": "WOMAN", "KEIR STARMER": "KEIR STARMER@THRONE" },
      },
      { match: /PRIME MINISTER'S OFFICE/, kind: "field", set: "tv_k4_office", look: "secret", cast: [["KEIR STARMER", 0.5]], anchors: { "KEIR STARMER": "KEIR STARMER@THRONE" } },
    ],
    ots: [
      { match: /cabinet meeting|footage/i, pic: { key: "tv_k4_cabinet", crop: [60, 40, 200, 150] }, caption: "The Cabinet Room" },
      { match: /Downing Street|stormed/i, pic: { key: "tv_k4_whitehall", crop: [40, 60, 220, 170] }, caption: "Downing Street" },
      { match: /stock market/i, pic: { key: "tv_k4_whitehall", crop: [190, 50, 130, 80] }, caption: "The markets" },
    ],
    straps: {
      "KEIR STARMER": ["Keir Starmer", "Prime Minister"],
      "INDUSTRY EXPERT 1": ["Industry expert", "The City"],
      "INDUSTRY EXPERT 2": ["Industry expert", "Technology"],
      "INDUSTRY EXPERT 3": ["Industry expert", "Economist"],
      "CABINET MINISTER 1": ["Cabinet minister", "Secret footage"],
      "CABINET MINISTER 2": ["Cabinet minister", "Secret footage"],
      "CABINET MINISTER 3": ["Cabinet minister", "Secret footage"],
      "CROWD MEMBER 1": ["In the crowd", "Whitehall"],
      "CROWD MEMBER 2": ["In the crowd", "Whitehall"],
    },
  },
};
