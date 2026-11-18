import type { Line } from "../data/types";
import { dir, say } from "./dsl";

// THE FINALE, PART B: back in Krelford after Da Drongus Dungeon falls. THE CONCEPT OF PAEDOPHILIA.
// The monster only ever speaks in clinical, definitional language (diagnostic-manual and encyclopaedia phrasing).
// It never says anything else. That's the joke, and that's the line.

/** The monster's speaker id (its portrait is made from the side-on art). */
export const CONCEPT = "THE CONCEPT OF PAEDOPHILIA";
const c = (t: string): Line => say(CONCEPT, t, { sfx: "roar" });

// ---------------------------------------------------------------- the wreck heap

export const FB_LANDED: Line[] = [
  dir("Krelford. Night. Rain. Where Da Drongus Dungeon stood an hour ago: a mountain of smoking wreckage the size of a small county."),
  dir("At the bottom of it, one by one, the Krelworld Krew skid to a stop on slabs of masonry, like the world's worst ski holiday."),
];

export const FB_CELEBRATE: Line[] = [
  say("KREZMAR", "WE DID IT. WE ACTUALLY FUCKING DID IT."),
  say("SCROMBUS", "His head EXPLODED. His whole head! Off!"),
  say("GRONNY", "Me surf on wall. Best day of me life."),
  say("KREBLIS", "Breaking news… Drongus is dead 👍"),
  say("FLENKY", "Did everyone see my landing? Nobody saw my landing."),
  say("KREBON", "Is this a crime scene? Feels like a crime scene. I'm on probation."),
  say("CRONGUS", "Lads. LADS. Think about what this means."),
  say("MIKEY", "Does it mean I'm in the group now?"),
  say("KREZWONK", "It means… oh my god. We can now delete the chat logs."),
  dir("Silence. Then the loudest cheer Krelford has ever heard. Somebody starts a conga. It goes once round the wreckage and falls apart."),
  { s: "YOU", t: "OH MY GOD. WE CAN NOW DELETE THE CHAT LOGS.", tag: "new" },
];

export const FB_SILENCE: Line[] = [
  dir("…and then it's quiet. Just the rain. Thunder rolling round the ruins. Somewhere, a car alarm gives up."),
  say("KREZMAR", "He chucked them off the roof. The logs. They landed in town somewhere."),
  say("KREZWONK", "I saw it. A green glow, over that way. Go and get them. We'll be right behind you."),
  say("SCROMBUS", "Then we smash them. Then we burn the bits. Then we bury the ash."),
  say("KREBON", "Then we turn the internet off."),
  say("KREZMAR", "Krebon. Not now."),
];

export const FB_FOUND_LOGS: Line[] = [
  dir("There they are. In a puddle, glowing a sickly green: THE CHAT LOGS. Every message. Every song nobody reacted to. Every pudding."),
  say("CRONGUS", "Pick them up. Quick. Before anything—"),
];

export const FB_RUMBLE: Line[] = [
  dir("The ground shudders. The puddles ripple. Up the hill, the wreck heap… moves."),
  say("MIKEY", "…did anyone else feel that?"),
  say("KREBLIS", "Surely not."),
  say("SCROMBUS", "Surely NOT."),
  say("FLENKY", "Surely not, surely not, surely not."),
  say("GRONNY", "Surely… not?"),
  say("KREZMAR", "Lads. Don't say it. Don't anyone say 'final form'."),
];

// ---------------------------------------------------------------- the emergence (side-on)

export const FB_EMERGE_PANIC: Line[] = [
  say("MIKEY", "AAAAAAAAAAAAAAAAAAAAAAAA"),
  say("KREZMAR", "LIKE WHAT THE FUCK IS THAT CUNT"),
  say("SCROMBUS", "IT'S GOT ARMS. IT'S GOT SO MANY ARMS."),
  say("FLENKY", "Is that… is there a man behind it? When the lightning goes?"),
  say("KREZWONK", "A wizard. A dark wizard. I've seen that silhouette before."),
];

