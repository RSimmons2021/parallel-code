import { store, setStore } from './core';
import { designRefsSection } from './design';
import { getTaskFocusedPanel, setTaskFocusedPanel } from './focused-panel';
import { showNotification } from './notification';
import { pickAndAddProject } from './projects';
import { reorderTask } from './tasks';

const AI_TERMINAL_PREFIX = 'ai-terminal:';

function focusedAgentIdForTask(taskId: string, agentIds: string[]): string | null {
  const panel = store.focusedPanel[taskId];
  if (!panel?.startsWith(AI_TERMINAL_PREFIX)) return null;
  const agentId = panel.slice(AI_TERMINAL_PREFIX.length);
  return agentIds.includes(agentId) ? agentId : null;
}

function selectedAgentIdForTask(task: {
  agentIds: string[];
  selectedAgentId?: string;
}): string | null {
  return task.selectedAgentId && task.agentIds.includes(task.selectedAgentId)
    ? task.selectedAgentId
    : null;
}

export function setActiveTask(id: string): void {
  const task = store.tasks[id];
  const terminal = store.terminals[id];
  if (!task && !terminal) return;
  let activeAgentId: string | null = null;
  if (task) {
    activeAgentId =
      focusedAgentIdForTask(id, task.agentIds) ??
      selectedAgentIdForTask(task) ??
      (store.activeAgentId && task.agentIds.includes(store.activeAgentId)
        ? store.activeAgentId
        : (task.agentIds[0] ?? null));
    if (activeAgentId) setStore('tasks', id, 'selectedAgentId', activeAgentId);
  }
  setStore('activeTaskId', id);
  setStore('activeAgentId', activeAgentId);
}

export function setActiveAgent(agentId: string): void {
  setStore('activeAgentId', agentId);
  const taskId = store.activeTaskId;
  const task = taskId ? store.tasks[taskId] : undefined;
  if (task?.agentIds.includes(agentId)) {
    setStore('tasks', taskId as string, 'selectedAgentId', agentId);
  }
}

export function moveActiveTask(direction: 'left' | 'right'): void {
  const { taskOrder, activeTaskId } = store;
  if (!activeTaskId || taskOrder.length < 2) return;
  const idx = taskOrder.indexOf(activeTaskId);
  if (idx === -1) return;
  const target = direction === 'left' ? idx - 1 : idx + 1;
  if (target < 0 || target >= taskOrder.length) return;
  reorderTask(idx, target);
  // Re-focus the moved task and scroll it into view (DOM node move loses focus)
  setTaskFocusedPanel(activeTaskId, getTaskFocusedPanel(activeTaskId));
}

export function jumpToTask(index: number): void {
  // Index against taskOrder so Cmd+N matches the left-to-right tile order
  // shown in the main area (and the order Cmd+Left/Right cycles through).
  const id = store.taskOrder[index];
  if (!id) return;
  setActiveTask(id);
  if (store.sidebarFocused) {
    setStore('sidebarFocusedTaskId', id);
    setStore('sidebarFocusedProjectId', null);
  }
}

export function toggleNewTaskDialog(show?: boolean): void {
  const shouldShow = show ?? !store.showNewTaskDialog;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  if (!shouldShow) {
    setStore('newTaskDropUrl', null);
    setStore('newTaskPrefillPrompt', null);
  }
  setStore('showNewTaskDialog', shouldShow);
}

export function toggleBlueprintGallery(show?: boolean): void {
  const shouldShow = show ?? !store.showBlueprintGallery;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  setStore('showBlueprintGallery', shouldShow);
}

export function toggleFanout(show?: boolean): void {
  const shouldShow = show ?? !store.showFanout;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  setStore('showFanout', shouldShow);
}

export function toggleHandoff(show?: boolean): void {
  const shouldShow = show ?? !store.showHandoff;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  setStore('showHandoff', shouldShow);
}

export function toggleEvalArena(show?: boolean): void {
  const shouldShow = show ?? !store.showEvalArena;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  setStore('showEvalArena', shouldShow);
}

export function toggleTelemetry(show?: boolean): void {
  setStore('showTelemetry', show ?? !store.showTelemetry);
}

export function toggleRegistry(show?: boolean): void {
  setStore('showRegistry', show ?? !store.showRegistry);
}

export function toggleDiscovery(show?: boolean): void {
  const shouldShow = show ?? !store.showDiscovery;
  if (shouldShow && store.projects.length === 0) {
    showNotification('Add a project first');
    pickAndAddProject();
    return;
  }
  setStore('showDiscovery', shouldShow);
}

/** Queue a synthesized brief into the Fan-out dialog and open it. */
export function sendSpecToFanout(spec: string): void {
  setStore('fanoutPrefillSpec', spec);
  setStore('showDiscovery', false);
  setStore('showFanout', true);
}

/**
 * Launch a Studio Blueprint: seed the New Task dialog with the blueprint's
 * build brief (and name), then open it so the user can pick the project /
 * agent / isolation and dispatch.
 */
export function launchBlueprint(prompt: string, name: string): void {
  setStore('showBlueprintGallery', false);
  const projectId = store.lastProjectId ?? store.projects[0]?.id ?? null;
  const design = projectId ? designRefsSection(projectId) : '';
  setStore('newTaskPrefillPrompt', {
    prompt: prompt + design,
    name,
    projectId,
  });
  setStore('showNewTaskDialog', true);
}
