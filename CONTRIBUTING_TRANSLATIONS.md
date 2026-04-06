# Contributing Translations

Gitvana supports multiple languages. Want to help translate? Here's how.

## How it works

All translatable strings live in `src/i18n/<locale>/` as JSON files. English (`en/`) is the source of truth — every other locale overrides English strings. Missing keys fall back to English automatically.

## Adding a new language

1. Fork the repo
2. Copy the `src/i18n/en/` folder to your locale code (e.g. `src/i18n/pt-BR/`)
3. Translate the strings in the JSON files
4. Add your locale to the `availableLocales` array in `src/i18n/index.ts`
5. Open a PR

## File structure

```
src/i18n/
  en/
    ui.json       — buttons, labels, headers (~60 strings)
  pt-BR/
    ui.json       — your translations
```

## Translation guidelines

- **Git commands stay in English.** `git add`, `git commit`, `git push` — these are universal. Don't translate them.
- **Keep the tone.** Gitvana has a Monkey Island-inspired humor with monastery monks and a judgmental cat. Try to keep the playfulness in your language.
- **Interpolation.** Strings with `{{variable}}` are dynamic — keep the variable names as-is. Example: `"ACT {{act}} — LEVEL {{order}}"` → `"ATO {{act}} — NIVEL {{order}}"`
- **Don't translate keys.** Only translate values. The key `"start_level"` stays `"start_level"` — the value `"START LEVEL"` becomes `"INICIAR NIVEL"`.

## What to translate first

Start with `ui.json` — it's the smallest file and covers all the buttons and labels players see constantly. Level narratives and docs are bigger tasks for later.

## Testing

```bash
bun run dev
```

Change your locale in the browser (localStorage: `gitvana-locale`) or add the language picker by having 2+ entries in `availableLocales`.

## Questions?

Open an issue or reach out. Thanks for helping make Gitvana accessible to more people.
