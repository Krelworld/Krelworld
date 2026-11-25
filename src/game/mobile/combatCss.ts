// PHONE MODE: the combat controls' styles (stage 2), added beside css.ts's at runtime, phones only.

export const COMBAT_STYLE_ID = "krel-mobile-combat-css";

export const COMBAT_CSS = `
/* ---- the fight's buttons (combat.ts): icons, a word under each for the first fights, fills, pulses */
.kt-c .kt-face{font-size:13px;letter-spacing:.5px;overflow:hidden}
.kt-c .kt-face svg{width:46%;height:46%;display:block;filter:drop-shadow(0 1px 1px #000)}
.kt-bcap{position:absolute;left:0;top:0;transform:translateX(-50%);white-space:nowrap;pointer-events:none;color:#fff;font-size:11px;
  letter-spacing:1px;line-height:1;padding:2px 5px;border-radius:6px;background:rgba(10,6,20,.55);text-shadow:0 1px 2px #000}
.kt-bcap:empty{display:none}
.kt-btn.see .kt-bcap{opacity:.45}
.kt-fire .kt-face{border-color:rgba(255,110,110,calc(var(--kt-a) + .3))}
.kt-fire.auto .kt-face{box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 0 5px rgba(255,90,90,.35)}
.kt-dodge .kt-face{border-color:rgba(103,232,249,calc(var(--kt-a) + .25))}
.kt-jump .kt-face{border-color:rgba(134,239,172,calc(var(--kt-a) + .35))}
.kt-jump svg{width:46%;height:46%}
.kt-swap .kt-face{border-color:rgba(103,232,249,calc(var(--kt-a) + .15))}
.kt-special .kt-face{border-color:rgba(192,132,252,calc(var(--kt-a) + .35));font-size:12px}
.kt-special .kt-fill{position:absolute;left:0;right:0;bottom:0;background:rgba(192,132,252,.38);pointer-events:none}
.kt-special .kt-w{position:relative}
.kt-ready .kt-face{border-color:#ffd23f;background:rgba(255,190,40,.42);color:#fff;font-size:14px;
  box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 12px rgba(255,210,63,.55)}
.kt-heal .kt-face{border-color:rgba(255,158,207,.85);background:rgba(120,20,70,.45)}
.kt-heal .kt-n,.kt-chip .kt-n{position:absolute;right:6%;bottom:6%;font-size:12px;line-height:1;color:#fff;text-shadow:0 1px 2px #000}
.kt-caction .kt-face{border-color:rgba(255,210,63,calc(var(--kt-a) + .25))}
.kt-close .kt-face{border-color:rgba(255,255,255,.8);background:rgba(10,6,20,.75);font-size:28px}
.kt-c.pop .kt-face{animation:kt-pop .22s ease-out}
.kt-c.pulse .kt-face{animation:kt-pulse .7s ease-in-out infinite}
.kt-c.pop.pulse .kt-face{animation:kt-pop .22s ease-out,kt-pulse .7s ease-in-out .22s infinite}
@keyframes kt-pulse{0%,100%{box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 0 0 rgba(255,210,63,.0)}50%{box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 0 11px rgba(255,210,63,.45)}}
.kt-c.dim .kt-face{opacity:.45}
.kt-c.dim.on .kt-face{opacity:.6}
/* chips: the weapon readout up top, the drinks / fart / SanMik line under the bars */
.kt-chip .kt-face{border-radius:12px;justify-content:flex-start;gap:5px;padding:0 8px;font-size:13px;text-align:left;letter-spacing:0}
.kt-chip .kt-ic{width:30px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;font-size:18px}
.kt-chip .kt-ic img{max-width:30px;max-height:24px;image-rendering:pixelated;filter:drop-shadow(0 1px 1px #000)}
.kt-chip .kt-tx{display:flex;flex-direction:column;min-width:0;gap:2px}
.kt-chip .kt-nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;opacity:.9}
/* the weapon chip: the gun's whole name on up to two lines (it was cut to "Fart Blast..."; P16) */
.kt-wchip .kt-nm{white-space:normal;font-size:11px;line-height:1.05;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.kt-wchip .kt-tx{gap:1px}
.kt-wchip .kt-am{font-size:12px;line-height:1}
.kt-chip .kt-am{font-size:13px;color:#ffe066}
.kt-chip .kt-am.low{color:#facc15}.kt-chip .kt-am.out{color:#ff7b7b}
.kt-wchip .kt-face{border-color:rgba(103,232,249,calc(var(--kt-a) + .25))}
.kt-dchip .kt-face{justify-content:center;padding:0 6px;font-size:13px;gap:4px;border-radius:10px}
/* the mash overlay (WONK YOUR THANG): every finger anywhere is a press */
.kt-mash{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;touch-action:none;display:none}
.kt-mash.show{display:block;pointer-events:auto}
`;
