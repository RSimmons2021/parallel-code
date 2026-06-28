/**
 * Studio Blueprints — reusable starting points for building production AI
 * agents for client engagements. Each blueprint seeds a new task's build brief
 * (the prompt handed to the coding agent) with an opinionated, production-grade
 * spec: objective, recommended stack, architecture, deliverables, and the
 * acceptance criteria the agent must satisfy before declaring done.
 *
 * The point: turn "build an agent for this business" into a repeatable,
 * high-quality fan-out instead of a blank prompt every time.
 */

export interface Blueprint {
  id: string;
  /** Seeds the task name. */
  name: string;
  category: 'Conversational' | 'Extraction' | 'Automation' | 'Data' | 'Quality' | 'RAG';
  /** One-line pitch shown on the card. */
  tagline: string;
  /** Emoji glyph for the card. */
  glyph: string;
  /** Stack chips shown on the card; also referenced inside the brief. */
  stack: string[];
  /** The full build brief sent to the coding agent. */
  buildPrompt: string;
  /** True for user-created blueprints (editable/deletable in the gallery). */
  isCustom?: boolean;
}

/** A blank custom blueprint, ready to edit. */
export function emptyBlueprint(): Blueprint {
  return {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    category: 'Conversational',
    tagline: '',
    glyph: '✨',
    stack: [],
    buildPrompt: '',
    isCustom: true,
  };
}

export const BLUEPRINT_CATEGORIES: Blueprint['category'][] = [
  'Conversational',
  'RAG',
  'Extraction',
  'Automation',
  'Data',
  'Quality',
];

