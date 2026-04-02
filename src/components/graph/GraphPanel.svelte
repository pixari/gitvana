<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gitEngine } from '../../lib/engine/git/GitEngine.js';
  import { eventBus } from '../../lib/engine/events/GameEventBus.js';
  import type { CommitInfo, BranchInfo } from '../../lib/engine/git/types.js';

  // --- Types ---
  interface GraphNode {
    oid: string;
    shortOid: string;
    message: string;
    parents: string[];
    lane: number;
    row: number;
    color: string;
    branchLabels: BranchLabel[];
    isHead: boolean;
    isMerge: boolean;
    isCurrentBranch: boolean;
  }

  interface BranchLabel {
    name: string;
    color: string;
    isCurrent: boolean;
  }

  interface GraphEdge {
    fromOid: string;
    toOid: string;
    color: string;
    isMergeEdge: boolean;
  }

  // --- Constants ---
  const NODE_RADIUS = 6;
  const NODE_RADIUS_CURRENT = 7;
  const V_SPACING = 48;
  const H_SPACING = 32;
  const PADDING_X = 60;
  const PADDING_Y = 32;
  const LABEL_OFFSET_X = 16;
  const MESSAGE_MAX_CHARS = 30;

  const BRANCH_COLORS = [
    '#00e436', // main - green
    '#29adff', // blue
    '#ff004d', // red
    '#ffa300', // orange
    '#ff77a8', // pink
    '#00e4ff', // cyan
  ];

  // --- Reactive state ---
  let initialized = $state(false);
  let nodes = $state<GraphNode[]>([]);
  let edges = $state<GraphEdge[]>([]);
  let svgWidth = $state(200);
  let svgHeight = $state(200);
  let isDetachedHead = $state(false);
  let currentBranchName = $state<string | null>(null);
  let unsub: (() => void) | null = null;

  // --- Animation tracking ---
  let previousOids = $state<Set<string>>(new Set());
  let previousEdgeKeys = $state<Set<string>>(new Set());
  let previousHeadOid = $state<string | null>(null);
  let newOids = $state<Set<string>>(new Set());
  let newEdgeKeys = $state<Set<string>>(new Set());
  let headMoved = $state(false);
  let graphFlash = $state(false);

  // --- Graph building ---
  function buildGraph(commits: CommitInfo[], branches: BranchInfo[], headOid: string | null, currentBranch: string | null) {
    if (commits.length === 0) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };

    // Build branch-to-color map; main/master always lane 0
    const branchOrder: string[] = [];
    const branchColorMap = new Map<string, string>();

    // Sort: current branch first, then main/master, then alphabetical
    const sorted = [...branches].sort((a, b) => {
      if (a.name === 'main' || a.name === 'master') return -1;
      if (b.name === 'main' || b.name === 'master') return 1;
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const b of sorted) {
      if (!branchOrder.includes(b.name)) {
        branchOrder.push(b.name);
        branchColorMap.set(b.name, BRANCH_COLORS[(branchOrder.length - 1) % BRANCH_COLORS.length]);
      }
    }

    // Map tip oid -> branch info
    const tipToBranches = new Map<string, BranchLabel[]>();
    for (const b of branches) {
      const existing = tipToBranches.get(b.oid) || [];
      existing.push({
        name: b.name,
        color: branchColorMap.get(b.name) || BRANCH_COLORS[0],
        isCurrent: b.isCurrent,
      });
      tipToBranches.set(b.oid, existing);
    }

    // Assign each commit to the "best" branch
    const commitBranch = new Map<string, string>();
    const commitMap = new Map<string, CommitInfo>();
    for (const c of commits) {
      commitMap.set(c.oid, c);
    }

    for (const b of sorted) {
      const branchTip = b.oid;
      const stack = [branchTip];
      const visited = new Set<string>();
      while (stack.length > 0) {
        const oid = stack.pop()!;
        if (visited.has(oid)) continue;
        visited.add(oid);
        if (commitMap.has(oid) && !commitBranch.has(oid)) {
          commitBranch.set(oid, b.name);
        }
        const commit = commitMap.get(oid);
        if (commit) {
          for (const p of commit.parents) {
            stack.push(p);
          }
        }
      }
    }

    // Topological sort (newest first via timestamp)
    const sortedCommits = [...commits].sort((a, b) => b.author.timestamp - a.author.timestamp);

    // Assign lane per branch
    const branchLane = new Map<string, number>();
    let nextLane = 0;
    for (const bName of branchOrder) {
      branchLane.set(bName, nextLane++);
    }

    // Build nodes
    const graphNodes: GraphNode[] = [];
    const oidToNode = new Map<string, GraphNode>();

    for (let i = 0; i < sortedCommits.length; i++) {
      const c = sortedCommits[i];
      const branch = commitBranch.get(c.oid) || branchOrder[0] || 'main';
      const lane = branchLane.get(branch) ?? 0;
      const color = branchColorMap.get(branch) || BRANCH_COLORS[0];
      const branchLabels = tipToBranches.get(c.oid) || [];
      const isOnCurrentBranch = branch === currentBranch;

      // Truncate message
      const firstLine = c.message.split('\n')[0];
      const message = firstLine.length > MESSAGE_MAX_CHARS
        ? firstLine.slice(0, MESSAGE_MAX_CHARS) + '...'
        : firstLine;

      const node: GraphNode = {
        oid: c.oid,
        shortOid: c.oid.slice(0, 7),
        message,
        parents: c.parents,
        lane,
        row: i,
        color,
        branchLabels,
        isHead: c.oid === headOid,
        isMerge: c.parents.length >= 2,
        isCurrentBranch: isOnCurrentBranch,
      };

      graphNodes.push(node);
      oidToNode.set(c.oid, node);
    }

    // Build edges
    const graphEdges: GraphEdge[] = [];
    for (const node of graphNodes) {
      for (let pi = 0; pi < node.parents.length; pi++) {
        const parentOid = node.parents[pi];
        const parentNode = oidToNode.get(parentOid);
        if (parentNode) {
          // Second+ parent = merge edge
          graphEdges.push({
            fromOid: node.oid,
            toOid: parentOid,
            color: pi === 0 ? node.color : parentNode.color,
            isMergeEdge: pi > 0,
          });
        }
      }
    }

    return { nodes: graphNodes, edges: graphEdges };
  }

  function nodeX(lane: number): number {
    return PADDING_X + lane * H_SPACING;
  }

  function nodeY(row: number): number {
    return PADDING_Y + row * V_SPACING;
  }

  function edgePath(fromNode: GraphNode, toNode: GraphNode): string {
    const x1 = nodeX(fromNode.lane);
    const y1 = nodeY(fromNode.row);
    const x2 = nodeX(toNode.lane);
    const y2 = nodeY(toNode.row);

    if (x1 === x2) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    // Curved path for cross-lane edges
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  // --- Data fetching ---
  async function refreshGraph() {
    try {
      await gitEngine.fs.promises.stat(`${gitEngine.dir}/.git`);
    } catch {
      initialized = false;
      nodes = [];
      edges = [];
      return;
    }

    initialized = true;

    const [allCommits, allBranches, headOid, curBranch] = await Promise.all([
      gitEngine.getAllCommits(20),
      gitEngine.getBranches(),
      gitEngine.getHeadOid(),
      gitEngine.getCurrentBranch(),
    ]);

    currentBranchName = curBranch;
    isDetachedHead = curBranch === null && headOid !== null;

    const result = buildGraph(allCommits, allBranches, headOid, curBranch);

    // --- Detect new nodes and edges for animation ---
    const currentOids = new Set(result.nodes.map(n => n.oid));
    const currentEdgeKeySet = new Set(result.edges.map(e => `${e.fromOid}->${e.toOid}`));

    if (previousOids.size > 0) {
      newOids = new Set([...currentOids].filter(oid => !previousOids.has(oid)));
      newEdgeKeys = new Set([...currentEdgeKeySet].filter(k => !previousEdgeKeys.has(k)));
      headMoved = previousHeadOid !== null && previousHeadOid !== headOid;

      // Flash the panel border on any state change
      graphFlash = true;
      setTimeout(() => { graphFlash = false; }, 200);
    } else {
      newOids = new Set();
      newEdgeKeys = new Set();
      headMoved = false;
    }

    previousOids = currentOids;
    previousEdgeKeys = currentEdgeKeySet;
    previousHeadOid = headOid;

    nodes = result.nodes;
    edges = result.edges;

    // Compute SVG dimensions
    const maxLane = nodes.reduce((max, n) => Math.max(max, n.lane), 0);
    const maxRow = nodes.reduce((max, n) => Math.max(max, n.row), 0);
    svgWidth = Math.max(200, PADDING_X * 2 + maxLane * H_SPACING + 340);
    svgHeight = Math.max(100, PADDING_Y * 2 + maxRow * V_SPACING);
  }

  // --- Build oid lookup for edge rendering ---
  const oidToNode = $derived(new Map(nodes.map(n => [n.oid, n])));

  onMount(() => {
    unsub = eventBus.on('state:changed', refreshGraph);
    refreshGraph();
  });

  onDestroy(() => {
    unsub?.();
  });
</script>

<div class="graph-container" class:graph-flash={graphFlash}>
  <div class="panel-header">
    <span class="panel-title">COMMIT GRAPH</span>
    {#if isDetachedHead}
      <span class="detached-badge">DETACHED HEAD</span>
    {/if}
  </div>

  {#if !initialized}
    <div class="empty-state">
      <svg class="empty-icon-svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="4" x2="16" y2="28" stroke="#5f574f" stroke-width="2" />
        <circle cx="16" cy="8" r="3" fill="none" stroke="#5f574f" stroke-width="2" />
        <circle cx="16" cy="20" r="3" fill="none" stroke="#5f574f" stroke-width="2" />
        <line x1="16" y1="23" x2="24" y2="28" stroke="#5f574f" stroke-width="2" />
        <circle cx="24" cy="28" r="2" fill="none" stroke="#5f574f" stroke-width="2" />
      </svg>
      <span class="empty-text">No commits yet</span>
      <span class="empty-hint">Make your first <code>git commit</code></span>
    </div>
  {:else if nodes.length === 0}
    <div class="empty-state">
      {#if isDetachedHead}
        <span class="empty-text detached-text">Detached HEAD state</span>
        <span class="empty-hint">No reachable commits from current HEAD</span>
      {:else}
        <span class="empty-text">No commits yet</span>
        <span class="empty-hint">Make your first <code>git commit</code></span>
      {/if}
    </div>
  {:else}
    <div class="graph-scroll">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox="0 0 {svgWidth} {svgHeight}"
        class="graph-svg"
      >
        <!-- Lane lines (subtle background guides) -->
        {#each nodes as node}
          {#if node.row === 0}
            <line
              x1={nodeX(node.lane)}
              y1={0}
              x2={nodeX(node.lane)}
              y2={svgHeight}
              stroke={node.color}
              stroke-width="1"
              stroke-opacity="0.06"
            />
          {/if}
        {/each}

        <!-- Edges -->
        {#each edges as edge}
          {@const fromNode = oidToNode.get(edge.fromOid)}
          {@const toNode = oidToNode.get(edge.toOid)}
          {#if fromNode && toNode}
            {@const edgeKey = `${edge.fromOid}->${edge.toOid}`}
            {@const isNewEdge = newEdgeKeys.has(edgeKey)}
            <path
              d={edgePath(fromNode, toNode)}
              fill="none"
              stroke={edge.color}
              stroke-width={edge.isMergeEdge ? 1.5 : 2}
              stroke-opacity={edge.isMergeEdge ? 0.35 : 0.5}
              stroke-dasharray={edge.isMergeEdge ? '4 3' : isNewEdge ? '100' : 'none'}
              class="graph-edge"
              class:new-edge={isNewEdge}
            />
          {/if}
        {/each}

        <!-- Nodes -->
        {#each nodes as node}
          {@const cx = nodeX(node.lane)}
          {@const cy = nodeY(node.row)}
          {@const r = node.isCurrentBranch ? NODE_RADIUS_CURRENT : NODE_RADIUS}
          {@const isNewNode = newOids.has(node.oid)}

          <g class="node-group" class:new-node={isNewNode} style="--node-cx: {cx}px; --node-cy: {cy}px;">

          <!-- HEAD pulsing glow -->
          {#if node.isHead}
            <circle
              cx={cx}
              cy={cy}
              r={r + 6}
              fill="none"
              stroke={isDetachedHead ? '#ffa300' : '#fff'}
              stroke-width="1.5"
              class="head-glow"
            />
            <circle
              cx={cx}
              cy={cy}
              r={r + 3}
              fill={node.color}
              fill-opacity="0.08"
              stroke="none"
              class="head-glow-inner"
            />
          {/if}

          <!-- Commit node -->
          {#if node.isMerge}
            <!-- Merge commit: diamond shape -->
            <g transform="translate({cx}, {cy}) rotate(45)">
              <rect
                x={-r + 1}
                y={-r + 1}
                width={(r - 1) * 2}
                height={(r - 1) * 2}
                fill={node.color}
                rx="1"
                class="commit-node merge-node"
              />
              <rect
                x={-r + 2.5}
                y={-r + 2.5}
                width={(r - 2.5) * 2}
                height={(r - 2.5) * 2}
                fill="none"
                stroke="#0a0a0a"
                stroke-width="1"
                rx="0"
              />
            </g>
          {:else}
            <!-- Normal commit: square -->
            <rect
              x={cx - r}
              y={cy - r}
              width={r * 2}
              height={r * 2}
              fill={node.color}
              fill-opacity={node.isCurrentBranch ? 1 : 0.7}
              rx="1"
              class="commit-node"
              class:current-branch-node={node.isCurrentBranch}
            />
          {/if}

          <!-- HEAD label (left side) -->
          {#if node.isHead}
            <g class="head-label-group" class:head-moved={headMoved}>
              {#if isDetachedHead}
                <!-- Detached HEAD badge -->
                <rect
                  x={cx - LABEL_OFFSET_X - 88}
                  y={cy - 7}
                  width={84}
                  height={14}
                  rx="2"
                  fill="#ffa300"
                  fill-opacity="0.15"
                  stroke="#ffa300"
                  stroke-width="1"
                  stroke-opacity="0.6"
                />
                <text
                  x={cx - LABEL_OFFSET_X - 46}
                  y={cy + 1}
                  class="head-label detached"
                  dominant-baseline="middle"
                  text-anchor="middle"
                >
                  HEAD (detached)
                </text>
              {:else}
                <text
                  x={cx - LABEL_OFFSET_X - 2}
                  y={cy + 1}
                  class="head-label"
                  dominant-baseline="middle"
                  text-anchor="end"
                >
                  HEAD
                </text>
                <text
                  x={cx - LABEL_OFFSET_X + 1}
                  y={cy + 1}
                  class="head-arrow"
                  dominant-baseline="middle"
                  text-anchor="start"
                >
                  &#x25B6;
                </text>
              {/if}
            </g>
          {/if}

          <!-- SHA label -->
          <text
            x={cx + LABEL_OFFSET_X}
            y={cy - 1}
            class="sha-label"
            dominant-baseline="middle"
          >
            {node.shortOid}
          </text>

          <!-- Commit message (truncated, dimmer) -->
          <text
            x={cx + LABEL_OFFSET_X + 62}
            y={cy - 1}
            class="message-label"
            dominant-baseline="middle"
          >
            {node.message}
          </text>

          <!-- Branch labels (right of message) -->
          {#each node.branchLabels as label, i}
            {@const labelX = cx + LABEL_OFFSET_X + 62 + node.message.length * 5.5 + 12 + i * 8}
            {@const tagWidth = label.name.length * 6.5 + 12}
            <g class="branch-label-group">
              <rect
                x={labelX}
                y={cy - 8}
                width={tagWidth}
                height={16}
                rx="2"
                fill={label.color}
                fill-opacity={label.isCurrent ? 0.25 : 0.12}
                stroke={label.color}
                stroke-width={label.isCurrent ? 1.5 : 1}
                stroke-opacity={label.isCurrent ? 0.8 : 0.4}
              />
              <text
                x={labelX + 6}
                y={cy + 1}
                class="branch-label"
                class:branch-label-current={label.isCurrent}
                fill={label.color}
                dominant-baseline="middle"
              >
                {label.name}
              </text>
            </g>
          {/each}
          </g>
        {/each}
      </svg>
    </div>
  {/if}
</div>

<style>
  .graph-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a0a;
    border: 1px solid #2a2a4e;
    border-radius: 4px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a4e;
    flex-shrink: 0;
  }

  .panel-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #5f574f;
    letter-spacing: 2px;
  }

  .detached-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #ffa300;
    background: rgba(255, 163, 0, 0.12);
    border: 1px solid rgba(255, 163, 0, 0.4);
    padding: 2px 6px;
    border-radius: 2px;
    letter-spacing: 1px;
    animation: warn-pulse 2s ease-in-out infinite;
  }

  @keyframes warn-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 8px;
    padding: 24px;
  }

  .empty-icon-svg {
    opacity: 0.6;
  }

  .empty-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #5f574f;
  }

  .detached-text {
    color: #ffa300;
  }

  .empty-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #5f574f88;
  }

  .empty-hint code {
    color: #00e436;
    background: #00e43622;
    padding: 1px 4px;
    border-radius: 2px;
  }

  .graph-scroll {
    flex: 1;
    overflow: auto;
    padding: 4px;
  }

  .graph-svg {
    display: block;
  }

  /* --- Flash effect on state change --- */
  .graph-flash {
    border-color: #4a4a7e;
    transition: border-color 0.2s ease;
  }

  /* --- New node appear animation --- */
  .new-node {
    animation: node-appear 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transform-box: fill-box;
    transform-origin: center;
  }

  @keyframes node-appear {
    from { opacity: 0; transform: scale(0); }
    to { opacity: 1; transform: scale(1); }
  }

  /* --- New edge draw animation --- */
  .new-edge {
    animation: edge-draw 0.5s ease-out;
  }

  @keyframes edge-draw {
    from { stroke-dashoffset: 100; }
    to { stroke-dashoffset: 0; }
  }

  /* --- HEAD movement animation --- */
  .head-moved {
    animation: head-slide 0.3s ease;
  }

  @keyframes head-slide {
    from { opacity: 0.4; }
    to { opacity: 1; }
  }

  .graph-edge {
    transition: d 0.3s ease;
  }

  .commit-node {
    transition: all 0.2s ease;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.1));
  }

  .commit-node:hover {
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
  }

  .current-branch-node {
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.2));
  }

  .merge-node {
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.15));
  }

  .head-glow {
    animation: glow-pulse 2s ease-in-out infinite;
  }

  .head-glow-inner {
    animation: glow-pulse-inner 2s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { stroke-opacity: 0.2; }
    50% { stroke-opacity: 0.7; }
  }

  @keyframes glow-pulse-inner {
    0%, 100% { fill-opacity: 0.05; }
    50% { fill-opacity: 0.15; }
  }

  .sha-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    fill: #8b8b8b;
    pointer-events: none;
    user-select: none;
  }

  .message-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    fill: #5f574f;
    pointer-events: none;
    user-select: none;
  }

  .branch-label-group {
    transition: transform 0.3s ease;
  }

  .branch-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    pointer-events: none;
    user-select: none;
  }

  .branch-label-current {
    font-weight: bold;
    filter: brightness(1.2);
  }

  .head-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    fill: #ffa300;
    pointer-events: none;
    user-select: none;
  }

  .head-label.detached {
    font-size: 5px;
    fill: #ffa300;
  }

  .head-arrow {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    fill: #ffa300;
    pointer-events: none;
    user-select: none;
  }
</style>
