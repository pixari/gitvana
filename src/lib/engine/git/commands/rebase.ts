import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { writeConflictMarkers } from '../ref-resolver.js';

export async function rebaseCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  if (args.includes('--abort')) {
    return rebaseAbort(engine);
  }

  if (args.includes('--continue')) {
    return rebaseContinue(engine);
  }

  const targetBranch = args.filter((a) => a != null && !a.startsWith('-'))[0];
  if (!targetBranch) {
    return { output: 'fatal: no branch specified for rebase', success: false };
  }

  return rebaseStart(targetBranch, engine);
}

async function rebaseStart(targetBranch: string, engine: GitEngine): Promise<CommandResult> {
  const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
  if (!currentBranch) {
    return { output: 'fatal: cannot rebase in detached HEAD state', success: false };
  }

  // Check if rebase is already in progress
  try {
    await engine.fs.promises.stat(`${engine.dir}/.git/rebase-merge`);
    return { output: 'fatal: a rebase is already in progress. Use --continue or --abort.', success: false };
  } catch { /* no rebase in progress, good */ }

  let headOid: string;
  let targetOid: string;
  try {
    headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
    targetOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: targetBranch });
  } catch {
    return { output: `fatal: invalid reference '${targetBranch}'`, success: false };
  }

  // Already up to date?
  if (headOid === targetOid) {
    return { output: 'Current branch is up to date.', success: true };
  }

  // Find the merge base (fork point)
  let baseOids: string[];
  try {
    baseOids = await git.findMergeBase({ fs: engine.fs, dir: engine.dir, oids: [headOid, targetOid] });
  } catch {
    return { output: 'fatal: could not find a common ancestor', success: false };
  }

  const baseOid = baseOids[0];
  if (!baseOid) {
    return { output: 'fatal: could not find a common ancestor', success: false };
  }

  // If HEAD is an ancestor of target, we can fast-forward
  if (baseOid === headOid) {
    await git.writeRef({
      fs: engine.fs,
      dir: engine.dir,
      ref: `refs/heads/${currentBranch}`,
      value: targetOid,
      force: true,
    });
    await git.checkout({ fs: engine.fs, dir: engine.dir, ref: currentBranch });
    return { output: `Fast-forwarded ${currentBranch} to ${targetBranch}.`, success: true };
  }

  // If target is an ancestor of HEAD, already up to date
  if (baseOid === targetOid) {
    return { output: 'Current branch is up to date.', success: true };
  }

  // Collect commits on the current branch since the fork point
  const allCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: headOid });
  const commitsToReplay: string[] = [];
  for (const c of allCommits) {
    if (c.oid === baseOid) break;
    commitsToReplay.push(c.oid);
  }

  // Reverse so we replay oldest first
  commitsToReplay.reverse();

  if (commitsToReplay.length === 0) {
    return { output: 'Current branch is up to date.', success: true };
  }

  // Save rebase state
  try {
    await engine.fs.promises.mkdir(`${engine.dir}/.git/rebase-merge`);
  } catch { /* may already exist */ }
  await engine.fs.promises.writeFile(`${engine.dir}/.git/rebase-merge/head-name`, currentBranch, 'utf8');
  await engine.fs.promises.writeFile(`${engine.dir}/.git/rebase-merge/orig-head`, headOid, 'utf8');

  // Move branch pointer to target
  await git.writeRef({
    fs: engine.fs,
    dir: engine.dir,
    ref: `refs/heads/${currentBranch}`,
    value: targetOid,
    force: true,
  });
  await git.checkout({ fs: engine.fs, dir: engine.dir, ref: currentBranch });

  // Replay commits one by one
  return replayCommits(commitsToReplay, currentBranch, engine);
}

