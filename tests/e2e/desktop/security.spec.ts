// The desktop app's security settings in the real app (AC-F00-24): TC-F00-58, 59, 60, 61.
import { expect, test } from "@playwright/test";
import { launch, type RunningApp } from "./desktop.ts";

const DESIGN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; " +
  "connect-src 'self' http://127.0.0.1:3000; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

let running: RunningApp;
test.beforeEach(async () => {
  running = await launch();
  // No test may open the real browser: "open in browser" is recorded instead.
  await running.app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
});
test.afterEach(async () => running.app.close());

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
    bridge: Object.keys((window as { meetapp?: object }).meetapp ?? {}),
  }));
  expect(inPage).toEqual({ require: "undefined", process: "undefined", bridge: ["platform"] });
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

test("TC-F00-60 [AC-F00-24] camera, microphone and notifications are refused", async () => {
  const answers = await running.page.evaluate(async () => {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(
      () => "granted",
      (error: Error) => error.name,
    );
    return { media, notifications: await Notification.requestPermission() };
  });
  expect(answers.media).not.toBe("granted");
  expect(answers.notifications).toBe("denied");
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

test("TC-F00-60 [AC-F00-24] permission checks answer 'denied'", async () => {
  const states = await running.page.evaluate(async () =>
    Promise.all(
      (["camera", "microphone", "notifications", "geolocation"] as PermissionName[]).map(
        async (name) => (await navigator.permissions.query({ name })).state,
      ),
    ),
  );
  expect(states).toEqual(["denied", "denied", "denied", "denied"]);
});
