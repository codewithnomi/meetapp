// Starts the built desktop app for a test, each run with its own fresh profile folder (so saved
// settings start empty), and gives the main window. Every app a test starts is closed after the test,
// even when the test failed, and force-stopped if it doesn't exit: a leftover app from one test once
// showed up in the next (found in the F00 verification).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, test, type ElectronApplication, type Page } from "@playwright/test";

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

/** How long an app may take to quit before it is force-stopped. */
const CLOSE_MS = 10_000;
const started = new Set<ElectronApplication>();

/** A new, empty profile folder, inside this run's folder (deleted by global-teardown.ts). */
export function freshProfile(): string {
  return mkdtempSync(join(process.env["MEETAPP_E2E_PROFILES"] ?? tmpdir(), "meetapp-e2e-"));
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms).unref());

/** Quits the app and waits until its process has really ended; force-stops it after 10 s. */
export async function closeApp(app: ElectronApplication): Promise<void> {
  started.delete(app);
  const child = app.process();
  const ended = () => child.exitCode !== null || child.signalCode !== null;
  if (ended()) return;
  const exited = new Promise<void>((done) => child.once("exit", () => done()));
  await Promise.race([app.close().catch(() => undefined), wait(CLOSE_MS)]);
  if (!ended()) child.kill("SIGKILL");
  await Promise.race([exited, wait(CLOSE_MS)]);
}

// After every test: close whatever it left open (a failed check skips the test's own close).
test.afterEach(async () => {
  await Promise.all([...started].map(closeApp));
});

export async function launch(
  profile: string = freshProfile(),
  extraEnv: Record<string, string> = {},
): Promise<RunningApp> {
  const env: Record<string, string> = { ...extraEnv, MEETAPP_USER_DATA_DIR: profile };
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && !(key in env) && !LEFT_OUT.has(key)) env[key] = value;
  const app = await _electron.launch({ args: [DESKTOP], cwd: DESKTOP, env });
  started.add(app);
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
