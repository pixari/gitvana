import type { Terminal } from '@xterm/xterm';
import type { GitEngine } from '../git/GitEngine.js';
import { parseCommand } from '../git/cli-parser.js';
import { runBuiltin } from './builtins.js';
import type { LevelDefinition } from '../../../levels/schema.js';
import { eventBus } from '../events/GameEventBus.js';
import { getLevelSolution } from './solutions.js';
import { commandDocs } from '../../../docs/commands/index.js';
import { HintEngine } from './hint-engine.js';

const PROMPT = '\x1b[32mgitvana\x1b[0m:\x1b[34m/workspace\x1b[0m$ ';

/**
 * Split a command line on && and ; operators, but only when they
 * appear outside of single or double quotes.
 * Returns an array of segments and delimiters interleaved, e.g.:
 *   'echo "a; b" && ls' => ['echo "a; b"', '&&', 'ls']
 */
function splitOnChainOperators(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }

    // Check for &&
    if (ch === '&' && line[i + 1] === '&') {
      if (current.trim()) parts.push(current);
      parts.push('&&');
      current = '';
      i++; // skip second &
      continue;
    }

    // Check for ;
    if (ch === ';') {
      if (current.trim()) parts.push(current);
      parts.push(';');
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Split a command line on the first pipe operator `|` that is not inside quotes.
 * Returns [leftCmd, rightCmd] or null if no pipe is found.
 */
function splitOnPipe(line: string): [string, string] | null {
  let inQuote: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (ch === '|') {
      const left = line.slice(0, i).trim();
      const right = line.slice(i + 1).trim();
      if (left && right) return [left, right];
    }
  }

  return null;
}

/**
 * Apply a pipe filter to the output of a command.
 */
