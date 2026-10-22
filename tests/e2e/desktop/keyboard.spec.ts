// TC-F01-72 (AC-F01-28): the keyboard-only pass in the real desktop app. Signing in, the switcher,
// creating a workspace, inviting, People, Requests and invitations and the profile all work with Tab,
// Enter, Space, the arrow keys and Escape; the focused control always shows the focus ring. Needs the
// backend and Mailpit, so it runs from `pnpm test`.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { TEST_PASSWORD, closeApp, freshProfile, launch, launchNewAccount } from "./desktop.ts";
import { tabTo } from "./keyboard-steps.ts";
import { title } from "./workspace-steps.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";

async function signInWithKeyboard(page: Page, email: string) {
  await expect(title(page, "Sign in to MeetApp")).toBeVisible();
  await tabTo(page, page.getByRole("textbox", { name: "Email" }));
  await page.keyboard.type(email);
  await page.keyboard.press("Enter");
  await page.getByLabel("Password").waitFor();
  await tabTo(page, page.getByLabel("Password"));
  await page.keyboard.type(TEST_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(title(page, "Personal")).toBeVisible();
}

async function createWorkspaceWithKeyboard(page: Page, name: string) {
  const switcher = page.getByRole("button", { name: "Switch workspace: Personal" });
  await tabTo(page, switcher);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(switcher).toBeFocused();
  await page.keyboard.press("Enter");
  const create = page.getByRole("menuitem", { name: "Create a workspace" });
  for (let i = 0; i < 6 && !(await create.evaluate((e) => e === document.activeElement)); i++)
    await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Create a company workspace" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Workspace name" })).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(title(page, name)).toBeVisible();
}

/** A side-menu item, chosen with Tab and Space. */
async function openWithKeyboard(page: Page, item: RegExp, heading: string | RegExp) {
  await tabTo(page, page.getByRole("button", { name: item }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

test("TC-F01-72 [AC-F01-28] sign in, create, invite, People, Requests and Profile with the keyboard only", async () => {
  test.setTimeout(180_000);
  const account = await launchNewAccount();
  await closeApp(account.app);
  const { page } = await launch(freshProfile(), { VITE_API_URL: API_URL });
  await signInWithKeyboard(page, account.email);
  await createWorkspaceWithKeyboard(page, "Keys Co");

  await openWithKeyboard(page, /^People$/, "People in Keys Co");
  await tabTo(page, page.getByRole("textbox", { name: "Email addresses" }));
  const invitee = `keys-${randomUUID()}@example.test`;
  await page.keyboard.type(invitee);
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Invitation sent to ${invitee}.`)).toBeVisible();

  await openWithKeyboard(page, /^Requests and invitations/, "Requests and invitations");
  await expect(page.getByText(invitee)).toBeVisible();

  await openWithKeyboard(page, /^Settings$/, "Settings");
  await tabTo(page, page.getByRole("textbox", { name: "Your name" }));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Keyboard Person");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Name saved.")).toBeVisible();
});
