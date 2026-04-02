<script lang="ts">
  import Navbar from '../shared/Navbar.svelte';
  import { onMount } from 'svelte';

  interface LevelStat {
    level_id: string;
    starts: number;
    completions: number;
    restarts: number;
  }

  interface TopCommand {
    cmd: string;
    count: number;
  }

  interface StatsData {
    totalSessions: number;
    totalCompletions: number;
    totalCommands: number;
    recentActivity: number;
    levelStats: LevelStat[];
    topCommands: TopCommand[];
  }

  let loading = $state(true);
  let error = $state<string | null>(null);
  let stats = $state<StatsData | null>(null);

  const actNames: Record<string, string> = {
    'act1': 'Act I: Basics',
    'act2': 'Act II: Branching',
    'act3': 'Act III: Conflicts',
    'act4': 'Act IV: Rewriting',
    'act5': 'Act V: Recovery',
    'act6': 'Act VI: Collaboration',
  };

  function getActKey(levelId: string): string {
    const match = levelId.match(/^(act\d+)/);
    return match ? match[1] : 'unknown';
  }

  function getActName(actKey: string): string {
    return actNames[actKey] ?? actKey;
  }

  function formatLevelName(levelId: string): string {
    // "act1-01-spark" -> "01 - The Spark" style, but we just clean up the id
    const parts = levelId.replace(/^act\d+-/, '').split('-');
    const num = parts[0];
    const name = parts.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${num}. ${name}`;
  }

  function completionRate(starts: number, completions: number): number {
    if (starts === 0) return 0;
    return Math.round((completions / starts) * 100);
  }

  function rateColor(rate: number): string {
    if (rate >= 80) return '#00e436';
    if (rate >= 40) return '#ffa300';
    return '#ff004d';
  }

  // Group levels by act
  function groupByAct(levels: LevelStat[]): Record<string, LevelStat[]> {
    const groups: Record<string, LevelStat[]> = {};
    for (const l of levels) {
      const act = getActKey(l.level_id);
      if (!groups[act]) groups[act] = [];
      groups[act].push(l);
    }
    return groups;
  }

  // Top 5 hardest levels
  function hardestLevels(levels: LevelStat[]): (LevelStat & { rate: number })[] {
    return levels
      .filter(l => l.starts >= 1)
      .map(l => ({ ...l, rate: completionRate(l.starts, l.completions) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/stats/public');
      if (!res.ok) {
        error = 'The monastery records are sealed. Check back later.';
        return;
      }
      const data = await res.json();
      stats = data;
      if (!data.levelStats || data.levelStats.length === 0) {
        stats = null;
      }
    } catch {
      error = 'The monastery records are sealed. Check back later.';
    } finally {
      loading = false;
    }
  });
</script>

<div class="stats-page">
  <Navbar currentPage="stats" />

  <div class="stats-content">
    <header class="stats-header">
      <h1 class="stats-title">MONASTERY RECORDS</h1>
      <p class="stats-subtitle">Anonymous telemetry from all monks</p>
    </header>

    {#if loading}
      <div class="loading">
        <span class="loading-dots">Loading<span class="dot1">.</span><span class="dot2">.</span><span class="dot3">.</span></span>
      </div>
    {:else if error}
      <div class="error-message">
        <p>{error}</p>
      </div>
    {:else if !stats}
      <div class="empty-message">
        <p>No data yet. The monastery awaits its first monks.</p>
      </div>
    {:else}
      <!-- Section 1: Big Numbers -->
      <section class="big-numbers">
        <div class="stat-card" style="border-top-color: #ffa300">
          <span class="stat-number">{stats.totalSessions.toLocaleString()}</span>
          <span class="stat-label">SESSIONS</span>
        </div>
        <div class="stat-card" style="border-top-color: #00e436">
          <span class="stat-number">{stats.totalCompletions.toLocaleString()}</span>
          <span class="stat-label">COMPLETIONS</span>
        </div>
        <div class="stat-card" style="border-top-color: #29adff">
          <span class="stat-number">{stats.totalSessions > 0 ? Math.round((stats.totalCompletions / stats.totalSessions) * 100) : 0}%</span>
          <span class="stat-label">COMPLETION RATE</span>
        </div>
        <div class="stat-card" style="border-top-color: #ff77a8">
          <span class="stat-number">{(stats.totalCommands ?? 0).toLocaleString()}</span>
          <span class="stat-label">COMMANDS RUN</span>
        </div>
      </section>

      {#if stats.recentActivity !== undefined}
        <p class="recent-activity">{stats.recentActivity} events in the last 24 hours</p>
      {/if}

      <!-- Section 2: Level Completion Funnel -->
      <section class="section">
        <h2 class="section-title">LEVEL COMPLETION FUNNEL</h2>
        {#each Object.entries(groupByAct(stats.levelStats)) as [actKey, levels]}
          <h3 class="act-header">{getActName(actKey)}</h3>
          <div class="level-bars">
            {#each levels as level}
              {@const rate = completionRate(level.starts, level.completions)}
              {@const maxStarts = Math.max(...stats!.levelStats.map(l => l.starts), 1)}
              <div class="level-row">
                <span class="level-name">{formatLevelName(level.level_id)}</span>
                <div class="bar-container">
                  <div class="bar bar-starts" style="width: {(level.starts / maxStarts) * 100}%"></div>
                  <div class="bar bar-completions" style="width: {(level.completions / maxStarts) * 100}%"></div>
                  {#if level.restarts > 0}
                    <div class="bar bar-restarts" style="width: {(level.restarts / maxStarts) * 100}%"></div>
                  {/if}
                </div>
                <span class="level-rate" style="color: {rateColor(rate)}">{rate}%</span>
              </div>
            {/each}
          </div>
        {/each}
        <div class="legend">
          <span class="legend-item"><span class="legend-swatch" style="background: #5f574f"></span>Starts</span>
          <span class="legend-item"><span class="legend-swatch" style="background: #00e436"></span>Completions</span>
          <span class="legend-item"><span class="legend-swatch" style="background: #ffa300"></span>Restarts</span>
        </div>
      </section>

      <!-- Section 3: Hardest Levels -->
      <section class="section">
        <h2 class="section-title">HARDEST LEVELS</h2>
        <p class="section-desc">Levels that need the most balancing</p>
        <div class="hardest-list">
          {#each hardestLevels(stats.levelStats) as level, i}
            <div class="hardest-row">
              <span class="hardest-rank">#{i + 1}</span>
              <span class="hardest-name">{formatLevelName(level.level_id)}</span>
              <span class="hardest-rate" style="color: {rateColor(level.rate)}">{level.rate}%</span>
              <span class="hardest-restarts" title="Restarts">{level.restarts} ↻</span>
            </div>
          {/each}
          {#if hardestLevels(stats.levelStats).length === 0}
            <p class="empty-note">Not enough data yet.</p>
          {/if}
        </div>
      </section>

      <!-- Section 4: Most Popular Commands -->
      {#if stats.topCommands && stats.topCommands.length > 0}
        <section class="section">
          <h2 class="section-title">MOST POPULAR COMMANDS</h2>
          <div class="command-list">
            {#each stats.topCommands as cmd}
              {@const maxCmd = Math.max(...stats!.topCommands.map(c => c.count), 1)}
              <div class="command-row">
                <span class="command-name">{cmd.cmd ?? 'unknown'}</span>
                <div class="command-bar-container">
                  <div class="command-bar" style="width: {(cmd.count / maxCmd) * 100}%"></div>
                </div>
                <span class="command-count">{cmd.count}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <footer class="stats-footer">
        <p>&copy; 2026 Raffaele Pizzari</p>
      </footer>
    {/if}
  </div>
</div>

<style>
  .stats-page {
    position: fixed;
    inset: 0;
    background: #0a0a0a;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 200;
    color: #c2c3c7;
    font-family: 'JetBrains Mono', monospace;
  }

  .stats-content {
    max-width: 900px;
    margin: 0 auto;
    padding: 44px 24px 60px;
  }

  .stats-header {
    text-align: center;
    padding: 60px 0 48px;
  }

  .stats-title {
    font-family: 'Press Start 2P', monospace;
    font-size: clamp(14px, 3.5vw, 24px);
    color: #ffa300;
    margin: 0 0 16px;
    letter-spacing: 4px;
    text-shadow: 0 0 20px #ffa30044;
  }

  .stats-subtitle {
    font-size: 13px;
    color: #5f574f;
    margin: 0;
  }

  /* Loading animation */
  .loading {
    text-align: center;
    padding: 80px 0;
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #5f574f;
  }

  .loading-dots .dot1 { animation: blink 1.4s infinite 0s; }
  .loading-dots .dot2 { animation: blink 1.4s infinite 0.2s; }
  .loading-dots .dot3 { animation: blink 1.4s infinite 0.4s; }

  @keyframes blink {
    0%, 20% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }

  .error-message, .empty-message {
    text-align: center;
    padding: 80px 0;
    font-size: 14px;
    color: #5f574f;
    line-height: 1.8;
  }

  .recent-activity {
    text-align: center;
    font-size: 11px;
    color: #5f574f;
    margin: -20px 0 32px;
  }

  /* Big Numbers */
  .big-numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 48px;
  }

  .stat-card {
    background: #111118;
    border: 1px solid #1a1a2e;
    border-top: 3px solid;
    border-radius: 4px;
    padding: 24px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(24px, 5vw, 36px);
    font-weight: 700;
    color: #fff;
    letter-spacing: 1px;
  }

  .stat-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #5f574f;
    letter-spacing: 1px;
  }

  /* Sections */
  .section {
    margin-bottom: 48px;
  }

  .section-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    color: #ffa300;
    margin: 0 0 8px;
    letter-spacing: 2px;
  }

  .section-desc {
    font-size: 12px;
    color: #5f574f;
    margin: 0 0 20px;
  }

  /* Level Bars */
  .act-header {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #83769c;
    margin: 24px 0 12px;
    letter-spacing: 1px;
  }

  .level-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .level-row {
    display: grid;
    grid-template-columns: 140px 1fr 50px;
    align-items: center;
    gap: 12px;
  }

  .level-name {
    font-size: 11px;
    color: #8a8580;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-container {
    position: relative;
    height: 16px;
    background: #111118;
    border-radius: 2px;
    overflow: hidden;
  }

  .bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .bar-starts {
    background: #5f574f44;
    z-index: 1;
  }

  .bar-completions {
    background: #00e436aa;
    z-index: 2;
  }

  .bar-restarts {
    background: #ffa30066;
    z-index: 3;
    /* Offset restarts to show after completions */
  }

  .level-rate {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    text-align: right;
  }

  .legend {
    display: flex;
    gap: 20px;
    margin-top: 16px;
    font-size: 10px;
    color: #5f574f;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-swatch {
    display: inline-block;
    width: 12px;
    height: 8px;
    border-radius: 1px;
  }

  /* Hardest Levels */
  .hardest-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hardest-row {
    display: grid;
    grid-template-columns: 30px 1fr 50px 60px;
    align-items: center;
    gap: 8px;
    background: #111118;
    border: 1px solid #1a1a2e;
    border-radius: 4px;
    padding: 10px 14px;
  }

  .hardest-rank {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #ff004d;
  }

  .hardest-name {
    font-size: 12px;
    color: #c2c3c7;
  }

  .hardest-rate {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }

  .hardest-restarts {
    font-size: 11px;
    color: #ffa300;
    text-align: right;
  }

  .empty-note {
    font-size: 12px;
    color: #5f574f;
    margin: 0;
  }

  /* Commands */
  .command-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .command-row {
    display: grid;
    grid-template-columns: 120px 1fr 50px;
    align-items: center;
    gap: 12px;
  }

  .command-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #29adff;
  }

  .command-bar-container {
    height: 12px;
    background: #111118;
    border-radius: 2px;
    overflow: hidden;
  }

  .command-bar {
    height: 100%;
    background: #29adff66;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .command-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #8a8580;
    text-align: right;
  }

  .stats-footer {
    margin-top: 80px;
    padding: 24px 0;
    text-align: center;
    border-top: 1px solid #1a1a2e22;
  }

  .stats-footer p {
    font-size: 12px;
    color: #5f574f55;
    margin: 0;
  }

  @media (max-width: 600px) {
    .big-numbers {
      grid-template-columns: repeat(2, 1fr);
    }

    .level-row {
      grid-template-columns: 100px 1fr 40px;
      gap: 8px;
    }

    .level-name {
      font-size: 9px;
    }

    .hardest-row {
      grid-template-columns: 24px 1fr 40px 50px;
      padding: 8px 10px;
    }

    .command-row {
      grid-template-columns: 90px 1fr 40px;
    }
  }
</style>