const COMMON_TAIL = `

## Engineering standards (apply to all of the above)
- Language: Python 3.12+. Use \`uv\` (or \`pip\` + \`pyproject.toml\`) for deps, \`ruff\` for lint/format, \`pytest\` for tests, \`pydantic\` v2 for all data models.
- Config via environment variables and a typed \`Settings\` model; never hardcode secrets. Provide a \`.env.example\`.
- Structured logging (JSON) with request/trace ids. Record per-call token usage, latency, and model name for every LLM call.
- Wrap every external/LLM call with timeouts, retries (exponential backoff), and graceful degradation.
- Provider-agnostic LLM layer: a thin client interface so the model (Anthropic / OpenAI / Gemini / Bedrock / Vertex) is swappable via config. Default to the latest Claude model.
- Deliverables: working code, a \`README.md\` (setup, run, deploy, env vars), a \`Makefile\` (or task runner) with \`install/test/run/eval\`, unit tests for core logic, and a small \`eval/\` harness with a golden dataset and a pass/fail score.
- Containerize with a \`Dockerfile\`; expose the service via FastAPI with \`/health\` and OpenAPI docs.
- Maintain \`.claude/steps.json\` so progress is reviewable at a glance.

## Definition of done
A reviewer can clone the repo, run \`make install && make test && make run\`, hit the documented endpoint, run \`make eval\` to see a quality score, and read the README to deploy it. Do not declare done until all of that works end to end.`;

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'support-rag',
    name: 'Customer Support RAG Agent',
    category: 'RAG',
    tagline: 'Answers from a company knowledge base with citations and escalation.',
    glyph: '🎧',
    stack: ['FastAPI', 'LlamaIndex', 'pgvector', 'Claude'],
    buildPrompt: `Build a production-ready **Customer Support RAG Agent** for an enterprise client.

## Objective
Answer end-user support questions grounded in the client's knowledge base (docs, FAQs, policies), with inline citations, confidence, and a clean escalation path to a human when the answer isn't supported.

## Architecture
- Ingestion pipeline: load documents (markdown/PDF/HTML), chunk with overlap, embed, and store in a vector DB (pgvector or Chroma). Make the source folder configurable and re-runnable (idempotent upserts).
- Retrieval: hybrid (vector + keyword/BM25) with a reranking step; return top-k passages with source metadata.
- Generation: answer strictly from retrieved context; cite sources; refuse + escalate when retrieval confidence is low ("I don't have that in the knowledge base").
- API: \`POST /chat\` (question, optional conversation history) -> answer, citations, confidence, escalated:bool.
- Guardrails: no hallucinated sources; PII redaction in logs; max-context budgeting.

## Acceptance criteria
- Returns grounded answers with at least one valid citation for in-scope questions.
- Correctly escalates (no fabricated answer) for out-of-scope questions.
- \`eval/\` measures retrieval recall@k and answer faithfulness on a golden Q/A set.${COMMON_TAIL}`,
  },
  {
    id: 'doc-extraction',
    name: 'Document Extraction Agent',
    category: 'Extraction',
    tagline: 'Turns messy documents into validated structured JSON.',
    glyph: '📄',
    stack: ['FastAPI', 'Pydantic', 'Instructor', 'Claude'],
    buildPrompt: `Build a production-ready **Document Extraction Agent** for an enterprise client.

## Objective
Extract structured, validated data from unstructured documents (invoices, contracts, forms, emails) into a strict schema, with per-field confidence and human-review flags for low-confidence fields.

## Architecture
- Input: accept PDF/image/text. OCR fallback for scans (configurable provider).
- Schema-first: define target output as Pydantic models; use constrained/structured LLM output (e.g. Instructor or tool-calling with JSON schema) so output always validates.
- Extraction: prompt the LLM with the document + schema; validate; on validation failure, auto-repair with a second pass.
- Confidence: emit per-field confidence; flag fields below threshold for human review.
- API: \`POST /extract\` (document) -> {data, field_confidence, needs_review[]}.

## Acceptance criteria
- 100% of returned payloads validate against the Pydantic schema.
- Low-confidence fields are flagged rather than guessed.
- \`eval/\` scores field-level accuracy against a labeled golden set.${COMMON_TAIL}`,
  },
  {
    id: 'workflow-automation',
    name: 'Workflow Automation Agent',
    category: 'Automation',
    tagline: 'Tool-calling agent that executes multi-step business workflows.',
    glyph: '⚙️',
    stack: ['LangGraph', 'FastAPI', 'Tool calling', 'Claude'],
    buildPrompt: `Build a production-ready **Workflow Automation Agent** for an enterprise client.

## Objective
An agent that completes multi-step business tasks by calling tools/APIs (e.g. create a ticket, look up a record, send an email, update a CRM), with planning, error recovery, and a full audit trail.

## Architecture
- Orchestration: model the workflow as a state graph (LangGraph) with explicit nodes, retries, and a human-approval gate for irreversible actions.
- Tools: define a small set of typed tools with input validation and idempotency keys. Mock external services behind interfaces so the system is testable offline.
- Safety: every side-effecting action is logged with inputs/outputs; destructive actions require an approval step (\`requires_approval\`).
- API: \`POST /run\` (goal, context) -> streamed steps + final result; \`POST /approve\` for gated actions.

## Acceptance criteria
- Completes a representative multi-step workflow end to end against mocked tools.
- Recovers from a tool failure (retry/replan) without crashing.
- Approval gate blocks irreversible actions until approved.
- \`eval/\` runs scripted scenarios and asserts the expected tool-call sequence.${COMMON_TAIL}`,
  },
  {
    id: 'ops-copilot',
    name: 'Internal Ops Copilot',
    category: 'Conversational',
    tagline: 'Chat copilot over internal tools and data, in Slack.',
    glyph: '🤖',
    stack: ['Slack Bolt', 'FastAPI', 'MCP', 'Claude'],
    buildPrompt: `Build a production-ready **Internal Ops Copilot** for an enterprise client.

## Objective
A chat copilot (Slack-first) that answers questions and performs actions across the company's internal tools — querying data, summarizing dashboards, kicking off routine ops — with per-user permissions.

## Architecture
- Surface: Slack app (Bolt) with slash command + app mention + threads; designed so a web widget can reuse the same core.
- Core: an agent with tools exposed via MCP-style typed interfaces (read DB, query metrics, run a report). Keep the core transport-agnostic.
- Auth: per-user scopes; a tool is only callable if the user is permitted.
- Memory: short-term conversation memory per thread; optional long-term user preferences.
- API: a thin \`/chat\` core plus the Slack adapter.

## Acceptance criteria
- Responds in Slack threads with streaming and renders tool results readably.
- Enforces per-user tool permissions (unauthorized -> friendly refusal).
- \`eval/\` covers intent routing and permission enforcement.${COMMON_TAIL}`,
  },
  {
    id: 'data-pipeline',
    name: 'LLM Data Pipeline',
    category: 'Data',
    tagline: 'Batch enrichment/classification pipeline over large datasets.',
    glyph: '🧮',
    stack: ['Prefect', 'DuckDB', 'Pydantic', 'Claude'],
    buildPrompt: `Build a production-ready **LLM Data Pipeline** for an enterprise client.

## Objective
A batch pipeline that enriches/classifies/summarizes a large dataset with an LLM — cost-controlled, resumable, and observable — producing clean structured output ready for the warehouse.

## Architecture
- Orchestration: a DAG (Prefect or a simple async worker pool) with checkpointing so reruns skip completed rows.
- Throughput: concurrency control, batching, and rate-limit handling; configurable max spend with a hard stop.
- Quality: schema-validated outputs (Pydantic); a sampled QA pass that scores a random subset.
- I/O: read from CSV/Parquet/DuckDB; write partitioned output + a run manifest (rows processed, cost, tokens, errors).

## Acceptance criteria
- Processes a sample dataset, is resumable after interruption, and never exceeds the configured budget.
- Emits a run manifest with cost/token/latency/error stats.
- \`eval/\` scores output quality on a labeled sample.${COMMON_TAIL}`,
  },
  {
    id: 'eval-guardrails',
    name: 'Agent Eval & Guardrails Harness',
    category: 'Quality',
    tagline: 'Regression-test and guard any LLM feature before it ships.',
    glyph: '🛡️',
    stack: ['pytest', 'promptfoo-style', 'LLM judge', 'Claude'],
    buildPrompt: `Build a production-ready **Agent Eval & Guardrails Harness** for an enterprise client.

## Objective
A reusable harness that evaluates an LLM feature against a golden dataset on every change — combining deterministic assertions, an LLM-as-judge, and safety guardrails — so quality is measurable and regressions are caught in CI.

## Architecture
- Dataset: versioned golden cases (input, expected/rubric, tags) in a simple file format.
- Scorers: pluggable — exact/regex/JSON-schema assertions, semantic similarity, and an LLM-judge with a rubric. Aggregate to a pass rate + per-tag breakdown.
- Guardrails: input/output filters (PII, toxicity, jailbreak attempts, schema violations) the target system can import directly.
- Reporting: human-readable HTML/Markdown report + machine-readable JSON; non-zero exit on regression for CI.
- CLI: \`eval run\`, \`eval report\`, \`eval add-case\`.

## Acceptance criteria
- Runs the golden set, prints a scored leaderboard, and fails CI when the score drops below a threshold.
- Guardrail filters block a set of known-bad inputs/outputs in tests.
- Designed to be dropped into any of the other blueprints' \`eval/\` folder.${COMMON_TAIL}`,
  },
];

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}
