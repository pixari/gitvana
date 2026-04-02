import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { writeConflictMarkers } from '../ref-resolver.js';

export async function mergeCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  if (args.includes('--abort')) {
    // Restore to HEAD state
    try {
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'main',
        force: true,
      });
      // Clean up MERGE_HEAD
      try {
        await engine.fs.promises.unlink(`${engine.dir}/.git/MERGE_HEAD`);
      } catch { /* no MERGE_HEAD */ }
      return { output: 'Merge aborted.', success: true };
    } catch (err) {
      return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
    }
  }

  const noFastForward = args.includes('--no-ff');
  const theirBranch = args.filter((a) => a != null && !a.startsWith('-'))[0];

  if (!theirBranch) {
    return { output: 'fatal: no branch specified for merge', success: false };
  }

  try {
    const result = await git.merge({
      fs: engine.fs,
      dir: engine.dir,
      theirs: theirBranch,
      author: { name: 'Player', email: 'player@gitvana.dev' },
      abortOnConflict: false,
    });

    if (result.alreadyMerged) {
      return { output: 'Already up to date.', success: true };
    }

    if (result.fastForward && !noFastForward) {
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'main',
      });
      return { output: 'Updating...\nFast-forward', success: true };
    }

    // After a successful 3-way merge, checkout the current branch to update working dir
    const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (currentBranch) {
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: currentBranch,
      });
    }

    // Check if there were conflicts by reading the merge tree
    if (result.tree) {
      // Walk the tree to check for conflicts
      const conflicts = await findConflicts(engine);
      if (conflicts.length > 0) {
        return {
          output: `Auto-merging failed; fix conflicts and then commit the result.\n${conflicts.map((f) => `CONFLICT (content): Merge conflict in ${f}`).join('\n')}`,
          success: false,
        };
      }
    }

    return { output: `Merge made by the 'ort' strategy.`, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // isomorphic-git throws on conflict — manually create conflict markers
    if (message.includes('conflict') || message.includes('Merge') || message.includes('Could not merge')) {
      try {
        const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'HEAD';
        const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
        const theirOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: theirBranch });
        const [baseOid] = await git.findMergeBase({ fs: engine.fs, dir: engine.dir, oids: [headOid, theirOid] });

        const conflictFiles = await writeConflictMarkers(
          engine, headOid, theirOid, currentBranch, theirBranch, baseOid,
        );

        // Store MERGE_HEAD so the next commit creates a proper merge commit
        await engine.fs.promises.writeFile(
          `${engine.dir}/.git/MERGE_HEAD`,
          theirOid + '\n',
          'utf8',
        );

        if (conflictFiles.length > 0) {
          return {
            output: `Auto-merging failed; fix conflicts and then commit the result.\n${conflictFiles.map((f) => `CONFLICT (content): Merge conflict in ${f}`).join('\n')}`,
            success: false,
          };
        }

        // Clean merge — no conflicts. Stage all files and create merge commit.
        const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
        for (const [filepath, , workdir] of statusMatrix) {
          if (workdir === 2) {
            await git.add({ fs: engine.fs, dir: engine.dir, filepath });
          } else if (workdir === 0) {
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
          }
        }

        // Read MERGE_HEAD for the second parent
        const mergeHead = (await engine.fs.promises.readFile(
          `${engine.dir}/.git/MERGE_HEAD`, 'utf8',
        ) as string).trim();

        await git.commit({
          fs: engine.fs,
          dir: engine.dir,
          message: `Merge branch '${theirBranch}'`,
          author: { name: 'Player', email: 'player@gitvana.dev' },
          parent: [headOid, mergeHead],
        });

        // Clean up MERGE_HEAD
        try { await engine.fs.promises.unlink(`${engine.dir}/.git/MERGE_HEAD`); } catch { /* ignore */ }

        return { output: `Merge made by the 'ort' strategy.`, success: true };
      } catch { /* fall through */ }

      return {
        output: `Auto-merging failed; fix conflicts and then commit the result.\nCONFLICT (content): Merge conflict`,
        success: false,
      };
    }
    return { output: `error: ${message}`, success: false };
  }
}

async function findConflicts(engine: GitEngine): Promise<string[]> {
  // Check working directory for conflict markers
  const conflicts: string[] = [];
  try {
    const entries = await engine.fs.promises.readdir(engine.dir) as string[];
    for (const entry of entries) {
      if (entry === '.git') continue;
      try {
        const content = await engine.fs.promises.readFile(`${engine.dir}/${entry}`, 'utf8') as string;
        if (content.includes('<<<<<<<')) {
          conflicts.push(entry);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return conflicts;
}
