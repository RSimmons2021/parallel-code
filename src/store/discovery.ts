import { store, setStore } from './core';
import { getProjectPath } from './projects';
import { trackedAskOnce } from './telemetry';
import type { AskProvider } from '../lib/ask-once';

/**
 * Discovery → Spec canvas — the studio's front door. Capture how the client
 * works TODAY (the workflow map: steps, who does them, the systems they touch,
 * the rules, and the painful bottleneck) BEFORE building anything, then
 * synthesize a structured build brief that feeds Fan-out / Blueprints. This is
 * how delivery teams actually work: map the workflow, then aim the agent at the
 * real pain — not the other way around.
 */

export type StepActor = 'human' | 'system' | 'agent';

export interface WorkflowStep {
  id: string;
  /** What happens, e.g. "Triage / categorize". */
  name: string;
  /** Who does it today, or who should: a person, existing software, or the agent. */
  actor: StepActor;
  /** Systems / data this step touches, e.g. "Zendesk, CRM". */
  systems: string;
  /** The slow / costly / error-prone step the agent should target. */
  isPain: boolean;
  /** Rule, SLA, or detail, e.g. "refunds > $500 escalate to a manager". */
  note: string;
}

export interface Discovery {
  id: string;
  projectId: string;
  clientName: string;
  process: string; // e.g. "B2B SaaS support"
  objective: string; // one-sentence goal
  steps: WorkflowStep[];
  rules: string; // decision points / SLAs / guardrails
  outOfScope: string;
  createdAt: number;
  updatedAt: number;
}

function now(): number {
  return Date.now();
}

export function emptyStep(): WorkflowStep {
  return {
    id: crypto.randomUUID().slice(0, 8),
    name: '',
    actor: 'human',
    systems: '',
    isPain: false,
    note: '',
  };
}

export function getDiscovery(projectId: string): Discovery | undefined {
  return store.discoveries.find((d) => d.projectId === projectId);
}

export function getOrCreateDiscovery(projectId: string): Discovery {
  const existing = getDiscovery(projectId);
  if (existing) return existing;
  const project = store.projects.find((p) => p.id === projectId);
  const d: Discovery = {
    id: crypto.randomUUID().slice(0, 8),
    projectId,
    clientName: project?.name ?? '',
    process: '',
    objective: '',
    steps: [emptyStep(), emptyStep(), emptyStep()],
    rules: '',
    outOfScope: '',
    createdAt: now(),
    updatedAt: now(),
  };
  setStore('discoveries', (prev) => [...prev, d]);
  return d;
}

export function updateDiscoveryFields(
  id: string,
  patch: Partial<
    Pick<Discovery, 'clientName' | 'process' | 'objective' | 'steps' | 'rules' | 'outOfScope'>
  >,
): void {
  setStore('discoveries', (d) => d.id === id, { ...patch, updatedAt: now() });
}

const ACTOR_LABEL: Record<StepActor, string> = {
  human: 'human',
  system: 'system',
  agent: 'agent',
};

/** Unique systems mentioned across all steps. */
function systemsList(d: Discovery): string[] {
  const set = new Set<string>();
  for (const s of d.steps) {
    for (const part of s.systems.split(',')) {
      const t = part.trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

/**
 * Deterministically synthesize a structured build brief from the workflow map.
 * Reliable and offline; the optional `refineDiscoveryBrief` can polish it with
 * an LLM.
 */
export function composeDiscoveryBrief(d: Discovery): string {
  const steps = d.steps.filter((s) => s.name.trim());
  const painSteps = steps.filter((s) => s.isPain);
  const agentSteps = steps.filter((s) => s.actor === 'agent');
  const systems = systemsList(d);

  const lines: string[] = [];
  lines.push(`# ${d.objective.trim() || 'Build brief'}`);
  lines.push('');
  if (d.clientName.trim() || d.process.trim()) {
    lines.push(
      `**Client:** ${d.clientName.trim() || '—'} · **Process:** ${d.process.trim() || '—'}`,
    );
    lines.push('');
  }

  if (steps.length) {
    lines.push('## Current workflow (today)');
    steps.forEach((s, i) => {
      const tags = [`_${ACTOR_LABEL[s.actor]}_`];
      if (s.systems.trim()) tags.push(`[${s.systems.trim()}]`);
      if (s.isPain) tags.push('**← PAIN**');
      lines.push(
        `${i + 1}. ${s.name.trim()} — ${tags.join(' ')}${s.note.trim() ? ` — ${s.note.trim()}` : ''}`,
      );
    });
    lines.push('');
  }

  if (painSteps.length) {
    lines.push('## Target');
    lines.push(
      `The agent should take over / accelerate: ${painSteps.map((s) => s.name.trim()).join(', ')}.`,
    );
    lines.push('');
  }

  if (agentSteps.length) {
    lines.push('## Capabilities (in scope)');
    for (const s of agentSteps) {
      lines.push(`- ${s.name.trim()}${s.note.trim() ? ` (${s.note.trim()})` : ''}`);
    }
    lines.push('');
  }

  if (systems.length) {
    lines.push('## Integrations & data');
    for (const sys of systems) lines.push(`- ${sys}`);
    lines.push('');
  }

  if (d.rules.trim()) {
    lines.push('## Decision points & rules');
    lines.push(d.rules.trim());
    lines.push('');
  }

  if (d.outOfScope.trim()) {
    lines.push('## Out of scope');
    lines.push(d.outOfScope.trim());
    lines.push('');
  }

  lines.push('## Acceptance criteria');
  if (painSteps.length) {
    lines.push(
      `- Handles ${painSteps.map((s) => s.name.trim()).join(' / ')} end to end for real inputs.`,
    );
  }
  lines.push(
    '- Integrates with the systems above; fails safe with a clear message when a dependency is unavailable.',
  );
  lines.push('- Escalates to a human at the decision points / rules above instead of guessing.');

  return lines.join('\n');
}

/** Optional: ask the LLM to tighten the deterministic brief into a polished one. */
export async function refineDiscoveryBrief(d: Discovery, provider: AskProvider): Promise<string> {
  const cwd = getProjectPath(d.projectId);
  if (!cwd) throw new Error('Project not found');
  const draft = composeDiscoveryBrief(d);
  const prompt = `You are a senior AI delivery lead. Below is a structured build brief derived from a client workflow map. Tighten it into a clear, production-ready build brief a coding agent can execute: keep the section structure, make the objective and acceptance criteria crisp and testable, infer reasonable capabilities the workflow implies, and keep it concise. Return ONLY the brief in Markdown — no preamble.

${draft}`;
  return trackedAskOnce(prompt, cwd, provider, {
    kind: 'discovery',
    label: d.objective || d.process || 'discovery',
    projectId: d.projectId,
  });
}
