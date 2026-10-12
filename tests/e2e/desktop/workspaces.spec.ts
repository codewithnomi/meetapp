// The workspace switcher and renames in the real desktop app (F01 T14): TC-F01-41 switching between
// Personal and two company workspaces, fast, and reopening on the last one; TC-F01-62 a rename reaches
// an open window of another member within a minute. Each test uses accounts of its own, because
// switching changes the account's last-used workspace. Needs the backend, so it runs from `pnpm test`.
import { request, expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { closeApp, freshProfile, launch, launchNewAccount, storedToken } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
const switcher = (page: Page, name: string) => page.getByRole("button", { name: `Switch workspace: ${name}` });

/** Switcher, "Create a workspace", name, Create: the new workspace opens at once. */
async function createWorkspace(page: Page, openName: string, name: string) {
  await switcher(page, openName).click();
  await page.getByRole("menuitem", { name: "Create a workspace" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a company workspace" });
  await dialog.getByRole("textbox", { name: "Workspace name" }).fill(name);
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  await expect(title(page, name)).toBeVisible();
}

async function switchTo(page: Page, from: string, to: string) {
  await switcher(page, from).click();
  await page.getByRole("menuitemradio", { name: new RegExp(to) }).click();
  await expect(title(page, to)).toBeVisible();
}

test("TC-F01-41 [AC-F01-16] Personal first, three workspaces, each switch under 1 second, last-used reopens", async () => {
  test.setTimeout(120_000);
  const profile = freshProfile();
  const { app, page } = await launchNewAccount(profile);
  await createWorkspace(page, "Personal", "Aria Labs");
  await createWorkspace(page, "Aria Labs", "Northwind");

  await switcher(page, "Northwind").click();
  const items = page.getByRole("menuitemradio");
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText("Personal");
  await expect(page.getByRole("menuitem", { name: "Create a workspace" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Join with a link or code" })).toBeVisible();
  await page.keyboard.press("Escape");

  const order = ["Personal", "Aria Labs", "Northwind", "Personal", "Northwind"];
  let open = "Northwind";
  const timings: number[] = [];
  for (let run = 0; run < 10; run++) {
    const next = order[run % order.length] ?? "Personal";
    const target = next === open ? "Aria Labs" : next;
    const started = Date.now();
    await switchTo(page, open, target);
    timings.push(Date.now() - started);
    open = target;
  }
  expect(timings).toHaveLength(10);
  for (const ms of timings) expect(ms).toBeLessThan(1000);

  // The last switch is remembered: a restart opens that workspace (not Personal).
  await switchTo(page, open, "Aria Labs");
  await page.waitForTimeout(500);
  const token = await storedToken(app, profile);
  test.skip(token === undefined, "this computer can't encrypt the token (no keyring), so it is kept in memory only");
  await closeApp(app);
  const again = await launch(profile, { VITE_API_URL: API_URL ?? "" });
  await expect(title(again.page, "Aria Labs")).toBeVisible();
  await closeApp(again.app);
});

interface Who {
  api: APIRequestContext;
  token: string;
}

async function asPerson(token: string): Promise<Who> {
  const api = await request.newContext({
    baseURL: API_URL ?? "",
    extraHTTPHeaders: { authorization: `Bearer ${token}`, origin: "app://meetapp" },
  });
  return { api, token };
}

/** Invites `email` as a member of the workspace and accepts as them. */
async function addMember(owner: Who, member: Who, workspaceId: string, email: string) {
  const invited = await owner.api.post(`/api/v1/workspaces/${workspaceId}/invitations`, { data: { email } });
  expect(invited.ok()).toBe(true);
  const mine = (await (await member.api.get("/api/v1/me/invitations")).json()) as { invitations: { id: string }[] };
  const accepted = await member.api.post(`/api/v1/invitations/${mine.invitations[0]?.id ?? ""}/accept`, { data: {} });
  expect(accepted.ok()).toBe(true);
}

async function workspaceIdOf(who: Who, name: string): Promise<string> {
  const me = (await (await who.api.get("/api/v1/me")).json()) as { workspaces: { id: string; name: string }[] };
  return me.workspaces.find((workspace) => workspace.name === name)?.id ?? "";
}

test("TC-F01-62 [AC-F01-24] a rename reaches another member's open window within a minute; a member and a 1-character name are refused", async () => {
  test.setTimeout(180_000);
  const ownerProfile = freshProfile();
  const memberProfile = freshProfile();
  const owner = await launchNewAccount(ownerProfile);
  const member = await launchNewAccount(memberProfile);
  const ownerToken = await storedToken(owner.app, ownerProfile);
  const memberToken = await storedToken(member.app, memberProfile);
  test.skip(!ownerToken || !memberToken, "this computer can't encrypt the token (no keyring)");
  await createWorkspace(owner.page, "Personal", "Old Name");
  const [ownerWho, memberWho] = await Promise.all([asPerson(ownerToken ?? ""), asPerson(memberToken ?? "")]);
  const workspaceId = await workspaceIdOf(ownerWho, "Old Name");
  await addMember(ownerWho, memberWho, workspaceId, member.email);

  await member.page.reload();
  await expect(title(member.page, "Personal")).toBeVisible();
  await switchTo(member.page, "Personal", "Old Name");

  const tooShort = await ownerWho.api.patch(`/api/v1/workspaces/${workspaceId}`, { data: { name: "X" } });
  expect(tooShort.status()).toBe(400);
  const byMember = await memberWho.api.patch(`/api/v1/workspaces/${workspaceId}`, { data: { name: "Hijacked" } });
  expect(byMember.status()).toBe(403);
  const renamed = await ownerWho.api.patch(`/api/v1/workspaces/${workspaceId}`, { data: { name: "New Name" } });
  expect(renamed.status()).toBe(204);

  await expect(title(owner.page, "Old Name")).toBeVisible();
  await expect(title(member.page, "New Name")).toBeVisible({ timeout: 65_000 });
  await Promise.all([ownerWho.api.dispose(), memberWho.api.dispose()]);
});
