// The `pnpm test:visual` command lines: the image always matches the installed Playwright, and the
// baselines are only rewritten when asked (AC-F00-33).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOT } from "./cli.ts";
import { CONFIG, dockerArgs, playwrightArgs, playwrightImage } from "./visual-commands.ts";

describe("pnpm test:visual", () => {
  it("uses the Playwright image with exactly the installed Playwright version", () => {
    const installed = (
      JSON.parse(readFileSync(`${ROOT}node_modules/@playwright/test/package.json`, "utf8")) as {
        version: string;
      }
    ).version;
    expect(playwrightImage(ROOT)).toBe(`mcr.microsoft.com/playwright:v${installed}-noble`);
  });

  it("pins Playwright to one exact version, so the image and the tests never drift apart", () => {
    const manifest = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies["@playwright/test"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("only rewrites baselines when asked", () => {
    expect(playwrightArgs(false)).not.toContain("--update-snapshots=all");
    expect(playwrightArgs(true)).toContain("--update-snapshots=all");
    expect(playwrightArgs(false)).toEqual(expect.arrayContaining(["-c", CONFIG]));
  });

  it("runs on linux/amd64 with the repository mounted at the same path", () => {
    const args = dockerArgs("image:1", "/repo", false);
    expect(args.join(" ")).toContain("--platform linux/amd64");
    expect(args.join(" ")).toContain("-v /repo:/repo -w /repo image:1 node");
    expect(args).toContain("--rm");
  });
});
