import type { Cond, Line, PlayableId } from "../../data/types";
import { beat, canon, dir, ping, say } from "../dsl";

export interface ChapterStep {
  id: string;
  text: string;
  /** The step is complete when this holds. */
  done: Cond;
  /** Where the objective arrow points in the hub. */
  target?: string;
}

export interface ChapterDef {
  n: number;
  title: string;
  subtitle: string;
  dungeon: string;
  dungeonDoor: string;
  steps: ChapterStep[];
  /** Plays when the chapter begins in the hub. */
  intro: Line[];
  /** Short per-player altered scene, played straight after the intro. */
  playerScene: Record<PlayableId, Line[]>;
  /** Plays after the boss, back in Town Hall (chapters 2-6; chapter 1 uses the Krazy Fact meeting). */
  outro: Line[];
}

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: "THE GREAT SILENCE",
    subtitle: "Krelford · Wildern Academy · The Great Pussy Juice Tap",
    dungeon: "wildern",
    dungeonDoor: "WILDERN",
    steps: [
      { id: "s_meeting", text: "Attend the Emergency Reaction Session at the Town Hall", done: { flag: "met_emergency" }, target: "TOWN_HALL" },
      { id: "s_archive", text: "Visit the Historical Archive (the cabinet wants precedent)", done: { flag: "founding_seen" }, target: "ARCHIVE" },
      { id: "s_dungeon", text: "Enter Wildern Academy. Find Kranky Krandall, the zany new headmaster, and turn the Tap back on", done: { flag: "ch1_clear" }, target: "WILDERN" },
      { id: "s_bomb", text: "Wildern has to go. Plant 4 bombs around Wildern Academy and blow it up", done: { flag: "wildern_destroyed" }, target: "WILDERN" },
      { id: "s_report", text: "Report back to the Town Hall", done: { flag: "ch1_fact" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("A Tuesday afternoon in Krelford. The Tap flows. Somewhere, a fizzy bongo is opened. Every phone in the country buzzes at once.", { cine: "ch1_open" }),
      ping("DRONGUS", "🎵 THE KREZZING HOUR — Official Krelworld Anthem — Drongus B. Drippin'"),
      ping("DRONGUS", "New song from me lads. Took me all morning. Genuinely think it's the best one yet."),
      dir("Seen by 9."),
      dir("Ten minutes pass."),
      dir("Seen by 9. No reactions."),
      ping("DRONGUS", "Hello?"),
      ping("DRONGUS", "Did anyone listen to it"),
      dir("An hour passes. Krezmar reacts 😂 to a meme Gronny posted about a leaf blower."),
      ping("DRONGUS", "Why did you react to Gronny but not to me?"),
      ping("DRONGUS", "Are you all deliberately ignoring me ?"),
      ping("DRONGUS", "Notice how there are a few people in the chat what never contribute nothing 😅 it's whatever, don't even give a shit at this point"),
      ping("DRONGUS", "UNTIL SOMEONE REACTS TO MY NEW AI SONG, THERE WILL BE NO MORE LORE.", { cine: "ch1_leave" }),
      dir("DRONGUS B. DRIPPIN' has left the chat.", { sfx: "leave" }),
      dir("High above Krelford, the Great Wiki Citadel's gates slam shut. The sky develops a faint grey tint, like an unloaded page. The word 'TOWN' falls off the Town Hall sign and lands on a pigeon.", { cine: "ch1_gates" }),
      dir("Krelworld runs on lore. And the lore has stopped."),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "I wasn't ignoring it. I was banned. I think. I'm always fucking banned."), dir("You check. You are not banned. This is somehow more unsettling.")],
      KREZMAR: [say("KREZMAR", "I reacted to the leaf blower. I was too distracted by my penis to listen to his song. Oh fuck."), dir("Your thumb hovers over your phone. The Reaction Network is already dark.")],
      KREBLIS: [say("KREBLIS", "Breaking news…."), say("KREBLIS", "Runescape!"), dir("You file it under Strange Occurrences. The filing cabinet is also buffering.")],
      KREZWONK: [say("KREZWONK", "I saw it. I read it. I listened to it. I said nothing. As foretold."), dir("You realise, with horror, that you foretold this specifically so you wouldn't have to do anything about it.")],
      SCROMBUS: [say("SCROMBUS", "I'm usually the one who replies. I'm the one who says 'hang in there bro'. Where was I?"), dir("You were fixing the Wonking Machine. Nobody reacted to that either. You understand him better than you'd like.")],
      KREBON: [say("KREBON", "He's never asked who I am and waited for the answer. I am Krebon, of Twitcher Mutiny."), dir("You touch the hilt of your cane. Six Krez Years. You know what silence does to a man.")],
      CRONGUS: [say("CRONGUS", "He tagged me in it. @LIL' CRONGUS. I was going to reply. I was. I was lurking first."), dir("Lurking, it turns out, looks exactly like ignoring from the outside.")],
      GRONNY: [say("GRONNY", "I posted the leaf blower. It got a react. His song didn't. Ha ha. I am so much better than him! And everyone else!"), dir("It's minus six. You're in shorts. You feel, for the first time in your life, slightly cold.")],
      MIKEY: [say("MIKEY", "I thought he was bluffing. He's always bluffing. FGM rule one."), dir("He wasn't bluffing. The Nuclear Option, it turns out, was his all along.")],
    },
    outro: [],
  },
  {
    n: 2,
    title: "THE INTERVENTION",
    subtitle: "The War Room · Lil' Crongus's Sofa · Polson Towers",
    dungeon: "polson_towers",
    dungeonDoor: "POLSON_ROAD",
    steps: [
      { id: "s_pub", text: "Check out the Krezz Arms (the pub). Have a look round. Kreblis and Drongus riff in there for Krokens.", done: { flag: "ch2_pub_visited" }, target: "PUB" },
      { id: "s_brief", text: "Stage the intervention (FGM War Room, under the Archive)", done: { flag: "fragmar_briefed" }, target: "ARCHIVE" },
      { id: "s_dungeon", text: "Go to Polson Towers and clear out the hoard. The router is in there somewhere.", done: { flag: "ch2_clear" }, target: "POLSON_ROAD" },
      { id: "s_report", text: "Report to the Town Hall", done: { flag: "ch2_fact" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("CHAPTER TWO. The Tap flows again, but Drongus is still set on leaking the chat.", { cine: "ch2_open" }),
      dir("And in the group chat, a message nobody was quite expecting — though everybody was."),
      ping("POLSON", "Hey dude, I'm afraid I have bad news", { cine: "ch2_sos" }),
      ping("POLSON", "After a lot of thought I am fifty percent towards the choice to end things with Eden 😔"),
      ping("POLSON", "If I decide to do it. She will need to move out. It will be a huge end to an era!!!"),
      ping("POLSON", "She told me she wants to take over my trust?? Mum says absolutely not."),
      ping("POLSON", "So I'm breaking up with her. But I need to be rescued. She's commandeered the house."),
      ping("POLSON", "And do you remember that cyst I had removed from my arsehole? It is in cahoots with Eden."),
      ping("POLSON", "It's protecting her and it tries to attack me every time I step foot in the house. I'm so scared."),
      ping("POLSON", "I need someone to kill my arsehole cyst so I can finally break up with that bitch."),
      ping("POLSON", "I'm ok tho!! Wbu? 😅"),
      say("KREZWONK", "Fuck. Polson is in crisis. This needs the War Room.", { cine: "ch2_warroom", role: true, proctus: "This needs the War Room. I've never been allowed in the War Room." }),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "He's my mate. Whatever happens, he's got us."), dir("You mean it. That's new.")],
      KREZMAR: [say("KREZMAR", "This could easily be the plot for a three-part thriller on ITV."), dir("It could. It's about to be a dungeon instead.")],
      KREBLIS: [say("KREBLIS", "Couldn't someone just have a quiet word with Polson"), dir("Someone could. Several someones are about to.")],
      KREZWONK: [say("KREZWONK", "Tomorrow afternoon would be a prime time for an intervention. We need to invade his house, destroy all of Eden's clutter and crap, and then fucking kill that arsehole cyst.")],
      SCROMBUS: [],
      KREBON: [],
      CRONGUS: [],
      GRONNY: [say("GRONNY", "Polson's turning his phone off. He's getting very anxious and upset but he's with me if anyone needs him."), dir("You've said this exact sentence before. It still applies.")],
      MIKEY: [say("MIKEY", "I was right about all of it. About that bitch Eden. I was right.")],
    },
    outro: [
      dir("Town Hall. The giant reaction display on the wall flickers back on. One by one, the reaction icons light up: 👍 ❤️ 😂 😡."),
      dir("The first reaction through the restored network, after months of nothing: ❤️ from POLSON.", { cine: "ch2_network" }),
      say("KREBLIS", "We saved Polson! We could the second cum crystal! Yee!"),
      say("KREBLIS", "Polson's reacting again", { cond: { notPlayer: "KREBLIS" } }),
      say("KREBLIS", "Mostly thumbs up. To everything. Including the breakup. Classic 👍", { cond: { notPlayer: "KREBLIS" } }),
      say("POLSON", "(on the speakerphone) Lads!! Thank you. Genuinely. I owe you all ❤️"),
      say("POLSON", "I've got a list!! Gym. Get trim. Travelling. In that order. Papa Gino's first though 😅 The deed is done"),
      say("KREZWONK", "Five days left on the countdown."),
      beat("ch2_close"),
    ],
  },
  {
    n: 3,
    title: "THE CUDDLE CRONSTER",
    subtitle: "Sweet Hugs · Sweeter Squeezes · Da Squeezing Room",
    dungeon: "ministry",
    dungeonDoor: "MINISTRY",
    steps: [
      { id: "s_brief", text: "KRELMERGENCY at the Town Hall: the Cuddle Cronster has taken Mollor", done: { flag: "cronster_briefed" }, target: "TOWN_HALL" },
      { id: "s_police", text: "The police briefing, then the Cronster's chocolate trail (find six cuddle tokens, hand them to Swig)", done: { flag: "arcstep_arc_cronster_handin" }, target: "POLICE" },
      { id: "s_dungeon", text: "Storm the Ministry of Boner Control. Climb to Da Squeezing Room, unmask the Cronster, rescue Mollor", done: { flag: "ch3_clear" }, target: "MINISTRY" },
      { id: "s_report", text: "Report to the Town Hall", done: { flag: "ch3_fact" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("CHAPTER THREE. Krelford is in the icy grip of terror. Every lamppost has a chocolate coin taped to it. An ominous criminal known as the Cuddle Cronster has been squeezing the female inhabitants of Krelford under cover of darkness to 'extract their juices'. Each of his chocolate coins says 'Lovely jubbly pussy juice.'", { cine: "ch3_open" }),
      ping("FLENKY", "LADS"),
      ping("FLENKY", "MOLLOR'S GONE", { cine: "ch3_gone" }),
      ping("FLENKY", "THERES A NOTE. ITS GOT A SMILEY FACE ON IT. THE CUDDLE CRONSTER HAS ABDUCTED MY 19 YEAR OLD GIRLFRIEND MOLLOR"),
      ping("FLENKY", "TOWN HALL NOW"),
      ping("POLSON", "Lads!! Before the meeting can someone take me to the gym?? Intense workout 💪"),
      ping("SCROMBUS", "Polson. Mollor has been abducted."),
      ping("POLSON", "That's fair.. but I've already got my trainers on 😅"),
      ping("SCROMBUS", "Fine. Somebody take Polson to the gym. THEN the Town Hall."),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "Mollor. My Mollor. Whoever this Cronster is, I'm going to burst him. One punch. Like the headmaster when I was four."), dir("You crack your knuckles. Something about the handwriting on the note looks… familiar. You decide not to think about it.")],
      KREZMAR: [say("KREZMAR", "Chocolate coins. The cuddle cronster leaves behind chocolate coins. He is one sick CUNT. Yee.")],
      KREBLIS: [],
      KREZWONK: [],
      SCROMBUS: [],
      KREBON: [],
      CRONGUS: [say("CRONGUS", "As Children's Minister, I've been asked to say: Mollor is nineteen. She's an adult. Please stop ringing me."), dir("You put the phone down. It rings again.")],
      GRONNY: [say("GRONNY", "Me no like cuddles. Me like pussy juice. Me am Rory.")],
      MIKEY: [],
    },
    outro: [
      dir("Town Hall. Mollor is home safe. The Ministry of Boner Control is back to controlling boners. Nobody asks how."),
      say("FLENKY", "I want it on the record. I was NOT the Cronster. That was a different Jenko.", { cond: { notPlayer: "FLENKY" } }),
      say("KREBLIS", "Breaking news…", { role: true, proctus: "Breaking news! It was Jenko! No it wasn't! Yes it was!" }),
      say("KREBLIS", "It was Jenko 👍", { cond: { notPlayer: "KREBLIS" } }),
      say("KREZWONK", "Four days left until the chat logs leak. We still have time. The cum crystals are starting to line up."),
      beat("ch3_close"),
    ],
  },
  {
    n: 4,
    title: "NIBBLE ON A CROBLEY",
    subtitle: "Reinhardt Crobley · The Factory · Cum Crystal Number Four",
    dungeon: "crobley_factory",
    dungeonDoor: "CROBLEY_FACTORY",
    steps: [
      { id: "s_tv", text: "Krelmergency in the FGM War Room (under the Archive): something huge is on KrelTV, on every channel.", done: { flag: "vig_crobley_news" }, target: "ARCHIVE" },
      { id: "s_brief", text: "Krelmergency briefing in the FGM War Room (under the Archive): what do we do about Reinhardt Crobley?", done: { flag: "crobley_briefed" }, target: "ARCHIVE" },
      { id: "s_presser", text: "Sergeant Swig is holding a press conference about the live-TV murder. Krelford Constabulary.", done: { flag: "vig_crobley_presser" }, target: "POLICE" },
      { id: "s_trail", text: "Find Reinhardt's five golden Crobley wrappers (5): the first outside the Constabulary, the rest indoors. The factory gate won't open without them", done: { flag: "trail_ch4_wrappers_done" }, target: "POLICE" },
      { id: "s_dungeon", text: "Storm the Crobley Factory (the gate on the east edge of town). Kill Reinhardt. Take cum crystal number four.", done: { flag: "ch4_clear" }, target: "CROBLEY_FACTORY" },
      { id: "s_report", text: "Report to the Town Hall", done: { flag: "ch4_fact" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("CHAPTER FOUR. Crobley Corporation, makers of the nation's favourite chewy sweet, has a new boss: Reinhardt Crobley. Nobody has seen old Mr Crobson for a week. The new adverts have started. They are on every channel. All the time.", { cine: "ch4_open" }),
      say("KREBLIS", "Breaking… something's wrong with the Crobley advert. I love Crobleys, the infamous candy of Krelworld! Who can forget their flavor of sweet and sugariness! But that new advert…something is amiss..", { role: true, proctus: "Something's wrong with the Crobley advert! I've seen it forty times! I can't stop humming it! Help!" }),
      say("KREBLIS", "I can't stop humming it", { cond: { notPlayer: "KREBLIS" } }),
      say("KREBLIS", "Help", { cond: { notPlayer: "KREBLIS" } }),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "Crobleys were the only sweet my mummy let me have. That and pussy juice."), dir("Something's on every channel. You already know what it is.")],
      KREZMAR: [say("KREZMAR", "Crobley Corp shares are up four hundred percent since the new advert started. I'm not saying I bought some. I'm saying I'm not NOT saying it."), dir("Krezmar, Minister of Money and Loans, has a conflict of interest. Several.")],
      KREBLIS: [say("KREBLIS", "Breaking news…"), say("KREBLIS", "the news is about to be broken. That's the breaking news. Breaking news: breaking news! Yeeee! 👍"), dir("You don't know what that means. Neither does Kreblis. It turns out to be accurate.")],
      KREZWONK: [say("KREZWONK", "I foresaw a sweet. A chewy one. With a face. Screaming. Crobleys, they call them. I love hip hop music such as Aesop Rock."), dir("You thought it was a metaphor. It's never a metaphor.")],
      SCROMBUS: [],
      KREBON: [say("KREBON", "Six Krez Years I dreamed of a Crobley. One Crobley. Now look at it."), dir("You touch the hilt of your cane. Some things are worth fighting for. Sweets, mainly.")],
      CRONGUS: [say("CRONGUS", "Children's Minister. Children's sweets. Children's advert. This is my jurisdiction."), dir("Lil' Crongus, ministering.")],
      GRONNY: [say("GRONNY", "Crobley. Me like Crobley. Me are Rory A.K.A. Gronny G. Waa waa wee waa.")],
      MIKEY: [],
    },
    outro: [
      dir("Town Hall. Everyone smells faintly of krezz and feminine juices. Lovely and arousing."),
      say("KREBLIS", "Krelmergency over… Crobley Corp HQ is a crater"),
      say("KREZWONK", "Four crystals. Two to go. And something in the Krezz Arms back room is glowing.", { role: true, proctus: "Four crystals! Something's glowing in the pub! It's probably a lamp! It's always a lamp!" }),
      dir("In the wreckage of the factory: another scrap of map. 'TEMPLE OF THE LOGS — PIECE 4 OF 5'."),
      beat("ch4_close"),
    ],
  },
  {
    n: 5,
    title: "THE SANMIKVERSE",
    subtitle: "",
    dungeon: "arena_sanmik",
    dungeonDoor: "SANMIK_LAMP",
    steps: [
      { id: "s_question", text: "Attend 'The Krebon Question' at the Town Hall (it's not really about Krebon)", done: { flag: "krebon_question" }, target: "TOWN_HALL" },
      { id: "s_dungeon", text: "Rub SanMik's magic lamp in the Krezz Arms back room. Get to Catford. Defeat Uncle Rik for the fifth cum crystal", done: { flag: "ch5_clear" }, target: "PUB" },
      { id: "s_report", text: "Report to the Town Hall", done: { flag: "ch5_fact" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("CHAPTER FIVE. The back room of the Krezz Arms is glowing. Something in there smells of corn. Every few minutes, faintly, through the wall: 'yee'.", { cine: "ch5_open" }),
      ping("DRONGUS", "Who the fuck is Krebon"),
      ping("DRONGUS", "Also who the fuck is SanMik"),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "I've been banned from the Krezz Arms back room twice. A woman falsely claimed that I made her feel uncomfortable. I did no such thing. I was just horny."), dir("You're going in anyway.")],
      KREZMAR: [say("KREZMAR", "Apparently there's a fackin genie in the krezz arms wiv a A fackin magic lamp. Wishes. Unlimited wishes, you could get so much pussy juice and even ass juice if you wanted."), dir("Krelfund opportunity detected.")],
      KREBLIS: [say("KREBLIS", "Strange occurrence… love runescape and gear…"), say("KREBLIS", "A pub back room is now a different dimension 👍"), dir("You file it under 'Catford'.")],
      KREZWONK: [say("KREZWONK", "I wrote none of the SanMikverse. Nobody did. It writes itself. That's what scares me."), dir("Be careful what you lore.")],
      SCROMBUS: [say("SCROMBUS", "SanMik's discography is load-bearing lore now. Peener 4eva. Jerk My Gherk. GTA: SanMik. If he goes, the canon goes."), dir("Ministry of Lore: report to the back room.")],
      KREBON: [say("KREBON", "While under the bridge eating my dinner…."), dir("You grip your cane. Somewhere, very faintly: 'yee'.")],
      CRONGUS: [say("CRONGUS", "As Children's Minister I've been briefed on Uncle Rik. That man is a sick cunt. The shit he did to SanMik as a child. Fuck me… ."), dir("Children's Minister, investigating.")],
      GRONNY: [say("GRONNY", "Hot tub. Shorts. Finally."), dir("For the first time in the campaign, you're dressed for the occasion.")],
      MIKEY: [say("MIKEY", "I found the lamp. I want that on the record. Mikey found the lamp."), dir("It's on the record. Nobody reacted.")],
    },
    outro: [
      say("SANMIK", "Yee."),
      say("SANCHZ", "YEGHHH."),
      say("KREZWONK", "Uncle Rik's out of the tub. The crystal's ours. The SanMikverse holds. Which means the canon holds. Which means Da Drongus Dungeon can't keep us out much longer.", { role: true, proctus: "The uncle's out! The crystal's in! The tub's empty! I prophesied that! Just now!" }),
      say("KREZWONK", "Just one more cum crystal, and we advance to DA DRONGUS DUNGEON. And we delete those chat logs."),
      beat("ch5_close"),
      dir("Tomorrow, as it turns out, has other plans."),
    ],
  },
  {
    n: 6,
    title: "THE KREDDLE EXPRESS",
    subtitle: "",
    dungeon: "airport",
    dungeonDoor: "AIRPORT",
    steps: [
      { id: "s_brief", text: "KRELMERGENCY: the lads are glued to the telly in the FGM War Room (under the Archive). Something's on Krunche News.", done: { flag: "arcstep_arc_klerble_brief" }, target: "ARCHIVE" },
      { id: "s_dungeon", text: "Get to Krelford International, get on Flight KR-069 and fly it into the Kreddle Express before it reaches the Krel Tower", done: { flag: "kreltower_resolved" }, target: "AIRPORT" },
      { id: "s_meeting", text: "KRELMERGENCY: the Krel Tower is gone. Emergency meeting at the Town Hall", done: { flag: "revenge_meeting" }, target: "TOWN_HALL" },
      { id: "s_raid", text: "Lead the Krew over the Kreddle Bridge (far west). Revenge. Chemical. Total.", done: { flag: "nuke_planted" }, target: "KREDDLE_BRIDGE" },
      { id: "s_return", text: "THE NUKE IS ARMED. Get back to the Town Hall before it blows!", done: { flag: "ch6_clear" }, target: "TOWN_HALL" },
    ],
    intro: [
      dir("CHAPTER SIX. You were on your way up to Da Drongus Dungeon. Crystals in your pocket. Thumbs ready. Then every telly in Krelford switched itself on at once."),
      dir("It's Kreddle. It's President Klerble. He's smiling. That's never good."),
      ping("DRONGUS", "Oh for fuck's sake"),
      ping("DRONGUS", "I was READY. I'd done my hair"),
      ping("MIKEY", "War Room. Now. It's on Krunche News"),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "Mollor works on the top floor of the Krel Tower. If Kreddle so much as looks at it, I'm going dark Jenko again. I'm going to go reyp mode."), dir("You check you've still got the mask. You've still got the mask.")],
      KREZMAR: [say("KREZMAR", "Kreddle. Their entire economy is betting. I respect it. I hate it. I respect it."), dir("Krelfund exposure to Kreddle: considerable.")],
      KREBLIS: [say("KREBLIS", "Krelmergency…"), say("KREBLIS", "Kreddle is on the telly 👀"), dir("The Kreddle Krunchers took Mikey's bongo. This is personal now.")],
      KREZWONK: [say("KREZWONK", "I have foreseen a train. I don't know why. I've never foreseen a train before."), dir("The vision is very loud. It goes 'YES! YES! YESSS!'")],
      SCROMBUS: [],
      KREBON: [],
      CRONGUS: [],
      GRONNY: [say("GRONNY", "Grenny copy me. Grenny say waa waa wee waa. That MY waa waa wee waa.")],
      MIKEY: [],
    },
    outro: [
      dir("Town Hall. Somebody has stuck a Kreddle Express ticket to the noticeboard. It's a one-way. It's been punched."),
      say("KREZMAR", "Well. The train's stopped. The Kreddle Krunchers are going to hear about this."),
      say("MIKEY", "Good. Tell them I want my dignity back.", { variants: { MIKEY: "Good. Tell them Polson wants his shake back." } }),
      say("KREZWONK", "Six crystals. All six. The vision's gone quiet. It's never quiet.", { role: true, proctus: "Six crystals! The vision's gone quiet! I've never heard it quiet! I don't like it!" }),
      ping("DRONGUS", "Right"),
      ping("DRONGUS", "Done with your little train?"),
      ping("DRONGUS", "Come up then. All of you. Bring your crystals. Bring your thumbs."),
      say("KREZWONK", "Da Drongus Dungeon. The Temple of the Logs is at the very top. Behind the song."),
    ],
  },
  {
    n: 7,
    title: "DA DRONGUS DUNGEON",
    subtitle: "",
    dungeon: "citadel",
    dungeonDoor: "CITADEL",
    steps: [
      { id: "s_final", text: "Attend the Final Reading (Town Hall)", done: { flag: "final_reading" }, target: "TOWN_HALL" },
      { id: "s_dungeon", text: "Six cum crystals, six slots. Open Da Drongus Dungeon and climb to the very top. Find the lads.", done: { flag: "ch7_clear" }, target: "CITADEL" },
    ],
    intro: [
      dir("CHAPTER SEVEN. The Citadel gates are open. Through them: black stone, stained glass, server racks humming in the dark, and a staircase going up into the storm."),
      ping("DRONGUS", "There's a new sheriff in town boys…"),
    ],
    playerScene: {
      FLENKY: [say("FLENKY", "Last time I went up against Drongus I got banned until the Queen died."), dir("This time, nobody's dying. Probably. Let's all be honest lads.")],
      KREZMAR: [say("KREZMAR", "I've got eleven Krezzcoin and an Uber Eats voucher. For the krelfund. For him."), dir("You hope it helps. You suspect it won't. You bring it anyway.")],
      KREBLIS: [say("KREBLIS", "This is a Krelmergency message. I repeat. This is the final Krelmergency message"), say("KREBLIS", "Wait…sorry…"), say("KREBLIS", "I've got one more after this"), dir("Probably. There's always another one.")],
      KREZWONK: [say("KREZWONK", "I've foreseen this moment. I'm going to press a button. I've never pressed a button."), dir("The idea of Krezwonk is about to meet the man.")],
      SCROMBUS: [say("SCROMBUS", "I'm here 4 u. I said that. I meant it. I'm here to beat the shit out of u and then I'm here 4 u."), dir("Supportive during Lore creation. Supportive during Lore destruction.")],
      KREBON: [say("KREBON", "He asked who I was. Two years. He never waited for the answer."), dir("He's going to get it now.")],
      CRONGUS: [say("CRONGUS", "He tagged me in every post. @LIL' CRONGUS. Every one."), dir("You never once replied. Time to reply.")],
      GRONNY: [say("GRONNY", "He's still got my trousers."), dir("Final objective, revised: react to the song. Recover Krez-ousers.")],
      MIKEY: [say("MIKEY", "FGM ULTRA. One last op. Classification: extremely petty."), dir("As it should be.")],
    },
    outro: [],
  },
];

export function chapterDef(n: number): ChapterDef {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, n - 1))];
}
