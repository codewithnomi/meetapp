// RequestsPage (page): "Requests and invitations" from the approved canvas (AC-F01-17, 19). The owner
// and admins decide requests to join; everyone sees the invitations they may cancel or send again.
import { useTranslation } from "react-i18next";
import { WorkspaceShell, useCurrentWorkspace, type AppScreen } from "../../features/workspaces/index.ts";
import { AskingSection } from "./AskingSection.tsx";
import { SentSection } from "./SentSection.tsx";

export interface RequestsPageProps {
  onNavigate: (screen: AppScreen) => void;
}

export function RequestsPage({ onNavigate }: RequestsPageProps) {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  return (
    <WorkspaceShell screen="requests" onNavigate={onNavigate}>
      <main className="flex max-w-245 min-w-0 flex-col gap-8 px-6 py-10 sm:px-12">
        <header className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
            {t("workspaces.requests.title")}
          </h1>
          <p className="m-0 text-ink-muted">{t("workspaces.requests.description")}</p>
        </header>
        {current && current.role !== "member" ? (
          <AskingSection key={`a-${current.id}`} workspaceId={current.id} />
        ) : null}
        {current ? <SentSection key={`s-${current.id}`} workspaceId={current.id} /> : null}
      </main>
    </WorkspaceShell>
  );
}
