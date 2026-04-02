import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function branchCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const deleteFlag = args.includes('-d') || args.includes('-D') || args.includes('--delete') || args.includes('--force-delete');
  const moveFlag = args.includes('-m') || args.includes('--move');
  const mergedFlag = args.includes('--merged');
  const noMergedFlag = args.includes('--no-merged');

  if (deleteFlag) {
    const name = args.filter((a) => a != null && !a.startsWith('-'))[0];
    if (!name) {
      return { output: 'fatal: branch name required', success: false };
    }
    const current = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (name === current) {
      return { output: `error: Cannot delete branch '${name}' checked out`, success: false };
    }
    await git.deleteBranch({ fs: engine.fs, dir: engine.dir, ref: name });
    return { output: `Deleted branch ${name}.`, success: true };
  }

  // Rename branch: git branch -m old new
  if (moveFlag) {
    const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));
    if (nonFlagArgs.length < 2) {
      return { output: 'fatal: usage: git branch -m <old-name> <new-name>', success: false };
    }
    const oldName = nonFlagArgs[0];
    const newName = nonFlagArgs[1];
    try {
      await git.renameBranch({ fs: engine.fs, dir: engine.dir, oldref: oldName, ref: newName });
      return { output: '', success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { output: `error: ${msg}`, success: false };
    }
  }

  const verboseFlag = args.includes('-v') || args.includes('--verbose');
  const remoteFlag = args.includes('-r');
  const allFlag = args.includes('-a');

  // -r: list remote tracking branches only
  if (remoteFlag && !allFlag) {
    const lines: string[] = [];
    try {
      const remotesDir = `${engine.dir}/.git/refs/remotes`;
      const remoteNames = await engine.fs.promises.readdir(remotesDir) as string[];
      for (const remote of remoteNames) {
        const remoteDir = `${remotesDir}/${remote}`;
        const branches = await engine.fs.promises.readdir(remoteDir) as string[];
        for (const branch of branches) {
          lines.push(`  remotes/${remote}/${branch}`);
        }
      }
    } catch { /* no remote tracking refs */ }
    return { output: lines.join('\n'), success: true };
  }

  // --merged / --no-merged filtering
  if (mergedFlag || noMergedFlag) {
    const branches = await git.listBranches({ fs: engine.fs, dir: engine.dir });
    const current = await git.currentBranch({ fs: engine.fs, dir: engine.dir });

    // Get all commits reachable from HEAD
    let headCommits: Set<string>;
    try {
      const logs = await git.log({ fs: engine.fs, dir: engine.dir });
      headCommits = new Set(logs.map(c => c.oid));
    } catch {
      headCommits = new Set();
    }

    const lines: string[] = [];
    for (const b of branches) {
      try {
        const tipOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: b });
        const isMerged = headCommits.has(tipOid);
        if ((mergedFlag && isMerged) || (noMergedFlag && !isMerged)) {
          const prefix = b === current ? '* ' : '  ';
          lines.push(`${prefix}${b}`);
        }
      } catch {
        // skip branches we can't resolve
      }
    }
    return { output: lines.join('\n'), success: true };
  }

  // No args (or only display flags): list branches
  const displayOnly = args.every(a => ['-a', '-r', '-v', '--verbose'].includes(a));
  if (args.length === 0 || displayOnly) {
    const branches = await git.listBranches({ fs: engine.fs, dir: engine.dir });
    const current = await git.currentBranch({ fs: engine.fs, dir: engine.dir });

    if (verboseFlag) {
      const lines: string[] = [];
      for (const b of branches) {
        const prefix = b === current ? '* ' : '  ';
        try {
          const commits = await git.log({ fs: engine.fs, dir: engine.dir, ref: b, depth: 1 });
          if (commits.length > 0) {
            const c = commits[0];
            const shortHash = c.oid.slice(0, 7);
            const subject = c.commit.message.split('\n')[0];
            lines.push(`${prefix}${b}\t${shortHash} ${subject}`);
          } else {
            lines.push(`${prefix}${b}`);
          }
        } catch {
          lines.push(`${prefix}${b}`);
        }
      }
      return { output: lines.join('\n'), success: true };
    }

    const lines = branches.map((b) => (b === current ? `* ${b}` : `  ${b}`));

    // -a: also include remote tracking branches
    if (allFlag) {
      try {
        const remotesDir = `${engine.dir}/.git/refs/remotes`;
        const remoteNames = await engine.fs.promises.readdir(remotesDir) as string[];
        for (const remote of remoteNames) {
          const remoteDir = `${remotesDir}/${remote}`;
          const remoteBranches = await engine.fs.promises.readdir(remoteDir) as string[];
          for (const branch of remoteBranches) {
            lines.push(`  remotes/${remote}/${branch}`);
          }
        }
      } catch { /* no remote tracking refs */ }
    }

    return { output: lines.join('\n'), success: true };
  }

  // Create branch
  const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));
  const name = nonFlagArgs[0];
  const startPoint = nonFlagArgs[1];

  if (startPoint) {
    // git branch <name> <commit-hash or ref>
    let targetOid: string;
    try {
      targetOid = await resolveRef(startPoint, engine);
    } catch {
      return { output: `fatal: not a valid object name: '${startPoint}'`, success: false };
    }
    await git.writeRef({
      fs: engine.fs,
      dir: engine.dir,
      ref: `refs/heads/${name}`,
      value: targetOid,
    });
    return { output: '', success: true };
  }

  await git.branch({ fs: engine.fs, dir: engine.dir, ref: name });
  return { output: '', success: true };
}
