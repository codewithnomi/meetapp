// MeetingLayout (template): the meeting screen's frame from the approved "Meeting" screens, always on
// the dark stage. Top: the meeting title and the Gallery/Speaker switch. Under it, for those who may let
// people in, the lobby bar ("2 people are waiting in the lobby", View lobby, Admit all). Then the stage
// with a side panel beside it, and the control bar at the bottom. The screen is exactly the window's
// height: the control bar always shows (as in Teams), the stage's height is passed on as
// `--stage-height` so the gallery's tiles fit it, and only the stage scrolls if it still doesn't fit.
// One polite live region carries the announcements (joins, hands, "X muted you", AC-F02-44). Slots only: the page fills them.
import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface LobbyBar {
  /** Names the bar: "Lobby". */
  label: string;
  /** Bold first part: "2 people are waiting in the lobby:". */
  title: string;
  /** Who: "Daniel Cho (External), Leo Martins (Guest)". */
  names: string;
  view: { label: string; onClick: () => void };
  admitAll: { label: string; onClick: () => void };
}

export interface MeetingLayoutProps {
  title: string;
  /** Usually the Gallery/Speaker SegmentedControl. */
  layoutSwitch?: ReactNode;
  lobby?: LobbyBar | undefined;
  /** Messages over the stage, such as "The meeting ends in 10 minutes". */
  notices?: ReactNode;
  stage: ReactNode;
  panel?: ReactNode;
  controls: ReactNode;
  /** The latest announcement for screen readers (the page spaces them at least 2 seconds apart). */
  announcement: string;
}

function Lobby({ lobby }: { lobby: LobbyBar }) {
  return (
    <div
      role="region"
      aria-label={lobby.label}
      className="mx-6 mb-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-surface px-4 py-3 text-ink"
    >
      <Icon name="users" />
      <span className="min-w-0 flex-[1_1_320px] text-[14px]">
        <strong>{lobby.title}</strong> {lobby.names}
      </span>
      <button
        type="button"
        onClick={lobby.view.onClick}
        className={cx(
          "cursor-pointer rounded-sm text-[14px] font-semibold text-accent-text hover:text-ink",
          FOCUS_RING,
        )}
      >
        {lobby.view.label}
      </button>
      <Button size="sm" onClick={lobby.admitAll.onClick}>
        {lobby.admitAll.label}
      </Button>
    </div>
  );
}

/** The stage area's height, kept up to date when the window or the bars above it change. */
function useHeight(element: HTMLElement | null): number | undefined {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return height;
}

export function MeetingLayout(props: MeetingLayoutProps) {
  const { title, layoutSwitch, lobby, notices, stage, panel, controls, announcement } = props;
  const [area, setArea] = useState<HTMLElement | null>(null);
  const height = useHeight(area);
  const stageHeight = height === undefined ? {} : ({ "--stage-height": `${String(height)}px` } as CSSProperties);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-stage text-stage-ink">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h1 className="m-0 text-[17px] leading-6 font-semibold">{title}</h1>
        {layoutSwitch}
      </header>
      {lobby ? <Lobby lobby={lobby} /> : null}
      {notices ? <div className="mx-6 mb-3 flex shrink-0 flex-col gap-2">{notices}</div> : null}
      <main ref={setArea} className="flex min-h-0 flex-1 flex-wrap gap-4 overflow-y-auto px-6">
        <div className="min-w-0 flex-[999_1_560px]" style={stageHeight}>
          {stage}
        </div>
        {panel}
      </main>
      <footer className="shrink-0 px-6 pt-4 pb-5">{controls}</footer>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
