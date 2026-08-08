import { writable, derived } from 'svelte/store';

const LOCALE_KEY = 'gitvana-locale';

// Flat key→string namespaces backed by src/i18n/<locale>/<namespace>.json.
// All are small and loaded eagerly — `hints` in particular must be
// synchronously available since HintEngine.getHint() calls t() outside any
// Svelte store subscription.
const NAMESPACES = ['ui', 'stages', 'hints'] as const;

// Available locales (add new ones here)
export const availableLocales: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

// Detect browser language, fallback to 'en'
function detectLocale(): string {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved) return saved;
  const lang = navigator.language || 'en';
  if (availableLocales.some(l => l.code === lang)) return lang;
  // Fall back from a region variant (es-MX) to its base language (es)
  const base = lang.split('-')[0];
  const baseMatch = availableLocales.find(l => l.code.split('-')[0] === base);
  return baseMatch ? baseMatch.code : 'en';
}

export const locale = writable<string>(detectLocale());

// Cache loaded locale data
const localeCache = new Map<string, Record<string, Record<string, string>>>();

// English is always loaded synchronously as fallback
let enData: Record<string, Record<string, string>> = {};
let currentData: Record<string, Record<string, string>> = {};

// Only the flat namespaces — NOT levels.json/docs-*.json, which have their
// own loaders in src/i18n/content/ (levels eager, docs lazy). A broader glob
// here would eagerly bundle those into the main chunk too.
const localeModules = import.meta.glob('./*/{ui,stages,hints}.json', { eager: true }) as Record<string, { default: Record<string, string> }>;

function loadNamespaces(code: string): Record<string, Record<string, string>> {
  const data: Record<string, Record<string, string>> = {};
  for (const ns of NAMESPACES) {
    const mod = localeModules[`./${code}/${ns}.json`];
    if (mod) data[ns] = mod.default;
  }
  return data;
}

export function setLocale(code: string) {
  localStorage.setItem(LOCALE_KEY, code);
  loadLocale(code);
  locale.set(code);
}

async function loadLocale(code: string) {
  if (localeCache.has(code)) {
    currentData = localeCache.get(code)!;
    return;
  }

  const data = loadNamespaces(code);
  localeCache.set(code, data);
  currentData = data;
}

// Initialize English data eagerly
function initEnglish() {
  enData = loadNamespaces('en');
  localeCache.set('en', enData);
  currentData = enData;
}

initEnglish();

// Load saved non-English locale on startup so F5 / page reload preserves the language
const _initialLocale = detectLocale();
if (_initialLocale !== 'en') {
  loadLocale(_initialLocale);
}

/**
 * Translate a key. Format: "namespace.key" e.g. "ui.start_level"
 * Supports simple interpolation: t('ui.commands_used', { count: 5 })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const [ns, ...rest] = key.split('.');
  const k = rest.join('.');

  // Try current locale first, then English fallback
  let value = currentData[ns]?.[k] ?? enData[ns]?.[k] ?? key;

  // Simple interpolation: {{count}} → params.count
  if (params) {
    for (const [param, val] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), String(val));
    }
  }

  return value;
}

// Reactive translate store for Svelte components — use as $translate('key') in templates
// Re-evaluates when locale changes, picking up the updated currentData.
export const translate = derived(locale, () => t);
