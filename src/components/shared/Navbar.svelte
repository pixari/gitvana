<script lang="ts">
  interface Props {
    currentPage?: 'home' | 'docs' | 'changelog' | 'stats' | 'devblog' | 'game';
    onPlay?: () => void;
  }

  let { currentPage = 'home', onPlay }: Props = $props();

  let menuOpen = $state(false);

  function handlePlayClick(e: MouseEvent) {
    e.preventDefault();
    if (onPlay) {
      onPlay();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  }
</script>

<nav class="navbar">
  <div class="navbar-inner">
    <a href="/" class="nav-logo" onclick={(e) => { e.preventDefault(); window.location.hash = ''; window.location.reload(); }}>GITVANA</a>
    <span class="alpha-badge">ALPHA</span>

    <button class="hamburger" onclick={() => menuOpen = !menuOpen} aria-label="Toggle menu">
      {menuOpen ? '\u2715' : '\u2630'}
    </button>

    <div class="nav-links" class:nav-open={menuOpen}>
      <a href="/" class="nav-link" class:active={currentPage === 'home' || currentPage === 'game'} onclick={handlePlayClick}>Play</a>
      <a href="#/docs" class="nav-link" class:active={currentPage === 'docs'} onclick={() => menuOpen = false}>Docs</a>
      <a href="#/changelog" class="nav-link" class:active={currentPage === 'changelog'} onclick={() => menuOpen = false}>Changelog</a>
      <a href="#/devblog" class="nav-link" class:active={currentPage === 'devblog'} onclick={() => menuOpen = false}>Blog</a>
      <a href="#/stats" class="nav-link" class:active={currentPage === 'stats'} onclick={() => menuOpen = false}>Stats</a>
      <a href="https://github.com/pixari/gitvana" target="_blank" rel="noopener noreferrer" class="nav-link nav-link-icon" onclick={() => menuOpen = false}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 3px;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub
      </a>
      <a href="https://buymeacoffee.com/pixari" target="_blank" rel="noopener noreferrer" class="nav-link nav-link-coffee" onclick={() => menuOpen = false}>☕</a>
    </div>
  </div>
</nav>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 44px;
    background: #0a0a0aee;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid #2a2a4e;
    z-index: 250;
    font-family: 'JetBrains Mono', monospace;
  }

  .navbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
  }

  .nav-logo {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #ffa300;
    text-decoration: none;
    letter-spacing: 2px;
    flex-shrink: 0;
    transition: text-shadow 0.2s;
  }

  .nav-logo:hover {
    text-shadow: 0 0 12px #ffa30066;
  }

  .alpha-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #ff004d;
    background: #ff004d18;
    border: 1px solid #ff004d44;
    border-radius: 3px;
    padding: 2px 6px;
    letter-spacing: 2px;
    animation: alpha-blink 2s ease-in-out infinite;
    margin-left: -4px;
  }

  @keyframes alpha-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .nav-link {
    font-size: 11px;
    color: #5f574f;
    text-decoration: none;
    letter-spacing: 0.5px;
    transition: color 0.2s;
    white-space: nowrap;
  }

  .nav-link:hover {
    color: #c2c3c7;
  }

  .nav-link.active {
    color: #c2c3c7;
  }

  .nav-link-coffee {
    font-size: 14px;
  }

  .hamburger {
    display: none;
    background: none;
    border: none;
    color: #5f574f;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  .hamburger:hover {
    color: #c2c3c7;
  }

  @media (max-width: 600px) {
    .hamburger {
      display: block;
    }

    .nav-links {
      display: none;
      position: absolute;
      top: 44px;
      left: 0;
      right: 0;
      flex-direction: column;
      background: #0a0a0aee;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid #2a2a4e;
      padding: 12px 20px;
      gap: 12px;
      align-items: flex-start;
    }

    .nav-links.nav-open {
      display: flex;
    }
  }
</style>
