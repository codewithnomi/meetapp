// Test helper: jsdom has no window.matchMedia, so this stands in for the computer's light/dark
// setting ("prefers-color-scheme") and lets a test flip it and fire the "change" event.
import { vi } from "vitest";

type Listener = (event: MediaQueryListEvent) => void;

export interface FakeColorScheme {
  /** Simulates the user switching the computer to dark (true) or light (false). */
  setDark: (dark: boolean) => void;
  /** How many "change" listeners are attached right now. */
  listenerCount: () => number;
}

export function fakeColorScheme(initialDark = false): FakeColorScheme {
  let dark = initialDark;
  const listeners = new Set<Listener>();
  const query: Partial<MediaQueryList> = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    onchange: null,
  } as Partial<MediaQueryList>;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query as MediaQueryList),
  );
  return {
    setDark(next) {
      dark = next;
      const event = { matches: next, media: query.media } as MediaQueryListEvent;
      for (const listener of [...listeners]) listener(event);
    },
    listenerCount: () => listeners.size,
  };
}

/** Clears saved preferences and the <html> data-* attributes so each test starts fresh. */
export function resetAppearanceDom(): void {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.accent;
}
