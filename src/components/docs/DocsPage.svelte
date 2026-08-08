<script lang="ts">
  import { commandDocs } from '../../docs/commands/index.js';
  import { guides } from '../../docs/guides/index.js';
  import type { CommandDoc, GuideDoc } from '../../docs/types.js';
  import { locale } from '../../i18n/index.js';
  import { loadCommandOverrides, loadGuideOverrides, mergeCommandDoc, mergeGuide } from '../../i18n/content/docs.js';
  import Navbar from '../shared/Navbar.svelte';

  interface Props {
    commandName?: string;
  }

  let { commandName }: Props = $props();

  // Determine if we're viewing a guide or a command
  const isGuideRoute = $derived(commandName?.startsWith('guide/') ?? false);
  const guideId = $derived(isGuideRoute ? commandName!.slice('guide/'.length) : null);

  let commandOverrides: Record<string, { description?: string; tip?: string; advanced?: string; options?: string[]; examples?: string[] }> = $state({});
  let guideOverrides: Record<string, { title?: string; content?: string }> = $state({});

  $effect(() => {
    loadCommandOverrides($locale).then(o => { commandOverrides = o; });
    loadGuideOverrides($locale).then(o => { guideOverrides = o; });
  });

  // Localized views of the full docs/guides maps — used everywhere in this
  // component instead of the raw English `guides`/`commandDocs` imports.
  const localizedGuides = $derived(
    Object.fromEntries(Object.entries(guides).map(([id, g]) => [id, mergeGuide(g, guideOverrides[id])]))
  );
  const localizedCommandDocs = $derived(
    Object.fromEntries(Object.entries(commandDocs).map(([key, d]) => [key, mergeCommandDoc(d, commandOverrides[key])]))
  );

  const guide = $derived(guideId ? localizedGuides[guideId] ?? null : null);
  const doc = $derived(!isGuideRoute && commandName ? localizedCommandDocs[commandName] ?? null : null);

  // Guide categories for sidebar
  const guideCategories = [
    { label: 'Fundamentals', category: 'fundamentals' as const },
    { label: 'Branching', category: 'branching' as const },
    { label: 'Advanced', category: 'advanced' as const },
  ];

  function getGuidesByCategory(category: GuideDoc['category']): GuideDoc[] {
    return Object.values(localizedGuides)
      .filter(g => g.category === category)
      .sort((a, b) => a.order - b.order);
  }

  // Command categories for sidebar
  const categories = [
    { label: 'Getting Started', commands: ['init', 'status'] },
    { label: 'Making Changes', commands: ['add', 'commit', 'diff', 'rm'] },
    { label: 'Branching', commands: ['branch', 'checkout', 'switch', 'merge'] },
    { label: 'Undoing Things', commands: ['reset', 'revert'] },
    { label: 'Viewing History', commands: ['log', 'show', 'blame'] },
    { label: 'Advanced', commands: ['rebase', 'cherry-pick', 'stash', 'tag', 'reflog', 'bisect'] },
  ];

  const allCommands = Object.keys(commandDocs);

  function navigate(cmd?: string) {
    if (cmd) {
      window.location.hash = `#/docs/${cmd}`;
    } else {
      window.location.hash = '#/docs';
    }
  }

  function navigateGuide(id: string) {
    window.location.hash = `#/docs/guide/${id}`;
  }

  function goToGame() {
    window.location.hash = '';
    window.location.reload();
  }

  // Mobile sidebar toggle
  let sidebarOpen = $state(false);

  function copyToClipboard(text: string, event: MouseEvent) {
    navigator.clipboard.writeText(text);
    const btn = event.currentTarget as HTMLButtonElement;
    const original = btn.textContent;
    btn.textContent = 'COPIED';
    setTimeout(() => { btn.textContent = original; }, 1200);
  }

  // Simple markdown-like renderer for guide content
  function renderGuideContent(content: string): { type: string; text: string }[] {
    const lines = content.split('\n');
    const result: { type: string; text: string }[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          result.push({ type: 'code-block', text: codeLines.join('\n') });
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (line.startsWith('### ')) {
        result.push({ type: 'h4', text: line.slice(4) });
      } else if (line.startsWith('## ')) {
        result.push({ type: 'h3', text: line.slice(3) });
      } else if (line.trim() === '') {
        result.push({ type: 'blank', text: '' });
      } else {
        result.push({ type: 'p', text: line });
      }
    }

    return result;
  }

  // Inline code and bold rendering
  function renderInline(text: string): string {
    // escape html
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // inline code
    s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return s;
  }

  const guideContent = $derived(guide ? renderGuideContent(guide.content) : []);
