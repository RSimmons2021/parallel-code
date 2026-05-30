import { produce } from 'solid-js/store';
import { store, setStore } from './core';
import { markAgentSpawned, rescheduleTaskStatusPolling } from './taskStatus';
import type { Agent } from './types';

const RESTORED_AGENT_SPAWN_STAGGER_MS = 1_000;

export function uncollapseTask(taskId: string): void {
  const task = store.tasks[taskId];
  if (!task || !task.collapsed) return;

  const savedDefs =
    task.savedAgentDefs && task.savedAgentDefs.length > 0
      ? task.savedAgentDefs
      : task.savedAgentDef
        ? [task.savedAgentDef]
        : [];
  const restoredAgents = savedDefs.map((def) => ({ id: crypto.randomUUID(), def }));
  const selectedAgentIndex = task.savedSelectedAgentIndex ?? 0;
  const promptedAgentIndexes = task.savedPromptedAgentIndexes ?? [];

  setStore(
    produce((s) => {
      const t = s.tasks[taskId];
      t.collapsed = false;
      s.collapsedTaskOrder = s.collapsedTaskOrder.filter((id) => id !== taskId);
      s.taskOrder.push(taskId);
      s.activeTaskId = taskId;

      for (let i = 0; i < restoredAgents.length; i++) {
        const { id: agentId, def } = restoredAgents[i];
        const agent: Agent = {
          id: agentId,
          taskId,
          def,
          resumed: true,
          status: 'running',
          exitCode: null,
          signal: null,
          lastOutput: [],
          generation: 0,
          spawnDelayMs:
            restoredAgents.length > 1 && i > 0 ? i * RESTORED_AGENT_SPAWN_STAGGER_MS : undefined,
        };
        s.agents[agentId] = agent;
      }

      t.agentIds = restoredAgents.map((agent) => agent.id);
      const promptedAgentIds = promptedAgentIndexes
        .map((index) => t.agentIds[index])
        .filter((id): id is string => Boolean(id));
      t.promptedAgentIds = promptedAgentIds.length > 0 ? promptedAgentIds : undefined;
      t.selectedAgentId = t.agentIds[selectedAgentIndex] ?? t.agentIds[0];
      t.savedAgentDef = undefined;
      t.savedAgentDefs = undefined;
      t.savedSelectedAgentIndex = undefined;
      t.savedPromptedAgentIndexes = undefined;
      s.activeAgentId = t.selectedAgentId ?? null;
    }),
  );

  if (restoredAgents.length > 0) {
    for (const { id } of restoredAgents) markAgentSpawned(id);
    rescheduleTaskStatusPolling();
  }
}
