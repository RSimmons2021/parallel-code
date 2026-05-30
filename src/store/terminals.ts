import { produce } from 'solid-js/store';
import { invoke } from '../lib/ipc';
import { IPC } from '../../electron/ipc/channels';
import { store, setStore, cleanupPanelEntries } from './core';
import { clearAgentActivity } from './taskStatus';
import { triggerFocus, getTaskFocusedPanel } from './focus';
import type { Terminal } from './types';
import { warn as logWarn } from '../lib/log';
import { nextTerminalName, recordTerminalCreateAttempt } from './terminal-counter';

const REMOVE_ANIMATION_MS = 300;

export function createTerminal(): void {
  if (!recordTerminalCreateAttempt()) return;
  const id = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const name = nextTerminalName();

  const terminal: Terminal = { id, name, agentId };

  setStore('terminals', id, terminal);
  setStore('taskOrder', store.taskOrder.length, id);
  setStore('focusedPanel', id, 'terminal');
  setStore('activeTaskId', id);
  setStore('activeAgentId', null);
  setStore('sidebarFocused', false);

  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'instant' });
  });
}

export async function closeTerminal(terminalId: string): Promise<void> {
  const terminal = store.terminals[terminalId];
  if (!terminal || terminal.closingStatus === 'removing' || terminal.closingStatus === 'closing')
    return;

  // Set closing status synchronously to prevent concurrent close calls
  setStore('terminals', terminalId, 'closingStatus', 'closing');

  await invoke(IPC.KillAgent, { agentId: terminal.agentId }).catch((err) => {
    logWarn('terminals.close', 'KillAgent failed', { err });
  });
  clearAgentActivity(terminal.agentId);

  const idx = store.taskOrder.indexOf(terminalId);

  // Switch active panel to neighbor before animation
  if (store.activeTaskId === terminalId) {
    const order = store.taskOrder;
    const neighborIdx = idx > 0 ? idx - 1 : idx + 1;
    const neighbor = order[neighborIdx] ?? null;
    setStore('activeTaskId', neighbor);
    const neighborTask = neighbor ? store.tasks[neighbor] : null;
    setStore(
      'activeAgentId',
      neighborTask
        ? neighborTask.selectedAgentId &&
          neighborTask.agentIds.includes(neighborTask.selectedAgentId)
          ? neighborTask.selectedAgentId
          : (neighborTask.agentIds[0] ?? null)
        : null,
    );
  }

  // Phase 1: mark as removing so UI can animate
  setStore('terminals', terminalId, 'closingStatus', 'removing');

  // Phase 2: actually delete after animation completes
  setTimeout(() => {
    setStore(
      produce((s) => {
        delete s.terminals[terminalId];
        delete s.agents[terminal.agentId];
        cleanupPanelEntries(s, terminalId);

        if (s.activeTaskId === terminalId) {
          s.activeTaskId = s.taskOrder[0] ?? null;
          const firstTask = s.activeTaskId ? s.tasks[s.activeTaskId] : null;
          s.activeAgentId = firstTask?.agentIds[0] ?? null;
        }
      }),
    );

    const activeId = store.activeTaskId;
    if (activeId) {
      const panel = getTaskFocusedPanel(activeId);
      requestAnimationFrame(() => triggerFocus(`${activeId}:${panel}`));
    }
  }, REMOVE_ANIMATION_MS);
}

export function updateTerminalName(terminalId: string, name: string): void {
  setStore('terminals', terminalId, 'name', name);
}

/** Restore the auto-increment counter from persisted state. */
