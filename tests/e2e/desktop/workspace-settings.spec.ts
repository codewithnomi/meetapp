// Workspace settings (F02 T17): the owner turns Allow guests off, and a guest who is already on the
// pre-join is refused when pressing Join now. TC-F02-83.
import { expect, test } from "@playwright/test";
import { launch, launchNewAccount } from "./desktop.ts";

test.describe.configure({ timeout: 120_000 });

test("TC-F02-83 [AC-F02-40] turning Allow guests off refuses a guest at once", async () => {
  const owner = await launchNewAccount();
  await owner.page.getByRole("button", { name: "Meetings" }).click();
  await owner.page.getByRole("button", { name: "Get link" }).click();
  const dialog = owner.page.getByRole("dialog", { name: "Your meeting link is ready" });
  const link = (await dialog.getByText(/\/m\/[\w-]{22}$/).textContent()) ?? "";
  expect(link).toMatch(/\/m\//);
  await dialog.getByRole("button", { name: "Close" }).first().click();

  const guest = await launch(undefined, { VITE_API_URL: process.env["MEETAPP_E2E_API_URL"] ?? "" });
  await guest.page.getByRole("link", { name: "Join a meeting" }).click();
  await guest.page.getByRole("radio", { name: "Link" }).click();
  await guest.page.getByLabel("Meeting link").fill(link);
  await guest.page.getByRole("button", { name: "Join", exact: true }).click();
  await guest.page.getByLabel("Your name").fill("Leo Guest");

  await owner.page.getByRole("button", { name: "Workspace settings" }).click();
  const allow = owner.page.getByRole("switch", { name: "Allow guests" });
  await expect(allow).toBeChecked();
  await allow.click();
  await expect(allow).not.toBeChecked();
  await expect(allow).toBeEnabled();

  await guest.page.getByRole("button", { name: "Join now" }).click();
  await expect(guest.page.getByText("This meeting doesn't allow guests", { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
});
