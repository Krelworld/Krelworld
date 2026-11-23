export const meta = {
  name: 'krelworld-phone-games-research',
  description: 'Research how comparable action, platform, RPG and browser games work on phones, check the key claims, and turn it into concrete changes to the KRELWORLD phone plan',
  phases: [
    { title: 'Sweep', detail: 'six research angles in parallel' },
    { title: 'Check', detail: 'independent check of the claims that drive decisions' },
    { title: 'Synthesize', detail: 'findings mapped onto the phone plan' },
    { title: 'Gaps', detail: 'completeness critic and follow-up research' },
    { title: 'Final', detail: 'final report' },
  ],
}

const SP = '/tmp/claude-0/-home-user/56b408f2-7415-570b-9a1e-7a003490c94a/scratchpad'
const AUDIT = SP + '/mobile_audit/MOBILE_AUDIT.md'
const REPORTS = SP + '/mobile/reports'

const GAME = `
# Context
KRELWORLD is a private comedy action-RPG that runs in a web browser (Phaser 3, WebGL, a 960x540 canvas), built for keyboard and mouse. It is being made playable in a PHONE browser held sideways (landscape), without changing the laptop version. The user asked: "research how other games in this vein operate on phones". Your research feeds directly into the build, so favour specifics a developer can act on (sizes, positions, behaviours, timings, options) over generalities.

What the game contains:
- Top-down dungeon rooms: move, shoot guns (the game already has auto-aim), dodge, about eight guns to switch between, several special abilities on meters (a button-mash gauge special, a fart attack, a transformation with a beam), healing items, pickups, bullets to avoid, bosses with quick-time finishers.
- Side-scrolling run-and-gun and platform rooms with jumping, pits, moving platforms and crushers.
- A hub town with NPCs and many interiors (walk, interact).
- A lot of voiced dialogue: meetings, briefings, cutscenes, choices, a dialogue log.
- Many minigames: a four-lane rhythm game, first-person driving, a deadlift masher, a flappy-style gauge, a renovation game, shops and inventory screens, an in-game TV with an on-demand list of about 58 shows.
- Heavy assets: about 106 MB of art (about 900 MB decoded as textures), 380 MB of audio (voices fetched on demand).

The current plan for phone controls (from our own audit): a floating stick under the left thumb; on the right a large FIRE button (hold to fire at the auto-aim target, slide the thumb to aim manually, optional auto-fire), a DODGE button that becomes JUMP in side-scrolling rooms, ONE "smart" button that shows whichever special is ready with a hold-to-open radial of all specials, a contextual ACTION button that only appears when something can be interacted with, tap targets in the top HUD for weapon switch (tap next, hold for a picker) and heal, and a pause button. Controls are HTML elements over the canvas, sized in real CSS px, sitting partly in the black letterbox gutters. A "phone assist" toggle: timing windows x1.25, sticky auto-aim, bigger pickup radius. A rotate-your-phone screen in portrait. The full audit is at ${AUDIT} (read sections 3 to 6 if you can read local files).

# How to research
- Use web search and page fetching (load the WebSearch and WebFetch tools with ToolSearch if they are not already in your tool list). Prefer primary sources: developer blog posts and postmortems, GDC talks and their write-ups, patch notes, official support pages describing control options, platform guidelines, reputable reviews that describe the controls in detail, and player discussions for what people complain about. Record the URL for every claim.
- If the web is blocked or a page will not load, say so in webAccess and clearly mark anything that comes from memory as lower confidence. Never present memory as a verified source.
- Do NOT touch any git repository or run any browser automation. You only read the web (and local files for context) and return findings.
- Be concrete: name the game, say exactly what it does, and where known give numbers (button sizes, dead zones, timing leniency, memory limits).`

