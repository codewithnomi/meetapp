// F15 T15: inside a call started from a chat, in the real desktop app (TC-F15-28 in-call behaviour and the
// call's Chat panel, TC-F15-30 Add people). Olivia calls Mo, Mo accepts; both are then equal, with no
// organizer buttons. Reactions and hand are checked on the other person's window.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls, tile } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

test.describe.configure({ timeout: 240_000 });

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

async function chatWith(page: Page, query: string, name: RegExp) {
  await openScreen(page, "Chat");
  await page.getByRole("button", { name: "New chat" }).first().click();
  await page.getByRole("combobox", { name: "To:" }).fill(query);
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Start chat" }).click();
}

/** Olivia calls Mo from their chat and Mo accepts with video: both end up in the call. */
async function inCall() {
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await mo.page
    .getByRole("alertdialog", { name: "Incoming call" })
    .getByRole("button", { name: "Accept with video" })
    .click({ timeout: 15_000 });
  await Promise.all([olivia, mo].map((w) => expect(controls(w.page)).toBeVisible({ timeout: 25_000 })));
  return { olivia, mo };
}

test("TC-F15-28 [AC-F15-12] equal controls, hand and reactions reach the other person, no organizer buttons, Chat panel is the chat", async () => {
  const { olivia, mo } = await inCall();
  for (const { page } of [olivia, mo]) {
    await expect(page.getByRole("button", { name: "Meeting info" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mute/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Turn camera/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share screen" })).toBeVisible();
  }

  // Both can raise a hand; the other window sees it.
  await mo.page.getByRole("button", { name: /^Raise your hand/ }).click();
  await expect(tile(olivia.page, /Mo Member, .*Hand raised/)).toBeVisible({ timeout: 8_000 });
  await olivia.page.getByRole("button", { name: /^Raise your hand/ }).click();
  await expect(tile(mo.page, /Olivia Owner, .*Hand raised/)).toBeVisible({ timeout: 8_000 });

  // Both can react.
  await olivia.page.getByRole("button", { name: "React" }).click();
  await olivia.page.getByRole("menuitem", { name: /Like/ }).click();
  await mo.page.getByRole("button", { name: "React" }).click();
  await mo.page.getByRole("menuitem", { name: /Applause/ }).click();

  // The call's Chat panel is the chat itself.
  await olivia.page.getByRole("button", { name: /^Chat/ }).click();
  await olivia.page.getByRole("textbox").last().fill("Shared in the call");
  await olivia.page.keyboard.press("Enter");
  await mo.page.getByRole("button", { name: /^Chat/ }).click();
  await expect(mo.page.getByRole("log", { name: "Messages" })).toContainText("Shared in the call", {
    timeout: 10_000,
  });

  // After the call the message is in the chat.
  for (const { page } of [olivia, mo]) {
    await controls(page).getByRole("button", { name: "Leave", exact: true }).click();
  }
  await chatWith(mo.page, "Olivia", /Olivia Owner/);
  await expect(mo.page.getByRole("log", { name: "Messages" })).toContainText("Shared in the call", {
    timeout: 15_000,
  });
});

test("TC-F15-30 [AC-F15-13] Add people opens the panel: only chat members, nobody from outside, the chat note", async () => {
  const { olivia } = await inCall();
  await olivia.page.getByRole("button", { name: "Add people" }).click();
  const panel = olivia.page.getByRole("complementary").filter({ hasText: "Add people" });
  await expect(panel).toBeVisible();
  // Mo is in the call, so nobody is left to add; Xena (outside the chat) never appears.
  await expect(panel.getByText("Everyone in this chat is in the call.")).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText("Xena Outsider")).toHaveCount(0);
  await expect(panel.getByText("Mo Member")).toHaveCount(0);
  await expect(panel.getByText(/A call holds up to 20 people/)).toBeVisible();
  await panel.getByRole("button", { name: "Close Add people" }).click();
  await expect(panel).toHaveCount(0);
});

test("TC-F15-43 [AC-F15-33] a second window of the same person can Transfer or Join the running call", async () => {
  const { olivia, mo } = await inCall();
  const { member } = await team();
  const mo2 = await windowFor(member);
  windows.push(mo2);
  const banner = mo2.page.getByRole("region", { name: "Call on another device" });
  await expect(banner).toContainText("You're in a call on another device", { timeout: 25_000 });
  await expect(banner.getByRole("button", { name: "Join on this device" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Transfer to this device" })).toBeVisible();

  // Transfer: the second window takes over, the first one is taken out of the call.
  await banner.getByRole("button", { name: "Transfer to this device" }).click();
  await expect(controls(mo2.page)).toBeVisible({ timeout: 25_000 });
  await expect(mo2.page).toHaveURL(/\/call/);
  await expect(controls(mo.page)).toHaveCount(0, { timeout: 25_000 });
  await expect(controls(olivia.page)).toBeVisible();

  // Join: a third window joins while the second stays; both are in the call.
  const mo3 = await windowFor(member);
  windows.push(mo3);
  const again = mo3.page.getByRole("region", { name: "Call on another device" });
  await expect(again).toBeVisible({ timeout: 25_000 });
  await again.getByRole("button", { name: "Join on this device" }).click();
  await expect(controls(mo3.page)).toBeVisible({ timeout: 25_000 });
  await expect(controls(mo2.page)).toBeVisible();
});
