// What people say. Thick, tribal, conspiratorial England fans mostly, plus their rivals.
// Two rules keep it fresh. Nobody says the same thing twice to you: each NPC remembers what it said.
// And the ground as a whole avoids repeating itself: a line said anywhere recently is skipped by
// everyone else (the Valve "response rules" idea, cut down: memory, cooldowns, a fallback).
//
// Talking to someone is an exchange, not a line. It can be funny, useful (a tip, a lead, a phone
// number), a gift, a scam, or trouble, weighted so it is mostly comedy and sometimes the thing you
// needed (Yakuza substories; Hitman's overheard leads).
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { chance, pick, rnd } from "../core/rng";
import { spawnItem, moveItem, canPocket } from "../core/items";
import { say } from "./npc";
import { hearLead } from "./entries";
import { isWoman } from "./lech";

type Line = [who: "t" | "g", text: string];
type Exchange = { k: "comic" | "tip" | "gift" | "scam" | "number" | "hostile"; lines: Line[]; give?: string; money?: number; take?: number; contact?: string };

// ---------- Ambient: what fans say to each other ----------
export const FAN_BANTER = [
  "Ref's on their payroll. My cousin's mate saw him in a Nando's.",
  "VAR's run out of Brussels. It's all connected, Dave.",
  "Them floodlights are 5G. My head's been ringing since the warm-up.",
  "Their manager's got a tan in November. Explain that.",
  "Eight quid a pint. EIGHT. That's how they get you.",
  "The FA put something in the pies. I've not been right since '96.",
  "Linesman's flag's got a battery in it. Remote control, innit.",
  "Their number nine goes down like a sack of spuds in a breeze.",
  "Foreign beer's just water with a passport.",
  "You can't trust a country that eats its tea at ten o'clock at night.",
  "Penalties are rigged. Always have been.",
  "I read on Facebook the grass is imported. From THEM.",
  "Why's their keeper allowed gloves? Seems like cheating to me.",
  "Half-time, I'm having four pies. Four. Watch me.",
  "If that ref gives them a pen I'm going on. I'm going on, Dave.",
  "Announcer's accent comes and goes. I'm just saying.",
  "Their whole country's smaller than Essex. Smaller than ESSEX.",
  "Bloke on the radio reckons they've got a thirteenth man. Under the pitch.",
  "Six pints and a Monster. I can see through time.",
  "Last away game I woke up in a hedge in Belgium.",
  "Stewards here are all ex-Old Bill. You can tell by the eyes.",
  "Wembley's built on a burial ground. That's why we can't do penalties.",
  "They're bussing in fake fans. Actors, the lot of them.",
  "Our left-back's a Freemason. Plays like one too.",
  "Same people own the pie franchise as own the ref. Look it up.",
  "Guts win matches. Look at mine.",
  "I punched a police horse once. Still not sorry.",
  "My missus says it's me or football. I'll miss her.",
  "I've not missed a game since '98. Lost two marriages and a kidney.",
  "If we win I'm getting the three lions tattooed. On me face this time.",
  "Their fans smell of garlic and lies.",
  "Moon landing was filmed at Wembley. That's why the grass looks like that.",
  "Never trust a man who drinks halves.",
  "Ball's lighter when they're kicking it. Science.",
  "I've drunk so much I've gone out the other side. I'm sober now. Spiritually.",
  "Their anthem's too long. That's a power move, that.",
  "Pigeons are drones. Every one of them. Watch how they look at you.",
  "Bloke in the toilets tried to sell me a kidney. Not his.",
  "Ref's from a neutral country. NOBODY is neutral, Dave.",
  "They've watered their end of the pitch. Sly.",
  "That's not a beard on their captain. That's a disguise.",
  "If football's coming home, why's it always lost on the way?",
  "Two-nil. Easy. Then we bottle it in the last minute.",
  "My lad's eight. Already barred from two pubs. Proud.",
  "This pie's got a hair in it. Might be mine.",
  "Ten pints and a kebab, that's the plan.",
  "My doctor says no more lager. So I'm on the cider.",
  "Wake up, sheeple. The offside rule was invented by the French.",
  "Seen their goalie? Hands like a nan's. Lovely and soft.",
  "Whose round is it? It's never mine, is it.",
  "I've got a good feeling. I had a good feeling in '06 as well.",
  "Their striker's got a boat. A BOAT. Where's my boat?",
  "My nan could do a better job in goal. And she's in a box on my mantelpiece.",
  "I put a tenner on us to lose. Emotional hedge.",
  "You can tell a lot about a country by its crisps. Theirs are shocking.",
  "The stewards have got earpieces. Who's talking to them? Think about it.",
  "I drink to forget. I forget why. So I drink.",
  "Mate of mine got in the back on the beer lorry. Nobody ever checks it.",
  "Their number 10 dives. Somebody should give him something to dive about.",
  "Their keeper put money on himself to concede in '18. Swear down.",
  "That ref has his tea from the same urn every half-time. Creature of habit.",
];
export const FAN_REPLIES = [
  "Too right.", "Shut up, Dave.", "You said that last week.", "That's what I've been saying!", "Is that true?",
  "My cousin said the same thing.", "Wake up, people!", "You're mental, you are.", "Facts.", "Exactly. EXACTLY.",
  "Get another round in and I'll believe you.", "Where d'you read that?", "Don't, you'll set me off.", "Proper.",
  "I'm not having that.", "That's a bit much, even for you.", "Who told you that?", "My missus is from there.",
  "Say it louder for the people at the back.", "Ingerland!", "Sounds about right.", "You've lost me.",
];
export const AWAY_BANTER = [
  "English food is a crime. We should report it.", "Your team is a joke. Your fans also.", "Tonight we dance on your little island.",
  "Why are the English always so pink?", "This beer tastes like a wet dog.", "Your keeper has the hands of a sad grandmother.",
  "In my country this would be a holiday. Here it is Tuesday.", "We came for the football. We stay for the laughing.",
];
export const FEMALE_BANTER = [
  "My fella's in the toilets crying again. He does that at kick-off.", "If he says 'it's coming home' once more I'm leaving him here.",
  "Honestly, I'm here for the thighs.", "Bought a pie. Regret it already.", "I've been coming since I was six. Me dad still owes me a ticket.",
  "The ref's got lovely calves. Bent, but lovely calves.", "Third husband. Same seat.",
];

