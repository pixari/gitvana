import git from 'isomorphic-git';
import FS from '@isomorphic-git/lightning-fs';
import type { CommandResult, CommitInfo, BranchInfo, FileStatus, RepoState } from './types.js';
import { eventBus } from '../events/GameEventBus.js';
import { soundManager } from '../../audio/SoundManager.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { commitCommand } from './commands/commit.js';
import { statusCommand } from './commands/status.js';
import { logCommand } from './commands/log.js';
import { diffCommand } from './commands/diff.js';
import { branchCommand } from './commands/branch.js';
import { checkoutCommand } from './commands/checkout.js';
import { mergeCommand } from './commands/merge.js';
import { resetCommand } from './commands/reset.js';
import { rmCommand } from './commands/rm.js';
import { tagCommand } from './commands/tag.js';
import { cherryPickCommand } from './commands/cherry-pick.js';
import { showCommand } from './commands/show.js';
import { revertCommand } from './commands/revert.js';
import { stashCommand } from './commands/stash.js';
import { reflogCommand } from './commands/reflog.js';
import { rebaseCommand } from './commands/rebase.js';
import { blameCommand } from './commands/blame.js';
import { bisectCommand } from './commands/bisect.js';
import { updateRefCommand } from './commands/update-ref.js';
import { configCommand } from './commands/config.js';
import { remoteCommand, pushCommand, pullCommand, fetchCommand } from './commands/remote.js';
import { cleanCommand } from './commands/clean.js';
import { mvCommand } from './commands/mv.js';
import { restoreCommand } from './commands/restore.js';

interface CommandHandler {
  (args: string[], engine: GitEngine): Promise<CommandResult>;
}

export interface ReflogEntry {
  oid: string;
  prevOid: string;
  action: string;
  message: string;
  timestamp: number;
}

export interface StashEntry {
  files: Map<string, string>;
  branch: string;
  message: string;
}

export class GitEngine {
  fs!: FS;
  dir = '/workspace';
  remoteDir = '/remote/origin';
  remotes: Map<string, { url: string; dir: string }> = new Map();
  private commands = new Map<string, CommandHandler>();
  private allowedCommands: Set<string> | null = null;
  private commandCount = 0;
  stashStack: StashEntry[] = [];
  reflogEntries: ReflogEntry[] = [];
  configStore: Map<string, string> = new Map([
    ['user.name', 'Player'],
    ['user.email', 'player@gitvana.dev'],
  ]);
  private snapshots: { files: Map<string, string | Uint8Array>; reflog: ReflogEntry[]; stash: StashEntry[]; remotes: Map<string, { url: string; dir: string }>; commandCount?: number }[] = [];
  private readonly MAX_SNAPSHOTS = 10;

  constructor() {
    this.createFreshFs();
    this.registerCommands();
  }

