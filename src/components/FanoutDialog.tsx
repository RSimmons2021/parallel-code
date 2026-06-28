import { createEffect, createSignal, For, Show } from 'solid-js';
import { setStore } from '../store/core';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Divider, Field, Input, Textarea } from './primitives';
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
import { space, text, font } from '../lib/tokens';
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

  // Consume a brief queued by the Discovery canvas.
  createEffect(() => {
    if (store.showFanout && store.fanoutPrefillSpec) {
      setSpec(store.fanoutPrefillSpec);
      setStore('fanoutPrefillSpec', null);
    }
  });

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
    const pid = store.lastProjectId ?? store.projects[0]?.id;
    if (!pid) {
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
        projectId: pid,
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

  return (
    <Dialog
      open={store.showFanout}
      onClose={() => toggleFanout(false)}
      width="min(820px, 94vw)"
      labelledBy="fanout-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <Stack
        gap={0}
        style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}
      >
        <Stack direction="row" align="flex-end" justify="space-between" gap={3}>
          <div>
            <Label>Studio · Orchestration</Label>
            <h2
              id="fanout-title"
              style={{
                margin: `${space(1)} 0 ${space(1)}`,
                'font-family': font.display,
                'font-size': text('xl'),
                'font-weight': '700',
                color: theme.fg,
              }}
            >
              Spec → Build Fan-out
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
              Paste the client brief, refine the module breakdown, and dispatch one parallel agent
              per module — each in its own worktree, told what it owns and what the others build.
            </p>
          </div>
          <Field label="Studio stack" style={{ 'flex-shrink': '0' }}>
            <select
              class="in-input"
              value={store.defaultStackId}
              onChange={(e) => setDefaultStack(e.currentTarget.value)}
              style={{ cursor: 'pointer' }}
            >
              <For each={STACK_PRESETS}>{(s) => <option value={s.id}>{s.name}</option>}</For>
            </select>
          </Field>
        </Stack>

        <Field label="Client brief / spec" style={{ 'margin-top': space(4) }}>
          <Textarea
            value={spec()}
            onInput={(e) => setSpec(e.currentTarget.value)}
            placeholder="Describe what the client needs. e.g. 'A support agent that answers from our Zendesk + docs, escalates to a human when unsure, and posts in Slack…'"
            style={{ 'min-height': '120px', 'font-size': text('sm'), 'line-height': '1.5' }}
          />
        </Field>

        <Stack
          direction="row"
          align="center"
          justify="space-between"
          style={{ margin: `${space(5)} 0 ${space(2)}` }}
        >
          <Label>Modules · {validModules().length} parallel agents</Label>
          <Stack direction="row" gap={2}>
            <Button
              variant="primary"
              size="sm"
              onClick={autoSplit}
              disabled={splitting()}
              title="Let the LLM decompose the brief into modules"
            >
              {splitting() ? 'Splitting…' : '✨ Auto-split from brief'}
            </Button>
            <Button variant="ghost" size="sm" onClick={addModule}>
              + Add module
            </Button>
          </Stack>
        </Stack>

        <Stack gap={2}>
          <For each={modules()}>
            {(m, i) => (
              <Card
                pad={2}
                radius={3}
                style={{
                  display: 'grid',
                  'grid-template-columns': '210px 1fr 28px',
                  gap: space(2),
                  'align-items': 'start',
                }}
              >
                <Input
                  value={m.name}
                  onInput={(e) => updateModule(i(), { name: e.currentTarget.value })}
                  placeholder="Module name"
                />
                <Input
                  value={m.responsibility}
                  onInput={(e) => updateModule(i(), { responsibility: e.currentTarget.value })}
                  placeholder="What this agent owns"
                />
                <button
                  title="Remove module"
                  class="in-press"
                  onClick={() => removeModule(i())}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    'text-align': 'center',
                    color: theme.fgSubtle,
                    'font-size': text('md'),
                    'line-height': '34px',
                  }}
                >
                  ✕
                </button>
              </Card>
            )}
          </For>
        </Stack>

        {/* Design references (optional, per-project) */}
        <Stack
          direction="row"
          align="center"
          justify="space-between"
          style={{ margin: `${space(5)} 0 ${space(2)}` }}
        >
          <Label>
            <span title="Images, exported Figma frames, React/CSS files">
              Design references · {designRefs().length} · optional
            </span>
          </Label>
          <Button variant="ghost" size="sm" onClick={pickDesignFiles}>
            + Add files
          </Button>
        </Stack>
        <p style={{ margin: `0 0 ${space(2)}`, 'font-size': text('xs'), color: theme.fgSubtle }}>
          Agents derive a design system from these (palette, type, spacing, components). Images &
          React/CSS work directly; export Figma frames to PNG/SVG.
        </p>
        <Show when={designRefs().length > 0}>
          <Stack direction="row" wrap gap={1}>
            <For each={designRefs()}>
              {(p) => (
                <Card
                  pad={1}
                  radius={2}
                  title={p}
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: space(1),
                    'font-size': text('xs'),
                    'font-family': font.mono,
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
                    class="in-press"
                    onClick={() => {
                      const id = projectId();
                      if (id) removeDesignRef(id, p);
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      color: theme.fgSubtle,
                      'font-size': text('sm'),
                    }}
                  >
                    ✕
                  </button>
                </Card>
              )}
            </For>
          </Stack>
        </Show>

        <Show when={error()}>
          <div style={{ 'margin-top': space(3), color: theme.error, 'font-size': text('sm') }}>
            {error()}
          </div>
        </Show>

        <Divider style={{ margin: `${space(4)} 0 ${space(3)}` }} />
        <Stack direction="row" align="center" justify="flex-end" gap={2}>
          <Button variant="secondary" onClick={() => toggleFanout(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canDispatch()} onClick={dispatch}>
            {loading() ? 'Dispatching…' : `Dispatch ${validModules().length} agents`}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
