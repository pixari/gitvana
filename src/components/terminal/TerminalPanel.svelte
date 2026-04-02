<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';
  import { ShellBridge } from '../../lib/engine/shell/ShellBridge.js';
  import { gitEngine } from '../../lib/engine/git/GitEngine.js';

  let terminalEl: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let bridge: ShellBridge;
  let resizeObserver: ResizeObserver;

  import type { LevelDefinition } from '../../levels/schema.js';

  import { soundManager } from '../../lib/audio/SoundManager.js';
  import { eventBus } from '../../lib/engine/events/GameEventBus.js';

  interface Props {
    onEditRequest?: (filepath: string) => void;
    onDocRequest?: (commandName: string) => void;
    onAbout?: () => void;
    onRestart?: () => void;
    level?: LevelDefinition;
    onSkip?: () => void;
    playerName?: string;
  }

  const SOUND_KEY = 'gitvana-sound-enabled';
  let soundEnabled = $state(localStorage.getItem(SOUND_KEY) !== 'false');
  soundManager.setEnabled(soundEnabled);

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundManager.setEnabled(soundEnabled);
    localStorage.setItem(SOUND_KEY, String(soundEnabled));
    if (soundEnabled) soundManager.play('hint');
  }

  async function handleUndo() {
    const restored = await gitEngine.restoreSnapshot();
    if (restored) {
      eventBus.emit('state:changed', undefined as never);
    }
  }

  let { onEditRequest, onDocRequest, onAbout, onRestart, level, onSkip, playerName }: Props = $props();

  onMount(() => {
    terminal = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#00ff41',
        cursor: '#00ff41',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#00ff4133',
        black: '#0a0a0a',
        red: '#ff004d',
        green: '#00e436',
        yellow: '#ffa300',
        blue: '#29adff',
        magenta: '#ff77a8',
        cyan: '#00e4ff',
        white: '#c2c3c7',
      },
      fontFamily: '"JetBrains Mono", "Consolas", monospace',
      fontSize: 15,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      allowProposedApi: true,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalEl);
    fitAddon.fit();

    // Welcome message
    terminal.writeln('\x1b[33m╔════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[33m║\x1b[0m   \x1b[32mGITVANA\x1b[0m - Reach git enlightenment    \x1b[33m║\x1b[0m');
    terminal.writeln('\x1b[33m╚════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    if (playerName) {
      terminal.writeln(`Welcome back, \x1b[33m${playerName}\x1b[0m.`);
    } else {
      terminal.writeln('Welcome to the Monastery of Version Control.');
    }
    terminal.writeln('You look lost. That\'s normal. Everyone starts lost.');
    terminal.writeln('');
    terminal.writeln('Type \x1b[36mhelp\x1b[0m if you need a hand. No shame in it.');
    terminal.writeln('');

    bridge = new ShellBridge(terminal, gitEngine);
    bridge.setEditHandler((filepath: string) => onEditRequest?.(filepath));
    bridge.setDocHandler((commandName: string) => onDocRequest?.(commandName));
    bridge.setSkipHandler(() => onSkip?.());
    bridge.setRestartHandler(() => onRestart?.());
    if (level) bridge.setLevel(level);
    bridge.start();

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalEl);
  });

  $effect(() => {
    if (bridge && level) {
      bridge.setLevel(level);
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    terminal?.dispose();
  });
</script>

<div class="terminal-container">
  <div class="terminal-header">
    <span class="terminal-dot red"></span>
    <span class="terminal-dot yellow"></span>
    <span class="terminal-dot green"></span>
    <span class="terminal-title">TERMINAL</span>
    <span class="alpha-tag">ALPHA</span>
    <div class="header-actions">
      <button class="header-btn icon-btn" onclick={() => onAbout?.()} title="Home">🏠</button>
      <button class="header-btn icon-btn" onclick={toggleSound} title={soundEnabled ? 'Mute' : 'Unmute'}>
        {soundEnabled ? '🔊' : '🔇'}
      </button>
      <button class="header-btn icon-btn" onclick={handleUndo} title="Undo last command">↶</button>
      <button class="header-btn icon-btn" onclick={() => onRestart?.()} title="Restart level">↺</button>
      <a class="header-btn" href="#/docs" title="Docs">DOCS</a>
      <a class="header-btn icon-btn coffee" href="https://buymeacoffee.com/pixari" target="_blank" rel="noopener noreferrer" title="Buy me a coffee">☕</a>
      <a class="header-btn" href="https://github.com/pixari/gitvana" target="_blank" rel="noopener noreferrer" title="GitHub">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
      <a class="header-btn bug-btn" href="https://github.com/pixari/gitvana/issues/new" target="_blank" rel="noopener noreferrer" title="Report a bug">🐛 BUG</a>
    </div>
  </div>
  <div class="terminal-body" bind:this={terminalEl}></div>
</div>

<style>
  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a0a;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    overflow: hidden;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a4e;
  }

  .bug-btn {
    color: #ff004d !important;
    border-color: #ff004d44 !important;
    background: #ff004d11 !important;
  }

  .bug-btn:hover {
    background: #ff004d22 !important;
    border-color: #ff004d88 !important;
  }

  .alpha-tag {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #ff004d;
    background: #ff004d18;
    border: 1px solid #ff004d44;
    border-radius: 3px;
    padding: 2px 5px;
    letter-spacing: 1px;
    animation: alpha-pulse 2s ease-in-out infinite;
  }

  @keyframes alpha-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .header-actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .header-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #5f574f;
    background: #0a0a0a44;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    line-height: 1;
  }

  .header-btn:hover {
    color: #c2c3c7;
    border-color: #5f574f;
    background: #2a2a4e44;
  }

  .icon-btn {
    font-family: inherit;
    font-size: 15px;
    padding: 4px 8px;
  }

  .terminal-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .terminal-dot.red { background: #ff004d; }
  .terminal-dot.yellow { background: #ffa300; }
  .terminal-dot.green { background: #00e436; }

  .terminal-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #5f574f;
    margin-left: 8px;
    letter-spacing: 2px;
  }

  .terminal-body {
    flex: 1;
    padding: 8px;
    overflow: hidden;
  }

  .terminal-body :global(.xterm) {
    height: 100%;
  }

  .terminal-body :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>
