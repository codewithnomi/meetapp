// F13 T14: the calendar in real windows (TC-F13-75 to 82). Olivia (organizer) and Mo (a member of her
// workspace) schedule, answer, change and cancel meetings; reminders arrive as corner cards; the screens
// work with the keyboard only and pass axe; links in notes open in the browser; offline keeps the
// calendar. The reminder job runs every minute in the backend, so the reminder test waits for it.
import { AxeBuilder } from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { hasBackendServices, sql } from "./backend-control.ts";
import { answer, block, minutesFromNow, openCalendar, openDetails, reminderCards, schedule } from "./calendar-steps.ts";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls, findByLink } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { inWorkspace } from "./call-window-steps.ts";
import { openScreen } from "./workspace-steps.ts";

test.describe.configure({ timeout: 300_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const named = (what: string) => `${what} ${randomUUID().slice(0, 6)}`;

/** Olivia and Mo, each with the team's workspace open on the Calendar. */
async function pair() {
  const people = await team();
  const olivia = await windowFor(people.owner);
  const mo = await windowFor(people.member);
  windows.push(olivia, mo);
  for (const running of [olivia, mo]) {
    await inWorkspace(running.page, people.workspace);
    await openCalendar(running.page);
  }
  return { people, olivia, mo };
}

async function expectAccessible(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).setLegacyMode(true).analyze();
  const problems = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .flatMap((violation) => violation.nodes.map((node) => `${where}: ${violation.id} ${node.target.join(" ")}`));
  expect(problems).toEqual([]);
}

test("TC-F13-75 [AC-F13-01, 09, 16, 17] Olivia schedules, Mo sees it live with an invite card, answers; Olivia sees it", async () => {
  const { olivia, mo } = await pair();
  const title = named("Planning");
  await schedule(olivia.page, { title, invite: ["Mo Member"], start: minutesFromNow(120) });
  await expect(block(mo.page, title)).toBeVisible({ timeout: 5_000 });
  await expect
    .poll(async () => {
      for (const card of mo.app.windows())
        if ((await card.getByText(`invited you to ${title}`).count()) > 0) return true;
      return false;
    })
    .toBe(true);
  await openDetails(mo.page, title);
  await expect(mo.page.getByText("Olivia Owner").first()).toBeVisible();
  await answer(mo.page, "Accept");
  await openDetails(olivia.page, title);
  await expect(olivia.page.getByText(/1 accepted/)).toBeVisible({ timeout: 5_000 });
  await answer(mo.page, "Decline");
  await expect(olivia.page.getByText(/1 declined/)).toBeVisible({ timeout: 5_000 });
});

test("TC-F13-76 [AC-F13-03, 07, 23] dragging fills the form; Upcoming lists today's meeting and Join opens the pre-join", async () => {
  const { olivia } = await pair();
  const page = olivia.page;
  await page.getByRole("radio", { name: "Day" }).click();
  // From 13:00 to 14:00 of today: press at 13:00 and let go in the 13:30 half hour (48 px an hour).
  const column = page.getByRole("group").filter({ has: page.getByTestId("now-line") });
  await column.hover({ position: { x: 20, y: 13 * 48 + 5 } });
  await page.mouse.down();
  await column.hover({ position: { x: 20, y: 13 * 48 + 40 } });
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "New meeting" })).toBeVisible();
  await expect(page.getByLabel("Start time")).toHaveValue("13:00");
  await expect(page.getByLabel("End time")).toHaveValue("14:00");
  await page.getByRole("button", { name: "Cancel" }).click();

  const title = named("Stand-up");
  await schedule(page, { title, start: minutesFromNow(3), minutes: 20 });
  await openScreen(page, "Meetings");
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByText(title)).toBeVisible({ timeout: 10_000 });
  await upcoming.getByRole("button", { name: `Join ${title}` }).click();
  await expect(page.getByRole("button", { name: /^Join now/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^Join now/ }).click();
  await expect(controls(page)).toBeVisible({ timeout: 20_000 });
});

