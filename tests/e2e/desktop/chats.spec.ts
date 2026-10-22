// F14 T15 (milestone): the Chat screen in the real desktop app. A new person's empty list (TC-F14-10);
// two people in one workspace: a chat is started from New chat, a message arrives live in the other
// window, the side menu's Chat badge and the bold row show it, and opening the chat clears them
// (TC-F14-04, AC-F14-01, 02, 07, 09, 20).
import { expect, test, type Page } from "@playwright/test";
import { closeApp, launchNewAccount, type RunningApp } from "./desktop.ts";
import { team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

/** The app reopens the last-used workspace; switch only when another one is open. */
async function inWorkspace(page: Page, workspace: string) {
  await expect(page.getByRole("button", { name: /^Switch workspace: / })).toBeVisible();
  if (await switcher(page, workspace).isVisible()) return;
  await switchTo(page, "Personal", workspace);
}

/** The number on the side menu's Chat item (0 when none). */
async function unreadOf(page: Page): Promise<number> {
  const name = (await chatItem(page).getAttribute("aria-label")) ?? "Chat";
  const count = /^Chat (\d+)/.exec(name)?.[1];
  return count ? Number(count) : 0;
}

const chatItem = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /^Chat/ });

test("TC-F14-10 [AC-F14-06] a new person's Chat says No chats yet, and New chat opens", async () => {
  const running = await launchNewAccount();
  windows.push(running);
  const { page } = running;
  await openScreen(page, "Chat");
  await expect(page.getByText("No chats yet")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).last().click();
  await expect(page.getByRole("heading", { level: 1, name: "New chat" })).toBeVisible();
});

test("TC-F14-04 [AC-F14-02, AC-F14-07, AC-F14-20] a message arrives live; the badge and bold row clear on opening", async () => {
  test.setTimeout(120_000);
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await inWorkspace(olivia.page, workspace);
  await inWorkspace(mo.page, workspace);

  // Mo's count before (meeting chats from other tests may be unread too, as in Teams).
  await expect(chatItem(mo.page)).toBeVisible();
  await mo.page.waitForTimeout(1500);
  const before = await unreadOf(mo.page);
  // Olivia starts a chat with Mo from New chat and says hello.
  await openScreen(olivia.page, "Chat");
  await olivia.page.getByRole("button", { name: "New chat" }).first().click();
  await olivia.page.getByRole("combobox", { name: "To:" }).fill("Mo");
  await olivia.page.getByRole("option", { name: /Mo Member/ }).click();
  await olivia.page.getByRole("button", { name: "Start chat" }).click();
  const box = olivia.page.getByRole("textbox", { name: "Message Mo Member" });
  await box.fill("Hello Mo");
  await box.press("Enter");

  // Mo is on Home: the Chat item counts one more; the row is bold with 1; opening it clears both.
  await expect.poll(() => unreadOf(mo.page), { timeout: 10_000 }).toBe(before + 1);
  await openScreen(mo.page, "Chat");
  const row = mo.page.getByRole("button", { name: /^Olivia Owner, 1 unread/ });
  await expect(row).toBeVisible();
  await row.click();
  await expect(mo.page.getByRole("log", { name: "Messages" })).toContainText("Hello Mo");
  await expect.poll(() => unreadOf(mo.page), { timeout: 10_000 }).toBe(before);

  // Mo's answer reaches Olivia's open chat live.
  const reply = mo.page.getByRole("textbox", { name: "Message Olivia Owner" });
  await reply.fill("Hi Olivia");
  await reply.press("Enter");
  await expect(olivia.page.getByRole("log", { name: "Messages" })).toContainText("Hi Olivia", { timeout: 5000 });
});

test("TC-F14-40 [AC-F14-20] messages reach the other window within a second, without a call", async () => {
  test.setTimeout(180_000);
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  for (const [page, query, name] of [
    [olivia.page, "Mo", /Mo Member/],
    [mo.page, "Olivia", /Olivia Owner/],
  ] as const) {
    await openScreen(page, "Chat");
    await page.getByRole("button", { name: "New chat" }).first().click();
    await page.getByRole("combobox", { name: "To:" }).fill(query);
    await page.getByRole("option", { name }).click();
    await page.getByRole("button", { name: "Start chat" }).click();
  }
  const box = olivia.page.getByRole("textbox", { name: "Message Mo Member" });
  const log = mo.page.getByRole("log", { name: "Messages" });
  const times: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const text = `Speed check ${String(i)} ${String(Date.now())}`;
    await box.fill(text);
    const sent = Date.now();
    await box.press("Enter");
    await expect(log).toContainText(text, { timeout: 5000 });
    times.push(Date.now() - sent);
    // Stay under 10 messages in 10 seconds (AC-F14-19).
    await olivia.page.waitForTimeout(1100);
  }
  times.sort((a, b) => a - b);
  // 95% of messages within a second (AC-F14-20).
  expect(times[Math.ceil(times.length * 0.95) - 1]).toBeLessThan(1000);
});

test("TC-F14-50 [AC-F14-25] a message that couldn't be sent says so; Retry twice sends it once", async () => {
  test.setTimeout(120_000);
  const { workspace, owner, member } = await team();
  const olivia = await windowFor(owner);
  windows.push(olivia);
  await inWorkspace(olivia.page, workspace);
  await openScreen(olivia.page, "Chat");
  await olivia.page.getByRole("button", { name: "New chat" }).first().click();
  await olivia.page.getByRole("combobox", { name: "To:" }).fill("Mo");
  await olivia.page.getByRole("option", { name: /Mo Member/ }).click();
  await olivia.page.getByRole("button", { name: "Start chat" }).click();
  // The connection to the backend drops for sending.
  await olivia.page.route("**/api/v1/conversations/*/messages", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  const text = `Retry once ${String(Date.now())}`;
  const box = olivia.page.getByRole("textbox", { name: "Message Mo Member" });
  await box.fill(text);
  await box.press("Enter");
  const log = olivia.page.getByRole("log", { name: "Messages" });
  await expect(log.getByText("Not sent")).toBeVisible({ timeout: 15_000 });
  await olivia.page.unroute("**/api/v1/conversations/*/messages");
  const retry = olivia.page.getByRole("button", { name: /Retry/ }).first();
  await Promise.all([retry.click(), retry.click({ force: true }).catch(() => undefined)]);
  await expect(log.getByText("Not sent")).toBeHidden({ timeout: 10_000 });
  // Opened fresh, the chat holds the message once (the same client message id).
  const mo = await windowFor(member);
  windows.push(mo);
  await inWorkspace(mo.page, workspace);
  await openScreen(mo.page, "Chat");
  await mo.page
    .getByRole("button", { name: /^Olivia Owner/ })
    .first()
    .click();
  await expect(mo.page.getByRole("log", { name: "Messages" }).getByText(text)).toHaveCount(1);
});
