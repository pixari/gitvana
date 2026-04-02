import git from 'isomorphic-git';
import type { GitEngine } from '../GitEngine.js';
import type { CommandResult } from '../types.js';

export async function mvCommand(args: string[], engine: GitEngine): Promise<CommandResult> {
  // Filter out flags
  const positional = args.filter(a => !a.startsWith('-'));

  if (positional.length < 2) {
    return {
      output: 'usage: git mv <source> <destination>',
      success: false,
    };
  }

  const source = positional[0];
  const dest = positional[1];
  const srcPath = `${engine.dir}/${source}`;
  const destPath = `${engine.dir}/${dest}`;

  // Check source exists
  try {
    await engine.fs.promises.stat(srcPath);
  } catch {
    return {
      output: `fatal: bad source, source=${source}, destination=${dest}`,
      success: false,
    };
  }

  // Check dest doesn't already exist
  try {
    await engine.fs.promises.stat(destPath);
    return {
      output: `fatal: destination exists, source=${source}, destination=${dest}`,
      success: false,
    };
  } catch {
    // Good, dest doesn't exist
  }

  // Read the file content
  const content = await engine.fs.promises.readFile(srcPath);

  // Ensure parent directories of dest exist
  const destParts = dest.split('/');
  if (destParts.length > 1) {
    let dir = engine.dir;
    for (const part of destParts.slice(0, -1)) {
      dir = `${dir}/${part}`;
      try { await engine.fs.promises.mkdir(dir); } catch { /* exists */ }
    }
  }

  // Write to new location
  await engine.fs.promises.writeFile(destPath, content);

  // Delete old file
  await engine.fs.promises.unlink(srcPath);

  // Stage the removal of the old file
  await git.remove({ fs: engine.fs, dir: engine.dir, filepath: source });

  // Stage the addition of the new file
  await git.add({ fs: engine.fs, dir: engine.dir, filepath: dest });

  return {
    output: `${source} -> ${dest}`,
    success: true,
  };
}
