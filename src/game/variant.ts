// Which build this is. `VITE_KREL_ALT=1` (npm run build:alt / dev:alt) makes the other cut of the game from the same
// code: Polson does the following-you-about for everyone, Luke and Jenko take the beatings that were Mikey's, and Mikey
// is simply one of the lads. Off (the normal build), nothing changes. The name and branding are the same in both.
// `import.meta.env` is missing outside Vite (plain node), hence the fallback.
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export const ALT: boolean = env.VITE_KREL_ALT === "1";

let alt = ALT;
/** Is this the ALT build? (A function, so tests can flip it with setAltForTests.) */
export function isAlt(): boolean {
  return alt;
}
/** Tests only: pretend to be the other build. */
export function setAltForTests(v: boolean) {
  alt = v;
}

/** Every localStorage key goes through this, so the two builds never read each other's saves, even on one origin. */
export function storageKey(k: string): string {
  return ALT ? `alt:${k}` : k;
}
