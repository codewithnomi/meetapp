// TC-F00-26 (AC-F00-12, AC-F00-15): colors are written down only in packages/design-tokens.
// Scans every tracked or new (not git-ignored) source file for hex colors and rgb()/hsl() values.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCE = /\.(?:ts|tsx|css|js|mjs)$/;
const EXCLUDED_DIRECTORIES = ["packages/design-tokens/", "tests/fixtures/"];

/** Single files that must mention colors, each with the reason. Keep this list short. */
const EXCLUDED_FILES: Record<string, string> = {
  // The rule that detects raw colors; its comments explain what it accepts ("#abc" as a link anchor).
  "packages/config/eslint/no-raw-color.js": "the color-detection lint rule itself",
  // Test names describe the raw-color fixtures ("an rgb() color", "an hsl() color").
  "tools/lint-rules.test.ts": "names the raw-color lint fixtures it tests",
  // This test: its pattern self-check needs sample colors.
  "tools/no-colors-outside-tokens.test.ts": "sample colors for checking the pattern",
};

// Same hex rule as meetapp/no-raw-color: 6 or 8 digits always count; 3 or 4 only with a letter a-f,
// so "Room #101" passes.
const HEX = String.raw`(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|(?=[0-9]*[a-f])[0-9a-f]{3,4})(?![\w-])`;
const FUNCTIONS = String.raw`\b(?:rgb|rgba|hsl|hsla)\(`;
const COLOR = new RegExp(`${HEX}|${FUNCTIONS}`, "i");

function sourceFiles(): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return listed
    .split("\0")
    .filter((file) => SOURCE.test(file))
    .filter((file) => !file.split("/").includes("node_modules"))
    .filter((file) => !EXCLUDED_DIRECTORIES.some((directory) => file.startsWith(directory)))
    .filter((file) => !(file in EXCLUDED_FILES))
    .filter((file) => existsSync(join(ROOT, file)));
}

/** "file:line: text" for every line that holds a color value. */
function colorsIn(file: string): string[] {
  return readFileSync(join(ROOT, file), "utf8")
    .split("\n")
    .flatMap((text, index) => (COLOR.test(text) ? [`${file}:${String(index + 1)}: ${text.trim()}`] : []));
}

describe("TC-F00-26 [AC-F00-12] [AC-F00-15] no color defined outside design-tokens", () => {
  it("TC-F00-26 [AC-F00-12] [AC-F00-15] the scan sees the repository's source files", () => {
    const files = sourceFiles();
    expect(files).toContain("tools/flag.ts");
    expect(files.some((file) => file.startsWith("packages/design-tokens/"))).toBe(false);
    expect(files.some((file) => file.startsWith("tests/fixtures/"))).toBe(false);
  });

  it("TC-F00-26 [AC-F00-12] [AC-F00-15] every excluded single file still exists (no stale exclusions)", () => {
    for (const file of Object.keys(EXCLUDED_FILES)) expect(existsSync(join(ROOT, file)), file).toBe(true);
  });

  it("TC-F00-26 [AC-F00-12] [AC-F00-15] the pattern finds colors and skips room numbers and anchors", () => {
    const samples = ["#0ea5e9", "#fff", "#11223344", "rgb(0,0,0)", "rgba(5, 9, 14, 0.62)", "hsl(200 50% 50%)"];
    for (const sample of samples) expect(COLOR.test(`color: "${sample}"`), sample).toBe(true);
    for (const sample of ["Room #101", "#1234", "&#123;", "#section-2", "#!/usr/bin/env node"]) {
      expect(COLOR.test(sample), sample).toBe(false);
    }
  });

  it("TC-F00-26 [AC-F00-12] [AC-F00-15] no .ts/.tsx/.css/.js/.mjs file outside design-tokens holds a color", () => {
    expect(sourceFiles().flatMap(colorsIn)).toEqual([]);
  });
});
