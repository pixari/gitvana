import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function blameCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  const filepath = args.filter((a) => a != null && !a.startsWith('-'))[0];

  if (!filepath) {
    return { output: 'fatal: no file specified', success: false };
  }

  // Read the current file content
  let currentContent: string;
  try {
    currentContent = await engine.fs.promises.readFile(`${engine.dir}/${filepath}`, 'utf8') as string;
  } catch {
    return { output: `fatal: no such path '${filepath}' in the working tree`, success: false };
  }

  const currentLines = currentContent.split('\n');
  // Remove trailing empty line from final newline
  if (currentLines.length > 0 && currentLines[currentLines.length - 1] === '') {
    currentLines.pop();
  }

  if (currentLines.length === 0) {
    return { output: '', success: true };
  }

  // Get commit history for the file
  let commits: Awaited<ReturnType<typeof git.log>>;
  try {
    commits = await git.log({ fs: engine.fs, dir: engine.dir, filepath });
  } catch {
    // If log fails (e.g. file not committed), attribute all lines to uncommitted
    const lines = currentLines.map((line, i) => {
      const lineNum = String(i + 1).padStart(3);
      return `00000000 (Not Committed Yet) ${lineNum}) ${line}`;
    });
    return { output: lines.join('\n'), success: true };
  }

  if (commits.length === 0) {
    const lines = currentLines.map((line, i) => {
      const lineNum = String(i + 1).padStart(3);
      return `00000000 (Not Committed Yet) ${lineNum}) ${line}`;
    });
    return { output: lines.join('\n'), success: true };
  }

  // Build a map of file content at each commit
  const contentAtCommit: Map<string, string[]> = new Map();
  for (const commit of commits) {
    try {
      const { tree } = await git.readTree({ fs: engine.fs, dir: engine.dir, oid: commit.oid });
      const entry = tree.find((e) => e.path === filepath);
      if (entry) {
        const { blob } = await git.readBlob({ fs: engine.fs, dir: engine.dir, oid: entry.oid });
        const content = new TextDecoder().decode(blob);
        const lines = content.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }
        contentAtCommit.set(commit.oid, lines);
      }
    } catch { /* skip */ }
  }

  // For each line in the current content, find the commit that introduced it.
  // Walk commits from newest to oldest. A line is "blamed" on the oldest commit
  // where it appears unchanged compared to the next newer version.
  const blameOids: string[] = new Array(currentLines.length);

  // Default: attribute to the most recent commit
  const newestOid = commits[0].oid;
  blameOids.fill(newestOid);

  for (let lineIdx = 0; lineIdx < currentLines.length; lineIdx++) {
    const targetLine = currentLines[lineIdx];

    // Walk from newest to oldest
    let attributedOid = newestOid;
    for (let ci = 0; ci < commits.length; ci++) {
      const commitLines = contentAtCommit.get(commits[ci].oid);
      if (!commitLines) continue;

      // Check if this line exists in this commit's version
      const lineExistsHere = commitLines.includes(targetLine);

      if (lineExistsHere) {
        attributedOid = commits[ci].oid;

        // Check if the line also exists in the parent (next older commit)
        if (ci + 1 < commits.length) {
          const parentLines = contentAtCommit.get(commits[ci + 1].oid);
          if (parentLines && parentLines.includes(targetLine)) {
            // Line existed in parent too, keep going
            continue;
          }
        }
        // Line was introduced in this commit (not in parent)
        break;
      } else {
        // Line doesn't exist at this commit, so it must have been introduced
        // in a newer commit - use the last attributed one
        break;
      }
    }
    blameOids[lineIdx] = attributedOid;
  }

  // Build commit info lookup
  const commitInfo = new Map<string, { shortOid: string; author: string; date: string }>();
  for (const c of commits) {
    const date = new Date(c.commit.author.timestamp * 1000);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    commitInfo.set(c.oid, {
      shortOid: c.oid.slice(0, 7),
      author: c.commit.author.name,
      date: dateStr,
    });
  }

  // Format output
  const outputLines: string[] = [];
  // Find the max author name length for alignment
  const maxAuthorLen = Math.max(...Array.from(commitInfo.values()).map((c) => c.author.length), 3);

  for (let i = 0; i < currentLines.length; i++) {
    const info = commitInfo.get(blameOids[i]);
    if (info) {
      const author = info.author.padEnd(maxAuthorLen);
      const lineNum = String(i + 1).padStart(3);
      outputLines.push(`${info.shortOid} (${author} ${info.date}) ${lineNum}) ${currentLines[i]}`);
    } else {
      const lineNum = String(i + 1).padStart(3);
      outputLines.push(`00000000 (${'???'.padEnd(maxAuthorLen)} ????) ${lineNum}) ${currentLines[i]}`);
    }
  }

  return { output: outputLines.join('\n'), success: true };
}
