import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef } from '../ref-resolver.js';

export async function restoreCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const staged = args.includes('--staged');

  // Parse --source=<ref> or --source <ref>
  let source: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--source=')) {
      source = args[i].slice('--source='.length);
    } else if (args[i] === '--source' && i + 1 < args.length) {
      source = args[i + 1];
    }
  }

  // Collect file paths (non-flag args, excluding --source value)
  const files: string[] = [];
  const flagsWithValues = new Set(['--source']);
  for (let i = 0; i < args.length; i++) {
    if (flagsWithValues.has(args[i])) {
      i++; // skip value
      continue;
    }
    if (args[i] == null || args[i].startsWith('-')) continue;
    if (args[i - 1] && flagsWithValues.has(args[i - 1])) continue;
    if (args[i].startsWith('--source=')) continue;
    files.push(args[i]);
  }

  if (files.length === 0) {
    return { output: 'fatal: you must specify path(s) to restore', success: false };
  }

  const results: string[] = [];

  for (const filepath of files) {
    try {
      if (source) {
        // git restore --source=<ref> <file> — restore from a specific commit
        const oid = await resolveRef(source, engine);
        const content = await readFileFromCommit(engine, oid, filepath);
        if (content === null) {
          results.push(`error: pathspec '${filepath}' did not match any file(s) in '${source}'`);
          continue;
        }
        await engine.fs.promises.writeFile(`${engine.dir}/${filepath}`, content, 'utf8');
        if (staged) {
          await git.add({ fs: engine.fs, dir: engine.dir, filepath });
        }
      } else if (staged) {
        // git restore --staged <file> — unstage (move from index back, restore HEAD version in index)
        // This is equivalent to "git reset HEAD <file>"
        try {
          // Check if file exists in HEAD
          const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
          const content = await readFileFromCommit(engine, headOid, filepath);
          if (content !== null) {
            // File exists in HEAD — reset index to HEAD version
            await git.resetIndex({ fs: engine.fs, dir: engine.dir, filepath });
          } else {
            // File is new (not in HEAD) — remove from index
            await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
          }
        } catch {
          // No HEAD yet — just remove from index
          await git.remove({ fs: engine.fs, dir: engine.dir, filepath });
        }
      } else {
        // git restore <file> — discard working directory changes (restore from index/staging)
        // Read the staged version (or HEAD if not staged) and write to working dir
        try {
          const headOid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: 'HEAD' });
          const content = await readFileFromCommit(engine, headOid, filepath);
          if (content !== null) {
            await engine.fs.promises.writeFile(`${engine.dir}/${filepath}`, content, 'utf8');
          } else {
            // File doesn't exist in HEAD — remove it
            try {
              await engine.fs.promises.unlink(`${engine.dir}/${filepath}`);
            } catch { /* already gone */ }
          }
        } catch {
          return { output: `error: could not restore '${filepath}'`, success: false };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push(`error: ${message}`);
    }
  }

  if (results.length > 0) {
    return { output: results.join('\n'), success: false };
  }

  return { output: '', success: true };
}

async function readFileFromCommit(engine: GitEngine, oid: string, filepath: string): Promise<string | null> {
  try {
    const { tree } = await git.readTree({ fs: engine.fs, dir: engine.dir, oid });

    // Handle nested paths
    const parts = filepath.split('/');
    let currentTree = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const dirEntry = currentTree.find((e) => e.path === parts[i] && e.type === 'tree');
      if (!dirEntry) return null;
      const subtree = await git.readTree({ fs: engine.fs, dir: engine.dir, oid: dirEntry.oid });
      currentTree = subtree.tree;
    }

    const fileName = parts[parts.length - 1];
    const entry = currentTree.find((e) => e.path === fileName && e.type === 'blob');
    if (!entry) return null;

    const { blob } = await git.readBlob({ fs: engine.fs, dir: engine.dir, oid: entry.oid });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}
