import { getProject, updateProject } from './projects';

/**
 * Per-project design references — images, exported Figma frames, and React
 * component/CSS files the agents should derive or match a design system from.
 * Stored on the Project (persisted) so both Blueprints and Fan-out can inject
 * them into build briefs.
 */

export function getDesignRefs(projectId: string): string[] {
  return getProject(projectId)?.designRefs ?? [];
}

export function addDesignRefs(projectId: string, paths: string[]): void {
  const current = getDesignRefs(projectId);
  const merged = [...current];
  for (const p of paths) if (!merged.includes(p)) merged.push(p);
  updateProject(projectId, { designRefs: merged });
}

export function removeDesignRef(projectId: string, path: string): void {
  updateProject(projectId, {
    designRefs: getDesignRefs(projectId).filter((p) => p !== path),
  });
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'];
const CODE_EXT = ['tsx', 'jsx', 'ts', 'js', 'css', 'scss', 'sass', 'less', 'vue', 'html'];

/**
 * A prompt section instructing the agent to build/match a design system from
 * the project's references. Returns '' when there are none.
 */
export function designRefsSection(projectId: string): string {
  const refs = getDesignRefs(projectId);
  if (refs.length === 0) return '';

  const images = refs.filter((p) => IMAGE_EXT.includes(ext(p)));
  const code = refs.filter((p) => CODE_EXT.includes(ext(p)));
  const figma = refs.filter((p) => ext(p) === 'fig');
  const other = refs.filter((p) => !images.includes(p) && !code.includes(p) && !figma.includes(p));

  const lines: string[] = [
    '',
    '## Design system (authoritative)',
    'This project has design references. Derive a cohesive design system from them — color palette, typography scale, spacing, radii, elevation, and core components — and build the UI to match. Capture the system as reusable tokens/components (and document them), do not hardcode one-off styles.',
  ];

  if (images.length) {
    lines.push(
      '',
      'Design images / exported frames (open and inspect these for the visual language):',
      ...images.map((p) => `- ${p}`),
    );
  }
  if (code.length) {
    lines.push(
      '',
      'Existing component / style code (match these conventions and reuse where possible):',
      ...code.map((p) => `- ${p}`),
    );
  }
  if (figma.length) {
    lines.push(
      '',
      'Figma files (binary — cannot be parsed directly; if you cannot read them, ask for PNG/SVG exports):',
      ...figma.map((p) => `- ${p}`),
    );
  }
  if (other.length) {
    lines.push('', 'Other references:', ...other.map((p) => `- ${p}`));
  }

  return lines.join('\n');
}

function ext(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? '';
}
