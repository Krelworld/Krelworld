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
`;
