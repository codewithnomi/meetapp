import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./Icon.tsx";
import { ICON_NAMES } from "./icons.ts";

const meta = {
  title: "Atoms/Icon",
  component: Icon,
  args: { name: "mic" },
  argTypes: { name: { control: "select", options: ICON_NAMES } },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Large: Story = { args: { size: 32 } };
export const WithLabel: Story = { args: { name: "mic-off", label: "Muted", className: "text-danger" } };
export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-6 gap-4">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 text-ink">
          <Icon name={name} size={24} />
          <code className="code text-ink-muted">{name}</code>
        </li>
      ))}
    </ul>
  ),
};
