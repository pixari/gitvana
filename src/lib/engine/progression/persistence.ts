export interface GameSave {
  version: number;
  completedLevels: number;
  levelIndex: number;
  levelStars: Record<string, number>; // levelId -> stars earned
  totalStars: number;
}

const SAVE_KEY = 'gitvana-save';
const SAVE_VERSION = 2;

// Number of Act 0 levels prepended in v2
const ACT0_LEVEL_COUNT = 3;

export function saveProgress(data: GameSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    // localStorage may be unavailable or full
  }
}

export function loadProgress(): GameSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data: GameSave = JSON.parse(raw);
    if (typeof data.version !== 'number') return null;

    // Migrate v1 → v2: Act 0 was prepended, shift levelIndex
    if (data.version === 1) {
      data.levelIndex += ACT0_LEVEL_COUNT;
      data.version = SAVE_VERSION;
      // Re-save with migrated data
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    }

    return data;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

const NAME_KEY = 'gitvana-player-name';

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage may be unavailable or full
  }
}

export function getPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'Anonymous Monk';
  } catch {
    return 'Anonymous Monk';
  }
}
