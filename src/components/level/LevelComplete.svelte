<script lang="ts">
  import type { LevelDefinition } from '../../levels/schema.js';
  import { gitEngine } from '../../lib/engine/git/GitEngine.js';
  import MountainPath from '../progression/MountainPath.svelte';
  import ShareCard from '../shared/ShareCard.svelte';
  import { getStage } from '../../lib/engine/progression/stages.js';
  import { t } from '../../i18n/index.js';

  interface Props {
    level: LevelDefinition;
    stars: number;
    completedLevels: number;
    playerName?: string;
    onNext?: () => void;
    onRetry?: () => void;
  }

  let { level, stars, completedLevels, playerName, onNext, onRetry }: Props = $props();

  const commandCount = gitEngine.getCommandCount();
  const stage = $derived(getStage(completedLevels));

  let showShare = $state(false);
</script>

<div class="complete-overlay">
  <div class="complete-card">
    <div class="stage-clear">{t('ui.stage_clear')}</div>

    <h2 class="level-name">{level.title}</h2>

    <div class="stars-display">
      {#each [1, 2, 3] as star}
        <span class="star" class:earned={star <= stars}>
          {star <= stars ? '★' : '☆'}
        </span>
      {/each}
    </div>

    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">{t('ui.commands_used')}</span>
        <span class="stat-value">{commandCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">{t('ui.par_3_stars')}</span>
        <span class="stat-value">{level.rewards.stars.maxCommands.three}</span>
      </div>
    </div>

    <div class="stage-info">
      <span class="stage-label" style="color: {stage.glowColor}">{stage.name}</span>
      <span class="stage-desc">{stage.description}</span>
    </div>

    <div class="buttons">
      {#if onRetry}
        <button class="btn btn-retry" onclick={onRetry}>{t('ui.retry')}</button>
      {/if}
      <button class="btn btn-share" onclick={() => showShare = true}>{t('ui.share')}</button>
      {#if onNext}
        <button class="btn btn-next" onclick={onNext}>{t('ui.next_level')}</button>
      {/if}
    </div>

    {#if showShare}
      <ShareCard
        levelTitle={level.title}
        levelOrder={level.order}
        act={level.act}
        {stars}
        {commandCount}
        {stage}
        {completedLevels}
        {playerName}
        onClose={() => showShare = false}
      />
    {/if}
  </div>
</div>

<style>
  .complete-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0aee;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .complete-card {
    background: #1a1a2e;
    border: 2px solid #00ff41;
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    max-width: 400px;
    width: 90%;
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .stage-clear {
    font-family: 'Press Start 2P', monospace;
    font-size: 18px;
    color: #ffa300;
    letter-spacing: 4px;
    margin-bottom: 8px;
    animation: pulse 1s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from { text-shadow: 0 0 10px #ffa30066; }
    to { text-shadow: 0 0 20px #ffa300aa, 0 0 40px #ffa30044; }
  }

  .level-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #c2c3c7;
    margin: 0 0 24px;
    font-weight: normal;
  }

  .stars-display {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .star {
    font-size: 36px;
    color: #5f574f;
    transition: color 0.3s, transform 0.3s;
  }

  .star.earned {
    color: #ffa300;
    text-shadow: 0 0 10px #ffa30066;
    animation: starPop 0.5s ease;
  }

  @keyframes starPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .stats {
    margin-bottom: 24px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #5f574f;
    padding: 4px 0;
  }

  .stat-value {
    color: #c2c3c7;
  }

  .stage-info {
    margin-bottom: 20px;
    padding: 10px;
    background: #0a0a0a66;
    border-radius: 4px;
    border: 1px solid #2a2a4e;
  }

  .stage-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    display: block;
    margin-bottom: 4px;
  }

  .stage-desc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
  }

  .buttons {
    display: flex;
    gap: 12px;
  }

  .btn {
    flex: 1;
    padding: 10px;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: transform 0.1s;
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  .btn:active {
    transform: translateY(0);
  }

  .btn-retry {
    color: #c2c3c7;
    background: #2a2a4e;
  }

  .btn-share {
    color: #fff;
    background: #5f9ea0;
  }

  .btn-next {
    color: #0a0a0a;
    background: #00ff41;
  }
</style>
