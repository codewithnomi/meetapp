import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { NavRail } from "./NavRail.tsx";

const items = [
  { id: "home", label: "Home", icon: "home" as const, current: false, onSelect: fn() },
  { id: "chat", label: "Chat", icon: "chat" as const, current: true, onSelect: fn(), badge: 3 },
  { id: "meetings", label: "Meetings", icon: "calendar" as const, current: false, onSelect: fn() },
  { id: "people", label: "People", icon: "users" as const, current: false, onSelect: fn() },
  { id: "settings", label: "Settings", icon: "sliders" as const, current: false, onSelect: fn() },
];
const switcher = <div className="rounded-full border border-line-strong p-2 font-semibold">Aria</div>;
const letter = (
  <button
    type="button"
    aria-label="Workspace: Aria"
    className="grid size-9 place-items-center rounded-full bg-accent font-bold text-on-accent"
  >
    A
  </button>
);
const fold = {
  folded: false,
  onToggle: fn(),
  foldLabel: "Collapse menu",
  unfoldLabel: "Expand menu",
  foldedSwitcher: letter,
};

const meta = {
  title: "Organisms/NavRail",
  component: NavRail,
  args: { label: "Main", switcher, items, fold },
  decorators: [(Story) => <div className="flex h-130 bg-bg">{Story()}</div>],
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unfolded: Story = {};
export const Folded: Story = { args: { fold: { ...fold, folded: true } } };
export const FoldedBadge99Plus: Story = {
  args: { fold: { ...fold, folded: true }, items: items.map((i) => (i.id === "chat" ? { ...i, badge: 140 } : i)) },
};
export const FoldedTooltip: Story = {
  args: { fold: { ...fold, folded: true } },
  parameters: { pseudo: { hover: true } },
};
export const WithoutFolding: Story = { args: { fold: undefined } };
