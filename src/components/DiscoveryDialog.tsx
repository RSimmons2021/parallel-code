import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Field, Input, Textarea } from './primitives';
import {
  store,
  toggleDiscovery,
  getDiscovery,
  getOrCreateDiscovery,
  updateDiscoveryFields,
  composeDiscoveryBrief,
  refineDiscoveryBrief,
  emptyStep,
  sendSpecToFanout,
  captureAsset,
  showNotification,
  type StepActor,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';

const ACTORS: { id: StepActor; label: string }[] = [
  { id: 'human', label: 'human' },
  { id: 'system', label: 'system' },
  { id: 'agent', label: 'agent' },
];

/**
 * Discovery → Spec canvas — map how the client works today (steps, actors,
 * systems, rules, the painful step), then synthesize a build brief that flows
 * into Fan-out. The studio's front door: map the workflow, then aim the agent.
 */
export function DiscoveryDialog() {
  const [refined, setRefined] = createSignal<string | null>(null);
  const [refining, setRefining] = createSignal(false);
  const [error, setError] = createSignal('');

  const projectId = () => store.lastProjectId ?? store.projects[0]?.id;

  createEffect(() => {
    const pid = projectId();
    if (store.showDiscovery && pid) getOrCreateDiscovery(pid);
  });

  const disc = createMemo(() => {
    const pid = projectId();
    return pid ? getDiscovery(pid) : undefined;
  });

  const set = (patch: Parameters<typeof updateDiscoveryFields>[1]) => {
    const d = disc();
    if (d) {
      updateDiscoveryFields(d.id, patch);
      setRefined(null); // edits invalidate an AI refinement
    }
  };

  const steps = () => disc()?.steps ?? [];
  const updateStep = (i: number, patch: Partial<ReturnType<typeof emptyStep>>) => {
    const d = disc();
    if (d) set({ steps: d.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };
  const addStep = () => {
    const d = disc();
    if (d) set({ steps: [...d.steps, emptyStep()] });
  };
  const removeStep = (i: number) => {
    const d = disc();
    if (d) set({ steps: d.steps.filter((_, idx) => idx !== i) });
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const d = disc();
    if (!d) return;
    const j = i + dir;
    if (j < 0 || j >= d.steps.length) return;
    const next = [...d.steps];
    [next[i], next[j]] = [next[j], next[i]];
    set({ steps: next });
  };

  const autoBrief = createMemo(() => {
    const d = disc();
    return d ? composeDiscoveryBrief(d) : '';
  });
  const briefText = () => refined() ?? autoBrief();

  const clientName = () => disc()?.clientName ?? '';
  const processName = () => disc()?.process ?? '';
  const objective = () => disc()?.objective ?? '';
  const rules = () => disc()?.rules ?? '';
  const outOfScope = () => disc()?.outOfScope ?? '';

  const copyBrief = async () => {
    await navigator.clipboard.writeText(briefText());
    showNotification('Build brief copied');
  };
  const toFanout = () => sendSpecToFanout(briefText());
  const saveToRegistry = () => {
    const d = disc();
    if (!d) return;
    captureAsset({
      kind: 'prompt',
      name: `${d.process || d.clientName || 'Client'} build brief`,
      body: briefText(),
      description: 'Synthesized from a Discovery workflow map',
      tags: ['discovery', 'spec', 'brief'],
    });
    showNotification('Brief saved to registry');
  };
  const refine = async () => {
    const d = disc();
    if (!d) return;
    setRefining(true);
    setError('');
    try {
      setRefined(await refineDiscoveryBrief(d, store.askCodeProvider));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  return (
    <Dialog
      open={store.showDiscovery}
      onClose={() => toggleDiscovery(false)}
      width="min(1080px, 96vw)"
      labelledBy="discovery-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <div
        style={{
          display: 'grid',
          'grid-template-columns': '1.15fr 1fr',
          height: '82vh',
          'max-height': '820px',
        }}
      >
        {/* ── Left: the workflow map ─────────────────────────────────────── */}
        <Stack
          gap={3}
          style={{
            padding: `${space(5)} ${space(5)} ${space(4)}`,
            'overflow-y': 'auto',
            'border-right': `1px solid var(--glass-hairline, ${theme.border})`,
            'min-height': '0',
          }}
        >
          <div>
            <Label>Studio · Discovery</Label>
            <h2
              id="discovery-title"
              style={{
                margin: `${space(1)} 0 ${space(1)}`,
                'font-family': font.display,
                'font-size': text('xl'),
                'font-weight': '700',
                color: theme.fg,
              }}
            >
              Discovery → Spec
            </h2>
            <p
              style={{
                margin: '0',
                'font-size': text('sm'),
                color: theme.fgMuted,
                'max-width': '60ch',
                'line-height': '1.5',
              }}
            >
              Map how the client works <em>today</em> — the steps, who does each, the systems they
              touch, and the painful one. The brief on the right is synthesized from it.
            </p>
          </div>

          <Stack direction="row" gap={2}>
            <Field label="Client" style={{ flex: '1' }}>
              <Input
                value={clientName()}
                onInput={(e) => set({ clientName: e.currentTarget.value })}
                placeholder="Acme Co."
              />
            </Field>
            <Field label="Process" style={{ flex: '1' }}>
              <Input
                value={processName()}
                onInput={(e) => set({ process: e.currentTarget.value })}
                placeholder="B2B support triage"
              />
            </Field>
          </Stack>

          <Field label="Objective (one sentence)">
            <Input
              value={objective()}
              onInput={(e) => set({ objective: e.currentTarget.value })}
              placeholder="Cut support triage time by auto-categorizing and drafting replies."
            />
          </Field>

          {/* Workflow steps */}
          <Stack
            direction="row"
            align="center"
            justify="space-between"
            style={{ 'margin-top': space(2) }}
          >
            <Label>Workflow steps · today</Label>
            <Button variant="ghost" size="sm" onClick={addStep}>
              + Add step
            </Button>
          </Stack>

          <Stack gap={2}>
            <For each={steps()}>
              {(s, i) => (
                <Card pad={2} radius={3}>
                  <Stack direction="row" align="center" gap={2}>
                    <span
                      class="in-tnum"
                      style={{
                        'font-family': font.mono,
                        'font-size': text('xs'),
                        color: theme.fgSubtle,
                        width: '16px',
                        'text-align': 'right',
                      }}
                    >
                      {i() + 1}
                    </span>
                    <Input
                      value={s.name}
                      onInput={(e) => updateStep(i(), { name: e.currentTarget.value })}
                      placeholder="Step, e.g. Triage / categorize"
                      style={{ flex: '1.4' }}
                    />
                    <select
                      class="in-input"
                      value={s.actor}
                      onChange={(e) =>
                        updateStep(i(), { actor: e.currentTarget.value as StepActor })
                      }
                      style={{ width: 'auto' }}
                      title="Who does this step (or should)"
                    >
                      <For each={ACTORS}>{(a) => <option value={a.id}>{a.label}</option>}</For>
                    </select>
                    <Input
                      value={s.systems}
                      onInput={(e) => updateStep(i(), { systems: e.currentTarget.value })}
                      placeholder="Systems"
                      style={{ flex: '1' }}
                    />
                    <button
                      class="in-press"
                      title={
                        s.isPain ? 'Marked as the pain point' : 'Mark as the painful / target step'
                      }
                      onClick={() => updateStep(i(), { isPain: !s.isPain })}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        'font-size': text('sm'),
                        color: s.isPain ? theme.warning : theme.fgSubtle,
                      }}
                    >
                      ⚑
                    </button>
                    <Stack gap={0} style={{ 'flex-shrink': '0' }}>
                      <button
                        class="in-press"
                        title="Move up"
                        onClick={() => moveStep(i(), -1)}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          color: theme.fgSubtle,
                          'font-size': '9px',
                          'line-height': '1',
                        }}
                      >
                        ▲
                      </button>
                      <button
                        class="in-press"
                        title="Move down"
                        onClick={() => moveStep(i(), 1)}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          color: theme.fgSubtle,
                          'font-size': '9px',
                          'line-height': '1',
                        }}
                      >
                        ▼
                      </button>
                    </Stack>
                    <button
                      class="in-press"
                      title="Remove step"
                      onClick={() => removeStep(i())}
                      style={{ all: 'unset', cursor: 'pointer', color: theme.fgSubtle }}
                    >
                      ✕
                    </button>
                  </Stack>
                  <Input
                    value={s.note}
                    onInput={(e) => updateStep(i(), { note: e.currentTarget.value })}
                    placeholder="Rule / SLA / detail (optional), e.g. refunds > $500 escalate to a manager"
                    style={{ 'margin-top': space(2), 'font-size': text('xs') }}
                  />
                </Card>
              )}
            </For>
          </Stack>

          <Field label="Decision points & rules" style={{ 'margin-top': space(2) }}>
            <Textarea
              value={rules()}
              onInput={(e) => set({ rules: e.currentTarget.value })}
              placeholder="SLAs, escalation rules, approvals, compliance constraints…"
              style={{ 'min-height': '60px', 'font-size': text('sm') }}
            />
          </Field>

          <Field label="Out of scope">
            <Textarea
              value={outOfScope()}
              onInput={(e) => set({ outOfScope: e.currentTarget.value })}
              placeholder="What the agent should explicitly NOT do."
              style={{ 'min-height': '48px', 'font-size': text('sm') }}
            />
          </Field>
        </Stack>

        {/* ── Right: synthesized brief ───────────────────────────────────── */}
        <Stack
          gap={3}
          style={{ padding: `${space(5)} ${space(5)} ${space(4)}`, 'min-height': '0' }}
        >
          <Stack direction="row" align="center" justify="space-between">
            <Label>{refined() ? 'Build brief · AI-refined' : 'Build brief · synthesized'}</Label>
            <Show when={refined()}>
              <Button variant="ghost" size="sm" onClick={() => setRefined(null)}>
                ↺ revert to auto
              </Button>
            </Show>
          </Stack>

          <Card
            pad={4}
            grow
            style={{
              'overflow-y': 'auto',
              'min-height': '0',
              'white-space': 'pre-wrap',
              'word-break': 'break-word',
              'font-family': font.mono,
              'font-size': text('xs'),
              'line-height': '1.55',
              color: theme.fgMuted,
            }}
          >
            {briefText() || 'Fill in the workflow on the left and the brief appears here.'}
          </Card>

          <Show when={error()}>
            <div style={{ color: theme.error, 'font-size': text('sm') }}>{error()}</div>
          </Show>

          <Stack direction="row" gap={2} wrap align="center">
            <Button
              variant="secondary"
              size="sm"
              onClick={refine}
              disabled={refining()}
              title="Tighten the brief with the LLM"
            >
              {refining() ? 'Refining…' : '✨ Refine with AI'}
            </Button>
            <Button variant="ghost" size="sm" onClick={copyBrief}>
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={saveToRegistry}
              title="Save the brief as a reusable asset"
            >
              ◳ Save to registry
            </Button>
            <span style={{ flex: '1' }} />
            <Button variant="primary" size="sm" onClick={toFanout}>
              Send to Fan-out →
            </Button>
          </Stack>
        </Stack>
      </div>
    </Dialog>
  );
}
