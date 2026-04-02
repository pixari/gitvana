import git from 'isomorphic-git';
import type { GitEngine } from '../git/GitEngine.js';
import type { ValidatorConfig, ValidationResult } from '../../../levels/schema.js';

export class LevelValidator {
  constructor(private engine: GitEngine) {}

  async validate(validators: ValidatorConfig[]): Promise<ValidationResult> {
    const results = [];

    for (const validator of validators) {
      const result = await this.runValidator(validator);
      results.push(result);
    }

    return {
      passed: results.every((r) => r.passed),
      results,
    };
  }

  private async runValidator(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    try {
      switch (validator.type) {
        case 'file-exists':
          return await this.validateFileExists(validator);
        case 'file-content':
          return await this.validateFileContent(validator);
        case 'branch-exists':
          return await this.validateBranchExists(validator);
        case 'head-at':
          return await this.validateHeadAt(validator);
        case 'commit-count':
          return await this.validateCommitCount(validator);
        case 'staging-empty':
          return await this.validateStagingEmpty(validator);
        case 'commit-message-contains':
          return await this.validateCommitMessage(validator);
        case 'merge-commit-exists':
          return await this.validateMergeCommitExists(validator);
        case 'no-conflicts':
          return await this.validateNoConflicts(validator);
        case 'branch-deleted':
          return await this.validateBranchDeleted(validator);
        case 'tag-exists':
          return await this.validateTagExists(validator);
        case 'no-merge-commits':
          return await this.validateNoMergeCommits(validator);
        case 'file-not-exists':
          return await this.validateFileNotExists(validator);
        case 'remote-exists':
          return await this.validateRemoteExists(validator);
        case 'remote-branch-exists':
          return await this.validateRemoteBranchExists(validator);
        case 'pushed-to-remote':
          return await this.validatePushedToRemote(validator);
        default:
          return { validator, passed: false, message: `Unknown validator: ${validator.type}` };
      }
    } catch (err) {
      return {
        validator,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async validateFileExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { path, tracked } = validator.params as { path: string; tracked?: boolean };
    const fullPath = `${this.engine.dir}/${path}`;

    try {
      await this.engine.fs.promises.stat(fullPath);
    } catch {
      return { validator, passed: false, message: `File '${path}' does not exist` };
    }

    if (tracked === false) {
      // File should exist but NOT be tracked
      try {
        const matrix = await git.statusMatrix({ fs: this.engine.fs, dir: this.engine.dir });
        const entry = matrix.find(([f]) => f === path);
        if (entry && entry[3] !== 0) {
          return { validator, passed: false, message: `File '${path}' should not be tracked` };
        }
      } catch {
        // statusMatrix fails on repos with no commits — nothing is tracked
      }
    }

    return { validator, passed: true, message: `File '${path}' exists` };
  }

  private async validateFileContent(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { path, contains, containsAlso, notContains, equals } = validator.params as {
      path: string;
      contains?: string;
      containsAlso?: string;
      notContains?: string;
      equals?: string;
    };
    const fullPath = `${this.engine.dir}/${path}`;

    try {
      const content = (await this.engine.fs.promises.readFile(fullPath, 'utf8')) as string;

      if (equals !== undefined && content.trim() !== equals.trim()) {
        return { validator, passed: false, message: `File '${path}' content doesn't match expected` };
      }

      if (contains !== undefined && !content.includes(contains)) {
        return { validator, passed: false, message: `File '${path}' doesn't contain '${contains}'` };
      }

      if (containsAlso !== undefined && !content.includes(containsAlso)) {
        return { validator, passed: false, message: `File '${path}' doesn't contain '${containsAlso}'` };
      }

      if (notContains !== undefined && content.includes(notContains)) {
        return { validator, passed: false, message: `File '${path}' should not contain '${notContains}'` };
      }

      return { validator, passed: true, message: `File '${path}' content matches` };
    } catch {
      return { validator, passed: false, message: `Cannot read file '${path}'` };
    }
  }

  private async validateBranchExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { name } = validator.params as { name: string };
    try {
      const branches = await git.listBranches({ fs: this.engine.fs, dir: this.engine.dir });
      const exists = branches.includes(name);
      return {
        validator,
        passed: exists,
        message: exists ? `Branch '${name}' exists` : `Branch '${name}' not found`,
      };
    } catch {
      return { validator, passed: false, message: `Branch '${name}' not found` };
    }
  }

  private async validateHeadAt(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const params = validator.params as { branch?: string; ref?: string };
    const target = params.branch || params.ref || 'main';
    try {
      const current = await git.currentBranch({ fs: this.engine.fs, dir: this.engine.dir });
      const match = current === target;
      return {
        validator,
        passed: match,
        message: match ? `HEAD is at '${target}'` : `HEAD is at '${current}', expected '${target}'`,
      };
    } catch {
      return { validator, passed: false, message: `HEAD not found` };
    }
  }

  private async validateCommitCount(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const params = validator.params as { branch?: string; count?: number; min?: number; max?: number };
    const branch = params.branch;

    try {
      const ref = branch || 'HEAD';
      const commits = await git.log({ fs: this.engine.fs, dir: this.engine.dir, ref });

      // Exact count check (when count is provided without min)
      if (params.count !== undefined && params.min === undefined) {
        const match = commits.length === params.count;
        return {
          validator,
          passed: match,
          message: match
            ? `${commits.length} commits (exactly ${params.count})`
            : `${commits.length} commits, need exactly ${params.count}`,
        };
      }

      // Min check
      const required = params.min ?? 0;
      if (commits.length < required) {
        return {
          validator,
          passed: false,
          message: `Only ${commits.length} commits, need at least ${required}`,
        };
      }

      // Max check
      if (params.max !== undefined && commits.length > params.max) {
        return {
          validator,
          passed: false,
          message: `${commits.length} commits, need at most ${params.max}`,
        };
      }

      return {
        validator,
        passed: true,
        message: `${commits.length} commits (need ${required}${params.max !== undefined ? `-${params.max}` : '+'})`,
      };
    } catch {
      const required = params.count ?? params.min ?? 0;
      return { validator, passed: required === 0, message: `Need ${required} commit${required === 1 ? '' : 's'}` };
    }
  }

  private async validateStagingEmpty(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    try {
      const matrix = await git.statusMatrix({ fs: this.engine.fs, dir: this.engine.dir });
      const staged = matrix.filter(([, head, , stage]) => head !== stage);
      const empty = staged.length === 0;
      return {
        validator,
        passed: empty,
        message: empty ? 'Staging area is empty' : `${staged.length} files still staged`,
      };
    } catch {
      // No commits yet — check index directly
      try {
        const indexed = await git.listFiles({ fs: this.engine.fs, dir: this.engine.dir });
        const empty = indexed.length === 0;
        return {
          validator,
          passed: empty,
          message: empty ? 'Staging area is empty' : `${indexed.length} files staged`,
        };
      } catch {
        return { validator, passed: true, message: 'Staging area is empty' };
      }
    }
  }

  private async validateCommitMessage(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const params = validator.params as { message?: string; text?: string; notMessage?: string };
    const needle = params.message || params.text || '';
    const forbidden = params.notMessage;

    try {
      const commits = await git.log({ fs: this.engine.fs, dir: this.engine.dir, depth: 50 });
      if (commits.length === 0 && needle) {
        return { validator, passed: false, message: `Need commit with '${needle}'` };
      }

      if (needle) {
        const found = commits.some((c) =>
          c.commit.message.toLowerCase().includes(needle.toLowerCase()),
        );
        if (!found) {
          return { validator, passed: false, message: `No commit message contains '${needle}'` };
        }
      }

      if (forbidden) {
        const hasForbidden = commits.some((c) =>
          c.commit.message.toLowerCase().includes(forbidden.toLowerCase()),
        );
        if (hasForbidden) {
          return { validator, passed: false, message: `History still contains '${forbidden}' commits` };
        }
      }

      return { validator, passed: true, message: 'Commit messages match' };
    } catch {
      return { validator, passed: false, message: `Need commit with '${needle}'` };
    }
  }

  private async validateMergeCommitExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    try {
      const commits = await git.log({ fs: this.engine.fs, dir: this.engine.dir, depth: 20 });
      const mergeCommit = commits.find((c) => c.commit.parent.length >= 2);
      if (mergeCommit) {
        return { validator, passed: true, message: 'Merge commit found' };
      }
      return { validator, passed: false, message: 'No merge commit found' };
    } catch {
      return { validator, passed: false, message: 'No merge commit found' };
    }
  }

