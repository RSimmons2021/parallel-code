import { splitProps, type JSX } from 'solid-js';

/**
 * Label — the small-caps mono micro-label. The printed tag / exposed seam of
 * the Instrument language. Use above fields, sections, and metrics.
 */
export function Label(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <span class={`in-label${local.class ? ` ${local.class}` : ''}`} {...rest}>
      {local.children}
    </span>
  );
}

/** A hairline divider — structure shown, never boxed. */
export function Divider(props: { style?: JSX.CSSProperties }) {
  return <hr class="in-divider" style={props.style} role="separator" />;
}
