// Settings → Notifications (F04 AC-F04-36): chat messages, mentions, lobby waiting, sound and message
// preview, each on its own; all on by default; a change applies at once and follows the account.
import type { NotificationSettings } from "@meetapp/contracts";
import { Notice, Toggle } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useNotificationSettings } from "../../features/notifications/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface NotificationSettingsPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

const SWITCHES: (keyof NotificationSettings)[] = ["messages", "mentions", "lobby", "sound", "preview"];

export function NotificationSettingsPage({ onNavigate, onBack }: NotificationSettingsPageProps) {
  const { t } = useTranslation();
  const { settings, change, failed } = useNotificationSettings();
  return (
    <SettingsShell screen="notifications" onNavigate={onNavigate} onBack={onBack}>
      <section aria-labelledby="notifications-heading" className="flex flex-col gap-5">
        <header>
          <h2 id="notifications-heading" className="m-0 text-heading text-ink">
            {t("settings.notifications.title")}
          </h2>
        </header>
        {SWITCHES.map((key) => (
          <Toggle
            key={key}
            id={`notify-${key}`}
            label={t(`settings.notifications.${key}`)}
            description={t(`settings.notifications.${key}Hint`)}
            checked={settings[key]}
            onChange={(on) => change({ [key]: on })}
          />
        ))}
        {failed ? <Notice tone="danger">{t("settings.notifications.failed")}</Notice> : null}
      </section>
    </SettingsShell>
  );
}
