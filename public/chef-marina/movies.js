// Chef Marina — movie night with Nunu: a shelf of five little films to watch together on the basement TV (the fifth, the quest, is Nunu's favourite).
// Self-contained; load after everything else.
//   Movies.open({ onDone(result), onEvent(kind, movieId) })   full-screen inside #panel: the poster shelf first, then the film
//       onEvent kinds: 'start', 'funny', 'scary', 'sweet', 'end'  (so the caller can make Nunu laugh, jump or say "aww"),
//       and 'popcorn' now and then while she munches
//   Movies.close()      same as the ❌: every sound stops, the panel is emptied, setMusic(), then onDone
//   Movies.list()       [{ id, ico, mood, clips, shots, secs, seen, stars }]
// A film is a small data object (see FILMS): shots made of one picture each, a camera move, actors (sprites moved by
// keyframes), effects, timed events, narration clips and music cues. Pictures live in assets/movies/<film>.png, their
// rectangles and the clip lengths in assets/movies/movies.json, narration in assets/vo/mv_<film>_<n>.mp3.
// No words or digits anywhere: she cannot read. Everything on screen is a picture.
(function () {
  'use strict';
  if (window.Movies) return;               // already loaded (a test may add the file twice)
  const FW = 256, FH = 144, K = 3, BAR = 9, DIR = 'assets/movies/', KEY = 'cm_movies', TAU = Math.PI * 2;
  const LOGO = 3.7, ENDLEN = 4.6, TVW = 266, TVH = 154, BEZ = 5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, rnd = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
  const EASE = { lin: u => u, smooth: u => u * u * (3 - 2 * u), in: u => u * u, out: u => 1 - (1 - u) * (1 - u),
    back: u => { u -= 1; return u * u * (2.7 * u + 1.7) + 1; }, step: u => (u < 1 ? 0 : 1) };
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  // a value that changes through a shot: a plain number, or [[time, value, ease?], ...]
  function kv(k, t, def) {
    if (k == null) return def; if (typeof k === 'number') return k; if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t < k[i][0]) { const a = k[i - 1], b = k[i]; return lerp(a[1], b[1], EASE[b[2] || 'smooth']((t - a[0]) / Math.max(0.001, b[0] - a[0]))); }
    return k[k.length - 1][1];
  }

  // ================================================================== the films
  // Shot: pic (picture), cam [x0, y0, zoom0, x1, y1, zoom1, ease] (centre of the view in picture pixels), vo [clips played back to back],
  //   len (seconds, when the shot does not simply last as long as its clips), pre / pad (quiet before / after the clips), cont (the picture
  //   cuts while the previous shot's clip is still talking), mus (music part from here on), tr ('fade' | 'white' way in), over (picture rows
  //   from here down are drawn again in front of the actors), a [actors], fx [effects], ev [[time, what, ...]].
  // Actor: s (sprite, or f: a frame or [[time, frame]]; 'name*8' loops an animation at 8 a second, 'name>8' plays it once), x / y (feet, picture
  //   pixels; a number or keys), sc, rot (degrees), al (alpha), arc [[t0, t1, height]] (jumps), m [[move, t0, t1, amount, speed]], flip, piv 'c'
  //   (turn about the middle), air (no floor shadow), tint, sil (a flat-colour shape), blink 0, sleep (eyes stay shut from this time).
  // Times are seconds from the start of the shot; a negative time counts back from its end.
  // Fig's climb up the giant stairs: little steps all the way, three big hops on the narrator's "Hop! Hop! Hop!"
  const HOPS = (big => [...big.map(t => [t, t + 0.42, 12]), ...Array.from({ length: 19 }, (_, i) => 0.05 + i * 0.34).filter(t => !big.some(b => t > b - 0.34 && t < b + 0.42)).map(t => [t, t + 0.3, 3])])([2.97, 3.47, 4.09]);
  const FILMS = [
    // ---------------------------------------------------------------- funny: the cat chef and the enormous sneeze
    { id: 'sneeze', ico: '🤧', mood: 'funny', end: 'star', tint: '#ffcf4a', endAt: [150, 80],
      eyes: { pickle: ['#eea40b', [20, 23, 5, 5], [29, 24, 5, 5]], dot: ['#7c7688', [16, 18, 7, 7], [26, 18, 7, 7]] },
      music: { bpm: 132, root: 60, sc: 'maj', parts: {
        a: { ch: [0, 3, 4, 0], lead: ['4.4.2.0.2.4.7...', '5.5.3.0.3.5.7...', '6.6.4.1.4.6.8...', '7.4.2.4.0.......'], bass: 'r...o...r...o...', arp: '..0...1...2...1.', dr: 'k...h...k...h.h.' },
        tick: { ch: [0, 0], lead: ['4...5...4...5...', '4.5.4.5.45454545'], bass: 'r.......r.......', dr: '....h.......h...', lw: 'triangle' },
        fly: { ch: [0, 4, 3, 4], lead: ['0.2.4.7.4.2.4.7.', '4.6.8.b.8.6.8.b.', '3.5.7.a.7.5.7.a.', '4.6.8.b.8.b.8.6.'], bass: 'r.r.r.r.r.r.r.r.', dr: 'k.h.k.h.k.h.k.hh' },
        party: { base: 'a', dr: 'k.h.s.h.k.k.s.hh' } } },
      shots: [
        { pic: 'kitchen', cam: [124, 80, 1.2, 112, 92, 1.6], vo: ['mv_sneeze_1'], mus: 'a', fx: [['dust', 9]],
          a: [{ s: 'cake', x: 44, y: 120 }, { s: 'pepper', x: 58, y: 50 }, { s: 'pickle', x: 112, y: 137, m: [['bob', 0, 0, 1, 2.2], ['sway', 0, 0, 3, 1.1]] }],
          ev: [[3.7, 'burst', 'star', 44, 92, 5], [3.7, 'sfx', 'sparkle']] },
        { pic: 'kitchen', cam: [92, 74, 1.35, 104, 90, 1.75, 'smooth'], vo: ['mv_sneeze_2'],
          a: [{ s: 'cake', x: 44, y: 120 },
            { s: 'pepper', piv: 'c', x: [[1.5, 58], [2.1, 86, 'in']], y: [[1.5, 50], [2.1, 100, 'in']], rot: [[0, 0], [0.3, -9], [0.6, 9], [0.9, -12], [1.2, 12], [1.5, 0], [2.1, 115]], m: [['shiver', 0.2, 1.5, 0.6]] },
            { f: [[0, 'pickle'], [3.7, 'pickle_sn_0'], [4.6, 'pickle_sn_1'], [5.4, 'pickle_sn_2']], x: 112, y: 137, m: [['bob', 0, 3.6, 1, 2.2], ['shiver', 3.7, 0, 0.7]] }],
          fx: [['puffs', 86, 94, 112, 102, 2.1]],
          ev: [[0.15, 'sfx', 'uhoh'], [2.1, 'sfx', 'clink'], [2.1, 'burst', 'pepper', 86, 96, 16], [3.5, 'mus', 'tick'], [3.9, 'sfx', 'tick'], [4.5, 'sfx', 'tick'], [5.0, 'sfx', 'tick'], [5.5, 'sfx', 'tick']] },
        { pic: 'kitchen', cam: [110, 104, 2.5, 110, 102, 2.9], pre: 0.35, vo: ['mv_sneeze_3'], pad: 1.2,
          a: [{ f: [[0, 'pickle_sn_0'], [0.45, 'pickle_sn_2'], [0.95, 'pickle_sn_3'], [1.4, 'pickle_sn_4'], [1.68, 'pickle_sn_5'], [2.5, 'pickle_sn_6']], x: [[1.4, 112], [1.68, 110], [1.8, 118, 'out']], y: 137,
            rot: [[0.4, 0], [0.55, -7], [0.95, -4], [1.1, -12], [1.4, -9], [1.66, -19], [1.8, 16, 'in'], [2.4, 0]], m: [['shiver', 0, 1.6, 0.5]] }],
          ev: [[0.45, 'sfx', 'gasp'], [0.95, 'sfx', 'gasp'], [1.4, 'sfx', 'gasp'], [1.7, 'sfx', 'boom'], [1.7, 'shake', 7, 0.9], [1.7, 'burst', 'flour', 100, 108, 40], [1.74, 'flash', '#ffffff', 0.4, 9], [1.8, 'say', 'funny']] },
        { pic: 'flour', tr: 'white', cam: [128, 84, 1.3, 120, 98, 1.7], vo: ['mv_sneeze_4'], mus: 'a', fx: [['fall', 46, '#ffffff']],
          a: [{ s: 'cake', x: 44, y: 120 }, { f: [[0, 'pickle_sn_6'], [1.2, 'pickle'], [3.2, 'pickle_sn_7'], [4.4, 'pickle']], x: 116, y: 137, tint: 'flour', m: [['shiver', 3.2, 4.3, 0.8]] }],
          ev: [[0.3, 'sfx', 'poof'], [3.3, 'burst', 'flour', 116, 100, 14], [3.3, 'say', 'funny']] },
        { pic: 'flour', cam: [96, 86, 1.5, 120, 56, 1.3, 'smooth'], len: 4.2, fx: [['fall', 30, '#ffffff']],
          a: [{ f: [[0, 'pickle_sn_0'], [0.5, 'pickle_sn_2'], [1.0, 'pickle_sn_3'], [1.25, 'pickle_sn_4'], [1.5, 'pickle_sn_5'], [2.2, 'pickle_sn_0']], x: 116, y: 137, flip: 1, tint: 'flour',
            rot: [[0.3, 0], [1.4, 14], [1.55, -14, 'in'], [2.2, 0]], arc: [[2.4, 2.8, 8], [2.9, 3.3, 8]] },
            { s: 'cake', piv: 'c', x: [[1.55, 44], [2.5, 156, 'lin']], y: [[1.55, 120], [2.5, 46, 'out']], sc: [[1.55, 1], [2.5, 0.45]], rot: [[1.55, 0], [2.5, 400, 'lin']], al: [[2.45, 1], [2.55, 0]] }],
          ev: [[0.2, 'vo', 'mv_sneeze_3'], [1.5, 'sfx', 'boom'], [1.5, 'shake', 5, 0.6], [1.5, 'burst', 'flour', 70, 112, 26], [1.55, 'sfx', 'whoosh'], [1.6, 'say', 'funny'], [2.55, 'vo', 'mv_sneeze_5'], [2.55, 'mus', 'fly']] },
        { pic: 'roofs', cont: 1, cam: [128, 68, 1, 272, 68, 1], len: 3.6, fx: [['speed', 9]],
          a: [{ f: 'pickle_run*9', tint: 'flour', sc: 0.62, x: [[0, -10], [3.6, 250, 'lin']], y: [[0, 96], [0.9, 112], [1.8, 104], [2.7, 116], [3.6, 108]], arc: [[0.2, 0.8, 16], [1.1, 1.7, 14], [2.0, 2.6, 18], [2.9, 3.5, 14]] },
            { s: 'cake', piv: 'c', air: 1, sc: 0.8, x: [[0, 30], [3.6, 372, 'lin']], y: [[0, 72], [1.2, 52], [2.4, 66], [3.6, 48]], rot: [[0, 0], [3.6, 720, 'lin']] }],
          ev: [[0.1, 'sfx', 'whoosh'], [1.3, 'sfx', 'meow'], [2.2, 'sfx', 'whoosh']] },
        { pic: 'door', cam: [128, 78, 1.15, 134, 88, 1.35], vo: ['mv_sneeze_6'], mus: 'a',
          a: [{ f: [[0, 'dot_sad'], [0.75, 'dot']], sc: 0.72, x: 100, y: 119, arc: [[0.45, 0.75, 9], [1.5, 1.8, 7], [1.9, 2.2, 7], [2.3, 2.6, 7]] },
            { s: 'cake', x: 152, y: [[0, -20], [0.38, 124, 'in']], m: [['squash', 0.38, 0.9, 0.22, 3]] }],
          ev: [[0.38, 'sfx', 'plop'], [0.38, 'shake', 3, 0.3], [0.38, 'burst', 'dust', 152, 124, 10], [0.5, 'say', 'funny'], [3.3, 'burst', 'star', 152, 84, 5], [3.3, 'sfx', 'sparkle']] },
        { pic: 'door', cam: [146, 88, 1.3, 150, 88, 1.42], vo: ['mv_sneeze_7'], pad: 1.3,
          a: [{ s: 'dot', sc: 0.72, x: 100, y: 119, arc: [[0.3, 0.6, 8], [0.75, 1.05, 8], [2.0, 2.3, 6]] }, { s: 'cake', x: 152, y: 124 },
            { f: [[0, 'pickle_run*9'], [1.5, 'pickle']], tint: 'flour', flip: 1, x: [[0, 290], [1.5, 206, 'out']], y: 136, m: [['bob', 1.5, 0, 1.5, 3]] }],
          ev: [[2.0, 'burst', 'heart', 126, 84, 7], [2.0, 'say', 'sweet'], [2.0, 'sfx', 'sparkle']] },
        { pic: 'party', cam: [128, 76, 1, 158, 88, 1.3], vo: ['mv_sneeze_8'], len: 8.4, mus: 'party', fx: [['confetti', 0.2, 5]],
          a: [{ f: [[0, 'pickle'], [6.65, 'pickle_sn_0'], [7.5, 'pickle']], x: 96, y: 136, m: [['bob', 0, 6.5, 1.5, 2.2]], arc: [[6.7, 7.1, 10]] },
            { s: 'cake', x: 176, y: 99, sc: [[1.7, 0.85], [2.0, 0.6, 'step'], [2.7, 0.6], [3.0, 0.36, 'step'], [3.6, 0.36], [3.9, 0, 'step']] },
            { s: 'dot', sc: 0.72, x: [[6.62, 214], [6.92, 236, 'out']], y: 122, rot: [[6.62, 0], [6.92, 30, 'out'], [7.7, 0]], m: [['bob', 0, 5.0, 1.2, 3], ['shiver', 5.3, 6.6, 0.7]], arc: [[6.62, 7.2, 12]] }],
          ev: [[2.0, 'sfx', 'chomp'], [2.0, 'burst', 'crumb', 176, 92, 8], [3.0, 'sfx', 'chomp'], [3.0, 'burst', 'crumb', 176, 92, 8], [3.9, 'sfx', 'chomp'], [3.9, 'burst', 'crumb', 176, 94, 10],
            [5.3, 'vo', 'mv_sneeze_3'], [5.3, 'mus', 'tick'], [6.62, 'sfx', 'squeak'], [6.62, 'burst', 'conf', 200, 80, 30], [6.62, 'shake', 2, 0.3], [6.7, 'say', 'funny'], [6.7, 'mus', 'party']] }
      ] },
    // ---------------------------------------------------------------- adventure: the brave princess and the grumbly mountain
    { id: 'dragon', ico: '🐉', mood: 'adventure', end: 'heart', tint: '#ff6fa8', endAt: [150, 62],
      eyes: { pim: ['#fcdabd', [25, 17, 5, 6], [32, 17, 4, 5]], dragon: ['#72aa3c', [21, 15, 7, 8]] },
      music: { bpm: 112, root: 62, sc: 'maj', parts: {
        a: { ch: [0, 0, 3, 4], lead: ['0...0.1.2...2.1.', '2...4...2.......', '3...3.4.5...3...', '4...6...8.......'], bass: 'r...f...r...f...', dr: 'k...s...k.k.s...' },
        tense: { sc: 'min', oct: 0, ch: [0, 5, 0, 4], lead: ['7.......6...4...', '5...........4...', '7.......6...4...', '6...4...3.......'], bass: 'r.r.r.r.r.r.r.r.', dr: '....h.......h...', lw: 'triangle' },
        soft: { ch: [0, 3], lead: ['4.2.0.2.4.7.4...', '5.3.0.3.5.7.5...'], arp: '0.1.2.1.0.1.2.1.', bass: 'r.......r.......', lw: 'triangle' },
        fly: { oct: 0, ch: [0, 3, 4, 0], lead: ['0.2.4.7...4.7...', '3.5.7.a...7.a...', '4.6.8.b...8.b...', '9...8...7.......'], bass: 'r...r.o.r...r.o.', arp: '0.1.2.3.2.1.2.3.', dr: 'k.h.s.h.k.k.s.h.' } } },
      shots: [
        { pic: 'castle', cam: [150, 76, 1, 104, 62, 1.55, 'smooth'], vo: ['mv_dragon_1'], mus: 'a', pad: 0.8, fx: [['birds', 3]],
          a: [{ s: 'pim', sc: 0.36, x: 116, y: 86, arc: [[1.0, 1.3, 4], [1.5, 1.8, 4], [3.0, 3.3, 4]] }] },
        { pic: 'mountain', tr: 'fade', cam: [128, 72, 1, 118, 62, 1.22], vo: ['mv_dragon_2'], mus: 'tense', fx: [['stars', 60, 14], ['bats', 100, 62, 2.4]],
          ev: [[2.3, 'sfx', 'rumble'], [2.3, 'shake', 5, 1.2], [2.3, 'burst', 'rock', 100, 40, 12], [2.4, 'say', 'scary'], [6.1, 'sfx', 'tada']] },
        { pic: 'path', cam: [84, 96, 1.7, 88, 92, 1.95], vo: ['mv_dragon_3'], pad: 1.2, mus: 'a',
          a: [{ f: [[0, 'pim'], [0.85, 'pim_brave_1'], [1.0, 'pim_brave_3'], [1.25, 'pim_brave_4'], [1.5, 'pim_brave_5']], x: 86, y: 131, arc: [[0.9, 1.3, 6]] }],
          ev: [[1.05, 'burst', 'star', 96, 84, 6], [1.05, 'sfx', 'tada']] },
        { pic: 'path', cam: [128, 72, 1, 250, 72, 1], len: 2.7, ev: [[0.25, 'vo', 'mv_dragon_4'], [0.35, 'sfx', 'step'], [0.95, 'sfx', 'step'], [1.5, 'sfx', 'step'], [2.1, 'sfx', 'step']],
          a: [{ f: 'pim_walk*10', x: [[0, 70], [2.7, 300, 'lin']], y: 133, m: [['bob', 0, 0, 1, 3.3]] }], fx: [['birds', 2]] },
        { pic: 'cavemouth', cont: 1, cam: [128, 78, 1, 128, 74, 1.3], len: 3.1, mus: 'tense', fx: [['eyes', 150, 72, 1.3], ['vig', 0.5]],
          a: [{ f: [[0, 'pim_walk*10'], [1.5, 'pim']], x: [[0, 6], [1.5, 84, 'lin']], y: 132, m: [['bob', 0, 1.5, 1, 3.3]] }],
          ev: [[1.4, 'sfx', 'wind']] },
        { pic: 'cave', cam: [128, 72, 1, 142, 72, 1.22], vo: ['mv_dragon_5'], len: 9.0, fx: [['vig', 0.45]],
          a: [{ s: 'dragon', sil: '#1c0a14', al: [[1.3, 0], [1.9, 0.55]], sc: [[1.3, 1.9], [8, 2.25, 'lin']], x: 166, y: 128, air: 1, m: [['sway', 0, 0, 4, 0.7], ['squash', 0, 0, 0.06, 1.3]] },
            { f: [[0, 'pim_walk*10'], [1.0, 'pim'], [7.75, 'pim_brave_1'], [7.9, 'pim_brave_3'], [8.15, 'pim_brave_4'], [8.4, 'pim_brave_5']], sc: 0.85, x: [[0, 4], [1.0, 44, 'lin']], y: 134, arc: [[4.85, 5.15, 7], [5.85, 6.15, 7], [7.8, 8.2, 6]], m: [['shiver', 2.0, 6.6, 0.4]] }],
          ev: [[1.5, 'say', 'scary'], [1.5, 'sfx', 'spook'], [4.8, 'sfx', 'rumble'], [4.8, 'shake', 3, 0.5], [5.8, 'sfx', 'rumble'], [5.8, 'shake', 3, 0.5], [6.9, 'vo', 'mv_dragon_3'], [6.9, 'mus', 'a'], [7.95, 'sfx', 'tada']] },
        { pic: 'nest', cam: [124, 82, 1.3, 150, 92, 1.75, 'smooth'], vo: ['mv_dragon_6'], mus: 'soft',
          a: [{ f: [[0, 'pim_walk*10'], [1.3, 'pim']], sc: 0.9, x: [[0, 40], [1.3, 92, 'lin']], y: 128 },
            { f: [[0, 'dragon'], [2.75, 'dragon_hic>12'], [3.6, 'dragon'], [4.05, 'dragon_hic>12'], [4.8, 'dragon'], [4.95, 'dragon_hic>12'], [5.75, 'dragon']], x: 182, y: 122, arc: [[2.75, 3.05, 8], [4.05, 4.35, 9], [4.95, 5.25, 9]], m: [['bob', 0, 0, 0.7, 1.4]] }],
          ev: [[0.2, 'sfx', 'tada'], [2.75, 'sfx', 'hic'], [2.85, 'burst', 'smoke', 158, 96, 4], [4.05, 'sfx', 'hic'], [4.15, 'burst', 'smoke', 158, 96, 5], [4.15, 'say', 'funny'], [4.95, 'sfx', 'hic'], [5.05, 'burst', 'smoke', 158, 96, 5]] },
        { pic: 'nest', cam: [146, 92, 1.75, 148, 90, 1.95], vo: ['mv_dragon_7'], pad: 1.5,
          a: [{ f: [[0, 'pim'], [1.9, 'pim_brave_3'], [2.3, 'pim'], [2.75, 'pim_brave_3'], [3.05, 'pim'], [3.25, 'pim_brave_4'], [4.2, 'pim']], sc: 0.9, x: 108, y: 128, arc: [[3.25, 3.6, 6]] },
            { f: [[0, 'dragon'], [1.5, 'dragon_hold'], [3.3, 'dragon_wing*8']], x: 182, y: 122, sc: [[1.5, 1], [1.95, 1.07], [2.75, 1.14], [3.2, 1.2], [3.32, 1, 'step']], m: [['shiver', 1.9, 3.25, 0.5]], arc: [[3.4, 3.8, 10], [3.9, 4.3, 8]] }],
          ev: [[1.92, 'sfx', 'count0'], [2.76, 'sfx', 'count1'], [3.25, 'sfx', 'count2'], [3.32, 'sfx', 'pop'], [3.32, 'burst', 'ring', 156, 98, 3], [3.4, 'burst', 'star', 170, 90, 10], [3.4, 'sfx', 'sparkle']] },
        { pic: 'nest', cam: [150, 90, 1.95, 150, 88, 2.1], len: 2.05, ev: [[0.25, 'vo', 'mv_dragon_8'], [0.9, 'burst', 'heart', 150, 84, 9], [0.9, 'say', 'sweet'], [0.9, 'sfx', 'sparkle']],
          a: [{ s: 'pim', sc: 0.9, x: [[0, 108], [0.7, 142, 'out']], y: 128, arc: [[0.1, 0.5, 5]] }, { f: 'dragon_wing*8', x: 182, y: 122, m: [['bob', 0, 0, 1.4, 2.5]] }] },
        { pic: 'sky', cont: 1, tr: 'fade', cam: [128, 72, 1, 262, 72, 1], len: 8.4, mus: 'fly', fx: [['stars', 40, 12], ['trail', 0, 'spark', 14]],
          a: [{ f: 'dragon_wing*9', flip: 1, air: 1, x: [[0, 20], [6.2, 300, 'lin'], [8.4, 318, 'out']], y: [[0, 96], [1.5, 74], [3.0, 88], [4.5, 68], [6.2, 80], [8.4, 88]], rot: [[0, -6], [1.5, 4], [3.0, -5], [4.5, 4], [6.2, 0]], m: [['bob', 0, 0, 2, 1.6]] },
            { f: [[0, 'pim'], [6.7, 'pim_brave_3'], [7.0, 'pim_brave_4'], [7.4, 'pim_brave_5']], sc: 0.7, air: 1, x: [[0, 12], [6.2, 292, 'lin'], [8.4, 310, 'out']], y: [[0, 74], [1.5, 52], [3.0, 66], [4.5, 46], [6.2, 58], [8.4, 66]], m: [['bob', 0, 0, 2, 1.6]] }],
          ev: [[0.1, 'sfx', 'whoosh'], [5.9, 'vo', 'mv_dragon_3'], [6.95, 'sfx', 'tada'], [7.0, 'burst', 'star', 150, 40, 12]] }
      ] },
    // ---------------------------------------------------------------- bedtime: the fairy who woke the moon
    { id: 'moon', ico: '🌙', mood: 'gentle', end: 'star', tint: '#fff2a0', endAt: [128, 62],
      eyes: { bunny: ['#fdfcfc', [10, 19, 5, 4]], frog: ['#819b4a', [6, 3, 7, 7], [18, 3, 7, 7]], moon_1: ['#fbfd9f', [41, 34, 6, 8], [58, 34, 6, 8]] },
      music: { bpm: 84, root: 67, sc: 'maj', n: 12, oct: 0, parts: {
        night: { sc: 'pen', ch: [0, 0], lead: ['4.......2...', '0...........'], bass: 'r...........', lw: 'triangle' },
        a: { ch: [0, 3, 4, 0], lead: ['2...2...4...', '5...7...5...', '4...6...4...', '4...2...0...'], bass: 'r...........', arp: '....1...2...', lw: 'triangle' },
        up: { ch: [0, 3], lead: ['0.2.4.7.9.b.', '3.5.7.a.c.e.'], bass: 'r...........', lw: 'sine' } } },
      shots: [
        { pic: 'garden', cam: [128, 72, 1, 122, 80, 1.22], vo: ['mv_moon_1'], pad: 0.8, mus: 'night', fx: [['dark', 0.66, 0, 44], ['fireflies', 6], ['trail', 0, 'spark', 10]],
          a: [{ f: 'lumi*10', air: 1, x: [[0, 270], [2.2, 150, 'out']], y: [[0, 20], [2.2, 74, 'out']], m: [['float', 0, 0, 3]] }],
          ev: [[0.2, 'sfx', 'hush'], [0.6, 'sfx', 'twinkle']] },
        { pic: 'garden', cam: [84, 96, 1.7, 176, 98, 1.7, 'smooth'], vo: ['mv_moon_2'], pad: 0.9, fx: [['dark', 0.66, 0, 50], ['fireflies', 5], ['trail', 0, 'spark', 8]],
          a: [{ f: 'lumi*10', air: 1, x: [[0, 124], [2.0, 122], [3.4, 168], [6, 174]], y: [[0, 106], [4.4, 106], [5.2, 94]], m: [['float', 0, 0, 3]] },
            { s: 'bunny', x: [[0, 84], [0.9, 96], [1.6, 82]], y: 116, m: [['look', 0, 0, 0.8]], arc: [[0.2, 0.5, 6], [0.9, 1.2, 6], [1.5, 1.8, 6]] },
            { s: 'frog', x: [[2.3, 204], [3.0, 190], [3.6, 204]], y: 120, m: [['look', 2.2, 0, 0.7]], arc: [[2.3, 2.6, 7], [3.0, 3.3, 7], [3.6, 3.9, 7]] }],
          ev: [[1.5, 'sfx', 'sad'], [3.7, 'sfx', 'sad'], [2.3, 'sfx', 'boing'], [5.0, 'sfx', 'twinkle']] },
        { pic: 'up', cam: [128, 328, 1, 128, 72, 1, 'smooth'], vo: ['mv_moon_3'], pad: 1.0, mus: 'up', fx: [['trail', 0, 'spark', 26]],
          a: [{ f: 'lumi*12', air: 1, x: [[0, 120], [1.6, 142], [3.2, 118], [5, 134]], y: [[0, 360], [4.7, 78, 'smooth']], m: [['float', 0, 0, 2]] }],
          ev: [[0.45, 'sfx', 'up0'], [0.85, 'sfx', 'up1'], [1.12, 'sfx', 'up2']] },
        { pic: 'clouds', over: 121, cam: [128, 72, 1, 134, 84, 1.3], vo: ['mv_moon_4'], pad: 1.0, mus: 'night', fx: [['stars', 50, 10], ['zz', 166, 86, 1.5, 0.4], ['trail', 1, 'spark', 8]],
          a: [{ s: 'moon_0', x: 140, y: 133, m: [['squash', 0, 0, 0.035, 0.66]] },
            { f: 'lumi*10', air: 1, x: [[0, 20], [1.8, 66, 'out']], y: [[0, 150], [1.8, 84, 'out']], m: [['float', 0, 0, 3]] }],
          ev: [[0.5, 'sfx', 'snore'], [2.0, 'sfx', 'snore'], [3.5, 'sfx', 'snore'], [3.2, 'say', 'funny'], [5.0, 'sfx', 'snore']] },
        { pic: 'clouds', over: 121, cam: [134, 84, 1.3, 138, 82, 1.55], vo: ['mv_moon_5'], pad: 2.0, fx: [['stars', 50, 10], ['trail', 1, 'spark', 20]],
          a: [{ f: [[0, 'moon_0'], [2.5, 'moon_1'], [3.0, 'moon_2'], [3.25, 'moon_3'], [3.5, 'moon_2'], [3.75, 'moon_3'], [4.0, 'moon_2']], x: 140, y: 133, m: [['squash', 0, 2.4, 0.035, 0.66], ['shiver', 1.3, 2.4, 0.9], ['squash', 3.0, 0, 0.05, 4]], arc: [[2.5, 2.9, 9]] },
            { f: 'lumi*12', air: 1, x: [[0, 66], [1.3, 104], [1.6, 178], [1.9, 140], [2.3, 196, 'out']], y: [[0, 84], [1.3, 104], [1.6, 106], [1.9, 62], [2.3, 70]], flip: [[0, 0], [1.6, 1], [1.9, 0], [2.3, 1]], m: [['float', 0, 0, 2]] }],
          ev: [[1.3, 'sfx', 'tick'], [1.6, 'sfx', 'tick'], [1.9, 'sfx', 'tick'], [2.5, 'sfx', 'pop'], [2.5, 'burst', 'star', 140, 84, 12], [2.6, 'say', 'funny'], [3.0, 'sfx', 'giggle'], [3.0, 'mus', 'a']] },
        { pic: 'clouds', over: 121, cam: [138, 82, 1.55, 128, 72, 1.08, 'smooth'], vo: ['mv_moon_6'], pad: 1.1, fx: [['stars', 50, 10], ['glow', 0, [[0, 30], [2.4, 46], [3.2, 120]], '#dfeaff', 0.28], ['trail', 1, 'spark', 16]],
          a: [{ f: [[0, 'moon_2'], [0.25, 'moon_3'], [0.5, 'moon_2'], [0.75, 'moon_3'], [1.0, 'moon_1'], [2.4, 'moon_3']], x: 140, y: 133, m: [['squash', 0, 1.0, 0.05, 4]] },
            { f: 'lumi*12', air: 1, flip: 1, x: [[0, 196], [2, 204]], y: [[0, 70], [2.4, 60], [2.9, 44, 'out'], [3.4, 60]], m: [['float', 0, 0, 3]] }],
          ev: [[0.1, 'sfx', 'giggle'], [2.45, 'sfx', 'magic'], [2.45, 'flash', '#eaf2ff', 0.9, 0.1], [2.6, 'say', 'sweet'], [2.6, 'burst', 'star', 140, 80, 14]] },
        { pic: 'garden', tr: 'white', cam: [128, 74, 1.25, 128, 72, 1], len: 3.2, fx: [['dark', [[0, 0.6], [1.6, 0, 'out']], -1], ['fireflies', 8]],
          a: [{ s: 'gmoon', air: 1, x: 182, y: 46, al: [[0, 0.5], [1.2, 1]] },
            { s: 'bunny', x: 92, y: 116, arc: [[0.6, 0.95, 9], [1.2, 1.55, 9], [1.9, 2.25, 7]] }, { s: 'frog', flip: 1, x: 196, y: 120, arc: [[0.8, 1.15, 10], [1.5, 1.85, 10], [2.2, 2.55, 8]] }],
          ev: [[0.3, 'sfx', 'twinkle'], [0.8, 'sfx', 'boing'], [1.3, 'burst', 'star', 182, 28, 8]] },
        { pic: 'burrow', tr: 'fade', cam: [128, 74, 1.2, 112, 70, 1.5], len: 2.55, mus: 'a', fx: [['flick', 51, 70, 20, '#ffd27a'], ['zz', 92, 62, 1.2, 0.2], ['vig', 0.3]],
          ev: [[1.0, 'vo', 'mv_moon_7']] },
        { pic: 'pond', cont: 1, cam: [124, 84, 1.25, 142, 92, 1.5], len: 3.2, fx: [['fireflies', 6], ['zz', 132, 86, 1.2, 1.9]],
          a: [{ s: 'frog', x: 122, y: 112, sleep: 1.5, m: [['squash', 0, 0, 0.04, 0.6]] }], ev: [[0.5, 'sfx', 'ribbit']] },
        { pic: 'flower', tr: 'fade', cam: [128, 74, 1, 130, 82, 1.28], len: 2.2, fx: [['stars', 50, 8], ['zz', 128, 62, 1.3, 0.5]],
          a: [{ s: 'lumi_0', air: 1, piv: 'c', rot: 78, x: 122, y: 108, m: [['squash', 0, 0, 0.03, 0.6]] }], ev: [[0.7, 'vo', 'mv_moon_8']] },
        { pic: 'clouds', cont: 1, over: 121, cam: [134, 80, 1.3, 138, 78, 1.7, 'smooth'], len: 5.6, fx: [['stars', 50, 12], ['glow', 0, 60, '#dfeaff', 0.3]],
          a: [{ f: [[0, 'moon_1'], [3.8, 'moon_3'], [4.6, 'moon_1']], x: 140, y: 133, blink: 1, wink: [2.9, 3.6], m: [['squash', 0, 0, 0.03, 0.66]] }],
          ev: [[2.9, 'sfx', 'twinkle'], [2.9, 'burst', 'star', 168, 86, 6], [3.0, 'say', 'sweet']] }
      ] },
    // ---------------------------------------------------------------- musical: the vegetable disco
    { id: 'disco', ico: '🪩', mood: 'musical', end: 'star', tint: '#ff7ad9', endAt: [128, 84],
      eyes: { potato: ['#e6b75d', [12, 16, 6, 6], [27, 16, 6, 6]], tomato: ['#e9653c', [13, 25, 6, 7], [29, 25, 6, 7]], carrot: ['#ea8a20', [11, 25, 5, 6], [21, 25, 5, 6]], broccoli: ['#9ad64c', [13, 27, 5, 5], [23, 27, 5, 5]] },
      music: { bpm: 126, root: 57, sc: 'dor', oct: 0, parts: {
        a: { ch: [0, 0, 3, 4], lead: ['7..7.9.a..a.9.7.', 'b..b.a.9..7.....', 'a..a.c.d..d.c.a.', 'b..b.d.e..b.....'], bass: 'r.o.r.o.r.o.r.o.', arp: '..0...1...2...1.', dr: 'k.h.x.h.k.h.x.hh' },
        soft: { ch: [0, 3], lead: ['7.....9.a.......', 'a.....9.7.......'], bass: 'r.......o.......', dr: '....h.......h...', lw: 'triangle' },
        sad: { ch: [0, 6], lead: ['b.......a...9...', '7...............'], bass: 'r...............', lw: 'triangle' },
        roll: { ch: [4, 4], lead: ['4.5.6.7.8.9.a.b.', 'b.b.b.b.bbbbbbbb'], bass: 'r.r.r.r.r.r.r.r.', dr: 'ssssssssssssssss' } } },
      shots: [
        { pic: 'counter', cam: [128, 76, 1, 112, 92, 1.38, 'smooth'], vo: ['mv_disco_1'], pad: 1.1, mus: 'soft', fx: [['wash', '#ffd9a0', [[0, 0.3], [0.9, 0.3], [0.95, 0, 'step']]], ['beams', 3, 3.6, 3]],
          a: [{ s: 'carrot', x: [[1.4, 44], [1.9, 86, 'lin']], y: [[1.4, 100], [1.9, 119]], sc: [[1.4, 0.3], [1.9, 1]], al: [[1.35, 0], [1.45, 1]], arc: [[1.4, 1.9, 22]], m: [['bob', 2, 0, 1.5, 2.1]] },
            { s: 'tomato', x: [[1.8, 48], [2.3, 130, 'lin']], y: [[1.8, 100], [2.3, 119]], sc: [[1.8, 0.3], [2.3, 1]], al: [[1.75, 0], [1.85, 1]], arc: [[1.8, 2.3, 26]], m: [['bob', 2.4, 0, 1.5, 2.1]] },
            { s: 'broccoli', x: [[2.2, 52], [2.7, 174, 'lin']], y: [[2.2, 100], [2.7, 119]], sc: [[2.2, 0.3], [2.7, 1]], al: [[2.15, 0], [2.25, 1]], arc: [[2.2, 2.7, 30]], m: [['bob', 2.8, 0, 1.5, 2.1]] },
            { s: 'ball', air: 1, x: 128, y: [[3.0, -4], [3.6, 46, 'back']] }],
          ev: [[0.92, 'sfx', 'click'], [1.4, 'sfx', 'pop'], [1.8, 'sfx', 'pop'], [2.2, 'sfx', 'pop'], [3.2, 'mus', 'a'], [3.2, 'sfx', 'tada']] },
        { pic: 'wide', cam: [128, 72, 1, 206, 72, 1], len: 8.8, mus: 'a', fx: [['beams', 5, 0, 0], ['notes', 1.1]],
          a: [{ s: 'ball', air: 1, x: 170, y: 44, m: [['sway', 0, 0, 4, 0.5]] },
            { f: 'carrot_d*8', x: 108, y: 108, dance: [1.9, 5.3] }, { f: 'tomato_d*8', x: 170, y: 108, dance: [1.9, 5.3] }, { f: 'broccoli_d*8', x: 232, y: 108, dance: [1.9, 5.3] }],
          ev: [[1.9, 'vo', 'mv_disco_2'], [4.3, 'hold', 1], [4.3, 'sfx', 'clink'], [4.4, 'say', 'funny'], [5.3, 'hold', 0], [5.3, 'burst', 'conf', 128, 30, 30]] },
        { pic: 'corner', tr: 'fade', cam: [128, 78, 1, 132, 92, 1.5, 'smooth'], vo: ['mv_disco_3', 'mv_disco_4'], pad: 1.0, mus: 'sad',
          a: [{ s: 'potato', x: 126, y: 123, m: [['sway', 0, 0, 3, 0.4], ['squash', 3.4, 0, 0.05, 0.8]] }],
          ev: [[1.3, 'sfx', 'sad'], [4.6, 'burst', 'tear', 118, 100, 1]] },
        { pic: 'wide', cam: [120, 76, 1.15, 290, 76, 1.15, 'smooth'], vo: ['mv_disco_5'], pad: 0.8, fx: [['beams', 5, 0]],
          a: [{ f: 'carrot_d*8', x: 178, y: 108, arc: [[3.3, 3.8, 22]], dance: [99, 99] }, { f: 'tomato_d*8', x: 236, y: 108, arc: [[3.95, 4.45, 24]], dance: [99, 99] }, { f: 'broccoli_d*8', x: 292, y: 108, arc: [[4.6, 5.1, 22]], dance: [99, 99] },
            { s: 'potato', piv: 'c', x: [[0, 38], [0.85, 84, 'lin'], [1.4, 104, 'out'], [2.85, 110], [5.75, 344, 'lin'], [6.2, 334, 'out']], y: 108, rot: [[0.85, 0], [1.4, 95, 'out'], [2.85, 95], [5.75, 1175, 'lin'], [6.2, 1085, 'out']],
              arc: [[0.9, 1.4, 12], [3.0, 3.5, 7], [4.0, 4.4, 7], [4.8, 5.2, 7]], m: [['bob', 0, 0.85, 1, 4]] }],
          ev: [[0.9, 'sfx', 'boing'], [1.4, 'sfx', 'thud'], [2.85, 'mus', 'roll'], [3.1, 'say', 'funny'], [3.3, 'sfx', 'whoosh'], [4.0, 'sfx', 'whoosh'], [4.7, 'sfx', 'whoosh'], [5.75, 'sfx', 'crash'], [5.75, 'shake', 4, 0.5], [5.75, 'burst', 'star', 350, 84, 12], [5.75, 'hold', 1]] },
        { pic: 'wide', cam: [296, 80, 1.5, 292, 78, 1.62], pre: 0.9, vo: ['mv_disco_6'], pad: 0.7, fx: [['beams', 5, 1.0], ['dizzy', 3, 0, 1.1]],
          a: [{ f: [[0, 'carrot'], [1.0, 'carrot_d*8']], x: 226, y: 108, arc: [[1.0, 1.35, 12]], dance: [99, 99, 1.4] }, { f: [[0, 'tomato'], [1.0, 'tomato_d*8']], x: 268, y: 108, arc: [[1.1, 1.45, 12]], dance: [99, 99, 1.5] }, { f: [[0, 'broccoli'], [1.0, 'broccoli_d*8']], x: 364, y: 108, flip: 1, arc: [[1.05, 1.4, 12]], dance: [99, 99, 1.45] },
            { f: [[0, 'potato'], [1.3, 'potato_d*8']], x: 320, y: 108, rot: [[0, -12], [0.5, 10], [1.0, -5], [1.3, 0]], arc: [[1.9, 2.3, 9]], dance: [99, 99, 3.0] }],
          ev: [[1.0, 'hold', 0], [1.0, 'mus', 'a'], [1.0, 'burst', 'conf', 128, 20, 36], [1.0, 'sfx', 'cheer'], [1.1, 'say', 'sweet']] },
        { pic: 'wide', cam: [276, 72, 1, 150, 72, 1, 'smooth'], len: 6.6, fx: [['beams', 5, 0, 0], ['notes', 0.9]],
          a: [{ s: 'ball', air: 1, x: 200, y: 44, m: [['sway', 0, 0, 4, 0.5]] },
            ...['potato', 'carrot', 'tomato', 'broccoli'].map((v, i) => ({ f: [[0, v], [2.6, v + '_d*8']], piv: 'c', x: [[0, 330 + i * 26], [2.5, 104 + i * 50, 'smooth']], y: 108, rot: [[0, 0], [2.5, -720 - i * 360, 'smooth']], arc: [[0.5 + i * 0.1, 0.9 + i * 0.1, 8], [1.4 + i * 0.1, 1.8 + i * 0.1, 8]], dance: [2.9, 99, 2.6] }))],
          ev: [[0.2, 'sfx', 'whoosh'], [0.6, 'vo', 'mv_disco_7'], [2.9, 'vo', 'mv_disco_2'], [5.3, 'hold', 1], [5.3, 'sfx', 'clink'], [5.4, 'say', 'funny']] },
        { pic: 'morning', tr: 'fade', cam: [128, 80, 1.2, 128, 76, 1, 'smooth'], vo: ['mv_disco_8'], pad: 1.5, mus: 'soft', fx: [['dust', 12]],
          a: [...['carrot', 'tomato', 'broccoli'].map((v, i) => ({ s: v, x: [[0.5 + i * 0.5, 70 + i * 44], [1.1 + i * 0.5, 216, 'lin']], y: [[0.5 + i * 0.5, 128], [1.1 + i * 0.5, 104]], sc: [[0.5 + i * 0.5, 1], [1.1 + i * 0.5, 0.25]], al: [[1.05 + i * 0.5, 1], [1.12 + i * 0.5, 0]], arc: [[0.5 + i * 0.5, 1.1 + i * 0.5, 30]], m: [['bob', 0, 0.5 + i * 0.5, 1.2, 2.5]] })),
            { f: [[0, 'potato'], [3.9, 'potato_d*8']], x: [[2.2, 196], [2.8, 216, 'lin'], [3.85, 216], [4.3, 128, 'out']], y: [[2.2, 128], [2.8, 104], [3.85, 104], [4.3, 134, 'out']], sc: [[2.2, 1], [2.8, 0.25], [3.85, 0.25], [4.3, 2.1, 'back']], al: [[2.75, 1], [2.82, 0], [3.84, 0], [3.9, 1]], arc: [[2.2, 2.8, 30], [3.85, 4.3, 26]], m: [['bob', 0, 2.2, 1.2, 2.5], ['squash', 4.4, 0, 0.05, 2.5]] }],
          ev: [[0.5, 'sfx', 'boing'], [1.0, 'sfx', 'boing'], [1.5, 'sfx', 'boing'], [2.2, 'sfx', 'boing'], [3.9, 'sfx', 'tada'], [3.9, 'mus', 'a'], [4.3, 'burst', 'star', 128, 70, 14], [4.3, 'say', 'sweet']] }
      ] },
    // ---------------------------------------------------------------- Nunu's favourite: Fig's quest, the riddles in the dark, and second breakfast
    // Fig, a little barefoot hill-folk traveller, gets a glow-stone from a kindly wizard, climbs the misty mountain's giant stairs, says hello
    // to an echoing cave, and meets Gubble by an underground lake: he whispers to his ring ("my shiny"), argues with himself, plays riddles,
    // and is given a share of second breakfast and the glow-stone, which he likes even better than his old shiny. Kindness wins.
    // Voices: the stock storyteller, and three voices designed for Fig, the wizard and Gubble. "Second breakfast!" comes back three times.
    { id: 'quest', ico: '💍', mood: 'adventure', end: 'heart', tint: '#ffd24a', endAt: [130, 80], fav: [26, 57],
      eyes: { fig: ['#f2c9a4', [22, 16, 5, 5], [31, 16, 4, 5]], gub: ['#c2c39e', [20, 16, 11, 11], [38, 17, 6, 10]] },
      music: { bpm: 112, root: 62, sc: 'maj', n: 12, parts: {           // a jig in six-eight: pipe and fiddle for the hills, an echoing cave, a riddle tiptoe, a big happy ending
        hill: { ch: [0, 3, 0, 4], lead: ['7---6-5---4-', '5---4-3-----', '4---5-7---9-', '8---9-8---6-'], bass: 'r.....f.....', arp: '..1.2...1.2.', aw: 'sawtooth', dr: 'k.....h.....', lw: 'triangle' },
        walk: { base: 'hill', arp: '0.1.2.3.2.1.', dr: 'k..h..k..h..' },
        cave: { sc: 'min', oct: 0, ch: [0, 5, 3, 4], lead: ['4.....3.....', '2-----------', '3.....5.....', '4-----------'], bass: 'r.....r.....', lw: 'triangle', echo: 1 },
        riddle: { sc: 'min', ch: [0, 0, 5, 4], lead: ['0.2.4.......', '4.2.0.......', '5.4.2.......', '1.2.4.......'], bass: 'r..o..r..o..', lw: 'triangle', echo: 1 },
        sweet: { oct: 0, ch: [0, 3, 4, 0], lead: ['9-----7-----', '8-----5-----', '7---8-9-----', '7-----------'], bass: 'r.....r.....', arp: '0.1.2.1.2.1.', aw: 'triangle', lw: 'sine' },
        win: { oct: 0, ch: [0, 3, 4, 0], lead: ['7---7-9---7-', 'a---a-c---a-', 'b---9-8---6-', '7-----7.....'], bass: 'r..r..f..f..', arp: '0.1.2.3.2.1.', dr: 'k..h..s..h.h' } } },
      shots: [
        // the round green door in the green hill: Fig loves breakfast... and SECOND breakfast!
        { pic: 'hill', cam: [130, 72, 1, 222, 90, 1.5, 'smooth'], pre: 0.3, vo: ['mv_quest_1', 'mv_quest_2'], pad: 0.2, mus: 'hill', fx: [['birds', 3]],
          a: [{ s: 'door', air: 1, x: 217, y: 116, al: [[4.5, 0], [4.7, 1]] },
            { f: [[0, 'fig_walk*10'], [5.9, 'fig'], [7.38, 'fig_cheer>12'], [8.6, 'fig']], x: [[4.75, 217], [5.9, 246, 'lin']], y: [[4.75, 113], [5.9, 127, 'lin']], sc: [[4.75, 0.6], [5.9, 0.72]], al: [[4.7, 0], [4.9, 1]], arc: [[7.45, 7.95, 10]], m: [['bob', 4.7, 5.9, 0.8, 3.3]] }],
          ev: [[4.5, 'sfx', 'creak'], [7.85, 'sfx', 'tada'], [7.9, 'burst', 'star', 246, 92, 10]] },
        // poof! the wizard, and a glow-stone from the tip of his staff
        { pic: 'hill', cam: [214, 90, 1.42, 204, 88, 1.32], pre: 0.75, vo: ['mv_quest_3'], len: 4.9,
          a: [{ f: [[0, 'fig'], [3.0, 'fig_cheer>12'], [4.2, 'fig']], flip: 1, x: 246, y: 127, sc: 0.72, arc: [[3.05, 3.55, 9]] },
            { f: [[0, 'wiz'], [0.9, 'wiz_magic>11'], [1.45, 'wiz_magic_6'], [2.2, 'wiz_magic_7'], [2.35, 'wiz']], x: 174, y: 128, sc: [[0.28, 0.4], [0.6, 0.72, 'back']], al: [[0.27, 0], [0.3, 1]], m: [['squash', 0.75, 3.8, 0.02, 2.6]] },
            { s: 'stone', air: 1, sc: 0.42, x: [[1.5, 167], [2.5, 237]], y: [[1.5, 72], [2.5, 113]], al: [[1.45, 0], [1.6, 1]], arc: [[1.7, 2.5, 16], [3.05, 3.55, 9]] }],
          fx: [['glow', 2, [[1.45, 4], [1.7, 24]], '#ffe9a0', [[1.45, 0], [1.6, 0.45]]]],
          ev: [[0.27, 'sfx', 'magic'], [0.27, 'sfx', 'poof'], [0.3, 'burst', 'smoke', 174, 104, 12], [0.3, 'burst', 'star', 174, 92, 10], [1.5, 'sfx', 'sparkle'], [1.5, 'burst', 'star', 167, 68, 10],
            [2.5, 'sfx', 'pop'], [3.0, 'sfx', 'tada'], [3.05, 'burst', 'star', 240, 100, 8]] },
        // up the giant stone stairs, over the misty mountains: hop! hop! hop!
        { pic: 'stairs', cam: [128, 330, 1, 128, 72, 1, 'smooth'], pre: 0.25, vo: ['mv_quest_4'], len: 6.5, mus: 'walk', fx: [['birds', 2], ['mist', 7, 0.34]],
          a: [{ f: 'fig_walk*12', sc: 0.6, x: [[0, 160], [1.89, 76, 'lin'], [3.7, 160, 'lin'], [4.25, 128, 'lin'], [5.95, 68, 'lin'], [6.3, 48, 'lin']], y: [[0, 402], [1.89, 306, 'lin'], [3.7, 218, 'lin'], [4.25, 200, 'lin'], [5.95, 102, 'lin'], [6.3, 88, 'lin']], flip: [[0, 1], [1.89, 0], [3.7, 1]], arc: HOPS }],
          ev: [[2.97, 'sfx', 'hop'], [3.47, 'sfx', 'hop'], [4.09, 'sfx', 'hop']] },
        // the echoing cave, lit only by the glow-stone: "Hello?" ... hello ... hello — and two big round eyes blink in the dark
        { pic: 'cave', tr: 'fade', cam: [120, 80, 1.15, 128, 78, 1.3], len: 5.0, mus: 'cave', fx: [['dark', 0.8, 1, 70], ['lamps', 166, 64, 2.9, 4.3, 3.2]],
          a: [{ f: [[0, 'fig_walk*10'], [1.3, 'fig']], sc: 0.72, x: [[0, -6], [1.3, 104, 'lin']], y: 132, arc: [[3.0, 3.35, 9]], m: [['bob', 0, 1.3, 1, 3.3], ['shiver', 3.35, 4.3, 0.6]] },
            { s: 'stone', air: 1, sc: 0.32, x: [[0, 3], [1.3, 113, 'lin']], y: 119, arc: [[3.0, 3.35, 9]], m: [['bob', 0, 1.3, 1, 3.3], ['shiver', 3.35, 4.3, 0.6]] }],
          ev: [[0.4, 'sfx', 'drip'], [1.45, 'vo', 'mv_quest_5'], [2.92, 'sfx', 'glk'], [3.0, 'say', 'scary'], [4.3, 'sfx', 'scurry']] },
        // the glittering lake: Gubble whispers to his ring... then sees the glow-stone's light: "No, no! Hide the shiny!" — and hides behind it
        { pic: 'lake', tr: 'fade', cam: [130, 72, 1, 282, 92, 1.9, 'smooth'], pre: 0.5, vo: ['mv_quest_6', 'mv_quest_7'], pad: 0.45, fx: [['glitter', 70, 84, 330, 116, 30], ['trail', 1, 'spark', 5], ['vig', 0.3]],
          a: [{ f: [[0, 'gub_pet*6'], [5.35, 'gub'], [5.6, 'gub_argue*9'], [6.6, 'gub_think_7']], x: 286, y: 128, sc: 0.75, arc: [[5.35, 5.6, 5]], m: [['sway', 0, 5.3, 2.5, 0.45], ['look', 5.6, 6.55, 0.22], ['shiver', 6.65, 7.9, 0.55]] },
            { s: 'ring', al: 0, air: 1, x: [[6.6, 277], [6.62, 280, 'step']], y: [[6.6, 117], [6.62, 101, 'step']] }],
          ev: [[0.2, 'sfx', 'drip'], [1.0, 'sfx', 'glk'], [5.35, 'sfx', 'glk'], [6.65, 'sfx', 'squeak'], [6.8, 'say', 'funny']] },
        // Fig steps up, giggling, and Gubble's other self is delighted: "Ooh! A visitor!" — two voices, one Gubble
        { pic: 'lake', cam: [244, 96, 1.55, 248, 97, 1.62], pre: 0.5, vo: ['mv_quest_8'], pad: 0.5, fx: [['glitter', 70, 84, 330, 116, 30], ['vig', 0.3]],
          a: [{ f: [[0, 'fig_walk*10'], [0.7, 'fig']], x: [[0, 168], [0.7, 208, 'lin']], y: 128, sc: 0.75, m: [['bob', 0, 0.7, 1, 3.3], ['bob', 0.9, 2.4, 1.2, 3]] },
            { f: [[0, 'gub_think_7'], [0.45, 'gub_happy>12'], [1.3, 'gub_happy*10'], [2.9, 'gub']], x: 286, y: 128, sc: 0.75, m: [['shiver', 0, 0.4, 0.5]], arc: [[0.55, 1.0, 10], [1.7, 2.1, 7]] }],
          ev: [[0.15, 'sfx', 'giggle'], [0.55, 'sfx', 'boing'], [1.7, 'sfx', 'boing'], [1.75, 'burst', 'star', 286, 92, 6]] },
        // riddles in the dark: "What has a mouth, but never eats?" ... "A river!" (the answer pops up as a picture)
        { pic: 'lake', cam: [246, 95, 1.62, 248, 94, 1.72], len: 7.95, fx: [['glitter', 70, 84, 330, 116, 30], ['vig', 0.3]],
          a: [{ f: [[0, 'fig'], [7.0, 'fig_cheer>12'], [7.9, 'fig']], x: 208, y: 128, sc: 0.75, m: [['sway', 5.45, 6.3, 5, 1.2]], arc: [[7.05, 7.5, 8]] },
            { f: [[0, 'gub'], [0.9, 'gub_happy>12'], [1.6, 'gub'], [7.05, 'gub_happy>12'], [7.9, 'gub_happy_7']], x: 286, y: 128, sc: 0.75, arc: [[0.95, 1.35, 7], [7.05, 7.5, 9]], m: [['squash', 0.2, 5.4, 0.03, 2.8]] },
            { s: 'think', air: 1, x: 230, y: 88, sc: [[6.4, 0.5], [6.65, 0.9, 'back']], al: [[6.35, 0], [6.45, 1], [7.75, 1], [7.95, 0]] }],
          ev: [[0, 'mus', 'riddle'], [0.2, 'vo', 'mv_quest_9'], [0.95, 'sfx', 'boing'], [5.5, 'sfx', 'think'], [6.25, 'vo', 'mv_quest_10'], [6.45, 'sfx', 'pop'], [7.0, 'sfx', 'tada'], [7.05, 'burst', 'star', 247, 80, 12]] },
        // tummies rumble: "Second breakfast! Want some?" ... "For me? Nobody ever shares with Gubble..."
        { pic: 'lake', cam: [246, 96, 1.7, 250, 97, 1.85], len: 8.0, mus: 'sweet', fx: [['glitter', 70, 84, 330, 116, 30], ['vig', 0.3]],
          a: [{ f: 'fig', x: 208, y: 128, sc: 0.75, m: [['bob', 0.7, 3.0, 0.8, 2.6]] },
            { f: [[0, 'gub'], [3.2, 'gub_pet*6'], [7.0, 'gub_happy*10']], x: 286, y: 128, sc: 0.75, m: [['squash', 0.12, 0.9, 0.06, 5], ['squash', 3.2, 6.9, 0.025, 2.4]], arc: [[7.0, 7.3, 5], [7.35, 7.65, 5], [7.7, 7.98, 5]] },
            { s: 'sandwich', air: 1, x: [[0.75, 218], [2.45, 218], [3.05, 272, 'lin']], y: [[0.75, 113], [3.05, 114]], al: [[0.7, 0], [0.8, 1]], arc: [[2.45, 3.05, 18]],
              sc: [[0.75, 0.3], [0.95, 0.5, 'back'], [6.98, 0.5], [7.0, 0.36, 'step'], [7.34, 0.36], [7.35, 0.2, 'step'], [7.69, 0.2], [7.7, 0, 'step']] }],
          ev: [[0.12, 'sfx', 'tummy'], [0.7, 'vo', 'mv_quest_11'], [0.8, 'sfx', 'pop'], [0.8, 'burst', 'star', 218, 104, 6], [3.2, 'vo', 'mv_quest_12'], [6.75, 'say', 'sweet'], [6.75, 'burst', 'heart', 282, 84, 8], [6.75, 'sfx', 'sparkle'],
            [7.0, 'sfx', 'chomp'], [7.0, 'burst', 'crumb', 272, 108, 8], [7.35, 'sfx', 'chomp'], [7.35, 'burst', 'crumb', 272, 108, 8], [7.7, 'sfx', 'chomp'], [7.7, 'burst', 'crumb', 272, 108, 10]] },
        // the glow-stone for Gubble: "A glowing shiny! Even better than my old shiny!" — and the old one goes plop
        { pic: 'lake', cam: [250, 96, 1.8, 246, 94, 1.55, 'smooth'], len: 6.4, fx: [['glitter', 70, 84, 330, 116, 30], ['vig', 0.3], ['glow', 2, 22, '#ffe9a0', [[0.1, 0], [0.3, 0.4]]], ['trail', 3, 'spark', 14]],
          a: [{ f: 'fig', x: 208, y: 128, sc: 0.75 },
            { f: [[0, 'gub'], [1.25, 'gub_happy>12'], [2.1, 'gub_pet*6'], [4.6, 'gub_argue_3'], [5.0, 'gub_happy*10']], x: 286, y: 128, sc: 0.75, arc: [[1.3, 1.75, 10], [5.1, 5.5, 8]] },
            { s: 'stone', air: 1, sc: [[0.15, 0.2], [0.35, 0.42, 'back']], x: [[0.5, 218], [1.2, 272]], y: [[0.5, 114], [1.2, 116]], al: [[0.12, 0], [0.2, 1]], arc: [[0.5, 1.2, 14], [1.3, 1.75, 10], [5.1, 5.5, 8]] },
            { s: 'ring', air: 1, piv: 'c', sc: 1.3, x: [[4.7, 278], [5.6, 304, 'lin']], y: [[4.7, 110], [5.6, 97, 'lin']], al: [[4.65, 0], [4.7, 1], [5.58, 1], [5.6, 0]], arc: [[4.7, 5.6, 34]], rot: [[4.7, 0], [5.6, 540, 'lin']] }],
          ev: [[0.15, 'sfx', 'sparkle'], [0.2, 'burst', 'star', 218, 106, 6], [1.2, 'sfx', 'pop'], [1.25, 'vo', 'mv_quest_13'], [1.3, 'burst', 'star', 272, 100, 8], [4.7, 'sfx', 'whoosh'],
            [5.6, 'sfx', 'splash'], [5.6, 'burst', 'ripple', 304, 97, 3], [5.62, 'burst', 'spark', 304, 93, 8], [5.7, 'say', 'funny']] },
        // home at golden evening: second breakfast together, every day — "Second breakfast! Gubble, gubble!"
        { pic: 'hill_eve', tr: 'fade', cam: [216, 94, 1.55, 214, 90, 1.38], pre: 0.3, vo: ['mv_quest_14', 'mv_quest_15'], pad: 0.6, mus: 'win', fx: [['fireflies', 7], ['glow', 4, 24, '#ffe9a0', 0.42]],
          a: [{ s: 'wiz', x: 150, y: 130, sc: 0.72, flip: 1, m: [['bob', 4.5, 0, 1, 1.6]] },
            { s: 'table', x: 217, y: 134, sc: 0.85 },
            { f: [[0, 'fig'], [4.45, 'fig_cheer>12'], [5.6, 'fig_cheer_6']], x: 190, y: 133, sc: 0.72, arc: [[4.5, 4.95, 10], [5.8, 6.2, 8]] },
            { f: [[0, 'gub_pet*6'], [4.45, 'gub_happy>12'], [5.3, 'gub_happy*10']], x: 246, y: 133, sc: 0.72, arc: [[4.55, 5.0, 10], [5.9, 6.3, 8]] },
            { s: 'stone', air: 1, x: 226, y: 108, sc: 0.36 }],
          ev: [[4.45, 'say', 'sweet'], [4.45, 'burst', 'heart', 216, 80, 10], [4.45, 'sfx', 'cheer'], [5.8, 'burst', 'conf', 216, 30, 30], [5.8, 'sfx', 'tada']] }
      ] }
  ];

  // ================================================================== pictures and clip lengths
  let META = null, metaP = null; const IMG = {};
  function loadMeta() { return metaP || (metaP = fetch(DIR + 'movies.json').then(r => { if (!r.ok) throw new Error('movies.json'); return r.json(); }).then(j => (META = j)).catch(e => { metaP = null; throw e; })); }
  function loadImg(name) { return IMG[name] || (IMG[name] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { delete IMG[name]; rej(new Error(name)); }; i.src = DIR + name + '.png'; })); }
  const dur = k => (META && META.dur[k]) || 3;
  // work out how long every shot lasts, put the clips on its timeline, and turn "from the end" times into real ones
  function compile(F) {
    if (F.ok) return; F.R = META.sheets[F.id]; const fix = (t, D) => (t < 0 || Object.is(t, -0) ? D + t : t), R = F.R;
    const count = base => { let n = 0; while (R[base + '_' + n]) n++; return n; };
    for (const sh of F.shots) {
      const E = (sh.ev || []).map(e => e.slice()); let t = sh.pre == null ? 0.25 : sh.pre;
      for (const k of sh.vo || []) { E.push([t, 'vo', k]); t += dur(k) + 0.25; }
      const D = sh.D = sh.len || t - 0.25 + (sh.pad == null ? 0.6 : sh.pad);
      for (const e of E) e[0] = fix(e[0], D); E.sort((a, b) => a[0] - b[0]); sh.E = E;
      for (const A of sh.a || []) {
        for (const ch of ['x', 'y', 'sc', 'rot', 'al']) if (Array.isArray(A[ch])) for (const k of A[ch]) k[0] = fix(k[0], D);
        A.F = (typeof (A.f || A.s) === 'string' ? [[0, A.f || A.s]] : A.f).map(([ft, name]) => { const m = /^(.+?)([*>])(\d+)$/.exec(name); return m ? { t: fix(ft, D), base: m[1], n: count(m[1]), fps: +m[3], once: m[2] === '>' } : { t: fix(ft, D), name }; });
        for (const m of A.m || []) { m[1] = fix(m[1] || 0, D); m[2] = m[2] ? fix(m[2], D) : D + 9; }
      }
    }
    F.secs = Math.round(LOGO + F.shots.reduce((s, sh) => s + sh.D, 0) + ENDLEN); F.ok = true;
  }

  // ================================================================== sound: narration, a tiny chiptune sequencer, effects
  const A2 = () => (typeof Audio2 !== 'undefined' && Audio2) || null;
  const actx = () => { const a = A2(); return (a && a.ctx) || null; };
  const wake = () => { try { A2().init(); } catch (e) { } };
  const sfx = (n, o) => { try { A2().sfx(n, o); } catch (e) { } };
  const blip = (n, type, len, vol) => { try { A2().blip(n, type, len, vol); } catch (e) { } };
  const jingle = (n, step, type) => { try { A2().jingle(n, step, type); } catch (e) { } };
  const noise = (len, vol, hp) => { try { A2().noise(len, vol, hp); } catch (e) { } };
  const whoosh = up => { try { A2().whoosh(up); } catch (e) { } };
  const later = (ms, f) => setTimeout(() => { if (S && !S.paused) f(); }, ms);
  const SND = {
    pop: () => sfx('chip_pop'), boing: () => sfx('boing', { vol: 0.7 }), sparkle: () => sfx('chip_sparkle', { vol: 0.8 }), magic: () => sfx('magic', { vol: 0.8 }), thud: () => sfx('thud'), cheer: () => sfx('chip_cheer'),
    chomp: () => sfx('eat_chomp'), meow: () => sfx('meow1', { rate: 1.25, vol: 0.7 }), whoosh: () => whoosh(true),
    boom: () => { noise(0.7, 0.55, 120); blip(-30, 'sawtooth', 0.5, 0.3); sfx('thud'); }, poof: () => noise(0.5, 0.3, 900),
    rumble: () => { sfx('rumble', { rate: 0.8 }); noise(0.9, 0.3, 40); blip(-34, 'sawtooth', 0.8, 0.22); }, crash: () => { noise(0.4, 0.5, 400); sfx('thud'); },
    plop: () => { blip(-10, 'sine', 0.12, 0.3); later(70, () => blip(-19, 'sine', 0.16, 0.28)); },
    hic: () => { blip(14, 'square', 0.05, 0.16); later(70, () => blip(22, 'square', 0.08, 0.16)); },
    step: () => { blip(-22, 'triangle', 0.07, 0.24); noise(0.05, 0.12, 300); }, tick: () => blip(19 + ((Math.random() * 5) | 0), 'sine', 0.06, 0.12),
    gasp: () => blip(4 + ((Math.random() * 3) | 0), 'triangle', 0.12, 0.08), squeak: () => { blip(26, 'square', 0.05, 0.12); later(60, () => blip(31, 'square', 0.09, 0.12)); noise(0.2, 0.25, 2500); },
    snore: () => { for (let i = 0; i < 6; i++) later(i * 70, () => blip(-26 + i, 'sawtooth', 0.12, 0.05)); later(700, () => blip(12, 'sine', 0.5, 0.04)); },
    giggle: () => jingle([12, 16, 12, 16, 19, 16, 19], 0.075, 'triangle'), click: () => { noise(0.04, 0.5, 3000); blip(-12, 'square', 0.03, 0.2); }, clink: () => { blip(24, 'sine', 0.2, 0.14); blip(31, 'sine', 0.3, 0.08); },
    uhoh: () => jingle([4, 0], 0.17, 'triangle'), sad: () => jingle([3, 2, -2], 0.2, 'triangle'), tada: () => jingle([0, 4, 7, 12], 0.07, 'square'), twinkle: () => jingle([12, 19, 24, 31], 0.09, 'sine'),
    hush: () => noise(0.5, 0.12, 4000), wind: () => { noise(1.2, 0.12, 300); whoosh(false); }, spook: () => jingle([-12, -13, -18], 0.3, 'triangle'), ribbit: () => { blip(-14, 'square', 0.07, 0.1); later(110, () => blip(-9, 'square', 0.1, 0.1)); },
    count0: () => blip(0, 'triangle', 0.25, 0.2), count1: () => blip(4, 'triangle', 0.25, 0.2), count2: () => blip(7, 'triangle', 0.3, 0.22), up0: () => blip(7, 'sine', 0.2, 0.12), up1: () => blip(12, 'sine', 0.2, 0.12), up2: () => blip(16, 'sine', 0.25, 0.12),
    // the quest: a creaky round door, hops up the stairs, a cave drip (and its echo), Gubble's little throat clicks, his scurrying feet, a rumbling tummy, a thinking tick-tock, a splash
    creak: () => { for (let i = 0; i < 6; i++) later(i * 45, () => blip(9 + i + (i & 1) * 3, 'square', 0.05, 0.035)); },
    hop: () => { blip(7, 'square', 0.06, 0.08); later(55, () => blip(14, 'square', 0.07, 0.07)); },
    drip: () => { blip(26, 'sine', 0.07, 0.16); later(80, () => blip(33, 'sine', 0.06, 0.08)); later(420, () => blip(26, 'sine', 0.06, 0.05)); later(800, () => blip(26, 'sine', 0.05, 0.025)); },
    glk: () => { blip(-8, 'square', 0.025, 0.12); noise(0.03, 0.18, 1500); later(120, () => { blip(-11, 'square', 0.03, 0.12); noise(0.03, 0.18, 1500); }); },
    scurry: () => { for (let i = 0; i < 7; i++) later(i * 48, () => { blip(18 + ((Math.random() * 6) | 0), 'square', 0.02, 0.05); noise(0.02, 0.1, 3000); }); },
    tummy: () => { for (let i = 0; i < 9; i++) later(i * 55, () => blip(-30 + (i % 3) * 2 + (i > 5 ? 3 : 0), 'sawtooth', 0.09, 0.07)); },
    think: () => { blip(12, 'triangle', 0.05, 0.1); later(260, () => blip(7, 'triangle', 0.05, 0.1)); later(520, () => blip(12, 'triangle', 0.05, 0.1)); },
    splash: () => { noise(0.35, 0.3, 1200); blip(-6, 'sine', 0.1, 0.2); later(80, () => blip(5, 'sine', 0.12, 0.12)); }
  };
  const snd = n => { if (SND[n]) try { SND[n](); } catch (e) { } };

  // narration: Audio2.voice(key, 'tv') once the clip is in the voice packs; until then the single file assets/vo/<key>.mp3 is played directly
  let voIdx = null, voIdxP = null, voSrc = null, voTill = 0; const voBuf = {};
  function voReady() { return voIdxP || (voIdxP = fetch('assets/vo_index.json').then(r => r.json()).then(j => (voIdx = j || {})).catch(() => (voIdx = {}))); }
  function voLoad(key) {
    return voReady().then(() => { const a = A2(); if (!a || !a.ctx) return false;
      return voIdx[key] ? a.load('assets/vo/' + key + '.mp3').then(b => !!b) : a.load('./assets/vo/' + key + '.mp3').then(b => { if (b) voBuf[key] = b; return !!b; }); }).catch(() => false);
  }
  function voStop() { voTill = 0; try { A2().hush('tv'); } catch (e) { } if (voSrc) { const s = voSrc; voSrc = null; try { s.onended = null; s.stop(); } catch (e) { } } }
  function voPlay(key) {
    const a = A2(), c = actx(); voStop(); if (!c) return;
    if (voIdx && voIdx[key]) { try { a.voice(key, 'tv', { cut: true }); } catch (e) { } }
    else if (voBuf[key]) { const s = c.createBufferSource(), g = c.createGain(); s.buffer = voBuf[key]; g.gain.value = 0.9; s.connect(g); g.connect(c.destination); s.onended = () => { if (voSrc === s) voSrc = null; }; s.start(); voSrc = s; }
    else return;
    voTill = performance.now() + dur(key) * 1000; Seq.duck(dur(key));
  }
  // the game's own music waits outside while a film is on
  function hushGame() { try { const M = A2().Music; if (M.cur || M.synthOn) { M.want++; M.stopFile(); M.synth(false); } } catch (e) { } }
  function gameMusic() { try { if (typeof setMusic === 'function') setMusic(); } catch (e) { } }

  const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], pen: [0, 2, 4, 7, 9] }, VOL = 0.34, DUCK = 0.16;
  const Seq = {
    on: false, def: null, part: null, want: null, step: 0, next: 0, timer: 0, g: null, held: false, b0: 0,
    start(def, part) {
      this.stop(); this.def = def; this.part = null; this.want = part; this.step = 0; this.held = false; const c = actx(); if (!c || !def) return;
      this.g = c.createGain(); this.g.gain.value = VOL; this.g.connect(c.destination); this.next = this.b0 = c.currentTime + 0.05; this.on = true; this.timer = setInterval(() => this.tick(), 30);
      this.dl = null; if (Object.values(def.parts).some(p => p.echo)) {        // an echo for parts marked echo (the cave): notes repeat, fainter each time
        const d = this.dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain(); d.delayTime.value = 0.34; fb.gain.value = 0.42; wet.gain.value = 0.55; d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(this.g); this.ex = [d, fb, wet];
      }
    },
    set(part) { if (this.def && this.def.parts[part]) this.want = part; },
    stop() {
      clearInterval(this.timer); this.timer = 0; this.on = false; const g = this.g, c = actx(), ex = this.dl ? this.ex : []; this.g = this.dl = null; if (!g || !c) return;
      try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(0, c.currentTime); } catch (e) { } setTimeout(() => { for (const n of [g, ...ex]) try { n.disconnect(); } catch (e) { } }, 60);
    },
    duck(sec) { const c = actx(), g = this.g; if (!c || !g) return; const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(DUCK, t, 0.06); g.gain.setTargetAtTime(VOL, t + sec, 0.25); },
    beat() { const c = actx(); return this.on && c && c.state === 'running' ? (c.currentTime - this.b0) * this.def.bpm / 60 : null; },
    tone(midi, t, len, type, vol, echo) {
      const c = actx(), o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); g.connect(this.g); if (echo && this.dl) g.connect(this.dl); o.start(t); o.stop(t + len + 0.03);
    },
    drum(k, t) {
      const c = actx();
      if (k === 'k' || k === 'x') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(this.g); o.start(t); o.stop(t + 0.17); }
      if (k === 'k') return; const sn = k !== 'h', len = sn ? 0.11 : 0.03, b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = sn ? 1500 : 7000; g.gain.setValueAtTime(sn ? 0.3 : 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g); g.connect(this.g); s.start(t);
    },
    tick() {
      const c = actx(), d = this.def; if (!c || !this.on || !this.g || !d) return; const n = d.n || 16, spb = 60 / d.bpm / 4;
      if (this.next < c.currentTime - 0.3) this.next = c.currentTime + 0.03;        // the timer was held up (a busy phone): skip what was missed, never play it in a burst
      while (this.next < c.currentTime + 0.14) {
        if (this.want && this.want !== this.part && (this.step % 4 === 0 || !this.part)) { this.part = this.want; this.step = 0; this.b0 = this.next; }
        let P = d.parts[this.part]; if (P && P.base) P = Object.assign({}, d.parts[P.base], P);
        if (P && !this.held) {
          const t = this.next, s = this.step % n, bar = Math.floor(this.step / n), sc = SCALES[P.sc || d.sc], root = P.ch[bar % P.ch.length];
          const midi = deg => d.root + sc[((deg % sc.length) + sc.length) % sc.length] + 12 * Math.floor(deg / sc.length);
          const L = P.lead && P.lead[bar % P.lead.length], lc = L && L[s];
          if (lc && lc !== '.' && lc !== '-') { let h = 1; while (s + h < n && L[s + h] === '-') h++; this.tone(midi(parseInt(lc, 36)) + (P.oct != null ? P.oct : d.oct == null ? 12 : d.oct), t, spb * (h + 0.8), P.lw || 'square', 0.2, P.echo); }
          const bc = P.bass && P.bass[s]; if (bc === 'r' || bc === 'o' || bc === 'f') this.tone(midi(root + (bc === 'f' ? 4 : 0)) - (bc === 'o' ? 0 : 12), t, spb * 3, 'triangle', 0.36);
          const ac = P.arp && P.arp[s]; if (ac && ac !== '.') this.tone(midi(root + [0, 2, 4, 7][+ac]), t, spb * 0.9, P.aw || 'square', 0.07, P.echo);
          const dc = P.dr && P.dr[s]; if (dc && dc !== '.') this.drum(dc, t);
        }
        this.next += spb; this.step++;
      }
    }
  };

  // ================================================================== little pixel pictures drawn by code
  const GL = {
    heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], note: ['..###', '..#.#', '..#..', '..#..', '###..', '###..'],
    star: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'], spark: ['.#.', '###', '.#.'], bat: ['#.....#', '##.#.##', '#######', '.##.##.'], bat2: ['.......', '.#...#.', '#######', '##.#.##'],
    bird: ['#...#', '.#.#.', '..#..'], bird2: ['.....', '.###.', '#.#.#'],
    big: ['.....#.....', '.....#.....', '....###....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '##.......##']
  };
  function glyph(g, name, x, y, s, col) { const rows = GL[name], w = rows[0].length, h = rows.length; g.fillStyle = col; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === '#') g.fillRect(x + (i - w / 2) * s, y + (j - h / 2) * s, s + 0.02, s + 0.02); }
  function shapePath(g, kind, cx, cy, r) {
    if (kind === 'heart') for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); g[i ? 'lineTo' : 'moveTo'](cx + x * r / 16, cy + y * r / 16 - r * 0.1); }
    else for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, q = i & 1 ? r * 0.46 : r; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
    g.closePath();
  }

  // ================================================================== the film itself (drawn FW x FH, K canvas pixels to each one)
  let S = null;
  const TINT = {};
  // a sprite as a flat shadow shape, or dusted white with flour (dark lines and eyes stay)
  function tinted(F, name, mode) {
    const key = F.id + name + mode; if (TINT[key]) return TINT[key]; const r = F.R[name], c = TINT[key] = cnv(r[2], r[3]), g = c.getContext('2d'); g.drawImage(F.img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    if (mode !== 'flour') { g.globalCompositeOperation = 'source-in'; g.fillStyle = mode; g.fillRect(0, 0, r[2], r[3]); return c; }
    try { const d = g.getImageData(0, 0, r[2], r[3]), p = d.data; for (let i = 0; i < p.length; i += 4) { const l = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11; if (l < 62) continue; const k = (i >> 2) % 7 === 0 ? 0.6 : 0.86; p[i] += (255 - p[i]) * k; p[i + 1] += (252 - p[i + 1]) * k; p[i + 2] += (246 - p[i + 2]) * k; } g.putImageData(d, 0, 0); } catch (e) { }
    return c;
  }
  function frameOf(A, t) {
    let f = A.F[0]; for (const q of A.F) if (q.t <= t) f = q; if (f.name) return f.name; if (!f.n) return f.base;
    const i = Math.floor((t - f.t) * f.fps); return f.base + '_' + (f.once ? Math.min(f.n - 1, i) : ((i % f.n) + f.n) % f.n);
  }
  const beatNow = () => { const b = Seq.beat(); return Math.max(0, b == null ? S.ft * (S.film.music.bpm / 60) : b); };
  function actorAt(A, t, D) {
    const st = { fr: frameOf(A, t), x: kv(A.x, t, 0), y: kv(A.y, t, 0), sc: kv(A.sc, t, 1), rot: kv(A.rot, t, 0), al: kv(A.al, t, 1), sx: 1, sy: 1, flip: Array.isArray(A.flip) ? A.flip.reduce((v, k) => (k[0] <= t ? k[1] : v), 0) : A.flip };
    st.gy = st.y;
    for (const a of A.arc || []) if (t > a[0] && t < a[1]) { const u = (t - a[0]) / (a[1] - a[0]); st.y -= a[2] * 4 * u * (1 - u); }
    for (const m of A.m || []) {
      if (t < m[1] || t > m[2]) continue; const q = t - m[1], amt = m[3] == null ? 1 : m[3], sp = m[4] || 1;
      if (m[0] === 'bob') st.y += Math.sin(q * sp * TAU) * amt;
      else if (m[0] === 'sway') st.rot += Math.sin(q * sp * TAU) * amt;
      else if (m[0] === 'shiver') { st.x += (hash(Math.floor(t * 30)) - 0.5) * 2 * amt; st.y += (hash(Math.floor(t * 30) + 9) - 0.5) * amt; }
      else if (m[0] === 'float') { st.x += Math.sin(t * 1.7) * amt; st.y += Math.sin(t * 2.6 + 1) * amt * 0.8; }
      else if (m[0] === 'squash') { const k = Math.sin(q * sp * TAU) * amt * (m[2] > D ? 1 : clamp((m[2] - t) * 3, 0, 1)); st.sy *= 1 + k; st.sx *= 1 - k * 0.7; }
      else if (m[0] === 'look') st.flip = Math.floor(q / amt) & 1 ? !st.flip : st.flip;
    }
    if (A.dance && t >= (A.dance[2] || 0)) {            // the dance she can copy: wiggle, wiggle, hop, hop, spin around and stop — then freeze until the music comes back
      const c = t - A.dance[0], free = t >= A.dance[1];
      if (c >= 0 && c < 2.4) {
        if (c < 0.7) st.rot += Math.sin(c / 0.35 * TAU) * 14;
        else if (c < 1.45) { const u = ((c - 0.7) % 0.375) / 0.375; st.y -= 13 * 4 * u * (1 - u); }
        else if (c < 2.3) st.sx *= Math.cos((c - 1.45) / 0.85 * TAU * 2);
        else st.sy *= 0.9;
      } else if (c >= 2.4 && !free) { st.rot += 10; st.fr = st.fr.replace(/_\d+$/, '_3'); }
      else if ((c < 0 || free) && !(S && S.held)) { const b = beatNow(), u = b % 1; st.y -= 6 * 4 * u * (1 - u); st.rot += (Math.floor(b) & 1 ? 6 : -6) * Math.sin(u * Math.PI); }
    }
    return st;
  }
  function drawActor(g, F, A, st, cam, t) {
    const r = F.R[st.fr]; if (!r || st.al <= 0.01 || st.sc <= 0.01) return null;
    const z = cam.z * st.sc, w = r[2] * z, h = r[3] * z, sx = (st.x - cam.vx) * cam.z + cam.ox, sy = (st.y - cam.vy) * cam.z + cam.oy, out = { x: sx, y: sy - h / 2, w, h };
    if (!A.air && !A.sil) { const gy = (st.gy - cam.vy) * cam.z + cam.oy, k = clamp(1 - (st.gy - st.y) / 36, 0.35, 1); g.fillStyle = `rgba(20,10,30,${(0.24 * st.al * k).toFixed(3)})`; g.beginPath(); g.ellipse(sx, gy - 1, w * 0.34 * k, Math.max(1, w * 0.07 * k), 0, 0, TAU); g.fill(); }
    g.save(); g.globalAlpha = st.al;
    if (A.piv === 'c') { g.translate(sx, sy - h / 2); g.rotate(st.rot * Math.PI / 180); g.scale(st.sx * (st.flip ? -1 : 1), st.sy); g.translate(0, h / 2); }
    else { g.translate(sx, sy); g.rotate(st.rot * Math.PI / 180); g.scale(st.sx * (st.flip ? -1 : 1), st.sy); }
    const mode = A.sil || A.tint;
    if (mode) g.drawImage(tinted(F, st.fr, mode), -w / 2, -h, w, h); else g.drawImage(F.img, r[0], r[1], r[2], r[3], -w / 2, -h, w, h);
    const e = F.eyes && F.eyes[st.fr];
    if (e && !A.sil && A.blink !== 0) {         // eyelids
      const shut = (A.sleep != null && t >= A.sleep) || ((t + hash(A.x && A.x.length ? 3 : (A.x || 1)) * 3) % 3.3) < 0.13, wink = A.wink && t >= A.wink[0] && t < A.wink[1];
      for (let i = 1; i < e.length; i++) if (shut || (wink && i === e.length - 1)) { const q = e[i], ex = (q[0] - r[2] / 2) * z, ey = (q[1] - r[3]) * z; g.fillStyle = A.tint === 'flour' ? '#f4f1ea' : e[0]; g.fillRect(ex, ey, q[2] * z, q[3] * z); g.fillStyle = 'rgba(40,20,20,.75)'; g.fillRect(ex, ey + (q[3] - 2) * z, q[2] * z, z); }
    }
    g.restore(); return out;
  }
  // ---- particles (film pixels)
  function burst(kind, x, y, n) {
    const P = S.parts; for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = Math.random(), p = { k: kind, x, y, age: 0, ph: Math.random() * 9 };
      if (kind === 'flour') Object.assign(p, { vx: Math.cos(a) * (30 + v * 190), vy: Math.sin(a) * (30 + v * 150) - 30, drag: 2.6, g: 26, life: rnd(0.8, 1.7), s: rnd(3, 9), c: '#ffffff' });
      else if (kind === 'pepper') Object.assign(p, { vx: rnd(-6, 26), vy: rnd(-22, -4), drag: 0.8, g: -3, life: rnd(1.6, 3.4), s: 1, c: Math.random() < 0.5 ? '#3d2a20' : '#6a4a35' });
      else if (kind === 'dust') Object.assign(p, { vx: Math.cos(a) * 34, vy: -Math.abs(Math.sin(a)) * 16, drag: 3, g: 0, life: rnd(0.4, 0.8), s: rnd(2, 4), c: '#e8dcc0' });
      else if (kind === 'star') Object.assign(p, { vx: Math.cos(a) * (20 + v * 60), vy: Math.sin(a) * (20 + v * 60) - 14, drag: 2.2, g: 20, life: rnd(0.6, 1.2), s: 1, c: Math.random() < 0.5 ? '#fff6a8' : '#ffffff' });
      else if (kind === 'heart') Object.assign(p, { x: x + rnd(-20, 20), y: y + rnd(-8, 8), vx: rnd(-8, 8), vy: rnd(-34, -16), drag: 0.4, g: 0, life: rnd(1.1, 1.9), s: Math.random() < 0.4 ? 2 : 1, c: Math.random() < 0.5 ? '#ff6fa8' : '#ff9ac4' });
      else if (kind === 'note') Object.assign(p, { vx: rnd(-10, 10), vy: rnd(-30, -18), drag: 0.3, g: 0, life: rnd(1.2, 1.8), s: 1, c: ['#ffe36a', '#7be0ff', '#ff8ad0', '#9dff8a'][(Math.random() * 4) | 0] });
      else if (kind === 'conf') Object.assign(p, { x: x + rnd(-110, 110), y: y + rnd(-20, 10), vx: rnd(-14, 14), vy: rnd(10, 50), drag: 0.4, g: 26, life: rnd(1.6, 3), s: 2, c: ['#ff5d6c', '#ffd32a', '#35b84b', '#2b8cea', '#ff6fb7', '#ffffff'][(Math.random() * 6) | 0] });
      else if (kind === 'smoke') Object.assign(p, { vx: rnd(-22, -8), vy: rnd(-16, -6), drag: 1.2, g: -6, life: rnd(0.7, 1.2), s: rnd(3, 6), c: '#b9b9c2' });
      else if (kind === 'ring') Object.assign(p, { vx: -16 - i * 8, vy: -6, drag: 0.6, g: -4, life: 1.3, s: 4 + i * 3, c: '#e8e8f0' });
      else if (kind === 'crumb') Object.assign(p, { vx: Math.cos(a) * 40, vy: -30 - v * 40, drag: 0.6, g: 220, life: rnd(0.5, 0.9), s: Math.random() < 0.4 ? 2 : 1, c: Math.random() < 0.5 ? '#f3a7c8' : '#f7e2b5' });
      else if (kind === 'rock') Object.assign(p, { x: x + rnd(-40, 60), y: y + rnd(0, 40), vx: rnd(-10, 10), vy: rnd(0, 20), drag: 0.2, g: 120, life: rnd(0.8, 1.4), s: Math.random() < 0.5 ? 2 : 1, c: '#5a5f86' });
      else if (kind === 'tear') Object.assign(p, { vx: 0, vy: 6, drag: 0, g: 60, life: 1.2, s: 2, c: '#8fd3ff' });
      else if (kind === 'spark') Object.assign(p, { x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-6, 6), vy: rnd(2, 14), drag: 0.6, g: 8, life: rnd(0.5, 1.1), s: 1, c: Math.random() < 0.6 ? '#fff6a8' : '#ffffff' });
      else if (kind === 'zz') Object.assign(p, { vx: 7, vy: -11, drag: 0.1, g: 0, life: 2.2, s: 2, c: '#eaf2ff' });
      else if (kind === 'ripple') Object.assign(p, { vx: 0, vy: 0, drag: 0, g: 0, age: -i * 0.25, life: 1.4, s: 5, c: '#e6fbff' });
      P.push(p);
    }
    if (P.length > 420) P.splice(0, P.length - 420);
  }
  function stepParts(dt) { const P = S.parts; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.age += dt; if (p.age > p.life) { P.splice(i, 1); continue; } const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } }
  function drawParts(g) {
    for (const p of S.parts) {
      const u = p.age / p.life, a = u > 0.6 ? (1 - u) / 0.4 : 1;
      if (p.k === 'ripple') { if (p.age < 0) continue; g.strokeStyle = hexA(p.c, (0.85 * (1 - u)).toFixed(3)); g.lineWidth = 1; g.beginPath(); g.ellipse(p.x, p.y, p.s * (0.6 + u * 2.6), p.s * (0.6 + u * 2.6) * 0.3, 0, 0, TAU); g.stroke(); }
      else if (p.k === 'flour' || p.k === 'smoke' || p.k === 'dust') { g.fillStyle = hexA(p.c, (0.85 * a).toFixed(3)); const s = p.s * (0.6 + u * 0.8); g.beginPath(); g.arc(p.x, p.y, s / 2, 0, TAU); g.fill(); }
      else if (p.k === 'ring' || p.k === 'zz') { g.strokeStyle = hexA(p.c, (0.8 * a).toFixed(3)); g.lineWidth = 1; const s = p.k === 'zz' ? 1.5 + u * 5 : p.s * (0.5 + u * 1.3); g.beginPath(); g.ellipse(p.x, p.y, p.k === 'zz' ? s : s * 0.55, s, 0, 0, TAU); g.stroke(); }
      else if (p.k === 'heart') glyph(g, 'heart', p.x + Math.sin(p.age * 4 + p.ph) * 2, p.y, p.s, hexA(p.c, a.toFixed(3)));
      else if (p.k === 'note') glyph(g, 'note', p.x + Math.sin(p.age * 5 + p.ph) * 3, p.y, 1, hexA(p.c, a.toFixed(3)));
      else if (p.k === 'star' || p.k === 'spark') { if (Math.sin(p.age * 30 + p.ph) > -0.3) glyph(g, u < 0.5 && p.k === 'star' ? 'star' : 'spark', p.x, p.y, 1, hexA(p.c, a.toFixed(3))); }
      else if (p.k === 'conf') { g.fillStyle = p.c; g.fillRect(p.x + Math.sin(p.age * 7 + p.ph) * 3, p.y, 2, Math.floor(p.age * 9 + p.ph) & 1 ? 1 : 2); }
      else { g.fillStyle = hexA(p.c, a.toFixed(3)); g.fillRect(p.x, p.y, p.s, p.s); }
    }
  }
  // ---- effects that run for a whole shot
  function fxDraw(g, F, sh, f, t, dt, cam, pos, under) {
    const n = typeof f === 'string' ? f : f[0], W2S = (x, y) => [(x - cam.vx) * cam.z + cam.ox, (y - cam.vy) * cam.z + cam.oy];
    const UNDER = n === 'stars' || n === 'beams' || n === 'birds' || n === 'bats' || n === 'eyes' || n === 'speed' || n === 'flick' || n === 'glitter';
    if (UNDER !== under) return;
    if (n === 'glitter') {                    // twinkles on water: ['glitter', x0, y0, x1, y1, how many] in picture pixels
      for (let i = 0; i < f[5]; i++) { const a = Math.sin(t * (2 + hash(i) * 3) + i * 1.7); if (a < 0.55) continue; const p = W2S(lerp(f[1], f[3], hash(i + 21)), lerp(f[2], f[4], hash(i + 43))); glyph(g, a > 0.92 ? 'star' : 'spark', Math.round(p[0]), Math.round(p[1]), 1, `rgba(235,252,255,${(a * 0.95).toFixed(2)})`); }
      return;
    }
    if (n === 'mist') {                       // soft clouds of mist drifting across the mountain: ['mist', how many, alpha]
      const pf = S.mistC || (S.mistC = (() => { const c = cnv(64, 64), q = c.getContext('2d'), gr = q.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(250,252,255,.55)'); gr.addColorStop(1, 'rgba(250,252,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return c; })());
      for (let i = 0; i < f[1]; i++) { const w = 90 + hash(i + 3) * 90, x = ((hash(i) * 420 + t * (5 + hash(i + 2) * 9)) % 420) - w / 2 - 40, y = 12 + hash(i + 5) * 112 + Math.sin(t * 0.5 + i) * 4; g.globalAlpha = f[2] * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 2)); g.drawImage(pf, x, y - w * 0.15, w, w * 0.3); }
      g.globalAlpha = 1; return;
    }
    if (n === 'lamps') {                      // two big round eyes in the dark that blink, look at the visitor, then scurry off: ['lamps', x, y, from, till, size]
      if (t < f[3] || t > f[4] + 0.5) return;
      const k = clamp((t - f[3]) / 0.3, 0, 1) * clamp(1 - (t - f[4]) / 0.45, 0, 1), go = Math.max(0, t - f[4]), p = W2S(f[1] + go * go * 90, f[2] - go * 10), r = f[5] * cam.z, q = t - f[3], shut = Math.abs(q - 0.75) < 0.07 || Math.abs(q - 1.05) < 0.07, look = clamp((q - 0.4) * 2.5, 0, 1);
      for (const s of [-1, 1]) {
        const ex = p[0] + s * r * 1.3, ey = p[1];
        g.fillStyle = `rgba(255,214,80,${(0.2 * k).toFixed(3)})`; g.beginPath(); g.arc(ex, ey, r * 1.9, 0, TAU); g.fill();
        g.fillStyle = `rgba(250,200,60,${k.toFixed(3)})`; g.beginPath(); g.ellipse(ex, ey, r, shut ? r * 0.14 : r, 0, 0, TAU); g.fill();
        if (!shut) { const px = ex - look * r * 0.32; g.fillStyle = `rgba(24,16,10,${k.toFixed(3)})`; g.beginPath(); g.arc(px, ey + r * 0.08, r * 0.5, 0, TAU); g.fill(); g.fillStyle = `rgba(255,255,255,${k.toFixed(3)})`; g.fillRect(px - r * 0.3, ey - r * 0.38, Math.max(1, r * 0.3), Math.max(1, r * 0.3)); }
      }
      return;
    }
    if (n === 'stars') { for (let i = 0; i < f[2]; i++) { const a = Math.sin(t * (1.5 + hash(i) * 2.5) + i * 2.1); if (a > 0.25) glyph(g, a > 0.8 ? 'star' : 'spark', 8 + hash(i + 40) * (FW - 16), BAR + 3 + hash(i + 80) * f[1], 1, `rgba(255,255,235,${(a * 0.9).toFixed(2)})`); } }
    else if (n === 'fireflies') { for (let i = 0; i < f[1]; i++) { const x = 20 + hash(i) * 216 + Math.sin(t * 0.6 + i * 2) * 14, y = 40 + hash(i + 7) * 76 + Math.sin(t * 0.9 + i) * 8, a = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7); g.fillStyle = `rgba(255,246,140,${(0.16 * a).toFixed(3)})`; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = `rgba(255,250,190,${(0.3 + 0.7 * a).toFixed(3)})`; g.fillRect(x, y, 1, 1); } }
    else if (n === 'dust') { for (let i = 0; i < f[1]; i++) { const x = (hash(i) * FW + t * (3 + hash(i + 3) * 5)) % FW, y = 20 + hash(i + 11) * 100 + Math.sin(t * 0.7 + i) * 5; g.fillStyle = `rgba(255,250,225,${(0.2 + 0.2 * Math.sin(t * 1.3 + i)).toFixed(3)})`; g.fillRect(x, y, 1, 1); } }
    else if (n === 'fall') { g.fillStyle = f[2]; for (let i = 0; i < f[1]; i++) { const sp = 10 + hash(i + 5) * 22, x = (hash(i) * FW + Math.sin(t * 1.1 + i) * 6 + FW) % FW, y = (hash(i + 9) * FH + t * sp) % FH; g.globalAlpha = 0.5 + hash(i + 2) * 0.5; g.fillRect(x, y, hash(i + 4) < 0.3 ? 2 : 1, hash(i + 6) < 0.3 ? 2 : 1); } g.globalAlpha = 1; }
    else if (n === 'confetti') { if (t > f[1] && t < f[2] && Math.random() < dt * 12) burst('conf', 128, 0, 1); }
    else if (n === 'speed') { g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < f[1]; i++) { const y = 16 + hash(i) * 100, x = FW - ((t * (190 + hash(i + 2) * 160) + hash(i + 5) * 400) % 400); g.fillRect(x, y, 16 + hash(i + 8) * 22, 1); } }
    else if (n === 'trail') { const p = pos[f[1]]; if (p) { S.acc = (S.acc || 0) + dt * f[3]; while (S.acc > 1) { S.acc--; burst(f[2], p.x, p.y, 1); } } }
    else if (n === 'notes') { S.acc2 = (S.acc2 || 0) + dt * f[1] * 3; while (S.acc2 > 1) { S.acc2--; const q = pos.filter(Boolean); const p = q[(Math.random() * q.length) | 0]; if (p && !S.held) burst('note', p.x + rnd(-8, 8), p.y - p.h / 2, 1); } }
    else if (n === 'zz') { if (t > f[4]) { const k = Math.floor((t - f[4]) / f[3]), k0 = Math.floor((t - dt - f[4]) / f[3]); if (k !== k0 || t - dt <= f[4]) { const p = W2S(f[1], f[2]); burst('zz', p[0], p[1], 1); } } }
    else if (n === 'puffs') { if (t > f[5] && Math.random() < dt * 14) { const u = Math.random(), a = W2S(lerp(f[1], f[3], u), lerp(f[2], f[4], u)); burst('pepper', a[0], a[1], 1); } }
    else if (n === 'eyes') { if (t > f[3]) { const p = W2S(f[1], f[2]), open = ((t - f[3]) % 2.1) > 0.16, a = clamp((t - f[3]) * 3, 0, 1); if (open) { g.fillStyle = `rgba(255,214,90,${a})`; g.fillRect(p[0] - 5 * cam.z, p[1], 3 * cam.z, 2 * cam.z); g.fillRect(p[0] + 2 * cam.z, p[1], 3 * cam.z, 2 * cam.z); g.fillStyle = `rgba(60,20,10,${a})`; g.fillRect(p[0] - 4 * cam.z, p[1], cam.z, 2 * cam.z); g.fillRect(p[0] + 3 * cam.z, p[1], cam.z, 2 * cam.z); } } }
    else if (n === 'bats') { if (t > f[3]) for (let i = 0; i < 6; i++) { const q = t - f[3] - i * 0.12; if (q < 0 || q > 3.5) continue; const p = W2S(f[1], f[2]), x = p[0] + q * (26 + i * 9) * (i & 1 ? 1 : -0.8), y = p[1] - q * (12 + i * 4) + Math.sin(q * 9 + i) * 4; glyph(g, Math.floor(q * 9 + i) & 1 ? 'bat' : 'bat2', x, y, 1, '#0c0a1e'); } }
    else if (n === 'birds') { for (let i = 0; i < f[1]; i++) { const x = (hash(i) * 300 + t * (9 + i * 3)) % 300 - 20, y = 22 + hash(i + 3) * 26 + Math.sin(t * 1.5 + i) * 3; glyph(g, Math.floor(t * 5 + i) & 1 ? 'bird' : 'bird2', x, y, 1, 'rgba(40,40,70,.8)'); } }
    else if (n === 'flick') { const p = W2S(f[1], f[2]), r = f[3] * cam.z * (1 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23)), gr = g.createRadialGradient(p[0], p[1], 1, p[0], p[1], r); gr.addColorStop(0, hexA(f[4], 0.35)); gr.addColorStop(1, hexA(f[4], 0)); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); g.globalCompositeOperation = 'source-over'; }
    else if (n === 'beams') {                 // disco lights: coloured cones sweeping down from the mirror ball
      if (t < f[2] || S.held) return; const cols = ['#ff4d8d', '#4dd2ff', '#ffe14d', '#7dff6a', '#c77dff'], b = beatNow(), bp = pos[f[3]], ox = bp ? bp.x : FW / 2, oy = bp ? bp.y : 0; g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < f[1]; i++) { const a = Math.PI / 2 + Math.sin(t * (0.7 + i * 0.23) + i * 1.9) * 0.95, wd = 0.11, L = 190; g.fillStyle = hexA(cols[(i + Math.floor(b / 2)) % cols.length] || cols[0], 0.2); g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a - wd) * L, oy + Math.sin(a - wd) * L); g.lineTo(ox + Math.cos(a + wd) * L, oy + Math.sin(a + wd) * L); g.closePath(); g.fill(); }
      if (b % 1 < 0.12) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, FW, FH); } g.globalCompositeOperation = 'source-over';
    }
    else if (n === 'dizzy') { if (t > f[2] && t < f[3]) { const p = pos[f[1]]; if (p) for (let i = 0; i < 3; i++) { const a = t * 7 + i * TAU / 3; glyph(g, 'star', p.x + Math.cos(a) * 16, p.y - p.h / 2 - 4 + Math.sin(a) * 4, 1, '#fff6a8'); } } }
    else if (n === 'wash') { const a = kv(f[2], t, 0); if (a > 0.005) { g.globalCompositeOperation = 'lighter'; g.fillStyle = hexA(f[1], a); g.fillRect(0, 0, FW, FH); g.globalCompositeOperation = 'source-over'; } }
    else if (n === 'glow') { const p = pos[f[1]]; if (p) { const r = kv(f[2], t, 40), gr = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, r); gr.addColorStop(0, hexA(f[3], kv(f[4], t, 0.3))); gr.addColorStop(1, hexA(f[3], 0)); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, FW, FH); g.globalCompositeOperation = 'source-over'; } }
    else if (n === 'vig') { const gr = g.createRadialGradient(FW / 2, FH / 2, 50, FW / 2, FH / 2, 150); gr.addColorStop(0, 'rgba(8,4,20,0)'); gr.addColorStop(1, `rgba(8,4,20,${f[1]})`); g.fillStyle = gr; g.fillRect(0, 0, FW, FH); }
    else if (n === 'dark') {                  // night, with a pool of light around someone (the fairy's tiny light)
      const a = kv(f[1], t, 0.6); if (a < 0.01) return; const d = S.darkC || (S.darkC = cnv(FW / 2, FH / 2)), q = d.getContext('2d'), p = pos[f[2]];
      q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, d.width, d.height); q.fillStyle = `rgba(4,7,30,${a})`; q.fillRect(0, 0, d.width, d.height);
      if (p) { q.globalCompositeOperation = 'destination-out'; const r = (f[3] || 44) * (1 + 0.05 * Math.sin(t * 5)) / 2; for (const [k, al] of [[1, 0.35], [0.72, 0.5], [0.42, 1]]) { q.fillStyle = `rgba(0,0,0,${al})`; q.beginPath(); q.arc(Math.round(p.x / 2), Math.round(p.y / 2), r * k, 0, TAU); q.fill(); } }
      g.drawImage(d, 0, 0, FW, FH);
    }
  }
  function camOf(F, sh, t) {
    const P = F.R[sh.pic], c = sh.cam || [], u = EASE[c[6] || 'lin'](clamp(t / sh.D, 0, 1)), z0 = c[2] || 1, z = lerp(z0, c[5] || z0 * 1.06, u);
    const x0 = c[0] == null ? P[2] / 2 : c[0], y0 = c[1] == null ? P[3] / 2 : c[1], vw = FW / z, vh = FH / z;
    return { z, vw, vh, vx: clamp(lerp(x0, c[3] == null ? x0 : c[3], u) - vw / 2, 0, P[2] - vw), vy: clamp(lerp(y0, c[4] == null ? y0 : c[4], u) - vh / 2, 0, P[3] - vh), ox: 0, oy: 0 };
  }
  function drawShot(g, F, sh, t, dt) {
    const D = sh.D, P = F.R[sh.pic], cam = camOf(F, sh, t), z = cam.z, vw = cam.vw, vh = cam.vh;
    const k = S.shk; if (k && k.t < k.d) { const q = 1 - k.t / k.d; cam.ox = Math.sin(k.t * 71) * k.a * q; cam.oy = Math.cos(k.t * 53) * k.a * q * 0.7; }
    g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH); g.drawImage(F.img, P[0] + cam.vx, P[1] + cam.vy, vw, vh, cam.ox, cam.oy, FW, FH);
    const pos = [], A = sh.a || [], st = A.map(a => actorAt(a, t, D));
    A.forEach((a, i) => { const s = st[i]; pos[i] = { x: (s.x - cam.vx) * z + cam.ox, y: (s.y - cam.vy) * z + cam.oy - (F.R[s.fr] ? F.R[s.fr][3] * z * s.sc / 2 : 0), w: 0, h: F.R[s.fr] ? F.R[s.fr][3] * z * s.sc : 0 }; });
    for (const f of sh.fx || []) fxDraw(g, F, sh, f, t, dt, cam, pos, true);
    A.forEach((a, i) => drawActor(g, F, a, st[i], cam, t));
    if (sh.over != null) { const y = Math.max(cam.vy, sh.over), hh = cam.vy + vh - y; if (hh > 0) g.drawImage(F.img, P[0] + cam.vx, P[1] + y, vw, hh, cam.ox, cam.oy + (y - cam.vy) * z, FW, hh * z); }
    drawParts(g);
    for (const f of sh.fx || []) fxDraw(g, F, sh, f, t, dt, cam, pos, false);
    const fl = S.flash; if (fl) { const a = fl.t < fl.hold ? 1 : 1 - (fl.t - fl.hold) / fl.d; if (a > 0) { g.fillStyle = hexA(fl.c, a.toFixed(3)); g.fillRect(0, 0, FW, FH); } }
    const nx = F.shots[F.shots.indexOf(sh) + 1]; let a = 0, col = '#000000';             // ways in and out
    if (sh.tr === 'fade' && t < 0.45) a = 1 - t / 0.45; else if (sh.tr === 'white' && t < 0.7) { a = 1 - t / 0.7; col = '#ffffff'; } else if (nx && nx.tr === 'fade' && t > D - 0.35) a = 1 - (D - t) / 0.35;
    if (a > 0) { g.fillStyle = hexA(col, clamp(a, 0, 1).toFixed(3)); g.fillRect(0, 0, FW, FH); }
  }
  // the studio sting before every film: searchlights, a moon, and a star that swoops in and lands on it
  function drawLogo(g, t) {
    const C = S.common, P = C.R.logo, z = 1 + t * 0.035, vw = FW / z, vh = FH / z; g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH);
    g.drawImage(C.img, P[0] + (FW - vw) / 2, P[1] + (FH - vh) / 2, vw, vh, 0, 0, FW, FH);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) { const bx = i ? FW - 26 : 26, a = -Math.PI / 2 + (i ? -1 : 1) * (0.35 + Math.sin(t * 1.5 + i * 2) * 0.3), wd = 0.09, L = 200; g.fillStyle = 'rgba(255,240,190,.2)'; g.beginPath(); g.moveTo(bx, FH); g.lineTo(bx + Math.cos(a - wd) * L, FH + Math.sin(a - wd) * L); g.lineTo(bx + Math.cos(a + wd) * L, FH + Math.sin(a + wd) * L); g.closePath(); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const u = clamp((t - 0.45) / 1.35, 0, 1), e = EASE.out(u), sx = lerp(-20, 141, e), sy = lerp(30, 50, e) - Math.sin(u * Math.PI) * 44, land = t > 1.8;
    if (t > 0.45) { g.save(); g.translate(sx, sy + (land ? Math.sin((t - 1.8) * 5) * 1.2 : 0)); g.rotate(land ? Math.sin((t - 1.8) * 3) * 0.12 : (1 - e) * 9); const s = land ? 2 + Math.max(0, 0.7 - (t - 1.8) * 3) : 1 + e; glyph(g, 'big', 1, 1, s, '#b8791a'); glyph(g, 'big', 0, 0, s, '#ffd94a'); g.fillStyle = '#fff6c0'; g.fillRect(-s, -s * 2.5, s, s * 2); g.restore(); }
    for (let i = 0; i < 9; i++) { const a = Math.sin(t * 3 + i * 1.3); if (a > 0.5) glyph(g, 'star', 20 + hash(i) * 216, 12 + hash(i + 5) * 70, 1, `rgba(255,255,230,${a})`); }
    drawParts(g);
    const a = t < 0.4 ? 1 - t / 0.4 : t > LOGO - 0.4 ? 1 - (LOGO - t) / 0.4 : 0; if (a > 0) { g.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`; g.fillRect(0, 0, FW, FH); }
  }
  // the end: the picture closes in through a heart or a star, which then shines on its own
  function drawEnd(g, F, t, dt) {
    const sh = F.shots[F.shots.length - 1], kind = F.end || 'star', c = F.endAt || [FW / 2, FH / 2];
    if (t < 1.9) { drawShot(g, F, sh, sh.D - 0.001, 0); const u = EASE.in(clamp(t / 1.7, 0, 1)), r = lerp(190, 0, u); g.fillStyle = '#05030f'; g.beginPath(); g.rect(0, 0, FW, FH); if (r > 1) shapePath(g, kind, lerp(c[0], FW / 2, u), lerp(c[1], FH / 2, u), r); g.fill('evenodd'); }
    else {
      const up = S.up = clamp((S.up || 0) + (S.mode === 'rate' ? dt * 2 : -9), 0, 1), cy = FH / 2 + 2 - 26 * EASE.smooth(up);     // it moves up to make room for her stars
      g.fillStyle = '#05030f'; g.fillRect(0, 0, FW, FH); const q = t - 1.9, s = (34 - 12 * EASE.smooth(up)) * EASE.back(clamp(q / 0.5, 0, 1)) * (1 + 0.06 * Math.sin(q * 4));
      const gr = g.createRadialGradient(FW / 2, cy, 4, FW / 2, cy, 90); gr.addColorStop(0, hexA(F.tint, 0.3)); gr.addColorStop(1, hexA(F.tint, 0)); g.fillStyle = gr; g.fillRect(0, 0, FW, FH);
      g.fillStyle = F.tint; g.beginPath(); shapePath(g, kind, FW / 2, cy, s); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(FW / 2 - s * 0.32, cy - s * 0.32, s * 0.13, s * 0.2, -0.5, 0, TAU); g.fill();
      for (let i = 0; i < 12; i++) { const a = Math.sin(q * 3 + i * 1.7); if (a > 0.3) { const an = i / 12 * TAU + q * 0.3, d = 52 + hash(i) * 22; glyph(g, a > 0.8 ? 'star' : 'spark', FW / 2 + Math.cos(an) * d * 1.5, FH / 2 + Math.sin(an) * d * 0.72, 1, `rgba(255,255,235,${a})`); } }
    }
    drawParts(g);
  }
  function drawFilm(dt) {
    const g = S.fg; g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingEnabled = false; const F = S.film;
    if (S.seg === 'logo') drawLogo(g, S.t); else if (S.seg === 'shot') drawShot(g, F, F.shots[S.si], S.t, dt); else if (S.seg === 'end') drawEnd(g, F, S.t, dt);
    const b = BAR * S.bars; if (b > 0.05) { g.fillStyle = '#000'; g.fillRect(0, 0, FW, b); g.fillRect(0, FH - b, FW, b); }
  }

  // ---- the film's clock
  function enter(seg, si) {
    S.seg = seg; S.si = si || 0; S.t = 0; S.ei = 0; S.cue = 0; S.parts.length = 0; S.flash = null; S.shk = null; S.acc = S.acc2 = 0; const F = S.film;
    if (seg === 'logo') { S.D = LOGO; S.held = false; Seq.stop(); jingle([0, 7, 12, 16, 19, 24], 0.13, 'square'); later(60, () => jingle([-24, -17, -12, -12], 0.26, 'triangle')); }
    else if (seg === 'shot') {
      const sh = F.shots[S.si]; S.D = sh.D;
      if (!Seq.on) Seq.start(F.music, sh.mus || lastMus(F, S.si)); else if (sh.mus) Seq.set(sh.mus);
      if (!sh.E.some(e => e[1] === 'hold')) holdMusic(false);
    } else { S.D = ENDLEN; holdMusic(false); Seq.stop(); voStop(); jingle([0, 4, 7, 12, 16, 19, 24], 0.12, F.mood === 'gentle' ? 'triangle' : 'square'); fire('end'); if (S.skips <= 2) { S.owed = true; const st = store(); st.seen[F.id] = (st.seen[F.id] || 0) + 1; save(st); S.watched.push(F.id); } }
    sync();
  }
  function credit() { if (S && S.owed) { S.owed = false; try { window.did && window.did('movie'); } catch (e) { } } }      // a film watched to the end: tell the game (stickers, wishes)
  function lastMus(F, i) { for (; i >= 0; i--) if (F.shots[i].mus) return F.shots[i].mus; return Object.keys(F.music.parts)[0]; }
  function holdMusic(b) { S.held = Seq.held = !!b; }
  function nextSeg() {
    const F = S.film;
    if (S.seg === 'logo') return enter('shot', 0);
    if (S.seg === 'shot') return S.si + 1 < F.shots.length ? enter('shot', S.si + 1) : enter('end');
    rate();
  }
  function events(sh) {
    while (S.ei < sh.E.length && sh.E[S.ei][0] <= S.t) {
      const e = sh.E[S.ei++], k = e[1];
      if (k === 'vo') voPlay(e[2]); else if (k === 'sfx') snd(e[2]); else if (k === 'shake') S.shk = { a: e[2], d: e[3], t: 0 }; else if (k === 'flash') S.flash = { c: e[2], d: e[3], hold: e[4] || 0, t: 0 };
      else if (k === 'burst') { const c = camOf(S.film, sh, S.t); burst(e[2], (e[3] - c.vx) * c.z, (e[4] - c.vy) * c.z, e[5] || 8); }
      else if (k === 'say') fire(e[2]); else if (k === 'mus') Seq.set(e[2]); else if (k === 'hold') holdMusic(e[2]);
    }
  }
  function filmTick(dt) {
    S.t += dt; S.ft += dt; if (S.shk) S.shk.t += dt; if (S.flash) S.flash.t += dt; stepParts(dt);
    if (S.seg === 'shot') events(S.film.shots[S.si]);
    else if (!S.cue && S.t >= 1.85) { S.cue = 1; if (S.seg === 'logo') { snd('sparkle'); burst('star', 141, 50, 16); } else snd('twinkle'); }      // the star lands on the moon / the heart pops out
    S.bars = clamp(S.bars + (S.seg === 'shot' ? dt * 1.6 : -dt * 1.2), 0, 1);
    if (S.t >= S.D) nextSeg();
  }
  // tell the room what just happened on screen; the two on the sofa react by themselves
  function fire(kind) {
    const h = S.heads; if (kind === 'funny') h.laugh = 1.5; else if (kind === 'scary') { h.jump = 0; h.leanTo = 1; h.leanT = 2.6; } else if (kind === 'sweet') { h.leanTo = 1; h.leanT = 3.2; S.sp.push({ k: 'heart', x: S.fgx + 65 * S.fs, y: S.fgTop + 18 * S.fs, vx: 0, vy: -70, g: 0, life: 1.8, age: 0, s: S.fs, c: '#ff6fa8' }); }
    else if (kind === 'end') { h.cheer = 3.4; confetti(46); }
    try { if (kind === 'funny' && typeof say === 'function' && Math.random() < 0.5) say('m_giggle'); } catch (e) { }
    try { if (typeof S.opts.onEvent === 'function') S.opts.onEvent(kind, S.film.id); } catch (e) { console.warn('movies onEvent', e); }
  }

  // ================================================================== the room: wall, dresser, TV, and the two on the sofa
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function ell(g, cx, cy, rx, ry, c, y0, y1) { g.fillStyle = c; for (let y = Math.ceil(cy - ry); y <= cy + ry; y++) { if ((y0 != null && y < y0) || (y1 != null && y > y1)) continue; const k = 1 - ((y - cy) / ry) ** 2; if (k < 0) continue; const w = Math.round(rx * Math.sqrt(k)); g.fillRect(Math.round(cx - w), y, w * 2 + 1, 1); } }
  const HAIRC = { brown: ['#7a4a26', '#5d3619', '#9c6535'], ginger: ['#7a4a26', '#5d3619', '#9c6535'], blonde: ['#f2cf6b', '#d3a94a', '#fae7a2'], black: ['#34303c', '#211e28', '#514b5e'], pink: ['#ff7ab8', '#dd5596', '#ffaad2'], blue: ['#4aa8ff', '#2f84d8', '#8cc8ff'], purple: ['#a46cf0', '#8049cc', '#c6a0ff'], green: ['#5fcf6a', '#3fa84b', '#96e69d'], rainbow: ['#ff7ab8', '#4aa8ff', '#ffe14d'] };
  let FGS = null;
  function fgSprites() {
    let hair = 'brown'; try { if (typeof G !== 'undefined' && G.hair && HAIRC[G.hair]) hair = G.hair; } catch (e) { }       // long brown hair, unless she has dyed it in the dress-up
    if (FGS && FGS.hair === hair) return FGS; const o = { hair };
    // Nunu: dark-blonde wavy bob, a cosy sage cardigan
    let c = cnv(64, 72), g = c.getContext('2d'); const B = ['#d2aa5c', '#b08a42', '#e9cb86'];
    ell(g, 32, 58, 29, 20, '#8fb08a', 38); ell(g, 32, 60, 27, 20, '#9fc09a', 40); px(g, 27, 30, 10, 9, '#efc6a4'); px(g, 27, 36, 10, 2, '#d9ab88'); px(g, 20, 39, 24, 2, '#7d9e78');
    ell(g, 32, 16, 16, 15.5, B[0]); px(g, 16, 16, 33, 13, B[0]); for (let i = 0; i < 7; i++) ell(g, 18 + i * 4.7, 29, 3, 3.2, i & 1 ? B[0] : B[1]);
    for (const [x, y0, y1] of [[21, 9, 27], [26, 4, 28], [38, 4, 28], [43, 9, 27]]) px(g, x, y0, 1, y1 - y0, B[1]); for (const [x, y0, y1] of [[23, 6, 24], [29, 2, 20], [35, 2, 22], [41, 7, 25]]) px(g, x, y0, 1, y1 - y0, B[2]);
    for (const [x, y, w] of [[22, 5, 5], [20, 6, 3], [19, 7, 2]]) px(g, x, y, w, 1, B[2]);
    px(g, 32, 1, 1, 9, B[1]); px(g, 15, 17, 2, 5, '#efc6a4'); px(g, 48, 17, 2, 5, '#efc6a4'); px(g, 15, 22, 1, 2, '#ffd94a'); px(g, 49, 22, 1, 2, '#ffd94a');
    o.nunu = c;
    // Marina: long hair down her back, a pink bow
    c = cnv(48, 72); g = c.getContext('2d'); const H = HAIRC[hair];
    ell(g, 24, 50, 20, 13, '#b79be8', 36); ell(g, 24, 52, 18, 13, '#c6adf2', 39);
    ell(g, 24, 13, 13, 12.5, H[0]); for (let y = 13; y < 62; y++) { const w = 13 + Math.min(3, (y - 13) / 9) + (y > 56 ? -(y - 56) * 0.9 : 0); px(g, Math.round(24 - w), y, Math.round(w * 2) + 1, 1, hair === 'rainbow' ? HAIRC.rainbow[Math.floor(y / 9) % 3] : H[0]); }
    for (const [x, y0, y1] of [[14, 12, 58], [20, 5, 61], [29, 5, 61], [35, 12, 58]]) px(g, x, y0, 1, y1 - y0, H[1]); for (const [x, y0, y1] of [[17, 8, 54], [24, 2, 50], [32, 8, 56]]) px(g, x, y0, 1, y1 - y0, H[2]);
    for (const [x, y, w] of [[15, 4, 5], [14, 5, 3], [13, 6, 2]]) px(g, x, y, w, 1, H[2]);
    px(g, 10, 14, 2, 4, '#f3cfae'); px(g, 37, 14, 2, 4, '#f3cfae');
    for (const [x, y, w, h] of [[28, 1, 4, 6], [36, 1, 4, 6], [32, 2, 4, 4]]) px(g, x, y, w, h, '#ff6fb7'); px(g, 33, 3, 2, 2, '#d94a94'); px(g, 28, 1, 4, 1, '#ffa6d6'); px(g, 36, 1, 4, 1, '#ffa6d6');
    o.marina = c;
    // popcorn bowl
    c = cnv(32, 28); g = c.getContext('2d');
    for (const [x, y, r] of [[8, 9, 4], [14, 6, 4.5], [20, 7, 4], [25, 10, 3.5], [11, 11, 4], [18, 11, 4.5], [5, 12, 3]]) ell(g, x, y, r, r, '#fff3c4'); for (const [x, y] of [[9, 8], [15, 5], [21, 6], [18, 10], [6, 12], [25, 10]]) px(g, x, y, 2, 2, '#ffe08a'); for (const [x, y] of [[12, 10], [22, 9], [16, 8]]) px(g, x, y, 1, 1, '#e9b84a');
    for (let y = 13; y < 28; y++) { const ins = Math.floor((y - 13) / 4); for (let x = 2 + ins; x < 30 - ins; x++) px(g, x, y, 1, 1, Math.floor((x - 1) / 4) & 1 ? '#f4f4ef' : '#e5352d'); } px(g, 1, 12, 30, 2, '#ff6a60'); px(g, 1, 12, 30, 1, '#ffb0a8');
    o.bowl = c;
    // sofa back (cream, like the den's sectional)
    c = cnv(170, 44); g = c.getContext('2d'); px(g, 0, 4, 170, 40, '#ece4d4'); px(g, 3, 1, 164, 4, '#ece4d4'); px(g, 1, 2, 168, 3, '#ece4d4'); px(g, 3, 1, 164, 1, '#fbf6ea'); px(g, 1, 2, 2, 1, '#fbf6ea'); px(g, 167, 2, 2, 1, '#fbf6ea');
    px(g, 0, 7, 170, 1, '#d6ccb8'); px(g, 84, 8, 2, 36, '#d6ccb8'); px(g, 86, 8, 1, 36, '#f6f0e2'); for (let i = 0; i < 26; i++) px(g, (hash(i) * 166) | 0, 10 + ((hash(i + 30) * 32) | 0), 2, 1, i & 1 ? '#e2d9c6' : '#f4eee0');
    o.sofa = c;
    // the blanket pulled up around them: pink plaid
    c = cnv(150, 64); g = c.getContext('2d');
    const top = x => { const a = 30 - 13 * Math.exp(-(((x - 42) / 20) ** 2)), b = 30 - 21 * Math.exp(-(((x - 98) / 25) ** 2)); return Math.round(Math.min(a, b) + Math.max(0, (14 - x) * 1.1) + Math.max(0, (x - 136) * 1.1)); };
    for (let x = 0; x < 150; x++) for (let y = top(x); y < 64; y++) { const sx = (x + Math.round((y - top(x)) * 0.12)) % 12 < 2, sy = (y - top(x)) % 12 >= 9 && (y - top(x)) % 12 < 11; px(g, x, y, 1, 1, y === top(x) ? '#ffc4d8' : sx && sy ? '#fbe3ea' : sx || sy ? '#cf6c8f' : '#e98fae'); }
    o.blanket = c;
    // each one again as it looks in the dark, and the thin edge the TV lights up
    for (const k of ['nunu', 'marina', 'bowl', 'sofa', 'blanket']) {
      const s = o[k], d = cnv(s.width, s.height), q = d.getContext('2d'); q.drawImage(s, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(14,10,38,.6)'; q.fillRect(0, 0, s.width, s.height); o[k + 'D'] = d;
      const r = cnv(s.width, s.height), rq = r.getContext('2d'); try { const a = s.getContext('2d').getImageData(0, 0, s.width, s.height).data; rq.fillStyle = '#fff'; for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (a[(y * s.width + x) * 4 + 3] > 40 && (y === 0 || a[((y - 1) * s.width + x) * 4 + 3] < 40)) rq.fillRect(x, y, 1, 1); } catch (e) { } o[k + 'R'] = r;
    }
    return (FGS = o);
  }
  const SWAN = ['.....##..', '....#..#.', '....#....', '.....#...', '..####...', '.#######.', '.#######.', '..#####..'], SUN = ['#..#..#', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '#..#..#'];
  function paintRoom() {
    const W = S.Wap, H = S.Hap, c = S.room = cnv(W, H), g = c.getContext('2d'), tx = S.tvX, ty = S.tvY, tb = ty + TVH, fl = tb + 50, sh = 'rgba(40,30,20,.16)';
    px(g, 0, 0, W, H, '#e9e4d9');
    if (ty > 46) {           // room above the TV: the low beamed ceiling and a few family pictures
      px(g, 0, 0, W, 9, '#f5f4ef'); px(g, 0, 9, W, 1, sh); for (let x = 22; x < W; x += 74) { px(g, x, 0, 11, 12, '#eceae2'); px(g, x, 12, 11, 1, sh); }
      const fy = Math.round(ty / 2) - 4, frames = [[W / 2 - 62, 30, 24, '#3c6f8f', SWAN, '#ffffff'], [W / 2 - 16, 32, 28, '#fbf3df', GL.heart, '#ff6fa8'], [W / 2 + 34, 30, 24, '#bfe3f0', SUN, '#ffcf4a']];
      for (const [x, w, h, bg, art, col] of frames) { const y = fy - h / 2 + 6; px(g, x - 2, y - 2, w + 4, h + 4, '#b98a4e'); px(g, x - 2, y + h + 2, w + 4, 1, sh); px(g, x, y, w, h, bg); const s = 2; g.fillStyle = col; for (let j = 0; j < art.length; j++) for (let i = 0; i < art[j].length; i++) if (art[j][i] === '#') g.fillRect(Math.round(x + w / 2 - art[j].length * s / 2 + i * s), Math.round(y + h / 2 - art.length * s / 2 + j * s), s, s); }
    }
    const wy = tb - 34; px(g, 0, wy, W, fl - wy, '#f7f6f1'); for (let y = wy + 7; y < fl; y += 8) px(g, 0, y, W, 1, 'rgba(60,50,40,.10)'); px(g, 0, wy - 4, W, 4, '#fdfcf8'); px(g, 0, wy, W, 1, sh);
    px(g, 0, fl, W, H - fl, '#d8c39b'); for (let y = fl; y < H; y += 9) { px(g, 0, y, W, 1, '#bfa67a'); for (let k = 0; k < 5; k++) px(g, (hash(y + k) * W) | 0, y, 1, 9, '#bfa67a'); } px(g, 0, fl - 4, W, 4, '#fbfbf7'); px(g, 0, fl, W, 1, sh);
    if (H - fl > 40) { const ry = fl + 22, rw = W * 0.42; ell(g, W / 2, ry + 16, rw, 15, '#c9788c'); ell(g, W / 2, ry + 16, rw - 6, 11, '#f0d9c2'); ell(g, W / 2, ry + 16, rw - 14, 7, '#d99aa8'); }
    const dx = tx + 16, dw = TVW - 32, dy = tb + 2, dh = fl - dy + 2;                                              // the pine dresser
    px(g, dx, dy + 4, dw, dh - 4, '#d39a48'); px(g, dx - 3, dy, dw + 6, 5, '#e6b866'); px(g, dx - 3, dy, dw + 6, 1, '#f4d28e'); px(g, dx - 3, dy + 4, dw + 6, 1, '#9a6628'); px(g, dx, dy + dh - 2, dw, 2, '#9a6628'); px(g, dx + 4, dy + dh, 5, 3, '#8a5a22'); px(g, dx + dw - 9, dy + dh, 5, 3, '#8a5a22');
    for (let i = 0; i < 3; i++) { const x = dx + 5 + i * ((dw - 10) / 3), w = (dw - 10) / 3 - 4; px(g, x, dy + 9, w, dh - 15, '#c68c3c'); px(g, x, dy + 9, w, 1, '#e1ae5c'); px(g, x, dy + dh - 7, w, 1, '#9a6628'); px(g, x + w / 2 - 2, dy + 9 + (dh - 15) / 2 - 1, 4, 3, '#7a4c1a'); for (let k = 0; k < 4; k++) px(g, x + 3 + hash(i * 9 + k) * (w - 12), dy + 13 + k * ((dh - 22) / 4), 6, 1, '#b97f32'); }
    px(g, tx + 40, tb - 1, 20, 3, '#101014'); px(g, tx + TVW - 60, tb - 1, 20, 3, '#101014');                    // the TV: feet, case
    px(g, tx, ty, TVW, TVH, '#15141a'); px(g, tx + 1, ty + 1, TVW - 2, 1, '#34323e'); px(g, tx + 1, ty + TVH - 2, TVW - 2, 1, '#0a0a0e'); px(g, tx, ty, 1, 1, '#e9e4d9'); px(g, tx + TVW - 1, ty, 1, 1, '#e9e4d9');
    px(g, tx + BEZ, ty + BEZ, FW, FH, '#07070c');
  }
  function layout() {
    if (!S) return; const land = innerWidth > innerHeight; S.land = land; S.top.classList.toggle('mv-land', land); S.body.classList.toggle('mv-land', land);
    const w = S.body.clientWidth, h = S.body.clientHeight; if (w < 20 || h < 20) return;
    // the shelf: as many posters to a row as makes them biggest (five: 2 + 2 + 1 upright, all five in a row sideways); a short last row sits in the middle
    const n = FILMS.length, gap = 12; let best = null;
    for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols), pw = Math.floor(Math.min((w - gap * (cols + 1)) / cols, ((h - gap * (rows + 1)) / rows - 30) * 0.75)); if (!best || pw > best.pw) best = { cols, pw }; }
    const pw = Math.max(60, best.pw); S.shelf.style.setProperty('--pw', pw + 'px'); S.shelf.style.paddingLeft = S.shelf.style.paddingRight = Math.max(0, Math.floor((w - (best.cols * pw + (best.cols - 1) * gap)) / 2) - 4) + 'px';
    // the cinema: the TV as wide (or as tall) as the screen allows
    const ap = Math.min(w / (TVW + 4), h / (TVH + 28)), Wap = Math.round(w / ap), Hap = Math.round(h / ap); Object.assign(S, { ap, Wap, Hap, cw: w, ch: h });
    S.cv.width = Wap * K; S.cv.height = Hap * K; S.cv.style.width = w + 'px'; S.cv.style.height = h + 'px'; S.g = S.cv.getContext('2d'); S.g.imageSmoothingEnabled = false;
    S.tvX = Math.floor((Wap - TVW) / 2); const free = Hap - TVH; S.tvY = free > 120 ? Math.round(clamp(free * 0.2, 40, 90)) : 2;
    const line = (S.tvY + TVH - 13) * K;              // the heads may rise this high: over the TV's lower edge and the black bar, not over the story
    S.fs = clamp(Math.floor(Math.min(Wap * K / 132, (Hap * K - line) / 28)), 3, 8); S.fgTop = Math.max(Hap * K - 84 * S.fs, line); S.fgx = Math.round(Wap * K / 2 - 65 * S.fs);
    S.bowlY = Hap * K - S.fgTop > 60 * S.fs ? 25 : 20;          // the bowl rests on the sofa back when there is room to see it, and is held up a little higher when only heads show
    paintRoom(); place();
  }
  function place() {         // the DOM bits that sit on top of the canvas
    const k = S.cw / (S.Wap * K), bx = (S.fgx + 65 * S.fs) * k, by = (S.fgTop + (S.bowlY + 8) * S.fs) * k, bw = Math.max(68, 34 * S.fs * k), bh = Math.max(66, 30 * S.fs * k);
    const top = clamp(by - bh / 2, 0, S.ch - bh); Object.assign(S.pop.style, { left: (bx - bw / 2) + 'px', top: top + 'px', width: bw + 'px', height: bh + 'px' });
    S.rateEl.style.top = ((S.tvY + TVH * 0.7) * K * k - 32) + 'px';
  }

  // ---- the two on the sofa, the popcorn, the blanket
  function confetti(n) { const cols = ['#ff5d6c', '#ffd32a', '#35b84b', '#2b8cea', '#ff6fb7', '#ffffff']; for (let i = 0; i < n; i++) S.sp.push({ k: 'conf', x: rnd(0, S.cv.width), y: rnd(-S.cv.height * 0.3, 0), vx: rnd(-30, 30), vy: rnd(60, 200), g: 120, life: rnd(2, 3.6), age: 0, s: S.fs, c: cols[i % cols.length], ph: Math.random() * 9 }); }
  function munch() {
    if (!S || S.mode === 'pick') return; wake(); const fs = S.fs, bx = S.fgx + 65 * fs, by = S.fgTop + (S.bowlY + 9) * fs, now = performance.now(); S.pops++; S.bowlT = 0;
    for (let i = 0; i < 6; i++) { const to = i === 0 ? -1 : i === 1 ? 1 : 0; S.sp.push({ k: 'corn', x: bx + rnd(-8, 8) * fs, y: by, vx: to ? to * rnd(40, 50) * fs : rnd(-34, 34) * fs, vy: -rnd(70, 120) * fs, g: 300 * fs, life: to ? 0.62 : 1.3, age: 0, s: fs * 2, c: i & 1 ? '#fff3c4' : '#ffe08a', ph: Math.random() * 9, rot: rnd(-8, 8) }); }
    S.heads.munch = 0.25; if (S.film && now - (S.popEv || 0) > 9000) { S.popEv = now; try { if (typeof S.opts.onEvent === 'function') S.opts.onEvent('popcorn', S.film.id); } catch (e) { } }
    if (now - (S.popAt || 0) > 110) { S.popAt = now; sfx('eat_chomp', { vol: 0.8 }); noise(0.07, 0.3, 2400); blip(14 + ((Math.random() * 8) | 0), 'square', 0.03, 0.08); }
  }
  function toggleBlanket() { S.blanket = !S.blanket; whoosh(S.blanket); S.blB.classList.toggle('on', S.blanket); if (S.blanket) { S.heads.leanTo = 1; S.heads.leanT = 2; } const st = store(); st.blanket = S.blanket ? 1 : 0; save(st); }
  function drawFg(g, dt) {
    const o = fgSprites(), fs = S.fs, T = S.T, h = S.heads, d = S.dim, x0 = S.fgx, y0 = S.fgTop, glow = S.glow;
    h.lean += clamp(h.leanTo - h.lean, -dt * 2.2, dt * 2.2); if (h.leanT > 0 && (h.leanT -= dt) <= 0) h.leanTo = 0;
    for (const k of ['laugh', 'cheer']) h[k] = Math.max(0, h[k] - dt); if (h.jump >= 0) { h.jump += dt; if (h.jump > 0.6) h.jump = -1; } if (h.munch > -1) h.munch -= dt;
    const part = (name, x, y, rot, ox, oy) => {       // one sprite: lit, then its dark twin over it as the lights go down, then the TV's glow along its top edge
      const s = o[name]; g.save(); g.translate(Math.round(x0 + x * fs), Math.round(y0 + y * fs)); if (rot) g.rotate(rot); g.translate(-ox * fs, -oy * fs);
      g.drawImage(s, 0, 0, s.width * fs, s.height * fs); if (d > 0.01) { g.globalAlpha = d; g.drawImage(o[name + 'D'], 0, 0, s.width * fs, s.height * fs); }
      if (d > 0.3 && S.tvOn > 0.5) { const r = S.rimC || (S.rimC = cnv(170, 72)), q = r.getContext('2d'); q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, 170, 72); q.drawImage(o[name + 'R'], 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = `rgb(${glow[0]},${glow[1]},${glow[2]})`; q.fillRect(0, 0, 170, 72); g.globalAlpha = 0.75 * d; g.globalCompositeOperation = 'lighter'; g.drawImage(r, 0, 0, s.width, s.height, 0, 0, s.width * fs, s.height * fs); }
      g.restore();
    };
    const jm = h.jump >= 0 ? Math.sin(Math.min(1, h.jump / 0.45) * Math.PI) : 0, la = h.laugh > 0 ? Math.sin(T * 24) * Math.min(1, h.laugh * 2) : 0, ch = h.cheer > 0 ? Math.abs(Math.sin(T * 7.5)) * Math.min(1, h.cheer) : 0, mu = h.munch > -0.55 && h.munch < 0 ? Math.abs(Math.sin(h.munch * 17)) : 0;
    const my = 8 + Math.sin(T * 1.25) * 0.5 - jm * 6 + la * 0.9 - ch * 5 + mu * 1.3, ny = Math.sin(T * 1.05 + 2) * 0.5 - jm * 3.5 + la * 0.7 - ch * 3.5 + mu * 1.1, bl = (S.bl += clamp((S.blanket ? 1 : 0) - S.bl, -dt * 3, dt * 3));
    if (h.cheer > 0) for (const [cx, cy, sl, len] of [[26, my + 30, '#c6adf2', 16], [58, my + 30, '#c6adf2', 16], [76, ny + 34, '#9fc09a', 22], [120, ny + 34, '#9fc09a', 22]]) {      // arms up!
      const a = Math.sin(T * 9 + cx) * 0.25 + (cx < 40 || (cx > 70 && cx < 100) ? -0.3 : 0.3); g.save(); g.translate(x0 + cx * fs, y0 + cy * fs); g.rotate(a); g.fillStyle = sl; g.fillRect(-2.5 * fs, -len * fs, 5 * fs, len * fs); g.fillStyle = '#f3cfae'; g.fillRect(-3 * fs, (-len - 5) * fs, 6 * fs, 6 * fs); g.fillStyle = `rgba(14,10,38,${(0.6 * d).toFixed(3)})`; g.fillRect(-3 * fs, (-len - 5) * fs, 6 * fs, (len + 5) * fs); g.restore(); }
    part('marina', 40 + h.lean * 3, my + 36, h.lean * 0.16 + la * 0.03, 24, 36); part('nunu', 96 - h.lean * 2.5, ny + 40, -h.lean * 0.1 - la * 0.025, 32, 40);
    S.bowlT += dt; const bj = S.bowlT < 0.3 ? Math.sin(S.bowlT * 40) * (0.3 - S.bowlT) * 6 : 0; part('bowl', 65 + bj * 0.4, S.bowlY + bj, 0, 16, 0);
    part('sofa', 65, 52, 0, 85, 0);
    const sy = y0 + 96 * fs, H = S.cv.height; if (sy < H) { const x = Math.round(x0 - 20 * fs); g.drawImage(o.sofa, 0, 36, 170, 8, x, sy, 170 * fs, H - sy); if (d > 0.01) { g.globalAlpha = d; g.drawImage(o.sofaD, 0, 36, 170, 8, x, sy, 170 * fs, H - sy); g.globalAlpha = 1; } }
    if (bl > 0.01) part('blanket', 65, 10 + (1 - EASE.out(bl)) * 50, 0, 75, 0);
    if (bl > 0.5) part('bowl', 65 + bj * 0.4, S.bowlY + bj, 0, 16, 0);
  }
  function drawSp(g, dt) {
    const P = S.sp, fs = S.fs; for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; if (p.age > p.life) { P.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; const u = p.age / p.life;
      if (p.k === 'corn') { g.save(); g.translate(p.x, p.y); g.rotate(p.age * p.rot); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.fillStyle = '#fffbe8'; g.fillRect(-p.s / 2, -p.s, p.s / 2, p.s / 2); g.fillRect(0, -p.s / 4, p.s * 0.75, p.s / 2); g.restore(); }
      else if (p.k === 'heart') glyph(g, 'heart', p.x + Math.sin(p.age * 4) * fs * 2, p.y, p.s, hexA(p.c, u > 0.6 ? (1 - u) / 0.4 : 1));
      else if (p.k === 'star') { g.fillStyle = hexA(p.c, 1 - u); g.beginPath(); shapePath(g, 'star', p.x, p.y, p.s * (1 + u)); g.fill(); }
      else { g.fillStyle = p.c; g.fillRect(p.x + Math.sin(p.age * 7 + p.ph) * fs * 2, p.y, p.s, Math.floor(p.age * 9 + p.ph) & 1 ? p.s / 2 : p.s); }
    }
  }
  function drawStage(dt) {
    const g = S.g, W = S.cv.width, H = S.cv.height, d = S.dim, tx = (S.tvX + BEZ) * K, ty = (S.tvY + BEZ) * K, sw = FW * K, sh = FH * K;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.drawImage(S.room, 0, 0, W, H);
    if (d > 0.01) { g.fillStyle = `rgba(9,7,26,${(d * 0.78).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    const on = S.tvOn;
    if (on > 0.02 && d > 0.05) {                      // the TV lights the wall and the dresser top
      const c = S.glow, cx = tx + sw / 2, cy = ty + sh / 2, r = sw * 0.95, gr = g.createRadialGradient(cx, cy, sw * 0.3, cx, cy, r); gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.5 * d * on).toFixed(3)})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    }
    if (S.tvY > 46) for (let i = 0; i < 9; i++) {      // fairy lights along the ceiling stay on
      const x = (16 + i * (S.Wap - 32) / 8) * K, y = (15 + Math.sin(i * 1.9) * 2 + (i & 1 ? 2 : 0)) * K, col = ['#ffd27a', '#ff9ac4', '#9ad8ff', '#b6f09a'][i % 4], a = 0.7 + 0.3 * Math.sin(S.T * 2 + i * 1.3);
      g.fillStyle = hexA(col, 0.16 * a); g.fillRect(x - 3 * K, y - 3 * K, 7 * K, 7 * K); g.fillStyle = hexA(col, a); g.fillRect(x, y, K, K * 2); g.fillStyle = 'rgba(60,50,40,.5)'; g.fillRect(x, y - K, K, K);
    }
    g.fillStyle = '#15141a'; g.fillRect(S.tvX * K, S.tvY * K, TVW * K, TVH * K); g.fillStyle = '#34323e'; g.fillRect((S.tvX + 1) * K, (S.tvY + 1) * K, (TVW - 2) * K, K); g.fillStyle = '#07070c'; g.fillRect(tx, ty, sw, sh);
    if (on > 0.02) {
      const hh = Math.max(K, Math.round(sh * EASE.out(clamp((on - 0.25) / 0.75, 0, 1)))), ww = Math.round(sw * clamp(on / 0.25, 0.05, 1));
      if (on < 0.999) { g.fillStyle = '#fff'; g.fillRect(tx + (sw - ww) / 2, ty + (sh - hh) / 2 - K, ww, hh + 2 * K); }
      if (on > 0.3) g.drawImage(S.fc, 0, 0, sw, sh, tx + (sw - ww) / 2, ty + (sh - hh) / 2, ww, hh);
      g.fillStyle = 'rgba(0,0,0,.09)'; for (let y = ty; y < ty + sh; y += K) g.fillRect(tx, y + K - 1, sw, 1);
    } else if (S.spin) { for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * Math.max(0, Math.sin(S.T * 6 - i * 0.9))})`; g.fillRect(tx + sw / 2 + (i - 1) * 14 * K - 3 * K, ty + sh / 2 - 3 * K, 6 * K, 6 * K); } }
    if (S.paused && S.mode === 'film') { g.fillStyle = 'rgba(5,3,15,.45)'; g.fillRect(tx, ty, sw, sh); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(tx + sw / 2 - 16 * K, ty + sh / 2 - 18 * K, 11 * K, 36 * K); g.fillRect(tx + sw / 2 + 5 * K, ty + sh / 2 - 18 * K, 11 * K, 36 * K); }
    g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + sw * 0.34, ty); g.lineTo(tx + sw * 0.1, ty + sh); g.lineTo(tx, ty + sh); g.closePath(); g.fill();
    g.fillStyle = on > 0.5 ? '#5cff7a' : '#ff5d5d'; g.fillRect((S.tvX + TVW - 9) * K, (S.tvY + TVH - 4) * K, 2 * K, 2 * K);
    drawFg(g, dt); drawSp(g, dt);
  }
  function sampleGlow() {            // the colour the screen is throwing into the room
    if (S.tvOn < 0.5) return; const q = S.avg || (S.avg = cnv(4, 4).getContext('2d', { willReadFrequently: true })); let r = 0, gg = 0, b = 0;
    try { q.drawImage(S.fc, 0, 0, 4, 4); const d = q.getImageData(0, 0, 4, 4).data; for (let i = 0; i < 64; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } } catch (e) { return; }
    const t = [r / 16 * 0.8 + 50, gg / 16 * 0.8 + 50, b / 16 * 0.8 + 56]; for (let i = 0; i < 3; i++) S.glow[i] = Math.round(lerp(S.glow[i], Math.min(255, t[i]), 0.25));
  }

  // ================================================================== the screens: shelf, cinema, stars
  function store() { let o = null; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { } if (!o || typeof o !== 'object') o = {}; o.seen = o.seen || {}; o.stars = o.stars || {}; return o; }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
  function css() {
    if (document.getElementById('mv-css')) return; const s = document.createElement('style'); s.id = 'mv-css';
    s.textContent = `
