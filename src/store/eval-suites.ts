import { store, setStore } from './core';
import { getProjectPath } from './projects';
import { type AskProvider } from '../lib/ask-once';
import {
  runCase,
  aggregateRun,
  emptyCase,
  type EvalCase,
  type EvalCaseResult,
  type RunCaseOpts,
} from './eval';

/**
 * Persisted eval suites — the studio's golden datasets as first-class, versioned
 * assets (the model the eval platforms converge on). Each project owns a suite
 * holding: the system/prompt under test with a version history, the golden
 * dataset, judge config, and a run history so you can compare prompt v1 vs v2
 * and catch regressions before shipping.
 */

export interface PromptVersion {
  version: number; // 1-based, monotonic
  prompt: string;
  ts: number;
  note?: string;
}

export interface EvalRunRecord {
  id: string;
  ts: number;
  promptVersion: number;
  trials: number;
  caseCount: number;
  passRate: number; // mean pass@k
  passHatRate: number; // mean pass^k
  results: EvalCaseResult[];
}

export interface EvalSuite {
  id: string;
  projectId: string;
  name: string;
  /** Current working prompt. Snapshotted into `promptVersions` on run/commit. */
  systemPrompt: string;
  promptVersions: PromptVersion[];
  cases: EvalCase[];
  useJudge: boolean;
  judgeRubric: string;
  trials: number;
  runs: EvalRunRecord[];
  createdAt: number;
  updatedAt: number;
}

const MAX_RUNS = 50;
const MAX_VERSIONS = 30;

const DEFAULT_PROMPT = 'You are a helpful assistant. Answer the user concisely.\n\n{{input}}';
const DEFAULT_RUBRIC =
  'Award a pass if the answer is correct, relevant, and free of hallucinations.';

function now(): number {
  return Date.now();
}

export function getSuite(projectId: string): EvalSuite | undefined {
  return store.evalSuites.find((s) => s.projectId === projectId);
}

/** Return the project's suite, creating an empty one if absent. */
export function getOrCreateSuite(projectId: string): EvalSuite {
  const existing = getSuite(projectId);
  if (existing) return existing;
  const project = store.projects.find((p) => p.id === projectId);
  const suite: EvalSuite = {
    id: crypto.randomUUID().slice(0, 8),
    projectId,
    name: project ? `${project.name} evals` : 'Evals',
    systemPrompt: DEFAULT_PROMPT,
    promptVersions: [{ version: 1, prompt: DEFAULT_PROMPT, ts: now(), note: 'initial' }],
    cases: [emptyCase(), emptyCase()],
    useJudge: false,
    judgeRubric: DEFAULT_RUBRIC,
    trials: 1,
    runs: [],
    createdAt: now(),
    updatedAt: now(),
  };
  setStore('evalSuites', (prev) => [...prev, suite]);
  return suite;
}

function patchSuite(id: string, patch: Partial<EvalSuite>): void {
  setStore('evalSuites', (s) => s.id === id, { ...patch, updatedAt: now() });
}

export function updateSuiteFields(
  id: string,
  patch: Partial<Pick<EvalSuite, 'systemPrompt' | 'useJudge' | 'judgeRubric' | 'trials' | 'cases'>>,
): void {
  patchSuite(id, patch);
}

/** The latest committed prompt version. */
export function latestVersion(suite: EvalSuite): PromptVersion {
  return suite.promptVersions[suite.promptVersions.length - 1];
}

/**
 * Snapshot the working prompt as a new immutable version if it differs from the
 * latest. Returns the version number the current prompt maps to.
 */
export function commitPromptVersion(id: string, note?: string): number {
  const suite = store.evalSuites.find((s) => s.id === id);
  if (!suite) return 1;
  const latest = latestVersion(suite);
  if (latest && latest.prompt === suite.systemPrompt) return latest.version;
  const version = (latest?.version ?? 0) + 1;
  const next = [
    ...suite.promptVersions,
    { version, prompt: suite.systemPrompt, ts: now(), note },
  ].slice(-MAX_VERSIONS);
  patchSuite(id, { promptVersions: next });
  return version;
}

/** Restore a prior prompt version into the working prompt. */
export function restorePromptVersion(id: string, version: number): void {
  const suite = store.evalSuites.find((s) => s.id === id);
  const v = suite?.promptVersions.find((p) => p.version === version);
  if (v) patchSuite(id, { systemPrompt: v.prompt });
}

export function deleteSuiteRun(id: string, runId: string): void {
  const suite = store.evalSuites.find((s) => s.id === id);
  if (!suite) return;
  patchSuite(id, { runs: suite.runs.filter((r) => r.id !== runId) });
}

/** Apply a human pass/fail override to a case in the most recent run. */
export function setHumanVerdict(
  id: string,
  runId: string,
  caseId: string,
  verdict: 'pass' | 'fail' | undefined,
): void {
  const suite = store.evalSuites.find((s) => s.id === id);
  if (!suite) return;
  const runs = suite.runs.map((r) => {
    if (r.id !== runId) return r;
    const results = r.results.map((res) =>
      res.caseId === caseId ? { ...res, humanVerdict: verdict } : res,
    );
    const agg = aggregateRun(results, r.trials);
    return { ...r, results, passRate: agg.passRate, passHatRate: agg.passHatRate };
  });
  patchSuite(id, { runs });
}

