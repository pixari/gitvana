import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function resetCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const mode = args.includes('--soft') ? 'soft'
    : args.includes('--hard') ? 'hard'
    : args.includes('--mixed') ? 'mixed'
    : null;

  const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));

  // git reset --soft/mixed/hard HEAD~N or ref
  if (mode && nonFlagArgs.length > 0) {
    return resetToRef(mode, nonFlagArgs[0], engine);
  }

  // git reset --soft/mixed/hard (defaults to HEAD, which is a no-op for soft)
  if (mode) {
    return resetToRef(mode, 'HEAD', engine);
  }

  // git reset HEAD <file> — unstage a file
  if (nonFlagArgs.length >= 2 && nonFlagArgs[0] === 'HEAD') {
    return unstageFile(nonFlagArgs[1], engine);
  }

  // git reset HEAD~N (no mode flag) — default to mixed reset
  if (nonFlagArgs.length === 1 && /^HEAD~\d+$/.test(nonFlagArgs[0])) {
    return resetToRef('mixed', nonFlagArgs[0], engine);
  }

  // git reset <file> — unstage a file
  if (nonFlagArgs.length === 1 && nonFlagArgs[0] !== 'HEAD') {
    return unstageFile(nonFlagArgs[0], engine);
  }

  // git reset (no args) — unstage everything
  if (args.length === 0) {
    return unstageAll(engine);
  }

  return { output: '', success: true };
}

async function resetToRef(mode: 'soft' | 'mixed' | 'hard', ref: string, engine: GitEngine): Promise<CommandResult> {
  try {
    const targetOid = await resolveRef(ref, engine);

    const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (!branch) {
      return { output: 'fatal: cannot reset in detached HEAD state', success: false };
    }

    // Move branch pointer to target
    await git.writeRef({
      fs: engine.fs,
      dir: engine.dir,
      ref: `refs/heads/${branch}`,
      value: targetOid,
      force: true,
    });

    if (mode === 'soft') {
      // Soft: only move HEAD, keep index and working dir as-is
      return { output: `HEAD is now at ${targetOid.slice(0, 7)}`, success: true };
    }

    if (mode === 'mixed') {
      // Mixed: move HEAD and reset index to match the target commit, keep working dir
      const files = await git.listFiles({ fs: engine.fs, dir: engine.dir });
      for (const file of files) {
        await git.resetIndex({ fs: engine.fs, dir: engine.dir, filepath: file });
      }
      return { output: `HEAD is now at ${targetOid.slice(0, 7)}`, success: true };
    }

    if (mode === 'hard') {
      // Hard: move HEAD, reset index, AND reset working directory
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: branch,
        force: true,
      });
      return { output: `HEAD is now at ${targetOid.slice(0, 7)}`, success: true };
    }

    return { output: '', success: true };
  } catch (err) {
    return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
  }
}

async function unstageFile(filepath: string, engine: GitEngine): Promise<CommandResult> {
  try {
    await git.resetIndex({ fs: engine.fs, dir: engine.dir, filepath });
    return { output: `Unstaged changes after reset:\n\t${filepath}`, success: true };
  } catch (err) {
    return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
  }
}

async function unstageAll(engine: GitEngine): Promise<CommandResult> {
  try {
    const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
    for (const [filepath, head, , stage] of matrix) {
      if (head !== stage) {
        await git.resetIndex({ fs: engine.fs, dir: engine.dir, filepath });
      }
    }
    return { output: '', success: true };
  } catch {
    return { output: '', success: true };
  }
}