  private async validateNoConflicts(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    try {
      // Check if any file in working dir still has conflict markers
      const entries = await this.engine.fs.promises.readdir(this.engine.dir) as string[];
      for (const entry of entries) {
        if (entry === '.git') continue;
        try {
          const content = await this.engine.fs.promises.readFile(`${this.engine.dir}/${entry}`, 'utf8') as string;
          if (content.includes('<<<<<<<') || content.includes('>>>>>>>')) {
            return { validator, passed: false, message: `File '${entry}' still has conflict markers` };
          }
        } catch { /* skip non-readable */ }
      }
      return { validator, passed: true, message: 'No conflict markers found' };
    } catch {
      return { validator, passed: true, message: 'No conflict markers found' };
    }
  }

  private async validateBranchDeleted(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { name } = validator.params as { name: string };
    try {
      const branches = await git.listBranches({ fs: this.engine.fs, dir: this.engine.dir });
      const exists = branches.includes(name);
      return {
        validator,
        passed: !exists,
        message: exists ? `Branch '${name}' still exists` : `Branch '${name}' deleted`,
      };
    } catch {
      return { validator, passed: true, message: `Branch '${name}' deleted` };
    }
  }

  private async validateNoMergeCommits(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const params = validator.params as { branch?: string };
    try {
      const ref = params.branch || 'HEAD';
      const commits = await git.log({ fs: this.engine.fs, dir: this.engine.dir, ref, depth: 50 });
      const mergeCommit = commits.find((c) => c.commit.parent.length >= 2);
      if (mergeCommit) {
        return { validator, passed: false, message: `Found merge commit: "${mergeCommit.commit.message.trim()}"` };
      }
      return { validator, passed: true, message: 'No merge commits — history is linear' };
    } catch {
      return { validator, passed: true, message: 'No merge commits' };
    }
  }

