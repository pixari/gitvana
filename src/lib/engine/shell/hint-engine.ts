import type { LevelDefinition, Hint } from '../../../levels/schema.js';
import { t } from '../../../i18n/index.js';

export interface CommandAttempt {
  command: string;
  args: string[];
  success: boolean;
  output: string;
}

/**
 * Error pattern → hints.json key mapping.
 * Keys (patterns) are substrings matched against raw command output and must
 * stay literal English — they match GitEngine/builtins error text, which is
 * intentionally not translated (see CONTRIBUTING_TRANSLATIONS.md).
 */
const ERROR_HINT_KEYS: Record<string, string> = {
  'not a git repository': 'error_not_a_git_repository',
  'pathspec': 'error_pathspec',
  'nothing to commit': 'error_nothing_to_commit',
  'CONFLICT': 'error_conflict',
  'not a valid object': 'error_not_a_valid_object',
  'Could not find': 'error_could_not_find',
  'detached HEAD': 'error_detached_head',
  'did not match any file': 'error_did_not_match_any_file',
  'not something we can merge': 'error_not_something_we_can_merge',
  'already exists': 'error_already_exists',
  'is not a commit': 'error_is_not_a_commit',
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
      return `\x1b[2m\x1b[33m${t('hints.stuck')}\x1b[0m`;
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
      return t('hints.no_hints_for_level');
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
        return this.formatHint(t('hints.been_at_it_a_while', { cmd: cmdName }));
      }
    }

    // Rule: no git commands tried yet
    const gitAttempts = this.attempts.filter(
      (a) => a.command !== 'hint' && a.command !== 'help' && a.command !== 'docs',
    );
    if (gitAttempts.length === 0) {
      return this.formatHint(t('hints.look_at_repo_state'));
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

    for (const [pattern, key] of Object.entries(ERROR_HINT_KEYS)) {
      if (output.includes(pattern)) {
        return t('hints.error_prefix', { cmd: fullCmd, explanation: t(`hints.${key}`) });
      }
    }

    // Generic error explanation
    if (output.startsWith('error:') || output.startsWith('fatal:')) {
      return t('hints.generic_error', { cmd: fullCmd, output: output.split('\n')[0] });
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
    const APPROACH_CONFLICTS: Record<string, { instead: string; hintKey: string }> = {
      merge: { instead: 'rebase', hintKey: 'approach_merge' },
      rebase: { instead: 'merge', hintKey: 'approach_rebase' },
      reset: { instead: 'revert', hintKey: 'approach_reset' },
      revert: { instead: 'reset', hintKey: 'approach_revert' },
      checkout: { instead: 'switch', hintKey: 'approach_checkout' },
    };

    for (const cmd of recentGitCmds) {
      const conflict = APPROACH_CONFLICTS[cmd];
      if (conflict && newCommands.includes(conflict.instead)) {
        return t(`hints.${conflict.hintKey}`);
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
    if (!this.level) return t('hints.no_hints_available');

    const newCmds = this.level.briefing.newCommands;
    if (newCmds.length > 0) {
      const cmdName = newCmds[0].split(' ')[1] || newCmds[0];
      return this.formatHint(t('hints.fallback_check_docs', { cmd: cmdName }));
    }

    return this.formatHint(t('hints.fallback_review_objectives'));
  }

  private formatHint(text: string): string {
    return `\x1b[33m${t('hints.hint_label')}\x1b[0m ${text}`;
  }

  private formatStaticHint(hint: Hint): string {
    let result = `\x1b[33m${t('hints.hint_label')}\x1b[0m ${hint.text}`;
    if (hint.command) {
      result += `\n\x1b[36m  ${hint.command}\x1b[0m`;
    }
    return result;
  }
}
