import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef, getFilesAtCommit, writeConflictMarkers } from '../ref-resolver.js';

export async function revertCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const ref = args.filter((a) => a != null && !a.startsWith('-'))[0];

  if (!ref) {
    return { output: 'error: you must specify a commit to revert', success: false };
  }

  try {
    // 1. Resolve the target commit
    let targetOid: string;
    try {
      targetOid = await resolveRef(ref, engine);
    } catch {
      return { output: `fatal: bad revision '${ref}'`, success: false };
    }

    // 2. Read the target commit
    const targetCommit = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid: targetOid });
    const targetMessage = targetCommit.commit.message.trim();

    // 3. The target must have at least one parent to revert
    if (targetCommit.commit.parent.length === 0) {
      return { output: 'fatal: cannot revert initial commit', success: false };
    }

    const parentOid = targetCommit.commit.parent[0];
    const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });

    // 4. Handle files ADDED by the target commit (not in parent): delete them
    const targetFiles = await getFilesAtCommit(engine, targetOid);
    const parentFiles = await getFilesAtCommit(engine, parentOid);

    for (const [filepath] of targetFiles) {
      if (!parentFiles.has(filepath)) {
        // File was added by target commit — delete it to revert
        try {
          await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
        } catch { /* already gone */ }
        try {
          await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
        } catch { /* not in index */ }
      }
    }

    // 5. Use writeConflictMarkers for three-way merge:
    //    base = targetOid (the state we're reverting FROM)
    //    ours = headOid (current HEAD)
    //    theirs = parentOid (the state we want to revert TO)
    const theirsLabel = `revert "${targetMessage}"`;
    const conflictFiles = await writeConflictMarkers(
      engine, headOid, parentOid, 'HEAD', theirsLabel, targetOid,
    );

    if (conflictFiles.length > 0) {
      // Stage what we can for conflict resolution
      const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
      for (const [filepath, , workdir] of statusMatrix) {
        if (workdir === 2) {
          await git.add({ fs: engine.fs, dir: engine.dir, filepath });
        }
      }
      return {
        output: `Auto-merging failed; fix conflicts and then commit the result.\n${conflictFiles.map((f) => `CONFLICT (content): Merge conflict in ${f}`).join('\n')}`,
        success: false,
      };
    }

    // 6. No conflicts — stage all changes and auto-commit
    const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
    for (const [filepath, , workdir] of statusMatrix) {
      if (workdir === 2) {
        await git.add({ fs: engine.fs, dir: engine.dir, filepath });
      } else if (workdir === 0) {
        await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
      }
    }

    const revertMessage = `Revert "${targetMessage}"`;
    const sha = await git.commit({
      fs: engine.fs,
      dir: engine.dir,
      message: revertMessage,
      author: { name: 'Player', email: 'player@gitvana.dev' },
    });

    const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'HEAD';
    const shortSha = sha.slice(0, 7);

    return {
      output: `[${branch} ${shortSha}] ${revertMessage}`,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}
