// JoinWorkspacePage (page): "Join a workspace" from the approved canvas (AC-F01-18, 19, 20): the
// invitations for the signed-in email, and joining with a link or code. A full-page screen with Back,
// like Settings.
import { Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useCurrentWorkspace } from "../../features/workspaces/index.ts";
import { JoinByCode } from "./JoinByCode.tsx";
import { MyInvitations } from "./MyInvitations.tsx";

export interface JoinWorkspacePageProps {
  onBack: () => void;
}

export function JoinWorkspacePage({ onBack }: JoinWorkspacePageProps) {
  const { t } = useTranslation();
  const { switchTo, showNotice } = useCurrentWorkspace();
  const open = (workspaceId: string) => {
    switchTo(workspaceId);
    onBack();
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-190 flex-col gap-8 px-6 py-10">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        {t("workspaces.join.back")}
      </Button>
      <header className="flex flex-col gap-1.5">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("workspaces.join.title")}
        </h1>
        <p className="m-0 text-ink-muted">{t("workspaces.join.description")}</p>
      </header>
      <MyInvitations onJoined={open} />
      <JoinByCode
        onAlreadyMember={(workspaceId, name) => {
          showNotice({ kind: "alreadyMember", name });
          open(workspaceId);
        }}
      />
    </main>
  );
}
