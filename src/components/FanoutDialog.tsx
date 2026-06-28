import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import {
  store,
  toggleFanout,
  dispatchFanout,
  defaultModules,
  autoSplitModules,
  setDefaultStack,
  showNotification,
  getProjectPath,
  getDesignRefs,
  addDesignRefs,
  removeDesignRef,
  type FanoutModule,
} from '../store/store';
import { theme } from '../lib/theme';
import { STACK_PRESETS } from '../lib/stacks';
import { openDialog } from '../lib/dialog';

/**
 * Spec → Build Fan-out: paste a client brief, refine the module breakdown, and
 * dispatch one parallel worktree-agent per module. Each agent is told what it
 * owns and what its teammates are building, so the work splits cleanly.
 */
export function FanoutDialog() {
  const [spec, setSpec] = createSignal('');
  const [modules, setModules] = createSignal<FanoutModule[]>(defaultModules());
  const [loading, setLoading] = createSignal(false);
  const [splitting, setSplitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const projectId = () => store.lastProjectId ?? store.projects[0]?.id;
  const designRefs = () => {
    const pid = projectId();
    return pid ? getDesignRefs(pid) : [];
  };

  const autoSplit = async () => {
    const pid = projectId();
    const path = pid ? getProjectPath(pid) : undefined;
    if (!path) {
      setError('Link a project first');
      return;
    }
    if (!spec().trim()) {
      setError('Paste a brief to auto-split');
      return;
    }
    setSplitting(true);
    setError('');
    try {
      const mods = await autoSplitModules(spec(), path, store.askCodeProvider);
      setModules(mods);
    } catch (e) {
      setError(`Auto-split failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSplitting(false);
    }
  };

  const pickDesignFiles = async () => {
    const pid = projectId();
    if (!pid) {
      setError('Link a project first');
      return;
    }
    const res = await openDialog({ multiple: true });
    if (!res) return;
    addDesignRefs(pid, Array.isArray(res) ? res : [res]);
  };

  const reset = () => {
    setSpec('');
    setModules(defaultModules());
    setError('');
  };

  const updateModule = (i: number, patch: Partial<FanoutModule>) => {
    setModules((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };
  const addModule = () => setModules((ms) => [...ms, { name: '', responsibility: '' }]);
  const removeModule = (i: number) => setModules((ms) => ms.filter((_, idx) => idx !== i));

  const validModules = () => modules().filter((m) => m.name.trim().length > 0);
  const canDispatch = () => spec().trim().length > 0 && validModules().length > 0 && !loading();

  const dispatch = async () => {
    if (!canDispatch()) return;
    const projectId = store.lastProjectId ?? store.projects[0]?.id;
    if (!projectId) {
      setError('Link a project first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await dispatchFanout({
        spec: spec(),
        modules: validModules().map((m) => ({
          name: m.name.trim(),
          responsibility: m.responsibility.trim(),
        })),
        projectId,
        stackId: store.defaultStackId,
      });
      if (res.failed.length > 0) {
        setError(
          `${res.created.length} dispatched, ${res.failed.length} failed: ` +
            res.failed.map((f) => `${f.name} (${f.error})`).join('; '),
        );
        if (res.created.length === 0) return;
      }
      showNotification(`Fan-out dispatched ${res.created.length} parallel agents`);
      reset();
      toggleFanout(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = {
    display: 'block',
    'font-family': 'var(--font-mono)',
    'text-transform': 'uppercase' as const,
    'letter-spacing': '0.12em',
    'font-size': '10px',
    color: theme.fgSubtle,
    margin: '0 0 5px',
  };

  return (
    <Dialog
      open={store.showFanout}
      onClose={() => toggleFanout(false)}
      width="min(820px, 94vw)"
      labelledBy="fanout-title"
    >
      <div style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}>
        <div
          style={{
            display: 'flex',
            'align-items': 'flex-end',
            'justify-content': 'space-between',
            gap: '12px',
            'margin-bottom': '16px',
          }}
        >
          <div>
            <span class="lg-label">Studio</span>
            <h2
              id="fanout-title"
              style={{
                margin: '2px 0 4px',
                'font-family': 'var(--font-display)',
                'font-size': '20px',
                'font-weight': '700',
                color: theme.fg,
              }}
            >
              Spec → Build Fan-out
            </h2>
            <p
              style={{
                margin: '0',
                'font-size': '13px',
                color: theme.fgMuted,
                'max-width': '64ch',
              }}
            >
              Paste the client brief, refine the module breakdown, and dispatch one parallel agent
              per module — each in its own worktree, told what it owns and what the others build.
            </p>
          </div>
          <label style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
            <span class="lg-label">Studio stack</span>
            <select
              class="input-field"
              value={store.defaultStackId}
              onChange={(e) => setDefaultStack(e.currentTarget.value)}
              style={{ padding: '8px 10px', 'font-size': '13px', cursor: 'pointer' }}
            >
              <For each={STACK_PRESETS}>{(s) => <option value={s.id}>{s.name}</option>}</For>
            </select>
          </label>
        </div>

        <label style={labelStyle}>Client brief / spec</label>
        <textarea
          class="input-field"
          value={spec()}
          onInput={(e) => setSpec(e.currentTarget.value)}
          placeholder="Describe what the client needs. e.g. 'A support agent that answers from our Zendesk + docs, escalates to a human when unsure, and posts in Slack…'"
          style={{
            width: '100%',
            'box-sizing': 'border-box',
            'min-height': '120px',
            resize: 'vertical',
            'font-size': '13px',
            'line-height': '1.5',
          }}
        />

        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            margin: '18px 0 8px',
          }}
        >
          <span class="lg-label">Modules · {validModules().length} parallel agents</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              class="lg-phosphor"
              onClick={autoSplit}
              disabled={splitting()}
              title="Let the LLM decompose the brief into modules"
              style={{
                all: 'unset',
                cursor: splitting() ? 'wait' : 'pointer',
                'font-size': '12px',
                color: 'var(--accent-text)',
                padding: '3px 10px',
                'border-radius': '6px',
                background: 'var(--accent)',
                opacity: splitting() ? '0.6' : '1',
                'font-weight': '600',
              }}
            >
              {splitting() ? 'Splitting…' : '✨ Auto-split from brief'}
            </button>
            <button
              onClick={addModule}
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
              + Add module
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <For each={modules()}>
            {(m, i) => (
              <div
                class="lg-glass"
                style={{
                  display: 'grid',
                  'grid-template-columns': '210px 1fr 28px',
                  gap: '8px',
                  'align-items': 'start',
                  padding: '8px',
                  'border-radius': '10px',
                }}
              >
                <input
                  class="input-field"
                  value={m.name}
                  onInput={(e) => updateModule(i(), { name: e.currentTarget.value })}
                  placeholder="Module name"
                  style={{ width: '100%', 'box-sizing': 'border-box', 'font-size': '12.5px' }}
                />
                <input
                  class="input-field"
                  value={m.responsibility}
                  onInput={(e) => updateModule(i(), { responsibility: e.currentTarget.value })}
                  placeholder="What this agent owns"
                  style={{ width: '100%', 'box-sizing': 'border-box', 'font-size': '12.5px' }}
                />
                <button
                  title="Remove module"
                  onClick={() => removeModule(i())}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    'text-align': 'center',
                    color: theme.fgSubtle,
                    'font-size': '14px',
                    'line-height': '34px',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        </div>

        {/* Design references (optional, per-project) */}
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            margin: '20px 0 8px',
          }}
        >
          <span class="lg-label" title="Images, exported Figma frames, React/CSS files">
            Design references · {designRefs().length} · optional
          </span>
          <button
            onClick={pickDesignFiles}
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
            + Add files
          </button>
        </div>
        <p style={{ margin: '0 0 8px', 'font-size': '11.5px', color: theme.fgSubtle }}>
          Agents derive a design system from these (palette, type, spacing, components). Images &
          React/CSS work directly; export Figma frames to PNG/SVG.
        </p>
        <Show when={designRefs().length > 0}>
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px' }}>
            <For each={designRefs()}>
              {(p) => (
                <span
                  class="lg-glass"
                  title={p}
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    'border-radius': '8px',
                    'font-size': '11.5px',
                    'font-family': 'var(--font-mono)',
                    'max-width': '240px',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                  >
                    {p.split('/').pop()}
                  </span>
                  <button
                    title="Remove"
                    onClick={() => {
                      const id = projectId();
                      if (id) removeDesignRef(id, p);
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      color: theme.fgSubtle,
                      'font-size': '12px',
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </For>
          </div>
        </Show>

        <Show when={error()}>
          <div style={{ 'margin-top': '12px', color: theme.error, 'font-size': '12.5px' }}>
            {error()}
          </div>
        </Show>

        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'flex-end',
            gap: '10px',
            'margin-top': '18px',
          }}
        >
          <button
            onClick={() => toggleFanout(false)}
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
            Cancel
          </button>
          <button
            class="btn-primary"
            disabled={!canDispatch()}
            onClick={dispatch}
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: '1px solid transparent',
              'border-radius': '8px',
              color: 'var(--accent-text)',
              cursor: canDispatch() ? 'pointer' : 'not-allowed',
              opacity: canDispatch() ? '1' : '0.5',
              'font-size': '14px',
              'font-weight': '600',
            }}
          >
            {loading() ? 'Dispatching…' : `Dispatch ${validModules().length} agents`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
