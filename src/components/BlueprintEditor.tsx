import { createSignal, For } from 'solid-js';
import { Dialog } from './Dialog';
import { theme } from '../lib/theme';
import { BLUEPRINT_CATEGORIES, type Blueprint } from '../lib/blueprints';
import { saveCustomBlueprint } from '../store/store';

/**
 * Create / edit a custom Studio Blueprint. Saved blueprints persist with app
 * state and appear in the gallery alongside the built-ins.
 */
export function BlueprintEditor(props: { blueprint: Blueprint; onClose: () => void }) {
  /* eslint-disable solid/reactivity -- one-time initialization of editable form
     state from the blueprint prop; the form intentionally keeps its own state and
     does not reset if the prop changes while the editor is open */
  const [name, setName] = createSignal(props.blueprint.name);
  const [category, setCategory] = createSignal(props.blueprint.category);
  const [glyph, setGlyph] = createSignal(props.blueprint.glyph);
  const [tagline, setTagline] = createSignal(props.blueprint.tagline);
  const [stack, setStack] = createSignal(props.blueprint.stack.join(', '));
  const [buildPrompt, setBuildPrompt] = createSignal(props.blueprint.buildPrompt);
  /* eslint-enable solid/reactivity */

  const canSave = () => name().trim().length > 0 && buildPrompt().trim().length > 0;

  const save = () => {
    if (!canSave()) return;
    saveCustomBlueprint({
      ...props.blueprint,
      name: name().trim(),
      category: category(),
      glyph: glyph().trim() || '✨',
      tagline: tagline().trim(),
      stack: stack()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      buildPrompt: buildPrompt(),
      isCustom: true,
    });
    props.onClose();
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
      open={true}
      onClose={props.onClose}
      width="min(760px, 92vw)"
      zIndex={1100}
      labelledBy="blueprint-editor-title"
    >
      <div style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}>
        <span class="lg-label">Studio · Blueprint</span>
        <h2
          id="blueprint-editor-title"
          style={{
            margin: '2px 0 16px',
            'font-family': 'var(--font-display)',
            'font-size': '18px',
            'font-weight': '700',
            color: theme.fg,
          }}
        >
          {props.blueprint.name ? 'Edit Blueprint' : 'New Blueprint'}
        </h2>

        <div style={{ display: 'grid', 'grid-template-columns': '1fr 90px 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input
              class="input-field"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Customer Onboarding Agent"
              style={{ width: '100%', 'box-sizing': 'border-box' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Glyph</label>
            <input
              class="input-field"
              value={glyph()}
              onInput={(e) => setGlyph(e.currentTarget.value)}
              maxLength={2}
              style={{ width: '100%', 'box-sizing': 'border-box', 'text-align': 'center' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select
              class="input-field"
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value as Blueprint['category'])}
              style={{ width: '100%', 'box-sizing': 'border-box' }}
            >
              <For each={BLUEPRINT_CATEGORIES}>{(c) => <option value={c}>{c}</option>}</For>
            </select>
          </div>
        </div>

        <div style={{ 'margin-top': '12px' }}>
          <label style={labelStyle}>Tagline</label>
          <input
            class="input-field"
            value={tagline()}
            onInput={(e) => setTagline(e.currentTarget.value)}
            placeholder="One-line pitch shown on the card"
            style={{ width: '100%', 'box-sizing': 'border-box' }}
          />
        </div>

        <div style={{ 'margin-top': '12px' }}>
          <label style={labelStyle}>Stack (comma-separated)</label>
          <input
            class="input-field"
            value={stack()}
            onInput={(e) => setStack(e.currentTarget.value)}
            placeholder="FastAPI, LangGraph, Claude"
            style={{ width: '100%', 'box-sizing': 'border-box' }}
          />
        </div>

        <div style={{ 'margin-top': '12px' }}>
          <label style={labelStyle}>Build brief (sent to the coding agent)</label>
          <textarea
            class="input-field"
            value={buildPrompt()}
            onInput={(e) => setBuildPrompt(e.currentTarget.value)}
            placeholder="Objective, architecture, deliverables, acceptance criteria…"
            style={{
              width: '100%',
              'box-sizing': 'border-box',
              'min-height': '240px',
              resize: 'vertical',
              'font-family': 'var(--font-mono)',
              'font-size': '12.5px',
              'line-height': '1.5',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            'justify-content': 'flex-end',
            gap: '10px',
            'margin-top': '18px',
          }}
        >
          <button
            class="btn-secondary"
            onClick={() => props.onClose()}
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
            disabled={!canSave()}
            onClick={save}
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: '1px solid transparent',
              'border-radius': '8px',
              color: 'var(--accent-text)',
              cursor: canSave() ? 'pointer' : 'not-allowed',
              opacity: canSave() ? '1' : '0.5',
              'font-size': '14px',
              'font-weight': '600',
            }}
          >
            Save Blueprint
          </button>
        </div>
      </div>
    </Dialog>
  );
}
