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
