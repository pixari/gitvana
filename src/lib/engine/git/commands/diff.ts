import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef, getFilesAtCommit } from '../ref-resolver.js';

export async function diffCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const staged = args.includes('--staged') || args.includes('--cached');
  const stat = args.includes('--stat');
  const nameOnly = args.includes('--name-only');
  const nameStatus = args.includes('--name-status');

  // Check for "git diff HEAD" — show all changes (staged + unstaged) vs HEAD
  const nonFlagArgs = args.filter(a => a != null && !a.startsWith('-'));
  const headArg = nonFlagArgs.find(a => a === 'HEAD');

  // Check for range diff: branch1..branch2 or branch1...branch2
  const rangeArg = args.find(a => a != null && !a.startsWith('-') && (a.includes('...') || a.includes('..')));
  if (rangeArg) {
    if (nameOnly || nameStatus) {
      return rangeDiffNames(rangeArg, engine, nameStatus);
    }
    return rangeDiff(rangeArg, engine);
  }

  const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });

  if (nameOnly || nameStatus) {
    return diffNames(matrix, staged || !!headArg, nameStatus, headArg);
  }

  if (stat) {
    return diffStat(matrix, staged || !!headArg, engine, headArg);
  }

  const lines: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    // "git diff HEAD" shows all changes vs HEAD (staged + unstaged combined)
    // "git diff --staged" shows HEAD vs staging
    // "git diff" (no args) shows staging vs working dir
    const hasChange = headArg
      ? (head !== workdir || head !== stage)
      : staged
        ? head !== stage
        : stage !== workdir;

    if (!hasChange) continue;

    lines.push(`diff --git a/${filepath} b/${filepath}`);

    try {
      let oldContent = '';
      let newContent = '';

      if (headArg || staged) {
        // Compare HEAD vs working dir (headArg) or HEAD vs staging (staged)
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
        if (headArg) {
          // "git diff HEAD" — compare HEAD vs working directory
          if (workdir !== 0) {
            newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
          }
        } else if (stage !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
      } else {
        // Compare staging vs working dir
        if (workdir !== 0) {
          newContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
        }
        // For unstaged diff, old is the staged/committed version
        if (head !== 0) {
          try {
            const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
            const { blob } = await git.readBlob({
              fs: engine.fs,
              dir: engine.dir,
              oid: headOid,
              filepath,
            });
            oldContent = new TextDecoder().decode(blob);
          } catch {
            oldContent = '';
          }
        }
      }

      if (head === 0) {
        lines.push('--- /dev/null');
      } else {
        lines.push(`--- a/${filepath}`);
      }
      lines.push(`+++ b/${filepath}`);

      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      // Filter trailing empty line from split
      const oldTrimmed = oldContent ? oldLines : [];
      const newTrimmed = newContent ? newLines : [];
      if (oldTrimmed.length > 0 && oldTrimmed[oldTrimmed.length - 1] === '') oldTrimmed.pop();
      if (newTrimmed.length > 0 && newTrimmed[newTrimmed.length - 1] === '') newTrimmed.pop();

      lines.push(`@@ -1,${oldTrimmed.length} +1,${newTrimmed.length} @@`);
      for (const l of oldTrimmed) {
        lines.push(`-${l}`);
      }
      for (const l of newTrimmed) {
        lines.push(`+${l}`);
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

function diffNames(
  matrix: StatusMatrix,
  staged: boolean,
  showStatus: boolean,
  headArg?: string,
): CommandResult {
  const lines: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    const hasChange = headArg
      ? (head !== workdir || head !== stage)
      : staged ? head !== stage : stage !== workdir;
    if (!hasChange) continue;

    if (showStatus) {
      // Determine status letter
      let status = 'M';
      if (staged) {
        if (head === 0) status = 'A';
        else if (stage === 0) status = 'D';
      } else {
        if (stage === 0 && workdir === 0) status = 'D';
        else if (head === 0 && stage === 0) status = 'A';
      }
      lines.push(`${status}\t${filepath}`);
    } else {
      lines.push(filepath);
    }
  }

  return { output: lines.join('\n'), success: true };
}

async function rangeDiffNames(
  rangeArg: string,
  engine: GitEngine,
  showStatus: boolean,
): Promise<CommandResult> {
  try {
    const isThreeDot = rangeArg.includes('...');
    const separator = isThreeDot ? '...' : '..';
    const [leftRef, rightRef] = rangeArg.split(separator);

    if (!leftRef || !rightRef) {
      return { output: `fatal: invalid range '${rangeArg}'`, success: false };
    }

    let leftOid: string;
    const rightOid = await resolveRef(rightRef, engine);

    if (isThreeDot) {
      const leftCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: leftRef });
      const rightCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: rightRef });
      const leftOids = new Set(leftCommits.map(c => c.oid));
      const baseCommit = rightCommits.find(c => leftOids.has(c.oid));
      if (!baseCommit) {
        return { output: `fatal: no common ancestor between '${leftRef}' and '${rightRef}'`, success: false };
      }
      leftOid = baseCommit.oid;
    } else {
      leftOid = await resolveRef(leftRef, engine);
    }

    const leftFiles = await getFilesAtCommit(engine, leftOid);
    const rightFiles = await getFilesAtCommit(engine, rightOid);
    const allPaths = new Set([...leftFiles.keys(), ...rightFiles.keys()]);
    const lines: string[] = [];

    for (const filepath of [...allPaths].sort()) {
      const oldContent = leftFiles.get(filepath);
      const newContent = rightFiles.get(filepath);
      if (oldContent === newContent) continue;

      if (showStatus) {
        let status = 'M';
        if (oldContent === undefined) status = 'A';
        else if (newContent === undefined) status = 'D';
        lines.push(`${status}\t${filepath}`);
      } else {
        lines.push(filepath);
      }
    }

    return { output: lines.join('\n'), success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: `fatal: ${msg}`, success: false };
  }
}