export const FB_TITLE_REACT: Line[] = [
  say("KREBLIS", "The concept of—"),
  say("CRONGUS", "The concept of—"),
  say("GRONNY", "The conc—"),
];

export const FB_DEFINITION: Line[] = [
  c("Paedophilia (also spelled pedophilia) is defined as a primary or exclusive sexual attraction by an adult or older adolescent (generally age 16 or older) toward prepubescent children (typically age 13 or younger)."),
];

export const FB_DEFIANT: Line[] = [
  dir("A long, horrified silence. Rain hisses on its hide."),
  say("KREZMAR", "Right. No. Absolutely not. Not in Krelford."),
  say("KREZWONK", "We need to destroy the concept of paedophilia once and for all!"),
  say("SCROMBUS", "It's the only way to prevent the group chat logs being leaked!"),
  say("FLENKY", "I don't fully follow the logic but I've never been more up for something in my life."),
  { s: "YOU", t: "EVERYONE. OPEN. FIRE.", tag: "new" },
];

// ---------------------------------------------------------------- the fight

export const FB_ARENA: Line[] = [
  dir("THE CONCEPT OF PAEDOPHILIA. It fills half of what's left of Krelford. Every lightning strike shows the wizard behind it."),
  dir("Shoot it. The lads will shoot it too. Dodge everything."),
];

/** Its occasional lines: clinical and definitional only. */
export const CONCEPT_BARKS = [
  "DSM-5: PEDOPHILIC DISORDER.",
  "ICD-11 CODE 6D32.",
  "CLASSIFIED AS A PARAPHILIA.",
  "CRITERION A: A DURATION OF AT LEAST SIX MONTHS.",
  "CRITERION C: AT LEAST 16 YEARS OF AGE.",
  "…AND AT LEAST FIVE YEARS OLDER THAN THE CHILD.",
  "SPECIFY WHETHER: EXCLUSIVE TYPE. NONEXCLUSIVE TYPE.",
  "PREVALENCE IN THE GENERAL POPULATION: UNKNOWN.",
  "FROM THE GREEK: PAIS, PAIDOS. 'CHILD.'",
  "SEE ALSO: CHRONOPHILIA.",
  "DIFFERENTIAL DIAGNOSIS REQUIRED.",
  "THIS ARTICLE IS ABOUT THE PSYCHIATRIC DIAGNOSIS.",
  "[CITATION NEEDED]",
  "ONSET TYPICALLY IN ADOLESCENCE.",
  "AETIOLOGY: NOT FULLY UNDERSTOOD.",
  "CRITERION B: MARKED DISTRESS OR INTERPERSONAL DIFFICULTY.",
  "ICD-10 CODE F65.4.",
  "TERM FIRST USED BY RICHARD VON KRAFFT-EBING, 1886.",
  "SEE: PSYCHOPATHIA SEXUALIS.",
  "FROM THE GREEK: PHILIA. 'FRIENDLY LOVE.'",
  "DISTINCT FROM HEBEPHILIA AND EPHEBOPHILIA.",
  "NOT TO BE CONFUSED WITH CHILD SEXUAL ABUSE.",
  "MAIN ARTICLE: PARAPHILIA.",
  "COMORBIDITY WITH OTHER PARAPHILIAS IS COMMON.",
  "DIAGNOSED MORE OFTEN IN MALES.",
  "ASSESSMENT: PENILE PLETHYSMOGRAPHY.",
  "NEUROIMAGING FINDINGS: INCONSISTENT.",
  "RECIDIVISM RATES VARY BETWEEN STUDIES.",
  "TREATMENT: COGNITIVE BEHAVIOURAL THERAPY.",
  "TREATMENT: ANTIANDROGEN MEDICATION.",
  "SEE ALSO: CHEMICAL CASTRATION.",
  "PREVENTION PROJECT DUNKELFELD. BERLIN, 2005.",
  "SECTION: SOCIETY AND CULTURE.",
  "SECTION: PSYCHOLOGICAL AND NEUROLOGICAL CORRELATES.",
  "THIS ARTICLE HAS MULTIPLE ISSUES.",
  "THIS ARTICLE MAY BE TOO TECHNICAL FOR MOST READERS TO UNDERSTAND.",
  "THIS SECTION NEEDS EXPANSION.",
  "PAGE SEMI-PROTECTED.",
  "[CLARIFICATION NEEDED]",
  "[DUBIOUS – DISCUSS]",
  "[WHO?]",
  "[UNRELIABLE MEDICAL SOURCE?]",
  "RETRIEVED 14 MARCH 2019.",
  "ARCHIVED FROM THE ORIGINAL.",
  "REFERENCES 1–214.",
  "VIEW HISTORY.",
];

