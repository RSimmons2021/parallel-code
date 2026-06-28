import { invoke, Channel } from './ipc';
import { IPC } from '../../electron/ipc/channels';

export type AskProvider = 'claude' | 'minimax';

/**
 * Run a single, non-interactive LLM query and return the full text response.
 * Wraps the streaming AskAboutCode IPC (collect chunks until `done`). Bounded
 * by a timeout so a stuck provider can't hang the caller.
 */
export async function askOnce(
  prompt: string,
  cwd: string,
  provider: AskProvider,
  timeoutMs = 120_000,
): Promise<string> {
  const channel = new Channel<{ type: 'chunk' | 'error' | 'done'; text?: string }>();
  let out = '';
  let errOut = '';
  const finished = new Promise<void>((resolve) => {
    channel.onmessage = (msg) => {
      if (msg.type === 'chunk') out += msg.text ?? '';
      else if (msg.type === 'error') errOut += msg.text ?? '';
      else if (msg.type === 'done') resolve();
    };
  });

  const requestId = crypto.randomUUID();
  await invoke(IPC.AskAboutCode, { requestId, prompt, cwd, onOutput: channel, provider });

  await Promise.race([finished, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
  channel.cleanup?.();

  if (!out.trim() && errOut.trim()) throw new Error(errOut.trim());
  return out;
}
