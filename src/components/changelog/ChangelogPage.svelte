<script lang="ts">
  import Navbar from '../shared/Navbar.svelte';

  const tagColors: Record<string, string> = {
    release: '#ffa300',
    engine: '#29adff',
    content: '#00e436',
    feature: '#ff77a8',
    docs: '#83769c',
    milestone: '#ffd700',
    fix: '#ff004d',
  };

  const entries = [
    {
      date: '2026-04-06',
      title: 'i18n Infrastructure',
      tags: ['feature'],
      content: 'Internationalization support is here. UI strings are now translatable via JSON locale files. Language picker ready (shows when 2+ locales available). English extracted as source of truth. Community translations welcome \u2014 see CONTRIBUTING_TRANSLATIONS.md.'
    },
    {
      date: '2026-04-06',
      title: 'Bug Fixes \u2014 Terminal, Diff, Levels',
      tags: ['fix'],
      content: 'Fixed: chained nano/edit commands (#36), git diff with commit refs (#29), level 4 star threshold (#31), Ctrl+L clear (#24), long input line wrapping (#34), repo state sync after undo (#27). Added man command (#32) and color-coded git log (#35).'
    },
    {
      date: '2026-04-06',
      title: 'Tablet Support',
      tags: ['feature'],
      content: 'Gitvana now works on tablets in landscape mode. Panels stack vertically on narrower screens. The mobile fallback only triggers on phone-sized viewports now.'
    },
    {
      date: '2026-04-04',
      title: 'Bug Fixes \u2014 Rebase, Diff, Commit',
      tags: ['fix', 'engine'],
      content: 'Fixed rebase conflict handling crashing with a JavaScript error instead of showing conflict markers (#23). Fixed git diff showing entire file as additions instead of just changed lines (#22). git commit with pathspec (e.g. git commit . -m "msg") now auto-stages files before committing.'
    },
    {
      date: '2026-04-03',
      title: 'Simulated Remotes \u2014 Push, Fetch, Pull',
      tags: ['feature', 'engine'],
      content: 'Git push, fetch, and pull now work via simulated remote repositories running entirely in the browser. 3 new levels teaching remote collaboration. Remote tracking branches visible in the commit graph. Dev blog page added.'
    },
    {
      date: '2026-04-02',
      title: 'v1.0 \u2014 The Grand Opening',
      tags: ['release'],
      content: 'Gitvana launches with 35 levels across 6 acts, 21 git commands, pixel art, chiptune sounds, and a monastery full of questionable life choices. The cat is pleased.'
    },
    {
      date: '2026-04-02',
      title: 'Proper 3-Way Merge Engine',
      tags: ['engine'],
      content: 'Replaced file-level conflict detection with line-level diff3 merging. Changes in different regions of the same file now auto-merge correctly. Merge, cherry-pick, rebase, and revert all benefit.'
    },
    {
      date: '2026-04-01',
      title: 'Level Difficulty Rework',
      tags: ['content'],
      content: 'Rewrote levels 15-35 to be genuinely challenging. Later levels now require investigation (blame, bisect, reflog) before acting. Boss levels have cascading problems. Level 35 has zero hints.'
    },
    {
      date: '2026-04-01',
      title: '9 New Git Commands',
      tags: ['feature'],
      content: 'Added tag, cherry-pick, show, revert, stash, reflog, rebase, blame, and bisect. The monastery now teaches real git mastery, not just basics.'
    },
    {
      date: '2026-04-01',
      title: 'Conceptual Guides',
      tags: ['docs'],
      content: '9 in-depth guides explaining how git actually works: content-addressable filesystem, the three areas, merge vs rebase, the reflog safety net, and more. Available in-game and at /docs.'
    },
    {
      date: '2026-03-31',
      title: 'The Monastery Opens Its Gates',
      tags: ['milestone'],
      content: 'First playable version with 6 levels, a terminal, and a judgmental cat. The Head Monk is skeptical but willing to give you a chance.'
    },
  ];

  function getBorderColor(tags: string[]): string {
    return tagColors[tags[0]] ?? '#5f574f';
  }
</script>

<div class="changelog-page">
  <Navbar currentPage="changelog" />

  <div class="changelog-content">
    <header class="changelog-header">
      <h1 class="changelog-title">CHANGELOG</h1>
      <p class="changelog-subtitle">The monastery's development log</p>
    </header>

    <div class="entries">
      {#each entries as entry}
        <article class="entry" style="border-left-color: {getBorderColor(entry.tags)}">
          <div class="entry-meta">
            <span class="entry-date">{entry.date}</span>
            <div class="entry-tags">
              {#each entry.tags as tag}
                <span class="tag" style="background: {tagColors[tag] ?? '#5f574f'}22; color: {tagColors[tag] ?? '#5f574f'}; border-color: {tagColors[tag] ?? '#5f574f'}44">{tag}</span>
              {/each}
            </div>
          </div>
          <h2 class="entry-title">{entry.title}</h2>
          <p class="entry-content">{entry.content}</p>
        </article>
      {/each}
    </div>

    <!-- TODO: Add pagination when there are more entries -->

    <footer class="changelog-footer">
      <p>&copy; 2026 Raffaele Pizzari</p>
    </footer>
  </div>
</div>

<style>
  .changelog-page {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 200;
    color: #c2c3c7;
    font-family: 'JetBrains Mono', monospace;
  }

  .changelog-content {
    max-width: 700px;
    margin: 0 auto;
    padding: 44px 24px 60px;
  }

  .changelog-header {
    text-align: center;
    padding: 60px 0 48px;
  }

  .changelog-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(16px, 4vw, 28px);
    color: #ffa300;
    margin: 0 0 16px;
    letter-spacing: 4px;
    text-shadow: 0 0 20px #ffa30044;
  }

  .changelog-subtitle {
    font-size: 13px;
    color: #5f574f;
    margin: 0;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .entry {
    border-left: 3px solid #5f574f;
    padding: 16px 0 16px 20px;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .entry-date {
    font-size: 11px;
    color: #5f574f;
    letter-spacing: 0.5px;
  }

  .entry-tags {
    display: flex;
    gap: 6px;
  }

  .tag {
    font-size: 9px;
    font-family: 'Press Start 2P', monospace;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .entry-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #c2c3c7;
    margin: 0 0 10px;
    line-height: 1.6;
    letter-spacing: 0.5px;
  }

  .entry-content {
    font-size: 13px;
    color: #8a8580;
    line-height: 1.7;
    margin: 0;
  }

  .changelog-footer {
    margin-top: 80px;
    padding: 24px 0;
    text-align: center;
    border-top: 1px solid #1a1a2e22;
  }

  .changelog-footer p {
    font-size: 12px;
    color: #5f574f55;
    margin: 0;
  }
</style>
