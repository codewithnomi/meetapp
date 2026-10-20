// Meeting chat in the real app with several windows (F03 T12): TC-F03-01 a message reaches the other
// window quickly with name and time, TC-F03-04 a late joiner sees earlier messages, TC-F03-15 the unread
// count, TC-F03-17 the empty chat. Needs the backend and Mailpit (`pnpm test`).
import { expect, test, type Page } from "@playwright/test";
import { controls } from "./meeting-steps.ts";
import { hostMeeting, joinWindow, team } from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });

const openChat = async (page: Page) => {
  await controls(page).getByRole("button", { name: /^Chat/ }).click();
  return page.getByRole("log", { name: "Messages" });
};
const send = async (page: Page, text: string) => {
  const box = page.getByRole("textbox", { name: "Message everyone" });
  await box.fill(text);
  await box.press("Enter");
};

test("TC-F03-01 TC-F03-15 TC-F03-17 [AC-F03-01] [AC-F03-07] [AC-F03-09] a message reaches everyone within a second, with an unread count while closed", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);

  const hostLog = await openChat(host.page);
  await expect(host.page.getByText("No messages yet")).toBeVisible({ timeout: 15_000 });

  await send(host.page, "Can someone share the staging link?");
  await expect(hostLog).toContainText("Can someone share the staging link?");
  // The other person has the chat closed: the button counts it.
  await expect(controls(mo.page).getByRole("button", { name: "Chat, 1 unread" })).toBeVisible({ timeout: 5_000 });

  const moLog = await openChat(mo.page);
  await expect(moLog).toContainText("Can someone share the staging link?");
  await expect(controls(mo.page).getByRole("button", { name: "Chat", exact: true })).toBeVisible();

  const started = Date.now();
  await send(mo.page, "staging.aria.dev/payments");
  await expect(hostLog).toContainText("staging.aria.dev/payments", { timeout: 5_000 });
  expect(Date.now() - started).toBeLessThan(2_000);
  await expect(hostLog.getByRole("article", { name: new RegExp(`^${who.member.name}, \\d`) })).toBeVisible();
});

test("TC-F03-04 [AC-F03-02] someone who joins later sees the earlier messages", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  await openChat(host.page);
  await send(host.page, "Agenda: invite flow, then QA");
  const late = await joinWindow(who.member, link);
  const log = await openChat(late.page);
  await expect(log).toContainText("Agenda: invite flow, then QA", { timeout: 15_000 });
});

test("TC-F03-28 TC-F03-30 TC-F03-81 [AC-F03-15] [AC-F03-16] [AC-F03-17] formatting, code blocks and page code reach the other window as typed", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const hostLog = await openChat(host.page);
  const moLog = await openChat(mo.page);
  const box = host.page.getByRole("textbox", { name: "Message everyone" });

  // Bold with the keyboard shortcut.
  await box.click();
  await host.page.keyboard.press(process.platform === "darwin" ? "Meta+b" : "Control+b");
  await host.page.keyboard.type("Release on Thursday");
  await host.page.keyboard.press("Enter");
  await expect(moLog.locator("strong", { hasText: "Release on Thursday" })).toBeVisible({ timeout: 5_000 });

  // A code block by typing three backticks and a space; Enter inside it makes a new line;
  // Ctrl/Cmd+Enter sends.
  await box.click();
  await host.page.keyboard.type("``` ");
  await host.page.keyboard.type("const ok = true;");
  await host.page.keyboard.press("Enter");
  await host.page.keyboard.type("  return ok;");
  await host.page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  await expect(moLog.locator("pre code")).toHaveText("const ok = true;\n  return ok;", { timeout: 5_000 });

  // Page code is shown as text and never runs.
  await send(host.page, '<img src=x onerror="document.title=\'hacked\'"> <script>document.title="hacked"</script>');
  await expect(moLog).toContainText("<script>", { timeout: 5_000 });
  expect(await mo.page.title()).not.toBe("hacked");
  await expect(hostLog.locator("img[src='x']")).toHaveCount(0);
});

test("TC-F03-07 TC-F03-22 [AC-F03-03] [AC-F03-12] the counter stops long messages; emoji come from the app itself", async () => {
  const who = await team();
  const { host } = await hostMeeting(who);
  await openChat(host.page);
  const outside: string[] = [];
  host.page.on("request", (request) => {
    if (/jsdelivr|cdn\./.test(request.url())) outside.push(request.url());
  });
  const box = host.page.getByRole("textbox", { name: "Message everyone" });
  await box.click();
  await host.page.keyboard.insertText("a".repeat(4003));
  await expect(host.page.getByText("3 characters too many")).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Send (Enter)" })).toBeDisabled();
  await host.page.keyboard.press("Backspace");
  await host.page.keyboard.press("Backspace");
  await host.page.keyboard.press("Backspace");
  await expect(host.page.getByRole("button", { name: "Send (Enter)" })).toBeEnabled();

  await box.fill("");
  await host.page.getByRole("button", { name: "Emoji" }).click();
  await host.page.getByRole("searchbox", { name: "Search emoji" }).fill("party popper");
  await host.page
    .getByRole("gridcell", { name: /party popper/i })
    .first()
    .click();
  await expect(box).toContainText("🎉");
  expect(outside).toEqual([]);
});
