// StatusMenu (molecule): the person's picture at the top right with its menu, as on the approved canvas
// "Desktop app (F04)" (AC-F04-20, 21; as in Teams): name and email, the status with its end, a sub-menu to
// pick Available, Busy, Do not disturb, Be right back or Appear away and for how long, Reset status, then
// the other actions (Settings, Sign out). Radix gives the keyboard behaviour. All words arrive as props.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { StatusDot, type ChatStatus } from "../../atoms/StatusDot/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import type { MenuAction } from "../../atoms/ActionMenu/index.ts";

export type SettableStatus = "available" | "busy" | "dnd" | "brb" | "away";
export type StatusDuration = "30m" | "1h" | "2h" | "today" | "week" | "forever";

export interface StatusMenuProps {
  name: string;
  email: string;
  /** The photo address, if any (else initials). */
  photo?: string | undefined;
  /** What others see now. */
  status: ChatStatus;
  /** Already translated, one per status and duration: "Busy", "30 minutes", "Until I change it". */
  statusLabels: Record<ChatStatus, string>;
  durationLabels: Record<StatusDuration, string>;
  /** "Until 11:30" when a hand-set status ends, else null. */
  until: string | null;
  /** The status chosen by hand (shown ticked), else null (automatic). */
  chosen: SettableStatus | null;
  duration: StatusDuration;
  onChoose: (status: SettableStatus, duration: StatusDuration) => void;
  onReset: () => void;
  actions: MenuAction[];
  words: { menu: string; forHowLong: string; reset: string };
}

const SETTABLE: SettableStatus[] = ["available", "busy", "dnd", "brb", "away"];
const DURATIONS: StatusDuration[] = ["30m", "1h", "2h", "today", "week", "forever"];
const ITEM = cx(
  "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-ink data-highlighted:bg-surface-sunken",
  FOCUS_RING,
);
const PANEL = "z-50 flex flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-1.5 text-[14px] shadow-2";

function StatusChoices(props: StatusMenuProps) {
  const { statusLabels, durationLabels, chosen, duration, onChoose, words } = props;
  return (
    <Menu.SubContent sideOffset={6} className={cx(PANEL, "min-w-56")}>
      <Menu.RadioGroup value={chosen ?? ""} onValueChange={(value) => onChoose(value as SettableStatus, duration)}>
        {SETTABLE.map((status) => (
          <Menu.RadioItem key={status} value={status} className={cx(ITEM, chosen === status && "bg-accent-soft")}>
            <StatusDot status={status} label="" className="flex-none" />
            {statusLabels[status]}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Separator className="mx-1 my-1.5 h-px bg-line" />
      <Menu.Label className="px-2.5 pt-1 text-[12px] font-semibold text-ink-muted">{words.forHowLong}</Menu.Label>
      <Menu.RadioGroup
        value={duration}
        onValueChange={(value) => onChoose(chosen ?? "available", value as StatusDuration)}
      >
        {DURATIONS.map((each) => (
          <Menu.RadioItem key={each} value={each} className={cx(ITEM, duration === each && "bg-accent-soft")}>
            {durationLabels[each]}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Separator className="mx-1 my-1.5 h-px bg-line" />
      <Menu.Item className={ITEM} onSelect={props.onReset}>
        {words.reset}
      </Menu.Item>
    </Menu.SubContent>
  );
}

export function StatusMenu(props: StatusMenuProps) {
  const { name, email, photo, status, statusLabels, until, actions, words } = props;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={`${words.menu}: ${name}, ${statusLabels[status]}`}
        className={cx("relative inline-grid place-items-center rounded-full", FOCUS_RING)}
      >
        <Avatar name={name} size="sm" {...(photo ? { src: photo } : {})} />
        <StatusDot status={status} label="" placed />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} aria-label={words.menu} className={cx(PANEL, "w-80")}>
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
            <Avatar name={name} size="md" {...(photo ? { src: photo } : {})} />
            <span className="flex min-w-0 flex-col">
              <strong className="truncate text-[15px]">{name}</strong>
              <span className="truncate text-[12px] text-ink-muted">{email}</span>
            </span>
          </div>
          <Menu.Sub>
            <Menu.SubTrigger className={cx(ITEM, "bg-accent-soft")}>
              <StatusDot status={status} label="" className="flex-none" />
              <span className="flex flex-1 flex-col">
                {statusLabels[status]}
                {until && <span className="text-[12px] text-ink-muted">{until}</span>}
              </span>
              <span aria-hidden="true">›</span>
            </Menu.SubTrigger>
            <Menu.Portal>
              <StatusChoices {...props} />
            </Menu.Portal>
          </Menu.Sub>
          <Menu.Separator className="mx-1 my-1.5 h-px bg-line" />
          {actions.map((action) => (
            <Menu.Item key={action.id} onSelect={action.onSelect} className={cx(ITEM, action.danger && "text-danger")}>
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
