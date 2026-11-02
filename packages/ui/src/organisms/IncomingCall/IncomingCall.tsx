// IncomingCall (organism): the window that rings on every screen of the app (F15 AC-F15-05, 10, 18,
// approved canvas): the caller's picture and name, "Video call · Release team", and three round buttons,
// Video, Audio and Decline, named in full for screen readers ("Accept with video"). During another call
// a line says that accepting leaves it, and the accept buttons' names say so too. It takes focus and is
// announced; Escape declines and focus returns where it was. The page plays the ringtone and answers.
import { useEffect, useId, useLayoutEffect, useRef, type Ref } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface Answer {
  /** The full name: "Accept with video", "Leave current call and accept with video". */
  label: string;
  /** The word under the button: "Video". */
  short: string;
  onClick: () => void;
}

export interface IncomingCallProps {
  callerName: string;
  photoUrl?: string | null | undefined;
  /** "Video call · Release team" or "Audio call". */
  subtitle: string;
  /** Set while the person is in another call: "You're in Design review. Accepting leaves it." */
  busyNote?: string | undefined;
  video: Answer;
  audio: Answer;
  decline: Answer;
  /** The window's name for screen readers: "Incoming call". */
  label: string;
  /** Only the top ring takes focus when several ring at once (default true). */
  takeFocus?: boolean | undefined;
  /** F16 ring window: a × that hides only this window (AC-F16-04), named in full. */
  hide?: { label: string; onClick: () => void } | undefined;
  /** F16 ring window: the window fills its own small window and can be dragged by its top part. */
  standalone?: boolean | undefined;
}

/** Dragging a frameless desktop window by this part; its buttons stay clickable. */
const DRAG = "[-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]";

/** Typing somewhere: a new ring must not take the keys away from it. */
const typing = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

function AnswerButton({
  answer,
  icon,
  tone,
  buttonRef,
  compact,
}: {
  answer: Answer;
  icon: IconName;
  tone: "ok" | "no";
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  /** The small ring window above other apps (F16): smaller buttons. */
  compact?: boolean | undefined;
}) {
  return (
    <span
      className={cx(
        "flex flex-col items-center text-center font-semibold",
        compact ? "w-18 gap-1 text-[11px]" : "w-21 gap-1.5 text-[12px]",
      )}
    >
      <button
        type="button"
        aria-label={answer.label}
        title={answer.label}
        ref={buttonRef}
        onClick={answer.onClick}
        className={cx(
          "grid cursor-pointer place-items-center rounded-full border-0",
          compact ? "size-11" : "size-14",
          tone === "ok" ? "bg-success text-stage" : "bg-danger-fill text-on-danger-fill",
          FOCUS_RING,
        )}
      >
        <Icon name={icon} size={compact ? 18 : 22} />
      </button>
      <span aria-hidden="true">{answer.short}</span>
    </span>
  );
}

/** Where focus goes back: the same element, or, if the screen drew it anew, the one with its name. */
function backTo(before: HTMLElement | undefined): HTMLElement | undefined {
  if (!before || before.isConnected) return before;
  const name = before.getAttribute("aria-label");
  if (!name) return undefined;
  const again = document.querySelector(`${before.tagName.toLowerCase()}[aria-label="${CSS.escape(name)}"]`);
  return again instanceof HTMLElement ? again : undefined;
}

/** Focus on arrival (top ring only, never while typing), back on close, and Escape declines. */
function useWindowKeys(onDecline: () => void, takeFocus: boolean) {
  const first = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLElement>(null);
  // Escape declines while focus is in the window, as its own button does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && box.current?.contains(document.activeElement)) onDecline();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDecline]);
  // The top window takes focus when it appears, so a keyboard user can answer at once, unless they are
  // typing; it gives focus back to where it was when it closes (AC-F15-18).
  // A layout effect, so focus goes back while the window is being removed, before the browser moves it.
  useLayoutEffect(() => {
    if (!takeFocus || typing(document.activeElement)) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    first.current?.focus();
    return () => backTo(before)?.focus();
  }, [takeFocus]);
  return { first, box };
}

/** The caller's picture, name and kind of call; the small window adds × and the drag strip. */
function CallerLine(props: IncomingCallProps & { who: string }) {
  const who = props.who;
  return (
    <div className={cx("flex items-center", props.standalone ? cx("gap-3", DRAG) : "gap-3.5")}>
      <span className="rounded-full p-1 ring-2 ring-success">
        <Avatar
          name={props.callerName}
          {...(props.photoUrl ? { src: props.photoUrl } : {})}
          size={props.standalone ? "md" : "lg"}
        />
      </span>
      <span id={who} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cx(
            "truncate font-semibold",
            props.standalone ? "text-[15px] leading-5" : "text-[17px] leading-5.5",
          )}
        >
          {props.callerName}
        </span>
        <span className="text-[13px] opacity-85">{props.subtitle}</span>
      </span>
      {props.hide ? (
        <button
          type="button"
          aria-label={props.hide.label}
          title={props.hide.label}
          onClick={props.hide.onClick}
          className={cx(
            "grid size-8 shrink-0 cursor-pointer place-items-center self-start rounded-full border-0 bg-transparent text-stage-ink hover:bg-stage-scrim",
            FOCUS_RING,
          )}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function IncomingCall(props: IncomingCallProps) {
  const { first, box } = useWindowKeys(props.decline.onClick, props.takeFocus ?? true);
  const who = useId();
  const busy = useId();
  return (
    <section
      role="alertdialog"
      aria-label={props.label}
      aria-describedby={props.busyNote ? `${who} ${busy}` : who}
      ref={box}
      className={cx(
        "box-border flex flex-col rounded-xl bg-stage text-stage-ink",
        props.standalone ? "gap-3 p-4" : "gap-4 p-5",
        props.standalone ? "h-full w-full overflow-hidden" : "w-90 max-w-[calc(100vw-48px)] shadow-2",
      )}
    >
      <CallerLine {...props} who={who} />
      {props.busyNote ? (
        <p id={busy} className="m-0 rounded-md bg-stage-scrim px-2.5 py-2 text-[13px] leading-4.5">
          {props.busyNote}
        </p>
      ) : null}
      <div className={cx("flex justify-center", props.standalone ? "gap-2" : "gap-3")}>
        <AnswerButton compact={props.standalone} answer={props.video} icon="camera" tone="ok" buttonRef={first} />
        <AnswerButton compact={props.standalone} answer={props.audio} icon="phone" tone="ok" />
        <AnswerButton compact={props.standalone} answer={props.decline} icon="leave" tone="no" />
      </div>
    </section>
  );
}