/** Run the suite against its working prompt and record the result. */
export async function runSuiteEval(
  id: string,
  provider: AskProvider,
  onProgress?: (done: number, total: number) => void,
): Promise<EvalRunRecord> {
  const suite = store.evalSuites.find((s) => s.id === id);
  if (!suite) throw new Error('Suite not found');
  const cwd = getProjectPath(suite.projectId);
  if (!cwd) throw new Error('Project not found');

  const cases = suite.cases.filter((c) => c.input.trim().length > 0);
  if (cases.length === 0) throw new Error('Add at least one case with an input');

  const promptVersion = commitPromptVersion(id);
  const trials = Math.max(1, suite.trials);
  const runOpts: RunCaseOpts = {
    systemPrompt: suite.systemPrompt,
    useJudge: suite.useJudge,
    judgeRubric: suite.judgeRubric,
    cwd,
    projectId: suite.projectId,
    provider,
    trials,
  };

  const results: EvalCaseResult[] = [];
  let i = 0;
  for (const c of cases) {
    onProgress?.(i, cases.length);
    results.push(await runCase(c, runOpts));
    i++;
  }
  onProgress?.(cases.length, cases.length);

  const agg = aggregateRun(results, trials);
  const record: EvalRunRecord = {
    id: crypto.randomUUID().slice(0, 8),
    ts: now(),
    promptVersion,
    trials,
    caseCount: cases.length,
    passRate: agg.passRate,
    passHatRate: agg.passHatRate,
    results,
  };
  const fresh = store.evalSuites.find((s) => s.id === id);
  patchSuite(id, { runs: [record, ...(fresh?.runs ?? [])].slice(0, MAX_RUNS) });
  return record;
}

/** The most recent run, if any. */
export function latestRun(suite: EvalSuite): EvalRunRecord | undefined {
  return suite.runs[0];
}

/* ----------------------------------------------------------------------------
   Embedding evals + telemetry into the client's product
   -------------------------------------------------------------------------- */

/** Export the golden dataset as portable JSON the embedded harness reads. */
export function exportDatasetJson(suite: EvalSuite): string {
  return JSON.stringify(
    {
      name: suite.name,
      version: latestVersion(suite).version,
      trials: suite.trials,
      judge: suite.useJudge ? { rubric: suite.judgeRubric } : undefined,
      cases: suite.cases
        .filter((c) => c.input.trim())
        .map((c) => ({
          input: c.input,
          expected: c.expected || undefined,
          contains: c.contains || undefined,
          regression: c.regression || undefined,
        })),
    },
    null,
    2,
  );
}

/**
 * A precise brief instructing the building agent to ship a self-contained eval
 * suite + a cost/latency telemetry wrapper INTO the client's repo — so the
 * delivered system carries its own quality gate and observability. Mirrors the
 * studio's own eval (golden dataset, assertions, optional LLM-judge, pass@k /
 * pass^k) and telemetry (per-call tokens/latency/cost to a JSONL log).
 */
export function buildEmbedEvalsBrief(suite: EvalSuite, stackId: string): string {
  const dataset = exportDatasetJson(suite);
  const node = stackId === 'vercel-ai';
  const lang = node ? 'TypeScript (Node)' : 'Python';
  const harness = node ? 'evals/run-evals.ts' : 'evals/run_evals.py';
  const telemetry = node ? 'src/telemetry.ts' : 'telemetry.py';
  const runner = node ? 'tsx evals/run-evals.ts' : 'python -m evals.run_evals';

  return `## Embed evaluation & telemetry in the product

Ship the quality + observability layer into THIS repo so the client's system can
be tracked and improved after handoff. Match the existing project stack
(${lang}); read the code first and integrate idiomatically — do not bolt on a
second framework.

### 1. Golden dataset
Write \`evals/dataset.json\` exactly as below (these are the studio's curated cases):

\`\`\`json
${dataset}
\`\`\`

### 2. Eval harness — \`${harness}\`
- Load \`evals/dataset.json\`. For each case, call the product's REAL agent/entry
  point with the case input (wire it to the actual handler, not a stub).
- Score each case: substring assertions for \`expected\` / \`contains\` (normalized,
  case-insensitive)${suite.useJudge ? ', plus an LLM-judge using the rubric in the dataset returning JSON {score,pass,reason}' : ''}.
- Support \`trials\` per case (default ${suite.trials}); report **pass@k** (≥1 trial
  passes) and **pass^k** (all trials pass), plus an aggregate pass rate.
- Exit non-zero if the pass rate drops below a configurable threshold (default
  0.8) so it can gate CI. Print a concise per-case + summary report.
- Add a CI workflow (\`.github/workflows/evals.yml\`) that runs \`${runner}\` on PRs.

### 3. Telemetry wrapper — \`${telemetry}\`
- Wrap the product's LLM/model calls so every call logs: timestamp, a label,
  estimated prompt/output tokens, latency ms, and estimated cost (a small,
  editable per-model rate table). Append one JSON object per line to
  \`telemetry/usage.jsonl\` (gitignored).
- Provide a tiny \`telemetry summary\` command/script that prints totals, avg +
  p95 latency, and cost grouped by label — the same readouts the studio shows.
- Keep it dependency-light and non-blocking; never let logging break a request.

### 4. Docs
- Add an \`evals/README.md\`: how to add cases, run the suite, read telemetry, and
  wire the threshold into CI. Reference it from the client handoff docs.

Keep everything self-contained and runnable with one command. Append a
\`.claude/steps.json\` entry summarizing what was embedded.`;
}
