import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function checkoutCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const createBranch = args.includes('-b') || args.includes('-c') || args.includes('--create');

  // Handle: git checkout [<ref>] -- <file>
  const dashDashIndex = args.indexOf('--');
  if (dashDashIndex !== -1) {
    const ref = args.slice(0, dashDashIndex).filter((a) => a != null && !a.startsWith('-'))[0];
    const filepath = args.slice(dashDashIndex + 1).filter((a) => a != null && !a.startsWith('-'))[0];
    if (filepath) {
      // If no ref before --, default to HEAD
      return restoreFileFromRef(ref || 'HEAD', filepath, engine);
    }
  }

  const branchName = args.filter((a) => a != null && !a.startsWith('-'))[0];

  if (!branchName) {
    return { output: 'error: you must specify a branch to checkout', success: false };
  }

  if (createBranch) {
    await git.branch({ fs: engine.fs, dir: engine.dir, ref: branchName });
  }

  try {
    // Resolve HEAD@{N} reflog refs and other special refs
    let resolvedRef = branchName;
    const reflogMatch = branchName.match(/^HEAD@\{(\d+)\}$/);
    if (reflogMatch) {
      const idx = parseInt(reflogMatch[1], 10);
      if (idx >= engine.reflogEntries.length) {
        return { output: `error: Could not find ${branchName}.`, success: false };
      }
      resolvedRef = engine.reflogEntries[idx].oid;
    }

    await git.checkout({ fs: engine.fs, dir: engine.dir, ref: resolvedRef });
    return {
      output: `Switched to${createBranch ? ' a new' : ''} branch '${branchName}'`,
      success: true,
    };
  } catch (err) {
    // Auto-create local branch from remote tracking branch (like real git)
    if (!createBranch && !branchName.includes('/') && !branchName.includes('@')) {
      for (const remoteName of engine.remotes.keys()) {
        try {
          const oid = await git.resolveRef({
            fs: engine.fs,
            dir: engine.dir,
            ref: `refs/remotes/${remoteName}/${branchName}`,
          });
          // Remote tracking branch exists — create local branch and checkout
          await git.branch({ fs: engine.fs, dir: engine.dir, ref: branchName, object: oid });
          await git.checkout({ fs: engine.fs, dir: engine.dir, ref: branchName });
          return {
            output: `branch '${branchName}' set up to track '${remoteName}/${branchName}'.\nSwitched to a new branch '${branchName}'`,
            success: true,
          };
        } catch { /* no such tracking ref */ }
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}

async function restoreFileFromRef(ref: string, filepath: string, engine: GitEngine): Promise<CommandResult> {
  try {
    const targetOid = await resolveRef(ref, engine);

    // Read file from that commit's tree
    const { tree } = await git.readTree({ fs: engine.fs, dir: engine.dir, oid: targetOid });
    const entry = tree.find((e) => e.path === filepath);
    if (!entry) {
      return { output: `error: pathspec '${filepath}' did not match any file(s) in commit ${targetOid.slice(0, 7)}`, success: false };
    }

    const { blob } = await git.readBlob({ fs: engine.fs, dir: engine.dir, oid: entry.oid });
    const content = new TextDecoder().decode(blob);

    // Write file to working directory
    await engine.fs.promises.writeFile(`${engine.dir}/${filepath}`, content, 'utf8');

    // Stage the file
    await git.add({ fs: engine.fs, dir: engine.dir, filepath });

    return { output: `Updated '${filepath}' from ${targetOid.slice(0, 7)}`, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}
