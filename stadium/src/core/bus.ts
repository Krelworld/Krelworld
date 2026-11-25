// Event log. Everything worth reacting to (commentary, tannoy, news, referees,
// bookmakers) is emitted here. Listeners are not part of saved state.
export interface GameEvent { type: string; t: number; [key: string]: any }
type Listener = (e: GameEvent) => void;

export class Bus {
  private listeners: Listener[] = [];
  /** Recent events, newest last. Kept short; it is a convenience, not saved state. */
  recent: GameEvent[] = [];
  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
  emit(e: GameEvent): void {
    this.recent.push(e);
    if (this.recent.length > 400) this.recent.splice(0, 100);
    for (const l of this.listeners) l(e);
  }
}
