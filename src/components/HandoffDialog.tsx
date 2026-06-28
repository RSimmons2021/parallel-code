import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import {
  store,
  toggleHandoff,
  handoffTargetsForProject,
  runHandoff,
  DEPLOY_TARGETS,
  showNotification,
} from '../store/store';
import { theme } from '../lib/theme';

/**
 * Client Handoff & Deploy — sends a tuned brief to a built task's agent to
 * produce a client-ready handoff package (docs, architecture, demo) and set up
 * deployment for the chosen target. Live deploy is opt-in.
 */
export function HandoffDialog() {
  const [selected, setSelected] = createSignal('');
  const [targetId, setTargetId] = createSignal('docker');
  const [liveDeploy, setLiveDeploy] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  const projectId = () => store.lastProjectId ?? store.projects[0]?.id;
  const tasks = () => {
    const pid = projectId();
    return pid ? handoffTargetsForProject(pid) : [];
  };
  const effectiveTaskId = () => selected() || tasks()[0]?.id || '';

  const generate = async () => {
    const taskId = effectiveTaskId();
    if (!taskId) {
      setError('Pick a task to package');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await runHandoff({ taskId, deployTargetId: targetId(), liveDeploy: liveDeploy() });
      showNotification('Handoff brief sent to the agent');
      toggleHandoff(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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

  return (
    <Dialog
      open={store.showHandoff}
      onClose={() => toggleHandoff(false)}
      width="min(680px, 94vw)"
      labelledBy="handoff-title"
    >
      <div style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}>
        <span class="lg-label">Studio</span>
        <h2
          id="handoff-title"
          style={{
            margin: '2px 0 4px',
            'font-family': 'var(--font-display)',
            'font-size': '20px',
            'font-weight': '700',
            color: theme.fg,
          }}
        >
          Client Handoff & Deploy
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            'font-size': '13px',
            color: theme.fgMuted,
            'max-width': '64ch',
          }}
        >
          Send the building agent a brief to produce a client-ready handoff package — README,
          architecture, deployment guide, and demo — and set up deployment for your target.
        </p>

        <Show
          when={tasks().length > 0}
          fallback={
            <div
              class="lg-glass"
              style={{
                padding: '16px',
                'border-radius': '12px',
                'font-size': '13px',
                color: theme.fgMuted,
              }}
            >
              No built tasks with an agent yet. Dispatch a Blueprint or a Fan-out first, then come
              back to package it.
            </div>
          }
        >
          <label style={labelStyle}>Task to package</label>
          <select
            class="input-field"
            value={effectiveTaskId()}
            onChange={(e) => setSelected(e.currentTarget.value)}
            style={{ width: '100%', 'box-sizing': 'border-box', 'margin-bottom': '14px' }}
          >
            <For each={tasks()}>{(t) => <option value={t.id}>{t.name}</option>}</For>
          </select>

          <label style={labelStyle}>Deploy target</label>
          <select
            class="input-field"
            value={targetId()}
            onChange={(e) => setTargetId(e.currentTarget.value)}
            style={{ width: '100%', 'box-sizing': 'border-box', 'margin-bottom': '14px' }}
          >
            <For each={DEPLOY_TARGETS}>{(t) => <option value={t.id}>{t.name}</option>}</For>
          </select>

          <label
            style={{
              display: 'flex',
              'align-items': 'flex-start',
              gap: '8px',
              cursor: 'pointer',
              'font-size': '13px',
              color: theme.fg,
            }}
          >
            <input
              type="checkbox"
              checked={liveDeploy()}
              onChange={(e) => setLiveDeploy(e.currentTarget.checked)}
              disabled={targetId() === 'none'}
              style={{ 'margin-top': '2px' }}
            />
            <span>
              Run the deploy now
              <span style={{ display: 'block', 'font-size': '11.5px', color: theme.warning }}>
                Off = prepare config + instructions only (safe). On = the agent will run the deploy
                command (cloud-mutating, may incur cost).
              </span>
            </span>
          </label>
        </Show>

        <Show when={error()}>
          <div style={{ 'margin-top': '12px', color: theme.error, 'font-size': '12.5px' }}>
            {error()}
          </div>
        </Show>

        <div
          style={{
            display: 'flex',
            'justify-content': 'flex-end',
            gap: '10px',
            'margin-top': '20px',
          }}
        >
          <button
            onClick={() => toggleHandoff(false)}
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
            disabled={busy() || tasks().length === 0}
            onClick={generate}
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: '1px solid transparent',
              'border-radius': '8px',
              color: 'var(--accent-text)',
              cursor: busy() || tasks().length === 0 ? 'not-allowed' : 'pointer',
              opacity: busy() || tasks().length === 0 ? '0.5' : '1',
              'font-size': '14px',
              'font-weight': '600',
            }}
          >
            {busy() ? 'Sending…' : 'Generate handoff'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
