/* ===================== KREPLIN deeper systems: TEXTING =====================
   docs/systems-design.md 2.1. Extends the phone in 079-phone-news.js (hooks there call in here):
   - S.relationships[id] = { warmth, trust, fear, lust, memory:[{quote,tick,used}], promises:[], broken:[], staleUnread }
     per contact; the secretary's numbers stay secRel/secTrust/secRisk (mirrored both ways).
   - conversations 2–3 messages deep: after the first-level quick text (unchanged) you get
     follow-ups (FOLLOW[contact][tone]); replies depend on the relationship (warm/cold variants).
   - memory: things you said come back weeks later (K.callback); promises are kept or broken.
   - incoming threads with reply options (INCOMING), some with a deadline ("reply by kickoff").
   - unread texts go stale after 2 matches, with a cost per contact (STALE).
   - erotic / threatening / high texts become evidence; the other person may screenshot them.
   - wife (seasons 1–3) and "Ex-wife (at Delmor's)" from season 4: taunts, and now and then
     Delmor dirt you can bury a story with (KSys.addDirt).
   Tinder matches (087t) register their own contacts through K.chatContacts. */
(function () {
  const K = window.KSys;
  const rint = K.rint;
  const P = (key, pool) => K.pick(key, pool);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const first = n => (typeof n === 'string' && n.trim()) ? n.trim().split(/\s+/)[0] : null;

  // ---------- names ----------
  const N = () => {
    const s = window.S || {};
    return {
      cap: s.captain_name || 'the captain', capF: first(s.captain_name) || 'Cap',
      capwife: s.captain_wife_name || "the captain's wife", mgr: (s.manager && s.manager.name) || s.manager_name || 'the manager',
      wifeF: first(s.wife_name) || 'Babs', daughter: first(s.child2_name) || 'Ellie', son: first(s.child1_name) || 'Tyler',
      sec: s.secretary_name || 'your secretary', secF: first(s.secretary_name) || 'Tracey', me: s.player_firstname || first(s.full_name) || 'Kreplin',
      debt: K.short((s.drugs && s.drugs.debt) || 60000), opp: K.oppTeam(), Chair: K.surname(), chair: K.surname().toUpperCase()
    };
  };
  const fill = (t, x) => K.fill(t, Object.assign(N(), x || {}));

  // ---------- relationships ----------
  const SEED = {
    captain: { warmth: 50, trust: 50, fear: 20, lust: 0 }, captain_wife: { warmth: 40, trust: 40, fear: 10, lust: 10 },
    manager: { warmth: 45, trust: 45, fear: 30, lust: 0 }, bookie_marco: { warmth: 35, trust: 30, fear: 5, lust: 0 },
    delmor_krunchem: { warmth: 5, trust: 5, fear: 0, lust: 0 }, womens_manager: { warmth: 40, trust: 40, fear: 5, lust: 0 },
    wife: { warmth: 55, trust: 40, fear: 10, lust: 20 }, ex_wife: { warmth: 15, trust: 10, fear: 0, lust: 5 },
    secretary: { warmth: 30, trust: 30, fear: 10, lust: 0 }
  };
  K.rel = function (id) {
    ensureSystemsState();
    const R = (S.relationships && typeof S.relationships === 'object') ? S.relationships : (S.relationships = {});
    let r = R[id];
    if (!r) {
      const sd = Object.assign({ warmth: 40, trust: 35, fear: 5, lust: 5 }, SEED[id] || {});
      const c = S.contacts && S.contacts[id];
      if (c && id === 'captain_wife') sd.lust = clamp((c.flirt_level | 0) * 8, 0, 100);
      if (id === 'wife' && typeof S.wife_love === 'number') sd.warmth = clamp(S.wife_love, 0, 100);
      r = R[id] = Object.assign(sd, { memory: [], promises: [], broken: [], staleUnread: 0, lastCallback: -9 });
    }
    if (id === 'secretary') { // her builder owns these numbers
      if (typeof S.secRel === 'number') r.warmth = S.secRel;
      if (typeof S.secTrust === 'number') r.trust = S.secTrust;
      if (typeof S.secRisk === 'number') r.fear = S.secRisk;
    }
    return r;
  };
  K.mood = function (id) { const r = K.rel(id); return ((r.warmth + r.trust) / 2 - r.fear / 4 + (id === 'captain_wife' ? r.lust / 4 : 0)) >= 40 ? 'w' : 'c'; };
  // relationship + game effects. Keys: w t f l (warmth trust fear lust) and game keys below.
  K.textFx = function (id, fx) {
    if (!fx || !window.S) return;
    const r = K.rel(id);
    const map = { w: 'warmth', t: 'trust', f: 'fear', l: 'lust' };
    for (const k in map) if (fx[k]) r[map[k]] = clamp((r[map[k]] || 0) + fx[k], 0, 100);
    if (id === 'secretary') { S.secRel = clamp(r.warmth, 0, 100); S.secTrust = clamp(r.trust, 0, 100); }
    if (id === 'wife' && fx.w) S.wife_love = clamp((S.wife_love == null ? 60 : S.wife_love) + Math.round(fx.w / 2), 0, 100);
    if (fx.mor) S.morale = clamp((S.morale || 0) + fx.mor, -100, 100);
    if (fx.love) S.wife_love = clamp((S.wife_love == null ? 60 : S.wife_love) + fx.love, 0, 100);
    if (fx.mar) S.marital_risk = clamp((S.marital_risk || 0) + fx.mar, 0, 100);
    if (fx.quit) S.captain_quit_risk = clamp((S.captain_quit_risk || 0) + fx.quit, 0, 100);
    if (fx.cash) S.chairman_cash = Math.max(0, (S.chairman_cash || 0) + fx.cash);
    if (fx.club) S.club_cash = Math.max(0, (S.club_cash || 0) + fx.club);
    if (fx.debt) { ensureSystemsState(); S.drugs.debt = Math.max(0, (S.drugs.debt | 0) + fx.debt); }
    if (fx.pol) S.police_risk = (S.police_risk | 0) + fx.pol;
    if (fx.rep) S.reputation = clamp((S.reputation || 50) + fx.rep, 0, 100);
    if (fx.lone && S.loneliness !== undefined) S.loneliness = clamp((S.loneliness || 50) + fx.lone, 0, 100);
    if (fx.secR) S.secRisk = clamp((S.secRisk || 0) + fx.secR, 0, 100);
    if (fx.flirt && S.contacts && S.contacts.captain_wife) { const c = S.contacts.captain_wife; c.flirt_level = clamp((c.flirt_level || 0) + fx.flirt, 0, 10); }
    if (fx.susp && S.contacts && S.contacts.captain_wife) { const c = S.contacts.captain_wife; c.suspicion = clamp((c.suspicion || 0) + fx.susp, 0, 10); }
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
  };
  // what a quick tone does to how they feel (on top of 079's applyEffects)
  const TONE_FX = { friendly: { w: 4 }, professional: { t: 3 }, malicious: { f: 6, w: -5 }, flirtatious: { l: 5, t: -1 }, erotic: { l: 7, t: -4 }, inappropriate_picture: { t: -8, w: -6, f: 4 } };

  // ---------- memory ----------
  K.remember = function (id, quote, key) {
    if (!quote) return;
    const r = K.rel(id);
    r.memory.push({ quote: String(quote).slice(0, 80), key: key || null, tick: K.tick(), used: false });
    while (r.memory.length > 12) r.memory.shift();
  };
  // a line that brings up something you said at least 2 matchdays ago (null if nothing to bring up)
  K.callback = function (id, force) {
    const r = K.rel(id), t = K.tick();
    const m = r.memory.find(x => !x.used && t - x.tick >= 2);
    if (!m || (!force && t - (r.lastCallback | 0) < 2)) return null;
    m.used = true; r.lastCallback = t;
    const pool = CALLBACKS[id] || CALLBACKS._;
    const weeks = t - m.tick;
    return fill(P('cb_' + (CALLBACKS[id] ? id : '_'), pool), { said: m.quote, weeks: weeks + ' match' + (weeks === 1 ? '' : 'es') });
  };
  K.promise = function (id, key, said, dueIn) {
    const r = K.rel(id);
    r.promises.push({ key, said, due: K.tick() + (dueIn || 1) });
  };

  // ---------- evidence from what you send ----------
  const plain = m => { m = String(m || ''); if (/<video/i.test(m)) return '[a raunchy video]'; if (/<img/i.test(m)) return '[an inappropriate picture]'; return m.replace(/<[^>]+>/g, '').slice(0, 60); };
  const cname = id => (S.contacts && S.contacts[id] && S.contacts[id].name) || id;
  K.textEvidence = function (id, msg, category, o) {
    if (!window.S || id === 'delmor_krunchem' && category !== 'erotic' && category !== 'inappropriate_picture') return null;
    o = o || {};
    const high = K.isHigh && K.isHigh();
    let kind = null, w = 0, tag = null, label = null;
    if (category === 'erotic' || category === 'inappropriate_picture' || o.sext) { kind = 'sext'; w = category === 'inappropriate_picture' ? 12 : 9; tag = 'sex'; label = `Sexted ${cname(id)}: "${plain(msg)}"`; }
    else if (category === 'malicious' || o.threat) { kind = 'threat'; w = 6; tag = 'violence'; label = `Threatening text to ${cname(id)}: "${plain(msg)}"`; }
    else if (high) { kind = 'text'; w = 6; tag = 'drugs'; label = `Texted ${cname(id)} while off your face: "${plain(msg)}"`; }
    if (!kind) return null;
    if (high && tag !== 'drugs') w += 3;
    const r = K.rel(id);
    // will they screenshot it? low trust, high fear, scorned
    const p = clamp(0.2 + r.fear / 200 + (100 - r.trust) / 300 + (o.screenshot || 0) + (S.sys && S.sys.bugged ? 0.2 : 0), 0, 0.9); // Delmor's phone behind the telly hears it too
    const shot = Math.random() < p;
    const ev = addEvidence({ kind, label, weight: w + (shot ? 4 : 0), witness: id, witnessLabel: cname(id), tags: [tag], noLeak: !shot, leakBonus: shot ? 0.08 : 0 });
    if (ev) { ev.screenshot = shot; ev.text = plain(msg); }
    if (shot) try { logSafe(`📸 ${K.esc(cname(id))} screenshotted it.`); } catch (_) {}
    return ev;
  };

  // ---------- chat helpers (079's phone popup) ----------
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pushHist = (id, from, text, category) => {
    const c = S.contacts && S.contacts[id]; if (!c) return;
    c.history = c.history || []; c.history.push({ from, text, category: category || null, timestamp: Date.now() });
    while (c.history.length > 20) c.history.shift();
  };
  async function theySay(id, text) {
    if (typeof phoneMessagesContainer !== 'undefined' && phoneMessagesContainer) { showTypingIndicator(); await wait(900 + Math.random() * 700); hideTypingIndicator(); addMessageToPhonePopup(text, false, 0); }
    pushHist(id, 'them', text);
    if (id === 'secretary' && Array.isArray(S.secMessageHistory) && !S.isSecretarySessionActive) S.secMessageHistory.push({ message: text, isUser: false, timestamp: Date.now() });
    try { log(`📱 ${K.esc(cname(id))}: "${K.esc(plain(text))}"`); } catch (_) {}
  }
  function iSay(id, text) {
    if (typeof phoneMessagesContainer !== 'undefined' && phoneMessagesContainer) addMessageToPhonePopup(text, true, 0);
    pushHist(id, 'you', text);
  }
  const pickReply = (id, r, key) => {
    if (!r) return null;
    if (Array.isArray(r)) return fill(P(key, r));
    const m = K.mood(id); const pool = r[m] || r.w || r.c;
    return fill(P(key + m, pool));
  };

  // Run a conversation node in the phone: 2–3 follow-ups deep. Resolves when the thread ends.
  K.runNode = async function (id, node, depth, key) {
    depth = depth || 1; key = key || id;
    while (node && depth <= 3) {
      const opts = (node.o || []).filter(o => !o.if || o.if());
      if (!opts.length || typeof document === 'undefined' || !document.getElementById('phone-choice-container')) return;
      const list = opts.map((o, i) => ({ key: String(i), label: `↩ ${fill(o.l)}` }));
      list.push({ key: '_x', label: node.leave || '(Leave it on read)' });
      let k;
      try { k = await chooseInPhone(list, node.p ? fill(node.p) : 'Reply:'); } catch (_) { return; }
      if (k === '_x') { if (node.onLeave) node.onLeave(); return; }
      const o = opts[+k];
      const said = fill(o.s || o.l.replace(/^"|"$/g, ''));
      iSay(id, said);
      if (o.q) K.remember(id, fill(o.q), o.key);
      if (o.pr) K.promise(id, o.pr, said, o.due || 1);
      if (o.fx) K.textFx(id, o.fx);
      if (o.ev) K.textEvidence(id, said, o.ev === 'sext' ? 'erotic' : o.ev === 'threat' ? 'malicious' : o.ev, { sext: o.ev === 'sext', threat: o.ev === 'threat', screenshot: o.shot || 0 });
      else if (K.isHigh && K.isHigh() && depth === 1) K.textEvidence(id, said, 'high');
      if (o.go) { try { await o.go(); } catch (e) { console.error('thread go', e); } }
      const rep = typeof o.r === 'function' ? o.r() : pickReply(id, o.r, `tr_${key}_${depth}_${k}`);
      if (rep) await theySay(id, rep);
      if (o.after) { try { await o.after(); } catch (e) { console.error('thread after', e); } }
      node = o.n; depth++;
    }
  };

  // ---------- 079 hooks ----------
  // First reply to a quick text: a callback to something you said weeks ago, or a mood line when
  // the relationship is at an extreme. Null = 079's randomReply (all existing lines) answers.
  K.threadReply = function (id, category) {
    try {
      if (!window.S) return null;
      const cb = Math.random() < 0.45 ? K.callback(id) : null;
      if (cb) return { text: cb, category: 'friendly' };
      const r = K.rel(id); const md = MOOD[id];
      if (md && (r.warmth < 25 || r.fear > 60 || r.warmth > 75) && Math.random() < 0.4) {
        const pool = r.fear > 60 ? (md.f || md.c) : r.warmth > 75 ? md.w : md.c;
        if (pool) return { text: fill(P(`mood_${id}_${r.fear > 60 ? 'f' : r.warmth > 75 ? 'w' : 'c'}`, pool)), category: 'friendly' };
      }
    } catch (e) { console.error('threadReply', e); }
    return null;
  };
  // After a text has been sent and answered (079 sendText): relationship, evidence, follow-ups.
  K.afterText = async function (id, message, category) {
    if (!window.S) return;
    K.textFx(id, TONE_FX[category] || {});
    K.textEvidence(id, message, category);
    const node = FOLLOW[id] && (FOLLOW[id][category] || (category === 'inappropriate_picture' && FOLLOW[id].erotic));
    if (node) await K.runNode(id, node, 1, `f_${id}_${category}`);
  };
  // secretary (031 processSecretaryResponse): evidence + follow-ups by category
  K.onSecretarySent = function (category, attachment, message) {
    const cat = attachment === 'inappropriate' || attachment === 'raunchy_video' ? 'inappropriate_picture' : category === 'erotic' ? 'erotic' : category === 'flirtatious' ? 'flirtatious' : 'friendly';
    if (cat !== 'friendly' && cat !== 'flirtatious') K.textEvidence('secretary', message, cat);
    else if (K.isHigh && K.isHigh()) K.textEvidence('secretary', message, 'high');
  };
  K.afterSecretaryText = async function (category) {
    const node = FOLLOW.secretary[category];
    if (node && Math.random() < 0.7) await K.runNode('secretary', node, 1, 'f_sec_' + category);
  };

  // ---------- incoming threads (unsolicited texts you can answer) ----------
  // queue a threaded text: stamped with the matchday tick; deadline = "reply by kickoff"
  K.queueThread = function (id, th) {
    if (!S.contacts || !S.contacts[id]) return null;
    const text = fill(typeof th.text === 'function' ? th.text() : th.text);
    queueIncomingText(id, text + (th.deadline ? ' ⏳' : ''), th.cat || 'friendly');
    const q = S.contacts[id].queued_texts; const e = q[q.length - 1];
    e.tick = K.tick(); e.thread = th.id; if (th.deadline) e.deadline = true;
    S.sys.threadsThisTick = (S.sys.threadsThisTick | 0) + 1;
    return e;
  };
  K.pendingThread = function (id) {
    const c = S.contacts && S.contacts[id]; if (!c || !Array.isArray(c.queued_texts)) return null;
    return c.queued_texts.find(e => e.thread && !e.answered && !e.expired && THREADS[e.thread]) || null;
  };
  // 079 openContactChat: if a thread waits for an answer, show its options instead of the tone buttons
  K.renderPendingThread = async function (id) {
    const e = K.pendingThread(id); if (!e) return false;
    const th = THREADS[e.thread];
    if (e.deadline && typeof phoneMessagesContainer !== 'undefined' && phoneMessagesContainer) addMessageToPhonePopup('⏳ Reply before the next kickoff', false, 0);
    e.answered = true; e.read = true;
    await K.runNode(id, th.node, 1, 't_' + th.id);
    if (typeof window.openContactChat === 'function' && document.getElementById('phone-choice-container')) await window.openContactChat(id);
    return true;
  };
  // the secretary's own chat (031): unread texts + an answer button
  K.secretaryThreadButton = function (choice, rerender) {
    try {
      const c = S.contacts && S.contacts.secretary; if (!c || !choice) return;
      const unread = (c.queued_texts || []).filter(t => !t.read && t.type === 'incoming');
      unread.forEach(t => { addMessageToPhonePopup(t.text, false, 60); t.read = true; });
      if (unread.length) { S.phone_unread = Math.max(0, (S.phone_unread | 0) - unread.length); try { updateHUD(); } catch (_) {} }
      const e = K.pendingThread('secretary'); if (!e) return;
      const b = document.createElement('button'); b.className = 'btn-primary'; b.textContent = `↩ Answer ${N().secF}${e.deadline ? ' ⏳' : ''}`;
      b.onclick = async () => { e.answered = true; await K.runNode('secretary', THREADS[e.thread].node, 1, 't_' + e.thread); rerender && rerender(); };
      choice.insertBefore(b, choice.firstChild);
    } catch (err) { console.error('secretaryThreadButton', err); }
  };

  // ---------- contacts owned here (wife / ex-wife; 087t adds Tinder matches) ----------
  K.chatContacts = K.chatContacts || {};
  K.ownsContact = id => !!K.chatContacts[id];
  K.extraContacts = () => Object.keys(K.chatContacts).filter(id => S.contacts && S.contacts[id] && S.contacts[id].unlocked);
  K.ensureContact = function (id, name, status) {
    initPhoneSystem();
    const c = S.contacts[id] || (S.contacts[id] = { id, unlocked: true, name, relation: 'friendly', flirt_level: 0, suspicion: 0, cooldown: 0, queued_texts: [], history: [] });
    if (name) c.name = name; if (status) c.status = status;
    return c;
  };
  // the chat screen for a contact owned by a system file: history, unread, thread, quick tones
  K.openChat = async function (id) {
    const def = K.chatContacts[id]; const c = S.contacts && S.contacts[id];
    if (!def || !c) return;
    if (def.sync) def.sync();
    createPhoneTextPopup(c.name, def.status ? fill(def.status) : '');
    (c.history || []).slice(-14).forEach(h => addMessageToPhonePopup(h.text, h.from === 'you', 0));
    (c.queued_texts || []).filter(t => !t.read && t.type === 'incoming').forEach(t => { addMessageToPhonePopup(t.text, false, 80); t.read = true; S.phone_unread = Math.max(0, (S.phone_unread | 0) - 1); });
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
    await wait(120);
    const choice = document.getElementById('phone-choice-container'); if (!choice) return;
    if (await K.renderPendingThread(id)) return;
    if (c.gone) { addMessageToPhonePopup(fill(c.gone), false, 0); }
    choice.style.display = 'flex'; choice.style.flexDirection = 'column'; choice.style.gap = '6px'; choice.innerHTML = '';
    const tones = c.gone ? {} : (typeof def.tones === 'function' ? def.tones() : def.tones) || {};
    const labels = { friendly: '😊 Friendly', professional: '💼 Professional', malicious: '😈 Malicious', flirtatious: '😘 Flirtatious', erotic: '🔥 Erotic', inappropriate_picture: '📷 Inappropriate Picture' };
    Object.keys(tones).forEach(cat => {
      const b = document.createElement('button'); b.className = 'btn-primary'; b.textContent = labels[cat] || cat;
      b.onclick = async () => { await K.sendOwned(id, cat); await K.openChat(id); };
      choice.appendChild(b);
    });
    const back = document.createElement('button'); back.className = 'btn-secondary'; back.textContent = 'Back';
    back.onclick = () => { openPhoneContacts(); };
    choice.appendChild(back);
  };
  K.sendOwned = async function (id, cat) {
    const def = K.chatContacts[id]; const c = S.contacts[id]; if (!def || !c) return;
    c.textsThisPhase = c.textsThisPhase | 0;
    if (c.textsThisPhase >= 5) { log("📱 You've reached the limit of 5 texts per person per phase. Wait for the next phase."); return; }
    c.textsThisPhase++;
    const tones = (typeof def.tones === 'function' ? def.tones() : def.tones) || {};
    let msg = tones[cat]; if (!msg) return;
    if (cat === 'inappropriate_picture' && typeof ATTACHMENTS !== 'undefined' && ATTACHMENTS.inappropriate && ATTACHMENTS.inappropriate.length) msg = ATTACHMENTS.inappropriate[Math.floor(Math.random() * ATTACHMENTS.inappropriate.length)];
    iSay(id, fill(msg));
    const cb = Math.random() < 0.45 ? K.callback(id) : null;
    const rep = cb || (def.reply ? def.reply(cat) : null) || '...';
    await theySay(id, fill(rep));
    K.textFx(id, Object.assign({}, TONE_FX[cat] || {}, (def.fx && def.fx[cat]) || {}));
    K.textEvidence(id, msg, cat);
    if (def.after) { try { await def.after(cat); } catch (e) { console.error(e); } }
    const node = def.follow && def.follow[cat];
    if (node) await K.runNode(id, node, 1, `f_${id}_${cat}`);
  };

  // ---------- wife -> ex-wife ----------
  const wifeGone = () => !!(S.season4 && S.season4.wife_left_for_delmor) || (S.season | 0) >= 4;
  K.syncWife = function () {
    if (!window.S || !S.contacts) return;
    if (!S.wife_name) return;
    const married = S.married !== false;
    if (!wifeGone()) {
      const w = K.ensureContact('wife', `${N().wifeF} (Wife)`, 'Wife');
      w.unlocked = married;
      if (S.contacts.ex_wife) S.contacts.ex_wife.unlocked = false;
      return;
    }
    if (S.contacts.wife) S.contacts.wife.unlocked = false;
    const fresh = !S.contacts.ex_wife;
    const ex = K.ensureContact('ex_wife', `${N().wifeF} (at Delmor's)`, "Ex-wife (at Delmor's)");
    ex.unlocked = true;
    if (fresh) {
      const r = K.rel('ex_wife'), w = S.relationships && S.relationships.wife;
      if (w) { r.memory = (w.memory || []).map(m => Object.assign({}, m, { used: false })); r.broken = (w.broken || []).slice(); }
      S.sys.exNextDirt = K.tick() + rint(1, 2); // the first bit of dirt comes early
    }
  };

  // ---------- cadence ----------
  // after the match: at most one threaded text from here (plus the ex-wife), never more than 2
  GameHooks.on('postmatch:end', function () {
    try {
      if (!window.S || !S.contacts) return;
      ensureSystemsState();
      K.syncWife();
      if (S.sys.threadTick === K.tick()) return;
      S.sys.threadTick = K.tick(); S.sys.threadsThisTick = 0;
      if (Math.random() < 0.5) {
        const elig = INCOMING.filter(th => S.contacts[th.who] && S.contacts[th.who].unlocked && !K.pendingThread(th.who) && (!th.when || th.when()) && !(S.sys.threadSeen || {})[th.id + '@' + (S.season | 0)]);
        if (elig.length) {
          const th = elig[Math.floor(Math.random() * elig.length)];
          K.queueThread(th.who, th);
          (S.sys.threadSeen = S.sys.threadSeen || {})[th.id + '@' + (S.season | 0)] = 1;
        }
      }
      K.exWifeTick();
    } catch (e) { console.error('texting postmatch', e); }
  });
  // ex-wife: taunts, and every few matches a bit of Delmor dirt (only if you answer)
  K.exWifeTick = function () {
    try {
      const ex = S.contacts.ex_wife;
      if (ex && ex.unlocked && !K.pendingThread('ex_wife') && (S.sys.threadsThisTick | 0) < 2) {
        if (K.tick() >= (S.sys.exNextDirt | 0)) {
          const d = P('ex_dirt', EX_DIRT);
          THREADS.ex_dirt.cur = d;
          K.queueThread('ex_wife', { id: 'ex_dirt', text: d.text, cat: 'friendly' }).dirt = d;
          S.sys.exNextDirt = K.tick() + rint(3, 5);
        } else if (Math.random() < 0.4) {
          queueIncomingText('ex_wife', fill(P('ex_taunt', EX_TAUNTS)), 'malicious');
          const q = ex.queued_texts; q[q.length - 1].tick = K.tick();
        }
      }
    } catch (e) { console.error('exWifeTick', e); }
  };
  // stale texts, broken promises, deadlines
  GameHooks.on('matchday:end', function () {
    try {
      if (!window.S || !S.contacts) return;
      ensureSystemsState();
      const t = K.tick();
      for (const id of Object.keys(S.contacts)) {
        const c = S.contacts[id]; if (!c || !Array.isArray(c.queued_texts)) continue;
        let stale = 0;
        for (const e of c.queued_texts) {
          if (e.type !== 'incoming' || e.read || e.staleNote) continue;
          if (typeof e.tick !== 'number') { e.tick = t - 1; continue; }
          if (!e.stale && t - e.tick >= 2) { e.stale = true; stale++; }
        }
        if (stale) K.goneStale(id, stale);
      }
      // promises fall due
      for (const id of Object.keys(S.relationships || {})) {
        const r = S.relationships[id]; if (!r || !Array.isArray(r.promises)) continue;
        r.promises = r.promises.filter(pr => {
          if (pr.due > t) return true;
          const kept = !(K.isHigh && K.isHigh()) && Math.random() < 0.5;
          if (kept) { K.textFx(id, { w: 4, t: 4 }); logSafe(fill(P('pr_kept', PROMISE_KEPT), { who: cname(id) })); }
          else {
            r.broken = r.broken || []; r.broken.push({ said: pr.said, tick: t });
            K.remember(id, pr.said, 'broken');
            K.textFx(id, { w: -8, t: -10, love: id === 'wife' ? -6 : 0, mar: id === 'wife' ? 5 : 0, mor: id === 'captain' ? -3 : 0 });
            logSafe(fill(P('pr_broken', PROMISE_BROKEN), { who: cname(id), said: pr.said }));
          }
          return false;
        });
      }
    } catch (e) { console.error('texting matchday', e); }
  });
  // "reply by kickoff": unanswered deadline texts expire before the next match
  K.checkDeadlines = function () {
    try {
      if (!window.S || !S.contacts) return;
      const t = K.tick();
      for (const id of Object.keys(S.contacts)) {
        const c = S.contacts[id]; if (!c || !Array.isArray(c.queued_texts)) continue;
        for (const e of c.queued_texts) {
          if (!e.deadline || !THREADS[e.thread] || e.answered || e.expired || typeof e.tick !== 'number' || t <= e.tick) continue;
          e.expired = true; e.read = true;
          const th = THREADS[e.thread];
          if (th && th.expire) { try { th.expire(); } catch (err) { console.error('expire', err); } }
          if (th && th.expireLine) { logSafe('⏳ ' + fill(th.expireLine)); try { window.KUI && KUI.toast('⏳ ' + plain(fill(th.expireLine)), 'bad', 4500); } catch (_) {} }
        }
      }
    } catch (e) { console.error('texting deadlines', e); }
  };
  GameHooks.on('prematch:events', () => K.checkDeadlines());
  GameHooks.on('init', () => { try { if (window.S && S.contacts) K.syncWife(); } catch (_) {} });

  // stale: you left them on read for two matches
  K.goneStale = function (id, n) {
    const r = K.rel(id); r.staleUnread = (r.staleUnread | 0) + n;
    const cost = STALE[id] || STALE._;
    if (cost.quiet) return;
    K.textFx(id, cost.fx);
    if (id === 'bookie_marco') { ensureSystemsState(); if ((S.drugs.debt | 0) > 0) S.drugs.debt += Math.max(1000, Math.round(S.drugs.debt * 0.1)); }
    if (id === 'secretary') S.secTrust = clamp((S.secTrust || 0) - 5, 0, 100);
    if (id === 'ex_wife') {
      let lost = 0; (S.contacts.ex_wife.queued_texts || []).forEach(e => { if (e.thread === 'ex_dirt' && !e.answered && !e.expired) { e.expired = true; lost++; } });
      if (!lost) return; // a taunt left on read costs nothing; dirt left on read is gone
    }
    const line = fill(P('stale_' + (STALE[id] ? id : '_'), cost.lines));
    if (S.contacts[id] && S.contacts[id].unlocked) { queueIncomingText(id, line, 'malicious'); const q = S.contacts[id].queued_texts; q[q.length - 1].tick = K.tick(); q[q.length - 1].staleNote = true; }
    try { logSafe(`📵 You left ${K.esc(cname(id))} on read. ${cost.note ? fill(cost.note) : ''}`); } catch (_) {}
  };

  // ======================================================================
  //                               CONTENT
  // ======================================================================
  const CALLBACKS = {
    _: ["You said '{said}' {weeks} ago. I've been thinking about it. I wish I hadn't.", "Still thinking about '{said}'. Were you ok? You weren't ok.", "Remember '{said}'? I screenshotted it. For my memories. Not for anything else."],
    captain: ["You called me '{said}' at 3am {weeks} ago and asked if I was 'in the game'. Are you in the game, gaffer?", "The lads keep asking what you meant by '{said}'. I've told them it's tactics. Is it tactics?", "Gaffer, '{said}'. Still on my phone. I read it before every game now. I don't know why. We've lost three.", "Remember when you said '{said}'? Our left back had it printed on a t-shirt. He wore it to church."],
    captain_wife: ["You said '{said}' and then nothing for {weeks}. I've had a bath since then. Several.", "He found '{said}' in my phone. I told him it was a recipe. He's asked for it. Cook him something, {Chair}.", "Still got '{said}' saved. In a folder. The folder is called 'insurance' 😘"],
    manager: ["With respect, {weeks} ago you said '{said}'. I've had it laminated. It's on the tactics board now.", "Boss, the board asked me about '{said}'. I said you were 'on a journey'. Are you?", "'{said}'. Your words. I've built a whole philosophy around it. We've not scored since."],
    bookie_marco: ["remember '{said}'? i do. i remember everything. its my job. well its one of my jobs", "'{said}' lol. ur funny. u know whats not funny. the tab", "u said '{said}' {weeks} ago. my cousin wrote it down. he writes everything down. hes like a priest but worse"],
    delmor_krunchem: ["You said '{said}'. I've had it printed on the away end toilet roll. Pompey fans wipe with you now.", "'{said}' — I read that one out at my birthday. Your wife laughed so hard she cried. She's here. She says hi.", "Still got your little text, '{said}'. Framed it. Hung it next to the photo of your car on fire."],
    womens_manager: ["As you said yourself, '{said}'. I've put that in the minutes 💅", "Funny, {weeks} ago you told me '{said}'. I've quoted it to the board. With context. Mostly."],
    wife: ["You said '{said}'. {weeks} ago. I wrote it on the calendar in red pen.", "'{said}'. That's what you said. Your mother was on speaker.", "I've been thinking about when you said '{said}'. Your daughter heard. She's drawn it. It's on the fridge."],
    ex_wife: ["Remember '{said}'? I told Delmor. He laughed so hard his teeth came out. Both sets.", "You once told me '{said}'. I believed you for nearly a minute. Best minute of the marriage.", "'{said}'. Delmor's had it embroidered on a cushion. I'm sitting on it right now."],
    secretary: ["For the record, {weeks} ago you texted me '{said}'. I've filed it under 'Miscellaneous (Disturbing)'.", "HR found '{said}' in the backup. I said it was about the photocopier. Is it about the photocopier?", "You said '{said}'. I've been carrying it around like a stone in my shoe. A stone that signs my wages."]
  };
  const MOOD = {
    captain: { w: ["Anything for you gaffer. Literally anything. Within reason. Mostly within reason.", "You're the best chairman I've had. You're the only chairman I've had who texts me at 4am but still."], c: ["Ok.", "Gaffer I'm in the bath.", "Is this about the parking space again"], f: ["Yes boss. Sorry boss. Won't happen again boss. What won't happen again boss?", "I've told the lads you're watching. They've started running. Some of them didn't know they could."] },
    captain_wife: { w: ["You always know what to say. He just talks about hamstrings.", "Hubby's at physio. Physio's an hour. Just saying 😘"], c: ["Who is this", "Please stop. He reads my phone when I'm asleep. He reads it out loud."], f: ["I've deleted everything. Please don't drop him. He cries in the car."] },
    manager: { w: ["Boss, you've got the instincts of a top-flight gaffer. And the haircut of one.", "Love this energy. Love it. Bottling it. Selling it."], c: ["Noted.", "I'll pass that on to the coaching staff. The coaching staff is me and a cone."], f: ["Understood. Absolutely. Please don't sack me in the Echo again.", "Of course boss. Whatever you say. I've already done it. What was it?"] },
    bookie_marco: { w: ["my favourite customer. dont tell the others. i tell them all that", "for u, mate's rates. mate's rates are higher btw"], c: ["k", "who dis. jk. pay me"], f: ["ok ok calm down. u sound like my nan when shes off her meds"] },
    delmor_krunchem: { c: ["Your little texts are the highlight of my day. After your wife.", "Keep them coming. I read them out on the Pompey coach. The driver nearly crashed laughing."] },
    wife: { w: ["Love you too, you absolute disaster x", "Come home early. Not too early. I'm watching something."], c: ["Ok.", "Read 11:14. That's all you're getting.", "Your dinner's in the dog."], f: ["I'm not scared of you. I'm scared FOR you. Which is worse, and you should know that."] },
    ex_wife: { c: ["Delmor says hi. He says it with his mouth full.", "Don't text after 9. Delmor gets jealous. Not of you. Of the phone."] },
    secretary: { w: ["You're a lovely boss. Weird. But lovely. Weird mostly.", "Always happy to help. Mostly happy. Partly happy."], c: ["Received.", "I'll diarise that.", "Noted. Logged. Backed up."], f: ["Of course. I've also backed this up to the cloud. And a USB. And my mum."] }
  };
  const PROMISE_KEPT = ["📱 You kept your word to {who}. Nobody, including you, can believe it.", "📱 You actually turned up for {who}. Late, sweating, in the wrong shoes, but you turned up."];
  const PROMISE_BROKEN = ["📱 You promised {who}: \"{said}\". You were in a Harvester. {who} remembers. {who} will always remember.", "📱 \"{said}\". You didn't. {who} has started a list. You're the whole list."];

  // unread for two matches
  const STALE = {
    _: { fx: { w: -5, t: -3 }, lines: ["?", "Read 2 weeks ago. Cool. Cool cool cool.", "Fine."] },
    wife: { fx: { w: -6, love: -2, mar: 3 }, note: 'She noticed. She notices everything.', lines: ["Read Tuesday. It's Saturday. I've changed the locks. Then changed them back. Then changed them again.", "You can read a referee's mind but not a text from your wife. Noted.", "Your daughter asked if you're dead. I said 'only inside'."] },
    captain: { fx: { w: -6, mor: -3 }, note: 'The captain sulks (morale −3).', lines: ["Gaffer you've left me on read twice. The lads have noticed. I've told them you're 'busy'. They've started saying 'busy' in a voice.", "Fine. I'll just captain myself then.", "Gaffer I'm doing the team talk in the mirror again"] },
    bookie_marco: { fx: { w: -6, t: -6 }, note: 'Marco charges for being ignored (+10% on any tab).', lines: ["u left me on read. thats a fee. its on the tab. everything is on the tab", "2 blue ticks and no reply. my cousin hates blue ticks. hes very sensitive", "ignoring me is +10%. replying is also +10% but u get a nice chat"] },
    secretary: { fx: { w: -4, t: -5 }, note: 'Her trust drops (−5).', lines: ["I've escalated my own message to myself. I've decided you're busy.", "Following up on my follow-up regarding my previous follow-up.", "I'll assume silence is consent. HR says that's a bad assumption. I've told HR it's your assumption."] },
    captain_wife: { fx: { l: -6, w: -5 }, lines: ["Typical. Like all of you. Like HIM.", "I put a dress on for that text. Taking it off now. Not like that."] },
    manager: { fx: { t: -6, mor: -1 }, note: 'The manager loses faith (morale −1).', lines: ["Boss? I'll take that as a 'stay the course'. Or a 'you're sacked'. Hard to tell with you.", "Read and no reply. I'm putting the U23s on standby. For me."] },
    ex_wife: { fx: { w: -3 }, note: 'Whatever she had on Delmor, she keeps.', lines: ["Forget it. Delmor's back. He's in the hot tub. Again. It's not a hot tub, it's the bath with a hairdryer.", "Your loss. It was GOOD as well."] },
    delmor_krunchem: { quiet: true, fx: {}, lines: ["Ignoring me? I'll text your wife instead. Oh wait. She's next to me.", "Silence. Like your fans at St Mary's."] },
    womens_manager: { fx: { w: -4 }, lines: ["Silence is a statement too 💅", "I'll note that in the minutes as 'chairman unavailable for comment'."] }
  };

  // ---------- follow-ups after a quick text (first level = 079's tone buttons) ----------
  // o: [{ l label, s said (default label), r reply [..] | {w:[..], c:[..]}, fx, q remembered quote, pr promise, ev evidence kind, n next node, if, go }]
  const FOLLOW = {
    captain: {
      friendly: { o: [
        { l: '"Proper captain\'s performance."', r: { w: ["Cheers gaffer. Means a lot. The lads were buzzing. One of them was literally buzzing, he swallowed a bee."], c: ["Ta. You said that last week before you called me 'the big lad' in the Echo."] }, fx: { w: 4, mor: 1 },
          n: { o: [
            { l: '"Pint on me Saturday."', s: "Pint on me after Saturday. Wetherspoons. I'll bring my card.", q: 'pint on me Saturday', pr: 'cap_pint', r: ["Go on then. Not the Wetherspoons where you fell in the fountain though.", "Deal. The lads say bring your actual card this time, not the Blockbuster one."], fx: { w: 3 } },
            { l: '"Love you mate. In a football way."', q: 'love you mate', r: ["...gaffer is it 3am where you are", "Love you too gaffer. Lads say hi. Lads also say please stop texting the group chat."], fx: { w: 2, f: 2 } }] } },
        { l: '"Who\'s the weak link? Be honest."', r: { w: ["Honestly? The left back. He cried in the shower. Not from the cold."], c: ["Not grassing on the lads. Ask the manager. Or the ball."] }, fx: { t: 2 },
          n: { o: [
            { l: '"Bench him."', r: ["Done. He's taken it well. He's moved into the boot room."], fx: { mor: -1, f: 3 } },
            { l: '"Give him a hug from me."', q: 'give him a hug from me', r: ["I did. He asked why you were 'like this'. I said nobody knows."], fx: { w: 2, mor: 1 } }] } },
        { l: '"Do you ever think the ball is watching us?"', if: () => K.isHigh && K.isHigh(), q: 'is the ball watching us', ev: 'high', r: ["Gaffer are you ok.", "Gaffer it's 4:12am."], fx: { mor: -3, f: 3 } }] },
      professional: { o: [
        { l: '"Clean sheet or the bonus goes to charity."', r: { w: ["Which charity?"], c: ["The lads want to know which charity. Some of them ARE a charity."] }, fx: { f: 3, t: 1 },
          n: { o: [
            { l: '"Me. I\'m the charity."', q: "I'm the charity", r: ["Fair. Leave it with me gaffer."], fx: { w: -2 } },
            { l: '"Cancer research."', r: ["Respect gaffer. The keeper's cried. In a good way. I think."], fx: { w: 3, mor: 2 } }] } },
        { l: '"Your rating\'s slipping. Talk me through it."', r: { w: ["My hamstring's 'tight'. My missus says it's 'emotional'. Physio says it's 'both'."], c: ["Talk YOU through it? You picked me at centre half and I'm a winger."] }, fx: { t: 2 } }] },
      malicious: { o: [
        { l: '"Remember who pays your wages."', q: 'remember who pays your wages', r: ["The club pays my wages gaffer.", "My agent says that's 'technically a threat'. He's screenshotted it. Sorry."], fx: { f: 5, w: -4 }, ev: 'threat',
          n: { o: [
            { l: '"I AM the club."', q: 'I AM the club', r: ["I'll tell the lads. They'll be thrilled. They've gone very quiet."], fx: { f: 4, mor: -2 } },
            { l: '"Only joking. Love you."', r: ["Mixed messages gaffer. Very mixed. Like your team talks."], fx: { w: 3, f: -2 } }] } },
        { l: '"Your wife\'s got my number, you know."', if: () => (S.contacts.captain_wife && S.contacts.captain_wife.flirt_level >= 3), q: "your wife's got my number", ev: 'threat', r: ["What does that mean gaffer", "Gaffer why would my wife have your number"], fx: { f: 8, w: -10, quit: 10, susp: 2 } }] },
      flirtatious: { o: [
        { l: '"Saw you in the ice bath. Respect."', q: 'saw you in the ice bath', r: ["Thanks gaffer. Bit weird that you were in there with me though."], fx: { f: 3, w: -1 } },
        { l: '"It\'s a joke. Team bonding."', r: ["Ha. Course. Lads' banter. I'll tell the lads. Actually I won't."], fx: { w: 1 } }] },
      erotic: { o: [
        { l: '"Wrong number."', q: 'wrong number', r: ["Who was it meant for gaffer", "Wrong number. Right name though. My name. In the message."], fx: { f: 2 },
          n: { o: [
            { l: '"The manager."', r: ["Ok I'm not telling the manager that."], fx: { f: 2 } },
            { l: '"Your wife."', ev: 'threat', q: 'it was meant for your wife', r: ["I'm going to the lads.", "Right. I'm talking to my agent. And my dad. My dad's a bouncer."], fx: { quit: 15, w: -15, f: 6, mor: -4 } }] } },
        { l: '"Delete it. That\'s an order."', r: ["Already deleted. Already forwarded to my agent by accident. Sorry gaffer."], fx: { f: 4 }, ev: 'sext', shot: 0.3 }] }
    },
    captain_wife: {
      friendly: { o: [
        { l: '"How is he? Honestly."', r: { w: ["Honestly? He narrates his own highlights in the bath. In the third person."], c: ["He's fine. Why are you asking me and not him."] }, fx: { w: 3 },
          n: { o: [
            { l: '"You deserve better."', q: 'you deserve better', r: ["Everyone keeps telling me that. Mainly you. Only you, actually."], fx: { l: 4, flirt: 1, susp: 1 } },
            { l: '"Tell him I\'m proud of him."', r: ["I will. He'll frame it. He frames everything. He framed a parking ticket."], fx: { w: 3, mor: 1 } }] } }] },
      professional: { o: [
        { l: '"His contract\'s up. Let\'s discuss. Privately."', q: "let's discuss privately", r: { w: ["Privately. Like... dinner privately?"], c: ["Talk to his agent. Not me. Why me."] }, fx: { l: 3, susp: 1 },
          n: { o: [
            { l: '"Dinner. Bring the contract."', pr: 'cw_dinner', s: 'Dinner. Thursday. Bring the contract. Don\'t bring him.', r: ["I'll bring a pen. Just the pen 😘"], fx: { l: 5, flirt: 1, susp: 1 } },
            { l: '"No. Actually. Agents only."', r: ["Right. Course. Silly me. Silly everyone."], fx: { w: -2 } }] } }] },
      malicious: { o: [
        { l: '"He\'s benched unless you\'re nice to me."', q: 'benched unless', ev: 'threat', shot: 0.4, r: ["Are you blackmailing me with my own husband", "I've screenshotted that. I've screenshotted that twice."], fx: { f: 8, w: -10, quit: 8 } }] },
      flirtatious: { o: [
        { l: '"That photo on your Insta. Wow."', q: 'that photo on your Insta', r: { w: ["Which one 😏 I've posted 40 this week. He's in none of them."], c: ["You've been on my Insta? I'm private. How are you on my Insta."] }, fx: { l: 4, flirt: 1 },
          n: { o: [
            { l: '"Meet me. Car park. After the game."', pr: 'cw_carpark', q: 'car park after the game', r: ["Which car park. There are 6. I'll be in all of them 😘", "The one with the broken camera. You know the one."], fx: { l: 6, flirt: 1, susp: 2 }, ev: 'sext' },
            { l: '"Just being friendly."', r: ["Course you are. Course."], fx: { w: 1 } }] } }] },
      erotic: { o: [
        { l: '"Is he home?"', q: 'is he home', r: { w: ["Physio till 6. Then FIFA till 2. Then he cries till 3."], c: ["Yes. He's next to me. He's reading over my shoulder. Hi, says Hubby."] }, fx: { l: 4, susp: 1 },
          n: { o: [
            { l: '"Come to the directors\' box."', ev: 'sext', q: "come to the directors' box", r: ["You're insane. What time."], fx: { l: 6, flirt: 2, susp: 2 } },
            { l: '"Never mind. Wrong number."', r: ["You typed my name. My FULL name. With a heart."], fx: { w: -3 } }] } }] }
    },
    manager: {
      friendly: { o: [
        { l: '"You\'re doing great. Seriously."', r: { w: ["Boss... that means a lot. I've been sleeping at the training ground."], c: ["Is this the text you send before you sack someone? I've heard about this text."] }, fx: { w: 4, t: 2 },
          n: { o: [
            { l: '"You\'re safe. I promise."', pr: 'mgr_safe', q: "you're safe, I promise", r: ["Thank you boss. I'll tell the wife. She's started packing."], fx: { t: 6, mor: 2 } },
            { l: '"For now."', q: 'for now', r: ["'For now'. Right. Cool. I'll keep the car running."], fx: { f: 6, t: -4 } }] } }] },
      professional: { o: [
        { l: '"I want a back three. Or a back five. Your call. Mine actually."', q: 'a back three or a back five', r: ["So a back four.", "Boss with respect we've only got four defenders and one's a goalkeeper."], fx: { t: -1, f: 2 },
          n: { o: [
            { l: '"Play the goalkeeper upfront."', q: 'play the goalkeeper upfront', r: ["...I'll put it in the plan. Under 'ideas'. Under 'other'."], fx: { f: 3 } },
            { l: '"Trust your gut."', r: ["My gut says resign. Ignoring it. Thanks boss."], fx: { t: 3, w: 2 } }] } },
        { l: '"Who\'s the scout you hired? He keeps texting me."', r: ["That's not a scout boss. That's Marco's cousin. He's been 'scouting' the car park."], fx: { t: 1 } }] },
      malicious: { o: [
        { l: '"Lose Saturday and you\'re gone."', q: 'lose Saturday and you\'re gone', ev: 'threat', r: { w: ["Understood. Fully. I'll win. Or I'll lie about the score."], c: ["Fine. I'll tell the Echo you said that. They love a chairman quote."] }, fx: { f: 8, t: -4, mor: -2 },
          n: { o: [
            { l: '"Tell them. See what happens."', ev: 'threat', r: ["I'm not going to tell them boss. I'm just going to cry in the car again."], fx: { f: 5 } },
            { l: '"Joking. Mostly."', r: ["Ha. Ha ha. Ha."], fx: { f: -2, w: 1 } }] } }] },
      flirtatious: { o: [{ l: '"It\'s called man-management. Look it up."', q: "it's called man-management", r: ["I've looked it up boss. That's not what it is."], fx: { f: 2 } }] },
      erotic: { o: [{ l: '"That was for my wife. Forget it."', r: ["Forgotten. Burned. Phone's in the river. It's a club phone so you'll get the bill."], fx: { f: 3, club: -900 } },
        { l: '"Was it? Was it though?"', q: 'was it though', ev: 'sext', r: ["Boss I'm going to the board", "I'm forwarding this to the LMA. They have a hotline for this. It's just me on it."], fx: { f: 6, t: -8 } }] }
    },
    bookie_marco: {
      friendly: { o: [
        { l: '"How\'s your mum?"', r: { w: ["shes great. she asks about u. she says ur 'a good boy with a bad nose'"], c: ["why u asking about my mum"] }, fx: { w: 3 },
          n: { o: [{ l: '"Tell her I said hi."', q: 'tell your mum I said hi', r: ["she says hi back. she says pay marco"], fx: { w: 2 } }] } },
        { l: '"Any tips for Saturday?"', r: ["yeah. dont bet on urself. trust me"], fx: { t: 1 } }] },
      professional: { o: [
        { l: '"What\'s the line on us?"', r: ["11-4. 9-4 if u stop texting me about it. evens if u play the keeper upfront again"], fx: { t: 2 },
          n: { o: [
            { l: '"£50k on us. On tick."', go: async () => { ensureSystemsState(); S.drugs.debt = (S.drugs.debt | 0) + 50000; }, q: '£50k on us on tick', r: ["done. bold. stupid. bold"], fx: { t: 2 } },
            { l: '"£50k AGAINST us."', ev: 'threat', q: '£50k against us', go: async () => { S.police_risk = (S.police_risk | 0) + 4; addEvidence({ kind: 'bribe', label: 'Bet £50K against your own club through Marco', weight: 14, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['corruption'] }); }, r: ["love it. dont tell anyone. i will tell everyone", "thats illegal mate. done. obviously"], fx: { t: 4 } }] } }] },
      malicious: { o: [
        { l: '"Do you know who I am?"', q: 'do you know who I am', r: () => `yeah. the bloke who owes me ${N().debt}`, fx: { f: 1 },
          n: { o: [
            { l: '"Friday. Cash."', pr: 'marco_friday', q: 'Friday. Cash.', r: ["friday. cash. if its saturday its not cash its teeth"], fx: { t: 2 } },
            { l: '"I\'ll have you deported."', ev: 'threat', q: "I'll have you deported", r: ["deported where. im from fareham", "lol. my cousin is ur stadium steward. think about that next time u take a wee"], fx: { f: -2, w: -6, debt: 5000 } }] } }] },
      flirtatious: { o: [{ l: '"You\'re my favourite person right now."', if: () => K.isHigh && K.isHigh(), ev: 'high', q: "you're my favourite person", r: ["ur high. i can tell from the punctuation. there isnt any"], fx: { w: 2 } }] },
      erotic: { o: [{ l: '"That wasn\'t meant for you."', r: ["i know. it was meant for ur secretary. i know everything. its on the tab"], fx: { debt: 2000 }, ev: 'sext', shot: 0.5 }] }
    },
    delmor_krunchem: {
      malicious: { o: [
        { l: '"Enjoy the relegation, you sweaty little toad."', q: 'sweaty little toad', r: ["I'm not sweaty. I'm glistening. Your wife says I glisten.", "Toad? I own three toads. They're called Southampton, Southampton and Southampton."], fx: { f: 1 },
          n: { o: [
            { l: '"See you at Fratton. Bring a helmet."', ev: 'threat', q: 'bring a helmet', r: ["Screenshotted, sent to Hampshire Police, framed. Lovely.", "Is that a threat? Lovely. My lawyer's on the toilet but he'll love it."], fx: { pol: 2 } },
            { l: '"Actually, how\'s the hip?"', r: ["...it's fine. Why are you asking. Who told you about the hip."], fx: { w: 2 } }] } }] }
    },
    womens_manager: {
      friendly: { o: [{ l: '"Genuinely: well done."', r: ["Thank you. Genuinely: the men could learn a lot. Genuinely."], fx: { w: 3 } }] },
      malicious: { o: [{ l: '"You lot cost me £200k a match."', q: 'you cost me £200k a match', r: ["Interesting how cost only comes up when it's us 💅", "And the men cost you a lot more. In dignity, mainly."], fx: { w: -3 } }] }
    },
    secretary: {
      professional: { o: [
        { l: '"Can you move my 3pm?"', r: { w: ["Done. Where to? Your 3pm is a man in a van who says you 'know what it's about'."], c: ["Moved. Like you moved my desk next to the toilets."] }, fx: { t: 2 },
          n: { o: [
            { l: '"Tell him I\'ve died."', q: "tell him I've died", r: ["Done. He's sent flowers. And an invoice."], fx: { t: 1 } },
            { l: '"Send him in. Lock the door."', ev: 'threat', r: ["I've locked the door. I'm on the other side of it. Good luck."], fx: { secR: 2 } }] } }] },
      social: { o: [
        { l: '"How was your weekend?"', r: { w: ["Lovely actually. Took my nan to Paultons Park. She went on Peppa Pig World. She's 90."], c: ["It was a weekend."] }, fx: { w: 2 },
          n: { o: [{ l: '"Your nan sounds great."', q: 'your nan sounds great', r: ["She is. She thinks you're 'a wrong 'un'. She's not wrong usually."], fx: { w: 2, t: 1 } }] } }] },
      football: { o: [
        { l: '"What did you make of the second half?"', r: { w: ["Honestly I watched the Pompey score on my phone. Don't tell anyone."], c: ["I was doing the expenses. Your expenses. All of them."] }, fx: { t: 1 } }] },
      ellipses: { o: [{ l: '"..."', q: '...', r: ["...?", "Are you ok? Blink twice. Text twice. Anything."], fx: { f: 1 } }] },
      flirtatious: { o: [
        { l: '"Only joking. Unless?"', q: 'unless?', r: { w: ["Unless what 😊"], c: ["Not unless. Definitely not unless."] }, fx: { secR: 1 },
          n: { o: [
            { l: '"Unless nothing. Forget it."', r: ["Forgotten. Backed up. But forgotten."], fx: { t: 1 } },
            { l: '"Drinks. Friday. Somewhere with no cameras."', pr: 'sec_drinks', q: 'drinks somewhere with no cameras', r: { w: ["There's nowhere in Southampton with no cameras. You've put them all up. ...ok. One drink."], c: ["I'm busy Friday. And every Friday. Forever."] }, fx: { secR: 3, w: 2 } }] } }] },
      erotic: { o: [
        { l: '"Delete that. Please."', r: { w: ["Deleted 😘 Kept a copy for 'training purposes'."], c: ["Deleted from my phone. Not from the server. Not from my memory."] }, fx: { secR: 2 } },
        { l: '"You\'ll keep this between us?"', q: 'keep this between us', r: { w: ["Between us. And iCloud. And my sister, but she's discreet."], c: ["Between us and HR, yes."] }, fx: { secR: 3 } }] }
    }
  };

  // ---------- incoming threads ----------
  const hasDebt = () => !!(S.drugs && (S.drugs.debt | 0) > 0);
  const THREADS = {}; const INCOMING = [];
  const thread = (who, id, text, node, extra) => { const th = Object.assign({ who, id, text, node }, extra || {}); THREADS[id] = th; INCOMING.push(th); return th; };
  // captain
  thread('captain', 'cap_bonus', "Lads want to know about the win bonus before kickoff. They're asking me. I'm asking you. Please don't say 'vibes'.", { o: [
    { l: '"Double it."', r: ["GAFFER. The lads are chanting your name. One of them's got it wrong but they're chanting."], fx: { w: 6, mor: 5, club: -60000 } },
    { l: '"Vibes."', q: 'vibes', r: ["...I'll tell them vibes. I'll tell them in a voice that says I'm sorry."], fx: { w: -5, mor: -3 } },
    { l: '"Tell them I\'m proud of them."', r: { w: ["They'll love that. Can I tell them it's a cash amount?"], c: ["'Proud' isn't a number gaffer"] }, fx: { w: 2 }, n: { o: [{ l: '"Proud is a number."', q: 'proud is a number', r: ["Not in this economy gaffer"], fx: { mor: -1 } }] } }] },
    { deadline: true, expireLine: "Nobody answered {capF} about the bonus. The lads find out the way they find out everything: from Marco. (Morale −5)", expire: () => K.textFx('captain', { mor: -5, w: -6 }) });
  thread('captain', 'cap_bigoffice', "Gaffer. Why are you in my wife's phone as 'Big Office'?", { o: [
    { l: '"Autocorrect."', q: 'autocorrect', r: ["Autocorrect to 'Big Office' from what gaffer", "Autocorrect put a heart after it too did it"], fx: { f: 3, susp: 1 } },
    { l: '"Club business."', r: ["She's not in the club gaffer. She's in Zumba."], fx: { f: 2 } },
    { l: '"Because I am."', q: 'because I am', ev: 'threat', r: ["Right.", "I'm coming to the office.", "My dad's a bouncer, gaffer. Remember that."], fx: { f: 8, quit: 15, w: -12, mor: -3 }, go: async () => addEvidence({ kind: 'affair', label: `${N().cap} asked why you're in his wife's phone as 'Big Office'`, weight: 10, witness: 'captain', witnessLabel: N().cap, tags: ['sex'] }) }] },
    { when: () => S.contacts.captain_wife && (S.contacts.captain_wife.flirt_level | 0) >= 3, deadline: true, expireLine: "{capF} took your silence as a yes. He's 'not feeling it' for Saturday. (Captain quit risk +15, morale −4)", expire: () => K.textFx('captain', { quit: 15, mor: -4, w: -10 }) });
  thread('captain', 'cap_4am', "Gaffer are you ok. You rang me 6 times and just breathed. Then you said 'the ball knows'.", { o: [
    { l: '"The ball DOES know."', q: 'the ball knows', ev: 'high', r: ["Ok gaffer. I'm telling the doctor. Not the club doctor. A real doctor."], fx: { mor: -2, f: 2 } },
    { l: '"Butt-dial. Six times."', r: ["Your butt said my name gaffer. Clearly."], fx: { w: 1 } }] }, { when: () => (S.drugs && (S.drugs.addiction | 0) >= 15) });
  // captain's wife
  thread('captain_wife', 'cw_delete', "He's been asking about my phone. Delete everything by Saturday or I'm showing him and saying you started it. You did start it.", { o: [
    { l: '"Deleted."', r: ["Thank you. God. I nearly told him at Nando's."], fx: { susp: -2, w: 2 } },
    { l: '"Show him. I\'m the chairman."', ev: 'threat', q: "I'm the chairman", r: ["You're a chairman. He's 6'4. Think about it."], fx: { f: 6, susp: 2 } },
    { l: '"Run away with me."', q: 'run away with me', r: ["To where? Eastleigh?", "Don't. Don't say things like that. Say it again."], fx: { l: 8, flirt: 1, susp: 1 }, ev: 'sext' }] },
    { when: () => (S.contacts.captain_wife.flirt_level | 0) >= 4, deadline: true,
      expireLine: "{capwife} showed him the messages and said you started it. You did start it. (Morale −10, captain quit risk +20)",
      expire: () => { K.textFx('captain', { mor: -10, quit: 20, w: -20 }); addEvidence({ kind: 'affair', label: `${N().capwife} showed her husband your texts`, weight: 18, witness: 'captain_wife', witnessLabel: N().capwife, tags: ['sex'], forceLeak: true }); } });
  thread('captain_wife', 'cw_highlights', "He's watching his own highlights again. With commentary. HIS commentary. 'And the big lad rises.' I'm going to scream.", { o: [
    { l: '"Come and scream at the training ground."', q: 'scream at the training ground', r: ["Is that a joke or an invitation", "Don't tempt me {Chair} 😏"], fx: { l: 5, flirt: 1, susp: 1 } },
    { l: '"He\'s a great player."', r: ["Not you as well."], fx: { w: -2 } }] });
  // manager
  thread('manager', 'mgr_board', "Hearing the board want me out. Am I being sacked? Yes or no before kickoff. I need to know whether to bother with the team talk.", { o: [
    { l: '"You\'re safe."', pr: 'mgr_safe', q: "you're safe", r: ["Thank you boss. Genuinely. I'll give the best team talk of my life. I'll do the voices."], fx: { t: 6, mor: 3 } },
    { l: '"Depends on Saturday."', q: 'depends on Saturday', r: ["Right. So yes then."], fx: { f: 6, t: -4 } },
    { l: '"Who told you that?"', r: ["Marco.", "Your secretary. And Marco. And the man who does the pies."], fx: { t: 1 }, n: { o: [{ l: '"Ignore the pie man."', q: 'ignore the pie man', r: ["Never boss. He's never been wrong. He called Brexit."], fx: { t: 2 } }] } }] },
    { deadline: true, expireLine: "The manager never heard back. He gives the team talk in a hi-vis jacket 'in case he has to leave quickly'. (Morale −4)", expire: () => K.textFx('manager', { mor: -4, t: -8 }) });
  thread('manager', 'mgr_352', "Thinking of going 3-5-2. Thoughts? Please have none.", { o: [
    { l: '"Go 2-2-6."', q: 'go 2-2-6', r: ["Noted. Ignored. Respectfully."], fx: { t: -2 } },
    { l: '"You\'re the expert."', r: ["Thank you. Nobody's ever said that. My wife definitely hasn't."], fx: { t: 4, w: 3 } }] });
  // Marco
  thread('bookie_marco', 'marco_owe', () => `u got til kickoff for the tab (${N().debt}) + the "favour" at the turnstiles. or my cousin has a chat with the echo. he loves a chat`, { o: [
    { l: '"Friday. Cash."', pr: 'marco_friday', q: 'Friday. Cash.', go: async () => { if (K.payMarco && S.drugs.debt > 0) { const half = Math.round(S.drugs.debt / 2); if (K.pay(half)) S.drugs.debt -= half; } }, r: ["half now is good. half later is teeth. jk. not jk"], fx: { t: 4, w: 2 } },
    { l: '"Do you know who I am?"', q: 'do you know who I am', r: () => `yeah. the bloke who owes me ${N().debt}`, fx: { w: -2 } },
    { l: '"Put it on the tab."', q: 'put it on the tab', r: ["the tab is on the tab mate. thats +10%"], fx: { debt: 0 }, go: async () => { S.drugs.debt = Math.round((S.drugs.debt | 0) * 1.1); } }] },
    { when: hasDebt, deadline: true, expireLine: "Marco's cousin has a chat with the Echo. He loves a chat.", expire: () => addEvidence({ kind: 'coke', label: "Marco's cousin told the Echo about your tab", weight: 14, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['drugs'], forceLeak: true }) });
  thread('bookie_marco', 'marco_mum', "my cousin says ur left wing back has a very nice mum. just saying", { o: [
    { l: '"Leave his mum out of it."', r: ["out of what. i havent said anything. yet"], fx: { t: 1 } },
    { l: '"How nice?"', q: 'how nice', ev: 'sext', r: ["very. she does pilates. she does it at the training ground. ur training ground. at night"], fx: { l: 2 } }] });
  thread('bookie_marco', 'marco_linesman', "got a bloke selling a slightly used linesman. one careful owner. interested?", { o: [
    { l: '"How much?"', r: ["40k. he does offsides, throw-ins and he'll cry if u ask"], n: { o: [
      { l: '"Done. On tick."', q: 'buy the linesman', go: async () => { S.drugs.debt = (S.drugs.debt | 0) + 40000; K.addFavour('A linesman', 'owed_to_me', "Marco's 'slightly used' linesman", { label: 'A linesman (via Marco)', kind: 'referee' }); addEvidence({ kind: 'bribe', label: "Bought a 'slightly used' linesman through Marco", weight: 10, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['corruption'] }); }, r: ["pleasure. hes called keith. dont make eye contact with keith"], fx: { t: 3 } },
      { l: '"Too much."', r: ["ur loss. pompey are interested. delmor wants him for xmas"], fx: {} }] } },
    { l: '"No."', r: ["k. hes going to delmor then. enjoy ur offsides"], fx: { w: -1 } }] });
  // secretary
  thread('secretary', 'sec_hr', "HR would like a 'clarifying statement' about some of your messages by Friday. I've drafted one. It says 'I was hacked by a Pompey fan'. Sign?", { o: [
    { l: '"Sign it."', r: ["Signed. Also signed your name on 40 other things while I was there. Don't worry about it."], fx: { t: 3, secR: -3 } },
    { l: '"What messages?"', q: 'what messages', r: ["The ones I've printed out. And laminated. And put in a ring binder labelled 'what messages'."], fx: { t: -5 } },
    { l: '"Tell HR to come and see me."', ev: 'threat', r: ["HR is a woman called Pam. Pam has a lawyer. Pam's lawyer has a lawyer."], fx: { secR: 6, f: 4 } }] },
    { when: () => (S.secRisk | 0) >= 25 || (S.secMessageCounts && (S.secMessageCounts.erotic | 0) > 0), deadline: true,
      expireLine: "Nobody signed the HR statement. Pam from HR has printed your texts. Pam's lawyer has started a folder.",
      expire: () => { S.secRisk = clamp((S.secRisk || 0) + 10, 0, 100); addEvidence({ kind: 'sext', label: "HR's folder of your texts to your secretary", weight: 14, witness: 'secretary', witnessLabel: N().sec, tags: ['sex'], forceLeak: true }); } });
  thread('secretary', 'sec_nan', "Can I leave early Friday? My nan's 90.", { o: [
    { l: '"Of course. Give her my best."', r: ["Thank you!! She says you're 'still a wrong 'un but a kind one'."], fx: { t: 4, w: 3 } },
    { l: '"No."', r: ["Noted. I'll tell her. She's taken it badly. She's put a curse on the left back."], fx: { t: -4, w: -3 } },
    { l: '"Is she single?"', q: 'is your nan single', r: ["She's single. You're not. Neither of you is invited to anything ever again."], fx: { t: -6, secR: 2 } }] }, { when: () => S.secretary_hired });
  // wife (seasons 1–3)
  thread('wife', 'wife_recital', "You coming to {daughter}'s recital or is it a \"board meeting\" again", { o: [
    { l: '"Board meeting. Very serious. Lots of graphs."', q: 'lots of graphs', r: ["The board meeting is at the Harvester. Your card just pinged there. Twice."], fx: { t: -3 }, n: { o: [
      { l: '"Those are tactical prawns."', q: 'tactical prawns', r: ["Tactical. Prawns.", "I'm telling your mother you said 'tactical prawns'."], fx: { w: -4, love: -3 } },
      { l: '"I\'ll be there, I promise."', pr: 'wife_recital', q: "I'll be there, I promise", r: ["You'd better. She's doing a solo. On the recorder. It's your song. Well. It's Mr Blobby."], fx: { w: 4 } }] } },
    { l: '"Front row. Wouldn\'t miss it."', pr: 'wife_recital', q: "front row, wouldn't miss it", r: ["Who are you and what have you done with my husband"], fx: { w: 5, love: 3 } },
    { l: '"What recital?"', r: ["I'm going to scream into a cushion and then I'm going to ring your mother."], fx: { w: -6, love: -5, mar: 3 } }] },
    { when: () => K.married(), deadline: true, expireLine: "You never answered {wifeF} about the recital. {daughter} played Mr Blobby to an empty chair with your name on it. (Wife −8)", expire: () => K.textFx('wife', { w: -8, love: -8, mar: 6 }) });
  thread('wife', 'wife_marco', "Why is there a £400 charge from 'MARCO LTD (NOT DRUGS)' on the joint account", { o: [
    { l: '"Golf lessons."', q: 'golf lessons', r: ["You don't play golf.", "Show me your golf swing then. Tonight. In the garden. In front of the neighbours."], fx: { t: -4 } },
    { l: '"Marco is a club supplier. Of… kit."', q: 'Marco supplies kit', r: ["Then why is the reference 'NOSE STUFF X'"], fx: { t: -6, mar: 3 }, n: { o: [
      { l: '"Nasal spray. Bulk. For the lads."', q: 'nasal spray for the lads', r: ["Right. Nasal spray. For 400 quid. I'm ringing the club doctor."], fx: { t: -3, love: -2 } },
      { l: '"Fine. It\'s drugs. Happy?"', ev: 'high', go: async () => addEvidence({ kind: 'coke', label: `Admitted the coke to ${N().wifeF} in writing`, weight: 10, witness: 'wife', witnessLabel: N().wifeF, tags: ['drugs'] }), r: ["No. No, I'm not happy. Your son is reading over my shoulder."], fx: { w: -10, love: -10, mar: 10 } }] } }] },
    { when: () => K.married() && hasDebt() });
  thread('wife', 'wife_mum', "Your mother rang. She wants to know why you were 'on the telly crying'.", { o: [
    { l: '"Hay fever."', q: 'hay fever', r: ["In November.", "She says you've never had hay fever. She'd know. She was there when you were born. Unfortunately."], fx: { t: -2 } },
    { l: '"Tell her I love her."', r: ["She says 'that's what your father used to say before he went to Spain'."], fx: { w: 2 } }] }, { when: () => K.married() });
  thread('wife', 'wife_sec', "Who is {sec} and why does she sign off 'xx'", { o: [
    { l: '"She\'s my secretary. Everyone gets xx."', q: 'everyone gets xx', r: ["Does the kit man get xx? Does MARCO get xx?"], fx: { t: -4, mar: 3 } },
    { l: '"Typo."', q: 'typo', r: ["Two x's. Every time. That's not a typo, that's a policy."], fx: { t: -6, mar: 5 } },
    { l: '"I\'ll tell her to stop."', r: ["Thank you. Tell her I said xx. Tell her it's a threat."], fx: { w: 3, t: 2 } }] },
    { when: () => K.married() && S.secretary_hired && ((S.secRel | 0) >= 35 || (S.secMessageCounts && (S.secMessageCounts.flirtatious | 0) > 0)), deadline: true,
      expireLine: "{wifeF} took your silence about {sec} as an answer. (Marital risk +10)", expire: () => K.textFx('wife', { mar: 10, love: -6, w: -8 }) });
  thread('wife', 'wife_dog', "The dog's eaten something out of your blazer and now it's running laps of the garden at 40mph. What was in your blazer.", { o: [
    { l: '"Sherbet."', q: 'it was sherbet', r: ["The vet says it wasn't sherbet."], fx: { t: -5, mar: 4 }, go: async () => addEvidence({ kind: 'side_effect', label: 'The dog ate a bag out of your blazer (the vet knows)', weight: 10, witness: 'wife', witnessLabel: N().wifeF, tags: ['drugs'] }) },
    { l: '"Mints. Very strong mints."', q: 'very strong mints', r: ["He's been barking at the moon for an hour. It's 11am."], fx: { t: -3 } }] }, { when: () => K.married() && S.drugs && (S.drugs.tolerance | 0) > 0 });
  // Delmor dirt via the ex-wife (season 4+): answered = the dirt is yours
  const EX_DIRT = [
    { text: "Delmor's asleep. He talks in his sleep. Tonight it was 'the Cayman money', 'the ballboys' and 'mother'. Want the rest?", label: "Delmor talks in his sleep about 'the Cayman money'", hl: "POMPEY CHIEF'S SLEEP-TALK SHAME: 'THE CAYMAN MONEY'" },
    { text: "Found his second phone in the airing cupboard. It's full of texts to a referee called 'Big Kev'. Interested?", label: "Delmor's second phone: texts to a referee called 'Big Kev'", hl: 'DELMOR AND "BIG KEV": THE TEXTS' },
    { text: "He's had the Pompey physio do his bunions. On the club. Invoiced as 'striker rehab'. I've got the invoice.", label: "Delmor's bunions, invoiced to Pompey as 'striker rehab'", hl: 'KRUNCHEM\'S £80K BUNION SCANDAL' },
    { text: "The Fratton Park 'sell-out' last month? He bused in a care home. They thought it was a day trip to the seaside. I've got the coach booking.", label: 'Delmor bused in a care home to fake a Fratton sell-out', hl: 'POMPEY SELL-OUT WAS CARE HOME DAY TRIP' },
    { text: "He's got a tanning bed in the boardroom. It's plugged into the floodlights. Southern Electric would love a photo.", label: 'Delmor runs a tanning bed off the Fratton floodlights', hl: "DELMOR'S FLOODLIGHT TAN SCAM" },
    { text: "He keeps a list called 'Refs Who Owe Me'. It's on the fridge. Under a Pompey magnet. I could photograph it. Or not.", label: "Delmor's fridge list: 'Refs Who Owe Me'", hl: "REVEALED: DELMOR'S 'REFS WHO OWE ME' LIST" },
    { text: "He cried at Mamma Mia 2 and made his driver swear on his kids not to tell. His driver hasn't got kids. I've got the video.", label: 'Video: Delmor sobbing at Mamma Mia 2', hl: 'HARD MAN DELMOR WEEPS AT ABBA' }
  ];
  THREADS.ex_dirt = { who: 'ex_wife', id: 'ex_dirt', node: { o: [
    { l: '"Why are you telling me this?"', r: ["Because he took the big side of the bed. And because I'm bored. Here.", "Because you're pathetic but he's worse. Don't make me say it twice."], go: async () => K.exDirt(14) },
    { l: '"Send me proof."', q: 'send me proof', r: ["Sent. Delete this chat. Actually don't, it's funnier if he finds it.", "Sent. You owe me. You've always owed me. Now it's in writing."], go: async () => K.exDirt(20), fx: { w: 2 } },
    { l: '"Come home."', q: 'come home', r: ["No. But here's your dirt anyway. Don't text me after 9.", "Home? You sold the house to buy a striker. Here. Have this instead."], go: async () => K.exDirt(12), fx: { lone: 1 } }] } };
  K.exDirt = function (w) {
    const c = S.contacts.ex_wife; const e = c && (c.queued_texts || []).slice().reverse().find(x => x.thread === 'ex_dirt' && x.dirt);
    const d = (e && e.dirt) || THREADS.ex_dirt.cur || EX_DIRT[0];
    if (e) e.dirt = null;
    const item = K.addDirt('delmor', d.label, w || 15, 'Delmor');
    item.headline = d.hl; item.from = 'ex_wife';
    try { logSafe(`🗂️ ${K.esc(N().wifeF)} gives you something on Delmor: <i>${K.esc(d.label)}</i>. Use it to bury a story (Dossier / the lead).`); KUI && KUI.toast(`🗂️ Dirt on Delmor: ${d.label}`, 'good', 4500); } catch (_) {}
    return item;
  };
  const EX_TAUNTS = [
    "Delmor's taken me to Nando's. He ordered for me. He ordered extra hot. He's a real man {Chair}.",
    "Just so you know, Delmor reads the Echo out loud every morning. He does your voice. It's very high.",
    "{daughter} likes Delmor. She says he's 'less embarrassing'. He wore a cape to parents' evening.",
    "Delmor's bought me a dog. A real one. With papers. Not a bag of 'sherbet' in a glovebox.",
    "Fratton Park has a sauna now. Delmor named it after me. It's called '{wifeF}'s Revenge'.",
    "We watched your game. Delmor paused it every time you were on screen so I could 'really take it in'.",
    "Delmor says you're 'a lovely lad'. Then he laughed for 4 minutes. He's never laughed for 4 minutes before.",
    "He calls me 'the transfer of the century'. You called me 'mate' on our anniversary.",
    "Your mother rang. Here. She asked Delmor for tips.",
    "I found your old love letters. Delmor marked them out of ten. Then he marked YOU out of ten. It was one.",
    "Delmor's put your photo on the Pompey dartboard. It's the bullseye. He never hits it. He says that's 'the joke'.",
    "He brought me breakfast in bed. A full English. He'd shaped the beans like your face, frowning.",
    "Delmor sends his regards. And a voice note. Don't play the voice note. Or do. It's 20 minutes of him gargling.",
    "I'm at the Pompey end. They've given me your old seat number. Delmor bought it at auction. It was £4.",
    "Delmor's hand is bigger than yours. I measured. With your old tape measure. The one from the garage."
  ];
  K.EX_TAUNTS = EX_TAUNTS; K.EX_DIRT = EX_DIRT; K.THREADS = THREADS; K.FOLLOW = FOLLOW;

  // ---------- the wife / ex-wife chats ----------
  K.chatContacts.wife = {
    status: 'Wife',
    tones: { friendly: 'Love you x', professional: 'Running late. Board.', malicious: "Where's the remote. Don't lie.", flirtatious: 'Wear the thing tonight 😉', erotic: 'Bedroom. Now. 🔥' },
    reply: cat => pickReply('wife', ({
      friendly: { w: ["Love you too. Bring milk.", "x. Also bring milk. Also explain the Harvester."], c: ["What have you done", "What do you want", "You only say that when the club's lost"] },
      professional: { w: ["Ok. Your dinner's in the oven. And by 'the oven' I mean 'the bin'."], c: ["The board doesn't meet at 11pm in a Wetherspoons.", "Running late from WHAT"] },
      malicious: { w: ["It's in the freezer. Like your heart."], c: ["Don't speak to me like I'm the referee.", "The remote is where you left your dignity. Nobody knows."] },
      flirtatious: { w: ["Which thing 😏", "Behave. The kids are here. In about an hour they won't be 😉"], c: ["The thing's in a bin bag. Like your clothes, soon."] },
      erotic: { w: ["Oh. OH. Ok. Give me ten minutes. And shave."], c: ["You've got cocaine on your top lip in your profile picture.", "I'm watching Bake Off. Wait."] }
    })[cat], 'wife_q_' + cat),
    fx: { malicious: { mar: 3, love: -3 }, friendly: { love: 2 }, erotic: { love: 1 } },
    follow: {
      friendly: { o: [
        { l: '"Date night Saturday? After the game."', pr: 'wife_date', q: 'date night Saturday', r: { w: ["Ok. Somewhere nice. NOT the Harvester. NOT the directors' box."], c: ["You said that last month. I sat in a Frankie & Benny's for two hours."] }, fx: { w: 4, love: 2 } },
        { l: '"Sorry about everything."', q: 'sorry about everything', r: { w: ["Which bit? Be specific. I've got a list."], c: ["'Everything' isn't an apology. It's a weather report."] }, fx: { w: 2 },
          n: { o: [
            { l: '"The Harvester."', r: ["Good start. Keep going."], fx: { w: 1 } },
            { l: '"The secretary."', ev: 'high', r: ["What about the secretary."], fx: { t: -8, mar: 6 }, if: () => !!S.secretary_hired }] } }] },
      malicious: { o: [
        { l: '"You\'re not the boss of me."', q: "you're not the boss of me", r: ["No. The bank is. And the bank rang. Twice."], fx: { mar: 3 } }] },
      erotic: { o: [{ l: '"Send one back 😏"', ev: 'sext', q: 'send one back', r: { w: ["Absolutely not. Ok. Maybe. No."], c: ["I've sent you a picture of the gas bill."] }, fx: { l: 3 } }] }
    }
  };
  K.chatContacts.ex_wife = {
    status: "Ex-wife (at Delmor's)",
    tones: { friendly: 'How are you doing?', professional: "Need the kids' passports back.", malicious: 'Enjoy Portsmouth. Enjoy the smell.', flirtatious: 'Miss you.', erotic: 'Remember the caravan? 🔥' },
    reply: cat => fill(P('ex_q_' + cat, ({
      friendly: ["Better than you. Delmor's put a jacuzzi in the en-suite. He calls it 'the Solent'.", "Fine. Happy. Moderately happy. Happier than the Harvester years."],
      professional: ["Delmor's laminated them. They're on the fridge next to the 'Refs Who Owe Me' list. Oops.", "Talk to my lawyer. He's also Delmor's lawyer. And Delmor's brother."],
      malicious: ["It smells of money here. You wouldn't recognise it.", "Delmor says thank you for the review. He's printing it on a scarf."],
      flirtatious: ["I know. Delmor read it out. He did a voice.", "You miss having someone to blame for the cocaine."],
      erotic: ["The caravan was in Bognor. It rained. You cried. Delmor's got a yacht.", "Delmor read that over my shoulder. He's taken it as a challenge. Thanks for that."]
    })[cat] || EX_TAUNTS)),
    fx: { flirtatious: { lone: 1 }, erotic: { lone: 1 } },
    follow: {
      malicious: { o: [{ l: '"He\'s using you to get to me."', q: "he's using you to get to me", r: ["Everyone's using everyone. You used me to look normal at Christmas."], fx: { w: -2 } }] },
      flirtatious: { o: [{ l: '"Come back. Please."', q: 'come back, please', r: ["No. But here's something. Delmor hides his 'travel money' in a hollow Pompey trophy. You didn't hear it from me."], go: async () => { if (!S.sys.exPleaDirt) { S.sys.exPleaDirt = 1; K.exDirt(10).label += ' (the hollow trophy)'; } }, fx: { lone: 2 } }] }
    }
  };
})();
