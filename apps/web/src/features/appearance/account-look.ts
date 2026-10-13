// The look follows the account (AC-F01-26): at sign-in the account's theme and accent replace this
// computer's; an account without a saved look (e.g. a first Google sign-in) takes this computer's. Every
// change made while signed in is saved to the account too. After sign-out the computer keeps the last
// look, because the local copy is always kept up to date.
import { ACCENTS } from "@meetapp/design-tokens";
import { useEffect, useRef } from "react";
import { apiRequest } from "../api/index.ts";
import { THEME_CHOICES, type Appearance, type ThemeChoice } from "./appearance.ts";
import { useAppearance } from "./appearance-store.ts";

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

/** Saving to the account; a failure keeps the change on this computer only. */
const saveToAccount = (look: Partial<Appearance>) =>
  apiRequest("/api/v1/me/preferences", { method: "PATCH", body: look }).catch(() => undefined);

interface AccountUser {
  id: string;
  theme: string | null;
  accent: string | null;
}

/** Once per signed-in person: take the account's look, or give the account this computer's. */
export function useAccountLook(user: AccountUser | null | undefined): void {
  const adopted = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!user || adopted.current === user.id) return;
    adopted.current = user.id;
    const local = useAppearance.getState();
    const theme = isOneOf(THEME_CHOICES, user.theme) ? user.theme : undefined;
    const accent = isOneOf(ACCENTS, user.accent) ? user.accent : undefined;
    if (theme === undefined && accent === undefined) {
      void saveToAccount({ theme: local.theme, accent: local.accent });
      return;
    }
    local.setAppearance({ theme: theme ?? local.theme, accent: accent ?? local.accent });
  }, [user]);
}

/** Theme and accent setters that also save to the account. */
export function useSaveLook() {
  const { setTheme, setAccent } = useAppearance();
  return {
    setTheme: (theme: ThemeChoice) => {
      setTheme(theme);
      void saveToAccount({ theme });
    },
    setAccent: (accent: Appearance["accent"]) => {
      setAccent(accent);
      void saveToAccount({ accent });
    },
  };
}
