// TC-F00-27 [AC-F00-13]: every atom has stories for every state. This is the build-independent
// check: it imports the story files directly. The check against Storybook's built `index.json`
// runs in the T13 pipeline.
import { describe, expect, it } from "vitest";
import * as ButtonStories from "./atoms/Button/Button.stories.tsx";
import * as IconStories from "./atoms/Icon/Icon.stories.tsx";
import * as IconButtonStories from "./atoms/IconButton/IconButton.stories.tsx";
import * as SpinnerStories from "./atoms/Spinner/Spinner.stories.tsx";
import * as TooltipStories from "./atoms/Tooltip/Tooltip.stories.tsx";

interface StoryModule {
  default: { title?: string };
  [story: string]: unknown;
}

interface StoryLike {
  parameters?: { pseudo?: Record<string, boolean> };
  args?: Record<string, unknown>;
}

const BUTTON = ButtonStories as unknown as StoryModule;
const ICON_BUTTON = IconButtonStories as unknown as StoryModule;
const ALL: [string, StoryModule][] = [
  ["Button", BUTTON],
  ["IconButton", ICON_BUTTON],
  ["Icon", IconStories as unknown as StoryModule],
  ["Spinner", SpinnerStories as unknown as StoryModule],
  ["Tooltip", TooltipStories as unknown as StoryModule],
];
const INTERACTIVE: [string, StoryModule][] = [
  ["Button", BUTTON],
  ["IconButton", ICON_BUTTON],
];
const STATES = ["Normal", "Hover", "Focused", "Disabled"];

function story(mod: StoryModule, name: string): StoryLike {
  const s = mod[name];
  expect(s, `story ${name}`).toBeTypeOf("object");
  return s as StoryLike;
}

describe("TC-F00-27 [AC-F00-13] every atom has stories for every state", () => {
  it.each(ALL)("TC-F00-27 [AC-F00-13] %s has the title Atoms/<Name> and a Normal story", (name, mod) => {
    expect(mod.default.title).toBe(`Atoms/${name}`);
    expect(mod["Normal"]).toBeTypeOf("object");
  });

  it.each(INTERACTIVE)("TC-F00-27 [AC-F00-13] %s exports Normal, Hover, Focused and Disabled", (_name, mod) => {
    const missing = STATES.filter((state) => typeof mod[state] !== "object");
    expect(missing).toEqual([]);
  });

  it.each(INTERACTIVE)(
    "TC-F00-27 [AC-F00-13] %s Hover sets pseudo.hover and Focused sets pseudo.focusVisible",
    (_name, mod) => {
      expect(story(mod, "Hover").parameters?.pseudo?.["hover"]).toBe(true);
      expect(story(mod, "Focused").parameters?.pseudo?.["focusVisible"]).toBe(true);
    },
  );

  it.each(INTERACTIVE)("TC-F00-27 [AC-F00-13] %s Disabled story sets disabled", (_name, mod) => {
    expect(story(mod, "Disabled").args?.["disabled"]).toBe(true);
  });

  it("TC-F00-27 [AC-F00-13] Button exports a Loading story with a loading label", () => {
    const loading = story(BUTTON, "Loading");
    expect(loading.args?.["loading"]).toBe(true);
    expect(loading.args?.["loadingLabel"]).toBeTypeOf("string");
  });

  it.todo("TC-F00-27 [AC-F00-13] Input has Normal, Hover, Focused and Disabled stories (T12)");
  it.todo("TC-F00-27 [AC-F00-13] Toggle has Normal, Hover, Focused and Disabled stories (T12)");
  it.todo("TC-F00-27 [AC-F00-13] Avatar stories exist (T12)");
  it.todo("TC-F00-27 [AC-F00-13] Badge stories exist (T12)");
  it.todo("TC-F00-27 [AC-F00-13] the built Storybook index.json lists every atom story (T13 pipeline)");
});
