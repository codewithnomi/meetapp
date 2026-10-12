// Starts the built desktop app for a test, each run with its own fresh profile folder (so saved
// settings start empty), and gives the main window. Every app a test starts is closed after the test,
// even when the test failed, and force-stopped if it doesn't exit: a leftover app from one test once
// showed up in the next (found in the F00 verification).
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

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

/**
 * Everything the page may reach on `window.meetapp` (F00 design section 5, F01 design section 4): the
 * platform name and the sign-in calls main makes for the page. Anything else is a leak.
 */
export const BRIDGE = {
  meetapp: ["platform", "auth"],
  auth: [
    "signInWithPassword",
    "requestCode",
    "signInWithCode",
    "startSignUp",
    "resendSignUpCode",
    "finishSignUp",
    "resetPassword",
    "changePassword",
    "signOut",
    "signOutEverywhere",
    "status",
  ],
};

/** What the page sees on `window.meetapp`: its keys, and the keys of `window.meetapp.auth`. */
export function bridgeKeys(page: Page): Promise<{ meetapp: string[]; auth: string[] }> {
  return page.evaluate(() => {
    const bridge = (window as { meetapp?: { auth?: object } }).meetapp ?? {};
    return { meetapp: Object.keys(bridge), auth: Object.keys(bridge.auth ?? {}) };
  });
}

/** The newest 6-digit code sent to `email` after `since`, from Mailpit (MEETAPP_E2E_MAILPIT_URL). */
export async function codeFor(email: string, since: Date): Promise<string> {
  const mailpit = process.env["MEETAPP_E2E_MAILPIT_URL"];
  for (let attempt = 0; attempt < 50; attempt++) {
    const query = encodeURIComponent(`to:"${email}"`);
    const found = (await (await fetch(`${mailpit}/api/v1/search?query=${query}`)).json()) as {
      messages: { Subject: string; Created: string }[];
    };
    const code = found.messages
      .filter((message) => new Date(message.Created) >= since)
      .map((message) => /\b(\d{6})\b/.exec(message.Subject)?.[1])
      .find(Boolean);
    if (code) return code;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`no code email to ${email}`);
}

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const MAILPIT = process.env["MEETAPP_E2E_MAILPIT_URL"];

interface AuthBridgeForTests {
  startSignUp: (form: object) => Promise<{ ok: boolean; signupId?: string }>;
  finishSignUp: (signupId: string, code: string) => Promise<{ ok: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean }>;
}
type WindowWithBridge = Window & { meetapp: { auth: AuthBridgeForTests } };

const TEST_PASSWORD = "correct horse battery";

/** One account per test run, kept next to the run's profile folders (the backend allows 50 sign-ups an hour). */
function accountFile(): string {
  return join(process.env["MEETAPP_E2E_PROFILES"] ?? tmpdir(), "signed-in-account.txt");
}

/** Creates an account through the app's bridge, with the code from the fake inbox. */
async function signUpThroughBridge(page: Page, email: string): Promise<void> {
  const since = new Date();
  const started = await page.evaluate(
    ([address, password]) =>
      (window as unknown as WindowWithBridge).meetapp.auth.startSignUp({
        email: address,
        name: "E2E Person",
        password,
        termsAccepted: true,
      }),
    [email, TEST_PASSWORD] as const,
  );
  const code = await codeFor(email, since);
  await page.evaluate(([id, value]) => (window as unknown as WindowWithBridge).meetapp.auth.finishSignUp(id, value), [
    started.signupId ?? "",
    code,
  ] as const);
}

/**
 * Since F01 the app opens on Sign in until someone is signed in. Tests of the signed-in screens (Home,
 * Settings) start the app against the test backend and sign in through the app's own bridge: the run's
 * first such test creates the account (code from the fake inbox), later ones sign in with its password.
 * Skipped when `pnpm test` didn't provide the backend.
 */
export async function launchSignedIn(profile: string = freshProfile(), extraEnv: Record<string, string> = {}) {
  test.skip(!API_URL || !MAILPIT, "needs the backend and Mailpit; runs from `pnpm test`");
  const running = await launch(profile, { ...extraEnv, VITE_API_URL: API_URL ?? "" });
  const file = accountFile();
  if (existsSync(file)) {
    const email = readFileSync(file, "utf8");
    await running.page.evaluate(
      ([address, password]) =>
        (window as unknown as WindowWithBridge).meetapp.auth.signInWithPassword(address, password),
      [email, TEST_PASSWORD] as const,
    );
  } else {
    const email = `e2e-${randomUUID()}@example.test`;
    await signUpThroughBridge(running.page, email);
    writeFileSync(file, email);
  }
  // The screens ask who is signed in when they start.
  await running.page.reload();
  await expect(running.page.getByRole("heading", { level: 1, name: "MeetApp" })).toBeVisible();
  return running;
}
