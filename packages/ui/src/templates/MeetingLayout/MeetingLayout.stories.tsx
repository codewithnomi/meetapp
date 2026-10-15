import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SegmentedControl } from "../../molecules/SegmentedControl/index.ts";
import { ControlBar } from "../../organisms/ControlBar/index.ts";
import { Gallery } from "../../organisms/Gallery/index.ts";
import { MeetingInfoPanel } from "../../organisms/MeetingInfoPanel/index.ts";
import { ParticipantPanel } from "../../organisms/ParticipantPanel/index.ts";
import { VideoTile } from "../../organisms/VideoTile/index.ts";
import { MeetingLayout } from "./MeetingLayout.tsx";

const PEOPLE = [
  { name: "Aisha Khan (you)" },
  { name: "Bilal Ahmed", speaking: true },
  { name: "Sara Malik", hand: true, muted: true },
  { name: "Omar Farooq", reaction: true },
  { name: "Hina Raza", weak: true },
  { name: "Mei Lin (External)", off: true, muted: true },
  { name: "Priya Nair", muted: true },
  { name: "Zara Iqbal" },
  { name: "Kamran Butt", off: true },
  { name: "Fatima Zahra", muted: true },
  { name: "Usman Ali" },
  { name: "Noah Brooks (Guest)", muted: true },
  { name: "Ayesha Siddiqui", off: true, muted: true },
  { name: "Tariq Mehmood" },
  { name: "Grace Kim", muted: true },
  { name: "Yusuf Shah", off: true },
];

const tiles = PEOPLE.map((p) => ({
  id: p.name,
  tile: (
    <VideoTile
      name={p.name}
      cameraOff={p.off === true}
      mutedLabel={p.muted ? "Muted" : undefined}
      speakingText={p.speaking ? "Speaking" : undefined}
      handText={p.hand ? "Hand raised" : undefined}
      weakText={p.weak ? "Weak connection" : undefined}
      reaction={p.reaction ? { emoji: "👏", text: "Omar" } : undefined}
    />
  ),
}));

const controls = (panel: "info" | "people") => (
  <ControlBar
    label="Meeting controls"
    elapsed="00:18:42"
    mic={{ on: true, label: "Mute (⌘⇧M)", onToggle: fn() }}
    camera={{ on: true, label: "Turn camera off (⌘⇧O)", onToggle: fn() }}
    share={{ on: false, label: "Share screen", onToggle: fn() }}
    hand={{ on: false, label: "Raise your hand (⌘⇧K)", onToggle: fn() }}
    reactions={{ label: "React", actions: [{ id: "like", label: "👍 Like", onSelect: fn() }] }}
    more={{ label: "More options", active: false, onClick: fn() }}
    leave={{
      label: "Leave",
      onLeave: fn(),
      menu: {
        label: "More ways to leave",
        actions: [{ id: "end", label: "End meeting", danger: true, onSelect: fn() }],
      },
    }}
    people={{ label: "Participants, 23", count: 23, active: panel === "people", onClick: fn() }}
    info={{ label: "Meeting info", active: panel === "info", onClick: fn() }}
  />
);

const infoPanel = (
  <MeetingInfoPanel
    title="Meeting info"
    closeLabel="Close meeting info"
    onClose={fn()}
    link={{ label: "Link", value: "https://meetapp.app/m/Vb3kQ9xLr2Tz8pNw4YcH1d", copyLabel: "Copy", onCopy: fn() }}
    details={[
      { label: "Meeting ID", value: "284 615 903 172", mono: true },
      { label: "Passcode", value: "h3Tq9z", mono: true },
      { label: "Organizer", value: "Aisha Khan" },
      { label: "Workspace", value: "Aria" },
    ]}
    copyAll={{ label: "Copy all details", onClick: fn() }}
    options={{ label: "Meeting options", onClick: fn() }}
  />
);

const meta = {
  title: "Templates/MeetingLayout",
  component: MeetingLayout,
  args: {
    title: "Design review: invite flow",
    layoutSwitch: (
      <SegmentedControl
        label="Layout"
        value="gallery"
        options={[
          { value: "gallery", label: "Gallery" },
          { value: "speaker", label: "Speaker" },
        ]}
        onChange={fn()}
      />
    ),
    lobby: {
      label: "Lobby",
      title: "2 people are waiting in the lobby:",
      names: "Daniel Cho (External), Leo Martins (Guest)",
      view: { label: "View lobby", onClick: fn() },
      admitAll: { label: "Admit all", onClick: fn() },
    },
    stage: (
      <Gallery
        label="Participants' video, page 1 of 2"
        layout="gallery"
        tiles={tiles}
        pages={{
          text: "Page 1 of 2 · 23 people",
          label: "Gallery pages",
          previousLabel: "Previous page",
          nextLabel: "Next page",
          onNext: fn(),
        }}
      />
    ),
    panel: infoPanel,
    controls: controls("info"),
    announcement: "",
  },
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="-m-6">{Story()}</div>],
} satisfies Meta<typeof MeetingLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The approved "Meeting: gallery" screen. */
export const Normal: Story = {};
/** The approved "Meeting: speaker view" screen, with the Participants panel. */
export const SpeakerWithParticipants: Story = {
  args: {
    lobby: undefined,
    stage: (
      <Gallery
        label="Speaker view"
        layout="speaker"
        tiles={[tiles[1], tiles[0], tiles[2], tiles[3], tiles[5]].filter((t) => t !== undefined)}
        moreText="+ 18 more"
      />
    ),
    panel: (
      <ParticipantPanel
        title="Participants (23)"
        closeLabel="Close participants"
        onClose={fn()}
        search={{ label: "Find a participant", value: "", onChange: fn() }}
        lobby={{
          title: "Waiting in the lobby (2)",
          admitAll: { label: "Admit all", onClick: fn() },
          people: ["Daniel Cho (External)", "Leo Martins (Guest)"].map((name) => ({
            id: name,
            name,
            admitText: "Admit",
            denyText: "Deny",
            admitLabel: `Admit ${name}`,
            denyLabel: `Deny ${name}`,
            onAdmit: fn(),
            onDeny: fn(),
          })),
        }}
        inMeetingTitle="In the meeting (23)"
        muteAll={{ label: "Mute all", onClick: fn() }}
        noMatchText="Nobody matches your search."
        people={[
          {
            id: "a",
            name: "Aisha Khan (you)",
            roleLabel: "Organizer",
            micOn: true,
            micLabel: "Microphone on",
            cameraOn: true,
            cameraLabel: "Camera on",
          },
          {
            id: "s",
            name: "Sara Malik",
            roleLabel: "Presenter",
            handLabel: "Hand raised",
            micOn: false,
            micLabel: "Muted",
            cameraOn: true,
            cameraLabel: "Camera on",
            actionsLabel: "Actions for Sara Malik",
            actions: [{ id: "mute", label: "Mute", onSelect: fn() }],
          },
          {
            id: "b",
            name: "Bilal Ahmed",
            roleLabel: "Presenter",
            speaking: true,
            speakingLabel: "Bilal Ahmed, speaking",
            micOn: true,
            micLabel: "Microphone on",
            cameraOn: true,
            cameraLabel: "Camera on",
          },
        ]}
      />
    ),
    controls: controls("people"),
  },
};
