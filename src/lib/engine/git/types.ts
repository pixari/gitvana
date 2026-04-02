export interface CommandResult {
  output: string;
  success: boolean;
  error?: string;
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: { name: string; email: string; timestamp: number };
  parents: string[];
}

export interface BranchInfo {
  name: string;
  oid: string;
  isCurrent: boolean;
  isRemote?: boolean;
}

export interface FileStatus {
  path: string;
  status: 'untracked' | 'modified' | 'added' | 'deleted' | 'unchanged' | 'conflicted';
  staged: boolean;
}

export interface RepoState {
  initialized: boolean;
  currentBranch: string | null;
  branches: BranchInfo[];
  files: FileStatus[];
  recentCommits: CommitInfo[];
  headOid: string | null;
}

