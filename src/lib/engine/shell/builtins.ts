import type FS from '@isomorphic-git/lightning-fs';

type FsLike = FS;

export interface BuiltinResult {
  output: string;
  success: boolean;
}

export async function runBuiltin(
  command: string,
  args: string[],
  fs: FsLike,
  cwd: string,
): Promise<BuiltinResult> {
  switch (command) {
    case 'ls':
      return lsCommand(args, fs, cwd);
    case 'cat':
      return catCommand(args, fs, cwd);
    case 'mkdir':
      return mkdirCommand(args, fs, cwd);
    case 'touch':
      return touchCommand(args, fs, cwd);
    case 'pwd':
      return { output: cwd, success: true };
    case 'clear':
      return { output: '\x1b[2J\x1b[H', success: true };
    case 'echo':
      return echoCommand(args, fs, cwd);
    case 'rm':
      return rmCommand(args, fs, cwd);
    case 'grep':
      return grepCommand(args, fs, cwd);
    case 'cd':
      return cdCommand(args);
    case 'head':
      return headCommand(args, fs, cwd);
    case 'tail':
      return tailCommand(args, fs, cwd);
    case 'wc':
      return wcCommand(args, fs, cwd);
    default:
      return { output: `${command}: command not found`, success: false };
  }
}

function resolvePath(filepath: string, cwd: string): string {
  if (filepath.startsWith('/')) return filepath;
  return `${cwd}/${filepath}`.replace(/\/+/g, '/');
}

async function lsCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
  const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
  const dir = args.filter((a) => !a.startsWith('-'))[0] || '.';
  const targetPath = resolvePath(dir, cwd);

  try {
    const entries = await fs.promises.readdir(targetPath) as string[];
    let filtered = entries.filter((e: string) => showAll || !e.startsWith('.'));
    filtered = filtered.sort();

    if (long) {
      const lines: string[] = [];
      for (const entry of filtered) {
        try {
          const stat = await fs.promises.stat(`${targetPath}/${entry}`) as { type: string; size: number };
          const isDir = stat.type === 'dir';
          const size = String(stat.size || 0).padStart(6);
          lines.push(`${isDir ? 'd' : '-'}rw-r--r--  ${size}  ${entry}`);
        } catch {
          lines.push(`?  ${entry}`);
        }
      }
      return { output: lines.join('\n'), success: true };
    }

    return { output: filtered.join('  '), success: true };
  } catch {
    return { output: `ls: cannot access '${dir}': No such file or directory`, success: false };
  }
}

async function catCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  if (args.length === 0) {
    return { output: 'cat: missing file operand', success: false };
  }

  const filepath = resolvePath(args[0], cwd);
  try {
    const content = await fs.promises.readFile(filepath, 'utf8');
    return { output: content as string, success: true };
  } catch {
    return { output: `cat: ${args[0]}: No such file or directory`, success: false };
  }
}

async function mkdirCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const recursive = args.includes('-p');
  const dirs = args.filter((a) => !a.startsWith('-'));

  for (const dir of dirs) {
    const dirPath = resolvePath(dir, cwd);
    try {
      if (recursive) {
        // lightning-fs doesn't support recursive, so create each part
        const parts = dirPath.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
          current += '/' + part;
          try { await fs.promises.mkdir(current); } catch { /* exists */ }
        }
      } else {
        await fs.promises.mkdir(dirPath);
      }
    } catch {
      return { output: `mkdir: cannot create directory '${dir}'`, success: false };
    }
  }

  return { output: '', success: true };
}

async function touchCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  if (args.length === 0) {
    return { output: 'touch: missing file operand', success: false };
  }

  for (const file of args) {
    const filepath = resolvePath(file, cwd);
    try {
      await fs.promises.stat(filepath);
    } catch {
      await fs.promises.writeFile(filepath, '');
    }
  }

  return { output: '', success: true };
}

