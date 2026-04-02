export interface LevelDefinition {
  id: string;
  act: number;
  order: number;
  title: string;
  subtitle: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mode: 'strict' | 'sandbox';

  briefing: {
    narrative: string;
    concept: string;
    objectives: string[];
    newCommands: string[];
  };

  initialState: {
    strategy: 'mount' | 'replay';
    fileTree?: Record<string, string | Record<string, unknown>>;
    replayScript?: ReplayStep[];
    head: string;
  };

  targetState: {
    validators: ValidatorConfig[];
  };

  constraints: {
    allowedCommands?: string[];
    blockedCommands?: string[];
    maxCommands?: number;
  };

  hints: Hint[];

  rewards: {
    stars: { maxCommands: { two: number; three: number } };
    achievement?: string;
  };
}

export interface ReplayStep {
  command: 'init' | 'writeFile' | 'deleteFile' | 'add' | 'remove' | 'commit' | 'branch' | 'deleteBranch' | 'checkout' | 'merge' | 'remote-add' | 'push' | 'remote-commit';
  args: Record<string, string>;
}

export interface ValidatorConfig {
  type:
    | 'file-exists'
    | 'file-content'
    | 'branch-exists'
    | 'branch-deleted'
    | 'head-at'
    | 'commit-count'
    | 'graph-shape'
    | 'staging-empty'
    | 'commit-message-contains'
    | 'merge-commit-exists'
    | 'no-conflicts'
    | 'tag-exists'
    | 'no-merge-commits'
    | 'file-not-exists'
    | 'remote-exists'
    | 'remote-branch-exists'
    | 'pushed-to-remote';
  params: Record<string, unknown>;
}

export interface Hint {
  trigger: 'manual' | 'after-attempts' | 'after-time' | 'on-error';
  triggerValue?: number;
  text: string;
  command?: string;
  penalty: number;
}

export interface ValidationResult {
  passed: boolean;
  results: { validator: ValidatorConfig; passed: boolean; message: string }[];
}
