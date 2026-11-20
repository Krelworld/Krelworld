/* ===== KPacing: pacing helpers (no-repeat bags, cooldowns, beat scheduler, remembered choices) =====
   KPacing.bag(id, pool)        next line from `pool`, shuffled without replacement per id; the order is
                                persisted in S._bags so a save/reload keeps going through the same deck.
                                A reshuffle never starts with the line that ended the previous deck.
                                Pools that grow (new lines added later) reshuffle on the next draw.
   KPacing.cool(id, n)          true when flavour beat `id` has not fired in the last n matches (and arms
                                it); KPacing.ready(id, n) checks without arming.
   KPacing.matchIndex()         absolute match counter across seasons (season*100 + matches_played)
   KPacing.beat(id, {last})     one-major-story-beat-per-match scheduler: true (and claims the match) if
                                no other major beat has fired this match, or if this match is the beat's
                                last chance (`last` = final matches_played of its window), so deferring
                                never breaks a window. A beat that is refused should try again next match.
   KPacing.claim(id)            record that a major beat fired this match (for beats that can't defer)
   KPacing.busy()               true if a major beat already fired this match (flavour should stay quiet)
   KPacing.drinkPref()          remembered matchday pint: 'ask' | 'sober' | 'drink'; setDrink(), toggleDrink()
   KPacing.takeKickoff()        kickoff mode picked in the pre-match menu ('sim' | 'skip'), consumed once
   KPacing.weekSummary()        one-line hint for the end-of-week Continue (next fixture, position, mood)
*/
(function () {
  const st = () => (typeof S !== 'undefined' && S) ? S : (window.S || null);
  function matchIndex() { const s = st(); return s ? ((s.season | 0) * 100 + (s.matches_played | 0)) : 0; }

  function shuffled(n, avoidFirst) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (n > 1 && a[a.length - 1] === avoidFirst) { const j = Math.floor(Math.random() * (n - 1)); [a[a.length - 1], a[j]] = [a[j], a[a.length - 1]]; }
    return a; // drawn from the end
  }
  function bag(id, pool) {
    if (!Array.isArray(pool) || !pool.length) return undefined;
    if (pool.length === 1) return pool[0];
    const s = st();
    if (!s) return pool[Math.floor(Math.random() * pool.length)];
    const bags = (s._bags && typeof s._bags === 'object') ? s._bags : (s._bags = {});
    let b = bags[id];
    if (!b || b.n !== pool.length || !Array.isArray(b.order) || !b.order.length) {
      b = bags[id] = { n: pool.length, order: shuffled(pool.length, b && b.last), last: b && b.last };
    }
    const i = b.order.pop();
    b.last = i;
    return pool[i];
  }

  function cools() { const s = st(); return s ? (s._cool || (s._cool = {})) : {}; }
  function ready(id, n) { const t = cools()[id]; return t == null || matchIndex() - t >= n || matchIndex() < t; }
  function cool(id, n) { if (!ready(id, n)) return false; cools()[id] = matchIndex(); return true; }

  function beats() { const s = st(); if (!s) return null; const k = matchIndex(); if (!s._beat || s._beat.k !== k) s._beat = { k, ids: [] }; return s._beat; }
  function busy() { const b = beats(); return !!(b && b.ids.length); }
  function claim(id) { const b = beats(); if (b && !b.ids.includes(id)) b.ids.push(id); }
  function beat(id, opts) {
    const s = st(); const b = beats(); if (!s || !b) return true;
    const last = opts && typeof opts.last === 'number' ? opts.last : Infinity;
    if (b.ids.length && !b.ids.includes(id) && (s.matches_played | 0) < last) {
      s._beat_deferred = (s._beat_deferred | 0) + 1;
      return false;
    }
    claim(id);
    return true;
  }

  function settings() { const s = st(); if (!s) return {}; return (s.settings && typeof s.settings === 'object') ? s.settings : (s.settings = {}); }
  function drinkPref() { const v = settings().matchday_drink; return v === 'drink' || v === 'sober' ? v : 'ask'; }
  function setDrink(v) { settings().matchday_drink = v === 'drink' ? 'drink' : 'sober'; try { log(`(Matchday habit saved: ${v === 'drink' ? 'a pint before kickoff' : 'stone-cold sober'}. Switch it any week from the pre-match menu.)`); } catch (_) {} }
  function toggleDrink() {
    const now = drinkPref() === 'drink' ? 'sober' : 'drink';
    settings().matchday_drink = now;
    try { log(now === 'drink' ? '🍺 From now on you have a pint before every kickoff.' : '🥤 From now on you watch matches stone-cold sober.'); } catch (_) {}
  }
  function takeKickoff() { const s = st(); if (!s) return null; const k = s._kickoffMode; s._kickoffMode = null; return k === 'sim' || k === 'skip' ? k : null; }

  function weekSummary() {
    const s = st(); if (!s) return '';
    try {
      const parts = [];
      const next = Array.isArray(s.opponents) ? s.opponents[s.matches_played | 0] : null;
      if (next && (s.matches_played | 0) < (s.season_matches | 0)) parts.push(`Next: ${next} (game ${(s.matches_played | 0) + 1}/${s.season_matches})`);
      else parts.push('Season finale ahead');
      if (typeof getCurrentLeaguePosition === 'function') { const p = getCurrentLeaguePosition(); if (p && p < 99) parts.push(`${p}${['th','st','nd','rd'][(p % 100 - 20) % 10] || ['th','st','nd','rd'][p % 100] || 'th'} in the table`); }
      if (typeof s.fan_morale === 'number') parts.push(`fans ${s.fan_morale >= 65 ? 'buzzing' : s.fan_morale >= 40 ? 'restless' : 'mutinous'}`);
      return parts.join(' · ');
    } catch (_) { return ''; }
  }

  window.KPacing = { bag, pick: bag, cool, ready, matchIndex, beat, claim, busy, drinkPref, setDrink, toggleDrink, takeKickoff, weekSummary };
})();