const RESEARCH_SCHEMA = { type: 'object', properties: {
  angle: { type: 'string' },
  webAccess: { type: 'string', enum: ['full', 'partial', 'none'] },
  games: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' }, howItControls: { type: 'string' }, notableDecisions: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } } }, required: ['name', 'howItControls'] } },
  patterns: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, pattern: { type: 'string' }, evidence: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    sources: { type: 'array', items: { type: 'string' } } }, required: ['id', 'pattern', 'evidence', 'confidence'] } },
  pitfalls: { type: 'array', items: { type: 'object', properties: {
    pitfall: { type: 'string' }, evidence: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['pitfall', 'evidence'] } },
  recommendations: { type: 'array', items: { type: 'object', properties: {
    rec: { type: 'string' }, why: { type: 'string' }, priority: { type: 'string', enum: ['must', 'should', 'could'] } }, required: ['rec', 'why', 'priority'] } } },
  required: ['angle', 'webAccess', 'games', 'patterns', 'pitfalls', 'recommendations'] }

const CHECK_SCHEMA = { type: 'object', properties: {
  checked: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, claim: { type: 'string' },
    verdict: { type: 'string', enum: ['confirmed', 'partly', 'unsupported', 'wrong'] },
    note: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['id', 'claim', 'verdict', 'note'] } },
  missed: { type: 'array', items: { type: 'string' } } },
  required: ['checked', 'missed'] }

