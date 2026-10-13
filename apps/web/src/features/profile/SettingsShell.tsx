// The Settings frame from the approved canvas: a side menu with Back, the "Settings" title and the
// settings pages (Profile and account, Appearance), and the page beside it. Persona, integrations and
// the others arrive with their features.
import { AppLayout, Button, type AppNavItem } from "@meetapp/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type SettingsScreen = "profile" | "appearance";

export interface SettingsShellProps {
  screen: SettingsScreen;
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
  children: ReactNode;
}

export function SettingsShell({ screen, onNavigate, onBack, children }: SettingsShellProps) {
  const { t } = useTranslation();
  const items: AppNavItem[] = [
    {
      id: "profile",
      label: t("settings.nav.profile"),
      icon: "users",
      current: screen === "profile",
      onSelect: () => onNavigate("profile"),
    },
    {
      id: "appearance",
      label: t("settings.nav.appearance"),
      icon: "sliders",
      current: screen === "appearance",
      onSelect: () => onNavigate("appearance"),
    },
  ];
  return (
    <AppLayout
      switcher={
        <Button variant="ghost" className="self-start" onClick={onBack}>
          {t("settings.back")}
        </Button>
      }
      navLabel={t("settings.nav.label")}
      items={items}
    >
      <main className="flex max-w-215 min-w-0 flex-col gap-10 px-6 py-10 sm:px-12">
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("settings.title")}
        </h1>
        {children}
      </main>
    </AppLayout>
  );
}
