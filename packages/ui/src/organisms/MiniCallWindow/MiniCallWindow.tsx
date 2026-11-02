// MiniCallWindow (organism): F16's small call window above other apps while MeetApp isn't in front
// (AC-F16-14–18, 21; approved canvas board "Calls while MeetApp isn't in front"). Top: the call's name,
// time and people, and "Back to the call"; middle: the speaker's live video (a picture sent by the main
// window), their photo or initials when their camera is off, or a status ("Reconnecting…"); bottom: mute,
// camera, share, hand and Leave. Every text arrives translated; the page carries out each press.
import type { ReactNode } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface Toggle {
  /** What pressing does, already translated: "Mute (⌘⇧M)" / "Unmute (⌘⇧M)". */
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean | undefined;
}

export interface MiniCallWindowProps {
  /** The window's name for screen readers: "Call: Release team". */
  label: string;
  title: string;
  /** "12:48 · 4 people". */
  details: string;
  speakerName: string;
  speakerPhoto?: string | undefined;
  /** The speaker's live video, drawn by the page (F16: a canvas fed by the main window); none shows the photo or initials. */
  video?: ReactNode;
  /** "Sara Malik is speaking", "Sara Malik is sharing", "Reconnecting…", "Waiting to be let in…". */
  caption: string;
  /** True for a status (Reconnecting, Lobby, Calling): it is announced. Who speaks is not, or every change would be. */
  captionIsStatus?: boolean | undefined;
  /** Lobby, calling and reconnecting show only Leave (or Cancel). */
  controls: boolean;
  mic: Toggle;
  camera: Toggle;
  share: { label: string; onClick: () => void; disabled?: boolean | undefined };
  hand: Toggle;
  leave: { label: string; onClick: () => void };
  back: { label: string; onClick: () => void };
  /** The group of buttons' name: "Call controls". */
  controlsLabel: string;
}

const DRAG = "[-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]";

/** A round button on the dark call card (approved canvas: soft tiles, red icon when off, accent when on). */
function StageButton(props: {
  icon: IconName;
  label: string;
  onClick: () => void;
  off?: boolean | undefined;
  on?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      // Not disabled: an unavailable button stays reachable with Tab, so its reason (the label) can be heard.
      aria-disabled={props.disabled || undefined}
      onClick={props.disabled ? undefined : props.onClick}
      className={cx(
        "grid size-9.5 cursor-pointer place-items-center rounded-full border-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        props.on ? "bg-accent text-on-accent" : "bg-stage-tile hover:bg-stage-scrim",
        !props.on && (props.off ? "text-stage-danger" : "text-stage-ink"),
        FOCUS_RING,
      )}
    >
      <Icon name={props.icon} size={18} />
    </button>
  );
}

function Header({ title, details, back }: Pick<MiniCallWindowProps, "title" | "details" | "back">) {
  return (
    <div className={cx("flex items-center gap-2 py-2 pr-2.5 pl-3 text-[12px]", DRAG)}>
      <span aria-hidden="true" className="opacity-60">
        <Icon name="more" size={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-[13px]">{title}</strong>
        <span className="tabular-nums opacity-80">{details}</span>
      </span>
      <StageButton icon="monitor" label={back.label} onClick={back.onClick} />
    </div>
  );
}

function Picture(
  props: Pick<MiniCallWindowProps, "video" | "speakerName" | "speakerPhoto" | "caption" | "captionIsStatus">,
) {
  return (
    <div className="relative mx-2 grid h-37.5 place-items-center overflow-hidden rounded-md bg-stage-scrim">
      {props.video ? (
        <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&>*]:object-cover">{props.video}</div>
      ) : (
        <Avatar name={props.speakerName} {...(props.speakerPhoto ? { src: props.speakerPhoto } : {})} size="lg" />
      )}
      <span
        aria-live={props.captionIsStatus ? "polite" : undefined}
        className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-full bg-stage-scrim px-2 py-0.5 text-[12px] font-semibold"
      >
        {props.caption}
      </span>
    </div>
  );
}

function Toggles({ mic, camera, share, hand }: Pick<MiniCallWindowProps, "mic" | "camera" | "share" | "hand">) {
  return (
    <>
      <StageButton
        icon={mic.on ? "mic" : "mic-off"}
        label={mic.label}
        off={!mic.on}
        disabled={mic.disabled}
        onClick={mic.onClick}
      />
      <StageButton
        icon={camera.on ? "camera" : "camera-off"}
        label={camera.label}
        off={!camera.on}
        onClick={camera.onClick}
      />
      <StageButton icon="screen" label={share.label} disabled={share.disabled} onClick={share.onClick} />
      <StageButton icon="hand" label={hand.label} on={hand.on} onClick={hand.onClick} />
    </>
  );
}

export function MiniCallWindow(props: MiniCallWindowProps) {
  return (
    <section
      aria-label={props.label}
      className="box-border flex h-full w-full flex-col overflow-hidden rounded-xl bg-stage text-stage-ink"
    >
      <Header title={props.title} details={props.details} back={props.back} />
      <Picture {...props} />
      <div role="group" aria-label={props.controlsLabel} className="flex justify-center gap-1.5 px-2 pt-2.5 pb-3">
        {props.controls ? <Toggles {...props} /> : null}
        <button
          type="button"
          aria-label={props.leave.label}
          title={props.leave.label}
          onClick={props.leave.onClick}
          className={cx(
            "grid h-9.5 w-13 cursor-pointer place-items-center rounded-full border-0 bg-danger-fill text-on-danger-fill",
            FOCUS_RING,
          )}
        >
          <Icon name="leave" size={18} />
        </button>
      </div>
    </section>
  );
}
