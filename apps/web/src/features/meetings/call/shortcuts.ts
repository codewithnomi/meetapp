// Meeting shortcuts (AC-F02-22, 44), the same keys as Teams: ⌘⇧M microphone, ⌘⇧O camera, ⌘⇧K hand
// (Ctrl+Shift on Windows and Linux). Active only while the meeting screen is open, never system-wide.
import { useEffect, useRef } from "react";

export type Shortcut = "microphone" | "camera" | "hand";
const KEYS: Record<string, Shortcut> = { m: "microphone", o: "camera", k: "hand" };
const isMac = () => /mac/i.test(navigator.platform || navigator.userAgent);

export function shortcutOf(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">,
  mac: boolean,
) {
  const command = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!command || !event.shiftKey || event.altKey) return undefined;
  return KEYS[event.key.toLowerCase()];
}

export function useMeetingShortcuts(onShortcut: (shortcut: Shortcut) => void): void {
  const handler = useRef(onShortcut);
  useEffect(() => {
    handler.current = onShortcut;
  });
  useEffect(() => {
    const mac = isMac();
    const listener = (event: KeyboardEvent) => {
      const shortcut = shortcutOf(event, mac);
      if (!shortcut) return;
      event.preventDefault();
      handler.current(shortcut);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}

/** "⌘⇧M" on a Mac, "Ctrl+Shift+M" elsewhere, for the buttons' labels. */
export function shortcutText(key: "M" | "O" | "K"): string {
  return isMac() ? `⌘⇧${key}` : `Ctrl+Shift+${key}`;
}
