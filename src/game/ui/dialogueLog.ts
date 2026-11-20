/** Everything said recently, for the pause menu's DIALOGUE LOG (missed a line while skipping? it's here). */
export interface LogEntry {
  who: string;
  text: string;
  color?: number;
  dir?: boolean;
}

const MAX = 150;
const log: LogEntry[] = [];

export function logLine(e: LogEntry) {
  if (!e.text.trim()) return;
  const last = log[log.length - 1];
  if (last && last.who === e.who && last.text === e.text) return;
  log.push(e);
  if (log.length > MAX) log.splice(0, log.length - MAX);
}

export function dialogueLog(): readonly LogEntry[] {
  return log;
}
