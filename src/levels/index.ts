import { act0Levels, ACT0_COUNT } from './act0-terminal/index.js';
import { act1Levels } from './act1-basics/index.js';
import type { LevelDefinition } from './schema.js';

export { ACT0_COUNT };

// Act 0 (optional terminal intro) and Act 1 are always loaded
// Other acts are lazy-loaded
const actLoaders = {
  2: () => import('./act2-branching/index.js').then(m => m.act2Levels),
  3: () => import('./act3-conflicts/index.js').then(m => m.act3Levels),
  4: () => import('./act4-rewriting/index.js').then(m => m.act4Levels),
  5: () => import('./act5-recovery/index.js').then(m => m.act5Levels),
  6: () => import('./act6-collaboration/index.js').then(m => m.act6Levels),
};

let allLevels: LevelDefinition[] | null = null;

export async function getAllLevels(): Promise<LevelDefinition[]> {
  if (allLevels) return allLevels;

  const results = await Promise.all([
    Promise.resolve(act0Levels),
    Promise.resolve(act1Levels),
    actLoaders[2](),
    actLoaders[3](),
    actLoaders[4](),
    actLoaders[5](),
    actLoaders[6](),
  ]);

  allLevels = results.flat();
  return allLevels;
}

// Sync access after first load
export function getLevels(): LevelDefinition[] {
  return allLevels || [...act0Levels, ...act1Levels];
}

export { act0Levels, act1Levels };