function applyPipeFilter(cmd: string, input: string): string {
  const tokens = cmd.split(/\s+/);
  const command = tokens[0];

  switch (command) {
    case 'head': {
      let n = 10;
      if (tokens[1] && tokens[1].startsWith('-') && !isNaN(Number(tokens[1].slice(1)))) {
        n = Number(tokens[1].slice(1));
      } else if (tokens[1] === '-n' && tokens[2]) {
        n = Number(tokens[2]);
      }
      const lines = input.split('\n');
      return lines.slice(0, n).join('\n');
    }
    case 'tail': {
      let n = 10;
      if (tokens[1] && tokens[1].startsWith('-') && !isNaN(Number(tokens[1].slice(1)))) {
        n = Number(tokens[1].slice(1));
      } else if (tokens[1] === '-n' && tokens[2]) {
        n = Number(tokens[2]);
      }
      const lines = input.split('\n');
      return lines.slice(-n).join('\n');
    }
    case 'grep': {
      const pattern = tokens.slice(1).join(' ').replace(/^["']|["']$/g, '');
      if (!pattern) return 'grep: missing pattern';
      const lines = input.split('\n');
      return lines.filter(line => line.includes(pattern)).join('\n');
    }
    case 'wc': {
      if (tokens.includes('-l')) {
        const lines = input.split('\n');
        const count = input.endsWith('\n') ? lines.length - 1 : lines.length;
        return String(count);
      }
      const lines = input.split('\n');
      const lineCount = input.endsWith('\n') ? lines.length - 1 : lines.length;
      const wordCount = input.split(/\s+/).filter(Boolean).length;
      const charCount = input.length;
      return `  ${lineCount}  ${wordCount}  ${charCount}`;
    }
    case 'sort': {
      const lines = input.split('\n');
      return lines.sort().join('\n');
    }
    default:
      return `Unsupported pipe target: ${command}`;
  }
}

export class ShellBridge {
  private lineBuffer = '';
  private cursorPos = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private onEditRequest: ((filepath: string) => void) | null = null;
  private onDocRequest: ((commandName: string) => void) | null = null;
  private currentLevel: LevelDefinition | null = null;
  private hintEngine = new HintEngine();
  private onSkipRequest: (() => void) | null = null;
  private onRestartRequest: (() => void) | null = null;
  private aliases = new Map<string, string>();

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
    this.hintEngine.setLevel(level);
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

  /** Redraw from cursor position to end of input, clearing leftover chars. Works across line wraps. */
  private redrawLineFromCursor(): void {
    // Save cursor, erase from cursor to end of screen, write remaining text, restore cursor
    this.terminal.write('\x1b[s');        // save cursor position
    this.terminal.write('\x1b[J');        // erase from cursor to end of screen
    this.terminal.write(this.lineBuffer.slice(this.cursorPos));
    this.terminal.write('\x1b[u');        // restore cursor position
  }

  /** Redraw the entire line (prompt + buffer). Used after destructive edits like Ctrl+U/W. */
  private redrawFullLine(): void {
    // Move to the start of the prompt line. The prompt length in visible chars:
    // "gitvana:/workspace$ " = 20 chars (ANSI codes are zero-width)
    const promptVisibleLen = 20;
    const totalVisible = promptVisibleLen + this.lineBuffer.length;
    const cols = this.terminal.cols;
    // How many rows does the current content span? Move up to the first row.
    const currentRow = Math.floor((promptVisibleLen + this.cursorPos) / cols);
    if (currentRow > 0) {
      this.terminal.write(`\x1b[${currentRow}A`);
    }
    this.terminal.write('\r');            // go to column 0
    this.terminal.write('\x1b[J');        // erase from cursor to end of screen
    this.writePrompt();
    this.terminal.write(this.lineBuffer);
    // Now reposition cursor if not at end
    if (this.cursorPos < this.lineBuffer.length) {
      const endRow = Math.floor((promptVisibleLen + this.lineBuffer.length) / cols);
      const targetRow = Math.floor((promptVisibleLen + this.cursorPos) / cols);
      const targetCol = (promptVisibleLen + this.cursorPos) % cols;
      const rowsBack = endRow - targetRow;
      if (rowsBack > 0) {
        this.terminal.write(`\x1b[${rowsBack}A`);
      }
      this.terminal.write(`\r\x1b[${targetCol}C`);
    }
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
            this.redrawFullLine();
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

        case '\x0c': // Ctrl+L — clear screen
          this.terminal.write('\x1b[2J\x1b[H');
          this.terminal.clear();
          this.writePrompt();
          this.terminal.write(this.lineBuffer);
          // Reposition cursor if not at end
          if (this.cursorPos < this.lineBuffer.length) {
            this.terminal.write(`\x1b[${this.lineBuffer.length - this.cursorPos}D`);
          }
          break;

        case '\x15': { // Ctrl+U — clear line
          this.lineBuffer = '';
          this.cursorPos = 0;
          this.redrawFullLine();
          break;
        }

        case '\x17': { // Ctrl+W — delete word before cursor
          if (this.cursorPos === 0) break;
          let newPos = this.cursorPos;
          while (newPos > 0 && this.lineBuffer[newPos - 1] === ' ') newPos--;
          while (newPos > 0 && this.lineBuffer[newPos - 1] !== ' ') newPos--;
          this.lineBuffer = this.lineBuffer.slice(0, newPos) + this.lineBuffer.slice(this.cursorPos);
          this.cursorPos = newPos;
          this.redrawFullLine();
          break;
        }

        case '\t': // Tab
          await this.handleTab();
          break;

        default:
          if (char >= ' ') {
            this.lineBuffer =
              this.lineBuffer.slice(0, this.cursorPos) +
              char +
              this.lineBuffer.slice(this.cursorPos);
            this.cursorPos++;
            this.redrawLineFromCursor();
          }
          break;
      }
    }
  }

  private static readonly GIT_COMMANDS = [
    'init', 'add', 'commit', 'status', 'log', 'diff',
    'branch', 'checkout', 'switch', 'merge', 'reset', 'rm',
    'tag', 'cherry-pick', 'show', 'revert', 'stash', 'reflog',
    'rebase', 'blame', 'bisect', 'config', 'remote', 'push',
    'pull', 'fetch', 'clean', 'mv', 'restore',
  ];

  private static readonly GIT_FLAGS: Record<string, string[]> = {
    'add':      ['-u', '--update', '-A', '--all'],
    'commit':   ['-m', '--message', '--allow-empty', '--amend'],
    'log':      ['--oneline', '--all', '--graph', '-p', '--patch', '--stat', '--decorate', '-n', '--max-count', '--author', '--grep', '--since', '--until', '--format', '--pretty', '--no-merges', '--first-parent', '--reverse'],
    'status':   ['-s', '--short'],
    'diff':     ['--staged', '--cached', '--stat', '--name-only', '--name-status'],
    'reset':    ['--soft', '--mixed', '--hard'],
    'checkout': ['-b', '-c', '--create'],
    'switch':   ['-c', '--create', '-b'],
    'restore':  ['--staged', '--source'],
    'show':     ['--stat'],
    'branch':   ['-d', '-D', '--delete', '--force-delete', '-v', '--verbose', '-m', '--move', '--merged', '--no-merged', '-r', '-a'],
    'tag':      ['-a', '--annotate', '-d', '--delete', '-l', '--list', '-m', '--message'],
    'rm':       ['--cached', '-r', '--recursive'],
    'stash':    ['push', 'pop', 'apply', 'list', 'drop', 'show'],
    'rebase':   ['--continue', '--abort'],
    'merge':    ['--abort', '--no-ff'],
    'bisect':   ['start', 'good', 'bad', 'reset'],
    'config':   ['--list', '-l'],
    'push':     ['--force', '-f', '-u', '--set-upstream'],
    'pull':     ['--rebase'],
    'fetch':    ['--all'],
    'remote':   ['add', 'remove', '-v'],
    'clean':    ['-f', '-n', '-d', '--force', '--dry-run'],
  };

  private static readonly BUILTINS = [
    'git', 'ls', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'mv', 'pwd', 'grep', 'cd',
    'clear', 'edit', 'help', 'hint', 'docs', 'solution', 'solve', 'skip', 'undo',
    'head', 'tail', 'wc', 'history', 'alias',
  ];

  private static readonly FILE_ARG_COMMANDS = ['add', 'cat', 'edit', 'rm', 'touch', 'mv', 'restore'];

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

    this.historyIndex = newIndex;
    if (newIndex === -1) {
      this.lineBuffer = '';
    } else {
      this.lineBuffer = this.history[this.history.length - 1 - newIndex];
    }
    this.cursorPos = this.lineBuffer.length;
    this.redrawFullLine();
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

    // Handle alias command before alias expansion
    if (line === 'alias' || line.startsWith('alias ')) {
      this.handleAlias(line);
      this.writePrompt();
      return;
    }

    // Alias expansion: replace first word if it matches an alias
    line = this.expandAlias(line);

    // Pipe support: cmd1 | cmd2
    // Check for pipes before chain operators. Note: pipes within chain segments
    // are handled separately below.
    const pipeSplit = splitOnPipe(line);
    if (pipeSplit) {
      const [leftCmd, rightCmd] = pipeSplit;
      const expandedLeft = await this.expandGlobs(leftCmd);
      const leftOutput = await this.executeAndCapture(expandedLeft);
      const filtered = applyPipeFilter(rightCmd, leftOutput);
      this.writeLine(filtered);
      this.writePrompt();
      return;
    }

    // Support ; chaining (runs next command regardless of success)
    // and && chaining (stops on first failure)
    if (line.includes('&&') || line.includes(';')) {
      // Split on && and ; while respecting quoted strings
      const segments: { cmd: string; stopOnFail: boolean }[] = [];
      const parts = splitOnChainOperators(line);
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
        const aliasExpanded = this.expandAlias(seg.cmd);
        const expandedCmd = await this.expandGlobs(aliasExpanded);
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
        if (result.output && result.output.startsWith('__DOCS__:')) {
          // "git help [command]" — route to docs handler
          const cmdName = result.output.slice('__DOCS__:'.length);
          if (this.onDocRequest) {
            this.onDocRequest(cmdName);
          } else {
            this.writeLine('Use "docs <command>" to view documentation.');
          }
        } else if (result.output) {
          this.writeLine(result.output);
        }
        this.hintEngine.recordAttempt(parsed.command, parsed.args, result.success, result.output);
        this.maybeShowAutoHint();
        break;
      }

      case 'builtin': {
        if (parsed.command === 'clear') {
          this.terminal.write('\x1b[2J\x1b[H');
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
        } else if (parsed.command === 'undo') {
          const restored = await this.engine.restoreSnapshot();
          if (restored) {
            this.writeLine('\x1b[33mUndo: restored to before last command.\x1b[0m');
            eventBus.emit('state:changed', undefined as never);
          } else {
            this.writeLine('Nothing to undo.');
          }
        } else if (parsed.command === 'restart') {
          this.restartLevel();
        } else if (parsed.command === 'history') {
          if (parsed.args[0] === '-c') {
            this.history = [];
            this.writeLine('History cleared.');
          } else {
            const lines = this.history.map((cmd, i) => `  ${i + 1}  ${cmd}`);
            this.writeLine(lines.join('\n'));
          }
        } else {
          // Need to pass the raw args for echo redirect parsing
          const rawArgs = parsed.command === 'echo'
            ? [line.slice(line.indexOf(' ') + 1)]
            : parsed.args;
          const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
          if (result.output) {
            this.writeLine(result.output);
          }
          // File-modifying builtins should trigger UI refresh
          const fileModifiers = ['touch', 'echo', 'mkdir', 'rm', 'mv'];
          if (fileModifiers.includes(parsed.command)) {
            eventBus.emit('state:changed', undefined as never);
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

  private handleAlias(line: string): void {
    const trimmed = line.trim();
    if (trimmed === 'alias') {
      // Show all aliases
      if (this.aliases.size === 0) {
        this.writeLine('No aliases defined.');
      } else {
        const lines: string[] = [];
        for (const [name, value] of this.aliases) {
          lines.push(`alias ${name}='${value}'`);
        }
        this.writeLine(lines.join('\n'));
      }
      return;
    }

    // Parse: alias name="value" or alias name='value' or alias name=value
    const rest = trimmed.slice('alias '.length).trim();
    const eqIdx = rest.indexOf('=');
    if (eqIdx === -1) {
      // Show single alias
      const value = this.aliases.get(rest);
      if (value) {
        this.writeLine(`alias ${rest}='${value}'`);
      } else {
        this.writeLine(`alias: ${rest}: not found`);
      }
      return;
    }

    const name = rest.slice(0, eqIdx);
    let value = rest.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!name) {
      this.writeLine('Usage: alias name="command"');
      return;
    }

    this.aliases.set(name, value);
    this.writeLine(`alias ${name}='${value}'`);
  }

  private expandAlias(line: string): string {
    const spaceIdx = line.indexOf(' ');
    const firstWord = spaceIdx === -1 ? line : line.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? '' : line.slice(spaceIdx);
    const aliasValue = this.aliases.get(firstWord);
    if (aliasValue) {
      return aliasValue + rest;
    }
    return line;
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
      '  \x1b[36mgrep\x1b[0m "pat" file  Search file contents',
      '  \x1b[36mcd\x1b[0m [dir]           Change directory',
      '  \x1b[36mpwd\x1b[0m              Where am I?',
      '  \x1b[36mhead\x1b[0m [-N] file    Show first N lines (default 10)',
      '  \x1b[36mtail\x1b[0m [-N] file    Show last N lines (default 10)',
      '  \x1b[36mwc\x1b[0m [-l] file      Count lines/words/chars',
      '  \x1b[36mhistory\x1b[0m [-c]      Show/clear command history',
      '  \x1b[36malias\x1b[0m [name=cmd]  Define command shortcuts',
      '  \x1b[36mclear\x1b[0m            Clean the terminal',
      '  \x1b[36medit\x1b[0m <file>      Open the monastery editor',
      '  \x1b[36mhelp\x1b[0m             You are here',
      '  \x1b[36mhint\x1b[0m             Ask the monks for guidance',
      '  \x1b[36mdocs\x1b[0m [cmd]       Read the monastery scrolls',
      '  \x1b[36mundo\x1b[0m              Undo the last git command',
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
    const hint = this.hintEngine.getHint();
    this.writeLine(hint);
  }

  private maybeShowAutoHint(): void {
    const autoHint = this.hintEngine.getAutoHint();
    if (autoHint) {
      this.writeLine(autoHint);
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

  /** Run a single command and capture its output as a string */
  private async executeAndCapture(cmdLine: string): Promise<string> {
    const parsed = parseCommand(cmdLine);
    if (parsed.type === 'git') {
      const result = await this.engine.execute(parsed.command, parsed.args);
      this.hintEngine.recordAttempt(parsed.command, parsed.args, result.success, result.output);
      return result.output || '';
    } else if (parsed.type === 'builtin') {
      const rawArgs = parsed.command === 'echo'
        ? [cmdLine.slice(cmdLine.indexOf(' ') + 1)]
        : parsed.args;
      const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
      return result.output || '';
    }
    return `${parsed.command}: command not found`;
  }

  /** Run a single command, return true if successful */
  private async executeOneCommand(cmdLine: string): Promise<boolean> {
    const parsed = parseCommand(cmdLine);
    if (parsed.type === 'git') {
      const result = await this.engine.execute(parsed.command, parsed.args);
      if (result.output && result.output.startsWith('__DOCS__:')) {
        const cmdName = result.output.slice('__DOCS__:'.length);
        if (this.onDocRequest) this.onDocRequest(cmdName);
      } else if (result.output) {
        this.writeLine(result.output);
      }
      this.hintEngine.recordAttempt(parsed.command, parsed.args, result.success, result.output);
      this.maybeShowAutoHint();
      return result.success;
    } else if (parsed.type === 'builtin') {
      const rawArgs = parsed.command === 'echo'
        ? [cmdLine.slice(cmdLine.indexOf(' ') + 1)]
        : parsed.args;
      const result = await runBuiltin(parsed.command, rawArgs, this.engine.fs, this.engine.dir);
      if (result.output) this.writeLine(result.output);
      return result.success;
    } else if (parsed.type === 'edit') {
      const filepath = parsed.args[0];
      if (filepath && this.onEditRequest) {
        this.onEditRequest(filepath);
      } else {
        this.writeLine('usage: edit <file>');
      }
      return !!filepath;
    }
    this.writeLine(`${parsed.command}: command not found`);
    return false;
  }
}
