import type { LevelDefinition, Hint } from '../../../levels/schema.js';

export interface CommandAttempt {
  command: string;
  args: string[];
  success: boolean;
  output: string;
}

/**
 * Error pattern → friendly explanation mapping.
 * Keys are substrings matched against command output.
 */
const ERROR_HINTS: Record<string, string> = {
  'not a git repository':
    "You need to initialize a git repository first. Try: git init",
  'pathspec':
    "The file you specified doesn't exist. Check the filename with: ls",
  'nothing to commit':
    "All your changes are already committed. Check: git status",
  'CONFLICT':
    "There's a merge conflict. Use 'edit <file>' to resolve it, then 'git add <file>' and 'git commit'",
  'not a valid object':
    "That commit hash doesn't exist. Use 'git log' to see available commits.",
  'Could not find':
    "That branch or ref doesn't exist. Use 'git branch' to see available branches.",
  'detached HEAD':
    "You're in detached HEAD state. Create a branch to save your work: git checkout -b <name>",
  'did not match any file':
    "That file doesn't match anything. Check available files with: ls",
  'not something we can merge':
    "The branch you're trying to merge doesn't exist. Use 'git branch' to list branches.",
  'already exists':
    "That name is already taken. Pick a different name or delete the existing one first.",
  'is not a commit':
    "That doesn't point to a valid commit. Use 'git log' to find the right reference.",
};

export class HintEngine {
  private attempts: CommandAttempt[] = [];
  private level: LevelDefinition | null = null;
  private hintCallCount = 0;
  private consecutiveFailures = 0;
  private autoHintShown = false;

  setLevel(level: LevelDefinition): void {
    this.level = level;
    this.attempts = [];
    this.hintCallCount = 0;
    this.consecutiveFailures = 0;
    this.autoHintShown = false;
  }

