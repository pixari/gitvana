import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef, writeConflictMarkers } from '../ref-resolver.js';

export async function cherryPickCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const commitRef = args.filter((a) => a != null && !a.startsWith('-'))[0];

  if (!commitRef) {
    return { output: 'fatal: no commit specified', success: false };
  }

  // Resolve the commit OID
  let oid: string;
  try {
    oid = await resolveRef(commitRef, engine);
  } catch (err) {
    return { output: `fatal: ${err instanceof Error ? err.message : err}`, success: false };
  }

  try {
    await git.cherryPick({
      fs: engine.fs,
      dir: engine.dir,
      oid,
      committer: { name: 'Player', email: 'player@gitvana.dev' },
    });

    // Get the new HEAD after cherry-pick
    const newHead = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });

    // Checkout to update working directory
    const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (currentBranch) {
      await git.checkout({ fs: engine.fs, dir: engine.dir, ref: currentBranch });
    }

    return {
      output: `[${currentBranch || 'HEAD'} ${newHead.slice(0, 7)}] Cherry-picked commit ${oid.slice(0, 7)}`,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle conflicts
    if (message.includes('conflict') || message.includes('Merge') || message.includes('Could not merge')) {
      try {
        const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'HEAD';
        const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
        const theirCommit = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid });
        const parentOid = theirCommit.commit.parent[0];

        const conflictFiles = await writeConflictMarkers(
          engine, headOid, oid, currentBranch, oid.slice(0, 7), parentOid,
        );

        // Write CHERRY_PICK_HEAD so the user knows which commit is being picked
        await engine.fs.promises.writeFile(
          `${engine.dir}/.git/CHERRY_PICK_HEAD`,
          oid + '\n',
          'utf8',
        );

        if (conflictFiles.length > 0) {
          return {
            output: `error: could not apply ${oid.slice(0, 7)}...\n${conflictFiles.map((f) => `CONFLICT (content): Merge conflict in ${f}`).join('\n')}\nAfter resolving the conflicts, use "git add" and "git commit" to complete the cherry-pick.`,
            success: false,
          };
        }

        // Clean cherry-pick — no conflicts. Stage all files and commit.
        const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
        for (const [filepath, , workdir] of statusMatrix) {
          if (workdir === 2) {
            await git.add({ fs: engine.fs, dir: engine.dir, filepath });
          } else if (workdir === 0) {
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
          }
        }

        const commitData = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid });
        const newOid = await git.commit({
          fs: engine.fs,
          dir: engine.dir,
          message: commitData.commit.message,
          author: { name: 'Player', email: 'player@gitvana.dev' },
        });

        // Clean up CHERRY_PICK_HEAD
        try { await engine.fs.promises.unlink(`${engine.dir}/.git/CHERRY_PICK_HEAD`); } catch { /* ignore */ }

        return {
          output: `[${currentBranch} ${newOid.slice(0, 7)}] Cherry-picked commit ${oid.slice(0, 7)}`,
          success: true,
        };
      } catch { /* fall through */ }

      return {
        output: `error: could not apply ${oid.slice(0, 7)}...\nCONFLICT: cherry-pick failed. Fix conflicts, then commit.`,
        success: false,
      };
    }

    return { output: `error: ${message}`, success: false };
  }
}
