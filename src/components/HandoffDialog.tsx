import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Divider, Field } from './primitives';
import {
  store,
  toggleHandoff,
  handoffTargetsForProject,
  runHandoff,
  DEPLOY_TARGETS,
  showNotification,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';

/**
 * Client Handoff & Deploy — sends a tuned brief to a built task's agent to
 * produce a client-ready handoff package (docs, architecture, demo) and set up
 * deployment for the chosen target. Live deploy is opt-in.
 */
export function HandoffDialog() {
  const [selected, setSelected] = createSignal('');
  const [targetId, setTargetId] = createSignal('docker');
  const [liveDeploy, setLiveDeploy] = createSignal(false);
  const [embedEvals, setEmbedEvals] = createSignal(true);
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
      await runHandoff({
        taskId,
        deployTargetId: targetId(),
        liveDeploy: liveDeploy(),
        embedEvals: embedEvals(),
      });
      showNotification('Handoff brief sent to the agent');
      toggleHandoff(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectStyle = { width: '100%', 'box-sizing': 'border-box' as const };

  return (
    <Dialog
      open={store.showHandoff}
      onClose={() => toggleHandoff(false)}
      width="min(680px, 94vw)"
      labelledBy="handoff-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <Stack
        gap={4}
        style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}
      >
        <div>
          <Label>Studio · Delivery</Label>
          <h2
            id="handoff-title"
            style={{
              margin: `${space(1)} 0 ${space(1)}`,
              'font-family': font.display,
              'font-size': text('xl'),
              'font-weight': '700',
              color: theme.fg,
            }}
          >
            Client Handoff &amp; Deploy
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
            Send the building agent a brief to produce a client-ready handoff package — README,
            architecture, deployment guide, and demo — and set up deployment for your target.
          </p>
        </div>

        <Show
          when={tasks().length > 0}
          fallback={
            <Card style={{ 'font-size': text('sm'), color: theme.fgMuted }}>
              No built tasks with an agent yet. Dispatch a Blueprint or a Fan-out first, then come
              back to package it.
            </Card>
          }
        >
          <Field label="Task to package">
            <select
              class="in-input"
              value={effectiveTaskId()}
              onChange={(e) => setSelected(e.currentTarget.value)}
              style={selectStyle}
            >
              <For each={tasks()}>{(t) => <option value={t.id}>{t.name}</option>}</For>
            </select>
          </Field>

          <Field label="Deploy target">
            <select
              class="in-input"
              value={targetId()}
              onChange={(e) => setTargetId(e.currentTarget.value)}
              style={selectStyle}
            >
              <For each={DEPLOY_TARGETS}>{(t) => <option value={t.id}>{t.name}</option>}</For>
            </select>
          </Field>

          <label
            style={{
              display: 'flex',
              'align-items': 'flex-start',
              gap: space(2),
              cursor: 'pointer',
              'font-size': text('sm'),
              color: theme.fg,
            }}
          >
            <input
              type="checkbox"
              checked={embedEvals()}
              onChange={(e) => setEmbedEvals(e.currentTarget.checked)}
              style={{ 'margin-top': '2px' }}
            />
            <span>
              Embed evals &amp; telemetry in the product
              <span style={{ display: 'block', 'font-size': text('xs'), color: theme.fgMuted }}>
                Ships a self-contained eval suite (from your golden dataset) + a metrics wrapper
                into the client's repo, so their system carries its own quality + cost/latency
                tracking.
              </span>
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              'align-items': 'flex-start',
              gap: space(2),
              cursor: 'pointer',
              'font-size': text('sm'),
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
              <span style={{ display: 'block', 'font-size': text('xs'), color: theme.warning }}>
                Off = prepare config + instructions only (safe). On = the agent will run the deploy
                command (cloud-mutating, may incur cost).
              </span>
            </span>
          </label>
        </Show>

        <Show when={error()}>
          <div style={{ color: theme.error, 'font-size': text('sm') }}>{error()}</div>
        </Show>

        <Divider />
        <Stack direction="row" justify="flex-end" gap={2}>
          <Button variant="secondary" onClick={() => toggleHandoff(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy() || tasks().length === 0} onClick={generate}>
            {busy() ? 'Sending…' : 'Generate handoff'}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
