import git from 'isomorphic-git';
import type { GitEngine } from '../git/GitEngine.js';
import type { LevelDefinition, ReplayStep } from '../../../levels/schema.js';
import { eventBus } from '../events/GameEventBus.js';
import { pushCommand } from '../git/commands/remote.js';

export class LevelLoader {
  constructor(private engine: GitEngine) {}

  async load(level: LevelDefinition): Promise<void> {
    await this.engine.reset();

    // All git commands always available — users can explore freely
    this.engine.setAllowedCommands(null);
    this.engine.resetCommandCount();

    if (level.initialState.strategy === 'replay') {
      await this.replaySetup(level.initialState.replayScript || []);
    } else if (level.initialState.strategy === 'mount' && level.initialState.fileTree) {
      await this.mountFileTree(level.initialState.fileTree);
    }

    eventBus.emit('level:loaded', { levelId: level.id });
    eventBus.emit('state:changed', undefined as never);
  }

  private async replaySetup(steps: ReplayStep[]): Promise<void> {
    for (const step of steps) {
      switch (step.command) {
        case 'init':
          await git.init({ fs: this.engine.fs, dir: this.engine.dir, defaultBranch: 'main' });
          break;

        case 'writeFile': {
          const filePath = `${this.engine.dir}/${step.args.path}`;
          const parts = step.args.path.split('/');
          if (parts.length > 1) {
            let dir = this.engine.dir;
            for (const part of parts.slice(0, -1)) {
              dir = `${dir}/${part}`;
              try { await this.engine.fs.promises.mkdir(dir); } catch { /* exists */ }
            }
          }
          await this.engine.fs.promises.writeFile(filePath, step.args.content || '', 'utf8');
          break;
        }

        case 'deleteFile': {
          const deletePath = `${this.engine.dir}/${step.args.path}`;
          await this.engine.fs.promises.unlink(deletePath);
          break;
        }

        case 'add':
          await git.add({
            fs: this.engine.fs,
            dir: this.engine.dir,
            filepath: step.args.path || '.',
          });
          break;

        case 'remove':
          await git.remove({
            fs: this.engine.fs,
            dir: this.engine.dir,
            filepath: step.args.path,
          });
          break;

        case 'commit':
          await git.commit({
            fs: this.engine.fs,
            dir: this.engine.dir,
            message: step.args.message || 'commit',
            author: {
              name: step.args.author || 'Setup',
              email: step.args.email || 'setup@gitvana.dev',
            },
          });
          await this.engine.recordReflog('commit', step.args.message || 'commit');
          break;

        case 'branch':
          await git.branch({
            fs: this.engine.fs,
            dir: this.engine.dir,
            ref: step.args.name,
          });
          break;

        case 'deleteBranch':
          await git.deleteBranch({
            fs: this.engine.fs,
            dir: this.engine.dir,
            ref: step.args.name,
          });
          break;

        case 'checkout': {
          let checkoutRef = step.args.ref;
          // Handle HEAD~N by resolving to actual oid
          const headMatch = checkoutRef.match(/^HEAD~(\d+)$/);
          if (headMatch) {
            const n = parseInt(headMatch[1], 10);
            const commits = await git.log({ fs: this.engine.fs, dir: this.engine.dir, depth: n + 1 });
            if (commits.length <= n) {
              throw new Error(`Not enough commits for ${checkoutRef}`);
            }
            checkoutRef = commits[n].oid;
          }
          await git.checkout({
            fs: this.engine.fs,
            dir: this.engine.dir,
            ref: checkoutRef,
          });
          await this.engine.recordReflog('checkout', `moving to ${step.args.ref}`);
          break;
        }

        case 'merge':
          await git.merge({
            fs: this.engine.fs,
            dir: this.engine.dir,
            theirs: step.args.theirs,
            author: { name: 'Setup', email: 'setup@gitvana.dev' },
          });
          break;

        case 'remote-add': {
          const remoteName = step.args.name || 'origin';
          const remoteUrl = step.args.url || remoteName;
          await this.engine.initRemote(remoteName, remoteUrl);
          break;
        }

        case 'push': {
          const pushArgs: string[] = [];
          if (step.args.remote) pushArgs.push(step.args.remote);
          if (step.args.branch) pushArgs.push(step.args.branch);
          await pushCommand(pushArgs, this.engine);
          break;
        }

        case 'remote-commit': {
          // Write a file and commit directly in the remote repo
          const remoteName = step.args.remote || 'origin';
          const remoteInfo = this.engine.remotes.get(remoteName);
          if (!remoteInfo) throw new Error(`Remote '${remoteName}' not found`);
          const remoteDir = remoteInfo.dir;
          const filePath = `${remoteDir}/${step.args.path}`;
          // Create parent dirs
          const parts = step.args.path.split('/');
          if (parts.length > 1) {
            let dir = remoteDir;
            for (const part of parts.slice(0, -1)) {
              dir = `${dir}/${part}`;
              try { await this.engine.fs.promises.mkdir(dir); } catch { /* exists */ }
            }
          }
          await this.engine.fs.promises.writeFile(filePath, step.args.content || '', 'utf8');
          await git.add({ fs: this.engine.fs, dir: remoteDir, filepath: step.args.path });
          await git.commit({
            fs: this.engine.fs,
            dir: remoteDir,
            message: step.args.message || 'Remote commit',
            author: {
              name: step.args.author || 'Brother Guybrush',
              email: step.args.email || 'guybrush@gitvana.dev',
            },
          });
          break;
        }
      }
    }
  }

  private async mountFileTree(
    tree: Record<string, string | Record<string, unknown>>,
    basePath?: string,
  ): Promise<void> {
    const base = basePath || this.engine.dir;

    for (const [name, value] of Object.entries(tree)) {
      const fullPath = `${base}/${name}`;

      if (typeof value === 'string') {
        await this.engine.fs.promises.writeFile(fullPath, value, 'utf8');
      } else if (typeof value === 'object' && value !== null) {
        try { await this.engine.fs.promises.mkdir(fullPath); } catch { /* exists */ }
        await this.mountFileTree(value as Record<string, string | Record<string, unknown>>, fullPath);
      }
    }
  }
}
