// Polyfills for Node/Bun environment
import 'fake-indexeddb/auto';
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { test, expect, describe } from 'bun:test';
import { GitEngine } from '../src/lib/engine/git/GitEngine.js';
import { runBuiltin } from '../src/lib/engine/shell/builtins.js';

// ShellBridge passes echo its raw argument string so redirects can be parsed.
async function echo(engine: GitEngine, rawArgs: string) {
  return runBuiltin('echo', [rawArgs], engine.fs, engine.dir);
}

async function read(engine: GitEngine, name: string) {
  return engine.fs.promises.readFile(`${engine.dir}/${name}`, 'utf8') as Promise<string>;
}

async function ls(engine: GitEngine) {
  return engine.fs.promises.readdir(engine.dir);
}

describe('echo redirects', () => {
  // Regression: `>>` used to match the `>` branch first, creating a file
  // literally named "> supplies.txt" instead of appending (#54).
  test('>> appends to an existing file', async () => {
    const engine = new GitEngine();
    await engine.fs.promises.mkdir(engine.dir).catch(() => {});
    await engine.fs.promises.writeFile(`${engine.dir}/supplies.txt`, 'rope: 2\n');

    const result = await echo(engine, '"candles: 50" >> supplies.txt');

    expect(result.success).toBe(true);
    expect(await read(engine, 'supplies.txt')).toBe('rope: 2\ncandles: 50\n');
    expect(await ls(engine)).toEqual(['supplies.txt']);
  });

  test('>> without surrounding spaces appends', async () => {
    const engine = new GitEngine();
    await engine.fs.promises.mkdir(engine.dir).catch(() => {});
    await engine.fs.promises.writeFile(`${engine.dir}/supplies.txt`, 'rope: 2\n');

    await echo(engine, "'candles: 50'>>supplies.txt");

    expect(await read(engine, 'supplies.txt')).toBe('rope: 2\ncandles: 50\n');
    expect(await ls(engine)).toEqual(['supplies.txt']);
  });

  test('> overwrites the file', async () => {
    const engine = new GitEngine();
    await engine.fs.promises.mkdir(engine.dir).catch(() => {});
    await engine.fs.promises.writeFile(`${engine.dir}/supplies.txt`, 'rope: 2\n');

    await echo(engine, '"candles: 50" > supplies.txt');

    expect(await read(engine, 'supplies.txt')).toBe('candles: 50\n');
  });
});
