import { For, Show, createMemo } from 'solid-js';
import { Dialog } from './Dialog';
import {
  store,
  toggleTelemetry,
  clearTelemetry,
  currentTelemetrySummary,
  PRICING,
  type TelemetryKind,
} from '../store/store';
import { theme } from '../lib/theme';

/**
 * Telemetry — estimated cost / token / latency for the Studio's LLM calls
 * (Eval Arena, the judge, and Fan-out auto-split). Numbers are approximations
 * (tokens from char length, cost from a per-provider price table) for relative
 * comparison and budgeting, not billing.
 */

const KIND_LABEL: Record<TelemetryKind, string> = {
  eval: 'Eval cases',
  judge: 'LLM judge',
  autosplit: 'Auto-split',
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

  const cardLabel = {
    'font-family': 'var(--font-mono)',
    'text-transform': 'uppercase' as const,
    'letter-spacing': '0.12em',
    'font-size': '9.5px',
    color: theme.fgSubtle,
    margin: '0 0 4px',
  };
  const cardValue = {
    'font-family': 'var(--font-display)',
    'font-size': '22px',
    'font-weight': '700',
    color: theme.fg,
    'line-height': '1.1',
  };

  const Card = (props: { label: string; value: string; sub?: string }) => (
    <div class="lg-glass" style={{ padding: '12px 14px', 'border-radius': '12px', flex: '1' }}>
      <div style={cardLabel}>{props.label}</div>
      <div style={cardValue}>{props.value}</div>
      <Show when={props.sub}>
        <div style={{ 'font-size': '11px', color: theme.fgMuted, 'margin-top': '3px' }}>
          {props.sub}
        </div>
      </Show>
    </div>
  );

  return (
    <Dialog
      open={store.showTelemetry}
      onClose={() => toggleTelemetry(false)}
      width="min(880px, 95vw)"
      labelledBy="telemetry-title"
    >
      <div style={{ padding: '22px 24px 20px', 'max-height': '88vh', 'overflow-y': 'auto' }}>
        <span class="lg-label">Studio · Observability</span>
        <h2
          id="telemetry-title"
          style={{
            margin: '2px 0 4px',
            'font-family': 'var(--font-display)',
            'font-size': '20px',
            'font-weight': '700',
            color: theme.fg,
          }}
        >
          Cost &amp; Latency Telemetry
        </h2>
        <p
          style={{
            margin: '0 0 16px',
            'font-size': '13px',
            color: theme.fgMuted,
            'max-width': '74ch',
          }}
        >
          Estimated spend and timing for Studio LLM calls (Eval Arena, the judge, and Fan-out
          auto-split). Tokens are approximated from text length and cost from a per-provider price
          table — use these for relative comparison and budgeting, not billing.
        </p>

        <Show
          when={summary().count > 0}
          fallback={
            <div
              class="lg-glass"
              style={{
                padding: '28px',
                'border-radius': '12px',
                'text-align': 'center',
                color: theme.fgMuted,
                'font-size': '13px',
              }}
            >
              No LLM calls recorded yet. Run an eval or a Fan-out auto-split and the metrics will
              show up here.
            </div>
          }
        >
          {/* Headline cards */}
          <div
            style={{ display: 'flex', gap: '10px', 'margin-bottom': '10px', 'flex-wrap': 'wrap' }}
          >
            <Card
              label="Est. cost"
              value={fmtUsd(summary().totalCostUsd)}
              sub={`${summary().count} calls`}
            />
            <Card
              label="Tokens"
              value={fmtTokens(summary().totalTokens)}
              sub={`${fmtTokens(summary().promptTokens)} in · ${fmtTokens(summary().outputTokens)} out`}
            />
            <Card label="Avg latency" value={fmtMs(summary().avgLatencyMs)} sub="per call" />
            <Card label="p95 latency" value={fmtMs(summary().p95LatencyMs)} sub="slowest 5%" />
            <Card
              label="Success"
              value={`${summary().count ? Math.round((summary().okCount / summary().count) * 100) : 0}%`}
              sub={`${summary().okCount}/${summary().count} ok`}
            />
          </div>

          {/* Per-feature breakdown */}
          <span class="lg-label" style={{ display: 'block', margin: '16px 0 8px' }}>
            By feature
          </span>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <For each={summary().byKind}>
              {(b) => (
                <div
                  class="lg-glass"
                  style={{
                    display: 'grid',
                    'grid-template-columns': '1.4fr 0.7fr 1fr 1fr',
                    gap: '8px',
                    'align-items': 'center',
                    padding: '9px 12px',
                    'border-radius': '10px',
                    'font-size': '12.5px',
                  }}
                >
                  <span style={{ color: theme.fg, 'font-weight': '600' }}>
                    {KIND_LABEL[b.kind] ?? b.kind}
                  </span>
                  <span style={{ color: theme.fgMuted }}>{b.count}×</span>
                  <span style={{ color: theme.fgMuted, 'font-family': 'var(--font-mono)' }}>
                    {fmtTokens(b.tokens)} tok
                  </span>
                  <span
                    style={{
                      color: theme.fg,
                      'font-family': 'var(--font-mono)',
                      'text-align': 'right',
                    }}
                  >
                    {fmtUsd(b.costUsd)} · {fmtMs(b.avgLatencyMs)}
                  </span>
                </div>
              )}
            </For>
          </div>

          {/* Recent events */}
          <span class="lg-label" style={{ display: 'block', margin: '16px 0 8px' }}>
            Recent calls · {events().length}
          </span>
          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '4px',
              'max-height': '260px',
              'overflow-y': 'auto',
            }}
          >
            <For each={events().slice(0, 60)}>
              {(e) => (
                <div
                  style={{
                    display: 'grid',
                    'grid-template-columns': '52px 84px 1fr 70px 70px 56px',
                    gap: '8px',
                    'align-items': 'center',
                    padding: '6px 10px',
                    'border-radius': '8px',
                    'font-size': '11.5px',
                    'font-family': 'var(--font-mono)',
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
          </div>
        </Show>

        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'flex-end',
            gap: '10px',
            'margin-top': '20px',
          }}
        >
          <span
            style={{ 'font-size': '11px', color: theme.fgSubtle, 'margin-right': 'auto' }}
            title="Estimated rates per 1M tokens"
          >
            Rates: Claude ${PRICING.claude.inputPerMTok}/${PRICING.claude.outputPerMTok} · MiniMax $
            {PRICING.minimax.inputPerMTok}/${PRICING.minimax.outputPerMTok} per Mtok (in/out, est.)
          </span>
          <Show when={summary().count > 0}>
            <button
              onClick={() => clearTelemetry()}
              style={{
                padding: '9px 16px',
                background: 'transparent',
                border: `1px solid ${theme.border}`,
                'border-radius': '8px',
                color: theme.fgMuted,
                cursor: 'pointer',
                'font-size': '13px',
              }}
            >
              Clear
            </button>
          </Show>
          <button
            onClick={() => toggleTelemetry(false)}
            style={{
              padding: '9px 18px',
              background: theme.bgInput,
              border: `1px solid ${theme.border}`,
              'border-radius': '8px',
              color: theme.fg,
              cursor: 'pointer',
              'font-size': '14px',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
