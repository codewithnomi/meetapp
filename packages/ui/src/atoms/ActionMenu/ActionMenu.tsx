// ActionMenu (atom): a button that opens a short menu of actions, as in the approved "People" and
// "Meeting: speaker view" screens (member and participant actions), the React button and the Leave
// menu. Radix's menu gives the keyboard behaviour (Enter or Space opens, arrows move, Escape closes).
// By default the button is the ghost "more" IconButton; `trigger` replaces it. All words arrive as props.
import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactElement } from "react";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { IconButton } from "../IconButton/index.ts";

export interface MenuAction {
  id: string;
  /** Already translated: "Mute", "Remove from meeting". */
  label: string;
  /** Removing, leaving or ending: shown in the danger color. */
  danger?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  actions: MenuAction[];
  /** Names the button and the menu, e.g. "Actions for Sara Malik". */
  label: string;
  /** A custom button (it must forward its ref and props, like Button and IconButton do). */
  trigger?: ReactElement;
  align?: "start" | "end";
  side?: "top" | "bottom";
}

export function ActionMenu({ actions, label, trigger, align = "end", side = "bottom" }: ActionMenuProps) {
  return (
    // Not modal: the page stays readable for screen readers while the menu is open.
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        {trigger ?? <IconButton icon="more" variant="ghost" size="sm" label={label} tooltip={false} />}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          side={side}
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