  /** Creates a brand new in-memory filesystem with a unique name and wipes IndexedDB. */
  private createFreshFs(): void {
    const name = `gitvana-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.fs = new FS(name, { wipe: true });
  }

  private registerCommands(): void {
    this.commands.set('init', initCommand);
    this.commands.set('add', addCommand);
    this.commands.set('commit', commitCommand);
    this.commands.set('status', statusCommand);
    this.commands.set('log', logCommand);
    this.commands.set('diff', diffCommand);
    this.commands.set('branch', branchCommand);
    this.commands.set('checkout', checkoutCommand);
    this.commands.set('switch', checkoutCommand);
    this.commands.set('merge', mergeCommand);
    this.commands.set('reset', resetCommand);
    this.commands.set('rm', rmCommand);
    this.commands.set('tag', tagCommand);
    this.commands.set('cherry-pick', cherryPickCommand);
    this.commands.set('show', showCommand);
    this.commands.set('revert', revertCommand);
    this.commands.set('stash', stashCommand);
    this.commands.set('reflog', reflogCommand);
    this.commands.set('rebase', rebaseCommand);
    this.commands.set('blame', blameCommand);
    this.commands.set('bisect', bisectCommand);
    this.commands.set('update-ref', updateRefCommand);
    this.commands.set('config', configCommand);
    this.commands.set('remote', remoteCommand);
    this.commands.set('push', pushCommand);
    this.commands.set('pull', pullCommand);
    this.commands.set('fetch', fetchCommand);
    this.commands.set('clean', cleanCommand);
    this.commands.set('mv', mvCommand);
    this.commands.set('restore', restoreCommand);
  }

  setAllowedCommands(commands: string[] | null): void {
    this.allowedCommands = commands ? new Set(commands) : null;
  }

  getCommandCount(): number {
    return this.commandCount;
  }

  resetCommandCount(): void {
    this.commandCount = 0;
  }

  /** Record a reflog entry capturing the current HEAD oid. */
  async recordReflog(action: string, message: string): Promise<void> {
    try {
      const oid = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
      const prevOid = this.reflogEntries.length > 0 ? this.reflogEntries[0].oid : '0000000';
      this.reflogEntries.unshift({
        oid,
        prevOid,
        action,
        message,
        timestamp: Date.now(),
      });
    } catch {
      // No HEAD yet (e.g. before first commit) — skip
    }
  }

  /** Commands that move HEAD and should be recorded in the reflog. */
  private static readonly REFLOG_COMMANDS = new Set([
    'commit', 'checkout', 'switch', 'merge', 'reset', 'cherry-pick', 'revert', 'rebase',
  ]);

  private static readonly TYPO_MAP: Record<string, string> = {
    'comit': 'commit', 'commti': 'commit', 'commt': 'commit',
    'stauts': 'status', 'staus': 'status',
    'chekout': 'checkout', 'chekcout': 'checkout',
    'brnach': 'branch', 'bracnh': 'branch',
    'mege': 'merge', 'mreage': 'merge',
    'satus': 'status', 'stahs': 'stash',
    'dif': 'diff', 'reabse': 'rebase',
    'chery-pick': 'cherry-pick', 'cherrypick': 'cherry-pick',
    'tga': 'tag', 'tags': 'tag',
    'lgo': 'log', 'lig': 'log',
    'ad': 'add', 'aadd': 'add',
    'inint': 'init', 'inti': 'init',
    'pul': 'pull', 'psuh': 'push',
    'shwo': 'show', 'sahow': 'show',
    'rset': 'reset', 'reste': 'reset',
    'revet': 'revert',
  };

  async execute(command: string, args: string[]): Promise<CommandResult> {
    // Handle "git help [command]" as a docs alias
    if (command === 'help') {
      return { output: '__DOCS__:' + (args[0] || ''), success: true };
    }

    const handler = this.commands.get(command);
    if (!handler) {
      const suggestion = GitEngine.TYPO_MAP[command];
      if (suggestion) {
        return {
          output: `git: '${command}' is not a git command. Did you mean 'git ${suggestion}'?`,
          success: false,
        };
      }
      return { output: `git: '${command}' is not a git command.`, success: false };
    }

    if (this.allowedCommands && !this.allowedCommands.has(command)) {
      return {
        output: `This command is not available in this level. Try: ${[...this.allowedCommands].join(', ')}`,
        success: false,
      };
    }

    // Save snapshot before executing git command (for undo)
    await this.saveSnapshot();

    // Capture previous branch for checkout reflog messages
    let prevBranch: string | null = null;
    if (command === 'checkout' || command === 'switch') {
      prevBranch = await this.getCurrentBranch();
    }

    try {
      const result = await handler(args, this);
      this.commandCount++;
      eventBus.emit('command:executed', { command, args, output: result.output, success: result.success });
      eventBus.emit('state:changed', undefined as never);

      // Record reflog for HEAD-changing commands
      if (result.success && GitEngine.REFLOG_COMMANDS.has(command)) {
        const reflogMsg = await this.buildReflogMessage(command, args, prevBranch);
        await this.recordReflog(command, reflogMsg);
      }

      // Play sound effects based on command result
      if (result.success) {
        if (command === 'commit') soundManager.play('commit');
        else if (command === 'add') soundManager.play('add');
        else if (command === 'checkout' || command === 'switch') soundManager.play('checkout');
        else if (command === 'merge') soundManager.play('merge');
      } else {
        // Merge conflict gets its own sound
        if (command === 'merge' && result.output.includes('CONFLICT')) {
          soundManager.play('conflict');
        } else {
          soundManager.play('error');
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: CommandResult = { output: `error: ${message}`, success: false };
      eventBus.emit('command:executed', { command, args, output: result.output, success: false });
      soundManager.play('error');
      return result;
    }
  }

  private async buildReflogMessage(command: string, args: string[], prevBranch: string | null): Promise<string> {
    const nonFlagArgs = args.filter((a) => a != null && !a.startsWith('-'));
    switch (command) {
      case 'commit': {
        const mIndex = args.indexOf('-m');
        const msg = mIndex !== -1 && args[mIndex + 1] ? args[mIndex + 1] : 'commit';
        return msg;
      }
      case 'checkout':
      case 'switch': {
        const target = await this.getCurrentBranch() || nonFlagArgs[0] || 'unknown';
        return `moving from ${prevBranch || 'unknown'} to ${target}`;
      }
      case 'merge':
        return nonFlagArgs[0] || 'merge';
      case 'reset': {
        try {
          const oid = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
          return `moving to ${oid.slice(0, 7)}`;
        } catch {
          return nonFlagArgs[0] || 'reset';
        }
      }
      case 'cherry-pick':
        return nonFlagArgs[0] || 'cherry-pick';
      case 'revert':
        return nonFlagArgs[0] || 'revert';
      default:
        return args.join(' ');
    }
  }

  async getState(): Promise<RepoState> {
    try {
      await this.fs.promises.stat(`${this.dir}/.git`);
    } catch {
      return {
        initialized: false,
        currentBranch: null,
        branches: [],
        files: [],
        recentCommits: [],
        headOid: null,
      };
    }

    const [currentBranch, branches, files, recentCommits, headOid] = await Promise.all([
      this.getCurrentBranch(),
      this.getBranches(),
      this.getFileStatuses(),
      this.getRecentCommits(),
      this.getHeadOid(),
    ]);

    return { initialized: true, currentBranch, branches, files, recentCommits, headOid };
  }

  async getCurrentBranch(): Promise<string | null> {
    try {
      return await git.currentBranch({ fs: this.fs, dir: this.dir }) || null;
    } catch {
      return null;
    }
  }

  async getBranches(): Promise<BranchInfo[]> {
    try {
      const branchNames = await git.listBranches({ fs: this.fs, dir: this.dir });
      const current = await this.getCurrentBranch();
      const branches: BranchInfo[] = [];
      for (const name of branchNames) {
        try {
          const oid = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: name });
          branches.push({ name, oid, isCurrent: name === current });
        } catch {
          branches.push({ name, oid: '', isCurrent: name === current });
        }
      }
      // Include remote tracking branches
      for (const remoteName of this.remotes.keys()) {
        try {
          const remoteDir = `${this.dir}/.git/refs/remotes/${remoteName}`;
          const entries = await this.fs.promises.readdir(remoteDir) as string[];
          for (const entry of entries) {
            try {
              const oid = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/remotes/${remoteName}/${entry}` });
              branches.push({ name: `${remoteName}/${entry}`, oid, isCurrent: false, isRemote: true });
            } catch { /* skip */ }
          }
        } catch { /* no remote refs yet */ }
      }
      return branches;
    } catch {
      return [];
    }
  }

  async getFileStatuses(): Promise<FileStatus[]> {
    try {
      const matrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });
      return matrix.map(([path, head, workdir, stage]) => {
        let status: FileStatus['status'] = 'unchanged';
        let staged = false;

        if (head === 0 && workdir === 2 && stage === 0) { status = 'untracked'; }
        else if (head === 0 && workdir === 2 && stage === 2) { status = 'added'; staged = true; }
        else if (head === 1 && workdir === 2 && stage === 2) { status = 'modified'; staged = true; }
        else if (head === 1 && workdir === 2 && stage === 1) { status = 'modified'; }
        else if (head === 1 && workdir === 0 && stage === 0) { status = 'deleted'; staged = true; }
        else if (head === 1 && workdir === 0 && stage === 1) { status = 'deleted'; }
        else if (head === 1 && workdir === 1 && stage === 1) { status = 'unchanged'; }
        else if (head === 0 && workdir === 0 && stage === 3) { status = 'added'; staged = true; }

        return { path, status, staged };
      });
    } catch {
      // statusMatrix fails on repos with no commits — list files as untracked
      try {
        const entries = await this.fs.promises.readdir(this.dir) as string[];
        return entries
          .filter((e: string) => e !== '.git')
          .map((path: string) => ({ path, status: 'untracked' as const, staged: false }));
      } catch {
        return [];
      }
    }
  }

  async getRecentCommits(depth = 10): Promise<CommitInfo[]> {
    try {
      const commits = await git.log({ fs: this.fs, dir: this.dir, depth });
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message,
        author: { name: c.commit.author.name, email: c.commit.author.email, timestamp: c.commit.author.timestamp },
        parents: c.commit.parent,
      }));
    } catch {
      return [];
    }
  }

  /** Get commits from ALL branches (deduped), for full graph rendering. */
  async getAllCommits(depth = 20): Promise<CommitInfo[]> {
    try {
      const branches = await git.listBranches({ fs: this.fs, dir: this.dir });
      const allCommits = new Map<string, CommitInfo>();

      // Collect all refs to walk: local branches + remote tracking branches
      const refs: string[] = [...branches];
      for (const remoteName of this.remotes.keys()) {
        try {
          const remoteDir = `${this.dir}/.git/refs/remotes/${remoteName}`;
          const entries = await this.fs.promises.readdir(remoteDir) as string[];
          for (const entry of entries) {
            refs.push(`refs/remotes/${remoteName}/${entry}`);
          }
        } catch { /* no remote refs */ }
      }

      for (const ref of refs) {
        try {
          const commits = await git.log({ fs: this.fs, dir: this.dir, ref, depth });
          for (const c of commits) {
            if (!allCommits.has(c.oid)) {
              allCommits.set(c.oid, {
                oid: c.oid,
                message: c.commit.message,
                author: { name: c.commit.author.name, email: c.commit.author.email, timestamp: c.commit.author.timestamp },
                parents: c.commit.parent,
              });
            }
          }
        } catch {
          // skip refs that fail (e.g. orphan)
        }
      }
      return Array.from(allCommits.values());
    } catch {
      return [];
    }
  }

  async getHeadOid(): Promise<string | null> {
    try {
      return await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
    } catch {
      return null;
    }
  }

  async saveSnapshot(): Promise<void> {
    const files = new Map<string, string | Uint8Array>();
    await this.walkDir(this.dir, files);
    // Also snapshot /remote directory if it exists
    try {
      const remoteStat = await this.fs.promises.stat('/remote');
      if (remoteStat.isDirectory?.() || (remoteStat as any).type === 'dir') {
        await this.walkDir('/remote', files);
      }
    } catch { /* /remote doesn't exist yet */ }
    this.snapshots.push({
      files,
      reflog: [...this.reflogEntries],
      stash: [...this.stashStack],
      remotes: new Map(this.remotes),
      commandCount: this.commandCount,
    });
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }

  async restoreSnapshot(): Promise<boolean> {
    if (this.snapshots.length === 0) return false;
    const snapshot = this.snapshots.pop()!;
    // Wipe current fs and restore
    this.createFreshFs();
    await this.fs.promises.mkdir(this.dir);
    for (const [path, content] of snapshot.files) {
      // Ensure parent dirs exist
      const parts = path.split('/');
      let dir = '';
      for (let i = 0; i < parts.length - 1; i++) {
        dir += '/' + parts[i];
        try { await this.fs.promises.mkdir(dir); } catch {}
      }
      await this.fs.promises.writeFile('/' + path, content);
    }
    this.reflogEntries = snapshot.reflog;
    this.stashStack = snapshot.stash;
    this.remotes = snapshot.remotes ?? new Map();
    if (snapshot.commandCount !== undefined) {
      this.commandCount = snapshot.commandCount;
    }
    return true;
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  private async walkDir(dir: string, files: Map<string, string | Uint8Array>): Promise<void> {
    const entries = await this.fs.promises.readdir(dir) as string[];
    for (const entry of entries) {
      const fullPath = `${dir}/${entry}`;
      try {
        const stat = await this.fs.promises.stat(fullPath);
        if (stat.isDirectory?.() || (stat as any).type === 'dir') {
          await this.walkDir(fullPath, files);
        } else {
          const content = await this.fs.promises.readFile(fullPath);
          // Store path relative to root (remove leading /)
          files.set(fullPath.slice(1), content as string);
        }
      } catch {}
    }
  }

  /** Reset the engine to a clean state, wiping filesystem and all in-memory state. */
  async reset(): Promise<void> {
    this.createFreshFs();
    await this.fs.promises.mkdir(this.dir);
    this.commandCount = 0;
    this.allowedCommands = null;
    this.stashStack = [];
    this.reflogEntries = [];
    this.snapshots = [];
    this.remotes = new Map();
    this.configStore = new Map([
      ['user.name', 'Player'],
      ['user.email', 'player@gitvana.dev'],
    ]);
    // Note: bisect and rebase state files live inside .git/ which is wiped by
    // createFreshFs(), so no explicit cleanup is needed here.
    // /remote directory is also wiped since createFreshFs() replaces the entire filesystem.
  }

  /** Initialize a bare remote repository on the in-memory filesystem. */
  async initRemote(name: string, url: string): Promise<void> {
    const dir = `/remote/${name}`;
    this.remotes.set(name, { url, dir });
    // Create bare repo directories
    try { await this.fs.promises.mkdir('/remote'); } catch {}
    try { await this.fs.promises.mkdir(dir); } catch {}
    await git.init({ fs: this.fs, dir, defaultBranch: 'main' });
  }
}

export const gitEngine = new GitEngine();
