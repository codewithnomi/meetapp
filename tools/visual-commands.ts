// The command lines behind `pnpm test:visual` (tools/visual.ts), kept separate so they can be tested.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG = "tests/e2e/gallery/playwright.config.ts";
const PLATFORM = "linux/amd64";

/** The Playwright image always has the same version as the installed @playwright/test. */
export function playwrightImage(root: string): string {
  const manifest = join(root, "node_modules/@playwright/test/package.json");
  const { version } = JSON.parse(readFileSync(manifest, "utf8")) as { version: string };
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

/** Arguments for the Playwright command line; `update` rewrites every baseline. */
export function playwrightArgs(update: boolean): string[] {
  return ["node_modules/@playwright/test/cli.js", "test", "-c", CONFIG, ...(update ? ["--update-snapshots=all"] : [])];
}

/** `docker run` arguments: the repository is mounted at the same path, so every file path stays valid. */
export function dockerArgs(image: string, root: string, update: boolean): string[] {
  return [
    "run",
    "--rm",
    "--init",
    "--platform",
    PLATFORM,
    "--ipc=host",
    "-v",
    `${root}:${root}`,
    "-w",
    root,
    image,
    "node",
    ...playwrightArgs(update),
  ];
}