.mv-off{display:none!important}
#panel.mv-on{background:#1b1430}
.mv-top .pbtn{flex:0 0 auto;width:60px;padding:0;position:relative}
.mv-top .mv-bl canvas{width:44px;height:44px;image-rendering:pixelated;pointer-events:none;display:block;margin:auto}
#panel>.mv-top.mv-land{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));width:60px;flex-direction:column;gap:6px;z-index:2}
#panel>.mv-top.mv-land .ttl{flex:0 0 auto;font-size:28px}
#panel>.mv-top.mv-land .mv-bl{position:fixed;right:calc(8px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top))}
.mv-body{position:relative;flex:1 1 auto;min-height:0;min-width:0;margin-top:6px;border-radius:12px;overflow:hidden}
#panel>.mv-body.mv-land{margin:0 68px}
.mv-cv{display:block;position:absolute;left:0;top:0;image-rendering:pixelated;border-radius:12px}
.mv-hit{position:absolute;margin:0;padding:0;border:0;background:transparent;border-radius:40%;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mv-shelf{position:absolute;inset:0;display:flex;flex-wrap:wrap;gap:12px;align-content:center;justify-content:center;box-sizing:border-box;background:linear-gradient(#3b2a52,#241a38)}
.mv-post{position:relative;flex:0 0 auto;width:var(--pw);margin:0;padding:0 0 30px;background:transparent;display:block;animation:mv-bob 1.6s ease-in-out infinite alternate}
.mv-post:nth-child(2){animation-delay:-.5s}.mv-post:nth-child(3){animation-delay:-1s}.mv-post:nth-child(4){animation-delay:-1.4s}.mv-post:nth-child(5){animation-delay:-.8s}
.mv-post.mv-fav canvas{border-color:#ffd65a;box-shadow:0 6px 0 rgba(0,0,0,.4),0 0 18px 4px rgba(255,214,90,.55)}
.mv-post s{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;z-index:1;pointer-events:none;background:radial-gradient(circle,#fffbe6 0 14%,#ffe27a 24%,rgba(255,214,90,0) 62%);clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);animation:mv-tw 1.4s ease-in-out infinite}
@keyframes mv-tw{0%,100%{transform:scale(.3) rotate(0);opacity:.35}50%{transform:scale(1.1) rotate(45deg);opacity:1}}
.mv-post canvas{display:block;width:100%;aspect-ratio:3/4;image-rendering:pixelated;border:5px solid #fff6dc;border-radius:10px;box-sizing:border-box;background:#3a2a55;box-shadow:0 6px 0 rgba(0,0,0,.4)}
.mv-post::after{content:"";position:absolute;left:-6px;right:-6px;bottom:8px;height:12px;border-radius:4px;background:linear-gradient(#c8924a,#9a6628);box-shadow:0 4px 0 rgba(0,0,0,.35)}
.mv-post i{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-style:normal;font-size:15px;line-height:1;letter-spacing:-2px;z-index:1;text-shadow:0 2px 0 rgba(0,0,0,.4)}
.mv-post b{position:absolute;inset:5px 5px 35px;display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:400}
.mv-post.mv-go{animation:mv-go .32s ease-in both}
@keyframes mv-bob{to{transform:translateY(-5px) rotate(.6deg)}}
@keyframes mv-go{60%{transform:scale(1.12) rotate(-2deg)}to{transform:scale(1.04)}}
.mv-rate{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:4px;z-index:2}
.mv-star{width:64px;height:64px;margin:0;padding:0;background:transparent;font-size:44px;line-height:64px;filter:grayscale(1) brightness(.75);opacity:.6;transition:transform .12s;-webkit-tap-highlight-color:transparent;animation:mv-bob .7s ease-in-out infinite alternate}
.mv-star.on{filter:none;opacity:1;transform:scale(1.14)}
.mv-star:nth-child(2n){animation-delay:-.35s}
#app:has(.mv-body) #wishBtn,#app:has(.mv-body) #reqBtn{display:none}
@media (max-width:360px){.mv-star{width:60px;height:60px;font-size:38px}.mv-rate{gap:1px}}
`;
    document.head.append(s);
  }
  const tap = (cls, txt, label, fn, ev) => { const b = mk('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener(ev || 'pointerup', e => { e.stopPropagation(); if (S) fn(b, e); }); return b; };
  function blanketIcon() { const c = cnv(16, 16), g = c.getContext('2d'); for (let y = 3; y < 14; y++) for (let x = 1; x < 15; x++) px(g, x, y, 1, 1, (x % 5 === 2) && (y % 5 === 0) ? '#fbe3ea' : x % 5 === 2 || y % 5 === 0 ? '#cf6c8f' : '#e98fae'); px(g, 1, 8, 14, 1, '#a94c70'); px(g, 1, 3, 14, 1, '#ffc4d8'); px(g, 0, 4, 1, 9, '#a94c70'); px(g, 15, 4, 1, 9, '#a94c70'); px(g, 1, 14, 14, 1, '#a94c70'); return c; }

  function open(opts) {
    const panel = document.getElementById('panel'); if (!panel) return false;
    if (S) { quiet(); teardown(); }
    try { UI.closeActions(); } catch (e) { } try { clearWish(); } catch (e) { }
    css(); panel.innerHTML = ''; panel.classList.remove('hidden'); panel.classList.add('mv-on'); const st = store();
    S = { opts: opts || {}, panel, mode: 'pick', film: null, seg: null, si: 0, t: 0, D: 1, ft: 0, T: 0, ei: 0, paused: false, held: false, bars: 0, parts: [], sp: [], dim: 0, dimTo: 0, tvOn: 0, glow: [120, 130, 160], blanket: !!st.blanket, bl: st.blanket ? 1 : 0, pops: 0, bowlT: 9, watched: [], last: performance.now(),
      heads: { lean: 0, leanTo: 0, leanT: 0, laugh: 0, cheer: 0, jump: -1, munch: -1 }, fc: cnv(FW * K, FH * K), tok: 0 };
    S.fg = S.fc.getContext('2d');
    // top row: ❌ first (the sideways ❌ and the rest of the game look for it there), then the film's buttons
    const top = S.top = mk('div', 'ptop mv-top');
    S.playB = tap('pbtn', '⏸️', 'pause', togglePause); S.nextB = tap('pbtn', '⏭️', 'next', skip); S.stopB = tap('pbtn', '⏹️', 'shelf', () => toShelf(true)); S.ttl = mk('div', 'ttl', '🎬');
    S.blB = tap('pbtn mv-bl', '', 'blanket', toggleBlanket); S.blB.append(blanketIcon()); S.blB.classList.toggle('on', S.blanket);
    top.append(tap('pbtn', '❌', 'close', () => finish()), S.playB, S.nextB, S.stopB, S.ttl, S.blB);
    const body = S.body = mk('div', 'mv-body'); S.cv = mk('canvas', 'mv-cv');
    S.pop = tap('mv-hit', '', 'popcorn', munch, 'pointerdown');
    S.rateEl = mk('div', 'mv-rate mv-off'); for (let i = 0; i < 5; i++) S.rateEl.append(tap('mv-star', '⭐', 'star', () => star(i + 1)));
    S.shelf = mk('div', 'mv-shelf');
    for (const F of FILMS) {
      const b = tap('mv-post', '', 'film ' + F.id, () => pick(F, b)); b.dataset.id = F.id; b.append(mk('canvas'), mk('b', '', F.ico), mk('i', '', '')); b.firstChild.width = 96; b.firstChild.height = 128; S.shelf.append(b);
      if (F.fav) { b.classList.add('mv-fav'); const s = mk('s'); s.style.left = F.fav[0] + '%'; s.style.top = `calc((100% - 30px) * ${F.fav[1] / 100})`; b.insertBefore(s, b.lastChild); }      // Nunu's favourite: a gold frame and a ring that twinkles
    }
    body.append(S.cv, S.pop, S.rateEl, S.shelf); panel.append(top, body);
    layout(); ui(); posters();
    S.onResize = () => { layout(); clearTimeout(S.rzT); const me = S; S.rzT = setTimeout(() => { if (S === me) layout(); }, 320); };
    addEventListener('resize', S.onResize); addEventListener('orientationchange', S.onResize);
    S.onHide = () => { if (S && document.visibilityState !== 'visible' && playing() && !S.paused) togglePause(); };
    document.addEventListener('visibilitychange', S.onHide);
    S.raf = requestAnimationFrame(frame); voReady(); jingle([0, 7, 12], 0.06);
    return true;
  }
  const playing = () => !!S && (S.mode === 'film');
  function ui() {            // which buttons show
    const film = S.mode !== 'pick'; for (const b of [S.playB, S.nextB, S.stopB, S.blB, S.cv, S.pop]) b.classList.toggle('mv-off', !film);
    S.shelf.classList.toggle('mv-off', film); S.ttl.textContent = film ? '' : '🎬'; S.ttl.classList.toggle('mv-off', film && S.land); S.rateEl.classList.toggle('mv-off', S.mode !== 'rate'); sync();
  }
  function sync() { if (!S) return; S.playB.textContent = S.paused ? '▶️' : '⏸️'; S.playB.classList.toggle('on', S.paused); S.playB.setAttribute('aria-label', S.paused ? 'play' : 'pause'); const can = S.mode === 'film' || S.mode === 'rate'; S.playB.disabled = S.mode !== 'film'; S.nextB.disabled = !can; }
  function posters() {       // pictures on the shelf, and the stars she gave each film
    const me = S, st = store(); for (const b of S.shelf.children) b.lastChild.textContent = '⭐'.repeat(clamp(st.stars[b.dataset.id] | 0, 0, 5));
    const put = (b, img, r) => { const g = b.firstChild.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, 96, 128); b.children[1].classList.add('mv-off'); };
    loadMeta().then(() => loadImg('common')).then(img => { if (S !== me) return; S.common = { img, R: META.sheets.common };
      for (const b of S.shelf.children) {
        const id = b.dataset.id, r = S.common.R['p_' + id], own = !r && META.sheets[id] && META.sheets[id].poster;     // a newer film keeps its poster on its own sheet
        if (r) put(b, img, r); else if (own) loadImg(id).then(im => { if (S === me) put(b, im, own); }).catch(e => console.warn('movies', e));
      } }).catch(e => console.warn('movies', e));
  }
  function prep(F) {           // a film's pictures and clips, ready to roll
    const me = S; return loadMeta().then(() => Promise.all([loadImg(F.id), loadImg('common')])).then(([img, cm]) => { F.img = img; compile(F); if (S === me) S.common = { img: cm, R: META.sheets.common };
      const keys = new Set(); for (const sh of F.shots) for (const e of sh.E) if (e[1] === 'vo') keys.add(e[2]); return Promise.race([Promise.all([...keys].map(voLoad)), new Promise(r => setTimeout(r, 6000))]); });
  }
  function pick(F, b) {
    if (S.mode !== 'pick' || S.busy) return; wake(); S.busy = true; const me = S, tok = ++S.tok; snd('pop'); whoosh(true); b.classList.add('mv-go');
    const ready = prep(F);
    setTimeout(() => { if (S !== me || S.tok !== tok) return; b.classList.remove('mv-go'); S.busy = false; S.film = F; S.skips = 0; S.mode = 'load'; S.spin = true; S.mt = 0; S.dimTo = 0; S.dim = 0; S.tvOn = 0; S.paused = false; S.seg = null; S.bars = 0; S.sp.length = 0; S.heads.jump = 0; ui(); layout();
      ready.then(() => { if (S !== me || S.tok !== tok || S.mode !== 'load') return; S.spin = false; S.mode = 'dim'; S.mt = 0; S.dimTo = 1; hushGame(); snd('click'); fire('start'); })
        .catch(e => { console.warn('movies', e); if (S === me && S.tok === tok) { blip(-17, 'sawtooth', 0.14, 0.13); toShelf(); } }); }, 330);
  }
  function togglePause() {
    if (S.mode !== 'film') return; wake(); S.paused = !S.paused;
    if (S.paused) { voStop(); Seq.stop(); blip(-5, 'triangle', 0.08, 0.12); }
    else {                      // carry on from the start of the line that was being spoken, so nothing is half heard
      if (S.seg === 'shot') { let i = S.si; while (i > 0 && S.film.shots[i].cont) i--; enter('shot', i); } else enter(S.seg);
      blip(7, 'triangle', 0.08, 0.12);
    }
    sync();
  }
  function skip() { wake(); if (S.mode === 'rate') return toShelf(true); if (S.mode !== 'film') return; voStop(); whoosh(true); S.paused = false; if (S.seg === 'shot') S.skips++; nextSeg(); sync(); }
  function rate() {             // the film is over: lights half up, cheering, and five big stars to tap
    credit(); S.mode = 'rate'; S.mt = 0; S.rateFor = 14; S.dimTo = 0.55; S.paused = false; for (const b of S.rateEl.children) b.classList.remove('on'); ui(); place();
    snd('cheer'); try { if (typeof say === 'function') say('m_yay'); } catch (e) { }
  }
  function star(n) {
    if (S.mode !== 'rate') return; wake(); [...S.rateEl.children].forEach((b, i) => b.classList.toggle('on', i < n)); jingle([0, 4, 7, 12, 16].slice(0, n), 0.07, 'square'); S.heads.cheer = 1.6; S.mt = 0; S.rateFor = 3.4;
    const st = store(); st.stars[S.film.id] = n; save(st); const k = (S.Wap * K) / S.cw, r = S.rateEl.children[n - 1].getBoundingClientRect(), br = S.body.getBoundingClientRect();
    for (let i = 0; i < 6 + n * 2; i++) { const a = Math.random() * TAU, v = rnd(60, 220) * S.fs / 3; S.sp.push({ k: 'star', x: (r.left + r.width / 2 - br.left) * k, y: (r.top + r.height / 2 - br.top) * k, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 300, life: rnd(0.6, 1.1), age: 0, s: S.fs * 2, c: '#ffe36a' }); }
    confetti(10 + n * 4);
  }
  function quiet() { voStop(); Seq.stop(); credit(); if (S) S.held = false; Seq.held = false; }
  function toShelf(byHand) {
    if (!S || S.mode === 'pick') return; quiet(); S.tok++; S.mode = 'pick'; S.seg = null; S.film = null; S.paused = false; S.busy = false; S.dimTo = S.dim = 0; S.tvOn = 0; S.spin = false; ui(); posters(); gameMusic(); if (byHand) whoosh(false);
  }
  function teardown() {
    if (!S) return; cancelAnimationFrame(S.raf); clearTimeout(S.rzT); removeEventListener('resize', S.onResize); removeEventListener('orientationchange', S.onResize); document.removeEventListener('visibilitychange', S.onHide); S.panel.classList.remove('mv-on'); S = null;
  }
  function finish() {          // the ❌, or Movies.close(): everything stops, the panel is given back
    if (!S) return; const st = S, res = { watched: st.watched.slice(), last: st.watched[st.watched.length - 1] || null };
    quiet(); teardown(); st.panel.classList.add('hidden'); st.panel.innerHTML = ''; gameMusic();
    if (typeof st.opts.onDone === 'function') try { st.opts.onDone(res); } catch (e) { console.warn('movies onDone', e); }
  }
  function frame(now) {
    if (!S) return;
    if (!S.body.isConnected || S.panel.classList.contains('hidden')) { const st = S, res = { watched: st.watched.slice(), last: st.watched[st.watched.length - 1] || null }; quiet(); teardown(); gameMusic(); if (typeof st.opts.onDone === 'function') try { st.opts.onDone(res); } catch (e) { } return; }   // something else closed the panel
    const sp = api._speed || 1, dt = Math.min(0.1, Math.max(0, (now - S.last) / 1000)) * sp; S.last = now; S.T += dt;
    if (S.mode !== 'pick') try {
      S.dim += clamp(S.dimTo - S.dim, -dt / 1.1, dt / 1.1);
      if (S.seg) S.tvOn = clamp(S.tvOn + dt * 2.2, 0, 1);
      if (S.mode === 'dim') { S.mt += dt; if (S.mt > 0.9) { enter('logo'); S.mode = 'film'; sync(); } }
      if (S.mode === 'film' && !S.paused) { if ((S.gt = (S.gt || 0) + dt) > 0.5) { S.gt = 0; hushGame(); } filmTick(dt); }
      else if (S.mode === 'rate') { stepParts(dt); S.t += dt; S.mt += dt; if (S.mt > S.rateFor) toShelf(); }
      if (S && S.mode !== 'pick') { if (S.seg && S.film) drawFilm(S.paused && S.mode === 'film' ? 0 : dt); if (((S.fr = (S.fr || 0) + 1) % 6) === 0) sampleGlow(); drawStage(dt); }
      if (S) S.bad = 0;
    } catch (e) { if (S) { if (!S.bad) console.warn('movies', e); if ((S.bad = (S.bad || 0) + 1) > 60) { S.bad = 0; toShelf(); } } }
    if (S) S.raf = requestAnimationFrame(frame);
  }
  function list() { const st = store(); if (META) FILMS.forEach(compile); return FILMS.map(F => ({ id: F.id, ico: F.ico, mood: F.mood, shots: F.shots.length, secs: F.secs || null, clips: [...new Set(F.shots.flatMap(sh => (sh.vo || []).concat((sh.ev || []).filter(e => e[1] === 'vo').map(e => e[2]))))], seen: st.seen[F.id] || 0, stars: st.stars[F.id] || 0 })); }
  function state() {           // a peek for tests
    if (!S) return { open: false };
    return { open: true, mode: S.mode, film: S.film && S.film.id, seg: S.seg, shot: S.si, shots: S.film ? S.film.shots.length : 0, t: +S.t.toFixed(2), D: S.D, paused: S.paused, dim: +S.dim.toFixed(2), tvOn: +S.tvOn.toFixed(2), blanket: S.blanket, pops: S.pops, voice: !!voSrc || performance.now() < voTill, packed: !!(voIdx && S.film && voIdx[S.film.shots[0].vo[0]]), music: Seq.on, held: S.held, watched: S.watched.slice(), particles: S.parts.length, secs: S.film && S.film.secs };
  }
  const api = window.Movies = { open, close: finish, list, state, _speed: 1, get active() { return !!S; },
    _fire: k => fire(k),
    // for tests: load a film without playing it, then freeze any moment of it on the TV
    _prep: id => prep(FILMS.find(f => f.id === id)).then(() => FILMS.find(f => f.id === id).shots.map(sh => sh.D)),
    _peek(id, si, t, seg) { const F = FILMS.find(f => f.id === id); S.film = F; S.seg = seg || 'shot'; S.si = si; S.t = t; S.D = seg ? 9 : F.shots[si].D; S.bars = seg ? 0 : 1; S.parts.length = 0; S.flash = S.shk = null; S.paused = true; S.mode = 'film'; S.tvOn = 1; S.dim = S.dimTo = 1; ui(); return S.fc; } };
})();