const ANGLES = [
  { key: 'topdown', title: 'Top-down action and shooters on phones',
    brief: `How do top-down action games and shooters control on phones? Cover at least: Brawl Stars (tap to auto-aim versus drag to aim, super button), Soul Knight, Archero (move to dodge, stop to shoot), Hades on iOS, The Binding of Isaac on iOS, Enter/Exit the Gungeon on mobile, Vampire Survivors, Diablo Immortal, Minigore or Space Marshals, Death Road to Canada, any Nuclear Throne or Hotline Miami style game on phones. For each: fixed versus floating versus dynamic stick, dead zone and travel, how aiming and firing work (auto-aim, aim assist strength, auto-fire, drag-aim), how many ability buttons and where and how big, how dodge works, how weapon switching works, how they keep controls from covering the action, HUD placement, layout customisation (move and resize buttons, opacity, left-handed), and whether the phone version changes balance (enemy counts, bullet speed, damage, lock-on). What do players complain about most?` },
  { key: 'platform', title: 'Side-scrolling action and platformers on phones (jump feel)',
    brief: `The user specifically said "jumping etc" must not feel awkward. How do side-scrolling action games and platformers make jumping and run-and-gun feel right on a touchscreen? Cover at least: Dead Cells mobile (auto-hit mode, custom layouts, swipe to dodge), Castlevania: Symphony of the Night mobile, Metal Slug mobile ports, Mega Man mobile ports and why they were criticised, Sonic mobile ports, Terraria mobile (auto-jump, smart cursor), Super Mario Run (one-touch design), Streets of Rage 4 mobile, Celeste-likes and Geometry Dash, Limbo and Inside, Oddmar, Leo's Fortune. Specifics wanted: where the jump button sits and how big, d-pad versus stick for horizontal movement in platformers, input buffering and coyote time values used in practice, variable jump height on touch (hold versus tap), air control, auto-jump and ledge forgiveness options, camera look-ahead, hit box and timing leniency changes for touch, firing while jumping, and what the worst ports got wrong. Give numbers where sources give them (for example common buffer and coyote windows in milliseconds).` },
  { key: 'ports', title: 'PC-first indie games ported to phones: what they changed',
    brief: `What did keyboard-and-mouse-first indie games change when they came to phones, and what did they learn? Cover at least: Stardew Valley mobile (tap to move, auto-attack, control schemes), Minecraft's touch controls redesign, Terraria mobile 1.3/1.4 rework, Don't Starve: Pocket Edition, Bastion and Transistor on iOS, Dead Cells, Slay the Spire, Papers Please, Baldur's Gate/Planescape enhanced editions on phones (tiny text problems), Disco Elysium or other text-heavy ports, Undertale-like RPGs on phones, Among Us, Hades. Specifics wanted: minimum text sizes they ended up with, how menus, inventories and shops were rebuilt for touch, scrolling lists, contextual buttons, tutorials and key prompts rewritten for touch, options offered (multiple control schemes, sensitivity, button size), which changes were phone-only versus shared, and how they handled small screens and notches. Include postmortems and developer commentary where you can find them.` },
  { key: 'browser', title: 'Browser (HTML5 / WebGL / Phaser) games on phone browsers: technical limits',
    brief: `What are the hard technical constraints and proven practices for a heavy HTML5/WebGL game in a PHONE BROWSER (not a native app)? Cover: iOS Safari and Android Chrome audio rules (unlocking on a gesture, HTMLAudioElement volume being read-only on iOS, the silent switch and WebAudio, navigator.audioSession, autoplay of later tracks), fullscreen (no element fullscreen on iPhone), orientation lock, add-to-home-screen/PWA display modes and what changes in standalone mode, viewport units and the collapsing address bar, safe-area insets, preventing zoom, scroll, selection and the long-press magnifier, touch versus pointer events and passive listeners, Android edge back-gestures. MEMORY: real per-tab limits on iPhones and mid-range Androids, total canvas and WebGL texture memory limits in iOS Safari, what makes Safari reload a tab ("A problem repeatedly occurred"), decoded audio memory, WebGL context loss on backgrounding, and practical budgets people use (give numbers and sources; WebKit bug reports and developer write-ups are good). Texture compression or downscaling strategies for the web (basis/ktx2, half-resolution packs, lazy loading and unloading in Phaser 3), service workers for caching 100 MB+ of assets and storage quota limits on iOS, load-time practices. Performance: devicePixelRatio and canvas resolution choices on phones, capping to 30 fps, low-power mode throttling requestAnimationFrame. Look at Phaser's own mobile guidance and at how large browser games (io games such as slither.io, diep.io, krunker; itch.io web builds; Construct and Unity WebGL mobile guidance) cope.` },
  { key: 'ux', title: 'Touch control UX research and platform guidelines',
    brief: `What do platform guidelines and UX research say about virtual controls? Cover: Apple Human Interface Guidelines and Material Design minimum touch targets and spacing, Apple's and Google's guidance specific to games and virtual controllers (for example Apple's on-screen virtual controller guidance), thumb reach zones on landscape phones of different sizes, research and developer write-ups on virtual joysticks (fixed versus floating versus follow, dead zones, max radius, re-centring), button opacity and feedback (haptics on web: navigator.vibrate works on Android, not iOS Safari), accidental touches and palm rejection, left-handed layouts, colour and icon versus text labels, customisable layouts, accessibility options common in mobile action games (auto-fire, aim assist, hold versus toggle, reduced timing demands). Also rhythm and timing on phones: touch latency and audio output latency on iOS and Android browsers (give measured numbers where available), how rhythm games calibrate (offset calibration screens, separate audio and visual offsets), how wide timing windows are in popular mobile rhythm games, and leniency practices for quick-time events on touch.` },
  { key: 'story', title: 'Dialogue-heavy RPGs, minigame collections and lists on phones',
    brief: `How do dialogue-heavy and story games, and games made of many minigames, behave on phones? Cover: Ace Attorney mobile, 80 Days, Disco Elysium or similar text-heavy games on small screens, Undertale-like and EarthBound-like RPGs on phones, visual novels (text size, tap to advance, auto-advance, skip read text, hold to fast-forward, backlog/log, hide UI), South Park and other comedy games on phones, WarioWare-style and Mario Party-style minigame collections on touch (how each minigame teaches its touch control in seconds), GTA mobile ports (context buttons that appear only when relevant, per-activity control layouts, driving controls: tilt versus buttons versus steering stick), mobile driving game control options. Also long scrolling lists and media browsers on phones (momentum scrolling, tap versus drag disambiguation, section tabs), shop and inventory screens, save and settings screens in landscape, subtitles sizing standards (for example platform or broadcaster guidance on minimum subtitle size), and how games handle pausing and skipping cutscenes on touch (hold to skip, double tap). What should our dialogue box, choices, skip and pause controls, TV guide and minigame instructions look like on a 844x390 screen?` },
]

