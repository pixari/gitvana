import type { CommandDoc } from '../types.js';

export const commandDocs: Record<string, CommandDoc> = {
  init: {
    name: 'init',
    syntax: 'git init',
    description:
      '"git init" creates the .git directory inside your project, which is where git stores all version history -- every commit, branch, and object. This directory contains objects/ (the content-addressed store), refs/ (branch and tag pointers), HEAD (the current branch pointer), and the index (staging area). Without this directory, git commands have nothing to work with. Running "git init" is declaring that this directory is now a repository.',
    options: [
      { flag: '--bare', description: 'Create a bare repository (no working directory, used for remotes)' },
    ],
    examples: [
      { command: 'git init', explanation: 'Initialize a new repository in the current directory' },
      { command: 'git init my-project', explanation: 'Create a new directory "my-project" and initialize a repo inside it' },
    ],
    tip: 'You almost never need "git init" in practice. Most of the time you\'ll "git clone" an existing repo. But when starting something truly new, this is where it begins.',
    related: ['clone', 'status'],
    seeAlso: ['how-git-stores-data'],
  },

  add: {
    name: 'add',
    syntax: 'git add <pathspec>...',
    description:
      '"git add" copies the current contents of specified files into the staging area (the index). This is not "tracking" a file -- it\'s snapshotting its current state into a preparation zone for the next commit. If you modify a file after running "git add", the staging area still holds the old version. You must add again to update it. This design lets you control exactly what goes into each commit, even staging parts of a file with "git add -p".',
    options: [
      { flag: '-A, --all', description: 'Stage all changes (new, modified, deleted) in the entire working tree' },
      { flag: '-p, --patch', description: 'Interactively choose hunks of changes to stage' },
      { flag: '.', description: 'Stage all changes in the current directory and below' },
    ],
    examples: [
      { command: 'git add README.md', explanation: 'Stage a single file' },
      { command: 'git add .', explanation: 'Stage everything in the current directory' },
      { command: 'git add -A', explanation: 'Stage all changes across the entire repo' },
      { command: 'git add src/*.ts', explanation: 'Stage all TypeScript files in the src directory' },
    ],
    tip: 'Use "git add -p" to stage parts of a file. It\'s the secret weapon for making clean, focused commits instead of dumping everything in at once.',
    related: ['status', 'commit', 'reset', 'diff'],
    seeAlso: ['the-three-areas'],
  },

  commit: {
    name: 'commit',
    syntax: 'git commit [-m <message>]',
    description:
      '"git commit" takes everything in the staging area and creates a permanent snapshot -- a commit object containing a tree (all files), parent pointer(s), author/committer info, and your message. The commit hash is computed from all of these fields, which is why you can\'t edit a commit -- any change produces a different hash. Each commit forms a link in the history chain, pointing back to its parent.',
    options: [
      { flag: '-m, --message <message>', description: 'Provide the commit message inline' },
      { flag: '-a, --all', description: 'Automatically stage all modified/deleted files before committing (skips untracked)' },
      { flag: '--amend', description: 'Replace the last commit with a new one (rewrite history -- use with care)' },
    ],
    examples: [
      { command: 'git commit -m "Add user login feature"', explanation: 'Commit staged changes with a message' },
      { command: 'git commit -am "Fix typo in README"', explanation: 'Stage all tracked changes and commit in one step' },
      { command: 'git commit --amend -m "Better message"', explanation: 'Replace the last commit message (only if you haven\'t pushed!)' },
    ],
    tip: 'Write commit messages in the imperative mood: "Add feature" not "Added feature". Think of it as completing the sentence: "If applied, this commit will ___."',
    advanced: '## commit --amend\n\nMade a typo in your commit message? Forgot to stage a file? "--amend" lets you rewrite the most recent commit. It replaces the last commit entirely -- same parent, new snapshot.\n\n**Important:** Only amend commits you haven\'t pushed yet. Amending a pushed commit rewrites history and will cause pain for anyone who pulled the original.\n\n```\ngit commit --amend -m "Corrected message"\ngit add forgotten-file.ts && git commit --amend --no-edit\n```\n\nThe second form adds a forgotten file to the last commit without changing the message.',
    related: ['add', 'status', 'log', 'reset'],
    seeAlso: ['what-is-a-commit', 'the-three-areas'],
  },

  status: {
    name: 'status',
    syntax: 'git status',
    description:
      '"git status" compares the three areas of git pairwise and reports the differences. "Changes to be committed" shows what differs between the staging area and the last commit. "Changes not staged for commit" shows what differs between your working directory and the staging area. "Untracked files" shows files that exist on disk but not in the index. It is read-only and completely safe -- it never changes anything.',
    options: [
      { flag: '-s, --short', description: 'Show a compact status output (one line per file)' },
      { flag: '-b, --branch', description: 'Show branch and tracking info even in short mode' },
    ],
    examples: [
      { command: 'git status', explanation: 'See the full status of your working directory' },
      { command: 'git status -s', explanation: 'Compact view: M=modified, A=added, ??=untracked' },
    ],
    tip: 'When in doubt, "git status". It\'s free, it doesn\'t change anything, and it tells you exactly what git sees. It\'s the most harmless and helpful command you can run.',
    related: ['add', 'diff', 'commit', 'log'],
    seeAlso: ['the-three-areas'],
  },

  log: {
    name: 'log',
    syntax: 'git log [options]',
    description:
      '"git log" traverses the commit graph starting from HEAD, following parent pointers backward through history. Each entry shows the commit hash, author, date, and message. With "--graph", it visualizes the DAG structure of branches and merges as ASCII art. With "--oneline", it condenses each commit to a single line. The log is a read-only view of the commit chain -- your time machine for inspecting what happened and when.',
    options: [
      { flag: '--oneline', description: 'Show each commit as a single line (short hash + message)' },
      { flag: '--graph', description: 'Draw a text-based graph of the branch structure' },
      { flag: '-n, --max-count <number>', description: 'Show only the last n commits' },
      { flag: '--all', description: 'Show commits from all branches, not just the current one' },
    ],
    examples: [
      { command: 'git log --oneline', explanation: 'Quick overview of recent commits' },
      { command: 'git log --oneline --graph --all', explanation: 'The beautiful branch visualization everyone screenshots' },
      { command: 'git log -3', explanation: 'Show only the last 3 commits' },
    ],
    tip: 'Alias "git log --oneline --graph --all" to something short like "git lg". You\'ll use it a hundred times a day.',
    related: ['status', 'diff', 'show'],
    seeAlso: ['what-is-a-commit', 'how-git-stores-data'],
  },

  diff: {
    name: 'diff',
    syntax: 'git diff [options] [<path>...]',
    description:
      '"git diff" computes the line-by-line differences between two states of your files. With no arguments, it compares the working directory to the staging area (unstaged changes). With "--staged", it compares the staging area to the last commit (what will be committed). With "HEAD", it shows all changes vs the last commit. Git computes diffs on the fly from snapshots -- it doesn\'t store diffs as its data model.',
    options: [
      { flag: '--staged', description: 'Show changes that are staged (ready to commit)' },
      { flag: '--stat', description: 'Show a summary of changes (files changed, insertions, deletions)' },
      { flag: 'HEAD', description: 'Compare working directory to the last commit' },
    ],
    examples: [
      { command: 'git diff', explanation: 'Show unstaged changes in the working directory' },
      { command: 'git diff --staged', explanation: 'Show what\'s staged and about to be committed' },
      { command: 'git diff HEAD', explanation: 'Show all changes (staged + unstaged) vs last commit' },
      { command: 'git diff main..feature', explanation: 'Compare two branches' },
    ],
    tip: 'Always run "git diff --staged" before committing. It\'s your last chance to catch that debug console.log you accidentally left in.',
    related: ['status', 'add', 'commit', 'log'],
    seeAlso: ['the-three-areas'],
  },

  branch: {
    name: 'branch',
    syntax: 'git branch [<name>] [<start-point>] [-d <name>]',
    description:
      'A branch is a 41-byte file in .git/refs/heads/ containing a commit hash -- nothing more. "git branch" lists, creates, or deletes these pointers. Creating a branch is nearly instant because git is just writing a hash to a file. When you commit, the current branch pointer advances to the new commit. Other branches remain unchanged. This is why branches in git are so cheap and why the "branch often" philosophy works.',
    options: [
      { flag: '-a, --all', description: 'List both local and remote branches' },
      { flag: '-d, --delete <name>', description: 'Delete a branch (safe -- won\'t delete unmerged work)' },
      { flag: '-D, --force-delete <name>', description: 'Force-delete a branch (even if unmerged -- dangerous!)' },
      { flag: '<name> <start-point>', description: 'Create a new branch at the specified commit or ref instead of HEAD' },
    ],
    examples: [
      { command: 'git branch', explanation: 'List all local branches (current one has an asterisk)' },
      { command: 'git branch feature-login', explanation: 'Create a new branch called "feature-login" at HEAD' },
      { command: 'git branch hotfix abc1234', explanation: 'Create a branch starting at a specific commit' },
      { command: 'git branch -d feature-login', explanation: 'Delete the branch after merging' },
    ],
    tip: 'Creating a branch doesn\'t switch to it! Use "git switch" or "git checkout" after creating. Or use "git checkout -b <name>" to create and switch in one step.',
    related: ['switch', 'checkout', 'merge', 'log'],
    seeAlso: ['refs-and-head'],
  },

  checkout: {
    name: 'checkout',
    syntax: 'git checkout [-b <name>] <branch|commit> | git checkout <ref> -- <file>',
    description:
      '"git checkout" serves two distinct purposes: switching branches and restoring files. When given a branch name, it moves HEAD to that branch and updates the working directory. When given a commit hash, it puts you in "detached HEAD" state -- HEAD points directly to a commit, not a branch. With the "<ref> -- <file>" form, it restores a specific file from any commit without leaving your current branch. Modern git splits these duties into "switch" (branches) and "restore" (files) for clarity.',
    options: [
      { flag: '-b <name>', description: 'Create a new branch and switch to it' },
      { flag: '<ref> -- <file>', description: 'Restore a file from a specific commit (requires both a ref and a path)' },
      { flag: 'HEAD@{N}', description: 'Checkout the Nth previous HEAD position from the reflog' },
    ],
    examples: [
      { command: 'git checkout main', explanation: 'Switch to the main branch' },
      { command: 'git checkout -b new-feature', explanation: 'Create and switch to a new branch' },
      { command: 'git checkout HEAD -- README.md', explanation: 'Restore README.md from the latest commit (overwrites working copy and stages it)' },
      { command: 'git checkout abc1234 -- config.ts', explanation: 'Restore config.ts as it was at commit abc1234' },
      { command: 'git checkout HEAD@{2}', explanation: 'Jump to where HEAD was two moves ago (from the reflog)' },
    ],
    tip: 'Prefer "git switch" for changing branches. The "checkout <ref> -- <file>" form is powerful for restoring individual files from any point in history without leaving your current branch.',
    related: ['switch', 'branch', 'reset', 'log'],
    seeAlso: ['refs-and-head', 'the-reflog'],
  },

  switch: {
    name: 'switch',
    syntax: 'git switch [-b <name>] <branch>',
    description:
      '"git switch" does one thing: move HEAD to a different branch and update the working directory to match. It was split out of "checkout" to eliminate confusion between switching branches and restoring files. Use "-b" to create a new branch and switch in one step. Under the hood, it updates the HEAD symref to point to the new branch.',
    options: [
      { flag: '<branch>', description: 'Switch to an existing branch' },
      { flag: '-b <name>', description: 'Create a new branch and switch to it' },
    ],
    examples: [
      { command: 'git switch main', explanation: 'Switch to the main branch' },
      { command: 'git switch -b feature-auth', explanation: 'Create and switch to "feature-auth"' },
    ],
    tip: 'In Gitvana, "git switch" is an alias for "git checkout", so both commands behave identically. Use whichever feels natural.',
    related: ['checkout', 'branch', 'merge'],
    seeAlso: ['refs-and-head'],
  },

  merge: {
    name: 'merge',
    syntax: 'git merge <branch>',
    description:
      '"git merge" integrates changes from another branch into your current branch. If the branches haven\'t diverged, git performs a "fast-forward" -- it simply moves the branch pointer ahead. If they have diverged, git creates a merge commit with two parents, combining both histories. When the same lines were changed on both sides, git cannot auto-resolve and reports a merge conflict for you to fix manually.',
    options: [
      { flag: '--no-ff', description: 'Force a merge commit even if fast-forward is possible (preserves branch history)' },
      { flag: '--abort', description: 'Abort a merge in progress and go back to the pre-merge state' },
      { flag: '--squash', description: 'Squash all commits into one before merging (no merge commit)' },
    ],
    examples: [
      { command: 'git merge feature-login', explanation: 'Merge "feature-login" into the current branch' },
      { command: 'git merge --no-ff feature-login', explanation: 'Merge with a merge commit (shows in history that a branch existed)' },
      { command: 'git merge --abort', explanation: 'Bail out of a conflicted merge' },
    ],
    tip: 'Always merge from an up-to-date main branch. Run "git pull" on main first, then merge. Otherwise you\'re merging into a stale version and creating unnecessary conflicts.',
    related: ['branch', 'switch', 'rebase', 'log'],
    seeAlso: ['merge-vs-rebase', 'conflict-resolution'],
  },

  rm: {
    name: 'rm',
    syntax: 'git rm [options] <file>...',
    description:
      '"git rm" removes a file from both the working directory and the staging area in one step. This is different from just deleting a file with your OS -- if you delete a file manually, git sees it as "deleted but not staged." "git rm" stages the deletion so the next commit will record the file\'s removal. With "--cached", it removes the file from the staging area only, keeping it on disk -- useful for untracking files you committed by mistake.',
    options: [
      { flag: '--cached', description: 'Remove from the staging area / index only -- keep the file on disk (useful for untracking files)' },
      { flag: '-f, --force', description: 'Force removal even if the file has local modifications' },
      { flag: '-r, --recursive', description: 'Recursively remove a directory and all its contents' },
    ],
    examples: [
      { command: 'git rm secret.txt', explanation: 'Delete the file from disk and stage the removal' },
      { command: 'git rm --cached .env', explanation: 'Stop tracking .env but keep it on disk (pair with .gitignore)' },
      { command: 'git rm -r old-folder/', explanation: 'Recursively remove a directory from git' },
      { command: 'git rm "*.log"', explanation: 'Remove all .log files (quote the glob so your shell doesn\'t expand it)' },
    ],
    tip: 'The most common use of "git rm --cached" is when you accidentally committed a file that should be in .gitignore (like .env or node_modules). Remove it from tracking with --cached, add it to .gitignore, then commit. The file stays on your machine but git forgets about it.',
    related: ['add', 'status', 'reset', 'commit'],
    seeAlso: ['the-three-areas'],
  },

  reset: {
    name: 'reset',
    syntax: 'git reset [--soft|--mixed|--hard] [<commit>] | git reset [HEAD] <file>',
    description:
      '"git reset" moves the current branch pointer to a different commit. The three modes control what happens to the changes between the old and new positions. "--soft" keeps them staged. "--mixed" (default) unstages them but keeps the files modified. "--hard" discards everything. When used with a file path instead of a commit, it doesn\'t move the branch pointer -- it just copies that file from the specified commit (or HEAD) into the staging area, effectively unstaging it.',
    options: [
      { flag: '--soft', description: 'Move HEAD back but keep changes staged (gentle undo)' },
      { flag: '--mixed', description: 'Move HEAD back and unstage changes (default -- keeps files intact)' },
      { flag: '--hard', description: 'Move HEAD back and DELETE all changes (destructive -- no undo!)' },
      { flag: 'HEAD~N', description: 'Target: N commits before the current HEAD' },
      { flag: '<file>', description: 'Unstage a specific file (without moving HEAD)' },
    ],
    examples: [
      { command: 'git reset', explanation: 'Unstage all staged changes (keep the file modifications)' },
      { command: 'git reset HEAD README.md', explanation: 'Unstage README.md (keep the file changes)' },
      { command: 'git reset app.ts', explanation: 'Unstage app.ts without the HEAD prefix' },
      { command: 'git reset --soft HEAD~1', explanation: 'Undo last commit but keep changes staged' },
      { command: 'git reset --mixed HEAD~3', explanation: 'Undo last 3 commits, keep files but unstage them' },
      { command: 'git reset --hard HEAD~1', explanation: 'Completely undo last commit and discard all changes' },
    ],
    tip: 'If you accidentally "git reset --hard" and lose work, don\'t panic. "git reflog" shows recent HEAD positions, and you can often recover with "git reset --hard <hash>". The reflog keeps entries for about 90 days.',
    related: ['checkout', 'revert', 'log', 'reflog'],
    seeAlso: ['the-three-areas', 'rewriting-history'],
  },

  tag: {
    name: 'tag',
    syntax: 'git tag [<name>] [-a <name> -m <message>] [-d <name>]',
    description:
      'A tag is a named pointer to a specific commit, like a branch that never moves. Lightweight tags are simple pointers -- a file in .git/refs/tags/ containing a commit hash. Annotated tags are full git objects that store the tagger\'s name, email, date, and a message in addition to the commit reference. Tags are typically used to mark release points (v1.0, v2.3.1) so you can easily find important commits without memorizing hashes.',
    options: [
      { flag: '<name>', description: 'Create a lightweight tag at HEAD' },
      { flag: '<name> <commit>', description: 'Create a lightweight tag at a specific commit' },
      { flag: '-a, --annotate <name> -m, --message <msg>', description: 'Create an annotated tag with a message (includes tagger info and date)' },
      { flag: '-d, --delete <name>', description: 'Delete a tag' },
      { flag: '-l, --list', description: 'List all tags' },
    ],
    examples: [
      { command: 'git tag', explanation: 'List all existing tags' },
      { command: 'git tag v1.0', explanation: 'Create a lightweight tag "v1.0" at the current commit' },
      { command: 'git tag v0.9 HEAD~3', explanation: 'Tag the commit three steps back' },
      { command: 'git tag -a v2.0 -m "Major release"', explanation: 'Create an annotated tag with a message' },
      { command: 'git tag -d v1.0-beta', explanation: 'Delete a tag you no longer need' },
    ],
    tip: 'Use annotated tags (-a) for releases and lightweight tags for temporary or personal bookmarks. Annotated tags store who created them and when, which matters when you\'re shipping software.',
    related: ['log', 'commit', 'branch'],
    seeAlso: ['refs-and-head'],
  },

  'cherry-pick': {
    name: 'cherry-pick',
    syntax: 'git cherry-pick <commit>',
    description:
      '"git cherry-pick" takes a single commit from anywhere in the repository and replays its diff onto your current branch, creating a new commit. The new commit has the same changes but a different hash (different parent, different timestamp). Cherry-picking duplicates rather than moves work, so use it sparingly -- it\'s ideal for grabbing a specific bugfix from another branch without merging the entire branch.',
    options: [
      { flag: '<commit>', description: 'The commit hash (full or short) to apply onto the current branch' },
    ],
    examples: [
      { command: 'git cherry-pick abc1234', explanation: 'Apply commit abc1234 onto the current branch' },
      { command: 'git cherry-pick HEAD~2', explanation: 'Cherry-pick the commit two steps before HEAD' },
    ],
    tip: 'Cherry-pick is ideal for hotfixes: fix a bug on a feature branch, then cherry-pick that single fix onto main without merging the whole feature. But remember, the cherry-picked commit gets a new hash -- it\'s a copy, not a move.',
    related: ['merge', 'log', 'commit', 'show'],
    seeAlso: ['rewriting-history'],
  },

  show: {
    name: 'show',
    syntax: 'git show [<commit>] [<commit>:<file>]',
    description:
      '"git show" displays the full details of a commit: hash, author, date, message, and the computed diff against its parent. With the "<commit>:<file>" syntax, it displays the contents of a specific file as it existed at that commit -- without checking it out or modifying your working directory. It\'s a read-only inspection tool for examining any point in your repository\'s history.',
    options: [
      { flag: '<commit>', description: 'Show details and diff for a specific commit (defaults to HEAD)' },
      { flag: '<commit>:<file>', description: 'Show the contents of a file at a specific commit' },
    ],
    examples: [
      { command: 'git show', explanation: 'Show the latest commit with its diff' },
      { command: 'git show HEAD~2', explanation: 'Show the commit two steps back' },
      { command: 'git show abc1234', explanation: 'Show a specific commit by hash' },
      { command: 'git show HEAD:README.md', explanation: 'Show README.md as it exists in the latest commit' },
    ],
    tip: 'Use "git show <commit>:<file>" when you need to see what a file looked like at a past commit without checking it out. It\'s read-only and completely safe.',
    related: ['log', 'diff', 'cherry-pick'],
    seeAlso: ['what-is-a-commit'],
  },

  revert: {
    name: 'revert',
    syntax: 'git revert <commit>',
    description:
      '"git revert" creates a NEW commit that undoes the changes of a specified previous commit. Unlike "reset", which moves the branch pointer backward (rewriting history), "revert" moves history forward -- the original commit stays in the log. This makes revert safe for commits that have already been pushed and shared, because it doesn\'t rewrite anything others depend on.',
    options: [
      { flag: '<commit>', description: 'The commit hash or ref (e.g., HEAD~1) whose changes should be undone' },
    ],
    examples: [
      { command: 'git revert HEAD', explanation: 'Undo the most recent commit by creating a new revert commit' },
      { command: 'git revert HEAD~2', explanation: 'Undo the commit three steps back (only that specific commit)' },
      { command: 'git revert abc1234', explanation: 'Undo a specific commit by its hash' },
    ],
    tip: 'Use "revert" instead of "reset" when the commit has already been pushed to a shared repository. Revert adds history; reset erases it.',
    related: ['reset', 'log', 'cherry-pick', 'commit'],
    seeAlso: ['rewriting-history'],
  },

  stash: {
    name: 'stash',
    syntax: 'git stash [push|pop|list|drop]',
    description:
      '"git stash" saves your uncommitted changes (both staged and unstaged) to a temporary storage stack and restores a clean working directory. This lets you switch branches or pull updates without committing half-finished work. "git stash pop" re-applies the most recent stash and removes it from the stack. The stash is a stack (LIFO) -- you can have multiple entries, listed with "git stash list" and referenced as stash@{0}, stash@{1}, etc.',
    options: [
      { flag: 'push', description: 'Save your uncommitted changes to the stash (default when no subcommand given)' },
      { flag: 'pop', description: 'Apply the most recent stash entry and remove it from the stash' },
      { flag: 'list', description: 'Show all stash entries' },
      { flag: 'drop [stash@{N}]', description: 'Remove a stash entry without applying it' },
    ],
    examples: [
      { command: 'git stash', explanation: 'Stash all uncommitted changes' },
      { command: 'git stash pop', explanation: 'Restore the most recently stashed changes' },
      { command: 'git stash list', explanation: 'See all stashed entries' },
      { command: 'git stash drop', explanation: 'Discard the most recent stash entry' },
      { command: 'git stash drop stash@{2}', explanation: 'Discard a specific stash entry' },
    ],
    tip: 'Stash is your "quick save" button. Use it before switching branches when you have work in progress. But don\'t let stashes pile up -- they\'re meant to be temporary.',
    related: ['checkout', 'switch', 'status', 'reset'],
    seeAlso: ['the-three-areas'],
  },

  reflog: {
    name: 'reflog',
    syntax: 'git reflog',
    description:
      'The reflog records every time HEAD moves -- every commit, checkout, reset, merge, and rebase. Even if a commit becomes unreachable from any branch (after a hard reset or deleted branch), it still appears in the reflog for about 90 days. This makes the reflog your primary recovery tool: find the hash of a lost commit in the reflog, then create a branch there or reset to it.',
    options: [],
    examples: [
      { command: 'git reflog', explanation: 'Show the full history of HEAD movements' },
    ],
    tip: 'Lost a commit after a hard reset? Run "git reflog", find the hash of the commit you want, and "git reset --hard <hash>" to get it back. The reflog typically keeps entries for 90 days.',
    related: ['reset', 'log', 'checkout', 'revert'],
    seeAlso: ['the-reflog', 'refs-and-head'],
  },

  rebase: {
    name: 'rebase',
    syntax: 'git rebase <branch>',
    description:
      '"git rebase" replays your branch\'s commits on top of another branch, one at a time. Each replayed commit gets a new hash because its parent changed. The result is a linear history -- as if you started your work from the tip of the target branch. This produces cleaner logs than merge but rewrites commit hashes, making it unsafe for shared/pushed commits. Rebase your local feature branch; merge into shared branches.',
    options: [
      { flag: '<branch>', description: 'Replay current branch\'s commits on top of the specified branch' },
      { flag: '--continue', description: 'Continue the rebase after resolving conflicts' },
      { flag: '--abort', description: 'Abort the rebase and return to the original state' },
    ],
    examples: [
      { command: 'git rebase main', explanation: 'Replay current branch\'s commits on top of main' },
      { command: 'git rebase --continue', explanation: 'Continue after fixing a conflict during rebase' },
      { command: 'git rebase --abort', explanation: 'Give up and go back to where you started' },
    ],
    tip: 'The golden rule: never rebase commits that have been pushed to a shared branch. Rebase rewrites commit hashes, which confuses everyone who already has the old ones.',
    advanced: '## Rebase vs Merge\n\nBoth integrate changes, but they tell different stories:\n- **Merge** preserves the full branching history (a merge commit with two parents).\n- **Rebase** rewrites history to be linear (as if you started your work from the tip of the target branch).\n\nRebase is cleaner for feature branches before merging. The workflow: rebase your feature onto main, then fast-forward merge into main. The result is a straight line of commits.',
    related: ['merge', 'branch', 'cherry-pick', 'log'],
    seeAlso: ['merge-vs-rebase', 'rewriting-history'],
  },

  blame: {
    name: 'blame',
    syntax: 'git blame <file>',
    description:
      '"git blame" annotates each line of a file with the commit that last modified it, including the commit hash, author, and date. It\'s a forensic tool for understanding the history behind any line of code -- who wrote it, when, and (via the commit message) why. Despite the name, it\'s for understanding context, not assigning fault.',
    options: [
      { flag: '<file>', description: 'The file to annotate with per-line commit information' },
    ],
    examples: [
      { command: 'git blame README.md', explanation: 'Show who last changed each line of README.md' },
      { command: 'git blame config.ts', explanation: 'Trace the origin of each line in config.ts' },
    ],
    tip: 'When "git blame" shows a commit that was just a reformatting change, use "git log" on that file to dig deeper. The real author of a line might be several commits back. In real git, "git blame -w" ignores whitespace changes to help with this.',
    related: ['log', 'show', 'diff'],
  },

  bisect: {
    name: 'bisect',
    syntax: 'git bisect <start|good|bad|reset>',
    description:
      '"git bisect" performs a binary search through commit history to find which commit introduced a bug. You mark one commit as "bad" (has the bug) and one as "good" (doesn\'t), and git checks out the midpoint for you to test. After each test, you report good or bad, and git eliminates half the remaining range. In O(log n) steps -- about 10 for 1000 commits -- the guilty commit is identified. It can also be fully automated with "git bisect run <test-script>".',
    options: [
      { flag: 'start', description: 'Begin a bisect session' },
      { flag: 'bad [<commit>]', description: 'Mark the current (or specified) commit as bad (has the bug)' },
      { flag: 'good [<commit>]', description: 'Mark the current (or specified) commit as good (no bug)' },
      { flag: 'reset', description: 'End the bisect session and return to the original branch' },
    ],
    examples: [
      { command: 'git bisect start', explanation: 'Begin the bisect process' },
      { command: 'git bisect bad', explanation: 'Mark the current commit as having the bug' },
      { command: 'git bisect good HEAD~10', explanation: 'Mark a known-good commit from the past' },
      { command: 'git bisect reset', explanation: 'Finish bisecting and go back to your branch' },
    ],
    tip: 'The typical bisect workflow: start, mark current as bad, mark an old known-good commit as good, then test each checkout and report good/bad. With 1000 commits, bisect finds the culprit in about 10 steps.',
    related: ['log', 'checkout', 'show'],
    seeAlso: ['bisect-debugging'],
  },

  remote: {
    name: 'remote',
    syntax: 'git remote [add|remove] <name> [<url>]',
    description:
      '"git remote" manages connections to other copies of your repository. A remote is a bookmark -- it stores a name (usually "origin") and a URL so you don\'t have to type the full address every time you push or fetch. The remote itself doesn\'t contain any code; it\'s just a reference. Actual data transfer happens through "push", "fetch", and "pull".',
    options: [
      { flag: '-v, --verbose', description: 'Show remote URLs alongside names' },
      { flag: 'add <name> <url>', description: 'Register a new remote with the given name and URL' },
      { flag: 'remove <name>', description: 'Unregister a remote and clean up its tracking refs' },
    ],
    examples: [
      { command: 'git remote', explanation: 'List all configured remote names' },
      { command: 'git remote -v', explanation: 'Show remote names with their URLs' },
      { command: 'git remote add origin https://github.com/you/repo.git', explanation: 'Add a remote named "origin"' },
      { command: 'git remote remove upstream', explanation: 'Remove a remote named "upstream"' },
    ],
    tip: '"origin" is just a convention -- it\'s the default name for the remote you cloned from. You can name remotes whatever you want and have multiple remotes (e.g., "origin" for your fork and "upstream" for the original repo).',
    related: ['push', 'fetch', 'pull'],
  },

  push: {
    name: 'push',
    syntax: 'git push [<remote>] [<branch>]',
    description:
      '"git push" uploads your local commits to a remote repository. It sends new commit objects and updates the remote branch ref to point to your latest commit. By default it pushes to "origin" and the current branch. Push only works if the remote branch can be fast-forwarded to your commits -- if someone else pushed first, you need to pull and merge before pushing.',
    options: [
      { flag: '-u, --set-upstream', description: 'Set the upstream tracking branch (so future "git push" works without arguments)' },
      { flag: '-f, --force', description: 'Force-push even if the remote has diverged (DANGER: overwrites remote history)' },
    ],
    examples: [
      { command: 'git push', explanation: 'Push current branch to its upstream remote' },
      { command: 'git push origin main', explanation: 'Push the "main" branch to the "origin" remote' },
      { command: 'git push -u origin feature', explanation: 'Push "feature" and set upstream tracking' },
      { command: 'git push --force', explanation: 'Force-push (use with extreme caution!)' },
    ],
    tip: 'Never force-push to a shared branch unless you know what you\'re doing. It rewrites remote history and can destroy other people\'s work. If "git push" is rejected, pull first to integrate remote changes.',
    related: ['fetch', 'pull', 'remote'],
  },

  fetch: {
    name: 'fetch',
    syntax: 'git fetch [<remote>] [--all]',
    description:
      '"git fetch" downloads new commits from a remote without changing your working directory or current branch. It updates your remote tracking refs (e.g., "origin/main") so you can see what changed on the remote. Fetch is safe -- it only downloads, never modifies your local branches. After fetching, you can inspect the changes with "git log origin/main" and decide whether to merge.',
    options: [
      { flag: '--all', description: 'Fetch from all configured remotes' },
    ],
    examples: [
      { command: 'git fetch', explanation: 'Fetch from the default remote (origin)' },
      { command: 'git fetch origin', explanation: 'Fetch new commits from "origin"' },
      { command: 'git fetch --all', explanation: 'Fetch from all remotes' },
      { command: 'git log origin/main', explanation: 'After fetching, inspect remote changes' },
    ],
    tip: 'Prefer "git fetch" + "git merge" over "git pull" when you want to inspect changes before integrating them. Fetch is always safe; it never changes your local work.',
    related: ['pull', 'push', 'merge', 'remote'],
  },

  pull: {
    name: 'pull',
    syntax: 'git pull [<remote>] [<branch>]',
    description:
      '"git pull" is shorthand for "git fetch" followed by "git merge". It downloads new commits from the remote and immediately merges them into your current branch. If your branch hasn\'t diverged from the remote, the merge is a fast-forward (just moving the pointer). If both sides have new commits, git creates a merge commit. If both changed the same lines, you\'ll get a merge conflict to resolve.',
    options: [
      { flag: '--rebase', description: 'Rebase instead of merge (replay your commits on top of the remote)' },
    ],
    examples: [
      { command: 'git pull', explanation: 'Pull from the upstream remote and merge' },
      { command: 'git pull origin main', explanation: 'Pull the "main" branch from "origin" and merge it' },
    ],
    tip: 'If you want more control, use "git fetch" + "git merge" separately. "git pull" is convenient but can surprise you with merge conflicts if you\'re not expecting diverged history.',
    related: ['fetch', 'push', 'merge', 'remote'],
  },
};
