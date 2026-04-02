import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function stashCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const subcommand = args[0] || 'push';

  switch (subcommand) {
    case 'push':
      return stashPush(engine);
    case 'pop':
      return stashPop(engine);
    case 'apply':
      return stashApply(args.slice(1), engine);
    case 'list':
      return stashList(engine);
    case 'drop':
      return stashDrop(args.slice(1), engine);
    default:
      return { output: `error: unknown stash subcommand '${subcommand}'`, success: false };
  }
}

async function stashPush(engine: GitEngine): Promise<CommandResult> {
  try {
    const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });

    // Find files with uncommitted changes
    // head=0,workdir=2 -> untracked new file
    // head=1,workdir=2,stage!=head -> modified
    // head=1,workdir=0 -> deleted
    // head!=stage -> staged change
    const changedFiles = matrix.filter(([, head, workdir, stage]) => {
      return !(head === 1 && workdir === 1 && stage === 1);
    });

    if (changedFiles.length === 0) {
      return { output: 'No local changes to save', success: false };
    }

    // Save the changed files' contents
    const files = new Map<string, string>();
    const deletedFiles: string[] = [];

    for (const [filepath, , workdir] of changedFiles) {
      if (workdir === 0) {
        // File was deleted in working dir
        deletedFiles.push(filepath);
        files.set(filepath, '\0DELETED');
      } else {
        try {
          const content = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
          files.set(filepath, content);
        } catch { /* skip */ }
      }
    }

    const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir }) || 'main';

    // Push onto stash stack (newest at front)
    engine.stashStack.unshift({
      files,
      branch,
      message: `WIP on ${branch}`,
    });

    // Reset working directory to HEAD
    const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
    if (currentBranch) {
      await git.checkout({
        fs: engine.fs,
        dir: engine.dir,
        ref: currentBranch,
        force: true,
      });
    }

    // Remove untracked files that were stashed
    for (const [filepath, head] of changedFiles) {
      if (head === 0) {
        try {
          await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
        } catch { /* already gone */ }
      }
    }

    return {
      output: `Saved working directory and index state WIP on ${branch}`,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}

async function stashPop(engine: GitEngine): Promise<CommandResult> {
  if (engine.stashStack.length === 0) {
    return { output: 'error: no stash entries found', success: false };
  }

  const entry = engine.stashStack.shift()!;

  try {
    // Restore saved files
    for (const [filepath, content] of entry.files) {
      if (content === '\0DELETED') {
        // File was deleted - delete it again
        try {
          await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
        } catch { /* already gone */ }
      } else {
        await engine.fs.promises.writeFile(`${engine.dir}/${filepath}`, content, 'utf8');
      }
    }

    return {
      output: `Applied stash and dropped stash@{0}`,
      success: true,
    };
  } catch (err) {
    // If applying fails, push back onto stack
    engine.stashStack.unshift(entry);
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}

async function stashApply(args: string[], engine: GitEngine): Promise<CommandResult> {
  if (engine.stashStack.length === 0) {
    return { output: 'error: no stash entries found', success: false };
  }

  // Parse stash@{N} or default to 0
  let index = 0;
  if (args[0]) {
    const match = args[0].match(/^stash@\{(\d+)\}$/);
    if (match) {
      index = parseInt(match[1], 10);
    } else {
      const parsed = parseInt(args[0], 10);
      if (!isNaN(parsed)) index = parsed;
    }
  }

  if (index < 0 || index >= engine.stashStack.length) {
    return { output: `error: stash@{${index}} does not exist`, success: false };
  }

  const entry = engine.stashStack[index];

  try {
    // Restore saved files (same as pop, but don't remove from stack)
    for (const [filepath, content] of entry.files) {
      if (content === '\0DELETED') {
        try {
          await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
        } catch { /* already gone */ }
      } else {
        await engine.fs.promises.writeFile(`${engine.dir}/${filepath}`, content, 'utf8');
      }
    }

    return {
      output: `Applied stash@{${index}}`,
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { output: `error: ${message}`, success: false };
  }
}

function stashList(engine: GitEngine): CommandResult {
  if (engine.stashStack.length === 0) {
    return { output: 'No stash entries', success: true };
  }

  const lines = engine.stashStack.map((entry, i) =>
    `stash@{${i}}: On ${entry.branch}: ${entry.message}`
  );

  return { output: lines.join('\n'), success: true };
}

function stashDrop(args: string[], engine: GitEngine): CommandResult {
  if (engine.stashStack.length === 0) {
    return { output: 'error: no stash entries found', success: false };
  }

  // Parse stash@{N} or default to 0
  let index = 0;
  if (args[0]) {
    const match = args[0].match(/^stash@\{(\d+)\}$/);
    if (match) {
      index = parseInt(match[1], 10);
    } else {
      const parsed = parseInt(args[0], 10);
      if (!isNaN(parsed)) index = parsed;
    }
  }

  if (index < 0 || index >= engine.stashStack.length) {
    return { output: `error: stash@{${index}} does not exist`, success: false };
  }

  engine.stashStack.splice(index, 1);

  return {
    output: `Dropped stash@{${index}}`,
    success: true,
  };
}
