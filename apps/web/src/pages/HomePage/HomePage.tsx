// HomePage (page): the starter home screen inside the app's frame: the side menu with the workspace
// switcher (F01), and the open workspace's name and the welcome line. The real home screen (meetings,
// minutes) arrives with F02 and F06.
import { Badge } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useFlag, type FlagOptions } from "../../features/flags/index.ts";
import {
  WorkspaceShell,
  useCurrentWorkspace,
  useWorkspaceName,
  type AppScreen,
} from "../../features/workspaces/index.ts";

export interface HomePageProps {
  onNavigate: (screen: AppScreen) => void;
  /** Lets tests point the flag check at a fake backend. */
  flagOptions?: FlagOptions;
}

export function HomePage({ onNavigate, flagOptions }: HomePageProps) {
  const { t } = useTranslation();
  const demoOn = useFlag("demo", flagOptions);
  const { current } = useCurrentWorkspace();
  const nameOf = useWorkspaceName();
  return (
    <WorkspaceShell screen="home" onNavigate={onNavigate}>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:px-12">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {current ? nameOf(current) : t("home.wordmark")}
        </h1>
        <p className="m-0 text-body text-ink-muted">{t("home.welcome")}</p>
        {/* Always present, so screen readers announce the line when it appears. */}
        <div role="status">{demoOn && <Badge tone="accent">{t("home.demoFlag")}</Badge>}</div>
      </main>
    </WorkspaceShell>
  );
}
