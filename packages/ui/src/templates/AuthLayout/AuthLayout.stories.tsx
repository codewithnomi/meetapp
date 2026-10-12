import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { AuthLayout, AuthSteps, AuthTiles } from "./AuthLayout.tsx";

const form = (
  <>
    <h1 className="m-0 text-title">Sign in to MeetApp</h1>
    <Input id="email" label="Email" type="email" placeholder="aisha@aria.com" />
    <Button size="lg">Continue with email</Button>
  </>
);

const meta = {
  title: "Templates/AuthLayout",
  component: AuthLayout,
  parameters: { layout: "fullscreen" },
  args: {
    brand: "MeetApp",
    aside: (
      <AuthTiles
        headline="Meetings that remember what was said."
        description="Calls with up to 100 people, live captions with names, and minutes in your inbox when the meeting ends."
      />
    ),
    children: form,
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const WithSteps: Story = {
  args: {
    aside: (
      <AuthSteps
        steps={[
          { title: "Your details", description: "Name, email and a password.", state: "current" },
          { title: "Confirm your email", description: "Type the 6-digit code we email you.", state: "next" },
          { title: "You're in", state: "next" },
        ]}
        footer="Joining a team? Use the email address your invitation was sent to."
      />
    ),
  },
};
export const StepsDone: Story = {
  args: {
    aside: (
      <AuthSteps
        steps={[
          { title: "Email entered", state: "done" },
          { title: "Code confirmed", state: "done" },
          { title: "New password", state: "current" },
        ]}
      />
    ),
  },
};
