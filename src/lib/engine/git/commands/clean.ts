import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function cleanCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const force = args.includes('-f') || args.includes('--force');
  const dryRun = args.includes('-n') || args.includes('--dry-run');
  const dirs = args.includes('-d');

  if (!force && !dryRun) {
    return {
      output: 'fatal: clean.requireForce defaults to true and neither -n nor -f given; refusing to clean',
      success: false,
    };
  }

  try {
    const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
    // Untracked files: head=0, workdir=2, stage=0
    const untracked = matrix
      .filter(([, head, workdir, stage]) => head === 0 && workdir === 2 && stage === 0)
      .map(([path]) => path);

    if (untracked.length === 0) {
      return { output: 'nothing to clean', success: true };
    }

    const lines: string[] = [];

    for (const filepath of untracked) {
      if (dryRun) {
        lines.push(`Would remove ${filepath}`);
      } else {
        try {
          await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
          lines.push(`Removing ${filepath}`);
        } catch {
          // Might be a directory
          if (dirs) {
            try {
              await removeDir(engine, `${engine.dir}/${filepath}`);
              lines.push(`Removing ${filepath}/`);
            } catch { /* skip */ }
          }
        }
      }
    }

    if (lines.length === 0) {
      return { output: 'nothing to clean', success: true };
    }

    return { output: lines.join('\n'), success: true };
  } catch {
    return { output: 'fatal: not a git repository', success: false };
  }
}

async function removeDir(engine: GitEngine, absPath: string): Promise<void> {
  const entries = await engine.fs.promises.readdir(absPath) as string[];
  for (const entry of entries) {
    const fullPath = `${absPath}/${entry}`;
    try {
      const stat = await engine.fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await removeDir(engine, fullPath);
      } else {
        await engine.fs.promises.unlink(fullPath);
      }
    } catch { /* skip */ }
  }
  await engine.fs.promises.rmdir(absPath);
}
