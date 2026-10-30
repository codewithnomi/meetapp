// F14 T19: the Chat screen with the keyboard only and for screen readers (TC-F14-60, 61; AC-F14-23, 26,
// 30, 36). Olivia folds the menu, filters, searches, starts a group with Mo and Xena (from outside), sends,
// replies, reacts, pins and mutes, adds and removes people and leaves; Xena accepts one group request and
// deletes another; all with Tab, Enter, Escape and the arrow keys. The axe check runs on the Chat screen,
// New chat, Chat requests and Group details.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { tabTo } from "./keyboard-steps.ts";
import { team, windowFor, type Team } from "./meeting-team.ts";
import { switcher, switchTo } from "./workspace-steps.ts";

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

/** Tabs to `target` and presses Enter. */
async function press(page: Page, target: Locator, key = "Enter") {
  await tabTo(page, target, 80);
  await page.keyboard.press(key);
}

/** No serious or critical axe problems on what is on screen now (legacy mode: Electron can't open the extra page axe uses for frames). */
async function expectAccessible(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).setLegacyMode(true).analyze();
  const problems = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .flatMap((violation) => violation.nodes.map((node) => `${where}: ${violation.id} ${node.target.join(" ")}`));
  expect(problems).toEqual([]);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const chatItem = (page: Page) => nav(page).getByRole("button", { name: /^Chat/ });

