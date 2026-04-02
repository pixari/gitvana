import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';
import { getFilesAtCommit } from '../ref-resolver.js';

/** Parse an ISO date string (YYYY-MM-DD) into a Unix timestamp (seconds). Returns null on invalid input. */
function parseISODate(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

/** Compute a relative time string like "2 hours ago" from a Unix timestamp (seconds). */
function relativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}

export async function logCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const oneline = args.includes('--oneline');
  const allBranches = args.includes('--all');
  const graph = args.includes('--graph');
  const showPatch = args.includes('-p') || args.includes('--patch');
  const showStat = args.includes('--stat');
  const noMerges = args.includes('--no-merges');
  const firstParent = args.includes('--first-parent');
  const reverse = args.includes('--reverse');
  const decorate = args.includes('--decorate');
  const depthIdx = args.indexOf('-n') !== -1 ? args.indexOf('-n') : args.indexOf('--max-count');
  const depth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) || 10 : 10;

  // Parse --author=Name or --author "Name"
  let authorFilter: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--author=')) {
      authorFilter = args[i].slice('--author='.length).toLowerCase();
    } else if (args[i] === '--author' && i + 1 < args.length) {
      authorFilter = args[i + 1].toLowerCase();
    }
  }

  // Parse --grep=text or --grep "text"
  let grepFilter: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--grep=')) {
      grepFilter = args[i].slice('--grep='.length).toLowerCase();
    } else if (args[i] === '--grep' && i + 1 < args.length) {
      grepFilter = args[i + 1].toLowerCase();
    }
  }

  // Parse --since=DATE or --since DATE
  let sinceTimestamp: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--since=')) {
      sinceTimestamp = parseISODate(args[i].slice('--since='.length));
    } else if (args[i] === '--since' && i + 1 < args.length) {
      sinceTimestamp = parseISODate(args[i + 1]);
    }
  }

  // Parse --until=DATE or --until DATE
  let untilTimestamp: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--until=')) {
      untilTimestamp = parseISODate(args[i].slice('--until='.length));
    } else if (args[i] === '--until' && i + 1 < args.length) {
      untilTimestamp = parseISODate(args[i + 1]);
    }
  }

  // Parse --format="..." or --pretty=format:"..."
  let customFormat: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--format=')) {
      customFormat = args[i].slice('--format='.length);
    } else if (args[i] === '--format' && i + 1 < args.length) {
      customFormat = args[i + 1];
    } else if (args[i].startsWith('--pretty=format:')) {
      customFormat = args[i].slice('--pretty=format:'.length);
    }
  }

  // Parse ref argument: first non-flag arg that isn't a value for -n/--max-count/--author/--grep/--since/--until/--format
  const flagsWithValues = new Set(['-n', '--max-count', '--author', '--grep', '--since', '--until', '--format']);
  const knownFlags = new Set(['--oneline', '--all', '--graph', '-p', '--patch', '--stat', '-n', '--max-count', '--author', '--grep', '--since', '--until', '--format', '--no-merges', '--first-parent', '--reverse', '--decorate']);
  let refArg: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (flagsWithValues.has(args[i])) {
      i++; // skip the value
      continue;
    }
    if (args[i] == null || args[i].startsWith('-')) continue;
    if (args[i - 1] && flagsWithValues.has(args[i - 1])) continue;
    // Check if it looks like an --arg=value (already handled above)
    if (args[i].startsWith('--author=') || args[i].startsWith('--grep=') ||
        args[i].startsWith('--since=') || args[i].startsWith('--until=') ||
        args[i].startsWith('--format=') || args[i].startsWith('--pretty=')) continue;
    refArg = args[i];
    break;
  }

  try {
    let commits;
    if (allBranches) {
      // Collect commits from all branches and deduplicate by oid
      const branches = await git.listBranches({ fs: engine.fs, dir: engine.dir });
      const seen = new Set<string>();
      const allCommits: Awaited<ReturnType<typeof git.log>>[number][] = [];
      for (const branch of branches) {
        try {
          const branchCommits = await git.log({ fs: engine.fs, dir: engine.dir, ref: branch, depth });
          for (const c of branchCommits) {
            if (!seen.has(c.oid)) {
              seen.add(c.oid);
              allCommits.push(c);
            }
          }
        } catch { /* branch may not have commits */ }
      }
      allCommits.sort((a, b) => b.commit.author.timestamp - a.commit.author.timestamp);
      commits = allCommits.slice(0, depth);
    } else {
      const logOpts: { fs: typeof engine.fs; dir: string; depth: number; ref?: string } = {
        fs: engine.fs, dir: engine.dir, depth,
      };
      if (refArg) logOpts.ref = refArg;
      commits = await git.log(logOpts);
    }

    // Apply --first-parent: re-walk following only first parent
    if (firstParent && commits.length > 0) {
      const firstParentCommits: typeof commits = [];
      let current = commits[0];
      firstParentCommits.push(current);
      while (firstParentCommits.length < depth) {
        const parentOid = current.commit.parent[0];
        if (!parentOid) break;
        try {
          const parentLog = await git.log({ fs: engine.fs, dir: engine.dir, ref: parentOid, depth: 1 });
          if (parentLog.length === 0) break;
          current = parentLog[0];
          firstParentCommits.push(current);
        } catch { break; }
      }
      commits = firstParentCommits;
    }

    // Apply --no-merges: filter out merge commits (2+ parents)
    if (noMerges) {
      commits = commits.filter(c => c.commit.parent.length < 2);
    }

    // Apply --author filter
    if (authorFilter) {
      commits = commits.filter(c =>
        c.commit.author.name.toLowerCase().includes(authorFilter!) ||
        c.commit.author.email.toLowerCase().includes(authorFilter!)
      );
    }

    // Apply --grep filter
    if (grepFilter) {
      commits = commits.filter(c =>
        c.commit.message.toLowerCase().includes(grepFilter!)
      );
    }

    // Apply --since filter
    if (sinceTimestamp !== null) {
      commits = commits.filter(c => c.commit.author.timestamp >= sinceTimestamp!);
    }

    // Apply --until filter
    if (untilTimestamp !== null) {
      commits = commits.filter(c => c.commit.author.timestamp <= untilTimestamp!);
    }

    if (commits.length === 0) {
      const branch = await engine.getCurrentBranch() || 'main';
      return { output: `fatal: your current branch '${branch}' does not have any commits yet`, success: false };
    }

    // Apply --reverse: show oldest first
    if (reverse) {
      commits = commits.slice().reverse();
    }

    // Custom --format output
    if (customFormat !== null) {
      // Build ref decoration map
      const branches = await git.listBranches({ fs: engine.fs, dir: engine.dir });
      const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
      const refMap = new Map<string, string[]>();
      for (const branch of branches) {
        try {
          const oid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: branch });
          if (!refMap.has(oid)) refMap.set(oid, []);
          const label = branch === currentBranch ? `HEAD -> ${branch}` : branch;
          refMap.get(oid)!.push(label);
        } catch { /* skip */ }
      }
      // Add remote tracking refs
      for (const remoteName of engine.remotes.keys()) {
        try {
          const remoteDir = `${engine.dir}/.git/refs/remotes/${remoteName}`;
          const entries = await engine.fs.promises.readdir(remoteDir) as string[];
          for (const entry of entries) {
            try {
              const oid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: `refs/remotes/${remoteName}/${entry}` });
              if (!refMap.has(oid)) refMap.set(oid, []);
              refMap.get(oid)!.push(`${remoteName}/${entry}`);
            } catch { /* skip */ }
          }
        } catch { /* no remote refs */ }
      }

      const lines = commits.map(c => {
        let line = customFormat!;
        const refs = refMap.get(c.oid);
        const decoration = refs ? ` (${refs.join(', ')})` : '';
        line = line.replace(/%H/g, c.oid);
        line = line.replace(/%h/g, c.oid.slice(0, 7));
        line = line.replace(/%s/g, c.commit.message.split('\n')[0]);
        line = line.replace(/%an/g, c.commit.author.name);
        line = line.replace(/%ae/g, c.commit.author.email);
        line = line.replace(/%ar/g, relativeDate(c.commit.author.timestamp));
        line = line.replace(/%d/g, decoration);
        return line;
      });
      return { output: lines.join('\n'), success: true };
    }

    // Build ref decoration map for --decorate
    let refMap: Map<string, string[]> | null = null;
    if (decorate) {
      const branches = await git.listBranches({ fs: engine.fs, dir: engine.dir });
      const currentBranch = await git.currentBranch({ fs: engine.fs, dir: engine.dir });
      const tags = await git.listTags({ fs: engine.fs, dir: engine.dir }).catch(() => [] as string[]);
      refMap = new Map<string, string[]>();
      for (const branch of branches) {
        try {
          const oid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: branch });
          if (!refMap.has(oid)) refMap.set(oid, []);
          const label = branch === currentBranch ? `HEAD -> ${branch}` : branch;
          refMap.get(oid)!.push(label);
        } catch { /* skip */ }
      }
      for (const tag of tags) {
        try {
          const oid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: tag });
          if (!refMap.has(oid)) refMap.set(oid, []);
          refMap.get(oid)!.push(`tag: ${tag}`);
        } catch { /* skip */ }
      }
      // Add remote tracking refs
      for (const remoteName of engine.remotes.keys()) {
        try {
          const remoteDir = `${engine.dir}/.git/refs/remotes/${remoteName}`;
          const entries = await engine.fs.promises.readdir(remoteDir) as string[];
          for (const entry of entries) {
            try {
              const oid = await git.resolveRef({ fs: engine.fs, dir: engine.dir, ref: `refs/remotes/${remoteName}/${entry}` });
              if (!refMap.has(oid)) refMap.set(oid, []);
              refMap.get(oid)!.push(`${remoteName}/${entry}`);
            } catch { /* skip */ }
          }
        } catch { /* no remote refs */ }
      }
    }

    if (oneline) {
      const prefix = graph ? '* ' : '';
      const lines = commits.map((c) => {
        const decoration = refMap ? (refMap.get(c.oid) ? ` (${refMap.get(c.oid)!.join(', ')})` : '') : '';
        return `${prefix}${c.oid.slice(0, 7)}${decoration} ${c.commit.message.split('\n')[0]}`;
      });
      return { output: lines.join('\n'), success: true };
    }

    const lines: string[] = [];
    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      const isLast = i === commits.length - 1;
      const decoration = refMap ? (refMap.get(c.oid) ? ` (${refMap.get(c.oid)!.join(', ')})` : '') : '';
      if (graph) {
        lines.push(`* commit ${c.oid}${decoration}`);
        lines.push(`| Author: ${c.commit.author.name} <${c.commit.author.email}>`);
        const date = new Date(c.commit.author.timestamp * 1000);
        lines.push(`| Date:   ${date.toUTCString()}`);
        lines.push('|');
        lines.push(`|     ${c.commit.message.trim()}`);
        lines.push(isLast ? '' : '|');
      } else {
        lines.push(`commit ${c.oid}${decoration}`);
        lines.push(`Author: ${c.commit.author.name} <${c.commit.author.email}>`);
        const date = new Date(c.commit.author.timestamp * 1000);
        lines.push(`Date:   ${date.toUTCString()}`);
        lines.push('');
        lines.push(`    ${c.commit.message.trim()}`);
        lines.push('');
      }

      if (showStat) {
        const stat = await generateLogStat(engine, c);
        if (stat) {
          lines.push(stat);
          lines.push('');
        }
      }

      if (showPatch) {
        const diff = await generateLogDiff(engine, c);
        if (diff) {
          lines.push(diff);
          lines.push('');
        }
      }
    }

    return { output: lines.join('\n'), success: true };
  } catch {
    const branch = await engine.getCurrentBranch() || 'main';
    return { output: `fatal: your current branch '${branch}' does not have any commits yet`, success: false };
  }
}

