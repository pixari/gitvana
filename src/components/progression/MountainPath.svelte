<script lang="ts">
  import { stages, getStage, getNextStage, TOTAL_LEVELS } from '../../lib/engine/progression/stages.js';
  import { savePlayerName } from '../../lib/engine/progression/persistence.js';
  import { translate } from '../../i18n/index.js';
  import PixelArt from '../shared/PixelArt.svelte';

  interface Props {
    completedLevels: number;
    compact?: boolean;
    levelId?: string;
    levelTitle?: string;
    levelAct?: number;
    levelOrder?: number;
    playerName?: string;
    onNameChange?: (name: string) => void;
  }

  let { completedLevels, compact = false, levelId, levelTitle, levelAct, levelOrder, playerName = '', onNameChange }: Props = $props();

  let editing = $state(false);
  let editValue = $state('');

  function startEdit() {
    editValue = playerName;
    editing = true;
  }

  function saveEdit() {
    const name = editValue.trim() || 'Anonymous Monk';
    savePlayerName(name);
    onNameChange?.(name);
    editing = false;
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') editing = false;
  }

  const currentStage = $derived(getStage(completedLevels));
  const nextStage = $derived(getNextStage(completedLevels));
  const progress = $derived(Math.min(completedLevels / TOTAL_LEVELS, 1));

  // Monk sprite changes based on stage tier
  const monkSprite = $derived(
    currentStage.id >= 16 ? '/sprites/monk-tier4.png'  // Enlightened (golden robe, halo)
    : currentStage.id >= 9 ? '/sprites/monk-tier3.png' // Adept (blue robe, staff)
    : currentStage.id >= 4 ? '/sprites/monk-tier2.png' // Student (brown robe, book)
    : '/sprites/monk-tier1.png'                          // Novice (grey robe, confused)
  );

  // Window: show 2 before current, current, 2 after
  const currentIndex = $derived(stages.findIndex((s) => s.id === currentStage.id));
  const windowStart = $derived(Math.max(0, currentIndex - 2));
  const windowEnd = $derived(Math.min(stages.length, currentIndex + 3));
  const visibleStages = $derived(stages.slice(windowStart, windowEnd));
  const hasAbove = $derived(windowEnd < stages.length);
  const hasBelow = $derived(windowStart > 0);
</script>

