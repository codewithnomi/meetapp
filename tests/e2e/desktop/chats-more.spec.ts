// F14 T16: chat requests, mentions, typing, status and the folding menu in the real desktop app
// (TC-F14-17, 46, 53, 82; AC-F14-10, 11, 22, 23, 26, 36).
import { expect, test, type Page } from "@playwright/test";
import { closeApp, freshProfile, launchAs, type RunningApp } from "./desktop.ts";
import { team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

async function inWorkspace(page: Page, workspace: string) {
  await expect(page.getByRole("button", { name: /^Switch workspace: / })).toBeVisible();
  if (await switcher(page, workspace).isVisible()) return;
  await switchTo(page, "Personal", workspace);
}

/** Opens (or starts) the one-to-one chat with `name` through New chat. */
async function chatWith(page: Page, query: string, name: RegExp) {
  await openScreen(page, "Chat");
  await page.getByRole("button", { name: "New chat" }).first().click();
  await page.getByRole("combobox", { name: "To:" }).fill(query);
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Start chat" }).click();
}

async function say(page: Page, box: string, text: string) {
  const field = page.getByRole("textbox", { name: box });
  await field.fill(text);
  await field.press("Enter");
}

test("TC-F14-17 [AC-F14-10, AC-F14-11] someone outside gets a request, previews and accepts", async () => {
  test.setTimeout(120_000);
  const { workspace, owner, outsider } = await team();
  const [olivia, xena] = await Promise.all([windowFor(owner), windowFor(outsider)]);
  windows.push(olivia, xena);
  await inWorkspace(olivia.page, workspace);
  await chatWith(olivia.page, outsider.email, /Xena Outsider/);
  await say(olivia.page, "Message Xena Outsider", "Hello from the team");
  await expect(olivia.page.getByText("Waiting for Xena Outsider to accept")).toBeVisible({ timeout: 10_000 });

  await openScreen(xena.page, "Chat");
  await xena.page.getByRole("button", { name: /^Chat requests/ }).click();
  const card = xena.page.getByRole("region", { name: /Olivia Owner/ });
  await expect(card).toContainText("(External)");
  await card.getByRole("button", { name: "Preview messages" }).click();
  await expect(card.getByRole("log", { name: "Preview of messages" })).toContainText("Hello from the team");
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(xena.page.getByRole("log", { name: "Messages" })).toContainText("Hello from the team");
  await say(xena.page, "Message Olivia Owner", "Hi, accepted");
  await expect(olivia.page.getByRole("log", { name: "Messages" })).toContainText("Hi, accepted", { timeout: 5000 });
});

test("TC-F14-46 [AC-F14-22, AC-F14-23] an @mention is highlighted; typing shows and goes", async () => {
  test.setTimeout(120_000);
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await chatWith(mo.page, "Olivia", /Olivia Owner/);

  const box = olivia.page.getByRole("textbox", { name: "Message Mo Member" });
  await box.click();
  await box.pressSequentially("Look @Mo");
  await expect(olivia.page.getByRole("listbox", { name: "People in this chat" })).toBeVisible();
  await box.press("Enter");
  await box.press("Enter");
  const log = mo.page.getByRole("log", { name: "Messages" });
  await expect(log.locator(".text-accent-text", { hasText: "@Mo Member" })).toBeVisible({ timeout: 5000 });

  await mo.page.getByRole("textbox", { name: "Message Olivia Owner" }).pressSequentially("typing…");
  const typing = olivia.page.getByRole("status").filter({ hasText: "Mo Member is typing…" });
  await expect(typing).toBeVisible({ timeout: 3000 });
  await expect(typing).toBeHidden({ timeout: 9000 });
});

test("TC-F14-53 [AC-F14-26] status changes live: Available, Away when the computer locks, Offline", async () => {
  test.setTimeout(120_000);
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  await chatWith(olivia.page, "Mo", /Mo Member/);
  // The open chat (named after Mo); its header shows Mo's status dot.
  const header = olivia.page.getByRole("region", { name: "Mo Member" });
  await mo.page.keyboard.press("Shift");
  await expect(header.getByRole("img", { name: "Available" })).toBeVisible({ timeout: 10_000 });
  await mo.app.evaluate(({ powerMonitor }) => powerMonitor.emit("lock-screen"));
  await expect(header.getByRole("img", { name: "Away" })).toBeVisible({ timeout: 10_000 });
  await mo.app.evaluate(({ powerMonitor }) => powerMonitor.emit("unlock-screen"));
  await expect(header.getByRole("img", { name: "Available" })).toBeVisible({ timeout: 10_000 });
  await closeApp(mo.app);
  // Offline 30 seconds after the last line closed (a grace for reconnects).
  await expect(header.getByRole("img", { name: "Offline" })).toBeVisible({ timeout: 60_000 });
});

test("TC-F14-82 [AC-F14-36] the folded menu shows icons with tooltips and stays folded after a restart", async () => {
  test.setTimeout(120_000);
  const { owner } = await team();
  const profile = freshProfile();
  const first = await launchAs(owner.email, profile);
  windows.push(first);
  const nav = first.page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: "Collapse menu" }).click();
  await expect(nav).toHaveAttribute("data-folded", "true");
  await nav.getByRole("button", { name: /^Chat/ }).hover();
  await expect(first.page.getByRole("tooltip")).toHaveText("Chat");
  await closeApp(first.app);
  windows = [];
  const again = await launchAs(owner.email, profile);
  windows.push(again);
  const navAgain = again.page.getByRole("navigation", { name: "Main" });
  await expect(navAgain).toHaveAttribute("data-folded", "true");
  await navAgain.getByRole("button", { name: "Expand menu" }).click();
  await expect(navAgain).toContainText("Chat");
});
