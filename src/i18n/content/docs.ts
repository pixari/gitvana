import type { CommandDoc, GuideDoc } from '../../docs/types.js';

interface CommandDocOverride {
  description?: string;
  tip?: string;
  advanced?: string;
  options?: string[]; // index-matched to doc.options[].description
  examples?: string[]; // index-matched to doc.examples[].explanation
}

interface GuideOverride {
  title?: string;
  content?: string;
}

// Docs are the one place lazy-loading is worth it: DocsPage/DocPopup only
// mount on demand, and most sessions never open them.
const commandOverrideLoaders = import.meta.glob('../*/docs-commands.json') as Record<string, () => Promise<{ default: Record<string, CommandDocOverride> }>>;
const guideOverrideLoaders = import.meta.glob('../*/docs-guides.json') as Record<string, () => Promise<{ default: Record<string, GuideOverride> }>>;

const commandOverrideCache = new Map<string, Promise<Record<string, CommandDocOverride>>>();
export function loadCommandOverrides(code: string): Promise<Record<string, CommandDocOverride>> {
  if (!commandOverrideCache.has(code)) {
    const loader = commandOverrideLoaders[`../${code}/docs-commands.json`];
    commandOverrideCache.set(code, loader ? loader().then(m => m.default) : Promise.resolve({}));
  }
  return commandOverrideCache.get(code)!;
}

const guideOverrideCache = new Map<string, Promise<Record<string, GuideOverride>>>();
export function loadGuideOverrides(code: string): Promise<Record<string, GuideOverride>> {
  if (!guideOverrideCache.has(code)) {
    const loader = guideOverrideLoaders[`../${code}/docs-guides.json`];
    guideOverrideCache.set(code, loader ? loader().then(m => m.default) : Promise.resolve({}));
  }
  return guideOverrideCache.get(code)!;
}

/**
 * Overlay a locale's translation onto an English CommandDoc. `options`/
 * `examples` are matched positionally; a length mismatch falls back to the
 * whole English array rather than mixing languages within one list (see
 * tests/i18n-overrides.test.ts for the guardrail against silent drift).
 */
export function mergeCommandDoc(doc: CommandDoc, override?: CommandDocOverride): CommandDoc {
  if (!override) return doc;

  const options = override.options;
  const optionsMatch = options && options.length === doc.options.length;

  const examples = override.examples;
  const examplesMatch = examples && examples.length === doc.examples.length;

  return {
    ...doc,
    description: override.description ?? doc.description,
    tip: override.tip ?? doc.tip,
    advanced: override.advanced ?? doc.advanced,
    options: optionsMatch ? doc.options.map((o, i) => ({ ...o, description: options![i] })) : doc.options,
    examples: examplesMatch ? doc.examples.map((e, i) => ({ ...e, explanation: examples![i] })) : doc.examples,
  };
}

export function mergeGuide(guide: GuideDoc, override?: GuideOverride): GuideDoc {
  if (!override) return guide;
  return {
    ...guide,
    title: override.title ?? guide.title,
    content: override.content ?? guide.content,
  };
}
