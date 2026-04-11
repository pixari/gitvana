/**
 * Generate the default OG image as PNG using node-canvas-like approach.
 * Since we can't use Canvas in Bun easily, we'll generate a simple PNG
 * by creating an SVG and converting it via resvg-js (Rust-based SVG renderer).
 */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&amp;family=JetBrains+Mono:wght@400;700&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#0a0a0a"/>

  <!-- Grid pattern -->
  <g opacity="0.06">
    ${Array.from({ length: 30 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="630" stroke="#00ff41" stroke-width="1"/>`).join('\n    ')}
    ${Array.from({ length: 16 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="1200" y2="${i * 40}" stroke="#00ff41" stroke-width="1"/>`).join('\n    ')}
  </g>

  <!-- Top border line -->
  <rect x="40" y="40" width="1120" height="550" rx="8" fill="none" stroke="#2a2a4e" stroke-width="2"/>

  <!-- Title: GITVANA -->
  <text x="600" y="140" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="64" fill="#ffa300" letter-spacing="8">GITVANA</text>

  <!-- Subtitle -->
  <text x="600" y="200" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="24" fill="#00ff41">Reach git enlightenment</text>

  <!-- Divider -->
  <line x1="300" y1="240" x2="900" y2="240" stroke="#2a2a4e" stroke-width="1"/>

  <!-- Description -->
  <text x="600" y="300" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="20" fill="#c2c3c7">A browser game that teaches git</text>
  <text x="600" y="335" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="20" fill="#c2c3c7">through real terminal commands</text>

  <!-- Features -->
  <text x="600" y="400" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="18" fill="#5f574f">38 levels  •  6 acts  •  Real git  •  Free to play</text>

  <!-- Monastery flavor -->
  <text x="600" y="450" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="16" fill="#5f574f88">Welcome to the Monastery of Version Control</text>

  <!-- Stars decoration -->
  <text x="460" y="500" font-family="monospace" font-size="36" fill="#ffa300">★ ★ ★ ★ ★</text>

  <!-- URL -->
  <text x="600" y="560" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="18" fill="#29adff">gitvana.pixari.dev</text>
</svg>`;

// Write SVG first
await Bun.write('public/og-default.svg', svg);

// Try to convert to PNG using resvg-js if available, otherwise use a different approach
try {
  const { Resvg } = await import('@aspect-build/resvg');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();
  await Bun.write('public/og-default.png', png);
  console.log('✅ Generated public/og-default.png');
} catch {
  // Fallback: try @resvg/resvg-js
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render().asPng();
    await Bun.write('public/og-default.png', png);
    console.log('✅ Generated public/og-default.png');
  } catch {
    console.log('⚠️  resvg not found, installing...');
    const proc = Bun.spawnSync(['bun', 'add', '-d', '@aspect-build/resvg']);
    if (proc.exitCode !== 0) {
      // Try the other package
      Bun.spawnSync(['bun', 'add', '-d', '@aspect-build/resvg']);
    }
    console.log('Please run this script again after installation.');
  }
}
