// Closes a popup when the person presses outside it (and outside the button that opens it, marked with
// the `data-expressions-button` attribute), as in Teams.
import { useEffect, type RefObject } from "react";

/** Marks the button that opens the popup. */
export const OPENER = { "data-expressions-button": "" };
const OPENER_SELECTOR = "[data-expressions-button]";

/** Back to the opening button after the popup closes, so the keyboard isn't lost. */
export function focusOpener(): void {
  document.querySelector<HTMLElement>(OPENER_SELECTOR)?.focus();
}

/** A press outside the popup (and outside its smiley button) closes it, as in Teams. */
export function useCloseOnOutside(open: boolean, popup: RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = popup.current?.contains(target) ?? false;
      const opener = (target as Element).closest?.(OPENER_SELECTOR) !== null;
      if (!inside && !opener) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, popup, close]);
}
