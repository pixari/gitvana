<script lang="ts">
  import { commandDocs } from '../../docs/commands/index.js';
  import { guides } from '../../docs/guides/index.js';
  import type { GuideDoc } from '../../docs/types.js';

  interface Props {
    commandName: string;
    onClose: () => void;
  }

  let { commandName, onClose }: Props = $props();

  // Check if this is a guide request
  const isGuideRequest = $derived(
    commandName.startsWith('guide/') || guides[commandName] !== undefined
  );
  const guideId = $derived(
    commandName.startsWith('guide/') ? commandName.slice('guide/'.length) : commandName
  );
  const guide = $derived(isGuideRequest ? guides[guideId] ?? null : null);
  // Extract command name from strings like "git merge <branch>" or "git commit -m"
  const normalizedName = $derived(() => {
    let name = commandName;
    if (name.startsWith('git ')) name = name.slice(4);
    name = name.split(/[\s<\-]/)[0]; // take first word before space, <, or -
    return name;
  });
  const doc = $derived(!isGuideRequest ? commandDocs[commandName] ?? commandDocs[normalizedName()] ?? null : null);
  const showIndex = $derived(!doc && !guide);
  const allCommands = Object.keys(commandDocs);

  // Guide categories
  const guideCategories: { label: string; category: GuideDoc['category'] }[] = [
    { label: 'Fundamentals', category: 'fundamentals' },
    { label: 'Branching', category: 'branching' },
    { label: 'Advanced', category: 'advanced' },
  ];

  function getGuidesByCategory(category: GuideDoc['category']): GuideDoc[] {
    return Object.values(guides)
      .filter(g => g.category === category)
      .sort((a, b) => a.order - b.order);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('doc-overlay')) {
      onClose();
    }
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

  function renderInline(text: string): string {
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return s;
  }

  const guideContent = $derived(guide ? renderGuideContent(guide.content) : []);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="doc-overlay" onclick={handleOverlayClick} onkeydown={handleKeydown} role="dialog" aria-label="Documentation" tabindex="-1">
  <div class="doc-card">
    <div class="doc-header">
      <span class="doc-title">
        {#if guide}
          GUIDE: {guide.title}
        {:else if doc}
          DOCS: git {doc.name}
        {:else}
          DOCS: Git Knowledge Base
        {/if}
      </span>
      <button class="btn-close" onclick={onClose}>X</button>
    </div>

    <div class="doc-body">
      {#if guide}
        <!-- Guide content -->
        <div class="guide-category-label">{guide.category.toUpperCase()}</div>
        <div class="guide-content">
          {#each guideContent as block}
            {#if block.type === 'h3'}
              <h3 class="guide-h3">{block.text}</h3>
            {:else if block.type === 'h4'}
              <h4 class="guide-h4">{block.text}</h4>
            {:else if block.type === 'code-block'}
              <pre class="guide-code">{block.text}</pre>
            {:else if block.type === 'blank'}
              <div class="guide-gap"></div>
            {:else}
              <p class="guide-p">{@html renderInline(block.text)}</p>
            {/if}
          {/each}
        </div>

        {#if guide.relatedCommands.length > 0}
          <div class="doc-section">
            <h3 class="section-label">RELATED COMMANDS</h3>
            <div class="related-list">
              {#each guide.relatedCommands as rel}
                <code class="related-badge">{rel}</code>
              {/each}
            </div>
          </div>
        {/if}
      {:else if doc}
        <!-- Syntax -->
        <div class="doc-section">
          <h3 class="section-label">SYNTAX</h3>
          <pre class="syntax-block">{doc.syntax}</pre>
        </div>

        <!-- Description -->
        <div class="doc-section">
          <h3 class="section-label">DESCRIPTION</h3>
          <p class="description-text">{doc.description}</p>
        </div>

        <!-- Options -->
        {#if doc.options.length > 0}
          <div class="doc-section">
            <h3 class="section-label">OPTIONS</h3>
            <table class="options-table">
              <tbody>
                {#each doc.options as opt}
                  <tr>
                    <td class="opt-flag">{opt.flag}</td>
                    <td class="opt-desc">{opt.description}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <!-- Examples -->
        {#if doc.examples.length > 0}
          <div class="doc-section">
            <h3 class="section-label">EXAMPLES</h3>
            {#each doc.examples as ex}
              <div class="example-item">
                <pre class="example-cmd">{ex.command}</pre>
                <span class="example-explanation">{ex.explanation}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Tip -->
        <div class="doc-section">
          <h3 class="section-label">TIP</h3>
          <p class="tip-text">{doc.tip}</p>
        </div>

        <!-- See Also (guides) -->
        {#if doc.seeAlso && doc.seeAlso.length > 0}
          <div class="doc-section">
            <h3 class="section-label">LEARN MORE</h3>
            <div class="related-list">
              {#each doc.seeAlso as gId}
                {#if guides[gId]}
                  <code class="guide-badge">{guides[gId].title}</code>
                {/if}
              {/each}
            </div>
            <p class="guide-hint">Type <code class="inline-code">docs guide/&lt;id&gt;</code> or visit the full docs page for guide content.</p>
          </div>
        {/if}

        <!-- Related -->
        {#if doc.related.length > 0}
          <div class="doc-section">
            <h3 class="section-label">RELATED</h3>
            <div class="related-list">
              {#each doc.related as rel}
                <code class="related-badge">{rel}</code>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <!-- Index: show both guides and commands -->
        {#if commandName}
          <p class="not-found">No docs found for "{commandName}". See available guides and commands below:</p>
        {/if}

        <!-- Guides section -->
        <div class="doc-section">
          <h3 class="section-label">LEARN GIT</h3>
          {#each guideCategories as cat}
            <div class="index-category">
              <span class="index-category-label">{cat.label}</span>
              <div class="guide-list">
                {#each getGuidesByCategory(cat.category) as g}
                  <code class="guide-list-item">{g.title}</code>
                {/each}
              </div>
            </div>
          {/each}
          <p class="hint-text">Type <code class="inline-code">docs guide/&lt;id&gt;</code> to view a guide (e.g. <code class="inline-code">docs the-three-areas</code>).</p>
        </div>

        <!-- Commands section -->
        <div class="doc-section">
          <h3 class="section-label">COMMANDS</h3>
          <div class="command-grid">
            {#each allCommands as cmd}
              <code class="command-list-item">git {cmd}</code>
            {/each}
          </div>
          <p class="hint-text">Type <code class="inline-code">docs &lt;command&gt;</code> to view command documentation.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .doc-overlay {
    position: fixed;
    inset: 0;
    background: #0a0a0add;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 90;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .doc-card {
    background: #1a1a2e;
    border: 2px solid #00e436;
    border-radius: 6px;
    width: 90%;
    max-width: 680px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from { transform: translateY(10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #00e43618;
    border-bottom: 1px solid #00e43644;
    flex-shrink: 0;
  }

  .doc-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #00e436;
    letter-spacing: 1px;
  }

  .btn-close {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #c2c3c7;
    background: transparent;
    border: 1px solid #5f574f;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-close:hover {
    background: #5f574f33;
  }

  .doc-body {
    padding: 14px;
    overflow-y: auto;
    flex: 1;
  }

  .doc-section {
    margin-bottom: 16px;
  }

  .doc-section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #ffa300;
    letter-spacing: 2px;
    margin: 0 0 6px 0;
  }

  .syntax-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #00e436;
    background: #0a0a0a;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #2a2a4e;
    margin: 0;
    overflow-x: auto;
  }

  .description-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    line-height: 1.6;
    margin: 0;
  }

  .options-table {
    width: 100%;
    border-collapse: collapse;
  }

  .options-table tr {
    border-bottom: 1px solid #2a2a4e;
  }

  .options-table tr:last-child {
    border-bottom: none;
  }

  .opt-flag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #29adff;
    padding: 4px 12px 4px 0;
    white-space: nowrap;
    vertical-align: top;
  }

  .opt-desc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    padding: 4px 0;
    line-height: 1.4;
  }

  .example-item {
    margin-bottom: 8px;
  }

  .example-item:last-child {
    margin-bottom: 0;
  }

  .example-cmd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #00e436;
    background: #0a0a0a;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid #2a2a4e;
    margin: 0 0 2px 0;
    overflow-x: auto;
  }

  .example-explanation {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
    padding-left: 10px;
  }

  .tip-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #ffa300;
    line-height: 1.6;
    margin: 0;
    padding: 8px 12px;
    background: #ffa30010;
    border-left: 3px solid #ffa300;
    border-radius: 0 4px 4px 0;
  }

  .related-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .related-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #29adff;
    background: #29adff18;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid #29adff33;
  }

  .guide-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #29adff;
    background: #29adff08;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid #29adff33;
  }

  .guide-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5f574f;
    margin: 8px 0 0;
  }

  /* Guide content in popup */
  .guide-category-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #29adff;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }

  .guide-content {
    margin-bottom: 16px;
  }

  .guide-h3 {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #ffa300;
    letter-spacing: 1px;
    margin: 16px 0 8px;
    line-height: 1.5;
  }

  .guide-h4 {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #29adff;
    letter-spacing: 1px;
    margin: 14px 0 6px;
    line-height: 1.5;
  }

  .guide-p {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    line-height: 1.7;
    margin: 0 0 2px;
  }

  .guide-p :global(strong) {
    color: #ffa300;
    font-weight: 600;
  }

  .guide-p :global(.inline-code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #00e436;
    background: #00e43612;
    padding: 1px 4px;
    border-radius: 2px;
    border: 1px solid #00e43622;
  }

  .guide-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #00e436;
    background: #0a0a0a;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #2a2a4e;
    margin: 6px 0;
    overflow-x: auto;
    line-height: 1.4;
  }

  .guide-gap {
    height: 4px;
  }

  /* Index styles */
  .not-found {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #c2c3c7;
    margin: 0 0 12px 0;
  }

  .index-category {
    margin-bottom: 10px;
  }

  .index-category-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #ffa300;
    letter-spacing: 1px;
    display: block;
    margin-bottom: 4px;
  }

  .guide-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .guide-list-item {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #29adff;
    background: #29adff12;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid #29adff33;
  }

  .command-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .command-list-item {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #00e436;
    background: #00e43612;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid #00e43633;
  }

  .hint-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5f574f;
    margin: 6px 0 0;
  }

  .inline-code {
    color: #29adff;
    background: #29adff18;
    padding: 1px 4px;
    border-radius: 2px;
  }
</style>
