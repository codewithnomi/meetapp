// MiniCallWindow (organism): F16's small call window above other apps while MeetApp isn't in front
// (AC-F16-14–18, 21; approved canvas board "Calls while MeetApp isn't in front"). Top: the call's name,
// time and people, and "Back to the call"; middle: the speaker's live video (a picture sent by the main
// window), their photo or initials when their camera is off, or a status ("Reconnecting…"); bottom: mute,
// camera, share, hand and Leave. Every text arrives translated; the page carries out each press.
import { Avatar } from "../../atoms/Avatar/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
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
  /** The latest picture of the speaker's video (a blob: address); none shows the photo or initials. */
  frameUrl?: string | undefined;
  /** "Sara Malik is speaking", "Sara Malik is sharing", "Reconnecting…", "Waiting to be let in…". */
  caption: string;
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
      <IconButton icon="monitor" label={back.label} variant="ghost" size="sm" onClick={back.onClick} />
    </div>
  );
}

function Picture(props: Pick<MiniCallWindowProps, "frameUrl" | "speakerName" | "speakerPhoto" | "caption">) {
  return (
    <div className="relative mx-2 grid h-37.5 place-items-center overflow-hidden rounded-md bg-stage-scrim">
      {props.frameUrl ? (
        <img src={props.frameUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Avatar name={props.speakerName} {...(props.speakerPhoto ? { src: props.speakerPhoto } : {})} size="lg" />
      )}
      <span
        aria-live="polite"
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
      <IconButton
        icon={mic.on ? "mic" : "mic-off"}
        label={mic.label}
        off={!mic.on}
        labelIsAction
        size="sm"
        disabled={mic.disabled}
        onClick={mic.onClick}
      />
      <IconButton
        icon={camera.on ? "camera" : "camera-off"}
        label={camera.label}
        off={!camera.on}
        labelIsAction
        size="sm"
        onClick={camera.onClick}
      />
      <IconButton icon="screen" label={share.label} size="sm" disabled={share.disabled} onClick={share.onClick} />
      <IconButton icon="hand" label={hand.label} active={hand.on} labelIsAction size="sm" onClick={hand.onClick} />
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
            "grid h-8.5 w-13 cursor-pointer place-items-center rounded-full border-0 bg-danger-fill text-on-danger-fill",
            FOCUS_RING,
          )}
        >
          <Icon name="leave" size={18} />
        </button>
      </div>
    </section>
  );
}
