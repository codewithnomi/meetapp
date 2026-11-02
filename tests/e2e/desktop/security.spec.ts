// The desktop app's security settings in the real app (AC-F00-24): TC-F00-58, 59, 60, 61; updated by
// F02 (TC-F02-113): camera and microphone are allowed for the app's own page (media.spec.ts).
import { expect, test } from "@playwright/test";
import { BRIDGE, bridgeKeys, closeApp, launch, type RunningApp } from "./desktop.ts";

// F03 adds KLIPY only: its image server for GIFs and its API for the app's own GIF search (D059).
// F14 adds the live line to the backend (ws), F15 the app's own WebAssembly for backgrounds (D073).
const DESIGN_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data: http://127.0.0.1:3000 https://static.klipy.com; " +
  "connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000 ws://127.0.0.1:7880 http://127.0.0.1:7880 https://api.klipy.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

let running: RunningApp;
// False until this test's app has started, so a failed start is reported as itself, not as a crash
// while closing the previous test's app.
let launched = false;
test.beforeEach(async () => {
  launched = false;
  running = await launch();
  launched = true;
  // No test may open the real browser: "open in browser" is recorded instead.
  await running.app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
});
test.afterEach(async () => {
  if (launched) await closeApp(running.app);
});

test("TC-F00-58 [AC-F00-24] sandbox, context isolation and no Node.js in the page", async () => {
  const { app, page } = running;
  // Playwright's bundled Electron types predate getLastWebPreferences, so it is reached by name.
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents as unknown as {
      getLastWebPreferences: () => object;
    };
    return contents.getLastWebPreferences();
  });
  expect(prefs).toMatchObject({
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    nodeIntegration: false,
    webviewTag: false,
  });
  const inPage = await page.evaluate(() => ({
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
  }));
  expect(inPage).toEqual({ require: "undefined", process: "undefined" });
  expect(await bridgeKeys(page)).toEqual(BRIDGE);
});

test("TC-F00-59 [AC-F00-24] outside addresses and new windows are blocked; only https goes to the browser", async () => {
  const { app, page } = running;
  const start = page.url();
  await page.evaluate(() => {
    window.open("https://example.com");
    window.open("file:///etc/passwd");
    location.href = "https://example.com";
  });
  await page.waitForTimeout(1000);

  expect(page.url()).toBe(start);
  expect(app.windows()).toHaveLength(1);
  expect(await app.evaluate(() => (globalThis as { opened?: string[] }).opened)).toEqual(["https://example.com/"]);
});

test("TC-F00-60 [AC-F00-24] notifications are refused", async () => {
  // Camera and microphone are F02's (media.spec.ts); asking for them here would turn on a real camera.
  expect(await running.page.evaluate(() => Notification.requestPermission())).toBe("denied");
});

test("TC-F00-61 [AC-F00-24] the security policy blocks inline and remote scripts", async () => {
  const { app, page } = running;
  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => violations.push(event.violatedDirective));
    const inline = document.createElement("script");
    inline.textContent = "window.pwned = 1";
    document.body.append(inline);
    const remote = document.createElement("script");
    remote.src = "https://evil.example/x.js";
    document.body.append(remote);
    await new Promise((done) => setTimeout(done, 500));
    return { pwned: (window as { pwned?: number }).pwned, violations };
  });
  expect(result.pwned).toBeUndefined();
  expect(result.violations.filter((directive) => directive.startsWith("script-src")).length).toBeGreaterThanOrEqual(2);

  const header = await app.evaluate(async ({ net }) =>
    (await net.fetch("app://meetapp/index.html")).headers.get("content-security-policy"),
  );
  expect(header).toBe(DESIGN_CSP);
});

test("TC-F00-59 [AC-F00-24] links, forms and embedded pages can't take the page outside the app", async () => {
  const { app, page } = running;
  const start = page.url();
  const violations = await page.evaluate(async () => {
    const seen: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => seen.push(event.violatedDirective));
    const link = Object.assign(document.createElement("a"), { href: "https://example.com", target: "_blank" });
    document.body.append(link);
    link.click();
    const form = Object.assign(document.createElement("form"), { action: "https://example.com", method: "post" });
    document.body.append(form);
    form.submit();
    const frame = Object.assign(document.createElement("iframe"), { src: "https://example.com" });
    document.body.append(frame);
    await new Promise((done) => setTimeout(done, 1000));
    return seen;
  });
  expect(page.url()).toBe(start);
  expect(app.windows()).toHaveLength(1);
  expect(violations).toEqual(expect.arrayContaining(["form-action", "frame-src"]));
});

test("TC-F00-60 [AC-F00-24] [AC-F02-54] permission checks: camera and microphone for the app's page, nothing else", async () => {
  const states = await running.page.evaluate(async () =>
    Promise.all(
      (["camera", "microphone", "notifications", "geolocation"] as PermissionName[]).map(
        async (name) => (await navigator.permissions.query({ name })).state,
      ),
    ),
  );
  expect(states).toEqual(["granted", "granted", "denied", "denied"]);
});
