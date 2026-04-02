import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function branchCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const deleteFlag = args.includes('-d') || args.includes('-D') || args.includes('--delete') || args.includes('--force-delete');

  if (deleteFlag) {
    const name = args.filter((a) => !a.startsWith('-'))[0];
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

  const verboseFlag = args.includes('-v') || args.includes('--verbose');

  // No args (or only display flags): list branches
  const displayOnly = args.every(a => ['-a', '-v', '--verbose'].includes(a));
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
    return { output: lines.join('\n'), success: true };
  }

  // Create branch
  const nonFlagArgs = args.filter((a) => !a.startsWith('-'));
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
