<script lang="ts">
  import type { Stage } from '../../lib/engine/progression/stages.js';
  import { TOTAL_LEVELS } from '../../lib/engine/progression/stages.js';
  import { generateShareImage } from './ShareImage.js';
  import { t } from '../../i18n/index.js';

  interface Props {
    levelTitle: string;
    levelOrder: number;
    act: number;
    stars: number;
    commandCount: number;
    stage: Stage;
    completedLevels: number;
    playerName?: string;
    onClose?: () => void;
  }

  let { levelTitle, levelOrder, act, stars, commandCount, stage, completedLevels, playerName, onClose }: Props = $props();

  let copied = $state(false);
  let webShareAvailable = $state(false);
  let imageBlob: Blob | null = $state(null);
  let imageUrl: string | null = $state(null);
  let generating = $state(true);

  const stageName = $derived(t(`stages.stage_${stage.id}_name`));

  const shareUrl = $derived(
    `https://gitvana.pixari.dev/#/share?name=${encodeURIComponent(playerName || 'Anonymous Monk')}&level=${levelOrder}&title=${encodeURIComponent(levelTitle)}&stars=${stars}&cmds=${commandCount}&stage=${encodeURIComponent(stageName)}&completed=${completedLevels}`
  );

  const starsEmoji = $derived('⭐'.repeat(stars));
  const tweetText = $derived(
    encodeURIComponent(`I just completed Level ${levelOrder}: ${levelTitle} with ${starsEmoji} on @gitvana! Can you beat my score?`)
  );

  $effect(() => {
    webShareAvailable = typeof navigator !== 'undefined' && !!navigator.share;
  });

  $effect(() => {
    generateShareImage({
      levelTitle,
      levelOrder,
      act,
      stars,
      commandCount,
      stageName,
      stageColor: stage.color,
      completedLevels,
      totalLevels: TOTAL_LEVELS,
      playerName,
    }).then((blob) => {
      imageBlob = blob;
      imageUrl = URL.createObjectURL(blob);
      generating = false;
    }).catch(() => {
      generating = false;
    });

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
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

  async function webShare() {
    if (!imageBlob) return;
    try {
      const file = new File([imageBlob], 'gitvana-achievement.png', { type: 'image/png' });
      await navigator.share({
        title: 'GITVANA — Stage Clear!',
        text: `I completed Level ${levelOrder}: ${levelTitle} with ${stars} star${stars !== 1 ? 's' : ''}!`,
        url: shareUrl,
        files: [file],
      });
    } catch {
      // User cancelled or share failed
    }
  }
</script>

<div class="share-overlay" role="dialog" aria-label="Share your result">
  <div class="share-card">
    <div class="share-header">SHARE RESULT</div>

    <div class="image-preview">
      {#if generating}
        <div class="generating">Generating image...</div>
      {:else if imageUrl}
        <img src={imageUrl} alt="Share card preview" class="preview-img" />
      {:else}
        <div class="generating">Failed to generate image</div>
      {/if}
    </div>

    <div class="share-buttons">
      <a
        class="share-btn btn-twitter"
        href="https://twitter.com/intent/tweet?text={tweetText}&url={encodeURIComponent(shareUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        &#x1D54F;
      </a>
      <a
        class="share-btn btn-linkedin"
        href="https://www.linkedin.com/sharing/share-offsite/?url={encodeURIComponent(shareUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        in
      </a>
      <button class="share-btn btn-copy" onclick={copyLink}>
        {copied ? 'COPIED!' : 'COPY LINK'}
      </button>
      <button class="share-btn btn-download" onclick={downloadImage} disabled={!imageBlob}>
        DOWNLOAD
      </button>
      {#if webShareAvailable}
        <button class="share-btn btn-share" onclick={webShare} disabled={!imageBlob}>
          SHARE
        </button>
      {/if}
    </div>

    {#if onClose}
      <button class="close-btn" onclick={onClose}>CLOSE</button>
    {/if}
  </div>
</div>

<style>
  .share-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0aee;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .share-card {
    background: #1a1a2e;
    border: 2px solid #5f9ea0;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    max-width: 520px;
    width: 90%;
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .share-header {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #5f9ea0;
    letter-spacing: 3px;
    margin-bottom: 16px;
  }

  .image-preview {
    margin-bottom: 16px;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    overflow: hidden;
    background: #0a0a0a;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-img {
    width: 100%;
    height: auto;
    display: block;
  }

  .generating {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #5f574f;
    padding: 40px;
  }

  .share-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .share-btn {
    flex: 1;
    padding: 10px;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: transform 0.1s, background 0.2s;
  }

  .share-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .share-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .share-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-twitter {
    color: #fff;
    background: #1a1a2e;
    border: 1px solid #2a2a4e;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex: 0 0 auto;
    min-width: 40px;
  }

  .btn-twitter:hover {
    background: #2a2a4e;
  }

  .btn-linkedin {
    color: #fff;
    background: #0a66c2;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex: 0 0 auto;
    min-width: 40px;
  }

  .btn-linkedin:hover {
    background: #0b7ad4;
  }

  .btn-download {
    color: #0a0a0a;
    background: #ffa300;
  }

  .btn-download:hover:not(:disabled) {
    background: #ffb733;
  }

  .btn-copy {
    color: #0a0a0a;
    background: #00ff41;
  }

  .btn-copy:hover:not(:disabled) {
    background: #33ff66;
  }

  .btn-share {
    color: #fff;
    background: #5f9ea0;
  }

  .btn-share:hover:not(:disabled) {
    background: #7abcbe;
  }

  .close-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #5f574f;
    background: none;
    border: none;
    cursor: pointer;
    letter-spacing: 1px;
    padding: 4px 8px;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #c2c3c7;
  }
</style>
