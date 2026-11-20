/* ===================== KREPLIN deeper systems: TINDER (season 4) =====================
   docs/systems-design.md 2.2 + owner decision 5 (Sarah stays bleak). Extends 083's Tinder:
   - every profile gets a hidden AGENDA: journalist | plant (Delmor's) | golddigger | genuine
     (Sarah is genuine). A small TELL shows on the card; Surveillance (S.surveillance.tinderReveal)
     stamps the agenda on it outright.
   - agenda profiles are keen: they match even an un-facetuned chairman, now and then.
   - chats: agenda lines slip into her replies, "Talk about work" lets her fish, and after a
     dozen messages the chat winds down (invite or close) so it always ends.
   - DATES have outcomes after the existing bleak encounter: photos (evidence), kiss-and-tell
     (a lead), blackmail with a price, the plant (Delmor gets your tactics), a real connection,
     and an ALIBI usable once against a police case (047 runPoliceInvestigation).
   - matches become phone contacts and keep texting after the date, with callbacks.
   - Sarah's arc runs across season 4 and ends with her leaving, whatever you do.
   - swiping has a clear way out ("Done swiping"), for players and the autoplay harness. */
(function () {
  const K = window.KSys;
  const rint = K.rint;
  const P = (key, pool) => K.pick(key, pool);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slug = n => 'tinder_' + String(n || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  K.tinderState = function () {
    ensureSystemsState();
    const t = (S.tinder && typeof S.tinder === 'object') ? S.tinder : (S.tinder = {});
    if (!t.matches || typeof t.matches !== 'object' || Array.isArray(t.matches)) t.matches = {};
    if (!Array.isArray(t.alibis)) t.alibis = [];
    if (!t.sarah || typeof t.sarah !== 'object') t.sarah = { stage: 0, next: -1, ended: false, dates: 0 };
    if (!Array.isArray(t.agendaBag)) t.agendaBag = [];
    return t;
  };
  const revealOn = () => !!(S.surveillance && S.surveillance.tinderReveal && K.surveillanceOn());
  K.tinderRevealOn = revealOn;

  // ---------- content ----------
  const AG = {
    journalist: {
      label: 'THE JOURNALIST', reveal: "Works for the Southern Daily Echo. She's fishing for quotes and photos. Everything you say is on the record.",
      tells: ["Job: 'media'. Icebreaker: 'what's the most illegal thing you've ever done?'", "Photo 3: holding a dictaphone 'as a joke'", "Prompt: 'Two truths and a lie — but on the record x'",
        "Photo 2 is her lanyard. If you squint it says PRESS", "'Looking for a man with stories. Ideally true ones. Ideally about football.'", "Bio: 'Love a scoop 🍦 (ice cream) (mostly)'"],
      chat: ["So what's it REALLY like running a club? Any skeletons 😉 off the record obviously", "Do you ever do anything... naughty? Before games? Asking for an article. I mean a friend.",
        "What's your relationship with Delmor Krunchem like? Off the record. Totally off. Imagine there's no record.", "Haha you're funny. Can I quote that? To my mates I mean.",
        "Is it true the Saints dressing room has a 'snow machine'? 😂 just something I heard"] },
    plant: {
      label: 'THE PORTSMOUTH PLANT', reveal: "Sent by Delmor. She wants your tactics, your house keys and a quiet corner to leave a phone in.",
      tells: ["Photo 3: a mug. It says 'PUP…' and the rest is behind her thumb", "Lives in 'Hampshire (south-east bit) (Portsmouth)'", "Prompt: 'My ideal date: you, me and your tactics folder'",
        "Photo 4: a blurry man in a cape in the background, giving a thumbs up", "'Love the sea. Love the smell of Fratton. I mean the sea.'", "Her dog is called Krunchy"],
      chat: ["What formation do you play? I LOVE formations. Write it down for me x", "Where do you keep your tactics? Somewhere safe? Somewhere in your house?",
        "Do you have a spare key? For no reason x", "What do you think of Portsmouth? I think it's lovely. Best city. I mean... it's ok", "Is your house alarmed? Asking because I get scared"] },
    golddigger: {
      label: 'THE GOLD-DIGGER', reveal: 'Has a price list. You are on it. Near the top, between "yacht" and "pension".',
      tells: ["Photo 2: a Rolex catalogue, open at the expensive page", "Prompt: 'Love language: bank transfers'", "'Looking for a man with ambition and a pension. Mainly the pension.'",
        "Every photo is outside a different Bentley dealership", "'6ft+ only. Or £6m+. Whichever.'", "Bio: 'Financial security is very attractive x'"],
      chat: ["What do you drive? Be specific. Engine size.", "Do you have a yacht or are you just 'yacht curious'", "What's your net worth? Ballpark. Which ball. Which park.",
        "I'm low maintenance. I just need a lot of maintenance.", "Is that your real watch?"] },
    genuine: {
      label: 'GENUINE', reveal: 'No agenda. Just lonely. Like you. Worse luck for her.',
      tells: ["Photo 1: her nan's 90th. Nobody's posing", "Prompt: 'I'll judge you by how you treat waiters'", "'Bad at this. Be nice x'", "Photo 3: a slightly burnt lasagne she's clearly proud of"],
      chat: ["Ha. You're not what the papers say. You're worse. I like it.", "Tell me something true. Doesn't have to be nice.", "I've been to St Mary's once. My dad took me. He cried. Saints lost. He cried more."] }
  };
  const LUKE_TELLS = ["Photo 1: Luke. Photo 2: Luke, closer. Photo 3: Luke's car. He's not a woman. He's Luke.", "Luke has swiped right on you four times. The app only lets you do it once."];
  const SANMIK_TELLS = ["Every photo is the same photo, mirrored", "Location: 'ur area x'"];
  const SARAH_TELLS = ["Photo 2: a Saints shirt from the 2003 cup final. Faded. Real.", "'Honest people only. I can tell.'", "Photo 4: a care home Christmas party. She's the one holding everyone's plates."];
  const SARAH_CHAT = ["I work nights at the care home. Mrs Pettigrew says hi. She's 97. She thinks you're 'dishy'.", "Ha. You're not what the papers say. You're worse. I like it.", "Tell me something true. Doesn't have to be nice.", "My dad took me to St Mary's once. He cried. Saints lost. He cried more. He's gone now. Still counts."];
  K.TINDER_AGENDAS = AG;

  // ---------- pool / card / match ----------
  // 083 generateTinderProfilePool -> every profile gets an agenda and a tell
  K.tinderDecorate = function (profiles) {
    try {
      const T = K.tinderState();
      if (T.sarah.ended) { const i = profiles.findIndex(p => p.name === 'Sarah'); if (i >= 0) profiles.splice(i, 1); }
      profiles.forEach(p => {
        const rec = T.matches[p.name];
        if (p.name === 'Sarah') { p.agenda = 'genuine'; p.sarah = true; p.tell = P('tell_sarah', SARAH_TELLS); return; }
        if (p.name === 'Luke' || p.name === 'SanMik') { p.agenda = null; p.tell = P('tell_' + p.name, p.name === 'Luke' ? LUKE_TELLS : SANMIK_TELLS); return; }
        if (rec && rec.agenda) p.agenda = rec.agenda;
        else {
          if (!T.agendaBag.length) T.agendaBag = ['journalist', 'plant', 'golddigger', 'journalist', 'plant', 'golddigger', 'genuine'].sort(() => Math.random() - 0.5);
          p.agenda = T.agendaBag.shift();
        }
        p.tell = P('tell_' + p.agenda, AG[p.agenda].tells);
      });
    } catch (e) { console.error('tinderDecorate', e); }
    return profiles;
  };
  // 083 showNextProfile: the tell under the bio; the agenda itself when Surveillance is running
  K.tinderCard = function (p, bioEl) {
    try {
      if (!bioEl || !p) return;
      const box = bioEl.parentElement;
      box.querySelectorAll('.k-tinder-tell, .k-tinder-agenda').forEach(x => x.remove());
      if (p.tell) { const d = document.createElement('div'); d.className = 'k-tinder-tell'; d.textContent = '📷 ' + p.tell; box.appendChild(d); }
      if (p.agenda && revealOn()) {
        const a = AG[p.agenda]; const d = document.createElement('div'); d.className = 'k-tinder-agenda k-ag-' + p.agenda;
        d.innerHTML = `🕵️ <b>${K.esc(p.sarah ? 'GENUINE (SARAH)' : a.label)}</b> <span>${K.esc(a.reveal)}</span>`;
        box.appendChild(d);
        const rec = K.tinderState().matches[p.name]; if (rec) rec.revealed = true;
      }
    } catch (e) { console.error('tinderCard', e); }
  };
  // agenda profiles are keen: they swipe right on anyone
  K.tinderAgendaMatch = p => !!(p && (p.agenda === 'journalist' || p.agenda === 'plant' || p.agenda === 'golddigger') && Math.random() < 0.55);
  K.tinderRecord = function (p) {
    const T = K.tinderState();
    let m = T.matches[p.name];
    if (!m) m = T.matches[p.name] = { name: p.name, agenda: p.agenda || (p.name === 'Sarah' ? 'genuine' : P('tinder_ag_fallback', ['journalist', 'plant', 'golddigger'])), revealed: revealOn(), dates: 0, tick: K.tick(), contact: slug(p.name), price: rint(4, 12) * 25000, tell: p.tell || null, work: null };
    return m;
  };
  K.tinderOnMatch = function (p) {
    try {
      const m = K.tinderRecord(p);
      registerContact(m);
      // Sarah's arc starts when you match, date or no date
      const sa = K.tinderState().sarah;
      if (m.name === 'Sarah' && !sa.ended && sa.stage < 1) { sa.stage = 1; sa.next = K.tick() + 1; }
      return m;
    } catch (e) { console.error('tinderOnMatch', e); return null; }
  };
  const recOf = p => p && K.tinderState().matches[p.name || p];

  // ---------- chat ----------
  K.tinderAgendaReply = function (p) {
    const m = recOf(p);
    if (m && m.name === 'Sarah' && K.tinderState().sarah.ended) return { text: 'This account no longer exists.', unmatch: true };
    if (!m || Math.random() >= 0.35) return null;
    const pool = m.name === 'Sarah' ? SARAH_CHAT : (AG[m.agenda] || AG.genuine).chat;
    return { text: P('tchat_' + (m.name === 'Sarah' ? 'sarah' : m.agenda), pool), unmatch: false };
  };
  K.tinderChatExtras = function (p, box) {
    try {
      if (!box || !recOf(p)) return;
      const b = document.createElement('button'); b.className = 'tinder-chat-quick-option k-tinder-work'; b.textContent = '💼 Talk about work';
      b.onclick = () => K.tinderTalkWork(p);
      box.insertBefore(b, box.lastChild);
    } catch (e) { console.error('tinderChatExtras', e); }
  };
  K.tinderAfterMessage = function (p, conv) {
    try {
      if (!conv || (conv.messages || []).length < 14) return;
      const box = document.getElementById('tinderChatQuickOptions'); if (!box || box.dataset.wound) return;
      box.dataset.wound = '1';
      [...box.querySelectorAll('button')].forEach(btn => { if (!/invite|close/i.test(btn.textContent)) btn.remove(); });
      if (typeof addMessageToChat === 'function') addMessageToChat('System', `${p.name} has gone quiet. Invite her over or close the chat.`, false);
    } catch (e) { console.error('tinderAfterMessage', e); }
  };
  // "Talk about work": she fishes, by agenda
  K.tinderTalkWork = async function (p) {
    const m = recOf(p); if (!m || !window.KUI) return;
    const box = document.getElementById('tinderChatQuickOptions'); const wb = box && box.querySelector('.k-tinder-work'); if (wb) wb.remove();
    const say = (t, me) => { try { addMessageToChat(me ? 'You' : m.name, t, !!me); } catch (_) {} };
    const W = {
      journalist: { q: "So what's it REALLY like running a club? Any skeletons 😉 off the record obviously",
        a: [{ id: 'greggs', label: '"Off the record? I once paid a linesman in Greggs vouchers."' }, { id: 'no', label: '"No comment. I\'m a professional."' }] },
      plant: { q: "What formation do you play? Draw it for me x I love a drawing",
        a: [{ id: 'real', label: 'Draw the real 4-4-2 on a napkin' }, { id: 'fake', label: 'Draw a 2-2-6 with a smiley face' }] },
      golddigger: { q: "So what do you earn? Roughly. Exactly.",
        a: [{ id: 'tell', label: 'Tell her (round it up a bit)' }, { id: 'poor', label: '"I\'m skint, me."' }] },
      genuine: { q: "What do you actually do all day? Honestly.",
        a: [{ id: 'truth', label: 'Tell her the truth' }, { id: 'lie', label: '"Sports consultant."' }] }
    }[m.agenda] || null;
    if (!W) return;
    say(W.q, false);
    const k = await KUI.modal({ title: m.name, variant: 'phone', html: `<p>${K.esc(W.q)}</p>${revealOn() ? `<p class="k-tinder-agenda k-ag-${m.agenda}">🕵️ <b>${K.esc(AG[m.agenda].label)}</b> <span>${K.esc(AG[m.agenda].reveal)}</span></p>` : ''}`, actions: W.a.map(a => ({ id: a.id, label: a.label })) });
    m.work = k;
    const id = m.contact;
    if (k === 'greggs') {
      say("Off the record? I once paid a linesman in Greggs vouchers.", true); say("Haha amazing 😂 sausage rolls or steak bakes? For my… mates", false);
      const ev = addEvidence({ kind: 'tinder', label: `Told ${m.name} ("media") you paid a linesman in Greggs vouchers`, weight: 14, witness: id, witnessLabel: `${m.name} ("media")`, tags: ['corruption'], forceLeak: true });
      const lead = ev && S.leads.find(l => l.evidenceIds.includes(ev.id));
      if (lead && lead.status === 'active') { lead.progress = Math.min(99, lead.progress + 50); lead.stage = Math.min(3, Math.floor(lead.progress / 25)); lead.runsIn = Math.max(1, Math.ceil((100 - lead.progress) / 25)); }
      logSafe(`📰 ${K.esc(m.name)} types very fast for someone who's "just chatting". A story on you jumps two stages.`);
    } else if (k === 'no') { say("No comment. I'm a professional.", true); say('Boring 🙄 kidding. Kind of.', false); }
    else if (k === 'real') { say('*draws the real 4-4-2 on a napkin*', true); say("Ooh. Can I keep it? For my fridge. My Portsmouth fridge. My fridge.", false); S.sys.pompeyIntel = (S.sys.pompeyIntel | 0) + 1; }
    else if (k === 'fake') { say('*draws a 2-2-6 with a smiley face*', true); say("Oh. Interesting. Delmor will— I mean I'll love that. Bold.", false); }
    else if (k === 'tell') { say("Seven figures. Eight on a good day.", true); say("Mmm. Tell me more about the good days 💅", false); m.price = Math.round(m.price * 1.6); }
    else if (k === 'poor') { say("I'm skint, me.", true); say("Oh. Ok. Well. Hm. You've got a nice face. For skint.", false); m.price = Math.round(m.price * 0.6); }
    else if (k === 'truth') { say("Mostly I sit in a box and shout at a man I pay to shout at other men.", true); say("That's the most honest thing anyone's said to me on here. It's also very sad. Hi.", false); m.warm = (m.warm | 0) + 1; }
    else if (k === 'lie') { say("Sports consultant.", true); say("Ok sports consultant. I've seen you on the news. Crying. Consultantly.", false); }
  };

  // ---------- dates ----------
  K.tinderDateStart = function (p) { try { const m = K.tinderRecord(p); m.dates++; K.tinderState().lastDate = m.name; } catch (e) { console.error(e); } };
  const OUT = {
    kiss_and_tell: { title: '📰 Kiss and tell', line: "You wake up to 14 missed calls. {name} has sold \"MY NIGHT WITH THE SAINTS SUPREMO: HE CRIED DURING, AFTER AND A BIT BEFORE\" to the Echo. She's quoted the bit about your mum." },
    photos: { title: '📸 Photos', line: "{name} took photos while you slept. Of you. Of the house. Of the bag on the bedside table. Of the bag in the bag. They're in the cloud now. The cloud is in Fleet Street." },
    plant: { title: '🔑 Gone', line: "You wake up. She's gone. So is your tactics folder, your house keys and your dignity. There's a small black box behind the telly. It's warm. It's listening." },
    blackmail: { title: '💅 The price list', line: "\"Lovely evening x\" says {name}. Then: a photo of you asleep, mouth open, a Saints scarf where your pants should be. Then: \"{price} or it goes to the Echo. Saturday x\"" },
    connection: { title: '🫖 Something real-ish', line: "{name} stays for a cup of tea. She asks about your daughter. You talk for an hour. It's the longest conversation you've had this season that wasn't about money. Then she goes, and the house goes back to being a house." },
    alibi: { title: '🕯️ An alibi', line: "On the doorstep {name} says: \"If anyone ever asks, you were with me all night. I mean it. I've seen the papers.\" You don't know if it's kindness or pity. It's an alibi either way." }
  };
  // 083 applyTinderPostEncounterEffects, after the existing (bleak) text
  K.tinderDateOutcome = async function (name) {
    const T = K.tinderState();
    const m = T.matches[name || T.lastDate]; if (!m) return null;
    if (m.name === 'Sarah' && T.sarah.ended) { logSafe('She leaves before the kettle boils. She says she only came to give you back your scarf. You never gave her a scarf.'); return []; }
    const id = m.contact; registerContact(m);
    const outs = [];
    if (m.name === 'Sarah') outs.push(T.sarah.stage <= 1 ? 'connection' : 'connection', 'alibi');
    else if (m.agenda === 'journalist') outs.push(Math.random() < 0.65 ? 'kiss_and_tell' : 'photos');
    else if (m.agenda === 'plant') outs.push('plant');
    else if (m.agenda === 'golddigger') outs.push('blackmail');
    else outs.push('connection', Math.random() < 0.5 ? 'alibi' : null);
    const done = [];
    for (const k of outs.filter(Boolean)) {
      const o = OUT[k]; const line = K.fill(o.line, { name: m.name, price: K.short(m.price) });
      let extra = '';
      if (k === 'kiss_and_tell') {
        const ev = addEvidence({ kind: 'tinder', label: `${m.name} sold her night with you to the Echo`, weight: 18, witness: id, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], forceLeak: true });
        const lead = ev && S.leads.find(l => l.evidenceIds.includes(ev.id)); if (lead && lead.status === 'active') { lead.progress = Math.min(99, lead.progress + 25); lead.stage = Math.floor(lead.progress / 25); }
        extra = 'A story is on its way (Press).';
      } else if (k === 'photos') {
        addEvidence({ kind: 'tinder', label: `${m.name}'s photos of you (and the bag) asleep`, weight: 16, witness: id, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], leakBonus: 0.15 });
        extra = 'New evidence: the photos.';
      } else if (k === 'plant') {
        S.sys.pompeyIntel = (S.sys.pompeyIntel | 0) + 2; S.sys.bugged = K.tick() + 6;
        addEvidence({ kind: 'planted', label: `${m.name} (Delmor's) took your tactics folder and left a phone behind the telly`, weight: 8, witness: 'delmor', witnessLabel: 'Delmor Krunchem', tags: ['misc'], noLeak: true });
        try { window.enqueueRivalText && enqueueRivalText(P('plant_delmor', PLANT_DELMOR)); } catch (_) {}
        extra = 'Delmor has your tactics: Pompey get stronger against you. Something in the house is listening.';
      } else if (k === 'blackmail') {
        extra = await blackmail(m);
      } else if (k === 'connection') {
        if (S.loneliness !== undefined) S.loneliness = clamp((S.loneliness || 50) - 1, 0, 100);
        m.warm = (m.warm | 0) + 1;
        if (m.name === 'Sarah') { T.sarah.dates++; if (T.sarah.stage < 1) { T.sarah.stage = 1; T.sarah.next = K.tick() + 1; } }
        extra = m.name === 'Sarah' ? 'She says she\'ll text. She does.' : 'Loneliness −1. For about a day.';
      } else if (k === 'alibi') {
        if (!T.alibis.some(a => a.from === m.name && !a.used)) T.alibis.push({ from: m.name, used: false, tick: K.tick() });
        extra = 'You have an alibi: usable once against a police case.';
      }
      done.push(k);
      logSafe(`${o.title}: ${K.esc(line)} <b>${K.esc(extra)}</b>`);
      if (k !== 'blackmail' && window.KUI) await KUI.modal({ title: o.title, variant: 'phone', html: `<div class="k-tinder-out k-out-${k}"><p>${K.esc(line)}</p><p class="k-sub"><b>${K.esc(extra)}</b></p></div>`, actions: [{ id: 'ok', label: k === 'connection' ? 'Ok.' : 'Brilliant.' }] });
    }
    m.outcomes = (m.outcomes || []).concat(done);
    m.afterNext = K.tick() + 1;
    return done;
  };
  async function blackmail(m) {
    const price = m.price;
    const can = (S.chairman_cash || 0) + (S.club_cash || 0) >= price;
    const k = window.KUI ? await KUI.modal({ title: '💅 The price list', variant: 'phone', html: `<div class="k-tinder-out k-out-blackmail"><p>${K.esc(K.fill(OUT.blackmail.line, { name: m.name, price: K.short(price) }))}</p></div>`,
      actions: [{ id: 'pay', label: `Pay ${K.short(price)}`, disabled: !can }, { id: 'refuse', label: '"Publish and be damned."', variant: 'bad' }] }) : 'refuse';
    if (k === 'pay' && K.pay(price)) {
      addEvidence({ kind: 'tinder', label: `Paid ${m.name} ${K.short(price)} for "the photos"`, weight: 6, witness: m.contact, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], noLeak: true });
      m.paid = (m.paid | 0) + 1; m.price = Math.round(price * 1.5);
      return `Paid. She sends a thumbs up and a link to her Depop. (She'll be back: the price went up.)`;
    }
    addEvidence({ kind: 'tinder', label: `${m.name}'s photos: you, asleep, wearing a Saints scarf as pants`, weight: 20, witness: m.contact, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], forceLeak: true });
    return 'She sends them to the Echo. A story is on its way.';
  }
  const PLANT_DELMOR = ["Lovely 4-4-2 mate. Shame about the left back.", "Thanks for the tactics. And the keys. And the slippers. Lovely slippers. Very small.",
    "My girl says your bed's got a dip on one side. Your side. From the crying.", "Nice house. I've moved the furniture round a bit. With my mind. And a phone. Behind the telly."];
  // Delmor uses what the plant took: Pompey are sharper against you
  GameHooks.on('prematch:end', function () {
    try {
      if (!window.S || !S.sys || !(S.sys.pompeyIntel > 0)) return;
      const opp = K.oppTeam();
      if (!/portsmouth|pompey/i.test(opp)) return;
      const boost = 5 * Math.min(3, S.sys.pompeyIntel);
      S.morale_opponent = (S.morale_opponent || 70) + boost;
      S.sys.pompeyIntel = 0;
      logSafe(`📋 Pompey line up exactly where your tactics folder said they should. Delmor waves it at you from the directors' box. (Pompey +${boost})`);
    } catch (e) { console.error(e); }
  });
  // the phone behind the telly: while it's there, anything you do at home is likelier to leak
  GameHooks.on('matchday:end', function () { try { if (S.sys && S.sys.bugged && S.sys.bugged < K.tick()) S.sys.bugged = 0; } catch (_) {} });

  // ---------- alibi (047 runPoliceInvestigation) ----------
  K.freeAlibi = () => { const T = window.S && S.tinder; return T && Array.isArray(T.alibis) ? T.alibis.find(a => !a.used) || null : null; };
  K.useAlibi = function () {
    const a = K.freeAlibi(); if (!a) return null;
    a.used = true; a.usedTick = K.tick();
    S.police_risk = Math.max(0, (S.police_risk | 0) - 10);
    return { from: a.from, text: P('alibi_txt', ALIBI_LINES).replace(/\{name\}/g, a.from) };
  };
  const ALIBI_LINES = ["\"He was with me all night, officer,\" says {name}, on speakerphone, from a night shift. \"All night. He cried at Countryfile.\" The officer writes 'cried at Countryfile' and closes his notebook.",
    "{name} turns up at the station in her work fleece. \"He was at mine. He talked about Matt Le Tissier for four hours. I've got the voice notes.\" Nobody wants the voice notes. You're free to go."];

  // ---------- phone contacts for matches ----------
  function registerContact(m) {
    if (!window.S || !m) return;
    const id = m.contact;
    K.ensureContact(id, `${m.name} (Tinder)`, 'Tinder match');
    if (K.chatContacts[id]) return;
    K.chatContacts[id] = {
      status: () => (m.name === 'Sarah' ? 'Tinder · Sarah' : 'Tinder match') + (revealOn() ? ` · 🕵️ ${AG[m.agenda].label}` : ''),
      tones: () => (m.name === 'Sarah' && K.tinderState().sarah.ended) ? {} : { friendly: 'Had a nice time x', flirtatious: 'Round two? 😏', erotic: 'Send me something 🔥', professional: 'Please delete the photos.' },
      reply: cat => P(`tin_${m.name === 'Sarah' ? 'sarah' : m.agenda}_${cat}`, (REPLIES[m.name === 'Sarah' ? 'sarah' : m.agenda] || REPLIES.genuine)[cat] || REPLIES.genuine.friendly),
      fx: { erotic: { lone: 1 } },
      after: async cat => { if (cat === 'erotic' && m.agenda === 'journalist') addEvidence({ kind: 'sext', label: `Sexted ${m.name} ("media")`, weight: 12, witness: id, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], leakBonus: 0.2 }); }
    };
  }
  const REPLIES = {
    journalist: { friendly: ["Me too! Quick q, how do you spell your surname? For my... phone", "Lovely 😊 did you mean what you said about Delmor? Can I quote— I mean can I tell my mum"], flirtatious: ["Maybe 😉 bring stories", "Only if you tell me what happened at the Harvester"], erotic: ["Ooh 📸 saved. For me. Only me. And my editor. JOKE"], professional: ["What photos? 😇", "Deleted! (from my phone)"] },
    plant: { friendly: ["Me too! Is the back door usually unlocked or was that just for me", "Lovely night. Lovely house. Lovely… layout"], flirtatious: ["Yes. Same place. Same keys. I mean same time"], erotic: ["Haha naughty. Is that your study in the background? What's on the whiteboard?"], professional: ["There aren't any photos. Just a little phone. Behind the telly. Ignore it x"] },
    golddigger: { friendly: ["It was nice. It'll be nicer when the money's in x", "Me too babe. Saturday. Don't forget Saturday x"], flirtatious: ["Round two costs more than round one babe"], erotic: ["That's a premium request x I'll invoice"], professional: ["Happy to. For a fee 💅", "Delete them? Babe they're my pension"] },
    genuine: { friendly: ["Me too. Weirdly. Don't make it weird.", "Yeah. It was. Look after yourself, yeah?"], flirtatious: ["Maybe. Ask me sober x"], erotic: ["Ha. No. But nice try.", "I'm on a night shift. Mrs Pettigrew can see my screen."], professional: ["There aren't any photos. I'm not like that. I'm boring like that."] },
    sarah: { friendly: ["Me too. More than I expected. Which isn't saying much. But it's saying something.", "Did you get home ok? You looked like you might not."], flirtatious: ["Maybe. If you don't look at your phone the whole time.", "Round two. Ok. Somewhere that isn't your house. Your house is sad."], erotic: ["I'm on nights. Mrs Pettigrew is reading over my shoulder. She says 'go on girl'.", "Not like that. Not yet. Maybe not ever. Sorry."], professional: ["There aren't any photos. Who hurt you. Actually don't answer."] }
  };

  // after a date, matches keep texting (with callbacks to the date); deadline for the gold-digger
  const AFTER = {
    journalist: [{ text: "Loved the other night x quick one: how many Ps in Kreplin? For my… diary", o: [
      { l: '"Why?"', r: ["No reason! Just a girl who loves spelling 🙃"], fx: { t: -2 } },
      { l: '"Are you writing about me?"', q: 'are you writing about me', r: ["Writing ABOUT you? Haha. No. Writing NEAR you."], fx: { f: 2 } },
      { l: '"Off the record, I snorted the half-time oranges."', q: 'I snorted the half-time oranges', ev: 'high', go: async () => addEvidence({ kind: 'tinder', label: 'Told the Tinder journalist you snorted the half-time oranges', weight: 12, tags: ['drugs'], forceLeak: true }), r: ["OMG. Ok. Totally off. Totally. Thanks babe 📝"] }] }],
    plant: [{ text: "Had such a nice time. Left an earring at yours. And a small black box. Don't touch the small black box x", o: [
      { l: '"What\'s in the box?"', q: "what's in the box", r: ["Earrings. More earrings. Very small earrings that record— that are recorded. In my diary."], fx: { t: -3 } },
      { l: '"Thrown it in the Itchen."', go: async () => { S.sys.bugged = 0; logSafe('🔇 The small black box goes in the Itchen. A duck investigates it. The duck is now in Portsmouth.'); }, r: ["...ok. Cool. Very cool. Delmor's going to— I mean, bye x"], fx: { f: 3 } }] }],
    golddigger: [{ text: "The photos came out lovely babe. {price} and they stay lovely. Saturday x", deadline: true, o: [
      { l: 'Pay her', go: async () => { const m = curAfter; if (m && K.pay(m.price)) { m.paid = (m.paid | 0) + 1; logSafe(`💸 You pay ${K.esc(m.name)} ${K.short(m.price)}. She sends a heart. It's the cheapest thing she owns.`); m.price = Math.round(m.price * 1.5); } }, r: ["Pleasure doing business x see you next month x"] },
      { l: '"I\'ve got photos of YOU."', q: "I've got photos of you", ev: 'threat', r: ["Of me looking amazing? Post them babe. Free advertising."], fx: { f: 2 } },
      { l: '"Go on then. Send them."', r: ["Ok x"], go: async () => addEvidence({ kind: 'tinder', label: `${curAfter && curAfter.name}'s photos went to the Echo`, weight: 18, tags: ['sex'], forceLeak: true }) }] }],
    genuine: [{ text: "Hope you're eating properly. Not like, food-wise. Life-wise. You know what I mean.", o: [
      { l: '"I\'m fine."', q: "I'm fine", r: ["Ok. Nobody who says 'I'm fine' at 2am is fine. Night x"] },
      { l: '"Not really."', r: ["No. I didn't think so. That's the first true thing you've texted me."], fx: { w: 3 } }] }]
  };
  let curAfter = null;
  // Sarah: five beats, then she goes. Whatever you say.
  const SARAH = [
    null,
    { text: "Thanks for the other night. You were sad in a funny way. Or funny in a sad way. Coffee? Not your house.", o: [
      { l: '"Coffee. Yes. Not my house."', q: 'coffee, not my house', pr: 'sarah_coffee', r: ["Ok. Thursday. The one by the hospital. I'll be the one in the uniform looking tired."], fx: { w: 5 } },
      { l: '"Can\'t. Match."', r: ["There's always a match. My dad used to say that. Then there wasn't."], fx: { w: -2 } },
      { l: '"Why me?"', q: 'why me', r: ["Honestly? You looked like you needed someone to ask how you were. Nobody does, do they."], fx: { w: 3 } }] },
    { text: "Mrs Pettigrew at work asked about 'the dishy chairman'. I said you were 'complicated'. She said 'they all are, love, and then they die'.", o: [
      { l: '"Tell her I said hi."', q: 'tell Mrs Pettigrew I said hi', r: ["She said 'hello dear' and then forgot who you were. Then remembered. Then said 'oh, him'."], fx: { w: 2 } },
      { l: '"I\'m not complicated. I\'m a chairman."', r: ["That's the most complicated thing you could have said."], fx: { w: 1 } }] },
    { text: "Saw the papers. Is any of it true?", o: [
      { l: '"None of it."', q: 'none of it is true', r: ["Ok. I'll believe you. I won't, but I'll say I do. That's what people do, isn't it."], fx: { t: -3 } },
      { l: '"All of it."', q: 'all of it is true', r: ["Thank you for not lying. I wish you had. I don't know which of those is worse."], fx: { t: 3, w: -2 } },
      { l: '"Some of it. The worst bits."', q: 'the worst bits', r: ["The worst bits are the true ones. That's how it always goes."], fx: { t: 2 } }] },
    { text: "Met your daughter in Tesco. She looked at me and said 'oh. you're the Tinder one.' Then she said 'run'. She wasn't joking. She was holding a melon.", o: [
      { l: '"She\'s protective."', r: ["Of you? No. Of me. That's the bit that got me."], fx: { w: -2 } },
      { l: '"Don\'t listen to her."', q: "don't listen to her", r: ["She's fourteen and she's the only one in your family who told me the truth."], fx: { w: -3 } },
      { l: '"She\'s right."', r: ["...Yeah. Yeah, I think she is. I'm sorry."], fx: { w: 2 } }] },
    { text: "I can't do this. It's not the papers. It's not Delmor. It's not even the cocaine. It's that you look at your phone like it's going to save you. I'm deleting the app. Look after yourself. Actually, let someone else do it.", final: true, o: [
      { l: '"Please don\'t go."', r: ["Everyone says that. Then they go back to their phone. You're doing it now. I can hear you doing it."] },
      { l: '"I understand."', r: ["No you don't. That's ok. Nobody does. Bye, chairman."] },
      { l: '"Is it the cocaine?"', r: ["It's a bit the cocaine."] }] }
  ];
  const SARAH_NODATE = "You matched with me, said 'evening m'lady', then nothing for a week, then 'u up'. I'm a night nurse. I'm always up. Coffee? Not your house.";
  K.SARAH = SARAH;
  K.sarahText = function () {
    const T = K.tinderState(); const sa = T.sarah;
    if (sa.ended || sa.stage < 1 || sa.stage >= SARAH.length) return null;
    const m = T.matches.Sarah || K.tinderRecord({ name: 'Sarah', agenda: 'genuine' });
    registerContact(m);
    const beat = SARAH[sa.stage];
    const text = sa.stage === 1 && !sa.dates ? SARAH_NODATE : beat.text;
    const e = K.queueThread(m.contact, { id: 'sarah_beat', text, cat: 'friendly' });
    if (e) e.stage = sa.stage;
    sa.stage++; sa.next = K.tick() + 2;
    // a final message nobody answers still ends it (at the next matchday)
    if (beat.final) sa.finalSent = K.tick();
    return e;
  };
  async function sarahLeaves() {
    const T = K.tinderState(); if (T.sarah.ended) return;
    T.sarah.ended = true; T.sarah.endedTick = K.tick();
    const c = S.contacts[slug('Sarah')]; if (c) { c.gone = 'Sarah has deleted her account. The messages are still there. Yours are blue. Hers are grey. That\'s it.'; c.relation = 'blocked'; }
    if (S.loneliness !== undefined) S.loneliness = clamp((S.loneliness || 50) + 5, 0, 100);
    logSafe('💔 Sarah deletes the app. There are other matches. None of them work nights at a care home. None of them asked how you were. Loneliness +5.');
    try { window.KUI && KUI.toast('💔 Sarah has left the chat.', 'bad', 5000); } catch (_) {}
  }
  K.sarahLeaves = sarahLeaves;
  // let 087s's thread renderer find these
  (function patchThreads() {
    const orig = K.pendingThread;
    K.pendingThread = function (id) {
      const c = S.contacts && S.contacts[id];
      if (c && Array.isArray(c.queued_texts)) {
        const e = c.queued_texts.find(x => x.thread && !x.answered && !x.expired && (x.thread === 'sarah_beat' || x.thread === 'tinder_after'));
        if (e) return e;
      }
      return orig(id);
    };
    const origRender = K.renderPendingThread;
    K.renderPendingThread = async function (id) {
      const c = S.contacts && S.contacts[id];
      const e = c && Array.isArray(c.queued_texts) ? c.queued_texts.find(x => x.thread && !x.answered && !x.expired && (x.thread === 'sarah_beat' || x.thread === 'tinder_after')) : null;
      if (!e) return origRender(id);
      e.answered = true; e.read = true;
      if (e.thread === 'sarah_beat') {
        const beat = SARAH[e.stage]; const node = { o: beat.o.map(o => Object.assign({}, o, beat.final ? { after: sarahLeaves } : {})), onLeave: beat.final ? sarahLeaves : null };
        await K.runNode(id, node, 1, 'sarah_' + e.stage);
      } else {
        const m = Object.values(K.tinderState().matches).find(x => x.contact === id); curAfter = m;
        const beat = m && (AFTER[m.agenda] || AFTER.genuine)[0];
        if (beat) await K.runNode(id, { o: beat.o }, 1, 'after_' + m.agenda);
      }
      if (typeof window.openContactChat === 'function' && document.getElementById('phone-choice-container')) await window.openContactChat(id);
      return true;
    };
  })();

  GameHooks.on('postmatch:end', () => K.tinderTick());
  // after a load: matches are phone contacts again
  GameHooks.on('init', () => { try { if (window.S && S.tinder && S.contacts) Object.values(K.tinderState().matches).forEach(m => registerContact(m)); } catch (_) {} });
  K.tinderTick = function () {
    try {
      if (!window.S || !S.contacts || (S.season | 0) < 4) return;
      const T = K.tinderState();
      // re-attach chat definitions after a load
      Object.values(T.matches).forEach(m => registerContact(m));
      // Sarah's beats
      if (!T.sarah.ended && T.sarah.stage >= 1 && K.tick() >= T.sarah.next) K.sarahText();
      // one post-date text a matchday from someone else you've dated
      const dated = Object.values(T.matches).filter(m => m.name !== 'Sarah' && m.dates > 0 && !m.afterSent && K.tick() >= (m.afterNext | 0));
      if (dated.length && Math.random() < 0.6) {
        const m = dated[0]; const beat = (AFTER[m.agenda] || AFTER.genuine)[0];
        m.afterSent = true; curAfter = m;
        const e = K.queueThread(m.contact, { id: 'tinder_after', text: K.fill(beat.text, { price: K.short(m.price), name: m.name }), deadline: !!beat.deadline, cat: 'friendly' });
        if (e && beat.deadline) e.agenda = m.agenda;
      }
    } catch (e) { console.error('tinder postmatch', e); }
  };
  // the last beat is final even if you never open it; unpaid gold-diggers publish
  GameHooks.on('matchday:end', function () {
    try {
      if (!window.S || !S.tinder) return;
      const T = K.tinderState();
      if (!T.sarah.ended && T.sarah.finalSent != null && K.tick() > T.sarah.finalSent) sarahLeaves();
    } catch (e) { console.error(e); }
  });
  GameHooks.on('prematch:events', function () {
    try {
      if (!window.S || !S.tinder) return;
      for (const m of Object.values(K.tinderState().matches)) {
        const c = S.contacts && S.contacts[m.contact]; if (!c) continue;
        for (const e of (c.queued_texts || [])) {
          if (e.thread !== 'tinder_after' || !e.deadline || e.answered || e.expired || K.tick() <= e.tick) continue;
          e.expired = true; e.read = true;
          addEvidence({ kind: 'tinder', label: `${m.name}'s photos went to the Echo (you ignored her)`, weight: 18, witness: m.contact, witnessLabel: `${m.name} (Tinder)`, tags: ['sex'], forceLeak: true });
          logSafe(`⏳ You never answered ${K.esc(m.name)}. The photos are with the Echo now.`);
        }
      }
    } catch (e) { console.error(e); }
  });

  // ---------- a clear way out of swiping ----------
  K.tinderSwipeUI = function (closeModal) {
    try {
      const sv = document.getElementById('tinderSwipeView'); if (!sv) return;
      let b = document.getElementById('tinderDoneBtn');
      if (!b) {
        b = document.createElement('button'); b.id = 'tinderDoneBtn'; b.className = 'tinder-done-btn'; b.textContent = 'Done swiping';
        sv.appendChild(b);
      }
      b.onclick = () => { logSafe('You put the phone face down. It buzzes once. It\'s the Echo.'); closeModal(); };
    } catch (e) { console.error('tinderSwipeUI', e); }
  };
})();
