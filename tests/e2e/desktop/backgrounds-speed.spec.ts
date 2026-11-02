// Background effect speed on the reference Mac (F15 TC-F15-78, AC-F15-30, 31). Run by hand on the
// reference computer with a 720p camera (`node tools/test.ts --only desktop -- backgrounds-speed`); it is
// skipped unless MEETAPP_REFERENCE_MAC=1, because speed on other computers says nothing.
import { expect, test } from "@playwright/test";
import { FAKE_MEDIA, launchNewAccount } from "./desktop.ts";

test.skip(process.env["MEETAPP_REFERENCE_MAC"] !== "1", "reference Mac only");
test.describe.configure({ timeout: 240_000 });

test("TC-F15-78 [AC-F15-30, AC-F15-31] blur and a picture keep 15 frames a second for 60 seconds, switching is quick", async () => {
  const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const { page } = me;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();

  // Frames the preview really shows, counted in the page.
  await page.evaluate(() => {
    const w = window as unknown as { shown: number };
    w.shown = 0;
    const el = document.querySelector("video") as HTMLVideoElement;
    const tick = () => {
      w.shown++;
      el.requestVideoFrameCallback(tick);
    };
    el.requestVideoFrameCallback(tick);
  });
  const shown = () => page.evaluate(() => (window as unknown as { shown: number }).shown);

  for (const name of ["Blur", "Office"]) {
    const before = Date.now();
    await page.getByRole("radio", { name }).click();
    await expect(page.getByRole("radio", { name })).toBeChecked();
    expect(Date.now() - before).toBeLessThan(1000);
    const start = await shown();
    await page.waitForTimeout(60_000);
    expect(((await shown()) - start) / 60).toBeGreaterThanOrEqual(15);
    await expect(page.getByText("Background turned off to keep your video smooth")).toHaveCount(0);
  }
});
