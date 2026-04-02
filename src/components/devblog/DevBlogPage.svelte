<script lang="ts">
  import { onMount } from 'svelte';
  import Navbar from '../shared/Navbar.svelte';

  const entries = [
    {
      id: '2026-04-03-remotes',
      date: '03/04/2026',
      text: `Added git push, fetch, and pull. Since everything runs in the browser there's no actual remote server, so I fake it — a second git repo living at /remote/origin on the same IndexedDB filesystem. Push copies objects one way, fetch the other. isomorphic-git doesn't care, it just reads and writes content-addressed blobs.

Three new levels that teach the basics of remote collaboration. Brother Guybrush pushes to the remote while you're not looking and you have to deal with it. Also added the remote tracking branches to the commit graph — they show up with a dashed border so you can tell them apart from local branches.

The undo system now handles remotes too. If you push and then undo, the remote goes back to its previous state. That part took longer than the push itself.`,
    },
    {
      id: '2026-04-02-thousand',
      date: '02/04/2026',
      text: `A thousand people played Gitvana in the first day. I don't really know what happened. I shared it on Reddit, went to make coffee, came back and the numbers on the telemetry dashboard looked wrong. They weren't wrong.

I'm genuinely grateful. This is a side project I built at night because I thought git tutorials were boring. The fact that strangers are actually playing it and some of them are learning from it means a lot to me.

If you've made it here — thank you. If you have feedback, ideas, complaints, anything — I'd love to hear it. You can open an issue on GitHub or just reach out. I read everything. This project is small and I want to make it better, and I can't do that without hearing from the people who use it.`,
    },
    {
      id: '2026-03-31-start',
      date: '31/03/2026',
      text: `Started this. The idea: a game that teaches git but doesn't feel like homework. Every tutorial I've seen follows the same pattern. Init, add, commit, branch, merge. Nobody learns git from that.

What if it was an adventure game. A monastery where monks preserve ancient code. A cat that judges your commits. The dialogue style is inspired by Monkey Island — absurd, self-aware, a bit stupid. I figured humor and learning can coexist.

Got a prototype working tonight. Terminal on the left, commit graph on the right, objectives on top. You type real git commands and the graph updates in real time. It's 3am and I should stop but I keep adding things.

I might be onto something or I might lose interest in a week. We'll see.`,
    },
  ];

  // --- Likes ---
  const SESSION_KEY = 'gitvana-session-id';
  function getSessionId(): string {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  const LIKES_STORAGE_KEY = 'gitvana-blog-likes';

  function loadLocalLikes(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(LIKES_STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  function saveLocalLikes(liked: Record<string, boolean>) {
    localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(liked));
  }

  let likeCounts = $state<Record<string, number>>({});
  let likedByMe = $state<Record<string, boolean>>(loadLocalLikes());

  let serverReachable = false;

  async function fetchLikes() {
    try {
      const res = await fetch(`/api/blog/likes?session=${getSessionId()}`);
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      serverReachable = true;
      likeCounts = data.counts || {};
      // Merge: keep local likes, overlay server truth
      const serverLiked = data.liked || {};
      likedByMe = { ...likedByMe, ...serverLiked };
      saveLocalLikes(likedByMe);
    } catch { /* offline — local state is fine */ }
  }

  async function toggleLike(postId: string) {
    const wasLiked = !!likedByMe[postId];
    // Optimistic update
    likedByMe = { ...likedByMe, [postId]: !wasLiked };
    likeCounts = { ...likeCounts, [postId]: (likeCounts[postId] || 0) + (wasLiked ? -1 : 1) };
    saveLocalLikes(likedByMe);

    try {
      const res = await fetch('/api/blog/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          sessionId: getSessionId(),
          unlike: wasLiked,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        likeCounts = { ...likeCounts, [postId]: data.count };
      }
    } catch {
      // Keep local state — server will sync next time
    }
  }

  onMount(() => {
    fetchLikes();
  });
</script>

<div class="devblog-page">
  <Navbar currentPage="devblog" />

  <div class="devblog-content">
    <header class="devblog-header">
      <h1 class="devblog-title">GITVANA DEV LOG</h1>
      <p class="devblog-subtitle">Raffaele Pizzari</p>
    </header>

    <div class="entries">
      {#each entries as entry}
        <div class="entry">
          <div class="entry-date">{entry.date}</div>
          <div class="entry-text">{@html entry.text.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}</div>
          <button
            class="like-btn"
            class:liked={likedByMe[entry.id]}
            onclick={() => toggleLike(entry.id)}
            aria-label="Like this post"
          >
            <span class="like-heart">{likedByMe[entry.id] ? '\u2665' : '\u2661'}</span>
            {#if likeCounts[entry.id]}
              <span class="like-count">{likeCounts[entry.id]}</span>
            {/if}
          </button>
        </div>
      {/each}
    </div>

    <footer class="devblog-footer">
      <p>&copy; 2026 Raffaele Pizzari &mdash; <a href="https://github.com/pixari/gitvana">github</a></p>
    </footer>
  </div>
</div>

<style>
  .devblog-page {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 200;
    color: #c2c3c7;
    font-family: 'JetBrains Mono', monospace;
  }

  .devblog-content {
    max-width: 640px;
    margin: 0 auto;
    padding: 44px 24px 60px;
  }

  .devblog-header {
    padding: 56px 0 40px;
    border-bottom: 1px solid #1a1a2e;
    margin-bottom: 32px;
  }

  .devblog-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(12px, 3vw, 16px);
    color: #ffa300;
    margin: 0 0 10px;
    letter-spacing: 3px;
  }

  .devblog-subtitle {
    font-size: 12px;
    color: #5f574f;
    margin: 0;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .entry {
    padding: 24px 0;
    border-bottom: 1px solid #1a1a2e;
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry-date {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #5f574f;
    margin-bottom: 14px;
    letter-spacing: 1px;
  }

  .entry-text {
    font-size: 13px;
    color: #a09a93;
    line-height: 1.75;
  }

  .entry-text :global(p) {
    margin: 0 0 12px;
  }

  .entry-text :global(p:last-child) {
    margin-bottom: 0;
  }

  .like-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 0 0;
    color: #5f574f;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    transition: color 0.15s;
  }

  .like-btn:hover {
    color: #ff004d;
  }

  .like-btn.liked {
    color: #ff004d;
  }

  .like-heart {
    font-size: 16px;
    line-height: 1;
  }

  .like-count {
    font-size: 11px;
    color: #5f574f;
  }

  .like-btn.liked .like-count {
    color: #ff004d88;
  }

  .devblog-footer {
    margin-top: 48px;
    padding: 24px 0;
    border-top: 1px solid #1a1a2e;
  }

  .devblog-footer p {
    font-size: 11px;
    color: #5f574f55;
    margin: 0;
  }

  .devblog-footer a {
    color: #5f574f88;
    text-decoration: none;
  }

  .devblog-footer a:hover {
    color: #ffa300;
  }

  @media (max-width: 600px) {
    .devblog-content {
      padding: 44px 16px 40px;
    }
  }
</style>
