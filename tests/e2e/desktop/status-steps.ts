// F04: picking a status from the picture menu at the top right, as a person does.
import type { Page } from "@playwright/test";
import type { RunningApp } from "./desktop.ts";

/** Moves the pointer onto an item in small steps and clicks it. A real mouse travels from the
 * sub-menu's opener to its item; one jump (Playwright's default) makes the menu think the pointer
 * left it, and it closes. */
async function choose(page: Page, role: "menuitemradio" | "menuitem", name: string) {
  const item = page.getByRole(role, { name });
  const box = await item.boundingBox();
  if (!box) throw new Error(`no menu item ${name}`);
  // Sideways into the sub-menu first, then down it, as a person does: a straight line to an item low
  // in the list crosses the main menu's own items, which closes the sub-menu.
  const list = await item.locator("xpath=ancestor::*[@role='menu'][1]").boundingBox();
  const x = box.x + box.width / 2;
  await page.mouse.move(x, (list?.y ?? box.y) + 12, { steps: 10 });
  await page.mouse.move(x, box.y + box.height / 2, { steps: 10 });
  await item.click();
}

/** Picks a status (and for how long); null resets it. A duration is chosen first (it closes the
 * menu), then the status, which keeps it. */
export async function pickStatus(page: Page, status: string | null, duration?: string): Promise<void> {
  await page.getByRole("button", { name: /^Your account: / }).click();
  await page.getByRole("menuitem", { name: /Available|Busy|Do not disturb|Be right back|Away|In a call/ }).click();
  if (duration) {
    await choose(page, "menuitemradio", duration);
    return pickStatus(page, status);
  }
  if (status) await choose(page, "menuitemradio", status);
  else await choose(page, "menuitem", "Reset status");
}

/** What the menu-bar menu's Status items send to the main window (AC-F04-05): the way to set a status
 * while a meeting fills the screen. */
export const statusFromMenuBar = (running: RunningApp, status: string) =>
  running.app.evaluate(({ BrowserWindow }, chosen) => {
    const main = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[0];
    main?.webContents.send("meetapp:app", { kind: "status", status: chosen });
  }, status);
