import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { SharePicker, type ShareKind } from "./SharePicker.tsx";

/** A neutral preview, drawn like the design's placeholder (the app shows real screen previews). */
const PREVIEW = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" fill="currentColor"><rect width="160" height="100" opacity=".08"/><rect x="10" y="12" width="64" height="8" rx="4" opacity=".3"/><rect x="10" y="28" width="120" height="8" rx="4" opacity=".3"/><rect x="10" y="44" width="96" height="8" rx="4" opacity=".3"/></svg>',
)}`;

const SCREENS = ["Built-in display", "Studio Display"].map((name, i) => ({
  id: `share-${String(i + 1)}`,
  name,
  thumbnail: PREVIEW,
}));
const WINDOWS = ["Figma: Invite flow", "Google Chrome: Staging", "Keynote: Q4 roadmap", "Notes"].map((name, i) => ({
  id: `share-${String(i + 3)}`,
  name,
  thumbnail: PREVIEW,
}));

const meta = {
  title: "Organisms/SharePicker",
  component: SharePicker,
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Choose what to share",
    closeLabel: "Close",
    note: "Everyone in the meeting will see it. If someone else is sharing, your share replaces theirs. Sound from your computer isn't shared.",
    kind: {
      label: "Share",
      value: "screen",
      options: [
        { value: "screen", label: "Whole screen" },
        { value: "window", label: "One window" },
      ],
      onChange: fn(),
    },
    sourcesLabel: "Screens",
    sources: SCREENS,
    selectedId: "share-1",
    onSelect: fn(),
    emptyText: "No screens found.",
    cancelLabel: "Cancel",
    share: { label: "Share", onClick: fn() },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <SharePicker
        {...args}
        onSelect={(id) => updateArgs({ selectedId: id })}
        kind={{
          ...args.kind,
          onChange: (value: ShareKind) =>
            updateArgs({
              kind: { ...args.kind, value },
              sources: value === "screen" ? SCREENS : WINDOWS,
              sourcesLabel: value === "screen" ? "Screens" : "Windows",
              selectedId: undefined,
            }),
        }}
      />
    );
  },
} satisfies Meta<typeof SharePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Windows: Story = {
  args: {
    kind: { ...meta.args.kind, value: "window" },
    sourcesLabel: "Windows",
    sources: WINDOWS,
    selectedId: undefined,
  },
};
export const Loading: Story = { args: { sources: [], loadingLabel: "Finding screens" } };
export const ScreenRecordingBlocked: Story = {
  args: {
    blocked: {
      icon: "screen",
      tone: "warning",
      title: "Allow screen recording",
      body: "Open System Settings → Privacy & Security → Screen & System Audio Recording, turn on MeetApp, then restart it.",
      primary: { label: "Open System Settings", onClick: fn() },
    },
  },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
