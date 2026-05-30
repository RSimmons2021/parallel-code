import { store, setStore } from './core';
import { setActiveTask } from './active-task';
import { getTaskFocusedPanel, setTaskFocusedPanel } from './focus';
import { showNotification } from './notification';
import { pickAndAddProject } from './projects';
import { reorderTask } from './tasks';

export { setActiveAgent, setActiveTask } from './active-task';

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
