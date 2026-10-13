// PeoplePage (page): "People in <workspace>" from the approved canvas (AC-F01-17, 19, 21, 22, 23):
// invite by email, the join link and code, and everyone in the workspace. What each person may do
// comes from the server's `yourActions`. Only company workspaces have this screen.
import { Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice, useSession } from "../../features/auth/index.ts";
import {
  WorkspaceShell,
  useCurrentWorkspace,
  useMembers,
  type AppScreen,
  type MyWorkspace,
} from "../../features/workspaces/index.ts";
import { InviteSection } from "./InviteSection.tsx";
import { JoinLinkSection } from "./JoinLinkSection.tsx";
import { MembersSection } from "./MembersSection.tsx";

export interface PeoplePageProps {
  onNavigate: (screen: AppScreen) => void;
}

function PeopleContent({ workspace, onLeft }: { workspace: MyWorkspace; onLeft: () => void }) {
  const { t } = useTranslation();
  const members = useMembers(workspace.id);
  const { data: user } = useSession();
  const data = members.data;
  const allowed = new Set(data?.yourActions ?? []);
  return (
    <main className="flex max-w-245 min-w-0 flex-col gap-8 px-6 py-10 sm:px-12">
      <header className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("workspaces.people.title", { name: workspace.name })}
        </h1>
        {data ? (
          <p className="m-0 text-ink-muted">{t("workspaces.people.summary", { count: data.members.length })}</p>
        ) : null}
      </header>
      {members.isPending ? <Spinner label={t("workspaces.people.loading")} /> : null}
      <ActionErrorNotice error={members.error} onRetry={() => void members.refetch()} />
      {data ? (
        <>
          <InviteSection workspaceId={workspace.id} canInviteAdmin={allowed.has("inviteAdmin")} />
          <JoinLinkSection workspaceId={workspace.id} canManage={allowed.has("manageJoinLink")} />
          <MembersSection workspace={workspace} data={data} myId={user?.id} onLeft={onLeft} />
        </>
      ) : null}
    </main>
  );
}

export function PeoplePage({ onNavigate }: PeoplePageProps) {
  const { current, workspaces, switchTo } = useCurrentWorkspace();
  const leftWorkspace = () => {
    const personal = workspaces.find((workspace) => workspace.kind === "personal");
    if (personal) switchTo(personal.id);
    onNavigate("home");
  };
  return (
    <WorkspaceShell screen="people" onNavigate={onNavigate}>
      {current ? <PeopleContent key={current.id} workspace={current} onLeft={leftWorkspace} /> : null}
    </WorkspaceShell>
  );
}
