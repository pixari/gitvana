import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function updateRefCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const deleteFlag = args.includes('-d');

  if (deleteFlag) {
    const refName = args.filter((a) => a != null && !a.startsWith('-'))[0];
    if (!refName) {
      return { output: 'usage: git update-ref -d <ref>', success: false };
    }

    // Handle HEAD specially — delete the current branch ref
    if (refName === 'HEAD') {
      try {
        const branch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
        if (branch) {
          await engine.fs.promises.unlink(`${engine.dir}/.git/refs/heads/${branch}`);
          return { output: '', success: true };
        } else {
          return { output: 'fatal: HEAD is detached', success: false };
        }
      } catch (err) {
        return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
      }
    }

    // Delete any other ref
    try {
      await git.deleteRef({ fs: engine.fs, dir: engine.dir, ref: refName });
      return { output: '', success: true };
    } catch (err) {
      return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
    }
  }

  // git update-ref <ref> <newvalue>
  const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));
  if (nonFlagArgs.length >= 2) {
    const refName = nonFlagArgs[0];
    const newValue = nonFlagArgs[1];

    try {
      const oid = await resolveRef(newValue, engine);
      await git.writeRef({
        fs: engine.fs,
        dir: engine.dir,
        ref: refName,
        value: oid,
        force: true,
      });
      return { output: '', success: true };
    } catch (err) {
      return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
    }
  }

  return { output: 'usage: git update-ref [-d] <ref> [<newvalue>]', success: false };
}
