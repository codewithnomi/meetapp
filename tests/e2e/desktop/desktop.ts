// Starts the built desktop app for a test, each run with its own fresh profile folder (so saved
// settings start empty), and gives the main window.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, type ElectronApplication, type Page } from "@playwright/test";

const DESKTOP = fileURLToPath(new URL("../../../apps/desktop", import.meta.url));

/**
 * Shell settings that must not reach the tested app: VS Code sets ELECTRON_RUN_AS_NODE (Electron would
 * start as plain Node.js), and the others would change what is tested or send crash reports.
 */
const LEFT_OUT = new Set(["ELECTRON_RUN_AS_NODE", "MEETAPP_RENDERER_URL", "VITE_API_URL", "SENTRY_DSN"]);

export interface RunningApp {
  app: ElectronApplication;
  page: Page;
}

export function freshProfile(): string {
  return mkdtempSync(join(tmpdir(), "meetapp-e2e-"));
}

export async function launch(
  profile: string = freshProfile(),
  extraEnv: Record<string, string> = {},
): Promise<RunningApp> {
  const env: Record<string, string> = { ...extraEnv, MEETAPP_USER_DATA_DIR: profile };
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && !(key in env) && !LEFT_OUT.has(key)) env[key] = value;
  const app = await _electron.launch({ args: [DESKTOP], cwd: DESKTOP, env });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

/** The value a CSS color (e.g. "var(--accent)") has right now, in the same format the browser reports. */
export async function resolvedColor(page: Page, css: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, css);
}

export async function htmlData(page: Page): Promise<{ theme?: string; accent?: string }> {
  return page.evaluate(() => ({ ...document.documentElement.dataset }));
}

/** Every address the window asks for from now on (the browser's own timing list skips app:// files). */
export function recordRequests(page: Page): string[] {
  const addresses: string[] = [];
  page.on("request", (request) => addresses.push(request.url()));
  return addresses;
}
