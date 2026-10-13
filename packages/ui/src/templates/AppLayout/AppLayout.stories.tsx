import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { WorkspaceSwitcher } from "../../organisms/WorkspaceSwitcher/index.ts";
import { AppLayout } from "./AppLayout.tsx";

const meta = {
  title: "Templates/AppLayout",
  component: AppLayout,
  args: {
    navLabel: "Main",
    switcher: (
      <WorkspaceSwitcher
        workspaces={[
          { id: "p", name: "Personal", detail: "Only you" },
          { id: "a", name: "Aria", detail: "Owner" },
        ]}
        currentId="a"
        onSelect={fn()}
        onCreate={fn()}
        onJoin={fn()}
        labels={{
          menu: "Switch workspace",
          heading: "Your workspaces",
          create: "Create a workspace",
          join: "Join with a link or code",
        }}
      />
    ),
    items: [
      { id: "home", label: "Home", icon: "home", current: true, onSelect: fn() },
      { id: "people", label: "People", icon: "users", current: false, onSelect: fn() },
      { id: "requests", label: "Requests and invitations", icon: "send", current: false, onSelect: fn(), badge: 3 },
      { id: "settings", label: "Settings", icon: "sliders", current: false, onSelect: fn() },
    ],
    children: (
      <main className="p-10">
        <h1 className="m-0 text-title">Aria</h1>
      </main>
    ),
  },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
