import { DT } from "./types";

/** Turns uneven frame times into fixed simulation steps. timeScale gives fast-forward. */
export class Stepper {
  private acc = 0;
  timeScale = 1;
  /** Returns how many steps were run. */
  advance(realSeconds: number, step: () => void, maxSteps = 240): number {
    this.acc += Math.min(realSeconds, 0.25) * this.timeScale;
    let n = 0;
    while (this.acc >= DT && n < maxSteps) { step(); this.acc -= DT; n++; }
    if (n === maxSteps) this.acc = 0;
    return n;
  }
}
