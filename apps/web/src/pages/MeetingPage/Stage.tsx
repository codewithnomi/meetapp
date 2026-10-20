// The meeting stage (approved "Meeting: gallery" and "speaker view" canvases, AC-F02-20, 21, 23, 24):
// Gallery shows 16 people a page with page arrows; Speaker shows the pinned person, or else whoever is
// sharing or speaking, large. Each tile shows video, speaking (ring and word), a raised hand, mute, a
// weak connection and a reaction for 3 seconds.
import { Gallery, VideoTile } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { EMOJI, TrackVideo, type CallPerson, type Reaction } from "../../features/meetings/index.ts";
import { roleName, shownName } from "./names.ts";

const PAGE_SIZE = 16;
/** Speaker view: the main person and a strip of 4; the rest is "+N more". */
const SPEAKER_TILES = 5;

/** `first` (the pinned or main person) first, then everyone else in order (Pin for me, as in Teams). */
const firstOf = (people: CallPerson[], first: CallPerson | undefined) =>
  first ? [first, ...people.filter((p) => p.id !== first.id)] : people;

export interface StageProps {
  people: CallPerson[];
  layout: "gallery" | "speaker";
  page: number;
  onPage: (page: number) => void;
  pinnedId: string | undefined;
  onUnpin: () => void;
  reactions: Record<string, Reaction>;
  /** The person's own line is weak; shown only on their own tile (AC-F02-28). */
  ownWeak: boolean;
}

function Tile({
  person,
  pinned,
  onUnpin,
  reaction,
  weak,
}: {
  person: CallPerson;
  pinned: boolean;
  onUnpin: () => void;
  reaction: Reaction | undefined;
  weak: boolean;
}) {
  const { t } = useTranslation();
  const name = shownName(t, person);
  const track = person.screen ?? person.video;
  return (
    <VideoTile
      name={name}
      roleLabel={roleName(t, person)}
      {...(track ? { video: <TrackVideo track={track} mirrored={person.isYou && !person.screen} /> } : {})}
      cameraOff={!track}
      mutedLabel={person.micOn ? undefined : t("meetings.call.muted")}
      speakingText={person.speaking ? t("meetings.call.speaking") : undefined}
      handText={person.handRaisedAt ? t("meetings.call.handRaised") : undefined}
      weakText={weak ? t("meetings.call.weak") : undefined}
      pinned={pinned ? { text: t("meetings.call.pinned"), unpinLabel: t("meetings.call.unpin"), onUnpin } : undefined}
      reaction={reaction ? { emoji: EMOJI[reaction], text: person.name } : undefined}
    />
  );
}

/** Speaker view's main person: pinned, else sharing, else speaking, else the first other person. */
function mainOf(people: CallPerson[], pinnedId: string | undefined): CallPerson | undefined {
  return (
    people.find((p) => p.id === pinnedId) ??
    people.find((p) => p.screen) ??
    people.find((p) => p.speaking && !p.isYou) ??
    people.find((p) => !p.isYou) ??
    people[0]
  );
}

export function Stage({ people, layout, page, onPage, pinnedId, onUnpin, reactions, ownWeak }: StageProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const main = mainOf(people, pinnedId);
  const shown =
    layout === "speaker" && main
      ? firstOf(people, main).slice(0, SPEAKER_TILES)
      : firstOf(
          people,
          people.find((p) => p.id === pinnedId),
        ).slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const tiles = shown.map((person) => ({
    id: person.id,
    tile: (
      <Tile
        person={person}
        pinned={person.id === pinnedId}
        onUnpin={onUnpin}
        reaction={reactions[person.id]}
        weak={person.isYou && (ownWeak || person.weak)}
      />
    ),
  }));
  const rest = people.length - SPEAKER_TILES;
  return (
    <Gallery
      label={
        layout === "speaker"
          ? t("meetings.call.speakerView")
          : t("meetings.call.galleryPage", { page: current + 1, pages })
      }
      layout={layout}
      tiles={tiles}
      moreText={layout === "speaker" && rest > 0 ? t("meetings.call.more", { count: rest }) : undefined}
      pages={
        layout === "gallery" && pages > 1
          ? {
              text: t("meetings.call.pageText", { page: current + 1, pages, count: people.length }),
              label: t("meetings.call.pages"),
              previousLabel: t("meetings.call.previousPage"),
              nextLabel: t("meetings.call.nextPage"),
              onPrevious: current > 0 ? () => onPage(current - 1) : undefined,
              onNext: current < pages - 1 ? () => onPage(current + 1) : undefined,
            }
          : undefined
      }
    />
  );
}
