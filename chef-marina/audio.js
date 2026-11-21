// Chef Marina — audio: voice clips, sfx, synthesized Japanese chiptune music & blips
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
    Music.start();
  }

  function load(url) {
    if (buffers[url]) return Promise.resolve(buffers[url]);
    if (loading[url]) return loading[url];
    loading[url] = fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
      .then(a => new Promise((res, rej) => ac.decodeAudioData(a, res, rej)))
      .then(b => (buffers[url] = b)).catch(e => { console.warn('audio', url, e); return null; });
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
  function voice(key, speaker) {
    if (!ac) return Promise.resolve();
    speaker = speaker || key.split('_')[0];
    const url = 'assets/vo/' + key + '.mp3';
    return load(url).then(buf => {
      if (!buf) { speak(key.replace(/^\w+?_/, '').replace(/_/g, ' ')); return wait(1200); }
      if (voiceNow[speaker]) { try { voiceNow[speaker].stop(); } catch (e) {} }
      duck(buf.duration);
      const s = playBuf(buf, voiceGain, {}); voiceNow[speaker] = s;
      return wait(buf.duration * 1000);
    });
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
  const FARTS = ['fart1', 'fart2', 'fart3', 'fart4'];
  function fart() {
    if (Math.random() < 0.6) sfx(FARTS[Math.random() * 4 | 0], { rate: 0.7 + Math.random() * 0.7 });
    else synthFart();
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
  };
  const Music = {
    mode: 'explore', step: 0, next: 0, timer: null, mel: 2, phrase: [],
    set(m) { if (MODES[m] && m !== this.mode) { this.mode = m; this.phrase = []; } },
    start() { if (this.timer) return; this.next = ac.currentTime + 0.1; this.timer = setInterval(() => this.tick(), 25); },
    note(midi, t, len, type, vol, detune = 0) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12); o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + len + 0.02);
    },
    drum(kind, t) {
      if (kind === 'k') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16); }
      else { const len = kind === 's' ? 0.12 : 0.03, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 's' ? 1500 : 7000;
        const g = ac.createGain(); g.gain.setValueAtTime(kind === 's' ? 0.35 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); }
    },
    tick() {
      if (!ac || muted) return;
      const M = MODES[this.mode], sc = SCALES[M.scale], spb = 60 / M.bpm / 4;
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

  // play several voice clips back to back (e.g. a dish name built from words)
  async function chain(keys, speaker = 'marina') {
    if (!ac) return;
    const bufs = await Promise.all(keys.map(k => load('assets/vo/' + k + '.mp3')));
    if (voiceNow[speaker]) { try { voiceNow[speaker].stop(); } catch (e) {} }
    let t = 0.05; const tot = bufs.reduce((s, b) => s + (b ? b.duration : 0), 0); duck(tot + 0.3);
    for (const b of bufs) { if (!b) continue; const s = playBuf(b, voiceGain, { when: t }); voiceNow[speaker] = s; t += b.duration - 0.04; }
    return wait(t * 1000);
  }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.9; return muted; }

  return { init, load, preload, chain, voice, speak, sfx, fart, blip, jingle, whoosh, noise, Music, toggleMute, get ctx() { return ac; } };
})();
