export interface Stage {
  id: number;
  minLevels: number;
  color: string;
  glowColor: string;
}

export const stages: Stage[] = [
  { id: 1,  minLevels: 0,  color: '#5f574f', glowColor: '#7a7268' },
  { id: 2,  minLevels: 1,  color: '#6a5a7e', glowColor: '#8a7a9e' },
  { id: 3,  minLevels: 2,  color: '#7a5a8e', glowColor: '#9a7aae' },
  { id: 4,  minLevels: 3,  color: '#7a5a9e', glowColor: '#9a7abe' },
  { id: 5,  minLevels: 4,  color: '#7a5aae', glowColor: '#9a7ace' },
  { id: 6,  minLevels: 5,  color: '#29506e', glowColor: '#3a7a9e' },
  { id: 7,  minLevels: 7,  color: '#29607e', glowColor: '#3a8aae' },
  { id: 8,  minLevels: 9,  color: '#295a8e', glowColor: '#3a7abe' },
  { id: 9,  minLevels: 11, color: '#2a6a5e', glowColor: '#3a9a7e' },
  { id: 10, minLevels: 13, color: '#3a7a5e', glowColor: '#4aaa7e' },
  { id: 11, minLevels: 15, color: '#4a8a4e', glowColor: '#5aba6e' },
  { id: 12, minLevels: 17, color: '#6a8a3e', glowColor: '#8aba5e' },
  { id: 13, minLevels: 19, color: '#8a8a2e', glowColor: '#baba4e' },
  { id: 14, minLevels: 22, color: '#aa7a2e', glowColor: '#daa04e' },
  { id: 15, minLevels: 25, color: '#ba6a2e', glowColor: '#ea8a4e' },
  { id: 16, minLevels: 28, color: '#ca5a2e', glowColor: '#fa7a4e' },
  { id: 17, minLevels: 30, color: '#da4a3e', glowColor: '#fa6a5e' },
  { id: 18, minLevels: 32, color: '#ea4a5e', glowColor: '#fa6a7e' },
  { id: 19, minLevels: 34, color: '#fa5a8e', glowColor: '#fa7aae' },
  { id: 20, minLevels: 35, color: '#ffa300', glowColor: '#ffcc00' },
];

export const TOTAL_LEVELS = 35;

export function getStage(completedLevels: number): Stage {
  let current = stages[0];
  for (const stage of stages) {
    if (completedLevels >= stage.minLevels) {
      current = stage;
    } else {
      break;
    }
  }
  return current;
}

export function getNextStage(completedLevels: number): Stage | null {
  for (const stage of stages) {
    if (completedLevels < stage.minLevels) {
      return stage;
    }
  }
  return null;
}