// ---------- Talking to Grozz ----------
const COMIC: Line[][] = [
  [["t", "You're that bloke off the news. The one who bit the mascot."], ["g", "Allegedly."]],
  [["t", "Can I ask you something? Do you think birds are real?"], ["g", "What?"], ["t", "Exactly. Think about it."]],
  [["t", "Is it true the ref's wife is from {them}?"], ["g", "Everyone's wife is from {them}, mate."]],
  [["t", "I reckon if we all sing louder, the ball goes in more."], ["g", "That's not a theory. That's science."]],
  [["t", "Oi. You look like my Uncle Barry. He's dead."], ["g", "Lucky him."]],
  [["t", "England till I die! ...Is that tonight? What time is it?"]],
  [["t", "I'm on day four of a stag do. I don't know whose."], ["g", "Respect."]],
  [["t", "If I licked the pitch, d'you reckon I'd absorb the skill?"], ["g", "Only one way to find out."]],
  [["t", "Mate. Mate. Mate."], ["g", "What?"], ["t", "...Forgotten."]],
  [["t", "Doctor says I've got the liver of a ninety-year-old. I said give it him back then."]],
  [["t", "If they score I'm burning my own house down. In protest."], ["g", "Do it anyway."]],
  [["t", "You a steward? You've got steward energy."], ["g", "Say that again and you'll be wearing your teeth."]],
  [["t", "Brought my nan's ashes. She wanted to see us lose one last time."]],
  [["t", "Ingerland! Ingerland! Ingerl... Ah. Me voice has gone."]],
  [["t", "Who are you looking at?"], ["g", "Your fat face."], ["t", "...Fair."]],
  [["t", "Can't feel my legs. I think it's the chicken."]],
  [["t", "Named my son after the '66 squad. All of them. Poor sod's got eleven middle names."]],
  [["t", "Don't drink the water here. Fluoride. That's how they get you."], ["g", "I only drink lager."], ["t", "Smart man."]],
  [["t", "Put my mortgage on a draw. Don't tell my wife. Or my other wife."]],
  [["t", "Fancy a fight later? Not now. I'm eating."], ["g", "Diary's open."]],
  [["t", "That pie man's undercover Old Bill. I'd bet my teeth on it. My real ones."]],
  [["t", "You want to know who runs football? Lizards. Big ones. In suits."], ["g", "Like you, then."]],
  [["t", "I'm not drunk. I'm emotionally hydrated."]],
  [["t", "Know what's wrong with this country? Not enough flags."], ["g", "There's flags everywhere."], ["t", "NOT. ENOUGH."]],
  [["t", "Shh. Don't look now. That seagull's a spy."], ["g", "...They're everywhere."]],
  [["t", "You stink of piss and Lynx, mate."], ["g", "It's called aftershave."]],
  [["t", "I've lost my mate Dazza. Bald, fat, England shirt. Seen him?"], ["g", "That's everyone here."]],
  [["t", "Took a sickie for this. Told work my dog died. I haven't got a dog."], ["g", "You have now. It's dead."]],
  [["t", "D'you think the players can hear us? I've been calling their left-back a nonce for an hour."]],
  [["t", "I've got a hundred quid on their keeper fluffing one. Make it happen and I'll split it."], ["g", "Leave it with me."]],
  [["t", "If I die today, tell my missus I never loved her."], ["g", "Already have."]],
  [["t", "Whatever you do, don't use the third toilet. I've done something in there. Something permanent."]],
  [["t", "My therapist says I put too much on football. I sacked her. Put the money on England."]],
  [["t", "You're a big lad. You ever thought about going in goal for us? We've got nothing to lose."]],
  [["t", "Have you seen the price of a programme? I'm not paying to READ."]],
  [["t", "I've been barred from every pub on this street. Well. Not that one. Yet."]],
  [["t", "Oi, are you famous?"], ["g", "Infamous."], ["t", "I KNEW it."]],
  [["t", "I'm writing a book. It's about how the Euros are fixed. It's mostly pictures."]],
  [["t", "Me and my brother aren't talking. He supports the national rugby team. Traitor."]],
  [["t", "Wanna see my tattoo? It's Gazza. Or it was. It's gone a bit Sam Allardyce."]],
];
const COMIC_F: Line[][] = [
  [["t", "Don't even think about it, love. I've seen your sort."], ["g", "What sort?"], ["t", "Fat."]],
  [["t", "My fella would kill you for talking to me. He's in the toilets. Crying."]],
  [["t", "Are you Shezleigh's husband? She's told us ALL about you."], ["g", "Lies. All of it."]],
  [["t", "Buy us a drink and I'll tell you a secret. ...No? Tight git."]],
  [["t", "I'm only here for the footballers' bums. Don't tell anyone."]],
];
const AWAY_COMIC: Line[][] = [
  [["t", "You English are so loud. Is it the beer or the sadness?"], ["g", "Both. Now piss off."]],
  [["t", "Your team plays like a fridge falling down stairs."], ["g", "Your mum plays like a fridge falling down stairs."]],
  [["t", "Fat man. You are lost. This is OUR end."], ["g", "Not for long, sunshine."]],
  [["t", "We have been winning since before you had football."], ["g", "We invented it."], ["t", "And then you forgot."]],
];
const HOSTILE: Line[][] = [
  [["t", "What you looking at, fatty?"], ["g", "Your mum. Last night."]],
  [["t", "Get out of my face before I rearrange yours."]],
  [["t", "Nah. Don't talk to me. You've got a face like a slapped arse."], ["g", "Say that again."]],
  [["t", "You're the knobhead who nicked my seat in '04."], ["g", "Prove it."]],
];
/** Useful things, each worded so the lead it points at gets written down. */
const TIPS: string[] = [
  // The fixes (fixes.ts): what you'd need to know to rig the match.
  "Their number 10's the only one who can play. Take him out and they've got nothing.",
  "Their lot all drink out of their own cooler by the tunnel before kick-off. Slip something in that and they're on the bog all night.",
  "Their number 10's always last on their coach outside the team hotel. On his own. Thinks he's a film star.",
  "You can see the whole pitch from the stand roof. Anyone up there with a brick could do some damage.",
  "Their keeper likes a bet. Everyone knows it. Wave a hundred quid at him and see.",
  "Their goalie warms up in the goalmouth on his own before kick-off. Nobody near him.",
  "Ref's bent. Fifty quid'd do it. A hundred and fifty, he'll give us a penalty.",
  "Spare ref's kit just hangs in the officials' room down the tunnel. Black's slimming, mind.",
  "My mate swears the drain runs from the pub cellar under the ground. But the cellar's seized solid. Needs a wrench.",
  "Wally the kit man drinks in the pub between runs. That swipe card of his gets you in the back.",
  "Kit lads wheel a laundry hamper straight into the kit room. Nobody looks in a hamper of dirty pants.",
  "Builders on that scaffold by the car park walk right over the roof to the tunnel. Nobody stops them.",
  "There's a maintenance ladder up the back of the South Stand. Bloke jumped off it last year.",
  "Para Steve's doing the half-time jump. His chute's in the bag by his van.",
  "Lenny the Lion has a fag behind the stand before every match. Head off and everything.",
  "A press pass gets you through any turnstile. The TV lot lose them all the time.",
  "That beer lorry goes straight into the back of the ground. Nobody ever checks it.",
  "The steward on the staff door nips out for a fag every twenty minutes. Props it open and all.",
  "Got knocked spark out in there once. Woke up next to the dressing rooms. True story.",
  "Dodgy Del outside the pub. Tickets, tickets. Cheap and real, mostly.",
  "Stick a hi-vis on and the stewards think you're one of them. Just don't do nothing stupid in it.",
  "Old Bill don't care about nothing unless you're daft enough to do it in front of them.",
  "Turnstile lads take a twenty if you fold it right.",
  "Put a dress on and nobody looks at your face. Learned that on a stag do.",
  "There's a fire alarm on the concourse. Smash it and the whole match stops.",
  "The ref has his tea at half-time. Two sugars. Same urn every match.",
  "Some lonely old boy's walking round with a spare ticket. Says he's waiting for a lovely lady to take.",
  "Dropped my old pay-as-you-go round the back of the pub bins. Cheap thing. Can't be traced.",
  "If you grass on someone to the Old Bill, use a phone they can't trace back to you. Trust me.",
  "Stewards all carry walkies. Get on one and they think you're a steward too.",
];
const SHRUG = ["I've told you everything, mate.", "Are you following me?", "Leave it, eh?", "Go and bother someone else.", "Still here?", "I've got nothing else, honest.", "You again."];
const GIFTS: Exchange[] = [
  { k: "gift", lines: [["t", "Here. I can't finish this. Doctor's orders."], ["g", "Cheers."]], give: "pint" },
  { k: "gift", lines: [["t", "Have a pie. I've had five. I can't see my feet."]], give: "pie" },
  { k: "gift", lines: [["t", "Take a tenner. You look like you need it more than me."], ["g", "I do."]], money: 10 },
  { k: "gift", lines: [["t", "Found this on the floor. Want it? I'm not wearing a dead man's cap."]], give: "flat_cap" },
  { k: "gift", lines: [["t", "Nicked this off a steward who was asleep. You have it. I'm on probation."]], give: "hivis" },
  { k: "gift", lines: [["t", "Want some sunglasses? Found them on a bloke. He didn't need them. He was unconscious."]], give: "sunglasses" },
];
const SCAMS: Exchange[] = [
  { k: "scam", lines: [["t", "Lend us a tenner? I'll pay you back at half-time. On my nan's life."], ["g", "...He's not coming back, is he."]], take: 10 },
  { k: "scam", lines: [["t", "Raffle ticket? Fiver. For the kiddies."], ["t", "Oh, you've lost. Bad luck."]], take: 5 },
  { k: "scam", lines: [["t", "I'll read your palm for a quid."], ["t", "You're gonna die. Eventually. That's a quid."]], take: 1 },
  { k: "scam", lines: [["t", "Want a ticket? Twenty quid. Real as anything."], ["t", "...Did I say ticket? I meant receipt. No refunds."]], take: 20 },
];
const NUMBERS: Exchange[] = [
  { k: "number", contact: "dealer", lines: [["t", "You after anything? Ring Spliff Ricky. He'll come to you. Tell him Gaz sent you."], ["g", "Saved."]] },
  { k: "number", contact: "boxer", lines: [["t", "Need someone sorting? Brendan. Bare-knuckle. Fifty quid and he'll flatten anyone you point at."], ["g", "Now we're talking."]] },
];

