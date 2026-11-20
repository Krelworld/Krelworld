# KREPLIN: deeper systems (design for sign-off)

Status: **APPROVED by the owner (build order: backbone → press → drugs → corruption → texting → Tinder).** See 'Owner decisions' below. The top half is for the owner. The appendix is for whoever builds it.

---

## 1. The backbone: Evidence → Leak → Consequence

Right now most dirty deeds just add one or two points to a hidden risk number, and the game forgets about them. Under this design, every dirty act (a bag of coke, a bribe, a sext, a Tinder date, a doped striker) leaves a piece of **evidence** with a name, a date and a witness. Evidence can **leak**. A journalist picks it up as a *story lead*, digs for a few matches, and you can watch the countdown. You can kill the story, bury it, or let it run. A story that runs has **consequences**: lost reputation, sponsors pulling out, the board, your marriage, the FA, the police. Those feed back into money, results and the story. Every system below plugs into this one loop, so they all affect each other.

> **Tiny example.** Week 6: you buy two bags from Marco on credit and tell your secretary "I'm a GOD tonight" at 2am. That's two pieces of evidence: a dealer debt and a text. Week 8: Marco wants his money and you're short, so he "mentions" you to a mate at the *Daily Echo*. The lead **"SAINTS SUPREMO'S SNOW DAY"** shows a 3-match countdown. You can pay the editor £400k, threaten Marco (he owes *you* a favour from the stadium dealing), or leak Delmor's offshore account to give the paper something bigger. You leak Delmor. Week 9: Delmor texts you a photo of your own car, set on fire.

---

## 2. The five systems

### 2.1 Texting

**Today**
- Seven contacts (secretary, captain, captain's wife, manager, Marco, Delmor, women's manager). You send one of five tones and get back one weighted-random line. There is no follow-up and nobody remembers anything. The secretary has her own richer builder (relationship, trust and risk out of 100).
- Unread texts pile up with no cost for ignoring them. You can't text your wife at all. Delmor's taunts are good but one-way.
- The captain's-wife affair uses a bare browser `confirm()` box. A paparazzi hit is a flat 20% roll.

**After**
- Conversations go **2–3 messages deep**. Each reply offers 2–3 follow-ups, and what they say depends on how they feel about you (warmth, trust, fear, lust).
- **Memory and callbacks.** Characters bring up what you said weeks ago ("You called me 'mate' at 3am and asked if I was 'in the game'. Are you in the game, Kreplin?").
- **New contacts:** your **wife** (seasons 1–3; what happens after she leaves for Delmor is open question 1), a **journalist** once a lead exists, and Tinder matches.
- **Ignoring texts costs you.** Unread texts go stale after 2 matches. The wife cools off, the captain sulks (morale), Marco adds interest and the secretary's trust drops. Some texts carry a deadline ("reply by kickoff or I go to the papers").
- **Anything you send can become evidence.** Erotic, threatening or high texts get stored, and the other person can screenshot them.

**Examples**

> **Wife:** You coming to Ellie's recital or is it a "board meeting" again
> → *"Board meeting. Very serious. Lots of graphs."*
> **Wife:** The board meeting is at the Harvester. Your card just pinged there. Twice.
> → *"Those are tactical prawns."* / *"I'll be there, I promise."* (promise remembered; break it and she brings it up at the next fight)

> **Marco:** u still owe me for the 3 bags + the "favour" at the turnstiles
> **Marco:** my cousin says ur left wing back has a very nice mum. just saying
> → *"Friday. Cash."* / *"Do you know who I am?"* (Marco: "yeah. the bloke who owes me £60k")

**Feeds into:** evidence (screenshots), relationships, morale, wife and marital risk, Marco debt, journalist leads.

### 2.2 Tinder (season 4)

**Today**
- The profile builder and swiping work. Only **Sarah** matches unless your profile is facetuned. The other profiles have no agenda.
- The chat menu is tone buttons. Inviting someone home leads to one bleak encounter ("You feel nothing"), a +1 loneliness tick and a sharia-police adultery risk.
- Matches are never heard from again.

**After**
- Every match has a **personality and a hidden agenda**:
  - the **Journalist** (fishing for quotes and photos)
  - the **Portsmouth plant** (sent by Delmor, plants a phone in your house)
  - the **Gold-digger** (blackmail with a price list)
  - the **Genuine one** (Sarah, by default), a recurring arc that runs across the season.
