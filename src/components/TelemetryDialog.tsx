import { For, Show, createMemo } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Divider, Metric } from './primitives';
import {
  store,
  toggleTelemetry,
  clearTelemetry,
  currentTelemetrySummary,
  PRICING,
  type TelemetryKind,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';

/**
 * Telemetry — estimated cost / token / latency for the Studio's LLM calls
 * (Eval Arena, the judge, and Fan-out auto-split). Composed from Instrument
 * primitives: every number is a tabular readout, every gap a grid token.
 * Numbers are approximations (tokens from char length, cost from a per-provider
 * price table) for relative comparison and budgeting, not billing.
 */

const KIND_LABEL: Record<TelemetryKind, string> = {
  eval: 'Eval cases',
  judge: 'LLM judge',
  autosplit: 'Auto-split',
  discovery: 'Discovery',
};

function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtMs(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TelemetryDialog() {
  const summary = createMemo(() => currentTelemetrySummary());
  const events = () => store.telemetry;
  const successPct = () =>
    summary().count ? Math.round((summary().okCount / summary().count) * 100) : 0;

  return (
    <Dialog
      open={store.showTelemetry}
      onClose={() => toggleTelemetry(false)}
      width="min(880px, 95vw)"
      labelledBy="telemetry-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <Stack
        style={{ padding: '22px 24px 20px', 'max-height': '88vh', 'overflow-y': 'auto' }}
        gap={0}
      >
        <Label>Studio · Observability</Label>
        <h2
          id="telemetry-title"
          style={{
            margin: `${space(1)} 0 ${space(1)}`,
            'font-family': font.display,
            'font-size': text('xl'),
            'font-weight': '700',
            color: theme.fg,
          }}
        >
          Cost &amp; Latency Telemetry
        </h2>
        <p
          style={{
            margin: `0 0 ${space(4)}`,
            'font-size': text('sm'),
            color: theme.fgMuted,
            'max-width': '74ch',
            'line-height': '1.5',
          }}
        >
          Estimated spend and timing for Studio LLM calls (Eval Arena, the judge, and Fan-out
          auto-split). Tokens are approximated from text length and cost from a per-provider price
          table — use these for relative comparison and budgeting, not billing.
        </p>

        <Show
          when={summary().count > 0}
          fallback={
            <Card
              pad={6}
              style={{ 'text-align': 'center', color: theme.fgMuted, 'font-size': text('sm') }}
            >
              No LLM calls recorded yet. Run an eval or a Fan-out auto-split and the metrics will
              show up here.
            </Card>
          }
        >
          {/* Headline readouts */}
          <Stack direction="row" gap={2} wrap>
            <Card grow rise>
              <Metric
                label="Est. cost"
                value={fmtUsd(summary().totalCostUsd)}
                sub={`${summary().count} calls`}
              />
            </Card>
            <Card grow rise>
              <Metric
                label="Tokens"
                value={fmtTokens(summary().totalTokens)}
                sub={`${fmtTokens(summary().promptTokens)} in · ${fmtTokens(summary().outputTokens)} out`}
              />
            </Card>
            <Card grow rise>
              <Metric label="Avg latency" value={fmtMs(summary().avgLatencyMs)} sub="per call" />
            </Card>
            <Card grow rise>
              <Metric label="p95 latency" value={fmtMs(summary().p95LatencyMs)} sub="slowest 5%" />
            </Card>
            <Card grow rise>
              <Metric
                label="Success"
                value={`${successPct()}%`}
                tone={
                  successPct() >= 90
                    ? theme.success
                    : successPct() >= 60
                      ? theme.warning
                      : theme.error
                }
                sub={`${summary().okCount}/${summary().count} ok`}
              />
            </Card>
          </Stack>

          {/* Per-feature breakdown */}
          <Label style={{ display: 'block', margin: `${space(5)} 0 ${space(2)}` }}>
            By feature
          </Label>
          <Stack gap={1}>
            <For each={summary().byKind}>
              {(b) => (
                <Card
                  pad={3}
                  radius={3}
                  style={{
                    display: 'grid',
                    'grid-template-columns': '1.4fr 0.7fr 1fr 1fr',
                    gap: space(2),
                    'align-items': 'center',
                    'font-size': text('sm'),
                  }}
                >
                  <span style={{ color: theme.fg, 'font-weight': '600' }}>
                    {KIND_LABEL[b.kind] ?? b.kind}
                  </span>
                  <span class="in-tnum" style={{ color: theme.fgMuted }}>
                    {b.count}×
                  </span>
                  <span class="in-tnum" style={{ color: theme.fgMuted, 'font-family': font.mono }}>
                    {fmtTokens(b.tokens)} tok
                  </span>
                  <span
                    class="in-tnum"
                    style={{ color: theme.fg, 'font-family': font.mono, 'text-align': 'right' }}
                  >
                    {fmtUsd(b.costUsd)} · {fmtMs(b.avgLatencyMs)}
                  </span>
                </Card>
              )}
            </For>
          </Stack>

          {/* Recent calls */}
          <Label style={{ display: 'block', margin: `${space(5)} 0 ${space(2)}` }}>
            Recent calls · {events().length}
          </Label>
          <Stack gap={1} style={{ 'max-height': '260px', 'overflow-y': 'auto' }}>
            <For each={events().slice(0, 60)}>
              {(e) => (
                <div
                  class="in-tnum"
                  style={{
                    display: 'grid',
                    'grid-template-columns': '52px 84px 1fr 70px 70px 56px',
                    gap: space(2),
                    'align-items': 'center',
                    padding: `${space(2)} ${space(3)}`,
                    'border-radius': 'var(--radius-2)',
                    'font-size': text('xs'),
                    'font-family': font.mono,
                    background: 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)',
                    'border-left': `2px solid ${e.ok ? theme.success : theme.error}`,
                    color: theme.fgMuted,
                  }}
                >
                  <span>{fmtTime(e.ts)}</span>
                  <span style={{ color: theme.fg }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span
                    style={{
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                  >
                    {e.label ?? e.provider}
                  </span>
                  <span style={{ 'text-align': 'right' }}>
                    {fmtTokens(e.promptTokens + e.outputTokens)} tok
                  </span>
                  <span style={{ 'text-align': 'right' }}>{fmtMs(e.latencyMs)}</span>
                  <span style={{ 'text-align': 'right', color: theme.fg }}>
                    {fmtUsd(e.costUsd)}
                  </span>
                </div>
              )}
            </For>
          </Stack>
        </Show>

        <Divider style={{ margin: `${space(5)} 0 ${space(3)}` }} />
        <Stack direction="row" gap={2} align="center">
          <span
            style={{ 'font-size': text('xs'), color: theme.fgSubtle, 'margin-right': 'auto' }}
            title="Estimated rates per 1M tokens"
          >
            Rates: Claude ${PRICING.claude.inputPerMTok}/${PRICING.claude.outputPerMTok} · MiniMax $
            {PRICING.minimax.inputPerMTok}/${PRICING.minimax.outputPerMTok} per Mtok (in/out, est.)
          </span>
          <Show when={summary().count > 0}>
            <Button variant="ghost" onClick={() => clearTelemetry()}>
              Clear
            </Button>
          </Show>
          <Button variant="secondary" onClick={() => toggleTelemetry(false)}>
            Close
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
