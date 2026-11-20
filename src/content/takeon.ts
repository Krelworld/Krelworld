import type { Line } from "../data/types";
import { dir, ping, say } from "./dsl";

// TAKING ON KREDDLE (Chapter 3, straight after the Krunchers leave). The lads, fired up, march over the bridge armed
// and get absolutely annihilated by Kreddle's army: shots ping off, the soldiers laugh, then a cartoon beating and
// the krew are fired back to Krelworld out of a tank. It's there so the Chapter 6 raid (raid.ts) feels earned: same
// Strip, opposite result, and the lads throw these lines back at Kreddle when it burns. Everything here is fictional.
// HubScene plays the decision and the aftermath; KreddleScene's "rout" mode (scenes/kreddle/Rout.ts) the rest.

/** At the bridge, the Krunchers just gone: the worst plan the krew have ever had. */
export const TAKEON_DECIDE: Line[] = [
  dir("The Kreddle Bridge. The Krunchers' cackling fades into the neon on the far side. The krew stand there: empty pockets, sore faces, and absolutely no sense of proportion."),
  say("KREZMAR", "Next time? NEXT time? Why wait? They took my wallet. Let's go over there right now and FACK them UP.", { cond: { notPlayer: "KREZMAR" } }),
  say("GRONNY", "Why wait? Go now! Me smash Kreddle!", { cond: { player: "KREZMAR" } }),
  say("SCROMBUS", "He's right. Lads. New plan. We take on Kreddle. Today. The whole place.", { cond: { notPlayer: "SCROMBUS" } }),
  say("MIKEY", "Yes! New plan! We take on Kreddle! Today! The whole place!", { cond: { player: "SCROMBUS" } }),
  say("KREBLIS", "Breaking news… we should invade Kreddle 👍", { cond: { notPlayer: "KREBLIS" } }),
  say("KREZMAR", "Shut up, Kreblis. We're not INVADING. We're TAKING THEM ON. Completely different.", { cond: { notPlayer: ["KREBLIS", "KREZMAR"] } }),
  say("SCROMBUS", "Shut up, Kreblis. We're not INVADING. We're TAKING THEM ON. Completely different.", { cond: { player: "KREZMAR" } }),
  say("KREBON", "Shouldn't we turn the power off first? Their whole country runs on fruit machines.", { cond: { notPlayer: "KREBON" } }),
  say("KREZWONK", "No power. Power's for cowards.", { cond: { notPlayer: ["KREZWONK", "KREBON"] } }),
  say("KREZWONK", "I have foreseen this. We march over the bridge. Kreddle trembles. We come home heroes. It was very clear.", { cond: { notPlayer: "KREZWONK" } }),
  say("CRONGUS", "How big is their army, though? Has anyone actually checked?", { cond: { notPlayer: "CRONGUS" } }),
  say("SCROMBUS", "They're a casino with a flag, Crongus. Their army is three bouncers and a fruit machine.", { cond: { notPlayer: "SCROMBUS" } }),
  say("FLENKY", "And I've got a hundred and sixty I.Q. and a purple belt in BJJ. Pretty sure that's a war crime on its own.", { cond: { notPlayer: "FLENKY" } }),
  say("MIKEY", "They took my DIGNITY. I want it back. With INTEREST.", { cond: { notPlayer: "MIKEY" } }),
  say("GRONNY", "Me bring big gun. Me bring little gun. Me bring crisps.", { cond: { notPlayer: "GRONNY" } }),
  { s: "YOU", t: "Right. Guns out. Over the bridge. Kreddle's about to find out what Krelworld's made of.", tag: "new", mood: "fired up, shouting" },
  say("KREBLIS", "Breaking news… Krelworld is made of 👍", { cond: { notPlayer: "KREBLIS" } }),
  dir("And so, with no plan, no intelligence, no backup and one bag of crisps, the Krelworld Krew march on Kreddle."),
];

/** Over the bridge: the army's waiting. */
export const TAKEON_ARRIVE: Line[] = [
  dir("The Kreddle Strip. You were expecting three bouncers and a fruit machine."),
  dir("There are not three bouncers and a fruit machine."),
  say("KREDDLE TANNOY", "Attention, Kreddle. Some Krelworlders are attacking. Please do not be alarmed. Please do not stop gambling."),
  say("KREDDLE GENERAL", "Well, well. The Tap-lickers came to visit. Boys? Say hello."),
  say("KREDDLE SOLDIER", "HELLO, TAP-LICKERS!"),
  say("CRONGUS", "That's not three bouncers.", { cond: { notPlayer: "CRONGUS" } }),
  say("SCROMBUS", "Doesn't matter! Stick to the plan! The plan is: SHOOT THEM!", { cond: { notPlayer: "SCROMBUS" } }),
  dir("SHOOT (hold attack). Walk EAST. Take Kreddle. How hard can it be?"),
];