- Small tells hint at the agenda ("asks a lot about the board", a Pompey mug in photo 3). Surveillance (see 2.5) reveals it outright.
- **Dates have outcomes:** photos taken, kiss-and-tell, blackmail, a useful **alibi** ("he was with me all night, officer"), or a real connection.
- Matches keep **texting you afterwards** through the phone, with callbacks to the date.
- All the existing bleak text stays. The genuine arc is the one place it can turn warmer (open question 5).

**Examples**

> **Gemma, 34, "media":** So what's it REALLY like running a club? Any skeletons 😉 off the record obviously
> → *"Off the record? I once paid a linesman in Greggs vouchers."* → new evidence; Gemma's lead jumps 2 stages.

> **Date outcome, the plant:** You wake up. She's gone. So is your tactics folder, your house keys and your dignity. Delmor texts: "Lovely 4-4-2 mate. Shame about the left back." (next Pompey match: opponent +3 strength)

**Feeds into:** evidence, leads (kiss-and-tell), Delmor rivalry, loneliness, alibis against police cases.

### 2.3 Cocaine, steroids & HGH

**Today**
- Coke has a streak counter: bags needed go 1-2-3-4, then a guaranteed overdose and 2–4 games in rehab. A crash state exists, but the "buzzed/wired" states that should drive it are **never actually set**, so most of the effects are dead.
- HGH: the chairman takes it to become "muscular and handsome". Giving it to players adds +3 rating with a heart-attack risk. Season 5 has a doping strategy. The pre-match "player failed a drug test" event is written but **never triggered** (its trigger function doesn't exist).
- Marco sells for cash up front only. There is no debt, and the "DERANGED" action set was switched off.

**After**
- **Tolerance and addiction.** Every use raises tolerance (you need more for the same buzz) and addiction (cravings appear as intrusive menu options). Both decay slowly when you're clean. The existing bag ladder and overdose stay and sit on top of this.
- **Real highs and crashes.** High: bribes land better, team talks hit harder, and the **DERANGED** options come back, with fresh pools that rotate. Crash: halved team talks, paranoia texts at 4am, missed fixtures.
- **Side effects:** nosebleeds in the press box, a heart scare, the wife finding a bag. Each one is evidence.
- **Dealer credit.** Marco gives you credit. Debt grows weekly, and he calls it in at awkward moments (outside the board meeting, during the daughter's recital). If you don't pay he sends heavies, leaks you, or asks for a "favour".
- **Doped players.** Steroids and HGH give a real boost but stack **FA heat**. Random drug tests become possible, and failures mean bans of 2–6 matches. The FA escalates from a warning to targeted testing to a squad-wide raid.

**Examples**

> **DERANGED (high):** "Ring the referee's mum and tell her he's been 'very brave'." She cries. The ref gives you two penalties. Police risk +6.

> **Crash, 4:12am:** You text the captain "do u ever think the ball is watching us". He replies at 7am: "Gaffer are you ok." Morale −3. Screenshot saved.

**Feeds into:** match strength, evidence, FA/police heat, Marco favours, marriage, rehab.

### 2.4 Press, leaks & news

**Today**
- `addPaper()` adds to one "paper risk" bar and a list nobody reads, except a single FA check that quotes one random item.
- The news portal publishes sports/politics/gossip stories **immediately**, with small stat effects. A gossip story about an affair triggers a wife confrontation.
- There is no warning, no countdown and no way to stop a story, apart from fighting or bribing a lawsuit afterwards.

**After**
- **Leads.** A juicy piece of evidence becomes a lead on a named journalist's desk. It shows in the news portal and on a HUD chip: *"Echo: CHAIRMAN'S SECRETARY SEXTS — runs in 3 matches"*.
- **The journalist develops it** each matchday (rumour, then source, then corroborated, then printed). More evidence on the same theme speeds it up.
- **Kill it:** bribe the editor (money, plus a new bribery piece of evidence), threaten the source (works on Marco or the secretary, can backfire), or take out a **super-injunction** (very expensive, and has its own "who's the gagged chairman?" story).
- **Bury it:** leak something worse about Delmor (needs dirt from surveillance or a favour). Delmor retaliates later.
- **Published stories hit** reputation, sponsors (club cash), board support and the marriage, and the big ones open an FA or police case through the existing knock-door route.
- Existing scandals (Shafty Rod, the St Mary's attack, lawsuits) are unchanged and still bypass the queue.

**Examples**

> **Lead, stage 2/4:** *Southern Daily Echo, Lucy Phelps:* "A source close to the club describes the chairman's office as 'basically a Colombian ski resort'." **Runs in 2 matches.**
> → Bribe editor (£350k) / Lean on Marco (he owes you one) / Feed her Delmor's tax return

> **Published:** **"KREPLIN'S SECRET PHONE: 'I AM THE PITCH'"**: Sponsor *Bargain Bathrooms* pulls out (−£1.2m). The board calls an emergency vote. Your wife changes the Wi-Fi password.

**Feeds into:** reputation, sponsors and club cash, board vote, marriage, FA/police investigations, Delmor rivalry.

### 2.5 Corruption: favours & the Power Network

**Today**
- Bribes exist in many places (ref, directors, FA official, season 5 survival bribes). They add to a bribe count and risk numbers. `registerBribe()` is defined, but nothing calls it.
- Lobby tokens buy Power Network perks (emergency points, transfer act, Number 10, Trident, briefcase). **Policy favour, Surveillance and Blackmail have working click handlers but no buttons in the pane.** Policy favour already gives +2 strength for one match. Surveillance and Blackmail only set a flag that nothing reads.
- Nobody owes anybody anything.

**After**
- **A favours ledger.** Bribes, hush money and dirty help create **IOUs** in both directions ("Ref Dowd owes you 1", "You owe Marco 2", "You owe the Home Office 1").
- **You call in favours you're owed:** a soft penalty, a lost document, a story killed, a test sample "contaminated".
- **Favours you owe get called in at the worst moment.** Examples: play a Marco cousin at left back, sign a minister's nephew, lose to Pompey "a bit". Refuse and it becomes evidence against you.
- **Surveillance perk:** shows the hidden stage and source of every active lead, reveals Tinder agendas, and gives you **dirt** on the next opponent or Delmor (usable for burying stories).
- **Blackmail perk:** turns dirt on someone else into a favour they owe you. The current "someone drops out before kickoff" line now really happens (a key opponent misses the match).
- **Policy favour** gets its button back. Unchanged effect.

**Examples**

> **Favour called in (Minister Hollis):** "The PM's nephew Tarquin is 'very keen on football'. He'll be starting Saturday, yes?" → Start him (−4 strength, Hollis −1 IOU) / Refuse (Hollis leaks your Number 10 visits)

> **Blackmail:** You show the Burnley keeper a photo of himself at a Wetherspoons with Delmor's wife. He develops "a hamstring". Burnley start their 16-year-old. Police risk +3.

**Feeds into:** match strength, leads (kill/bury), FA/police, lobby tokens, Delmor.

---

## 3. What stays exactly as it is

- **All existing text**: every line, pool, video, headline, taunt and Delmor message. New lines are **added** to pools, never swapped in.
- **All story beats and endings**: the season 4 opening (the wife leaves for Delmor), Sarah, the bleak Tinder encounter and the sharia police, Shafty Rod, the St Mary's attack, Ultima Cup, Trident, prison, rehab, the season 5 survival economy.
- **Existing mechanics** keep their effects: the coke bag ladder and overdose, HGH heart attacks, the secretary builder and its arrests, lawsuits, the knock-door investigations, FA discipline steps and board votes. The new systems feed into them instead of replacing them.
- **Tone**: crude, absurd, bleak where it is already bleak.

---


## Owner decisions (answers to the open questions)
1. **Ex-wife keeps texting** — after she leaves for Delmor she becomes "Ex-wife (at Delmor's)": taunts, and occasionally feeds you usable Delmor dirt.
2. **Leaks add heat only** — published stories hit reputation/sponsors/board/marriage and raise FA/police heat; the existing investigation system decides prison/rehab.
3. **Countdown is vague unless Surveillance** — tabloid hints by default; the Surveillance perk reveals exact stage and source.
4. **Bans can hit anyone** — named story players too; story code must handle their absence gracefully.
5. **Sarah stays bleak** — the genuine Tinder arc ends with her leaving whatever you do; no warm ending.

## 4. Open questions for the owner (answered above)

1. **The wife after season 4.** Once she has left for Delmor, does her contact (a) disappear, (b) become "Ex-wife (at Delmor's)" and keep texting, feeding you Delmor dirt or taunting you, or (c) go one-way with read receipts only?
2. **How lethal leaks can be.** Can a published story **directly** send you to prison or rehab (big drama, fewer second chances), or should it only add heat that the existing investigation system then rolls on (today's pacing)?
3. **How much the countdown shows.** Show exact stages and percentages ("runs in 2 matches, 70% sourced"), or vague tabloid hints unless you own Surveillance (more tension, less control)?
4. **Who drug bans can hit.** Can steroid bans hit named story players (the captain, legends), or only generic squad members, so story arcs never break?
5. **The genuine Tinder arc.** Can it end **warm** (a real partner who lowers loneliness and can even save you from one leak), or must season 4 stay bleak to the end, with her eventually leaving too?

---

## Appendix: implementation notes (developers)

### A. State shape (all on `S`, defaulted in the load path)

```js
S.evidence   = [ { id, kind, // 'coke'|'steroid'|'bribe'|'text'|'tinder'|'affair'|'favour_refused'|'paper'|'planted'
                   label, weight /*1-30*/, week, season, witness /*contactId|null*/,
                   tags:['drugs','sex','corruption',…], leaked:false } ]
S.leads      = [ { id, evidenceIds:[], journalist, outlet, theme, stage /*0-3*/,
                   progress /*0-100*/, runsIn /*matches*/, killed:false, buried:false } ]
S.favours    = [ { id, who, dir:'owed_to_me'|'i_owe', count, origin, dueBy /*match#|null*/ } ]
S.dirt       = [ { id, on:'delmor'|oppClub|person, label, weight } ]       // from Surveillance etc.
S.relationships = { [contactId]: { warmth, trust, fear, lust, memory:[{key,week,text}],
                                   promises:[{key,dueWeek}], staleUnread:0 } }
S.drugs      = { tolerance:0, addiction:0, debt:0, debtWeeks:0, lastUse:-1,
                 state:'sober'|'buzzed'|'wired'|'crashing' }               // writes S.coke_state too
S.fa_heat    = 0;    // doping-specific; feeds S.legal_risk on publish/test fail
S.tinder     = { matches:[{ name, agenda, revealed:false, arcStage, dates:0 }] } // wraps S.season4.tinder_matches
S.lineMemory = { [poolKey]: [recentIndexes] }   // cooldown for every new text pool
```

**Name clash:** `S.evidence` already exists as an **object map** `{playerId:"drugs"}`. It is written in `071-cocaine-impulse.js:315` and read via `Object.keys` in `049:308`. On migration, convert each entry to `{kind:'planted', …}` and change those two sites to push into and filter the array. `S.addiction` (per-player) stays. The chairman's numbers go in `S.drugs`.

### B. Existing code to extend (not replace)

| System | Extend | Notes |
|---|---|---|
| Core | `addPaper()` / `burnPaper()` (031-data.js:1013) | `addPaper` also calls a new `recordEvidence({kind:'paper'})`. Keep `paperRisk`/`paperTrail` for `faSanctionsCheck`. |
| Core | `registerBribe()` (016:1353) | Call it from every bribe site. It records evidence and creates a favour. |
| Texting | `initPhoneSystem`, `openPhoneContacts` list, `sendText`/`randomReply`/`applyEffects`, `checkPhoneEvents`, `queueIncomingText` (079) | Add a `THREADS[contact]` data table of 2–3-step branches gated on relationship. `randomReply` stays as the fallback. Replace the `confirm()` in the captain's-wife affair with `choose()`. |
| Secretary | `openSecretaryMessaging` (031:1850) | Map `secRel/secTrust/secRisk` into `S.relationships.secretary`. Don't fork it. |
| Tinder | `generateTinderProfilePool`, `checkTinderMatch`, `generateTinderResponse`, `handleTinderInvitation`, `applyTinderPostEncounterEffects` (083) | Assign an agenda at match time. Branch outcomes after the existing encounter text. |
| Drugs | `takeCocaine` (057:46), `applyCocaineStateEffects` (049:207), `matchday:end` crash (053:433), `presentPlayerDrugScandal` (053:502), `giveHGHToPlayers` (022:58), `handleSeason5DopingStrategy` (023:245) | Set `coke_state` in `takeCocaine` (fixes the dead buzzed/wired effects). Define the missing `maybePlayerDrugScandal()` (called at 020:2666 and 023:545) with a drug-test roll driven by `fa_heat`. Re-enable `mountDerangedActions` behind `S.drugs.state`. |
| Press | `createStory`/`queueStory`/`publishStory`/`applyStoryEffects`, `openNewsPortal` (032) | A lead publishes through `createStory(...)` + `queueStory`. Add effect keys `sponsor`, `board`, `investigation:{authority,caseType}` to `applyStoryEffects`. |
| Oversight | `queueInvestigationSafe` (051:24), `maybeQueueOversight` (047) | Published leads queue cases. `maybeQueueOversight` adds evidence weight to its aggregate. |
| Power | `renderPowerNetwork` perk rows (017:506–560) and handlers (017:659, 773, 781) | Add `perkRow` for policy-favour, surveillance and advanced-blackmail. Have something consume `power_last_espionage`/`power_blackmail_pending`. |

### C. Cadence & cooldowns (GameHooks)

- `matchday:end`: advance leads (progress += 15–35 + evidence weight; stage at 25/50/75/100), age unread texts (`staleUnread`), apply Marco debt interest (10%/week, called in after 3 weeks), decay tolerance (−5) and addiction (−2 if clean), decay `fa_heat` (−3).
- `prematch`: the drug-test roll (`fa_heat`/200, max 25%, at most once every 3 matches), at most **one** favour called in per match (35% if any are due), and Marco collection if the debt is overdue.
- `postmatch:end`: extended `checkPhoneEvents`, with **at most 2 unsolicited texts per phase** in total.
- `evening`: Tinder date outcomes, the wife/secretary promise checks, and the 4am crash texts.
- `oversight`: route leads published this match into `queueInvestigationSafe`. Respect the existing `_investigationCooldown`.
- Caps: at most **3 active leads** and **1 publication per match** (special stories exempt, as today). A dirt/favour can bury or kill only one lead each. Every new line pool goes through `pickLine(poolKey, pool)` with a no-repeat window of `min(8, pool.length-1)`.

### D. Save migration

In the load normaliser (031-data.js ~line 700, next to the `paperTrail` guard):
- Default every structure in A. Add `fa_heat` to `numericFields`.
- Convert a legacy `S.evidence` object as above.
- Seed `S.relationships` from existing `contacts[*].relation/flirt_level/suspicion` and `secRel/secTrust`.
- Seed `S.drugs.state` from `coke_state`, `S.drugs.tolerance` from `drug_streak*10`, and `S.tinder.matches` from `S.season4.tinder_matches` (agenda `'genuine'` for Sarah, random for the rest).
- Bump a `S.systems_v = 1` marker so the migration runs once.

### E. Test plan

1. `node tools/build.js && node tools/check.js` (syntax, no duplicate top-level functions).
2. Autoplay smoke tests, each with no page errors and a clean ledger:
   - `node tools/autoplay.js --steps 1500 --seed 1..5`
   - `--jump 4:1 --flags '{"season4.daughter_suggested_dating":true}'` (Tinder)
   - `--jump 5:1` (S5 doping)
   - `--mobile` (no overflow from the new HUD lead chip or phone branches)
3. Forced-state runs via `--setup`:
   - Inject 3 evidence items and confirm a lead reaches publish within ≤4 matches.
   - Set `S.drugs.debt` and confirm Marco calls it in.
   - Set `fa_heat=200` and confirm a test fires and bans a player.
   - Load a pre-change save and confirm the migration runs once.
4. Add a `--dump` summary line: `EVIDENCE n / LEADS active,published,killed / FAVOURS owed,owing / DRUGS tol,add,debt` to spot runaway loops (e.g. more than 1 publish per match, or debt growing without bound).

### F. Rough size (new or changed lines, mostly text data)

| System | Logic | Content | Total |
|---|---|---|---|
| Backbone (evidence/leads/favours/pickLine/migration) | ~350 | ~50 | ~400 |
| Texting (threads, memory, wife, staleness) | ~350 | ~700 | ~1,050 |
| Tinder (agendas, outcomes, follow-ups) | ~250 | ~350 | ~600 |
| Drugs (tolerance, debt, tests, DERANGED pools) | ~300 | ~250 | ~550 |
| Press (leads UI, kill/bury, publish effects) | ~350 | ~300 | ~650 |
| Corruption (ledger, call-ins, 3 perks wired) | ~250 | ~200 | ~450 |
| **Total** | | | **~3,700** |

Suggested build order: backbone → press → drugs → corruption → texting → Tinder. Each step is shippable and testable with autoplay on its own.
