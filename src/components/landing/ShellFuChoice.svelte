<script lang="ts">
  interface Props {
    onTerminal: () => void;
    onSkip: () => void;
  }

  let { onTerminal, onSkip }: Props = $props();
</script>

<div class="choice-overlay">
  <div class="choice-card">
    <div class="choice-header">THE WAY OF THE TERMINAL</div>

    <p class="choice-narrative">
      At the foot of the Gitvana mountain, a monk with a glowing headband blocks the path.
    </p>
    <p class="choice-dialogue">
      "Hey, I see you're new around here. The monks up at the monastery assume you know
      your way around a terminal. Commands like <code>echo</code>, <code>cat</code>,
      <code>touch</code>... ring any bells?"
    </p>
    <p class="choice-dialogue">
      "I can teach you the basics before you climb. Three quick lessons
      and you'll be ready for anything. Or, if you already know this stuff, take the
      shortcut straight to Git."
    </p>

    <div class="choice-buttons">
      <button class="choice-btn choice-terminal" onclick={onTerminal}>
        <span class="btn-label">LEARN THE BASICS</span>
        <span class="btn-desc">3 lessons on terminal commands</span>
      </button>
      <button class="choice-btn choice-skip" onclick={onSkip}>
        <span class="btn-label">SKIP TO GIT</span>
        <span class="btn-desc">I know my way around a terminal</span>
      </button>
    </div>
  </div>
</div>

<style>
  .choice-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0aee;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 110;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .choice-card {
    background: #1a1a2e;
    border: 2px solid #29adff;
    border-radius: 8px;
    padding: 28px 32px;
    max-width: 520px;
    width: 90%;
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .choice-header {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #29adff;
    letter-spacing: 3px;
    text-align: center;
    margin-bottom: 20px;
    text-shadow: 0 0 10px #29adff44;
  }

  .choice-narrative {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #c2c3c7;
    line-height: 1.6;
    margin: 0 0 12px;
    font-style: italic;
  }

  .choice-dialogue {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    line-height: 1.6;
    margin: 0 0 12px;
  }

  .choice-dialogue code {
    color: #00e436;
    background: #00e43612;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
  }

  .choice-buttons {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .choice-btn {
    flex: 1;
    padding: 14px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: transform 0.1s;
  }

  .choice-btn:hover {
    transform: translateY(-2px);
  }

  .choice-btn:active {
    transform: translateY(0);
  }

  .choice-terminal {
    background: #29adff;
    color: #0a0a0a;
  }

  .choice-skip {
    background: #2a2a4e;
    color: #c2c3c7;
  }

  .btn-label {
    display: block;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .btn-desc {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    opacity: 0.7;
  }
</style>
