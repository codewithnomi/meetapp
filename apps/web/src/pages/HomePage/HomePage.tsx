// HomePage (page): the starter home screen for F00 — wordmark, welcome line and the way to Settings.
// The real home screen (meetings, minutes) arrives with F02 and F06.
import { Badge, Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useFlag, type FlagOptions } from "../../features/flags/index.ts";

export interface HomePageProps {
  onOpenSettings: () => void;
  /** Lets tests point the flag check at a fake backend. */
  flagOptions?: FlagOptions;
}

export function HomePage({ onOpenSettings, flagOptions }: HomePageProps) {
  const { t } = useTranslation();
  const demoOn = useFlag("demo", flagOptions);
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("home.wordmark")}
        </h1>
        <Button variant="secondary" icon="sliders" onClick={onOpenSettings}>
          {t("home.openSettings")}
        </Button>
      </header>
      <p className="m-0 text-body text-ink-muted">{t("home.welcome")}</p>
      {/* Always present, so screen readers announce the line when it appears. */}
      <div role="status">{demoOn && <Badge tone="accent">{t("home.demoFlag")}</Badge>}</div>
    </main>
  );
}
