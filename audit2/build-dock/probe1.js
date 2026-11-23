const L = require('./lib.js');
(async () => {
  for (const [name, ins] of [['port', null], ['portSmall', null], ['390x664', null], ['port', { top: 59, bottom: 34, left: 0, right: 0 }], ['land', null], ['land', { top: 0, bottom: 21, left: 59, right: 59 }], ['landSmall', null], ['375x553', null], ['844x340', null]]) {
    const g = await L.boot({ port: 8890, view: L.viewOf(name), room: 'kitchen', insets: ins });
    await g.calm();
    const r = await g.ev(async () => {
      const st = document.getElementById('stage').getBoundingClientRect();
      const moods = [...document.querySelectorAll('#moodbar .mood')].map(n => [n.offsetTop, Math.round(n.getBoundingClientRect().top)]);
      const env = getComputedStyle(document.getElementById('app')).paddingTop + '/' + getComputedStyle(document.getElementById('app')).paddingLeft;
      const sb = document.getElementById('stopBtn'); const widths = {};
      for (const gl of ['🖼️', '🍽️', '♿', '🧍', '🐴', '🧗', '🛝', '🐒', '🪑', '🦘', '🧻', '🐱', '🍃', '💩', '📺', '✋']) { sb.classList.remove('hidden'); sb.querySelector('.si').textContent = gl; const b = sb.getBoundingClientRect(); widths[gl] = [Math.round(b.left - st.left), Math.round(b.width), Math.round(b.right - st.left)]; }
      sb.classList.add('hidden');
      UI.face('marina', 'happy', 4000); daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 80; UI.face('daddy', 'happy', 4000);
      await new Promise(r => setTimeout(r, 300));
      const cards = [...document.querySelectorAll('.facecard.show')].map(n => { const b = n.getBoundingClientRect(); return [n.dataset.who, Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; });
      return { inner: [innerWidth, innerHeight], stage: [Math.round(st.left), Math.round(st.top), Math.round(st.width), Math.round(st.height)], tall: matchMedia('(orientation:portrait) and (min-height:150vw)').matches, env, moods: moods.slice(0, 2), cards, widths };
    });
    console.log(name, ins ? JSON.stringify(ins) : '', JSON.stringify(r));
    console.log('  errs', g.errs());
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
