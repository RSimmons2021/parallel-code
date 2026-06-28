import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Card, Button, Label, Field } from './primitives';
import {
  store,
  toggleBlueprintGallery,
  launchBlueprint,
  allBlueprints,
  deleteCustomBlueprint,
  duplicateBlueprint,
  setDefaultStack,
} from '../store/store';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';
import { emptyBlueprint, type Blueprint } from '../lib/blueprints';
import { STACK_PRESETS, composeBrief } from '../lib/stacks';
import { BlueprintEditor } from './BlueprintEditor';

/**
 * Studio Blueprints gallery — pick a business-agent archetype to scaffold a new
 * build task pre-seeded with a production-grade brief, or author/customize your
 * own. Dispatch flows through the normal New Task dialog.
 */
export function BlueprintGallery() {
  const [editing, setEditing] = createSignal<Blueprint | null>(null);

  const choose = (bp: Blueprint) =>
    launchBlueprint(composeBrief(bp.buildPrompt, store.defaultStackId), bp.name);

  // Force reactivity on store.customBlueprints by reading it inside the render.
  const blueprints = () => {
    void store.customBlueprints.length;
    return allBlueprints();
  };

  return (
    <>
      <Dialog
        open={store.showBlueprintGallery}
        onClose={() => toggleBlueprintGallery(false)}
        width="min(920px, 92vw)"
        labelledBy="blueprint-gallery-title"
        panelStyle={{ padding: '0', gap: '0' }}
      >
        <Stack
          gap={4}
          style={{ padding: '22px 24px 24px', 'max-height': '82vh', 'overflow-y': 'auto' }}
        >
          <Stack direction="row" align="flex-end" justify="space-between" gap={3}>
            <div>
              <Label>Studio · Catalog</Label>
              <h2
                id="blueprint-gallery-title"
                style={{
                  margin: `${space(1)} 0 ${space(1)}`,
                  'font-family': font.display,
                  'font-size': text('xl'),
                  'font-weight': '700',
                  color: theme.fg,
                  'letter-spacing': '-0.01em',
                }}
              >
                Agent Blueprints
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
                Scaffold a production-ready agent for a client — stack, architecture, deliverables,
                and acceptance criteria, dispatched to your coding agents. Save your own to compound
                across engagements.
              </p>
            </div>
            <Stack direction="row" align="flex-end" gap={2}>
              <Field label="Studio stack" style={{ 'flex-shrink': '0' }}>
                <select
                  class="in-input"
                  value={store.defaultStackId}
                  onChange={(e) => setDefaultStack(e.currentTarget.value)}
                  style={{ cursor: 'pointer' }}
                  title="Framework every blueprint targets at dispatch"
                >
                  <For each={STACK_PRESETS}>{(s) => <option value={s.id}>{s.name}</option>}</For>
                </select>
              </Field>
              <Button
                variant="secondary"
                onClick={() => setEditing(emptyBlueprint())}
                style={{ 'white-space': 'nowrap' }}
              >
                + New Blueprint
              </Button>
            </Stack>
          </Stack>

          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: space(3),
            }}
          >
            <For each={blueprints()}>
              {(bp) => (
                <Card
                  radius={5}
                  rise
                  class="blueprint-card"
                  style={{
                    position: 'relative',
                    color: theme.fg,
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: space(2),
                    'min-height': '150px',
                  }}
                >
                  {/* Hover actions */}
                  <div
                    class="blueprint-card-actions"
                    style={{
                      position: 'absolute',
                      top: space(2),
                      right: space(2),
                      display: 'flex',
                      gap: space(1),
                    }}
                  >
                    <Show
                      when={bp.isCustom}
                      fallback={
                        <CardAction
                          title="Duplicate to customize"
                          onClick={() => setEditing(duplicateBlueprint(bp))}
                          glyph="⎘"
                        />
                      }
                    >
                      <CardAction title="Edit" onClick={() => setEditing({ ...bp })} glyph="✎" />
                      <CardAction
                        title="Delete"
                        onClick={() => deleteCustomBlueprint(bp.id)}
                        glyph="🗑"
                      />
                    </Show>
                  </div>

                  <button
                    class="in-press"
                    onClick={() => choose(bp)}
                    title="Build this"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'flex',
                      'flex-direction': 'column',
                      gap: space(2),
                      flex: '1',
                    }}
                  >
                    <div style={{ display: 'flex', 'align-items': 'center', gap: space(2) }}>
                      <span style={{ 'font-size': text('2xl'), 'line-height': '1' }}>
                        {bp.glyph}
                      </span>
                      <Label style={{ opacity: '0.8' }}>
                        {bp.isCustom ? 'Custom' : bp.category}
                      </Label>
                    </div>
                    <div
                      style={{
                        'font-family': font.display,
                        'font-size': text('md'),
                        'font-weight': '600',
                        'line-height': '1.2',
                      }}
                    >
                      {bp.name}
                    </div>
                    <div
                      style={{
                        'font-size': text('sm'),
                        color: theme.fgMuted,
                        'line-height': '1.4',
                        flex: '1',
                      }}
                    >
                      {bp.tagline}
                    </div>
                    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: space(1) }}>
                      <For each={bp.stack}>
                        {(s) => (
                          <span
                            style={{
                              'font-family': font.mono,
                              'font-size': text('2xs'),
                              padding: `2px 7px`,
                              'border-radius': 'var(--radius-1)',
                              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                              border:
                                '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                              color: 'var(--phosphor, var(--accent))',
                              'white-space': 'nowrap',
                            }}
                          >
                            {s}
                          </span>
                        )}
                      </For>
                    </div>
                  </button>
                </Card>
              )}
            </For>
          </div>
        </Stack>
      </Dialog>

      <Show when={editing()}>
        {(bp) => <BlueprintEditor blueprint={bp()} onClose={() => setEditing(null)} />}
      </Show>
    </>
  );
}

function CardAction(props: { title: string; glyph: string; onClick: () => void }) {
  return (
    <button
      title={props.title}
      class="in-press"
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      style={{
        all: 'unset',
        cursor: 'pointer',
        width: '24px',
        height: '24px',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'border-radius': 'var(--radius-1)',
        'font-size': text('sm'),
        background: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)',
        border: '1px solid var(--glass-hairline)',
      }}
    >
      {props.glyph}
    </button>
  );
}
