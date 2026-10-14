<script lang="ts">
  import { savePlayerName } from '../../lib/engine/progression/persistence.js';
  import { translate } from '../../i18n/index.js';

  interface Props {
    onComplete: (name: string) => void;
  }

  let { onComplete }: Props = $props();

  let name = $state('');

  function submit() {
    const trimmed = name.trim();
    const playerName = trimmed || 'Anonymous Monk';
    savePlayerName(playerName);
    onComplete(playerName);
  }

  function skip() {
    savePlayerName('Anonymous Monk');
    onComplete('Anonymous Monk');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="name-overlay">
  <div class="name-card">
    <div class="title">GITVANA</div>
    <h2 class="heading">{$translate('ui.name_prompt_welcome_line1')}<br/>{$translate('ui.name_prompt_welcome_line2')}</h2>
    <p class="prompt-text">{$translate('ui.name_prompt_question')}</p>

    <input
      class="name-input"
      type="text"
      bind:value={name}
      onkeydown={handleKeydown}
      placeholder={$translate('ui.name_prompt_placeholder')}
      maxlength="24"
      autofocus
    />

    <button class="begin-btn" onclick={submit}>{$translate('ui.name_prompt_begin')}</button>
    <button class="skip-btn" onclick={skip}>{$translate('ui.name_prompt_skip', { name: $translate('ui.anonymous_monk') })}</button>
  </div>
</div>

<style>
  .name-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0aee;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .name-card {
    background: #1a1a2e;
    border: 2px solid #ffa300;
    border-radius: 8px;
    padding: 40px 32px;
    text-align: center;
    max-width: 440px;
    width: 90%;
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .title {
    font-family: 'Press Start 2P', monospace;
    font-size: 28px;
    color: #ffa300;
    letter-spacing: 4px;
    margin-bottom: 20px;
    text-shadow: 0 0 20px #ffa30066;
  }

  .heading {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #c2c3c7;
    font-weight: normal;
    margin: 0 0 24px;
    line-height: 1.6;
  }

  .prompt-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #5f9ea0;
    margin: 0 0 16px;
  }

  .name-input {
    display: block;
    width: 100%;
    padding: 12px 16px;
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #00ff41;
    background: #0a0a0a;
    border: 2px solid #2a2a4e;
    border-radius: 4px;
    outline: none;
    box-sizing: border-box;
    margin-bottom: 20px;
    text-align: center;
    transition: border-color 0.2s;
  }

  .name-input:focus {
    border-color: #00ff41;
    box-shadow: 0 0 10px #00ff4133;
  }

  .name-input::placeholder {
    color: #5f574f;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  .begin-btn {
    display: block;
    width: 100%;
    padding: 14px;
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #0a0a0a;
    background: #00ff41;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 3px;
    transition: transform 0.1s, background 0.2s;
    margin-bottom: 12px;
  }

  .begin-btn:hover {
    transform: translateY(-1px);
    background: #33ff66;
  }

  .begin-btn:active {
    transform: translateY(0);
  }

  .skip-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.2s;
  }

  .skip-btn:hover {
    color: #c2c3c7;
  }
</style>
