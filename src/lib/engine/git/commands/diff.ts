import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function diffCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const staged = args.includes('--staged') || args.includes('--cached');
  const stat = args.includes('--stat');

  const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });

  if (stat) {
    return diffStat(matrix, staged, engine);
  }

  const lines: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    const hasChange = staged
      ? head !== stage
      : stage !== workdir;

    if (!hasChange) continue;

    lines.push(`diff --git a/${filepath} b/${filepath}`);

    try {
      let oldContent = '';
      let newContent = '';

      if (staged) {
        // Compare HEAD vs staging
        if (head !== 0) {
          const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
          const { blob } = await git.readBlob({
            fs: engine.fs,
            dir: engine.dir,
            oid: headOid,
            filepath,
          });
          oldContent = new TextDecoder().decode(blob);
        }
        if (stage !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
      } else {
        // Compare staging vs working dir
        if (workdir !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
        // For unstaged diff, old is the staged version (approximated as working dir content before edit)
        oldContent = '';
      }

      if (head === 0) {
        lines.push('--- /dev/null');
      } else {
        lines.push(`--- a/${filepath}`);
      }
      lines.push(`+++ b/${filepath}`);

      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
      for (const l of oldLines) {
        if (l) lines.push(`-${l}`);
      }
      for (const l of newLines) {
        if (l) lines.push(`+${l}`);
      }
    } catch {
      lines.push('(binary file or unreadable)');
    }

    lines.push('');
  }

  if (lines.length === 0) {
    return { output: '', success: true };
  }

  return { output: lines.join('\n'), success: true };
}

type StatusMatrix = [string, number, number, number][];

async function diffStat(
  matrix: StatusMatrix,
  staged: boolean,
  engine: GitEngine,
): Promise<CommandResult> {
  const fileStats: { name: string; added: number; removed: number }[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    const hasChange = staged ? head !== stage : stage !== workdir;
    if (!hasChange) continue;

    let oldContent = '';
    let newContent = '';

    try {
      if (staged) {
        if (head !== 0) {
          const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
          const { blob } = await git.readBlob({
            fs: engine.fs,
            dir: engine.dir,
            oid: headOid,
            filepath,
          });
          oldContent = new TextDecoder().decode(blob);
        }
        if (stage !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
      } else {
        if (workdir !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
      }
    } catch {
      // unreadable
    }

    const oldLines = oldContent ? oldContent.split('\n').filter(Boolean) : [];
    const newLines = newContent ? newContent.split('\n').filter(Boolean) : [];

    // Simple line-count based stat
    const added = newLines.length;
    const removed = oldLines.length;

    fileStats.push({ name: filepath, added, removed });
  }

  if (fileStats.length === 0) {
    return { output: '', success: true };
  }

  const lines: string[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  const maxNameLen = Math.max(...fileStats.map(f => f.name.length));

  for (const f of fileStats) {
    const changes = f.added + f.removed;
    const bar = '+'.repeat(f.added) + '-'.repeat(f.removed);
    const paddedName = f.name.padEnd(maxNameLen);
    lines.push(` ${paddedName} | ${String(changes).padStart(3)} ${bar}`);
    totalAdded += f.added;
    totalRemoved += f.removed;
  }

  const filesWord = fileStats.length === 1 ? 'file changed' : 'files changed';
  const insertions = totalAdded > 0 ? `, ${totalAdded} insertion${totalAdded !== 1 ? 's' : ''}(+)` : '';
  const deletions = totalRemoved > 0 ? `, ${totalRemoved} deletion${totalRemoved !== 1 ? 's' : ''}(-)` : '';
  lines.push(` ${fileStats.length} ${filesWord}${insertions}${deletions}`);

  return { output: lines.join('\n'), success: true };
}
