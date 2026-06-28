import { splitProps, type JSX } from 'solid-js';
import { space, radius, type SpaceStep, type RadiusStep } from '../../lib/tokens';

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Inset padding on the spacing grid. Default 4 (16px). */
  pad?: SpaceStep;
  radius?: RadiusStep;
  /** Animate in on mount. */
  rise?: boolean;
  /** Stretch to fill its flex track. */
  grow?: boolean;
  /** Accent rail on the left edge — for pass/fail rows etc. */
  rail?: string;
}

/**
 * Card — a glass surface on the grid. The studio's one container; replaces the
 * scattered ad-hoc `.lg-glass` style blocks with a single, tokenized surface.
 */
export function Card(props: CardProps) {
  const [local, rest] = splitProps(props, [
    'pad',
    'radius',
    'rise',
    'grow',
    'rail',
    'class',
    'style',
    'children',
  ]);
  return (
    <div
      {...rest}
      class={`in-card${local.rise ? ' in-rise' : ''}${local.class ? ` ${local.class}` : ''}`}
      style={{
        padding: space(local.pad ?? 4),
        'border-radius': radius(local.radius ?? 4),
        flex: local.grow ? '1' : undefined,
        'min-width': local.grow ? '0' : undefined,
        'border-left': local.rail ? `3px solid ${local.rail}` : undefined,
        ...(local.style as JSX.CSSProperties),
      }}
    >
      {local.children}
    </div>
  );
}
