// Meeting chat in the real app with several windows (F03 T12): TC-F03-01 a message reaches the other
// window quickly with name and time, TC-F03-04 a late joiner sees earlier messages, TC-F03-15 the unread
// count, TC-F03-17 the empty chat. Needs the backend and Mailpit (`pnpm test`).
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { LINK, admitAll, controls, joinByLink } from "./meeting-steps.ts";
import {
  actOn,
  guestWindow,
  hostMeeting,
  joinWindow,
  knock,
  openOptions,
  saveOptions,
  team,
  windowFor,
  type Team,
} from "./meeting-team.ts";

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
  // One popup for emoji, GIFs and stickers, with tabs as in Teams.
  await host.page.getByRole("button", { name: "Emoji" }).click();
  const popup = host.page.getByRole("dialog", { name: "Emoji, GIFs and stickers" });
  await expect(popup.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  await host.page.waitForTimeout(400);
  await host.page.screenshot({ path: `${process.env["TMPDIR"] ?? "/tmp"}/meetapp-chat-popup.png` });
  await popup.getByRole("button", { name: "See all: Emoji" }).click();
  await host.page.getByRole("searchbox", { name: "Search emoji" }).fill("party popper");
  await host.page
    .getByRole("gridcell", { name: /party popper/i })
    .first()
    .click();
  await expect(box).toContainText("🎉");
  expect(outside).toEqual([]);
});

/** Points at a message so its actions show, then presses one of them. */
const onMessage = async (page: Page, text: string) => {
  // The first match: a reply further down also shows the quoted words.
  const message = page.getByRole("log", { name: "Messages" }).getByRole("article").filter({ hasText: text }).first();
  // The actions show while pointing at the bubble itself.
  await message.getByText(text).first().hover();
  return message;
};

test("TC-F03-21 TC-F03-23 TC-F03-26 TC-F03-36 [AC-F03-10] [AC-F03-13] [AC-F03-14] [AC-F03-19] react, reply, edit, pin and delete", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const hostLog = await openChat(host.page);
  const moLog = await openChat(mo.page);

  await send(mo.page, "Release checklist for Thursday");
  await expect(hostLog).toContainText("Release checklist for Thursday", { timeout: 5_000 });

  // React, as seen by the other window.
  await (await onMessage(host.page, "Release checklist")).getByRole("button", { name: "React with thumbs up" }).click();
  await expect(moLog.getByRole("button", { name: /^👍\uFE0F?, 1/ })).toBeVisible({ timeout: 5_000 });

  // Reply with a quote.
  await (await onMessage(host.page, "Release checklist")).getByRole("button", { name: "Reply" }).click();
  await expect(host.page.getByText("Replying to Mo Member")).toBeVisible();
  await send(host.page, "QA can sign off Wednesday");
  await expect(moLog.getByRole("article").filter({ hasText: "QA can sign off" })).toContainText(
    "Release checklist for Thursday",
    { timeout: 5_000 },
  );

  // Edit own message.
  await (await onMessage(mo.page, "Release checklist")).getByRole("button", { name: "More actions" }).click();
  await mo.page.getByRole("menuitem", { name: "Edit" }).click();
  const box = mo.page.getByRole("textbox", { name: "Message everyone" });
  await box.press("End");
  await mo.page.keyboard.type(" and Friday");
  await mo.page.keyboard.press("Enter");
  await expect(hostLog).toContainText("Release checklist for Thursday and Friday", { timeout: 5_000 });
  await expect(hostLog).toContainText("Edited");

  // The organizer pins it: the pinned bar and the note appear for everyone.
  await (await onMessage(host.page, "and Friday")).getByRole("button", { name: "More actions" }).click();
  await host.page.getByRole("menuitem", { name: "Pin for everyone" }).click();
  await expect(mo.page.getByRole("button", { name: /^Pinned · / })).toBeVisible({ timeout: 5_000 });
  await expect(moLog).toContainText("pinned a message");

  // Delete asks first; then everyone sees "This message was deleted".
  await (await onMessage(mo.page, "and Friday")).getByRole("button", { name: "More actions" }).click();
  await mo.page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = mo.page.getByRole("dialog", { name: "Delete this message?" });
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(hostLog).toContainText("This message was deleted", { timeout: 5_000 });
  await expect(host.page.getByRole("button", { name: /^Pinned · / })).toHaveCount(0);
});

