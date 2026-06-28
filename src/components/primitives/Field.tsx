import { splitProps, type JSX } from 'solid-js';
import { Show } from 'solid-js';
import { Label } from './Text';

interface FieldProps {
  label?: string;
  hint?: JSX.Element;
  children: JSX.Element;
  style?: JSX.CSSProperties;
}

/** Field — a labeled control: small-caps mono label, optional hint, the input. */
export function Field(props: FieldProps) {
  return (
    <div class="in-field" style={props.style}>
      <Show when={props.label}>
        <Label>{props.label}</Label>
      </Show>
      {props.children}
      <Show when={props.hint}>
        <span class="in-field__hint">{props.hint}</span>
      </Show>
    </div>
  );
}

/** Input — the refined recessed text input. Pairs with <Field>. */
export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const [local, rest] = splitProps(props, ['mono', 'class']);
  return (
    <input
      class={`in-input${local.mono ? ' in-input--mono' : ''}${local.class ? ` ${local.class}` : ''}`}
      {...rest}
    />
  );
}

/** Textarea — matches Input. */
export function Textarea(
  props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean },
) {
  const [local, rest] = splitProps(props, ['mono', 'class', 'style']);
  return (
    <textarea
      class={`in-input${local.mono ? ' in-input--mono' : ''}${local.class ? ` ${local.class}` : ''}`}
      style={{ resize: 'vertical', ...(local.style as JSX.CSSProperties) }}
      {...rest}
    />
  );
}
