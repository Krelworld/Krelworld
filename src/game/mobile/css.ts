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
.kt.walk .kt-zone{pointer-events:auto}
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
.kt-action .kt-face{border-color:rgba(255,210,63,calc(var(--kt-a) + .25))}
.kt-action.pop .kt-face{animation:kt-pop .22s ease-out}
.kt-sanmik .kt-face{border-color:rgba(176,196,255,calc(var(--kt-a) + .2));font-size:12px}
@keyframes kt-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.kt-bars{display:flex;gap:6px}.kt-bars i{display:block;width:6px;height:18px;background:#fff;border-radius:1px;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.kt-bubble{position:absolute;left:0;top:0;width:100px;height:100px;transform-origin:0 0;pointer-events:none;touch-action:none}
.kt.walk .kt-bubble.show{pointer-events:auto}

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

/* ---- ?mobilediag (diag.ts) */
.kdiag{position:fixed;left:max(4px,env(safe-area-inset-left,0px));top:4px;z-index:50;max-width:min(380px,62vw);background:rgba(0,0,0,.74);
  color:#b8ffb0;font:10.5px/1.3 ui-monospace,Menlo,Consolas,monospace;padding:4px 7px;border-radius:6px;white-space:pre-wrap;
  pointer-events:auto;touch-action:none;-webkit-user-select:text;user-select:text}
.kdiag.pos1{top:auto;bottom:24px}
.kdiag.pos2{left:auto;right:max(4px,env(safe-area-inset-right,0px));top:auto;bottom:24px}
.kdiag.pos3{left:auto;right:max(4px,env(safe-area-inset-right,0px));top:64px}
.kdiag b{color:#ffd23f;font-weight:700}
.kdiag .bad{color:#ff8a8a}
`;
