import { splitProps, type JSX } from 'solid-js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
}

/**
 * Button — the studio's only button. Tactile spring press, four intents, two
 * sizes. All finish lives in `.in-btn*` CSS so hover/active/focus stay
 * consistent and theme-aware; this component only chooses the class.
 */
export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'block', 'class', 'children']);
  const cls = () =>
    [
      'in-btn',
      `in-btn--${local.variant ?? 'secondary'}`,
      local.size === 'sm' ? 'in-btn--sm' : '',
      local.block ? 'in-btn--block' : '',
      local.class ?? '',
    ]
      .filter(Boolean)
      .join(' ');
  return (
    <button type="button" class={cls()} {...rest}>
      {local.children}
    </button>
  );
}
