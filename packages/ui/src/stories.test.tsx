// TC-F00-27 [AC-F00-13]: every atom and molecule has stories for every state. This is the build-independent
// check: it imports the story files directly. The check against Storybook's built `index.json`
// runs in the T13 pipeline.
import { describe, expect, it } from "vitest";
import * as ActionMenuStories from "./atoms/ActionMenu/ActionMenu.stories.tsx";
import * as LevelMeterStories from "./atoms/LevelMeter/LevelMeter.stories.tsx";
import * as DeviceSelectStories from "./molecules/DeviceSelect/DeviceSelect.stories.tsx";
import * as LobbyRowStories from "./molecules/LobbyRow/LobbyRow.stories.tsx";
import * as MessageCardStories from "./molecules/MessageCard/MessageCard.stories.tsx";
import * as ParticipantRowStories from "./molecules/ParticipantRow/ParticipantRow.stories.tsx";
import * as SidePanelStories from "./molecules/SidePanel/SidePanel.stories.tsx";
import * as ControlBarStories from "./organisms/ControlBar/ControlBar.stories.tsx";
import * as DevicePanelStories from "./organisms/DevicePanel/DevicePanel.stories.tsx";
import * as GalleryStories from "./organisms/Gallery/Gallery.stories.tsx";
import * as MeetingInfoPanelStories from "./organisms/MeetingInfoPanel/MeetingInfoPanel.stories.tsx";
import * as MeetingOptionsFormStories from "./organisms/MeetingOptionsForm/MeetingOptionsForm.stories.tsx";
import * as ParticipantPanelStories from "./organisms/ParticipantPanel/ParticipantPanel.stories.tsx";
import * as SharePickerStories from "./organisms/SharePicker/SharePicker.stories.tsx";
import * as VideoTileStories from "./organisms/VideoTile/VideoTile.stories.tsx";
import * as MeetingLayoutStories from "./templates/MeetingLayout/MeetingLayout.stories.tsx";
import * as AvatarStories from "./atoms/Avatar/Avatar.stories.tsx";
import * as BadgeStories from "./atoms/Badge/Badge.stories.tsx";
import * as ButtonStories from "./atoms/Button/Button.stories.tsx";
import * as IconStories from "./atoms/Icon/Icon.stories.tsx";
import * as IconButtonStories from "./atoms/IconButton/IconButton.stories.tsx";
import * as InputStories from "./atoms/Input/Input.stories.tsx";
import * as SpinnerStories from "./atoms/Spinner/Spinner.stories.tsx";
import * as ToggleStories from "./atoms/Toggle/Toggle.stories.tsx";
import * as TooltipStories from "./atoms/Tooltip/Tooltip.stories.tsx";
import * as AccentPickerStories from "./molecules/AccentPicker/AccentPicker.stories.tsx";
import * as CodeInputStories from "./molecules/CodeInput/CodeInput.stories.tsx";
import * as SegmentedControlStories from "./molecules/SegmentedControl/SegmentedControl.stories.tsx";

interface StoryModule {
  default: { title?: string };
  [story: string]: unknown;
}

interface StoryLike {
  parameters?: { pseudo?: Record<string, boolean | string[]> };
  args?: Record<string, unknown>;
}

const BUTTON = ButtonStories as unknown as StoryModule;
const ICON_BUTTON = IconButtonStories as unknown as StoryModule;
const INPUT = InputStories as unknown as StoryModule;
const TOGGLE = ToggleStories as unknown as StoryModule;
const AVATAR = AvatarStories as unknown as StoryModule;
const BADGE = BadgeStories as unknown as StoryModule;
const ALL: [string, StoryModule][] = [
  ["Button", BUTTON],
  ["IconButton", ICON_BUTTON],
  ["Icon", IconStories as unknown as StoryModule],
  ["Spinner", SpinnerStories as unknown as StoryModule],
  ["Tooltip", TooltipStories as unknown as StoryModule],
  ["Input", INPUT],
  ["Toggle", TOGGLE],
  ["Avatar", AVATAR],
  ["Badge", BADGE],
];
const INTERACTIVE: [string, StoryModule][] = [
  ["Button", BUTTON],
  ["IconButton", ICON_BUTTON],
  ["Input", INPUT],
  ["Toggle", TOGGLE],
  ["CodeInput", CodeInputStories as unknown as StoryModule],
];
const MOLECULES: [string, StoryModule][] = [
  ["SegmentedControl", SegmentedControlStories as unknown as StoryModule],
  ["AccentPicker", AccentPickerStories as unknown as StoryModule],
];
const STATES = ["Normal", "Hover", "Focused", "Disabled"];
// The design system has no disabled state for these Settings controls, so there is no Disabled story.
const MOLECULE_STATES = ["Normal", "Hover", "Focused"];

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

  it("TC-F00-27 [AC-F00-13] Input exports WithError (an error message) and WithHint (a hint)", () => {
    expect(story(INPUT, "WithError").args?.["error"]).toBeTypeOf("string");
    expect(story(INPUT, "WithHint").args?.["hint"]).toBeTypeOf("string");
  });

  it("TC-F00-27 [AC-F00-13] Toggle exports an On story that is checked", () => {
    expect(story(TOGGLE, "On").args?.["checked"]).toBe(true);
  });

  it("TC-F00-27 [AC-F00-13] Avatar exports Speaking (with a speaking label) and Sizes", () => {
    const speaking = story(AVATAR, "Speaking");
    expect(speaking.args?.["speaking"]).toBe(true);
    expect(speaking.args?.["speakingLabel"]).toBeTypeOf("string");
    expect(AVATAR["Sizes"]).toBeTypeOf("object");
  });

  it.each([
    ["Accent", "accent"],
    ["Success", "success"],
    ["Warning", "warning"],
    ["Danger", "danger"],
  ])("TC-F00-27 [AC-F00-13] Badge exports a %s story with tone %s", (name, tone) => {
    expect(story(BADGE, name).args?.["tone"]).toBe(tone);
  });

  it.todo("TC-F00-27 [AC-F00-13] the built Storybook index.json lists every atom story (T13 pipeline)");
});

