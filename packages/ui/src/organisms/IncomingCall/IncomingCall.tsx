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
}

/** Typing somewhere: a new ring must not take the keys away from it. */
const typing = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

function AnswerButton({
  answer,
  icon,
  tone,
  buttonRef,
}: {
  answer: Answer;
  icon: IconName;
  tone: "ok" | "no";
  buttonRef?: Ref<HTMLButtonElement> | undefined;
}) {
  return (
    <span className="flex w-21 flex-col items-center gap-1.5 text-center text-[12px] font-semibold">
      <button
        type="button"
        aria-label={answer.label}
        title={answer.label}
        ref={buttonRef}
        onClick={answer.onClick}
        className={cx(
          "grid size-14 cursor-pointer place-items-center rounded-full border-0",
          tone === "ok" ? "bg-success text-stage" : "bg-danger-fill text-on-danger-fill",
          FOCUS_RING,
        )}
      >
        <Icon name={icon} size={22} />
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

export function IncomingCall(props: IncomingCallProps) {
  const { first, box } = useWindowKeys(props.decline.onClick, props.takeFocus ?? true);
  const who = useId();
  return (
    <section
      role="alertdialog"
      aria-label={props.label}
      aria-describedby={who}
      ref={box}
      className="box-border flex w-90 max-w-[calc(100vw-48px)] flex-col gap-4 rounded-xl bg-stage p-5 text-stage-ink shadow-2"
    >
      <div className="flex items-center gap-3.5">
        <span className="rounded-full p-1 ring-2 ring-success">
          <Avatar name={props.callerName} {...(props.photoUrl ? { src: props.photoUrl } : {})} size="lg" />
        </span>
        <span id={who} className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[17px] leading-5.5 font-semibold">{props.callerName}</span>
          <span className="text-[13px] opacity-85">{props.subtitle}</span>
        </span>
      </div>
      {props.busyNote ? (
        <p className="m-0 rounded-md bg-stage-scrim px-2.5 py-2 text-[13px] leading-4.5">{props.busyNote}</p>
      ) : null}
      <div className="flex justify-center gap-3">
        <AnswerButton answer={props.video} icon="camera" tone="ok" buttonRef={first} />
        <AnswerButton answer={props.audio} icon="phone" tone="ok" />
        <AnswerButton answer={props.decline} icon="leave" tone="no" />
      </div>
    </section>
  );
}
