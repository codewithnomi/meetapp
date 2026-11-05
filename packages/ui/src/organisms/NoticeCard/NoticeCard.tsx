// NoticeCard (organism): MeetApp's own notification card at the bottom right of the screen (F04 AC-F04-30,
// 31, 33, 34; approved canvas board "Desktop app (F04)"): a message (several become "3 new messages"), an
// @mention, someone waiting in the lobby with Admit and View lobby, or "MeetApp is still running". It fills
// its own small window and never takes focus; long words are cut with "…". All words arrive as props.
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export type NoticeKind = "message" | "mention" | "lobby" | "running";

export interface NoticeCardProps {
  kind: NoticeKind;
  title: string;
  detail?: string | undefined;
  text?: string | undefined;
  /** "mentioned you", "Guest". */
  tag?: string | undefined;
  person?: { name: string; photo?: string | undefined } | undefined;
  /** The app's letter when there is no person ("still running"). */
  appLetter?: string;
  /** Message and mention: the whole card opens the chat; its name for screen readers. */
  open?: { label: string; onClick: () => void } | undefined;
  admit?: { label: string; onClick: () => void } | undefined;
  viewLobby?: { label: string; onClick: () => void } | undefined;
  close: { label: string; onClick: () => void };
  /** The pointer came onto the card or left it (the card stays while it is on it). */
  onHover?: (on: boolean) => void;
}

function Picture({ person, appLetter }: Pick<NoticeCardProps, "person" | "appLetter">) {
  if (person) return <Avatar name={person.name} size="md" {...(person.photo ? { src: person.photo } : {})} />;
  return (
    <span
      aria-hidden="true"
      className="grid size-10 flex-none place-items-center rounded-[10px] bg-accent font-bold text-on-accent"
    >
      {appLetter ?? "M"}
    </span>
  );
}

function Words({ kind, title, detail, text, tag }: NoticeCardProps) {
  const tagged = tag ? (
    <span className="rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-text">{tag}</span>
  ) : null;
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px] leading-[18px]">
      <span className="flex min-w-0 items-center gap-1.5">
        <strong className="min-w-0 truncate">{title}</strong>
        {tagged}
        {kind === "lobby" && <span className="flex-none text-ink-muted">{text}</span>}
      </span>
      {detail && <span className="truncate text-ink-muted">{detail}</span>}
      {kind !== "lobby" && text && <span className="line-clamp-2 break-words">{text}</span>}
    </span>
  );
}

function LobbyButtons({ admit, viewLobby }: Pick<NoticeCardProps, "admit" | "viewLobby">) {
  if (!viewLobby) return null;
  return (
    <span className="flex gap-2 pl-12">
      {admit && (
        <Button size="sm" onClick={admit.onClick}>
          {admit.label}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={viewLobby.onClick}>
        {viewLobby.label}
      </Button>
    </span>
  );
}

export function NoticeCard(props: NoticeCardProps) {
  const { open, admit, viewLobby, close, onHover } = props;
  const label = [props.title, props.tag, props.detail, props.text].filter(Boolean).join(", ");
  return (
    <section
      aria-label={label}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      className="relative box-border flex h-full w-full gap-3 rounded-xl border border-line bg-surface p-3.5 text-ink shadow-2"
    >
      {open ? (
        <button
          type="button"
          aria-label={open.label}
          onClick={open.onClick}
          className={cx(
            "flex min-w-0 flex-1 cursor-pointer gap-3 border-0 bg-transparent p-0 text-left text-ink",
            FOCUS_RING,
          )}
        >
          <Picture {...props} />
          <Words {...props} />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex min-w-0 gap-3">
            <Picture {...props} />
            <Words {...props} />
          </span>
          <LobbyButtons admit={admit} viewLobby={viewLobby} />
        </div>
      )}
      <IconButton icon="close" variant="ghost" size="sm" label={close.label} tooltip={false} onClick={close.onClick} />
      {/* It appears without taking focus, so it is announced here. */}
      <p role="status" className="sr-only">
        {label}
      </p>
    </section>
  );
}
