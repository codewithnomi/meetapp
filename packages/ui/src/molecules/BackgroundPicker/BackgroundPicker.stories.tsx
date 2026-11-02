import type { Meta, StoryObj } from "@storybook/react-vite";
import { BackgroundPicker } from "./BackgroundPicker.tsx";

const meta = {
  title: "Molecules/BackgroundPicker",
  component: BackgroundPicker,
  args: {
    legend: "Background",
    value: "blur",
    onChange: () => undefined,
    hint: "Made on this computer. If it slows your video, MeetApp turns it off and tells you.",
    options: [
      { id: "none", name: "None", kind: "none" },
      { id: "blur", name: "Blur", kind: "blur" },
      ...["Office", "Living room", "Bookshelf", "Café", "Nature", "City view", "Calm waves", "Soft shapes"].map(
        (name) => ({ id: name, name, kind: "picture" as const }),
      ),
    ],
  },
  decorators: [(Story) => <div className="w-130 bg-surface p-4">{Story()}</div>],
} satisfies Meta<typeof BackgroundPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const NotAvailable: Story = { args: { unavailable: "Backgrounds aren't available on this computer." } };
