// Several people in one meeting (F02 T17): the same account twice (TC-F02-24), the participant list
// (TC-F02-52), muting (TC-F02-69), options and roles (TC-F02-71, 74). Needs the backend and Mailpit.
import { expect, test, type Page } from "@playwright/test";
import { admitAll, controls, screenAllowed, tile } from "./meeting-steps.ts";
import {
  actOn,
  guestWindow,
  hostMeeting,
  joinWindow,
  knock,
  onlyOrganizersPresent,
  openOptions,
  openPeople,
  rowOf,
  saveOptions,
  team,
} from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });

const GUS = "Gus Guest (Guest)";
const notAllowedToShare = (page: Page) => controls(page).getByRole("button", { name: "Only presenters can share" });
const mayShare = (page: Page) => controls(page).getByRole("button", { name: "Share screen" });

test("TC-F02-24 [AC-F02-13] the same account in two windows is two participants; leaving in one keeps the other", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const second = await joinWindow(who.owner, link);
  const third = await joinWindow(who.member, link);
  const olivia = (page: typeof third.page) => tile(page, /^Olivia Owner, /);
  await expect(olivia(third.page)).toHaveCount(2, { timeout: 20_000 });
  await controls(second.page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(olivia(third.page)).toHaveCount(1, { timeout: 10_000 });
  await expect(controls(host.page)).toBeVisible();
  await expect(tile(host.page, /^Olivia Owner \(you\), /)).toBeVisible();
});

test("TC-F02-52 [AC-F02-26] the participant list shows role, mic, camera, hand, External and Guest; the lobby is only for organizers", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  await onlyOrganizersPresent(host.page);
  const xena = await knock(who.outsider, link);
  await admitAll(host.page, who.outsider.name);
  const gus = await guestWindow(link, "Gus Guest", host.page);
  await controls(xena.page)
    .getByRole("button", { name: /^Mute \(/ })
    .click();
  await controls(gus.page)
    .getByRole("button", { name: /^Raise your hand/ })
    .click();
  const gil = await guestWindow(link, "Gil Guest");

  await openPeople(host.page);
  const lobby = host.page.getByLabel("Waiting in the lobby (1)");
  await expect(lobby).toContainText("Gil Guest (Guest)", { timeout: 15_000 });
  // The lobby sits above the list of people in the meeting.
  const lobbyTop = (await lobby.boundingBox())?.y ?? 0;
  const listTop = (await host.page.getByRole("list", { name: /^In the meeting/ }).boundingBox())?.y ?? 0;
  expect(lobbyTop).toBeLessThan(listTop);

  const xenaRow = rowOf(host.page, "Xena Outsider (External)");
  await expect(xenaRow).toContainText("Attendee");
  await expect(xenaRow.getByRole("img", { name: "Muted" })).toBeVisible({ timeout: 10_000 });
  await expect(xenaRow.getByRole("img", { name: "Camera on" })).toBeVisible();
  const gusRow = rowOf(host.page, GUS);
  await expect(gusRow).toContainText("Attendee");
  await expect(gusRow.getByRole("img", { name: "Hand raised" })).toBeVisible({ timeout: 10_000 });
  await expect(gusRow.getByRole("img", { name: "Microphone on" })).toBeVisible();
  const olivia = rowOf(host.page, "Olivia Owner (you)");
  await expect(olivia).toContainText("Organizer");

  // An attendee sees the same list, but no lobby (and no actions).
  await openPeople(gus.page);
  await expect(gus.page.getByLabel(/^Waiting in the lobby/)).toHaveCount(0);
  await expect(rowOf(gus.page, "Xena Outsider (External)")).toContainText("Attendee");
  // The only action an attendee has on someone else is Pin for me; nothing that changes the meeting.
  await gus.page.getByRole("button", { name: "Actions for Xena Outsider (External)" }).click();
  await expect(gus.page.getByRole("menuitem")).toHaveText(["Pin for me"]);
  await gus.page.keyboard.press("Escape");
  await expect(gil.page.getByText("Someone in the meeting will let you in soon.")).toBeVisible();
});

