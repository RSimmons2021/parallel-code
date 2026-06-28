import { store } from './core';
import { sendPrompt } from './tasks';
import { effectiveAgentId } from './agent-select';
import { getSuite, buildEmbedEvalsBrief } from './eval-suites';

/**
 * Client handoff + deploy. Sends a tuned brief to an existing task's agent
 * (the one that built the code) instructing it to produce a client-ready
 * handoff package and set up deployment for the chosen target. Live deploy is
 * opt-in — by default it prepares config + instructions but does not push.
 */

export interface DeployTarget {
  id: string;
  name: string;
  /** Guidance injected into the handoff brief. */
  guidance: string;
}

export const DEPLOY_TARGETS: DeployTarget[] = [
  {
    id: 'docker',
    name: 'Docker image',
    guidance:
      'Produce a production multi-stage `Dockerfile` and a `docker-compose.yml`; document `docker build`/`docker run` and required env. Keep it cloud-agnostic so it can run anywhere.',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    guidance:
      'Configure for Vercel: a `vercel.json` (or framework auto-detect), serverless/Fluid function entrypoints, and env via `vercel env`. The deploy command is `vercel deploy --prod`.',
  },
  {
    id: 'gcp',
    name: 'GCP Cloud Run',
    guidance:
      'Containerize and target Google Cloud Run: a `Dockerfile`, a `service.yaml` or `gcloud run deploy` command, env/secret wiring, and minimal IaC (Terraform) if practical.',
  },
  {
    id: 'aws',
    name: 'AWS',
    guidance:
      'Containerize and target AWS App Runner (or ECS/Fargate for heavier needs): a `Dockerfile`, push-to-ECR steps, and IaC (CDK or Terraform). Document the `deploy` flow and env/secrets via SSM.',
  },
  {
    id: 'azure',
    name: 'Azure Container Apps',
    guidance:
      'Containerize and target Azure Container Apps: a `Dockerfile` and `az containerapp up` flow, env/secrets, and minimal IaC (Bicep/Terraform) if practical.',
  },
  {
    id: 'none',
    name: 'Docs only (no deploy)',
    guidance: 'Do not add deployment configuration; focus only on the handoff documentation.',
  },
];

export function getDeployTarget(id: string): DeployTarget {
  return DEPLOY_TARGETS.find((t) => t.id === id) ?? DEPLOY_TARGETS[0];
}

function buildHandoffPrompt(target: DeployTarget, liveDeploy: boolean): string {
  const deployBlock =
    target.id === 'none'
      ? ''
      : `

## Deployment — ${target.name}
${target.guidance}
${
  liveDeploy
    ? 'After preparing the config, RUN the deploy and report the resulting URL. If credentials are missing, stop and clearly list exactly what is needed instead of failing silently.'
    : 'Prepare the deployment config and a one-command deploy, but DO NOT deploy to production yet — document the exact command for the client to run. (Do not run irreversible/cloud-mutating commands.)'
}`;

  return `Package this project for client handoff. The build in this worktree should be made client-ready.

## 1. Make it run cleanly
- Ensure \`make install && make test && make run\` (or the documented equivalent) works end to end.
- Provide a \`.env.example\` with every required variable documented.

## 2. Produce a \`handoff/\` directory with:
- \`README_CLIENT.md\` — plain-language overview: what this does, who it's for, how to use it, and key capabilities/limits. Minimal jargon.
- \`ARCHITECTURE.md\` — a Mermaid diagram of the system + a short component walkthrough and the main data/control flow.
- \`DEPLOYMENT.md\` — step-by-step deploy + env/secrets + rough cost notes.
- \`DEMO.md\` — how to run a live demo, with sample inputs/requests and expected outputs.
- \`HANDOFF.md\` — executive summary: what was built, key decisions & tradeoffs, known limitations, test/eval results, and a prioritized "next steps" list.
- \`CHANGELOG.md\` — what shipped in this engagement.

## 3. Quality bar
- Docs must be accurate to the actual code (read it; don't invent endpoints or env vars).
- Keep it concise and skimmable; a non-engineer stakeholder should understand README_CLIENT.md and HANDOFF.md.${deployBlock}

When done, append a final \`.claude/steps.json\` entry summarizing the handoff package and (if applicable) the deploy outcome or the exact command the client must run.`;
}

export interface ProjectTask {
  id: string;
  name: string;
  agentId: string;
}

/** Tasks in the project that have an agent we can send a handoff brief to. */
export function handoffTargetsForProject(projectId: string): ProjectTask[] {
  const ids = [...store.taskOrder, ...store.collapsedTaskOrder];
  const out: ProjectTask[] = [];
  for (const id of ids) {
    const task = store.tasks[id];
    if (!task || task.projectId !== projectId) continue;
    const agentId = effectiveAgentId(task);
    if (!agentId) continue;
    out.push({ id: task.id, name: task.name, agentId });
  }
  return out;
}

export async function runHandoff(opts: {
  taskId: string;
  deployTargetId: string;
  liveDeploy: boolean;
  embedEvals?: boolean;
}): Promise<void> {
  const task = store.tasks[opts.taskId];
  if (!task) throw new Error('Task not found');
  const agentId = effectiveAgentId(task);
  if (!agentId) throw new Error('This task has no agent to send the handoff to');
  let prompt = buildHandoffPrompt(getDeployTarget(opts.deployTargetId), opts.liveDeploy);
  // Optionally embed the studio's eval suite + telemetry into the client product
  // so the delivered system carries its own quality gate and observability.
  if (opts.embedEvals) {
    const suite = getSuite(task.projectId);
    if (suite && suite.cases.some((c) => c.input.trim())) {
      prompt += `\n\n---\n\n${buildEmbedEvalsBrief(suite, store.defaultStackId)}`;
    }
  }
  await sendPrompt(task.id, agentId, prompt);
}
