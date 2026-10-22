// NavRail (organism): the app's side menu from the approved canvas (F14Chat, AC-F14-36), as in Teams: the
// ☰ button folds it to a 72 px rail of icons (and unfolds it again); folded, each item names itself in a
// tooltip on hover and focus, and counts (Chat's unread chats) stay on the icon, "99+" above 99. The page
// keeps the folded choice (this computer's storage); this part only shows it.
import type { ReactNode } from "react";
import { Badge } from "../../atoms/Badge/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { Tooltip } from "../../atoms/Tooltip/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface NavItem {
  id: string;
  /** Already translated. */
  label: string;
  icon: IconName;
  current: boolean;
  onSelect: () => void;
  /** A count beside the label, e.g. unread chats (hidden when 0). Read as part of the item's name. */
  badge?: number | undefined;
}

export interface NavFold {
  folded: boolean;
  onToggle: () => void;
  /** "Collapse menu" / "Expand menu". */
  foldLabel: string;
  unfoldLabel: string;
  /** Folded: the workspace's letter button (opens the switcher). */
  foldedSwitcher: ReactNode;
}

export interface NavRailProps {
  label: string;
  /** The workspace switcher (unfolded), or anything at the top of a menu that doesn't fold. */
  switcher: ReactNode;
  items: NavItem[];
  /** The main menu folds (AC-F14-36); Settings' own menu doesn't. */
  fold?: NavFold | undefined;
}

const count = (badge: number) => (badge > 99 ? "99+" : String(badge));

function Item({ item, folded }: { item: NavItem; folded: boolean }) {
  const name = item.badge ? `${item.label} ${count(item.badge)}` : item.label;
  const button = (
    <button
      type="button"
      aria-current={item.current ? "page" : undefined}
      aria-label={name}
      onClick={item.onSelect}
      className={cx(
        "relative flex items-center gap-3 rounded-full text-left",
        folded ? "size-11 justify-center" : "h-10 px-3",
        item.current ? "bg-accent-soft font-semibold text-accent-text" : "font-[550] text-ink-muted hover:text-ink",
        FOCUS_RING,
      )}
    >
      <Icon name={item.icon} />
      {folded ? null : <span className="flex-1">{item.label}</span>}
      {item.badge ? (
        folded ? (
          <span className="absolute -top-0.5 -right-1 box-border grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-on-accent">
            {count(item.badge)}
          </span>
        ) : (
          <Badge tone="accent">{count(item.badge)}</Badge>
        )
      ) : null}
    </button>
  );
  return folded ? (
    <Tooltip label={item.label} side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function FoldButton({ fold }: { fold: NavFold }) {
  const label = fold.folded ? fold.unfoldLabel : fold.foldLabel;
  return (
    <button
      type="button"
      aria-expanded={!fold.folded}
      aria-label={label}
      title={label}
      onClick={fold.onToggle}
      className={cx("mb-2 grid size-11 place-items-center rounded-full bg-transparent text-ink", FOCUS_RING)}
    >
      <Icon name="menu" />
    </button>
  );
}

export function NavRail(props: NavRailProps) {
  const folded = props.fold?.folded ?? false;
  return (
    <nav
      aria-label={props.label}
      data-folded={folded ? "true" : "false"}
      className={cx(
        "box-border flex flex-none flex-col gap-1 border-r border-line bg-surface px-3 py-4",
        folded ? "w-18 items-center" : "w-full md:w-55",
      )}
    >
      {props.fold ? <FoldButton fold={props.fold} /> : null}
      <div className="mb-3">{props.fold?.folded ? props.fold.foldedSwitcher : props.switcher}</div>
      {props.items.map((item) => (
        <Item key={item.id} item={item} folded={folded} />
      ))}
    </nav>
  );
}
