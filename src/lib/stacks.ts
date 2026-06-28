/**
 * Stack presets — the framework a blueprint should be built on. The selected
 * preset's guidance is appended to a blueprint's build brief at dispatch time
 * as an authoritative "Framework preset" section, so every blueprint adapts to
 * your studio's stack without rewriting each brief.
 *
 * Default is LangGraph. Switch the studio default in the Blueprints gallery
 * once you know the team's stack.
 */

export interface StackPreset {
  id: string;
  name: string;
  language: 'Python' | 'TypeScript';
  /** Short summary shown in the selector. */
  blurb: string;
  /** Authoritative guidance injected into the build brief. Empty = no preset. */
  guidance: string;
}

export const STACK_PRESETS: StackPreset[] = [
  {
    id: 'langgraph',
    name: 'LangGraph',
    language: 'Python',
    blurb: 'Graph-based agent orchestration (LangChain).',
    guidance: `Build on **LangGraph** (Python).
- Model the agent/workflow as an explicit \`StateGraph\` with a typed state (TypedDict or Pydantic) — nodes, conditional edges, and clear entry/finish points. Avoid ad-hoc control flow.
- Use a checkpointer (e.g. \`MemorySaver\`, or a SQLite/Postgres saver for durability) so runs are resumable and conversations are threaded by \`thread_id\`.
- Tools: define with the \`@tool\` decorator (or \`StructuredTool\`) and bind via \`ToolNode\`; validate args with Pydantic.
- Use interrupts / \`interrupt_before\` for human-in-the-loop approval gates on irreversible actions.
- Prefer LangChain chat-model interfaces so the provider is swappable; default to the latest Claude model via \`langchain-anthropic\`.
- Stream node/token updates from the graph for responsive UIs.
- Tests: assert graph transitions and tool-call sequences with mocked models/tools (no live API calls in unit tests).`,
  },
  {
    id: 'llamaindex',
    name: 'LlamaIndex',
    language: 'Python',
    blurb: 'RAG-first data framework + agents.',
    guidance: `Build on **LlamaIndex** (Python).
- Use \`VectorStoreIndex\` over a real vector store (pgvector/Chroma/Qdrant); configure node parsers and an embedding model explicitly.
- Compose retrieval with \`QueryEngine\`/\`Retriever\` + a reranker (e.g. \`SentenceTransformerRerank\`); return source nodes for citations.
- For agents, use LlamaIndex \`FunctionAgent\`/\`AgentWorkflow\` with typed tools.
- Keep ingestion idempotent and re-runnable; persist the index.
- Default the LLM + embeddings to swappable providers (latest Claude for generation).`,
  },
  {
    id: 'pydantic-ai',
    name: 'Pydantic AI',
    language: 'Python',
    blurb: 'Type-safe agents with structured outputs.',
    guidance: `Build on **Pydantic AI** (Python).
- Define an \`Agent\` with a typed \`result_type\` (Pydantic model) so outputs are always validated.
- Register tools with \`@agent.tool\`; use dependency injection (\`deps_type\`) for clients/config.
- Use \`RunContext\` for shared state; stream results where useful.
- Provider is swappable via the model string; default to the latest Claude.
- Lean on Pydantic validation + retries for self-correcting structured output.`,
  },
  {
    id: 'vercel-ai',
    name: 'Vercel AI SDK',
    language: 'TypeScript',
    blurb: 'TypeScript agents/streaming (Next.js-friendly).',
    guidance: `Build on the **Vercel AI SDK** (TypeScript) — this overrides the Python defaults below; use a TS/Node toolchain (pnpm, vitest, tsup/Next.js) instead.
- Use \`generateText\`/\`streamText\` with \`tools\` (Zod-validated parameters) and \`stopWhen\`/\`maxSteps\` for agentic loops.
- Use \`generateObject\`/\`streamObject\` with a Zod schema for structured output.
- Prefer provider-agnostic model strings via the AI Gateway; default to the latest Claude.
- Expose via a Next.js route handler or a small Node server; stream responses to the client.
- Tests with vitest; mock the model with the AI SDK test utilities.`,
  },
  {
    id: 'none',
    name: 'No preset',
    language: 'Python',
    blurb: 'Let the coding agent choose the best framework.',
    guidance: '',
  },
];

export const DEFAULT_STACK_ID = 'langgraph';

export function getStackPreset(id: string): StackPreset {
  return STACK_PRESETS.find((s) => s.id === id) ?? STACK_PRESETS[0];
}

/** Append the selected stack's guidance to a blueprint brief as an
 *  authoritative framework section. */
export function composeBrief(buildPrompt: string, stackId: string): string {
  const preset = getStackPreset(stackId);
  if (!preset.guidance) return buildPrompt;
  return `${buildPrompt}

## Framework preset — ${preset.name} (authoritative)
${preset.guidance}`;
}
