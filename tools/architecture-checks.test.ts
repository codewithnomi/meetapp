// Tests for the architecture checks (F00 T2): dependency-cruiser keeps Atomic levels and backend
// layers in order, knip finds unused code, jscpd finds copy-pasted code. Each check gets a fixture
// that breaks it (must fail and name the problem) and a clean one (must pass).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const BIN = join(ROOT, "node_modules/.bin");
const SLOW = { timeout: 60_000 };

function run(tool: string, args: string[], cwd = ROOT) {
  const result = spawnSync(join(BIN, tool), args, { cwd, encoding: "utf8" });
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

/** The config skips tests/fixtures for normal repo scans; `--exclude` replaces that so fixtures are cruised. */
function cruise(fixtureDir: string) {
  const result = run("depcruise", [
    "--config",
    ".dependency-cruiser.cjs",
    "--exclude",
    "node_modules",
    "--output-type",
    "err",
    fixtureDir,
  ]);
  const violations = [...result.output.matchAll(/error\s+([\w-]+):\s+(\S+)\s+→\s+(\S+)/g)].map(
    ([, rule, from, to]) => ({
      rule,
      from,
      to,
    }),
  );
  const cruised = Number(/(\d+) modules/.exec(result.output)?.[1] ?? 0);
  return { ...result, violations, cruised };
}

describe("TC-F00-36 [AC-F00-15] lower Atomic level importing a higher level fails (dependency-cruiser)", SLOW, () => {
  const atomic = "tests/fixtures/lint/atomic/src";

  it("TC-F00-36 [AC-F00-15] names atomic-no-upward-import and each violating file", () => {
    const result = cruise(atomic);
    expect(result.code).not.toBe(0);
    expect(result.cruised).toBe(9);
    expect(result.violations.map((violation) => violation.rule)).toEqual(Array(3).fill("atomic-no-upward-import"));
    expect(result.violations.map((violation) => violation.from).sort()).toEqual([
      `${atomic}/atoms/ImportsMolecule/ImportsMolecule.tsx`,
      `${atomic}/atoms/ImportsOrganism/ImportsOrganism.tsx`,
      `${atomic}/molecules/ImportsOrganism/ImportsOrganism.tsx`,
    ]);
  });

  it("TC-F00-36 [AC-F00-15] an organism importing a molecule and an atom passes", () => {
    const result = cruise(`${atomic}/organisms/Form`);
    expect(result.code).toBe(0);
    expect(result.cruised).toBe(6);
    expect(result.violations).toEqual([]);
  });

  it("TC-F00-36 [AC-F00-15] a molecule importing an atom passes", () => {
    const result = cruise(`${atomic}/molecules/Field`);
    expect(result.code).toBe(0);
    expect(result.cruised).toBe(4);
  });
});

describe("TC-F00-36 [AC-F00-15] a component uses a same-level sibling only through its index.ts", SLOW, () => {
  const sibling = "tests/fixtures/architecture/sibling/src/atoms";

  it("TC-F00-36 [AC-F00-15] importing a sibling's internal file fails atomic-no-sibling-internals", () => {
    const result = cruise(`${sibling}/BadButton`);
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "atomic-no-sibling-internals",
        from: `${sibling}/BadButton/BadButton.tsx`,
        to: `${sibling}/Icon/Icon.tsx`,
      },
    ]);
  });

  it("TC-F00-36 [AC-F00-15] importing another level's internal file fails atomic-no-sibling-internals", () => {
    const fixture = "tests/fixtures/architecture/cross-level-internals/src";
    const result = cruise(`${fixture}/molecules/Field`);
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "atomic-no-sibling-internals",
        from: `${fixture}/molecules/Field/Field.tsx`,
        to: `${fixture}/atoms/Label/Label.tsx`,
      },
    ]);
  });

  it("TC-F00-36 [AC-F00-15] importing a sibling through its index.ts passes", () => {
    const result = cruise(`${sibling}/IconButton`);
    expect(result.code).toBe(0);
    expect(result.cruised).toBe(3);
  });
});

describe("frontend.md rule 2: only pages, page hooks and the app shell use features/", SLOW, () => {
  const fixture = "tests/fixtures/architecture/features-outside-pages/src";

  it("a molecule importing features/ fails only-pages-use-features", () => {
    const result = cruise(`${fixture}/molecules/MeetingList`);
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "only-pages-use-features",
        from: `${fixture}/molecules/MeetingList/MeetingList.tsx`,
        to: `${fixture}/features/meetings/useMeetings.ts`,
      },
    ]);
  });

  it("a page importing features/ passes", () => {
    const result = cruise(`${fixture}/pages/MeetingPage`);
    expect(result.code).toBe(0);
    expect(result.cruised).toBe(2);
  });
});

