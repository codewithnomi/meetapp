// F15 T19: calls with the keyboard only and for screen readers (TC-F15-56, AC-F15-18). Olivia calls Mo;
// Mo reaches the incoming call by keyboard (it takes focus), Tabs to the buttons, accepts with Enter, later
// declines with Escape; focus goes back to where it was. The call buttons, Add people and the Calls and
// Devices settings pages are used by keyboard. The axe check runs on each of them.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, closeApp, freshProfile, launchAs, type RunningApp } from "./desktop.ts";
import { tabTo } from "./keyboard-steps.ts";
import { controls } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

test.describe.configure({ timeout: 240_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

async function inWorkspace(page: Page, workspace: string) {
  await expect(page.getByRole("button", { name: /^Switch workspace: / })).toBeVisible();
  if (await switcher(page, workspace).isVisible()) return;
  await switchTo(page, "Personal", workspace);
}

/** No serious or critical axe problems on what is on screen now (legacy mode, as in chats-keyboard). */
async function expectAccessible(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).setLegacyMode(true).analyze();
  const problems = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .flatMap((violation) => violation.nodes.map((node) => `${where}: ${violation.id} ${node.target.join(" ")}`));
  expect(problems).toEqual([]);
}

const incoming = (page: Page) => page.getByRole("alertdialog", { name: "Incoming call" });

async function setup() {
  const { workspace, owner, member } = await team();
  const mo = await launchAs(member.email, freshProfile(), FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo, olivia);
  await Promise.all([mo, olivia].map((w) => inWorkspace(w.page, workspace)));
  await openScreen(olivia.page, "Chat");
  await olivia.page.getByRole("button", { name: "New chat" }).first().click();
  await olivia.page.getByRole("combobox", { name: "To:" }).fill("Mo");
  await olivia.page.getByRole("option", { name: /Mo Member/ }).click();
  await olivia.page.getByRole("button", { name: "Start chat" }).click();
  return { mo, olivia };
}

test("TC-F15-56 [AC-F15-18] the incoming call takes focus, is answered and declined by keyboard, and focus returns", async () => {
  const { mo, olivia } = await setup();
  const page = mo.page;
  await openScreen(page, "People");
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await settings.focus();

  // Olivia calls with the keyboard.
  await tabTo(olivia.page, olivia.page.getByRole("button", { name: "Video call" }), 80);
  await olivia.page.keyboard.press("Enter");

  const window = incoming(page);
  await expect(window).toBeVisible({ timeout: 10_000 });
  await expect(window.getByRole("button", { name: "Accept with video" })).toBeFocused();
  await expectAccessible(page, "incoming call");
  await page.keyboard.press("Tab");
  await expect(window.getByRole("button", { name: "Accept with audio" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(window.getByRole("button", { name: "Decline" })).toBeFocused();
  expect(await window.getByRole("button", { name: "Decline" }).evaluate((el) => el.matches(":focus-visible"))).toBe(
    true,
  );

  // Escape declines; focus returns to the element that had it.
  await page.keyboard.press("Escape");
  await expect(window).toHaveCount(0, { timeout: 10_000 });
  await expect(settings).toBeFocused();

  // Called again: Enter on the first button accepts.
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await expect(window).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Enter");
  await expect(controls(page)).toBeVisible({ timeout: 20_000 });
  await expectAccessible(page, "call");

  // Add people by keyboard, closed with Escape.
  await tabTo(page, page.getByRole("button", { name: /Add people/ }), 80);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Add people" })).toBeVisible();
  await expectAccessible(page, "Add people");
  await page.keyboard.press("Escape");
});

test("TC-F15-56 [AC-F15-18] the Calls and Devices settings pages work by keyboard and pass the axe check", async () => {
  const { mo } = await setup();
  const page = mo.page;
  await tabTo(page, page.getByRole("button", { name: "Settings", exact: true }), 80);
  await page.keyboard.press("Enter");
  for (const name of ["Calls", "Devices"]) {
    await tabTo(
      page,
      page
        .getByRole("link", { name })
        .or(page.getByRole("button", { name, exact: true }))
        .first(),
      80,
    );
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name }).first()).toBeVisible();
    await expectAccessible(page, `${name} settings`);
  }
});
