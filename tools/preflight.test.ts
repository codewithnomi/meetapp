import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as acorn from "acorn";
import { describe, expect, it } from "vitest";
import { findVersionProblems, readPinnedMajors } from "./preflight.mjs";

const PREFLIGHT = new URL("./preflight.mjs", import.meta.url);
const pinned = { node: "24", pnpm: "10" };

function runPreflight(env: Record<string, string>) {
  try {
    execFileSync(process.execPath, [PREFLIGHT.pathname], {
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: "pipe",
    });
    return { code: 0, stderr: "" };
  } catch (error) {
    const failure = error as { status: number; stderr: string };
    return { code: failure.status, stderr: failure.stderr };
  }
}

describe("TC-F00-78 [AC-F00-37] wrong tool version is refused", () => {
  it("refuses Node 20 with the exact instruction", () => {
    const result = runPreflight({ MEETAPP_FAKE_NODE_VERSION: "20.19.5", MEETAPP_FAKE_PNPM_VERSION: "10.34.6" });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Expected Node 24, found 20. Run `mise install`");
  });

  it("refuses pnpm 9 with the equivalent instruction", () => {
    const result = runPreflight({ MEETAPP_FAKE_NODE_VERSION: "24.21.0", MEETAPP_FAKE_PNPM_VERSION: "9.15.9" });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Expected pnpm 10, found 9. Run `mise install`");
  });

  it("accepts any Node 24 and pnpm 10 minor version", () => {
    expect(findVersionProblems({ node: "v24.0.0", pnpm: "10.0.1" }, pinned)).toEqual([]);
    expect(findVersionProblems({ node: "24.99.3", pnpm: "10.99.0" }, pinned)).toEqual([]);
  });

  it("reports a missing pnpm", () => {
    expect(findVersionProblems({ node: "24.21.0", pnpm: undefined }, pinned)).toEqual([
      "pnpm was not found. Run `mise install`",
    ]);
  });

  it("parses as JavaScript that Node 18 understands (ES2022 module)", () => {
    const source = readFileSync(PREFLIGHT, "utf8");
    expect(() => acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" })).not.toThrow();
  });
});

describe("TC-F00-79 [AC-F00-37] versions are pinned in one place", () => {
  const mise = readFileSync(new URL("../mise.toml", import.meta.url), "utf8");
  const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    packageManager: string;
  };

  it("mise.toml pins Node 24, pnpm 10 and Python 3.12", () => {
    expect(readPinnedMajors(mise)).toEqual({ node: "24", pnpm: "10" });
    expect(mise).toMatch(/^python\s*=\s*"3\.12\.\d+"/m);
  });

  it("packageManager matches the pnpm pinned in mise.toml", () => {
    const misePnpm = mise.match(/^pnpm\s*=\s*"([\d.]+)"/m)?.[1];
    expect(rootPackage.packageManager).toBe(`pnpm@${misePnpm}`);
  });

  it("every CI workflow installs tools with mise-action (directly or through the shared setup step)", () => {
    const folder = new URL("../.github/workflows/", import.meta.url);
    const setup = readFileSync(new URL("../.github/actions/setup/action.yml", import.meta.url), "utf8");
    expect(setup).toContain("jdx/mise-action");
    const workflows = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".yml")) : [];
    expect(workflows.length).toBeGreaterThan(0);
    for (const name of workflows) {
      const text = readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
      expect(text.includes("jdx/mise-action") || text.includes("./.github/actions/setup"), name).toBe(true);
    }
  });
});
