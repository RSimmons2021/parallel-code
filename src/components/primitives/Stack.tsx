import { splitProps, type JSX } from 'solid-js';
import { space, type SpaceStep } from '../../lib/tokens';

interface StackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Main axis. Default 'column'. */
  direction?: 'row' | 'column';
  /** Gap on the spacing grid. Default 0. */
  gap?: SpaceStep;
  align?: JSX.CSSProperties['align-items'];
  justify?: JSX.CSSProperties['justify-content'];
  wrap?: boolean;
  /** Grow to fill the cross container (`flex: 1`). */
  grow?: boolean;
}

/**
 * Stack — the single layout primitive. Flexbox on the spacing grid so every
 * gap in the studio is a token, never an ad-hoc pixel value.
 */
export function Stack(props: StackProps) {
  const [local, rest] = splitProps(props, [
    'direction',
    'gap',
    'align',
    'justify',
    'wrap',
    'grow',
    'style',
    'children',
  ]);
  return (
    <div
      {...rest}
      style={{
        display: 'flex',
        'flex-direction': local.direction ?? 'column',
        gap: space(local.gap ?? 0),
        'align-items': local.align,
        'justify-content': local.justify,
        'flex-wrap': local.wrap ? 'wrap' : undefined,
        flex: local.grow ? '1' : undefined,
        'min-width': local.grow ? '0' : undefined,
        ...(local.style as JSX.CSSProperties),
      }}
    >
      {local.children}
    </div>
  );
}
