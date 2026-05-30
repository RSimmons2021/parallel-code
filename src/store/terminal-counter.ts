import type { Terminal } from './types';

let terminalCounter = 0;
let lastCreateTime = 0;

export function recordTerminalCreateAttempt(now = Date.now()): boolean {
  if (now - lastCreateTime < 300) return false;
  lastCreateTime = now;
  return true;
}

export function nextTerminalName(): string {
  terminalCounter++;
  return `Terminal ${terminalCounter}`;
}

export function syncTerminalCounterFromState(
  taskOrder: readonly string[],
  terminals: Record<string, Terminal>,
): void {
  let max = 0;
  for (const id of taskOrder) {
    const terminal = terminals[id];
    if (!terminal) continue;
    const match = terminal.name.match(/^Terminal (\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  terminalCounter = max;
}
