import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function configCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const listFlag = args.includes('--list') || args.includes('-l');

  if (listFlag) {
    const entries: string[] = [];
    for (const [key, value] of engine.configStore) {
      entries.push(`${key}=${value}`);
    }
    if (entries.length === 0) {
      return { output: '', success: true };
    }
    return { output: entries.join('\n'), success: true };
  }

  // Filter out flags
  const positional = args.filter(a => !a.startsWith('-'));

  if (positional.length === 0) {
    return {
      output: 'usage: git config [--list] <key> [<value>]',
      success: false,
    };
  }

  const key = positional[0];
  const value = positional[1];

  if (value !== undefined) {
    // Set config
    engine.configStore.set(key, value);
    return { output: '', success: true };
  }

  // Get config
  const stored = engine.configStore.get(key);
  if (stored !== undefined) {
    return { output: stored, success: true };
  }

  return {
    output: '',
    success: true,
  };
}
