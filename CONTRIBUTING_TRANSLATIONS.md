# Contributing Translations

Gitvana supports multiple languages. Want to help translate? Here's how.

## How it works

All translatable content lives under `src/i18n/<locale>/`. English (`en/`) is the source of truth for the flat UI/stage/hint strings; every other locale overrides those strings, and a missing key falls back to English automatically. Level content and docs work a little differently — see below — but the principle is the same: **you never have to translate everything to contribute.** A locale with just `ui.json` filled in is already useful.

## Adding a new language

1. Fork the repo
2. Create a `src/i18n/<locale>/` folder (e.g. `src/i18n/pt-BR/`)
3. Add whichever of the files below you want to translate — you don't need all of them
4. Add your locale to the `availableLocales` array in `src/i18n/index.ts`
5. Open a PR

## File structure

```
src/i18n/
  en/
    ui.json              — buttons, labels, headers (~90 strings)
    stages.json           — progression stage names/descriptions (20 stages)
    hints.json             — in-game hint/help text (~30 strings)
  es/
    ui.json               — flat key → translated string, same keys as en/ui.json
    stages.json
    hints.json
    levels.json            — level narrative overrides, keyed by level id
    docs-commands.json     — command doc overrides, keyed by command name
    docs-guides.json       — guide overrides, keyed by guide id
```

There are two shapes of translation file — use whichever matches what you're translating.

### Flat files: `ui.json`, `stages.json`, `hints.json`

Same format as before: copy the English file, translate the values, keep the keys identical.

```json
{
  "start_level": "INICIAR NIVEL"
}
```

### Structured overrides: `levels.json`, `docs-commands.json`, `docs-guides.json`

These don't copy the English files — the English level/docs content stays where it already lives in the source code (`src/levels/act*/*.json`, `src/docs/commands/index.ts`, `src/docs/guides/index.ts`). Your locale file only contains the fields you're overriding, keyed by a stable id.

**`levels.json`** — one entry per level, keyed by the level's `id` field (e.g. `"act1-01-spark"`, found in the level's JSON file under `src/levels/`):

```json
{
  "act1-01-spark": {
    "title": "La Chispa",
    "subtitle": "Algo de la nada",
    "briefing": {
      "narrative": "...",
      "concept": "...",
      "objectives": ["Inicializa un repositorio git con 'git init'", "..."]
    },
    "tips": ["...", "..."],
    "hints": ["...", "...", "..."]
  }
}
```

- `objectives`, `tips`, and `hints` **must have the exact same number of entries, in the exact same order**, as the English source. `hints` is a plain array of translated strings, matched by position to the English level's `hints[].text` — the hint's trigger/command/penalty always come from the English source, only the text is overridden.
- If a translated array's length doesn't match the English source, the whole field silently falls back to English (better than mixing two languages in one list) — and a test (`tests/i18n-overrides.test.ts`) will fail the build if this happens, so keep the counts in sync as the English source evolves.
- Any field you omit (including the whole level) falls back to English.

**`docs-commands.json`** — keyed by command name, same index-matching rule for `options`/`examples`:

```json
{
  "init": {
    "description": "...",
    "tip": "...",
    "advanced": "...",
    "options": ["Descripción del primer flag", "..."],
    "examples": ["Explicación del primer ejemplo", "..."]
  }
}
```

`options`/`examples` are plain string arrays matched by position to `doc.options[].description` / `doc.examples[].explanation`.

**`docs-guides.json`** — keyed by guide id, just `title` and `content`:

```json
{
  "how-git-stores-data": {
    "title": "Cómo Funciona Git Realmente",
    "content": "## Encabezado\n\nTexto..."
  }
}
```

`content` is markdown-like and rendered by a hand-rolled parser (not a real markdown library) — see the warning below before touching it.

## Translation guidelines

- **Pick a register and stick to it for the whole language.** Languages with a formal/informal distinction (e.g. Spanish tú/usted, French tu/vous) should settle this once, in this file, rather than leaving it to drift level-by-level. Gitvana's Spanish translation uses **tú** (informal) throughout — it matches the game's playful, irreverent tone (the judgmental cat wouldn't say "usted"). If you're adding a language with a similar distinction, decide the register up front and note it here in your PR.
- **Git commands stay in English.** `git add`, `git commit`, `git push` — these are universal. Don't translate them.
- **Simulated terminal/git error output stays in English too.** Messages like `fatal: pathspec did not match any files` mimic real git/bash CLI output and are intentionally not translated — a learner's real terminal shows the same English text regardless of locale, and Gitvana's hint system matches against the exact English substrings of that output.
- **Keep the tone.** Gitvana has a Monkey Island-inspired humor with monastery monks and a judgmental cat. Try to keep the playfulness in your language.
- **Interpolation.** Strings with `{{variable}}` are dynamic — keep the variable names as-is. Example: `"ACT {{act}} — LEVEL {{order}}"` → `"ATO {{act}} — NIVEL {{order}}"`
- **Don't translate keys.** Only translate values. The key `"start_level"` stays `"start_level"` — the value `"START LEVEL"` becomes `"INICIAR NIVEL"`.
- **Markdown in `docs-guides.json` `content` and `docs-commands.json` `advanced` is positionally matched, not really parsed.** `##`/`###` headers, ` ``` ` fenced code blocks, inline `` `code` ``/`**bold**`, and leading list markers (`- `, `1.`) must stay in exactly the same position as the English source. In particular, `advanced` text only recognizes bold when it wraps an *entire line* — don't add spaces inside `**...**` or split a bolded line across two lines, or it won't render as bold anymore.
- **Level `objectives`/`tips`/`hints` and doc `options`/`examples` are matched by position, not by content.** Translate item-for-item in the same order as the English source; don't reorder, merge, split, add, or remove entries, or the translation will silently fall back to English for that whole list.

## What to translate first

Start with `ui.json` — it's the smallest file and covers all the buttons and labels players see constantly. `stages.json` and `hints.json` are next in size. Level narratives (`levels.json`) and docs (`docs-commands.json`, `docs-guides.json`) are bigger tasks — feel free to do them incrementally, level by level or command by command, across multiple PRs.

## Testing

```bash
bun run dev
```

Change your locale from the navbar picker (appears automatically once 2+ locales exist) or directly via `localStorage: gitvana-locale`. Before opening a PR, also run:

```bash
bun test
```

`tests/i18n-overrides.test.ts` checks that every translated array in your `levels.json`/`docs-commands.json`/`docs-guides.json` has the same length as its English source — a fast way to catch a translation that's drifted out of sync.

## Questions?

Open an issue or reach out. Thanks for helping make Gitvana accessible to more people.
