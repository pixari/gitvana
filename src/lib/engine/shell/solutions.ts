const solutions: Record<string, string[]> = {
  // === Act 1: Awakening ===
  'act1-01-spark': [
    'git init',
    'echo "Hello, Gitvana!" > hello.txt',
    'git add hello.txt',
    'git commit -m "First commit"',
  ],
  'act1-02-ledger': [
    'git add data.txt config.txt',
    'git commit -m "Add monastery records"',
  ],
  'act1-03-tea-leaves': [
    'git log --oneline',
    'echo "bread: 10\\nmilk: 5\\neggs: 3\\nbutter: 4\\ncheese: 7" > prices.txt',
    'git add prices.txt',
    'git commit -m "Fix bread price"',
  ],
  'act1-04-undo': [
    'git reset --soft HEAD~1',
    'git commit -m "Add monastery rules"',
  ],
  'act1-05-branching': [
    'git checkout -b feature-a',
    'echo "feature a work" > a.txt',
    'git add a.txt',
    'git commit -m "Add feature a"',
    'git checkout main',
    'git checkout -b feature-b',
    'echo "feature b work" > b.txt',
    'git add b.txt',
    'git commit -m "Add feature b"',
    'git checkout main',
    'git merge feature-a',
  ],
  'act1-06-boss': [
    'git merge good-changes',
    'git merge bad-changes',
    'git merge --abort',
    'git branch -D bad-changes',
  ],

  // === Act 2: The Middle Path ===
  'act2-07-detached': [
    'echo "rescued" > rescued.txt',
    'git add rescued.txt',
    'git commit -m "Emergency commit"',
    'git checkout -b rescue',
  ],
  'act2-08-tags': [
    'git tag v1.0 HEAD~3',
    'git tag -a v2.0 -m "Release 2.0"',
  ],
  'act2-09-cherry-pick': [
    'git cherry-pick hotfix~1',
  ],
  'act2-10-revert': [
    'git revert HEAD~1 --no-edit',
  ],
  'act2-11-stash': [
    'git stash',
    'git checkout -b bugfix',
    'echo "fixed" > fix.txt',
    'git add fix.txt',
    'git commit -m "Fix critical bug"',
    'git checkout main',
    'git merge bugfix',
    'git stash pop',
  ],
  'act2-12-boss': [
    'git merge api',
    'git cherry-pick auth~1',
    'git cherry-pick ui~1',
    'git tag -a v3.0 -m "Release v3.0"',
  ],

  // === Act 3: History Rewriting ===
  'act3-13-amend': [
    'echo "# Readme" > readme.md',
    'echo "function hello() {\\n  return \'hello\';\\n}" > app.js',
    'git add app.js readme.md',
    'git commit --amend -m "Initial setup"',
  ],
  'act3-14-squash': [
    'git reset --soft HEAD~5',
    'git commit -m "Add complete feature"',
    'git checkout main',
    'git merge feature',
  ],
  'act3-15-rebase': [
    'git rebase main',
    'git checkout main',
    'git merge feature',
  ],
  'act3-16-rebase-conflict': [
    'git rebase main',
    'echo "port: 8080" > config.txt',
    'git add config.txt',
    'git rebase --continue',
  ],
  'act3-17-secret-purge': [
    // Create a backup branch so we can reference old commits after reset
    'git branch backup',
    'git reset --hard HEAD~4',
    // Cherry-pick commits 3, 4, 5 (skipping commit 2 which has .env)
    // backup is at commit 5 (More updates), backup~1 = commit 4, backup~2 = commit 3
    'git cherry-pick backup~2',
    'git cherry-pick backup~1',
    'git cherry-pick backup',
  ],
  'act3-18-boss': [
    // Feature branch has: Add new feature, WIP feature stuff, Add db config (.secret), Complete feature, Fix critical production bug
    // 1. Save reference to feature tip for cherry-picking the hotfix commit later
    'git log --oneline',
    // 2. Cherry-pick the last commit (hotfix) to the hotfix branch
    'git branch feature-backup',
    'git checkout hotfix',
    'git cherry-pick feature-backup',
    // 3. Go back to feature and clean up: remove last 3 commits (hotfix, secret, complete feature keep the last good one)
    'git checkout feature',
    'git reset --hard HEAD~1',
    'git reset --hard HEAD~1',
    // 4. Squash WIP into the feature commit
    'git reset --soft HEAD~1',
    'git commit -m "Add complete feature"',
    // 5. Rebase onto main
    'git rebase main',
    // 6. Merge everything into main
    'git checkout main',
    'git merge feature',
    'git merge hotfix',
  ],

  // === Act 4: Investigation ===
  'act4-19-reflog': [
    // Reflog entries (newest first):
    // HEAD@{0}: checkout main (oid=commit1)
    // HEAD@{1}: commit "Add treasure" (oid=commit2) <-- this is what we want
    // HEAD@{2}: checkout secret-feature (oid=commit1)
    // HEAD@{3}: commit "Initial" (oid=commit1)
    'git reflog',
    'git branch recovered HEAD@{1}',
    'git checkout recovered',
  ],
  'act4-20-force-push': [
    // Reflog entries (newest first):
    // HEAD@{0}: checkout main (oid=c1)
    // HEAD@{1}: checkout HEAD~2 (oid=c1)
    // HEAD@{2}: commit v3 (oid=c3) <-- this is what we want
    // HEAD@{3}: commit v2 (oid=c2)
    // HEAD@{4}: commit v1 (oid=c1)
    'git reflog',
    'git branch recovered HEAD@{2}',
    'git checkout recovered',
  ],
  'act4-21-blame': [
    'git blame code.txt',
    'echo "line 1: correct\\nline 2: correct\\nline 3: correct\\nline 4: correct\\nline 5: correct" > code.txt',
    'git add code.txt',
    'git commit -m "Fix the bug"',
  ],
  'act4-22-bisect': [
    'git bisect start',
    'git bisect bad',
    'git bisect good HEAD~7',
    // Bisect will checkout the midpoint (around commit 4-5)
    // Need to test and mark: midpoint should be around commit 4 (PASS) or 5 (FAIL)
    'git bisect bad',
    'git bisect good',
    'git bisect reset',
    'git revert HEAD~3 --no-edit',
  ],
  'act4-23-diff-detective': [
    'echo "Q1: 150\\nQ2: 250\\nQ3: 350\\nQ4: 400" > report.txt',
    'git add report.txt',
    'git commit -m "Combined quarterly report"',
  ],
  'act4-24-boss': [
    // 1. Use bisect to find the commit that broke test.txt
    'git bisect start',
    'git bisect bad',
    'git bisect good HEAD~9',
    // Bisect checks midpoint (~commit 5, PASS)
    'git bisect good',
    // Bisect checks next midpoint (~commit 7-8, FAIL)
    'git bisect bad',
    // Bisect checks next midpoint (~commit 6, FAIL)
    'git bisect bad',
    // Bisect identifies the first bad commit (Eve's "Optimize performance")
    'git bisect reset',
    // 2. Use blame to confirm who changed test.txt
    'git blame test.txt',
    // 3. Fix the broken test (can't cleanly git revert due to later app.txt changes)
    'echo "PASS" > test.txt',
    'git add test.txt',
    'git commit -m "Revert: fix test broken by Eve"',
  ],

  // === Act 5: Recovery ===
  'act5-25-surgical': [
    // 1. Fix: add division-by-zero check
    'echo "// Math utilities\\nfunction divide(a, b) {\\n  if (b === 0) return \\"error\\";\\n  return a / b;\\n}\\n\\nfunction OLD_calc(a, b, op) {\\n  if (op === \'add\') return a + b;\\n  if (op === \'sub\') return a - b;\\n  return 0;\\n}\\n\\nfunction multiply(a, b) {\\n  return a * b;\\n}" > code.txt',
    'git add code.txt',
    'git commit -m "Fix: add division by zero check"',
    // 2. Refactor: rename OLD_calc to calc
    'echo "// Math utilities\\nfunction divide(a, b) {\\n  if (b === 0) return \\"error\\";\\n  return a / b;\\n}\\n\\nfunction calc(a, b, op) {\\n  if (op === \'add\') return a + b;\\n  if (op === \'sub\') return a - b;\\n  return 0;\\n}\\n\\nfunction multiply(a, b) {\\n  return a * b;\\n}" > code.txt',
    'git add code.txt',
    'git commit -m "Refactor: rename OLD_calc to calc"',
    // 3. Feature: add power function
    'echo "// Math utilities\\nfunction divide(a, b) {\\n  if (b === 0) return \\"error\\";\\n  return a / b;\\n}\\n\\nfunction calc(a, b, op) {\\n  if (op === \'add\') return a + b;\\n  if (op === \'sub\') return a - b;\\n  return 0;\\n}\\n\\nfunction multiply(a, b) {\\n  return a * b;\\n}\\n\\nfunction power(a, b) {\\n  return a ** b;\\n}" > code.txt',
    'git add code.txt',
    'git commit -m "Feature: add power function"',
    // 4. Perf: add cache for calc
    'echo "// Math utilities\\nfunction divide(a, b) {\\n  if (b === 0) return \\"error\\";\\n  return a / b;\\n}\\n\\nconst cache = {};\\nfunction calc(a, b, op) {\\n  if (op === \'add\') return a + b;\\n  if (op === \'sub\') return a - b;\\n  return 0;\\n}\\n\\nfunction multiply(a, b) {\\n  return a * b;\\n}\\n\\nfunction power(a, b) {\\n  return a ** b;\\n}" > code.txt',
    'git add code.txt',
    'git commit -m "Perf: add calculation cache"',
    // 5. Docs: add JSDoc @param comments
    'echo "// Math utilities\\n/** @param a first number @param b second number */\\nfunction divide(a, b) {\\n  if (b === 0) return \\"error\\";\\n  return a / b;\\n}\\n\\nconst cache = {};\\nfunction calc(a, b, op) {\\n  if (op === \'add\') return a + b;\\n  if (op === \'sub\') return a - b;\\n  return 0;\\n}\\n\\nfunction multiply(a, b) {\\n  return a * b;\\n}\\n\\nfunction power(a, b) {\\n  return a ** b;\\n}" > code.txt',
    'git add code.txt',
    'git commit -m "Docs: add JSDoc @param comments"',
  ],
  'act5-26-orphan': [
    'git branch docs',
    'git checkout docs',
    'git rm app.txt',
    'git rm config.txt',
    'echo "# Monastery Documentation" > README.txt',
    'git add README.txt',
    'git commit -m "Add documentation"',
  ],
  'act5-27-dependency': [
    // Rebase auth onto main (conflict in readme.txt)
    'git rebase main',
    // Resolve conflict: combine v2 upgrade + auth enabled
    'echo "Monastery App v2\\nUpgraded!\\nAuth: enabled" > readme.txt',
    'git add readme.txt',
    'git rebase --continue',
    // Rebase api onto updated auth (may conflict due to engine; resolve readme.txt)
    'git checkout api',
    'git rebase auth',
    'echo "Monastery App v2\\nUpgraded!\\nAuth: enabled" > readme.txt',
    'git add readme.txt',
    'git rebase --continue',
    // Rebase frontend onto updated api (may conflict; resolve readme.txt)
    'git checkout frontend',
    'git rebase api',
    'echo "Monastery App v2\\nUpgraded!\\nAuth: enabled" > readme.txt',
    'git add readme.txt',
    'git rebase --continue',
    // Merge up the chain into main
    'git checkout main',
    'git merge auth',
    'git merge api',
    'git merge frontend',
  ],
  'act5-28-patch': [
    // Examine both branches
    'git log feature-search --oneline',
    'git log feature-export --oneline',
    // Create release branch
    'git branch release',
    'git checkout release',
    // Cherry-pick good commits from feature-search: implement + optimize (skip 2 WIP)
    'git cherry-pick feature-search~3',
    'git cherry-pick feature-search~1',
    // Cherry-pick good commits from feature-export: implement + CSV (skip 2 DEBUG)
    'git cherry-pick feature-export~3',
    'git cherry-pick feature-export~1',
  ],
  'act5-29-time-travel': [
    // Investigate history
    'git log --oneline',
    // Fix config: password from HEAD~3, port from HEAD~2, add back enable_backups from HEAD~4
    'echo "database: postgres\\nhost: prod.monastery.io\\nport: 8443\\ndb_pass: monastery_secure_789\\nmax_connections: 200\\nenable_backups: true\\nlog_level: debug" > config.txt',
    'git add config.txt',
    'git commit -m "Restore correct config values from history"',
  ],
  'act5-30-boss': [
    // On feature-garden: examine repo, fix typo, cherry-pick, rebase, merge, tag
    'git log --oneline',
    // Squash last 2 commits to fix the "netwerk" typo
    'git reset --soft HEAD~2',
    'git commit -m "Add network module and register modules"',
    // Cherry-pick the contributor fix
    'git cherry-pick contributor-fix',
    // Rebase onto main (clean - feature doesn't modify monkos.txt)
    'git rebase main',
    // Switch to main and merge
    'git checkout main',
    'git merge feature-garden',
    'git tag v3.0',
  ],

  // === Act 6: Advanced Workflows ===
  'act6-31-wrong-branch': [
    // Examine commits
    'git log --oneline',
    // Create both feature branches at current main HEAD
    'git branch feature-ui',
    'git branch feature-api',
    // Cherry-pick UI commits to feature-ui (header=main~4, sidebar=main~2, footer=main~1)
    'git checkout feature-ui',
    'git reset --hard HEAD~5',
    'git cherry-pick main~4',
    'git cherry-pick main~2',
    'git cherry-pick main~1',
    // Cherry-pick API commits to feature-api (users=main~3, posts=main)
    'git checkout feature-api',
    'git reset --hard HEAD~5',
    'git cherry-pick main~3',
    'git cherry-pick main',
    // Reset main back to base
    'git checkout main',
    'git reset --hard HEAD~5',
  ],
  'act6-32-split': [
    'git reset --mixed HEAD~1',
    // Refactor first (feature depends on this)
    'git add utils.txt',
    'git commit -m "Refactor: rename calcTotal to calculateTotal"',
    // Feature second (imports from refactored utils)
    'git add feature.txt',
    'git commit -m "Feature: add pricing module using calculateTotal"',
    // Bugfix last (independent)
    'git add app.txt',
    'git commit -m "Fix: add null check in application"',
  ],
  'act6-33-octopus': [
    // 1. Merge branch-a first (database upgrade) - clean merge
    'git merge branch-a',
    // 2. Merge branch-d (logger) - conflicts on config
    'git merge branch-d',
    'echo "database: postgres\\ncache: none\\nsearch: basic\\nlogger: structured" > config.txt',
    'git add config.txt',
    'git commit -m "Merge branch-d with structured logging"',
    // 3. Merge branch-b (cache + mysql) - conflicts on database
    'git merge branch-b',
    'echo "database: postgres\\ncache: redis\\nsearch: basic\\nlogger: structured" > config.txt',
    'git add config.txt',
    'git commit -m "Merge branch-b keeping postgres adding redis"',
    // 4. Merge branch-c (search + bug) - conflicts on config
    'git merge branch-c',
    'echo "database: postgres\\ncache: redis\\nsearch: elasticsearch\\nlogger: structured" > config.txt',
    'git add config.txt',
    'git commit -m "Merge branch-c with elasticsearch"',
    // 5. Revert the bug: fix app.txt
    'echo "application running\\nstatus: ok" > app.txt',
    'git add app.txt',
    'git commit -m "Revert: fix search integration bug from branch-c"',
  ],
  'act6-34-archaeology': [
    // Investigate reflog to find both deleted branches
    'git reflog',
    // HEAD@{2} = tip of real-work (artifact 3)
    // Create a temp branch at the real-work tip so we have a stable reference
    'git branch real-work-tip HEAD@{2}',
    // Create recovery branch and checkout
    'git branch recovered',
    'git checkout recovered',
    // Cherry-pick only the 3 good artifact commits using the stable branch ref
    // real-work-tip = artifact3, ~1 = broken2, ~2 = artifact2, ~3 = broken1, ~4 = artifact1
    'git cherry-pick real-work-tip~4',
    'git cherry-pick real-work-tip~2',
    'git cherry-pick real-work-tip',
  ],
  'act6-35-gitvana': [
    // 1. Investigate the situation
    'git reflog',
    // 2. Recover the deleted dev branch (HEAD@{9} = backup system = dev tip)
    'git branch recovered HEAD@{9}',
    // 3. Cherry-pick the hotfix commit from feature-enlightenment to hotfix branch
    'git checkout hotfix',
    // +1 shift: zen was @{4}, now @{5}
    'git cherry-pick feature-enlightenment',
    // +1 shift: zen was @{5}, now @{6}
    // 4. Clean feature-enlightenment: keep only the 3 good commits
    'git checkout feature-enlightenment',
    // +1 shift: zen was @{6}, now @{7}
    // Reset back to "Connect wisdom database" (removing wip, zen, wip, secrets, timer-fix)
    'git reset --hard HEAD~5',
    // +1 shift: zen was @{7}, now @{8}
    // Cherry-pick "Add zen mode" back (now at HEAD@{8} after 4 reflog-recording commands)
    'git cherry-pick HEAD@{8}',
    // 5. Merge recovered dev commits into main
    // +1 shift from cherry-pick above
    'git checkout main',
    'git merge recovered',
    // 6. Merge hotfix into main
    'git merge hotfix',
    // 7. Merge cleaned feature into main
    'git merge feature-enlightenment',
    // 8. Tag the final result
    'git tag v3.0',
  ],
};

export function getLevelSolution(levelId: string): string[] {
  return solutions[levelId] || [];
}
