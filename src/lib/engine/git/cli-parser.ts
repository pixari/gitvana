export interface ParsedCommand {
  type: 'git' | 'builtin' | 'edit' | 'docs' | 'unknown';
  command: string;
  args: string[];
  raw: string;
}

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim();
  if (!raw) {
    return { type: 'unknown', command: '', args: [], raw };
  }

  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    return { type: 'unknown', command: '', args: [], raw };
  }

  const first = tokens[0];

  if (first === 'git' && tokens.length >= 2) {
    return {
      type: 'git',
      command: tokens[1],
      args: tokens.slice(2),
      raw,
    };
  }

  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';
  const devCommands = ['solve', 'skip', 'solution'];
  if (isDevMode && devCommands.includes(first)) {
    return {
      type: 'builtin',
      command: first,
      args: tokens.slice(1),
      raw,
    };
  }

  if (first === 'docs') {
    return {
      type: 'docs',
      command: 'docs',
      args: tokens.slice(1),
      raw,
    };
  }

  const builtins = ['ls', 'cat', 'mkdir', 'echo', 'pwd', 'clear', 'help', 'hint', 'touch', 'rm', 'restart'];
  if (builtins.includes(first)) {
    return {
      type: 'builtin',
      command: first,
      args: tokens.slice(1),
      raw,
    };
  }

  if (first === 'edit' || first === 'vim' || first === 'nano') {
    return {
      type: 'edit',
      command: 'edit',
      args: tokens.slice(1),
      raw,
    };
  }

  return { type: 'unknown', command: first, args: tokens.slice(1), raw };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
