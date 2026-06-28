import { createSignal, For, Show } from 'solid-js';
import { Dialog } from './Dialog';
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
      >
        <div style={{ padding: '22px 24px 24px', 'max-height': '82vh', 'overflow-y': 'auto' }}>
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
                id="blueprint-gallery-title"
                style={{
                  margin: '2px 0 4px',
                  'font-family': 'var(--font-display)',
                  'font-size': '20px',
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
                  'font-size': '13px',
                  color: theme.fgMuted,
                  'max-width': '60ch',
                }}
              >
                Scaffold a production-ready agent for a client — stack, architecture, deliverables,
                and acceptance criteria, dispatched to your coding agents. Save your own to compound
                across engagements.
              </p>
            </div>
            <div style={{ display: 'flex', 'align-items': 'flex-end', gap: '10px' }}>
              <label style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
                <span class="lg-label" title="Framework every blueprint targets at dispatch">
                  Studio stack
                </span>
                <select
                  class="input-field"
                  value={store.defaultStackId}
                  onChange={(e) => setDefaultStack(e.currentTarget.value)}
                  style={{ padding: '8px 10px', 'font-size': '13px', cursor: 'pointer' }}
                >
                  <For each={STACK_PRESETS}>{(s) => <option value={s.id}>{s.name}</option>}</For>
                </select>
              </label>
              <button
                class="btn-secondary"
                onClick={() => setEditing(emptyBlueprint())}
                style={{
                  'white-space': 'nowrap',
                  padding: '9px 14px',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  border: `1px solid color-mix(in srgb, var(--accent) 30%, ${theme.border})`,
                  'border-radius': '8px',
                  color: theme.fg,
                  cursor: 'pointer',
                  'font-size': '13px',
                  'font-weight': '500',
                }}
              >
                + New Blueprint
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              'grid-template-columns': 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
            }}
          >
            <For each={blueprints()}>
              {(bp) => (
                <div
                  class="lg-glass blueprint-card"
                  style={{
                    position: 'relative',
                    padding: '16px',
                    'border-radius': '14px',
                    color: theme.fg,
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '10px',
                    'min-height': '150px',
                  }}
                >
                  {/* Hover actions */}
                  <div
                    class="blueprint-card-actions"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'flex',
                      gap: '4px',
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
                    onClick={() => choose(bp)}
                    title="Build this"
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'flex',
                      'flex-direction': 'column',
                      gap: '10px',
                      flex: '1',
                    }}
                  >
                    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                      <span style={{ 'font-size': '26px', 'line-height': '1' }}>{bp.glyph}</span>
                      <span class="lg-label" style={{ opacity: '0.8' }}>
                        {bp.isCustom ? 'Custom' : bp.category}
                      </span>
                    </div>
                    <div
                      style={{
                        'font-family': 'var(--font-display)',
                        'font-size': '15px',
                        'font-weight': '600',
                        'line-height': '1.2',
                      }}
                    >
                      {bp.name}
                    </div>
                    <div
                      style={{
                        'font-size': '12.5px',
                        color: theme.fgMuted,
                        'line-height': '1.4',
                        flex: '1',
                      }}
                    >
                      {bp.tagline}
                    </div>
                    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '5px' }}>
                      <For each={bp.stack}>
                        {(s) => (
                          <span
                            style={{
                              'font-family': 'var(--font-mono)',
                              'font-size': '10px',
                              padding: '2px 7px',
                              'border-radius': '6px',
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
                </div>
              )}
            </For>
          </div>
        </div>
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
        'border-radius': '6px',
        'font-size': '12px',
        background: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)',
        border: '1px solid var(--glass-hairline)',
      }}
    >
      {props.glyph}
    </button>
  );
}
