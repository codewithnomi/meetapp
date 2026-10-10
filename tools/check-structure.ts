// Checks the repository matches docs/engineering/project-structure.md (AC-F00-26, AC-F00-36).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Top-level folders the code map allows (dot-folders such as .github are not checked). */
export const ALLOWED_TOP_LEVEL = ["apps", "packages", "infra", "tools", "tests", "docs"];
/** Generated, git-ignored folders that tools create at the top level (installed packages, test coverage). */
const GENERATED_TOP_LEVEL = ["node_modules", "coverage"];
const REQUIRED_DOCS = ["README.md", "CLAUDE.md"];

function folders(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => !name.startsWith(".") && statSync(join(path, name)).isDirectory());
}

/** Returns human-readable problems; empty when the structure is correct. */
export function findStructureProblems(root: string): string[] {
  const problems: string[] = [];
  for (const name of folders(root)) {
    if (!GENERATED_TOP_LEVEL.includes(name) && !ALLOWED_TOP_LEVEL.includes(name)) {
      problems.push(`Unexpected top-level folder "${name}". Add it to docs/engineering/project-structure.md first.`);
    }
  }
  for (const group of ["apps", "packages"]) {
    for (const name of folders(join(root, group))) problems.push(...missingDocs(root, `${group}/${name}`));
  }
  return problems;
}

function missingDocs(root: string, folder: string): string[] {
  return REQUIRED_DOCS.filter((doc) => !existsSync(join(root, folder, doc))).map(
    (doc) => `${folder} is missing ${doc}.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findStructureProblems(fileURLToPath(new URL("..", import.meta.url)));
  for (const problem of problems) process.stderr.write(`✗ ${problem}\n`);
  process.exit(problems.length > 0 ? 1 : 0);
}
