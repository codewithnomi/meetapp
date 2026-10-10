// The appearance choice while the app runs. Every change is saved and applied to <html> at once, so
// the whole app switches without a reload (AC-F00-08, AC-F00-10).
import type { Accent } from "@meetapp/design-tokens";
import { create } from "zustand";
import {
  applyAppearance,
  loadAppearance,
  saveAppearance,
  watchSystemTheme,
  type Appearance,
  type ThemeChoice,
} from "./appearance.ts";

interface AppearanceState extends Appearance {
  setTheme: (theme: ThemeChoice) => void;
  setAccent: (accent: Accent) => void;
}

function current({ theme, accent }: Appearance): Appearance {
  return { theme, accent };
}

export const useAppearance = create<AppearanceState>()((set, get) => {
  const update = (change: Partial<Appearance>): void => {
    set(change);
    const next = current(get());
    saveAppearance(next);
    applyAppearance(next);
  };
  return {
    ...loadAppearance(),
    setTheme: (theme) => update({ theme }),
    setAccent: (accent) => update({ accent }),
  };
});

/** While "Same as my computer" is chosen, follow the computer's light/dark switch. Returns a stop function. */
export function followSystemTheme(): () => void {
  return watchSystemTheme(() => {
    const state = useAppearance.getState();
    if (state.theme === "system") applyAppearance(current(state));
  });
}