/** Shouted by the soldiers in speech bubbles while you shoot at them (voiced). */
export const TAKEON_TAUNTS: Line[] = [
  say("KREDDLE SOLDIER", "Krelworld scum!"),
  say("KREDDLE SOLDIER", "Was that a bullet? It tickled!"),
  say("KREDDLE SOLDIER", "Ow. No. Wait. That didn't hurt at all."),
  say("KREDDLE SOLDIER", "Your whole country's a shithole with a bus stop!"),
  say("KREDDLE SOLDIER", "Go home and cry into your Tap, Krelworld!"),
  say("KREDDLE SOLDIER", "You drink juice out of a TAP! In the ROAD!"),
  say("KREDDLE SOLDIER", "Nice tower, Krelworld! Compensating for something?"),
  say("KREDDLE SOLDIER", "Your Krel Tower looks like a knob! From space!"),
  say("KREDDLE SOLDIER", "Is that the Krel Tower or a cry for help?"),
  say("KREDDLE SOLDIER", "Your leader writes LORE! On FACEBOOK!"),
  say("KREDDLE SOLDIER", "React to the song! Oh wait, nobody does!"),
  say("KREDDLE SOLDIER", "Tap-licker!"),
  say("KREDDLE SOLDIER", "Bounced right off! Like your economy!"),
  say("KREDDLE SOLDIER", "Is that a gun or a sponsored pen?"),
  say("KREDDLE SOLDIER", "My nan shoots harder than that! And she's a slot machine!"),
  say("KREDDLE SOLDIER", "Kreddle armour, baby! Paid for by YOUR losses!"),
  say("KREDDLE SOLDIER", "You've got a minister for PUDDING!"),
  say("KREDDLE SOLDIER", "The House always wins, Tap-licker!"),
  say("KREDDLE SOLDIER", "Krelworld's so poor the Tap's on a payment plan!"),
  say("KREDDLE SOLDIER", "Fucking Krelworld cunts!"),
  say("KREDDLE SOLDIER", "Keep going! I'm getting a massage out of this!"),
  say("KREDDLE SOLDIER", "Look at their little faces! They thought they had a chance!"),
  say("KREDDLE SOLDIER", "You'll never beat us! Never! Not in a million years!"),
  say("KREDDLE SOLDIER", "Lost your dignity? We've got it framed in the casino!"),
  say("KREDDLE SOLDIER", "Krelworld: the universe that time forgot. And so did everyone else."),
];

/** The Kreddle Krunchers, on deckchairs at the side of the Strip, enjoying the show. */
export const TAKEON_KRUNCHER_JEERS: Line[] = [
  say("KLENKY", "LOL! Look at them GO!"),
  say("MIKKY K", "Back so soon, nerds? We only just left!"),
  say("KREDWONK", "I foresaw this. It's even funnier in real life."),
  say("KREDBLIS", "Breaking news… Krelworld is losing 👍"),
  say("GRENNY", "Waa waa wee waa! That's Kreddle for 'pass the popcorn'!"),
  say("KREDMAR", "Ten Kreddle Kredits says the little one cries first."),
  say("LIL' KRUNGUS", "Hey! I'M the little one!"),
];

/** The krew, while it's still going well (ish). */
export const TAKEON_KREW_BRAVE: Line[] = [
  say("KREZMAR", "Ave it! AVE IT, you FACKING KANTS!"),
  say("GRONNY", "Bang bang! Me shoot! Me shoot good!"),
  say("FLENKY", "Spread out! Flank them! That's what I'd do in BJJ!"),
  say("SCROMBUS", "Keep firing! Statistically one of these has to work!"),
  say("MIKEY", "This is for my DIGNITY!", { variants: { MIKEY: "This is for Polson's SHAKE!" } }),
  say("KREBLIS", "Breaking news… we're winning 👍"),
  say("KREBON", "Six Krez Years inside and I've never seen armour like it."),
  say("KREZWONK", "Hold the line! The vision said we win! I think!"),
  say("CRONGUS", "Lil' Crongus is going IN!"),
];

/** The krew, once it's sunk in. */
export const TAKEON_KREW_DOOMED: Line[] = [
  say("CRONGUS", "That's a TANK! Why have they got a TANK?!"),
  say("SCROMBUS", "Our bullets are bouncing off! That's not in the plan!"),
  say("KREBLIS", "Breaking news… we're not winning 👍"),
  say("KREZWONK", "I may have misread the vision. It might have been upside down."),
  say("KREBON", "NOW can we turn the power off?!"),
  say("MIKEY", "I want to go home! I want to go HOME!"),
  say("FLENKY", "I can't BJJ a tank! Nobody can BJJ a tank!"),
  say("GRONNY", "Me no like this! Me want mummy!"),
  say("KREZMAR", "Retreat! RETREAT! …which way's retreat?!"),
];

