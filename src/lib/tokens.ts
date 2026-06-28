/**
 * Instrument design tokens — type-safe references to the CSS variables defined
 * in `src/styles/instrument.css`. The *values* live in CSS (single source of
 * truth, themeable, designer-editable); this module gives components
 * autocompletable names so inline styles never hard-code a number off-grid.
 *
 * Mirrors the existing `theme` pattern in `src/lib/theme.ts` (references to CSS
 * custom properties), extended with the spacing / type / motion / elevation
 * scales.
 */

export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type TextStep = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type RadiusStep = 1 | 2 | 3 | 4 | 5 | 'pill';
export type DurStep = 1 | 2 | 3 | 4;
export type ElevStep = 0 | 1 | 2 | 3;

/** Spacing on the 8pt grid: `space(3)` → `var(--space-3)` (12px). */
export const space = (n: SpaceStep): string => `var(--space-${n})`;

/** Type scale: `text('md')` → `var(--text-md)` (14px). */
export const text = (s: TextStep): string => `var(--text-${s})`;

/** Corner radii: `radius(4)` → `var(--radius-4)`. */
export const radius = (s: RadiusStep): string => `var(--radius-${s})`;

/** Motion durations: `dur(2)` → `var(--dur-2)` (160ms). */
export const dur = (n: DurStep): string => `var(--dur-${n})`;

/** Elevation shadows: `elev(2)` → `var(--elev-2)`. */
export const elev = (n: ElevStep): string => `var(--elev-${n})`;

/** Motion easings. `ease.spring` is the only place curves live in the system. */
export const ease = {
  swift: 'var(--ease-swift)',
  standard: 'var(--ease-standard)',
  spring: 'var(--ease-spring)',
  exit: 'var(--ease-exit)',
} as const;

export const font = {
  ui: 'var(--font-ui)',
  display: 'var(--font-display)',
  mono: 'var(--font-mono)',
} as const;

export const tracking = {
  label: 'var(--tracking-label)',
  tight: 'var(--tracking-tight)',
} as const;

export const leading = {
  tight: 'var(--leading-tight)',
  base: 'var(--leading)',
} as const;

/** A composed transition shorthand on instrument durations/easings. */
export const transition = (props: string, d: DurStep = 2, e: keyof typeof ease = 'swift'): string =>
  `${props} ${dur(d)} ${ease[e]}`;
