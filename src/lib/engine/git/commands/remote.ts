import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef, writeConflictMarkers } from '../ref-resolver.js';
import { copyCommitHistory, isFastForward } from '../remote-sync.js';

// ─── git remote ──────────────────────────────────────────────────────────────

export async function remoteCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  if (args.length === 0) {
    // List remote names
    if (engine.remotes.size === 0) {
      return { output: '', success: true };
    }
    const names = [...engine.remotes.keys()];
    return { output: names.join('\n'), success: true };
  }

  const sub = args[0];

  if (sub === '-v') {
    if (engine.remotes.size === 0) {
      return { output: '', success: true };
    }
    const lines: string[] = [];
    for (const [name, remote] of engine.remotes) {
      lines.push(`${name}\t${remote.url} (fetch)`);
      lines.push(`${name}\t${remote.url} (push)`);
    }
    return { output: lines.join('\n'), success: true };
  }

  if (sub === 'add') {
    const name = args[1];
    const url = args[2];
    if (!name || !url) {
      return { output: 'usage: git remote add <name> <url>', success: false };
    }
    if (engine.remotes.has(name)) {
      return { output: `error: remote ${name} already exists.`, success: false };
    }
    await engine.initRemote(name, url);
    return { output: '', success: true };
  }

  if (sub === 'remove' || sub === 'rm') {
    const name = args[1];
    if (!name) {
      return { output: 'usage: git remote remove <name>', success: false };
    }
    if (!engine.remotes.has(name)) {
      return { output: `error: No such remote: '${name}'`, success: false };
    }
    engine.remotes.delete(name);
    // Clean up tracking refs for this remote
    try {
      const trackingDir = `${engine.dir}/.git/refs/remotes/${name}`;
      const entries = await engine.fs.promises.readdir(trackingDir) as string[];
      for (const entry of entries) {
        try { await engine.fs.promises.unlink(`${trackingDir}/${entry}`); } catch {}
      }
      try { await engine.fs.promises.rmdir(trackingDir); } catch {}
    } catch { /* no tracking refs */ }
    return { output: '', success: true };
  }

  return { output: `error: unknown subcommand: ${sub}`, success: false };
}

// ─── git push ────────────────────────────────────────────────────────────────

export async function pushCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const forceFlag = args.includes('--force') || args.includes('-f');
  const setUpstreamFlag = args.includes('-u') || args.includes('--set-upstream');
  const nonFlagArgs = args.filter(a => a != null && !a.startsWith('-'));

  const remoteName = nonFlagArgs[0] || 'origin';
  const remote = engine.remotes.get(remoteName);
  if (!remote) {
    return { output: `fatal: '${remoteName}' does not appear to be a git repository`, success: false };
  }

  // Determine which branch to push
  let branchName = nonFlagArgs[1];
  if (!branchName) {
    const current = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (!current) {
      return { output: 'fatal: not on a branch', success: false };
    }
    branchName = current;
  }

  // Get local branch OID
  let localOid: string;
  try {
    localOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: branchName });
  } catch {
    return { output: `error: src refspec ${branchName} does not match any`, success: false };
  }

  // Get remote branch OID (if exists)
  let remoteOid: string | null = null;
  try {
    remoteOid = await git.resolveRef({ fs: engine.fs, dir: remote.dir, ref: branchName });
  } catch {
    // Branch doesn't exist on remote yet — that's fine
  }

  // Fast-forward check (unless --force)
  if (remoteOid && !forceFlag) {
    const ff = await isFastForward(engine.fs, engine.dir, remoteOid, localOid);
    if (!ff) {
      return {
        output: `To ${remoteName}\n ! [rejected]        ${branchName} -> ${branchName} (non-fast-forward)\nerror: failed to push some refs to '${remoteName}'\nhint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. Use --force to override.`,
        success: false,
      };
    }
  }

  // Copy objects from local to remote
  await copyCommitHistory(engine.fs, engine.dir, remote.dir, localOid);

  // Write ref in remote repo
  await git.writeRef({
    fs: engine.fs,
    dir: remote.dir,
    ref: `refs/heads/${branchName}`,
    value: localOid,
    force: true,
  });

  // Update tracking ref locally
  try {
    await engine.fs.promises.mkdir(`${engine.dir}/.git/refs/remotes`);
  } catch {}
  try {
    await engine.fs.promises.mkdir(`${engine.dir}/.git/refs/remotes/${remoteName}`);
  } catch {}
  await git.writeRef({
    fs: engine.fs,
    dir: engine.dir,
    ref: `refs/remotes/${remoteName}/${branchName}`,
    value: localOid,
    force: true,
  });

  // Format output
  const oldShort = remoteOid ? remoteOid.slice(0, 7) : '';
  const newShort = localOid.slice(0, 7);
  if (remoteOid) {
    const forceMark = forceFlag ? '+' : '';
    return {
      output: `To ${remoteName}\n   ${forceMark}${oldShort}..${newShort}  ${branchName} -> ${branchName}`,
      success: true,
    };
  }
  return {
    output: `To ${remoteName}\n * [new branch]      ${branchName} -> ${branchName}`,
    success: true,
  };
}

