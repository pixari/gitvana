import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { resolveRef, getFilesAtCommit } from '../ref-resolver.js';

export async function showCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const stat = args.includes('--stat');
  const nonFlagArgs = args.filter(a => a != null && !a.startsWith('-'));
  const ref = nonFlagArgs[0] || 'HEAD';

  // git show <commit>:<file> → show file content at a specific commit
  if (ref.includes(':')) {
    return await showFileAtCommit(engine, ref);
  }

  // git show [<commit>] → show commit details + diff (or --stat)
  return await showCommit(engine, ref, stat);
}

async function showCommit(engine: GitEngine, ref: string, stat = false): Promise<CommandResult> {
  let oid: string;
  try {
    oid = await resolveRef(ref, engine);
  } catch {
    return { output: `fatal: bad revision '${ref}'`, success: false };
  }

  try {
    const { commit } = await git.readCommit({ fs: engine.fs, dir: engine.dir, oid });

    const lines: string[] = [];
    lines.push(`\x1b[33mcommit ${oid}\x1b[0m`);
    if (commit.parent.length > 1) {
      lines.push(`Merge: ${commit.parent.map((p) => p.slice(0, 7)).join(' ')}`);
    }
    lines.push(`Author: ${commit.author.name} <${commit.author.email}>`);
    const date = new Date(commit.author.timestamp * 1000);
    lines.push(`Date:   ${date.toUTCString()}`);
    lines.push('');
    lines.push(`    ${commit.message.trim()}`);
    lines.push('');

    // Generate diff or stat against parent
    const parentOid = commit.parent[0];
    if (stat) {
      const statOutput = await generateStat(engine, parentOid || null, oid);
      if (statOutput) {
        lines.push(statOutput);
      }
    } else {
      const diff = await generateDiff(engine, parentOid || null, oid);
      if (diff) {
        lines.push(diff);
      }
    }

    return { output: lines.join('\n'), success: true };
  } catch (err) {
    return { output: `fatal: ${err instanceof Error ? err.message : err}`, success: false };
  }
}

async function showFileAtCommit(engine: GitEngine, refAndPath: string): Promise<CommandResult> {
  const colonIndex = refAndPath.indexOf(':');
  const ref = refAndPath.slice(0, colonIndex) || 'HEAD';
  const filepath = refAndPath.slice(colonIndex + 1);

  if (!filepath) {
    return { output: 'fatal: empty path specified', success: false };
  }

  let oid: string;
  try {
    oid = await resolveRef(ref, engine);
  } catch {
    return { output: `fatal: bad revision '${ref}'`, success: false };
  }

  try {
    const { tree } = await git.readTree({ fs: engine.fs, dir: engine.dir, oid });

    // Handle nested paths by walking the tree
    const parts = filepath.split('/');
    let currentTree = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const dirEntry = currentTree.find((e) => e.path === parts[i] && e.type === 'tree');
      if (!dirEntry) {
        return { output: `fatal: path '${filepath}' does not exist in '${ref}'`, success: false };
      }
      const subtree = await git.readTree({ fs: engine.fs, dir: engine.dir, oid: dirEntry.oid });
      currentTree = subtree.tree;
    }

    const fileName = parts[parts.length - 1];
    const entry = currentTree.find((e) => e.path === fileName && e.type === 'blob');
    if (!entry) {
      return { output: `fatal: path '${filepath}' does not exist in '${ref}'`, success: false };
    }

    const { blob } = await git.readBlob({ fs: engine.fs, dir: engine.dir, oid: entry.oid });
    const content = new TextDecoder().decode(blob);
    return { output: content, success: true };
  } catch (err) {
    return { output: `fatal: ${err instanceof Error ? err.message : err}`, success: false };
  }
}

