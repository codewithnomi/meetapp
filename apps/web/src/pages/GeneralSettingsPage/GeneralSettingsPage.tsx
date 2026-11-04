// Settings → General (F04 AC-09): "Start MeetApp when I log in". Only in the desktop app; the switch shows
// what the computer reports.
import { Notice, Spinner, Toggle } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useLoginItem } from "../../features/desktop-app/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface GeneralSettingsPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

export function GeneralSettingsPage({ onNavigate, onBack }: GeneralSettingsPageProps) {
  const { t } = useTranslation();
  const login = useLoginItem();
  return (
    <SettingsShell screen="general" onNavigate={onNavigate} onBack={onBack}>
      <section aria-labelledby="general-heading" className="flex flex-col gap-5">
        <header>
          <h2 id="general-heading" className="m-0 text-heading text-ink">
            {t("settings.general.title")}
          </h2>
        </header>
        {login.on === undefined && !login.failed ? <Spinner label={t("settings.general.loading")} /> : null}
        {login.on !== undefined ? (
          <Toggle
            id="start-at-login"
            label={t("settings.general.startAtLogin")}
            description={t("settings.general.startAtLoginHint")}
            checked={login.on}
            onChange={login.change}
          />
        ) : null}
        {login.failed ? <Notice tone="danger">{t("settings.general.failed")}</Notice> : null}
      </section>
    </SettingsShell>
  );
}