/** Every time it heals (the default; the fight picks a random clinical fact instead, see conceptHealFact). */
export const CONCEPT_HEAL = "NO CURE HAS BEEN DEVELOPED.";

/** The barks that are actual clinical facts (not the Wikipedia furniture): what it says as it heals. */
export const CONCEPT_FACTS = CONCEPT_BARKS.filter(
  (t) => !/^\[|^THIS (ARTICLE|SECTION)|^PAGE |^VIEW HISTORY|^RETRIEVED|^ARCHIVED|^REFERENCES|^SECTION:|^MAIN ARTICLE/.test(t),
);

/** A random clinical fact for a heal (never the same one twice in a row). */
let lastFact = "";
export function conceptHealFact(): string {
  const pool = CONCEPT_FACTS.filter((t) => t !== lastFact);
  lastFact = pool[Math.floor(Math.random() * pool.length)] ?? CONCEPT_HEAL;
  return lastFact;
}

/** Its heal line as dialogue. */
export const conceptLine = (t: string): Line => c(t);

export const FB_HEAL: Line[][] = [
  [
    c("NO CURE HAS BEEN DEVELOPED."),
    say("SCROMBUS", "IT HEALED. IT FULLY HEALED. ALL OF IT."),
    say("KREZMAR", "Keep shooting! It can't do that forever!"),
  ],
  [
    c("NO CURE HAS BEEN DEVELOPED."),
    say("FLENKY", "It's done it AGAIN."),
    say("KREBON", "We've been shooting it for ages. I've shot it with everything. I shot it with a chair."),
    say("GRONNY", "Me arms tired."),
  ],
  [
    c("NO CURE HAS BEEN DEVELOPED."),
    say("KREBLIS", "Breaking news… we're going to die 👍"),
    say("MIKEY", "Is this how it ends? I never even got in the group."),
    dir("Despair. Absolute despair. The rain gets heavier, out of spite."),
  ],
];

export const FB_REALISE: Line[] = [
  say("KREZWONK", "WAIT."),
  say("KREZWONK", "WAIT, THE GOLDEN PUSSY JUICE TESTOSTERONE."),
  say("CRONGUS", "The second bottle! He chucked it off the roof with the logs!"),
  say("KREZMAR", "It landed over there. Somebody get it. YOU. Go. We'll keep it busy."),
];

export const FB_GOKU: Line[] = [
  dir("By the bottle, standing perfectly still in the rain like he's been waiting all day, is a small spiky-haired man in an orange gi."),
  say("GOKU", "Hi! I'm Goku!"),
  { s: "YOU", t: "…what.", tag: "new" },
  say("GOKU", "I felt a really bad power level and came straight here! Wow, that thing's tough. It keeps healing, huh?"),
  say("GOKU", "Listen! There's only one attack that can wipe out a whole CONCEPT. I've gotta charge up a SPIRIT CUM."),
  { s: "YOU", t: "A spirit WHAT.", tag: "new" },
  say("GOKU", "A SPIRIT CUM! Everyone lends me their energy and I make it into one big ball! It takes a while though."),
  say("GOKU", "While I charge it, you take that golden stuff and inject every one of your friends with it. All of them. Don't skip anyone!"),
  say("GOKU", "It'll wake up their power. Then you hold that monster off until I'm ready. Got it? Great! Go go go!"),
  dir("He raises both arms to the sky. A pinprick of white-gold light appears above his hands."),
];

export const FB_INJECT_HINT = "Inject each of the lads (walk up, press E). Don't get hit.";

/** What each lad says as you jab them. */
export const INJECT_BARKS: Record<string, string> = {
  FLENKY: "OW. In the NECK? Fair enough.",
  KREZMAR: "Straight in the arse, lad. I trust you.",
  KREBLIS: "Breaking news… I feel incredible 👍",
  KREZWONK: "I foresaw the needle. I did not foresee the size of it.",
  SCROMBUS: "OH. OH THAT'S THE GOOD STUFF.",
  KREBON: "Is this legal? Don't answer that.",
  CRONGUS: "It's warm. Why is it warm. Don't tell me.",
  GRONNY: "Me feel… BIG.",
  MIKEY: "Am I in the group now? Is this the initiation?",
};

export const FB_ALL_INJECTED: Line[] = [
  dir("The last plunger goes down. For a second, nothing."),
  dir("Then every single one of the Krelworld Krew starts to glow."),
];

export const FB_TRANSFORM: Line[] = [
  say("KREZMAR", "Lads. I feel… I feel…"),
  say("GRONNY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
  say("SCROMBUS", "MY SHIRT. MY SHIRT'S GONE. WHERE DID THESE COME FROM."),
  say("FLENKY", "I can see through time. Ninjas can't even do that."),
  say("MIKEY", "Is this what it's like being in the group?"),
];

export const FB_PHASE2: Line[] = [
  say("KREZWONK", "We can HURT it now. Look at it bleed concepts."),
  say("KREZMAR", "We don't need to kill it. We just need to hold out till Goku's ready."),
  say("GOKU", "(from across town) KEEP IT BUSY! THE SPIRIT CUM GETS BIGGER THE WEAKER IT GETS!"),
];

export const FB_FINAL_HEAL: Line[] = [
  c("NO CURE HAS BEEN DEVELOPED."),
  dir("Every wound closes. Every arm grows back. Its health bar fills, all the way, in one sickening glug."),
];

export const FB_NO = "NOOOOOOOOO";

export const FB_READY: Line[] = [
  say("GOKU", "Don't worry, everyone! IT'S READY!"),
  say("GOKU", "SPIRIIIIIIIT…"),
];

export const FB_SPIRIT: Line[] = [
  say("GOKU", "…CUUUUUUUUUUUUUUUUM!!!"),
];

// ---------------------------------------------------------------- the super saiyan brawl (side-on, in the sky)

export const FB_BRAWL_INTRO: Line[] = [
  dir("Nearly dead, it does something new. It tears itself out of the rubble, every arm, every eye, every footnote, and goes straight up into the storm: the whole dragon, wings and all."),
  dir("Somehow, so do you."),
  c("SEE: ABRIDGED ENTRY."),
  say("KREZMAR", "(from the ground, tiny) IT'S FLYING! THE DRAGON'S FLYING! PUNCH IT IN ITS STUPID FACE!"),
  { s: "YOU", t: "Right then. Fists.", tag: "new" },
];

export const FB_BRAWL_WIN: Line[] = [
  dir("It goes down through the clouds, wings folded, and hits what's left of Krelford like a dropped anvil."),
  c("…PAGE NOT FOUND."),
];

/** The lads, yelling up from the ground while you fight. */
export const FB_BRAWL_CHEERS = [
  "GO ON LAD!",
  "HIT HIM IN HIS CONCEPT!",
  "FASTER! FASTER THAN THAT!",
  "BEHIND HIM! GET BEHIND HIM!",
  "I CAN'T SEE ANYTHING, IT'S JUST LIGHTS!",
  "THAT ONE MADE A NOISE!",
  "BOOT HIM!",
  "DO THE THING! THE TELEPORT THING!",
  "FOR KRELFORD!",
  "I'VE GOT TWENTY QUID ON YOU!",
];

/** The lads, pouring it in while the SPIRIT CUM is held at its mouth. */
export const FB_CLASH_SHOUTS = [
  "PUSH IT!",
  "EVERYTHING YOU'VE GOT!",
  "COME ON GOKU!",
  "IT'S MOVING! IT'S MOVING!",
  "DON'T YOU DARE STOP!",
  "FOR THE CHAT LOGS!",
  "TAKE MY POWER, ALL OF IT!",
  "HARDER!",
  "WE'RE NEARLY THERE!",
  "AAAAAAAAAAAAA",
];

export const FB_DESTROYED: Line[] = [
  dir("A flash of ethereal, gorgeous white light. It washes over Krelford, over the rubble, over the rain."),
  dir("When it fades, THE CONCEPT OF PAEDOPHILIA is gone. Not dead. Gone. Unwritten. The wizard behind it goes with it, in a long, thin, very satisfying scream."),
  c("THIS ARTICLE HAS BEEN DELETED."),
];

export const FB_AFTER: Line[] = [
  dir("Silence. The rain stops. Actually stops. For the first time in Chapter 7, there are stars."),
  say("KREZMAR", "…is it gone?"),
  say("GOKU", "Yep! The concept of paedophilia has been destroyed once and for all!"),
  say("KREBLIS", "Breaking news… we did it 👍"),
  say("GRONNY", "Me still shirtless."),
  say("SCROMBUS", "We're ALL still shirtless."),
  say("GOKU", "Well, I'm starving! Bye, everyone!"),
  dir("And he's gone. Nobody ever finds out how he got there. Nobody ever asks."),
  say("KREZWONK", "Right. The logs."),
  { s: "YOU", t: "Let's delete the chat logs.", tag: "new" },
];

// ---------------------------------------------------------------- the morning after (the Hub, top-down, daylight)

export const FD_WAKE: Line[] = [
  dir("A long, long whiteness."),
  dir("Then: birdsong. Actual birdsong. Krelford, in daylight, under a clear blue sky. The rain has stopped. Everything is still smoking."),
];

export const FD_URGH: Line[] = [
  say("GRONNY", "Urrrghhhh."),
  say("SCROMBUS", "Urghhhh…"),
  say("MIKEY", "Uuurgh. Lads? Lads. Urgh."),
  say("KREBON", "Urgh. Did we get arrested?"),
  say("KREBLIS", "Urghhh 👍"),
  say("FLENKY", "Urgh. Is it… morning? Is that the SUN?"),
  say("CRONGUS", "Urrrgh. My whole body tastes of light."),
  dir("They look around. Craters. Wreckage. Smoke. Not one building left standing. A single pigeon walks past, on fire, unbothered."),
];

export const FD_SAVED: Line[] = [
  say("KREZMAR", "We did it. We saved Krelworld."),
  say("SCROMBUS", "But more importantly, we saved ourselves. We can delete the chat logs!"),
  say("CRONGUS", "I can't believe we destroyed the entire concept of paedophilia… the world will be so much more safe now… wow."),
  say("GRONNY", "The concept of what? What's the word you just used?"),
  say("CRONGUS", "Right! I don't even know what word I just used! That's how thoroughly we destroyed the concept of whatever it is!"),
  say("KREZWONK", "Lads. Something's just occurred to me. We need to release some of the inmates from Krelcatraz. Jimmy Savile. Ian Watkins. Gary Glitter."),
  say("KREZWONK", "We have no idea what they're in prison for! It's awful! I feel so guilty!"),
  say("KREBON", "Free them. Free them all. I know what it's like to be on the inside."),
  say("MIKEY", "Can I come when we let them out?"),
];

export const FD_DRONGUS_STIR: Line[] = [
  dir("Across the rubble, something stirs. Skinny. Bald. A ginger beard. Shorn of his aura, in nothing but his pants."),
  say("DRONGUS", "Ugh… my head."),
];

export const FD_DRONGUS_UP: Line[] = [
  say("DRONGUS", "Where's my shirt. Where's my DUNGEON. Why is it DAYTIME."),
  dir("He sees the lads. The lads see him. Nobody moves. Then his eyes go wide."),
  say("DRONGUS", "Wait!! The fucking chat logs!!"),
];

export const FD_GOT_THEM: Line[] = [
  say("DRONGUS", "(face down in the rubble) …ow."),
  { s: "YOU", t: "Got them.", tag: "new" },
];
