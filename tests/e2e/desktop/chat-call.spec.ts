// F15 T13: calling from a chat in the real desktop app, with two windows for two people of the team
// (TC-F15-02 Video and Audio call, 06 Join from the header and the note, 23 declined, no answer and
// cancel, 61 the backend can't be reached). The other window's ring itself is checked with the ring
// screens (T14); here the other person sees the call in their chat.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

test.describe.configure({ timeout: 180_000 });

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

/** Olivia and Mo, each in their window with the chat with the other one open. */
async function pair() {
  const { workspace, owner, member } = await team();
  const [olivia, mo] = await Promise.all([windowFor(owner), windowFor(member)]);
  windows.push(olivia, mo);
  await Promise.all([inWorkspace(olivia.page, workspace), inWorkspace(mo.page, workspace)]);
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await chatWith(mo.page, "Olivia", /Olivia Owner/);
  return { olivia, mo };
}

const calling = (page: Page, name: string) => page.getByText(`Calling ${name}…`);

/** The open chat's header (a <header> named by the chat's title, not a page banner). */
const headerOf = (page: Page, title: string) =>
  page.locator("header", { has: page.getByRole("heading", { level: 2, name: title }) });

test("TC-F15-02 [AC-F15-01] Video call and Audio call open the Calling screen; the other person sees the call", async () => {
  const { olivia, mo } = await pair();
  await expect(olivia.page.getByRole("button", { name: "Video call" })).toBeEnabled();
  await expect(olivia.page.getByRole("button", { name: "Audio call" })).toBeEnabled();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  await expect(olivia.page.getByRole("button", { name: "Cancel" })).toBeVisible();
  // The other window learns of the call in its chat (header Join and the call note).
  await expect(mo.page.getByRole("button", { name: "Join" }).first()).toBeVisible({ timeout: 10_000 });
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect(olivia.page.getByRole("heading", { level: 2, name: "Mo Member" })).toBeVisible({ timeout: 10_000 });

  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  await expect(olivia.page.getByText("Audio call · Mo Member")).toBeVisible();
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
});

test("TC-F15-06 [AC-F15-03] Join from the chat header puts the second person into the running call", async () => {
  const { olivia, mo } = await pair();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  // While the call runs Join replaces the two buttons.
  const join = headerOf(mo.page, "Olivia Owner").getByRole("button", { name: "Join" });
  await expect(join).toBeVisible({ timeout: 10_000 });
  await expect(mo.page.getByRole("button", { name: "Video call" })).toHaveCount(0);
  // Mo's incoming call covers the header's top right while it rings, so Join is pressed by keyboard.
  await join.focus();
  await mo.page.keyboard.press("Enter");
  await expect(mo.page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });
  // Joining ends the ringing: Olivia's Calling screen becomes the call.
  await expect(olivia.page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });
});

test("TC-F15-06 [AC-F15-15] Join from the call note in the chat joins the same call", async () => {
  const { olivia, mo } = await pair();
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  const note = mo.page.getByRole("log", { name: "Messages" });
  await expect(note).toContainText("Olivia Owner started a call", { timeout: 10_000 });
  // The incoming call can cover the note's Join while it rings, so it is pressed by keyboard.
  await note.getByRole("button", { name: "Join" }).focus();
  await mo.page.keyboard.press("Enter");
  await expect(mo.page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });
});

test("TC-F15-23 [AC-F15-08] a declined call shows the name declined, with Call again and Back to chat", async () => {
  const { olivia, mo } = await pair();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  await expect(mo.page.getByRole("button", { name: "Decline" })).toBeVisible({ timeout: 10_000 });
  await mo.page.getByRole("button", { name: "Decline" }).click();
  await expect(olivia.page.getByText("Mo Member declined")).toBeVisible({ timeout: 10_000 });
  await expect(olivia.page.getByRole("button", { name: "Call again" })).toBeVisible();
  await olivia.page.getByRole("button", { name: "Back to chat" }).click();
  await expect(olivia.page.getByRole("heading", { level: 2, name: "Mo Member" })).toBeVisible();
});

test("TC-F15-23 [AC-F15-09] a call nobody answers says No answer after 30 seconds, and the chat has a missed call", async () => {
  test.setTimeout(240_000);
  const { olivia, mo } = await pair();
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  await expect(olivia.page.getByText("No answer")).toBeVisible({ timeout: 45_000 });
  await expect(olivia.page.getByRole("button", { name: "Back to chat" })).toBeVisible();
  await olivia.page.getByRole("button", { name: "Back to chat" }).click();
  await expect(mo.page.getByRole("log", { name: "Messages" })).toContainText("Missed call from Olivia Owner", {
    timeout: 15_000,
  });
  await expect(mo.page.getByRole("button", { name: "Call back" })).toBeVisible();
});

test("TC-F15-23 [AC-F15-07] Cancel stops the call: the caller is back in the chat, the other has no call to join", async () => {
  const { olivia, mo } = await pair();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(calling(olivia.page, "Mo Member")).toBeVisible({ timeout: 10_000 });
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect(olivia.page.getByRole("heading", { level: 2, name: "Mo Member" })).toBeVisible({ timeout: 10_000 });
  await expect(headerOf(mo.page, "Olivia Owner").getByRole("button", { name: "Join" })).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(mo.page.getByRole("button", { name: "Video call" })).toBeVisible();
});

test("TC-F15-61 [AC-F15-18] with the backend unreachable the call buttons say so within 10 s, with Retry, no endless wait", async () => {
  const { olivia } = await pair();
  await olivia.page.route("**/api/v1/conversations/*/calls", (route) => route.abort());
  const started = Date.now();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(olivia.page.getByText(/Can't reach MeetApp|Couldn't start the call\./).first()).toBeVisible({
    timeout: 10_000,
  });
  expect(Date.now() - started).toBeLessThan(10_500);
  await expect(olivia.page.getByRole("button", { name: "Retry" }).last()).toBeVisible();
  await expect(olivia.page.getByRole("button", { name: "Video call" })).toBeEnabled();
  await expect(calling(olivia.page, "Mo Member")).toHaveCount(0);
});
