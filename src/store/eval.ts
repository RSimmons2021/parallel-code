import { type AskProvider } from '../lib/ask-once';
import { trackedAskOnce } from './telemetry';

/**
 * Eval harness primitives. Runs a prompt/system under test across a golden
 * dataset, scoring each case with deterministic assertions and an optional
 * LLM-judge. Supports multiple trials per case to measure non-determinism via
 * pass@k (≥1 success) and pass^k (all k succeed) — the metrics Anthropic and the
 * eval platforms standardize on. Uses the metered one-shot LLM plumbing
 * (`trackedAskOnce`). The persisted suite layer lives in `eval-suites.ts`.
 */

export interface EvalCase {
  id: string;
  input: string;
  /** Optional reference answer; passes if the output contains it (normalized). */
  expected: string;
  /** Optional substring assertion. */
  contains: string;
  /** Graduated into the regression suite — a case that must keep passing. */
  regression?: boolean;
}

export function emptyCase(): EvalCase {
  return { id: crypto.randomUUID().slice(0, 8), input: '', expected: '', contains: '' };
}

export interface EvalCheck {
  name: string;
  pass: boolean;
}

export interface EvalCaseResult {
  caseId: string;
  input: string;
  /** Last trial's output (shown in the UI). */
  output: string;
  /** Last trial's checks. */
  checks: EvalCheck[];
  judgeScore?: number;
  judgeReason?: string;
  /** pass@k — at least one trial passed. The headline per-case verdict. */
  pass: boolean;
  /** pass^k — every trial passed (consistency). */
  passHat: boolean;
  trials: number;
  trialPasses: number;
  /** Optional human override applied after the run. */
  humanVerdict?: 'pass' | 'fail';
  error?: string;
}

export interface EvalRun {
  results: EvalCaseResult[];
  /** Mean pass@k across cases. */
  passRate: number;
  /** Mean pass^k across cases. */
  passHatRate: number;
  trials: number;
}

export interface RunCaseOpts {
  systemPrompt: string;
  useJudge: boolean;
  judgeRubric: string;
  cwd: string;
  projectId: string;
  provider: AskProvider;
  trials: number;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function fillTemplate(tpl: string, input: string): string {
  return tpl.includes('{{input}}') ? tpl.replaceAll('{{input}}', input) : `${tpl}\n\n${input}`;
}

async function judge(
  rubric: string,
  input: string,
  expected: string,
  output: string,
  cwd: string,
  provider: AskProvider,
  projectId: string,
): Promise<{ score: number; pass: boolean; reason: string }> {
  const prompt = `You are a strict evaluator. Score the assistant OUTPUT against the RUBRIC${
    expected ? ' and the EXPECTED reference' : ''
  }. Return ONLY JSON: {"score": number 0..1, "pass": boolean, "reason": "<= 140 chars"}. No prose, no code fences.

RUBRIC:
${rubric}

INPUT:
${input}
${expected ? `\nEXPECTED / REFERENCE:\n${expected}\n` : ''}
OUTPUT:
${output}`;
  const raw = await trackedAskOnce(
    prompt,
    cwd,
    provider,
    { kind: 'judge', label: input, projectId },
    90_000,
  );
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try {
      const o = JSON.parse(raw.slice(s, e + 1));
      return {
        score: Math.max(0, Math.min(1, Number(o.score) || 0)),
        pass: !!o.pass,
        reason: String(o.reason ?? ''),
      };
    } catch {
      /* fall through */
    }
  }
  return { score: 0, pass: false, reason: 'judge response could not be parsed' };
}

/** Run a single trial of one case: produce output and score the assertions. */
async function runTrial(
  c: EvalCase,
  opts: RunCaseOpts,
): Promise<{ output: string; checks: EvalCheck[]; judgeScore?: number; judgeReason?: string }> {
  const output = await trackedAskOnce(
    fillTemplate(opts.systemPrompt, c.input),
    opts.cwd,
    opts.provider,
    {
      kind: 'eval',
      label: c.input,
      projectId: opts.projectId,
    },
  );
  const checks: EvalCheck[] = [];
  if (c.expected.trim()) {
    checks.push({ name: 'matches expected', pass: norm(output).includes(norm(c.expected)) });
  }
  if (c.contains.trim()) {
    checks.push({
      name: `contains "${c.contains.trim()}"`,
      pass: norm(output).includes(norm(c.contains)),
    });
  }
  let judgeScore: number | undefined;
  let judgeReason: string | undefined;
  if (opts.useJudge && opts.judgeRubric.trim()) {
    const j = await judge(
      opts.judgeRubric,
      c.input,
      c.expected,
      output,
      opts.cwd,
      opts.provider,
      opts.projectId,
    );
    judgeScore = j.score;
    judgeReason = j.reason;
    checks.push({ name: `judge ${Math.round(j.score * 100)}%`, pass: j.pass });
  }
  return { output, checks, judgeScore, judgeReason };
}

/** Run all k trials for one case and fold them into a single result. */
export async function runCase(c: EvalCase, opts: RunCaseOpts): Promise<EvalCaseResult> {
  const k = Math.max(1, opts.trials);
  let trialPasses = 0;
  let last: Awaited<ReturnType<typeof runTrial>> | undefined;
  try {
    for (let t = 0; t < k; t++) {
      last = await runTrial(c, opts);
      // A trial with no checks defaults to a pass (it ran without error).
      const trialPass = last.checks.length === 0 ? true : last.checks.every((ch) => ch.pass);
      if (trialPass) trialPasses++;
    }
    return {
      caseId: c.id,
      input: c.input,
      output: last?.output ?? '',
      checks: last?.checks ?? [],
      judgeScore: last?.judgeScore,
      judgeReason: last?.judgeReason,
      pass: trialPasses >= 1,
      passHat: trialPasses === k,
      trials: k,
      trialPasses,
    };
  } catch (e) {
    return {
      caseId: c.id,
      input: c.input,
      output: '',
      checks: [],
      pass: false,
      passHat: false,
      trials: k,
      trialPasses,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Aggregate per-case results into a run, honoring any human overrides. */
export function aggregateRun(results: EvalCaseResult[], trials: number): EvalRun {
  const verdict = (r: EvalCaseResult) => (r.humanVerdict ? r.humanVerdict === 'pass' : r.pass);
  const passed = results.filter(verdict).length;
  const passedHat = results.filter((r) =>
    r.humanVerdict ? r.humanVerdict === 'pass' : r.passHat,
  ).length;
  const n = results.length || 1;
  return { results, passRate: passed / n, passHatRate: passedHat / n, trials };
}