/** New chat → To: (focused on opening) → each person picked with Enter (the first suggestion is highlighted) → the optional name → Start chat. */
async function startGroupWithKeyboard(page: Page, people: string[], name: string) {
  await press(page, page.getByRole("button", { name: "New chat" }).first());
  const to = page.getByRole("combobox", { name: "To:" });
  await expect(to).toBeFocused();
  for (const person of people) {
    await page.keyboard.type(person);
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await tabTo(page, page.getByRole("textbox", { name: "Group name" }), 80);
  await page.keyboard.type(name);
  await press(page, page.getByRole("button", { name: "Start chat" }));
  await expect(page.getByRole("textbox", { name: `Message ${name}` })).toBeVisible();
}

/** Opens the chat's "More for this chat" menu and picks `action` with the arrow keys. */
async function chatAction(page: Page, action: string) {
  await press(page, page.getByRole("button", { name: "More for this chat" }));
  // The menu opens with its first item focused; arrows only after that, or a press lands on the wrong item.
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  const item = page.getByRole("menuitem", { name: action });
  for (let i = 0; i < 8; i++) {
    // Each press is given a moment: the menu moves its focus after the key event.
    const reached = await expect(item)
      .toBeFocused({ timeout: 500 })
      .then(
        () => true,
        () => false,
      );
    if (reached) {
      await page.keyboard.press("Enter");
      return;
    }
    await page.keyboard.press("ArrowDown");
  }
  const items = await page.getByRole("menuitem").allTextContents();
  throw new Error(`the arrows never reached ${action} (menu: ${items.join(", ")})`);
}

/** Olivia's part: menu, filters, search, a group, a message, reply, reaction, pin and mute. */
async function oliviaWithKeyboard(page: Page, who: Team, group: string) {
  const fold = nav(page).getByRole("button", { name: "Collapse menu" });
  await press(page, fold);
  await expect(nav(page).getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(nav(page).getByRole("button", { name: "Expand menu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await press(page, chatItem(page));
  await press(page, page.getByRole("button", { name: "Unread", exact: true }));
  await expect(page.getByRole("button", { name: "Unread", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("textbox", { name: "Find a chat or person" }), 80);
  await page.keyboard.type("Mo");
  await page.keyboard.press("Escape");
  await expectAccessible(page, "Chat screen");

  await startGroupWithKeyboard(page, ["Mo", who.outsider.email], group);
  const box = page.getByRole("textbox", { name: `Message ${group}` });
  await page.keyboard.type("Plan for Friday");
  await page.keyboard.press("Enter");
  const message = page
    .getByRole("log", { name: "Messages" })
    .getByRole("article")
    .filter({ hasText: "Plan for Friday" });
  await expect(message.getByRole("group", { name: "Actions for your message" })).toBeAttached();
  await press(page, message.getByRole("button", { name: "React with thumbs up" }));
  await expect(message.getByRole("button", { name: /, 1: Olivia Owner$/ })).toBeVisible();
  await press(page, message.getByRole("button", { name: "Reply" }));
  await expect(page.getByText("Replying to Olivia Owner")).toBeVisible();
  await expect(box).toBeFocused();
  await page.keyboard.type("and the agenda");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("and the agenda");
  await chatAction(page, "Pin");
  await expect(page.getByRole("list", { name: "Pinned" })).toContainText(group);
  await chatAction(page, "Mute");
  await expect(page.getByRole("button", { name: new RegExp(`^${group}.*Muted`) })).toBeVisible();
}

/** Group details: remove Mo, add Mo back (focus returns to Add people after Escape), then leave. */
async function groupDetailsWithKeyboard(page: Page) {
  await chatAction(page, "Group details");
  await expect(page.getByRole("button", { name: "Close group details" })).toBeVisible();
  await expectAccessible(page, "Group details");
  await press(page, page.getByRole("button", { name: "Remove Mo Member from the group" }));
  await expect(page.getByRole("button", { name: "Remove Mo Member from the group" })).toHaveCount(0);
  const add = page.getByRole("button", { name: "Add people" });
  await press(page, add);
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "To:" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Mo");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await press(page, page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }));
  await expect(page.getByRole("button", { name: "Remove Mo Member from the group" })).toBeVisible();
}

async function leaveWithKeyboard(page: Page) {
  await press(page, page.getByRole("button", { name: "Leave group" }));
  const dialog = page.getByRole("dialog", { name: "Leave this group?" });
  await expect(dialog).toContainText("won't get new messages");
  await press(page, dialog.getByRole("button", { name: "Leave group" }));
  await expect(page.getByRole("heading", { level: 2, name: "Choose a chat" })).toBeVisible();
}

/** Xena's part: accept the first group's request and delete the second's. */
async function xenaWithKeyboard(page: Page, keep: string, drop: string) {
  await press(page, chatItem(page));
  const requests = page.getByRole("button", { name: /^Chat requests/ });
  await expect(requests).toHaveAccessibleName(/Chat requests [1-9]/, { timeout: 10_000 });
  await press(page, requests);
  await expectAccessible(page, "Chat requests");
  const kept = page.getByRole("region", { name: new RegExp(keep) });
  await press(page, kept.getByRole("button", { name: "Accept" }));
  await expect(page.getByRole("textbox", { name: `Message ${keep}` })).toBeVisible();
  await press(page, page.getByRole("button", { name: /^Chat requests/ }));
  const dropped = page.getByRole("region", { name: new RegExp(drop) });
  await press(page, dropped.getByRole("button", { name: "Delete" }));
  const confirm = page.getByRole("dialog", { name: "Delete this chat request?" });
  await press(page, confirm.getByRole("button", { name: "Delete" }));
  await expect(dropped).toHaveCount(0);
}

test("TC-F14-60 [AC-F14-30, AC-F14-36] the whole Chat screen works with the keyboard only", async () => {
  test.setTimeout(240_000);
  const who = await team();
  const [olivia, xena] = await Promise.all([windowFor(who.owner), windowFor(who.outsider)]);
  windows.push(olivia, xena);
  await inWorkspace(olivia.page, who.workspace);
  const stamp = String(Date.now()).slice(-6);
  const keep = `Keyboard ${stamp}`;
  const drop = `Dropped ${stamp}`;
  await oliviaWithKeyboard(olivia.page, who, keep);
  await expectAccessible(olivia.page, "Conversation");
  await groupDetailsWithKeyboard(olivia.page);
  await startGroupWithKeyboard(olivia.page, ["Mo", who.outsider.email], drop);
  await expectAccessible(olivia.page, "New chat");
  await olivia.page.keyboard.type("Second group");
  await olivia.page.keyboard.press("Enter");
  await xenaWithKeyboard(xena.page, keep, drop);
  await chatAction(olivia.page, "Group details");
  await leaveWithKeyboard(olivia.page);
});

test("TC-F14-61 [AC-F14-30, AC-F14-26, AC-F14-23] messages are announced; status, unread, typing and Seen have names", async () => {
  test.setTimeout(180_000);
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  // A one-to-one chat with Mo, opened with the keyboard (one person in To: opens it).
  await press(olivia.page, chatItem(olivia.page));
  await press(olivia.page, olivia.page.getByRole("button", { name: "New chat" }).first());
  await olivia.page.keyboard.type("Mo");
  await expect(olivia.page.getByRole("option").first()).toBeVisible();
  await olivia.page.keyboard.press("Enter");
  await press(olivia.page, olivia.page.getByRole("button", { name: "Start chat" }));
  const box = olivia.page.getByRole("textbox", { name: "Message Mo Member" });
  const hello = `Hello ${String(Date.now())}`;

  // Mo is on Home: the side menu's Chat item names the unread count.
  await box.fill(hello);
  await box.press("Enter");
  await expect(chatItem(mo.page)).toHaveAccessibleName(/^Chat, \d+ unread/, { timeout: 10_000 });
  await press(mo.page, chatItem(mo.page));
  const row = mo.page.getByRole("button", { name: /^Olivia Owner, .*unread/ });
  await expect(row).toBeVisible();
  // The row names the status with the unread count (its dot is part of the row's name).
  await expect(row).toHaveAccessibleName(/, (Available|Away|In a meeting|Offline), /);
  await press(mo.page, row);

  // A new message lands in the open chat's polite live region.
  const log = mo.page.getByRole("log", { name: "Messages" });
  await expect(log).toHaveAttribute("aria-live", "polite");
  await box.fill("Second line");
  await box.press("Enter");
  await expect(log).toContainText("Second line", { timeout: 5000 });
  await expect(olivia.page.getByText("Seen", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Typing is a status message; the header's status dot has a text name.
  await mo.page.getByRole("textbox", { name: "Message Olivia Owner" }).pressSequentially("typing");
  await expect(olivia.page.getByRole("status").filter({ hasText: "Mo Member is typing…" })).toBeVisible();
  const header = olivia.page.getByRole("region", { name: "Mo Member" });
  await expect(header.getByRole("img", { name: /Available|Away|In a meeting|Offline/ })).toBeVisible();

  // Folded, the menu's buttons keep their names and the fold button says it is collapsed.
  await press(olivia.page, nav(olivia.page).getByRole("button", { name: "Collapse menu" }));
  await expect(nav(olivia.page).getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(chatItem(olivia.page)).toHaveAccessibleName(/^Chat/);
  await chatItem(olivia.page).focus();
  await expect(olivia.page.getByRole("tooltip", { name: "Chat" })).toBeVisible();
  await olivia.page.keyboard.press("Enter");
  await press(olivia.page, nav(olivia.page).getByRole("button", { name: "Expand menu" }));
});
