// With crash reports switched on, the page still gets no Sentry bridge and no extra access
// (AC-F00-22, AC-F00-24, D040). The address is a dead local port, so nothing is ever sent.
import { expect, test } from "@playwright/test";
import { freshProfile, launch } from "./desktop.ts";

test("TC-F00-58 [AC-F00-24] with SENTRY_DSN set, the page's only bridge is still window.meetapp.platform", async () => {
  const { app, page } = await launch(freshProfile(), { SENTRY_DSN: "http://public@127.0.0.1:9/1" });
  const inPage = await page.evaluate(() => ({
    sentryBridge: Object.keys(window).filter((key) => key.toLowerCase().includes("sentry")),
    bridge: Object.keys((window as { meetapp?: object }).meetapp ?? {}),
  }));
  expect(inPage).toEqual({ sentryBridge: [], bridge: ["platform"] });
  await app.close();
});
