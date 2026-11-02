// The Settings pages and their routes (F01, F14, F15): one route per page in the Settings menu.
import { Route } from "react-router";
import type { SettingsScreen } from "../features/profile/index.ts";
import { PrivacyPage } from "../pages/PrivacyPage/index.ts";
import { CallsSettingsPage } from "../pages/CallsSettingsPage/index.ts";
import { DevicesSettingsPage } from "../pages/DevicesSettingsPage/index.ts";
import { ProfilePage } from "../pages/ProfilePage/index.ts";
import { SettingsPage } from "../pages/SettingsPage/index.ts";

export /** The Settings pages (F01, F14, F15). */
function settingsRoutes(onNavigate: (screen: SettingsScreen) => void, onBack: () => void) {
  const pages = [
    ["/settings", ProfilePage],
    ["/settings/appearance", SettingsPage],
    ["/settings/devices", DevicesSettingsPage],
    ["/settings/calls", CallsSettingsPage],
    ["/settings/privacy", PrivacyPage],
  ] as const;
  return pages.map(([path, Page]) => (
    <Route key={path} path={path} element={<Page onNavigate={onNavigate} onBack={onBack} />} />
  ));
}
