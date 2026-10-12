// With crash reports switched on, the page still gets no Sentry bridge and no extra access
// (AC-F00-22, AC-F00-24, D040). The address is a dead local port, so nothing is ever sent.
import { expect, test } from "@playwright/test";
import { BRIDGE, bridgeKeys, closeApp, freshProfile, launch } from "./desktop.ts";

test("TC-F00-58 [AC-F00-24] with SENTRY_DSN set, the page's bridge is still only window.meetapp's platform and auth", async () => {
  const { app, page } = await launch(freshProfile(), { SENTRY_DSN: "http://public@127.0.0.1:9/1" });
  const inPage = await page.evaluate(() => ({
    sentryBridge: Object.keys(window).filter((key) => key.toLowerCase().includes("sentry")),
  }));
  expect(inPage).toEqual({ sentryBridge: [] });
  expect(await bridgeKeys(page)).toEqual(BRIDGE);
  await closeApp(app);
});
