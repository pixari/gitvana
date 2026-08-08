import type { LevelDefinition } from '../../levels/schema.js';

interface LevelOverride {
  title?: string;
  subtitle?: string;
  briefing?: {
    narrative?: string;
    concept?: string;
    objectives?: string[];
  };
  tips?: string[];
  hints?: string[];
}

// One consolidated levels.json per locale, keyed by level id. English stays
// at its native location (src/levels/act*/*.json) as the source of truth —
// this only ever overrides. Loaded eagerly: the payload is small and the
// first level screen a player sees would force the fetch anyway.
const overrideModules = import.meta.glob('../*/levels.json', { eager: true }) as Record<string, { default: Record<string, LevelOverride> }>;

const overridesByLocale = new Map<string, Record<string, LevelOverride>>();
for (const path in overrideModules) {
  const match = path.match(/^\.\.\/([^/]+)\/levels\.json$/);
  if (match) overridesByLocale.set(match[1], overrideModules[path].default);
}

/**
 * Overlay a locale's translation onto an English level definition.
 * Arrays (objectives/tips/hints) are matched positionally — if a translated
 * array's length doesn't match the English source, the whole field falls
 * back to English rather than mixing languages within one list. The real
 * safety net against silent drift is tests/i18n-overrides.test.ts.
 */
export function localizeLevel(level: LevelDefinition, code: string): LevelDefinition {
  const override = overridesByLocale.get(code)?.[level.id];
  if (!override) return level;

  const objectives = override.briefing?.objectives;
  const objectivesMatch = objectives && objectives.length === level.briefing.objectives.length;

  const tips = override.tips;
  const tipsMatch = tips && level.tips && tips.length === level.tips.length;

  const hintTexts = override.hints;
  const hintsMatch = hintTexts && hintTexts.length === level.hints.length;

  return {
    ...level,
    title: override.title ?? level.title,
    subtitle: override.subtitle ?? level.subtitle,
    briefing: {
      ...level.briefing,
      narrative: override.briefing?.narrative ?? level.briefing.narrative,
      concept: override.briefing?.concept ?? level.briefing.concept,
      objectives: objectivesMatch ? objectives! : level.briefing.objectives,
    },
    tips: tipsMatch ? tips! : level.tips,
    hints: hintsMatch ? level.hints.map((h, i) => ({ ...h, text: hintTexts![i] })) : level.hints,
  };
}
