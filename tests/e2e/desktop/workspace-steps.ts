// Steps the workspace tests share: the switcher, creating and switching workspaces, the side menu, and
// reading an email's text from the fake inbox (Mailpit).
import { expect, type Page } from "@playwright/test";

export const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
export const switcher = (page: Page, name: string) => page.getByRole("button", { name: `Switch workspace: ${name}` });

/** Switcher, "Create a workspace", name, Create: the new workspace opens at once. */
export async function createWorkspace(page: Page, openName: string, name: string) {
  await switcher(page, openName).click();
  await page.getByRole("menuitem", { name: "Create a workspace" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a company workspace" });
  await dialog.getByRole("textbox", { name: "Workspace name" }).fill(name);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(title(page, name)).toBeVisible();
}

export async function switchTo(page: Page, from: string, to: string) {
  await switcher(page, from).click();
  await page.getByRole("menuitemradio", { name: new RegExp(to) }).click();
  await expect(title(page, to)).toBeVisible();
}

/** A side-menu item, e.g. "People" or "Requests and invitations" (its name may end with a count). */
export async function openScreen(page: Page, item: string) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: new RegExp(`^${item}`) })
    .click();
}

/** People screen: invites one address as member and waits for "Invitation sent". */
export async function inviteByEmail(page: Page, email: string) {
  await openScreen(page, "People");
  await page.getByRole("textbox", { name: "Email addresses" }).fill(email);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
}

/** Switcher → "Join with a link or code". */
export async function openJoinScreen(page: Page, openName: string) {
  await switcher(page, openName).click();
  await page.getByRole("menuitem", { name: "Join with a link or code" }).click();
  await expect(title(page, "Join a workspace")).toBeVisible();
}

/** Join screen: presses Join on the invitation; the workspace opens. */
export async function acceptInvitation(page: Page, from: string, workspace: string) {
  await openJoinScreen(page, from);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(title(page, workspace)).toBeVisible();
}

/** The plain text of the newest email to `email` sent after `since`. */
export async function emailText(email: string, since: Date): Promise<string> {
  const mailpit = process.env["MEETAPP_E2E_MAILPIT_URL"];
  for (let attempt = 0; attempt < 50; attempt++) {
    const query = encodeURIComponent(`to:"${email}"`);
    const found = (await (await fetch(`${mailpit}/api/v1/search?query=${query}`)).json()) as {
      messages: { ID: string; Created: string }[];
    };
    const newest = found.messages.find((message) => new Date(message.Created) >= since);
    if (newest)
      return ((await (await fetch(`${mailpit}/api/v1/message/${newest.ID}`)).json()) as { Text: string }).Text;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`no email to ${email}`);
}
