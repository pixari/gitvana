import type { LevelDefinition } from '../schema.js';
import level31 from './31-wrong-branch.json';
import level32 from './32-split.json';
import level33 from './33-octopus.json';
import level34 from './34-archaeology.json';
import level35 from './35-gitvana.json';
import level36 from './36-first-push.json';
import level37 from './37-fetch-forward.json';
import level38 from './38-pull-conflict.json';

export const act6Levels: LevelDefinition[] = [
  level31 as LevelDefinition,
  level32 as LevelDefinition,
  level33 as LevelDefinition,
  level34 as LevelDefinition,
  level35 as LevelDefinition,
  level36 as LevelDefinition,
  level37 as LevelDefinition,
  level38 as LevelDefinition,
];

export const act6Meta = {
  id: 6,
  title: 'Gitvana',
  subtitle: 'Mastery — no new commands, only wisdom',
  description: 'The final act: move commits between branches, split commits, resolve multi-branch conflicts, recover deleted branches, push to remotes, and achieve total Git mastery.',
};
