// Locking and ending a meeting for everyone, in the real app with several windows (F02 T17): TC-F02-77
// lock, TC-F02-79 End meeting. Needs the backend and Mailpit (`pnpm test`).
import { expect, test, type Page } from "@playwright/test";
import { admitAll, controls, findByLink, pace } from "./meeting-steps.ts";
import { guestWindow, hostMeeting, joinWindow, knock, openOptions, team, windowFor } from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });

const ended = (page: Page) => page.getByRole("heading", { name: "The meeting has ended" });

test("TC-F02-77 [AC-F02-37] a locked meeting turns away the waiting and newcomers with the same message; unlocking lets them in", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const gus = await guestWindow(link, "Gus Guest");
  await expect(host.page.getByRole("region", { name: "Lobby", exact: true })).toContainText("Gus Guest", {
    timeout: 15_000,
  });

  const options = await openOptions(host.page);
  await options.getByRole("switch", { name: "Lock the meeting" }).click();
  await options.getByRole("button", { name: "Close", exact: true }).first().click();
  // The person waiting is turned away at once.
  await expect(gus.page.getByRole("heading", { name: "This meeting is locked" })).toBeVisible({ timeout: 15_000 });
  await expect(controls(mo.page)).toBeVisible();

  // A newcomer (signed in, outside the workspace) gets the same words and is not in the lobby.
  const xena = await windowFor(who.outsider);
  await findByLink(xena.page, link);
  await xena.page.getByRole("button", { name: "Join now" }).click();
  await expect(xena.page.getByText("This meeting is locked").first()).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("region", { name: "Lobby", exact: true })).toHaveCount(0, { timeout: 20_000 });

  // Unlocked: the newcomer can join (and waits for someone to let them in).
  const again = await openOptions(host.page);
  await again.getByRole("switch", { name: "Lock the meeting" }).click();
  await again.getByRole("button", { name: "Close", exact: true }).first().click();
  // The newcomer is still on the pre-join screen and tries again.
  await pace();
  await xena.page.getByRole("button", { name: "Join now" }).click();
  await admitAll(host.page, who.outsider.name);
  await expect(controls(xena.page)).toBeVisible({ timeout: 20_000 });
});

test("TC-F02-79 [AC-F02-38] End meeting asks first; Cancel keeps the meeting; confirming ends it for everyone, the lobby included", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const xena = await knock(who.outsider, link);
  await admitAll(host.page, who.outsider.name);
  await expect(controls(xena.page)).toBeVisible({ timeout: 20_000 });
  const gus = await guestWindow(link, "Gus Guest");
  await expect(host.page.getByRole("region", { name: "Lobby", exact: true })).toContainText("Gus Guest", {
    timeout: 15_000,
  });

  const openEnd = async () => {
    await controls(host.page).getByRole("button", { name: "More ways to leave" }).click();
    await host.page.getByRole("menuitem", { name: "End meeting" }).click();
    await expect(host.page.getByRole("dialog", { name: "End the meeting for everyone?" })).toBeVisible();
  };
  await openEnd();
  await host.page.getByRole("dialog").getByRole("button", { name: "Cancel" }).last().click();
  await expect(controls(mo.page)).toBeVisible();
  await expect(ended(mo.page)).toHaveCount(0);

  await openEnd();
  await host.page.getByRole("dialog").getByRole("button", { name: "End meeting" }).click();
  for (const window of [mo, xena, gus]) await expect(ended(window.page)).toBeVisible({ timeout: 20_000 });
});
