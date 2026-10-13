import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Dialog } from "./Dialog.tsx";

const meta = {
  title: "Molecules/Dialog",
  component: Dialog,
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Create a company workspace",
    description: "A shared place for your team's meetings, minutes and AI answers. You'll be its owner.",
    closeLabel: "Close",
    initialFocusId: "story-name",
    children: (
      <form className="flex flex-col gap-5">
        <Input id="story-name" label="Workspace name" hint="Usually your company or team name. 2 to 60 characters." />
        <div className="flex justify-end gap-3">
          <Button variant="ghost">Cancel</Button>
          <Button>Create workspace</Button>
        </div>
      </form>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
