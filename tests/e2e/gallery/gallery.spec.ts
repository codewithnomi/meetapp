// TC-F00-28 and TC-F00-35: every story, in light and dark, matches its approved screenshot and has
// zero accessibility problems. The project name ("light" / "dark") is the theme.
import { expect, test } from "@playwright/test";
import { accessibilityProblems, openStory, storyIds } from "./storybook.ts";

const theme = (name: string): "light" | "dark" => (name === "dark" ? "dark" : "light");

for (const id of storyIds()) {
  test(id, async ({ page }, testInfo) => {
    await openStory(page, id, theme(testInfo.project.name));

    await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true });
    expect(await accessibilityProblems(page)).toEqual([]);
  });
}
