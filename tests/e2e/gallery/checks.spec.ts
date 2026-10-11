// Proof that the gallery run really catches problems, and that the atoms follow the design system.
// These checks don't depend on the theme, so the config runs this file in the light project only.
import { expect, test } from "@playwright/test";
import { accessibilityProblems, openStory } from "./storybook.ts";

const THEME = "light";

test.describe("design system match (TC-F00-28)", () => {
  for (const [id, selector] of [
    ["atoms-button--normal", "button"],
    ["atoms-input--normal", "input"],
  ] as const) {
    test(`${id} is pill-shaped and uses Figtree`, async ({ page }) => {
      await openStory(page, id, THEME);
      const looks = await page.locator(`#storybook-root ${selector}`).evaluate((element) => {
        const style = getComputedStyle(element);
        const radiusToken = getComputedStyle(document.documentElement).getPropertyValue("--radius-full").trim();
        return { radius: style.borderTopLeftRadius, radiusToken, font: style.fontFamily };
      });
      expect(looks.radiusToken).not.toBe("");
      expect(looks.radius).toBe(looks.radiusToken);
      expect(looks.font).toMatch(/^"?Figtree/);
    });
  }
});

test.describe("the run catches problems", () => {
  test("an IconButton without a name is an accessibility failure (TC-F00-35)", async ({ page }) => {
    await openStory(page, "atoms-iconbutton--normal", THEME);
    await page.locator("#storybook-root button").evaluate((button) => button.removeAttribute("aria-label"));

    expect((await accessibilityProblems(page)).join("\n")).toContain("button-name");
  });

  test("a changed Button padding fails the screenshot comparison (TC-F00-71)", async ({ page }, testInfo) => {
    // Updating baselines must never save this deliberately broken picture.
    test.skip(testInfo.config.updateSnapshots !== "none", "skipped while baselines are being updated");
    test.fail(true, "expected to fail: the comparison must notice the padding change");

    await openStory(page, "atoms-button--normal", THEME);
    await page.addStyleTag({ content: "#storybook-root button { padding-inline: 40px !important; }" });

    await expect(page).toHaveScreenshot("atoms-button--normal.png", { fullPage: true });
  });
});