describe("TC-F00-27 [AC-F00-13] every molecule has stories for every state", () => {
  it.each(MOLECULES)("TC-F00-27 [AC-F00-13] %s has the title Molecules/<Name>", (name, mod) => {
    expect(mod.default.title).toBe(`Molecules/${name}`);
  });

  it.each(MOLECULES)("TC-F00-27 [AC-F00-13] %s exports Normal, Hover and Focused", (_name, mod) => {
    const missing = MOLECULE_STATES.filter((state) => typeof mod[state] !== "object");
    expect(missing).toEqual([]);
  });

  it.each(MOLECULES)(
    "TC-F00-27 [AC-F00-13] %s Hover sets pseudo.hover and Focused focuses only the chosen option",
    (_name, mod) => {
      expect(story(mod, "Hover").parameters?.pseudo?.["hover"]).toBe(true);
      // In a radio group only one option can have focus, so the story targets the chosen one.
      expect(story(mod, "Focused").parameters?.pseudo?.["focusVisible"]).toEqual(['[aria-checked="true"]']);
    },
  );
});

// F02 (TC-F02-86): the meeting's building blocks. Each has its level's title and a Normal story; the
// ones that can be pressed or typed in also show Hover and Focused.
const F02: [string, string, StoryModule, boolean][] = [
  ["Atoms", "ActionMenu", ActionMenuStories as unknown as StoryModule, true],
  ["Atoms", "LevelMeter", LevelMeterStories as unknown as StoryModule, false],
  ["Molecules", "DeviceSelect", DeviceSelectStories as unknown as StoryModule, true],
  ["Molecules", "LobbyRow", LobbyRowStories as unknown as StoryModule, true],
  ["Molecules", "MessageCard", MessageCardStories as unknown as StoryModule, true],
  ["Molecules", "ParticipantRow", ParticipantRowStories as unknown as StoryModule, true],
  ["Molecules", "SidePanel", SidePanelStories as unknown as StoryModule, true],
  ["Organisms", "ControlBar", ControlBarStories as unknown as StoryModule, true],
  ["Organisms", "DevicePanel", DevicePanelStories as unknown as StoryModule, true],
  ["Organisms", "Gallery", GalleryStories as unknown as StoryModule, false],
  ["Organisms", "MeetingInfoPanel", MeetingInfoPanelStories as unknown as StoryModule, true],
  ["Organisms", "MeetingOptionsForm", MeetingOptionsFormStories as unknown as StoryModule, false],
  ["Organisms", "ParticipantPanel", ParticipantPanelStories as unknown as StoryModule, true],
  ["Organisms", "SharePicker", SharePickerStories as unknown as StoryModule, false],
  ["Organisms", "VideoTile", VideoTileStories as unknown as StoryModule, false],
  ["Templates", "MeetingLayout", MeetingLayoutStories as unknown as StoryModule, false],
];

describe("TC-F02-86 [AC-F02-43] every meeting building block has its stories", () => {
  it.each(F02)("TC-F02-86 [AC-F02-43] %s/%s has its title and a Normal story", (level, name, mod) => {
    expect(mod.default.title).toBe(`${level}/${name}`);
    expect(mod["Normal"]).toBeTypeOf("object");
  });

  it.each(F02.filter(([, , , pressable]) => pressable))(
    "TC-F02-86 [AC-F02-44] %s/%s shows Hover and Focused",
    (_level, _name, mod) => {
      expect(story(mod, "Hover").parameters?.pseudo?.["hover"]).toBe(true);
      expect(story(mod, "Focused").parameters?.pseudo?.["focusVisible"]).toBe(true);
    },
  );
});