describe("TC-F00-64 [AC-F00-28] skipping a backend layer fails", SLOW, () => {
  const fixture = (name: string) => `tests/fixtures/architecture/${name}`;
  const routes = (name: string) => `${fixture(name)}/src/modules/meetings/meetings.routes.ts`;

  it("TC-F00-64 [AC-F00-28] a route importing a repository fails no-route-to-repository", () => {
    const result = cruise(fixture("route-to-repository"));
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "no-route-to-repository",
        from: routes("route-to-repository"),
        to: `${fixture("route-to-repository")}/src/modules/meetings/meetings.repository.ts`,
      },
    ]);
  });

  it("TC-F00-64 [AC-F00-28] a route importing @meetapp/db fails no-route-to-db", () => {
    const result = cruise(fixture("route-to-db"));
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([{ rule: "no-route-to-db", from: routes("route-to-db"), to: "@meetapp/db" }]);
  });

  it("TC-F00-64 [AC-F00-28] a route importing the database library fails no-route-to-db", () => {
    const result = cruise(fixture("route-to-orm"));
    expect(result.code).not.toBe(0);
    expect(result.violations.map((violation) => [violation.rule, violation.from])).toEqual([
      ["no-route-to-db", routes("route-to-orm")],
    ]);
  });

  it("TC-F00-64 [AC-F00-28] a service querying the database itself fails no-service-to-db", () => {
    const result = cruise(fixture("service-to-db"));
    expect(result.code).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "no-service-to-db",
        from: `${fixture("service-to-db")}/src/modules/meetings/meetings.service.ts`,
        to: "@meetapp/db",
      },
    ]);
  });

  it("TC-F00-64 [AC-F00-28] route -> service -> repository passes", () => {
    const result = cruise(fixture("layered"));
    expect(result.code).toBe(0);
    expect(result.cruised).toBe(3);
    expect(result.violations).toEqual([]);
  });
});

describe("TC-F00-65 [AC-F00-29] unused code fails (knip)", SLOW, () => {
  const knip = (name: string) =>
    run("knip", [
      "--directory",
      join(ROOT, "tests/fixtures/knip", name),
      "--no-progress",
      "--reporter",
      "compact",
      "--no-config-hints",
    ]);

  it.each([
    ["(a) an unused file", "unused-file", /Unused files[\s\S]*src\/orphan\.ts/],
    ["(b) an unused export", "unused-export", /Unused exports[\s\S]*src\/math\.ts: triple/],
    ["(c) an unused dependency", "unused-dependency", /Unused dependencies[\s\S]*package\.json: left-pad/],
  ])("TC-F00-65 [AC-F00-29] %s fails and is named", (_label, name, expected) => {
    const result = knip(name);
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(expected);
  });

  it("TC-F00-65 [AC-F00-29] a project with no unused code passes", () => {
    const result = knip("clean");
    expect(result.code).toBe(0);
    expect(result.output.trim()).toBe("");
  });
});

describe("TC-F00-65 [AC-F00-29] duplicated code over 3% fails (jscpd)", SLOW, () => {
  const temps: string[] = [];
  afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  // jscpd counts one copy of each clone; this 10-line block is reported as 11 duplicated lines.
  const SHARED = [
    "export function summarize(items: readonly number[], factor: number): number {",
    "  let total = 0;",
    "  for (const item of items) {",
    "    total += item * factor;",
    "  }",
    "  const average = items.length > 0 ? total / items.length : 0;",
    "  const rounded = Math.round(average * 100) / 100;",
    "  const clamped = Math.min(Math.max(rounded, 0), 1000);",
    "  return clamped;",
    "}",
  ];

  /** Two files that share SHARED and are otherwise unique, `linesPerFile` lines each. */
  function project(linesPerFile: number) {
    const dir = mkdtempSync(join(tmpdir(), "meetapp-jscpd-"));
    temps.push(dir);
    for (const name of ["alpha", "beta"]) {
      const unique = Array.from(
        { length: linesPerFile - SHARED.length },
        (_, i) => `export const ${name}Value${i} = compute(${i}, "${name}${i}");`,
      );
      writeFileSync(join(dir, `${name}.ts`), `${[...unique, ...SHARED].join("\n")}\n`);
    }
    const reports = mkdtempSync(join(tmpdir(), "meetapp-jscpd-report-"));
    temps.push(reports);
    // cwd is the temp dir so the repo's own .jscpd.json (paths, ignores) cannot change the result.
    const result = run(
      "jscpd",
      ["--threshold", "3", "--min-lines", "5", "--min-tokens", "50", "--format", "typescript"].concat([
        "--reporters",
        "console,json",
        "--output",
        reports,
        dir,
      ]),
      dir,
    );
    const report = JSON.parse(readFileSync(join(reports, "jscpd-report.json"), "utf8")) as {
      statistics: { total: { percentage: number } };
    };
    return { ...result, percentage: report.statistics.total.percentage };
  }

  it("TC-F00-65 [AC-F00-29] (d) about 4% duplicated lines fails and names the files", () => {
    const result = project(138);
    expect(result.percentage).toBeGreaterThan(3.9);
    expect(result.percentage).toBeLessThan(4.1);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("alpha.ts");
    expect(result.output).toContain("beta.ts");
  });

  it("TC-F00-65 [AC-F00-29] (e) about 2% duplicated lines passes", () => {
    const result = project(275);
    expect(result.percentage).toBeGreaterThan(1.9);
    expect(result.percentage).toBeLessThan(2.1);
    expect(result.code).toBe(0);
  });

  it("TC-F00-65 [AC-F00-29] the project config uses the same threshold and clone size as these tests", () => {
    const config = JSON.parse(readFileSync(join(ROOT, ".jscpd.json"), "utf8")) as Record<string, unknown>;
    expect(config).toMatchObject({ threshold: 3, minLines: 5, minTokens: 50 });
  });
});
