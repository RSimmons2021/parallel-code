import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import {
  store,
  toggleEvalArena,
  runEval,
  defaultCases,
  emptyCase,
  type EvalCase,
  type EvalRun,
} from '../store/store';
import { theme } from '../lib/theme';

/**
 * Eval Arena — run a prompt/system under test across a golden dataset, score
 * each case (assertions + optional LLM-judge), and show a leaderboard.
 */
export function EvalArenaDialog() {
  const [systemPrompt, setSystemPrompt] = createSignal(
    'You are a helpful assistant. Answer the user concisely.\n\n{{input}}',
  );
  const [cases, setCases] = createSignal<EvalCase[]>(defaultCases());
  const [useJudge, setUseJudge] = createSignal(false);
  const [judgeRubric, setJudgeRubric] = createSignal(
    'Award a pass if the answer is correct, relevant, and free of hallucinations.',
  );
  const [running, setRunning] = createSignal(false);
  const [progress, setProgress] = createSignal({ done: 0, total: 0 });
  const [run, setRun] = createSignal<EvalRun | null>(null);
  const [error, setError] = createSignal('');

  const projectId = () => store.lastProjectId ?? store.projects[0]?.id;

  const updateCase = (i: number, patch: Partial<EvalCase>) =>
    setCases((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCase = () => setCases((cs) => [...cs, emptyCase()]);
  const removeCase = (i: number) => setCases((cs) => cs.filter((_, idx) => idx !== i));

  const start = async () => {
    const pid = projectId();
    if (!pid) {
      setError('Link a project first');
      return;
    }
    setRunning(true);
    setError('');
    setRun(null);
    try {
      const result = await runEval({
        systemPrompt: systemPrompt(),
        cases: cases(),
        useJudge: useJudge(),
        judgeRubric: judgeRubric(),
        projectId: pid,
        provider: store.askCodeProvider,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRun(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const labelStyle = {
    display: 'block',
    'font-family': 'var(--font-mono)',
    'text-transform': 'uppercase' as const,
    'letter-spacing': '0.12em',
    'font-size': '10px',
    color: theme.fgSubtle,
    margin: '0 0 6px',
  };
  const inputStyle = { width: '100%', 'box-sizing': 'border-box' as const, 'font-size': '12.5px' };

  return (
    <Dialog
      open={store.showEvalArena}
      onClose={() => toggleEvalArena(false)}
      width="min(900px, 95vw)"
      labelledBy="eval-title"
    >
      <div style={{ padding: '22px 24px 20px', 'max-height': '88vh', 'overflow-y': 'auto' }}>
        <span class="lg-label">Studio · Quality</span>
        <h2
          id="eval-title"
          style={{
            margin: '2px 0 4px',
            'font-family': 'var(--font-display)',
            'font-size': '20px',
            'font-weight': '700',
            color: theme.fg,
          }}
        >
          Eval Arena
        </h2>
        <p
          style={{
            margin: '0 0 16px',
            'font-size': '13px',
            color: theme.fgMuted,
            'max-width': '70ch',
          }}
        >
          Evaluate a prompt against a golden dataset. Each case is scored with assertions and an
          optional LLM-judge, then aggregated into a pass rate — catch regressions before you ship.
        </p>

        <label style={labelStyle}>
          System / prompt under test — use <code>{'{{input}}'}</code> where the case input goes
        </label>
        <textarea
          class="input-field"
          value={systemPrompt()}
          onInput={(e) => setSystemPrompt(e.currentTarget.value)}
          style={{
            ...inputStyle,
            'min-height': '90px',
            resize: 'vertical',
            'font-family': 'var(--font-mono)',
          }}
        />

        <label
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            margin: '14px 0 0',
            'font-size': '13px',
            color: theme.fg,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={useJudge()}
            onChange={(e) => setUseJudge(e.currentTarget.checked)}
          />
          Use LLM-judge
        </label>
        <Show when={useJudge()}>
          <textarea
            class="input-field"
            value={judgeRubric()}
            onInput={(e) => setJudgeRubric(e.currentTarget.value)}
            placeholder="Rubric the judge scores against…"
            style={{ ...inputStyle, 'margin-top': '8px', 'min-height': '56px', resize: 'vertical' }}
          />
        </Show>

        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            margin: '18px 0 8px',
          }}
        >
          <span class="lg-label">Golden dataset · {cases().length} cases</span>
          <button
            onClick={addCase}
            style={{
              all: 'unset',
              cursor: 'pointer',
              'font-size': '12px',
              color: 'var(--accent)',
              padding: '3px 8px',
              'border-radius': '6px',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            + Add case
          </button>
        </div>

        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <For each={cases()}>
            {(c, i) => (
              <div
                class="lg-glass"
                style={{
                  display: 'grid',
                  'grid-template-columns': '1fr 1fr 1fr 24px',
                  gap: '6px',
                  padding: '8px',
                  'border-radius': '10px',
                }}
              >
                <input
                  class="input-field"
                  value={c.input}
                  onInput={(e) => updateCase(i(), { input: e.currentTarget.value })}
                  placeholder="Input"
                  style={inputStyle}
                />
                <input
                  class="input-field"
                  value={c.expected}
                  onInput={(e) => updateCase(i(), { expected: e.currentTarget.value })}
                  placeholder="Expected (optional)"
                  style={inputStyle}
                />
                <input
                  class="input-field"
                  value={c.contains}
                  onInput={(e) => updateCase(i(), { contains: e.currentTarget.value })}
                  placeholder="Must contain (optional)"
                  style={inputStyle}
                />
                <button
                  title="Remove"
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
              </div>
            )}
          </For>
        </div>

        <Show when={error()}>
          <div style={{ 'margin-top': '12px', color: theme.error, 'font-size': '12.5px' }}>
            {error()}
          </div>
        </Show>

        {/* Results */}
        <Show when={run()}>
          {(r) => (
            <div style={{ 'margin-top': '18px' }}>
              <div
                class="lg-glass"
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  padding: '12px 14px',
                  'border-radius': '12px',
                  'margin-bottom': '10px',
                }}
              >
                <span class="lg-label">Pass rate</span>
                <span
                  style={{
                    'font-family': 'var(--font-display)',
                    'font-size': '22px',
                    'font-weight': '700',
                    color:
                      r().passRate >= 0.8
                        ? theme.success
                        : r().passRate >= 0.5
                          ? theme.warning
                          : theme.error,
                  }}
                >
                  {Math.round(r().passRate * 100)}%
                  <span style={{ 'font-size': '13px', color: theme.fgMuted, 'font-weight': '400' }}>
                    {' '}
                    ({r().results.filter((x) => x.pass).length}/{r().results.length})
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
                <For each={r().results}>
                  {(res) => (
                    <div
                      class="lg-glass"
                      style={{
                        padding: '10px 12px',
                        'border-radius': '10px',
                        'border-left': `3px solid ${res.pass ? theme.success : theme.error}`,
                      }}
                    >
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <span
                          style={{
                            color: res.pass ? theme.success : theme.error,
                            'font-weight': '700',
                          }}
                        >
                          {res.pass ? '✓' : '✗'}
                        </span>
                        <span
                          style={{
                            'font-size': '12.5px',
                            color: theme.fg,
                            flex: '1',
                            overflow: 'hidden',
                            'text-overflow': 'ellipsis',
                            'white-space': 'nowrap',
                          }}
                        >
                          {res.input}
                        </span>
                        <For each={res.checks}>
                          {(ch) => (
                            <span
                              style={{
                                'font-size': '10px',
                                'font-family': 'var(--font-mono)',
                                padding: '1px 6px',
                                'border-radius': '5px',
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
                      </div>
                      <Show when={res.error}>
                        <div
                          style={{ 'font-size': '11.5px', color: theme.error, 'margin-top': '4px' }}
                        >
                          {res.error}
                        </div>
                      </Show>
                      <Show when={res.output}>
                        <div
                          style={{
                            'font-size': '11.5px',
                            color: theme.fgMuted,
                            'margin-top': '4px',
                            'font-family': 'var(--font-mono)',
                            'max-height': '60px',
                            overflow: 'hidden',
                          }}
                        >
                          {res.output.slice(0, 280)}
                          {res.output.length > 280 ? '…' : ''}
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
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
          <Show when={running()}>
            <span style={{ 'font-size': '12.5px', color: theme.fgMuted, 'margin-right': 'auto' }}>
              Running case {progress().done}/{progress().total}…
            </span>
          </Show>
          <button
            onClick={() => toggleEvalArena(false)}
            style={{
              padding: '9px 18px',
              background: theme.bgInput,
              border: `1px solid ${theme.border}`,
              'border-radius': '8px',
              color: theme.fgMuted,
              cursor: 'pointer',
              'font-size': '14px',
            }}
          >
            Close
          </button>
          <button
            class="btn-primary"
            disabled={running()}
            onClick={start}
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: '1px solid transparent',
              'border-radius': '8px',
              color: 'var(--accent-text)',
              cursor: running() ? 'wait' : 'pointer',
              opacity: running() ? '0.6' : '1',
              'font-size': '14px',
              'font-weight': '600',
            }}
          >
            {running() ? 'Running…' : 'Run eval'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
