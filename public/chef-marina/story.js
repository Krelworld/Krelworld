// Story time: tap a bookshelf, pick a picture book, pick who reads it (Daddy, Mommy or Uncle Rory),
// and they read it page by page in their own voice.
(function () {
  let STORIES = null; fetch('assets/stories.json').then(r => r.json()).then(j => (STORIES = j)).catch(() => (STORIES = []));
  const stage = document.getElementById('stage');
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const press = (n, fn) => { n.addEventListener('pointerdown', e => e.stopPropagation()); n.addEventListener('pointerup', e => { e.stopPropagation(); e.preventDefault(); fn(e); }); return n; };
  const READERS = [['d', 'daddy'], ['mo', 'mommy'], ['r', 'rory'], ['nu', 'nunu']];
  const entOf = who => ({ daddy, mommy, rory, nunu })[who];
  let box = null, tok = 0, held = null;
  const img = (s, i) => 'assets/story/' + s.id + '_' + (i + 1) + '.png';

  function close(done, who) {
    tok++; if (held) { AI.hold(held, false); held = null; } if (box) { box.remove(); box = null; } stage.classList.remove('storyon'); G.busy = false; setMusic();
    for (const sp of ['d', 'mo', 'r', 'nu']) try { Audio2.hush(sp); } catch (e) { }
    if (done && who) { const e = entOf(who); marina.state = 'cheer'; emit('heart', (marina.x + e.x) / 2, marina.y - 70, 8); setTimeout(() => { if (marina.state === 'cheer') marina.state = 'idle'; }, 1500);
      say('m_again').then(() => say(e === daddy ? 'd_love' : e === mommy ? 'mo_love' : 'r_love', e)); }
  }
  function open() {
    if (G.busy || !STORIES || !STORIES.length) return; UI.closeActions(); G.busy = true; tok++;
    if (box) box.remove(); box = mk('div', ''); box.id = 'storyBox'; stage.append(box); stage.classList.add('storyon');
    box.addEventListener('pointerdown', e => e.stopPropagation()); box.addEventListener('pointerup', e => e.stopPropagation());
    Audio2.Music.set('night'); chip('magic');
    shelf();
  }
  const closeBtn = () => press(mk('button', 'st-x', window.Clarity && Clarity.is('G33') ? '❌' : '✖️'), () => close());      /* G33 */
  function shelf() {
    box.innerHTML = ''; box.append(closeBtn());
    const g = mk('div', 'st-shelf');
    // three of the books each time, so the shelf feels different
    const set = STORIES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    for (const s of set) { const b = mk('button', 'st-book', '<img src="' + img(s, 0) + '"><b>' + s.ico + '</b><span>' + s.title + '</span>'); b.setAttribute('aria-label', s.title); press(b, () => { chip('pop'); readers(s); }); g.append(b); }
    box.append(mk('div', 'st-h', '📚'), g);
  }
  function readers(s) {
    box.innerHTML = ''; box.append(closeBtn(), press(mk('button', 'st-back', '◀'), shelf));
    const g = mk('div', 'st-who');
    for (const [sp, who] of READERS.filter(r => spriteCanvas(r[1]))) {
      const b = mk('button', 'st-reader', '<canvas width="64" height="64"></canvas>'); b.setAttribute('aria-label', who + ' reads');
      const sc = spriteCanvas(who), x = b.firstChild.getContext('2d'); x.imageSmoothingEnabled = false; if (sc) { const k = Math.min(1, 64 / sc.height); x.drawImage(sc, 32 - sc.width * k / 2, 64 - sc.height * k, sc.width * k, sc.height * k); }
      press(b, () => { chip('yes'); read(s, sp, who); }); g.append(b);
    }
    box.append(mk('div', 'st-cover', '<img src="' + img(s, 0) + '"><span>' + s.ico + ' ' + s.title + '</span>'), mk('div', 'st-h', '👂❓'), g);
  }
  function read(s, sp, who) {
    // the reader comes and sits with her
    const e = entOf(who); if (e === rory) { G.rory = true; }
    if (held && held !== e) AI.hold(held, false); held = e; AI.hold(e, true); e.hidden = false; e.room = G.room; e.state = 'idle'; e.stop && e.stop(); e.x = clamp(marina.x + (marina.x > ROOMS[G.room].w - 60 ? -30 : 30), 20, ROOMS[G.room].w - 20); e.y = marina.y; e.dir = Math.sign(marina.x - e.x) || 1; marina.dir = -e.dir;
    box.innerHTML = '';
    const pic = mk('img', 'st-pic'), cap = mk('div', 'st-cap'), dots = mk('div', 'st-dots'), prev = mk('button', 'st-nav l', '◀'), next = mk('button', 'st-nav r', '▶');
    const page = mk('div', 'st-page'); page.append(pic, cap);
    box.append(closeBtn(), page, prev, next, dots);
    let i = 0; const my = ++tok;
    function show(n) {
      i = n; const t = ++tok; const myT = t;
      if (i >= s.pages.length) return end();
      pic.src = img(s, i); cap.textContent = s.pages[i][0]; page.classList.remove('turn'); void page.offsetWidth; page.classList.add('turn'); Audio2.whoosh(false);
      dots.innerHTML = s.pages.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('');
      prev.style.visibility = i ? 'visible' : 'hidden';
      const pr = Audio2.voice('st_' + sp + '_' + s.id + '_' + (i + 1), sp, { cut: true }); UI.face(who, 'happy', pr);
      Promise.race([pr, new Promise(r => setTimeout(r, 30000))]).then(() => setTimeout(() => { if (tok === myT && box) show(i + 1); }, 900));
    }
    function end() {
      window.did && did('story'); page.innerHTML = '<div class="st-end">⭐<br><span>The End</span></div>'; dots.innerHTML = ''; next.style.visibility = 'hidden'; Audio2.jingle([0, 4, 7, 12, 16], 0.09);
      const again = press(mk('button', 'st-again', '🔁'), () => read(s, sp, who)), more = press(mk('button', 'st-again', '📚'), shelf), ok = press(mk('button', 'st-again go', '✅'), () => close(true, who));
      const row = mk('div', 'st-row'); row.append(again, more, ok); page.append(row);
    }
    press(prev, () => show(Math.max(0, i - 1))); press(next, () => show(i + 1));
    show(0);
  }
  window.openStory = open;
  setInterval(() => { if (box && (!document.getElementById('panel').classList.contains('hidden') || (window.Studio && Studio.active))) close(); }, 400);

  const _pa = propActions;
  propActions = function (p) { const a = _pa(p); if (p.a === 'books') a.unshift(A('📖', open)); return a; };

  const st = document.createElement('style'); st.textContent = `
#storyBox{position:absolute;inset:0;z-index:20;background:radial-gradient(circle at 50% 35%,#5a3d7a,#231a3a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:10px;font-family:'Lilita One','Arial Rounded MT Bold',sans-serif;color:#fff6dc}
#stage.storyon .facecard{z-index:25}
.st-x,.st-back{position:absolute;top:10px;left:10px;width:52px;height:52px;border-radius:16px;background:#fff;font-size:26px;padding:0;box-shadow:0 4px 0 rgba(0,0,0,.3);z-index:2}
.st-back{left:72px;color:#e2632b}
.st-h{font-size:40px;line-height:1}
.st-shelf{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;max-width:100%}
.st-book{position:relative;width:min(44vw,210px);padding:0;border-radius:14px;border:5px solid #fff6dc;background:#3a2a55;box-shadow:0 6px 0 rgba(0,0,0,.4);overflow:visible;display:flex;flex-direction:column}
.st-book img,.st-cover img{width:100%;display:block;image-rendering:pixelated;border-radius:8px 8px 0 0}
.st-book b{position:absolute;left:-10px;top:-12px;width:44px;height:44px;border-radius:50%;background:#fff6dc;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 rgba(0,0,0,.35);font-weight:400}
.st-book span,.st-cover span{font-size:15px;color:#fff6dc;padding:5px 6px 7px;line-height:1.1;font-family:inherit}
.st-cover{width:min(50vw,200px);border-radius:14px;border:5px solid #fff6dc;background:#3a2a55;display:flex;flex-direction:column;text-align:center}
.st-who{display:flex;gap:10px;justify-content:center}
.st-reader{width:min(21vw,104px);height:min(21vw,104px);border-radius:50%;border:5px solid #fff;background:#ffe9b8;padding:6px;box-shadow:0 6px 0 rgba(0,0,0,.35);animation:pulse .7s ease-in-out infinite alternate}
.st-reader canvas{width:100%;height:100%;image-rendering:pixelated}
.st-page{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:100%;max-height:100%}
.st-page.turn{animation:stturn .35s ease-out}
@keyframes stturn{from{opacity:0;transform:translateX(30px) rotate(1.5deg)}}
.st-pic{width:min(92vw,calc((100vh - 220px) * 1.5),620px);aspect-ratio:3/2;image-rendering:pixelated;border:6px solid #fff6dc;border-radius:14px;box-shadow:0 8px 0 rgba(0,0,0,.35);background:#3a2a55}
.st-cap{font-family:Georgia,'Times New Roman',serif;font-size:clamp(15px,2.6vmin,22px);line-height:1.3;text-align:center;max-width:min(92vw,620px);background:#fff6dc;color:#3a2440;border-radius:12px;padding:8px 12px}
.st-nav{position:absolute;top:42%;width:54px;height:84px;background:rgba(255,255,255,.9);font-size:24px;color:#e2632b;padding:0;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.st-nav.l{left:0;border-radius:0 20px 20px 0}.st-nav.r{right:0;border-radius:20px 0 0 20px}
.st-dots{display:flex;gap:6px}.st-dots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.3)}.st-dots i.on{background:#ffcf4a}
.st-end{font-size:70px;text-align:center;line-height:1}.st-end span{font-size:44px;color:#ffd35c}
.st-row{display:flex;gap:14px;margin-top:10px}.st-again{width:76px;height:76px;border-radius:22px;background:#fff;font-size:38px;padding:0;box-shadow:0 5px 0 rgba(0,0,0,.3)}.st-again.go{background:#7be07b}
@media (orientation:landscape){
  .st-pic{width:min(60vw,calc((100vh - 110px) * 1.5),620px)}
  .st-book{width:min(27vw,220px)}.st-h{font-size:30px}.st-cover{display:none}
  #storyBox{gap:6px}.st-cap{padding:5px 10px}
}`; document.head.append(st);
})();
