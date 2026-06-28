import { store } from './core';
import { createTask } from './tasks';
import { getProject, getProjectPath, getProjectBranchPrefix } from './projects';
import { designRefsSection } from './design';
import { invoke } from '../lib/ipc';
import { IPC } from '../../electron/ipc/channels';
import { composeBrief } from '../lib/stacks';
import { type AskProvider as AskCodeProvider } from '../lib/ask-once';
import { trackedAskOnce } from './telemetry';
import * as log from '../lib/log';

export interface FanoutModule {
  name: string;
  responsibility: string;
}

/**
 * A sensible default decomposition for an AI-agent build. Used as the starting
 * point in the Fan-out dialog; the user edits/adds/removes before dispatch.
 */
export function defaultModules(): FanoutModule[] {
  return [
    {
      name: 'Core agent & orchestration',
      responsibility:
        'The agent loop / state machine, prompts, and control flow. Owns the public entrypoint other modules call.',
    },
    {
      name: 'Tools & integrations',
      responsibility:
        'Typed tools and external API/service clients (with mocks), validation, and idempotency.',
    },
    {
      name: 'Retrieval / data layer',
      responsibility:
        'Ingestion, embeddings, vector store, retrieval/ranking — or the persistence layer if no RAG.',
    },
    {
      name: 'API & service',
      responsibility:
        'HTTP API (FastAPI), request/response schemas, /health, auth, streaming, Dockerfile.',
    },
    {
      name: 'Eval & guardrails',
      responsibility:
        'Golden dataset, scorers (assertions + LLM-judge), input/output guardrails, CI threshold.',
    },
    {
      name: 'Docs & handoff',
      responsibility:
        'README, architecture diagram (Mermaid), env/setup, deploy guide, and a runnable demo.',
    },
  ];
}

/**
 * Ask the configured LLM to decompose a brief into parallel build modules.
 * Falls back to the caller's handling on failure. Streams via AskAboutCode.
 */
export async function autoSplitModules(
  spec: string,
  projectPath: string,
  provider: AskCodeProvider,
): Promise<FanoutModule[]> {
  const prompt = `You are a senior AI engineering lead. Decompose the following client project brief into parallel build modules (workstreams) that separate coding agents can build independently in isolated git branches.

Rules:
- Return ONLY a JSON array. No prose, no markdown code fences.
- 4 to 7 modules. Cleanly separable, minimal overlap, collectively covering the whole build (core logic, tools/integrations, data/retrieval if relevant, API/service, eval/guardrails, docs/deploy, and a design/UI module if the brief implies a UI).
- Each item: {"name": string (<= 40 chars), "responsibility": string (<= 160 chars describing what that module owns)}.

CLIENT BRIEF:
${spec.trim()}`;

  const out = await trackedAskOnce(prompt, projectPath, provider, {
    kind: 'autosplit',
    label: spec.trim().slice(0, 80),
  });
  const modules = parseModules(out);
  if (modules.length === 0) {
    throw new Error('Could not parse modules from the model response');
  }
  return modules;
}

function parseModules(raw: string): FanoutModule[] {
  // Strip markdown fences and isolate the JSON array.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is FanoutModule =>
          m && typeof m.name === 'string' && typeof m.responsibility === 'string',
      )
      .map((m) => ({ name: m.name.trim(), responsibility: m.responsibility.trim() }))
      .filter((m) => m.name.length > 0);
  } catch {
    return [];
  }
}

function buildModulePrompt(
  spec: string,
  module: FanoutModule,
  allModules: FanoutModule[],
  stackId: string,
  designSection: string,
): string {
  const siblings = allModules
    .filter((m) => m.name !== module.name)
    .map((m) => `- ${m.name}: ${m.responsibility}`)
    .join('\n');

  const base = `You are ONE agent in a parallel team building a client AI system. Each teammate works in an isolated git branch on a different module; the branches get reviewed and merged separately.

# Client brief (shared context)
${spec.trim()}

# YOUR module: ${module.name}
${module.responsibility}

Build ONLY this module. Do not implement the other modules — assume their work via clean, documented interfaces/contracts.

# Other modules being built in parallel
${siblings || '(none)'}

# How to collaborate without merge conflicts
- Define and document the public interface(s) your module exposes (function signatures / API routes / data schemas) at the top of your work so teammates can integrate.
- Where you depend on another module, code against a small typed interface and provide a stub/mock so your module runs and tests pass standalone.
- Keep your changes scoped to your module's files/directories; avoid touching shared files unless you add to them additively.

# Deliverables for your module
- Working, tested code for this module with clear interfaces.
- Unit tests that pass standalone (mock external/teammate dependencies).
- A short MODULE.md: what it does, its public interface, how to run/test it, and assumptions about other modules.
- Keep \`.claude/steps.json\` updated so progress is reviewable.

Do not declare done until your module's tests pass on its own.${designSection}`;

  return composeBrief(base, stackId);
}

export interface FanoutResult {
  created: { name: string; taskId: string }[];
  failed: { name: string; error: string }[];
}

/**
 * Dispatch one parallel worktree task per module, each seeded with a focused
 * build brief derived from the shared spec + the studio stack preset.
 */
export async function dispatchFanout(opts: {
  spec: string;
  modules: FanoutModule[];
  projectId: string;
  stackId: string;
}): Promise<FanoutResult> {
  const { spec, modules, projectId, stackId } = opts;

  const agent =
    (store.lastAgentId
      ? store.availableAgents.find((a) => a.id === store.lastAgentId)
      : undefined) ?? store.availableAgents[0];
  if (!agent) throw new Error('No coding agent available');

  const projectPath = getProjectPath(projectId);
  if (!projectPath) throw new Error('Project not found');

  // Resolve the base branch the worktrees fork from.
  const proj = getProject(projectId);
  let baseBranch = proj?.defaultBaseBranch;
  if (!baseBranch) {
    baseBranch = await invoke<string>(IPC.GetMainBranch, { projectRoot: projectPath });
  }
  const branchPrefix = getProjectBranchPrefix(projectId);
  const designSection = designRefsSection(projectId);

  const result: FanoutResult = { created: [], failed: [] };

  // Create sequentially: each worktree creation touches git; parallel creation
  // can race on the index. The agents themselves then run concurrently.
  for (const module of modules) {
    try {
      const taskId = await createTask({
        name: module.name,
        nameIsAutoGenerated: false,
        agentDef: agent,
        projectId,
        gitIsolation: 'worktree',
        baseBranch,
        branchPrefixOverride: branchPrefix,
        initialPrompt: buildModulePrompt(spec, module, modules, stackId, designSection),
        stepsEnabled: store.defaultStepsEnabled,
      });
      result.created.push({ name: module.name, taskId });
    } catch (e) {
      log.error('[fanout] failed to create task for module', module.name, e);
      result.failed.push({ name: module.name, error: log.errMessage(e) });
    }
  }

  return result;
}
