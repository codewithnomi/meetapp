import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VideoTile } from "../VideoTile/index.ts";
import { Gallery, type GalleryTile } from "./Gallery.tsx";

const NAMES = [
  "Aisha Khan (you)",
  "Bilal Ahmed",
  "Sara Malik",
  "Omar Farooq",
  "Hina Raza",
  "Mei Lin (External)",
  "Priya Nair",
  "Zara Iqbal",
  "Kamran Butt",
  "Fatima Zahra",
  "Usman Ali",
  "Noah Brooks (Guest)",
  "Ayesha Siddiqui",
  "Tariq Mehmood",
  "Grace Kim",
  "Yusuf Shah",
];

const tiles = (count: number): GalleryTile[] =>
  NAMES.slice(0, count).map((name, index) => ({
    id: name,
    tile: (
      <VideoTile
        name={name}
        cameraOff={index % 3 === 2}
        speakingText={index === 1 ? "Speaking" : undefined}
        handText={index === 2 ? "Hand raised" : undefined}
        mutedLabel={index % 2 === 0 ? "Muted" : undefined}
      />
    ),
  }));

const meta = {
  title: "Organisms/Gallery",
  component: Gallery,
  args: {
    label: "Participants' video, page 1 of 2",
    layout: "gallery",
    tiles: tiles(16),
    pages: {
      text: "Page 1 of 2 · 23 people",
      label: "Gallery pages",
      previousLabel: "Previous page",
      nextLabel: "Next page",
      onNext: fn(),
    },
  },
  decorators: [(Story) => <div className="bg-stage p-6">{Story()}</div>],
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const FewPeople: Story = { args: { tiles: tiles(3), pages: undefined, label: "Participants' video" } };
export const Speaker: Story = {
  args: { layout: "speaker", label: "Speaker view", tiles: tiles(6).slice(1), moreText: "+ 18 more", pages: undefined },
};
export const Focused: Story = { parameters: { pseudo: { focusVisible: true } } };