phase('Sweep')
const results = await pipeline(
  ANGLES,
  (a) => agent(`${GAME}

# Your research angle: ${a.title}
${a.brief}

Return: the games you examined (with how each controls and its notable decisions), the cross-game PATTERNS you can support with evidence (give each an id starting "${a.key}-"), the pitfalls and complaints, and recommendations for KRELWORLD (must / should / could), saying where our current plan above is confirmed and where it should change. Aim for depth on the most relevant games rather than a shallow list.`,
    { label: 'research: ' + a.key, phase: 'Sweep', schema: RESEARCH_SCHEMA }),
  (r, a) => {
    if (!r) return null
    return agent(`${GAME}

# Your role: independent checker for the angle "${a.title}"
Another researcher produced the findings below. Do not take them on trust. Pick the claims that would most change what we build (at least six, more if several look shaky: prefer specific, surprising or numeric claims) and try to REFUTE each with your own searching and by opening the cited sources. Verdicts: confirmed (you saw it in a credible source), partly (true with caveats: say which), unsupported (you could not find support), wrong (a source contradicts it). Also list important things this angle missed that a developer would need (in "missed"), with sources where you can.

Findings to check:
${JSON.stringify({ patterns: r.patterns, pitfalls: r.pitfalls, recommendations: r.recommendations, games: (r.games || []).map(g => ({ name: g.name, howItControls: g.howItControls, sources: g.sources })) }, null, 1)}`,
      { label: 'check: ' + a.key, phase: 'Check', schema: CHECK_SCHEMA }).then(c => ({ ...r, key: a.key, check: c }))
  }
)

const got = results.filter(Boolean)
log(`Research angles returned: ${got.length} of ${ANGLES.length}` + (got.length < ANGLES.length ? ' (missing: ' + ANGLES.filter(a => !got.find(g => g.key === a.key)).map(a => a.key).join(', ') + ')' : ''))
if (!got.length) return { failed: 'no research returned' }

const SYNTH_SCHEMA = { type: 'object', properties: {
  reportPath: { type: 'string' },
  confirms: { type: 'array', items: { type: 'string' } },
  changes: { type: 'array', items: { type: 'object', properties: {
    change: { type: 'string' }, why: { type: 'string' },
    area: { type: 'string', enum: ['controls', 'combat', 'jumping', 'menus-dialogue', 'minigames', 'audio', 'memory-performance', 'shell', 'other'] },
    priority: { type: 'string', enum: ['must', 'should', 'could'] } }, required: ['change', 'why', 'area', 'priority'] } },
  openQuestions: { type: 'array', items: { type: 'string' } },
  summaryForUser: { type: 'string' } },
  required: ['reportPath', 'confirms', 'changes', 'openQuestions', 'summaryForUser'] }

const pack = (list) => JSON.stringify(list.map(r => ({ angle: r.angle, key: r.key, webAccess: r.webAccess, games: r.games, patterns: r.patterns, pitfalls: r.pitfalls, recommendations: r.recommendations, check: r.check })), null, 1)