// ─── git fetch ───────────────────────────────────────────────────────────────

export async function fetchCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const nonFlagArgs = args.filter(a => a != null && !a.startsWith('-'));
  const fetchAll = args.includes('--all');

  const remoteNames = fetchAll
    ? [...engine.remotes.keys()]
    : [nonFlagArgs[0] || 'origin'];

  const outputLines: string[] = [];

  for (const remoteName of remoteNames) {
    const remote = engine.remotes.get(remoteName);
    if (!remote) {
      return { output: `fatal: '${remoteName}' does not appear to be a git repository`, success: false };
    }

    // List branches in remote
    let remoteBranches: string[];
    try {
      remoteBranches = await git.listBranches({ fs: engine.fs, dir: remote.dir });
    } catch {
      remoteBranches = [];
    }

    if (remoteBranches.length === 0) {
      continue;
    }

    outputLines.push(`From ${remoteName}`);

    for (const branch of remoteBranches) {
      let remoteOid: string;
      try {
        remoteOid = await git.resolveRef({ fs: engine.fs, dir: remote.dir, ref: branch });
      } catch {
        continue;
      }

      // Copy objects from remote to local
      await copyCommitHistory(engine.fs, remote.dir, engine.dir, remoteOid);

      // Check if tracking ref already existed
      let oldTrackingOid: string | null = null;
      try {
        oldTrackingOid = await git.resolveRef({
          fs: engine.fs,
          dir: engine.dir,
          ref: `refs/remotes/${remoteName}/${branch}`,
        });
      } catch {}

      // Update tracking ref
      try {
        await engine.fs.promises.mkdir(`${engine.dir}/.git/refs/remotes`);
      } catch {}
      try {
        await engine.fs.promises.mkdir(`${engine.dir}/.git/refs/remotes/${remoteName}`);
      } catch {}
      await git.writeRef({
        fs: engine.fs,
        dir: engine.dir,
        ref: `refs/remotes/${remoteName}/${branch}`,
        value: remoteOid,
        force: true,
      });

      if (!oldTrackingOid) {
        outputLines.push(` * [new branch]      ${branch}     -> ${remoteName}/${branch}`);
      } else if (oldTrackingOid !== remoteOid) {
        outputLines.push(`   ${oldTrackingOid.slice(0, 7)}..${remoteOid.slice(0, 7)}  ${branch}     -> ${remoteName}/${branch}`);
      }
    }
  }

  return { output: outputLines.join('\n'), success: true };
}

// ─── git pull ────────────────────────────────────────────────────────────────

