// Backgrounds stay on the computer (F15 TC-F15-49, AC-F15-30). Needs the backend and Mailpit (`pnpm test`).
// Written for the fake camera; the other person's window receiving the processed video is covered by the
// call tests (TC-F15-78 measures the speed).
import { expect, test } from "@playwright/test";
import { FAKE_MEDIA, launchNewAccount, recordRequests } from "./desktop.ts";

test.describe.configure({ timeout: 180_000 });

const CHOICES = [
  "Blur",
  "Office",
  "Living room",
  "Bookshelf",
  "Café",
  "Nature",
  "City view",
  "Calm waves",
  "Soft shapes",
  "None",
];

test("TC-F15-49 [AC-F15-30] blur and every picture load only from the app itself", async () => {
  const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const { page } = me;
  const requests = recordRequests(page);
  const origin = new URL(page.url()).origin;

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
  for (const name of CHOICES) {
    await page.getByRole("radio", { name }).click();
    await expect(page.getByRole("radio", { name })).toBeChecked();
    // Let the preview start the tool and show the new choice.
    await page.waitForTimeout(1500);
  }

  const pictures = requests.filter((url) => url.includes("/backgrounds/"));
  expect(pictures.length).toBeGreaterThan(0);
  for (const url of pictures) expect(new URL(url).origin).toBe(origin);
  // The model and the engine files come from the app too.
  expect(pictures.some((url) => url.endsWith("selfie_segmenter.tflite"))).toBe(true);
  expect(pictures.some((url) => url.includes("/backgrounds/wasm/"))).toBe(true);
  // Nothing went to an outside address because of a background (the app's own server is allowed).
  const outside = requests.filter((url) => {
    const { origin: from, protocol } = new URL(url);
    return (
      from !== origin &&
      !["data:", "blob:", "devtools:"].includes(protocol) &&
      /storage\.googleapis|jsdelivr|unpkg|cdn|mediapipe/i.test(url)
    );
  });
  expect(outside).toEqual([]);
});
