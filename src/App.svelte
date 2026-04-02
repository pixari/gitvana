<script lang="ts">
  import GameLayout from './components/layout/GameLayout.svelte';
  import TerminalPanel from './components/terminal/TerminalPanel.svelte';
  import FileStatePanel from './components/file-state/FileStatePanel.svelte';
  import GraphPanel from './components/graph/GraphPanel.svelte';
  import ObjectivePanel from './components/level/ObjectivePanel.svelte';
  import LevelIntro from './components/level/LevelIntro.svelte';
  import LevelComplete from './components/level/LevelComplete.svelte';
  import FileEditor from './components/editor/FileEditor.svelte';
  import ConflictEditor from './components/editor/ConflictEditor.svelte';
  import DevPanel from './components/shared/DevPanel.svelte';
  import ShareWidget from './components/shared/ShareWidget.svelte';

  import DocPopup from './components/shared/DocPopup.svelte';
  import { soundManager } from './lib/audio/SoundManager.js';
  import { gitEngine } from './lib/engine/git/GitEngine.js';
  import { LevelLoader } from './lib/engine/level/LevelLoader.js';
  import { parseCommand } from './lib/engine/git/cli-parser.js';
  import { runBuiltin } from './lib/engine/shell/builtins.js';
  import { getLevelSolution } from './lib/engine/shell/solutions.js';
  import { eventBus } from './lib/engine/events/GameEventBus.js';
  import { saveProgress, loadProgress, clearProgress, getPlayerName, savePlayerName } from './lib/engine/progression/persistence.js';
  import MountainPath from './components/progression/MountainPath.svelte';
  import NamePrompt from './components/shared/NamePrompt.svelte';
  import SharePage from './components/shared/SharePage.svelte';
  import LandingPage from './components/landing/LandingPage.svelte';
  import DocsPage from './components/docs/DocsPage.svelte';
  import ChangelogPage from './components/changelog/ChangelogPage.svelte';
  import StatsPage from './components/stats/StatsPage.svelte';
  import DevBlogPage from './components/devblog/DevBlogPage.svelte';
  import { getAllLevels, getLevels } from './levels/index.js';
  import { onMount } from 'svelte';
  import { trackEvent } from './lib/telemetry.js';

  let allLevels = $state(getLevels());
  let levelsLoaded = $state(false);

  onMount(async () => {
    allLevels = await getAllLevels();
    levelsLoaded = true;
  });

  // --- Share page routing ---
  function parseShareParams(): Record<string, string> | null {
    const hash = window.location.hash;
    if (!hash.startsWith('#/share?')) return null;
    const params: Record<string, string> = {};
    const search = hash.slice('#/share?'.length);
    for (const pair of search.split('&')) {
      const [key, val] = pair.split('=');
      if (key && val !== undefined) params[decodeURIComponent(key)] = decodeURIComponent(val);
    }
    return params;
  }

  const shareParams = parseShareParams();
  const isSharePage = !!shareParams;

  // --- Docs page routing ---
  function parseDocsRoute(): { isDocsPage: boolean; docsCommand?: string } {
    const hash = window.location.hash;
    if (hash === '#/docs' || hash === '#/docs/') return { isDocsPage: true };
    if (hash.startsWith('#/docs/')) {
      const cmd = hash.slice('#/docs/'.length);
      return { isDocsPage: true, docsCommand: cmd || undefined };
    }
    return { isDocsPage: false };
  }

  // --- Changelog page routing ---
  function isChangelogRoute(): boolean {
    const hash = window.location.hash;
    return hash === '#/changelog' || hash === '#/changelog/';
  }

  // --- Stats page routing ---
  function isStatsRoute(): boolean {
    const hash = window.location.hash;
    return hash === '#/stats' || hash === '#/stats/';
  }

  // --- Dev Blog page routing ---
  function isDevBlogRoute(): boolean {
    const hash = window.location.hash;
    return hash === '#/devblog' || hash === '#/devblog/';
  }

  let docsRoute = $state(parseDocsRoute());
  let showChangelog = $state(isChangelogRoute());
  let showStats = $state(isStatsRoute());
  let showDevBlog = $state(isDevBlogRoute());

  // Listen for hash changes to support in-page navigation
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      docsRoute = parseDocsRoute();
      showChangelog = isChangelogRoute();
      showStats = isStatsRoute();
      showDevBlog = isDevBlogRoute();
    });
  }

  // --- Landing page ---
  const hasSavedProgress = !!loadProgress();
  let showLanding = $state(!isSharePage && !hasSavedProgress && !window.location.hash && !isChangelogRoute() && !isDevBlogRoute());

  function handlePlay() {
    showLanding = false;
  }

  // --- Player name ---
  let playerName = $state(getPlayerName());
  let showNamePrompt = $state(!isSharePage && playerName === 'Anonymous Monk' && !localStorage.getItem('gitvana-player-name'));

  function handleNameComplete(name: string) {
    playerName = name;
    showNamePrompt = false;
  }

  // --- State ---
  let levelIndex = $state(0);
  let screen = $state<'intro' | 'playing' | 'complete'>('intro');
  let earnedStars = $state(0);
  let editingFile = $state<string | null>(null);
  let editingFileHasConflict = $state(false);
  let docCommand = $state<string | null>(null);
  let completedLevels = $state(0);
  let levelStars: Record<string, number> = {};
  let totalStars = $state(0);

  // Restore saved progress on mount
  const saved = loadProgress();
  if (saved) {
    levelIndex = saved.levelIndex;
    completedLevels = saved.completedLevels;
    levelStars = saved.levelStars ?? {};
    totalStars = saved.totalStars ?? 0;
  }

  // Key that changes on every level load to force component re-creation
  let levelKey = $state(0);

  const currentLevel = $derived(allLevels[Math.min(levelIndex, allLevels.length - 1)]);
  const levelLoader = new LevelLoader(gitEngine);

  function persistProgress() {
    saveProgress({
      version: 1,
      completedLevels,
      levelIndex,
      levelStars,
      totalStars,
    });
  }

  // --- Level lifecycle ---
  async function startLevel() {
    screen = 'playing';
    levelKey++;
    soundManager.play('levelStart');
    await levelLoader.load(currentLevel);
  }

  function handleComplete(stars: number) {
    earnedStars = stars;
    completedLevels++;
    const prev = levelStars[currentLevel.id] ?? 0;
    if (stars > prev) {
      totalStars += stars - prev;
      levelStars[currentLevel.id] = stars;
    }
    screen = 'complete';
    persistProgress();
  }

  function handleRetry() {
    trackEvent('level_restart', currentLevel.id);
    startLevel();
  }

  function handleNext() {
    if (levelIndex < allLevels.length - 1) {
      levelIndex++;
    } else {
      levelIndex = 0;
    }
    screen = 'intro';
    persistProgress();
  }

  // --- Dev tools ---
  async function handleSolve() {
    if (screen === 'intro') {
      await startLevel();
    }
    const steps = getLevelSolution(currentLevel.id);
    for (const step of steps) {
      const parsed = parseCommand(step);
      if (parsed.type === 'git') {
        await gitEngine.execute(parsed.command, parsed.args);
      } else if (parsed.type === 'builtin') {
        const rawArgs = parsed.command === 'echo'
          ? [step.slice(step.indexOf(' ') + 1)]
          : parsed.args;
        await runBuiltin(parsed.command, rawArgs, gitEngine.fs, gitEngine.dir);
      }
    }
    // Final state change to trigger validation after builtins
    eventBus.emit('state:changed', undefined as never);
  }

  function handleSkip() {
    completedLevels++;
    if (levelIndex < allLevels.length - 1) {
      levelIndex++;
    }
    screen = 'intro';
    persistProgress();
  }

  async function handleEditRequest(filepath: string) {
    editingFile = filepath;
    try {
      const fullPath = `${gitEngine.dir}/${filepath}`;
      const data = await gitEngine.fs.promises.readFile(fullPath, { encoding: 'utf8' });
      editingFileHasConflict = (data as string).includes('<<<<<<<');
    } catch {
      editingFileHasConflict = false;
    }
  }

  function handleDocRequest(commandName: string) {
    docCommand = commandName;
  }
