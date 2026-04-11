<p align="center">
  <img src="public/screenshot.png" alt="Gitvana — Reach git enlightenment" width="100%" />
</p>

<h1 align="center">Gitvana</h1>

<p align="center">
  <code>⚠️ ALPHA — Work in progress. Bugs, rough edges, and the occasional angry monk ahead. ⚠️</code>
</p>

<p align="center">
  <strong>Learn git by playing.</strong> A retro browser game where you type real git commands in a real terminal to solve puzzles at the Monastery of Version Control.
</p>

<p align="center">
  🎮 <a href="https://gitvana.pixari.dev"><strong>Play now — gitvana.pixari.dev</strong></a>
</p>

---

## What is this?

Gitvana is a browser-based game that teaches git through 35 progressively harder levels. No slides, no videos — you type actual git commands and watch the results in real time.

You play as a monk climbing toward enlightenment. The Head Monk assigns you tasks. A cat judges your commits.

## Features

**Real git, in your browser**
- Powered by isomorphic-git + lightning-fs — a complete git engine running client-side
- Every command you type (`git add`, `git rebase`, `git bisect`...) executes for real
- 21 git commands implemented: init, add, commit, status, log, diff, branch, checkout, merge, reset, rm, tag, cherry-pick, show, revert, stash, reflog, rebase, blame, bisect, update-ref

**38 levels across 6 acts**
- Act 1: *Awakening* — The basics
- Act 2: *The Middle Path* — Tags, cherry-pick, revert, stash
- Act 3: *Rewriting Reality* — Rebase, amend, squash, secret purging
- Act 4: *The Safety Net* — Reflog, blame, bisect, recovery
- Act 5: *Advanced Techniques* — Surgical staging, dependency chains
- Act 6: *Gitvana* — The final trial

**Everything you need to learn**
- Live file state panel (working dir / staging / repo)
- Commit graph visualization
- Built-in docs with 9 conceptual guides + 21 command references
- Tab completion, command history, conflict editor
- Monkey Island-style humor throughout

**Zero setup**
- Runs entirely in the browser
- No backend, no database, no sign-up
- Works offline (PWA)
- Progress saved to localStorage

## Tech stack

- [Svelte 5](https://svelte.dev) — UI framework
- [isomorphic-git](https://isomorphic-git.org) — Git engine in JavaScript
- [lightning-fs](https://github.com/isomorphic-git/lightning-fs) — In-memory filesystem
- [xterm.js](https://xtermjs.org) — Terminal emulator
- [Vite](https://vitejs.dev) — Build tool
- [UnoCSS](https://unocss.dev) — Atomic CSS
- Web Audio API — Retro sound effects
- [PixelLab](https://pixellab.ai) — AI-generated pixel art

## Run locally

```bash
git clone https://github.com/pixari/gitvana.git
cd gitvana
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Run tests

```bash
bun test
```

All 38 levels have automated tests that verify the solution works.

## Project structure

```
src/
├── components/          # Svelte UI components
│   ├── terminal/        # xterm.js terminal
│   ├── file-state/      # Working dir / staging / repo panels
│   ├── graph/           # Commit graph visualization
│   ├── level/           # Level intro, complete, objectives
│   ├── editor/          # File editor, conflict resolver
│   ├── docs/            # Docs page
│   ├── landing/         # Landing page
│   ├── progression/     # Mountain path, monk evolution
│   └── shared/          # DevPanel, PixelArt, ShareCard
├── lib/
│   ├── engine/
│   │   ├── git/         # GitEngine + 22 command implementations
│   │   ├── shell/       # ShellBridge, builtins, tab completion
│   │   ├── level/       # LevelLoader, LevelValidator
│   │   ├── progression/ # Stages, persistence
│   │   └── events/      # GameEventBus
│   └── audio/           # Web Audio chiptune sounds
├── levels/              # 35 level JSON definitions
│   ├── act1-basics/
│   ├── act2-branching/
│   ├── act3-conflicts/
│   ├── act4-rewriting/
│   ├── act5-recovery/
│   └── act6-collaboration/
├── docs/                # Command docs + conceptual guides
└── main.ts              # Entry point
```

## Found a bug?

```
╔══════════════════════════════════════════╗
║  The monks welcome bug reports.          ║
║  Even the cat files issues sometimes.    ║
╚══════════════════════════════════════════╝
```

**[→ Report an issue on GitHub](https://github.com/pixari/gitvana/issues/new)**

Include:
- Which level you were on
- What you typed
- What happened vs what you expected
- Screenshot if possible

## Contributing

Gitvana is in **alpha** — contributions are welcome!

**Quick wins:**
- Fix a level validator (most bugs are in the JSON files in `src/levels/`)
- Add a new level (copy an existing JSON, change the content)
- Improve docs (`src/docs/commands/index.ts` and `src/docs/guides/index.ts`)
- Fix a git command edge case (`src/lib/engine/git/commands/`)

**Getting started:**
```bash
git clone https://github.com/pixari/gitvana.git
cd gitvana
bun install
bun run dev          # Vite dev server on :5173
bun run dev:server   # API server on :3000 (optional, for telemetry)
bun test             # Run all 35 level tests
```

**Before submitting a PR:**
- Run `bun test` — all 35 level tests must pass
- Run `bun run build` — no build errors
- If you changed a level, update the solution in `src/lib/engine/shell/solutions.ts`

## Credits

Built by [Raffaele Pizzari](https://pixari.dev) ([@pixari](https://github.com/pixari))

Pixel art generated with [PixelLab](https://pixellab.ai)

If this helped you learn git, consider [buying me a coffee](https://buymeacoffee.com/pixari) ☕

## License

MIT