test("TC-F02-69 [AC-F02-33] the organizer mutes one person, then everybody; the muted person is told and can unmute", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const gus = await guestWindow(link, "Gus Guest", host.page);
  const unmuteButton = (page: typeof mo.page) => controls(page).getByRole("button", { name: /^Unmute/ });
  const muteButton = (page: typeof mo.page) => controls(page).getByRole("button", { name: /^Mute \(/ });

  await actOn(host.page, "Mo Member", "Mute");
  await expect(mo.page.getByText("Olivia Owner muted you").first()).toBeVisible({ timeout: 10_000 });
  // The message is read out: it sits in a live region.
  await expect(mo.page.locator("[aria-live]", { hasText: "Olivia Owner muted you" }).first()).toBeAttached();
  await expect(unmuteButton(mo.page)).toBeVisible();
  await unmuteButton(mo.page).click();
  await expect(muteButton(mo.page)).toBeVisible();

  await host.page.getByRole("button", { name: "Mute all" }).click();
  await expect(unmuteButton(mo.page)).toBeVisible({ timeout: 10_000 });
  await expect(unmuteButton(gus.page)).toBeVisible({ timeout: 10_000 });
  // Whoever pressed Mute all stays unmuted.
  await expect(muteButton(host.page)).toBeVisible();
  await expect(tile(mo.page, /^Olivia Owner, .*Muted/)).toHaveCount(0);
  // The muted person can unmute at any time.
  await unmuteButton(mo.page).click();
  await expect(muteButton(mo.page)).toBeVisible();
});

test("TC-F02-71 [AC-F02-34] [AC-F02-36] a co-organizer turns off attendees' mics; the attendee can't unmute until made presenter", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const dialog = await openOptions(host.page);
  await dialog.getByRole("combobox", { name: "Who can present?" }).selectOption("organizers");
  await dialog.getByRole("searchbox", { name: "Add a person from this workspace" }).fill("Mo");
  await dialog.getByRole("button", { name: "Add Mo Member as co-organizer" }).click();
  await saveOptions(host.page, dialog);
  const mo = await joinWindow(who.member, link);
  const gus = await guestWindow(link, "Gus Guest", host.page);
  await expect(controls(mo.page).getByRole("button", { name: "More ways to leave" })).toBeVisible();

  const options = await openOptions(mo.page);
  await options.getByRole("switch", { name: "Allow mic for attendees" }).click();
  await saveOptions(mo.page, options);
  const blocked = controls(gus.page).getByRole("button", { name: "Microphones are off for attendees" });
  await expect(blocked).toBeVisible({ timeout: 10_000 });
  await expect(blocked).toBeDisabled();

  await actOn(mo.page, GUS, "Make a presenter");
  await expect(controls(gus.page).getByRole("button", { name: /^(Mute|Unmute) \(/ })).toBeEnabled({
    timeout: 10_000,
  });
  await expect(blocked).toHaveCount(0);
});

test("TC-F02-74 [AC-F02-35] [AC-F02-36] roles change rights at once; a removed person is told by whom and waits in the lobby on return", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  await onlyOrganizersPresent(host.page);
  const gus = await guestWindow(link, "Gus Guest", host.page);
  const mo = await joinWindow(who.member, link);
  await expect(notAllowedToShare(gus.page)).toBeVisible();

  await actOn(host.page, GUS, "Make a presenter");
  await expect(mayShare(gus.page)).toBeVisible({ timeout: 5_000 });
  if (await screenAllowed(gus.page)) {
    await mayShare(gus.page).click();
    await gus.page.getByRole("radiogroup", { name: "Screens" }).getByRole("radio").first().click();
    await gus.page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(gus.page.getByRole("button", { name: "Stop sharing" })).toBeVisible({ timeout: 15_000 });
  }
  // Made an attendee: the share stops and the button goes at once.
  await actOn(host.page, GUS, "Make an attendee");
  await expect(notAllowedToShare(gus.page)).toBeVisible({ timeout: 5_000 });
  await expect(gus.page.getByRole("button", { name: "Stop sharing" })).toHaveCount(0);

  await actOn(host.page, "Mo Member", "Make a presenter");
  await expect(mayShare(mo.page)).toBeVisible({ timeout: 5_000 });
  await actOn(host.page, "Mo Member", "Remove from meeting");
  await expect(mo.page.getByRole("heading", { name: "You were removed from the meeting" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(mo.page.getByText("Olivia Owner removed you.", { exact: false })).toBeVisible();

  // Back again: a removed person waits in the lobby, though members normally go straight in.
  await mo.page.getByRole("button", { name: "Back to home" }).click();
  await mo.page.getByRole("button", { name: "Meetings" }).click();
  await mo.page.getByRole("radio", { name: "Link" }).click();
  await mo.page.getByLabel("Meeting link").fill(link);
  await mo.page.getByRole("button", { name: "Join", exact: true }).click();
  await mo.page.getByRole("button", { name: "Join now" }).click();
  await expect(mo.page.getByText("Someone in the meeting will let you in soon.")).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("region", { name: "Lobby", exact: true })).toContainText("Mo Member", {
    timeout: 15_000,
  });
});
