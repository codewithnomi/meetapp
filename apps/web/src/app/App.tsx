// The app shell for F00: the home screen and Settings. A router arrives when there are more screens (F01).
import { useEffect, useRef, useState } from "react";
import { followSystemTheme } from "../features/appearance/index.ts";
import { HomePage } from "../pages/HomePage/index.ts";
import { SettingsPage } from "../pages/SettingsPage/index.ts";

type Screen = "home" | "settings";

/** After a screen change, keyboard and screen-reader users land on the new screen's title. */
function useFocusOnScreenChange(screen: Screen): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [screen]);
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  useEffect(() => followSystemTheme(), []);
  useFocusOnScreenChange(screen);

  return screen === "home" ? (
    <HomePage onOpenSettings={() => setScreen("settings")} />
  ) : (
    <SettingsPage onBack={() => setScreen("home")} />
  );
}