</script>

<div class="docs-page">
  <div class="scanlines"></div>

  <Navbar currentPage="docs" />

  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="sidebar-toggle" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle sidebar">
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>
      <a href="#/docs" class="topbar-title" onclick={(e) => { e.preventDefault(); navigate(); }}>GITVANA DOCS</a>
    </div>
  </header>

  <div class="docs-layout">
    <!-- Sidebar -->
    <nav class="sidebar" class:sidebar-open={sidebarOpen}>
      <!-- Guides section -->
      <div class="sidebar-header">
        <span class="sidebar-label">LEARN GIT</span>
      </div>
      {#each guideCategories as cat}
        <div class="sidebar-category">
          <span class="category-label">{cat.label}</span>
          {#each getGuidesByCategory(cat.category) as g}
            <button
              class="sidebar-item"
              class:active={guideId === g.id}
              onclick={() => { navigateGuide(g.id); sidebarOpen = false; }}
            >
              {g.title}
            </button>
          {/each}
        </div>
      {/each}

      <!-- Commands section -->
      <div class="sidebar-header sidebar-header-commands">
        <span class="sidebar-label">COMMANDS</span>
      </div>
      {#each categories as cat}
        <div class="sidebar-category">
          <span class="category-label">{cat.label}</span>
          {#each cat.commands as cmd}
            {#if localizedCommandDocs[cmd]}
              <button
                class="sidebar-item"
                class:active={!isGuideRoute && commandName === cmd}
                onclick={() => { navigate(cmd); sidebarOpen = false; }}
              >
                git {cmd}
              </button>
            {/if}
          {/each}
        </div>
      {/each}
    </nav>

    <!-- Overlay for mobile sidebar -->
    {#if sidebarOpen}
      <div class="sidebar-overlay" onclick={() => sidebarOpen = false} role="presentation"></div>
    {/if}

    <!-- Main content -->
    <main class="main-content">
      {#if guide}
        <!-- Guide detail view -->
        <article class="guide-detail">
          <div class="guide-category-badge">{guide.category.toUpperCase()}</div>
          <h1 class="guide-heading">{guide.title}</h1>

          <div class="guide-body">
            {#each guideContent as block}
              {#if block.type === 'h3'}
                <h3 class="guide-section-heading">{block.text}</h3>
              {:else if block.type === 'h4'}
                <h4 class="guide-sub-heading">{block.text}</h4>
              {:else if block.type === 'code-block'}
                <pre class="guide-code-block">{block.text}</pre>
              {:else if block.type === 'blank'}
                <div class="guide-spacer"></div>
              {:else}
                <p class="guide-text">{@html renderInline(block.text)}</p>
              {/if}
            {/each}
          </div>

          <!-- Related commands -->
          {#if guide.relatedCommands.length > 0}
            <section class="doc-section">
              <h2 class="section-label">RELATED COMMANDS</h2>
              <div class="related-list">
                {#each guide.relatedCommands as rel}
                  {#if localizedCommandDocs[rel]}
                    <button class="related-badge" onclick={() => navigate(rel)}>git {rel}</button>
                  {:else}
                    <span class="related-badge related-badge-inactive">git {rel}</span>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}
        </article>
      {:else if doc}
        <!-- Command detail view -->
        <article class="command-detail">
          <h1 class="command-heading">git {doc.name}</h1>

          <!-- Syntax -->
          <section class="doc-section">
            <h2 class="section-label">SYNTAX</h2>
            <div class="code-block-wrapper">
              <pre class="code-block">{doc.syntax}</pre>
              <button class="copy-btn" onclick={(e) => copyToClipboard(doc.syntax, e)}>COPY</button>
            </div>
          </section>

          <!-- Description -->
          <section class="doc-section">
            <h2 class="section-label">DESCRIPTION</h2>
            <p class="description-text">{doc.description}</p>
          </section>

          <!-- Options -->
          {#if doc.options.length > 0}
            <section class="doc-section">
              <h2 class="section-label">OPTIONS</h2>
              <div class="options-table-wrap">
                <table class="options-table">
                  <thead>
                    <tr>
                      <th class="opt-th">Flag</th>
                      <th class="opt-th">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each doc.options as opt}
                      <tr>
                        <td class="opt-flag"><code>{opt.flag}</code></td>
                        <td class="opt-desc">{opt.description}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </section>
          {/if}

          <!-- Examples -->
          {#if doc.examples.length > 0}
            <section class="doc-section">
              <h2 class="section-label">EXAMPLES</h2>
              {#each doc.examples as ex}
                <div class="example-item">
                  <div class="code-block-wrapper">
                    <pre class="code-block">{ex.command}</pre>
                    <button class="copy-btn" onclick={(e) => copyToClipboard(ex.command, e)}>COPY</button>
                  </div>
                  <p class="example-explanation">{ex.explanation}</p>
                </div>
              {/each}
            </section>
          {/if}

          <!-- Real World Tip -->
          <section class="doc-section">
            <h2 class="section-label">REAL WORLD TIP</h2>
            <div class="tip-callout">
              <span class="tip-icon">&#x1F4A1;</span>
              <p class="tip-text">{doc.tip}</p>
            </div>
          </section>

          <!-- Advanced section (optional) -->
          {#if doc.advanced}
            <section class="doc-section">
              <h2 class="section-label">ADVANCED</h2>
              <div class="advanced-block">
                {#each doc.advanced.split('\n') as line}
                  {#if line.startsWith('## ')}
                    <h3 class="advanced-heading">{line.slice(3)}</h3>
                  {:else if line.startsWith('**') && line.endsWith('**')}
                    <p class="advanced-bold">{line.slice(2, -2)}</p>
                  {:else if line.startsWith('```')}
                    <!-- skip fence lines -->
                  {:else if line.trim() === ''}
                    <!-- skip empty -->
                  {:else}
                    <p class="advanced-text">{line}</p>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}

          <!-- See Also (guides) -->
          {#if doc.seeAlso && doc.seeAlso.length > 0}
            <section class="doc-section">
              <h2 class="section-label">LEARN MORE</h2>
              <div class="see-also-list">
                {#each doc.seeAlso as gId}
                  {#if localizedGuides[gId]}
                    <button class="see-also-card" onclick={() => navigateGuide(gId)}>
                      <span class="see-also-category">{localizedGuides[gId].category.toUpperCase()}</span>
                      <span class="see-also-title">{localizedGuides[gId].title}</span>
                    </button>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}

          <!-- Related Commands -->
          {#if doc.related.length > 0}
            <section class="doc-section">
              <h2 class="section-label">RELATED COMMANDS</h2>
              <div class="related-list">
                {#each doc.related as rel}
                  {#if localizedCommandDocs[rel]}
                    <button class="related-badge" onclick={() => navigate(rel)}>git {rel}</button>
                  {:else}
                    <span class="related-badge related-badge-inactive">git {rel}</span>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}
        </article>
      {:else}
        <!-- Index / welcome view -->
        <div class="docs-index">
          <h1 class="index-heading">Git Knowledge Base</h1>
          <p class="index-intro">Welcome to the Monastery's library. Learn how git truly works through conceptual guides, then master each command with real examples.</p>

          <!-- Guides section -->
          <section class="index-section">
            <h2 class="index-section-title">LEARN GIT</h2>
            <p class="index-section-desc">Conceptual guides that teach git's mental model -- not just syntax, but how things actually work under the hood.</p>

            {#each guideCategories as cat}
              <div class="index-category">
                <h3 class="index-category-title">{cat.label}</h3>
                <div class="guide-grid">
                  {#each getGuidesByCategory(cat.category) as g}
                    <button class="guide-card" onclick={() => navigateGuide(g.id)}>
                      <span class="guide-card-title">{g.title}</span>
                      <span class="guide-card-commands">
                        {#each g.relatedCommands.slice(0, 3) as cmd}
                          <code class="guide-card-cmd">{cmd}</code>
                        {/each}
                      </span>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </section>

          <!-- Commands section -->
          <section class="index-section">
            <h2 class="index-section-title">COMMAND REFERENCE</h2>
            <p class="index-section-desc">Complete reference for every git command available in Gitvana.</p>

            {#each categories as cat}
              <div class="index-category">
                <h3 class="index-category-title">{cat.label}</h3>
                <div class="command-grid">
                  {#each cat.commands as cmd}
                    {#if localizedCommandDocs[cmd]}
                      <button class="command-card" onclick={() => navigate(cmd)}>
                        <span class="card-name">git {cmd}</span>
                        <span class="card-desc">{localizedCommandDocs[cmd].description.split('.')[0]}.</span>
                      </button>
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          </section>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  /* ===== Base ===== */
  .docs-page {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    overflow: hidden;
    z-index: 200;
    color: #c2c3c7;
    font-family: 'JetBrains Mono', monospace;
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
      rgba(0, 0, 0, 0.06) 2px,
      rgba(0, 0, 0, 0.06) 4px
    );
  }

  /* Grid bg */
  .docs-page::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(0, 255, 65, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 65, 0.02) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 0;
  }

  /* ===== Top bar ===== */
  .topbar {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 52px;
    margin-top: 44px;
    background: #1a1a2e;
    border-bottom: 1px solid #00e43633;
    flex-shrink: 0;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sidebar-toggle {
    display: none;
    font-size: 18px;
    color: #c2c3c7;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
  }

  .topbar-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #ffa300;
    letter-spacing: 3px;
    text-decoration: none;
    text-shadow: 0 0 12px #ffa30044;
  }

  .topbar-title:hover {
    text-shadow: 0 0 20px #ffa30066;
  }

  /* ===== Layout ===== */
  .docs-layout {
    display: flex;
    height: calc(100vh - 52px);
    position: relative;
    z-index: 1;
  }

  /* ===== Sidebar ===== */
  .sidebar {
    width: 260px;
    min-width: 260px;
    background: #12121e;
    border-right: 1px solid #2a2a4e;
    overflow-y: auto;
    flex-shrink: 0;
    padding-bottom: 24px;
  }

  .sidebar-header {
    padding: 16px 16px 8px;
  }

  .sidebar-header-commands {
    margin-top: 12px;
    padding-top: 16px;
    border-top: 1px solid #2a2a4e;
  }

  .sidebar-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #5f574f;
    letter-spacing: 3px;
  }

  .sidebar-category {
    margin-top: 8px;
  }

  .category-label {
    display: block;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #ffa300;
    letter-spacing: 1px;
    padding: 8px 16px 4px;
  }

  .sidebar-item {
    display: block;
    width: 100%;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #c2c3c7;
    background: none;
    border: none;
    padding: 6px 16px 6px 24px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .sidebar-item:hover {
    background: #ffffff08;
    color: #00e436;
  }

  .sidebar-item.active {
    background: #00e43612;
    color: #00e436;
    border-left: 3px solid #00e436;
    padding-left: 21px;
  }

  .sidebar-overlay {
    display: none;
  }

  /* ===== Main content ===== */
  .main-content {
    flex: 1;
    overflow-y: auto;
    padding: 40px 48px;
    max-width: 900px;
  }

  /* ===== Guide detail ===== */
  .guide-detail {
    max-width: 780px;
  }

  .guide-category-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #29adff;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }

  .guide-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(14px, 3vw, 20px);
    color: #00e436;
    margin: 0 0 32px;
    letter-spacing: 2px;
    text-shadow: 0 0 16px #00e43633;
    line-height: 1.5;
  }

  .guide-body {
    margin-bottom: 40px;
  }

  .guide-section-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    color: #ffa300;
    letter-spacing: 1px;
    margin: 28px 0 14px;
    line-height: 1.5;
  }

  .guide-sub-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #29adff;
    letter-spacing: 1px;
    margin: 24px 0 10px;
    line-height: 1.5;
  }

  .guide-text {
    font-size: 13px;
    color: #c2c3c7;
    line-height: 1.8;
    margin: 0 0 2px;
  }

  .guide-text :global(strong) {
    color: #ffa300;
    font-weight: 600;
  }

  .guide-text :global(.inline-code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #00e436;
    background: #00e43612;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #00e43622;
  }

  .guide-code-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #00e436;
    background: #0d0d0d;
    padding: 14px 18px;
    border-radius: 6px;
    border: 1px solid #2a2a4e;
    margin: 12px 0;
    overflow-x: auto;
    line-height: 1.5;
  }

  .guide-spacer {
    height: 8px;
  }

  /* ===== Command detail ===== */
  .command-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(16px, 3vw, 24px);
    color: #00e436;
    margin: 0 0 32px;
    letter-spacing: 2px;
    text-shadow: 0 0 16px #00e43633;
  }

  .doc-section {
    margin-bottom: 32px;
  }

  .section-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #ffa300;
    letter-spacing: 3px;
    margin: 0 0 12px;
  }

  .code-block-wrapper {
    position: relative;
  }

  .code-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #00e436;
    background: #0d0d0d;
    padding: 14px 18px;
    border-radius: 6px;
    border: 1px solid #2a2a4e;
    margin: 0;
    overflow-x: auto;
    line-height: 1.5;
  }

  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #5f574f;
    background: #1a1a2e;
    border: 1px solid #2a2a4e;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: color 0.15s, border-color 0.15s;
  }

  .copy-btn:hover {
    color: #00e436;
    border-color: #00e43666;
  }

  .description-text {
    font-size: 13px;
    color: #c2c3c7;
    line-height: 1.8;
    margin: 0;
  }

  /* Options table */
  .options-table-wrap {
    overflow-x: auto;
  }

  .options-table {
    width: 100%;
    border-collapse: collapse;
    background: #0d0d0d;
    border-radius: 6px;
    overflow: hidden;
  }

  .opt-th {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #5f574f;
    letter-spacing: 2px;
    text-align: left;
    padding: 10px 16px;
    border-bottom: 1px solid #2a2a4e;
  }

  .options-table tr {
    border-bottom: 1px solid #1a1a2e;
  }

  .options-table tbody tr:last-child {
    border-bottom: none;
  }

  .opt-flag {
    padding: 10px 16px;
    vertical-align: top;
    white-space: nowrap;
  }

  .opt-flag code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #29adff;
  }

  .opt-desc {
    font-size: 12px;
    color: #c2c3c7;
    padding: 10px 16px;
    line-height: 1.5;
  }

  /* Examples */
  .example-item {
    margin-bottom: 16px;
  }

  .example-item:last-child {
    margin-bottom: 0;
  }

  .example-explanation {
    font-size: 12px;
    color: #5f574f;
    margin: 6px 0 0 0;
    padding-left: 4px;
    line-height: 1.5;
  }

  /* Tip callout */
  .tip-callout {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 16px 20px;
    background: #ffa30008;
    border: 1px solid #ffa30033;
    border-left: 4px solid #ffa300;
    border-radius: 0 6px 6px 0;
  }

  .tip-icon {
    font-size: 18px;
    flex-shrink: 0;
    line-height: 1;
  }

  .tip-text {
    font-size: 13px;
    color: #ffa300;
    line-height: 1.7;
    margin: 0;
  }

  /* Advanced section */
  .advanced-block {
    padding: 16px 20px;
    background: #0d0d0d;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
  }

  .advanced-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #29adff;
    margin: 0 0 12px;
    letter-spacing: 1px;
  }

  .advanced-bold {
    font-size: 12px;
    color: #ffa300;
    font-weight: 700;
    margin: 12px 0 4px;
    line-height: 1.5;
  }

  .advanced-text {
    font-size: 12px;
    color: #c2c3c7;
    margin: 4px 0;
    line-height: 1.7;
  }

  /* See Also (guides) */
  .see-also-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .see-also-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    padding: 12px 16px;
    background: #29adff08;
    border: 1px solid #29adff33;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    min-width: 200px;
  }

  .see-also-card:hover {
    background: #29adff18;
    border-color: #29adff66;
  }

  .see-also-category {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #5f574f;
    letter-spacing: 2px;
  }

  .see-also-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #29adff;
  }

  /* Related badges */
  .related-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .related-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #29adff;
    background: #29adff12;
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid #29adff33;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .related-badge:hover {
    background: #29adff22;
    color: #5bc8ff;
  }

  .related-badge-inactive {
    cursor: default;
    opacity: 0.5;
  }

  .related-badge-inactive:hover {
    background: #29adff12;
    color: #29adff;
  }

  /* ===== Index / welcome view ===== */
  .docs-index {
    max-width: 800px;
  }

  .index-heading {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(14px, 3vw, 22px);
    color: #00e436;
    margin: 0 0 16px;
    letter-spacing: 2px;
    text-shadow: 0 0 16px #00e43633;
  }

  .index-intro {
    font-size: 14px;
    color: #5f574f;
    line-height: 1.7;
    margin: 0 0 40px;
    max-width: 600px;
  }

  .index-section {
    margin-bottom: 48px;
  }

  .index-section-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #00e436;
    letter-spacing: 3px;
    margin: 0 0 8px;
  }

  .index-section-desc {
    font-size: 12px;
    color: #5f574f;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .index-category {
    margin-bottom: 24px;
  }

  .index-category-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #ffa300;
    letter-spacing: 2px;
    margin: 0 0 14px;
  }

  .guide-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .guide-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
    padding: 16px 18px;
    background: #12121e;
    border: 1px solid #29adff33;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s, background 0.15s;
    color: inherit;
  }

  .guide-card:hover {
    border-color: #29adff66;
    transform: translateY(-1px);
    background: #1a1a2e;
  }

  .guide-card-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #29adff;
    font-weight: 600;
  }

  .guide-card-commands {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .guide-card-cmd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
    background: #5f574f12;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .command-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .command-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    padding: 16px 18px;
    background: #12121e;
    border: 1px solid #2a2a4e;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s, background 0.15s;
    color: inherit;
  }

  .command-card:hover {
    border-color: #00e43644;
    transform: translateY(-1px);
    background: #1a1a2e;
  }

  .card-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #00e436;
    font-weight: 600;
  }

  .card-desc {
    font-size: 11px;
    color: #5f574f;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ===== Responsive ===== */
  @media (max-width: 860px) {
    .sidebar {
      position: fixed;
      top: 52px;
      left: 0;
      bottom: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    .sidebar.sidebar-open {
      transform: translateX(0);
    }

    .sidebar-toggle {
      display: block;
    }

    .sidebar-overlay {
      display: block;
      position: fixed;
      inset: 0;
      top: 52px;
      background: #0a0a0a88;
      z-index: 99;
    }

    .main-content {
      padding: 24px 20px;
    }
  }

  @media (max-width: 500px) {
    .main-content {
      padding: 16px 14px;
    }

    .command-grid,
    .guide-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