async function diffStat(
  matrix: StatusMatrix,
  staged: boolean,
  engine: GitEngine,
  headArg?: string,
): Promise<CommandResult> {
  const fileStats: { name: string; added: number; removed: number }[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    const hasChange = headArg
      ? (head !== workdir || head !== stage)
      : staged ? head !== stage : stage !== workdir;
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

async function rangeDiff(rangeArg: string, engine: GitEngine): Promise<CommandResult> {
  try {
    const isThreeDot = rangeArg.includes('...');
    const separator = isThreeDot ? '...' : '..';
    const [leftRef, rightRef] = rangeArg.split(separator);

    if (!leftRef || !rightRef) {
      return { output: `fatal: invalid range '${rangeArg}'`, success: false };
    }

    let leftOid: string;
    const rightOid = await resolveRef(rightRef, engine);

    if (isThreeDot) {
      // Three-dot diff: find the merge base (common ancestor)
      const leftCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: leftRef });
      const rightCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: rightRef });
      const leftOids = new Set(leftCommits.map(c => c.oid));
      const baseCommit = rightCommits.find(c => leftOids.has(c.oid));
      if (!baseCommit) {
        return { output: `fatal: no common ancestor between '${leftRef}' and '${rightRef}'`, success: false };
      }
      leftOid = baseCommit.oid;
    } else {
      leftOid = await resolveRef(leftRef, engine);
    }

    const leftFiles = await getFilesAtCommit(engine, leftOid);
    const rightFiles = await getFilesAtCommit(engine, rightOid);

    const allPaths = new Set([...leftFiles.keys(), ...rightFiles.keys()]);
    const lines: string[] = [];

    for (const filepath of [...allPaths].sort()) {
      const oldContent = leftFiles.get(filepath) || '';
      const newContent = rightFiles.get(filepath) || '';

      if (oldContent === newContent) continue;

      lines.push(`diff --git a/${filepath} b/${filepath}`);

      if (!leftFiles.has(filepath)) {
        lines.push('--- /dev/null');
      } else {
        lines.push(`--- a/${filepath}`);
      }
      if (!rightFiles.has(filepath)) {
        lines.push('+++ /dev/null');
      } else {
        lines.push(`+++ b/${filepath}`);
      }

      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
      for (const l of oldLines) {
        if (l || oldContent) lines.push(`-${l}`);
      }
      for (const l of newLines) {
        if (l || newContent) lines.push(`+${l}`);
      }
      lines.push('');
    }

    if (lines.length === 0) {
      return { output: '', success: true };
    }

    return { output: lines.join('\n'), success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: `fatal: ${msg}`, success: false };
  }
}
