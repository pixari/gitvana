import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function commitCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const isAmend = args.includes('--amend');

  let message = '';
  const mIndex = args.indexOf('-m') !== -1 ? args.indexOf('-m') : args.indexOf('--message');
  if (mIndex !== -1 && args[mIndex + 1]) {
    message = args[mIndex + 1];
  }

  if (isAmend) {
    return amendCommit(message, engine);
  }

  if (!message) {
    return {
      output: 'error: switch `m\' requires a value',
      success: false,
    };
  }

  // Check if there's anything staged
  const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
  const staged = matrix.filter(([, head, , stage]) => head !== stage);
  if (staged.length === 0) {
    return {
      output: 'nothing to commit, working tree clean',
      success: false,
    };
  }

  // Check if we're completing a merge (MERGE_HEAD exists)
  let mergeParent: string | null = null;
  try {
    const mergeHead = await engine.fs.promises.readFile(`${engine.dir}/.git/MERGE_HEAD`, 'utf8') as string;
    mergeParent = mergeHead.trim();
  } catch {
    // No MERGE_HEAD — normal commit
  }

  const sha = await git.commit({
    fs: engine.fs,
    dir: engine.dir,
    message,
    author: { name: engine.configStore.get('user.name') || 'Player', email: engine.configStore.get('user.email') || 'player@gitvana.dev' },
  });

  // If we had a merge parent, we need to amend the commit to include both parents
  if (mergeParent) {
    const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
    const headCommit = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid: headOid });

    // Create a new commit with both parents
    const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'HEAD';
    const mergeCommitOid = await git.commit({
      fs: engine.fs,
      dir: engine.dir,
      message,
      author: { name: engine.configStore.get('user.name') || 'Player', email: engine.configStore.get('user.email') || 'player@gitvana.dev' },
      parent: [headCommit.commit.parent[0], mergeParent],
    });

    // Clean up MERGE_HEAD
    try {
      await engine.fs.promises.unlink(`${engine.dir}/.git/MERGE_HEAD`);
    } catch { /* ignore */ }

    const shortSha = mergeCommitOid.slice(0, 7);
    const fileCount = staged.length;
    const fileWord = fileCount === 1 ? 'file changed' : 'files changed';

    return {
      output: `[${branch} ${shortSha}] ${message}\n ${fileCount} ${fileWord}`,
      success: true,
    };
  }

  const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'HEAD';
  const shortSha = sha.slice(0, 7);
  const fileCount = staged.length;
  const fileWord = fileCount === 1 ? 'file changed' : 'files changed';

  return {
    output: `[${branch} ${shortSha}] ${message}\n ${fileCount} ${fileWord}`,
    success: true,
  };
}

async function amendCommit(newMessage: string, engine: GitEngine): Promise<CommandResult> {
  // 1. Get current HEAD commit
  let commits;
  try {
    commits = await git.log({ fs: engine.fs, dir: engine.dir, depth: 1 });
  } catch {
    return {
      output: 'fatal: you do not have any commits yet. Cannot amend.',
      success: false,
    };
  }

  if (commits.length === 0) {
    return {
      output: 'fatal: you do not have any commits yet. Cannot amend.',
      success: false,
    };
  }

  const head = commits[0];
  const parents = head.commit.parent;
  const message = newMessage || head.commit.message;

  // 2. Get current branch and reset it to the parent
  const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
  if (!branch) {
    return {
      output: 'fatal: cannot amend in detached HEAD state',
      success: false,
    };
  }

  if (parents.length > 0) {
    // Point the branch back to the parent commit
    await git.writeRef({
      fs: engine.fs,
      dir: engine.dir,
      ref: `refs/heads/${branch}`,
      value: parents[0],
      force: true,
    });
  } else {
    // This is the root commit (no parents) — delete the branch ref so commit creates a new root
    await engine.fs.promises.unlink(`${engine.dir}/.git/refs/heads/${branch}`);
  }

  // 3. Create new commit from current index (staging area) with the parent as parent
  const sha = await git.commit({
    fs: engine.fs,
    dir: engine.dir,
    message,
    author: { name: engine.configStore.get('user.name') || 'Player', email: engine.configStore.get('user.email') || 'player@gitvana.dev' },
  });

  const shortSha = sha.slice(0, 7);

  return {
    output: `[${branch} ${shortSha}] ${message.trimEnd()}`,
    success: true,
  };
}
