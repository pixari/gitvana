import git from 'isomorphic-git';
import diff3Merge from 'diff3';
import type { GitEngine } from './GitEngine.js';

/**
 * Resolve any ref to a full OID.
 *
 * Supported forms:
 *   - HEAD
 *   - HEAD~N, branch~N, HEAD@{N}~M
 *   - HEAD@{N} (reflog)
 *   - branch name
 *   - full or short OID
 */
export async function resolveRef(ref: string, engine: GitEngine): Promise<string> {
  // Handle tilde: <baseRef>~<N>
  const tildeMatch = ref.match(/^(.+)~(\d+)$/);
  if (tildeMatch) {
    const baseRef = tildeMatch[1];
    const n = parseInt(tildeMatch[2], 10);
    const baseOid = await resolveRef(baseRef, engine); // recurse for HEAD@{N}~M
    const commits = await git.log({ fs: engine.fs, dir: engine.dir, ref: baseOid, depth: n + 1 });
    if (commits.length <= n) {
      throw new Error(`not enough commits for ${ref}`);
    }
    return commits[n].oid;
  }

  // Handle reflog: HEAD@{N}
  const reflogMatch = ref.match(/^HEAD@\{(\d+)\}$/);
  if (reflogMatch) {
    const idx = parseInt(reflogMatch[1], 10);
    if (idx >= engine.reflogEntries.length) {
      throw new Error(`Could not find ${ref}.`);
    }
    return engine.reflogEntries[idx].oid;
  }

  // HEAD or branch name
  if (ref === 'HEAD') {
    return await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
  }

  // Handle remote tracking refs: origin/main -> refs/remotes/origin/main
  if (ref.includes('/')) {
    const slashIdx = ref.indexOf('/');
    const remoteName = ref.slice(0, slashIdx);
    const branchName = ref.slice(slashIdx + 1);
    if (engine.remotes.has(remoteName)) {
      try {
        return await git.resolveRef({
          fs: engine.fs,
          dir: engine.dir,
          ref: `refs/remotes/${remoteName}/${branchName}`,
        });
      } catch {
        // Fall through to normal resolution
      }
    }
  }

  try {
    return await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref });
  } catch {
    // Try expanding a short OID
    return await git.expandOid({ fs: engine.fs, dir: engine.dir, oid: ref });
  }
}

/**
 * Read all blob files (including nested directories) at a given commit OID.
 * Returns a map of filepath -> content.
 */
export async function getFilesAtCommit(engine: GitEngine, oid: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  async function walkTree(treeOid: string, prefix: string): Promise<void> {
    try {
      const { tree } = await git.readTree({ fs: engine.fs, dir: engine.dir, oid: treeOid });
      for (const entry of tree) {
        const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;
        if (entry.type === 'blob') {
          try {
            const { blob } = await git.readBlob({ fs: engine.fs, dir: engine.dir, oid: entry.oid });
            files.set(fullPath, new TextDecoder().decode(blob));
          } catch { /* skip unreadable blobs */ }
        } else if (entry.type === 'tree') {
          await walkTree(entry.oid, fullPath);
        }
      }
    } catch { /* skip if tree can't be read */ }
  }

  await walkTree(oid, '');
  return files;
}

/**
 * Ensure parent directories exist before writing a file (needed for nested paths).
 */
async function writeFileWithDirs(engine: GitEngine, filepath: string, content: string): Promise<void> {
  const fullPath = `${engine.dir}/${filepath}`;
  const parts = filepath.split('/');
  if (parts.length > 1) {
    let dir = engine.dir;
    for (const part of parts.slice(0, -1)) {
      dir = `${dir}/${part}`;
      try { await engine.fs.promises.mkdir(dir); } catch { /* exists */ }
    }
  }
  await engine.fs.promises.writeFile(fullPath, content, 'utf8');
}

/**
 * Write conflict markers into working directory files using line-level diff3 merging.
 *
 * Performs a three-way line-level merge between base, head, and theirs. Files where
 * both sides changed the same lines get conflict markers; non-overlapping changes
 * are auto-resolved cleanly.
 *
 * @returns list of conflicted file paths
 */
export async function writeConflictMarkers(
  engine: GitEngine,
  headOid: string,
  theirOid: string,
  oursLabel: string,
  theirsLabel: string,
  baseOid?: string,
): Promise<string[]> {
  const headFiles = await getFilesAtCommit(engine, headOid);
  const theirFiles = await getFilesAtCommit(engine, theirOid);
  const baseFiles = baseOid ? await getFilesAtCommit(engine, baseOid) : new Map<string, string>();

  const conflictFiles: string[] = [];
  const allPaths = new Set([...baseFiles.keys(), ...headFiles.keys(), ...theirFiles.keys()]);

  for (const filepath of allPaths) {
    const baseContent = baseFiles.get(filepath) || '';
    const headContent = headFiles.get(filepath) || '';
    const theirContent = theirFiles.get(filepath) || '';

    // If both sides are the same, nothing to do
    if (headContent === theirContent) continue;

    // If only one side changed from base, take that side (auto-resolve)
    if (headContent === baseContent) {
      await writeFileWithDirs(engine, filepath, theirContent);
      continue;
    }
    if (theirContent === baseContent) {
      await writeFileWithDirs(engine, filepath, headContent);
      continue;
    }

    // Both sides changed from base — use line-level diff3 merge
    const baseLines = baseContent.split('\n');
    const oursLines = headContent.split('\n');
    const theirsLines = theirContent.split('\n');

    const mergeResult = diff3Merge(oursLines, baseLines, theirsLines);

    let hasConflict = false;
    const outputLines: string[] = [];

    for (const block of mergeResult) {
      if ('ok' in block) {
        outputLines.push(...block.ok);
      } else if ('conflict' in block) {
        hasConflict = true;
        outputLines.push(`<<<<<<< ${oursLabel}`);
        outputLines.push(...block.conflict.a);
        outputLines.push('=======');
        outputLines.push(...block.conflict.b);
        outputLines.push(`>>>>>>> ${theirsLabel}`);
      }
    }

    const merged = outputLines.join('\n');
    await writeFileWithDirs(engine, filepath, merged);

    if (hasConflict) {
      conflictFiles.push(filepath);
    }
  }

  return conflictFiles;
}
