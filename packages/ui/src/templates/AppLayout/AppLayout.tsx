// AppLayout (template): the signed-in app's frame from the approved canvas: a side menu on the left
// (the workspace switcher at the top, then the menu items) and the screen's content on the right. On a
// narrow window the menu sits above the content. Slots only: the page fills them.
import type { ReactNode } from "react";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface AppNavItem {
  id: string;
  /** Already translated. */
  label: string;
  icon: IconName;
  current: boolean;
  onSelect: () => void;
}

export interface AppLayoutProps {
  /** Usually the WorkspaceSwitcher. */
  switcher: ReactNode;
  navLabel: string;
  items: AppNavItem[];
  children: ReactNode;
}

export function AppLayout({ switcher, navLabel, items, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink">
      <nav
        aria-label={navLabel}
        className="box-border flex max-w-full flex-[1_1_220px] flex-col gap-1 border-r border-line bg-surface px-4 py-5 md:max-w-65"
      >
        <div className="mb-4">{switcher}</div>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={item.current ? "page" : undefined}
            onClick={item.onSelect}
            className={cx(
              "flex h-10 items-center gap-3 rounded-full px-3 text-left",
              item.current
                ? "bg-accent-soft font-semibold text-accent-text"
                : "font-[550] text-ink-muted hover:text-ink",
              FOCUS_RING,
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-[999_1_480px]">{children}</div>
    </div>
  );
}
