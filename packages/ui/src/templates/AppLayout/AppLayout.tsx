// AppLayout (template): the signed-in app's frame from the approved canvas: the side menu (NavRail) on the
// left, which folds to icons as in Teams (F14, AC-F14-36), and the screen's content on the right. On a
// narrow window the menu sits above the content. Slots only: the page fills them.
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";
import { NavRail, type NavFold, type NavItem } from "../../organisms/NavRail/index.ts";

/** Room below the content for the small call view: its height (about 200 px) and 16 px on each side. */
const CORNER_ROOM = "pb-58";

/** One menu item (kept under its F01 name for the pages). */
export type AppNavItem = NavItem;

export interface AppLayoutProps {
  /** Usually the WorkspaceSwitcher. */
  switcher: ReactNode;
  navLabel: string;
  items: AppNavItem[];
  /** The main menu folds; Settings' menu doesn't. */
  fold?: NavFold | undefined;
  /** The slim bar above the screen with the person's picture at the right (F04, as in Teams). */
  topBar?: ReactNode;
  /** F17: the small call view shows at the bottom right; the content keeps room below it, so nothing on
   * the screen stays hidden behind it (AC-F17-21). */
  reserveCorner?: boolean;
  children: ReactNode;
}

export function AppLayout({ switcher, navLabel, items, fold, topBar, reserveCorner, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink md:flex-nowrap">
      <NavRail label={navLabel} switcher={switcher} items={items} fold={fold} />
      <div className={cx("min-w-0 flex-[999_1_480px]", reserveCorner ? CORNER_ROOM : undefined)}>
        {topBar && (
          <div className="flex h-12 items-center justify-end gap-3 border-b border-line bg-surface-raised px-4">
            {topBar}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