  recordAttempt(
    command: string,
    args: string[],
    success: boolean,
    output: string,
  ): void {
    this.attempts.push({ command, args, success, output });
    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }
  }

  /**
   * Returns a subtle auto-hint string if the player has hit 3+ consecutive
   * failures and hasn't been shown the auto-hint yet this level.
   * Returns null otherwise.
   */
  getAutoHint(): string | null {
    if (this.autoHintShown) return null;
    if (this.consecutiveFailures >= 3) {
      this.autoHintShown = true;
      return "\x1b[2m\x1b[33mStuck? Type 'hint' for guidance or 'docs' to read the manual.\x1b[0m";
    }
    return null;
  }

  /**
   * Produces a context-aware hint based on what the player has tried,
   * falling back to static hints from the level JSON.
   */
  getHint(): string {
    this.hintCallCount++;

    if (!this.level) {
      return 'No hints available for this level.';
    }

    // --- Priority 1: Context-aware hints ---
    const contextHint = this.getContextualHint();
    if (contextHint) return contextHint;

    // --- Priority 2: Static hints from level JSON ---
    const staticHint = this.getStaticHint();
    if (staticHint) return staticHint;

    // --- Priority 3: Fallback ---
    return this.getFallbackHint();
  }

  private getContextualHint(): string | null {
    if (!this.level) return null;

    const totalAttempts = this.attempts.length;

    // Rule: after 15+ attempts, suggest docs
    if (totalAttempts >= 15) {
      const newCmds = this.level.briefing.newCommands;
      if (newCmds.length > 0) {
        const cmdName = newCmds[0].split(' ')[1] || newCmds[0];
        return this.formatHint(
          `You've been at it a while. Type \`docs ${cmdName}\` to read about the commands you need.`,
        );
      }
    }

    // Rule: no git commands tried yet
    const gitAttempts = this.attempts.filter(
      (a) => a.command !== 'hint' && a.command !== 'help' && a.command !== 'docs',
    );
    if (gitAttempts.length === 0) {
      return this.formatHint(
        "Try looking at the repository state first. Type `git status` or `git log` to understand what you're working with.",
      );
    }

    // Rule: last command errored — explain the error
    const lastAttempt = this.attempts[this.attempts.length - 1];
    if (lastAttempt && !lastAttempt.success && lastAttempt.output) {
      const errorExplanation = this.explainError(lastAttempt);
      if (errorExplanation) {
        return this.formatHint(errorExplanation);
      }
    }

    // Rule: wrong approach detection — player used a related but wrong command
    const wrongApproach = this.detectWrongApproach();
    if (wrongApproach) {
      return this.formatHint(wrongApproach);
    }

    // Rule: 5+ attempts with no progress — fall through to static hints
    if (totalAttempts >= 5) {
      return null; // let static hints handle it
    }

    // Rule: 10+ attempts — show more specific static hints
    // (handled by getStaticHint with hintCallCount)

    return null;
  }

  private explainError(attempt: CommandAttempt): string | null {
    const output = attempt.output;
    const fullCmd =
      attempt.command +
      (attempt.args.length > 0 ? ' ' + attempt.args.join(' ') : '');

    for (const [pattern, explanation] of Object.entries(ERROR_HINTS)) {
      if (output.includes(pattern)) {
        return `Your last command \`${fullCmd}\` failed. ${explanation}`;
      }
    }

    // Generic error explanation
    if (output.startsWith('error:') || output.startsWith('fatal:')) {
      return `Your last command \`${fullCmd}\` failed: ${output.split('\n')[0]}. Check the objectives and try a different approach.`;
    }

    return null;
  }

  private detectWrongApproach(): string | null {
    if (!this.level) return null;

    const newCommands = this.level.briefing.newCommands.map((c) => {
      // Extract the git subcommand: "git rebase" -> "rebase"
      const parts = c.split(' ');
      return parts[0] === 'git' && parts[1] ? parts[1] : parts[0];
    });

    // Look at recent attempts for commands that are "close but wrong"
    const recentGitCmds = this.attempts
      .slice(-5)
      .filter((a) => a.command !== 'hint' && a.command !== 'help')
      .map((a) => a.command);

    // Approach mismatches
    const APPROACH_CONFLICTS: Record<string, { instead: string; hint: string }> = {
      merge: {
        instead: 'rebase',
        hint: "You're on the right track with git merge, but this level needs a different approach. Check the objectives again.",
      },
      rebase: {
        instead: 'merge',
        hint: "You're on the right track with git rebase, but this level wants you to use a different strategy. Re-read the objectives.",
      },
      reset: {
        instead: 'revert',
        hint: "git reset changes history, but this level might want you to preserve it. Consider git revert instead.",
      },
      revert: {
        instead: 'reset',
        hint: "git revert creates a new commit to undo changes, but this level might want you to rewrite history. Consider git reset.",
      },
      checkout: {
        instead: 'switch',
        hint: "git checkout works, but try using git switch — it's the modern way to change branches.",
      },
    };

    for (const cmd of recentGitCmds) {
      const conflict = APPROACH_CONFLICTS[cmd];
      if (conflict && newCommands.includes(conflict.instead)) {
        return conflict.hint;
      }
    }

    return null;
  }

  private getStaticHint(): string | null {
    if (!this.level || this.level.hints.length === 0) return null;

    const totalAttempts = this.attempts.length;
    const hints = this.level.hints;

    // On repeated hint calls, cycle through static hints
    // First call might be contextual, subsequent ones use static
    const staticIndex = Math.min(this.hintCallCount - 1, hints.length - 1);

    // Filter hints based on trigger conditions
    const eligibleHints = hints.filter((h) => {
      if (h.trigger === 'manual') return true;
      if (h.trigger === 'after-attempts' && h.triggerValue && totalAttempts >= h.triggerValue) return true;
      if (h.trigger === 'on-error') {
        const hasErrors = this.attempts.some((a) => !a.success);
        if (hasErrors) return true;
      }
      return false;
    });

    if (eligibleHints.length === 0) {
      // Show first hint anyway if player explicitly asked
      if (hints.length > 0) {
        return this.formatStaticHint(hints[0]);
      }
      return null;
    }

    // Pick the most appropriate hint based on how many times hint was called
    const hintIndex = Math.min(staticIndex, eligibleHints.length - 1);
    return this.formatStaticHint(eligibleHints[Math.max(0, hintIndex)]);
  }

  private getFallbackHint(): string {
    if (!this.level) return 'No hints available.';

    const newCmds = this.level.briefing.newCommands;
    if (newCmds.length > 0) {
      const cmdName = newCmds[0].split(' ')[1] || newCmds[0];
      return this.formatHint(
        `Check the docs for guidance. Type \`docs ${cmdName}\` to read the manual.`,
      );
    }

    return this.formatHint(
      "Review the objectives panel and try re-reading the level briefing for clues.",
    );
  }

  private formatHint(text: string): string {
    return `\x1b[33mHint:\x1b[0m ${text}`;
  }

  private formatStaticHint(hint: Hint): string {
    let result = `\x1b[33mHint:\x1b[0m ${hint.text}`;
    if (hint.command) {
      result += `\n\x1b[36m  ${hint.command}\x1b[0m`;
    }
    return result;
  }
}
