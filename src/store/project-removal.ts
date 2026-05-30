import { store } from './core';
import { closeTask } from './tasks';
import { removeProject } from './projects';

export async function removeProjectWithTasks(projectId: string): Promise<void> {
  // Collect task IDs belonging to this project BEFORE removing anything
  const taskIds = store.taskOrder.filter((tid) => store.tasks[tid]?.projectId === projectId);
  const collapsedTaskIds = store.collapsedTaskOrder.filter(
    (tid) => store.tasks[tid]?.projectId === projectId,
  );

  // Close tasks sequentially to avoid concurrent git operations on the same repo.
  // Must happen before removeProject() since closeTask needs the project path.
  // Coordinators must come last so their children are already closed first.
  const allIds = [...taskIds, ...collapsedTaskIds];
  const isCoordinator = (tid: string) => store.tasks[tid]?.coordinatorMode === true;
  const ordered = [...allIds.filter((tid) => !isCoordinator(tid)), ...allIds.filter(isCoordinator)];
  for (const tid of ordered) {
    // closeTask handles and stores its own errors, so this should not throw.
    await closeTask(tid);
  }

  // If any tasks failed to close, keep the project so users can retry.
  const hasRemainingTasks = allIds.some((tid) => store.tasks[tid]?.projectId === projectId);
  if (hasRemainingTasks) return;

  // Now remove the project itself
  removeProject(projectId);
}
