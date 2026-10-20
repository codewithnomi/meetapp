// MemberRow (molecule): one person in the member table of the approved "People" canvas (AC-F01-21): photo
// or initials, name and email, a role badge, the join date, and an actions menu holding only what the
// viewer may do (no menu at all when there is nothing; ActionMenu gives the keyboard behaviour). It
// renders a table row: the page supplies the <table> and its header. All words arrive as props.
import { ActionMenu, type MenuAction } from "../../atoms/ActionMenu/index.ts";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Badge } from "../../atoms/Badge/index.ts";

/** "Make admin", "Remove from workspace" (removing or leaving in the danger color). */
export type MemberAction = MenuAction;

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
        {actions.length > 0 ? <ActionMenu actions={actions} label={actionsLabel} /> : null}
      </td>
    </tr>
  );
}
