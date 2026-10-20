// What stays text and what stays off the disk (F02 T17): TC-F02-107 HTML-looking names and titles on every
// meeting screen (the desktop part; the server part is html-text.integration.test.ts), and TC-F02-114 the
// meeting ticket and device key. Needs the backend and Mailpit (`pnpm test`).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hasBackendServices, sql } from "./backend-control.ts";
import { FAKE_MEDIA, closeApp, freshProfile, launch } from "./desktop.ts";
import { admitAll, controls, findByLink, joinAsGuest, LINK, pace } from "./meeting-steps.ts";
import { actOn, hostMeeting, joinWindow, openInfo, openPeople, rowOf, team, windowFor } from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });
const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";

const TITLE = "<script>window.__xss=1</script>";
const GUEST = "<img src=x onerror=window.__xss=1>";
const GUEST_SHOWN = `${GUEST} (Guest)`;

/** Nothing in the page ran or became an element: no flag set, no picture from the name, no handler. */
async function expectOnlyText(page: Page) {
  const found = await page.evaluate(() => ({
    ran: (window as unknown as { __xss?: number }).__xss,
    images: document.querySelectorAll("img[src='x']").length,
    handlers: document.querySelectorAll("[onerror]").length,
    inline: [...document.scripts].filter((script) => !script.src).length,
  }));
  expect(found).toEqual({ ran: undefined, images: 0, handlers: 0, inline: 0 });
}

test("TC-F02-107 [AC-F02-51] a title and a guest name that look like HTML stay plain text on every meeting screen", async () => {
  const who = await team();
  // A meeting whose title looks like a script, made with Get link; the organizer joins by its link.
  const host = await windowFor(who.owner);
  await host.page.getByRole("button", { name: "Meetings" }).click();
  await host.page.getByLabel("Title (optional)").fill(TITLE);
  await host.page.getByRole("button", { name: "Get link" }).click();
  const ready = host.page.getByRole("dialog", { name: "Your meeting link is ready" });
  await expect(ready.getByText(TITLE)).toBeVisible();
  const link = (await ready.getByText(LINK).textContent()) ?? "";
  await ready.getByRole("button", { name: "Done" }).click();
  await findByLink(host.page, link);
  await expect(host.page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expectOnlyText(host.page);
  await host.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(host.page)).toBeVisible({ timeout: 20_000 });
  await expect(host.page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();

  const mo = await joinWindow(who.member, link);
  // The guest: the pre-join screen, the lobby bar, then inside.
  const guest = await launch(undefined, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await joinAsGuest(guest.page, link, GUEST);
  await expect(host.page.getByRole("region", { name: "Lobby", exact: true })).toContainText(GUEST_SHOWN, {
    timeout: 15_000,
  });
  await admitAll(host.page, GUEST);
  await expect(controls(guest.page)).toBeVisible({ timeout: 20_000 });

  // Participants, tiles, Meeting info, and the live announcements.
  await openPeople(host.page);
  await expect(rowOf(host.page, GUEST_SHOWN)).toBeVisible();
  await expect(host.page.getByRole("figure", { name: new RegExp(`^${escapeRegExp(GUEST_SHOWN)}`) })).toBeVisible();
  await expect(host.page.locator("[aria-live]", { hasText: `${GUEST} joined` }).first()).toBeAttached();
  await openInfo(host.page);
  await expect(host.page.getByText(TITLE).first()).toBeVisible();

  // Messages that carry the guest's name: "X muted you" and "X removed you" (everybody may present by default, so the guest can mute and remove).
  await actOn(guest.page, "Mo Member", "Mute");
  await expect(mo.page.getByText(`${GUEST} muted you`).first()).toBeVisible({ timeout: 10_000 });
  await actOn(guest.page, "Mo Member", "Remove from meeting");
  await expect(mo.page.getByText(`${GUEST} removed you.`, { exact: false })).toBeVisible({ timeout: 15_000 });
  for (const window of [host, guest, mo]) await expectOnlyText(window.page);
});

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every file under `folder` (the app's settings, caches and storage) whose bytes contain `text`. */
function filesContaining(folder: string, text: string): string[] {
  const needles = [Buffer.from(text, "utf8"), Buffer.from(text, "utf16le")];
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...filesContaining(path, text));
    else if (entry.isFile() && statSync(path).size < 200_000_000) {
      const bytes = readFileSync(path);
      if (needles.some((needle) => bytes.includes(needle))) found.push(path);
    }
  }
  return found;
}

test("TC-F02-114 [AC-F02-54] [AC-F02-35] the meeting ticket is nowhere on disk and gone after closing; the device key is a random 32-byte value kept apart", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const profile = freshProfile();
  const guest = await launch(profile, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  let joined: { ticket: string; attendanceId: string } | undefined;
  let sent = "";
  guest.page.on("response", (response) => {
    if (!response.url().endsWith("/api/v1/meetings/join")) return;
    sent = response.request().postData() ?? "";
    void response.json().then((body: { ticket: string; attendanceId: string }) => (joined = body));
  });
  await joinAsGuest(guest.page, link, "Gus Guest");
  await admitAll(host.page, "Gus Guest");
  await expect(controls(guest.page)).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => joined?.ticket).toBeTruthy();
  const ticket = joined?.ticket ?? "";
  const key = (JSON.parse(sent) as { deviceKey: string }).deviceKey;

  // Inside the page: not in local storage, session storage or cookies.
  const stored = await guest.page.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }, document.cookie]),
  );
  expect(stored).not.toContain(ticket);
  expect(JSON.stringify(await guest.page.context().cookies())).not.toContain(ticket);

  // The device key: a random 32-byte value in its own file; no other file of the app holds it.
  const keyFile = join(profile, "device-key");
  expect(existsSync(keyFile)).toBe(true);
  expect(readFileSync(keyFile, "utf8").trim()).toBe(key);
  expect(Buffer.from(key, "base64url")).toHaveLength(32);

  // After closing the window the ticket is nowhere on disk, and the same app starts outside any meeting.
  await closeApp(guest.app);
  expect(filesContaining(profile, ticket)).toEqual([]);
  expect(filesContaining(profile, key).map((file) => file.replace(`${profile}/`, ""))).toEqual(["device-key"]);
  const again = await launch(profile, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await expect(again.page.getByRole("link", { name: "Join a meeting" })).toBeVisible();
  await expect(controls(again.page)).toHaveCount(0);
  expect(readFileSync(keyFile, "utf8").trim()).toBe(key);
  expect(await again.page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))).not.toContain(
    ticket,
  );
  await pace();

  // At the backend: the ticket and the key are kept only as fingerprints.
  test.skip(!hasBackendServices(), "the database check needs the containers of `pnpm dev`");
  const row = sql(`select row_to_json(a)::text from call_attendances a where id = '${joined?.attendanceId ?? ""}';`);
  expect(row).toContain("ticket_hash");
  expect(row).toContain("guest_device_hash");
  expect(row).not.toContain(ticket);
  expect(row).not.toContain(key);
});
