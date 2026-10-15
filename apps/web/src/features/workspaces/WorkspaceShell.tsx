// The signed-in app's frame (approved canvas, AC-F01-16): the side menu with the workspace switcher and
// the menu items, and the screen beside it. A company workspace adds People and "Requests and
// invitations" (with the count of people asking to join, for the owner and admins). Creating a
// workspace opens its dialog here and switches to the new one. A workspace notice ("You are no longer a
// member of …") shows above the screen until dismissed.
import { AppLayout, Notice, WorkspaceSwitcher, type AppNavItem, type IconName } from "@meetapp/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog.tsx";
import { useCurrentWorkspace } from "./current-workspace.tsx";
import type { MyWorkspace } from "./me.ts";
import { useWorkspaceName } from "./workspace-name.ts";

/** The signed-in screens the side menu and the switcher lead to. */
export type AppScreen = "home" | "meetings" | "people" | "requests" | "settings" | "join";

export interface WorkspaceShellProps {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  children: ReactNode;
}

const ICONS: Record<Exclude<AppScreen, "join">, IconName> = {
  home: "home",
  meetings: "camera",
  people: "users",
  requests: "send",
  settings: "sliders",
};

function useNavItems(current: MyWorkspace | undefined, { screen, onNavigate }: Omit<WorkspaceShellProps, "children">) {
  const { t } = useTranslation();
  const company = current?.kind === "company";
  const screens: Exclude<AppScreen, "join">[] = company
    ? ["home", "meetings", "people", "requests", "settings"]
    : ["home", "meetings", "settings"];
  return screens.map((id): AppNavItem => ({
    id,
    label: t(`workspaces.nav.${id}`),
    icon: ICONS[id],
    current: id === screen,
    onSelect: () => onNavigate(id),
    ...(id === "requests" && current ? { badge: current.pendingRequests } : {}),
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

export function WorkspaceShell({ screen, onNavigate, children }: WorkspaceShellProps) {
  const { t } = useTranslation();
  const { current, switchTo } = useCurrentWorkspace();
  const [creating, setCreating] = useState(false);
  const items = useNavItems(current, { screen, onNavigate });
  return (
    <>
      <AppLayout
        switcher={<Switcher onCreate={() => setCreating(true)} onJoin={() => onNavigate("join")} />}
        navLabel={t("workspaces.nav.label")}
        items={items}
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
