// Steps shared by the tests with F16's small call windows (call-windows.spec.ts) and F04's close and quit
// tests (app-life.spec.ts).
import { expect, type ElectronApplication, type Page } from "@playwright/test";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

export const SMALL = "call-window.html";
export const smallPages = (app: ElectronApplication) => app.windows().filter((page) => page.url().includes(SMALL));
export const ringWindow = (page: Page) => page.getByRole("dialog", { name: /^Incoming (video|audio) call from / });
/** Minimizes (true) or brings back (false) every main MeetApp window of this app. */
export async function putAway(app: ElectronApplication, away: boolean): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [page, hide]) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.webContents.getURL().includes(page as string)) continue;
        if (hide) {
          window.minimize();
        } else {
          window.restore();
          window.show();
          window.focus();
        }
      }
    },
    [SMALL, away] as const,
  );
}
export async function inWorkspace(page: Page, workspace: string) {
  await expect(page.getByRole("button", { name: /^Switch workspace: / })).toBeVisible();
  if (await switcher(page, workspace).isVisible()) return;
  await switchTo(page, "Personal", workspace);
}
export async function chatWith(page: Page, query: string, name: RegExp) {
  await openScreen(page, "Chat");
  await page.getByRole("button", { name: "New chat" }).first().click();
  await page.getByRole("combobox", { name: "To:" }).fill(query);
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Start chat" }).click();
}
export async function firstSmall(app: ElectronApplication): Promise<Page> {
  await expect.poll(() => smallPages(app).length, { timeout: 5_000 }).toBeGreaterThan(0);
  const page = smallPages(app)[0] as Page;
  await expect(ringWindow(page)).toBeVisible();
  return page;
}
