// PHONE MODE: the bike's button in the walking controls (town and the Kreddle Strip only).
//
// One round button left of ACTION (slot `walkBike`), shown only while there's a bike to get on or off (the scene says
// so every frame through systems/bike.ts's BIKE; hidden indoors, in conversations, doors, shops, cutscenes and fights).
// The icon is a bike; the word under it says what a tap does: RIDE on foot, WALK on the bike. Lit while riding. The
// stick steers the bike; a tap on the button is the laptop's bike key (TOUCH.edges "bike", read by Controls.bike()).
// It pulses until it has been pressed once on this phone (research S10).
import { TOUCH } from "../ui/TouchControls";
import { BIKE, bikeAvailable } from "../systems/bike";
import { cueSeen, markCue } from "./cues";
import { bikeButtonWanted, bikeFace } from "./bikeLogic";
import { registerModeController, type TouchControl, type TouchLayer } from "./touchLayer";

export const BIKE_CSS = `
.kt-bike .kt-face{border-color:rgba(248,113,113,calc(var(--kt-a) + .25));flex-direction:column;gap:1px}
.kt-bike.riding .kt-face{background:rgba(220,38,38,.42);border-color:rgba(254,202,202,.95)}
.kt-bike svg{display:block;width:62%;height:auto}
.kt-bike .kt-bike-word{display:block;font:700 10px/1 system-ui,sans-serif;letter-spacing:.04em;color:#fff;text-shadow:0 1px 0 #000}
`;

export function pressBike() {
  TOUCH.edges.add("bike");
}

export function installBikeButton(layer: TouchLayer) {
  if (typeof document !== "undefined" && !document.getElementById("kt-bike-css")) {
    const st = document.createElement("style");
    st.id = "kt-bike-css";
    st.textContent = BIKE_CSS;
    document.head.appendChild(st);
  }
  let btn: TouchControl | null = null;
  const sync = (mode: string, legacyPad: boolean) => {
    if (!btn) return;
    const on = bikeButtonWanted(mode, legacyPad, bikeAvailable());
    btn.setHtml(bikeFace(BIKE.riding));
    btn.el.classList.toggle("riding", BIKE.riding);
    btn.el.classList.toggle("cue", on && !cueSeen("bike"));
    btn.show(on, true);
  };
  registerModeController({
    id: "bike",
    mode: "walk",
    enter: ({ decision }) => {
      btn =
        layer.control("bike") ??
        layer.addControl({
          id: "bike",
          slot: "walkBike",
          className: "kt-bike",
          html: bikeFace(false),
          haptic: "press",
          onDown: (c) => {
            if (!cueSeen("bike")) {
              markCue("bike");
              c.el.classList.remove("cue");
            }
            pressBike();
          },
        });
      sync(decision.mode, decision.legacyPad);
    },
    frame: ({ decision }) => sync(decision.mode, decision.legacyPad),
    leave: () => {
      btn?.show(false);
    },
  });
}
