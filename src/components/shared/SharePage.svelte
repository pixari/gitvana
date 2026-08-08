<script lang="ts">
  import { generateShareImage } from './ShareImage.js';
  import { getStage, TOTAL_LEVELS } from '../../lib/engine/progression/stages.js';
  import { t } from '../../i18n/index.js';

  interface ShareParams {
    name: string;
    level: number;
    title: string;
    stars: number;
    cmds: number;
    stage: string;
    completed: number;
  }

  interface Props {
    params: ShareParams;
  }

  let { params }: Props = $props();

  const stageObj = $derived(getStage(params.completed));
  const stageName = $derived(t(`stages.stage_${stageObj.id}_name`));

  let imageUrl: string | null = $state(null);
  let imageBlob: Blob | null = $state(null);

  $effect(() => {
    generateShareImage({
      levelTitle: params.title,
      levelOrder: params.level,
      act: 1,
      stars: params.stars,
      commandCount: params.cmds,
      stageName: params.stage || stageName,
      stageColor: stageObj.color,
      completedLevels: params.completed,
      totalLevels: TOTAL_LEVELS,
      playerName: params.name,
    }).then((blob) => {
      imageBlob = blob;
      imageUrl = URL.createObjectURL(blob);
    }).catch(() => {});

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  });

  const starsDisplay = $derived('⭐'.repeat(params.stars));
  const siteUrl = 'https://gitvana.pixari.dev';

  const tweetText = $derived(
    encodeURIComponent(`I just completed Level ${params.level}: ${params.title} with ${starsDisplay} on @gitvana! Can you beat my score?`)
  );
  const currentUrl = $derived(encodeURIComponent(window.location.href));

  let copied = $state(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      copied = false;
    }
  }

  function downloadImage() {
    if (!imageBlob) return;
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gitvana-achievement.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="share-page">
  <div class="share-content">
    <div class="brand">GITVANA</div>
    <h1 class="achievement-text">{params.name} achieved {params.stage || stageName} on Gitvana!</h1>

    <div class="card-container">
      {#if imageUrl}
        <img src={imageUrl} alt="Achievement card" class="achievement-img" />
      {:else}
        <div class="loading">Generating achievement card...</div>
      {/if}
    </div>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Level</span>
        <span class="detail-value">{params.level}: {params.title}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Stars</span>
        <span class="detail-value">{starsDisplay || 'None'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Commands</span>
        <span class="detail-value">{params.cmds}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Player</span>
        <span class="detail-value">{params.name}</span>
      </div>
    </div>

    <a href={siteUrl} class="cta-btn">PLAY GITVANA</a>

    <div class="social-buttons">
      <a
        class="social-btn btn-twitter"
        href="https://twitter.com/intent/tweet?text={tweetText}&url={currentUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="social-icon">&#x1D54F;</span> SHARE ON X
      </a>
      <a
        class="social-btn btn-linkedin"
        href="https://www.linkedin.com/sharing/share-offsite/?url={currentUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="social-icon">in</span> LINKEDIN
      </a>
      <button class="social-btn btn-copy" onclick={copyLink}>
        {copied ? 'COPIED!' : 'COPY LINK'}
      </button>
      <button class="social-btn btn-download" onclick={downloadImage} disabled={!imageBlob}>
        DOWNLOAD
      </button>
    </div>
  </div>
</div>

<style>
  .share-page {
    min-height: 100vh;
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .share-content {
    max-width: 640px;
    width: 100%;
    text-align: center;
  }

  .brand {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: #ffa300;
    letter-spacing: 4px;
    margin-bottom: 16px;
    text-shadow: 0 0 10px #ffa30066;
  }

  .achievement-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    color: #c2c3c7;
    font-weight: normal;
    margin: 0 0 24px;
    line-height: 1.5;
  }

  .card-container {
    margin-bottom: 24px;
    border: 2px solid #2a2a4e;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a2e;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .achievement-img {
    width: 100%;
    height: auto;
    display: block;
  }

  .loading {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #5f574f;
    padding: 60px;
  }

  .details {
    background: #1a1a2e;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    padding: 6px 0;
    border-bottom: 1px solid #2a2a4e22;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    color: #5f574f;
  }

  .detail-value {
    color: #c2c3c7;
  }

  .cta-btn {
    display: inline-block;
    padding: 16px 48px;
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: #0a0a0a;
    background: #00ff41;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    letter-spacing: 3px;
    text-decoration: none;
    transition: transform 0.1s, background 0.2s;
    margin-bottom: 28px;
  }

  .cta-btn:hover {
    transform: translateY(-2px);
    background: #33ff66;
  }

  .social-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }

  .social-btn {
    padding: 10px 16px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: transform 0.1s, background 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .social-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .social-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .social-icon {
    font-size: 10px;
    font-weight: bold;
  }

  .btn-twitter {
    color: #fff;
    background: #1a1a2e;
    border: 1px solid #2a2a4e;
  }

  .btn-twitter:hover {
    background: #2a2a4e;
  }

  .btn-linkedin {
    color: #fff;
    background: #0a66c2;
  }

  .btn-linkedin:hover {
    background: #0b7ad4;
  }

  .btn-copy {
    color: #0a0a0a;
    background: #00ff41;
  }

  .btn-copy:hover:not(:disabled) {
    background: #33ff66;
  }

  .btn-download {
    color: #0a0a0a;
    background: #ffa300;
  }

  .btn-download:hover:not(:disabled) {
    background: #ffb733;
  }
</style>
