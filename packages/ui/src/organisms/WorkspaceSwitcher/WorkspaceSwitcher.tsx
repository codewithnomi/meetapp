// WorkspaceSwitcher (organism): the top of the side menu (approved canvas "Workspace switcher", AC-F01-16).
// A pill button with the open workspace opens a menu of every workspace (Personal first, as given),
// the open one checked, then "Create a workspace" and "Join with a link or code". Radix's menu gives the
// keyboard behaviour (arrows, Enter, Escape) and the screen-reader roles. All words arrive as props.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface SwitcherWorkspace {
  id: string;
  name: string;
  /** The second line, e.g. "Only you" or "Owner". Already translated. */
  detail: string;
}

export interface WorkspaceSwitcherProps {
  workspaces: SwitcherWorkspace[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  labels: { menu: string; heading: string; create: string; join: string };
  /** Starts with the menu open (for the gallery). */
  defaultOpen?: boolean;
}

function Tile({ name, current }: { name: string; current: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-8.5 flex-none place-items-center rounded-full font-bold",
        current ? "bg-accent text-on-accent" : "bg-surface-sunken text-ink",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Names({ workspace, strong }: { workspace: SwitcherWorkspace; strong?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cx("truncate", strong ? "font-[650]" : "font-semibold")}>{workspace.name}</span>
      <span className="truncate text-[12px] text-ink-muted">{workspace.detail}</span>
    </span>
  );
}

const ITEM = cx(
  "flex cursor-pointer items-center gap-3 rounded-md px-3 text-ink data-highlighted:bg-surface-sunken",
  FOCUS_RING,
);

/** The open menu: every workspace, then create and join. */
function SwitcherMenu({
  workspaces,
  current,
  onSelect,
  onCreate,
  onJoin,
  labels,
}: WorkspaceSwitcherProps & { current: SwitcherWorkspace }) {
  return (
    <Menu.Portal>
      <Menu.Content
        align="start"
        sideOffset={8}
        aria-label={labels.menu}
        className="z-50 flex w-80 flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-2 text-[15px] text-ink shadow-2"
      >
        <Menu.Label className="px-3 pt-2 pb-1 text-[12px] font-semibold text-ink-muted">{labels.heading}</Menu.Label>
        <Menu.RadioGroup value={current.id} onValueChange={onSelect}>
          {workspaces.map((workspace) => (
            <Menu.RadioItem
              key={workspace.id}
              value={workspace.id}
              className={cx(ITEM, "min-h-13 py-1.5", workspace.id === current.id && "bg-accent-soft")}
            >
              <Tile name={workspace.name} current={workspace.id === current.id} />
              <Names workspace={workspace} />
              <Menu.ItemIndicator>
                <Icon name="check" size={18} />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
        <Menu.Separator className="mx-1 my-1.5 h-px bg-line" />
        <Menu.Item onSelect={onCreate} className={cx(ITEM, "min-h-11 font-[550]")}>
          <Icon name="plus" size={18} />
          {labels.create}
        </Menu.Item>
        <Menu.Item onSelect={onJoin} className={cx(ITEM, "min-h-11 font-[550]")}>
          <Icon name="link" size={18} />
          {labels.join}
        </Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  );
}

export function WorkspaceSwitcher(props: WorkspaceSwitcherProps) {
  const { workspaces, currentId, labels } = props;
  const current = workspaces.find((workspace) => workspace.id === currentId) ?? workspaces[0];
  if (!current) return null;
  return (
    // Not modal: the page isn't hidden from screen readers while the menu is open, so nothing focusable
    // ends up inside a hidden area (axe "aria-hidden-focus"); Escape and a click outside still close it.
    <Menu.Root modal={false} {...(props.defaultOpen ? { defaultOpen: true } : {})}>
      <Menu.Trigger
        aria-label={`${labels.menu}: ${current.name}`}
        className={cx(
          "flex min-h-12 w-full items-center gap-2.5 rounded-full border border-line-strong bg-surface-raised py-1.5 pr-3 pl-1.5 text-left text-ink",
          FOCUS_RING,
        )}
      >
        <Tile name={current.name} current />
        <Names workspace={current} strong />
        <span aria-hidden="true" className="inline-flex rotate-90">
          <Icon name="chevron" size={18} />
        </span>
      </Menu.Trigger>
      <SwitcherMenu {...props} current={current} />
    </Menu.Root>
  );
}