{#if compact}
  <div class="hud-progress" style="--glow-color: {currentStage.glowColor}; --glow-intensity: {Math.min(currentStage.id / 20, 1)}">
    <!-- Left: Monk + Stage -->
    <div class="monk-area">
      <div class="monk-frame">
        <img src={monkSprite} alt="Monk" class="monk-sprite" class:enlightened={currentStage.id >= 16} />
        {#if currentStage.id >= 6}
          <div class="monk-aura"></div>
        {/if}
      </div>
      <div class="monk-stage-badge" style="background: {currentStage.glowColor}22; border-color: {currentStage.glowColor}44; color: {currentStage.glowColor}">
        {$translate(`stages.stage_${currentStage.id}_name`)}
      </div>
    </div>

    <!-- Center: Name + Progress + Level info -->
    <div class="hud-info">
      <div class="hud-name-row">
        {#if editing}
          <input
            class="name-input"
            bind:value={editValue}
            onkeydown={handleEditKeydown}
            onblur={saveEdit}
            autofocus
          />
        {:else}
          <button class="name-display" onclick={startEdit} title="Click to edit name">
            {playerName || 'Anonymous Monk'} <span class="edit-icon">✎</span>
          </button>
        {/if}
        <span class="hud-count">{completedLevels}<span class="hud-count-total">/{TOTAL_LEVELS}</span></span>
      </div>

      <div class="hud-bar-bg">
        <div
          class="hud-bar-fill"
          style="width: {Math.max(progress * 100, 2)}%; background: {currentStage.glowColor}; box-shadow: 0 0 6px {currentStage.glowColor}"
        ></div>
      </div>

      <div class="hud-bottom">
        <span class="hud-desc">{$translate(`stages.stage_${currentStage.id}_description`)}</span>
        {#if nextStage}
          <span class="hud-next">{nextStage.minLevels - completedLevels} to {$translate(`stages.stage_${nextStage.id}_name`)}</span>
        {/if}
      </div>

      <!-- Current level info -->
      {#if levelTitle}
        <div class="hud-level-info">
          <span class="hud-level-badge">ACT {levelAct} — LV {levelOrder}</span>
          <span class="hud-level-title">{levelTitle}</span>
        </div>
      {/if}
    </div>

    <!-- Right: Level sprite -->
    {#if levelId}
      <div class="hud-level-art">
        <img src="/sprites/{levelId}.png" alt="" class="level-sprite" onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
      </div>
    {/if}
  </div>
{:else}
  <div class="journey">
    <!-- Header -->
    <div class="journey-header">
      <span class="journey-title">YOUR JOURNEY</span>
      <span class="journey-count" style="color: {currentStage.glowColor}">{completedLevels}/{TOTAL_LEVELS}</span>
    </div>

    <!-- Fade hint: more stages above -->
    {#if hasAbove}
      <div class="fade-hint top">▲ {stages[windowEnd] ? $translate(`stages.stage_${stages[windowEnd].id}_name`) : $translate('stages.stage_20_name')}</div>
    {/if}

    <!-- Visible stages (reversed: top = further along) -->
    <div class="path">
      {#each [...visibleStages].reverse() as stage, i}
        {@const completed = completedLevels >= stage.minLevels}
        {@const isCurrent = stage.id === currentStage.id}
        {@const isEnlightened = stage.id === 20 && completed}
        <div class="stage-row" class:completed class:current={isCurrent} class:locked={!completed}>
          <!-- Connector -->
          {#if i > 0}
            <div class="connector-line" style="background: {completed ? stage.glowColor + '44' : '#2a2a4e'}"></div>
          {/if}

          <div class="stage-content">
            <!-- Dot -->
            <div class="dot-wrap">
              <div
                class="dot"
                style="
                  background: {completed ? stage.glowColor : '#2a2a4e'};
                  box-shadow: {isCurrent ? `0 0 12px ${stage.glowColor}, 0 0 24px ${stage.glowColor}44` : completed ? `0 0 6px ${stage.glowColor}66` : 'none'};
                "
              >
                {#if isCurrent}
                  <div class="dot-pulse" style="border-color: {stage.glowColor}"></div>
                {/if}
                {#if isEnlightened}
                  <div class="dot-burst"></div>
                {/if}
              </div>
            </div>

            <!-- Info -->
            <div class="stage-info">
              <div class="stage-name-row">
                <span class="stage-num">{stage.id}</span>
                <span class="stage-name" style="color: {completed || isCurrent ? stage.glowColor : '#5f574f'}">{$translate(`stages.stage_${stage.id}_name`)}</span>
                {#if completed && !isCurrent}
                  <span class="check">✓</span>
                {/if}
              </div>
              {#if isCurrent}
                <div class="stage-desc">{$translate(`stages.stage_${stage.id}_description`)}</div>
                {#if nextStage}
                  <div class="stage-next">{nextStage.minLevels - completedLevels} more level{nextStage.minLevels - completedLevels === 1 ? '' : 's'} to {$translate(`stages.stage_${nextStage.id}_name`)}</div>
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Fade hint: more stages below -->
    {#if hasBelow}
      <div class="fade-hint bottom">▼ {stages[windowStart - 1] ? $translate(`stages.stage_${stages[windowStart - 1].id}_name`) : $translate('stages.stage_1_name')}</div>
    {/if}
  </div>
{/if}

<style>
  /* === HUD compact === */
  .hud-progress {
    padding: 10px 14px;
    background: linear-gradient(135deg, #1a1a2e, #12121e);
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    height: 100%;
    display: flex;
    gap: 14px;
    align-items: center;
  }

  /* Monk avatar area */
  .monk-area {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .monk-frame {
    width: 56px;
    height: 56px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #0a0a0a, #0a0a0a88);
    border: 2px solid var(--glow-color, #2a2a4e);
    border-radius: 8px;
    box-shadow: 0 0 12px color-mix(in srgb, var(--glow-color) calc(var(--glow-intensity) * 40%), transparent);
    overflow: visible;
  }

  .monk-sprite {
    width: 48px;
    height: 48px;
    image-rendering: pixelated;
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 0 calc(var(--glow-intensity) * 6px) var(--glow-color));
    transition: filter 0.5s ease;
  }

  .monk-sprite.enlightened {
    animation: enlightened-pulse 2s ease-in-out infinite;
  }

  @keyframes enlightened-pulse {
    0%, 100% { filter: drop-shadow(0 0 6px var(--glow-color)) brightness(1); }
    50% { filter: drop-shadow(0 0 14px var(--glow-color)) brightness(1.3); }
  }

  .monk-aura {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 1px solid var(--glow-color);
    opacity: calc(var(--glow-intensity) * 0.4);
    animation: aura-breathe 3s ease-in-out infinite;
    z-index: 1;
    pointer-events: none;
  }

  @keyframes aura-breathe {
    0%, 100% { transform: scale(0.9); opacity: calc(var(--glow-intensity) * 0.2); }
    50% { transform: scale(1.15); opacity: calc(var(--glow-intensity) * 0.5); }
  }

  .monk-stage-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    letter-spacing: 1px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
  }

  /* Info column */
  .hud-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .hud-name-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .name-display {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #e0e0e0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    letter-spacing: 1px;
    transition: color 0.15s;
    text-align: left;
  }
  .name-display:hover { color: #fff; }
  .edit-icon { font-size: 9px; color: #5f574f; margin-left: 4px; transition: color 0.15s; }
  .name-display:hover .edit-icon { color: #00e436; }

  .name-input {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #00ff41;
    background: #0a0a0a;
    border: 1px solid #00ff4166;
    border-radius: 3px;
    padding: 2px 6px;
    outline: none;
    letter-spacing: 1px;
    width: 140px;
  }

  .hud-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #c2c3c7;
    font-weight: 700;
  }
  .hud-count-total {
    font-size: 10px;
    color: #5f574f;
    font-weight: 400;
  }
  .hud-bar-bg {
    width: 100%;
    height: 8px;
    background: #0a0a0a;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #2a2a4e;
  }
  .hud-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease, background 0.6s ease;
    min-width: 4px;
  }
  .hud-bottom {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .hud-desc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574faa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }
  .hud-next {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: #5f574f66;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .hud-level-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;
    padding-top: 5px;
    border-top: 1px solid #2a2a4e44;
  }

  .hud-level-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #ffa300;
    letter-spacing: 1px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .hud-level-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #c2c3c7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hud-level-art {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    background: #0a0a0a44;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
  }

  .level-sprite {
    width: 48px;
    height: 48px;
    image-rendering: pixelated;
    object-fit: contain;
  }

  /* === Journey (full view in intro/complete) === */
  .journey {
    width: 100%;
  }

  .journey-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }

  .journey-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #5f574f;
    letter-spacing: 2px;
  }

  .journey-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  .fade-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574f44;
    text-align: center;
    padding: 4px 0;
  }

  .path {
    display: flex;
    flex-direction: column;
  }

  .stage-row {
    position: relative;
    padding-left: 0;
  }

  .connector-line {
    position: absolute;
    left: 13px;
    top: -2px;
    width: 2px;
    height: 10px;
    border-radius: 1px;
    transition: background 0.5s ease;
  }

  .stage-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 6px 0;
  }

  .dot-wrap {
    flex-shrink: 0;
    width: 28px;
    display: flex;
    justify-content: center;
    padding-top: 2px;
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    position: relative;
    transition: all 0.5s ease;
  }

  .stage-row.current .dot {
    width: 18px;
    height: 18px;
  }

  .dot-pulse {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 1px solid;
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0; transform: scale(0.8); }
    50% { opacity: 0.6; transform: scale(1.2); }
  }

  .dot-burst {
    position: absolute;
    inset: -12px;
    border-radius: 50%;
    background: radial-gradient(circle, #ffa30044, transparent);
    animation: burst 3s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes burst {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 0.8; transform: scale(1.3); }
  }

  .stage-info {
    flex: 1;
    min-width: 0;
  }

  .stage-name-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .stage-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574f66;
    min-width: 14px;
  }

  .stage-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    letter-spacing: 1px;
    transition: color 0.5s ease;
  }

  .check {
    font-size: 10px;
    color: #00e436;
  }

  .stage-row.locked .stage-name {
    opacity: 0.4;
  }

  .stage-desc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #c2c3c7;
    margin-top: 3px;
    line-height: 1.4;
  }

  .stage-next {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574f;
    margin-top: 2px;
  }
</style>
