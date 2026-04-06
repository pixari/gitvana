<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gitEngine } from '../../lib/engine/git/GitEngine.js';
  import { eventBus } from '../../lib/engine/events/GameEventBus.js';
  import { LevelValidator } from '../../lib/engine/level/LevelValidator.js';
  import type { LevelDefinition, ValidatorConfig } from '../../levels/schema.js';
  import { soundManager } from '../../lib/audio/SoundManager.js';
  import { t } from '../../i18n/index.js';

  interface Props {
    level: LevelDefinition;
    onComplete?: (stars: number) => void;
    onDocRequest?: (commandName: string) => void;
  }

  let { level, onComplete, onDocRequest }: Props = $props();

  let results = $state<{ validator: ValidatorConfig; passed: boolean; message: string }[]>([]);
  let commandCount = $state(0);
  let completed = false;
  let unsub: (() => void) | null = null;

  const validator = new LevelValidator(gitEngine);
  const passedCount = $derived(results.filter((r) => r.passed).length);
  const totalCount = $derived(results.length);

  async function check() {
    commandCount = gitEngine.getCommandCount();
    const result = await validator.validate(level.targetState.validators);
    results = result.results;

    if (result.passed && !completed) {
      completed = true;
      soundManager.play('levelComplete');
      const maxCmds = level.rewards.stars.maxCommands;
      let stars = 1;
      if (commandCount <= maxCmds.two) stars = 2;
      if (commandCount <= maxCmds.three) stars = 3;
      eventBus.emit('level:completed', { levelId: level.id, stars });
      onComplete?.(stars);
    } else if (!result.passed && completed) {
      // User undid after completion — allow re-validation
      completed = false;
    }
  }

  onMount(() => {
    unsub = eventBus.on('state:changed', check);
  });

  onDestroy(() => {
    unsub?.();
    completed = true; // prevent any in-flight check from calling onComplete after unmount
  });
</script>

<div class="objective-panel">
  <div class="objective-header">
        <span class="objective-title">{t('ui.objectives')}</span>
        <span class="progress">{passedCount}/{totalCount}</span>
        <span class="command-count">{commandCount} cmds</span>
      </div>

      <div class="objectives">
        {#each level.briefing.objectives as objective}
          <div class="objective-item">
            <span class="objective-bullet">▸</span>
            <span class="objective-text">{objective}</span>
          </div>
        {/each}
      </div>

  {#if results.length > 0}
    <div class="validators">
      {#each results as r}
        <div class="validator-item" class:passed={r.passed}>
          <span class="validator-check">{r.passed ? '[x]' : '[ ]'}</span>
          <span class="validator-msg">{r.message}</span>
        </div>
      {/each}
      </div>
    {/if}

    {#if level.briefing.newCommands.length > 0}
      <div class="new-commands">
        <span class="new-commands-label">{t('ui.new_commands')}</span>
        {#each level.briefing.newCommands as cmd}
          <code class="command-badge">{cmd}</code>
        {/each}
        <button
          class="docs-btn"
          onclick={() => onDocRequest?.(level.briefing.newCommands[0])}
        >DOCS</button>
      </div>
    {/if}
</div>

<style>
  .objective-panel {
    background: #1a1a2e;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    padding: 10px 12px;
  }


  .objective-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    padding-right: 4px;
  }

  .objective-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #ffa300;
    letter-spacing: 2px;
  }

  .progress {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #00e436;
    margin-left: auto;
  }

  .command-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
  }

  .objectives {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 8px;
  }

  .objective-item {
    display: flex;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
  }

  .objective-bullet { color: #ffa300; flex-shrink: 0; }
  .objective-text { line-height: 1.4; }

  .validators {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 6px;
    border-top: 1px solid #2a2a4e;
  }

  .validator-item {
    display: flex;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
    transition: color 0.3s;
  }

  .validator-item.passed { color: #00e436; }
  .validator-check { flex-shrink: 0; font-weight: bold; }
  .validator-msg { line-height: 1.4; }

  .new-commands {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #2a2a4e;
    align-items: center;
  }

  .new-commands-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #5f574f;
    letter-spacing: 1px;
  }

  .command-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #29adff;
    background: #29adff18;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid #29adff33;
  }

  .docs-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #00e436;
    background: #00e43612;
    border: 1px solid #00e43633;
    border-radius: 3px;
    padding: 3px 8px;
    cursor: pointer;
    margin-left: auto;
    letter-spacing: 1px;
    transition: background 0.15s, border-color 0.15s;
  }

  .docs-btn:hover {
    background: #00e43625;
    border-color: #00e43666;
  }
</style>
