import { theme } from './theme';

/**
 * Shared color treatment for compact toggle/pill controls: accent-tinted when
 * active, muted-on-transparent otherwise. Returns only the active-dependent
 * color props so each caller keeps its own sizing and typography.
 */
export function accentControlColors(active: boolean) {
  return {
    background: active ? `color-mix(in srgb, ${theme.accent} 15%, transparent)` : 'transparent',
    border: `1px solid ${active ? theme.accent : theme.border}`,
    color: active ? theme.accent : theme.fgMuted,
  } as const;
}