async function echoCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const raw = args.join(' ');

  // Handle redirect: echo "content" > file
  const redirectMatch = raw.match(/^(.*?)\s*>\s*(.+)$/);
  if (redirectMatch) {
    const content = redirectMatch[1].replace(/^["']|["']$/g, '');
    const filepath = resolvePath(redirectMatch[2].trim(), cwd);
    try {
      await fs.promises.writeFile(filepath, content + '\n');
      return { output: '', success: true };
    } catch {
      return { output: `echo: cannot write to '${redirectMatch[2]}'`, success: false };
    }
  }

  // Handle append: echo "content" >> file
  const appendMatch = raw.match(/^(.*?)\s*>>\s*(.+)$/);
  if (appendMatch) {
    const content = appendMatch[1].replace(/^["']|["']$/g, '');
    const filepath = resolvePath(appendMatch[2].trim(), cwd);
    try {
      const existing = await fs.promises.readFile(filepath, 'utf8').catch(() => '');
      await fs.promises.writeFile(filepath, existing + content + '\n');
      return { output: '', success: true };
    } catch {
      return { output: `echo: cannot write to '${appendMatch[2]}'`, success: false };
    }
  }

  return { output: raw.replace(/^["']|["']$/g, ''), success: true };
}

async function rmCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const files = args.filter((a) => !a.startsWith('-'));
  for (const file of files) {
    const filepath = resolvePath(file, cwd);
    try {
      await fs.promises.unlink(filepath);
    } catch {
      return { output: `rm: cannot remove '${file}': No such file or directory`, success: false };
    }
  }
  return { output: '', success: true };
}

async function grepCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const caseInsensitive = args.includes('-i');
  const recursive = args.includes('-r') || args.includes('-R');
  const nonFlagArgs = args.filter(a => !a.startsWith('-'));

  if (nonFlagArgs.length === 0) {
    return { output: 'Usage: grep [-i] [-r] "pattern" [file]', success: false };
  }

  const pattern = nonFlagArgs[0];
  const searchPattern = caseInsensitive ? pattern.toLowerCase() : pattern;

  const results: string[] = [];

  async function searchFile(filepath: string, displayName: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filepath, 'utf8') as string;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const compareLine = caseInsensitive ? line.toLowerCase() : line;
        if (compareLine.includes(searchPattern)) {
          if (recursive || nonFlagArgs.length > 2) {
            results.push(`${displayName}:${line}`);
          } else {
            results.push(line);
          }
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  async function searchDir(dirPath: string, prefix: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath) as string[];
      for (const entry of entries) {
        if (entry === '.git') continue;
        const fullPath = `${dirPath}/${entry}`;
        const displayPath = prefix ? `${prefix}/${entry}` : entry;
        try {
          const stat = await fs.promises.stat(fullPath) as { type: string };
          if (stat.type === 'dir') {
            await searchDir(fullPath, displayPath);
          } else {
            await searchFile(fullPath, displayPath);
          }
        } catch {
          await searchFile(fullPath, displayPath);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  if (recursive) {
    await searchDir(cwd, '');
  } else if (nonFlagArgs.length >= 2) {
    // grep "pattern" file1 [file2 ...]
    for (let i = 1; i < nonFlagArgs.length; i++) {
      const filepath = resolvePath(nonFlagArgs[i], cwd);
      await searchFile(filepath, nonFlagArgs[i]);
    }
  } else {
    return { output: 'Usage: grep [-i] [-r] "pattern" [file]', success: false };
  }

  if (results.length === 0) {
    return { output: '', success: false };
  }
  return { output: results.join('\n'), success: true };
}

async function headCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  let n = 10;
  const nonFlagArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-') && !isNaN(Number(args[i].slice(1)))) {
      n = Number(args[i].slice(1));
    } else if (args[i] === '-n' && i + 1 < args.length) {
      n = Number(args[i + 1]);
      i++;
    } else {
      nonFlagArgs.push(args[i]);
    }
  }

  if (nonFlagArgs.length === 0) {
    return { output: 'head: missing file operand', success: false };
  }

  const filepath = resolvePath(nonFlagArgs[0], cwd);
  try {
    const content = await fs.promises.readFile(filepath, 'utf8') as string;
    const lines = content.split('\n');
    return { output: lines.slice(0, n).join('\n'), success: true };
  } catch {
    return { output: `head: ${nonFlagArgs[0]}: No such file or directory`, success: false };
  }
}

async function tailCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  let n = 10;
  const nonFlagArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-') && !isNaN(Number(args[i].slice(1)))) {
      n = Number(args[i].slice(1));
    } else if (args[i] === '-n' && i + 1 < args.length) {
      n = Number(args[i + 1]);
      i++;
    } else {
      nonFlagArgs.push(args[i]);
    }
  }

  if (nonFlagArgs.length === 0) {
    return { output: 'tail: missing file operand', success: false };
  }

  const filepath = resolvePath(nonFlagArgs[0], cwd);
  try {
    const content = await fs.promises.readFile(filepath, 'utf8') as string;
    const lines = content.split('\n');
    return { output: lines.slice(-n).join('\n'), success: true };
  } catch {
    return { output: `tail: ${nonFlagArgs[0]}: No such file or directory`, success: false };
  }
}

async function wcCommand(args: string[], fs: FsLike, cwd: string): Promise<BuiltinResult> {
  const lineOnly = args.includes('-l');
  const nonFlagArgs = args.filter(a => !a.startsWith('-'));

  if (nonFlagArgs.length === 0) {
    return { output: 'wc: missing file operand', success: false };
  }

  const filepath = resolvePath(nonFlagArgs[0], cwd);
  try {
    const content = await fs.promises.readFile(filepath, 'utf8') as string;
    const lines = content.split('\n');
    const lineCount = content.endsWith('\n') ? lines.length - 1 : lines.length;

    if (lineOnly) {
      return { output: `${lineCount} ${nonFlagArgs[0]}`, success: true };
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const charCount = content.length;
    return { output: `  ${lineCount}  ${wordCount}  ${charCount} ${nonFlagArgs[0]}`, success: true };
  } catch {
    return { output: `wc: ${nonFlagArgs[0]}: No such file or directory`, success: false };
  }
}

function cdCommand(args: string[]): Promise<BuiltinResult> {
  const target = args[0] || '';

  if (!target || target === '~' || target === '/workspace' || target === '.') {
    return Promise.resolve({ output: '', success: true });
  }

  if (target === '..') {
    return Promise.resolve({
      output: 'Already at the root of the workspace',
      success: true,
    });
  }

  return Promise.resolve({
    output: 'Directory navigation is simplified in Gitvana. All files are in /workspace.',
    success: true,
  });
}
