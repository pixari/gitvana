import { test, expect, describe } from 'bun:test';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { act0Levels } from '../src/levels/act0-terminal/index.js';
import { act1Levels } from '../src/levels/act1-basics/index.js';
import { act2Levels } from '../src/levels/act2-branching/index.js';
import { act3Levels } from '../src/levels/act3-conflicts/index.js';
import { act4Levels } from '../src/levels/act4-rewriting/index.js';
import { act5Levels } from '../src/levels/act5-recovery/index.js';
import { act6Levels } from '../src/levels/act6-collaboration/index.js';
import { commandDocs } from '../src/docs/commands/index.js';
import { guides } from '../src/docs/guides/index.js';

// Structured content overrides (levels.json / docs-commands.json /
// docs-guides.json) match translated arrays to their English source
// positionally. A length mismatch means the translation has silently drifted
// out of sync with the source — this is the real guardrail against that,
// not the runtime fallback in src/i18n/content/*.ts.

const allLevels = [
  ...act0Levels,
  ...act1Levels,
  ...act2Levels,
  ...act3Levels,
  ...act4Levels,
  ...act5Levels,
  ...act6Levels,
];
const levelsById = new Map(allLevels.map(l => [l.id, l]));

const i18nDir = join(import.meta.dir, '../src/i18n');
const locales = readdirSync(i18nDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== 'en')
  .map(d => d.name);

describe('i18n override array-length parity', () => {
  for (const locale of locales) {
    const levelsPath = join(i18nDir, locale, 'levels.json');
    if (existsSync(levelsPath)) {
      const overrides = JSON.parse(readFileSync(levelsPath, 'utf-8'));

      for (const [id, override] of Object.entries(overrides) as [string, any][]) {
        const level = levelsById.get(id);

        test(`${locale}/levels.json: "${id}" exists in the English source`, () => {
          expect(level).toBeDefined();
        });

        if (!level) continue;

        if (override.briefing?.objectives) {
          test(`${locale}/levels.json: "${id}" objectives length matches English`, () => {
            expect(override.briefing.objectives.length).toBe(level.briefing.objectives.length);
          });
        }

        if (override.tips) {
          test(`${locale}/levels.json: "${id}" tips length matches English`, () => {
            expect(override.tips.length).toBe(level.tips?.length ?? 0);
          });
        }

        if (override.hints) {
          test(`${locale}/levels.json: "${id}" hints length matches English`, () => {
            expect(override.hints.length).toBe(level.hints.length);
          });
        }
      }
    }

    const commandsPath = join(i18nDir, locale, 'docs-commands.json');
    if (existsSync(commandsPath)) {
      const overrides = JSON.parse(readFileSync(commandsPath, 'utf-8'));

      for (const [key, override] of Object.entries(overrides) as [string, any][]) {
        const doc = commandDocs[key];

        test(`${locale}/docs-commands.json: "${key}" exists in the English source`, () => {
          expect(doc).toBeDefined();
        });

        if (!doc) continue;

        if (override.options) {
          test(`${locale}/docs-commands.json: "${key}" options length matches English`, () => {
            expect(override.options.length).toBe(doc.options.length);
          });
        }

        if (override.examples) {
          test(`${locale}/docs-commands.json: "${key}" examples length matches English`, () => {
            expect(override.examples.length).toBe(doc.examples.length);
          });
        }
      }
    }

    const guidesPath = join(i18nDir, locale, 'docs-guides.json');
    if (existsSync(guidesPath)) {
      const overrides = JSON.parse(readFileSync(guidesPath, 'utf-8'));

      for (const id of Object.keys(overrides)) {
        test(`${locale}/docs-guides.json: "${id}" exists in the English source`, () => {
          expect(guides[id]).toBeDefined();
        });
      }
    }
  }
});
