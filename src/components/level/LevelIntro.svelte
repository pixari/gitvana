<script lang="ts">
  import type { LevelDefinition } from '../../levels/schema.js';
  import MountainPath from '../progression/MountainPath.svelte';
  import PixelArt from '../shared/PixelArt.svelte';
  import { t } from '../../i18n/index.js';

  interface Props {
    level: LevelDefinition;
    completedLevels: number;
    onStart: () => void;
  }

  let { level, completedLevels, onStart }: Props = $props();
</script>

<div class="intro-overlay">
  <div class="intro-card">
    <div class="intro-top">
      <div class="intro-text">
        <div class="level-badge">{t('ui.act_level', { act: level.act, order: level.order })}</div>
        <h1 class="level-title">{level.title}</h1>
        <p class="level-subtitle">{level.subtitle}</p>
      </div>
      <div class="intro-art">
        <PixelArt id={level.id} size={96} />
      </div>
    </div>

    <div class="divider"></div>

    <p class="narrative">{level.briefing.narrative}</p>

    <div class="concept-box">
      <span class="concept-label">{t('ui.concept')}</span>
      <p class="concept-text">{level.briefing.concept}</p>
    </div>

    <div class="objectives-preview">
      <span class="objectives-label">{t('ui.objectives')}</span>
      {#each level.briefing.objectives as objective}
        <div class="objective-row">
          <span class="bullet">▸</span>
          <span>{objective}</span>
        </div>
      {/each}
    </div>

    <div class="path-section">
      <MountainPath {completedLevels} />
    </div>

    <button class="start-button" onclick={onStart}>
      {t('ui.start_level')}
    </button>
  </div>
</div>

<style>
  .intro-overlay {
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

  .intro-card {
    background: #1a1a2e;
    border: 2px solid #2a2a4e;
    border-radius: 10px;
    padding: 36px 44px;
    max-width: 820px;
    max-height: 90vh;
    overflow-y: auto;
    width: 94%;
    animation: slideUp 0.4s ease;
    scrollbar-width: thin;
    scrollbar-color: #2a2a4e #1a1a2e;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .intro-top {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 4px;
  }

  .intro-text {
    flex: 1;
  }

  .intro-art {
    flex-shrink: 0;
    padding: 8px;
    background: #0a0a0a66;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .level-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #ffa300;
    letter-spacing: 3px;
    margin-bottom: 14px;
  }

  .level-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 18px;
    color: #00ff41;
    margin: 0 0 10px;
    line-height: 1.5;
  }

  .level-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #5f574f;
    margin: 0;
  }

  .divider {
    height: 1px;
    background: #2a2a4e;
    margin: 24px 0;
  }

  .narrative {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #c2c3c7;
    line-height: 1.7;
    margin: 0 0 24px;
  }

  .concept-box {
    background: #29adff08;
    border: 1px solid #29adff22;
    border-radius: 6px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }

  .concept-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #29adff;
    letter-spacing: 2px;
    display: block;
    margin-bottom: 10px;
  }

  .concept-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #b0b0b0;
    line-height: 1.6;
    margin: 0;
  }

  .objectives-preview {
    margin-bottom: 28px;
  }

  .objectives-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #ffa300;
    letter-spacing: 2px;
    display: block;
    margin-bottom: 12px;
  }

  .objective-row {
    display: flex;
    gap: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #c2c3c7;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .bullet {
    color: #ffa300;
    flex-shrink: 0;
  }

  .path-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #0a0a0a66;
    border-radius: 6px;
    border: 1px solid #2a2a4e;
  }

  .start-button {
    display: block;
    width: 100%;
    padding: 16px;
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #0a0a0a;
    background: linear-gradient(135deg, #00ff41, #00e436);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    letter-spacing: 3px;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 0 16px #00ff4133;
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 24px #00ff4155;
  }

  .start-button:active {
    transform: translateY(0);
    box-shadow: 0 0 12px #00ff4133;
  }
</style>
