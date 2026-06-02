import { normalizeCurrentFrame } from '../store/taskStatus';

const STARTUP_BLOCKING_PATTERNS: RegExp[] = [
  /\bmodel:\s*loading\b/i,
  /\bBooting\s+MCP\s+servers?\b/i,
  /\bStarting\s+MCP\s+servers?\b/i,
];

export function isStartupBlockingAutoSend(tail: string): boolean {
  const frame = normalizeCurrentFrame(tail);
  // An empty frame means a screen-clear or cursor-home was just emitted but
  // the new frame content hasn't arrived yet (mid-redraw).  Treat this as
  // blocking so we don't start stability checks against an empty snapshot
  // that will immediately fail once real content fills in.
  if (!frame) return true;
  return STARTUP_BLOCKING_PATTERNS.some((re) => re.test(frame));
}

export function shouldAbortInitialPromptAfterTimeout(params: {
  elapsedMs: number;
  maxWaitMs: number;
  coordinatedBy: string | undefined;
  tail: string;
}): boolean {
  if (params.elapsedMs <= params.maxWaitMs) return false;
  if (params.coordinatedBy) return false;
  return Boolean(normalizeCurrentFrame(params.tail));
}
