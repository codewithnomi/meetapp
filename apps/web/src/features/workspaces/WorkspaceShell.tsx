// The signed-in app's frame (approved canvas, AC-F01-16): the side menu with the workspace switcher and
// the menu items, and the screen beside it. A company workspace adds People and "Requests and
// invitations" (with the count of people asking to join, for the owner and admins). Creating a
// workspace opens its dialog here and switches to the new one. A workspace notice ("You are no longer a
// member of …") shows above the screen until dismissed.
import {
  AppLayout,
  NavRail,
  Notice,
  WorkspaceSwitcher,
  type AppNavItem,
  type IconName,
  type NavFold,
} from "@meetapp/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavFolded } from "../chats/nav-folded.ts";
import { MyStatusMenu } from "../status/index.ts";
import { useUnreadChats } from "../chats/use-chat-list.ts";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog.tsx";
import { useCurrentWorkspace } from "./current-workspace.tsx";
import type { MyWorkspace } from "./me.ts";
import { useCallCorner } from "../call-corner/index.ts";
import { useWorkspaceName } from "./workspace-name.ts";

/** The signed-in screens the side menu and the switcher lead to. */
export type AppScreen = "home" | "chat" | "meetings" | "people" | "requests" | "workspace" | "settings" | "join";

export interface WorkspaceShellProps {
  /** None for the call shown beside the menu (F17): no item is the current one. */
  screen: AppScreen | undefined;
  onNavigate: (screen: AppScreen) => void;
  children: ReactNode;
}

const ICONS: Record<Exclude<AppScreen, "join">, IconName> = {
  home: "home",
  chat: "chat",
  meetings: "camera",
  people: "users",
  requests: "send",
  workspace: "lock",
  settings: "sliders",
};

function useNavItems(current: MyWorkspace | undefined, { screen, onNavigate }: Omit<WorkspaceShellProps, "children">) {
  const { t } = useTranslation();
  const company = current?.kind === "company";
  // Workspace settings: the owner and admins (in Personal, its user).
  const manages = current !== undefined && current.role !== "member";
  const unreadChats = useUnreadChats(current?.id);
  const screens: Exclude<AppScreen, "join">[] = [
    "home",
    "chat",
    "meetings",
    ...(company ? (["people", "requests"] as const) : []),
    ...(manages ? (["workspace"] as const) : []),
    "settings",
  ];
  return screens.map((id): AppNavItem => ({
    id,
    label: t(`workspaces.nav.${id}`),
    icon: ICONS[id],
    current: id === screen,
    onSelect: () => onNavigate(id),
    ...(id === "requests" && current ? { badge: current.pendingRequests } : {}),
    // Chats with unread messages (AC-F14-02).
    ...(id === "chat"
      ? { badge: unreadChats, badgeLabel: t("workspaces.nav.chatUnread", { count: unreadChats }) }
      : {}),
  }));
}

function Switcher({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const { t } = useTranslation();
  const { workspaces, current, switchTo } = useCurrentWorkspace();
  const nameOf = useWorkspaceName();
  if (!current) return null;
  return (
    <WorkspaceSwitcher
      workspaces={workspaces.map((workspace) => ({
        id: workspace.id,
        name: nameOf(workspace),
        detail: workspace.kind === "personal" ? t("workspaces.onlyYou") : t(`workspaces.roles.${workspace.role}`),
      }))}
      currentId={current.id}
      onSelect={switchTo}
      onCreate={onCreate}
      onJoin={onJoin}
      labels={{
        menu: t("workspaces.switcher.menu"),
        heading: t("workspaces.switcher.heading"),
        create: t("workspaces.switcher.create"),
        join: t("workspaces.switcher.join"),
      }}
    />
  );
}

function ShellNotice() {
  const { t } = useTranslation();
  const { notice, showNotice } = useCurrentWorkspace();
  if (!notice) return null;
  return (
    <div className="px-6 pt-6 sm:px-12">
      <Notice
        tone="neutral"
        icon="users"
        className="mx-auto max-w-3xl"
        action={{ label: t("workspaces.notices.dismiss"), onClick: () => showNotice(undefined) }}
      >
        {t(`workspaces.notices.${notice.kind}`, { name: notice.name })}
      </Notice>
    </div>
  );
}

/** The menu folds to icons as in Teams (AC-F14-36); folded, the workspace's letter opens it again. */
function useFold(): NavFold {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  const [folded, toggleFolded] = useNavFolded();
  const nameOf = useWorkspaceName();
  const name = current ? nameOf(current) : "";
  return {
    folded,
    onToggle: toggleFolded,
    foldLabel: t("workspaces.nav.fold"),
    unfoldLabel: t("workspaces.nav.unfold"),
    foldedSwitcher: (
      <button
        type="button"
        aria-label={t("workspaces.nav.workspaceLetter", { name })}
        onClick={toggleFolded}
        className="grid size-9 place-items-center rounded-full bg-accent font-bold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {name.slice(0, 1).toUpperCase()}
      </button>
    ),
  };
}

/**
 * F17 (approved board "Browse during a call"): the side menu beside the full call, as in Teams, so the
 * person can open any screen while the call keeps running. No item is current; no switcher (switching
 * workspace mid-call would change every screen around the call).
 */
export function CallNavRail({ onNavigate }: { onNavigate: (screen: AppScreen) => void }) {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  const items = useNavItems(current, { screen: undefined, onNavigate });
  return <NavRail label={t("workspaces.nav.label")} switcher={null} items={items} fold={useFold()} />;
}

export function WorkspaceShell({ screen, onNavigate, children }: WorkspaceShellProps) {
  const { t } = useTranslation();
  const smallView = useCallCorner((state) => state.taken);
  const { current, switchTo } = useCurrentWorkspace();
  const [creating, setCreating] = useState(false);
  const items = useNavItems(current, { screen, onNavigate });
  const fold = useFold();
  return (
    <>
      <AppLayout
        reserveCorner={smallView}
        switcher={<Switcher onCreate={() => setCreating(true)} onJoin={() => onNavigate("join")} />}
        navLabel={t("workspaces.nav.label")}
        items={items}
        topBar={<MyStatusMenu onSettings={() => onNavigate("settings")} />}
        fold={fold}
      >
        <ShellNotice />
        {children}
      </AppLayout>
      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          switchTo(id);
        }}
      />
    </>
  );
}
