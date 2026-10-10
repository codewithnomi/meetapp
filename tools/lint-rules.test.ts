// Tests for the lint rules that keep code small, typed, on-brand and translatable (F00 T2).
// Every rule is proven twice: a fixture that breaks it must fail (naming file, line and rule),
// and a fixture exactly at the limit must pass. Fixtures live in tests/fixtures/lint/.
// The project ESLint config ignores tests/fixtures/**, so these tests turn ignoring off.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURES = join(ROOT, "tests/fixtures/lint");
const SLOW = { timeout: 60_000 };

const eslint = new ESLint({ cwd: ROOT, ignore: false });

async function lint(relative: string) {
  const [result] = await eslint.lintFiles([join(FIXTURES, relative)]);
  if (!result) throw new Error(`ESLint returned no result for ${relative}`);
  return result;
}

/** What ESLint said about one fixture: which rules fired and on which line `rule` fired first. */
async function summarize(relative: string, rule?: string) {
  const result = await lint(relative);
  return {
    filePath: result.filePath,
    failed: result.errorCount > 0,
    warningCount: result.warningCount,
    rules: [...new Set(result.messages.map((message) => message.ruleId))],
    line: result.messages.find((message) => message.ruleId === rule)?.line,
  };
}

/** Expected summary: the fixture fails with `rule` at `line` and breaks no other rule. */
function failure(relative: string, rule: string, line: number) {
  return { filePath: join(FIXTURES, relative), failed: true, warningCount: 0, rules: [rule], line };
}

const CLEAN = { failed: false, warningCount: 0, rules: [], line: undefined };

