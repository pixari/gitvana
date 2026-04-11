import { writable, get } from 'svelte/store';

const LOCALE_KEY = 'gitvana-locale';

// Detect browser language, fallback to 'en'
function detectLocale(): string {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved) return saved;
  const lang = navigator.language || 'en';
  // Check for exact match first (pt-BR), then base (pt)
  return lang;
}

export const locale = writable<string>(detectLocale());

// Cache loaded locale data
const localeCache = new Map<string, Record<string, Record<string, string>>>();

// English is always loaded synchronously as fallback
let enData: Record<string, Record<string, string>> = {};
let currentData: Record<string, Record<string, string>> = {};

// Available locales (add new ones here)
export const availableLocales: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

export function setLocale(code: string) {
  localStorage.setItem(LOCALE_KEY, code);
  locale.set(code);
  loadLocale(code);
}

async function loadLocale(code: string) {
  if (localeCache.has(code)) {
    currentData = localeCache.get(code)!;
    return;
  }

  try {
    const modules = import.meta.glob('./*/ui.json', { eager: true }) as Record<string, { default: Record<string, string> }>;
    const uiModule = modules[`./${code}/ui.json`];
    if (uiModule) {
      if (!localeCache.has(code)) localeCache.set(code, {});
      localeCache.get(code)!.ui = uiModule.default;
    }
  } catch { /* locale not found, will use English fallback */ }

  currentData = localeCache.get(code) || {};
}

// Initialize English data eagerly
function initEnglish() {
  try {
    const modules = import.meta.glob('./en/ui.json', { eager: true }) as Record<string, { default: Record<string, string> }>;
    const mod = modules['./en/ui.json'];
    if (mod) {
      enData = { ui: mod.default };
      localeCache.set('en', enData);
      currentData = enData;
    }
  } catch { /* fallback to empty */ }
}

initEnglish();

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

// Reactive t() for Svelte components — re-runs when locale changes
export function createT() {
  return {
    subscribe: locale.subscribe,
    t,
  };
}
