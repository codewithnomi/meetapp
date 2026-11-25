// Steps the calendar tests share (F13): open the Calendar, schedule a meeting through the New meeting form,
// find a meeting's block, open its details and answer. Times are typed in this computer's own zone, the
// same one the app uses.
import { expect, type ElectronApplication, type Page } from "@playwright/test";
import { smallPages } from "./call-window-steps.ts";
import { openScreen } from "./workspace-steps.ts";

const two = (n: number) => String(n).padStart(2, "0");
const dateText = (at: Date) => `${String(at.getFullYear())}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
const timeText = (at: Date) => `${two(at.getHours())}:${two(at.getMinutes())}`;
/** The next whole minute from now, plus `minutes`. */
export const minutesFromNow = (minutes: number) => {
  const at = new Date(Date.now() + minutes * 60_000);
  at.setSeconds(0, 0);
  return new Date(at.getTime() + 60_000);
};

export async function openCalendar(page: Page): Promise<void> {
  await openScreen(page, "Calendar");
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
}

export interface NewMeeting {
  title: string;
  invite?: string[];
  start: Date;
  minutes?: number;
  repeat?: "weekly";
  notes?: string;
}

/** The form's fields filled from `meeting` (the form is open). */
async function fillForm(page: Page, meeting: NewMeeting): Promise<void> {
  await page.getByLabel("Title").fill(meeting.title);
  for (const name of meeting.invite ?? []) {
    await page.getByRole("combobox", { name: "People to invite" }).fill(name.split(" ")[0] ?? name);
    await page.getByRole("option", { name: new RegExp(name) }).click();
  }
  const end = new Date(meeting.start.getTime() + (meeting.minutes ?? 30) * 60_000);
  await page.getByLabel("Starts", { exact: true }).fill(dateText(meeting.start));
  await page.getByLabel("Start time").fill(timeText(meeting.start));
  await page.getByLabel("Ends", { exact: true }).fill(dateText(end));
  await page.getByLabel("End time").fill(timeText(end));
  if (meeting.repeat) await page.getByLabel("Repeat", { exact: true }).selectOption(meeting.repeat);
  if (meeting.notes) await page.getByLabel("Notes").fill(meeting.notes);
}

/** New meeting → the form → Send; back on the calendar. */
export async function schedule(page: Page, meeting: NewMeeting): Promise<void> {
  await page.getByRole("button", { name: "New meeting" }).click();
  await expect(page.getByRole("heading", { name: "New meeting" })).toBeVisible();
  await fillForm(page, meeting);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible({ timeout: 15_000 });
}

/** A meeting's block in the grid ("title, time, answer"). */
export const block = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${title}, `) }).first();

/** Opens a meeting's details beside the grid. */
export async function openDetails(page: Page, title: string): Promise<void> {
  // Another meeting's details close first, as a person would.
  const close = page.getByRole("button", { name: "Close details" });
  if (await close.isVisible()) await close.click();
  await block(page, title).click();
  await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
}

/** Picks an answer in the details; a repeating meeting asks which ones first. */
export async function answer(
  page: Page,
  choice: "Accept" | "Maybe" | "Decline",
  scope?: "This meeting" | "All in series",
) {
  await page.getByRole("radiogroup", { name: "Your answer" }).getByRole("radio", { name: choice }).click();
  if (!scope) return;
  await page.getByRole("radio", { name: scope }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

/** The reminder cards among the small windows. */
export async function reminderCards(app: ElectronApplication): Promise<Page[]> {
  const found: Page[] = [];
  for (const page of smallPages(app))
    if (!page.isClosed() && (await page.getByRole("button", { name: "Snooze" }).count()) > 0) found.push(page);
  return found;
}
