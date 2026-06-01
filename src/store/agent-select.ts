/**
 * The agent that should be active for a task: keep the current selection when
 * it still exists, otherwise fall back to the first agent (or null when the
 * task has none). Centralizes the rule duplicated across task close, collapse,
 * terminal close, and persistence restore.
 *
 * Kept import-free so any store module can use it without forming a cycle.
 */
export function effectiveAgentId(task: {
  agentIds: string[];
  selectedAgentId?: string;
}): string | null {
  return task.selectedAgentId && task.agentIds.includes(task.selectedAgentId)
    ? task.selectedAgentId
    : (task.agentIds[0] ?? null);
}
