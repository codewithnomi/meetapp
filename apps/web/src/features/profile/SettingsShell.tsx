// The Settings frame from the approved canvas: a side menu with Back, the "Settings" title and the
// settings pages (Profile and account, Appearance, Devices, Calls, Privacy), and the page beside it. Persona, integrations and
// the others arrive with their features.
import { AppLayout, Button, type AppNavItem, type IconName } from "@meetapp/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCallCorner } from "../call-corner/index.ts";
import { canStartAtLogin } from "../desktop-app/index.ts";

export type SettingsScreen =
  "profile" | "general" | "notifications" | "about" | "appearance" | "devices" | "calls" | "privacy";

/** The settings pages in menu order, with their icons. */
const SCREENS: [SettingsScreen, IconName][] = [
  ["profile", "users"],
  // F04: only in the desktop app (DESKTOP_ONLY).
  ["general", "monitor"],
  ["notifications", "bell"],
  ["appearance", "sliders"],
  ["devices", "camera"],
  ["calls", "phone"],
  ["privacy", "lock"],
  ["about", "info"],
];

/** F04: the desktop app's own pages (start at login, its notification cards). */
const DESKTOP_ONLY: SettingsScreen[] = ["general", "notifications", "about"];

export interface SettingsShellProps {
  screen: SettingsScreen;
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
  children: ReactNode;
}

export function SettingsShell({ screen, onNavigate, onBack, children }: SettingsShellProps) {
  const { t } = useTranslation();
  const smallView = useCallCorner((state) => state.taken);
  const items: AppNavItem[] = SCREENS.filter(([id]) => !DESKTOP_ONLY.includes(id) || canStartAtLogin()).map(
    ([id, icon]) => ({
      id,
      label: t(`settings.nav.${id}`),
      icon,
      current: screen === id,
      onSelect: () => onNavigate(id),
    }),
  );
  return (
    <AppLayout
      reserveCorner={smallView}
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
