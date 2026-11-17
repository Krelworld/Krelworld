import { parseScreenplay, type TVEpisode } from "../../../game/systems/tv";

// A KrelTV advert for Krelbank, adapted from the user's screenplay note ("11. ADVERT: DUARF CONSULTANTS"), with
// the company renamed and the montage descriptions turned into lines. Played straight, as a glossy bank advert:
// the AdvertDirector (src/game/scenes/tv/Advert.ts) shoots it. No extra gags.

export const KRELBANK_AD: TVEpisode = {
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
ADVISER: Look, Mr Jones, yes we received your down payment, but I'm telling you, it's not the right time to close… who knows what's going to happen to the interest rates between now and the end of the month…
ADVISER: So… there's no easy way of saying this… the escrow has been amortized… We need more…
ADVISER: I could explain what this means… but who are we kidding… you wouldn't understand…
MR JONES: This informational pamphlet of yours says copyright material of Kreddle Exchange!
ADVISER: Now… I need you to create a Binance account… This is bad bad news… the currency cops are cracking down on this…
ADVISER: They have agreed to unfreeze your funds, we just need to send them £10,000 in bitcoin.
INT. KRELBANK END CARD - DAY
CEO: Krelbank. We are Krelbank!
[MUSIC krelbank_ad fade]
`),
};
