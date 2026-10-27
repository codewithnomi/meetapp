// ControlBar (organism): the floating bar at the bottom of the meeting, reworked for F02 as drawn in the
// approved "Meeting: gallery" screen. Left: the time in the meeting. Middle, in an order that never
// changes: microphone, camera, share, hand, React, More, then Leave (with "End meeting" in its menu for
// the organizer and co-organizers). Right: Participants (with the count) and Meeting info. Each button's
// label says what pressing it does and its shortcut ("Mute (⌘⇧M)"). All words arrive as props.
import { ActionMenu, type MenuAction } from "../../atoms/ActionMenu/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface Switch {
  on: boolean;
  /** What pressing does now: "Mute (⌘⇧M)" / "Unmute (⌘⇧M)". */
  label: string;
  onToggle: () => void;
  /** Not allowed right now (e.g. attendees' microphones are off); the label says why. */
  disabled?: boolean;
}

interface PanelButton {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Not available yet or not allowed; the label says why. */
  disabled?: boolean;
}

export interface ControlBarProps {
  /** Names the toolbar: "Meeting controls". */
  label: string;
  /** "00:18:42". */
  elapsed: string;
  mic: Switch;
  camera: Switch;
  share: Switch;
  hand: Switch;
  /** The five reactions ("👍 Like" …) under the React button. */
  reactions: { label: string; actions: MenuAction[] };
  more: PanelButton;
  leave: {
    label: string;
    onLeave: () => void;
    /** The menu beside Leave ("More ways to leave"), only for those who may end the meeting. */
    menu?: { label: string; actions: MenuAction[] } | undefined;
  };
  /** The count is part of the label too: "Participants, 23". */
  people: PanelButton & { count: number };
  /** Meeting chat (F03): the unread count, up to 99; the label says it too ("Chat, 3 unread"). */
  chat?: (PanelButton & { unread: number }) | undefined;
  /** Meeting info; a call from a chat has none (F15). */
  info?: PanelButton | undefined;
}

function LeaveGroup({ leave }: Pick<ControlBarProps, "leave">) {
  return (
    <div className="ml-2 flex gap-0.5">
      <Button variant="danger" icon="leave" onClick={leave.onLeave} className="h-11">
        {leave.label}
      </Button>
      {leave.menu ? (
        <ActionMenu
          label={leave.menu.label}
          actions={leave.menu.actions}
          side="top"
          trigger={
            <button
              type="button"
              aria-label={leave.menu.label}
              className={cx(
                "inline-grid h-11 cursor-pointer place-items-center rounded-full bg-danger-fill px-2.5 text-on-danger-fill hover:brightness-93",
                FOCUS_RING,
              )}
            >
              <Icon name="chevron-down" size={18} />
            </button>
          }
        />
      ) : null}
    </div>
  );
}

/** Your own controls, in an order that never changes, then Leave. */
function MainControls(props: Omit<ControlBarProps, "label" | "elapsed" | "people" | "info">) {
  const { mic, camera, share, hand, reactions, more, leave } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton
        icon={mic.on ? "mic" : "mic-off"}
        label={mic.label}
        off={!mic.on}
        labelIsAction
        disabled={mic.disabled}
        onClick={mic.onToggle}
      />
      <IconButton
        icon={camera.on ? "camera" : "camera-off"}
        label={camera.label}
        off={!camera.on}
        labelIsAction
        disabled={camera.disabled}
        onClick={camera.onToggle}
      />
      <IconButton
        icon="screen"
        label={share.label}
        active={share.on}
        labelIsAction
        disabled={share.disabled}
        onClick={share.onToggle}
      />
      <IconButton icon="hand" label={hand.label} active={hand.on} labelIsAction onClick={hand.onToggle} />
      <ActionMenu
        label={reactions.label}
        actions={reactions.actions}
        side="top"
        align="start"
        trigger={<IconButton icon="smile" label={reactions.label} />}
      />
      <IconButton icon="more" label={more.label} active={more.active} disabled={more.disabled} onClick={more.onClick} />
      <LeaveGroup leave={leave} />
    </div>
  );
}

/** The side panels: Participants (with the count), Chat (with unread messages) and Meeting info. */
function PanelButtons({ people, chat, info }: Pick<ControlBarProps, "people" | "chat" | "info">) {
  return (
    <div className="flex items-center gap-2">
      <IconButton
        icon="users"
        variant="ghost"
        label={people.label}
        badge={people.count}
        active={people.active}
        onClick={people.onClick}
      />
      {chat ? (
        <IconButton
          icon="chat"
          variant="ghost"
          label={chat.label}
          {...(chat.unread > 0 ? { badge: chat.unread > 99 ? "99+" : chat.unread } : {})}
          active={chat.active}
          onClick={chat.onClick}
        />
      ) : null}
      {info ? (
        <IconButton icon="info" variant="ghost" label={info.label} active={info.active} onClick={info.onClick} />
      ) : null}
    </div>
  );
}

export function ControlBar({ label, elapsed, people, chat, info, ...controls }: ControlBarProps) {
  return (
    <div
      // A labelled group: every control is its own Tab stop (a toolbar would promise arrow-key moves).
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-line bg-surface px-4 py-3 text-ink shadow-2"
    >
      <span className="font-mono text-[13px] font-medium tabular-nums">{elapsed}</span>
      <MainControls {...controls} />
      <PanelButtons people={people} chat={chat} info={info} />
    </div>
  );
}