/** The Tannoy, now and then, over the gunfire. */
export const TAKEON_TANNOY: Line[] = [
  say("KREDDLE TANNOY", "Reminder: the Krelworld attack is not a casino event. Bets on the outcome are, however, now open."),
  say("KREDDLE TANNOY", "Current odds on Krelworld: ten thousand to one. Odds on the tank: evens."),
  say("KREDDLE TANNOY", "Would the owner of a Krelworld army please collect it from the Strip. It is embarrassing everyone."),
  say("KREDDLE TANNOY", "Reinforcements are arriving. Not that we need them. They just wanted to watch."),
];

/** The big HUD banners. */
export const TAKEON_BANNERS = ["⚠ KRELWORLD ATTACK IN PROGRESS ⚠  BETS NOW OPEN", "KRELWORLD: 10,000 / 1", "⚠ REINFORCEMENTS INBOUND (FOR A LAUGH) ⚠", "KREDDLE ARMY: UNDEFEATED SINCE FOREVER"];

/** It's over: the army closes in, and the General has a few words. */
export const TAKEON_GENERAL: Line[] = [
  dir("The gunfire stops. Not because you've won. Because you've run out of places to stand. Kreddle's army closes in a ring around the krew, grinning."),
  say("KREDDLE GENERAL", "That's enough. Hold fire, boys. Let 'em look at us."),
  say("KREDDLE GENERAL", "So this is Krelworld's finest. Nine skint idiots, a bag of crisps, and a pea-shooter each."),
  say("KREDDLE GENERAL", "You came over MY bridge, onto MY Strip, and you thought you'd win? In KREDDLE? The House ALWAYS wins."),
  say("KREDDLE GENERAL", "Your country is a puddle with a flag. Your Tap is a public health emergency. And your little tower? We can see it from here. Everyone's laughing at it. It looks like a willy."),
  say("KREDDLE GENERAL", "You will NEVER beat Kreddle. Not today. Not ever. Remember this moment, Tap-lickers. Remember who made you cry."),
  { s: "YOU", t: "We're not crying! …That's sweat. That's battle sweat.", tag: "new", mood: "voice cracking, close to tears" },
  say("KREDDLE GENERAL", "Boys? Krunch 'em."),
];

/** Caption words over the cartoon beating. */
export const TAKEON_BEATING = ["WHAM!", "KRUNCH!", "BOSH!", "THWACK!", "NOT THE FACE!", "KAPOW!", "OOF!", "MY CRISPS!", "WALLOP!", "SPLAT!", "MUMMY!", "KRUNCH!!"];

/** Before the tank. */
export const TAKEON_SENDER: Line[] = [
  dir("What's left of the Krelworld Krew is stuffed, one by one, head first, down the barrel of a big gold tank."),
  say("KREDDLE GENERAL", "Return to sender."),
  say("KREDDLE SOLDIER", "No postage paid!"),
  say("KREDDLE GENERAL", "Fire."),
];

/** Back in Krelford, in a heap (HubScene drops them out of the sky first). */
export const TAKEON_LAND: Line[] = [
  dir("Krelford. A quiet afternoon. Then: a distant BOOM from Kreddle, a whistling noise, and the entire Krelworld Krew come down out of the sky one at a time, onto the road by the bridge, in a heap."),
  dir("A Kreddle postage sticker is slapped across the pile: RETURN TO SENDER. NO VALUE. DO NOT RETURN."),
  say("MIKEY", "…ow.", { cond: { notPlayer: "MIKEY" } }),
  say("GRONNY", "Me lost my crisps.", { cond: { notPlayer: "GRONNY" } }),
  say("CRONGUS", "That was definitely against the Krelneva Convention. Firing people out of a tank. I'm going to write a letter.", { cond: { notPlayer: "CRONGUS" } }),
  say("KREBLIS", "Breaking news… we got absolutely rekt 👍", { cond: { notPlayer: "KREBLIS" } }),
  dir("Somewhere in the heap, a phone buzzes. Then every phone buzzes. KREDDLE TV: LIVE."),
  say("KREBLIS", "Breaking news… Klerble's on Kreddle telly. Live. Talking about us 👍", { cond: { notPlayer: "KREBLIS" } }),
  say("SCROMBUS", "Lads. Klerble's on Kreddle telly. Live. He's talking about us.", { cond: { player: "KREBLIS" } }),
];

