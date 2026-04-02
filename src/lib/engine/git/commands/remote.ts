import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

const STUB_MESSAGE = 'Remote simulation is not yet available in Gitvana.';

export async function remoteCommand(args: string[], _engine: GitEngine): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output: 'No remotes configured (Gitvana runs locally)',
      success: true,
    };
  }

  const sub = args[0];
  if (sub === 'add' || sub === 'remove' || sub === 'set-url' || sub === '-v') {
    return { output: STUB_MESSAGE, success: false };
  }

  return { output: STUB_MESSAGE, success: false };
}

export async function pushCommand(_args: string[], _engine: GitEngine): Promise<CommandResult> {
  return { output: STUB_MESSAGE, success: false };
}

export async function pullCommand(_args: string[], _engine: GitEngine): Promise<CommandResult> {
  return { output: STUB_MESSAGE, success: false };
}

export async function fetchCommand(_args: string[], _engine: GitEngine): Promise<CommandResult> {
  return { output: STUB_MESSAGE, success: false };
}
