// Start at login (F04 design.md 3.2, AC-F04-08, 09). No Electron here so the rules can be unit-tested;
// login-item-bridge.ts connects them to the system's login items.

export interface LoginSystem {
  isOn: () => boolean;
  set: (on: boolean) => void;
}

export interface AppState {
  /** The login item was turned on once, at the first start after install; later starts keep the choice. */
  loginItemSet?: boolean;
}

/** Screens → main: the Settings switch ("get" or "set"). */
export const LOGIN_ITEM_CHANNEL = "meetapp:login-item";
export const HIDDEN_ARG = "--hidden";
/** Mac fallback: a start this soon after the person logged in counts as a login start (D086). */
const LOGIN_WINDOW_S = 60;

/** The first start after install turns the login item on, once (AC-08); returns the state to save, if changed. */
export function firstStart(state: AppState, system: LoginSystem): AppState | undefined {
  if (state.loginItemSet) return undefined;
  system.set(true);
  return { ...state, loginItemSet: true };
}

export interface StartFacts {
  argv: readonly string[];
  /** Mac: what the system says (often unknown on macOS 13+). */
  openedAtLogin: boolean;
  /** Seconds since the person logged in, when known. */
  secondsSinceLogin: number | undefined;
  /** A meeting link started the app: it must show. */
  hasLink: boolean;
}

/** Whether this start stays hidden in the menu bar (AC-08): never with a link. */
export function startsHidden(facts: StartFacts): boolean {
  if (facts.hasLink) return false;
  if (facts.argv.includes(HIDDEN_ARG) || facts.openedAtLogin) return true;
  return (
    facts.secondsSinceLogin !== undefined && facts.secondsSinceLogin >= 0 && facts.secondsSinceLogin <= LOGIN_WINDOW_S
  );
}

/** Only true or false reaches the system from the Settings switch. */
export function validSwitch(value: unknown): value is boolean {
  return typeof value === "boolean";
}
