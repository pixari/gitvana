import type { LevelDefinition } from '../schema.js';

import level01 from './01-terminal.json';
import level02 from './02-scrolls.json';
import level03 from './03-chains.json';

export const act0Levels: LevelDefinition[] = [
  level01 as LevelDefinition,
  level02 as LevelDefinition,
  level03 as LevelDefinition,
];

export const ACT0_COUNT = act0Levels.length;
