import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.tsx";

const meta = {
  title: "Organisms/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  args: {
    workspaces: [
      { id: "p", name: "Personal", detail: "Only you" },
      { id: "a", name: "Aria", detail: "Owner" },
      { id: "n", name: "Northwind partners", detail: "Member" },
    ],
    currentId: "a",
    onSelect: fn(),
    onCreate: fn(),
    onJoin: fn(),
    labels: {
      menu: "Switch workspace",
      heading: "Your workspaces",
      create: "Create a workspace",
      join: "Join with a link or code",
    },
  },
  decorators: [(Story) => <div className="w-57 bg-surface p-4">{Story()}</div>],
} satisfies Meta<typeof WorkspaceSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
export const Open: Story = { args: { defaultOpen: true } };
