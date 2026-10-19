// A small team for the meeting tests with several different people (F02): the owner, a member of the
// owner's company workspace, and an outsider with an account elsewhere. The three accounts are made once
// per run (the backend allows 50 sign-ups an hour) and every test opens windows for them. Guests need no
// account. Each person has their own name, so their tiles can be told apart.
import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { FAKE_MEDIA, closeApp, freshProfile, launch, launchAs, launchNewAccount, type RunningApp } from "./desktop.ts";
import { admitAll, controls, findByLink, infoLink, joinAsGuest, joinByLink, meetNow } from "./meeting-steps.ts";
import { acceptInvitation, createWorkspace, inviteByEmail } from "./workspace-steps.ts";

export interface Person {
  email: string;
  name: string;
}
export interface Team {
  workspace: string;
  owner: Person;
  member: Person;
  outsider: Person;
}

let created: Promise<Team> | undefined;

async function createTeam(): Promise<Team> {
  const workspace = `Team ${randomUUID().slice(0, 8)}`;
  const owner = await launchNewAccount(undefined, undefined, [], "Olivia Owner");
  await createWorkspace(owner.page, "Personal", workspace);
  const memberEmail = `e2e-${randomUUID()}@example.test`;
  await inviteByEmail(owner.page, memberEmail);
  const member = await launchNewAccount(freshProfile(), memberEmail, [], "Mo Member");
  await acceptInvitation(member.page, "Personal", workspace);
  const outsider = await launchNewAccount(undefined, undefined, [], "Xena Outsider");
  await Promise.all([owner, member, outsider].map((running) => closeApp(running.app)));
  return {
    workspace,
    owner: { email: owner.email, name: "Olivia Owner" },
    member: { email: member.email, name: "Mo Member" },
    outsider: { email: outsider.email, name: "Xena Outsider" },
  };
}

/** The team, made on first use (a failed attempt is tried again by the next test). */
export function team(): Promise<Team> {
  created ??= createTeam().catch((error: unknown) => {
    created = undefined;
    throw error;
  });
  return created;
}

const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";

/** A window for a person of the team, signed in, with the stand-in camera and microphone. */
export const windowFor = (person: Person): Promise<RunningApp> => launchAs(person.email, undefined, FAKE_MEDIA);

/** The organizer in a running meeting of the team's workspace; the link is read and the info panel closed. */
export async function hostMeeting(who: Team) {
  const host = await windowFor(who.owner);
  await meetNow(host.page);
  const link = await infoLink(host.page);
  await host.page.getByRole("button", { name: "Close meeting info" }).click();
  return { host, link };
}

/** A team member opens the link and presses Join now; the workspace's people go straight in. */
export async function joinWindow(person: Person, link: string): Promise<RunningApp> {
  const running = await windowFor(person);
  await joinByLink(running.page, link);
  return running;
}

/** A guest window: joins by the link as `name`; when `host` is given, lets the guest in. */
export async function guestWindow(link: string, name: string, host?: Page): Promise<RunningApp> {
  const running = await launch(undefined, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await joinAsGuest(running.page, link, name);
  if (host) {
    await admitAll(host, name);
    await expect(controls(running.page)).toBeVisible({ timeout: 20_000 });
  }
  return running;
}

/** Signed in, outside the workspace: opens the link and presses Join now; stops in the lobby. */
export async function knock(person: Person, link: string): Promise<RunningApp> {
  const running = await windowFor(person);
  await findByLink(running.page, link);
  await running.page.getByRole("button", { name: "Join now" }).click();
  return running;
}

/** Opens a side panel from the control bar unless it is open already. */
async function openPanel(page: Page, opener: Locator, marker: Locator): Promise<void> {
  if (!(await marker.isVisible())) await opener.click();
  await expect(marker).toBeVisible();
}

export const openPeople = (page: Page) =>
  openPanel(
    page,
    controls(page).getByRole("button", { name: /^Participants, / }),
    page.getByRole("heading", { name: /^Participants \(/ }),
  );

export const openInfo = (page: Page) =>
  openPanel(
    page,
    controls(page).getByRole("button", { name: "Meeting info" }),
    page.getByRole("heading", { name: "Meeting info" }),
  );

/** In the call: the Meeting options dialog, opened from Meeting info. */
export async function openOptions(page: Page): Promise<Locator> {
  await openInfo(page);
  await page.getByRole("button", { name: "Meeting options" }).click();
  const dialog = page.getByRole("dialog", { name: "Meeting options" });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function saveOptions(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

/** The organizer lets only organizers and co-organizers present, so everybody else is an attendee. */
export async function onlyOrganizersPresent(page: Page): Promise<void> {
  const dialog = await openOptions(page);
  await dialog.getByRole("combobox", { name: "Who can present?" }).selectOption("organizers");
  await saveOptions(page, dialog);
}

/** One of a person's actions in the Participants panel: "Mute", "Make a presenter", "Remove from meeting"… */
export async function actOn(page: Page, shownName: string, action: string): Promise<void> {
  await openPeople(page);
  await page.getByRole("button", { name: `Actions for ${shownName}` }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

/** The row of a person in the Participants panel. */
export const rowOf = (page: Page, shownName: string) =>
  page
    .getByRole("list", { name: /^In the meeting/ })
    .getByRole("listitem")
    .filter({ hasText: shownName });