/** A line nobody here has said lately, and that this person hasn't said to you. Falls back gracefully. */
export function fresh(w: World, pool: string[], a?: Actor): string {
  const st = w.state.stadium!, r = w.state.rng.world;
  const recent = (st.recent ??= []);
  const mine = a?.npc?.heard ?? [];
  let opts = pool.filter((l) => !recent.includes(l) && !mine.includes(l));
  if (!opts.length) opts = pool.filter((l) => !mine.includes(l));
  if (!opts.length) opts = pool;
  const line = pick(r, opts);
  remember(w, line, a);
  return line;
}
function remember(w: World, line: string, a?: Actor): void {
  const st = w.state.stadium!;
  const recent = (st.recent ??= []);
  recent.push(line); if (recent.length > 70) recent.splice(0, recent.length - 70);
  if (a?.npc) { (a.npc.heard ??= []).push(line); if (a.npc.heard.length > 30) a.npc.heard.shift(); }
}

/** Something to mutter in a group: fans' theories, their rivals' sneers. A mate might answer. */
export function banter(w: World, a: Actor): void {
  const n = a.npc!, s = w.state, r = s.rng.world;
  const pool = n.team === 1 ? AWAY_BANTER : isWoman(a) && chance(r, 0.6) ? FEMALE_BANTER : FAN_BANTER;
  const line = fresh(w, pool, a);
  say(w, a, line, 4.5);
  hearLead(w, line);
  // Somebody in the same group answers back, sometimes.
  if (n.group && chance(r, 0.45)) {
    const mate = Object.values(s.actors).find((o) => o !== a && o.npc?.group && Math.hypot(o.npc.group.x - n.group!.x, o.npc.group.y - n.group!.y) < 0.5 && !o.hiddenIn && o.downUntil <= s.tick && !o.npc.bubble);
    if (mate) queue(w, mate.id, fresh(w, FAN_REPLIES, mate), s.tick + 120);
  }
}

