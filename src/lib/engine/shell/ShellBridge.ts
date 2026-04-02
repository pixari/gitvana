import type { Terminal } from '@xterm/xterm';
import type { GitEngine } from '../git/GitEngine.js';
import { parseCommand } from '../git/cli-parser.js';
import { runBuiltin } from './builtins.js';
import type { LevelDefinition } from '../../../levels/schema.js';
import { eventBus } from '../events/GameEventBus.js';
import { getLevelSolution } from './solutions.js';
import { commandDocs } from '../../../docs/commands/index.js';

const PROMPT = '\x1b[32mgitvana\x1b[0m:\x1b[34m/workspace\x1b[0m$ ';

export class ShellBridge {
  private lineBuffer = '';
  private cursorPos = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private onEditRequest: ((filepath: string) => void) | null = null;
  private onDocRequest: ((commandName: string) => void) | null = null;
  private currentLevel: LevelDefinition | null = null;
  private onSkipRequest: (() => void) | null = null;
  private onRestartRequest: (() => void) | null = null;

  constructor(
    private terminal: Terminal,
    private engine: GitEngine,
  ) {}

  start(): void {
    this.writePrompt();
    this.terminal.onData((data) => this.handleInput(data));
  }

  setEditHandler(handler: (filepath: string) => void): void {
    this.onEditRequest = handler;
  }

  setDocHandler(handler: (commandName: string) => void): void {
    this.onDocRequest = handler;
  }

  setLevel(level: LevelDefinition): void {
    this.currentLevel = level;
  }

  setSkipHandler(handler: () => void): void {
    this.onSkipRequest = handler;
  }

  setRestartHandler(handler: () => void): void {
    this.onRestartRequest = handler;
  }

  private writePrompt(): void {
    this.terminal.write(PROMPT);
  }

