// `pnpm --filter @meetapp/design-tokens build`: writes dist/tokens.css, dist/theme.css and dist/tokens.ts.
// Refuses to build when a required color pair fails the contrast check (AC-F00-11).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findContrastFailures } from "./contrast.ts";
import { generateCss } from "./generate.ts";
import { generateTheme, generateTypes } from "./generate-theme.ts";
import { loadTokens } from "./tokens.ts";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const tokens = loadTokens();

const failures = findContrastFailures(tokens);
if (failures.length > 0) {
  process.stderr.write(`✗ Contrast check failed:\n${failures.map((failure) => `  - ${failure.message}`).join("\n")}\n`);
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });
writeFileSync(`${DIST}tokens.css`, generateCss(tokens));
writeFileSync(`${DIST}theme.css`, generateTheme(tokens));
writeFileSync(`${DIST}tokens.ts`, generateTypes(tokens));
process.stdout.write("Design tokens built: dist/tokens.css, dist/theme.css, dist/tokens.ts\n");
