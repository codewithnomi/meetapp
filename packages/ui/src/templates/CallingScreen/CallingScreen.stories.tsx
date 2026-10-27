import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { CallingScreen } from "./CallingScreen.tsx";

const meta = {
  title: "Templates/CallingScreen",
  component: CallingScreen,
  args: {
    heading: "Video call · Bilal Ahmed",
    picture: <Avatar name="Bilal Ahmed" size="xl" />,
    ringing: true,
    title: "Calling Bilal Ahmed…",
    line: "Ringing. They can accept with video or audio.",
    controls: (
      <div className="flex justify-center">
        <Button variant="danger" icon="leave">
          Cancel
        </Button>
      </div>
    ),
  },
  decorators: [(Story) => <div className="h-160">{Story()}</div>],
} satisfies Meta<typeof CallingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ringing: Story = {};
const after = (
  <>
    <Button icon="camera">Call again</Button>
    <Button variant="secondary" icon="chat">
      Back to chat
    </Button>
  </>
);
export const Declined: Story = {
  args: {
    ringing: false,
    title: "Bilal Ahmed declined",
    line: "They can call you back from the chat.",
    actions: after,
  },
};
export const NoAnswer: Story = {
  args: {
    ringing: false,
    title: "No answer",
    line: "Bilal Ahmed didn't answer. They'll see a missed call in the chat.",
    actions: after,
  },
};
