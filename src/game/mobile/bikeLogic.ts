// PHONE MODE: the bike button's pure parts (unit-tested without a browser). See bike.ts.

const ICON = `<svg viewBox="0 0 32 20" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="13" r="5.5"/><circle cx="25" cy="13" r="5.5"/><path d="M7 13l6-8h9l3 8M13 5l3 8h-9M16 13l6-8M20 3h4"/></g></svg>`;

/** The button's face for "on foot" / "on the bike". */
export function bikeFace(riding: boolean): string {
  return `${ICON}<b class="kt-bike-word">${riding ? "WALK" : "RIDE"}</b>`;
}

/** Should the button be up? Walking controls, in a scene that has a bike to get on or off right now. */
export function bikeButtonWanted(mode: string, legacyPad: boolean, available: boolean): boolean {
  return mode === "walk" && !legacyPad && available;
}
