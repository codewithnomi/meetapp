// Settings → About (F04 AC-50): MeetApp's version and "Updates are turned off". Only in the desktop app.
import { Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useAbout } from "../../features/desktop-app/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface AboutPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

export function AboutPage({ onNavigate, onBack }: AboutPageProps) {
  const { t } = useTranslation();
  const about = useAbout();
  return (
    <SettingsShell screen="about" onNavigate={onNavigate} onBack={onBack}>
      <section aria-labelledby="about-heading" className="flex flex-col gap-3">
        <h2 id="about-heading" className="m-0 text-heading text-ink">
          {t("settings.about.title")}
        </h2>
        {about ? (
          <>
            <p className="m-0 text-ink">{t("settings.about.version", { version: about.version })}</p>
            <p className="m-0 text-ink-muted">
              {t(about.updates ? "settings.about.updatesOn" : "settings.about.updatesOff")}
            </p>
          </>
        ) : (
          <Spinner label={t("settings.about.loading")} />
        )}
      </section>
    </SettingsShell>
  );
}
