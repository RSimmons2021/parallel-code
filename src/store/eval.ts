import { getProjectPath } from './projects';
import { type AskProvider } from '../lib/ask-once';
import { trackedAskOnce } from './telemetry';

/**
 * Eval Arena — a lightweight LLM eval harness. Runs a prompt/system under test
 * across a golden dataset, scoring each case with deterministic assertions and
 * an optional LLM-judge, then aggregates a pass rate. Uses the same one-shot
 * LLM plumbing as auto-split (AskAboutCode via askOnce).
 */

export interface EvalCase {
  id: string;
  input: string;
  /** Optional reference answer; passes if the output contains it (normalized). */
  expected: string;
  /** Optional substring assertion. */
  contains: string;
}

export function emptyCase(): EvalCase {
  return { id: crypto.randomUUID().slice(0, 8), input: '', expected: '', contains: '' };
}

export function defaultCases(): EvalCase[] {
  return [emptyCase(), emptyCase()];
}

export interface EvalCheck {
  name: string;
  pass: boolean;
}

export interface EvalCaseResult {
  caseId: string;
  input: string;
  output: string;
  checks: EvalCheck[];
  judgeScore?: number;
  judgeReason?: string;
  pass: boolean;
  error?: string;
}

export interface EvalRun {
  results: EvalCaseResult[];
  passRate: number;
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

export async function runEval(opts: {
  systemPrompt: string;
  cases: EvalCase[];
  useJudge: boolean;
  judgeRubric: string;
  projectId: string;
  provider: AskProvider;
  onProgress?: (done: number, total: number) => void;
}): Promise<EvalRun> {
  const cwd = getProjectPath(opts.projectId);
  if (!cwd) throw new Error('Project not found');

  const cases = opts.cases.filter((c) => c.input.trim().length > 0);
  if (cases.length === 0) throw new Error('Add at least one case with an input');

  const results: EvalCaseResult[] = [];
  let i = 0;
  for (const c of cases) {
    opts.onProgress?.(i, cases.length);
    try {
      const output = await trackedAskOnce(
        fillTemplate(opts.systemPrompt, c.input),
        cwd,
        opts.provider,
        { kind: 'eval', label: c.input, projectId: opts.projectId },
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
          cwd,
          opts.provider,
          opts.projectId,
        );
        judgeScore = j.score;
        judgeReason = j.reason;
        checks.push({ name: `judge ${Math.round(j.score * 100)}%`, pass: j.pass });
      }
      // A case with no checks defaults to a pass (it ran without error).
      const pass = checks.length === 0 ? true : checks.every((ch) => ch.pass);
      results.push({ caseId: c.id, input: c.input, output, checks, judgeScore, judgeReason, pass });
    } catch (e) {
      results.push({
        caseId: c.id,
        input: c.input,
        output: '',
        checks: [],
        pass: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    i++;
  }
  opts.onProgress?.(cases.length, cases.length);

  const passed = results.filter((r) => r.pass).length;
  return { results, passRate: results.length ? passed / results.length : 0 };
}