  private async validateFileNotExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { path } = validator.params as { path: string };
    const fullPath = `${this.engine.dir}/${path}`;
    try {
      await this.engine.fs.promises.stat(fullPath);
      return { validator, passed: false, message: `File '${path}' should not exist` };
    } catch {
      return { validator, passed: true, message: `File '${path}' does not exist (correct)` };
    }
  }

  private async validateTagExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { name } = validator.params as { name: string };
    try {
      const tags = await git.listTags({ fs: this.engine.fs, dir: this.engine.dir });
      const exists = tags.includes(name);
      return {
        validator,
        passed: exists,
        message: exists ? `Tag '${name}' exists` : `Tag '${name}' not found`,
      };
    } catch {
      return { validator, passed: false, message: `Tag '${name}' not found` };
    }
  }

  private async validateRemoteExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { name } = validator.params as { name: string };
    const exists = this.engine.remotes.has(name);
    return {
      validator,
      passed: exists,
      message: exists ? `Remote '${name}' exists` : `Remote '${name}' not found`,
    };
  }

  private async validateRemoteBranchExists(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { remote, branch } = validator.params as { remote: string; branch: string };
    try {
      await git.resolveRef({
        fs: this.engine.fs,
        dir: this.engine.dir,
        ref: `refs/remotes/${remote}/${branch}`,
      });
      return { validator, passed: true, message: `Tracking ref '${remote}/${branch}' exists` };
    } catch {
      return { validator, passed: false, message: `Tracking ref '${remote}/${branch}' not found — did you fetch or push?` };
    }
  }

  private async validatePushedToRemote(
    validator: ValidatorConfig,
  ): Promise<{ validator: ValidatorConfig; passed: boolean; message: string }> {
    const { remote, branch } = validator.params as { remote: string; branch: string };
    const remoteInfo = this.engine.remotes.get(remote);
    if (!remoteInfo) {
      return { validator, passed: false, message: `Remote '${remote}' not found` };
    }
    try {
      // Check that the remote repo has the branch
      const remoteBranches = await git.listBranches({ fs: this.engine.fs, dir: remoteInfo.dir });
      if (!remoteBranches.includes(branch)) {
        return { validator, passed: false, message: `Branch '${branch}' not pushed to '${remote}'` };
      }
      // Check that local and remote are in sync
      const localOid = await git.resolveRef({ fs: this.engine.fs, dir: this.engine.dir, ref: branch });
      const remoteOid = await git.resolveRef({ fs: this.engine.fs, dir: remoteInfo.dir, ref: branch });
      if (localOid !== remoteOid) {
        return { validator, passed: false, message: `Branch '${branch}' is not in sync with '${remote}'` };
      }
      return { validator, passed: true, message: `Branch '${branch}' pushed to '${remote}'` };
    } catch (err) {
      return { validator, passed: false, message: `Push check failed: ${err instanceof Error ? err.message : err}` };
    }
  }
}
