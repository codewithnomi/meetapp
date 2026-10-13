// MemberRow (molecule): one person in the member table of the approved "People" canvas (AC-F01-21): photo
// or initials, name and email, a role badge, the join date, and an actions menu holding only what the
// viewer may do (no menu at all when there is nothing). Radix's menu gives the keyboard behaviour. It
// renders a table row: the page supplies the <table> and its header. All words arrive as props.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Badge } from "../../atoms/Badge/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface MemberAction {
  id: string;
  /** Already translated: "Make admin", "Remove from workspace". */
  label: string;
  /** Removing or leaving: shown in the danger color. */
  danger?: boolean;
  onSelect: () => void;
}

export interface MemberRowProps {
  name: string;
  email: string;
  photoUrl?: string | null | undefined;
  /** Already translated: "Owner", "Admin", "Member". */
  roleLabel: string;
  /** The owner's badge uses the accent. */
  owner?: boolean;
  /** Already formatted: "2 Oct 2026". */
  joined: string;
  /** "You" beside the viewer's own name. */
  youLabel?: string | undefined;
  actions: MemberAction[];
  /** The menu button's name, e.g. "Actions for Sara Malik". */
  actionsLabel: string;
}

function ActionsMenu({ actions, label }: { actions: MemberAction[]; label: string }) {
  return (
    // Not modal, like the workspace switcher: the page stays readable for screen readers while open.
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <IconButton icon="more" variant="ghost" size="sm" label={label} tooltip={false} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          aria-label={label}
          className="z-50 flex min-w-56 flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-1.5 text-[14px] shadow-2"
        >
          {actions.map((action) => (
            <Menu.Item
              key={action.id}
              onSelect={action.onSelect}
              className={cx(
                "flex min-h-10 cursor-pointer items-center rounded-sm px-3 font-[550] data-highlighted:bg-surface-sunken",
                action.danger ? "text-danger" : "text-ink",
                FOCUS_RING,
              )}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MemberRow(props: MemberRowProps) {
  const { name, email, photoUrl, roleLabel, owner = false, joined, youLabel, actions, actionsLabel } = props;
  return (
    <tr className="border-t border-line">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="md" {...(photoUrl ? { src: photoUrl } : {})} />
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 font-semibold">
              {name}
              {youLabel ? <Badge>{youLabel}</Badge> : null}
            </span>
            <span className="text-[13px] text-ink-muted">{email}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge tone={owner ? "accent" : "neutral"}>{roleLabel}</Badge>
      </td>
      <td className="px-3 py-3 text-ink-muted tabular-nums">{joined}</td>
      <td className="px-5 py-3 text-right">
        {actions.length > 0 ? <ActionsMenu actions={actions} label={actionsLabel} /> : null}
      </td>
    </tr>
  );
}