export async function pullCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const nonFlagArgs = args.filter(a => a != null && !a.startsWith('-'));
  const remoteName = nonFlagArgs[0] || 'origin';
  const branchArg = nonFlagArgs[1];

  // Step 1: fetch
  const fetchResult = await fetchCommand(
    nonFlagArgs.length > 0 ? [remoteName] : [],
    engine,
  );
  if (!fetchResult.success) {
    return fetchResult;
  }

  // Determine current branch
  const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
  if (!currentBranch) {
    return { output: 'fatal: not on a branch', success: false };
  }

  const mergeBranch = branchArg || currentBranch;

  // Step 2: get tracking ref OID
  let trackingOid: string;
  try {
    trackingOid = await git.resolveRef({
      fs: engine.fs,
      dir: engine.dir,
      ref: `refs/remotes/${remoteName}/${mergeBranch}`,
    });
  } catch {
    return {
      output: `There is no tracking information for the current branch.\nPlease specify which branch you wish to merge with.`,
      success: false,
    };
  }

  // Step 3: get current HEAD
  let headOid: string;
  try {
    headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
  } catch {
    return { output: 'fatal: no commits on current branch', success: false };
  }

  // Already up to date?
  if (headOid === trackingOid) {
    const output = fetchResult.output
      ? fetchResult.output + '\nAlready up to date.'
      : 'Already up to date.';
    return { output, success: true };
  }

  // Step 4: merge tracking ref into current branch
  try {
    const result = await git.merge({
      fs: engine.fs,
      dir: engine.dir,
      theirs: `refs/remotes/${remoteName}/${mergeBranch}`,
      author: {
        name: engine.configStore.get('user.name') || 'Player',
        email: engine.configStore.get('user.email') || 'player@gitvana.dev',
      },
      abortOnConflict: false,
    });

    if (result.alreadyMerged) {
      const output = fetchResult.output
        ? fetchResult.output + '\nAlready up to date.'
        : 'Already up to date.';
      return { output, success: true };
    }

    if (result.fastForward) {
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: currentBranch,
      });
      const output = fetchResult.output
        ? fetchResult.output + '\nUpdating...\nFast-forward'
        : 'Updating...\nFast-forward';
      return { output, success: true };
    }

    // Successful 3-way merge — checkout to update working dir
    await git.checkout({
      fs: engine.fs,
      dir: engine.dir,
      ref: currentBranch,
    });

    const output = fetchResult.output
      ? fetchResult.output + `\nMerge made by the 'ort' strategy.`
      : `Merge made by the 'ort' strategy.`;
    return { output, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle merge conflicts
    if (message.includes('conflict') || message.includes('Merge') || message.includes('Could not merge')) {
      try {
        const theirOid = trackingOid;
        const [baseOid] = await git.findMergeBase({
          fs: engine.fs,
          dir: engine.dir,
          oids: [headOid, theirOid],
        });

        const conflictFiles = await writeConflictMarkers(
          engine,
          headOid,
          theirOid,
          currentBranch,
          `${remoteName}/${mergeBranch}`,
          baseOid,
        );

        // Store MERGE_HEAD
        await engine.fs.promises.writeFile(
          `${engine.dir}/.git/MERGE_HEAD`,
          theirOid + '\n',
          'utf8',
        );

        if (conflictFiles.length > 0) {
          const conflictOutput = conflictFiles
            .map(f => `CONFLICT (content): Merge conflict in ${f}`)
            .join('\n');
          const output = fetchResult.output
            ? fetchResult.output + `\nAuto-merging failed; fix conflicts and then commit the result.\n${conflictOutput}`
            : `Auto-merging failed; fix conflicts and then commit the result.\n${conflictOutput}`;
          return { output, success: false };
        }

        // Clean merge from pull — stage and commit
        const statusMatrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
        for (const [filepath, , workdir] of statusMatrix) {
          if (workdir === 2) {
            await git.add({ fs: engine.fs, dir: engine.dir, filepath });
          } else if (workdir === 0) {
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
          }
        }

        const mergeHead = (await engine.fs.promises.readFile(
          `${engine.dir}/.git/MERGE_HEAD`,
          'utf8',
        ) as string).trim();

        await git.commit({
          fs: engine.fs,
          dir: engine.dir,
          message: `Merge branch '${mergeBranch}' of ${remoteName}`,
          author: {
            name: engine.configStore.get('user.name') || 'Player',
            email: engine.configStore.get('user.email') || 'player@gitvana.dev',
          },
          parent: [headOid, mergeHead],
        });

        try { await engine.fs.promises.unlink(`${engine.dir}/.git/MERGE_HEAD`); } catch {}

        const output = fetchResult.output
          ? fetchResult.output + `\nMerge made by the 'ort' strategy.`
          : `Merge made by the 'ort' strategy.`;
        return { output, success: true };
      } catch {
        return {
          output: `Auto-merging failed; fix conflicts and then commit the result.\nCONFLICT (content): Merge conflict`,
          success: false,
        };
      }
    }

    return { output: `error: ${message}`, success: false };
  }
}
