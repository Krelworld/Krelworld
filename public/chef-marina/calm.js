// One gentle interruption at a time. Crying, poops, wishes and requests all share a single
// budget, and none of them start while Marina is busy with a book, cooking, drawing, dress-up, TV or a fort.
let lastPing = 0;
function inActivity() {
  const gone = id => { const n = document.getElementById(id); return !n || n.classList.contains('hidden'); };
  return typeof marina === 'undefined' || !gone('title') || !gone('panel') || !!(window.Studio && Studio.active) || !!document.querySelector('#storyBox,#stkBox,.fortbar,.fortin')
    || !!G.busy || !!G.sceneOn || !!G.tidy || !!G.chase || !!G.tv || !!(G.fort && G.fort.inside);
}
function pingOk(gap) { return !inActivity() && E.t - lastPing > (gap || 75); }
function ping() { lastPing = E.t; }
(function () {
  let wasCry = false, wasPoop = false, wasNappy = false, quietFor = 0;
  setInterval(() => {
    if (typeof marina === 'undefined' || typeof miles === 'undefined') return;
    if (!document.getElementById('title').classList.contains('hidden')) { lastPing = E.t - 30; return; }   // nothing for the first 45 seconds of a game
    const act = inActivity();
    if (!pingOk(75)) { if (!miles.crying) miles.cryT = Math.max(miles.cryT, 20); G.poopOkAt = Math.max(G.poopOkAt || 0, E.t + 20); }
    // deep in a screen (book, cooking, drawing, dress-up): a crying baby settles himself rather than nagging
    const screen = !document.getElementById('panel').classList.contains('hidden') || !!(window.Studio && Studio.active) || !!document.getElementById('storyBox');
    quietFor = screen ? quietFor + 0.5 : 0;
    if (screen && miles.crying && quietFor > 1) { miles.crying = false; miles.cryT = 150 + Math.random() * 100; }
    if (miles.crying && !wasCry) ping(); if (G.poop && !wasPoop) { ping(); G.poopOkAt = E.t + 360; } if (miles.poopy && !wasNappy) ping();
    wasCry = !!miles.crying; wasPoop = !!G.poop; wasNappy = !!miles.poopy;
  }, 500);
})();