  private writeLine(text: string): void {
    if (text) {
      // Replace \n with \r\n for terminal
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        this.terminal.write(lines[i]);
        if (i < lines.length - 1) {
          this.terminal.write('\r\n');
        }
      }
      this.terminal.write('\r\n');
    }
  }

  private async handleInput(data: string): Promise<void> {
    // Handle escape sequences as a whole unit (arrows, etc.)
    if (data.startsWith('\x1b[')) {
      if (data === '\x1b[A') this.navigateHistory(1);
      else if (data === '\x1b[B') this.navigateHistory(-1);
      else if (data === '\x1b[D') {
        // Left arrow
        if (this.cursorPos > 0) {
          this.cursorPos--;
          this.terminal.write('\x1b[D');
        }
      } else if (data === '\x1b[C') {
        // Right arrow
        if (this.cursorPos < this.lineBuffer.length) {
          this.cursorPos++;
          this.terminal.write('\x1b[C');
        }
      } else if (data === '\x1b[H' || data === '\x1b[1~') {
        // Home — move to start of line
        if (this.cursorPos > 0) {
          this.terminal.write(`\x1b[${this.cursorPos}D`);
          this.cursorPos = 0;
        }
      } else if (data === '\x1b[F' || data === '\x1b[4~') {
        // End — move to end of line
        if (this.cursorPos < this.lineBuffer.length) {
          this.terminal.write(`\x1b[${this.lineBuffer.length - this.cursorPos}C`);
          this.cursorPos = this.lineBuffer.length;
        }
      }
      return;
    }

    for (const char of data) {
      switch (char) {
        case '\r': // Enter
        case '\n':
          this.terminal.write('\r\n');
          this.cursorPos = 0;
          await this.executeLine();
          break;

        case '\x7f': // Backspace
          if (this.cursorPos > 0) {
            this.lineBuffer =
              this.lineBuffer.slice(0, this.cursorPos - 1) +
              this.lineBuffer.slice(this.cursorPos);
            this.cursorPos--;
            // Move cursor back one position
            this.terminal.write('\b');
            // Rewrite everything from cursorPos to end, then erase trailing char
            const restAfterBS = this.lineBuffer.slice(this.cursorPos);
            this.terminal.write(restAfterBS + ' ');
            // Move cursor back to correct position
            const moveBackBS = restAfterBS.length + 1;
            if (moveBackBS > 0) {
              this.terminal.write(`\x1b[${moveBackBS}D`);
            }
          }
          break;

        case '\x1b': // Lone escape — ignore
          break;

        case '\x03': // Ctrl+C
          this.lineBuffer = '';
          this.cursorPos = 0;
          this.terminal.write('^C\r\n');
          this.writePrompt();
          break;

        case '\t': // Tab
          await this.handleTab();
          break;

        default:
          if (char >= ' ') {
            // Insert char at cursorPos
            this.lineBuffer =
              this.lineBuffer.slice(0, this.cursorPos) +
              char +
              this.lineBuffer.slice(this.cursorPos);
            this.cursorPos++;
            // Write the new char plus everything after it
            const restAfterInsert = this.lineBuffer.slice(this.cursorPos);
            this.terminal.write(char + restAfterInsert);
            // Move cursor back to the right position
            if (restAfterInsert.length > 0) {
              this.terminal.write(`\x1b[${restAfterInsert.length}D`);
            }
          }
          break;
      }
    }
  }

  private static readonly GIT_COMMANDS = [
    'init', 'add', 'commit', 'status', 'log', 'diff',
    'branch', 'checkout', 'switch', 'merge', 'reset', 'rm',
    'tag', 'cherry-pick', 'show', 'revert', 'stash', 'reflog',
    'rebase', 'blame', 'bisect',
  ];

  private static readonly GIT_FLAGS: Record<string, string[]> = {
    'add':      ['-u', '--update', '-A', '--all'],
    'commit':   ['-m', '--message'],
    'log':      ['--oneline', '--all', '--graph', '-n', '--max-count'],
    'diff':     ['--staged', '--cached', '--stat'],
    'reset':    ['--soft', '--mixed', '--hard'],
    'checkout': ['-b'],
    'branch':   ['-d', '-D', '--delete', '--force-delete'],
    'tag':      ['-a', '--annotate', '-d', '--delete', '-l', '--list', '-m', '--message'],
    'rm':       ['--cached', '-r', '--recursive'],
    'stash':    ['push', 'pop', 'apply', 'list', 'drop'],
    'rebase':   ['--continue', '--abort'],
    'merge':    ['--abort', '--no-ff'],
    'bisect':   ['start', 'good', 'bad', 'reset'],
  };

  private static readonly BUILTINS = [
    'git', 'ls', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'pwd',
    'clear', 'edit', 'help', 'hint', 'docs', 'solution', 'solve', 'skip',
  ];

  private static readonly FILE_ARG_COMMANDS = ['add', 'cat', 'edit', 'rm', 'touch'];

  private async handleTab(): Promise<void> {
    const line = this.lineBuffer;
    let candidates: string[] = [];
    let prefix = '';

    const parts = line.split(/\s+/);
    const endsWithSpace = line.endsWith(' ');

    if (parts[0] === 'git' && parts.length >= 2) {
      const gitSub = parts[1];

      // "git subcmd -..." or "git subcmd --..." → flag completion
      if (parts.length >= 3 || (parts.length === 2 && endsWithSpace)) {
        const lastWord = endsWithSpace ? '' : parts[parts.length - 1];

        // Flag completion
        if (lastWord.startsWith('-') || (endsWithSpace && parts.length >= 2)) {
          const flags = ShellBridge.GIT_FLAGS[gitSub] ?? [];
          if (lastWord.startsWith('-')) {
            prefix = lastWord;
            candidates = flags.filter(f => f.startsWith(lastWord));
          } else if (endsWithSpace) {
            // After "git subcmd ", check if we should complete files
            if (ShellBridge.FILE_ARG_COMMANDS.includes(gitSub)) {
              candidates = await this.getFileCompletions('');
              prefix = '';
            }
          }
        }
        // File path completion for commands like "git add <partial>"
        else if (ShellBridge.FILE_ARG_COMMANDS.includes(gitSub)) {
          prefix = lastWord;
          candidates = await this.getFileCompletions(lastWord);
        }
      }
      // "git <partial>" → git subcommand completion
      else if (!endsWithSpace) {
        prefix = gitSub;
        candidates = ShellBridge.GIT_COMMANDS.filter(c => c.startsWith(gitSub));
      }
      // "git " with trailing space → show all git commands
      else {
        prefix = '';
        candidates = [...ShellBridge.GIT_COMMANDS];
      }
    }
    // File arg commands: "cat <partial>", "edit <partial>", etc.
    else if (ShellBridge.FILE_ARG_COMMANDS.includes(parts[0]) && (parts.length >= 2 || endsWithSpace)) {
      prefix = endsWithSpace ? '' : parts[parts.length - 1];
      candidates = await this.getFileCompletions(prefix);
    }
    // Builtin / first-word completion
    else {
      prefix = endsWithSpace ? '' : parts[0];
      candidates = ShellBridge.BUILTINS.filter(c => c.startsWith(prefix));
    }

    if (candidates.length === 0) {
      return; // no matches — do nothing
    }

    if (candidates.length === 1) {
      // Single match — complete the word and add a space
      const completion = candidates[0].slice(prefix.length) + ' ';
      this.lineBuffer += completion;
      this.cursorPos = this.lineBuffer.length;
      this.terminal.write(completion);
    } else {
      // Multiple matches — show options, then re-display prompt + input
      this.terminal.write('\r\n');
      this.writeLine(candidates.join('  '));
      this.writePrompt();
      this.terminal.write(this.lineBuffer);
      this.cursorPos = this.lineBuffer.length;
    }
  }

  private async getFileCompletions(prefix: string): Promise<string[]> {
    try {
      const entries: string[] = await this.engine.fs.promises.readdir(this.engine.dir) as string[];
      if (prefix) {
        return entries.filter((e: string) => e.startsWith(prefix));
      }
      return entries;
    } catch {
      return [];
    }
  }

  private navigateHistory(direction: number): void {
    if (this.history.length === 0) return;

    const newIndex = this.historyIndex + direction;
    if (newIndex < -1 || newIndex >= this.history.length) return;

    // Move cursor to end of line first, then clear
    if (this.cursorPos < this.lineBuffer.length) {
      this.terminal.write(`\x1b[${this.lineBuffer.length - this.cursorPos}C`);
    }
    // Clear current line from the end
    for (let i = 0; i < this.lineBuffer.length; i++) {
      this.terminal.write('\b \b');
    }

    this.historyIndex = newIndex;
    if (newIndex === -1) {
      this.lineBuffer = '';
    } else {
      this.lineBuffer = this.history[this.history.length - 1 - newIndex];
      this.terminal.write(this.lineBuffer);
    }
    this.cursorPos = this.lineBuffer.length;
  }

  /** Expand simple glob patterns (*.ext) in a command line */
  private async expandGlobs(line: string): Promise<string> {
    // Tokenize respecting quotes
    const tokens = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
    if (!tokens) return line;

    let expanded = false;
    const result: string[] = [];

    for (const token of tokens) {
      // Skip quoted tokens or tokens without *
      if (token.startsWith('"') || token.startsWith("'") || !token.includes('*')) {
        result.push(token);
        continue;
      }

      try {
        const entries = await this.engine.fs.promises.readdir(this.engine.dir) as string[];
        const files = entries.filter((f: string) => f !== '.git');

        let matched: string[];
        if (token === '*') {
          matched = files;
        } else if (token.startsWith('*.')) {
          const ext = token.slice(1); // e.g. ".js"
          matched = files.filter((f: string) => f.endsWith(ext));
        } else {
          // Unsupported glob pattern, keep as-is
          result.push(token);
          continue;
        }

        if (matched.length > 0) {
          result.push(...matched);
          expanded = true;
        } else {
          result.push(token); // no match, keep literal
        }
      } catch {
        result.push(token);
      }
    }

    return expanded ? result.join(' ') : line;
  }

  private async executeLine(): Promise<void> {
    let line = this.lineBuffer.trim();
    this.lineBuffer = '';
    this.cursorPos = 0;
    this.historyIndex = -1;

    if (!line) {
      this.writePrompt();
      return;
    }

    this.history.push(line);

    // Support ; chaining (runs next command regardless of success)
    // and && chaining (stops on first failure)
    if (line.includes('&&') || line.includes(';')) {
      // Split on && and ; while preserving the delimiter
      const segments: { cmd: string; stopOnFail: boolean }[] = [];
      // Split by && or ; keeping track of which delimiter was used
      const parts = line.split(/(&&|;)/);
      let stopOnFail = false; // doesn't matter for first segment
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed === '&&') {
          stopOnFail = true;
        } else if (trimmed === ';') {
          stopOnFail = false;
        } else if (trimmed) {
          segments.push({ cmd: trimmed, stopOnFail });
          stopOnFail = false;
        }
      }

      for (const seg of segments) {
        const expandedCmd = await this.expandGlobs(seg.cmd);
        const success = await this.executeOneCommand(expandedCmd);
        if (!success && seg.stopOnFail) break;
      }
      this.writePrompt();
      return;
    }

    // Expand globs
    line = await this.expandGlobs(line);

    const parsed = parseCommand(line);

    switch (parsed.type) {
      case 'git': {
        const result = await this.engine.execute(parsed.command, parsed.args);
        if (result.output) {
          this.writeLine(result.output);
        }
        break;
      }

      case 'builtin': {
        if (parsed.command === 'clear') {
          this.terminal.clear();
        } else if (parsed.command === 'help') {
          this.writeLine(this.getHelpText());
        } else if (parsed.command === 'hint') {
          this.showHint();
        } else if (parsed.command === 'solution') {
          this.showSolution();
        } else if (parsed.command === 'solve') {
          await this.autoSolve();
        } else if (parsed.command === 'skip') {
          this.skipLevel();
        } else if (parsed.command === 'restart') {
          this.restartLevel();
        } else {
          // Need to pass the raw args for echo redirect parsing
          const rawArgs = parsed.command === 'echo'
            ? [line.slice(line.indexOf(' ') + 1)]
            : parsed.args;
          const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
          if (result.output) {
            this.writeLine(result.output);
          }
        }
        break;
      }

      case 'edit': {
        if (!parsed.args[0]) {
          this.writeLine('Usage: edit <filename>');
        } else if (!this.onEditRequest) {
          this.writeLine('Editor not available.');
        } else {
          this.onEditRequest(parsed.args[0]);
        }
        break;
      }

      case 'docs': {
        const cmdName = parsed.args[0] || '';
        if (this.onDocRequest) {
          this.onDocRequest(cmdName);
        } else {
          // Fallback: print docs in terminal if no popup handler
          if (cmdName && commandDocs[cmdName]) {
            const doc = commandDocs[cmdName];
            this.writeLine(`\x1b[32m${doc.syntax}\x1b[0m`);
            this.writeLine(doc.description);
          } else {
            const available = Object.keys(commandDocs).join(', ');
            this.writeLine(`Available docs: ${available}`);
            this.writeLine('Usage: docs <command>');
          }
        }
        break;
      }

      default:
        this.writeLine(`${parsed.command}: command not found`);
        break;
    }

    this.writePrompt();
  }

  private getHelpText(): string {
    return [
      'The monastery provides the following tools:',
      '',
      '  \x1b[32mgit <command>\x1b[0m    The path to enlightenment',
      '  \x1b[36mls\x1b[0m [dir]         See what\'s lying around',
      '  \x1b[36mcat\x1b[0m <file>       Read a file (not a cat)',
      '  \x1b[36mecho\x1b[0m "..." > f   Write words to a file',
      '  \x1b[36mtouch\x1b[0m <file>     Create an empty file',
      '  \x1b[36mmkdir\x1b[0m [-p] dir   Create a directory',
      '  \x1b[36mrm\x1b[0m <file>        Remove a file (careful!)',
      '  \x1b[36mpwd\x1b[0m              Where am I?',
      '  \x1b[36mclear\x1b[0m            Clean the terminal',
      '  \x1b[36medit\x1b[0m <file>      Open the monastery editor',
      '  \x1b[36mhelp\x1b[0m             You are here',
      '  \x1b[36mhint\x1b[0m             Ask the monks for guidance',
      '  \x1b[36mdocs\x1b[0m [cmd]       Read the monastery scrolls',
      '  \x1b[36mrestart\x1b[0m          Start this level over',
      ...((import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true') ? [
        '',
        '\x1b[33m  Dev tools:\x1b[0m',
        '  solution         Peek at the ancient scrolls',
        '  solve            Let the monastery cat do it',
        '  skip             Sneak past the Head Monk',
      ] : []),
    ].join('\n');
  }

  private showHint(): void {
    if (!this.currentLevel || this.currentLevel.hints.length === 0) {
      this.writeLine('No hints available for this level.');
      return;
    }
    const hint = this.currentLevel.hints[0];
    this.writeLine(`\x1b[33mHint:\x1b[0m ${hint.text}`);
    if (hint.command) {
      this.writeLine(`\x1b[36m  ${hint.command}\x1b[0m`);
    }
  }

  private showSolution(): void {
    if (!this.currentLevel) {
      this.writeLine('No level loaded.');
      return;
    }
    const solutions = getLevelSolution(this.currentLevel.id);
    if (solutions.length === 0) {
      this.writeLine('No solution available for this level.');
      return;
    }
    this.writeLine('\x1b[33m--- Solution ---\x1b[0m');
    for (let i = 0; i < solutions.length; i++) {
      this.writeLine(`\x1b[36m  ${i + 1}. ${solutions[i]}\x1b[0m`);
    }
    this.writeLine('\x1b[33m----------------\x1b[0m');
  }

  async autoSolve(): Promise<void> {
    if (!this.currentLevel) {
      this.writeLine('No level loaded.');
      return;
    }
    const solutions = getLevelSolution(this.currentLevel.id);
    if (solutions.length === 0) {
      this.writeLine('No solution available for this level.');
      return;
    }
    this.writeLine('\x1b[33mAuto-solving...\x1b[0m');
    for (const step of solutions) {
      this.writeLine(`\x1b[36m$ ${step}\x1b[0m`);
      // Simulate running the command through the shell
      const parsed = parseCommand(step);
      if (parsed.type === 'git') {
        const result = await this.engine.execute(parsed.command, parsed.args);
        if (result.output) {
          this.writeLine(result.output);
        }
      } else if (parsed.type === 'builtin') {
        const rawArgs = parsed.command === 'echo'
          ? [step.slice(step.indexOf(' ') + 1)]
          : parsed.args;
        const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
        if (result.output) {
          this.writeLine(result.output);
        }
      }
    }
    this.writeLine('\x1b[32mDone!\x1b[0m');
  }

  private skipLevel(): void {
    if (this.onSkipRequest) {
      this.onSkipRequest();
      this.writeLine('\x1b[33mSkipping level...\x1b[0m');
    } else {
      this.writeLine('Skip not available.');
    }
  }

  private restartLevel(): void {
    if (this.onRestartRequest) {
      this.onRestartRequest();
      this.writeLine('\x1b[33mRestarting level...\x1b[0m');
    } else {
      this.writeLine('Restart not available.');
    }
  }

  /** Run a single command, return true if successful */
  private async executeOneCommand(cmdLine: string): Promise<boolean> {
    const parsed = parseCommand(cmdLine);
    if (parsed.type === 'git') {
      const result = await this.engine.execute(parsed.command, parsed.args);
      if (result.output) this.writeLine(result.output);
      return result.success;
    } else if (parsed.type === 'builtin') {
      const rawArgs = parsed.command === 'echo'
        ? [cmdLine.slice(cmdLine.indexOf(' ') + 1)]
        : parsed.args;
      const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
      if (result.output) this.writeLine(result.output);
      return result.success;
    }
    this.writeLine(`${parsed.command}: command not found`);
    return false;
  }
}
