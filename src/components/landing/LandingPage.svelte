<script lang="ts">
  import { loadProgress } from '../../lib/engine/progression/persistence.js';
  import { onMount } from 'svelte';
  import Navbar from '../shared/Navbar.svelte';

  interface Props {
    onPlay: () => void;
  }

  let { onPlay }: Props = $props();

  let isReturning = $state(false);

  onMount(() => {
    const save = loadProgress();
    if (save && save.completedLevels > 0) {
      isReturning = true;
    }
  });

  const monkTiers = [
    { sprite: '/sprites/monk-tier1.png', label: 'Lost', desc: 'You just arrived.', color: '#5f574f' },
    { sprite: '/sprites/monk-tier2.png', label: 'Student', desc: 'You can branch.', color: '#29adff' },
    { sprite: '/sprites/monk-tier3.png', label: 'Adept', desc: 'You rebase fearlessly.', color: '#00e436' },
    { sprite: '/sprites/monk-tier4.png', label: 'Enlightened', desc: 'You ARE the repo.', color: '#ffa300' },
  ];
</script>

<div class="landing">
  <Navbar currentPage="home" {onPlay} />
  <div class="scanlines"></div>

  <!-- Hero: Full-bleed monastery background -->
  <section class="hero">
    <img
      src="/sprites/landing-monastery.png"
      alt="Monastery of Version Control"
      class="hero-bg"
    />
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h1 class="title">GITVANA</h1>
      <p class="subtitle">Reach git enlightenment</p>
      <p class="tagline">Learn git by playing. 38 levels. Real terminal. Free.</p>
      <button class="play-btn" onclick={onPlay}>
        <span>{isReturning ? 'CONTINUE' : 'PLAY NOW'}</span>
      </button>
      <p class="meta">38 levels &middot; 6 acts &middot; 21 git commands &middot; Free forever</p>
    </div>
    <div class="scroll-hint">
      <span class="scroll-text">SCROLL</span>
      <span class="scroll-arrow">▼</span>
    </div>
  </section>

  <!-- Section 2: Your Journey -->
  <section class="journey-section">
    <div class="section-inner">
      <h2 class="section-title">YOUR JOURNEY</h2>
      <div class="tiers-row">
        {#each monkTiers as tier, i}
          {#if i > 0}
            <div class="tier-connector">
              <span class="connector-dots">&#x2022;&#x2022;&#x2022;</span>
            </div>
          {/if}
          <div class="tier-item">
            <img src={tier.sprite} alt={tier.label} class="tier-sprite" />
            <h3 class="tier-name" style="color: {tier.color}">{tier.label}</h3>
            <p class="tier-desc">{tier.desc}</p>
          </div>
        {/each}
      </div>
      <p class="journey-caption">38 levels across 6 acts. From git init to git mastery.</p>
    </div>
  </section>

  <!-- Section 4: What You'll Master -->
  <section class="master-section">
    <div class="section-inner">
      <h2 class="section-title">WHAT YOU'LL MASTER</h2>
      <div class="commands-grid">
        <div class="commands-col">
          <h3 class="col-title">Basics</h3>
          <ul class="cmd-list">
            <li>init</li>
            <li>add</li>
            <li>commit</li>
            <li>branch</li>
            <li>merge</li>
          </ul>
        </div>
        <div class="commands-col">
          <h3 class="col-title">Power Tools</h3>
          <ul class="cmd-list">
            <li>cherry-pick</li>
            <li>rebase</li>
            <li>stash</li>
            <li>revert</li>
            <li>tag</li>
          </ul>
        </div>
        <div class="commands-col">
          <h3 class="col-title">Mastery</h3>
          <ul class="cmd-list">
            <li>reflog</li>
            <li>bisect</li>
            <li>blame</li>
            <li>reset --hard</li>
            <li>amend</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Section 5: Docs CTA -->
  <section class="docs-cta">
    <div class="section-inner">
      <h2 class="docs-title">Not ready to play yet?</h2>
      <p class="docs-subtitle">Browse the complete git reference — 21 commands, 9 conceptual guides, all free.</p>
      <a href="#/docs" class="docs-btn-large">READ THE DOCS</a>
    </div>
  </section>

  <!-- Section 6: Final CTA + Author -->
  <section class="final-cta">
    <div class="section-inner">
      <img src="/sprites/landing-monk.png" alt="Meditating monk" class="cta-monk" />
      <h2 class="cta-title">Ready to begin your journey?</h2>
      <button class="play-btn" onclick={onPlay}>
        <span>{isReturning ? 'CONTINUE' : 'PLAY NOW'}</span>
      </button>
    </div>
  </section>

  <!-- Section 7: About the Author -->
  <section class="author-section">
    <div class="section-inner">
      <div class="author-card">
        <div class="author-info">
          <h3 class="author-heading">Built by</h3>
          <p class="author-name"><a href="https://pixari.dev" target="_blank" rel="noopener noreferrer">Raffaele Pizzari</a></p>
          <p class="author-aka">aka pixari</p>
          <p class="author-bio">Software engineer and pixel art enthusiast. Built Gitvana because learning git shouldn't feel like reading a manual.</p>
          <a href="https://buymeacoffee.com/pixari" target="_blank" rel="noopener noreferrer" class="coffee-btn">
            ☕ Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- GitHub Banner -->
  <section class="github-section">
    <div class="section-inner">
      <a href="https://github.com/pixari/gitvana" target="_blank" rel="noopener noreferrer" class="github-banner">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        <div class="github-text">
          <span class="github-title">Star on GitHub</span>
          <span class="github-subtitle">pixari/gitvana — open source, MIT licensed</span>
        </div>
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p>&copy; 2026 Raffaele Pizzari</p>
  </footer>
</div>

<style>
  /* ===== Base ===== */
  .landing {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 200;
    color: #c2c3c7;
    font-family: 'JetBrains Mono', monospace;
    scroll-behavior: smooth;
  }

  .scanlines {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 201;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    );
  }

  .section-inner {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 24px;
    position: relative;
    z-index: 1;
  }

  /* ===== Hero ===== */
  .hero {
    position: relative;
    width: 100%;
    height: 100vh;
    padding-top: 44px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100vh;
    object-fit: cover;
    image-rendering: pixelated;
    z-index: 0;
  }

  .hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #0a0a0a 0%, #0a0a0a88 30%, transparent 60%);
    z-index: 1;
  }

  .hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    padding: 0 24px 80px;
    max-width: 700px;
  }

  .title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(40px, 10vw, 96px);
    color: #ffa300;
    margin: 0 0 16px;
    letter-spacing: 8px;
    text-shadow:
      0 0 30px #ffa30088,
      0 0 60px #ffa30044,
      0 0 100px #ffa30022,
      0 4px 0 #cc7a00;
    animation: titleGlow 4s ease-in-out infinite alternate;
  }

  @keyframes titleGlow {
    0% { text-shadow: 0 0 30px #ffa30066, 0 0 60px #ffa30033, 0 0 100px #ffa30022, 0 4px 0 #cc7a00; }
    100% { text-shadow: 0 0 40px #ffa300aa, 0 0 80px #ffa30066, 0 0 120px #ffa30033, 0 4px 0 #cc7a00; }
  }

  .subtitle {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(10px, 2vw, 16px);
    color: #00ff41;
    margin: 0 0 20px;
    letter-spacing: 4px;
    text-shadow: 0 0 16px #00ff4144;
  }

  .tagline {
    font-size: clamp(12px, 1.5vw, 16px);
    color: #8a8580;
    margin: 0 0 36px;
    line-height: 1.7;
  }

  .play-btn {
    display: inline-block;
    padding: 16px 48px;
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(12px, 2vw, 18px);
    color: #0a0a0a;
    background: linear-gradient(135deg, #ffa300, #ff8c00);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    letter-spacing: 3px;
    font-weight: bold;
    box-shadow: 0 0 20px #ffa30044;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    animation: btnPulse 2.5s ease-in-out infinite;
  }

  .play-btn:hover {
    transform: translateY(-2px);
    animation: none;
    box-shadow: 0 0 30px #ffa30088, 0 0 60px #ffa30044;
  }

  .play-btn:active {
    transform: translateY(0);
  }

  @keyframes btnPulse {
    0%, 100% { box-shadow: 0 0 20px #ffa30044; }
    50% { box-shadow: 0 0 30px #ffa30066, 0 0 50px #ffa30033; }
  }

  .meta {
    font-size: 10px;
    color: #5f574f;
    margin: 24px 0 0;
    letter-spacing: 1px;
  }

  .scroll-hint {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 10;
    animation: scroll-bounce 2s ease-in-out infinite;
    pointer-events: none;
  }

  .scroll-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #ffa300aa;
    letter-spacing: 3px;
  }

  .scroll-arrow {
    font-size: 20px;
    color: #ffa300cc;
  }

  @keyframes scroll-bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(10px); }
  }

  /* ===== Section 2: The Game ===== */



  /* ===== Section 3: Your Journey ===== */
  .journey-section {
    background: #0e0e1a;
    padding: 100px 0;
  }

  .section-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(12px, 2vw, 18px);
    color: #ffa300;
    text-align: center;
    margin: 0 0 60px;
    letter-spacing: 4px;
    text-shadow: 0 0 12px #ffa30033;
  }

  .tiers-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 48px;
  }

  .tier-item {
    text-align: center;
    flex: 0 0 auto;
    padding: 0 16px;
  }

  .tier-sprite {
    width: 96px;
    height: 96px;
    image-rendering: pixelated;
    margin-bottom: 12px;
    filter: drop-shadow(0 0 8px rgba(255, 163, 0, 0.15));
  }

  .tier-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    margin: 0 0 8px;
    letter-spacing: 1px;
  }

  .tier-desc {
    font-size: 12px;
    color: #8a8580;
    margin: 0;
    line-height: 1.5;
  }

  .tier-connector {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 0 4px;
    padding-bottom: 52px;
  }

  .connector-dots {
    color: #5f574f44;
    font-size: 18px;
    letter-spacing: 4px;
  }

  .journey-caption {
    text-align: center;
    font-size: 14px;
    color: #5f574f;
    margin: 0;
  }

  /* ===== Section 4: What You'll Master ===== */
  .master-section {
    background: #0a0a0f;
    padding: 100px 0;
  }

  .commands-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 48px;
    max-width: 800px;
    margin: 0 auto;
  }

  .commands-col {
    text-align: left;
  }

  .col-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #c2c3c7;
    margin: 0 0 20px;
    font-weight: 600;
    letter-spacing: 1px;
  }

  .cmd-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .cmd-list li {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #ffa300;
    padding: 6px 0;
    letter-spacing: 0.5px;
  }

  /* ===== Section 5: Docs CTA ===== */
  .docs-cta {
    background: #0e0e1a;
    padding: 80px 0;
    text-align: center;
  }

  .docs-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(12px, 2vw, 18px);
    color: #29adff;
    margin: 0 0 16px;
    line-height: 1.6;
  }

  .docs-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #8a8580;
    margin: 0 0 32px;
  }

  .docs-btn-large {
    display: inline-block;
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: #0a0a0a;
    background: linear-gradient(135deg, #29adff, #1a8adf);
    border: none;
    border-radius: 8px;
    padding: 16px 48px;
    text-decoration: none;
    letter-spacing: 2px;
    box-shadow: 0 0 20px #29adff33;
    transition: transform 0.15s, box-shadow 0.2s;
  }

  .docs-btn-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px #29adff55;
  }

  /* ===== Section 6: Final CTA ===== */
  .final-cta {
    background: #0a0a0a;
    padding: 100px 0;
    text-align: center;
  }

  .cta-monk {
    width: 128px;
    height: 128px;
    image-rendering: pixelated;
    margin-bottom: 32px;
    filter: drop-shadow(0 0 12px rgba(255, 163, 0, 0.2));
  }

  .cta-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(14px, 2.5vw, 22px);
    color: #c2c3c7;
    margin: 0 0 32px;
    line-height: 1.6;
  }

  /* ===== Section 7: Author ===== */
  .author-section {
    background: #0e0e1a;
    padding: 80px 0;
  }

  .author-card {
    max-width: 480px;
    margin: 0 auto;
    text-align: center;
  }

  .author-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #5f574f;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin: 0 0 12px;
  }

  .author-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 16px;
    color: #c2c3c7;
    margin: 0 0 4px;
  }

  .author-name a {
    color: #c2c3c7;
    text-decoration: none;
    transition: color 0.2s;
  }

  .author-name a:hover {
    color: #ffa300;
  }

  .author-aka {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #ffa300;
    margin: 0 0 20px;
  }

  .author-bio {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #8a8580;
    line-height: 1.6;
    margin: 0 0 28px;
  }

  .coffee-btn {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    color: #0a0a0a;
    background: linear-gradient(135deg, #ffd700, #ffaa00);
    border: none;
    border-radius: 8px;
    padding: 12px 32px;
    text-decoration: none;
    box-shadow: 0 0 16px #ffd70033;
    transition: transform 0.15s, box-shadow 0.2s;
  }

  .coffee-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 24px #ffd70055;
  }

  /* ===== GitHub Banner ===== */
  .github-section {
    background: #0a0a0a;
    padding: 60px 0;
  }

  .github-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 32px;
    background: linear-gradient(135deg, #1a1a2e, #161625);
    border: 1px solid #c2c3c722;
    border-radius: 10px;
    text-decoration: none;
    color: #c2c3c7;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }

  .github-banner:hover {
    border-color: #c2c3c766;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px #00000066;
  }

  .github-banner svg {
    flex-shrink: 0;
  }

  .github-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .github-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #e0e0e0;
    letter-spacing: 1px;
  }

  .github-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #5f574f;
  }

  /* ===== Footer ===== */
  .footer {
    padding: 32px 0;
    text-align: center;
    border-top: 1px solid #1a1a2e22;
  }

  .footer p {
    font-size: 12px;
    color: #5f574f55;
    margin: 0;
  }

  /* ===== Responsive ===== */
  @media (max-width: 700px) {
    .hero-content {
      padding: 0 20px 60px;
    }

    .tiers-row {
      flex-direction: column;
      gap: 24px;
    }

    .tier-connector {
      padding-bottom: 0;
      transform: rotate(90deg);
    }

    .commands-grid {
      grid-template-columns: 1fr;
      gap: 36px;
      max-width: 300px;
    }

    .title {
      letter-spacing: 4px;
    }
  }
</style>
