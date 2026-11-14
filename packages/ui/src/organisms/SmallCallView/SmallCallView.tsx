// SmallCallView (organism): F17's small call view at the bottom right of MeetApp while the person is on
// another screen during a call (AC-F17-02, 07, 18; approved canvas board "Browse during a call (F17)").
// Top: the speaker's live video (or their photo or initials, or a status), which brings the full call back
// when clicked; bottom: the call's name and time, mute, camera and Leave (or Cancel). Unlike F16's mini
// window it has no share, hand or people count. Every text arrives translated; the page carries out presses.
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

export interface SmallCallViewProps {
  /** The view's name for screen readers: "Call: Release team". */
  label: string;
  title: string;
  /** Time since joining: "12:40". */
  elapsed: string;
  speakerName: string;
  speakerPhoto?: string | undefined;
  /** The speaker's live video, drawn by the page; none shows the photo or initials. */
  video?: ReactNode;
  /** "Sara Malik is talking", "Reconnecting…", "Waiting to be let in…", "Calling Omar…". */
  caption: string;
  /** True for a status: it is announced. Who talks is not, or every change would be. */
  captionIsStatus?: boolean | undefined;
  /** "You're sharing" while the person shares their screen. */
  sharing?: string | undefined;
  /** Lobby, calling and reconnecting show only Leave (or Cancel). */
  controls: boolean;
  mic: Toggle;
  camera: Toggle;
  /** `text` is shown ("Leave", "Cancel"); `label` is the full name for screen readers. */
  leave: { label: string; text: string; onClick: () => void };
  /** The whole picture is this button; `text` ("Go back") shows on it. */
  back: { label: string; text: string; onClick: () => void };
  /** The group of buttons' name: "Call controls". */
  controlsLabel: string;
}

function RoundButton(props: {
  icon: IconName;
  label: string;
  onClick: () => void;
  off?: boolean | undefined;
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
        "grid size-8 flex-none cursor-pointer place-items-center rounded-full border-0 bg-stage-tile hover:bg-stage-scrim aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        props.off ? "text-stage-danger" : "text-stage-ink",
        FOCUS_RING,
      )}
    >
      <Icon name={props.icon} size={16} />
    </button>
  );
}

function Picture(props: SmallCallViewProps) {
  return (
    <button
      type="button"
      aria-label={props.back.label}
      onClick={props.back.onClick}
      className={cx(
        "relative grid h-37.5 w-full cursor-pointer place-items-center overflow-hidden border-0 bg-stage-tile p-0 text-stage-ink",
        FOCUS_RING,
      )}
    >
      {props.video ? (
        <span className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&>*]:object-cover">{props.video}</span>
      ) : (
        <Avatar name={props.speakerName} {...(props.speakerPhoto ? { src: props.speakerPhoto } : {})} size="lg" />
      )}
      <span className="absolute top-2 right-2 rounded-full bg-stage-scrim px-2 py-0.5 text-[12px] font-semibold">
        {props.back.text}
      </span>
    </button>
  );
}

function Controls({ controls, controlsLabel, mic, camera, leave }: SmallCallViewProps) {
  return (
    <div role="group" aria-label={controlsLabel} className="flex items-center gap-1.5">
      {controls ? (
        <>
          <RoundButton
            icon={mic.on ? "mic" : "mic-off"}
            label={mic.label}
            off={!mic.on}
            disabled={mic.disabled}
            onClick={mic.onClick}
          />
          <RoundButton
            icon={camera.on ? "camera" : "camera-off"}
            label={camera.label}
            off={!camera.on}
            disabled={camera.disabled}
            onClick={camera.onClick}
          />
        </>
      ) : null}
      <button
        type="button"
        aria-label={leave.label}
        onClick={leave.onClick}
        className={cx(
          "flex h-8 cursor-pointer items-center gap-1 rounded-full border-0 bg-danger-fill px-3 text-[13px] font-semibold text-on-danger-fill",
          FOCUS_RING,
        )}
      >
        <Icon name="leave" size={16} />
        {leave.text}
      </button>
    </div>
  );
}

export function SmallCallView(props: SmallCallViewProps) {
  return (
    <section
      aria-label={props.label}
      className="box-border flex w-75 flex-col overflow-hidden rounded-xl bg-stage text-stage-ink shadow-2"
    >
      <div className="relative">
        <Picture {...props} />
        <span
          aria-live={props.captionIsStatus ? "polite" : undefined}
          className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-full bg-stage-scrim px-2 py-0.5 text-[12px]"
        >
          {props.caption}
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className="flex min-w-0 flex-1 flex-col text-[12px] leading-4">
          <strong className="truncate text-[13px]">{props.title}</strong>
          <span className="tabular-nums opacity-85">{props.elapsed}</span>
          {props.sharing ? <span className="truncate font-semibold">{props.sharing}</span> : null}
        </span>
        <Controls {...props} />
      </div>
    </section>
  );
}