async function replayCommits(
  remaining: string[],
  currentBranch: string,
  engine: GitEngine,
): Promise<CommandResult> {
  for (let i = 0; i < remaining.length; i++) {
    const oid = remaining[i];
    try {
      await git.cherryPick({
        fs: engine.fs,
        dir: engine.dir,
        oid,
        committer: { name: 'Player', email: 'player@gitvana.dev' },
      });

      // Checkout to update working directory
      await git.checkout({ fs: engine.fs, dir: engine.dir, ref: currentBranch });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('conflict') || message.includes('Merge') || message.includes('Could not merge')) {
        // Write conflict markers using shared utility
        const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
        const theirCommit = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid });
        const parentOid = theirCommit.commit.parent[0];

        let conflictFiles: string[];
        try {
          conflictFiles = await writeConflictMarkers(
            engine, headOid, oid, currentBranch, oid.slice(0, 7), parentOid,
          );
        } catch {
          // diff3 library can throw in strict mode — fall back to full-file conflict
          conflictFiles = ['(unable to compute line-level diff)'];
        }

        if (conflictFiles.length === 0) {
          // Clean merge — no conflicts. Stage all files and commit, then continue.
          const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
          for (const [filepath, , workdir] of statusMatrix) {
            if (workdir === 2) {
              await git.add({ fs: engine.fs, dir: engine.dir, filepath });
            } else if (workdir === 0) {
              await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
            }
          }
          await git.commit({
            fs: engine.fs,
            dir: engine.dir,
            message: theirCommit.commit.message,
            author: { name: 'Player', email: 'player@gitvana.dev' },
          });
          // Continue to next commit
          continue;
        }

        // Save remaining commits (the current one + rest)
        const stillRemaining = remaining.slice(i);
        await engine.fs.promises.writeFile(
          `${engine.dir}/.git/rebase-merge/remaining`,
          JSON.stringify(stillRemaining),
          'utf8',
        );
        await engine.fs.promises.writeFile(
          `${engine.dir}/.git/REBASE_HEAD`,
          oid + '\n',
          'utf8',
        );

        return {
          output: `${conflictFiles.map((f) => `CONFLICT (content): Merge conflict in ${f}`).join('\n')}\nResolve conflicts and run "git rebase --continue"`,
          success: false,
        };
      }

      // Non-conflict error: abort the rebase
      return { output: `error: ${message}`, success: false };
    }
  }

  // All commits replayed successfully - clean up
  await cleanupRebaseState(engine);

  return {
    output: `Successfully rebased and updated refs/heads/${currentBranch}.`,
    success: true,
  };
}

async function rebaseContinue(engine: GitEngine): Promise<CommandResult> {
  // Read rebase state
  let currentBranch: string;
  let remaining: string[];
  try {
    currentBranch = await engine.fs.promises.readFile(`${engine.dir}/.git/rebase-merge/head-name`, 'utf8') as string;
    const remainingJson = await engine.fs.promises.readFile(`${engine.dir}/.git/rebase-merge/remaining`, 'utf8') as string;
    remaining = JSON.parse(remainingJson);
  } catch {
    return { output: 'fatal: no rebase in progress', success: false };
  }

  if (remaining.length === 0) {
    await cleanupRebaseState(engine);
    return { output: 'No more commits to rebase.', success: true };
  }

  // The first item in remaining is the commit that conflicted.
  // The user should have resolved conflicts and staged them.
  // Commit the resolved changes with the original commit's message.
  const currentOid = remaining[0];
  try {
    const commitData = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid: currentOid });
    await git.commit({
      fs: engine.fs,
      dir: engine.dir,
      message: commitData.commit.message,
      author: { name: 'Player', email: 'player@gitvana.dev' },
    });
  } catch (err) {
    return { output: `error: could not commit resolved changes: ${err instanceof Error ? err.message : err}`, success: false };
  }

  // Continue replaying the rest
  const nextRemaining = remaining.slice(1);

  if (nextRemaining.length === 0) {
    await cleanupRebaseState(engine);
    return {
      output: `Successfully rebased and updated refs/heads/${currentBranch}.`,
      success: true,
    };
  }

  // Save updated remaining and continue
  await engine.fs.promises.writeFile(
    `${engine.dir}/.git/rebase-merge/remaining`,
    JSON.stringify(nextRemaining),
    'utf8',
  );

  return replayCommits(nextRemaining, currentBranch, engine);
}

async function rebaseAbort(engine: GitEngine): Promise<CommandResult> {
  let currentBranch: string;
  let origHead: string;
  try {
    currentBranch = await engine.fs.promises.readFile(`${engine.dir}/.git/rebase-merge/head-name`, 'utf8') as string;
    origHead = await engine.fs.promises.readFile(`${engine.dir}/.git/rebase-merge/orig-head`, 'utf8') as string;
  } catch {
    return { output: 'fatal: no rebase in progress', success: false };
  }

  // Reset the branch back to the original position
  await git.writeRef({
    fs: engine.fs,
    dir: engine.dir,
    ref: `refs/heads/${currentBranch}`,
    value: origHead.trim(),
    force: true,
  });
  await git.checkout({ fs: engine.fs, dir: engine.dir, ref: currentBranch });

  await cleanupRebaseState(engine);

  return { output: 'Rebase aborted.', success: true };
}

async function cleanupRebaseState(engine: GitEngine): Promise<void> {
  const filesToRemove = [
    `${engine.dir}/.git/REBASE_HEAD`,
    `${engine.dir}/.git/rebase-merge/head-name`,
    `${engine.dir}/.git/rebase-merge/orig-head`,
    `${engine.dir}/.git/rebase-merge/remaining`,
  ];
  for (const f of filesToRemove) {
    try { await engine.fs.promises.unlink(f); } catch { /* ignore */ }
  }
  try { await engine.fs.promises.rmdir(`${engine.dir}/.git/rebase-merge`); } catch { /* ignore */ }
}
