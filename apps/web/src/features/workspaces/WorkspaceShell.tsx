// The signed-in app's frame (approved canvas, AC-F01-16): the side menu with the workspace switcher and
// the menu items, and the screen beside it. Creating a workspace opens its dialog here and switches to
// the new one; "Join with a link or code" opens the Join screen.
import { AppLayout, WorkspaceSwitcher, type AppNavItem } from "@meetapp/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog.tsx";
import { useCurrentWorkspace } from "./current-workspace.tsx";
import { useWorkspaceName } from "./workspace-name.ts";

export interface WorkspaceShellProps {
  items: AppNavItem[];
  onJoin: () => void;
  children: ReactNode;
}

export function WorkspaceShell({ items, onJoin, children }: WorkspaceShellProps) {
  const { t } = useTranslation();
  const { workspaces, current, switchTo } = useCurrentWorkspace();
  const nameOf = useWorkspaceName();
  const [creating, setCreating] = useState(false);
  const switcher = current ? (
    <WorkspaceSwitcher
      workspaces={workspaces.map((workspace) => ({
        id: workspace.id,
        name: nameOf(workspace),
        detail: workspace.kind === "personal" ? t("workspaces.onlyYou") : t(`workspaces.roles.${workspace.role}`),
      }))}
      currentId={current.id}
      onSelect={switchTo}
      onCreate={() => setCreating(true)}
      onJoin={onJoin}
      labels={{
        menu: t("workspaces.switcher.menu"),
        heading: t("workspaces.switcher.heading"),
        create: t("workspaces.switcher.create"),
        join: t("workspaces.switcher.join"),
      }}
    />
  ) : null;
  return (
    <>
      <AppLayout switcher={switcher} navLabel={t("workspaces.nav.label")} items={items}>
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
