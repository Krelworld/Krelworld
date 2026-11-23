// Chef Marina — audio: voice clips, sfx, ElevenLabs chiptune loops (+ synthesized Japanese chiptune fallback) & blips
const Audio2 = (() => {
  let ac = null, master, musicGain, sfxGain, voiceGain;
  const buffers = {}, loading = {};
  const voiceNow = {};        // speaker -> source
  let muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
    voiceGain = ac.createGain(); voiceGain.gain.value = 1.0; voiceGain.connect(master);
    // iOS unlock
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
    Music.start(); warm();
    // iPhone: the audio system can be paused (app switch, lock, a call) and stay 'suspended'/'interrupted'; any touch wakes it again
    document.addEventListener('pointerdown', () => { if (ac && ac.state !== 'running') { try { ac.resume(); } catch (e) { } } }, { capture: true, passive: true });
  }

  // voice clips live in a few pack files (many clips, few downloads); the index says where each one is
  let voIndex = null, voIndexP = null; const voPacks = {};
  function voReady() { return voIndexP || (voIndexP = fetch('assets/vo_index.json').then(r => r.json()).then(j => (voIndex = j)).catch(() => (voIndex = {}))); }
  function packBytes(name) { return voPacks[name] || (voPacks[name] = fetch('assets/' + name + '.mp3').then(r => { if (!r.ok) throw new Error(name); return r.arrayBuffer(); })); }
  function warm() { voReady().then(() => { for (const n of ['vo_m', 'vo_fam', 'vo_w', 'vo_media', 'vo_dish', 'vo_gp']) packBytes(n).catch(() => {}); }); }
  // never wait forever on a decode: on iPhone decodeAudioData can hang while audio is paused; give up after 8 s (and allow a retry later)
  const decode = (a, url) => Promise.race([new Promise((res, rej) => ac.decodeAudioData(a, res, rej)), wait(8000).then(() => { delete loading[url]; return null; })]);
  function load(url) {
    if (buffers[url]) return Promise.resolve(buffers[url]);
    if (loading[url]) return loading[url];
    const mk = url.match(/^assets\/vo\/(.+)\.mp3$/);
    if (mk) return (loading[url] = voReady().then(() => { const e = voIndex[mk[1]];
      if (!e) return fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(a => a && decode(a, url)).then(b => b && (buffers[url] = b));      // a clip not packed yet: try the single file
      return packBytes(e[0]).then(buf => decode(buf.slice(e[1], e[1] + e[2]), url)).then(b => b && (buffers[url] = b)); }).catch(err => { console.warn('audio', url, err); return null; }));
    loading[url] = fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
      .then(a => decode(a, url))
      .then(b => b && (buffers[url] = b)).catch(e => { console.warn('audio', url, e); return null; });
    return loading[url];
  }
  function preload(urls, onEach) { return Promise.all(urls.map(u => load(u).then(() => onEach && onEach()))); }

  function playBuf(buf, dest, { rate = 1, vol = 1, when = 0 } = {}) {
    const s = ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = vol; s.connect(g); g.connect(dest);
    s.start(ac.currentTime + when); return s;
  }

  // ---- voices -------------------------------------------------------------
  // returns promise resolving after the clip ends (approx)
  // Each speaker finishes the line they're on before starting the next one (so nobody gets cut off mid-sentence).
  // A short queue: if two lines are already waiting, a further one is skipped rather than piling up.
  const voiceQ = {}, voiceWaiting = {}, voiceGen = {};
  const who = sp => (sp === 'marina' ? 'm' : sp);
  function line(speaker, play) {
    speaker = who(speaker); const gen = voiceGen[speaker] = voiceGen[speaker] || 0;
    if ((voiceWaiting[speaker] || 0) >= 2) return wait(300);
    voiceWaiting[speaker] = (voiceWaiting[speaker] || 0) + 1;
    const p = (voiceQ[speaker] || Promise.resolve()).then(() => { voiceWaiting[speaker]--; return gen === voiceGen[speaker] ? play(speaker) : null; });
    voiceQ[speaker] = p.catch(() => {}); return p;
  }
  function hush(speaker) {      // stop this speaker now and forget anything they had queued (also used for "say this instead")
    speaker = who(speaker); voiceGen[speaker] = (voiceGen[speaker] || 0) + 1; voiceQ[speaker] = Promise.resolve(); voiceWaiting[speaker] = 0;
    if (voiceNow[speaker]) { try { voiceNow[speaker].stop(); } catch (e) {} voiceNow[speaker] = null; }
  }
  function voice(key, speaker, opt) {
    if (!ac) return Promise.resolve();
    speaker = speaker || key.split('_')[0];
    if (opt && opt.cut) hush(speaker);
    const url = 'assets/vo/' + key + '.mp3';
    const ready = Promise.race([load(url), wait(4000).then(() => null)]);     // a line whose sound isn't ready in 4 s is skipped, so nobody waits forever; start fetching now, but take our place in the queue straight away so lines stay in the order they were asked for
    return line(speaker, sp => ready.then(buf => { if (!buf) return wait(700); duck(buf.duration); const s = playBuf(buf, voiceGain, {}); voiceNow[sp] = s; return wait(buf.duration * 1000); }));
  }
  function duck(sec) {
    if (!musicGain) return; const t = ac.currentTime;
    musicGain.gain.cancelScheduledValues(t); musicGain.gain.setTargetAtTime(0.06, t, 0.05);
    musicGain.gain.setTargetAtTime(muted ? 0 : 0.16, t + sec, 0.3);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // device voice fallback for dynamic words (dish names, sums, spelling)
  function speak(text, { pitch = 1.3, rate = 0.9 } = {}) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = rate; u.lang = 'en-US';
      const v = speechSynthesis.getVoices().find(v => /en-US/i.test(v.lang) && /female|samantha|zira|aria|jenny/i.test(v.name));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---- sfx ----------------------------------------------------------------
  function sfx(key, opt = {}) {
    if (!ac) return;
    load('assets/sfx/' + key + '.mp3').then(b => b && playBuf(b, sfxGain, { rate: opt.rate || (0.92 + Math.random() * 0.16), vol: opt.vol || 1 }));
  }
  const FARTS = ['fart1', 'fart2', 'fart3', 'fart4', 'fart5', 'fart6', 'fart7', 'fart8'];
  let lastFart = -1;
  function fart() {
    if (!ac) return;
    let i; do { i = Math.random() * FARTS.length | 0; } while (i === lastFart && FARTS.length > 1);
    lastFart = i;
    // real recordings; the synth version is only a fallback if the clip can't load
    load('assets/sfx/' + FARTS[i] + '.mp3').then(b => {
      if (b) playBuf(b, sfxGain, { rate: 0.88 + Math.random() * 0.3, vol: 1 });
      else synthFart();
    });
  }
  function synthFart() {
    const t = ac.currentTime, d = 0.4 + Math.random() * 0.9;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const f0 = 70 + Math.random() * 60; o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.5 + Math.random() * 0.4), t + d);
    const lfo = ac.createOscillator(); lfo.frequency.value = 18 + Math.random() * 25;
    const lg = ac.createGain(); lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = ac.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.setValueAtTime(0.5, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); lfo.start(t); o.stop(t + d); lfo.stop(t + d);
  }

  // chiptune blips; microtonal detune for flavour
  function blip(n = 0, type = 'square', len = 0.09, vol = 0.18) {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = 523.25 * Math.pow(2, n / 12); o.detune.value = (Math.random() - 0.5) * 40;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + len);
  }
  function jingle(notes, step = 0.08, type = 'square') {
    notes.forEach((n, i) => setTimeout(() => blip(n, type, step * 1.6), i * step * 1000));
  }
  function whoosh(up = true) {
    if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(up ? 200 : 900, t); o.frequency.exponentialRampToValueAtTime(up ? 900 : 150, t + 0.25);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.3);
  }
  function noise(len = 0.3, vol = 0.3, hp = 800) {
    if (!ac) return; const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
  }

  // ---- music --------------------------------------------------------------
  const SCALES = { yo: [0, 2, 5, 7, 9], in: [0, 1, 5, 7, 8], ryukyu: [0, 4, 5, 7, 11], silly: [0, 3, 4, 7, 10] };
  const MODES = {
    explore: { scale: 'yo', root: 60, bpm: 96, lead: 'square', arp: true, drums: 1 },
    kitchen: { scale: 'yo', root: 62, bpm: 124, lead: 'square', arp: true, drums: 2 },
    fort: { scale: 'ryukyu', root: 65, bpm: 78, lead: 'triangle', arp: true, drums: 0, bell: true },
    tantrum: { scale: 'in', root: 57, bpm: 150, lead: 'sawtooth', arp: false, drums: 3 },
    chase: { scale: 'in', root: 64, bpm: 172, lead: 'square', arp: true, drums: 3 },
    tv: { scale: 'silly', root: 67, bpm: 140, lead: 'square', arp: true, drums: 2, micro: 1 },
    yard: { scale: 'yo', root: 67, bpm: 104, lead: 'triangle', arp: true, drums: 1 },
    snow: { scale: 'ryukyu', root: 72, bpm: 88, lead: 'triangle', arp: true, drums: 0, bell: true },
    dress: { scale: 'yo', root: 69, bpm: 112, lead: 'square', arp: true, drums: 1, bell: true },
    crafts: { scale: 'ryukyu', root: 62, bpm: 100, lead: 'triangle', arp: true, drums: 1 },
    gross: { scale: 'in', root: 50, bpm: 92, lead: 'sawtooth', arp: false, drums: 2, micro: 1 },
    night: { scale: 'in', root: 57, bpm: 60, lead: 'triangle', arp: false, drums: 0, bell: true },
    bath: { scale: 'yo', root: 64, bpm: 100, lead: 'triangle', arp: true, drums: 1, micro: 1 },
    title: { scale: 'yo', root: 64, bpm: 116, lead: 'square', arp: true, drums: 1, bell: true },
    gym: { scale: 'yo', root: 65, bpm: 128, lead: 'square', arp: true, drums: 2 },
  };
  // ElevenLabs-composed chiptune loops (assets/music/<file>.mp3). Modes without their own
  // track either borrow one (MUSIC_FILE alias) or fall back to the synthesized chiptune below.
  const MUSIC_FILE = {
    title: 'title', explore: 'explore', kitchen: 'kitchen', fort: 'fort', yard: 'yard', chase: 'chase',
    tantrum: 'tantrum', dress: 'dress', tv: 'tv', night: 'night', gym: 'gym',
    crafts: 'explore', bath: 'explore', // snow + gross keep their synthesized themes
  };
  const MUSIC_VOL = 0.8, XFADE = 0.6;
  let synthGain = null;
  const Music = {
    mode: 'explore', step: 0, next: 0, timer: null, mel: 2, phrase: [],
    synthOn: false, cur: null, curFile: null, want: 0,
    set(m) {
      if (!m || m === this.mode && (this.cur || this.synthOn)) return;
      this.mode = m; this.phrase = [];
      if (!MODES[m] && !MUSIC_FILE[m]) return;
      if (ac) this.apply();
    },
    apply() {
      const file = MUSIC_FILE[this.mode] || null;
      const token = ++this.want;
      if (file && file === this.curFile && this.cur) { this.synth(false); return; }
      if (!file) { this.stopFile(); this.synth(true); return; }
      load('assets/music/' + file + '.mp3').then(buf => {
        if (token !== this.want) return;               // mode changed while loading
        if (!buf) { this.stopFile(); this.synth(true); return; }
        this.stopFile();
        const t = ac.currentTime, src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = buf; src.loop = true;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(MUSIC_VOL, t + XFADE);
        src.connect(g); g.connect(musicGain); src.start(t);
        this.cur = { src, g }; this.curFile = file;
        this.synth(false);
      });
    },
    stopFile() {
      if (!this.cur) return;
      const { src, g } = this.cur, t = ac.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + XFADE);
      try { src.stop(t + XFADE + 0.05); } catch (e) {}
      this.cur = null; this.curFile = null;
    },
    synth(on) {
      if (!synthGain) return;
      const t = ac.currentTime;
      if (on && !this.synthOn) this.next = t + 0.05;
      this.synthOn = on;
      synthGain.gain.cancelScheduledValues(t); synthGain.gain.setValueAtTime(synthGain.gain.value, t);
      synthGain.gain.linearRampToValueAtTime(on ? 1 : 0.0001, t + XFADE);
    },
    start() {
      if (this.timer) return;
      synthGain = ac.createGain(); synthGain.gain.value = 0.0001; synthGain.connect(musicGain);
      this.next = ac.currentTime + 0.1; this.timer = setInterval(() => this.tick(), 25);
      this.apply();
    },
    note(midi, t, len, type, vol, detune = 0) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12); o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(synthGain); o.start(t); o.stop(t + len + 0.02);
    },
    drum(kind, t) {
      if (kind === 'k') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(synthGain); o.start(t); o.stop(t + 0.16); }
      else { const len = kind === 's' ? 0.12 : 0.03, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 's' ? 1500 : 7000;
        const g = ac.createGain(); g.gain.setValueAtTime(kind === 's' ? 0.35 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        s.connect(f); f.connect(g); g.connect(synthGain); s.start(t); }
    },
    tick() {
      if (!ac || muted || !this.synthOn) { if (ac) this.next = Math.max(this.next, ac.currentTime + 0.05); return; }
      const M = MODES[this.mode] || MODES.explore, sc = SCALES[M.scale], spb = 60 / M.bpm / 4;
      while (this.next < ac.currentTime + 0.12) {
        const t = this.next, s = this.step % 16, bar = (this.step >> 4) % 4;
        const deg = i => { const o = Math.floor(i / sc.length); return M.root + sc[((i % sc.length) + sc.length) % sc.length] + 12 * o; };
        const chordRoot = [0, 3, 1, 4][bar];
        // melody: build a 16-step phrase and repeat it twice for memorability
        if (s === 0 && bar % 2 === 0) {
          this.phrase = [];
          for (let i = 0; i < 16; i++) {
            if (Math.random() < (i % 4 === 0 ? 0.9 : 0.45)) { this.mel += [-2, -1, -1, 0, 1, 1, 2][Math.random() * 7 | 0]; this.mel = Math.max(0, Math.min(9, this.mel)); this.phrase.push(this.mel); }
            else this.phrase.push(null);
          }
        }
        const mn = this.phrase[s];
        if (mn != null) this.note(deg(mn + 5), t, spb * 1.8, M.lead, 0.22, M.micro && Math.random() < 0.3 ? (Math.random() - 0.5) * 60 : 0);
        if (M.bell && s % 8 === 4) this.note(deg(chordRoot + 10), t, spb * 6, 'sine', 0.18);
        if (s % 4 === 0) this.note(deg(chordRoot) - 24, t, spb * 3.5, 'triangle', 0.4);
        if (M.arp && s % 2 === 1) this.note(deg(chordRoot + [0, 2, 4, 2][(s >> 1) % 4]) - 12, t, spb * 0.9, 'square', 0.08);
        if (M.drums) {
          if (s % 8 === 0) this.drum('k', t);
          if (M.drums > 1 && s % 8 === 4) this.drum('s', t);
          if (s % 2 === 0 || M.drums > 2) this.drum('h', t);
        }
        this.next += spb; this.step++;
      }
    }
  };


  // short named chiptune tunes for the toy keyboard (semitones from C5; null = rest)
  const MELODIES = {
    twinkle: { n: [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0], step: 0.22, lead: 'square', bass: [-12, -5, -7, -12] },
    happy:   { n: [0, 4, 7, 12, 7, 4, 0, null, 4, 7, 12, 16, 19, 16, 12], step: 0.14, lead: 'square', bass: [-12, -8, -5] },
    fanfare: { n: [7, 7, 7, 12, null, null, 7, 12, 16, null, 19, 19, 24], step: 0.12, lead: 'sawtooth', bass: [-17, -12] },
    silly:   { n: [12, 0, 12, 0, 14, 2, 15, 3, 19, null, -5, null, -5], step: 0.13, lead: 'square', bass: [-24, -12], wobble: 40 },
    spooky:  { n: [0, 3, 6, 3, 0, -1, 0, null, 6, 5, 3, 0, null, -6], step: 0.24, lead: 'triangle', bass: [-24, -18], wobble: 25 },
    lullaby: { n: [4, 2, 0, 2, 4, 4, 4, null, 2, 2, 2, null, 4, 7, 7], step: 0.3, lead: 'triangle', bass: [-12, -8] },
    rocket:  { n: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 24, null, 36], step: 0.07, lead: 'square', bass: [-12] },
    sakura:  { n: [9, 9, 11, null, 9, 9, 11, null, 9, 11, 12, 11, 9, 5, 4], step: 0.26, lead: 'triangle', bass: [-15, -8], micro: true }, // in-scale, koto-ish
  };
  function melody(name) {
    if (!ac) return Promise.resolve();
    const M = MELODIES[name] || MELODIES[Object.keys(MELODIES)[Math.random() * 8 | 0]];
    const t0 = ac.currentTime + 0.03, tot = M.n.length * M.step;
    const tone = (semi, t, len, type, vol, det = 0, wob = 0) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = 523.25 * Math.pow(2, semi / 12); o.detune.value = det;
      if (wob) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = wob; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + len + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + len + 0.05);
    };
    M.n.forEach((n, i) => {
      if (n == null) return;
      const t = t0 + i * M.step;
      tone(n, t, M.step * 1.5, M.lead, 0.16, M.micro && i % 3 === 2 ? -30 : 0, M.wobble || 0);
      tone(n + 12, t, M.step * 0.6, 'square', 0.03);                                   // sparkle octave
      if (i % 4 === 0) tone(M.bass[(i / 4 | 0) % M.bass.length] - 12, t, M.step * 3, 'triangle', 0.2);
    });
    tone(M.n.filter(x => x != null).pop() + 24, t0 + tot, 0.6, 'sine', 0.08);           // little bell at the end
    duck(tot + 0.4);
    return wait((tot + 0.6) * 1000);
  }

  // play several voice clips back to back (e.g. a dish name built from words)
  async function chain(keys, speaker = 'marina', vol = 1) {
    if (!ac) return;
    const ready = Promise.race([Promise.all(keys.map(k => load('assets/vo/' + k + '.mp3'))), wait(4000).then(() => [])]);   // never wait forever
    return line(speaker, async sp => { const bufs = await ready, srcs = []; let t = 0.05; const tot = bufs.reduce((s, b) => s + (b ? b.duration : 0), 0); duck(tot + 0.3);
      for (const b of bufs) { if (!b) continue; srcs.push(playBuf(b, voiceGain, { when: t, vol })); t += b.duration - 0.04; }
      voiceNow[sp] = { stop() { for (const s of srcs) try { s.stop(); } catch (e) {} } };
      return wait(t * 1000); });
  }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.9; return muted; }

  return { init, load, preload, chain, voice, hush, speak, sfx, fart, blip, jingle, whoosh, noise, melody, Music, toggleMute, get ctx() { return ac; } };
})();
