import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function statusCommand(_args: string[], engine: GitEngine): Promise<CommandResult> {
  const shortMode = _args.includes('-s') || _args.includes('--short');
  const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });

  let matrix: [string, number, number, number][];
  try {
    matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
  } catch {
    // No commits yet — list files manually as untracked
    const entries = await engine.fs.promises.readdir(engine.dir) as string[];
    const untracked = entries.filter((e: string) => e !== '.git');
    if (shortMode) {
      const lines = untracked.map(f => `?? ${f}`);
      return { output: lines.join('\n'), success: true };
    }
    const lines: string[] = [`On branch ${branch || '(no branch)'}`];
    if (untracked.length > 0) {
      lines.push('');
      lines.push('No commits yet');
      lines.push('');
      lines.push('Untracked files:');
      lines.push('  (use "git add <file>..." to include in what will be committed)');
      for (const f of untracked) {
        lines.push(`\t${f}`);
      }
    } else {
      lines.push('');
      lines.push('No commits yet');
      lines.push('');
      lines.push('nothing to commit (create/copy files and use "git add" to track)');
    }
    return { output: lines.join('\n'), success: true };
  }

  if (shortMode) {
    const lines: string[] = [];
    for (const [filepath, head, workdir, stage] of matrix) {
      let stagingCol = ' ';
      let workdirCol = ' ';

      if (head === 0 && workdir === 2 && stage === 0) {
        // Untracked
        lines.push(`?? ${filepath}`);
        continue;
      }
      // Staging column
      if (head === 0 && stage === 2) stagingCol = 'A';
      else if (head === 1 && stage === 2) stagingCol = 'M';
      else if (head === 1 && stage === 0) stagingCol = 'D';
      // Working directory column
      if (head === 1 && workdir === 2 && stage === 1) workdirCol = 'M';
      else if (head === 1 && workdir === 0 && stage === 1) workdirCol = 'D';

      if (stagingCol !== ' ' || workdirCol !== ' ') {
        lines.push(`${stagingCol}${workdirCol} ${filepath}`);
      }
    }
    return { output: lines.join('\n'), success: true };
  }

  const lines: string[] = [`On branch ${branch || '(no branch)'}`];
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    if (head === 0 && workdir === 2 && stage === 0) {
      untracked.push(filepath);
    } else if (head === 0 && workdir === 2 && stage === 2) {
      staged.push(`\tnew file:   ${filepath}`);
    } else if (head === 1 && workdir === 2 && stage === 2) {
      staged.push(`\tmodified:   ${filepath}`);
    } else if (head === 1 && workdir === 2 && stage === 1) {
      unstaged.push(`\tmodified:   ${filepath}`);
    } else if (head === 1 && workdir === 0 && stage === 0) {
      staged.push(`\tdeleted:    ${filepath}`);
    } else if (head === 1 && workdir === 0 && stage === 1) {
      unstaged.push(`\tdeleted:    ${filepath}`);
    }
  }

  if (staged.length > 0) {
    lines.push('');
    lines.push('Changes to be committed:');
    lines.push('  (use "git restore --staged <file>..." to unstage)');
    lines.push(...staged);
  }

  if (unstaged.length > 0) {
    lines.push('');
    lines.push('Changes not staged for commit:');
    lines.push('  (use "git add <file>..." to update what will be committed)');
    lines.push(...unstaged);
  }

  if (untracked.length > 0) {
    lines.push('');
    lines.push('Untracked files:');
    lines.push('  (use "git add <file>..." to include in what will be committed)');
    for (const f of untracked) {
      lines.push(`\t${f}`);
    }
  }

  if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
    lines.push('');
    lines.push('nothing to commit, working tree clean');
  }

  return { output: lines.join('\n'), success: true };
}
