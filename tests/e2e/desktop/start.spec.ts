// The window opens with the starter home screen (AC-F00-03), and fonts work offline with nothing
// fetched from Google or any other outside address (AC-F00-13b): TC-F00-09, 30, 31.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { launch, recordRequests } from "./desktop.ts";

const BUILT_ASSETS = fileURLToPath(new URL("../../../apps/web/dist/assets", import.meta.url));

test("TC-F00-09 [AC-F00-03] the window opens within 5 s with the starter home screen", async () => {
  const started = Date.now();
  const { app, page } = await launch();
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()))
    .toBe(true);
  expect(Date.now() - started).toBeLessThan(5000);

  await expect(page.getByRole("heading", { level: 1, name: "MeetApp" })).toBeVisible();
  await expect(page.getByText(/^Welcome/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await app.close();
});

test("TC-F00-30 [AC-F00-13b] fonts display with no internet, served from the app itself", async () => {
  const { app, page } = await launch();
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
  const requests = recordRequests(page);
  await page.reload();
  // Load both fonts (the code font isn't on the home screen yet); with the internet blocked they can
  // only come from the app itself.
  await page.evaluate(async () => {
    await document.fonts.load("16px Figtree");
    await document.fonts.load('16px "JetBrains Mono"');
    await document.fonts.ready;
  });

  const fonts = await page.evaluate(() => ({
    figtree: document.fonts.check("16px Figtree"),
    mono: document.fonts.check('16px "JetBrains Mono"'),
  }));
  const files = requests.filter((address) => address.endsWith(".woff2"));
  expect(fonts.figtree).toBe(true);
  expect(fonts.mono).toBe(true);
  expect(files.length).toBeGreaterThanOrEqual(2);
  for (const file of files) expect(file).toMatch(/^app:\/\/meetapp\/assets\//);
  await app.close();
});

test("TC-F00-31 [AC-F00-13b] nothing is fetched from Google or any outside address", async () => {
  const { app, page } = await launch();
  const addresses = recordRequests(page);
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  expect(addresses.length).toBeGreaterThan(0);
  for (const address of addresses) expect(address).toMatch(/^(app:\/\/meetapp\/|http:\/\/127\.0\.0\.1[:/])/);
  for (const file of readdirSync(BUILT_ASSETS).filter((name) => name.endsWith(".css")))
    expect(readFileSync(`${BUILT_ASSETS}/${file}`, "utf8")).not.toMatch(/googleapis|gstatic/);
  await app.close();
});
