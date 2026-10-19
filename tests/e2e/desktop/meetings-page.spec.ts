// The Meetings page in the real app (F02 T12): TC-F02-13 Meet now and Meeting info, TC-F02-14 Get a
// meeting link and its dialog, TC-F02-18 joining by link, by ID and passcode, as a guest, and the wrong
// and expired cases. Needs the backend and Mailpit, so it runs from `pnpm test`.
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launch, launchNewAccount } from "./desktop.ts";
import { controls, infoLink, LINK } from "./meeting-steps.ts";

test.describe.configure({ timeout: 120_000 });

const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";
const clipboard = (app: Awaited<ReturnType<typeof launchNewAccount>>["app"]) =>
  app.evaluate(({ clipboard: board }) => board.readText());

/** Meetings, Get link with a title; the link-ready dialog stays open. */
async function getLink(page: Page, title: string) {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByLabel("Title (optional)").fill(title);
  await page.getByRole("button", { name: "Get link" }).click();
  const dialog = page.getByRole("dialog", { name: "Your meeting link is ready" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("TC-F02-13 [AC-F02-01] Meet now opens the pre-join with the title, and Meeting info copies link, ID and passcode", async () => {
  const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await me.page.getByRole("button", { name: "Meetings" }).click();
  await me.page.getByRole("button", { name: "Meet now" }).click();
  await expect(me.page.getByRole("heading", { level: 1, name: "Meeting with E2E Person" })).toBeVisible();
  await me.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(me.page)).toBeVisible({ timeout: 20_000 });

  const link = await infoLink(me.page);
  expect(link).toMatch(LINK);
  // Copy: the panel's status line says "Copied" and the link is on the clipboard (copying is async).
  const info = me.page.getByRole("complementary", { name: "Meeting info" });
  await info.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(info.getByRole("status")).toHaveText("Copied");
  await expect.poll(() => clipboard(me.app)).toBe(link);

  const passcode =
    (await me.page.locator("dt", { hasText: "Passcode" }).locator("xpath=following-sibling::dd[1]").textContent()) ??
    "";
  const number =
    (await me.page.locator("dt", { hasText: "Meeting ID" }).locator("xpath=following-sibling::dd[1]").textContent()) ??
    "";
  expect(number).toMatch(/^\d{3} \d{3} \d{3} \d{3}$/);
  expect(passcode).toMatch(/^[\w]{6}$/);
  await info.getByRole("button", { name: "Copy all details" }).click();
  await expect.poll(() => clipboard(me.app)).toContain(`Link: ${link}`);
  const all = await clipboard(me.app);
  expect(all).toContain(`Meeting ID: ${number}`);
  expect(all).toContain(`Passcode: ${passcode}`);
});

test("TC-F02-14 [AC-F02-02] Get a meeting link shows link, ID and passcode with Copy, does not join, and Meeting options open with defaults", async () => {
  const me = await launchNewAccount();
  const dialog = await getLink(me.page, "Budget review");
  await expect(dialog.getByText("Budget review")).toBeVisible();
  const link = (await dialog.getByText(LINK).textContent()) ?? "";
  expect(link).toMatch(LINK);

  // Soft checks: the desktop app's permission rules refuse the page's clipboard write (see the report).
  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect.soft(dialog.getByRole("status")).toHaveText("Link copied");
  expect.soft(await clipboard(me.app)).toBe(link);
  await dialog.getByRole("button", { name: "Copy ID" }).click();
  await expect.soft(dialog.getByRole("status")).toHaveText("Meeting ID copied");
  expect.soft(await clipboard(me.app)).toMatch(/^\d{12}$/);
  await dialog.getByRole("button", { name: "Copy passcode" }).click();
  await expect.soft(dialog.getByRole("status")).toHaveText("Passcode copied");
  expect.soft(await clipboard(me.app)).toMatch(/^[\w]{6}$/);
  // The app did not join the call.
  await expect(controls(me.page)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Meeting options" }).click();
  const options = me.page.getByRole("dialog", { name: "Meeting options" });
  await expect(options).toBeVisible();
  await expect(options.getByRole("combobox", { name: "Who can skip the lobby?" })).toHaveValue("workspace");
  await expect(options.getByRole("combobox", { name: "Who can present?" })).toHaveValue("everyone");
  await expect(options.getByRole("switch", { name: "Allow mic for attendees" })).toBeChecked();
  await expect(options.getByRole("switch", { name: "Allow camera for attendees" })).toBeChecked();
  await expect(controls(me.page)).toHaveCount(0);
});

/** The value in the dialog's row ("Meeting ID", "Passcode"). */
const rowValue = (dialog: ReturnType<Page["getByRole"]>, term: string) =>
  dialog.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]").textContent();

test("TC-F02-18 [AC-F02-08] a member joins by link and by ID and passcode; a guest from the sign-in screen; wrong and expired values", async () => {
  const me = await launchNewAccount();
  const dialog = await getLink(me.page, "Join test");
  const link = (await dialog.getByText(LINK).textContent()) ?? "";
  const number = ((await rowValue(dialog, "Meeting ID")) ?? "").replace(/\s/g, "");
  const passcode = (await rowValue(dialog, "Passcode")) ?? "";
  await dialog.getByRole("button", { name: "Done" }).click();
  const title = me.page.getByRole("heading", { level: 1, name: "Join test" });

  await me.page.getByRole("radio", { name: "Link" }).click();
  await me.page.getByLabel("Meeting link").fill(link);
  await me.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(title).toBeVisible();
  await me.page.getByRole("button", { name: "Cancel" }).click();

  await me.page.getByRole("radio", { name: "Meeting ID" }).click();
  await me.page.getByRole("textbox", { name: "Meeting ID" }).fill(number);
  await me.page.getByRole("textbox", { name: "Passcode" }).fill(passcode);
  await me.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(title).toBeVisible();
  await me.page.getByRole("button", { name: "Cancel" }).click();

  // A wrong passcode: the same words as any miss, and nothing more.
  await me.page.getByRole("radio", { name: "Meeting ID" }).click();
  await me.page.getByRole("textbox", { name: "Meeting ID" }).fill(number);
  await me.page.getByRole("textbox", { name: "Passcode" }).fill("zzzzzz");
  await me.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(
    me.page.getByText("We couldn't find that meeting. Check the link, or the ID and passcode."),
  ).toBeVisible();
  await expect(me.page.getByText("passcode is wrong")).toHaveCount(0);

  // An expired meeting (the lookup answer is replaced; the 60 days can't be waited for).
  await me.page.route("**/api/v1/meeting-lookups", (route) =>
    route.fulfill({
      status: 410,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify({ error: { code: "MEETING_EXPIRED" } }),
    }),
  );
  await me.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(me.page.getByText("This meeting has expired. Ask the organizer for a new one.")).toBeVisible();
  await me.page.unroute("**/api/v1/meeting-lookups");

  // A guest: Join a meeting on the sign-in screen, then the pre-join with the title and a name field.
  const guest = await launch(undefined, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await guest.page.getByRole("link", { name: "Join a meeting" }).click();
  await guest.page.getByRole("radio", { name: "Link" }).click();
  await guest.page.getByLabel("Meeting link").fill(link);
  await guest.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(guest.page.getByRole("heading", { level: 1, name: "Join test" })).toBeVisible();
  await expect(guest.page.getByLabel("Your name")).toBeVisible();
});
