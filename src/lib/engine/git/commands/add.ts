import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function addCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output: 'Nothing specified, nothing added.\nMaybe you wanted to say \'git add .\'?',
      success: false,
    };
  }

  // Check for unsupported interactive flags
  const unsupportedFlags = ['-p', '--patch', '-i', '--interactive', '-e', '--edit'];
  const foundFlag = args.find(a => unsupportedFlags.includes(a));
  if (foundFlag) {
    return {
      output: "Partial staging (git add -p) is not available in Gitvana.\nTip: Use 'edit <file>' to modify, then 'git add <file>' to stage.",
      success: false,
    };
  }

  for (const filepath of args) {
    if (filepath === '.' || filepath === '-A' || filepath === '--all') {
      try {
        const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
        for (const [file, , workdir] of matrix) {
          if (workdir === 0) {
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath: file });
          } else {
            await git.add({ fs: engine.fs, dir: engine.dir, filepath: file });
          }
        }
      } catch {
        // statusMatrix fails on empty repos — add files manually
        const entries = await engine.fs.promises.readdir(engine.dir) as string[];
        for (const file of entries) {
          if (file === '.git') continue;
          await git.add({ fs: engine.fs, dir: engine.dir, filepath: file });
        }
      }
      continue;
    }

    if (filepath === '-u' || filepath === '--update') {
      try {
        const matrix = await git.statusMatrix({ fs: engine.fs, dir: engine.dir });
        for (const [file, head, workdir] of matrix) {
          // Only stage tracked files (head !== 0), skip untracked (head === 0)
          if (head === 0) continue;
          if (workdir === 0) {
            // Deleted in working dir
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath: file });
          } else if (workdir === 2) {
            // Modified in working dir
            await git.add({ fs: engine.fs, dir: engine.dir, filepath: file });
          }
        }
      } catch {
        // empty repo — nothing tracked yet, -u is a no-op
      }
      continue;
    }

    try {
      await engine.fs.promises.stat(`${engine.dir}/${filepath}`);
      await git.add({ fs: engine.fs, dir: engine.dir, filepath });
    } catch {
      return {
        output: `fatal: pathspec '${filepath}' did not match any files`,
        success: false,
      };
    }
  }

  return { output: '', success: true };
}
