import { createSignal, For } from 'solid-js';
import { Dialog } from './Dialog';
import { Stack, Button, Label, Divider, Field, Input, Textarea } from './primitives';
import { theme } from '../lib/theme';
import { space, text, font } from '../lib/tokens';
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

  return (
    <Dialog
      open={true}
      onClose={props.onClose}
      width="min(760px, 92vw)"
      zIndex={1100}
      labelledBy="blueprint-editor-title"
      panelStyle={{ padding: '0', gap: '0' }}
    >
      <Stack
        gap={3}
        style={{ padding: '22px 24px 20px', 'max-height': '86vh', 'overflow-y': 'auto' }}
      >
        <div>
          <Label>Studio · Blueprint</Label>
          <h2
            id="blueprint-editor-title"
            style={{
              margin: `${space(1)} 0 0`,
              'font-family': font.display,
              'font-size': text('lg'),
              'font-weight': '700',
              color: theme.fg,
            }}
          >
            {props.blueprint.name ? 'Edit Blueprint' : 'New Blueprint'}
          </h2>
        </div>

        <div style={{ display: 'grid', 'grid-template-columns': '1fr 90px 1fr', gap: space(3) }}>
          <Field label="Name">
            <Input
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Customer Onboarding Agent"
            />
          </Field>
          <Field label="Glyph">
            <Input
              value={glyph()}
              onInput={(e) => setGlyph(e.currentTarget.value)}
              maxLength={2}
              style={{ 'text-align': 'center' }}
            />
          </Field>
          <Field label="Category">
            <select
              class="in-input"
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value as Blueprint['category'])}
              style={{ width: '100%', 'box-sizing': 'border-box' }}
            >
              <For each={BLUEPRINT_CATEGORIES}>{(c) => <option value={c}>{c}</option>}</For>
            </select>
          </Field>
        </div>

        <Field label="Tagline">
          <Input
            value={tagline()}
            onInput={(e) => setTagline(e.currentTarget.value)}
            placeholder="One-line pitch shown on the card"
          />
        </Field>

        <Field label="Stack (comma-separated)">
          <Input
            value={stack()}
            onInput={(e) => setStack(e.currentTarget.value)}
            placeholder="FastAPI, LangGraph, Claude"
          />
        </Field>

        <Field label="Build brief (sent to the coding agent)">
          <Textarea
            mono
            value={buildPrompt()}
            onInput={(e) => setBuildPrompt(e.currentTarget.value)}
            placeholder="Objective, architecture, deliverables, acceptance criteria…"
            style={{ 'min-height': '240px', 'font-size': text('sm'), 'line-height': '1.5' }}
          />
        </Field>

        <Divider />
        <Stack direction="row" justify="flex-end" gap={2}>
          <Button variant="secondary" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave()} onClick={save}>
            Save Blueprint
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
}