/** KREDDLE TV, live from the Klerble Palace: the President celebrates (gfx/klerblePresser.ts plays these). */
export const PRESSER_OPEN: Line[] = [
  dir("KREDDLE TV. The Klerble Palace press room, packed to the chandeliers with Kreddle's finest: grown men and women in neon, applauding before he's said a word."),
  say("KREDDLER", "YES, PRESIDENT! YES!"),
  say("PRESIDENT KLERBLE", "HAHAHAHAHA! You fucking cunts stand NO chance against us!!! Now watch what I'm about to do!!", { mood: "laughing maniacally" }),
  dir("President Klerble steps out from behind the podium. He turns side-on to the cameras. He undoes his belt. Somewhere in Kreddle TV, a director lunges for a button."),
];
/** During it: the censor bar is up, the crowd goes wild. */
export const PRESSER_WONK: Line[] = [
  say("PRESIDENT KLERBLE", "Oh YES. Oh YES! YES! YESSSS!", { mood: "breathless, ecstatic" }),
];
/** Right after it: a gasp, then the room goes even wilder. */
export const PRESSER_BLESSED: Line[] = [
  say("KREDDLER", "HE'S BLESSED US! THE PRESIDENT HAS BLESSED US!", { mood: "ecstatic, shouting" }),
  say("KREDDLER", "I'm never washing this suit again!"),
];
/** The crowd, cheering in bubbles while he's at it (voiced). */
export const PRESSER_CHEERS: Line[] = [
  say("KREDDLER", "YES, PRESIDENT!"),
  say("KREDDLER", "BEAUTIFUL!"),
  say("KREDDLER", "KREDDLE! KREDDLE! KREDDLE!"),
  say("KREDDLER", "What a man! WHAT a man!"),
  say("KREDDLER", "Four more years!"),
  say("KREDDLER", "Take that, Krelworld!"),
];
/** After the krez (and the PLEASE STAND BY card). */
export const PRESSER_CLOSE: Line[] = [
  dir("The picture comes back. President Klerble is behind the podium again, sweating, beaming, doing his belt up."),
  say("PRESIDENT KLERBLE", "That's what I think of Krelworld!! I hope every man, woman and child in Krelworld gets ALS or cancer and dies!! HAHAHAHAHA!", { mood: "laughing maniacally" }),
  say("KREDDLER", "KREDDLE! KREDDLE! KREDDLE!"),
  dir("A standing ovation. It goes on for four minutes. Kreddle TV cuts to an advert for a casino."),
];

/** Back in the heap: they've seen it. Licking wounds, vowing revenge. */
export const TAKEON_AFTER: Line[] = [
  dir("Nobody in the heap says anything for a long time. Then somebody gags. Then somebody else. Then all of them.", { sfx: "cough_1" }),
  say("CRONGUS", "Oh God. Oh GOD. Hurrrk. On the press. On the FRONT ROW.", { cond: { notPlayer: "CRONGUS" }, mood: "gagging, retching" }),
  say("KREBLIS", "Breaking news… I've been sick in my mouth 👎", { cond: { notPlayer: "KREBLIS" }, mood: "retching" }),
  say("GRONNY", "Bleurgh. Me sick. Me sick on Mikey.", { cond: { notPlayer: ["GRONNY", "MIKEY"] }, mood: "retching" }),
  say("FLENKY", "He… he did THAT. On TELLY. About US. With his whole chest.", { cond: { notPlayer: "FLENKY" } }),
  say("KREZMAR", "Every man, woman and child. Cancer. He SAID that. Out loud. At a PODIUM. I'm going to FACKING end him.", { cond: { notPlayer: "KREZMAR" } }),
  say("KREBON", "Six Krez Years inside with some proper evil men. Not one of them ever did that at a press conference.", { cond: { notPlayer: "KREBON" } }),
  say("GRONNY", "Me hate him. Me hate him SO much.", { cond: { notPlayer: "GRONNY" } }),
  say("MIKEY", "I've never wanted to hurt anyone before. I mean, I have. But not like this.", { cond: { notPlayer: "MIKEY" } }),
  say("KREZWONK", "I have foreseen it. Properly this time. The vision was upside down. We come back. A bright light over Kreddle. And then no more Klerble.", { cond: { notPlayer: "KREZWONK" } }),
  say("SCROMBUS", "Lore update: we lost. That doesn't go in the lore. What Klerble did does. In red. Underlined.", { cond: { notPlayer: "SCROMBUS" } }),
  { s: "YOU", t: "We'll be back, Kreddle. And Klerble? You're first.", tag: "new", mood: "quiet, furious" },
  ping("DRONGUS", "Saw you on Kreddle telly"),
  ping("DRONGUS", "Should've reacted to the song"),
  ping("KLENKY", "LOL. RETURN TO SENDER 📦 Krunchers rule. Krelworld drools 👍"),
  ping("POLSON", "Lads did you go to Kreddle without me?? Yeeegh. Probably for the best 😅"),
  dir("Krelworld will remember this. Krelworld will remember ALL of this."),
];
