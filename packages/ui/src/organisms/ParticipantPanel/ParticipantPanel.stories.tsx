import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ParticipantPanel, type ParticipantPanelProps } from "./ParticipantPanel.tsx";

const actions = (name: string) =>
  [
    { id: "mute", label: "Mute", onSelect: fn() },
    { id: "attendee", label: "Make an attendee", onSelect: fn() },
    { id: "pin", label: "Pin for me", onSelect: fn() },
    { id: "remove", label: "Remove from meeting", danger: true, onSelect: fn() },
  ].map((action) => ({ ...action, id: `${name}-${action.id}` }));

const person = (name: string, roleLabel: string, extra: Partial<ParticipantPanelProps["people"][number]> = {}) => ({
  id: name,
  name,
  roleLabel,
  micOn: true,
  micLabel: "Microphone on",
  cameraOn: true,
  cameraLabel: "Camera on",
  actions: actions(name),
  actionsLabel: `Actions for ${name}`,
  ...extra,
});

const waiting = (name: string) => ({
  id: name,
  name,
  admitText: "Admit",
  denyText: "Deny",
  admitLabel: `Admit ${name}`,
  denyLabel: `Deny ${name}`,
  onAdmit: fn(),
  onDeny: fn(),
});

const meta = {
  title: "Organisms/ParticipantPanel",
  component: ParticipantPanel,
  args: {
    title: "Participants (23)",
    closeLabel: "Close participants",
    onClose: fn(),
    search: { label: "Find a participant", value: "", onChange: fn() },
    lobby: {
      title: "Waiting in the lobby (2)",
      admitAll: { label: "Admit all", onClick: fn() },
      people: [waiting("Daniel Cho (External)"), waiting("Leo Martins (Guest)")],
    },
    inMeetingTitle: "In the meeting (23)",
    muteAll: { label: "Mute all", onClick: fn() },
    noMatchText: "Nobody matches your search.",
    people: [
      person("Aisha Khan (you)", "Organizer", { actions: [] }),
      person("Sara Malik", "Presenter", { handLabel: "Hand raised", micOn: false, micLabel: "Muted" }),
      person("Bilal Ahmed", "Presenter", { speaking: true, speakingLabel: "Bilal Ahmed, speaking" }),
      person("Omar Farooq", "Co-organizer"),
      person("Mei Lin (External)", "Presenter", {
        micOn: false,
        micLabel: "Muted",
        cameraOn: false,
        cameraLabel: "Camera off",
      }),
      person("Noah Brooks (Guest)", "Attendee", { micOn: false, micLabel: "Muted" }),
    ],
  },
  decorators: [(Story) => <div className="flex bg-stage p-6">{Story()}</div>],
} satisfies Meta<typeof ParticipantPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
/** What an attendee sees: no lobby, no Mute all, no actions. */
export const Attendee: Story = {
  args: {
    lobby: undefined,
    muteAll: undefined,
    people: [
      person("Noah Brooks (you)", "Attendee", { actions: [] }),
      person("Aisha Khan", "Organizer", { actions: [] }),
    ],
  },
};
export const NoMatch: Story = {
  args: { search: { label: "Find a participant", value: "zed", onChange: fn() }, people: [] },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
