// Checks the repository matches docs/engineering/project-structure.md (AC-F00-26, AC-F00-36).
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Top-level folders the code map allows (dot-folders such as .github are not checked). */
export const ALLOWED_TOP_LEVEL = ["apps", "packages", "infra", "tools", "tests", "docs"];
/** Generated, git-ignored folders that tools create at the top level (installed packages, test coverage). */
const GENERATED_TOP_LEVEL = ["node_modules", "coverage"];
const REQUIRED_DOCS = ["README.md", "CLAUDE.md"];
/** Apps that exist now. Planned apps are added here when their feature starts, never earlier. */
export const ALLOWED_APPS = ["api", "desktop", "web"];
/** Apps the plan adds later (docs/product/features.md), with the feature that creates them. */
const PLANNED_APPS: Record<string, string> = { "ai-worker": "F05", mobile: "F11" };

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
  problems.push(...unexpectedApps(root));
  for (const group of ["apps", "packages"]) {
    for (const name of folders(join(root, group))) problems.push(...missingDocs(root, `${group}/${name}`));
  }
  return problems;
}

function unexpectedApps(root: string): string[] {
  return folders(join(root, "apps"))
    .filter((name) => !ALLOWED_APPS.includes(name))
    .map((name) => {
      const feature = PLANNED_APPS[name];
      return feature
        ? `apps/${name} belongs to ${feature}; create it when that feature starts (then add it to ALLOWED_APPS in tools/check-structure.ts).`
        : `Unexpected app "apps/${name}". Add it to docs/engineering/project-structure.md first.`;
    });
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