test("TC-F03-42 [AC-F03-21] [AC-F03-22] [AC-F03-23] create a poll, vote, see results after voting, close it", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  await openChat(host.page);
  const moLog = await openChat(mo.page);

  await host.page.getByRole("button", { name: "Create a poll" }).click();
  const dialog = host.page.getByRole("dialog", { name: "Create a poll" });
  await dialog.getByLabel("Question").fill("Which day should we release?");
  await dialog.getByRole("textbox", { name: "Answer 1" }).fill("Tuesday");
  await dialog.getByRole("textbox", { name: "Answer 2" }).fill("Thursday");
  await dialog.getByRole("button", { name: "Post poll" }).click();

  const poll = moLog.getByRole("region", { name: "Which day should we release?" });
  await expect(poll).toBeVisible({ timeout: 5_000 });
  await expect(poll).toContainText("Vote to see the results");
  // The host's card must never disappear while votes arrive (it used to blink, owner 2026-10-21).
  const hostPoll = host.page
    .getByRole("log", { name: "Messages" })
    .getByRole("region", { name: "Which day should we release?" });
  await expect(hostPoll).toBeVisible();
  await hostPoll.evaluate((card) => {
    const log = card.closest("[role=log]");
    const seen = { gone: false };
    (window as unknown as { pollWatch: typeof seen }).pollWatch = seen;
    new MutationObserver(() => {
      if (!log?.querySelector('[role=region][aria-label="Which day should we release?"]')) seen.gone = true;
    }).observe(log ?? document.body, { childList: true, subtree: true });
  });
  await poll.getByRole("radio", { name: /Thursday/ }).click();
  await expect(poll).toContainText("1 person voted", { timeout: 5_000 });
  await expect(hostPoll).toContainText("1 person voted", { timeout: 5_000 });
  expect(await host.page.evaluate(() => (window as unknown as { pollWatch: { gone: boolean } }).pollWatch.gone)).toBe(
    false,
  );
  await expect(poll.getByRole("radio", { name: /Thursday/ })).toContainText("100% · 1");

  await host.page.getByRole("log", { name: "Messages" }).getByRole("button", { name: "Close poll" }).click();
  await expect(poll).toContainText("Closed", { timeout: 5_000 });
  await expect(poll.getByRole("radio", { name: /Tuesday/ })).toBeDisabled();
});

/** A small real PDF, as a file the page can attach or drop. */
const PDF_TEXT = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n";

test("TC-F03-53 TC-F03-55 TC-F03-61 [AC-F03-28] [AC-F03-29] [AC-F03-30] attach, drop and download files; wrong kinds are refused at once", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  await openChat(host.page);
  const moLog = await openChat(mo.page);

  // Attach with the button.
  const chooser = host.page.waitForEvent("filechooser");
  await host.page.getByRole("button", { name: "Attach a file" }).click();
  await (await chooser).setFiles({ name: "test plan.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF_TEXT) });
  await expect(host.page.getByText(/test plan\.pdf · \d+ KB/)).toBeVisible({ timeout: 10_000 });
  await host.page.getByRole("button", { name: "Send (Enter)" }).click();
  await expect(moLog.getByText("test plan.pdf")).toBeVisible({ timeout: 5_000 });

  // Download saves the file (Save as is answered by the test with a folder).
  const saved = mo.app.evaluate(({ BrowserWindow }) => {
    return new Promise<string>((resolve) => {
      BrowserWindow.getAllWindows()[0]?.webContents.session.once("will-download", (_event, item) => {
        item.setSavePath(`${process.env["TMPDIR"] ?? "/tmp"}/meetapp-e2e-${String(Date.now())}.pdf`);
        item.once("done", (_e, state) => resolve(`${state}:${item.getFilename()}`));
      });
    });
  });
  await moLog.getByRole("button", { name: "Download" }).click();
  expect(await saved).toBe("completed:test plan.pdf");

  // Drop a file anywhere on the window: the drop area shows and the file waits in the box.
  await host.page.evaluate((text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], "dropped.pdf", { type: "application/pdf" }));
    window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }));
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
  }, PDF_TEXT);
  await expect(host.page.getByText(/dropped\.pdf · /)).toBeVisible({ timeout: 10_000 });
  expect(host.page.url()).not.toContain("dropped.pdf");

  // A program is refused before uploading, with words.
  const again = host.page.waitForEvent("filechooser");
  await host.page.getByRole("button", { name: "Attach a file" }).click();
  await (await again).setFiles({ name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await expect(host.page.getByRole("alert")).toContainText("This kind of file can't be sent");
});

