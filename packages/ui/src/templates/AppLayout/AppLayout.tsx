// AppLayout (template): the signed-in app's frame from the approved canvas: the side menu (NavRail) on the
// left, which folds to icons as in Teams (F14, AC-F14-36), and the screen's content on the right. On a
// narrow window the menu sits above the content. Slots only: the page fills them.
import type { ReactNode } from "react";
import { NavRail, type NavFold, type NavItem } from "../../organisms/NavRail/index.ts";

/** One menu item (kept under its F01 name for the pages). */
export type AppNavItem = NavItem;

export interface AppLayoutProps {
  /** Usually the WorkspaceSwitcher. */
  switcher: ReactNode;
  navLabel: string;
  items: AppNavItem[];
  /** The main menu folds; Settings' menu doesn't. */
  fold?: NavFold | undefined;
  children: ReactNode;
}

export function AppLayout({ switcher, navLabel, items, fold, children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink md:flex-nowrap">
      <NavRail label={navLabel} switcher={switcher} items={items} fold={fold} />
      <div className="min-w-0 flex-[999_1_480px]">{children}</div>
    </div>
  );
}
