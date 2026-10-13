// People, invitations, join requests and removal in the real desktop app (F01 T15): TC-F01-48 invite by
// email, the invitation page and Join; TC-F01-53 ask to join with the code and approve; TC-F01-61 a
// removed (or leaving) member's open window moves to Personal and says so within a minute. Each test
// uses accounts of its own. Needs the backend and Mailpit, so it runs from `pnpm test`.
import { randomUUID } from "node:crypto";
import { expect, request, test, type Page } from "@playwright/test";
import { freshProfile, launchAs, launchNewAccount } from "./desktop.ts";
import { createWorkspace, emailText, inviteByEmail, openScreen, switcher, title } from "./workspace-steps.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";
/** The app checks /me and open lists every 30 seconds; a change must show within a minute. */
const WITHIN_A_MINUTE = { timeout: 65_000 };

async function openJoinScreen(page: Page, openName: string) {
  await switcher(page, openName).click();
  await page.getByRole("menuitem", { name: "Join with a link or code" }).click();
  await expect(title(page, "Join a workspace")).toBeVisible();
}

/** Join screen: presses Join on the invitation; the workspace opens. */
async function acceptInvitation(page: Page, from: string, workspace: string) {
  await openJoinScreen(page, from);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(title(page, workspace)).toBeVisible();
}

/** The invitation email's button leads to a small web page that names the workspace. */
async function checkInvitationPage(email: string, since: Date, workspace: string) {
  const text = await emailText(email, since);
  const link = /https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/.exec(text)?.[0] ?? "";
  expect(link).not.toBe("");
  const browser = await request.newContext();
  const page = await browser.get(`${API_URL}${new URL(link).pathname}`);
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(html).toContain(workspace);
  expect(html).toContain("E2E Person");
  await browser.dispose();
}

test("TC-F01-48 [AC-F01-17, AC-F01-18] invite by email, the page names the workspace, Join adds it with the role", async () => {
  test.setTimeout(180_000);
  const owner = await launchNewAccount();
  await createWorkspace(owner.page, "Personal", "Invite Co");
  const visitor = `e2e-${randomUUID()}@example.test`;
  const since = new Date();
  await inviteByEmail(owner.page, visitor);
  await checkInvitationPage(visitor, since, "Invite Co");

  const guest = await launchNewAccount(freshProfile(), visitor);
  await acceptInvitation(guest.page, "Personal", "Invite Co");
  await switcher(guest.page, "Invite Co").click();
  await expect(guest.page.getByRole("menuitemradio", { name: /Invite Co/ })).toContainText("Member");
  await guest.page.keyboard.press("Escape");

  await expect(owner.page.getByRole("row", { name: new RegExp(visitor) })).toBeVisible(WITHIN_A_MINUTE);
  await openScreen(owner.page, "Requests and invitations");
  await expect(owner.page.getByText("No invitations are waiting for an answer.")).toBeVisible();
});

/** People screen: turns the join link on and reads the code shown (e.g. "ABCDE-FGHJK"). */
async function turnOnJoinCode(page: Page): Promise<string> {
  await openScreen(page, "People");
  await page.getByRole("switch", { name: "Join link and code" }).click();
  const code = page.getByText(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  await expect(code).toBeVisible();
  return (await code.textContent()) ?? "";
}

test("TC-F01-53 [AC-F01-19] ask to join with the code; the owner approves; the workspace appears as member", async () => {
  test.setTimeout(180_000);
  const owner = await launchNewAccount();
  await createWorkspace(owner.page, "Personal", "Code Co");
  const code = await turnOnJoinCode(owner.page);

  const asker = await launchNewAccount();
  await openJoinScreen(asker.page, "Personal");
  await asker.page.getByRole("textbox", { name: "Join link or code" }).fill(code.toLowerCase());
  await asker.page.getByRole("button", { name: "Find workspace" }).click();
  await expect(asker.page.getByText("1 person · you'll join as a member")).toBeVisible();
  await asker.page.getByRole("button", { name: "Ask to join" }).click();
  await expect(asker.page.getByText("Request sent")).toBeVisible();

  await openScreen(owner.page, "Requests and invitations");
  const request = owner.page.getByRole("listitem").filter({ hasText: asker.email });
  await expect(request).toContainText("E2E Person", WITHIN_A_MINUTE);
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(owner.page.getByText("Nobody is asking to join right now.")).toBeVisible();

  await asker.page.getByRole("button", { name: "Back" }).click();
  await switcher(asker.page, "Personal").click();
  await expect(asker.page.getByRole("menuitemradio", { name: /Code Co/ })).toContainText("Member", WITHIN_A_MINUTE);
});

/** The member's open window moves to Personal and says why. */
async function expectMovedToPersonal(page: Page, workspace: string) {
  await expect(page.getByText(`You are no longer a member of ${workspace}.`)).toBeVisible(WITHIN_A_MINUTE);
  await expect(title(page, "Personal")).toBeVisible();
}

/** Someone's own (or another's) row menu on the People screen, then the confirming button. */
async function chooseAndConfirm(page: Page, action: string, confirm: string) {
  await openScreen(page, "People");
  await page.getByRole("button", { name: "Actions for E2E Person" }).click(WITHIN_A_MINUTE);
  await page.getByRole("menuitem", { name: action }).click();
  await page.getByRole("dialog").getByRole("button", { name: confirm }).click();
}

test("TC-F01-61 [AC-F01-23] removed while the app is open, or leaving from a second window: Personal within a minute", async () => {
  test.setTimeout(300_000);
  const owner = await launchNewAccount();
  await createWorkspace(owner.page, "Personal", "Leave Co");
  const member = await launchNewAccount();
  await inviteByEmail(owner.page, member.email);
  await acceptInvitation(member.page, "Personal", "Leave Co");

  await chooseAndConfirm(owner.page, "Remove from workspace", "Remove");
  await expectMovedToPersonal(member.page, "Leave Co");

  await member.page.getByRole("button", { name: "Dismiss" }).click();
  await inviteByEmail(owner.page, member.email);
  await acceptInvitation(member.page, "Personal", "Leave Co");
  const second = await launchAs(member.email);
  await expect(title(second.page, "Leave Co")).toBeVisible();
  await chooseAndConfirm(second.page, "Leave workspace", "Leave workspace");
  await expect(title(second.page, "Personal")).toBeVisible();
  await expectMovedToPersonal(member.page, "Leave Co");
  await expect(second.page.getByText(/no longer a member/)).toHaveCount(0);
});
