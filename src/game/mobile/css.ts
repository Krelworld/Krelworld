// PHONE MODE: the page styles, added at runtime on phones only (index.html is never touched, and a laptop never gets
// this <style>). Everything is scoped to html.mobile or to the phone layer's own classes.

export const MOBILE_STYLE_ID = "krel-mobile-css";

export const MOBILE_CSS = `
html.mobile,html.mobile body{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent;overscroll-behavior:none;overflow:hidden;-webkit-text-size-adjust:100%}
/* centre the canvas once (Phaser centres it with margins; the page's own flex centring added a second offset) */
html.mobile #game{display:block;width:100%;height:100%;height:100dvh;touch-action:none;position:relative}
html.mobile #game>canvas{display:block}
html.mobile input,html.mobile textarea{-webkit-user-select:text;user-select:text;touch-action:manipulation}

/* ---- the touch layer */
.kt{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20;touch-action:none;overflow:hidden;
  font-family:"Krel Bold",system-ui,-apple-system,sans-serif;--kt-a:.3;-webkit-user-select:none;user-select:none}
.kt *{box-sizing:border-box}
.kt-probe{position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.kt-zone{position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;pointer-events:none;touch-action:none}
.kt.stick .kt-zone{pointer-events:auto}
.kt-stick{position:absolute;left:0;top:0;pointer-events:none;opacity:0;transition:opacity .15s}
.kt-stick.ghost{opacity:.55}
.kt-stick.live{opacity:1;transition:none}
.kt-base,.kt-knob{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none}
.kt-base{border:3px solid rgba(255,255,255,var(--kt-a));background:rgba(10,6,20,.16);
  box-shadow:0 0 0 2px rgba(0,0,0,.45),inset 0 0 0 2px rgba(0,0,0,.25)}
.kt-knob{background:rgba(255,255,255,calc(var(--kt-a) + .25));box-shadow:0 0 0 2px rgba(0,0,0,.45)}
.kt-stick.live .kt-base{border-color:rgba(255,255,255,.7)}
.kt-cap{position:absolute;left:0;top:0;width:200px;margin-left:-100px;text-align:center;color:#fff;font-size:13px;
  letter-spacing:1px;text-shadow:0 1px 2px #000,0 0 4px #000;opacity:.8;pointer-events:none;white-space:nowrap}
.kt-btn{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;display:none}
.kt-btn.show{display:block}
.kt-face{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;
  border:3px solid rgba(255,255,255,var(--kt-a));background:rgba(10,6,20,calc(var(--kt-a) * .9));
  box-shadow:0 0 0 2px rgba(0,0,0,.5);color:#fff;line-height:1;text-shadow:0 1px 2px #000,0 0 4px #000;
  transition:transform .08s,box-shadow .08s;pointer-events:none}
.kt-btn.on .kt-face{border-color:rgba(255,255,255,.7);background:rgba(10,6,20,.6);transform:scale(.93);
  box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 0 10px rgba(255,210,63,.32)}
/* the player or what they're at is under it: see-through in place (research C9); pressed still shows */
.kt-btn.see:not(.on) .kt-face{background:transparent;border-width:2px;border-color:rgba(255,255,255,.28);box-shadow:none;opacity:.7}
.kt-btn.see.kt-action:not(.on) .kt-face{border-color:rgba(255,210,63,.4)}
.kt-action .kt-face{border-color:rgba(255,210,63,calc(var(--kt-a) + .25))}
.kt-action.pop .kt-face{animation:kt-pop .22s ease-out}
.kt-sanmik .kt-face{border-color:rgba(176,196,255,calc(var(--kt-a) + .2));font-size:12px}
@keyframes kt-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.kt-bars{display:flex;gap:6px}.kt-bars i{display:block;width:6px;height:18px;background:#fff;border-radius:1px;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
/* tap areas (outside the stick zone): the prompt bubble, and the thing the prompt is about */
.kt-tap{position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;pointer-events:none;touch-action:none;display:none}
.kt-tap.show{display:block;pointer-events:auto}

/* ---- back to a fight with no pause menu: "tap to carry on" (the loop sleeps behind it) */
.kres{position:fixed;left:0;top:0;width:100%;height:100%;z-index:30;display:none;align-items:center;justify-content:center;
  background:rgba(6,3,12,.55);color:#fff;text-align:center;pointer-events:auto;touch-action:none;
  font-family:"Krel Bold",system-ui,-apple-system,sans-serif}
.kres.show{display:flex}
.kres-in{padding:14px 26px;border-radius:14px;background:rgba(23,15,38,.9);border:2px solid #ffd23f}
.kres-t{font-size:28px;color:#ffd23f;letter-spacing:2px}
.kres-s{font-size:16px;margin-top:6px;color:#e9e3ff}

/* ---- turn your phone sideways */
.krot{position:fixed;left:0;top:0;width:100%;height:100%;z-index:40;display:none;align-items:center;justify-content:center;
  background:#0b0710;color:#fff;text-align:center;pointer-events:auto;touch-action:none;
  font-family:"Krel Bold",system-ui,-apple-system,sans-serif;padding:24px;box-sizing:border-box}
.krot.show{display:flex}
.krot-in{max-width:340px}
.krot-phone{width:120px;height:120px;margin:0 auto 18px}
.krot-phone svg{width:100%;height:100%;animation:krot-turn 2.4s ease-in-out infinite}
@keyframes krot-turn{0%,20%{transform:rotate(0)}45%,75%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
.krot-title{font-size:26px;line-height:1.15;color:#ffd23f;letter-spacing:1px;margin-bottom:10px}
.krot-sub{font-size:16px;line-height:1.35;color:#e9e3ff;margin-bottom:14px}
.krot-hint{font-size:14px;line-height:1.4;color:#b9a8e0;font-family:system-ui,-apple-system,sans-serif}
.krot-extra:empty{display:none}
.krot-extra{margin-top:16px}
/* ---- Add to Home Screen guide (homeScreen.ts): landscape first, an upright version for the turn-your-phone screen */
.kah{position:fixed;left:0;top:0;width:100%;height:100%;z-index:45;display:none;align-items:center;justify-content:center;
  background:rgba(6,3,12,.93);box-sizing:border-box;color:#fff;touch-action:none;-webkit-user-select:none;user-select:none;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding:max(8px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(10px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
.kah.show{display:flex}
.kah *{box-sizing:border-box}
.kah-card{position:relative;width:100%;max-width:790px;max-height:100%;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;
  -webkit-overflow-scrolling:touch;background:#170f26;border:2px solid #ffd23f;border-radius:16px;padding:12px 16px;
  box-shadow:0 8px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:8px}
.kah-x{position:absolute;right:2px;top:2px;width:46px;height:46px;border:0;background:none;color:#fff;font-size:22px;line-height:1;
  opacity:.85;touch-action:manipulation}
.kah-head{display:flex;align-items:center;gap:12px;padding-right:42px}
.kah-app{display:inline-block;width:40px;height:40px;border-radius:9px;flex:none;
  background:#0b0710 url(apple-touch-icon.png) center/cover no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.3)}
.kah-title{font-family:"Krel Bold",system-ui,sans-serif;font-size:20px;line-height:1.1;color:#ffd23f;letter-spacing:.5px}
.kah-why{font-size:13px;line-height:1.3;color:#ddd3f7;margin-top:3px}
.kah-steps{list-style:none;margin:0;padding:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px}
.kah-step{position:relative;background:#24183d;border-radius:12px;padding:8px 8px 9px;display:flex;flex-direction:column;align-items:center;
  text-align:center;gap:5px;min-width:0}
.kah-n{position:absolute;left:6px;top:6px;width:20px;height:20px;border-radius:50%;background:#ffd23f;color:#170f26;font-weight:800;
  font-size:12px;line-height:20px;text-align:center}
.kah-ico{display:flex;align-items:center;justify-content:center;width:48px;height:40px;flex:none}
.kah-svg{width:34px;height:34px;display:block}
.kah-ico .kah-app{width:34px;height:34px;border-radius:8px}
.kah-word{display:inline-block;padding:5px 11px;border-radius:9px;background:#fff;color:#0a64e8;font-weight:700;font-size:15px;line-height:1.1}
.kah-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.kah-st{font-size:14px;line-height:1.2;font-weight:600}
.kah-st b{color:#ffd23f}
.kah-ss{font-size:12px;line-height:1.3;color:#bfb4e0}
.kah-ss b{color:#fff}
.kah-p{display:none}
.kah-fb{font-size:12.5px;line-height:1.3;color:#bfb4e0;text-align:center}
.kah-note{font-size:13px;line-height:1.3;color:#ffe48a;background:rgba(255,210,63,.1);border-left:3px solid #ffd23f;padding:5px 9px;border-radius:6px}
.kah-btns{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.kah-b{min-height:44px;padding:0 18px;border-radius:12px;border:2px solid rgba(255,255,255,.35);background:#2a1d45;color:#fff;
  font:700 15px/1 "Krel Bold",system-ui,sans-serif;letter-spacing:1px;touch-action:manipulation;transition:transform .08s}
.kah-main{background:#ffd23f;color:#170f26;border-color:#ffd23f;min-width:150px}
.kah-b.on,.kah-x.on{transform:scale(.95);filter:brightness(1.2)}
.kah-toast{position:absolute;left:50%;bottom:max(14px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#ffd23f;color:#170f26;
  font-weight:700;font-size:14px;padding:9px 14px;border-radius:10px;opacity:0;pointer-events:none;transition:opacity .25s;max-width:90%;text-align:center}
.kah-toast.show{opacity:1}
@media (max-height:370px){
  .kah-card{padding:8px 12px;gap:6px}.kah-title{font-size:18px}.kah-head .kah-app{width:34px;height:34px}
  .kah-ico{height:34px}.kah-svg{width:30px;height:30px}.kah-step{padding:6px 6px 7px;gap:3px}.kah-why{font-size:12.5px}
}
@media (max-height:350px){
  .kah-card{padding:6px 12px;gap:5px}.kah-ico{height:28px}.kah-svg{width:26px;height:26px}.kah-ico .kah-app{width:26px;height:26px}
  .kah-ss{line-height:1.2}.kah-step{padding:5px 6px 6px}
}
@media (orientation:portrait){
  .kah-card{max-width:440px}
  .kah-steps{grid-auto-flow:row;grid-auto-columns:auto}
  .kah-step{flex-direction:row;text-align:left;align-items:center;padding:8px 10px 8px 34px;gap:10px}
  .kah-n{top:50%;margin-top:-10px;left:8px}
  .kah-btns{justify-content:stretch}.kah-b{flex:1}
  .kah-l{display:none}.kah-p{display:inline}
}
.kah-rot{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 18px;border-radius:12px;border:2px solid #ffd23f;
  background:rgba(255,210,63,.12);color:#ffd23f;font:700 16px "Krel Bold",system-ui,sans-serif;touch-action:manipulation}
.kah-rot .kah-svg{width:24px;height:24px}

/* ---- ?mobilediag (diag.ts): touches go straight through it to the game, except on its little MOVE tab */
.kdiag{position:fixed;right:max(4px,env(safe-area-inset-right,0px));top:64px;z-index:50;max-width:min(380px,62vw);background:rgba(0,0,0,.66);
  color:#b8ffb0;font:10.5px/1.3 ui-monospace,Menlo,Consolas,monospace;padding:4px 7px 4px 7px;border-radius:6px;
  pointer-events:none;touch-action:none}
.kdiag-t{white-space:pre-wrap}
.kdiag-h{position:absolute;right:0;bottom:-30px;min-width:64px;height:30px;line-height:30px;padding:0 10px;border-radius:0 0 6px 6px;
  background:rgba(0,0,0,.8);color:#ffd23f;font:700 12px/30px system-ui,sans-serif;text-align:center;pointer-events:auto;touch-action:none}
.kdiag.pos1{top:4px;right:auto;left:max(4px,env(safe-area-inset-left,0px))}
.kdiag.pos2{top:auto;bottom:40px;right:auto;left:max(4px,env(safe-area-inset-left,0px))}
.kdiag.pos2 .kdiag-h,.kdiag.pos3 .kdiag-h{bottom:auto;top:-30px;border-radius:6px 6px 0 0}
.kdiag.pos3{top:auto;bottom:40px}
.kdiag b{color:#ffd23f;font-weight:700}
.kdiag .bad{color:#ff8a8a}

/* ---- conversations (dialogue.ts): SKIP / LOG / AUTO (and II) on the box's top edge; each pill's tap area is 44 tall */
.kd{position:fixed;left:0;top:0;z-index:22;display:none;gap:4px;pointer-events:none;touch-action:none;
  font-family:"Krel Bold",system-ui,-apple-system,sans-serif;-webkit-user-select:none;user-select:none}
.kd.show{display:flex}
.kd-pill{display:none;height:44px;padding:0;margin:0;border:0;background:none;pointer-events:auto;touch-action:manipulation;
  align-items:center;justify-content:center;color:#fff;font:inherit;-webkit-tap-highlight-color:transparent}
.kd-pill.show{display:flex}
.kd-pill span{display:flex;align-items:center;justify-content:center;width:100%;height:30px;border-radius:15px;font-size:12.5px;
  letter-spacing:.5px;background:rgba(14,10,26,.62);border:1.5px solid rgba(255,255,255,.42);box-shadow:0 0 0 1px rgba(0,0,0,.35);
  text-shadow:0 1px 0 #000;transition:transform .08s}
.kd-pill.on span{transform:scale(.92);background:rgba(255,210,63,.35);border-color:#ffd23f}
.kd-auto.lit span{background:rgba(255,210,63,.88);color:#170f26;border-color:#ffd23f;text-shadow:none}
.kd-skip.busy span{background:rgba(255,210,63,.5);border-color:#ffd23f;animation:kd-blink .5s ease-in-out infinite alternate}
@keyframes kd-blink{from{opacity:1}to{opacity:.55}}
.kdl{position:fixed;left:0;top:0;width:100%;height:100%;box-sizing:border-box;z-index:35;display:none;align-items:center;justify-content:center;
  background:rgba(6,3,14,.72);padding:max(8px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(8px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));
  touch-action:none;font-family:system-ui,-apple-system,sans-serif}
.kdl.show{display:flex}
.kdl *{box-sizing:border-box}
.kdl-card{display:flex;flex-direction:column;width:100%;max-width:680px;height:100%;background:#170f26;border:2px solid #ffd23f;
  border-radius:14px;overflow:hidden}
.kdl-head{display:flex;align-items:center;justify-content:space-between;flex:none;height:46px;padding-left:14px;border-bottom:1px solid #3a2c5c}
.kdl-title{font:700 16px "Krel Bold",system-ui,sans-serif;color:#ffd23f;letter-spacing:1px}
.kdl-x{width:52px;height:46px;border:0;background:none;color:#fff;font-size:22px;touch-action:manipulation}
.kdl-x.on{color:#ffd23f}
.kdl-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:6px 14px 14px}
.kdl-row{font-size:16px;line-height:1.35;color:#fff;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.kdl-row b{display:block;font:700 13px "Krel Bold",system-ui,sans-serif;letter-spacing:.5px;margin-bottom:2px}
.kdl-row.dir{color:#b9bdd0;font-style:italic}

/* ---- the Phone settings page (settingsPage.ts): two columns of 48 px rows, native scroll on a short screen */
.kps{position:fixed;left:0;top:0;width:100%;height:100%;box-sizing:border-box;z-index:44;display:none;align-items:stretch;justify-content:center;
  background:rgba(6,3,14,.8);padding:max(6px,env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) max(6px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));
  touch-action:none;font-family:system-ui,-apple-system,sans-serif;color:#fff;-webkit-user-select:none;user-select:none}
.kps.show{display:flex}
.kps *{box-sizing:border-box}
.kps-card{display:flex;flex-direction:column;width:100%;max-width:860px;background:#170f26;border:2px solid #ffd23f;border-radius:14px;overflow:hidden}
.kps-head{display:flex;align-items:center;gap:8px;flex:none;height:50px;padding:0 6px 0 14px;border-bottom:1px solid #3a2c5c}
.kps-title{flex:1;font:700 17px "Krel Bold",system-ui,sans-serif;color:#ffd23f;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kps-b{min-height:44px;padding:0 16px;border-radius:11px;border:2px solid rgba(255,255,255,.3);background:#2a1d45;color:#fff;
  font:700 14px "Krel Bold",system-ui,sans-serif;touch-action:manipulation}
.kps-done{background:#ffd23f;color:#170f26;border-color:#ffd23f;min-width:90px}
.kps-b.on{transform:scale(.95);filter:brightness(1.2)}
.kps-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:6px 10px 10px}
.kps-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}
.kps-row{display:flex;align-items:center;gap:8px;min-height:48px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.kps-t{flex:1 1 120px;min-width:0}
.kps-l{font-size:15px;font-weight:700;line-height:1.15}
.kps-h{font-size:12px;line-height:1.25;color:#bfb4e0;margin-top:1px}
.kps-c{flex:none;display:flex;align-items:center;gap:4px}
.kps-o{min-width:44px;height:44px;padding:0 9px;border-radius:10px;border:2px solid rgba(255,255,255,.25);background:#24183d;color:#fff;
  font:700 12.5px "Krel Bold",system-ui,sans-serif;touch-action:manipulation}
.kps-o.sel{background:#ffd23f;color:#170f26;border-color:#ffd23f}
.kps-o.on{filter:brightness(1.25);transform:scale(.95)}
.kps-v{min-width:58px;text-align:center;font:700 14px "Krel Bold",system-ui,sans-serif;color:#ffd23f}
.kps-tog{touch-action:manipulation}
.kps-tog.on{background:rgba(255,255,255,.05)}
.kps-sw{display:block;position:relative;width:58px;height:32px;border-radius:16px;background:#3a2c5c;border:2px solid rgba(255,255,255,.3)}
.kps-sw i{position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .12s}
.kps-tog.sel .kps-sw{background:#ffd23f;border-color:#ffd23f}
.kps-tog.sel .kps-sw i{left:29px;background:#170f26}
.kps-note{margin-top:8px;padding:6px 10px;border-radius:8px;background:rgba(255,210,63,.1);border-left:3px solid #ffd23f;font-size:13px;color:#ffe48a;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kps-pad{margin-top:10px;font-size:13.5px;color:#d9d0f5;text-align:center}

/* ---- first-time cues (cues.ts, research S10): the idle stick and ACTION pulse until first used; the idle stick goes
   see-through where it can't move off the player */
.kt-stick.ghost.cue .kt-base{animation:kt-cue 1.3s ease-in-out infinite}
@keyframes kt-cue{0%,100%{transform:scale(1);border-color:rgba(255,255,255,var(--kt-a))}50%{transform:scale(1.1);border-color:rgba(255,210,63,.85);box-shadow:0 0 0 3px rgba(255,210,63,.25)}}
.kt-btn.cue:not(.on) .kt-face{animation:kt-cue-btn 1.1s ease-in-out infinite}
@keyframes kt-cue-btn{0%,100%{box-shadow:0 0 0 0 rgba(255,210,63,0)}50%{box-shadow:0 0 0 7px rgba(255,210,63,.45)}}
.kt-stick.ghost.see{opacity:.25}
`;
