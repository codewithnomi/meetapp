export function readPinnedMajors(miseToml: string): { node: string; pnpm: string };
export function findVersionProblems(
  actual: { node: string | undefined; pnpm: string | undefined },
  pinned: { node: string; pnpm: string },
): string[];
