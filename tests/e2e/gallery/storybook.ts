// Helpers for the gallery run: which stories exist, how to open one in a theme, and the axe scan.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

type Theme = "light" | "dark";
interface IndexEntry {
  id: string;
  type: string;
}

const INDEX = fileURLToPath(new URL("../../../packages/ui/storybook-static/index.json", import.meta.url));

/** Every story id in the built Storybook (docs pages are skipped). */
export function storyIds(): string[] {
  const index = JSON.parse(readFileSync(INDEX, "utf8")) as { entries: Record<string, IndexEntry> };
  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .map((entry) => entry.id);
}

/** Opens one story on its own (no Storybook frame) in the given theme and waits until it is fully drawn. */
export async function openStory(page: Page, id: string, theme: Theme): Promise<void> {
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  // "finished" is Storybook's last step: after the story's play step (e.g. focusing a button to show its
  // tooltip) and after its animations have settled. A story that crashed also ends there.
  await page.waitForFunction(
    () =>
      (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }).__STORYBOOK_PREVIEW__
        ?.currentRender?.phase === "finished",
  );
  await expect(page.locator("#error-message"), `story ${id} crashed`).toBeHidden();
  await page.evaluate(async () => document.fonts.ready);
}

// Rules about a whole page (landmarks, main heading) belong to the apps' screens, not to one component.
const PAGE_RULES = ["landmark-one-main", "page-has-heading-one", "region"];

/**
 * Accessibility problems axe finds on the open story, as "rule: element" lines (empty when none).
 * The whole page is scanned, because tooltips are drawn outside the story's own box.
 */
export async function accessibilityProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).disableRules(PAGE_RULES).analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} (${violation.help})`),
  );
}