test("TC-F03-46 TC-F03-49 TC-F03-59 [AC-F03-26] [AC-F03-27] [AC-F03-33] stickers for everyone; GIFs say when they aren't available; guests have no Attach", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const guest = await guestWindow(link, "Gus Guest", host.page);
  const hostLog = await openChat(host.page);
  await openChat(guest.page);

  await expect(guest.page.getByRole("button", { name: "Attach a file" })).toHaveCount(0);
  await guest.page.getByRole("button", { name: "Emoji" }).click();
  await guest.page.getByRole("tab", { name: "Stickers" }).click();
  await guest.page.getByRole("button", { name: "Sticker: Thank you" }).click();
  await expect(guest.page.getByRole("dialog", { name: "Emoji, GIFs and stickers" })).toHaveCount(0);
  await expect(hostLog.getByRole("img", { name: "Sticker: Thank you" })).toBeVisible({ timeout: 5_000 });

  // Without a GIF key (development), the picker says GIFs aren't available, after the one-time notice.
  await host.page.getByRole("button", { name: "Emoji" }).click();
  await expect(host.page.getByRole("note")).toContainText("sent to our GIF service");
  await host.page.getByRole("button", { name: "Got it" }).click();
  await expect(host.page.getByText("GIFs aren't available right now")).toBeVisible();
  // A press outside closes the popup.
  await host.page.getByRole("heading", { name: "Chat", exact: true }).click();
  await expect(host.page.getByRole("dialog", { name: "Emoji, GIFs and stickers" })).toHaveCount(0);
});

const setChat = async (page: Page, mode: "on" | "in_meeting" | "off") => {
  const dialog = await openOptions(page);
  await dialog.getByRole("combobox", { name: "Meeting chat" }).selectOption(mode);
  await saveOptions(page, dialog);
};

test("TC-F03-63 [AC-F03-35] [AC-F03-37] chat Off, On and In-meeting only reach everyone with a note; messages stay readable", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  await openChat(host.page);
  const moLog = await openChat(mo.page);
  await send(mo.page, "said before chat was off");
  await expect(moLog.getByText("said before chat was off")).toBeVisible({ timeout: 5_000 });

  await setChat(host.page, "off");
  await expect(moLog.getByText("Olivia Owner turned chat off")).toBeVisible({ timeout: 2_000 });
  await expect(mo.page.getByRole("status").filter({ hasText: "Chat is turned off for this meeting." })).toBeVisible();
  await expect(mo.page.getByRole("textbox", { name: "Message everyone" })).toHaveCount(0);
  await expect(moLog.getByText("said before chat was off")).toBeVisible();

  await setChat(host.page, "on");
  await expect(moLog.getByText("Olivia Owner turned chat on")).toBeVisible({ timeout: 2_000 });
  await expect(mo.page.getByRole("textbox", { name: "Message everyone" })).toBeVisible();

  await setChat(host.page, "in_meeting");
  await expect(moLog.getByText("Olivia Owner limited chat to the meeting")).toBeVisible({ timeout: 2_000 });
  await expect(mo.page.getByRole("textbox", { name: "Message everyone" })).toBeVisible();
});