describe("TC-F00-62 [AC-F00-27] each hard limit fails and names file, line and rule", SLOW, () => {
  it("TC-F00-62 [AC-F00-27] function of 51 lines fails max-lines-per-function at the function start", async () => {
    expect(await summarize("limits/function-51.ts", "max-lines-per-function")).toEqual(
      failure("limits/function-51.ts", "max-lines-per-function", 3),
    );
  });

  it("TC-F00-62 [AC-F00-27] file of 301 lines fails max-lines at line 301", async () => {
    expect(await summarize("limits/file-301.ts", "max-lines")).toEqual(failure("limits/file-301.ts", "max-lines", 301));
  });

  it("TC-F00-62 [AC-F00-27] cognitive complexity 16 fails sonarjs/cognitive-complexity", async () => {
    expect(await summarize("limits/complexity-16.ts", "sonarjs/cognitive-complexity")).toEqual(
      failure("limits/complexity-16.ts", "sonarjs/cognitive-complexity", 3),
    );
  });

  it("TC-F00-62 [AC-F00-27] five parameters fail max-params", async () => {
    expect(await summarize("limits/params-5.ts", "max-params")).toEqual(failure("limits/params-5.ts", "max-params", 3));
  });

  it("TC-F00-62 [AC-F00-27] nesting depth 4 fails max-depth at the fourth block", async () => {
    expect(await summarize("limits/nesting-4.ts", "max-depth")).toEqual(failure("limits/nesting-4.ts", "max-depth", 8));
  });

  it("TC-F00-62 [AC-F00-27] an any type fails @typescript-eslint/no-explicit-any", async () => {
    expect(await summarize("limits/any-type.ts", "@typescript-eslint/no-explicit-any")).toEqual(
      failure("limits/any-type.ts", "@typescript-eslint/no-explicit-any", 3),
    );
  });

  it("TC-F00-62 [AC-F00-27] console.log fails no-console", async () => {
    expect(await summarize("limits/console-log.ts", "no-console")).toEqual(
      failure("limits/console-log.ts", "no-console", 4),
    );
  });

  it("TC-F00-62 [AC-F00-27] the eslint command exits non-zero and prints file, line and rule", () => {
    const file = join(FIXTURES, "limits/function-51.ts");
    const result = spawnSync(join(ROOT, "node_modules/.bin/eslint"), ["--no-ignore", "--max-warnings=0", file], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(file);
    expect(result.stdout).toMatch(/^\s+3:\d+\s+error\b.*max-lines-per-function\s*$/m);
  });
});

describe("TC-F00-63 [AC-F00-27] code exactly at the limits passes", SLOW, () => {
  it.each([
    ["50-line function", "limits/function-50.ts"],
    ["300-line file", "limits/file-300.ts"],
    ["cognitive complexity 15", "limits/complexity-15.ts"],
    ["4 parameters", "limits/params-4.ts"],
    ["nesting depth 3", "limits/nesting-3.ts"],
  ])("TC-F00-63 [AC-F00-27] %s passes with no errors or warnings", async (_label, relative) => {
    expect(await summarize(relative)).toMatchObject(CLEAN);
  });
});

describe("TC-F00-36 [AC-F00-15] lower Atomic level importing a higher level fails (ESLint)", SLOW, () => {
  it.each([
    ["an atom importing a molecule", "atomic/src/atoms/ImportsMolecule/ImportsMolecule.tsx"],
    ["an atom importing an organism", "atomic/src/atoms/ImportsOrganism/ImportsOrganism.tsx"],
    ["a molecule importing an organism", "atomic/src/molecules/ImportsOrganism/ImportsOrganism.tsx"],
  ])("TC-F00-36 [AC-F00-15] %s fails boundaries/dependencies on the import line", async (_label, relative) => {
    expect(await summarize(relative, "boundaries/dependencies")).toEqual(
      failure(relative, "boundaries/dependencies", 2),
    );
  });

  it.each([
    ["a plain atom", "atomic/src/atoms/Label/Label.tsx"],
    ["a molecule importing an atom", "atomic/src/molecules/Field/Field.tsx"],
    ["an organism importing a molecule and an atom", "atomic/src/organisms/Form/Form.tsx"],
  ])("TC-F00-36 [AC-F00-15] %s passes", async (_label, relative) => {
    expect(await summarize(relative)).toMatchObject(CLEAN);
  });
});

describe("TC-F00-37 [AC-F00-15] raw colors fail the check", SLOW, () => {
  it.each([
    ["a long hex color", "colors/HexLong.tsx", 4],
    ["a short hex color", "colors/HexShort.tsx", 4],
    ["an rgb() color", "colors/Rgb.tsx", 4],
    ["an hsl() color", "colors/Hsl.tsx", 4],
    ["a Tailwind palette class", "colors/PaletteClass.tsx", 5],
    ["a Tailwind arbitrary hex value", "colors/ArbitraryHex.tsx", 4],
    ["a Tailwind text-shadow palette class", "colors/TextShadow.tsx", 4],
  ])("TC-F00-37 [AC-F00-15] %s fails meetapp/no-raw-color", async (_label, relative, line) => {
    expect(await summarize(relative, "meetapp/no-raw-color")).toEqual(failure(relative, "meetapp/no-raw-color", line));
  });

  it("TC-F00-37 [AC-F00-15] design-token classes (bg-accent, text-text) pass", async () => {
    expect(await summarize("colors/TokenClass.tsx")).toMatchObject(CLEAN);
  });

  it("TC-F00-37 [AC-F00-15] a link anchor and a room number are not mistaken for colors", async () => {
    expect(await summarize("colors/NotColors.tsx")).toMatchObject(CLEAN);
  });

  // Palette reset (bg-blue-500 builds no CSS) is tested in packages/design-tokens/src/tailwind.test.ts.

  it.each([
    ["a named color in a style object", "colors/NamedColorStyle.tsx", 4, "red"],
    ["a named color in an SVG fill attribute", "colors/NamedColorAttribute.tsx", 6, "white"],
  ])("TC-F00-37 [AC-F00-15] %s fails meetapp/no-raw-color naming the value", async (_label, relative, line, value) => {
    expect(await summarize(relative, "meetapp/no-raw-color")).toEqual(failure(relative, "meetapp/no-raw-color", line));
    const [message] = (await lint(relative)).messages;
    expect(message?.message).toContain(`Raw color "${value}"`);
  });

  it("TC-F00-37 [AC-F00-15] currentColor, transparent, inherit and a non-color attribute pass", async () => {
    expect(await summarize("colors/NamedColorAllowed.tsx")).toMatchObject(CLEAN);
  });
});

describe("TC-F00-38 [AC-F00-16] hard-coded visible text fails the check", SLOW, () => {
  it("TC-F00-38 [AC-F00-16] text written inside a button fails i18next/no-literal-string", async () => {
    expect(await summarize("i18n/HardcodedText.tsx", "i18next/no-literal-string")).toEqual(
      failure("i18n/HardcodedText.tsx", "i18next/no-literal-string", 4),
    );
  });

  it("TC-F00-38 [AC-F00-16] a hard-coded aria-label fails i18next/no-literal-string", async () => {
    expect(await summarize("i18n/HardcodedAriaLabel.tsx", "i18next/no-literal-string")).toEqual(
      failure("i18n/HardcodedAriaLabel.tsx", "i18next/no-literal-string", 5),
    );
  });

  it('TC-F00-38 [AC-F00-16] text from t("common.save") passes', async () => {
    expect(await summarize("i18n/Translated.tsx")).toMatchObject(CLEAN);
  });

  // apps/web and its locales/en.json do not exist yet. Written in T14.
  it.todo("TC-F00-38 [AC-F00-16] every t() key used in apps/web exists in locales/en.json - tested in T14");
});

describe("TC-F00-62 [AC-F00-27] a hard limit may be switched off only with a reason (code-quality.md)", SLOW, () => {
  it("TC-F00-62 [AC-F00-27] a disable comment without a reason fails require-description", async () => {
    const rule = "@eslint-community/eslint-comments/require-description";
    expect(await summarize("comments/disable-without-reason.ts", rule)).toEqual(
      failure("comments/disable-without-reason.ts", rule, 4),
    );
  });

  it("TC-F00-62 [AC-F00-27] a disable comment with a reason passes", async () => {
    expect(await summarize("comments/disable-with-reason.ts")).toMatchObject(CLEAN);
  });
});