</script>

<ShareWidget />

{#if isSharePage && shareParams}
  <SharePage params={{
    name: shareParams.name || 'Anonymous Monk',
    level: Number(shareParams.level) || 1,
    title: shareParams.title || 'Unknown',
    stars: Number(shareParams.stars) || 0,
    cmds: Number(shareParams.cmds) || 0,
    stage: shareParams.stage || 'Lost',
    completed: Number(shareParams.completed) || 0,
  }} />
{:else if docsRoute.isDocsPage}
  <DocsPage commandName={docsRoute.docsCommand} />
{:else if showChangelog}
  <ChangelogPage />
{:else if showStats}
  <StatsPage />
{:else if showDevBlog}
  <DevBlogPage />
{:else}

{#if showLanding}
  <LandingPage onPlay={handlePlay} />
{:else}

{#if showNamePrompt}
  <NamePrompt onComplete={handleNameComplete} />
{/if}

{#key levelKey}
  <GameLayout>
    {#snippet terminalSlot()}
      <TerminalPanel
        onEditRequest={handleEditRequest}
        onDocRequest={handleDocRequest}
        onAbout={() => showLanding = true}
        onRestart={handleRetry}
        level={currentLevel}
        onSkip={handleNext}
        {playerName}
      />
    {/snippet}

    {#snippet fileStateSlot()}
      <FileStatePanel />
    {/snippet}

    {#snippet graphSlot()}
      <GraphPanel />
    {/snippet}

    {#snippet hudSlot()}
      <div style="display: flex; gap: 6px; align-items: stretch;">
        <div style="flex: 3;"><ObjectivePanel level={currentLevel} onComplete={handleComplete} onDocRequest={handleDocRequest} /></div>
        <div style="flex: 1;"><MountainPath completedLevels={completedLevels} levelId={currentLevel.id} levelTitle={currentLevel.title} levelAct={currentLevel.act} levelOrder={currentLevel.order} {playerName} onNameChange={(name) => playerName = name} compact /></div>
      </div>
    {/snippet}
  </GameLayout>
{/key}

{#if import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true'}
  <DevPanel level={currentLevel} onSolve={handleSolve} onSkip={handleSkip} onReset={() => { clearProgress(); location.reload(); }} />
{/if}

{#if screen === 'intro'}
  <LevelIntro level={currentLevel} {completedLevels} onStart={startLevel} />
{/if}

{#if editingFile}
  {#if editingFileHasConflict}
    <ConflictEditor
      filepath={editingFile}
      onClose={() => editingFile = null}
      onSave={() => editingFile = null}
    />
  {:else}
    <FileEditor filepath={editingFile} onClose={() => editingFile = null} />
  {/if}
{/if}

{#if docCommand !== null}
  <DocPopup commandName={docCommand} onClose={() => docCommand = null} />
{/if}

{#if screen === 'complete'}
  <LevelComplete
    level={currentLevel}
    stars={earnedStars}
    {completedLevels}
    {playerName}
    onRetry={handleRetry}
    onNext={handleNext}
  />
{/if}

{/if}
{/if}

<style>
</style>
