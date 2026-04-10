<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    tips: string[];
    levelId: string;
  }

  let { tips, levelId }: Props = $props();

  const STORAGE_KEY = 'gitvana-dismissed-tips';

  function getDismissed(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  function saveDismissed(dismissed: Set<string>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
    } catch {
      // ignore
    }
  }

  let visible = $state(false);
  let currentTipIndex = $state(0);

  onMount(() => {
    const dismissed = getDismissed();
    if (!dismissed.has(levelId)) {
      visible = true;
    }
  });

  function dismiss() {
    visible = false;
    const dismissed = getDismissed();
    dismissed.add(levelId);
    saveDismissed(dismissed);
  }

  function nextTip() {
    if (currentTipIndex < tips.length - 1) {
      currentTipIndex++;
    } else {
      dismiss();
    }
  }
</script>

{#if visible && tips.length > 0}
  <div class="tip-banner">
    <span class="tip-icon">&#x1F4A1;</span>
    <span class="tip-text">{tips[currentTipIndex]}</span>
    <span class="tip-counter">{currentTipIndex + 1}/{tips.length}</span>
    {#if currentTipIndex < tips.length - 1}
      <button class="tip-btn tip-next" onclick={nextTip}>NEXT</button>
    {/if}
    <button class="tip-btn tip-dismiss" onclick={dismiss}>GOT IT</button>
  </div>
{/if}

<style>
  .tip-banner {
    position: fixed;
    top: 42px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: #1a1a2e;
    border: 1px solid #29adff55;
    border-radius: 6px;
    max-width: 600px;
    width: max-content;
    animation: tipSlideIn 0.3s ease;
    box-shadow: 0 4px 20px #0005;
  }

  @keyframes tipSlideIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .tip-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .tip-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    line-height: 1.4;
  }

  .tip-counter {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574f;
    flex-shrink: 0;
  }

  .tip-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    border: none;
    border-radius: 3px;
    padding: 5px 10px;
    cursor: pointer;
    letter-spacing: 1px;
    flex-shrink: 0;
    transition: transform 0.1s;
  }

  .tip-btn:hover {
    transform: translateY(-1px);
  }

  .tip-next {
    color: #29adff;
    background: #29adff18;
    border: 1px solid #29adff33;
  }

  .tip-dismiss {
    color: #c2c3c7;
    background: #2a2a4e;
  }
</style>
