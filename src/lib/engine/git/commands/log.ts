import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function logCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const oneline = args.includes('--oneline');
  const allBranches = args.includes('--all');
  const graph = args.includes('--graph');
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

  // Parse ref argument: first non-flag arg that isn't a value for -n/--max-count/--author/--grep
  const flagsWithValues = new Set(['-n', '--max-count', '--author', '--grep']);
  const knownFlags = new Set(['--oneline', '--all', '--graph', '-n', '--max-count', '--author', '--grep']);
  let refArg: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (flagsWithValues.has(args[i])) {
      i++; // skip the value
      continue;
    }
    if (args[i].startsWith('-')) continue;
    if (args[i - 1] && flagsWithValues.has(args[i - 1])) continue;
    // Check if it looks like an --arg=value (already handled above)
    if (args[i].startsWith('--author=') || args[i].startsWith('--grep=')) continue;
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

    if (commits.length === 0) {
      return { output: 'fatal: your current branch does not have any commits yet', success: false };
    }

    if (oneline) {
      const prefix = graph ? '* ' : '';
      const lines = commits.map((c) => `${prefix}${c.oid.slice(0, 7)} ${c.commit.message.split('\n')[0]}`);
      return { output: lines.join('\n'), success: true };
    }

    const lines: string[] = [];
    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      const isLast = i === commits.length - 1;
      if (graph) {
        lines.push(`* commit ${c.oid}`);
        lines.push(`| Author: ${c.commit.author.name} <${c.commit.author.email}>`);
        const date = new Date(c.commit.author.timestamp * 1000);
        lines.push(`| Date:   ${date.toUTCString()}`);
        lines.push('|');
        lines.push(`|     ${c.commit.message.trim()}`);
        lines.push(isLast ? '' : '|');
      } else {
        lines.push(`commit ${c.oid}`);
        lines.push(`Author: ${c.commit.author.name} <${c.commit.author.email}>`);
        const date = new Date(c.commit.author.timestamp * 1000);
        lines.push(`Date:   ${date.toUTCString()}`);
        lines.push('');
        lines.push(`    ${c.commit.message.trim()}`);
        lines.push('');
      }
    }

    return { output: lines.join('\n'), success: true };
  } catch {
    return { output: 'fatal: your current branch does not have any commits yet', success: false };
  }
}
