import { store, setStore } from './core';
import { askOnce, type AskProvider } from '../lib/ask-once';

/**
 * Cost / token / latency telemetry for the Studio's LLM calls.
 *
 * Every one-shot LLM call routed through `trackedAskOnce` records a lightweight
 * event: which feature made it, how long it took, and an *estimate* of the
 * tokens and dollar cost. Token counts are estimated from character length
 * (~4 chars/token) and cost from a per-provider price table — the streaming
 * `AskAboutCode` IPC does not surface real usage, so these are honest
 * approximations meant for relative comparison and budgeting, not billing.
 */

export type TelemetryKind = 'eval' | 'judge' | 'autosplit';

export interface TelemetryEvent {
  id: string;
  ts: number; // epoch ms
  kind: TelemetryKind;
  label?: string; // short context, e.g. a case input or module name
  projectId?: string;
  provider: AskProvider;
  latencyMs: number;
  promptTokens: number; // estimated
  outputTokens: number; // estimated
  costUsd: number; // estimated
  ok: boolean;
}

/** Keep telemetry bounded so it stays cheap to persist and render. */
const MAX_EVENTS = 300;

/** ~4 characters per token is the standard rough heuristic for English text. */
export function estimateTokens(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 4);
}

/**
 * Estimated price per 1M tokens, in USD. The `claude` provider runs through the
 * Claude Code CLI (subscription-billed), so its figure is a notional
 * API-equivalent (Sonnet-class) cost for budgeting, not an actual charge.
 */
export const PRICING: Record<AskProvider, { inputPerMTok: number; outputPerMTok: number }> = {
  claude: { inputPerMTok: 3, outputPerMTok: 15 },
  minimax: { inputPerMTok: 0.2, outputPerMTok: 1.1 },
};

export function estimateCostUsd(
  provider: AskProvider,
  promptTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[provider] ?? PRICING.claude;
  return (promptTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1_000_000;
}

export function recordLLMCall(opts: {
  kind: TelemetryKind;
  label?: string;
  projectId?: string;
  provider: AskProvider;
  latencyMs: number;
  promptChars: number;
  outputChars: number;
  ok: boolean;
}): void {
  const promptTokens = estimateTokens(opts.promptChars);
  const outputTokens = estimateTokens(opts.outputChars);
  const event: TelemetryEvent = {
    id: crypto.randomUUID().slice(0, 8),
    ts: Date.now(),
    kind: opts.kind,
    label: opts.label?.slice(0, 80),
    projectId: opts.projectId,
    provider: opts.provider,
    latencyMs: Math.round(opts.latencyMs),
    promptTokens,
    outputTokens,
    costUsd: estimateCostUsd(opts.provider, promptTokens, outputTokens),
    ok: opts.ok,
  };
  setStore('telemetry', (prev) => [event, ...prev].slice(0, MAX_EVENTS));
}

export function clearTelemetry(): void {
  setStore('telemetry', []);
}

/**
 * `askOnce` wrapped with timing + telemetry recording. Studio features should
 * call this instead of `askOnce` directly so every LLM call is metered.
 */
export async function trackedAskOnce(
  prompt: string,
  cwd: string,
  provider: AskProvider,
  meta: { kind: TelemetryKind; label?: string; projectId?: string },
  timeoutMs?: number,
): Promise<string> {
  const start = performance.now();
  let output = '';
  let ok = true;
  try {
    output = await askOnce(prompt, cwd, provider, timeoutMs);
    return output;
  } catch (e) {
    ok = false;
    throw e;
  } finally {
    recordLLMCall({
      ...meta,
      provider,
      latencyMs: performance.now() - start,
      promptChars: prompt.length,
      outputChars: output.length,
      ok,
    });
  }
}

export interface TelemetryKindBreakdown {
  kind: TelemetryKind;
  count: number;
  costUsd: number;
  tokens: number;
  avgLatencyMs: number;
}

export interface TelemetrySummary {
  count: number;
  okCount: number;
  totalCostUsd: number;
  totalTokens: number;
  promptTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  byKind: TelemetryKindBreakdown[];
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(p * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

/** Aggregate the recorded events into headline numbers + a per-feature table. */
export function telemetrySummary(events: TelemetryEvent[]): TelemetrySummary {
  const count = events.length;
  const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const totalLatency = latencies.reduce((s, v) => s + v, 0);

  const byKindMap = new Map<
    TelemetryKind,
    { count: number; cost: number; tokens: number; lat: number }
  >();
  let totalCostUsd = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  let okCount = 0;
  for (const e of events) {
    totalCostUsd += e.costUsd;
    promptTokens += e.promptTokens;
    outputTokens += e.outputTokens;
    if (e.ok) okCount++;
    const agg = byKindMap.get(e.kind) ?? { count: 0, cost: 0, tokens: 0, lat: 0 };
    agg.count++;
    agg.cost += e.costUsd;
    agg.tokens += e.promptTokens + e.outputTokens;
    agg.lat += e.latencyMs;
    byKindMap.set(e.kind, agg);
  }

  const byKind: TelemetryKindBreakdown[] = [...byKindMap.entries()]
    .map(([kind, a]) => ({
      kind,
      count: a.count,
      costUsd: a.cost,
      tokens: a.tokens,
      avgLatencyMs: a.count ? a.lat / a.count : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    count,
    okCount,
    totalCostUsd,
    totalTokens: promptTokens + outputTokens,
    promptTokens,
    outputTokens,
    avgLatencyMs: count ? totalLatency / count : 0,
    p95LatencyMs: percentile(latencies, 0.95),
    byKind,
  };
}

/** Live summary over the current store, for the dialog. */
export function currentTelemetrySummary(): TelemetrySummary {
  return telemetrySummary(store.telemetry);
}