/** Lines waiting their turn (the second half of an exchange). */
export function queue(w: World, by: string, text: string, at: number): void {
  (w.state.stadium!.chatQ ??= []).push({ by, text, at });
}
export function stepChat(w: World): void {
  const s = w.state, st = s.stadium!;
  if (!st.chatQ?.length) return;
  for (const q of st.chatQ) {
    if (s.tick < q.at) continue;
    q.at = -1;
    const a = s.actors[q.by];
    if (!a || a.hiddenIn || a.dead || a.downUntil > s.tick) continue;
    if (a.id === st.pc) w.bus.emit({ type: "pc_say", t: s.tick, by: a.id, text: q.text });
    else say(w, a, q.text, 4);
  }
  st.chatQ = st.chatQ.filter((q) => q.at >= 0);
}

const fill = (w: World, t: string) => t.replace(/\{them\}/g, w.state.match!.teams[1].name);

/** Grozz has a word with a fan or a local: mostly comedy, sometimes a tip, a gift, a scam, a number, or aggro. */
export function talkTo(w: World, pc: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!, r = s.rng.world, n = t.npc!;
  n.talked = (n.talked ?? 0) + 1;
  t.facing = Math.atan2(pc.y - t.y, pc.x - t.x);
  const play = (ex: Exchange) => {
    let at = s.tick;
    for (const [who, text0] of ex.lines) {
      const text = fill(w, text0);
      if (at === s.tick && who === "t") say(w, t, text, Math.max(3, text.length / 14));
      else queue(w, who === "t" ? t.id : pc.id, text, at);
      at += Math.round(60 * Math.max(1.6, text.length / 16));
      if (who === "t") hearLead(w, text);
    }
    if (ex.give) {
      const it = spawnItem(s, ex.give, { k: "ground", x: pc.x, y: pc.y });
      if (canPocket(pc, it)) moveItem(s, it.id, { k: "pocket", a: pc.id });
      else if (!pc.hand) moveItem(s, it.id, { k: "hand", a: pc.id });
      w.bus.emit({ type: "gift", t: s.tick, by: t.id, def: ex.give });
    }
    if (ex.money) { pc.money += ex.money; w.bus.emit({ type: "gift", t: s.tick, by: t.id, money: ex.money }); }
    if (ex.take) {
      const take = Math.min(pc.money, ex.take);
      pc.money -= take; t.money += take;
      w.bus.emit({ type: "scammed", t: s.tick, by: t.id, amount: take });
      // Off he goes with it.
      n.plan = [{ k: "go", x: t.x + (t.x > pc.x ? 7 : -7), y: t.y + 3, run: true }];
    }
    if (ex.contact) { st.flags[`contact_${ex.contact}`] = 1; w.bus.emit({ type: "contact", t: s.tick, id: ex.contact }); }
    if (ex.k === "hostile" && chance(r, 0.3)) { n.retaliateAt = s.tick + 90; n.retaliateOn = pc.id; }
  };

  // Hidden stories first: a stranger with a reason to talk to you (scenarios.ts hooks in here).
  if (st.scenarioTalk?.[t.id]) { const lines = st.scenarioTalk[t.id]; delete st.scenarioTalk[t.id]; play({ k: "comic", lines: lines as Line[] }); return; }

  if (n.talked > 3 && chance(r, 0.7)) { say(w, t, fresh(w, SHRUG, t), 3); return; }

  if (n.team === 1) { play({ k: "comic", lines: pickFresh(w, AWAY_COMIC, t) }); return; }

  // What sort of exchange: mostly comedy; tips while there are tips you haven't heard; the odd gift or scam.
  const tipsLeft = TIPS.filter((x) => !(st.recent ?? []).includes(x) && !n.heard?.includes(x));
  const numbersLeft = NUMBERS.filter((x) => !st.flags[`contact_${x.contact}`]);
  const roll = rnd(r);
  const wNum = numbersLeft.length ? 0.09 : 0, wTip = tipsLeft.length ? 0.22 : 0, wGift = 0.07, wScam = pc.money >= 5 ? 0.06 : 0, wHost = 0.08;
  let x = roll;
  if ((x -= wNum) < 0) { play(pick(r, numbersLeft)); return; }
  if ((x -= wTip) < 0) { const tip = pick(r, tipsLeft); remember(w, tip, t); play({ k: "tip", lines: [["t", tip]] }); return; }
  if ((x -= wGift) < 0) { play(pick(r, GIFTS)); return; }
  if ((x -= wScam) < 0) { play(pick(r, SCAMS)); return; }
  if ((x -= wHost) < 0) { play({ k: "hostile", lines: pickFresh(w, HOSTILE, t) }); return; }
  play({ k: "comic", lines: pickFresh(w, isWoman(t) && chance(r, 0.6) ? COMIC_F : COMIC, t) });
}

/** An exchange whose opening line hasn't been heard lately. */
function pickFresh(w: World, pool: Line[][], a: Actor): Line[] {
  const first = pool.map((p) => p[0][1]);
  const line = fresh(w, first, a);
  return pool[first.indexOf(line)];
}
