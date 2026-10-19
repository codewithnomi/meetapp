// VideoTile (organism): one person on the meeting stage, reworked for F02 from the design system's tile
// as drawn in the approved "Meeting: gallery" and "Meeting: speaker view" screens. Always 16:9 with
// `radius-lg` on the dark stage. The live video arrives as `video` (the page's call hooks make it; no
// call library here); with the camera off, the photo or initials show instead. While someone speaks:
// the 3px `speaking` ring and a "Speaking" pill, so it never relies on color alone (AC-F02-21). A raised
// hand, a weak connection, "Pinned for you" and a reaction (3 seconds, AC-F02-24) show as pills. The
// tile's spoken name sums it all up ("Bilal Ahmed, speaking, hand raised"). All words arrive as props.
import type { ReactNode } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface VideoTileProps {
  /** As shown: "Aisha Khan (you)", "Mei Lin (External)". */
  name: string;
  photoUrl?: string | null | undefined;
  /** After the name in the label: "Organizer", "Presenter". */
  roleLabel?: string | undefined;
  /** The live video (a <video> the page fills); left out or `cameraOff` shows the photo. */
  video?: ReactNode;
  cameraOff?: boolean;
  /** Set while muted: "Muted". */
  mutedLabel?: string | undefined;
  /** Set while speaking: the pill's word, "Speaking". */
  speakingText?: string | undefined;
  /** Set while the hand is up: "Hand raised". */
  handText?: string | undefined;
  /** Set while the connection is weak: "Weak connection". */
  weakText?: string | undefined;
  /** "Pinned for you" with an Unpin button. */
  pinned?: { text: string; unpinLabel: string; onUnpin: () => void } | undefined;
  /** A reaction for 3 seconds: the emoji and its words ("Omar Farooq: applause"). */
  reaction?: { emoji: string; text: string } | undefined;
  className?: string;
}

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold";

function spokenName(props: VideoTileProps): string {
  const { name, roleLabel, speakingText, handText, mutedLabel, weakText, pinned } = props;
  return [roleLabel ? `${name}, ${roleLabel}` : name, pinned?.text, speakingText, handText, mutedLabel, weakText]
    .filter(Boolean)
    .join(", ");
}

function TopLeft({ speakingText, handText }: Pick<VideoTileProps, "speakingText" | "handText">) {
  if (!speakingText && !handText) return null;
  return (
    <div aria-hidden="true" className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5 @max-[120px]:hidden">
      {handText ? (
        <span className={cx(PILL, "bg-hand-raised font-bold text-on-hand-raised")}>
          <Icon name="hand" size={14} />
          {handText}
        </span>
      ) : null}
      {speakingText ? (
        <span className={cx(PILL, "bg-stage-scrim text-stage-ink")}>
          <Icon name="signal" size={14} />
          {speakingText}
        </span>
      ) : null}
    </div>
  );
}

function TopRight({ weakText, pinned }: Pick<VideoTileProps, "weakText" | "pinned">) {
  if (!weakText && !pinned) return null;
  return (
    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5">
      {pinned ? (
        <span className={cx(PILL, "bg-stage-scrim text-stage-ink")}>
          <Icon name="pin" size={14} />
          <span aria-hidden="true">{pinned.text} ·</span>
          <button
            type="button"
            onClick={pinned.onUnpin}
            className={cx("cursor-pointer rounded-sm underline", FOCUS_RING)}
          >
            {pinned.unpinLabel}
          </button>
        </span>
      ) : null}
      {weakText ? (
        <span aria-hidden="true" className={cx(PILL, "bg-stage-scrim font-[550] text-stage-warning")}>
          <Icon name="signal" size={14} />
          <span className="@max-[160px]:hidden">{weakText}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Shown only: the page announces reactions through the meeting's live region (MeetingLayout). */
function Reaction({ reaction }: { reaction: NonNullable<VideoTileProps["reaction"]> }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-md bg-stage-scrim px-3 py-2 text-[12px] font-semibold @max-[120px]:hidden"
    >
      <span className="text-[32px] leading-9">{reaction.emoji}</span>
      {reaction.text}
    </span>
  );
}

export function VideoTile(props: VideoTileProps) {
  const { name, photoUrl, roleLabel, video, cameraOff = false, mutedLabel, speakingText, reaction, className } = props;
  const showVideo = video !== undefined && !cameraOff;
  return (
    <figure
      aria-label={spokenName(props)}
      className={cx(
        "@container relative m-0 aspect-video max-w-full overflow-hidden rounded-lg bg-stage-tile text-stage-ink",
        className,
      )}
    >
      {showVideo ? (
        <div className="absolute inset-0 [&>video]:size-full [&>video]:object-cover">{video}</div>
      ) : (
        // In a small tile (the speaker strip, a narrow window) the picture shrinks so the name stays readable;
        // in a tiny one only the picture shows (the name is still the figure's label for screen readers).
        <div className="absolute inset-0 flex items-center justify-center @max-[240px]:scale-50 @max-[160px]:scale-[0.4]">
          <Avatar name={name} size="xl" {...(photoUrl ? { src: photoUrl } : {})} />
        </div>
      )}
      {/* The speaking ring sits on top, so the video can't cover it. */}
      {speakingText ? (
        <span
          aria-hidden="true"
          data-speaking-ring=""
          className="pointer-events-none absolute inset-0 rounded-lg ring-3 ring-speaking ring-inset"
        />
      ) : null}
      <TopLeft speakingText={speakingText} handText={props.handText} />
      <TopRight weakText={props.weakText} pinned={props.pinned} />
      {reaction ? <Reaction reaction={reaction} /> : null}
      <figcaption
        aria-hidden="true"
        className="absolute bottom-2.5 left-2.5 inline-flex max-w-[calc(100%-20px)] @max-[120px]:hidden items-center gap-1.5 overflow-hidden rounded-sm bg-stage-scrim px-2.5 py-1 text-[13px] leading-4.5 font-[550] whitespace-nowrap"
      >
        {mutedLabel ? <Icon name="mic-off" size={14} className="text-stage-danger" /> : null}
        <span className="truncate">{name}</span>
        {roleLabel ? (
          <span className="ml-0.5 border-l border-stage-ink pl-1.5 text-[12px] opacity-90">{roleLabel}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