test("TC-F13-77 [AC-F13-11, 18, 19] a weekly series: one meeting moved, the series moved (answers reset), then cancelled", async () => {
  const { olivia, mo } = await pair();
  const title = named("Weekly");
  await schedule(olivia.page, { title, invite: ["Mo Member"], start: minutesFromNow(60), repeat: "weekly" });
  await expect(block(mo.page, title)).toBeVisible({ timeout: 5_000 });
  await openDetails(mo.page, title);
  await answer(mo.page, "Accept", "All in series");

  // One meeting of the series an hour later.
  await openDetails(olivia.page, title);
  await olivia.page.getByRole("button", { name: "Edit" }).click();
  await olivia.page.getByRole("radio", { name: "This meeting" }).click();
  await olivia.page.getByRole("button", { name: "Continue" }).click();
  const later = minutesFromNow(120);
  await olivia.page.getByLabel("Start time").fill(`${String(later.getHours()).padStart(2, "0")}:00`);
  await olivia.page.getByLabel("End time").fill(`${String(later.getHours()).padStart(2, "0")}:30`);
  await olivia.page.getByRole("button", { name: "Send update" }).click();
  await expect(olivia.page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible({ timeout: 15_000 });
  await expect(block(mo.page, title)).toContainText(`${String(later.getHours()).padStart(2, "0")}:00`, {
    timeout: 5_000,
  });

  // The whole series moves: a warning, then everyone's answers start over.
  await openDetails(olivia.page, title);
  await olivia.page.getByRole("button", { name: "Edit" }).click();
  await olivia.page.getByRole("radio", { name: "The series" }).click();
  await olivia.page.getByRole("button", { name: "Continue" }).click();
  const moved = minutesFromNow(180);
  await olivia.page.getByLabel("Start time").fill(`${String(moved.getHours()).padStart(2, "0")}:00`);
  await olivia.page.getByLabel("End time").fill(`${String(moved.getHours()).padStart(2, "0")}:30`);
  await olivia.page.getByRole("button", { name: "Send update" }).click();
  await olivia.page.getByRole("button", { name: "Change and send" }).click();
  await expect(block(mo.page, title)).toHaveAccessibleName(/No answer/, { timeout: 5_000 });

  // Cancel the series: it leaves both calendars and the link stops working.
  await openDetails(olivia.page, title);
  const link =
    (await olivia.page
      .getByText(/\/m\/[\w-]{22}/)
      .first()
      .textContent()) ?? "";
  await olivia.page.getByRole("button", { name: "Cancel meeting" }).click();
  const dialog = olivia.page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "The series" }).click();
  await dialog.getByRole("button", { name: "Cancel meeting" }).click();
  await expect(block(olivia.page, title)).toBeHidden({ timeout: 10_000 });
  await expect(block(mo.page, title)).toBeHidden({ timeout: 5_000 });
  await openScreen(mo.page, "Meetings");
  await findByLink(mo.page, link.trim());
  await expect(mo.page.getByText(/expired|can't be found/i).first()).toBeVisible({ timeout: 10_000 });
});

test("TC-F13-78 [AC-F13-21] a reminder card in each of Mo's windows; Snooze closes both, it comes back, Join opens the pre-join", async () => {
  test.skip(!hasBackendServices(), "needs the pnpm dev containers");
  const { people, olivia, mo } = await pair();
  const second = await windowFor(people.member);
  windows.push(second);
  await inWorkspace(second.page, people.workspace);
  const title = named("Review");
  const declined = named("Skipped");
  const start = minutesFromNow(15);
  await schedule(olivia.page, { title, invite: ["Mo Member"], start });
  await schedule(olivia.page, { title: declined, invite: ["Mo Member"], start });
  await openDetails(mo.page, title);
  await answer(mo.page, "Accept");
  await openDetails(mo.page, declined);
  await answer(mo.page, "Decline");

  // The job runs every minute; the card says "Starts in 15 min" (or 14) with the title.
  await expect.poll(async () => (await reminderCards(mo.app)).length, { timeout: 150_000 }).toBe(1);
  await expect.poll(async () => (await reminderCards(second.app)).length, { timeout: 10_000 }).toBe(1);
  const card = (await reminderCards(mo.app))[0] as Page;
  await expect(card.getByText(title)).toBeVisible();
  await expect(card.getByText(/Starts in 1[45] min/)).toBeVisible();
  await card.getByRole("button", { name: "Snooze" }).click();
  await expect.poll(async () => (await reminderCards(second.app)).length, { timeout: 10_000 }).toBe(0);

  // The snooze ends now (instead of in 5 minutes): the card returns at the job's next run.
  sql(
    `update reminder_dismissals set snoozed_until = now() where snoozed_until is not null and meeting_id in (select id from meetings where title = '${title}');`,
  );
  await expect.poll(async () => (await reminderCards(mo.app)).length, { timeout: 150_000 }).toBe(1);
  const again = (await reminderCards(mo.app))[0] as Page;
  await expect(again.getByText(declined)).toHaveCount(0);
  await again.getByRole("button", { name: "Join" }).click();
  await expect(mo.page.getByRole("button", { name: /^Join now/ })).toBeVisible({ timeout: 15_000 });
});

test("TC-F13-79 [AC-F13-07, 24] a meeting scheduled with the keyboard only; axe finds nothing on the calendar, form and details", async () => {
  const { olivia } = await pair();
  const page = olivia.page;
  await expectAccessible(page, "calendar");
  const newMeeting = page.getByRole("button", { name: "New meeting" });
  await newMeeting.focus();
  await page.keyboard.press("Enter");
  // The new screen's heading takes focus first (the app's rule); Tab reaches the title.
  for (let i = 0; i < 20 && !(await page.getByLabel("Title").evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(page.getByLabel("Title")).toBeFocused();
  await expectAccessible(page, "form");
  const title = named("Keyboard");
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("radio", { name: "Week", exact: true }).focus();
  const meeting = block(page, title);
  await meeting.focus();
  await expect(meeting).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
  await expectAccessible(page, "details");
});

test("TC-F13-80 [AC-F13-28] notes show as text, and their link opens in the browser", async () => {
  const { olivia, mo } = await pair();
  await mo.app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
  const title = named("Notes");
  const notes = "<script>alert(1)</script> Agenda: https://example.com/agenda";
  await schedule(olivia.page, { title, invite: ["Mo Member"], start: minutesFromNow(90), notes });
  await expect(block(mo.page, title)).toBeVisible({ timeout: 5_000 });
  await openDetails(mo.page, title);
  await expect(mo.page.getByText("<script>alert(1)</script>", { exact: false })).toBeVisible();
  await mo.page.getByRole("link", { name: "https://example.com/agenda" }).click();
  await expect
    .poll(() => mo.app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []))
    .toEqual(["https://example.com/agenda"]);
  expect(mo.app.windows().some((page) => page.url().startsWith("https://example.com"))).toBe(false);
});

test("TC-F13-81 [AC-F13-01, 02, 05, 06] views, the computer's time format, the now-line, a declined block and the empty hint", async () => {
  const { olivia, mo } = await pair();
  const title = named("Declined");
  const start = minutesFromNow(60);
  await schedule(olivia.page, { title, invite: ["Mo Member"], start });
  await expect(block(mo.page, title)).toBeVisible({ timeout: 5_000 });
  await openDetails(mo.page, title);
  await answer(mo.page, "Decline");
  await expect(block(mo.page, title)).toHaveAccessibleName(/Declined/, { timeout: 5_000 });
  await expect(block(mo.page, title)).toHaveCSS("text-decoration-line", "line-through");
  // The time reads as this computer writes it (its zone, language and 12/24-hour habit).
  const expected = await mo.page.evaluate(
    (at) => new Intl.DateTimeFormat(navigator.language, { hour: "numeric", minute: "2-digit" }).format(new Date(at)),
    start.toISOString(),
  );
  await expect(block(mo.page, title)).toContainText(expected);
  await expect(mo.page.getByTestId("now-line")).toHaveCount(1);
  for (const view of ["Day", "Week", "Month", "Work week"])
    await mo.page.getByRole("radio", { name: view, exact: true }).click();
  // Far ahead, a week with nothing in it.
  for (let i = 0; i < 30; i++) await mo.page.getByRole("button", { name: "Next" }).click();
  await expect(mo.page.getByText("No meetings. Select New meeting to schedule one.")).toBeVisible();
});

test("TC-F13-82 [AC-F13-32] offline: the calendar stays with a notice; New meeting and answers wait", async () => {
  const { olivia, mo } = await pair();
  const title = named("Offline");
  await schedule(olivia.page, { title, invite: ["Mo Member"], start: minutesFromNow(90) });
  await expect(block(mo.page, title)).toBeVisible({ timeout: 5_000 });
  await openDetails(mo.page, title);
  await mo.page.context().setOffline(true);
  await mo.page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(mo.page.getByText(/You're offline/)).toBeVisible();
  await expect(block(mo.page, title)).toBeVisible();
  await expect(mo.page.getByRole("button", { name: "New meeting" })).toBeDisabled();
  // Answering waits for the connection: the choices aren't offered offline.
  await expect(mo.page.getByRole("radiogroup", { name: "Your answer" })).toHaveCount(0);
  await mo.page.context().setOffline(false);
});