async function generateLogDiff(
  engine: GitEngine,
  commit: Awaited<ReturnType<typeof git.log>>[number],
): Promise<string> {
  const commitFiles = await getFilesAtCommit(engine, commit.oid);
  const parentOid = commit.commit.parent[0];
  const parentFiles = parentOid ? await getFilesAtCommit(engine, parentOid) : new Map<string, string>();

  const allPaths = new Set([...parentFiles.keys(), ...commitFiles.keys()]);
  const diffLines: string[] = [];

  for (const filepath of [...allPaths].sort()) {
    const oldContent = parentFiles.get(filepath);
    const newContent = commitFiles.get(filepath);

    if (oldContent === newContent) continue;

    if (oldContent === undefined) {
      diffLines.push(`diff --git a/${filepath} b/${filepath}`);
      diffLines.push('new file');
      diffLines.push(`--- /dev/null`);
      diffLines.push(`+++ b/${filepath}`);
      for (const line of (newContent || '').split('\n')) {
        diffLines.push(`+${line}`);
      }
    } else if (newContent === undefined) {
      diffLines.push(`diff --git a/${filepath} b/${filepath}`);
      diffLines.push('deleted file');
      diffLines.push(`--- a/${filepath}`);
      diffLines.push(`+++ /dev/null`);
      for (const line of oldContent.split('\n')) {
        diffLines.push(`-${line}`);
      }
    } else {
      diffLines.push(`diff --git a/${filepath} b/${filepath}`);
      diffLines.push(`--- a/${filepath}`);
      diffLines.push(`+++ b/${filepath}`);
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        const ol = i < oldLines.length ? oldLines[i] : undefined;
        const nl = i < newLines.length ? newLines[i] : undefined;
        if (ol === nl) {
          diffLines.push(` ${ol}`);
        } else {
          if (ol !== undefined) diffLines.push(`-${ol}`);
          if (nl !== undefined) diffLines.push(`+${nl}`);
        }
      }
    }
  }

  return diffLines.join('\n');
}

async function generateLogStat(
  engine: GitEngine,
  commit: Awaited<ReturnType<typeof git.log>>[number],
): Promise<string> {
  const commitFiles = await getFilesAtCommit(engine, commit.oid);
  const parentOid = commit.commit.parent[0];
  const parentFiles = parentOid ? await getFilesAtCommit(engine, parentOid) : new Map<string, string>();

  const allPaths = new Set([...parentFiles.keys(), ...commitFiles.keys()]);
  const fileStats: { name: string; added: number; removed: number }[] = [];

  for (const filepath of [...allPaths].sort()) {
    const oldContent = parentFiles.get(filepath);
    const newContent = commitFiles.get(filepath);

    if (oldContent === newContent) continue;

    const oldLines = oldContent ? oldContent.split('\n').filter(Boolean) : [];
    const newLines = newContent ? newContent.split('\n').filter(Boolean) : [];

    // Simple line-count based stat
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