async function generateStat(engine: GitEngine, parentOid: string | null, commitOid: string): Promise<string> {
  const commitFiles = await getFilesAtCommit(engine, commitOid);
  const parentFiles = parentOid ? await getFilesAtCommit(engine, parentOid) : new Map<string, string>();

  const allPaths = new Set([...parentFiles.keys(), ...commitFiles.keys()]);
  const fileStats: { name: string; added: number; removed: number }[] = [];

  for (const filepath of [...allPaths].sort()) {
    const oldContent = parentFiles.get(filepath);
    const newContent = commitFiles.get(filepath);
    if (oldContent === newContent) continue;

    const oldLines = oldContent ? oldContent.split('\n').filter(Boolean) : [];
    const newLines = newContent ? newContent.split('\n').filter(Boolean) : [];
    const added = newContent !== undefined ? newLines.length : 0;
    const removed = oldContent !== undefined ? oldLines.length : 0;
    fileStats.push({ name: filepath, added, removed });
  }

  if (fileStats.length === 0) return '';

  const lines: string[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  const maxNameLen = Math.max(...fileStats.map(f => f.name.length));

  for (const f of fileStats) {
    const changes = f.added + f.removed;
    const bar = '+'.repeat(f.added) + '-'.repeat(f.removed);
    const paddedName = f.name.padEnd(maxNameLen);
    lines.push(` ${paddedName} | ${String(changes).padStart(3)} ${bar}`);
    totalAdded += f.added;
    totalRemoved += f.removed;
  }

  const filesWord = fileStats.length === 1 ? 'file changed' : 'files changed';
  const insertions = totalAdded > 0 ? `, ${totalAdded} insertion${totalAdded !== 1 ? 's' : ''}(+)` : '';
  const deletions = totalRemoved > 0 ? `, ${totalRemoved} deletion${totalRemoved !== 1 ? 's' : ''}(-)` : '';
  lines.push(` ${fileStats.length} ${filesWord}${insertions}${deletions}`);

  return lines.join('\n');
}

async function generateDiff(engine: GitEngine, parentOid: string | null, commitOid: string): Promise<string> {
  const commitFiles = await getFilesAtCommit(engine, commitOid);
  const parentFiles = parentOid ? await getFilesAtCommit(engine, parentOid) : new Map<string, string>();

  const allPaths = new Set([...parentFiles.keys(), ...commitFiles.keys()]);
  const diffLines: string[] = [];

  for (const filepath of [...allPaths].sort()) {
    const oldContent = parentFiles.get(filepath);
    const newContent = commitFiles.get(filepath);

    if (oldContent === newContent) continue;

    if (oldContent === undefined) {
      // New file
      diffLines.push(`\x1b[1mdiff --git a/${filepath} b/${filepath}\x1b[0m`);
      diffLines.push('new file');
      diffLines.push(`--- /dev/null`);
      diffLines.push(`+++ b/${filepath}`);
      const lines = (newContent || '').split('\n');
      for (const line of lines) {
        diffLines.push(`\x1b[32m+${line}\x1b[0m`);
      }
    } else if (newContent === undefined) {
      // Deleted file
      diffLines.push(`\x1b[1mdiff --git a/${filepath} b/${filepath}\x1b[0m`);
      diffLines.push('deleted file');
      diffLines.push(`--- a/${filepath}`);
      diffLines.push(`+++ /dev/null`);
      const lines = oldContent.split('\n');
      for (const line of lines) {
        diffLines.push(`\x1b[31m-${line}\x1b[0m`);
      }
    } else {
      // Modified file
      diffLines.push(`\x1b[1mdiff --git a/${filepath} b/${filepath}\x1b[0m`);
      diffLines.push(`--- a/${filepath}`);
      diffLines.push(`+++ b/${filepath}`);
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      // Simple line-by-line diff
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        const ol = i < oldLines.length ? oldLines[i] : undefined;
        const nl = i < newLines.length ? newLines[i] : undefined;
        if (ol === nl) {
          diffLines.push(` ${ol}`);
        } else {
          if (ol !== undefined) diffLines.push(`\x1b[31m-${ol}\x1b[0m`);
          if (nl !== undefined) diffLines.push(`\x1b[32m+${nl}\x1b[0m`);
        }
      }
    }
  }

  return diffLines.join('\n');
}