phase('Synthesize')
const draft = await agent(`${GAME}

# Your role: synthesis
Six research angles were run and each was independently checked. The combined results are below (each pattern id may have a verdict in that angle's "check.checked" list; "check.missed" lists things the checker found missing). Read the audit at ${AUDIT} (sections 3 to 7) and, if they exist, the reports and README of the phone build so far (${REPORTS}/ and ${SP}/mobile-wt/src/game/mobile/README.md) so that you map findings onto what is actually planned and built. Do not edit anything in the game repository or its worktree.

Write the report to ${REPORTS}/RESEARCH-phone-games.md with these parts:
1. What comparable games do, organised by area (movement and aiming; abilities and buttons; jumping and platforming; menus, text and dialogue; minigames, rhythm and timing; technical limits of phone browsers; options and accessibility). Name the games. Keep only claims that were confirmed or partly confirmed; mark anything unverified as such; drop anything a checker found wrong.
2. What this CONFIRMS in our plan.
3. What we should CHANGE or ADD, as a prioritised list (must / should / could), each with the evidence, the area, and exactly what to build (sizes, timings, behaviours, option names). Give jumping its own detailed subsection: button placement and size, buffer and coyote windows, variable height, air control, auto-jump or ledge forgiveness, camera, and how to keep firing while jumping comfortable.
4. Numbers worth keeping in one table (touch target sizes, stick dead zones, timing windows, latency figures, memory limits), each with its source.
5. Open questions that only real-device testing can answer.
6. Sources (URLs).
Write for a developer who will implement it tomorrow: specific and brief. Then return the structured result; summaryForUser is a plain-language summary (about 250 words) for a non-technical reader of what other games do and what we are changing because of it.

Research results:
${pack(got)}`,
  { label: 'synthesis', phase: 'Synthesize', schema: SYNTH_SCHEMA })

if (!draft) return { stage: 'synthesis-failed', angles: got.map(g => g.key) }

phase('Gaps')
const GAP_SCHEMA = { type: 'object', properties: {
  gaps: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, question: { type: 'string' }, whyItMatters: { type: 'string' } }, required: ['key', 'question', 'whyItMatters'] } } },
  required: ['gaps'] }
const critic = await agent(`${GAME}

# Your role: completeness critic
A research report on how comparable games work on phones has been written at ${draft.reportPath} (read it in full, and the audit at ${AUDIT}). Ask: what is MISSING that would change what we build for this particular game? Think about what the game contains (list above) against what the report covers: a kind of game not examined, a control problem with no evidence behind our choice, a claim that drives a decision but rests on one weak source, a technical limit not quantified. Return at most four gaps, each as a precise research question that web research can answer, most important first. Return an empty list if the report is genuinely sufficient. Do not edit any file.`,
  { label: 'completeness critic', phase: 'Gaps', schema: GAP_SCHEMA })

let extra = []
if (critic && critic.gaps && critic.gaps.length) {
  log('Follow-up research on ' + critic.gaps.length + ' gaps: ' + critic.gaps.map(g => g.key).join(', '))
  extra = (await parallel(critic.gaps.slice(0, 4).map(g => () => agent(`${GAME}

# Your research question (a gap found in the first round)
${g.question}
Why it matters: ${g.whyItMatters}

Answer it with evidence. Give pattern ids starting "${g.key}-".`,
    { label: 'gap: ' + g.key, phase: 'Gaps', schema: RESEARCH_SCHEMA }).then(r => r ? { ...r, key: g.key } : null)))).filter(Boolean)
}

phase('Final')
let final = draft
if (extra.length) {
  const revised = await agent(`${GAME}

# Your role: final revision of the research report
The report at ${draft.reportPath} was reviewed by a completeness critic, and follow-up research was done on the gaps (below). Revise the report file in place: fold the new findings into the right sections, update the change list and the numbers table, and keep it specific and brief. Do not edit anything in the game repository or its worktree. Then return the full structured result again (complete lists, not just the additions), with an updated summaryForUser.

Follow-up research:
${pack(extra)}`,
    { label: 'final report', phase: 'Final', schema: SYNTH_SCHEMA })
  if (revised) final = revised
}

return { reportPath: final.reportPath, confirms: final.confirms, changes: final.changes, openQuestions: final.openQuestions, summaryForUser: final.summaryForUser, angles: got.map(g => ({ key: g.key, webAccess: g.webAccess, games: (g.games || []).length, patterns: (g.patterns || []).length })), gapKeys: extra.map(e => e.key) }