/** The organizer makes a meeting with a title no other test uses, and joins it. */
async function titledMeeting(who: Team, title: string) {
  const host = await windowFor(who.owner);
  await host.page.getByRole("button", { name: "Meetings" }).click();
  await host.page.getByLabel("Title (optional)").fill(title);
  await host.page.getByRole("button", { name: "Get link" }).click();
  const dialog = host.page.getByRole("dialog", { name: "Your meeting link is ready" });
  const link = (await dialog.getByText(LINK).textContent()) ?? "";
  await dialog.getByRole("button", { name: "Done" }).click();
  await joinByLink(host.page, link);
  return { host, link };
}

const openChatOf = (page: Page, title: string) => page.getByRole("button", { name: `Open chat of ${title}` });
const toMeetings = async (page: Page) => {
  await page.getByRole("button", { name: "Back to home" }).click();
  await page.getByRole("button", { name: "Meetings" }).click();
};

test("TC-F03-69 TC-F03-72 [AC-F03-40] [AC-F03-42] a removed person loses the chat; afterwards others open it read-only from the meetings list", async () => {
  const who = await team();
  const title = `Chat review ${randomUUID().slice(0, 8)}`;
  const { host, link } = await titledMeeting(who, title);
  const mo = await joinWindow(who.member, link);
  const xena = await knock(who.outsider, link);
  await admitAll(host.page, who.outsider.name);
  await expect(controls(xena.page)).toBeVisible({ timeout: 20_000 });
  const hostLog = await openChat(host.page);
  await openChat(mo.page);
  await openChat(xena.page);
  await send(xena.page, "notes from Xena");
  await expect(hostLog.getByText("notes from Xena")).toBeVisible({ timeout: 5_000 });

  // Removed: Mo's window leaves the meeting (and its chat) within 2 seconds.
  await actOn(host.page, "Mo Member", "Remove from meeting");
  await expect(mo.page.getByRole("heading", { name: "You were removed from the meeting" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(mo.page.getByRole("log", { name: "Messages" })).toHaveCount(0);
  await openChat(host.page);
  await send(host.page, "after Mo left");
  await expect(mo.page.getByText("after Mo left")).toHaveCount(0);

  // The organizer ends the meeting.
  await controls(host.page).getByRole("button", { name: "More ways to leave" }).click();
  await host.page.getByRole("menuitem", { name: "End meeting" }).click();
  await host.page.getByRole("dialog").getByRole("button", { name: "End meeting" }).click();
  await expect(xena.page.getByRole("heading", { name: "The meeting has ended" })).toBeVisible({ timeout: 20_000 });

  // Xena (external, took part) reads it read-only, with nothing to write, react or edit.
  await toMeetings(xena.page);
  await openChatOf(xena.page, title).click();
  const xenaLog = xena.page.getByRole("log", { name: "Messages" });
  await expect(xenaLog.getByText("notes from Xena")).toBeVisible({ timeout: 10_000 });
  await expect(xenaLog.getByText("after Mo left")).toBeVisible();
  await expect(xena.page.getByRole("textbox", { name: "Message everyone" })).toHaveCount(0);
  // Only Copy text is left on a message.
  await (await onMessage(xena.page, "after Mo left")).getByRole("button", { name: "More actions" }).click();
  await expect(xena.page.getByRole("menuitem")).toHaveText(["Copy text"]);
  await xena.page.keyboard.press("Escape");
  await expect(xena.page.getByRole("button", { name: "Reply" })).toHaveCount(0);
  await expect(xena.page.getByRole("button", { name: /^React with / })).toHaveCount(0);

  // The organizer still sees Delete on others' messages.
  await toMeetings(host.page);
  await openChatOf(host.page, title).click();
  await (await onMessage(host.page, "notes from Xena")).getByRole("button", { name: "More actions" }).click();
  await expect(host.page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await expect(host.page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);

  // Mo, who was removed, has no Open chat for it.
  await toMeetings(mo.page);
  await expect(mo.page.getByRole("heading", { name: "Recent meetings" })).toBeVisible();
  await expect(openChatOf(mo.page, title)).toHaveCount(0);
});

test("TC-F03-95 [AC-F03-13] [AC-F03-47] [AC-F03-48] grouped bubbles, big emoji, one reaction each, and actions kept inside the panel", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const hostLog = await openChat(host.page);
  await openChat(mo.page);
  // Send within one minute, so the messages group (not too close to the next minute).
  while (new Date().getSeconds() > 45) await host.page.waitForTimeout(1_000);
  await send(host.page, "hello");
  await send(host.page, "hi");
  await send(host.page, "🎉");
  await expect(hostLog.getByText("🎉")).toBeVisible({ timeout: 5_000 });
  // One name and time for the group.
  await expect(hostLog.getByText("You", { exact: true })).toHaveCount(1);
  expect(await hostLog.getByText("🎉").evaluate((node) => getComputedStyle(node).fontSize)).toBe("32px");

  // The actions bar shows only when pointing at the bubble (not beside it), fading in, inside the list.
  const message = hostLog.getByRole("article").filter({ has: host.page.getByText("hi", { exact: true }) });
  const bar = message.getByRole("group", { name: /^Actions for / });
  const opacity = () => bar.evaluate((node) => getComputedStyle(node.parentElement ?? node).opacity);
  const box = await hostLog.boundingBox();
  if (box) await host.page.mouse.move(box.x + 20, box.y + box.height / 2);
  expect(await opacity()).toBe("0");
  await hostLog.getByText("hi", { exact: true }).hover();
  await expect.poll(opacity).toBe("1");
  const [barBox, logBox] = [await bar.boundingBox(), await hostLog.boundingBox()];
  expect(barBox && logBox && barBox.x >= logBox.x && barBox.x + barBox.width <= logBox.x + logBox.width).toBe(true);
  expect(await hostLog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

  // One reaction per person: another emoji replaces it, the same one takes it back.
  await bar.getByRole("button", { name: "React with thumbs up" }).click();
  await expect(message.getByRole("button", { name: /👍/ })).toBeVisible({ timeout: 5_000 });
  // Mo sees the host's reaction, but not as Mo's own (verification round 1, bug 1).
  const moChip = mo.page.getByRole("log", { name: "Messages" }).getByRole("button", { name: /👍/ });
  await expect(moChip).toBeVisible({ timeout: 5_000 });
  await expect(moChip).toHaveAttribute("aria-pressed", "false");
  await expect(message.getByRole("button", { name: /👍/ })).toHaveAttribute("aria-pressed", "true");
  // As in Teams: "Add reaction" beside the reactions opens the full emoji list.
  await expect(message.getByRole("button", { name: "Add reaction" })).toBeVisible();
  await hostLog.getByText("hi", { exact: true }).hover();
  await bar.getByRole("button", { name: "React with heart" }).click();
  await expect(message.getByRole("button", { name: /❤/ })).toBeVisible({ timeout: 5_000 });
  await expect(message.getByRole("button", { name: /👍/ })).toHaveCount(0);
  await hostLog.getByText("hi", { exact: true }).hover();
  await host.page.screenshot({ path: `${process.env["TMPDIR"] ?? "/tmp"}/meetapp-chat-look.png` });
  await bar.getByRole("button", { name: "React with heart" }).click();
  await expect(message.getByRole("button", { name: /❤/ })).toHaveCount(0, { timeout: 5_000 });
});

/** Presses Tab (or Shift+Tab) until `target` has the focus; fails if it never comes (focus lost or trapped). */
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>, back = false): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    if (await target.evaluate((node) => node === document.activeElement).catch(() => false)) return;
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  throw new Error("The keyboard never reached the target");
}

test("TC-F03-75 [AC-F03-45] the whole chat works with the keyboard only; news is announced", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const page = host.page;

  // While the panel is closed, a new message is announced with sender and text.
  await openChat(mo.page);
  await send(mo.page, "hello from Mo");
  await expect(
    page.locator("[aria-live=polite]").filter({ hasText: "New message from Mo Member: hello from Mo" }),
  ).toHaveCount(1, {
    timeout: 10_000,
  });

  // Open the chat and write, format and send.
  await controls(page).getByRole("button", { name: /^Chat/ }).focus();
  await page.keyboard.press("Enter");
  const log = page.getByRole("log", { name: "Messages" });
  const box = page.getByRole("textbox", { name: "Message everyone" });
  await tabTo(page, box);
  await page.keyboard.type("plain ");
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+b`);
  await page.keyboard.type("bold");
  await page.keyboard.press("Enter");
  await expect(log.locator("strong", { hasText: "bold" })).toBeVisible({ timeout: 5_000 });

  // React to and reply to Mo's message (its toolbar shows while focus is inside it).
  // The first match: the reply further down quotes these words too.
  const mos = log.getByRole("article").filter({ hasText: "hello from Mo" }).first();
  await tabTo(page, mos.getByRole("button", { name: "React with thumbs up" }), true);
  await page.keyboard.press("Enter");
  await expect(mos.getByRole("button", { name: /👍/ })).toBeVisible({ timeout: 5_000 });
  await tabTo(page, mos.getByRole("button", { name: "Reply" }));
  await page.keyboard.press("Enter");
  await tabTo(page, box);
  await page.keyboard.type("a reply");
  await page.keyboard.press("Enter");
  await expect(log.getByRole("article").filter({ hasText: "a reply" })).toContainText("hello from Mo", {
    timeout: 5_000,
  });

  // Pin it for everyone from the More menu (organizer), with the arrow keys.
  await tabTo(page, mos.getByRole("button", { name: "More actions" }), true);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Pin for everyone" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pinned · Mo Member: hello from Mo" })).toBeVisible({ timeout: 5_000 });

  // The emoji, GIF and sticker popup: arrow keys move between tabs; a sticker is sent with Enter.
  await tabTo(page, page.getByRole("button", { name: "Emoji" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "All" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Stickers" })).toHaveAttribute("aria-selected", "true");
  await tabTo(page, page.getByRole("button", { name: "Sticker: Thank you" }));
  await page.keyboard.press("Enter");
  await expect(log.getByRole("img", { name: "Sticker: Thank you" })).toBeVisible({ timeout: 5_000 });

  // Create a poll and vote in it.
  await tabTo(page, page.getByRole("button", { name: "Create a poll" }));
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Create a poll" });
  await tabTo(page, dialog.getByLabel("Question"));
  await page.keyboard.type("Lunch?");
  await tabTo(page, dialog.getByRole("textbox", { name: "Answer 1" }));
  await page.keyboard.type("Yes");
  await tabTo(page, dialog.getByRole("textbox", { name: "Answer 2" }));
  await page.keyboard.type("No");
  await tabTo(page, dialog.getByRole("button", { name: "Post poll" }));
  await page.keyboard.press("Enter");
  const poll = log.getByRole("region", { name: "Lunch?" });
  await tabTo(page, poll.getByRole("radio", { name: /Yes/ }), true);
  await page.keyboard.press("Space");
  await expect(poll).toContainText("1 person voted", { timeout: 5_000 });

  // Edit, then delete, an own message.
  const mine = log.getByRole("article").filter({ hasText: "a reply" }).first();
  await tabTo(page, mine.getByRole("button", { name: "More actions" }), true);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Edit" }).focus();
  await page.keyboard.press("Enter");
  await expect(box).toBeFocused();
  await page.keyboard.type(" (edited)");
  await page.keyboard.press("Enter");
  await expect(log.getByText("a reply (edited)")).toBeVisible({ timeout: 5_000 });
  await tabTo(page, mine.getByRole("button", { name: "More actions" }), true);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Delete" }).focus();
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("dialog").getByRole("button", { name: "Delete" }));
  await page.keyboard.press("Enter");
  await expect(log.getByText("This message was deleted")).toBeVisible({ timeout: 5_000 });

  // Attach opens the file dialog from the keyboard.
  await tabTo(page, page.getByRole("button", { name: "Attach a file" }));
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await chooser;
  // Focus is never lost to the page itself.
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});
