import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Divider, Field, Input, Textarea, Metric } from './primitives';
import {
  store,
  toggleEvalArena,
  getSuite,
  getOrCreateSuite,
  updateSuiteFields,
  runSuiteEval,
  restorePromptVersion,
  setHumanVerdict,
  exportDatasetJson,
  buildEmbedEvalsBrief,
  emptyCase,
  handoffTargetsForProject,
  sendPrompt,
  showNotification,
  captureAsset,
  type EvalRunRecord,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';

/**
 * Eval Arena — the studio's eval harness. A project's golden dataset, prompt
 * version history, and run history are first-class persisted assets. Run the
 * suite (with k trials → pass@k / pass^k), compare against the previous run to
 * catch regressions, apply human verdicts, and embed the whole suite + telemetry
 * into the client's product.
 */

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function tone(p: number): string {
  return p >= 0.8 ? theme.success : p >= 0.5 ? theme.warning : theme.error;
}

export function EvalArenaDialog() {
  const [running, setRunning] = createSignal(false);
  const [progress, setProgress] = createSignal({ done: 0, total: 0 });
  const [viewRunId, setViewRunId] = createSignal<string | null>(null);
  const [error, setError] = createSignal('');

  const projectId = () => store.lastProjectId ?? store.projects[0]?.id;

  // Ensure the project's suite exists whenever the dialog is open.
  createEffect(() => {
    const pid = projectId();
    if (store.showEvalArena && pid) getOrCreateSuite(pid);
  });

  const suite = createMemo(() => {
    const pid = projectId();
    return pid ? getSuite(pid) : undefined;
  });

  const set = (patch: Parameters<typeof updateSuiteFields>[1]) => {
    const s = suite();
    if (s) updateSuiteFields(s.id, patch);
  };

  const cases = () => suite()?.cases ?? [];
  const trials = () => suite()?.trials ?? 1;
  const promptVersions = () => suite()?.promptVersions ?? [];
  const sysPrompt = () => suite()?.systemPrompt ?? '';
  const useJudgeOn = () => suite()?.useJudge ?? false;
  const judgeRubric = () => suite()?.judgeRubric ?? '';
  const updateCase = (i: number, patch: Partial<ReturnType<typeof emptyCase>>) => {
    const s = suite();
    if (s) set({ cases: s.cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };
  const addCase = () => {
    const s = suite();
    if (s) set({ cases: [...s.cases, emptyCase()] });
  };
  const removeCase = (i: number) => {
    const s = suite();
    if (s) set({ cases: s.cases.filter((_, idx) => idx !== i) });
  };

  const runs = () => suite()?.runs ?? [];
  const currentRun = createMemo<EvalRunRecord | undefined>(() => {
    const rs = runs();
    const id = viewRunId();
    return (id ? rs.find((r) => r.id === id) : rs[0]) ?? rs[0];
  });
  const prevRun = createMemo<EvalRunRecord | undefined>(() => {
    const rs = runs();
    const cur = currentRun();
    if (!cur) return undefined;
    return rs[rs.indexOf(cur) + 1];
  });
  const delta = () => {
    const cur = currentRun();
    const prev = prevRun();
    if (!cur || !prev) return null;
    return cur.passRate - prev.passRate;
  };

  const start = async () => {
    const s = suite();
    if (!s) {
      setError('Link a project first');
      return;
    }
    setRunning(true);
    setError('');
    try {
      await runSuiteEval(s.id, store.askCodeProvider, (done, total) =>
        setProgress({ done, total }),
      );
      setViewRunId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const cycleVerdict = (caseId: string, computed: boolean) => {
    const s = suite();
    const run = currentRun();
    if (!s || !run) return;
    const cur = run.results.find((r) => r.caseId === caseId)?.humanVerdict;
    // none → (opposite of computed) → (computed) → none
    const next =
      cur === undefined
        ? computed
          ? 'fail'
          : 'pass'
        : cur === (computed ? 'fail' : 'pass')
          ? computed
            ? 'pass'
            : 'fail'
          : undefined;
    setHumanVerdict(s.id, run.id, caseId, next);
  };

  const savePromptToRegistry = () => {
    const s = suite();
    if (!s || !s.systemPrompt.trim()) return;
    captureAsset({
      kind: 'system',
      name: s.name.replace(/ evals$/, '') || 'System prompt',
      body: s.systemPrompt,
      description: `Captured from Eval Arena · ${pct(latestRunPassRate())} pass`,
      tags: ['eval', 'system'],
    });
    showNotification('Prompt saved to registry');
  };
  const latestRunPassRate = () => currentRun()?.passRate ?? 0;

  const copyDataset = async () => {
    const s = suite();
    if (!s) return;
    await navigator.clipboard.writeText(exportDatasetJson(s));
    showNotification('Golden dataset JSON copied');
  };

  const embed = async () => {
    const s = suite();
    if (!s) return;
    if (!s.cases.some((c) => c.input.trim())) {
      setError('Add at least one case before embedding');
      return;
    }
    const targets = handoffTargetsForProject(s.projectId);
    if (targets.length === 0) {
      showNotification('No built task agent yet — dispatch a Blueprint or Fan-out first');
      return;
    }
    await sendPrompt(
      targets[0].id,
      targets[0].agentId,
      buildEmbedEvalsBrief(s, store.defaultStackId),
    );
    showNotification(`Embed brief sent to “${targets[0].name}”`);
  };

  return (
    <Dialog
      open={store.showEvalArena}
      onClose={() => toggleEvalArena(false)}
      width="min(940px, 95vw)"
      labelledBy="eval-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <Stack
        gap={0}
        style={{ padding: '22px 24px 20px', 'max-height': '88vh', 'overflow-y': 'auto' }}
      >
        <Stack direction="row" align="flex-end" justify="space-between" gap={3}>
          <div>
            <Label>Studio · Quality</Label>
            <h2
              id="eval-title"
              style={{
                margin: `${space(1)} 0 ${space(1)}`,
                'font-family': font.display,
                'font-size': text('xl'),
                'font-weight': '700',
                color: theme.fg,
              }}
            >
              Eval Arena
            </h2>
            <p
              style={{
                margin: '0',
                'font-size': text('sm'),
                color: theme.fgMuted,
                'max-width': '64ch',
                'line-height': '1.5',
              }}
            >
              A versioned golden dataset for this project. Run it (k trials → pass@k / pass^k),
              compare against the last run to catch regressions, then embed the suite + telemetry
              into the client's product.
            </p>
          </div>
          <Show when={suite()}>
            <Stack direction="row" gap={2} align="flex-end" style={{ 'flex-shrink': '0' }}>
              <Field label="Prompt version">
                <select
                  class="in-input"
                  value=""
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    const s = suite();
                    if (s && v) restorePromptVersion(s.id, v);
                    e.currentTarget.value = '';
                  }}
                  title="Restore a prior prompt version into the editor"
                >
                  <option value="">v{promptVersions().length} (current)</option>
                  <For each={[...promptVersions()].reverse()}>
                    {(v) => <option value={v.version}>restore v{v.version}</option>}
                  </For>
                </select>
              </Field>
              <Field label="Trials / case">
                <select
                  class="in-input"
                  value={String(trials())}
                  onChange={(e) => set({ trials: Number(e.currentTarget.value) })}
                  title="Run each case k times for pass@k / pass^k"
                >
                  <For each={[1, 3, 5]}>{(n) => <option value={n}>{n}×</option>}</For>
                </select>
              </Field>
            </Stack>
          </Show>
        </Stack>

        <Show
          when={suite()}
          fallback={<Card style={{ 'margin-top': space(4) }}>Link a project first.</Card>}
        >
          <Field
            label="System / prompt under test"
            hint={
              <>
                Use <code>{'{{input}}'}</code> where the case input goes · committed as a new
                version on each run
              </>
            }
            style={{ 'margin-top': space(4) }}
          >
            <Textarea
              mono
              value={sysPrompt()}
              onInput={(e) => set({ systemPrompt: e.currentTarget.value })}
              style={{ 'min-height': '90px', 'font-size': text('sm') }}
            />
          </Field>
          <Stack direction="row" justify="flex-end" style={{ 'margin-top': space(1) }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={savePromptToRegistry}
              title="Capture this system prompt into the Asset Registry"
            >
              ◳ Save prompt to registry
            </Button>
          </Stack>

          <label
            style={{
              display: 'flex',
              'align-items': 'center',
              gap: space(2),
              margin: `${space(4)} 0 0`,
              'font-size': text('sm'),
              color: theme.fg,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={useJudgeOn()}
              onChange={(e) => set({ useJudge: e.currentTarget.checked })}
            />
            Use LLM-judge
          </label>
          <Show when={useJudgeOn()}>
            <Textarea
              value={judgeRubric()}
              onInput={(e) => set({ judgeRubric: e.currentTarget.value })}
              placeholder="Rubric the judge scores against…"
              style={{ 'margin-top': space(2), 'min-height': '56px', 'font-size': text('sm') }}
            />
          </Show>

          {/* Golden dataset */}
          <Stack
            direction="row"
            align="center"
            justify="space-between"
            style={{ margin: `${space(5)} 0 ${space(2)}` }}
          >
            <Label>Golden dataset · {cases().length} cases</Label>
            <Stack direction="row" gap={2}>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDataset}
                title="Copy portable dataset JSON"
              >
                Copy JSON
              </Button>
              <Button variant="ghost" size="sm" onClick={addCase}>
                + Add case
              </Button>
            </Stack>
          </Stack>

          <Stack gap={2}>
            <For each={cases()}>
              {(c, i) => (
                <Card
                  pad={2}
                  radius={3}
                  style={{
                    display: 'grid',
                    'grid-template-columns': '1fr 1fr 1fr 22px 22px',
                    gap: space(2),
                    'align-items': 'center',
                  }}
                >
                  <Input
                    value={c.input}
                    onInput={(e) => updateCase(i(), { input: e.currentTarget.value })}
                    placeholder="Input"
                  />
                  <Input
                    value={c.expected}
                    onInput={(e) => updateCase(i(), { expected: e.currentTarget.value })}
                    placeholder="Expected (optional)"
                  />
                  <Input
                    value={c.contains}
                    onInput={(e) => updateCase(i(), { contains: e.currentTarget.value })}
                    placeholder="Must contain (optional)"
                  />
                  <button
                    title={
                      c.regression
                        ? 'In regression suite — click to remove'
                        : 'Mark as regression case'
                    }
                    class="in-press"
                    onClick={() => updateCase(i(), { regression: !c.regression })}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      'text-align': 'center',
                      'font-size': text('sm'),
                      color: c.regression ? theme.accent : theme.fgSubtle,
                    }}
                  >
                    ⚑
                  </button>
                  <button
                    title="Remove"
                    class="in-press"
                    onClick={() => removeCase(i())}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      'text-align': 'center',
                      color: theme.fgSubtle,
                    }}
                  >
                    ✕
                  </button>
                </Card>
              )}
            </For>
          </Stack>

          <Show when={error()}>
            <div style={{ 'margin-top': space(3), color: theme.error, 'font-size': text('sm') }}>
              {error()}
            </div>
          </Show>

          {/* Latest / selected run */}
          <Show when={currentRun()}>
            {(r) => (
              <Stack gap={2} style={{ 'margin-top': space(4) }}>
                <Stack direction="row" gap={2} wrap>
                  <Card grow rise>
                    <Metric
                      label="pass@k"
                      value={pct(r().passRate)}
                      tone={tone(r().passRate)}
                      sub={
                        <span class="in-tnum">
                          {
                            r().results.filter(
                              (x) => (x.humanVerdict ?? (x.pass ? 'pass' : 'fail')) === 'pass',
                            ).length
                          }
                          /{r().results.length}
                          <Show when={delta()}>
                            {(d) => (
                              <span style={{ color: d() >= 0 ? theme.success : theme.error }}>
                                {' '}
                                {d() >= 0 ? '▲' : '▼'} {pct(Math.abs(d()))}
                              </span>
                            )}
                          </Show>
                        </span>
                      }
                    />
                  </Card>
                  <Card grow rise>
                    <Metric
                      label="pass^k"
                      value={pct(r().passHatRate)}
                      tone={tone(r().passHatRate)}
                      sub={`${r().trials}× trials each`}
                    />
                  </Card>
                  <Card grow rise>
                    <Metric
                      label="Prompt"
                      value={`v${r().promptVersion}`}
                      sub={`${r().caseCount} cases`}
                    />
                  </Card>
                </Stack>

                <Stack gap={1}>
                  <For each={r().results}>
                    {(res) => {
                      const computed = res.pass;
                      const effective = () => {
                        const cur = currentRun();
                        const live = cur?.results.find((x) => x.caseId === res.caseId);
                        const hv = live?.humanVerdict;
                        return hv ? hv === 'pass' : computed;
                      };
                      return (
                        <Card pad={3} radius={3} rail={effective() ? theme.success : theme.error}>
                          <Stack direction="row" align="center" gap={2}>
                            <button
                              title="Click to set a human verdict (overrides the auto score)"
                              class="in-press"
                              onClick={() => cycleVerdict(res.caseId, computed)}
                              style={{
                                all: 'unset',
                                cursor: 'pointer',
                                color: effective() ? theme.success : theme.error,
                                'font-weight': '700',
                              }}
                            >
                              {effective() ? '✓' : '✗'}
                            </button>
                            <span
                              style={{
                                'font-size': text('sm'),
                                color: theme.fg,
                                flex: '1',
                                overflow: 'hidden',
                                'text-overflow': 'ellipsis',
                                'white-space': 'nowrap',
                              }}
                            >
                              {res.input}
                            </span>
                            <Show when={res.trials > 1}>
                              <span
                                class="in-tnum"
                                style={{
                                  'font-size': text('2xs'),
                                  'font-family': font.mono,
                                  color: theme.fgMuted,
                                }}
                              >
                                {res.trialPasses}/{res.trials}
                              </span>
                            </Show>
                            <Show when={res.humanVerdict}>
                              <span
                                style={{
                                  'font-size': text('2xs'),
                                  'font-family': font.mono,
                                  color: theme.accent,
                                }}
                              >
                                human
                              </span>
                            </Show>
                            <For each={res.checks}>
                              {(ch) => (
                                <span
                                  style={{
                                    'font-size': text('2xs'),
                                    'font-family': font.mono,
                                    padding: `1px ${space(2)}`,
                                    'border-radius': 'var(--radius-1)',
                                    background: ch.pass
                                      ? 'color-mix(in srgb, var(--success) 18%, transparent)'
                                      : 'color-mix(in srgb, var(--error) 18%, transparent)',
                                    color: ch.pass ? theme.success : theme.error,
                                    'white-space': 'nowrap',
                                  }}
                                >
                                  {ch.name}
                                </span>
                              )}
                            </For>
                          </Stack>
                          <Show when={res.error}>
                            <div
                              style={{
                                'font-size': text('xs'),
                                color: theme.error,
                                'margin-top': space(1),
                              }}
                            >
                              {res.error}
                            </div>
                          </Show>
                          <Show when={res.output}>
                            <div
                              style={{
                                'font-size': text('xs'),
                                color: theme.fgMuted,
                                'margin-top': space(1),
                                'font-family': font.mono,
                                'max-height': '60px',
                                overflow: 'hidden',
                              }}
                            >
                              {res.output.slice(0, 280)}
                              {res.output.length > 280 ? '…' : ''}
                            </div>
                          </Show>
                        </Card>
                      );
                    }}
                  </For>
                </Stack>
              </Stack>
            )}
          </Show>

          {/* Run history */}
          <Show when={runs().length > 1}>
            <Label style={{ display: 'block', margin: `${space(5)} 0 ${space(2)}` }}>
              Run history · {runs().length}
            </Label>
            <Stack gap={1}>
              <For each={runs()}>
                {(run) => (
                  <button
                    class="in-press in-tnum"
                    onClick={() => setViewRunId(run.id)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'grid',
                      'grid-template-columns': '70px 1fr 60px 60px 44px',
                      gap: space(2),
                      'align-items': 'center',
                      padding: `${space(2)} ${space(3)}`,
                      'border-radius': 'var(--radius-2)',
                      'font-size': text('xs'),
                      'font-family': font.mono,
                      color: theme.fgMuted,
                      background:
                        currentRun()?.id === run.id
                          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                          : 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)',
                    }}
                  >
                    <span>
                      {new Date(run.ts).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>prompt v{run.promptVersion}</span>
                    <span style={{ color: tone(run.passRate) }}>{pct(run.passRate)}</span>
                    <span style={{ color: theme.fgSubtle }}>^{pct(run.passHatRate)}</span>
                    <span style={{ color: theme.fgSubtle }}>{run.trials}×</span>
                  </button>
                )}
              </For>
            </Stack>
          </Show>
        </Show>

        <Divider style={{ margin: `${space(5)} 0 ${space(3)}` }} />
        <Stack direction="row" align="center" gap={2}>
          <Show when={running()}>
            <span
              class="in-tnum"
              style={{ 'font-size': text('sm'), color: theme.fgMuted, 'margin-right': 'auto' }}
            >
              Running case {progress().done}/{progress().total}…
            </span>
          </Show>
          <Show when={!running()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={embed}
              title="Ship this suite + telemetry into the client's product"
              style={{ 'margin-right': 'auto' }}
            >
              Embed in product →
            </Button>
          </Show>
          <Button variant="secondary" onClick={() => toggleEvalArena(false)}>
            Close
          </Button>
          <Button variant="primary" disabled={running()} onClick={start}>
            {running() ? 'Running…' : 'Run eval'}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
