import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function logCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const oneline = args.includes('--oneline');
  const allBranches = args.includes('--all');
  const graph = args.includes('--graph');
  const depthIdx = args.indexOf('-n') !== -1 ? args.indexOf('-n') : args.indexOf('--max-count');
  const depth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) || 10 : 10;

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
      commits = await git.log({ fs: engine.fs, dir: engine.dir, depth });
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
