import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

/** Simple glob matching supporting * as wildcard */
function matchGlob(pattern: string, value: string): boolean {
  // Convert glob to regex: escape special chars, replace * with .*
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

export async function tagCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const deleteFlag = args.includes('-d') || args.includes('--delete');
  const annotatedFlag = args.includes('-a') || args.includes('--annotate');
  const listFlag = args.includes('-l') || args.includes('--list');

  // git tag -d <name>
  if (deleteFlag) {
    const name = args.filter((a) => a != null && !a.startsWith('-'))[0];
    if (!name) {
      return { output: 'fatal: tag name required', success: false };
    }
    try {
      await git.deleteTag({ fs: engine.fs, dir: engine.dir, ref: name });
      return { output: `Deleted tag '${name}'`, success: true };
    } catch {
      return { output: `error: tag '${name}' not found.`, success: false };
    }
  }

  // git tag -a <name> -m "message"
  if (annotatedFlag) {
    const nonFlagArgs: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-a' || args[i] === '--annotate' || args[i] === '-l' || args[i] === '--list' || args[i] === '-d' || args[i] === '--delete') continue;
      if (args[i] === '-m' || args[i] === '--message') {
        i++; // skip the message value
        continue;
      }
      nonFlagArgs.push(args[i]);
    }

    const name = nonFlagArgs[0];
    if (!name) {
      return { output: 'fatal: tag name required', success: false };
    }

    const mIndex = args.indexOf('-m') !== -1 ? args.indexOf('-m') : args.indexOf('--message');
    const message = mIndex !== -1 && mIndex + 1 < args.length ? args[mIndex + 1] : '';
    if (!message) {
      return { output: 'fatal: option -a requires a message (-m)', success: false };
    }

    try {
      await git.annotatedTag({
        fs: engine.fs,
        dir: engine.dir,
        ref: name,
        message,
        tagger: { name: 'Player', email: 'player@gitvana.dev' },
      });
      return { output: '', success: true };
    } catch (err) {
      return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
    }
  }

  // git tag (no args) or git tag -l [pattern] → list tags
  const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));
  if (nonFlagArgs.length === 0 || (listFlag && nonFlagArgs.length <= 1)) {
    // Parse optional pattern for -l: git tag -l "v1.*"
    let pattern: string | null = null;
    if (listFlag && nonFlagArgs.length === 1) {
      pattern = nonFlagArgs[0];
    }

    try {
      let tags = await git.listTags({ fs: engine.fs, dir: engine.dir });
      if (pattern) {
        tags = tags.filter((tag) => matchGlob(pattern!, tag));
      }
      if (tags.length === 0) {
        return { output: '', success: true };
      }
      return { output: tags.join('\n'), success: true };
    } catch {
      return { output: '', success: true };
    }
  }

  // git tag <name> [<commit>] → create lightweight tag
  const name = nonFlagArgs[0];
  const commitRef = nonFlagArgs[1];

  let targetOid: string | undefined;

  if (commitRef) {
    try {
      targetOid = await resolveRef(commitRef, engine);
    } catch {
      return { output: `fatal: not a valid object name: '${commitRef}'`, success: false };
    }
  }

  try {
    const tagOpts: Parameters<typeof git.tag>[0] = {
      fs: engine.fs,
      dir: engine.dir,
      ref: name,
    };
    if (targetOid) {
      tagOpts.object = targetOid;
    }
    await git.tag(tagOpts);
    return { output: '', success: true };
  } catch (err) {
    return { output: `error: ${err instanceof Error ? err.message : err}`, success: false };
  }
}
