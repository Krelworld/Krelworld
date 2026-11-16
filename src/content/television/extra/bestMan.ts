import { parseScreenplay, type TVEpisode } from "../../../game/systems/tv";

// Supplied script ("The Best Man's Speech"). Jenko is Flenky Jenky (James Jenkins) and Rory is Gronny G (Rory
// Burgess), so their own voices play them. Kept as written except: the section where Rory reads out Jenko's old
// texts about Mollor, and the follow-on line comparing Ruth to Mollor, are cut.
// Shot like a real wedding video (tv/Wedding.ts): golden hour, handheld, dissolves, a camcorder for the chaos.
export const BEST_MAN: TVEpisode = {
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
`),
};
