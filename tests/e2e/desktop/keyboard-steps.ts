// Keyboard-only steps shared by the keyboard passes (F01 TC-F01-72, F14 TC-F14-60).
import { expect, type Locator, type Page } from "@playwright/test";

/** Presses Tab until `target` has the focus (at most `limit` times), then checks the focus ring shows. */
export async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let presses = 0; presses < limit; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      expect(await target.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}
