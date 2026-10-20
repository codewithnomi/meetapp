import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MeetingOptionsForm, type MeetingOptionsFormProps } from "./MeetingOptionsForm.tsx";

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "workspace", label: "People in my workspace" },
  { value: "organizers", label: "Only me and co-organizers" },
];

const ARGS: MeetingOptionsFormProps = {
  open: true,
  onOpenChange: fn(),
  title: "Meeting options",
  meetingTitle: "Design review: invite flow",
  closeLabel: "Close",
  lobbyBypass: {
    label: "Who can skip the lobby?",
    value: "workspace",
    options: AUDIENCES,
    hint: "Guests always wait until someone with an account is in the meeting.",
    onChange: fn(),
  },
  whoCanPresent: {
    label: "Who can present?",
    value: "everyone",
    options: AUDIENCES,
    hint: "Presenters can share their screen, let people in, mute and remove others.",
    onChange: fn(),
  },
  coOrganizers: {
    label: "Co-organizers",
    people: [{ id: "omar", name: "Omar Farooq", removeLabel: "Remove Omar Farooq as co-organizer" }],
    onRemove: fn(),
    add: { label: "Add a person from Aria", query: "", onQuery: fn(), suggestions: [], onAdd: fn() },
    hint: "Only you, the organizer, can change this. Up to 10 people, all from Aria.",
  },
  allowMic: {
    label: "Allow mic for attendees",
    description: "When off, attendees stay muted until you turn it back on or make them presenters.",
    checked: true,
    onChange: fn(),
  },
  allowCamera: {
    label: "Allow camera for attendees",
    description: "When off, attendees can't turn their camera on.",
    checked: true,
    onChange: fn(),
  },
  lock: {
    label: "Lock the meeting",
    description: "Nobody new can join. People who leave can't come back, except you and co-organizers.",
    checked: false,
    onChange: fn(),
  },
  guestsNote: "Guests can join: Aria's owner and admins decide this for every meeting in the workspace.",
  cancelLabel: "Cancel",
  save: { label: "Save", onClick: fn(), savingLabel: "Saving" },
};

const meta = {
  title: "Organisms/MeetingOptionsForm",
  component: MeetingOptionsForm,
  args: ARGS,
} satisfies Meta<typeof MeetingOptionsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const AddingCoOrganizer: Story = {
  args: {
    coOrganizers: {
      ...ARGS.coOrganizers,
      add: {
        label: "Add a person from Aria",
        query: "sa",
        onQuery: fn(),
        suggestions: [{ id: "sara", name: "Sara Malik", addLabel: "Add Sara Malik as co-organizer" }],
        onAdd: fn(),
      },
    },
  },
};
/** A co-organizer sees the list but can't change it. */
export const CoOrganizerView: Story = {
  args: {
    coOrganizers: {
      ...ARGS.coOrganizers,
      onRemove: undefined,
      add: undefined,
      hint: "Only the organizer can change this.",
    },
  },
};
export const Saving: Story = { args: { save: { ...ARGS.save, saving: true } } };
export const Failed: Story = { args: { error: "Can't reach MeetApp. Check your connection." } };
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
