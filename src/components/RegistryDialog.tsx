import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Field, Input, Textarea } from './primitives';
import {
  store,
  toggleRegistry,
  getAsset,
  createAsset,
  updateAssetFields,
  deleteAsset,
  duplicateAsset,
  commitAssetVersion,
  restoreAssetVersion,
  markAssetUsed,
  searchAssets,
  seedRegistryIfNeeded,
  sendPrompt,
  showNotification,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';
import { ASSET_KINDS, assetKindMeta, type AssetKind } from '../lib/registry-presets';
import { lineDiff, diffStat } from '../lib/diff';

/**
 * Asset Registry — the studio's cross-client reuse flywheel. A versioned library
 * of reusable prompts, systems, guardrails, rubrics, tool specs, and snippets.
 * Diff + roll back versions, search, track usage, and push an asset straight to
 * the active agent. Two-pane: list on the left, the selected asset on the right.
 */
export function RegistryDialog() {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal('');
  const [kindFilter, setKindFilter] = createSignal<AssetKind | 'all'>('all');
  const [diffVersion, setDiffVersion] = createSignal<number | null>(null);

  // Seed the starter library the first time the registry opens, then keep a
  // valid selection.
  createEffect(() => {
    if (!store.showRegistry) return;
    seedRegistryIfNeeded();
    const list = results();
    if (!selectedId() || !getAsset(selectedId() as string)) {
      setSelectedId(list[0]?.id ?? null);
    }
  });

  const results = createMemo(() => searchAssets(query(), kindFilter()));
  const sel = createMemo(() => {
    const id = selectedId();
    return id ? getAsset(id) : undefined;
  });

  const select = (id: string) => {
    setSelectedId(id);
    setDiffVersion(null);
  };

  const set = (patch: Parameters<typeof updateAssetFields>[1]) => {
    const a = sel();
    if (a) updateAssetFields(a.id, patch);
  };

  const onNew = () => {
    const k = kindFilter();
    const a = createAsset(k === 'all' ? 'system' : k);
    select(a.id);
  };

  const onSave = () => {
    const a = sel();
    if (!a) return;
    const v = commitAssetVersion(a.id, 'edit');
    showNotification(`Saved ${a.name || 'asset'} · v${v}`);
  };

  const onCopy = async (body: string, id: string) => {
    await navigator.clipboard.writeText(body);
    markAssetUsed(id);
    showNotification('Asset copied');
  };

  const onSend = (body: string, id: string) => {
    const taskId = store.activeTaskId;
    const agentId = store.activeAgentId;
    if (!taskId || !agentId) {
      showNotification('No active agent — focus a task first');
      return;
    }
    sendPrompt(taskId, agentId, body);
    markAssetUsed(id);
    showNotification('Sent to the active agent');
  };

  const onDuplicate = (id: string) => {
    const dup = duplicateAsset(id);
    if (dup) select(dup.id);
  };

  const onDelete = (id: string) => {
    deleteAsset(id);
    setSelectedId(results()[0]?.id ?? null);
  };

  return (
    <Dialog
      open={store.showRegistry}
      onClose={() => toggleRegistry(false)}
      width="min(1040px, 96vw)"
      labelledBy="registry-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <div
        style={{
          display: 'grid',
          'grid-template-columns': '288px 1fr',
          height: '80vh',
          'max-height': '760px',
        }}
      >
        {/* ── Left: library list ─────────────────────────────────────────── */}
        <Stack
          gap={3}
          style={{
            padding: `${space(4)} ${space(4)} ${space(3)}`,
            'border-right': `1px solid var(--glass-hairline, ${theme.border})`,
            'min-height': '0',
          }}
        >
          <div>
            <Label>Studio · Library</Label>
            <h2
              id="registry-title"
              style={{
                margin: `${space(1)} 0 0`,
                'font-family': font.display,
                'font-size': text('lg'),
                'font-weight': '700',
                color: theme.fg,
              }}
            >
              Asset Registry
            </h2>
          </div>

          <Input
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search assets…"
          />
          <select
            class="in-input"
            value={kindFilter()}
            onChange={(e) => setKindFilter(e.currentTarget.value as AssetKind | 'all')}
          >
            <option value="all">All kinds · {store.assets.length}</option>
            <For each={ASSET_KINDS}>
              {(k) => (
                <option value={k.id}>
                  {k.glyph} {k.label}
                </option>
              )}
            </For>
          </select>

          <Stack gap={1} style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
            <For
              each={results()}
              fallback={
                <span style={{ 'font-size': text('sm'), color: theme.fgSubtle, padding: space(2) }}>
                  No assets. Create one →
                </span>
              }
            >
              {(a) => (
                <button
                  class="in-press"
                  onClick={() => select(a.id)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: `${space(2)} ${space(3)}`,
                    'border-radius': 'var(--radius-2)',
                    border: `1px solid ${selectedId() === a.id ? 'var(--accent)' : 'transparent'}`,
                    background:
                      selectedId() === a.id
                        ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                        : 'transparent',
                  }}
                >
                  <Stack direction="row" align="center" gap={2}>
                    <span style={{ 'font-size': text('md') }}>{assetKindMeta(a.kind).glyph}</span>
                    <span
                      style={{
                        flex: '1',
                        'min-width': '0',
                        'font-size': text('sm'),
                        'font-weight': '600',
                        color: theme.fg,
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        'white-space': 'nowrap',
                      }}
                    >
                      {a.name || 'Untitled'}
                    </span>
                    <Show when={a.usageCount > 0}>
                      <span
                        class="in-tnum"
                        title="Times used"
                        style={{
                          'font-size': text('2xs'),
                          color: theme.fgSubtle,
                          'font-family': font.mono,
                        }}
                      >
                        ↺{a.usageCount}
                      </span>
                    </Show>
                  </Stack>
                  <span
                    style={{
                      display: 'block',
                      'font-size': text('xs'),
                      color: theme.fgMuted,
                      'margin-top': '2px',
                      overflow: 'hidden',
                      'text-overflow': 'ellipsis',
                      'white-space': 'nowrap',
                    }}
                  >
                    {a.description || assetKindMeta(a.kind).label}
                  </span>
                </button>
              )}
            </For>
          </Stack>

          <Button variant="secondary" block onClick={onNew}>
            + New asset
          </Button>
        </Stack>

        {/* ── Right: selected asset ──────────────────────────────────────── */}
        <Show
          when={sel()}
          fallback={
            <Stack
              align="center"
              justify="center"
              style={{ color: theme.fgMuted, padding: space(6) }}
            >
              <span style={{ 'font-size': text('sm') }}>
                Select an asset, or create one to start your library.
              </span>
            </Stack>
          }
        >
          {(a) => (
            <Stack gap={3} style={{ padding: space(5), 'overflow-y': 'auto', 'min-height': '0' }}>
              <Stack direction="row" align="center" gap={2}>
                <select
                  class="in-input"
                  value={a().kind}
                  onChange={(e) => set({ kind: e.currentTarget.value as AssetKind })}
                  style={{ width: 'auto' }}
                  title="Asset kind"
                >
                  <For each={ASSET_KINDS}>
                    {(k) => (
                      <option value={k.id}>
                        {k.glyph} {k.label}
                      </option>
                    )}
                  </For>
                </select>
                <Input
                  value={a().name}
                  onInput={(e) => set({ name: e.currentTarget.value })}
                  placeholder="Asset name"
                  style={{ flex: '1', 'font-weight': '600' }}
                />
              </Stack>

              <Field label="Description">
                <Input
                  value={a().description}
                  onInput={(e) => set({ description: e.currentTarget.value })}
                  placeholder="What it's for, when to use it"
                />
              </Field>

              <Field label="Tags (comma-separated)">
                <Input
                  value={a().tags.join(', ')}
                  onInput={(e) =>
                    set({
                      tags: e.currentTarget.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="rag, support, citations"
                  mono
                />
              </Field>

              <Field
                label="Body"
                hint={
                  <>
                    Templated with <code>{'{{input}}'}</code> etc. · {a().versions.length} versions
                  </>
                }
              >
                <Textarea
                  mono
                  value={a().body}
                  onInput={(e) => set({ body: e.currentTarget.value })}
                  placeholder="The reusable prompt / spec / snippet…"
                  style={{ 'min-height': '220px', 'font-size': text('sm'), 'line-height': '1.5' }}
                />
              </Field>

              {/* Actions */}
              <Stack direction="row" gap={2} wrap align="center">
                <Button variant="primary" size="sm" onClick={onSave}>
                  Save version
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onCopy(a().body, a().id)}>
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSend(a().body, a().id)}
                  title="Send this asset to the currently focused task's agent"
                >
                  Send to active agent →
                </Button>
                <span style={{ flex: '1' }} />
                <Button variant="ghost" size="sm" onClick={() => onDuplicate(a().id)}>
                  Duplicate
                </Button>
                <Button variant="danger" size="sm" onClick={() => onDelete(a().id)}>
                  Delete
                </Button>
              </Stack>

              {/* Version history */}
              <Show when={a().versions.length > 0}>
                <Label style={{ display: 'block', margin: `${space(2)} 0 ${space(1)}` }}>
                  Version history
                </Label>
                <Stack gap={1}>
                  <For each={[...a().versions].reverse()}>
                    {(v) => (
                      <Card
                        pad={2}
                        radius={2}
                        style={{
                          display: 'grid',
                          'grid-template-columns': '46px 1fr auto auto',
                          gap: space(2),
                          'align-items': 'center',
                          'font-size': text('xs'),
                        }}
                      >
                        <span class="in-tnum" style={{ 'font-family': font.mono, color: theme.fg }}>
                          v{v.version}
                        </span>
                        <span
                          class="in-tnum"
                          style={{ color: theme.fgSubtle, 'font-family': font.mono }}
                        >
                          {new Date(v.ts).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {v.note ? ` · ${v.note}` : ''}
                        </span>
                        <button
                          class="in-press"
                          onClick={() =>
                            setDiffVersion(diffVersion() === v.version ? null : v.version)
                          }
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            color: diffVersion() === v.version ? theme.accent : theme.fgMuted,
                            'font-family': font.mono,
                            'font-size': text('2xs'),
                          }}
                        >
                          diff
                        </button>
                        <button
                          class="in-press"
                          onClick={() => restoreAssetVersion(a().id, v.version)}
                          title="Restore this version into the editor"
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            color: theme.fgMuted,
                            'font-family': font.mono,
                            'font-size': text('2xs'),
                          }}
                        >
                          restore
                        </button>
                      </Card>
                    )}
                  </For>
                </Stack>

                {/* Diff: selected version → current working body */}
                <Show when={diffVersion()}>
                  {(dv) => {
                    const version = () => a().versions.find((x) => x.version === dv());
                    const ops = createMemo(() => lineDiff(version()?.body ?? '', a().body));
                    const stat = () => diffStat(ops());
                    return (
                      <Card pad={3} radius={3} style={{ 'margin-top': space(1) }}>
                        <Stack
                          direction="row"
                          align="center"
                          gap={2}
                          style={{ 'margin-bottom': space(2) }}
                        >
                          <Label>v{dv()} → current</Label>
                          <span
                            class="in-tnum"
                            style={{ 'font-family': font.mono, 'font-size': text('2xs') }}
                          >
                            <span style={{ color: theme.success }}>+{stat().add}</span>{' '}
                            <span style={{ color: theme.error }}>−{stat().del}</span>
                          </span>
                        </Stack>
                        <div
                          style={{
                            'font-family': font.mono,
                            'font-size': text('xs'),
                            'line-height': '1.5',
                            'max-height': '220px',
                            'overflow-y': 'auto',
                            'white-space': 'pre-wrap',
                            'word-break': 'break-word',
                          }}
                        >
                          <For each={ops()}>
                            {(op) => (
                              <div
                                style={{
                                  background:
                                    op.type === 'add'
                                      ? 'color-mix(in srgb, var(--success) 14%, transparent)'
                                      : op.type === 'del'
                                        ? 'color-mix(in srgb, var(--error) 14%, transparent)'
                                        : 'transparent',
                                  color:
                                    op.type === 'same'
                                      ? theme.fgMuted
                                      : op.type === 'add'
                                        ? theme.success
                                        : theme.error,
                                  padding: '0 6px',
                                }}
                              >
                                {op.type === 'add' ? '+ ' : op.type === 'del' ? '− ' : '  '}
                                {op.text || ' '}
                              </div>
                            )}
                          </For>
                        </div>
                      </Card>
                    );
                  }}
                </Show>
              </Show>
            </Stack>
          )}
        </Show>
      </div>
    </Dialog>
  );
}
